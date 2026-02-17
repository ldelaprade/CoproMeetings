
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Vite remplacera 'process.env.API_KEY' dans votre code par la valeur ci-dessous.
    'process.env.API_KEY': JSON.stringify('VOTRE_CLE_API_ICI')
  },
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
