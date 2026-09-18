import { useEffect, useState } from 'react';
import { api } from '../api';
import AdminLogin from '../components/admin/AdminLogin';
import AdminDashboard from '../components/admin/AdminDashboard';
import '../components/admin/Admin.css';

function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState(null);

  useEffect(() => {
    api
      .me()
      .then((data) => setUsername(data.username))
      .catch(() => setUsername(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="admin-loading">
        <p>Lädt …</p>
      </div>
    );
  }

  if (!username) {
    return <AdminLogin onLogin={(name) => setUsername(name)} />;
  }

  return <AdminDashboard username={username} onLogout={() => setUsername(null)} />;
}

export default AdminApp;
