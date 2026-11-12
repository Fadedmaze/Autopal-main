// Procedural 3D car for the Home platform. No model files: the body is a side profile
// (hood, beltline, trunk or hatch, wheel arches) extruded with rounded edges, under a
// tinted glass cabin with a painted roof and pillars, on rounded tires and five-spoke
// alloys. Proportions come from the body style. Paint is clear-coated and reflects a
// small studio environment built in code. three.js is
// imported from a pinned CDN build only when a car is shown, so other screens don't pay
// for it. mountCar3D() resolves to null when WebGL or the import is unavailable, and the
// caller keeps the 2D icon.
import { bodyStyle } from "./ui.js";
import { normalizeLook, WHEELS } from "./carLook.js";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
let threePromise = null;
const loadThree = () => (threePromise ??= import(THREE_URL).catch((err) => {
  threePromise = null; // allow a retry on the next car
  throw err;
}));

// Side profiles per body style, in meters (front of the car is +z, ground is y = 0).
//   len        overall length          wheelR   tire radius        wb      half wheelbase
//   rocker     bottom of the body      nose     top of the nose    belt    hood/beltline height
//   ws         windshield base (z)     rf / rr  roof front / rear  roofY   roof height
//   rg         rear glass base (z)     deck     trunk lid height   tail    rear end shape
const SHAPES = {
  sedan: { len: 4.7, wheelR: 0.33, wb: 1.38, rocker: 0.3, nose: 0.72, belt: 0.93, ws: 0.95, rf: 0.12, rr: -0.95, roofY: 1.42, rg: -1.6, deck: 0.98 },
  hatch: { len: 4.2, wheelR: 0.32, wb: 1.3, rocker: 0.3, nose: 0.72, belt: 0.93, ws: 0.85, rf: 0.05, rr: -1.45, roofY: 1.45, rg: -1.98, deck: 1.0, tail: "hatch" },
  coupe: { len: 4.55, wheelR: 0.34, wb: 1.35, rocker: 0.24, nose: 0.6, belt: 0.82, ws: 0.75, rf: -0.15, rr: -0.75, roofY: 1.24, rg: -1.75, deck: 0.88, spoiler: true },
  suv: { len: 4.75, wheelR: 0.38, wb: 1.42, rocker: 0.42, nose: 0.98, belt: 1.12, ws: 1.15, rf: 0.45, rr: -2.05, roofY: 1.78, rg: -2.25, deck: 1.15, tail: "hatch", rails: true },
  truck: { len: 5.6, wheelR: 0.42, wb: 1.8, rocker: 0.5, nose: 1.12, belt: 1.24, ws: 1.35, rf: 0.8, rr: -0.35, roofY: 1.95, rg: -0.45, deck: 1.24, bed: true },
  van: { len: 5.0, wheelR: 0.36, wb: 1.5, rocker: 0.4, nose: 0.98, belt: 1.12, ws: 1.75, rf: 1.15, rr: -2.35, roofY: 1.95, rg: -2.45, deck: 1.15, tail: "hatch" },
};
const BODY_W = 1.86; // overall body width, including the rounded edges
const CABIN_W = 1.56;

// Soft round shadow texture (drawn once on a canvas).
function shadowTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.25)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A soft studio "room" for reflections: bright sky above, darker floor, two light panels.
// Built from core three.js only, so no extra modules are fetched.
function studioEnvironment(THREE, renderer) {
  const env = new THREE.Scene();
  const sky = new THREE.SphereGeometry(20, 32, 16);
  const colors = [];
  const pos = sky.attributes.position;
  const top = new THREE.Color(0xeef3fa), mid = new THREE.Color(0xb9c2cd), floor = new THREE.Color(0x2f343b);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 20;
    const c = y > 0 ? mid.clone().lerp(top, Math.min(1, y * 1.6)) : mid.clone().lerp(floor, Math.min(1, -y * 3));
    colors.push(c.r, c.g, c.b);
  }
  sky.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  env.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(14, 3, 0, 12, 4, 3.2);   // long softbox overhead: the bright streak along the roof and hood
  panel(5, 6, -12, 4, 6, 1.8);   // side light for the doors
  panel(5, 6, 12, 3, -6, 1.2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return tex;
}

// Paint finishes: how metallic, how rough, and whether there's a glossy clear coat.
const FINISH = {
  metallic: { metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 },
  gloss: { metalness: 0.05, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.03 },
  pearl: { metalness: 0.3, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.45, iridescenceIOR: 1.6 },
  matte: { metalness: 0.15, roughness: 0.7, clearcoat: 0, clearcoatRoughness: 1 },
};
const TINT = { light: 0x2b3846, medium: 0x0f1620, dark: 0x040507 };

function buildCar(THREE, style, look) {
  const s = { ...SHAPES[style] };
  if (look.rails !== null) s.rails = look.rails;
  if (look.spoiler !== null) s.spoiler = look.spoiler;
  const half = s.len / 2;
  const car = new THREE.Group();

  // Materials: clear-coated metallic paint, tinted glass, satin black trim, brushed alloy.
  const paint = new THREE.MeshPhysicalMaterial({ color: look.paint, ...FINISH[look.finish] });
  // A black roof also turns the pillars black, for the "floating roof" look.
  const roofPaint = look.roof === "black"
    ? new THREE.MeshPhysicalMaterial({ color: 0x0d0e10, ...FINISH.gloss })
    : paint;
  const glass = new THREE.MeshPhysicalMaterial({ color: TINT[look.tint], metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: look.tint === "light" ? 0.95 : 0.75 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.55, metalness: 0.2 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.92, metalness: 0 });
  const wheelHex = WHEELS.find((w) => w.id === look.wheels)?.hex ?? "#d5dbe2";
  const alloy = new THREE.MeshStandardMaterial({
    color: wheelHex,
    roughness: look.wheels === "chrome" ? 0.06 : look.wheels === "black" || look.wheels === "white" ? 0.4 : 0.22,
    metalness: look.wheels === "black" || look.wheels === "white" ? 0.35 : 0.95,
  });
  const darkAlloy = new THREE.MeshStandardMaterial({ color: 0x5c636b, roughness: 0.35, metalness: 0.9 });
  const headlamp = new THREE.MeshStandardMaterial({ color: 0xf6f9ff, emissive: 0xdfeaff, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.3 });
  const taillamp = new THREE.MeshStandardMaterial({ color: 0x7a0b12, emissive: 0xe0101e, emissiveIntensity: 0.75, roughness: 0.25 });
  const plate = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 });

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = car) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Extrude a side profile across the car's width. The shape is drawn with x = car z.
  const extrudeAcross = (shape, width, bevel) => {
    const depth = Math.max(0.01, width - bevel * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 6, curveSegments: 24,
    });
    geo.translate(0, 0, -depth / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  };

  // ---- Lower body: bumpers, hood, beltline and trunk, with arches cut for the wheels.
  const archR = s.wheelR + 0.07;
  // The rounded edge (bevel) grows a profile outward by about BS, so profiles are drawn
  // that much smaller and land on the intended sizes.
  const BS = 0.085;
  const arch = (zc) => {
    const r = archR + BS;
    const sn = Math.max(-0.99, Math.min(0.99, (s.rocker + BS - s.wheelR) / r));
    return [zc, Math.PI - Math.asin(sn), Math.asin(sn), r];
  };
  const body = new THREE.Shape();
  const rearEnd = -half;
  const F = half - BS, B = rearEnd + BS;             // front and back faces
  const lo = s.rocker + BS, nose = s.nose - BS, belt = s.belt - BS, deck = s.deck - BS;
  body.moveTo(B + 0.18, lo);
  for (const zc of [-s.wb, s.wb]) {
    const [c, a1, a2, r] = arch(zc);
    body.lineTo(c + r * Math.cos(a1), lo);
    body.absarc(c, s.wheelR, r, a1, a2, true);
  }
  // Front bumper and nose.
  body.lineTo(F - 0.2, lo);
  body.quadraticCurveTo(F, lo + 0.02, F, lo + 0.22);
  body.quadraticCurveTo(F + 0.02, nose - 0.06, F - 0.14, nose);
  // Hood rises gently to the windshield.
  body.quadraticCurveTo((F + s.ws) / 2, belt - 0.02, s.ws, belt);
  // Beltline back to the rear glass, then the trunk lid / hatch and rear bumper.
  body.lineTo(s.rg, deck);
  if (s.tail === "hatch") {
    body.quadraticCurveTo(B + 0.02, deck, B + 0.03, deck - 0.22);
  } else {
    body.quadraticCurveTo(B + 0.3, deck + 0.03, B + 0.08, deck - 0.05);
  }
  body.quadraticCurveTo(B - 0.02, (deck + lo) / 2, B + 0.02, lo + 0.15);
  body.quadraticCurveTo(B + 0.04, lo, B + 0.18, lo);
  add(extrudeAcross(body, BODY_W, 0.1), paint);

  // Wheel wells: dark liners inside each arch so you can't see through the body.
  const wellGeo = new THREE.CylinderGeometry(archR - 0.005, archR - 0.005, BODY_W - 0.12, 28, 1, true, Math.PI / 2 + 0.05, Math.PI * 2);
  wellGeo.rotateZ(Math.PI / 2);
  for (const zc of [-s.wb, s.wb]) add(wellGeo, new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 1, side: THREE.BackSide }), 0, s.wheelR, zc);

  // Satin black sill between the wheels, and a lower intake across the front bumper.
  const sillLen = s.wb * 2 - archR * 2 - 0.1;
  for (const x of [-BODY_W / 2 + 0.02, BODY_W / 2 - 0.02]) add(new THREE.BoxGeometry(0.05, 0.1, sillLen), trim, x, s.rocker + 0.05, 0);
  add(new THREE.BoxGeometry(BODY_W * 0.5, 0.08, 0.05), trim, 0, s.rocker + 0.13, half - 0.06);

  // ---- Cabin: a tinted glass greenhouse with a body-colored roof and pillars. Its parts
  // go in their own group so the sides can be tapered inward toward the roof afterwards.
  const cabin = new THREE.Group();
  car.add(cabin);
  const cab = new THREE.Shape();
  const CB = 0.1, roofIn = s.roofY - CB * 0.85;     // glass bevel and its growth
  cab.moveTo(s.ws - 0.06, s.belt - 0.12);
  cab.quadraticCurveTo(s.rf + 0.1, roofIn - 0.05, s.rf, roofIn);
  cab.lineTo(s.rr, roofIn);
  cab.quadraticCurveTo(s.rg + (s.tail === "hatch" ? 0.02 : 0.22), roofIn - 0.04, s.rg + 0.04, s.deck - 0.12);
  cab.closePath();
  add(extrudeAcross(cab, CABIN_W, CB), glass, 0, 0, 0, cabin);

  // Roof panel: a slim body-colored cap over the glass.
  const roof = new THREE.Shape();
  const r0 = s.rf - 0.08, r1 = s.rr + 0.08;
  roof.moveTo(r0, s.roofY - 0.06);
  roof.lineTo(r0 - 0.03, s.roofY - 0.01);
  roof.lineTo(r1 + 0.03, s.roofY - 0.01);
  roof.lineTo(r1, s.roofY - 0.06);
  roof.closePath();
  add(extrudeAcross(roof, CABIN_W + 0.04, 0.05), roofPaint, 0, 0, 0, cabin);

  // Pillars: thin painted bars along the edges of the glass (A at the front, C at the back, B in between).
  // They sit on the flat side of the glass, inside its rounded edges, and stop just
  // short of the roof so nothing pokes out.
  const PX = CABIN_W / 2 + 0.004;
  const pillar = (z0, y0, z1, y1, w) => {
    const len = Math.hypot(z1 - z0, y1 - y0);
    for (const x of [-PX, PX]) {
      const m = add(new THREE.BoxGeometry(0.035, len, w), roofPaint, x, (y0 + y1) / 2, (z0 + z1) / 2, cabin);
      m.rotation.x = Math.atan2(z1 - z0, y1 - y0);
    }
  };
  const top = s.roofY - 0.1;
  // Along the windshield / rear glass edge, using the same curves as the glass.
  const slope = (zA, zB, t) => zA + (zB - zA) * t;
  pillar(slope(s.ws - 0.06, s.rf, 0.12), s.belt + 0.04, slope(s.ws - 0.06, s.rf, 0.92), top, 0.1);
  pillar(slope(s.rg + 0.04, s.rr, 0.12), s.deck + 0.04, slope(s.rg + 0.04, s.rr, 0.92), top, style === "suv" || style === "van" ? 0.18 : 0.13);
  const bZ = style === "truck" ? (s.rf + s.rr) / 2 - 0.15 : (s.ws + s.rg) / 2 + 0.25;
  pillar(bZ, s.belt + 0.02, bZ - 0.03, top, 0.1);
  if (s.tail === "hatch" && style !== "hatch") pillar((bZ + s.rr) / 2 - 0.2, s.belt + 0.02, (bZ + s.rr) / 2 - 0.22, top, 0.08);

  // Chrome-free window line along the bottom of the glass.
  for (const x of [-CABIN_W / 2 - 0.01, CABIN_W / 2 + 0.01]) {
    add(new THREE.BoxGeometry(0.03, 0.03, Math.abs(s.ws - s.rg) - 0.2), trim, x, s.belt + 0.01, (s.ws + s.rg) / 2);
  }

  if (s.rails) {
    for (const x of [-CABIN_W * 0.38, CABIN_W * 0.38]) add(new THREE.BoxGeometry(0.05, 0.05, Math.abs(s.rf - s.rr) - 0.25), trim, x, s.roofY + 0.06, (s.rf + s.rr) / 2, cabin);
  }

  // Tumblehome: real cabins lean inward toward the roof. Bake each part's position into
  // its geometry, then pull vertices in by up to TAPER as they rise from the beltline.
  const TAPER = style === "van" || style === "truck" ? 0.08 : 0.14;
  cabin.updateMatrixWorld(true);
  for (const m of [...cabin.children]) {
    m.updateMatrix();
    m.geometry.applyMatrix4(m.matrix);
    m.position.set(0, 0, 0);
    m.rotation.set(0, 0, 0);
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) - s.belt) / (s.roofY - s.belt)));
      pos.setX(i, pos.getX(i) * (1 - TAPER * t));
    }
    m.geometry.computeVertexNormals();
  }

  // Truck bed: a low tonneau cover between the bed rails behind the cab.
  if (s.bed) {
    const bedStart = s.rg - 0.12, bedEnd = rearEnd + 0.12;
    add(new THREE.BoxGeometry(BODY_W - 0.26, 0.03, bedStart - bedEnd), trim, 0, s.deck + 0.02, (bedStart + bedEnd) / 2);
    for (const x of [-BODY_W / 2 + 0.06, BODY_W / 2 - 0.06]) add(new THREE.BoxGeometry(0.1, 0.06, bedStart - bedEnd), paint, x, s.deck + 0.03, (bedStart + bedEnd) / 2);
  }

  if (s.spoiler) {
    add(new THREE.BoxGeometry(BODY_W * 0.82, 0.03, 0.2), trim, 0, s.deck + 0.08, rearEnd + 0.18);
    for (const x of [-0.55, 0.55]) add(new THREE.BoxGeometry(0.04, 0.08, 0.06), trim, x, s.deck + 0.03, rearEnd + 0.2);
  }

  // Mirrors at the base of the A-pillars.
  for (const side of [-1, 1]) {
    const housing = add(new THREE.SphereGeometry(0.1, 16, 10), paint, side * (BODY_W / 2 + 0.04), s.belt + 0.1, s.ws - 0.22);
    housing.scale.set(1.1, 0.65, 0.55);
    add(new THREE.BoxGeometry(0.12, 0.03, 0.05), trim, side * (BODY_W / 2 - 0.05), s.belt + 0.05, s.ws - 0.2);
  }

  // ---- Lights, grille and plates.
  const lampY = s.nose - 0.12;
  for (const side of [-1, 1]) {
    const h = add(new THREE.BoxGeometry(0.42, 0.09, 0.08), headlamp, side * 0.6, lampY, half - 0.1);
    h.rotation.y = side * -0.18;
  }
  add(new THREE.BoxGeometry(0.62, 0.17, 0.06), trim, 0, lampY - 0.1, half - 0.04);           // grille
  add(new THREE.BoxGeometry(0.66, 0.02, 0.065), darkAlloy, 0, lampY - 0.005, half - 0.035); // grille bar
  // Full-width tail light bar (and the brake lights on each corner).
  const tailY = s.tail === "hatch" ? s.deck - 0.12 : s.deck - 0.1;
  add(new THREE.BoxGeometry(BODY_W - 0.36, 0.035, 0.05), taillamp, 0, tailY, rearEnd + 0.04);
  for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.34, 0.1, 0.06), taillamp, side * 0.66, tailY, rearEnd + 0.05);
  add(new THREE.BoxGeometry(0.42, 0.11, 0.02), plate, 0, s.rocker + 0.28, half + 0.005);
  add(new THREE.BoxGeometry(0.42, 0.11, 0.02), plate, 0, s.rocker + 0.32, rearEnd + 0.01);

  // ---- Wheels: rounded tires, five-spoke alloys, brake discs behind the spokes.
  const R = s.wheelR, TW = 0.25;
  const tireProfile = [
    [R * 0.66, -TW / 2], [R - 0.05, -TW / 2], [R - 0.012, -TW / 2 + 0.03], [R, -TW / 2 + 0.07],
    [R, TW / 2 - 0.07], [R - 0.012, TW / 2 - 0.03], [R - 0.05, TW / 2], [R * 0.66, TW / 2],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const tireGeo = new THREE.LatheGeometry(tireProfile, 40);
  tireGeo.rotateZ(Math.PI / 2);
  const rimR = R * 0.66;
  const barrelGeo = new THREE.CylinderGeometry(rimR, rimR, TW - 0.04, 32, 1, true);
  barrelGeo.rotateZ(Math.PI / 2);
  const faceGeo = new THREE.RingGeometry(rimR * 0.82, rimR, 32);
  faceGeo.rotateY(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(rimR * 0.24, rimR * 0.28, 0.05, 20);
  hubGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.035, rimR * 0.66, 0.07);
  spokeGeo.translate(0, rimR * 0.5, 0);
  const discGeo = new THREE.CylinderGeometry(rimR * 0.78, rimR * 0.78, 0.03, 28);
  discGeo.rotateZ(Math.PI / 2);
  const wheelX = BODY_W / 2 - TW / 2 - 0.06;
  for (const side of [-1, 1]) {
    for (const z of [-s.wb, s.wb]) {
      const wheel = new THREE.Group();
      wheel.position.set(side * wheelX, R, z);
      wheel.rotation.y = side < 0 ? Math.PI : 0; // outer face toward +x on both sides
      car.add(wheel);
      add(tireGeo, rubber, 0, 0, 0, wheel);
      add(barrelGeo, darkAlloy, 0, 0, 0, wheel);
      add(discGeo, darkAlloy, -0.02, 0, 0, wheel);
      add(faceGeo, alloy, TW / 2 - 0.03, 0, 0, wheel);
      add(hubGeo, alloy, TW / 2 - 0.02, 0, 0, wheel);
      for (let i = 0; i < 5; i++) {
        const spoke = add(spokeGeo, alloy, TW / 2 - 0.03, 0, 0, wheel);
        spoke.rotation.x = (i / 5) * Math.PI * 2;
      }
    }
  }

  // Soft contact shadow under the car.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(BODY_W * 1.45, s.len * 1.2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(THREE), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  car.add(shadow);

  return car;
}

// Mounts a 3D car into `host` (the platform element). Returns { destroy } or null.
// Options: spin (auto-rotate, default on), angle (starting yaw in radians) and look (a
// paint/wheels/roof/tint override; otherwise the vehicle's saved appearance is used,
// with `paintColor` as the paint until the owner picks one). The returned handle has
// setLook(look) to repaint live, and destroy().
export async function mountCar3D(host, vehicle, paintColor, { spin = true, angle = 0.6, look = null } = {}) {
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
  // Filmic tone mapping keeps the bright reflections from clipping to flat white.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(THREE, renderer);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7480, 0.45));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.7);
  rim.position.set(-5, 3, -6);
  scene.add(rim);

  const style = bodyStyle(vehicle);
  const place = (c, yaw) => {
    c.scale.setScalar(0.72);
    c.rotation.y = yaw;
    scene.add(c);
    return c;
  };
  const disposeTree = (root) => root.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
  let car = place(buildCar(THREE, style, normalizeLook(look ?? vehicle.appearance, paintColor)), angle);

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
    if (spin && !reduceMotion && !dragging && now > idleUntil) car.rotation.y += dt * 0.5;
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
    // Rebuild the car with a new look, keeping its current angle.
    setLook(next) {
      const yaw = car.rotation.y;
      scene.remove(car);
      disposeTree(car);
      car = place(buildCar(THREE, style, normalizeLook(next, paintColor)), yaw);
      renderer.render(scene, camera);
    },
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
        if (o.material) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
      host.classList.remove("has-3d");
    },
  };
}
