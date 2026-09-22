import { volunteerAreas } from '../data/content';
import './Volunteer.css';

const HAS_DIGIT = /\d/;

function Volunteer() {
  return (
    <section id="mitarbeiten" className="section volunteer">
      <div className="container">
        <div className="section-heading">
          <h2>Mitmachen</h2>
        </div>

        <div className="volunteer__grid">
          {volunteerAreas.map((area) => (
            <div key={area.key} className="card volunteer__card">
              <h3>{area.title}</h3>
              <span className="badge">{area.period}</span>
              <p>{area.description}</p>
              <div className="volunteer__contact">
                <strong>{area.contact.name}</strong>
                {HAS_DIGIT.test(area.contact.phone) ? (
                  <a href={`tel:${area.contact.phone.replace(/\s/g, '')}`}>
                    {area.contact.phone}
                  </a>
                ) : (
                  <span className="volunteer__contact-pending">{area.contact.phone}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Volunteer;
