import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  server: {
    port: 5173,
    // Reachable from the classroom LAN on purpose (see the HUD spec).
    host: true,
    // The dev server only serves the web folder and node_modules, never .env or editor backups.
    fs: { strict: true, allow: ['.', '../node_modules'], deny: ['.env*', '**/*~', '../.env*', '../**/*~'] },
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
});
