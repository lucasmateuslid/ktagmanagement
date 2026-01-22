
import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Schedule, Technician, ScheduleStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Clock, Calendar, CheckCircle2, XCircle, AlertTriangle, User, MapPin, ChevronRight, History, Filter, AlertCircle, Wrench, Check, RotateCcw, Trash2, LayoutGrid, CheckSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Schedules = () => {
  const { user, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States de UI
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'active' | 'history'>('active');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  
  // States do Modal de Edição
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

  // Estatísticas do Mês
  const monthStats = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const monthSchedules = schedules.filter(s => {
          const d = new Date(s.confirmedDate ? `${s.confirmedDate}T00:00:00` : s.createdAt);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      return {
          total: monthSchedules.length,
          completed: monthSchedules.filter(s => s.status === 'Concluída').length,
          canceled: monthSchedules.filter(s => s.status === 'Cancelada').length
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

  const handleUpdateStatus = async (newStatus: ScheduleStatus) => {
    if (!selectedSchedule || !user) return;

    if (newStatus === 'Confirmada' && !editForm.techId) {
        addNotification('error', 'Técnico Obrigatório', 'Selecione um técnico para confirmar o agendamento.');
        return;
    }

    const updated: Schedule = {
        ...selectedSchedule,
        status: newStatus,
        technicianId: editForm.techId || selectedSchedule.technicianId,
        confirmedDate: editForm.date,
        confirmedTime: editForm.time,
        history: [
            ...selectedSchedule.history,
            {
                action: newStatus === 'Confirmada' ? 'Confirmou' : newStatus === 'Reagendada' ? 'Reagendou' : newStatus === 'Cancelada' ? 'Cancelou' : newStatus === 'Concluída' ? 'Finalizou' : 'Alterou',
                actionBy: user.name,
                timestamp: Date.now(),
                details: `Status para ${newStatus} ${editForm.techId ? `| Tec: ${technicians.find(t => t.id === editForm.techId)?.name}` : ''}`
            }
        ]
    };

    try {
        await storage.saveSchedule(updated);
        addNotification('success', 'Atualizado', `Agendamento ${newStatus} com sucesso.`);
        setSelectedSchedule(null);
        loadData();
    } catch (e) {
        addNotification('error', 'Erro', 'Falha ao atualizar agendamento.');
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
    'Solicitada': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    'Em análise': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    'Confirmada': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    'Reagendada': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    'Concluída': 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
    'Cancelada': 'bg-red-500/10 text-red-600 border-red-500/20'
  };

  const serviceColors: Record<string, string> = {
      'Instalação': 'text-blue-500',
      'Manutenção': 'text-orange-500',
      'Retirada': 'text-red-500'
  };

  const RequestStepper = ({ status }: { status: string }) => {
      const steps = [
          { id: 1, label: 'Solicitado', active: ['Solicitada', 'Em análise', 'Confirmada', 'Reagendada', 'Concluída'].includes(status) },
          { id: 2, label: 'Em Análise', active: ['Em análise', 'Confirmada', 'Reagendada', 'Concluída'].includes(status) },
          { id: 3, label: 'Agendado', active: ['Confirmada', 'Reagendada', 'Concluída'].includes(status) },
          { id: 4, label: 'Concluído', active: ['Concluída'].includes(status) }
      ];

      if (status === 'Cancelada') {
          return (
              <div className="w-full bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20 flex items-center justify-center gap-2 text-red-500 text-xs font-black uppercase tracking-widest mt-4">
                  <XCircle size={16} /> Solicitação Cancelada
              </div>
          );
      }

      return (
          <div className="flex items-center justify-between mt-6 relative px-2">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full z-0" />
              {steps.map((step, idx) => {
                  const isCompleted = step.active;
                  return (
                      <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-300'}`}>
                              {isCompleted ? <Check size={14} strokeWidth={4} /> : <span className="text-[10px] font-black">{step.id}</span>}
                          </div>
                          {/* Oculta label no mobile muito pequeno para evitar quebra */}
                          <span className={`text-[8px] font-black uppercase tracking-widest absolute -bottom-6 whitespace-nowrap hidden sm:block ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{step.label}</span>
                      </div>
                  );
              })}
          </div>
      );
  };

  // --- RENDERIZAÇÃO PARA USUÁRIO COMUM ---
  if (user?.role === 'user') {
      const displayList = activeTab === 'active' ? myActiveSchedules : myHistorySchedules;

      return (
        <div className="space-y-8 pb-20">
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
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {displayList.length === 0 ? (
                    <div className="col-span-full p-12 text-center flex flex-col items-center gap-4 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[32px]">
                        <Calendar size={48} className="opacity-20"/>
                        <span className="text-xs font-black uppercase tracking-widest">Nenhuma solicitação encontrada nesta aba</span>
                    </div>
                ) : (
                    displayList.map(sch => (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={sch.id} className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                            
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColors[sch.status]}`}>{sch.status}</span>
                                        <span className="text-[10px] text-zinc-400 font-bold flex items-center gap-1 whitespace-nowrap"><Calendar size={10}/> {new Date(sch.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="text-xl font-black uppercase text-zinc-900 dark:text-white tracking-tight">{sch.vehiclePlate}</h3>
                                    <p className="text-xs font-bold text-zinc-500 uppercase">{sch.vehicleModel}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                    <Wrench size={18} />
                                </div>
                            </div>

                            <div className="space-y-3 bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                    <Wrench size={12} className="text-zinc-400 shrink-0"/> <span className="uppercase font-bold text-[10px] tracking-wider text-zinc-400">Serviço:</span> <span className={`font-bold ${serviceColors[sch.serviceType]}`}>{sch.serviceType}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                    <MapPin size={12} className="text-zinc-400 shrink-0"/> <span className="uppercase font-bold text-[10px] tracking-wider text-zinc-400">Local:</span> <span className="truncate flex-1 font-medium">{sch.locationAddress}</span>
                                </div>
                                {sch.confirmedDate ? (
                                    <div className="flex items-center gap-2 text-xs text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 p-2 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800">
                                        <Calendar size={12} className="text-emerald-500"/> 
                                        <span className="font-black uppercase text-[10px]">Agendado:</span> 
                                        <span className="font-bold">{new Date(sch.confirmedDate + 'T00:00:00').toLocaleDateString()} às {sch.confirmedTime}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 opacity-70">
                                        <Calendar size={12}/> <span className="uppercase font-bold text-[10px] tracking-wider">Preferência:</span> {new Date(sch.preferredDate + 'T00:00:00').toLocaleDateString()}
                                    </div>
                                )}
                            </div>

                            <div className="mb-4">
                                <RequestStepper status={sch.status} />
                            </div>

                            {sch.technicianId && activeTab === 'active' && (
                                <div className="mt-6 flex items-center gap-3 p-3 bg-primary-500/5 border border-primary-500/10 rounded-xl">
                                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center font-black text-xs">
                                        {technicians.find(t => t.id === sch.technicianId)?.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-primary-600 dark:text-primary-400 tracking-widest">Técnico Responsável</p>
                                        <p className="text-xs font-bold text-zinc-900 dark:text-white">{technicians.find(t => t.id === sch.technicianId)?.name}</p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))
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
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Central de Agendamentos</h1>
                <p className="text-zinc-500 mt-1 font-medium text-xs">Gerencie solicitações e a agenda da equipe técnica.</p>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total no Mês</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-white">{monthStats.total}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400"><LayoutGrid size={20}/></div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Concluídos</p>
                        <p className="text-2xl font-black text-emerald-500">{monthStats.completed}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500"><CheckCircle2 size={20}/></div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cancelados</p>
                        <p className="text-2xl font-black text-red-500">{monthStats.canceled}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500"><XCircle size={20}/></div>
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
                                <span className="text-[10px] font-bold text-zinc-400">{new Date(sch.preferredDate).toLocaleDateString()}</span>
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
                                            <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Solicitante</p>
                                            <p className="font-bold text-zinc-900 dark:text-white">{selectedSchedule.requesterName}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Veículo</p>
                                            <p className="font-bold text-zinc-900 dark:text-white uppercase">{selectedSchedule.vehiclePlate} - {selectedSchedule.vehicleModel}</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">{selectedSchedule.fipeValue}</p>
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
                                            <select 
                                                value={editForm.techId} 
                                                onChange={e => setEditForm({...editForm, techId: e.target.value})} 
                                                className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500 transition-all"
                                            >
                                                <option value="">-- Selecione --</option>
                                                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
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
