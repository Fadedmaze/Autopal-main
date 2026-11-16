-- Maintenance timing that fits how much each car is driven.
-- Each car gets miles_per_year (set on Add/Edit Vehicle). Catalog tasks that wear with
-- miles (oil, tire rotation, filters, brakes) get interval_miles. A task is then due
-- after its miles OR its months, whichever comes first, like an owner's manual:
--   oil change, 7,500 mi or 6 months -> average driver (12,000/yr): 6 months;
--   heavy driver (20,000/yr): about every 4.5 months; very heavy (30,000/yr): 3 months.
-- Driving less never stretches past the months, since oil and rubber age anyway.
-- Changing a car's driving moves its open, auto-scheduled tasks right away. Due dates
-- someone set by hand, and tasks with their own repeat, are left alone.
-- Safe to re-run.

alter table public.vehicles add column if not exists miles_per_year integer;
alter table public.vehicles drop constraint if exists vehicles_miles_per_year_range;
alter table public.vehicles add constraint vehicles_miles_per_year_range
  check (miles_per_year is null or miles_per_year between 0 and 150000);

alter table public.maintenance_catalog add column if not exists interval_miles integer;
-- Custom repeat chosen on a task (already in the app; listed here so this file works on its own).
alter table public.maintenance_tasks add column if not exists repeat_interval_days integer;
update public.maintenance_catalog set interval_miles = 7500  where task_name = 'Oil change';
update public.maintenance_catalog set interval_miles = 6000  where task_name = 'Tire rotation';
update public.maintenance_catalog set interval_miles = 15000 where task_name = 'Engine air filter';
update public.maintenance_catalog set interval_miles = 15000 where task_name = 'Cabin air filter';
update public.maintenance_catalog set interval_miles = 12000 where task_name = 'Brake inspection';
-- Tire pressure, wipers, emissions test and battery stay time-based (interval_miles null).

-- Days between repeats for one task on one car: the miles converted to days at this
-- car's pace, but never longer than the catalog's months and never under 2 weeks.
create or replace function public.task_interval_days(p_interval_days integer, p_interval_miles integer, p_miles_per_year integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_interval_miles is null or coalesce(p_miles_per_year, 0) <= 0 then p_interval_days
    else least(p_interval_days, greatest(14, round(p_interval_miles * 365.0 / p_miles_per_year)::integer))
  end;
$$;

-- First due date for a new car's task: the catalog's "days after the car is added",
-- shortened in the same proportion for cars that are driven a lot.
create or replace function public.task_first_due_days(p_first_due_days integer, p_interval_days integer, p_interval_miles integer, p_miles_per_year integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(7, round(p_first_due_days::numeric
    * public.task_interval_days(p_interval_days, p_interval_miles, p_miles_per_year) / p_interval_days)::integer);
$$;

-- New catalog task (a new car's schedule, or the next repeat after one is completed):
-- if the due date is the standard one, fit it to the car's driving. A different due
-- date means something else chose it (for example a custom repeat), so it stays.
create or replace function public.fit_task_to_driving()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c public.maintenance_catalog;
  miles integer;
  base date;
begin
  if new.catalog_id is null or new.is_completed or new.due_date is null or new.repeat_interval_days is not null then return new; end if;
  select * into c from public.maintenance_catalog where id = new.catalog_id;
  select miles_per_year into miles from public.vehicles where id = new.vehicle_id;
  if c.id is null or c.interval_miles is null or miles is null then return new; end if;

  if new.generated_from_task_id is null then
    if new.due_date = current_date + c.first_due_days then
      new.due_date := current_date + public.task_first_due_days(c.first_due_days, c.interval_days, c.interval_miles, miles);
    end if;
  else
    select coalesce(completed_date, current_date) into base
    from public.maintenance_tasks where id = new.generated_from_task_id;
    if base is not null and new.due_date = base + c.interval_days then
      new.due_date := base + public.task_interval_days(c.interval_days, c.interval_miles, miles);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists fit_task_to_driving on public.maintenance_tasks;
create trigger fit_task_to_driving
  before insert on public.maintenance_tasks
  for each row execute function public.fit_task_to_driving();

-- A car's driving changed: move its open catalog tasks whose due date is still the
-- automatic one for the old pace. Never earlier than today.
create or replace function public.refit_vehicle_tasks()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t record;
  old_due date;
  new_due date;
begin
  if new.miles_per_year is not distinct from old.miles_per_year then return new; end if;

  for t in
    select mt.id, mt.due_date, mt.generated_from_task_id,
           c.interval_days, c.interval_miles, c.first_due_days,
           src.completed_date as src_completed
    from public.maintenance_tasks mt
    join public.maintenance_catalog c on c.id = mt.catalog_id
    left join public.maintenance_tasks src on src.id = mt.generated_from_task_id
    where mt.vehicle_id = new.id and not mt.is_completed and c.interval_miles is not null
      and mt.repeat_interval_days is null
  loop
    if t.generated_from_task_id is null then
      old_due := (new.created_at)::date + public.task_first_due_days(t.first_due_days, t.interval_days, t.interval_miles, old.miles_per_year);
      new_due := (new.created_at)::date + public.task_first_due_days(t.first_due_days, t.interval_days, t.interval_miles, new.miles_per_year);
    elsif t.src_completed is not null then
      old_due := t.src_completed + public.task_interval_days(t.interval_days, t.interval_miles, old.miles_per_year);
      new_due := t.src_completed + public.task_interval_days(t.interval_days, t.interval_miles, new.miles_per_year);
    else
      continue;
    end if;
    -- Tasks the auto-schedule set (already overdue ones were pulled up to "today" before).
    if t.due_date = old_due or (t.due_date = current_date and old_due < current_date) then
      update public.maintenance_tasks set due_date = greatest(new_due, current_date)
      where id = t.id and due_date is distinct from greatest(new_due, current_date);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists refit_vehicle_tasks on public.vehicles;
create trigger refit_vehicle_tasks
  after update of miles_per_year on public.vehicles
  for each row execute function public.refit_vehicle_tasks();

-- Triggers only; the API can't call these directly. (The two helpers stay callable:
-- they only do arithmetic, and the triggers call them as the signed-in user.)
revoke execute on function public.fit_task_to_driving() from public, anon, authenticated;
revoke execute on function public.refit_vehicle_tasks() from public, anon, authenticated;
