import { db } from './db/database.js';

export const VERIFICATION_TTL_MS = 30 * 60 * 1000;

// Both the state change and seat release commit together, including across workers.
export const expirePendingBookings = db.transaction((now = Date.now()) => {
  const expired = db.prepare(`
    SELECT tour_id, SUM(group_size) AS people FROM bookings
    WHERE status = 'pending' AND verification_expires_at <= ? GROUP BY tour_id
  `).all(now);
  for (const { tour_id, people } of expired) {
    db.prepare('UPDATE tours SET booked_count = booked_count - ? WHERE id = ?')
      .run(people, tour_id);
  }
  db.prepare(`UPDATE bookings SET status = 'expired'
    WHERE status = 'pending' AND verification_expires_at <= ?`).run(now);
}).immediate;
