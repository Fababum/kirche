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
const { resetTours } = await import('./db/seedLogic.js');

let server;
let mails;
let mailResult;
let client = 0;
const adminCookie = `${COOKIE_NAME}=${jwt.sign({ id: 1, username: 'test' }, testEnv.JWT_SECRET)}`;
const bookingBody = { tourId: 1, name: 'Test Visitor', email: 'visitor@example.test', phone: '+41 79 123 45 67', groupSize: 2 };

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
  t.mock.method(Date, 'now', () => Date.parse('2027-03-01T12:00:00Z'));
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

function request(path, { method = 'GET', body, ip } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1', port: server.address().port, path, method,
      headers: {
        'Content-Type': 'application/json', Cookie: adminCookie,
        // Each request has its own test IP so rate limits do not mask assertions.
        'X-Forwarded-For': ip || `192.0.${Math.floor(++client / 250)}.${client % 250 + 1}`,
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : text, text }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

const create = (body = {}) => request('/api/bookings', { method: 'POST', body: { ...bookingBody, ...body } });
const confirm = (token) => request('/api/bookings/confirm', { method: 'POST', body: { token } });
const resend = (resendToken, options = {}) => request('/api/bookings/resend-verification', {
  method: 'POST', body: { resendToken }, ...options,
});
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
      resend_token_hash: null, resend_available_at: 0, resend_count: 0,
    });
    assert.equal(legacy.prepare('SELECT booked_count FROM tours').get().booked_count, 3);
    assert.equal(legacy.pragma('table_info(bookings)').find((c) => c.name === 'verification_expires_at').type, 'INTEGER');
    legacy.prepare(`UPDATE bookings SET verification_token_hash = ?, verification_expires_at = ?,
      resend_token_hash = ?, resend_available_at = ?, resend_count = 2`).run('original-hash', 123456, 'resend-hash', 123000);
    legacy.prepare('INSERT INTO booking_verification_tokens VALUES (?, 1)').run('additional-hash');
    const migrated = legacy.prepare('SELECT * FROM bookings').get();
    migrateVerification(legacy);
    assert.deepEqual(legacy.prepare('SELECT * FROM bookings').get(), migrated);
    assert.deepEqual(legacy.prepare('SELECT * FROM booking_verification_tokens').all(), [{ token_hash: 'additional-hash', booking_id: 1 }]);
  } finally {
    legacy.close();
  }
});

test('creation returns resend metadata, holds seats for 30 minutes and keeps verification secrets out of API/admin', async () => {
  const start = Date.now();
  const response = await create();
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(response.body).sort(), ['expiresAt', 'id', 'message', 'resendToken', 'retryAfter', 'status']);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.retryAfter, 20);
  assert.equal(response.body.expiresAt, start + VERIFICATION_TTL_MS);
  assert.match(response.body.resendToken, /^[a-f0-9]{64}$/);
  assert.equal(response.body.status, 'pending');
  assert.equal(mails.length, 1);
  const token = tokenFrom();
  const stored = row();
  assert.equal(stored.status, 'pending');
  assert.equal(stored.verification_token_hash, createHash('sha256').update(token).digest('hex'));
  assert.equal(stored.resend_token_hash, createHash('sha256').update(response.body.resendToken).digest('hex'));
  assert.notEqual(stored.resend_token_hash, stored.verification_token_hash);
  assert.notEqual(response.body.resendToken, token);
  assert.equal(stored.resend_available_at, start + 20000);
  assert.equal(stored.resend_count, 0);
  assert.ok(!JSON.stringify(stored).includes(response.body.resendToken));
  assert.ok(!JSON.stringify(mails).includes(response.body.resendToken));
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
    assert.ok(!result.text.includes(stored.resend_token_hash));
    assert.ok(!result.text.includes('resend_token_hash'));
  }
  assert.ok(!admin.text.includes(response.body.resendToken));
  assert.equal((await confirm(response.body.resendToken)).status, 400);
  assert.equal(row().status, 'pending');
});

test('resend enforces the exact 20-second boundary without changing seats, reservation or expiry', async () => {
  const start = Date.now();
  const created = await create();
  const original = row();
  const { resendToken, expiresAt } = created.body;
  for (const [elapsed, retryAfter] of [[0, 20], [19000, 1], [19999, 1]]) {
    Date.now.mock.mockImplementation(() => start + elapsed);
    const response = await resend(resendToken);
    assert.equal(response.status, 429);
    assert.equal(response.body.retryAfter, retryAfter);
    assert.equal(response.headers['retry-after'], String(retryAfter));
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(row(), original);
  }
  Date.now.mock.mockImplementation(() => start + 20000);
  const response = await resend(resendToken);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['message', 'retryAfter', 'status']);
  assert.equal(response.body.status, 'pending');
  assert.equal(response.body.retryAfter, 20);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(row().verification_expires_at, expiresAt);
  assert.deepEqual(row(), { ...original, resend_count: 1, resend_available_at: start + 40000 });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count, 1);
  assert.equal(seats(), 2);
  assert.equal(mails.length, 2);
  assert.notEqual(tokenFrom(mails[1]), tokenFrom());
  const issued = db.prepare('SELECT * FROM booking_verification_tokens').all();
  assert.deepEqual(issued, [{ booking_id: original.id, token_hash: createHash('sha256').update(tokenFrom(mails[1])).digest('hex') }]);
  const admin = await request('/api/admin/bookings');
  for (const secret of [resendToken, original.resend_token_hash, issued[0].token_hash, tokenFrom(mails[1])]) {
    assert.ok(!admin.text.includes(secret));
    assert.ok(!response.text.includes(secret));
  }
});

test('malformed, unknown and verification credentials cannot resend', async () => {
  const created = await create();
  const original = row();
  for (const resendToken of [undefined, null, {}, [], 123, '', 'ab', 'g'.repeat(64), 'A'.repeat(64), 'a'.repeat(64), tokenFrom(), original.resend_token_hash, ` ${created.body.resendToken}`]) {
    const response = await resend(resendToken);
    assert.equal(response.status, 400);
    assert.match(response.body.error, /ungültig/);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  assert.deepEqual(row(), original);
  assert.equal(mails.length, 1);
});

test('only three additional attempts are allowed; all four links confirm idempotently with one final mail pair', async () => {
  const start = Date.now();
  const { body: { resendToken, expiresAt } } = await create();
  for (let attempt = 1; attempt <= 3; attempt++) {
    Date.now.mock.mockImplementation(() => start + attempt * 20000);
    assert.equal((await resend(resendToken)).status, 200);
    assert.equal(row().resend_count, attempt);
  }
  for (const elapsed of [60000, 80000]) {
    Date.now.mock.mockImplementation(() => start + elapsed);
    const response = await resend(resendToken);
    assert.equal(response.status, 403);
    assert.match(response.body.error, /höchstens dreimal/);
  }
  assert.equal(mails.length, 4);
  assert.equal(row().verification_expires_at, expiresAt);
  const tokens = mails.map((mail) => tokenFrom(mail));
  assert.equal(new Set(tokens).size, 4);
  const responses = await Promise.all([tokens[3], ...tokens].map(confirm));
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(row().status, 'confirmed');
  assert.equal(seats(), 2);
  assert.equal(mails.length, 6);
  assert.equal(mails.filter((mail) => mail.to === testEnv.NOTIFY_EMAIL).length, 1);
  Date.now.mock.mockImplementation(() => expiresAt);
  for (const token of tokens) assert.equal((await confirm(token)).status, 200);
  assert.equal(mails.length, 6);
});

test('concurrent resends consume one persisted attempt before awaiting mail', async () => {
  const { body: { resendToken } } = await create();
  const availableAt = row().resend_available_at;
  Date.now.mock.mockImplementation(() => availableAt);
  let release;
  let entered;
  const sending = new Promise((resolve) => { entered = resolve; });
  mailResult = () => {
    entered();
    return new Promise((resolve) => { release = resolve; });
  };
  const first = resend(resendToken);
  await sending;
  try {
    assert.equal(row().resend_count, 1);
    assert.equal(row().resend_available_at, availableAt + 20000);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM booking_verification_tokens').get().count, 1);
    const others = await Promise.all(Array.from({ length: 5 }, () => resend(resendToken)));
    assert.ok(others.every((response) => response.status === 429 && response.body.retryAfter === 20));
    assert.equal(mails.length, 2);
    assert.equal(seats(), 2);
  } finally {
    release({ data: { id: 'accepted' }, error: null });
  }
  assert.equal((await first).status, 200);
});

for (const state of ['expired', 'cancelled', 'confirmed', 'tour cancelled']) {
  test(`resend rejects ${state} without consuming an attempt or sending mail`, async () => {
    const { body: { resendToken, expiresAt } } = await create();
    const availableAt = row().resend_available_at;
    Date.now.mock.mockImplementation(() => availableAt);
    assert.equal((await resend(resendToken)).status, 200);
    const tokens = mails.map((mail) => tokenFrom(mail));
    if (state === 'expired') Date.now.mock.mockImplementation(() => expiresAt);
    if (state === 'cancelled') await patch(`bookings/${row().id}`, { status: 'cancelled' });
    if (state === 'confirmed') await confirm(tokens[0]);
    if (state === 'tour cancelled') await patch('tours/1', { isCancelled: true });
    const sent = mails.length;
    assert.equal((await resend(resendToken)).status, state === 'expired' ? 410 : 409);
    assert.equal(row().resend_count, 1);
    for (const token of tokens) {
      assert.equal((await confirm(token)).status, state === 'confirmed' ? 200 : state === 'expired' ? 410 : 409);
    }
    assert.equal(mails.length, sent);
    assert.equal(seats(), ['expired', 'cancelled'].includes(state) ? 0 : 2);
  });
}

for (const failure of ['missing key', 'provider error', 'SDK exception']) {
  test(`resend ${failure} retains seats, expiry and old links while counting failed attempts`, async () => {
    const start = Date.now();
    const { body: { resendToken, expiresAt } } = await create();
    const originalToken = tokenFrom();
    if (failure === 'missing key') delete process.env.RESEND_API_KEY;
    if (failure === 'provider error') mailResult = async () => ({ error: { message: 'rejected' }, data: null });
    if (failure === 'SDK exception') mailResult = async () => { throw new Error('SDK failed'); };
    for (let attempt = 1; attempt <= 3; attempt++) {
      Date.now.mock.mockImplementation(() => start + attempt * 20000);
      const response = await resend(resendToken);
      assert.equal(response.status, 503);
      assert.equal(response.body.retryAfter, 20);
      assert.equal(response.headers['retry-after'], '20');
      assert.match(response.body.error, /ursprünglichen Ablauf/);
      assert.equal(row().status, 'pending');
      assert.equal(row().resend_count, attempt);
      assert.equal(row().resend_available_at, start + (attempt + 1) * 20000);
      assert.equal(row().verification_expires_at, expiresAt);
      assert.equal(seats(), 2);
      assert.equal((await resend(resendToken)).status, attempt === 3 ? 403 : 429);
    }
    process.env.RESEND_API_KEY = testEnv.RESEND_API_KEY;
    mailResult = async () => ({ data: { id: 'accepted' }, error: null });
    const issuedTokens = mails.slice(1).map((mail) => tokenFrom(mail));
    assert.equal((await confirm(originalToken)).status, 200);
    for (const token of issuedTokens) assert.equal((await confirm(token)).status, 200);
    assert.equal(seats(), 2);
    assert.equal(row().verification_expires_at, expiresAt);
    assert.equal(mails.filter((mail) => mail.to === testEnv.NOTIFY_EMAIL).length, 1);
  });
}

test('supplemental resend IP limiter returns retry metadata without consuming booking attempts', async () => {
  const { body: { resendToken } } = await create();
  const options = { ip: '198.51.100.123' };
  for (let attempt = 0; attempt < 10; attempt++) assert.equal((await resend('invalid', options)).status, 400);
  const response = await resend(resendToken, options);
  assert.equal(response.status, 429);
  assert.ok(response.body.retryAfter > 0 && response.body.retryAfter <= 900);
  assert.equal(response.headers['retry-after'], String(response.body.retryAfter));
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(row().resend_count, 0);
  assert.equal(mails.length, 1);
});

test('missing, blank, non-string and overlong phones never create bookings, hold seats or send mail', async () => {
  for (const phone of [undefined, null, '', ' \t\n ', 791234567, false, {}, [], ['0791234567'], '1'.repeat(51)]) {
    const response = await create({ phone });
    assert.equal(response.status, 400);
    assert.match(response.body.error, /Telefonnummer/);
    assert.equal(row(), undefined);
    assert.equal(seats(), 0);
    assert.equal(mails.length, 0);
  }
});

for (const phone of ['079 123 45 67', '+44 (20) 7946-0958', '1'.repeat(50)]) {
  test(`phone ${phone} is trimmed, stored and available to admins and notification mail`, async () => {
    assert.equal((await create({ phone: `  ${phone}  ` })).status, 201);
    assert.equal(row().phone, phone);
    const admin = await request('/api/admin/bookings');
    assert.equal(admin.body[0].phone, phone);
    assert.equal((await confirm(tokenFrom())).status, 200);
    const notification = mails.find((mail) => mail.to === testEnv.NOTIFY_EMAIL);
    assert.ok(notification.html.includes(phone));
  });
}

test('legacy reservations without phone remain confirmable, visible and cancellable', async () => {
  await create();
  db.prepare('UPDATE bookings SET phone = NULL').run();
  assert.equal((await confirm(tokenFrom())).status, 200);
  const admin = await request('/api/admin/bookings');
  assert.equal(admin.body[0].phone, null);
  assert.equal((await patch(`bookings/${row().id}`, { status: 'cancelled' })).status, 200);
  assert.equal(row().phone, null);
  assert.equal(seats(), 0);
});

test('default secretariat receives booking details exactly once, only after confirmation', async () => {
  delete process.env.NOTIFY_EMAIL;
  await create();
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, bookingBody.email);
  const token = tokenFrom();
  const responses = await Promise.all([confirm(token), confirm(token)]);
  assert.ok(responses.every((response) => response.status === 200));
  const notifications = mails.filter((mail) => mail.to === 'sekretariat@kirche-wm.ch');
  assert.equal(notifications.length, 1);
  for (const content of [notifications[0].html, notifications[0].text]) {
    for (const value of [bookingBody.name, bookingBody.email, bookingBody.phone,
      '17.03.2027', '14:00', 'Personen', '2', 'verbindlich bestätigt']) {
      assert.ok(content.includes(value), value);
    }
  }
  assert.equal((await confirm(token)).status, 200);
  assert.equal(mails.length, 3);
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
    assert.match(mail.html, /Sekretariat Rheinau/);
    assert.match(mail.html, /sekretariat@kirche-wm\.ch/);
    assert.match(mail.html, /tel:0523191273/);
  }
  db.prepare('UPDATE bookings SET verification_expires_at = 0').run();
  assert.equal((await confirm(token)).status, 200);
  assert.equal(mails.length, 3);
  assert.equal(seats(), 2);
});

test('new schedule shows school day as full and only the approved public slots are bookable', async () => {
  resetTours();
  const response = await request('/api/tours');
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 36);
  const schoolTours = response.body.filter((tour) => tour.date === '2027-03-17');
  assert.equal(schoolTours.length, 4);
  for (const tour of schoolTours) {
    assert.equal(tour.isFull, true);
    assert.equal(tour.freeSpots, 0);
    assert.equal((await create({ tourId: tour.id, groupSize: 1 })).status, 409);
  }
  assert.equal(mails.length, 0);
  assert.equal(row(), undefined);
  const publicTours = response.body.filter((tour) => tour.date !== '2027-03-17');
  assert.equal(publicTours.length, 32);
  assert.ok(publicTours.every((tour) => tour.freeSpots === 15 && !tour.isFull));
  assert.deepEqual([...new Set(publicTours.map((tour) => tour.time))], ['14:00', '15:00', '16:00', '17:00']);
  assert.equal((await create({ tourId: publicTours[0].id })).status, 201);
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

test('public listings always enforce inclusive event bounds without altering legacy data', async () => {
  const insert = db.prepare('INSERT INTO tours (date, time) VALUES (?, ?)');
  for (const date of ['2027-03-16', '2027-03-28', '2027-03-29', '2027-03-20junk']) insert.run(date, '14:00');
  insert.run('2027-03-18', '25:00');
  const original = db.prepare('SELECT * FROM tours ORDER BY id').all();
  for (const query of ['', '?from=2027-01-01&to=2027-12-31', '?from=2027-03-01', '?to=2027-04-01']) {
    const response = await request(`/api/tours${query}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.map((tour) => tour.date), ['2027-03-17', '2027-03-28']);
    assert.ok(response.body.every((tour) => tour.isBookingClosed === false));
  }
  assert.deepEqual((await request('/api/tours?from=2027-03-28&to=2027-03-28')).body.map((tour) => tour.date), ['2027-03-28']);
  assert.deepEqual((await request('/api/tours?to=2027-03-16')).body, []);
  assert.deepEqual(db.prepare('SELECT * FROM tours ORDER BY id').all(), original);
});

test('invalid public date filters return German validation errors', async () => {
  for (const query of ['from=2027-02-29', 'to=invalid', 'from=', 'from=2027-03-18&to=2027-03-17', 'from=2027-03-17&from=2027-03-18']) {
    const response = await request(`/api/tours?${query}`);
    assert.equal(response.status, 400);
    assert.match(response.body.error, /gültigen Datumsbereich/);
  }
});

test('direct bookings outside the event or at invalid local dates/times never hold seats or send mail', async () => {
  for (const [date, time, error] of [
    ['2027-03-16', '14:00', /17\. bis 28\. März 2027/],
    ['2027-03-29', '14:00', /17\. bis 28\. März 2027/],
    ['2026-03-17', '14:00', /17\. bis 28\. März 2027/],
    ['2027-02-29', '14:00', /ungültig/],
    ['2027-03-20junk', '14:00', /ungültig/],
    ['2027-03-18', '24:00', /ungültig/],
    ['2027-03-18', '9:00', /ungültig/],
    ['2027-03-28', '02:30', /ungültig/],
  ]) {
    db.prepare('UPDATE tours SET date = ?, time = ? WHERE id = 1').run(date, time);
    const response = await create();
    assert.equal(response.status, 400);
    assert.match(response.body.error, error);
    assert.equal(seats(), 0);
    assert.equal(row(), undefined);
    assert.equal(mails.length, 0);
  }
});

for (const timezone of ['UTC', 'Europe/Zurich', 'America/Los_Angeles']) {
  test(`Zurich cutoff is an actual 48 hours including March 28 DST, independent of host TZ ${timezone}`, async () => {
    process.env.TZ = timezone;
    for (const [date, time, cutoff] of [
      ['2027-03-17', '14:00', '2027-03-15T13:00:00.000Z'],
      ['2027-03-28', '01:30', '2027-03-26T00:30:00.000Z'],
      ['2027-03-28', '03:00', '2027-03-26T01:00:00.000Z'],
      ['2027-03-28', '14:00', '2027-03-26T12:00:00.000Z'],
    ]) {
      db.prepare('UPDATE tours SET date = ?, time = ? WHERE id = 1').run(date, time);
      const closesAt = Date.parse(cutoff);
      Date.now.mock.mockImplementation(() => closesAt - 1);
      let tour = (await request('/api/tours')).body[0];
      assert.equal(tour.bookingClosesAt, cutoff);
      assert.equal(tour.isBookingClosed, false);
      assert.equal((await create({ groupSize: 1 })).status, 201);
      assert.equal(row().verification_expires_at, closesAt - 1 + VERIFICATION_TTL_MS);
      const sent = mails.length;
      const held = seats();
      const count = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
      for (const now of [closesAt, closesAt + 1, closesAt + 49 * 60 * 60 * 1000]) {
        Date.now.mock.mockImplementation(() => now);
        tour = (await request('/api/tours')).body[0];
        assert.equal(tour.isBookingClosed, true);
        assert.equal(tour.isFull, false);
        const response = await create({ groupSize: 1 });
        assert.equal(response.status, 409);
        assert.match(response.body.error, /48 Stunden/);
        assert.equal(mails.length, sent);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count, count);
        assert.equal(seats(), now < closesAt + VERIFICATION_TTL_MS ? held : 0);
      }
    }
  });
}

test('single-person pending bookings retain full grace across cutoff; no minimum-tour cancellation', async () => {
  const cutoff = Date.parse('2027-03-15T13:00:00Z');
  Date.now.mock.mockImplementation(() => cutoff - 1);
  assert.equal((await create({ groupSize: 1 })).status, 201);
  const firstToken = tokenFrom();
  assert.equal((await create({ groupSize: 1 })).status, 201);
  const secondToken = tokenFrom(mails[1]);
  const expiry = cutoff - 1 + VERIFICATION_TTL_MS;
  Date.now.mock.mockImplementation(() => expiry - 1);
  assert.equal((await confirm(firstToken)).status, 200);
  Date.now.mock.mockImplementation(() => expiry);
  assert.equal((await confirm(secondToken)).status, 410);
  Date.now.mock.mockImplementation(() => Date.parse('2027-03-29T12:00:00Z'));
  const tour = (await request('/api/tours')).body[0];
  assert.equal(tour.isBookingClosed, true);
  assert.equal(tour.bookedCount, 1);
  assert.equal(db.prepare('SELECT is_cancelled FROM tours WHERE id = 1').get().is_cancelled, 0);
  assert.equal((await confirm(firstToken)).status, 200);
});

test('legacy pending and confirmed reservations outside event bounds remain confirmable', async () => {
  for (const date of ['2027-03-13', '2027-03-29']) {
    assert.equal((await create({ groupSize: 1 })).status, 201);
    const token = tokenFrom(mails.at(-1));
    db.prepare('UPDATE tours SET date = ? WHERE id = 1').run(date);
    assert.deepEqual((await request('/api/tours')).body, []);
    assert.equal((await confirm(token)).status, 200);
    const confirmed = row();
    assert.equal((await confirm(token)).status, 200);
    assert.deepEqual(row(), confirmed);
    db.prepare("UPDATE tours SET date = '2027-03-17' WHERE id = 1").run();
  }
  assert.equal(seats(), 2);
});
