// "Car care at a glance" for one vehicle: pure numbers from its tasks, plus the HTML
// for the summary card on the vehicle page. No network; the view passes the tasks in.
//
// Money comes from each task's cost (estimated_cost). For a completed task that's the
// amount the user recorded for it, so "spent" is the sum over completed tasks.
import { escapeHtml, icon, formatDate, formatMoney, dueLabel, dueTone, daysBetween, todayISO, parseISODate } from "./ui.js";

const MONTHS = 12;

const cost = (t) => (t.estimated_cost == null ? null : Number(t.estimated_cost));
const sum = (list) => list.reduce((a, t) => a + (cost(t) ?? 0), 0);
const monthKey = (iso) => iso.slice(0, 7); // "2026-03"

// Whole-dollar money for tiles ("$1,240"); cents only when there are any under $100.
function shortMoney(n) {
  const v = Number(n ?? 0);
  if (v >= 100 || Number.isInteger(v)) return `$${Math.round(v).toLocaleString("en-US")}`;
  return formatMoney(v);
}

export function careSummary({ open, done, remindDays = 7, today = todayISO() }) {
  const year = today.slice(0, 4);
  const completed = done.filter((t) => t.completed_date);
  const thisYear = completed.filter((t) => t.completed_date.startsWith(year));

  // Status: overdue beats due-soon beats up to date.
  const dated = open.filter((t) => t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const overdue = dated.filter((t) => t.due_date < today);
  const soon = dated.filter((t) => t.due_date >= today && dueTone(t.due_date, t.remind_days_before ?? remindDays) === "warn");
  const status = overdue.length
    ? { tone: "danger", title: overdue.length === 1 ? `${overdue[0].task_name} is overdue` : `${overdue.length} tasks are overdue`, iconName: "alert" }
    : soon.length
      ? { tone: "warn", title: soon.length === 1 ? `${soon[0].task_name} is due soon` : `${soon.length} tasks due soon`, iconName: "clock" }
      : { tone: "ok", title: open.length ? "Up to date" : "Nothing scheduled", iconName: "check" };
  status.sub = overdue.length
    ? `Oldest is ${-daysBetween(today, overdue[0].due_date)} days late.`
    : soon.length
      ? dueLabel(soon[0].due_date) + "."
      : dated.length
        ? `Next task is ${dueLabel(dated[0].due_date).replace(/^Due /, "").replace(/^in /, "in ").toLowerCase()}.`
        : open.length
          ? `${open.length} task${open.length === 1 ? "" : "s"} planned, no due dates yet.`
        : "Add a task so you don't miss the next service.";

  // Last and first service.
  const last = completed[0] ?? null; // listTasks returns completed newest first
  const first = completed.length ? completed.reduce((a, t) => (t.completed_date < a.completed_date ? t : a)) : null;
  const daysSinceLast = last ? daysBetween(last.completed_date, today) : null;

  // Spending by month for the last 12 months, oldest first (zero-filled).
  const months = [];
  const d = parseISODate(`${today.slice(0, 7)}-01`);
  for (let i = MONTHS - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: m.toLocaleDateString(undefined, { month: "short" }), long: m.toLocaleDateString(undefined, { month: "long", year: "numeric" }), total: 0, count: 0 });
  }
  const byMonth = new Map(months.map((m) => [m.key, m]));
  for (const t of completed) {
    const m = byMonth.get(monthKey(t.completed_date));
    if (m) { m.total += cost(t) ?? 0; m.count += 1; }
  }
  const last12 = months.reduce((a, m) => a + m.total, 0);

  // Where the money went: total by task name, biggest first.
  const groups = new Map();
  for (const t of completed) {
    const name = t.task_name.trim();
    const key = name.toLowerCase();
    const g = groups.get(key) ?? { name, total: 0, count: 0 };
    g.total += cost(t) ?? 0;
    g.count += 1;
    groups.set(key, g);
  }
  const spent = sum(completed);
  const top = [...groups.values()].filter((g) => g.total > 0).sort((a, b) => b.total - a.total || b.count - a.count);

  // Average per month since the first recorded service (at least one month).
  const monthsTracked = first ? Math.max(1, Math.round(daysBetween(first.completed_date, today) / 30.44)) : 0;

  return {
    status,
    completedCount: completed.length,
    completedThisYear: thisYear.length,
    spent,
    spentThisYear: sum(thisYear),
    perMonth: monthsTracked ? spent / monthsTracked : 0,
    missingCost: completed.filter((t) => cost(t) == null).length,
    receipts: completed.filter((t) => t.receipt_path).length,
    upcomingCount: open.length,
    upcomingTotal: sum(open),
    next: dated[0] ?? open[0] ?? null,
    last,
    first,
    daysSinceLast,
    months,
    last12,
    top: top.slice(0, 3),
    otherTotal: top.slice(3).reduce((a, g) => a + g.total, 0),
    year,
  };
}

function ago(days) {
  if (days == null) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 45) return `${days} days ago`;
  const months = Math.round(days / 30.44);
  if (months < 18) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${(days / 365.25).toFixed(1).replace(/\.0$/, "")} years ago`;
}

// Monthly spending bars. One series in the brand color; each bar has a hover/focus
// tooltip, and the screen-reader text lists every month.
function spendChart(s) {
  if (!s.last12) return "";
  const max = Math.max(...s.months.map((m) => m.total));
  const busiest = s.months.reduce((a, m) => (m.total > a.total ? m : a));
  return `
    <div class="care-chart-block">
      <div class="care-sub-head">
        <h4>Spending, Last 12 Months</h4>
        <span class="care-sub-total">${shortMoney(s.last12)}</span>
      </div>
      <div class="care-chart" role="img" aria-label="Spending by month. ${escapeHtml(s.months.filter((m) => m.total).map((m) => `${m.long}: ${shortMoney(m.total)}`).join("; "))}.">
        ${s.months.map((m) => {
          const h = m.total ? Math.max(6, Math.round((m.total / max) * 100)) : 0;
          const tip = m.total ? `${m.long}: ${shortMoney(m.total)} · ${m.count} task${m.count === 1 ? "" : "s"}` : `${m.long}: nothing`;
          return `
            <span class="care-bar-col" data-tip="${escapeHtml(tip)}">
              <span class="care-bar-area"><span class="care-bar${m.total ? "" : " is-zero"}" style="height:${h}%"></span></span>
              <span class="care-bar-label">${escapeHtml(m.label.slice(0, 1))}</span>
            </span>`;
        }).join("")}
        <span class="care-tip" hidden></span>
      </div>
      <p class="care-chart-note">Most in ${escapeHtml(busiest.long)} (${shortMoney(busiest.total)}).</p>
    </div>`;
}

function whereItWent(s) {
  if (!s.top.length) return "";
  const max = s.top[0].total;
  const rows = s.top.map((g) => `
    <li>
      <span class="care-where-name">${escapeHtml(g.name)}${g.count > 1 ? ` <span class="tone-muted">×${g.count}</span>` : ""}</span>
      <span class="care-where-amt">${shortMoney(g.total)}</span>
      <span class="care-where-track" aria-hidden="true"><span style="width:${Math.max(4, Math.round((g.total / max) * 100))}%"></span></span>
    </li>`).join("");
  return `
    <div class="care-where">
      <div class="care-sub-head"><h4>Where It Went</h4></div>
      <ul>${rows}</ul>
      ${s.otherTotal ? `<p class="care-chart-note">Everything else: ${shortMoney(s.otherTotal)}</p>` : ""}
    </div>`;
}

// The summary card for the vehicle page.
export function careCard(vehicle, s, { remindDays = 7 } = {}) {
  const tile = ({ iconName, label, value, sub, href }) => {
    const tag = href ? "a" : "div";
    return `
      <${tag} class="care-tile"${href ? ` href="${href}"` : ""}>
        <span class="care-tile-label">${icon(iconName, 15, 2.2)}${label}</span>
        <strong class="care-tile-value">${value}</strong>
        ${sub ? `<span class="care-tile-sub">${sub}</span>` : ""}
      </${tag}>`;
  };
  const newTask = `#/tasks/new?vehicle=${vehicle.id}`;
  const nothingYet = !s.completedCount && !s.upcomingCount;

  return `
    <section class="card care" aria-labelledby="care-title">
      <div class="card-head">
        <h3 id="care-title">${icon("shield", 18, 2)}Car Care at a Glance</h3>
        <a class="link-sm" href="#/budget?vehicle=${vehicle.id}">Costs</a>
      </div>

      <div class="care-status tone-${s.status.tone}">
        <span class="care-status-icon">${icon(s.status.iconName, 20, 2.4)}</span>
        <span class="care-status-text">
          <strong>${escapeHtml(s.status.title)}</strong>
          <span>${escapeHtml(s.status.sub)}</span>
        </span>
      </div>

      ${nothingYet ? `
        <p class="muted-box">No tasks for this car yet. <a href="${newTask}">Add the first one</a> and this summary fills in as you go.</p>` : `
      <div class="care-tiles">
        ${tile({ iconName: "check", label: "Completed", value: s.completedCount.toLocaleString(), sub: s.completedCount ? `${s.completedThisYear} in ${s.year}` : "None yet" })}
        ${tile({ iconName: "dollar", label: "Total Spent", value: shortMoney(s.spent), sub: s.spent ? `${shortMoney(s.spentThisYear)} in ${s.year}` : "No costs recorded" })}
        ${tile({ iconName: "history", label: "Last Service", value: s.last ? escapeHtml(ago(s.daysSinceLast).replace(/^./, (c) => c.toUpperCase())) : "None yet", sub: s.last ? `${escapeHtml(s.last.task_name)} · ${formatDate(s.last.completed_date, { month: "short", day: "numeric" })}` : "" })}
        ${tile({ iconName: "calendar", label: "Upcoming", value: s.upcomingCount.toLocaleString(), sub: s.upcomingCount ? `${shortMoney(s.upcomingTotal)} estimated` : "Nothing planned", href: `#/budget?vehicle=${vehicle.id}` })}
      </div>

      ${s.next ? `
        <a class="care-next" href="#/tasks/${s.next.id}">
          <span class="care-next-label">Next Up</span>
          <span class="care-next-main">
            <strong>${escapeHtml(s.next.task_name)}</strong>
            <span class="tone-${dueTone(s.next.due_date, s.next.remind_days_before ?? remindDays)}">${escapeHtml(dueLabel(s.next.due_date))}${cost(s.next) ? ` · ~${shortMoney(cost(s.next))}` : ""}</span>
          </span>
          ${icon("chevron", 18, 2)}
        </a>` : `<a class="care-next care-next-add" href="${newTask}">${icon("plus", 18, 2.4)}<span>Plan the Next Service</span></a>`}

      ${spendChart(s)}
      ${whereItWent(s)}

      ${s.completedCount ? `
        <ul class="care-facts">
          ${s.first ? `<li>${icon("clock", 15, 2)}Tracking since ${formatDate(s.first.completed_date, { month: "short", year: "numeric" })}${s.perMonth ? ` · about ${shortMoney(Math.round(s.perMonth))} a month` : ""}</li>` : ""}
          <li>${icon("receipt", 15, 2)}${s.receipts} of ${s.completedCount} completed task${s.completedCount === 1 ? " has a" : "s have"} receipt${s.completedCount === 1 ? "" : "s"}</li>
          ${s.missingCost ? `<li>${icon("dollar", 15, 2)}${s.missingCost} completed task${s.missingCost === 1 ? " has" : "s have"} no cost, so the total may be low</li>` : ""}
        </ul>` : ""}`}
    </section>`;
}

// Tooltip for the spending bars (hover, tap or keyboard focus).
export function bindCareCard(root) {
  const chart = root.querySelector(".care-chart");
  if (!chart) return;
  const tip = chart.querySelector(".care-tip");
  const show = (col) => {
    tip.textContent = col.dataset.tip;
    tip.hidden = false;
    const c = chart.getBoundingClientRect();
    const r = col.getBoundingClientRect();
    const x = r.left - c.left + r.width / 2;
    tip.style.left = `${Math.min(c.width - tip.offsetWidth / 2, Math.max(tip.offsetWidth / 2, x))}px`;
    chart.querySelectorAll(".care-bar-col.on").forEach((el) => el.classList.remove("on"));
    col.classList.add("on");
  };
  const hide = () => {
    tip.hidden = true;
    chart.querySelectorAll(".care-bar-col.on").forEach((el) => el.classList.remove("on"));
  };
  chart.querySelectorAll(".care-bar-col").forEach((col) => {
    col.addEventListener("pointerenter", () => show(col));
    col.addEventListener("click", () => show(col));
  });
  chart.addEventListener("pointerleave", hide);
}
