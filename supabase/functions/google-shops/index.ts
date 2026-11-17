// google-shops: real repair shops from Google Places (API "New") for Find a Mechanic.
// The Google key stays here on the server (secret GOOGLE_PLACES_KEY); the app calls this
// function with the signed-in user's token (Verify JWT ON).
//
//   { action: "search", lat, lng, pageToken? }
//       Repair shops near a point, nearest first, 20 per page (up to 3 pages).
//       -> { shops: [...], nextPageToken }
//   { action: "details", id }
//       One shop's full page: hours, phone, website, summary, reviews, a photo.
//       -> { shop: {...} }
//
// Daily allowances, per person and for the whole app (migrations/20261117_google_shops.sql),
// keep usage inside Google's free monthly amount. Google Cloud quotas are a second guard.
// Google's terms: results may only be shown on a Google map, with Google attribution,
// and not stored (except the place id). The app follows that.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (name: string) => (typeof Deno !== "undefined" ? Deno.env.get(name) ?? "" : "");

const PLACES = "https://places.googleapis.com/v1";
const SEARCH_RADIUS_M = 25000; // bias toward ~15 miles around the point; nearest first
// Per person per day, and for the whole app per day (all users together). The app-wide
// numbers keep usage inside Google's free monthly allowance (~1,000 of each a month).
// A map visit uses up to 3 searches (60 shops); coming back within 15 minutes uses none.
export const DAILY_LIMIT = { search: 15, details: 15 };
export const APP_DAILY_LIMIT = { search: 30, details: 30 };

// Only the fields the app shows (Google bills by the fields asked for).
export const SEARCH_FIELDS = [
  "places.id", "places.displayName", "places.location", "places.shortFormattedAddress",
  "places.formattedAddress", "places.rating", "places.userRatingCount", "places.primaryType",
  "places.primaryTypeDisplayName", "places.types", "places.businessStatus",
  "places.currentOpeningHours.openNow", "places.nationalPhoneNumber", "places.googleMapsUri",
  "nextPageToken",
].join(",");
export const DETAIL_FIELDS = [
  "id", "displayName", "location", "shortFormattedAddress", "formattedAddress", "rating",
  "userRatingCount", "primaryType", "primaryTypeDisplayName", "types", "businessStatus",
  "currentOpeningHours", "regularOpeningHours", "nationalPhoneNumber", "websiteUri",
  "googleMapsUri", "editorialSummary", "reviews", "photos", "priceLevel", "priceRange",
].join(",");

type Place = Record<string, any>;

// The app's shop shape. Only what Google returned; nothing invented.
export function toShop(p: Place) {
  return {
    id: p.id,
    source: "google",
    shop_name: p.displayName?.text ?? "Repair shop",
    address: p.formattedAddress ?? p.shortFormattedAddress ?? "",
    short_address: p.shortFormattedAddress ?? p.formattedAddress ?? "",
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    average_rating: p.rating ?? null,
    review_count: p.userRatingCount ?? 0,
    primary_type: p.primaryType ?? null,
    primary_type_label: p.primaryTypeDisplayName?.text ?? null,
    types: p.types ?? [],
    business_status: p.businessStatus ?? null,
    open_now: p.currentOpeningHours?.openNow ?? null,
    phone: p.nationalPhoneNumber ?? null,
    google_maps_uri: p.googleMapsUri ?? null,
  };
}

export function toDetails(p: Place, photo: { uri: string; attributions: unknown[] } | null) {
  return {
    ...toShop(p),
    website: p.websiteUri ?? null,
    weekday_hours: p.regularOpeningHours?.weekdayDescriptions ?? p.currentOpeningHours?.weekdayDescriptions ?? [],
    hours_periods: p.regularOpeningHours?.periods ?? [],
    summary: p.editorialSummary?.text ?? null,
    price_level: p.priceLevel ?? null,
    reviews: (p.reviews ?? []).map((r: Place) => ({
      rating: r.rating ?? null,
      text: r.text?.text ?? r.originalText?.text ?? "",
      when: r.relativePublishTimeDescription ?? "",
      author: r.authorAttribution?.displayName ?? "A Google user",
      author_uri: r.authorAttribution?.uri ?? null,
      author_photo: r.authorAttribution?.photoUri ?? null,
    })),
    photo,
  };
}

async function google(path: string, init: RequestInit & { fields: string }) {
  const { fields, ...rest } = init;
  const res = await fetch(`${PLACES}${path}`, {
    ...rest,
    headers: { "X-Goog-Api-Key": env("GOOGLE_PLACES_KEY"), "X-Goog-FieldMask": fields, "Content-Type": "application/json", ...(rest.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("places error", res.status, JSON.stringify(body).slice(0, 500));
    throw new Error(res.status === 403 ? "The Google key isn't allowed to use the Places API (New)." : "Google couldn't find shops right now.");
  }
  return body;
}

async function handle(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!env("GOOGLE_PLACES_KEY")) return json({ error: "Shop search isn't set up yet (GOOGLE_PLACES_KEY is missing)." }, 503);

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who } = token ? await admin.auth.getUser(token) : { data: null };
  if (!who?.user) return json({ error: "Please sign in again." }, 401);

  const body = await req.json().catch(() => ({}));
  const action = body.action === "details" ? "details" : "search";

  const { data: allowed, error: limitErr } = await admin.rpc("use_google_places", {
    p_user: who.user.id, p_kind: action, p_limit: DAILY_LIMIT[action], p_app_limit: APP_DAILY_LIMIT[action],
  });
  if (limitErr) console.error("usage", limitErr.message);
  if (limitErr) return json({ error: "Shop search isn't set up yet (run the google_shops migration)." }, 503);
  if (allowed === false) return json({ error: "AutoPal has reached today's shop lookups. Shops you've already seen still work; new searches reset tomorrow." }, 429);

  try {
    if (action === "search") {
      const lat = Number(body.lat), lng = Number(body.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return json({ error: "Bad location." }, 400);
      }
      const data = await google("/places:searchText", {
        method: "POST",
        fields: SEARCH_FIELDS,
        body: JSON.stringify({
          textQuery: "auto repair shop",
          includedType: "car_repair",
          pageSize: 20,
          rankPreference: "DISTANCE",
          locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: SEARCH_RADIUS_M } },
          languageCode: "en",
          regionCode: "US",
          ...(typeof body.pageToken === "string" && body.pageToken ? { pageToken: body.pageToken } : {}),
        }),
      });
      const shops = (data.places ?? [])
        .filter((p: Place) => p.businessStatus !== "CLOSED_PERMANENTLY" && p.location)
        .map(toShop);
      return json({ shops, nextPageToken: data.nextPageToken ?? null });
    }

    const id = String(body.id ?? "");
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(id)) return json({ error: "Bad shop id." }, 400);
    const p = await google(`/places/${id}?languageCode=en&regionCode=US`, { method: "GET", fields: DETAIL_FIELDS });
    // One cover photo (Google returns a short-lived image link; the key isn't in it).
    let photo = null;
    const first = (p.photos ?? [])[0];
    if (first?.name) {
      const r = await fetch(`${PLACES}/${first.name}/media?maxWidthPx=900&skipHttpRedirect=true&key=${env("GOOGLE_PLACES_KEY")}`);
      const media = await r.json().catch(() => ({}));
      if (r.ok && media.photoUri) {
        photo = { uri: media.photoUri, attributions: (first.authorAttributions ?? []).map((a: Place) => ({ name: a.displayName, uri: a.uri })) };
      }
    }
    return json({ shop: toDetails(p, photo) });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}

if (typeof Deno !== "undefined") Deno.serve(handle);
