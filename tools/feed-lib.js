import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TOPIC_TYPES, SLUG_RE, parseMessage, validatePayload } from '../web/src/state/protocol.js';
import { collectFamilies, slug as slugify } from './convert-lib.js';

// QoS and retain per kind, from the contract digest.
const DELIVERY = {
  vitrine: { qos: 1, retain: true },
  presence: { qos: 1, retain: true },
  time: { qos: 0, retain: false },
  log: { qos: 0, retain: false },
};

/** Contract envelope; key order as in the contract. */
export function envelope({ from, type, payload, ts = new Date(), to = '*' }) {
  return { v: 1, id: randomUUID(), from, to, ts: ts.toISOString(), type, payload };
}

/** Builds a message and checks its own output: a bug here must never reach the broker. */
export function message(root, kind, slug, payload, { ts, to } = {}) {
  const type = TOPIC_TYPES[kind];
  const delivery = DELIVERY[kind];
  if (!type || !delivery) throw new Error(`kind inconnu : ${kind}`);
  if (!SLUG_RE.test(slug)) throw new Error(`identifiant invalide : ${slug}`);

  const topic = kind === 'time' ? `${root}/time` : `${root}/${kind}/${slug}`;
  const json = JSON.stringify(envelope({ from: slug, type, payload, ts, to }));

  const parsed = parseMessage(json);
  if (!parsed.ok) throw new Error(`message invalide : ${parsed.reason}`);
  const checked = validatePayload(type, parsed.env.payload);
  if (!checked.ok) throw new Error(`payload invalide : ${checked.reason}`);
  if (parsed.env.from !== slug) throw new Error('from différent du topic');

  return { topic, json, ...delivery };
}

export const heartbeatText = (sent) => `hb sent=${sent}`;

/**
 * Families to publish. `common` converts elchoco-common in memory, `data` reads the committed
 * snapshot. Only valid payloads are returned, sorted by slug; problems go to `onProblem`.
 */
export function loadFamilies({ source = 'common', common, dataDir, npa, fs, onProblem = () => {} }) {
  if (source === 'common') {
    const out = [];
    for (const f of collectFamilies({ common, npa, ...fs })) {
      if (f.payload) out.push(f);
      else onProblem(f.slug, f.notes.join(' ; '));
    }
    return out;
  }

  const out = [];
  for (const file of [...fs.listFiles(dataDir)].filter((f) => f.endsWith('.json')).sort()) {
    const id = slugify(file.replace(/\.json$/, ''));
    try {
      const value = JSON.parse(fs.readFile(join(dataDir, file)));
      const checked = validatePayload('chocolaterie', value);
      if (!checked.ok) throw new Error(checked.reason);
      out.push({ slug: id, payload: checked.value, status: 'data', notes: [] });
    } catch (err) {
      onProblem(id, String(err.message));
    }
  }
  return out.sort((a, b) => (a.slug < b.slug ? -1 : 1));
}
