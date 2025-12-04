
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocationHistory } from '../types';
import { storage } from '../services/storage';

// Declare google globally to avoid type errors
declare const google: any;

// Fix Leaflet Default Icon
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  locations: LocationHistory[];
}

const RecenterMap = ({ lat, lon }: { lat: number; lon: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
};

// Google Maps Wrapper
const GoogleMapCanvas = ({ locations }: { locations: LocationHistory[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [googleMap, setGoogleMap] = useState<any | null>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [poly, setPoly] = useState<any | null>(null);

  useEffect(() => {
    if (mapRef.current && !googleMap) {
      if ((window as any).google) {
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: locations[0]?.lat || 40.7128, lng: locations[0]?.lon || -74.006 },
          zoom: 13,
        });
        setGoogleMap(map);
      } else {
        console.error("Google Maps API not loaded");
      }
    }
  }, [googleMap, locations]);

  useEffect(() => {
    if (!googleMap) return;
    
    // Clear old
    markers.forEach(m => m.setMap(null));
    if (poly) poly.setMap(null);

    const newMarkers: any[] = [];
    
    // Add Latest Marker
    if (locations.length > 0) {
      const latest = locations[0];
      const marker = new google.maps.Marker({
        position: { lat: latest.lat, lng: latest.lon },
        map: googleMap,
        title: "Latest Position"
      });
      googleMap.setCenter({ lat: latest.lat, lng: latest.lon });
      newMarkers.push(marker);
    }

    // Polyline
    const path = locations.map(l => ({ lat: l.lat, lng: l.lon }));
    const polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#2563eb',
      strokeOpacity: 1.0,
      strokeWeight: 4,
    });
    polyline.setMap(googleMap);
    setPoly(polyline);
    setMarkers(newMarkers);

  }, [locations, googleMap]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
};

export const MapComponent: React.FC<MapProps> = ({ locations }) => {
  const [provider, setProvider] = useState<'osm' | 'google' | 'mapbox'>('osm');
  const [googleKey, setGoogleKey] = useState('');
  const [mapboxKey, setMapboxKey] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    const init = async () => {
      const settings = await storage.getSettings();
      if (settings.googleMapsKey) setGoogleKey(settings.googleMapsKey);
      if (settings.mapboxKey) setMapboxKey(settings.mapboxKey);
    };
    init();
  }, []);

  const loadGoogleMaps = () => {
    if (!googleKey) return alert("Please enter a Google Maps API Key in Settings");
    if ((window as any).google) return setProvider('google');

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}`;
    script.async = true;
    script.onload = () => {
      setScriptLoaded(true);
      setProvider('google');
    };
    document.head.appendChild(script);
  };

  const loadMapbox = () => {
    if (!mapboxKey) return alert("Please enter a Mapbox Access Token in Settings");
    setProvider('mapbox');
  }

  const centerPosition: [number, number] = locations.length > 0 
    ? [locations[0].lat, locations[0].lon] 
    : [40.7128, -74.0060];

  const polylinePositions = locations.map(l => [l.lat, l.lon] as [number, number]);

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-slate-100 z-0">
      
      {/* Provider Switcher - Lowered Z-Index to allow modals to be on top */}
      <div className="absolute top-4 right-4 z-[400] bg-white dark:bg-slate-900 p-2 rounded-lg shadow-md flex flex-col gap-2 max-w-[200px]">
        <div className="flex gap-1 text-xs">
          <button 
            onClick={() => setProvider('osm')}
            className={`flex-1 px-2 py-1 rounded ${provider === 'osm' ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
          >
            OSM
          </button>
          <button 
            onClick={() => { if(scriptLoaded || googleKey) loadGoogleMaps(); }}
            className={`flex-1 px-2 py-1 rounded ${provider === 'google' ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-slate-800'} ${(provider !== 'google' && !scriptLoaded && !googleKey) ? 'opacity-50' : ''}`}
          >
            Google
          </button>
          <button 
            onClick={loadMapbox}
            className={`flex-1 px-2 py-1 rounded ${provider === 'mapbox' ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-slate-800'} ${(provider !== 'mapbox' && !mapboxKey) ? 'opacity-50' : ''}`}
          >
            Mapbox
          </button>
        </div>
      </div>

      {provider !== 'google' ? (
        <MapContainer 
          center={centerPosition} 
          zoom={13} 
          scrollWheelZoom={true} 
          style={{ height: "100%", width: "100%" }}
        >
          {provider === 'osm' && (
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}

          {provider === 'mapbox' && (
            <TileLayer
              attribution='&copy; Mapbox'
              url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxKey}`}
              tileSize={512}
              zoomOffset={-1}
            />
          )}

          {locations.length > 0 && <RecenterMap lat={locations[0].lat} lon={locations[0].lon} />}
          {locations.length > 0 && (
            <Marker position={[locations[0].lat, locations[0].lon]}>
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">Latest Position</p>
                  <p>Conf: {locations[0].conf}%</p>
                </div>
              </Popup>
            </Marker>
          )}
          <Polyline positions={polylinePositions} color="blue" weight={4} opacity={0.6} />
        </MapContainer>
      ) : (
        <GoogleMapCanvas locations={locations} />
      )}
    </div>
  );
};
