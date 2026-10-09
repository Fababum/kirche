import { volunteerAreas } from '../data/content';
import './Volunteer.css';

const HAS_DIGIT = /\d/;

function Volunteer() {
  return (
    <section id="mitarbeiten" className="section section--gold volunteer">
      <div className="container">
        <div className="section-heading">
          <h2>Mitarbeiten und Teil davon werden</h2>
          <p>Melde dich direkt bei der zuständigen Kontaktperson.</p>
        </div>

        <div className="volunteer__grid">
          {volunteerAreas.map((area) => (
            <div key={area.key} className="card volunteer__card">
              <h3>{area.title}</h3>
              {area.period && <span className="badge">{area.period}</span>}
              <p>{area.description}</p>
              {area.contacts.length > 0 && (
              <div className="volunteer__contact">
                <span>Kontakt</span>
                {area.contacts.map((contact) => (
                  <div key={contact.name} className="volunteer__contact-person">
                    <strong>{contact.name}</strong>
                    {!contact.phone ? null : HAS_DIGIT.test(contact.phone) ? (
                      <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
                    ) : (
                      <span className="volunteer__contact-pending">{contact.phone}</span>
                    )}
                    {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                  </div>
                ))}
              </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Volunteer;
