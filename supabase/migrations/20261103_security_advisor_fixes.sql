-- Security advisor fix: handle_new_user() is a trigger function (it creates the
-- profile and notification settings rows when someone signs up). It was also
-- callable through the API, which the advisor flags. Revoking API access clears
-- the warning; the sign-up trigger keeps working because triggers don't need
-- EXECUTE permission to fire.
--
-- is_username_available() stays callable on purpose: the sign-up form uses it
-- before the person has an account.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
