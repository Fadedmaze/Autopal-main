-- Catalog maintenance is offered as an opt-in suggestion from the Tasks page.
-- Existing completed history and recurring follow-ups remain intact. Remove only
-- uncompleted first-occurrence rows that were automatically seeded for each car.
drop trigger if exists on_vehicle_created on public.vehicles;

delete from public.maintenance_tasks
where catalog_id is not null
  and generated_from_task_id is null
  and not is_completed;

drop function if exists public.seed_vehicle_tasks();
