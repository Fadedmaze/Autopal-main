# AutoPal: apply the 2026-11-04 database migrations (handoff)

**For:** the AI assistant (or a human) with access to the AutoPal Supabase project.
**Supabase project:** `hrcthuqltodogsglfatt` ("AutoPal", org `is401`) · **Live app:** https://autopalv01.vercel.app · **Repo:** https://github.com/Fadedmaze/Autopal-main

## TL;DR

The code is **already pushed and live** (service worker `autopal-shell-v7`). **Do not push or redeploy anything.**
The only job is to run three SQL migration files against the live database, in order, and verify them.
Until they run, the app still works, but these features show "needs a database update":
display names, per-task reminder timing, and shop matching with price estimates on the map.

## Before you start

1. Confirm you're connected to project **`hrcthuqltodogsglfatt`**. (`netlkrgpzgalzntsqdbd` is an older, unrelated AutoPal project. Don't touch it.)
2. Check that the live repeat-task trigger function matches the repo. Migration 2 replaces it.

   ```sql
   select pg_get_functiondef('public.schedule_next_task()'::regprocedure);
   ```

   It should match `public.schedule_next_task()` in `supabase/schema.sql`. If it has extra logic that isn't in the repo, **stop**. Merge that logic into `supabase/migrations/20261104_task_remind_days.sql`, keeping the new `remind_days_before` column in the insert, and tell the user.

## Apply, in this order

Use the files from the repo's `main` branch, unchanged. Each one is additive and safe to re-run (`if not exists` and `drop constraint if exists`).

| # | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/20261104_profile_display_name.sql` | Adds `profiles.display_name` (1–40 chars), and lets users update it |
| 2 | `supabase/migrations/20261104_task_remind_days.sql` | Adds `maintenance_tasks.remind_days_before` (0–60, null = user default), and updates `schedule_next_task()` so repeat tasks keep the timing |
| 3 | `supabase/migrations/20261104_warning_light_repairs.sql` | Adds repair columns to `warning_lights` and fills 26 lights with service, cost range, diagnosis flag and a cost note |

With the Supabase MCP, use `apply_migration` with names `profile_display_name`, `task_remind_days` and `warning_light_repairs`. Without it, paste each file into Dashboard → SQL Editor → Run.

**Migration 1 caveat:** it runs `grant update (display_name) on public.profiles to authenticated`. If `authenticated` already has table-wide `update` on `profiles` (the base schema grants it), this is harmless. Don't revoke anything.

## Verify

```sql
-- 1. New columns exist
select table_name, column_name from information_schema.columns
where table_schema = 'public' and (
  (table_name = 'profiles' and column_name = 'display_name') or
  (table_name = 'maintenance_tasks' and column_name = 'remind_days_before') or
  (table_name = 'warning_lights' and column_name in
     ('repair_service','repair_alt_services','repair_cost_low','repair_cost_high','needs_diagnosis','repair_note')))
order by 1, 2;                       -- expect 8 rows

-- 2. Repair data filled in
select count(*) filter (where repair_service is not null) as with_repair, count(*) as total
from public.warning_lights;         -- expect with_repair = 26, total = 47 (or more if the team added lights)

-- 3. Trigger carries the reminder timing
select pg_get_functiondef('public.schedule_next_task()'::regprocedure) like '%remind_days_before%' as ok;  -- expect true
```

Then run the security advisor (`get_advisors` type `security`) and report anything **new**. Two items were already known: `handle_new_user` callable via the API, and leaked-password protection being off.

**In the app** (logged in, any car):
- Profile → Edit name → save works.
- Edit a task → "Remind me" → pick "3 days before" → Save works, and the row shows a bell with "3d".
- Find Mechanic → Filter → "Fix a warning light" → *Brake system warning*. You should see a banner and a "N shops can fix this" panel with price ranges, not the "database needs an update" note.

## Notes

- Hard-refresh the app once after migrating. It remembers "not migrated" until the page reloads.
- Repair cost ranges are typical US estimates written for this demo, not quotes. The shops are sample data.
