// Add Vehicle (/vehicles/new): brand, make, model, year and name, then Save or Cancel.
// Edit Vehicle (/vehicles/:id/edit) adds mileage and Delete.
import { createVehicle, updateVehicle, deleteVehicle, getVehicle } from "../data.js";
import { distanceUnit } from "../prefs.js";
import {
  appBar, escapeHtml, icon, loading, toast, confirmDialog, errorMessage, withBusy, toStoredMiles, fromStoredMiles,
} from "../ui.js";
import { BRANDS, COMMON_TRIMS, findBrand, findModel, modelsFor } from "../vehicleCatalog.js";

const BODY_NAMES = { sedan: "sedan", hatch: "hatchback", coupe: "coupe", suv: "SUV", truck: "pickup truck", van: "van" };

export default async function render(root, ctx) {
  const editing = Boolean(ctx.params.id);
  let v = {};
  if (editing) {
    root.innerHTML = loading();
    v = await getVehicle(ctx.params.id);
    if (!ctx.isCurrent()) return;
    if (!v) return ctx.navigate("#/garage", { replace: true });
  }
  const cancelHref = editing ? `#/vehicles/${v.id}` : "#/garage";

  const thisYear = new Date().getFullYear();
  const years = [];
  for (let y = thisYear + 1; y >= 1960; y--) years.push(y);

  root.innerHTML = `
    ${appBar({
      title: editing ? "Edit Vehicle" : "Add Vehicle",
      sub: editing ? "" : "Tell us about your car. You can change this later.",
      back: { href: cancelHref, label: "Back" },
    })}
    <form class="form content" novalidate>
      <label class="field">
        <span>Brand</span>
        <input name="brand" list="brands" required maxlength="40" placeholder="e.g. Honda" value="${escapeHtml(v.brand ?? "")}" autocomplete="off">
        <datalist id="brands">${BRANDS.map((b) => `<option value="${b}">`).join("")}</datalist>
      </label>
      <label class="field">
        <span>Make</span>
        <input name="make" list="makes" required maxlength="40" placeholder="e.g. Civic" value="${escapeHtml(v.make ?? "")}" autocomplete="off">
        <datalist id="makes"></datalist>
        <small class="hint" id="make-hint" aria-live="polite"></small>
      </label>
      <div class="field-row">
        <label class="field grow">
          <span>Model</span>
          <input name="model" list="trims" maxlength="40" placeholder="e.g. EX" value="${escapeHtml(v.model ?? "")}" autocomplete="off">
          <datalist id="trims">${COMMON_TRIMS.map((t) => `<option value="${escapeHtml(t)}">`).join("")}</datalist>
        </label>
        <label class="field">
          <span>Year</span>
          <select name="model_year" required>
            <option value="">Select</option>
            ${years.map((y) => `<option ${y === v.model_year ? "selected" : ""}>${y}</option>`).join("")}
          </select>
        </label>
      </div>
      <label class="field">
        <span>Vehicle Name <em>optional</em></span>
        <input name="vehicle_nickname" maxlength="40" placeholder="e.g. Daily Driver" value="${escapeHtml(v.vehicle_nickname ?? "")}">
        <small class="hint">Leave blank and it'll show as “Vehicle 1”, “Vehicle 2”, and so on.</small>
      </label>
      ${editing ? `
        <label class="field">
          <span>Current Mileage (${distanceUnit() === "km" ? "km" : "miles"}) <em>optional</em></span>
          <input name="current_mileage" type="number" inputmode="numeric" min="0" max="3000000" step="1" value="${fromStoredMiles(v.current_mileage)}">
        </label>` : ""}
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions">
        <a class="btn btn-ghost" href="${cancelHref}">Cancel</a>
        <button class="btn" type="submit">${editing ? "Save Changes" : "Save Vehicle"}</button>
      </div>
      ${editing ? `<div class="danger-zone"><button type="button" class="btn-text danger" id="delete-vehicle">${icon("trash", 16, 2)}Delete This Vehicle</button></div>` : ""}
    </form>`;

  const form = root.querySelector("form");
  const errEl = root.querySelector(".form-error");

  // Make suggestions follow the brand, and a hint confirms what we recognized.
  const brandInput = form.elements.brand;
  const makeInput = form.elements.make;
  const makeList = root.querySelector("#makes");
  const makeHint = root.querySelector("#make-hint");
  const syncMakes = () => {
    makeList.innerHTML = modelsFor(brandInput.value).map((m) => `<option value="${escapeHtml(m.name)}">`).join("");
  };
  const syncHint = () => {
    const brand = findBrand(brandInput.value);
    const model = brand && findModel(brand, makeInput.value);
    if (model) makeHint.textContent = `${brand} ${model.name} · ${BODY_NAMES[model.body]}`;
    else if (brand && makeInput.value.trim()) makeHint.textContent = `Not in our ${brand} list. That's fine if it's spelled right.`;
    else makeHint.textContent = "";
  };
  brandInput.addEventListener("input", () => { syncMakes(); syncHint(); });
  makeInput.addEventListener("input", syncHint);
  syncMakes();
  syncHint();
  const fail = (msg) => { errEl.textContent = msg; errEl.hidden = false; };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const f = Object.fromEntries(new FormData(form));
    // Use the catalog's spelling when we recognize the car ("honda crv" → "Honda CR-V"),
    // so brand-specific tips and the 3D shape match.
    const brand = findBrand(f.brand);
    const model = brand ? findModel(brand, f.make, { exact: true }) : null;
    const fields = {
      brand: brand ?? f.brand.trim(),
      make: model?.name ?? f.make.trim(),
      model: f.model.trim() || null,
      model_year: Number(f.model_year) || null,
      vehicle_nickname: f.vehicle_nickname.trim() || null,
    };
    if (editing) {
      const raw = f.current_mileage;
      if (raw !== "" && !(Number(raw) >= 0)) return fail("Mileage must be a positive number.");
      fields.current_mileage = raw === "" ? null : toStoredMiles(Number(raw));
    }
    if (!fields.brand) return fail("Enter the brand (for example, Honda).");
    if (!fields.make) return fail("Enter the make (for example, Civic).");
    if (!fields.model_year) return fail("Choose the year.");

    withBusy(form.querySelector("button[type=submit]"), async () => {
      try {
        if (editing) {
          await updateVehicle(v.id, fields);
          toast("Vehicle updated", "ok");
          ctx.navigate(`#/vehicles/${v.id}`, { replace: true });
        } else {
          const created = await createVehicle(fields);
          toast("Vehicle saved. We added its standard maintenance schedule.", "ok");
          ctx.navigate(`#/vehicles/${created.id}`, { replace: true });
        }
      } catch (err) {
        fail(errorMessage(err));
      }
    });
  });

  root.querySelector("#delete-vehicle")?.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: `Delete ${v.label}?`,
      body: "This permanently deletes the vehicle with all of its photos, tasks, receipts and history. This can't be undone.",
      confirmLabel: "Delete Vehicle",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteVehicle(v.id);
      toast("Vehicle deleted", "ok");
      ctx.navigate("#/garage", { replace: true });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  });
}
