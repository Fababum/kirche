import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import Database from 'better-sqlite3';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

// No application entry point or dotenv import: never open the workspace DB or use secrets.
const originalEnv = process.env;
const testEnv = {
  NODE_ENV: 'test', DB_PATH: ':memory:', JWT_SECRET: 'isolated-test-secret',
  RESEND_API_KEY: 're_test_only', NOTIFY_EMAIL: 'church@example.test',
  PUBLIC_URL: 'https://site.example.test',
};
process.env = { ...testEnv };
const { db } = await import('./db/database.js');
const { migrateVerification } = await import('./db/migrations.js');
const { expirePendingBookings, VERIFICATION_TTL_MS } = await import('./bookings.js');
const { default: publicRoutes } = await import('./routes/public.js');
const { default: adminRoutes } = await import('./routes/admin.js');
const { COOKIE_NAME } = await import('./auth.js');

let server;
let mails;
let mailResult;
let client = 0;
const adminCookie = `${COOKIE_NAME}=${jwt.sign({ id: 1, username: 'test' }, testEnv.JWT_SECRET)}`;
const bookingBody = { tourId: 1, name: 'Test Visitor', email: 'visitor@example.test', groupSize: 2 };

before(async () => {
  const app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json(), cookieParser());
  app.use('/api', publicRoutes);
  app.use('/api/admin', adminRoutes);
  // Only a loopback test harness, not index.js, startup seeding, or the actual app.
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  db.close();
  process.env = originalEnv;
});

beforeEach((t) => {
  process.env = { ...testEnv };
  db.exec('DELETE FROM bookings; DELETE FROM tours;');
  db.prepare('INSERT INTO tours (id, date, time, capacity) VALUES (1, ?, ?, 5)').run('2027-03-17', '14:00');
  mails = [];
  mailResult = async () => ({ data: { id: 'mock-email' }, error: null });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden in tests'); });
  t.mock.method(Resend.prototype, 'post', async (path, mail) => {
    assert.equal(path, '/emails');
    mails.push(mail);
    return mailResult(mail);
  });
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'warn', () => {});
});

function request(path, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1', port: server.address().port, path, method,
      headers: {
        'Content-Type': 'application/json', Cookie: adminCookie,
        // Each request has its own test IP so rate limits do not mask assertions.
        'X-Forwarded-For': `192.0.${Math.floor(++client / 250)}.${client % 250 + 1}`,
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : text, text }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

const create = (body = {}) => request('/api/bookings', { method: 'POST', body: { ...bookingBody, ...body } });
const confirm = (token) => request('/api/bookings/confirm', { method: 'POST', body: { token } });
const patch = (path, body) => request(`/api/admin/${path}`, { method: 'PATCH', body });
const row = () => db.prepare('SELECT * FROM bookings ORDER BY id DESC LIMIT 1').get();
const seats = () => db.prepare('SELECT booked_count FROM tours WHERE id = 1').get().booked_count;
const tokenFrom = (mail = mails[0]) => mail.html.match(/#token=([a-f0-9]{64})/)[1];
const makeDue = () => db.prepare("UPDATE bookings SET verification_expires_at = ? WHERE status = 'pending'").run(Date.now() - 1);

test('additive migration preserves old confirmed bookings and seat counts, and is repeatable', () => {
  const legacy = new Database(':memory:');
  try {
    legacy.exec(`
      CREATE TABLE tours (id INTEGER PRIMARY KEY, booked_count INTEGER);
      CREATE TABLE bookings (id INTEGER PRIMARY KEY, tour_id INTEGER, status TEXT DEFAULT 'confirmed', group_size INTEGER);
      INSERT INTO tours VALUES (1, 3);
      INSERT INTO bookings (id, tour_id, group_size) VALUES (1, 1, 3);
    `);
    const oldBooking = legacy.prepare('SELECT * FROM bookings').get();
    migrateVerification(legacy);
    migrateVerification(legacy);
    assert.deepEqual(legacy.prepare('SELECT * FROM bookings').get(), {
      ...oldBooking, verification_token_hash: null, verification_expires_at: null,
    });
    assert.equal(legacy.prepare('SELECT booked_count FROM tours').get().booked_count, 3);
    assert.equal(legacy.pragma('table_info(bookings)').find((c) => c.name === 'verification_expires_at').type, 'INTEGER');
  } finally {
    legacy.close();
  }
});

test('creation holds seats for 30 minutes and exposes neither token nor hash in API/admin', async () => {
  const start = Date.now();
  const response = await create();
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(response.body).sort(), ['id', 'message', 'status']);
  assert.equal(response.body.status, 'pending');
  assert.equal(mails.length, 1);
  const token = tokenFrom();
  const stored = row();
  assert.equal(stored.status, 'pending');
  assert.equal(stored.verification_token_hash, createHash('sha256').update(token).digest('hex'));
  assert.ok(stored.verification_expires_at >= start + VERIFICATION_TTL_MS);
  assert.ok(stored.verification_expires_at <= Date.now() + VERIFICATION_TTL_MS);
  assert.ok(!JSON.stringify(stored).includes(token));
  assert.equal(seats(), 2);
  const tours = await request('/api/tours');
  assert.equal(tours.body[0].freeSpots, 3);
  const admin = await request('/api/admin/bookings');
  assert.equal(admin.body[0].verification_expires_at, stored.verification_expires_at);
  const counts = await request('/api/admin/tours');
  assert.equal(counts.body[0].pendingCount, 2);
  assert.equal(counts.body[0].bookedCount, 2);
  for (const result of [response, tours, admin, counts]) {
    assert.ok(!result.text.includes(token));
    assert.ok(!result.text.includes(stored.verification_token_hash));
    assert.ok(!result.text.includes('verification_token_hash'));
  }
});

test('only explicit POST confirms; concurrent retries send each final mail once', async () => {
  await create();
  const token = tokenFrom();
  assert.equal((await request(`/api/bookings/confirm?token=${token}`)).status, 404);
  assert.equal(row().status, 'pending');
  const responses = await Promise.all([confirm(token), confirm(token), confirm(token)]);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), ['message', 'status']);
    assert.equal(response.body.status, 'confirmed');
    assert.ok(!response.text.includes(token));
  }
  assert.equal(row().status, 'confirmed');
  assert.equal(seats(), 2);
  assert.equal(mails.length, 3);
  assert.equal(mails.filter((mail) => mail.to === testEnv.NOTIFY_EMAIL).length, 1);
  for (const mail of mails) {
    assert.match(mail.html, /Susanne Egloff/);
    assert.match(mail.html, /susanne\.egloff@kirche-wm\.ch/);
    assert.match(mail.html, /tel:0523191273/);
  }
  db.prepare('UPDATE bookings SET verification_expires_at = 0').run();
  assert.equal((await confirm(token)).status, 200);
  assert.equal(mails.length, 3);
  assert.equal(seats(), 2);
});

test('malformed and unknown confirmation tokens return 400', async () => {
  for (const token of [undefined, null, {}, 123, '', 'ab', 'g'.repeat(64), 'a'.repeat(64)]) {
    assert.equal((await confirm(token)).status, 400);
  }
  assert.equal(mails.length, 0);
});

test('expiration returns 410 and cleanup and cancellation never release expired seats twice', async () => {
  await create();
  const token = tokenFrom();
  const id = row().id;
  makeDue();
  assert.equal((await confirm(token)).status, 410);
  assert.equal(row().status, 'expired');
  assert.equal(seats(), 0);
  expirePendingBookings();
  assert.equal((await patch(`bookings/${id}`, { status: 'cancelled' })).status, 200);
  assert.equal((await confirm(token)).status, 410);
  assert.equal(seats(), 0);
  assert.equal(row().status, 'expired');
  assert.equal(mails.length, 1);
});

for (const path of ['/api/tours', '/api/admin/tours', '/api/admin/bookings']) {
  test(`${path} cleans expired holds before reporting availability/counts`, async () => {
    await create();
    makeDue();
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(seats(), 0);
    assert.equal(row().status, 'expired');
    if (path.endsWith('/tours')) assert.equal(response.body[0].bookedCount, 0);
    if (path === '/api/tours') assert.equal(response.body[0].freeSpots, 5);
    if (path === '/api/admin/tours') assert.equal(response.body[0].pendingCount, 0);
  });
}

test('creation cleans expired holds before the atomic capacity check', async () => {
  await create({ groupSize: 5 });
  makeDue();
  assert.equal((await create({ groupSize: 5 })).status, 201);
  assert.equal(seats(), 5);
  assert.deepEqual(db.prepare('SELECT status FROM bookings ORDER BY id').all().map((b) => b.status), ['expired', 'pending']);
});

for (const status of ['pending', 'confirmed']) {
  test(`admin cancellation of ${status} releases seats once and confirmation returns 409`, async () => {
    await create();
    const token = tokenFrom();
    const id = row().id;
    if (status === 'confirmed') await confirm(token);
    const sent = mails.length;
    for (let i = 0; i < 2; i++) {
      assert.equal((await patch(`bookings/${id}`, { status: 'cancelled' })).status, 200);
      assert.equal(seats(), 0);
    }
    assert.equal(row().status, 'cancelled');
    assert.equal((await confirm(token)).status, 409);
    assert.equal(mails.length, sent);
  });
}

for (const failure of ['missing key', 'provider error', 'SDK exception']) {
  test(`verification ${failure} returns 503 and keeps a cancelled record without holding seats`, async () => {
    if (failure === 'missing key') delete process.env.RESEND_API_KEY;
    if (failure === 'provider error') mailResult = async () => ({ error: { message: 'provider rejected' }, data: null });
    if (failure === 'SDK exception') mailResult = async () => { throw new Error('SDK failed'); };
    const response = await create();
    assert.equal(response.status, 503);
    assert.equal(row().status, 'cancelled');
    assert.equal(seats(), 0);
    assert.equal(mails.length, failure === 'missing key' ? 0 : 1);
    if (mails.length) assert.equal((await confirm(tokenFrom())).status, 409);
    assert.ok(!response.text.includes(row().verification_token_hash));
  });
}

test('overlapping creates cannot overbook while verification send is outstanding; 201 waits for send', async () => {
  let release;
  let entered;
  const sending = new Promise((resolve) => { entered = resolve; });
  mailResult = () => {
    entered();
    return new Promise((resolve) => { release = resolve; });
  };
  let returned = false;
  const first = create({ groupSize: 4 }).then((result) => { returned = true; return result; });
  await sending;
  try {
    assert.equal(seats(), 4);
    const others = await Promise.all(Array.from({ length: 4 }, () => create({ groupSize: 2 })));
    assert.ok(others.every((result) => result.status === 409));
    assert.equal(returned, false);
    assert.equal(mails.length, 1);
  } finally {
    release({ data: { id: 'accepted' }, error: null });
  }
  assert.equal((await first).status, 201);
  assert.equal(seats(), 4);
});

test('send failure racing expiry or admin cancellation cannot release seats twice', async () => {
  for (const action of ['expiry', 'cancel']) {
    let release;
    let entered;
    const sending = new Promise((resolve) => { entered = resolve; });
    mailResult = () => {
      entered();
      return new Promise((resolve) => { release = resolve; });
    };
    const pending = create();
    await sending;
    try {
      if (action === 'expiry') {
        makeDue();
        expirePendingBookings();
      } else {
        await patch(`bookings/${row().id}`, { status: 'cancelled' });
      }
    } finally {
      release({ error: { message: 'failed' }, data: null });
    }
    assert.equal((await pending).status, 503);
    assert.equal(seats(), 0);
    assert.equal(row().status, action === 'expiry' ? 'expired' : 'cancelled');
  }
});

test('integer sizes and admin capacities; capacity cannot fall below held plus confirmed', async () => {
  assert.equal((await create({ groupSize: 1.5 })).status, 400);
  await create();
  await confirm(tokenFrom());
  await create();
  assert.equal(seats(), 4);
  assert.equal((await patch('tours/1', { capacity: 3 })).status, 409);
  assert.equal((await patch('tours/1', { capacity: 4.5 })).status, 400);
  assert.equal((await patch('tours/1', { capacity: 4 })).status, 200);
  for (const capacity of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await request('/api/admin/tours', {
      method: 'POST', body: { date: '2027-03-18', time: '14:00', capacity },
    })).status, 400);
  }
  makeDue();
  assert.equal((await patch('tours/1', { capacity: 2 })).status, 200);
  assert.equal(seats(), 2);
});

test('tour deletion blocks pending and confirmed bookings but cleans expired holds first', async () => {
  await create();
  assert.equal((await request('/api/admin/tours/1', { method: 'DELETE' })).status, 409);
  await confirm(tokenFrom());
  assert.equal((await request('/api/admin/tours/1', { method: 'DELETE' })).status, 409);
  await patch(`bookings/${row().id}`, { status: 'cancelled' });
  await create();
  makeDue();
  assert.equal((await request('/api/admin/tours/1', { method: 'DELETE' })).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tours').get().count, 0);
});

test('tour cancellation preserves bookings and seats; reactivation permits confirmation before expiry', async () => {
  await create({ groupSize: 1 });
  makeDue();
  await create();
  await confirm(tokenFrom(mails[1]));
  await create();
  const pendingToken = tokenFrom(mails[4]);
  const records = db.prepare('SELECT * FROM bookings ORDER BY id').all();
  for (let i = 0; i < 2; i++) {
    assert.equal((await patch('tours/1', { isCancelled: true })).status, 200);
    assert.equal(seats(), 4);
    assert.deepEqual(db.prepare('SELECT * FROM bookings ORDER BY id').all(), records);
  }
  assert.equal((await confirm(pendingToken)).status, 409);
  assert.equal((await confirm(tokenFrom(mails[1]))).status, 409);
  assert.equal((await create()).status, 404);
  assert.deepEqual(db.prepare('SELECT * FROM bookings ORDER BY id').all(), records);
  assert.equal(mails.length, 5);
  assert.equal((await patch('tours/1', { isCancelled: false })).status, 200);
  assert.equal((await confirm(pendingToken)).status, 200);
  assert.equal(seats(), 4);
  assert.equal(row().status, 'confirmed');
  assert.deepEqual(db.prepare('SELECT * FROM bookings WHERE id = ?').get(records[1].id), records[1]);
  assert.equal(mails.length, 7);
});

test('pending bookings on a cancelled tour expire normally without changing confirmed records', async () => {
  await create();
  await confirm(tokenFrom());
  const confirmed = row();
  await create();
  const pendingToken = tokenFrom(mails[3]);
  assert.equal((await patch('tours/1', { isCancelled: true })).status, 200);
  assert.equal(seats(), 4);
  assert.equal(row().status, 'pending');
  assert.equal((await confirm(pendingToken)).status, 409);
  makeDue();
  assert.equal((await request('/api/admin/tours')).body[0].bookedCount, 2);
  assert.equal(row().status, 'expired');
  expirePendingBookings();
  assert.equal(seats(), 2);
  assert.deepEqual(db.prepare('SELECT * FROM bookings WHERE id = ?').get(confirmed.id), confirmed);
  assert.equal((await patch('tours/1', { isCancelled: false })).status, 200);
  assert.equal((await confirm(pendingToken)).status, 410);
  assert.equal(seats(), 2);
  assert.equal(mails.length, 4);
});

test('final mail failures do not undo confirmation or retry sends on repeated confirmation', async () => {
  await create();
  const token = tokenFrom();
  mailResult = async () => ({ data: null, error: { message: 'rejected' } });
  assert.equal((await confirm(token)).status, 200);
  assert.equal((await confirm(token)).status, 200);
  assert.equal(row().status, 'confirmed');
  assert.equal(seats(), 2);
  assert.equal(mails.length, 3);
});
