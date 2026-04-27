
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { Schedule, Technician, Company } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, User, MapPin, CalendarDays, Clock, MoreHorizontal, Wrench, Activity, RotateCcw, Filter, FileText, DollarSign, SearchCheck } from 'lucide-react';
import { TrackingModal } from '../components/TrackingModal';
import { useNotification } from '../contexts/NotificationContext';
import { TechnicianAvailabilityAlert } from '../components/TechnicianAvailabilityAlert';
import { whatsappService } from '../services/whatsappService';

type ViewMode = 'month' | 'week' | 'day';

// --- CONFIGURAÇÃO VISUAL (CORES) ---
const getServiceStyle = (type: string) => {
    switch (type) {
        case 'Instalação': 
            return { 
                bg: 'bg-blue-100/80 dark:bg-blue-900/40', 
                border: 'border-blue-200 dark:border-blue-700',
                text: 'text-blue-900 dark:text-blue-100',
                subtext: 'text-blue-700 dark:text-blue-300',
                icon: Wrench
            };
        case 'Manutenção': 
            return { 
                bg: 'bg-orange-100/80 dark:bg-orange-900/40', 
                border: 'border-orange-200 dark:border-orange-700',
                text: 'text-orange-900 dark:text-orange-100',
                subtext: 'text-orange-700 dark:text-orange-300',
                icon: Activity
            };
        case 'Retirada': 
            return { 
                bg: 'bg-red-100/80 dark:bg-red-900/40', 
                border: 'border-red-200 dark:border-red-700',
                text: 'text-red-900 dark:text-red-100',
                subtext: 'text-red-700 dark:text-red-300',
                icon: RotateCcw
            };
        default: 
            return { 
                bg: 'bg-zinc-100 dark:bg-zinc-800', 
                border: 'border-zinc-200 dark:border-zinc-700',
                text: 'text-zinc-900 dark:text-zinc-100',
                subtext: 'text-zinc-500 dark:text-zinc-400',
                icon: CalendarDays
            };
    }
};

// --- COMPONENTE CARD DE EVENTO ---
interface EventCardProps {
    ev: Schedule;
    mode: ViewMode;
    technicians: Technician[];
    onSelect: (s: Schedule) => void;
}

const EventCard: React.FC<EventCardProps> = ({ ev, mode, technicians, onSelect }) => {
    const tech = technicians.find(t => t.id === ev.technicianId);
    const techColor = tech?.color || '#a1a1aa'; 
    const style = getServiceStyle(ev.serviceType);
    const ServiceIcon = style.icon;

    // Layout Compacto (Visão Mês e Semana)
    if (mode === 'month' || mode === 'week') {
        const isWeek = mode === 'week';
        
        return (
            <div 
                onClick={(e) => { e.stopPropagation(); onSelect(ev); }} 
                className={`
                    group relative rounded-lg border-l-[3px] shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-center
                    ${style.bg}
                    ${isWeek ? 'p-2 mb-2 min-h-[50px]' : 'py-1.5 px-2 mb-1.5'}
                `}
                style={{ borderLeftColor: techColor }}
            >
                {/* Header: Placa e Hora */}
                <div className="flex justify-between items-center gap-1 mb-0.5">
                    <span className={`font-black truncate ${isWeek ? 'text-xs' : 'text-[10px]'} ${style.text}`}>
                        {ev.vehiclePlate}
                    </span>
                    <span className={`font-mono font-bold px-1.5 rounded ${style.border} bg-white/50 dark:bg-black/20 ${style.subtext} ${isWeek ? 'text-[10px]' : 'text-[9px]'}`}>
                        {ev.confirmedTime}
                    </span>
                </div>

                {/* Body: Serviço e Modelo (Modelo só aparece na semana) */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.subtext.includes('blue') ? 'bg-blue-500' : style.subtext.includes('orange') ? 'bg-orange-500' : 'bg-red-500'}`} />
                        <span className={`font-bold truncate ${style.subtext} ${isWeek ? 'text-[9px]' : 'text-[8px]'}`}>
                            {ev.serviceType}
                        </span>
                    </div>
                    
                    {isWeek && (
                        <span className={`text-[9px] font-medium truncate opacity-70 max-w-[50%] text-right ${style.text}`}>
                            {ev.vehicleModel.split(' ')[0]}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // Layout Detalhado (Apenas Visão Dia - Cards Horizontais)
    return (
        <div 
          onClick={(e) => { e.stopPropagation(); onSelect(ev); }} 
          className={`relative rounded-2xl shadow-sm border cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all p-4 flex flex-col justify-between h-full min-w-[280px] ${style.bg} ${style.border}`}
        >
            {/* Faixa lateral do técnico */}
            <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full" style={{ backgroundColor: techColor }} />

            <div className="pl-3">
                {/* Header: Hora e Técnico */}
                <div className="flex justify-between items-start mb-3">
                    <span className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-white/80 dark:bg-black/20 backdrop-blur-sm ${style.text} shadow-sm`}>
                        {ev.confirmedTime}
                    </span>
                    
                    {tech && (
                        <div className="flex items-center gap-2 pl-2 pr-1 py-1 bg-white/60 dark:bg-black/20 rounded-full border border-white/50 dark:border-white/10 backdrop-blur-sm">
                            <span className={`text-[9px] font-bold uppercase truncate max-w-[70px] ${style.text}`}>{tech.name.split(' ')[0]}</span>
                            <div 
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-sm shrink-0 border border-white/20" 
                                style={{ backgroundColor: techColor }}
                                title={tech.name}
                            >
                                {tech.name.charAt(0)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Principal */}
                <div className="space-y-1 mb-2">
                    <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider ${style.subtext}`}>
                        <div className={`p-1 rounded-md bg-white/50 dark:bg-black/10`}>
                            <ServiceIcon size={10} /> 
                        </div>
                        {ev.serviceType}
                    </div>
                    <h4 className={`text-2xl font-display font-black uppercase tracking-tighter leading-none ${style.text}`}>{ev.vehiclePlate}</h4>
                    <div className="flex items-center justify-between gap-2">
                        <p className={`text-[10px] font-bold uppercase truncate opacity-80 ${style.text}`}>{ev.vehicleModel}</p>
                        {ev.fipeValue && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/40 dark:bg-black/10 rounded border border-white/20">
                                <DollarSign size={8} className={style.subtext} />
                                <span className={`text-[8px] font-black ${style.subtext}`}>{ev.fipeValue}</span>
                            </div>
                        )}
                    </div>
                    
                    {/* Novos Detalhes: Cliente e Notas */}
                    <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                            <User size={10} className="text-zinc-400" />
                            <span className={`text-[10px] font-bold truncate ${style.text}`}>
                                {ev.clientName || ev.requesterName}
                            </span>
                        </div>
                        {ev.notes && (
                            <div className="flex items-start gap-1.5">
                                <FileText size={10} className="text-zinc-400 mt-0.5 shrink-0" />
                                <span className={`text-[9px] font-medium line-clamp-2 italic opacity-70 ${style.text}`}>
                                    {ev.notes}
                                </span>
                            </div>
                        )}
                        {ev.status === 'Em análise' && (
                            <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-white/20">
                                <SearchCheck size={10} className="text-amber-600 dark:text-amber-400" />
                                <span className={`text-[9px] font-black uppercase tracking-widest ${style.subtext}`}>
                                    Análise: {ev.history.slice().reverse().find(h => h.action === 'Verificando' || h.action === 'Assumiu' || h.statusSnapshot === 'Em análise')?.actionBy || '--'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Footer: Endereço */}
            <div className={`flex items-start gap-2 text-[9px] pt-3 border-t ${style.border} ${style.subtext} pl-3`}>
                <MapPin size={12} className="shrink-0 mt-0.5" />
                <span className="font-medium leading-tight line-clamp-2">{ev.locationAddress}</span>
            </div>
        </div>
    );
};

export const Calendar = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  
  const todayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const MAX_EVENTS_MONTH_VIEW = 4;

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    const techs = await storage.getTechnicians();
    let queryId = user.id;
    if (user.role === 'technician' || user.role === 'admin_tecnico') {
        const tech = techs.find(t => t.email?.toLowerCase() === user.email.toLowerCase());
        if (tech) queryId = tech.id;
    }

    const [sch, comps] = await Promise.all([
        storage.getSchedules((user.role === 'admin' || user.role === 'moderator' || user.role === 'admin_tecnico') ? 'admin' : user.role || 'user', queryId), 
        storage.getCompanies()
    ]);
    setSchedules(sch.filter(s => ['Confirmada', 'Reagendada', 'Concluída'].includes(s.status)));
    setTechnicians(techs);
    setCompanies(comps);
  };

  const handleUpdateSchedule = async (updated: Schedule) => {
      try {
          const previousSchedule = schedules.find(s => s.id === updated.id);
          const statusChanged = previousSchedule && previousSchedule.status !== updated.status;
          
          await storage.saveSchedule(updated);
          addNotification('success', 'Atualizado', 'Agendamento atualizado com sucesso.');
          
          if (statusChanged && updated.clientPhone) {
              const msg = whatsappService.getScheduleStatusMessage(
                  updated.clientName?.split(' ')[0] || updated.requesterName.split(' ')[0], 
                  updated.vehiclePlate, 
                  updated.status,
                  updated.confirmedDate ? `${updated.confirmedDate.split('-').reverse().join('/')} às ${updated.confirmedTime}` : undefined
              );
              whatsappService.sendMessage(updated.clientPhone, msg);
          }
          
          loadData();
          setSelectedSchedule(updated);
      } catch (e) {
          addNotification('error', 'Erro', 'Falha ao salvar agendamento.');
      }
  };

  const handleDeleteSchedule = async (id: string) => {
      try {
          await storage.deleteSchedule(id);
          addNotification('success', 'Excluído', 'Agendamento removido com sucesso.');
          loadData();
          setSelectedSchedule(null);
      } catch (e) {
          addNotification('error', 'Erro', 'Falha ao excluir agendamento.');
      }
  };

  useEffect(() => {
    if (viewMode === 'month' && todayRef.current && containerRef.current) {
        setTimeout(() => {
            todayRef.current?.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center', 
                inline: 'center' 
            });
        }, 300);
    }
  }, [viewMode, currentDate]);

  const navigate = (direction: 'prev' | 'next') => {
      const newDate = new Date(currentDate);
      if (viewMode === 'month') {
          newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
      } else if (viewMode === 'week') {
          newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
      } else {
          newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
      }
      setCurrentDate(newDate);
  };

  const goToDayView = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const newDate = new Date(y, m - 1, d);
      setCurrentDate(newDate);
      setViewMode('day');
  };

  const getEventsForDate = (dateStr: string) => {
      return schedules.filter(s => (s.confirmedDate || s.preferredDate) === dateStr)
        .sort((a, b) => (a.confirmedTime || '').localeCompare(b.confirmedTime || ''));
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const cells = [];
    
    for (let i = 0; i < firstDay; i++) {
        cells.push(<div key={`empty-${i}`} className="bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-r border-zinc-100 dark:border-zinc-800 min-h-[140px]"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEvents = getEventsForDate(dateStr);
        const isToday = dateStr === todayStr;
        
        const visibleEvents = dayEvents.slice(0, MAX_EVENTS_MONTH_VIEW);
        const hiddenCount = dayEvents.length - MAX_EVENTS_MONTH_VIEW;

        cells.push(
            <div 
                key={d} 
                ref={isToday ? todayRef : null}
                className={`
                    border-b border-r border-zinc-100 dark:border-zinc-800 p-1 sm:p-2 min-h-[100px] sm:min-h-[160px] flex flex-col relative group transition-colors
                    ${isToday ? 'bg-white dark:bg-zinc-900 ring-2 ring-inset ring-primary-500 z-10' : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/80'}
                `}
                onClick={() => goToDayView(dateStr)}
            >
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                    <span className={`
                        text-[10px] sm:text-xs font-black w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg sm:rounded-xl transition-colors
                        ${isToday ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800'}
                    `}>
                        {d}
                    </span>
                    {dayEvents.length > 0 && (
                        <span className="text-[8px] sm:text-[9px] font-bold text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg border border-zinc-100 dark:border-zinc-700">
                            {dayEvents.length}
                        </span>
                    )}
                </div>
                
                <div className="flex-1 w-full flex flex-col gap-1">
                    {visibleEvents.map(ev => (
                        <EventCard key={ev.id} ev={ev} mode="month" technicians={technicians} onSelect={setSelectedSchedule} />
                    ))}
                    
                    {hiddenCount > 0 && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); goToDayView(dateStr); }}
                            className="w-full mt-1 py-1 text-[9px] font-black uppercase text-zinc-400 hover:text-primary-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-colors text-center flex items-center justify-center gap-1"
                        >
                            <PlusIconCount count={hiddenCount} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-zinc-950">
            <div className="grid grid-cols-7 min-w-[800px] lg:min-w-0 bg-zinc-50 dark:bg-zinc-950 border-t border-l border-zinc-100 dark:border-zinc-800">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map(day => (
                    <div key={day} className="py-4 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-20">{day}</div>
                ))}
                {cells}
            </div>
        </div>
    );
  };

  const renderWeekView = () => {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const weekDays = [];
      for(let i=0; i<7; i++) {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          weekDays.push(d);
      }

      return (
          <div className="flex-1 overflow-auto custom-scrollbar">
              <div className="grid grid-cols-7 min-w-[800px] lg:min-w-[1200px] h-full">
                  {weekDays.map((day, idx) => {
                      const dateStr = day.toISOString().split('T')[0];
                      const events = getEventsForDate(dateStr);
                      const isToday = new Date().toDateString() === day.toDateString();
                      
                      return (
                          <div key={idx} className="flex flex-col border-r border-zinc-100 dark:border-zinc-800 last:border-r-0 min-h-[400px] sm:min-h-[600px]">
                              <div 
                                onClick={() => goToDayView(dateStr)}
                                className={`p-2 sm:p-4 text-center border-b border-zinc-100 dark:border-zinc-800 cursor-pointer transition-colors sticky top-0 z-10 ${isToday ? 'bg-primary-500/5 backdrop-blur-md' : 'bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md'}`}
                              >
                                  <p className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-400'}`}>
                                      {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][idx]}
                                  </p>
                                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mt-1 sm:mt-2 text-sm sm:text-lg ${isToday ? 'bg-primary-500 text-white font-black shadow-lg shadow-primary-500/30' : 'text-zinc-700 dark:text-white font-bold bg-zinc-100 dark:bg-zinc-800'}`}>
                                      {day.getDate()}
                                  </div>
                              </div>
                              <div className="flex-1 p-1 sm:p-2 bg-zinc-50/50 dark:bg-zinc-950/50">
                                  {events.map(ev => <EventCard key={ev.id} ev={ev} mode="week" technicians={technicians} onSelect={setSelectedSchedule} />)}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const renderDayView = () => {
      const dateStr = currentDate.toISOString().split('T')[0];
      const events = getEventsForDate(dateStr);
      const hours = Array.from({length: 14}, (_, i) => i + 7); // 07:00 to 20:00

      return (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900 relative">
              {hours.map(hour => {
                  const hourEvents = events.filter(ev => parseInt(ev.confirmedTime?.split(':')[0] || '0') === hour);
                  
                  return (
                    <div key={hour} className="flex border-b border-zinc-100 dark:border-zinc-800 min-h-[160px] group">
                        <div className="w-20 flex-shrink-0 border-r border-zinc-100 dark:border-zinc-800 p-4 text-right bg-zinc-50/30 dark:bg-zinc-950/20">
                            <span className="text-sm font-mono text-zinc-400 font-bold">{String(hour).padStart(2, '0')}:00</span>
                        </div>
                        <div className="flex-1 p-4 flex gap-4 overflow-x-auto no-scrollbar items-start">
                            {hourEvents.length === 0 ? (
                                <div className="w-full h-full flex items-center">
                                    <div className="w-full border-t-2 border-dashed border-zinc-100 dark:border-zinc-800/50"></div>
                                </div>
                            ) : (
                                hourEvents.map(ev => (
                                    <div key={ev.id} className="min-w-[300px] h-full">
                                        <EventCard ev={ev} mode="day" technicians={technicians} onSelect={setSelectedSchedule} />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                  );
              })}
              
              <button 
                onClick={() => setViewMode('month')} 
                className="absolute bottom-8 right-8 bg-zinc-900 dark:bg-white text-white dark:text-black px-8 py-4 rounded-full font-black uppercase text-xs tracking-widest shadow-2xl hover:scale-105 transition-all z-20 flex items-center gap-3"
              >
                <CalendarDays size={18}/> Voltar ao Mês
              </button>
          </div>
      );
  };

  const getHeaderText = () => {
      const locale = 'pt-BR';
      const optionsMonth = { month: 'long', year: 'numeric' } as const;
      const optionsDay = { weekday: 'long', day: 'numeric', month: 'long' } as const;

      if (viewMode === 'day') return currentDate.toLocaleDateString(locale, optionsDay);
      if (viewMode === 'month') return currentDate.toLocaleDateString(locale, optionsMonth);
      
      // Week Logic
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getDate()} - ${end.toLocaleDateString(locale, optionsDay)}`;
  };

  return (
    <div className="h-full pb-6 flex flex-col">
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

        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 px-2">
            <div className="w-full xl:w-auto">
                <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Agenda Operacional</h1>
                <div className="flex flex-wrap gap-4 mt-4">
                    {/* Legenda de Serviços */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                        <Wrench size={12} className="text-blue-500" />
                        <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase">Instalação</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800">
                        <Activity size={12} className="text-orange-500" />
                        <span className="text-[10px] font-black text-orange-700 dark:text-orange-300 uppercase">Manutenção</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
                        <RotateCcw size={12} className="text-red-500" />
                        <span className="text-[10px] font-black text-red-700 dark:text-red-300 uppercase">Retirada</span>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full xl:w-auto">
                <div className="bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl flex gap-1 justify-between sm:justify-start">
                    {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                        <button 
                            key={mode}
                            onClick={() => setViewMode(mode)} 
                            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                        >
                            {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Dia'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex-1 sm:flex-none min-w-[300px]">
                    <button onClick={() => navigate('prev')} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"><ChevronLeft size={20}/></button>
                    <span className="font-black uppercase text-sm truncate flex-1 text-center text-zinc-900 dark:text-white tracking-tight">{getHeaderText()}</span>
                    <button onClick={() => navigate('next')} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"><ChevronRight size={20}/></button>
                </div>
            </div>
        </div>

        <TechnicianAvailabilityAlert />

        <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 overflow-hidden flex-1 shadow-sm flex flex-col relative">
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'day' && renderDayView()}
        </div>
    </div>
  );
};

// Componente Auxiliar para o ícone de +X
const PlusIconCount = ({ count }: { count: number }) => (
    <>
        <MoreHorizontal size={14} />
        <span className="font-bold tracking-wide">Ver +{count}</span>
    </>
);
