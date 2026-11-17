// How much a car is driven (vehicles.miles_per_year). The database uses it to space
// mileage-based tasks (oil, tire rotation, filters, brakes): each is due after its miles
// or its months, whichever comes first. See supabase/migrations/20261116_driving_schedule.sql.
import { distanceUnit } from "./prefs.js";
import { escapeHtml } from "./ui.js";

const KM_PER_MILE = 1.609344;
export const MAX_MILES_PER_YEAR = 150000;

export const DRIVING_LEVELS = [
  { key: "light", miles: 5000, name: "Light", detail: "Errands and short trips" },
  { key: "average", miles: 12000, name: "Average", detail: "A normal daily commute" },
  { key: "heavy", miles: 20000, name: "Heavy", detail: "Long commute or lots of road trips" },
  { key: "very-heavy", miles: 30000, name: "Very Heavy", detail: "Rideshare, delivery or driving for work" },
];

const km = () => distanceUnit() === "km";
const unit = () => (km() ? "km" : "mi");
// Miles shown in the person's unit, rounded to a friendly number.
const shown = (miles, step = 500) => Math.round((km() ? miles * KM_PER_MILE : miles) / step) * step;

export function levelFor(miles) {
  return DRIVING_LEVELS.find((l) => l.miles === miles) ?? null;
}

// "Average · about 12,000 mi a year", or "" when not set.
export function drivingLabel(miles) {
  if (miles == null) return "";
  const level = levelFor(miles);
  const amount = `${shown(miles, level ? 500 : 1).toLocaleString()} ${unit()} a year`;
  return level ? `${level.name} · about ${amount}` : `About ${amount}`;
}

// The "How much do you drive this car?" choices for the vehicle form.
export function drivingField(miles) {
  const level = levelFor(miles);
  const exact = miles != null && !level;
  const choice = (value, title, sub, checked) => `
    <label class="drive-option">
      <input type="radio" name="driving" value="${value}" ${checked ? "checked" : ""}>
      <span><strong>${title}</strong><small>${sub}</small></span>
    </label>`;
  return `
    <fieldset class="field drive-field">
      <legend>How Much Do You Drive This Car?</legend>
      <p class="hint">AutoPal uses this to time oil changes, tire rotations, filters and brake checks, by miles or months, whichever comes first.</p>
      <div class="drive-options">
        ${DRIVING_LEVELS.map((l) => choice(l.key, l.name,
          `${l.key === "very-heavy" ? `${shown(l.miles).toLocaleString()}+` : `About ${shown(l.miles).toLocaleString()}`} ${unit()} a year - ${l.detail}`,
          level?.key === l.key)).join("")}
        ${choice("exact", "I Know My Number", "Type how far you drive in a year", exact)}
      </div>
      <label class="field drive-exact" ${exact ? "" : "hidden"}>
        <span>${km() ? "Kilometers" : "Miles"} per Year</span>
        <input name="miles_per_year" type="number" inputmode="numeric" min="0" step="1"
          max="${shown(MAX_MILES_PER_YEAR, 1)}" value="${exact ? escapeHtml(String(shown(miles, 1))) : ""}">
      </label>
    </fieldset>`;
}

export function bindDrivingField(form) {
  const box = form.querySelector(".drive-exact");
  form.querySelectorAll("input[name=driving]").forEach((r) => r.addEventListener("change", () => {
    box.hidden = form.elements.driving.value !== "exact";
    if (!box.hidden) box.querySelector("input").focus();
  }));
}

// Reads the choice as stored miles per year. Returns { miles } or { error }.
export function readDrivingField(form) {
  const value = form.elements.driving?.value;
  if (!value) return { miles: null };
  if (value !== "exact") return { miles: DRIVING_LEVELS.find((l) => l.key === value).miles };
  const raw = form.elements.miles_per_year.value.trim();
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n) || n < 0) return { error: `Type how many ${km() ? "kilometers" : "miles"} you drive in a year.` };
  const miles = Math.round(km() ? n / KM_PER_MILE : n);
  if (miles > MAX_MILES_PER_YEAR) return { error: `That's more than ${shown(MAX_MILES_PER_YEAR, 1).toLocaleString()} ${unit()} a year. Check the number.` };
  return { miles };
}
