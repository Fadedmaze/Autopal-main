// Task reminders: when each task should remind you, and the three ways it does.
//  1. In the app: Home shows a "Reminders" sheet for tasks whose reminder date has arrived
//     (once per task and due date, so it doesn't nag on every visit).
//  2. On this device: an opt-in system notification for the same tasks when AutoPal opens.
//     Without a push server, a web app can only notify while it's running.
//  3. In your calendar: an .ics file with an alarm at 9 AM on the reminder day. This one
//     fires even when AutoPal is closed, because the phone's calendar app delivers it.
import { escapeHtml, icon, todayISO, addDays, daysBetween, formatDate, dueLabel } from "./ui.js";

export const MAX_REMIND_DAYS = 60; // matches the database check on maintenance_tasks

// Choices shown in the task form and in Profile → Notifications (days before the due date).
export const REMIND_CHOICES = [
  [0, "On the due date"],
  [1, "1 day before"],
  [2, "2 days before"],
  [3, "3 days before"],
  [7, "1 week before"],
  [14, "2 weeks before"],
  [30, "1 month before"],
];

export function remindLabel(days) {
  const preset = REMIND_CHOICES.find(([d]) => d === days);
  if (preset) return preset[1];
  return `${days} days before`;
}

// Short form for task rows: "Due day", "1d", "1w", "2w", "1mo", "10d".
export function remindShort(days) {
  if (days === 0) return "due day";
  if (days === 30) return "1mo";
  if (days % 7 === 0) return `${days / 7}w`;
  return `${days}d`;
}

// The task's own window wins; null means "use my default".
export function remindDaysFor(task, defaultDays) {
  return task.remind_days_before ?? defaultDays;
}

export function reminderDate(task, defaultDays) {
  if (!task.due_date) return null;
  return addDays(task.due_date, -remindDaysFor(task, defaultDays));
}

// One sentence for the task form, e.g. "We'll remind you on Fri, Nov 7."
export function reminderPreview(dueISO, days, { enabled = true } = {}) {
  if (!dueISO) return "Pick a due date to see when you'll be reminded";
  if (!enabled) return "Reminders are turned off. Turn them on in Profile → Notification Settings.";
  const on = addDays(dueISO, -days);
  const today = todayISO();
  if (daysBetween(today, dueISO) < 0) return "This task is already overdue, so it will show as overdue right away.";
  if (on < today) return `That date (${formatDate(on, { weekday: "short", month: "short", day: "numeric" })}) has passed, so you'll be reminded right away.`;
  if (on === today) return "You'll be reminded today.";
  return `We'll remind you on ${formatDate(on, { weekday: "short", month: "short", day: "numeric" })}.`;
}

// Open tasks whose reminder date is today or earlier (overdue ones included).
export function dueReminders(tasks, settings) {
  if (!settings?.task_reminders_enabled) return [];
  const today = todayISO();
  return tasks
    .filter((t) => !t.is_completed && t.due_date && reminderDate(t, settings.reminder_days_before) <= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

// ---- "Already reminded" memory (this device only) -------------------------------
// Keyed by task id + due date, so a rescheduled task reminds again.
const SEEN_KEY = "autopal.remindersSeen";
const NOTIFY_KEY = "autopal.deviceNotifications";

function readSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")); } catch { return new Set(); }
}
function writeSeen(set) {
  // Keep the newest 300 so the list can't grow forever.
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-300))); } catch { /* private mode */ }
}
const seenKey = (t) => `${t.id}:${t.due_date}`;

export function deviceNotificationsOn() {
  try {
    return localStorage.getItem(NOTIFY_KEY) === "on" && "Notification" in window && Notification.permission === "granted";
  } catch { return false; }
}

// Ask the browser for permission. Resolves "on", "denied" or "unsupported".
export async function enableDeviceNotifications() {
  if (!("Notification" in window)) return "unsupported";
  const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (result !== "granted") return "denied";
  try { localStorage.setItem(NOTIFY_KEY, "on"); } catch { /* private mode */ }
  return "on";
}

export function disableDeviceNotifications() {
  try { localStorage.removeItem(NOTIFY_KEY); } catch { /* private mode */ }
}

// Called by Home after it loads. Shows each due reminder once: a system notification
// if the user turned those on, and the in-app sheet either way.
export async function announceReminders(tasks, settings, vehicles) {
  const seen = readSeen();
  const fresh = dueReminders(tasks, settings).filter((t) => !seen.has(seenKey(t)));
  if (!fresh.length) return;
  fresh.forEach((t) => seen.add(seenKey(t)));
  writeSeen(seen);

  const byId = new Map(vehicles.map((v) => [v.id, v]));
  if (deviceNotificationsOn()) await notifyDevice(fresh, byId).catch(() => {});
  showReminderSheet(fresh, byId);
}

async function notifyDevice(tasks, byId) {
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
  const show = (title, options) => (reg ? reg.showNotification(title, options) : new Notification(title, options));
  const opts = (body, tag) => ({ body, tag, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", data: { url: "./#/tasks" } });
  // A few separate notifications read better than one long one; more than 3 get summarized.
  if (tasks.length > 3) {
    return show(`${tasks.length} maintenance tasks need attention`, opts(tasks.map((t) => t.task_name).slice(0, 5).join(", "), "autopal-reminders"));
  }
  for (const t of tasks) {
    const car = byId.get(t.vehicle_id)?.label;
    await show(t.task_name, opts(`${dueLabel(t.due_date)}${car ? ` · ${car}` : ""}`, `autopal-task-${t.id}`));
  }
}

function showReminderSheet(tasks, byId) {
  if (document.querySelector("dialog[open]")) return; // never stack on another dialog
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.innerHTML = `
    <div class="sheet-body left">
      <div class="sheet-head">
        <h2>${icon("bell", 20, 2)}Reminders</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close", 18, 2.2)}</button>
      </div>
      <ul class="reminder-list">
        ${tasks.slice(0, 6).map((t) => {
          const overdue = daysBetween(todayISO(), t.due_date) < 0;
          const car = byId.get(t.vehicle_id)?.label;
          return `<li class="${overdue ? "overdue" : ""}">
            <a href="#/tasks/${t.id}">
              <strong>${escapeHtml(t.task_name)}</strong>
              <small><span class="tone-${overdue ? "danger" : "warn"}">${escapeHtml(dueLabel(t.due_date))}</span>${car ? ` · ${escapeHtml(car)}` : ""}</small>
            </a>
          </li>`;
        }).join("")}
      </ul>
      ${tasks.length > 6 ? `<p class="hint">and ${tasks.length - 6} more</p>` : ""}
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-close>Later</button>
        <a class="btn" href="#/tasks">See Tasks</a>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  const close = () => dlg.close();
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]") || e.target.closest("a")) close();
  });
  window.addEventListener("hashchange", close, { once: true });
  dlg.showModal();
}

// ---- Calendar (.ics) ------------------------------------------------------------

function icsText(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
}
// RFC 5545: lines over 75 octets are folded with CRLF + space.
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; }
  out.push(rest);
  return out.join("\r\n");
}
const compact = (iso) => iso.replaceAll("-", "");

// An all-day event on the due date, with an alarm at 9:00 AM on the reminder day.
// The event starts at midnight on the due date, so 9 AM N days earlier is
// "N days minus 9 hours" before the start (or 9 hours after it on the due date).
function alarmTrigger(days) {
  return days === 0 ? "PT9H" : `-P${days - 1}DT15H`;
}

export function buildIcs(tasks, { defaultDays, vehicles = [] }) {
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const events = tasks.filter((t) => t.due_date && !t.is_completed).map((t) => {
    const days = remindDaysFor(t, defaultDays);
    const car = byId.get(t.vehicle_id)?.label;
    const summary = car ? `${t.task_name} (${car})` : t.task_name;
    const desc = [
      `AutoPal maintenance task${car ? ` for ${car}` : ""}.`,
      t.estimated_cost != null ? `Estimated Cost: $${Number(t.estimated_cost).toFixed(2)}` : "",
      t.notes ?? "",
    ].filter(Boolean).join("\n");
    return [
      "BEGIN:VEVENT",
      `UID:autopal-task-${t.id}-${compact(t.due_date)}@autopal`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(t.due_date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(t.due_date, 1))}`,
      `SUMMARY:${icsText(summary)}`,
      `DESCRIPTION:${icsText(desc)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(`${t.task_name} is due ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`)}`,
      `TRIGGER:${alarmTrigger(days)}`,
      "END:VALARM",
      "END:VEVENT",
    ];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AutoPal//Maintenance reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flat(),
    "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
