// ============================================================================
// Wird beim Serverstart einmalig ausgeführt:
// 1. Legt fehlende Führungs-Slots an (idempotent, überschreibt nichts).
// 2. Legt einen Admin-Benutzer an, falls noch keiner existiert UND die
//    Umgebungsvariablen ADMIN_USERNAME / ADMIN_PASSWORD gesetzt sind.
//    Praktisch für den ersten Start eines Docker-Containers.
// ============================================================================
import bcrypt from 'bcryptjs';
import { db } from './database.js';
import { seedTours } from './seedLogic.js';

export function runStartupSetup() {
  const createdTours = seedTours();
  if (createdTours > 0) {
    console.log(`Startup-Seed: ${createdTours} neue Führungs-Slots angelegt.`);
  }

  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin_users').get().c;
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

  if (adminCount === 0 && ADMIN_USERNAME && ADMIN_PASSWORD) {
    const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(
      ADMIN_USERNAME,
      passwordHash
    );
    console.log(`Startup-Seed: Admin-Benutzer "${ADMIN_USERNAME}" wurde angelegt.`);
    console.warn(
      'Sicherheitshinweis: Das Passwort ist jetzt sicher (bcrypt-Hash) in der ' +
        'Datenbank gespeichert. Bitte entferne jetzt ADMIN_USERNAME/ADMIN_PASSWORD ' +
        'aus den Fly-Secrets bzw. der .env-Datei - sie werden nicht mehr benötigt ' +
        'und sollten nicht dauerhaft als Klartext irgendwo liegen:\n' +
        '  fly secrets unset ADMIN_USERNAME ADMIN_PASSWORD'
    );
  } else if (adminCount === 0) {
    console.warn(
      'Hinweis: Es existiert noch kein Admin-Benutzer. Lege einen an mit:\n' +
        '  docker compose exec app node server/db/seedAdmin.js <benutzername> <passwort>\n' +
        'oder setze beim ersten Start ADMIN_USERNAME und ADMIN_PASSWORD als Umgebungsvariablen.'
    );
  } else if (ADMIN_USERNAME || ADMIN_PASSWORD) {
    // Ein Admin existiert bereits, aber die Secrets sind immer noch gesetzt -
    // das ist unnötig und sollte aus Sicherheitsgründen bereinigt werden.
    console.warn(
      'Sicherheitshinweis: ADMIN_USERNAME/ADMIN_PASSWORD sind noch als Umgebungsvariable ' +
        'gesetzt, obwohl bereits ein Admin-Benutzer existiert. Diese werden nicht mehr ' +
        'gebraucht - bitte entfernen, um kein Klartext-Passwort dauerhaft liegen zu haben:\n' +
        '  fly secrets unset ADMIN_USERNAME ADMIN_PASSWORD'
    );
  }
}
