import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocationHistory, Vehicle } from '../types';
import { storage } from '../services/storage';
import { useTheme } from '../contexts/ThemeContext';
import { Map as MapIcon, Navigation } from 'lucide-react';

declare const google: any;

const RN_CENTER = { lat: -5.791008, lon: -35.208888 };

// Estilo Dark para Google Maps
const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#18181b" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#71717a" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#09090b" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#3f3f46" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#a1a1aa" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#27272a" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#18181b" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#020617" }] }
];

const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  locations: LocationHistory[];
  isFleetMode?: boolean; 
  vehicles?: Vehicle[];
  highlightedTagId?: string;
}

const RecenterMap = ({ lat, lon, zoom }: { lat: number; lon: number, zoom?: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom || map.getZoom(), { animate: true });
  }, [lat, lon, map, zoom]);
  return null;
};

const GoogleMapCanvas = ({ locations, isFleetMode, vehicles, highlightedTagId, theme }: { locations: LocationHistory[], isFleetMode?: boolean, vehicles?: Vehicle[], highlightedTagId?: string, theme: string }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [googleMap, setGoogleMap] = useState<any | null>(null);
  const markersRef = useRef<Record<string, any>>({});
  const polyRef = useRef<any | null>(null);

  useEffect(() => {
    if (mapRef.current && !googleMap && typeof google !== 'undefined' && google.maps) {
      const map = new google.maps.Map(mapRef.current, {
        center: locations.length > 0 ? { lat: locations[0].lat, lng: locations[0].lon } : { lat: RN_CENTER.lat, lng: RN_CENTER.lon },
        zoom: 12,
        styles: theme === 'dark' ? DARK_MAP_STYLE : [],
        disableDefaultUI: true,
        zoomControl: true
      });
      setGoogleMap(map);
    }
  }, [googleMap, theme]);

  useEffect(() => {
    if (googleMap) {
      googleMap.setOptions({ styles: theme === 'dark' ? DARK_MAP_STYLE : [] });
    }
  }, [theme, googleMap]);

  useEffect(() => {
    if (!googleMap) return;
    
    Object.values(markersRef.current).forEach((m: any) => m.setMap(null));
    markersRef.current = {};
    if (polyRef.current) polyRef.current.setMap(null);

    if (isFleetMode) {
        locations.forEach(loc => {
            const vehicle = vehicles?.find(v => v.tagId === loc.tagId);
            const isSelected = highlightedTagId === loc.tagId;
            
            const marker = new google.maps.Marker({
                position: { lat: loc.lat, lng: loc.lon },
                map: googleMap,
                zIndex: isSelected ? 1000 : 1,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: isSelected ? '#f59e0b' : '#71717a',
                    fillOpacity: 1,
                    strokeWeight: isSelected ? 4 : 2,
                    strokeColor: '#ffffff',
                    scale: isSelected ? 10 : 7,
                },
                title: vehicle?.plate
            });

            if (isSelected) {
                marker.setAnimation(google.maps.Animation.BOUNCE);
                setTimeout(() => marker.setAnimation(null), 2100);
                googleMap.panTo(marker.getPosition());
                if (googleMap.getZoom() < 15) googleMap.setZoom(16);
            }

            markersRef.current[loc.tagId] = marker;
        });
    } else if (locations.length > 0) {
        const latest = locations[0];
        const marker = new google.maps.Marker({
            position: { lat: latest.lat, lng: latest.lon },
            map: googleMap,
            icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: '#f59e0b',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#000',
                rotation: 0
            }
        });
        markersRef.current['latest'] = marker;
        googleMap.panTo(marker.getPosition());

        const path = locations.map(l => ({ lat: l.lat, lng: l.lon }));
        polyRef.current = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#f59e0b',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: googleMap
        });
    }
  }, [locations, googleMap, isFleetMode, vehicles, highlightedTagId]);

  return <div ref={mapRef} className="w-full h-full" />;
};

export const MapComponent: React.FC<MapProps> = ({ locations, isFleetMode = false, vehicles = [], highlightedTagId }) => {
  const { theme } = useTheme();
  const [provider, setProvider] = useState<'google' | 'osm'>('osm');
  const [isGoogleReady, setIsGoogleReady] = useState(false);

  useEffect(() => {
    const checkSettings = async () => {
      const settings = await storage.getSettings();
      if (settings.googleMapsKey) {
          loadGoogleMaps(settings.googleMapsKey);
      }
    };
    checkSettings();
  }, []);

  const loadGoogleMaps = (key: string) => {
    if (typeof google !== 'undefined') {
        setProvider('google');
        setIsGoogleReady(true);
        return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => { setProvider('google'); setIsGoogleReady(true); };
    document.head.appendChild(script);
  };

  const highlightedLoc = highlightedTagId ? locations.find(l => l.tagId === highlightedTagId) : null;

  return (
    <div className="relative h-full w-full rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
      {provider === 'google' && isGoogleReady ? (
        <GoogleMapCanvas locations={locations} isFleetMode={isFleetMode} vehicles={vehicles} highlightedTagId={highlightedTagId} theme={theme} />
      ) : (
        <MapContainer 
          center={highlightedLoc ? [highlightedLoc.lat, highlightedLoc.lon] : (locations.length > 0 ? [locations[0].lat, locations[0].lon] : [RN_CENTER.lat, RN_CENTER.lon])} 
          zoom={highlightedLoc ? 16 : 12} 
          style={{ height: "100%", width: "100%", background: theme === 'dark' ? '#09090b' : '#f4f4f5' }}
          className={theme === 'dark' ? 'leaflet-dark' : ''}
        >
          <TileLayer 
            url={theme === 'dark' 
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            } 
          />
          {highlightedLoc && <RecenterMap lat={highlightedLoc.lat} lon={highlightedLoc.lon} zoom={17} />}
          {isFleetMode ? (
              locations.map((loc) => {
                  const isSelected = highlightedTagId === loc.tagId;
                  const v = vehicles.find(v => v.tagId === loc.tagId);
                  return (
                    <Marker key={loc.id} position={[loc.lat, loc.lon]} opacity={isSelected ? 1 : 0.6}>
                        <Popup>
                            <div className="font-bold uppercase text-xs">{v?.plate || 'S/ PLACA'}</div>
                        </Popup>
                    </Marker>
                  )
              })
          ) : (
              <>
                {locations.length > 0 && <Marker position={[locations[0].lat, locations[0].lon]} />}
                <Polyline positions={locations.map(l => [l.lat, l.lon] as [number, number])} color="#f59e0b" weight={4} opacity={0.8} />
              </>
          )}
        </MapContainer>
      )}
      
      {/* Indicador de Engine */}
      <div className="absolute top-4 right-4 z-[400] bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[9px] font-black text-white uppercase tracking-widest shadow-xl">
        {provider} Engine
      </div>
    </div>
  );
};