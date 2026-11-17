// What a repair shop specializes in, read from what Google knows about it: the shop's
// name and category, Google's short summary, and its reviews. Pure functions.
//
// shopServices(shop)  -> the app's service list (js/repairs.js SERVICES) for filters and
//                        problem matching, from the name and category alone (search
//                        results don't include reviews). General shops get the general set.
// specialties(shop)   -> [{ key, label, evidence: { name, summary, reviews } }], strongest
//                        first, for the shop page.
// brandsMentioned(shop) -> makes customers mention in reviews, most mentioned first.

export const SPECIALTIES = [
  { key: "brakes", label: "Brakes", service: "Brakes", re: /\bbrakes?\b|\brotors?\b|\bbrake pads?\b/i },
  { key: "tires", label: "Tires", service: "Tires", re: /\btires?\b|\btyres?\b|\bflat tire\b/i },
  { key: "alignment", label: "Alignment", service: "Alignment", re: /\balign(ment|ed)?\b/i },
  { key: "oil", label: "Oil Changes", service: "Oil change", re: /\boil changes?\b|\blube\b|\bquick lube\b|\boil and filter\b/i },
  { key: "transmission", label: "Transmissions", service: "Transmission", re: /\btransmissions?\b|\bclutch\b|\bgearbox\b|\bdrivetrain\b/i },
  { key: "engine", label: "Engine Repair & Diagnostics", service: "Engine", re: /\bengines?\b|\bcheck engine\b|\bdiagnos(e|ed|is|tic|tics)\b|\bmisfire\b|\bhead gasket\b|\btimin?g belt\b/i },
  { key: "electrical", label: "Electrical & Batteries", service: "Electrical", re: /\belectrical\b|\bbatter(y|ies)\b|\balternator\b|\bstarter\b|\bwiring\b/i },
  { key: "inspection", label: "Inspections & Emissions", service: "Inspection", re: /\binspections?\b|\bemissions?\b|\bsmog\b|\bsafety check\b/i },
  { key: "ac", label: "A/C & Heating", service: null, re: /\ba\/c\b|\bair condition(ing|er)?\b|\bheater\b|\bradiator\b|\bcoolant\b|\bcooling system\b/i },
  { key: "suspension", label: "Suspension & Steering", service: null, re: /\bsuspension\b|\bshocks?\b|\bstruts?\b|\bsteering\b|\bcontrol arms?\b|\bball joints?\b/i },
  { key: "exhaust", label: "Exhaust & Mufflers", service: null, re: /\bmufflers?\b|\bexhaust\b|\bcatalytic\b/i },
  { key: "diesel", label: "Diesel", service: null, re: /\bdiesel\b|\bduramax\b|\bpowerstroke\b|\bcummins\b/i },
  { key: "hybrid", label: "Hybrids & EVs", service: null, re: /\bhybrids?\b|\belectric vehicles?\b|\bevs?\b|\bprius\b|\btesla\b/i },
  { key: "european", label: "European Cars", service: null, re: /\beuropean\b|\beuro\b|\bgerman\b|\bbmw\b|\bmercedes\b|\baudi\b|\bvolkswagen\b|\bvw\b|\bporsche\b|\bvolvo\b|\bmini cooper\b/i },
  { key: "asian", label: "Japanese & Korean Cars", service: null, re: /\bjapanese\b|\basian\b|\btoyota\b|\bhonda\b|\bsubaru\b|\bnissan\b|\bmazda\b|\blexus\b|\bacura\b|\bhyundai\b|\bkia\b/i },
  { key: "trucks", label: "Trucks & 4x4", service: null, re: /\btrucks?\b|\b4x4\b|\b4wd\b|\boff-?road\b|\bjeeps?\b|\blift kits?\b/i },
  { key: "body", label: "Collision & Body Work", service: null, re: /\bcollision\b|\bauto body\b|\bbody (shop|work)\b|\bdents?\b|\bpaint(ed|ing)?\b|\bbumper\b/i },
  { key: "glass", label: "Windshields & Glass", service: null, re: /\bwindshields?\b|\bauto glass\b/i },
];

// What a general repair shop is assumed to do when nothing points to a specialty.
const GENERAL = ["Oil change", "Brakes", "Engine", "Electrical", "Inspection"];
const BY_KEY = Object.fromEntries(SPECIALTIES.map((s) => [s.key, s]));

const BRANDS = [
  ["Toyota", /\btoyota|\btacoma|\bcamry|\bcorolla|\b4runner|\brav-?4|\bprius/i],
  ["Honda", /\bhonda|\bcivic\b|\baccord\b|\bcr-?v\b|\bodyssey\b/i],
  ["Subaru", /\bsubaru|\boutback\b|\bforester\b|\bcrosstrek\b/i],
  ["Ford", /\bford\b|\bf-?150\b|\bexplorer\b|\bescape\b|\bmustang\b/i],
  ["Chevrolet", /\bchev(y|rolet)\b|\bsilverado\b|\btahoe\b|\bmalibu\b|\bequinox\b/i],
  ["GMC", /\bgmc\b|\bsierra\b|\byukon\b/i],
  ["Dodge & Ram", /\bdodge\b|\bram\s?(1500|2500|3500)\b|\bcharger\b|\bdurango\b/i],
  ["Jeep", /\bjeeps?\b|\bwrangler\b|\bcherokee\b/i],
  ["Nissan", /\bnissan\b|\baltima\b|\brogue\b|\bsentra\b/i],
  ["Hyundai", /\bhyundai\b|\belantra\b|\bsonata\b|\btucson\b/i],
  ["Kia", /\bkia\b|\bsorento\b|\bsportage\b|\bsoul\b/i],
  ["Mazda", /\bmazda\b|\bmiata\b|\bcx-?5\b/i],
  ["Volkswagen", /\bvolkswagen\b|\bvw\b|\bjetta\b|\bgolf\b|\bpassat\b/i],
  ["BMW", /\bbmw\b/i],
  ["Mercedes-Benz", /\bmercedes\b|\bbenz\b/i],
  ["Audi", /\baudi\b/i],
  ["Lexus", /\blexus\b/i],
  ["Tesla", /\btesla\b/i],
];

// Services for filters and problem matching, from the name and category alone.
export function shopServices(shop) {
  const name = shop.shop_name ?? "";
  const types = (shop.types ?? []).join(" ");
  const found = new Set();
  for (const s of SPECIALTIES) if (s.service && s.re.test(name)) found.add(s.service);
  if (/tire/i.test(types)) found.add("Tires");
  if (found.has("Tires")) found.add("Alignment");
  // Body shops and glass shops don't do mechanical work.
  const bodyOnly = (BY_KEY.body.re.test(name) || BY_KEY.glass.re.test(name)) && !found.size;
  if (bodyOnly) return [];
  // A name like "Brake & Tire" is a focused shop; a plain "Auto Repair" does the general set.
  if (!found.size || /\b(auto|car|automotive)\s+(repair|service|care)\b|\bgarage\b|\bmechanic/i.test(name)) {
    GENERAL.forEach((s) => found.add(s));
  }
  return [...found];
}

// Specialties with the evidence behind each, strongest first. A specialty needs the
// shop's name, Google's summary, or at least two reviews mentioning it.
export function specialties(shop) {
  const name = shop.shop_name ?? "";
  const summary = shop.summary ?? "";
  const reviews = (shop.reviews ?? []).map((r) => r.text ?? "");
  const out = [];
  for (const s of SPECIALTIES) {
    const ev = {
      name: s.re.test(name),
      summary: s.re.test(summary),
      reviews: reviews.filter((t) => s.re.test(t)).length,
    };
    const score = (ev.name ? 3 : 0) + (ev.summary ? 2 : 0) + ev.reviews;
    if (ev.name || ev.summary || ev.reviews >= 2) out.push({ key: s.key, label: s.label, service: s.service, evidence: ev, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

// "Named in the shop's name", "Mentioned in 3 of 5 reviews", ...
export function evidenceText(sp, reviewCount) {
  const bits = [];
  if (sp.evidence.name) bits.push("in the shop's name");
  if (sp.evidence.summary) bits.push("in Google's description");
  if (sp.evidence.reviews) bits.push(`in ${sp.evidence.reviews} of ${reviewCount} reviews`);
  return bits.length ? `Mentioned ${bits.join(", ")}` : "";
}

export function brandsMentioned(shop) {
  const text = [shop.shop_name, shop.summary, ...(shop.reviews ?? []).map((r) => r.text)].join("\n");
  return BRANDS.map(([label, re]) => ({ label, count: (text.match(new RegExp(re.source, "gi")) ?? []).length }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((b) => b.label);
}
