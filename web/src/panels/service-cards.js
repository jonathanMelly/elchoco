import { escapeHtml as e } from '../util/escape.js';
import { mountReactive } from './reactive.js';

const STATE = {
  open: ['up', 'EN LIGNE'],
  closed: ['down', 'À L’ARRÊT'],
  died: ['down', 'TOMBÉ'],
  unknown: ['waiting', 'EN ATTENTE'],
};

const ago = (ms) => (ms < 1500 ? 'à l’instant' : ms < 60000 ? `il y a ${Math.round(ms / 1000)} s` : `il y a ${Math.round(ms / 60000)} min`);

const pad = (n) => String(n).padStart(2, '0');
const hhmmss = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Figures per service, as [label, value] rows; a service without data yet shows none. */
export function statRows(s) {
  const st = s.stats ?? {};
  switch (s.id) {
    case 'time':
      return st.utc ? [['dernier tick', hhmmss(st.utc)]] : [];
    case 'registry':
      return st.entries === undefined ? [] : [['annuaire', `${plural(st.entries, 'entrée', 'entrées')} (${st.open} ${st.open === 1 ? 'ouverte' : 'ouvertes'})`]];
    case 'dispatch':
      return st.pending === undefined ? [] : [['en cours', String(st.pending)], ['réservées', String(st.reserved)], ['échouées', String(st.failed)]];
    default:
      return [];
  }
}

function select({ store }) {
  return { services: store.services.list(), now: Date.now() };
}

/** Small cards, one per elchoco-common microservice, reacting to its presence. */
export function view({ services, now }) {
  return services
    .map((s) => {
      const [cls, label] = STATE[s.state] ?? STATE.unknown;
      const rows = statRows(s).map(([k, v]) => `<div class="svc-stat"><span>${e(k)}</span><b>${e(v)}</b></div>`).join('');
      const seen = s.lastSeen ? ago(now - s.lastSeen) : '—';
      return `<div class="svc-card ${cls}" data-id="${e(s.id)}"><span class="light ${cls === 'up' ? 'synced' : cls === 'down' ? 'local' : 'off'}"></span><div class="svc-body"><div class="svc-name">${e(s.label)}</div><div class="svc-role">${e(s.role)}</div><div class="svc-state">${label} <span class="svc-seen">${e(seen)}</span></div>${rows}</div></div>`;
    })
    .join('');
}

export const mountServiceCards = (el, ctx) => mountReactive(el, ctx, { select, view, intervalMs: 1000 });
