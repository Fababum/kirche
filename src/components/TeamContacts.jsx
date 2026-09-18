import { teamContacts, secretariat } from '../data/content';
import './TeamContacts.css';

function TeamContacts() {
  return (
    <section id="team" className="section team-contacts">
      <div className="container">
        <div className="section-heading">
          <h2>Kontakt</h2>
        </div>

        <div className="card team-contacts__secretariat">
          <h3>{secretariat.address.line1}</h3>
          <p>
            {secretariat.address.street}, {secretariat.address.zipCity}
          </p>
          <p>
            <a href={`tel:${secretariat.phone.replace(/\s/g, '')}`} className="btn btn--primary">
              {secretariat.phone}
            </a>
          </p>
        </div>

        <details className="team-contacts__more">
          <summary>Weitere Ansprechpersonen</summary>
          <div className="team-contacts__list">
            {teamContacts.map((person) => (
              <div key={person.name} className="team-contacts__row">
                <span className="team-contacts__name">{person.name}</span>
                <a href={`tel:${person.phone.replace(/\s/g, '')}`}>{person.phone}</a>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

export default TeamContacts;
