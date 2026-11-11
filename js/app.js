// Hash router + app shell. Each view module exports a default
// `render(root, ctx)` that may return a cleanup function.
import { initAuth, currentSession } from "./auth.js";
import { getProfile } from "./data.js";
import { setDistanceUnit, applyTheme } from "./prefs.js";
import { icon, escapeHtml, errorMessage } from "./ui.js";
import { openSettings } from "./settings.js";
import { startUsageTracking, stopUsageTracking } from "./usage.js";

const ROUTES = [
  // Public
  { path: "/signin", view: () => import("./views/auth.js"), public: true, mode: "signin" },
  { path: "/signup", view: () => import("./views/auth.js"), public: true, mode: "signup" },
  { path: "/forgot", view: () => import("./views/auth.js"), public: true, mode: "forgot" },
  { path: "/reset-password", view: () => import("./views/resetPassword.js") },
  // Signed in
  { path: "/home", view: () => import("./views/home.js"), settings: true },
  { path: "/garage", view: () => import("./views/garage.js"), tab: "garage", settings: true },
  { path: "/vehicles/new", view: () => import("./views/vehicleForm.js"), tab: "garage", nav: false },
  { path: "/vehicles/:id", view: () => import("./views/vehicle.js"), tab: "garage" },
  { path: "/vehicles/:id/edit", view: () => import("./views/vehicleForm.js"), tab: "garage", nav: false },
  { path: "/vehicles/:id/photo", view: () => import("./views/photo.js"), tab: "garage", nav: false },
  { path: "/tasks", view: () => import("./views/tasks.js"), tab: "tasks", settings: true },
  { path: "/tasks/new", view: () => import("./views/taskForm.js"), nav: false },
  { path: "/tasks/:id", view: () => import("./views/taskForm.js"), nav: false },
  { path: "/budget", view: () => import("./views/budget.js") },
  { path: "/mechanics", view: () => import("./views/mechanics.js"), tab: "mechanics", settings: true },
  { path: "/discover", view: () => import("./views/discover.js"), tab: "library" }, // redirects to the Dashboard Lights tab
  { path: "/library", view: () => import("./views/library.js"), tab: "library", settings: true },
  { path: "/library/:slug", view: () => import("./views/library.js"), tab: "library" },
  { path: "/profile", view: () => import("./views/profile.js"), tab: "profile", settings: true },
  { path: "/profile/password", view: () => import("./views/profile.js"), tab: "profile", mode: "password", nav: false },
  { path: "/profile/notifications", view: () => import("./views/profile.js"), tab: "profile", mode: "notifications", nav: false },
  { path: "/profile/insurance", view: () => import("./views/profile.js"), tab: "profile", mode: "insurance", settings: true }, // Profile with the insurance pop-up open
];

// Bottom bar, left to right, per the Home spec.
const TABS = [
  { id: "profile", label: "Profile", icon: "user", href: "#/profile" },
  { id: "garage", label: "Garage", icon: "garage", href: "#/garage" },
  { id: "tasks", label: "Tasks", icon: "tasks", href: "#/tasks" },
  { id: "mechanics", label: "Find Mechanic", icon: "pin", href: "#/mechanics" },
  { id: "library", label: "Discover", icon: "book", href: "#/library" },
];

const navEl = document.getElementById("nav");
const viewEl = document.getElementById("view");
let cleanup = null;
let settingsCleanup = null;
let renderSeq = 0;
let recovering = false;
let prefsLoaded = false;
let currentHash = null;
let previousHash = null; // last in-app screen, for "save and go back"

function match(pathname) {
  for (const route of ROUTES) {
    const names = [];
    const re = new RegExp("^" + route.path.replace(/:(\w+)/g, (_, n) => (names.push(n), "([^/]+)")) + "$");
    const m = pathname.match(re);
    if (m) return { route, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export function navigate(hash, { replace = false } = {}) {
  if (replace) {
    history.replaceState(null, "", hash);
    render();
  } else if (location.hash === hash) {
    render();
  } else {
    location.hash = hash;
  }
}

function renderNav(route) {
  const show = currentSession() && !route.public && route.nav !== false;
  document.body.classList.toggle("has-nav", Boolean(show));
  if (!show) {
    navEl.innerHTML = "";
    return;
  }
  navEl.innerHTML = `
    <a class="brand" href="#/home">${icon("wrench", 22, 2)}<span>AutoPal</span></a>
    <a href="#/home" class="tab tab-home ${!route.tab ? "active" : ""}">${icon("home", 22, 1.9)}<span>Home</span></a>
    ${TABS.map((t) => `
      <a href="${t.href}" class="tab ${t.id === route.tab ? "active" : ""}" ${t.id === route.tab ? 'aria-current="page"' : ""}>
        ${icon(t.icon, 22, 1.9)}<span>${t.label}</span>
      </a>`).join("")}`;
}

// Settings (tire) button on the main pages (routes with settings: true), not on
// sub-pages. Home draws its own; for the others it goes in the page header, or
// in the map's top bar on Find Mechanic. Views draw their headers themselves and
// some redraw them (e.g. switching Discover tabs), so it's re-added when needed.
function mountSettingsButton(page) {
  const place = () => {
    if (page.querySelector(".tire-btn")) return;
    const host = page.querySelector(".map-top") ?? page.querySelector("header.appbar");
    if (!host) return; // still loading, or an error screen
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tire-btn page-settings";
    btn.setAttribute("aria-label", "Settings");
    btn.innerHTML = icon("tire", 24, 1.7);
    btn.addEventListener("click", () => openSettings());
    if (host.classList.contains("map-top")) {
      btn.classList.add("map-settings");
    } else {
      host.classList.add("has-settings");
    }
    host.append(btn);
  };
  place();
  const watcher = new MutationObserver(place);
  watcher.observe(page, { childList: true, subtree: true });
  return () => watcher.disconnect();
}

async function render() {
  const seq = ++renderSeq;
  const raw = location.hash.slice(1);
  // Supabase auth redirects land with #access_token=... / #error=...; supabase-js
  // consumes and clears that fragment, so just wait for the auth event.
  if (/(^|&)error=/.test(raw)) {
    // e.g. an expired confirmation or reset link.
    const reason = new URLSearchParams(raw).get("error_description") || "That link is invalid or has expired.";
    return navigate(`#/signin?notice=${encodeURIComponent(reason)}`, { replace: true });
  }
  if (/(^|&)access_token=/.test(raw)) {
    setTimeout(() => {
      if (location.hash.includes("access_token=")) navigate("#/home", { replace: true });
    }, 2500);
    return;
  }

  const [pathname, queryString = ""] = raw.split("?");
  const found = match(pathname || "/");
  const signedIn = Boolean(currentSession());

  if (!found) return navigate(signedIn ? "#/home" : "#/signin", { replace: true });
  if (!found.route.public && !signedIn) return navigate("#/signin", { replace: true });
  if (found.route.public && signedIn && !recovering) return navigate("#/home", { replace: true });

  if (cleanup) {
    try { cleanup(); } catch { /* view already gone */ }
    cleanup = null;
  }
  // Units come from the profile; load them once per sign-in before drawing numbers.
  if (signedIn && !found.route.public && !prefsLoaded) {
    try {
      setDistanceUnit((await getProfile()).distance_unit);
      prefsLoaded = true;
    } catch { /* screens show their own load errors */ }
    if (seq !== renderSeq) return;
  }
  renderNav(found.route);
  if (signedIn) startUsageTracking(); // time spent in the app (js/usage.js)
  if (location.hash !== currentHash) {
    previousHash = currentHash;
    currentHash = location.hash;
  }

  // A fresh element per route, so listeners from the previous screen can't linger.
  const page = document.createElement("div");
  page.className = `page page-${pathname.split("/")[1] || "root"}`;
  viewEl.replaceChildren(page);
  window.scrollTo(0, 0);
  settingsCleanup?.();
  settingsCleanup = found.route.settings ? mountSettingsButton(page) : null;

  const ctx = {
    params: found.params,
    query: new URLSearchParams(queryString),
    mode: found.route.mode,
    navigate,
    goBack: (fallback) => navigate(previousHash && previousHash !== location.hash ? previousHash : fallback, { replace: true }),
    isCurrent: () => seq === renderSeq,
  };
  try {
    const mod = await found.route.view();
    if (!ctx.isCurrent()) return;
    const result = await mod.default(page, ctx);
    if (ctx.isCurrent() && typeof result === "function") cleanup = result;
  } catch (err) {
    console.error(err);
    if (!ctx.isCurrent()) return;
    page.innerHTML = `
      <div class="error-state">
        <h2>Something Went Wrong</h2>
        <p>${escapeHtml(errorMessage(err))}</p>
        <button class="btn" id="retry">Try Again</button>
      </div>`;
    page.querySelector("#retry").addEventListener("click", render);
  }
}

async function start() {
  applyTheme();
  await initAuth((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      navigate("#/reset-password", { replace: true });
    } else if (event === "SIGNED_OUT") {
      stopUsageTracking();
      recovering = false;
      prefsLoaded = false;
      navigate("#/signin", { replace: true });
    } else if (event === "SIGNED_IN" && /(^|&)(access_token|error)=/.test(location.hash.slice(1))) {
      // Arrived from an email confirmation link.
      navigate("#/home", { replace: true });
    }
  });
  window.addEventListener("hashchange", render);
  render();
}

export function endRecovery() {
  recovering = false;
}

start();

if ("serviceWorker" in navigator && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
