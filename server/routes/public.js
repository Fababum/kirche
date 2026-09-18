// ============================================================================
// Öffentliche Routen: Führungs-Slots ansehen & Reservation vornehmen.
// Kein Login nötig - für Besucher der Webseite.
// ============================================================================
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/database.js';
import { sendChurchNotification, sendVisitorConfirmation } from '../mailer.js';

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
router.post('/bookings', bookingRateLimiter, (req, res) => {
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
  if (!Number.isFinite(size) || size < 1 || size > 500) {
    return res.status(400).json({ error: 'Ungültige Gruppengrösse.' });
  }

  const tour = db.prepare('SELECT * FROM tours WHERE id = ? AND is_cancelled = 0').get(tourId);
  if (!tour) {
    return res.status(404).json({ error: 'Führung nicht gefunden.' });
  }

  const freeSpots = tour.capacity - tour.booked_count;
  if (size > freeSpots) {
    return res.status(409).json({
      error: `Für diese Führung sind nur noch ${freeSpots} Plätze frei.`,
    });
  }

  const insertBooking = db.prepare(`
    INSERT INTO bookings (tour_id, name, email, phone, group_size, is_school_class, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateTour = db.prepare(`
    UPDATE tours SET booked_count = booked_count + ? WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    const result = insertBooking.run(
      tourId,
      trimmedName,
      trimmedEmail,
      trimmedPhone || null,
      size,
      isSchoolClass ? 1 : 0,
      trimmedNote || null
    );
    updateTour.run(size, tourId);
    return result.lastInsertRowid;
  });

  const bookingId = transaction();

  res.status(201).json({
    id: bookingId,
    message: 'Reservation erfolgreich! Wir freuen uns auf euren Besuch.',
  });

  // Benachrichtigungen laufen im Hintergrund weiter - ein Mailfehler soll die
  // bereits gesendete Erfolgsantwort an den Besucher nicht beeinträchtigen.
  const bookingForMail = {
    name: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone,
    groupSize: size,
    isSchoolClass: !!isSchoolClass,
    note: trimmedNote,
  };
  sendChurchNotification(bookingForMail, tour);
  sendVisitorConfirmation(bookingForMail, tour);
});

export default router;
