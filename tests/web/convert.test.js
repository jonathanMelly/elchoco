import { describe, it, expect } from 'vitest';
import {
  slug,
  parseLenient,
  normalizeCacao,
  toVitrine,
  checkPayload,
  collectFamilies,
} from '../../tools/convert-lib.js';
import { validatePayload } from '../../web/src/state/protocol.js';

const npa = {
  npa: {
    1003: ['Lausanne', 'VD', 'fr', 2538.1, 1152.5],
    1028: ['Préverenges', 'VD', 'fr', 2528, 1152],
    1022: ['Chavannes', 'VD', 'fr', 2534, 1152],
    1110: ['Morges', 'VD', 'fr', 2527, 1151],
    5000: ['Aarau', 'AG', 'de', 2646, 1248.9],
  },
};

const SOTTAS = {
  name: 'Medellindt',
  zone: [1028, 1022, 1110],
  hq: 'Préverenges VD',
  funds: 670000000,
  cocoa: 'Forastero',
  flagship_product: 'La Reserva del Capital',
};

const FREEY = {
  name: 'Los Freeyentes',
  zone: ['1000', '1005', '5000'],
  capital: 999999999,
  capitalCity: 'Aarau',
  cacao: ['forastero'],
  bestProduct: 'La Branche Corleone',
  founded: 1925,
  fairtrade: false,
};

describe('slug', () => {
  it('normalises folder names', () => {
    expect(slug('Don Freey')).toBe('don-freey');
    expect(slug('Doña Rais')).toBe('dona-rais');
  });
});

describe('parseLenient', () => {
  it('fails on empty files', () => {
    expect(parseLenient('')).toEqual({ ok: false, reason: 'fichier vide' });
    expect(parseLenient('  \n')).toEqual({ ok: false, reason: 'fichier vide' });
  });
  it('repairs trailing commas', () => {
    const r = parseLenient('{"a":[1,2,],}');
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ a: [1, 2] });
    expect(r.repaired).toEqual(['virgules finales']);
  });
  it('reports clean JSON without repairs', () => {
    expect(parseLenient('{"a":1}')).toEqual({ ok: true, value: { a: 1 }, repaired: [] });
  });
  it('fails on broken JSON', () => {
    expect(parseLenient('{nope').ok).toBe(false);
  });
});

describe('normalizeCacao', () => {
  it('handles strings, plurals and arrays', () => {
    expect(normalizeCacao('Forastero').cacao).toEqual(['forastero']);
    expect(normalizeCacao('Trinitarios').cacao).toEqual(['trinitario']);
    expect(normalizeCacao(['Nacional', 'Criollo']).cacao).toEqual(['nacional', 'criollo']);
    expect(normalizeCacao('criollo / nacional').cacao).toEqual(['criollo', 'nacional']);
  });
  it('drops unknown varieties', () => {
    const r = normalizeCacao(['Criollo', 'Porcelana', 'Chuao', 'Forastero']);
    expect(r.cacao).toEqual(['criollo', 'forastero']);
    expect(r.dropped).toEqual(['porcelana', 'chuao']);
  });
  it('defaults to forastero', () => {
    expect(normalizeCacao('Porcelana').cacao).toEqual(['forastero']);
  });
});

describe('toVitrine', () => {
  it('converts a draft into a valid payload', () => {
    const { payload, notes } = toVitrine(SOTTAS, { npa });
    expect(validatePayload('chocolaterie', payload).ok).toBe(true);
    expect(payload).toMatchObject({
      name: 'Medellindt',
      zone: ['1028', '1022', '1110'],
      capital: 670000000,
      capitalCity: 'Préverenges VD',
      cacao: ['forastero'],
      bestProduct: 'La Reserva del Capital',
    });
    expect(notes).toEqual([]);
  });
  it('dedupes zones, drops invalid ones and notes unknown postcodes', () => {
    const { payload, notes } = toVitrine({ ...SOTTAS, zone: [1003, '1003', 12, 5000, 1200] }, { npa });
    expect(payload.zone).toEqual(['1003', '5000', '1200']);
    expect(notes.join('|')).toContain('12');
    expect(notes.join('|')).toContain('NPA inconnus : 1200');
    expect(notes.join('|')).not.toContain('5000');
  });
  it('notes dropped cacao', () => {
    const { notes } = toVitrine({ ...SOTTAS, cocoa: ['Criollo', 'Porcelana', 'Chuao'] }, { npa });
    expect(notes).toContain('cacao ignoré : porcelana, chuao');
  });
  it('accepts the French draft key nom for name', () => {
    const { name, ...rest } = SOTTAS;
    expect(toVitrine({ ...rest, nom: 'Guadelarrero' }, { npa }).payload.name).toBe('Guadelarrero');
  });
  it('throws on a missing mandatory field', () => {
    expect(() => toVitrine({}, { npa })).toThrow();
    expect(() => toVitrine({ ...SOTTAS, zone: [12] }, { npa })).toThrow();
  });
});

describe('checkPayload', () => {
  it('returns a contract payload unchanged', () => {
    const r = checkPayload(FREEY, { npa });
    expect(r.payload).toEqual(FREEY);
    expect(r.notes.join('|')).toContain('NPA inconnus : 1000, 1005');
  });
  it('throws on an invalid payload', () => {
    expect(() => checkPayload({ ...FREEY, capital: 1.5 }, { npa })).toThrow();
  });
});

describe('collectFamilies', () => {
  const files = {
    '/c/Don Freey/chocolaterie.json': JSON.stringify(FREEY),
    '/c/Don Freey/business.json': '{"name": "ignored"}',
    '/c/Don Sottas/business.json': JSON.stringify(SOTTAS),
    '/c/Don Peltier/business.json': JSON.stringify(SOTTAS).replace('}', ',}'),
    '/c/Don Junod/business.json': '',
    '/c/Don Vide/readme.txt': 'x',
  };
  const fsx = {
    readDir: () => ['Don Freey', 'Don Sottas', 'Don Peltier', 'Don Junod', 'Don Vide'],
    readFile: (p) => files[p.replaceAll('\\', '/')],
    exists: (p) => p.replaceAll('\\', '/') in files,
  };
  const result = collectFamilies({ common: '/c', npa, ...fsx });
  const by = Object.fromEntries(result.map((r) => [r.slug, r]));

  it('uses chocolaterie.json first', () => {
    expect(by['don-freey'].status).toBe('contrat');
    expect(by['don-freey'].payload.name).toBe('Los Freeyentes');
  });
  it('converts business.json drafts', () => {
    expect(by['don-sottas'].status).toBe('ok');
    expect(by['don-peltier'].status).toBe('réparé');
  });
  it('skips hidden folders', () => {
    const r = collectFamilies({ common: '/c', npa, ...fsx, readDir: () => ['.git', 'Don Sottas'] });
    expect(r.map((x) => x.slug)).toEqual(['don-sottas']);
  });
  it('ignores empty or missing files with a reason', () => {
    expect(by['don-junod'].status).toBe('ignoré');
    expect(by['don-junod'].payload).toBeUndefined();
    expect(by['don-junod'].notes[0]).toContain('vide');
    expect(by['don-vide'].status).toBe('ignoré');
  });
});
