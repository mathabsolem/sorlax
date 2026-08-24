/**
 * Aufbau des Prototyps als eine einzige Datei.
 *
 * Eigener Einstiegspunkt, damit nichts in gemeinsame Bloecke gesplittet wird:
 * scripts/buildPrototype.ts naeht danach JavaScript, CSS und die Texturen in
 * eine HTML-Datei, die ohne Server laeuft.
 */
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
      '@net': fileURLToPath(new URL('./src/net', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    outDir: 'dist-prototype',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./prototype.html', import.meta.url)),
      output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' },
    },
  },
});
