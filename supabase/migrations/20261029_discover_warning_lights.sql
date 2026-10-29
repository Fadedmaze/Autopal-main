-- Discover: dashboard warning-light scanner.
-- warning_lights: shared, read-only catalog the scanner and info cards draw from.
--   brand_notes is keyed by lowercase brand (e.g. "honda") so the same symbol can
--   mean different things per make (Ford's amber wrench vs Honda's Maintenance Minder).
-- light_scans: one row per AI identification call. The Edge Function writes it with
--   the service role and uses it to cap scans per user per day (cost control).

create table public.warning_lights (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  colors text[] not null default '{}',
  severity text not null check (severity in ('stop', 'soon', 'info')),
  symbol_hint text not null,
  meaning text not null,
  action text not null,
  drive_advice text not null,
  brand_notes jsonb not null default '{}'::jsonb,
  -- Per-make severity override, e.g. {"ford": "soon"} when a symbol is more urgent on that make.
  brand_severity jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0
);
alter table public.warning_lights enable row level security;
create policy warning_lights_select on public.warning_lights for select to authenticated using (true);
revoke insert, update, delete on public.warning_lights from anon, authenticated;
revoke all on public.warning_lights from anon;

create table public.light_scans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vehicle_id bigint references public.vehicles (id) on delete set null,
  crop_count integer not null check (crop_count between 1 and 8),
  results jsonb,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index light_scans_user_created_idx on public.light_scans (user_id, created_at desc);
create index light_scans_vehicle_id_idx on public.light_scans (vehicle_id);
alter table public.light_scans enable row level security;
create policy light_scans_select_own on public.light_scans
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.light_scans from anon, authenticated;
revoke all on public.light_scans from anon;
