
import React, { useEffect, useState } from 'react';
import { Tag, Vehicle, Company, VehicleCategory } from '../types';
import { storage } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnection } from '../contexts/ConnectionContext';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Tag as TagIcon, CarFront, Link2, Wifi, Plus, Activity, Truck, Bike, Car, Clock, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [companyChartData, setCompanyChartData] = useState<any[]>([]);
  const [trendChartData, setTrendChartData] = useState<any[]>([]);
  const { t } = useLanguage();
  const { lastSync } = useConnection();

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

  useEffect(() => {
    loadData();
  }, []);

  const processHistoryData = (tags: Tag[], vehicles: Vehicle[]) => {
    const days = 7;
    const data = [];
    const now = new Date();
    const currentLinkedRatio = vehicles.filter(v => v.tagId).length / (tags.length || 1);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString(undefined, { weekday: 'short' });
      const timestamp = date.setHours(23, 59, 59, 999);
      const existingTags = tags.filter(t => t.createdAt <= timestamp);
      const totalCount = existingTags.length;
      const linkedCount = Math.floor(totalCount * currentLinkedRatio);
      data.push({ name: dateStr, linked: linkedCount, total: totalCount });
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
          name: c.prefix || c.name, // Use prefix for better chart fitting
          fullName: c.name,
          count: counts[c.id] || 0
      }));

      // Add unknown if exists
      if (counts['unknown']) {
          data.push({ name: 'N/A', fullName: 'Sem Empresa', count: counts['unknown'] });
      }

      setCompanyChartData(data.sort((a, b) => b.count - a.count));
  };

  const processTrendData = (vehicles: Vehicle[]) => {
      // Group by Month (Last 6 months)
      const months: Record<string, number> = {};
      const now = new Date();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      // Initialize last 6 months
      for(let i=5; i>=0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${monthNames[d.getMonth()]}`;
          months[key] = 0;
      }

      vehicles.forEach(v => {
          if (v.createdAt) {
             const d = new Date(v.createdAt);
             // Check if within last 6 months approx
             const diffTime = Math.abs(now.getTime() - d.getTime());
             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
             if(diffDays <= 180) {
                 const key = `${monthNames[d.getMonth()]}`;
                 if(months[key] !== undefined) months[key]++;
             }
          }
      });

      const data = Object.keys(months).map(k => ({ name: k, entries: months[k] }));
      setTrendChartData(data);
  };

  const linkedCount = vehicles.filter(v => v.tagId).length;
  const unlinkedCount = tags.length - linkedCount;

  // Dynamic Category Counting
  const getCategoryType = (typeId: string) => {
      const cat = categories.find(c => c.id === typeId);
      return cat ? cat.fipeType : 'none';
  };

  const carCount = vehicles.filter(v => {
      const type = getCategoryType(v.type);
      return type === 'carros' || v.type === 'cat-car' || v.type === 'Car';
  }).length;

  const truckCount = vehicles.filter(v => {
      const type = getCategoryType(v.type);
      return type === 'caminhoes' || v.type === 'cat-truck' || v.type === 'Truck';
  }).length;

  const motoCount = vehicles.filter(v => {
      const type = getCategoryType(v.type);
      return type === 'motos' || v.type === 'cat-moto' || v.type === 'Motorcycle';
  }).length;

  const quickActions = [
    { label: t('addTag'), path: '/tags', icon: Plus },
    { label: t('addVehicle'), path: '/vehicles', icon: CarFront },
    { label: t('liveMap'), path: '/map', icon: Activity },
  ];

  const pieData = [
    { name: 'Linked', value: linkedCount, color: '#f59e0b' }, // Primary 500
    { name: 'Unlinked', value: unlinkedCount, color: '#27272a' }, // Zinc 800
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-display font-bold text-zinc-900 dark:text-white">
            {t('overview')}
            </h1>
            <p className="text-zinc-500 text-sm">Welcome back, here's what's happening today.</p>
        </div>
        {lastSync && (
            <div className="text-xs text-zinc-400 font-mono flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <Clock size={12} /> Last Synced: {new Date(lastSync).toLocaleTimeString()}
            </div>
        )}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        
        {/* Main Stats Card */}
        <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="col-span-1 md:col-span-2 row-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between shadow-sm"
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-zinc-500 text-sm font-medium uppercase tracking-wider">{t('totalTags')}</h3>
                    <p className="text-5xl font-display font-bold text-zinc-900 dark:text-white mt-2">{tags.length}</p>
                </div>
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-900 dark:text-white">
                    <TagIcon size={24} />
                </div>
            </div>
            
            <div className="h-40 mt-6 -mx-2 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ fontSize: '12px' }}
                        cursor={{ stroke: '#27272a' }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={3} fill="url(#colorTotal)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </motion.div>

        {/* Secondary Stats (Vehicles) */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-zinc-900 dark:bg-zinc-950 rounded-3xl p-6 border border-zinc-800 dark:border-zinc-900 text-white flex flex-col justify-between shadow-md"
        >
            <div className="flex justify-between">
                <span className="text-zinc-400 text-xs uppercase tracking-wider">{t('totalVehicles')}</span>
                <CarFront size={18} className="text-zinc-500" />
            </div>
            <p className="text-3xl font-display font-bold mt-2">{vehicles.length}</p>
            
            <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <Car size={14} className="text-zinc-400 mb-1" />
                    <span className="text-lg font-bold">{carCount}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{t('cars')}</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <Truck size={14} className="text-zinc-400 mb-1" />
                    <span className="text-lg font-bold">{truckCount}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{t('trucks')}</span>
                </div>
                 <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <Bike size={14} className="text-zinc-400 mb-1" />
                    <span className="text-lg font-bold">{motoCount}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">Moto</span>
                </div>
            </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-primary-500 text-black rounded-3xl p-6 flex flex-col justify-between shadow-lg shadow-primary-500/20"
        >
             <div className="flex justify-between">
                <span className="text-black/60 text-xs uppercase tracking-wider font-bold">{t('linkedTags')}</span>
                <Link2 size={18} className="text-black/60" />
            </div>
            <p className="text-3xl font-display font-bold mt-2">{linkedCount}</p>
            <div className="mt-4 text-xs font-bold text-black/60">
                {Math.round((linkedCount / (tags.length || 1)) * 100)}% Utilization
            </div>
        </motion.div>

        {/* Quick Actions */}
        <div className="col-span-1 md:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-4">{t('quickActions')}</h3>
            <div className="grid grid-cols-3 gap-3">
                {quickActions.map((action, idx) => (
                    <Link key={idx} to={action.path} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-800 group">
                        <action.icon size={20} className="text-zinc-600 dark:text-zinc-400 group-hover:text-primary-600 dark:group-hover:text-primary-500 transition-colors" />
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 text-center">{action.label}</span>
                    </Link>
                ))}
            </div>
        </div>

        {/* Pie Chart Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center relative min-w-0 shadow-sm">
             <div className="absolute top-6 left-6">
                <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Allocation</h3>
             </div>
             <div className="h-32 w-32 mt-4 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={pieData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value" stroke="none">
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <Wifi size={16} className="text-zinc-400" />
                </div>
             </div>
             <div className="flex gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                    <span className="text-zinc-600 dark:text-zinc-400">Linked</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-zinc-800"></div>
                    <span className="text-zinc-600 dark:text-zinc-400">Free</span>
                </div>
             </div>
        </div>

        {/* --- NEW CHARTS --- */}

        {/* Vehicles by Company */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Building2 size={16} className="text-indigo-500" />
                <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{t('vehiclesByCompany')}</h3>
            </div>
            <div className="h-48 min-w-0">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={companyChartData} layout="vertical" margin={{ left: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#71717a' }} interval={0} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                            cursor={{ fill: '#27272a', opacity: 0.2 }}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Acquisition Trend */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
                <Activity size={16} className="text-emerald-500" />
                <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{t('vehicleEntryTrend')}</h3>
            </div>
             <div className="h-48 min-w-0">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a' }} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                            cursor={{ fill: '#27272a', opacity: 0.2 }}
                        />
                        <Bar dataKey="entries" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

      </div>
    </div>
  );
};
