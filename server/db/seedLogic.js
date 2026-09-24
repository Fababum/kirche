// ============================================================================
// Wiederverwendbare Seed-Logik für die Führungs-Zeitslots (17. - 28. März 2027).
// Wird sowohl vom CLI-Skript (seed.js) als auch automatisch beim Serverstart
// (index.js) verwendet, damit ein frischer Container sofort einsatzbereit ist.
// ============================================================================
import { db } from './database.js';
import {
  EVENT_START_DATE, EVENT_END_DATE, SCHOOL_RESERVED_DATE,
  PUBLIC_TOUR_DATES, TOUR_START_TIMES,
} from '../../shared/event.js';

const DEFAULT_CAPACITY = 15;
const INITIALIZATION_KEY = 'default-tours-v1';
const INITIALIZATION_SCHEMA = `CREATE TABLE IF NOT EXISTS initialization_flags (
  key TEXT PRIMARY KEY,
  initialized_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export function seedTours({
  startDate = EVENT_START_DATE,
  endDate = EVENT_END_DATE,
  capacity = DEFAULT_CAPACITY,
} = {}) {
  const insertStmt = db.prepare(
    `INSERT INTO tours (date, time, capacity) VALUES (?, ?, ?)`
  );
  const existsStmt = db.prepare(
    `SELECT id FROM tours WHERE date = ? AND time = ?`
  );

  let created = 0;

  for (const date of [SCHOOL_RESERVED_DATE, ...PUBLIC_TOUR_DATES]) {
    if (date < startDate || date > endDate) continue;
    for (const time of TOUR_START_TIMES) {
      const existing = existsStmt.get(date, time);
      if (!existing) {
        insertStmt.run(date, time, date === SCHOOL_RESERVED_DATE ? 0 : capacity);
        created++;
      }
    }
  }

  return created;
}

// Startup and CLI share this persistent baseline. Do not bump the version to
// refill slots: missing tours may have been deliberately deleted by an admin.
export function initializeTours() {
  return db.transaction(() => {
    db.exec(INITIALIZATION_SCHEMA);
    if (db.prepare('SELECT 1 FROM initialization_flags WHERE key = ?').get(INITIALIZATION_KEY)) return 0;
    const hasTours = db.prepare('SELECT 1 FROM tours LIMIT 1').get();
    const created = hasTours ? 0 : seedTours();
    db.prepare('INSERT INTO initialization_flags (key) VALUES (?)').run(INITIALIZATION_KEY);
    return created;
  }).immediate();
}

// Explicit maintenance only. DELETE preserves AUTOINCREMENT high-water marks.
export function resetTours() {
  return db.transaction(() => {
    db.exec('DELETE FROM booking_verification_tokens; DELETE FROM bookings; DELETE FROM tours;');
    const created = seedTours();
    db.exec(INITIALIZATION_SCHEMA);
    db.prepare('INSERT OR IGNORE INTO initialization_flags (key) VALUES (?)').run(INITIALIZATION_KEY);
    return created;
  }).immediate();
}
