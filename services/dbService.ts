
// Service de base de données SQLite (sql.js)
let db: any = null;
let fileHandle: FileSystemFileHandle | null = null;
let remoteUrl: string | null = null;

const DB_STORAGE_KEY = 'covote_pro_sqlite_db_v5';
const syncChannel = new BroadcastChannel('covote_sync');

const broadcastChange = (type: string, payload?: any) => {
  syncChannel.postMessage({ type, payload, timestamp: Date.now() });
};

/**
 * Initialise la base de données à partir d'un buffer, du stockage local ou d'une URL.
 */
export const initDatabase = async (buffer?: Uint8Array, url?: string) => {
  try {
    const initSqlJsFunc = (window as any).initSqlJs;
    const SQL = await initSqlJsFunc({
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
    });

    if (buffer) {
      db = new SQL.Database(buffer);
    } else if (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Impossible de charger la base distante.");
      const arrayBuffer = await response.arrayBuffer();
      db = new SQL.Database(new Uint8Array(arrayBuffer));
      remoteUrl = url;
    } else {
      const savedDb = localStorage.getItem(DB_STORAGE_KEY);
      if (savedDb) {
        db = new SQL.Database(new Uint8Array(JSON.parse(savedDb)));
      } else {
        db = new SQL.Database();
        setupSchema();
        seedInitialData();
        persistDatabase();
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
  const data = db.export();
  
  // Toujours garder une copie locale au cas où
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(Array.from(data)));

  if (fileHandle) {
    try {
      const writable = await (fileHandle as any).createWritable();
      await writable.write(data);
      await writable.close();
    } catch (err) { console.error("Sync file failed", err); }
  }

  // Si on est en mode "Serveur", on pourrait ici faire un PUT/POST vers une API
  if (remoteUrl) {
    console.log("Simulated Push to Server:", remoteUrl);
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
};

const seedInitialData = () => {
  db.run("INSERT OR IGNORE INTO roles (name) VALUES ('MANAGER'), ('VOTER')");
  
  // Condominiums
  db.run("INSERT OR IGNORE INTO condominiums (id, name, address) VALUES (1, 'Résidence Les Pins', '123 Avenue du Soleil, 75001 Paris')");
  db.run("INSERT OR IGNORE INTO condominiums (id, name, address) VALUES (2, 'Le Belvédère', '45 Rue de la Paix, 69002 Lyon')");
  
  // Admin
  db.run("INSERT OR IGNORE INTO logins (name, email, password, condominium_id, role_id) VALUES ('Administrateur', 'Admin', 'admin123', 1, 1)");

  // Condo 1 voters (10)
  const names = [
    'Jean Dupont', 'Marie Curie', 'Pierre Martin', 'Sophie Bernard', 'Thomas Petit',
    'Julie Robert', 'Nicolas Richard', 'Emma Durand', 'Lucas Dubois', 'Chloé Moreau'
  ];

  names.forEach((name, i) => {
    db.run("INSERT OR IGNORE INTO logins (name, email, password, condominium_id, role_id) VALUES (?, ?, ?, 1, 2)", 
      [name, `voter${i+1}@pins.fr`, '1234']);
  });

  // Condo 2 voters (10)
  // 3 are shared (same names, different emails to satisfy UNIQUE constraint in this schema)
  const names2 = [
    'Jean Dupont', 'Marie Curie', 'Pierre Martin', // Shared
    'Antoine Lefebvre', 'Léa Garcia', 'Hugo Bonnet', 'Camille Vincent', 'Arthur Faure', 'Zoé Lemaire', 'Enzo Muller'
  ];

  names2.forEach((name, i) => {
    db.run("INSERT OR IGNORE INTO logins (name, email, password, condominium_id, role_id) VALUES (?, ?, ?, 2, 2)", 
      [name, `voter${i+1}@belvedere.fr`, '1234']);
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
  const res = db.exec("SELECT * FROM condominiums");
  return res.length ? res[0].values.map((v:any) => ({ id: v[0], name: v[1], address: v[2] })) : [];
};

export const createCondominium = (name: string, address: string) => {
  db.run("INSERT INTO condominiums (name, address) VALUES (?, ?)", [name, address]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const queryLogin = (email: string, password: string) => {
  if (!db) return null;
  const stmt = db.prepare(`
    SELECT l.id, l.name, l.email, l.condominium_id, r.name as role 
    FROM logins l JOIN roles r ON l.role_id = r.id 
    WHERE l.email = ? AND l.password = ?
  `);
  stmt.bind([email, password]);
  const res = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return res;
};

export const getMeetings = (condoId: number) => {
  if (!db) return [];
  const stmt = db.prepare("SELECT * FROM general_meetings WHERE condominium_id = ? ORDER BY date DESC");
  stmt.bind([condoId]);
  const res = [];
  while(stmt.step()) res.push(stmt.getAsObject());
  stmt.free();
  return res;
};

export const createMeeting = (condoId: number, title: string, date: string) => {
  db.run("INSERT INTO general_meetings (condominium_id, title, date) VALUES (?, ?, ?)", [condoId, title, date]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const saveResolution = (res: any) => {
  db.run("INSERT INTO resolutions (id, meeting_id, title, description, status) VALUES (?, ?, ?, ?, ?)", [res.id, res.meetingId, res.title, res.description, res.status]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const updateResStatus = (id: string, status: string) => {
  db.run("UPDATE resolutions SET status = ? WHERE id = ?", [status, id]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const deleteResolution = (id: string) => {
  db.run("DELETE FROM votes WHERE resolution_id = ?", [id]);
  db.run("DELETE FROM resolutions WHERE id = ?", [id]);
  persistDatabase();
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

export const registerVote = (resId: string, voterId: number, option: string) => {
  db.run("INSERT OR REPLACE INTO votes (resolution_id, voter_id, option, timestamp) VALUES (?, ?, ?, ?)", [resId, voterId, option, Date.now()]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const getCondominium = (id: number) => {
  const stmt = db.prepare("SELECT * FROM condominiums WHERE id = ?");
  stmt.bind([id]);
  const res = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return res;
};

export const createVoter = (name: string, email: string, password: string, condoId: number) => {
  db.run("INSERT INTO logins (name, email, password, condominium_id, role_id) VALUES (?, ?, ?, ?, 2)", [name, email, password, condoId]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const updateVoter = (id: string, name: string, email: string) => {
  db.run("UPDATE logins SET name = ?, email = ? WHERE id = ?", [name, email, id]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const getVoters = (condoId: number) => {
  const stmt = db.prepare("SELECT l.id, l.name, l.email FROM logins l JOIN roles r ON l.role_id = r.id WHERE l.condominium_id = ? AND r.name = 'VOTER'");
  stmt.bind([condoId]);
  const res = [];
  while(stmt.step()) res.push(stmt.getAsObject());
  stmt.free();
  return res;
};

export const updateUserPassword = (id: number, pass: string) => {
  db.run("UPDATE logins SET password = ? WHERE id = ?", [pass, id]);
  persistDatabase();
};
