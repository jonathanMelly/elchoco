import { escapeHtml as e } from '../util/escape.js';
import { mountReactive } from './reactive.js';
import { formatDateTime } from './format.js';

function select({ store, options }) {
  return {
    entries: store.log,
    activity: store.activity,
    rawLog: options.get('rawLog'),
    rejected: store.rejected,
    lastRejected: store.lastRejected,
  };
}

function row(x, src) {
  const tag = src === 'activity' ? 'observé' : 'publié';
  return `<li class="entry ${e(x.level)} ${src}"><time class="at">${e(formatDateTime(x.receivedAt))}</time> <span class="src">${tag}</span> <span class="from">${e(x.from)}</span> <span class="level">${e(x.level)}</span> ${e(x.text)}</li>`;
}

function view({ entries, activity = [], rawLog, rejected, lastRejected }) {
  const rows = [
    ...entries.map((x) => ({ x, src: 'log' })),
    ...activity.map((x) => ({ x, src: 'activity' })),
  ]
    .sort((p, q) => q.x.receivedAt - p.x.receivedAt)
    .slice(0, 100)
    .map(({ x, src }) => row(x, src))
    .join('');
  const raw = rawLog && lastRejected ? `<pre class="raw">${e(lastRejected.topic)} — ${e(lastRejected.reason)}
${e(lastRejected.raw)}</pre>` : '';
  return `<p class="note">Journal local : ce que cette console a vu passer (observé) et ce que les familles ont publié (publié). Ce n'est pas un service de journal ; l'historique observé est gardé dans ce navigateur.</p><div class="rejected">messages rejetés : <strong>${e(rejected)}</strong></div>${raw}<ul class="log">${rows}</ul>`;
}

export default {
  id: 'log',
  title: 'Journal local',
  select,
  view,
  mount: (el, ctx) => mountReactive(el, ctx, { select, view }),
};
