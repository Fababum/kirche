export const EVENT_START_DATE = '2027-03-17';
export const EVENT_END_DATE = '2027-03-28';
export const BOOKING_CUTOFF_HOURS = 48;
export const MIN_TOUR_PARTICIPANTS = 5;
export const MAX_TOUR_PARTICIPANTS = 12;
export const SCHOOL_RESERVED_DATE = '2027-03-17';
export const PUBLIC_TOUR_DATES = [
  '2027-03-18', '2027-03-19', '2027-03-20', '2027-03-21',
  '2027-03-25', '2027-03-26', '2027-03-27', '2027-03-28',
];
export const TOUR_START_TIMES = ['14:00', '15:00', '16:00', '17:00'];
// Zusätzliche Führungen: Samstag 10-12 Uhr, Freitag 19-21 Uhr.
export const EXTRA_TOUR_TIMES = {
  '2027-03-19': ['19:00', '20:00'],
  '2027-03-20': ['10:00', '11:00'],
  '2027-03-26': ['19:00', '20:00'],
  '2027-03-27': ['10:00', '11:00'],
};
// Bereits fest vergebene Führungen (öffentlich ausgebucht, mit Hinweis).
export const RESERVED_TOURS = [
  { date: '2027-03-20', time: '10:00', label: 'Fire mit de Chline Truttikon/Ossingen' },
  { date: '2027-03-20', time: '11:00', label: 'Fire mit de Chline Truttikon/Ossingen' },
];

export function tourTimesFor(date) {
  return [...(EXTRA_TOUR_TIMES[date] || []), ...TOUR_START_TIMES].sort();
}
