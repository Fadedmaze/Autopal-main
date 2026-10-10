// Every database and storage call lives here, so views stay about rendering.
// Explicit column lists everywhere (no select("*")) keep payloads small and stable.
import { supabase } from "./supabaseClient.js";
import { currentUserId } from "./auth.js";
import { PHOTO_BUCKET, RECEIPT_BUCKET, AVATAR_BUCKET } from "./config.js";

const VEHICLE_COLS = "id, vehicle_nickname, brand, make, model, model_year, current_mileage, description, created_at";
const TASK_COLS = "id, vehicle_id, shop_id, catalog_id, task_name, due_date, estimated_cost, is_completed, completed_date, notes, receipt_path, created_at";
const PROFILE_COLS = "id, username, avatar_path, distance_unit, active_vehicle_id";

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// ---- Profile & settings --------------------------------------------------

export async function getProfile() {
  return check(await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", currentUserId())
    .single());
}

export async function updateProfile(fields) {
  return check(await supabase
    .from("profiles")
    .update(fields)
    .eq("id", currentUserId())
    .select(PROFILE_COLS)
    .single());
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
  let q = supabase.from("maintenance_tasks").select(TASK_COLS);
  if (vehicleId) q = q.eq("vehicle_id", vehicleId);
  if (completed !== null) q = q.eq("is_completed", completed);
  if (from) q = q.gte("due_date", from);
  if (to) q = q.lte("due_date", to);
  if (completed === true) {
    q = q.order("completed_date", { ascending: false }).order("id", { ascending: false });
  } else {
    q = q.order("due_date", { ascending: true, nullsFirst: false }).order("id");
  }
  return check(await q.limit(limit));
}

export async function getTask(id) {
  return check(await supabase.from("maintenance_tasks").select(TASK_COLS).eq("id", id).maybeSingle());
}

export async function createTask(fields) {
  return check(await supabase.from("maintenance_tasks").insert(fields).select(TASK_COLS).single());
}

export async function updateTask(id, fields) {
  return check(await supabase.from("maintenance_tasks").update(fields).eq("id", id).select(TASK_COLS).single());
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

function contentTypeFor(blob, ext) {
  if (blob.type) return blob.type;
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf" }[ext] ?? "application/octet-stream";
}

// ---- Mechanic shops ------------------------------------------------------

export async function nearbyShops(lat, lng, limit = 50) {
  return check(await supabase.rpc("nearby_shops", { p_lat: lat, p_lng: lng, p_limit: limit }));
}

// ---- Library -----------------------------------------------------------

export async function listGuides() {
  return check(await supabase
    .from("guides")
    .select("id, category, slug, title, summary, steps, tools, time_estimate, severity, sort_order")
    .order("category")
    .order("sort_order"));
}
