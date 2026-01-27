
import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Schedule, Technician, ScheduleStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { TrackingModal } from '../components/TrackingModal';
import { 
  LayoutGrid, Timer, Copy, Maximize2, UserCircle2, User, Wrench, 
  Calendar, MapPin, Search, Filter, Plus, CheckCircle2, 
  AlertCircle, XCircle, Clock, ChevronRight, ClipboardList, Check,
  TrendingUp, Activity, RotateCcw, ClipboardCheck, Wallet, DollarSign,
  AlertTriangle, ArrowRight, Map as MapIcon, History, Phone, FileText, FileSpreadsheet, SearchCheck,
  ChevronLeft, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- COMPONENTES AUXILIARES ---

const WaitTimer = ({ startTime }: { startTime: number }) => {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Math.floor((Date.now() - startTime) / 60000);
      if (diff < 60) setElapsed(`${diff}m ${Math.floor((Date.now() - startTime) / 1000) % 60}s`);
      else if (diff < 1440) setElapsed(`${Math.floor(diff/60)}h ${diff%60}m`);
      else setElapsed(`${Math.floor(diff/1440)}d`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [startTime]);
  return <>{elapsed}</>;
};

const UserStepper = ({ status }: { status: string }) => {
  const steps = [
      { id: 'Solicitada', label: 'Solicitado' },
      { id: 'Em análise', label: 'Análise' },
      { id: 'Confirmada', label: 'Agendado' },
      { id: 'Concluída', label: 'Concluído' }
  ];

  let activeIndex = 0;
  if (status === 'Solicitada') activeIndex = 0;
  else if (['Em análise', 'Em orçamento'].includes(status)) activeIndex = 1;
  else if (['Autorizada', 'Confirmada', 'Reagendada', 'Técnico no local'].includes(status)) activeIndex = 2;
  else if (status === 'Concluída') activeIndex = 3;
  else if (status === 'Cancelada') activeIndex = -1;

  if (status === 'Cancelada') {
      return (
          <div className="w-full bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100 dark:border-red-900/20 flex items-center justify-center gap-2 mt-4">
              <XCircle size={16} className="text-red-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Cancelada</span>
          </div>
      );
  }

  return (
      <div className="relative w-full mt-8 mb-4 px-4">
          {/* Linha de fundo cinza contínua - Ajustado top-4 para alinhar com centro do circulo h-8 (32px) */}
          <div className="absolute top-4 left-0 w-full h-[3px] bg-zinc-100 dark:bg-zinc-800 -translate-y-1/2 rounded-full z-0"></div>
          
          <div className="flex justify-between relative z-10 w-full">
              {steps.map((step, index) => {
                  const isCompleted = index <= activeIndex;
                  return (
                      <div key={step.id} className="flex flex-col items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-[4px] transition-all duration-300 ${
                              isCompleted 
                              ? 'bg-emerald-500 border-emerald-100 dark:border-emerald-900/30 text-white shadow-lg shadow-emerald-500/20' 
                              : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-300'
                          }`}>
                              {isCompleted && <Check size={14} strokeWidth={4} />}
                          </div>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>
                              {step.label}
                          </span>
                      </div>
                  );
              })}
          </div>
      </div>
  );
};

export const Schedules = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Controle de Período (Admin)
  const [viewDate, setViewDate] = useState(new Date());

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('active'); // Para usuários
  const [adminTab, setAdminTab] = useState<'pendentes' | 'agendados' | 'historico'>('pendentes'); // Para Admins
  const [showMyRequests, setShowMyRequests] = useState(false); // Novo filtro "Minhas Solicitações" para admin
  
  // Filtros Dropdown (Admins)
  const [filterTech, setFilterTech] = useState('Todos Técnicos');
  const [filterService, setFilterService] = useState('Todos Serviços');
  const [filterStatusDropdown, setFilterStatusDropdown] = useState('Todos Status');

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

  const handleNavigateMonth = (direction: 'prev' | 'next') => {
      const newDate = new Date(viewDate);
      newDate.setMonth(viewDate.getMonth() + (direction === 'next' ? 1 : -1));
      setViewDate(newDate);
  };

  const isPrivileged = user?.role === 'admin' || user?.role === 'moderator';

  // --- LÓGICA DE DADOS E INDICADORES (ADMIN) ---
  const dashboardData = useMemo(() => {
      if (!isPrivileged) return null;

      const currentMonth = viewDate.getMonth();
      const currentYear = viewDate.getFullYear();

      // Filtra agendamentos do mês SELECIONADO no topo
      const monthSchedules = schedules.filter(s => {
          // Usa data confirmada, preferida ou criação
          const dateStr = s.confirmedDate || s.preferredDate;
          let d;
          if (dateStr) {
             d = new Date(dateStr + 'T12:00:00');
          } else {
             d = new Date(s.createdAt);
          }
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      // Contadores
      const total = monthSchedules.length;
      const scheduled = monthSchedules.filter(s => ['Confirmada', 'Reagendada', 'Técnico no local', 'Autorizada'].includes(s.status)).length;
      const completed = monthSchedules.filter(s => s.status === 'Concluída').length;
      const canceled = monthSchedules.filter(s => s.status === 'Cancelada').length;

      // Tipos
      const installation = monthSchedules.filter(s => s.serviceType === 'Instalação').length;
      const maintenance = monthSchedules.filter(s => s.serviceType === 'Manutenção').length;
      const removal = monthSchedules.filter(s => s.serviceType === 'Retirada').length;
      const inspection = monthSchedules.filter(s => s.serviceType === 'Vistoria').length;

      // Financeiro
      let totalRevenue = 0;
      let totalDisplacement = 0;
      const byTech: Record<string, number> = {};
      const byService: Record<string, number> = {};

      monthSchedules.forEach(s => {
          // Considera apenas serviços que geram receita (Concluídos ou Agendados firmes)
          if (['Concluída', 'Confirmada', 'Reagendada', 'Técnico no local'].includes(s.status)) {
              const tech = technicians.find(t => t.id === s.technicianId);
              let serviceCost = 0;
              
              if (tech && tech.serviceRates) {
                  if (s.serviceType === 'Instalação') serviceCost = tech.serviceRates.installation || 0;
                  else if (s.serviceType === 'Manutenção') serviceCost = tech.serviceRates.maintenance || 0;
                  else if (s.serviceType === 'Retirada') serviceCost = tech.serviceRates.removal || 0;
                  else if (s.serviceType === 'Vistoria') serviceCost = tech.serviceRates.inspection || 0;
              }

              // Adiciona valor de deslocamento se houver
              const dispCost = s.displacementValue || 0;
              const finalCost = serviceCost + dispCost;

              totalRevenue += finalCost;
              totalDisplacement += dispCost;

              // Agrupamento por Técnico
              const techName = tech ? tech.name : 'Não Atribuído';
              byTech[techName] = (byTech[techName] || 0) + finalCost;

              // Agrupamento por Serviço
              byService[s.serviceType] = (byService[s.serviceType] || 0) + finalCost;
          }
      });

      return {
          total, scheduled, completed, canceled,
          installation, maintenance, removal, inspection,
          totalRevenue, totalDisplacement,
          byTech: Object.entries(byTech).sort((a, b) => b[1] - a[1]).slice(0, 4),
          byService: Object.entries(byService).sort((a, b) => b[1] - a[1]).slice(0, 3)
      };
  }, [schedules, technicians, isPrivileged, viewDate]);

  // --- FILTRO DE LISTA ---
  const filteredList = useMemo(() => {
      let filtered = schedules;

      // Filtro de Texto
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          filtered = filtered.filter(s => 
              s.vehiclePlate.toLowerCase().includes(lower) || 
              s.vehicleModel.toLowerCase().includes(lower) ||
              s.requesterName.toLowerCase().includes(lower) ||
              s.clientName?.toLowerCase().includes(lower) ||
              s.locationAddress.toLowerCase().includes(lower)
          );
      }

      if (isPrivileged) {
          // Filtro "Minhas Solicitações" (Sobrepõe abas se ativo)
          if (showMyRequests) {
              filtered = filtered.filter(s => s.requesterId === user?.id || s.history.some(h => h.actionBy === user?.name));
          } else {
              // Lógica Admin (Abas)
              if (adminTab === 'pendentes') {
                  filtered = filtered.filter(s => ['Solicitada', 'Em análise', 'Em orçamento', 'Autorizada'].includes(s.status));
              } else if (adminTab === 'agendados') {
                  filtered = filtered.filter(s => ['Confirmada', 'Reagendada', 'Técnico no local'].includes(s.status));
                  // Filtra pelo mês da viewDate no modo agendados
                  filtered = filtered.filter(s => {
                      const d = new Date(s.confirmedDate || s.preferredDate + 'T12:00:00');
                      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
                  });
              } else if (adminTab === 'historico') {
                  filtered = filtered.filter(s => ['Concluída', 'Cancelada'].includes(s.status));
                  // Filtra pelo mês da viewDate
                  filtered = filtered.filter(s => {
                      const d = s.createdAt ? new Date(s.createdAt) : new Date();
                      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
                  });
              }
          }

          // Filtros Dropdown (Adicionais)
          if (filterService !== 'Todos Serviços') {
              filtered = filtered.filter(s => s.serviceType === filterService);
          }
          if (filterStatusDropdown !== 'Todos Status') {
              filtered = filtered.filter(s => s.status === filterStatusDropdown);
          }
          if (filterTech !== 'Todos Técnicos') {
              if (filterTech === 'Sem Técnico') {
                  filtered = filtered.filter(s => !s.technicianId);
              } else {
                  const techId = technicians.find(t => t.name === filterTech)?.id;
                  if (techId) filtered = filtered.filter(s => s.technicianId === techId);
              }
          }

      } else {
          // Lógica Usuário
          if (statusFilter === 'active') {
              filtered = filtered.filter(s => !['Concluída', 'Cancelada'].includes(s.status));
          } else if (statusFilter === 'completed') {
              filtered = filtered.filter(s => ['Concluída', 'Cancelada'].includes(s.status));
          }
      }

      return filtered;
  }, [schedules, searchTerm, statusFilter, adminTab, isPrivileged, filterTech, filterService, filterStatusDropdown, technicians, showMyRequests, viewDate, user]);

  // Função para cores da borda e badge
  const getStatusStyle = (status: string) => {
      switch (status) {
          case 'Autorizada': return { color: '#10b981', badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30', badgeText: 'text-emerald-700 dark:text-emerald-300' };
          case 'Em orçamento': return { color: '#f59e0b', badgeBg: 'bg-amber-100 dark:bg-amber-900/30', badgeText: 'text-amber-700 dark:text-amber-400' };
          case 'Em análise': return { color: '#f59e0b', badgeBg: 'bg-amber-50 dark:bg-amber-900/10', badgeText: 'text-amber-600 dark:text-amber-400' };
          case 'Solicitada': return { color: '#a1a1aa', badgeBg: 'bg-zinc-100 dark:bg-zinc-800', badgeText: 'text-zinc-600 dark:text-zinc-400' };
          case 'Confirmada': return { color: '#06b6d4', badgeBg: 'bg-cyan-100 dark:bg-cyan-900/30', badgeText: 'text-cyan-700 dark:text-cyan-300' };
          case 'Concluída': return { color: '#14b8a6', badgeBg: 'bg-teal-100 dark:bg-teal-900/30', badgeText: 'text-teal-700 dark:text-teal-300' };
          case 'Cancelada': return { color: '#ef4444', badgeBg: 'bg-red-100 dark:bg-red-900/30', badgeText: 'text-red-700 dark:text-red-300' };
          default: return { color: '#a1a1aa', badgeBg: 'bg-zinc-100 dark:bg-zinc-800', badgeText: 'text-zinc-600' };
      }
  };

  return (
    <div className="space-y-8 pb-24 max-w-[1600px] mx-auto">
        
        {/* HEADER GERAL */}
        {isPrivileged ? (
            <div className="space-y-8">
                {/* ADMIN HEADER & DATE PICKER */}
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

                {/* DASHBOARD INDICADORES (ADMIN) */}
                {dashboardData && (
                    <div className="space-y-6">
                        {/* ROW 1: STATUS COUNTS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest z-10">Total no Mês</span>
                                <span className="text-5xl font-black text-zinc-900 dark:text-white z-10 tracking-tighter">{dashboardData.total}</span>
                                <div className="absolute right-[-10px] bottom-[-10px] opacity-5 rotate-12"><LayoutGrid size={100}/></div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest z-10">Agendadas</span>
                                <span className="text-5xl font-black text-blue-500 z-10 tracking-tighter">{dashboardData.scheduled}</span>
                                <div className="absolute right-4 bottom-4 opacity-10 text-blue-500"><Calendar size={60}/></div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest z-10">Concluídas</span>
                                <span className="text-5xl font-black text-emerald-500 z-10 tracking-tighter">{dashboardData.completed}</span>
                                <div className="absolute right-4 bottom-4 opacity-10 text-emerald-500"><CheckCircle2 size={60}/></div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest z-10">Canceladas</span>
                                <span className="text-5xl font-black text-red-500 z-10 tracking-tighter">{dashboardData.canceled}</span>
                                <div className="absolute right-4 bottom-4 opacity-10 text-red-500"><XCircle size={60}/></div>
                            </div>
                        </div>

                        {/* ROW 2: SERVICE TYPES */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-5 rounded-[24px] flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                    <Wrench size={20} strokeWidth={2.5}/>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block">Instalação</span>
                                    <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{dashboardData.installation}</span>
                                </div>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 p-5 rounded-[24px] flex items-center gap-4">
                                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                                    <Activity size={20} strokeWidth={2.5}/>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest block">Manutenção</span>
                                    <span className="text-2xl font-black text-orange-700 dark:text-orange-300">{dashboardData.maintenance}</span>
                                </div>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-5 rounded-[24px] flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                                    <RotateCcw size={20} strokeWidth={2.5}/>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest block">Retirada</span>
                                    <span className="text-2xl font-black text-red-700 dark:text-red-300">{dashboardData.removal}</span>
                                </div>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 p-5 rounded-[24px] flex items-center gap-4">
                                <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                                    <ClipboardCheck size={20} strokeWidth={2.5}/>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block">Vistoria</span>
                                    <span className="text-2xl font-black text-purple-700 dark:text-purple-300">{dashboardData.inspection}</span>
                                </div>
                            </div>
                        </div>

                        {/* ROW 3: FINANCIALS */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <div className="bg-zinc-900 text-white p-8 rounded-[32px] border border-zinc-800 shadow-xl flex flex-col justify-between relative overflow-hidden">
                                <div>
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Valor Total (Mês)</span>
                                    <h2 className="text-4xl font-display font-black mt-2 tracking-tight">R$ {dashboardData.totalRevenue.toFixed(2)}</h2>
                                    <p className="text-[10px] text-zinc-600 mt-1">{dashboardData.completed + dashboardData.scheduled} serviços contabilizados</p>
                                </div>
                                <DollarSign size={120} className="absolute -bottom-10 -right-6 text-zinc-800 opacity-50" />
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
                                <div>
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gasto Deslocamento</span>
                                    <h2 className="text-4xl font-display font-black mt-2 tracking-tight text-zinc-900 dark:text-white">R$ {dashboardData.totalDisplacement.toFixed(2)}</h2>
                                    <p className="text-[10px] text-zinc-400 mt-1">Incluído no total</p>
                                </div>
                                <MapIcon size={100} className="absolute -bottom-6 -right-6 text-zinc-100 dark:text-zinc-800" />
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-4">Por Técnico</span>
                                <div className="space-y-3">
                                    {dashboardData.byTech.map(([name, val], i) => (
                                        <div key={i} className="flex justify-between items-center text-xs border-b border-zinc-50 dark:border-zinc-800 pb-2 last:border-0">
                                            <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">{name}</span>
                                            <span className="font-mono font-black text-zinc-900 dark:text-white">R$ {val.toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {dashboardData.byTech.length === 0 && <span className="text-[10px] text-zinc-400 italic">Sem dados</span>}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-4">Por Serviço</span>
                                <div className="space-y-3">
                                    {dashboardData.byService.map(([name, val], i) => (
                                        <div key={i} className="flex justify-between items-center text-xs border-b border-zinc-50 dark:border-zinc-800 pb-2 last:border-0">
                                            <span className="font-bold text-zinc-700 dark:text-zinc-300">{name}</span>
                                            <span className="font-mono font-black text-zinc-900 dark:text-white">R$ {val.toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {dashboardData.byService.length === 0 && <span className="text-[10px] text-zinc-400 italic">Sem dados</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ) : (
            // HEADER USUÁRIO COMUM - MANTIDO
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

        {/* BARRA DE FILTROS E PESQUISA */}
        <div className="flex flex-col gap-4">
            {/* LINHA 1: Abas + Busca + Ações */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Abas Esquerda (Ocultas se 'Minhas Solicitações' estiver ativo) */}
                {!showMyRequests && (
                    <div className={`flex p-1 rounded-2xl w-full md:w-auto overflow-x-auto ${isPrivileged ? 'gap-3' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                        {isPrivileged ? (
                            <>
                                <button 
                                    onClick={() => setAdminTab('pendentes')} 
                                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${adminTab === 'pendentes' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-400 hover:text-zinc-600'}`}
                                >
                                    <AlertCircle size={14} className={adminTab === 'pendentes' ? 'text-amber-500' : ''}/> Pendentes
                                </button>
                                <button 
                                    onClick={() => setAdminTab('agendados')} 
                                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${adminTab === 'agendados' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-400 hover:text-zinc-600'}`}
                                >
                                    <Calendar size={14} className={adminTab === 'agendados' ? 'text-blue-500' : ''}/> Agendados
                                </button>
                                <button 
                                    onClick={() => setAdminTab('historico')} 
                                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${adminTab === 'historico' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-400 hover:text-zinc-600'}`}
                                >
                                    <History size={14} className={adminTab === 'historico' ? 'text-zinc-500' : ''}/> Histórico
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setStatusFilter('active')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'active' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}>Em Andamento</button>
                                <button onClick={() => setStatusFilter('completed')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'completed' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}>Histórico</button>
                            </>
                        )}
                    </div>
                )}

                {/* Busca e Ações Direita */}
                <div className="flex-1 w-full flex gap-3 justify-end">
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-zinc-400 transition-all shadow-sm" 
                        />
                    </div>
                    {isPrivileged && (
                        <div className="flex gap-2">
                            <button className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 hover:text-zinc-600 shadow-sm"><FileText size={18}/></button>
                            <button className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 hover:text-zinc-600 shadow-sm"><FileSpreadsheet size={18}/></button>
                        </div>
                    )}
                </div>
            </div>

            {/* LINHA 2: Dropdowns (Apenas Admins) */}
            {isPrivileged && (
                <div className="flex gap-3 overflow-x-auto pb-1">
                    <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="px-6 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm min-w-[180px]">
                        <option>Todos Técnicos</option>
                        <option>Sem Técnico</option>
                        {technicians.map(t => <option key={t.id}>{t.name}</option>)}
                    </select>
                    <select value={filterService} onChange={(e) => setFilterService(e.target.value)} className="px-6 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm min-w-[180px]">
                        <option>Todos Serviços</option>
                        <option>Instalação</option>
                        <option>Manutenção</option>
                        <option>Retirada</option>
                        <option>Vistoria</option>
                    </select>
                    <select value={filterStatusDropdown} onChange={(e) => setFilterStatusDropdown(e.target.value)} className="px-6 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm min-w-[180px]">
                        <option>Todos Status</option>
                        <option>Solicitada</option>
                        <option>Em análise</option>
                        <option>Em orçamento</option>
                        <option>Autorizada</option>
                        <option>Confirmada</option>
                        <option>Reagendada</option>
                        <option>Técnico no local</option>
                        <option>Concluída</option>
                        <option>Cancelada</option>
                    </select>
                </div>
            )}
        </div>

        {/* LISTA DE AGENDAMENTOS */}
        <div className={`space-y-4 ${isPrivileged ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 space-y-0' : ''}`}>
            {filteredList.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-30 gap-4">
                    <LayoutGrid size={48} className="text-zinc-400 dark:text-zinc-600"/>
                    <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Nenhuma solicitação nesta aba</span>
                </div>
            ) : (
                filteredList.map(item => {
                    // Dados do Técnico
                    const assignedTech = technicians.find(t => t.id === item.technicianId);
                    
                    // Lógica para identificar quem está analisando e Status "Em análise"
                    const isUnderAnalysis = ['Em análise', 'Em orçamento'].includes(item.status);
                    
                    // Procura no histórico quem assumiu (ação 'Assumiu' ou 'Verificando')
                    const analysisHistory = isUnderAnalysis 
                        ? [...item.history].reverse().find(h => h.action === 'Assumiu' || h.action === 'Verificando' || h.statusSnapshot === 'Em análise' || h.statusSnapshot === 'Em orçamento')
                        : null;

                    // Determina o texto e valor do Rodapé (Técnico / Analista)
                    let responsibleLabel = 'TÉCNICO';
                    let responsibleName = '-- A definir --';
                    let responsibleColor = '#e4e4e7'; // Zinco padrão

                    if (isUnderAnalysis && analysisHistory?.actionBy) {
                        responsibleLabel = 'EM ANÁLISE POR';
                        responsibleName = analysisHistory.actionBy;
                        responsibleColor = '#f59e0b'; // Amber (Analista)
                    } else if (assignedTech) {
                        responsibleLabel = 'TÉCNICO';
                        responsibleName = assignedTech.name;
                        responsibleColor = assignedTech.color || '#3b82f6'; // Cor do técnico ou azul
                    }

                    // --- ADDED VARIABLES FIX ---
                    const showAnalysisInfo = isUnderAnalysis && analysisHistory?.actionBy;
                    const techName = assignedTech ? assignedTech.name : 'A definir';
                    const techColor = assignedTech ? (assignedTech.color || '#3b82f6') : '#e4e4e7';

                    // Cálculos de Tempo e Data
                    const createdDate = new Date(item.createdAt);
                    const now = new Date();
                    const diffMs = now.getTime() - createdDate.getTime();
                    const diffHrs = Math.floor(diffMs / 3600000);
                    const diffMins = Math.floor((diffMs % 3600000) / 60000);
                    const timeElapsedStr = `${diffHrs}h ${diffMins}m`; // Ex: 18h 27m

                    const displayDate = item.confirmedDate ? new Date(item.confirmedDate).toLocaleDateString() : new Date(item.preferredDate).toLocaleDateString();
                    const displayTime = item.confirmedTime ? item.confirmedTime : item.preferredTime;
                    
                    // Style config based on status
                    const styleConfig = getStatusStyle(item.status);

                    if (isPrivileged) {
                        // --- CARD DESIGN IMAGEM (ADMIN) ---
                        return (
                            <div key={item.id} onClick={() => setSelectedSchedule(item)} className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all cursor-pointer relative group border-l-[6px] flex flex-col h-full min-h-[340px]" style={{ borderLeftColor: styleConfig.color }}>
                                {/* Header: Badge Status + Date/Time */}
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col gap-2">
                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit ${styleConfig.badgeBg} ${styleConfig.badgeText}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-zinc-400">{displayDate}</div>
                                        <div className="text-lg font-black text-zinc-900 dark:text-white leading-none">{timeElapsedStr}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-[10px] font-mono text-zinc-300 dark:text-zinc-600"># {item.id.slice(0, 2).toUpperCase()}</span>
                                    {showAnalysisInfo && (
                                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wide">
                                            Em análise por: {analysisHistory.actionBy}
                                        </span>
                                    )}
                                </div>

                                <h2 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-1">{item.vehiclePlate}</h2>
                                <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-6">{item.vehicleModel}</p>

                                <div className="space-y-4 mb-6 flex-1">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5"><User size={14} className="text-zinc-300"/></div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">SOLICITANTE:</span>
                                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">{item.requesterName}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5"><UserCircle2 size={14} className="text-zinc-300"/></div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">CLIENTE:</span>
                                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase truncate">{item.clientName || 'N/A'}</span>
                                            {item.clientPhone && <span className="text-[9px] font-mono text-zinc-400">{item.clientPhone}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5"><Wrench size={14} className="text-zinc-300"/></div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">SERVIÇO:</span>
                                            <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">{item.serviceType}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5"><MapPin size={14} className="text-zinc-300"/></div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">LOCAL:</span>
                                            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300 leading-tight line-clamp-2">{item.locationAddress}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Reformulado */}
                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex justify-between items-end">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">TÉCNICO</span>
                                        <div className="flex items-center gap-2">
                                            {/* Se não for "A definir", mostra a bolinha */}
                                            {assignedTech && (
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: techColor }} />
                                            )}
                                            <span className={`text-xs font-bold uppercase ${!assignedTech ? 'text-zinc-400 italic' : 'text-zinc-900 dark:text-white'}`}>
                                                {techName}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Exibição de Valores (Se houver técnico e taxas) */}
                                    {assignedTech && assignedTech.serviceRates && (
                                        <div className="text-right">
                                            <div className="text-[9px] font-bold text-amber-500">
                                                R$ {(item.serviceType === 'Instalação' ? assignedTech.serviceRates.installation : item.serviceType === 'Manutenção' ? assignedTech.serviceRates.maintenance : 50).toFixed(2)} 
                                                {item.displacementValue ? <span className="text-zinc-400"> + R$ {item.displacementValue}</span> : ''}
                                            </div>
                                            <div className="text-xs font-black text-zinc-900 dark:text-white">
                                                Total: R$ {((item.serviceType === 'Instalação' ? assignedTech.serviceRates.installation : item.serviceType === 'Manutenção' ? assignedTech.serviceRates.maintenance : 50) + (item.displacementValue || 0)).toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    } else {
                        // --- CARD LISTA USUÁRIO (MODIFICADO CONFORME PEDIDO) ---
                        const responsibleLabel = analysisHistory?.actionBy ? 'EM ANÁLISE POR' : 'TÉCNICO';
                        const responsibleNameUser = analysisHistory?.actionBy || (assignedTech ? assignedTech.name : 'A definir');
                        const responsibleColorUser = analysisHistory?.actionBy ? '#f59e0b' : (assignedTech?.color || '#cbd5e1');

                        // Analista Responsável (Se houver) para adicionar ao card
                        const analystName = analysisHistory?.actionBy;

                        return (
                            <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all relative overflow-hidden group">
                                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${getStatusStyle(item.status).badgeBg} ${getStatusStyle(item.status).badgeText}`}>{item.status}</span>
                                        {/* NOVO BADGE DE TEMPO DE ESPERA */}
                                        <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                                            <Clock size={12}/> {timeElapsedStr}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={(e) => handleCopyConfirmation(e, item)} className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all border border-emerald-200 dark:border-emerald-500/30" title="Copiar confirmação"><Copy size={16} /></button>
                                        <button onClick={() => setSelectedSchedule(item)} className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors border border-zinc-200 dark:border-zinc-700"><Maximize2 size={16} /></button>
                                    </div>
                                </div>
                                <div className="mb-8">
                                    <h2 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">{item.vehiclePlate}</h2>
                                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1 flex items-center gap-2">{item.vehicleModel}<span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"/><span className="text-primary-500">{item.deviceType}</span></p>
                                </div>
                                
                                {/* BLOCO DE DETALHES CINZA - COM CAMPO DE ANÁLISE ADICIONADO */}
                                <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-3xl p-6 border border-zinc-100 dark:border-zinc-800/50 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        {/* TÉCNICO */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800">
                                                <User size={16} />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Técnico Responsável</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {assignedTech && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: assignedTech.color }} />}
                                                    <p className={`text-xs font-bold uppercase truncate ${!assignedTech ? 'text-zinc-400 italic' : 'text-zinc-900 dark:text-white'}`}>
                                                        {assignedTech ? assignedTech.name : 'A definir'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* EM ANÁLISE POR (ADICIONADO) */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800">
                                                <SearchCheck size={16} />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Em Análise Por</p>
                                                <p className={`text-xs font-bold uppercase truncate ${!analystName ? 'text-zinc-400 italic' : 'text-zinc-900 dark:text-white'}`}>
                                                    {analystName || '--'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* TIPO DE SERVIÇO */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800"><Wrench size={16} /></div>
                                            <div>
                                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Tipo de Serviço</p>
                                                <p className={`text-xs font-bold uppercase truncate ${item.serviceType === 'Instalação' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>{item.serviceType}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {/* DATA E HORA */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800"><Calendar size={16} /></div>
                                            <div>
                                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Data & Hora</p>
                                                <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate">
                                                    {displayDate} {displayTime ? `às ${displayTime}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* LOCALIZAÇÃO */}
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800 shrink-0"><MapPin size={16} /></div>
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Localização</p>
                                                <p className="text-xs font-bold text-zinc-900 dark:text-white leading-tight mt-0.5 line-clamp-2" title={item.locationAddress}>{item.locationAddress}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-2"><UserStepper status={item.status} /></div>
                            </div>
                        );
                    }
                })
            )}
        </div>

        {selectedSchedule && (
            <TrackingModal 
                schedule={selectedSchedule} 
                technicians={technicians} 
                onClose={() => setSelectedSchedule(null)} 
                onUpdate={handleUpdateSchedule}
                onDelete={async (id) => {
                    if (window.confirm('Tem certeza que deseja excluir esta solicitação?')) {
                        await storage.deleteSchedule(id);
                        setSelectedSchedule(null);
                        addNotification('success', 'Excluído', 'Agendamento removido.');
                    }
                }}
                currentUser={user}
            />
        )}
    </div>
  );
};
