export const VALID_VITRINE = JSON.stringify({
  v: 2,
  id: '3d6b1c52-7e0a-4c1e-9f55-2a4c8e6b9d10',
  from: 'maison-dubois',
  to: '*',
  ts: '2026-11-04T09:00:00Z',
  type: 'chocolaterie',
  payload: {
    name: 'Maison Dubois',
    zone: ['1003', '1004', '1800'],
    capital: 250000,
    capitalCity: 'Lausanne',
    cacao: ['criollo', 'trinitario'],
    bestProduct: 'Truffe au Gruyère',
    founded: 1921,
    fairtrade: true,
  },
});

export const VITRINE_PAYLOAD = JSON.parse(VALID_VITRINE).payload;

/** Envelope object from the valid fixture with overrides (a key set to undefined is removed). */
export function envelope(overrides = {}) {
  const env = { ...JSON.parse(VALID_VITRINE), ...overrides };
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  return env;
}

export function envelopeJson(overrides = {}) {
  return JSON.stringify(envelope(overrides));
}

const withPayload = (changes) => {
  const p = { ...VITRINE_PAYLOAD, ...changes };
  for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
  return envelopeJson({ payload: p });
};

const V = 'elchoco/vitrine/maison-dubois';

/** Each entry must be rejected when ingested on its topic. */
export const HOSTILE = [
  { name: 'plain text', topic: V, raw: 'bonjour le cartel' },
  { name: 'empty array', topic: V, raw: '[]' },
  { name: 'null', topic: V, raw: 'null' },
  { name: 'v 3 (unsupported)', topic: V, raw: envelopeJson({ v: 3 }) },
  { name: 'no payload', topic: V, raw: envelopeJson({ payload: undefined }) },
  { name: 'bad ts', topic: V, raw: envelopeJson({ ts: 'hier' }) },
  { name: 'bad id', topic: V, raw: envelopeJson({ id: '42' }) },
  { name: 'missing bestProduct', topic: V, raw: withPayload({ bestProduct: undefined }) },
  { name: 'capital string', topic: V, raw: withPayload({ capital: 'beaucoup' }) },
  { name: 'capital float', topic: V, raw: withPayload({ capital: 1.5 }) },
  { name: 'cacao sucre', topic: V, raw: withPayload({ cacao: ['sucre'] }) },
  { name: 'zone short', topic: V, raw: withPayload({ zone: ['12'] }) },
  { name: 'zone number', topic: V, raw: withPayload({ zone: [1003] }) },
  {
    name: 'presence dead',
    topic: 'elchoco/presence/maison-dubois',
    raw: envelopeJson({ type: 'presence', payload: { state: 'dead' } }),
  },
  {
    name: 'log debug',
    topic: 'elchoco/log/maison-dubois',
    raw: envelopeJson({ type: 'log', payload: { level: 'debug', text: 'x' } }),
  },
  { name: 'unknown type', topic: V, raw: envelopeJson({ type: 'caisse' }) },
  { name: 'spoof', topic: 'elchoco/vitrine/x', raw: envelopeJson({ from: 'y' }) },
];
