-- One-paste script for the 2026-11-09 updates: paste all of it into Supabase → SQL Editor → Run.
-- Safe to re-run. Contains, in order:
--   1. migrations/20261109_maintenance_schedule_2026.sql
--   2. migrations/20261109_warning_light_brand_notes.sql

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


-- More brand-specific notes for common warning lights (November 2026).
-- Adds each brand's own name for the system (VSC, VSA, StabiliTrak, ESP...) and how its
-- service reminder works. Existing notes are kept; safe to re-run.
begin;
update public.warning_lights set brand_notes = '{"toyota": "Many Toyotas show MAINT REQD or a wrench about every 5,000 miles as an oil-change reminder. Reset it after the service.", "lexus": "Lexus shows a maintenance reminder on the display when scheduled service is due.", "mercedes-benz": "Mercedes-Benz shows Service A or Service B on the cluster. A is mainly an oil change and checks; B adds more inspections and the cabin filter.", "bmw": "BMW uses Condition Based Service. See which items are due in iDrive under Vehicle Status.", "chevrolet": "GM''s Oil Life Monitor shows Change Engine Oil Soon when oil life gets low. Reset it after the oil change.", "gmc": "GM''s Oil Life Monitor shows Change Engine Oil Soon when oil life gets low. Reset it after the oil change.", "volkswagen": "Volkswagen shows a wrench with an oil change or inspection message and a countdown in days or miles.", "subaru": "Subaru shows a maintenance reminder on the multi-function display when the set interval is reached."}'::jsonb || coalesce(brand_notes, '{}'::jsonb) where slug = 'service-wrench';
update public.warning_lights set brand_notes = '{"toyota": "Toyota calls this VSC (Vehicle Stability Control). TRAC OFF means traction control was switched off.", "lexus": "Lexus calls this VSC (Vehicle Stability Control).", "honda": "Honda calls this VSA (Vehicle Stability Assist).", "acura": "Acura calls this VSA (Vehicle Stability Assist).", "subaru": "Subaru calls this VDC (Vehicle Dynamics Control).", "ford": "Ford calls this AdvanceTrac.", "mazda": "Mazda calls this DSC (Dynamic Stability Control).", "bmw": "BMW calls this DSC (Dynamic Stability Control).", "mercedes-benz": "Mercedes-Benz calls this ESP (Electronic Stability Program).", "hyundai": "Hyundai calls this ESC (Electronic Stability Control).", "kia": "Kia calls this ESC (Electronic Stability Control)."}'::jsonb || coalesce(brand_notes, '{}'::jsonb) where slug = 'traction-control';
update public.warning_lights set brand_notes = '{"mazda": "Mazda groups these features under i-Activsense; Smart Brake Support is the automatic braking.", "nissan": "Nissan calls this Intelligent Emergency Braking.", "hyundai": "Hyundai calls this Forward Collision-Avoidance Assist (FCA).", "kia": "Kia calls this Forward Collision-Avoidance Assist (FCA).", "ford": "Ford calls this Pre-Collision Assist, part of Ford Co-Pilot360."}'::jsonb || coalesce(brand_notes, '{}'::jsonb) where slug = 'collision-system';
update public.warning_lights set brand_notes = '{"subaru": "On Subarus a check engine light often turns off EyeSight and cruise control until the problem is fixed."}'::jsonb || coalesce(brand_notes, '{}'::jsonb) where slug = 'check-engine';
commit;


-- Check (every column should be true):
select
  (select typical_cost = 95 and interval_days = 182 from public.maintenance_catalog where task_name = 'Oil change') as oil_change_updated,
  exists (select 1 from public.maintenance_catalog where task_name = 'Cabin air filter') as cabin_filter_added,
  (select brand_notes ? 'toyota' from public.warning_lights where slug = 'traction-control') as brand_notes_added;
