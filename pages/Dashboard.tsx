
import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Tag, Vehicle, Company, VehicleCategory, AppSettings, Schedule, Technician } from '../types';
import { storage } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useAuth } from '../contexts/AuthContext';
import { ResponsiveContainer, AreaChart, Area, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { 
  Tag as TagIcon, CarFront, Plus, Activity, Truck, Bike, 
  Car, Lock, ShoppingCart, Map as MapIcon, 
  Zap, TrendingUp, HandCoins, Calendar, Hourglass, CheckCircle2, Wrench, Users, Building2, Server, ArrowUpRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import * as ReactRouterDOM from 'react-router-dom';

const { Link, useNavigate } = ReactRouterDOM as any;
const MotionDiv = motion.div as any;

// --- CORES PREMIUM (C6 STYLE) ---
const COLORS = {
  primary: '#f59e0b',   // Amber 500 (Destaque Principal)
  darkBase: '#18181b',  // Zinc 900
  lightBase: '#ffffff', // White
  gridLine: '#3f3f46',  // Zinc 700
  // Gradação Monocromática para Gráficos
  chartPalette: ['#f59e0b', '#52525b', '#71717a', '#a1a1aa', '#d4d4d8']
};

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  // Chart Data States
  const [serviceHistoryData, setServiceHistoryData] = useState<any[]>([]);
  const [topTechsData, setTopTechsData] = useState<any[]>([]);
  const [topRequestersData, setTopRequestersData] = useState<any[]>([]);
  const [serviceTypeData, setServiceTypeData] = useState<any[]>([]);
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
    const [loadedTags, loadedVehicles, loadedCompanies, loadedCategories, loadedSettings, loadedSchedules, loadedTechs] = await Promise.all([
      storage.getTags(),
      storage.getVehicles(),
      storage.getCompanies(),
      storage.getCategories(),
      storage.getSettings(),
      storage.getSchedules('admin', user?.id || ''),
      storage.getTechnicians()
    ]);

    setTags(loadedTags);
    setVehicles(loadedVehicles);
    setCompanies(loadedCompanies);
    setCategories(loadedCategories);
    setSettings(loadedSettings);
    setSchedules(loadedSchedules);
    setTechnicians(loadedTechs);

    processHistoryData(loadedTags);
    processCompanyData(loadedVehicles, loadedCompanies);
    processTrendData(loadedVehicles);
    processServiceData(loadedSchedules, loadedTechs);
  };

  const processServiceData = (scheduleList: Schedule[], techList: Technician[]) => {
      // 1. Demandas por Serviços (10 Dias)
      const historyMap: Record<string, number> = {};
      const last10Days: string[] = [];
      for (let i = 9; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          last10Days.push(key);
          historyMap[key] = 0;
      }
      scheduleList.forEach(s => {
          const d = new Date(s.createdAt);
          const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          if (historyMap[key] !== undefined) historyMap[key]++;
      });
      setServiceHistoryData(last10Days.map(day => ({ name: day, total: historyMap[day] })));

      // 2. Top Instaladores
      const installSchedules = scheduleList.filter(s => ['Concluída', 'Confirmada', 'Técnico no local'].includes(s.status));
      const techCount: Record<string, number> = {};
      installSchedules.forEach(s => {
          if (s.technicianId) techCount[s.technicianId] = (techCount[s.technicianId] || 0) + 1;
      });
      const topTechs = Object.keys(techCount).map(id => {
          const tech = techList.find(t => t.id === id);
          return { name: tech ? tech.name.split(' ')[0] : 'Desc.', total: techCount[id] };
      }).sort((a, b) => b.total - a.total).slice(0, 3);
      setTopTechsData(topTechs);

      // 3. Top Solicitantes
      const reqCount: Record<string, number> = {};
      scheduleList.forEach(s => {
          const name = s.requesterName || 'Sistema';
          reqCount[name] = (reqCount[name] || 0) + 1;
      });
      const topRequesters = Object.keys(reqCount).map(name => ({ 
          name: name.length > 12 ? name.substring(0, 12) + '.' : name, 
          total: reqCount[name] 
      })).sort((a, b) => b.total - a.total).slice(0, 5);
      setTopRequestersData(topRequesters);

      // 4. Tipos de Serviço
      const typeCount: Record<string, number> = {};
      scheduleList.forEach(s => {
          typeCount[s.serviceType] = (typeCount[s.serviceType] || 0) + 1;
      });
      setServiceTypeData(Object.keys(typeCount).map(key => ({ name: key, value: typeCount[key] })));
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
    setCompanyChartData(data.sort((a, b) => b.contador - a.contador).slice(0, 5));
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
  
  const stockInfo = useMemo(() => {
      const minStock = settings?.minStockLevel || 80;
      const criticalStock = settings?.criticalStockLevel || 40;
      let status: 'high' | 'low' | 'critical' = 'high';
      if (unlinkedCount <= criticalStock) status = 'critical';
      else if (unlinkedCount <= minStock) status = 'low';
      
      return { status, minStock, criticalStock };
  }, [unlinkedCount, settings]);

  const leasedCount = vehicles.filter(v => v.ownershipStatus !== 'purchased').length; 
  const purchasedCount = vehicles.filter(v => v.ownershipStatus === 'purchased').length;
  
  const OWNERSHIP_DATA = [
      { name: 'Comodato', value: leasedCount },
      { name: 'Adquirido', value: purchasedCount }
  ];

  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    vehicles.forEach(v => {
      const typeKey = v.type || 'outros';
      counts[typeKey] = (counts[typeKey] || 0) + 1;
    });
    return categories.map(cat => ({
      name: cat.name,
      count: counts[cat.id] || 0,
      icon: cat.fipeType === 'motos' ? Bike : cat.fipeType === 'caminhoes' ? Truck : cat.name.toLowerCase().includes('pickup') ? Activity : Car
    })).sort((a,b) => b.count - a.count).slice(0, 4);
  }, [vehicles, categories]);

  if (user?.role === 'client') return null;

  return (
    <div className="space-y-10 pb-24 font-sans max-w-[1600px] mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
            {t('overview')}
          </h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em]">Control Center</p>
        </div>
        {lastSync && (
          <div className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2 bg-white dark:bg-zinc-900 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ONLINE: {new Date(lastSync).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* --- ATALHOS --- */}
      <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
              <div className="w-1 h-4 bg-primary-500 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Acesso Rápido</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                  { to: "/tags?action=new", icon: Plus, label: "Novo Equipamento", sub: "Estoque" },
                  { to: "/vehicles?action=new", icon: CarFront, label: "Novo Veículo", sub: "Frota" },
                  { to: "/schedule/new", icon: Calendar, label: "Agendar Serviço", sub: "Agenda" },
                  { to: "/map", icon: MapIcon, label: "Monitoramento", sub: "Tempo Real" }
              ].map((item, idx) => (
                  <Link key={idx} to={item.to} className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-primary-500/50 dark:hover:border-primary-500/50 p-5 rounded-[24px] transition-all duration-300 flex items-center gap-4 shadow-sm hover:shadow-lg">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center text-zinc-400 group-hover:text-primary-500 transition-colors">
                          <item.icon size={18} />
                      </div>
                      <div>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{item.sub}</p>
                          <p className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-tight">{item.label}</p>
                      </div>
                  </Link>
              ))}
          </div>
      </div>

      {/* --- SEÇÃO 1: VEÍCULOS E EQUIPAMENTOS --- */}
      <div className="space-y-6">
          <div className="flex items-center gap-3 px-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="w-1 h-4 bg-zinc-400 dark:bg-zinc-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Veículos e Equipamentos</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CARD 1: TOTAL EQUIPAMENTOS (Area Chart Clean) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden h-[340px] shadow-sm">
                  <div className="relative z-10">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Total Equipamentos</p>
                              <h3 className="text-6xl font-display font-black text-zinc-900 dark:text-white mt-2 tracking-tighter">{tags.length}</h3>
                          </div>
                          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-primary-500"><TagIcon size={20}/></div>
                      </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20 dark:opacity-30">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                              <defs>
                                  <linearGradient id="gradTags" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.5}/>
                                      <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="total" stroke={COLORS.primary} strokeWidth={3} fill="url(#gradTags)" />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* CARD 2: VEÍCULOS E CATEGORIAS (Grid Visual conforme Imagem Solicitada) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 flex flex-col shadow-sm min-h-[340px]">
                  <div className="flex justify-between items-start mb-8">
                      <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Total de Veículos</p>
                          <h3 className="text-7xl font-display font-black text-zinc-900 dark:text-white mt-1 tracking-tighter">{vehicles.length}</h3>
                      </div>
                      <div className="w-12 h-12 rounded-2xl border border-primary-500/30 text-primary-500 flex items-center justify-center bg-primary-500/5">
                          <CarFront size={24} />
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 flex-1">
                      {categoryStats.map((cat, idx) => (
                          <div key={idx} className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-4 transition-all hover:border-zinc-200 dark:hover:border-zinc-700">
                              <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                                  <cat.icon size={18} />
                              </div>
                              <div className="min-w-0">
                                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest truncate">{cat.name}</p>
                                  <p className="text-xl font-black text-zinc-900 dark:text-white leading-none mt-0.5">{cat.count}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* CARD 3: ESTOQUE (Barra de Progresso) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 flex flex-col justify-between h-[340px] shadow-sm">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Estoque Disponível</p>
                          <h3 className="text-6xl font-display font-black text-zinc-900 dark:text-white mt-2 tracking-tighter">{unlinkedCount}</h3>
                      </div>
                      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-400"><ShoppingCart size={20}/></div>
                  </div>
                  
                  <div>
                      <div className="flex justify-between items-end mb-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${stockInfo.status === 'critical' ? 'text-red-500' : stockInfo.status === 'low' ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {stockInfo.status === 'critical' ? 'Nível Crítico' : stockInfo.status === 'low' ? 'Nível Baixo' : 'Nível Seguro'}
                          </span>
                          <span className="text-[9px] font-bold text-zinc-400">Capacidade</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-3 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800">
                          <div 
                            className={`h-full transition-all duration-500 ${stockInfo.status === 'critical' ? 'bg-red-500' : stockInfo.status === 'low' ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min(100, (unlinkedCount / 100) * 100)}%` }} 
                          />
                      </div>
                      <p className="text-[9px] text-zinc-400 mt-3 font-medium leading-relaxed">
                          Baseado no consumo médio, seu estoque atual é suficiente para operações regulares.
                      </p>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CARD 4: MODELO DE CONTRATO (Pie Bicolor) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 h-[340px] flex flex-col shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Modelo de Contrato</p>
                      <HandCoins size={16} className="text-zinc-400"/>
                  </div>
                  <div className="flex-1 flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie 
                                  data={OWNERSHIP_DATA} 
                                  innerRadius={60} 
                                  outerRadius={80} 
                                  paddingAngle={5} 
                                  dataKey="value" 
                                  stroke="none"
                              >
                                  {OWNERSHIP_DATA.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.primary : '#52525b'} />
                                  ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
                          </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-3xl font-black text-zinc-900 dark:text-white">{purchasedCount + leasedCount}</span>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase">Ativos</span>
                      </div>
                  </div>
                  <div className="flex justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary-500" />
                          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Comodato</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-zinc-600" />
                          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Adquirido</span>
                      </div>
                  </div>
              </div>

              {/* CARD 5: CRESCIMENTO OPERACIONAL (Area Gradient) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 h-[340px] lg:col-span-2 flex flex-col shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Crescimento Operacional (6 Meses)</p>
                      <TrendingUp size={16} className="text-zinc-400"/>
                  </div>
                  <div className="flex-1 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trendChartData}>
                              <defs>
                                  <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.2}/>
                                      <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.1} />
                              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} cursor={{ stroke: '#3f3f46' }} />
                              <Area type="monotone" dataKey=" entradas" stroke={COLORS.primary} strokeWidth={3} fill="url(#gradTrend)" />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>

          {/* CARD 6: VEÍCULOS POR REGIONAL (Bar Horizontal) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Veículos por Regional (Top 5)</p>
                  <Building2 size={16} className="text-zinc-400"/>
              </div>
              <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={companyChartData} layout="vertical" margin={{ left: 0, right: 30 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
                          <Bar dataKey="contador" radius={[0, 4, 4, 0]} barSize={20}>
                              {companyChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.primary : '#52525b'} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>

      {/* --- SEÇÃO 2: SERVIÇOS E MÉTRICAS --- */}
      <div className="space-y-6">
          <div className="flex items-center gap-3 px-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="w-1 h-4 bg-zinc-400 dark:bg-zinc-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Serviços e Métricas</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* CARD 7: TOP SOLICITANTES (Lista Clean) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Top Solicitantes</p>
                      <Users size={16} className="text-zinc-400"/>
                  </div>
                  <div className="space-y-3">
                      {topRequestersData.map((req, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-center gap-3">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-primary-500 text-black' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                                      {idx + 1}
                                  </div>
                                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">{req.name}</span>
                              </div>
                              <span className="text-xs font-black text-zinc-900 dark:text-white">{req.total} <span className="text-[9px] text-zinc-400 font-bold">reqs</span></span>
                          </div>
                      ))}
                      {topRequestersData.length === 0 && <p className="text-center text-zinc-400 text-xs py-4">Sem dados</p>}
                  </div>
              </div>

              {/* CARD 8: TOP INSTALADORES (Lista Clean) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Top Instaladores</p>
                      <Wrench size={16} className="text-zinc-400"/>
                  </div>
                  <div className="space-y-3">
                      {topTechsData.map((tech, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-center gap-3">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-primary-500 text-black' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                                      {idx + 1}
                                  </div>
                                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">{tech.name}</span>
                              </div>
                              <span className="text-xs font-black text-zinc-900 dark:text-white">{tech.total} <span className="text-[9px] text-zinc-400 font-bold">svcs</span></span>
                          </div>
                      ))}
                      {topTechsData.length === 0 && <p className="text-center text-zinc-400 text-xs py-4">Sem dados</p>}
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CARD 9: TIPOS DE SERVIÇO (Pie Bicolor/Tricolor) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 h-[340px] flex flex-col shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Tipos de Serviço</p>
                      <Activity size={16} className="text-zinc-400"/>
                  </div>
                  <div className="flex-1 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie 
                                  data={serviceTypeData} 
                                  innerRadius={50} 
                                  outerRadius={70} 
                                  paddingAngle={5} 
                                  dataKey="value" 
                                  stroke="none"
                              >
                                  {serviceTypeData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS.chartPalette[index % COLORS.chartPalette.length]} />
                                  ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
                              <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px', color: '#71717a' }}/>
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* CARD 10: DEMANDA POR SERVIÇOS (Area - Tempo) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 lg:col-span-2 h-[340px] flex flex-col shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Demanda (Últimos 10 Dias)</p>
                      <Calendar size={16} className="text-zinc-400"/>
                  </div>
                  <div className="flex-1 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={serviceHistoryData}>
                              <defs>
                                  <linearGradient id="gradService" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                                      <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.1} />
                              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} cursor={{ stroke: '#3f3f46' }} />
                              <Area type="monotone" dataKey="total" stroke={COLORS.primary} strokeWidth={3} fill="url(#gradService)" />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
