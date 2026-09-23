import { tourInfo, costsInfo, travelInfo, kafi, registrationInfo } from '../data/content';
import './InfoSection.css';

function Schedule({ title, rows, description }) {
  return (
    <section className="info-section__block">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      <dl className="info-section__schedule">
        {rows.map((row) => (
          <div className="info-section__schedule-row" key={row.days}>
            <dt>{row.days}</dt>
            <dd>{row.time}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function InfoSection() {
  return (
    <section id="informationen" className="info-section" aria-labelledby="informationen-heading">
      <div className="info-section__image" aria-hidden="true" />
      <div className="info-section__content">
        <h2 id="informationen-heading">Informationen</h2>

        <Schedule
          title={tourInfo.heading}
          rows={tourInfo.schedule}
          description={tourInfo.description}
        />
        <Schedule title={kafi.name} rows={kafi.hours} />

        <section className="info-section__block">
          <h3>{costsInfo.heading}</h3>
          <p>{costsInfo.text}</p>
          <p>{registrationInfo.accessibility}</p>
        </section>

        <section className="info-section__block">
          <h3>{travelInfo.heading}</h3>
          <p>{travelInfo.text}</p>
          {travelInfo.publicTransport && <p>{travelInfo.publicTransport}</p>}
        </section>
      </div>
    </section>
  );
}

export default InfoSection;
