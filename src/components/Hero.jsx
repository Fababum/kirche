import { eventInfo, kafi } from '../data/content';
import './Hero.css';

function Hero({ children }) {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <img className="hero__art" src="/Hintergrund.jpg"
          alt="" width="2000" height="1332" fetchPriority="high" />
        <div className="hero__title">
          <h1 id="hero-title">Osterweg <span>Wyland</span></h1>
          <p>{eventInfo.claim}</p>
        </div>
        <a className="hero__discover" href="#entdecken">
          Den Osterweg entdecken
          <span aria-hidden="true" />
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
            <p>Nach dem Rundgang: Zeit für ein Getränk und ein Gespräch im {kafi.name}. Bitte beachte die Öffnungszeiten.</p>
          </div>
          <div className="event-intro__art" aria-hidden="true" />
        </section>
        {children}
      </div>
    </>
  );
}

export default Hero;
