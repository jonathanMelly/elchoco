function parseFrame(data) {
  try {
    const frame = JSON.parse(data);
    if (frame && typeof frame.topic === 'string' && typeof frame.payload === 'string') return frame;
  } catch {
    // corrupt frame: ignored
  }
  return null;
}

export function connectBus({ url = '/events', store, EventSource = globalThis.EventSource, onStatus = () => {} }) {
  let es = null;
  let timer = null;
  let closed = false;

  function open() {
    es = new EventSource(url);
    const current = es;
    es.onopen = () => onStatus('connected');
    es.onerror = () => {
      if (current.readyState !== 2) return onStatus('reconnecting');
      // Fatal (e.g. the dev proxy answered 500 while the backend is down): the browser will not retry by itself.
      onStatus('offline');
      current.close();
      if (!closed) timer = setTimeout(open, 2000);
    };
    es.onmessage = (event) => {
      const frame = parseFrame(event.data);
      if (frame) store.ingest(frame.topic, frame.payload, { retain: !!frame.retain });
    };
    es.addEventListener('config', (event) => {
      try {
        const { root } = JSON.parse(event.data) ?? {};
        if (typeof root === 'string' && root !== '') store.setRoot(root);
      } catch {
        // ignored
      }
    });
    es.addEventListener('broker', (event) => {
      try {
        const state = JSON.parse(event.data);
        if (state === 'up') onStatus('connected');
        else if (state === 'down') onStatus('offline');
      } catch {
        // ignored
      }
    });
  }

  onStatus('connecting');
  open();

  return {
    close() {
      closed = true;
      clearTimeout(timer);
      es.close();
    },
  };
}
