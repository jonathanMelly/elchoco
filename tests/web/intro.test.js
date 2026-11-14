import { describe, it, expect, vi, afterEach } from 'vitest';
import { introLines, welcomeText, runIntro } from '../../web/src/fx/intro.js';

afterEach(() => vi.unstubAllGlobals());

const HUMOUR = [
  'Tempérage du Forastero…',
  'Cumulus détecté, trésorerie en CHF…',
  'Corruption du Contador : OK',
  'Allumage des anneaux de pouvoir…',
];

describe('intro text', () => {
  it('has the humour lines', () => {
    const lines = introLines({ humour: true });
    for (const l of HUMOUR) expect(lines).toContain(l);
  });
  it('neutral lines contain none of them', () => {
    const lines = introLines({ humour: false });
    expect(lines.length).toBeGreaterThan(0);
    for (const l of HUMOUR) expect(lines).not.toContain(l);
  });
  it('welcomeText', () => {
    expect(welcomeText('Don Freey')).toBe('BIENVENIDO, PATRÓN DON FREEY');
    expect(welcomeText('  ')).toBe('BIENVENIDO, PATRÓN');
    expect(welcomeText('')).toBe('BIENVENIDO, PATRÓN');
  });
});

describe('runIntro', () => {
  const opts = (o) => ({ get: (k) => o[k] });

  it('resolves immediately when skipIntro', async () => {
    const wait = () => {
      throw new Error('wait must not be called');
    };
    await runIntro({ el: { textContent: '' }, scene: null, sound: { play() {} }, options: opts({ skipIntro: true }), wait });
  });

  it('plays boot lines then welcome and removes its listeners', async () => {
    const added = [];
    const removed = [];
    vi.stubGlobal('addEventListener', (t, fn) => added.push([t, fn]));
    vi.stubGlobal('removeEventListener', (t, fn) => removed.push([t, fn]));
    const events = [];
    const o = opts({ skipIntro: false, humour: true, patronName: 'Don Freey' });
    await runIntro({
      el: { textContent: '' },
      scene: null,
      sound: { play: (e) => events.push(e) },
      options: o,
      wait: () => Promise.resolve(),
    });
    const n = introLines({ humour: true }).length;
    expect(events).toEqual([...Array(n).fill('boot-line'), 'welcome']);
    for (const a of added) expect(removed).toContainEqual(a);
  });
});
