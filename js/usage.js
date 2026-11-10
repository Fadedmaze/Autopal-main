// Usage tracking: how long signed-in users actively spend in AutoPal.
// Time counts only while the app is on screen and the person has touched it in
// the last 5 minutes. Every minute (and when the app is hidden) the time so far
// is added to this visit's row in app_sessions (see
// migrations/20261110_usage_tracking.sql). Coming back after 30+ minutes away
// starts a new visit. Records time, page views and device type only.
// Tracking is best effort: if the database isn't set up or a request fails,
// the app carries on as normal.
import { supabase } from "./supabaseClient.js";

const TICK_MS = 15_000;          // check for activity every 15 s
const SEND_MS = 60_000;          // send the time so far every minute
const IDLE_MS = 5 * 60_000;      // no touch for 5 min = not counted
const NEW_VISIT_MS = 30 * 60_000; // away this long = a new visit next time

let sessionId = null;
let starting = null;
let pendingSeconds = 0;
let pendingPages = 0;
let lastInput = Date.now();
let lastTick = Date.now();
let hiddenAt = null;
let timers = [];
let running = false;
let disabled = false; // the database doesn't have usage tracking yet

function device() {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "phone";
  return "desktop";
}

function installed() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

async function ensureSession() {
  if (sessionId || disabled) return sessionId;
  starting ??= Promise.resolve(supabase.rpc("start_app_session", { p_device: device(), p_installed: installed() }))
    .then(({ data, error }) => {
      if (error) {
        if (/start_app_session|function|schema cache/i.test(error.message ?? "")) disabled = true;
        return null;
      }
      sessionId = data;
      return data;
    })
    .catch(() => null)
    .finally(() => { starting = null; });
  return starting;
}

async function send() {
  if (!running || disabled) return;
  const seconds = Math.round(pendingSeconds);
  const pages = pendingPages;
  if (seconds < 1 && pages < 1) return;
  const id = await ensureSession();
  if (!id) return;
  pendingSeconds -= seconds;
  pendingPages -= pages;
  let error = null;
  try {
    ({ error } = await supabase.rpc("track_app_session", { p_session: id, p_seconds: Math.min(seconds, 120), p_page_views: Math.min(pages, 50) }));
  } catch (err) {
    error = err;
  }
  if (error) { // keep it for the next try
    pendingSeconds += seconds;
    pendingPages += pages;
  }
}

function tick() {
  const now = Date.now();
  const elapsed = Math.min(now - lastTick, TICK_MS * 2);
  lastTick = now;
  if (document.visibilityState === "visible" && now - lastInput < IDLE_MS) pendingSeconds += elapsed / 1000;
}

function onInput() { lastInput = Date.now(); }

function onVisibility() {
  if (document.visibilityState === "hidden") {
    tick();
    hiddenAt = Date.now();
    send();
  } else {
    if (hiddenAt && Date.now() - hiddenAt > NEW_VISIT_MS) { // new visit, starting on this page
      sessionId = null;
      pendingPages += 1;
    }
    hiddenAt = null;
    lastTick = Date.now();
    lastInput = Date.now();
  }
}

function onPage() { pendingPages += 1; }

const INPUTS = ["pointerdown", "keydown", "scroll", "touchstart"];

// Start when someone is signed in. Safe to call more than once.
export function startUsageTracking() {
  if (running) return;
  running = true;
  lastInput = lastTick = Date.now();
  pendingPages += 1; // the page they landed on
  INPUTS.forEach((e) => window.addEventListener(e, onInput, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("hashchange", onPage);
  window.addEventListener("pagehide", send);
  timers = [setInterval(tick, TICK_MS), setInterval(send, SEND_MS)];
}

// Stop on sign-out (sends what's left first).
export async function stopUsageTracking() {
  if (!running) return;
  tick();
  await send();
  running = false;
  timers.forEach(clearInterval);
  timers = [];
  INPUTS.forEach((e) => window.removeEventListener(e, onInput, { capture: true }));
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("hashchange", onPage);
  window.removeEventListener("pagehide", send);
  sessionId = null;
  pendingSeconds = 0;
  pendingPages = 0;
}
