import { describe, it, expect, vi, afterEach } from 'vitest';
import { connectBus } from '../../web/src/bus.js';
import { VALID_VITRINE } from './fixtures.js';

class FakeEventSource {
  static last;
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = {};
    this.close = vi.fn();
    FakeEventSource.last = this;
  }
  addEventListener(name, fn) {
    (this.listeners[name] ??= []).push(fn);
  }
  emitEvent(name, data) {
    for (const fn of this.listeners[name] ?? []) fn({ data });
  }
}

function setup(extra = {}) {
  const store = { ingest: vi.fn(), setRoot: vi.fn() };
  const onStatus = vi.fn();
  const bus = connectBus({ store, EventSource: FakeEventSource, onStatus, ...extra });
  return { store, onStatus, bus, es: FakeEventSource.last };
}

afterEach(() => vi.useRealTimers());

describe('connectBus', () => {
  it('opens the url and reports connecting', () => {
    const { es, onStatus } = setup();
    expect(es.url).toBe('/events');
    expect(onStatus).toHaveBeenCalledWith('connecting');
  });

  it('onopen reports connected', () => {
    const { es, onStatus } = setup();
    es.onopen();
    expect(onStatus).toHaveBeenCalledWith('connected');
  });

  it('error while the browser retries reports reconnecting', () => {
    const { es, onStatus } = setup();
    es.readyState = 0;
    es.onerror();
    expect(onStatus).toHaveBeenLastCalledWith('reconnecting');
  });

  it('error with readyState CLOSED reports offline', () => {
    const { es, onStatus } = setup();
    es.readyState = 2;
    es.onerror();
    expect(onStatus).toHaveBeenLastCalledWith('offline');
  });

  it('message frame is parsed and ingested', () => {
    const { es, store } = setup();
    es.onmessage({ data: JSON.stringify({ topic: 'elchoco/vitrine/maison-dubois', payload: VALID_VITRINE, retain: true }) });
    expect(store.ingest).toHaveBeenCalledWith('elchoco/vitrine/maison-dubois', VALID_VITRINE, { retain: true });
  });

  it('retain missing defaults to false', () => {
    const { es, store } = setup();
    es.onmessage({ data: JSON.stringify({ topic: 't', payload: 'p' }) });
    expect(store.ingest).toHaveBeenCalledWith('t', 'p', { retain: false });
  });

  it('corrupt frame is ignored', () => {
    const { es, store } = setup();
    expect(() => es.onmessage({ data: 'not json' })).not.toThrow();
    expect(() => es.onmessage({ data: '{"nope":1}' })).not.toThrow();
    expect(() => es.onmessage({ data: 'null' })).not.toThrow();
    expect(store.ingest).not.toHaveBeenCalled();
  });

  it('broker events map to status', () => {
    const { es, onStatus } = setup();
    es.emitEvent('broker', '"down"');
    expect(onStatus).toHaveBeenLastCalledWith('offline');
    es.emitEvent('broker', '"up"');
    expect(onStatus).toHaveBeenLastCalledWith('connected');
    onStatus.mockClear();
    es.emitEvent('broker', 'garbage');
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('config event sets the store root', () => {
    const { es, store } = setup();
    es.emitEvent('config', '{"root":"cartel"}');
    expect(store.setRoot).toHaveBeenCalledWith('cartel');
  });

  it('invalid config events are ignored', () => {
    const { es, store } = setup();
    for (const d of ['garbage', '{}', '{"root":5}', '{"root":""}', 'null']) expect(() => es.emitEvent('config', d)).not.toThrow();
    expect(store.setRoot).not.toHaveBeenCalled();
  });

  it('close closes the EventSource', () => {
    const { es, bus } = setup();
    bus.close();
    expect(es.close).toHaveBeenCalled();
  });

  it('recreates the EventSource after a fatal close (dev proxy answers 500 while the backend is down)', () => {
    vi.useFakeTimers();
    const { es, onStatus } = setup();
    es.readyState = 2;
    es.onerror();
    expect(onStatus).toHaveBeenLastCalledWith('offline');
    expect(es.close).toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    const next = FakeEventSource.last;
    expect(next).not.toBe(es);
    expect(next.url).toBe('/events');
    next.onopen();
    expect(onStatus).toHaveBeenLastCalledWith('connected');
  });

  it('does not reconnect after close()', () => {
    vi.useFakeTimers();
    const { es, bus } = setup();
    es.readyState = 2;
    es.onerror();
    bus.close();
    vi.advanceTimersByTime(5000);
    expect(FakeEventSource.last).toBe(es);
  });
});
