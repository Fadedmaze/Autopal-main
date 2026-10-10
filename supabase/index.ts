// username-sign-in: looks up the account's email from its username (server-side,
// so emails are never exposed to the browser), signs in, and returns the tokens
// that js/auth.js passes to supabase.auth.setSession().
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const BAD_LOGIN = "The username or password is incorrect.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = String(body.username ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!username || !password) return json({ error: BAD_LOGIN }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Case-insensitive exact match. Escape LIKE wildcards, since "_" is allowed in usernames.
  const pattern = username.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", pattern)
    .maybeSingle();
  if (!profile) return json({ error: BAD_LOGIN }, 401);

  const { data: found, error: lookupErr } = await admin.auth.admin.getUserById(profile.id);
  const email = found?.user?.email;
  if (lookupErr || !email) return json({ error: BAD_LOGIN }, 401);

  const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    if (error && /not confirmed/i.test(error.message)) {
      return json({ error: "Please confirm your email first. Check your inbox for the link." }, 401);
    }
    return json({ error: BAD_LOGIN }, 401);
  }

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
