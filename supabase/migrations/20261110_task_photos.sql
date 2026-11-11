-- Task photos: pictures attached to a maintenance task (before/after, the part,
-- the odometer...). One row per photo; the image file lives in the existing
-- private vehicle-photos bucket under "<user id>/<vehicle id>/tasks/<task id>/",
-- so the bucket's per-user folder rules already protect it.
-- Up to 10 photos per task. Safe to re-run.

create table if not exists public.task_photos (
  id           bigint generated always as identity primary key,
  task_id      bigint not null references public.maintenance_tasks (id) on delete cascade,
  storage_path text not null,
  uploaded_at  timestamptz not null default now()
);
create index if not exists task_photos_task_id_idx on public.task_photos (task_id, uploaded_at);

alter table public.task_photos enable row level security;

-- Allowed when the task's car is yours (same rule as tasks and vehicle photos).
drop policy if exists "task photos: via own vehicle" on public.task_photos;
create policy "task photos: via own vehicle" on public.task_photos for all to authenticated
  using (exists (
    select 1 from public.maintenance_tasks t join public.vehicles v on v.id = t.vehicle_id
    where t.id = task_id and v.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.maintenance_tasks t join public.vehicles v on v.id = t.vehicle_id
    where t.id = task_id and v.user_id = (select auth.uid())));

grant select, insert, delete on public.task_photos to authenticated;

-- At most 10 photos per task.
create or replace function public.limit_task_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.task_photos where task_id = new.task_id) >= 10 then
    raise exception 'A task can have up to 10 photos.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists task_photos_limit on public.task_photos;
create trigger task_photos_limit
  before insert on public.task_photos
  for each row execute function public.limit_task_photos();
