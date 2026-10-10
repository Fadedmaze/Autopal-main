// Home: welcome, the car on its circular platform (swipe between cars), the next
// upcoming task (opens Tasks), Maintenance Estimate, and the tire-shaped settings menu.
import { getProfile, getSettings, listVehicles, listTasks, listPhotos, setActiveVehicle, updateProfile } from "../data.js";
import { distanceUnit, setDistanceUnit, getTheme, applyTheme } from "../prefs.js";
import {
  escapeHtml, icon, loading, dueLabel, dueTone, formatMoney, vehicleIcon, vehicleSpec, vehicleTint, toast, errorMessage,
} from "../ui.js";

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const [profile, settings, vehicles, openTasks] = await Promise.all([
    getProfile(), getSettings(), listVehicles(), listTasks({ completed: false, limit: 500 }),
  ]);
  if (!ctx.isCurrent()) return;

  let activeIndex = Math.max(0, vehicles.findIndex((v) => v.id === profile.active_vehicle_id));
  if (vehicles.length && vehicles[activeIndex].id !== profile.active_vehicle_id) {
    setActiveVehicle(vehicles[activeIndex].id).catch(() => {});
  }
  // Newest photo per car, for the platform (best effort: icons if photos fail).
  const photos = await Promise.all(vehicles.map((v) => listPhotos(v.id).then((p) => p[0]?.url ?? null).catch(() => null)));
  if (!ctx.isCurrent()) return;

  const name = profile.username || "driver";

  root.innerHTML = `
    <header class="home-head">
      <div>
        <p class="eyebrow">${greet()}</p>
        <h1>Welcome back, ${escapeHtml(name)}</h1>
      </div>
      <button type="button" class="tire-btn" id="settings" aria-label="Settings">${icon("tire", 26, 1.7)}</button>
    </header>

    <section class="stage" aria-label="Your vehicles">
      ${vehicles.length ? `
        <div class="stage-track" tabindex="0" aria-roledescription="carousel">
          ${vehicles.map((v, i) => `
            <div class="stage-slide" data-index="${i}" style="${vehicleTint(v.index)}" aria-label="${escapeHtml(v.label)}, ${i + 1} of ${vehicles.length}">
              <a class="platform" href="#/vehicles/${v.id}">
                <span class="platform-car">${photos[i] ? `<img src="${escapeHtml(photos[i])}" alt="">` : vehicleIcon(v, 110)}</span>
              </a>
              <h2>${escapeHtml(v.label)}</h2>
              <p class="car-meta">${escapeHtml(vehicleSpec(v))}</p>
            </div>`).join("")}
        </div>
        ${vehicles.length > 1 ? `
          <div class="stage-nav">
            <button type="button" class="icon-btn" data-step="-1" aria-label="Previous vehicle">${icon("back", 18, 2.2)}</button>
            <div class="stage-dots">${vehicles.map((_, i) => `<span class="${i === activeIndex ? "on" : ""}"></span>`).join("")}</div>
            <button type="button" class="icon-btn flip" data-step="1" aria-label="Next vehicle">${icon("back", 18, 2.2)}</button>
          </div>` : ""}
      ` : `
        <div class="stage-slide">
          <a class="platform platform-empty" href="#/vehicles/new" aria-label="Add a vehicle">${icon("plus", 64, 1.6)}</a>
          <h2>Add your first car</h2>
          <p class="car-meta">Tap the plus to get started.</p>
        </div>`}
    </section>

    <a class="next-task" href="#/tasks" id="next-task"></a>

    <a class="btn btn-estimate" href="#/budget">${icon("dollar", 20, 2)}Maintenance Estimate</a>`;

  const nextTaskEl = root.querySelector("#next-task");
  const drawNextTask = () => {
    const v = vehicles[activeIndex];
    const next = v ? openTasks.find((t) => t.vehicle_id === v.id) : null;
    if (!next) {
      nextTaskEl.className = "next-task";
      nextTaskEl.innerHTML = `
        <span class="next-icon">${icon("tasks", 22, 2)}</span>
        <span class="next-body"><span class="next-label">Next up</span><strong>No upcoming tasks</strong></span>
        ${icon("chevron", 18, 2)}`;
      return;
    }
    const tone = dueTone(next.due_date, settings.reminder_days_before);
    nextTaskEl.className = `next-task tone-box-${tone}`;
    nextTaskEl.innerHTML = `
      <span class="next-icon">${icon(tone === "danger" ? "alert" : "wrench", 22, 2)}</span>
      <span class="next-body">
        <span class="next-label">Next up${vehicles.length > 1 ? ` · ${escapeHtml(v.label)}` : ""}</span>
        <strong>${escapeHtml(next.task_name)}</strong>
        <span class="tone-${tone}">${escapeHtml(dueLabel(next.due_date))}${Number(next.estimated_cost) > 0 ? ` · ~${formatMoney(next.estimated_cost)}` : ""}</span>
      </span>
      ${icon("chevron", 18, 2)}`;
  };
  drawNextTask();

  // Carousel: swiping (scroll-snap) or the arrows switch the car shown on Home.
  const track = root.querySelector(".stage-track");
  if (track && vehicles.length > 1) {
    const dots = [...root.querySelectorAll(".stage-dots span")];
    let saveTimer = null;
    const select = (i, { scroll = false } = {}) => {
      i = (i + vehicles.length) % vehicles.length;
      if (scroll) track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
      if (i === activeIndex) return;
      activeIndex = i;
      dots.forEach((d, n) => d.classList.toggle("on", n === i));
      drawNextTask();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        setActiveVehicle(vehicles[i].id).catch((err) => toast(errorMessage(err), "error"));
      }, 400);
    };
    requestAnimationFrame(() => { track.scrollLeft = activeIndex * track.clientWidth; });
    track.addEventListener("scroll", () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== activeIndex && i >= 0 && i < vehicles.length) select(i);
    }, { passive: true });
    root.querySelectorAll("[data-step]").forEach((b) =>
      b.addEventListener("click", () => select(activeIndex + Number(b.dataset.step), { scroll: true })));
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") select(activeIndex + 1, { scroll: true });
      if (e.key === "ArrowLeft") select(activeIndex - 1, { scroll: true });
    });
  }

  root.querySelector("#settings").addEventListener("click", () => openSettings(profile));
}

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// Settings menu: appearance (this device), units (account), privacy.
function openSettings(profile) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  const theme = getTheme();
  const unit = distanceUnit();
  dlg.innerHTML = `
    <div class="sheet-body left">
      <div class="sheet-head">
        <h2>${icon("tire", 22, 1.8)}Settings</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close", 18, 2.2)}</button>
      </div>

      <div class="setting">
        <span class="setting-label">${icon("sun", 18, 2)}Appearance</span>
        <div class="segmented" role="radiogroup" aria-label="Appearance">
          ${[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) =>
            `<button type="button" role="radio" data-theme="${v}" aria-checked="${theme === v}">${l}</button>`).join("")}
        </div>
      </div>

      <div class="setting">
        <span class="setting-label">${icon("ruler", 18, 2)}Units</span>
        <div class="segmented" role="radiogroup" aria-label="Units">
          ${[["mi", "Miles"], ["km", "Kilometers"]].map(([v, l]) =>
            `<button type="button" role="radio" data-unit="${v}" aria-checked="${unit === v}">${l}</button>`).join("")}
        </div>
      </div>

      <details class="setting privacy">
        <summary><span class="setting-label">${icon("shield", 18, 2)}Privacy</span>${icon("chevron", 16, 2)}</summary>
        <ul>
          <li>Your vehicles, tasks, photos, receipts and profile picture are private to your account. Nobody else can see them.</li>
          <li>Your location is used only while you're on Find Mechanic, to sort shops by distance. It's never saved.</li>
          <li>Your email is used only for sign-in and password resets.</li>
          <li>Appearance is remembered on this device only.</li>
        </ul>
      </details>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => {
    dlg.remove();
    // Re-render so mileage etc. reflect a units change.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());

  dlg.querySelectorAll("[data-theme]").forEach((b) => b.addEventListener("click", () => {
    applyTheme(b.dataset.theme);
    dlg.querySelectorAll("[data-theme]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  }));
  dlg.querySelectorAll("[data-unit]").forEach((b) => b.addEventListener("click", async () => {
    const value = b.dataset.unit;
    if (value === distanceUnit()) return;
    const previous = distanceUnit();
    setDistanceUnit(value);
    dlg.querySelectorAll("[data-unit]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    try {
      await updateProfile({ distance_unit: value });
      profile.distance_unit = value;
    } catch (err) {
      setDistanceUnit(previous);
      dlg.querySelectorAll("[data-unit]").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.unit === previous)));
      toast(errorMessage(err), "error");
    }
  }));
  dlg.showModal();
}
