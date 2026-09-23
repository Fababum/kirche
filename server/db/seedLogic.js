// ============================================================================
// Wiederverwendbare Seed-Logik für die Führungs-Zeitslots (17. - 28. März 2027).
// Wird sowohl vom CLI-Skript (seed.js) als auch automatisch beim Serverstart
// (index.js) verwendet, damit ein frischer Container sofort einsatzbereit ist.
// ============================================================================
import { db } from './database.js';
import { EVENT_START_DATE, EVENT_END_DATE } from '../../shared/event.js';

// Reguläre Wochenzeiten laut Content-Vorgabe (Truttikon):
// Di - Do: 10-11 + 14-19 Uhr
// Fr + Sa: 10-11 + 14-21 Uhr
// So:      12-19 Uhr
// Mo:      kein Betrieb (nicht erwähnt in den Öffnungszeiten)
function hourlySlots(startHour, endHour) {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

function slotsForWeekday(weekday) {
  // weekday: 0 = Sonntag ... 6 = Samstag
  switch (weekday) {
    case 1: // Montag - kein Betrieb
      return [];
    case 2: // Dienstag
    case 3: // Mittwoch
    case 4: // Donnerstag
      return [...hourlySlots(10, 11), ...hourlySlots(14, 19)];
    case 5: // Freitag
    case 6: // Samstag
      return [...hourlySlots(10, 11), ...hourlySlots(14, 21)];
    case 0: // Sonntag
      return hourlySlots(12, 19);
    default:
      return [];
  }
}

const DEFAULT_CAPACITY = 15;

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

  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  let created = 0;

  while (current <= end) {
    const iso = current.toISOString().slice(0, 10);
    const weekday = current.getUTCDay();
    const times = slotsForWeekday(weekday);

    for (const time of times) {
      const existing = existsStmt.get(iso, time);
      if (!existing) {
        insertStmt.run(iso, time, capacity);
        created++;
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return created;
}

// Startup and CLI share this persistent baseline. Do not bump the version to
// refill slots: missing tours may have been deliberately deleted by an admin.
export function initializeTours() {
  return db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS initialization_flags (
      key TEXT PRIMARY KEY,
      initialized_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const key = 'default-tours-v1';
    if (db.prepare('SELECT 1 FROM initialization_flags WHERE key = ?').get(key)) return 0;
    const hasTours = db.prepare('SELECT 1 FROM tours LIMIT 1').get();
    const created = hasTours ? 0 : seedTours();
    db.prepare('INSERT INTO initialization_flags (key) VALUES (?)').run(key);
    return created;
  }).immediate();
}
