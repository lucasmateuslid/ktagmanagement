
import * as React from 'react';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { LocationHistory, Vehicle } from '../types';
import { useTheme } from '../contexts/ThemeContext';

const { BaseLayer } = LayersControl;
const RN_CENTER = { lat: -5.791008, lon: -35.208888 };

const createVehicleIcon = (isSelected: boolean, color = '#f59e0b') => L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="
        background: ${isSelected ? color : '#ffffff'};
        width: ${isSelected ? '42px' : '32px'};
        height: ${isSelected ? '42px' : '32px'};
        border: 4px solid ${isSelected ? '#ffffff' : '#18181b'};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        transform: translate(-50%, -50%);
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
        <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? '24' : '18'}" height="${isSelected ? '24' : '18'}" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? '#000000' : '#18181b'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0]
});

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
  highlightedTagId?: string;
  onMarkerClick?: (tagId: string) => void;
}

export const MapComponent: React.FC<MapProps> = ({ locations, isFleetMode = false, vehicles = [], highlightedTagId, onMarkerClick }) => {
  const { theme } = useTheme();
  const highlightedLoc = highlightedTagId ? locations.find(l => l.tagId === highlightedTagId) : null;

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
          
          {highlightedLoc && <RecenterMap lat={highlightedLoc.lat} lon={highlightedLoc.lon} zoom={17} />}

          {isFleetMode ? (
              locations.map((loc) => {
                  const isSelected = highlightedTagId === loc.tagId;
                  return (
                    <Marker 
                        key={loc.id} 
                        position={[loc.lat, loc.lon]} 
                        icon={createVehicleIcon(isSelected)}
                        eventHandlers={{ click: () => onMarkerClick?.(loc.tagId) }}
                    />
                  )
              })
          ) : (
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
                    opacity={0.4} 
                    dashArray="1, 15"
                    lineCap="round"
                />
              </>
          )}
        </MapContainer>
    </div>
  );
};
