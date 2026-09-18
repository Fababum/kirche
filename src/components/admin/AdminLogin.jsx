import { useState } from 'react';
import { api } from '../../api';

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.login(username, password);
      onLogin(result.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__form card" onSubmit={handleSubmit}>
        <h2>Admin-Login</h2>
        <p>Osterweg Wyland - Verwaltung</p>

        <label>
          Benutzername
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>

        <label>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="admin-error">{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Anmelden …' : 'Anmelden'}
        </button>

        <a href="/" className="admin-login__back">
          ← Zurück zur Webseite
        </a>
      </form>
    </div>
  );
}

export default AdminLogin;
