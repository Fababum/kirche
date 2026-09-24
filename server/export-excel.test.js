import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { downloadBookingsExcel } from '../src/components/admin/exportExcel.js';

test('single-tour Excel contains contact details, statuses and legacy bookings without phone', async (t) => {
  let output;
  t.mock.method(fs, 'writeFileSync', (filename, data) => {
    output = { filename, data };
  });
  const tour = { id: 7, date: '2027-03-17', time: '14:00', capacity: 15, bookedCount: 2, isCancelled: false };
  const bookings = ['confirmed', 'pending', 'cancelled', 'expired'].map((status, index) => ({
    tour_id: tour.id, tour_date: tour.date, tour_time: tour.time,
    name: `Visitor ${index}`, email: `visitor${index}@example.test`,
    phone: index === 0 ? '+41 79 123 45 67' : null,
    group_size: 1, is_school_class: 0, status, note: null,
  }));

  await downloadBookingsExcel(bookings, tour);

  assert.equal(output.filename, 'fuehrung-2027-03-17-14-00-7.xlsx');
  const workbook = XLSX.read(output.data, { type: 'buffer' });
  assert.deepEqual(workbook.SheetNames, ['Reservationen', 'Führung']);
  assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets.Reservationen, { header: 1 })[0],
    ['Datum', 'Zeit', 'Name', 'E-Mail', 'Telefon', 'Personen', 'Schulklasse', 'Status', 'Notiz']);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Reservationen);
  assert.equal(rows.length, bookings.length);
  for (const [index, booking] of bookings.entries()) {
    assert.equal(rows[index].Name, booking.name);
    assert.equal(rows[index]['E-Mail'], booking.email);
    assert.equal(rows[index].Telefon, booking.phone || '');
    assert.equal(rows[index].Datum, tour.date);
    assert.equal(rows[index].Zeit, tour.time);
  }
  assert.deepEqual(rows.map((row) => row.Status), [
    'Bestätigt', 'E-Mail-Bestätigung ausstehend', 'Storniert', 'Nicht bestätigt / abgelaufen',
  ]);
  const overview = XLSX.utils.sheet_to_json(workbook.Sheets['Führung'], { header: 1 });
  assert.ok(overview.some(([label, value]) => label === 'Reservationen' && value === 4));
  await downloadBookingsExcel(bookings);
  const all = XLSX.read(output.data, { type: 'buffer' });
  assert.deepEqual(XLSX.utils.sheet_to_json(all.Sheets.Reservationen), rows);
});
