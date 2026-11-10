// Brands and models for Add/Edit Vehicle, and each model's body type (which also picks
// the 3D car shape on Home). US-market models sold new from about 2000 through the 2027
// model year, including recently discontinued ones that are still common on the road.
// Last reviewed November 2026. People can still type anything; this only suggests and
// fixes capitalization ("honda civic" → "Honda Civic").
//
// Body types: s = sedan, h = hatchback / wagon, c = coupe / convertible / sports car,
// u = SUV / crossover, t = pickup truck, v = van / minivan.

const RAW = {
  "Acura": "ADX u, ILX s, Integra h, MDX u, NSX c, RDX u, RL s, RLX s, RSX c, TL s, TLX s, TSX s, ZDX u",
  "Alfa Romeo": "4C c, Giulia s, Stelvio u, Tonale u",
  "Aston Martin": "DB11 c, DB12 c, DBS c, DBX u, Vanquish c, Vantage c",
  "Audi": "A3 s, A4 s, A4 allroad h, A5 c, A5 Sportback h, A6 s, A6 allroad h, A6 e-tron s, A7 h, A8 s, e-tron u, e-tron GT s, Q3 u, Q4 e-tron u, Q5 u, Q6 e-tron u, Q7 u, Q8 u, R8 c, RS 3 s, RS 5 c, RS 6 Avant h, RS 7 h, S3 s, S4 s, S5 c, SQ5 u, TT c",
  "Bentley": "Bentayga u, Continental GT c, Flying Spur s",
  "BMW": "1 Series c, 2 Series c, 2 Series Gran Coupe s, 3 Series s, 4 Series c, 4 Series Gran Coupe h, 5 Series s, 6 Series c, 7 Series s, 8 Series c, i3 h, i4 s, i5 s, i7 s, i8 c, iX u, M2 c, M3 s, M4 c, M5 s, M8 c, X1 u, X2 u, X3 u, X4 u, X5 u, X6 u, X7 u, XM u, Z4 c",
  "Buick": "Cascada c, Enclave u, Encore u, Encore GX u, Envision u, Envista u, LaCrosse s, LeSabre s, Lucerne s, Rainier u, Regal s, Rendezvous u, Verano s",
  "Cadillac": "ATS s, CT4 s, CT5 s, CT6 s, CTS s, DTS s, ELR c, Escalade u, Escalade ESV u, Escalade IQ u, Lyriq u, Optiq u, SRX u, STS s, Vistiq u, XLR c, XT4 u, XT5 u, XT6 u, XTS s",
  "Chevrolet": "Avalanche t, Aveo s, Blazer u, Blazer EV u, Bolt h, Bolt EUV u, Camaro c, Captiva Sport u, Cobalt s, Colorado t, Corvette c, Cruze s, Equinox u, Equinox EV u, Express v, HHR h, Impala s, Malibu s, Silverado 1500 t, Silverado 2500HD t, Silverado 3500HD t, Silverado EV t, Sonic s, Spark h, SS s, Suburban u, Tahoe u, Trailblazer u, Traverse u, Trax u, Uplander v, Volt h",
  "Chrysler": "200 s, 300 s, Aspen u, Crossfire c, Pacifica v, PT Cruiser h, Sebring s, Town & Country v, Voyager v",
  "Dodge": "Avenger s, Caliber h, Challenger c, Charger s, Dart s, Durango u, Grand Caravan v, Hornet u, Journey u, Magnum h, Neon s, Nitro u, Viper c",
  "Ferrari": "296 GTB c, 812 Superfast c, 12Cilindri c, F8 Tributo c, Purosangue u, Roma c, SF90 Stradale c",
  "Fiat": "124 Spider c, 500 h, 500e h, 500L h, 500X u",
  "Fisker": "Karma s, Ocean u",
  "Ford": "Bronco u, Bronco Sport u, C-Max h, Crown Victoria s, E-Series v, EcoSport u, Edge u, Escape u, Excursion u, Expedition u, Explorer u, F-150 t, F-150 Lightning t, F-250 Super Duty t, F-350 Super Duty t, F-450 Super Duty t, Fiesta h, Five Hundred s, Flex u, Focus s, Freestyle u, Fusion s, GT c, Maverick t, Mustang c, Mustang Mach-E u, Ranger t, Taurus s, Taurus X u, Transit v, Transit Connect v",
  "Genesis": "G70 s, G80 s, G90 s, GV60 u, GV70 u, GV80 u, GV80 Coupe u",
  "GMC": "Acadia u, Canyon t, Envoy u, Hummer EV t, Hummer EV SUV u, Savana v, Sierra 1500 t, Sierra 2500HD t, Sierra 3500HD t, Sierra EV t, Terrain u, Yukon u, Yukon XL u",
  "Honda": "Accord s, Civic s, Civic Hatchback h, Civic Type R h, Clarity s, CR-V u, CR-Z h, Crosstour h, Element u, Fit h, HR-V u, Insight s, Odyssey v, Passport u, Pilot u, Prelude c, Prologue u, Ridgeline t, S2000 c",
  "Hummer": "H1 u, H2 u, H3 u, H3T t",
  "Hyundai": "Accent s, Azera s, Elantra s, Elantra GT h, Entourage v, Equus s, Genesis s, Genesis Coupe c, Ioniq h, Ioniq 5 u, Ioniq 6 s, Ioniq 9 u, Kona u, Kona Electric u, Nexo u, Palisade u, Santa Cruz t, Santa Fe u, Sonata s, Tiburon c, Tucson u, Veloster h, Venue u, Veracruz u",
  "Infiniti": "EX35 u, FX35 u, G35 s, G37 s, M37 s, Q50 s, Q60 c, Q70 s, QX30 u, QX50 u, QX55 u, QX56 u, QX60 u, QX70 u, QX80 u",
  "Jaguar": "E-Pace u, F-Pace u, F-Type c, I-Pace u, S-Type s, XE s, XF s, XJ s, XK c",
  "Jeep": "Cherokee u, Commander u, Compass u, Gladiator t, Grand Cherokee u, Grand Cherokee L u, Grand Wagoneer u, Liberty u, Patriot u, Recon u, Renegade u, Wagoneer u, Wagoneer S u, Wrangler u",
  "Kia": "Borrego u, Cadenza s, Carnival v, EV6 u, EV9 u, Forte s, K4 s, K5 s, K900 s, Niro u, Optima s, Rio s, Sedona v, Seltos u, Sorento u, Soul h, Spectra s, Sportage u, Stinger h, Telluride u",
  "Lamborghini": "Aventador c, Gallardo c, Huracán c, Revuelto c, Temerario c, Urus u",
  "Land Rover": "Defender u, Discovery u, Discovery Sport u, LR2 u, LR3 u, LR4 u, Range Rover u, Range Rover Evoque u, Range Rover Sport u, Range Rover Velar u",
  "Lexus": "CT h, ES s, GS s, GX u, HS s, IS s, LC c, LFA c, LS s, LX u, NX u, RC c, RX u, RZ u, SC c, TX u, UX u",
  "Lincoln": "Aviator u, Continental s, Corsair u, LS s, MKC u, MKS s, MKT u, MKX u, MKZ s, Nautilus u, Navigator u, Town Car s",
  "Lotus": "Eletre u, Elise c, Emira c, Evora c, Exige c",
  "Lucid": "Air s, Gravity u",
  "Maserati": "Ghibli s, GranTurismo c, Grecale u, Levante u, MC20 c, Quattroporte s",
  "Mazda": "CX-3 u, CX-30 u, CX-5 u, CX-50 u, CX-7 u, CX-70 u, CX-9 u, CX-90 u, Mazda2 h, Mazda3 s, Mazda3 Hatchback h, Mazda5 v, Mazda6 s, MX-30 u, MX-5 Miata c, RX-8 c, Tribute u",
  "McLaren": "570S c, 720S c, 750S c, Artura c, GT c, GTS c",
  "Mercedes-Benz": "A-Class s, AMG GT c, C-Class s, CLA s, CLE c, CLS s, E-Class s, EQB u, EQE s, EQE SUV u, EQS s, EQS SUV u, G-Class u, GL u, GLA u, GLB u, GLC u, GLC Coupe u, GLE u, GLK u, GLS u, M-Class u, Metris v, S-Class s, SL c, SLC c, SLK c, Sprinter v",
  "Mercury": "Grand Marquis s, Mariner u, Milan s, Montego s, Mountaineer u, Sable s",
  "Mini": "Clubman h, Convertible c, Cooper h, Countryman u, Paceman h",
  "Mitsubishi": "Eclipse c, Eclipse Cross u, Endeavor u, Galant s, Lancer s, Mirage h, Mirage G4 s, Montero u, Outlander u, Outlander PHEV u, Outlander Sport u",
  "Nissan": "350Z c, 370Z c, Altima s, Ariya u, Armada u, Cube h, Frontier t, GT-R c, Juke u, Kicks u, Leaf h, Maxima s, Murano u, NV v, NV200 v, Pathfinder u, Quest v, Rogue u, Rogue Sport u, Sentra s, Titan t, Versa s, Xterra u, Z c",
  "Polestar": "Polestar 2 h, Polestar 3 u, Polestar 4 u",
  "Pontiac": "Aztek u, Firebird c, G5 s, G6 s, G8 s, Grand Am s, Grand Prix s, Montana v, Solstice c, Torrent u, Vibe h",
  "Porsche": "718 Boxster c, 718 Cayman c, 911 c, Cayenne u, Cayenne Coupe u, Macan u, Macan Electric u, Panamera h, Taycan s",
  "Ram": "1500 t, 2500 t, 3500 t, Dakota t, ProMaster v, ProMaster City v",
  "Rivian": "R1S u, R1T t, R2 u, R3 u",
  "Rolls-Royce": "Cullinan u, Dawn c, Ghost s, Phantom s, Spectre c, Wraith c",
  "Saab": "9-2X h, 9-3 s, 9-5 s, 9-7X u",
  "Saturn": "Astra h, Aura s, Ion s, Outlook u, Relay v, Sky c, Vue u",
  "Scion": "FR-S c, iA s, iM h, iQ h, tC c, xA h, xB h, xD h",
  "Scout": "Terra t, Traveler u",
  "Slate": "Truck t",
  "Smart": "Fortwo h",
  "Subaru": "Ascent u, Baja t, BRZ c, Crosstrek u, Forester u, Impreza s, Legacy s, Outback u, Solterra u, Trailseeker u, Tribeca u, Uncharted u, WRX s",
  "Suzuki": "Aerio s, Forenza s, Grand Vitara u, Kizashi s, SX4 h, XL7 u",
  "Tesla": "Cybertruck t, Model 3 s, Model S s, Model X u, Model Y u, Roadster c",
  "Toyota": "4Runner u, 86 c, Avalon s, bZ u, bZ Woodland u, bZ4X u, C-HR u, Camry s, Celica c, Corolla s, Corolla Cross u, Corolla Hatchback h, Crown s, Crown Signia u, Echo s, FJ Cruiser u, GR Corolla h, GR Supra c, GR86 c, Grand Highlander u, Highlander u, Land Cruiser u, Matrix h, Mirai s, MR2 Spyder c, Prius h, Prius Prime h, Prius v h, RAV4 u, Sequoia u, Sienna v, Solara c, Tacoma t, Tundra t, Venza u, Yaris h",
  "VinFast": "VF 8 u, VF 9 u",
  "Volkswagen": "Arteon s, Atlas u, Atlas Cross Sport u, Beetle h, CC s, e-Golf h, Eos c, Golf h, Golf GTI h, Golf R h, ID. Buzz v, ID.4 u, Jetta s, Passat s, Routan v, Taos u, Tiguan u, Touareg u",
  "Volvo": "C30 h, C40 Recharge u, C70 c, EX30 u, EX40 u, EX90 u, ES90 s, S40 s, S60 s, S80 s, S90 s, V50 h, V60 h, V70 h, V90 h, XC40 u, XC60 u, XC70 u, XC90 u",
};

const BODY = { s: "sedan", h: "hatch", c: "coupe", u: "suv", t: "truck", v: "van" };

// { "Honda": [{ name: "Accord", body: "sedan" }, ...] }
export const CATALOG = Object.fromEntries(Object.entries(RAW).map(([brand, list]) => [
  brand,
  list.split(", ").map((entry) => {
    const i = entry.lastIndexOf(" ");
    return { name: entry.slice(0, i), body: BODY[entry.slice(i + 1)] };
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

// Trim names that are common across many brands, offered as suggestions only.
export const COMMON_TRIMS = [
  "Base", "S", "SE", "SEL", "SL", "SR", "SV", "LE", "XLE", "XSE", "LX", "EX", "EX-L", "Sport", "Touring", "Limited",
  "Platinum", "Premium", "Premium Plus", "Prestige", "Luxury", "LT", "LTZ", "RS", "Z71", "High Country", "XL", "XLT",
  "Lariat", "King Ranch", "Raptor", "Laredo", "Overland", "Trailhawk", "Sahara", "Rubicon", "Big Horn", "Rebel",
  "Denali", "AT4", "SLE", "SLT", "TRD Off-Road", "TRD Pro", "GT", "GT-Line", "N Line", "Hybrid", "Plug-In Hybrid",
  "Long Range", "Performance", "AWD", "4WD",
];
