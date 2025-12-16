
import * as React from 'react';
import { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Vehicle, VehicleCategory } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Calendar, Filter, FileSpreadsheet, Download, PieChart as PieIcon, BarChart3, TrendingUp, Settings } from 'lucide-react';
import { ResponsiveContainer, XAxis, Tooltip, PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const Reports = () => {
  const { t } = useLanguage();
  const { user } = useAuth(); // Audit
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  
  // Date Inputs State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Default to last 7 days
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Applied Filter State (Actual Logic Trigger)
  const [appliedStartDate, setAppliedStartDate] = useState(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState(endDate);
  
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  
  // Charts Data
  const [trendData, setTrendData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [installData, setInstallData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
        const [v, c] = await Promise.all([
            storage.getVehicles(),
            storage.getCategories()
        ]);
        setVehicles(v);
        setCategories(c);
    };
    loadData();
  }, []);

  // Trigger filter only when Vehicles load OR when user clicks Filter (changing applied dates)
  useEffect(() => {
      filterData();
  }, [vehicles, appliedStartDate, appliedEndDate]);

  const handleApplyFilter = () => {
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
  };

  // Helper to force Local Time creation from YYYY-MM-DD string
  const parseLocalDate = (dateStr: string): Date => {
      if (!dateStr) return new Date(); // Fallback
      const parts = dateStr.split('-').map(Number);
      if (parts.length !== 3) return new Date();
      const [year, month, day] = parts;
      return new Date(year, month - 1, day);
  };

  const toLocalISO = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  // Format YYYY-MM-DD to DD/MM/YYYY for display
  const formatDateDisplay = (isoDate: string) => {
      if (!isoDate) return '-';
      const [y, m, d] = isoDate.split('-');
      return `${d}/${m}/${y}`;
  }

  const filterData = () => {
      // Create Local Dates from the inputs
      const start = parseLocalDate(appliedStartDate);
      start.setHours(0, 0, 0, 0); // Start of day

      const end = parseLocalDate(appliedEndDate);
      end.setHours(23, 59, 59, 999); // End of day

      const filtered = vehicles.filter(v => {
          if (!v.createdAt) return false;
          // Compare timestamps
          return v.createdAt >= start.getTime() && v.createdAt <= end.getTime();
      });

      setFilteredVehicles(filtered);
      processCharts(filtered);
  };

  const processCharts = (data: Vehicle[]) => {
      // 1. Trend (Group by Day)
      const countMap: Record<string, number> = {};
      
      data.forEach(v => {
          if (!v.createdAt) return;
          const d = new Date(v.createdAt);
          const key = toLocalISO(d);
          countMap[key] = (countMap[key] || 0) + 1;
      });

      const trendArr = [];
      const start = parseLocalDate(appliedStartDate);
      const end = parseLocalDate(appliedEndDate);
      
      if (start <= end) {
          const current = new Date(start);
          let safetyCounter = 0;
          
          while (current <= end && safetyCounter < 365) {
              const key = toLocalISO(current);
              const displayDate = current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              
              trendArr.push({
                  date: displayDate, // X-Axis Label
                  fullDate: key,     // Tooltip
                  count: countMap[key] || 0,
                  timestamp: current.getTime()
              });
              
              current.setDate(current.getDate() + 1);
              safetyCounter++;
          }
      }
      
      setTrendData(trendArr);

      // 2. Category Distribution
      const catMap: Record<string, number> = {};
      data.forEach(v => {
          const catName = categories.find(c => c.id === v.type)?.name || 'Outros';
          catMap[catName] = (catMap[catName] || 0) + 1;
      });
      const catArr = Object.keys(catMap).map(k => ({ name: k, value: catMap[k] }));
      setCategoryData(catArr);

      // 3. Installation Type Distribution
      const instMap: Record<string, number> = {};
      data.forEach(v => {
          const label = v.installationType === 'tag_tracker' ? t('tagTracker') : t('tagOnly');
          instMap[label] = (instMap[label] || 0) + 1;
      });
      const instArr = Object.keys(instMap).map(k => ({ name: k, value: instMap[k] }));
      setInstallData(instArr);
  };

  const COLORS = ['#f59e0b', '#27272a', '#52525b', '#a1a1aa', '#d4d4d8']; 

  const handleExportPDF = () => {
      const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.setTextColor(40, 40, 45); 
      doc.text("K-TAG RELATÓRIO DE FROTA", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 26);
      doc.text(`Período: ${formatDateDisplay(appliedStartDate)} até ${formatDateDisplay(appliedEndDate)}`, 14, 31);

      let yPos = 45;
      
      doc.setFillColor(245, 158, 11); 
      doc.rect(14, 38, 182, 1, 'F'); 

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Resumo Executivo", 14, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.text(`Total de Veículos no Período: ${filteredVehicles.length}`, 14, yPos);
      yPos += 6;

      doc.text("Distribuição por Categoria:", 14, yPos);
      yPos += 6;
      categoryData.forEach(cat => {
          doc.text(`• ${cat.name}: ${cat.value}`, 20, yPos);
          yPos += 5;
      });
      yPos += 2;

      doc.text("Distribuição por Instalação:", 14, yPos);
      yPos += 6;
      installData.forEach(inst => {
          doc.text(`• ${inst.name}: ${inst.value}`, 20, yPos);
          yPos += 5;
      });

      yPos += 10; 

      doc.setFontSize(14);
      doc.text(t('vehicleList'), 14, yPos);

      const headers = [[t('inclusionDate'), t('plate'), t('model'), t('type'), t('byInstallation')]];
      const rows = filteredVehicles.map(v => [
          new Date(v.createdAt).toLocaleDateString(),
          v.plate,
          v.model,
          categories.find(c => c.id === v.type)?.name || '-',
          v.installationType === 'tag_tracker' ? t('tagTracker') : t('tagOnly')
      ]);

      autoTable(doc, { 
          head: headers, 
          body: rows, 
          startY: yPos + 4,
          theme: 'grid',
          headStyles: { fillColor: [39, 39, 42] }, 
      });
      doc.save('vehicles_report_full.pdf');

      storage.logAction(user, 'REPORT', 'Report', 'Exported Vehicle Fleet PDF');
  };

  const handleExportExcel = () => {
      const rows = filteredVehicles.map(v => ({
          [t('inclusionDate')]: new Date(v.createdAt).toLocaleDateString(),
          [t('plate')]: v.plate,
          [t('model')]: v.model,
          [t('type')]: categories.find(c => c.id === v.type)?.name || '-',
          [t('byInstallation')]: v.installationType === 'tag_tracker' ? t('tagTracker') : t('tagOnly')
      }));
      
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
      XLSX.writeFile(wb, "vehicles_report.xlsx");

      storage.logAction(user, 'REPORT', 'Report', 'Exported Vehicle Fleet Excel');
  };

  return (
    <div className="space-y-8 pb-20 font-sans">
        
        {/* --- HEADER & FILTERS --- */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
            <div>
                <h1 className="text-3xl font-display font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                    {t('reports')}
                </h1>
                <p className="text-zinc-500 mt-1 text-sm">
                    Análise detalhada de inclusões e distribuição da frota.
                </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-full xl:w-auto">
                 
                 {/* Start Date */}
                 <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-4 py-2 border border-zinc-100 dark:border-zinc-700/50 focus-within:ring-2 focus-within:ring-primary-500/50 transition-all w-full sm:w-auto">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase leading-none mb-1">{t('startDate')}</label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border-none p-0 text-sm font-bold text-zinc-900 dark:text-white focus:ring-0 h-5 w-full cursor-pointer"
                    />
                 </div>
                 
                 <div className="hidden sm:block text-zinc-300 dark:text-zinc-700">/</div>

                 {/* End Date */}
                 <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-4 py-2 border border-zinc-100 dark:border-zinc-700/50 focus-within:ring-2 focus-within:ring-primary-500/50 transition-all w-full sm:w-auto">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase leading-none mb-1">{t('endDate')}</label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent border-none p-0 text-sm font-bold text-zinc-900 dark:text-white focus:ring-0 h-5 w-full cursor-pointer"
                    />
                 </div>

                 <button 
                    onClick={handleApplyFilter}
                    className="w-full sm:w-auto bg-primary-500 hover:bg-primary-400 text-black px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2"
                 >
                     <Filter size={18} /> {t('filter')}
                 </button>
            </div>
        </div>

        {/* --- KPI & TREND SECTION --- */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
             {/* Total KPI Card */}
             <div className="bg-zinc-900 dark:bg-zinc-950 text-white p-8 rounded-3xl flex flex-col justify-between shadow-xl relative overflow-hidden group border border-zinc-800">
                 <div className="absolute top-0 right-0 p-32 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary-500/20 transition-all duration-700" />
                 
                 <div className="relative z-10">
                     <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-4">{t('totalInclusions')}</p>
                     <div className="flex items-baseline gap-2">
                        <h2 className="text-6xl font-display font-black text-white tracking-tight">{filteredVehicles.length}</h2>
                        <span className="text-sm font-medium text-zinc-500">veículos</span>
                     </div>
                 </div>
                 
                 <div className="relative z-10 mt-8 flex items-center gap-2 text-primary-500 text-sm font-medium">
                     <TrendingUp size={16} />
                     <span>No período selecionado</span>
                 </div>
             </div>

             {/* Trend Chart Card */}
             <div className="lg:col-span-3 bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-2">
                        <BarChart3 size={16} className="text-primary-500"/> {t('inclusionsByDay')}
                    </h3>
                 </div>
                 <div className="flex-1 min-h-[200px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.1} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
                                itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                                cursor={{ stroke: '#f59e0b', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 10, fill: '#71717a' }} 
                                axisLine={false} 
                                tickLine={false}
                                dy={10}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="count" 
                                stroke="#f59e0b" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#colorCount)" 
                            />
                         </AreaChart>
                     </ResponsiveContainer>
                 </div>
             </div>
        </div>

        {/* --- PIE CHARTS SECTION --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                 <h3 className="text-sm text-zinc-500 font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
                    <PieIcon size={16} /> {t('byCategory')}
                 </h3>
                 <div className="h-64 w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={categoryData} 
                                innerRadius={60} 
                                outerRadius={80} 
                                paddingAngle={5} 
                                dataKey="value"
                                cornerRadius={4}
                            >
                                {categoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                                itemStyle={{ color: '#e4e4e7' }} 
                            />
                            <Legend 
                                verticalAlign="bottom" 
                                iconType="circle"
                                formatter={(value) => <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 ml-1">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <span className="block text-2xl font-display font-bold text-zinc-900 dark:text-white">
                                {categoryData.length}
                            </span>
                            <span className="text-[10px] uppercase text-zinc-400 font-bold">Tipos</span>
                        </div>
                    </div>
                 </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                 <h3 className="text-sm text-zinc-500 font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
                    <PieIcon size={16} /> {t('byInstallation')}
                 </h3>
                 <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={installData} 
                                innerRadius={60} 
                                outerRadius={80} 
                                paddingAngle={5} 
                                dataKey="value"
                                cornerRadius={4}
                            >
                                {installData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#f59e0b'} stroke="rgba(0,0,0,0)" />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                                itemStyle={{ color: '#e4e4e7' }} 
                            />
                            <Legend 
                                verticalAlign="bottom" 
                                iconType="circle"
                                formatter={(value) => <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 ml-1">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                 </div>
            </div>
        </div>

        {/* --- DETAILED LIST TABLE --- */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{t('vehicleList')}</h3>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mt-1">Exportação de Dados</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportPDF}
                        disabled={filteredVehicles.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-red-500 hover:text-red-500 dark:hover:text-red-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50 text-zinc-600 dark:text-zinc-400"
                    >
                        <Download size={16} /> PDF
                    </button>
                    <button 
                         onClick={handleExportExcel}
                         disabled={filteredVehicles.length === 0}
                         className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-green-500 hover:text-green-500 dark:hover:text-green-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50 text-zinc-600 dark:text-zinc-400"
                    >
                        <FileSpreadsheet size={16} /> Excel
                    </button>
                </div>
            </div>
            
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                        <tr>
                            <th className="px-6 py-4">{t('inclusionDate')}</th>
                            <th className="px-6 py-4">{t('plate')}</th>
                            <th className="px-6 py-4">{t('model')}</th>
                            <th className="px-6 py-4">{t('type')}</th>
                            <th className="px-6 py-4">{t('byInstallation')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                        {filteredVehicles.map(v => (
                            <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                <td className="px-6 py-4 text-zinc-500 font-mono text-xs">
                                    {new Date(v.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-mono font-bold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700">
                                        {v.plate}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 font-medium">
                                    {v.model}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">
                                        {categories.find(c => c.id === v.type)?.name || '-'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {v.installationType === 'tag_tracker' ? (
                                        <span className="inline-flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-bold text-[10px] bg-primary-50 dark:bg-primary-900/10 px-2 py-1 rounded-full uppercase tracking-wide border border-primary-100 dark:border-primary-900/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                                            {t('tagTracker')}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded-full uppercase tracking-wide border border-emerald-100 dark:border-emerald-900/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            {t('tagOnly')}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredVehicles.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
                                    <FileText size={32} className="opacity-20" />
                                    <span className="text-sm font-medium">{t('noDataPeriod')}</span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden p-4 space-y-3">
                {filteredVehicles.map(v => (
                    <div key={v.id} className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{categories.find(c => c.id === v.type)?.name || '-'}</span>
                                <h4 className="font-bold text-zinc-900 dark:text-white mt-0.5">{v.model}</h4>
                            </div>
                            <span className="font-mono font-bold text-xs bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">
                                {v.plate}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-zinc-200 dark:border-zinc-800 mt-3">
                            <span className="text-xs text-zinc-500 font-mono">{new Date(v.createdAt).toLocaleDateString()}</span>
                            {v.installationType === 'tag_tracker' ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-full">
                                    <Settings size={10} /> {t('tagTracker')}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                    {t('tagOnly')}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
                {filteredVehicles.length === 0 && (
                    <div className="text-center p-8 text-zinc-400 text-sm">Nenhum registro.</div>
                )}
            </div>
        </div>
    </div>
  );
};
