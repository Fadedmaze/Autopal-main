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
        <summary><span class="setting-label">${icon("info", 18, 2)}Terms of Use</span>${icon("chevron", 16, 2)}</summary>
        <div class="terms-copy">
          <p><strong>Effective date:</strong> November 17, 2026 · <strong>Operated by:</strong> Team 9 · <strong>Contact:</strong> autopalsupport@gmail.com</p>
          <p>By creating an account or using AutoPal, you agree to these terms. If you don’t agree, don’t use the service.</p>

          <h3>What AutoPal does</h3>
          <p>AutoPal helps you organize vehicle information, maintenance tasks, reminders, warning-light information, and mechanic listings. You’re responsible for the accuracy of the information you enter and for deciding what maintenance your vehicle needs.</p>

          <h3>Automotive information and safety</h3>
          <p>Maintenance schedules, cost estimates, guides, and warning-light scan results are for general information only. They are not a diagnosis, repair instruction, or guarantee of safety. Follow your owner’s manual and consult a qualified mechanic. Don’t rely on AutoPal for emergencies or continue driving if your vehicle may be unsafe.</p>

          <h3>Mechanic listings</h3>
          <p>Shop information, ratings, and prices may be incomplete or out of date. AutoPal does not guarantee a shop’s services, availability, prices, or work.</p>

          <h3>Your account and uploads</h3>
          <p>Keep your login information secure. You retain ownership of photos and other content you upload, and allow AutoPal to store and use that content to provide the service.</p>

          <h3>Reminders and availability</h3>
          <p>Reminders may be delayed or may not arrive. AutoPal may change, suspend, or discontinue features.</p>

          <h3>Acceptable use</h3>
          <p>Don’t misuse AutoPal, interfere with its operation, access another person’s account or data, or use it unlawfully.</p>

          <h3>Disclaimers and liability</h3>
          <p>To the extent permitted by law, AutoPal is provided “as is.” To the extent permitted by law, Team 9 is not responsible for indirect or consequential losses arising from use of the service. These terms don’t limit rights that can’t legally be limited.</p>

          <h3>Changes and contact</h3>
          <p>We may update these terms by posting a new version with an updated effective date. Questions? Contact autopalsupport@gmail.com.</p>
        </div>
      </details>

      <details class="setting privacy">
        <summary><span class="setting-label">${icon("info", 18, 2)}About AutoPal</span>${icon("chevron", 16, 2)}</summary>
        <ul>
          <li>Version 17</li>
        </ul>
      </details>

      <details class="setting privacy">
        <summary><span class="setting-label">${icon("help", 18, 2)}Support</span>${icon("chevron", 16, 2)}</summary>
        <ul>
          <li><a href="mailto:autopalsupport@gmail.com">autopalsupport@gmail.com</a></li>
        </ul>
      </details>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => {
    dlg.remove();
    // Only a units change needs the screen redrawn (mileage, distances). Appearance
    // applies instantly, and closing without changes leaves the page as it was.
    if (distanceUnit() !== unit) window.dispatchEvent(new HashChangeEvent("hashchange"));
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
