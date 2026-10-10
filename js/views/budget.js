// Budget (Maintenance Estimate): every repair for the car with a checkbox on the left,
// the approximate price on the right, and the total of all of them at the bottom.
// Totals come from the vehicle_task_summary view (summed in the database).
import { getProfile, getSettings, listVehicles, listTasks } from "../data.js";
import { taskRow, bindTaskRows } from "../components.js";
import { appBar, escapeHtml, loading, emptyState, formatMoney, icon } from "../ui.js";

let chosenVehicle = null;

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const [profile, settings, vehicles] = await Promise.all([getProfile(), getSettings(), listVehicles()]);
  if (!ctx.isCurrent()) return;
  const bar = { title: "Budget", sub: "Maintenance estimate for upcoming and past repairs.", back: { href: "#/home", label: "Home" } };

  if (!vehicles.length) {
    root.innerHTML = `
      ${appBar(bar)}
      ${emptyState({ iconName: "dollar", title: "No vehicles yet", body: `Add a car in the <a href="#/garage">Garage</a> to see its maintenance estimate.` })}`;
    return;
  }

  if (!vehicles.some((v) => v.id === chosenVehicle)) {
    chosenVehicle = vehicles.some((v) => v.id === profile.active_vehicle_id) ? profile.active_vehicle_id : vehicles[0].id;
  }
  const vehicle = vehicles.find((v) => v.id === chosenVehicle);
  const [open, done] = await Promise.all([
    listTasks({ vehicleId: vehicle.id, completed: false }),
    listTasks({ vehicleId: vehicle.id, completed: true }),
  ]);
  if (!ctx.isCurrent()) return;
  const s = vehicle.summary;
  const row = (t) => taskRow(t, { remindDays: settings.reminder_days_before, showCost: true });

  root.innerHTML = `
    ${appBar({ ...bar, action: `<a class="icon-btn icon-btn-brand" href="#/tasks/new?vehicle=${vehicle.id}" aria-label="Add a repair">${icon("plus", 22, 2.4)}</a>` })}
    <div class="content">
      ${vehicles.length > 1 ? `
        <div class="chips scroll" role="group" aria-label="Choose vehicle">
          ${vehicles.map((v) => `<button type="button" class="chip ${v.id === vehicle.id ? "on" : ""}" data-vehicle="${v.id}">${escapeHtml(v.label)}</button>`).join("")}
        </div>` : ""}

      <section class="section">
        <div class="section-head"><h3>Upcoming</h3><span class="tone-muted">${formatMoney(s.open_estimated_total)}</span></div>
        ${open.length ? `<ul class="task-list">${open.map(row).join("")}</ul>` : `<p class="muted-box">No upcoming repairs.</p>`}
      </section>

      <section class="section">
        <div class="section-head"><h3>Completed</h3><span class="tone-muted">${formatMoney(s.completed_cost_total)}</span></div>
        ${done.length ? `<ul class="task-list">${done.map(row).join("")}</ul>` : `<p class="muted-box">Checked-off repairs show up here.</p>`}
      </section>
      <p class="hint center">Check off a repair when it's done. Prices are estimates and vary by shop.</p>
    </div>

    <div class="total-bar">
      <div>
        <span>Total</span>
        <small>${s.open_count + done.length} repair${s.open_count + done.length === 1 ? "" : "s"} · ${escapeHtml(vehicle.label)}</small>
      </div>
      <strong>${formatMoney(s.all_estimated_total)}</strong>
    </div>`;

  root.querySelectorAll("[data-vehicle]").forEach((b) => b.addEventListener("click", () => {
    chosenVehicle = Number(b.dataset.vehicle);
    render(root, ctx);
  }));
  bindTaskRows(root, new Map([...open, ...done].map((t) => [t.id, t])), () => render(root, ctx));
}
