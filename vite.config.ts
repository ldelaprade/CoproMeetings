
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
    // On retire 'sql.js' de l'exclusion pour que Vite puisse le traiter comme un module compatible
    include: ['sql.js']
  }
});
