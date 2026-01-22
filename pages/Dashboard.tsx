
import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Tag, Vehicle, Company, VehicleCategory, AppSettings } from '../types';
import { storage } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useAuth } from '../contexts/AuthContext';
import { ResponsiveContainer, AreaChart, Area, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { 
  Tag as TagIcon, CarFront, Plus, Activity, Truck, Bike, 
  Car, Clock, Building2, AlertTriangle, Lock, 
  ShoppingCart, ShoppingBag, Map as MapIcon, FileText,
  Zap, ChevronRight, ShieldAlert, TrendingUp, HandCoins, Calendar, Hourglass, CheckCircle2
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
  const [settings, setSettings] = useState<AppSettings | null>(null);
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
    const [loadedTags, loadedVehicles, loadedCompanies, loadedCategories, loadedSettings] = await Promise.all([
      storage.getTags(),
      storage.getVehicles(),
      storage.getCompanies(),
      storage.getCategories(),
      storage.getSettings()
    ]);

    setTags(loadedTags);
    setVehicles(loadedVehicles);
    setCompanies(loadedCompanies);
    setCategories(loadedCategories);
    setSettings(loadedSettings);

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
  const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;
  
  // Lógica Avançada de Estoque
  const stockInfo = useMemo(() => {
      const minStock = settings?.minStockLevel || 80;
      const criticalStock = settings?.criticalStockLevel || 40;
      
      let status: 'high' | 'low' | 'critical' = 'high';
      if (unlinkedCount <= criticalStock) status = 'critical';
      else if (unlinkedCount <= minStock) status = 'low';

      // Cálculo de Previsão (Base 14 dias)
      const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
      const recentActivations = vehicles.filter(v => v.createdAt && v.createdAt >= twoWeeksAgo).length;
      
      let daysRemaining = 999;
      let dailyAvg = 0;

      if (recentActivations > 0) {
          dailyAvg = recentActivations / 14;
          daysRemaining = Math.floor(unlinkedCount / dailyAvg);
      }

      return { status, daysRemaining, dailyAvg, minStock, criticalStock };
  }, [vehicles, unlinkedCount, settings]);

  // Styles e Textos baseados no status
  const stockStyles = {
      high: {
          bg: 'bg-white dark:bg-zinc-900',
          border: 'border-zinc-200 dark:border-zinc-800',
          text: 'text-black dark:text-white',
          subText: 'text-zinc-400',
          iconBg: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700',
          label: 'ESTOQUE CONFORTÁVEL'
      },
      low: {
          bg: 'bg-[#f59e0b]', // Amber 500
          border: 'border-[#d97706]', // Amber 600
          text: 'text-black',
          subText: 'text-black/70',
          iconBg: 'bg-black/10 text-black border-black/10',
          label: 'BAIXO - REPOR ESTOQUE'
      },
      critical: {
          bg: 'bg-[#dc2626]', // Red 600
          border: 'border-[#b91c1c]', // Red 700
          text: 'text-white',
          subText: 'text-white/80',
          iconBg: 'bg-black/20 text-white border-white/20',
          label: 'CRÍTICO - RUPTURA IMINENTE'
      }
  };

  const currentStyle = stockStyles[stockInfo.status];

  // Ownership Stats
  const leasedCount = vehicles.filter(v => v.ownershipStatus !== 'purchased').length; 
  const purchasedCount = vehicles.filter(v => v.ownershipStatus === 'purchased').length;
  const totalVehicles = vehicles.length;
  const leasedPercent = totalVehicles > 0 ? Math.round((leasedCount / totalVehicles) * 100) : 0;
  const purchasedPercent = totalVehicles > 0 ? Math.round((purchasedCount / totalVehicles) * 100) : 0;

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

  const OWNERSHIP_DATA = [
      { name: 'Comodato', value: leasedCount, color: '#3b82f6' },
      { name: 'Adquirido', value: purchasedCount, color: '#10b981' }
  ];

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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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
            {/* NEW SHORTCUT: AGENDAMENTO */}
            <Link to="/schedule/new" className="group flex items-center gap-6 p-6 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-300">
              <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm border border-zinc-200 dark:border-zinc-800 group-hover:scale-105 transition-transform shrink-0">
                <Calendar size={24} className="text-zinc-400 group-hover:text-primary-500" strokeWidth={2} />
              </div>
              <div className="flex flex-col text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Central de Agenda</span>
                  <span className="text-[13px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">Novo Agendamento</span>
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

      {/* NEW: BUSINESS MODEL (COMODATO/ADQUIRIDO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm col-span-1 md:col-span-2 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <p className="text-[11px] uppercase font-black tracking-[0.3em] text-zinc-400">Modelo de Contrato</p>
                      <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white mt-1">Ativos da Frota</h3>
                  </div>
                  <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-100 dark:border-zinc-700"><HandCoins size={22}/></div>
              </div>
              <div className="flex items-center gap-8">
                  <div className="w-32 h-32 relative shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie data={OWNERSHIP_DATA} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value" stroke="none">
                                  {OWNERSHIP_DATA.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                              </Pie>
                          </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-black text-zinc-400">Type</span>
                      </div>
                  </div>
                  <div className="flex-1 space-y-4">
                      <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Comodato</span>
                          </div>
                          <div className="text-right">
                              <span className="text-sm font-black text-zinc-900 dark:text-white block">{leasedCount}</span>
                              <span className="text-[9px] font-bold text-zinc-400">{leasedPercent}%</span>
                          </div>
                      </div>
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Adquirido</span>
                          </div>
                          <div className="text-right">
                              <span className="text-sm font-black text-zinc-900 dark:text-white block">{purchasedCount}</span>
                              <span className="text-[9px] font-bold text-zinc-400">{purchasedPercent}%</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <p className="text-[11px] uppercase font-black tracking-[0.3em] text-zinc-400">Manutenção</p>
                <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                    <Lock size={24} strokeWidth={2} />
                </div>
            </div>
            <div>
                <h2 className="text-6xl font-display font-black text-zinc-900 dark:text-white">{maintenanceCount}</h2>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-2">Veículos Offline</p>
            </div>
          </div>

          <div className={`p-8 rounded-[32px] border flex flex-col justify-between transition-all duration-700 shadow-sm ${currentStyle.bg} ${currentStyle.border} ${currentStyle.text}`}>
            <div className="flex justify-between items-start">
                <p className={`text-[11px] uppercase font-black tracking-[0.3em] ${currentStyle.subText}`}>Estoque</p>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${currentStyle.iconBg}`}>
                    <ShoppingCart size={24} strokeWidth={2} />
                </div>
            </div>
            <div>
                <h2 className="text-6xl font-display font-black tracking-tighter">{unlinkedCount}</h2>
                <div className="mt-2 space-y-1">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${currentStyle.subText}`}>
                        {currentStyle.label}
                    </p>
                    {stockInfo.dailyAvg > 0 ? (
                        <div className={`flex items-center gap-2 ${stockInfo.status === 'critical' || stockInfo.status === 'low' ? 'animate-pulse' : ''}`}>
                            <Hourglass size={12} className={currentStyle.subText}/>
                            <p className={`text-[9px] font-black uppercase tracking-widest ${currentStyle.subText}`}>
                                Duração Est.: {stockInfo.daysRemaining} dias
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 opacity-60">
                            <CheckCircle2 size={12} />
                            <p className={`text-[9px] font-black uppercase tracking-widest ${currentStyle.subText}`}>
                                Sem consumo recente
                            </p>
                        </div>
                    )}
                </div>
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
