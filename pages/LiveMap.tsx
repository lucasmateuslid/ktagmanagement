
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
  RefreshCw, Search, MapPin, Car, Activity, 
  Clock, Navigation, Copy, X, LayoutGrid,
  ChevronRight, ArrowLeft, Play, Share2, 
  FileText, FileSpreadsheet, ChevronUp, ChevronDown, Signal, Download,
  History, MapPinned
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
  
  const [isFleetMode, setIsFleetMode] = useState(false); 
  const [loading, setLoading] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  
  const { addNotification } = useNotification();
  const [searchParams] = useSearchParams(); 
  const timerRef = useRef<number | null>(null);

  const loadData = async () => {
    let [allTags, allVehicles] = await Promise.all([storage.getTags(), storage.getVehicles()]);
    
    if (user?.role === 'client' && user?.cpf) {
      const myClientData = (await storage.getClients()).find(c => c.cpf.replace(/\D/g, '') === user.cpf);
      if (myClientData) {
        allVehicles = allVehicles.filter(v => v.clientId === myClientData.id);
        allTags = allTags.filter(t => allVehicles.some(v => v.tagId === t.id));
      }
    }
    setTags(allTags);
    setVehicles(allVehicles);

    const urlTagId = searchParams.get('tagId');
    if (urlTagId) {
      handleVehicleSelect(urlTagId);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const resolveAddress = async (loc: LocationHistory) => {
    if (resolvedAddresses[loc.id]) return;
    try {
      const addr = await geocodingService.reverseGeocode(loc.lat, loc.lon);
      setResolvedAddresses(prev => ({ ...prev, [loc.id]: addr }));
    } catch (e) {}
  };

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
        const valid = results.filter((r): r is LocationHistory => r !== null);
        setFleetLocations(valid);
        valid.forEach(l => { if (l.tagId === selectedTagId) resolveAddress(l); });
      } finally { setLoading(false); }
    } else if (selectedTagId) {
      const tag = tags.find(t => t.id === selectedTagId);
      if (!tag) return;
      setLoading(true);
      try {
        const results = await fetchTagLocation(tag);
        if (results.length > 0) {
          const locs = results.map(l => ({ ...l, tagId: tag.id, id: `${tag.id}-${l.timestamp}` } as LocationHistory));
          setLocations(locs.sort((a, b) => b.timestamp - a.timestamp));
          resolveAddress(locs[0]);
        }
      } catch (e: any) {
        addNotification('error', 'Erro', e.message);
      } finally { setLoading(false); }
    }
  };

  useEffect(() => {
    fetchUpdate();
    timerRef.current = window.setInterval(fetchUpdate, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isFleetMode, selectedTagId, tags]);

  const handleVehicleSelect = (tagId: string) => {
    setSelectedTagId(tagId);
    setIsFleetMode(false);
    setIsSheetExpanded(false); 
    setShowHistoryList(false);
    setTagSearchTerm('');
    setIsSearchFocused(false);
  };

  const activeVehicle = vehicles.find(v => v.tagId === selectedTagId);
  const lastLoc = isFleetMode 
    ? fleetLocations.find(l => l.tagId === selectedTagId)
    : locations[0];

  const handleExportPDF = () => {
    if (!activeVehicle || !lastLoc) return;
    const doc = new jsPDF();
    const address = resolvedAddresses[lastLoc.id] || 'Endereço não disponível';
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("RELATÓRIO DE LOCALIZAÇÃO", 14, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 32);
    
    autoTable(doc, {
      startY: 40,
      head: [['Campo', 'Informação']],
      body: [
        ['Veículo', activeVehicle.plate],
        ['Modelo', activeVehicle.model],
        ['Data/Hora Sinal', new Date(lastLoc.timestamp).toLocaleString()],
        ['Latitude', lastLoc.lat.toString()],
        ['Longitude', lastLoc.lon.toString()],
        ['Precisão (Conf)', `${lastLoc.conf}%`],
        ['Endereço Aproximado', address]
      ],
      theme: 'striped',
      headStyles: { fillColor: [24, 24, 27] }
    });
    
    doc.save(`localizacao_${activeVehicle.plate}_${Date.now()}.pdf`);
    addNotification('success', 'PDF Gerado', 'Relatório salvo com sucesso.');
  };

  const handleExportExcel = () => {
    if (!activeVehicle || !lastLoc) return;
    const address = resolvedAddresses[lastLoc.id] || 'Endereço não disponível';
    
    const data = [{
      Placa: activeVehicle.plate,
      Modelo: activeVehicle.model,
      DataHora: new Date(lastLoc.timestamp).toLocaleString(),
      Latitude: lastLoc.lat,
      Longitude: lastLoc.lon,
      Precisao: lastLoc.conf,
      Endereco: address
    }];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Localização");
    XLSX.writeFile(wb, `localizacao_${activeVehicle.plate}.xlsx`);
    addNotification('success', 'Excel Gerado', 'Arquivo pronto para download.');
  };

  const filteredVehicles = useMemo(() => {
    const term = tagSearchTerm.toLowerCase().trim();
    if (!term && !isSearchFocused) return [];
    if (!term && isSearchFocused) return vehicles.slice(0, 5);
    return vehicles.filter(v => v.plate.toLowerCase().includes(term) || v.model.toLowerCase().includes(term));
  }, [vehicles, tagSearchTerm, isSearchFocused]);

  const recentHistory = useMemo(() => {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    return locations.filter(l => l.timestamp >= threeDaysAgo);
  }, [locations]);

  const handleToggleHistory = async () => {
    setShowHistoryList(!showHistoryList);
    if (!showHistoryList) {
      // Tentar resolver endereços da lista visível se necessário
      const toResolve = recentHistory.slice(0, 10);
      for (const loc of toResolve) {
        if (!resolvedAddresses[loc.id]) {
          await resolveAddress(loc);
        }
      }
    }
  };

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      
      {/* BUSCA COM Z-INDEX ABAIXO DO HEADER (z-40) E CORES SÓLIDAS */}
      <div className="absolute top-4 md:top-6 left-0 right-0 z-[40] px-3 md:px-4 pointer-events-none">
        <div className="w-full max-w-4xl mx-auto relative pointer-events-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-full shadow-[0_15px_45px_rgba(0,0,0,0.2)] border border-zinc-200 dark:border-zinc-800 p-1.5 md:p-1 flex items-center gap-1 md:gap-2 transition-all">
            <div className="flex-1 flex items-center gap-2 md:gap-3 pl-3 md:pl-4">
              <Search size={18} className="text-zinc-400 shrink-0" />
              <input 
                type="text" 
                placeholder="Buscar veículo..." 
                value={tagSearchTerm}
                onFocus={() => setIsSearchFocused(true)}
                onChange={e => setTagSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-[13px] md:text-[12px] font-bold w-full text-zinc-900 dark:text-white uppercase placeholder:text-zinc-400 placeholder:normal-case h-11 md:h-9"
              />
            </div>
            
            <div className="flex items-center gap-1 pr-1">
              <button 
                onClick={fetchUpdate} 
                className="p-2.5 md:p-2 text-zinc-400 hover:text-primary-500 rounded-xl transition-all active:scale-90"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
              
              <div className="w-px h-6 md:h-5 bg-zinc-100 dark:bg-zinc-800 mx-0.5 md:mx-1" />
              
              <button 
                onClick={() => { setIsFleetMode(!isFleetMode); if(!isFleetMode) setSelectedTagId(''); }}
                className={`px-4 md:px-5 h-10 md:h-8 rounded-xl md:rounded-full font-black text-[9px] md:text-[8px] uppercase tracking-widest transition-all shadow-sm ${
                  isFleetMode 
                    ? 'bg-primary-500 text-black shadow-primary-500/20' 
                    : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-zinc-800/50'
                }`}
              >
                Frota
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isSearchFocused && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.98 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-zinc-900 rounded-[28px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-[41] max-h-[50vh] overflow-y-auto no-scrollbar"
              >
                <div className="p-2 space-y-1">
                   {filteredVehicles.length === 0 && tagSearchTerm && (
                     <div className="py-8 text-center text-zinc-400 text-[10px] font-black uppercase">Nenhum resultado</div>
                   )}
                   {filteredVehicles.map(v => (
                     <button key={v.id} onClick={() => handleVehicleSelect(v.tagId!)} className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/80 rounded-[22px] transition-all group active:bg-zinc-100 dark:active:bg-zinc-800">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary-500 transition-colors"><Car size={20} /></div>
                           <div className="text-left">
                              <div className="text-[14px] font-black text-zinc-900 dark:text-white uppercase leading-none mb-1 tracking-tight">{v.plate}</div>
                              <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate max-w-[180px]">{v.model}</div>
                           </div>
                        </div>
                        <ChevronRight size={18} className="text-zinc-300" />
                     </button>
                   ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {isSearchFocused && <div className="fixed inset-0 z-[39]" onClick={() => setIsSearchFocused(false)} />}
        </div>
      </div>

      <div className="flex-1 relative z-0">
        <MapComponent locations={isFleetMode ? fleetLocations : (selectedTagId ? locations : [])} isFleetMode={isFleetMode} vehicles={vehicles} highlightedTagId={selectedTagId} onMarkerClick={handleVehicleSelect} />
      </div>

      {/* PAINEL ULTRA COMPACTO */}
      <AnimatePresence>
        {selectedTagId && !isSearchFocused && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: isSheetExpanded ? 0 : 'calc(100% - 85px)' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="absolute bottom-0 left-0 right-0 z-[150] bg-white dark:bg-zinc-900 rounded-t-[32px] shadow-[0_-15px_50px_rgba(0,0,0,0.2)] border-t border-zinc-100 dark:border-zinc-800 flex flex-col lg:left-auto lg:right-4 lg:bottom-4 lg:w-[400px] lg:rounded-[32px] overflow-hidden"
            style={{ maxHeight: '75vh' }}
          >
            {/* COMPACT HEADER (Sempre visível) */}
            <div 
              className="h-[85px] px-6 flex items-center justify-between cursor-pointer group shrink-0"
              onClick={() => { setIsSheetExpanded(!isSheetExpanded); if(isSheetExpanded) setShowHistoryList(false); }}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-[14px] bg-primary-500 text-black flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <Car size={22} strokeWidth={3} />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase leading-none tracking-tight">{activeVehicle?.plate}</h2>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1.5 truncate max-w-[160px]">{lastLoc ? (resolvedAddresses[lastLoc.id]?.split(',')[0] || 'Localizando...') : 'Sem sinal'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end mr-1">
                   <div className="flex items-center gap-1.5">
                      <Signal size={14} className="text-emerald-500" />
                      <span className="text-[13px] font-black text-zinc-900 dark:text-white leading-none">{lastLoc?.conf || 0}%</span>
                   </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary-500 transition-colors">
                  {isSheetExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </div>
              </div>
            </div>

            {/* EXPANDED CONTENT */}
            <div className="px-6 pb-8 space-y-5 overflow-y-auto no-scrollbar flex-1 border-t border-zinc-50 dark:border-zinc-800/50 pt-6">
                  
                  {showHistoryList ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2 text-primary-500">
                            <History size={18} />
                            <span className="text-[11px] font-black uppercase tracking-widest">Trajeto Últimos 3 Dias</span>
                         </div>
                         <button onClick={() => setShowHistoryList(false)} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[9px] font-black uppercase text-zinc-500 hover:text-zinc-700 transition-all">Voltar</button>
                      </div>
                      
                      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                         {recentHistory.length === 0 ? (
                           <div className="py-16 text-center opacity-30 text-[10px] font-black uppercase italic">Nenhum registro no período</div>
                         ) : (
                           recentHistory.map((loc, idx) => (
                             <div key={loc.id} className="p-4 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 flex gap-4 group hover:border-primary-500/30 transition-all">
                                <div className="flex flex-col items-center gap-1 mt-1">
                                   <div className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-sm shadow-primary-500/40" />
                                   {idx < recentHistory.length - 1 && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />}
                                </div>
                                <div className="flex-1">
                                   <div className="flex justify-between items-start mb-1.5">
                                      <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-200">{new Date(loc.timestamp).toLocaleString()}</span>
                                      <button 
                                        onClick={() => { navigator.clipboard.writeText(`${loc.lat}, ${loc.lon}`); addNotification('success', 'Copiado', 'Coordenadas salvas.'); }}
                                        className="text-[8px] font-black text-zinc-400 hover:text-primary-500 uppercase tracking-widest transition-colors"
                                      >
                                        Copiar GPS
                                      </button>
                                   </div>
                                   <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 leading-snug">
                                      {resolvedAddresses[loc.id] || 'Buscando endereço...'}
                                   </p>
                                </div>
                             </div>
                           ))
                         )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-zinc-50 dark:bg-zinc-950/40 p-5 rounded-[24px] border border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[9px] font-black uppercase text-primary-500 tracking-[0.25em]">Localização Atual</span>
                            <span className="text-[9px] font-mono text-zinc-400 tracking-tighter">{lastLoc?.lat.toFixed(6)}, {lastLoc?.lon.toFixed(6)}</span>
                        </div>
                        <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 leading-snug">
                          {lastLoc ? (resolvedAddresses[lastLoc.id] || 'Buscando endereço...') : 'Sinal indisponível'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => lastLoc && window.open(`https://www.google.com/maps/dir/?api=1&destination=${lastLoc.lat},${lastLoc.lon}`)} className="h-14 bg-zinc-950 dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                          <Navigation size={18}/> Rota GPS
                        </button>
                        <button onClick={handleToggleHistory} className="h-14 bg-primary-500 text-black rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all border border-primary-600">
                          <History size={18}/> Histórico
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button onClick={() => { if(lastLoc) { navigator.clipboard.writeText(`${lastLoc.lat}, ${lastLoc.lon}`); addNotification('success', 'Copiado', 'Coordenadas salvas.'); } }} className="h-12 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl flex items-center justify-center gap-2.5 font-black text-[9px] uppercase border border-zinc-100 dark:border-zinc-700 shadow-sm active:scale-95 transition-all">
                          <Copy size={16}/> Copiar Coordenadas
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                           <button onClick={handleExportPDF} title="PDF" className="h-12 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 rounded-xl flex items-center justify-center border border-zinc-100 dark:border-zinc-800 active:scale-95 transition-all hover:text-red-500">
                             <FileText size={18}/>
                           </button>
                           <button onClick={handleExportExcel} title="XLS" className="h-12 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 rounded-xl flex items-center justify-center border border-zinc-100 dark:border-zinc-800 active:scale-95 transition-all hover:text-emerald-500">
                             <FileSpreadsheet size={18}/>
                           </button>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <button onClick={() => setSelectedTagId('')} className="w-full py-3 text-[9px] font-black text-zinc-300 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mt-2">
                    <X size={14} /> Fechar Monitoramento
                  </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
