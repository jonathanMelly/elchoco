const randomHex = () => Math.random().toString(16).slice(2, 10).padEnd(8, '0');

export function connectBus({ url, root, store, mqtt, onStatus = () => {} }) {
  onStatus('connecting');
  const client = mqtt.connect(url, {
    clientId: 'hud-' + randomHex(),
    reconnectPeriod: 2000,
    connectTimeout: 5000,
  });
  const decoder = new TextDecoder();

  client.on('connect', () => {
    client.subscribe(`${root}/#`, { qos: 1 });
    onStatus('connected');
  });
  client.on('reconnect', () => onStatus('reconnecting'));
  client.on('offline', () => onStatus('offline'));
  client.on('close', () => onStatus('offline'));
  client.on('error', () => onStatus('offline'));
  client.on('message', (topic, payload, packet) => {
    store.ingest(topic, decoder.decode(payload), { retain: !!packet?.retain });
  });

  return { close: () => client.end(true) };
}
