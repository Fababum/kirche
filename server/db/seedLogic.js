// ============================================================================
// Wiederverwendbare Seed-Logik für die Führungs-Zeitslots (13. - 28. März 2027).
// Wird sowohl vom CLI-Skript (seed.js) als auch automatisch beim Serverstart
// (index.js) verwendet, damit ein frischer Container sofort einsatzbereit ist.
// ============================================================================
import { db } from './database.js';

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

export const SEED_START_DATE = '2027-03-13';
export const SEED_END_DATE = '2027-03-28';
const DEFAULT_CAPACITY = 15;

export function seedTours({
  startDate = SEED_START_DATE,
  endDate = SEED_END_DATE,
  capacity = DEFAULT_CAPACITY,
} = {}) {
  const insertStmt = db.prepare(
    `INSERT INTO tours (date, time, capacity) VALUES (?, ?, ?)`
  );
  const existsStmt = db.prepare(
    `SELECT id FROM tours WHERE date = ? AND time = ?`
  );

  let current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  let created = 0;

  while (current <= end) {
    const iso = current.toISOString().slice(0, 10);
    const weekday = current.getDay();
    const times = slotsForWeekday(weekday);

    for (const time of times) {
      const existing = existsStmt.get(iso, time);
      if (!existing) {
        insertStmt.run(iso, time, capacity);
        created++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return created;
}
