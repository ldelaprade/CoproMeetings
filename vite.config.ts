
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    watch: {
      usePolling: true
    }
  },
  optimizeDeps: {
    // On n'inclut plus sql.js car il est chargé via un script tag classique
    exclude: ['sql.js']
  }
});
