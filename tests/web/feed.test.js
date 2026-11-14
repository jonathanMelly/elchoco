import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { envelope, message, loadFamilies, heartbeatText } from '../../tools/feed-lib.js';
import { parseMessage } from '../../web/src/state/protocol.js';
import { isHeartbeat } from '../../web/src/state/protocol.js';
import { createStore } from '../../web/src/state/store.js';

const FREEY = {
  name: 'Los Freeyentes',
  zone: ['1000', '1005', '5000'],
  capital: 999999999,
  capitalCity: 'Aarau',
  cacao: ['forastero'],
  bestProduct: 'La Branche Corleone',
  founded: 1925,
  fairtrade: false,
};

describe('envelope', () => {
  it('has exactly the seven contract keys and passes parseMessage', () => {
    const env = envelope({ from: 'don-freey', type: 'chocolaterie', payload: FREEY });
    expect(Object.keys(env)).toEqual(['v', 'id', 'from', 'to', 'ts', 'type', 'payload']);
    expect(parseMessage(JSON.stringify(env)).ok).toBe(true);
  });
});

describe('message', () => {
  it('builds a retained QoS 1 vitrine', () => {
    const m = message('elchoco', 'vitrine', 'don-freey', FREEY);
    expect(m).toMatchObject({ topic: 'elchoco/vitrine/don-freey', qos: 1, retain: true });
    const env = JSON.parse(m.json);
    expect(env.from).toBe('don-freey');
    expect(env.type).toBe('chocolaterie');
  });
  it('builds presence as retained QoS 1', () => {
    const m = message('elchoco', 'presence', 'don-freey', { state: 'open' });
    expect(m).toMatchObject({ topic: 'elchoco/presence/don-freey', qos: 1, retain: true });
  });
  it('builds time as non-retained QoS 0', () => {
    const m = message('elchoco', 'time', 'feed-time', { utc: new Date().toISOString() });
    expect(m).toMatchObject({ topic: 'elchoco/time', qos: 0, retain: false });
    expect(JSON.parse(m.json).from).toBe('feed-time');
  });
  it('builds log as non-retained QoS 0', () => {
    const m = message('elchoco', 'log', 'don-freey', { level: 'info', text: 'hb sent=1' });
    expect(m).toMatchObject({ topic: 'elchoco/log/don-freey', qos: 0, retain: false });
  });
  it('throws on an invalid payload (strict emission)', () => {
    expect(() => message('elchoco', 'vitrine', 'don-freey', { ...FREEY, capital: 1.5 })).toThrow();
  });
  it('throws on an invalid family slug', () => {
    expect(() => message('elchoco', 'vitrine', 'Bad Slug', FREEY)).toThrow();
  });
});

describe('heartbeatText', () => {
  it('is a valid heartbeat', () => {
    expect(isHeartbeat({ level: 'info', text: heartbeatText(12) })).toBe(true);
  });
});

describe('loadFamilies from data', () => {
  const files = { 'a.json': JSON.stringify(FREEY), 'b.json': '{"name":1}', 'z.json': JSON.stringify(FREEY), 'c.json': 'nope' };
  const fs = {
    listFiles: () => Object.keys(files),
    readFile: (p) => files[p.replaceAll('\\', '/').split('/').pop()],
    readDir: () => [],
    exists: () => false,
  };

  it('skips invalid files, reports them and sorts by slug', () => {
    const onProblem = vi.fn();
    const r = loadFamilies({ source: 'data', dataDir: '/d', npa: { npa: {} }, fs, onProblem });
    expect(r.map((x) => x.slug)).toEqual(['a', 'z']);
    expect(onProblem).toHaveBeenCalledTimes(2);
    expect(r[0].payload.name).toBe('Los Freeyentes');
  });
});

describe('round trip with the store', () => {
  it('every message for the committed vitrines is accepted', () => {
    const dir = new URL('../../data/vitrines/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    const store = createStore();
    for (const f of files) {
      const slug = f.replace(/\.json$/, '');
      const payload = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
      for (const [kind, p] of [['vitrine', payload], ['presence', { state: 'open' }]]) {
        const m = message('elchoco', kind, slug, p);
        store.ingest(m.topic, m.json, { retain: m.retain });
      }
    }
    expect(store.rejected).toBe(0);
    expect(store.families.list()).toHaveLength(files.length);
    expect(store.families.list().every((x) => x.state === 'open')).toBe(true);
  });
});
