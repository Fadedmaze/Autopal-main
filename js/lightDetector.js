// On-device detection of glowing dashboard symbols, fast enough to run on every
// few camera frames. It finds bright, saturated red/amber/green/blue blobs (plus
// white ones in a dark cabin), merges strokes that belong to one symbol, and
// returns boxes in normalized frame coordinates (0..1). It does not know WHICH
// light a blob is; naming happens server-side (identify-warning-lights).

const HUES = { red: 1, amber: 2, green: 3, blue: 4, white: 5 };
export const COLOR_NAMES = ["", "red", "amber", "green", "blue", "white"];

export function detectLights(imageData, { maxBoxes = 10 } = {}) {
  const { data, width: W, height: H } = imageData;
  const N = W * H;

  // Scene brightness decides how bright a pixel must be to count as "lit".
  let lumSum = 0;
  for (let i = 0; i < N; i += 4) {
    const p = i * 4;
    lumSum += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  const meanLum = lumSum / Math.ceil(N / 4);
  const litThreshold = Math.max(140, meanLum + 70);
  const allowWhite = meanLum < 90; // white symbols only stand out in a dim cabin

  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < litThreshold) continue;
    const sat = (max - min) / max;
    if (sat < 0.4) {
      if (allowWhite && sat < 0.18 && max > Math.max(215, meanLum + 110)) mask[i] = HUES.white;
      continue;
    }
    let h;
    const d = max - min;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    if (h < 18 || h >= 335) mask[i] = HUES.red;
    else if (h < 68) mask[i] = HUES.amber;
    else if (h >= 75 && h < 170) mask[i] = HUES.green;
    else if (h >= 185 && h < 265) mask[i] = HUES.blue;
  }

  // Connected components (4-neighbour) per color class.
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  let blobs = [];
  for (let start = 0; start < N; start++) {
    const color = mask[start];
    if (!color || seen[start]) continue;
    let top = 0, count = 0;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const i = stack[--top];
      const x = i % W, y = (i / W) | 0;
      count++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !seen[i - 1] && mask[i - 1] === color) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < W - 1 && !seen[i + 1] && mask[i + 1] === color) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && !seen[i - W] && mask[i - W] === color) { seen[i - W] = 1; stack[top++] = i - W; }
      if (y < H - 1 && !seen[i + W] && mask[i + W] === color) { seen[i + W] = 1; stack[top++] = i + W; }
    }
    if (count >= 3) blobs.push({ x0, y0, x1, y1, count, color });
  }

  // Merge nearby blobs of the same color: one symbol is often several strokes,
  // like the "(", "!" and ")" of the brake light.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let a = 0; a < blobs.length; a++) {
      for (let b = a + 1; b < blobs.length; b++) {
        const A = blobs[a], B = blobs[b];
        if (A.color !== B.color) continue;
        const gap = Math.max(3, 0.5 * Math.max(A.x1 - A.x0, A.y1 - A.y0, B.x1 - B.x0, B.y1 - B.y0));
        if (A.x0 - gap <= B.x1 && B.x0 - gap <= A.x1 && A.y0 - gap <= B.y1 && B.y0 - gap <= A.y1) {
          blobs[a] = {
            x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0),
            x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1),
            count: A.count + B.count, color: A.color,
          };
          blobs.splice(b, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  const maxSide = 0.3 * Math.min(W, H);
  blobs = blobs.filter((bl) => {
    const w = bl.x1 - bl.x0 + 1, h = bl.y1 - bl.y0 + 1;
    const aspect = w / h;
    return w >= 4 && h >= 4 && w <= maxSide && h <= maxSide &&
      aspect > 0.25 && aspect < 4 && bl.count / (w * h) >= 0.08;
  });
  blobs.sort((a, b) => b.count - a.count);

  return blobs.slice(0, maxBoxes).map((bl) => ({
    x: bl.x0 / W, y: bl.y0 / H,
    w: (bl.x1 - bl.x0 + 1) / W, h: (bl.y1 - bl.y0 + 1) / H,
    color: COLOR_NAMES[bl.color],
  }));
}

function iou(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}

// Keeps boxes steady between frames: a box shows after 2 sightings, glides toward
// new positions instead of jumping, and lingers briefly if a frame misses it.
export class BoxTracker {
  constructor() {
    this.tracks = [];
    this.nextId = 1;
  }

  update(boxes) {
    const used = new Set();
    for (const t of this.tracks) {
      let best = null, bestScore = 0.15;
      boxes.forEach((b, i) => {
        if (used.has(i) || b.color !== t.color) return;
        const s = iou(t, b);
        if (s > bestScore) { best = i; bestScore = s; }
      });
      if (best === null) {
        t.misses++;
      } else {
        used.add(best);
        const b = boxes[best];
        for (const k of ["x", "y", "w", "h"]) t[k] += (b[k] - t[k]) * 0.5;
        t.hits++;
        t.misses = 0;
      }
    }
    boxes.forEach((b, i) => {
      if (!used.has(i)) this.tracks.push({ ...b, id: this.nextId++, hits: 1, misses: 0 });
    });
    this.tracks = this.tracks.filter((t) => t.misses <= 3);
    return this.visible();
  }

  visible() {
    return this.tracks.filter((t) => t.hits >= 2).map(({ id, x, y, w, h, color }) => ({ id, x, y, w, h, color }));
  }

  reset() {
    this.tracks = [];
  }
}
