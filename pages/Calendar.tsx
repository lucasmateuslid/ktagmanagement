
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { Schedule, Technician } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, User, MapPin, CalendarDays, CalendarRange, Clock, MoreHorizontal } from 'lucide-react';
import { TrackingModal } from '../components/TrackingModal';
import { useNotification } from '../contexts/NotificationContext';

type ViewMode = 'month' | 'week' | 'day';

// Configuração de Cores por Serviço
const getServiceStyle = (type: string) => {
    switch (type) {
        case 'Instalação': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' };
        case 'Manutenção': return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' };
        case 'Retirada': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' };
        default: return { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' };
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
    const techColor = tech?.color || '#cbd5e1'; 
    const serviceStyle = getServiceStyle(ev.serviceType);

    // Layout Compacto (Mês e Semana)
    if (mode === 'month' || mode === 'week') {
        return (
            <div 
                onClick={(e) => { e.stopPropagation(); onSelect(ev); }} 
                className="group relative bg-white dark:bg-zinc-800 rounded-md border-l-[3px] border-zinc-200 dark:border-zinc-700 hover:brightness-95 transition-all cursor-pointer shadow-sm overflow-hidden py-1 px-1.5 mb-1"
                style={{ borderLeftColor: techColor }}
            >
                <div className="flex justify-between items-center gap-1">
                    <span className="text-[10px] font-black text-zinc-800 dark:text-zinc-200 truncate">{ev.vehiclePlate}</span>
                    <span className="text-[8px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-1 rounded">{ev.confirmedTime}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[8px] font-bold px-1 rounded-[2px] truncate max-w-[60px] ${serviceStyle.bg} ${serviceStyle.text}`}>
                        {ev.serviceType.substring(0, 4)}.
                    </span>
                    {tech && <span className="text-[8px] text-zinc-400 truncate hidden sm:block">• {tech.name.split(' ')[0]}</span>}
                </div>
            </div>
        );
    }

    // Layout Detalhado (Dia)
    return (
        <div 
          onClick={(e) => { e.stopPropagation(); onSelect(ev); }} 
          className="relative bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all p-3 flex flex-col gap-2 group h-full"
          style={{ borderLeft: `4px solid ${techColor}` }}
        >
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-zinc-900 dark:text-white">{ev.confirmedTime}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${serviceStyle.bg} ${serviceStyle.text}`}>{ev.serviceType}</span>
                    </div>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white mt-1 uppercase">{ev.vehiclePlate}</h4>
                    <p className="text-[10px] text-zinc-500 font-medium truncate">{ev.vehicleModel}</p>
                </div>
                {tech && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0" style={{ backgroundColor: techColor }}>
                        {tech.name.charAt(0)}
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <MapPin size={10} />
                <span className="truncate">{ev.locationAddress}</span>
            </div>
        </div>
    );
};

export const Calendar = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  
  const todayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Constantes para limitar eventos
  const MAX_EVENTS_MONTH_VIEW = 3;
  const MAX_EVENTS_WEEK_VIEW = 8;

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    const [sch, techs] = await Promise.all([
        storage.getSchedules('admin', user.id), 
        storage.getTechnicians()
    ]);
    // Mostra Confirmada, Reagendada e Concluída (para histórico visual)
    setSchedules(sch.filter(s => ['Confirmada', 'Reagendada', 'Concluída'].includes(s.status)));
    setTechnicians(techs);
  };

  const handleUpdateSchedule = async (updated: Schedule) => {
      try {
          await storage.saveSchedule(updated);
          addNotification('success', 'Atualizado', 'Agendamento atualizado com sucesso.');
          loadData();
          setSelectedSchedule(updated);
      } catch (e) {
          addNotification('error', 'Erro', 'Falha ao salvar agendamento.');
      }
  };

  // Scroll to today logic
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
      // Ajusta data para evitar problemas de fuso ao converter string YYYY-MM-DD
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
    
    // Empty cells for padding
    for (let i = 0; i < firstDay; i++) {
        cells.push(<div key={`empty-${i}`} className="bg-zinc-50/30 dark:bg-zinc-900/30 border-b border-r border-zinc-200 dark:border-zinc-800 min-h-[140px]"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEvents = getEventsForDate(dateStr);
        const isToday = dateStr === todayStr;
        
        // Logic to limit items
        const visibleEvents = dayEvents.slice(0, MAX_EVENTS_MONTH_VIEW);
        const hiddenCount = dayEvents.length - MAX_EVENTS_MONTH_VIEW;

        cells.push(
            <div 
                key={d} 
                ref={isToday ? todayRef : null}
                className={`
                    border-b border-r border-zinc-200 dark:border-zinc-800 p-2 min-h-[140px] flex flex-col relative group transition-colors
                    ${isToday ? 'bg-primary-50/30 dark:bg-primary-900/10 ring-1 ring-inset ring-primary-500/30' : 'bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}
                `}
                onClick={() => goToDayView(dateStr)}
            >
                <div className="flex justify-between items-start mb-2">
                    <span className={`
                        text-xs font-black w-7 h-7 flex items-center justify-center rounded-full transition-colors
                        ${isToday ? 'bg-primary-500 text-white' : 'text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800'}
                    `}>
                        {d}
                    </span>
                    {dayEvents.length > 0 && (
                        <span className="text-[9px] font-bold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">{dayEvents.length} agend.</span>
                    )}
                </div>
                
                <div className="flex-1 w-full">
                    {visibleEvents.map(ev => (
                        <EventCard key={ev.id} ev={ev} mode="month" technicians={technicians} onSelect={setSelectedSchedule} />
                    ))}
                    
                    {/* Botão "+ X Mais" */}
                    {hiddenCount > 0 && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); goToDayView(dateStr); }}
                            className="w-full mt-1 py-1 text-[9px] font-black uppercase text-zinc-500 hover:text-primary-600 hover:bg-primary-50 dark:text-zinc-400 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 rounded transition-colors text-center flex items-center justify-center gap-1"
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
            <div className="grid grid-cols-7 min-w-[800px] lg:min-w-0 bg-zinc-50 dark:bg-zinc-950 border-t border-l border-zinc-200 dark:border-zinc-800">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-20 shadow-sm">{day}</div>
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
              <div className="grid grid-cols-7 min-w-[1000px] h-full">
                  {weekDays.map((day, idx) => {
                      const dateStr = day.toISOString().split('T')[0];
                      const events = getEventsForDate(dateStr);
                      const isToday = new Date().toDateString() === day.toDateString();
                      
                      const visibleEvents = events.slice(0, MAX_EVENTS_WEEK_VIEW);
                      const hiddenCount = events.length - MAX_EVENTS_WEEK_VIEW;

                      return (
                          <div key={idx} className="flex flex-col border-r border-zinc-200 dark:border-zinc-800 last:border-r-0 min-h-[400px]">
                              <div 
                                onClick={() => goToDayView(dateStr)}
                                className={`p-3 text-center border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${isToday ? 'bg-primary-500/10' : 'bg-zinc-50 dark:bg-zinc-950'}`}
                              >
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][idx]}</p>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-1 ${isToday ? 'bg-primary-500 text-white font-black' : 'text-zinc-900 dark:text-white font-bold'}`}>
                                      {day.getDate()}
                                  </div>
                              </div>
                              <div className="flex-1 p-2 space-y-1 bg-white dark:bg-zinc-900/50">
                                  {visibleEvents.map(ev => <EventCard key={ev.id} ev={ev} mode="week" technicians={technicians} onSelect={setSelectedSchedule} />)}
                                  {hiddenCount > 0 && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); goToDayView(dateStr); }}
                                        className="w-full mt-2 py-2 text-[10px] font-black uppercase text-zinc-500 hover:text-primary-600 hover:bg-primary-50 dark:text-zinc-400 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 rounded-lg transition-colors text-center flex items-center justify-center gap-1 border border-dashed border-zinc-200 dark:border-zinc-700"
                                    >
                                        <PlusIconCount count={hiddenCount} />
                                    </button>
                                  )}
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
                  // Filtra eventos que começam nesta hora
                  const hourEvents = events.filter(ev => parseInt(ev.confirmedTime?.split(':')[0] || '0') === hour);
                  
                  return (
                    <div key={hour} className="flex border-b border-zinc-100 dark:border-zinc-800 min-h-[100px] group">
                        <div className="w-20 flex-shrink-0 border-r border-zinc-100 dark:border-zinc-800 p-4 text-right bg-zinc-50/50 dark:bg-zinc-950/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900 transition-colors">
                            <span className="text-xs font-mono text-zinc-400 font-bold">{String(hour).padStart(2, '0')}:00</span>
                        </div>
                        <div className="flex-1 p-2 flex gap-3 overflow-x-auto no-scrollbar">
                            {hourEvents.length === 0 ? (
                                <div className="w-full h-full flex items-center">
                                    <div className="w-full border-t border-dashed border-zinc-100 dark:border-zinc-800 opacity-50"></div>
                                </div>
                            ) : (
                                hourEvents.map(ev => (
                                    <div key={ev.id} className="min-w-[200px] max-w-[300px] flex-1">
                                        <EventCard ev={ev} mode="day" technicians={technicians} onSelect={setSelectedSchedule} />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                  );
              })}
              
              {/* Botão flutuante para voltar ao mês se estiver muito perdido */}
              <button 
                onClick={() => setViewMode('month')} 
                className="absolute bottom-6 right-6 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-105 transition-all z-20 flex items-center gap-2"
              >
                <CalendarDays size={16}/> Voltar ao Mês
              </button>
          </div>
      );
  };

  const getHeaderText = () => {
      const locale = 'pt-BR';
      if (viewMode === 'day') return currentDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
      if (viewMode === 'month') return currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      return `Semana de ${currentDate.toLocaleDateString(locale)}`;
  };

  return (
    <div className="h-full pb-6 flex flex-col">
        {selectedSchedule && (
            <TrackingModal 
                schedule={selectedSchedule} 
                technicians={technicians} 
                onClose={() => setSelectedSchedule(null)} 
                onUpdate={handleUpdateSchedule}
                currentUser={user}
            />
        )}

        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6 px-1">
            <div className="w-full xl:w-auto">
                <h1 className="text-2xl md:text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Agenda Operacional</h1>
                <div className="flex flex-wrap gap-4 mt-3">
                    {/* Legenda de Técnicos Dinâmica */}
                    {technicians.slice(0, 5).map(t => (
                        <div key={t.id} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: t.color }}></div>
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">{t.name.split(' ')[0]}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full xl:w-auto">
                <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 justify-between sm:justify-start">
                    {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                        <button 
                            key={mode}
                            onClick={() => setViewMode(mode)} 
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-500'}`}
                        >
                            {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Dia'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex-1 sm:flex-none min-w-[280px]">
                    <button onClick={() => navigate('prev')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400"><ChevronLeft size={20}/></button>
                    <span className="font-black uppercase text-xs truncate flex-1 text-center text-zinc-900 dark:text-white">{getHeaderText()}</span>
                    <button onClick={() => navigate('next')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400"><ChevronRight size={20}/></button>
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 overflow-hidden flex-1 shadow-sm flex flex-col relative">
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
        <MoreHorizontal size={12} />
        <span>+ {count} agendamentos</span>
    </>
);
