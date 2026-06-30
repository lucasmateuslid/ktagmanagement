
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { storage } from '../../services/storage';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Schedule, Technician, Company } from '../../types';
import { TrackingModal } from '../../components/TrackingModal';
import { Plus, UserCircle2, ChevronLeft, ChevronRight, LayoutGrid, Calendar, CheckCircle2, XCircle, Search, ChevronDown } from 'lucide-react';
import { TechnicianAvailabilityAlert } from '../../components/TechnicianAvailabilityAlert';
import { whatsappService } from '../../services/whatsappService';

// Hooks
import { useScheduleStats } from './hooks/useScheduleStats';
import { useScheduleFilters } from './hooks/useScheduleFilters';
import { useScheduleExport } from './hooks/useScheduleExport';

// Components
import { ServiceTypesRow } from './components/dashboard/ServiceTypesRow';
import { DeviceTypesRow } from './components/dashboard/DeviceTypesRow';
import { FinancialSummaryRow } from './components/dashboard/FinancialSummaryRow';
import { ScheduleTabs } from './components/filters/ScheduleTabs';
import { ScheduleSearchBar } from './components/filters/ScheduleSearchBar';
import { ScheduleDropdownFilters } from './components/filters/ScheduleDropdownFilters';
import { AdminScheduleCard } from './components/cards/AdminScheduleCard';
import { UserScheduleCard } from './components/cards/UserScheduleCard';
import { TechnicianScheduleCard } from '../../components/TechnicianScheduleCard';
import { ScheduleKanban } from './components/ScheduleKanban';
import { EmptyState } from './components/EmptyState';

export const SchedulesPage = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(new Date());

  // --- DATA LOADING ---
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
        setLoading(false);

        if (user) {
            let queryId = user.technicianId || user.id;
            if (user.role === 'technician' || user.role === 'admin_tecnico') {
                const tech = user.technicianId ? techs.find(t => t.id === user.technicianId) : techs.find(t => t.email?.toLowerCase() === user.email?.toLowerCase());
                if (tech) queryId = tech.id;
            }

            unsubscribe = storage.subscribeToSchedules(
                (isAdmin || user.role === 'moderator') ? 'admin' : (user.role === 'client' ? 'user' : (user.role === 'technician' ? 'technician' : 'user')), 
                queryId, 
                (data) => {
                    setSchedules(data.sort((a, b) => b.createdAt - a.createdAt));
                }
            );
        }
    };
    init();

    return () => {
        unsubscribe();
    };
  }, [user, isAdmin]);

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
    filterStatusDropdown, setFilterStatusDropdown,
    filterDevice, setFilterDevice,
    filterShift, setFilterShift,
    filterActiveRequester, setFilterActiveRequester,
    filterOnlyMine, setFilterOnlyMine,
    filterStartDate, setFilterStartDate,
    filterEndDate, setFilterEndDate
  } = useScheduleFilters(schedules, technicians, user, viewDate);

  const stats = useScheduleStats(schedules, technicians, viewDate, isPrivileged);

  const { handleExportPDF, handleExportExcel, isExporting } = useScheduleExport(
    filteredList, 
    technicians, 
    companies,
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

  const handleStatusChange = async (scheduleId: string, newStatus: string) => {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule || schedule.status === newStatus) return;
      
      try {
         const newHistory = [...(schedule.history || [])];
         newHistory.push({
             action: 'Alteração de Status via Kanban',
             timestamp: Date.now(),
             actionBy: user?.name || 'Sistema',
             statusSnapshot: newStatus
         } as any);
         const updated = { ...schedule, status: newStatus as any, history: newHistory };
         await storage.saveSchedule(updated);

         if (updated.clientPhone) {
             const msg = whatsappService.getScheduleStatusMessage(
                 updated.clientName?.split(' ')[0] || updated.requesterName.split(' ')[0], 
                 updated.vehiclePlate, 
                 updated.status,
                 updated.confirmedDate ? `${updated.confirmedDate.split('-').reverse().join('/')} às ${updated.confirmedTime}` : undefined
             );
             whatsappService.sendMessage(updated.clientPhone, msg);
         }
         addNotification('success', 'Status atualizado', 'Status do agendamento alterado.');
      } catch(e) {
         addNotification('error', 'Erro', 'Falha ao atualizar o card.');
      }
  };

  const handleCopyConfirmation = (e: React.MouseEvent, schedule: Schedule) => {
      e.stopPropagation();
      
      const tech = technicians.find(t => t.id === schedule.technicianId);
      const techName = tech ? tech.name : 'A definir';
      
      const dateParts = schedule.confirmedDate ? schedule.confirmedDate.split('-') : null;
      const dateDisplay = dateParts ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : 'A definir';
      const timeDisplay = schedule.confirmedTime || 'A definir';
      const clientDisplay = schedule.clientName ? schedule.clientName.split(' ')[0] : (schedule.requesterName.split(' ')[0] || 'Cliente');

      const text = `Nova ordem de serviço (${schedule.id.substring(0, 8).toUpperCase()}) disponível.\n\n` +
      `Olá, ${clientDisplay}! 👋\n\n` +
      `O seu agendamento de ${schedule.serviceType} para o veiculo: ${schedule.vehicleModel} (${schedule.vehiclePlate}) foi confirmado ✅\n\n` +
      `📅 Data: ${dateDisplay}\n` +
      `⏰ Horário: ${timeDisplay}\n` +
      `👨‍🔧 Técnico responsável: ${techName}\n` +
      `📍 O atendimento será realizado no endereço informado.\n\n` +
      `Fique tranquilo(a), nossa equipe estará no local dentro do horário programado.`;

      navigator.clipboard.writeText(text);
      addNotification('success', 'Copiado', 'Mensagem de confirmação copiada.');
  };

  const handleUpdateSchedule = async (updated: Schedule) => {
      try {
          const previousSchedule = schedules.find(s => s.id === updated.id);
          const statusChanged = previousSchedule && previousSchedule.status !== updated.status;
          
          await storage.saveSchedule(updated);
          storage.logAction(user, 'UPDATE', 'Schedule', `Atualizou agendamento: ${updated.vehiclePlate}`, updated.id);
          setSelectedSchedule(updated);

          // Disparo de notificação WhatsApp
          if (statusChanged && updated.clientPhone) {
              const msg = whatsappService.getScheduleStatusMessage(
                  updated.clientName?.split(' ')[0] || updated.requesterName.split(' ')[0], 
                  updated.vehiclePlate, 
                  updated.status,
                  updated.confirmedDate ? `${updated.confirmedDate.split('-').reverse().join('/')} às ${updated.confirmedTime}` : undefined
              );
              whatsappService.sendMessage(updated.clientPhone, msg);
          }
      } catch (e) {
          addNotification('error', 'Erro', 'Falha ao salvar agendamento.');
      }
  };

  const handleDeleteSchedule = async (id: string) => {
      const s = schedules.find(s => s.id === id);
      await storage.deleteSchedule(id);
      if (user && s) {
          storage.logAction(user, 'DELETE', 'Schedule', `Removeu agendamento: ${s.vehiclePlate}`, id);
      }
      setSelectedSchedule(null);
      addNotification('success', 'Excluído', 'Agendamento removido.');
  };

    const userStats = React.useMemo(() => {
        const total = schedules.length;
        const completed = schedules.filter(s => s.status === 'Concluída').length;
        const canceled = schedules.filter(s => s.status === 'Cancelada').length;
        const pending = total - completed - canceled;
        return { total, completed, canceled, pending };
    }, [schedules]);

  return (
    <div className="space-y-8 pb-24 max-w-[1600px] mx-auto">
        {user?.role === 'technician' ? (
             <div className="space-y-6">
                 <div className="flex justify-between items-center bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 shrink-0">
                     <h1 className="text-xl font-display font-black text-zinc-900 dark:text-white flex items-center gap-2">
                       Análise Mensal <Search size={18} className="text-red-500"/>
                     </h1>
                     <div className="bg-blue-600 text-white rounded-xl px-3 py-1.5 flex items-center gap-2 font-bold text-sm">
                        <Calendar size={14} /> jun. 2026 <ChevronDown size={14} />
                     </div>
                 </div>

                 <div className="px-4">
                     <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-3 mb-6 flex items-center gap-2">
                        <Search size={18} className="text-zinc-400" />
                        <input 
                           type="text" 
                           placeholder="Pesquisar por número, nome do cliente, veículo"
                           className="bg-transparent border-none outline-none text-sm w-full font-medium"
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                        />
                     </div>

                     <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 mb-6 flex items-center justify-between">
                         <div className="space-y-3">
                             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div><span className="font-black text-lg">1</span><span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Abertas</span></div>
                             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-400"></div><span className="font-black text-lg">0</span><span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Iniciadas</span></div>
                             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="font-black text-lg">0</span><span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Finalizadas</span></div>
                             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-600"></div><span className="font-black text-lg">0</span><span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Canceladas</span></div>
                             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-zinc-800"></div><span className="font-black text-lg">0</span><span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Não Realizada</span></div>
                         </div>
                         <div className="w-32 h-32 relative">
                             {/* Donut placeholder */}
                             <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                 <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f4f4f5" strokeWidth="20" />
                                 <circle cx="50" cy="50" r="40" fill="transparent" stroke="#fbbf24" strokeWidth="20" strokeDasharray="251.2" strokeDashoffset="0" />
                             </svg>
                             <div className="absolute inset-0 flex items-center justify-center font-black text-xl">1</div>
                         </div>
                     </div>

                     {/* Custom Scrollable Tabs */}
                     <div className="flex overflow-x-auto gap-6 hide-scrollbar border-b border-zinc-200 dark:border-zinc-800 mb-6 px-1">
                         {['Aberto', 'Iniciado', 'Finalizado', 'Cancelado', 'Não realizada'].map(tab => (
                             <button 
                                key={tab}
                                onClick={() => setStatusFilter(tab === 'Aberto' ? 'Confirmada' : tab === 'Iniciado' ? 'Técnico no local' : tab === 'Finalizado' ? 'Concluída' : tab === 'Cancelado' ? 'Cancelada' : 'Frustrada')}
                                className={`pb-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                                    (statusFilter === 'Confirmada' && tab === 'Aberto') ||
                                    (statusFilter === 'Técnico no local' && tab === 'Iniciado') ||
                                    (statusFilter === 'Concluída' && tab === 'Finalizado') ||
                                    (statusFilter === 'Cancelada' && tab === 'Cancelado') ||
                                    (statusFilter === 'Frustrada' && tab === 'Não realizada')
                                        ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500'
                                }`}
                             >
                                 {tab}
                             </button>
                         ))}
                     </div>
                 </div>
             </div>
        ) : isPrivileged ? (
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

                <TechnicianAvailabilityAlert />

                {/* Dashboard só aparece se for privilegiado E NÃO estiver no modo 'Minhas Solicitações' */}
                {stats && !showMyRequests && (
                    <div className="space-y-6">
                        {/* KPI Boxes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            
                            {/* Total */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest z-10">Total no Mês</span>
                                <span className="text-5xl font-black text-zinc-900 dark:text-white z-10 tracking-tighter">{stats.total}</span>
                                <div className="absolute right-[-20px] bottom-[-20px] opacity-5"><LayoutGrid size={100}/></div>
                            </div>

                            {/* Agendadas (Blue) */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest z-10">Agendadas</span>
                                <span className="text-5xl font-black text-blue-600 dark:text-blue-400 z-10 tracking-tighter">{stats.scheduled}</span>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 opacity-10"><Calendar size={48} strokeWidth={1.5}/></div>
                            </div>

                            {/* Concluídas (Emerald) */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest z-10">Concluídas</span>
                                <span className="text-5xl font-black text-emerald-600 dark:text-emerald-400 z-10 tracking-tighter">{stats.completed}</span>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 opacity-10"><CheckCircle2 size={48} strokeWidth={1.5}/></div>
                            </div>

                            {/* Canceladas (Red) */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest z-10">Canceladas</span>
                                <span className="text-5xl font-black text-red-600 dark:text-red-400 z-10 tracking-tighter">{stats.canceled}</span>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 opacity-10"><XCircle size={48} strokeWidth={1.5}/></div>
                            </div>

                        </div>

                        <ServiceTypesRow data={stats} />
                        <DeviceTypesRow data={stats} />
                        <FinancialSummaryRow data={stats} />
                    </div>
                )}
                
                {/* User Stats when in My Requests mode */}
                {showMyRequests && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total</span>
                            <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{userStats.total}</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pendentes</span>
                            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{userStats.pending}</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Concluídas</span>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{userStats.completed}</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Canceladas</span>
                            <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{userStats.canceled}</p>
                        </div>
                    </div>
                )}
            </div>
        ) : (
            <div className="space-y-6">
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
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total</span>
                        <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{userStats.total}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pendentes</span>
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{userStats.pending}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Concluídas</span>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{userStats.completed}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Canceladas</span>
                        <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{userStats.canceled}</p>
                    </div>
                </div>
            </div>
        )}

        {/* FILTERS & LIST */}
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <ScheduleTabs 
                    isPrivileged={isPrivileged && !showMyRequests} // Simula usuário se showMyRequests for true
                    adminTab={adminTab}
                    setAdminTab={setAdminTab}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    showMyRequests={showMyRequests}
                />
                
                <ScheduleSearchBar 
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    isPrivileged={isPrivileged && !showMyRequests} // Oculta data filters se estiver em modo usuario
                    onExportPDF={handleExportPDF}
                    onExportExcel={handleExportExcel}
                    isExporting={isExporting}
                    filterStartDate={filterStartDate}
                    setFilterStartDate={setFilterStartDate}
                    filterEndDate={filterEndDate}
                    setFilterEndDate={setFilterEndDate}
                />
            </div>

            {isPrivileged && !showMyRequests && (
                <ScheduleDropdownFilters 
                    technicians={technicians}
                    filterTech={filterTech} setFilterTech={setFilterTech}
                    filterService={filterService} setFilterService={setFilterService}
                    filterStatusDropdown={filterStatusDropdown} setFilterStatusDropdown={setFilterStatusDropdown}
                    filterDevice={filterDevice} setFilterDevice={setFilterDevice}
                    filterShift={filterShift} setFilterShift={setFilterShift}
                    filterActiveRequester={filterActiveRequester} setFilterActiveRequester={setFilterActiveRequester}
                    filterOnlyMine={filterOnlyMine} setFilterOnlyMine={setFilterOnlyMine}
                />
            )}
        </div>

        {/* SCHEDULES GRID */}
        <div className={`space-y-4 ${isPrivileged && !showMyRequests ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 space-y-0' : ''}`}>
            {filteredList.length === 0 ? (
                <EmptyState />
            ) : (
                    filteredList.map(item => (isPrivileged && !showMyRequests) ? (
                        <AdminScheduleCard 
                            key={item.id} 
                            item={item} 
                            technicians={technicians} 
                            onClick={setSelectedSchedule} 
                        />
                    ) : user?.role === 'technician' ? (
                        <TechnicianScheduleCard 
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
                companies={companies}
                onClose={() => setSelectedSchedule(null)} 
                onUpdate={handleUpdateSchedule}
                onDelete={handleDeleteSchedule}
                currentUser={user}
            />
        )}

        <ConfirmModal 
            isOpen={isConfirmDeleteOpen}
            onClose={() => setIsConfirmDeleteOpen(false)}
            onConfirm={() => scheduleToDelete && handleDeleteSchedule(scheduleToDelete)}
            title="Excluir Agendamento"
            message="Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita."
            confirmText="Sim, Excluir"
            cancelText="Cancelar"
            type="danger"
        />
    </div>
  );
};
