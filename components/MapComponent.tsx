
import * as React from 'react';
import { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Polyline, useMap, LayersControl, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { LocationHistory, Vehicle, VehicleCategory } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { FaCar, FaMotorcycle, FaTruck, FaQuestion } from 'react-icons/fa';

const { BaseLayer } = LayersControl;
const RN_CENTER = { lat: -5.791008, lon: -35.208888 };

// Componente auxiliar para renderizar o ícone correto
const VehicleIconComponent = ({ type, catName, size = 16, className = '' }: { type?: string, catName?: string, size?: number, className?: string }) => {
  const t = (type || '').toLowerCase();
  const n = (catName || '').toLowerCase();
  
  if (t === 'motos' || n.includes('moto')) return <FaMotorcycle size={size} className={className} />;
  if (t === 'caminhoes' || n.includes('caminhão') || n.includes('truck')) return <FaTruck size={size} className={className} />;
  if (t === 'carros' || n.includes('carro') || n.includes('passeio')) return <FaCar size={size} className={className} />;
  
  // Default/Unknown
  return <FaQuestion size={size} className={className} />;
};

const createVehicleIcon = (isSelected: boolean, categoryType?: string, categoryName?: string, color = '#f59e0b') => {
  const size = isSelected ? 20 : 16;
  
  // Renderiza o componente React Icon para string HTML
  const iconHtml = renderToStaticMarkup(
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <VehicleIconComponent type={categoryType} catName={categoryName} size={size} />
    </div>
  );
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
          background: ${isSelected ? color : '#ffffff'};
          width: ${isSelected ? '48px' : '36px'};
          height: ${isSelected ? '48px' : '36px'};
          border: ${isSelected ? '4px' : '3px'} solid ${isSelected ? '#ffffff' : '#18181b'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          transform: translate(-50%, -50%);
          transition: all 0.3s ease;
          color: ${isSelected ? '#000000' : '#18181b'};
      ">
          ${iconHtml}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// Custom Cluster Icon
const createClusterCustomIcon = function (cluster: any) {
  return L.divIcon({
    html: `<div>${cluster.getChildCount()}</div>`,
    className: 'marker-cluster-custom',
    iconSize: L.point(40, 40, true),
  });
};

const RecenterMap = ({ lat, lon, zoom }: { lat: number; lon: number, zoom?: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom || map.getZoom(), { animate: true, duration: 1.5 });
  }, [lat, lon, map, zoom]);
  return null;
};

interface MapProps {
  locations: LocationHistory[];
  isFleetMode?: boolean; 
  vehicles?: Vehicle[];
  categories?: VehicleCategory[];
  highlightedTagId?: string;
  onMarkerClick?: (tagId: string) => void;
}

export const MapComponent: React.FC<MapProps> = ({ 
  locations, 
  isFleetMode = false, 
  vehicles = [], 
  categories = [],
  highlightedTagId, 
  onMarkerClick 
}) => {
  const { theme } = useTheme();
  
  // Se houver um veículo selecionado, filtramos para mostrar APENAS ele no mapa
  const displayLocations = highlightedTagId 
    ? locations.filter(l => l.tagId === highlightedTagId) 
    : locations;

  const highlightedLoc = highlightedTagId ? locations.find(l => l.tagId === highlightedTagId) : null;

  const renderMarkers = (locs: LocationHistory[]) => {
    return locs.map((loc) => {
        const isSelected = highlightedTagId === loc.tagId;
        const vehicle = vehicles.find(v => v.tagId === loc.tagId);
        const category = categories.find(c => c.id === vehicle?.type);

        return (
          <Marker 
              key={loc.id} 
              position={[loc.lat, loc.lon]} 
              icon={createVehicleIcon(isSelected, category?.fipeType, category?.name)}
              eventHandlers={{ click: () => onMarkerClick?.(loc.tagId) }}
          >
              <Popup closeButton={false} className="custom-popup" offset={[0, -20]}>
                  <div className="min-w-[180px] p-1 font-sans">
                      <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">{vehicle?.plate || 'SEM PLACA'}</h3>
                          <span className={`text-[8px] font-black text-white px-1.5 py-0.5 rounded uppercase tracking-widest ${vehicle?.status === 'stolen' ? 'bg-red-600' : vehicle?.status === 'maintenance' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                              {vehicle?.status === 'stolen' ? 'ROUBO' : vehicle?.status === 'maintenance' ? 'MANUT' : 'ATIVO'}
                          </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2 bg-zinc-100 p-1.5 rounded-lg border border-zinc-200">
                          <div className="text-zinc-500">
                              <VehicleIconComponent type={category?.fipeType} catName={category?.name} size={16} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-zinc-700 uppercase leading-none">{vehicle?.model || 'Desconhecido'}</span>
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{category?.name || 'Geral'}</span>
                          </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[9px] font-mono text-zinc-400">
                          <span>{new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>{new Date(loc.timestamp).toLocaleDateString()}</span>
                      </div>
                  </div>
              </Popup>
          </Marker>
        )
    });
  };

  return (
    <div className="h-full w-full relative">
        <MapContainer 
          center={highlightedLoc ? [highlightedLoc.lat, highlightedLoc.lon] : (locations.length > 0 ? [locations[0].lat, locations[0].lon] : [RN_CENTER.lat, RN_CENTER.lon])} 
          zoom={highlightedLoc ? 17 : 13} 
          zoomControl={false}
          className="h-full w-full"
        >
          <LayersControl position="topright">
            <BaseLayer checked name="Google Maps">
              <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
            </BaseLayer>
            <BaseLayer name="Google Satélite">
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />
            </BaseLayer>
            <BaseLayer name="Google Híbrido">
              <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
            </BaseLayer>
          </LayersControl>
          
          {highlightedLoc && <RecenterMap lat={highlightedLoc.lat} lon={highlightedLoc.lon} zoom={18} />}

          {isFleetMode ? (
              // FIX: Only use MarkerClusterGroup when NOT highlighting a specific tag
              // This prevents 'Uncaught TypeError: Cannot read properties of undefined (reading '_leaflet_pos')'
              // which occurs when the cluster group tries to manage a rapidly changing/removing single marker
              highlightedTagId ? (
                  renderMarkers(displayLocations)
              ) : (
                  <MarkerClusterGroup
                    key={`cluster-${locations.length}`} // Force remount on count change to update positions cleanly
                    chunkedLoading={false} // Disable chunkedLoading to fix _leaflet_pos error
                    iconCreateFunction={createClusterCustomIcon}
                    spiderfyOnMaxZoom={true}
                    showCoverageOnHover={false}
                  >
                    {renderMarkers(displayLocations)}
                  </MarkerClusterGroup>
              )
          ) : (
              // Modo Histórico (Single Path)
              <>
                {locations.length > 0 && (
                    <Marker 
                        position={[locations[0].lat, locations[0].lon]} 
                        icon={createVehicleIcon(true)}
                    />
                )}
                <Polyline 
                    positions={locations.map(l => [l.lat, l.lon] as [number, number])} 
                    color="#f59e0b" 
                    weight={6} 
                    opacity={0.6} 
                    dashArray="1, 10"
                    lineCap="round"
                />
              </>
          )}
        </MapContainer>
    </div>
  );
};
