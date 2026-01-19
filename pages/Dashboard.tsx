
import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Tag, Vehicle, Company, VehicleCategory } from '../types';
import { storage } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useAuth } from '../contexts/AuthContext';
import { ResponsiveContainer, AreaChart, Area, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { 
  Tag as TagIcon, CarFront, Plus, Activity, Truck, Bike, 
  Car, Clock, Building2, AlertTriangle, Lock, 
  ShoppingCart, ShoppingBag, Map as MapIcon, FileText,
  Zap, ChevronRight, ShieldAlert, TrendingUp
} from 'lucide-react';
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

    processHistoryData(loadedTags);
    processCompanyData(loadedVehicles, loadedCompanies);
    processTrendData(loadedVehicles);
  };

  const processHistoryData = (tagsList: Tag[]) => {
    const days = 7;
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString(undefined, { weekday: 'short' });
      const timestamp = date.setHours(23, 59, 59, 999);
      const existingTags = tagsList.filter(t => t.createdAt <= timestamp);
      data.push({ name: dateStr, total: existingTags.length });
    }
    setChartData(data);
  };

  const processCompanyData = (vehiclesList: Vehicle[], companiesList: Company[]) => {
    const counts: Record<string, number> = {};
    const activeVehicles = vehiclesList.filter(v => v.status === 'active');
    
    activeVehicles.forEach(v => {
      const id = v.companyId || 'unknown';
      counts[id] = (counts[id] || 0) + 1;
    });

    let data = companiesList.map(c => ({
      name: c.prefix || c.name.substring(0, 8),
      fullName: c.name,
      contador: counts[c.id] || 0
    }));

    const unknownCount = counts['unknown'] || 0;
    if (unknownCount > 0) {
      data.push({
        name: 'OUTROS',
        fullName: 'Não Identificados',
        contador: unknownCount
      });
    }

    setCompanyChartData(data.sort((a, b) => b.contador - a.contador).slice(0, 10));
  };

  const processTrendData = (vehiclesList: Vehicle[]) => {
    const monthsArray: any[] = [];
    const now = new Date();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = monthNames[d.getMonth()];
      const count = vehiclesList.filter(v => {
        if (!v.createdAt) return false;
        const vDate = new Date(v.createdAt);
        return vDate.getMonth() === d.getMonth() && vDate.getFullYear() === d.getFullYear();
      }).length;
      monthsArray.push({ name: monthLabel, ' entradas': count });
    }
    setTrendChartData(monthsArray);
  };

  const linkedCount = vehicles.filter(v => v.tagId).length;
  const unlinkedCount = tags.length - linkedCount;
  const stolenCount = vehicles.filter(v => v.status === 'stolen').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;
  
  const isWarningStock = unlinkedCount <= 80;
  const isCriticalStock = unlinkedCount <= 40;

  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    const othersCount: Record<string, number> = {};

    vehicles.forEach(v => {
      const typeKey = v.type || 'Sem Categoria';
      const categoryExists = categories.find(c => c.id === typeKey);
      if (categoryExists) {
        counts[typeKey] = (counts[typeKey] || 0) + 1;
      } else {
        othersCount[typeKey] = (othersCount[typeKey] || 0) + 1;
      }
    });

    const officialStats = categories.map(cat => ({
      id: cat.id,
      name: cat.name.toUpperCase(),
      fipeType: cat.fipeType,
      contador: counts[cat.id] || 0
    }));

    const extraStats = Object.keys(othersCount).map(name => ({
      id: name,
      name: name.toUpperCase(),
      fipeType: 'none' as const,
      contador: othersCount[name]
    }));

    return [...officialStats, ...extraStats]
      .filter(item => item.contador > 0 || categories.some(c => c.id === item.id))
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .sort((a, b) => b.contador - a.contador);
  }, [vehicles, categories]);

  const getIconForCategory = (fipeType: string, name?: string) => {
    const n = name?.toLowerCase() || '';
    if (fipeType === 'caminhoes' || n.includes('caminhão')) return <Truck size={18} strokeWidth={2.5} />;
    if (fipeType === 'motos' || n.includes('moto')) return <Bike size={18} strokeWidth={2.5} />;
    if (n.includes('pickup') || n.includes('suv')) return <Activity size={18} strokeWidth={2.5} />;
    return <Car size={18} strokeWidth={2.5} />;
  };

  if (user?.role === 'client') return null;

  return (
    <div className="space-y-8 pb-24 font-sans max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
            {t('overview')}
          </h1>
          <p className="text-zinc-500 font-medium text-[10px] uppercase tracking-[0.4em] opacity-70">Console de Gestão em Tempo Real</p>
        </div>
        {lastSync && (
          <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-2 bg-white dark:bg-zinc-900 px-5 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SISTEMA ONLINE: {new Date(lastSync).toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-4 bg-primary-500 rounded-full" />
            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('quickActions')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Link to="/tags?action=new" className="group flex items-center gap-6 p-6 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-300">
              <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm border border-zinc-200 dark:border-zinc-800 group-hover:scale-105 transition-transform shrink-0">
                <Plus size={24} className="text-zinc-400 group-hover:text-primary-500" strokeWidth={2} />
              </div>
              <div className="flex flex-col text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Equipamentos</span>
                  <span className="text-[13px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">Adicionar Equipamento</span>
              </div>
            </Link>
            <Link to="/vehicles?action=new" className="group flex items-center gap-6 p-6 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-300">
              <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm border border-zinc-200 dark:border-zinc-800 group-hover:scale-105 transition-transform shrink-0">
                <CarFront size={24} className="text-zinc-400 group-hover:text-primary-500" strokeWidth={2} />
              </div>
              <div className="flex flex-col text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Módulo Veículos</span>
                  <span className="text-[13px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">Novo Cadastro</span>
              </div>
            </Link>
            <Link to="/map" className="group flex items-center gap-6 p-6 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-300">
              <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm border border-zinc-200 dark:border-zinc-800 group-hover:scale-105 transition-transform shrink-0">
                <MapIcon size={24} className="text-zinc-400 group-hover:text-primary-500" strokeWidth={2} />
              </div>
              <div className="flex flex-col text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tempo Real</span>
                  <span className="text-[13px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('liveMap')}</span>
              </div>
            </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MotionDiv 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[32px] p-10 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between shadow-sm min-h-[350px]"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-zinc-400 text-[11px] font-black uppercase tracking-[0.4em]">{t('totalTags')}</h3>
              <p className="text-7xl md:text-8xl font-display font-black text-zinc-900 dark:text-white mt-3 tracking-tighter">{tags.length}</p>
              <div className="flex items-center gap-2 mt-4">
                  <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[9px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-200 dark:border-zinc-700">Equipamento Ativo</div>
              </div>
            </div>
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl text-primary-500 border border-zinc-100 dark:border-zinc-700/50 shadow-inner flex items-center justify-center">
              <TagIcon size={32} strokeWidth={1.5} />
            </div>
          </div>
          <div className="h-28 mt-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={4} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </MotionDiv>

        <MotionDiv 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-zinc-950 rounded-[40px] p-10 border border-zinc-800 text-white flex flex-col shadow-2xl min-h-[350px]"
        >
          <div className="flex justify-between items-start mb-10">
            <div>
              <span className="text-zinc-500 text-[11px] uppercase font-black tracking-[0.4em]">{t('totalVehicles')}</span>
              <p className="text-7xl md:text-8xl font-display font-black mb-1 tracking-tighter text-white">{vehicles.length}</p>
            </div>
            <div className="w-14 h-14 bg-white/5 rounded-2xl border border-white/10 text-primary-500 flex items-center justify-center shadow-lg">
              <CarFront size={28} strokeWidth={2} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {categoryStats.slice(0, 4).map((cat) => (
              <div key={cat.id} className="flex items-center gap-4 p-5 bg-zinc-900/80 rounded-[24px] border border-zinc-800 hover:bg-zinc-800 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-zinc-800 dark:bg-zinc-950 flex items-center justify-center text-primary-500 border border-zinc-700/50 shadow-inner group-hover:scale-105 transition-transform shrink-0">
                  {getIconForCategory(cat.fipeType, cat.name)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest truncate">{cat.name}</span>
                  <span className="text-2xl font-black leading-none mt-1 text-zinc-100">{cat.contador}</span>
                </div>
              </div>
            ))}
          </div>
        </MotionDiv>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className={`p-8 rounded-[32px] border transition-all duration-500 shadow-sm flex flex-col justify-between min-h-[220px] ${stolenCount > 0 ? 'bg-red-500/5 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] uppercase font-black tracking-[0.3em] text-zinc-400">Incidência Criminal</p>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stolenCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700'}`}>
                <ShieldAlert size={24} strokeWidth={2} />
            </div>
          </div>
          <div>
            <h2 className={`text-6xl font-display font-black ${stolenCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{stolenCount}</h2>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-2">Alertas de Roubo/Furto</p>
          </div>
        </div>
        <div className="p-8 bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between shadow-sm min-h-[220px]">
          <div className="flex justify-between items-start">
            <p className="text-[11px] uppercase font-black tracking-[0.3em] text-zinc-400">Atendimento Ativo</p>
            <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                <Lock size={24} strokeWidth={2} />
            </div>
          </div>
          <div>
            <h2 className="text-6xl font-display font-black text-zinc-900 dark:text-white">{maintenanceCount}</h2>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-2">Veículos Offline</p>
          </div>
        </div>
        <div className={`p-8 rounded-[32px] border flex flex-col justify-between transition-all duration-700 shadow-sm min-h-[220px] ${isCriticalStock ? 'bg-red-600 text-white border-red-700' : isWarningStock ? 'bg-amber-500 text-black border-amber-600' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
          <div className="flex justify-between items-start">
            <p className={`text-[11px] uppercase font-black tracking-[0.3em] ${isWarningStock ? 'opacity-80' : 'text-zinc-400'}`}>Estoque</p>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isWarningStock ? 'bg-black/10' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700'}`}>
                <ShoppingCart size={24} strokeWidth={2} />
            </div>
          </div>
          <div>
            <h2 className="text-6xl font-display font-black tracking-tighter">{unlinkedCount}</h2>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${isWarningStock ? 'opacity-80' : 'text-zinc-400'}`}>Equipamento Disponível</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-10 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-12">
             <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center shadow-inner border border-primary-500/20"><TrendingUp size={22} strokeWidth={2.5} /></div>
             <div className="flex flex-col">
                <h3 className="text-zinc-900 dark:text-white text-[12px] font-black uppercase tracking-[0.3em]">Crescimento Operacional</h3>
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Ativações Mensais</span>
             </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.05} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey=" entradas" stroke="#f59e0b" strokeWidth={4} fillOpacity={0.05} fill="#f59e0b" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-10 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-12">
             <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center shadow-inner border border-primary-500/20"><Building2 size={22} strokeWidth={2.5} /></div>
             <div className="flex flex-col">
                <h3 className="text-zinc-900 dark:text-white text-[12px] font-black uppercase tracking-[0.3em]">Veículos por Regional</h3>
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Market Share por Unidade</span>
             </div>
          </div>
          <div className="h-72">
            {companyChartData.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <Building2 size={48} />
                  <span className="text-[9px] font-black uppercase mt-4">Aguardando dados ativos</span>
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companyChartData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}} 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} 
                  />
                  <Bar dataKey="contador" fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
