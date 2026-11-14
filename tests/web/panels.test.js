import { describe, it, expect } from 'vitest';
import families from '../../web/src/panels/families.js';
import clock from '../../web/src/panels/clock.js';
import services, { SERVICE_SLOTS } from '../../web/src/panels/services.js';
import myFamily from '../../web/src/panels/my-family.js';
import log from '../../web/src/panels/log.js';
import { panels } from '../../web/src/panels/registry.js';
import { formatTime, formatSkew, donName } from '../../web/src/panels/format.js';

const fam = (over = {}) => ({
  id: 'a',
  name: 'Maison A',
  zone: ['1003'],
  capital: 1000,
  capitalCity: 'Lausanne',
  cacao: ['criollo'],
  bestProduct: 'Truffe',
  state: 'open',
  lastSeen: 0,
  ...over,
});

describe('families view', () => {
  it('escapes names', () => {
    const html = families.view({ families: [fam({ name: '<img src=x onerror=alert(1)>' })], myFamily: 'zz', skews: {} });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('maps states to classes', () => {
    const html = families.view({
      families: [fam({ id: 'up1', state: 'open' }), fam({ id: 'dn1', state: 'died' }), fam({ id: 'dn2', state: 'closed' }), fam({ id: 'un1', state: 'unknown' })],
      myFamily: 'zz',
      skews: {},
    });
    expect(html).toMatch(/class="family up[^"]*"[^>]*data-id="up1"/);
    expect(html).toMatch(/class="family down[^"]*"[^>]*data-id="dn1"/);
    expect(html).toMatch(/class="family down[^"]*"[^>]*data-id="dn2"/);
    expect(html).toMatch(/class="family unknown[^"]*"[^>]*data-id="un1"/);
  });

  it('marks my family', () => {
    const html = families.view({ families: [fam({ id: 'me' })], myFamily: 'me', skews: {} });
    expect(html).toMatch(/class="family up mine"/);
  });

  it('shows a big skew with sign and one decimal', () => {
    const html = families.view({ families: [fam()], myFamily: 'zz', skews: { a: 30000 } });
    expect(html).toContain('+30.0 s');
    expect(families.view({ families: [fam()], myFamily: 'zz', skews: { a: 200 } })).not.toContain(' s<');
  });

  it('tells when there is no family yet', () => {
    expect(families.view({ families: [], myFamily: 'zz', skews: {} })).toContain('aucune famille');
  });
});

describe('formatters', () => {
  it('formatTime uses Zurich time', () => {
    expect(formatTime(Date.parse('2026-11-14T09:00:05Z'))).toBe('10:00:05');
  });
  it('formatTime survives NaN', () => {
    expect(formatTime(NaN)).not.toContain('NaN');
  });
  it('formatSkew', () => {
    expect(formatSkew(30000)).toBe('+30.0 s');
    expect(formatSkew(-2500)).toBe('-2.5 s');
    expect(formatSkew(999)).toBe('');
    expect(formatSkew(null)).toBe('');
  });
});

describe('clock view', () => {
  it('shows time, status and offset', () => {
    const html = clock.view({ now: Date.parse('2026-11-14T09:00:05Z'), status: 'synced', offset: 1500 });
    expect(html).toContain('10:00:05');
    expect(html).toContain('1.5');
    expect(html).toContain('CARTEL');
    expect(html).toContain('synced');
  });
  it('local status has no NaN', () => {
    const html = clock.view({ now: Date.now(), status: 'local', offset: null });
    expect(html).toContain('LOCALE');
    expect(html).not.toContain('NaN');
  });
  it('stale status', () => {
    expect(clock.view({ now: Date.now(), status: 'stale', offset: 0 })).toContain('PÉRIMÉE');
  });
});

describe('services view', () => {
  it('lists the six slots and waits for Caisse', () => {
    const html = services.view({ clockStatus: 'local', logCount: 0, seenKinds: [] });
    for (const label of ['Horloge', 'Annuaire', 'Journal', 'Caisse', 'Marché', 'Moniteur']) expect(html).toContain(label);
    expect(html).toContain('EN ATTENTE');
    expect(SERVICE_SLOTS).toHaveLength(6);
  });
  it('activates Caisse when its topic root was seen', () => {
    const inactive = services.view({ clockStatus: 'synced', logCount: 0, seenKinds: [] });
    const active = services.view({ clockStatus: 'synced', logCount: 0, seenKinds: ['caisse'] });
    const count = (s) => (s.match(/EN ATTENTE/g) ?? []).length;
    expect(count(active)).toBe(count(inactive) - 1);
  });
  it('horloge activates from state, journal does not (no service yet)', () => {
    const html = services.view({ clockStatus: 'synced', logCount: 3, seenKinds: [] });
    expect((html.match(/EN ATTENTE/g) ?? []).length).toBe(5);
  });
});

describe('my-family view', () => {
  it('unknown family', () => {
    expect(myFamily.view({ family: undefined, myFamily: 'don-freey', skew: null })).toContain('famille inconnue : don-freey');
  });
  it('escapes the family name', () => {
    const html = myFamily.view({ family: fam({ name: '<b>x</b>' }), myFamily: 'a', skew: null });
    expect(html).not.toContain('<b>x');
  });
  it('shows the key figures', () => {
    const html = myFamily.view({ family: fam(), myFamily: 'a', skew: 1500 });
    expect(html).toContain('patrón');
    expect(html).toContain('Maison A');
    expect(html).toContain('Lausanne');
    expect(html).toContain('+1.5 s');
  });
});

describe('journal timestamps', () => {
  it('shows the local reception time on every row, published or observed', () => {
    const at = Date.parse('2026-11-14T09:00:05Z'); // 10:00:05 in Zurich
    const html = log.view({
      entries: [{ from: 'a', level: 'info', text: 'p', ts: 't', receivedAt: at }],
      activity: [{ from: 'b', level: 'info', text: 'o', receivedAt: at + 1000 }],
      rawLog: false, rejected: 0, lastRejected: null,
    });
    expect(html).toContain('14.11.2026 10:00:05');
    expect(html).toContain('14.11.2026 10:00:06');
    expect(html).not.toContain('NaN');
  });
});

describe('journal local view', () => {
  it('says it is a local view and merges observed activity with published logs', () => {
    const html = log.view({
      entries: [{ from: 'a', level: 'info', text: 'publié', ts: 't', receivedAt: 1 }],
      activity: [{ from: 'b', level: 'warn', text: '<b>observé</b>', receivedAt: 2 }],
      rawLog: false, rejected: 0, lastRejected: null,
    });
    expect(html).toMatch(/local/i);
    expect(html).toContain('observé');
    expect(html).toContain('publié');
    expect(html.indexOf('observé')).toBeLessThan(html.indexOf('publié'));
    expect(html).not.toContain('<b>observé');
  });
  it('the Journal slot waits for a real journal service', () => {
    const html = services.view({ clockStatus: 'synced', logCount: 3, seenKinds: ['log'] });
    expect(html).toMatch(/data-id="journal"[^>]*>(?:(?!<\/li>).)*EN ATTENTE/);
    expect(services.view({ clockStatus: 'synced', logCount: 0, seenKinds: ['journal'] })).not.toMatch(/data-id="journal"[^>]*>(?:(?!<\/li>).)*EN ATTENTE/);
  });
});

describe('donName', () => {
  it('derives the patrón name from the family id', () => {
    expect(donName('don-freey')).toBe('Don Freey');
    expect(donName('dona-rais')).toBe('Dona Rais');
    expect(donName('')).toBe('');
  });
});

describe('log view', () => {
  const base = { entries: [], rawLog: false, rejected: 0, lastRejected: null };
  it('shows newest first with level classes and escapes text', () => {
    const html = log.view({
      ...base,
      entries: [
        { from: 'a', level: 'info', text: 'first', ts: 't', receivedAt: 1 },
        { from: 'b', level: 'error', text: '<i>second</i>', ts: 't', receivedAt: 2 },
      ],
    });
    expect(html.indexOf('second')).toBeLessThan(html.indexOf('first'));
    expect(html).toContain('error');
    expect(html).not.toContain('<i>');
  });
  it('always shows the rejected counter', () => {
    expect(log.view({ ...base, rejected: 4 })).toContain('4');
  });
  it('shows the escaped raw message when rawLog is on', () => {
    const html = log.view({ ...base, rawLog: true, rejected: 1, lastRejected: { topic: 't', reason: 'r', raw: '<b>x</b>' } });
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });
  it('hides the raw message when rawLog is off', () => {
    const html = log.view({ ...base, rejected: 1, lastRejected: { topic: 't', reason: 'r', raw: 'SECRETRAW' } });
    expect(html).not.toContain('SECRETRAW');
  });
});

describe('registry', () => {
  it('lists panels in order with the panel contract', () => {
    expect(panels.map((p) => p.id)).toEqual(['my-family', 'families', 'map', 'clock', 'services', 'log', 'options']);
    for (const p of panels) {
      expect(typeof p.title).toBe('string');
      for (const fn of ['select', 'view', 'mount']) expect(typeof p[fn]).toBe('function');
    }
  });
});
