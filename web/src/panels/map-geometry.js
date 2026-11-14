import { Delaunay } from 'd3-delaunay';

const cache = new WeakMap();
const r2 = (n) => Math.round(n * 100) / 100;

/** Sutherland–Hodgman: clips a polygon against a convex clip polygon (counter-clockwise in y-up, any consistent winding). */
function clip(subject, clipPoly) {
  // Orientation of the clip polygon, so "inside" is on the same side whatever the winding.
  let area = 0;
  for (let i = 0; i < clipPoly.length; i++) {
    const [x1, y1] = clipPoly[i];
    const [x2, y2] = clipPoly[(i + 1) % clipPoly.length];
    area += x1 * y2 - x2 * y1;
  }
  const sign = area >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clipPoly.length && out.length; i++) {
    const [ax, ay] = clipPoly[i];
    const [bx, by] = clipPoly[(i + 1) % clipPoly.length];
    const side = ([x, y]) => sign * ((bx - ax) * (y - ay) - (by - ay) * (x - ax));
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const sc = side(cur);
      const sp = side(prev);
      if (sc >= 0) {
        if (sp < 0) out.push(intersect(prev, cur, sp, sc));
        out.push(cur);
      } else if (sp >= 0) {
        out.push(intersect(prev, cur, sp, sc));
      }
    }
  }
  return out;
}

function intersect(p, q, sp, sq) {
  const t = sp / (sp - sq);
  return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
}

const toPath = (poly) => `M${poly.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`;

/** One Voronoi cell per postcode, clipped to a disc, in km (x = E, y = -N). Memoised per dataset. */
export function buildCells(npa, { clipKm = 3, sides = 16, marginKm = 5 } = {}) {
  if (cache.has(npa)) return cache.get(npa);

  const entries = Object.entries(npa.npa);
  const minE = Math.min(...entries.map(([, v]) => v[3]));
  const maxE = Math.max(...entries.map(([, v]) => v[3]));
  const minN = Math.min(...entries.map(([, v]) => v[4]));
  const maxN = Math.max(...entries.map(([, v]) => v[4]));
  const w = maxE - minE;
  const h = maxN - minN;

  const points = new Map(entries.map(([plz, v]) => [plz, [r2(v[3] - minE), r2(maxN - v[4])]]));
  const flat = entries.map(([plz]) => points.get(plz));
  const voronoi = Delaunay.from(flat).voronoi([-marginKm, -marginKm, w + marginKm, h + marginKm]);

  const cells = new Map();
  entries.forEach(([plz], i) => {
    const [px, py] = points.get(plz);
    const disc = Array.from({ length: sides }, (_, k) => {
      const a = (2 * Math.PI * k) / sides;
      return [px + clipKm * Math.cos(a), py + clipKm * Math.sin(a)];
    });
    const cell = voronoi.cellPolygon(i);
    // cellPolygon closes the ring (last point repeats the first).
    const poly = cell ? clip(cell.slice(0, -1), disc) : disc;
    cells.set(plz, toPath(poly.length >= 3 ? poly : disc));
  });

  const byCanton = new Map();
  for (const [plz, v] of entries) {
    const [x, y] = points.get(plz);
    const c = byCanton.get(v[1]) ?? { sx: 0, sy: 0, n: 0 };
    c.sx += x;
    c.sy += y;
    c.n++;
    byCanton.set(v[1], c);
  }
  const cantons = [...byCanton].map(([code, c]) => ({ code, x: r2(c.sx / c.n), y: r2(c.sy / c.n) }));

  const geometry = {
    viewBox: `${-marginKm} ${-marginKm} ${r2(w + 2 * marginKm)} ${r2(h + 2 * marginKm)}`,
    cells,
    cantons,
    points,
  };
  cache.set(npa, geometry);
  return geometry;
}

function bboxViewBox(plzs, geometry, padKm = 5) {
  const pts = plzs.map((p) => geometry.points.get(p)).filter(Boolean);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs) - padKm;
  const y = Math.min(...ys) - padKm;
  return `${r2(x)} ${r2(y)} ${r2(Math.max(...xs) + padKm - x)} ${r2(Math.max(...ys) + padKm - y)}`;
}

export function viewBoxFor(region, { geometry, npa, cellsOf = [] }) {
  if (region === 'suisse') return geometry.viewBox;
  const romandie = () =>
    bboxViewBox(
      Object.keys(npa.npa).filter((p) => npa.npa[p][2] === 'fr'),
      geometry,
    ) ?? geometry.viewBox;
  if (region === 'famille') return bboxViewBox(cellsOf, geometry) ?? romandie();
  return romandie();
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function keepInside([x, y, w, h], full) {
  if (!full) return [x, y, w, h];
  return [clamp(x, full[0], full[0] + full[2] - w), clamp(y, full[1], full[1] + full[3] - h), w, h];
}

/** Zoom a [x, y, w, h] box by `factor` (>1 zooms in) keeping the point at fraction (fx, fy) fixed. */
export function zoomBox([x, y, w, h], factor, fx, fy, { full, maxZoom = 40 } = {}) {
  let nw = w / factor;
  if (full) nw = clamp(nw, full[2] / maxZoom, full[2]);
  const nh = (h * nw) / w;
  return keepInside([x + fx * w - fx * nw, y + fy * h - fy * nh, nw, nh], full);
}

/** Pan a box by (dx, dy) expressed as fractions of its own size. */
export function panBox([x, y, w, h], dx, dy, { full } = {}) {
  return keepInside([x + dx * w, y + dy * h, w, h], full);
}
