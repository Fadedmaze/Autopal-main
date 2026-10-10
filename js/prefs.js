// Per-user and per-device display preferences.
// Units live on the profile (follow the user); theme lives in this browser only.

let unit = "mi";

export function distanceUnit() {
  return unit;
}

export function setDistanceUnit(value) {
  unit = value === "km" ? "km" : "mi";
}

const THEME_KEY = "autopal.theme";

export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme = getTheme()) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  else delete root.dataset.theme;
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch { /* storage blocked: theme still applies for this visit */ }
}
