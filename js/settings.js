// Settings menu (the tire button): appearance (this device), units (account),
// privacy and app information. Home draws its own tire button; on the other main pages app.js adds
// one to the page header (routes marked settings: true).
import { updateProfile } from "./data.js";
import { distanceUnit, setDistanceUnit, getTheme, applyTheme } from "./prefs.js";
import { icon, toast, errorMessage } from "./ui.js";

// Settings menu: appearance (this device), units (account), privacy and app info.
export function openSettings(profile = null) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  const theme = getTheme();
  const unit = distanceUnit();
  dlg.innerHTML = `
    <div class="sheet-body left">
      <div class="sheet-head">
        <h2>${icon("tire", 22, 1.8)}Settings</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close", 18, 2.2)}</button>
      </div>

      <div class="setting">
        <span class="setting-label">${icon("sun", 18, 2)}Appearance</span>
        <div class="segmented" role="radiogroup" aria-label="Appearance">
          ${[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) =>
            `<button type="button" role="radio" data-theme="${v}" aria-checked="${theme === v}">${l}</button>`).join("")}
        </div>
      </div>

      <div class="setting">
        <span class="setting-label">${icon("ruler", 18, 2)}Units</span>
        <div class="segmented" role="radiogroup" aria-label="Units">
          ${[["mi", "Miles"], ["km", "Kilometers"]].map(([v, l]) =>
            `<button type="button" role="radio" data-unit="${v}" aria-checked="${unit === v}">${l}</button>`).join("")}
        </div>
      </div>

      <details class="setting privacy">
        <summary><span class="setting-label">${icon("shield", 18, 2)}Privacy</span>${icon("chevron", 16, 2)}</summary>
        <ul>
          <li>Your vehicles, tasks, photos, receipts and profile picture are private to your account. Nobody else can see them.</li>
          <li>Your location is used only while you're on Find Mechanic, to sort shops by distance. It's never saved.</li>
          <li>Your email is used only for logging in and resetting your password.</li>
          <li>Appearance is remembered on this device only.</li>
          <li>To improve the app, we record how long you use it, how many pages you view and your device type (phone, tablet or computer). Never what you type.</li>
        </ul>
      </details>

      <details class="setting privacy">
        <summary><span class="setting-label">${icon("info", 18, 2)}About AutoPal</span>${icon("chevron", 16, 2)}</summary>
        <ul>
          <li>Version 17</li>
        </ul>
      </details>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => {
    dlg.remove();
    // Re-render so mileage etc. reflect a units change.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());

  dlg.querySelectorAll("[data-theme]").forEach((b) => b.addEventListener("click", () => {
    applyTheme(b.dataset.theme);
    dlg.querySelectorAll("[data-theme]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  }));
  dlg.querySelectorAll("[data-unit]").forEach((b) => b.addEventListener("click", async () => {
    const value = b.dataset.unit;
    if (value === distanceUnit()) return;
    const previous = distanceUnit();
    setDistanceUnit(value);
    dlg.querySelectorAll("[data-unit]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    try {
      await updateProfile({ distance_unit: value });
      if (profile) profile.distance_unit = value;
    } catch (err) {
      setDistanceUnit(previous);
      dlg.querySelectorAll("[data-unit]").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.unit === previous)));
      toast(errorMessage(err), "error");
    }
  }));
  dlg.showModal();
}
