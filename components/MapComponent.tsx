
import React, { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Polyline, useMap, LayersControl, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { LocationHistory, Vehicle, VehicleCategory, Tag } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { FaCar, FaMotorcycle, FaTruck, FaQuestion, FaBox } from 'react-icons/fa';
import { BatteryCharging } from 'lucide-react';

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

const createVehicleIcon = (
    isSelected: boolean, 
    categoryType?: string, 
    categoryName?: string, 
    color = '#f59e0b', 
    isUnlinked = false,
    showPlates = false,
    plateText = ''
) => {
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

  // Badge HTML (condicional)
  const badgeHtml = (showPlates && plateText && !isUnlinked) ? `
    <div style="
        position: absolute;
        bottom: ${isSelected ? '54px' : '42px'};
        left: 50%;
        transform: translateX(-50%);
        background-color: #09090b;
        color: #ffffff;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Manrope', sans-serif;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        border: 1px solid #27272a;
        z-index: 1000;
    ">
        ${plateText}
        <div style="
            position: absolute;
            bottom: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 0; 
            height: 0; 
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 4px solid #09090b;
        "></div>
    </div>
  ` : '';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="position: relative;">
          ${badgeHtml}
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
  showPlates?: boolean; // Nova prop
  onMarkerClick?: (tagId: string) => void;
}

export const MapComponent: React.FC<MapProps> = ({ 
  locations, 
  isFleetMode = false, 
  vehicles = [], 
  tags = [],
  categories = [],
  highlightedTagId, 
  showPlates = false, // Default false
  onMarkerClick 
}) => {
  const { theme } = useTheme();
  
  const displayLocations = highlightedTagId 
    ? locations.filter(l => l.tagId === highlightedTagId) 
    : locations;

  const highlightedLoc = highlightedTagId ? locations.find(l => l.tagId === highlightedTagId) : null;

  const renderMarkers = (locs: LocationHistory[]) => {
    return locs.map((loc) => {
        const isSelected = highlightedTagId === loc.tagId;
        const vehicle = vehicles.find(v => v.tagId === loc.tagId);
        const tag = tags.find(t => t.id === loc.tagId);
        
        const isUnlinked = !vehicle;
        const category = vehicle ? categories.find(c => c.id === vehicle.type) : undefined;

        // Lógica de cor por tempo de comunicação
        const getCommColor = () => {
            if (!loc.timestamp) return '#71717a'; // Cinza se sem tempo
            const now = Date.now();
            const diffMin = (now - loc.timestamp) / 60000;
            const diffHours = diffMin / 60;

            if (diffMin <= 30) return '#10b981'; // Verde Claro
            if (diffHours <= 3) return '#f59e0b'; // Amarelo
            if (diffHours <= 12) return '#f97316'; // Laranja
            return '#ef4444'; // Vermelho
        };

        const statusColor = getCommColor();

        return (
          <Marker 
              key={loc.tagId} 
              position={[loc.lat, loc.lon]} 
              icon={createVehicleIcon(
                  isSelected, 
                  category?.fipeType, 
                  category?.name, 
                  statusColor, 
                  isUnlinked, 
                  showPlates, // Passa estado
                  vehicle?.plate // Passa texto
              )}
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

                      {loc.battery && (
                          <div className="flex items-center gap-2 mb-2 px-1.5">
                              <BatteryCharging size={12} style={{ color: loc.battery.color }} />
                              <div className="flex flex-col">
                                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: loc.battery.color }}>
                                      Bateria {loc.battery.label}
                                  </span>
                                  <div className="w-full h-1 bg-zinc-200 rounded-full mt-0.5 overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${loc.battery.level}%`, backgroundColor: loc.battery.color }}></div>
                                  </div>
                              </div>
                          </div>
                      )}

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
              <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" className="map-light-tiles" />
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
              <>
                <Polyline 
                    positions={locations.map(l => [l.lat, l.lon] as [number, number])} 
                    color="#f59e0b" 
                    weight={5} 
                    opacity={0.7} 
                    lineCap="round"
                    lineJoin="round"
                />
                
                {/* Pontos intermediários */}
                {locations.map((loc, idx) => (
                    <Marker 
                        key={loc.id || idx}
                        position={[loc.lat, loc.lon]}
                        icon={L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style="background: #f59e0b; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transform: translate(-50%, -50%);"></div>`,
                            iconSize: [0, 0],
                            iconAnchor: [0, 0]
                        })}
                    >
                        <Popup className="font-sans text-xs">
                           <div className="font-bold">{new Date(loc.timestamp).toLocaleString()}</div>
                           {loc.battery && <div>Bat: {loc.battery.level}%</div>}
                        </Popup>
                    </Marker>
                ))}

                {locations.length > 0 && (
                    <Marker 
                        position={[locations[0].lat, locations[0].lon]} 
                        icon={createVehicleIcon(true, undefined, undefined, '#10b981', false, showPlates, 'FIM/ATUAL')}
                    />
                )}
                
                {locations.length > 1 && (
                    <Marker 
                        position={[locations[locations.length-1].lat, locations[locations.length-1].lon]} 
                        icon={createVehicleIcon(true, undefined, undefined, '#ef4444', false, showPlates, 'INÍCIO')}
                    />
                )}
              </>
          )}
        </MapContainer>
    </div>
  );
};
