// Push notifications: reminders that arrive while AutoPal is closed.
// This device subscribes with the browser's push service, and the subscription is
// saved in push_subscriptions. Every morning the send-reminders Edge Function sends
// each subscribed device a notification for tasks whose reminder day has arrived;
// sw.js shows it. iPhone/iPad: only works after "Add to Home Screen" (iOS 16.4+).
import { supabase } from "./supabaseClient.js";
import { VAPID_PUBLIC_KEY } from "./config.js";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

// "ready", "not-configured" (no VAPID key in config.js yet), "install-first"
// (iPhone in Safari: add to Home Screen first) or "unsupported".
export function pushStatus() {
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!capable) return isIos() && !isInstalled() ? "install-first" : "unsupported";
  return "ready";
}

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration().catch(() => null);
  if (existing) return existing;
  // Not registered yet (first visit): wait briefly for app.js to register it.
  return Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 4000))]);
}

function keyBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// True when this device is subscribed and allowed to show notifications.
export async function pushOn() {
  if (pushStatus() !== "ready" || Notification.permission !== "granted") return false;
  const reg = await registration();
  return Boolean(await reg?.pushManager.getSubscription().catch(() => null));
}

// Turn push on for this device. Resolves "on", "denied", or a pushStatus() value.
// Also re-saves an existing subscription, so it moves to whoever is signed in.
export async function enablePush() {
  const status = pushStatus();
  if (status !== "ready") return status;
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await registration();
  if (!reg) return "unsupported";
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const { endpoint, keys } = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_user_agent: navigator.userAgent,
  });
  if (error) {
    await sub.unsubscribe().catch(() => {});
    throw new Error(/save_push_subscription/.test(error.message || "")
      ? "Push notifications aren't set up on the server yet (run the notifications migration)."
      : error.message);
  }
  return "on";
}

export async function disablePush() {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  try { await supabase.rpc("remove_push_subscription", { p_endpoint: sub.endpoint }); } catch { /* offline: the server drops it when it expires */ }
  await sub.unsubscribe().catch(() => {});
}

// Ask the server to send a test push to this account's devices and a test email.
// Resolves { devices, email, push_ready, email_ready }.
export async function sendTestReminder() {
  const { data, error } = await supabase.functions.invoke("send-reminders", { body: { test: true } });
  if (error) {
    let message = "Couldn't reach the reminder service. Is the send-reminders function deployed?";
    try { message = (await error.context.json()).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return data;
}
