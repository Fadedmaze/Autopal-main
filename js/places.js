// Real repair shops from Google Places, through the google-shops Edge Function (the
// Google key never reaches the browser). Results come back in the same shape as the
// demo shops in public.mechanic_shops, so Find a Mechanic can use either.
import { supabase } from "./supabaseClient.js";
import { shopServices } from "./shopSpecialties.js";

async function call(body) {
  const { data, error } = await supabase.functions.invoke("google-shops", { body });
  if (error) {
    let message = "Couldn't load shops from Google right now.";
    try { message = (await error.context.json()).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return data;
}

function milesBetween(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// Fill in what the rest of the app expects from a shop.
export function normalize(s, from) {
  const shop = {
    ...s,
    street_address: s.short_address || s.address || "",
    city: "",
    average_repair_price: null, // Google doesn't publish prices
    distance_miles: from && s.latitude != null ? milesBetween(from, { lat: s.latitude, lng: s.longitude }) : null,
  };
  shop.services = shopServices(shop);
  return shop;
}

// One page (up to 20) of shops near a point, nearest first.
export async function searchShops(point, pageToken = null) {
  const data = await call({ action: "search", lat: point.lat, lng: point.lng, pageToken });
  return { shops: (data.shops ?? []).map((s) => normalize(s, point)), nextPageToken: data.nextPageToken ?? null };
}

// Everything the shop page shows. Kept for this visit only (Google doesn't allow storing it).
const detailCache = new Map();
export async function shopDetails(id, from = null) {
  if (!detailCache.has(id)) {
    detailCache.set(id, call({ action: "details", id }).then((d) => d.shop).catch((e) => { detailCache.delete(id); throw e; }));
  }
  return normalize(await detailCache.get(id), from);
}
