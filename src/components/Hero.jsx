import { eventInfo } from '../data/content';
import './Hero.css';

function Hero({ children }) {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <img className="hero__art" src="/Hintergrund.jpg"
          alt="" width="2000" height="1332" fetchPriority="high" />
        <a className="hero__logo" href="https://www.kirche-wm.ch/" target="_blank" rel="noreferrer">
          <img src="/images/weinland-mitte-logo.svg"
            alt="Reformierte Kirche Weinland Mitte" width="709" height="140" />
        </a>
        <div className="hero__title">
          <h1 id="hero-title">{eventInfo.title}</h1>
          <div className="hero__date-splash">{eventInfo.dateRange}</div>
          <p>{eventInfo.claim}</p>
        </div>
        <a className="hero__discover" href="#entdecken">
          Den Osterweg entdecken
          <svg viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
            <path d="m1 1 5 5 5-5" />
          </svg>
        </a>
      </section>
      <div className="home-page__content">
        <section id="entdecken" className="event-location" aria-label="Datum und Veranstaltungsort">
          <div className="container">
            <p className="hero__date">{eventInfo.dateRange}</p>
            <p>
              {eventInfo.location.name}<br />
              {eventInfo.location.street}<br />
              {eventInfo.location.zipCity}
            </p>
          </div>
        </section>
        <section className="event-intro" aria-labelledby="intro-title">
          <div className="event-intro__copy">
            <h2 id="intro-title">Osterweg</h2>
            <p>{eventInfo.intro}</p>
            <p>Mit-leben, mit-fühlen und mit-gehen: Entdecke die Hoffnung der Ostergeschichte und erlebe Ostern mit allen Sinnen.</p>
            <p>Nach dem Rundgang: Zeit für ein Getränk und ein Gespräch im «Kafi i de Chile». Bitte beachte die Öffnungszeiten.</p>
          </div>
          <div className="event-intro__art" aria-hidden="true" />
        </section>
        {children}
      </div>
    </>
  );
}

export default Hero;
