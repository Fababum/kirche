import { secretariat } from '../data/content';

function SchoolClassContact() {
  return (
    <>
      Schulklassen: Für Anmeldung und Fragen bitte an{' '}
      <a href={`mailto:${secretariat.email}`}>{secretariat.name}</a> wenden.
    </>
  );
}

// Gleicher Stil wie die Schulklassen-Zeile, mit Link zum Sekretariat.
export function GroupsContact() {
  return (
    <>
      Ausserhalb der Öffnungszeiten: Gruppen meldet euch beim{' '}
      <a href={`mailto:${secretariat.email}`}>{secretariat.name}</a>.
    </>
  );
}

export default SchoolClassContact;
