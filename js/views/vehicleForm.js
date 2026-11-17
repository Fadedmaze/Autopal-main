// Add Vehicle (/vehicles/new): make, model, year, trim and name, then Save or Cancel.
// Edit Vehicle (/vehicles/:id/edit) adds Delete. Both forms accept current mileage and
// ask how much the car is driven, which times its mileage-based tasks (js/driving.js).
// Make (Honda), Model (Civic), Year and Trim (EX) are chosen from the vehicle catalog only
// (js/vehicleCatalogData.js); each list narrows the next, and Trim shows only the trims
// sold that year. The database checks the same catalog when a car is saved
// (supabase/migrations/20261111_vehicle_catalog.sql). In the database these are still
// called brand, make, model (trim) and model_year.
import { createVehicle, updateVehicle, deleteVehicle, getVehicle } from "../data.js";
import { distanceUnit } from "../prefs.js";
import {
  appBar, escapeHtml, icon, loading, toast, confirmDialog, errorMessage, withBusy, toStoredMiles, fromStoredMiles,
} from "../ui.js";
import { drivingField, bindDrivingField, readDrivingField } from "../driving.js";
import { BRANDS, LATEST_YEAR, findBrand, findModel, makesFor, trimInYear, soldIn, yearsText, catalogProblem } from "../vehicleCatalog.js";

const BODY_NAMES = { sedan: "sedan", hatch: "hatchback", coupe: "coupe", suv: "SUV", truck: "pickup truck", van: "van" };
const NOT_SURE = ""; // the "Not Sure" model choice is saved as no model

function searchablePicker(input, listbox, onInput, onSelect) {
  let items = [];
  const close = () => {
    listbox.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };
  const show = () => {
    const query = input.value.trim().toLocaleLowerCase();
    const matches = items.filter((item) => item.label.toLocaleLowerCase().includes(query));
    listbox.innerHTML = matches.map((item, index) => {
      const id = `${input.name}-option-${index}`;
      return `<button type="button" role="option" aria-selected="false" id="${id}" data-picker-value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
    }).join("");
    listbox.hidden = !matches.length;
    input.setAttribute("aria-expanded", String(matches.length > 0));
  };
  input.addEventListener("focus", show);
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("input", () => { onInput(input.value); show(); });
  input.addEventListener("keydown", (event) => {
    const options = [...listbox.querySelectorAll("[data-picker-value]")];
    const active = input.getAttribute("aria-activedescendant");
    const activeIndex = options.findIndex((option) => option.id === active);
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (activeIndex + direction + options.length) % options.length;
      const next = options[nextIndex];
      options.forEach((option) => option.setAttribute("aria-selected", String(option === next)));
      input.setAttribute("aria-activedescendant", next.id);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const option = options[activeIndex];
      const item = items.find((entry) => String(entry.value) === option.dataset.pickerValue);
      if (item) {
        input.value = item.label;
        close();
        onSelect(item.value);
      }
    } else if (event.key === "Escape") close();
  });
  listbox.addEventListener("mousedown", (event) => event.preventDefault());
  listbox.addEventListener("click", (event) => {
    const option = event.target.closest("[data-picker-value]");
    if (!option) return;
    const item = items.find((entry) => String(entry.value) === option.dataset.pickerValue);
    if (!item) return;
    input.value = item.label;
    close();
    onSelect(item.value);
  });
  return {
    close,
    setItems(next) { items = next; if (input.getAttribute("aria-expanded") === "true") show(); else close(); },
    setValue(value) { input.value = value ?? ""; },
  };
}

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
      sub: editing ? "" : "Pick your vehicle from the lists - You can edit this later",
      back: { href: cancelHref, label: "Back" },
    })}
      <form class="form content vehicle-form" novalidate>
      <label class="field">
        <span>Make</span>
        <input name="brand" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="brand-options" autocomplete="off" required>
        <div class="vehicle-make-options" id="brand-options" role="listbox" hidden></div>
      </label>
      <label class="field">
        <span>Model</span>
        <input name="make" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="model-options" autocomplete="off" required>
        <div class="vehicle-make-options" id="model-options" role="listbox" hidden></div>
      </label>
      <div class="vehicle-year-trim-card">
      <div class="field-row">
        <label class="field">
          <span>Year</span>
          <input name="model_year" type="text" inputmode="numeric" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="year-options" autocomplete="off" required>
          <div class="vehicle-make-options" id="year-options" role="listbox" hidden></div>
        </label>
    
        <label class="field grow">
          <span>Trim</span>
          <input name="model" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="trim-options" autocomplete="off">
          <div class="vehicle-make-options" id="trim-options" role="listbox" hidden></div>
        </label>
      </div>
    
      <p class="hint" id="car-hint" aria-live="polite"></p>
    </div>
      <label class="field">
        <span>Vehicle Name <em>(optional)</em></span>
        <input name="vehicle_nickname" maxlength="40" placeholder="e.g. Daily Driver" value="${escapeHtml(v.vehicle_nickname ?? "")}">
        <small class="hint">Leave blank and it'll show as “Vehicle 1”, “Vehicle 2”, and so on.</small>
      </label>
      <label class="field">
        <span>Current Mileage (${distanceUnit() === "km" ? "km" : "miles"}) <em>(optional)</em></span>
        <input name="current_mileage" type="number" inputmode="numeric" min="0" max="3000000" step="1" value="${fromStoredMiles(v.current_mileage)}">
        <small class="hint">You can add or update this anytime</small>
      </label>
      ${drivingField(editing ? v.miles_per_year : 12000)}
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
  const brandOptions = form.querySelector("#brand-options");
  const makePicker = searchablePicker(makeSel, form.querySelector("#model-options"), (value) => {
    state.make = "";
    state.model = NOT_SURE;
    state.year = null;
    draw("make");
  }, (value) => {
    state.make = String(value);
    state.model = NOT_SURE;
    state.year = null;
    draw();
  });
  const yearPicker = searchablePicker(yearSel, form.querySelector("#year-options"), () => {
    state.year = null;
    draw("model_year");
  }, (value) => {
    state.year = Number(value) || null;
    draw();
  });
  const trimPicker = searchablePicker(modelSel, form.querySelector("#trim-options"), (value) => {
    state.model = value;
    draw("model");
  }, (value) => {
    state.model = String(value);
    draw();
  });

  const closeBrandOptions = () => {
    brandOptions.hidden = true;
    brandSel.setAttribute("aria-expanded", "false");
    brandSel.removeAttribute("aria-activedescendant");
  };
  const showBrandOptions = () => {
    const query = brandSel.value.trim().toLocaleLowerCase();
    const matches = BRANDS.filter((brand) => brand.toLocaleLowerCase().includes(query));
    brandOptions.innerHTML = matches.map((brand, index) =>
      `<button type="button" role="option" aria-selected="false" id="brand-option-${index}" data-brand-option="${escapeHtml(brand)}">${escapeHtml(brand)}</button>`
    ).join("");
    brandOptions.hidden = !matches.length;
    brandSel.setAttribute("aria-expanded", String(matches.length > 0));
  };
  const chooseBrand = (brand) => {
    if (!BRANDS.includes(brand)) return;
    state.brand = brand;
    state.make = "";
    state.model = NOT_SURE;
    state.year = null;
    brandSel.value = brand;
    closeBrandOptions();
    draw();
  };

  const make = () => findModel(state.brand, state.make, { exact: true });
  const draw = (preserveInput = null) => {
    const makes = makesFor(state.brand).map((m) => m.name);
    makeSel.disabled = !state.brand;
    makePicker.setItems([
      ...(state.brand === saved.brand && saved.make && !makes.includes(saved.make) ? [{ value: saved.make, label: `${saved.make} (current, not in list)` }] : []),
      ...makes.map((m) => ({ value: m, label: m })),
    ]);
    if (preserveInput !== "make") makePicker.setValue(state.make);

    const m = make();

    // Years the model was sold, newest first. A legacy car keeps its saved year available.
    const years = [];
    if (m) for (let y = m.to; y >= m.from; y--) { if (soldIn(m, y)) years.push(y); }
    else if (state.make) for (let y = new Date().getFullYear() + 1; y >= 1960; y--) years.push(y);
    yearSel.disabled = !state.make;
    if (state.year && !years.includes(state.year)) state.year = null;
    yearPicker.setItems(years.map((y) => ({ value: String(y), label: String(y) })));
    if (preserveInput !== "model_year") yearPicker.setValue(state.year ? String(state.year) : "");

    // Trims offered that year (all of the model's trims until a year is picked).
    const trims = (m?.trims ?? []).filter((t) => trimInYear(m, t, state.year));
    const keepSaved = state.make === saved.make && state.model === saved.model && state.model !== NOT_SURE;
    if (preserveInput !== "model" && state.model !== NOT_SURE && !trims.includes(state.model) && !keepSaved) state.model = NOT_SURE;
    modelSel.disabled = !state.make;
    trimPicker.setItems([
      { value: NOT_SURE, label: "Not Sure" },
      ...(state.make === saved.make && saved.model && !trims.includes(saved.model) ? [{ value: saved.model, label: `${saved.model} (current, not in list)` }] : []),
      ...trims.map((t) => ({ value: t, label: t })),
    ]);
    if (preserveInput !== "model") trimPicker.setValue(state.model === NOT_SURE ? "Not Sure" : state.model);

    hintEl.textContent = m ? `${state.brand} ${m.name} · ${BODY_NAMES[m.body]} · ${m.to >= LATEST_YEAR ? `sold since ${m.years.at(-1)[0]}${m.years.length > 1 ? ` (also ${yearsText({ years: m.years.slice(0, -1) })})` : ""}` : `sold ${yearsText(m)}`}` : "";
  };

  brandSel.value = state.brand;
  brandSel.addEventListener("focus", showBrandOptions);
  brandSel.addEventListener("blur", () => setTimeout(closeBrandOptions, 120));
  brandSel.addEventListener("input", () => {
    state.brand = "";
    state.make = "";
    state.model = NOT_SURE;
    state.year = null;
    showBrandOptions();
    draw();
  });
  brandSel.addEventListener("keydown", (event) => {
    const options = [...brandOptions.querySelectorAll("[data-brand-option]")];
    const active = brandSel.getAttribute("aria-activedescendant");
    const activeIndex = options.findIndex((option) => option.id === active);
    if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      const next = options[(activeIndex + 1) % options.length];
      options.forEach((option) => option.setAttribute("aria-selected", String(option === next)));
      brandSel.setAttribute("aria-activedescendant", next.id);
    } else if (event.key === "ArrowUp" && options.length) {
      event.preventDefault();
      const next = options[(activeIndex <= 0 ? options.length : activeIndex) - 1];
      options.forEach((option) => option.setAttribute("aria-selected", String(option === next)));
      brandSel.setAttribute("aria-activedescendant", next.id);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      chooseBrand(options[activeIndex].dataset.brandOption);
    } else if (event.key === "Escape") {
      closeBrandOptions();
    }
  });
  brandOptions.addEventListener("mousedown", (event) => event.preventDefault());
  brandOptions.addEventListener("click", (event) => {
    const option = event.target.closest("[data-brand-option]");
    if (option) chooseBrand(option.dataset.brandOption);
  });
  draw();
  bindDrivingField(form);

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
    const rawMileage = form.elements.current_mileage.value;
    if (rawMileage !== "" && !(Number(rawMileage) >= 0 && Number(rawMileage) <= 3000000)) {
      return fail("Mileage must be between 0 and 3,000,000.");
    }
    fields.current_mileage = rawMileage === "" ? null : toStoredMiles(Number(rawMileage));
    const driving = readDrivingField(form);
    if (driving.error) return fail(driving.error);
    fields.miles_per_year = driving.miles;
    if (!fields.brand) return fail("Choose the make (for example, Honda).");
    if (!fields.make) return fail("Choose the model (for example, Civic).");
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
          toast(fields.miles_per_year !== (v.miles_per_year ?? null)
            ? "Vehicle updated. Its maintenance schedule now fits how much you drive."
            : "Vehicle updated", "ok");
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
