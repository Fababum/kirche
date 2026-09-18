import { tourInfo, costsInfo, travelInfo, secretariat, kafi } from '../data/content';
import './InfoSection.css';

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

function IconClock() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function IconCup() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 8h11v5.5A4.5 4.5 0 0 1 11.5 18h-2A4.5 4.5 0 0 1 5 13.5z" />
      <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 4.5c0 .9-1 .9-1 1.8M11.5 4.5c0 .9-1 .9-1 1.8" />
    </svg>
  );
}

function IconCoin() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 14.2c.4.7 1.3 1.1 2.5 1.1 1.6 0 2.6-.7 2.6-1.8 0-2.3-5.2-.8-5.2-3.2 0-1.1 1-1.8 2.6-1.8 1.2 0 2.1.4 2.5 1.1M12 7.7v1M12 15.3v1" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 4.5h3l1.3 3.6-2 1.8a11.5 11.5 0 0 0 5.8 5.8l1.8-2 3.6 1.3v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 4.5 6.1 1.5 1.5 0 0 1 6 4.5Z" />
    </svg>
  );
}

function ScheduleCard({ icon, title, rows }) {
  return (
    <div className="card info-section__card">
      <div className="info-section__card-head">
        <span className="info-section__icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="info-section__rows">
        {rows.map((row) => (
          <div className="info-section__row" key={row.days}>
            <span className="info-section__row-label">{row.days}</span>
            <span className="info-section__row-leader" aria-hidden="true" />
            <span className="info-section__row-value">{row.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FactCard({ icon, title, children }) {
  return (
    <div className="card info-section__card">
      <div className="info-section__card-head">
        <span className="info-section__icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <p className="info-section__fact-text">{children}</p>
    </div>
  );
}

function InfoSection() {
  return (
    <section id="informationen" className="section section--alt info-section">
      <div className="container">
        <div className="section-heading">
          <h2>Gut zu wissen</h2>
        </div>

        <div className="info-section__schedules">
          <ScheduleCard icon={<IconClock />} title={tourInfo.heading} rows={tourInfo.schedule} />
          <ScheduleCard icon={<IconCup />} title={kafi.name} rows={kafi.hours} />
        </div>

        <div className="info-section__facts">
          <FactCard icon={<IconCoin />} title={costsInfo.heading}>
            {costsInfo.text}
          </FactCard>

          <FactCard icon={<IconPin />} title={travelInfo.heading}>
            {travelInfo.text}
          </FactCard>

          <FactCard icon={<IconPhone />} title={secretariat.heading}>
            {secretariat.name}
            <br />
            <a href={`tel:${secretariat.phone.replace(/\s/g, '')}`}>{secretariat.phone}</a>
          </FactCard>
        </div>
      </div>
    </section>
  );
}

export default InfoSection;
