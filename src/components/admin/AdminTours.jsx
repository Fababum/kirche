import { useEffect, useState } from 'react';
import { api } from '../../api';
import ConfirmDialog from './ConfirmDialog';

function AdminTours() {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [newTour, setNewTour] = useState({ date: '', time: '', capacity: 15 });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  function reload() {
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    api
      .getAdminTours()
      .then((data) => {
        setTours(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createTour(newTour);
      setNewTour({ date: '', time: '', capacity: 15 });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleCancel(tour) {
    await api.updateTour(tour.id, { isCancelled: !tour.isCancelled });
    reload();
  }

  async function changeCapacity(tour, capacity) {
    await api.updateTour(tour.id, { capacity });
    reload();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await api.deleteTour(pendingDelete.id);
      setPendingDelete(null);
      setDeleteError('');
      reload();
    } catch (err) {
      setDeleteError(err.message);
      setPendingDelete(null);
    }
  }

  const sortedTours = [...tours].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  if (loading) return <p>Lädt …</p>;
  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div>
      <form className="admin-tours__new card" onSubmit={handleCreate}>
        <h3>Neuen Slot anlegen</h3>
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
        </div>
      </form>

      {deleteError && <p className="admin-error">{deleteError}</p>}

      {sortedTours.length === 0 ? (
        <p className="admin-empty">Noch keine Führungs-Slots angelegt.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table admin-table--cards">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Zeit</th>
                <th>Belegt / Kapazität</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedTours.map((tour) => (
                <tr key={tour.id} className={tour.isCancelled ? 'admin-table__cancelled' : ''}>
                  <td data-label="Datum">{tour.date}</td>
                  <td data-label="Zeit">{tour.time}</td>
                  <td data-label="Belegt / Kapazität">
                    <span className="admin-capacity">
                      {tour.bookedCount} /{' '}
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
                    </span>
                  </td>
                  <td data-label="Status">
                    <span
                      className={`admin-status-pill ${
                        tour.isCancelled ? 'admin-status-pill--cancelled' : 'admin-status-pill--ok'
                      }`}
                    >
                      {tour.isCancelled ? 'Storniert' : 'Aktiv'}
                    </span>
                  </td>
                  <td data-label="Aktionen" className="admin-table__actions">
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => toggleCancel(tour)}>
                      {tour.isCancelled ? 'Reaktivieren' : 'Stornieren'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm btn--danger-outline"
                      onClick={() => setPendingDelete(tour)}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Slot löschen?"
        message={
          pendingDelete
            ? `Der Slot vom ${pendingDelete.date} um ${pendingDelete.time} Uhr wird endgültig gelöscht.`
            : ''
        }
        confirmLabel="Ja, löschen"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default AdminTours;
