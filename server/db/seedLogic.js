// ============================================================================
// Wiederverwendbare Seed-Logik für die Führungs-Zeitslots (17. - 28. März 2027).
// Wird sowohl vom CLI-Skript (seed.js) als auch automatisch beim Serverstart
// (index.js) verwendet, damit ein frischer Container sofort einsatzbereit ist.
// ============================================================================
import { db } from './database.js';
import {
  EVENT_START_DATE, EVENT_END_DATE, SCHOOL_RESERVED_DATE,
  PUBLIC_TOUR_DATES, MAX_TOUR_PARTICIPANTS, RESERVED_TOURS, EXTRA_TOUR_TIMES,
  tourTimesFor,
} from '../../shared/event.js';

const DEFAULT_CAPACITY = MAX_TOUR_PARTICIPANTS;
const SCHEDULE_V2_KEY = 'schedule-v2-extra-tours-max12';
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
    `INSERT INTO tours (date, time, capacity, label) VALUES (?, ?, ?, ?)`
  );
  const existsStmt = db.prepare(
    `SELECT id FROM tours WHERE date = ? AND time = ?`
  );

  let created = 0;

  for (const date of [SCHOOL_RESERVED_DATE, ...PUBLIC_TOUR_DATES]) {
    if (date < startDate || date > endDate) continue;
    for (const time of tourTimesFor(date)) {
      const existing = existsStmt.get(date, time);
      if (!existing) {
        const reserved = RESERVED_TOURS.find((r) => r.date === date && r.time === time);
        const cap = date === SCHOOL_RESERVED_DATE || reserved ? 0 : capacity;
        insertStmt.run(date, time, cap, reserved?.label ?? null);
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
    // Frisch angelegte Slots enthalten den neuen Plan bereits.
    if (!hasTours) db.prepare('INSERT OR IGNORE INTO initialization_flags (key) VALUES (?)').run(SCHEDULE_V2_KEY);
    return created;
  }).immediate();
}

// Einmalige Anpassung bestehender (Live-)Datenbanken an den neuen Plan:
// zusätzliche Führungen Sa 10-12 / Fr 19-21, max. 12 Personen pro Führung,
// 20.3. 10-12 Uhr für «Fire mit de Chline» reserviert. Bestehende Buchungen
// bleiben erhalten (Kapazität wird nie unter die gebuchte Anzahl gesenkt).
export function migrateScheduleV2() {
  return db.transaction(() => {
    db.exec(INITIALIZATION_SCHEMA);
    if (db.prepare('SELECT 1 FROM initialization_flags WHERE key = ?').get(SCHEDULE_V2_KEY)) return null;
    db.prepare('INSERT INTO initialization_flags (key) VALUES (?)').run(SCHEDULE_V2_KEY);
    if (!db.prepare('SELECT 1 FROM tours LIMIT 1').get()) return null;

    const exists = db.prepare('SELECT 1 FROM tours WHERE date = ? AND time = ?');
    const insert = db.prepare('INSERT INTO tours (date, time, capacity, label) VALUES (?, ?, ?, NULL)');
    let added = 0;
    for (const [date, times] of Object.entries(EXTRA_TOUR_TIMES)) {
      for (const time of times) {
        if (!exists.get(date, time)) { insert.run(date, time, DEFAULT_CAPACITY); added++; }
      }
    }
    const capped = db.prepare(`UPDATE tours SET capacity = MAX(?, booked_count)
      WHERE capacity > ? AND date BETWEEN ? AND ?`)
      .run(DEFAULT_CAPACITY, DEFAULT_CAPACITY, EVENT_START_DATE, EVENT_END_DATE).changes;
    const reserve = db.prepare('UPDATE tours SET capacity = booked_count, label = ? WHERE date = ? AND time = ?');
    for (const r of RESERVED_TOURS) reserve.run(r.label, r.date, r.time);
    return { added, capped, reserved: RESERVED_TOURS.length };
  }).immediate();
}

// Explicit maintenance only. DELETE preserves AUTOINCREMENT high-water marks.
export function resetTours() {
  return db.transaction(() => {
    db.exec('DELETE FROM booking_verification_tokens; DELETE FROM bookings; DELETE FROM tours;');
    const created = seedTours();
    db.exec(INITIALIZATION_SCHEMA);
    db.prepare('INSERT OR IGNORE INTO initialization_flags (key) VALUES (?)').run(INITIALIZATION_KEY);
    db.prepare('INSERT OR IGNORE INTO initialization_flags (key) VALUES (?)').run(SCHEDULE_V2_KEY);
    return created;
  }).immediate();
}
