// Matching a warning light ("problem") to the mechanic shops most likely to fix it,
// and estimating what each one would charge. Pure functions: no DOM, no network.
//
// Data comes from public.warning_lights:
//   repair_service       the shop service that usually fixes it (e.g. "Brakes")
//   repair_alt_services  other services that can often handle it (e.g. ABS → "Electrical")
//   repair_cost_low/high typical US range for the usual fix, parts + labor
//   needs_diagnosis      true when the shop has to scan/test first (adds a diagnostic fee)
//   repair_note          one plain sentence on what usually causes it and what it costs

import { titleCase } from "./ui.js";
import { findBrand } from "./vehicleCatalog.js";

export const SERVICES = ["Oil change", "Brakes", "Tires", "Engine", "Transmission", "Electrical", "Alignment", "Inspection"];

// Typical diagnostic fee at an independent US shop; often credited toward the repair.
export const DIAGNOSTIC_FEE = { low: 90, high: 180 };

const SHOP_FACTOR = [0.8, 1.3]; // a shop's price level scales the typical range within this band

// Parts and labor cost more on some makes. Keys are the lowercase brand from Add Vehicle.
const BRAND_FACTOR = {
  "bmw": 1.35, "mercedes-benz": 1.35, "mercedes": 1.35, "audi": 1.3, "porsche": 1.5, "land rover": 1.45,
  "range rover": 1.45, "jaguar": 1.4, "maserati": 1.5, "alfa romeo": 1.3, "mini": 1.2, "volvo": 1.25,
  "tesla": 1.3, "cadillac": 1.2, "lincoln": 1.2, "genesis": 1.15, "lexus": 1.15, "infiniti": 1.15,
  "acura": 1.1, "volkswagen": 1.1, "vw": 1.1,
  // Added with the larger vehicle catalog (js/vehicleCatalog.js).
  "bentley": 1.7, "rolls-royce": 1.8, "ferrari": 1.8, "lamborghini": 1.8, "mclaren": 1.8, "aston martin": 1.6,
  "lotus": 1.45, "lucid": 1.35, "polestar": 1.25, "rivian": 1.3, "fisker": 1.3, "saab": 1.2, "hummer": 1.15,
};

// Lowercase brand used as the key for brand notes and prices. Shorthand like "Chevy"
// or "vw" is mapped to the full brand first (see js/vehicleCatalog.js).
export function brandKey(vehicle) {
  const typed = (vehicle?.brand ?? "").trim();
  return (findBrand(typed) ?? typed).toLowerCase();
}

export function vehicleFactor(vehicle) {
  return BRAND_FACTOR[brandKey(vehicle)] ?? 1;
}

// A light can be more urgent on some makes (e.g. Ford's amber wrench).
export function problemSeverity(light, vehicle) {
  return light.brand_severity?.[brandKey(vehicle)] ?? light.severity;
}

export function hasRepair(light) {
  return Boolean(light?.repair_service);
}

// How well a shop's services cover the problem: "primary", "alt" or null.
export function capability(shop, light) {
  if (!hasRepair(light)) return null;
  const svc = shop.services ?? [];
  if (svc.includes(light.repair_service)) return "primary";
  if ((light.repair_alt_services ?? []).some((s) => svc.includes(s))) return "alt";
  return null;
}

// Name keywords that mark a specialist for a service.
const SPECIALIST_WORDS = {
  "Brakes": /\bbrake/i, "Tires": /\btire|\btyre/i, "Transmission": /\btransmission|\bgearbox/i,
  "Oil change": /\blube|\boil\b/i, "Electrical": /\belectric|\bauto ?electric/i, "Alignment": /\balign/i,
};

export function isSpecialist(shop, light) {
  const service = light.repair_service;
  if (!(shop.services ?? []).includes(service)) return false;
  if (SPECIALIST_WORDS[service]?.test(shop.shop_name)) return true;
  // A shop offering only a few services, this one among them, is focused on it.
  return (shop.services ?? []).length <= 3;
}

export function median(values) {
  const v = values.map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// The shop's price level relative to the area: its average repair price over the median.
export function shopFactor(shop, areaMedian) {
  const avg = Number(shop.average_repair_price);
  if (!areaMedian || !(avg > 0)) return 1;
  return Math.min(SHOP_FACTOR[1], Math.max(SHOP_FACTOR[0], avg / areaMedian));
}

const roundTo5 = (n) => Math.round(n / 5) * 5;

// Estimate for one shop, or null if the shop can't do it or the light has no cost data.
// Returns the repair range, the diagnostic fee (if any), and the factors used, so the UI
// can explain the number instead of just showing it.
export function estimate(shop, light, { areaMedian, vehicle }) {
  if (!capability(shop, light) || light.repair_cost_low == null || light.repair_cost_high == null) return null;
  const shopF = shopFactor(shop, areaMedian);
  const carF = vehicleFactor(vehicle);
  const f = shopF * carF;
  const low = Math.max(5, roundTo5(Number(light.repair_cost_low) * f));
  const high = Math.max(low, roundTo5(Number(light.repair_cost_high) * f));
  const diag = light.needs_diagnosis
    ? { low: roundTo5(DIAGNOSTIC_FEE.low * shopF), high: roundTo5(DIAGNOSTIC_FEE.high * shopF) }
    : null;
  return { low, high, diag, shopFactor: shopF, carFactor: carF };
}

export function money(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
export function rangeText(e) {
  return `${money(e.low)}–${money(e.high)}`;
}
// Middle of the range, for a task's estimated cost.
export function midpoint(e) {
  return roundTo5((e.low + e.high) / 2 + (e.diag ? (e.diag.low + e.diag.high) / 2 : 0));
}

// One line explaining the shop's number, e.g. "About 15% above the area average · BMW parts cost more".
export function estimateWhy(e, vehicle) {
  const parts = [];
  const pct = Math.round((e.shopFactor - 1) * 100);
  if (Math.abs(pct) >= 5) parts.push(`Prices about ${Math.abs(pct)}% ${pct > 0 ? "above" : "below"} the area average`);
  else parts.push("Prices near the area average");
  if (e.carFactor > 1) parts.push(`${vehicle.brand} parts and labor usually cost more`);
  return parts.join(" · ");
}

// ---- Ranking -----------------------------------------------------------------------
// Shops that do the repair come first ("primary"), then shops that can often handle it
// ("alt"), then the rest. Within a group, a score weighs rating, distance and price.
// For stop-now lights distance counts for more: you shouldn't drive far.

function scoreShop(shop, light, { areaMedian, urgent }) {
  const rating = shop.average_rating == null ? 0.5 : Math.min(1, Math.max(0, (Number(shop.average_rating) - 3) / 2));
  const dist = 1 / (1 + Number(shop.distance_miles ?? 10) / (urgent ? 1.5 : 4));
  const price = Math.min(1, Math.max(0, (SHOP_FACTOR[1] - shopFactor(shop, areaMedian)) / (SHOP_FACTOR[1] - SHOP_FACTOR[0])));
  const w = urgent ? { rating: 0.3, dist: 0.55, price: 0.15 } : { rating: 0.45, dist: 0.3, price: 0.25 };
  return w.rating * rating + w.dist * dist + w.price * price + (isSpecialist(shop, light) ? 0.08 : 0);
}

const TIER = { primary: 0, alt: 1 };

export function rankShops(shops, light, { areaMedian, vehicle }) {
  const urgent = problemSeverity(light, vehicle) === "stop";
  const rows = shops.map((shop) => ({
    shop,
    cap: capability(shop, light),
    score: scoreShop(shop, light, { areaMedian, urgent }),
  }));
  rows.sort((a, b) => ((TIER[a.cap] ?? 2) - (TIER[b.cap] ?? 2)) || (b.score - a.score) || (a.shop.distance_miles - b.shop.distance_miles));
  const capable = rows.filter((r) => r.cap);
  const nearest = capable.reduce((m, r) => (m && m.shop.distance_miles <= r.shop.distance_miles ? m : r), null);
  const bestRating = Math.max(0, ...capable.map((r) => Number(r.shop.average_rating) || 0));
  return rows.map((r, i) => ({
    ...r,
    best: i === 0 && Boolean(r.cap),
    reasons: reasonsFor(r, light, { areaMedian, nearest: r === nearest && capable.length > 1, topRated: r.cap && Number(r.shop.average_rating) === bestRating && bestRating >= 4.5 }),
  }));
}

function reasonsFor({ shop, cap }, light, { areaMedian, nearest, topRated }) {
  // Short tags, in Title Case like other labels.
  const svc = titleCase(light.repair_service);
  const out = [];
  if (cap === "primary") out.push(isSpecialist(shop, light) ? `${svc} Specialist` : `Does ${svc} Work`);
  else if (cap === "alt") out.push(`Can Often Handle This (${(light.repair_alt_services ?? []).filter((s) => shop.services?.includes(s)).map(titleCase).join(", ")})`);
  if (!cap) return out;
  if (topRated) out.push("Top Rated");
  if (nearest) out.push("Closest");
  const f = shopFactor(shop, areaMedian);
  if (f <= 0.9) out.push("Lower Prices");
  else if (f >= 1.15) out.push("Higher Prices");
  return out;
}
