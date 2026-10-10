// Reached from the password-reset email (PASSWORD_RECOVERY auth event).
import { updatePassword } from "../auth.js";
import { endRecovery } from "../app.js";
import { icon, errorMessage, toast, withBusy } from "../ui.js";

export default async function render(root, ctx) {
  root.innerHTML = `
    <div class="auth">
      <div class="auth-brand">
        <span class="auth-logo">${icon("lock", 28, 2)}</span>
        <span class="auth-name">AutoPal</span>
      </div>
      <h1>Choose a new password</h1>
      <p class="sub">You'll stay signed in on this device.</p>
      <form class="form" novalidate>
        <label class="field">
          <span>New password</span>
          <input name="password" type="password" autocomplete="new-password" minlength="8" required>
        </label>
        <label class="field">
          <span>Confirm new password</span>
          <input name="confirm" type="password" autocomplete="new-password" minlength="8" required>
        </label>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn" type="submit">Save Password</button>
      </form>
    </div>`;

  const form = root.querySelector("form");
  const errEl = root.querySelector(".form-error");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const { password, confirm } = Object.fromEntries(new FormData(form));
    const fail = (msg) => { errEl.textContent = msg; errEl.hidden = false; };
    if (password.length < 8) return fail("Password must be at least 8 characters.");
    if (password !== confirm) return fail("The two passwords don't match.");
    withBusy(form.querySelector("button"), async () => {
      try {
        await updatePassword(password);
        endRecovery();
        toast("Password updated", "ok");
        ctx.navigate("#/home", { replace: true });
      } catch (err) {
        fail(errorMessage(err));
      }
    });
  });
}
