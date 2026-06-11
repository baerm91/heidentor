import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              return 'three';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('gsap') || id.includes('scheduler')) {
              return 'vendor';
            }
          }
        }
      }
    }
  }
});
