// How a car looks in 3D: paint color and finish, wheels, roof, window tint and a couple
// of add-ons. Saved per vehicle in vehicles.appearance (jsonb). The paint list holds
// common factory colors so people can match their real car; any other color can be
// picked with the custom color control.

export const PAINTS = [
  { id: "white", name: "Bright White", hex: "#f2f3f5" },
  { id: "pearl-white", name: "Pearl White", hex: "#ece9e1", finish: "pearl" },
  { id: "silver", name: "Silver", hex: "#b9bec5" },
  { id: "gray", name: "Gunmetal Gray", hex: "#5d636b" },
  { id: "black", name: "Black", hex: "#16181c" },
  { id: "red", name: "Red", hex: "#b3121b" },
  { id: "dark-red", name: "Deep Red", hex: "#5e0e17" },
  { id: "orange", name: "Orange", hex: "#e2581d" },
  { id: "yellow", name: "Yellow", hex: "#f2c318" },
  { id: "green", name: "Forest Green", hex: "#244a35" },
  { id: "lime", name: "Lime Green", hex: "#7fbf2a" },
  { id: "sky", name: "Sky Blue", hex: "#5f9fd6" },
  { id: "blue", name: "Blue", hex: "#1f4fae" },
  { id: "navy", name: "Navy Blue", hex: "#17243f" },
  { id: "tan", name: "Desert Tan", hex: "#b59b77" },
  { id: "brown", name: "Brown", hex: "#5a3d2b" },
  { id: "bronze", name: "Bronze", hex: "#8a6a3d" },
  { id: "purple", name: "Purple", hex: "#4e2a7a" },
];

export const FINISHES = [
  { id: "metallic", name: "Metallic" },
  { id: "gloss", name: "Gloss" },
  { id: "pearl", name: "Pearl" },
  { id: "matte", name: "Matte" },
];

export const WHEELS = [
  { id: "silver", name: "Silver", hex: "#d5dbe2" },
  { id: "black", name: "Black", hex: "#1c1e22" },
  { id: "gunmetal", name: "Gunmetal", hex: "#4f555c" },
  { id: "bronze", name: "Bronze", hex: "#9a7443" },
  { id: "chrome", name: "Chrome", hex: "#f4f6f8" },
  { id: "white", name: "White", hex: "#eef0f2" },
];

export const ROOFS = [
  { id: "body", name: "Body Color" },
  { id: "black", name: "Black Roof" },
];

export const TINTS = [
  { id: "light", name: "Light" },
  { id: "medium", name: "Medium" },
  { id: "dark", name: "Dark" },
];

const HEX = /^#[0-9a-f]{6}$/i;
const ids = (list) => list.map((x) => x.id);

// A complete, safe look from whatever was saved (or nothing). `fallbackPaint` is the
// car's accent color, used until the owner picks a paint.
export function normalizeLook(saved, fallbackPaint = "#165ac0") {
  const a = saved && typeof saved === "object" ? saved : {};
  const pick = (value, list, dflt) => (ids(list).includes(value) ? value : dflt);
  return {
    paint: HEX.test(a.paint ?? "") ? a.paint.toLowerCase() : fallbackPaint,
    finish: pick(a.finish, FINISHES, "metallic"),
    wheels: pick(a.wheels, WHEELS, "silver"),
    roof: pick(a.roof, ROOFS, "body"),
    tint: pick(a.tint, TINTS, "medium"),
    rails: typeof a.rails === "boolean" ? a.rails : null,     // null = the body style's default
    spoiler: typeof a.spoiler === "boolean" ? a.spoiler : null,
  };
}

// The paint's name for display ("Forest Green", or "Custom #3a7bd5").
export function paintName(hex) {
  const p = PAINTS.find((x) => x.hex === String(hex).toLowerCase());
  return p ? p.name : `Custom ${String(hex).toUpperCase()}`;
}

// One line describing the look, e.g. "Forest Green Metallic · Black Wheels · Black Roof".
export function lookSummary(look) {
  const finish = FINISHES.find((f) => f.id === look.finish)?.name ?? "";
  const wheels = WHEELS.find((w) => w.id === look.wheels)?.name ?? "";
  return [
    `${paintName(look.paint)} ${finish}`.trim(),
    `${wheels} Wheels`,
    look.roof === "black" ? "Black Roof" : null,
    `${TINTS.find((t) => t.id === look.tint)?.name} Tint`,
  ].filter(Boolean).join(" · ");
}
