// Map (Find Mechanic): full-screen map with a pin per shop. Tapping a pin shows the shop
// name and its average repair price. The filter tab at the top narrows the pins.
import { nearbyShops } from "../data.js";
import { escapeHtml, icon, stars, formatMoney, formatDistance, errorMessage, toast } from "../ui.js";

const DEFAULT_POINT = { lat: 40.2338, lng: -111.6585 }; // Provo
const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";
const SERVICES = ["Oil change", "Brakes", "Tires", "Engine", "Transmission", "Electrical", "Alignment", "Inspection"];
const PRICES = [
  { id: "any", label: "Any price" },
  { id: "low", label: "Under $150", test: (p) => p < 150 },
  { id: "mid", label: "$150–$300", test: (p) => p >= 150 && p <= 300 },
  { id: "high", label: "$300+", test: (p) => p > 300 },
];
const RATINGS = [{ id: 0, label: "Any rating" }, { id: 4, label: "4.0+" }, { id: 4.5, label: "4.5+" }];

// Filters persist while moving around the app; location is kept in memory only.
const filters = { price: "any", rating: 0, services: new Set() };
let lastPoint = null;

export default async function render(root, ctx) {
  root.innerHTML = `
    <div class="map-screen">
      <div class="map-full" id="map" role="application" aria-label="Map of mechanic shops"></div>

      <div class="map-top">
        <a class="map-fab" href="#/home" aria-label="Back to Home">${icon("back", 22, 2.4)}</a>
        <button type="button" class="map-filter-tab" id="filter-tab" aria-expanded="false" aria-controls="filter-panel">
          ${icon("filter", 18, 2.2)}<span>Filter</span><span class="filter-count" hidden></span>
        </button>
        <button type="button" class="map-fab" id="toggle-list" aria-label="Show list">${icon("tasks", 20, 2)}</button>
      </div>

      <div class="filter-panel" id="filter-panel" hidden>
        <div class="filter-group">
          <span class="filter-label">Average repair price</span>
          <div class="chips">${PRICES.map((p) => `<button type="button" class="chip" data-price="${p.id}">${p.label}</button>`).join("")}</div>
        </div>
        <div class="filter-group">
          <span class="filter-label">Rating</span>
          <div class="chips">${RATINGS.map((r) => `<button type="button" class="chip" data-rating="${r.id}">${r.label}</button>`).join("")}</div>
        </div>
        <div class="filter-group">
          <span class="filter-label">Services</span>
          <div class="chips">${SERVICES.map((s) => `<button type="button" class="chip" data-service="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}</div>
        </div>
        <div class="filter-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="clear-filters">Clear</button>
          <button type="button" class="btn btn-sm" id="apply-filters">Show shops</button>
        </div>
      </div>

      <button type="button" class="map-fab map-locate" id="locate" aria-label="Use my location">${icon("locate", 22, 2)}</button>

      <div class="map-list" id="map-list" hidden></div>
      <p class="map-note">Sample shop data for demonstration</p>
    </div>`;

  const mapEl = root.querySelector("#map");
  const panel = root.querySelector("#filter-panel");
  const tab = root.querySelector("#filter-tab");
  const listEl = root.querySelector("#map-list");
  let shops = [];
  let map = null;
  let layer = null;
  let L = null;

  const matches = (s) => {
    const price = PRICES.find((p) => p.id === filters.price);
    if (price?.test && !(s.average_repair_price !== null && price.test(Number(s.average_repair_price)))) return false;
    if (filters.rating && !(Number(s.average_rating) >= filters.rating)) return false;
    for (const svc of filters.services) if (!s.services?.includes(svc)) return false;
    return true;
  };

  const syncFilterUi = () => {
    panel.querySelectorAll("[data-price]").forEach((b) => b.classList.toggle("on", b.dataset.price === filters.price));
    panel.querySelectorAll("[data-rating]").forEach((b) => b.classList.toggle("on", Number(b.dataset.rating) === filters.rating));
    panel.querySelectorAll("[data-service]").forEach((b) => b.classList.toggle("on", filters.services.has(b.dataset.service)));
    const active = (filters.price !== "any") + (filters.rating > 0) + filters.services.size;
    const count = tab.querySelector(".filter-count");
    count.textContent = active;
    count.hidden = !active;
    const n = shops.filter(matches).length;
    root.querySelector("#apply-filters").textContent = `Show ${n} shop${n === 1 ? "" : "s"}`;
  };

  const popupHtml = (s) => `
    <div class="shop-pop">
      <strong>${escapeHtml(s.shop_name)}</strong>
      <span class="shop-pop-price">Avg. repair ${s.average_repair_price !== null ? formatMoney(s.average_repair_price) : "n/a"}</span>
      <span class="shop-pop-meta">${stars(s.average_rating)}</span>
      <span class="shop-pop-meta">${escapeHtml(formatDistance(s.distance_miles))}</span>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.street_address}, ${s.city}, UT`)}" target="_blank" rel="noopener">Directions</a>
    </div>`;

  const drawPins = (point, { fit = false } = {}) => {
    const visible = shops.filter(matches);
    listEl.innerHTML = visible.length
      ? `<ul>${visible.map((s) => `
          <li><button type="button" data-shop="${s.id}">
            <span><strong>${escapeHtml(s.shop_name)}</strong><small>${escapeHtml(s.street_address)}, ${escapeHtml(s.city)} · ${escapeHtml(formatDistance(s.distance_miles))}</small></span>
            <span class="map-list-price">${s.average_repair_price !== null ? formatMoney(s.average_repair_price) : ""}</span>
          </button></li>`).join("")}</ul>`
      : `<p class="muted-box">No shops match these filters.</p>`;
    if (!map) return;
    layer?.remove();
    layer = L.layerGroup().addTo(map);
    L.circleMarker([point.lat, point.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#1f6feb", fillOpacity: 1 })
      .bindTooltip("You are here").addTo(layer);
    const markers = new Map();
    for (const s of visible) {
      const price = s.average_repair_price !== null ? `$${Math.round(Number(s.average_repair_price))}` : "—";
      const marker = L.marker([Number(s.latitude), Number(s.longitude)], {
        icon: L.divIcon({ className: "price-pin", html: `<span>${price}</span>`, iconSize: null, iconAnchor: [0, 0] }),
        keyboard: true,
        title: s.shop_name,
      }).bindPopup(popupHtml(s), { closeButton: true, offset: [0, -30] }).addTo(layer);
      markers.set(s.id, marker);
    }
    listEl.querySelectorAll("[data-shop]").forEach((b) => b.addEventListener("click", () => {
      const m = markers.get(Number(b.dataset.shop));
      listEl.hidden = true;
      map.setView(m.getLatLng(), Math.max(map.getZoom(), 13));
      m.openPopup();
    }));
    if (fit) {
      const pts = [[point.lat, point.lng], ...visible.slice(0, 8).map((s) => [Number(s.latitude), Number(s.longitude)])];
      map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 });
    }
  };

  const show = async (point) => {
    lastPoint = point;
    shops = await nearbyShops(point.lat, point.lng, 100);
    if (!ctx.isCurrent()) return;
    syncFilterUi();
    drawPins(point, { fit: true });
  };

  // Filter tab
  tab.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    tab.setAttribute("aria-expanded", String(!panel.hidden));
    listEl.hidden = true;
  });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.price) filters.price = b.dataset.price;
    else if (b.dataset.rating !== undefined) filters.rating = Number(b.dataset.rating);
    else if (b.dataset.service) {
      filters.services.has(b.dataset.service) ? filters.services.delete(b.dataset.service) : filters.services.add(b.dataset.service);
    } else if (b.id === "clear-filters") {
      filters.price = "any"; filters.rating = 0; filters.services.clear();
    } else if (b.id === "apply-filters") {
      panel.hidden = true;
      tab.setAttribute("aria-expanded", "false");
    }
    syncFilterUi();
    drawPins(lastPoint ?? DEFAULT_POINT);
  });

  root.querySelector("#toggle-list").addEventListener("click", () => {
    listEl.hidden = !listEl.hidden;
    panel.hidden = true;
  });

  root.querySelector("#locate").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("Your browser can't share its location.", "error");
    navigator.geolocation.getCurrentPosition(
      (pos) => show({ lat: pos.coords.latitude, lng: pos.coords.longitude }).catch((err) => toast(errorMessage(err), "error")),
      () => toast("Location permission was denied. Showing shops near Provo.", "error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });

  try {
    L = await loadLeaflet();
    if (!ctx.isCurrent()) return;
    map = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView([DEFAULT_POINT.lat, DEFAULT_POINT.lng], 12);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
  } catch {
    mapEl.innerHTML = `<div class="map-error">${icon("alert", 28, 2)}<p>The map couldn't load. Check your connection.</p><button type="button" class="btn btn-sm" id="map-retry">Try again</button></div>`;
    mapEl.querySelector("#map-retry").addEventListener("click", () => ctx.navigate(location.hash));
    listEl.hidden = false;
  }

  await show(lastPoint ?? DEFAULT_POINT);
  return () => map?.remove();
}

let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  leafletPromise ??= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${LEAFLET}/leaflet.css`;
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = `${LEAFLET}/leaflet.js`;
    js.onload = () => resolve(window.L);
    js.onerror = () => { leafletPromise = null; js.remove(); reject(new Error("Map failed to load")); };
    document.head.appendChild(js);
  });
  return leafletPromise;
}
