// Maintenance Estimator: upcoming repairs with their approximate prices and a total.
// The total comes from the vehicle_task_summary view (summed in the database).
import { getProfile, getSettings, listVehicles, listTasks, deleteTaskWithReceipt } from "../data.js";
import { taskRow, bindTaskRows, taskDetailsSheet, addCustomTaskSheet } from "../components.js";
import { appBar, escapeHtml, loading, emptyState, formatMoney, icon, confirmDialog, withBusy, toast, errorMessage } from "../ui.js";

let chosenVehicle = null;

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const [profile, settings, vehicles] = await Promise.all([getProfile(), getSettings(), listVehicles()]);
  if (!ctx.isCurrent()) return;
  const bar = {
    title: "Maintenance Estimator",
    sub: "Estimate costs for repairs",
    back: { href: "#/home", label: "Home" },
    action: vehicles.length
      ? `<button class="btn btn-sm" type="button" data-add-custom>${icon("plus", 18, 2.4)}<span>Add Custom</span></button>`
      : "",
  };

  if (!vehicles.length) {
    root.innerHTML = `
      ${appBar(bar)}
      ${emptyState({ iconName: "dollar", title: "No Vehicles Yet", body: `Add a car in the <a href="#/garage">Garage</a> to see its maintenance estimate.` })}`;
    return;
  }

  // Opened from a vehicle page (?vehicle=<id>): show that car.
  const asked = Number(ctx.query?.get("vehicle"));
  if (asked && vehicles.some((v) => v.id === asked)) chosenVehicle = asked;
  if (!vehicles.some((v) => v.id === chosenVehicle)) {
    chosenVehicle = vehicles.some((v) => v.id === profile.active_vehicle_id) ? profile.active_vehicle_id : vehicles[0].id;
  }
  const vehicle = vehicles.find((v) => v.id === chosenVehicle);
  const open = await listTasks({ vehicleId: vehicle.id, completed: false });
  if (!ctx.isCurrent()) return;
  const s = vehicle.summary;
  const row = (t) => taskRow(t, {
    remindDays: settings.reminder_days_before,
    showCost: true,
    showDueDate: false,
    showTaskDetails: true,
    showCheckbox: false,
    showOverdueStyle: false,
    showDeleteCustom: true,
  });

  root.innerHTML = `
    ${appBar(bar)}
    <div class="content">
      ${vehicles.length > 1 ? `
        <div class="chips scroll" role="group" aria-label="Choose vehicle">
          ${vehicles.map((v) => `<button type="button" class="chip ${v.id === vehicle.id ? "on" : ""}" data-vehicle="${v.id}">${escapeHtml(v.label)}</button>`).join("")}
        </div>` : ""}

      <section class="section">
        ${open.length ? `<ul class="task-list">${open.map(row).join("")}</ul>` : `<p class="muted-box">No repairs found.</p>`}
      </section>

      <p class="hint center">Prices are estimates and vary by shop.</p>
    </div>

    <div class="total-bar">
      <div>
        <span>Estimator Total</span>
        <small>${s.open_count} repair${s.open_count === 1 ? "" : "s"} · ${escapeHtml(vehicle.label)}</small>
      </div>
      <strong>${formatMoney(s.open_estimated_total)}</strong>
    </div>`;

  root.querySelector("[data-add-custom]").addEventListener("click", () => {
    addCustomTaskSheet(vehicle.id, {
      onCreated: () => ctx.isCurrent() && render(root, ctx),
    });
  });
  root.querySelectorAll("[data-vehicle]").forEach((b) => b.addEventListener("click", () => {
    chosenVehicle = Number(b.dataset.vehicle);
    // Keep a ?vehicle= link from overriding the chip the user just picked.
    if (ctx.query?.has("vehicle")) {
      ctx.query.set("vehicle", String(chosenVehicle));
      history.replaceState(null, "", `#/budget?vehicle=${chosenVehicle}`);
    }
    render(root, ctx);
  }));
  const tasksById = new Map(open.map((t) => [t.id, t]));
  root.querySelectorAll("[data-task-details]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = tasksById.get(Number(button.closest(".task").dataset.taskId));
      if (task) taskDetailsSheet(task, { onChanged: () => ctx.isCurrent() && render(root, ctx) });
    });
  });
  root.querySelectorAll("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", async () => {
      const task = tasksById.get(Number(button.closest(".task").dataset.taskId));
      if (!task) return;
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
          toast("Custom item deleted", "ok");
          if (ctx.isCurrent()) await render(root, ctx);
        } catch (err) {
          toast(errorMessage(err), "error");
        }
      });
    });
  });
  bindTaskRows(root, new Map(open.map((t) => [t.id, t])), () => render(root, ctx));
}
