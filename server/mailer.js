// ============================================================================
// E-Mail-Versand über Resend (https://resend.com).
// Die Verifikationsmail ist zwingend. Erst nach E-Mail-Bestätigung folgen
// Besucher-Bestätigung und Kirchen-Benachrichtigung (best effort).
// ============================================================================
import { Resend } from 'resend';
import { renderMail } from './mailTemplate.js';

const DEFAULT_MAIL_FROM = 'Osterweg Wyland <noreply@osterweg-wyland.com>';

function publicUrl(path) {
  const url = new URL(path, process.env.PUBLIC_URL || 'https://osterweg-wyland.com');
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('PUBLIC_URL muss eine HTTP(S)-URL sein.');
  }
  return url.href;
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

function reservationDetails(booking, tour) {
  return [
    ['Datum', formatDate(tour.date)],
    ['Uhrzeit', `${tour.time} Uhr`],
    ['Personen', booking.groupSize],
    // Verified in src/data/content.js; frontend sources are not shipped with the server.
    ['Ort', 'Reformierte Kirche, Hauptstrasse, 8467 Truttikon'],
  ];
}

export async function sendVisitorVerification(booking, tour, token, expiresAt) {
  const { RESEND_API_KEY, MAIL_FROM, MAIL_REPLY_TO } = process.env;
  if (!RESEND_API_KEY?.trim()) {
    const error = new Error('Verifikationsmail ist nicht konfiguriert.');
    error.code = 'MAIL_NOT_CONFIGURED';
    throw error;
  }

  const deadline = expiresAt === undefined ? null : new Intl.DateTimeFormat('de-CH', {
    timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(expiresAt);
  const resend = new Resend(RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: MAIL_FROM || DEFAULT_MAIL_FROM,
    to: booking.email,
    ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
    subject: 'Bitte bestätige deine E-Mail-Adresse für den Osterweg Wyland',
    ...renderMail({
      title: 'Bitte bestätige deine E-Mail-Adresse',
      preheader: deadline
        ? `Deine Reservation ist noch offen. Bitte bestätige sie bis ${deadline} Uhr (Schweizer Zeit).`
        : 'Deine Reservation ist noch offen. Bitte bestätige sie innerhalb von 30 Minuten ab der Anmeldung.',
      greeting: `Hallo ${booking.name}`,
      paragraphs: [
        'Deine Reservation ist noch nicht bestätigt. Wir halten deine Plätze ab der Anmeldung für 30 Minuten frei.',
        ...(deadline ? [`Bitte bestätige bis ${deadline} Uhr (Schweizer Zeit). Auch bei erneutem Versand bleibt diese ursprüngliche Frist unverändert.`] : []),
        'Öffne die Bestätigungsseite und bestätige dort deine E-Mail-Adresse und Reservation. Das Öffnen des Links allein bestätigt noch nichts.',
        'Nur wenn du deine Reservation nicht innerhalb von 30 Minuten ab der Anmeldung bestätigst, verfällt sie und die Plätze werden automatisch wieder freigegeben. Bereits bestätigte Reservationen bleiben bestehen.',
      ],
      details: reservationDetails(booking, tour),
      action: { label: 'Zur Bestätigungsseite', url: publicUrl(`/reservation/bestaetigen#token=${token}`) },
      closing: ['Falls du keine Reservation angefragt hast, ignoriere diese E-Mail. Ohne Bestätigung wird keine Reservation abgeschlossen.'],
      replyTo: MAIL_REPLY_TO,
      logoUrl: publicUrl('/images/logo.png'),
    }),
  });
  // Do not propagate provider diagnostics: they can contain the secret mail link.
  if (error || !data?.id) {
    const failure = new Error('Verifikationsmail wurde nicht angenommen.');
    failure.code = 'MAIL_REJECTED';
    // Only log a numeric provider status, never its message, token or recipient.
    if (Number.isInteger(error?.statusCode)) failure.providerStatus = error.statusCode;
    throw failure;
  }
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

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: MAIL_FROM || DEFAULT_MAIL_FROM,
      to: NOTIFY_EMAIL?.trim() || 'sekretariat@kirche-wm.ch',
      ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
      subject: `Neue Reservation: ${booking.name} (${formatDate(tour.date)})`,
      ...renderMail({
        title: 'Neue bestätigte Reservation',
        preheader: `Bestätigte Reservation: ${booking.groupSize} Personen am ${formatDate(tour.date)}, ${tour.time} Uhr.`,
        greeting: 'Liebes Osterweg-Team',
        paragraphs: ['Die E-Mail-Adresse wurde bestätigt. Die folgende Reservation ist verbindlich bestätigt und die Plätze sind reserviert.'],
        details: [
          ...reservationDetails(booking, tour),
          ['Name', booking.name],
          ['E-Mail', booking.email],
          ['Telefon', booking.phone || '-'],
          ['Schulklasse', booking.isSchoolClass ? 'Ja' : 'Nein'],
          ['Notiz', booking.note || '-'],
        ],
        action: { label: 'Reservationen verwalten', url: publicUrl('/admin') },
        replyTo: MAIL_REPLY_TO,
        logoUrl: publicUrl('/images/logo.png'),
      }),
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
      ...renderMail({
        title: 'Deine Reservation ist bestätigt',
        preheader: `Deine Plätze sind reserviert: ${formatDate(tour.date)}, ${tour.time} Uhr.`,
        greeting: `Hallo ${booking.name}`,
        paragraphs: ['Vielen Dank für deine Reservation für den Osterweg Wyland. Deine E-Mail-Adresse ist bestätigt und deine Plätze sind fest reserviert. Du musst nichts weiter bestätigen.'],
        details: reservationDetails(booking, tour),
        action: { label: 'Informationen zum Besuch', url: publicUrl('/') },
        closing: ['Wir freuen uns auf euren Besuch!'],
        replyTo: MAIL_REPLY_TO,
        logoUrl: publicUrl('/images/logo.png'),
      }),
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error('[mailer] Fehler beim Senden der Besucher-Bestätigung:', err.message);
  }
}
