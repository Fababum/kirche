import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import * as event from '../shared/event.js';

// Isolate all imports from .env, secrets and the workspace database.
const originalEnv = process.env;
process.env = { NODE_ENV: 'test', DB_PATH: ':memory:' };
const { db } = await import('./db/database.js');
const { initializeTours, seedTours, resetTours } = await import('./db/seedLogic.js');
const { runStartupSetup } = await import('./db/startup.js');

after(() => {
  db.close();
  process.env = originalEnv;
});

beforeEach((t) => {
  process.env = { NODE_ENV: 'test', DB_PATH: ':memory:' };
  db.exec('DELETE FROM booking_verification_tokens; DELETE FROM bookings; DELETE FROM tours; DELETE FROM admin_users; DROP TABLE IF EXISTS initialization_flags;');
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
});

test('shared event module exports only the approved browser-safe constants', () => {
  assert.deepEqual({ ...event }, {
    EVENT_START_DATE: '2027-03-17', EVENT_END_DATE: '2027-03-28',
    BOOKING_CUTOFF_HOURS: 48, MIN_TOUR_PARTICIPANTS: 5,
    SCHOOL_RESERVED_DATE: '2027-03-17',
    PUBLIC_TOUR_DATES: [
      '2027-03-18', '2027-03-19', '2027-03-20', '2027-03-21',
      '2027-03-25', '2027-03-26', '2027-03-27', '2027-03-28',
    ],
    TOUR_START_TIMES: ['14:00', '15:00', '16:00', '17:00'],
  });
});

for (const timezone of ['UTC', 'Europe/Zurich', 'America/Los_Angeles']) {
  test(`seed creates exactly the approved schedule in host TZ ${timezone}`, () => {
    process.env.TZ = timezone;
    assert.equal(initializeTours(), 36);
    assertSchedule();
    assert.equal(initializeTours(), 0);
  });
}

test('startup and repeated CLI initialization never restore deleted defaults, including an empty DB', () => {
  runStartupSetup();
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tours').get().count, 36);
  db.prepare('DELETE FROM tours WHERE id = (SELECT MIN(id) FROM tours)').run();
  runStartupSetup();
  assert.equal(initializeTours(), 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tours').get().count, 35);
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

function assertSchedule() {
  const dates = [
    '2027-03-17', '2027-03-18', '2027-03-19', '2027-03-20', '2027-03-21',
    '2027-03-25', '2027-03-26', '2027-03-27', '2027-03-28',
  ];
  assert.deepEqual(db.prepare(`SELECT date, time, capacity, booked_count, is_cancelled
    FROM tours ORDER BY date, time`).all(), dates.flatMap((date) =>
    ['14:00', '15:00', '16:00', '17:00'].map((time) => ({
      date, time, capacity: date === '2027-03-17' ? 0 : 15,
      booked_count: 0, is_cancelled: 0,
    }))));
}

test('seed options filter approved dates and override only public capacity without changing existing slots', () => {
  assert.equal(seedTours({ startDate: '2027-03-17', endDate: '2027-03-18', capacity: 22 }), 8);
  assert.deepEqual(db.prepare('SELECT date, capacity, COUNT(*) AS count FROM tours GROUP BY date, capacity ORDER BY date').all(), [
    { date: '2027-03-17', capacity: 0, count: 4 },
    { date: '2027-03-18', capacity: 22, count: 4 },
  ]);
  assert.equal(seedTours({ startDate: '2027-03-17', endDate: '2027-03-18', capacity: 10 }), 0);
  assert.equal(db.prepare("SELECT capacity FROM tours WHERE date = '2027-03-18' LIMIT 1").get().capacity, 22);
  assert.equal(seedTours({ startDate: '2027-03-22', endDate: '2027-03-24' }), 0);
});

function insertLegacyData() {
  const tour = db.prepare(`INSERT INTO tours (date, time, capacity, booked_count, is_cancelled)
    VALUES ('2027-03-13', '10:00', 30, 8, 1)`).run().lastInsertRowid;
  for (const status of ['pending', 'confirmed', 'cancelled', 'expired']) {
    const booking = db.prepare(`INSERT INTO bookings
      (tour_id, name, email, group_size, status, verification_token_hash, verification_expires_at, resend_token_hash)
      VALUES (?, 'Legacy', 'legacy@example.test', 2, ?, ?, 1800000000000, ?)`)
      .run(tour, status, `verification-${status}`, `resend-${status}`).lastInsertRowid;
    db.prepare('INSERT INTO booking_verification_tokens (token_hash, booking_id) VALUES (?, ?)')
      .run(`old-${status}`, booking);
  }
  db.prepare("INSERT INTO admin_users (username, password_hash) VALUES ('keeper', 'unchanged-hash')").run();
  // Even IDs of previously deleted rows must never be recycled by the reset.
  const deleted = db.prepare("INSERT INTO tours (date, time) VALUES ('2027-03-14', '10:00')").run().lastInsertRowid;
  db.prepare('DELETE FROM tours WHERE id = ?').run(deleted);
}

for (const initialized of [false, true]) {
  test(`reset clears every booking status and tokens, preserves admins and IDs (baseline=${initialized})`, () => {
    insertLegacyData();
    if (initialized) initializeTours();
    const admins = db.prepare('SELECT * FROM admin_users').all();
    const sequences = Object.fromEntries(db.prepare('SELECT name, seq FROM sqlite_sequence').all().map(({ name, seq }) => [name, seq]));
    assert.equal(resetTours(), 36);
    assertSchedule();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM booking_verification_tokens').get().count, 0);
    assert.deepEqual(db.prepare('SELECT * FROM admin_users').all(), admins);
    assert.ok(db.prepare('SELECT MIN(id) AS id FROM tours').get().id > sequences.tours);
    assert.equal(db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'bookings'").get().seq, sequences.bookings);
    assert.equal(db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'admin_users'").get().seq, sequences.admin_users);
    assert.equal(db.prepare('SELECT key FROM initialization_flags').get().key, 'default-tours-v1');
    const tour = db.prepare('SELECT MIN(id) AS id FROM tours').get().id;
    const booking = db.prepare("INSERT INTO bookings (tour_id, name, email) VALUES (?, 'New', 'new@example.test')").run(tour);
    assert.ok(booking.lastInsertRowid > sequences.bookings);
    db.exec('DELETE FROM bookings; DELETE FROM tours;');
    runStartupSetup();
    assert.equal(initializeTours(), 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tours').get().count, 0);
  });

  test(`reset rolls back deleted data and sequence changes if seeding fails (baseline=${initialized})`, () => {
    insertLegacyData();
    if (initialized) initializeTours();
    const tables = ['tours', 'bookings', 'booking_verification_tokens', 'admin_users', 'sqlite_sequence'];
    if (initialized) tables.push('initialization_flags');
    const before = tables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
    db.exec(`CREATE TEMP TRIGGER fail_reset BEFORE INSERT ON tours
      WHEN NEW.date = '2027-03-18' BEGIN SELECT RAISE(ABORT, 'forced seed failure'); END;`);
    try {
      assert.throws(() => resetTours(), /forced seed failure/);
      assert.deepEqual(tables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()), before);
      if (!initialized) {
        assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'initialization_flags'").get(), undefined);
      }
    } finally {
      db.exec('DROP TRIGGER fail_reset');
    }
  });
}
