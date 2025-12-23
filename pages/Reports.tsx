
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { Vehicle, VehicleCategory } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Filter, FileSpreadsheet, Download, PieChart as PieIcon, BarChart3, TrendingUp, Settings } from 'lucide-react';
import { ResponsiveContainer, XAxis, Tooltip, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, YAxis } from 'recharts';

export const Reports = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [appliedStartDate, setAppliedStartDate] = useState(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState(endDate);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [installData, setInstallData] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
        const [v, c] = await Promise.all([storage.getVehicles(), storage.getCategories()]);
        setVehicles(v); setCategories(c);
    };
    load();
  }, []);

  const filterData = useCallback(() => {
      const start = new Date(appliedStartDate + 'T00:00:00').getTime();
      const end = new Date(appliedEndDate + 'T23:59:59').getTime();
      const filtered = vehicles.filter(v => v.createdAt && v.createdAt >= start && v.createdAt <= end);
      setFilteredVehicles(filtered);
      
      const catMap: Record<string, number> = {};
      const instMap: Record<string, number> = {};
      filtered.forEach(v => {
          const catName = categories.find(c => c.id === v.type)?.name || 'Outros';
          catMap[catName] = (catMap[catName] || 0) + 1;
          const label = v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag';
          instMap[label] = (instMap[label] || 0) + 1;
      });
      setCategoryData(Object.keys(catMap).map(k => ({ name: k, value: catMap[k] })));
      setInstallData(Object.keys(instMap).map(k => ({ name: k, value: instMap[k] })));

      const trendMap: Record<string, number> = {};
      for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
          trendMap[d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })] = 0;
      }
      filtered.forEach(v => {
          if (v.createdAt) {
              const dayKey = new Date(v.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              if (trendMap[dayKey] !== undefined) trendMap[dayKey]++;
          }
      });
      setTrendData(Object.keys(trendMap).map(k => ({ name: k, count: trendMap[k] })));
  }, [vehicles, appliedStartDate, appliedEndDate, categories]);

  useEffect(() => { filterData(); }, [filterData]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ]);
        
        const doc = new jsPDF();
        const total = filteredVehicles.length;
        const soTag = filteredVehicles.filter(v => v.installationType !== 'tag_tracker').length;
        const tagTracker = total - soTag;

        // --- HEADER ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(24, 24, 27);
        doc.text("K-TAG INSIGHT REPORT", 14, 22);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(113, 113, 122);
        doc.text(`Período: ${new Date(appliedStartDate + 'T00:00:00').toLocaleDateString()} - ${new Date(appliedEndDate + 'T23:59:59').toLocaleDateString()}`, 14, 30);
        doc.text(`Gerado por: ${user?.name || 'Admin'} (${user?.role || 'User'}) em ${new Date().toLocaleString()}`, 14, 36);

        // --- DASHBOARD CARDS ---
        // Total Ativações (Dark)
        doc.setFillColor(24, 24, 27);
        doc.roundedRect(14, 45, 58, 30, 4, 4, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text("TOTAL ATIVAÇÕES", 19, 53);
        doc.setFontSize(18);
        doc.text(total.toString(), 19, 68);

        // Só Tag (Orange)
        doc.setFillColor(245, 158, 11);
        doc.roundedRect(76, 45, 58, 30, 4, 4, "F");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.text("SÓ TAG", 81, 53);
        doc.setFontSize(18);
        const soTagPerc = total > 0 ? ((soTag / total) * 100).toFixed(1) : "0";
        doc.text(`${soTag} (${soTagPerc}%)`, 81, 68);

        // Tag + Rastreador (Grey)
        doc.setFillColor(244, 244, 245);
        doc.roundedRect(138, 45, 58, 30, 4, 4, "F");
        doc.setTextColor(24, 24, 27);
        doc.setFontSize(8);
        doc.text("TAG + RASTREADOR", 143, 53);
        doc.setFontSize(18);
        const tagTrackerPerc = total > 0 ? ((tagTracker / total) * 100).toFixed(1) : "0";
        doc.text(`${tagTracker} (${tagTrackerPerc}%)`, 143, 68);

        // --- DISTRIBUIÇÃO POR CATEGORIA ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(24, 24, 27);
        doc.text("Distribuição por Categoria", 14, 88);

        const categorySummary = categoryData.map(c => [
          c.name,
          c.value,
          total > 0 ? `${((c.value / total) * 100).toFixed(1)}%` : '0%'
        ]);

        autoTable(doc, {
          startY: 93,
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
          new Date(v.createdAt!).toLocaleDateString(),
          v.plate,
          v.model,
          categories.find(c => c.id === v.type)?.name || '-',
          v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag'
        ]);

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [['Data', 'Placa', 'Modelo', 'Categoria', 'Equipamento']],
          body: detailedData,
          theme: 'striped',
          headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0] },
          styles: { fontSize: 8 }
        });

        storage.logAction(user, 'REPORT', 'Vehicle', `Exportou Relatório Insight: ${appliedStartDate} a ${appliedEndDate}`);
        doc.save(`insight_report_${appliedStartDate}.pdf`);
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
        const XLSX = await import('xlsx');
        const dataToExport = filteredVehicles.map(v => ({
            Data: new Date(v.createdAt!).toLocaleDateString(),
            Placa: v.plate,
            Modelo: v.model,
            Categoria: categories.find(c => c.id === v.type)?.name || '-',
            Instalacao: v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag'
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Veículos");
        storage.logAction(user, 'REPORT', 'Vehicle', `Exportou Excel: ${appliedStartDate} a ${appliedEndDate}`);
        XLSX.writeFile(workbook, `relatorio_${appliedStartDate}.xlsx`);
    } finally {
        setIsExporting(false);
    }
  };

  const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#71717a'];

  return (
    <div className="space-y-10 pb-20">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-[24px] bg-primary-500/10 text-primary-500 flex items-center justify-center border border-primary-500/20 shadow-lg shadow-primary-500/10"><FileText size={32} /></div>
                <div>
                    <h1 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Insight Reports</h1>
                    <p className="text-zinc-500 mt-2 font-medium">Relatórios analíticos otimizados.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-2 w-full xl:w-auto">
                 <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl px-6 py-2 transition-all w-full md:w-auto">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Início</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none p-0 text-sm font-black outline-none cursor-pointer dark:text-white" />
                 </div>
                 <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl px-6 py-2 transition-all w-full md:w-auto">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Fim</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none p-0 text-sm font-black outline-none cursor-pointer dark:text-white" />
                 </div>
                 <button onClick={() => { setAppliedStartDate(startDate); setAppliedEndDate(endDate); }} className="bg-primary-500 text-black px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                     <Filter size={18} /> Filtrar
                 </button>
            </div>
        </div>

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
                                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                             </defs>
                             <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a' }} />
                             <Tooltip contentStyle={{ background: '#18181b', border: 'none', borderRadius: '16px', color: '#fff' }} />
                             <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={4} fill="url(#colorCount)" />
                         </AreaChart>
                     </ResponsiveContainer>
                 </div>
             </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-10 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Análise Quantitativa</h3>
                <div className="flex gap-2">
                    <button 
                      onClick={handleExportPDF} 
                      disabled={isExporting || filteredVehicles.length === 0}
                      className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      <Download size={14}/> {isExporting ? 'Processando...' : 'PDF'}
                    </button>
                    <button 
                      onClick={handleExportExcel}
                      disabled={isExporting || filteredVehicles.length === 0}
                      className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      <FileSpreadsheet size={14}/> Excel
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-left">
                    <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/20 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-10 py-5">Data Inclusão</th>
                            <th className="px-10 py-5">Placa</th>
                            <th className="px-10 py-5">Modelo</th>
                            <th className="px-10 py-5 text-right">Instalação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                        {filteredVehicles.map(v => (
                            <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-10 py-5 text-zinc-500 font-mono text-xs">{new Date(v.createdAt!).toLocaleDateString()}</td>
                                <td className="px-10 py-5 font-black text-zinc-900 dark:text-white uppercase">{v.plate}</td>
                                <td className="px-10 py-5 font-bold text-zinc-600 dark:text-zinc-300">{v.model}</td>
                                <td className="px-10 py-5 text-right"><span className="inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase border border-primary-500/20 bg-primary-500/5 text-primary-500">{v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag'}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
