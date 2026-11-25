import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mediaSizes } from './tools/media-plugin';
import { studio } from './tools/studio-plugin';
import { seo } from './tools/seo-plugin';

export default defineConfig({
  base: './',
  plugins: [react(), mediaSizes(), seo(), studio()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion';
        },
      },
    },
  },
  server: { port: 5180 },
});
