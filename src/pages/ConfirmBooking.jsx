import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { secretariat } from '../data/content';

function ConfirmBooking() {
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get('token') || '';
  const valid = /^[a-f0-9]{64}$/.test(token);
  const [state, setState] = useState('ready');
  const [error, setError] = useState('');
  const busy = useRef(false);

  async function confirm() {
    if (busy.current || !valid) return;
    busy.current = true;
    setState('sending');
    setError('');
    try {
      await api.confirmBooking(token);
      setState('confirmed');
    } catch (err) {
      setError(err.message);
      setState([400, 409, 410].includes(err.status) ? 'invalid' : 'ready');
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="home-page reservation-page">
      <Header minimal />
      <main className="section confirmation-page">
        <div className="container confirmation-page__content">
          <p>Osterweg Wyland · Reservation</p>
          <h1>{state === 'confirmed' ? 'Reservation bestätigt' : 'E-Mail-Adresse bestätigen'}</h1>
          {state === 'confirmed' ? (
            <p role="status">Deine E-Mail-Adresse ist bestätigt und deine Plätze sind reserviert. Wir freuen uns auf euren Besuch!</p>
          ) : !valid ? (
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
          <a href={state === 'confirmed' ? '/' : '/reservation'}>
            {state === 'confirmed' ? 'Zur Webseite' : 'Zur Anmeldung'}
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default ConfirmBooking;
