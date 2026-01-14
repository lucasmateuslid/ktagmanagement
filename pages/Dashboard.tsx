
import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Tag, Vehicle, Company, VehicleCategory } from '../types';
import { storage } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useAuth } from '../contexts/AuthContext';
import { ResponsiveContainer, AreaChart, Area, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Tag as TagIcon, CarFront, Link2, Plus, Activity, Truck, Bike, Car, Clock, Building2, AlertTriangle, Lock, ChevronRight, ShoppingCart, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import * as ReactRouterDOM from 'react-router-dom';

const { Link, useNavigate } = ReactRouterDOM as any;
const MotionDiv = motion.div as any;

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [companyChartData, setCompanyChartData] = useState<any[]>([]);
  const [trendChartData, setTrendChartData] = useState<any[]>([]);
  const { t } = useLanguage();
  const { lastSync } = useConnection();

  useEffect(() => {
    if (user?.role === 'client') {
      navigate('/map', { replace: true });
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    const [loadedTags, loadedVehicles, loadedCompanies, loadedCategories] = await Promise.all([
      storage.getTags(),
      storage.getVehicles(),
      storage.getCompanies(),
      storage.getCategories()
    ]);
    setTags(loadedTags);
    setVehicles(loadedVehicles);
    setCompanies(loadedCompanies);
    setCategories(loadedCategories);
    processHistoryData(loadedTags, loadedVehicles);
    processCompanyData(loadedVehicles, loadedCompanies);
    processTrendData(loadedVehicles);
  };

  const processHistoryData = (tags: Tag[], vehicles: Vehicle[]) => {
    const days = 7;
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString(undefined, { weekday: 'short' });
      const timestamp = date.setHours(23, 59, 59, 999);
      const existingTags = tags.filter(t => t.createdAt <= timestamp);
      data.push({ name: dateStr, total: existingTags.length });
    }
    setChartData(data);
  };

  const processCompanyData = (vehicles: Vehicle[], companies: Company[]) => {
    const counts: Record<string, number> = {};
    vehicles.forEach(v => {
      const id = v.companyId || 'unknown';
      counts[id] = (counts[id] || 0) + 1;
    });
    const data = companies.map(c => ({
      name: c.prefix || c.name,
      fullName: c.name,
      count: counts[c.id] || 0
    }));
    setCompanyChartData(data.sort((a, b) => b.count - a.count));
  };

  const processTrendData = (vehicles: Vehicle[]) => {
    const monthsArray: any[] = [];
    const now = new Date();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = monthNames[d.getMonth()];
      const count = vehicles.filter(v => {
        if (!v.createdAt) return false;
        const vDate = new Date(v.createdAt);
        return vDate.getMonth() === d.getMonth() && vDate.getFullYear() === d.getFullYear();
      }).length;
      monthsArray.push({ name: monthLabel, entries: count });
    }
    setTrendChartData(monthsArray);
  };

  const linkedCount = vehicles.filter(v => v.tagId).length;
  const unlinkedCount = tags.length - linkedCount;
  const stolenCount = vehicles.filter(v => v.status === 'stolen').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;
  
  const isWarningStock = unlinkedCount <= 80;
  const isCriticalStock = unlinkedCount <= 40;
  const theftRate = vehicles.length > 0 ? ((stolenCount / vehicles.length) * 100).toFixed(1) : '0.0';

  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    vehicles.forEach(v => {
      counts[v.type] = (counts[v.type] || 0) + 1;
    });
    return categories.map(cat => ({
      ...cat,
      count: counts[cat.id] || 0
    })).sort((a, b) => b.count - a.count);
  }, [vehicles, categories]);

  const getIconForCategory = (fipeType: string) => {
    switch (fipeType) {
      case 'carros': return <Car size={14} />;
      case 'caminhoes': return <Truck size={14} />;
      case 'motos': return <Bike size={14} />;
      default: return <Activity size={14} />;
    }
  };

  if (user?.role === 'client') return null;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-display font-bold text-zinc-900 dark:text-white">
            {t('overview')}
          </h1>
          <p className="text-zinc-500 text-sm">Monitoramento inteligente da frota K-TAG.</p>
        </div>
        {lastSync && (
          <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <Clock size={12} /> Sincronizado: {new Date(lastSync).toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARDS PRINCIPAIS */}
        <MotionDiv 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between shadow-sm min-h-[280px]"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{t('totalTags')}</h3>
              <p className="text-5xl font-display font-black text-zinc-900 dark:text-white mt-2 tracking-tighter">{tags.length}</p>
            </div>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-primary-500 border border-zinc-200 dark:border-zinc-700">
              <TagIcon size={24} />
            </div>
          </div>
          
          <div className="h-28 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={3} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </MotionDiv>

        <MotionDiv 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-zinc-950 rounded-[32px] p-6 border border-zinc-800 text-white flex flex-col justify-between shadow-xl min-h-[280px]"
        >
          <div className="flex justify-between mb-2">
            <div>
              <span className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">{t('totalVehicles')}</span>
              <p className="text-5xl font-display font-black mb-2 tracking-tighter text-white">{vehicles.length}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-primary-500">
              <CarFront size={24} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-4">
            {categoryStats.slice(0, 4).map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-primary-500">{getIconForCategory(cat.fipeType)}</div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-zinc-500 truncate">{cat.name.split(' ')[0]}</span>
                  <span className="text-lg font-bold leading-none">{cat.count}</span>
                </div>
              </div>
            ))}
          </div>
        </MotionDiv>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO TENDÊNCIA 6 MESES */}
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-primary-500" />
              <h3 className="text-zinc-900 dark:text-white text-[11px] font-black uppercase tracking-widest">Tendência de Ativações (6 Meses)</h3>
            </div>
            <span className="text-[10px] font-bold text-zinc-400">Mensal</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="entries" 
                  stroke="#f59e0b" 
                  strokeWidth={4} 
                  fill="url(#colorTrend)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* REGIONAIS */}
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-2 mb-8">
            <Building2 size={18} className="text-primary-500" />
            <h3 className="text-zinc-900 dark:text-white text-[11px] font-black uppercase tracking-widest">Veículos por Regional</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={companyChartData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 rounded-[32px] border transition-colors shadow-sm ${stolenCount > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Veículos Roubados</p>
            <AlertTriangle size={20} className={stolenCount > 0 ? 'text-red-500' : 'text-zinc-300'} />
          </div>
          <h2 className={`text-4xl font-display font-black ${stolenCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{stolenCount}</h2>
        </div>

        <div className="p-6 bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Em Manutenção</p>
            <Lock size={20} className="text-zinc-300" />
          </div>
          <h2 className="text-4xl font-display font-black text-zinc-900 dark:text-white">{maintenanceCount}</h2>
        </div>

        <div className={`p-6 rounded-[32px] border flex flex-col justify-between transition-all duration-500 shadow-sm ${
          isCriticalStock ? 'bg-red-600 text-white border-red-700' : 
          isWarningStock ? 'bg-amber-400 text-black border-amber-500' : 
          'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Tags em Estoque</p>
              <h2 className="text-4xl font-display font-black mt-1">{unlinkedCount}</h2>
            </div>
            <ShoppingCart size={20} className="opacity-40" />
          </div>
          
          {isWarningStock && (
            <motion.div 
              initial={{ opacity: 0, x: -5 }} 
              animate={{ opacity: 1, x: 0 }}
              className="mt-4 flex items-center gap-2"
            >
              <div className={`p-1.5 rounded-lg ${isCriticalStock ? 'bg-white/20' : 'bg-black/10'}`}>
                <ShoppingBag size={14} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-tight leading-tight">
                Novos equipamentos precisam ser adquiridos
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
