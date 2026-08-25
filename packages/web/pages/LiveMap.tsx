
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MapComponent } from '../components/MapComponent';

// Hooks - Relative Paths
import { useFleetData } from './livemap/hooks/useFleetData';
import { useFleetTracking } from './livemap/hooks/useFleetTracking';
import { useVehicleHistory } from './livemap/hooks/useVehicleHistory';
import { useAddressResolver } from './livemap/hooks/useAddressResolver';

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
  const [focusedHistoryPoint, setFocusedHistoryPoint] = useState<any>(null);
  const autoHistoryOpenedRef = useRef('');

  useEffect(() => {
    storage.getSettings().then(s => {
      setMapProvider(s.livemapMapProvider || s.geocodingProvider || 'osm');
    });
  }, []);

  // 1. Data Layer
  const { tags, vehicles, categories, clients } = useFleetData(user);

  // 2. Tracking Layer
  const { fleetLocations, loading, manualRefresh, refreshTag, injectLocations } = useFleetTracking(tags, vehicles, selectedTagId);

  // 3. Address Layer
  const { resolvedAddresses, resolveAddress, addResolvedAddress } = useAddressResolver();

  const activeVehicle = useMemo(() => vehicles.find(v => v.tagId === selectedTagId), [vehicles, selectedTagId]);
  const seedHistoryAddresses = React.useCallback((items: any[]) => {
      items.forEach(item => { if (item.address) addResolvedAddress(`${item.lat.toFixed(4)},${item.lon.toFixed(4)}`, item.address); });
  }, [addResolvedAddress]);

  // 4. History Layer
  const { 
      historyItems, historyLoading, showHistoryList, 
      fetchHistory, closeHistory, setShowHistoryList, historyDays, changeHistoryDays,
      nextCursor, loadMoreHistory, historyPartial, historyWarnings,
  } = useVehicleHistory(activeVehicle?.id || '', selectedTagId, fleetLocations, seedHistoryAddresses);

  const handleSelection = React.useCallback((tagId: string) => {
    setSelectedTagId(tagId); setIsSheetExpanded(true); setShowHistoryList(false);
    setTagSearchTerm(''); setIsSearchFocused(false);
  }, [setShowHistoryList]);

  useEffect(() => {
      const urlTagId = searchParams.get('tagId');
      if (urlTagId) handleSelection(urlTagId);
  }, [searchParams]);

  useEffect(() => {
      if (selectedTagId && searchParams.get('tagId') === selectedTagId && searchParams.get('history') === '1' && autoHistoryOpenedRef.current !== selectedTagId) {
          autoHistoryOpenedRef.current = selectedTagId; fetchHistory();
      }
  }, [selectedTagId, searchParams, fetchHistory]);

  const stats = useMemo(() => calculateFleetStats(vehicles, fleetLocations), [vehicles, fleetLocations]);
  
  const filteredList = useMemo(() => 
      filterFleetList(tagSearchTerm, filter, vehicles, tags, clients, fleetLocations, user), 
  [vehicles, fleetLocations, filter, tagSearchTerm, tags, clients, user]);

  const locationsToRender = useMemo(() => {
      const filtered = filterLocationsToRender(fleetLocations, selectedTagId, filter, displayLimit, vehicles);
      console.log('Locations to render:', filtered.length, 'out of total:', fleetLocations.length);
      return filtered;
  }, [fleetLocations, selectedTagId, filter, displayLimit, vehicles]);

  const activeTag = useMemo(() => tags.find(t => t.id === selectedTagId), [tags, selectedTagId]);
  const activeCategory = useMemo(() => activeVehicle ? categories.find(c => c.id === activeVehicle.type) : undefined, [activeVehicle, categories]);
  const activeClient = useMemo(() => activeVehicle ? clients.find(c => c.id === activeVehicle.clientId) : undefined, [activeVehicle, clients]);
  const lastLoc = useMemo(() => fleetLocations.find(l => l.tagId === selectedTagId), [fleetLocations, selectedTagId]);

  const handleExport = async (type: 'pdf' | 'excel') => {
    setExporting(true);
    try {
        const label = activeVehicle ? `${activeVehicle.plate} - ${activeVehicle.model}` : `Tag: ${activeTag?.name || 'Desconhecida'}`;
        const data = await processExportData(historyItems, resolvedAddresses, setExportProgress);
        
        data.forEach((d: any, idx: number) => {
             if (historyItems[idx]) addResolvedAddress(`${historyItems[idx].lat.toFixed(4)},${historyItems[idx].lon.toFixed(4)}`, d.endereco);
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
            focusLocation={focusedHistoryPoint}
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
        resolvedAddress={lastLoc ? resolvedAddresses[`${lastLoc.lat.toFixed(4)},${lastLoc.lon.toFixed(4)}`] : undefined}
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
        historyDays={historyDays}
        onHistoryDaysChange={changeHistoryDays}
        hasMore={Boolean(nextCursor)}
        onLoadMore={loadMoreHistory}
        partial={historyPartial}
        warnings={historyWarnings}
        onResolveAddress={resolveAddress}
        onViewPoint={setFocusedHistoryPoint}
      />

      <UpdateTagsModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        tags={tags}
        vehicles={vehicles}
        onLocationsUpdated={injectLocations}
      />
    </div>
  );
};
