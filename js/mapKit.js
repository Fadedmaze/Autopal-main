// One small map interface for Find a Mechanic, drawn with Google Maps (when a Google
// key is set in js/config.js) or with Leaflet + OpenStreetMap (the original map).
// Google's terms require shops from Google Places to be shown on a Google map.
//
//   const map = await createMap(el, { center: { lat, lng }, zoom });
//   map.setView(point, zoom, { animate }) · map.getZoom() · map.panTo(point)
//   map.fitPoints(points, { top, right, bottom, left }, maxZoom, minZoom)
//   map.addPin(point, { html, className, title, z, popup: () => html, onOpen, onClose }) -> pin
//   pin.openPopup() · pin.point
//   map.clearPins() · map.setMe({ lat, lng, accuracy }) · map.popupOpen() · map.closePopup()
//   map.onUserMove(fn) (dragged by hand) · map.onIdle(fn) (finished moving) · map.center()
//   map.invalidate() · map.remove() · map.kind ("google" | "leaflet")

import { GOOGLE_MAPS_KEY } from "./config.js";

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";

export const usesGoogle = () => Boolean(GOOGLE_MAPS_KEY);

export async function createMap(el, opts) {
  return usesGoogle() ? googleMap(el, opts) : leafletMap(el, opts);
}

// ---- Google Maps ---------------------------------------------------------------------
let googlePromise = null;
function loadGoogle() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  googlePromise ??= new Promise((resolve, reject) => {
    const cb = `__autopalMaps${Date.now()}`;
    window[cb] = () => { delete window[cb]; resolve(window.google.maps); };
    const js = document.createElement("script");
    js.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&loading=async&callback=${cb}`;
    js.async = true;
    js.onerror = () => { googlePromise = null; js.remove(); reject(new Error("Map failed to load")); };
    document.head.appendChild(js);
  });
  return googlePromise;
}

async function googleMap(el, { center, zoom }) {
  const g = await loadGoogle();
  const { Map, InfoWindow, OverlayView } = await g.importLibrary("maps");
  const { LatLngBounds } = await g.importLibrary("core");
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const map = new Map(el, {
    center, zoom,
    disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: "greedy",
    zoomControlOptions: { position: g.ControlPosition.RIGHT_BOTTOM },
    colorScheme: dark ? "DARK" : "LIGHT",
  });
  const info = new InfoWindow({ pixelOffset: new g.Size(0, -34) });
  let openPin = null;
  info.addListener("closeclick", () => { openPin?.onClose?.(); openPin = null; });
  // Like the Leaflet map: tapping the map or pressing Escape closes the shop popup.
  const closeOpen = () => { if (openPin) { info.close(); openPin.onClose?.(); openPin = null; } };
  map.addListener("click", closeOpen);
  const onKey = (e) => { if (e.key === "Escape") closeOpen(); };
  document.addEventListener("keydown", onKey);

  // An HTML marker (same look as the Leaflet pins), kept in the clickable pane.
  class HtmlPin extends OverlayView {
    constructor(point, { html, className, title, z = 0 }) {
      super();
      this.point = point;
      this.div = document.createElement("div");
      this.div.className = className;
      this.div.innerHTML = html;
      this.div.style.position = "absolute";
      this.div.style.zIndex = String(1000 + z);
      if (title) { this.div.title = title; this.div.setAttribute("aria-label", title); }
    }
    onAdd() {
      this.getPanes().overlayMouseTarget.appendChild(this.div);
      OverlayView.preventMapHitsAndGesturesFrom(this.div);
    }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(this.point);
      if (!p) return;
      this.div.style.left = `${p.x}px`;
      this.div.style.top = `${p.y}px`;
    }
    onRemove() { this.div.remove(); }
  }

  let pins = [];
  let me = null;
  const api = {
    kind: "google",
    setView: (p, z, { animate = true } = {}) => {
      if (z != null) map.setZoom(z);
      animate ? map.panTo(p) : map.setCenter(p);
    },
    getZoom: () => map.getZoom(),
    panTo: (p) => map.panTo(p),
    center: () => { const c = map.getCenter(); return { lat: c.lat(), lng: c.lng() }; },
    fitPoints: (points, pad = {}, maxZoom = 15, minZoom = 3) => {
      if (!points.length) return;
      const b = new LatLngBounds();
      points.forEach((p) => b.extend(p));
      map.fitBounds(b, { top: pad.top ?? 50, right: pad.right ?? 50, bottom: pad.bottom ?? 50, left: pad.left ?? 50 });
      g.event.addListenerOnce(map, "idle", () => {
        const z = map.getZoom();
        if (z > maxZoom) map.setZoom(maxZoom);
        else if (z < minZoom) map.setZoom(minZoom);
      });
    },
    addPin: (point, o) => {
      const pin = new HtmlPin(point, o);
      pin.onClose = o.onClose;
      pin.openPopup = () => {
        openPin?.onClose?.();
        info.setContent(o.popup());
        info.setPosition(point);
        info.open({ map, shouldFocus: false });
        openPin = pin;
        o.onOpen?.();
      };
      const open = (e) => { e.stopPropagation(); pin.openPopup(); };
      pin.div.tabIndex = 0;
      pin.div.setAttribute("role", "button");
      pin.div.addEventListener("click", open);
      pin.div.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); } });
      pin.setMap(map);
      pins.push(pin);
      return pin;
    },
    clearPins: () => {
      if (openPin) { info.close(); openPin.onClose?.(); openPin = null; }
      pins.forEach((p) => p.setMap(null));
      pins = [];
    },
    popupOpen: () => Boolean(openPin),
    closePopup: closeOpen,
    setMe: ({ lat, lng, accuracy }) => {
      const p = { lat, lng };
      const radius = Math.min(accuracy || 0, 1500);
      if (!me) {
        me = {
          circle: new g.Circle({ map, center: p, radius, strokeColor: "#1f6feb", strokeOpacity: 0.35, strokeWeight: 1, fillColor: "#1f6feb", fillOpacity: 0.12, clickable: false }),
          dot: new HtmlPin(p, { html: "<span></span>", className: "you-dot gm-you-dot", title: "You are here", z: 2000 }),
        };
        me.dot.setMap(map);
      } else {
        me.circle.setCenter(p);
        me.circle.setRadius(radius);
        me.dot.point = p;
        me.dot.draw();
      }
    },
    onUserMove: (fn) => map.addListener("dragstart", fn),
    onIdle: (fn) => map.addListener("idle", fn),
    invalidate: () => {},
    remove: () => { document.removeEventListener("keydown", onKey); api.clearPins(); me?.circle.setMap(null); me?.dot.setMap(null); g.event.clearInstanceListeners(map); el.innerHTML = ""; },
  };
  return api;
}

// ---- Leaflet + OpenStreetMap ---------------------------------------------------------
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

async function leafletMap(el, { center, zoom }) {
  const L = await loadLeaflet();
  const map = L.map(el, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], zoom);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  let layer = L.layerGroup().addTo(map);
  let me = null;
  const ll = (p) => [p.lat, p.lng];
  const api = {
    kind: "leaflet",
    setView: (p, z, { animate = true } = {}) => map.setView(ll(p), z ?? map.getZoom(), { animate }),
    getZoom: () => map.getZoom(),
    panTo: (p) => map.panTo(ll(p), { animate: true }),
    center: () => { const c = map.getCenter(); return { lat: c.lat, lng: c.lng }; },
    fitPoints: (points, pad = {}, maxZoom = 15, minZoom = 3) => {
      if (!points.length) return;
      const b = L.latLngBounds(points.map(ll));
      const z = Math.max(minZoom, Math.min(maxZoom, map.getBoundsZoom(b, false, L.point((pad.left ?? 50) + (pad.right ?? 50), (pad.top ?? 50) + (pad.bottom ?? 50)))));
      map.fitBounds(b, { paddingTopLeft: [pad.left ?? 50, pad.top ?? 50], paddingBottomRight: [pad.right ?? 50, pad.bottom ?? 50], maxZoom: z, animate: false });
      if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false });
    },
    addPin: (point, o) => {
      const marker = L.marker(ll(point), {
        icon: L.divIcon({ className: o.className, html: o.html, iconSize: null, iconAnchor: [0, 0] }),
        keyboard: true, title: o.title, zIndexOffset: (o.z ?? 0) * 10,
      }).bindPopup(() => o.popup(), {
        closeButton: true, offset: [0, -30], autoPan: true,
        autoPanPaddingTopLeft: window.innerWidth < 700 ? [15, 220] : [15, 15],
        autoPanPaddingBottomRight: [15, 30],
      }).addTo(layer);
      marker.on("popupopen", () => { marker.getElement()?.classList.add("selected"); o.onOpen?.(); });
      marker.on("popupclose", () => { marker.getElement()?.classList.remove("selected"); o.onClose?.(); });
      return { point, openPopup: () => marker.openPopup(), marker };
    },
    clearPins: () => { layer.remove(); layer = L.layerGroup().addTo(map); },
    popupOpen: () => Boolean(el.querySelector(".leaflet-popup")),
    closePopup: () => map.closePopup(),
    setMe: ({ lat, lng, accuracy }) => {
      const radius = Math.min(accuracy || 0, 1500);
      if (!me) {
        me = {
          circle: L.circle([lat, lng], { radius, color: "#1f6feb", weight: 1, opacity: 0.35, fillColor: "#1f6feb", fillOpacity: 0.12, interactive: false }).addTo(map),
          dot: L.marker([lat, lng], {
            icon: L.divIcon({ className: "you-dot", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] }),
            keyboard: false, zIndexOffset: 1000, title: "You are here",
          }).addTo(map),
        };
      } else {
        me.circle.setLatLng([lat, lng]).setRadius(radius);
        me.dot.setLatLng([lat, lng]);
      }
    },
    onUserMove: (fn) => map.on("dragstart", fn),
    onIdle: (fn) => map.on("moveend", fn),
    invalidate: () => map.invalidateSize({ pan: false }),
    remove: () => map.remove(),
  };
  return api;
}
