
import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MapComponent } from '../components/MapComponent';

// Hooks - Relative Paths
import { useFleetData } from './livemap/hooks/useFleetData';
import { useFleetTracking } from './livemap/hooks/useFleetTracking';
import { useTagHistory } from './livemap/hooks/useTagHistory';
import { useAddressResolver } from './livemap/hooks/useAddressResolver';

// Utils - Relative Paths
import { calculateFleetStats } from './livemap/utils/livemapStats';
import { filterFleetList, filterLocationsToRender } from './livemap/utils/livemapFilters';
import { processExportData, generatePDF, generateExcel } from './livemap/utils/exportUtils';

// Components - Relative Paths
import { TopHUD } from './livemap/components/TopHUD';
import { DetailsSheet } from './livemap/components/DetailsSheet';
import { HistoryOverlay } from './livemap/components/HistoryOverlay';

const { useSearchParams } = ReactRouterDOM as any;

type FleetFilter = 'all' | 'online' | 'offline';
export type DisplayLimit = 10 | 30 | 50 | 100 | 200 | 'all';

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
  
  // Export State
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // 1. Data Layer
  const { tags, vehicles, categories, clients } = useFleetData(user);

  // 2. Tracking Layer
  const { fleetLocations, loading, manualRefresh, refreshTag } = useFleetTracking(tags, vehicles, selectedTagId);

  // 3. Address Layer
  const { resolvedAddresses, resolveAddress, addResolvedAddress } = useAddressResolver();

  // 4. History Layer
  const { 
      historyItems, historyLoading, showHistoryList, 
      fetchHistory, closeHistory, setShowHistoryList 
  } = useTagHistory(selectedTagId, tags, fleetLocations, (items) => {
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

  const locationsToRender = useMemo(() => 
      filterLocationsToRender(fleetLocations, selectedTagId, filter, displayLimit, vehicles),
  [fleetLocations, selectedTagId, filter, displayLimit, vehicles]);

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
      />

      <div className="flex-1 relative z-0">
        <MapComponent 
            locations={locationsToRender} 
            isFleetMode={true} 
            vehicles={vehicles}
            tags={tags}
            categories={categories}
            highlightedTagId={selectedTagId} 
            onMarkerClick={handleSelection} 
            showPlates={showPlates} // Pass
        />
      </div>

      <DetailsSheet 
        selectedTagId={selectedTagId}
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
    </div>
  );
};
