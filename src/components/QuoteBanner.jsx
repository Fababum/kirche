import { eventInfo } from '../data/content';
import './QuoteBanner.css';

// Ein ruhiger Bild-Zwischenstopp mit der Original-Illustration des Osterwegs
// (leeres Grab, Lichtstrahlen) - lockert die reine Text/Karten-Abfolge auf
// und erinnert nochmal an die Kernaussage des Erlebnisses.
function QuoteBanner() {
  return (
    <section className="quote-banner" aria-label="Osterweg Illustration">
      <div className="container quote-banner__content">
        <p className="quote-banner__eyebrow">{eventInfo.dateRange}</p>
        <h2>{eventInfo.claim}</h2>
      </div>
    </section>
  );
}

export default QuoteBanner;
