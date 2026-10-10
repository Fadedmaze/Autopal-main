-- =====================================================================
-- AutoPal: full Supabase backend rebuild
-- Reconstructed from js/data.js, js/auth.js and harness/supabaseClient.stub.js
-- Paste the whole file into Supabase Dashboard -> SQL Editor -> Run.
-- Safe to run on a brand-new project.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- One row per auth user. Created automatically by the trigger in section 2.
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  username          text check (username ~ '^[A-Za-z0-9_.]{3,30}$'),
  avatar_path       text,
  distance_unit     text not null default 'mi' check (distance_unit in ('mi', 'km')),
  active_vehicle_id bigint,          -- FK added after vehicles exists
  created_at        timestamptz not null default now()
);
-- Usernames are unique regardless of case ("Kevin" and "kevin" collide).
create unique index profiles_username_lower_idx on public.profiles (lower(username));

create table public.notification_settings (
  id                     bigint generated always as identity primary key,
  user_id                uuid not null unique references public.profiles (id) on delete cascade,
  task_reminders_enabled boolean not null default true,
  reminder_days_before   integer not null default 7 check (reminder_days_before between 0 and 365)
);

create table public.vehicles (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  vehicle_nickname text,
  brand            text not null,
  make             text not null,
  model            text,
  model_year       integer check (model_year between 1900 and 2100),
  current_mileage  integer check (current_mileage >= 0),
  description      text,
  created_at       timestamptz not null default now()
);
create index vehicles_user_id_idx on public.vehicles (user_id);

alter table public.profiles
  add constraint profiles_active_vehicle_fk
  foreign key (active_vehicle_id) references public.vehicles (id) on delete set null;

-- Standard tasks every new car gets (see seed data at the bottom).
create table public.maintenance_catalog (
  id             bigint generated always as identity primary key,
  task_name      text not null,
  typical_cost   numeric(10,2) not null default 0,
  interval_days  integer not null,   -- days between repeats once completed
  first_due_days integer not null,   -- days from "car added" to first due date
  sort_order     integer not null default 0
);

create table public.mechanic_shops (
  id                   bigint generated always as identity primary key,
  shop_name            text not null,
  street_address       text not null,
  city                 text not null,
  phone                text,
  latitude             double precision not null,
  longitude            double precision not null,
  average_rating       numeric(2,1) check (average_rating between 0 and 5),
  average_repair_price numeric(10,2),
  services             text[] not null default '{}'
);

-- Junction between vehicles and mechanic_shops (per the ERD).
create table public.maintenance_tasks (
  id                     bigint generated always as identity primary key,
  vehicle_id             bigint not null references public.vehicles (id) on delete cascade,
  shop_id                bigint references public.mechanic_shops (id) on delete set null,
  catalog_id             bigint references public.maintenance_catalog (id) on delete set null,
  generated_from_task_id bigint references public.maintenance_tasks (id) on delete set null,
  task_name              text not null,
  due_date               date,
  estimated_cost         numeric(10,2),
  is_completed           boolean not null default false,
  completed_date         date,
  notes                  text,
  receipt_path           text,
  created_at             timestamptz not null default now()
);
create index maintenance_tasks_vehicle_id_idx on public.maintenance_tasks (vehicle_id);
create index maintenance_tasks_generated_idx on public.maintenance_tasks (generated_from_task_id);

create table public.vehicle_photos (
  id           bigint generated always as identity primary key,
  vehicle_id   bigint not null references public.vehicles (id) on delete cascade,
  storage_path text not null,
  uploaded_at  timestamptz not null default now()
);
create index vehicle_photos_vehicle_id_idx on public.vehicle_photos (vehicle_id);

-- Library content.
create table public.guides (
  id            bigint generated always as identity primary key,
  category      text not null check (category in ('diy', 'dashboard')),
  slug          text not null unique,
  title         text not null,
  summary       text,
  steps         text[] not null default '{}',
  tools         text[] not null default '{}',
  time_estimate text,
  severity      text check (severity in ('stop', 'soon', 'info')),
  sort_order    integer not null default 0
);


-- ---------------------------------------------------------------------
-- 2. TRIGGERS
-- ---------------------------------------------------------------------

-- New sign-up -> profile row (username comes from signUp options.data) + settings row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');

  insert into public.notification_settings (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- New vehicle -> copy the standard schedule from maintenance_catalog.
create or replace function public.seed_vehicle_tasks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.maintenance_tasks (vehicle_id, catalog_id, task_name, due_date, estimated_cost)
  select new.id, c.id, c.task_name, current_date + c.first_due_days, c.typical_cost
  from public.maintenance_catalog c
  order by c.sort_order;
  return new;
end;
$$;

create trigger on_vehicle_created
  after insert on public.vehicles
  for each row execute function public.seed_vehicle_tasks();

-- Completing a catalog task schedules the next one; un-completing removes it.
create or replace function public.schedule_next_task()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c public.maintenance_catalog;
begin
  if new.is_completed and not old.is_completed and new.catalog_id is not null then
    select * into c from public.maintenance_catalog where id = new.catalog_id;
    if found and not exists (
      select 1 from public.maintenance_tasks where generated_from_task_id = new.id
    ) then
      insert into public.maintenance_tasks
        (vehicle_id, catalog_id, task_name, due_date, estimated_cost, generated_from_task_id)
      values
        (new.vehicle_id, c.id, new.task_name,
         coalesce(new.completed_date, current_date) + c.interval_days,
         new.estimated_cost, new.id);
    end if;
  elsif old.is_completed and not new.is_completed then
    delete from public.maintenance_tasks
    where generated_from_task_id = new.id and not is_completed;
  end if;
  return new;
end;
$$;

create trigger on_task_completion_changed
  after update of is_completed on public.maintenance_tasks
  for each row execute function public.schedule_next_task();


-- ---------------------------------------------------------------------
-- 3. VIEW  (security_invoker so each user only sees their own rollups)
-- ---------------------------------------------------------------------

create or replace view public.vehicle_task_summary
with (security_invoker = true) as
select
  v.id as vehicle_id,
  count(t.id) filter (where not t.is_completed)                              as open_count,
  count(t.id) filter (where not t.is_completed and t.due_date < current_date) as overdue_count,
  min(t.due_date) filter (where not t.is_completed)                          as next_due_date,
  coalesce(sum(t.estimated_cost) filter (where not t.is_completed), 0)       as open_estimated_total,
  coalesce(sum(t.estimated_cost) filter (where t.is_completed), 0)           as completed_cost_total,
  coalesce(sum(t.estimated_cost), 0)                                         as all_estimated_total
from public.vehicles v
left join public.maintenance_tasks t on t.vehicle_id = v.id
group by v.id;


-- ---------------------------------------------------------------------
-- 4. RPC FUNCTIONS
-- ---------------------------------------------------------------------

-- Called from the sign-up screen BEFORE the user is logged in, so it runs as
-- definer to see all profiles, but only ever returns true/false.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

revoke execute on function public.is_username_available(text) from public;
grant  execute on function public.is_username_available(text) to anon, authenticated;

-- Shops sorted by straight-line distance (haversine, miles).
create or replace function public.nearby_shops(
  p_lat   double precision,
  p_lng   double precision,
  p_limit integer default 50
)
returns table (
  id                   bigint,
  shop_name            text,
  street_address       text,
  city                 text,
  phone                text,
  latitude             double precision,
  longitude            double precision,
  average_rating       numeric,
  average_repair_price numeric,
  services             text[],
  distance_miles       double precision
)
language sql
stable
set search_path = ''
as $$
  select
    s.id, s.shop_name, s.street_address, s.city, s.phone,
    s.latitude, s.longitude, s.average_rating, s.average_repair_price, s.services,
    2 * 3958.8 * asin(sqrt(
      power(sin(radians(s.latitude - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(s.latitude))
        * power(sin(radians(s.longitude - p_lng) / 2), 2)
    )) as distance_miles
  from public.mechanic_shops s
  order by distance_miles
  limit p_limit;
$$;

grant execute on function public.nearby_shops(double precision, double precision, integer) to authenticated;


-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.notification_settings enable row level security;
alter table public.vehicles              enable row level security;
alter table public.maintenance_tasks     enable row level security;
alter table public.vehicle_photos        enable row level security;
alter table public.maintenance_catalog   enable row level security;
alter table public.mechanic_shops        enable row level security;
alter table public.guides                enable row level security;

-- Profiles & settings: read/update your own row only (rows are created by the trigger).
create policy "profiles: read own"   on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "settings: read own"   on public.notification_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "settings: update own" on public.notification_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Vehicles: full control over your own cars.
create policy "vehicles: own" on public.vehicles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Tasks & photos: allowed when the parent vehicle is yours.
create policy "tasks: via own vehicle" on public.maintenance_tasks for all to authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid())))
  with check (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid())));

create policy "photos: via own vehicle" on public.vehicle_photos for all to authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid())))
  with check (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid())));

-- Reference data: read-only for any signed-in user.
create policy "catalog: read" on public.maintenance_catalog for select to authenticated using (true);
create policy "shops: read"   on public.mechanic_shops      for select to authenticated using (true);
create policy "guides: read"  on public.guides              for select to authenticated using (true);

-- Explicit grants (RLS above still decides which rows).
grant select, update                 on public.profiles, public.notification_settings to authenticated;
grant select, insert, update, delete on public.vehicles, public.maintenance_tasks, public.vehicle_photos to authenticated;
grant select on public.maintenance_catalog, public.mechanic_shops, public.guides, public.vehicle_task_summary to authenticated;


-- ---------------------------------------------------------------------
-- 6. STORAGE  (private buckets; files live under "<user id>/...")
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', false),
       ('receipts',       'receipts',       false),
       ('avatars',        'avatars',        false)
on conflict (id) do nothing;

create policy "files: read own" on storage.objects for select to authenticated
  using (bucket_id in ('vehicle-photos', 'receipts', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "files: upload own" on storage.objects for insert to authenticated
  with check (bucket_id in ('vehicle-photos', 'receipts', 'avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "files: update own" on storage.objects for update to authenticated
  using (bucket_id in ('vehicle-photos', 'receipts', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "files: delete own" on storage.objects for delete to authenticated
  using (bucket_id in ('vehicle-photos', 'receipts', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ---------------------------------------------------------------------
-- 7. SEED DATA
-- Catalog matches the original. Shops and guides come from the test
-- harness, so they're starter content -- replace/expand as needed.
-- ---------------------------------------------------------------------

insert into public.maintenance_catalog (task_name, typical_cost, interval_days, first_due_days, sort_order) values
  ('Oil change',          75, 120,  30, 1),
  ('Tire rotation',       40, 180,  45, 2),
  ('Tire pressure check',  0,  30,   7, 3),
  ('Wiper blades',        30, 365,  90, 4),
  ('Engine air filter',   35, 365, 120, 5),
  ('Brake inspection',    50, 365, 150, 6),
  ('Emissions test',      30, 365, 180, 7),
  ('Battery check',       25, 365, 200, 8);

insert into public.mechanic_shops
  (shop_name, street_address, city, phone, latitude, longitude, average_rating, average_repair_price, services) values
  ('Joe''s Auto Shop',            '450 N University Ave',   'Provo',       '(801) 555-0100', 40.2403, -111.6586, 4.5, 285, array['Oil change','Brakes','Tires','Inspection']),
  ('Cougar Country Car Care',     '1230 N Canyon Rd',       'Provo',       '(801) 555-0101', 40.2519, -111.6507, 4.7, 340, array['Oil change','Brakes','Engine','Electrical']),
  ('Freedom Blvd Brake & Tire',   '780 S Freedom Blvd',     'Provo',       '(801) 555-0102', 40.2226, -111.6656, 4.2, 210, array['Brakes','Tires','Alignment']),
  ('Riverside Lube Express',      '2250 N University Pkwy', 'Provo',       '(801) 555-0103', 40.2688, -111.6665, 3.9,  95, array['Oil change','Inspection']),
  ('State Street Service Center', '560 S State St',         'Orem',        '(801) 555-0104', 40.2887, -111.6945, 4.4, 260, array['Oil change','Brakes','Tires','Engine']),
  ('Springville Auto Repair',     '350 S Main St',          'Springville', '(801) 555-0105', 40.1595, -111.6106, 4.8, 275, array['Oil change','Brakes','Tires','Electrical']);

insert into public.guides (category, slug, title, summary, steps, tools, time_estimate, severity, sort_order) values
  ('diy', 'check-oil-level', 'Check your oil level', 'A 2-minute check that catches low oil early.',
    array['Park on level ground.', 'Pull the dipstick, wipe, reinsert, read.'], array['Rag'], '5 minutes', null, 1),
  ('diy', 'wiper-blades', 'Replace wiper blades', 'Streaky wipers? New blades take minutes.',
    array['Lift the arm.', 'Slide off the old blade.', 'Click in the new one.'], array['New blades'], '10 minutes', null, 2),
  ('dashboard', 'check-engine', 'Check engine light', 'The engine computer found a problem.',
    array['Steady: get the code read soon.', 'Flashing: get to a mechanic right away.'], '{}', null, 'soon', 1),
  ('dashboard', 'oil-pressure', 'Oil pressure warning', 'Not enough oil pressure.',
    array['Pull over and turn off the engine.'], '{}', null, 'stop', 2);
