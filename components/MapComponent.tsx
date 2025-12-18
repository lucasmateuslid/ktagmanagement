
import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocationHistory, Vehicle } from '../types';
import { storage } from '../services/storage';
import { Loader2, AlertCircle, Map as MapIcon, Navigation } from 'lucide-react';

declare const google: any;

// Coordenadas padrão atualizadas para o ponto específico solicitado
const RN_CENTER = { lat: -5.791008, lon: -35.208888 };

// Fix Leaflet Default Icon (Fallback)
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
}

const RecenterMap = ({ lat, lon }: { lat: number; lon: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
};

// --- GOOGLE MAPS CUSTOM RENDERER ---
const GoogleMapCanvas = ({ locations, isFleetMode, vehicles }: { locations: LocationHistory[], isFleetMode?: boolean, vehicles?: Vehicle[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [googleMap, setGoogleMap] = useState<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const polyRef = useRef<any | null>(null);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current && !googleMap && typeof google !== 'undefined' && google.maps) {
      const initialCenter = locations.length > 0 
        ? { lat: locations[0].lat, lng: locations[0].lon } 
        : { lat: RN_CENTER.lat, lng: RN_CENTER.lon };
        
      const map = new google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: 12,
        mapId: 'KTAG_PREMIUM_MAP', // Requires Google Cloud Map ID for advanced markers if used
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [
          { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#747474" }] },
          { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "visibility": "on" }, { "color": "#27272a" }, { "weight": 2 }] },
          { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }] },
          { "featureType": "landscape", "elementType": "all", "stylers": [{ "color": "#18181b" }] },
          { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
          { "featureType": "road", "elementType": "all", "stylers": [{ "saturation": -100 }, { "lightness": -70 }] },
          { "featureType": "transit", "elementType": "all", "stylers": [{ "visibility": "off" }] },
          { "featureType": "water", "elementType": "all", "stylers": [{ "color": "#09090b" }] }
        ]
      });
      setGoogleMap(map);
    }
  }, [googleMap, locations]);

  // Update Markers and Paths
  useEffect(() => {
    if (!googleMap) return;
    
    // Clear existing
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polyRef.current) polyRef.current.setMap(null);

    if (isFleetMode) {
        const bounds = new google.maps.LatLngBounds();
        locations.forEach(loc => {
            const vehicle = vehicles?.find(v => v.tagId === loc.tagId);
            const isStolen = vehicle?.status === 'stolen';
            const color = isStolen ? '#ef4444' : '#f59e0b';
            
            const marker = new google.maps.Marker({
                position: { lat: loc.lat, lng: loc.lon },
                map: googleMap,
                title: vehicle?.plate || 'Tag',
                icon: {
                    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                    fillColor: color,
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: "#ffffff",
                    scale: 2,
                    anchor: new google.maps.Point(12, 22)
                }
            });

            const content = `
                <div style="padding: 12px; font-family: sans-serif; min-width: 150px;">
                    <div style="font-weight: 800; font-size: 14px; color: #18181b; margin-bottom: 2px;">${vehicle?.plate || 'ID: ' + loc.tagId.slice(0,6)}</div>
                    <div style="font-size: 11px; color: #71717a; margin-bottom: 8px; text-transform: uppercase; font-weight: 600;">${vehicle?.model || 'Desconhecido'}</div>
                    <div style="height: 1px; background: #f4f4f5; margin: 8px 0;"></div>
                    <div style="display: flex; justify-content: space-between; font-size: 10px;">
                        <span style="color: #a1a1aa;">Confiança:</span>
                        <span style="color: #10b981; font-weight: 800;">${loc.conf}%</span>
                    </div>
                </div>
            `;
            
            const info = new google.maps.InfoWindow({ content });
            marker.addListener('click', () => info.open(googleMap, marker));
            markersRef.current.push(marker);
            bounds.extend(marker.getPosition());
        });
        
        if (locations.length > 0) {
          googleMap.fitBounds(bounds);
        } else {
          googleMap.setCenter({ lat: RN_CENTER.lat, lng: RN_CENTER.lon });
          googleMap.setZoom(12);
        }

    } else {
        // Single Tracking Mode
        if (locations.length > 0) {
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
            markersRef.current.push(marker);
            googleMap.panTo(marker.getPosition());

            const path = locations.map(l => ({ lat: l.lat, lng: l.lon }));
            const polyline = new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#f59e0b',
                strokeOpacity: 0.8,
                strokeWeight: 4,
            });
            polyline.setMap(googleMap);
            polyRef.current = polyline;
        } else {
            googleMap.setCenter({ lat: RN_CENTER.lat, lng: RN_CENTER.lon });
            googleMap.setZoom(12);
        }
    }
  }, [locations, googleMap, isFleetMode, vehicles]);

  return <div ref={mapRef} className="w-full h-full" />;
};

export const MapComponent: React.FC<MapProps> = ({ locations, isFleetMode = false, vehicles = [] }) => {
  const [provider, setProvider] = useState<'google' | 'osm' | 'mapbox'>('google');
  const [googleKey, setGoogleKey] = useState('');
  const [mapboxKey, setMapboxKey] = useState('');
  const [isScriptLoading, setIsScriptLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const settings = await storage.getSettings();
      if (settings.googleMapsKey) {
          setGoogleKey(settings.googleMapsKey);
          loadGoogleMaps(settings.googleMapsKey);
      } else {
          setProvider('osm'); // Fallback if no key
      }
      if (settings.mapboxKey) setMapboxKey(settings.mapboxKey);
    };
    init();
  }, []);

  const loadGoogleMaps = (key: string) => {
    if (typeof google !== 'undefined' && google.maps) {
      setProvider('google');
      return;
    }
    if (document.getElementById('google-maps-script')) return;

    setIsScriptLoading(true);
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => {
      setIsScriptLoading(false);
      setProvider('google');
    };
    document.head.appendChild(script);
  };

  const isGoogleReady = typeof google !== 'undefined' && google.maps;

  return (
    <div className="relative h-full w-full rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 z-0">
      
      {/* Dynamic Header Badge */}
      <div className="absolute top-4 left-4 z-[400] flex items-center gap-2">
          <div className="bg-zinc-900/90 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 backdrop-blur-md border border-white/10 shadow-xl">
             <div className={`w-2 h-2 rounded-full ${isScriptLoading ? 'bg-zinc-500 animate-pulse' : 'bg-primary-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`} />
             {provider.toUpperCase()} Engine
          </div>
      </div>

      {/* Provider Switcher */}
      <div className="absolute top-4 right-4 z-[400] bg-zinc-900/90 backdrop-blur-md p-1 rounded-xl shadow-2xl border border-white/10 flex gap-1">
          <button 
            onClick={() => setProvider('google')}
            className={`px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase ${provider === 'google' ? 'bg-primary-500 text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}
          >
            Google
          </button>
          <button 
            onClick={() => setProvider('osm')}
            className={`px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase ${provider === 'osm' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-400 hover:text-white'}`}
          >
            OSM
          </button>
      </div>

      {provider === 'google' && isGoogleReady ? (
        <GoogleMapCanvas locations={locations} isFleetMode={isFleetMode} vehicles={vehicles} />
      ) : provider === 'google' && isScriptLoading ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-primary-500 gap-4">
            <Loader2 size={48} className="animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest animate-pulse">Initializing K-TAG Maps...</span>
        </div>
      ) : (
        <MapContainer 
          center={locations.length > 0 ? [locations[0].lat, locations[0].lon] : [RN_CENTER.lat, RN_CENTER.lon]} 
          zoom={locations.length > 0 ? 15 : 12} 
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {!isFleetMode && locations.length > 0 && <RecenterMap lat={locations[0].lat} lon={locations[0].lon} />}
          {isFleetMode ? (
              locations.map((loc) => {
                  const vehicle = vehicles?.find(v => v.tagId === loc.tagId);
                  return (
                    <Marker key={loc.id} position={[loc.lat, loc.lon]}>
                        <Popup>
                            <div className="text-sm font-sans p-1">
                                <p className="font-bold text-zinc-900 uppercase">{vehicle?.plate || 'Tag'}</p>
                                <p className="text-[10px] text-zinc-500 mb-1">{vehicle?.model}</p>
                                <div className="h-px bg-zinc-100 my-1"/>
                                <p className="text-[10px] font-mono">{new Date(loc.timestamp).toLocaleTimeString()}</p>
                            </div>
                        </Popup>
                    </Marker>
                  )
              })
          ) : (
              <>
                {locations.length > 0 && (
                    <Marker position={[locations[0].lat, locations[0].lon]}>
                        <Popup>Última Posição</Popup>
                    </Marker>
                )}
                <Polyline positions={locations.map(l => [l.lat, l.lon] as [number, number])} color="#f59e0b" weight={5} opacity={0.7} />
              </>
          )}
        </MapContainer>
      )}
    </div>
  );
};
