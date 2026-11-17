-- Real repair shops from Google Places (Find a Mechanic). The google-shops Edge Function
-- calls Google with a server-side key; this table caps lookups per person per day AND for
-- the whole app per day, so usage stays inside Google's free monthly allowance (about
-- 1,000 searches and 1,000 shop pages a month). Only the function (service role) uses it.
-- Safe to re-run.

create table if not exists public.google_places_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null default current_date,
  searches integer not null default 0,
  details  integer not null default 0,
  primary key (user_id, day)
);
alter table public.google_places_usage enable row level security;
revoke all on public.google_places_usage from anon, authenticated;

-- Count one lookup and say whether it's still within today's allowance: the person's
-- own limit (p_limit) and the whole app's limit (p_app_limit, all users together).
drop function if exists public.use_google_places(uuid, text, integer);
create or replace function public.use_google_places(p_user uuid, p_kind text, p_limit integer, p_app_limit integer default 30)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  used integer;
  app_used integer;
begin
  if p_kind not in ('search', 'details') then return false; end if;
  -- One lookup at a time, so two people can't both squeeze past the app-wide limit.
  perform pg_advisory_xact_lock(hashtext('google_places_usage'));
  select coalesce(sum(case when p_kind = 'search' then searches else details end), 0) into app_used
  from public.google_places_usage where day = current_date;
  if app_used >= p_app_limit then return false; end if;
  insert into public.google_places_usage (user_id, day) values (p_user, current_date)
  on conflict (user_id, day) do nothing;
  if p_kind = 'search' then
    update public.google_places_usage set searches = searches + 1
    where user_id = p_user and day = current_date and searches < p_limit
    returning searches into used;
  else
    update public.google_places_usage set details = details + 1
    where user_id = p_user and day = current_date and details < p_limit
    returning details into used;
  end if;
  return used is not null;
end;
$$;

revoke execute on function public.use_google_places(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.use_google_places(uuid, text, integer, integer) to service_role;

-- Old rows aren't needed; keep the table small.
delete from public.google_places_usage where day < current_date - 30;
