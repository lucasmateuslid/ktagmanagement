import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Search, Loader2, AlertTriangle } from 'lucide-react';
import { geocodingService } from '../services/geocoding';
import { storage } from '../services/storage';

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
export const LocationPicker: React.FC<LocationPickerProps> = ({ onLocationSelect, initialLat = -5.79448, initialLng = -35.211 }) => {
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState<{ lat: number; lng: number }>({ lat: initialLat, lng: initialLng });
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{lat: number, lon: number, address: string, confidence?: number}[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [tileProvider, setTileProvider] = useState<'osm' | 'google'>('osm');
  const [geocoderPrefs, setGeocoderPrefs] = useState<any>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    storage.getSettings().then(s => {
      if (s.schedulingMapProvider) {
        setTileProvider(s.schedulingMapProvider);
      } else if (s.geocodingProvider) {
        setTileProvider(s.geocodingProvider);
      }
      if (s.geocoderPreferences) {
        setGeocoderPrefs(s.geocoderPreferences);
      }
    });
  }, []);

  const handleActiveProviderChange = (selected: string) => {
    setProviderMenuOpen(false);
    if (!geocoderPrefs) return;
    
    // Ensure priority_order exists to prevent .filter error on older settings
    const currentOrder = geocoderPrefs.priority_order || ['geoapify', 'here', 'photon', 'google_maps', 'radar', 'openstreetmap'];
    
    const newOrder = [selected, ...currentOrder.filter((p: string) => p !== selected)];
    const newPrefs = { ...geocoderPrefs, priority_order: newOrder };
    setGeocoderPrefs(newPrefs);
    storage.getSettings().then(s => {
        storage.saveSettings({ ...s, geocoderPreferences: newPrefs });
    });
  };

  const getAvailableProviders = () => {
    if (!geocoderPrefs) return [{ id: 'openstreetmap', label: 'OpenStreetMap' }];
    const available = [];
    
    if (geocoderPrefs.providers) {
        for (const [key, conf] of Object.entries(geocoderPrefs.providers) as any) {
            if (conf.enabled) {
                // Free providers don't need API key check here.
                // But others do. Let's simplify and show enabled ones.
                available.push({ id: key, label: getProviderLabel(key) });
            }
        }
    }
    
    // Also include free ones if not in list
    if (!available.find(a => a.id === 'openstreetmap')) available.unshift({ id: 'openstreetmap', label: 'OpenStreetMap' });
    if (!available.find(a => a.id === 'photon')) available.push({ id: 'photon', label: 'Photon' });
    
    return available;
  };

  const getProviderLabel = (key: string) => {
      const labels: Record<string, string> = {
          'openstreetmap': 'OpenStreetMap',
          'google_maps': 'Google Maps',
          'geoapify': 'Geoapify',
          'here': 'HERE Maps',
          'photon': 'Photon',
          'radar': 'Radar.io'
      };
      return labels[key] || key;
  };

  // Reverse Geocoding ao clicar no mapa
  const handleMapClick = async (latlng: L.LatLng) => {
    setPosition(latlng);
    setIsSearching(true);
    try {
        const newAddr = await geocodingService.reverseGeocode(latlng.lat, latlng.lng);
        setAddress(newAddr);
        onLocationSelect(newAddr, latlng.lat, latlng.lng);
    } catch (e) {
        console.error("Erro no Geocoder:", e);
        const fallback = `Lat: ${latlng.lat.toFixed(5)}, Lon: ${latlng.lng.toFixed(5)}`;
        setAddress(fallback);
        onLocationSelect(fallback, latlng.lat, latlng.lng);
    } finally {
        setIsSearching(false);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddress(value);
    
    if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
    }

    if (value.length > 3) {
        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await geocodingService.geocode(value);
                setSearchResults(results);
                setShowDropdown(true);
            } catch (error) {
                console.error("Erro na busca de endereço:", error);
            } finally {
                setIsSearching(false);
            }
        }, 800);
    } else {
        setSearchResults([]);
        setShowDropdown(false);
    }
  };

  const handleSelectResult = (result: {lat: number, lon: number, address: string, confidence?: number}) => {
      setAddress(result.address);
      setPosition({ lat: result.lat, lng: result.lon });
      onLocationSelect(result.address, result.lat, result.lon);
      setShowDropdown(false);
  };

  const activeProviderId = geocoderPrefs?.priority_order?.[0] || 'openstreetmap';
  const availableProviders = getAvailableProviders();

  return (
    <div className="space-y-4 relative z-[1000]">
      <div className="relative">
        <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex justify-between items-center mb-1">
            <span>Endereço de Instalação</span>
            
            <div className="relative">
                <button 
                  type="button"
                  onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setProviderMenuOpen(!providerMenuOpen);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors"
                  title="Selecionar provedor de busca ativo"
                >
                    <Search size={10} strokeWidth={3} />
                    <span className="text-[9px] min-w-[100px] text-center font-bold tracking-widest">{getProviderLabel(activeProviderId)} ATIVO</span>
                </button>

                {providerMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-[2000]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setProviderMenuOpen(false); }}></div>
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-[2010] overflow-hidden flex flex-col py-1 animate-in fade-in zoom-in duration-200 origin-top-right">
                           <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                               <p className="text-[10px] font-black text-zinc-400">PROVEDORES ATIVOS</p>
                           </div>
                           <div className="max-h-48 overflow-y-auto custom-scrollbar">
                               {availableProviders.map(p => (
                                   <div 
                                      key={p.id}
                                      onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleActiveProviderChange(p.id);
                                      }}
                                      className={`px-3 py-2 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                                          p.id === activeProviderId 
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                      }`}
                                   >
                                       <span>{p.label}</span>
                                       {p.id === activeProviderId && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>}
                                   </div>
                               ))}
                           </div>
                        </div>
                    </>
                )}
            </div>
        </div>
        <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" size={16} />
            <input 
                type="text" 
                value={address}
                onChange={handleAddressChange}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Digite o endereço ou selecione no mapa..."
                className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-primary-500 transition-all font-bold text-sm text-zinc-900 dark:text-white"
            />
            {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="animate-spin text-zinc-300" size={16} />
                </div>
            )}
        </div>
        
        {/* Dropdown de resultados */}
        {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-[1000] w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                {searchResults.map((result, idx) => (
                    <div 
                        key={idx} 
                        className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0 flex items-start justify-between gap-4"
                        onMouseDown={() => handleSelectResult(result)}
                    >
                        <p className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-2 leading-tight flex-1">{result.address}</p>
                        {result.confidence !== undefined && (
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <span className="text-[9px] font-black uppercase text-zinc-400">Precisão</span>
                                <span className={`text-xs font-black ${
                                    result.confidence > 0.8 ? 'text-emerald-500' :
                                    result.confidence > 0.5 ? 'text-amber-500' : 'text-red-500'
                                }`}>
                                    {Math.round(result.confidence * 100)}%
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>

      <div className="h-64 w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-0 shadow-inner">
         <MapContainer center={[position.lat, position.lng]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            {tileProvider === 'google' ? (
                <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" className="map-light-tiles" />
            ) : (
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" className="map-light-tiles" />
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
