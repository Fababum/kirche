// ============================================================================
// Kleiner Fetch-Wrapper für die Kommunikation mit dem Backend.
// Nutzt Vite-Proxy (/api -> Server), daher relative Pfade.
// ============================================================================

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = body?.error || `Fehler (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return body;
}

export const api = {
  getTours: (from, to) => request(`/tours?from=${from}&to=${to}`),
  createBooking: (data) =>
    request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  confirmBooking: (token) =>
    request('/bookings/confirm', { method: 'POST', body: JSON.stringify({ token }) }),

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
