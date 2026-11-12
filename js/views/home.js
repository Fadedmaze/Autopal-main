// Home (first tab): welcome, the car on its circular platform (swipe between cars), the
// next upcoming task (opens Tasks), Maintenance Estimator, the tire-shaped settings menu,
// and "Your Account" (picture, name, password, notifications, insurance card, log out),
// which used to be the Profile tab. ?section=account scrolls to it; ?insurance=1 opens
// the insurance card.
import { getProfile, getSettings, listVehicles, listTasks, listPhotos, setActiveVehicle } from "../data.js";
import { openSettings } from "../settings.js";
import {
  escapeHtml, icon, loading, dueLabel, dueTone, formatMoney, vehicleIcon, vehicleSpec, vehicleTint, vehicleInkColor, toast, errorMessage, titleCase,
} from "../ui.js";
import { mountCar3D } from "../car3d.js";
import { announceReminders } from "../reminders.js";
import { renderAccount } from "./profile.js";

export default async function render(root, ctx) {
  // 3D cars mounted on the platforms; disposed when the route changes (see cleanup below).
  const mounts = [];
  let disposed = false;
  let accountCleanup = null;
  const cleanup = () => {
    disposed = true;
    mounts.splice(0).forEach((m) => m.destroy());
    accountCleanup?.();
  };

  root.innerHTML = loading();
  const [profile, settings, vehicles, openTasks] = await Promise.all([
    getProfile(), getSettings(), listVehicles(), listTasks({ completed: false, limit: 500 }),
  ]);
  if (!ctx.isCurrent()) return cleanup;

  let activeIndex = Math.max(0, vehicles.findIndex((v) => v.id === profile.active_vehicle_id));
  if (vehicles.length && vehicles[activeIndex].id !== profile.active_vehicle_id) {
    setActiveVehicle(vehicles[activeIndex].id).catch(() => {});
  }
  // Newest photo per car, for the platform (best effort: icons if photos fail).
  const photos = await Promise.all(vehicles.map((v) => listPhotos(v.id).then((p) => p[0]?.url ?? null).catch(() => null)));
  if (!ctx.isCurrent()) return cleanup;

  // Display names are shown as typed; a username fallback gets Title Case like other names.
  const name = profile.display_name || titleCase(profile.username || "driver");

  root.innerHTML = `
    <header class="home-head">
      <div>
        <p class="eyebrow">${greet()}</p>
        <h1>Welcome Back, ${escapeHtml(name)}</h1>
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
          <h2>Add Your First Car</h2>
          <p class="car-meta">Tap the plus to get started.</p>
        </div>`}
    </section>

    <a class="next-task" href="#/tasks" id="next-task"></a>

    <a class="btn btn-estimate" href="#/budget">${icon("dollar", 20, 2)}Maintenance Estimator</a>

    <section class="home-account" id="account" aria-labelledby="account-title"></section>`;

  const nextTaskEl = root.querySelector("#next-task");
  const drawNextTask = () => {
    const v = vehicles[activeIndex];
    const next = v ? openTasks.find((t) => t.vehicle_id === v.id) : null;
    if (!next) {
      nextTaskEl.className = "next-task";
      nextTaskEl.innerHTML = `
        <span class="next-icon">${icon("tasks", 22, 2)}</span>
        <span class="next-body"><span class="next-label">Next Up</span><strong>No Upcoming Tasks</strong></span>
        ${icon("chevron", 18, 2)}`;
      return;
    }
    const tone = dueTone(next.due_date, next.remind_days_before ?? settings.reminder_days_before);
    nextTaskEl.className = `next-task tone-box-${tone}`;
    nextTaskEl.innerHTML = `
      <span class="next-icon">${icon(tone === "danger" ? "alert" : "wrench", 22, 2)}</span>
      <span class="next-body">
        <span class="next-label">Next Up${vehicles.length > 1 ? ` · ${escapeHtml(v.label)}` : ""}</span>
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

  // Your Account (formerly the Profile tab).
  const accountEl = root.querySelector("#account");
  renderAccount(accountEl, ctx, profile, { openInsuranceNow: ctx.query.get("insurance") === "1" })
    .then((fn) => {
      if (disposed) fn?.();
      else accountCleanup = fn;
      if (ctx.query.get("section") === "account") accountEl.scrollIntoView({ block: "start" });
    })
    .catch((err) => { accountEl.innerHTML = `<p class="muted-box">Couldn't load your account details. ${escapeHtml(errorMessage(err))}</p>`; });

  // Arrived from a Forgot Username email link: show the username first (and skip the
  // reminders sheet this time, so the two don't stack).
  if (ctx.query.get("username") === "1") {
    history.replaceState(null, "", "#/home");
    showUsername(profile.username);
  } else {
    // Reminders whose day has arrived: shown once each (sheet, plus a phone notification if on).
    announceReminders(openTasks, settings, vehicles).catch(() => {});
  }

  // Every car gets the 3D model on its platform. The photo (or 2D icon) stays underneath
  // and shows through if WebGL or the three.js import fails.
  vehicles.forEach((v, i) => {
    const host = root.querySelector(`.stage-slide[data-index="${i}"] .platform`);
    if (!host) return;
    mountCar3D(host, v, vehicleInkColor(v.index)).then((m) => {
      if (!m) return;
      if (disposed) m.destroy();
      else mounts.push(m);
    });
  });

  return cleanup;
}

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// Forgot Username result: the username, a Copy button, and a way to change the password.
function showUsername(username) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.innerHTML = `
    <div class="sheet-body">
      <div class="sheet-icon">${icon("user", 28, 2.2)}</div>
      <h2>Here's Your Username</h2>
      <p class="username-reveal">@${escapeHtml(username ?? "")}</p>
      <p>You're logged in. Use this username with your password next time.</p>
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-copy>${icon("check", 18, 2)}Copy</button>
        <button type="button" class="btn" data-close>Done</button>
      </div>
      <a class="link-sm" href="#/profile/password" data-close>Forgot your password too? Change it</a>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
  const copyBtn = dlg.querySelector("[data-copy]");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(username ?? "");
      copyBtn.lastChild.textContent = "Copied";
    } catch {
      toast("Couldn't copy. Select the username instead.", "info");
    }
  });
  dlg.showModal();
}
