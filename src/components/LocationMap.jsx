import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import './LocationMap.css';

// Eigene, schlanke Kartenkomponente. Nutzt die CARTO-Basemaps (kostenlos,
// explizit für den produktiven Einsatz gedacht - im Gegensatz zum
// öffentlichen tile.openstreetmap.org-Server, der solche Nutzung sperrt,
// siehe https://operations.osmfoundation.org/policies/tiles/). Kartendaten
// bleiben OpenStreetMap, nur die Kacheln werden von CARTO ausgeliefert.
function LocationMap({ lat, lon, label }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Standard-Marker-Icons müssen manuell verdrahtet werden, da Vite die
      // Bild-Pfade von Leaflet sonst nicht automatisch findet.
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
      });

      const map = L.map(containerRef.current, {
        center: [lat, lon],
        zoom: 15,
        scrollWheelZoom: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Nur die rechtlich vorgeschriebene Attribution, keine Zusatz-Links.
      L.control
        .attribution({ prefix: false })
        .addAttribution(
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> Mitwirkende · © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'
        )
        .addTo(map);

      L.marker([lat, lon]).addTo(map).bindPopup(label);

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lon, label]);

  return <div ref={containerRef} className="location-map" role="img" aria-label={label} />;
}

export default LocationMap;
