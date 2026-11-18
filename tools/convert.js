import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { collectFamilies } from './convert-lib.js';

/** Real filesystem adapter for collectFamilies. */
export const nodeFs = {
  readDir: (dir) => readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name),
  readFile: (p) => readFileSync(p, 'utf8'),
  exists: (p) => existsSync(p),
};

export function loadNpa() {
  return JSON.parse(readFileSync(new URL('../web/src/data/npa.json', import.meta.url), 'utf8'));
}

export function reportLine({ slug, status, notes }) {
  return `${slug.padEnd(16)} ${status.padEnd(7)} ${notes.join(' ; ')}`.trimEnd();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1].replaceAll('\\', '/')}`))) {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options: { common: { type: 'string' }, out: { type: 'string' } },
  });
  const common = values.common ?? fileURLToPath(new URL('../../elchoco-common/families/', import.meta.url));
  const out = values.out ?? fileURLToPath(new URL('../data/vitrines/', import.meta.url));

  const families = collectFamilies({ common, npa: loadNpa(), ...nodeFs });
  mkdirSync(out, { recursive: true });

  const written = new Set();
  for (const f of families) {
    console.log(reportLine(f));
    if (f.payload) {
      writeFileSync(join(out, `${f.slug}.json`), JSON.stringify(f.payload, null, 2) + '\n');
      written.add(`${f.slug}.json`);
    }
  }
  for (const file of readdirSync(out)) {
    if (file.endsWith('.json') && !written.has(file)) unlinkSync(join(out, file));
  }
}
