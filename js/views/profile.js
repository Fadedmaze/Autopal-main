// Profile (/profile): picture, name, Insurance Card, Change Password, Notification
// Settings, Log Out. Sub-screens: /profile/insurance, /profile/password and
// /profile/notifications (ctx.mode).
import { getProfile, getSettings, updateSettings, uploadAvatar, avatarUrl, saveDisplayName, listTasks, listVehicles, getInsuranceCard, uploadInsuranceCard, removeInsuranceCard, insuranceCardUrl } from "../data.js";
import {
  REMIND_CHOICES, remindLabel, deviceNotificationsOn, enableDeviceNotifications, disableDeviceNotifications, buildIcs, downloadIcs,
} from "../reminders.js";
import { prepareUpload } from "../components.js";
import { verifyPassword, updatePassword, signOut } from "../auth.js";
import { appBar, escapeHtml, icon, loading, toast, confirmDialog, errorMessage, withBusy, titleCase } from "../ui.js";

export default async function render(root, ctx) {
  if (ctx.mode === "password") return renderPassword(root, ctx);
  if (ctx.mode === "notifications") return renderNotifications(root, ctx);
  if (ctx.mode === "insurance") return renderInsurance(root, ctx);

  root.innerHTML = loading();
  const profile = await getProfile();
  const picture = await avatarUrl(profile.avatar_path);
  if (!ctx.isCurrent()) return;

  root.innerHTML = `
    <header class="appbar center">
      <div class="appbar-row"><a class="back" href="#/home" aria-label="Back to Home">${icon("back", 18, 2.4)}Home</a></div>
      <h1>Profile</h1>
    </header>
    <div class="content profile">
      <label class="avatar-picker" aria-label="Change profile picture">
        <input type="file" accept="image/*" hidden>
        <span class="avatar-lg">${picture ? `<img src="${escapeHtml(picture)}" alt="Your profile picture">` : icon("user", 56, 1.5)}</span>
        <span class="avatar-edit">${icon("camera", 16, 2)}</span>
      </label>
      <p class="form-error center" role="alert" hidden></p>
      <div class="profile-name" id="name-view">
        <h2 class="profile-display">${escapeHtml(profile.display_name || titleCase(profile.username || ""))}</h2>
        <button class="btn btn-ghost btn-sm" type="button" id="name-edit">${icon("edit", 14, 2)}Edit</button>
      </div>
      <form class="profile-name-form" id="name-form" novalidate hidden>
        <label class="field">
          <span>Display Name</span>
          <input name="display_name" maxlength="40" autocomplete="nickname" value="${escapeHtml(profile.display_name ?? "")}">
          <small class="hint">1 to 40 characters. Shown on Home instead of your username.</small>
        </label>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions compact">
          <button class="btn btn-ghost btn-sm" type="button" id="name-cancel">Cancel</button>
          <button class="btn btn-sm" type="submit">Save</button>
        </div>
      </form>
      <p class="profile-username">@${escapeHtml(profile.username ?? "")}</p>

      <div class="profile-actions">
        <a class="menu-row" href="#/profile/insurance">${icon("shield", 20, 2)}<span>Insurance Card</span>${icon("chevron", 18, 2)}</a>
        <a class="menu-row" href="#/profile/password">${icon("lock", 20, 2)}<span>Change Password</span>${icon("chevron", 18, 2)}</a>
        <a class="menu-row" href="#/profile/notifications">${icon("bell", 20, 2)}<span>Notification Settings</span>${icon("chevron", 18, 2)}</a>
      </div>

      <button class="btn btn-ghost danger logout" type="button" id="logout">${icon("logout", 18, 2)}Log Out</button>
    </div>`;

  const errEl = root.querySelector(".form-error");
  const input = root.querySelector(".avatar-picker input");
  const avatarEl = root.querySelector(".avatar-lg");
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    errEl.hidden = true;
    avatarEl.classList.add("busy");
    try {
      const prepared = await prepareUpload(file, { maxEdge: 600 });
      const saved = await uploadAvatar(prepared.blob, prepared.ext, profile.avatar_path);
      profile.avatar_path = saved.avatar_path;
      const url = await avatarUrl(saved.avatar_path);
      avatarEl.innerHTML = `<img src="${escapeHtml(url)}" alt="Your profile picture">`;
      toast("Profile picture updated", "ok");
    } catch (err) {
      // Spec: say so and keep the old picture (uploadAvatar only swaps after success).
      errEl.textContent = `Couldn't update your picture: ${errorMessage(err)} Your old picture was kept.`;
      errEl.hidden = false;
    } finally {
      avatarEl.classList.remove("busy");
    }
  });

  // Display name: view / inline edit. Username stays the login name and is not editable here.
  const nameView = root.querySelector("#name-view");
  const nameForm = root.querySelector("#name-form");
  const nameErr = nameForm.querySelector(".form-error");
  const nameInput = nameForm.elements.display_name;
  const showNameEdit = (on) => {
    nameView.hidden = on;
    nameForm.hidden = !on;
    nameErr.hidden = true;
    if (on) {
      nameInput.value = profile.display_name ?? "";
      nameInput.focus();
    }
  };
  root.querySelector("#name-edit").addEventListener("click", () => showNameEdit(true));
  root.querySelector("#name-cancel").addEventListener("click", () => showNameEdit(false));
  nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    nameErr.hidden = true;
    if (name.length < 1 || name.length > 40) {
      nameErr.textContent = "Enter a name between 1 and 40 characters.";
      nameErr.hidden = false;
      return;
    }
    withBusy(nameForm.querySelector("button[type=submit]"), async () => {
      try {
        const saved = await saveDisplayName(name);
        profile.display_name = saved.display_name;
        root.querySelector(".profile-display").textContent = saved.display_name;
        showNameEdit(false);
        toast("Name updated", "ok");
      } catch (err) {
        nameErr.textContent = `Couldn't save your name: ${errorMessage(err)}`;
        nameErr.hidden = false;
      }
    });
  });

  root.querySelector("#logout").addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Log Out?", body: "Are you sure you want to log out?", confirmLabel: "Log Out", danger: true });
    if (!ok) return;
    await signOut();
    ctx.navigate("#/signin", { replace: true });
  });
}

function renderPassword(root, ctx) {
  root.innerHTML = `
    ${appBar({ title: "Change Password", back: { href: "#/profile", label: "Profile" } })}
    <form class="form content" novalidate>
      <label class="field">
        <span>Current Password</span>
        <input name="current" type="password" autocomplete="current-password" required>
      </label>
      <label class="field">
        <span>New Password</span>
        <input name="password" type="password" autocomplete="new-password" minlength="8" required>
        <small class="hint">At least 8 characters.</small>
      </label>
      <label class="field">
        <span>Confirm New Password</span>
        <input name="confirm" type="password" autocomplete="new-password" minlength="8" required>
      </label>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions">
        <a class="btn btn-ghost" href="#/profile">Cancel</a>
        <button class="btn" type="submit">Update Password</button>
      </div>
    </form>`;

  const form = root.querySelector("form");
  const errEl = root.querySelector(".form-error");
  const fail = (m) => { errEl.textContent = m; errEl.hidden = false; };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const { current, password, confirm } = Object.fromEntries(new FormData(form));
    if (!current || !password || !confirm) return fail("Please fill in all three fields.");
    if (password !== confirm) return fail("The new password and confirm password don't match.");
    if (password.length < 8) return fail("The new password must be at least 8 characters.");
    withBusy(form.querySelector("button[type=submit]"), async () => {
      try {
        if (!(await verifyPassword(current))) return fail("Your current password is incorrect.");
        await updatePassword(password);
        toast("Password updated", "ok");
        ctx.navigate("#/profile", { replace: true });
      } catch (err) {
        fail(errorMessage(err));
      }
    });
  });
  form.elements.current.focus();
}

async function renderNotifications(root, ctx) {
  root.innerHTML = loading();
  const settings = await getSettings();
  if (!ctx.isCurrent()) return;
  const supported = "Notification" in window;
  root.innerHTML = `
    ${appBar({ title: "Notifications", back: { href: "#/profile", label: "Profile" } })}
    <div class="content">
      <section class="card">
        <label class="toggle">
          <input type="checkbox" name="task_reminders_enabled" ${settings.task_reminders_enabled ? "checked" : ""}>
          <span class="toggle-ui"></span>
          <span>Maintenance Reminders</span>
        </label>
        <label class="field inline-field">
          <span>Default Timing</span>
          <select name="reminder_days_before" ${settings.task_reminders_enabled ? "" : "disabled"}>
            ${REMIND_CHOICES.map(([d, label]) => `<option value="${d}" ${d === settings.reminder_days_before ? "selected" : ""}>${label}</option>`).join("")}
            ${REMIND_CHOICES.some(([d]) => d === settings.reminder_days_before) ? "" : `<option value="${settings.reminder_days_before}" selected>${escapeHtml(remindLabel(settings.reminder_days_before))}</option>`}
          </select>
        </label>
        <p class="hint">Used for every task unless you pick a different time on the task itself. Tasks coming due are highlighted on Home, in Tasks and in the Garage, and Home lists them when their reminder day arrives.</p>
      </section>

      <section class="card">
        <label class="toggle">
          <input type="checkbox" name="device_notifications" ${deviceNotificationsOn() ? "checked" : ""} ${supported ? "" : "disabled"}>
          <span class="toggle-ui"></span>
          <span>Notifications on This Device</span>
        </label>
        <p class="hint" id="device-hint">${supported
          ? "Get a notification on this phone or computer when a reminder is due. They arrive when you open AutoPal."
          : "This browser can't show notifications. On iPhone, add AutoPal to your Home Screen first (Share → Add to Home Screen)."}</p>
      </section>

      <section class="card">
        <strong class="card-title">${icon("calendar", 18, 2)}Calendar Reminders</strong>
        <p class="hint">Want an alert even when AutoPal is closed? Add your upcoming tasks to your phone's calendar. Each one gets an alarm at 9 AM on its reminder day.</p>
        <button type="button" class="btn btn-soft" id="export-calendar">${icon("calendar", 18, 2)}Add Tasks to Calendar</button>
      </section>
    </div>`;

  const enabled = root.querySelector("[name=task_reminders_enabled]");
  const days = root.querySelector("[name=reminder_days_before]");
  const save = async () => {
    days.disabled = !enabled.checked;
    try {
      await updateSettings({ task_reminders_enabled: enabled.checked, reminder_days_before: Number(days.value) });
      settings.task_reminders_enabled = enabled.checked;
      settings.reminder_days_before = Number(days.value);
      toast("Saved", "ok");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  enabled.addEventListener("change", save);
  days.addEventListener("change", save);

  const device = root.querySelector("[name=device_notifications]");
  device.addEventListener("change", async () => {
    if (!device.checked) {
      disableDeviceNotifications();
      return toast("Notifications off for this device", "ok");
    }
    const result = await enableDeviceNotifications();
    if (result === "on") return toast("Notifications on for this device", "ok");
    device.checked = false;
    toast(result === "denied"
      ? "Notifications are blocked. Allow them for this site in your browser settings, then try again."
      : "This browser can't show notifications.", "error");
  });

  root.querySelector("#export-calendar").addEventListener("click", (e) => withBusy(e.currentTarget, async () => {
    try {
      const [tasks, vehicles] = await Promise.all([listTasks({ completed: false }), listVehicles()]);
      const upcoming = tasks.filter((t) => t.due_date);
      if (!upcoming.length) return toast("No upcoming tasks with a due date yet.", "info");
      downloadIcs(buildIcs(upcoming, { defaultDays: settings.reminder_days_before, vehicles }), "autopal-maintenance.ics");
      toast(`Calendar file with ${upcoming.length} task${upcoming.length === 1 ? "" : "s"} downloaded. Open it to add them.`, "ok");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }));
}

// ---- Insurance card (/profile/insurance) -------------------------------------
// Front and back of the card, each a photo or PDF in a private bucket. Tap a card
// to see it full screen (e.g. to show someone after an accident).

const SIDES = [
  { id: "front", label: "Front of Card" },
  { id: "back", label: "Back of Card" },
];

async function renderInsurance(root, ctx) {
  root.innerHTML = loading();
  let card;
  try {
    card = await getInsuranceCard();
  } catch (err) {
    if (!ctx.isCurrent()) return;
    root.innerHTML = `
      ${appBar({ title: "Insurance Card", back: { href: "#/profile", label: "Profile" } })}
      <div class="error-state">
        ${icon("shield", 40, 1.6)}
        <h2>Not Available Yet</h2>
        <p>${escapeHtml(err.notConfigured ? err.message : errorMessage(err))}</p>
      </div>`;
    return;
  }
  const urls = {};
  await Promise.all(SIDES.map(async (s) => { urls[s.id] = await insuranceCardUrl(card[s.id]); }));
  if (!ctx.isCurrent()) return;

  const isPdf = (path) => /\.pdf$/i.test(path ?? "");
  const slot = (s) => {
    const path = card[s.id];
    const url = urls[s.id];
    if (!path) {
      return `
        <section class="ins-side">
          <h3>${s.label}</h3>
          <label class="capture ins-capture" data-side="${s.id}">
            <input type="file" accept="image/*,application/pdf" hidden>
            <span class="capture-preview ins-preview">
              <span class="capture-empty">${icon("camera", 40, 1.5)}<strong>Add ${s.label}</strong><small>Take a photo or choose an image or PDF</small></span>
            </span>
          </label>
        </section>`;
    }
    return `
      <section class="ins-side">
        <h3>${s.label}</h3>
        ${isPdf(path)
          ? `<a class="ins-preview ins-pdf" href="${escapeHtml(url ?? "#")}" target="_blank" rel="noopener">${icon("receipt", 36, 1.6)}<strong>PDF Saved</strong><small>Tap to open</small></a>`
          : `<button type="button" class="ins-preview ins-view" data-view="${s.id}" aria-label="View ${s.label.toLowerCase()} full screen">
               ${url ? `<img src="${escapeHtml(url)}" alt="${s.label}">` : `<span class="capture-empty"><small>Couldn't load the picture. Check your connection.</small></span>`}
             </button>`}
        <div class="ins-actions">
          <label class="btn btn-ghost btn-sm" data-side="${s.id}">
            <input type="file" accept="image/*,application/pdf" hidden>${icon("camera", 16, 2)}Replace
          </label>
          <button type="button" class="btn btn-ghost btn-sm danger" data-remove="${s.id}">${icon("trash", 16, 2)}Remove</button>
        </div>
      </section>`;
  };

  root.innerHTML = `
    ${appBar({ title: "Insurance Card", back: { href: "#/profile", label: "Profile" } })}
    <div class="content ins">
      <p class="notice notice-info">${icon("lock", 18, 2)}<span>Only you can see your card. It's stored privately in your account, so you'll need a connection to open it.</span></p>
      ${SIDES.map(slot).join("")}
      <p class="form-error" role="alert" hidden></p>
    </div>`;

  const errEl = root.querySelector(".form-error");
  const showError = (m) => { errEl.textContent = m; errEl.hidden = !m; };

  root.querySelectorAll("[data-side]").forEach((label) => {
    const input = label.querySelector("input[type=file]");
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      const side = label.dataset.side;
      showError("");
      label.classList.add("busy");
      try {
        const prepared = await prepareUpload(file, { maxEdge: 2000, allowPdf: true });
        await uploadInsuranceCard(side, prepared.blob, prepared.ext, card[side]);
        toast("Insurance card saved", "ok");
        if (ctx.isCurrent()) renderInsurance(root, ctx);
      } catch (err) {
        label.classList.remove("busy");
        showError(`Couldn't save your card: ${errorMessage(err)}${card[side] ? " Your old picture was kept." : ""}`);
      }
    });
  });

  root.querySelectorAll("[data-remove]").forEach((btn) => btn.addEventListener("click", async () => {
    const side = btn.dataset.remove;
    const name = SIDES.find((s) => s.id === side).label.toLowerCase();
    const ok = await confirmDialog({ title: "Remove Card?", body: `Remove the ${name}? This can't be undone.`, confirmLabel: "Remove", danger: true });
    if (!ok) return;
    withBusy(btn, async () => {
      try {
        await removeInsuranceCard(side, card[side]);
        toast("Removed", "ok");
        if (ctx.isCurrent()) renderInsurance(root, ctx);
      } catch (err) {
        showError(errorMessage(err));
      }
    });
  }));

  root.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => {
    const side = btn.dataset.view;
    if (urls[side]) viewCardFullScreen(urls[side], SIDES.find((s) => s.id === side).label);
  }));
}

// Full-screen view, bright on black, for showing the card to someone.
function viewCardFullScreen(url, label) {
  const dlg = document.createElement("dialog");
  dlg.className = "ins-viewer";
  dlg.setAttribute("aria-label", label);
  dlg.innerHTML = `
    <img src="${escapeHtml(url)}" alt="${escapeHtml(label)}">
    <button type="button" class="ins-viewer-close" aria-label="Close">${icon("close", 22, 2.4)}</button>`;
  document.body.append(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.querySelector(".ins-viewer-close").addEventListener("click", close);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dlg.showModal();
}
