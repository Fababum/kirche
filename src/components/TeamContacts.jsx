import { secretariat, eventInfo } from '../data/content';
import LocationMap from './LocationMap';
import './TeamContacts.css';

// Koordinaten des Kirchengebäudes, nicht des Strassenmittelpunkts.
const CHURCH_LAT = 47.6301075;
const CHURCH_LON = 8.7263536;
// Parkplätze an der Langenmooserstrasse (westlich/unterhalb der Kirche).
const PARKING_MARKERS = [
  { lat: 47.63040, lon: 8.72490, label: 'Parkplätze (signalisiert), Langenmooserstrasse', badge: 'P' },
];

function TeamContacts() {
  return (
    <section id="team" className="team-contacts" aria-labelledby="team-heading">
      <div className="team-contacts__content">
        <h2 id="team-heading">Ort und Kontakt</h2>

        <div className="team-contacts__columns">
          <section>
            <h3>{eventInfo.location.name}</h3>
            <p>
              {eventInfo.location.street}<br />
              {eventInfo.location.zipCity}
            </p>
          </section>

          <section>
            <h3>{secretariat.address.line1}</h3>
            <address>
              {secretariat.address.org}<br />
              {secretariat.address.street}, {secretariat.address.zipCity}<br />
              <a href={`mailto:${secretariat.email}`}>{secretariat.email}</a><br />
              <a href={`tel:${secretariat.phone.replace(/\s/g, '')}`}>{secretariat.phone}</a>
            </address>
          </section>
        </div>

        <div className="team-contacts__map">
          <LocationMap
            lat={CHURCH_LAT}
            lon={CHURCH_LON}
            label={`${eventInfo.location.name}, ${eventInfo.location.street}, ${eventInfo.location.zipCity}`}
            extraMarkers={PARKING_MARKERS}
          />
          <a
            className="team-contacts__map-link"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${CHURCH_LAT},${CHURCH_LON}`
            )}`}
            target="_blank"
            rel="noreferrer"
          >
            Route planen (Google Maps) →
          </a>
        </div>

      </div>
    </section>
  );
}

export default TeamContacts;
