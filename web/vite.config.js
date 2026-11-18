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

export default defineConfig(async () => ({
  root: 'web',
  server: {
    port: await findPort(5173),
    // Reachable from the classroom LAN on purpose (see the HUD spec).
    host: true,
    // The dev server only serves the web folder and node_modules, never .env or editor backups.
    fs: { strict: true, allow: ['.', '../node_modules'], deny: ['.env*', '**/*~', '../.env*', '../**/*~'] },
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
}));
