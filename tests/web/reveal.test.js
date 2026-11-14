import { describe, it, expect } from 'vitest';
import { reveal } from '../../web/src/fx/reveal.js';

describe('reveal (rings lighting up one after another)', () => {
  it('is 0 before its turn and 1 after', () => {
    expect(reveal(0, 0)).toBe(0);
    expect(reveal(10, 0)).toBe(1);
    expect(reveal(0.5, 3)).toBe(0); // ring 3 waits for its turn
  });
  it('rings light up in order', () => {
    const t = 1.5;
    const r = [0, 1, 2, 3].map((i) => reveal(t, i));
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThanOrEqual(r[i - 1]);
    expect(r[0]).toBeGreaterThan(r[3]);
  });
  it('stays within 0..1 and never returns NaN', () => {
    for (const t of [-5, 0, 0.3, 1, 99]) for (const i of [0, 1, 7]) {
      const v = reveal(t, i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
