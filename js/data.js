// Every database and storage call lives here, so views stay about rendering.
// Explicit column lists everywhere (no select("*")) keep payloads small and stable.
import { supabase } from "./supabaseClient.js";
import { currentUserId } from "./auth.js";
import { PHOTO_BUCKET, RECEIPT_BUCKET, AVATAR_BUCKET, INSURANCE_BUCKET } from "./config.js";

const VEHICLE_COLS = "id, vehicle_nickname, brand, make, model, model_year, current_mileage, description, created_at";
const TASK_COLS = "id, vehicle_id, shop_id, catalog_id, task_name, due_date, estimated_cost, is_completed, completed_date, notes, receipt_path, remind_days_before, created_at";
const PROFILE_COLS = "id, username, display_name, avatar_path, distance_unit, active_vehicle_id";

const LIGHT_COLS = "id, slug, name, colors, severity, symbol_hint, meaning, action, drive_advice, brand_notes, brand_severity, sort_order, repair_service, repair_alt_services, repair_cost_low, repair_cost_high, needs_diagnosis, repair_note";

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// ---- Columns added by the 2026-11-04 migrations -----------------------------
// The app can be deployed before the database is migrated. If a table doesn't have its
// new columns yet, queries fall back to the older column list, and saving a value that
// needs a new column fails with a clear message instead of breaking the whole screen.
const NEW_COLS = {
  profiles: ["display_name"],
  maintenance_tasks: ["remind_days_before"],
  warning_lights: ["repair_service", "repair_alt_services", "repair_cost_low", "repair_cost_high", "needs_diagnosis", "repair_note"],
};
const notMigrated = new Set();
const NEEDS_MIGRATION = "This feature needs a database update before it works. Ask the app owner to run the latest Supabase migrations.";

// 42703: unknown column in a select/filter. PGRST204: unknown column in an insert/update.
function isMissingColumn(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || /column .*(does not exist|in the schema cache)/i.test(error?.message ?? "");
}

export function hasNewColumns(table) {
  return !notMigrated.has(table);
}

function cols(table, list) {
  return notMigrated.has(table)
    ? list.split(", ").filter((c) => !NEW_COLS[table].includes(c)).join(", ")
    : list;
}

// Drop new columns from a write when the table doesn't have them. A real value there
// (not null) can't be saved, so say so.
function fieldsFor(table, fields) {
  if (!notMigrated.has(table)) return fields;
  const out = { ...fields };
  for (const c of NEW_COLS[table]) {
    if (out[c] != null) throw new Error(NEEDS_MIGRATION);
    delete out[c];
  }
  return out;
}

// Runs a query built by `build()`; on a missing-column error, marks the table as not
// migrated and runs it once more (build() then picks the older columns/fields).
async function run(table, build) {
  const res = await build();
  if (res.error && isMissingColumn(res.error) && !notMigrated.has(table)) {
    notMigrated.add(table);
    return check(await build());
  }
  return check(res);
}

// ---- Profile & settings --------------------------------------------------

export async function getProfile() {
  return run("profiles", () => supabase
    .from("profiles")
    .select(cols("profiles", PROFILE_COLS))
    .eq("id", currentUserId())
    .single());
}

export async function updateProfile(fields) {
  return run("profiles", () => supabase
    .from("profiles")
    .update(fieldsFor("profiles", fields))
    .eq("id", currentUserId())
    .select(cols("profiles", PROFILE_COLS))
    .single());
}

// Display name: 1-40 characters after trimming (checked here and in the database).
export async function saveDisplayName(name) {
  return updateProfile({ display_name: name });
}

export async function getSettings() {
  return check(await supabase
    .from("notification_settings")
    .select("task_reminders_enabled, reminder_days_before")
    .eq("user_id", currentUserId())
    .single());
}

export async function updateSettings(fields) {
  return check(await supabase
    .from("notification_settings")
    .update(fields)
    .eq("user_id", currentUserId())
    .select("task_reminders_enabled, reminder_days_before")
    .single());
}

// ---- Vehicles ------------------------------------------------------------

// Vehicles in garage order, each with its display label ("Vehicle N" fallback by
// list position, per the Garage mockup) and its task rollup from the DB view.
export async function listVehicles() {
  const [vehicles, summaries] = await Promise.all([
    supabase.from("vehicles").select(VEHICLE_COLS).order("created_at").order("id").then(check),
    supabase.from("vehicle_task_summary")
      .select("vehicle_id, open_count, overdue_count, next_due_date, open_estimated_total, completed_cost_total, all_estimated_total")
      .then(check),
  ]);
  const byId = new Map(summaries.map((s) => [s.vehicle_id, s]));
  return vehicles.map((v, i) => withLabel(v, i, byId.get(v.id)));
}

function withLabel(v, index, summary) {
  const nickname = v.vehicle_nickname?.trim();
  return {
    ...v,
    index,
    label: nickname || `Vehicle ${index + 1}`,
    unnamed: !nickname,
    summary: summary ?? { open_count: 0, overdue_count: 0, next_due_date: null, open_estimated_total: 0, completed_cost_total: 0, all_estimated_total: 0 },
  };
}

export async function getVehicle(id) {
  const all = await listVehicles();
  return all.find((v) => v.id === Number(id)) ?? null;
}

export async function createVehicle(fields) {
  const vehicle = check(await supabase.from("vehicles").insert(fields).select(VEHICLE_COLS).single());
  // First car added becomes the one shown on Home.
  const profile = await getProfile();
  if (!profile.active_vehicle_id) await updateProfile({ active_vehicle_id: vehicle.id });
  return vehicle;
}

export async function updateVehicle(id, fields) {
  return check(await supabase.from("vehicles").update(fields).eq("id", id).select(VEHICLE_COLS).single());
}

// Storage doesn't cascade, so remove the vehicle's photos and receipts before the row.
export async function deleteVehicle(id) {
  const [photos, receipts] = await Promise.all([
    supabase.from("vehicle_photos").select("storage_path").eq("vehicle_id", id).then(check),
    supabase.from("maintenance_tasks").select("receipt_path").eq("vehicle_id", id).not("receipt_path", "is", null).then(check),
  ]);
  if (photos.length) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(photos.map((p) => p.storage_path));
    if (error) throw error;
  }
  if (receipts.length) {
    const { error } = await supabase.storage.from(RECEIPT_BUCKET).remove(receipts.map((r) => r.receipt_path));
    if (error) throw error;
  }
  check(await supabase.from("vehicles").delete().eq("id", id));
}

export async function setActiveVehicle(id) {
  return updateProfile({ active_vehicle_id: id });
}

// Active vehicle, falling back to the first in the garage (and repairing the profile).
export async function resolveActiveVehicle(profile, vehicles) {
  const active = vehicles.find((v) => v.id === profile.active_vehicle_id);
  if (active) return active;
  if (!vehicles.length) return null;
  await setActiveVehicle(vehicles[0].id);
  return vehicles[0];
}

// ---- Maintenance tasks ---------------------------------------------------

// Filters: vehicleId, completed (bool), from/to (inclusive due_date bounds), limit.
export async function listTasks({ vehicleId = null, completed = null, from = null, to = null, limit = 500 } = {}) {
  return run("maintenance_tasks", () => {
    let q = supabase.from("maintenance_tasks").select(cols("maintenance_tasks", TASK_COLS));
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (completed !== null) q = q.eq("is_completed", completed);
    if (from) q = q.gte("due_date", from);
    if (to) q = q.lte("due_date", to);
    if (completed === true) {
      q = q.order("completed_date", { ascending: false }).order("id", { ascending: false });
    } else {
      q = q.order("due_date", { ascending: true, nullsFirst: false }).order("id");
    }
    return q.limit(limit);
  });
}

export async function getTask(id) {
  return run("maintenance_tasks", () => supabase.from("maintenance_tasks")
    .select(cols("maintenance_tasks", TASK_COLS)).eq("id", id).maybeSingle());
}

export async function createTask(fields) {
  return run("maintenance_tasks", () => supabase.from("maintenance_tasks")
    .insert(fieldsFor("maintenance_tasks", fields)).select(cols("maintenance_tasks", TASK_COLS)).single());
}

export async function updateTask(id, fields) {
  return run("maintenance_tasks", () => supabase.from("maintenance_tasks")
    .update(fieldsFor("maintenance_tasks", fields)).eq("id", id).select(cols("maintenance_tasks", TASK_COLS)).single());
}

export async function deleteTask(id) {
  check(await supabase.from("maintenance_tasks").delete().eq("id", id));
}

export async function setTaskCompleted(id, done, dateISO) {
  return updateTask(id, { is_completed: done, completed_date: done ? dateISO : null });
}

// ---- Photos --------------------------------------------------------------

export async function listPhotos(vehicleId) {
  const rows = check(await supabase
    .from("vehicle_photos")
    .select("id, vehicle_id, storage_path, uploaded_at")
    .eq("vehicle_id", vehicleId)
    .order("uploaded_at", { ascending: false }));
  if (!rows.length) return [];
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  if (error) throw error;
  const urls = new Map(data.map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? null }));
}

export async function uploadPhoto(vehicleId, blob, ext = "jpg") {
  const path = `${currentUserId()}/${vehicleId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: contentTypeFor(blob, ext), upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from("vehicle_photos")
    .insert({ vehicle_id: vehicleId, storage_path: path })
    .select("id, vehicle_id, storage_path, uploaded_at")
    .single();
  if (error) {
    // Don't leave an orphaned file if the row couldn't be saved.
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw error;
  }
  return data;
}

export async function deletePhoto(photo) {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  if (error) throw error;
  check(await supabase.from("vehicle_photos").delete().eq("id", photo.id));
}

// ---- Receipts ------------------------------------------------------------

export async function uploadReceipt(task, blob, ext) {
  const path = `${currentUserId()}/${task.vehicle_id}/${task.id}-${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(RECEIPT_BUCKET)
    .upload(path, blob, { contentType: contentTypeFor(blob, ext), upsert: false });
  if (upErr) throw upErr;
  try {
    const updated = await updateTask(task.id, { receipt_path: path });
    if (task.receipt_path) await supabase.storage.from(RECEIPT_BUCKET).remove([task.receipt_path]);
    return updated;
  } catch (err) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
    throw err;
  }
}

export async function receiptUrl(path) {
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteTaskWithReceipt(task) {
  if (task.receipt_path) await supabase.storage.from(RECEIPT_BUCKET).remove([task.receipt_path]);
  await deleteTask(task.id);
}

// ---- Profile picture -------------------------------------------------------

// Upload first, then point the profile at it; the old picture is removed only
// after the new one is saved, so a failure leaves the old picture in place.
export async function uploadAvatar(blob, ext, previousPath) {
  const path = `${currentUserId()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: contentTypeFor(blob, ext), upsert: false });
  if (error) throw error;
  try {
    const profile = await updateProfile({ avatar_path: path });
    if (previousPath) await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
    return profile;
  } catch (err) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    throw err;
  }
}

export async function avatarUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ---- Insurance card --------------------------------------------------------
// Front and back of the user's insurance card (image or PDF) in a private bucket.
// Kept out of PROFILE_COLS so the rest of the app still works if the
// 20261105_insurance_card migration hasn't been run; the screen says so instead.

const INSURANCE_COL = { front: "insurance_front_path", back: "insurance_back_path" };

export async function getInsuranceCard() {
  const { data, error } = await supabase
    .from("profiles")
    .select("insurance_front_path, insurance_back_path")
    .eq("id", currentUserId())
    .single();
  if (error) {
    const err = new Error("Insurance cards aren't set up yet. Ask the app owner to run the insurance card update in Supabase.");
    err.notConfigured = true;
    throw err;
  }
  return { front: data.insurance_front_path, back: data.insurance_back_path };
}

// Upload first, then point the profile at it; the old file is removed only after
// the new one is saved, so a failure keeps the old card.
export async function uploadInsuranceCard(side, blob, ext, previousPath) {
  const col = INSURANCE_COL[side];
  if (!col) throw new Error("Unknown card side.");
  const path = `${currentUserId()}/${side}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(INSURANCE_BUCKET)
    .upload(path, blob, { contentType: contentTypeFor(blob, ext), upsert: false });
  if (error) throw error;
  try {
    check(await supabase.from("profiles").update({ [col]: path }).eq("id", currentUserId()).select("id").single());
    if (previousPath) await supabase.storage.from(INSURANCE_BUCKET).remove([previousPath]);
    return path;
  } catch (err) {
    await supabase.storage.from(INSURANCE_BUCKET).remove([path]);
    throw err;
  }
}

export async function removeInsuranceCard(side, path) {
  const col = INSURANCE_COL[side];
  if (!col) throw new Error("Unknown card side.");
  check(await supabase.from("profiles").update({ [col]: null }).eq("id", currentUserId()).select("id").single());
  if (path) await supabase.storage.from(INSURANCE_BUCKET).remove([path]);
}

// Short-lived link (10 minutes): the card has personal details on it.
export async function insuranceCardUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(INSURANCE_BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data.signedUrl;
}

function contentTypeFor(blob, ext) {
  if (blob.type) return blob.type;
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf" }[ext] ?? "application/octet-stream";
}

// ---- Mechanic shops ------------------------------------------------------

export async function nearbyShops(lat, lng, limit = 50) {
  return check(await supabase.rpc("nearby_shops", { p_lat: lat, p_lng: lng, p_limit: limit }));
}

// ---- Library -----------------------------------------------------------

const GUIDE_COLS = "id, category, slug, title, summary, steps, tools, time_estimate, severity, sort_order";
const GUIDE_DIY_COLS = "difficulty, task_name, video_query, safety, image_path, intro, prep, step_details, wrap_up";

// The DIY columns come from migrations/20261102_library_diy_guides.sql. If that
// hasn't been run yet, fall back to the original columns so the Library still loads.
export async function listGuides() {
  const query = (cols) => supabase.from("guides").select(cols).order("category").order("sort_order");
  const full = await query(`${GUIDE_COLS}, ${GUIDE_DIY_COLS}`);
  if (!full.error) return full.data;
  return check(await query(GUIDE_COLS)).map((g) => ({ ...g, safety: [], step_details: [] }));
}

// ---- Discover: warning lights --------------------------------------------

let warningLightsCache = null;

// Catalog of dashboard lights (read-only reference data), cached for the session.
export async function listWarningLights() {
  warningLightsCache ??= await run("warning_lights", () => supabase
    .from("warning_lights")
    .select(cols("warning_lights", LIGHT_COLS))
    .order("sort_order"))
    .catch((err) => { warningLightsCache = null; throw err; });
  return warningLightsCache;
}

// Sends base64 JPEG crops (no data: prefix) to the identify-warning-lights Edge
// Function; returns [{ index, is_warning_light, slug, confidence, observed_color, vehicle_note }].
export async function identifyLights(vehicleId, crops) {
  const { data, error } = await supabase.functions.invoke("identify-warning-lights", {
    body: { vehicle_id: vehicleId, crops },
  });
  if (error) {
    // invoke() hides the JSON body on non-2xx responses; surface the real message.
    let message = "The scanner is unavailable right now. Please try again.";
    try {
      message = (await error.context.json()).error || message;
    } catch { /* network failure: keep the generic message */ }
    throw new Error(message);
  }
  return data.results;
}
