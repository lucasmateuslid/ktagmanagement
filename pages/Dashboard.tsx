
import React, { useEffect, useState } from 'react';
import { Tag, Vehicle } from '../types';
import { storage } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Tag as TagIcon, Car, Link2, Wifi, Activity, Map, Settings, Plus, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    const loadData = async () => {
      const [loadedTags, loadedVehicles] = await Promise.all([
        storage.getTags(),
        storage.getVehicles(),
      ]);
      setTags(loadedTags);
      setVehicles(loadedVehicles);
    };
    loadData();
  }, []);

  const linkedCount = vehicles.filter(v => v.tagId).length;
  const unlinkedCount = tags.length - linkedCount;

  const stats = [
    { label: t('totalTags'), value: tags.length, icon: TagIcon, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    { label: t('totalVehicles'), value: vehicles.length, icon: Car, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
    { label: t('linkedTags'), value: linkedCount, icon: Link2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    { label: t('unlinkedTags'), value: unlinkedCount, icon: Wifi, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  ];

  const quickActions = [
    { label: t('addTag'), path: '/tags', icon: Plus, color: 'bg-blue-500' },
    { label: t('addVehicle'), path: '/vehicles', icon: Car, color: 'bg-orange-500' },
    { label: t('liveMap'), path: '/map', icon: Map, color: 'bg-emerald-500' },
    { label: t('settings'), path: '/settings', icon: Settings, color: 'bg-slate-500' },
  ];

  const pieData = [
    { name: t('linkedTags'), value: linkedCount },
    { name: t('unlinkedTags'), value: unlinkedCount },
  ];

  const barData = [
    { name: t('cars') || 'Carros', count: vehicles.filter(v => v.type === 'Car').length },
    { name: t('trucks') || 'Caminhões', count: vehicles.filter(v => v.type === 'Truck').length },
    { name: t('motorcycles') || 'Motos', count: vehicles.filter(v => v.type === 'Motorcycle').length },
  ];

  const COLORS = ['#10b981', '#8b5cf6'];

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('overview') || 'Visão Geral'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Status atual do sistema K-TAG
          </p>
        </div>
        <Link to="/map" className="hidden md:flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium hover:underline">
          {t('liveMap')} <ArrowRight size={16} />
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <Link key={idx} to={action.path}>
              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                <div className={`p-2.5 rounded-lg text-white shadow-md ${action.color}`}>
                  <Icon size={18} />
                </div>
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{action.label}</span>
              </motion.div>
            </Link>
          )
        })}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                <Icon size={80} />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-4 rounded-xl ${stat.color}`}>
                  <Icon size={28} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart - 1 Column */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 min-w-0"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('tagLinkStatus') || 'Status de Vinculação'}
            </h3>
            <Activity className="w-5 h-5 text-slate-500" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(15 23 42)',
                    border: '1px solid rgb(51 65 85)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Bar Chart - 1 Column */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 min-w-0"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
            {t('vehicleDist') || 'Distribuição por Tipo'}
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barSize={30}>
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(15 23 42)',
                    border: '1px solid rgb(51 65 85)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Activity (Simulated List) */}
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.6 }}
           className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 min-w-0"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {t('recentActivity')}
          </h3>
          <div className="space-y-4">
             {tags.slice(0, 4).map((tag, i) => (
                <div key={tag.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                   <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600">
                      <TagIcon size={14} />
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">Tag Created: {tag.name}</p>
                      <p className="text-xs text-slate-500">{new Date(tag.createdAt).toLocaleDateString()}</p>
                   </div>
                </div>
             ))}
             {tags.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
