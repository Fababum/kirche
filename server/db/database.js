// ============================================================================
// Datenbank-Setup für die Osterweg-Wyland Buchungsplattform
// Verwendet SQLite (via better-sqlite3) - eine einzelne Datei, kein separater
// Datenbankserver nötig. Ideal für einfaches Hosting.
// ============================================================================
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { migrateVerification } from './migrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Erlaubt es, den Speicherort der Datenbank per Umgebungsvariable zu
// überschreiben (z.B. für ein Docker-Volume: /data/data.db).
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');

// Stellt sicher, dass das Zielverzeichnis existiert (wichtig für Docker-Volumes).
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,            -- Format: YYYY-MM-DD
    time TEXT NOT NULL,            -- Format: HH:MM
    capacity INTEGER NOT NULL DEFAULT 15,
    booked_count INTEGER NOT NULL DEFAULT 0,
    is_cancelled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    group_size INTEGER NOT NULL DEFAULT 1,
    is_school_class INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled | expired
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON bookings(tour_id);
  CREATE INDEX IF NOT EXISTS idx_tours_date ON tours(date);
`);

migrateVerification(db);

export default db;
