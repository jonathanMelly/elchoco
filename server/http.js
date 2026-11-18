import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

// Maps a raw request URL to a file inside root, or null when it is unsafe or hidden.
function resolveFile(rawUrl, root) {
  const rawPath = rawUrl.split(/[?#]/)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const segments = decoded.split(/[\/]+/).filter(Boolean);
  if (segments.some((s) => s.startsWith('.'))) return null;
  const rel = segments.length ? segments.join(path.sep) : 'index.html';
  const base = path.resolve(root);
  const file = path.resolve(base, rel);
  return file.startsWith(base + path.sep) ? file : null;
}

// allowedHosts: hostnames (no port) accepted in the Host header; null disables the check (LAN binds).
const hostnameOf = (host = '') => (host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]);

export function createHudServer({ relay, staticDir, allowedHosts = null }) {
  return http.createServer(async (req, res) => {
    if (allowedHosts && !allowedHosts.includes(hostnameOf(req.headers.host).toLowerCase())) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    const pathname = req.url.split(/[?#]/)[0];
    if (req.method === 'GET' && pathname === '/events') {
      relay.handleEvents(req, res);
      return;
    }
    const file = resolveFile(req.url, staticDir);
    if (!file) return notFound(res);
    try {
      const st = await fs.promises.stat(file);
      if (!st.isFile()) return notFound(res);
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': st.size,
      });
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch {
      notFound(res);
    }
  });
}
