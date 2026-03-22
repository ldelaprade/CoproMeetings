import express from "express";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The SQLite file will be saved in the same directory as this script
const DB_FILE_PATH = path.join(__dirname, "database.sqlite");

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS so the frontend can make requests to this backend
app.use(cors({
  origin: '*', // In production, replace '*' with your actual frontend URL for better security
  methods: ['GET', 'POST']
}));

// Middleware to handle binary data (the exported SQLite file)
app.use("/api/db", bodyParser.raw({ type: "application/octet-stream", limit: "50mb" }));

// API: Get the database file
app.get("/api/db", (req, res) => {
  if (fs.existsSync(DB_FILE_PATH)) {
    res.sendFile(DB_FILE_PATH);
  } else {
    res.status(404).send("Database not found on the server.");
  }
});

// API: Save the database file
app.post("/api/db", (req, res) => {
  try {
    fs.writeFileSync(DB_FILE_PATH, req.body);
    console.log("Database updated on the server.");
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Error saving DB:", err);
    res.status(500).send("Server error.");
  }
});

// API: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", dbExists: fs.existsSync(DB_FILE_PATH) });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Standalone Co-Vote Backend running on http://localhost:${PORT}`);
  console.log(`DB Endpoint: http://localhost:${PORT}/api/db`);
});
