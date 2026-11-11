-- Apply to Supabase before testing the recurring custom-task form.
-- Does not modify existing task records or catalog recurrence intervals.
ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS repeat_interval_days integer
  CHECK (repeat_interval_days BETWEEN 1 AND 3650);

CREATE OR REPLACE FUNCTION public.schedule_next_task()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  interval_to_use integer;
BEGIN
  IF new.is_completed AND NOT old.is_completed THEN
    IF new.catalog_id IS NOT NULL THEN
      SELECT c.interval_days INTO interval_to_use
      FROM public.maintenance_catalog c WHERE c.id = new.catalog_id;
    ELSE
      interval_to_use := new.repeat_interval_days;
    END IF;

    IF interval_to_use IS NOT NULL AND interval_to_use > 0 AND NOT EXISTS (
      SELECT 1 FROM public.maintenance_tasks WHERE generated_from_task_id = new.id
    ) THEN
      INSERT INTO public.maintenance_tasks
        (vehicle_id, shop_id, catalog_id, task_name, due_date, estimated_cost,
         generated_from_task_id, remind_days_before, repeat_interval_days, notes)
      VALUES
        (new.vehicle_id, new.shop_id, new.catalog_id, new.task_name,
         COALESCE(new.completed_date, current_date) + interval_to_use,
         new.estimated_cost, new.id, new.remind_days_before,
         new.repeat_interval_days, new.notes);
    END IF;
  ELSIF old.is_completed AND NOT new.is_completed THEN
    DELETE FROM public.maintenance_tasks
    WHERE generated_from_task_id = new.id AND NOT is_completed;
  END IF;
  RETURN new;
END;
$function$;
