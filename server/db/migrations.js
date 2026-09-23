// Additive migration: existing confirmed reservations and their counts stay intact.
export function migrateVerification(db) {
  db.transaction(() => {
    const columns = db.pragma('table_info(bookings)').map((column) => column.name);
    if (!columns.includes('verification_token_hash')) {
      db.exec('ALTER TABLE bookings ADD COLUMN verification_token_hash TEXT');
    }
    if (!columns.includes('verification_expires_at')) {
      db.exec('ALTER TABLE bookings ADD COLUMN verification_expires_at INTEGER');
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_verification_token
        ON bookings(verification_token_hash);
      CREATE INDEX IF NOT EXISTS idx_bookings_pending_expiry
        ON bookings(verification_expires_at) WHERE status = 'pending';
    `);
  }).immediate();
}
