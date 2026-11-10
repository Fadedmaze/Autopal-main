-- 2026 refresh of the standard maintenance schedule every new car gets.
-- Safe to re-run. Only affects cars added after it runs (and the next repeat of a
-- completed task); tasks already on someone's list keep their dates and costs.
--
-- What changed and why (reviewed November 2026):
--   Oil change        $75 / 4 months  -> $95 / 6 months. Most cars now use synthetic oil,
--                     rated 5,000-10,000 miles or 6 months; a full-synthetic change runs
--                     about $70-$125 at quick-lube shops in 2026.
--   Tire rotation     every 180 -> 182 days (5,000-7,500 miles, about every 6 months).
--   Wiper blades      $30 -> $45 for a pair, installed.
--   Engine air filter $35 -> $45 installed; still yearly (12,000-15,000 miles).
--   Cabin air filter  NEW: $55, yearly (12,000-15,000 miles). It was missing.
--   Battery check     $25 -> $0. Most auto parts stores test batteries for free.
--   Tire pressure check, brake inspection and emissions test are unchanged.
begin;

update public.maintenance_catalog set typical_cost = 95, interval_days = 182 where task_name = 'Oil change';
update public.maintenance_catalog set interval_days = 182 where task_name = 'Tire rotation';
update public.maintenance_catalog set typical_cost = 45 where task_name = 'Wiper blades';
update public.maintenance_catalog set typical_cost = 45 where task_name = 'Engine air filter';
update public.maintenance_catalog set typical_cost = 0 where task_name = 'Battery check';

insert into public.maintenance_catalog (task_name, typical_cost, interval_days, first_due_days, sort_order)
select 'Cabin air filter', 55, 365, 135, 6
where not exists (select 1 from public.maintenance_catalog where task_name = 'Cabin air filter');

update public.maintenance_catalog set sort_order = 7 where task_name = 'Brake inspection';
update public.maintenance_catalog set sort_order = 8 where task_name = 'Emissions test';
update public.maintenance_catalog set sort_order = 9 where task_name = 'Battery check';

commit;

-- Check: 9 rows, oil change $95 every 182 days, cabin air filter present.
select task_name, typical_cost, interval_days, first_due_days, sort_order
from public.maintenance_catalog order by sort_order;
