import { join } from 'node:path';
import { validatePayload } from '../web/src/state/protocol.js';

const CACAO = ['criollo', 'trinitario', 'forastero', 'nacional'];

export function slug(folderName) {
  return folderName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseLenient(text) {
  if (typeof text !== 'string' || text.trim() === '') return { ok: false, reason: 'fichier vide' };
  try {
    return { ok: true, value: JSON.parse(text), repaired: [] };
  } catch {
    // fall through to the repair attempt
  }
  try {
    const value = JSON.parse(text.replace(/,\s*([\]}])/g, '$1'));
    return { ok: true, value, repaired: ['virgules finales'] };
  } catch (err) {
    return { ok: false, reason: String(err.message) };
  }
}

export function normalizeCacao(input) {
  const items = Array.isArray(input) ? input : String(input ?? '').split(/[,/;]/);
  const cacao = [];
  const dropped = [];
  for (const raw of items) {
    let v = String(raw).trim().toLowerCase();
    if (!v) continue;
    if (!CACAO.includes(v) && v.endsWith('s')) v = v.slice(0, -1);
    if (CACAO.includes(v)) {
      if (!cacao.includes(v)) cacao.push(v);
    } else if (!dropped.includes(v)) {
      dropped.push(v);
    }
  }
  return { cacao: cacao.length ? cacao : ['forastero'], dropped };
}

/** "6901 … 6911, 6975": runs of 3+ consecutive postcodes are compressed. */
function formatPostcodes(list) {
  const nums = [...list].map(Number).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    if (j - i >= 2) out.push(`${nums[i]} … ${nums[j]}`);
    else for (let k = i; k <= j; k++) out.push(String(nums[k]));
    i = j + 1;
  }
  return out.join(', ');
}

function unknownNote(zone, npa) {
  const unknown = zone.filter((z) => !(z in npa.npa));
  return unknown.length ? `NPA inconnus : ${formatPostcodes(unknown)}` : null;
}

export function toVitrine(business, { npa }) {
  const notes = [];
  const need = (field) => {
    if (typeof business?.[field] !== 'string' || business[field].trim() === '') {
      throw new Error(`champ obligatoire manquant : ${field}`);
    }
    return business[field].trim();
  };
  // Some drafts use the French key "nom".
  if (business && typeof business.name !== 'string' && typeof business.nom === 'string') {
    business = { ...business, name: business.nom };
  }
  const name = need('name');
  const capitalCity = need('hq');
  const bestProduct = need('flagship_product');

  const zone = [];
  const badZones = [];
  for (const z of Array.isArray(business.zone) ? business.zone : []) {
    const s = String(z).trim();
    if (!/^[1-9][0-9]{3}$/.test(s)) badZones.push(s);
    else if (!zone.includes(s)) zone.push(s);
  }
  if (badZones.length) notes.push(`zones ignorées : ${badZones.join(', ')}`);
  if (!zone.length) throw new Error('aucune zone valide');
  const unknown = unknownNote(zone, npa);
  if (unknown) notes.push(unknown);

  const { cacao, dropped } = normalizeCacao(business.cocoa);
  if (dropped.length) notes.push(`cacao ignoré : ${dropped.join(', ')}`);

  const funds = Number(business.funds);
  const payload = {
    name,
    zone,
    capital: Number.isFinite(funds) ? Math.max(0, Math.trunc(funds)) : NaN,
    capitalCity,
    cacao,
    bestProduct,
  };
  const checked = validatePayload('chocolaterie', payload);
  if (!checked.ok) throw new Error(checked.reason);
  return { payload: checked.value, notes };
}

export function checkPayload(payload, { npa }) {
  const checked = validatePayload('chocolaterie', payload);
  if (!checked.ok) throw new Error(checked.reason);
  const note = unknownNote(checked.value.zone, npa);
  return { payload: checked.value, notes: note ? [note] : [] };
}

/** Per-folder logic shared by `pnpm convert` and `pnpm feed`. Writes nothing. */
export function collectFamilies({ common, npa, readDir, readFile, exists }) {
  const results = [];
  for (const folder of [...readDir(common)].filter((f) => !f.startsWith('.')).sort()) {
    const id = slug(folder);
    const contract = join(common, folder, 'chocolaterie.json');
    const draft = join(common, folder, 'business.json');
    try {
      if (exists(contract)) {
        const parsed = parseLenient(readFile(contract));
        if (!parsed.ok) throw new Error(parsed.reason);
        const { payload, notes } = checkPayload(parsed.value, { npa });
        results.push({ slug: id, status: 'contrat', payload, notes });
      } else if (exists(draft)) {
        const parsed = parseLenient(readFile(draft));
        if (!parsed.ok) throw new Error(parsed.reason);
        const { payload, notes } = toVitrine(parsed.value, { npa });
        results.push({
          slug: id,
          status: parsed.repaired.length ? 'réparé' : 'ok',
          payload,
          notes: [...parsed.repaired.map((r) => `réparé : ${r}`), ...notes],
        });
      } else {
        results.push({ slug: id, status: 'ignoré', notes: ['aucun chocolaterie.json ni business.json'] });
      }
    } catch (err) {
      results.push({ slug: id, status: 'ignoré', notes: [String(err.message)] });
    }
  }
  return results;
}
