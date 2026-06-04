
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { MapComponent } from '../components/MapComponent';
import { useTraccarPositions } from '../hooks/useTraccarPositions';
import type { LocationHistory } from '../types';
import type { TraccarPosition } from '@ktag/shared';

// Hooks - Relative Paths
import { useFleetData } from './livemap/hooks/useFleetData';
import { useFleetTracking } from './livemap/hooks/useFleetTracking';
import { useTagHistory } from './livemap/hooks/useTagHistory';
import { useAddressResolver } from './livemap/hooks/useAddressResolver';

function traccarToLocation(pos: TraccarPosition): LocationHistory {
  return {
    id: `traccar:${pos.deviceId}`,
    tagId: `traccar:${pos.deviceId}`,
    lat: pos.latitude,
    lon: pos.longitude,
    conf: 1,
    status: 0,
    timestamp: new Date(pos.fixTime).getTime(),
    isodatetime: pos.fixTime,
  };
}

// Utils - Relative Paths
import { calculateFleetStats } from './livemap/utils/livemapStats';
import { filterFleetList, filterLocationsToRender } from './livemap/utils/livemapFilters';
import { processExportData, generatePDF, generateExcel } from './livemap/utils/exportUtils';

// Components - Relative Paths
import { TopHUD } from './livemap/components/TopHUD';
import { DetailsSheet } from './livemap/components/DetailsSheet';
import { HistoryOverlay } from './livemap/components/HistoryOverlay';
import { UpdateTagsModal } from '../components/UpdateTagsModal';
import { DisplayLimit } from '../types';
import { storage } from '../services/storage';

type FleetFilter = 'all' | 'online' | 'offline';

export const LiveMap = () => {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [searchParams] = useSearchParams();
  
  // UI State
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [filter, setFilter] = useState<FleetFilter>('all');
  const [displayLimit, setDisplayLimit] = useState<DisplayLimit>(50);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [showPlates, setShowPlates] = useState(false); // Novo Estado
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  
  // Export State
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [mapProvider, setMapProvider] = useState<'osm' | 'google'>('osm');

  useEffect(() => {
    storage.getSettings().then(s => {
      setMapProvider(s.livemapMapProvider || s.geocodingProvider || 'osm');
    });
  }, []);

  // 1. Data Layer
  const { tags, vehicles, categories, clients } = useFleetData(user);

  // 2. Tracking Layer (BLE tags via Wonca Labs)
  const { fleetLocations, loading, manualRefresh, refreshTag } = useFleetTracking(tags, vehicles, selectedTagId);

  // 2b. Traccar GPS positions via WebSocket
  const { positions: traccarPositions } = useTraccarPositions(tenantId);

  // 3. Address Layer
  const { resolvedAddresses, resolveAddress, addResolvedAddress } = useAddressResolver();

  // 4. History Layer
  const { 
      historyItems, historyLoading, showHistoryList, 
      fetchHistory, closeHistory, setShowHistoryList 
  } = useTagHistory(selectedTagId, tags, vehicles, fleetLocations, (items) => {
      items.forEach(resolveAddress);
  });

  useEffect(() => {
      const urlTagId = searchParams.get('tagId');
      if (urlTagId) handleSelection(urlTagId);
  }, [searchParams]);

  const stats = useMemo(() => calculateFleetStats(vehicles, fleetLocations), [vehicles, fleetLocations]);
  
  const filteredList = useMemo(() => 
      filterFleetList(tagSearchTerm, filter, vehicles, tags, clients, fleetLocations, user), 
  [vehicles, fleetLocations, filter, tagSearchTerm, tags, clients, user]);

  const locationsToRender = useMemo(() => {
      const filtered = filterLocationsToRender(fleetLocations, selectedTagId, filter, displayLimit, vehicles);
      // Adiciona posições GPS do Traccar (não duplica se o veículo já aparece via BLE)
      const traccarLocs = Array.from(traccarPositions.values()).map(traccarToLocation);
      const bleTagIds = new Set(filtered.map(l => l.tagId));
      const extra = traccarLocs.filter(l => !bleTagIds.has(l.tagId));
      return [...filtered, ...extra];
  }, [fleetLocations, selectedTagId, filter, displayLimit, vehicles, traccarPositions]);

  const activeVehicle = useMemo(() => vehicles.find(v => v.tagId === selectedTagId), [vehicles, selectedTagId]);
  const activeTag = useMemo(() => tags.find(t => t.id === selectedTagId), [tags, selectedTagId]);
  const activeCategory = useMemo(() => activeVehicle ? categories.find(c => c.id === activeVehicle.type) : undefined, [activeVehicle, categories]);
  const activeClient = useMemo(() => activeVehicle ? clients.find(c => c.id === activeVehicle.clientId) : undefined, [activeVehicle, clients]);
  const lastLoc = useMemo(() => fleetLocations.find(l => l.tagId === selectedTagId), [fleetLocations, selectedTagId]);

  useEffect(() => {
      if (lastLoc) resolveAddress(lastLoc);
  }, [lastLoc]);

  const handleSelection = (tagId: string) => {
    setSelectedTagId(tagId);
    setIsSheetExpanded(true); 
    setShowHistoryList(false);
    setTagSearchTerm('');
    setIsSearchFocused(false);
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    setExporting(true);
    try {
        const label = activeVehicle ? `${activeVehicle.plate} - ${activeVehicle.model}` : `Tag: ${activeTag?.name || 'Desconhecida'}`;
        const data = await processExportData(historyItems, resolvedAddresses, setExportProgress);
        
        data.forEach((d: any, idx: number) => {
             if (historyItems[idx]) addResolvedAddress(historyItems[idx].id, d.endereco);
        });

        if (type === 'pdf') await generatePDF(label, data);
        else await generateExcel(label, data);
        
    } finally {
        setExporting(false);
    }
  };

  const getSearchPlaceholder = () => {
      if (user?.role === 'client') return "Pesquisar por placa...";
      return "Placa, Modelo, Equipamento ou Cliente...";
  };

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950 font-sans">
      
      <TopHUD 
        searchTerm={tagSearchTerm}
        setSearchTerm={setTagSearchTerm}
        isFocused={isSearchFocused}
        setIsFocused={setIsSearchFocused}
        loading={loading}
        onRefresh={manualRefresh}
        searchPlaceholder={getSearchPlaceholder()}
        filteredList={filteredList}
        fleetLocations={fleetLocations}
        clients={clients}
        categories={categories}
        userRole={user?.role}
        onSelect={handleSelection}
        stats={stats}
        filter={filter}
        setFilter={setFilter}
        displayLimit={displayLimit}
        setDisplayLimit={setDisplayLimit}
        showPlates={showPlates} // Pass
        setShowPlates={setShowPlates} // Pass
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      <div className="flex-1 relative z-0">
        <MapComponent 
            locations={showHistoryList && historyItems.length > 0 ? historyItems : locationsToRender} 
            isFleetMode={!showHistoryList} 
            vehicles={vehicles}
            tags={tags}
            categories={categories}
            highlightedTagId={selectedTagId} 
            onMarkerClick={handleSelection} 
            showPlates={showPlates} 
            mapProvider={mapProvider}
        />
      </div>

      <DetailsSheet 
        selectedTagId={showHistoryList ? '' : selectedTagId}
        isExpanded={isSheetExpanded}
        toggleExpanded={() => setIsSheetExpanded(!isSheetExpanded)}
        vehicle={activeVehicle}
        tag={activeTag}
        category={activeCategory}
        client={activeClient}
        lastLoc={lastLoc}
        resolvedAddress={lastLoc ? resolvedAddresses[lastLoc.id] : undefined}
        userRole={user?.role}
        onFetchHistory={fetchHistory}
        onRefreshTag={refreshTag}
        onClose={() => setSelectedTagId('')}
      />

      <HistoryOverlay 
        isVisible={showHistoryList}
        onClose={closeHistory}
        activeVehicle={activeVehicle}
        activeTag={activeTag}
        historyItems={historyItems}
        historyLoading={historyLoading}
        resolvedAddresses={resolvedAddresses}
        exporting={exporting}
        exportProgress={exportProgress}
        onExport={handleExport}
      />

      <UpdateTagsModal 
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        tags={tags}
        vehicles={vehicles}
      />
    </div>
  );
};
