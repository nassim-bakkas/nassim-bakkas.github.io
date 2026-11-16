import { defineConfig } from 'vite';

// Relative paths, so the built site works at any address (GitHub Pages included).
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' }
    }
  }
});
