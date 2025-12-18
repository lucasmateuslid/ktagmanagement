
import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { storage } from '../services/storage';
import { fetchTagLocation, exportToCSV } from '../services/api';
import { geocodingService } from '../services/geocoding';
import { Tag, LocationHistory, Vehicle, VehicleCategory } from '../types';
import { MapComponent } from '../components/MapComponent';
import { useNotification } from '../contexts/NotificationContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  RefreshCw, Download, Play, Square, Car, Truck, Bike, AlertTriangle, 
  Share2, Search, MapPin, Copy, Check, MessageCircle, Send, 
  FileText, FileSpreadsheet, Loader2, Trash2, LayoutGrid, MapPinned, 
  Activity, Radar, ChevronRight, Wifi, WifiOff, Map as MapIcon, Filter
} from 'lucide-react';

const { useSearchParams } = ReactRouterDOM as any;

export const LiveMap = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [locations, setLocations] = useState<LocationHistory[]>([]);
  
  const [isTracking, setIsTracking] = useState(false);
  const [isFleetTracking, setIsFleetTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [reportAddresses, setReportAddresses] = useState<Record<string, string>>({});
  
  const [fleetStats, setFleetStats] = useState({ online: 0, noResponse: 0, withLocation: 0 });

  const { addNotification } = useNotification();
  const { setStatus, setLastSync } = useConnection();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams(); 
  const timerRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const [allTags, allVehicles, allCategories] = await Promise.all([
        storage.getTags(), storage.getVehicles(), storage.getCategories()
      ]);
      setTags(allTags);
      setVehicles(allVehicles);
      setCategories(allCategories);

      const urlTagId = searchParams.get('tagId');
      if (urlTagId && allTags.find(t => t.id === urlTagId)) {
        setSelectedTagId(urlTagId);
        if (searchParams.get('autoStart') === 'true') setIsTracking(true);
      } else if (allTags.length > 0 && !selectedTagId) {
        setSelectedTagId(allTags[0].id);
      }
    };
    loadData();
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchUpdate = async () => {
    if (!selectedTagId) return;
    const tag = tags.find(t => t.id === selectedTagId);
    if (!tag) return;

    setLoading(true);
    setStatus('syncing');
    try {
      const results = await fetchTagLocation(tag);
      if (results.length > 0) {
        const locs = results.map(l => ({
          ...l,
          tagId: tag.id,
          id: `${tag.id}-${l.timestamp}`
        } as LocationHistory));

        for (const loc of locs) {
          await storage.addLocation(loc);
        }

        setLocations(locs.sort((a, b) => b.timestamp - a.timestamp));
        setLastSync(Date.now());
        setStatus('connected');
      } else {
        addNotification('info', 'Sem Dados', 'Nenhuma localização recente encontrada para esta tag.');
      }
    } catch (e: any) {
      console.error(e);
      addNotification('error', 'Erro de Conexão', e.message);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const filteredTrackers = useMemo(() => {
    const term = tagSearchTerm.toLowerCase().trim();
    return tags.filter(tag => {
      const vehicle = vehicles.find(v => v.tagId === tag.id);
      return tag.name.toLowerCase().includes(term) || vehicle?.plate?.toLowerCase().includes(term);
    });
  }, [tags, vehicles, tagSearchTerm]);

  const fetchFleetUpdate = async () => {
      setLoading(true);
      setStatus('syncing');
      const linkedTags = tags.filter(t => vehicles.some(v => v.tagId === t.id && v.status !== 'maintenance'));
      let online = 0, noResponse = 0, withLocation = 0;

      const promises = linkedTags.map(async (tag) => {
          try {
              const results = await fetchTagLocation(tag);
              if (results.length > 0) {
                  online++;
                  withLocation++;
                  const latest = results[0];
                  const newLoc = { ...latest, tagId: tag.id, id: `${tag.id}-${latest.timestamp}` } as LocationHistory;
                  await storage.addLocation(newLoc);
                  return newLoc;
              } else {
                  online++; 
                  return null;
              }
          } catch (e) {
              noResponse++;
              return null;
          }
      });
      
      const results = await Promise.all(promises);
      setFleetStats({ online, noResponse, withLocation });
      setLocations(results.filter(r => r !== null) as LocationHistory[]);
      setLastSync(Date.now());
      setStatus('connected');
      setLoading(false);
  };

  useEffect(() => {
    if (isTracking) {
      const handler = isFleetTracking ? fetchFleetUpdate : fetchUpdate;
      handler();
      timerRef.current = window.setInterval(handler, 30000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, isFleetTracking, selectedTagId, tags, vehicles]);

  useEffect(() => {
    const resolve = async () => {
      const newAddresses = { ...reportAddresses };
      let changed = false;
      for (const loc of locations) {
        if (!newAddresses[loc.id]) {
          newAddresses[loc.id] = await geocodingService.reverseGeocode(loc.lat, loc.lon);
          changed = true;
        }
      }
      if (changed) setReportAddresses(newAddresses);
    };
    if (locations.length > 0) resolve();
  }, [locations]);

  const handleShare = async () => {
    if (!selectedTagId) return;
    
    // Verifica se há localização disponível para compartilhar
    if (locations.length === 0) {
        addNotification('info', 'Sem Localização', 'Este veículo/tag ainda não possui localização registrada para compartilhar.');
        return;
    }

    const latest = locations[0];
    const vehicle = vehicles.find(v => v.tagId === selectedTagId);
    
    // Gera o link do Google Maps baseado na última coordenada conhecida
    const googleMapsUrl = `https://www.google.com/maps?q=${latest.lat},${latest.lon}`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: `Localização Google Maps: ${vehicle?.plate || 'Veículo'}`,
                text: `Confira a localização em tempo real do veículo ${vehicle?.plate || ''} ${vehicle?.model || ''}`,
                url: googleMapsUrl
            });
        } catch (e) {
            // Fallback para cópia se o compartilhamento falhar
            await navigator.clipboard.writeText(googleMapsUrl);
            addNotification('success', 'Link Copiado', 'Link do Google Maps copiado para a área de transferência.');
        }
    } else {
        await navigator.clipboard.writeText(googleMapsUrl);
        addNotification('success', 'Link Copiado', 'Link do Google Maps copiado para a área de transferência.');
    }
  };

  const toggleTracking = () => {
    setIsTracking(!isTracking);
  };

  const activeVehicle = vehicles.find(v => v.tagId === selectedTagId);
  const selectedTag = tags.find(t => t.id === selectedTagId);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] gap-6 font-sans">
      
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-[32px] shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col xl:flex-row xl:items-center gap-4 justify-between shrink-0">
        
        <div className="flex flex-wrap items-center gap-3">
          <div className={`relative ${isFleetTracking ? 'opacity-30 pointer-events-none grayscale' : ''}`} ref={dropdownRef}>
            <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="flex items-center gap-3 px-5 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-primary-500 transition-all text-sm font-black uppercase tracking-tight min-w-[260px] shadow-sm"
            >
                <Radar className="text-primary-500" size={18} />
                <span className="truncate flex-1 text-left text-zinc-900 dark:text-zinc-100">
                  {activeVehicle ? `${activeVehicle.plate} - ${selectedTag?.name}` : (selectedTag ? selectedTag.name : 'Selecionar Veículo')}
                </span>
                <ChevronRight size={14} className={`text-zinc-400 transition-transform ${isSearchOpen ? 'rotate-90' : ''}`} />
            </button>
            {isSearchOpen && (
                <div className="absolute top-full left-0 w-full md:w-[360px] mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-2xl z-[500] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                   <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="relative">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                         <input type="text" placeholder="Placa ou Nome..." value={tagSearchTerm} onChange={e => setTagSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                   </div>
                   <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
                      {filteredTrackers.map(t => {
                        const v = vehicles.find(veh => veh.tagId === t.id);
                        return (
                          <button key={t.id} onClick={() => { setSelectedTagId(t.id); setIsSearchOpen(false); }} className={`w-full p-3 text-left rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between group transition-all ${selectedTagId === t.id ? 'bg-primary-500/10 border-primary-500/20' : ''}`}>
                             <div>
                                <div className="font-black text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-tight">{t.name}</div>
                                <div className="text-[10px] font-bold text-zinc-400 uppercase mt-0.5">{v?.plate || 'SEM VÍNCULO'}</div>
                             </div>
                             <ChevronRight size={14} className="text-zinc-300 group-hover:text-primary-500" />
                          </button>
                        )
                      })}
                   </div>
                </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTracking}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-[0.1em] text-[10px] transition-all shadow-lg ${isTracking ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-zinc-900 dark:bg-primary-500 text-white dark:text-black shadow-primary-500/20'}`}
            >
              {isTracking ? <><Square size={14} fill="currentColor" /> PARAR</> : <><Play size={14} fill="currentColor" /> RASTREAR</>}
            </button>
            <button onClick={() => isFleetTracking ? fetchFleetUpdate() : fetchUpdate()} className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl hover:text-primary-500 transition-colors">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleShare} disabled={!selectedTagId || isFleetTracking} className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl hover:text-primary-500 transition-colors disabled:opacity-30">
              <Share2 size={18} />
            </button>
          </div>
        </div>

        {isFleetTracking && (
          <div className="flex flex-wrap items-center gap-3 bg-zinc-50 dark:bg-zinc-950 p-2 rounded-2xl border border-zinc-100 dark:border-zinc-800">
             <div className="px-4 py-2 flex items-center gap-3 border-r border-zinc-200 dark:border-zinc-800">
                <Wifi size={14} className="text-emerald-500" />
                <div className="flex flex-col"><span className="text-xs font-black text-zinc-900 dark:text-white leading-none">{fleetStats.online}</span><span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Online</span></div>
             </div>
             <div className="px-4 py-2 flex items-center gap-3 border-r border-zinc-200 dark:border-zinc-800">
                <WifiOff size={14} className="text-red-500" />
                <div className="flex flex-col"><span className="text-xs font-black text-zinc-900 dark:text-white leading-none">{fleetStats.noResponse}</span><span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Sem Sinal</span></div>
             </div>
             <div className="px-4 py-2 flex items-center gap-3">
                <MapPinned size={14} className="text-primary-500" />
                <div className="flex flex-col"><span className="text-xs font-black text-zinc-900 dark:text-white leading-none">{fleetStats.withLocation}</span><span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Localizados</span></div>
             </div>
          </div>
        )}

        <div className="flex items-center gap-2">
            <button 
              onClick={() => { setIsFleetTracking(!isFleetTracking); if(isTracking) setIsTracking(false); }} 
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isFleetTracking ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white shadow-xl' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:border-primary-500'}`}
            >
              <LayoutGrid size={16} /> {isFleetTracking ? 'Módulo Frota ATIVO' : 'Modo Frota'}
            </button>
            <button className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-2xl hover:text-red-500 transition-colors">
              <Download size={18} />
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        <div className="w-full lg:w-[340px] bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-sm shrink-0">
          <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Status Intelligence</h2>
                <div className="flex gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                   <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_#f59e0b]" />
                </div>
             </div>
             {activeVehicle && !isFleetTracking ? (
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-[24px] bg-zinc-900 flex items-center justify-center text-primary-500 border border-zinc-800 shadow-xl shrink-0"><Car size={32}/></div>
                   <div className="min-w-0">
                      <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter truncate leading-tight">{activeVehicle.plate}</h3>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1 truncate">{activeVehicle.model}</p>
                   </div>
                </div>
             ) : isFleetTracking ? (
                <div className="flex items-center gap-4 p-4 bg-zinc-900 text-white rounded-3xl border border-zinc-800 shadow-2xl">
                   <LayoutGrid size={24} className="text-primary-500" />
                   <div>
                      <div className="text-xs font-black uppercase tracking-widest leading-none">Visão Geral</div>
                      <div className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-tighter">{locations.length} Veículos na malha</div>
                   </div>
                </div>
             ) : (
                <div className="py-6 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                   <Radar size={32} className="mx-auto text-zinc-300 mb-2 animate-pulse" />
                   <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Aguardando Veículo</span>
                </div>
             )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-zinc-50/20 dark:bg-black/20">
             {locations.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-4 grayscale opacity-40">
                   <MapIcon size={48} className="text-zinc-400" />
                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] max-w-[140px]">Inicie o rastreio para popular os dados</p>
                </div>
             ) : (
                locations.map(loc => {
                  const v = vehicles.find(veh => veh.tagId === loc.tagId);
                  return (
                    <div key={loc.id} className="p-5 rounded-[24px] bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm hover:border-primary-500 transition-all cursor-pointer group">
                       <div className="flex justify-between items-start mb-3">
                          <span className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{v?.plate || 'SINAL'}</span>
                          <div className="flex items-center gap-2"><span className="text-[10px] font-mono text-zinc-400">{new Date(loc.timestamp).toLocaleTimeString()}</span><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /></div>
                       </div>
                       <div className="text-[11px] text-zinc-500 leading-relaxed font-medium mb-4 line-clamp-2">
                          {reportAddresses[loc.id] || 'Resolvendo endereço físico...'}
                       </div>
                       <div className="flex items-center justify-between pt-4 border-t border-zinc-50 dark:border-zinc-700/50">
                          <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-tighter"><MapPin size={10} className="text-red-500" /> {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}</div>
                          <div className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-[9px] font-black text-zinc-500 uppercase tracking-widest">Conf {loc.conf}%</div>
                       </div>
                    </div>
                  )
                })
             )}
          </div>
        </div>

        <div className="flex-1 rounded-[40px] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 relative z-0">
           <MapComponent locations={locations} isFleetMode={isFleetTracking} vehicles={vehicles} />
        </div>
      </div>
    </div>
  );
};
