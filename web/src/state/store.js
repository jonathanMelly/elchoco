import { TOPIC_TYPES, parseTopic, parseMessage, validatePayload, isHeartbeat } from './protocol.js';
import { createFamilies } from './families.js';
import { createClock } from './clock.js';

const LOG_LIMIT = 200;
const RAW_LIMIT = 200;
const LEVELS = new Set(['info', 'warn', 'error']);

/** Rebuilds the persisted activity list; anything malformed is dropped, never thrown. */
export function restoreActivity(json) {
  try {
    const list = JSON.parse(json);
    if (!Array.isArray(list)) return [];
    return list
      .filter((a) => a && typeof a.from === 'string' && typeof a.text === 'string' && LEVELS.has(a.level) && Number.isFinite(a.receivedAt))
      .slice(-LOG_LIMIT)
      .map(({ from, level, text, receivedAt }) => ({ from, level, text, receivedAt }));
  } catch {
    return [];
  }
}

const PRESENCE_TEXT = {
  open: ['info', 'ouverte pour les affaires'],
  closed: ['warn', 'fermée (rideau baissé)'],
  died: ['error', 'morte (dernière volonté reçue)'],
};

export function createStore({ root = 'elchoco', now = Date.now } = {}) {
  const families = createFamilies();
  const clock = createClock({ now });
  const listeners = new Set();
  const store = {
    families,
    clock,
    log: [], // published by the families on elchoco/log/<famille>
    activity: [], // observed by this console (not a journal service)
    rejected: 0,
    lastRejected: null,
    seenKinds: new Set(),
    ingest,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  const notify = () => {
    for (const fn of [...listeners]) fn();
  };

  function record(from, level, text, receivedAt) {
    store.activity.push({ from, level, text, receivedAt });
    if (store.activity.length > LOG_LIMIT) store.activity.splice(0, store.activity.length - LOG_LIMIT);
  }

  function reject(topic, raw, reason) {
    record(topic, 'warn', `message rejeté : ${reason}`, now());
    store.rejected++;
    store.lastRejected = { topic, reason, raw: String(raw).slice(0, RAW_LIMIT) };
    notify();
  }

  function ingest(topic, raw, { receivedAt = now(), retain = false } = {}) {
    try {
      const t = parseTopic(root, topic);
      if (t.kind === 'other') return;
      if (t.kind === 'unknown') {
        if (t.sub) store.seenKinds.add(t.sub);
        notify();
        return;
      }
      if (raw === '') return;

      const msg = parseMessage(raw);
      if (!msg.ok) return reject(topic, raw, msg.reason);
      const { env } = msg;
      if (env.type !== TOPIC_TYPES[t.kind]) return reject(topic, raw, 'type incompatible avec le topic');
      if (t.kind !== 'time' && env.from !== t.family) return reject(topic, raw, 'from différent du topic');
      const checked = validatePayload(env.type, env.payload);
      if (!checked.ok) return reject(topic, raw, checked.reason);
      const value = checked.value;

      if (!retain) clock.observeNode(env.from, env.ts, receivedAt);

      if (t.kind === 'vitrine' || t.kind === 'presence') {
        const before = families.get(t.family);
        families.apply(t.kind, t.family, value, receivedAt);
        if (!before) record(t.family, 'info', 'apparue sur le réseau', receivedAt);
        if (t.kind === 'presence' && before?.state !== value.state && PRESENCE_TEXT[value.state]) {
          const [level, text] = PRESENCE_TEXT[value.state];
          record(t.family, level, text, receivedAt);
        }
      } else if (t.kind === 'time') {
        if (!retain) clock.observeTime(value.utc, receivedAt);
      } else if (t.kind === 'log') {
        families.touch(t.family, receivedAt);
        if (!isHeartbeat(value) && !value.text.startsWith('hb')) {
          store.log.push({ from: env.from, level: value.level, text: value.text, ts: env.ts, receivedAt });
          if (store.log.length > LOG_LIMIT) store.log.splice(0, store.log.length - LOG_LIMIT);
        }
      }

      store.seenKinds.add(t.kind);
      notify();
    } catch (err) {
      reject(topic, raw, String(err?.message ?? err));
    }
  }

  return store;
}
