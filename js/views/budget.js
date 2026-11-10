// Maintenance Estimate: upcoming repairs with their approximate prices and a total.
// The total comes from the vehicle_task_summary view (summed in the database).
import { getProfile, getSettings, listVehicles, listTasks, listGuides } from "../data.js";
import { taskRow, bindTaskRows } from "../components.js";
import { appBar, escapeHtml, loading, emptyState, formatMoney, icon } from "../ui.js";

let chosenVehicle = null;

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const [profile, settings, vehicles] = await Promise.all([getProfile(), getSettings(), listVehicles()]);
  if (!ctx.isCurrent()) return;
  const bar = { title: "Maintenance Estimator", sub: "Estimate costs for upcoming repairs", back: { href: "#/home", label: "Home" } };

  if (!vehicles.length) {
    root.innerHTML = `
      ${appBar(bar)}
      ${emptyState({ iconName: "dollar", title: "No vehicles yet", body: `Add a car in the <a href="#/garage">Garage</a> to see its maintenance estimate.` })}`;
    return;
  }

  // Opened from a vehicle page (?vehicle=<id>): show that car.
  const asked = Number(ctx.query?.get("vehicle"));
  if (asked && vehicles.some((v) => v.id === asked)) chosenVehicle = asked;
  if (!vehicles.some((v) => v.id === chosenVehicle)) {
    chosenVehicle = vehicles.some((v) => v.id === profile.active_vehicle_id) ? profile.active_vehicle_id : vehicles[0].id;
  }
  const vehicle = vehicles.find((v) => v.id === chosenVehicle);
  const [open, guides] = await Promise.all([
    listTasks({ vehicleId: vehicle.id, completed: false }),
    listGuides(),
  ]);
  if (!ctx.isCurrent()) return;
  const s = vehicle.summary;
  const guidesByTaskName = new Map(guides
    .filter((g) => g.category === "diy" && g.task_name)
    .map((g) => [g.task_name.trim().toLowerCase(), g]));
  const row = (t) => {
    const guide = guidesByTaskName.get(t.task_name.trim().toLowerCase());
    const guideHref = guide
      ? `#/library/${encodeURIComponent(guide.slug)}?vehicle=${vehicle.id}`
      : null;
    return taskRow(t, {
      remindDays: settings.reminder_days_before,
      showCost: true,
      showDueDate: false,
      guideHref,
    });
  };

  root.innerHTML = `
    ${appBar(bar)}
    <div class="content">
      ${vehicles.length > 1 ? `
        <div class="chips scroll" role="group" aria-label="Choose vehicle">
          ${vehicles.map((v) => `<button type="button" class="chip ${v.id === vehicle.id ? "on" : ""}" data-vehicle="${v.id}">${escapeHtml(v.label)}</button>`).join("")}
        </div>` : ""}

      <section class="section">
        ${open.length ? `<ul class="task-list">${open.map(row).join("")}</ul>` : `<p class="muted-box">No upcoming repairs.</p>`}
      </section>

      <p class="hint center">Prices are estimates and vary by shop.</p>
    </div>

    <div class="total-bar">
      <div>
        <span>Upcoming total</span>
        <small>${s.open_count} upcoming repair${s.open_count === 1 ? "" : "s"} · ${escapeHtml(vehicle.label)}</small>
      </div>
      <strong>${formatMoney(s.open_estimated_total)}</strong>
    </div>
    <a class="fab" href="#/tasks/new?vehicle=${vehicle.id}">${icon("plus", 20, 2.6)}<span>Add task</span></a>`;

  root.querySelectorAll("[data-vehicle]").forEach((b) => b.addEventListener("click", () => {
    chosenVehicle = Number(b.dataset.vehicle);
    // Keep a ?vehicle= link from overriding the chip the user just picked.
    if (ctx.query?.has("vehicle")) {
      ctx.query.set("vehicle", String(chosenVehicle));
      history.replaceState(null, "", `#/budget?vehicle=${chosenVehicle}`);
    }
    render(root, ctx);
  }));
  bindTaskRows(root, new Map(open.map((t) => [t.id, t])), () => render(root, ctx));
}
