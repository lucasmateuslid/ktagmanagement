
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Schedule, Technician } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, User, MapPin, CalendarDays, CalendarRange, Calendar as CalendarIcon } from 'lucide-react';

type ViewMode = 'month' | 'week' | 'day';

export const Calendar = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  useEffect(() => {
    const load = async () => {
        if (!user) return;
        const [sch, techs] = await Promise.all([
            storage.getSchedules('admin', user.id), 
            storage.getTechnicians()
        ]);
        // Apenas confirmados/reagendados aparecem no calendário
        setSchedules(sch.filter(s => ['Confirmada', 'Reagendada'].includes(s.status)));
        setTechnicians(techs);
    };
    load();
  }, [user]);

  const serviceColors: Record<string, string> = {
      'Instalação': 'bg-blue-500 border-blue-600 text-white',
      'Manutenção': 'bg-orange-500 border-orange-600 text-white',
      'Retirada': 'bg-red-500 border-red-600 text-white'
  };

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

  const getEventsForDate = (dateStr: string) => {
      return schedules.filter(s => (s.confirmedDate || s.preferredDate) === dateStr);
  };

  const renderMonthView = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    
    const cells = [];
    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        cells.push(<div key={`empty-${i}`} className="min-h-[100px] md:min-h-[120px] bg-zinc-50/30 dark:bg-zinc-900/30 border-b border-r border-zinc-100 dark:border-zinc-800"></div>);
    }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEvents = getEventsForDate(dateStr);

        cells.push(
            <div key={d} className="min-h-[100px] md:min-h-[120px] bg-white dark:bg-zinc-900 border-b border-r border-zinc-100 dark:border-zinc-800 p-1.5 md:p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                <span className={`text-[10px] md:text-xs font-black ${dayEvents.length > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-300'}`}>{d}</span>
                <div className="mt-1 md:mt-2 space-y-1">
                    {dayEvents.map(ev => {
                        const tech = technicians.find(t => t.id === ev.technicianId);
                        const colorClass = serviceColors[ev.serviceType] || 'bg-zinc-500 text-white';
                        
                        return (
                            <div key={ev.id} className={`p-1 md:p-1.5 rounded-lg border-l-2 md:border-l-4 shadow-sm text-[8px] md:text-[9px] cursor-pointer hover:scale-[1.02] transition-transform ${colorClass}`}>
                                <div className="font-black uppercase truncate">{ev.confirmedTime} - {ev.vehiclePlate}</div>
                                <div className="font-medium truncate opacity-90 hidden md:block">{tech?.name || 'Sem Técnico'}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return (
        <div className="flex-1 overflow-auto custom-scrollbar">
            <div className="grid grid-cols-7 min-w-[700px] lg:min-w-0 h-full">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10">{day}</div>
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
              <div className="grid grid-cols-7 min-w-[700px] lg:min-w-0 h-full">
                  {weekDays.map((day, idx) => {
                      const dateStr = day.toISOString().split('T')[0];
                      const events = getEventsForDate(dateStr);
                      const isToday = new Date().toDateString() === day.toDateString();

                      return (
                          <div key={idx} className="flex flex-col border-r border-zinc-100 dark:border-zinc-800 last:border-r-0 h-full">
                              <div className={`p-3 text-center border-b border-zinc-100 dark:border-zinc-800 ${isToday ? 'bg-primary-500/10' : 'bg-zinc-50 dark:bg-zinc-950'}`}>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][idx]}</p>
                                  <p className={`text-lg font-black ${isToday ? 'text-primary-500' : 'text-zinc-900 dark:text-white'}`}>{day.getDate()}</p>
                              </div>
                              <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-white dark:bg-zinc-900">
                                  {events.map(ev => {
                                      const tech = technicians.find(t => t.id === ev.technicianId);
                                      const colorClass = serviceColors[ev.serviceType] || 'bg-zinc-500 text-white';
                                      return (
                                          <div key={ev.id} className={`p-2 rounded-xl shadow-sm text-[9px] cursor-pointer hover:scale-[1.02] transition-transform ${colorClass}`}>
                                              <div className="font-black uppercase">{ev.confirmedTime}</div>
                                              <div className="font-bold truncate mt-1">{ev.vehiclePlate}</div>
                                              <div className="font-medium truncate opacity-90">{tech?.name || 'Sem Técnico'}</div>
                                              <div className="mt-1 flex items-center gap-1 opacity-75 truncate"><MapPin size={8}/> {ev.locationAddress}</div>
                                          </div>
                                      );
                                  })}
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
      const events = getEventsForDate(dateStr).sort((a, b) => (a.confirmedTime || '').localeCompare(b.confirmedTime || ''));
      const hours = Array.from({length: 13}, (_, i) => i + 7); // 07:00 to 19:00

      return (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900 relative">
              {hours.map(hour => (
                  <div key={hour} className="flex border-b border-zinc-100 dark:border-zinc-800 min-h-[80px]">
                      <div className="w-14 md:w-16 flex-shrink-0 border-r border-zinc-100 dark:border-zinc-800 p-2 text-right">
                          <span className="text-[10px] md:text-xs font-mono text-zinc-400 font-bold">{String(hour).padStart(2, '0')}:00</span>
                      </div>
                      <div className="flex-1 relative p-1">
                          {/* Render events that start in this hour */}
                          {events.filter(ev => parseInt(ev.confirmedTime?.split(':')[0] || '0') === hour).map(ev => {
                              const tech = technicians.find(t => t.id === ev.technicianId);
                              const colorClass = serviceColors[ev.serviceType] || 'bg-zinc-500 text-white';
                              return (
                                  <div key={ev.id} className={`absolute left-1 right-1 md:left-2 md:right-2 p-2 rounded-xl shadow-sm text-[10px] flex justify-between items-center ${colorClass}`} style={{ top: '4px', zIndex: 10 }}>
                                      <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-black uppercase">{ev.confirmedTime}</span>
                                            <span className="font-bold uppercase truncate">{ev.vehiclePlate}</span>
                                          </div>
                                          <div className="opacity-90 mt-0.5 truncate">{tech?.name} • {ev.requesterName}</div>
                                      </div>
                                      <div className="text-[9px] font-bold opacity-80 uppercase tracking-widest border border-white/20 px-2 py-1 rounded hidden sm:block">{ev.serviceType}</div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              ))}
          </div>
      );
  };

  const getHeaderText = () => {
      if (viewMode === 'day') return currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (viewMode === 'month') return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return `Semana de ${currentDate.toLocaleDateString('pt-BR')}`;
  };

  return (
    <div className="h-full pb-20 flex flex-col">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
            <div className="w-full xl:w-auto">
                <h1 className="text-2xl md:text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Agenda Operacional</h1>
                <div className="flex flex-wrap gap-3 mt-3 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"/> Instalação</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500"/> Manutenção</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"/> Retirada</span>
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

                <div className="flex items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex-1 sm:flex-none">
                    <button onClick={() => navigate('prev')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><ChevronLeft size={20}/></button>
                    <span className="font-black uppercase text-xs truncate flex-1 text-center">{getHeaderText()}</span>
                    <button onClick={() => navigate('next')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><ChevronRight size={20}/></button>
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 overflow-hidden flex-1 shadow-sm flex flex-col">
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'day' && renderDayView()}
        </div>
    </div>
  );
};
