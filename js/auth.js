// Session state and auth actions. Views read the session through currentSession().
import { supabase } from "./supabaseClient.js";

let session = null;

export async function initAuth(onChange) {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  supabase.auth.onAuthStateChange((event, next) => {
    session = next;
    onChange(event, next);
  });
  return session;
}

export function currentSession() {
  return session;
}

export function currentUserId() {
  return session?.user?.id ?? null;
}

// Username sign-in goes through the username-sign-in Edge Function, which finds
// the account's email server-side and hands back session tokens.
export async function signIn(username, password) {
  const { data, error } = await supabase.functions.invoke("username-sign-in", {
    body: { username, password },
  });
  if (error) {
    // invoke() hides the JSON body on non-2xx responses; read the real message.
    let message = "Sign-in is unavailable right now. Please try again.";
    try {
      message = (await error.context.json()).error || message;
    } catch { /* network failure: keep the generic message */ }
    throw new Error(message);
  }
  const { data: s, error: setErr } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (setErr) throw setErr;
  session = s.session;
  return s;
}

// Re-checks the current password (Change Password asks for it).
export async function verifyPassword(password) {
  const email = session?.user?.email;
  if (!email) return false;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return false;
  session = data.session;
  return true;
}

// Returns { needsConfirmation } — true when the project requires email confirmation,
// in which case Supabase creates the user but returns no session yet.
export async function signUp({ email, password, username }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${location.origin}${location.pathname}`,
    },
  });
  if (error) throw error;
  if (data.session) session = data.session;
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  await supabase.auth.signOut();
  session = null;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Supabase appends its own #access_token fragment, so no route here; the
    // PASSWORD_RECOVERY auth event sends the user to the reset screen instead.
    redirectTo: `${location.origin}${location.pathname}`,
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function isUsernameAvailable(username) {
  const { data, error } = await supabase.rpc("is_username_available", { p_username: username });
  if (error) throw error;
  return data === true;
}
