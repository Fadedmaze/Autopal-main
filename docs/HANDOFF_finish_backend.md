# AutoPal: what's left to make the Discover scanner work (handoff)

**For:** the AI assistant (and humans) maintaining AutoPal.
**Supabase project:** `hrcthuqltodogsglfatt` ("AutoPal", org `is401`) · **Live app:** https://autopalv01.vercel.app · **Repo:** https://github.com/Fadedmaze/Autopal-main
**State checked:** 2026-11-03, against the live database (real `count(*)` queries, not the table-list estimates, which showed 0 rows and were wrong).

---

## TL;DR

The backend is built. **The only thing blocking the scanner is the `ANTHROPIC_API_KEY` secret**, which a human has to add. Everything else here is cleanup or verification.

| # | Task | Who | Required? |
|---|---|---|---|
| 1 | Add the `ANTHROPIC_API_KEY` Edge Function secret | **Human** | **Yes**: scanner can't name lights without it |
| 2 | Rotate the Supabase secret key that was shared in a chat | **Human** | **Yes**: security |
| 3 | Verify a real scan end to end | Human with a phone + car (AI can check the logs) | Yes |
| 4 | Regenerate `supabase/seed/warning_lights.sql` from the JSON (37 → 47 lights) | AI | Recommended |
| 5 | Two small security-advisor fixes | AI + human | Optional |

---

## Already done (don't redo)

| Piece | Live state |
|---|---|
| `public.warning_lights` | **47 rows** (37 original + 10 added by the team on 2026-11-03) |
| `public.light_scans` | Table exists; **0 rows**, so no scan has succeeded yet |
| Edge Function `identify-warning-lights` | Deployed, `verify_jwt: true`. Returns 503 `not_configured` while the key is missing |
| Edge Function `username-sign-in` | Deployed (unchanged) |
| `maintenance_catalog` / `mechanic_shops` / `guides` | 8 / 6 / 17 rows: populated, nothing to load |
| Discover screen code | Live on Vercel |

Access rules were verified as a signed-in user: everyone can read `warning_lights` but nobody can write it, users only see their own `light_scans`, and only the Edge Function (service role) inserts scans.

---

## 1. Add the Anthropic API key (human only)

An AI assistant should not create, view or paste this key. Ask the human to do it.

1. Create a key at https://console.anthropic.com. Billing must be set up on that account.
2. Supabase dashboard → project **AutoPal** → **Edge Functions** → **Secrets** → **Add new secret**.
3. Name it exactly `ANTHROPIC_API_KEY` and paste the key as the value. Save.
4. No redeploy is needed. The function reads the secret on every request.

**Cost:** the function calls Claude Haiku 5.5 (`claude-haiku-5-5`, effort `low`), roughly a tenth of a cent per scan or less. Each user is capped at **40 scans per rolling 24 hours** (`DAILY_SCAN_LIMIT` in the function). It was switched from Opus 5.5 (`claude-opus-5-5`, about 1–3 cents per scan) to save money; if identification on blurry or dim crops isn't accurate enough, switch the model string back and also restore `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`, which only Opus supports.

## 2. Rotate the exposed secret key (human only)

A `sb_secret_...` key for this project was pasted into a chat, so treat it as compromised: it bypasses every access rule.

Supabase dashboard → **Project Settings** → **API Keys** → **Secret keys** → create a new secret key, then **delete the old one**.

- The app never uses the secret key, so nothing breaks.
- Edge Functions use the built-in `SUPABASE_SERVICE_ROLE_KEY` env var, which is separate and keeps working.
- The publishable key (`sb_publishable_...`) is public by design and doesn't need rotating.

## 3. Verify a real scan

1. On a phone, open https://autopalv01.vercel.app, log in, and make sure a car is in the Garage. The scan is tuned to the selected car's make.
2. Turn the car on so dashboard lights glow, and go to **Discover → Scan My Dashboard**. Allow camera access.
3. Yellow squares should appear around lit symbols. Tap one: after about 2 seconds the squares get labels, and the tapped one opens an info card.

What the messages mean:

| Message in app | Cause |
|---|---|
| "The scanner isn't set up yet. Ask the app owner to add the AI key." | Step 1 not done, or the secret is misnamed |
| "The scanner isn't set up yet (missing API key)." | The key is set but invalid or revoked (Anthropic returned 401) |
| "The scanner is busy…" | Anthropic rate limit; retry |
| "You've reached today's scan limit…" | That user hit 40 scans in 24h |
| No yellow squares at all | Lights too dim, or too bright a day. Tap directly on a light in the frozen frame to check that spot manually |

An AI with database access can confirm success afterwards:

```sql
select count(*) as scans, max(created_at) as last_scan,
       sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens
from public.light_scans;
```

`scans > 0` means the full pipeline works: camera → crops → Edge Function → Claude → catalog match → result.

## 4. Regenerate the warning-light seed SQL (AI)

`supabase/seed/warning_lights.json` has **47** lights, matching the database, but the generated `supabase/seed/warning_lights.sql` still has the original **37**. If anyone rebuilds the database from the repo, they'd lose the 10 new lights. Regenerate the SQL from the JSON:

```bash
python3 - <<'EOF'
import json
rows = json.load(open('supabase/seed/warning_lights.json'))
def q(s): return "'" + s.replace("'", "''") + "'"
def arr(a): return "array[" + ",".join(q(x) for x in a) + "]::text[]"
vals = []
for r in rows:
    vals.append("(" + ", ".join([q(r['slug']), q(r['name']), arr(r['colors']), q(r['severity']),
        q(r['symbol_hint']), q(r['meaning']), q(r['action']), q(r['drive_advice']),
        q(json.dumps(r.get('brand_notes', {}))) + "::jsonb",
        q(json.dumps(r.get('brand_severity', {}))) + "::jsonb", str(r['sort_order'])]) + ")")
sql = ("-- Generated from supabase/seed/warning_lights.json. Re-run to refresh the catalog.\n"
       "insert into public.warning_lights (slug, name, colors, severity, symbol_hint, meaning, action, drive_advice, brand_notes, brand_severity, sort_order) values\n"
       + ",\n".join(vals) +
       "\non conflict (slug) do update set name = excluded.name, colors = excluded.colors, severity = excluded.severity,\n"
       "  symbol_hint = excluded.symbol_hint, meaning = excluded.meaning, action = excluded.action,\n"
       "  drive_advice = excluded.drive_advice, brand_notes = excluded.brand_notes,\n"
       "  brand_severity = excluded.brand_severity, sort_order = excluded.sort_order;\n")
open('supabase/seed/warning_lights.sql', 'w').write(sql)
print(len(rows), "lights written")
EOF
```

Expected output: `47 lights written`. Commit the regenerated file. Running it against the database is safe (it upserts by `slug`) but unnecessary, since the database already has all 47.

**Catalog rules** (the Edge Function and app depend on these):
- `slug`: lowercase letters, digits and hyphens only (`^[a-z0-9-]+$`), unique. The AI is told to answer with one of these slugs.
- `severity`: `stop`, `soon` or `info`.
- `colors`: any of `red`, `amber`, `green`, `blue`, `white`.
- `brand_notes` / `brand_severity`: keys are the **lowercase brand** as typed in Add Vehicle (e.g. `"ford"`, `"mercedes-benz"`).
- `symbol_hint` is sent to the AI to help it recognize the shape, so describe the icon visually.

## 5. Optional security-advisor fixes

Supabase's security advisor flags two pre-existing items (nothing from Discover):

- **`public.handle_new_user()` is callable through the API.** It's a trigger function, so it can't actually do anything that way, but to clear the warning (the trigger keeps working):
  ```sql
  revoke execute on function public.handle_new_user() from public, anon, authenticated;
  ```
  The matching warning for `public.is_username_available` is **intentional**: the sign-up form calls it before the user has an account. Leave it.
- **Leaked password protection is off.** Human: Supabase → **Authentication** → sign-in / password settings → enable leaked password protection.

---

## How the scanner works (context for future changes)

1. **On the phone** (`js/lightDetector.js`): every ~120 ms the camera frame is shrunk to 320 px wide, and bright saturated red, amber, green and blue blobs (plus white ones in a dark cabin) are found and merged into symbols. `BoxTracker` keeps the yellow squares steady. This step is free and never leaves the device.
2. **On tap** (`js/views/discover.js`): the frame freezes, and up to 8 boxes are cropped to 224×224 JPEGs and sent to the `identify-warning-lights` Edge Function with the selected vehicle's id.
3. **Edge Function** (`supabase/functions/identify-warning-lights/index.ts`): checks the user, the 40/day cap and the vehicle (read as the user, so RLS applies) and loads the catalog. It then calls Claude with a cached system prompt listing every slug and symbol hint, plus structured JSON output restricted to those slugs, and logs the scan to `light_scans`.
4. **Info card:** looks up the slug in `warning_lights`, applies `brand_severity` / `brand_notes` for the car's make, and adds the AI's `vehicle_note` if it gave one.

Local testing without a phone, a car or the API: `python3 harness/serve.py 5181`, then open `http://localhost:5181/?scenario=full`. It uses a fake camera (a drawn dashboard) and fake identification results. Log in as `andrew` / `correct-horse`; these are fake test credentials that only work in the harness.
