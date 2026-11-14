export function createClock({ now = Date.now, staleMs = 15000, samples = 8 } = {}) {
  let recent = []; // utc - receivedAt, newest last
  let lastObserved = null; // receivedAt of the last valid time message
  const nodes = new Map(); // from -> (ts - receivedAt)

  const offset = () => (recent.length ? Math.max(...recent) : null);

  return {
    observeTime(utcIso, receivedAt) {
      const utc = Date.parse(utcIso);
      if (Number.isNaN(utc)) return;
      recent.push(utc - receivedAt);
      if (recent.length > samples) recent = recent.slice(-samples);
      lastObserved = receivedAt;
    },
    observeNode(from, tsIso, receivedAt) {
      const ts = Date.parse(tsIso);
      if (Number.isNaN(ts)) return;
      nodes.set(from, ts - receivedAt);
    },
    offset,
    cartelNow: () => now() + (offset() ?? 0),
    status() {
      if (lastObserved === null) return 'local';
      return now() - lastObserved > staleMs ? 'stale' : 'synced';
    },
    nodeSkew(from) {
      return nodes.has(from) ? nodes.get(from) - (offset() ?? 0) : null;
    },
  };
}
