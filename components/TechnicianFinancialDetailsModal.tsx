import React, { useState, useMemo } from 'react';
import { storage } from '../services/storage';
import { Technician, Schedule, ScheduleStatus, DeviceType } from '../types';
import { X, Save, Trash2, Calendar, FileText, Download, CheckSquare, Square, DollarSign, QrCode, Search } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const [localChanges, setLocalChanges] = useState<Record<string, Partial<Schedule>>>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  
  const [pixKey, setPixKey] = useState(technician.pixKey || '');
  const [cpf, setCpf] = useState(technician.cpf || '');

  const handleSaveTechnician = async () => {
    await storage.saveTechnician({
      ...technician,
      pixKey,
      cpf
    });
    onUpdate();
  };

  const editingSchedules = useMemo(() => {
    const startTs = new Date(`${startDate}T00:00:00`).getTime();
    const endTs = new Date(`${endDate}T23:59:59`).getTime();
    let filtered = schedules.filter(s => {
      if (s.technicianId !== technician.id) return false;
      const scheduleDateStr = s.confirmedDate || s.preferredDate;
      const scheduleTs = new Date(`${scheduleDateStr}T12:00:00`).getTime();
      return scheduleTs >= startTs && scheduleTs <= endTs;
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.vehiclePlate?.toLowerCase().includes(term) ||
        s.osNumber?.toLowerCase().includes(term)
      );
    }

    return filtered.map(s => ({ ...s, ...(localChanges[s.id] || {}) }));
  }, [schedules, technician.id, startDate, endDate, localChanges, searchTerm]);

  const calculateBaseAmount = (serviceType: string, deviceType: string | undefined, rates: any) => {
    let amount = 0;
    if (serviceType === 'Instalação') {
      if (deviceType === 'Tag') amount = rates.tagInstallation || 0;
      else if (deviceType === 'Rastreador') amount = rates.installation || 0;
      else if (deviceType === 'Rastreador + Tag') amount = (rates.installation || 0) + (rates.tagInstallation || 0);
      else amount = rates.installation || 0;
    } else if (serviceType === 'Manutenção') {
      amount = rates.maintenance || 0;
    } else if (serviceType === 'Retirada') {
      if (deviceType === 'Tag') amount = rates.tagRemoval || 0;
      else if (deviceType === 'Rastreador') amount = rates.removal || 0;
      else if (deviceType === 'Rastreador + Tag') amount = (rates.removal || 0) + (rates.tagRemoval || 0);
      else amount = rates.removal || 0;
    } else if (serviceType === 'Vistoria') {
      amount = rates.inspection || 0;
    }
    return amount;
  };

  const getCalculatedPaymentAmount = (s: Schedule) => {
    if (s.technicianPaymentAmount !== undefined && s.technicianPaymentAmount !== null && s.technicianPaymentAmount > 0) {
      return s.technicianPaymentAmount;
    }
    const rates = technician.serviceRates || { installation: 0, maintenance: 0, removal: 0, inspection: 0 };
    return calculateBaseAmount(s.serviceType, s.deviceType, rates);
  };

  const handleLocalChange = (id: string, field: keyof Schedule, value: any, recalculatePayment: boolean = false) => {
    setLocalChanges(prev => {
      const currentChanges = prev[id] || {};
      const updatedChanges = { ...currentChanges, [field]: value };
      
      if (recalculatePayment) {
         const schedule = schedules.find(s => s.id === id);
         if (schedule) {
           const merged = { ...schedule, ...updatedChanges };
           const rates = technician.serviceRates || { installation: 0, maintenance: 0, removal: 0, inspection: 0 };
           updatedChanges.technicianPaymentAmount = calculateBaseAmount(merged.serviceType, merged.deviceType, rates);
         }
      }
      return { ...prev, [id]: updatedChanges };
    });
  };

  const handleSaveAllChanges = async () => {
    const idsWithChanges = Object.keys(localChanges);
    if (idsWithChanges.length === 0) return;

    for (const id of idsWithChanges) {
      const schedule = schedules.find(s => s.id === id);
      if (schedule) {
        const updatedSchedule = { ...schedule, ...localChanges[id] };
        await storage.saveSchedule(updatedSchedule);
      }
    }
    
    setLocalChanges({});
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    setScheduleToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (scheduleToDelete) {
      await storage.deleteSchedule(scheduleToDelete);
      setLocalChanges(prev => {
        const next = { ...prev };
        delete next[scheduleToDelete];
        return next;
      });
      onUpdate();
    }
    setIsConfirmDeleteOpen(false);
    setScheduleToDelete(null);
  };

  const totalToReceive = useMemo(() => {
    return editingSchedules
      .filter(s => s.status === 'Concluída' && !s.technicianPaid)
      .reduce((sum, s) => sum + getCalculatedPaymentAmount(s) + (s.displacementValue || 0) - (s.amountReceivedByTechnician || 0), 0);
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
    const paidSchedules: Schedule[] = [];
    
    for (const id of selectedServices) {
      const schedule = editingSchedules.find(s => s.id === id);
      if (schedule) {
        const updated = {...schedule, technicianPaid: true};
        await storage.saveSchedule(updated);
        paidSchedules.push(updated);
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

    // Generate PDF Receipt
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Comprovante de Pagamento: ${technician.name}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Data do Pagamento: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    doc.text(`Total Pago: R$ ${selectedTotal.toFixed(2)}`, 14, 36);

    const headers = [['Data', 'Placa', 'Serviço', 'Valor Serv.', 'Desloc.', 'Em Mãos', 'OBS']];
    const data = paidSchedules.map(s => [
      new Date(s.confirmedDate || s.preferredDate).toLocaleDateString('pt-BR'),
      s.vehiclePlate,
      s.serviceType,
      `R$ ${getCalculatedPaymentAmount(s).toFixed(2)}`,
      `R$ ${(s.displacementValue || 0).toFixed(2)}`,
      `R$ ${(s.amountReceivedByTechnician || 0).toFixed(2)}`,
      s.financialObs || ''
    ]);

    autoTable(doc, {
      startY: 45,
      head: headers,
      body: data,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [46, 204, 113] } // Emerald color
    });

    doc.save(`comprovante_pagamento_${technician.name}_${new Date().getTime()}.pdf`);

    setLocalChanges(prev => {
      const next = { ...prev };
      selectedServices.forEach(id => delete next[id]);
      return next;
    });

    setSelectedServices([]);
    setIsPixModalOpen(false);
    onUpdate();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Relatório Financeiro: ${technician.name}`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`, 14, 30);
    doc.text(`Chave PIX: ${technician.pixKey || 'Não cadastrada'}`, 14, 36);
    doc.text(`CPF: ${technician.cpf || 'Não cadastrado'}`, 14, 42);

    const headers = [['Data', 'Placa', 'Serviço', 'Status', 'Valor Serv.', 'Desloc.', 'Em Mãos', 'Pago Emp.', 'OBS']];
    const data = editingSchedules.map(s => [
      new Date(s.confirmedDate || s.preferredDate).toLocaleDateString('pt-BR'),
      s.vehiclePlate,
      s.serviceType,
      s.status,
      `R$ ${getCalculatedPaymentAmount(s).toFixed(2)}`,
      `R$ ${(s.displacementValue || 0).toFixed(2)}`,
      `R$ ${(s.amountReceivedByTechnician || 0).toFixed(2)}`,
      s.technicianPaid ? 'Sim' : 'Não',
      s.financialObs || ''
    ]);

    autoTable(doc, {
      startY: 50,
      head: headers,
      body: data,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.text(`Total a Receber: R$ ${totalToReceive.toFixed(2)}`, 14, finalY + 10);
    doc.text(`Total em Mãos: R$ ${totalInHand.toFixed(2)}`, 14, finalY + 16);

    doc.save(`relatorio_financeiro_${technician.name}_${startDate}_${endDate}.pdf`);
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Placa', 'Serviço', 'Status', 'Valor Serviço', 'Deslocamento', 'Dinheiro em Mãos', 'Pago Empresa'];
    const rows = editingSchedules.map(s => [
      new Date(s.confirmedDate || s.preferredDate).toLocaleDateString('pt-BR'),
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
        <div className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start gap-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 md:top-8 md:right-8 p-2 text-zinc-400 hover:text-zinc-600 transition-colors bg-zinc-100 dark:bg-zinc-800 rounded-xl z-10"><X size={20}/></button>

          <div className="flex-1 w-full md:min-w-[300px] pr-10 md:pr-0">
            <h2 className="text-xl md:text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Financeiro: {technician.name}</h2>
            <div className="flex flex-wrap gap-4 mt-4 mb-4">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none flex-1 min-w-[120px]" />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none flex-1 min-w-[120px]" />
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  placeholder="Pesquisar por placa ou OS..." 
                  className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none border border-transparent focus:border-primary-500"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Chave PIX</label>
                <input 
                  type="text" 
                  value={pixKey} 
                  onChange={e => setPixKey(e.target.value)} 
                  placeholder="Chave PIX"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm font-bold outline-none border border-transparent focus:border-primary-500" 
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">CPF</label>
                <input 
                  type="text" 
                  value={cpf} 
                  onChange={e => setCpf(e.target.value)} 
                  placeholder="CPF"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm font-bold outline-none border border-transparent focus:border-primary-500" 
                />
              </div>
              <button 
                onClick={handleSaveTechnician}
                className="bg-primary-500 hover:bg-primary-600 text-white p-2 rounded-xl transition-colors w-full md:w-auto flex justify-center"
                title="Salvar Dados do Técnico"
              >
                <Save size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto mt-4 md:mt-0">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 flex-1">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">A Receber da Empresa</p>
              <p className="text-xl md:text-2xl font-black text-emerald-700 dark:text-emerald-300">R$ {totalToReceive.toFixed(2)}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/30 flex-1">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Dinheiro em Mãos</p>
              <p className="text-xl md:text-2xl font-black text-amber-700 dark:text-amber-300">R$ {totalInHand.toFixed(2)}</p>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <button onClick={handleExportPDF} className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold py-3 md:py-2 px-4 rounded-xl transition-colors text-xs w-full">
                <FileText size={16} /> Exportar PDF
              </button>
              <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold py-3 md:py-2 px-4 rounded-xl transition-colors text-xs w-full">
                <Download size={16} /> Exportar CSV
              </button>
            </div>
          </div>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-4">
          {/* Header Row */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            <div className="lg:col-span-1 flex items-center justify-center">
              <button onClick={selectAll} className="p-1 text-zinc-400 hover:text-primary-500">
                {selectedServices.length === editingSchedules.length && editingSchedules.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            </div>
            <div className="lg:col-span-2">Data / Serviço</div>
            <div className="lg:col-span-1">Status</div>
            <div className="lg:col-span-2">Equipamento</div>
            <div className="lg:col-span-1">Valor Serv.</div>
            <div className="lg:col-span-1">Desloc.</div>
            <div className="lg:col-span-1">Em Mãos</div>
            <div className="lg:col-span-1 text-center">Pago Emp.</div>
            <div className="lg:col-span-1">OBS</div>
            <div className="lg:col-span-1 text-right">Ações</div>
          </div>

          {editingSchedules.map(s => (
            <div key={s.id} className={`flex flex-col lg:grid lg:grid-cols-12 gap-4 items-start lg:items-center p-4 rounded-2xl border transition-colors ${selectedServices.includes(s.id) ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/30' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'}`}>
              <div className="lg:col-span-1 flex items-center justify-between w-full lg:w-auto lg:justify-center">
                <span className="lg:hidden text-[10px] font-bold text-zinc-400 uppercase">Selecionar</span>
                <button onClick={() => toggleSelection(s.id)} className={`p-1 ${selectedServices.includes(s.id) ? 'text-primary-500' : 'text-zinc-400 hover:text-primary-500'}`}>
                  {selectedServices.includes(s.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              </div>
              <div className="lg:col-span-2 w-full">
                <p className="text-xs text-zinc-500 mb-1">{new Date(s.confirmedDate || s.preferredDate).toLocaleDateString('pt-BR')} - {s.vehiclePlate}</p>
                <select value={s.serviceType} onChange={e => handleLocalChange(s.id, 'serviceType', e.target.value, true)} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full">
                  {['Instalação', 'Manutenção', 'Retirada', 'Vistoria'].map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="lg:col-span-1 w-full">
                <span className="lg:hidden text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Status</span>
                <select value={s.status} onChange={e => handleLocalChange(s.id, 'status', e.target.value)} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full">
                  {['Solicitada', 'Confirmada', 'Concluída', 'Frustrado', 'Cancelada'].map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2 w-full">
                <span className="lg:hidden text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Equipamento</span>
                <select value={s.deviceType} onChange={e => handleLocalChange(s.id, 'deviceType', e.target.value, true)} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full">
                  {['Rastreador', 'Rastreador + Tag', 'Tag'].map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="lg:col-span-1 w-full">
                <span className="lg:hidden text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Valor Serv.</span>
                <input type="number" value={getCalculatedPaymentAmount(s)} onChange={e => handleLocalChange(s.id, 'technicianPaymentAmount', parseFloat(e.target.value))} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full" placeholder="Valor" />
              </div>
              <div className="lg:col-span-1 w-full">
                <span className="lg:hidden text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Desloc.</span>
                <input type="number" value={s.displacementValue || 0} onChange={e => handleLocalChange(s.id, 'displacementValue', parseFloat(e.target.value))} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full" placeholder="Desloc." />
              </div>
              <div className="lg:col-span-1 w-full">
                <span className="lg:hidden text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Em Mãos</span>
                <input type="number" value={s.amountReceivedByTechnician || 0} onChange={e => handleLocalChange(s.id, 'amountReceivedByTechnician', parseFloat(e.target.value))} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full border-amber-500/30 focus:border-amber-500" placeholder="Em mãos" />
              </div>
              <div className="lg:col-span-1 flex items-center justify-between w-full lg:w-auto lg:justify-center">
                <span className="lg:hidden text-[10px] font-bold text-zinc-400 uppercase">Pago Emp.</span>
                <button 
                  onClick={() => handleLocalChange(s.id, 'technicianPaid', !s.technicianPaid)}
                  className={`p-2 rounded-xl transition-colors ${s.technicianPaid ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-700'}`}
                >
                  {s.technicianPaid ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              </div>
              <div className="lg:col-span-1 w-full">
                <span className="lg:hidden text-[10px] font-bold text-zinc-400 uppercase mb-1 block">OBS</span>
                <input type="text" value={s.financialObs || ''} onChange={e => handleLocalChange(s.id, 'financialObs', e.target.value)} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full" placeholder="OBS" />
              </div>
              <div className="lg:col-span-1 flex justify-end gap-2 w-full lg:w-auto mt-2 lg:mt-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-200 dark:border-zinc-700">
                <button onClick={() => handleDelete(s.id)} className="p-2 text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl flex-1 lg:flex-none flex justify-center" title="Excluir"><Trash2 size={18}/></button>
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
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="text-sm font-bold text-zinc-500">
            {selectedServices.length} serviços selecionados
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            {Object.keys(localChanges).length > 0 && (
              <button 
                onClick={handleSaveAllChanges}
                className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-colors w-full sm:w-auto"
              >
                <Save size={20} /> Salvar Alterações ({Object.keys(localChanges).length})
              </button>
            )}
            <button 
              onClick={() => setIsPixModalOpen(true)}
              disabled={selectedServices.length === 0}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors w-full sm:w-auto"
            >
              <QrCode size={20} /> Pagar Selecionados (R$ {selectedTotal.toFixed(2)})
            </button>
          </div>
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

              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">CPF do Técnico</p>
                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-mono font-bold text-zinc-900 dark:text-white">{technician.cpf || 'Não cadastrado'}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(technician.cpf || '')}
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

      <ConfirmModal 
          isOpen={isConfirmDeleteOpen}
          onClose={() => { setIsConfirmDeleteOpen(false); setScheduleToDelete(null); }}
          onConfirm={confirmDelete}
          title="Excluir Serviço"
          message="Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita."
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          type="danger"
      />
    </div>
  );
};
