-- Usage tracking: how much time signed-in users actively spend in AutoPal.
-- One row per visit ("session"). The app counts time only while AutoPal is on
-- screen and the person has interacted in the last 5 minutes, and sends it every
-- minute. It records time, pages viewed and device type, never what anyone types.
--
-- Users can only add to and read their own sessions. The team reads the totals
-- in the SQL Editor through the two views at the bottom, which the app itself
-- can't see. Safe to re-run.

create table if not exists public.app_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  started_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  page_views     integer not null default 0 check (page_views >= 0),
  device         text check (device in ('phone', 'tablet', 'desktop')),
  installed      boolean not null default false  -- opened from the home screen (installed app)
);
create index if not exists app_sessions_user_started_idx on public.app_sessions (user_id, started_at desc);
create index if not exists app_sessions_started_idx on public.app_sessions (started_at desc);

alter table public.app_sessions enable row level security;

drop policy if exists "sessions: read own" on public.app_sessions;
create policy "sessions: read own" on public.app_sessions for select to authenticated
  using (user_id = (select auth.uid()));

-- Writes go only through the two functions below, which cap how much time one
-- update can add, so nobody can inflate their numbers by hand.
revoke insert, update, delete on public.app_sessions from anon, authenticated;
grant select on public.app_sessions to authenticated;

-- Start a visit; returns its id.
create or replace function public.start_app_session(p_device text default null, p_installed boolean default false)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.app_sessions (user_id, device, installed)
  select auth.uid(),
         case when p_device in ('phone', 'tablet', 'desktop') then p_device end,
         coalesce(p_installed, false)
  where auth.uid() is not null
  returning id;
$$;

-- Add time and page views to one of your own visits. Each call adds at most
-- 2 minutes of time and 50 page views (the app sends every minute).
create or replace function public.track_app_session(p_session uuid, p_seconds integer, p_page_views integer default 0)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.app_sessions
  set active_seconds = least(86400, active_seconds + greatest(0, least(coalesce(p_seconds, 0), 120))),
      page_views     = page_views + greatest(0, least(coalesce(p_page_views, 0), 50)),
      last_seen_at   = now()
  where id = p_session
    and user_id = auth.uid()
    and started_at > now() - interval '1 day';
$$;

revoke execute on function public.start_app_session(text, boolean) from public, anon;
revoke execute on function public.track_app_session(uuid, integer, integer) from public, anon;
grant execute on function public.start_app_session(text, boolean) to authenticated;
grant execute on function public.track_app_session(uuid, integer, integer) to authenticated;

-- ---- For the team (SQL Editor only) ----------------------------------------
-- Daily totals across everyone.
create or replace view public.app_usage_daily
with (security_invoker = true) as
select
  (s.started_at at time zone 'America/Denver')::date             as day,
  count(distinct s.user_id)                                      as users,
  count(*)                                                       as sessions,
  round(sum(s.active_seconds) / 60.0, 1)                         as total_minutes,
  round(avg(s.active_seconds) / 60.0, 1)                         as avg_minutes_per_session,
  round(sum(s.active_seconds) / 60.0 / count(distinct s.user_id), 1) as avg_minutes_per_user,
  sum(s.page_views)                                              as page_views
from public.app_sessions s
where s.active_seconds > 0
group by 1
order by 1 desc;

-- Totals per user.
create or replace view public.app_usage_by_user
with (security_invoker = true) as
select
  p.username,
  count(s.id)                                as sessions,
  round(sum(s.active_seconds) / 60.0, 1)     as total_minutes,
  round(avg(s.active_seconds) / 60.0, 1)     as avg_minutes_per_session,
  sum(s.page_views)                          as page_views,
  min(s.started_at)                          as first_visit,
  max(s.last_seen_at)                        as last_visit
from public.app_sessions s
join public.profiles p on p.id = s.user_id
where s.active_seconds > 0
group by p.username
order by total_minutes desc;

-- The app never reads these, and they'd show other people's usage.
revoke all on public.app_usage_daily, public.app_usage_by_user from public, anon, authenticated;
