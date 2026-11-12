// Lookups over the vehicle catalog (js/vehicleCatalogData.js): brands, their makes
// (Civic, F-150...) with body type and model years, and each make's models (trims).
// Add/Edit Vehicle only offers catalog choices, and the body type picks the 3D shape.
// Naming follows the app's form: Brand = Honda, Make = Civic, Model = EX.
import { CATALOG_DATA } from "./vehicleCatalogData.js";

const BODY = { s: "sedan", h: "hatch", c: "coupe", u: "suv", t: "truck", v: "van" };
// The newest model year on sale; makes with no end year run through it.
export const LATEST_YEAR = 2027;

// { "Honda": [{ name: "Accord", body: "sedan", from: 1976, to: 2027, trims: ["LX", ...] }, ...] }
export const CATALOG = Object.fromEntries(Object.entries(CATALOG_DATA).map(([brand, text]) => [
  brand,
  text.trim().split("\n").map((line) => {
    const [name, body, from, to, trims] = line.split("|").map((x) => x.trim());
    return {
      name,
      body: BODY[body],
      from: Number(from),
      to: to ? Number(to) : LATEST_YEAR,
      trims: trims ? trims.split(",").map((t) => t.trim()).filter(Boolean) : [],
    };
  }),
]));

export const BRANDS = Object.keys(CATALOG);

// Common shorthand people type for a brand.
const BRAND_ALIASES = {
  "chevy": "Chevrolet", "vw": "Volkswagen", "mercedes": "Mercedes-Benz", "merc": "Mercedes-Benz", "benz": "Mercedes-Benz",
  "landrover": "Land Rover", "range rover": "Land Rover", "alfa": "Alfa Romeo", "rolls royce": "Rolls-Royce",
  "mini cooper": "Mini", "dodge ram": "Ram", "aston": "Aston Martin",
};

const squash = (t) => String(t ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// The catalog's spelling of a brand, or null if it isn't listed.
export function findBrand(text) {
  const key = String(text ?? "").trim().toLowerCase();
  if (!key) return null;
  if (BRAND_ALIASES[key]) return BRAND_ALIASES[key];
  return BRANDS.find((b) => squash(b) === squash(key)) ?? null;
}

// Models for a brand (catalog spelling or anything findBrand understands).
export function modelsFor(brand) {
  return CATALOG[findBrand(brand)] ?? [];
}

// The catalog entry for a brand + model, matching loosely ("crv" finds "CR-V",
// "f150" finds "F-150", "silverado" finds "Silverado 1500").
// With { exact: true } only a same-name match counts (used before saving, so a
// "Silverado" isn't silently changed to "Silverado 1500").
export function findModel(brand, model, { exact = false } = {}) {
  const list = modelsFor(brand);
  const key = squash(model);
  if (!key) return null;
  const same = list.find((m) => squash(m.name) === key);
  if (same || exact) return same ?? null;
  // "silverado" → "Silverado 1500"; then "accord hybrid" or "f-150 raptor" → the longest
  // listed model the text starts with.
  return list.find((m) => squash(m.name).startsWith(key) && key.length >= 3)
    ?? list.filter((m) => squash(m.name).length >= 2 && key.startsWith(squash(m.name)))
      .sort((a, b) => b.name.length - a.name.length)[0]
    ?? null;
}

// Body type from the catalog, or null when the car isn't listed.
export function catalogBody(brand, model) {
  return findModel(brand, model)?.body ?? null;
}

// Makes for a brand that were sold in a given model year (all of them without a year).
export function makesFor(brand, year = null) {
  const y = Number(year) || null;
  return modelsFor(brand).filter((m) => !y || (y >= m.from && y <= m.to));
}

// Models (trim levels) for a brand + make, from the catalog only.
export function trimsFor(brand, make) {
  return findModel(brand, make, { exact: true })?.trims ?? [];
}

// Is this exact brand / make / model (trim) / year combination in the catalog?
// Model may be empty ("Not sure"). Returns a reason string when it isn't, else "".
export function catalogProblem({ brand, make, model, year }) {
  const b = CATALOG[brand] ? brand : null;
  if (!b) return "Choose a brand from the list.";
  const m = findModel(b, make, { exact: true });
  if (!m || m.name !== make) return `Choose a ${b} make from the list.`;
  if (year && (year < m.from || year > m.to)) return `The ${b} ${m.name} was sold as ${m.from === m.to ? `a ${m.from}` : `${m.from}–${m.to}`} model${m.from === m.to ? "" : "s"}. Check the year.`;
  if (model && !m.trims.includes(model)) return `Choose a ${m.name} model from the list, or "Not Sure".`;
  return "";
}
