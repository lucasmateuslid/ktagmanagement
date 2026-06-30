import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Schedule, Technician, Company } from '../../types';
import { storage } from '../../services/storage';
import { useNotification } from '../../contexts/NotificationContext';
import { CRMKanban } from './components/CRMKanban';
import { Filter, UserCircle2, Wrench, Shield } from 'lucide-react';
import { TrackingModal } from '../../components/TrackingModal';

export const CRMPage = () => {
  const { user, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View Details Modal
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Filters
  const [filterConsultor, setFilterConsultor] = useState('');
  const [filterTech, setFilterTech] = useState('');
  const [filterAdmin, setFilterAdmin] = useState('');

  // Stats / Calendar Data
  const viewDate = new Date(); // Pode aprimorar para trocar semana/mês depois

  useEffect(() => {
    let unsubscribe = () => {};

    const init = async () => {
        setLoading(true);
        const [techs, comps] = await Promise.all([
             storage.getTechnicians(),
             storage.getCompanies()
        ]);
        setTechnicians(techs);
        setCompanies(comps);

        unsubscribe = storage.subscribeToSchedules(user?.role || 'user', user?.id || '', (data) => {
            setSchedules(data);
            setLoading(false);
        });
    };

    init();

    return () => unsubscribe();
  }, [user]);

  const uniqueAdmins = useMemo(() => {
      const admins = new Set<string>();
      schedules.forEach(s => {
          if (s.responsibleAdmin) admins.add(s.responsibleAdmin);
      });
      return Array.from(admins);
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
      return schedules.filter(s => {
          if (filterConsultor && !s.requesterName?.toLowerCase().includes(filterConsultor.toLowerCase())) return false;
          if (filterTech && s.technicianId !== filterTech) return false;
          if (filterAdmin && s.responsibleAdmin !== filterAdmin) return false;
          return true;
      });
  }, [schedules, filterConsultor, filterTech, filterAdmin]);

  const handleUpdateSchedule = async (updated: Schedule) => {
     try {
         await storage.saveSchedule(updated);
         setSelectedSchedule(updated);
     } catch (e) {}
  };

  const handleDeleteSchedule = async (id: string) => {
     await storage.deleteSchedule(id);
     setSelectedSchedule(null);
  };

  if (loading) {
      return <div className="p-8"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div></div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-black overflow-hidden relative">
        {/* Header/Mini Calendário Section */}
        <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 shrink-0 shadow-sm z-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h1 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">CRM / Kanban</h1>
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest mt-1">Gestão de Ordens de Serviço</p>
            </div>
            {/* Filters */}
            <div className="flex gap-3 flex-wrap flex-1 justify-end max-w-3xl">
                <div className="relative w-full md:w-auto">
                    <UserCircle2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input 
                        type="text"
                        placeholder="Consultor..."
                        value={filterConsultor}
                        onChange={(e) => setFilterConsultor(e.target.value)}
                        className="w-full md:w-40 pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-sm dark:text-white font-medium"
                    />
                </div>
                <div className="relative w-full md:w-auto">
                    <Wrench size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <select 
                        value={filterTech}
                        onChange={(e) => setFilterTech(e.target.value)}
                        className="w-full md:w-40 pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-sm dark:text-white font-medium appearance-none"
                    >
                        <option value="">Técnico (Todos)</option>
                        {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div className="relative w-full md:w-auto">
                    <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <select 
                        value={filterAdmin}
                        onChange={(e) => setFilterAdmin(e.target.value)}
                        className="w-full md:w-40 pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-sm dark:text-white font-medium appearance-none"
                    >
                        <option value="">Moderador (Todos)</option>
                        {uniqueAdmins.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex gap-2">
                {/* Stats */}
                <div className="flex flex-col items-center px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl">
                    <span className="text-lg font-black">{filteredSchedules.filter(s => s.status === 'Concluída').length}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Concluídas</span>
                </div>
                <div className="flex flex-col items-center px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl">
                    <span className="text-lg font-black">{filteredSchedules.filter(s => !['Concluída', 'Cancelada', 'Frustrada'].includes(s.status)).length}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Abertas</span>
                </div>
            </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden p-4">
            <CRMKanban 
               schedules={filteredSchedules} 
               technicians={technicians} 
               onCardClick={setSelectedSchedule} 
            />
        </div>

        {selectedSchedule && (
            <TrackingModal 
                schedule={selectedSchedule} 
                technicians={technicians} 
                companies={companies}
                onClose={() => setSelectedSchedule(null)} 
                onUpdate={handleUpdateSchedule}
                onDelete={handleDeleteSchedule}
                currentUser={user}
            />
        )}
    </div>
  );
};
