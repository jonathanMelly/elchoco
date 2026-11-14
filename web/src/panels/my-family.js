import { escapeHtml as e } from '../util/escape.js';
import { donName, formatCapital, formatSkew } from './format.js';
import { mountReactive } from './reactive.js';

function select({ store, options }) {
  const myFamily = options.get('myFamily');
  return { family: store.families.get(myFamily), myFamily, skew: store.clock.nodeSkew(myFamily) };
}

function view({ family, myFamily, skew }) {
  if (!family) return `<div class="myfamily unknown"><h2>famille inconnue : ${e(myFamily)}</h2></div>`;
  const s = formatSkew(skew);
  return `<div class="myfamily"><h2>${e(family.name)}</h2><dl>
<dt>patrón</dt><dd>${e(donName(family.id))}</dd>
<dt>capital</dt><dd>${e(formatCapital(family.capital))} CHF</dd>
<dt>siège</dt><dd>${e(family.capitalCity || '—')}</dd>
<dt>zone</dt><dd>${e(family.zone.length)} NPA</dd>
<dt>cacao</dt><dd>${e(family.cacao.join(', ') || '—')}</dd>
<dt>star</dt><dd>${e(family.bestProduct || '—')}</dd>
${s ? `<dt>décalage</dt><dd>${e(s)}</dd>` : ''}</dl></div>`;
}

export default {
  id: 'my-family',
  title: 'Ma famille',
  select,
  view,
  mount: (el, ctx) => mountReactive(el, ctx, { select, view }),
};
