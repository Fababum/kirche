// ============================================================================
// E-Mail-Versand über Resend (https://resend.com).
// Benachrichtigt die Kirche bei neuen Reservationen und bestätigt dem
// Besucher seine Buchung. Wenn kein RESEND_API_KEY gesetzt ist, wird der
// Versand übersprungen (z.B. lokale Entwicklung) - Buchungen funktionieren
// in diesem Fall trotzdem weiter, es wird nur eine Warnung geloggt.
// ============================================================================
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || 'Osterweg Wyland <onboarding@resend.dev>';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function isMailConfigured() {
  return !!resend;
}

function formatDate(dateStr) {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('de-CH', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Sendet der Kirche eine Benachrichtigung über eine neue Reservation.
// Fire-and-forget: Fehler werden nur geloggt, blockieren die Buchung nicht.
export async function sendChurchNotification(booking, tour) {
  if (!isMailConfigured()) {
    console.warn('[mailer] RESEND_API_KEY nicht gesetzt - überspringe Benachrichtigung an Kirche.');
    return;
  }
  if (!NOTIFY_EMAIL) {
    console.warn('[mailer] NOTIFY_EMAIL nicht gesetzt - überspringe Benachrichtigung an Kirche.');
    return;
  }

  try {
    await resend.emails.send({
      from: MAIL_FROM,
      to: NOTIFY_EMAIL,
      subject: `Neue Reservation: ${booking.name} (${formatDate(tour.date)})`,
      html: `
        <h2>Neue Reservation eingegangen</h2>
        <table cellpadding="6" style="border-collapse: collapse;">
          <tr><td><strong>Führung</strong></td><td>${formatDate(tour.date)}, ${tour.time} Uhr</td></tr>
          <tr><td><strong>Name</strong></td><td>${booking.name}</td></tr>
          <tr><td><strong>E-Mail</strong></td><td>${booking.email}</td></tr>
          <tr><td><strong>Telefon</strong></td><td>${booking.phone || '-'}</td></tr>
          <tr><td><strong>Gruppengrösse</strong></td><td>${booking.groupSize}</td></tr>
          <tr><td><strong>Schulklasse</strong></td><td>${booking.isSchoolClass ? 'Ja' : 'Nein'}</td></tr>
          <tr><td><strong>Notiz</strong></td><td>${booking.note || '-'}</td></tr>
        </table>
        <p><a href="${process.env.CLIENT_ORIGIN || ''}/admin">Zur Verwaltung öffnen</a></p>
      `,
    });
  } catch (err) {
    console.error('[mailer] Fehler beim Senden der Kirchen-Benachrichtigung:', err.message);
  }
}

// Sendet dem Besucher eine Bestätigung seiner Reservation.
export async function sendVisitorConfirmation(booking, tour) {
  if (!isMailConfigured()) {
    console.warn('[mailer] RESEND_API_KEY nicht gesetzt - überspringe Bestätigungsmail an Besucher.');
    return;
  }

  try {
    await resend.emails.send({
      from: MAIL_FROM,
      to: booking.email,
      subject: 'Deine Reservation für den Osterweg Wyland',
      html: `
        <h2>Vielen Dank für deine Reservation, ${booking.name}!</h2>
        <p>Wir haben deine Anmeldung für den Osterweg Wyland erhalten:</p>
        <table cellpadding="6" style="border-collapse: collapse;">
          <tr><td><strong>Datum</strong></td><td>${formatDate(tour.date)}</td></tr>
          <tr><td><strong>Uhrzeit</strong></td><td>${tour.time} Uhr</td></tr>
          <tr><td><strong>Gruppengrösse</strong></td><td>${booking.groupSize}</td></tr>
        </table>
        <p>Wir freuen uns auf euren Besuch!</p>
        <p>Bei Fragen oder falls du die Reservation ändern möchtest, melde dich einfach per Antwort auf diese E-Mail.</p>
      `,
    });
  } catch (err) {
    console.error('[mailer] Fehler beim Senden der Besucher-Bestätigung:', err.message);
  }
}
