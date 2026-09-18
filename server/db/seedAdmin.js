// ============================================================================
// Legt einen Admin-Benutzer an (oder aktualisiert das Passwort, falls der
// Benutzername bereits existiert).
// Ausführen mit:  node server/db/seedAdmin.js <benutzername> <passwort>
// Beispiel:        node server/db/seedAdmin.js susanne "einSicheresPasswort"
// ============================================================================
import bcrypt from 'bcryptjs';
import { db } from './database.js';

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error('Verwendung: node server/db/seedAdmin.js <benutzername> <passwort>');
  process.exit(1);
}

const passwordHash = bcrypt.hashSync(password, 10);

const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);

if (existing) {
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(
    passwordHash,
    username
  );
  console.log(`Passwort für Admin-Benutzer "${username}" wurde aktualisiert.`);
} else {
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(
    username,
    passwordHash
  );
  console.log(`Admin-Benutzer "${username}" wurde angelegt.`);
}
