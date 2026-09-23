import { useState } from 'react';
import { api } from '../../api';
import AdminSchedule from './AdminSchedule';

function AdminDashboard({ username, onLogout }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    setLoggingOut(true);
    setError('');
    try {
      await api.logout();
      onLogout();
    } catch {
      setError('Die Abmeldung ist fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <h1>Reservationen verwalten</h1>
          <p>Osterweg Wyland · Angemeldet als {username}</p>
        </div>
        <div className="admin-dashboard__actions">
          <a href="/" className="btn btn--outline">
            Zur Webseite
          </a>
          <button type="button" className="btn btn--secondary" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Wird abgemeldet …' : 'Abmelden'}
          </button>
        </div>
      </header>

      <div className="admin-dashboard__content">
        {error && <p className="admin-error" role="alert">{error}</p>}
        <AdminSchedule />
      </div>
    </div>
  );
}

export default AdminDashboard;
