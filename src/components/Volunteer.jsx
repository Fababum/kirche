import { volunteerAreas } from '../data/content';
import './Volunteer.css';

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
                <a href={`tel:${area.contact.phone.replace(/\s/g, '')}`}>{area.contact.phone}</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Volunteer;
