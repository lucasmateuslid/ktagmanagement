
import * as React from 'react';
import { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Polyline, useMap, LayersControl, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { LocationHistory, Vehicle, VehicleCategory, Tag } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { FaCar, FaMotorcycle, FaTruck, FaQuestion, FaBox } from 'react-icons/fa';

const { BaseLayer } = LayersControl;
const RN_CENTER = { lat: -5.791008, lon: -35.208888 };

// Componente auxiliar para renderizar o ícone correto
const VehicleIconComponent = ({ type, catName, size = 16, className = '', isUnlinked = false }: { type?: string, catName?: string, size?: number, className?: string, isUnlinked?: boolean }) => {
  if (isUnlinked) return <FaBox size={size} className={className} />;
  
  const t = (type || '').toLowerCase();
  const n = (catName || '').toLowerCase();
  
  if (t === 'motos' || n.includes('moto')) return <FaMotorcycle size={size} className={className} />;
  if (t === 'caminhoes' || n.includes('caminhão') || n.includes('truck')) return <FaTruck size={size} className={className} />;
  if (t === 'carros' || n.includes('carro') || n.includes('passeio')) return <FaCar size={size} className={className} />;
  
  // Default/Unknown
  return <FaQuestion size={size} className={className} />;
};

const createVehicleIcon = (isSelected: boolean, categoryType?: string, categoryName?: string, color = '#f59e0b', isUnlinked = false) => {
  const size = isSelected ? 20 : 16;
  
  // Renderiza o componente React Icon para string HTML
  const iconHtml = renderToStaticMarkup(
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <VehicleIconComponent type={categoryType} catName={categoryName} size={size} isUnlinked={isUnlinked} />
    </div>
  );
  
  // Se for unlinked, muda a cor do pin
  const bg = isUnlinked ? (isSelected ? '#eab308' : '#ca8a04') : (isSelected ? color : '#ffffff');
  const textColor = isUnlinked ? '#ffffff' : (isSelected ? '#000000' : '#18181b');

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
          background: ${bg};
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
          color: ${textColor};
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
  tags?: Tag[];
  categories?: VehicleCategory[];
  highlightedTagId?: string;
  onMarkerClick?: (tagId: string) => void;
}

export const MapComponent: React.FC<MapProps> = ({ 
  locations, 
  isFleetMode = false, 
  vehicles = [], 
  tags = [],
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
        const tag = tags.find(t => t.id === loc.tagId);
        
        // Se não tem veículo, é uma tag solta (unlinked)
        const isUnlinked = !vehicle;
        const category = vehicle ? categories.find(c => c.id === vehicle.type) : undefined;

        // Use stable loc.id here (which is now tag.id for live mode)
        return (
          <Marker 
              key={loc.id} 
              position={[loc.lat, loc.lon]} 
              icon={createVehicleIcon(isSelected, category?.fipeType, category?.name, '#f59e0b', isUnlinked)}
              eventHandlers={{ click: () => onMarkerClick?.(loc.tagId) }}
          >
              <Popup closeButton={false} className="custom-popup" offset={[0, -20]}>
                  <div className="min-w-[180px] p-1 font-sans">
                      <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                              {vehicle ? vehicle.plate : (tag?.name || 'Tag S/ Vínculo')}
                          </h3>
                          <span className={`text-[8px] font-black text-white px-1.5 py-0.5 rounded uppercase tracking-widest ${isUnlinked ? 'bg-amber-500' : (vehicle?.status === 'stolen' ? 'bg-red-600' : vehicle?.status === 'maintenance' ? 'bg-amber-500' : 'bg-emerald-500')}`}>
                              {isUnlinked ? 'ESTOQUE' : (vehicle?.status === 'stolen' ? 'ROUBO' : vehicle?.status === 'maintenance' ? 'MANUT' : 'ATIVO')}
                          </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2 bg-zinc-100 p-1.5 rounded-lg border border-zinc-200">
                          <div className="text-zinc-500">
                              <VehicleIconComponent type={category?.fipeType} catName={category?.name} size={16} isUnlinked={isUnlinked} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-zinc-700 uppercase leading-none">{vehicle ? vehicle.model : (tag?.accessoryId || 'N/A')}</span>
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{isUnlinked ? 'Sem Vínculo' : (category?.name || 'Geral')}</span>
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
              // Use standard MarkerClusterGroup. Stability is handled by stable keys in LiveMap.tsx
              // If a specific tag is highlighted, render only that marker to avoid cluster UI interference
              highlightedTagId ? (
                  renderMarkers(displayLocations)
              ) : (
                  <MarkerClusterGroup
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
