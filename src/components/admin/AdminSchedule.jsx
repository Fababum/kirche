import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import ConfirmDialog from './ConfirmDialog';
import AdminStats from './AdminStats';
import { downloadBookingsExcel } from './exportExcel';

const AUTO_REFRESH_MS = 30000;
const NEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function isNewBooking(booking) {
  const created = new Date(booking.created_at).getTime();
  return Number.isFinite(created) && Date.now() - created < NEW_THRESHOLD_MS;
}

function formatTimestamp(date) {
  return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso) {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('de-CH', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// Führt Führungen und ihre Reservationen zu einer Liste zusammen, damit man
// auf einen Blick sieht, wer für welche Führung gebucht hat.
function buildSchedule(tours, bookings) {
  const byTour = new Map();
  for (const b of bookings) {
    if (!byTour.has(b.tour_id)) byTour.set(b.tour_id, []);
    byTour.get(b.tour_id).push(b);
  }
  return tours.map((tour) => ({
    ...tour,
    bookings: (byTour.get(tour.id) || []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    ),
  }));
}

function matchesSearch(entry, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const inTour = `${entry.date} ${entry.time}`.toLowerCase().includes(q);
  const inBookings = entry.bookings.some((b) =>
    `${b.name} ${b.email} ${b.phone || ''}`.toLowerCase().includes(q)
  );
  return inTour || inBookings;
}

function AdminSchedule() {
  const [tours, setTours] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('upcoming'); // upcoming | all | past
  const [expanded, setExpanded] = useState(() => new Set());
  const [pendingCancelBooking, setPendingCancelBooking] = useState(null);
  const [pendingDeleteTour, setPendingDeleteTour] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTour, setNewTour] = useState({ date: '', time: '', capacity: 15 });
  const [actionError, setActionError] = useState('');

  function reload() {
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getAdminTours(), api.getBookings()])
      .then(([toursData, bookingsData]) => {
        if (cancelled) return;
        setTours(toursData);
        setBookings(bookingsData);
        setError('');
        setLastUpdated(new Date());
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Automatisch neu laden, damit neue Reservationen ohne manuelles
  // Neuladen sichtbar werden.
  useEffect(() => {
    const interval = setInterval(reload, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const schedule = useMemo(() => buildSchedule(tours, bookings), [tours, bookings]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = schedule
    .filter((entry) => {
      if (timeFilter === 'upcoming') return entry.date >= today && !entry.isCancelled;
      if (timeFilter === 'past') return entry.date < today;
      return true;
    })
    .filter((entry) => matchesSearch(entry, search))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const newCount = bookings.filter((b) => b.status !== 'cancelled' && isNewBooking(b)).length;

  function toggleExpand(tourId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tourId)) next.delete(tourId);
      else next.add(tourId);
      return next;
    });
  }

  async function confirmCancelBooking() {
    if (!pendingCancelBooking) return;
    await api.updateBooking(pendingCancelBooking.id, { status: 'cancelled' });
    setPendingCancelBooking(null);
    reload();
  }

  async function toggleCancelTour(tour) {
    await api.updateTour(tour.id, { isCancelled: !tour.isCancelled });
    reload();
  }

  async function changeCapacity(tour, capacity) {
    await api.updateTour(tour.id, { capacity });
    reload();
  }

  async function confirmDeleteTour() {
    if (!pendingDeleteTour) return;
    try {
      await api.deleteTour(pendingDeleteTour.id);
      setPendingDeleteTour(null);
      setActionError('');
      reload();
    } catch (err) {
      setActionError(err.message);
      setPendingDeleteTour(null);
    }
  }

  async function handleCreateTour(e) {
    e.preventDefault();
    try {
      await api.createTour(newTour);
      setNewTour({ date: '', time: '', capacity: 15 });
      setShowNewForm(false);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const allBookingsInView = filtered.flatMap((entry) => entry.bookings);
      await downloadBookingsExcel(allBookingsInView);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <p>Lädt …</p>;
  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div>
      <AdminStats bookings={bookings} />

      <div className="admin-bookings__toolbar">
        <div className="admin-bookings__status">
          {newCount > 0 && (
            <span className="admin-badge admin-badge--new">{newCount} neu (24h)</span>
          )}
          {lastUpdated && (
            <span className="admin-bookings__updated">
              Zuletzt aktualisiert um {formatTimestamp(lastUpdated)}
            </span>
          )}
        </div>
        <div className="admin-bookings__actions">
          <button type="button" className="btn btn--outline" onClick={reload}>
            Aktualisieren
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleExport}
            disabled={filtered.length === 0 || exporting}
          >
            {exporting ? 'Wird erstellt …' : 'Als Excel herunterladen'}
          </button>
        </div>
      </div>

      <div className="admin-filterbar">
        <input
          type="search"
          className="admin-filterbar__search"
          placeholder="Suchen nach Name, E-Mail, Telefon oder Datum …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Führungen und Reservationen durchsuchen"
        />
        <div className="admin-filterbar__chips" role="group" aria-label="Zeitraum filtern">
          <button
            type="button"
            className={timeFilter === 'upcoming' ? 'active' : ''}
            onClick={() => setTimeFilter('upcoming')}
          >
            Kommende
          </button>
          <button
            type="button"
            className={timeFilter === 'all' ? 'active' : ''}
            onClick={() => setTimeFilter('all')}
          >
            Alle
          </button>
          <button
            type="button"
            className={timeFilter === 'past' ? 'active' : ''}
            onClick={() => setTimeFilter('past')}
          >
            Vergangen
          </button>
        </div>
      </div>

      {actionError && <p className="admin-error">{actionError}</p>}

      <div className="admin-schedule__new">
        {showNewForm ? (
          <form className="card admin-schedule__new-form" onSubmit={handleCreateTour}>
            <div className="admin-tours__new-row">
              <label>
                Datum
                <input
                  type="date"
                  required
                  value={newTour.date}
                  onChange={(e) => setNewTour({ ...newTour, date: e.target.value })}
                />
              </label>
              <label>
                Uhrzeit
                <input
                  type="time"
                  required
                  value={newTour.time}
                  onChange={(e) => setNewTour({ ...newTour, time: e.target.value })}
                />
              </label>
              <label>
                Kapazität
                <input
                  type="number"
                  min={1}
                  value={newTour.capacity}
                  onChange={(e) => setNewTour({ ...newTour, capacity: e.target.value })}
                />
              </label>
              <button type="submit" className="btn btn--primary">
                Anlegen
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setShowNewForm(false)}
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn btn--outline admin-schedule__new-btn"
            onClick={() => setShowNewForm(true)}
          >
            + Neue Führung anlegen
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="admin-empty">Keine Führungen gefunden.</p>
      ) : (
        <div className="admin-schedule__list">
          {filtered.map((tour) => {
            const isOpen = expanded.has(tour.id);
            const activeBookings = tour.bookings.filter((b) => b.status !== 'cancelled');
            const tourNewCount = activeBookings.filter(isNewBooking).length;

            return (
              <div
                key={tour.id}
                className={`admin-schedule__item card${
                  tour.isCancelled ? ' admin-schedule__item--cancelled' : ''
                }`}
              >
                <button
                  type="button"
                  className="admin-schedule__header"
                  onClick={() => toggleExpand(tour.id)}
                  aria-expanded={isOpen}
                >
                  <span className="admin-schedule__chevron" aria-hidden="true">
                    {isOpen ? '▾' : '▸'}
                  </span>
                  <span className="admin-schedule__date">{formatDateLabel(tour.date)}</span>
                  <span className="admin-schedule__time">{tour.time} Uhr</span>
                  <span className="admin-schedule__count">
                    {tour.bookedCount} / {tour.capacity} Personen
                  </span>
                  {tourNewCount > 0 && (
                    <span className="admin-badge admin-badge--new">{tourNewCount} neu</span>
                  )}
                  <span
                    className={`admin-status-pill ${
                      tour.isCancelled ? 'admin-status-pill--cancelled' : 'admin-status-pill--ok'
                    }`}
                  >
                    {tour.isCancelled ? 'Storniert' : 'Aktiv'}
                  </span>
                </button>

                {isOpen && (
                  <div className="admin-schedule__details">
                    <div className="admin-schedule__tour-actions">
                      <label className="admin-schedule__capacity-label">
                        Kapazität:{' '}
                        <input
                          type="number"
                          min={tour.bookedCount}
                          defaultValue={tour.capacity}
                          className="admin-table__capacity-input"
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val !== tour.capacity) changeCapacity(tour, val);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => toggleCancelTour(tour)}
                      >
                        {tour.isCancelled ? 'Führung reaktivieren' : 'Führung stornieren'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm btn--danger-outline"
                        onClick={() => setPendingDeleteTour(tour)}
                      >
                        Führung löschen
                      </button>
                    </div>

                    {tour.bookings.length === 0 ? (
                      <p className="admin-empty admin-empty--compact">
                        Noch keine Reservationen für diese Führung.
                      </p>
                    ) : (
                      <div className="admin-schedule__bookings">
                        {tour.bookings.map((b) => (
                          <div
                            key={b.id}
                            className={`admin-schedule__booking${
                              b.status === 'cancelled' ? ' admin-schedule__booking--cancelled' : ''
                            }`}
                          >
                            <div className="admin-schedule__booking-main">
                              <strong>{b.name}</strong>
                              {isNewBooking(b) && b.status !== 'cancelled' && (
                                <span className="admin-badge admin-badge--new admin-badge--inline">
                                  Neu
                                </span>
                              )}
                              {b.is_school_class ? (
                                <span className="badge">Schulklasse</span>
                              ) : null}
                              <span className="admin-schedule__booking-size">
                                {b.group_size} {b.group_size === 1 ? 'Person' : 'Personen'}
                              </span>
                            </div>
                            <div className="admin-schedule__booking-contact">
                              <a href={`mailto:${b.email}`}>{b.email}</a>
                              {b.phone && <span> · {b.phone}</span>}
                            </div>
                            {b.note && <p className="admin-schedule__booking-note">„{b.note}"</p>}
                            <div className="admin-schedule__booking-actions">
                              <span
                                className={`admin-status-pill ${
                                  b.status === 'cancelled'
                                    ? 'admin-status-pill--cancelled'
                                    : 'admin-status-pill--ok'
                                }`}
                              >
                                {b.status === 'cancelled' ? 'Storniert' : 'Bestätigt'}
                              </span>
                              {b.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  className="btn btn--outline btn--sm btn--danger-outline"
                                  onClick={() => setPendingCancelBooking(b)}
                                >
                                  Stornieren
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingCancelBooking)}
        title="Reservation stornieren?"
        message={
          pendingCancelBooking
            ? `Die Reservation von ${pendingCancelBooking.name} wird storniert. Das kann nicht rückgängig gemacht werden.`
            : ''
        }
        confirmLabel="Ja, stornieren"
        danger
        onConfirm={confirmCancelBooking}
        onCancel={() => setPendingCancelBooking(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteTour)}
        title="Führung löschen?"
        message={
          pendingDeleteTour
            ? `Die Führung vom ${pendingDeleteTour.date} um ${pendingDeleteTour.time} Uhr wird endgültig gelöscht.`
            : ''
        }
        confirmLabel="Ja, löschen"
        danger
        onConfirm={confirmDeleteTour}
        onCancel={() => setPendingDeleteTour(null)}
      />
    </div>
  );
}

export default AdminSchedule;
