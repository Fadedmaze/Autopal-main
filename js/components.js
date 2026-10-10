// Markup + behavior reused across screens: task rows, the complete-task sheet
// (receipt upload + undo), vehicle cards and image preparation.
import { setTaskCompleted, uploadReceipt } from "./data.js";
import {
  escapeHtml, icon, dueLabel, dueTone, formatMoney, formatDate, formatMileage,
  vehicleIcon, vehicleSpec, vehicleTint, todayISO, toast, errorMessage, withBusy,
} from "./ui.js";

// One maintenance task row. The checkbox on the left completes / un-completes it.
// Overdue tasks are red (spec). `showCost` puts the estimate on the right (Budget).
export function taskRow(task, { vehicle = null, remindDays = 7, showCost = false, showReceipt = false } = {}) {
  const done = task.is_completed;
  const tone = done ? "muted" : dueTone(task.due_date, remindDays);
  const when = done ? `Completed ${formatDate(task.completed_date)}` : dueLabel(task.due_date);
  const right = showCost
    ? `<span class="task-cost">${task.estimated_cost !== null ? formatMoney(task.estimated_cost) : "—"}</span>`
    : showReceipt && task.receipt_path
      ? `<button type="button" class="receipt-chip" data-receipt="${escapeHtml(task.receipt_path)}">${icon("receipt", 15, 2)}Receipt</button>`
      : `<a class="task-edit" href="#/tasks/${task.id}" aria-label="Edit ${escapeHtml(task.task_name)}">${icon("chevron", 18, 2)}</a>`;
  return `
    <li class="task ${done ? "done" : ""} ${tone === "danger" ? "overdue" : ""}" data-task-id="${task.id}">
      <label class="check" title="${done ? "Undo: mark as not done" : "Mark as completed"}">
        <input type="checkbox" ${done ? "checked" : ""} aria-label="${escapeHtml(task.task_name)} completed">
        <span class="check-box">${icon("check", 14, 3)}</span>
      </label>
      <div class="task-body" data-toggle>
        <span class="task-name">${escapeHtml(task.task_name)}</span>
        <span class="task-meta">
          <span class="tone-${tone}">${escapeHtml(when)}</span>
          ${vehicle ? `<span class="dot-sep">${escapeHtml(vehicle.label)}</span>` : ""}
        </span>
      </div>
      ${right}
    </li>`;
}

// Wire every task row inside `root`. Tapping the row body or the checkbox toggles
// completion; completing opens the receipt/undo sheet. onChanged runs after saves.
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
      <h2>${escapeHtml(task.task_name)} completed</h2>
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
        <span class="car-name">${escapeHtml(v.label)}${v.unnamed ? ' <span class="tag">No name</span>' : ""}</span>
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
  const soon = mine.find((t) => dueTone(t.due_date, remindDays) === "warn");
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
