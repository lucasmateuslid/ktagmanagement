
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { storage } from '../../services/storage';
import { Schedule, Technician } from '../../types';
import { TrackingModal } from '../../components/TrackingModal';
import { Plus, UserCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

// Hooks
import { useScheduleStats } from './hooks/useScheduleStats';
import { useScheduleFilters } from './hooks/useScheduleFilters';
import { useScheduleExport } from './hooks/useScheduleExport';

// Components
import { ServiceTypesRow } from './components/dashboard/ServiceTypesRow';
import { FinancialSummaryRow } from './components/dashboard/FinancialSummaryRow';
import { ScheduleTabs } from './components/filters/ScheduleTabs';
import { ScheduleSearchBar } from './components/filters/ScheduleSearchBar';
import { ScheduleDropdownFilters } from './components/filters/ScheduleDropdownFilters';
import { AdminScheduleCard } from './components/cards/AdminScheduleCard';
import { UserScheduleCard } from './components/cards/UserScheduleCard';
import { EmptyState } from './components/EmptyState';

export const SchedulesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [viewDate, setViewDate] = useState(new Date());

  // --- DATA LOADING ---
  useEffect(() => {
    const init = async () => {
        setLoading(true);
        const techs = await storage.getTechnicians();
        setTechnicians(techs);
        setLoading(false);
    };
    init();

    if (user) {
        const unsubscribe = storage.subscribeToSchedules(
            (user.role === 'admin' || user.role === 'moderator') ? 'admin' : 'user', 
            user.id, 
            (data) => {
                setSchedules(data.sort((a, b) => b.createdAt - a.createdAt));
            }
        );
        return () => unsubscribe();
    }
  }, [user]);

  // --- HOOKS ---
  const { 
    filteredList, 
    isPrivileged, 
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    adminTab, setAdminTab,
    showMyRequests, setShowMyRequests,
    filterTech, setFilterTech,
    filterService, setFilterService,
    filterStatusDropdown, setFilterStatusDropdown
  } = useScheduleFilters(schedules, technicians, user, viewDate);

  const stats = useScheduleStats(schedules, technicians, viewDate, isPrivileged);

  const { handleExportPDF, handleExportExcel, isExporting } = useScheduleExport(
    filteredList, 
    technicians, 
    user, 
    viewDate, 
    stats
  );

  // --- HANDLERS ---
  const handleNavigateMonth = (direction: 'prev' | 'next') => {
      const newDate = new Date(viewDate);
      newDate.setMonth(viewDate.getMonth() + (direction === 'next' ? 1 : -1));
      setViewDate(newDate);
  };

  const handleCopyConfirmation = (e: React.MouseEvent, schedule: Schedule) => {
      e.stopPropagation();
      const text = `AGENDAMENTO K-TAG\nPlaca: ${schedule.vehiclePlate}\nServiço: ${schedule.serviceType}\nStatus: ${schedule.status}\nData: ${schedule.confirmedDate ? new Date(schedule.confirmedDate).toLocaleDateString() : 'A definir'}`;
      navigator.clipboard.writeText(text);
      addNotification('success', 'Copiado', 'Resumo copiado para área de transferência.');
  };

  const handleUpdateSchedule = async (updated: Schedule) => {
      try {
          await storage.saveSchedule(updated);
          setSelectedSchedule(updated);
      } catch (e) {
          addNotification('error', 'Erro', 'Falha ao salvar agendamento.');
      }
  };

  const handleDeleteSchedule = async (id: string) => {
      if (window.confirm('Tem certeza que deseja excluir esta solicitação?')) {
          await storage.deleteSchedule(id);
          setSelectedSchedule(null);
          addNotification('success', 'Excluído', 'Agendamento removido.');
      }
  };

  return (
    <div className="space-y-8 pb-24 max-w-[1600px] mx-auto">
        {/* HEADER */}
        {isPrivileged ? (
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Central de Agendamentos</h1>
                        <p className="text-zinc-500 mt-1 font-medium text-xs">Gerencie solicitações, orçamentos e agenda da equipe.</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowMyRequests(!showMyRequests)}
                            className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${showMyRequests ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}
                        >
                            <UserCircle2 size={16} /> Minhas Solicitações
                        </button>
                        <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1 shadow-sm">
                            <button onClick={() => handleNavigateMonth('prev')} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors"><ChevronLeft size={16}/></button>
                            <div className="flex flex-col items-center w-32">
                                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Período</span>
                                <span className="text-xs font-black uppercase text-zinc-900 dark:text-white">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                            </div>
                            <button onClick={() => handleNavigateMonth('next')} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors"><ChevronRight size={16}/></button>
                        </div>
                    </div>
                </div>

                {stats && (
                    <div className="space-y-6">
                        {/* KPI Boxes would go here if extracted, but sticking to structure requested */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Simple KPIs inline to save space as requested structure prioritized components for rows */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest z-10">Total no Mês</span>
                                <span className="text-5xl font-black text-zinc-900 dark:text-white z-10 tracking-tighter">{stats.total}</span>
                            </div>
                            {/* ... other KPIs can stay here or be extracted ... */}
                        </div>

                        <ServiceTypesRow data={stats} />
                        <FinancialSummaryRow data={stats} />
                    </div>
                )}
            </div>
        ) : (
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Minhas Solicitações</h1>
                    <p className="text-zinc-500 mt-1 font-medium text-xs">Acompanhe o andamento dos serviços em sua frota.</p>
                </div>
                <button 
                    onClick={() => navigate('/schedule/new')}
                    className="flex-1 md:flex-none bg-primary-500 text-black px-6 py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary-500/20 hover:scale-105 transition-all"
                >
                    <Plus size={18} strokeWidth={3} /> Nova Solicitação
                </button>
            </div>
        )}

        {/* FILTERS & LIST */}
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <ScheduleTabs 
                    isPrivileged={isPrivileged}
                    adminTab={adminTab}
                    setAdminTab={setAdminTab}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    showMyRequests={showMyRequests}
                />
                
                <ScheduleSearchBar 
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    isPrivileged={isPrivileged}
                    onExportPDF={handleExportPDF}
                    onExportExcel={handleExportExcel}
                    isExporting={isExporting}
                />
            </div>

            {isPrivileged && (
                <ScheduleDropdownFilters 
                    technicians={technicians}
                    filterTech={filterTech} setFilterTech={setFilterTech}
                    filterService={filterService} setFilterService={setFilterService}
                    filterStatusDropdown={filterStatusDropdown} setFilterStatusDropdown={setFilterStatusDropdown}
                />
            )}
        </div>

        {/* SCHEDULES GRID */}
        <div className={`space-y-4 ${isPrivileged ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 space-y-0' : ''}`}>
            {filteredList.length === 0 ? (
                <EmptyState />
            ) : (
                filteredList.map(item => isPrivileged ? (
                    <AdminScheduleCard 
                        key={item.id} 
                        item={item} 
                        technicians={technicians} 
                        onClick={setSelectedSchedule} 
                    />
                ) : (
                    <UserScheduleCard 
                        key={item.id} 
                        item={item} 
                        technicians={technicians} 
                        onClick={setSelectedSchedule}
                        onCopy={handleCopyConfirmation}
                    />
                ))
            )}
        </div>

        {/* MODAL */}
        {selectedSchedule && (
            <TrackingModal 
                schedule={selectedSchedule} 
                technicians={technicians} 
                onClose={() => setSelectedSchedule(null)} 
                onUpdate={handleUpdateSchedule}
                onDelete={handleDeleteSchedule}
                currentUser={user}
            />
        )}
    </div>
  );
};
