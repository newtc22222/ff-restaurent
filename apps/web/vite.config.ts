import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ff-restaurent/shared': path.resolve(
        __dirname,
        '../../packages/shared/src/index.ts',
      ),
    },
  },
  server: {
    port: 5173,
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
