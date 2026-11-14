import { describe, it, expect, vi } from 'vitest';
import { createFamilies } from '../../web/src/state/families.js';
import { escapeHtml } from '../../web/src/util/escape.js';
import { VITRINE_PAYLOAD } from './fixtures.js';

describe('families book', () => {
  it('vitrine then presence open gives one open family', () => {
    const f = createFamilies();
    f.apply('vitrine', 'maison-dubois', VITRINE_PAYLOAD, 1);
    f.apply('presence', 'maison-dubois', { state: 'open' }, 2);
    expect(f.list()).toHaveLength(1);
    expect(f.get('maison-dubois')).toMatchObject({ name: 'Maison Dubois', state: 'open', lastSeen: 2 });
  });

  it('vitrine alone is unknown', () => {
    const f = createFamilies();
    f.apply('vitrine', 'a', VITRINE_PAYLOAD, 1);
    expect(f.get('a').state).toBe('unknown');
  });

  it('presence died first creates a stub that a later vitrine fills in', () => {
    const f = createFamilies();
    f.apply('presence', 'a', { state: 'died' }, 1);
    expect(f.get('a')).toMatchObject({ name: 'a', zone: [], cacao: [], capital: 0, capitalCity: '', bestProduct: '', state: 'died' });
    f.apply('vitrine', 'a', VITRINE_PAYLOAD, 2);
    expect(f.get('a')).toMatchObject({ name: 'Maison Dubois', state: 'died' });
    expect(f.get('a').zone).toEqual(['1003', '1004', '1800']);
  });

  it('identical re-apply updates lastSeen only, without notifying', () => {
    const f = createFamilies();
    const fn = vi.fn();
    f.apply('vitrine', 'a', VITRINE_PAYLOAD, 1);
    f.subscribe(fn);
    expect(f.apply('vitrine', 'a', VITRINE_PAYLOAD, 5)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
    expect(f.get('a').lastSeen).toBe(5);
  });

  it('touch never creates a stub', () => {
    const f = createFamilies();
    f.touch('ghost', 1);
    expect(f.list()).toEqual([]);
    f.apply('presence', 'a', { state: 'open' }, 1);
    f.touch('a', 9);
    expect(f.get('a').lastSeen).toBe(9);
  });

  it('subscribe gets (new, previous) and unsubscribe stops it', () => {
    const f = createFamilies();
    const fn = vi.fn();
    f.apply('presence', 'a', { state: 'open' }, 1);
    const off = f.subscribe(fn);
    expect(f.apply('presence', 'a', { state: 'died' }, 2)).toBe(true);
    const [next, prev] = fn.mock.calls[0];
    expect(prev.state).toBe('open');
    expect(next.state).toBe('died');
    expect(Object.isFrozen(next)).toBe(true);
    off();
    f.apply('presence', 'a', { state: 'open' }, 3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('list is sorted by id', () => {
    const f = createFamilies();
    f.apply('presence', 'b', { state: 'open' }, 1);
    f.apply('presence', 'a', { state: 'open' }, 1);
    expect(f.list().map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('escapeHtml', () => {
  it('escapes tags', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).not.toContain('<');
  });
  it('escapes quotes', () => {
    const s = escapeHtml('"\'');
    expect(s).not.toContain('"');
    expect(s).not.toContain("'");
  });
  it('stringifies', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
