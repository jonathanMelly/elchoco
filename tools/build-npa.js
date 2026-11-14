import { readFileSync, writeFileSync } from 'node:fs';
import { buildNpa } from './npa-lib.js';

const args = process.argv.slice(2).filter((a) => a !== '--');
const input = args[0];
if (!input) {
  console.error('usage : pnpm npa <chemin/vers/AMTOVZ_CSV_LV95.csv>');
  process.exit(1);
}

const data = buildNpa(readFileSync(input, 'utf8'), { generated: new Date().toISOString().slice(0, 10) });
const out = new URL('../web/src/data/npa.json', import.meta.url);
writeFileSync(out, JSON.stringify(data) + '\n');
console.log(`${Object.keys(data.npa).length} NPA écrits dans web/src/data/npa.json`);
