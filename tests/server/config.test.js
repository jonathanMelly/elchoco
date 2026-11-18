import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dotenv', () => ({ default: { config: () => {} } }));

const KEYS = ['QOS', 'HUD_ROOT', 'HUD_HOST', 'HUD_PORT', 'HUD_FAMILY'];
const saved = {};
const load = async (env = {}) => {
  vi.resetModules();
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  return (await import('../../src/config.js')).default;
};

beforeEach(() => { for (const k of KEYS) saved[k] = process.env[k]; });
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('config', () => {
  it('qos defaults to 1', async () => expect((await load()).qos).toBe(1));
  it('qos 2', async () => expect((await load({ QOS: '2' })).qos).toBe(2));
  it('qos 0', async () => expect((await load({ QOS: '0' })).qos).toBe(0));
  it.each(['7', 'abc'])('qos falls back to 1 for %s', async (v) => expect((await load({ QOS: v })).qos).toBe(1));
  it('hudHost defaults to loopback', async () => expect((await load()).hudHost).toBe('127.0.0.1'));
  it('hudHost override', async () => expect((await load({ HUD_HOST: '0.0.0.0' })).hudHost).toBe('0.0.0.0'));
  it('hudPort defaults to 3000', async () => expect((await load()).hudPort).toBe(3000));
  it('hudPort override', async () => expect((await load({ HUD_PORT: '4100' })).hudPort).toBe(4100));
  it('hudRoot defaults to elchoco', async () => expect((await load()).hudRoot).toBe('elchoco'));
});

describe('config hudFamily', () => {
  it('is disabled by default', async () => expect((await load()).hudFamily).toBe(''));
  it('reads HUD_FAMILY', async () => {
    expect((await load({ HUD_FAMILY: 'don-freey' })).hudFamily).toBe('don-freey');
  });
});
