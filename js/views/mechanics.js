// Map (Find Mechanic): full-screen map with a pin per shop. Tapping a pin shows the shop
// name and its average repair price. The filter tab at the top narrows the pins.
// A live blue dot tracks the user's location and the map follows it until they pan.
// Problem mode (#/mechanics?problem=<light slug>&vehicle=<id>, from the dashboard scanner
// or a light's guide): a banner names the problem, and a results panel ranks the shops
// most likely to fix it with a per-shop price estimate for the user's car (js/repairs.js).
import { nearbyShops, listWarningLights, listVehicles, getProfile, hasNewColumns } from "../data.js";
import { escapeHtml, icon, stars, formatMoney, formatDistance, errorMessage, toast } from "../ui.js";
import {
  hasRepair, capability, estimate, rankShops, median, rangeText, money, midpoint, estimateWhy, problemSeverity,
} from "../repairs.js";

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
const SEVERITY = {
  stop: { label: "Stop now", text: "Don't drive far. Call the shop first and ask about towing." },
  soon: { label: "Check soon", text: "" },
  info: { label: "Good to know", text: "" },
};

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
          <label class="filter-label" for="filter-problem">Fix a warning light</label>
          <select class="filter-select" id="filter-problem"><option value="">Any problem</option></select>
        </div>
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
      <section class="problem-results" id="problem-results" hidden aria-label="Shops for this problem"></section>
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
  const resultsEl = root.querySelector("#problem-results");
  const screenEl = root.querySelector(".map-screen");
  let problems = [];        // warning lights, for the Change list and the filter
  let problem = null;       // the light being fixed, or null for the normal map
  let vehicles = [];
  let vehicle = null;       // car the estimates are for (brand changes cost and severity)
  let medianPrice = null;   // median average repair price of the shops nearby
  let showAllShops = false; // results also list shops that can't do this repair
  let resultsOpen = true;   // results panel expanded (collapsing shows more map)
  let ranked = [];          // rankShops() output for the shops in view

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
    const fp = panel.querySelector("#filter-problem");
    if (fp && problems.length) {
      fp.innerHTML = `<option value="">Any problem</option>${problemOptions(problem?.slug)}`;
    }
    const n = shops.filter(matches).length;
    root.querySelector("#apply-filters").textContent = `Show ${n} shop${n === 1 ? "" : "s"}`;
  };

  // ---- Problem mode -----------------------------------------------------------
  const findProblem = (slug) => (slug ? problems.find((p) => p.slug === slug) ?? null : null);
  const problemMode = () => hasRepair(problem);
  const est = (s) => (problemMode() ? estimate(s, problem, { areaMedian: medianPrice, vehicle }) : null);
  const carName = (v) => [v.model_year, v.brand, v.make || v.model].filter(Boolean).join(" ");

  // Grouped by urgency for this car, only lights a shop can actually fix.
  const problemOptions = (selected) => {
    const fixable = problems.filter((p) => hasRepair(p) || p.slug === selected);
    const groups = [["stop", "Stop now"], ["soon", "Check soon"], ["info", "Other"]];
    return groups.map(([sev, label]) => {
      const items = fixable.filter((p) => problemSeverity(p, vehicle) === sev);
      return items.length
        ? `<optgroup label="${label}">${items.map((p) => `<option value="${escapeHtml(p.slug)}" ${p.slug === selected ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}</optgroup>`
        : "";
    }).join("");
  };

  const drawBanner = () => {
    screenEl.classList.toggle("problem-on", Boolean(problem));
    if (!problem) {
      bannerEl.hidden = true;
      bannerEl.innerHTML = "";
      return;
    }
    const sev = problemSeverity(problem, vehicle);
    bannerEl.hidden = false;
    bannerEl.innerHTML = `
      <label class="problem-pick">
        <span class="problem-label">Problem <span class="problem-hint">· tap to change</span></span>
        <select id="problem-select" aria-label="Problem. Choose a different one to see other shops">
          <option value="">No specific problem</option>
          ${problemOptions(problem.slug)}
        </select>
      </label>
      <div class="problem-sub">
        <span class="sev-pill sev-${sev}">${SEVERITY[sev].label}</span>
        ${problem.repair_service ? `<span class="problem-type">${escapeHtml(problem.repair_service)} repair</span>` : ""}
        ${vehicles.length > 1 ? `
          <label class="problem-car"><span>for</span>
            <select id="problem-vehicle" aria-label="Car to estimate for">
              ${vehicles.map((v) => `<option value="${v.id}" ${v.id === vehicle?.id ? "selected" : ""}>${escapeHtml(v.label || carName(v))}</option>`).join("")}
            </select>
          </label>` : vehicle ? `<span>for your ${escapeHtml(carName(vehicle))}</span>` : ""}
      </div>
      ${SEVERITY[sev].text ? `<p class="problem-alert">${icon("alert", 16, 2.2)}<span>${SEVERITY[sev].text}</span></p>` : ""}
      ${!hasRepair(problem) ? `<p class="problem-alert info">${icon("alert", 16, 2.2)}<span>${hasNewColumns("warning_lights")
        ? "This light usually doesn't need a shop. Pick a different problem to compare shops."
        : "Shop matching and price estimates aren't set up yet (the database needs an update). All nearby shops are shown."}</span></p>` : ""}`;
  };

  const syncUrl = () => {
    const q = new URLSearchParams();
    if (problem) q.set("problem", problem.slug);
    if (problem && vehicle) q.set("vehicle", vehicle.id);
    // Replace the entry (not push) so Back doesn't step through every problem tried.
    const qs = q.toString();
    history.replaceState(null, "", `#/mechanics${qs ? `?${qs}` : ""}`);
  };

  const setProblem = (slug, { fit = true } = {}) => {
    problem = findProblem(slug);
    showAllShops = false;
    resultsOpen = true;
    syncUrl();
    drawBanner();
    syncFilterUi();
    drawPins(lastPoint ?? DEFAULT_POINT, { fit: fit && problemMode() });
  };
  bannerEl.addEventListener("change", (e) => {
    if (e.target.id === "problem-select") setProblem(e.target.value || null);
    if (e.target.id === "problem-vehicle") {
      vehicle = vehicles.find((v) => v.id === Number(e.target.value)) ?? vehicle;
      syncUrl();
      drawBanner();
      drawPins(lastPoint ?? DEFAULT_POINT);
    }
  });
  panel.querySelector("#filter-problem").addEventListener("change", (e) => {
    setProblem(e.target.value || null);
    panel.hidden = true;
    tab.setAttribute("aria-expanded", "false");
  });

  const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;
  const directionsHref = (s) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.street_address}, ${s.city}`)}`;
  // "Add to my tasks" carries the repair, the car, the shop and the estimate into a new task.
  const taskHref = (s, e) => {
    const q = new URLSearchParams({ name: `${problem.name} repair`.slice(0, 80), from: "mechanics", shop: s.id });
    if (vehicle) q.set("vehicle", vehicle.id);
    if (e) {
      q.set("cost", midpoint(e));
      q.set("notes", `${s.shop_name}: estimate ${rangeText(e)}${e.diag ? ` + diagnosis ${rangeText(e.diag)}` : ""}. ${s.phone ?? ""}`.trim());
    }
    return `#/tasks/new?${q}`;
  };

  const popupHtml = (s) => {
    const e = est(s);
    const cap = problemMode() ? capability(s, problem) : null;
    return `
    <div class="shop-pop">
      <strong>${escapeHtml(s.shop_name)}</strong>
      ${problemMode() ? (cap
        ? `<span class="fix-badge ${cap}">${cap === "primary" ? "Can fix this" : "Can often handle this"}</span>`
        : `<span class="shop-pop-meta">Doesn't list ${escapeHtml(problem.repair_service.toLowerCase())} work</span>`) : ""}
      ${e ? `<span class="shop-pop-price">Est. ${rangeText(e)}</span>${e.diag ? `<span class="shop-pop-meta">+ diagnosis ${rangeText(e.diag)}</span>` : ""}` : ""}
      ${!problemMode() ? `<span class="shop-pop-price">Avg. repair ${s.average_repair_price !== null ? formatMoney(s.average_repair_price) : "n/a"}</span>` : ""}
      <span class="shop-pop-meta">${stars(s.average_rating)}</span>
      <span class="shop-pop-meta">${escapeHtml(formatDistance(s.distance_miles))}</span>
      <span class="shop-pop-links">
        ${s.phone ? `<a href="${telHref(s.phone)}">Call</a>` : ""}
        <a href="${directionsHref(s)}" target="_blank" rel="noopener">Directions</a>
      </span>
    </div>`;
  };

  // Results panel: the shops most likely to fix the problem, best first.
  const drawResults = () => {
    if (!problemMode()) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      return;
    }
    const capable = ranked.filter((r) => r.cap);
    const others = ranked.filter((r) => !r.cap);
    const rows = showAllShops ? ranked : capable;
    const lows = capable.map((r) => est(r.shop)?.low).filter((n) => n != null);
    const summary = capable.length
      ? `${capable.length} shop${capable.length === 1 ? "" : "s"} can fix this${lows.length ? ` · from ${money(Math.min(...lows))}` : ""}`
      : "No nearby shops list this repair";
    resultsEl.hidden = false;
    resultsEl.classList.toggle("collapsed", !resultsOpen);
    resultsEl.innerHTML = `
      <button type="button" class="results-head" data-collapse aria-expanded="${resultsOpen}">
        <span class="results-grip" aria-hidden="true"></span>
        <strong>${escapeHtml(summary)}</strong>
        <span class="results-toggle">${resultsOpen ? "Hide" : "Show"}</span>
      </button>
      <div class="results-body">
        ${problem.repair_note ? `<p class="results-note"><strong>What usually fixes it:</strong> ${escapeHtml(problem.repair_note)}</p>` : ""}
        ${rows.length ? `<ol class="shop-results">${rows.map((r) => shopCard(r)).join("")}</ol>` : `
          <p class="muted-box">${shops.length ? "No shops match your filters. Clear the filters to see more." : "No shops found near you."}</p>`}
        ${others.length ? `<button type="button" class="btn btn-ghost btn-sm results-more" data-show-all>${showAllShops ? "Only shops that can fix this" : `Show ${others.length} other shop${others.length === 1 ? "" : "s"}`}</button>` : ""}
        <p class="hint small">Estimates are typical US prices for the usual fix, adjusted for each shop's prices${vehicle ? " and your car" : ""}. Call the shop for an exact quote.</p>
      </div>`;
  };

  const shopCard = ({ shop: s, cap, best, reasons }) => {
    const e = est(s);
    return `
      <li class="shop-result ${cap ? "" : "cant"}" data-shop-id="${s.id}">
        <div class="shop-result-top">
          <button type="button" class="shop-result-name" data-focus="${s.id}">
            <strong>${escapeHtml(s.shop_name)}</strong>
            ${best ? `<em class="best-badge">Best match</em>` : ""}
          </button>
          ${e ? `<span class="shop-result-price">${rangeText(e)}</span>` : ""}
        </div>
        <span class="shop-result-meta">${stars(s.average_rating)} <span>· ${escapeHtml(formatDistance(s.distance_miles))}</span></span>
        ${reasons.length ? `<span class="reason-chips">${reasons.map((x, i) => `<span class="reason ${i === 0 ? "lead" : ""}">${escapeHtml(x)}</span>`).join("")}</span>` : ""}
        ${!cap ? `<span class="shop-result-why">Doesn't list ${escapeHtml(problem.repair_service.toLowerCase())} work</span>` : ""}
        ${e ? `<span class="shop-result-why">${e.diag ? `Plus diagnosis ${rangeText(e.diag)}, often credited toward the repair. ` : ""}${escapeHtml(estimateWhy(e, vehicle))}.</span>` : ""}
        <span class="shop-actions">
          ${s.phone ? `<a class="btn btn-sm" href="${telHref(s.phone)}">${icon("phone", 15, 2)}Call</a>` : ""}
          <a class="btn btn-sm btn-soft" href="${directionsHref(s)}" target="_blank" rel="noopener">${icon("directions", 15, 2)}Directions</a>
          ${cap ? `<a class="btn btn-sm btn-ghost" href="${escapeHtml(taskHref(s, e))}">${icon("plus", 15, 2.4)}Add to tasks</a>` : ""}
        </span>
      </li>`;
  };

  resultsEl.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-collapse]")) {
      resultsOpen = !resultsOpen;
      return drawResults();
    }
    if (ev.target.closest("[data-show-all]")) {
      showAllShops = !showAllShops;
      return drawResults();
    }
    const focus = ev.target.closest("[data-focus]");
    if (focus) focusShop(Number(focus.dataset.focus));
  });

  let markers = new Map();
  const focusShop = (id) => {
    const m = markers.get(id);
    if (!m || !map) return;
    if (window.matchMedia("(max-width: 699px)").matches) {
      resultsOpen = false;
      drawResults();
    }
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 14));
    m.openPopup();
  };

  const drawPins = (point, { fit = false } = {}) => {
    const visible = shops.filter(matches);
    ranked = problemMode() ? rankShops(visible, problem, { areaMedian: medianPrice, vehicle }) : [];
    const canFix = (s) => problemMode() && Boolean(capability(s, problem));
    drawResults();
    // The plain list (normal mode only; problem mode has the results panel).
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
    markers = new Map();
    const bestId = ranked.find((r) => r.best)?.shop.id;
    for (const s of visible) {
      const e = est(s);
      const dim = problemMode() && !canFix(s);
      // In problem mode a shop that can't do the repair shows no price: its average would read like an estimate.
      const price = e ? rangeText(e) : dim ? "—" : (s.average_repair_price !== null ? `$${Math.round(Number(s.average_repair_price))}` : "—");
      const cls = ["price-pin", dim && "dim", problemMode() && !dim && "fix", s.id === bestId && "best"].filter(Boolean).join(" ");
      const marker = L.marker([Number(s.latitude), Number(s.longitude)], {
        icon: L.divIcon({ className: cls, html: `<span>${s.id === bestId ? "★ " : ""}${price}</span>`, iconSize: null, iconAnchor: [0, 0] }),
        keyboard: true,
        title: s.shop_name,
        zIndexOffset: s.id === bestId ? 500 : dim ? -100 : 0,
      }).bindPopup(popupHtml(s), { closeButton: true, offset: [0, -30] }).addTo(layer);
      markers.set(s.id, marker);
    }
    listEl.querySelectorAll("[data-shop]").forEach((b) => b.addEventListener("click", () => {
      listEl.hidden = true;
      focusShop(Number(b.dataset.shop));
    }));
    if (fit) {
      // Problem mode frames the best few shops for the job; otherwise the nearest ones.
      const focusOn = problemMode() ? ranked.filter((r) => r.cap).slice(0, 3).map((r) => r.shop) : visible.slice(0, 8);
      const pts = [[point.lat, point.lng], ...focusOn.map((s) => [Number(s.latitude), Number(s.longitude)])];
      const pad = problemMode() && window.matchMedia("(max-width: 699px)").matches
        ? { paddingTopLeft: [40, 190], paddingBottomRight: [40, 60 + resultsEl.offsetHeight] }
        : problemMode() ? { paddingTopLeft: [50, 210], paddingBottomRight: [430, 50] } : { padding: [50, 50] };
      map.fitBounds(pts, { ...pad, maxZoom: 14 });
    }
  };

  const show = async (point, { fit = true } = {}) => {
    const seq = ++fetchSeq;
    lastPoint = point;
    lastFetchPoint = point;
    const found = await nearbyShops(point.lat, point.lng, 100);
    if (!ctx.isCurrent() || seq !== fetchSeq) return;
    shops = found;
    medianPrice = median(shops.map((s) => s.average_repair_price));
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
      if (map && following && problemMode()) {
        // Frame the best shops for the job (and you), then keep following.
        drawPins({ lat: me.lat, lng: me.lng }, { fit: true });
      } else if (map && following) {
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
    panel.hidden = true;
    tab.setAttribute("aria-expanded", "false");
    if (problemMode()) {
      resultsOpen = !resultsOpen;
      return drawResults();
    }
    listEl.hidden = !listEl.hidden;
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

  // Problem mode needs the light catalog (cached after the first load) and the user's cars.
  // A failed load just means the normal map.
  const [lights, cars, profile] = await Promise.all([
    listWarningLights().catch(() => []),
    listVehicles().catch(() => []),
    getProfile().catch(() => null),
  ]);
  if (!ctx.isCurrent()) return;
  problems = lights;
  vehicles = cars;
  const wanted = Number(ctx.query.get("vehicle"));
  vehicle = vehicles.find((v) => v.id === wanted)
    ?? vehicles.find((v) => v.id === profile?.active_vehicle_id)
    ?? vehicles[0] ?? null;
  problem = findProblem(ctx.query.get("problem"));
  if (ctx.query.get("problem") && !problem) toast("We couldn't find that problem, so here are all shops.", "info");
  drawBanner();
  syncFilterUi();

  startTracking();
  if (!me) await show(lastPoint ?? DEFAULT_POINT);
  return () => {
    stopTracking();
    resizeObserver?.disconnect();
    map?.remove();
  };
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
