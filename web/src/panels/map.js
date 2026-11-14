import npa from '../data/npa.json';
import { escapeHtml as e } from '../util/escape.js';
import { buildTerritory } from '../state/territory.js';
import { colorsFor } from '../state/colors.js';
import { buildCells, viewBoxFor, zoomBox, panBox } from './map-geometry.js';

const LABELLED_CANTONS = ['VD', 'GE', 'NE', 'FR', 'VS', 'JU', 'BE'];
const REGIONS = [
  ['zones', 'Zones actives'],
  ['suisse', 'Suisse'],
  ['romandie', 'Romandie'],
  ['famille', 'Ma famille'],
];

const hatchId = (color) => `hatch-${color.slice(1)}`;
const nameOf = (families, id) => families.find((f) => f.id === id)?.name ?? id;

function select({ store, options }) {
  const families = store.families.list();
  const myFamily = options.get('myFamily');
  return {
    territory: buildTerritory({ npa, families }),
    colors: colorsFor(families.map((f) => f.id), myFamily),
    myFamily,
    families,
  };
}

/** Class list and fill for one cell. */
function cellStyle(plz, { territory, colors, myFamily }) {
  const owners = territory.owners.get(plz) ?? [];
  const cls = ['npa', ...owners.map((o) => `f-${o}`)];
  if (owners.includes(myFamily)) cls.push('mine');
  if (owners.length === 0) return { cls: [...cls, 'free'], fill: 'var(--cocoa)' };
  if (owners.length > 1) return { cls: [...cls, 'contested'], fill: 'url(#contested)' };
  const c = colors.get(owners[0]);
  return { cls, fill: c ? (c.hatch ? `url(#${hatchId(c.color)})` : c.color) : 'var(--cocoa)' };
}

function defsView({ colors }) {
  const hatched = [...new Set([...colors.values()].filter((c) => c.hatch).map((c) => c.color))];
  const patterns = hatched
    .map(
      (c) =>
        `<pattern id="${e(hatchId(c))}" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="2" fill="${e(c)}" opacity=".35"/><rect width="1" height="2" fill="${e(c)}"/></pattern>`,
    )
    .join('');
  return `<pattern id="ground" width="12" height="10.392" patternUnits="userSpaceOnUse"><path d="M0 0H12M0 0L6 10.392L12 0" fill="none" stroke="rgba(56,245,255,.16)" stroke-width=".25"/></pattern><pattern id="contested" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="2" fill="#3b1f12"/><rect width="1" height="2" fill="#ff4d6d"/></pattern>${patterns}`;
}

function boxOf(region, state, geometry) {
  const mine = [...state.territory.owners].filter(([, o]) => o.includes(state.myFamily)).map(([p]) => p);
  const all = [...state.territory.owners.keys()];
  if (region === 'zones') return viewBoxFor('famille', { geometry, npa, cellsOf: all });
  return viewBoxFor(region, { geometry, npa, cellsOf: mine });
}

/** Square box around the centre of a 'x y w h' viewBox, so a round frame shows the country around the data. */
function squareBox(vb) {
  const [x, y, w, h] = vb.split(/\s+/).map(Number);
  const side = Math.max(w, h) * 0.85;
  return [x + w / 2 - side / 2, y + h / 2 - side / 2, side, side].map((n) => +n.toFixed(2)).join(' ');
}

function svgView(state, { region = 'romandie', compact = false } = {}) {
  const geometry = buildCells(npa);
  const box = compact ? squareBox(boxOf('romandie', state, geometry)) : boxOf(region, state, geometry);
  const paths = [...geometry.cells]
    .map(([plz, d]) => {
      const { cls, fill } = cellStyle(plz, state);
      const owners = state.territory.owners.get(plz) ?? [];
      const title = compact
        ? ''
        : `<title>${e(plz)} ${e(npa.npa[plz][0])}${owners.length ? ' — ' + e(owners.map((o) => nameOf(state.families, o)).join(', ')) : ''}</title>`;
      return `<path class="${e(cls.join(' '))}" data-plz="${e(plz)}" fill="${e(fill)}" d="${e(d)}">${title}</path>`;
    })
    .join('');
  const labels = compact
    ? ''
    : geometry.cantons
        .filter((c) => LABELLED_CANTONS.includes(c.code))
        .map((c) => `<text class="canton" x="${c.x}" y="${c.y}">${e(c.code)}</text>`)
        .join('');
  // Round frame: a faint fake lattice well beyond the data, so the circle never shows a rectangle border.
  const [bx, by, bw, bh] = box.split(/\s+/).map(Number);
  const ground = compact ? `<rect x="${bx - bw}" y="${by - bh}" width="${bw * 3}" height="${bh * 3}" fill="url(#ground)"/>` : '';
  return `<svg class="terr${compact ? ' compact' : ''}" viewBox="${e(box)}" role="img" aria-label="Territoires"><defs>${defsView(state)}</defs>${ground}${paths}${labels}</svg>`;
}

function swatch(c) {
  if (!c) return '<span class="swatch"></span>';
  return `<span class="swatch${c.hatch ? ' hatch' : ''}" style="background:${e(c.color)}"></span>`;
}

function legendView(state) {
  const rows = state.families
    .filter((f) => state.territory.stats.has(f.id))
    .map((f) => {
      const s = state.territory.stats.get(f.id);
      return `<li class="lrow" data-hl="${e(f.id)}">${swatch(state.colors.get(f.id))} <span class="lname">${e(f.name)}</span> <span class="lcount">${e(s.zones)} zones</span> <span class="lcont">${e(s.contested)} contestées</span></li>`;
    })
    .join('');
  const unknown = state.territory.unknown.length
    ? `<div class="unknown"><h3>NPA inconnus</h3><ul>${state.territory.unknown
        .map((u) => `<li>${e(u.plz)} — ${e(u.owners.map((o) => nameOf(state.families, o)).join(', '))}</li>`)
        .join('')}</ul></div>`
    : '';
  const css = state.families
    .map((f) => `svg.terr[data-hl="${e(f.id)}"] .npa:not(.f-${e(f.id)}){opacity:.12}`)
    .join('');
  return `<style>${css}</style><ul class="legend">${rows}<li class="lrow static"><span class="swatch contested"></span> Contestée</li><li class="lrow static"><span class="swatch free"></span> Libre</li></ul>${unknown}<p class="credit">Données NPA © swisstopo</p>`;
}

function zoomBarView() {
  return '<span class="zoom"><button type="button" data-zoom="in" aria-label="Zoom avant">+</button><button type="button" data-zoom="out" aria-label="Zoom arrière">−</button><button type="button" data-zoom="reset" aria-label="Recentrer">⌂</button></span>';
}

function barView(region) {
  return REGIONS.map(([id, label]) => `<button type="button" data-region="${id}" class="${id === region ? 'on' : ''}">${e(label)}</button>`).join('');
}

function view(state) {
  const region = state.region ?? 'romandie';
  return `<div class="map"><div class="map-bar">${barView(region)}${zoomBarView()}</div><div class="map-svg">${svgView(state, { region })}</div><div class="map-legend">${legendView(state)}</div></div>`;
}

const raf = (cb) => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(cb) : setTimeout(cb, 16));

const signature = (s) =>
  JSON.stringify([s.myFamily, s.families.map((f) => [f.id, f.name, f.zone, f.state])]);

/** Re-renders only when the territory data changed, and only touches fill/class of existing cells. */
function mountMap(el, ctx, { compact }) {
  let region = 'romandie';
  let box = null;
  let touched = false; // the user zoomed or panned: incoming messages must not reset the view
  let pinned = null;
  let lastSig = '';
  let frame = 0;
  let stopped = false;

  const svgOf = () => el.querySelector('svg.terr');

  function build(state) {
    el.innerHTML = compact
      ? svgView(state, { compact: true })
      : `<div class="map"><div class="map-bar">${barView(region)}${zoomBarView()}</div><div class="map-svg">${svgView(state, { region })}</div><div class="map-legend">${legendView(state)}</div></div>`;
  }

  function update() {
    frame = 0;
    if (stopped) return;
    const state = select(ctx);
    const sig = signature(state);
    if (sig === lastSig) return;
    const first = !lastSig;
    lastSig = sig;
    if (first || !svgOf()) return build(state);
    const svg = svgOf();
    svg.querySelector('defs').innerHTML = defsView(state);
    for (const path of svg.querySelectorAll('path.npa')) {
      const { cls, fill } = cellStyle(path.dataset.plz, state);
      path.setAttribute('class', cls.join(' '));
      path.setAttribute('fill', fill);
    }
    if (!compact) {
      const legend = el.querySelector('.map-legend');
      const top = legend.scrollTop; // keep the legend scroll position across refreshes
      legend.innerHTML = legendView(state);
      legend.scrollTop = top;
    }
    if (!touched) applyRegion(state); // auto-fit only while the user has not taken control
  }

  function applyRegion(state = select(ctx)) {
    const svg = svgOf();
    if (!svg) return;
    touched = false;
    const vb = compact ? squareBox(boxOf('romandie', state, buildCells(npa))) : boxOf(region, state, buildCells(npa));
    box = vb.split(/\s+/).map(Number);
    svg.setAttribute('viewBox', vb);
  }

  const fullBox = () => buildCells(npa).viewBox.split(/\s+/).map(Number);
  function setBox(next) {
    touched = true;
    box = next;
    svgOf()?.setAttribute('viewBox', next.map((n) => +n.toFixed(2)).join(' '));
  }
  const fractionOf = (ev) => {
    const r = svgOf().getBoundingClientRect();
    // the SVG is letterboxed (xMidYMid meet): convert through the real drawn rectangle
    const scale = Math.min(r.width / box[2], r.height / box[3]);
    const dw = box[2] * scale;
    const dh = box[3] * scale;
    return [clamp01((ev.clientX - r.left - (r.width - dw) / 2) / dw), clamp01((ev.clientY - r.top - (r.height - dh) / 2) / dh), scale];
  };
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const zoomBy = (factor, fx = 0.5, fy = 0.5) => box && setBox(zoomBox(box, factor, fx, fy, { full: fullBox() }));
  let drag = null;
  const onWheel = (ev) => {
    if (!svgOf() || !ev.target.closest?.('svg.terr')) return;
    ev.preventDefault();
    const [fx, fy] = fractionOf(ev);
    zoomBy(ev.deltaY < 0 ? 1.25 : 0.8, fx, fy);
  };
  const onDown = (ev) => {
    if (!ev.target.closest?.('svg.terr') || ev.button !== 0) return;
    drag = { x: ev.clientX, y: ev.clientY };
    svgOf().classList.add('grab');
    ev.target.setPointerCapture?.(ev.pointerId);
  };
  const onMove = (ev) => {
    if (!drag) return;
    const [, , scale] = fractionOf(ev);
    const dx = (drag.x - ev.clientX) / scale;
    const dy = (drag.y - ev.clientY) / scale;
    drag = { x: ev.clientX, y: ev.clientY };
    setBox(panBox(box, dx / box[2], dy / box[3], { full: fullBox() }));
  };
  const onUp = () => {
    drag = null;
    svgOf()?.classList.remove('grab');
  };
  const onDbl = (ev) => {
    if (ev.target.closest?.('svg.terr')) applyRegion();
  };

  const schedule = () => {
    if (!frame && !stopped) frame = raf(update);
  };

  const onClick = (ev) => {
    const z = ev.target.closest?.('[data-zoom]');
    if (z) {
      if (z.dataset.zoom === 'reset') return applyRegion();
      return zoomBy(z.dataset.zoom === 'in' ? 1.6 : 1 / 1.6);
    }
    const btn = ev.target.closest?.('[data-region]');
    if (btn) {
      region = btn.dataset.region;
      el.querySelectorAll('[data-region]').forEach((b) => b.classList.toggle('on', b === btn));
      return applyRegion();
    }
    const row = ev.target.closest?.('[data-hl]');
    if (row) {
      pinned = pinned === row.dataset.hl ? null : row.dataset.hl;
      if (pinned) svgOf()?.setAttribute('data-hl', pinned);
      else svgOf()?.removeAttribute('data-hl');
    }
  };
  const onOver = (ev) => {
    const row = ev.target.closest?.('[data-hl]');
    if (row && !pinned) svgOf()?.setAttribute('data-hl', row.dataset.hl);
  };
  const onOut = (ev) => {
    if (ev.target.closest?.('[data-hl]') && !pinned) svgOf()?.removeAttribute('data-hl');
  };

  update();
  const offs = [ctx.store.subscribe(schedule), ctx.options.subscribe(schedule)];
  if (!compact) {
    el.addEventListener('click', onClick);
    el.addEventListener('mouseover', onOver);
    el.addEventListener('mouseout', onOut);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('dblclick', onDbl);
  }
  return () => {
    stopped = true;
    offs.forEach((off) => off());
    el.removeEventListener('click', onClick);
    el.removeEventListener('mouseover', onOver);
    el.removeEventListener('mouseout', onOut);
    for (const [t, f] of [['wheel', onWheel], ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['dblclick', onDbl]])
      el.removeEventListener(t, f);
  };
}

export const mountCompact = (el, ctx) => mountMap(el, ctx, { compact: true });

export default {
  id: 'map',
  title: 'Carte',
  select,
  view,
  mount: (el, ctx) => mountMap(el, ctx, { compact: false }),
};
