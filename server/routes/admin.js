// ============================================================================
// Admin-Routen: Login sowie Verwaltung von Führungs-Slots und Reservationen.
// Alle Routen ausser /login erfordern ein gültiges Admin-Login (Cookie).
// ============================================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { db } from '../db/database.js';
import { expirePendingBookings } from '../bookings.js';
import { requireAdmin, JWT_SECRET, COOKIE_NAME } from '../auth.js';
import {
  isLockedOut,
  recordFailedAttempt,
  clearAttempts,
  getLockoutMinutesRemaining,
} from '../loginProtection.js';

const router = Router();

const isProduction = process.env.NODE_ENV === 'production';

// Fixer, gültiger bcrypt-Hash nur für Timing-sichere Dummy-Vergleiche
// (siehe unten) - gehört zu keinem echten Passwort.
const DUMMY_HASH = '$2b$10$mMgGsuQzis9BlwDiOIP.4e8Db3GL4hnfcfSLLaG0RnjChsZwRxguW';

// Zusätzlich zur Sperre pro Benutzername: grobes Rate-Limit pro IP-Adresse,
// damit auch das reine "Durchprobieren" vieler Benutzernamen erschwert wird.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Login-Versuche. Bitte später erneut versuchen.' },
});

// POST /api/admin/login
router.post('/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Benutzername und Passwort erforderlich.' });
  }

  if (isLockedOut(req, username)) {
    const minutes = getLockoutMinutesRemaining(req, username);
    return res.status(429).json({
      error: `Zu viele Fehlversuche. Bitte in ca. ${minutes} Minute(n) erneut versuchen.`,
    });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  // Auch wenn kein Benutzer existiert, führen wir einen (Dummy-)Vergleich durch,
  // damit die Antwortzeit nicht verrät, ob der Benutzername existiert.
  const hashToCompare = user?.password_hash || DUMMY_HASH;
  const passwordValid = bcrypt.compareSync(password, hashToCompare) && !!user;

  if (!passwordValid) {
    recordFailedAttempt(req, username);
    // Bewusst dieselbe, unspezifische Fehlermeldung wie bei falschem Passwort -
    // so lässt sich nicht erraten, ob ein Benutzername überhaupt existiert.
    return res.status(401).json({ error: 'Benutzername oder Passwort falsch.' });
  }

  clearAttempts(req, username);

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '12h',
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    maxAge: 12 * 60 * 60 * 1000,
  });

  res.json({ username: user.username });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
  });
  res.json({ ok: true });
});

// GET /api/admin/me
router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});

// ---- Ab hier: geschützte Verwaltungsrouten ----
router.use(requireAdmin);
router.use((req, res, next) => {
  expirePendingBookings();
  next();
});

// GET /api/admin/tours - alle Slots mit Buchungszahl
router.get('/tours', (req, res) => {
  const tours = db
    .prepare(`SELECT t.*, (SELECT COALESCE(SUM(group_size), 0) FROM bookings
      WHERE tour_id = t.id AND status = 'pending') AS pending_count
      FROM tours t ORDER BY date ASC, time ASC`)
    .all()
    .map((t) => ({
      id: t.id,
      date: t.date,
      time: t.time,
      capacity: t.capacity,
      bookedCount: t.booked_count,
      pendingCount: t.pending_count,
      isCancelled: !!t.is_cancelled,
    }));
  res.json(tours);
});

// POST /api/admin/tours - neuen Slot anlegen
router.post('/tours', (req, res) => {
  const { date, time, capacity } = req.body || {};
  if (!date || !time) {
    return res.status(400).json({ error: 'Datum und Uhrzeit erforderlich.' });
  }
  const cap = capacity === undefined ? 15 : Number(capacity);
  if (!Number.isSafeInteger(cap) || cap < 0) {
    return res.status(400).json({ error: 'Ungültige Kapazität.' });
  }
  const result = db
    .prepare('INSERT INTO tours (date, time, capacity) VALUES (?, ?, ?)')
    .run(date, time, cap);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PATCH /api/admin/tours/:id - Kapazität ändern oder stornieren
router.patch('/tours/:id', (req, res) => {
  const { id } = req.params;
  const { capacity, isCancelled } = req.body || {};

  const result = db.transaction(() => {
    expirePendingBookings();
    const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(id);
    if (!tour) return { code: 404, error: 'Führung nicht gefunden.' };
    const newCapacity = capacity !== undefined ? Number(capacity) : tour.capacity;
    if (!Number.isSafeInteger(newCapacity) || newCapacity < 0) {
      return { code: 400, error: 'Ungültige Kapazität.' };
    }
    if (newCapacity < tour.booked_count) {
      return { code: 409, error: 'Die Kapazität darf nicht kleiner als die Anzahl bestätigter und vorläufig gehaltener Plätze sein.' };
    }
    const newCancelled = isCancelled !== undefined ? (isCancelled ? 1 : 0) : tour.is_cancelled;
    db.prepare('UPDATE tours SET capacity = ?, is_cancelled = ? WHERE id = ?').run(newCapacity, newCancelled, id);
    return {};
  }).immediate();
  if (result.error) return res.status(result.code).json({ error: result.error });

  res.json({ ok: true });
});

// DELETE /api/admin/tours/:id - Slot löschen (nur wenn keine Buchungen bestehen)
router.delete('/tours/:id', (req, res) => {
  const { id } = req.params;
  const deleted = db.transaction(() => {
    expirePendingBookings();
    const bookingCount = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE tour_id = ? AND status IN ('pending', 'confirmed')").get(id).c;
    if (bookingCount > 0) return false;
    db.prepare('DELETE FROM tours WHERE id = ?').run(id);
    return true;
  }).immediate();
  if (!deleted) {
    return res.status(409).json({
      error: 'Slot kann nicht gelöscht werden, da bereits Reservationen bestehen. Stattdessen stornieren.',
    });
  }

  res.json({ ok: true });
});

// GET /api/admin/bookings - alle Reservationen (mit Tour-Infos)
router.get('/bookings', (req, res) => {
  const bookings = db
    .prepare(
      `SELECT b.id, b.tour_id, b.name, b.email, b.phone, b.group_size,
        b.is_school_class, b.note, b.status, b.created_at, b.verification_expires_at,
        t.date as tour_date, t.time as tour_time
       FROM bookings b
       JOIN tours t ON t.id = b.tour_id
       ORDER BY t.date ASC, t.time ASC, b.created_at ASC`
    )
    .all();
  res.json(bookings);
});

// PATCH /api/admin/bookings/:id - stornieren (setzt Status + reduziert booked_count)
router.patch('/bookings/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (status !== 'cancelled') {
    return res.status(400).json({ error: 'Nur eine Stornierung ist erlaubt.' });
  }
  const found = db.transaction(() => {
    expirePendingBookings();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) return false;
    if (booking.status === 'pending' || booking.status === 'confirmed') {
      db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(id);
      db.prepare('UPDATE tours SET booked_count = booked_count - ? WHERE id = ?')
        .run(booking.group_size, booking.tour_id);
    }
    return true;
  }).immediate();
  if (!found) return res.status(404).json({ error: 'Reservation nicht gefunden.' });

  res.json({ ok: true });
});

export default router;
