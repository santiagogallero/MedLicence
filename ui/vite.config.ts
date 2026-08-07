import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Apunta directo al source del api: no hace falta build step.
      '@medlicense/api': fileURLToPath(new URL('../api/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5173 },
});
