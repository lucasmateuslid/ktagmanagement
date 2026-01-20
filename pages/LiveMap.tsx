
import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../services/storage';
import { fetchTagLocation } from '../services/api';
import { geocodingService } from '../services/geocoding';
import { xadtagService } from '../services/xadtag';
import { Tag, LocationHistory, Vehicle, VehicleCategory, Client } from '../types';
import { MapComponent } from '../components/MapComponent';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  RefreshCw, Search, MapPin, Car, Activity, 
  Clock, Navigation, X, LayoutGrid,
  ChevronRight, ArrowLeft, FileText, FileSpreadsheet, 
  ChevronUp, ChevronDown, Signal, Download,
  History, MapPinned, Wifi, WifiOff, Loader2, CalendarDays, Eye, User
} from 'lucide-react';
import { FaCar, FaMotorcycle, FaTruck } from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const { useSearchParams } = ReactRouterDOM as any;

type FleetFilter = 'all' | 'online' | 'offline';

export const LiveMap = () => {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [fleetLocations, setFleetLocations] = useState<LocationHistory[]>([]);
  const [historyItems, setHistoryItems] = useState<LocationHistory[]>([]);
  const [resolvedAddresses, setResolvedAddresses] = useState<Record<string, string>>({});
  
  const [filter, setFilter] = useState<FleetFilter>('all');
  const [limit50, setLimit50] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // States de Histórico e Exportação
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  
  const { addNotification } = useNotification();
  const [searchParams] = useSearchParams(); 
  const timerRef = useRef<number | null>(null);

  const loadData = async () => {
    let [allTags, allVehicles, allCategories, allClients] = await Promise.all([
      storage.getTags(), 
      storage.getVehicles(),
      storage.getCategories(),
      storage.getClients()
    ]);
    
    if (user?.role === 'client' && user?.cpf) {
      const myClientData = allClients.find(c => c.cpf.replace(/\D/g, '') === user.cpf);
      if (myClientData) {
        allVehicles = allVehicles.filter(v => v.clientId === myClientData.id);
        allTags = allTags.filter(t => allVehicles.some(v => v.tagId === t.id));
      }
    }
    setTags(allTags);
    setVehicles(allVehicles);
    setCategories(allCategories);
    setClients(allClients);

    const urlTagId = searchParams.get('tagId');
    if (urlTagId) handleVehicleSelect(urlTagId);
  };

  useEffect(() => { loadData(); }, [user]);

  const fetchUpdate = async () => {
    if (tags.length === 0) return;
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
      
      // Resolve endereço SOMENTE para o veículo selecionado atual (otimização)
      if (selectedTagId) {
        const current = valid.find(l => l.tagId === selectedTagId);
        if (current && !resolvedAddresses[current.id]) {
            const addr = await geocodingService.reverseGeocode(current.lat, current.lon);
            setResolvedAddresses(prev => ({ ...prev, [current.id]: addr }));
        }
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchUpdate();
    timerRef.current = window.setInterval(fetchUpdate, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [selectedTagId, tags]);

  const handleVehicleSelect = (tagId: string) => {
    setSelectedTagId(tagId);
    setIsSheetExpanded(true); 
    setShowHistoryList(false);
    setTagSearchTerm('');
    setIsSearchFocused(false);
  };

  const fetchHistory = async () => {
    if (!selectedTagId) return;
    const tag = tags.find(t => t.id === selectedTagId);
    if (!tag) return;

    setHistoryLoading(true);
    setShowHistoryList(true);
    
    try {
        const endTime = Date.now();
        const startTime = endTime - (24 * 60 * 60 * 1000); // Últimas 24h
        
        let results: LocationHistory[] = [];
        if (tag.type === 'XADTAG') {
            results = await xadtagService.fetchHistory(tag, startTime, endTime) as LocationHistory[];
        } else {
            // Mock para K-TAG se não houver backend real de histórico
            const last = fleetLocations.find(l => l.tagId === selectedTagId);
            if (last) {
                // Simula alguns pontos anteriores
                results = [last];
                for(let i=1; i<=10; i++) {
                    results.push({ 
                        ...last, 
                        lat: last.lat + (Math.random() * 0.002 - 0.001), 
                        lon: last.lon + (Math.random() * 0.002 - 0.001), 
                        timestamp: last.timestamp - (i * 3600000), // -1 hora cada
                        id: `hist-${i}` 
                    });
                }
            }
        }
        
        // OTIMIZAÇÃO: Resolve endereço apenas dos 3 primeiros (mais recentes)
        // O restante será resolvido apenas na exportação para não pesar.
        const top3 = results.slice(0, 3);
        const newAddresses: Record<string, string> = {};
        
        await Promise.all(top3.map(async (item) => {
            if (!resolvedAddresses[item.id]) {
                const addr = await geocodingService.reverseGeocode(item.lat, item.lon);
                newAddresses[item.id] = addr;
            }
        }));

        setResolvedAddresses(prev => ({ ...prev, ...newAddresses }));
        setHistoryItems(results);
    } catch (e) {
        addNotification('error', 'Erro', 'Falha ao recuperar trajetória.');
    } finally {
        setHistoryLoading(false);
    }
  };

  // Função auxiliar para resolver todos os endereços antes de exportar
  const processExportData = async () => {
    setExporting(true);
    setExportProgress(0);
    const total = historyItems.length;
    const exportData = [];

    // Clona o dicionário de endereços atual
    const currentAddresses = { ...resolvedAddresses };

    for (let i = 0; i < total; i++) {
        const item = historyItems[i];
        let address = currentAddresses[item.id];

        // Se não tiver endereço resolvido, resolve agora (com pequeno delay para não bloquear API)
        if (!address) {
            try {
                // Pequeno throttle artificial se necessário
                await new Promise(r => setTimeout(r, 100)); 
                address = await geocodingService.reverseGeocode(item.lat, item.lon);
                currentAddresses[item.id] = address;
                // Atualiza o estado visual também, opcional
                setResolvedAddresses(prev => ({ ...prev, [item.id]: address }));
            } catch (e) {
                address = "Endereço indisponível";
            }
        }

        exportData.push({
            data: new Date(item.timestamp).toLocaleString(),
            lat: item.lat,
            lon: item.lon,
            endereco: address
        });

        // Atualiza barra de progresso
        setExportProgress(Math.round(((i + 1) / total) * 100));
    }

    setExporting(false);
    return exportData;
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    const v = vehicles.find(v => v.tagId === selectedTagId);
    
    // Processa os dados (resolve endereços faltantes)
    const data = await processExportData();

    if (type === 'pdf') {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`RELATÓRIO DE TRAJETO (24H)`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Veículo: ${v?.plate} | ${v?.model}`, 14, 28);
        
        autoTable(doc, {
          startY: 35,
          head: [['Data/Hora', 'Coordenadas', 'Endereço Local']],
          body: data.map(item => [
            item.data,
            `${item.lat.toFixed(5)}, ${item.lon.toFixed(5)}`,
            item.endereco
          ]),
          theme: 'grid',
          headStyles: { fillColor: [245, 158, 11] },
          styles: { fontSize: 8 }
        });
        doc.save(`Trajeto_${v?.plate}.pdf`);
    } else {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trajeto");
        XLSX.writeFile(wb, `Trajeto_${v?.plate}.xlsx`);
    }
  };

  const stats = useMemo(() => {
    const linked = vehicles.filter(v => v.tagId).length;
    const online = fleetLocations.length;
    const offline = linked - online;
    return { linked, online, offline };
  }, [vehicles, fleetLocations]);

  const filteredVehiclesList = useMemo(() => {
    const term = tagSearchTerm.toLowerCase().trim();
    let base = vehicles.filter(v => v.tagId);
    if (filter === 'online') base = base.filter(v => fleetLocations.some(l => l.tagId === v.tagId));
    if (filter === 'offline') base = base.filter(v => !fleetLocations.some(l => l.tagId === v.tagId));
    return term ? base.filter(v => v.plate.toLowerCase().includes(term) || v.model.toLowerCase().includes(term)) : base;
  }, [vehicles, fleetLocations, filter, tagSearchTerm]);

  const locationsToRender = useMemo(() => {
    if (selectedTagId) {
        return fleetLocations.filter(l => l.tagId === selectedTagId);
    }
    let base = filter === 'all' 
        ? fleetLocations 
        : fleetLocations.filter(l => filter === 'online');

    if (limit50 && base.length > 50) {
        return base.slice(0, 50);
    }
    return base;
  }, [fleetLocations, selectedTagId, filter, limit50]);

  const activeVehicle = vehicles.find(v => v.tagId === selectedTagId);
  const activeCategory = activeVehicle ? categories.find(c => c.id === activeVehicle.type) : null;
  const activeClient = activeVehicle ? clients.find(c => c.id === activeVehicle.clientId) : null;
  const lastLoc = fleetLocations.find(l => l.tagId === selectedTagId);

  const getModalIcon = (fipeType?: string) => {
    switch (fipeType) {
        case 'motos': return <FaMotorcycle size={28} />;
        case 'caminhoes': return <FaTruck size={28} />;
        default: return <FaCar size={28} />;
    }
  };

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950 font-sans">
      
      {/* HUD SUPERIOR */}
      <div className="absolute top-6 left-0 right-0 z-[400] px-4 pointer-events-none flex flex-col items-center gap-4">
        <div className="w-full max-w-xl pointer-events-auto">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-[24px] shadow-2xl border border-zinc-200 dark:border-zinc-800 p-1.5 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-3 pl-4">
              <Search size={18} className="text-zinc-400" />
              <input 
                type="text" 
                placeholder="Pesquisar por placa ou modelo..." 
                value={tagSearchTerm}
                onFocus={() => setIsSearchFocused(true)}
                onChange={e => setTagSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-[13px] font-black w-full text-zinc-900 dark:text-white uppercase placeholder:normal-case placeholder:font-bold"
              />
            </div>
            <button onClick={fetchUpdate} className={`p-2.5 rounded-2xl transition-all active:scale-90 ${loading ? 'text-primary-500' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <AnimatePresence>
            {isSearchFocused && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-3 left-0 right-0 bg-white dark:bg-zinc-900 rounded-[28px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-[40vh] overflow-y-auto p-2"
              >
                 {filteredVehiclesList.length === 0 ? <div className="py-10 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest opacity-40 italic">Nenhum veículo nesta categoria</div> : 
                   filteredVehiclesList.map(v => (
                     <button key={v.id} onClick={() => handleVehicleSelect(v.tagId!)} className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/5 rounded-2xl transition-all group text-left">
                        <div className="flex items-center gap-4">
                           <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${fleetLocations.some(l => l.tagId === v.tagId) ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>
                             <Car size={20} />
                           </div>
                           <div>
                              <div className="text-sm font-black text-zinc-900 dark:text-white uppercase leading-none mb-1">{v.plate}</div>
                              <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">{v.model}</div>
                           </div>
                        </div>
                        <ChevronRight size={16} className="text-zinc-300 group-hover:text-primary-500" />
                     </button>
                   ))
                 }
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* STATUS CHIPS */}
        <div className="pointer-events-auto flex items-center bg-zinc-900/90 dark:bg-white/90 backdrop-blur-md rounded-full p-1 shadow-2xl border border-zinc-800 dark:border-zinc-200 gap-1">
            <button onClick={() => setFilter('all')} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filter === 'all' ? 'bg-white dark:bg-zinc-950 text-black dark:text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 dark:hover:text-zinc-600'}`}>
              <LayoutGrid size={13} /> {stats.linked}
            </button>
            <button onClick={() => setFilter('online')} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filter === 'online' ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-emerald-500'}`}>
              <Wifi size={13} /> {stats.online}
            </button>
            <div className="w-px h-4 bg-zinc-700 dark:bg-zinc-300 mx-1 opacity-30" />
            <button 
                onClick={() => setLimit50(!limit50)} 
                title={limit50 ? "Mostrar Todos" : "Limitar a 50"}
                className={`px-3 py-2 rounded-full text-[10px] font-black uppercase transition-all flex items-center gap-1 ${limit50 ? 'text-zinc-500' : 'text-primary-500 bg-primary-500/10'}`}
            >
                <Eye size={13} /> {limit50 ? '50' : 'ALL'}
            </button>
        </div>
      </div>

      {/* MAPA */}
      <div className="flex-1 relative z-0">
        <MapComponent 
            locations={locationsToRender} 
            isFleetMode={true} 
            vehicles={vehicles}
            categories={categories}
            highlightedTagId={selectedTagId} 
            onMarkerClick={handleVehicleSelect} 
        />
      </div>

      {/* BOTTOM SHEET DETALHES */}
      <AnimatePresence>
        {selectedTagId && (
          <motion.div initial={{ y: '100%' }} animate={{ y: isSheetExpanded ? 0 : 'calc(100% - 100px)' }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="absolute bottom-0 left-0 right-0 z-[1000] bg-white dark:bg-zinc-900 rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] border-t border-zinc-100 dark:border-zinc-800 flex flex-col md:left-auto md:right-6 md:bottom-6 md:w-[420px] md:rounded-[40px] overflow-hidden"
          >
            <div className="h-[100px] px-8 flex items-center justify-between cursor-pointer group" onClick={() => setIsSheetExpanded(!isSheetExpanded)}>
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all ${lastLoc ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                  {getModalIcon(activeCategory?.fipeType)}
                </div>
                <div>
                  <h2 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase leading-none tracking-tighter">{activeVehicle?.plate}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                      <div className={`w-2 h-2 rounded-full ${lastLoc ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{lastLoc ? 'Sinal Ativo Online' : 'Sem Resposta (Offline)'}</span>
                  </div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary-500 transition-colors">
                {isSheetExpanded ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
              </div>
            </div>

            <div className="px-8 pb-10 space-y-6 overflow-y-auto no-scrollbar border-t border-zinc-50 dark:border-zinc-800/50 pt-8">
                
                {/* Exibição do Cliente Responsável */}
                {activeClient && (
                    <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-[20px] border border-zinc-100 dark:border-zinc-800">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shadow-sm shrink-0">
                            <User size={18} />
                        </div>
                        <div className="overflow-hidden">
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-0.5">Cliente Responsável</span>
                            <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate block">{activeClient.name}</span>
                        </div>
                    </div>
                )}

                <div className="bg-zinc-50 dark:bg-zinc-950/60 p-6 rounded-[32px] border border-zinc-100 dark:border-zinc-800/50 relative overflow-hidden group">
                    <div className="flex items-center gap-2 text-primary-500 mb-2">
                        <MapPin size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Endereço de Localização</span>
                    </div>
                    <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                        {lastLoc ? (resolvedAddresses[lastLoc.id] || 'Resolvendo endereço...') : 'Coordenadas não disponíveis no momento.'}
                    </p>
                    <div className="absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 bg-primary-500/5 rounded-full" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => lastLoc && window.open(`https://www.google.com/maps/dir/?api=1&destination=${lastLoc.lat},${lastLoc.lon}`)} className="h-16 bg-zinc-950 dark:bg-zinc-800 text-white rounded-[24px] flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95 border border-zinc-800">
                        <Navigation size={22}/> Abrir Rota
                    </button>
                    <button onClick={fetchHistory} className="h-16 bg-primary-500 text-black rounded-[24px] flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95">
                        <History size={22}/> Histórico
                    </button>
                </div>

                <button onClick={() => setSelectedTagId('')} className="w-full py-2 text-[10px] font-black text-zinc-300 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 opacity-60 hover:opacity-100">
                    <X size={16} /> Fechar Detalhes do Veículo
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY DE HISTÓRICO */}
      <AnimatePresence>
        {showHistoryList && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[2000] bg-black/70 backdrop-blur-md flex items-center justify-end">
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                className="w-full md:w-[480px] h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col overflow-hidden relative"
              >
                {/* OVERLAY DE EXPORTAÇÃO */}
                <AnimatePresence>
                    {exporting && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[2010] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center text-white">
                            <Loader2 size={48} className="animate-spin text-primary-500 mb-6" />
                            <h3 className="text-xl font-display font-black uppercase tracking-tight mb-2">Processando Trajeto</h3>
                            <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-8">Resolvendo endereços completos...</p>
                            
                            <div className="w-full max-w-[200px] h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                            </div>
                            <span className="mt-4 text-sm font-mono font-bold text-primary-500">{exportProgress}%</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                    <div className="flex justify-between items-start mb-8">
                        <button onClick={() => setShowHistoryList(false)} className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-500 hover:text-primary-500 transition-all shadow-sm"><ArrowLeft size={24}/></button>
                        <div className="flex gap-2">
                            <button onClick={() => handleExport('pdf')} disabled={exporting} title="PDF Completo" className="p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"><FileText size={22}/></button>
                            <button onClick={() => handleExport('excel')} disabled={exporting} title="Excel Completo" className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50"><FileSpreadsheet size={22}/></button>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Linha do Tempo</h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-sm font-black text-primary-500 uppercase tracking-widest">{activeVehicle?.plate}</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700"/>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Últimas 24 Horas</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    {historyLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-5 opacity-50">
                            <Loader2 className="animate-spin text-primary-500" size={40} />
                            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Consolidando Trajeto...</span>
                        </div>
                    ) : historyItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-5 opacity-20">
                            <CalendarDays size={64} />
                            <span className="text-[11px] font-black uppercase">Nenhum ponto registrado no período</span>
                        </div>
                    ) : (
                        historyItems.map((item, idx) => (
                            <div key={item.id} className="relative flex gap-8 group">
                                {idx !== historyItems.length - 1 && <div className="absolute left-5 top-10 bottom-0 w-px bg-zinc-100 dark:bg-zinc-800" />}
                                <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center border-2 transition-all ${idx === 0 ? 'bg-primary-500 border-primary-400 text-black shadow-2xl' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}>
                                    {idx === 0 ? <Navigation size={18} className="fill-current"/> : <div className="w-2 h-2 rounded-full bg-current"/>}
                                </div>
                                <div className="flex-1 pb-10">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[12px] font-black text-zinc-900 dark:text-white uppercase font-mono tracking-tight">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <p className={`text-[14px] font-bold leading-tight transition-colors ${resolvedAddresses[item.id] ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-300 dark:text-zinc-700 italic font-medium'}`}>
                                        {resolvedAddresses[item.id] || (idx < 3 ? 'Resolvendo...' : `Referência: ${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}`)}
                                    </p>
                                    <div className="mt-3 flex items-center gap-4">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-widest"><Signal size={12}/> Sinal 100%</div>
                                        <button onClick={() => window.open(`https://www.google.com/maps?q=${item.lat},${item.lon}`)} className="text-[9px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-1.5 hover:underline"><MapPinned size={12}/> Ver no Mapa</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-bold text-zinc-400 text-center uppercase tracking-[0.2em] leading-relaxed">
                        Sistema K-TAG Intelligence • Relatório de Fluxo Operacional
                    </p>
                </div>
              </motion.div>
              {/* Fechar ao clicar fora */}
              <div className="absolute inset-0 z-[-1]" onClick={() => setShowHistoryList(false)} />
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
