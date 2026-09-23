import './Intro.css';

function Intro() {
  return (
    <section className="intro" aria-label="Willkommen beim Osterweg Wyland">
      <div className="intro__panel intro__panel--first">
        <img
          className="intro__image"
          src="/Internetseite%202.jpg"
          alt="Osterweg Wyland. Melde dich an: Kirche Truttikon, 17. bis 28. März. Illustration mit drei Kreuzen und dem offenen Grab."
          width="595"
          height="420"
          fetchPriority="high"
        />
        <div className="intro__controls">
          <p>Weiterscrollen oder nach oben wischen</p>
          <a href="#top">Direkt zur Webseite</a>
        </div>
      </div>

      <div className="intro__panel intro__panel--second" id="intro-details">
        <img
          className="intro__image"
          src="/Internetseite%2022.jpg"
          alt="Ostern erleben mit allen Sinnen. Tauche ein in eine andere Zeit! Ein Guide nimmt dich mit auf eine Zeitreise ins Ostergeschehen vor 2000 Jahren. Für Einzelpersonen, Familien, Gruppen, Schul- und Untiklassen. Stündliche Gruppenführungen, Dauer 45 Minuten. Online-Anmeldung notwendig. Kollekte zur Deckung der Unkosten. Ein Projekt der reformierten Kirche Weinland Mitte."
          width="595"
          height="420"
        />
        <div className="intro__controls">
          <p>Weiter zur Reservation und allen Informationen</p>
          <a href="#top">Zur Webseite</a>
        </div>
      </div>
    </section>
  );
}

export default Intro;
