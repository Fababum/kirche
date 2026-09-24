import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { api } from '../src/api.js';

const tour = {
  id: 1, date: '2027-03-17', time: '14:00', capacity: 15, bookedCount: 4,
  freeSpots: 11, isFull: false, isBookingClosed: false,
  bookingClosesAt: '2027-03-15T13:00:00.000Z',
};
const booking = { tourId: 1, name: 'Visitor', email: 'visitor@example.test', phone: '+41 79 123 45 67', groupSize: 2 };
const receipt = { id: 7, status: 'pending', resendToken: 'a'.repeat(64), retryAfter: 20, expiresAt: 1803904200000 };
const endpoints = [
  { call: () => api.getTours('2027-03-17', '2027-03-28'), path: '/tours?from=2027-03-17&to=2027-03-28', result: [tour] },
  { call: () => api.createBooking(booking), path: '/bookings', method: 'POST', body: booking, result: receipt, status: 201 },
  { call: () => api.resendVerification(receipt.resendToken), path: '/bookings/resend-verification', method: 'POST', body: { resendToken: receipt.resendToken }, result: { status: 'pending', retryAfter: 20 } },
  { call: () => api.confirmBooking('token'), path: '/bookings/confirm', method: 'POST', body: { token: 'token' }, result: { status: 'confirmed' } },
  { call: () => api.login('admin', 'password'), path: '/admin/login', method: 'POST', body: { username: 'admin', password: 'password' }, result: { username: 'admin' } },
  { call: () => api.logout(), path: '/admin/logout', method: 'POST', result: { ok: true } },
  { call: () => api.me(), path: '/admin/me', result: { username: 'admin' } },
  { call: () => api.getAdminTours(), path: '/admin/tours', result: [{ id: 1, pendingCount: 2 }] },
  { call: () => api.createTour(tour), path: '/admin/tours', method: 'POST', body: tour, result: { id: 1 }, status: 201 },
  { call: () => api.updateTour(1, { capacity: 20 }), path: '/admin/tours/1', method: 'PATCH', body: { capacity: 20 }, result: { ok: true } },
  { call: () => api.deleteTour(1), path: '/admin/tours/1', method: 'DELETE', result: { ok: true } },
  { call: () => api.getBookings(), path: '/admin/bookings', result: [{ id: 7, status: 'pending' }] },
  { call: () => api.updateBooking(7, { status: 'cancelled' }), path: '/admin/bookings/7', method: 'PATCH', body: { status: 'cancelled' }, result: { ok: true } },
];

beforeEach((t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected fetch');
  });
});

function assertUnclearOutcome(error) {
  assert.match(error.message, /Ausgang.*unklar/);
  assert.match(error.message, /nicht einfach erneut buchen/);
  assert.match(error.message, /E-Mail-Postfach.*Sekretariat/);
  assert.doesNotMatch(error.message, /keine Plätze|nicht reserviert|nicht abgeschlossen|offline|secret/);
  assert.equal(error.status, undefined);
  return true;
}

test('valid responses preserve every endpoint, method, payload and credentials', async () => {
  for (const { call, path, method, body, result, status = 200 } of endpoints) {
    globalThis.fetch.mock.mockImplementation(async (url, options) => {
      assert.equal(url, `/api${path}`);
      assert.deepEqual(options, {
        credentials: 'include', headers: { 'Content-Type': 'application/json' },
        ...(method ? { method } : {}),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return Response.json(result, { status });
    });
    assert.deepEqual(await call(), result);
  }
  assert.equal(globalThis.fetch.mock.callCount(), endpoints.length);
});

test('all endpoints reject successful HTML, empty, malformed, null and primitive JSON responses', async () => {
  const responses = [
    () => new Response('<html>SPA fallback</html>', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('<html>SPA fallback</html>', { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('', { headers: { 'Content-Type': 'application/json' } }),
    () => new Response(null, { status: 204 }),
    () => new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('{}'),
    ...[null, true, 42, 'success'].map((body) => () => Response.json(body)),
  ];
  for (const { call, method } of endpoints) {
    for (const response of responses) {
      globalThis.fetch.mock.mockImplementation(async () => response());
      await assert.rejects(call(), method ? assertUnclearOutcome : /Ungültige Antwort vom Server/);
    }
  }
});

test('network and response-body failures expose uncertain mutations without retrying', async () => {
  for (const { call, method } of endpoints) {
    for (const response of [
      () => { throw new TypeError('offline secret'); },
      () => ({ ok: true, status: 200, headers: new Headers({ 'Content-Type': 'application/json' }), json: async () => { throw new TypeError('offline secret'); } }),
    ]) {
      globalThis.fetch.mock.mockImplementation(response);
      const before = globalThis.fetch.mock.callCount();
      await assert.rejects(call(), method ? assertUnclearOutcome : /Verbindung zum Server|Ungültige Antwort vom Server/);
      assert.equal(globalThis.fetch.mock.callCount(), before + 1);
    }
  }
});

test('HTTP errors retain status with JSON, non-JSON, malformed and interrupted bodies', async () => {
  for (const { call } of endpoints) {
    for (const status of [400, 401, 409, 410, 429, 500, 503]) {
      for (const response of [
        () => new Response('<html>Error</html>', { status, headers: { 'Content-Type': 'text/html' } }),
        () => new Response('{broken', { status, headers: { 'Content-Type': 'application/json' } }),
        () => new Response('', { status, headers: { 'Content-Type': 'application/json' } }),
        () => Response.json(null, { status }),
        () => Response.json({ error: { message: 'not a string' } }, { status }),
        () => ({ ok: false, status, headers: new Headers({ 'Content-Type': 'application/json' }), json: async () => { throw new Error('interrupted'); } }),
      ]) {
        globalThis.fetch.mock.mockImplementation(async () => response());
        await assert.rejects(call(), { status, message: `Fehler (${status})` });
      }
      globalThis.fetch.mock.mockImplementation(async () => Response.json({ error: 'Servermeldung' }, { status }));
      await assert.rejects(call(), { status, message: 'Servermeldung' });
    }
  }
});

test('public tours require an array and every required field with sensible values', async () => {
  const invalid = [
    {}, { tours: [tour] }, [null], [[]], [1], [tour, {}],
    ...Object.keys(tour).map((key) => [Object.fromEntries(Object.entries(tour).filter(([field]) => field !== key))]),
    ...Object.entries({
      id: [0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1],
      date: [null, 20270317, '17.03.2027', '2027-02-30', '2027-13-01'],
      time: [null, 1400, '2:00', '24:00', '14:60'],
      capacity: [-1, 15.5, '15', Number.MAX_SAFE_INTEGER + 1],
      bookedCount: [-1, 4.5, '4', Number.MAX_SAFE_INTEGER + 1],
      freeSpots: [-1, 11.5, '11', 12],
      isFull: [true, 0, 'false', null],
      isBookingClosed: [0, 'false', null],
      bookingClosesAt: [null, 123, '', 'tomorrow', '2027-03-15', '2027-03-15T13:00:00', '2027-13-15T13:00:00Z', '2027-02-30T13:00:00Z'],
    }).flatMap(([key, values]) => values.map((value) => [{ ...tour, [key]: value }])),
  ];
  for (const body of invalid) {
    globalThis.fetch.mock.mockImplementation(async () => Response.json(body));
    await assert.rejects(api.getTours('from', 'to'), /Ungültige Antwort vom Server/);
  }
});

test('valid tour lists retain backend date and closure decisions, including zero capacity and overbooking', async () => {
  for (const body of [
    [], [tour],
    [{ ...tour, capacity: 0, bookedCount: 0, freeSpots: 0, isFull: true }],
    [{ ...tour, bookedCount: 15, freeSpots: 0, isFull: true }],
    [{ ...tour, bookedCount: 20, freeSpots: 0, isFull: true }],
    [{ ...tour, date: '2000-01-01', bookingClosesAt: '1999-12-30T13:00:00Z', isBookingClosed: false }],
    [{ ...tour, date: '2099-01-01', bookingClosesAt: '2098-12-30T14:00:00+01:00', isBookingClosed: true }],
  ]) {
    globalThis.fetch.mock.mockImplementation(async () => Response.json(body, { headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
    assert.deepEqual(await api.getTours('from', 'to'), body);
  }
});

test('createBooking accepts only pending with a positive safe integer id', async () => {
  for (const body of [
    {}, [], { id: 1 }, { status: 'pending' },
    ...['confirmed', 'cancelled', 'expired', 'unknown', null].map((status) => ({ ...receipt, status })),
    ...[null, 0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1].map((id) => ({ ...receipt, id })),
    ...[null, undefined, '', 'token', 'g'.repeat(64), 123].map((resendToken) => ({ ...receipt, resendToken })),
    ...[null, undefined, 0, -1, 1.5, '20'].flatMap((value) => [
      { ...receipt, retryAfter: value }, { ...receipt, expiresAt: value },
    ]),
  ]) {
    globalThis.fetch.mock.mockImplementation(async () => Response.json(body));
    await assert.rejects(api.createBooking(booking), assertUnclearOutcome);
  }
});

test('resend validates cooldown metadata and preserves server retry delays on errors', async () => {
  for (const body of [{}, { status: 'confirmed', retryAfter: 20 },
    ...[undefined, null, 0, -1, 1.5, '20'].map((retryAfter) => ({ status: 'pending', retryAfter }))]) {
    globalThis.fetch.mock.mockImplementation(async () => Response.json(body));
    await assert.rejects(api.resendVerification(receipt.resendToken), assertUnclearOutcome);
  }
  for (const status of [429, 503]) {
    globalThis.fetch.mock.mockImplementation(async () => Response.json({ error: 'Bitte warten', retryAfter: 20 }, { status }));
    await assert.rejects(api.resendVerification(receipt.resendToken), { status, message: 'Bitte warten', retryAfter: 20 });
  }
});

test('confirmBooking accepts only confirmed, including repeated confirmations', async () => {
  for (const body of [{}, [], { ok: true }, ...['pending', 'cancelled', 'expired', 'unknown', null].map((status) => ({ status }))]) {
    globalThis.fetch.mock.mockImplementation(async () => Response.json(body));
    await assert.rejects(api.confirmBooking('token'), assertUnclearOutcome);
  }
  const body = { status: 'confirmed', message: 'Reservation bestätigt!' };
  globalThis.fetch.mock.mockImplementation(async () => Response.json(body));
  assert.deepEqual(await api.confirmBooking('token'), body);
  assert.deepEqual(await api.confirmBooking('token'), body);
});
