import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import mqtt from 'mqtt';
import { collectFamilies } from './convert-lib.js';
import { loadNpa, nodeFs, reportLine } from './convert.js';
import { heartbeatText, loadFamilies, message } from './feed-lib.js';

const ROOT = 'elchoco';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: {
    broker: { type: 'string', default: 'mqtt://localhost:1883' },
    common: { type: 'string' },
    offline: { type: 'boolean', default: false },
    'clock-skew': { type: 'string', default: '0' },
    'skew-family': { type: 'string' },
    die: { type: 'string' },
    stagger: { type: 'string', default: '1500' },
    verbose: { type: 'boolean', default: false },
  },
});

const common = values.common ?? fileURLToPath(new URL('../../elchoco-common/', import.meta.url));
const dataDir = fileURLToPath(new URL('../data/vitrines/', import.meta.url));
const npa = loadNpa();
const fs = { ...nodeFs, listFiles: (dir) => readdirSync(dir) };

// Source: elchoco-common by default, the committed snapshot with --offline or when it is missing.
let families;
if (!values.offline && nodeFs.exists(common)) {
  console.log(`source : ${common}`);
  const all = collectFamilies({ common, npa, ...nodeFs });
  all.forEach((f) => console.log(reportLine(f)));
  families = all.filter((f) => f.payload);
} else {
  console.log(`source : ${dataDir} (instantané committé)`);
  families = loadFamilies({
    source: 'data',
    dataDir,
    npa,
    fs,
    onProblem: (slug, reason) => console.log(`${slug.padEnd(16)} ignoré  ${reason}`),
  });
}

if (families.length === 0) {
  console.error('aucune famille à publier');
  process.exit(1);
}

const clock = () => new Date().toTimeString().slice(0, 8);
const say = (text) => console.log(`${clock()}  ${text}`);

// Lifecycle, vitrine, presence and journal lines always show; time and heartbeats only with --verbose.
const publish = (client, msg) =>
  new Promise((resolve) => {
    client.publish(msg.topic, msg.json, { qos: msg.qos, retain: msg.retain }, () => {
      const { payload } = JSON.parse(msg.json);
      const noisy = msg.topic.endsWith('/time') || (payload.text ?? '').startsWith('hb ');
      if (values.verbose || !noisy) {
        const flags = `qos${msg.qos}${msg.retain ? ' retain' : ''}`;
        const detail = payload.state ?? payload.text ?? payload.utc ?? payload.name ?? '';
        say(`→ ${msg.topic.padEnd(28)} ${flags.padEnd(11)} ${detail}`);
      }
      resolve();
    });
  });

const skewMs = Number(values['clock-skew']) * 1000;
if (!Number.isFinite(skewMs)) {
  console.error('--clock-skew attend un nombre de secondes');
  process.exit(1);
}
const skewSlug = values['skew-family'] ?? families[0].slug;
if (values.die && !families.some((f) => f.slug === values.die)) {
  console.error(`--die : famille inconnue : ${values.die}`);
  process.exit(1);
}

const staggerMs = Number(values.stagger);
if (!Number.isFinite(staggerMs) || staggerMs < 0) {
  console.error('--stagger attend un nombre de millisecondes');
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const nodes = [];
const startNode = ({ slug, payload }) => {
  const will = message(ROOT, 'presence', slug, { state: 'died' });
  const client = mqtt.connect(values.broker, {
    clientId: `feed-${slug}`,
    reconnectPeriod: values.die === slug ? 0 : 1000, // the dying node must stay dead
    will: { topic: will.topic, payload: will.json, qos: will.qos, retain: will.retain },
  });
  const node = { slug, payload, client, sent: 0, state: 'open' };
  // --clock-skew shifts only this node's envelope ts; the time service stays correct.
  const ts = () => new Date(Date.now() + (slug === skewSlug ? skewMs : 0));
  const send = (kind, p) => publish(client, message(ROOT, kind, slug, p, { ts: ts() }));

  node.setState = async (state) => {
    node.state = state;
    await send('presence', { state });
    await send('log', { level: 'info', text: state === 'open' ? 'ouvert pour les affaires' : 'rideau baissé' });
  };

  say(`… ${slug} se connecte (${payload.name})`);
  client.on('connect', async () => {
    say(`✓ ${slug} connecté au broker`);
    await send('vitrine', payload);
    await send('presence', { state: 'open' });
    node.state = 'open';
    say(`★ ${slug} en ligne : ${payload.name}`);
  });
  if (values.die === slug) {
    // Drop the socket without DISCONNECT so the broker fires the Last Will (died).
    setTimeout(() => {
      say(`✗ ${slug} : connexion coupée sans DISCONNECT (dernière volonté attendue)`);
      clearInterval(node.heartbeat);
      node.dead = true;
      client.stream.destroy();
    }, 10000);
  }
  client.on('error', (err) => console.error(`${slug} : ${err.message}`));

  node.heartbeat = setInterval(() => {
    if (client.connected) send('log', { level: 'info', text: heartbeatText(++node.sent) });
  }, 2000);
  nodes.push(node);
};

// Every 5-10 s, a random family flips open/closed.
let flip;
const scheduleFlip = () => {
  flip = setTimeout(async () => {
    const live = nodes.filter((n) => !n.dead && n.client.connected);
    const node = live[Math.floor(Math.random() * live.length)];
    if (node) await node.setState(node.state === 'open' ? 'closed' : 'open');
    scheduleFlip();
  }, 5000 + Math.random() * 5000);
};

// The time service: separate connection, QoS 0, not retained. Starts first.
const timeClient = mqtt.connect(values.broker, { clientId: 'feed-time' });
const timer = setInterval(() => {
  if (timeClient.connected) publish(timeClient, message(ROOT, 'time', 'feed-time', { utc: new Date().toISOString() }));
}, 1000);
say('⏱ service time démarré (1 paquet/s ; --verbose pour les voir)');

// Then the families connect one after the other.
for (const [i, f] of families.entries()) {
  if (i > 0) await sleep(staggerMs);
  startNode(f);
}
scheduleFlip();

// Ctrl+C: a clean stop must show "closed", not "died".
process.on('SIGINT', async () => {
  clearInterval(timer);
  clearTimeout(flip);
  for (const n of nodes) clearInterval(n.heartbeat);
  await Promise.all(
    nodes.map(async (n) => {
      if (n.client.connected && !n.dead) await publish(n.client, message(ROOT, 'presence', n.slug, { state: 'closed' }));
      await new Promise((r) => n.client.end(false, {}, r));
    }),
  );
  await new Promise((r) => timeClient.end(false, {}, r));
  console.log('arrêt propre : toutes les familles sont closed');
  process.exit(0);
});
