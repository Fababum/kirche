import { downloadSection } from '../data/content';
import './FlyerBanner.css';

function FlyerBanner() {
  return (
    <section className="flyer-banner" aria-label="Flyer herunterladen">
      <div className="container flyer-banner__content">
        <h2>Download<br />{downloadSection.heading}</h2>
        <p className="flyer-banner__text">{downloadSection.text}</p>
        <a href={downloadSection.linkHref} download className="btn btn--primary flyer-banner__btn">
          {downloadSection.linkLabel}
        </a>
      </div>
    </section>
  );
}

export default FlyerBanner;
