// ============================================================================
// Express-Server für die Osterweg-Wyland Buchungsplattform.
// Start:  node server/index.js   (oder npm run server)
// ============================================================================
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { runStartupSetup } from './db/startup.js';

dotenv.config();

runStartupSetup();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
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
  })
);
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
// Komprimiert Antworten (gzip) - spart Bandbreite/Egress-Kosten, vor allem
// beim Ausliefern des Frontend-Bundles.
app.use(compression());
app.use(express.json());
app.use(cookieParser());

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
