import { useState } from 'react';
import './CookieConsent.css';

const STORAGE_KEY = 'osterweg_cookie_consent';

// Einfacher Cookie-Hinweis: Diese Webseite selbst braucht für Besucher:innen
// keine Cookies (siehe Datenschutzerklärung) - der Banner gibt Nutzer:innen
// trotzdem die Kontrolle/Transparenz, bevor spätere Zusatzfunktionen (z.B.
// eine einfache Statistik) dazukommen könnten.
function CookieConsent() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(STORAGE_KEY));

  function choose(value) {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite" aria-label="Cookie-Hinweis">
      <div className="cookie-consent__inner">
        <p>
          Diese Webseite verwendet nur technisch notwendige Cookies (z.B. für den Admin-Login).
          Es gibt kein Tracking und keine Werbe-Cookies. Mehr dazu in unserer{' '}
          <a href="/datenschutz">Datenschutzerklärung</a>.
        </p>
        <div className="cookie-consent__actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={() => choose('rejected')}>
            Ablehnen
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => choose('accepted')}>
            Akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
