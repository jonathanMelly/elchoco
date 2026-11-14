import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { validatePayload } from '../../web/src/state/protocol.js';

const dir = new URL('../../data/vitrines/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));

describe('committed vitrines', () => {
  it('has some families', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s is a valid payload without unknown fields', (f) => {
    const payload = read(f);
    const r = validatePayload('chocolaterie', payload);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual(payload);
  });

  it('don-freey is the reference', () => {
    expect(read('don-freey.json')).toEqual({
      name: 'Los Freeyentes',
      zone: ['1000', '1005', '1006', '1009', '1011', '1015', '1052', '1053', '5000'],
      capital: 999999999,
      capitalCity: 'Aarau',
      cacao: ['forastero'],
      bestProduct: 'La Branche Corleone',
      founded: 1925,
      fairtrade: false,
    });
  });
});
