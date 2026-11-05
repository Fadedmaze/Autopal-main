// Map (Find Mechanic): full-screen map with a pin per shop. Tapping a pin shows the shop
// name and its average repair price. The filter tab at the top narrows the pins.
// A live blue dot tracks the user's location and the map follows it until they pan.
import { nearbyShops, listWarningLights } from "../data.js";
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
const REFETCH_MILES = 0.5; // refresh shop distances after moving this far
const FOLLOW_ZOOM = 14;
const PRICE_FACTOR = [0.75, 1.35]; // a shop's price level scales a problem's typical repair range within this band

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

      <div class="problem-banner" id="problem-banner" hidden></div>

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

      <button type="button" class="map-fab map-locate" id="locate" aria-label="Follow my location" aria-pressed="false">${icon("locate", 22, 2)}</button>

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

  // Live location state
  const locateBtn = root.querySelector("#locate");
  let watchId = null;
  let me = null;          // latest { lat, lng, accuracy } from the GPS
  let meLayer = null;     // blue dot + accuracy circle
  let following = false;  // map recenters on each update until the user pans
  let deniedNotice = false;
  let lastFetchPoint = null;
  let fetchSeq = 0;       // only the newest shop lookup may redraw the map
  let resizeObserver = null;
  // Problem mode (?problem=<slug> from a warning light). See "Problem mode" below.
  const bannerEl = root.querySelector("#problem-banner");
  let problems = [];        // all warning lights, for the banner's Change list
  let problem = null;       // the identified light, or null for the normal map
  let medianPrice = null;   // median average repair price of the shops in view
  let showAllShops = false; // list shows shops that can't do this repair too

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

  // ---- Problem mode -----------------------------------------------------------
  const findProblem = (slug) => (slug ? problems.find((p) => p.slug === slug) ?? null : null);
  const problemMode = () => Boolean(problem?.repair_service);
  const fixes = (s) => problemMode() && Boolean(s.services?.includes(problem.repair_service));
  // Typical US repair range for the problem, scaled by the shop's price level (its average
  // vs the median of the shops in view), clamped, and rounded to the nearest $5.
  const estimateFor = (s) => {
    if (!fixes(s) || problem.repair_cost_low == null || problem.repair_cost_high == null) return null;
    const avg = Number(s.average_repair_price);
    const factor = medianPrice && avg > 0
      ? Math.min(PRICE_FACTOR[1], Math.max(PRICE_FACTOR[0], avg / medianPrice))
      : 1;
    return {
      low: roundTo5(Number(problem.repair_cost_low) * factor),
      high: roundTo5(Number(problem.repair_cost_high) * factor),
    };
  };

  const drawBanner = () => {
    if (!problem) {
      bannerEl.hidden = true;
      bannerEl.innerHTML = "";
      return;
    }
    // The current problem stays selectable even if it has no repair service.
    const choices = problems.filter((p) => p.repair_service || p.slug === problem.slug);
    bannerEl.hidden = false;
    bannerEl.innerHTML = `
      <div class="problem-text">
        <span class="problem-line"><span class="problem-label">Problem:</span> <strong>${escapeHtml(problem.name)}</strong>${problem.repair_service ? ` · ${escapeHtml(problem.repair_service)}` : ""}</span>
      </div>
      <label class="problem-change"><span>Change</span>
        <select id="problem-select">
          <option value="">No specific problem</option>
          ${choices.map((p) => `<option value="${escapeHtml(p.slug)}" ${p.slug === problem.slug ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
        </select>
      </label>`;
  };

  const setProblem = (slug) => {
    problem = findProblem(slug);
    showAllShops = false;
    // Replace the entry (not push) so Back doesn't step through every problem tried.
    history.replaceState(null, "", problem ? `#/mechanics?problem=${encodeURIComponent(problem.slug)}` : "#/mechanics");
    drawBanner();
    drawPins(lastPoint ?? DEFAULT_POINT);
  };
  bannerEl.addEventListener("change", (e) => {
    if (e.target.id === "problem-select") setProblem(e.target.value || null);
  });

  const popupHtml = (s) => {
    const est = estimateFor(s);
    return `
    <div class="shop-pop">
      <strong>${escapeHtml(s.shop_name)}</strong>
      ${est ? `<span class="shop-pop-price">Est. for ${escapeHtml(problem.repair_service)}: ${estText(est)}</span>` : ""}
      <span class="shop-pop-price">Avg. repair ${s.average_repair_price !== null ? formatMoney(s.average_repair_price) : "n/a"}</span>
      <span class="shop-pop-meta">${stars(s.average_rating)}</span>
      <span class="shop-pop-meta">${escapeHtml(formatDistance(s.distance_miles))}</span>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.street_address}, ${s.city}, UT`)}" target="_blank" rel="noopener">Directions</a>
    </div>`;
  };

  const drawPins = (point, { fit = false } = {}) => {
    const visible = shops.filter(matches);
    // Problem mode: shops that can do the repair come first, nearest first. The rest stay
    // on the map (dimmed) and are listed only after "Show all shops".
    const ranked = problemMode()
      ? [...visible].sort((a, b) => (fixes(b) - fixes(a)) || (a.distance_miles - b.distance_miles))
      : visible;
    const listed = problemMode() && !showAllShops ? ranked.filter(fixes) : ranked;
    const others = ranked.filter((s) => !fixes(s)).length;
    const toggle = problemMode() && others
      ? `<button type="button" class="btn btn-ghost btn-sm map-list-toggle" data-show-all>${showAllShops ? "Only shops that can fix this" : `Show all shops (${others} more)`}</button>`
      : "";
    listEl.innerHTML = `${toggle}${listed.length
      ? `<ul>${listed.map((s) => {
          const est = estimateFor(s);
          return `
          <li><button type="button" data-shop="${s.id}">
            <span><strong>${escapeHtml(s.shop_name)}${fixes(s) ? ` <em class="fix-badge">Can fix this</em>` : ""}</strong><small>${escapeHtml(s.street_address)}, ${escapeHtml(s.city)} · ${escapeHtml(formatDistance(s.distance_miles))}</small></span>
            <span class="map-list-price">${est ? estText(est) : (s.average_repair_price !== null ? formatMoney(s.average_repair_price) : "")}</span>
          </button></li>`;
        }).join("")}</ul>`
      : `<p class="muted-box">No shops match these filters.</p>`}`;
    listEl.querySelector("[data-show-all]")?.addEventListener("click", () => {
      showAllShops = !showAllShops;
      drawPins(point);
    });
    if (!map) return;
    layer?.remove();
    layer = L.layerGroup().addTo(map);
    const markers = new Map();
    for (const s of visible) {
      const est = estimateFor(s);
      const price = est ? estText(est) : (s.average_repair_price !== null ? `$${Math.round(Number(s.average_repair_price))}` : "—");
      const dim = problemMode() && !fixes(s);
      const marker = L.marker([Number(s.latitude), Number(s.longitude)], {
        icon: L.divIcon({
          className: `price-pin${dim ? " dim" : ""}${problemMode() && !dim ? " fix" : ""}`,
          html: `<span>${price}</span>`, iconSize: null, iconAnchor: [0, 0],
        }),
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

  const show = async (point, { fit = true } = {}) => {
    const seq = ++fetchSeq;
    lastPoint = point;
    lastFetchPoint = point;
    const found = await nearbyShops(point.lat, point.lng, 100);
    if (!ctx.isCurrent() || seq !== fetchSeq) return;
    shops = found;
    medianPrice = medianOf(shops.map((s) => Number(s.average_repair_price)));
    syncFilterUi();
    drawPins(point, { fit });
  };

  const setFollowing = (on) => {
    following = on;
    locateBtn.classList.toggle("following", on);
    locateBtn.setAttribute("aria-pressed", String(on));
    locateBtn.setAttribute("aria-label", on ? "Following your location" : "Follow my location");
  };

  // Draw or move the blue dot and its accuracy circle.
  const drawMe = () => {
    if (!map || !me) return;
    const ll = [me.lat, me.lng];
    const radius = Math.min(me.accuracy || 0, 1500);
    if (!meLayer) {
      meLayer = {
        circle: L.circle(ll, { radius, color: "#1f6feb", weight: 1, opacity: 0.35, fillColor: "#1f6feb", fillOpacity: 0.12, interactive: false }).addTo(map),
        dot: L.marker(ll, {
          icon: L.divIcon({ className: "you-dot", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] }),
          keyboard: false, zIndexOffset: 1000, title: "You are here",
        }).addTo(map),
      };
    } else {
      meLayer.circle.setLatLng(ll).setRadius(radius);
      meLayer.dot.setLatLng(ll);
    }
  };

  const onPosition = async (pos) => {
    if (!ctx.isCurrent()) return;
    const first = !me;
    me = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    drawMe();
    if (first) {
      // First fix: center on the user, load shops around them, then zoom so the
      // nearest few shops are in view while the user stays in the middle.
      setFollowing(true);
      // Instant (not animated): Leaflet ignores a new zoom while a zoom animation runs.
      map?.setView([me.lat, me.lng], FOLLOW_ZOOM, { animate: false });
      await show({ lat: me.lat, lng: me.lng }, { fit: false }).catch((err) => toast(errorMessage(err), "error"));
      if (map && following) {
        const near = shops.filter(matches).slice(0, 3);
        if (near.length) {
          // Mirror each shop around the user so the bounds stay centered on them.
          const pts = near.flatMap((s) => {
            const lat = Number(s.latitude), lng = Number(s.longitude);
            return [[lat, lng], [2 * me.lat - lat, 2 * me.lng - lng]];
          });
          const zoom = map.getBoundsZoom(L.latLngBounds(pts), false, L.point(60, 120));
          map.setView([me.lat, me.lng], Math.max(10, Math.min(zoom, 15)), { animate: false });
        }
      }
      return;
    }
    if (following) map?.panTo([me.lat, me.lng], { animate: true });
    // Refresh distances once they've moved a meaningful amount, unless a popup is open.
    const moved = lastFetchPoint ? milesBetween(lastFetchPoint, me) : Infinity;
    if (moved >= REFETCH_MILES && !root.querySelector(".leaflet-popup")) {
      await show({ lat: me.lat, lng: me.lng }, { fit: false }).catch(() => {});
    }
  };

  const onPositionError = (err) => {
    if (!ctx.isCurrent()) return;
    setFollowing(false);
    stopTracking();
    if (deniedNotice) return;
    deniedNotice = true;
    toast(err?.code === 1
      ? "Location is off, so we're showing shops near Provo. Tap the target button to try again."
      : "We couldn't find your location. Showing shops near Provo.", "error");
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      toast("Your browser can't share its location.", "error");
      return;
    }
    if (watchId !== null) return;
    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 5000,
    });
  };

  const stopTracking = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
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

  // Target button: re-center and follow again (and start tracking if it isn't running).
  locateBtn.addEventListener("click", () => {
    deniedNotice = false;
    startTracking();
    if (me) {
      setFollowing(true);
      map?.setView([me.lat, me.lng], Math.max(map.getZoom(), FOLLOW_ZOOM), { animate: true });
    }
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
    // Panning by hand stops following; the target button turns it back on.
    map.on("dragstart", () => setFollowing(false));
    // The map can be created before the screen finishes laying out; re-measure on any
    // size change so "center" (and following) means the visible center.
    resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      if (following && me) map.setView([me.lat, me.lng], map.getZoom(), { animate: false });
    });
    resizeObserver.observe(mapEl);
  } catch {
    mapEl.innerHTML = `<div class="map-error">${icon("alert", 28, 2)}<p>The map couldn't load. Check your connection.</p><button type="button" class="btn btn-sm" id="map-retry">Try again</button></div>`;
    mapEl.querySelector("#map-retry").addEventListener("click", () => ctx.navigate(location.hash));
    listEl.hidden = false;
  }

  // Problem mode: the light catalog is cached after the first load; a failed load just means no banner.
  problems = await listWarningLights().catch(() => []);
  problem = findProblem(ctx.query.get("problem"));
  drawBanner();

  startTracking();
  if (!me) await show(lastPoint ?? DEFAULT_POINT);
  return () => {
    stopTracking();
    resizeObserver?.disconnect();
    map?.remove();
  };
}

function estText(e) {
  return `$${e.low}–$${e.high}`;
}

function roundTo5(n) {
  return Math.round(n / 5) * 5;
}

function medianOf(values) {
  const v = values.filter((n) => n > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Great-circle distance in miles.
function milesBetween(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
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
