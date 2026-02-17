
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Vite remplacera 'process.env.API_KEY' dans votre code par la valeur ci-dessous.
    // N'oubliez pas de mettre votre vraie clé ici pour que l'IA fonctionne.
    'process.env.API_KEY': JSON.stringify('VOTRE_CLE_API_ICI')
  },
  server: {
    port: 3000,
    open: true,
    // Nécessaire pour certains environnements Windows/WSL
    watch: {
      usePolling: true
    }
  },
  optimizeDeps: {
    // Force l'inclusion de sql.js si Vite a du mal à le détecter
    exclude: ['sql.js']
  }
});
