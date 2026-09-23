import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { secretariat } from '../data/content';

function ConfirmBooking() {
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get('token') || '';
  const valid = /^[a-f0-9]{64}$/.test(token);
  const [state, setState] = useState(() =>
    valid && window.history.state?.confirmedBooking === hash ? 'confirmed' : 'ready');
  const [error, setError] = useState('');
  const busy = useRef(false);
  const successRef = useRef(null);

  useEffect(() => {
    if (state === 'confirmed') successRef.current?.focus();
  }, [state]);

  async function confirm() {
    if (busy.current || !valid) return;
    busy.current = true;
    setState('sending');
    setError('');
    try {
      await api.confirmBooking(token);
      // Preserve this completed view on reload/back without sending another request.
      window.history.replaceState({ ...window.history.state, confirmedBooking: hash }, '');
      setState('confirmed');
    } catch (err) {
      setError(err.message);
      setState([400, 409, 410].includes(err.status) ? 'invalid' : 'ready');
    } finally {
      busy.current = false;
    }
  }

  if (state === 'confirmed') {
    return (
      <div className="home-page confirmation-complete">
        <main className="confirmation-complete__card" aria-labelledby="confirmation-title">
          <svg className="confirmation-complete__icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="24" cy="24" r="20" />
            <path d="m14 24 7 7 13-14" />
          </svg>
          <p>Osterweg Wyland · Reservation</p>
          <h1 id="confirmation-title" ref={successRef} tabIndex={-1}>Reservation bestätigt</h1>
          <p>Deine E-Mail-Adresse ist bestätigt und deine Plätze sind reserviert. Wir freuen uns auf euren Besuch!</p>
          <p>Du musst nichts weiter bestätigen. Diese Seite bleibt geöffnet, bis du zurück zur Webseite gehst.</p>
          <a href="/" className="btn btn--primary">Zurück zur Webseite</a>
          <p className="confirmation-page__contact">
            Fragen oder Änderungen?{' '}
            <a href={`mailto:${secretariat.email}`}>{secretariat.name}</a> hilft dir weiter:{' '}
            <a href={`tel:${secretariat.phone.replace(/\s/g, '')}`}>{secretariat.phone}</a>.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="home-page reservation-page">
      <Header minimal />
      <main className="section confirmation-page">
        <div className="container confirmation-page__content">
          <p>Osterweg Wyland · Reservation</p>
          <h1>E-Mail-Adresse bestätigen</h1>
          {!valid ? (
            <p role="alert">Dieser Bestätigungslink ist unvollständig oder ungültig. Bitte öffne den vollständigen Link aus deiner E-Mail.</p>
          ) : (
            <>
              <p>Mit dem folgenden Button bestätigst du, dass diese E-Mail-Adresse dir gehört und du die Reservation abschliessen möchtest.</p>
              <p>Deine Plätze werden ab der Anmeldung 30 Minuten freigehalten. Erst nach der Bestätigung ist die Reservation verbindlich.</p>
              {error && <p className="booking__error" role="alert">{error}</p>}
              {state !== 'invalid' && (
                <button className="btn btn--primary" onClick={confirm} disabled={state === 'sending'}>
                  {state === 'sending' ? 'Wird bestätigt …' : 'E-Mail und Reservation bestätigen'}
                </button>
              )}
            </>
          )}
          <p className="confirmation-page__contact">
            Fragen, Änderungen oder Schulklassen? Bitte melde dich bei{' '}
            <a href={`mailto:${secretariat.email}`}>{secretariat.name}</a> oder unter{' '}
            <a href={`tel:${secretariat.phone.replace(/\s/g, '')}`}>{secretariat.phone}</a>.
          </p>
          <a href="/reservation">Zur Anmeldung</a>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default ConfirmBooking;
