import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { palette } from '../../web/src/fx/theme.js';

describe('palette', () => {
  it('has integer colours in range', () => {
    for (const v of Object.values(palette)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffff);
    }
  });
  it('keeps gold and cyan apart, gold matching --gold', () => {
    expect(palette.gold).not.toBe(palette.cyan);
    expect(palette.gold).toBe(0xffb13b);
  });
  it('matches the CSS variables', () => {
    const css = readFileSync(new URL('../../web/styles.css', import.meta.url), 'utf8');
    for (const [name, value] of Object.entries(palette)) {
      const m = css.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, 'i'));
      expect(m, `--${name} in styles.css`).not.toBeNull();
      expect(parseInt(m[1], 16)).toBe(value);
    }
  });
  it('theme.js does not import three', () => {
    const src = readFileSync(new URL('../../web/src/fx/theme.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"]three/);
  });
});
