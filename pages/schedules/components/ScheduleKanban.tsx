import React, { useState } from 'react';
import { Schedule, Technician } from '../../../types';
import { AdminScheduleCard } from './cards/AdminScheduleCard';

interface ScheduleKanbanProps {
    schedules: Schedule[];
    technicians: Technician[];
    onClick: (schedule: Schedule) => void;
    onStatusChange?: (scheduleId: string, newStatus: any) => void;
}

export const ScheduleKanban: React.FC<ScheduleKanbanProps> = ({ schedules, technicians, onClick, onStatusChange }) => {
    const columns = [
        { id: 'solicitada', title: 'Solicitada', statuses: ['Solicitada', 'Em análise', 'Em orçamento', 'Autorizada'] },
        { id: 'confirmada', title: 'Confirmada', statuses: ['Confirmada', 'Reagendada'] },
        { id: 'andamento', title: 'Em Andamento', statuses: ['Em andamento', 'Técnico no local', 'Cliente no local'] },
        { id: 'vinculo', title: 'Aguardando Vínculo', statuses: ['Aguardando Vínculo'] },
        { id: 'finalizada', title: 'Finalizada', statuses: ['Concluída'] },
    ];

    const getColumnSchedules = (statusList: string[]) => {
        return schedules.filter(s => statusList.includes(s.status));
    };

    const handleDragStart = (e: React.DragEvent, scheduleId: string) => {
        e.dataTransfer.setData('scheduleId', scheduleId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, colStatuses: string[]) => {
        e.preventDefault();
        const scheduleId = e.dataTransfer.getData('scheduleId');
        if (scheduleId && onStatusChange) {
            onStatusChange(scheduleId, colStatuses[0]);
        }
    };

    return (
        <div className="flex gap-4 overflow-x-auto pb-6 hide-scrollbar snap-x">
            {columns.map(col => {
                const colSchedules = getColumnSchedules(col.statuses);
                return (
                    <div 
                        key={col.id} 
                        className="min-w-[350px] max-w-[350px] bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl p-3 flex flex-col gap-3 snap-start border border-zinc-200 dark:border-zinc-800"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.statuses)}
                    >
                        <div className="flex items-center justify-between px-2 pt-2">
                            <h3 className="font-display font-black text-sm uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{col.title}</h3>
                            <span className="bg-white dark:bg-zinc-800 text-xs font-black px-2 py-1 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">{colSchedules.length}</span>
                        </div>
                        <div className="flex flex-col gap-3 overflow-y-auto max-h-[75vh] hide-scrollbar pb-2">
                            {colSchedules.map(schedule => (
                                <div 
                                    key={schedule.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, schedule.id)}
                                    className="cursor-move"
                                >
                                    <AdminScheduleCard 
                                        item={schedule}
                                        technicians={technicians}
                                        onClick={onClick}
                                    />
                                </div>
                            ))}
                            {colSchedules.length === 0 && (
                                <div className="text-center py-8 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl mx-1">
                                    Arraste um card para cá
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
