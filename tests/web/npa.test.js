import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildNpa } from '../../tools/npa-lib.js';

const HEADER = 'Ortschaftsname;PLZ4;Zusatzziffer;ZIP_ID;Gemeindename;BFS-Nr;Kantonskürzel;Adressenanteil;E;N;Sprache;Validity';
const ROWS = [
  'Lausanne;1003;00;150;Lausanne;5586;VD;100 %;2538092.000;1152460.000;fr;2008-07-01',
  'La Neuveville;2520;00;1439;La Neuveville;723;BE;99.636 %;2573995.000;1212822.000;fr;2008-07-01',
  'La Neuveville;2520;00;1439;Le Landeron;6455;NE;0.364 %;2572706.000;1212835.000;fr;2008-07-01',
  'Aarau;5000;00;2913;Aarau;4001;AG;99.695 %;2646025.000;1248945.000;de;2008-07-01',
];
const csv = '﻿' + [HEADER, ...ROWS].join('\n') + '\n';

describe('buildNpa', () => {
  const data = buildNpa(csv, { generated: '2026-11-14' });

  it('keeps the representative row per postcode', () => {
    expect(data.npa['1003']).toEqual(['Lausanne', 'VD', 'fr', 2538.1, 1152.5]);
    expect(data.npa['2520'][1]).toBe('BE');
    expect(data.npa['5000']).toEqual(['Aarau', 'AG', 'de', 2646, 1248.9]);
  });

  it('describes its source', () => {
    expect(data).toMatchObject({ generated: '2026-11-14', crs: 'EPSG:2056', unit: 'km' });
    expect(Object.keys(data.npa)).toHaveLength(3);
  });

  it('handles CRLF line endings', () => {
    const d = buildNpa(csv.replaceAll('\n', '\r\n'), { generated: 'x' });
    expect(d.npa['1003'][0]).toBe('Lausanne');
  });
});

describe('committed npa.json', () => {
  const data = JSON.parse(readFileSync(new URL('../../web/src/data/npa.json', import.meta.url), 'utf8'));
  const keys = Object.keys(data.npa);

  it('covers the whole of Switzerland', () => {
    expect(keys.length).toBeGreaterThan(3000);
    expect(keys.length).toBeLessThan(3400);
  });

  it('has valid keys and finite coordinates', () => {
    for (const k of keys) {
      expect(k).toMatch(/^[1-9][0-9]{3}$/);
      const [, , , e, n] = data.npa[k];
      expect(Number.isFinite(e) && Number.isFinite(n)).toBe(true);
    }
  });

  it('contains known postcodes', () => {
    for (const k of ['1003', '5000', '6900']) expect(data.npa[k]).toBeDefined();
  });
});
