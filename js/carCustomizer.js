// "Your Car in 3D": a card on the vehicle page and a customizer sheet with a live 3D
// preview, so the car on Home can match the real one (paint color and finish, wheels,
// roof, window tint, roof rails and spoiler). Saves to vehicles.appearance.
import { updateVehicle } from "./data.js";
import { mountCar3D } from "./car3d.js";
import { PAINTS, FINISHES, WHEELS, ROOFS, TINTS, normalizeLook, lookSummary, paintName } from "./carLook.js";
import { escapeHtml, icon, toast, errorMessage, withBusy, vehicleInkColor, bodyStyle } from "./ui.js";

// Body styles that come with roof rails or a spoiler unless the owner changes it.
const DEFAULT_RAILS = new Set(["suv"]);
const DEFAULT_SPOILER = new Set(["coupe"]);

export function lookCard(vehicle) {
  const look = normalizeLook(vehicle.appearance, vehicleInkColor(vehicle.index));
  return `
    <section class="card look-card">
      <div class="card-head">
        <h3>${icon("car", 18, 2)}Your Car in 3D</h3>
        <button type="button" class="btn btn-soft btn-sm" id="customize-look">${icon("edit", 15, 2)}Customize</button>
      </div>
      <div class="look-row">
        <span class="look-swatch finish-${look.finish}" style="--swatch:${look.paint}" aria-hidden="true"></span>
        <span class="look-text">
          <strong>${escapeHtml(paintName(look.paint))}</strong>
          <span>${escapeHtml(lookSummary(look).split(" · ").slice(1).join(" · "))}</span>
        </span>
      </div>
      ${vehicle.appearance ? "" : `<p class="hint">Match the paint, wheels and roof to your real car. It shows on Home.</p>`}
    </section>`;
}

export function openCustomizer(vehicle, { onSaved } = {}) {
  const fallback = vehicleInkColor(vehicle.index);
  const style = bodyStyle(vehicle);
  const look = normalizeLook(vehicle.appearance, fallback);
  if (look.rails === null) look.rails = DEFAULT_RAILS.has(style);
  if (look.spoiler === null) look.spoiler = DEFAULT_SPOILER.has(style);

  const dlg = document.createElement("dialog");
  dlg.className = "sheet customizer";
  const seg = (name, list) => `
    <div class="segmented" role="radiogroup" aria-label="${name}">
      ${list.map((x) => `<button type="button" role="radio" data-${name.toLowerCase()}="${x.id}" aria-checked="${look[name.toLowerCase()] === x.id}">${x.name}</button>`).join("")}
    </div>`;
  dlg.innerHTML = `
    <div class="sheet-body left">
      <div class="sheet-head">
        <h2>Customize Your Car</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close", 18, 2.2)}</button>
      </div>
      <div class="customizer-stage" aria-label="3D preview. Drag to turn the car.">
        <span class="customizer-loading">Loading 3D preview…</span>
      </div>
      <p class="customizer-summary" aria-live="polite"></p>

      <div class="custom-group">
        <span class="filter-label">Paint</span>
        <div class="paint-grid" role="radiogroup" aria-label="Paint color">
          ${PAINTS.map((p) => `<button type="button" role="radio" class="paint-chip" data-paint="${p.hex}" style="--swatch:${p.hex}" aria-label="${p.name}" title="${p.name}" aria-checked="false"></button>`).join("")}
          <label class="paint-chip paint-custom" title="Custom color">
            <input type="color" value="${look.paint}" aria-label="Custom paint color">
            ${icon("plus", 16, 2.4)}
          </label>
        </div>
      </div>
      <div class="custom-group"><span class="filter-label">Finish</span>${seg("Finish", FINISHES)}</div>
      <div class="custom-group">
        <span class="filter-label">Wheels</span>
        <div class="wheel-row" role="radiogroup" aria-label="Wheels">
          ${WHEELS.map((w) => `<button type="button" role="radio" class="wheel-chip" data-wheels="${w.id}" aria-checked="${look.wheels === w.id}"><span style="--swatch:${w.hex}"></span>${w.name}</button>`).join("")}
        </div>
      </div>
      <div class="custom-group"><span class="filter-label">Roof</span>${seg("Roof", ROOFS)}</div>
      <div class="custom-group"><span class="filter-label">Window Tint</span>${seg("Tint", TINTS)}</div>
      <div class="custom-group custom-toggles">
        <label class="toggle"><input type="checkbox" name="rails" ${look.rails ? "checked" : ""}><span class="toggle-ui"></span><span>Roof Rails</span></label>
        <label class="toggle"><input type="checkbox" name="spoiler" ${look.spoiler ? "checked" : ""}><span class="toggle-ui"></span><span>Rear Spoiler</span></label>
      </div>
      <p class="form-error" role="alert" hidden></p>
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-reset>Reset</button>
        <button type="button" class="btn" data-save>Save Look</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  let preview = null;
  let closed = false;
  dlg.addEventListener("close", () => {
    closed = true;
    preview?.destroy();
    dlg.remove();
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });

  const stage = dlg.querySelector(".customizer-stage");
  const summary = dlg.querySelector(".customizer-summary");
  const colorInput = dlg.querySelector("input[type=color]");
  const sync = () => {
    dlg.querySelectorAll("[data-paint]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.paint === look.paint)));
    dlg.querySelector(".paint-custom").classList.toggle("on", !PAINTS.some((p) => p.hex === look.paint));
    for (const key of ["finish", "wheels", "roof", "tint"]) {
      dlg.querySelectorAll(`[data-${key}]`).forEach((b) => b.setAttribute("aria-checked", String(b.dataset[key] === look[key])));
    }
    summary.textContent = lookSummary(look);
    preview?.setLook(look);
  };

  dlg.querySelectorAll("[data-paint]").forEach((b) => b.addEventListener("click", () => {
    look.paint = b.dataset.paint;
    const preset = PAINTS.find((p) => p.hex === look.paint);
    if (preset?.finish) look.finish = preset.finish; // pearl whites come as pearl
    colorInput.value = look.paint;
    sync();
  }));
  colorInput.addEventListener("input", () => { look.paint = colorInput.value.toLowerCase(); sync(); });
  for (const key of ["finish", "wheels", "roof", "tint"]) {
    dlg.querySelectorAll(`[data-${key}]`).forEach((b) => b.addEventListener("click", () => { look[key] = b.dataset[key]; sync(); }));
  }
  dlg.querySelector("[name=rails]").addEventListener("change", (e) => { look.rails = e.target.checked; sync(); });
  dlg.querySelector("[name=spoiler]").addEventListener("change", (e) => { look.spoiler = e.target.checked; sync(); });
  dlg.querySelector("[data-reset]").addEventListener("click", () => {
    Object.assign(look, normalizeLook(null, fallback), { rails: DEFAULT_RAILS.has(style), spoiler: DEFAULT_SPOILER.has(style) });
    colorInput.value = look.paint;
    dlg.querySelector("[name=rails]").checked = look.rails;
    dlg.querySelector("[name=spoiler]").checked = look.spoiler;
    sync();
  });

  const errEl = dlg.querySelector(".form-error");
  dlg.querySelector("[data-save]").addEventListener("click", (e) => withBusy(e.currentTarget, async () => {
    errEl.hidden = true;
    try {
      const saved = await updateVehicle(vehicle.id, { appearance: { ...look } });
      vehicle.appearance = saved.appearance ?? { ...look };
      toast("Look saved. You'll see it on Home.", "ok");
      dlg.close();
      onSaved?.(vehicle);
    } catch (err) {
      errEl.textContent = errorMessage(err);
      errEl.hidden = false;
    }
  }));

  dlg.showModal();
  sync();
  // The 3D preview loads after the sheet opens; the controls work right away.
  mountCar3D(stage, vehicle, fallback, { spin: false, angle: 0.75, look }).then((m) => {
    if (!m) {
      stage.querySelector(".customizer-loading").textContent = "3D preview isn't available on this device, but your choices still save.";
      return;
    }
    if (closed) return m.destroy();
    preview = m;
    stage.querySelector(".customizer-loading")?.remove();
    preview.setLook(look);
  });
}
