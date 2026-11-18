import { escapeHtml as e } from '../util/escape.js';
import { donName, formatCapital, formatSkew } from './format.js';
import { mountReactive } from './reactive.js';
import { colorsFor } from '../state/colors.js';

// Same colour as on the map; the CSS custom property is read by the dot and the ring node.
const colorStyle = (colors, id) => (colors?.get(id) ? ` style="--c:${e(colors.get(id).color)}"` : '');

const STATE_CLASS = { open: 'up', closed: 'down', died: 'down', unknown: 'unknown' };
const STATE_LABEL = { open: 'ouverte', closed: 'fermée', died: 'tombée', unknown: 'inconnue' };

function select({ store, options }) {
  const list = store.families.list();
  return {
    families: list,
    myFamily: options.get('myFamily'),
    colors: colorsFor(list.map((f) => f.id), options.get('myFamily')),
    skews: Object.fromEntries(list.map((f) => [f.id, store.clock.nodeSkew(f.id)])),
  };
}

function view({ families, myFamily, skews, colors }) {
  if (!families.length) return '<p class="empty">aucune famille connue pour l\'instant</p>';
  const items = families
    .map((f) => {
      const cls = ['family', STATE_CLASS[f.state] ?? 'unknown', f.id === myFamily ? 'mine' : ''].filter(Boolean).join(' ');
      const skew = formatSkew(skews[f.id]);
      return `<li class="${e(cls)}" data-id="${e(f.id)}"${colorStyle(colors, f.id)}><span class="dot"></span><span class="fname">${e(f.name)}</span> <span class="fstate">${e(STATE_LABEL[f.state] ?? f.state)}</span>${skew ? ` <span class="skew">${e(skew)}</span>` : ''}</li>`;
    })
    .join('');
  return `<ul class="families">${items}</ul>`;
}

/** Compact ring of the families, plain SVG. */
export function ringView({ families, myFamily, colors }) {
  // A fallen family loses its square (it stays in the list and the legend); the others are re-spaced.
  const alive = families.filter((f) => f.state !== 'died');
  const n = alive.length;
  const R = 80;
  const nodes = alive
    .map((f, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = (100 + R * Math.cos(a)).toFixed(1);
      const y = (100 + R * Math.sin(a)).toFixed(1);
      const cls = ['node', STATE_CLASS[f.state] ?? 'unknown', f.id === myFamily ? 'mine' : ''].filter(Boolean).join(' ');
      const c = Math.cos(a);
      const s = Math.sin(a);
      const lx = (100 + (R + 13) * c).toFixed(1);
      const ly = (100 + (R + 13) * s + (Math.abs(c) <= 0.35 ? (s > 0 ? 4 : -1) : 1.5)).toFixed(1);
      const anchor = c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle';
      return `<g class="${e(cls)}" data-id="${e(f.id)}"${colorStyle(colors, f.id)}><title>${e(f.name)}</title><rect x="${(x - 7).toFixed(1)}" y="${(y - 7).toFixed(1)}" width="14" height="14" rx="2"/><text class="rlabel" x="${lx}" y="${ly}" text-anchor="${anchor}">${e(f.name)}</text></g>`;
    })
    .join('');
  return `<svg class="ring" viewBox="0 0 200 200" role="img" aria-label="Anneau des familles"><circle cx="100" cy="100" r="${R}" class="ring-line"/>${nodes}</svg>`;
}

/** Detail card of one family, opened by a click on its square. */
export function detailView({ family, myFamily, skew, color }) {
  if (!family) return '<p class="empty">famille inconnue (elle a peut-être disparu)</p>';
  const s = formatSkew(skew);
  const mine = family.id === myFamily ? ' <span class="badge">ma famille</span>' : '';
  return `<div class="fdetail" style="--c:${e(color ?? '#ffb13b')}"><h3><span class="dot"></span>${e(family.name)}${mine}</h3><dl>
<dt>patrón</dt><dd>${e(donName(family.id))}</dd>
<dt>état</dt><dd>${e(STATE_LABEL[family.state] ?? family.state)}</dd>
<dt>capital</dt><dd>${e(formatCapital(family.capital))} CHF</dd>
<dt>siège</dt><dd>${e(family.capitalCity || '—')}</dd>
<dt>cacao</dt><dd>${e(family.cacao.join(', ') || '—')}</dd>
<dt>star</dt><dd>${e(family.bestProduct || '—')}</dd>
<dt>zone</dt><dd>${e(family.zone.length)} NPA${family.zone.length ? ' : ' + family.zone.map((z) => e(z)).join(' ') : ''}</dd>
${s ? `<dt>décalage</dt><dd>${e(s)}</dd>` : ''}</dl></div>`;
}

/** Live detail of one family (updates while the pane is open). */
export function mountFamilyDetail(el, ctx, id) {
  const sel = ({ store, options }) => {
    const list = store.families.list();
    const myFamily = options.get('myFamily');
    return {
      family: store.families.get(id),
      myFamily,
      skew: store.clock.nodeSkew(id),
      color: colorsFor(list.map((f) => f.id), myFamily).get(id)?.color,
    };
  };
  return mountReactive(el, ctx, { select: sel, view: detailView });
}

export default {
  id: 'families',
  title: 'Familles',
  select,
  view,
  mount: (el, ctx) => mountReactive(el, ctx, { select, view }),
};
