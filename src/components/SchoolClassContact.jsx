import { secretariat } from '../data/content';

function SchoolClassContact() {
  return (
    <>
      Schulklassen: Für Anmeldung und Fragen bitte an{' '}
      <a href={`mailto:${secretariat.email}`}>{secretariat.name}</a> wenden.
    </>
  );
}

export default SchoolClassContact;
