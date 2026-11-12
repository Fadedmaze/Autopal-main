-- How each car looks in 3D (paint color and finish, wheels, roof, window tint, roof
-- rails, spoiler), set in the vehicle page's customizer. Safe to re-run.
-- Example: {"paint":"#244a35","finish":"metallic","wheels":"black","roof":"black","tint":"medium","rails":false,"spoiler":false}
begin;
alter table public.vehicles add column if not exists appearance jsonb;
alter table public.vehicles drop constraint if exists vehicles_appearance_check;
alter table public.vehicles add constraint vehicles_appearance_check
  check (appearance is null or (jsonb_typeof(appearance) = 'object' and pg_column_size(appearance) < 2048));
commit;
