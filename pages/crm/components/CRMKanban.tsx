import React, { useState } from 'react';
import { Schedule, Technician } from '../../../types';
import { CRMKanbanCard } from './CRMKanbanCard';
import { storage } from '../../../services/storage';
import { useNotification } from '../../../contexts/NotificationContext';
import { useAuth } from '../../../contexts/AuthContext';

interface CRMKanbanProps {
    schedules: Schedule[];
    technicians: Technician[];
    onCardClick?: (schedule: Schedule) => void;
}

export const CRMKanban: React.FC<CRMKanbanProps> = ({ schedules, technicians, onCardClick }) => {
    const { user } = useAuth();
    const { addNotification } = useNotification();
    
    // Modal states
    const [actionScheduleId, setActionScheduleId] = useState<string | null>(null);
    const [targetStatus, setTargetStatus] = useState<string | null>(null);
    const [modalType, setModalType] = useState<string | null>(null); // 'reason', 'confirm_arrive', 'confirm_time', 'bind_equip', 'finish'

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
        if (!scheduleId) return;

        const schedule = schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        const newTargetStatus = colStatuses[0]; // Pegamos o status primario da coluna
        
        // Verifica transição e abre o modal apropriado
        if (['Solicitada', 'Em análise', 'Em orçamento', 'Autorizada'].includes(newTargetStatus)) {
            // Voltando/movendo para solicitada -> Pede motivo
            setActionScheduleId(scheduleId);
            setTargetStatus(newTargetStatus);
            setModalType('reason');
        } else if (newTargetStatus === 'Confirmada') {
            // Pede técnico e horário
            setActionScheduleId(scheduleId);
            setTargetStatus(newTargetStatus);
            setModalType('confirm_time');
        } else if (newTargetStatus === 'Em andamento') {
            // Confirma a chegada do técnico
            setActionScheduleId(scheduleId);
            setTargetStatus('Técnico no local'); // status mais ajustado
            setModalType('confirm_arrive');
        } else if (newTargetStatus === 'Aguardando Vínculo') {
            // Pede o equipamento
            setActionScheduleId(scheduleId);
            setTargetStatus(newTargetStatus);
            setModalType('bind_equip');
        } else if (newTargetStatus === 'Concluída') {
            // Confirma fechamento
            setActionScheduleId(scheduleId);
            setTargetStatus(newTargetStatus);
            setModalType('finish');
        } else {
            // Direto
            updateStatus(scheduleId, newTargetStatus);
        }
    };

    const updateStatus = async (scheduleId: string, newStatus: string, details?: any) => {
        const schedule = schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        try {
             const newHistory = [...(schedule.history || [])];
             newHistory.push({
                 action: 'Alteração via Kanban CRM',
                 timestamp: Date.now(),
                 actionBy: user?.name || 'Sistema',
                 statusSnapshot: newStatus,
                 details: details?.reason || details?.note || ''
             } as any);

             const updated = { 
                 ...schedule, 
                 status: newStatus as any, 
                 history: newHistory,
                 ...details // Espalha técnico, data, imei etc que vier do modal
             };
             await storage.saveSchedule(updated);
             addNotification('success', 'Card Movido', 'Status atualizado com sucesso.');
        } catch(e) {
             addNotification('error', 'Erro', 'Falha ao atualizar o card.');
        } finally {
             closeModal();
        }
    };

    const closeModal = () => {
        setActionScheduleId(null);
        setTargetStatus(null);
        setModalType(null);
    };

    const handleActionTrigger = (scheduleId: string, actionType: string) => {
        const schedule = schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        if (actionType === 'confirm') {
            setActionScheduleId(scheduleId);
            setTargetStatus('Confirmada');
            setModalType('confirm_time');
        } else if (actionType === 'cancel') {
            setActionScheduleId(scheduleId);
            setTargetStatus('Cancelada');
            setModalType('reason');
        } else if (actionType === 'frustrate') {
            setActionScheduleId(scheduleId);
            setTargetStatus('Frustrada');
            setModalType('reason');
        } else if (actionType === 'finish') {
            setActionScheduleId(scheduleId);
            setTargetStatus('Concluída');
            setModalType('finish');
        }
    };

    return (
        <div className="flex gap-4 h-full overflow-x-auto pb-4 hide-scrollbar snap-x">
            {columns.map(col => {
                const colSchedules = getColumnSchedules(col.statuses);
                return (
                    <div 
                        key={col.id} 
                        className="min-w-[320px] max-w-[320px] bg-zinc-100 dark:bg-zinc-800/50 rounded-3xl p-3 flex flex-col gap-3 snap-start border border-zinc-200 dark:border-zinc-800 h-full"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.statuses)}
                    >
                        <div className="flex items-center justify-between px-2 pt-2 shrink-0">
                            <h3 className="font-display font-black text-sm uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{col.title}</h3>
                            <span className="bg-white dark:bg-zinc-800 text-xs font-black px-2 py-1 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">{colSchedules.length}</span>
                        </div>
                        <div className="flex flex-col gap-3 overflow-y-auto flex-1 hide-scrollbar pb-2">
                            {colSchedules.map(schedule => (
                                <div 
                                    key={schedule.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, schedule.id)}
                                    className="cursor-move"
                                    onClick={() => onCardClick?.(schedule)}
                                >
                                    <CRMKanbanCard 
                                        item={schedule}
                                        technicians={technicians}
                                        onUpdateValue={(val) => {
                                            storage.saveSchedule({...schedule, adhesionValue: val});
                                        }}
                                        onAction={(action) => handleActionTrigger(schedule.id, action)}
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

            {/* MODALS RENDER (Pode colocar em um unico componente ActionModal depois) */}
            {modalType && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                        <h2 className="text-xl font-display font-black uppercase text-zinc-900 dark:text-white tracking-tight mb-4">
                            {modalType === 'reason' && 'Motivo da Retenção'}
                            {modalType === 'confirm_arrive' && 'Confirmar Chegada do Técnico'}
                            {modalType === 'confirm_time' && 'Confirmar Técnico e Horário'}
                            {modalType === 'bind_equip' && 'Vincular Equipamentos'}
                            {modalType === 'finish' && 'Concluir O.S.'}
                        </h2>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const details: any = {};
                            
                            if (modalType === 'reason') details.reason = formData.get('reason');
                            if (modalType === 'confirm_time') {
                                details.technicianId = formData.get('tech');
                                details.confirmedDate = formData.get('date');
                                details.confirmedTime = formData.get('time');
                            }
                            if (modalType === 'bind_equip') {
                                details.installedImei = formData.get('imei');
                                details.installedTagImei = formData.get('tag');
                            }

                            updateStatus(actionScheduleId!, targetStatus!, details);
                        }}>
                            {modalType === 'reason' && (
                                <textarea name="reason" required className="w-full bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl border-none text-sm dark:text-white" rows={3} placeholder="Descreva o motivo..."></textarea>
                            )}

                            {modalType === 'confirm_arrive' && (
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">Tem certeza que deseja confirmar que o técnico chegou ao local para iniciar o atendimento?</p>
                            )}

                            {modalType === 'confirm_time' && (
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <label className="block mb-1 text-xs font-bold uppercase text-zinc-500">Técnico</label>
                                        <select name="tech" required className="w-full bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl">
                                            <option value="">Selecione...</option>
                                            {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block mb-1 text-xs font-bold uppercase text-zinc-500">Data</label>
                                            <input type="date" name="date" required className="w-full bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl dark:text-white [color-scheme:dark]" />
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-xs font-bold uppercase text-zinc-500">Horário</label>
                                            <input type="time" name="time" required className="w-full bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl dark:text-white [color-scheme:dark]" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {modalType === 'bind_equip' && (
                                <div className="space-y-4">
                                    <input type="text" name="imei" placeholder="IMEI do Rastreador" className="w-full bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl dark:text-white" />
                                    <input type="text" name="tag" placeholder="IMEI da Tag (opcional)" className="w-full bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl dark:text-white" />
                                </div>
                            )}

                            {modalType === 'finish' && (
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">Deseja realmente dar baixa nesta ordem de serviço como concluída?</p>
                            )}

                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={closeModal} className="px-5 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
                                <button type="submit" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
