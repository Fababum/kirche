import { eventInfo } from '../data/content';
import './Hero.css';

function Hero() {
  return (
    <section id="top" className="hero">
      <div className="container hero__content">
        <p className="hero__date">
          {eventInfo.dateRange} · {eventInfo.location.zipCity.split(' ')[1]}
        </p>
        <h1>{eventInfo.claim}</h1>
        <p className="hero__intro">{eventInfo.intro}</p>
        <a href="#reservieren" className="btn btn--primary">
          Jetzt anmelden
        </a>
      </div>
    </section>
  );
}

export default Hero;
