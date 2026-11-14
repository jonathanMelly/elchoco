import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildCells, viewBoxFor } from '../../web/src/panels/map-geometry.js';
import map from '../../web/src/panels/map.js';
import { buildTerritory } from '../../web/src/state/territory.js';
import { colorsFor } from '../../web/src/state/colors.js';

const npa = JSON.parse(readFileSync(new URL('../../web/src/data/npa.json', import.meta.url), 'utf8'));
const geometry = buildCells(npa);
const vb = (s) => s.split(' ').map(Number);

describe('buildCells', () => {
  it('has one finite path per postcode', () => {
    expect(geometry.cells.size).toBe(Object.keys(npa.npa).length);
    for (const d of geometry.cells.values()) {
      expect(d.length).toBeGreaterThan(0);
      for (const n of d.match(/-?\d+(\.\d+)?/g)) expect(Number.isFinite(Number(n))).toBe(true);
    }
  });
  it('clips every cell to the disc around its point', () => {
    for (const [plz, d] of [...geometry.cells].slice(0, 400)) {
      const [px, py] = geometry.points.get(plz);
      const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
      for (let i = 0; i < nums.length; i += 2) {
        expect(Math.hypot(nums[i] - px, nums[i + 1] - py)).toBeLessThanOrEqual(3.01);
      }
    }
  });
  it('is memoised per dataset', () => {
    expect(buildCells(npa)).toBe(geometry);
  });
});

describe('viewBoxFor', () => {
  it('romandie sits strictly inside suisse', () => {
    const s = vb(viewBoxFor('suisse', { geometry, npa }));
    const r = vb(viewBoxFor('romandie', { geometry, npa }));
    expect(r[2]).toBeLessThan(s[2]);
    expect(r[3]).toBeLessThan(s[3]);
  });
  it('romandie is really the French-speaking west, not the whole country', () => {
    const r = vb(viewBoxFor('romandie', { geometry, npa }));
    expect(r[2]).toBeLessThan(220);
    expect(r[2]).toBeGreaterThan(100);
  });
  it('famille falls back to romandie when empty', () => {
    expect(viewBoxFor('famille', { geometry, npa, cellsOf: [] })).toBe(viewBoxFor('romandie', { geometry, npa }));
  });
  it('famille zooms on its cells', () => {
    const f = vb(viewBoxFor('famille', { geometry, npa, cellsOf: ['1003'] }));
    expect(f[2]).toBeLessThan(vb(viewBoxFor('romandie', { geometry, npa }))[2]);
  });
});

describe('map view', () => {
  const fam = (id, name, zone) => ({ id, name, zone, state: 'open', capital: 0, capitalCity: '', cacao: [], bestProduct: '', lastSeen: 0 });
  const families = [fam('me', '<img src=x onerror=alert(1)>', ['1003', '1004', '1200']), fam('b', 'Bravo', ['1004', '5000'])];
  const state = {
    territory: buildTerritory({ npa, families }),
    colors: colorsFor(['me', 'b'], 'me'),
    myFamily: 'me',
    families,
  };
  const html = map.view(state);

  it('escapes family names', () => {
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
  it('marks contested cells', () => {
    expect(html).toMatch(/class="npa[^"]*contested[^"]*"[^>]*data-plz="1004"|data-plz="1004"[^>]*class="npa[^"]*contested/);
  });
  it('lists unknown postcodes and credits swisstopo', () => {
    expect(html).toMatch(/NPA inconnus[\s\S]*1200/);
    expect(html).toContain('© swisstopo');
  });
  it('has the three framing buttons', () => {
    for (const label of ['Suisse', 'Romandie', 'Ma famille']) expect(html).toContain(label);
  });
});
