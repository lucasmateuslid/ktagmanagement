import React, { useEffect, useState } from 'react';
import { Tag, Vehicle } from '../types';
import { storage } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Tag as TagIcon, Car, Link2, Wifi, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

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
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          {t('overview') || 'Visão Geral'}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Status atual do sistema K-TAG
        </p>
      </div>

      {/* Stats Cards - Legíveis e profissionais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
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

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('tagLinkStatus') || 'Status de Vinculação'}
            </h3>
            <Activity className="w-5 h-5 text-slate-500" />
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
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
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-center gap-8 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{t('linkedTags')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{t('unlinkedTags')}</span>
            </div>
          </div>
        </motion.div>

        {/* Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
            {t('vehicleDist') || 'Distribuição por Tipo'}
          </h3>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barSize={40}>
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={13}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={13}
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
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 8, 8]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
};