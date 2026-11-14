import { describe, it, expect } from 'vitest';
import { navView } from '../../web/src/shell.js';

const tabs = [
  { id: 'families', title: 'Familles' },
  { id: 'map', title: 'Carte' },
  { id: 'evil', title: '<img src=x onerror=alert(1)>' },
];

describe('navView', () => {
  it('renders one numbered button per tab, in order, keyed by panel id', () => {
    const html = navView(tabs);
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toContain('data-open="families"');
    expect(html.indexOf('Familles')).toBeLessThan(html.indexOf('Carte'));
    expect(html).toContain('>01<');
    expect(html).toContain('>02<');
  });
  it('escapes titles and ids', () => {
    expect(navView(tabs)).not.toContain('<img');
  });
  it('renders nothing for no tabs', () => {
    expect(navView([])).toBe('');
  });
});
