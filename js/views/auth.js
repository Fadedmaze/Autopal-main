// Sign In (username + password), Create Account (email, username, password),
// and Forgot Password. One module, three modes.
import { signIn, signUp, sendPasswordReset, isUsernameAvailable } from "../auth.js";
import { icon, escapeHtml, errorMessage, withBusy } from "../ui.js";

const USERNAME_RE = /^[A-Za-z0-9_.]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function render(root, ctx) {
  const mode = ctx.mode;
  const notice = ctx.query.get("notice");
  const titles = {
    signin: ["Welcome to AutoPal", "Sign in to keep your car on schedule."],
    signup: ["Create your account", "Track maintenance, costs and mechanics in one place."],
    forgot: ["Forgot password?", "Enter the email on your account and we'll send you a reset link."],
  };
  const [title, sub] = titles[mode];
  const field = (name, label, attrs) => `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" ${attrs}>
    </label>`;

  root.innerHTML = `
    <div class="auth">
      <div class="auth-brand">
        <span class="auth-logo">${icon("wrench", 30, 2)}</span>
        <span class="auth-name">AutoPal</span>
      </div>
      <h1>${title}</h1>
      <p class="sub">${sub}</p>
      ${notice ? `<p class="notice notice-warn">${escapeHtml(notice)}</p>` : ""}
      <form class="form" novalidate>
        ${mode === "signin" ? `
          ${field("username", "Username", 'autocomplete="username" autocapitalize="off" spellcheck="false"')}
          ${field("password", "Password", 'type="password" autocomplete="current-password"')}` : ""}
        ${mode === "signup" ? `
          ${field("email", "Email", 'type="email" autocomplete="email" autocapitalize="off" spellcheck="false"')}
          <label class="field">
            <span>Username</span>
            <input name="username" autocomplete="username" maxlength="30" autocapitalize="off" spellcheck="false">
            <small class="hint">3–30 letters, numbers, dots or underscores.</small>
          </label>
          <label class="field">
            <span>Password</span>
            <input name="password" type="password" autocomplete="new-password">
            <small class="hint">At least 8 characters.</small>
          </label>` : ""}
        ${mode === "forgot" ? field("email", "Email", 'type="email" autocomplete="email" autocapitalize="off" spellcheck="false"') : ""}
        <p class="form-error" role="alert" hidden></p>
        <button class="btn" type="submit">${{ signin: "Log In", signup: "Create Account", forgot: "Send Reset Link" }[mode]}</button>
      </form>
      <div class="auth-links">
        ${mode === "signin" ? `
          <a href="#/forgot">Forgot password?</a>
          <p>Don't have an account? <a href="#/signup">Create account</a></p>` : ""}
        ${mode === "signup" ? `<p>Already have an account? <a href="#/signin">Log in</a></p>` : ""}
        ${mode === "forgot" ? `<p><a href="#/signin">Back to log in</a></p>` : ""}
      </div>
    </div>`;

  const form = root.querySelector("form");
  const errEl = root.querySelector(".form-error");
  const showError = (msg) => { errEl.textContent = msg; errEl.hidden = !msg; };
  const done = (iconName, heading, html) => {
    root.querySelector(".auth").innerHTML = `
      <div class="empty">
        <div class="empty-art">${icon(iconName, 64, 1.6)}</div>
        <h2>${heading}</h2>
        <p>${html}</p>
        <p><a href="#/signin">Back to log in</a></p>
      </div>`;
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    showError("");
    const f = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, k === "password" ? v : v.trim()]));
    const empty = Object.entries(f).filter(([, v]) => !v).map(([k]) => k);
    if (empty.length) {
      const names = { username: "username", password: "password", email: "email" };
      return showError(`Please fill in your ${empty.map((k) => names[k]).join(" and ")}.`.replace(/ and (?=.* and )/g, ", "));
    }
    if (f.email !== undefined && !EMAIL_RE.test(f.email)) return showError("That's not a valid email address.");

    withBusy(form.querySelector("button[type=submit]"), async () => {
      try {
        if (mode === "signin") {
          await signIn(f.username, f.password);
          ctx.navigate("#/home", { replace: true });
        } else if (mode === "signup") {
          if (!USERNAME_RE.test(f.username)) return showError("Usernames are 3–30 letters, numbers, dots or underscores.");
          if (f.password.length < 8) return showError("Password must be at least 8 characters.");
          if (!(await isUsernameAvailable(f.username))) return showError("That username is already taken. Please pick a different one.");
          const { needsConfirmation } = await signUp({ email: f.email, password: f.password, username: f.username });
          if (needsConfirmation) {
            done("check", "Check your email", `We sent a confirmation link to <strong>${escapeHtml(f.email)}</strong>. Open it to finish creating your account, then log in with your username.`);
          } else {
            ctx.navigate("#/home", { replace: true });
          }
        } else {
          await sendPasswordReset(f.email);
          done("lock", "Check your email", `If an account exists for <strong>${escapeHtml(f.email)}</strong>, a reset link is on its way.`);
        }
      } catch (err) {
        showError(errorMessage(err));
      }
    });
  });

  root.querySelector("input")?.focus();
}
