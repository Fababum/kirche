import { useEffect } from 'react';
import { footerInfo, secretariat } from '../data/content';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './LegalPage.css';

function Datenschutz() {
  useEffect(() => {
    document.title = 'Datenschutz - Osterweg Wyland';
  }, []);

  return (
    <>
      <Header minimal />
      <main>
        <section className="section legal-page">
          <div className="container legal-page__content">
            <h1>Datenschutzerklärung</h1>
            <p className="legal-page__intro">
              Wir nehmen den Schutz deiner persönlichen Daten ernst. Diese Seite erklärt in
              einfachen Worten, welche Daten wir sammeln, wozu wir sie brauchen und wie lange
              wir sie aufbewahren.
            </p>

            <h2>Verantwortliche Stelle</h2>
            <p>
              {footerInfo.projectBy}
              <br />
              {secretariat.address.line1}, {secretariat.address.street}, {secretariat.address.zipCity}
              <br />
              E-Mail: <a href={`mailto:${secretariat.email}`}>{secretariat.email}</a>
            </p>
            <p>
              Diese Datenschutzerklärung richtet sich nach dem revidierten Schweizer
              Datenschutzgesetz (revDSG). Da wir hauptsächlich in der Schweiz tätig sind, ist
              primär Schweizer Recht anwendbar.
            </p>

            <h2>Welche Daten wir bei einer Reservation speichern</h2>
            <p>Wenn du einen Rundgang reservierst, speichern wir folgende Angaben:</p>
            <ul>
              <li>Name</li>
              <li>E-Mail-Adresse</li>
              <li>Telefonnummer (falls angegeben)</li>
              <li>Anzahl Personen und ob es sich um eine Schulklasse handelt</li>
              <li>Allfällige Bemerkung, die du im Formular hinterlässt</li>
            </ul>
            <p>
              Diese Angaben brauchen wir, um deine Reservation zu organisieren, dir eine
              Bestätigung zu senden und dich bei Fragen zu deinem Besuch zu kontaktieren. Die
              Bearbeitung erfolgt zur Erfüllung dieser Vereinbarung mit dir - eine gesonderte
              Einwilligung ist dafür nach Schweizer Recht nicht nötig, indem du das Formular
              ausfüllst und absendest, willigst du aber ausdrücklich in diese Verwendung ein.
            </p>

            <h2>Wie lange wir die Daten aufbewahren</h2>
            <p>
              Reservationsdaten werden nach Ende des Osterwegs Wyland 2027 gelöscht, sofern sie
              nicht aus organisatorischen Gründen (z.B. laufende Rückfragen) noch benötigt
              werden.
            </p>

            <h2>Weitergabe an Dritte & Auslandübermittlung</h2>
            <p>
              Für den Versand von Bestätigungs- und Benachrichtigungs-E-Mails nutzen wir den
              Dienst <a href="https://resend.com" target="_blank" rel="noreferrer">Resend</a>{' '}
              (Plus Five Five, Inc., USA). Deine E-Mail-Adresse und dein Name werden dafür in die{' '}
              <strong>USA</strong> übermittelt. Die USA gelten aus Schweizer Sicht nicht generell
              als Land mit angemessenem Datenschutzniveau; Resend sichert jedoch angemessene
              Schutzmassnahmen zu (u.a. Verschlüsselung der Übertragung, vertragliche
              Datenschutzverpflichtungen). Ausser für den technischen E-Mail-Versand geben wir
              deine Daten nicht an Dritte weiter und verkaufen sie nicht.
            </p>
            <p>
              Für die Standortkarte bei den Informationen zur Führung laden wir
              Kartenausschnitte von{' '}
              <a href="https://www.maptiler.com" target="_blank" rel="noreferrer">
                MapTiler AG
              </a>{' '}
              (Zug, Schweiz) auf Basis von Kartendaten von OpenStreetMap. Dabei wird deine
              IP-Adresse technisch bedingt an diesen Anbieter übermittelt, so wie beim Laden
              jeder externen Bildquelle. Es werden dabei keine Cookies gesetzt und keine
              Standortdaten von dir abgefragt - nur die Kartenansicht der Region wird geladen.
            </p>

            <h2>Cookies & Tracking</h2>
            <p>
              Diese Webseite verwendet <strong>keine</strong> Analyse- oder Werbe-Cookies und
              kein Tracking. Einzig im geschützten Admin-Bereich (<code>/admin</code>) wird ein
              technisch notwendiges Cookie gesetzt, um den Login-Zustand zu speichern. Dieses
              Cookie betrifft nur Mitarbeitende der Kirche, nicht normale Besucher:innen der
              Webseite.
            </p>
            <p>
              Beim ersten Besuch erscheint trotzdem ein kurzer Cookie-Hinweis, den du annehmen
              oder ablehnen kannst - deine Wahl wird nur lokal in deinem Browser gespeichert
              (<code>localStorage</code>), damit der Hinweis nicht bei jedem Besuch erneut
              erscheint.
            </p>

            <h2>Hosting</h2>
            <p>
              Diese Webseite und die Reservationsdaten werden auf Servern in der EU (Frankfurt)
              gehostet.
            </p>

            <h2>Datensicherheit</h2>
            <p>
              Die Übertragung zwischen deinem Gerät und unserem Server erfolgt verschlüsselt
              (HTTPS). Der Zugang zur Verwaltung (<code>/admin</code>) ist durch ein Passwort
              (sicher als Hash gespeichert, nicht im Klartext) geschützt und nur berechtigten
              Mitarbeitenden der Kirche zugänglich.
            </p>

            <h2>Deine Rechte</h2>
            <p>
              Nach Schweizer Datenschutzgesetz (revDSG) hast du insbesondere das Recht auf
              Auskunft über die zu deiner Person gespeicherten Daten sowie das Recht auf
              Berichtigung, Löschung oder Einschränkung der Bearbeitung deiner Daten. Auf
              Wunsch stellen wir dir deine Reservationsdaten auch in einem gängigen,
              elektronisch lesbaren Format zur Verfügung (Recht auf Datenherausgabe). Melde
              dich dazu einfach bei {secretariat.name} unter{' '}
              <a href={`mailto:${secretariat.email}`}>{secretariat.email}</a> oder{' '}
              <a href={`tel:${secretariat.phone.replace(/\s/g, '')}`}>{secretariat.phone}</a>.
            </p>
            <p>
              Solltest du der Meinung sein, dass wir deine Daten nicht rechtmässig bearbeiten,
              kannst du dich zudem beim{' '}
              <a
                href="https://www.edoeb.admin.ch"
                target="_blank"
                rel="noreferrer"
              >
                Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB)
              </a>{' '}
              beschweren.
            </p>

            <a href="/" className="legal-page__back">
              ← Zurück zur Webseite
            </a>

            <p className="legal-page__meta">Stand: September 2026</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default Datenschutz;
