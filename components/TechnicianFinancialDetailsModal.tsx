import React, { useState, useMemo } from 'react';
import { storage } from '../services/storage';
import { Technician, Schedule, ScheduleStatus, DeviceType } from '../types';
import { X, Save, Trash2, Calendar, FileText, Download, CheckSquare, Square, DollarSign, QrCode } from 'lucide-react';

interface Props {
  technician: Technician;
  schedules: Schedule[];
  onClose: () => void;
  onUpdate: () => void;
}

export const TechnicianFinancialDetailsModal = ({ technician, schedules, onClose, onUpdate }: Props) => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [editingSchedules, setEditingSchedules] = useState<Schedule[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);

  useMemo(() => {
    const startTs = new Date(`${startDate}T00:00:00`).getTime();
    const endTs = new Date(`${endDate}T23:59:59`).getTime();
    setEditingSchedules(schedules.filter(s => {
      if (s.technicianId !== technician.id) return false;
      const scheduleDateStr = s.confirmedDate || s.preferredDate;
      const scheduleTs = new Date(`${scheduleDateStr}T12:00:00`).getTime();
      return scheduleTs >= startTs && scheduleTs <= endTs;
    }));
  }, [schedules, technician.id, startDate, endDate]);

  const handleUpdate = async (updatedSchedule: Schedule) => {
    await storage.saveSchedule(updatedSchedule);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este serviço?')) {
      await storage.deleteSchedule(id);
      onUpdate();
    }
  };

  const getCalculatedPaymentAmount = (s: Schedule) => {
    if (s.technicianPaymentAmount !== undefined && s.technicianPaymentAmount !== null && s.technicianPaymentAmount > 0) {
      return s.technicianPaymentAmount;
    }
    
    const rates = technician.serviceRates || { installation: 0, maintenance: 0, removal: 0, inspection: 0 };
    let amount = 0;
    
    if (s.serviceType === 'Instalação') {
      if (s.deviceType === 'Tag') amount = rates.tagInstallation || 0;
      else if (s.deviceType === 'Rastreador') amount = rates.installation || 0;
      else if (s.deviceType === 'Rastreador + Tag') amount = (rates.installation || 0) + (rates.tagInstallation || 0);
      else amount = rates.installation || 0;
    } else if (s.serviceType === 'Manutenção') {
      amount = rates.maintenance || 0;
    } else if (s.serviceType === 'Retirada') {
      if (s.deviceType === 'Tag') amount = rates.tagRemoval || 0;
      else if (s.deviceType === 'Rastreador') amount = rates.removal || 0;
      else if (s.deviceType === 'Rastreador + Tag') amount = (rates.removal || 0) + (rates.tagRemoval || 0);
      else amount = rates.removal || 0;
    } else if (s.serviceType === 'Vistoria') {
      amount = rates.inspection || 0;
    }
    
    return amount;
  };

  const totalToReceive = useMemo(() => {
    return editingSchedules
      .filter(s => s.status === 'Concluída' && !s.technicianPaid)
      .reduce((sum, s) => sum + getCalculatedPaymentAmount(s) + (s.displacementValue || 0), 0);
  }, [editingSchedules, technician.serviceRates]);

  const totalInHand = useMemo(() => {
    return editingSchedules
      .reduce((sum, s) => sum + (s.amountReceivedByTechnician || 0), 0);
  }, [editingSchedules]);

  const selectedTotal = useMemo(() => {
    return editingSchedules
      .filter(s => selectedServices.includes(s.id))
      .reduce((sum, s) => sum + getCalculatedPaymentAmount(s) + (s.displacementValue || 0) - (s.amountReceivedByTechnician || 0), 0);
  }, [editingSchedules, selectedServices, technician.serviceRates]);

  const toggleSelection = (id: string) => {
    setSelectedServices(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedServices.length === editingSchedules.length) {
      setSelectedServices([]);
    } else {
      setSelectedServices(editingSchedules.map(s => s.id));
    }
  };

  const handlePaySelected = async () => {
    for (const id of selectedServices) {
      const schedule = editingSchedules.find(s => s.id === id);
      if (schedule) {
        await storage.saveSchedule({...schedule, technicianPaid: true});
      }
    }

    const payment = {
      id: crypto.randomUUID(),
      technicianId: technician.id,
      amount: selectedTotal,
      date: Date.now(),
      type: 'salary_deduction',
      status: 'paid',
      scheduleIds: selectedServices
    };
    await storage.saveTechnicianPayment(payment);

    setSelectedServices([]);
    setIsPixModalOpen(false);
    onUpdate();
  };

  const handleExportCSV = () => {
    const headers = ['Placa', 'Serviço', 'Status', 'Valor Serviço', 'Deslocamento', 'Dinheiro em Mãos', 'Pago Empresa'];
    const rows = editingSchedules.map(s => [
      s.vehiclePlate,
      s.serviceType,
      s.status,
      getCalculatedPaymentAmount(s),
      s.displacementValue || 0,
      s.amountReceivedByTechnician || 0,
      s.technicianPaid ? 'Sim' : 'Não'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_pagamento_${technician.name}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-6xl rounded-[32px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl relative flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-start flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Financeiro: {technician.name}</h2>
            <div className="flex gap-4 mt-4">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none" />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none" />
            </div>
            <p className="text-xs text-zinc-500 mt-2">Chave PIX: <span className="font-bold text-zinc-900 dark:text-white">{technician.pixKey || 'Não cadastrada'}</span></p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">A Receber da Empresa</p>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">R$ {totalToReceive.toFixed(2)}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/30">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Dinheiro em Mãos</p>
              <p className="text-2xl font-black text-amber-700 dark:text-amber-300">R$ {totalInHand.toFixed(2)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold py-2 px-4 rounded-xl transition-colors text-xs">
                <Download size={16} /> Exportar CSV
              </button>
              <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors bg-zinc-100 dark:bg-zinc-800 rounded-xl self-end"><X size={20}/></button>
            </div>
          </div>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-4">
          {/* Header Row */}
          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            <div className="md:col-span-1 flex items-center justify-center">
              <button onClick={selectAll} className="p-1 text-zinc-400 hover:text-primary-500">
                {selectedServices.length === editingSchedules.length && editingSchedules.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            </div>
            <div className="md:col-span-2">Serviço / Placa</div>
            <div className="md:col-span-1">Status</div>
            <div className="md:col-span-1">Equipamento</div>
            <div className="md:col-span-1">Valor Serv.</div>
            <div className="md:col-span-1">Desloc.</div>
            <div className="md:col-span-1">Em Mãos</div>
            <div className="md:col-span-1 text-center">Pago Emp.</div>
            <div className="md:col-span-2 text-right">Ações</div>
          </div>

          {editingSchedules.map(s => (
            <div key={s.id} className={`grid grid-cols-1 md:grid-cols-11 gap-4 items-center p-4 rounded-2xl border transition-colors ${selectedServices.includes(s.id) ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/30' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'}`}>
              <div className="md:col-span-1 flex items-center justify-center">
                <button onClick={() => toggleSelection(s.id)} className={`p-1 ${selectedServices.includes(s.id) ? 'text-primary-500' : 'text-zinc-400 hover:text-primary-500'}`}>
                  {selectedServices.includes(s.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              </div>
              <div className="md:col-span-2">
                <p className="font-bold text-zinc-900 dark:text-white">{s.vehiclePlate}</p>
                <p className="text-xs text-zinc-500">{s.serviceType}</p>
              </div>
              <div className="md:col-span-1">
                <select value={s.status} onChange={e => handleUpdate({...s, status: e.target.value as ScheduleStatus})} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full">
                  {['Solicitada', 'Confirmada', 'Concluída', 'Frustrado', 'Cancelada'].map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <select value={s.deviceType} onChange={e => handleUpdate({...s, deviceType: e.target.value as DeviceType})} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full">
                  {['Rastreador', 'Rastreador + Tag', 'Tag'].map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <input type="number" value={getCalculatedPaymentAmount(s)} onChange={e => handleUpdate({...s, technicianPaymentAmount: parseFloat(e.target.value)})} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full" placeholder="Valor" />
              </div>
              <div className="md:col-span-1">
                <input type="number" value={s.displacementValue || 0} onChange={e => handleUpdate({...s, displacementValue: parseFloat(e.target.value)})} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full" placeholder="Desloc." />
              </div>
              <div className="md:col-span-1">
                <input type="number" value={s.amountReceivedByTechnician || 0} onChange={e => handleUpdate({...s, amountReceivedByTechnician: parseFloat(e.target.value)})} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full border-amber-500/30 focus:border-amber-500" placeholder="Em mãos" />
              </div>
              <div className="md:col-span-1 flex justify-center">
                <button 
                  onClick={() => handleUpdate({...s, technicianPaid: !s.technicianPaid})}
                  className={`p-2 rounded-xl transition-colors ${s.technicianPaid ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-700'}`}
                >
                  {s.technicianPaid ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button onClick={() => handleUpdate(s)} className="p-2 text-emerald-500 hover:text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl"><Save size={18}/></button>
                <button onClick={() => handleDelete(s.id)} className="p-2 text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl"><Trash2 size={18}/></button>
              </div>
            </div>
          ))}
          {editingSchedules.length === 0 && (
            <div className="text-center p-10 text-zinc-500">
              Nenhum serviço encontrado neste período.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div className="text-sm font-bold text-zinc-500">
            {selectedServices.length} serviços selecionados
          </div>
          <button 
            onClick={() => setIsPixModalOpen(true)}
            disabled={selectedServices.length === 0}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            <QrCode size={20} /> Pagar Selecionados (R$ {selectedTotal.toFixed(2)})
          </button>
        </div>
      </div>

      {/* PIX Payment Modal */}
      {isPixModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase">Pagamento PIX</h3>
              <button onClick={() => setIsPixModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 rounded-xl"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
              <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl text-center">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Valor a Pagar</p>
                <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">R$ {selectedTotal.toFixed(2)}</p>
              </div>
              
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Chave PIX do Técnico</p>
                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-mono font-bold text-zinc-900 dark:text-white">{technician.pixKey || 'Não cadastrada'}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(technician.pixKey || '')}
                    className="text-xs font-bold text-primary-500 hover:text-primary-600 uppercase"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button 
                  onClick={handlePaySelected}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <CheckSquare size={20} /> Confirmar Pagamento
                </button>
                <p className="text-center text-[10px] text-zinc-500 mt-3">
                  Ao confirmar, os {selectedServices.length} serviços selecionados serão marcados como "Pago Empresa".
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
