import { escapeHtml as e } from '../util/escape.js';
import { mountReactive } from './reactive.js';

// One line per service. A service with a `kind` turns active when that topic root shows up.
export const SERVICE_SLOTS = [
  { id: 'horloge', label: 'Horloge', active: (s) => s.clockStatus !== 'local' },
  { id: 'annuaire', label: 'Annuaire', kind: 'annuaire' },
  { id: 'journal', label: 'Journal', kind: 'journal' },
  { id: 'caisse', label: 'Caisse', kind: 'caisse' },
  { id: 'marche', label: 'Marché', kind: 'marche' },
  { id: 'moniteur', label: 'Moniteur', kind: 'moniteur' },
];

const isActive = (slot, s) => (slot.active ? slot.active(s) : s.seenKinds.includes(slot.kind));

function select({ store }) {
  return { clockStatus: store.clock.status(), logCount: store.log.length, seenKinds: [...store.seenKinds] };
}

function view(state) {
  const slots = SERVICE_SLOTS.map((slot) => {
    const on = isActive(slot, state);
    return `<li class="slot ${on ? 'active' : 'waiting'}" data-id="${e(slot.id)}"><span class="light ${on ? 'synced' : 'off'}"></span><span class="slabel">${e(slot.label)}</span> <span class="sstate">${on ? 'ACTIF' : 'EN ATTENTE DU SERVICE'}</span></li>`;
  }).join('');
  return `<ul class="slots">${slots}</ul>`;
}

export default {
  id: 'services',
  title: 'Services',
  select,
  view,
  mount: (el, ctx) => mountReactive(el, ctx, { select, view, intervalMs: 1000 }),
};
