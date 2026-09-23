import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { Resend } from 'resend';

// Replace the environment before importing application code; never load .env.
const originalEnv = process.env;
process.env = { NODE_ENV: 'production' };
const { sendChurchNotification, sendVisitorConfirmation, sendVisitorVerification } = await import('./mailer.js');
after(() => { process.env = originalEnv; });

const booking = {
  name: 'Test Visitor', email: 'visitor@example.test', phone: '+41 00 000 00 00',
  groupSize: 4, isSchoolClass: false, note: 'Test note',
};
const tour = { date: '2027-03-17', time: '14:00' };
const senders = [sendChurchNotification, sendVisitorConfirmation];
let requests;

beforeEach((t) => {
  process.env = { NODE_ENV: 'production' };
  requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options, mail: JSON.parse(options.body) });
    return Response.json({ id: 'mock-email-id' });
  });
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
});

test('missing API key skips both messages without network requests', async () => {
  for (const send of senders) await send(booking, tour);
  assert.equal(requests.length, 0);
  assert.equal(console.warn.mock.callCount(), 2);
  assert.equal(console.error.mock.callCount(), 0);
});

test('verification requires configuration and uses a fragment token and contact details', async () => {
  const token = 'ab'.repeat(32);
  await assert.rejects(sendVisitorVerification(booking, tour, token), /nicht konfiguriert/);
  assert.equal(requests.length, 0);
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.PUBLIC_URL = 'https://site.example.test/';
  await sendVisitorVerification({ ...booking, name: '<Visitor>' }, tour, token);
  const { mail } = requests[0];
  assert.equal(mail.to, booking.email);
  assert.ok(mail.html.includes(`href="https://site.example.test/reservation/bestaetigen#token=${token}"`));
  assert.match(mail.html, /&lt;Visitor&gt;/);
  assert.match(mail.html, /30 Minuten/);
  assert.match(mail.html, /Susanne Egloff/);
  assert.match(mail.html, /mailto:susanne\.egloff@kirche-wm\.ch/);
  assert.match(mail.html, /tel:0523191273/);
});

test('verification rejects provider errors, missing acceptance ID, and network errors', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  for (const result of [
    () => Response.json({ name: 'validation_error', message: 'secret link' }, { status: 403 }),
    () => Response.json({}),
    () => { throw new Error('offline'); },
  ]) {
    globalThis.fetch.mock.mockImplementation(result);
    await assert.rejects(sendVisitorVerification(booking, tour, 'ab'.repeat(32)), /nicht angenommen/);
  }
});

test('missing notification recipient only skips the church message', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  for (const send of senders) await send(booking, tour);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].mail.to, booking.email);
  assert.match(console.warn.mock.calls[0].arguments[0], /NOTIFY_EMAIL/);
});

test('reads runtime configuration and defaults to the canonical sender and links', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.NOTIFY_EMAIL = 'notifications@example.test';
  process.env.CLIENT_ORIGIN = 'https://one.example.test,https://two.example.test';
  for (const send of senders) await send(booking, tour);
  assert.equal(requests.length, 2);
  for (const { url, options, mail } of requests) {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.get('Authorization'), 'Bearer re_test_only');
    assert.equal(mail.from, 'Osterweg Wyland <noreply@osterweg-wyland.com>');
    assert.equal(Object.hasOwn(mail, 'reply_to'), false);
    assert.doesNotMatch(mail.html, /one\.example|two\.example/);
  }
  assert.equal(requests[0].mail.to, 'notifications@example.test');
  assert.match(requests[0].mail.html, /href="https:\/\/osterweg-wyland\.com\/admin"/);
  assert.match(requests[1].mail.html, /href="https:\/\/osterweg-wyland\.com\/"/);
  assert.match(requests[1].mail.html, /Bitte antworte nicht/);
  assert.match(requests[1].mail.html, /Susanne Egloff/);
  assert.match(requests[1].mail.html, /Schulklassen/);
  assert.match(requests[1].mail.html, /href="mailto:susanne\.egloff@kirche-wm\.ch"/);
  assert.match(requests[1].mail.html, /href="tel:0523191273"/);
  assert.doesNotMatch(requests[1].mail.html, /per Antwort auf diese E-Mail/);
  assert.equal(console.error.mock.callCount(), 0);

  process.env.RESEND_API_KEY = 're_changed_test_only';
  process.env.MAIL_FROM = 'Test Sender <sender@example.test>';
  process.env.NOTIFY_EMAIL = 'changed@example.test';
  process.env.MAIL_REPLY_TO = 'contact@example.test';
  process.env.PUBLIC_URL = 'https://site.example.test/';
  for (const send of senders) await send(booking, tour);
  for (const { options, mail } of requests.slice(2)) {
    assert.equal(options.headers.get('Authorization'), 'Bearer re_changed_test_only');
    assert.equal(mail.from, process.env.MAIL_FROM);
    assert.equal(mail.reply_to, 'contact@example.test');
  }
  assert.equal(requests[2].mail.to, 'changed@example.test');
  assert.match(requests[2].mail.html, /href="https:\/\/site\.example\.test\/admin"/);
  assert.match(requests[3].mail.html, /per Antwort auf diese E-Mail/);
  assert.doesNotMatch(requests[3].mail.html, /Bitte antworte nicht/);

  delete process.env.RESEND_API_KEY;
  for (const send of senders) await send(booking, tour);
  assert.equal(requests.length, 4);
});

test('escapes user-controlled HTML in both messages without altering recipients', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.NOTIFY_EMAIL = 'notifications@example.test';
  const unsafe = `<img src=x onerror="alert('x')"> &`;
  const escaped = '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;';
  const maliciousBooking = {
    ...booking, name: unsafe, email: `${unsafe}@example.test`,
    phone: unsafe, note: unsafe, groupSize: unsafe,
  };
  for (const send of senders) await send(maliciousBooking, { ...tour, time: unsafe });
  assert.equal(requests[0].mail.html.split(escaped).length - 1, 6);
  assert.equal(requests[1].mail.html.split(escaped).length - 1, 3);
  for (const { mail } of requests) assert.doesNotMatch(mail.html, /<img/);
  assert.equal(requests[1].mail.to, maliciousBooking.email);
});

test('PUBLIC_URL works without a trailing slash and resolves links from the site root', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.NOTIFY_EMAIL = 'notifications@example.test';
  process.env.PUBLIC_URL = 'https://site.example.test';
  await sendChurchNotification(booking, tour);
  assert.match(requests[0].mail.html, /href="https:\/\/site\.example\.test\/admin"/);
  process.env.PUBLIC_URL = "https://site.example.test/a?value='&other=1";
  await sendVisitorConfirmation(booking, tour);
  assert.match(requests[1].mail.html, /href="https:\/\/site\.example\.test\/"/);
});

for (const send of senders) {
  test(`${send.name} logs returned Resend errors without rejecting`, async () => {
    process.env.RESEND_API_KEY = 're_test_only';
    process.env.NOTIFY_EMAIL = 'notifications@example.test';
    globalThis.fetch.mock.mockImplementation(async () => Response.json({
      name: 'validation_error', message: 'Mock sender rejected', statusCode: 403,
    }, { status: 403 }));
    await assert.doesNotReject(send(booking, tour));
    assert.equal(globalThis.fetch.mock.callCount(), 1);
    assert.equal(console.error.mock.callCount(), 1);
    assert.match(console.error.mock.calls[0].arguments[0], /\[mailer\] Fehler/);
    assert.equal(console.error.mock.calls[0].arguments[1], 'Mock sender rejected');
  });

  test(`${send.name} handles network failures without rejecting`, async () => {
    process.env.RESEND_API_KEY = 're_test_only';
    process.env.NOTIFY_EMAIL = 'notifications@example.test';
    globalThis.fetch.mock.mockImplementation(async () => { throw new Error('Mock offline'); });
    await assert.doesNotReject(send(booking, tour));
    assert.equal(console.error.mock.callCount(), 1);
    assert.match(console.error.mock.calls[0].arguments[1], /Unable to fetch data/);
  });

  test(`${send.name} catches SDK exceptions without rejecting`, async (t) => {
    process.env.RESEND_API_KEY = 're_test_only';
    process.env.NOTIFY_EMAIL = 'notifications@example.test';
    t.mock.method(Resend.prototype, 'post', async () => { throw new Error('Mock SDK failure'); });
    await assert.doesNotReject(send(booking, tour));
    assert.equal(console.error.mock.callCount(), 1);
    assert.equal(console.error.mock.calls[0].arguments[1], 'Mock SDK failure');
    assert.equal(requests.length, 0);
  });
}

test('invalid or non-HTTP public URLs are logged without sending or rejecting', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.NOTIFY_EMAIL = 'notifications@example.test';
  for (const url of ['not a URL', 'javascript:alert(1)']) {
    process.env.PUBLIC_URL = url;
    for (const send of senders) await assert.doesNotReject(send(booking, tour));
  }
  assert.equal(requests.length, 0);
  assert.equal(console.error.mock.callCount(), 4);
});
