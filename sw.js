// AutoPal service worker. Bump CACHE on every release; it doubles as the
// "is the new version live yet" probe after a deploy.
const CACHE = "autopal-shell-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css?v=1",
  "./js/app.js?v=1",
  "./js/auth.js",
  "./js/config.js",
  "./js/components.js",
  "./js/data.js",
  "./js/prefs.js",
  "./js/supabaseClient.js",
  "./js/ui.js",
  "./js/views/auth.js",
  "./js/views/budget.js",
  "./js/views/garage.js",
  "./js/views/home.js",
  "./js/views/library.js",
  "./js/views/mechanics.js",
  "./js/views/photo.js",
  "./js/views/profile.js",
  "./js/views/resetPassword.js",
  "./js/views/taskForm.js",
  "./js/views/tasks.js",
  "./js/views/vehicle.js",
  "./js/views/vehicleForm.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same-origin app files: network first (always fresh when online), cache as the
// offline fallback. Everything else (Supabase API, map tiles, CDNs) passes through.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html"))),
  );
});
