// Sign In (username + password), Create Account (email, username, password),
// Forgot Password and Forgot Username. One module, four modes.
import { signIn, signUp, sendPasswordReset, sendUsernameLink, isUsernameAvailable } from "../auth.js";
import { icon, escapeHtml, errorMessage, withBusy } from "../ui.js";

const USERNAME_RE = /^[A-Za-z0-9_.]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function render(root, ctx) {
  const mode = ctx.mode;
  const notice = ctx.query.get("notice");
  const titles = {
    signin: ["Welcome to AutoPal", "Log in to keep your car on schedule."],
    signup: ["Create Your Account", "Track maintenance, costs and mechanics in one place."],
    forgot: ["Forgot Password?", "Enter the email on your account and we'll send you a reset link."],
    "forgot-username": ["Forgot Username?", "Enter the email on your account. We'll email you a link that logs you in and shows your username."],
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
        ${mode === "forgot" || mode === "forgot-username" ? field("email", "Email", 'type="email" autocomplete="email" autocapitalize="off" spellcheck="false"') : ""}
        <p class="form-error" role="alert" hidden></p>
        <button class="btn" type="submit">${{ signin: "Log In", signup: "Create Account", forgot: "Send Reset Link", "forgot-username": "Email Me a Link" }[mode]}</button>
      </form>
      <div class="auth-links">
        ${mode === "signin" ? `
          <p class="auth-forgot"><a href="#/forgot-username">Forgot Username?</a><span aria-hidden="true">·</span><a href="#/forgot">Forgot Password?</a></p>
          <p>Don't have an account? <a href="#/signup">Create Account</a></p>` : ""}
        ${mode === "signup" ? `<p>Already have an account? <a href="#/signin">Log In</a></p>` : ""}
        ${mode === "forgot" || mode === "forgot-username" ? `<p><a href="#/signin">Back to Log In</a></p>` : ""}
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
        <p><a href="#/signin">Back to Log In</a></p>
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
            done("check", "Check Your Email", `We sent a confirmation link to <strong>${escapeHtml(f.email)}</strong>. Open it to finish creating your account, then log in with your username.`);
          } else {
            ctx.navigate("#/home", { replace: true });
          }
        } else if (mode === "forgot-username") {
          await sendUsernameLink(f.email);
          done("user", "Check Your Email", `If an account exists for <strong>${escapeHtml(f.email)}</strong>, we sent it a link. Open it to log in and see your username. The link works once and expires in an hour.`);
        } else {
          await sendPasswordReset(f.email);
          done("lock", "Check Your Email", `If an account exists for <strong>${escapeHtml(f.email)}</strong>, a reset link is on its way.`);
        }
      } catch (err) {
        showError(errorMessage(err));
      }
    });
  });

  root.querySelector("input")?.focus();
}
