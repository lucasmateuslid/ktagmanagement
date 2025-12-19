
import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { storage } from '../services/storage';
import { fetchTagLocation } from '../services/api';
import { Tag, LocationHistory, Vehicle } from '../types';
import { MapComponent } from '../components/MapComponent';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  RefreshCw, Play, Square, Search, Share2, 
  ChevronDown, LayoutGrid, Car, X, Tag as TagIcon, Hash
} from 'lucide-react';

const { useSearchParams } = ReactRouterDOM as any;

export const LiveMap = () => {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [locations, setLocations] = useState<LocationHistory[]>([]);
  const [fleetLocations, setFleetLocations] = useState<LocationHistory[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isFleetMode, setIsFleetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  
  const { addNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams(); 
  const timerRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isClient = user?.role === 'client';

  const loadData = async () => {
    let [allTags, allVehicles] = await Promise.all([storage.getTags(), storage.getVehicles()]);
    
    if (isClient && user?.cpf) {
      const myClientData = (await storage.getClients()).find(c => c.cpf.replace(/\D/g, '') === user.cpf);
      if (myClientData) {
        allVehicles = allVehicles.filter(v => v.clientId === myClientData.id);
        allTags = allTags.filter(t => allVehicles.some(v => v.tagId === t.id));
      }
    }

    setTags(allTags);
    setVehicles(allVehicles);

    const urlTagId = searchParams.get('tagId');
    if (urlTagId && allTags.find(t => t.id === urlTagId)) {
      setSelectedTagId(urlTagId);
      if (searchParams.get('autoStart') === 'true') setIsTracking(true);
    } else if (allTags.length > 0 && !selectedTagId) {
      setSelectedTagId(allTags[0].id);
    }
  };

  useEffect(() => { loadData(); }, [searchParams, user]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchUpdate = async () => {
    if (isFleetMode) {
      setLoading(true);
      try {
        const results = await Promise.all(tags.map(async (tag) => {
           try {
             const res = await fetchTagLocation(tag);
             return res.length > 0 ? { ...res[0], tagId: tag.id, id: `${tag.id}-${res[0].timestamp}` } as LocationHistory : null;
           } catch(e) { return null; }
        }));
        const validResults = results.filter((r): r is LocationHistory => r !== null);
        setFleetLocations(validResults);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedTagId) return;
    const tag = tags.find(t => t.id === selectedTagId);
    if (!tag) return;

    setLoading(true);
    try {
      const results = await fetchTagLocation(tag);
      if (results.length > 0) {
        const locs = results.map(l => ({ ...l, tagId: tag.id, id: `${tag.id}-${l.timestamp}` } as LocationHistory));
        for (const loc of locs) await storage.addLocation(loc);
        setLocations(locs.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (e: any) {
      addNotification('error', 'Erro', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isTracking || isFleetMode) {
      fetchUpdate();
      timerRef.current = window.setInterval(fetchUpdate, 30000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, isFleetMode, selectedTagId]);

  const handleShare = () => {
    if (!selectedTagId) return;
    const lastLoc = locations[0] || fleetLocations.find(l => l.tagId === selectedTagId);
    if (!lastLoc) {
      addNotification('info', 'Aguarde', 'Buscando posição para compartilhar...');
      fetchUpdate();
      return;
    }
    const url = `https://www.google.com/maps?q=${lastLoc.lat},${lastLoc.lon}`;
    navigator.clipboard.writeText(url);
    addNotification('success', 'Link Copiado', 'Localização pronta para compartilhar no WhatsApp/Maps.');
  };

  const filteredSearchTags = useMemo(() => {
    const term = tagSearchTerm.toLowerCase();
    return tags.filter(t => {
      const v = vehicles.find(v => v.tagId === t.id);
      return t.name.toLowerCase().includes(term) || 
             t.accessoryId.toLowerCase().includes(term) || 
             v?.plate.toLowerCase().includes(term) ||
             v?.model.toLowerCase().includes(term);
    });
  }, [tags, vehicles, tagSearchTerm]);

  const activeVehicle = vehicles.find(v => v.tagId === selectedTagId);

  return (
    <div className="flex flex-col h-full lg:h-[calc(100vh-10rem)] gap-4 font-sans">
      
      {/* BARRA DE AÇÕES (Z-INDEX BAIXO PARA NÃO SOBREPOR SIDEBAR) */}
      <div className="bg-white dark:bg-zinc-900 p-2 md:px-5 md:py-4 rounded-[32px] md:rounded-full shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-wrap lg:flex-nowrap items-center gap-2 md:gap-3 w-full relative z-30">
        
        {/* Seletor de Busca Intuitivo */}
        <div className="relative flex-1 min-w-[280px]" ref={dropdownRef}>
          <div className={`relative group transition-all rounded-2xl border-2 ${isSearchOpen ? 'border-primary-500 shadow-lg' : 'border-transparent'}`}>
            <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isSearchOpen ? 'text-primary-500' : 'text-zinc-400'}`} />
            <input 
              type="text"
              placeholder="Buscar por Placa, SN ou Nome..." 
              value={tagSearchTerm}
              onFocus={() => setIsSearchOpen(true)}
              onChange={e => { setTagSearchTerm(e.target.value); setIsSearchOpen(true); }}
              className="w-full pl-11 pr-12 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
            {tagSearchTerm && (
              <button onClick={() => setTagSearchTerm('')} className="absolute right-12 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><X size={14}/></button>
            )}
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <ChevronDown size={14} className={`text-zinc-300 transition-transform ${isSearchOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {isSearchOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-2 border-b border-zinc-50 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
                 <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-3">Resultados da busca ({filteredSearchTags.length})</span>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
                {filteredSearchTags.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center gap-2">
                     <Search size={24} className="text-zinc-200" />
                     <span className="text-[10px] font-black text-zinc-400 uppercase">Nenhum veículo localizado</span>
                  </div>
                ) : (
                  filteredSearchTags.map(t => {
                    const v = vehicles.find(veh => veh.tagId === t.id);
                    const isSelected = selectedTagId === t.id;
                    return (
                      <button 
                        key={t.id} 
                        onClick={() => { setSelectedTagId(t.id); setIsSearchOpen(false); setIsFleetMode(false); setTagSearchTerm(''); }} 
                        className={`w-full p-3 mb-1 text-left rounded-xl flex items-center justify-between group transition-all ${isSelected ? 'bg-primary-500 text-black' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100'}`}
                      >
                        <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-lg ${isSelected ? 'bg-black/10' : 'bg-zinc-100 dark:bg-zinc-800 group-hover:bg-white'}`}>
                              <Car size={18} className={isSelected ? 'text-black' : 'text-zinc-400'} />
                           </div>
                           <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                 <span className="font-black text-sm uppercase tracking-tighter">{v?.plate || 'S/ PLACA'}</span>
                                 <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${isSelected ? 'bg-black/20' : 'bg-primary-500/10 text-primary-600'}`}>PLACA</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 opacity-70">
                                 <span className="text-[10px] font-bold uppercase truncate max-w-[120px]">{v?.model || t.name}</span>
                                 <span className="text-[10px]">•</span>
                                 <span className="text-[9px] font-mono">SN: {t.accessoryId}</span>
                              </div>
                           </div>
                        </div>
                        {isSelected && <div className="w-6 h-6 bg-black/10 rounded-full flex items-center justify-center"><Play size={12} fill="currentColor" /></div>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Grupo de Botões (Ajustado para mobile) */}
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar py-1">
          <button 
            onClick={() => { setIsTracking(!isTracking); setIsFleetMode(false); }} 
            className={`whitespace-nowrap flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg transition-all active:scale-95 shrink-0 ${isTracking ? 'bg-red-600 text-white' : 'bg-[#18181b] dark:bg-zinc-800 text-white hover:bg-black'}`}
          >
            {isTracking ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            {isTracking ? 'PARAR' : 'RASTREAR'}
          </button>

          <button 
            onClick={fetchUpdate} 
            className="p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 rounded-2xl transition-all shrink-0"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin text-primary-500' : ''}/>
          </button>

          <button 
            onClick={handleShare}
            disabled={!selectedTagId}
            className="p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 rounded-2xl transition-all disabled:opacity-30 shrink-0"
          >
            <Share2 size={20} />
          </button>

          <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          <button 
            onClick={() => { setIsFleetMode(!isFleetMode); setIsTracking(false); }}
            className={`whitespace-nowrap flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all border shrink-0 ${isFleetMode ? 'bg-primary-500 text-black border-primary-500 shadow-lg' : 'bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}
          >
            <LayoutGrid size={16} /> FROTA
          </button>
        </div>
      </div>

      {/* MAP AND INFO AREA */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        <div className="flex-1 order-1 lg:order-2 rounded-[32px] md:rounded-[40px] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 relative z-0">
           <MapComponent 
              locations={isFleetMode ? fleetLocations : locations} 
              isFleetMode={isFleetMode} 
              vehicles={vehicles}
            />
           
           {isFleetMode && (
             <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-white font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 z-10 shadow-2xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Monitorando {fleetLocations.length} Veículos
             </div>
           )}
        </div>

        <div className="w-full lg:w-[320px] order-2 lg:order-1 bg-white dark:bg-zinc-900 rounded-[32px] md:rounded-[40px] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-sm">
          <div className="p-5 border-b border-zinc-50 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
             <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-4">
                {isFleetMode ? 'Resumo da Frota' : 'Relatório de Posição'}
             </h2>
             
             {!isFleetMode && activeVehicle ? (
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-[16px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-primary-500 border border-zinc-800 shadow-lg shrink-0 pulse-glow"><Car size={24}/></div>
                   <div className="min-w-0">
                      <h3 className="text-lg font-display font-black text-zinc-900 dark:text-white uppercase leading-tight tracking-tighter">{activeVehicle.plate}</h3>
                      <p className="text-[9px] font-black text-zinc-400 uppercase mt-0.5 truncate">{activeVehicle.model}</p>
                   </div>
                </div>
             ) : isFleetMode ? (
                <div className="grid grid-cols-2 gap-2">
                   <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-inner">
                      <p className="text-[8px] font-black text-zinc-400 uppercase mb-1">Ativos</p>
                      <p className="text-xl font-display font-black text-emerald-500">{fleetLocations.length}</p>
                   </div>
                   <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-inner">
                      <p className="text-[8px] font-black text-zinc-400 uppercase mb-1">Total</p>
                      <p className="text-xl font-display font-black text-primary-500">{tags.length}</p>
                   </div>
                </div>
             ) : (
                <div className="py-4 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl text-[9px] font-black text-zinc-400 uppercase">Selecione um veículo</div>
             )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
             {isFleetMode ? (
                fleetLocations.map(loc => {
                   const v = vehicles.find(veh => veh.tagId === loc.tagId);
                   return (
                      <div key={loc.id} onClick={() => { setSelectedTagId(loc.tagId); setIsFleetMode(false); }} className="p-4 rounded-[20px] bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm group cursor-pointer hover:border-primary-500 transition-all">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-[11px] font-black uppercase text-zinc-900 dark:text-white">{v?.plate || 'S/ PLACA'}</span>
                           <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                        </div>
                        <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase">
                           <span>Conf: {loc.conf}%</span>
                           <span>{new Date(loc.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                   );
                })
             ) : (
                locations.map(loc => (
                  <div key={loc.id} className="p-4 rounded-[20px] bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-black uppercase dark:text-zinc-200">{new Date(loc.timestamp).toLocaleTimeString()}</span>
                        <div className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-full text-[8px] font-black text-zinc-400 uppercase tracking-widest">{loc.conf}% Conf.</div>
                     </div>
                     <p className="text-[10px] text-zinc-500 font-medium leading-relaxed italic">Log: {loc.lat.toFixed(5)}, {loc.lon.toFixed(5)}</p>
                  </div>
                ))
             )}
          </div>
        </div>
      </div>
      
      <style>{`
        .pulse-glow { animation: pulse-yellow 2s infinite; }
        @keyframes pulse-yellow {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
      `}</style>
    </div>
  );
};
