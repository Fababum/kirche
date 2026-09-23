// ============================================================================
// Express-Server für die Osterweg-Wyland Buchungsplattform.
// Start:  node server/index.js   (oder npm run server)
// ============================================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { runStartupSetup } from './db/startup.js';
import { expirePendingBookings } from './bookings.js';

runStartupSetup();
expirePendingBookings();
setInterval(() => {
  try {
    expirePendingBookings();
  } catch {
    console.error('[bookings] Abgelaufene Reservationen konnten nicht bereinigt werden.');
  }
}, 60 * 1000).unref();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4001;
// Erlaubt mehrere gültige Domains, z.B. mit/ohne "www." und die alte
// *.fly.dev-Adresse als Fallback - einfach kommagetrennt in der Env-Variable
// angeben (siehe fly.toml).
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
// Im Docker-Image liegt das fertige Frontend-Build unter /app/dist.
const STATIC_DIR = path.join(__dirname, '..', 'dist');
const serveFrontend = fs.existsSync(STATIC_DIR);

app.use(
  helmet({
    // Das Frontend wird von diesem selben Server ausgeliefert (statisches
    // Build), daher CSP hier bewusst nicht zu streng setzen, um bestehende
    // Inline-Styles/Skripte des Vite-Builds nicht zu blockieren.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    // Helmet setzt standardmässig "no-referrer" - das blockiert aber auch
    // legitime Drittanbieter-Anfragen wie die Kartenkacheln (MapTiler prüft
    // den Referrer, um den API-Key domain-beschränkt zu validieren). Mit
    // "strict-origin-when-cross-origin" (dem normalen Browser-Standard)
    // wird bei fremden Domains nur die eigene Herkunft (Domain, kein
    // Pfad/Query) übermittelt - guter Kompromiss aus Datenschutz und
    // Funktionalität.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      // Anfragen ohne Origin-Header (z.B. curl, Server-zu-Server) erlauben.
      if (!origin || CLIENT_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Nicht erlaubte Herkunft (CORS): ' + origin));
      }
    },
    credentials: true,
  })
);
// Komprimiert Antworten (gzip) - spart Bandbreite/Egress-Kosten, vor allem
// beim Ausliefern des Frontend-Bundles.
app.use(compression());
app.use(express.json());
app.use(cookieParser());

// Grober Schutz vor Bots/Scrapern, die wiederholt Seiten oder Bilder abrufen
// und so unnötig Bandbreite (= Kosten) verursachen könnten. Grosszügig genug
// bemessen, um echte Besucher:innen nie zu beeinträchtigen (Buchungs- und
// Login-Formulare haben zusätzlich eigene, strengere Rate-Limits).
const globalRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.' },
});
app.use(globalRateLimiter);

// Suchmaschinen sollen API und Admin-Bereich nicht crawlen/indexieren
// (spart unnötigen Traffic und verhindert Indexierung sensibler Bereiche).
app.use(['/api', '/admin'], (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Wenn ein Frontend-Build vorhanden ist (z.B. im Docker-Container), liefert
// derselbe Server auch die Webseite aus - dann reicht ein einzelner Container.
if (serveFrontend) {
  app.use(express.static(STATIC_DIR));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
}

const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Osterweg-Server läuft auf http://${HOST}:${PORT}`);
  if (serveFrontend) {
    console.log('Frontend-Build gefunden - wird mit ausgeliefert.');
  }
});
