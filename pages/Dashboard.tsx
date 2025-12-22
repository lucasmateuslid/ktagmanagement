
import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Tag, Vehicle, Company, VehicleCategory } from '../types';
import { storage } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useAuth } from '../contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Tag as TagIcon, CarFront, Link2, Wifi, Plus, Activity, Truck, Bike, Car, Clock, Building2, ShieldAlert, AlertTriangle, Lock, ChevronRight, ShoppingCart, LayoutGrid } from 'lucide-react';
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
    const months: Record<string, number> = {};
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months[monthNames[d.getMonth()]] = 0;
    }
    vehicles.forEach(v => {
      if (v.createdAt) {
        const d = new Date(v.createdAt);
        const key = monthNames[d.getMonth()];
        if (months[key] !== undefined) months[key]++;
      }
    });
    setTrendChartData(Object.keys(months).map(k => ({ name: k, entries: months[k] })));
  };

  const linkedCount = vehicles.filter(v => v.tagId).length;
  const unlinkedCount = tags.length - linkedCount;
  const stolenCount = vehicles.filter(v => v.status === 'stolen').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;
  
  const isWarningStock = unlinkedCount <= 80;
  const isCriticalStock = unlinkedCount <= 40;
  const theftRate = vehicles.length > 0 ? ((stolenCount / vehicles.length) * 100).toFixed(1) : '0.0';

  // Fix: Added missing categoryStats and getIconForCategory definitions to resolve component errors.
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

  const quickActions = [
    { label: t('addTag'), path: '/tags', icon: Plus },
    { label: t('addVehicle'), path: '/vehicles?action=new', icon: CarFront },
    { label: t('liveMap'), path: '/map', icon: Activity },
  ];

  if (user?.role === 'client') return null;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-display font-bold text-zinc-900 dark:text-white">
            {t('overview')}
          </h1>
          <p className="text-zinc-500 text-sm">Painel de inteligência de frota.</p>
        </div>
        {lastSync && (
          <div className="text-xs text-zinc-400 font-mono flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <Clock size={12} /> Sync: {new Date(lastSync).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Main Bento Grid 2x2 Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ROW 1: TOTAL TAGS & TOTAL VEHICLES */}
        <MotionDiv 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between shadow-sm min-h-[320px]"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{t('totalTags')}</h3>
              <p className="text-5xl font-display font-black text-zinc-900 dark:text-white mt-2 tracking-tighter">{tags.length}</p>
            </div>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700">
              <TagIcon size={24} />
            </div>
          </div>
          
          <div className="h-32 mt-6 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
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
          className="bg-zinc-900 dark:bg-zinc-950 rounded-3xl p-6 border border-zinc-800 dark:border-zinc-900 text-white flex flex-col justify-between shadow-xl min-h-[320px]"
        >
          <div className="flex justify-between mb-2">
            <div>
              <span className="text-zinc-400 text-xs uppercase font-bold tracking-widest">{t('totalVehicles')}</span>
              <p className="text-5xl font-display font-black mb-2 tracking-tighter text-white">{vehicles.length}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-primary-500">
              <CarFront size={24} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-4">
            {categoryStats.slice(0, 4).map((cat) => (
              <div key={cat.id} className="flex flex-col items-start p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2 text-zinc-500 mb-1">
                  {getIconForCategory(cat.fipeType)}
                  <span className="text-[10px] font-black uppercase truncate">{cat.name.split(' ')[0]}</span>
                </div>
                <span className="text-xl font-display font-black text-white">{cat.count}</span>
              </div>
            ))}
          </div>
        </MotionDiv>

        {/* ROW 2: LINKED TAGS & QUICK ACTIONS */}
        <MotionDiv 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-primary-500 text-black rounded-3xl p-8 flex flex-col justify-between shadow-lg shadow-primary-500/20 min-h-[200px]"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-black/60 text-xs uppercase tracking-[0.2em] font-black">{t('linkedTags')}</span>
              <p className="text-6xl font-display font-black tracking-tighter">{linkedCount}</p>
            </div>
            <div className="p-4 bg-black/10 rounded-2xl">
              <Link2 size={32} className="text-black" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-black/70">
            <Activity size={14} /> {Math.round((linkedCount / (tags.length || 1)) * 100)}% de Ativação da Frota
          </div>
        </MotionDiv>

        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col min-h-[200px]">
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6">{t('quickActions')}</h3>
          <div className="grid grid-cols-3 gap-4 flex-1">
            {quickActions.map((action, idx) => (
              <Link key={idx} to={action.path} className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-zinc-200 dark:border-zinc-800 group hover:scale-[1.02]">
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 shadow-sm group-hover:text-primary-600 transition-colors">
                  <action.icon size={20} className="text-zinc-500 group-hover:text-primary-500" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 text-center">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Security and Statistics Section (Remaining cards below) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 rounded-3xl border flex flex-col justify-between transition-colors shadow-sm
          ${stolenCount > 0 
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' 
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-bold tracking-wider opacity-70 mb-1">Veículos Roubados</p>
              <h2 className={`text-4xl font-display font-bold ${stolenCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                {stolenCount}
              </h2>
            </div>
            <AlertTriangle size={24} className={stolenCount > 0 ? 'text-red-500' : 'text-zinc-300'} />
          </div>
          <div className="mt-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
             <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${Math.min(parseFloat(theftRate), 100)}%` }}></div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-zinc-500 mb-1">Em Manutenção</p>
              <h2 className="text-4xl font-display font-bold text-zinc-900 dark:text-white">{maintenanceCount}</h2>
            </div>
            <Lock size={24} className="text-zinc-300" />
          </div>
          <p className="text-[10px] text-zinc-400 mt-2 font-medium">Equipamentos em laboratório técnico.</p>
        </div>

        <div className={`p-6 rounded-3xl border flex flex-col justify-between transition-all duration-500 ${
          isCriticalStock ? 'bg-red-600 text-white' : isWarningStock ? 'bg-amber-400 text-black' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-bold tracking-wider mb-1 opacity-70">Estoque de Tags</p>
              <h2 className="text-4xl font-display font-bold">{unlinkedCount}</h2>
            </div>
            <ShoppingCart size={24} className="opacity-30" />
          </div>
          <Link to="/tags" className="mt-4 text-[10px] font-black uppercase flex items-center gap-1 hover:underline">
            Reposição de Estoque <ChevronRight size={12}/>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Building2 size={18} className="text-primary-500" />
            <h3 className="text-zinc-900 dark:text-white text-xs font-bold uppercase tracking-widest">{t('vehiclesByCompany')}</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={companyChartData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#71717a' }} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Activity size={18} className="text-primary-500" />
            <h3 className="text-zinc-900 dark:text-white text-xs font-bold uppercase tracking-widest">{t('vehicleEntryTrend')}</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a' }} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="entries" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
