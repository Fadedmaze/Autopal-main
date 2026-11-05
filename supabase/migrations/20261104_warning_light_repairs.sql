-- Typical repair for each dashboard light: which shop service fixes it and a US cost range.
-- Additive columns (nullable), then backfill. Informational lights stay NULL.
alter table public.warning_lights add column if not exists repair_service text;
alter table public.warning_lights add column if not exists repair_cost_low numeric;
alter table public.warning_lights add column if not exists repair_cost_high numeric;

alter table public.warning_lights
  add constraint warning_lights_repair_service_check
  check (repair_service is null or repair_service in ('Oil change','Brakes','Tires','Engine','Transmission','Electrical','Alignment','Inspection'));

update public.warning_lights as w
set repair_service = v.service, repair_cost_low = v.lo, repair_cost_high = v.hi
from (values
  ('check-engine', 'Engine', 100, 1000),
  ('oil-pressure', 'Engine', 100, 800),
  ('oil-level-low', 'Oil change', 40, 110),
  ('coolant-temp', 'Engine', 150, 900),
  ('battery-charging', 'Electrical', 150, 700),
  ('brake-system', 'Brakes', 150, 450),
  ('brake-pad-wear', 'Brakes', 150, 450),
  ('abs', 'Brakes', 250, 1200),
  ('tpms', 'Tires', 25, 150),
  ('airbag', 'Electrical', 150, 1000),
  ('power-steering', 'Engine', 150, 900),
  ('transmission-temp', 'Transmission', 150, 1500),
  ('dpf', 'Engine', 300, 2500),
  ('def-low', 'Engine', 50, 400),
  ('epc', 'Electrical', 150, 1000),
  ('hybrid-system', 'Electrical', 200, 2000),
  ('coolant-level-low', 'Engine', 80, 400),
  ('transmission-fault', 'Transmission', 200, 2000),
  ('reduced-engine-power', 'Engine', 150, 1200),
  ('electronic-throttle', 'Engine', 150, 800),
  ('diesel-water-filter', 'Engine', 80, 300),
  ('blind-spot-warning', 'Electrical', 150, 700),
  ('awd-4wd-fault', 'Transmission', 200, 1500),
  ('ev-battery-temperature', 'Electrical', 200, 2000)
) as v(slug, service, lo, hi)
where w.slug = v.slug;
