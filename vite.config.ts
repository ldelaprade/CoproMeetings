
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    watch: {
      usePolling: true
    },
    // Proxy API calls to the Express server during development
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    // On n'inclut plus sql.js car il est chargé via un script tag classique
    exclude: ['sql.js']
  }
});
