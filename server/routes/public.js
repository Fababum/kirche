// ============================================================================
// Öffentliche Routen: Führungs-Slots ansehen & Reservation vornehmen.
// Kein Login nötig - für Besucher der Webseite.
// ============================================================================
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '../db/database.js';
import { expirePendingBookings, VERIFICATION_TTL_MS } from '../bookings.js';
import { sendChurchNotification, sendVisitorConfirmation, sendVisitorVerification } from '../mailer.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Verhindert Spam-Reservationen: max. 10 Buchungen pro 15 Min und IP.
const bookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Reservationsversuche. Bitte später erneut versuchen.' },
});

// GET /api/tours?from=YYYY-MM-DD&to=YYYY-MM-DD
// Liefert alle (nicht stornierten) Slots inkl. freier Plätze im Zeitraum.
router.get('/tours', (req, res) => {
  expirePendingBookings();
  const { from, to } = req.query;

  let query = 'SELECT * FROM tours WHERE is_cancelled = 0';
  const params = [];

  if (from) {
    query += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND date <= ?';
    params.push(to);
  }
  query += ' ORDER BY date ASC, time ASC';

  const tours = db.prepare(query).all(...params);

  const result = tours.map((t) => ({
    id: t.id,
    date: t.date,
    time: t.time,
    capacity: t.capacity,
    bookedCount: t.booked_count,
    freeSpots: Math.max(0, t.capacity - t.booked_count),
    isFull: t.booked_count >= t.capacity,
  }));

  res.json(result);
});

// POST /api/bookings
// Body: { tourId, name, email, phone, groupSize, isSchoolClass, note }
router.post('/bookings', bookingRateLimiter, async (req, res) => {
  expirePendingBookings();
  const {
    tourId,
    name,
    email,
    phone,
    groupSize,
    isSchoolClass,
    note,
  } = req.body || {};

  if (!tourId || !name || !email || !groupSize) {
    return res
      .status(400)
      .json({ error: 'Bitte Name, E-Mail, Führung und Gruppengrösse angeben.' });
  }

  const trimmedName = String(name).trim();
  const trimmedEmail = String(email).trim();
  const trimmedPhone = phone ? String(phone).trim() : '';
  const trimmedNote = note ? String(note).trim() : '';

  if (trimmedName.length === 0 || trimmedName.length > 200) {
    return res.status(400).json({ error: 'Name muss zwischen 1 und 200 Zeichen lang sein.' });
  }
  if (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 200) {
    return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  }
  if (trimmedPhone.length > 50) {
    return res.status(400).json({ error: 'Telefonnummer ist zu lang.' });
  }
  if (trimmedNote.length > 2000) {
    return res.status(400).json({ error: 'Notiz ist zu lang (max. 2000 Zeichen).' });
  }

  const size = Number(groupSize);
  if (!Number.isInteger(size) || size < 1 || size > 500) {
    return res.status(400).json({ error: 'Ungültige Gruppengrösse.' });
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const result = db.transaction(() => {
    expirePendingBookings();
    const tour = db.prepare('SELECT * FROM tours WHERE id = ? AND is_cancelled = 0').get(tourId);
    if (!tour) return { code: 404, error: 'Führung nicht gefunden.' };
    const freeSpots = tour.capacity - tour.booked_count;
    if (size > freeSpots) {
      return { code: 409, error: `Für diese Führung sind nur noch ${freeSpots} Plätze frei.` };
    }
    const inserted = db.prepare(`
      INSERT INTO bookings (tour_id, name, email, phone, group_size, is_school_class, note,
        status, verification_token_hash, verification_expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      tourId,
      trimmedName,
      trimmedEmail,
      trimmedPhone || null,
      size,
      isSchoolClass ? 1 : 0,
      trimmedNote || null,
      tokenHash,
      Date.now() + VERIFICATION_TTL_MS
    );
    db.prepare('UPDATE tours SET booked_count = booked_count + ? WHERE id = ?').run(size, tourId);
    return { id: inserted.lastInsertRowid, tour };
  }).immediate();
  if (result.error) return res.status(result.code).json({ error: result.error });

  const bookingForMail = {
    name: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone,
    groupSize: size,
    isSchoolClass: !!isSchoolClass,
    note: trimmedNote,
  };
  try {
    await sendVisitorVerification(bookingForMail, result.tour, token);
  } catch (err) {
    // Never hold a SQLite transaction open over network I/O. Compensate atomically;
    // an expiry/cancellation racing the send must not release these seats twice.
    db.transaction(() => {
      expirePendingBookings();
      const cancelled = db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(result.id);
      if (cancelled.changes) {
        db.prepare('UPDATE tours SET booked_count = booked_count - ? WHERE id = ?').run(size, tourId);
      }
    }).immediate();
    const reason = ['MAIL_NOT_CONFIGURED', 'MAIL_REJECTED'].includes(err.code)
      ? err.code : 'MAIL_UNAVAILABLE';
    console.error('[bookings] Verifikationsmail fehlgeschlagen:', reason,
      Number.isInteger(err.providerStatus) ? err.providerStatus : '');
    return res.status(503).json({
      error: `${reason === 'MAIL_NOT_CONFIGURED'
        ? 'Unser E-Mail-Versand ist noch nicht eingerichtet.'
        : 'Unser E-Mail-Dienst konnte die Bestätigungs-E-Mail derzeit nicht versenden.'} Deine Reservation wurde deshalb nicht abgeschlossen; es werden keine Plätze für diese Anmeldung freigehalten. Bitte kontaktiere Susanne Egloff: susanne.egloff@kirche-wm.ch, 052 319 12 73.`,
    });
  }

  expirePendingBookings();
  const current = db.prepare('SELECT status FROM bookings WHERE id = ?').get(result.id);
  if (current?.status === 'expired') {
    return res.status(410).json({ error: 'Die Reservation ist abgelaufen. Bitte reserviere erneut.' });
  }
  if (!current || current.status === 'cancelled' || db.prepare('SELECT is_cancelled FROM tours WHERE id = ?').get(tourId)?.is_cancelled) {
    return res.status(409).json({ error: 'Die Reservation oder Führung wurde storniert.' });
  }
  res.status(201).json({
    id: result.id,
    status: 'pending',
    message: 'Bitte bestätige deine E-Mail-Adresse über die soeben gesendete E-Mail innerhalb von 30 Minuten. Bis dahin halten wir deine Plätze frei; erst danach ist die Reservation bestätigt.',
  });
});

const confirmationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Bestätigungsversuche. Bitte später erneut versuchen.' },
});

// Deliberately POST only: following a mail link (including a scanner) cannot confirm.
router.post('/bookings/confirm', confirmationRateLimiter, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  expirePendingBookings();
  const { token } = req.body || {};
  const invalid = { code: 400, error: 'Dieser Bestätigungslink ist ungültig.' };
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(invalid.code).json({ error: invalid.error });
  }
  const hash = createHash('sha256').update(token).digest('hex');
  const result = db.transaction(() => {
    expirePendingBookings();
    const booking = db.prepare('SELECT * FROM bookings WHERE verification_token_hash = ?').get(hash);
    if (!booking) return invalid;
    if (booking.status === 'expired') {
      return { code: 410, error: 'Der Bestätigungslink ist abgelaufen. Bitte reserviere erneut.' };
    }
    const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(booking.tour_id);
    if (booking.status === 'cancelled' || !tour || tour.is_cancelled) {
      return { code: 409, error: 'Die Reservation oder Führung wurde storniert.' };
    }
    if (booking.status === 'confirmed') return { alreadyConfirmed: true };
    if (booking.status !== 'pending') return invalid;
    db.prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?").run(booking.id);
    // Keep the hash for idempotent retries, even after the original expiry.
    return { booking, tour };
  }).immediate();
  if (result.error) return res.status(result.code).json({ error: result.error });

  if (!result.alreadyConfirmed) {
    const { booking, tour } = result;
    const bookingForMail = {
      name: booking.name, email: booking.email, phone: booking.phone,
      groupSize: booking.group_size, isSchoolClass: !!booking.is_school_class, note: booking.note,
    };
    const notifications = await Promise.allSettled([
      sendVisitorConfirmation(bookingForMail, tour),
      sendChurchNotification(bookingForMail, tour),
    ]);
    if (notifications.some((notification) => notification.status === 'rejected')) {
      console.error('[bookings] Benachrichtigung nach Bestätigung fehlgeschlagen.');
    }
  }
  res.json({ status: 'confirmed', message: 'Reservation bestätigt! Wir freuen uns auf euren Besuch.' });
});

export default router;
