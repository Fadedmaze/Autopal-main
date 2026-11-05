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
