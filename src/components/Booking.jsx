import { useEffect, useMemo, useRef, useState } from 'react';
import { registrationInfo, secretariat } from '../data/content';
import { api } from '../api';
import { EVENT_START_DATE, EVENT_END_DATE, SCHOOL_RESERVED_DATE } from '../../shared/event.js';
import SchoolClassContact from './SchoolClassContact';
import './Booking.css';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_STATUS_LABELS = { none: 'Keine Führung', closed: 'Anmeldeschluss', free: 'Plätze frei', full: 'Ausgebucht' };

function buildDateList(start, end) {
  const dates = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function formatDateLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function Booking() {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTourId, setSelectedTourId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    groupSize: 1,
    isSchoolClass: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendStopped, setResendStopped] = useState(false);
  const resendingRef = useRef(false);
  const receiptRef = useRef(null);
  const submittingRef = useRef(false);
  const selectedTour = tours.find((tour) => tour.id === selectedTourId);

  useEffect(() => {
    if (receipt) {
      receiptRef.current?.focus({ preventScroll: true });
      receiptRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [receipt]);

  useEffect(() => {
    if (!receipt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [receipt]);

  const dateList = useMemo(() => buildDateList(EVENT_START_DATE, EVENT_END_DATE), []);

  function refreshTours() {
    setNow(Date.now());
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .getTours(EVENT_START_DATE, EVENT_END_DATE)
      .then((data) => {
        if (cancelled) return;
        setTours(data);
        setError('');
        setLastUpdated(new Date());
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    if (receipt) return;
    const interval = setInterval(refreshTours, 60000);
    window.addEventListener('focus', refreshTours);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshTours);
    };
  }, [receipt]);

  function isClosed(tour) {
    return tour.isBookingClosed || now >= Date.parse(tour.bookingClosesAt);
  }

  const selectedUnavailable = selectedTourId !== null && (!selectedTour || selectedTour.isFull || isClosed(selectedTour));

  useEffect(() => {
    if (!selectedTour) return;
    // Recheck an open form at its deadline, not only on the next refresh.
    const delay = Date.parse(selectedTour.bookingClosesAt) - Date.now();
    if (delay <= 0 || delay > 2147483647) return;
    const timeout = setTimeout(refreshTours, delay);
    return () => clearTimeout(timeout);
  }, [selectedTour]);

  const toursByDate = useMemo(() => {
    const map = {};
    for (const t of tours) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return map;
  }, [tours]);

  function dayStatus(iso) {
    const dayTours = toursByDate[iso] || [];
    if (dayTours.length === 0) return 'none';
    if (iso === SCHOOL_RESERVED_DATE && dayTours.every((tour) => tour.isFull)) return 'full';
    if (dayTours.every(isClosed)) return 'closed';
    const anyFree = dayTours.some((t) => !t.isFull && !isClosed(t));
    return anyFree ? 'free' : 'full';
  }

  function handleSelectDate(iso) {
    if (dayStatus(iso) === 'none') return;
    setSelectedDate(iso);
    setSelectedTourId(null);
    setSubmitError('');
  }

  function handleSelectTour(tour) {
    if (tour.isFull || isClosed(tour)) return;
    setSelectedTourId(tour.id);
    setSubmitError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submittingRef.current || !selectedTour || selectedUnavailable || error || loading) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api.createBooking({
        tourId: selectedTour.id,
        ...form,
        groupSize: Number(form.groupSize),
      });
      setNow(Date.now());
      setResendAt(Date.now() + result.retryAfter * 1000);
      setReceipt({ pending: result.status === 'pending', email: form.email.trim(),
        resendToken: result.resendToken, expiresAt: result.expiresAt });
      setSelectedTourId(null);
      setSelectedDate(null);
      setForm({ name: '', email: '', phone: '', groupSize: 1, isSchoolClass: false });
    } catch (err) {
      setSubmitError(err.message);
      refreshTours();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendingRef.current || resendStopped || Date.now() < resendAt || Date.now() >= receipt.expiresAt) return;
    resendingRef.current = true;
    setResending(true);
    setResendError('');
    setResendMessage('');
    try {
      const result = await api.resendVerification(receipt.resendToken);
      setResendAt(Date.now() + result.retryAfter * 1000);
      setResendMessage('Die Bestätigungs-E-Mail wurde erneut gesendet. Die ursprüngliche Bestätigungsfrist bleibt unverändert.');
    } catch (err) {
      setResendError(err.message);
      setResendAt(Date.now() + (err.retryAfter || 20) * 1000);
      if ([400, 403, 409, 410].includes(err.status)) setResendStopped(true);
    } finally {
      setNow(Date.now());
      resendingRef.current = false;
      setResending(false);
    }
  }

  if (receipt) {
    const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
    const expired = now >= receipt.expiresAt;
    return (
      <section id="reservieren" className="section section--warm booking">
        <div className="container">
          <div className="booking__pending" ref={receiptRef} tabIndex={-1} aria-labelledby="receipt-title">
            <svg className="booking__mail-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="6" y="12" width="36" height="26" rx="2" />
              <path d="m7 14 17 13 17-13" />
            </svg>
            <p className="booking__receipt-label">{receipt.pending ? 'Noch ein Schritt' : 'Anmeldung eingegangen'}</p>
            <h1 id="receipt-title">{receipt.pending ? 'Bitte bestätige deine E-Mail' : 'Bitte kontaktiere das Sekretariat'}</h1>
            {receipt.pending ? (
              <>
                <p>Wir haben dir einen Bestätigungslink geschickt an</p>
                <p className="booking__receipt-email">{receipt.email}</p>
                <ol className="booking__receipt-steps">
                  <li>Öffne dein E-Mail-Postfach.</li>
                  <li>Öffne unsere E-Mail und klicke auf den Bestätigungslink.</li>
                  <li>Bestätige auf der geöffneten Seite deine E-Mail und Reservation.</li>
                </ol>
                <p className="booking__receipt-notice"><strong>Deine Reservation ist noch nicht bestätigt.</strong><br />Wir halten deine Plätze 30 Minuten frei. Ohne Bestätigung werden sie wieder freigegeben.</p>
                <p>Keine E-Mail gefunden? Prüfe bitte auch den Spamordner.</p>
                {expired ? (
                  <p role="status">Die Bestätigungsfrist ist abgelaufen. Falls du noch nicht bestätigt hast, wurden deine Plätze wieder freigegeben.</p>
                ) : !resendStopped && (
                  <button type="button" className="btn btn--outline" onClick={handleResend}
                    disabled={resending || resendSeconds > 0}>
                    {resending ? 'Wird gesendet …' : resendSeconds > 0
                      ? `Erneut senden in ${resendSeconds} Sekunden` : 'E-Mail erneut senden'}
                  </button>
                )}
                {resendMessage && <p role="status">{resendMessage}</p>}
                {resendError && <p className="booking__error" role="alert">{resendError}</p>}
              </>
            ) : (
              <p>Der Server hat deine Anmeldung entgegengenommen, aber den Versand einer Bestätigungs-E-Mail nicht bestätigt. Bitte melde dich beim {secretariat.name}, bevor du erneut buchst, damit keine doppelte Reservation entsteht.</p>
            )}
            <p>Falsche Adresse oder Fragen?{' '}<a href={`mailto:${secretariat.email}`}>{secretariat.name}</a> hilft dir weiter:<br />
              <a href={`tel:${secretariat.phone.replace(/\s/g, '')}`}>{secretariat.phone}</a>.
            </p>
            <a href="/" className="btn btn--outline">Zurück zur Webseite</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="reservieren" className="section section--warm booking">
      <div className="container">
        <div className="section-heading">
          <h1>{registrationInfo.heading}</h1>
          <p>{registrationInfo.subheading} · Truttikon</p>
        </div>

        <div className="booking__rules">
          <p>{registrationInfo.notice}</p>
          <p><strong>{registrationInfo.deadline}</strong> Alle Uhrzeiten sind Schweizer Zeit.</p>
          <p>Nach der Anmeldung hast du 30 Minuten Zeit, deine E-Mail-Adresse zu bestätigen. So lange halten wir deine Plätze frei.</p>
        </div>

        <div className="booking__availability">
          <p role="status">{loading ? 'Verfügbarkeit wird aktualisiert …' : lastUpdated
            ? `Stand ${lastUpdated.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })} Uhr · aktualisiert automatisch`
            : 'Verfügbarkeit noch nicht geladen'}</p>
          <button type="button" className="btn btn--outline" onClick={refreshTours} disabled={loading}>
            {error ? 'Erneut laden' : 'Aktualisieren'}
          </button>
        </div>
        {error && <p className="booking__error" role="alert">{error} Bitte lade die Verfügbarkeit erneut, bevor du reservierst.</p>}

        {lastUpdated && (
          <div className="booking__calendar-scroll">
            <div className="booking__calendar">
              {dateList.map((iso) => {
                const status = dayStatus(iso);
                const isSelected = selectedDate === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`booking__day booking__day--${status} ${
                      isSelected ? 'booking__day--selected' : ''
                    }`}
                    disabled={status === 'none'}
                    aria-pressed={isSelected}
                    aria-label={`${formatDateLabel(iso)}: ${DAY_STATUS_LABELS[status]}`}
                    onClick={() => handleSelectDate(iso)}
                  >
                    <span className="booking__day-weekday">
                      {WEEKDAY_LABELS[new Date(`${iso}T00:00:00`).getDay()]}
                    </span>
                    <span className="booking__day-date">
                      {formatDateLabel(iso).split(' ')[1] || iso.slice(8, 10)}
                    </span>
                    <span className="booking__day-status">{DAY_STATUS_LABELS[status]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedDate && (
          <div className="booking__slots">
            <h2>Uhrzeit wählen · {formatDateLabel(selectedDate)}</h2>
            {selectedDate === SCHOOL_RESERVED_DATE && (
              <p>Der 17. März ist vollständig für Schulklassen reserviert und öffentlich ausgebucht.</p>
            )}
            <div className="booking__slot-list">
              {(toursByDate[selectedDate] || []).map((tour) => (
                <button
                  key={tour.id}
                  type="button"
                  disabled={tour.isFull || isClosed(tour)}
                  aria-pressed={selectedTourId === tour.id}
                  className={`booking__slot ${
                    selectedTour?.id === tour.id ? 'booking__slot--selected' : ''
                  } ${tour.isFull || isClosed(tour) ? 'booking__slot--full' : ''}`}
                  onClick={() => handleSelectTour(tour)}
                >
                  {tour.time} Uhr
                  <span className="booking__slot-spots">
                    {tour.date === SCHOOL_RESERVED_DATE && tour.isFull ? 'Für Schulklassen reserviert'
                      : isClosed(tour) ? 'Anmeldeschluss erreicht' : tour.isFull ? 'ausgebucht' : `${tour.freeSpots} Plätze frei`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedUnavailable && <p className="booking__error" role="alert">Diese Führung ist nicht mehr buchbar. Bitte wähle eine andere Uhrzeit. Deine Formulareingaben bleiben erhalten.</p>}
        {submitError && <p className="booking__error" role="alert">{submitError}</p>}
        {selectedTour && (
          <form className="booking__form card" onSubmit={handleSubmit}>
            <h3>
              Reservation für {formatDateLabel(selectedDate)}, {selectedTour.time} Uhr
            </h3>
            <p className="booking__form-footnote">Anmeldung möglich bis {new Date(selectedTour.bookingClosesAt).toLocaleString('de-CH', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
            })} Uhr (Schweizer Zeit).</p>

            <div className="booking__form-row">
              <label>
                Name *
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                E-Mail *
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
            </div>

            <div className="booking__form-row">
              <label>
                Telefon *
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  maxLength={50}
                  aria-describedby="booking-phone-hint"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                Anzahl Personen *
                <input
                  required
                  type="number"
                  min={1}
                  max={selectedTour.freeSpots}
                  value={form.groupSize}
                  onChange={(e) => setForm({ ...form, groupSize: e.target.value })}
                />
              </label>
            </div>

            <p id="booking-phone-hint" className="booking__form-footnote">
              Die Telefonnummer benötigen wir für Rückfragen und kurzfristige Absagen.
            </p>

            <label className="booking__checkbox">
              <input
                type="checkbox"
                checked={form.isSchoolClass}
                onChange={(e) => setForm({ ...form, isSchoolClass: e.target.checked })}
              />
              Schulklasse
            </label>
            {form.isSchoolClass && (
              <p className="booking__form-footnote"><SchoolClassContact /></p>
            )}

            <button type="submit" className="btn btn--primary" disabled={submitting || selectedUnavailable || Boolean(error) || loading}>
              {submitting ? 'Wird gesendet …' : 'Bestätigungs-E-Mail anfordern'}
            </button>

            <p className="booking__form-footnote">
              Mit dem Absenden werden deine Angaben zur Organisation der Führung verwendet, siehe{' '}
              <a href="/datenschutz" target="_blank" rel="noreferrer">
                Datenschutzerklärung
              </a>
              .
            </p>
            <p className="booking__form-footnote">{registrationInfo.deadline}</p>
            <p className="booking__form-footnote">{registrationInfo.accessibility}</p>
          </form>
        )}

      </div>
    </section>
  );
}

export default Booking;
