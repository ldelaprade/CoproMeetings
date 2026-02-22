// Simple Express.js server to serve the React build (ESM syntax)
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Chemin absolu de la base SQLite dans le répertoire courant
const DB_PATH = path.join(process.cwd(), 'condominium.sqlite');

// Parse le corps binaire pour la route POST /api/db
app.use('/api/db', express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// GET /api/info — permet au client de détecter le mode "express-server"
app.get('/api/info', (req, res) => {
  res.json({ mode: 'express-server', dbPath: DB_PATH });
});

// GET /api/db — retourne le fichier SQLite existant
app.get('/api/db', (req, res) => {
  if (!fs.existsSync(DB_PATH)) {
    return res.status(404).json({ exists: false, path: DB_PATH });
  }
  const data = fs.readFileSync(DB_PATH);
  res.set('Content-Type', 'application/octet-stream');
  res.send(data);
});

// POST /api/db — sauvegarde le fichier SQLite depuis le client
app.post('/api/db', (req, res) => {
  fs.writeFileSync(DB_PATH, req.body);
  res.json({ success: true, path: DB_PATH });
});

// Serve static files from the dist directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA routing (compatible Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});
