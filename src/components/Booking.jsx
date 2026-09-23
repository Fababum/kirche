import { useEffect, useMemo, useState } from 'react';
import { registrationInfo } from '../data/content';
import { api } from '../api';
import SchoolClassContact from './SchoolClassContact';
import './Booking.css';

const START_DATE = '2027-03-13';
const END_DATE = '2027-03-28';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

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
  const [selectedTour, setSelectedTour] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    groupSize: 5,
    isSchoolClass: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const dateList = useMemo(() => buildDateList(START_DATE, END_DATE), []);

  useEffect(() => {
    api
      .getTours(START_DATE, END_DATE)
      .then((data) => {
        setTours(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
    const anyFree = dayTours.some((t) => !t.isFull);
    return anyFree ? 'free' : 'full';
  }

  function handleSelectDate(iso) {
    if (dayStatus(iso) === 'none') return;
    setSelectedDate(iso);
    setSelectedTour(null);
    setSuccessMessage('');
    setSubmitError('');
  }

  function handleSelectTour(tour) {
    if (tour.isFull) return;
    setSelectedTour(tour);
    setSuccessMessage('');
    setSubmitError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTour) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api.createBooking({
        tourId: selectedTour.id,
        ...form,
        groupSize: Number(form.groupSize),
      });
      setSuccessMessage(result.message);
      setSelectedTour(null);
      setSelectedDate(null);
      setForm({ name: '', email: '', phone: '', groupSize: 5, isSchoolClass: false });
      // A refresh failure must not look like a failed booking and invite duplicates.
      api.getTours(START_DATE, END_DATE).then(setTours).catch(() => {
        setError('Die verfügbaren Plätze konnten nicht aktualisiert werden. Bitte lade die Seite neu. Deine E-Mail-Bestätigung steht weiterhin aus.');
      });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="reservieren" className="section section--warm booking">
      <div className="container">
        <div className="section-heading">
          <h1>{registrationInfo.heading}</h1>
        </div>

        <p className="booking__notice">
          {registrationInfo.notice} {registrationInfo.accessibility}
        </p>
        <p className="booking__notice">Nach der Anmeldung erhältst du eine E-Mail. Bitte bestätige deine Adresse innerhalb von 30 Minuten, damit die Reservation gültig wird.</p>
        {successMessage && (
          <div className="booking__pending" role="status">
            <h2>Bitte E-Mail bestätigen</h2>
            <p>{successMessage}</p>
            <p>Prüfe auch den Spamordner. Ohne Bestätigung werden die Plätze nach 30 Minuten wieder freigegeben. Bei einer falschen Adresse kannst du die Anmeldung erneut ausfüllen.</p>
          </div>
        )}

        {loading && <p>Führungen werden geladen …</p>}
        {error && <p className="booking__error">{error}</p>}

        {!loading && !error && (
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
                    onClick={() => handleSelectDate(iso)}
                  >
                    <span className="booking__day-weekday">
                      {WEEKDAY_LABELS[new Date(`${iso}T00:00:00`).getDay()]}
                    </span>
                    <span className="booking__day-date">
                      {formatDateLabel(iso).split(' ')[1] || iso.slice(8, 10)}
                    </span>
                    {status !== 'none' && (
                      <span className={`booking__dot booking__dot--${status}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedDate && !error && (
          <div className="booking__slots">
            <h3>Verfügbare Führungen am {formatDateLabel(selectedDate)}</h3>
            <div className="booking__slot-list">
              {(toursByDate[selectedDate] || []).map((tour) => (
                <button
                  key={tour.id}
                  type="button"
                  disabled={tour.isFull}
                  className={`booking__slot ${
                    selectedTour?.id === tour.id ? 'booking__slot--selected' : ''
                  } ${tour.isFull ? 'booking__slot--full' : ''}`}
                  onClick={() => handleSelectTour(tour)}
                >
                  {tour.time} Uhr
                  <span className="booking__slot-spots">
                    {tour.isFull ? 'ausgebucht' : `${tour.freeSpots} Plätze frei`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedTour && (
          <form className="booking__form card" onSubmit={handleSubmit}>
            <h3>
              Reservation für {formatDateLabel(selectedDate)}, {selectedTour.time} Uhr
            </h3>

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
                Telefon
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                Gruppengrösse *
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

            {submitError && <p className="booking__error">{submitError}</p>}

            <button type="submit" className="btn btn--primary" disabled={submitting}>
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
          </form>
        )}

      </div>
    </section>
  );
}

export default Booking;
