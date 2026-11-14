import { describe, it, expect } from 'vitest';
import { createClock } from '../../web/src/state/clock.js';

const T0 = Date.parse('2026-11-14T10:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

function make(opts = {}) {
  let t = T0;
  const clock = createClock({ now: () => t, ...opts });
  return { clock, advance: (ms) => (t += ms), set: (v) => (t = v) };
}

describe('clock', () => {
  it('is local without observation', () => {
    const { clock } = make();
    expect(clock.status()).toBe('local');
    expect(clock.offset()).toBeNull();
    expect(clock.cartelNow()).toBe(T0);
  });

  it('estimates the offset from one observation', () => {
    const { clock } = make();
    clock.observeTime(iso(T0 + 5000), T0);
    expect(clock.offset()).toBe(5000);
    expect(clock.status()).toBe('synced');
    expect(clock.cartelNow()).toBe(T0 + 5000);
  });

  it('keeps the largest recent sample (minimal latency)', () => {
    const { clock } = make();
    clock.observeTime(iso(T0 + 4700), T0);
    clock.observeTime(iso(T0 + 5000), T0);
    clock.observeTime(iso(T0 + 4900), T0);
    expect(clock.offset()).toBe(5000);
  });

  it('evicts old samples', () => {
    const { clock } = make({ samples: 2 });
    clock.observeTime(iso(T0 + 9000), T0);
    clock.observeTime(iso(T0 + 1000), T0);
    clock.observeTime(iso(T0 + 1200), T0);
    expect(clock.offset()).toBe(1200);
  });

  it('turns stale without new observation', () => {
    const { clock, advance } = make();
    clock.observeTime(iso(T0), T0);
    advance(16000);
    expect(clock.status()).toBe('stale');
  });

  it('ignores an unparsable utc', () => {
    const { clock } = make();
    clock.observeTime('nope', T0);
    expect(clock.status()).toBe('local');
    expect(Number.isFinite(clock.cartelNow())).toBe(true);
  });

  it('computes node skew without offset', () => {
    const { clock } = make();
    clock.observeNode('don-sottas', iso(T0 + 30000), T0);
    expect(clock.nodeSkew('don-sottas')).toBe(30000);
  });

  it('computes node skew relative to the offset', () => {
    const { clock } = make();
    clock.observeTime(iso(T0 + 5000), T0);
    clock.observeNode('n', iso(T0 + 5000), T0);
    expect(clock.nodeSkew('n')).toBe(0);
  });

  it('returns null for unknown or unparsable nodes', () => {
    const { clock } = make();
    expect(clock.nodeSkew('nobody')).toBeNull();
    clock.observeNode('x', 'hier', 0);
    expect(clock.nodeSkew('x')).toBeNull();
  });
});
