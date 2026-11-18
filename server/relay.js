// Relays MQTT messages under <root>/# to SSE clients; retained state is cached and replayed on connect.
export function createRelay({ mqttClient, root, qos = 1, heartbeatMs = 20000, log = () => {} }) {
  const clients = new Set();
  const retained = new Map();
  let brokerUp = false;

  const brokerFrame = () => `event: broker\ndata: ${JSON.stringify(brokerUp ? 'up' : 'down')}\n\n`;

  function send(res, chunk) {
    try {
      res.write(chunk);
    } catch {
      clients.delete(res);
    }
  }
  const broadcast = (chunk) => {
    for (const res of [...clients]) send(res, chunk);
  };

  function setBroker(up) {
    if (up === brokerUp) return;
    brokerUp = up;
    log(up ? 'broker connected' : 'broker disconnected');
    broadcast(brokerFrame());
  }

  mqttClient.on('connect', () => {
    mqttClient.subscribe(`${root}/#`, { qos, rap: true }, (err, granted) => {
      if (err || granted?.some((g) => g.qos === 128)) {
        log(`subscription refused for ${root}/#${err ? `: ${err.message}` : ''}`);
      }
    });
    setBroker(true);
  });
  mqttClient.on('close', () => setBroker(false));
  mqttClient.on('offline', () => setBroker(false));
  mqttClient.on('error', (err) => log(`broker error: ${err?.message ?? err}`));
  mqttClient.on('message', (topic, payload, packet) => {
    const retain = Boolean(packet?.retain);
    const text = payload.toString();
    const frame = `data: ${JSON.stringify({ topic, payload: text, retain })}\n\n`;
    if (retain) {
      if (text === '') retained.delete(topic);
      else retained.set(topic, frame);
    }
    broadcast(frame);
  });

  const timer = setInterval(() => broadcast(': ping\n\n'), heartbeatMs);
  timer.unref?.();

  return {
    handleEvents(req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      clients.add(res);
      req.on('close', () => clients.delete(res));
      send(res, 'retry: 2000\n\n');
      send(res, brokerFrame());
      send(res, `event: config\ndata: ${JSON.stringify({ root })}\n\n`);
      for (const frame of retained.values()) send(res, frame);
    },
    close() {
      clearInterval(timer);
      for (const res of clients) {
        try { res.end(); } catch { /* already gone */ }
      }
      clients.clear();
      mqttClient.end(true);
    },
  };
}
