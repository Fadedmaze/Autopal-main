// Profile (/profile): picture, name, Change Password, Notification Settings,
// Insurance Card (a pop-up sheet), Log Out. Sub-screens: /profile/password and
// /profile/notifications (ctx.mode). /profile/insurance opens Profile with the
// insurance sheet already open.
import { getProfile, getSettings, updateSettings, uploadAvatar, avatarUrl, saveDisplayName, listTasks, listVehicles, getInsuranceCard, uploadInsuranceCard, removeInsuranceCard, insuranceCardUrl } from "../data.js";
import {
  REMIND_CHOICES, remindLabel, deviceNotificationsOn, enableDeviceNotifications, disableDeviceNotifications, buildIcs, downloadIcs,
} from "../reminders.js";
import { pushStatus, pushOn, enablePush, disablePush, sendTestReminder } from "../push.js";
import { prepareUpload } from "../components.js";
import { verifyPassword, updatePassword, signOut } from "../auth.js";
import { appBar, escapeHtml, icon, loading, toast, confirmDialog, errorMessage, withBusy, titleCase } from "../ui.js";

export default async function render(root, ctx) {
  if (ctx.mode === "password") return renderPassword(root, ctx);
  if (ctx.mode === "notifications") return renderNotifications(root, ctx);

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
      
    <div class="profile-avatar-section">
      <button type="button" class="avatar-picker" id="avatar-options"
        aria-label="Change profile picture">
        <span class="avatar-lg">
          ${picture
            ? `<img src="${escapeHtml(picture)}" alt="Your profile picture">`
            : icon("user", 56, 1.5)}
        </span>
        <span class="avatar-edit">${icon("camera", 16, 2)}</span>
      </button>

      <input type="file" id="avatar-camera"
        accept="image/*" capture="user" hidden>

      <input type="file" id="avatar-gallery"
        accept="image/*" hidden>
    </div>

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
        <a class="menu-row" href="#/profile/password">${icon("lock", 20, 2)}<span>Change Password</span>${icon("chevron", 18, 2)}</a>
        <a class="menu-row" href="#/profile/notifications">${icon("bell", 20, 2)}<span>Notification Settings</span>${icon("chevron", 18, 2)}</a>
        <button type="button" class="menu-row" id="open-insurance" aria-haspopup="dialog">${icon("shield", 20, 2)}<span>Insurance Card</span>${icon("chevron", 18, 2)}</button>
      </div>

      <button class="btn btn-ghost danger logout" type="button" id="logout">${icon("logout", 18, 2)}Log Out</button>
    </div>`;

  const errEl = root.querySelector(".form-error");
  

const cameraInput = root.querySelector("#avatar-camera");
const galleryInput = root.querySelector("#avatar-gallery");
const avatarEl = root.querySelector(".avatar-lg");
const avatarButton = root.querySelector("#avatar-options");

// Show camera/gallery choices when tapping the profile picture
avatarButton.addEventListener("click", () => {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet avatar-choice-sheet";

  dlg.innerHTML = `
    <div class="sheet-body left">
      <div class="sheet-head">
        <h2>Change Profile Picture</h2>
        <button type="button" class="icon-btn" data-close>
          ${icon("close", 18, 2)}
        </button>
      </div>

      <button type="button" class="menu-row" data-camera>
        ${icon("camera", 20, 2)}
        <span>Take Photo</span>
      </button>

      <button type="button" class="menu-row" data-gallery>
        ${icon("image", 20, 2)}
        <span>Choose from Gallery</span>
      </button>
    </div>
  `;

  document.body.appendChild(dlg);

  dlg.addEventListener("close", () => dlg.remove());

  dlg.querySelector("[data-close]").addEventListener("click", () => {
    dlg.close();
  });

  dlg.querySelector("[data-camera]").addEventListener("click", () => {
    dlg.close();
    cameraInput.click();
  });

  dlg.querySelector("[data-gallery]").addEventListener("click", () => {
    dlg.close();
    galleryInput.click();
  });

  dlg.showModal();
});

// Both options use the existing Supabase upload process
async function handleAvatarUpload(input) {
  const file = input.files?.[0];
  input.value = "";

  if (!file) return;

  errEl.hidden = true;
  avatarEl.classList.add("busy");

  try {
    const prepared = await prepareUpload(file, { maxEdge: 600 });

    const saved = await uploadAvatar(
      prepared.blob,
      prepared.ext,
      profile.avatar_path
    );

    profile.avatar_path = saved.avatar_path;

    const url = await avatarUrl(saved.avatar_path);

    avatarEl.innerHTML = `
      <img src="${escapeHtml(url)}" alt="Your profile picture">
    `;

    toast("Profile picture updated", "ok");

  } catch (err) {
    errEl.textContent =
      `Couldn't update your picture: ${errorMessage(err)} Your old picture was kept.`;
    errEl.hidden = false;

  } finally {
    avatarEl.classList.remove("busy");
  }
}

cameraInput.addEventListener("change", () => {
  handleAvatarUpload(cameraInput);
});

galleryInput.addEventListener("change", () => {
  handleAvatarUpload(galleryInput);
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

  // Insurance card pop-up. The old /profile/insurance link opens it right away.
  let sheet = null;
  const openInsurance = () => {
    sheet?.close();
    sheet = openInsuranceSheet();
  };
  root.querySelector("#open-insurance").addEventListener("click", openInsurance);
  if (ctx.mode === "insurance") openInsurance();
  return () => sheet?.close(); // close the pop-up when leaving the page
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
  // Phone Notifications: real push (arrives while AutoPal is closed) when the server is
  // set up, otherwise the older in-app notifications (only while AutoPal is open).
  const status = pushStatus();
  const push = status === "ready";
  const supported = push || ("Notification" in window && status !== "install-first");
  const deviceOn = push ? await pushOn() : deviceNotificationsOn();
  if (!ctx.isCurrent()) return;
  const hasEmailSetting = "email_reminders" in settings;
  const emailOn = hasEmailSetting && settings.email_reminders !== false;
  const deviceHint = {
    ready: "Get a notification on this phone or computer on the morning a reminder is due, even when AutoPal is closed. Turn it on for each device you use.",
    "install-first": "On iPhone and iPad, add AutoPal to your Home Screen first (Share → Add to Home Screen), open it from there, then turn this on.",
    unsupported: "This browser can't show notifications. Email reminders still work.",
    "not-configured": "Get a notification on this device when a reminder is due. Right now they only arrive while AutoPal is open.",
  }[status] ?? "";
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
          <input type="checkbox" name="device_notifications" ${deviceOn ? "checked" : ""} ${supported ? "" : "disabled"}>
          <span class="toggle-ui"></span>
          <span>Phone Notifications</span>
        </label>
        <p class="hint" id="device-hint">${escapeHtml(deviceHint)}</p>
      </section>

      <section class="card">
        <label class="toggle">
          <input type="checkbox" name="email_reminders" ${emailOn ? "checked" : ""} ${hasEmailSetting && settings.task_reminders_enabled ? "" : "disabled"}>
          <span class="toggle-ui"></span>
          <span>Email Reminders</span>
        </label>
        <p class="hint">${hasEmailSetting
          ? "Get an email at the address you signed up with on the morning a reminder is due."
          : "Email reminders aren't set up on the server yet."}</p>
      </section>

      <section class="card">
        <strong class="card-title">${icon("bell", 18, 2)}Test Your Reminders</strong>
        <p class="hint">Sends a test notification to every device where Phone Notifications are on, and a test email.</p>
        <button type="button" class="btn btn-soft" id="send-test">${icon("bell", 18, 2)}Send a Test</button>
        <p class="hint" id="test-result" role="status" aria-live="polite"></p>
      </section>

      <section class="card">
        <strong class="card-title">${icon("calendar", 18, 2)}Calendar Reminders</strong>
        <p class="hint">Prefer your calendar? Add your upcoming tasks to your phone's calendar. Each one gets an alarm at 9 AM on its reminder day.</p>
        <button type="button" class="btn btn-soft" id="export-calendar">${icon("calendar", 18, 2)}Add Tasks to Calendar</button>
      </section>
    </div>`;

  const enabled = root.querySelector("[name=task_reminders_enabled]");
  const days = root.querySelector("[name=reminder_days_before]");
  const save = async () => {
    days.disabled = !enabled.checked;
    const emailBox = root.querySelector("[name=email_reminders]");
    if ("email_reminders" in settings) emailBox.disabled = !enabled.checked;
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
    device.disabled = true;
    try {
      if (!device.checked) {
        disableDeviceNotifications();
        if (push) await disablePush();
        return toast("Phone notifications off for this device", "ok");
      }
      const result = push ? await enablePush() : await enableDeviceNotifications();
      if (result === "on") {
        if (push) await enableDeviceNotifications(); // also show them while the app is open
        return toast("Phone notifications on for this device", "ok");
      }
      device.checked = false;
      toast(result === "denied"
        ? "Notifications are blocked. Allow them for this site in your browser settings, then try again."
        : result === "install-first"
          ? "Add AutoPal to your Home Screen first, then turn this on from there."
          : "This browser can't show notifications.", "error");
    } catch (err) {
      device.checked = false;
      toast(errorMessage(err), "error");
    } finally {
      device.disabled = false;
    }
  });

  const email = root.querySelector("[name=email_reminders]");
  email.addEventListener("change", async () => {
    try {
      await updateSettings({ email_reminders: email.checked });
      settings.email_reminders = email.checked;
      toast(email.checked ? "Email reminders on" : "Email reminders off", "ok");
    } catch (err) {
      email.checked = !email.checked;
      toast(errorMessage(err), "error");
    }
  });

  const testResult = root.querySelector("#test-result");
  root.querySelector("#send-test").addEventListener("click", (e) => withBusy(e.currentTarget, async () => {
    testResult.textContent = "";
    try {
      const r = await sendTestReminder();
      const parts = [];
      if (!r.push_ready) parts.push("Phone notifications aren't set up on the server yet.");
      else if (r.devices) parts.push(`Test notification sent to ${r.devices} device${r.devices === 1 ? "" : "s"}.`);
      else parts.push("No devices have Phone Notifications on yet.");
      if (!r.email_ready) parts.push("Email isn't set up on the server yet.");
      else parts.push(r.email ? "Test email sent. Check your inbox (and spam)." : "The test email couldn't be sent.");
      testResult.textContent = parts.join(" ");
    } catch (err) {
      testResult.textContent = errorMessage(err);
    }
  }));

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

// ---- Insurance card (pop-up sheet on Profile) ---------------------------------
// Front and back of the card, each a photo or PDF in a private bucket. Tap a card
// to see it full screen (e.g. to show someone after an accident).

const SIDES = [
  { id: "front", label: "Front of Card" },
  { id: "back", label: "Back of Card" },
];

function openInsuranceSheet() {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet ins-sheet";
  dlg.setAttribute("aria-labelledby", "ins-title");
  dlg.innerHTML = `
    <div class="sheet-body left">
      <div class="sheet-head">
        <h2 class="task-details-title" id="ins-title">Insurance Card</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close", 18, 2.2)}</button>
      </div>
      <div class="ins" data-ins-body>${loading()}</div>
    </div>`;
  document.body.appendChild(dlg);
  let isOpen = true;
  dlg.addEventListener("close", () => { isOpen = false; dlg.remove(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  dlg.showModal();
  drawInsurance(dlg.querySelector("[data-ins-body]"), () => isOpen);
  return dlg;
}

// Fills the sheet; re-runs after each upload or removal.
async function drawInsurance(body, stillOpen) {
  let card;
  try {
    card = await getInsuranceCard();
  } catch (err) {
    if (!stillOpen()) return;
    body.innerHTML = `
      <div class="ins-unavailable">
        ${icon("shield", 36, 1.6)}
        <strong>Not Available Yet</strong>
        <p>${escapeHtml(err.notConfigured ? err.message : errorMessage(err))}</p>
      </div>`;
    return;
  }
  const urls = {};
  await Promise.all(SIDES.map(async (s) => { urls[s.id] = await insuranceCardUrl(card[s.id]); }));
  if (!stillOpen()) return;

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

  body.innerHTML = `
    <p class="notice notice-info">${icon("lock", 18, 2)}<span>Only you can see your card. It's stored privately in your account, so you'll need a connection to open it.</span></p>
    ${SIDES.map(slot).join("")}
    <p class="form-error" role="alert" hidden></p>`;

  const root = body;
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
        if (stillOpen()) drawInsurance(body, stillOpen);
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
        if (stillOpen()) drawInsurance(body, stillOpen);
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
