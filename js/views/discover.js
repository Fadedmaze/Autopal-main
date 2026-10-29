// Discover: point the camera at the dashboard, see yellow squares around glowing
// warning lights (found on the device, live), then tap to identify them (AI, via
// the identify-warning-lights Edge Function) and read what each light means for
// the selected car. Also lists every light in the catalog.
import { getProfile, listVehicles, listWarningLights, identifyLights, createTask } from "../data.js";
import { detectLights, BoxTracker } from "../lightDetector.js";
import { appBar, escapeHtml, icon, loading, toast, errorMessage, todayISO, vehicleSpec, withBusy } from "../ui.js";

const SEVERITY = {
  stop: { label: "Stop now", tone: "danger" },
  soon: { label: "Check soon", tone: "warn" },
  info: { label: "Good to know", tone: "info" },
};
const ANALYSIS_WIDTH = 320; // detector works on a small copy of each frame
const DETECT_EVERY_MS = 120;
const CROP_SIZE = 224;
const MAX_IDENTIFY = 8;

let chosenVehicleId = null; // remembered for this visit

// A symbol can be more urgent on some makes (e.g. Ford's amber wrench).
function severityFor(light, brandKey) {
  return light.brand_severity?.[brandKey] ?? light.severity;
}
let listFilter = "all";

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const [profile, vehicles, lights] = await Promise.all([getProfile(), listVehicles(), listWarningLights()]);
  if (!ctx.isCurrent()) return;

  if (!vehicles.some((v) => v.id === chosenVehicleId)) {
    chosenVehicleId = vehicles.some((v) => v.id === profile.active_vehicle_id) ? profile.active_vehicle_id : vehicles[0]?.id ?? null;
  }
  const bySlug = new Map(lights.map((l) => [l.slug, l]));
  const vehicle = () => vehicles.find((v) => v.id === chosenVehicleId) ?? null;
  const brandKey = () => (vehicle()?.brand ?? "").trim().toLowerCase();

  let scanner = null;

  const draw = () => {
    const v = vehicle();
    const brand = brandKey();
    const shown = lights.filter((l) => listFilter === "all" || severityFor(l, brand) === listFilter);
    root.innerHTML = `
      ${appBar({ title: "Discover", sub: "Point your camera at the dashboard to identify warning lights.", back: { href: "#/home", label: "Home" } })}
      <div class="content">
        <section class="scan-hero">
          <span class="scan-hero-icon">${icon("scan", 34, 1.8)}</span>
          <h2>Dashboard light scanner</h2>
          <p>Turn the car on so the lights are glowing, then hold your phone about a foot from the dashboard. Yellow squares appear around the lights we find. Tap one to see what it means.</p>
          <button type="button" class="btn" id="start-scan">${icon("camera", 18, 2)}Scan My Dashboard</button>
          ${vehicles.length ? `
            <div class="scan-vehicle">
              <span>Tuned for</span>
              ${vehicles.length > 1
                ? `<select id="scan-vehicle" aria-label="Vehicle to tune results for">${vehicles.map((x) => `<option value="${x.id}" ${x.id === chosenVehicleId ? "selected" : ""}>${escapeHtml(x.label)} · ${escapeHtml(vehicleSpec(x))}</option>`).join("")}</select>`
                : `<strong>${escapeHtml(v.label)} · ${escapeHtml(vehicleSpec(v))}</strong>`}
            </div>`
            : `<p class="hint">Add your car in the <a href="#/garage">Garage</a> so results can be tuned to its make.</p>`}
        </section>

        <section class="section">
          <div class="section-head"><h3>All warning lights</h3><span class="tone-muted">${lights.length}</span></div>
          <div class="chips scroll" role="group" aria-label="Filter lights">
            ${[["all", "All"], ["stop", "Stop now"], ["soon", "Check soon"], ["info", "Good to know"]].map(([id, label]) =>
              `<button type="button" class="chip ${listFilter === id ? "on" : ""}" data-filter="${id}">${label}</button>`).join("")}
          </div>
          <ul class="light-list">
            ${shown.map((l) => `
              <li>
                <button type="button" class="light-row" data-slug="${escapeHtml(l.slug)}">
                  <span class="light-dots">${l.colors.map((c) => `<i class="cdot c-${escapeHtml(c)}"></i>`).join("")}</span>
                  <span class="light-text">
                    <strong>${escapeHtml(l.name)}</strong>
                    <small>${escapeHtml(l.symbol_hint)}</small>
                    ${brand && l.brand_notes?.[brand] ? `<small class="brand-flag">${icon("car", 12, 2)} Specific to your ${escapeHtml(v.brand)}</small>` : ""}
                  </span>
                  <span class="sev-pill sev-${severityFor(l, brand)}">${SEVERITY[severityFor(l, brand)].label}</span>
                </button>
              </li>`).join("")}
          </ul>
          <p class="hint center">AutoPal's results are a guide, not a diagnosis. Check your owner's manual or a mechanic if you're unsure.</p>
        </section>
      </div>`;

    root.querySelector("#start-scan").addEventListener("click", () => {
      scanner?.close();
      scanner = openScanner({ vehicle, brandKey, bySlug, ctx, onClose: () => { scanner = null; } });
    });
    root.querySelector("#scan-vehicle")?.addEventListener("change", (e) => {
      chosenVehicleId = Number(e.target.value);
      draw();
    });
    root.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { listFilter = b.dataset.filter; draw(); }));
    root.querySelectorAll(".light-row").forEach((b) => b.addEventListener("click", () =>
      openLightCard({ light: bySlug.get(b.dataset.slug), vehicle: vehicle(), brandKey: brandKey(), ctx })));
  };

  draw();
  return () => scanner?.close();
}

// ---- Scanner overlay -------------------------------------------------------

function openScanner({ vehicle, brandKey, bySlug, ctx, onClose }) {
  const el = document.createElement("div");
  el.className = "scanner";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Dashboard scanner");
  el.innerHTML = `
    <video playsinline muted autoplay></video>
    <canvas class="scanner-overlay"></canvas>
    <div class="scanner-top">
      <button type="button" class="map-fab" data-close aria-label="Close scanner">${icon("close", 22, 2.4)}</button>
      <span class="scanner-car">${vehicle() ? `${icon("car", 15, 2)} ${escapeHtml(vehicle().label)}` : "No vehicle selected"}</span>
    </div>
    <p class="scanner-msg" role="status">Starting camera…</p>
    <div class="scanner-bottom">
      <button type="button" class="btn btn-soft btn-sm" data-resume hidden>${icon("camera", 16, 2)}Scan Again</button>
      <button type="button" class="shutter" data-identify aria-label="Identify the lights in view">${icon("scan", 26, 2)}</button>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add("scanning");

  const video = el.querySelector("video");
  const overlay = el.querySelector("canvas");
  const msg = el.querySelector(".scanner-msg");
  const identifyBtn = el.querySelector("[data-identify]");
  const resumeBtn = el.querySelector("[data-resume]");
  const octx = overlay.getContext("2d");
  const work = document.createElement("canvas");
  const wctx = work.getContext("2d", { willReadFrequently: true });
  const tracker = new BoxTracker();

  let stream = null;
  let raf = 0;
  let lastDetect = 0;
  let live = [];        // boxes being tracked in the live view
  let frozen = null;    // { boxes: [...with result], frame: canvas } after identifying
  let closed = false;

  const setMsg = (text) => { msg.textContent = text; msg.hidden = !text; };

  // Where the video's pixels land on screen (object-fit: cover).
  const layout = () => {
    const vw = video.videoWidth || 1, vh = video.videoHeight || 1;
    const cw = el.clientWidth, ch = el.clientHeight;
    const scale = Math.max(cw / vw, ch / vh);
    return { vw, vh, cw, ch, scale, ox: (cw - vw * scale) / 2, oy: (ch - vh * scale) / 2 };
  };
  // A normalized box -> on-screen square (the user asked for squares), padded a little.
  const screenSquare = (b, L) => {
    const cx = L.ox + (b.x + b.w / 2) * L.vw * L.scale;
    const cy = L.oy + (b.y + b.h / 2) * L.vh * L.scale;
    const side = Math.max(34, Math.max(b.w * L.vw, b.h * L.vh) * L.scale * 1.5);
    return { x: cx - side / 2, y: cy - side / 2, s: side };
  };

  const paint = () => {
    const dpr = window.devicePixelRatio || 1;
    const L = layout();
    if (overlay.width !== Math.round(L.cw * dpr) || overlay.height !== Math.round(L.ch * dpr)) {
      overlay.width = Math.round(L.cw * dpr);
      overlay.height = Math.round(L.ch * dpr);
    }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, L.cw, L.ch);
    const boxes = frozen ? frozen.boxes : live;
    for (const b of boxes) {
      const q = screenSquare(b, L);
      const result = b.result;
      const unknown = result && (!result.is_warning_light || result.slug === "unknown");
      octx.lineWidth = 3;
      octx.strokeStyle = unknown ? "rgba(255,255,255,.75)" : "#FFD400";
      octx.setLineDash(unknown ? [6, 5] : []);
      octx.shadowColor = "rgba(0,0,0,.5)";
      octx.shadowBlur = 6;
      roundRect(octx, q.x, q.y, q.s, q.s, 8);
      octx.stroke();
      octx.setLineDash([]);
      octx.shadowBlur = 0;
      if (b.pending) {
        badge(octx, q, L.cw, "Identifying…", "#FFD400", "#121826");
      } else if (result) {
        const light = bySlug.get(result.slug);
        const label = unknown ? "Not recognized" : light?.name ?? "Unknown";
        const sev = light && severityFor(light, brandKey());
        badge(octx, q, L.cw, label, sev === "stop" ? "#dc2626" : sev === "soon" ? "#FFD400" : unknown ? "#e5e7eb" : "#34d399", sev === "stop" ? "#fff" : "#121826");
      }
    }
  };

  const loop = (t) => {
    if (closed) return;
    raf = requestAnimationFrame(loop);
    if (!frozen && video.readyState >= 2 && t - lastDetect > DETECT_EVERY_MS) {
      lastDetect = t;
      const aw = ANALYSIS_WIDTH;
      const ah = Math.max(1, Math.round(aw * video.videoHeight / video.videoWidth));
      if (work.width !== aw || work.height !== ah) { work.width = aw; work.height = ah; }
      wctx.drawImage(video, 0, 0, aw, ah);
      live = tracker.update(detectLights(wctx.getImageData(0, 0, aw, ah)));
      if (!frozen) {
        setMsg(live.length
          ? `Found ${live.length} light${live.length === 1 ? "" : "s"}. Tap a square, or the button below, to identify.`
          : "Looking for glowing lights… Hold steady about a foot from the dashboard.");
      }
    }
    paint();
  };

  // Freeze the current frame and identify the given boxes (all live ones by default).
  const identify = async (boxes, { focusId = null, append = false } = {}) => {
    if (!video.videoWidth) return;
    if (!frozen) {
      const frame = document.createElement("canvas");
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      frame.getContext("2d").drawImage(video, 0, 0);
      video.pause();
      frozen = { frame, boxes: [] };
      resumeBtn.hidden = false;
      identifyBtn.hidden = true;
    }
    const batch = boxes.slice(0, MAX_IDENTIFY).map((b) => ({ ...b, pending: true }));
    frozen.boxes = append ? [...frozen.boxes, ...batch] : batch;
    if (!batch.length) {
      setMsg("No lights found in this shot. Tap directly on a light to check it, or scan again.");
      return;
    }
    setMsg("Identifying…");
    try {
      const crops = batch.map((b) => cropBase64(frozen.frame, b));
      const results = await identifyLights(vehicle()?.id ?? null, crops);
      if (closed) return;
      batch.forEach((b, i) => { b.pending = false; b.result = results[i]; });
      const found = batch.filter((b) => b.result?.is_warning_light).length;
      setMsg(found
        ? `Identified ${found} light${found === 1 ? "" : "s"}. Tap a square for details, or tap any other light to check it.`
        : "We couldn't match these to warning lights. Tap directly on a light to try again, or scan again.");
      const focus = batch.find((b) => b.id === focusId) ?? (batch.length === 1 ? batch[0] : null);
      if (focus?.result) showResult(focus.result);
    } catch (err) {
      if (closed) return;
      frozen.boxes = frozen.boxes.filter((b) => !batch.includes(b));
      setMsg(errorMessage(err));
      toast(errorMessage(err), "error");
    }
  };

  const showResult = (result) => {
    const light = bySlug.get(result.slug);
    openLightCard({ light, result, vehicle: vehicle(), brandKey: brandKey(), ctx });
  };

  const resume = () => {
    frozen = null;
    tracker.reset();
    live = [];
    resumeBtn.hidden = true;
    identifyBtn.hidden = false;
    video.play().catch(() => {});
  };

  const close = () => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    el.remove();
    document.body.classList.remove("scanning");
    window.removeEventListener("keydown", onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) close(); };
  window.addEventListener("keydown", onKey);

  el.querySelector("[data-close]").addEventListener("click", close);
  resumeBtn.addEventListener("click", resume);
  identifyBtn.addEventListener("click", () => identify(live));

  // Tap: a square opens or identifies it; elsewhere on a frozen frame checks that spot.
  overlay.addEventListener("click", (e) => {
    const rect = overlay.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const L = layout();
    const boxes = frozen ? frozen.boxes : live;
    const hit = [...boxes].reverse().find((b) => {
      const q = screenSquare(b, L);
      return px >= q.x && px <= q.x + q.s && py >= q.y && py <= q.y + q.s;
    });
    if (hit) {
      if (hit.result) showResult(hit.result);
      else if (!hit.pending && !frozen) identify(live, { focusId: hit.id });
      return;
    }
    if (frozen && !frozen.boxes.some((b) => b.pending)) {
      // Manual check: a square around the tapped point, sized like a typical symbol.
      const side = Math.min(L.vw, L.vh) * 0.09;
      const nx = (px - L.ox) / L.scale, ny = (py - L.oy) / L.scale;
      const box = { id: `tap-${Date.now()}`, x: (nx - side / 2) / L.vw, y: (ny - side / 2) / L.vh, w: side / L.vw, h: side / L.vh, color: "unknown" };
      identify([box], { focusId: box.id, append: true });
    }
  });

  (async () => {
    try {
      // The local test harness can supply a fake camera stream.
      stream = window.__autopalFakeCamera
        ? await window.__autopalFakeCamera()
        : await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          });
      if (closed) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      setMsg("Looking for glowing lights… Hold steady about a foot from the dashboard.");
      raf = requestAnimationFrame(loop);
    } catch (err) {
      const name = err?.name;
      setMsg(
        !navigator.mediaDevices ? "Your browser doesn't allow camera access here. Open AutoPal in Safari or Chrome."
          : name === "NotAllowedError" ? "Camera access was blocked. Allow camera access for this site in your browser settings, then try again."
          : name === "NotFoundError" || name === "OverconstrainedError" ? "No camera was found on this device."
          : "The camera couldn't start. Close other apps using the camera and try again.");
      identifyBtn.hidden = true;
    }
  })();

  return { close };
}

// Square crop around a box (with margin), resized to CROP_SIZE, as base64 JPEG.
function cropBase64(frame, b) {
  const W = frame.width, H = frame.height;
  const side = Math.max(Math.max(b.w * W, b.h * H) * 1.8, Math.min(W, H) * 0.05);
  const cx = (b.x + b.w / 2) * W, cy = (b.y + b.h / 2) * H;
  const sx = Math.max(0, Math.min(W - side, cx - side / 2));
  const sy = Math.max(0, Math.min(H - side, cy - side / 2));
  const c = document.createElement("canvas");
  c.width = c.height = CROP_SIZE;
  c.getContext("2d").drawImage(frame, sx, sy, Math.min(side, W), Math.min(side, H), 0, 0, CROP_SIZE, CROP_SIZE);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function badge(c, q, screenWidth, text, bg, fg) {
  c.font = "700 12px Inter, -apple-system, sans-serif";
  const w = Math.min(c.measureText(text).width + 14, 220);
  const x = Math.max(6, Math.min(screenWidth - w - 6, q.x + q.s / 2 - w / 2)); // keep labels on screen
  const y = q.y - 26 < 4 ? q.y + q.s + 6 : q.y - 26;
  c.fillStyle = bg;
  roundRect(c, x, y, w, 20, 10);
  c.fill();
  c.fillStyle = fg;
  c.textBaseline = "middle";
  c.fillText(text, x + 7, y + 10, w - 14);
}

// ---- Info card -------------------------------------------------------------

function openLightCard({ light, result = null, vehicle, brandKey, ctx }) {
  const unknown = !light || (result && (!result.is_warning_light || result.slug === "unknown"));
  const brandNote = !unknown && brandKey ? light.brand_notes?.[brandKey] : null;
  const aiNote = result?.vehicle_note?.trim();
  const severity = light ? severityFor(light, brandKey) : null;
  const sev = severity ? SEVERITY[severity] : null;

  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.innerHTML = `
    <div class="sheet-body left light-card">
      <div class="sheet-head">
        <h2>${unknown ? "Not recognized" : escapeHtml(light.name)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close", 18, 2.2)}</button>
      </div>
      ${unknown ? `
        <p>We couldn't match this to a known warning light. It may be glare, a reflection, or a symbol specific to your car.</p>
        ${aiNote ? `<p class="light-note">${escapeHtml(aiNote)}</p>` : ""}
        <p class="hint">Try again closer to the light, or look it up in your owner's manual.</p>`
      : `
        <div class="light-meta">
          <span class="sev-pill sev-${severity}">${sev.label}</span>
          <span class="light-dots">${light.colors.map((c) => `<i class="cdot c-${escapeHtml(c)}"></i>`).join("")}</span>
          ${result ? `<span class="tone-muted">${result.confidence === "high" ? "Confident match" : result.confidence === "medium" ? "Likely match" : "Possible match"}</span>` : ""}
        </div>
        ${result?.confidence === "low" ? `<p class="notice notice-warn">${icon("alert", 16, 2)}<span>We're not fully sure about this one. Compare it with your owner's manual.</span></p>` : ""}
        <div class="light-section"><h3>What it means</h3><p>${escapeHtml(light.meaning)}</p></div>
        <div class="light-section"><h3>What to do</h3><p>${escapeHtml(light.action)}</p></div>
        <div class="light-section"><h3>Can I keep driving?</h3><p>${escapeHtml(light.drive_advice)}</p></div>
        ${brandNote || aiNote ? `
          <div class="light-section brand-note">
            <h3>${icon("car", 15, 2)} On your ${escapeHtml(vehicle?.brand ?? "car")}</h3>
            ${brandNote ? `<p>${escapeHtml(brandNote)}</p>` : ""}
            ${aiNote && aiNote !== brandNote ? `<p>${escapeHtml(aiNote)}</p>` : ""}
          </div>` : ""}
        <div class="light-actions">
          ${vehicle && severity !== "info" ? `<button type="button" class="btn btn-soft" data-task>${icon("plus", 16, 2.4)}Add to My Tasks</button>` : ""}
          ${severity !== "info" ? `<a class="btn" href="#/mechanics" data-mechanic>${icon("pin", 16, 2)}Find a Mechanic</a>` : ""}
        </div>`}
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  dlg.querySelector("[data-mechanic]")?.addEventListener("click", () => {
    dlg.close();
    document.querySelector(".scanner [data-close]")?.click();
  });
  dlg.querySelector("[data-task]")?.addEventListener("click", (e) =>
    withBusy(e.currentTarget, async () => {
      try {
        await createTask({
          vehicle_id: vehicle.id,
          task_name: `Check: ${light.name}`.slice(0, 80),
          due_date: todayISO(),
          notes: `Spotted with the Discover scanner. ${light.action}`.slice(0, 1000),
        });
        toast(`Added to ${vehicle.label}'s tasks`, "ok");
        dlg.close();
      } catch (err) {
        toast(errorMessage(err), "error");
      }
    }));
  dlg.showModal();
}
