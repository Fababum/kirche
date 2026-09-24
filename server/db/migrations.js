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
    if (!columns.includes('resend_token_hash')) {
      db.exec('ALTER TABLE bookings ADD COLUMN resend_token_hash TEXT');
    }
    if (!columns.includes('resend_available_at')) {
      db.exec('ALTER TABLE bookings ADD COLUMN resend_available_at INTEGER NOT NULL DEFAULT 0');
    }
    if (!columns.includes('resend_count')) {
      db.exec('ALTER TABLE bookings ADD COLUMN resend_count INTEGER NOT NULL DEFAULT 0');
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_verification_token
        ON bookings(verification_token_hash);
      CREATE INDEX IF NOT EXISTS idx_bookings_pending_expiry
        ON bookings(verification_expires_at) WHERE status = 'pending';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_resend_token
        ON bookings(resend_token_hash);
      CREATE TABLE IF NOT EXISTS booking_verification_tokens (
        token_hash TEXT PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_booking_verification_tokens_booking
        ON booking_verification_tokens(booking_id);
    `);
  }).immediate();
}
