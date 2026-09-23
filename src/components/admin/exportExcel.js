export const BOOKING_STATUS_LABELS = {
  pending: 'E-Mail-Bestätigung ausstehend',
  confirmed: 'Bestätigt',
  cancelled: 'Storniert',
  expired: 'Nicht bestätigt / abgelaufen',
};

// Erstellt eine echte, sauber formatierte Excel-Datei (.xlsx) aus der
// Reservationsliste - öffnet ohne Probleme in Excel/LibreOffice/Numbers,
// inkl. sinnvoller Spaltenbreiten, damit Nicht-Techniker die Datei direkt
// verwenden können.
// Die Bibliothek wird erst bei Bedarf (Klick auf "Excel herunterladen")
// nachgeladen, damit sie das normale Webseiten-Bundle nicht aufbläht.
export async function downloadBookingsExcel(bookings, tour = null) {
  const XLSX = await import('xlsx');
  const headers = [
    'Datum',
    'Zeit',
    'Name',
    'E-Mail',
    'Telefon',
    'Personen',
    'Schulklasse',
    'Status',
    'Notiz',
  ];

  const rows = bookings.map((b) => [
    b.tour_date,
    b.tour_time,
    b.name,
    b.email,
    b.phone || '',
    b.group_size,
    b.is_school_class ? 'Ja' : 'Nein',
    BOOKING_STATUS_LABELS[b.status] || 'Unbekannter Status',
    b.note || '',
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Sinnvolle Spaltenbreiten, damit nichts abgeschnitten wird.
  sheet['!cols'] = [
    { wch: 12 }, // Datum
    { wch: 8 }, // Zeit
    { wch: 22 }, // Name
    { wch: 26 }, // E-Mail
    { wch: 14 }, // Telefon
    { wch: 10 }, // Personen
    { wch: 12 }, // Schulklasse
    { wch: 32 }, // Status
    { wch: 30 }, // Notiz
  ];

  const workbook = XLSX.utils.book_new();
  if (tour) {
    const overview = XLSX.utils.aoa_to_sheet([
      ['Führung', 'Osterweg Wyland'],
      ['Datum', tour.date],
      ['Uhrzeit', tour.time],
      ['Plätze insgesamt', tour.capacity],
      ['Belegt (inkl. vorläufig gehalten)', tour.bookedCount],
      ['Status', tour.isCancelled ? 'Storniert' : tour.bookedCount >= tour.capacity ? 'Voll' : 'Aktiv'],
      ['Reservationen', bookings.length],
    ]);
    overview['!cols'] = [{ wch: 34 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, overview, 'Führung');
  }
  XLSX.utils.book_append_sheet(workbook, sheet, 'Reservationen');

  const filename = tour
    ? `fuehrung-${tour.date}-${tour.time.replace(':', '-')}-${tour.id}.xlsx`
    : `reservationen-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
