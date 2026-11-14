export const TOPIC_TYPES = { vitrine: 'chocolaterie', presence: 'presence', time: 'time', log: 'log' };

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPE_RE = /^[a-z][a-z0-9-]*$/;
const NPA_RE = /^[1-9][0-9]{3}$/;
const HB_RE = /^hb( [a-z]+=\d+)+$/;
const CACAO = ['criollo', 'trinitario', 'forastero', 'nacional'];
const ENV_KEYS = ['v', 'id', 'from', 'to', 'ts', 'type', 'payload'];

const isPlainObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const isNonEmptyString = (x) => typeof x === 'string' && x.length > 0;
const isIsoDate = (x) => typeof x === 'string' && !Number.isNaN(Date.parse(x));

export function parseTopic(root, topic) {
  if (typeof topic !== 'string' || !topic.startsWith(`${root}/`)) {
    return topic === root ? { kind: 'unknown', sub: '' } : { kind: 'other' };
  }
  const parts = topic.slice(root.length + 1).split('/');
  const [first, second] = parts;
  if (first === 'time' && parts.length === 1) return { kind: 'time' };
  if (
    (first === 'vitrine' || first === 'presence' || first === 'log') &&
    parts.length === 2 &&
    SLUG_RE.test(second)
  ) {
    return { kind: first, family: second };
  }
  return { kind: 'unknown', sub: first };
}

export function parseMessage(raw) {
  let env;
  try {
    env = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'JSON invalide' };
  }
  if (!isPlainObject(env)) return { ok: false, reason: 'enveloppe : objet attendu' };
  const keys = Object.keys(env);
  if (keys.length !== ENV_KEYS.length || !ENV_KEYS.every((k) => k in env)) {
    return { ok: false, reason: 'enveloppe : champs inattendus ou manquants' };
  }
  if (env.v !== 1) return { ok: false, reason: 'v doit valoir 1' };
  if (typeof env.id !== 'string' || !UUID_RE.test(env.id)) return { ok: false, reason: 'id invalide' };
  if (!isNonEmptyString(env.from)) return { ok: false, reason: 'from invalide' };
  if (!isNonEmptyString(env.to)) return { ok: false, reason: 'to invalide' };
  if (!isIsoDate(env.ts)) return { ok: false, reason: 'ts invalide' };
  if (typeof env.type !== 'string' || !TYPE_RE.test(env.type)) return { ok: false, reason: 'type invalide' };
  if (!isPlainObject(env.payload)) return { ok: false, reason: 'payload invalide' };
  return { ok: true, env };
}

function uniqueStrings(arr, test) {
  return (
    Array.isArray(arr) &&
    arr.length > 0 &&
    arr.every((x) => typeof x === 'string' && test(x)) &&
    new Set(arr).size === arr.length
  );
}

function validateChocolaterie(p) {
  if (!isNonEmptyString(p.name)) return { ok: false, reason: 'name invalide' };
  if (!uniqueStrings(p.zone, (z) => NPA_RE.test(z))) return { ok: false, reason: 'zone invalide' };
  if (!Number.isInteger(p.capital) || p.capital < 0) return { ok: false, reason: 'capital invalide' };
  if (!isNonEmptyString(p.capitalCity)) return { ok: false, reason: 'capitalCity invalide' };
  if (!uniqueStrings(p.cacao, (c) => CACAO.includes(c))) return { ok: false, reason: 'cacao invalide' };
  if (!isNonEmptyString(p.bestProduct)) return { ok: false, reason: 'bestProduct invalide' };
  const value = {
    name: p.name,
    zone: [...p.zone],
    capital: p.capital,
    capitalCity: p.capitalCity,
    cacao: [...p.cacao],
    bestProduct: p.bestProduct,
  };
  if (p.founded !== undefined) {
    if (!Number.isInteger(p.founded) || p.founded < 1500 || p.founded > 2100) {
      return { ok: false, reason: 'founded invalide' };
    }
    value.founded = p.founded;
  }
  if (p.fairtrade !== undefined) {
    if (typeof p.fairtrade !== 'boolean') return { ok: false, reason: 'fairtrade invalide' };
    value.fairtrade = p.fairtrade;
  }
  if (p.logo !== undefined) {
    if (typeof p.logo !== 'string') return { ok: false, reason: 'logo invalide' };
    value.logo = p.logo;
  }
  return { ok: true, value };
}

export function validatePayload(type, payload) {
  if (!isPlainObject(payload)) return { ok: false, reason: 'payload invalide' };
  switch (type) {
    case 'chocolaterie':
      return validateChocolaterie(payload);
    case 'presence':
      return ['open', 'closed', 'died'].includes(payload.state)
        ? { ok: true, value: { state: payload.state } }
        : { ok: false, reason: 'state invalide' };
    case 'time':
      return isIsoDate(payload.utc) ? { ok: true, value: { utc: payload.utc } } : { ok: false, reason: 'utc invalide' };
    case 'log':
      if (!['info', 'warn', 'error'].includes(payload.level)) return { ok: false, reason: 'level invalide' };
      if (!isNonEmptyString(payload.text)) return { ok: false, reason: 'text invalide' };
      return { ok: true, value: { level: payload.level, text: payload.text } };
    default:
      return { ok: false, reason: `type inconnu : ${type}` };
  }
}

export function isHeartbeat(payload) {
  return payload?.level === 'info' && typeof payload.text === 'string' && HB_RE.test(payload.text);
}
