// In-memory stand-in for js/supabaseClient.js, used only by the local test harness.
// Mirrors the bits of supabase-js the app uses, plus the DB triggers/views it relies on.
// Expose state for assertions: window.__db (tables), window.__calls (every call).

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const params = new URLSearchParams(location.search);
const USER_ID = "00000000-0000-4000-8000-000000000001";
const scenario = params.get("scenario") || "full"; // full | empty | signedout

const db = (window.__db = {
  profiles: [{ id: USER_ID, username: "andrew", avatar_path: null, distance_unit: "mi", active_vehicle_id: null }],
  notification_settings: [{ user_id: USER_ID, task_reminders_enabled: true, reminder_days_before: 7 }],
  vehicles: [],
  vehicle_photos: [],
  maintenance_tasks: [],
  maintenance_catalog: [
    ["Oil change", 75, 120, 30], ["Tire rotation", 40, 180, 45], ["Tire pressure check", 0, 30, 7],
    ["Wiper blades", 30, 365, 90], ["Engine air filter", 35, 365, 120], ["Brake inspection", 50, 365, 150],
    ["Emissions test", 30, 365, 180], ["Battery check", 25, 365, 200],
  ].map(([task_name, typical_cost, interval_days, first_due_days], i) => ({ id: i + 1, task_name, typical_cost, interval_days, first_due_days, sort_order: i + 1 })),
  mechanic_shops: [
    ["Joe's Auto Shop", "450 N University Ave", "Provo", 40.2403, -111.6586, 4.5, 285, ["Oil change", "Brakes", "Tires", "Inspection"]],
    ["Cougar Country Car Care", "1230 N Canyon Rd", "Provo", 40.2519, -111.6507, 4.7, 340, ["Oil change", "Brakes", "Engine", "Electrical"]],
    ["Freedom Blvd Brake & Tire", "780 S Freedom Blvd", "Provo", 40.2226, -111.6656, 4.2, 210, ["Brakes", "Tires", "Alignment"]],
    ["Riverside Lube Express", "2250 N University Pkwy", "Provo", 40.2688, -111.6665, 3.9, 95, ["Oil change", "Inspection"]],
    ["State Street Service Center", "560 S State St", "Orem", 40.2887, -111.6945, 4.4, 260, ["Oil change", "Brakes", "Tires", "Engine"]],
    ["Springville Auto Repair", "350 S Main St", "Springville", 40.1595, -111.6106, 4.8, 275, ["Oil change", "Brakes", "Tires", "Electrical"]],
  ].map(([shop_name, street_address, city, latitude, longitude, average_rating, average_repair_price, services], i) => ({
    id: i + 1, shop_name, street_address, city, phone: "(801) 555-01" + String(i).padStart(2, "0"),
    latitude, longitude, average_rating, average_repair_price, services,
  })),
  guides: [
    { id: 1, category: "diy", slug: "check-oil-level", title: "Check your oil level", summary: "A 2-minute check that catches low oil early.", steps: ["Park on level ground.", "Pull the dipstick, wipe, reinsert, read."], tools: ["Rag"], time_estimate: "5 minutes", severity: null, sort_order: 1 },
    { id: 2, category: "diy", slug: "wiper-blades", title: "Replace wiper blades", summary: "Streaky wipers? New blades take minutes.", steps: ["Lift the arm.", "Slide off the old blade.", "Click in the new one."], tools: ["New blades"], time_estimate: "10 minutes", severity: null, sort_order: 2 },
    { id: 3, category: "dashboard", slug: "check-engine", title: "Check engine light", summary: "The engine computer found a problem.", steps: ["Steady: get the code read soon.", "Flashing: get to a mechanic right away."], tools: [], time_estimate: null, severity: "soon", sort_order: 1 },
    { id: 4, category: "dashboard", slug: "oil-pressure", title: "Oil pressure warning", summary: "Not enough oil pressure.", steps: ["Pull over and turn off the engine."], tools: [], time_estimate: null, severity: "stop", sort_order: 2 },
  ],
});
const storage = (window.__storage = new Map());
const calls = (window.__calls = []);
let nextId = 100;

// "DB triggers"
function seedVehicleTasks(v) {
  for (const c of db.maintenance_catalog) {
    db.maintenance_tasks.push(task({ vehicle_id: v.id, catalog_id: c.id, task_name: c.task_name, due_date: addDays(today(), c.first_due_days), estimated_cost: c.typical_cost }));
  }
}
function task(fields) {
  return { id: nextId++, shop_id: null, catalog_id: null, generated_from_task_id: null, is_completed: false, completed_date: null, notes: null, receipt_path: null, estimated_cost: null, due_date: null, created_at: new Date().toISOString(), ...fields };
}
function onTaskUpdate(before, after) {
  if (after.is_completed && !before.is_completed && after.catalog_id) {
    const c = db.maintenance_catalog.find((x) => x.id === after.catalog_id);
    if (c && !db.maintenance_tasks.some((t) => t.generated_from_task_id === after.id)) {
      db.maintenance_tasks.push(task({ vehicle_id: after.vehicle_id, catalog_id: c.id, task_name: after.task_name, due_date: addDays(after.completed_date, c.interval_days), estimated_cost: after.estimated_cost, generated_from_task_id: after.id }));
    }
  } else if (before.is_completed && !after.is_completed) {
    db.maintenance_tasks = db.maintenance_tasks.filter((t) => !(t.generated_from_task_id === after.id && !t.is_completed));
  }
}
function summaries() {
  return db.vehicles.map((v) => {
    const ts = db.maintenance_tasks.filter((t) => t.vehicle_id === v.id);
    const open = ts.filter((t) => !t.is_completed);
    const sum = (a) => a.reduce((s, t) => s + Number(t.estimated_cost ?? 0), 0);
    return {
      vehicle_id: v.id, open_count: open.length,
      overdue_count: open.filter((t) => t.due_date && t.due_date < today()).length,
      next_due_date: open.map((t) => t.due_date).filter(Boolean).sort()[0] ?? null,
      open_estimated_total: sum(open), completed_cost_total: sum(ts.filter((t) => t.is_completed)), all_estimated_total: sum(ts),
    };
  });
}

if (scenario === "full") {
  const add = (fields) => {
    const v = { id: nextId++, user_id: USER_ID, description: null, current_mileage: null, model: null, created_at: new Date(Date.now() - (10 - nextId) * 1000).toISOString(), ...fields };
    db.vehicles.push(v);
    seedVehicleTasks(v);
    return v;
  };
  const a = add({ vehicle_nickname: "Daily Driver", brand: "Honda", make: "Civic", model: "EX", model_year: 2019, current_mileage: 62480, description: "Silver. Small ding on the rear bumper." });
  add({ vehicle_nickname: null, brand: "Ford", make: "F-150", model: "XLT", model_year: 2015, current_mileage: 118902 });
  db.profiles[0].active_vehicle_id = a.id;
  // An overdue custom task and a completed one with history.
  db.maintenance_tasks.push(task({ vehicle_id: a.id, task_name: "Replace headlight bulb", due_date: addDays(today(), -3), estimated_cost: 25 }));
  db.maintenance_tasks.push(task({ vehicle_id: a.id, task_name: "Oil change", is_completed: true, completed_date: addDays(today(), -60), estimated_cost: 72, due_date: addDays(today(), -62) }));
}

// ---- Query builder ------------------------------------------------------

function cols(list, row) {
  if (!list || list === "*") return { ...row };
  const out = {};
  for (const c of list.split(",").map((s) => s.trim())) out[c] = row[c];
  return out;
}

class Query {
  constructor(table) {
    this.table = table; this.filters = []; this.orders = []; this.op = "select"; this.cols = "*";
    this._limit = null; this._single = null; this.payload = null; this.returning = false;
  }
  select(c = "*") { if (this.op === "select") this.cols = c; else { this.returning = true; this.cols = c; } return this; }
  insert(p) { this.op = "insert"; this.payload = p; return this; }
  update(p) { this.op = "update"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  gte(c, v) { this.filters.push((r) => r[c] !== null && r[c] >= v); return this; }
  lte(c, v) { this.filters.push((r) => r[c] !== null && r[c] <= v); return this; }
  not(c, op, v) { this.filters.push((r) => !(op === "is" && v === null ? r[c] === null : r[c] === v)); return this; }
  order(c, { ascending = true, nullsFirst = false } = {}) { this.orders.push({ c, ascending, nullsFirst }); return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = "single"; return this; }
  maybeSingle() { this._single = "maybe"; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.run()).then(resolve, reject); }

  rows() {
    if (this.table === "vehicle_task_summary") return summaries();
    return db[this.table];
  }
  run() {
    calls.push({ table: this.table, op: this.op, payload: this.payload });
    if (window.__failNext && window.__failNext.table === this.table && window.__failNext.op === this.op) {
      const err = window.__failNext.error; window.__failNext = null;
      return { data: null, error: err };
    }
    let data;
    if (this.op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p) => {
        const row = this.table === "maintenance_tasks" ? task(p)
          : { id: nextId++, created_at: new Date().toISOString(), uploaded_at: new Date().toISOString(), ...(this.table === "vehicles" ? { user_id: USER_ID, current_mileage: null, description: null } : {}), ...p };
        db[this.table].push(row);
        if (this.table === "vehicles") seedVehicleTasks(row);
        return row;
      });
      data = this.returning ? items.map((r) => cols(this.cols, r)) : null;
    } else {
      let rows = this.rows().filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") {
        rows.forEach((r) => {
          const before = { ...r };
          Object.assign(r, this.payload);
          if (this.table === "maintenance_tasks") onTaskUpdate(before, r);
        });
      } else if (this.op === "delete") {
        db[this.table] = db[this.table].filter((r) => !rows.includes(r));
        if (this.table === "vehicles") {
          const ids = rows.map((r) => r.id);
          db.maintenance_tasks = db.maintenance_tasks.filter((t) => !ids.includes(t.vehicle_id));
          db.vehicle_photos = db.vehicle_photos.filter((p) => !ids.includes(p.vehicle_id));
          db.profiles.forEach((p) => { if (ids.includes(p.active_vehicle_id)) p.active_vehicle_id = null; });
        }
      }
      for (const o of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const x = a[o.c], y = b[o.c];
          if (x === y) return 0;
          if (x === null || x === undefined) return o.nullsFirst ? -1 : 1;
          if (y === null || y === undefined) return o.nullsFirst ? 1 : -1;
          return (x < y ? -1 : 1) * (o.ascending ? 1 : -1);
        });
      }
      if (this._limit) rows = rows.slice(0, this._limit);
      data = this.op === "delete" && !this.returning ? null : rows.map((r) => cols(this.cols, r));
    }
    if (this._single) {
      const arr = data ?? [];
      if (this._single === "single" && arr.length !== 1) return { data: null, error: { message: `expected 1 row, got ${arr.length}` } };
      data = arr[0] ?? null;
    }
    return { data: structuredClone(data), error: null };
  }
}

// ---- Auth -------------------------------------------------------------

let session = scenario === "signedout" ? null : { user: { id: USER_ID, email: "andrew@example.com" }, access_token: "x" };
const listeners = [];
const emit = (event) => listeners.forEach((cb) => cb(event, session));

const auth = {
  async getSession() { return { data: { session } }; },
  onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
  async signInWithPassword({ password }) {
    calls.push({ auth: "signInWithPassword" });
    if (password !== "correct-horse") return { data: {}, error: { message: "Invalid login credentials" } };
    session = { user: { id: USER_ID, email: "andrew@example.com" } };
    return { data: { session }, error: null };
  },
  async setSession() { session = { user: { id: USER_ID, email: "andrew@example.com" } }; emit("SIGNED_IN"); return { data: { session }, error: null }; },
  async signUp({ options }) { calls.push({ auth: "signUp", options }); return { data: { session: null, user: {} }, error: null }; },
  async signOut() { session = null; emit("SIGNED_OUT"); return { error: null }; },
  async updateUser(u) { calls.push({ auth: "updateUser", u }); return { data: {}, error: null }; },
  async resetPasswordForEmail() { return { error: null }; },
};

// ---- RPC / functions / storage ---------------------------------------------

async function rpc(name, args) {
  calls.push({ rpc: name, args });
  if (name === "is_username_available") return { data: !db.profiles.some((p) => p.username?.toLowerCase() === args.p_username.toLowerCase()) && args.p_username !== "taken", error: null };
  if (name === "nearby_shops") {
    const R = 3958.8, rad = (x) => (x * Math.PI) / 180;
    const data = db.mechanic_shops.map((s) => {
      const a = Math.sin(rad(s.latitude - args.p_lat) / 2) ** 2 + Math.cos(rad(args.p_lat)) * Math.cos(rad(s.latitude)) * Math.sin(rad(s.longitude - args.p_lng) / 2) ** 2;
      return { ...s, distance_miles: 2 * R * Math.asin(Math.sqrt(a)) };
    }).sort((x, y) => x.distance_miles - y.distance_miles);
    return { data, error: null };
  }
  return { data: null, error: { message: `unknown rpc ${name}` } };
}

const functions = {
  async invoke(name, { body }) {
    calls.push({ fn: name, body });
    if (body.username === "andrew" && body.password === "correct-horse") return { data: { access_token: "a", refresh_token: "r" }, error: null };
    const res = new Response(JSON.stringify({ error: "The username or password is incorrect." }), { status: 401 });
    return { data: null, error: { message: "Edge Function returned a non-2xx status code", context: res } };
  },
};

const PIXEL = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#9ab"/><text x="80" y="56" font-size="14" text-anchor="middle" fill="#fff">stub image</text></svg>');
const storageApi = {
  from(bucket) {
    return {
      async upload(path, blob) {
        calls.push({ storage: "upload", bucket, path });
        if (window.__failUpload) { window.__failUpload = false; return { error: { message: "Upload failed (simulated)." } }; }
        storage.set(`${bucket}/${path}`, blob);
        return { data: { path }, error: null };
      },
      async remove(paths) { calls.push({ storage: "remove", bucket, paths }); paths.forEach((p) => storage.delete(`${bucket}/${p}`)); return { error: null }; },
      async createSignedUrls(paths) { return { data: paths.map((p) => ({ path: p, signedUrl: PIXEL })), error: null }; },
      async createSignedUrl() { return { data: { signedUrl: PIXEL }, error: null }; },
    };
  },
};

export const supabase = { from: (t) => new Query(t), rpc, auth, functions, storage: storageApi };
