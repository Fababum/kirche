import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import * as event from '../shared/event.js';

// Isolate all imports from .env, secrets and the workspace database.
const originalEnv = process.env;
process.env = { NODE_ENV: 'test', DB_PATH: ':memory:' };
const { db } = await import('./db/database.js');
const { initializeTours } = await import('./db/seedLogic.js');
const { runStartupSetup } = await import('./db/startup.js');

after(() => {
  db.close();
  process.env = originalEnv;
});

beforeEach((t) => {
  process.env = { NODE_ENV: 'test', DB_PATH: ':memory:' };
  db.exec('DELETE FROM bookings; DELETE FROM tours; DROP TABLE IF EXISTS initialization_flags;');
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
});

test('shared event module exports only the approved browser-safe constants', () => {
  assert.deepEqual({ ...event }, {
    EVENT_START_DATE: '2027-03-17', EVENT_END_DATE: '2027-03-28',
    BOOKING_CUTOFF_HOURS: 48, MIN_TOUR_PARTICIPANTS: 5,
  });
});

for (const timezone of ['UTC', 'Europe/Zurich', 'America/Los_Angeles']) {
  test(`seed uses UTC calendar iteration in host TZ ${timezone}`, () => {
    process.env.TZ = timezone;
    assert.equal(initializeTours(), 76);
    const days = db.prepare('SELECT date, COUNT(*) AS count, MIN(time) AS first, MAX(time) AS last FROM tours GROUP BY date ORDER BY date').all();
    assert.deepEqual(days.map(({ date, count }) => [date, count]), [
      ['2027-03-17', 6], ['2027-03-18', 6], ['2027-03-19', 8], ['2027-03-20', 8],
      ['2027-03-21', 7], ['2027-03-23', 6], ['2027-03-24', 6], ['2027-03-25', 6],
      ['2027-03-26', 8], ['2027-03-27', 8], ['2027-03-28', 7],
    ]);
    assert.deepEqual(days.at(-1), { date: '2027-03-28', count: 7, first: '12:00', last: '18:00' });
    assert.equal(initializeTours(), 0);
  });
}

test('startup and repeated CLI initialization never restore deleted defaults, including an empty DB', () => {
  runStartupSetup();
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tours').get().count, 76);
  db.prepare('DELETE FROM tours WHERE id = (SELECT MIN(id) FROM tours)').run();
  runStartupSetup();
  assert.equal(initializeTours(), 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tours').get().count, 75);
  db.exec('DELETE FROM tours');
  runStartupSetup();
  assert.equal(initializeTours(), 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tours').get().count, 0);
  assert.equal(db.prepare('SELECT key FROM initialization_flags').get().key, 'default-tours-v1');
});

test('existing databases adopt baseline without filling gaps or changing legacy tours and bookings', () => {
  db.exec(`
    INSERT INTO tours (id, date, time, capacity, booked_count) VALUES (1, '2027-03-13', '14:00', 20, 3);
    INSERT INTO tours (id, date, time, is_cancelled) VALUES (2, '2027-03-18', '10:00', 1);
    INSERT INTO bookings (tour_id, name, email, group_size, status)
      VALUES (1, 'Legacy', 'legacy@example.test', 2, 'confirmed');
    INSERT INTO bookings (tour_id, name, email, group_size, status, verification_token_hash, verification_expires_at)
      VALUES (1, 'Pending', 'pending@example.test', 1, 'pending', 'legacy-hash', 1800000000000);
  `);
  const tours = db.prepare('SELECT * FROM tours ORDER BY id').all();
  const bookings = db.prepare('SELECT * FROM bookings ORDER BY id').all();
  runStartupSetup();
  assert.equal(initializeTours(), 0);
  runStartupSetup();
  assert.deepEqual(db.prepare('SELECT * FROM tours ORDER BY id').all(), tours);
  assert.deepEqual(db.prepare('SELECT * FROM bookings ORDER BY id').all(), bookings);
  db.exec('DELETE FROM bookings; DELETE FROM tours;');
  runStartupSetup();
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tours').get().count, 0);
});
