// Real repair shops anywhere in the world, from OpenStreetMap (Overpass API, free, no key).
// The app's own mechanic_shops table only covers a few towns, so Find a Mechanic merges
// these in. OpenStreetMap has no ratings or prices, so those stay null; services come
// from the shop's tags (or its name), and a general repair shop that lists none is
// assumed to do the everyday jobs most general shops do (marked services_estimated).
//
// Shapes match nearby_shops() rows. Ids are negative so they never clash with database
// ids (and are never saved as a task's shop_id).

// Overpass gives the most shops and their service tags but is sometimes slow or down,
// so it gets a short time limit and Nominatim (OpenStreetMap's search) is the backup.
const OVERPASS = "https://overpass-api.de/api/interpreter";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS_MS = 8000;
const NOMINATIM_MS = 10000;
const RADIUS_MILES = 10;   // search radius around the point
const WIDE_MILES = 30;     // try again this wide when the area is sparse (rural)
const REUSE_MILES = 4;     // a cached search this close to the new point is reused
const MAX_CACHE = 8;
const CACHE_KEY = "autopal.osmShops.v1";
const CACHE_HOURS = 24;

const GENERAL = ["Oil change", "Brakes", "Engine", "Electrical", "Inspection"];

// service:vehicle:* tags → the app's service names.
const TAG_SERVICES = {
  oil_change: "Oil change", oil: "Oil change",
  brakes: "Brakes",
  tyres: "Tires", tires: "Tires",
  wheel_alignment: "Alignment", alignment: "Alignment",
  engine: "Engine", engine_repair: "Engine", diagnostics: "Engine", car_repair: "Engine",
  transmission: "Transmission", gearbox: "Transmission", clutch: "Transmission",
  electrical: "Electrical", batteries: "Electrical", air_conditioning: "Electrical",
  inspection: "Inspection", mot: "Inspection", emissions: "Inspection",
};

// Words in a shop's name that say what it does.
const NAME_SERVICES = [
  [/\b(lube|oil|quick ?lane|jiffy|valvoline)\b/i, ["Oil change", "Inspection"]],
  [/\bbrake/i, ["Brakes"]],
  [/\b(tire|tyre|wheel)/i, ["Tires", "Alignment"]],
  [/\balign/i, ["Alignment"]],
  [/\btransmission|gearbox/i, ["Transmission"]],
  [/\b(electric|battery|batteries|auto ?electric)/i, ["Electrical"]],
  [/\b(muffler|exhaust|midas|meineke)\b/i, ["Brakes", "Inspection"]],
  [/\b(smog|emission|inspection|mot)\b/i, ["Inspection"]],
  [/\b(engine|diesel|motor)\b/i, ["Engine"]],
];

const rad = (d) => (d * Math.PI) / 180;
export function milesBetween(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

function servicesFor(tags) {
  const out = new Set();
  for (const [k, v] of Object.entries(tags)) {
    const m = k.match(/^service:vehicle:(.+)$/);
    if (m && v !== "no" && TAG_SERVICES[m[1]]) out.add(TAG_SERVICES[m[1]]);
  }
  if (tags.shop === "tyres") { out.add("Tires"); out.add("Alignment"); }
  for (const [re, list] of NAME_SERVICES) if (re.test(tags.name ?? "")) list.forEach((s) => out.add(s));
  // A repair shop that lists nothing, or whose name says it's a general shop ("City
  // Tire and Auto Repair"), gets the everyday jobs most general shops do.
  const general = tags.shop !== "tyres" && /\b(auto|repair|garage|service|mechanic|car care)/i.test(tags.name ?? "");
  const estimated = out.size === 0 || (general && GENERAL.some((s) => !out.has(s)));
  if (out.size === 0 || general) GENERAL.forEach((s) => out.add(s));
  return { services: [...out], estimated };
}

function toShop(el) {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const name = t.name || t.brand || t.operator;
  if (!name) return null; // unnamed pins aren't useful to call or drive to
  const { services, estimated } = servicesFor(t);
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const typeDigit = { node: 1, way: 2, relation: 3 }[el.type] ?? 0;
  return {
    id: -(el.id * 10 + typeDigit),
    shop_name: name,
    street_address: street,
    city: t["addr:city"] || t["addr:town"] || t["addr:village"] || "",
    phone: t.phone || t["contact:phone"] || null,
    website: t.website || t["contact:website"] || null,
    latitude: lat,
    longitude: lng,
    average_rating: null,
    average_repair_price: null,
    services,
    services_estimated: estimated,
    source: "osm",
  };
}

function query(lat, lng, miles) {
  const r = Math.round(miles * 1609.34);
  const around = `(around:${r},${lat.toFixed(5)},${lng.toFixed(5)})`;
  return `[out:json][timeout:25];(
    nwr["shop"="car_repair"]${around};
    nwr["shop"="tyres"]${around};
    nwr["craft"="car_repair"]${around};
    nwr["shop"="car"]["service:vehicle:car_repair"="yes"]${around};
  );out center tags 300;`;
}

async function fetchJson(url, init, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fromOverpass(lat, lng, miles) {
  const data = await fetchJson(OVERPASS, { method: "POST", body: new URLSearchParams({ data: query(lat, lng, miles) }) }, OVERPASS_MS);
  return data.elements ?? [];
}

// Nominatim returns up to 50 places per search inside a box; search for repair shops
// and tire shops and turn the results into Overpass-shaped elements.
async function fromNominatim(lat, lng, miles) {
  const box = (m) => {
    const dLat = m / 69;
    const dLng = m / (69 * Math.max(0.2, Math.cos(rad(lat))));
    return [lng - dLng, lat + dLat, lng + dLng, lat - dLat].map((n) => n.toFixed(4)).join(",");
  };
  const search = (q, m) => fetchJson(`${NOMINATIM}?${new URLSearchParams({
    format: "jsonv2", q, viewbox: box(m), bounded: "1", limit: "50", addressdetails: "1", extratags: "1",
  })}`, {}, NOMINATIM_MS);
  // 50 results can be spread across the whole box, so also search close by: the
  // nearest shops always make the list in a big city.
  const lists = await Promise.allSettled([search("car repair", Math.min(3, miles)), search("car repair", miles), search("tyres", miles)]);
  if (lists.every((r) => r.status === "rejected")) throw lists[0].reason;
  return lists.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((x) => ["car_repair", "tyres"].includes(x.type))
    .map((x) => {
      const a = x.address ?? {};
      return {
        type: x.osm_type, id: x.osm_id, lat: Number(x.lat), lon: Number(x.lon),
        tags: {
          ...(x.extratags ?? {}),
          shop: x.type,
          name: x.name || a.shop || a.craft,
          "addr:housenumber": a.house_number,
          "addr:street": a.road,
          "addr:city": a.city || a.town || a.village || a.hamlet,
        },
      };
    });
}

// Ask both at once. Nominatim is fast and reliable; Overpass is more complete when it's
// up. Use Nominatim's answer as soon as it arrives, plus Overpass's if it lands within
// a moment more; if Nominatim fails, wait for Overpass. Same OpenStreetMap ids, so the
// two lists merge without duplicates.
const GRACE_MS = 1500;
async function findShops(lat, lng, miles) {
  const over = fromOverpass(lat, lng, miles);
  over.catch(() => {});
  let quick;
  try {
    quick = await fromNominatim(lat, lng, miles);
  } catch {
    return over;
  }
  const late = await Promise.race([over.catch(() => []), new Promise((r) => setTimeout(() => r([]), GRACE_MS))]);
  return [...late, ...quick];
}

// ---- Cache (per device, so moving around or reopening the map is instant) ----------

function readCache() {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    const fresh = Date.now() - CACHE_HOURS * 3600e3;
    return Array.isArray(all) ? all.filter((c) => c.at > fresh) : [];
  } catch { return []; }
}
function writeCache(list) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list.slice(-MAX_CACHE))); } catch { /* full or blocked */ }
}

const pending = new Map();

// Shops within ~10 miles of a point (wider in sparse areas). Never throws: if both
// servers are unreachable there are just no extra shops (and nothing is cached).
export async function osmShopsNear(lat, lng) {
  const point = { lat, lng };
  const hit = readCache().find((c) => milesBetween(c.point, point) <= REUSE_MILES);
  if (hit) return hit.shops;
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    try {
      let els = await findShops(lat, lng, RADIUS_MILES);
      if (els.length < 5) els = await findShops(lat, lng, WIDE_MILES);
      const seen = new Set();
      const shops = els.map(toShop).filter((s) => s && !seen.has(s.id) && seen.add(s.id));
      writeCache([...readCache(), { point, at: Date.now(), shops }]);
      return shops;
    } catch {
      return [];
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, job);
  return job;
}
