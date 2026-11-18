import 'dotenv/config';
import net from 'node:net';
import { defineConfig } from 'vite';

// True when nothing is listening on host:port (specific-address binds do not conflict with wildcard binds on Windows).
const isFree = (port, host) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', (e) => resolve(e.code !== 'EADDRINUSE'));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, host);
  });

// Vite only sees conflicts on the exact address it binds, so check every loopback family ourselves.
async function findPort(start) {
  for (let port = start; port < start + 50; port++) {
    const results = await Promise.all(['::1', '127.0.0.1', '0.0.0.0'].map((h) => isFree(port, h)));
    if (results.every(Boolean)) return port;
  }
  return start;
}

// The backend (pnpm hud:serve) owns the broker connection; the dev server only proxies its SSE stream.
// The backend rejects non-loopback Host headers (DNS rebinding guard) when HUD_HOST is a loopback address, so
// the dev proxy must rewrite Host to the backend's own (changeOrigin) or a LAN visitor on http://<ip>:5173
// would get 403. With HUD_HOST=0.0.0.0 the guard is off and the original Host is kept. Trade-off: while
// rewriting, the guard no longer protects /events when it is reached through this dev server (dev only).
const loopbackBackend = ['127.0.0.1', 'localhost', '::1'].includes(process.env.HUD_HOST ?? '127.0.0.1');
const backend = `http://127.0.0.1:${process.env.HUD_PORT ?? 3000}`;

export default defineConfig(async () => ({
  root: 'web',
  server: {
    port: await findPort(5173),
    // Reachable from the classroom LAN on purpose (see the HUD spec).
    host: true,
    proxy: { '/events': { target: backend, changeOrigin: loopbackBackend } },
    // The dev server only serves the web folder and node_modules, never .env or editor backups.
    fs: { strict: true, allow: ['.', '../node_modules'], deny: ['.env*', '**/*~', '../.env*', '../**/*~'] },
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
}));
