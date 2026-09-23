// ============================================================================
// E-Mail-Versand über Resend (https://resend.com).
// Die Verifikationsmail ist zwingend. Erst nach E-Mail-Bestätigung folgen
// Besucher-Bestätigung und Kirchen-Benachrichtigung (best effort).
// ============================================================================
import { Resend } from 'resend';

const DEFAULT_MAIL_FROM = 'Osterweg Wyland <noreply@osterweg-wyland.com>';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function publicUrl(path) {
  const url = new URL(path, process.env.PUBLIC_URL || 'https://osterweg-wyland.com');
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('PUBLIC_URL muss eine HTTP(S)-URL sein.');
  }
  return escapeHtml(url.href);
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

export async function sendVisitorVerification(booking, tour, token) {
  const { RESEND_API_KEY, MAIL_FROM, MAIL_REPLY_TO } = process.env;
  if (!RESEND_API_KEY) throw new Error('Verifikationsmail ist nicht konfiguriert.');

  const resend = new Resend(RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: MAIL_FROM || DEFAULT_MAIL_FROM,
    to: booking.email,
    ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
    subject: 'Bitte bestätige deine E-Mail-Adresse für den Osterweg Wyland',
    html: `
      <h2>Bitte bestätige deine E-Mail-Adresse, ${escapeHtml(booking.name)}!</h2>
      <p>Deine Reservation ist noch nicht bestätigt. Wir halten ${escapeHtml(booking.groupSize)}
      Plätze am ${escapeHtml(formatDate(tour.date))}, ${escapeHtml(tour.time)} Uhr für 30 Minuten frei.</p>
      <p>Öffne den folgenden Link und bestätige dort deine Reservation innerhalb von 30 Minuten:</p>
      <p><a href="${publicUrl(`/reservation/bestaetigen#token=${token}`)}">E-Mail-Adresse und Reservation bestätigen</a></p>
      <p>Danach werden die Plätze automatisch wieder freigegeben. Falls du keine Reservation
      angefragt hast, ignoriere diese E-Mail.</p>
      <p>Bei Fragen, Änderungen oder Problemen hilft dir <strong>Susanne Egloff</strong>:
      <a href="mailto:susanne.egloff@kirche-wm.ch">susanne.egloff@kirche-wm.ch</a>,
      <a href="tel:0523191273">052 319 12 73</a>.</p>
    `,
  });
  // Do not propagate provider diagnostics: they can contain the secret mail link.
  if (error || !data?.id) throw new Error('Verifikationsmail wurde nicht angenommen.');
}

// Sendet der Kirche eine Benachrichtigung über eine neue Reservation.
// Fire-and-forget: Fehler werden nur geloggt, blockieren die Buchung nicht.
export async function sendChurchNotification(booking, tour) {
  // Zur Laufzeit lesen, damit die aktuelle Mailkonfiguration verwendet wird.
  const { RESEND_API_KEY, NOTIFY_EMAIL, MAIL_FROM, MAIL_REPLY_TO } = process.env;
  if (!RESEND_API_KEY) {
    console.warn('[mailer] RESEND_API_KEY nicht gesetzt - überspringe Benachrichtigung an Kirche.');
    return;
  }
  if (!NOTIFY_EMAIL) {
    console.warn('[mailer] NOTIFY_EMAIL nicht gesetzt - überspringe Benachrichtigung an Kirche.');
    return;
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: MAIL_FROM || DEFAULT_MAIL_FROM,
      to: NOTIFY_EMAIL,
      ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
      subject: `Neue Reservation: ${booking.name} (${formatDate(tour.date)})`,
      html: `
        <h2>Neue Reservation eingegangen</h2>
        <table cellpadding="6" style="border-collapse: collapse;">
          <tr><td><strong>Führung</strong></td><td>${escapeHtml(formatDate(tour.date))}, ${escapeHtml(tour.time)} Uhr</td></tr>
          <tr><td><strong>Name</strong></td><td>${escapeHtml(booking.name)}</td></tr>
          <tr><td><strong>E-Mail</strong></td><td>${escapeHtml(booking.email)}</td></tr>
          <tr><td><strong>Telefon</strong></td><td>${escapeHtml(booking.phone || '-')}</td></tr>
          <tr><td><strong>Gruppengrösse</strong></td><td>${escapeHtml(booking.groupSize)}</td></tr>
          <tr><td><strong>Schulklasse</strong></td><td>${booking.isSchoolClass ? 'Ja' : 'Nein'}</td></tr>
          <tr><td><strong>Notiz</strong></td><td>${escapeHtml(booking.note || '-')}</td></tr>
        </table>
        <p><a href="${publicUrl('/admin')}">Zur Verwaltung öffnen</a></p>
        <p>Kontakt: Susanne Egloff,
        <a href="mailto:susanne.egloff@kirche-wm.ch">susanne.egloff@kirche-wm.ch</a>,
        <a href="tel:0523191273">052 319 12 73</a>.</p>
      `,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error('[mailer] Fehler beim Senden der Kirchen-Benachrichtigung:', err.message);
  }
}

// Sendet dem Besucher eine Bestätigung seiner Reservation.
export async function sendVisitorConfirmation(booking, tour) {
  const { RESEND_API_KEY, MAIL_FROM, MAIL_REPLY_TO } = process.env;
  if (!RESEND_API_KEY) {
    console.warn('[mailer] RESEND_API_KEY nicht gesetzt - überspringe Bestätigungsmail an Besucher.');
    return;
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: MAIL_FROM || DEFAULT_MAIL_FROM,
      to: booking.email,
      ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
      subject: 'Deine Reservation für den Osterweg Wyland',
      html: `
        <h2>Vielen Dank für deine Reservation, ${escapeHtml(booking.name)}!</h2>
        <p>Wir haben deine Anmeldung für den Osterweg Wyland erhalten:</p>
        <table cellpadding="6" style="border-collapse: collapse;">
          <tr><td><strong>Datum</strong></td><td>${escapeHtml(formatDate(tour.date))}</td></tr>
          <tr><td><strong>Uhrzeit</strong></td><td>${escapeHtml(tour.time)} Uhr</td></tr>
          <tr><td><strong>Gruppengrösse</strong></td><td>${escapeHtml(booking.groupSize)}</td></tr>
        </table>
        <p>Wir freuen uns auf euren Besuch!</p>
        <p>Bei Fragen, Anliegen, Änderungen deiner Reservation oder Anmeldungen von Schulklassen
        wende dich bitte an <strong>Susanne Egloff</strong> im Sekretariat:</p>
        <p>E-Mail: <a href="mailto:susanne.egloff@kirche-wm.ch">susanne.egloff@kirche-wm.ch</a><br>
        Telefon: <a href="tel:0523191273">052 319 12 73</a></p>
        <p>Weitere Informationen findest du auf <a href="${publicUrl('/')}">unserer Webseite</a>.</p>
        ${MAIL_REPLY_TO
          ? '<p>Du kannst dich auch per Antwort auf diese E-Mail an die hinterlegte Kontaktadresse wenden.</p>'
          : '<p>Bitte antworte nicht auf diese automatisch versendete E-Mail. Nutze für dein Anliegen die oben angegebenen Kontaktdaten von Susanne Egloff.</p>'}
      `,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error('[mailer] Fehler beim Senden der Besucher-Bestätigung:', err.message);
  }
}
