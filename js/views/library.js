// Library: guides grouped into DIY Maintenance and Dashboard Lights. /library/:slug
// opens one guide. Every DIY guide carries a "see a mechanic" note.
import { listGuides } from "../data.js";
import { appBar, escapeHtml, icon, loading } from "../ui.js";

const CATEGORIES = [
  { id: "diy", label: "DIY Maintenance", icon: "wrench" },
  { id: "dashboard", label: "Dashboard Lights", icon: "alert" },
];
const SEVERITY = {
  stop: { label: "Pull over now", text: "Stop driving as soon as it's safe to do so." },
  soon: { label: "Check soon", text: "Safe to drive carefully, but get it checked soon." },
  info: { label: "Good to know", text: "Usually not urgent." },
};

let guidesCache = null;
let category = "diy";
let searchQuery = "";

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
              ? "Search DIY maintenance..."
              : "Search dashboard lights..."}"
            aria-label="Search guides"
            value="${escapeHtml(searchQuery)}"
          />
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
                    ${g.time_estimate ? `<small>${escapeHtml(g.time_estimate)}</small>` : ""}
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
  };

  draw();
}

function renderGuide(root, ctx, g) {
  if (!g) return ctx.navigate("#/library", { replace: true });
  category = g.category;
  const isDiy = g.category === "diy";
  const sev = g.severity ? SEVERITY[g.severity] : null;
  root.innerHTML = `
    ${appBar({ title: g.title, back: { href: "#/library", label: "Library" } })}
    <article class="content guide">
      <p class="guide-summary">${escapeHtml(g.summary)}</p>
      ${sev ? `<div class="notice notice-${g.severity === "stop" ? "danger" : "warn"}">${icon("alert", 18, 2)}<span><strong>${sev.label}.</strong> ${sev.text}</span></div>` : ""}
      ${isDiy && (g.time_estimate || g.tools.length) ? `
        <section class="card">
          ${g.time_estimate ? `<p class="guide-meta"><strong>Time:</strong> about ${escapeHtml(g.time_estimate)}</p>` : ""}
          ${g.tools.length ? `<div><strong>You'll need</strong><ul class="tools">${g.tools.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>` : ""}
        </section>` : ""}
      <section class="card">
        <h3>${isDiy ? "Steps" : "What to do"}</h3>
        <ol class="steps">${g.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
      </section>
      ${isDiy ? `
        <div class="notice notice-info">${icon("wrench", 18, 2)}
          <span>Not comfortable doing this yourself? That's completely fine. <a href="#/mechanics">See a mechanic</a> near you.</span>
        </div>` : ""}
    </article>`;
}
