import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import './LocationMap.css';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

// Eigene, schlanke Kartenkomponente. Nutzt MapTiler (klassischer OSM-Look,
// kostenlos bis 100'000 Kartenaufrufe/Monat - für diese Seite bei Weitem
// ausreichend) mit domain-beschränktem API-Key. Falls kein Key gesetzt ist
// (z.B. lokale Entwicklung ohne .env), fällt die Karte automatisch auf die
// schlichtere, aber garantiert schlüssellose Esri-"World Street Map"-Basemap
// zurück - so bleibt die Seite auch ohne Key funktionsfähig.
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

      if (MAPTILER_KEY) {
        L.tileLayer(
          `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
          { maxZoom: 20, tileSize: 512, zoomOffset: -1 }
        ).addTo(map);

        L.control
          .attribution({ prefix: false })
          .addAttribution(
            '© <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> Mitwirkende'
          )
          .addTo(map);
      } else {
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19 }
        ).addTo(map);

        L.control
          .attribution({ prefix: false })
          .addAttribution(
            'Kartendaten © <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> und Mitwirkende'
          )
          .addTo(map);
      }

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
