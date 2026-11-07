/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => {
  // `vite build --mode standalone` produces one self-contained HTML file
  // that opens directly from disk (local demo backend, hash-based routes).
  const standalone = mode === 'standalone';
  return {
    base: standalone ? './' : '/',
    plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
    define: { __STANDALONE__: JSON.stringify(standalone) },
    resolve: {
      alias: [
        { find: '@', replacement: src('./src') },
        ...(standalone ? [{ find: /^firebase\/.*$/, replacement: src('./src/services/firebaseStub.ts') }] : []),
      ],
    },
    build: standalone
      ? { target: 'es2020', outDir: 'dist-standalone', assetsInlineLimit: 100_000_000 }
      : {
          target: 'es2020',
          rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] } } },
        },
    test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
  };
});
