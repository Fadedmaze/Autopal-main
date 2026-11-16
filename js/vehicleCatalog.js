// Lookups over the vehicle catalog (js/vehicleCatalogData.js): brands, their makes
// (Civic, F-150...) with body type and model years, and each make's models (trims).
// Add/Edit Vehicle only offers catalog choices, and the body type picks the 3D shape.
// Naming in the database (vehicles columns): brand = Honda, make = Civic, model = EX.
// On screen these read Make = Honda, Model = Civic, Trim = EX, as car buyers say it.
import { CATALOG_DATA } from "./vehicleCatalogData.js";

const BODY = { s: "sedan", h: "hatch", c: "coupe", u: "suv", t: "truck", v: "van" };
// The newest model year on sale; makes with no end year run through it.
export const LATEST_YEAR = 2027;

// A trim may list the model years it was offered: "Hybrid [2003-2015, 2025-]" (an open
// end means "still sold"). A trim without years is offered in every year of the model.
// Trims are split on commas outside the brackets.
function parseTrims(text, to) {
  const out = [];
  for (const raw of (text ?? "").match(/[^,[]+(\[[^\]]*\])?/g) ?? []) {
    const m = raw.trim().match(/^(.*?)\s*(?:\[([^\]]*)\])?$/);
    if (!m || !m[1]) continue;
    const years = m[2]
      ? m[2].split(",").map((r) => {
        const [a, b] = r.trim().split("-").map((x) => x.trim());
        return [Number(a), b === undefined ? Number(a) : b === "" ? to : Number(b)];
      })
      : null;
    out.push({ name: m[1].trim(), years });
  }
  return out;
}

// Model years: "1997" (with the last-year column) or, for a name that took a break,
// "1966-1996, 2021" (the last range runs to the last-year column, or to today).
function parseYears(fromText, toText) {
  const last = toText ? Number(toText) : LATEST_YEAR;
  const parts = fromText.split(",").map((r) => r.trim()).filter(Boolean);
  return parts.map((r, i) => {
    const [a, b] = r.split("-").map((x) => x.trim());
    const end = b ? Number(b) : i === parts.length - 1 ? last : Number(a);
    return [Number(a), end];
  });
}

// { "Honda": [{ name: "Accord", body: "sedan", from: 1976, to: 2027, years: [[1976, 2027]],
//              trims: ["LX", ...], trimYears: { "Hybrid": [[2005, 2007], [2014, 2027]] } }, ...] }
export const CATALOG = Object.fromEntries(Object.entries(CATALOG_DATA).map(([brand, text]) => [
  brand,
  text.trim().split("\n").map((line) => {
    const [name, body, fromText, toText, trimText] = line.split("|").map((x) => x.trim());
    const years = parseYears(fromText, toText);
    const trims = parseTrims(trimText, years.at(-1)[1]);
    return {
      name,
      body: BODY[body],
      from: years[0][0],
      to: years.at(-1)[1],
      years,
      trims: trims.map((t) => t.name),
      trimYears: Object.fromEntries(trims.filter((t) => t.years).map((t) => [t.name, t.years])),
    };
  }),
]));

// Was this model sold new in this model year? (Some names skipped years.)
export function soldIn(model, year) {
  return Boolean(model) && model.years.some(([a, b]) => year >= a && year <= b);
}

// "1995–2005 and 2019–2027" for messages.
export function yearsText(model) {
  return model.years.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(" and ");
}

// Was this trim offered in this model year? (Unknown year or no listed years: yes.)
export function trimInYear(model, trim, year) {
  const ranges = model?.trimYears?.[trim];
  return !ranges || !year || ranges.some(([a, b]) => year >= a && year <= b);
}

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
  return modelsFor(brand).filter((m) => !y || soldIn(m, y));
}

// Trims for a brand + make, from the catalog only; with a year, just that year's trims.
export function trimsFor(brand, make, year = null) {
  const m = findModel(brand, make, { exact: true });
  return (m?.trims ?? []).filter((t) => trimInYear(m, t, Number(year) || null));
}

// Is this exact brand / make / model (trim) / year combination in the catalog?
// Model may be empty ("Not sure"). Returns a reason string when it isn't, else "".
export function catalogProblem({ brand, make, model, year }) {
  const b = CATALOG[brand] ? brand : null;
  if (!b) return "Choose a make from the list.";
  const m = findModel(b, make, { exact: true });
  if (!m || m.name !== make) return `Choose a ${b} model from the list.`;
  if (year && !soldIn(m, year)) return `The ${b} ${m.name} was sold as ${yearsText(m)} model${m.from === m.to ? "" : "s"}. Check the year.`;
  if (model && !m.trims.includes(model)) return `Choose a ${m.name} trim from the list, or "Not Sure".`;
  if (model && !trimInYear(m, model, year)) return `The ${year} ${m.name} didn't come as a ${model}. Choose a trim from the list, or "Not Sure".`;
  return "";
}
