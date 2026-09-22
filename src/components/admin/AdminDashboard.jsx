import { api } from '../../api';
import AdminSchedule from './AdminSchedule';

function AdminDashboard({ username, onLogout }) {
  async function handleLogout() {
    await api.logout();
    onLogout();
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <h2>Willkommen, {username}!</h2>
          <p>
            Hier siehst du alle Führungen und wer sich dafür angemeldet hat - klicke auf eine
            Führung, um die Reservationen zu sehen.
          </p>
        </div>
        <div className="admin-dashboard__actions">
          <a href="/" className="btn btn--outline">
            Zur Webseite
          </a>
          <button type="button" className="btn btn--secondary" onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      </header>

      <div className="admin-dashboard__content">
        <AdminSchedule />
      </div>
    </div>
  );
}

export default AdminDashboard;
