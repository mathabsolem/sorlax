import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@render': fileURLToPath(new URL('./src/render', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@input': fileURLToPath(new URL('./src/input', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@net': fileURLToPath(new URL('./src/net', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://deine-domain.tld',
        changeOrigin: true,
        secure: true
      }
    }
  },
  build: { target: 'es2022', assetsInlineLimit: 0 }
});
