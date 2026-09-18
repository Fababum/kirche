import { useState } from 'react';
import { api } from '../../api';
import AdminTours from './AdminTours';
import AdminBookings from './AdminBookings';

function AdminDashboard({ username, onLogout }) {
  const [tab, setTab] = useState('bookings');
  const [newBookingsCount, setNewBookingsCount] = useState(0);

  async function handleLogout() {
    await api.logout();
    onLogout();
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <h2>Verwaltung Osterweg Wyland</h2>
          <p>Angemeldet als {username}</p>
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

      <nav className="admin-dashboard__tabs">
        <button
          type="button"
          className={tab === 'bookings' ? 'active' : ''}
          onClick={() => setTab('bookings')}
        >
          Reservationen{newBookingsCount > 0 ? ` (${newBookingsCount} neu)` : ''}
        </button>
        <button
          type="button"
          className={tab === 'tours' ? 'active' : ''}
          onClick={() => setTab('tours')}
        >
          Führungs-Slots
        </button>
      </nav>

      <div className="admin-dashboard__content">
        {tab === 'bookings' ? (
          <AdminBookings onNewCountChange={setNewBookingsCount} />
        ) : (
          <AdminTours />
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
