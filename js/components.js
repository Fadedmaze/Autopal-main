// Markup + behavior reused across screens: task rows, the complete-task sheet
// (receipt upload + undo), vehicle cards and image preparation.
import { createTask, deleteTaskWithReceipt, setTaskCompleted, updateTask, uploadReceipt } from "./data.js";
import {
  escapeHtml, icon, dueLabel, dueTone, formatMoney, formatDate, formatMileage,
  vehicleIcon, vehicleSpec, vehicleTint, todayISO, toast, errorMessage, withBusy, confirmDialog,
} from "./ui.js";
import { remindLabel, remindShort } from "./reminders.js";

// One maintenance task row. The checkbox on the left completes / un-completes it.
// Overdue tasks are red (spec). `showCost` puts the estimate on the right (Budget).
export function taskRow(task, { vehicle = null, remindDays = 7, showCost = false, showReceipt = false, showDueDate = true, showTaskDetails = false, showCheckbox = true, showOverdueStyle = true } = {}) {
  const done = task.is_completed;
  // A task's own reminder window wins over the user's default (null = use the default).
  const tone = done ? "muted" : dueTone(task.due_date, task.remind_days_before ?? remindDays);
  const bell = task.remind_days_before != null
    ? `<span class="remind-hint" title="Reminder: ${escapeHtml(remindLabel(task.remind_days_before).toLowerCase())}">${icon("bell", 12, 2)}${remindShort(task.remind_days_before)}</span>`
    : "";
  const when = done ? `Completed ${formatDate(task.completed_date)}` : dueLabel(task.due_date);
  const right = showCost
    ? `<span class="task-cost">${task.estimated_cost !== null ? formatMoney(task.estimated_cost) : "—"}</span>`
    : showReceipt && task.receipt_path
      ? `<button type="button" class="receipt-chip" data-receipt="${escapeHtml(task.receipt_path)}">${icon("receipt", 15, 2)}Receipt</button>`
      : `<a class="task-edit" href="#/tasks/${task.id}" aria-label="Edit ${escapeHtml(task.task_name)}">${icon("chevron", 18, 2)}</a>`;
  const bodyTag = showTaskDetails ? "button" : "div";
  const bodyAttrs = showTaskDetails
    ? `type="button" data-task-details aria-label="View details for ${escapeHtml(task.task_name)}"`
    : "data-toggle";
  return `
    <li class="task ${done ? "done" : ""} ${showOverdueStyle && tone === "danger" ? "overdue" : ""}" data-task-id="${task.id}">
      ${showCheckbox ? `<label class="check" title="${done ? "Undo: mark as not done" : "Mark as completed"}">
        <input type="checkbox" ${done ? "checked" : ""} aria-label="${escapeHtml(task.task_name)} completed">
        <span class="check-box">${icon("check", 14, 3)}</span>
      </label>` : ""}
      <${bodyTag} class="task-body" ${bodyAttrs}>
        <span class="task-name">${escapeHtml(task.task_name)}</span>
        <span class="task-meta">
          ${showDueDate ? `<span class="tone-${tone}">${escapeHtml(when)}</span>` : ""}
          ${vehicle ? `<span class="dot-sep">${escapeHtml(vehicle.label)}</span>` : ""}
          ${bell}
        </span>
      </${bodyTag}>
      ${right}
    </li>`;
}

export function taskDetailsSheet(task, { onChanged } = {}) {
  const isCustomItem = task.catalog_id == null && task.due_date == null;
  const taskFormHref = () => {
    const params = new URLSearchParams({
      name: task.task_name,
      vehicle: String(task.vehicle_id),
    });
    if (task.estimated_cost != null) params.set("cost", String(task.estimated_cost));
    return `#/tasks/new?${params}`;
  };

  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.innerHTML = `
    <div class="sheet-body left">
      <div class="sheet-head">
        <h2 class="task-details-title">${escapeHtml(task.task_name)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close", 18, 2.2)}</button>
      </div>
      <form class="form task-price-form" data-price-form novalidate>
        <label class="field">
          <span>Estimated Cost</span>
          <span class="input-prefix"><span>$</span><input name="estimated_cost" type="number" inputmode="decimal" min="0" step="0.01" value="${task.estimated_cost ?? ""}" aria-label="Estimated Cost"></span>
        </label>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn" type="submit">Save Price</button>
      </form>
      <a class="fab sheet-add-task" data-add-task href="${taskFormHref()}">${icon("plus", 20, 2.6)}<span>Add Task</span></a>
      ${isCustomItem ? `<button class="btn btn-ghost danger" type="button" data-delete-custom>${icon("trash", 18, 2)}<span>Delete Custom Item</span></button>` : ""}
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  dlg.querySelector("[data-add-task]").addEventListener("click", () => dlg.close());
  const form = dlg.querySelector("[data-price-form]");
  const input = form.elements.estimated_cost;
  const error = form.querySelector(".form-error");
  const addTaskLink = dlg.querySelector("[data-add-task]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    const amount = raw === "" ? null : Number(raw);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      error.textContent = "Enter a valid cost of zero or more.";
      error.hidden = false;
      return;
    }
    withBusy(form.querySelector('[type="submit"]'), async () => {
      error.hidden = true;
      try {
        const saved = await updateTask(task.id, {
          estimated_cost: amount === null ? null : Math.round(amount * 100) / 100,
        });
        Object.assign(task, saved);
        addTaskLink.href = taskFormHref();
        toast("Price updated", "ok");
        try {
          await onChanged?.();
        } catch (err) {
          error.textContent = `Price saved, but the estimator couldn't refresh: ${errorMessage(err)}`;
          error.hidden = false;
        }
      } catch (err) {
        error.textContent = errorMessage(err);
        error.hidden = false;
      }
    });
  });
  dlg.querySelector("[data-delete-custom]")?.addEventListener("click", async (e) => {
    const button = e.currentTarget;
    const confirmed = await confirmDialog({
      title: "Delete Custom Item?",
      body: `“${task.task_name}” will be removed from this vehicle's maintenance estimate.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(button, async () => {
      try {
        await deleteTaskWithReceipt(task);
        dlg.close();
        toast("Custom item deleted", "ok");
        try {
          await onChanged?.();
        } catch (err) {
          toast(`Item deleted, but the estimator couldn't refresh: ${errorMessage(err)}`, "error");
        }
      } catch (err) {
        error.textContent = errorMessage(err);
        error.hidden = false;
      }
    });
  });
  dlg.showModal();
}

export function addCustomTaskSheet(vehicleId, { onCreated } = {}) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.innerHTML = `
    <div class="sheet-body left">
      <div class="sheet-head">
        <h2 class="task-details-title">Add Custom Item</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close", 18, 2.2)}</button>
      </div>
      <form class="form" data-custom-task-form novalidate>
        <label class="field">
          <span>Title</span>
          <input name="task_name" required maxlength="80" placeholder="e.g. Replace a part">
        </label>
        <label class="field">
          <span>Price</span>
          <span class="input-prefix"><span>$</span><input name="estimated_cost" type="number" inputmode="decimal" min="0" step="0.01" required placeholder="0.00"></span>
        </label>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn" type="submit">Add Custom</button>
      </form>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());

  const form = dlg.querySelector("[data-custom-task-form]");
  const error = form.querySelector(".form-error");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const taskName = form.elements.task_name.value.trim();
    const rawCost = form.elements.estimated_cost.value.trim();
    const cost = Number(rawCost);
    if (!taskName) {
      error.textContent = "Enter a title for this item.";
      error.hidden = false;
      return;
    }
    if (!rawCost || !Number.isFinite(cost) || cost < 0) {
      error.textContent = "Enter a valid price of zero or more.";
      error.hidden = false;
      return;
    }

    withBusy(form.querySelector('[type="submit"]'), async () => {
      error.hidden = true;
      try {
        await createTask({
          vehicle_id: vehicleId,
          task_name: taskName,
          estimated_cost: Math.round(cost * 100) / 100,
          due_date: null,
        });
        dlg.close();
        toast("Custom item added", "ok");
        try {
          await onCreated?.();
        } catch (err) {
          toast(`Item added, but the estimator couldn't refresh: ${errorMessage(err)}`, "error");
        }
      } catch (err) {
        error.textContent = errorMessage(err);
        error.hidden = false;
      }
    });
  });
  dlg.showModal();
}

// Wire task completion controls inside `root`; some views use the row body for
// navigation or task details instead. Completing opens the receipt/undo sheet.
// Views re-render into the same root, so bind once and just swap the callback.
const bound = new WeakMap();
export function bindTaskRows(root, tasksById, onChanged) {
  const already = bound.has(root);
  bound.set(root, { tasksById, onChanged });
  if (already) return;

  const toggle = async (row, box) => {
    const { tasksById: map, onChanged: cb } = bound.get(root);
    const task = map.get(Number(row.dataset.taskId));
    if (!task || box.disabled) return;
    const done = box.checked;
    box.disabled = true;
    try {
      const saved = await setTaskCompleted(task.id, done, todayISO());
      if (done) {
        await cb?.(saved);
        completedSheet(saved, { onChanged: cb });
      } else {
        toast("Moved back to Upcoming", "ok");
        await cb?.(saved);
      }
    } catch (err) {
      box.checked = !done;
      toast(errorMessage(err), "error");
    } finally {
      box.disabled = false;
    }
  };

  root.addEventListener("change", (e) => {
    const box = e.target.closest(".task input[type=checkbox]");
    if (box) toggle(box.closest(".task"), box);
  });
  root.addEventListener("click", (e) => {
    const body = e.target.closest(".task [data-toggle]");
    if (!body) return;
    const row = body.closest(".task");
    const box = row.querySelector("input[type=checkbox]");
    // Spec: clicking an upcoming task marks it completed. Completed ones need the checkbox (undo).
    if (row.classList.contains("done")) return;
    box.checked = true;
    toggle(row, box);
  });
}

// Bottom sheet after completing a task: upload a receipt, undo, or close.
export function completedSheet(task, { onChanged } = {}) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.innerHTML = `
    <div class="sheet-body">
      <div class="sheet-icon">${icon("check", 28, 2.6)}</div>
      <h2>${escapeHtml(task.task_name)} Completed</h2>
      <p>Want to attach a receipt? It's handy for warranty claims and resale.</p>
      <label class="btn">
        <input type="file" accept="image/*,application/pdf" hidden>
        ${icon("receipt", 18, 2)}<span>Upload Receipt</span>
      </label>
      <p class="form-error" role="alert" hidden></p>
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-undo>${icon("undo", 18, 2)}Undo</button>
        <button type="button" class="btn btn-soft" data-close>Done</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  const errEl = dlg.querySelector(".form-error");
  const input = dlg.querySelector("input[type=file]");
  const uploadLabel = dlg.querySelector("label.btn");

  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  dlg.querySelector("[data-undo]").addEventListener("click", (e) =>
    withBusy(e.currentTarget, async () => {
      try {
        await setTaskCompleted(task.id, false, null);
        dlg.close();
        toast("Undone. Back in Upcoming.", "ok");
        await onChanged?.();
      } catch (err) {
        errEl.textContent = errorMessage(err);
        errEl.hidden = false;
      }
    }));

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    errEl.hidden = true;
    uploadLabel.classList.add("busy");
    try {
      const prepared = await prepareUpload(file, { allowPdf: true });
      const saved = await uploadReceipt(task, prepared.blob, prepared.ext);
      Object.assign(task, saved);
      dlg.close();
      toast("Receipt saved", "ok");
      await onChanged?.();
    } catch (err) {
      // Spec: tell the user and let them try again (the button stays available).
      errEl.textContent = `Receipt upload failed: ${errorMessage(err)} Tap Upload Receipt to try again.`;
      errEl.hidden = false;
    } finally {
      uploadLabel.classList.remove("busy");
    }
  });

  dlg.showModal();
}

// Garage-style vehicle card with the radio/active treatment from the mockup.
export function vehicleCard(v, { selected = false, status = null } = {}) {
  const statusHtml = status
    ? `<span class="tone-${status.tone}">${status.tone !== "muted" ? "● " : ""}${escapeHtml(status.text)}</span>`
    : "";
  return `
    <button class="car ${selected ? "selected" : ""}" type="button" data-vehicle-id="${v.id}" style="${vehicleTint(v.index)}" aria-pressed="${selected}">
      <span class="car-icon">${vehicleIcon(v)}</span>
      <span class="car-text">
        <span class="car-name">${escapeHtml(v.label)}${v.unnamed ? ' <span class="tag">No Name</span>' : ""}</span>
        <span class="car-meta">${escapeHtml(vehicleSpec(v))}</span>
        <span class="car-stats">
          ${v.current_mileage !== null ? `<span>${formatMileage(v.current_mileage)}</span>` : ""}
          ${statusHtml}
        </span>
        <span class="viewing">Showing on Home</span>
      </span>
      <span class="radio">${icon("check", 12, 3)}</span>
    </button>`;
}

// "Oil change due" / "2 tasks overdue" / "Up to date", from the vehicle's open tasks.
export function vehicleStatus(v, openTasks, remindDays = 7) {
  const today = todayISO();
  const mine = openTasks.filter((t) => t.vehicle_id === v.id && t.due_date);
  const overdue = mine.filter((t) => t.due_date < today);
  if (overdue.length > 1) return { tone: "danger", text: `${overdue.length} tasks overdue` };
  if (overdue.length === 1) return { tone: "danger", text: `${overdue[0].task_name} overdue` };
  const soon = mine.find((t) => dueTone(t.due_date, t.remind_days_before ?? remindDays) === "warn");
  if (soon) return { tone: "warn", text: `${soon.task_name} due` };
  return { tone: "muted", text: "Up to date" };
}

// Downscale photos to JPEG when the browser can decode them; pass PDFs and
// undecodable formats (e.g. HEIC outside Safari) through unchanged.
export async function prepareUpload(file, { maxEdge = 1600, allowPdf = false } = {}) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (!allowPdf) throw new Error("Please choose an image.");
    return check({ blob: file, ext: "pdf" });
  }
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    throw new Error("That file isn't an image.");
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (blob) return check({ blob, ext: "jpg" });
  } catch { /* fall through to the original file */ }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return check({ blob: file, ext });

  function check(out) {
    if (out.blob.size > 10 * 1024 * 1024) throw new Error("That file is larger than 10 MB.");
    return out;
  }
}
