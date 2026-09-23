import { useEffect } from 'react';
import { footerInfo, secretariat, eventInfo } from '../data/content';
import Footer from '../components/Footer';
import './LegalPage.css';

function Impressum() {
  useEffect(() => {
    document.title = 'Impressum - Osterweg Wyland';
  }, []);

  return (
    <div className="home-page legal-shell">
      <header className="legal-shell__header">
        <a href="/" className="legal-shell__wordmark">{eventInfo.title}</a>
        <a href="/" className="legal-shell__back">← Zurück zur Webseite</a>
      </header>
      <main className="legal-shell__main">
        <section className="section legal-page" aria-labelledby="legal-title">
          <div className="container legal-page__content">
            <p className="legal-page__eyebrow">Rechtliches</p>
            <h1 id="legal-title">Impressum</h1>
            <nav className="legal-page__nav" aria-label="Rechtliche Seiten">
              <a href="/impressum" aria-current="page">Impressum</a>
              <a href="/datenschutz">Datenschutz</a>
            </nav>

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
    </div>
  );
}

export default Impressum;
