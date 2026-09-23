// ============================================================================
// Kleiner Fetch-Wrapper für die Kommunikation mit dem Backend.
// Nutzt Vite-Proxy (/api -> Server), daher relative Pfade.
// ============================================================================

const unclearOutcome = 'Der Ausgang der Anfrage ist unklar. Möglicherweise wurde die Änderung bereits ausgeführt. Bitte nicht einfach erneut buchen: Prüfe dein E-Mail-Postfach (auch den Spamordner) oder kontaktiere das Sekretariat, um eine doppelte Reservation zu vermeiden.';

function isPublicTour(tour) {
  return tour !== null && typeof tour === 'object' && !Array.isArray(tour)
    && Number.isSafeInteger(tour.id) && tour.id > 0
    && typeof tour.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tour.date)
    && Number.isFinite(Date.parse(`${tour.date}T00:00:00Z`))
    && new Date(`${tour.date}T00:00:00Z`).toISOString().slice(0, 10) === tour.date
    && typeof tour.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(tour.time)
    && Number.isSafeInteger(tour.capacity) && tour.capacity >= 0
    && Number.isSafeInteger(tour.bookedCount) && tour.bookedCount >= 0
    && Number.isSafeInteger(tour.freeSpots)
    && tour.freeSpots === Math.max(0, tour.capacity - tour.bookedCount)
    && tour.isFull === (tour.bookedCount >= tour.capacity)
    && typeof tour.isBookingClosed === 'boolean'
    && typeof tour.bookingClosesAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(tour.bookingClosesAt)
    && Number.isFinite(Date.parse(tour.bookingClosesAt))
    && new Date(`${tour.bookingClosesAt.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === tour.bookingClosesAt.slice(0, 10);
}

async function request(path, options = {}, validate = () => true) {
  const isMutation = options.method && options.method !== 'GET';
  let res;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error(isMutation ? unclearOutcome : 'Verbindung zum Server fehlgeschlagen. Bitte später erneut versuchen.');
  }

  let body = null;
  try {
    if (res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'application/json') {
      body = await res.json();
    }
  } catch {
    // Keep HTTP errors actionable even when a proxy or interrupted body is not JSON.
  }

  if (!res.ok) {
    const message = typeof body?.error === 'string' && body.error.trim() ? body.error : `Fehler (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  if (body === null || typeof body !== 'object' || !validate(body)) {
    throw new Error(isMutation ? unclearOutcome : 'Ungültige Antwort vom Server. Bitte später erneut versuchen.');
  }

  return body;
}

export const api = {
  getTours: (from, to) => request(`/tours?from=${from}&to=${to}`, {},
    (body) => Array.isArray(body) && body.every(isPublicTour)),
  createBooking: (data) =>
    request('/bookings', { method: 'POST', body: JSON.stringify(data) },
      (body) => body.status === 'pending' && Number.isSafeInteger(body.id) && body.id > 0),
  confirmBooking: (token) =>
    request('/bookings/confirm', { method: 'POST', body: JSON.stringify({ token }) },
      (body) => body.status === 'confirmed'),

  // Admin
  login: (username, password) =>
    request('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/admin/logout', { method: 'POST' }),
  me: () => request('/admin/me'),
  getAdminTours: () => request('/admin/tours'),
  createTour: (data) => request('/admin/tours', { method: 'POST', body: JSON.stringify(data) }),
  updateTour: (id, data) =>
    request(`/admin/tours/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTour: (id) => request(`/admin/tours/${id}`, { method: 'DELETE' }),
  getBookings: () => request('/admin/bookings'),
  updateBooking: (id, data) =>
    request(`/admin/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
