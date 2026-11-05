-- Display name for the profile (shown on Home instead of the username; falls back to username).
-- Additive only: nullable column, length check, and update permission for the signed-in user.
alter table public.profiles add column if not exists display_name text;

alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) between 1 and 40);

grant update (display_name) on public.profiles to authenticated;
