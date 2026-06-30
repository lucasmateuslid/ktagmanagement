
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { xadtagService } from '../services/xadtag';
import { Vehicle, VehicleCategory, Tag, KTagLocationResult } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Filter, FileSpreadsheet, Download, TrendingUp, Activity, Battery, Signal, MapPin, Search, ChevronDown, Check, Link as LinkIcon, Unlink } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, BarChart, Bar, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

export const Reports = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  
  // Inicializa com datas seguras
  const [startDate, setStartDate] = useState(() => { 
    const d = new Date(); 
    d.setDate(d.getDate() - 7); 
    return d.toISOString().split('T')[0]; 
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [appliedStartDate, setAppliedStartDate] = useState(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState(endDate);
  
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // --- TELEMETRY STATE ---
  const [activeTab, setActiveTab] = useState<'vehicles' | 'telemetry'>('vehicles');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [tagSearch, setTagSearch] = useState('');
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [historyData, setHistoryData] = useState<KTagLocationResult[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [telemetryStats, setTelemetryStats] = useState({ totalPings: 0, avgBattery: 0, distance: 0 });

  useEffect(() => {
    const load = async () => {
        const [v, c, t] = await Promise.all([storage.getVehicles(), storage.getCategories(), storage.getTags()]);
        setVehicles(v); setCategories(c); setTags(t);
    };
    load();
  }, []);

  // --- TELEMETRY LOGIC ---
  const fetchTelemetry = useCallback(async () => {
      if (!selectedTagId || !appliedStartDate || !appliedEndDate) return;
      
      const tag = tags.find(t => t.id === selectedTagId);
      if (!tag) return;

      setIsLoadingHistory(true);
      try {
          const start = new Date(`${appliedStartDate}T00:00:00`).getTime();
          const end = new Date(`${appliedEndDate}T23:59:59`).getTime();
          
          const history = await xadtagService.fetchHistory(tag, start, end);
          setHistoryData(history);

          // Calculate Stats
          const totalPings = history.length;
          const avgBattery = totalPings > 0 
              ? history.reduce((acc, curr) => acc + (curr.battery?.level || 0), 0) / totalPings 
              : 0;
          const distance = history.reduce((acc, curr) => acc + (curr.distance || 0), 0); // Assuming distance is in meters/km from API

          setTelemetryStats({ totalPings, avgBattery, distance });

      } catch (error) {
          console.error("Erro ao buscar telemetria:", error);
      } finally {
          setIsLoadingHistory(false);
      }
  }, [selectedTagId, appliedStartDate, appliedEndDate, tags]);

  useEffect(() => {
      if (activeTab === 'telemetry') {
          fetchTelemetry();
      }
  }, [fetchTelemetry, activeTab]);

  const filterData = useCallback(() => {
      if (!appliedStartDate || !appliedEndDate) return;

      // Criação segura de datas
      const startObj = new Date(`${appliedStartDate}T00:00:00`);
      const endObj = new Date(`${appliedEndDate}T23:59:59`);

      // Validação para evitar erros de Range/Syntax
      if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
          console.warn("Datas inválidas para filtro");
          return;
      }

      const start = startObj.getTime();
      const end = endObj.getTime();
      
      const filtered = vehicles.filter(v => v.createdAt && v.createdAt >= start && v.createdAt <= end);
      setFilteredVehicles(filtered);
      
      // Processamento de Categorias
      const catMap: Record<string, number> = {};
      filtered.forEach(v => {
          const catName = categories.find(c => c.id === v.type)?.name || 'Outros';
          catMap[catName] = (catMap[catName] || 0) + 1;
      });
      setCategoryData(Object.keys(catMap).map(k => ({ name: k, value: catMap[k] })));

      // Processamento de Tendência (Loop Seguro)
      const trendMap: Record<string, number> = {};
      const loopDate = new Date(startObj);
      
      // Loop while é mais seguro e legível para manipulação de datas que for-loops complexos
      while (loopDate <= endObj) {
          try {
            const key = loopDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            trendMap[key] = 0;
            // Avança 1 dia
            loopDate.setDate(loopDate.getDate() + 1);
          } catch (e) {
            break; // Previne loops infinitos em caso de erro de data
          }
      }

      filtered.forEach(v => {
          if (v.createdAt) {
              const d = new Date(v.createdAt);
              if (!isNaN(d.getTime())) {
                  const dayKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  if (trendMap[dayKey] !== undefined) trendMap[dayKey]++;
              }
          }
      });
      
      setTrendData(Object.keys(trendMap).map(k => ({ name: k, count: trendMap[k] })));
  }, [vehicles, appliedStartDate, appliedEndDate, categories]);

  useEffect(() => { filterData(); }, [filterData]);

  // --- TAG LINKAGE INFO ---
  const tagLinkageMap = React.useMemo(() => {
    const map: Record<string, Vehicle> = {};
    vehicles.forEach(v => {
      if (v.tagId) map[v.tagId] = v;
    });
    return map;
  }, [vehicles]);

  const filteredTags = React.useMemo(() => {
    const term = tagSearch.toLowerCase();
    return tags.filter(t => 
      t.name.toLowerCase().includes(term) || 
      t.accessoryId.toLowerCase().includes(term)
    );
  }, [tags, tagSearch]);

  const selectedTag = tags.find(t => t.id === selectedTagId);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
        // Importação dinâmica segura
        const jsPDFModule = await import('jspdf');
        const jsPDF = jsPDFModule.jsPDF || (jsPDFModule as any).default;
        
        const autoTableModule = await import('jspdf-autotable');
        const autoTable = autoTableModule.default || (autoTableModule as any);

        if (!jsPDF) throw new Error("Erro ao carregar biblioteca PDF");

        const doc = new jsPDF();
        const total = filteredVehicles.length;
        const soTag = filteredVehicles.filter(v => v.installationType !== 'tag_tracker').length;
        const tagTracker = total - soTag;
        
        const leased = filteredVehicles.filter(v => v.ownershipStatus !== 'purchased').length;
        const purchased = filteredVehicles.filter(v => v.ownershipStatus === 'purchased').length;

        // --- HEADER ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(24, 24, 27);
        doc.text("K-TAG INSIGHT REPORT", 14, 22);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(113, 113, 122);
        
        const startStr = new Date(appliedStartDate).toLocaleDateString();
        const endStr = new Date(appliedEndDate).toLocaleDateString();
        doc.text(`Período: ${startStr} - ${endStr}`, 14, 30);
        
        doc.text(`Gerado por: ${user?.name || 'Admin'} em ${new Date().toLocaleString()}`, 14, 36);

        // --- DASHBOARD CARDS ---
        // Total
        doc.setFillColor(24, 24, 27);
        doc.roundedRect(14, 45, 58, 30, 4, 4, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text("TOTAL ATIVAÇÕES", 19, 53);
        doc.setFontSize(18);
        doc.text(total.toString(), 19, 68);

        // Só Tag
        doc.setFillColor(245, 158, 11);
        doc.roundedRect(76, 45, 58, 30, 4, 4, "F");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.text("SÓ TAG", 81, 53);
        doc.setFontSize(18);
        const soTagPerc = total > 0 ? ((soTag / total) * 100).toFixed(1) : "0";
        doc.text(`${soTag} (${soTagPerc}%)`, 81, 68);

        // Tag + Tracker
        doc.setFillColor(244, 244, 245);
        doc.roundedRect(138, 45, 58, 30, 4, 4, "F");
        doc.setTextColor(24, 24, 27);
        doc.setFontSize(8);
        doc.text("TAG + RASTREADOR", 143, 53);
        doc.setFontSize(18);
        const tagTrackerPerc = total > 0 ? ((tagTracker / total) * 100).toFixed(1) : "0";
        doc.text(`${tagTracker} (${tagTrackerPerc}%)`, 143, 68);

        // --- SECTION: Propriedade ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(24, 24, 27);
        doc.text("Modelo de Contrato", 14, 88);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Comodato: ${leased} (${total > 0 ? ((leased/total)*100).toFixed(1) : 0}%)`, 14, 95);
        doc.text(`Adquirido: ${purchased} (${total > 0 ? ((purchased/total)*100).toFixed(1) : 0}%)`, 80, 95);

        // --- DISTRIBUIÇÃO POR CATEGORIA ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(24, 24, 27);
        doc.text("Distribuição por Categoria", 14, 108);

        const categorySummary = categoryData.map(c => [
          c.name,
          c.value,
          total > 0 ? `${((c.value / total) * 100).toFixed(1)}%` : '0%'
        ]);

        autoTable(doc, {
          startY: 113,
          head: [['Categoria', 'Quantidade', 'Representatividade (%)']],
          body: categorySummary,
          theme: 'striped',
          headStyles: { fillColor: [63, 63, 70], textColor: [255, 255, 255] },
          styles: { fontSize: 9 }
        });

        // --- LISTAGEM DETALHADA ---
        doc.setFontSize(14);
        doc.text("Listagem Detalhada de Veículos", 14, (doc as any).lastAutoTable.finalY + 15);

        const detailedData = filteredVehicles.map(v => [
          v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '-',
          v.plate,
          v.model,
          categories.find(c => c.id === v.type)?.name || '-',
          v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag',
          v.ownershipStatus === 'purchased' ? 'Adquirido' : 'Comodato'
        ]);

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [['Data', 'Placa', 'Modelo', 'Categoria', 'Equipamento', 'Contrato']],
          body: detailedData,
          theme: 'striped',
          headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0] },
          styles: { fontSize: 8 }
        });

        storage.logAction(user, 'REPORT', 'Vehicle', `Exportou Relatório Insight: ${appliedStartDate} a ${appliedEndDate}`);
        doc.save(`insight_report_${appliedStartDate}.pdf`);
    } catch (e) {
        console.error(e);
        alert('Erro ao gerar PDF. Verifique o console.');
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
        const ExcelJS = await import('exceljs');
        const { saveAs } = await import('file-saver');
        
        const workbook = new ExcelJS.Workbook();
        workbook.creator = user?.name || 'K-TAG System';
        workbook.created = new Date();
        
        const worksheet = workbook.addWorksheet('Veículos');
        
        worksheet.columns = [
            { header: 'Data Inclusão', key: 'data', width: 15 },
            { header: 'Placa', key: 'placa', width: 15 },
            { header: 'Modelo', key: 'modelo', width: 25 },
            { header: 'Categoria', key: 'categoria', width: 20 },
            { header: 'Instalação', key: 'instalacao', width: 20 },
            { header: 'Contrato', key: 'contrato', width: 15 }
        ];
        
        // Estilo do cabeçalho
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3F3F46' } // zinc-700
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        filteredVehicles.forEach(v => {
            worksheet.addRow({
                data: v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '-',
                placa: v.plate,
                modelo: v.model,
                categoria: categories.find(c => c.id === v.type)?.name || '-',
                instalacao: v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag',
                contrato: v.ownershipStatus === 'purchased' ? 'Adquirido' : 'Comodato'
            });
        });
        
        // Estilo das linhas
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.alignment = { vertical: 'middle', horizontal: 'left' };
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `relatorio_${appliedStartDate}.xlsx`);
        
        storage.logAction(user, 'REPORT', 'Vehicle', `Exportou Excel: ${appliedStartDate} a ${appliedEndDate}`);
    } catch (e) {
        console.error("Erro ao exportar Excel:", e);
        alert('Erro ao gerar Excel. Verifique o console.');
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="space-y-10 pb-20">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-[24px] bg-primary-500/10 text-primary-500 flex items-center justify-center border border-primary-500/20 shadow-lg shadow-primary-500/10"><FileText size={32} /></div>
                <div>
                    <h1 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Relatórios e Métricas</h1>
                    <p className="text-zinc-500 mt-2 font-medium">Relatórios analíticos otimizados.</p>
                </div>
            </div>

            <div className="flex flex-col gap-4 w-full xl:w-auto">
                {/* TABS */}
                <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-2xl self-start xl:self-end">
                    <button 
                        onClick={() => setActiveTab('vehicles')}
                        className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'vehicles' ? 'bg-white dark:bg-zinc-800 text-primary-500 shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                    >
                        Veículos
                    </button>
                    <button 
                        onClick={() => setActiveTab('telemetry')}
                        className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'telemetry' ? 'bg-white dark:bg-zinc-800 text-primary-500 shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                    >
                        Telemetria K-Tag
                    </button>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-2 w-full xl:w-auto">
                     {activeTab === 'telemetry' && (
                        <div className="relative w-full md:w-72">
                            <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl px-6 py-2 transition-all cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setIsTagSelectorOpen(!isTagSelectorOpen)}>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Tag / Dispositivo</label>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold dark:text-white truncate">
                                        {selectedTag ? `${selectedTag.name} (${selectedTag.accessoryId})` : 'Selecione uma Tag...'}
                                    </span>
                                    <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isTagSelectorOpen ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            <AnimatePresence>
                                {isTagSelectorOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[100]" onClick={() => setIsTagSelectorOpen(false)} />
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-[101] overflow-hidden flex flex-col max-h-[400px]"
                                        >
                                            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Buscar por nome ou ID..." 
                                                        value={tagSearch}
                                                        onChange={e => setTagSearch(e.target.value)}
                                                        className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ring-primary-500/20"
                                                        autoFocus
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            <div className="overflow-y-auto custom-scrollbar p-1">
                                                {filteredTags.length === 0 ? (
                                                    <div className="p-8 text-center">
                                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nenhuma tag encontrada</p>
                                                    </div>
                                                ) : (
                                                    filteredTags.map(t => {
                                                        const linkedVehicle = tagLinkageMap[t.id];
                                                        const isSelected = selectedTagId === t.id;
                                                        return (
                                                            <button 
                                                                key={t.id}
                                                                onClick={() => {
                                                                    setSelectedTagId(t.id);
                                                                    setIsTagSelectorOpen(false);
                                                                }}
                                                                className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all group ${isSelected ? 'bg-primary-500/10 text-primary-500' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                                            >
                                                                <div className="flex items-center gap-3 text-left">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700'}`}>
                                                                        <Activity size={18} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-black uppercase truncate">{t.name}</p>
                                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.accessoryId}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    {linkedVehicle ? (
                                                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                                                                            <LinkIcon size={8} />
                                                                            <span className="text-[8px] font-black uppercase tracking-widest">{linkedVehicle.plate}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-full border border-zinc-200 dark:border-zinc-700">
                                                                            <Unlink size={8} />
                                                                            <span className="text-[8px] font-black uppercase tracking-widest">Livre</span>
                                                                        </div>
                                                                    )}
                                                                    {isSelected && <Check size={14} className="text-primary-500" />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                     )}
                     
                     <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl px-6 py-2 transition-all w-full md:w-auto">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Início</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none p-0 text-sm font-black outline-none cursor-pointer dark:text-white" />
                     </div>
                     <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl px-6 py-2 transition-all w-full md:w-auto">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Fim</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none p-0 text-sm font-black outline-none cursor-pointer dark:text-white" />
                     </div>
                     <button onClick={() => { setAppliedStartDate(startDate); setAppliedEndDate(endDate); if(activeTab === 'telemetry') fetchTelemetry(); else filterData(); }} className="bg-primary-500 text-black px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                         <Filter size={18} /> Filtrar
                     </button>
                </div>
            </div>
        </div>

        {activeTab === 'vehicles' ? (
            /* --- VEHICLES REPORT --- */
            <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
             <div className="bg-zinc-900 text-white p-10 rounded-[40px] flex flex-col justify-between border border-zinc-800">
                 <div>
                     <p className="text-xs text-zinc-400 font-black uppercase tracking-[0.2em] mb-4">Total Ativações</p>
                     <div className="flex items-baseline gap-2">
                        <h2 className="text-7xl font-display font-black text-white tracking-tighter">{filteredVehicles.length}</h2>
                        <span className="text-sm font-bold text-zinc-500">unid.</span>
                     </div>
                 </div>
                 <div className="mt-10 flex items-center gap-2 text-primary-500 text-xs font-black uppercase tracking-widest"><TrendingUp size={16} /> Estabilidade Operacional</div>
             </div>

             <div className="lg:col-span-3 bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800">
                 <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={trendData}>
                             <defs>
                                <linearGradient id="colorCount" x1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="var(--theme-primary, #f59e0b)" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="var(--theme-primary, #f59e0b)" stopOpacity={0}/>
                                </linearGradient>
                             </defs>
                             <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a' }} />
                             <Tooltip contentStyle={{ background: '#18181b', border: 'none', borderRadius: '16px', color: '#fff' }} />
                             <Area type="monotone" dataKey="count" stroke="var(--theme-primary, #f59e0b)" strokeWidth={4} fill="url(#colorCount)" />
                         </AreaChart>
                     </ResponsiveContainer>
                 </div>
             </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-6 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Análise Quantitativa</h3>
                <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={handleExportPDF} 
                      disabled={isExporting || filteredVehicles.length === 0}
                      className="flex-1 md:flex-none px-6 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      <Download size={14}/> {isExporting ? 'Gerando...' : 'PDF'}
                    </button>
                    <button 
                      onClick={handleExportExcel}
                      disabled={isExporting || filteredVehicles.length === 0}
                      className="flex-1 md:flex-none px-6 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      <FileSpreadsheet size={14}/> Excel
                    </button>
                </div>
            </div>
            
            {/* VIEW DESKTOP: TABLE */}
            <div className="hidden md:block overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-left">
                    <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/20 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-10 py-5">Data Inclusão</th>
                            <th className="px-10 py-5">Placa</th>
                            <th className="px-10 py-5">Modelo</th>
                            <th className="px-10 py-5 text-right">Instalação</th>
                            <th className="px-10 py-5 text-right">Contrato</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                        {filteredVehicles.map(v => (
                            <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-10 py-5 text-zinc-500 font-mono text-xs">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '-'}</td>
                                <td className="px-10 py-5 font-black text-zinc-900 dark:text-white uppercase">{v.plate}</td>
                                <td className="px-10 py-5 font-bold text-zinc-600 dark:text-zinc-300">{v.model}</td>
                                <td className="px-10 py-5 text-right"><span className="inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase border border-primary-500/20 bg-primary-500/5 text-primary-500">{v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag'}</span></td>
                                <td className="px-10 py-5 text-right">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase border ${v.ownershipStatus === 'purchased' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                                        {v.ownershipStatus === 'purchased' ? 'Adquirido' : 'Comodato'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
            </>
        ) : (
            /* --- TELEMETRY REPORT --- */
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {!selectedTagId ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 text-zinc-400">
                            <Activity size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Selecione uma Tag</h3>
                        <p className="text-zinc-500 max-w-md mt-2">Escolha um dispositivo K-Tag acima para visualizar o histórico de telemetria, bateria e sinal.</p>
                    </div>
                ) : isLoadingHistory ? (
                    <div className="flex items-center justify-center py-40">
                        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* KPI CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                    <Activity size={24} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Pings</p>
                                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{telemetryStats.totalPings}</h3>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                    <Battery size={24} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Bateria Média</p>
                                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{telemetryStats.avgBattery.toFixed(1)}%</h3>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                    <MapPin size={24} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Distância (Est.)</p>
                                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{telemetryStats.distance.toFixed(2)} km</h3>
                                </div>
                            </div>
                        </div>

                        {/* CHARTS */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Battery History */}
                            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Battery size={18} className="text-emerald-500"/> Histórico de Bateria</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={historyData}>
                                            <defs>
                                                <linearGradient id="colorBattery" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--theme-chart-1, #10b981)" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="var(--theme-chart-1, #10b981)" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.1} />
                                            <XAxis 
                                                dataKey="timestamp" 
                                                tickFormatter={(unix) => new Date(unix).toLocaleDateString()} 
                                                tick={{ fontSize: 10, fill: '#71717a' }} 
                                                minTickGap={30}
                                            />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} />
                                            <Tooltip 
                                                contentStyle={{ background: '#18181b', border: 'none', borderRadius: '16px', color: '#fff' }}
                                                labelFormatter={(unix) => new Date(unix).toLocaleString()}
                                            />
                                            <Area type="monotone" dataKey="battery.level" stroke="var(--theme-chart-1, #10b981)" strokeWidth={2} fill="url(#colorBattery)" name="Bateria %" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Ping Frequency (Points per Day) */}
                            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Signal size={18} className="text-blue-500"/> Frequência de Comunicação</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={historyData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.1} />
                                            <XAxis 
                                                dataKey="timestamp" 
                                                tickFormatter={(unix) => new Date(unix).toLocaleDateString()} 
                                                tick={{ fontSize: 10, fill: '#71717a' }} 
                                                minTickGap={30}
                                            />
                                            <Tooltip 
                                                contentStyle={{ background: '#18181b', border: 'none', borderRadius: '16px', color: '#fff' }}
                                                labelFormatter={(unix) => new Date(unix).toLocaleString()}
                                            />
                                            <Bar dataKey="conf" fill="var(--theme-chart-2, #3b82f6)" radius={[4, 4, 0, 0]} name="Confiança" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* DATA TABLE */}
                        <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                                <h3 className="text-lg font-bold">Registros Brutos</h3>
                            </div>
                            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/20 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-4">Data/Hora</th>
                                            <th className="px-6 py-4">Bateria</th>
                                            <th className="px-6 py-4">Lat/Lon</th>
                                            <th className="px-6 py-4">Precisão</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                                        {historyData.map((point, idx) => (
                                            <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 text-zinc-500 font-mono text-xs">
                                                    {new Date(point.timestamp).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: point.battery?.color || '#71717a' }}></div>
                                                        {point.battery?.level}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                                                    {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-zinc-500">
                                                    {point.conf}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}
    </div>
  );
};
