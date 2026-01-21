
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Schedule, Technician } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, User, MapPin } from 'lucide-react';

export const Calendar = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const load = async () => {
        if (!user) return;
        const [sch, techs] = await Promise.all([
            storage.getSchedules('admin', user.id), // Todos veem o calendario global, mas filtrado
            storage.getTechnicians()
        ]);
        // Apenas confirmados/reagendados aparecem no calendário
        setSchedules(sch.filter(s => ['Confirmada', 'Reagendada'].includes(s.status)));
        setTechnicians(techs);
    };
    load();
  }, [user]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const serviceColors: Record<string, string> = {
      'Instalação': 'bg-blue-500 border-blue-600 text-white',
      'Manutenção': 'bg-orange-500 border-orange-600 text-white',
      'Retirada': 'bg-red-500 border-red-600 text-white'
  };

  const renderCells = () => {
    const cells = [];
    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        cells.push(<div key={`empty-${i}`} className="min-h-[120px] bg-zinc-50/30 dark:bg-zinc-900/30 border-b border-r border-zinc-100 dark:border-zinc-800"></div>);
    }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEvents = schedules.filter(s => (s.confirmedDate || s.preferredDate) === dateStr);

        cells.push(
            <div key={d} className="min-h-[120px] bg-white dark:bg-zinc-900 border-b border-r border-zinc-100 dark:border-zinc-800 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                <span className={`text-xs font-black ${dayEvents.length > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-300'}`}>{d}</span>
                <div className="mt-2 space-y-1.5">
                    {dayEvents.map(ev => {
                        const tech = technicians.find(t => t.id === ev.technicianId);
                        const colorClass = serviceColors[ev.serviceType] || 'bg-zinc-500 text-white';
                        
                        return (
                            <div key={ev.id} className={`p-1.5 rounded-lg border-l-4 shadow-sm text-[9px] cursor-pointer hover:scale-[1.02] transition-transform ${colorClass}`}>
                                <div className="font-black uppercase truncate">{ev.confirmedTime} - {ev.vehiclePlate}</div>
                                <div className="font-medium truncate opacity-90">{tech?.name || 'Sem Técnico'}</div>
                                <div className="truncate opacity-75 text-[8px] mt-0.5">{ev.requesterName}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return cells;
  };

  return (
    <div className="h-full pb-20 flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            <div>
                <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Agenda Operacional</h1>
                <div className="flex gap-3 mt-2 text-[10px] font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"/> Instalação</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500"/> Manutenção</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"/> Retirada</span>
                </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm self-end md:self-auto">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><ChevronLeft size={20}/></button>
                <span className="font-black uppercase w-32 text-center text-sm">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><ChevronRight size={20}/></button>
            </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 overflow-hidden flex-1 shadow-sm flex flex-col">
            <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 flex-1 overflow-y-auto custom-scrollbar">
                {renderCells()}
            </div>
        </div>
    </div>
  );
};
