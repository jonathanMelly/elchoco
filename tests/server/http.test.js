import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { request } from 'node:http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHudServer } from '../../server/http.js';

const SECRET = 'TOP-SECRET-PASSWORD';
let tmp, server, port;

const raw = (p, method = 'GET') =>
  new Promise((resolve, reject) => {
    const r = request({ host: '127.0.0.1', port, path: p, method }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    r.on('error', reject);
    r.end();
  });

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hud-'));
  const dist = path.join(tmp, 'dist');
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<h1>hud</h1>');
  fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dist, '.env'), SECRET);
  fs.writeFileSync(path.join(tmp, 'secret.env'), SECRET);
  const relay = { handleEvents: (req, res) => { res.writeHead(200); res.end('relay'); } };
  server = createHudServer({ relay, staticDir: dist });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('createHudServer', () => {
  it('delegates GET /events to the relay', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/events`);
    expect(await res.text()).toBe('relay');
  });

  it('serves index.html on /', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/html/);
    expect(await res.text()).toContain('<h1>hud</h1>');
  });

  it('serves js with a javascript content type', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/assets/app.js`);
    expect(res.headers.get('content-type')).toMatch(/^text\/javascript/);
  });

  it('404 on unknown file', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/nope.txt`);
    expect(res.status).toBe(404);
  });

  it('405 on POST', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' });
    expect(res.status).toBe(405);
  });

  it.each(['/../secret.env', '/%2e%2e/secret.env', '/..%2fsecret.env', '/.env', '/assets/../.env', '/%00'])(
    'traversal %s never leaks a file',
    async (p) => {
      const res = await raw(p);
      expect(res.status).toBe(404);
      expect(res.body).not.toContain(SECRET);
    },
  );
});

describe('Host validation (DNS rebinding)', () => {
  const get = (host) =>
    new Promise((resolve, reject) => {
      const r = request({ host: '127.0.0.1', port: guarded.address().port, path: '/events', headers: { Host: host } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      r.on('error', reject);
      r.end();
    });
  let guarded;
  beforeAll(async () => {
    const relay = { handleEvents: (req, res) => { res.writeHead(200); res.end('relay'); } };
    guarded = createHudServer({ relay, staticDir: tmp, allowedHosts: ['localhost', '127.0.0.1', '[::1]'] });
    await new Promise((r) => guarded.listen(0, '127.0.0.1', r));
  });
  afterAll(() => new Promise((r) => guarded.close(r)));

  it.each(['localhost:3000', '127.0.0.1:3000', '[::1]:3000', 'localhost'])('accepts %s', async (h) => {
    expect(await get(h)).toBe(200);
  });
  it.each(['evil.example:3000', 'localhost.evil.example'])('rejects %j with 403', async (h) => {
    expect(await get(h)).toBe(403);
  });
});
