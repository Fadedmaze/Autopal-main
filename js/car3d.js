// Procedural 3D car for the Home platform. No model files: the body, cabin, wheels and
// lights are built from primitives, with proportions picked by body style. three.js is
// imported from a pinned CDN build only when a car is shown, so other screens don't pay
// for it. mountCar3D() resolves to null when WebGL or the import is unavailable, and the
// caller keeps the 2D icon.
import { bodyStyle } from "./ui.js";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
let threePromise = null;
const loadThree = () => (threePromise ??= import(THREE_URL).catch((err) => {
  threePromise = null; // allow a retry on the next car
  throw err;
}));

// Proportions per style (meters-ish). Front of the car is +z; wheels sit at y = wheelR.
const SHAPES = {
  sedan: { len: 4.6, bodyH: 0.5, ground: 0.42, wheelR: 0.34, cabinLen: 2.3, cabinZ: -0.15, cabinH: 0.5, cabinW: 0.9 },
  hatch: { len: 4.1, bodyH: 0.5, ground: 0.4, wheelR: 0.33, cabinLen: 2.7, cabinZ: -0.45, cabinH: 0.52, cabinW: 0.9 },
  coupe: { len: 4.5, bodyH: 0.38, ground: 0.28, wheelR: 0.34, cabinLen: 2.0, cabinZ: -0.3, cabinH: 0.4, cabinW: 0.82, spoiler: true },
  suv: { len: 4.7, bodyH: 0.6, ground: 0.55, wheelR: 0.4, cabinLen: 3.2, cabinZ: -0.4, cabinH: 0.75, cabinW: 0.92, rails: true },
  truck: { len: 5.6, bodyH: 0.6, ground: 0.6, wheelR: 0.45, cabinLen: 2.0, cabinZ: 1.0, cabinH: 0.7, cabinW: 0.9, bedLen: 2.7 },
  van: { len: 5.0, bodyH: 1.15, ground: 0.45, wheelR: 0.38 },
};
const BODY_W = 1.9;

function buildCar(THREE, style, paintColor) {
  const s = SHAPES[style];
  const car = new THREE.Group();
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15, ...o });
  const paint = std(paintColor);
  const glass = std(0x33465e, { roughness: 0.12, metalness: 0.35 });
  const black = std(0x15171b, { roughness: 0.9, metalness: 0 });
  const chrome = std(0xc9d1db, { roughness: 0.25, metalness: 0.8 });
  const lampWhite = std(0xfff4d6, { emissive: 0xfff4d6, emissiveIntensity: 0.5 });
  const lampRed = std(0xd11f2c, { emissive: 0xd11f2c, emissiveIntensity: 0.4 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    car.add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // Main body. Vans are a tall box with a glass band; other styles are a low body plus a cabin.
  add(box(BODY_W, s.bodyH, s.len), paint, 0, s.ground + s.bodyH / 2, 0);

  if (style === "van") {
    add(box(BODY_W * 1.01, 0.42, s.len * 0.86), glass, 0, s.ground + s.bodyH * 0.72, 0);
    add(box(BODY_W * 0.98, 0.1, s.len * 0.96), paint, 0, s.ground + s.bodyH + 0.05, 0);
    add(box(BODY_W * 0.8, 0.22, 0.04), glass, 0, s.ground + s.bodyH * 0.55, s.len / 2 + 0.01);
  } else {
    const roofY = s.ground + s.bodyH + s.cabinH / 2;
    add(box(BODY_W * s.cabinW, s.cabinH, s.cabinLen), glass, 0, roofY, s.cabinZ);
    add(box(BODY_W * s.cabinW * 0.97, 0.06, s.cabinLen * 0.95), paint, 0, roofY + s.cabinH / 2 + 0.03, s.cabinZ);
    if (s.rails) {
      for (const x of [-BODY_W * 0.4, BODY_W * 0.4]) add(box(0.05, 0.05, s.cabinLen * 0.9), chrome, x, roofY + s.cabinH / 2 + 0.09, s.cabinZ);
    }
  }

  if (style === "truck") {
    // Open bed behind the cab: dark liner floor, paint-colored side walls and tailgate.
    const bedZ = -s.bedLen / 2 + 0.02;
    add(box(BODY_W * 0.84, 0.05, s.bedLen), black, 0, s.ground + s.bodyH + 0.02, bedZ);
    for (const x of [-BODY_W / 2 + 0.04, BODY_W / 2 - 0.04]) add(box(0.08, 0.35, s.bedLen), paint, x, s.ground + s.bodyH + 0.17, bedZ);
    add(box(BODY_W * 0.84, 0.35, 0.08), paint, 0, s.ground + s.bodyH + 0.17, -s.bedLen / 2 + 0.02 - 0.02);
  }

  if (s.spoiler) {
    add(box(BODY_W * 0.9, 0.06, 0.25), black, 0, s.ground + s.bodyH + 0.22, -s.len / 2 + 0.12);
  }

  // Lights, grille and wheels.
  const frontZ = s.len / 2 + 0.01;
  const lampY = s.ground + s.bodyH * 0.7;
  for (const x of [-0.6, 0.6]) {
    add(box(0.35, 0.12, 0.05), lampWhite, x, lampY, frontZ);
    add(box(0.35, 0.12, 0.05), lampRed, x, lampY, -frontZ);
  }
  add(box(BODY_W * 0.5, 0.2, 0.05), black, 0, s.ground + s.bodyH * 0.35, frontZ);

  const wheelZ = s.len * 0.32;
  const wheelX = BODY_W / 2 - 0.02;
  const tireGeo = new THREE.CylinderGeometry(s.wheelR, s.wheelR, 0.26, 24);
  const rimGeo = new THREE.CylinderGeometry(s.wheelR * 0.58, s.wheelR * 0.58, 0.27, 16);
  tireGeo.rotateZ(Math.PI / 2);
  rimGeo.rotateZ(Math.PI / 2);
  for (const x of [-wheelX, wheelX]) {
    for (const z of [-wheelZ, wheelZ]) {
      add(tireGeo, black, x, s.wheelR, z);
      add(rimGeo, chrome, x, s.wheelR, z);
    }
  }

  // Ground shadow under the car.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.2, s.len * 0.55, 1);
  shadow.position.y = 0.005;
  car.add(shadow);

  return car;
}

// Mounts a 3D car into `host` (the platform element). Returns { destroy } or null.
export async function mountCar3D(host, vehicle, paintColor) {
  let THREE;
  try {
    THREE = await loadThree();
  } catch {
    return null;
  }
  if (!host.isConnected) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null; // WebGL unavailable
  }
  const canvas = renderer.domElement;
  canvas.className = "car-3d";
  canvas.setAttribute("aria-hidden", "true");
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const car = buildCar(THREE, bodyStyle(vehicle), paintColor);
  car.scale.setScalar(0.8);
  scene.add(car);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 2.6, 9);
  camera.lookAt(0, 0.55, 0);

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  host.appendChild(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // Animation: slow auto-rotate (off for reduced motion), paused while the tab is hidden,
  // and paused while the user is dragging the car.
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let last = performance.now();
  let idleUntil = 0;
  let dragging = null;
  let suppressClickUntil = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduceMotion && !dragging && now > idleUntil) car.rotation.y += dt * 0.5;
    renderer.render(scene, camera);
  };
  const start = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);

  // Drag to spin. Touch uses pan-y (see CSS), so horizontal swipes still move the carousel.
  const onDown = (e) => {
    dragging = { id: e.pointerId, x: e.clientX, moved: 0 };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const dx = e.clientX - dragging.x;
    dragging.x = e.clientX;
    dragging.moved += Math.abs(dx);
    car.rotation.y += dx * 0.01;
    idleUntil = performance.now() + 2500;
  };
  const onUp = (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    // A real drag should not also open the vehicle page when the pointer lifts.
    if (dragging.moved > 6) suppressClickUntil = performance.now() + 300;
    dragging = null;
  };
  const onClick = (e) => {
    if (performance.now() < suppressClickUntil) e.preventDefault();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("click", onClick);

  renderer.render(scene, camera);
  host.classList.add("has-3d");
  if (!document.hidden) start();

  return {
    destroy() {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("click", onClick);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
      host.classList.remove("has-3d");
    },
  };
}
