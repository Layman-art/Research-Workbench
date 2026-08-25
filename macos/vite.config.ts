import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  root,
  base: './',
  clearScreen: false,
  server: { port: 1430, strictPort: true },
  test: { environment: 'jsdom', setupFiles: [fileURLToPath(new URL('./src/test/setup.ts', import.meta.url))], exclude: ['src/test/e2e/**','node_modules/**','dist/**'], css: true },
});
