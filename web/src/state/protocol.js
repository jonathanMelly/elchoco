export const TOPIC_TYPES = { vitrine: 'chocolaterie', presence: 'presence', time: 'time', log: 'log', directory: 'directory', status: 'status' };

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPE_RE = /^[a-z][a-z0-9-]*$/;
const NPA_RE = /^[1-9][0-9]{3}$/;
const HB_RE = /^hb( [a-z]+=\d+)+$/;
const CACAO = ['criollo', 'trinitario', 'forastero', 'nacional'];
const ENV_KEYS = ['v', 'id', 'from', 'to', 'ts', 'type', 'payload'];

// Wire-contract versions, mirrored from elchoco-common/shared/lib/src/versions.js (see its contracts README, "Versionnement").
// v2 is a tolerant reader (unknown envelope/payload fields ignored); v1 is deprecated: still read, degraded, until retiredOn.
export const VERSIONS = {
  1: { status: 'deprecated', retiredOn: '2026-12-12' },
  2: { status: 'current' },
};
export const PUBLISH_VERSION = 2;
export const retiredOnLabel = (v) => (VERSIONS[v]?.retiredOn ?? '').split('-').reverse().join('.');

/** 'current' | 'deprecated' | 'retired' | 'unsupported' */
export function versionStatus(v, now = Date.now()) {
  const info = Number.isInteger(v) ? VERSIONS[v] : undefined;
  if (!info) return 'unsupported';
  if (info.retiredOn && now >= Date.parse(`${info.retiredOn}T00:00:00Z`)) return 'retired';
  return info.status;
}

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
  if (first === 'directory' && parts.length === 1) return { kind: 'directory' };
  if (first === 'status' && parts.length === 2 && SLUG_RE.test(second)) return { kind: 'status', orderId: second };
  if (
    (first === 'vitrine' || first === 'presence' || first === 'log') &&
    parts.length === 2 &&
    SLUG_RE.test(second)
  ) {
    return { kind: first, family: second };
  }
  return { kind: 'unknown', sub: first };
}

/** ok:true carries `version` and `degraded` (deprecated version: v1 rules, no v2 features). */
export function parseMessage(raw, { now = Date.now() } = {}) {
  let env;
  try {
    env = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'JSON invalide' };
  }
  if (!isPlainObject(env)) return { ok: false, reason: 'enveloppe : objet attendu' };
  const status = versionStatus(env.v, now);
  if (status === 'retired') return { ok: false, reason: `version v${env.v} retirée depuis le ${retiredOnLabel(env.v)}` };
  if (status === 'unsupported') return { ok: false, reason: 'version non supportée' };
  const keys = Object.keys(env);
  // v1 forbade unknown envelope fields; v2 ignores them.
  const strict = env.v === 1;
  if (!ENV_KEYS.every((k) => k in env) || (strict && keys.length !== ENV_KEYS.length)) {
    return { ok: false, reason: 'enveloppe : champs inattendus ou manquants' };
  }
  if (typeof env.id !== 'string' || !UUID_RE.test(env.id)) return { ok: false, reason: 'id invalide' };
  if (!isNonEmptyString(env.from)) return { ok: false, reason: 'from invalide' };
  if (!isNonEmptyString(env.to)) return { ok: false, reason: 'to invalide' };
  if (!isIsoDate(env.ts)) return { ok: false, reason: 'ts invalide' };
  if (typeof env.type !== 'string' || !TYPE_RE.test(env.type)) return { ok: false, reason: 'type invalide' };
  if (!isPlainObject(env.payload)) return { ok: false, reason: 'payload invalide' };
  return { ok: true, env, version: env.v, degraded: status === 'deprecated' };
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

export function validatePayload(type, payload, version = PUBLISH_VERSION) {
  if (!isPlainObject(payload)) return { ok: false, reason: 'payload invalide' };
  switch (type) {
    case 'chocolaterie':
      return validateChocolaterie(payload);
    case 'presence':
      if (!['open', 'closed', 'died'].includes(payload.state)) return { ok: false, reason: 'state invalide' };
      // `kind` exists from v2 on; a v1 message is read without it (degraded).
      if (version >= 2 && payload.kind !== undefined) {
        if (!['service', 'family'].includes(payload.kind)) return { ok: false, reason: 'kind invalide' };
        return { ok: true, value: { state: payload.state, kind: payload.kind } };
      }
      return { ok: true, value: { state: payload.state } };
    case 'directory': {
      // Only what the registry card shows: how many houses, how many open.
      if (!isIsoDate(payload.asOf) || !Array.isArray(payload.houses)) return { ok: false, reason: 'directory invalide' };
      const houses = payload.houses.filter(isPlainObject);
      return { ok: true, value: { asOf: payload.asOf, entries: houses.length, open: houses.filter((h) => h.state === 'open').length } };
    }
    case 'status':
      if (!isNonEmptyString(payload.orderId) || !['received', 'proposed', 'reserved', 'failed'].includes(payload.state)) return { ok: false, reason: 'status invalide' };
      return { ok: true, value: { orderId: payload.orderId, state: payload.state } };
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
