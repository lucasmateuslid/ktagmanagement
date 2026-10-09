
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
import { fleetCounts, fleetStatus, indexFleetLocations, searchVehicles, visibleFleetLocations, type FleetStatus } from './livemap/utils/fleetView';
import { processExportData, generatePDF, generateExcel } from './livemap/utils/exportUtils';

// Components - Relative Paths
import { FleetPanel } from './livemap/components/FleetPanel';
import { DetailsSheet } from './livemap/components/DetailsSheet';
import { HistoryOverlay } from './livemap/components/HistoryOverlay';
import { UpdateTagsModal } from '../components/UpdateTagsModal';
import { storage } from '../services/storage';

const INITIAL_NOW = Date.now();

export const LiveMap = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  // UI State
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [filter, setFilter] = useState<FleetStatus>('all');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [mapLimit, setMapLimit] = useState<number | 'all'>('all');
  const [mapViewVersion, setMapViewVersion] = useState(0);
  const [now, setNow] = useState(INITIAL_NOW);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [showPlates, setShowPlates] = useState(false); // Novo Estado
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  
  // Export State
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [mapProvider, setMapProvider] = useState<'osm' | 'google'>('osm');
  const [focusedHistoryPoint, setFocusedHistoryPoint] = useState<any>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 4>(1);
  const [selectionFocusVersion, setSelectionFocusVersion] = useState(0);
  const autoHistoryOpenedRef = useRef('');

  useEffect(() => {
    storage.getSettings().then(s => {
      setMapProvider(s.livemapMapProvider || s.geocodingProvider || 'osm');
    });
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  // 1. Data Layer
  const { tags, vehicles, categories, clients } = useFleetData(user);

  // 2. Tracking Layer
  const { fleetLocations, refreshTag, injectLocations } = useFleetTracking(tags, vehicles);

  // 3. Address Layer
  const { resolvedAddresses, resolveAddress, addResolvedAddress } = useAddressResolver();

  const activeVehicle = useMemo(() => vehicles.find(v => v.tagId === selectedTagId || (v.trackerId && `tracker:${v.trackerId}` === selectedTagId)), [vehicles, selectedTagId]);
  const seedHistoryAddresses = React.useCallback((items: any[]) => {
      items.forEach(item => { if (item.address) addResolvedAddress(`${item.lat.toFixed(6)},${item.lon.toFixed(6)}`, item.address); });
  }, [addResolvedAddress]);

  // 4. History Layer
  const { 
      historyItems, historyLoading, showHistoryList, 
      fetchHistory, closeHistory, setShowHistoryList,
      nextCursor, loadMoreHistory, historyPartial, historyWarnings, historyError, activePeriod,
  } = useVehicleHistory(activeVehicle?.id || '', selectedTagId, fleetLocations, seedHistoryAddresses);
  const replayPoints = useMemo(() => [...historyItems].sort((a, b) => a.timestamp - b.timestamp), [historyItems]);
  const replayPoint = replayPoints[replayIndex] || null;

  useEffect(() => {
      if (!replayPlaying || replayPoints.length < 2) return;
      const timer = window.setInterval(() => setReplayIndex(current => {
          if (current >= replayPoints.length - 1) { setReplayPlaying(false); return current; }
          return current + 1;
      }), 900 / replaySpeed);
      return () => window.clearInterval(timer);
  }, [replayPlaying, replayPoints.length, replaySpeed]);

  const handleSelection = React.useCallback((tagId: string) => {
    setSelectedTagId(tagId); setIsSheetExpanded(true); setShowHistoryList(false);
    setSelectionFocusVersion(version => version + 1);
    setReplayPlaying(false); setReplayIndex(0); setFocusedHistoryPoint(null);
  }, [setShowHistoryList]);

  useEffect(() => {
      const urlTagId = searchParams.get('tagId');
      if (!urlTagId) return;
      const timer = window.setTimeout(() => handleSelection(urlTagId), 0);
      return () => window.clearTimeout(timer);
  }, [searchParams, handleSelection]);

  useEffect(() => {
      if (activeVehicle?.id && selectedTagId && searchParams.get('tagId') === selectedTagId && searchParams.get('history') === '1' && autoHistoryOpenedRef.current !== selectedTagId) {
          autoHistoryOpenedRef.current = selectedTagId; fetchHistory();
      }
  }, [activeVehicle?.id, selectedTagId, searchParams, fetchHistory]);

  const trackedVehicles = useMemo(() => vehicles.filter(vehicle => vehicle.tagId || vehicle.trackerId), [vehicles]);
  const locationIndex = useMemo(() => indexFleetLocations(fleetLocations), [fleetLocations]);
  const communicationSeen = useMemo(() => new Set(tags.filter(tag => Number(tag.firstCommunicationAt || tag.communicationValidatedAt || 0) > 0).map(tag => tag.id)), [tags]);
  const validSelectedVehicleIds = useMemo(() => {
    const validIds = new Set(trackedVehicles.map(vehicle => vehicle.id));
    return selectedVehicleIds.filter(id => validIds.has(id));
  }, [selectedVehicleIds, trackedVehicles]);
  const counts = useMemo(() => fleetCounts(trackedVehicles, fleetLocations, now, communicationSeen, locationIndex), [trackedVehicles, fleetLocations, now, communicationSeen, locationIndex]);
  const filteredList = useMemo(() => searchVehicles(trackedVehicles, tagSearchTerm, clients, tags)
    .filter(vehicle => filter === 'all' || fleetStatus(vehicle, fleetLocations, now, communicationSeen, locationIndex) === filter),
  [trackedVehicles, tagSearchTerm, clients, tags, filter, fleetLocations, now, communicationSeen, locationIndex]);
  const locationsToRender = useMemo(() => {
    const visible = visibleFleetLocations(trackedVehicles, filteredList, validSelectedVehicleIds, fleetLocations, selectedTagId, locationIndex);
    return mapLimit === 'all' || validSelectedVehicleIds.length || selectedTagId ? visible : visible.slice(0, mapLimit);
  }, [fleetLocations, trackedVehicles, filteredList, validSelectedVehicleIds, selectedTagId, mapLimit, locationIndex]);

  const activeTag = useMemo(() => tags.find(t => t.id === selectedTagId), [tags, selectedTagId]);
  const activeCategory = useMemo(() => activeVehicle ? categories.find(c => c.id === activeVehicle.type) : undefined, [activeVehicle, categories]);
  const activeClient = useMemo(() => activeVehicle ? clients.find(c => c.id === activeVehicle.clientId) : undefined, [activeVehicle, clients]);
  const lastLoc = useMemo(() => fleetLocations.find(l => l.tagId === selectedTagId), [fleetLocations, selectedTagId]);

  useEffect(() => {
    if (!selectedTagId || activeTag?.type !== 'K_TAG' || showHistoryList) return;
    let disposed = false;
    let timer: number;
    const poll = async () => {
      if (!document.hidden) {
        try { await refreshTag(selectedTagId); }
        catch (error) { console.warn('Falha ao atualizar K-TAG selecionada:', error); }
      }
      if (!disposed) timer = window.setTimeout(poll, 120_000);
    };
    timer = window.setTimeout(poll, 120_000);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [selectedTagId, activeTag?.type, showHistoryList, refreshTag]);

  useEffect(() => {
    if (lastLoc && !lastLoc.address) void resolveAddress(lastLoc);
  }, [lastLoc, resolveAddress]);

  const handleExport = async (type: 'pdf' | 'excel') => {
    setExporting(true);
    try {
        const label = activeVehicle ? `${activeVehicle.plate} - ${activeVehicle.model}` : `Tag: ${activeTag?.name || 'Desconhecida'}`;
        const data = await processExportData(historyItems, resolvedAddresses, setExportProgress);
        
        data.forEach((d: any, idx: number) => {
             if (historyItems[idx]) addResolvedAddress(`${historyItems[idx].lat.toFixed(6)},${historyItems[idx].lon.toFixed(6)}`, d.endereco);
        });

        if (type === 'pdf') await generatePDF(label, data);
        else await generateExcel(label, data);
        
    } finally {
        setExporting(false);
    }
  };

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950 font-sans">
      
      {!showHistoryList && !selectedTagId && <FleetPanel
        vehicles={trackedVehicles}
        results={filteredList}
        locations={fleetLocations}
        clients={clients}
        categories={categories}
        search={tagSearchTerm}
        onSearch={setTagSearchTerm}
        status={filter}
        onStatus={setFilter}
        communicationSeen={communicationSeen}
        locationIndex={locationIndex}
        selectedIds={validSelectedVehicleIds}
        onSelectedIds={setSelectedVehicleIds}
        onOpenVehicle={handleSelection}
        onViewMap={() => { setSelectedTagId(''); setMapViewVersion(value => value + 1); }}
        onRefresh={() => setIsUpdateModalOpen(true)}
        counts={counts}
        mapLimit={mapLimit}
        onMapLimit={setMapLimit}
        showPlates={showPlates}
        onShowPlates={setShowPlates}
        userRole={user?.role}
      />}

      <div className="flex-1 relative z-0">
        <MapComponent 
            locations={showHistoryList ? historyItems : locationsToRender}
            isFleetMode={!showHistoryList} 
            vehicles={vehicles}
            tags={tags}
            categories={categories}
            highlightedTagId={selectedTagId} 
            selectionFocusKey={selectionFocusVersion + mapViewVersion}
            fleetFitVersion={mapViewVersion}
            onMarkerClick={handleSelection} 
            showPlates={showPlates} 
            mapProvider={mapProvider}
            focusLocation={focusedHistoryPoint}
            replayLocation={showHistoryList ? replayPoint : null}
            replayTrail={showHistoryList ? replayPoints.slice(0, replayIndex + 1) : []}
        />
      </div>

      <DetailsSheet 
        selectedTagId={showHistoryList ? '' : selectedTagId}
        search={tagSearchTerm}
        onSearch={setTagSearchTerm}
        isExpanded={isSheetExpanded}
        toggleExpanded={() => setIsSheetExpanded(!isSheetExpanded)}
        vehicle={activeVehicle}
        tag={activeTag}
        category={activeCategory}
        client={activeClient}
        lastLoc={lastLoc}
        resolvedAddress={lastLoc ? (lastLoc.address || resolvedAddresses[`${lastLoc.lat.toFixed(6)},${lastLoc.lon.toFixed(6)}`]) : undefined}
        userRole={user?.role}
        onFetchHistory={fetchHistory}
        onRefreshTag={refreshTag}
        onClose={() => setSelectedTagId('')}
      />

      <HistoryOverlay 
        isVisible={showHistoryList}
        onClose={() => { setReplayPlaying(false); closeHistory(); }}
        activeVehicle={activeVehicle}
        activeTag={activeTag}
        historyItems={historyItems}
        historyLoading={historyLoading}
        resolvedAddresses={resolvedAddresses}
        exporting={exporting}
        exportProgress={exportProgress}
        onExport={handleExport}
        hasMore={Boolean(nextCursor)}
        onLoadMore={loadMoreHistory}
        partial={historyPartial}
        warnings={historyWarnings}
        historyError={historyError}
        activePeriod={activePeriod}
        onConsultPeriod={(period) => { setReplayPlaying(false); setReplayIndex(0); setFocusedHistoryPoint(null); void fetchHistory(period); }}
        onResolveAddress={resolveAddress}
        onViewPoint={(item) => { setReplayPlaying(false); setReplayIndex(Math.max(0, replayPoints.findIndex(point => point.id === item.id))); setFocusedHistoryPoint(item); }}
        replayIndex={replayIndex}
        replayPlaying={replayPlaying}
        replaySpeed={replaySpeed}
        replayPoint={replayPoint}
        onReplayToggle={() => { if (replayIndex >= replayPoints.length - 1) setReplayIndex(0); setReplayPlaying(value => !value); }}
        onReplaySeek={(index) => { setReplayPlaying(false); setReplayIndex(index); setFocusedHistoryPoint(replayPoints[index] || null); }}
        onReplaySpeedChange={setReplaySpeed}
      />

      <UpdateTagsModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        vehicles={vehicles}
        onLocationsUpdated={injectLocations}
      />
    </div>
  );
};
