// Add Vehicle (/vehicles/new): brand, make, model, year and name, then Save or Cancel.
// Edit Vehicle (/vehicles/:id/edit) adds mileage and Delete.
// Brand, Make, Model (trim) and Year are chosen from the vehicle catalog only
// (js/vehicleCatalogData.js); each list narrows the next. The database checks the same
// catalog when a car is saved (supabase/migrations/20261111_vehicle_catalog.sql).
import { createVehicle, updateVehicle, deleteVehicle, getVehicle } from "../data.js";
import { distanceUnit } from "../prefs.js";
import {
  appBar, escapeHtml, icon, loading, toast, confirmDialog, errorMessage, withBusy, toStoredMiles, fromStoredMiles,
} from "../ui.js";
import { BRANDS, LATEST_YEAR, findBrand, findModel, makesFor, catalogProblem } from "../vehicleCatalog.js";

const BODY_NAMES = { sedan: "sedan", hatch: "hatchback", coupe: "coupe", suv: "SUV", truck: "pickup truck", van: "van" };
const NOT_SURE = ""; // the "Not Sure" model choice is saved as no model

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

  // A car saved before the catalog existed may not match it. Use the catalog's spelling
  // when we recognize it; otherwise keep the old value as a "current" choice, which may
  // stay as it is but can't be typed fresh.
  const saved = {
    brand: findBrand(v.brand) ?? v.brand ?? "",
    make: v.make ?? "",
    model: v.model ?? NOT_SURE,
    year: v.model_year ?? null,
  };
  if (BRANDS.includes(saved.brand)) saved.make = findModel(saved.brand, v.make, { exact: true })?.name ?? v.make ?? "";
  const state = { ...saved };

  root.innerHTML = `
    ${appBar({
      title: editing ? "Edit Vehicle" : "Add Vehicle",
      sub: editing ? "" : "Pick your car from the lists. You can change this later.",
      back: { href: cancelHref, label: "Back" },
    })}
    <form class="form content" novalidate>
      <label class="field">
        <span>Brand</span>
        <select name="brand" required></select>
      </label>
      <label class="field">
        <span>Make</span>
        <select name="make" required></select>
      </label>
      <div class="field-row">
        <label class="field grow">
          <span>Model</span>
          <select name="model"></select>
        </label>
        <label class="field">
          <span>Year</span>
          <select name="model_year" required></select>
        </label>
      </div>
      <p class="hint" id="car-hint" aria-live="polite"></p>
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
  const hintEl = root.querySelector("#car-hint");
  const { brand: brandSel, make: makeSel, model: modelSel, model_year: yearSel } = form.elements;

  const opt = (value, label, selected) => `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
  // The old, non-catalog value of a field, offered only while editing that same car.
  const legacy = (field, list) => editing && saved[field] && !list.includes(saved[field])
    ? opt(saved[field], `${saved[field]} (current, not in list)`, state[field] === saved[field]) : "";

  const make = () => findModel(state.brand, state.make, { exact: true });
  const draw = () => {
    brandSel.innerHTML = opt("", "Choose a brand", !state.brand) + legacy("brand", BRANDS)
      + BRANDS.map((b) => opt(b, b, b === state.brand)).join("");

    const makes = makesFor(state.brand).map((m) => m.name);
    makeSel.disabled = !state.brand;
    makeSel.innerHTML = opt("", state.brand ? `Choose a ${state.brand} make` : "Choose a brand first", !state.make)
      + (state.brand === saved.brand ? legacy("make", makes) : "")
      + makes.map((m) => opt(m, m, m === state.make)).join("");

    const m = make();
    const trims = m?.trims ?? [];
    modelSel.disabled = !state.make;
    modelSel.innerHTML = (state.make ? opt(NOT_SURE, "Not Sure", state.model === NOT_SURE) : opt("", "Choose a make first", true))
      + (state.make === saved.make ? legacy("model", [NOT_SURE, ...trims]) : "")
      + trims.map((t) => opt(t, t, t === state.model)).join("");

    // Years the make was sold, newest first. A legacy car keeps its saved year available.
    const years = [];
    if (m) for (let y = m.to; y >= m.from; y--) years.push(y);
    else if (state.make) for (let y = new Date().getFullYear() + 1; y >= 1960; y--) years.push(y);
    yearSel.disabled = !state.make;
    if (state.year && !years.includes(state.year)) state.year = null;
    yearSel.innerHTML = opt("", state.make ? "Select" : "—", !state.year)
      + years.map((y) => opt(String(y), String(y), y === state.year)).join("");

    hintEl.textContent = m ? `${state.brand} ${m.name} · ${BODY_NAMES[m.body]} · ${m.to >= LATEST_YEAR ? `sold since ${m.from}` : m.from === m.to ? `sold in ${m.from}` : `sold ${m.from}–${m.to}`}` : "";
  };

  brandSel.addEventListener("change", () => {
    state.brand = brandSel.value;
    state.make = "";
    state.model = NOT_SURE;
    draw();
  });
  makeSel.addEventListener("change", () => {
    state.make = makeSel.value;
    state.model = NOT_SURE;
    draw();
  });
  modelSel.addEventListener("change", () => { state.model = modelSel.value; });
  yearSel.addEventListener("change", () => { state.year = Number(yearSel.value) || null; });
  draw();

  const fail = (msg) => { errEl.textContent = msg; errEl.hidden = false; };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const fields = {
      brand: state.brand,
      make: state.make,
      model: state.model || null,
      model_year: state.year,
      vehicle_nickname: form.elements.vehicle_nickname.value.trim() || null,
    };
    if (editing) {
      const raw = form.elements.current_mileage.value;
      if (raw !== "" && !(Number(raw) >= 0)) return fail("Mileage must be a positive number.");
      fields.current_mileage = raw === "" ? null : toStoredMiles(Number(raw));
    }
    if (!fields.brand) return fail("Choose the brand (for example, Honda).");
    if (!fields.make) return fail("Choose the make (for example, Civic).");
    if (!fields.model_year) return fail("Choose the year.");
    // Anything new must come from the catalog. An older car left exactly as it was may stay.
    const unchanged = editing && fields.brand === v.brand && fields.make === v.make
      && (fields.model ?? "") === (v.model ?? "") && fields.model_year === v.model_year;
    if (!unchanged) {
      const problem = catalogProblem({ brand: fields.brand, make: fields.make, model: fields.model, year: fields.model_year });
      if (problem) return fail(problem);
    }

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
