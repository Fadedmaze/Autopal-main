// Create a custom task (name + due date required, notes optional), or edit one.
import { listVehicles, getTask, createTask, updateTask, deleteTaskWithReceipt } from "../data.js";
import { appBar, escapeHtml, icon, loading, toast, confirmDialog, errorMessage, withBusy } from "../ui.js";

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const editing = Boolean(ctx.params.id);
  const [vehicles, task] = await Promise.all([
    listVehicles(),
    editing ? getTask(ctx.params.id) : Promise.resolve(null),
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
  const t = task ?? {
    vehicle_id: vehicles.some((v) => v.id === presetVehicle) ? presetVehicle : vehicles[0].id,
    task_name: "",
    due_date: "",
    estimated_cost: null,
    notes: "",
  };

  root.innerHTML = `
    ${appBar({ title: editing ? "Edit Task" : "New Task", sub: editing ? "" : "Add maintenance that isn't already on your list.", back: { href: "#/tasks", label: "Tasks" } })}
    <form class="form content" novalidate>
      ${vehicles.length > 1 ? `
        <label class="field">
          <span>Vehicle</span>
          <select name="vehicle_id">
            ${vehicles.map((v) => `<option value="${v.id}" ${v.id === t.vehicle_id ? "selected" : ""}>${escapeHtml(v.label)}</option>`).join("")}
          </select>
        </label>` : `<input type="hidden" name="vehicle_id" value="${t.vehicle_id}">`}
      <label class="field">
        <span>Task name</span>
        <input name="task_name" required maxlength="80" placeholder="e.g. Replace headlight bulb" value="${escapeHtml(t.task_name)}">
      </label>
      <label class="field">
        <span>Due date</span>
        <input name="due_date" type="date" required value="${escapeHtml(t.due_date ?? "")}">
      </label>
      <label class="field">
        <span>Notes <em>optional</em></span>
        <textarea name="notes" rows="3" maxlength="1000" placeholder="Part numbers, which shop, anything to remember">${escapeHtml(t.notes ?? "")}</textarea>
      </label>
      <label class="field">
        <span>Estimated cost <em>optional, used in Maintenance Estimate</em></span>
        <span class="input-prefix"><span>$</span><input name="estimated_cost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" value="${t.estimated_cost ?? ""}"></span>
      </label>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions">
        <a class="btn btn-ghost" href="#/tasks">Cancel</a>
        <button class="btn" type="submit">${editing ? "Save Changes" : "Add Task"}</button>
      </div>
      ${editing ? `<div class="danger-zone"><button type="button" class="btn-text danger" id="delete-task">${icon("trash", 16, 2)}Delete task</button></div>` : ""}
    </form>`;

  const form = root.querySelector("form");
  const errEl = root.querySelector(".form-error");
  const fail = (msg) => { errEl.textContent = msg; errEl.hidden = false; };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const f = Object.fromEntries(new FormData(form));
    const fields = {
      vehicle_id: Number(f.vehicle_id),
      task_name: f.task_name.trim(),
      due_date: f.due_date || null,
      notes: f.notes.trim() || null,
      estimated_cost: f.estimated_cost === "" ? null : Math.round(Number(f.estimated_cost) * 100) / 100,
    };
    const missing = [!fields.task_name && "a task name", !fields.due_date && "a due date"].filter(Boolean);
    if (missing.length) return fail(`Please enter ${missing.join(" and ")}. ${missing.length > 1 ? "Both are" : "It's"} required.`);
    if (fields.estimated_cost !== null && !(fields.estimated_cost >= 0)) return fail("Cost must be zero or more.");

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
    const ok = await confirmDialog({ title: "Delete this task?", body: `“${task.task_name}” and any receipt attached to it will be removed.`, confirmLabel: "Delete", danger: true });
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
