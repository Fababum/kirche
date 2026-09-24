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

# Datenbank einmalig mit Führungs-Slots (17.-28. März 2027) initialisieren
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

### Verbindliche Buchungsregeln

- Regulärer Veranstaltungszeitraum: 17.-28. März 2027. Die gemeinsamen Werte
  stehen in `shared/event.js`.
- Öffentliche Führungen: 18.-21. und 25.-28. März, jeweils um 14:00, 15:00,
  16:00 und 17:00 Uhr, mit je 15 Plätzen. Der 17. März bleibt sichtbar, ist
  aber für Schulklassen reserviert: vier Slots mit Kapazität 0, ohne künstliche
  Reservationen. Der Titel bleibt "17.-28. März 2027".
- Einzelanmeldungen sind möglich. Die Mindestzahl von fünf Personen gilt für
  die gesamte Führung; es gibt keine automatische Absage bei Unterschreitung.
  Das Sekretariat prüft die Teilnehmerzahl und kontaktiert Betroffene bei Bedarf.
- Neue Reservationen schliessen exakt 48 Stunden vor dem Führungsbeginn in
  Schweizer Zeit. Auch die Zeitumstellung am 28. März wird berücksichtigt.
- Bereits angefragte Reservationen behalten ihre volle Bestätigungsfrist von
  30 Minuten, auch wenn inzwischen der Anmeldeschluss erreicht wurde.
- Die Standardtermine werden nur einmal initialisiert. Serverneustarts und
  erneutes `server:seed` stellen bewusst gelöschte Termine nicht wieder her.
- Vorhandene Datenbanken werden unverändert übernommen. Insbesondere bleiben
  Termine und Reservationen vor dem 17. März im Admin erhalten, sind aber nicht
  mehr öffentlich neu buchbar. Diese Alttermine vor der Live-Schaltung prüfen
  und betroffene Gäste gegebenenfalls persönlich kontaktieren.

### Terminplan ausdrücklich zurücksetzen

Nur nach ausdrücklicher Freigabe: Der folgende Wartungsbefehl löscht **alle
Führungen, Reservationen und Bestätigungs-/Versandtokens** der angegebenen
Datenbank und legt den aktuellen Standardplan neu an. Admin-Zugänge bleiben
erhalten. Die Änderung erfolgt in einer Transaktion; es werden keine Absagemails
verschickt. Der normale Serverstart führt diese Löschung niemals aus.

```bash
node server/db/resetTours.js --db /data/data.db --confirm-delete-all-tours-and-bookings
```

Der Pfad muss absolut sein und auf eine bestehende Datenbank zeigen. Für Fly
den Befehl im App-Container ausführen, nicht gegen die lokale Datenbank.
- Tests ohne echte Buchungen oder Mailversand: `node --test server/*.test.js`.

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

5b. **E-Mail-Versand einrichten (erforderlich)** - eine neue Reservation hält
    Plätze für 30 Minuten vorläufig frei und sendet zuerst eine Verifikationsmail
    über Resend. Erst nach ausdrücklicher Bestätigung der E-Mail-Adresse wird
    die Reservation verbindlich. Ohne `RESEND_API_KEY` oder bei einem Fehler
    des Verifikationsversands antwortet die API mit `503`, storniert die
    vorläufige Reservation und gibt die Plätze wieder frei.

    Die Domain `osterweg-wyland.com` ist laut bereitgestelltem Screenshot bei
    Resend verifiziert. Standard-Absender in Code, Docker und `fly.toml` ist
    `Osterweg Wyland <noreply@osterweg-wyland.com>` (`MAIL_FROM`).
    Die Domain-Verifizierung allein bestätigt keine Mailzustellung.

    Für Fly wird `RESEND_API_KEY` als Secret benötigt. Benachrichtigungen über
    verbindlich bestätigte Reservationen gehen standardmässig an
    `sekretariat@kirche-wm.ch`. `NOTIFY_EMAIL` überschreibt diesen Empfänger.
    Die optionale Antwortadresse `MAIL_REPLY_TO` nur nach Bestätigung setzen:

    ```bash
    fly secrets set RESEND_API_KEY="<RESEND_API_KEY>"
    fly secrets set NOTIFY_EMAIL="sekretariat@kirche-wm.ch"
    # Optional, nur für eine bestätigte und betreute Antwortadresse:
    fly secrets set MAIL_REPLY_TO="<BESTAETIGTE_ANTWORTADRESSE>"
    ```

    Ohne oder mit leerem `NOTIFY_EMAIL` wird das Sekretariat benachrichtigt. Ohne
    `MAIL_REPLY_TO` wird kein Reply-To gesetzt; die Besucher-Bestätigung verweist
    für Fragen, Änderungen und Schulklassen direkt auf das Sekretariat Rheinau
    (`sekretariat@kirche-wm.ch`, `052 319 12 73`), statt Antworten auf
    die Noreply-Adresse zu empfehlen. Mit `MAIL_REPLY_TO` wird diese Adresse als
    Reply-To für alle Mails verwendet. Auch die Verifikationsmail enthält
    die Kontaktdaten des Sekretariats Rheinau.

    `PUBLIC_URL` ist die einzelne öffentliche HTTP(S)-Basis-URL für Mail-Links
    (Standard: `https://osterweg-wyland.com`), unabhängig von der
    kommagetrennten CORS-Liste `CLIENT_ORIGIN`. Der Verwaltungslink führt zu
    `/admin`. Lokal oder bei einer anderen Domain `PUBLIC_URL` entsprechend
    setzen. Für lokale Entwicklung und Docker stehen die Variablen in
    `.env.example`; Docker Compose reicht sie an den Server weiter.

    Nach erfolgreicher Verifikation werden einmalig die abschliessende
    Besucher-Bestätigung und die Kirchen-Benachrichtigung versucht. Fehler
    dieser beiden Mails werden protokolliert, machen die bestätigte Reservation
    aber nicht rückgängig. Wiederholtes Bestätigen versendet keine weiteren
    Mails. Es gibt keine automatische Wiederholung fehlgeschlagener finaler
    Mails und keine Zustellstatus-Anzeige im Admin-Bereich; ein Provider-Erfolg
    bedeutet Annahme zum Versand, nicht garantierte Zustellung.

    Isolierte Backend-Tests mit In-Memory-Datenbanken und gemocktem Mailversand
    (keine `.env`, keine Workspace-Datenbank, keine echten Mails, kein Start
    der Anwendung; API-Tests nutzen nur einen lokalen Test-HTTP-Server):

    ```bash
    node --test server/*.test.js
    npm run lint
    ```

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
funktioniert. Für die Links in Benachrichtigungsmails separat `PUBLIC_URL`
auf die einzelne öffentliche Basis-URL setzen.

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

Unter `/admin` sieht das Sekretariat die Führungen mit ihren Reservationen:

- Eine Führung öffnen, um Namen und Kontaktdaten zu sehen. Die Suche unterstützt
  Namen, E-Mail, Telefon und Datum. Für stornierte Führungen den Filter "Alle" wählen.
- Neue Reservationen der letzten 24 Stunden werden markiert; das bedeutet nicht
  "ungelesen". Kennzahlen unterscheiden Reservationen und reservierte Personen.
- Platzanzahl nur über "Speichern" ändern. Stornieren erfordert eine Bestätigung;
  Gäste müssen selbst informiert werden, es gibt keine automatische Absage-Mail.
- Die aufklappbare Kurzhilfe erklärt diese Abläufe direkt in der Verwaltung.
- Die Liste aktualisiert sich automatisch alle 30 Sekunden, zusätzlich gibt
  es einen manuellen "Aktualisieren"-Button.
- Über "Als Excel herunterladen" lassen sich alle Reservationen der angezeigten
  Führungen (einschliesslich stornierter Reservationen) als `.xlsx`-Datei
  herunterladen (öffnet direkt in Excel/LibreOffice/Numbers, z.B. zum
  Ausdrucken oder Weiterverarbeiten).
- Unter Datum und Uhrzeit kann mit "Diese Führung als Excel" die Reservationsliste
  einer einzelnen Führung mit Name, E-Mail, Telefon und Reservationsstatus exportiert werden.
  Das erste Tabellenblatt enthält dieselben Spalten wie der Gesamtexport;
  die Führungsübersicht steht im zweiten Tabellenblatt.
- Zusätzlich wird erst nach E-Mail-Bestätigung eine Benachrichtigung an
  `NOTIFY_EMAIL` versucht (siehe Setup-Schritt 5b). Der Admin-Bereich bleibt
  die verlässliche Übersicht der gespeicherten Reservationen, auch bei
  Mailfehlern.

### Backend-Vertrag: E-Mail-Bestätigung

- `POST /api/bookings` mit `{tourId, name, email, phone, groupSize, isSchoolClass,
  note}` reserviert atomar eine ganzzahlige Anzahl Plätze. Erst nachdem Resend
  die Verifikationsmail angenommen hat, folgt `201 {id, status: "pending",
  message}`. Bei fehlender Mailkonfiguration oder Versandfehler folgt `503`
  statt einer Erfolgsmeldung; die Reservation bleibt als `cancelled` erhalten.
- `phone` ist für neue Reservationen obligatorisch: ein nichtleerer String mit
  maximal 50 Zeichen nach Entfernen äusserer Leerzeichen. Ungültige Angaben liefern
  `400 {error}`. Bestehende Reservationen ohne Telefonnummer bleiben verwaltbar.
- Die Erstellungsantwort enthält zusätzlich `resendToken`, `retryAfter` (20 Sekunden)
  und `expiresAt` (ursprüngliche Bestätigungsfrist als Unix-Zeit in Millisekunden).
  Auf der Seite nach der Anmeldung ist nach 20 Sekunden "E-Mail erneut senden" verfügbar.
  `POST /api/bookings/resend-verification` mit `{resendToken}` sendet ausschliesslich
  an die gespeicherte Adresse, maximal dreimal zusätzlich und mit serverseitiger
  20-Sekunden-Sperre pro Versuch. Die Frist und belegten Plätze ändern sich nicht;
  bisherige Bestätigungslinks bleiben gültig, auch bei einem Versandfehler.
- Der Mail-Link lautet
  `${PUBLIC_URL}/reservation/bestaetigen#token=<hex>`. Der Token besteht aus
  32 kryptografisch zufälligen Bytes (`randomBytes`), hexadezimal codiert.
  Das Frontend liest das Fragment und sendet erst nach einer ausdrücklichen
  Benutzeraktion `POST /api/bookings/confirm` mit `{token}`. Ein GET oder das
  blosse Öffnen des Links bestätigt nichts.
- Erfolgreiche Bestätigung und Wiederholungen liefern `200 {status:
  "confirmed", message}`. Ungültige Tokens liefern `400`, abgelaufene
  Reservationen `410`, stornierte Reservationen/Führungen `409`, jeweils mit
  `{error}`. Bereits bestätigte Tokens bleiben auch nach der ursprünglichen
  Frist idempotent gültig, solange weder die Reservation noch die Führung
  storniert ist.
- Zustände: `pending`, `confirmed`, `cancelled`, `expired`.
  `tours.booked_count` und API-`bookedCount` umfassen vorläufig gehaltene plus
  bestätigte Plätze. `GET /api/admin/tours` liefert zusätzlich `pendingCount`
  als Personenzahl; bestätigte Plätze sind `bookedCount - pendingCount`.
- Dieselbe transaktionale Bereinigung läuft vor öffentlicher Verfügbarkeit,
  Erstellung, Bestätigung und Admin-Zählungen/Änderungen sowie beim Start und
  jede Minute. Sie setzt fällige `pending` auf `expired` und gibt Plätze genau
  einmal frei. Kapazität darf nur ganzzahlig und nicht kleiner als gehaltene
  plus bestätigte Plätze sein. Löschen ist bei `pending` oder `confirmed`
  blockiert. Stornieren einer einzelnen Reservation gibt aktive Plätze
  einmal frei; abgelaufene Reservationen werden nicht erneut abgezogen.
  Stornieren einer Führung setzt dagegen nur deren Sperrflag: Reservationen
  und belegte Plätze bleiben erhalten, neue Buchungen und Bestätigungen sind
  gesperrt. Ausstehende Bestätigungen verfallen weiterhin regulär nach 30
  Minuten. Reaktivieren vor Ablauf ermöglicht deren Bestätigung wieder;
  bereits bestätigte Reservationen bleiben unverändert.
- Additive SQLite-Migration beim Datenbankimport: nullable
  `bookings.verification_token_hash TEXT` (SHA-256, eindeutiger Index) und
  `bookings.verification_expires_at INTEGER` (Epoch-Millisekunden, Index für
  ausstehende Abläufe). Bestehende bestätigte Buchungen und Platzzahlen bleiben
  unverändert. Neue API-Buchungen setzen den Status ausdrücklich auf `pending`.
  Der Klartext-Token wird nicht gespeichert. Keine API-Antwort, auch nicht
  Admin-JSON, enthält Token oder Hash; die Ablaufzeit darf sichtbar sein.
- Die finalen Mailfunktionen werden nur beim atomaren Übergang zu `confirmed`
  aufgerufen. Es gibt keine persistente Mail-Warteschlange: Ein Prozessabbruch
  zwischen Bestätigung und Mailversand kann die finalen Mails verhindern;
  erneutes Bestätigen versendet sie bewusst nicht nochmals.

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
