// Tasks: Upcoming and Completed tabs. Tap an upcoming task to complete it (then
// optionally attach a receipt, or undo). The + in the top right adds a custom task.
import { getProfile, getSettings, listVehicles, listTasks, receiptUrl } from "../data.js";
import { taskRow, bindTaskRows, completedSheet } from "../components.js";
import { appBar, escapeHtml, icon, loading, toast, errorMessage, todayISO } from "../ui.js";

// Remembered for this visit so returning from a task keeps your place.
const state = { tab: "upcoming", vehicle: null };

function isOverdue(task) {
  if (!task.due_date) return false;

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");

  return String(task.due_date).slice(0, 10) < todayString;
}

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const [profile, settings, vehicles] = await Promise.all([getProfile(), getSettings(), listVehicles()]);
  if (!ctx.isCurrent()) return;

  if (["overdue", "upcoming", "completed"].includes(ctx.query.get("tab"))) {
    state.tab = ctx.query.get("tab");
  }
  if (!vehicles.some((v) => v.id === state.vehicle) && state.vehicle !== "all") {
    state.vehicle = vehicles.some((v) => v.id === profile.active_vehicle_id) ? profile.active_vehicle_id : "all";
  }
  const byId = new Map(vehicles.map((v) => [v.id, v]));

  const load = async () => {
    const vehicleId = state.vehicle === "all" ? null : state.vehicle;
    const [upcoming, completed] = await Promise.all([
      listTasks({ vehicleId, completed: false }),
      listTasks({ vehicleId, completed: true }),
    ]);
    if (!ctx.isCurrent()) return;
    console.table(
      [...upcoming, ...completed].map((task) => ({
        id: task.id,
        name: task.task_name,
        vehicle: task.vehicle_id,
        completed: task.is_completed,
        due: task.due_date
      }))
    );    
    draw(upcoming, completed);
  };

  const draw = (upcoming, completed) => {
    const today = todayISO();
  
    // Only incomplete tasks belong in Overdue or Upcoming
    const incompleteTasks = upcoming.filter(
      (task) => !task.is_completed
    );
  
    const overdue = incompleteTasks.filter(
      (task) => task.due_date && task.due_date < today
    );

    // Only show tasks due within the next 30 days
    
      const upcomingOnly = incompleteTasks.filter((task) => {
        // Tasks without a due date remain visible
        if (!task.due_date) return true;

        // Overdue tasks belong in the Overdue tab
        if (task.due_date < today) return false;

        // Recurring tasks appear 7 days before their due date
        // Regular tasks appear 60 days before their due date
        const daysBefore = task.generated_from_task_id != null ? 7 : 60;

        const futureDate = new Date(`${today}T12:00:00`);
        futureDate.setDate(futureDate.getDate() + daysBefore);

        const cutoff = [
          futureDate.getFullYear(),
          String(futureDate.getMonth() + 1).padStart(2, "0"),
          String(futureDate.getDate()).padStart(2, "0")
        ].join("-");

        return task.due_date <= cutoff;
      });


      const list =
        state.tab === "overdue" ? overdue :
        state.tab === "upcoming" ? upcomingOnly :
        completed;
    const showVehicle = state.vehicle === "all" && vehicles.length > 1;
    const addHref = `#/tasks/new${typeof state.vehicle === "number" ? `?vehicle=${state.vehicle}` : ""}`;

    root.innerHTML = `
      ${appBar({
        title: "Tasks",
        back: { href: "#/home", label: "Home" },
        action: vehicles.length ? `<a class="icon-btn icon-btn-brand" href="${addHref}" aria-label="Add a Task">${icon("plus", 22, 2.4)}</a>` : "",
      })}
    <div class="content">
      <div class="segmented" role="tablist">
        <button role="tab" type="button" data-tab="overdue" aria-selected="${state.tab === "overdue"}">Overdue (${overdue.length})</button>
        <button role="tab" type="button" data-tab="upcoming" aria-selected="${state.tab === "upcoming"}">Upcoming (${upcomingOnly.length})</button>
        <button role="tab" type="button" data-tab="completed" aria-selected="${state.tab === "completed"}">Completed (${completed.length})</button>
      </div>

        ${vehicles.length > 1 ? `
          <div class="chips scroll" role="group" aria-label="Filter by vehicle">
            <button type="button" class="chip ${state.vehicle === "all" ? "on" : ""}" data-vehicle="all">All Vehicles</button>
            ${vehicles.map((v) => `<button type="button" class="chip ${v.id === state.vehicle ? "on" : ""}" data-vehicle="${v.id}">${escapeHtml(v.label)}</button>`).join("")}
          </div>` : ""}

        ${!vehicles.length
          ? `<p class="muted-box">No tasks yet. <a href="#/vehicles/new">Add a vehicle</a> and we'll set up its maintenance schedule.</p>`
          : list.length
            ? `<ul class="task-list">${list.map((t) => taskRow(t, {
                vehicle: showVehicle ? byId.get(t.vehicle_id) : null,
                remindDays: settings.reminder_days_before,
                showReceipt: state.tab === "completed",
              })).join("")}</ul>
              <p class="hint center">${state.tab === "completed"
                  ? "Uncheck a task to undo. Tap a task without a receipt to attach one."
                  : "Tap a task to mark it completed."}</p>`
                  : `
                  <div class="tasks-empty">
                    <div class="tasks-empty-icon">
                      ${icon(
                        state.tab === "overdue" ? "check" :
                        state.tab === "completed" ? "history" : "calendar",
                        28, 2
                      )}
                    </div>
                
                    <h3>${
                      state.tab === "overdue" ? "You're all caught up!" :
                      state.tab === "completed" ? "No completed tasks yet" :
                      "Nothing coming up!"
                    }</h3>
                
                    <p>${
                      state.tab === "overdue"
                        ? "You have no overdue maintenance tasks."
                        : state.tab === "completed"
                          ? "Completed maintenance tasks will appear here."
                          : "You have no upcoming maintenance tasks."
                    }</p>
                  </div>`}
      </div>`;

    root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      draw(upcoming, completed);
    }));
    root.querySelectorAll("[data-vehicle]").forEach((b) => b.addEventListener("click", () => {
      state.vehicle = b.dataset.vehicle === "all" ? "all" : Number(b.dataset.vehicle);
      load();
    }));

    const all = new Map([...upcoming, ...completed].map((t) => [t.id, t]));
    bindTaskRows(root, all, load);

    // Completed tab: open an attached receipt, or attach one to a task without.
    root.querySelectorAll(".task.done [data-toggle]").forEach((el) => {
      const task = all.get(Number(el.closest(".task").dataset.taskId));
      if (!task.receipt_path) {
        el.classList.add("clickable");
        el.addEventListener("click", () => completedSheet(task, { onChanged: load }));
      }
    });
    root.querySelectorAll("[data-receipt]").forEach((b) =>
      b.addEventListener("click", () => showReceipt(b.dataset.receipt)));
  };

  await load();
}

// Receipt viewer. Images show inline; PDFs get an Open link. (Fetching the signed
// URL first and then calling window.open would be blocked as a pop-up on iOS.)
async function showReceipt(path) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.innerHTML = `
    <div class="sheet-body left">
      <div class="sheet-head">
        <h2>${icon("receipt", 20, 2)}Receipt</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close", 18, 2.2)}</button>
      </div>
      <div class="receipt-view">${loading()}</div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  dlg.showModal();

  const view = dlg.querySelector(".receipt-view");
  try {
    const url = await receiptUrl(path);
    view.innerHTML = /\.pdf$/i.test(path)
      ? `<a class="btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">${icon("receipt", 18, 2)}Open PDF Receipt</a>`
      : `<img src="${escapeHtml(url)}" alt="Receipt">`;
  } catch (err) {
    view.innerHTML = `<p class="form-error">${escapeHtml(errorMessage(err))}</p>`;
    toast("Couldn't load the receipt", "error");
  }
}
