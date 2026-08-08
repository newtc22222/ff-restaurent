import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

// Surfaced to the app as __APP_VERSION__ so the info dialog can report the
// shipped build without the version drifting from package.json.
const { version } = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string };

// public/sw.js ships with an __APP_VERSION__ placeholder in its cache name so
// every release auto-invalidates the previous build's cached assets without a
// hand-bumped cache version. public/ is copied verbatim by Vite (no define
// substitution), so the swap happens here once the file lands in outDir.
function stampServiceWorkerVersion(appVersion: string): Plugin {
  return {
    name: 'stamp-service-worker-version',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      const swPath = path.resolve(outDir, 'sw.js');
      if (!existsSync(swPath)) return;
      const contents = readFileSync(swPath, 'utf-8');
      writeFileSync(swPath, contents.replaceAll('__APP_VERSION__', appVersion));
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorkerVersion(version)],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ff-restaurent/shared': path.resolve(
        __dirname,
        '../../packages/shared/src/index.ts',
      ),
    },
  },
  server: {
    port: 5173,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('/node_modules/react-hot-toast/')) {
            return 'vendor-feedback';
          }
        },
      },
    },
  },
});
