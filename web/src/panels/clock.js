import { escapeHtml as e } from '../util/escape.js';
import { formatOffset, formatTime } from './format.js';
import { mountReactive } from './reactive.js';

const LABEL = { synced: 'CARTEL', stale: 'PÉRIMÉE', local: 'LOCALE' };

function select({ store }) {
  return { now: store.clock.cartelNow(), status: store.clock.status(), offset: store.clock.offset() };
}

function view({ now, status, offset }) {
  return `<div class="clock"><div class="clock-time">${e(formatTime(now))}</div><div class="clock-status"><span class="light ${e(status)}"></span> ${e(LABEL[status] ?? status)} <span class="offset">${e(formatOffset(offset))}</span></div></div>`;
}

export default {
  id: 'clock',
  title: 'Horloge',
  select,
  view,
  mount: (el, ctx) => mountReactive(el, ctx, { select, view, intervalMs: 1000 }),
};
