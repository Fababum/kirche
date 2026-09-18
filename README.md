# Osterweg Wyland - Webseite & Buchungssystem

Webseite für den Osterweg Wyland (17.-28. März 2027, Truttikon) mit
Online-Reservation für Führungen und einem Admin-Bereich zur Verwaltung von
Zeitslots und Reservationen.

- **Frontend:** React + Vite (`src/`)
- **Backend:** Node.js/Express + SQLite (`server/`)
- **Inhalte/Texte:** zentral editierbar in `src/data/content.js`

## Inhalte anpassen

Alle Texte, Kontaktpersonen, Öffnungszeiten etc. befinden sich in
`src/data/content.js`. Diese Datei kann angepasst werden, ohne den restlichen
Code zu verändern. Stellen mit `[TODO: ...]` markieren unvollständige Angaben
aus der Vorlage, die noch ergänzt werden sollten.

---

## Option A: Lokale Entwicklung (ohne Docker)

Voraussetzung: Node.js ≥ 20

```bash
npm install

# Datenbank mit Führungs-Slots (13.-28. März 2027) befüllen
npm run server:seed

# Admin-Zugang anlegen
npm run server:seed-admin -- admin "einSicheresPasswort"

# Backend starten (Terminal 1)
npm run server

# Frontend-Dev-Server starten (Terminal 2)
npm run dev
```

Die Webseite läuft dann unter `http://localhost:5173`, das Backend unter
`http://localhost:4001`. Der Vite-Dev-Server leitet `/api`-Anfragen automatisch
ans Backend weiter (siehe `vite.config.js`).

Admin-Bereich: `http://localhost:5173/admin`

---

## Option B: Gratis im Internet veröffentlichen (Fly.io) - empfohlen

[Fly.io](https://fly.io) bietet ein kostenloses Kontingent, das für diese
Webseite ausreicht, UND bietet (im Gegensatz zu vielen anderen Gratis-Hostern)
**persistenten Speicher** - die Reservationen gehen also bei einem Update
nicht verloren.

### Einmaliges Setup

1. **flyctl installieren** (Kommandozeilen-Werkzeug von Fly.io):
   - Mac/Linux: `curl -L https://fly.io/install.sh | sh`
   - Windows: `pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"`
   - Details: https://fly.io/docs/flyctl/install/

2. **Account erstellen & einloggen** (Kreditkarte wird zur Verifizierung
   verlangt, aber im Rahmen des Gratis-Kontingents fällt nichts an):
   ```bash
   fly auth login
   ```

3. **App-Namen anpassen:** In `fly.toml` steht `app = 'osterweg-wyland'` -
   dieser Name muss weltweit eindeutig sein. Falls er schon vergeben ist,
   einfach umbenennen (z.B. `osterweg-wyland-truttikon`).

4. **Datenbank-Volume anlegen** (einmalig, WICHTIG - sonst gehen Daten bei
   jedem Neustart verloren):
   ```bash
   fly volumes create osterweg_data --size 1 --region fra
   ```

5. **Geheime Werte setzen:**
   ```bash
   fly secrets set JWT_SECRET=$(openssl rand -hex 32)
   fly secrets set ADMIN_USERNAME=admin ADMIN_PASSWORD="ein-sicheres-passwort"
   ```

5b. **E-Mail-Benachrichtigungen einrichten (empfohlen)** - die Kirche erhält
    dann bei jeder neuen Reservation automatisch eine E-Mail, und Besucher
    bekommen eine Buchungsbestätigung. Ohne diesen Schritt funktioniert die
    Seite trotzdem, nur ohne Benachrichtigungen.

    1. Kostenlosen Account auf https://resend.com erstellen (100 Mails/Tag
       gratis, reicht für diese Seite problemlos).
    2. Entweder eine eigene Domain unter "Domains" verifizieren (empfohlen,
       falls verfügbar), oder vorerst mit der Test-Absenderadresse
       `onboarding@resend.dev` starten.
    3. Unter "API Keys" einen neuen Key erzeugen.
    4. Als Fly-Secrets setzen:
       ```bash
       fly secrets set RESEND_API_KEY="re_dein_api_key"
       fly secrets set NOTIFY_EMAIL="info@kirche-wm.ch"
       fly secrets set MAIL_FROM="Osterweg Wyland <onboarding@resend.dev>"
       ```
       (`MAIL_FROM` ggf. anpassen, sobald eine eigene Domain verifiziert ist,
       z.B. `Osterweg Wyland <info@eure-domain.ch>`.)

6. **Veröffentlichen:**
   ```bash
   fly deploy
   ```

Nach ein paar Minuten ist die Seite unter `https://<app-name>.fly.dev`
erreichbar (automatisches HTTPS inklusive). Der Admin-Bereich unter
`https://<app-name>.fly.dev/admin`.

### Wichtig: Admin-Secrets nach dem ersten Login wieder entfernen

`ADMIN_USERNAME`/`ADMIN_PASSWORD` werden nur benötigt, um beim allerersten
Start automatisch einen Admin-Zugang anzulegen. Das Passwort wird dabei sofort
als bcrypt-Hash in der Datenbank gespeichert - danach werden die beiden
Secrets nicht mehr gebraucht und sollten aus Sicherheitsgründen wieder entfernt
werden, damit das Passwort nicht dauerhaft im Klartext bei Fly als Secret
herumliegt:

```bash
fly secrets unset ADMIN_USERNAME ADMIN_PASSWORD
```

(Der Server prüft das bei jedem Start und gibt in den Logs eine Warnung aus,
falls diese Variablen trotz bereits vorhandenem Admin noch gesetzt sind.)

Willst du später das Passwort ändern oder einen weiteren Admin anlegen, geht
das jederzeit über:
```bash
fly ssh console -C "node server/db/seedAdmin.js <benutzername> <passwort>"
```

Falls der App-Name in Schritt 3 angepasst wurde, muss zusätzlich `CLIENT_ORIGIN`
in `fly.toml` unter `[env]` auf die tatsächliche Adresse (`https://<app-name>.fly.dev`
oder die eigene Domain) angepasst werden - das ist wichtig, damit CORS korrekt
funktioniert und die Links in den Benachrichtigungsmails stimmen.

### Updates veröffentlichen

Nach jeder Code-Änderung reicht:
```bash
fly deploy
```

### Eigene Domain verbinden (optional)

```bash
fly certs add www.eure-domain.ch
```
Fly zeigt danach an, welchen DNS-Eintrag ihr beim Domain-Anbieter setzen
müsst (meist ein CNAME-Eintrag).

### Kosten

Diese Konfiguration (`shared-cpu-1x`, 256mb, 1GB Volume) bewegt sich im
Rahmen des kostenlosen Kontingents von Fly.io oder nur knapp darüber
(typischerweise wenige Franken/Dollar pro Monat, hauptsächlich für das
persistente Datenvolume). Es lohnt sich, gelegentlich unter
https://fly.io/dashboard die Rechnung/Nutzung zu prüfen.

### Admin-Bereich: Reservationen verwalten

Im Tab "Reservationen" (`/admin`) sieht die Kirche alle Buchungen:

- Neue Reservationen der letzten 24 Stunden werden mit einem "Neu"-Badge
  markiert, zusätzlich zeigt der Tab-Titel die Anzahl neuer Reservationen an.
- Die Liste aktualisiert sich automatisch alle 30 Sekunden, zusätzlich gibt
  es einen manuellen "Aktualisieren"-Button.
- Über "Als Excel herunterladen" lässt sich die aktuelle Liste als `.xlsx`-Datei
  herunterladen (öffnet direkt in Excel/LibreOffice/Numbers, z.B. zum
  Ausdrucken oder Weiterverarbeiten).
- Zusätzlich erhält die hinterlegte `NOTIFY_EMAIL`-Adresse bei jeder neuen
  Reservation automatisch eine E-Mail-Benachrichtigung (siehe Setup-Schritt
  5b weiter oben) - die Kirche muss also nicht aktiv auf der Seite
  nachschauen.

---

## Option C: Mit Docker auf einem eigenen Server (falls kein Fly.io gewünscht)

Ein einzelner Container liefert sowohl die fertige Webseite als auch die
Buchungs-API aus. Die SQLite-Datenbank wird in einem Docker-Volume gespeichert,
damit Reservationen einen Neustart/Update überleben.

### 1. Konfiguration vorbereiten

```bash
cp .env.example .env
```

`.env` öffnen und anpassen:

- `APP_PORT` - Port, unter dem die Seite erreichbar sein soll (Standard: 4001)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` - wird **nur beim allerersten Start**
  verwendet, um automatisch einen Admin-Zugang anzulegen
- `JWT_SECRET` - unbedingt durch einen zufälligen Wert ersetzen, z.B. mit
  `openssl rand -hex 32`

### 2. Bauen & starten

```bash
docker compose up -d --build
```

Die Seite ist danach unter `http://localhost:<APP_PORT>` erreichbar, der
Admin-Bereich unter `http://localhost:<APP_PORT>/admin`.

### 3. Weitere Admin-Zugänge anlegen (optional)

```bash
docker compose exec app node server/db/seedAdmin.js <benutzername> <passwort>
```

### Nützliche Befehle

```bash
docker compose logs -f       # Logs ansehen
docker compose restart       # Neustarten
docker compose down          # Stoppen (Daten bleiben im Volume erhalten)
docker compose down -v       # Stoppen UND alle Daten löschen (Vorsicht!)
```

### Deployment auf einem Server

Da alles in einem Container läuft, reicht auf dem Zielserver:

1. Docker + Docker Compose installieren
2. Projekt-Ordner auf den Server kopieren (oder per Git klonen)
3. `.env` mit produktiven Werten anlegen
4. `docker compose up -d --build`
5. Optional: einen Reverse-Proxy (z.B. Caddy oder nginx) mit HTTPS davor
   schalten, der auf den in `.env` gewählten Port weiterleitet.

---

## Projektstruktur

```
src/               React-Frontend
  components/       UI-Bausteine (Header, Hero, Booking, Admin, ...)
  data/content.js    Alle Texte & Kontaktdaten
  pages/             Admin-Seite
  api.js             Fetch-Wrapper fürs Backend

server/            Node.js/Express-Backend
  db/database.js     SQLite-Setup
  db/seedLogic.js     Logik zum Anlegen der Führungs-Slots
  db/seed.js          CLI-Skript zum manuellen Seeden
  db/seedAdmin.js      CLI-Skript zum Anlegen/Ändern eines Admin-Zugangs
  db/startup.js        Automatisches Seeding beim Serverstart
  routes/public.js    Öffentliche API (Slots ansehen, reservieren)
  routes/admin.js     Geschützte Admin-API (Login, Slots/Reservationen verwalten)
  mailer.js           E-Mail-Benachrichtigungen (Resend) bei neuen Reservationen
  index.js            Express-Server (liefert im Produktions-Build auch das Frontend aus)

Dockerfile          Multi-Stage-Build (Frontend bauen + schlankes Laufzeit-Image)
docker-compose.yml  Container-Orchestrierung inkl. Datenvolume
fly.toml            Konfiguration für das Deployment auf Fly.io
```
