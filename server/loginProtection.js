// ============================================================================
// Einfacher Schutz gegen Brute-Force-Angriffe auf den Admin-Login.
// Zählt fehlgeschlagene Login-Versuche pro (IP + Benutzername) und sperrt
// nach zu vielen Fehlversuchen vorübergehend weitere Versuche.
//
// Hinweis: Dies ist ein In-Memory-Speicher. Bei einem Neustart des Servers
// werden die Zähler zurückgesetzt - für eine kleine Webseite mit einer
// Server-Instanz ausreichend und bewusst einfach gehalten.
// ============================================================================

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 Minuten Sperre

const attempts = new Map(); // key -> { count, firstAttempt, lockedUntil }

function keyFor(req, username) {
  return `${req.ip}:${(username || '').toLowerCase()}`;
}

export function isLockedOut(req, username) {
  const entry = attempts.get(keyFor(req, username));
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
    return true;
  }
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
    attempts.delete(keyFor(req, username));
  }
  return false;
}

export function recordFailedAttempt(req, username) {
  const key = keyFor(req, username);
  const entry = attempts.get(key) || { count: 0, firstAttempt: Date.now() };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  attempts.set(key, entry);
}

export function clearAttempts(req, username) {
  attempts.delete(keyFor(req, username));
}

export function getLockoutMinutesRemaining(req, username) {
  const entry = attempts.get(keyFor(req, username));
  if (!entry || !entry.lockedUntil) return 0;
  return Math.max(0, Math.ceil((entry.lockedUntil - Date.now()) / 60000));
}
