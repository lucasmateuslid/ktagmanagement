
import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Schedule, Technician, ScheduleStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { 
  Clock, Calendar, CheckCircle2, XCircle, AlertCircle, Wrench, Send, 
  Maximize2, LayoutGrid, RotateCcw, Activity, Trash2, Eye, Hourglass,
  History, User, MapPin, Check, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrackingModal, RequestStepper } from '../components/TrackingModal';

// Componente de Cronômetro
const PendingTimer = ({ startTime, isAnalyzing }: { startTime: number, isAnalyzing: boolean }) => {
    const [elapsed, setElapsed] = useState('');
    const [isCritical, setIsCritical] = useState(false);

    useEffect(() => {
        const updateTimer = () => {
            const now = Date.now();
            const diff = now - startTime;
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / 1000 / 60) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            let timeString = '';
            if (days > 0) timeString += `${days}d `;
            if (hours > 0 || days > 0) timeString += `${hours}h `;
            timeString += `${minutes}m ${seconds}s`;

            setElapsed(timeString);
            
            // Marca como crítico se passar de 30 minutos
            if (diff > 30 * 60 * 1000) setIsCritical(true);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return (
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${isCritical ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse' : isAnalyzing ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700'}`}>
            <Hourglass size={10} className={isCritical ? 'text-red-500' : isAnalyzing ? 'text-blue-500' : 'text-zinc-400'} />
            <span>{isAnalyzing ? 'Análise: ' : 'Aguardando: '}{elapsed}</span>
        </div>
    );
};

export const Schedules = () => {
  const { user, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States de UI
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'active' | 'history'>('active');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [trackingSchedule, setTrackingSchedule] = useState<Schedule | null>(null); // State para o modal de tracking
  
  // States do Modal de Edição (Admin)
  const [editForm, setEditForm] = useState<{
    techId: string;
    date: string;
    time: string;
  }>({ techId: '', date: '', time: '' });

  const loadData = async () => {
    if (user) {
        setLoading(true);
        // Busca agendamentos baseado na role. Admin/Mod vê tudo, User vê só seus.
        const roleForQuery = (user.role === 'admin' || user.role === 'moderator') ? 'admin' : 'user';
        const [sch, techs] = await Promise.all([
            storage.getSchedules(roleForQuery, user.id),
            storage.getTechnicians()
        ]);
        
        // Ordena: mais recentes primeiro
        setSchedules(sch.sort((a, b) => b.createdAt - a.createdAt));
        setTechnicians(techs.filter(t => t.active));
        
        // Ajusta aba inicial baseado na role
        if (user.role === 'user') setActiveTab('active');
        else setActiveTab('pending');
        
        setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  // Estatísticas do Mês (Expandidas)
  const monthStats = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const monthSchedules = schedules.filter(s => {
          // Usa data confirmada se existir, senão createdAt para pendentes
          const checkDate = s.confirmedDate ? new Date(s.confirmedDate + 'T00:00:00') : new Date(s.createdAt);
          return checkDate.getMonth() === currentMonth && checkDate.getFullYear() === currentYear;
      });

      return {
          total: monthSchedules.length,
          scheduled: monthSchedules.filter(s => ['Confirmada', 'Reagendada'].includes(s.status)).length,
          completed: monthSchedules.filter(s => s.status === 'Concluída').length,
          canceled: monthSchedules.filter(s => s.status === 'Cancelada').length,
          // Breakdown por serviço
          instalacao: monthSchedules.filter(s => s.serviceType === 'Instalação').length,
          manutencao: monthSchedules.filter(s => s.serviceType === 'Manutenção').length,
          retirada: monthSchedules.filter(s => s.serviceType === 'Retirada').length
      };
  }, [schedules]);

  // Filtros Admin
  const pendingSchedules = useMemo(() => schedules.filter(s => ['Solicitada', 'Em análise'].includes(s.status)), [schedules]);
  const confirmedSchedules = useMemo(() => schedules.filter(s => !['Solicitada', 'Em análise'].includes(s.status)), [schedules]);
  
  // Filtros Usuário
  const myActiveSchedules = useMemo(() => schedules.filter(s => !['Cancelada', 'Concluída'].includes(s.status)), [schedules]);
  const myHistorySchedules = useMemo(() => schedules.filter(s => ['Cancelada', 'Concluída'].includes(s.status)), [schedules]);

  const handleOpenModal = (sch: Schedule) => {
    setSelectedSchedule(sch);
    setEditForm({
        techId: sch.technicianId || '',
        date: sch.confirmedDate || sch.preferredDate,
        time: sch.confirmedTime || sch.preferredTime
    });
  };

  const handleSendWhatsapp = (sch: Schedule, phone?: string) => {
      const msg = `*NOVA SOLICITAÇÃO TÉCNICA*\n\n` +
          `🚘 *Veículo:* ${sch.vehicleModel}\n` +
          `🔢 *Placa:* ${sch.vehiclePlate}\n` +
          `📦 *Equipamento:* ${sch.deviceType}\n` +
          `🛠 *Serviço:* ${sch.serviceType}\n` +
          `📅 *Data Pref:* ${new Date(sch.preferredDate).toLocaleDateString()} às ${sch.preferredTime}\n` +
          `📍 *Local:* ${sch.locationAddress}\n` +
          `🔗 *Google Maps:* https://www.google.com/maps?q=${sch.locationLat},${sch.locationLng}`;
      const text = encodeURIComponent(msg);
      const url = phone 
        ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`
        : `https://wa.me/?text=${text}`; 
      window.open(url, '_blank');
  };

  const handleVerify = async (sch: Schedule) => {
      if (!user) return;
      const updated: Schedule = {
          ...sch,
          status: 'Em análise',
          analysisStartedAt: Date.now(),
          history: [
              ...sch.history,
              {
                  action: 'Verificando',
                  actionBy: user.name, // Nome do operador que iniciou
                  timestamp: Date.now(),
                  details: 'Iniciou verificação do agendamento'
              }
          ]
      };
      await storage.saveSchedule(updated);
      addNotification('info', 'Verificação Iniciada', 'O cliente será notificado que você está analisando.');
      if (selectedSchedule?.id === sch.id) setSelectedSchedule(updated);
      loadData();
  };

  const handleUpdateStatus = async (newStatus: ScheduleStatus) => {
    if (!selectedSchedule || !user) return;

    if (newStatus === 'Confirmada' && !editForm.techId) {
        addNotification('error', 'Técnico Obrigatório', 'Selecione um técnico para confirmar o agendamento.');
        return;
    }

    const effectiveStatus = newStatus === 'Reagendada' ? 'Solicitada' : newStatus;
    const actionText = newStatus === 'Reagendada' ? 'Solicitou Reagendamento' : (newStatus === 'Confirmada' ? 'Confirmou' : newStatus === 'Cancelada' ? 'Cancelou' : newStatus === 'Concluída' ? 'Finalizou' : 'Alterou');

    const updated: Schedule = {
        ...selectedSchedule,
        status: effectiveStatus,
        technicianId: editForm.techId || selectedSchedule.technicianId,
        confirmedDate: editForm.date,
        confirmedTime: editForm.time,
        history: [
            ...selectedSchedule.history,
            {
                action: actionText,
                actionBy: user.name,
                timestamp: Date.now(),
                details: `Status para ${effectiveStatus} ${editForm.techId ? `| Tec: ${technicians.find(t => t.id === editForm.techId)?.name}` : ''}`
            }
        ]
    };

    try {
        await storage.saveSchedule(updated);
        addNotification('success', 'Atualizado', `Status atualizado para ${effectiveStatus}.`);
        setSelectedSchedule(null);
        loadData();
    } catch (e) {
        addNotification('error', 'Erro', 'Falha ao atualizar agendamento.');
    }
  };

  const handleUserUpdate = async (updated: Schedule) => {
      try {
          await storage.saveSchedule(updated);
          addNotification('success', 'Atualizado', 'Informações da solicitação atualizadas.');
          loadData();
          setTrackingSchedule(updated);
      } catch (e) {
          addNotification('error', 'Erro', 'Falha ao atualizar solicitação.');
      }
  };

  const handleDelete = async () => {
      if (!selectedSchedule) return;
      if (!confirm('Tem certeza que deseja excluir permanentemente este agendamento?')) return;
      
      try {
          await storage.deleteSchedule(selectedSchedule.id);
          addNotification('success', 'Excluído', 'Solicitação removida do sistema.');
          setSelectedSchedule(null);
          loadData();
      } catch (e) {
          addNotification('error', 'Erro', 'Falha ao excluir agendamento.');
      }
  };

  const statusColors: Record<string, string> = {
    'Solicitada': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
    'Em análise': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    'Confirmada': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'Reagendada': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    'Concluída': 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
    'Cancelada': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
  };

  const serviceColors: Record<string, string> = {
      'Instalação': 'text-blue-500 dark:text-blue-400',
      'Manutenção': 'text-orange-500 dark:text-orange-400',
      'Retirada': 'text-red-500 dark:text-red-400'
  };

  // --- RENDERIZAÇÃO PARA USUÁRIO COMUM ---
  if (user?.role === 'user') {
      const displayList = activeTab === 'active' ? myActiveSchedules : myHistorySchedules;

      return (
        <div className="space-y-8 pb-20">
            {trackingSchedule && (
                <TrackingModal 
                    schedule={trackingSchedule} 
                    technicians={technicians} 
                    onClose={() => setTrackingSchedule(null)} 
                    onUpdate={handleUserUpdate} 
                    currentUser={user}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Minhas Solicitações</h1>
                    <p className="text-zinc-500 mt-1 font-medium text-xs">Acompanhe o andamento dos serviços em sua frota.</p>
                </div>
                
                <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 w-full md:w-auto">
                    <button 
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'active' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <Clock size={14} className={activeTab === 'active' ? 'text-primary-500' : ''}/> 
                        Em Andamento
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <History size={14} className={activeTab === 'history' ? 'text-zinc-400' : ''}/> 
                        Histórico
                    </button>
                </div>
            </div>
            
            <div className="flex flex-col gap-4 max-w-4xl mx-auto">
                {displayList.length === 0 ? (
                    <div className="col-span-full p-12 text-center flex flex-col items-center gap-4 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[32px]">
                        <Calendar size={48} className="opacity-20"/>
                        <span className="text-xs font-black uppercase tracking-widest">Nenhuma solicitação encontrada nesta aba</span>
                    </div>
                ) : (
                    displayList.map(sch => {
                        // Lógica para encontrar o analista
                        const analyst = [...sch.history].reverse().find(h => h.action === 'Verificando' || h.action === 'Em análise' || h.action === 'Assumiu' || h.statusSnapshot === 'Em análise')?.actionBy;

                        return (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                key={sch.id} 
                                className="bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group p-5 md:p-6"
                            >
                                {/* Header do Card: Status & Botão Expandir */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColors[sch.status]}`}>
                                            {sch.status}
                                        </span>
                                        {/* Timer para User */}
                                        {['Solicitada', 'Em análise'].includes(sch.status) && (
                                            <PendingTimer startTime={sch.status === 'Em análise' && sch.analysisStartedAt ? sch.analysisStartedAt : sch.createdAt} isAnalyzing={sch.status === 'Em análise'} />
                                        )}
                                    </div>
                                    <button onClick={() => setTrackingSchedule(sch)} className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-primary-500 transition-colors border border-zinc-100 dark:border-zinc-700" title="Expandir">
                                        <Maximize2 size={16} />
                                    </button>
                                </div>

                                {/* Conteúdo Principal */}
                                <div className="mb-5">
                                    <h3 className="text-2xl font-black uppercase text-zinc-900 dark:text-white tracking-tight leading-none mb-1">{sch.vehiclePlate}</h3>
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{sch.vehicleModel}</p>
                                </div>

                                {/* Grid de Informações */}
                                <div className="flex flex-col gap-3 mb-6">
                                    {/* Box de Pessoas: Solicitante e Analista */}
                                    <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 flex justify-between items-center">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[9px] font-medium text-zinc-400">Solicitado por:</span>
                                            <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{sch.requesterName}</span>
                                        </div>
                                        {analyst && (
                                            <div className="flex flex-col gap-0.5 text-right">
                                                <span className="text-[9px] font-medium text-zinc-400 flex items-center justify-end gap-1">
                                                    <ShieldCheck size={10} className="text-primary-500"/> Analisado por:
                                                </span>
                                                <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{analyst}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Box de Serviço e Data */}
                                    <div className="bg-zinc-50 dark:bg-zinc-950/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Wrench size={14} className="text-zinc-400 shrink-0"/> 
                                            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Serviço:</span> 
                                            <span className={`text-[11px] font-bold ${serviceColors[sch.serviceType]}`}>{sch.serviceType}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} className="text-zinc-400 shrink-0"/>
                                            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{sch.confirmedDate ? 'Agendado:' : 'Preferência:'}</span>
                                            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                                                {sch.confirmedDate 
                                                    ? `${new Date(sch.confirmedDate + 'T00:00:00').toLocaleDateString()} às ${sch.confirmedTime}`
                                                    : `${new Date(sch.preferredDate + 'T00:00:00').toLocaleDateString()}`
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Stepper Integrado no Card */}
                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
                                    <RequestStepper status={sch.status} />
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
      );
  }

  // --- RENDERIZAÇÃO PARA ADMIN / MODERATOR ---
  const isPendingTab = activeTab === 'pending';
  const displayList = isPendingTab ? pendingSchedules : confirmedSchedules;

  return (
    <div className="space-y-8 pb-20">
        {trackingSchedule && (
            <TrackingModal 
                schedule={trackingSchedule} 
                technicians={technicians} 
                onClose={() => setTrackingSchedule(null)} 
                onUpdate={handleUserUpdate} 
                currentUser={user}
            />
        )}

        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Central de Agendamentos</h1>
                <p className="text-zinc-500 mt-1 font-medium text-xs">Gerencie solicitações e a agenda da equipe técnica.</p>
            </div>

            {/* Stats Dashboard Expandido */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {/* Linha Principal de Status */}
                <div className="col-span-2 md:col-span-1 bg-white dark:bg-zinc-900 p-4 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Total no Mês</p>
                    <div className="flex items-end justify-between">
                        <p className="text-2xl font-black text-zinc-900 dark:text-white">{monthStats.total}</p>
                        <LayoutGrid size={18} className="text-zinc-300"/>
                    </div>
                </div>
                <div className="col-span-2 md:col-span-1 bg-white dark:bg-zinc-900 p-4 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Agendadas</p>
                    <div className="flex items-end justify-between">
                        <p className="text-2xl font-black text-blue-500">{monthStats.scheduled}</p>
                        <Calendar size={18} className="text-blue-500/50"/>
                    </div>
                </div>
                <div className="col-span-2 md:col-span-1 bg-white dark:bg-zinc-900 p-4 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Concluídas</p>
                    <div className="flex items-end justify-between">
                        <p className="text-2xl font-black text-emerald-500">{monthStats.completed}</p>
                        <CheckCircle2 size={18} className="text-emerald-500/50"/>
                    </div>
                </div>
                <div className="col-span-2 md:col-span-1 bg-white dark:bg-zinc-900 p-4 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Canceladas</p>
                    <div className="flex items-end justify-between">
                        <p className="text-2xl font-black text-red-500">{monthStats.canceled}</p>
                        <XCircle size={18} className="text-red-500/50"/>
                    </div>
                </div>

                {/* Linha de Tipos de Serviço */}
                <div className="col-span-2 md:col-span-1 bg-blue-500/5 dark:bg-blue-500/10 p-4 rounded-[20px] border border-blue-500/10 flex flex-col justify-between">
                    <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Instalação</p>
                    <div className="flex items-end justify-between">
                        <p className="text-xl font-black text-blue-500">{monthStats.instalacao}</p>
                        <Wrench size={16} className="text-blue-500/50"/>
                    </div>
                </div>
                <div className="col-span-2 md:col-span-1 bg-orange-500/5 dark:bg-orange-500/10 p-4 rounded-[20px] border border-orange-500/10 flex flex-col justify-between">
                    <p className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-2">Manutenção</p>
                    <div className="flex items-end justify-between">
                        <p className="text-xl font-black text-orange-500">{monthStats.manutencao}</p>
                        <Activity size={16} className="text-orange-500/50"/>
                    </div>
                </div>
                <div className="col-span-2 md:col-span-1 bg-red-500/5 dark:bg-red-500/10 p-4 rounded-[20px] border border-red-500/10 flex flex-col justify-between">
                    <p className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-2">Retirada</p>
                    <div className="flex items-end justify-between">
                        <p className="text-xl font-black text-red-500">{monthStats.retirada}</p>
                        <RotateCcw size={16} className="text-red-500/50"/>
                    </div>
                </div>
            </div>
            
            {/* Tabs */}
            <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 self-start overflow-x-auto max-w-full">
                <button 
                    onClick={() => setActiveTab('pending')}
                    className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'pending' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                >
                    <AlertCircle size={14} className={activeTab === 'pending' ? 'text-primary-500' : ''}/> 
                    Pendentes ({pendingSchedules.length})
                </button>
                <button 
                    onClick={() => setActiveTab('confirmed')}
                    className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'confirmed' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                >
                    <CheckCircle2 size={14} className={activeTab === 'confirmed' ? 'text-emerald-500' : ''}/> 
                    Agendados ({confirmedSchedules.length})
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayList.length === 0 ? (
                <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 text-zinc-400">
                    <Calendar size={48} className="opacity-20"/>
                    <span className="text-xs font-black uppercase tracking-widest">Nenhum agendamento nesta lista</span>
                </div>
            ) : (
                displayList.map(sch => (
                    <div key={sch.id} onClick={() => handleOpenModal(sch)} className="bg-white dark:bg-zinc-900 p-6 rounded-[28px] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-primary-500 cursor-pointer transition-all group relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColors[sch.status]}`}>{sch.status}</span>
                                {['Solicitada', 'Em análise'].includes(sch.status) ? (
                                    // CRONÔMETRO PARA SOLICITAÇÕES PENDENTES - RESET NO 'EM ANÁLISE'
                                    <PendingTimer startTime={sch.status === 'Em análise' && sch.analysisStartedAt ? sch.analysisStartedAt : sch.createdAt} isAnalyzing={sch.status === 'Em análise'} />
                                ) : (
                                    <span className="text-[10px] font-bold text-zinc-400">{new Date(sch.preferredDate).toLocaleDateString()}</span>
                                )}
                            </div>
                            
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{sch.vehiclePlate}</h3>
                            <p className="text-xs text-zinc-500 font-bold uppercase mt-1 mb-4">{sch.vehicleModel}</p>
                            
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                    <User size={14} className="text-zinc-400 shrink-0"/> <span className="truncate">Solicitante: <span className="font-bold">{sch.requesterName}</span></span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                    <Wrench size={14} className="text-zinc-400 shrink-0"/> Serviço: <span className={`font-bold ${serviceColors[sch.serviceType]}`}>{sch.serviceType}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                    <MapPin size={14} className="text-zinc-400 shrink-0"/> <span className="truncate flex-1">{sch.locationAddress}</span>
                                </div>
                            </div>
                        </div>

                        {sch.technicianId && (
                            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Técnico</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: technicians.find(t => t.id === sch.technicianId)?.color || '#ccc' }}></div>
                                    <span className="text-xs font-bold text-zinc-900 dark:text-white">{technicians.find(t => t.id === sch.technicianId)?.name}</span>
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
                            {/* Botão Rápido de WhatsApp no Card para 'Em análise' */}
                            {sch.status === 'Em análise' && (
                                <button onClick={(e) => { e.stopPropagation(); handleSendWhatsapp(sch, sch.clientPhone); }} className="flex-1 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2">
                                    <Send size={12} /> WhatsApp
                                </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); setTrackingSchedule(sch); }} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-primary-500" title="Ver Detalhes">
                                <Maximize2 size={16} />
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Modal de Gestão (Admin/Mod) - OTIMIZADO PARA MOBILE */}
        {selectedSchedule && (
            <div className="fixed inset-0 z-[1000] overflow-y-auto bg-black/80 backdrop-blur-md">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div className="fixed inset-0 transition-opacity" onClick={() => setSelectedSchedule(null)} />
                    
                    <div className="relative transform overflow-hidden bg-white dark:bg-zinc-900 rounded-[32px] text-left shadow-xl transition-all sm:my-8 w-full max-w-2xl border border-zinc-200 dark:border-zinc-800">
                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl md:text-2xl font-display font-black uppercase tracking-tight">Gerenciar Solicitação</h2>
                                <button onClick={() => setSelectedSchedule(null)} className="p-2 text-zinc-400 hover:text-zinc-600"><XCircle size={24}/></button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-2xl space-y-3">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Solicitante</p>
                                                {['Solicitada', 'Em análise'].includes(selectedSchedule.status) && (
                                                    <PendingTimer startTime={selectedSchedule.status === 'Em análise' && selectedSchedule.analysisStartedAt ? selectedSchedule.analysisStartedAt : selectedSchedule.createdAt} isAnalyzing={selectedSchedule.status === 'Em análise'} />
                                                )}
                                            </div>
                                            <p className="font-bold text-zinc-900 dark:text-white">{selectedSchedule.requesterName}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Veículo</p>
                                            <p className="font-bold text-zinc-900 dark:text-white uppercase">{selectedSchedule.vehiclePlate} - {selectedSchedule.vehicleModel}</p>
                                            {/* Exibição do Device Type no Modal */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] font-black uppercase">
                                                    {selectedSchedule.deviceType}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">{selectedSchedule.fipeValue}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Local</p>
                                            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-tight">{selectedSchedule.locationAddress}</p>
                                            {selectedSchedule.locationLat !== 0 && (
                                                <a href={`https://www.google.com/maps?q=${selectedSchedule.locationLat},${selectedSchedule.locationLng}`} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-primary-500 hover:underline flex items-center gap-1 mt-1"><MapPin size={10}/> Ver no Mapa</a>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Atribuir Técnico</label>
                                            <div className="flex gap-2">
                                                <select 
                                                    value={editForm.techId} 
                                                    onChange={e => setEditForm({...editForm, techId: e.target.value})} 
                                                    className="flex-1 px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500 transition-all"
                                                >
                                                    <option value="">-- Selecione --</option>
                                                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                                {/* Botão de WhatsApp Técnico no Modal */}
                                                <button 
                                                    onClick={() => {
                                                        const techPhone = technicians.find(t => t.id === editForm.techId)?.phone;
                                                        handleSendWhatsapp(selectedSchedule, techPhone);
                                                    }}
                                                    className="p-3 bg-[#25D366] text-white rounded-xl hover:bg-[#20bd5a]"
                                                    title="Enviar dados via WhatsApp"
                                                >
                                                    <Send size={18} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Data</label>
                                                <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none dark:text-white" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Hora</label>
                                                <input type="time" value={editForm.time} onChange={e => setEditForm({...editForm, time: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none dark:text-white" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col h-full">
                                    <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-4">Histórico de Eventos</h3>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 max-h-[250px] md:max-h-[300px]">
                                        {selectedSchedule.history.map((h, i) => (
                                            <div key={i} className="flex gap-3 relative">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 mt-1.5"/>
                                                    {i !== selectedSchedule.history.length - 1 && <div className="w-px h-full bg-zinc-200 dark:bg-zinc-800 my-1"/>}
                                                </div>
                                                <div className="pb-4">
                                                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200"><span className="text-primary-500">{h.actionBy}</span> {h.action}</p>
                                                    <p className="text-[10px] text-zinc-400">{new Date(h.timestamp).toLocaleString()}</p>
                                                    {h.details && <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 bg-zinc-50 dark:bg-zinc-800 p-2 rounded-lg inline-block">{h.details}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
                                {/* Botão VERIFICAR para iniciar análise */}
                                {selectedSchedule.status === 'Solicitada' && (
                                    <button 
                                        onClick={() => handleVerify(selectedSchedule)}
                                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 mb-2"
                                    >
                                        <Eye size={16} /> Verificar Agendamento
                                    </button>
                                )}

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button 
                                        onClick={() => handleUpdateStatus('Confirmada')} 
                                        className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95"
                                    >
                                        <CheckCircle2 size={16} className="inline mr-2"/> Confirmar
                                    </button>
                                    
                                    {selectedSchedule.status !== 'Solicitada' && (
                                        <button 
                                            onClick={() => handleUpdateStatus('Reagendada')} 
                                            className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95"
                                        >
                                            <Clock size={16} className="inline mr-2"/> Reagendar
                                        </button>
                                    )}
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button 
                                        onClick={() => handleUpdateStatus('Concluída')} 
                                        className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95"
                                    >
                                        <Check size={16} className="inline mr-2"/> Finalizar
                                    </button>
                                    <button 
                                        onClick={() => { if(confirm('Cancelar esta solicitação?')) handleUpdateStatus('Cancelada'); }} 
                                        className="flex-1 py-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={handleDelete}
                                        className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95 flex justify-center items-center"
                                        title="Excluir Permanentemente"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
