-- AutoPal: all three 2026-11-04 migrations in one script.
-- Paste this whole file into Supabase → project AutoPal (hrcthuqltodogsglfatt) → SQL Editor → Run.
-- It runs as one transaction: if anything fails, nothing is changed. Safe to run twice.
-- The last query prints a check; every column should say true.

begin;

-- ============ 20261104_profile_display_name.sql ============
-- Display name for the profile (shown on Home instead of the username; falls back to username).
-- Additive only: nullable column, length check, and update permission for the signed-in user.
alter table public.profiles add column if not exists display_name text;

alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) between 1 and 40);

grant update (display_name) on public.profiles to authenticated;

-- ============ 20261104_task_remind_days.sql ============
-- Per-task reminder timing. NULL means "use my default" (notification_settings.reminder_days_before).
-- Additive: a nullable column with a range check, plus the repeat-task trigger now
-- carries the chosen timing over to the next scheduled task.
alter table public.maintenance_tasks add column if not exists remind_days_before integer;

alter table public.maintenance_tasks drop constraint if exists maintenance_tasks_remind_days_before_range;
alter table public.maintenance_tasks
  add constraint maintenance_tasks_remind_days_before_range
  check (remind_days_before is null or remind_days_before between 0 and 60);

-- Same as before, except the next task inherits remind_days_before: if you asked to hear
-- about oil changes two weeks early, the next oil change keeps that setting.
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
        (vehicle_id, catalog_id, task_name, due_date, estimated_cost, generated_from_task_id, remind_days_before)
      values
        (new.vehicle_id, c.id, new.task_name,
         coalesce(new.completed_date, current_date) + c.interval_days,
         new.estimated_cost, new.id, new.remind_days_before);
    end if;
  elsif old.is_completed and not new.is_completed then
    delete from public.maintenance_tasks
    where generated_from_task_id = new.id and not is_completed;
  end if;
  return new;
end;
$$;

-- ============ 20261104_warning_light_repairs.sql ============
-- What usually fixes each dashboard light, which shops can do it, and what it costs.
-- Used by Find a Mechanic when it's opened for a warning light (#/mechanics?problem=<slug>).
-- Additive only: new nullable/defaulted columns, checks, then a backfill. Lights that are
-- just information (high beams, cruise control...) keep repair_service NULL.
alter table public.warning_lights add column if not exists repair_service text;
alter table public.warning_lights add column if not exists repair_alt_services text[] not null default '{}';
alter table public.warning_lights add column if not exists repair_cost_low numeric;
alter table public.warning_lights add column if not exists repair_cost_high numeric;
alter table public.warning_lights add column if not exists needs_diagnosis boolean not null default false;
alter table public.warning_lights add column if not exists repair_note text;

alter table public.warning_lights drop constraint if exists warning_lights_repair_service_check;
alter table public.warning_lights
  add constraint warning_lights_repair_service_check
  check (repair_service is null or repair_service in ('Oil change','Brakes','Tires','Engine','Transmission','Electrical','Alignment','Inspection'));

alter table public.warning_lights drop constraint if exists warning_lights_repair_alt_services_check;
alter table public.warning_lights
  add constraint warning_lights_repair_alt_services_check
  check (repair_alt_services <@ array['Oil change','Brakes','Tires','Engine','Transmission','Electrical','Alignment','Inspection']::text[]);

alter table public.warning_lights drop constraint if exists warning_lights_repair_cost_check;
alter table public.warning_lights
  add constraint warning_lights_repair_cost_check
  check ((repair_cost_low is null) = (repair_cost_high is null)
         and (repair_cost_low is null or (repair_cost_low >= 0 and repair_cost_high >= repair_cost_low)));

-- Typical US ranges for the usual fix (parts + labor at an independent shop), 2025–2026.
update public.warning_lights as w
set repair_service = v.service, repair_alt_services = v.alt, repair_cost_low = v.lo, repair_cost_high = v.hi,
    needs_diagnosis = v.diag, repair_note = v.note
from (values
  ('check-engine', 'Engine', array['Electrical']::text[], 100, 1000, true,
   'Often a loose gas cap (free), an oxygen sensor ($200–$500) or ignition coils and spark plugs ($150–$400). A catalytic converter can cost $1,000 or more. If the light is flashing, stop driving.'),
  ('oil-pressure', 'Engine', array['Oil change']::text[], 80, 800, true,
   'Often the oil is just very low: a top-off or oil change ($50–$120). A bad pressure sensor runs $100–$300; an oil pump repair can be $800 or more. Don''t drive with this light on.'),
  ('oil-level-low', 'Oil change', array['Engine']::text[], 40, 120, false,
   'Usually a top-off or an oil change. If it keeps coming back, ask the shop to check for a leak or oil burning.'),
  ('coolant-temp', 'Engine', array[]::text[], 150, 1000, true,
   'Common causes: low coolant or a leak ($100–$400), a thermostat ($200–$450) or a water pump ($400–$900). Driving while overheating can ruin the engine.'),
  ('battery-charging', 'Electrical', array['Engine']::text[], 120, 900, true,
   'Usually the battery ($150–$300) or the alternator ($400–$900). Many shops test the charging system for free.'),
  ('brake-system', 'Brakes', array[]::text[], 100, 600, false,
   'First make sure the parking brake is fully off. Otherwise it''s often low brake fluid from worn pads ($150–$350 per axle); a leak or master cylinder runs $300–$600.'),
  ('abs', 'Brakes', array['Electrical']::text[], 150, 1200, true,
   'Usually a wheel-speed sensor ($150–$400). A failed ABS module can cost $800–$1,500. Normal braking still works, but without anti-lock.'),
  ('brake-pad-wear', 'Brakes', array[]::text[], 150, 500, false,
   'New pads run about $150–$300 per axle, or $300–$500 with rotors.'),
  ('tpms', 'Tires', array[]::text[], 20, 200, false,
   'Often just low air (free to $20 at a shop). A failed pressure sensor is about $50–$200 per wheel.'),
  ('airbag', 'Electrical', array[]::text[], 100, 1000, true,
   'Often a seat or seatbelt connector or the clock spring in the steering wheel ($150–$600). The airbags may not deploy until it''s fixed.'),
  ('power-steering', 'Engine', array['Alignment','Electrical']::text[], 150, 1200, true,
   'Hydraulic systems: often low fluid or a leak ($100–$500). Electric power steering faults may need a motor or rack ($800–$1,500).'),
  ('transmission-temp', 'Transmission', array[]::text[], 150, 1500, true,
   'Pull over and let it cool. A fluid service is $150–$300; a cooler, line or solenoid repair costs more.'),
  ('master-warning', 'Inspection', array['Engine','Electrical']::text[], 80, 200, true,
   'This light points to a message on your dashboard display, so read that first. A shop can scan the car to find the cause.'),
  ('service-wrench', 'Inspection', array['Oil change','Engine','Transmission']::text[], 80, 400, true,
   'On most cars it means scheduled maintenance is due (an oil change and inspection, about $80–$200). On Fords and Lincolns it means a powertrain fault that needs a scan.'),
  ('dpf', 'Engine', array[]::text[], 150, 3000, true,
   'Often cleared by a long highway drive or a forced regeneration at a shop ($150–$400). Cleaning or replacing the filter costs $1,000–$3,000 or more.'),
  ('def-low', 'Engine', array[]::text[], 30, 800, false,
   'Usually just a refill of diesel exhaust fluid (about $50 at a shop). A failed DEF heater or pump runs $500–$1,500.'),
  ('epc', 'Electrical', array['Engine']::text[], 150, 1000, true,
   'Common causes: the throttle body ($300–$700), a brake light switch ($100–$200) or a sensor.'),
  ('hybrid-system', 'Electrical', array['Engine']::text[], 200, 3000, true,
   'Often the 12-volt battery, a cooling fan or the inverter coolant ($150–$800). A hybrid battery replacement can run $2,000–$4,000 or more, so ask a hybrid specialist or dealer to quote it.'),
  ('coolant-level-low', 'Engine', array[]::text[], 50, 600, false,
   'A top-off with the right coolant may be all it needs. If it drops again, fixing the leak (hose, radiator or water pump) costs $150–$900.'),
  ('transmission-fault', 'Transmission', array[]::text[], 200, 2500, true,
   'Often a sensor, solenoid or fluid problem ($200–$800). A rebuild or replacement can cost $2,500–$5,000 or more.'),
  ('reduced-engine-power', 'Engine', array['Electrical']::text[], 150, 1200, true,
   'Usually the throttle body, the accelerator pedal sensor or wiring ($200–$800).'),
  ('electronic-throttle', 'Engine', array['Electrical']::text[], 100, 800, true,
   'Usually the throttle body: cleaning is about $100–$150, replacement $300–$700.'),
  ('diesel-water-filter', 'Engine', array[]::text[], 60, 300, false,
   'Drain the water separator or replace the fuel filter ($80–$300).'),
  ('blind-spot-warning', 'Electrical', array[]::text[], 100, 900, true,
   'Often just a dirty or iced-over bumper sensor (free to clean). A failed radar sensor or recalibration runs $300–$1,000.'),
  ('awd-4wd-fault', 'Transmission', array['Electrical']::text[], 150, 1500, true,
   'Often a sensor or actuator ($200–$700). Transfer case or coupling repairs cost more.'),
  ('ev-battery-temperature', 'Electrical', array[]::text[], 200, 2000, true,
   'Stop and let the battery cool. Battery cooling repairs usually need a dealer or an EV-certified shop ($200–$2,000 or more).')
) as v(slug, service, alt, lo, hi, diag, note)
where w.slug = v.slug;

commit;

-- ============ Check (expect every value true) ============
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name') as display_name_added,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'maintenance_tasks' and column_name = 'remind_days_before') as remind_days_added,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'warning_lights'
     and column_name in ('repair_service','repair_alt_services','repair_cost_low','repair_cost_high','needs_diagnosis','repair_note')) = 6 as repair_columns_added,
  (select count(*) from public.warning_lights where repair_service is not null) = 26 as repair_data_filled,
  pg_get_functiondef('public.schedule_next_task()'::regprocedure) like '%remind_days_before%' as repeat_tasks_keep_timing;
