
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { fetchTagLocation, exportToCSV } from '../services/api';
import { Tag, LocationHistory, Vehicle } from '../types';
import { MapComponent } from '../components/MapComponent';
import { useNotification } from '../contexts/NotificationContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshCw, Download, Play, Square, Car, AlertTriangle, Share2, Search, MapPin, Copy, Check, MessageCircle, Send } from 'lucide-react';

export const LiveMap = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [locations, setLocations] = useState<LocationHistory[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Search state for dropdown
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  
  // Share Dropdown state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  
  const { addNotification } = useNotification();
  const { setStatus, setLastSync } = useConnection();
  const { t } = useLanguage();
  const timerRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const allTags = await storage.getTags();
      const allVehicles = await storage.getVehicles();
      setTags(allTags);
      setVehicles(allVehicles);
      if (allTags.length > 0 && !selectedTagId) setSelectedTagId(allTags[0].id);
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
  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase()) || 
    tag.accessoryId.toLowerCase().includes(tagSearchTerm.toLowerCase())
  );

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

  const getShareUrl = () => {
    if (locations.length === 0) return null;
    const last = locations[0];
    return `https://www.google.com/maps/search/?api=1&query=${last.lat},${last.lon}`;
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
    if (!url) {
      addNotification('error', t('shareLocation'), t('noHistory'));
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback(true);
      setTimeout(() => {
          setCopyFeedback(false);
          setIsShareOpen(false);
      }, 2000);
      addNotification('success', t('shareLocation'), t('locationCopied'));
    } catch (err) {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    const url = getShareUrl();
    if (!url) {
      addNotification('error', t('shareLocation'), t('noHistory'));
      return;
    }
    const text = encodeURIComponent(`📍 ${t('shareLocation')}: ${url}`);
    
    // Clean number: remove anything that is not a digit
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    
    let waUrl = '';
    if (cleanNumber) {
      waUrl = `https://wa.me/${cleanNumber}?text=${text}`;
    } else {
      waUrl = `https://wa.me/?text=${text}`;
    }
    
    window.open(waUrl, '_blank');
    setIsShareOpen(false);
    setWhatsappNumber('');
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
        
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Custom Searchable Dropdown */}
          <div className="flex flex-col relative" ref={dropdownRef}>
            <label className="text-xs text-slate-500 mb-1">{t('selectTracker')}</label>
            <div 
                className="w-full md:w-64 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-between cursor-pointer"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
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
                        {filteredTags.map(t => (
                            <div 
                                key={t.id}
                                className={`px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedTagId === t.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'text-slate-700 dark:text-slate-200'}`}
                                onClick={() => {
                                    setSelectedTagId(t.id);
                                    setIsSearchOpen(false);
                                    setTagSearchTerm('');
                                }}
                            >
                                <div className="font-medium">{t.name}</div>
                                <div className="text-xs text-slate-400">{t.accessoryId}</div>
                            </div>
                        ))}
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
                  onClick={fetchUpdate}
                  disabled={loading}
                  className="p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  title="Force Refresh"
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
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

        <div className="flex items-center gap-2 relative" ref={shareRef}>
           <button 
              onClick={() => setIsShareOpen(!isShareOpen)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors ${isShareOpen ? 'border-primary-500 ring-2 ring-primary-100 dark:ring-primary-900/30' : 'border-slate-300 dark:border-slate-700'}`}
              title={t('shareLocation')}
           >
             <Share2 size={16} /> <span className="hidden sm:inline">{t('shareLocation')}</span>
           </button>
           
           {isShareOpen && (
             <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
               <button 
                 onClick={handleCopyLink}
                 className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
               >
                 {copyFeedback ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                 {copyFeedback ? <span className="text-green-600 font-medium">Copied!</span> : <span>Copy Link</span>}
               </button>
               
               <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                     <MessageCircle size={12} className="text-green-600" /> WhatsApp
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="5511999999999"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="flex-1 text-xs px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-green-500"
                    />
                    <button 
                      onClick={handleWhatsApp}
                      className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded flex items-center justify-center transition-colors"
                      title="Send"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Empty for contact list</p>
               </div>
             </div>
           )}

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
