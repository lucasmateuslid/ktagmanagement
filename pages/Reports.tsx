
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Vehicle, VehicleCategory } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { FileText, Calendar, Filter, FileSpreadsheet, Download } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const Reports = () => {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  
  // Date Filter State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
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

  useEffect(() => {
      filterData();
  }, [vehicles, startDate, endDate]);

  const filterData = () => {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const filtered = vehicles.filter(v => {
          if (!v.createdAt) return false;
          return v.createdAt >= start.getTime() && v.createdAt <= end.getTime();
      });

      setFilteredVehicles(filtered);
      processCharts(filtered);
  };

  const processCharts = (data: Vehicle[]) => {
      // 1. Trend (Group by Day)
      const trendMap: Record<string, number> = {};
      data.forEach(v => {
          const dateStr = new Date(v.createdAt).toLocaleDateString();
          trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
      });
      // Convert to array and sort by date
      const trendArr = Object.keys(trendMap).map(k => ({
          date: k,
          count: trendMap[k],
          timestamp: new Date(k.split('/').reverse().join('-')).getTime() // Simple parse for sorting if needed
      })).sort((a,b) => {
         // Naive sort for DD/MM/YYYY format or similar
         const da = a.date.split('/').reverse().join('');
         const db = b.date.split('/').reverse().join('');
         return da.localeCompare(db);
      });
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const handleExportPDF = () => {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(t('vehicleList'), 14, 22);
      doc.setFontSize(11);
      doc.text(`${t('reportPeriod')}: ${startDate} - ${endDate}`, 14, 30);
      
      const headers = [[t('inclusionDate'), t('plate'), t('model'), t('type'), t('byInstallation')]];
      const rows = filteredVehicles.map(v => [
          new Date(v.createdAt).toLocaleDateString(),
          v.plate,
          v.model,
          categories.find(c => c.id === v.type)?.name || '-',
          v.installationType === 'tag_tracker' ? t('tagTracker') : t('tagOnly')
      ]);

      autoTable(doc, { head: headers, body: rows, startY: 40 });
      doc.save('vehicles_report.pdf');
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
  };

  return (
    <div className="space-y-6 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <FileText size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('reports')}</h1>
                    <p className="text-zinc-500">{t('reportPeriod')}: {startDate} to {endDate}</p>
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-2 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">{t('startDate')}</label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-primary-500"
                    />
                 </div>
                 <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">{t('endDate')}</label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-primary-500"
                    />
                 </div>
                 <button className="bg-primary-600 text-white p-2 rounded-lg hover:bg-primary-700 transition-colors">
                     <Filter size={18} />
                 </button>
            </div>
        </div>

        {/* --- MINI DASHBOARD --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             {/* Total KPI */}
             <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                 <div>
                     <p className="text-sm text-zinc-500 font-medium uppercase tracking-wider">{t('totalInclusions')}</p>
                     <h2 className="text-4xl font-display font-bold text-zinc-900 dark:text-white mt-1">{filteredVehicles.length}</h2>
                 </div>
                 <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                     <Calendar size={24} className="text-zinc-500" />
                 </div>
             </div>

             {/* Trend Chart */}
             <div className="lg:col-span-3 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <h3 className="text-sm text-zinc-500 font-medium uppercase tracking-wider mb-4">{t('inclusionsByDay')}</h3>
                 <div className="h-40 w-full min-w-0">
                     <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={trendData}>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                cursor={{ fill: '#27272a', opacity: 0.2 }}
                            />
                            <XAxis dataKey="date" hide />
                            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                         </BarChart>
                     </ResponsiveContainer>
                 </div>
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Pie */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <h3 className="text-sm text-zinc-500 font-medium uppercase tracking-wider mb-4">{t('byCategory')}</h3>
                 <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {categoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36}/>
                            <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        </PieChart>
                    </ResponsiveContainer>
                 </div>
            </div>

            {/* Installation Pie */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <h3 className="text-sm text-zinc-500 font-medium uppercase tracking-wider mb-4">{t('byInstallation')}</h3>
                 <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={installData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {installData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#6366f1'} />
                                ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36}/>
                            <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        </PieChart>
                    </ResponsiveContainer>
                 </div>
            </div>
        </div>

        {/* --- DETAILED LIST --- */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
                <h3 className="font-bold text-zinc-800 dark:text-zinc-200">{t('vehicleList')}</h3>
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportPDF}
                        disabled={filteredVehicles.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        <Download size={14} /> PDF
                    </button>
                    <button 
                         onClick={handleExportExcel}
                         disabled={filteredVehicles.length === 0}
                         className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        <FileSpreadsheet size={14} /> Excel
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800 uppercase border-b border-zinc-200 dark:border-zinc-700">
                        <tr>
                            <th className="px-6 py-3">{t('inclusionDate')}</th>
                            <th className="px-6 py-3">{t('plate')}</th>
                            <th className="px-6 py-3">{t('model')}</th>
                            <th className="px-6 py-3">{t('type')}</th>
                            <th className="px-6 py-3">{t('byInstallation')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredVehicles.map(v => (
                            <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td className="px-6 py-4 text-zinc-500">{new Date(v.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-mono font-bold text-zinc-900 dark:text-white">{v.plate}</td>
                                <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{v.model}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded text-xs">
                                        {categories.find(c => c.id === v.type)?.name || '-'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {v.installationType === 'tag_tracker' ? (
                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded">
                                            {t('tagTracker')}
                                        </span>
                                    ) : (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                                            {t('tagOnly')}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredVehicles.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-zinc-400">{t('noDataPeriod')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
