// Erstellt eine echte, sauber formatierte Excel-Datei (.xlsx) aus der
// Reservationsliste - öffnet ohne Probleme in Excel/LibreOffice/Numbers,
// inkl. sinnvoller Spaltenbreiten, damit Nicht-Techniker die Datei direkt
// verwenden können.
// Die Bibliothek wird erst bei Bedarf (Klick auf "Excel herunterladen")
// nachgeladen, damit sie das normale Webseiten-Bundle nicht aufbläht.
export async function downloadBookingsExcel(bookings) {
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
    b.status === 'cancelled' ? 'Storniert' : 'Bestätigt',
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
    { wch: 12 }, // Status
    { wch: 30 }, // Notiz
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Reservationen');

  const filename = `reservationen-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
