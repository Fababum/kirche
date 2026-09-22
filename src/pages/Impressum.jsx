import { useEffect } from 'react';
import { footerInfo, secretariat, eventInfo } from '../data/content';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './LegalPage.css';

function Impressum() {
  useEffect(() => {
    document.title = 'Impressum - Osterweg Wyland';
  }, []);

  return (
    <>
      <Header minimal />
      <main>
        <section className="section legal-page">
          <div className="container legal-page__content">
            <h1>Impressum</h1>

            <h2>Verantwortlich für diese Webseite</h2>
            <p>
              {footerInfo.projectBy}
              <br />
              {secretariat.address.line1}
              <br />
              {secretariat.address.street}
              <br />
              {secretariat.address.zipCity}
            </p>

            <h2>Kontakt</h2>
            <p>
              {secretariat.name} ({secretariat.heading})
              <br />
              Telefon: <a href={`tel:${secretariat.phone.replace(/\s/g, '')}`}>{secretariat.phone}</a>
              <br />
              E-Mail: <a href={`mailto:${secretariat.email}`}>{secretariat.email}</a>
            </p>

            <h2>Veranstaltung</h2>
            <p>
              {eventInfo.title}
              <br />
              {eventInfo.dateRange}
              <br />
              {eventInfo.location.name}, {eventInfo.location.street}, {eventInfo.location.zipCity}
            </p>

            <h2>Haftungsausschluss</h2>
            <p>
              Wir bemühen uns um korrekte und aktuelle Informationen auf dieser Webseite,
              übernehmen jedoch keine Gewähr für deren Richtigkeit, Vollständigkeit und
              Aktualität. Änderungen (z.B. bei Öffnungszeiten oder Terminen) sind jederzeit
              möglich.
            </p>

            <h2>Urheberrecht</h2>
            <p>
              Texte, Bilder und Grafiken auf dieser Webseite sind urheberrechtlich geschützt.
              Eine Verwendung ausserhalb dieser Webseite bedarf der vorherigen Zustimmung durch{' '}
              {footerInfo.projectBy}.
            </p>

            <a href="/" className="legal-page__back">
              ← Zurück zur Webseite
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default Impressum;
