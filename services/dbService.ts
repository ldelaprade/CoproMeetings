
// On n'importe plus sql.js via ESM car cela déclenche des shims Node.js (fs) problématiques.
// On utilise la version globale chargée via la balise <script> dans index.html

let db: any = null;
let fileHandle: FileSystemFileHandle | null = null;
let serverMode = false;

const DB_STORAGE_KEY = 'covote_pro_sqlite_db_v7';

/** Active le mode Express-server : persistDatabase synchronisera aussi vers /api/db */
export const enableServerMode = () => { serverMode = true; };

// Canal de synchronisation pour simuler SSE en local (multi-onglets)
const syncChannel = new BroadcastChannel('covote_sync');

const broadcastChange = (type: string, payload?: any) => {
  syncChannel.postMessage({ type, payload, timestamp: Date.now() });
};

/**
 * Initialise la base de données SQLite.
 */
export const initDatabase = async (buffer?: Uint8Array) => {
  if (db && !buffer) return db;


  try {
    const initSqlJsFunc = (window as any).initSqlJs;
    if (!initSqlJsFunc) {
      throw new Error("sql.js n'a pas été chargé correctement via le script tag.");
    }

    const SQL = await initSqlJsFunc({
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
 * Force le rechargement de la base depuis la source courante :
 * - mode serveur  → fetch /api/db
 * - mode navigateur → relit localStorage
 * Appellée par le handler de sync pour garantir des données fraîches.
 */
export const reloadDatabase = async (): Promise<void> => {
  const initSqlJsFunc = (window as any).initSqlJs;
  if (!initSqlJsFunc) return;
  const SQL = await initSqlJsFunc({
    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
  });

  if (serverMode) {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const buffer = new Uint8Array(await res.arrayBuffer());
        db = new SQL.Database(buffer);
      }
    } catch (err) {
      console.error('reloadDatabase (server) failed', err);
    }
  } else {
    // Recharge depuis localStorage
    const savedDb = localStorage.getItem(DB_STORAGE_KEY);
    if (savedDb) {
      try {
        const uint8Array = new Uint8Array(JSON.parse(savedDb));
        db = new SQL.Database(uint8Array);
      } catch (e) {
        console.error('reloadDatabase (localStorage) failed', e);
      }
    }
  }
};

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
    return null;
  }
};

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
    await initDatabase();
    setupSchema();
    seedInitialData();
    await persistDatabase();
    return { name: 'copropriete.sqlite', handle };
  } catch (err) {
    return null;
  }
};

export const persistDatabase = async () => {
  if (!db) return;
  const data = db.export();
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(Array.from(data)));

  if (serverMode) {
    // Mode Express : on synchronise le fichier sur le serveur
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data.buffer as ArrayBuffer
    }).catch(err => console.error('Server sync failed', err));
    return;
  }

  if (fileHandle) {
    try {
      const writable = await (fileHandle as any).createWritable();
      await writable.write(data);
      await writable.close();
    } catch (err) {
      console.error("Failed to sync to local file.", err);
    }
  }
};

const setupSchema = () => {
  if (!db) return;
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS condominiums (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, address TEXT, manager_id INTEGER);
    
    -- Table des comptes (Identité globale)
    CREATE TABLE IF NOT EXISTS logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name TEXT, email TEXT UNIQUE, password TEXT, 
      role_id INTEGER,
      FOREIGN KEY(role_id) REFERENCES roles(id)
    );

    -- Table de jointure (Appartenance à une copropriété)
    CREATE TABLE IF NOT EXISTS memberships (
      user_id INTEGER,
      condominium_id INTEGER,
      is_active INTEGER DEFAULT 1,
      PRIMARY KEY(user_id, condominium_id),
      FOREIGN KEY(user_id) REFERENCES logins(id),
      FOREIGN KEY(condominium_id) REFERENCES condominiums(id)
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
  db.run("INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'MANAGER'), (2, 'VOTER')");
  
  // Copropriétés
  db.run("INSERT OR IGNORE INTO condominiums (id, name, address) VALUES (1, 'Résidence Les Pins', '123 Avenue du Soleil, 75001 Paris')");
  db.run("INSERT OR IGNORE INTO condominiums (id, name, address) VALUES (2, 'Le Grand Large', '42 Quai des Brumes, 13002 Marseille')");
  
  // Compte Manager
  db.run("INSERT OR IGNORE INTO logins (id, name, email, password, role_id) VALUES (1, 'Administrateur Syndic', 'Admin', 'admin123', 1)");
  
  // Liste des Votants
  const voters = [
    [2, 'Jean Dupont', 'jean@mail.com', '1234'],
    [3, 'Marie Curie', 'marie@mail.com', '1234'],
    [4, 'Pierre Martin', 'pierre@mail.com', '1234'],
    [5, 'Thomas Bernard', 'thomas@mail.com', '1234'],
    [6, 'Sophie Lefebvre', 'sophie@mail.com', '1234'],
    [7, 'Lucas Petit', 'lucas@mail.com', '1234'],
    [8, 'Emma Morel', 'emma@mail.com', '1234'],
    [9, 'Gabriel Dubois', 'gabriel@mail.com', '1234']
  ];
  
  voters.forEach(v => {
    db.run("INSERT OR IGNORE INTO logins (id, name, email, password, role_id) VALUES (?, ?, ?, ?, 2)", v);
  });

  // Memberships (Qui appartient à quoi)
  // Résidence 1 : Jean, Marie, Pierre, Thomas, Sophie
  [2, 3, 4, 5, 6].forEach(uid => {
    db.run("INSERT OR IGNORE INTO memberships (user_id, condominium_id, is_active) VALUES (?, 1, 1)", [uid]);
  });
  
  // Résidence 2 : Lucas, Emma, Gabriel + Jean et Marie (Multi-propriétaires)
  [7, 8, 9, 2, 3].forEach(uid => {
    db.run("INSERT OR IGNORE INTO memberships (user_id, condominium_id, is_active) VALUES (?, 2, 1)", [uid]);
  });

  // Assemblées Générales
  db.run("INSERT OR IGNORE INTO general_meetings (id, condominium_id, title, date) VALUES (1, 1, 'AG Ordinaire annuelle 2024', '2024-06-15')");
  db.run("INSERT OR IGNORE INTO general_meetings (id, condominium_id, title, date) VALUES (2, 2, 'AG de Constitution Syndicale 2024', '2024-09-20')");

  // Résolutions AG 1 (Les Pins)
  const resPins = [
    ['P1', 1, 'Approbation des comptes 2023', 'La copropriété approuve les comptes de l\'exercice clos au 31 décembre 2023.'],
    ['P2', 1, 'Quitus au syndic', 'L\'assemblée donne quitus au syndic pour sa gestion au titre de l\'exercice 2023.'],
    ['P3', 1, 'Budget prévisionnel 2025', 'Approbation du budget prévisionnel de fonctionnement pour l\'exercice 2025.'],
    ['P4', 1, 'Ravalement de façade', 'L\'assemblée décide de procéder au ravalement complet des façades (Devis Entreprise RavalPro).'],
    ['P5', 1, 'Local vélos sécurisé', 'Aménagement du local technique inutilisé en local à vélos avec accès sécurisé.'],
    ['P6', 1, 'Mise aux normes ascenseur', 'Travaux obligatoires de sécurité sur la cabine principale.'],
    ['P7', 1, 'Végétalisation de la cour', 'Installation de bacs à fleurs et d\'un système d\'arrosage automatique.'],
    ['P8', 1, 'Changement des codes d\'accès', 'Mise à jour annuelle des codes d\'accès et badges vigik.'],
    ['P9', 1, 'Contrat entretien chaudière', 'Renouvellement du contrat avec la société GazMaintenance.'],
    ['P10', 1, 'Élection du Conseil Syndical', 'Désignation des membres pour le prochain mandat de 2 ans.']
  ];

  // Résolutions AG 2 (Le Grand Large)
  const resLarge = [
    ['G1', 2, 'Adoption du règlement de copropriété', 'Validation du document régissant les droits et devoirs des résidents.'],
    ['G2', 2, 'Désignation du syndic initial', 'Élection du cabinet de gestion pour le lancement de la résidence.'],
    ['G3', 2, 'Compte bancaire séparé', 'Ouverture d\'un compte courant spécifique au nom de la copropriété.'],
    ['G4', 2, 'Assurance Immeuble', 'Souscription au contrat multirisque immeuble AXA.'],
    ['G5', 2, 'Fibre optique', 'Autorisation de passage pour les techniciens réseau Orange.'],
    ['G6', 2, 'Nettoyage des parties communes', 'Validation du planning hebdomadaire de l\'entreprise NetTout.'],
    ['G7', 2, 'Audit énergétique', 'Lancement d\'une étude de performance thermique pour réduire les charges.'],
    ['G8', 2, 'Signalétique intérieure', 'Installation de plaques d\'étages et annuaires dans le hall.'],
    ['G9', 2, 'Fonds de travaux Alur', 'Mise en place de la provision obligatoire de 5% du budget.'],
    ['G10', 2, 'Remplacement porte d\'entrée', 'Installation d\'une porte blindée vitrée suite au dernier vandalisme.']
  ];

  [...resPins, ...resLarge].forEach(r => {
    db.run("INSERT OR IGNORE INTO resolutions (id, meeting_id, title, description, status) VALUES (?, ?, ?, ?, 'PENDING')", r);
  });
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
  broadcastChange('DATA_CHANGED');
};

export const getUserCondominiums = (userId: number) => {
  if (!db) return [];
  const stmt = db.prepare(`
    SELECT c.* 
    FROM condominiums c
    JOIN memberships m ON c.id = m.condominium_id
    WHERE m.user_id = ? AND m.is_active = 1
  `);
  stmt.bind([userId]);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
};

export const queryLogin = (email: string, password: string) => {
  if (!db) return null;
  const stmt = db.prepare(`
    SELECT l.id, l.name, l.email, r.name as role
    FROM logins l 
    JOIN roles r ON l.role_id = r.id 
    WHERE l.email = :email AND l.password = :password
  `);
  stmt.bind({ ':email': email, ':password': password });
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
    result.isActive = true; // Par défaut actif au login global
  }
  stmt.free();
  return result;
};

export const findUserByEmail = (email: string) => {
  if (!db) return null;
  const stmt = db.prepare("SELECT id, name, email FROM logins WHERE email = ?");
  stmt.bind([email]);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
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
  broadcastChange('DATA_CHANGED');
};

export const saveResolution = (res: any) => {
  if (!db) return;
  db.run(`
    INSERT INTO resolutions (id, meeting_id, title, description, status)
    VALUES (?, ?, ?, ?, ?)
  `, [res.id, res.meetingId, res.title, res.description, res.status]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const updateResStatus = (id: string, status: string) => {
  if (!db) return;
  db.run("UPDATE resolutions SET status = ? WHERE id = ?", [status, id]);
  persistDatabase();
  broadcastChange('RESOLUTION_STATUS_CHANGED', { id, status });
};

export const deleteResolution = (id: string) => {
  if (!db) return;
  db.run("DELETE FROM votes WHERE resolution_id = ?", [id]);
  db.run("DELETE FROM resolutions WHERE id = ?", [id]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
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
  broadcastChange('VOTE_REGISTERED', { resId, voterId });
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
  
  // Étape 1: Est-ce que le compte existe ?
  const uStmt = db.prepare("SELECT id FROM logins WHERE email = ?");
  uStmt.bind([email]);
  let userId: number | null = null;
  if (uStmt.step()) {
    userId = uStmt.getAsObject().id;
  }
  uStmt.free();

  if (userId) {
    // Étape 2: Si oui, est-il déjà dans cette copropriété ?
    const mStmt = db.prepare("SELECT COUNT(*) as count FROM memberships WHERE user_id = ? AND condominium_id = ?");
    mStmt.bind([userId, condoId]);
    let existsInCondo = false;
    if (mStmt.step()) {
      existsInCondo = mStmt.getAsObject().count > 0;
    }
    mStmt.free();

    if (existsInCondo) {
      throw new Error("Cet utilisateur appartient déjà à cette copropriété.");
    } else {
      // On l'ajoute à cette nouvelle copropriété
      db.run("INSERT INTO memberships (user_id, condominium_id, is_active) VALUES (?, ?, 1)", [userId, condoId]);
    }
  } else {
    // Étape 3: Création du compte et du lien
    db.run("INSERT INTO logins (name, email, password, role_id) VALUES (?, ?, ?, 2)", [name, email, password]);
    const newId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    db.run("INSERT INTO memberships (user_id, condominium_id, is_active) VALUES (?, ?, 1)", [newId, condoId]);
  }

  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const updateVoter = (id: string, name: string, email: string) => {
  if (!db) return;
  db.run("UPDATE logins SET name = ?, email = ? WHERE id = ?", [name, email, id]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const toggleVoterStatus = (id: string, condoId: number, isActive: boolean) => {
  if (!db) return;
  db.run("UPDATE memberships SET is_active = ? WHERE user_id = ? AND condominium_id = ?", [isActive ? 1 : 0, id, condoId]);
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const hasVoterVotedInCondo = (voterId: number, condoId: number) => {
  if (!db) return false;
  // On vérifie s'il a voté pour des résolutions liées à cette copropriété
  const stmt = db.prepare(`
    SELECT COUNT(*) as count 
    FROM votes v
    JOIN resolutions r ON v.resolution_id = r.id
    JOIN general_meetings gm ON r.meeting_id = gm.id
    WHERE v.voter_id = ? AND gm.condominium_id = ?
  `);
  stmt.bind([voterId, condoId]);
  let hasVotes = false;
  if (stmt.step()) {
    hasVotes = stmt.getAsObject().count > 0;
  }
  stmt.free();
  return hasVotes;
};

export const deleteVoterMembershipPermanently = (id: string, condoId: number) => {
  if (!db) return;
  // On supprime seulement le lien avec la copropriété
  db.run("DELETE FROM memberships WHERE user_id = ? AND condominium_id = ?", [id, condoId]);
  
  // Optionnel : si l'utilisateur n'est plus dans aucune copropriété, on pourrait supprimer son compte 'logins'
  persistDatabase();
  broadcastChange('DATA_CHANGED');
};

export const getVoters = (condoId: number) => {
  if (!db) return [];
  const stmt = db.prepare(`
    SELECT l.id, l.name, l.email, m.is_active 
    FROM logins l 
    JOIN memberships m ON l.id = m.user_id 
    WHERE m.condominium_id = ?
  `);
  stmt.bind([condoId]);
  const results = [];
  while (stmt.step()) {
    const v = stmt.getAsObject();
    results.push({ ...v, isActive: v.is_active === 1 });
  }
  stmt.free();
  return results;
};

// ─── Mode Express Server ───────────────────────────────────────────────────

/**
 * Charge la base depuis l'API Express (/api/db).
 * Retourne { loaded: true } si le fichier existait,
 *          { loaded: false, path } si le fichier a été créé,
 *          null en cas d'erreur réseau.
 */
export const loadDatabaseFromServer = async (): Promise<{ loaded: boolean; path: string } | null> => {
  try {
    const infoRes = await fetch('/api/info');
    const info = await infoRes.json();
    const dbPath: string = info.dbPath;

    const dbRes = await fetch('/api/db');

    const initSqlJsFunc = (window as any).initSqlJs;
    if (!initSqlJsFunc) throw new Error("sql.js non chargé");
    const SQL = await initSqlJsFunc({
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
    });

    if (dbRes.ok) {
      // Fichier existant → on le charge
      const buffer = new Uint8Array(await dbRes.arrayBuffer());
      db = new SQL.Database(buffer);
      return { loaded: true, path: dbPath };
    } else {
      // Fichier absent → créer une nouvelle base + persister sur le serveur
      db = new SQL.Database();
      setupSchema();
      seedInitialData();
      await persistDatabaseToServer();
      return { loaded: false, path: dbPath };
    }
  } catch (err) {
    console.error('loadDatabaseFromServer error', err);
    return null;
  }
};

/**
 * Sauvegarde la base vers l'API Express (/api/db) et aussi dans localStorage.
 */
export const persistDatabaseToServer = async () => {
  if (!db) return;
  const data: Uint8Array = db.export();
  // Sauvegarde locale aussi
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(Array.from(data)));
  // Sauvegarde sur le serveur
  await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: data.buffer as ArrayBuffer
  });
};
