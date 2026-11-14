import { describe, it, expect } from 'vitest';
import {
  TOPIC_TYPES,
  parseTopic,
  parseMessage,
  validatePayload,
  isHeartbeat,
} from '../../web/src/state/protocol.js';
import { VALID_VITRINE, VITRINE_PAYLOAD, envelopeJson } from './fixtures.js';

describe('TOPIC_TYPES', () => {
  it('maps kinds to envelope types', () => {
    expect(TOPIC_TYPES).toEqual({ vitrine: 'chocolaterie', presence: 'presence', time: 'time', log: 'log' });
  });
});

describe('parseTopic', () => {
  it('parses family topics', () => {
    expect(parseTopic('elchoco', 'elchoco/vitrine/don-freey')).toEqual({ kind: 'vitrine', family: 'don-freey' });
    expect(parseTopic('elchoco', 'elchoco/presence/a1')).toEqual({ kind: 'presence', family: 'a1' });
    expect(parseTopic('elchoco', 'elchoco/log/a1')).toEqual({ kind: 'log', family: 'a1' });
  });
  it('parses time', () => {
    expect(parseTopic('elchoco', 'elchoco/time')).toEqual({ kind: 'time' });
  });
  it('marks other topics under the root as unknown', () => {
    expect(parseTopic('elchoco', 'elchoco/caisse/don-freey')).toEqual({ kind: 'unknown', sub: 'caisse' });
    expect(parseTopic('elchoco', 'elchoco/vitrine/a/b')).toEqual({ kind: 'unknown', sub: 'vitrine' });
    expect(parseTopic('elchoco', 'elchoco/vitrine')).toEqual({ kind: 'unknown', sub: 'vitrine' });
    expect(parseTopic('elchoco', 'elchoco/vitrine/Bad Slug')).toEqual({ kind: 'unknown', sub: 'vitrine' });
  });
  it('marks topics outside the root as other', () => {
    expect(parseTopic('elchoco', 'chat/all')).toEqual({ kind: 'other' });
    expect(parseTopic('elchoco', 'elchocolat/x')).toEqual({ kind: 'other' });
  });
});

describe('parseMessage', () => {
  it('accepts the valid fixture', () => {
    const r = parseMessage(VALID_VITRINE);
    expect(r.ok).toBe(true);
    expect(r.env.from).toBe('maison-dubois');
  });
  it.each([
    ['plain text', 'bonjour le cartel'],
    ['array', '[]'],
    ['null', 'null'],
    ['empty', ''],
    ['v 2', envelopeJson({ v: 2 })],
    ['no payload', envelopeJson({ payload: undefined })],
    ['array payload', envelopeJson({ payload: [] })],
    ['bad ts', envelopeJson({ ts: 'hier' })],
    ['bad id', envelopeJson({ id: '42' })],
    ['extra key', envelopeJson({ x: 1 })],
    ['empty from', envelopeJson({ from: '' })],
    ['bad type', envelopeJson({ type: 'Bad Type' })],
  ])('rejects %s', (_n, raw) => {
    const r = parseMessage(raw);
    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe('string');
  });
});

describe('validatePayload chocolaterie', () => {
  it('accepts the fixture payload', () => {
    expect(validatePayload('chocolaterie', VITRINE_PAYLOAD)).toEqual({ ok: true, value: VITRINE_PAYLOAD });
  });
  it('drops unknown fields', () => {
    const r = validatePayload('chocolaterie', { ...VITRINE_PAYLOAD, color: 'brun' });
    expect(r.ok).toBe(true);
    expect(r.value).not.toHaveProperty('color');
  });
  it.each([
    ['zone number', { zone: [1003] }],
    ['zone short', { zone: ['12'] }],
    ['zone dup', { zone: ['1003', '1003'] }],
    ['zone empty', { zone: [] }],
    ['cacao sucre', { cacao: ['sucre'] }],
    ['cacao empty', { cacao: [] }],
    ['no bestProduct', { bestProduct: undefined }],
    ['capital string', { capital: 'beaucoup' }],
    ['capital float', { capital: 1.5 }],
    ['capital negative', { capital: -1 }],
    ['founded 1200', { founded: 1200 }],
  ])('rejects %s', (_n, changes) => {
    const p = { ...VITRINE_PAYLOAD, ...changes };
    for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
    expect(validatePayload('chocolaterie', p).ok).toBe(false);
  });
});

describe('validatePayload other types', () => {
  it('presence', () => {
    expect(validatePayload('presence', { state: 'open' }).ok).toBe(true);
    expect(validatePayload('presence', { state: 'dead' }).ok).toBe(false);
  });
  it('time', () => {
    expect(validatePayload('time', { utc: '2026-11-14T10:00:00Z' }).ok).toBe(true);
    expect(validatePayload('time', { utc: 'nope' }).ok).toBe(false);
  });
  it('log', () => {
    expect(validatePayload('log', { level: 'info', text: 'ok' }).ok).toBe(true);
    expect(validatePayload('log', { level: 'debug', text: 'x' }).ok).toBe(false);
    expect(validatePayload('log', { level: 'info', text: '' }).ok).toBe(false);
  });
  it('unknown type', () => {
    expect(validatePayload('caisse', {}).ok).toBe(false);
  });
});

describe('isHeartbeat', () => {
  it('detects hb log payloads', () => {
    expect(isHeartbeat({ level: 'info', text: 'hb sent=12 recv=40' })).toBe(true);
    expect(isHeartbeat({ level: 'info', text: 'hb' })).toBe(false);
    expect(isHeartbeat({ level: 'info', text: 'hb sent=-1' })).toBe(false);
    expect(isHeartbeat({ level: 'info', text: 'hello' })).toBe(false);
    expect(isHeartbeat({ level: 'warn', text: 'hb sent=1' })).toBe(false);
  });
});
