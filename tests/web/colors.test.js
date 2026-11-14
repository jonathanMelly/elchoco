import { describe, it, expect } from 'vitest';
import { FAMILY_PALETTE, colorsFor } from '../../web/src/state/colors.js';

describe('colorsFor', () => {
  it('gives my family gold', () => {
    expect(colorsFor(['a', 'me'], 'me').get('me')).toEqual({ color: '#ffb13b', hatch: false });
  });
  it('is deterministic and independent of input order', () => {
    const ids = ['d', 'c', 'b', 'a', 'me'];
    const a = colorsFor(ids, 'me');
    const b = colorsFor([...ids].reverse(), 'me');
    expect([...a]).toEqual([...colorsFor(ids, 'me')]);
    for (const id of ids) expect(b.get(id)).toEqual(a.get(id));
  });
  it('uses 8 solid colours then hatches', () => {
    const ids = ['me', ...Array.from({ length: 11 }, (_, i) => `fam-${i}`)];
    const m = colorsFor(ids, 'me');
    const others = ids.filter((i) => i !== 'me').map((i) => m.get(i));
    expect(m.get('me').hatch).toBe(false);
    expect(others.filter((c) => !c.hatch)).toHaveLength(8);
    expect(others.filter((c) => c.hatch)).toHaveLength(3);
    const solid = others.filter((c) => !c.hatch).map((c) => c.color);
    expect(new Set(solid).size).toBe(8);
    for (const c of solid) expect(FAMILY_PALETTE).toContain(c);
  });
});
