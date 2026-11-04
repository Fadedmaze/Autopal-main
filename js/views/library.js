// Discover (formerly Library): guides grouped into DIY Maintenance and Dashboard
// Lights. /library/:slug opens one guide. The Dashboard Lights tab also opens the
// camera scanner (views/discover.js). Every DIY guide carries a "see a mechanic" note.
// DIY guides show difficulty, safety notes, a YouTube search for the selected car, and an "Add task" button that prefills the New Task form.
import { listGuides, listWarningLights, getProfile, listVehicles, listTasks } from "../data.js";
import { appBar, escapeHtml, icon, loading, formatDate, vehicleSpec } from "../ui.js";
import { openScanner } from "./discover.js";
import { diagramFor } from "../guideDiagrams.js";

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
let warningLightsCache = null;
let category = "diy";
let searchQuery = "";
let chosenVehicleId = null; // the car the guide page is tuned to, remembered for this visit

function dashboardIcon(guide) {
  const name = `${guide.title} ${guide.slug}`.toLowerCase();

  const svg = (content) => `
    <svg width="28" height="28" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      ${content}
    </svg>`;

  // Oil pressure: oil can with a drop
  if (name.includes("oil")) {
    return svg(`
      <path d="M3 11h11l3-3 2 2-3 4v3H6l-3-3z"/>
      <path d="M7 11V7h5"/>
      <path d="M20 15c0 1-1.5 2-1.5 3.5a1.5 1.5 0 0 0 3 0C21.5 17 20 16 20 15z"/>
    `);
  }

  // Battery
  if (name.includes("battery") || name.includes("charging")) {
    return svg(`
      <rect x="3" y="7" width="18" height="11" rx="1"/>
      <path d="M7 7V5h3v2M14 7V5h3v2"/>
      <path d="M7 12h4M9 10v4M15 12h4"/>
    `);
  }

  // Check engine
  if (name.includes("engine")) {
    return svg(`
      <path d="M5 9h3V6h7v3h3l2 3v6H5l-2-3v-4z"/>
      <path d="M10 6V4h5M20 12h2"/>
    `);
  }

  // Brakes
  if (name.includes("brake") || name.includes("abs")) {
    return svg(`
      <circle cx="12" cy="12" r="7"/>
      <path d="M3 7a10 10 0 0 0 0 10M21 7a10 10 0 0 1 0 10"/>
      <path d="M12 8v5M12 16h.01"/>
    `);
  }

  // Tire pressure
  if (name.includes("tire") || name.includes("tpms")) {
    return svg(`
      <path d="M6 5C3 8 3 16 6 19h12c3-3 3-11 0-14"/>
      <path d="M12 8v6M12 17h.01"/>
    `);
  }

  // Temperature
  if (name.includes("temperature") || name.includes("coolant")) {
    return svg(`
      <path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>
      <path d="M12 9v8"/>
    `);
  }

  // Other warnings keep the existing alert icon
  return icon("alert", 24, 2);
}

export default async function render(root, ctx) {
  root.innerHTML = loading();
  try {
    const [guides, lights] = await Promise.all([
      guidesCache ?? listGuides(),
      warningLightsCache ?? listWarningLights()
    ]);
  
    guidesCache = guides;
    warningLightsCache = lights;
  } catch {
    if (!ctx.isCurrent()) return;
    root.innerHTML = `
      ${appBar({ title: "Discover", back: { href: "#/home", label: "Home" } })}
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

  const wantedTab = ctx.query.get("tab");
  if (CATEGORIES.some((c) => c.id === wantedTab)) category = wantedTab;

  if (ctx.params.slug) {
  const guide = guidesCache.find((g) => g.slug === ctx.params.slug);

  if (guide) return renderGuide(root, ctx, guide);

  const light = warningLightsCache.find(
    (l) => `warning-${l.slug}` === ctx.params.slug
  );

  if (light) {
    return renderGuide(root, ctx, {
      slug: `warning-${light.slug}`,
      category: "dashboard",
      title: light.name,
      summary: light.meaning,
      severity: light.severity,
      steps: [light.action, light.drive_advice].filter(Boolean)
    });
  }

  return ctx.navigate("#/library", { replace: true });
}

  // Cars, so the scanner can be tuned to the selected car's make. Optional:
  // the lists and the scanner still work without them.
  let vehicles = [];
  try {
    const [profile, list] = await Promise.all([getProfile(), listVehicles()]);
    vehicles = list;
    if (!vehicles.some((v) => v.id === chosenVehicleId)) {
      chosenVehicleId = vehicles.some((v) => v.id === profile.active_vehicle_id) ? profile.active_vehicle_id : vehicles[0]?.id ?? null;
    }
  } catch { /* scan without car tuning */ }
  if (!ctx.isCurrent()) return;
  const vehicle = () => vehicles.find((v) => v.id === chosenVehicleId) ?? null;
  const brandKey = () => (vehicle()?.brand ?? "").trim().toLowerCase();
  const bySlug = new Map(warningLightsCache.map((l) => [l.slug, l]));
  let scanner = null;

  const draw = () => {
  const dashboardGuides = warningLightsCache.map((light) => ({
    slug: `warning-${light.slug}`,
    category: "dashboard",
    title: light.name,
    summary: light.meaning,
    severity: light.severity,
    steps: [
      light.action,
      light.drive_advice
    ].filter(Boolean),
    warningLight: light
  }));

  const guides = category === "dashboard"
    ? dashboardGuides
    : guidesCache.filter((g) => g.category === "diy");

    root.innerHTML = `
      ${appBar({ title: "Discover", sub: "Learn the basics of keeping your car healthy.", back: { href: "#/home", label: "Home" } })}
      <div class="content">
        <div class="segmented" role="tablist" aria-label="Guide categories">
          ${CATEGORIES.map((c) => `<button role="tab" type="button" data-cat="${c.id}" aria-selected="${c.id === category}">${c.label}</button>`).join("")}
        </div>

        <div class="guide-search">
          <span class="search-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </span>
          <input
            type="search"
            id="guide-search"
            placeholder="${category === "diy"
              ? "Search DIY Maintenance..."
              : "Search Dashboard Lights..."}"
            aria-label="Search guides"
            value="${escapeHtml(searchQuery)}"
          />
        </div>

        ${category === "dashboard" ? scanCard(vehicles, vehicle()) : ""}


        ${guides.length ? `
          <ul class="guide-list">
            ${guides.map((g) => `
              <li>
                <a class="guide-card" href="#/library/${encodeURIComponent(g.slug)}">
                  <span class="guide-icon ${g.severity ? `sev-${g.severity}` : ""}">${g.category === "diy" ? icon("wrench", 20, 2) : dashboardIcon(g)}</span>
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

      const searchInput = root.querySelector("#guide-search");
      const guideCards = root.querySelectorAll(".guide-list li");
  
      const filterGuides = () => {
        const query = searchInput.value.toLowerCase().trim();
        searchQuery = searchInput.value;
  
        let visibleCount = 0;
  
        guideCards.forEach((item) => {
          const matches = item.textContent.toLowerCase().includes(query);
          item.hidden = !matches;
          if (matches) visibleCount++;
        });
  
        const list = root.querySelector(".guide-list");
        if (!list) return;
  
        let emptyMessage = root.querySelector("#search-empty");
        if (!emptyMessage) {
          emptyMessage = document.createElement("p");
          emptyMessage.id = "search-empty";
          emptyMessage.className = "muted-box";
          list.after(emptyMessage);
        }
  
        emptyMessage.textContent = "No matching guides found.";
        emptyMessage.hidden = visibleCount > 0;
      };
  
      searchInput.addEventListener("input", filterGuides);
      filterGuides();

    root.querySelectorAll("[data-cat]").forEach((b) => {
      b.addEventListener("click", () => {
        category = b.dataset.cat;
        searchQuery = "";
        draw();
      });
    });

    root.querySelector("#start-scan")?.addEventListener("click", () => {
      scanner?.close();
      scanner = openScanner({ vehicle, brandKey, bySlug, ctx, onClose: () => { scanner = null; } });
    });
    root.querySelector("#scan-vehicle")?.addEventListener("change", (e) => {
      chosenVehicleId = Number(e.target.value);
      draw();
    });
  };

  draw();
  return () => scanner?.close(); // turn the camera off when leaving the page
}

// Top of the Dashboard Lights tab: open the camera scanner.
function scanCard(vehicles, v) {
  return `
    <section class="scan-hero scan-hero-compact">
      <span class="scan-hero-icon">${icon("scan", 30, 1.8)}</span>
      <h2>Scan your dashboard</h2>
      <p>Turn the car on so the lights are glowing, then hold your phone about a foot from the dashboard. Yellow squares appear around the lights we find. Tap one to see what it means.</p>
      <button type="button" class="btn" id="start-scan">${icon("camera", 18, 2)}Scan My Dashboard</button>
      ${vehicles.length ? `
        <div class="scan-vehicle">
          <span>Tuned for</span>
          ${vehicles.length > 1
            ? `<select id="scan-vehicle" aria-label="Vehicle to tune results for">${vehicles.map((x) => `<option value="${x.id}" ${x.id === v?.id ? "selected" : ""}>${escapeHtml(x.label)} · ${escapeHtml(vehicleSpec(x))}</option>`).join("")}</select>`
            : `<strong>${escapeHtml(v.label)} · ${escapeHtml(vehicleSpec(v))}</strong>`}
        </div>`
        : `<p class="hint">Add your car in the <a href="#/garage">Garage</a> so results can be tuned to its make.</p>`}
    </section>`;
}

// Labeled diagram for a DIY guide (js/guideDiagrams.js), or an image file if a
// guide's image_path is set in the database.
function guideFigure(g) {
  const d = g.category === "diy" ? diagramFor(g.slug) : null;
  if (d) {
    return `
      <figure class="card guide-diagram">
        <h3>What to look for</h3>
        <div class="diagram" role="img" aria-label="${escapeHtml(d.alt)}">${d.svg}</div>
        ${d.caption ? `<figcaption>${escapeHtml(d.caption)}</figcaption>` : ""}
      </figure>`;
  }
  return g.image_path ? `<figure class="guide-figure"><img src="${escapeHtml(g.image_path)}" alt="Diagram for ${escapeHtml(g.title)}" loading="lazy"></figure>` : "";
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
  const isDashboard = g.category === "dashboard";
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
    ${appBar({ title: g.title, back: { href: "#/library", label: "Discover" } })}
    <article class="content guide ${isDiy || isDashboard ? "has-fab" : ""}">
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
      ${guideFigure(g)}
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
        </div>` : ""}
      ${isDiy || isDashboard ? `<a class="fab" id="add-task" href="${addTaskHref(g, null)}">${icon("plus", 20, 2.6)}<span>Add task</span></a>` : ""}
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
