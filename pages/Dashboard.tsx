
import * as React from 'react';
import { useEffect, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useAuth } from '../contexts/AuthContext';
import { ResponsiveContainer, AreaChart, Area, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { 
  Tag as TagIcon, CarFront, Plus, Activity, Truck, Bike, 
  Car, ShoppingCart, Map as MapIcon, 
  TrendingUp, HandCoins, Calendar, Hourglass, Wrench, Users, Building2
} from 'lucide-react';
import * as ReactRouterDOM from 'react-router-dom';

// Import Hook & Utils
import { useDashboardData } from './dashboard/hooks/useDashboardData';
import { 
  calculateServiceHistory, 
  calculateTopTechnicians, 
  calculateTopRequesters, 
  calculateServiceTypes, 
  calculateTagHistory, 
  calculateCompanyDistribution, 
  calculateGrowthTrend, 
  calculateStockStatus, 
  calculateStockPrediction, 
  calculateOwnershipStats, 
  calculateCategoryStats 
} from './dashboard/utils/dashboardCalculations';

const { Link, useNavigate } = ReactRouterDOM as any;

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
  const { t } = useLanguage();
  const { lastSync } = useConnection();

  // 1. Data Fetching via Hook
  const { 
    tags, vehicles, companies, categories, settings, schedules, technicians, loading 
  } = useDashboardData();

  // 2. Redirect Client
  useEffect(() => {
    if (user?.role === 'client') {
      navigate('/map', { replace: true });
    }
  }, [user, navigate]);

  // 3. Derived State & Calculations (Orchestration)
  
  // Basic Counts
  const linkedCount = useMemo(() => vehicles.filter(v => v.tagId).length, [vehicles]);
  const unlinkedCount = useMemo(() => tags.length - linkedCount, [tags, linkedCount]);
  
  // Service Metrics
  const serviceHistoryData = useMemo(() => calculateServiceHistory(schedules), [schedules]);
  const topTechsData = useMemo(() => calculateTopTechnicians(schedules, technicians), [schedules, technicians]);
  const topRequestersData = useMemo(() => calculateTopRequesters(schedules), [schedules]);
  const serviceTypeData = useMemo(() => calculateServiceTypes(schedules), [schedules]);
  
  // Asset Metrics
  const chartData = useMemo(() => calculateTagHistory(tags), [tags]);
  const companyChartData = useMemo(() => calculateCompanyDistribution(vehicles, companies), [vehicles, companies]);
  const trendChartData = useMemo(() => calculateGrowthTrend(vehicles), [vehicles]);
  const ownershipData = useMemo(() => calculateOwnershipStats(vehicles), [vehicles]);
  const categoryStats = useMemo(() => calculateCategoryStats(vehicles, categories), [vehicles, categories]);

  // Stock Intelligence
  const stockInfo = useMemo(() => calculateStockStatus(unlinkedCount, settings), [unlinkedCount, settings]);
  const stockPrediction = useMemo(() => calculateStockPrediction(trendChartData, unlinkedCount), [trendChartData, unlinkedCount]);

  // Constants
  const purchasedCount = ownershipData.find(d => d.name === 'Adquirido')?.value || 0;
  const leasedCount = ownershipData.find(d => d.name === 'Comodato')?.value || 0;

  if (user?.role === 'client') return null;
  if (loading && tags.length === 0) return <div className="p-10 flex justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-10 pb-24 font-sans max-w-[1600px] mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
            {t('overview')}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-[0.4em]">Control Center</p>
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
                  <Link key={idx} to={item.to} className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-primary-500/50 dark:hover:border-primary-500/50 p-5 rounded-[24px] transition-all duration-300 flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-1">
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
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden h-[340px] shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="relative z-10">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Total Equipamentos</p>
                              <h3 className="text-6xl font-display font-black text-zinc-900 dark:text-white mt-2 tracking-tighter">{tags.length}</h3>
                          </div>
                          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-primary-500"><TagIcon size={20}/></div>
                      </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20 dark:opacity-30 pointer-events-none">
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

              {/* CARD 2: VEÍCULOS E CATEGORIAS (ALWAYS DARK) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col shadow-lg shadow-zinc-900/20 min-h-[340px] relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-8 relative z-10">
                      <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total de Veículos</p>
                          <h3 className="text-7xl font-display font-black text-white mt-1 tracking-tighter">{vehicles.length}</h3>
                      </div>
                      <div className="w-12 h-12 rounded-2xl border border-primary-500/30 text-primary-500 flex items-center justify-center bg-primary-500/5">
                          <CarFront size={24} />
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 flex-1 relative z-10">
                      {categoryStats.map((cat, idx) => (
                          <div key={idx} className="bg-zinc-800/50 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-zinc-800 hover:border-zinc-700">
                              <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 shrink-0">
                                  <cat.icon size={18} />
                              </div>
                              <div className="min-w-0">
                                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest truncate">{cat.name}</p>
                                  <p className="text-xl font-black text-white leading-none mt-0.5">{cat.count}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* CARD 3: ESTOQUE (REESTILIZADO CONFORME PEDIDO) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 flex flex-col justify-between h-[340px] shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="flex justify-between items-start">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Estoque</p>
                      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-400"><ShoppingCart size={20}/></div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                      <h3 className="text-[80px] font-display font-black text-zinc-900 dark:text-white tracking-tighter leading-none">{unlinkedCount}</h3>
                      <p className={`text-[11px] font-black uppercase tracking-widest ${stockInfo.status === 'critical' ? 'text-red-500' : stockInfo.status === 'low' ? 'text-amber-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                          {stockInfo.status === 'critical' ? 'ESTOQUE CRÍTICO' : stockInfo.status === 'low' ? 'NÍVEL BAIXO' : 'ESTOQUE CONFORTÁVEL'}
                      </p>
                  </div>

                  <div className="space-y-4">
                      <div className="flex items-center gap-3 text-zinc-400">
                          <Hourglass size={14} className="text-zinc-400"/>
                          <p className="text-[10px] font-black uppercase tracking-widest">
                              Duração Est.: <span className="text-zinc-900 dark:text-white">{stockPrediction.label}</span>
                          </p>
                      </div>
                      
                      {/* Barra de Capacidade Sutil */}
                      <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${stockInfo.status === 'critical' ? 'bg-red-500' : stockInfo.status === 'low' ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min(100, (unlinkedCount / 100) * 100)}%` }} 
                          />
                      </div>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CARD 4: MODELO DE CONTRATO (Pie Bicolor) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 h-[340px] flex flex-col shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="flex justify-between items-center mb-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Modelo de Contrato</p>
                      <HandCoins size={16} className="text-zinc-400"/>
                  </div>
                  <div className="flex-1 flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie 
                                  data={ownershipData} 
                                  innerRadius={60} 
                                  outerRadius={80} 
                                  paddingAngle={5} 
                                  dataKey="value" 
                                  stroke="none"
                              >
                                  {ownershipData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.primary : '#52525b'} />
                                  ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                                itemStyle={{ color: '#e4e4e7' }}
                              />
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
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 h-[340px] lg:col-span-2 flex flex-col shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
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
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} 
                                cursor={{ stroke: '#3f3f46' }} 
                                itemStyle={{ color: '#e4e4e7' }}
                                labelStyle={{ color: '#e4e4e7' }}
                              />
                              <Area type="monotone" dataKey=" entradas" stroke={COLORS.primary} strokeWidth={3} fill="url(#gradTrend)" />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>

          {/* CARD 6: VEÍCULOS POR REGIONAL (Bar Horizontal) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <div className="flex justify-between items-center mb-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Veículos por Regional (Top 5)</p>
                  <Building2 size={16} className="text-zinc-400"/>
              </div>
              <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={companyChartData} layout="vertical" margin={{ left: 0, right: 30 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            cursor={{fill: 'transparent'}} 
                            contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} 
                            itemStyle={{ color: '#e4e4e7' }}
                            labelStyle={{ color: '#e4e4e7' }}
                          />
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
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="flex justify-between items-center mb-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Top Solicitantes</p>
                      <Users size={16} className="text-zinc-400"/>
                  </div>
                  <div className="space-y-3">
                      {topRequestersData.map((req, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
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
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="flex justify-between items-center mb-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Top Instaladores</p>
                      <Wrench size={16} className="text-zinc-400"/>
                  </div>
                  <div className="space-y-3">
                      {topTechsData.map((tech, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
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
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 h-[340px] flex flex-col shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
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
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} 
                                itemStyle={{ color: '#e4e4e7' }}
                              />
                              <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px', color: '#71717a' }}/>
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* CARD 10: DEMANDA POR SERVIÇOS (Area - Tempo) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 lg:col-span-2 h-[340px] flex flex-col shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
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
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} 
                                cursor={{ stroke: '#3f3f46' }} 
                                itemStyle={{ color: '#e4e4e7' }}
                                labelStyle={{ color: '#e4e4e7' }}
                              />
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
