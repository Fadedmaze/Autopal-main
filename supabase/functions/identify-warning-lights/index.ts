// Discover scanner: identify cropped dashboard warning-light symbols with Claude.
// The browser finds the glowing symbols and sends small JPEG crops; this function
// names each one against the warning_lights catalog, tailored to the user's car.
// verify_jwt: true (signed-in users only). Needs the ANTHROPIC_API_KEY secret.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_CROPS = 8;
const MAX_CROP_BYTES = 400_000; // base64 length; crops are ~224px JPEGs, far below this
const DAILY_SCAN_LIMIT = 40; // per user, rolling 24h: keeps API spend predictable
const COLORS = ["red", "amber", "green", "blue", "white", "unknown"] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

type CatalogRow = { slug: string; name: string; colors: string[]; symbol_hint: string; brand_notes: Record<string, string> };

// Stable across requests (only changes when the catalog does), so it is cached.
function systemPrompt(catalog: CatalogRow[]) {
  const lines = catalog.map((c) => {
    const brands = Object.keys(c.brand_notes ?? {});
    return `- ${c.slug} | ${c.name} | colors: ${c.colors.join("/")} | symbol: ${c.symbol_hint}` +
      (brands.length ? ` | has brand-specific meaning for: ${brands.join(", ")}` : "");
  }).join("\n");
  return `You identify car dashboard warning and indicator lights from small cropped photos taken with a phone camera.

Each crop is centered on one glowing symbol found automatically, so some crops will not be a dashboard symbol at all (glare, a reflection, a gauge needle, text on a screen, a button backlight). Mark those as not a warning light with slug "unknown".

Match each real symbol to exactly one slug from this catalog. Use the symbol's shape first and its color second; the same shape can appear in different colors. If a real symbol is not in the catalog, use "unknown" and describe it briefly in vehicle_note.

Catalog (slug | name | colors | symbol):
${lines}

The user's vehicle is given in the request. Some symbols mean different things on different makes (for example an amber wrench is routine maintenance on a Honda but a powertrain fault on a Ford). When the vehicle's make changes the meaning, or the make has a well-known name for the system, put one or two plain-language sentences about that in vehicle_note; otherwise leave vehicle_note empty.

Confidence: "high" when the shape is clearly visible, "medium" when it is blurry or partly visible but you are fairly sure, "low" when you are guessing. Return one result per crop, using the crop numbers given.`;
}

function outputSchema(slugs: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "is_warning_light", "slug", "confidence", "observed_color", "vehicle_note"],
          properties: {
            index: { type: "integer" },
            is_warning_light: { type: "boolean" },
            slug: { type: "string", enum: [...slugs, "unknown"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            observed_color: { type: "string", enum: [...COLORS] },
            vehicle_note: { type: "string" },
          },
        },
      },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    // Acts as the caller, so RLS only lets them read their own vehicle.
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Please sign in again." }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const crops: unknown = body.crops;
    if (!Array.isArray(crops) || crops.length === 0) return json({ error: "No symbols to identify." }, 400);
    if (crops.length > MAX_CROPS) return json({ error: `Identify at most ${MAX_CROPS} symbols at a time.` }, 400);
    if (!crops.every((c) => typeof c === "string" && c.length > 100 && c.length <= MAX_CROP_BYTES && /^[A-Za-z0-9+/=]+$/.test(c))) {
      return json({ error: "One of the images couldn't be read. Please try again." }, 400);
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error: countErr } = await admin
      .from("light_scans").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", since);
    if (countErr) throw countErr;
    if ((count ?? 0) >= DAILY_SCAN_LIMIT) {
      return json({ error: "You've reached today's scan limit. Try again tomorrow, or browse the light list below.", code: "limit" }, 429);
    }

    let vehicleLine = "Vehicle: unknown make and model.";
    let vehicleId: number | null = null;
    if (Number.isInteger(body.vehicle_id)) {
      const { data: v } = await asUser.from("vehicles")
        .select("id, brand, make, model, model_year").eq("id", body.vehicle_id).maybeSingle();
      if (v) {
        vehicleId = v.id;
        vehicleLine = `Vehicle: ${[v.model_year, v.brand, v.make, v.model].filter(Boolean).join(" ")} (make: ${v.brand}).`;
      }
    }

    const { data: catalog, error: catErr } = await admin.from("warning_lights")
      .select("slug, name, colors, symbol_hint, brand_notes").order("sort_order");
    if (catErr) throw catErr;
    const slugs = (catalog as CatalogRow[]).map((c) => c.slug);

    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      { type: "text", text: `${vehicleLine}\nIdentify each of the ${crops.length} crops below.` },
    ];
    (crops as string[]).forEach((data, i) => {
      content.push({ type: "text", text: `Crop ${i + 1}:` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    });

    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: outputSchema(slugs) } },
      system: [{ type: "text", text: systemPrompt(catalog as CatalogRow[]), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "Those images couldn't be identified. Try again with the camera closer to the lights." }, 422);
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error(`No text in response (stop_reason ${response.stop_reason})`);
    const parsed = JSON.parse(text.text) as { results: Array<Record<string, unknown>> };

    // One result per crop, in order; anything missing or malformed becomes "unknown".
    const results = (crops as string[]).map((_, i) => {
      const r = parsed.results.find((x) => x.index === i + 1) ?? {};
      const slug = typeof r.slug === "string" && slugs.includes(r.slug) ? r.slug : "unknown";
      return {
        index: i + 1,
        is_warning_light: r.is_warning_light === true && slug !== "unknown",
        slug,
        confidence: ["high", "medium", "low"].includes(r.confidence as string) ? r.confidence : "low",
        observed_color: COLORS.includes(r.observed_color as typeof COLORS[number]) ? r.observed_color : "unknown",
        vehicle_note: typeof r.vehicle_note === "string" ? r.vehicle_note.slice(0, 400) : "",
      };
    });

    await admin.from("light_scans").insert({
      user_id: userId,
      vehicle_id: vehicleId,
      crop_count: crops.length,
      results,
      input_tokens: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0),
      output_tokens: response.usage.output_tokens,
    });

    return json({ results });
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "The scanner is busy. Please try again in a moment." }, 503);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The scanner isn't set up yet (missing API key)." }, 503);
    if (err instanceof Anthropic.APIError) return json({ error: "The scanner is unavailable right now. Please try again." }, 502);
    return json({ error: "The scanner is unavailable right now. Please try again." }, 500);
  }
});
