import { stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

async function main() {
  // Validate everything before importing modules that open or initialize a DB.
  const { values } = parseArgs({
    options: {
      db: { type: 'string' },
      'confirm-delete-all-tours-and-bookings': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.db || !isAbsolute(values.db) || !values['confirm-delete-all-tours-and-bookings']) {
    throw new Error('An absolute DB path and explicit confirmation are required.');
  }
  if (!(await stat(values.db)).isFile()) {
    throw new Error('The DB path must be an existing regular file.');
  }

  // Deliberately do not load dotenv; only the explicit CLI path selects the DB.
  process.env.DB_PATH = values.db;
  const { db } = await import('./database.js');
  try {
    const { resetTours } = await import('./seedLogic.js');
    const counts = db.prepare(`SELECT
      (SELECT COUNT(*) FROM tours) AS tours,
      (SELECT COUNT(*) FROM bookings) AS bookings,
      (SELECT COUNT(*) FROM booking_verification_tokens) AS verification_tokens`);
    const before = counts.get();
    resetTours();
    console.log(JSON.stringify({
      before,
      after: counts.get(),
      schedule: db.prepare(`SELECT date, capacity, COUNT(*) AS tours
        FROM tours GROUP BY date, capacity ORDER BY date, capacity`).all(),
    }, null, 2));
  } finally {
    db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Tour reset failed. Required: --db /absolute/existing/data.db --confirm-delete-all-tours-and-bookings');
    process.exitCode = 1;
  });
}
