import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLUG_RE, validatePayload } from '../web/src/state/protocol.js';
import { heartbeatText, message } from '../tools/feed-lib.js';

const DATA_DIR = fileURLToPath(new URL('../data/vitrines/', import.meta.url));

/** Reads and validates data/vitrines/<slug>.json. */
export function loadVitrine(slug, dir = DATA_DIR) {
  if (!SLUG_RE.test(slug)) throw new Error(`identifiant invalide : ${slug}`);
  let raw;
  try {
    raw = readFileSync(join(dir, `${slug}.json`), 'utf8');
  } catch {
    throw new Error(`vitrine introuvable pour ${slug} (data/vitrines/${slug}.json)`);
  }
  const checked = validatePayload('chocolaterie', JSON.parse(raw));
  if (!checked.ok) throw new Error(`vitrine invalide pour ${slug} : ${checked.reason}`);
  return checked.value;
}

/** Last Will: if the backend dies without a clean stop, the broker publishes "died" for the family. */
export function familyWill(root, slug) {
  const m = message(root, 'presence', slug, { state: 'died' });
  return { topic: m.topic, payload: m.json, qos: m.qos, retain: m.retain };
}

/**
 * Publishes one family on the shared MQTT client: vitrine and presence on every (re)connect, then a
 * heartbeat log line every `heartbeatMs` while connected.
 */
export function createFamilyPublisher({ mqttClient, root, slug, vitrine, heartbeatMs = 5000, log = () => {} }) {
  message(root, 'vitrine', slug, vitrine); // validates slug and payload now, not at first connect
  let timer = null;
  let sent = 0;

  const publish = (kind, payload) =>
    new Promise((resolve) => {
      const m = message(root, kind, slug, payload);
      mqttClient.publish(m.topic, m.json, { qos: m.qos, retain: m.retain }, () => resolve());
    });

  const stopTimer = () => {
    clearInterval(timer);
    timer = null;
  };

  mqttClient.on('connect', () => {
    stopTimer();
    publish('vitrine', vitrine);
    publish('presence', { state: 'open' });
    log(`family ${slug} published under ${root}/`);
    timer = setInterval(() => {
      if (mqttClient.connected) publish('log', { level: 'info', text: heartbeatText(++sent) });
    }, heartbeatMs);
    timer.unref?.();
  });
  mqttClient.on('close', stopTimer);

  return {
    async stop() {
      stopTimer();
      if (mqttClient.connected) await publish('presence', { state: 'closed' });
    },
  };
}
