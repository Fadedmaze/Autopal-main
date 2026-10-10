// Garage: every vehicle, labeled by its name or "Vehicle N". Selecting a car makes it
// the one Home shows and opens its Vehicle screen; the radio switches without leaving.
import { getProfile, getSettings, listVehicles, listTasks, setActiveVehicle } from "../data.js";
import { vehicleCard, vehicleStatus } from "../components.js";
import { appBar, emptyState, icon, loading, toast, errorMessage } from "../ui.js";

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const [profile, settings, vehicles, openTasks] = await Promise.all([
    getProfile(), getSettings(), listVehicles(), listTasks({ completed: false, limit: 500 }),
  ]);
  if (!ctx.isCurrent()) return;
  let activeId = vehicles.some((v) => v.id === profile.active_vehicle_id) ? profile.active_vehicle_id : vehicles[0]?.id;

  const select = async (id) => {
    if (id === activeId) return true;
    const previous = activeId;
    activeId = id;
    draw();
    try {
      await setActiveVehicle(id);
      return true;
    } catch (err) {
      activeId = previous;
      draw();
      toast(errorMessage(err), "error");
      return false;
    }
  };

  const draw = () => {
    root.innerHTML = `
      ${appBar({ title: "Garage", sub: vehicles.length ? "Select a vehicle to see it on Home." : "", back: { href: "#/home", label: "Home" } })}
      ${vehicles.length ? `
        <div class="content">
          <div class="count">${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}</div>
          <ul class="car-list">
            ${vehicles.map((v) => `<li>${vehicleCard(v, { selected: v.id === activeId, status: vehicleStatus(v, openTasks, settings.reminder_days_before) })}</li>`).join("")}
          </ul>
        </div>` : emptyState({
          iconName: "car",
          title: "Your garage is empty",
          body: "You haven't added any vehicles yet. Tap <strong>Add New Vehicle</strong> below to add your first car and start tracking its maintenance.",
        })}
      <div class="footer-cta"><a class="btn" href="#/vehicles/new">${icon("plus", 18, 2.4)}Add New Vehicle</a></div>`;

    root.querySelectorAll(".car[data-vehicle-id]").forEach((card) => {
      card.addEventListener("click", async (e) => {
        const id = Number(card.dataset.vehicleId);
        if (e.target.closest(".radio")) {
          if (await select(id)) toast("Now showing on Home", "ok");
          return;
        }
        select(id);
        ctx.navigate(`#/vehicles/${id}`);
      });
    });
  };
  draw();
}
