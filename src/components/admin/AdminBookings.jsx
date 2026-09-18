import { useEffect, useState } from 'react';
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

function matchesSearch(booking, query) {
  if (!query) return true;
  const haystack = `${booking.name} ${booking.email} ${booking.phone || ''} ${booking.tour_date}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function filterBookings(bookings, statusFilter, search) {
  return bookings
    .filter((b) => {
      if (statusFilter === 'active') return b.status !== 'cancelled';
      if (statusFilter === 'cancelled') return b.status === 'cancelled';
      return true;
    })
    .filter((b) => matchesSearch(b, search))
    .sort((a, b) => (a.tour_date + a.tour_time).localeCompare(b.tour_date + b.tour_time));
}

function AdminBookings({ onNewCountChange }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // active | cancelled | all
  const [pendingCancel, setPendingCancel] = useState(null);
  const [exporting, setExporting] = useState(false);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let cancelled = false;

    api
      .getBookings()
      .then((data) => {
        if (cancelled) return;
        setBookings(data);
        setError('');
        setLastUpdated(new Date());
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Automatisch neu laden, damit die Kirche neue Reservationen sieht, ohne
  // die Seite manuell neu laden zu müssen.
  useEffect(() => {
    const interval = setInterval(reload, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  async function confirmCancel() {
    if (!pendingCancel) return;
    await api.updateBooking(pendingCancel.id, { status: 'cancelled' });
    setPendingCancel(null);
    reload();
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadBookingsExcel(filtered);
    } finally {
      setExporting(false);
    }
  }

  const newCount = bookings.filter((b) => b.status !== 'cancelled' && isNewBooking(b)).length;

  useEffect(() => {
    onNewCountChange?.(newCount);
  }, [newCount, onNewCountChange]);

  const filtered = filterBookings(bookings, statusFilter, search);

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
          aria-label="Reservationen durchsuchen"
        />
        <div className="admin-filterbar__chips" role="group" aria-label="Nach Status filtern">
          <button
            type="button"
            className={statusFilter === 'active' ? 'active' : ''}
            onClick={() => setStatusFilter('active')}
          >
            Aktiv
          </button>
          <button
            type="button"
            className={statusFilter === 'cancelled' ? 'active' : ''}
            onClick={() => setStatusFilter('cancelled')}
          >
            Storniert
          </button>
          <button
            type="button"
            className={statusFilter === 'all' ? 'active' : ''}
            onClick={() => setStatusFilter('all')}
          >
            Alle
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="admin-empty">Keine Reservationen gefunden.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table admin-table--cards">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Zeit</th>
                <th>Name</th>
                <th>Kontakt</th>
                <th>Personen</th>
                <th>Schulklasse</th>
                <th>Status</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className={b.status === 'cancelled' ? 'admin-table__cancelled' : ''}>
                  <td data-label="Datum">{b.tour_date}</td>
                  <td data-label="Zeit">{b.tour_time}</td>
                  <td data-label="Name">
                    {b.name}
                    {b.status !== 'cancelled' && isNewBooking(b) && (
                      <span className="admin-badge admin-badge--new admin-badge--inline">Neu</span>
                    )}
                  </td>
                  <td data-label="Kontakt">
                    <a href={`mailto:${b.email}`}>{b.email}</a>
                    {b.phone && <div>{b.phone}</div>}
                  </td>
                  <td data-label="Personen">{b.group_size}</td>
                  <td data-label="Schulklasse">{b.is_school_class ? 'Ja' : 'Nein'}</td>
                  <td data-label="Status">
                    <span
                      className={`admin-status-pill ${
                        b.status === 'cancelled' ? 'admin-status-pill--cancelled' : 'admin-status-pill--ok'
                      }`}
                    >
                      {b.status === 'cancelled' ? 'Storniert' : 'Bestätigt'}
                    </span>
                  </td>
                  <td data-label="Aktion">
                    {b.status !== 'cancelled' && (
                      <button
                        type="button"
                        className="btn btn--outline btn--sm btn--danger-outline"
                        onClick={() => setPendingCancel(b)}
                      >
                        Stornieren
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingCancel)}
        title="Reservation stornieren?"
        message={
          pendingCancel
            ? `Die Reservation von ${pendingCancel.name} am ${pendingCancel.tour_date} wird storniert. Das kann nicht rückgängig gemacht werden.`
            : ''
        }
        confirmLabel="Ja, stornieren"
        danger
        onConfirm={confirmCancel}
        onCancel={() => setPendingCancel(null)}
      />
    </div>
  );
}

export default AdminBookings;
