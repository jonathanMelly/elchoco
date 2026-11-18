import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mqtt from 'mqtt';
import config from '../src/config.js';
import { createRelay } from './relay.js';
import { createHudServer } from './http.js';
import { brokerOptions } from './mqtt-options.js';
import { createFamilyPublisher, familyWill, loadVitrine } from './family.js';

const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
const brokerUrl = `${config.protocol}://${config.host}:${config.port}`;

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

// Optional: this backend also publishes the family named in HUD_FAMILY (vitrine, presence, heartbeat, Last Will).
let vitrine = null;
if (config.hudFamily) {
  try {
    vitrine = loadVitrine(config.hudFamily);
  } catch (err) {
    console.error(`HUD_FAMILY : ${err.message}`);
    process.exit(1);
  }
}
const will = vitrine ? familyWill(config.hudRoot, config.hudFamily) : undefined;

const mqttClient = mqtt.connect(brokerUrl, brokerOptions(config, crypto.randomBytes(4).toString('hex'), { will }));
const relay = createRelay({ mqttClient, root: config.hudRoot, qos: config.qos, log });
const family = vitrine
  ? createFamilyPublisher({ mqttClient, root: config.hudRoot, slug: config.hudFamily, vitrine, log })
  : null;
// Loopback bind: only accept loopback Host headers (DNS rebinding). LAN binds (HUD_HOST=0.0.0.0) skip the check.
const loopback = ['127.0.0.1', 'localhost', '::1'].includes(config.hudHost);
const allowedHosts = loopback ? ['localhost', '127.0.0.1', '[::1]'] : null;
const server = createHudServer({ relay, staticDir, allowedHosts });

server.listen(config.hudPort, config.hudHost, () => {
  console.log(`HUD: http://${config.hudHost}:${config.hudPort}  broker: ${brokerUrl}`);
});

const shutdown = async () => {
  // Clean stop: the family shows "closed" (not "died") before the connection is cut.
  await Promise.race([family?.stop(), new Promise((r) => setTimeout(r, 1000))]);
  relay.close();
  server.close(() => process.exit(0));
  server.closeAllConnections?.();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
