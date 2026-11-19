import { mountReactive } from './reactive.js';
import { view as cardsView } from './service-cards.js';

// The tab lists what was actually received (a presence announcing kind: service, or a sign of life
// from a known service), never a predefined list: the placeholders live on the main page cards only.
function select({ store }) {
  return { services: store.services.received(), now: Date.now() };
}

function view(state) {
  if (!state.services.length) return `<p class="empty">aucun service annoncé pour l'instant</p>`;
  return `<div class="svc-cards svc-tab">${cardsView(state)}</div>`;
}

export default {
  id: 'services',
  title: 'Services',
  select,
  view,
  mount: (el, ctx) => mountReactive(el, ctx, { select, view, intervalMs: 1000 }),
};
