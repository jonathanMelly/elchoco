const round1 = (n) => Math.round(n * 10) / 10;

/** Builds the compact postcode table from the swisstopo AMTOVZ CSV (LV95). */
export function buildNpa(csvText, { generated }) {
  const text = csvText.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines.shift().split(';');
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

  const best = new Map(); // plz -> { share, row }
  for (const line of lines) {
    const f = line.split(';');
    const plz = f[col.PLZ4];
    if (!/^[1-9][0-9]{3}$/.test(plz)) continue;
    const share = parseFloat(f[col.Adressenanteil]);
    const e = parseFloat(f[col.E]);
    const n = parseFloat(f[col.N]);
    if (!Number.isFinite(e) || !Number.isFinite(n)) continue;
    const prev = best.get(plz);
    if (!prev || (Number.isFinite(share) ? share : 0) > prev.share) {
      best.set(plz, { share: Number.isFinite(share) ? share : 0, f });
    }
  }

  const npa = {};
  for (const plz of [...best.keys()].sort()) {
    const { f } = best.get(plz);
    npa[plz] = [
      f[col.Ortschaftsname],
      f[col['Kantonskürzel']],
      f[col.Sprache],
      round1(parseFloat(f[col.E]) / 1000),
      round1(parseFloat(f[col.N]) / 1000),
    ];
  }

  return {
    source: 'swisstopo, Amtliches Ortschaftenverzeichnis (LV95)',
    generated,
    crs: 'EPSG:2056',
    unit: 'km',
    npa,
  };
}
