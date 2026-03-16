
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Search, Loader2, AlertTriangle } from 'lucide-react';
import { backendApi } from '../services/backendApi';
import { storage } from '../services/storage';

declare var google: any;

interface LocationPickerProps {
  onLocationSelect: (address: string, lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  tileProvider?: 'osm' | 'google';
}

// Componente para atualizar o centro do mapa quando a busca muda
const MapController = ({ center }: { center: L.LatLngExpression }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16, { animate: true });
    // Força resize para evitar área cinza se o modal abrir pequeno
    setTimeout(() => { map.invalidateSize(); }, 300);
  }, [center, map]);
  return null;
};

// Componente de Marcador e Clique
const LocationMarker = ({ position, setPosition, onSelect }: any) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onSelect(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color:#ef4444;width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 4px 6px rgba(0,0,0,0.3);position:relative;"><div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #ef4444;"></div></div>`,
        iconSize: [24, 32],
        iconAnchor: [12, 32]
    })} />
  );
};

// Coordenadas padrão atualizadas para Natal/RN
export const LocationPicker: React.FC<LocationPickerProps> = ({ onLocationSelect, initialLat = -5.79448, initialLng = -35.211, tileProvider = 'osm' }) => {
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState<{ lat: number; lng: number }>({ lat: initialLat, lng: initialLng });
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoCompleteRef = useRef<any>(null);

  // Carrega API do Google Maps
  useEffect(() => {
    // Handler global para falhas de autenticação do Google Maps
    (window as any).gm_authFailure = () => {
        console.error("Google Maps: Falha de autenticação ou chave inválida/restrita.");
        setGoogleReady(false);
        setGoogleError(true);
    };

    const loadGoogleMaps = async () => {
      const publicConfig = await backendApi.getPublicConfig();
      const backendKey = publicConfig?.maps?.googleMapsPublicKey;
      const settings = backendKey ? null : await storage.getSettings();
      const googleMapsKey = backendKey || settings?.googleMapsKey;

      if (!googleMapsKey) {
          // Sem chave, não tentamos carregar, usamos modo manual
          setGoogleError(true); 
          return;
      }

      if ((window as any).google?.maps?.places) {
        setGoogleReady(true);
        return;
      }

      // Evita carregar scripts duplicados
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
         // Se já existe mas ainda não carregou globalmente, espera um pouco
         const checkInterval = setInterval(() => {
            if ((window as any).google?.maps?.places) {
                setGoogleReady(true);
                clearInterval(checkInterval);
            }
         }, 500);
         return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setGoogleReady(true);
      script.onerror = () => { setGoogleReady(false); setGoogleError(true); };
      document.head.appendChild(script);
    };
    loadGoogleMaps();

    return () => {
        (window as any).gm_authFailure = null;
    };
  }, []);

  // Inicializa Autocomplete
  useEffect(() => {
    if (googleReady && inputRef.current && !autoCompleteRef.current && (window as any).google?.maps?.places) {
      try {
          autoCompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
            fields: ['formatted_address', 'geometry'],
            types: ['geocode', 'establishment'] // Permite endereços e estabelecimentos
          });

          autoCompleteRef.current.addListener('place_changed', () => {
            const place = autoCompleteRef.current?.getPlace();
            if (place && place.geometry && place.geometry.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const addr = place.formatted_address || '';
              
              setAddress(addr);
              setPosition({ lat, lng });
              onLocationSelect(addr, lat, lng);
            }
          });
      } catch (e) {
          console.error("Erro ao inicializar Google Places Autocomplete:", e);
          setGoogleError(true);
      }
    }
  }, [googleReady, onLocationSelect]);

  // Reverse Geocoding ao clicar no mapa (usando Google Geocoder se disponível)
  const handleMapClick = (latlng: L.LatLng) => {
    setPosition(latlng);
    
    // Tenta usar Google Geocoder se disponível e sem erro
    if (googleReady && !googleError && (window as any).google?.maps?.Geocoder) {
        try {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: latlng }, (results: any, status: any) => {
                if (status === 'OK' && results && results[0]) {
                    const newAddr = results[0].formatted_address;
                    setAddress(newAddr);
                    onLocationSelect(newAddr, latlng.lat, latlng.lng);
                } else {
                    const fallback = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
                    setAddress(fallback);
                    onLocationSelect(fallback, latlng.lat, latlng.lng);
                }
            });
        } catch (e) {
            console.error("Erro no Geocoder:", e);
            const fallback = `Lat: ${latlng.lat.toFixed(5)}, Lon: ${latlng.lng.toFixed(5)}`;
            setAddress(fallback);
            onLocationSelect(fallback, latlng.lat, latlng.lng);
        }
    } else {
        // Fallback simples se API não estiver carregada ou com erro
        const fallback = `Lat: ${latlng.lat.toFixed(5)}, Lon: ${latlng.lng.toFixed(5)}`;
        setAddress(fallback);
        onLocationSelect(fallback, latlng.lat, latlng.lng);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex justify-between">
            <span>Endereço de Instalação</span>
            {googleReady && !googleError ? (
                <span className="text-emerald-500 flex items-center gap-1"><Search size={10}/> Google Maps Ativo</span>
            ) : (
                <span className="text-amber-500 flex items-center gap-1" title="Selecione no mapa manualmente"><AlertTriangle size={10}/> Seleção Manual</span>
            )}
        </label>
        <div className="relative mt-1">
            <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 ${googleReady && !googleError ? 'text-red-500' : 'text-zinc-400'}`} size={16} />
            <input 
                ref={inputRef}
                type="text" 
                value={address}
                onChange={(e) => {
                    setAddress(e.target.value);
                    // Atualiza o pai mesmo se digitar manualmente
                    if (!googleReady || googleError) {
                        onLocationSelect(e.target.value, position.lat, position.lng);
                    }
                }}
                placeholder={googleReady && !googleError ? "Busque o endereço no Google Maps..." : "Digite o endereço ou selecione no mapa..."}
                className={`w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border ${googleError ? 'border-amber-500/30' : 'border-zinc-200 dark:border-zinc-700'} rounded-2xl outline-none focus:border-primary-500 transition-all font-bold text-sm`}
            />
            {!googleReady && !googleError && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="animate-spin text-zinc-300" size={16} />
                </div>
            )}
        </div>
      </div>

      <div className="h-64 w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-0 shadow-inner">
         <MapContainer center={[position.lat, position.lng]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            {tileProvider === 'google' ? (
                <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
            ) : (
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            )}
            <MapController center={[position.lat, position.lng]} />
            <LocationMarker position={position} setPosition={setPosition} onSelect={handleMapClick} />
         </MapContainer>
         <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[8px] font-black uppercase z-[400] pointer-events-none shadow-sm flex items-center gap-2">
            <MapPin size={10} className="text-red-500"/>
            Arraste ou clique para ajustar
         </div>
      </div>
    </div>
  );
};