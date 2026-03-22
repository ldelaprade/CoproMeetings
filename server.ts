import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(__dirname, "database.sqlite");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware pour gérer les données binaires (le fichier SQLite exporté)
  app.use("/api/db", bodyParser.raw({ type: "application/octet-stream", limit: "50mb" }));

  // API: Récupérer le fichier de base de données
  app.get("/api/db", (req, res) => {
    if (fs.existsSync(DB_FILE_PATH)) {
      res.sendFile(DB_FILE_PATH);
    } else {
      res.status(404).send("Base de données non trouvée sur le serveur.");
    }
  });

  // API: Sauvegarder le fichier de base de données
  app.post("/api/db", (req, res) => {
    try {
      fs.writeFileSync(DB_FILE_PATH, req.body);
      console.log("Base de données mise à jour sur le serveur.");
      res.json({ status: "ok" });
    } catch (err) {
      console.error("Erreur lors de la sauvegarde de la DB:", err);
      res.status(500).send("Erreur serveur.");
    }
  });

  // API Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", dbExists: fs.existsSync(DB_FILE_PATH) });
  });

  // Vite middleware pour le développement
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // En production, servir les fichiers statiques
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur Co-Vote démarré sur http://localhost:${PORT}`);
    console.log(`Endpoint DB: http://localhost:${PORT}/api/db`);
  });
}

startServer();
