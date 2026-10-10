// Shared UI helpers: escaping, formatting, icons, toasts and the confirm dialog.
import { distanceUnit } from "./prefs.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ---- Dates -------------------------------------------------------------
// Task dates are plain "YYYY-MM-DD" strings. Always build them from local
// calendar parts; never via toISOString(), which shifts to UTC in the evening.

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function daysBetween(fromISO, toISO) {
  return Math.round((parseISODate(toISO) - parseISODate(fromISO)) / 86400000);
}

export function formatDate(iso, opts = { month: "short", day: "numeric", year: "numeric" }) {
  if (!iso) return "";
  return parseISODate(iso).toLocaleDateString(undefined, opts);
}

// "Overdue 3 days", "Due today", "Due in 5 days", "Due Mar 4"
export function dueLabel(iso) {
  if (!iso) return "No due date";
  const diff = daysBetween(todayISO(), iso);
  if (diff < 0) return `Overdue ${-diff} day${diff === -1 ? "" : "s"}`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 14) return `Due in ${diff} days`;
  return `Due ${formatDate(iso, { month: "short", day: "numeric" })}`;
}

export function dueTone(iso, remindDays = 7) {
  if (!iso) return "muted";
  const diff = daysBetween(todayISO(), iso);
  if (diff < 0) return "danger";
  if (diff <= remindDays) return "warn";
  return "muted";
}

// ---- Numbers -------------------------------------------------------------

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
export function formatMoney(value) {
  return money.format(Number(value ?? 0));
}

const KM_PER_MILE = 1.609344;

// Odometer readings are stored in miles; shown in the user's chosen unit.
export function formatMileage(miles) {
  if (miles === null || miles === undefined) return "";
  const km = distanceUnit() === "km";
  return `${Math.round(km ? miles * KM_PER_MILE : miles).toLocaleString()} ${km ? "km" : "mi"}`;
}

export function formatDistance(miles) {
  const km = distanceUnit() === "km";
  const v = Number(miles) * (km ? KM_PER_MILE : 1);
  const u = km ? "km" : "miles";
  if (v < 0.1) return `Less than 0.1 ${u} away`;
  return `${v < 10 ? v.toFixed(2) : v.toFixed(1)} ${u} away`;
}

// Inputs are in the user's unit; storage is miles.
export function toStoredMiles(value) {
  return distanceUnit() === "km" ? Math.round(value / KM_PER_MILE) : Math.round(value);
}
export function fromStoredMiles(miles) {
  if (miles === null || miles === undefined) return "";
  return distanceUnit() === "km" ? Math.round(miles * KM_PER_MILE) : miles;
}

// ---- Vehicles ------------------------------------------------------------

const TINTS = [
  ["#e8f0fe", "#1f6feb"],
  ["#fef3e2", "#c26a00"],
  ["#e7f6ec", "#15803d"],
  ["#f3e8ff", "#7e22ce"],
  ["#fde8ef", "#be185d"],
];

export function vehicleTint(index) {
  const [tint, ink] = TINTS[index % TINTS.length];
  return `--tint:${tint};--tint-ink:${ink}`;
}

export function vehicleSpec(v) {
  return [v.model_year, v.brand, v.make, v.model].filter(Boolean).join(" ");
}

const TRUCK = /\b(f-?\d{3}|silverado|sierra|ram|tacoma|tundra|ranger|frontier|colorado|canyon|ridgeline|titan|gladiator|maverick|santa cruz)\b/i;
const SUV = /\b(rav4|cr-?v|hr-?v|pilot|explorer|expedition|escape|edge|bronco|highlander|4runner|sequoia|tahoe|suburban|traverse|equinox|blazer|yukon|acadia|terrain|tucson|santa fe|palisade|sorento|telluride|sportage|forester|outback|ascent|crosstrek|cx-\d+|rogue|pathfinder|murano|wrangler|cherokee|grand cherokee|durango|x\d|q\d|gx|rx|nx|model y|model x)\b/i;

export function vehicleIcon(v, size = 30) {
  const text = `${v.make ?? ""} ${v.model ?? ""}`;
  if (TRUCK.test(text)) return icon("truck", size, 1.8);
  if (SUV.test(text)) return icon("suv", size, 1.8);
  return icon("car", size, 1.8);
}

// ---- Icons (inline SVG, stroke = currentColor) -----------------------------

const PATHS = {
  car: '<path d="M5 17h14M3 13l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1M3 13v4a1 1 0 0 0 1 1h1M3 13h18"/><circle cx="7" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/>',
  truck: '<path d="M2 16V9a1 1 0 0 1 1-1h9v8M12 10h5l3 3.5V16a1 1 0 0 1-1 1h-1M2 16a1 1 0 0 0 1 1h1M8.5 17h7"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/>',
  suv: '<path d="M3 16v-4l1.5-4.5A2 2 0 0 1 6.4 6H16l3 4 2 1v5a1 1 0 0 1-1 1h-1M3 16a1 1 0 0 0 1 1h1M3 12h18M8.8 17h6.4"/><circle cx="7" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/>',
  home: '<path d="M3 10.5 12 3l9 7.5M5 9v11h14V9"/><path d="M10 20v-6h4v6"/>',
  garage: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8M7 17h10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  dollar: '<path d="M12 3v18M16.5 7.5C16 6 14.3 5 12 5c-2.8 0-4.5 1.3-4.5 3.2 0 4.3 9 2.3 9 7 0 2-1.9 3.3-4.5 3.3-2.4 0-4.2-1.1-4.7-2.8"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  directions: '<path d="M12 2 2 12l10 10 10-10z"/><path d="M9 13v-2.5h5V8l3 3.5-3 3.5v-2.5h-3V13z"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17.5v.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  tire: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 2h13v-4M8 7h7M8 11h5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
};

export function icon(name, size = 20, stroke = 2) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ""}</svg>`;
}

export function stars(rating) {
  if (rating === null || rating === undefined) return "";
  const r = Number(rating);
  let out = "";
  for (let i = 1; i <= 5; i++) {
    const fill = r >= i ? "full" : r >= i - 0.5 ? "half" : "empty";
    out += `<span class="star star-${fill}">${icon("star", 14, 1.6)}</span>`;
  }
  return `<span class="stars" aria-label="${r.toFixed(1)} out of 5 stars">${out}<span class="stars-num">${r.toFixed(1)}</span></span>`;
}

// ---- Page chrome ----------------------------------------------------------

export function appBar({ title, sub = "", back = null, action = "" }) {
  const backHtml = back
    ? `<a class="back" href="${escapeHtml(back.href)}">${icon("back", 18, 2.4)}${escapeHtml(back.label)}</a>`
    : "";
  return `
    <header class="appbar">
      <div class="appbar-row">${backHtml}<span class="appbar-action">${action}</span></div>
      <h1>${escapeHtml(title)}</h1>
      ${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ""}
    </header>`;
}

export function emptyState({ iconName, title, body }) {
  return `
    <div class="empty">
      <div class="empty-art">${icon(iconName, 72, 1.3)}</div>
      <h2>${escapeHtml(title)}</h2>
      <p>${body}</p>
    </div>`;
}

export function loading() {
  return `<div class="loading" role="status"><span class="spinner"></span>Loading…</div>`;
}

// Friendly text for Supabase / network errors.
export function errorMessage(err) {
  if (!err) return "Something went wrong.";
  if (typeof err === "string") return err;
  const msg = err.message || err.error_description || "";
  if (/failed to fetch|network/i.test(msg)) return "Can't reach the server. Check your connection and try again.";
  if (/invalid login credentials/i.test(msg)) return "That email and password don't match an account.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first. Check your inbox for the link.";
  if (/already registered/i.test(msg)) return "An account with that email already exists. Try signing in.";
  if (/rate limit/i.test(msg)) return "Too many attempts. Please wait a few minutes and try again.";
  // Signup trigger rejected the username (taken in a race, or invalid).
  if (/database error saving new user/i.test(msg)) return "That username is already taken. Please pick a different one.";
  return msg || "Something went wrong.";
}

// ---- Toasts & dialogs -----------------------------------------------------

export function toast(message, tone = "info") {
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast toast-${tone}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.classList.add("out"), 2800);
  setTimeout(() => el.remove(), 3200);
}

// Resolves true/false. A fresh dialog each time so old listeners never stack.
export function confirmDialog({ title, body, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "dialog";
    dlg.innerHTML = `
      <form method="dialog">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(body)}</p>
        <div class="dialog-actions">
          <button value="cancel" class="btn btn-ghost">Cancel</button>
          <button value="ok" class="btn ${danger ? "btn-danger" : ""}">${escapeHtml(confirmLabel)}</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => {
      resolve(dlg.returnValue === "ok");
      dlg.remove();
    });
    dlg.showModal();
  });
}

// Disable a button while an async action runs; prevents double-submits.
export async function withBusy(button, fn) {
  if (button.disabled) return;
  const label = button.innerHTML;
  button.disabled = true;
  button.classList.add("busy");
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.classList.remove("busy");
    button.innerHTML = label;
  }
}
