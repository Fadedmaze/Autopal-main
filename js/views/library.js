// Library: guides grouped into DIY Maintenance and Dashboard Lights. /library/:slug
// opens one guide. DIY guides show difficulty, safety notes, a YouTube search for
// the selected car, and an "Add task" button that prefills the New Task form.
import { listGuides, getProfile, listVehicles, listTasks } from "../data.js";
import { appBar, escapeHtml, icon, loading, formatDate, vehicleSpec } from "../ui.js";

const CATEGORIES = [
  { id: "diy", label: "DIY Maintenance", icon: "wrench" },
  { id: "dashboard", label: "Dashboard Lights", icon: "alert" },
];
const SEVERITY = {
  stop: { label: "Pull over now", text: "Stop driving as soon as it's safe to do so." },
  soon: { label: "Check soon", text: "Safe to drive carefully, but get it checked soon." },
  info: { label: "Good to know", text: "Usually not urgent." },
};
const DIFFICULTY = {
  easy: { label: "Easy", tone: "ok" },
  moderate: { label: "Moderate", tone: "warn" },
  advanced: { label: "Advanced", tone: "danger" },
};

let guidesCache = null;
let category = "diy";
let chosenVehicleId = null; // the car the guide page is tuned to, remembered for this visit

export default async function render(root, ctx) {
  root.innerHTML = loading();
  try {
    guidesCache ??= await listGuides();
  } catch {
    if (!ctx.isCurrent()) return;
    root.innerHTML = `
      ${appBar({ title: "Library", back: { href: "#/home", label: "Home" } })}
      <div class="error-state">
        ${icon("book", 40, 1.6)}
        <h2>Couldn't load the guides</h2>
        <p>${navigator.onLine ? "Something went wrong on our end." : "It looks like you're offline."} Check your connection and try again.</p>
        <button class="btn" type="button" id="retry">Try Again</button>
      </div>`;
    root.querySelector("#retry").addEventListener("click", () => render(root, ctx));
    return;
  }
  if (!ctx.isCurrent()) return;

  if (ctx.params.slug) return renderGuide(root, ctx, guidesCache.find((g) => g.slug === ctx.params.slug));

  const draw = () => {
    const guides = guidesCache.filter((g) => g.category === category);
    root.innerHTML = `
      ${appBar({ title: "Library", sub: "Learn the basics of keeping your car healthy.", back: { href: "#/home", label: "Home" } })}
      <div class="content">
        <div class="segmented" role="tablist" aria-label="Guide categories">
          ${CATEGORIES.map((c) => `<button role="tab" type="button" data-cat="${c.id}" aria-selected="${c.id === category}">${c.label}</button>`).join("")}
        </div>
        ${category === "dashboard" ? `
          <p class="notice notice-info">${icon("scan", 18, 2)}<span>Not sure which light you're seeing? <a href="#/discover">Scan your dashboard</a> to identify it.</span></p>` : ""}
        ${guides.length ? `
          <ul class="guide-list">
            ${guides.map((g) => `
              <li>
                <a class="guide-card" href="#/library/${encodeURIComponent(g.slug)}">
                  <span class="guide-icon ${g.severity ? `sev-${g.severity}` : ""}">${icon(g.category === "diy" ? "wrench" : "alert", 20, 2)}</span>
                  <span class="guide-text">
                    <strong>${escapeHtml(g.title)}</strong>
                    <span>${escapeHtml(g.summary)}</span>
                    ${g.time_estimate || g.difficulty ? `
                      <small class="guide-tags">
                        ${g.difficulty ? difficultyBadge(g.difficulty) : ""}
                        ${g.time_estimate ? `<span>${escapeHtml(g.time_estimate)}</span>` : ""}
                      </small>` : ""}
                    ${g.severity ? `<small class="sev-text-${g.severity}">${SEVERITY[g.severity].label}</small>` : ""}
                  </span>
                  ${icon("chevron", 18, 2)}
                </a>
              </li>`).join("")}
          </ul>` : `<p class="muted-box">No guides in this category yet.</p>`}
      </div>`;
    root.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => { category = b.dataset.cat; draw(); }));
  };
  draw();
}

// Text fields use a blank line between paragraphs.
function paragraphs(text) {
  return String(text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

function difficultyBadge(level) {
  const d = DIFFICULTY[level];
  return d ? `<span class="difficulty difficulty-${d.tone}">${d.label}</span>` : "";
}

// "how to change oil and oil filter 2013 Honda Civic" on YouTube. The trim (model)
// is left out on purpose: it narrows the results too much.
function videoUrl(guide, vehicle) {
  const car = vehicle ? [vehicle.model_year, vehicle.brand, vehicle.make].filter(Boolean).join(" ") : "";
  const q = [guide.video_query || `how to ${guide.title}`, car].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function addTaskHref(guide, vehicle) {
  const params = new URLSearchParams({ name: guide.task_name || guide.title, guide: guide.slug });
  if (vehicle) params.set("vehicle", vehicle.id);
  return `#/tasks/new?${params}`;
}

async function renderGuide(root, ctx, g) {
  if (!g) return ctx.navigate("#/library", { replace: true });
  category = g.category;
  const isDiy = g.category === "diy";
  const sev = g.severity ? SEVERITY[g.severity] : null;

  // The car tunes the video search and the Add Task button. If this fails (offline,
  // say), the guide still shows; it just isn't tuned to a car.
  let vehicles = [];
  if (isDiy) {
    try {
      const [profile, list] = await Promise.all([getProfile(), listVehicles()]);
      vehicles = list;
      if (!vehicles.some((v) => v.id === chosenVehicleId)) {
        chosenVehicleId = vehicles.some((v) => v.id === profile.active_vehicle_id) ? profile.active_vehicle_id : vehicles[0]?.id ?? null;
      }
    } catch { /* show the guide without car-specific extras */ }
    if (!ctx.isCurrent()) return;
  }
  const vehicle = () => vehicles.find((v) => v.id === chosenVehicleId) ?? null;

  // Readable guides have step_details ({title, body}); older ones only have short steps.
  const detailed = Array.isArray(g.step_details) && g.step_details.length > 0;

  root.innerHTML = `
    ${appBar({ title: g.title, back: { href: "#/library", label: "Library" } })}
    <article class="content guide ${isDiy ? "has-fab" : ""}">
      <p class="guide-summary">${escapeHtml(g.summary)}</p>
      ${isDiy && (g.difficulty || g.time_estimate) ? `
        <p class="guide-meta guide-tags">
          ${g.difficulty ? difficultyBadge(g.difficulty) : ""}
          ${g.time_estimate ? `<span>${icon("clock", 15, 2)} About ${escapeHtml(g.time_estimate)}</span>` : ""}
        </p>` : ""}
      ${sev ? `<div class="notice notice-${g.severity === "stop" ? "danger" : "warn"}">${icon("alert", 18, 2)}<span><strong>${sev.label}.</strong> ${sev.text}</span></div>` : ""}
      ${isDiy ? `<section class="card guide-video" id="video-card"></section>` : ""}
      ${g.intro ? `
        <section class="guide-prose">
          <h3>Why it matters</h3>
          ${paragraphs(g.intro)}
        </section>` : ""}
      ${g.prep ? `
        <section class="card guide-prose">
          <h3>Before you start</h3>
          ${paragraphs(g.prep)}
        </section>` : isDiy && g.tools.length ? `
        <section class="card">
          <div><strong>You'll need</strong><ul class="tools">${g.tools.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>
        </section>` : ""}
      ${g.image_path ? `<figure class="guide-figure"><img src="${escapeHtml(g.image_path)}" alt="Diagram for ${escapeHtml(g.title)}" loading="lazy"></figure>` : ""}
      ${g.safety?.length ? `
        <div class="notice notice-warn guide-safety">${icon("alert", 18, 2)}
          <div><strong>Safety first</strong>${g.safety.map((s) => `<p>${escapeHtml(s)}</p>`).join("")}</div>
        </div>` : ""}
      ${detailed ? `
        <section class="guide-prose">
          <h3>Step by step</h3>
          <ol class="walkthrough">
            ${g.step_details.map((s, i) => `
              <li class="walk-step">
                <span class="walk-num" aria-hidden="true">${i + 1}</span>
                <div class="walk-body">
                  <h4><span class="sr-only">Step ${i + 1}: </span>${escapeHtml(s.title)}</h4>
                  ${paragraphs(s.body)}
                </div>
              </li>`).join("")}
          </ol>
        </section>` : `
        <section class="card">
          <h3>${isDiy ? "Steps" : "What to do"}</h3>
          <ol class="steps">${g.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
        </section>`}
      ${g.wrap_up ? `
        <section class="card guide-prose guide-wrap">
          <h3>Good to know</h3>
          ${paragraphs(g.wrap_up)}
        </section>` : ""}
      ${isDiy ? `
        <p class="hint">Every car is a little different. Check your owner's manual for the exact parts, fluids, and amounts for yours.</p>
        <div class="notice notice-info">${icon("wrench", 18, 2)}
          <span>Not comfortable doing this yourself? That's completely fine. <a href="#/mechanics">See a mechanic</a> near you.</span>
        </div>
        <a class="fab" id="add-task" href="${addTaskHref(g, null)}">${icon("plus", 20, 2.6)}<span>Add task</span></a>` : ""}
    </article>`;

  if (!isDiy) return;

  const videoCard = root.querySelector("#video-card");
  const fab = root.querySelector("#add-task");

  const drawCarBits = async () => {
    const v = vehicle();
    fab.href = addTaskHref(g, v);
    videoCard.innerHTML = `
      <a class="video-link" href="${escapeHtml(videoUrl(g, v))}" target="_blank" rel="noopener">
        <span class="video-icon">${icon("play", 22, 2)}</span>
        <span class="video-text">
          <strong>Watch how-to videos</strong>
          <span>${v ? `Searches YouTube for your ${escapeHtml([v.model_year, v.brand, v.make].filter(Boolean).join(" "))}` : "Searches YouTube for this job"}</span>
        </span>
        ${icon("chevron", 18, 2)}
      </a>
      ${vehicles.length > 1 ? `
        <label class="guide-vehicle">
          <span>For</span>
          <select id="guide-vehicle" aria-label="Car to tune videos and tasks for">
            ${vehicles.map((x) => `<option value="${x.id}" ${x.id === chosenVehicleId ? "selected" : ""}>${escapeHtml(x.label)} · ${escapeHtml(vehicleSpec(x))}</option>`).join("")}
          </select>
        </label>` : ""}
      ${!vehicles.length ? `<p class="hint">Add your car in the <a href="#/garage">Garage</a> to get videos for your exact model.</p>` : ""}
      <p class="guide-scheduled" id="scheduled" hidden></p>`;
    videoCard.querySelector("#guide-vehicle")?.addEventListener("change", (e) => {
      chosenVehicleId = Number(e.target.value);
      drawCarBits();
    });

    // Already on this car's list? Say so, so people don't add a duplicate.
    if (!v || !g.task_name) return;
    try {
      const open = await listTasks({ vehicleId: v.id, completed: false });
      if (!ctx.isCurrent() || vehicle() !== v) return;
      const match = open.find((t) => t.task_name.trim().toLowerCase() === g.task_name.toLowerCase());
      const note = videoCard.querySelector("#scheduled");
      if (match && note) {
        note.innerHTML = `${icon("check", 16, 2.4)}<span>${escapeHtml(match.task_name)} is already on ${escapeHtml(v.label)}'s list${match.due_date ? `, due ${escapeHtml(formatDate(match.due_date))}` : ""}.</span>`;
        note.hidden = false;
      }
    } catch { /* the note is optional */ }
  };
  drawCarBits();
}
