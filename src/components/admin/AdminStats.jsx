// Kleine Kennzahlen-Übersicht für den Admin-Bereich, damit auch
// nicht-technische Nutzer:innen auf einen Blick sehen, was los ist.
function computeStats(bookings, tours) {
  const activeTourIds = new Set(tours.filter((tour) => !tour.isCancelled).map((tour) => tour.id));
  const active = bookings.filter((b) => b.status === 'confirmed' && activeTourIds.has(b.tour_id));
  const pendingCount = bookings.filter((b) => b.status === 'pending' && activeTourIds.has(b.tour_id)).length;
  const now = Date.now();
  const today = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const in7Days = end.toISOString().slice(0, 10);
  const formatDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich' });

  const upcoming = active.filter((b) => b.tour_date >= today);
  const nextWeek = active.filter((b) => b.tour_date >= today && b.tour_date <= in7Days);
  const totalGuests = upcoming.reduce((sum, b) => sum + (Number(b.group_size) || 0), 0);
  const newCount = active.filter((b) => {
    const timestamp = b.created_at;
    const created = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)
      ? `${timestamp.replace(' ', 'T')}Z` : timestamp).getTime();
    return Number.isFinite(created) && created <= now && now - created < 24 * 60 * 60 * 1000;
  }).length;

  return { upcoming: upcoming.length, totalGuests, nextWeek: nextWeek.length, newCount, pendingCount, range: `${formatDate(today)} bis ${formatDate(in7Days)}` };
}

function StatCard({ label, value, tone, detail }) {
  return (
    <div className={`admin-stat-card${tone ? ` admin-stat-card--${tone}` : ''}`}>
      <span className="admin-stat-card__value">{value}</span>
      <span className="admin-stat-card__label">{label}</span>
      <span className="admin-stat-card__detail">{detail}</span>
    </div>
  );
}

function AdminStats({ bookings, tours }) {
  const stats = computeStats(bookings, tours);

  return (
    <div className="admin-stats">
      <StatCard label="Kommende Reservationen" value={stats.upcoming} detail="Nur bestätigt, ab heute; eine Reservation kann mehrere Personen umfassen." />
      <StatCard label="Personen (kommend)" value={stats.totalGuests} detail="Summe der bestätigten Plätze ab heute." />
      <StatCard label="Nächste 7 Tage" value={stats.nextWeek} detail={`Bestätigte Reservationen: ${stats.range} (inklusive).`} />
      <StatCard
        label="Neue Reservationen"
        detail="Bestätigte Reservationen, eingegangen in den letzten 24 Stunden. Stornierte Führungen zählen in keiner Kennzahl mit."
        value={stats.newCount}
        tone={stats.newCount > 0 ? 'highlight' : undefined}
      />
      <p className="admin-stats__pending">
        <strong>{stats.pendingCount} Reservationen: E-Mail-Bestätigung ausstehend.</strong>{' '}
        Nicht in den bestätigten Kennzahlen enthalten; stornierte Führungen sind ausgeschlossen.
        Diese Reservationen halten Plätze für 30 Minuten frei. Ohne Bestätigung verfallen sie automatisch.
      </p>
    </div>
  );
}

export default AdminStats;
