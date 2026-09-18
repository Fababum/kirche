import jwt from 'jsonwebtoken';

const DEV_FALLBACK_SECRET = 'dev-secret-change-me-in-production';
const isProduction = process.env.NODE_ENV === 'production';

// Sicherheitscheck: In Produktion MUSS ein eigenes, starkes JWT_SECRET gesetzt
// sein. Damit niemand versehentlich mit dem unsicheren Standardwert live
// geht, bricht der Server den Start ab, falls das nicht der Fall ist.
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_FALLBACK_SECRET)) {
  console.error(
    'FEHLER: In Produktion muss die Umgebungsvariable JWT_SECRET gesetzt sein ' +
      '(ein langer, zufälliger Wert, z.B. erzeugt mit "openssl rand -hex 32"). ' +
      'Server wird aus Sicherheitsgründen nicht gestartet.'
  );
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
export const COOKIE_NAME = 'osterweg_admin_token';

export function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Sitzung ungültig oder abgelaufen.' });
  }
}
