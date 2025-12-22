import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../services/storage';
import { fetchTagLocation } from '../services/api';
import { geocodingService } from '../services/geocoding';
import { Tag, LocationHistory, Vehicle } from '../types';
import { MapComponent } from '../components/MapComponent';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  RefreshCw, Play, Square, Search, Share2, 
  ChevronDown, Car, Activity, MapPin, 
  CheckCircle2, Clock, Hash, Download, FileText, FileSpreadsheet, Map as MapIcon
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const { useSearchParams } = ReactRouterDOM as any;

export const LiveMap = () => {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [locations, setLocations] = useState<LocationHistory[]>([]);
  const [fleetLocations, setFleetLocations] = useState<LocationHistory[]>([]);
  const [resolvedAddresses, setResolvedAddresses] = useState<Record<string, string>>({});
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
  const isMobile = window.innerWidth < 1024;

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

  const resolveAddressForLocation = async (loc: LocationHistory) => {
    if (resolvedAddresses[loc.id]) return;
    try {
      const addr = await geocodingService.reverseGeocode(loc.lat, loc.lon);
      setResolvedAddresses(prev => ({ ...prev, [loc.id]: addr }));
    } catch (e) {}
  };

  const fetchUpdate = async (isInitial = false) => {
    if (isFleetMode) {
      setLoading(true);
      try {
        const results = await Promise.all(tags.map(async (tag) => {
           try {
             const res = await fetchTagLocation(tag);
             return res.length > 0 ? { ...res[0], tagId: tag.id, id: `${tag.id}-${res[0].timestamp}` } as LocationHistory : null;
           } catch(e) { return null; }
        }));
        const valid = results.filter((r): r is LocationHistory => r !== null);
        setFleetLocations(valid);
        if (valid[0]) resolveAddressForLocation(valid[0]);
      } finally { setLoading(false); }
      return;
    }

    if (!selectedTagId) return;
    const tag = tags.find(t => t.id === selectedTagId);
    if (!tag) return;

    if (!isInitial) setLoading(true);
    try {
      const results = await fetchTagLocation(tag);
      if (results.length > 0) {
        const locs = results.map(l => ({ ...l, tagId: tag.id, id: `${tag.id}-${l.timestamp}` } as LocationHistory));
        for (const loc of locs) await storage.addLocation(loc);
        const sorted = locs.sort((a, b) => b.timestamp - a.timestamp);
        setLocations(sorted);
        // Resolve os endereços dos 3 pontos mais recentes
        sorted.slice(0, 3).forEach(l => resolveAddressForLocation(l));
      }
    } catch (e: any) {
      if (!isInitial) addNotification('error', 'Erro K-Tag', e.message);
    } finally {
      if (!isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTagId && !isTracking) {
        setLocations([]); 
        fetchUpdate(true); 
    }
  }, [selectedTagId]);

  useEffect(() => {
    if (isTracking || isFleetMode) {
      fetchUpdate();
      timerRef.current = window.setInterval(fetchUpdate, 30000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, isFleetMode, selectedTagId]);

  const exportPDF = () => {
    if (locations.length === 0) return;
    const activeV = vehicles.find(v => v.tagId === selectedTagId);
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(24, 24, 27);
    doc.text("Relatório de Trajetória", 14, 20);
    doc.setFontSize(10);
    doc.text(`Veículo: ${activeV?.plate || 'N/A'} - ${activeV?.model || 'N/A'}`, 14, 28);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 34);
    
    const tableData = locations.map(l => [
      new Date(l.timestamp).toLocaleString(),
      `${l.lat.toFixed(6)}, ${l.lon.toFixed(6)}`,
      `${l.conf}%`,
      resolvedAddresses[l.id] || 'Endereço não resolvido'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Horário', 'Coordenadas', 'Precisão', 'Endereço Aproximado']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [24, 24, 27] }
    });
    doc.save(`trajetoria_${activeV?.plate || selectedTagId}.pdf`);
  };

  const exportExcel = () => {
    if (locations.length === 0) return;
    const activeV = vehicles.find(v => v.tagId === selectedTagId);
    const data = locations.map(l => ({
      'Data/Hora': new Date(l.timestamp).toLocaleString(),
      'Latitude': l.lat,
      'Longitude': l.lon,
      'Confianca %': l.conf,
      'Endereco': resolvedAddresses[l.id] || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trajetória");
    XLSX.writeFile(wb, `trajetoria_${activeV?.plate || selectedTagId}.xlsx`);
  };

  const handleShare = () => {
    const lastLoc = locations[0] || fleetLocations.find(l => l.tagId === selectedTagId);
    if (!lastLoc) return;
    const url = `https://www.google.com/maps?q=${lastLoc.lat},${lastLoc.lon}`;
    navigator.clipboard.writeText(url);
    addNotification('success', 'Compartilhamento', 'Link de localização copiado.');
  };

  const filteredSearchTags = useMemo(() => {
    const term = tagSearchTerm.toLowerCase().trim();
    if (!term) return tags.slice(0, 10);
    return tags.filter(t => {
      const v = vehicles.find(v => v.tagId === t.id);
      return t.name.toLowerCase().includes(term) || 
             t.accessoryId.toLowerCase().includes(term) || 
             v?.plate.toLowerCase().includes(term);
    });
  }, [tags, vehicles, tagSearchTerm]);

  const activeVehicle = vehicles.find(v => v.tagId === selectedTagId);
  const activeTag = tags.find(t => t.id === selectedTagId);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-10rem)] gap-4 font-sans overflow-hidden">
      
      {/* BARRA DE AÇÕES */}
      <div className="bg-white dark:bg-zinc-900 p-2.5 md:px-6 md:py-4 rounded-3xl md:rounded-full shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-wrap lg:flex-nowrap items-center gap-2 w-full relative z-30">
        
        <div className="relative flex-1 min-w-[200px]" ref={dropdownRef}>
          <div className={`relative transition-all rounded-2xl border-2 ${isSearchOpen ? 'border-primary-500 shadow-lg shadow-primary-500/10' : 'border-transparent'}`}>
            <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isSearchOpen ? 'text-primary-500' : 'text-zinc-400'}`} />
            <input 
              type="text"
              placeholder="Buscar por Placa, SN ou Nome..." 
              value={tagSearchTerm}
              onFocus={() => setIsSearchOpen(true)}
              onChange={e => { setTagSearchTerm(e.target.value); setIsSearchOpen(true); }}
              className="w-full pl-11 pr-10 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black outline-none text-zinc-900 dark:text-white"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <ChevronDown size={14} className={`text-zinc-300 transition-transform ${isSearchOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          <AnimatePresence>
            {isSearchOpen && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[28px] shadow-2xl z-50 overflow-hidden flex flex-col">
                <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
                  {filteredSearchTags.map(t => {
                    const v = vehicles.find(veh => veh.tagId === t.id);
                    const isSelected = selectedTagId === t.id;
                    return (
                      <button key={t.id} onClick={() => { setSelectedTagId(t.id); setIsSearchOpen(false); setTagSearchTerm(''); }} className={`w-full p-4 mb-1 text-left rounded-2xl flex items-center justify-between transition-all ${isSelected ? 'bg-primary-500 text-black shadow-lg' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                         <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-black/10' : 'bg-zinc-100 dark:bg-zinc-700'}`}><Car size={18} /></div>
                            <div className="flex flex-col">
                               <div className="flex items-center gap-2">
                                  <span className="font-black text-xs uppercase">{v?.plate || 'S/ PLACA'}</span>
                                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${isSelected ? 'bg-black/10 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>SN: {t.accessoryId}</span>
                               </div>
                               <span className={`text-[9px] font-bold uppercase tracking-tight ${isSelected ? 'text-black/60' : 'text-zinc-400'}`}>{v?.model || t.name}</span>
                            </div>
                         </div>
                         {isSelected && <CheckCircle2 size={16} className="text-black" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 shrink-0">
          <button 
            disabled={!selectedTagId}
            onClick={() => { setIsTracking(!isTracking); setIsFleetMode(false); }} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-30 ${isTracking ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-900 dark:bg-zinc-800 text-white'}`}
          >
            {isTracking ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            {isTracking ? 'PARAR' : 'RASTREAR'}
          </button>

          <button onClick={() => fetchUpdate()} className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl">
            <RefreshCw size={20} className={loading ? 'animate-spin text-primary-500' : ''}/>
          </button>

          <button onClick={handleShare} disabled={!selectedTagId} className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl disabled:opacity-30">
            <Share2 size={20} />
          </button>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

          <button 
            onClick={() => { setIsFleetMode(!isFleetMode); setIsTracking(false); }}
            className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest border transition-all ${isFleetMode ? 'bg-primary-500 text-black border-primary-500 shadow-lg shadow-primary-500/20' : 'bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-800'}`}
          >
            FROTA
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
        <div className="flex-1 order-1 lg:order-2 rounded-[32px] overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-0 shadow-inner h-full min-h-[350px]">
           <MapComponent locations={isFleetMode ? fleetLocations : locations} isFleetMode={isFleetMode} vehicles={vehicles} highlightedTagId={selectedTagId} />
           
           {isFleetMode && (
             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-white font-black text-[9px] uppercase tracking-[0.2em] flex items-center gap-3 z-10 shadow-2xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Monitorando {fleetLocations.length} Veículos
             </div>
           )}
        </div>

        {/* PAINEL LATERAL */}
        <div className={`w-full lg:w-[360px] order-2 lg:order-1 bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-sm transition-all h-full`}>
          
          <AnimatePresence mode="wait">
            {selectedTagId ? (
              <motion.div key="selected" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col h-full">
                <div className={`p-6 border-b transition-colors ${isTracking ? 'bg-red-500/5 border-red-500/10' : 'bg-primary-500/10 border-primary-500/20'}`}>
                   <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shrink-0 ${isTracking ? 'bg-red-600 text-white animate-pulse' : 'bg-zinc-900 text-primary-500'}`}><Car size={28}/></div>
                      <div className="min-w-0">
                         <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase leading-none">{activeVehicle?.plate || 'S/ PLACA'}</h3>
                         <div className="flex items-center gap-1.5 mt-2"><div className={`w-1.5 h-1.5 rounded-full ${isTracking ? 'bg-red-500 animate-ping' : 'bg-primary-500'}`} /><p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{isTracking ? 'RASTREAMENTO EM TEMPO REAL' : 'DISPOSITIVO VINCULADO'}</p></div>
                      </div>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                   {/* Botões de Exportação */}
                   <div className="flex gap-2">
                      <button onClick={exportPDF} disabled={locations.length === 0} className="flex-1 py-3 bg-zinc-900 text-white dark:bg-zinc-800 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-30"><FileText size={14}/> Trajetória PDF</button>
                      <button onClick={exportExcel} disabled={locations.length === 0} className="flex-1 py-3 bg-primary-500 text-black rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary-400 transition-all disabled:opacity-30"><FileSpreadsheet size={14}/> Excel</button>
                   </div>

                   {/* Dados Técnicos */}
                   <div className="p-5 bg-zinc-50 dark:bg-zinc-850 rounded-[28px] border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest block mb-4">Identificação Técnica</span>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                           <div className="flex items-center gap-2 uppercase text-zinc-500"><Hash size={12} className="text-primary-500" /> Serial</div>
                           <span className="font-mono text-zinc-900 dark:text-zinc-200">{activeTag?.accessoryId}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold">
                           <div className="flex items-center gap-2 uppercase text-zinc-500"><Activity size={12} className="text-primary-500" /> Tag</div>
                           <span className="truncate max-w-[160px] text-zinc-900 dark:text-zinc-200">{activeTag?.name}</span>
                        </div>
                      </div>
                   </div>

                   {/* Localização Atual com Endereço */}
                   {locations.length > 0 && (
                     <div className="p-5 bg-zinc-50 dark:bg-zinc-850 rounded-[28px] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-1"><MapPin size={10} className="text-primary-500"/> Localização Atual</span>
                          <span className="text-[8px] font-mono text-zinc-400">{new Date(locations[0].timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 leading-relaxed italic">{resolvedAddresses[locations[0].id] || 'Buscando endereço legível...'}</p>
                        <div className="mt-3 flex items-center justify-between pt-3 border-t border-zinc-200/50 dark:border-zinc-800">
                            <span className="text-[9px] font-black text-emerald-500 uppercase">{locations[0].conf}% de Precisão</span>
                            <span className="text-[9px] text-zinc-400 font-medium">{locations[0].lat.toFixed(5)}, {locations[0].lon.toFixed(5)}</span>
                        </div>
                     </div>
                   )}

                   <div className="pt-2">
                      <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block mb-4 flex items-center gap-2"><Clock size={12}/> Histórico Recente</span>
                      <div className="space-y-2">
                        {isFleetMode ? fleetLocations.map(loc => {
                              const v = vehicles.find(veh => veh.tagId === loc.tagId);
                              const t = tags.find(tag => tag.id === loc.tagId);
                              const isThisSelected = selectedTagId === loc.tagId;
                              return (
                                 <div key={loc.id} onClick={() => setSelectedTagId(loc.tagId)} className={`p-4 rounded-[22px] border cursor-pointer transition-all group ${isThisSelected ? 'bg-primary-500 border-primary-500 shadow-lg' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 hover:border-primary-500/50'}`}>
                                   <div className="flex justify-between items-center mb-1.5">
                                      <div className="flex flex-col">
                                         <span className={`text-xs font-black uppercase ${isThisSelected ? 'text-black' : 'text-zinc-900 dark:text-white'}`}>{v?.plate || 'S/ PLACA'}</span>
                                         <span className={`text-[8px] font-mono ${isThisSelected ? 'text-black/60' : 'text-zinc-400'}`}>SN: {t?.accessoryId}</span>
                                      </div>
                                      <div className={`w-2 h-2 rounded-full ${isThisSelected ? 'bg-white shadow-[0_0_8px_white]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
                                   </div>
                                   <p className={`text-[9px] font-bold uppercase ${isThisSelected ? 'text-black/60' : 'text-zinc-400'}`}>Visto em {new Date(loc.timestamp).toLocaleTimeString()}</p>
                                 </div>
                              );
                           }) : locations.slice(0, 20).map(loc => (
                             <div key={loc.id} className="p-4 rounded-[22px] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 transition-colors group hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                <div className="flex justify-between items-center mb-2">
                                   <span className="text-[10px] font-black uppercase dark:text-zinc-200">{new Date(loc.timestamp).toLocaleTimeString()}</span>
                                   <div className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-[8px] font-black text-zinc-500 uppercase">{loc.conf}%</div>
                                </div>
                                {resolvedAddresses[loc.id] && <p className="text-[9px] text-zinc-500 font-medium line-clamp-1 italic">{resolvedAddresses[loc.id]}</p>}
                                {!resolvedAddresses[loc.id] && <p className="text-[9px] text-zinc-400 font-mono">{loc.lat.toFixed(5)}, {loc.lon.toFixed(5)}</p>}
                             </div>
                           ))
                        }
                      </div>
                   </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-6">
                {/* Fixed: Use Car instead of CarIcon as per imports */}
                <div className="w-24 h-24 rounded-[40px] bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-200 dark:text-zinc-700 border border-zinc-100 dark:border-zinc-800"><Car size={48} /></div>
                <div><h3 className="text-base font-black uppercase text-zinc-400 tracking-widest">Painel Operacional</h3><p className="text-[11px] font-medium text-zinc-500 mt-2 leading-relaxed">Selecione um veículo ou inicie o modo frota para visualizar posições e trajetórias.</p></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};