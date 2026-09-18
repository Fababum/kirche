// Kleine Kennzahlen-Übersicht für den Admin-Bereich, damit auch
// nicht-technische Nutzer:innen auf einen Blick sehen, was los ist.
import { useMemo } from 'react';

function computeStats(bookings) {
  const active = bookings.filter((b) => b.status !== 'cancelled');
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const in7Days = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const upcoming = active.filter((b) => b.tour_date >= today);
  const nextWeek = active.filter((b) => b.tour_date >= today && b.tour_date <= in7Days);
  const totalGuests = upcoming.reduce((sum, b) => sum + (Number(b.group_size) || 0), 0);
  const newCount = active.filter((b) => {
    const created = new Date(b.created_at).getTime();
    return Number.isFinite(created) && now - created < 24 * 60 * 60 * 1000;
  }).length;

  return { upcoming: upcoming.length, totalGuests, nextWeek: nextWeek.length, newCount };
}

function StatCard({ label, value, tone }) {
  return (
    <div className={`admin-stat-card${tone ? ` admin-stat-card--${tone}` : ''}`}>
      <span className="admin-stat-card__value">{value}</span>
      <span className="admin-stat-card__label">{label}</span>
    </div>
  );
}

function AdminStats({ bookings }) {
  const stats = useMemo(() => computeStats(bookings), [bookings]);

  return (
    <div className="admin-stats">
      <StatCard label="Kommende Reservationen" value={stats.upcoming} />
      <StatCard label="Personen (kommend)" value={stats.totalGuests} />
      <StatCard label="Diese Woche" value={stats.nextWeek} />
      <StatCard
        label="Neu (24h)"
        value={stats.newCount}
        tone={stats.newCount > 0 ? 'highlight' : undefined}
      />
    </div>
  );
}

export default AdminStats;
