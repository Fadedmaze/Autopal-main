// send-reminders: maintenance reminders that reach people when AutoPal is closed.
//
// Daily run (called by pg_cron, see supabase/setup/schedule_reminders.sql, with the
// x-cron-secret header): finds open tasks whose reminder day has arrived and that
// aren't overdue, and sends each person one push notification per device and one
// email listing their tasks. reminder_log makes sure each task is reminded once
// per due date and channel.
//
// Test (called from Profile > Notifications with the user's sign-in): sends a test
// push and email to that user only.
//
// Secrets (Edge Functions > Secrets): CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (e.g. mailto:you@gmail.com), BREVO_API_KEY, EMAIL_FROM (the sender
// address verified in Brevo), optional APP_URL. Push works without the email secrets
// and email works without the push ones.
// Deploy with "Verify JWT" turned OFF: the cron call has no user token, and test
// calls are checked here.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const env = (name: string) => (typeof Deno !== "undefined" ? Deno.env.get(name) ?? "" : "");
const TIME_ZONE = "America/Denver";

// ---- base64url helpers --------------------------------------------------------------
export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const enc = new TextEncoder();
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

// ---- Web Push (RFC 8291 aes128gcm encryption + RFC 8292 VAPID) -----------------------
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

// Encrypts a payload for one subscription. Returns the request body.
export async function encryptPayload(payload: Uint8Array, p256dh: string, authSecret: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPublic = b64urlToBytes(p256dh);
  const auth = b64urlToBytes(authSecret);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const ikm = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(payload, new Uint8Array([2]))));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

// VAPID: proves to the push service that the message comes from this app.
export async function vapidAuthorization(endpoint: string, publicKey: string, privateKey: string, subject: string, now = Date.now()) {
  const pub = b64urlToBytes(publicKey);
  const jwk = {
    kty: "EC", crv: "P-256", ext: true,
    x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), d: privateKey,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const part = (o: unknown) => bytesToB64url(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${bytesToB64url(sig)}, k=${publicKey}`;
}

type Sub = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string };

// Returns "ok", "gone" (subscription expired: delete it) or "error".
async function sendPush(sub: Sub, message: unknown) {
  const pub = env("VAPID_PUBLIC_KEY"), priv = env("VAPID_PRIVATE_KEY");
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, pub, priv, env("VAPID_SUBJECT") || "mailto:autopal@example.com"),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body,
  });
  if (res.status === 404 || res.status === 410) return "gone";
  if (!res.ok) {
    console.error("push failed", res.status, await res.text().catch(() => ""));
    return "error";
  }
  return "ok";
}

// ---- Email (Brevo transactional API) ------------------------------------------------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env("BREVO_API_KEY"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: { email: env("EMAIL_FROM"), name: "AutoPal" }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
  });
  if (!res.ok) console.error("email failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

// ---- Which reminders are due --------------------------------------------------------
export function todayIn(tz: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysUntil = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
export function dueText(due: string, today: string) {
  const n = daysUntil(today, due);
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due in ${n} days`;
}

type Task = { id: number; task_name: string; due_date: string; remind_days_before: number | null; vehicle_id: number; user_id: string; car: string };
type Settings = { user_id: string; reminder_days_before: number; email_reminders?: boolean };

// Tasks whose reminder day has arrived and that aren't overdue yet, grouped by user.
export function remindersDue(tasks: Task[], settings: Settings[], today: string) {
  const byUser = new Map(settings.map((s) => [s.user_id, s]));
  const out = new Map<string, Task[]>();
  for (const t of tasks) {
    const s = byUser.get(t.user_id);
    if (!s || !t.due_date) continue;
    const remindOn = addDays(t.due_date, -(t.remind_days_before ?? s.reminder_days_before));
    if (remindOn <= today && t.due_date >= today) {
      if (!out.has(t.user_id)) out.set(t.user_id, []);
      out.get(t.user_id)!.push(t);
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.due_date.localeCompare(b.due_date));
  return out;
}

export function pushMessage(tasks: Task[], today: string) {
  if (tasks.length === 1) {
    const t = tasks[0];
    return { title: t.task_name, body: `${dueText(t.due_date, today)} · ${t.car}`, url: `./#/tasks/${t.id}`, tag: `autopal-task-${t.id}` };
  }
  return {
    title: `${tasks.length} maintenance tasks coming up`,
    body: tasks.slice(0, 4).map((t) => `${t.task_name} (${dueText(t.due_date, today).replace("Due ", "")})`).join(", "),
    url: "./#/tasks",
    tag: "autopal-reminders",
  };
}

export function emailFor(tasks: Task[], today: string, appUrl: string) {
  const subject = tasks.length === 1 ? `Reminder: ${tasks[0].task_name} is coming up` : `Reminder: ${tasks.length} maintenance tasks coming up`;
  const rows = tasks.map((t) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb">
      <strong style="font-size:16px;color:#111827">${esc(t.task_name)}</strong><br>
      <span style="color:#b45309">${esc(dueText(t.due_date, today))}</span>
      <span style="color:#6b7280"> · ${esc(t.car)}</span>
    </td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:24px">
      <tr><td><h1 style="margin:0 0 6px;font-size:22px;color:#111827">Maintenance coming up</h1>
        <p style="margin:0 0 12px;color:#4b5563">Here's what's due soon for your car${tasks.some((t) => t.car !== tasks[0].car) ? "s" : ""}.</p></td></tr>
      ${rows}
      <tr><td style="padding-top:18px"><a href="${esc(appUrl)}/#/tasks" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open AutoPal</a></td></tr>
      <tr><td style="padding-top:18px;color:#9ca3af;font-size:12px">You're getting this because maintenance reminders are on. Turn email reminders off in AutoPal under Profile → Notification Settings.</td></tr>
    </table></body></html>`;
  const text = `Maintenance coming up\n\n${tasks.map((t) => `- ${t.task_name}: ${dueText(t.due_date, today)} (${t.car})`).join("\n")}\n\nOpen AutoPal: ${appUrl}/#/tasks\nTurn email reminders off in Profile > Notification Settings.`;
  return { subject, html, text };
}

// Same look as the app: task and car names in Title Case.
const titleCase = (s: string) => (s ?? "").trim().replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1));

// ---- The function -----------------------------------------------------------------
const carName = (v: { vehicle_nickname?: string | null; brand?: string; make?: string; model_year?: number | null }) =>
  (v?.vehicle_nickname?.trim() && titleCase(v.vehicle_nickname)) || [v?.model_year, v?.brand, v?.make].filter(Boolean).join(" ") || "Your car";

async function handle(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const url = env("SUPABASE_URL");
  const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const pushReady = Boolean(env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY"));
  const emailReady = Boolean(env("BREVO_API_KEY") && env("EMAIL_FROM"));
  const appUrl = (env("APP_URL") || "https://autopalv01.vercel.app").replace(/\/+$/, "");
  const today = todayIn(TIME_ZONE);

  const cronSecret = env("CRON_SECRET");
  const isCron = Boolean(cronSecret) && req.headers.get("x-cron-secret") === cronSecret;
  let testUser: { id: string; email?: string } | null = null;
  if (!isCron) {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = token ? await admin.auth.getUser(token) : { data: null };
    if (!data?.user) return json({ error: "Not allowed." }, 401);
    testUser = { id: data.user.id, email: data.user.email ?? undefined };
  }

  const deliverPush = async (userId: string, message: unknown) => {
    if (!pushReady) return 0;
    const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("user_id", userId);
    let sent = 0;
    for (const sub of (subs ?? []) as Sub[]) {
      const result = await sendPush(sub, message).catch((e) => { console.error(e); return "error"; });
      if (result === "gone") await admin.from("push_subscriptions").delete().eq("id", sub.id);
      if (result === "ok") {
        sent += 1;
        await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", sub.id);
      }
    }
    return sent;
  };
  const emailOf = async (userId: string) => (await admin.auth.admin.getUserById(userId)).data?.user?.email ?? null;

  // ---- Test: one user, right now ----
  if (testUser) {
    const devices = await deliverPush(testUser.id, {
      title: "AutoPal notifications are working", body: "You'll get reminders like this when maintenance is coming up.", url: "./#/profile/notifications", tag: "autopal-test",
    });
    let email = false;
    if (emailReady && testUser.email) {
      email = await sendEmail(testUser.email, "AutoPal email reminders are working",
        `<p style="font-family:Arial,sans-serif">You'll get an email like this when maintenance is coming up. <a href="${esc(appUrl)}">Open AutoPal</a></p>`,
        `You'll get an email like this when maintenance is coming up. ${appUrl}`);
    }
    return json({ test: true, push_ready: pushReady, email_ready: emailReady, devices, email });
  }

  // ---- Daily run ----
  const { data: settings, error: sErr } = await admin.from("notification_settings")
    .select("user_id, reminder_days_before, email_reminders").eq("task_reminders_enabled", true);
  if (sErr) return json({ error: sErr.message }, 500);
  const { data: rows, error: tErr } = await admin.from("maintenance_tasks")
    .select("id, task_name, due_date, remind_days_before, vehicle_id, vehicles!inner(user_id, vehicle_nickname, brand, make, model_year)")
    .eq("is_completed", false).gte("due_date", today).lte("due_date", addDays(today, 61));
  if (tErr) return json({ error: tErr.message }, 500);
  const tasks: Task[] = (rows ?? []).map((r: any) => ({
    id: r.id, task_name: titleCase(r.task_name), due_date: r.due_date, remind_days_before: r.remind_days_before,
    vehicle_id: r.vehicle_id, user_id: r.vehicles.user_id, car: carName(r.vehicles),
  }));
  const due = remindersDue(tasks, settings ?? [], today);

  const ids = [...due.values()].flat().map((t) => t.id);
  const { data: logged } = ids.length
    ? await admin.from("reminder_log").select("task_id, due_date, channel").in("task_id", ids)
    : { data: [] };
  const already = new Set((logged ?? []).map((l: any) => `${l.task_id}|${l.due_date}|${l.channel}`));
  const settingsBy = new Map((settings ?? []).map((s: any) => [s.user_id, s]));
  const summary = { today, users: due.size, push_sent: 0, emails_sent: 0 };

  for (const [userId, list] of due) {
    const pushList = list.filter((t) => !already.has(`${t.id}|${t.due_date}|push`));
    if (pushList.length && (await deliverPush(userId, pushMessage(pushList, today))) > 0) {
      summary.push_sent += 1;
      await admin.from("reminder_log").upsert(pushList.map((t) => ({ task_id: t.id, due_date: t.due_date, channel: "push" })), { ignoreDuplicates: true });
    }
    const emailList = list.filter((t) => !already.has(`${t.id}|${t.due_date}|email`));
    if (emailReady && emailList.length && settingsBy.get(userId)?.email_reminders !== false) {
      const to = await emailOf(userId);
      const { subject, html, text } = emailFor(emailList, today, appUrl);
      if (to && (await sendEmail(to, subject, html, text))) {
        summary.emails_sent += 1;
        await admin.from("reminder_log").upsert(emailList.map((t) => ({ task_id: t.id, due_date: t.due_date, channel: "email" })), { ignoreDuplicates: true });
      }
    }
  }
  return json(summary);
}

if (typeof Deno !== "undefined") Deno.serve(handle);
