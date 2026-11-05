-- Per-task reminder window. NULL means "use my default" (notification_settings.reminder_days_before).
-- Additive only: nullable column with a range check.
alter table public.maintenance_tasks add column if not exists remind_days_before integer;

alter table public.maintenance_tasks
  add constraint maintenance_tasks_remind_days_before_range
  check (remind_days_before is null or remind_days_before between 0 and 60);
