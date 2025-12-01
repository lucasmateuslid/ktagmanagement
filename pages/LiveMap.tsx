
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { fetchTagLocation, exportToCSV } from '../services/api';
import { Tag, LocationHistory, Vehicle } from '../types';
import { MapComponent } from '../components/MapComponent';
import { useNotification } from '../contexts/NotificationContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshCw, Download, Play, Square, Car, AlertTriangle } from 'lucide-react';

export const LiveMap = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [locations, setLocations] = useState<LocationHistory[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { addNotification } = useNotification();
  const { setStatus, setLastSync } = useConnection();
  const { t } = useLanguage();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const allTags = await storage.getTags();
      const allVehicles = await storage.getVehicles();
      setTags(allTags);
      setVehicles(allVehicles);
      if (allTags.length > 0) setSelectedTagId(allTags[0].id);
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      if (selectedTagId) {
        const hist = await storage.getLocations(selectedTagId);
        setLocations(hist);
      }
    };
    loadHistory();
  }, [selectedTagId]);

  const activeVehicle = vehicles.find(v => v.tagId === selectedTagId);

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
           addNotification('info', 'No New Data', `Tag ${tag.name} returned no location history in the last 7 days.`);
           setStatus('connected');
        }
      } catch (err: any) {
        addNotification('error', 'Tracking Failed', err.message || 'Unable to connect to K-Tag API');
        setStatus('error');
      }
    }
    setLoading(false);
  };

  const toggleTracking = () => {
    if (isTracking) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsTracking(false);
      setStatus('connected');
    } else {
      setIsTracking(true);
      fetchUpdate(); 
      timerRef.current = window.setInterval(fetchUpdate, 60000); 
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleExport = () => {
    if (locations.length === 0) return alert("No data to export");
    exportToCSV(locations);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
      
      {window.location.protocol === 'https:' && (
         <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg text-xs flex items-center gap-2 border border-amber-200 dark:border-amber-900">
            <AlertTriangle size={14} />
            <span>Note: K-Tag API is HTTP. If you see errors, use the Cloud Function Proxy (Settings).</span>
         </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 justify-between">
        
        <div className="flex items-center gap-4 flex-1">
          <div className="flex flex-col">
            <label className="text-xs text-slate-500 mb-1">{t('selectTracker')}</label>
            <select 
              className="p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-w-[200px]"
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
            >
              {tags.map(t => <option key={t.id} value={t.id}>{t.name} ({t.accessoryId})</option>)}
            </select>
          </div>

          <div className="flex flex-col">
             <label className="text-xs text-slate-500 mb-1">{t('action')}</label>
             <div className="flex gap-2">
                <button
                  onClick={toggleTracking}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isTracking 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' 
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {isTracking ? <><Square size={18} fill="currentColor" /> {t('stop')}</> : <><Play size={18} fill="currentColor" /> {t('startTracking')}</>}
                </button>

                <button 
                  onClick={fetchUpdate}
                  disabled={loading}
                  className="p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  title="Force Refresh"
                >
                  <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
             </div>
          </div>
        </div>

        {activeVehicle ? (
           <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <Car className="text-primary-500" />
              <div>
                <p className="text-xs text-slate-500 font-medium">{t('linkedVehicle')}</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{activeVehicle.model}</p>
                <p className="text-xs font-mono text-slate-600 dark:text-slate-400">{activeVehicle.plate}</p>
              </div>
           </div>
        ) : (
           <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 opacity-60">
             <Car className="text-slate-400" />
             <span className="text-sm text-slate-500">{t('noVehicleLinked')}</span>
           </div>
        )}

        <div className="flex items-center gap-2">
           <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium"
           >
             <Download size={16} /> {t('exportCSV')}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
        <div className="lg:col-span-2 h-[400px] lg:h-full">
           <MapComponent locations={locations} />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full min-h-[400px]">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-800 dark:text-white">{t('liveData')}</h2>
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-slate-500">{locations.length} {t('pointsFound')}</p>
              {loading && <span className="text-xs text-primary-500 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> {t('updating')}</span>}
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {locations.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                {t('noHistory')}
              </div>
            ) : (
              locations.map((loc) => (
                <div key={loc.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      Conf: {loc.conf}%
                    </span>
                    <span className="text-xs text-slate-400">{new Date(loc.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">Lat:</span> {loc.lat.toFixed(6)} <br/>
                    <span className="font-semibold">Lon:</span> {loc.lon.toFixed(6)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {loc.isodatetime}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
