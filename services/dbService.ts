
import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

// Service de base de données SQLite (sql.js)
let db: any = null;
let fileHandle: FileSystemFileHandle | null = null;
let remoteUrl: string | null = null;
let ws: WebSocket | null = null;

const clientId = Math.random().toString(36).substring(2, 15);
const DB_STORAGE_KEY = 'covote_pro_sqlite_db_v6'; // Version bump for Base64 storage
const syncChannel = new BroadcastChannel('covote_sync');

function connectWebSocket(url: string) {
  if (ws) {
    ws.onclose = null; // Prevent reconnect loop
    ws.close();
  }
  
  try {
    const urlObj = new URL(url, window.location.origin);
    const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${urlObj.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("Connecté au serveur WebSocket pour les mises à jour en temps réel.");
    };
    
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'DB_UPDATED' && data.clientId !== clientId) {
          console.log("Mise à jour de la base de données reçue du serveur.");
          await reloadFromRemote();
        }
      } catch (e) {
        console.error("Erreur WS message:", e);
      }
    };
    
    ws.onclose = () => {
      console.log("Déconnecté du serveur WebSocket. Reconnexion dans 5s...");
      setTimeout(() => connectWebSocket(url), 5000);
    };
  } catch (e) {
    console.error("Erreur de connexion WebSocket:", e);
  }
}

async function reloadFromRemote() {
  if (!remoteUrl) return;
  try {
    const response = await fetch(remoteUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
      db = new SQL.Database(new Uint8Array(arrayBuffer));
      broadcastChange('DATA_CHANGED');
    }
  } catch (err) {
    console.error("Erreur lors du rechargement distant:", err);
  }
}

// Helper to convert Uint8Array to Base64 efficiently
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 to Uint8Array efficiently
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const broadcastChange = (type: string, payload?: any) => {
  syncChannel.postMessage({ type, payload, timestamp: Date.now() });
  window.dispatchEvent(new CustomEvent('covote_data_changed', { detail: { type, payload } }));
};

syncChannel.onmessage = async (event) => {
  if (event.data.type === 'DATA_CHANGED' && !remoteUrl) {
    // Reload from localStorage if not using remoteUrl
    await initDatabase();
    window.dispatchEvent(new CustomEvent('covote_data_changed', { detail: event.data }));
  }
};

/**
 * Initialise la base de données à partir d'un buffer, du stockage local ou d'une URL.
 */
export const initDatabase = async (buffer?: Uint8Array, url?: string) => {
  try {
    const SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl
    });

    if (buffer) {
      db = new SQL.Database(buffer);
      setupSchema();
      seedInitialData(); // Ensure demo data is correct/repaired
    } else if (url || remoteUrl) {
      const targetUrl = url || remoteUrl;
      const response = await fetch(targetUrl!);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        db = new SQL.Database(new Uint8Array(arrayBuffer));
        setupSchema();
        seedInitialData(); // Ensure demo data is correct/repaired
        remoteUrl = targetUrl!;
        if (url) connectWebSocket(url); // Only connect if it's a new URL
      } else if (response.status === 404) {
        // Si la base n'existe pas encore sur le serveur, on en crée une nouvelle
        console.log("Base distante non trouvée, création d'une nouvelle base...");
        db = new SQL.Database();
        setupSchema();
        seedInitialData();
        remoteUrl = targetUrl!;
        if (url) connectWebSocket(url);
        await persistDatabase(); // On la pousse immédiatement sur le serveur
      } else {
        throw new Error("Impossible de charger la base distante.");
      }
    } else {
      const savedDb = localStorage.getItem(DB_STORAGE_KEY);
      if (savedDb) {
        try {
          // Try Base64 first (v6), then fallback to JSON array (v5) if needed
          if (savedDb.startsWith('[') || savedDb.startsWith('{')) {
            db = new SQL.Database(new Uint8Array(JSON.parse(savedDb)));
          } else {
            db = new SQL.Database(base64ToUint8Array(savedDb));
          }
          setupSchema();
          seedInitialData(); // Ensure demo data is correct/repaired
        } catch (e) {
          console.error("Failed to parse saved DB, creating new one", e);
          db = new SQL.Database();
          setupSchema();
          seedInitialData();
          await persistDatabase();
        }
      } else {
        db = new SQL.Database();
        setupSchema();
        seedInitialData();
        await persistDatabase();
      }
    }
    return db;
  } catch (err) {
    console.error("SQL.js init failed", err);
    throw err;
  }
};

export const openLocalDatabaseFile = async () => {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{ description: 'SQLite', accept: { 'application/x-sqlite3': ['.sqlite', '.db'] } }]
    });
    fileHandle = handle;
    const file = await fileHandle!.getFile();
    const buffer = new Uint8Array(await file.arrayBuffer());
    await initDatabase(buffer);
    return { name: file.name, handle };
  } catch (err) { return null; }
};

export const createLocalDatabaseFile = async () => {
  try {
    const handle = await (window as any).showSaveFilePicker({ suggestedName: 'copro.sqlite' });
    fileHandle = handle;
    await initDatabase();
    setupSchema();
    seedInitialData();
    await persistDatabase();
    return { name: 'copro.sqlite', handle };
  } catch (err) { return null; }
};

export const persistDatabase = async () => {
  if (!db) return;
  try {
    const data = db.export();
    
    // Use Base64 for more efficient and reliable storage in localStorage
    const base64Data = uint8ArrayToBase64(data);
    try {
      localStorage.setItem(DB_STORAGE_KEY, base64Data);
    } catch (lsError) {
      console.error("LocalStorage persistence failed (likely quota exceeded):", lsError);
      // We still have the in-memory DB, but it won't survive a refresh
    }

    if (fileHandle) {
      try {
        const writable = await (fileHandle as any).createWritable();
        await writable.write(data);
        await writable.close();
      } catch (err) { console.error("Sync file failed", err); }
    }

    // Si on est en mode "Serveur", on pousse les changements vers l'API
    if (remoteUrl) {
      try {
        await fetch(remoteUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/octet-stream',
            'X-Client-Id': clientId
          },
          body: data
        });
        console.log("Base de données synchronisée avec le serveur.");
      } catch (err) {
        console.error("Erreur de synchronisation serveur:", err);
      }
    }
  } catch (err) {
    console.error("Critical error in persistDatabase:", err);
  }
};

const setupSchema = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS condominiums (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, address TEXT, manager_id INTEGER);
    CREATE TABLE IF NOT EXISTS logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, 
      condominium_id INTEGER, role_id INTEGER,
      FOREIGN KEY(condominium_id) REFERENCES condominiums(id),
      FOREIGN KEY(role_id) REFERENCES roles(id)
    );
    CREATE TABLE IF NOT EXISTS general_meetings (id INTEGER PRIMARY KEY AUTOINCREMENT, condominium_id INTEGER, date TEXT, title TEXT);
    CREATE TABLE IF NOT EXISTS resolutions (id TEXT PRIMARY KEY, meeting_id INTEGER, title TEXT, description TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, resolution_id TEXT, voter_id INTEGER, option TEXT, timestamp INTEGER,
      UNIQUE(resolution_id, voter_id)
    );
  `);
  // Ensure roles have fixed IDs for reliability
  db.run("INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'MANAGER'), (2, 'VOTER')");
};

const seedInitialData = () => {
  // Condominiums
  db.run("INSERT OR IGNORE INTO condominiums (id, name, address) VALUES (1, 'Résidence Les Pins', '123 Avenue du Soleil, 75001 Paris')");
  db.run("INSERT OR IGNORE INTO condominiums (id, name, address) VALUES (2, 'Le Belvédère', '45 Rue de la Paix, 69002 Lyon')");
  
  // Admin
  db.run("INSERT OR IGNORE INTO logins (id, name, email, password, condominium_id, role_id) VALUES (1, 'Administrateur', 'Admin', 'admin123', 1, 1)");

  // IMPORTANT: Clear existing demo voters to avoid "ghost" data with empty names from previous versions
  db.run("DELETE FROM logins WHERE role_id = 2 OR name IS NULL OR name = ''");
  const changes = db.exec("SELECT changes()")[0].values[0][0];
  console.log(`seedInitialData: Cleared ${changes} existing/invalid voters to prevent ghost data`);

  // Condo 1 voters (10)
  const names = [
    'Jean Dupont', 'Marie Curie', 'Pierre Martin', 'Sophie Bernard', 'Thomas Petit',
    'Julie Robert', 'Nicolas Richard', 'Emma Durand', 'Lucas Dubois', 'Chloé Moreau'
  ];

  names.forEach((name, i) => {
    const voterId = 10 + i; 
    const stmt = db.prepare("INSERT INTO logins (id, name, email, password, condominium_id, role_id) VALUES (?, ?, ?, ?, 1, 2)");
    stmt.run([voterId, name, `voter${i+1}@pins.fr`, '1234']);
    stmt.free();
  });

  // Condo 2 voters (10)
  const names2 = [
    'Jean Dupont', 'Marie Curie', 'Pierre Martin', 
    'Antoine Lefebvre', 'Léa Garcia', 'Hugo Bonnet', 'Camille Vincent', 'Arthur Faure', 'Zoé Lemaire', 'Enzo Muller'
  ];

  names2.forEach((name, i) => {
    const voterId = 30 + i;
    const stmt = db.prepare("INSERT INTO logins (id, name, email, password, condominium_id, role_id) VALUES (?, ?, ?, ?, 2, 2)");
    stmt.run([voterId, name, `voter${i+1}@belvedere.fr`, '1234']);
    stmt.free();
  });
};

export const resetDatabase = async () => {
  localStorage.removeItem(DB_STORAGE_KEY);
  db = null;
  await initDatabase();
  broadcastChange('DATA_CHANGED');
};

// Fonctions Query (Globales)
// Fix: Added foreign keys list introspection to correctly support the SchemaVisualizer component
export const getDatabaseSchema = () => {
  if (!db) return { tables: [] };
  const tables = [];
  const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  while (stmt.step()) {
    const tableName = stmt.getAsObject().name;
    const columns = [];
    const colStmt = db.prepare(`PRAGMA table_info(${tableName})`);
    while (colStmt.step()) columns.push(colStmt.getAsObject());
    colStmt.free();

    const fks = [];
    const fkStmt = db.prepare(`PRAGMA foreign_key_list(${tableName})`);
    while (fkStmt.step()) {
        const fk = fkStmt.getAsObject();
        fks.push({ from: fk.from, toTable: fk.table, toColumn: fk.to });
    }
    fkStmt.free();

    tables.push({ 
      name: tableName, 
      columns: columns.map((c:any) => ({ name: c.name, type: c.type, pk: c.pk === 1 })),
      foreignKeys: fks
    });
  }
  stmt.free();
  return { tables };
};

export const getCondominiums = () => {
  if (!db) return [];
  try {
    const stmt = db.prepare("SELECT id, name, address, manager_id FROM condominiums");
    const res = [];
    while(stmt.step()) {
      const row = stmt.get(); // [id, name, address, manager_id]
      res.push({
        id: row[0],
        name: row[1],
        address: row[2],
        managerId: row[3]
      });
    }
    stmt.free();
    return res;
  } catch (e) {
    console.error("getCondominiums failed", e);
    return [];
  }
};

export const createCondominium = async (name: string, address: string) => {
  if (!db) return;
  if (!name || !address) {
    console.error("Cannot create condominium: name and address are required", { name, address });
    throw new Error("Le nom et l'adresse sont obligatoires.");
  }
  try {
    console.log("createCondominium: Inserting into DB", { name, address });
    const stmt = db.prepare("INSERT INTO condominiums (name, address) VALUES (?, ?)");
    stmt.run([name, address]);
    stmt.free();
    
    const id = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    
    // Verify insertion
    const checkStmt = db.prepare("SELECT id, name, address FROM condominiums WHERE id = ?");
    checkStmt.bind([id]);
    if (checkStmt.step()) {
      console.log("Condominium successfully inserted:", checkStmt.getAsObject());
    } else {
      console.error("Condominium insertion failed: could not find inserted row");
    }
    checkStmt.free();

    await persistDatabase();
    broadcastChange('DATA_CHANGED');
    console.log("createCondominium: Success, ID:", id);
    return id;
  } catch (e) {
    console.error("createCondominium failed", e);
    throw e;
  }
};

export const queryLogin = (email: string, password: string) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(`
      SELECT l.id, l.name, l.email, l.condominium_id, r.name 
      FROM logins l JOIN roles r ON l.role_id = r.id 
      WHERE l.email = ? AND l.password = ?
    `);
    stmt.bind([email, password]);
    let res = null;
    if (stmt.step()) {
      const row = stmt.get();
      res = {
        id: row[0],
        name: row[1],
        email: row[2],
        condominium_id: row[3],
        role: row[4]
      };
    }
    stmt.free();
    return res;
  } catch (e) {
    console.error("queryLogin failed", e);
    return null;
  }
};

export const getMeetings = (condoId: number) => {
  if (!db || !condoId) {
    console.warn("getMeetings: DB not initialized or condoId missing", { db: !!db, condoId });
    return [];
  }
  try {
    const stmt = db.prepare("SELECT id, condominium_id, date, title FROM general_meetings WHERE condominium_id = ? ORDER BY date DESC");
    stmt.bind([Number(condoId)]);
    const res = [];
    while(stmt.step()) {
      const row = stmt.getAsObject();
      res.push({
        id: row.id,
        condominiumId: row.condominium_id,
        date: row.date,
        title: row.title
      });
    }
    stmt.free();
    console.log(`getMeetings: Found ${res.length} meetings for condo ${condoId}`);
    return res;
  } catch (e) {
    console.error("getMeetings failed", e);
    return [];
  }
};

export const createMeeting = async (condoId: number, title: string, date: string) => {
  if (!db) return;
  if (!condoId || !title || !date) {
    console.error("Cannot create meeting: condoId, title and date are required", { condoId, title, date });
    throw new Error("Toutes les informations de l'AG sont obligatoires.");
  }
  try {
    console.log("createMeeting: Inserting into DB", { condoId, title, date });
    const stmt = db.prepare("INSERT INTO general_meetings (condominium_id, title, date) VALUES (?, ?, ?)");
    stmt.run([Number(condoId), title, date]);
    stmt.free();
    
    const res = db.exec("SELECT last_insert_rowid()");
    const id = res[0].values[0][0];
    
    // Verify insertion
    const checkStmt = db.prepare("SELECT id, title, date FROM general_meetings WHERE id = ?");
    checkStmt.bind([id]);
    if (checkStmt.step()) {
      console.log("Meeting successfully inserted:", checkStmt.getAsObject());
    } else {
      console.error("Meeting insertion failed: could not find inserted row");
    }
    checkStmt.free();

    await persistDatabase();
    broadcastChange('DATA_CHANGED');
    console.log("createMeeting: Success, ID:", id);
    return id;
  } catch (e) {
    console.error("createMeeting failed", e);
    throw e;
  }
};

export const saveResolution = async (res: any) => {
  const stmt = db.prepare("INSERT INTO resolutions (id, meeting_id, title, description, status) VALUES (?, ?, ?, ?, ?)");
  stmt.run([res.id, res.meetingId, res.title, res.description, res.status]);
  stmt.free();
  await persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const updateResStatus = async (id: string, status: string) => {
  const stmt = db.prepare("UPDATE resolutions SET status = ? WHERE id = ?");
  stmt.run([status, id]);
  stmt.free();
  await persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const deleteResolution = async (id: string) => {
  const stmt1 = db.prepare("DELETE FROM votes WHERE resolution_id = ?");
  stmt1.run([id]);
  stmt1.free();
  
  const stmt2 = db.prepare("DELETE FROM resolutions WHERE id = ?");
  stmt2.run([id]);
  stmt2.free();
  
  await persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const getAllResolutions = (meetingId: number) => {
  if (!db) return [];
  const stmt = db.prepare("SELECT * FROM resolutions WHERE meeting_id = ?");
  stmt.bind([meetingId]);
  const res = [];
  while(stmt.step()) {
    const r = stmt.getAsObject();
    const vStmt = db.prepare("SELECT voter_id as voterId, option FROM votes WHERE resolution_id = ?");
    vStmt.bind([r.id]);
    const vs = [];
    while(vStmt.step()) vs.push(vStmt.getAsObject());
    vStmt.free();
    res.push({ ...r, votes: vs, meetingId: r.meeting_id });
  }
  stmt.free();
  return res;
};

export const registerVote = async (resId: string, voterId: number, option: string) => {
  const stmt = db.prepare("INSERT OR REPLACE INTO votes (resolution_id, voter_id, option, timestamp) VALUES (?, ?, ?, ?)");
  stmt.run([resId, voterId, option, Date.now()]);
  stmt.free();
  await persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const getCondominium = (id: number) => {
  if (!db) return null;
  try {
    const stmt = db.prepare("SELECT id, name, address, manager_id FROM condominiums WHERE id = ?");
    stmt.bind([id]);
    let res = null;
    if (stmt.step()) {
      const row = stmt.get();
      res = {
        id: row[0],
        name: row[1],
        address: row[2],
        managerId: row[3]
      };
    }
    stmt.free();
    return res;
  } catch (e) {
    console.error("getCondominium failed", e);
    return null;
  }
};

export const createVoter = async (name: string, email: string, password: string, condoId: number) => {
  if (!db) return;
  if (!name || !email) {
    console.error("Cannot create voter: name and email are required", { name, email });
    throw new Error("Le nom et l'email sont obligatoires.");
  }
  try {
    // Dynamically fetch the VOTER role ID to avoid hardcoding issues
    const roleStmt = db.prepare("SELECT id FROM roles WHERE name = 'VOTER'");
    const roleId = roleStmt.step() ? roleStmt.get()[0] : 2;
    roleStmt.free();

    console.log("Creating voter in DB:", { name, email, condoId, roleId });
    const stmt = db.prepare("INSERT INTO logins (name, email, password, condominium_id, role_id) VALUES (?, ?, ?, ?, ?)");
    stmt.run([name, email, password, condoId, roleId]);
    stmt.free();
    
    const id = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    
    // Verify insertion
    const checkStmt = db.prepare("SELECT id, name, email FROM logins WHERE id = ?");
    checkStmt.bind([id]);
    if (checkStmt.step()) {
      console.log("Voter successfully inserted:", checkStmt.getAsObject());
    } else {
      console.error("Voter insertion failed: could not find inserted row");
    }
    checkStmt.free();

    await persistDatabase();
    broadcastChange('DATA_CHANGED');
    return id;
  } catch (error) {
    console.error("Error creating voter:", error);
    throw error;
  }
};

export const updateVoter = async (id: string, name: string, email: string) => {
  db.run("UPDATE logins SET name = ?, email = ? WHERE id = ?", [name, email, id]);
  await persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const getVoters = (condoId: number) => {
  if (!db || !condoId) {
    console.warn("getVoters: DB not initialized or condoId missing", { db: !!db, condoId });
    return [];
  }
  
  try {
    // First, check if the roles table has the VOTER role
    const roleStmt = db.prepare("SELECT id FROM roles WHERE name = 'VOTER' LIMIT 1");
    let voterRoleId = 2; // Default fallback
    if (roleStmt.step()) {
      voterRoleId = roleStmt.getAsObject().id as number;
    }
    roleStmt.free();
    
    console.log(`getVoters: Using voterRoleId=${voterRoleId} for condoId=${condoId}`);

    const stmt = db.prepare(`
      SELECT id, name, email 
      FROM logins 
      WHERE condominium_id = ? 
      AND role_id = ?
    `);
    stmt.bind([Number(condoId), voterRoleId]);
    
    const res = [];
    while(stmt.step()) {
      const row = stmt.getAsObject();
      res.push({
        id: row.id !== undefined && row.id !== null ? row.id.toString() : '',
        name: row.name !== undefined && row.name !== null ? row.name.toString() : '',
        email: row.email !== undefined && row.email !== null ? row.email.toString() : ''
      });
    }
    stmt.free();
    console.log(`getVoters: Found ${res.length} voters for condo ${condoId}`);
    if (res.length > 0) console.table(res);
    return res;
  } catch (error) {
    console.error("getVoters: Error executing query:", error);
    return [];
  }
};

export const updateUserPassword = async (id: number, pass: string) => {
  db.run("UPDATE logins SET password = ? WHERE id = ?", [pass, id]);
  await persistDatabase();
};
