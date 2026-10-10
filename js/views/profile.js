// Profile (/profile): picture, username, Change Password, Notification Settings, Log Out.
// Sub-screens: /profile/password and /profile/notifications (ctx.mode).
import { getProfile, getSettings, updateSettings, uploadAvatar, avatarUrl } from "../data.js";
import { prepareUpload } from "../components.js";
import { verifyPassword, updatePassword, signOut } from "../auth.js";
import { appBar, escapeHtml, icon, loading, toast, confirmDialog, errorMessage, withBusy } from "../ui.js";

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
      <label class="avatar-picker" aria-label="Change profile picture">
        <input type="file" accept="image/*" hidden>
        <span class="avatar-lg">${picture ? `<img src="${escapeHtml(picture)}" alt="Your profile picture">` : icon("user", 56, 1.5)}</span>
        <span class="avatar-edit">${icon("camera", 16, 2)}</span>
      </label>
      <p class="form-error center" role="alert" hidden></p>
      <h2 class="profile-username">${escapeHtml(profile.username ?? "")}</h2>

      <div class="profile-actions">
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

  root.querySelector("#logout").addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Log out", body: "Are you sure you want to log out?", confirmLabel: "Log Out", danger: true });
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
        <span>Current password</span>
        <input name="current" type="password" autocomplete="current-password" required>
      </label>
      <label class="field">
        <span>New password</span>
        <input name="password" type="password" autocomplete="new-password" minlength="8" required>
        <small class="hint">At least 8 characters.</small>
      </label>
      <label class="field">
        <span>Confirm new password</span>
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
  root.innerHTML = `
    ${appBar({ title: "Notifications", back: { href: "#/profile", label: "Profile" } })}
    <div class="content">
      <section class="card">
        <label class="toggle">
          <input type="checkbox" name="task_reminders_enabled" ${settings.task_reminders_enabled ? "checked" : ""}>
          <span class="toggle-ui"></span>
          <span>Maintenance reminders</span>
        </label>
        <label class="field inline-field">
          <span>Remind me</span>
          <select name="reminder_days_before" ${settings.task_reminders_enabled ? "" : "disabled"}>
            ${[1, 3, 7, 14, 30].map((d) => `<option value="${d}" ${d === settings.reminder_days_before ? "selected" : ""}>${d} day${d > 1 ? "s" : ""} before</option>`).join("")}
          </select>
        </label>
        <p class="hint">Tasks coming due are highlighted on Home, in Tasks and in the Garage.</p>
      </section>
    </div>`;

  const enabled = root.querySelector("[name=task_reminders_enabled]");
  const days = root.querySelector("[name=reminder_days_before]");
  const save = async () => {
    days.disabled = !enabled.checked;
    try {
      await updateSettings({ task_reminders_enabled: enabled.checked, reminder_days_before: Number(days.value) });
      toast("Saved", "ok");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  enabled.addEventListener("change", save);
  days.addEventListener("change", save);
}
