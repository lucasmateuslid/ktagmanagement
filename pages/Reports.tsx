
import * as React from 'react';
import { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Vehicle, VehicleCategory } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Calendar, Filter, FileSpreadsheet, Download, PieChart as PieIcon, BarChart3, TrendingUp, Settings, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, XAxis, Tooltip, PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid, YAxis } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

  useEffect(() => {
    const load = async () => {
        const [v, c] = await Promise.all([storage.getVehicles(), storage.getCategories()]);
        setVehicles(v); setCategories(c);
    };
    load();
  }, []);

  useEffect(() => { 
    filterData(); 
  }, [vehicles, appliedStartDate, appliedEndDate, categories]);

  const filterData = () => {
      const start = new Date(appliedStartDate + 'T00:00:00').getTime();
      const end = new Date(appliedEndDate + 'T23:59:59').getTime();
      const filtered = vehicles.filter(v => v.createdAt && v.createdAt >= start && v.createdAt <= end);
      setFilteredVehicles(filtered);
      processCharts(filtered, appliedStartDate, appliedEndDate);
  };

  const processCharts = (data: Vehicle[], startStr: string, endStr: string) => {
      // 1. Processar Categoria e Instalação (Pie Charts)
      const catMap: Record<string, number> = {};
      const instMap: Record<string, number> = {};
      
      data.forEach(v => {
          const catName = categories.find(c => c.id === v.type)?.name || 'Outros';
          catMap[catName] = (catMap[catName] || 0) + 1;
          const label = v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag';
          instMap[label] = (instMap[label] || 0) + 1;
      });

      setCategoryData(Object.keys(catMap).map(k => ({ name: k, value: catMap[k] })));
      setInstallData(Object.keys(instMap).map(k => ({ name: k, value: instMap[k] })));

      // 2. Processar Tendência Diária (Area Chart)
      const trendMap: Record<string, number> = {};
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T23:59:59');

      // Inicializar todos os dias do intervalo com 0 para o gráfico não ficar quebrado
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          trendMap[dayKey] = 0;
      }

      data.forEach(v => {
          if (v.createdAt) {
              const dayKey = new Date(v.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              if (trendMap[dayKey] !== undefined) {
                  trendMap[dayKey]++;
              }
          }
      });

      setTrendData(Object.keys(trendMap).map(k => ({ name: k, count: trendMap[k] })));
  };

  const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#71717a'];

  return (
    <div className="space-y-10 pb-20 font-sans">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-[24px] bg-primary-500/10 text-primary-500 flex items-center justify-center border border-primary-500/20 shadow-lg shadow-primary-500/10"><FileText size={32} /></div>
                <div>
                    <h1 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Insight Reports</h1>
                    <p className="text-zinc-500 mt-2 font-medium">Relatórios analíticos de crescimento e distribuição.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-2 w-full xl:w-auto">
                 <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl px-6 py-2 transition-all w-full md:w-auto">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Início</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none p-0 text-sm font-black outline-none h-5 w-full cursor-pointer dark:text-white" />
                 </div>
                 <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl px-6 py-2 transition-all w-full md:w-auto">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Fim</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none p-0 text-sm font-black outline-none h-5 w-full cursor-pointer dark:text-white" />
                 </div>
                 <button onClick={() => { setAppliedStartDate(startDate); setAppliedEndDate(endDate); }} className="bg-primary-500 text-black px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary-500/20 flex items-center justify-center gap-2 transition-all active:scale-95">
                     <Filter size={18} /> Filtrar
                 </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
             <div className="bg-zinc-900 text-white p-10 rounded-[40px] flex flex-col justify-between shadow-2xl relative overflow-hidden border border-zinc-800">
                 <div className="absolute top-0 right-0 p-32 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                 <div className="relative z-10">
                     <p className="text-xs text-zinc-400 font-black uppercase tracking-[0.2em] mb-4">Total Ativações</p>
                     <div className="flex items-baseline gap-2">
                        <h2 className="text-7xl font-display font-black text-white tracking-tighter">{filteredVehicles.length}</h2>
                        <span className="text-sm font-bold text-zinc-500">unid.</span>
                     </div>
                 </div>
                 <div className="relative z-10 mt-10 flex items-center gap-2 text-primary-500 text-xs font-black uppercase tracking-widest"><TrendingUp size={16} /> Performance Estável</div>
             </div>

             <div className="lg:col-span-3 bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[300px]">
                 <div className="flex items-center gap-3 mb-8">
                    <BarChart3 size={18} className="text-primary-500" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Fluxo de Inclusões Diárias</h3>
                 </div>
                 <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={trendData}>
                             <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                             </defs>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e2e2" opacity={0.1} />
                             <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} />
                             <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                             <Tooltip 
                                contentStyle={{ background: '#18181b', border: 'none', borderRadius: '16px', color: '#fff' }} 
                                itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                             />
                             <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                         </AreaChart>
                     </ResponsiveContainer>
                 </div>
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2"><PieIcon size={16} /> Por Categoria</h3>
                 <div className="h-64 w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={categoryData} 
                                innerRadius={70} 
                                outerRadius={100} 
                                paddingAngle={8} 
                                dataKey="value" 
                                cornerRadius={8}
                                stroke="none"
                            >
                                {categoryData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <div className="text-3xl font-display font-black text-zinc-900 dark:text-white leading-none">{categoryData.reduce((a, b) => a + b.value, 0)}</div>
                        <div className="text-[10px] uppercase text-zinc-400 font-black tracking-widest mt-1">Total</div>
                    </div>
                 </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2"><Settings size={16} /> Por Equipamento</h3>
                 <div className="h-64 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={installData} 
                                innerRadius={70} 
                                outerRadius={100} 
                                paddingAngle={8} 
                                dataKey="value" 
                                cornerRadius={8}
                                stroke="none"
                            >
                                {installData.map((e, i) => <Cell key={i} fill={i === 0 ? '#f59e0b' : '#27272a'} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <div className="text-3xl font-display font-black text-zinc-900 dark:text-white leading-none">{installData.length > 0 ? "OK" : "0"}</div>
                        <div className="text-[10px] uppercase text-zinc-400 font-black tracking-widest mt-1">Mix</div>
                    </div>
                 </div>
            </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-10 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/20">
                <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Lista Detalhada</h3>
                <div className="flex gap-2">
                    <button className="px-6 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-red-500 transition-all flex items-center gap-2 text-zinc-500"><Download size={14}/> PDF</button>
                    <button className="px-6 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-emerald-500 transition-all flex items-center gap-2 text-zinc-500"><FileSpreadsheet size={14}/> Excel</button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/30 dark:bg-zinc-950/20 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-10 py-5">Data Inclusão</th>
                            <th className="px-10 py-5">Placa</th>
                            <th className="px-10 py-5">Modelo</th>
                            <th className="px-10 py-5">Categoria</th>
                            <th className="px-10 py-5 text-right">Instalação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                        {filteredVehicles.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-10 py-20 text-center text-zinc-400 font-bold uppercase text-xs">Nenhum registro para este período</td>
                            </tr>
                        ) : (
                            filteredVehicles.map(v => (
                                <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-10 py-5 text-zinc-500 font-mono text-xs">{new Date(v.createdAt!).toLocaleDateString()}</td>
                                    <td className="px-10 py-5 font-black text-zinc-900 dark:text-white uppercase">{v.plate}</td>
                                    <td className="px-10 py-5 font-bold text-zinc-600 dark:text-zinc-300">{v.model}</td>
                                    <td className="px-10 py-5 text-zinc-400 font-black uppercase text-[10px]">{categories.find(c => c.id === v.type)?.name || '-'}</td>
                                    <td className="px-10 py-5 text-right"><span className="inline-flex items-center gap-1.5 text-primary-500 bg-primary-500/10 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-primary-500/20">{v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag'}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
