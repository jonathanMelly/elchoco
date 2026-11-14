import { describe, it, expect } from 'vitest';
import { ringView, detailView } from '../../web/src/panels/families.js';

const family = (over = {}) => ({
  id: 'los-freeyentes',
  name: 'Los Freeyentes',
  state: 'open',
  capital: 999999999,
  capitalCity: 'Aarau',
  zone: ['5000', '5001'],
  cacao: ['forastero'],
  bestProduct: 'La Branche Corleone',
  ...over,
});
const colors = new Map([['los-freeyentes', { color: '#ffb13b', hatch: false }]]);

describe('ringView labels', () => {
  it('writes each family name next to its node, escaped', () => {
    const html = ringView({ families: [family(), family({ id: 'x', name: '<img src=x onerror=alert(1)>' })], myFamily: 'los-freeyentes', colors });
    expect(html).toContain('Los Freeyentes</text>');
    expect(html).not.toContain('<img');
  });
  it('keeps data-id on the node so a click can find the family', () => {
    expect(ringView({ families: [family()], myFamily: '', colors })).toContain('data-id="los-freeyentes"');
  });
});

describe('detailView patrón', () => {
  it('shows the don name derived from the id', () => {
    const html = detailView({ family: { ...family(), id: 'don-freey' }, myFamily: '', skew: 0, color: '#fff' });
    expect(html).toContain('Don Freey');
    expect(html).toContain('patrón');
  });
});

describe('detailView', () => {
  const view = (f, extra = {}) => detailView({ family: f, myFamily: 'other', skew: 0, color: '#ffb13b', ...extra });
  it('shows the identity, zone and star product', () => {
    const html = view(family());
    for (const text of ['Los Freeyentes', 'Aarau', '5000', 'forastero', 'La Branche Corleone', 'ouverte']) expect(html).toContain(text);
  });
  it('escapes every value that came from MQTT', () => {
    const html = view(family({ name: '<script>x</script>', capitalCity: '<b>x</b>', zone: ['<i>1</i>'], cacao: ['<u>c</u>'], bestProduct: '<s>p</s>' }));
    expect(html).not.toMatch(/<(script|b|i|u|s)>/);
  });
  it('says so when the family disappeared', () => {
    expect(view(undefined)).toContain('inconnue');
  });
});
