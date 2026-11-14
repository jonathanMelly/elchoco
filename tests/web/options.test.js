import { describe, it, expect, vi } from 'vitest';
import { defaultOptions, createOptions } from '../../web/src/state/options.js';

const KEY = 'elchoco.hud.options';
const memStorage = (init = {}) => {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
};

describe('options', () => {
  it('defaults when storage is empty', () => {
    const o = createOptions({ storage: memStorage() });
    expect(o.all()).toEqual(defaultOptions());
    expect(o.get('volume')).toBe(0.4);
  });

  it('defaultOptions uses hostname and reduced motion', () => {
    const d = defaultOptions({ hostname: '10.0.0.5', reducedMotion: true });
    expect(d.brokerUrl).toBe('ws://10.0.0.5:9001');
    expect(d.effects).toBe('reduced');
  });

  it('persists and reloads', () => {
    const storage = memStorage();
    createOptions({ storage }).set('muted', true);
    expect(createOptions({ storage }).get('muted')).toBe(true);
  });

  it('falls back on corrupt JSON', () => {
    const o = createOptions({ storage: memStorage({ [KEY]: '{nope' }) });
    expect(o.all()).toEqual(defaultOptions());
  });

  it('falls back per key on wrong types and drops unknown keys', () => {
    const o = createOptions({ storage: memStorage({ [KEY]: JSON.stringify({ volume: 'loud', effects: 'ultra', evil: 1, muted: true }) }) });
    expect(o.get('volume')).toBe(0.4);
    expect(o.get('effects')).toBe('full');
    expect(o.get('muted')).toBe(true);
    expect(o.all()).not.toHaveProperty('evil');
  });

  it('survives a throwing storage', () => {
    const storage = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
    };
    const o = createOptions({ storage });
    expect(o.all()).toEqual(defaultOptions());
    expect(() => o.set('muted', true)).not.toThrow();
    expect(o.get('muted')).toBe(true);
  });

  it('works without storage', () => {
    const o = createOptions();
    o.set('humour', false);
    expect(o.get('humour')).toBe(false);
  });

  it('clamps volume and ignores invalid values', () => {
    const o = createOptions({ storage: memStorage() });
    const fn = vi.fn();
    o.subscribe(fn);
    o.set('volume', 7);
    expect(o.get('volume')).toBe(1);
    o.set('effects', 'ultra');
    expect(o.get('effects')).toBe('full');
    o.set('myFamily', 'Bad Slug');
    o.set('brokerUrl', 'http://x');
    o.set('patronName', '');
    o.set('muted', 'yes');
    expect(o.get('myFamily')).toBe('don-freey');
    expect(o.get('brokerUrl')).toBe('ws://localhost:9001');
    expect(o.get('patronName')).toBe('Don Freey');
    expect(o.get('muted')).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('notifies once on change, not on same value', () => {
    const o = createOptions({ storage: memStorage() });
    const fn = vi.fn();
    const off = o.subscribe(fn);
    o.set('muted', true);
    o.set('muted', true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('muted', true);
    off();
    o.set('muted', false);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
