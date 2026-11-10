// Create a custom task (name + due date required, notes optional), or edit one.
import { listVehicles, getTask, createTask, updateTask, deleteTaskWithReceipt, getSettings } from "../data.js";
import { appBar, escapeHtml, icon, loading, toast, confirmDialog, errorMessage, withBusy } from "../ui.js";
import { REMIND_CHOICES, MAX_REMIND_DAYS, remindLabel, reminderPreview, buildIcs, downloadIcs } from "../reminders.js";

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const editing = Boolean(ctx.params.id);
  const [vehicles, task, settings] = await Promise.all([
    listVehicles(),
    editing ? getTask(ctx.params.id) : Promise.resolve(null),
    getSettings(),
  ]);
  if (!ctx.isCurrent()) return;
  if (editing && !task) {
    toast("That task doesn't exist anymore.", "error");
    return ctx.navigate("#/tasks", { replace: true });
  }
  if (!vehicles.length) {
    toast("Add a vehicle first.", "info");
    return ctx.navigate("#/vehicles/new", { replace: true });
  }

  const presetVehicle = Number(ctx.query.get("vehicle")) || null;
  // Coming from a Library guide: ?name= prefills the task, ?guide= is where Back and Cancel return.
  const presetName = (ctx.query.get("name") ?? "").trim().slice(0, 80);
  const fromGuide = /^[a-z0-9-]+$/.test(ctx.query.get("guide") ?? "") ? ctx.query.get("guide") : null;
  const backLink = !editing && fromGuide
    ? { href: `#/library/${fromGuide}`, label: "Guide" }
    : { href: "#/tasks", label: "Tasks" };
  // From a mechanic shop (Find a Mechanic → "Add to my tasks"): the shop and the estimate.
  const presetShop = Number(ctx.query.get("shop")) || null;
  const costParam = ctx.query.get("cost");
  const parsedCost = costParam === null || costParam.trim() === "" ? NaN : Number(costParam);
  const presetCost = Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : null;
  const presetNotes = (ctx.query.get("notes") ?? "").slice(0, 1000);
  const t = task ?? {
    vehicle_id: vehicles.some((v) => v.id === presetVehicle) ? presetVehicle : vehicles[0].id,
    task_name: presetName,
    due_date: "",
    estimated_cost: presetCost,
    notes: presetNotes,
    shop_id: presetShop,
    remind_days_before: null,
  };
  if (!editing && ctx.query.get("from") === "mechanics") {
    backLink.href = "#/mechanics";
    backLink.label = "Map";
  }
  const defaultDays = settings.reminder_days_before;
  // A saved value that isn't one of the presets shows as "Custom".
  const isPreset = (d) => d == null || REMIND_CHOICES.some(([x]) => x === d);

  root.innerHTML = `
    ${appBar({ title: editing ? "Edit Task" : "New Task", sub: editing ? "" : "Add maintenance that isn't already on your list.", back: backLink })}
    <form class="form content" novalidate>
      ${vehicles.length > 1 ? `
        <label class="field">
          <span>Vehicle</span>
          <select name="vehicle_id">
            ${vehicles.map((v) => `<option value="${v.id}" ${v.id === t.vehicle_id ? "selected" : ""}>${escapeHtml(v.label)}</option>`).join("")}
          </select>
        </label>` : `<input type="hidden" name="vehicle_id" value="${t.vehicle_id}">`}
      <label class="field">
        <span>Task Name</span>
        <input name="task_name" required maxlength="80" placeholder="e.g. Replace headlight bulb" value="${escapeHtml(t.task_name)}">
      </label>
      <label class="field">
        <span>Due Date</span>
        <input name="due_date" type="date" required value="${escapeHtml(t.due_date ?? "")}">
      </label>
      <label class="field">
        <span>Notes <em>optional</em></span>
        <textarea name="notes" rows="3" maxlength="1000" placeholder="Part numbers, which shop, anything to remember">${escapeHtml(t.notes ?? "")}</textarea>
      </label>
      <div class="field remind-field">
        <label for="remind-select"><span>Remind Me</span></label>
        <div class="remind-row">
          <select id="remind-select" name="remind_choice">
            <option value="" ${t.remind_days_before == null ? "selected" : ""}>Default (${escapeHtml(remindLabel(defaultDays).toLowerCase())})</option>
            ${REMIND_CHOICES.map(([d, label]) => `<option value="${d}" ${t.remind_days_before === d ? "selected" : ""}>${label}</option>`).join("")}
            <option value="custom" ${isPreset(t.remind_days_before) ? "" : "selected"}>Custom…</option>
          </select>
          <span class="remind-custom" ${isPreset(t.remind_days_before) ? "hidden" : ""}>
            <input name="remind_custom" type="number" inputmode="numeric" min="0" max="${MAX_REMIND_DAYS}" step="1" aria-label="Days before the due date" value="${isPreset(t.remind_days_before) ? "" : t.remind_days_before}">
            <span>days before</span>
          </span>
        </div>
        <p class="hint remind-preview" id="remind-preview" aria-live="polite"></p>
        ${editing && !task.is_completed ? `<button type="button" class="btn-text" id="add-calendar">${icon("calendar", 16, 2)}Add to My Calendar with This Reminder</button>` : ""}
      </div>
      <label class="field">
        <span>Estimated Cost <em>optional, used in Maintenance Estimator</em></span>
        <span class="input-prefix"><span>$</span><input name="estimated_cost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" value="${t.estimated_cost ?? ""}"></span>
      </label>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions">
        <a class="btn btn-ghost" href="${backLink.href}">Cancel</a>
        <button class="btn" type="submit">${editing ? "Save Changes" : "Add Task"}</button>
      </div>
      ${editing ? `<div class="danger-zone"><button type="button" class="btn-text danger" id="delete-task">${icon("trash", 16, 2)}Delete Task</button></div>` : ""}
    </form>`;

  const form = root.querySelector("form");
  if (!editing && presetName) form.elements.due_date.focus();
  const errEl = root.querySelector(".form-error");
  const fail = (msg) => { errEl.textContent = msg; errEl.hidden = false; };

  // Reminder: the chosen number of days (null = default), or NaN for a bad custom value.
  const choice = form.elements.remind_choice;
  const customWrap = root.querySelector(".remind-custom");
  const previewEl = root.querySelector("#remind-preview");
  const chosenDays = () => {
    if (choice.value === "") return null;
    if (choice.value !== "custom") return Number(choice.value);
    const raw = form.elements.remind_custom.value.trim();
    const n = Number(raw);
    return raw !== "" && Number.isInteger(n) && n >= 0 && n <= MAX_REMIND_DAYS ? n : NaN;
  };
  const updatePreview = () => {
    customWrap.hidden = choice.value !== "custom";
    const days = chosenDays();
    previewEl.classList.remove("tone-danger");
    if (Number.isNaN(days)) {
      previewEl.textContent = `Enter a whole number of days from 0 to ${MAX_REMIND_DAYS}.`;
      previewEl.classList.add("tone-danger");
      return;
    }
    previewEl.textContent = reminderPreview(form.elements.due_date.value, days ?? defaultDays, { enabled: settings.task_reminders_enabled });
  };
  choice.addEventListener("change", () => {
    updatePreview();
    if (choice.value === "custom") form.elements.remind_custom.focus();
  });
  form.elements.remind_custom.addEventListener("input", updatePreview);
  form.elements.due_date.addEventListener("input", updatePreview);
  form.elements.due_date.addEventListener("change", updatePreview);
  updatePreview();

  // Calendar export uses what's on screen (even before saving), so the alarm matches the choice.
  root.querySelector("#add-calendar")?.addEventListener("click", () => {
    const days = chosenDays();
    if (Number.isNaN(days)) return fail(`Enter a whole number of reminder days from 0 to ${MAX_REMIND_DAYS}.`);
    const due = form.elements.due_date.value;
    if (!due) return fail("Pick a due date first.");
    const draft = { ...task, task_name: form.elements.task_name.value.trim() || task.task_name, due_date: due, remind_days_before: days, notes: form.elements.notes.value.trim() || null };
    downloadIcs(buildIcs([draft], { defaultDays, vehicles }), `${draft.task_name.replace(/[^\w-]+/g, "-").toLowerCase() || "task"}.ics`);
    toast("Calendar file downloaded. Open it to add the reminder.", "ok");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const f = Object.fromEntries(new FormData(form));
    const fields = {
      vehicle_id: Number(f.vehicle_id),
      task_name: f.task_name.trim(),
      due_date: f.due_date || null,
      notes: f.notes.trim() || null,
      remind_days_before: chosenDays(),
      estimated_cost: f.estimated_cost === "" ? null : Math.round(Number(f.estimated_cost) * 100) / 100,
    };
    const missing = [!fields.task_name && "a task name", !fields.due_date && "a due date"].filter(Boolean);
    if (missing.length) return fail(`Please enter ${missing.join(" and ")}. ${missing.length > 1 ? "Both are" : "It's"} required.`);
    if (fields.estimated_cost !== null && !(fields.estimated_cost >= 0)) return fail("Cost must be zero or more.");
    if (Number.isNaN(fields.remind_days_before)) return fail(`Reminder days must be a whole number from 0 to ${MAX_REMIND_DAYS}.`);
    if (!editing && t.shop_id) fields.shop_id = t.shop_id;

    withBusy(form.querySelector("button[type=submit]"), async () => {
      try {
        if (editing) await updateTask(task.id, fields);
        else await createTask(fields);
        toast(editing ? "Task updated" : "Task added", "ok");
        ctx.navigate("#/tasks", { replace: true });
      } catch (err) {
        fail(errorMessage(err));
      }
    });
  });

  root.querySelector("#delete-task")?.addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Delete This Task?", body: `“${task.task_name}” and any receipt attached to it will be removed.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await deleteTaskWithReceipt(task);
      toast("Task deleted", "ok");
      ctx.navigate("#/tasks", { replace: true });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  });
}
