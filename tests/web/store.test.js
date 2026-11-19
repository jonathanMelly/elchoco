import { describe, it, expect, vi } from 'vitest';
import { createStore, restoreActivity } from '../../web/src/state/store.js';
import { VALID_VITRINE, HOSTILE, envelopeJson } from './fixtures.js';

const V = 'elchoco/vitrine/maison-dubois';
const presence = (state, over = {}) => envelopeJson({ type: 'presence', payload: { state }, ...over });
const logMsg = (text, over = {}) => envelopeJson({ type: 'log', payload: { level: 'info', text }, ...over });

describe('store.ingest', () => {
  it('builds an open family from vitrine + presence', () => {
    const s = createStore();
    s.ingest(V, VALID_VITRINE);
    s.ingest('elchoco/presence/maison-dubois', presence('open'));
    expect(s.families.list()).toHaveLength(1);
    expect(s.families.get('maison-dubois').state).toBe('open');
    expect(s.rejected).toBe(0);
  });

  it('a presence announcing kind: service feeds services, not families (any id)', () => {
    const s = createStore();
    s.ingest('elchoco/presence/web-order', presence('open', { from: 'web-order', payload: { state: 'open', kind: 'service' } }));
    expect(s.families.list()).toHaveLength(0);
    expect(s.services.list().find((x) => x.id === 'web-order')).toMatchObject({ state: 'open' });
    expect(s.rejected).toBe(0);
  });

  it('a v1 presence of a legacy id still lands in services (degraded fallback), and the sender is warned once', () => {
    const s = createStore();
    s.ingest('elchoco/presence/time', presence('open', { v: 1, from: 'time' }));
    s.ingest('elchoco/presence/time', presence('closed', { v: 1, from: 'time' }));
    s.ingest('elchoco/presence/registry', presence('died', { v: 1, from: 'registry' }));
    expect(s.families.list()).toHaveLength(0);
    const byId = Object.fromEntries(s.services.list().map((x) => [x.id, x.state]));
    expect(byId).toEqual({ time: 'closed', registry: 'died', dispatch: 'unknown' });
    const warns = s.activity.filter((a) => /dépréciée/.test(a.text));
    expect(warns.map((a) => a.from)).toEqual(['time', 'registry']);
    expect(warns[0].text).toMatch(/12.12.2026/);
  });

  it('registry and dispatch cards get their figures from directory and status', () => {
    const s = createStore();
    const ID = (n) => `0b9a7a8e-5c1f-4d0a-8f43-2d6c1f7a9e5${n}`;
    const house = (id, state) => ({ id, name: id, zone: ['1003'], state, skus: [] });
    s.ingest('elchoco/directory', envelopeJson({ type: 'directory', from: 'registry', payload: { asOf: '2026-11-19T10:00:00Z', houses: [house('a', 'open'), house('b', 'closed')] } }));
    const status = (n, state) => s.ingest(`elchoco/status/${ID(n)}`, envelopeJson({ type: 'status', from: 'dispatch', payload: { orderId: ID(n), state } }));
    status(1, 'received');
    status(2, 'proposed');
    status(3, 'reserved');
    status(1, 'reserved'); // latest state wins
    status(4, 'failed');
    const by = Object.fromEntries(s.services.list().map((x) => [x.id, x.stats]));
    expect(by.registry).toMatchObject({ entries: 2, open: 1 });
    expect(by.dispatch).toEqual({ pending: 1, reserved: 2, failed: 1 });
    expect(s.rejected).toBe(0);
    expect(s.families.list()).toHaveLength(0);
  });

  it('received() lists only services heard from, list() also keeps the placeholders', () => {
    const s = createStore();
    expect(s.services.received()).toEqual([]);
    expect(s.services.list().map((x) => x.id)).toEqual(['time', 'registry', 'dispatch']);
    s.ingest('elchoco/presence/web-order', presence('open', { from: 'web-order', payload: { state: 'open', kind: 'service' } }));
    expect(s.services.received().map((x) => x.id)).toEqual(['web-order']);
  });

  it('kind: family wins over the legacy list', () => {
    const s = createStore();
    s.ingest('elchoco/presence/time', presence('open', { from: 'time', payload: { state: 'open', kind: 'family' } }));
    expect(s.families.list().map((f) => f.id)).toEqual(['time']);
  });

  it('non-retained time syncs the clock, retained time does not', () => {
    const now = Date.parse('2026-11-14T10:00:00Z');
    const s = createStore({ now: () => now });
    const raw = envelopeJson({ type: 'time', from: 'feed-time', payload: { utc: '2026-11-14T10:00:00Z' } });
    s.ingest('elchoco/time', raw, { retain: true });
    expect(s.clock.status()).toBe('local');
    s.ingest('elchoco/time', raw);
    expect(s.clock.status()).toBe('synced');
  });

  it('a time with an unparsable utc is rejected and the clock stays local', () => {
    const s = createStore();
    s.ingest('elchoco/time', envelopeJson({ type: 'time', from: 'feed-time', payload: { utc: 'nope' } }));
    expect(s.rejected).toBe(1);
    expect(s.clock.status()).toBe('local');
  });

  it('records log entries but not heartbeats', () => {
    const s = createStore();
    s.ingest('elchoco/log/maison-dubois', logMsg('four allumé'));
    s.ingest('elchoco/log/maison-dubois', logMsg('hb sent=1'));
    s.ingest('elchoco/log/maison-dubois', logMsg('hb oops'));
    expect(s.log).toHaveLength(1);
    expect(s.log[0]).toMatchObject({ from: 'maison-dubois', level: 'info', text: 'four allumé' });
    expect(s.rejected).toBe(0);
  });

  it('a heartbeat touches lastSeen of a known family only', () => {
    let t = 1000;
    const s = createStore({ now: () => t });
    s.ingest(V, VALID_VITRINE);
    t = 5000;
    s.ingest('elchoco/log/maison-dubois', logMsg('hb sent=1'));
    expect(s.families.get('maison-dubois').lastSeen).toBe(5000);
    s.ingest('elchoco/log/ghost', logMsg('hb sent=1', { from: 'ghost' }));
    expect(s.families.get('ghost')).toBeUndefined();
  });

  it.each(HOSTILE.map((h) => [h.name, h]))('rejects hostile fixture: %s', (_n, h) => {
    const s = createStore();
    s.ingest(V, VALID_VITRINE);
    const before = JSON.stringify(s.families.list());
    expect(() => s.ingest(h.topic, h.raw)).not.toThrow();
    expect(s.rejected).toBe(1);
    expect(s.lastRejected.topic).toBe(h.topic);
    expect(JSON.stringify(s.families.list())).toBe(before);
  });

  it('rejects a presence envelope on a vitrine topic', () => {
    const s = createStore();
    s.ingest(V, presence('open'));
    expect(s.rejected).toBe(1);
  });

  it('truncates the rejected raw to 200 chars', () => {
    const s = createStore();
    s.ingest(V, 'x'.repeat(500));
    expect(s.lastRejected.raw).toHaveLength(200);
  });

  it('ignores an empty message without counting', () => {
    const s = createStore();
    s.ingest('elchoco/vitrine/x', '');
    expect(s.rejected).toBe(0);
  });

  it('records unknown topics without counting', () => {
    const s = createStore();
    const fn = vi.fn();
    s.subscribe(fn);
    s.ingest('elchoco/caisse/x', 'whatever');
    expect(s.rejected).toBe(0);
    expect(s.seenKinds.has('caisse')).toBe(true);
    expect(fn).toHaveBeenCalled();
  });

  it('ignores topics outside the root', () => {
    const s = createStore();
    s.ingest('chat/all', 'salut');
    expect(s.rejected).toBe(0);
    expect(s.seenKinds.size).toBe(0);
  });

  it('keeps only the last 200 log entries', () => {
    const s = createStore();
    for (let i = 0; i < 250; i++) s.ingest('elchoco/log/maison-dubois', logMsg(`ligne ${i}`));
    expect(s.log).toHaveLength(200);
    expect(s.log.at(-1).text).toBe('ligne 249');
    expect(s.log[0].text).toBe('ligne 50');
  });

  it('measures node skew from non-retained messages', () => {
    const now = Date.parse('2026-11-14T10:00:00Z');
    const s = createStore({ now: () => now });
    s.ingest('elchoco/log/maison-dubois', logMsg('salut', { ts: '2026-11-14T10:00:30Z' }));
    expect(s.clock.nodeSkew('maison-dubois')).toBeCloseTo(30000, -2);
  });

  it('retained messages do not feed node skew', () => {
    const s = createStore({ now: () => Date.parse('2026-11-14T10:00:00Z') });
    s.ingest(V, VALID_VITRINE, { retain: true });
    expect(s.clock.nodeSkew('maison-dubois')).toBeNull();
  });

  it('a stub family appears for a died presence without a vitrine', () => {
    const s = createStore();
    s.ingest('elchoco/presence/ghost', presence('died', { from: 'ghost' }));
    expect(s.families.get('ghost').state).toBe('died');
  });

  it('notifies subscribers on accepted messages', () => {
    const s = createStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.ingest(V, VALID_VITRINE);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.ingest(V, VALID_VITRINE);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('store.activity (what this console observed)', () => {
  const P = 'elchoco/presence/maison-dubois';
  it('records a new family, then each presence change', () => {
    const s = createStore({ now: () => 1000 });
    s.ingest(V, VALID_VITRINE);
    s.ingest(P, presence('open'));
    s.ingest(P, presence('open'));
    s.ingest(P, presence('closed'));
    s.ingest(P, presence('died'));
    const texts = s.activity.map((a) => a.text);
    expect(texts).toHaveLength(4);
    expect(texts[0]).toMatch(/apparue/);
    expect(texts[1]).toMatch(/ouverte/);
    expect(texts[2]).toMatch(/fermée/);
    expect(texts[3]).toMatch(/morte/);
    expect(s.activity[3].level).toBe('error');
    expect(s.activity.every((a) => a.from === 'maison-dubois' && a.receivedAt === 1000)).toBe(true);
  });
  it('records a rejected message', () => {
    const s = createStore();
    s.ingest(V, 'bonjour le cartel');
    expect(s.activity).toHaveLength(1);
    expect(s.activity[0].level).toBe('warn');
    expect(s.activity[0].text).toMatch(/rejeté/);
  });
  it('does not mix with the logs published by families, and keeps only 200', () => {
    const s = createStore();
    s.ingest('elchoco/log/maison-dubois', logMsg('four allumé'));
    expect(s.log).toHaveLength(1);
    expect(s.activity).toHaveLength(0);
    for (let i = 0; i < 250; i++) s.ingest(V, 'nope');
    expect(s.activity).toHaveLength(200);
  });
});

describe('restoreActivity', () => {
  it('keeps valid entries and ignores junk', () => {
    const ok = { from: 'a', level: 'info', text: 'x', receivedAt: 1 };
    expect(restoreActivity(JSON.stringify([ok, { text: 3 }, null, 'x']))).toEqual([ok]);
    expect(restoreActivity('{nope')).toEqual([]);
    expect(restoreActivity(null)).toEqual([]);
    expect(restoreActivity('{"a":1}')).toEqual([]);
  });
});

describe('store.setRoot', () => {
  it('parses topics under the new root and ignores the old one', () => {
    const s = createStore();
    s.setRoot('cartel');
    s.ingest('cartel/vitrine/maison-dubois', VALID_VITRINE);
    s.ingest('cartel/presence/maison-dubois', presence('open'));
    expect(s.families.list()).toHaveLength(1);
    const before = s.families.list().length;
    s.ingest('elchoco/vitrine/autre-famille', VALID_VITRINE);
    expect(s.families.list()).toHaveLength(before);
  });
});
