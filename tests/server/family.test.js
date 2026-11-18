import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFamilyPublisher, familyWill, loadVitrine } from '../../server/family.js';
import { brokerOptions } from '../../server/mqtt-options.js';

const VITRINE = { name: 'Los Freeyentes', zone: ['1000'], capital: 1, capitalCity: 'Aarau', cacao: ['forastero'], bestProduct: 'La Branche', founded: 1925, fairtrade: false };

function fakeMqtt() {
  const m = new EventEmitter();
  m.connected = false;
  m.publish = vi.fn((topic, payload, opts, cb) => cb?.());
  return m;
}
const sent = (m) => m.publish.mock.calls.map(([topic, payload, opts]) => ({ topic, env: JSON.parse(payload), opts }));

describe('createFamilyPublisher', () => {
  let m, pub;
  beforeEach(() => {
    vi.useFakeTimers();
    m = fakeMqtt();
    pub = createFamilyPublisher({ mqttClient: m, root: 'elchoco', slug: 'don-freey', vitrine: VITRINE, heartbeatMs: 5000 });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('publishes vitrine then presence open (retained, qos 1) on connect', () => {
    m.connected = true;
    m.emit('connect');
    const [v, p] = sent(m);
    expect(v.topic).toBe('elchoco/vitrine/don-freey');
    expect(v.env.from).toBe('don-freey');
    expect(v.env.payload).toEqual(VITRINE);
    expect(v.opts).toMatchObject({ qos: 1, retain: true });
    expect(p.topic).toBe('elchoco/presence/don-freey');
    expect(p.env.payload).toEqual({ state: 'open' });
    expect(p.opts).toMatchObject({ qos: 1, retain: true });
  });

  it('sends a heartbeat log every interval while connected', () => {
    m.connected = true;
    m.emit('connect');
    m.publish.mockClear();
    vi.advanceTimersByTime(10000);
    const logs = sent(m);
    expect(logs.map((l) => l.env.payload.text)).toEqual(['hb sent=1', 'hb sent=2']);
    expect(logs[0].topic).toBe('elchoco/log/don-freey');
    expect(logs[0].opts).toMatchObject({ qos: 0, retain: false });
  });

  it('stops the heartbeat when the connection drops and does not double up after reconnect', () => {
    m.connected = true;
    m.emit('connect');
    m.connected = false;
    m.emit('close');
    m.publish.mockClear();
    vi.advanceTimersByTime(20000);
    expect(m.publish).not.toHaveBeenCalled();
    m.connected = true;
    m.emit('connect');
    m.emit('connect');
    m.publish.mockClear();
    vi.advanceTimersByTime(5000);
    expect(m.publish).toHaveBeenCalledTimes(1);
  });

  it('stop() publishes presence closed and ends the heartbeat', async () => {
    m.connected = true;
    m.emit('connect');
    m.publish.mockClear();
    await pub.stop();
    const [p] = sent(m);
    expect(p.topic).toBe('elchoco/presence/don-freey');
    expect(p.env.payload).toEqual({ state: 'closed' });
    m.publish.mockClear();
    vi.advanceTimersByTime(20000);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it('stop() resolves without publishing when the broker is not connected', async () => {
    m.connected = false;
    await expect(pub.stop()).resolves.toBeUndefined();
    expect(m.publish).not.toHaveBeenCalled();
  });

  it('rejects an invalid vitrine up front', () => {
    expect(() => createFamilyPublisher({ mqttClient: m, root: 'elchoco', slug: 'don-freey', vitrine: { name: 1 } })).toThrow();
  });
});

describe('familyWill', () => {
  it('is a retained presence died message', () => {
    const w = familyWill('elchoco', 'don-freey');
    expect(w.topic).toBe('elchoco/presence/don-freey');
    expect(JSON.parse(w.payload).payload).toEqual({ state: 'died' });
    expect(w).toMatchObject({ qos: 1, retain: true });
  });
});

describe('loadVitrine', () => {
  it('loads and validates the committed snapshot', () => {
    expect(loadVitrine('don-freey').name).toBe('Los Freeyentes');
  });
  it('throws a clear error for an unknown family', () => {
    expect(() => loadVitrine('nobody')).toThrow(/nobody/);
  });
  it('rejects a slug that could escape the data folder', () => {
    expect(() => loadVitrine('../../.env')).toThrow(/invalide/);
  });
});

describe('brokerOptions with a will', () => {
  it('passes the will through', () => {
    const will = familyWill('elchoco', 'don-freey');
    expect(brokerOptions({ reconnectPeriod: 1 }, 'x', { will }).will).toEqual(will);
  });
  it('has no will by default', () => {
    expect(brokerOptions({ reconnectPeriod: 1 }, 'x')).not.toHaveProperty('will');
  });
});
