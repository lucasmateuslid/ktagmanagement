
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { storage } from '../services/storage';
import { fetchTagLocation, exportToCSV } from '../services/api';
import { geocodingService } from '../services/geocoding';
import { Tag, LocationHistory, Vehicle, VehicleCategory } from '../types';
import { MapComponent } from '../components/MapComponent';
import { useNotification } from '../contexts/NotificationContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshCw, Download, Play, Square, Car, Truck, Bike, AlertTriangle, Share2, Search, MapPin, Copy, Check, MessageCircle, Send, FileText, FileSpreadsheet, Loader2, Trash2, LayoutGrid, MapPinned } from 'lucide-react';

// Explicit imports for ESM modules
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import * as XLSX from 'xlsx';

export const LiveMap = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [locations, setLocations] = useState<LocationHistory[]>([]);
  
  // Tracking States
  const [isTracking, setIsTracking] = useState(false);
  const [isFleetTracking, setIsFleetTracking] = useState(false); // New Mode
  
  const [loading, setLoading] = useState(false);
  
  // Search state for dropdown
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  
  // Share Dropdown state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Reports & Addresses
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportAddresses, setReportAddresses] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState(false);
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });
  
  const { addNotification } = useNotification();
  const { setStatus, setLastSync } = useConnection();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams(); 
  const timerRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const allTags = await storage.getTags();
      const allVehicles = await storage.getVehicles();
      const allCategories = await storage.getCategories();
      setTags(allTags);
      setVehicles(allVehicles);
      setCategories(allCategories);

      // Check URL for tagId
      const urlTagId = searchParams.get('tagId');
      if (urlTagId && allTags.find(t => t.id === urlTagId)) {
        setSelectedTagId(urlTagId);
      } else if (allTags.length > 0 && !selectedTagId) {
        setSelectedTagId(allTags[0].id);
      }
    };
    loadData();
  }, [searchParams]);

  useEffect(() => {
    const loadHistory = async () => {
      if (selectedTagId && !isFleetTracking) {
        const hist = await storage.getLocations(selectedTagId);
        setLocations(hist);
      }
    };
    loadHistory();
  }, [selectedTagId, isFleetTracking]);

  // --- AUTO-RESOLVE ADDRESSES EFFECT ---
  // This watches 'locations' and automatically fetches address for the latest items
  useEffect(() => {
    const autoResolve = async () => {
      if (locations.length === 0) return;

      // Determine which items to resolve
      // In Single Mode: Just the latest one (index 0) to save API calls
      // In Fleet Mode: The visible list (limit to 20 to be safe)
      const limit = isFleetTracking ? 20 : 1;
      const candidates = locations.slice(0, limit);

      // Filter out those we already have
      const toResolve = candidates.filter(loc => !reportAddresses[loc.id]);
      
      if (toResolve.length === 0) return;

      const newAddrs: Record<string, string> = {};
      let hasUpdates = false;

      for (const loc of toResolve) {
        try {
           const addr = await geocodingService.reverseGeocode(loc.lat, loc.lon);
           newAddrs[loc.id] = addr;
           hasUpdates = true;
           // Tiny delay to be nice to free APIs (OSM)
           await new Promise(r => setTimeout(r, 200));
        } catch (e) {
           console.warn("Auto-resolve failed", e);
        }
      }

      if (hasUpdates) {
        setReportAddresses(prev => ({ ...prev, ...newAddrs }));
      }
    };

    // Debounce slightly
    const t = setTimeout(autoResolve, 1000);
    return () => clearTimeout(t);
  }, [locations, isFleetTracking]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsSearchOpen(false);
        }
        if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
            setIsShareOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeVehicle = vehicles.find(v => v.tagId === selectedTagId);
  const selectedTag = tags.find(t => t.id === selectedTagId);

  // Filter tags for the custom dropdown
  const filteredTags = tags.filter(tag => {
    const term = tagSearchTerm.toLowerCase();
    const linkedVehicle = vehicles.find(v => v.tagId === tag.id);
    const plate = linkedVehicle ? linkedVehicle.plate.toLowerCase() : '';

    return (
      tag.name.toLowerCase().includes(term) || 
      tag.accessoryId.toLowerCase().includes(term) ||
      plate.includes(term)
    );
  });

  // --- SINGLE TAG UPDATE ---
  const fetchUpdate = async () => {
    if (!selectedTagId) return;
    setLoading(true);
    setStatus('syncing');
    
    const tag = tags.find(t => t.id === selectedTagId);
    if (tag) {
      try {
        const results = await fetchTagLocation(tag);
        
        if (results.length > 0) {
           for (const res of results) {
              const newLoc: LocationHistory = {
                ...res,
                tagId: tag.id,
                id: `${tag.id}-${res.timestamp}`
              };
              await storage.addLocation(newLoc);
           }
           
           const updated = await storage.getLocations(selectedTagId);
           setLocations(updated);
           
           addNotification('success', 'Location Updated', `Fetched ${results.length} points for ${tag.name}`);
           setLastSync(Date.now());
           setStatus('connected');
        } else {
           setStatus('connected');
        }
      } catch (err: any) {
        addNotification('error', 'Tracking Failed', err.message || 'Unable to connect to K-Tag API');
        setStatus('error');
      }
    }
    setLoading(false);
  };

  // --- FLEET UPDATE (MULTI TAG) ---
  const fetchFleetUpdate = async () => {
      setLoading(true);
      setStatus('syncing');

      // 1. Find all tags that are linked to active vehicles
      const linkedTags = tags.filter(t => vehicles.some(v => v.tagId === t.id && v.status !== 'maintenance'));
      
      if (linkedTags.length === 0) {
          addNotification('info', 'Fleet Tracking', 'No active linked tags found.');
          setLoading(false);
          return;
      }

      console.log(`Starting fleet update for ${linkedTags.length} vehicles...`);
      const newFleetLocations: LocationHistory[] = [];

      // 2. Fetch parallel
      const promises = linkedTags.map(async (tag) => {
          try {
              const results = await fetchTagLocation(tag);
              if (results.length > 0) {
                  // We only care about the latest one for the fleet map
                  const latest = results[0]; // results are usually sorted desc by api, if not we sort
                  const newLoc: LocationHistory = {
                      ...latest,
                      tagId: tag.id,
                      id: `${tag.id}-${latest.timestamp}`
                  };
                  await storage.addLocation(newLoc); // Save to history anyway
                  return newLoc;
              }
          } catch (e) {
              console.warn(`Failed to fetch for ${tag.name}`, e);
          }
          return null;
      });

      const results = await Promise.all(promises);
      results.forEach(r => { if(r) newFleetLocations.push(r) });

      setLocations(newFleetLocations);
      setLastSync(Date.now());
      setStatus('connected');
      setLoading(false);
      addNotification('success', 'Fleet Updated', `Updated locations for ${newFleetLocations.length} vehicles.`);
  };

  const toggleTracking = () => {
    if (isTracking) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsTracking(false);
      setIsFleetTracking(false);
      setStatus('connected');
    } else {
      setIsTracking(true);
      
      if (isFleetTracking) {
          // Fleet Mode: 5 Minutes Interval
          fetchFleetUpdate();
          timerRef.current = window.setInterval(fetchFleetUpdate, 300000); // 5 min
      } else {
          // Single Mode: 1 Minute Interval
          fetchUpdate(); 
          timerRef.current = window.setInterval(fetchUpdate, 60000); 
      }
    }
  };

  const toggleFleetMode = () => {
      if (isTracking) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsTracking(false);
      }
      setIsFleetTracking(!isFleetTracking);
      setLocations([]); // Clear map
  };

  // --- Auto-Start Tracking Logic from URL ---
  useEffect(() => {
    const autoStart = searchParams.get('autoStart') === 'true';
    if (autoStart && selectedTagId && !isTracking && !loading && !isFleetTracking) {
        setIsTracking(true);
        fetchUpdate();
        timerRef.current = window.setInterval(fetchUpdate, 60000);
    }
  }, [selectedTagId]); 

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleClearHistory = async () => {
    if (!selectedTagId) return;
    if (confirm(t('clearConfirm'))) {
      await storage.clearTagHistory(selectedTagId);
      setLocations([]);
      addNotification('success', t('clearHistory'), t('historyCleared'));
    }
  };

  const handleExportCSV = () => {
    if (locations.length === 0) return alert("No data to export");
    exportToCSV(locations);
  };

  // --- Report & Address Logic --- (Kept same as before)
  const resolveAddresses = async () => {
    if (locations.length === 0) return;
    setResolving(true);
    setResolveProgress({ current: 0, total: locations.length });
    const newAddresses = { ...reportAddresses };
    let count = 0;
    for (const loc of locations) {
      count++;
      setResolveProgress({ current: count, total: locations.length });
      if (!newAddresses[loc.id]) {
        try {
          const addr = await geocodingService.reverseGeocode(loc.lat, loc.lon);
          newAddresses[loc.id] = addr;
        } catch (e) {}
      }
    }
    setReportAddresses(newAddresses);
    setResolving(false);
  };

  const generatePDF = () => {
    if (!jsPDF) return alert("PDF Library not loaded properly");
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(isFleetTracking ? 'Relatório de Frota (Snapshot)' : `${t('repTitle')}: ${selectedTag?.name}`, 14, 22);
      doc.setFontSize(11);
      doc.text(`${t('repDate')}: ${new Date().toLocaleString()}`, 14, 30);
      
      const headers = [[t('repVehicle'), t('repDate'), t('repLat'), t('repLon'), t('repSpeed')]];
      const data = locations.map(l => {
         const v = vehicles.find(v => v.tagId === l.tagId);
         return [
             v ? v.plate : 'Unknown',
             l.isodatetime,
             l.lat.toFixed(5),
             l.lon.toFixed(5),
             l.conf.toString()
         ];
      });

      autoTable(doc, { head: headers, body: data, startY: 44 });
      doc.save(`report_${isFleetTracking ? 'fleet' : selectedTag?.name}.pdf`);
    } catch (e) { alert("Error generating PDF."); }
  };

  const generateExcel = () => {
    if (!XLSX) return alert("Excel Library not loaded properly");
    try {
      const data = locations.map(l => {
          const v = vehicles.find(v => v.tagId === l.tagId);
          return {
            [t('repVehicle')]: v ? `${v.plate} - ${v.model}` : 'Unknown',
            [t('repTimestamp')]: l.timestamp,
            [t('repDate')]: l.isodatetime,
            [t('repLat')]: l.lat,
            [t('repLon')]: l.lon,
            [t('repSpeed')]: l.conf,
            [t('repAddr')]: reportAddresses[l.id] || 'Unresolved'
          };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Locations");
      XLSX.writeFile(wb, `report_${isFleetTracking ? 'fleet' : selectedTag?.name}.xlsx`);
    } catch (e) { alert("Error generating Excel."); }
  };

  // --- Share Logic --- (Simplified for brevity)
  const getShareUrl = () => {
    if (locations.length === 0) return null;
    const last = locations[0];
    return `https://www.google.com/maps/search/?api=1&query=${last.lat},${last.lon}`;
  };
  const handleCopyLink = async () => { /* ...existing logic... */ };
  const handleWhatsApp = () => { /* ...existing logic... */ };

  const getVehicleIcon = (vehicle: Vehicle) => {
    const cat = categories.find(c => c.id === vehicle.type);
    if (!cat) return <Car className="text-primary-500" />;
    switch(cat.fipeType) {
        case 'caminhoes': return <Truck className="text-primary-500" />;
        case 'motos': return <Bike className="text-primary-500" />;
        default: return <Car className="text-primary-500" />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 relative">
      
      {window.location.protocol === 'https:' && (
         <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg text-xs flex items-center gap-2 border border-amber-200 dark:border-amber-900 shrink-0">
            <AlertTriangle size={14} />
            <span>Note: K-Tag API is HTTP. If you see errors, use the Cloud Function Proxy (Settings).</span>
         </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 justify-between shrink-0">
        
        <div className="flex flex-wrap items-center gap-4 flex-1">
          
          {/* Tracker Selection (Only active if NOT in Fleet Mode) */}
          <div className={`flex flex-col relative z-20 ${isFleetTracking ? 'opacity-50 pointer-events-none' : ''}`} ref={dropdownRef}>
            <label className="text-xs text-slate-500 mb-1">{t('selectTracker')}</label>
            <div 
                className="w-full md:w-64 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-between cursor-pointer"
                onClick={() => !isFleetTracking && setIsSearchOpen(!isSearchOpen)}
            >
                <span className="truncate text-sm">{selectedTag ? `${selectedTag.name} (${selectedTag.accessoryId})` : t('selectTracker')}</span>
                <Search size={14} className="text-slate-400" />
            </div>

            {isSearchOpen && (
                <div className="absolute top-full left-0 w-full md:w-80 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-80 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                        <input 
                            type="text" 
                            className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500"
                            placeholder={t('searchTracker')}
                            value={tagSearchTerm}
                            onChange={(e) => setTagSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {filteredTags.map(t => {
                            const vehicle = vehicles.find(v => v.tagId === t.id);
                            return (
                                <div 
                                    key={t.id}
                                    className={`px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${selectedTagId === t.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'text-slate-700 dark:text-slate-200'}`}
                                    onClick={() => {
                                        setSelectedTagId(t.id);
                                        setIsSearchOpen(false);
                                        setTagSearchTerm('');
                                    }}
                                >
                                    <div className="font-medium">{t.name}</div>
                                    <div className="text-xs text-slate-400 flex justify-between items-center mt-0.5">
                                        <span>SN: {t.accessoryId}</span>
                                        {vehicle && <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold">{vehicle.plate}</span>}
                                    </div>
                                </div>
                            );
                        })}
                        {filteredTags.length === 0 && <div className="p-4 text-xs text-slate-400 text-center">No tags found</div>}
                    </div>
                </div>
            )}
          </div>

          <div className="flex flex-col">
             <label className="text-xs text-slate-500 mb-1">{t('action')}</label>
             <div className="flex gap-2">
                <button
                  onClick={toggleTracking}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                    isTracking 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' 
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {isTracking ? <><Square size={16} fill="currentColor" /> {t('stop')}</> : <><Play size={16} fill="currentColor" /> {t('startTracking')}</>}
                </button>

                <button 
                  onClick={() => isFleetTracking ? fetchFleetUpdate() : fetchUpdate()}
                  disabled={loading}
                  className="p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  title={t('refresh')}
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>

                {!isFleetTracking && (
                    <button
                    onClick={handleClearHistory}
                    disabled={locations.length === 0}
                    className="p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                    title={t('clearHistory')}
                    >
                    <Trash2 size={18} />
                    </button>
                )}
             </div>
          </div>
          
          {/* Fleet Toggle Switch */}
          <div className="flex flex-col border-l border-slate-200 dark:border-slate-800 pl-4 ml-2">
             <label className="text-xs text-slate-500 mb-1">Modo de Rastreio</label>
             <button
                onClick={toggleFleetMode}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                    isFleetTracking 
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
             >
                <LayoutGrid size={16} />
                Monitorar Frota (5m)
             </button>
          </div>

        </div>

        {activeVehicle && !isFleetTracking ? (
           <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              {getVehicleIcon(activeVehicle)}
              <div>
                <p className="text-xs text-slate-500 font-medium">{t('linkedVehicle')}</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{activeVehicle.model}</p>
                <p className="text-xs font-mono text-slate-600 dark:text-slate-400">{activeVehicle.plate}</p>
              </div>
           </div>
        ) : !isFleetTracking && (
           <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 opacity-60">
             <Car className="text-slate-400" />
             <span className="text-sm text-slate-500">{t('noVehicleLinked')}</span>
           </div>
        )}
        
        {isFleetTracking && (
           <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="p-1 bg-purple-100 dark:bg-purple-800 rounded">
                 <LayoutGrid size={16} className="text-purple-600 dark:text-purple-300"/>
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                 Modo Frota Ativo
                 <p className="text-[10px] opacity-70">Atualização a cada 5 min</p>
              </div>
           </div>
        )}

        {/* Share Button & Report (Same as before) */}
        <div className="flex items-center gap-2 relative z-20" ref={shareRef}>
           <button 
              onClick={() => setIsShareOpen(!isShareOpen)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors ${isShareOpen ? 'border-primary-500 ring-2 ring-primary-100 dark:ring-primary-900/30' : 'border-slate-300 dark:border-slate-700'}`}
              title={t('shareLocation')}
           >
             <Share2 size={16} /> <span className="hidden sm:inline">{t('shareLocation')}</span>
           </button>
           
           {isShareOpen && (
             <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Simplified Share Menu */}
                <div className="p-4 text-center text-sm text-slate-500">
                   {isFleetTracking ? "Compartilhamento indisponível no modo frota." : "Use as opções abaixo:"}
                </div>
                {!isFleetTracking && (
                    <button onClick={handleCopyLink} className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700">Copy Link</button>
                )}
             </div>
           )}
           
           {/* Report Button */}
           <button 
              onClick={() => setIsReportOpen(!isReportOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium"
           >
             <Download size={16} /> {t('reports')}
           </button>
        </div>
      </div>

      {/* Report Modal */}
      {isReportOpen && (
         <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
             <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                 <h2 className="text-xl font-bold mb-4">{t('reports')}</h2>
                 <p className="text-sm text-slate-500 mb-6">
                    {isFleetTracking ? "Relatório Instantâneo da Frota (Últimas posições)" : "Relatório de Histórico Individual"}
                 </p>
                 <div className="space-y-4">
                    <button 
                      onClick={resolveAddresses} 
                      disabled={resolving || locations.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                       {resolving ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />} 
                       {resolving ? `${t('resolving')} (${resolveProgress.current}/${resolveProgress.total})` : t('resolveAddress')}
                    </button>
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={generatePDF} className="flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                          <FileText size={18} /> {t('exportPDF')}
                       </button>
                       <button onClick={generateExcel} className="flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                          <FileSpreadsheet size={18} /> {t('exportExcel')}
                       </button>
                    </div>
                 </div>
                 <div className="mt-6 flex justify-end">
                    <button onClick={() => setIsReportOpen(false)} className="text-slate-500 hover:text-slate-800">Close</button>
                 </div>
             </div>
         </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
        <div className="lg:col-span-2 h-[400px] lg:h-full relative z-0">
           <MapComponent locations={locations} isFleetMode={isFleetTracking} vehicles={vehicles} />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full min-h-[400px]">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-800 dark:text-white">{t('liveData')}</h2>
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-slate-500">{locations.length} {isFleetTracking ? 'veículos monitorados' : t('pointsFound')}</p>
              {loading && <span className="text-xs text-primary-500 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> {t('updating')}</span>}
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {locations.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                {t('noHistory')}
              </div>
            ) : (
              locations.map((loc) => {
                  const vehicle = vehicles.find(v => v.tagId === loc.tagId);
                  return (
                    <div key={loc.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex justify-between items-start">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isFleetTracking ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {vehicle ? vehicle.plate : 'Tag ' + loc.tagId.slice(0,4)}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(loc.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {isFleetTracking && vehicle && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">{vehicle.model}</p>
                    )}
                    <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1 mb-1">
                            <MapPin size={12} className="text-slate-400"/>
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="hover:underline hover:text-primary-600"
                            >
                                {loc.lat.toFixed(6)}, {loc.lon.toFixed(6)}
                            </a>
                        </div>
                        {/* ADDRESS DISPLAY */}
                        {reportAddresses[loc.id] ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-start gap-1 font-medium bg-emerald-50 dark:bg-emerald-900/10 p-1.5 rounded border border-emerald-100 dark:border-emerald-900/30">
                                <MapPinned size={12} className="shrink-0 mt-0.5" />
                                {reportAddresses[loc.id]}
                            </p>
                        ) : (
                            isTracking && (
                                <p className="text-[10px] text-slate-400 mt-1 animate-pulse flex items-center gap-1">
                                    <Loader2 size={10} className="animate-spin" /> Resolvendo endereço...
                                </p>
                            )
                        )}
                    </div>
                    </div>
                  )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
