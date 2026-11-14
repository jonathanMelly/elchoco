import { describe, it, expect } from 'vitest';
import { buildTerritory } from '../../web/src/state/territory.js';

const npa = {
  npa: {
    1003: ['Lausanne', 'VD', 'fr', 2538.1, 1152.5],
    1004: ['Lausanne', 'VD', 'fr', 2539, 1153],
    1800: ['Vevey', 'VD', 'fr', 2554, 1146],
    2520: ['La Neuveville', 'BE', 'fr', 2574, 1212.8],
    5000: ['Aarau', 'AG', 'de', 2646, 1248.9],
  },
};
const fam = (id, zone) => ({ id, name: id, zone, state: 'open' });

describe('buildTerritory', () => {
  const t = buildTerritory({
    npa,
    families: [fam('a', ['1003', '1004', '5000']), fam('b', ['1004', '1013']), fam('stub', [])],
  });

  it('lists the owners of each known postcode', () => {
    expect(t.owners.get('1004')).toEqual(['a', 'b']);
    expect(t.owners.get('5000')).toEqual(['a']);
    expect(t.owners.has('1013')).toBe(false);
  });
  it('flags contested postcodes', () => {
    expect(t.contested).toEqual(['1004']);
  });
  it('lists unknown postcodes with their owners', () => {
    expect(t.unknown).toEqual([{ plz: '1013', owners: ['b'] }]);
  });
  it('counts stats per family and ignores stubs', () => {
    expect(t.stats.get('a')).toEqual({ zones: 3, onMap: 3, contested: 1, unknown: 0 });
    expect(t.stats.get('b')).toEqual({ zones: 2, onMap: 1, contested: 1, unknown: 1 });
    expect(t.stats.has('stub')).toBe(false);
  });
});
