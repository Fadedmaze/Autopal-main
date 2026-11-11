-- Maintenance notifications that reach people when AutoPal is closed: phone/computer
-- push notifications and email. The send-reminders Edge Function runs every morning
-- (see supabase/setup/schedule_reminders.sql), finds tasks whose reminder day has
-- arrived, and sends each person one push per device and one email.
-- Safe to re-run.

-- Devices that turned on push notifications (one row per browser/phone).
create table if not exists public.push_subscriptions (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push: read own" on public.push_subscriptions;
create policy "push: read own" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
-- Writes only through the two functions below.
revoke insert, update, delete on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

-- Save this device for the signed-in user. If the device was registered to another
-- account before (someone else signed in on it), it now belongs to this one.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'Invalid push subscription';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- Email reminders on/off (on by default; the master "Maintenance Reminders" switch
-- still turns everything off).
alter table public.notification_settings
  add column if not exists email_reminders boolean not null default true;

-- What has been sent, so a reminder goes out once per task, due date and channel.
-- Only the Edge Function (service role) reads and writes it.
create table if not exists public.reminder_log (
  task_id  bigint not null references public.maintenance_tasks (id) on delete cascade,
  due_date date not null,
  channel  text not null check (channel in ('push', 'email')),
  sent_at  timestamptz not null default now(),
  primary key (task_id, due_date, channel)
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;
