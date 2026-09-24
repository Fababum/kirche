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
const allSenders = [sendVisitorVerification, ...senders];
const token = 'ab'.repeat(32);
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
  for (const key of [undefined, '', '  ']) {
    if (key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = key;
    await assert.rejects(sendVisitorVerification(booking, tour, token), {
      message: 'Verifikationsmail ist nicht konfiguriert.', code: 'MAIL_NOT_CONFIGURED',
    });
  }
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
    await assert.rejects(sendVisitorVerification(booking, tour, token), {
      message: 'Verifikationsmail wurde nicht angenommen.', code: 'MAIL_REJECTED',
    });
  }
});

test('resent verification states the absolute original Zurich deadline, never a new 30-minute window', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.TZ = 'America/Los_Angeles';
  const expiresAt = Date.parse('2027-03-01T12:30:00Z');
  await sendVisitorVerification(booking, tour, token, expiresAt);
  await sendVisitorVerification(booking, tour, 'cd'.repeat(32), expiresAt);
  for (const { mail } of requests) {
    for (const content of [mail.html, mail.text]) {
      assert.match(content, /01\.03\.2027, 13:30:00 Uhr \(Schweizer Zeit\)/);
      assert.match(content, /ab der Anmeldung für 30 Minuten/);
      assert.match(content, /Auch bei erneutem Versand bleibt diese ursprüngliche Frist unverändert/);
      assert.doesNotMatch(content, /innerhalb von 30 Minuten bestätigst/);
    }
  }
});

test('verification preserves numeric provider status without exposing diagnostics', async (t) => {
  process.env.RESEND_API_KEY = 're_test_only';
  const post = t.mock.method(Resend.prototype, 'post');
  for (const statusCode of [429, '429', undefined]) {
    post.mock.mockImplementation(async () => ({ error: { message: `secret ${token}`, statusCode } }));
    await assert.rejects(sendVisitorVerification(booking, tour, token), (error) => {
      assert.equal(error.code, 'MAIL_REJECTED');
      assert.equal(error.providerStatus, Number.isInteger(statusCode) ? statusCode : undefined);
      assert.doesNotMatch(error.message, /secret|abab/);
      return true;
    });
  }
  assert.equal(console.error.mock.callCount(), 0);
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

test('escapes user-controlled HTML in all messages without altering recipients or plain text', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.NOTIFY_EMAIL = 'notifications@example.test';
  const unsafe = `<img src=x onerror="alert('x')"> &`;
  const escaped = '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;';
  const maliciousBooking = {
    ...booking, name: unsafe, email: `${unsafe}@example.test`,
    phone: unsafe, note: unsafe, groupSize: unsafe,
  };
  for (const send of allSenders) await send(maliciousBooking, { ...tour, time: unsafe }, token);
  for (const { mail } of requests) {
    assert.ok(mail.html.includes(escaped));
    assert.ok(!mail.html.includes(unsafe));
    assert.equal((mail.html.match(/<img\b/g) || []).length, 1);
    assert.match(mail.html, /<img src="https:\/\/osterweg-wyland\.com\/images\/logo\.png"/);
    assert.doesNotMatch(mail.html, /<script\b|<img src=x|<[^>]*\sonerror=/);
    assert.ok(mail.text.includes(unsafe));
    assert.ok(!mail.text.includes(escaped));
  }
  for (const label of ['Name', 'E-Mail', 'Telefon', 'Notiz', 'Personen', 'Uhrzeit']) {
    assert.ok(requests[1].mail.text.includes(`${label}: ${unsafe}`));
  }
  assert.equal(requests[0].mail.to, maliciousBooking.email);
  assert.equal(requests[2].mail.to, maliciousBooking.email);
});

test('all three messages share accessible email-safe HTML and equivalent plain text', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.NOTIFY_EMAIL = 'notifications@example.test';
  process.env.PUBLIC_URL = 'https://site.example.test/nested/';
  for (const send of allSenders) await send(booking, tour, token);
  const links = [
    `https://site.example.test/reservation/bestaetigen#token=${token}`,
    'https://site.example.test/admin', 'https://site.example.test/',
  ];
  for (const [index, { mail }] of requests.entries()) {
    for (const content of [mail.html, mail.text]) {
      for (const value of ['17.03.2027', '14:00 Uhr', 'Personen', '4', 'Reformierte Kirche, Hauptstrasse, 8467 Truttikon',
        'Susanne Egloff', 'susanne.egloff@kirche-wm.ch', '052 319 12 73', 'Fragen', 'Änderungen', 'Schulklassen',
        'Evangelisch-reformierte Kirchgemeinde Weinland Mitte', 'Sekretariat Rheinau', 'Poststrasse 6', '8462 Rheinau',
        'Bitte antworte nicht', links[index]]) assert.ok(content.includes(value), value);
    }
    assert.match(mail.html, /<html lang="de">/);
    assert.equal((mail.html.match(/<h1\b/g) || []).length, 1);
    assert.match(mail.html, /<table role="presentation"/);
    assert.match(mail.html, /max-width:600px/);
    assert.match(mail.html, /\[if mso\]/);
    assert.match(mail.html, /mso-hide:all/);
    assert.match(mail.html, /font-family:Arial,Helvetica,sans-serif/);
    for (const color of ['#fdedcf', '#fff8eb', '#f4c880', '#a9425f', '#29211f']) assert.ok(mail.html.includes(color));
    assert.match(mail.html, /border:16px solid #a9425f;[^"<>]*color:#ffffff/);
    assert.ok(mail.html.includes(`href="${links[index]}"`));
    assert.ok(mail.html.includes(`>${links[index]}</a>`));
    assert.match(mail.html, /kopiere diesen Link/);
    assert.match(mail.html, /<td align="right"[^>]*>\s*<a href="https:\/\/www\.kirche-wm\.ch\/"[^>]*><img src="https:\/\/site\.example\.test\/images\/logo\.png" alt="Reformierte Kirche Weinland Mitte" width="190"/);
    assert.ok(mail.html.lastIndexOf('<img') > mail.html.indexOf('Poststrasse 6'));
    assert.doesNotMatch(mail.html, /<script\b|<style\b|<link\b|<form\b|<iframe\b|@font-face|javascript:/i);
    assert.doesNotMatch(mail.text, /<table\b|<h1\b|&amp;|&lt;/);
  }
  for (const content of [requests[0].mail.html, requests[0].mail.text]) {
    assert.match(content, /Hallo Test Visitor/);
    assert.match(content, /noch nicht bestätigt/);
    assert.match(content, /Das Öffnen des Links allein bestätigt noch nichts/);
    assert.match(content, /Nur wenn du deine Reservation nicht innerhalb von 30 Minuten ab der Anmeldung bestätigst, verfällt sie und die Plätze werden automatisch wieder freigegeben/);
    assert.match(content, /Bereits bestätigte Reservationen bleiben bestehen/);
    assert.doesNotMatch(content, /\?token=|Danach werden die Plätze/);
  }
  for (const { mail } of requests.slice(1)) {
    for (const content of [mail.html, mail.text]) {
      assert.match(content, /bestätigt/);
      assert.doesNotMatch(content, /30 Minuten|verfällt|freigegeben|#token=|noch nicht bestätigt/);
    }
  }
  assert.match(requests[1].mail.text, /Liebes Osterweg-Team/);
  assert.match(requests[1].mail.text, /Schulklasse: Nein\nNotiz: Test note/);
  assert.match(requests[2].mail.text, /Hallo Test Visitor/);
  assert.match(requests[2].mail.text, /Du musst nichts weiter bestätigen/);
});

test('reply-to stays unchanged and is escaped only in HTML in every message', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.NOTIFY_EMAIL = 'notifications@example.test';
  process.env.MAIL_REPLY_TO = 'Kontakt & Team <reply@example.test>';
  for (const send of allSenders) await send(booking, tour, token);
  for (const { mail } of requests) {
    assert.equal(mail.reply_to, process.env.MAIL_REPLY_TO);
    assert.match(mail.html, /Kontakt &amp; Team &lt;reply@example.test&gt;/);
    assert.ok(mail.text.includes(process.env.MAIL_REPLY_TO));
    for (const content of [mail.html, mail.text]) {
      assert.match(content, /per Antwort auf diese E-Mail/);
      assert.doesNotMatch(content, /Bitte antworte nicht/);
    }
  }
});

test('fragment URLs remain plain in text and are escaped once in HTML attributes and fallback', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.PUBLIC_URL = 'https://site.example.test/base?unused=1&other=2';
  const specialToken = `${token}&value="<test>'`;
  await sendVisitorVerification(booking, tour, specialToken);
  const { mail } = requests[0];
  const url = `https://site.example.test/reservation/bestaetigen#token=${token}&value=%22%3Ctest%3E'`;
  const htmlUrl = url.replace('&', '&amp;').replace("'", '&#39;');
  assert.ok(mail.text.includes(url));
  assert.ok(mail.html.includes(`href="${htmlUrl}"`));
  assert.ok(mail.html.includes(`>${htmlUrl}</a>`));
  assert.doesNotMatch(mail.text, /&amp;|&#39;/);
  assert.doesNotMatch(mail.html, /&amp;amp;|&amp;#39;/);
});

test('long names, contact fields, notes and links have fluid wrapping without truncation', async () => {
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.NOTIFY_EMAIL = 'notifications@example.test';
  const long = 'Unbroken'.repeat(150);
  for (const send of allSenders) {
    await send({ ...booking, name: long, email: `${long}@example.test`, phone: long, note: `${long}\nSecond line`, isSchoolClass: true }, tour, token);
  }
  for (const { mail } of requests) {
    assert.ok(mail.html.includes(long));
    assert.ok(mail.text.includes(long));
    assert.match(mail.html, /table-layout:fixed/);
    assert.match(mail.html, /overflow-wrap:anywhere;word-wrap:break-word;word-break:break-word/);
    assert.doesNotMatch(mail.html, /white-space:nowrap|min-width:/);
    assert.match(mail.html, /<a href="https:[^"]+" style="[^"]*overflow-wrap:anywhere/);
  }
  assert.ok(requests[1].mail.html.includes(`${long}\nSecond line`));
  assert.match(requests[1].mail.html, /white-space:pre-line/);
  assert.match(requests[1].mail.text, /Schulklasse: Ja/);
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
