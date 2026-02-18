
// On n'importe plus sql.js via ESM car cela déclenche des shims Node.js (fs) problématiques dans certains environnements
// On utilise la version globale chargée via la balise <script> dans index.html

let db: any = null;
let fileHandle: FileSystemFileHandle | null = null;

const DB_STORAGE_KEY = 'covote_pro_sqlite_db_v5';

/**
 * Initialise la base de données SQLite.
 * Utilise le binaire WASM avec locateFile pour pointer vers le CDN.
 */
export const initDatabase = async (buffer?: Uint8Array) => {
  if (db && !buffer) return db;

  try {
    // Récupération de la fonction d'initialisation depuis l'objet window
    const initSqlJsFunc = (window as any).initSqlJs;
    if (!initSqlJsFunc) {
      throw new Error("sql.js n'a pas été chargé correctement via le script tag.");
    }

    const SQL = await initSqlJsFunc({
      // locateFile est crucial pour charger le .wasm depuis le même CDN
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
    });

    if (buffer) {
      db = new SQL.Database(buffer);
    } else {
      const savedDb = localStorage.getItem(DB_STORAGE_KEY);
      if (savedDb) {
        try {
          const uint8Array = new Uint8Array(JSON.parse(savedDb));
          db = new SQL.Database(uint8Array);
        } catch (e) {
          console.warn("Échec du chargement de la base sauvegardée, création d'une nouvelle.");
          db = new SQL.Database();
          setupSchema();
          seedInitialData();
        }
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

/**
 * Ouvre un sélecteur de fichier pour charger une base SQLite existante
 */
export const openLocalDatabaseFile = async () => {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{
        description: 'SQLite Database',
        accept: { 'application/x-sqlite3': ['.sqlite', '.db'] }
      }],
      multiple: false
    });
    fileHandle = handle;
    const file = await fileHandle!.getFile();
    const buffer = new Uint8Array(await file.arrayBuffer());
    await initDatabase(buffer);
    return { name: file.name, handle };
  } catch (err) {
    console.warn("User cancelled or failed to open file", err);
    return null;
  }
};

/**
 * Crée un nouveau fichier SQLite sur la machine locale
 */
export const createLocalDatabaseFile = async () => {
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: 'copropriete.sqlite',
      types: [{
        description: 'SQLite Database',
        accept: { 'application/x-sqlite3': ['.sqlite', '.db'] }
      }]
    });
    fileHandle = handle;
    await initDatabase(); // Init empty
    setupSchema();
    seedInitialData();
    await persistDatabase(); // Writes to file
    return { name: 'copropriete.sqlite', handle };
  } catch (err) {
    console.warn("User cancelled or failed to create file", err);
    return null;
  }
};

export const persistDatabase = async () => {
  if (!db) return;
  const data = db.export();
  
  // 1. Toujours garder une copie de secours dans LocalStorage
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(Array.from(data)));

  // 2. Si un fichier local est connecté, on synchronise
  if (fileHandle) {
    try {
      const writable = await (fileHandle as any).createWritable();
      await writable.write(data);
      await writable.close();
      console.log("Database synced to local file");
    } catch (err) {
      console.error("Failed to sync to local file. Permission might be revoked.", err);
    }
  }
};

const setupSchema = () => {
  if (!db) return;
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS condominiums (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, address TEXT, manager_id INTEGER);
    CREATE TABLE IF NOT EXISTS logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name TEXT, email TEXT UNIQUE, password TEXT, 
      condominium_id INTEGER, role_id INTEGER,
      FOREIGN KEY(condominium_id) REFERENCES condominiums(id),
      FOREIGN KEY(role_id) REFERENCES roles(id)
    );
    CREATE TABLE IF NOT EXISTS general_meetings (id INTEGER PRIMARY KEY AUTOINCREMENT, condominium_id INTEGER, date TEXT, title TEXT, FOREIGN KEY(condominium_id) REFERENCES condominiums(id));
    CREATE TABLE IF NOT EXISTS resolutions (id TEXT PRIMARY KEY, meeting_id INTEGER, title TEXT, description TEXT, status TEXT, FOREIGN KEY(meeting_id) REFERENCES general_meetings(id));
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, resolution_id TEXT, voter_id INTEGER, option TEXT, timestamp INTEGER,
      FOREIGN KEY(resolution_id) REFERENCES resolutions(id), FOREIGN KEY(voter_id) REFERENCES logins(id),
      UNIQUE(resolution_id, voter_id)
    );
  `);
};

const seedInitialData = () => {
  if (!db) return;
  db.run("INSERT OR IGNORE INTO roles (name) VALUES ('MANAGER'), ('VOTER')");
  db.run("INSERT OR IGNORE INTO condominiums (id, name, address) VALUES (1, 'Résidence Les Pins', '123 Avenue du Soleil, 75001 Paris')");
  db.run("INSERT OR IGNORE INTO logins (name, email, password, condominium_id, role_id) VALUES ('Administrateur', 'Admin', 'admin123', 1, 1)");
};

export const getDatabaseSchema = () => {
  if (!db) return { tables: [] };
  const tables = [];
  try {
    const tableStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    while (tableStmt.step()) {
      const tableName = tableStmt.getAsObject().name;
      const columns = [];
      const colStmt = db.prepare(`PRAGMA table_info(${tableName})`);
      while (colStmt.step()) {
        const col = colStmt.getAsObject();
        columns.push({ name: col.name, type: col.type, pk: col.pk === 1, notnull: col.notnull === 1 });
      }
      colStmt.free();
      const foreignKeys = [];
      const fkStmt = db.prepare(`PRAGMA foreign_key_list(${tableName})`);
      while (fkStmt.step()) {
        const fk = fkStmt.getAsObject();
        foreignKeys.push({ from: fk.from, toTable: fk.table, toColumn: fk.to });
      }
      fkStmt.free();
      tables.push({ name: tableName, columns, foreignKeys });
    }
    tableStmt.free();
  } catch (err) {
    console.error("Schema extraction error", err);
  }
  return { tables };
};

export const getCondominiums = () => {
  if (!db) return [];
  const stmt = db.prepare("SELECT * FROM condominiums");
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
};

export const createCondominium = (name: string, address: string) => {
  if (!db) return;
  db.run("INSERT INTO condominiums (name, address) VALUES (?, ?)", [name, address]);
  persistDatabase();
};

export const queryLogin = (email: string, password: string) => {
  if (!db) return null;
  const stmt = db.prepare(`
    SELECT l.id, l.name, l.email, l.condominium_id, r.name as role 
    FROM logins l 
    JOIN roles r ON l.role_id = r.id 
    WHERE l.email = :email AND l.password = :password
  `);
  stmt.bind({ ':email': email, ':password': password });
  let result = null;
  if (stmt.step()) result = stmt.getAsObject();
  stmt.free();
  return result;
};

export const updateUserPassword = (userId: number, newPassword: string) => {
  if (!db) return;
  db.run("UPDATE logins SET password = ? WHERE id = ?", [newPassword, userId]);
  persistDatabase();
};

export const getMeetings = (condoId: number) => {
  if (!db) return [];
  const stmt = db.prepare("SELECT * FROM general_meetings WHERE condominium_id = ? ORDER BY date DESC");
  stmt.bind([condoId]);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
};

export const createMeeting = (condoId: number, title: string, date: string) => {
  if (!db) return;
  db.run("INSERT INTO general_meetings (condominium_id, title, date) VALUES (?, ?, ?)", [condoId, title, date]);
  persistDatabase();
};

export const saveResolution = (res: any) => {
  if (!db) return;
  db.run(`
    INSERT INTO resolutions (id, meeting_id, title, description, status)
    VALUES (?, ?, ?, ?, ?)
  `, [res.id, res.meetingId, res.title, res.description, res.status]);
  persistDatabase();
};

export const updateResStatus = (id: string, status: string) => {
  if (!db) return;
  db.run("UPDATE resolutions SET status = ? WHERE id = ?", [status, id]);
  persistDatabase();
};

export const getAllResolutions = (meetingId: number) => {
  if (!db) return [];
  const stmt = db.prepare("SELECT * FROM resolutions WHERE meeting_id = ?");
  stmt.bind([meetingId]);
  const results = [];
  while (stmt.step()) {
    const res = stmt.getAsObject();
    const voteStmt = db.prepare("SELECT voter_id as voterId, option, timestamp FROM votes WHERE resolution_id = ?");
    voteStmt.bind([res.id]);
    const votes = [];
    while (voteStmt.step()) votes.push(voteStmt.getAsObject());
    voteStmt.free();
    results.push({ ...res, votes, meetingId: res.meeting_id });
  }
  stmt.free();
  return results;
};

export const registerVote = (resId: string, voterId: number, option: string) => {
  if (!db) return;
  db.run(`
    INSERT OR REPLACE INTO votes (resolution_id, voter_id, option, timestamp)
    VALUES (?, ?, ?, ?)
  `, [resId, voterId, option, Date.now()]);
  persistDatabase();
};

export const getCondominium = (id: number) => {
  if (!db) return null;
  const stmt = db.prepare("SELECT * FROM condominiums WHERE id = ?");
  stmt.bind([id]);
  let result = null;
  if (stmt.step()) result = stmt.getAsObject();
  stmt.free();
  return result;
};

export const createVoter = (name: string, email: string, password: string = '1234', condoId: number) => {
  if (!db) return;
  db.run(`
    INSERT INTO logins (name, email, password, condominium_id, role_id)
    VALUES (?, ?, ?, ?, 2)
  `, [name, email, password, condoId]);
  persistDatabase();
};

export const updateVoter = (id: string, name: string, email: string) => {
  if (!db) return;
  db.run("UPDATE logins SET name = ?, email = ? WHERE id = ?", [name, email, id]);
  persistDatabase();
};

export const getVoters = (condoId: number) => {
  if (!db) return [];
  const stmt = db.prepare(`
    SELECT l.id, l.name, l.email 
    FROM logins l 
    JOIN roles r ON l.role_id = r.id 
    WHERE l.condominium_id = ? AND r.name = 'VOTER'
  `);
  stmt.bind([condoId]);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
};
