import { downloadSection } from '../data/content';
import './FlyerBanner.css';

// Bild-Banner direkt nach der Reservierung, analog zum QuoteBanner-Stil -
// macht den Flyer-Download prominent sichtbar, statt ihn nur klein im
// Footer zu verstecken.
function FlyerBanner() {
  return (
    <section className="flyer-banner" aria-label="Flyer herunterladen">
      <div className="container flyer-banner__content">
        <p className="flyer-banner__eyebrow">{downloadSection.heading}</p>
        <h2>{downloadSection.title}</h2>
        <p className="flyer-banner__text">{downloadSection.text}</p>
        <a href={downloadSection.linkHref} download className="btn btn--primary flyer-banner__btn">
          {downloadSection.linkLabel}
        </a>
      </div>
    </section>
  );
}

export default FlyerBanner;
