import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dotenv/config', () => ({}));

let saved;
beforeEach(() => { saved = { HUD_PORT: process.env.HUD_PORT, HUD_HOST: process.env.HUD_HOST }; });
afterEach(() => {
  for (const [k, val] of Object.entries(saved)) {
    if (val === undefined) delete process.env[k];
    else process.env[k] = val;
  }
});

const resolve = async () => {
  vi.resetModules();
  const mod = await import('../../web/vite.config.js');
  const cfg = mod.default;
  return typeof cfg === 'function' ? cfg({ command: 'serve', mode: 'test' }) : cfg;
};

describe('vite config', () => {
  it('proxies /events to the default backend port', async () => {
    delete process.env.HUD_PORT;
    expect((await resolve()).server.proxy['/events'].target).toBe('http://127.0.0.1:3000');
  });

  it('proxies /events to HUD_PORT', async () => {
    process.env.HUD_PORT = '4100';
    expect((await resolve()).server.proxy['/events'].target).toBe('http://127.0.0.1:4100');
  });

  it.each([[undefined, true], ['127.0.0.1', true], ['localhost', true], ['0.0.0.0', false]])(
    'HUD_HOST=%s -> changeOrigin %s (loopback Host check needs a rewritten Host)',
    async (host, expected) => {
      if (host === undefined) delete process.env.HUD_HOST;
      else process.env.HUD_HOST = host;
      expect((await resolve()).server.proxy['/events'].changeOrigin).toBe(expected);
    },
  );

  it('injects nothing from .env into the bundle', async () => {
    expect(await resolve()).not.toHaveProperty('define');
  });
});
