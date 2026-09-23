import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import ConfirmDialog from './ConfirmDialog';
import AdminStats from './AdminStats';
import { BOOKING_STATUS_LABELS, downloadBookingsExcel } from './exportExcel';

const AUTO_REFRESH_MS = 30000;
const NEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function isActiveBooking(booking) {
  return booking.status === 'confirmed' || booking.status === 'pending';
}

function isNewBooking(booking) {
  if (booking.status !== 'confirmed') return false;
  const timestamp = booking.created_at;
  const created = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)
    ? `${timestamp.replace(' ', 'T')}Z` : timestamp).getTime();
  const age = Date.now() - created;
  return Number.isFinite(created) && age >= 0 && age < NEW_THRESHOLD_MS;
}

function formatTimestamp(date) {
  return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
}

function formatDateLabel(iso) {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('de-CH', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// Führt Führungen und ihre Reservationen zu einer Liste zusammen, damit man
// auf einen Blick sieht, wer für welche Führung gebucht hat.
function buildSchedule(tours, bookings) {
  const byTour = new Map();
  for (const b of bookings) {
    if (!byTour.has(b.tour_id)) byTour.set(b.tour_id, []);
    byTour.get(b.tour_id).push(b);
  }
  return tours.map((tour) => ({
    ...tour,
    bookings: (byTour.get(tour.id) || []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    ),
  }));
}

function matchesSearch(entry, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  const inTour = `${entry.date} ${formatDateLabel(entry.date)} ${entry.time}`.toLowerCase().includes(q);
  const inBookings = entry.bookings.some((b) =>
    `${b.name} ${b.email} ${b.phone || ''}`.toLowerCase().includes(q)
  );
  return inTour || inBookings;
}

function AdminSchedule() {
  const [tours, setTours] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('upcoming'); // upcoming | all | past
  const [expanded, setExpanded] = useState(() => new Set());
  const [pendingCancelBooking, setPendingCancelBooking] = useState(null);
  const [pendingDeleteTour, setPendingDeleteTour] = useState(null);
  const [pendingToggleTour, setPendingToggleTour] = useState(null);
  const [capacityDraft, setCapacityDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTour, setNewTour] = useState({ date: '', time: '', capacity: 15 });
  const [actionError, setActionError] = useState('');

  function reload() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getAdminTours(), api.getBookings()])
      .then(([toursData, bookingsData]) => {
        if (cancelled) return;
        setTours(toursData);
        setBookings(bookingsData);
        setError('');
        setLastUpdated(new Date());
      })
      .catch(() => !cancelled && setError('Die Daten konnten nicht geladen werden. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Automatisch neu laden, damit neue Reservationen ohne manuelles
  // Neuladen sichtbar werden.
  useEffect(() => {
    const interval = setInterval(reload, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const schedule = useMemo(() => buildSchedule(tours, bookings), [tours, bookings]);

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

  const filtered = schedule
    .filter((entry) => {
      if (timeFilter === 'upcoming') return entry.date >= today && !entry.isCancelled;
      if (timeFilter === 'past') return entry.date < today;
      return true;
    })
    .filter((entry) => matchesSearch(entry, search))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const newCount = schedule.filter((tour) => !tour.isCancelled)
    .flatMap((tour) => tour.bookings).filter(isNewBooking).length;

  function toggleExpand(tourId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tourId)) next.delete(tourId);
      else next.add(tourId);
      return next;
    });
  }

  async function confirmCancelBooking() {
    if (!pendingCancelBooking) return;
    const booking = bookings.find((b) => b.id === pendingCancelBooking.id);
    if (!booking || !isActiveBooking(booking)) {
      setPendingCancelBooking(null);
      return;
    }
    await api.updateBooking(booking.id, { status: 'cancelled' });
    setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: 'cancelled' } : b));
    setTours((prev) => prev.map((tour) => tour.id === booking.tour_id
      ? { ...tour, bookedCount: Math.max(0, tour.bookedCount - booking.group_size) } : tour));
    setPendingCancelBooking(null);
    reload();
  }

  async function confirmToggleTour() {
    const tour = pendingToggleTour;
    if (!tour) return;
    await api.updateTour(tour.id, { isCancelled: !tour.isCancelled });
    setTours((prev) => prev.map((entry) => entry.id === tour.id ? { ...entry, isCancelled: !tour.isCancelled } : entry));
    setPendingToggleTour(null);
    reload();
  }

  async function saveCapacity(e, tour) {
    e.preventDefault();
    if (savingRef.current) return;
    const capacity = Number(capacityDraft.value);
    const minimum = Math.max(1, tour.bookedCount);
    if (!Number.isSafeInteger(capacity) || capacity < minimum) {
      setActionError(`Bitte geben Sie eine ganze Platzanzahl von mindestens ${minimum} ein. Bestätigte und bis zur E-Mail-Bestätigung gehaltene Plätze müssen erhalten bleiben.`);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setActionError('');
    try {
      await api.updateTour(tour.id, { capacity });
      setTours((prev) => prev.map((entry) => entry.id === tour.id ? { ...entry, capacity } : entry));
      setCapacityDraft(null);
      reload();
    } catch (err) {
      setActionError(`Die Platzanzahl wurde nicht gespeichert. Bitte versuchen Sie es erneut. ${err.message || ''}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function confirmDeleteTour() {
    if (!pendingDeleteTour) return;
    await api.deleteTour(pendingDeleteTour.id);
    setTours((prev) => prev.filter((tour) => tour.id !== pendingDeleteTour.id));
    if (capacityDraft?.id === pendingDeleteTour.id) setCapacityDraft(null);
    setPendingDeleteTour(null);
    reload();
  }

  async function handleCreateTour(e) {
    e.preventDefault();
    if (savingRef.current) return;
    const capacity = Number(newTour.capacity);
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      setActionError('Bitte geben Sie eine ganze Platzanzahl von mindestens 1 ein.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setActionError('');
    try {
      await api.createTour({ ...newTour, capacity });
      setNewTour({ date: '', time: '', capacity: 15 });
      setShowNewForm(false);
      reload();
    } catch (err) {
      setActionError(`Die Führung konnte nicht angelegt werden. Bitte prüfen Sie Ihre Eingaben und die Verbindung. ${err.message || ''}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setActionError('');
    try {
      const allBookingsInView = filtered.flatMap((entry) => entry.bookings);
      await downloadBookingsExcel(allBookingsInView);
    } catch (err) {
      setActionError(`Die Excel-Datei konnte nicht erstellt werden. Bitte versuchen Sie es erneut. ${err.message || ''}`);
    } finally {
      setExporting(false);
    }
  }

  if (loading && !lastUpdated) return <p role="status">Führungen und Reservationen werden geladen …</p>;

  return (
    <div className="admin-schedule">
      {error && (
        <div className="admin-error" role="alert">
          <p>{error} {lastUpdated && 'Die zuletzt geladenen Daten bleiben sichtbar und sind möglicherweise nicht aktuell.'}</p>
          <button type="button" className="btn btn--outline" onClick={reload} disabled={loading}>
            {loading ? 'Wird geladen …' : 'Erneut versuchen'}
          </button>
        </div>
      )}
      {lastUpdated && <>
      <details className="admin-schedule__help">
        <summary>Kurzhilfe für das Sekretariat</summary>
        <ul>
          <li><strong>Reservation finden:</strong> Nach Name, Datum, E-Mail oder Telefon suchen. Für stornierte oder ältere Führungen den Filter «Alle» wählen.</li>
          <li><strong>Zahlen verstehen:</strong> Eine Reservation kann mehrere Personen umfassen. Die Kennzahlen und «Neu» zählen nur bestätigte Reservationen auf nicht stornierten Führungen. «Neu» bedeutet: in den letzten 24 Stunden eingegangen. Die belegten Plätze einer Führung enthalten auch vorläufig gehaltene Plätze.</li>
          <li><strong>E-Mail-Bestätigung:</strong> Ausstehende Reservationen halten Plätze für 30 Minuten frei. Die buchende Person muss den Link in ihrer E-Mail öffnen. Ohne Bestätigung verfällt die Reservation automatisch und die Plätze werden freigegeben. Das Sekretariat bestätigt Reservationen nicht manuell.</li>
          <li><strong>Plätze ändern:</strong> Führung öffnen, «Platzanzahl ändern» wählen und ausdrücklich speichern. Abbrechen verwirft die Eingabe.</li>
          <li><strong>Absagen mitteilen:</strong> Beim Stornieren werden keine automatischen E-Mails versendet. Betroffene bitte selbst per E-Mail oder Telefon informieren. Bei einer stornierten Führung bleiben die Reservationen bestehen.</li>
          <li><strong>Excel:</strong> Enthält alle Reservationen der angezeigten Führungen mit ihrem Status, auch ausstehende, abgelaufene, stornierte und nicht einzeln zur Suche passende Reservationen.</li>
        </ul>
      </details>
      <AdminStats bookings={bookings} tours={tours} />

      <div className="admin-bookings__toolbar">
        <div className="admin-bookings__status">
          {newCount > 0 && (
            <span className="admin-badge admin-badge--new">{newCount} neue Reservationen (24h)</span>
          )}
          {lastUpdated && (
            <span className="admin-bookings__updated">
              Zuletzt aktualisiert um {formatTimestamp(lastUpdated)} · automatisch alle 30 Sekunden
            </span>
          )}
        </div>
        <div className="admin-bookings__actions">
          <button type="button" className="btn btn--outline" onClick={reload} disabled={loading}>
            {loading ? 'Wird aktualisiert …' : 'Aktualisieren'}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleExport}
            disabled={filtered.length === 0 || exporting}
          >
            {exporting ? 'Wird erstellt …' : 'Als Excel herunterladen'}
          </button>
        </div>
      </div>

      <div className="admin-filterbar">
        <label className="admin-schedule__search-label">
          Reservation finden: Name, Datum oder Kontakt
        <input
          type="search"
          className="admin-filterbar__search"
          placeholder="Suchen nach Name, E-Mail, Telefon oder Datum …"
          value={search}
          onChange={(e) => {
            const query = e.target.value;
            setSearch(query);
            if (query.trim()) setExpanded(new Set(schedule.filter((entry) => matchesSearch(entry, query)).map((entry) => entry.id)));
          }}
        />
        </label>
        <div className="admin-filterbar__chips" role="group" aria-label="Zeitraum filtern">
          <button
            type="button"
            className={timeFilter === 'upcoming' ? 'active' : ''}
            aria-pressed={timeFilter === 'upcoming'}
            onClick={() => setTimeFilter('upcoming')}
          >
            Kommende
          </button>
          <button
            type="button"
            className={timeFilter === 'all' ? 'active' : ''}
            aria-pressed={timeFilter === 'all'}
            onClick={() => setTimeFilter('all')}
          >
            Alle
          </button>
          <button
            type="button"
            className={timeFilter === 'past' ? 'active' : ''}
            aria-pressed={timeFilter === 'past'}
            onClick={() => setTimeFilter('past')}
          >
            Vergangen
          </button>
        </div>
      </div>
      <p className="admin-schedule__results" role="status">
        {filtered.length} {filtered.length === 1 ? 'Führung' : 'Führungen'} im gewählten Zeitraum{search.trim() ? ' passend zur Suche' : ''}. Die Suche zeigt jeweils die ganze Führung mit allen Reservationen.
      </p>

      {actionError && <p className="admin-error" role="alert">{actionError}</p>}
      {capacityDraft && (
        <p className="admin-schedule__draft-notice">
          Eine Platzanzahl wird bearbeitet. Sie wird erst mit «Speichern» übernommen.{' '}
          <button type="button" className="btn btn--outline btn--sm" disabled={saving} onClick={() => { setCapacityDraft(null); setActionError(''); }}>
            Platzänderung verwerfen
          </button>
        </p>
      )}

      <div className="admin-schedule__new">
        {showNewForm ? (
          <form className="card admin-schedule__new-form" onSubmit={handleCreateTour}>
            <div className="admin-tours__new-row">
              <label>
                Datum
                <input
                  type="date"
                  disabled={saving}
                  required
                  value={newTour.date}
                  onChange={(e) => setNewTour({ ...newTour, date: e.target.value })}
                />
              </label>
              <label>
                Uhrzeit
                <input
                  type="time"
                  disabled={saving}
                  required
                  value={newTour.time}
                  onChange={(e) => setNewTour({ ...newTour, time: e.target.value })}
                />
              </label>
              <label>
                Plätze insgesamt (Personen)
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  disabled={saving}
                  value={newTour.capacity}
                  onChange={(e) => setNewTour({ ...newTour, capacity: e.target.value })}
                />
              </label>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Wird gespeichert …' : 'Anlegen'}
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setShowNewForm(false)}
                disabled={saving}
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn btn--outline admin-schedule__new-btn"
            onClick={() => setShowNewForm(true)}
          >
            + Neue Führung anlegen
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="admin-empty">Keine Führungen gefunden.</p>
      ) : (
        <div className="admin-schedule__list">
          {filtered.map((tour) => {
            const isOpen = expanded.has(tour.id);
            const activeBookings = tour.bookings.filter(isActiveBooking);
            const confirmedCount = tour.bookings.filter((b) => b.status === 'confirmed').length;
            const pendingCount = tour.bookings.filter((b) => b.status === 'pending').length;
            const tourNewCount = tour.isCancelled ? 0 : tour.bookings.filter(isNewBooking).length;

            return (
              <div
                key={tour.id}
                className={`admin-schedule__item card${
                  tour.isCancelled ? ' admin-schedule__item--cancelled' : ''
                }`}
              >
                <button
                  type="button"
                  className="admin-schedule__header"
                  onClick={() => toggleExpand(tour.id)}
                  aria-expanded={isOpen}
                >
                  <span className="admin-schedule__chevron" aria-hidden="true">
                    {isOpen ? '▾' : '▸'}
                  </span>
                  <span className="admin-schedule__date">{formatDateLabel(tour.date)}</span>
                  <span className="admin-schedule__time">{tour.time} Uhr</span>
                  <span className="admin-schedule__count">
                    {tour.bookedCount} / {tour.capacity} Plätze belegt (inkl. vorläufig gehalten) · {confirmedCount} bestätigte Reservationen · {pendingCount} E-Mail-Bestätigungen ausstehend
                  </span>
                  {tourNewCount > 0 && (
                    <span className="admin-badge admin-badge--new">{tourNewCount} neu (24h)</span>
                  )}
                  <span
                    className={`admin-status-pill ${
                      tour.isCancelled ? 'admin-status-pill--cancelled' : 'admin-status-pill--ok'
                    }`}
                  >
                    {tour.isCancelled ? 'Storniert' : 'Aktiv'}
                  </span>
                </button>

                {isOpen && (
                  <div className="admin-schedule__details">
                    <div className="admin-schedule__tour-actions">
                      {capacityDraft?.id === tour.id ? (
                        <form className="admin-schedule__capacity-form" onSubmit={(e) => saveCapacity(e, tour)}>
                        <label className="admin-schedule__capacity-label">
                        Plätze insgesamt (Personen):{' '}
                        <input
                          type="number"
                          min={Math.max(1, tour.bookedCount)}
                          step={1}
                          required
                          disabled={saving}
                          value={capacityDraft.value}
                          className="admin-table__capacity-input"
                          onChange={(e) => setCapacityDraft({ id: tour.id, value: e.target.value })}
                        />
                        </label>
                        <span>Mindestens {Math.max(1, tour.bookedCount)} Plätze; {tour.bookedCount} bestätigt oder bis zur E-Mail-Bestätigung gehalten.</span>
                        <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
                          {saving ? 'Wird gespeichert …' : 'Speichern'}
                        </button>
                        <button type="button" className="btn btn--outline btn--sm" disabled={saving} onClick={() => { setCapacityDraft(null); setActionError(''); }}>Abbrechen</button>
                        </form>
                      ) : (
                        <button type="button" className="btn btn--outline btn--sm" disabled={saving || Boolean(capacityDraft)} onClick={() => { setActionError(''); setCapacityDraft({ id: tour.id, value: String(tour.capacity) }); }}>
                          Platzanzahl ändern
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        disabled={saving}
                        onClick={() => setPendingToggleTour(tour)}
                      >
                        {tour.isCancelled ? 'Führung reaktivieren' : 'Führung stornieren'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm btn--danger-outline"
                        onClick={() => setPendingDeleteTour(tour)}
                        disabled={saving}
                      >
                        Führung löschen
                      </button>
                    </div>

                    {tour.isCancelled && activeBookings.length > 0 && (
                      <p className="admin-error" role="status">
                        Diese Führung ist storniert. {activeBookings.length} aktive Reservationen bestehen noch ({confirmedCount} bestätigt, {pendingCount} E-Mail-Bestätigungen ausstehend).
                        Bitte die betroffenen Personen kontaktieren und die Reservationen einzeln klären.
                      </p>
                    )}

                    {tour.bookings.length === 0 ? (
                      <p className="admin-empty admin-empty--compact">
                        Noch keine Reservationen für diese Führung.
                      </p>
                    ) : (
                      <div className="admin-schedule__bookings">
                        {tour.bookings.map((b) => (
                          <div
                            key={b.id}
                            className={`admin-schedule__booking${
                              b.status === 'cancelled' ? ' admin-schedule__booking--cancelled' : ''
                            }`}
                          >
                            <div className="admin-schedule__booking-main">
                              <strong>{b.name}</strong>
                              {isNewBooking(b) && !tour.isCancelled && (
                                <span className="admin-badge admin-badge--new admin-badge--inline">
                                  Neu (24h)
                                </span>
                              )}
                              {b.is_school_class ? (
                                <span className="badge">Schulklasse</span>
                              ) : null}
                              <span className="admin-schedule__booking-size">
                                {b.group_size} {b.group_size === 1 ? 'Person' : 'Personen'}
                              </span>
                            </div>
                            <div className="admin-schedule__booking-contact">
                              <a href={`mailto:${b.email}`}>{b.email}</a>
                              {b.phone && <span> · <a href={`tel:${b.phone.replace(/[^+\d]/g, '')}`}>{b.phone}</a></span>}
                            </div>
                            {b.note && <p className="admin-schedule__booking-note">„{b.note}"</p>}
                            <div className="admin-schedule__booking-actions">
                              <span
                                className={`admin-status-pill ${
                                  b.status === 'confirmed' ? 'admin-status-pill--ok'
                                    : b.status === 'pending' ? 'admin-status-pill--pending'
                                      : b.status === 'cancelled' ? 'admin-status-pill--cancelled'
                                        : 'admin-status-pill--expired'
                                }`}
                              >
                                {BOOKING_STATUS_LABELS[b.status] || 'Unbekannter Status'}
                              </span>
                              {isActiveBooking(b) && (
                                <button
                                  type="button"
                                  className="btn btn--outline btn--sm btn--danger-outline"
                                  onClick={() => setPendingCancelBooking(b)}
                                  disabled={saving}
                                >
                                  {b.status === 'pending' ? 'Gehaltene Plätze freigeben' : 'Stornieren'}
                                </button>
                              )}
                            </div>
                            {b.status === 'pending' && Number.isFinite(b.verification_expires_at) && (
                              <p className="admin-schedule__booking-expiry">
                                Bestätigungsfrist: {new Date(b.verification_expires_at).toLocaleString('de-CH', {
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
                                })} Uhr (Schweizer Zeit). Danach werden die Plätze automatisch freigegeben.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>}

      <ConfirmDialog
        open={Boolean(pendingCancelBooking)}
        title={pendingCancelBooking?.status === 'pending' ? 'Gehaltene Plätze freigeben?' : 'Reservation stornieren?'}
        message={
          pendingCancelBooking
            ? `Die ${pendingCancelBooking.status === 'pending' ? 'noch nicht per E-Mail bestätigte' : 'bestätigte'} Reservation von ${pendingCancelBooking.name} für ${pendingCancelBooking.group_size} Personen am ${formatDateLabel(pendingCancelBooking.tour_date)} um ${pendingCancelBooking.tour_time} Uhr wird storniert. ${pendingCancelBooking.status === 'pending' ? 'Die vorläufig gehaltenen Plätze werden sofort freigegeben; die Reservation kann danach nicht mehr per E-Mail bestätigt werden.' : 'Die Plätze werden freigegeben.'} Das kann hier nicht rückgängig gemacht werden. Es wird KEINE automatische E-Mail versendet. Bitte informieren Sie die betroffene Person selbst.`
            : ''
        }
        confirmLabel={pendingCancelBooking?.status === 'pending' ? 'Ja, Plätze freigeben' : 'Ja, stornieren'}
        danger
        onConfirm={confirmCancelBooking}
        onCancel={() => setPendingCancelBooking(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingToggleTour)}
        title={pendingToggleTour?.isCancelled ? 'Führung reaktivieren?' : 'Führung stornieren?'}
        message={pendingToggleTour
          ? `Die Führung vom ${formatDateLabel(pendingToggleTour.date)} um ${pendingToggleTour.time} Uhr wird ${pendingToggleTour.isCancelled ? 'wieder zur Buchung freigegeben' : 'storniert und ist nicht mehr buchbar'}. ${bookings.filter((b) => b.tour_id === pendingToggleTour.id && isActiveBooking(b)).length} aktive Reservationen (bestätigt oder E-Mail-Bestätigung ausstehend) bleiben bestehen; ausstehende Bestätigungen verfallen weiterhin nach 30 Minuten. Es wird KEINE automatische E-Mail versendet. Bitte informieren Sie die betroffenen Personen selbst.`
          : ''}
        confirmLabel={pendingToggleTour?.isCancelled ? 'Ja, reaktivieren' : 'Ja, Führung stornieren'}
        danger={!pendingToggleTour?.isCancelled}
        onConfirm={confirmToggleTour}
        onCancel={() => setPendingToggleTour(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteTour)}
        title="Führung löschen?"
        message={
          pendingDeleteTour
            ? `Die Führung vom ${formatDateLabel(pendingDeleteTour.date)} um ${pendingDeleteTour.time} Uhr wird endgültig gelöscht. Das ist nur ohne bestätigte Reservationen und ohne ausstehende E-Mail-Bestätigungen möglich. Bereits stornierte und abgelaufene Reservationen werden ebenfalls gelöscht. Möchten Sie die Daten behalten, stornieren Sie stattdessen die Führung.`
            : ''
        }
        confirmLabel="Ja, löschen"
        danger
        onConfirm={confirmDeleteTour}
        onCancel={() => setPendingDeleteTour(null)}
      />
    </div>
  );
}

export default AdminSchedule;
