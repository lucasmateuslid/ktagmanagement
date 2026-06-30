import React, { useState, useMemo } from 'react';
import { storage } from '../services/storage';
import { Technician, Schedule, ScheduleStatus, DeviceType } from '../types';
import { X, Save, Trash2, Calendar, FileText, Download, CheckSquare, Square, DollarSign, QrCode, Search, Activity } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode'; // FIX 3: npm install qrcode  (+ npm install -D @types/qrcode)

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
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'az' | 'za' | 'value_desc' | 'value_asc'>('date_desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  const [pixKey, setPixKey] = useState(technician.pixKey || '');
  const [cpf, setCpf] = useState(technician.cpf || '');

  const [activeTab, setActiveTab] = useState<'services' | 'history'>('services');
  const [payments, setPayments] = useState<any[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // FIX 3: QR gerado localmente (sem depender de api.qrserver.com)
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  React.useEffect(() => {
    const fetchPayments = async () => {
      const allPayments = await storage.getTechnicianPayments(technician.id);
      setPayments(allPayments.sort((a: any, b: any) => b.date - a.date));
    };
    fetchPayments();
  }, [technician.id, isPixModalOpen]);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePixPayload = (pixKey: string, amount?: number) => {
    if (!pixKey) return '';
    // FIX (bônus): tamanho em BYTES (PIX exige bytes, não unidades UTF-16)
    const formatLength = (val: string) => new TextEncoder().encode(val).length.toString().padStart(2, '0');

    const payloadFormatIndicator = "000201";
    const gui = "0014br.gov.bcb.pix";
    const key = `01${formatLength(pixKey)}${pixKey}`;
    const merchantAccountInfo = `26${formatLength(gui + key)}${gui}${key}`;
    const merchantCategoryCode = "52040000";
    const transactionCurrency = "5303986";
    
    let transactionAmount = '';
    if (amount !== undefined && amount > 0) {
        const amountStr = amount.toFixed(2);
        transactionAmount = `54${formatLength(amountStr)}${amountStr}`;
    }
    
    const countryCode = "5802BR";
    const name = "K TAG".substring(0, 25).toUpperCase();
    const merchantNameField = `59${formatLength(name)}${name}`;
    const city = "SAO PAULO".substring(0, 15).toUpperCase();
    const merchantCityField = `60${formatLength(city)}${city}`;
    const txid = "***"; // Standard static PIX without specific txid
    const additionalDataField = `62${formatLength(`05${formatLength(txid)}${txid}`)}05${formatLength(txid)}${txid}`;

    let payload = `${payloadFormatIndicator}${merchantAccountInfo}${merchantCategoryCode}${transactionCurrency}${transactionAmount}${countryCode}${merchantNameField}${merchantCityField}${additionalDataField}6304`;

    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    const crcHex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return payload + crcHex;
  };

  const handleSaveTechnician = async () => {
    await storage.saveTechnician({
      ...technician,
      pixKey,
      cpf
    });
    onUpdate();
  };

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
    let amount = calculateBaseAmount(s.serviceType, s.deviceType, rates);

    if (s.status === 'Frustrada') {
      amount = amount * 0.5;
    }

    return amount;
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

    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    if (paymentFilter !== 'all') {
      filtered = filtered.filter(s => paymentFilter === 'paid' ? s.technicianPaid : !s.technicianPaid);
    }

    filtered.sort((a, b) => {
      if (sortOrder === 'date_asc' || sortOrder === 'date_desc') {
        const dateA = new Date(a.confirmedDate || a.preferredDate).getTime();
        const dateB = new Date(b.confirmedDate || b.preferredDate).getTime();
        return sortOrder === 'date_asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortOrder === 'az' || sortOrder === 'za') {
        const plateA = (a.vehiclePlate || '').toLowerCase();
        const plateB = (b.vehiclePlate || '').toLowerCase();
        return sortOrder === 'az' ? plateA.localeCompare(plateB) : plateB.localeCompare(plateA);
      }
      if (sortOrder === 'value_asc' || sortOrder === 'value_desc') {
        const valA = getCalculatedPaymentAmount(a) + (a.displacementValue || 0);
        const valB = getCalculatedPaymentAmount(b) + (b.displacementValue || 0);
        return sortOrder === 'value_asc' ? valA - valB : valB - valA;
      }
      return 0;
    });

    return filtered.map(s => ({ ...s, ...(localChanges[s.id] || {}) }));
  }, [schedules, technician.id, startDate, endDate, localChanges, searchTerm, sortOrder, statusFilter, paymentFilter, technician.serviceRates]);

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
      .filter(s => (s.status === 'Concluída' || s.status === 'Frustrada') && !s.technicianPaid)
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

  // FIX 3: gera o QR localmente sempre que o modal abrir ou a chave/valor mudar
  React.useEffect(() => {
    if (isPixModalOpen && pixKey) {
      const staticPayload = generatePixPayload(pixKey);
      QRCode.toDataURL(staticPayload, { width: 180, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPixModalOpen, pixKey]);

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

  // FIX 1 + FIX 2: salva a chave digitada ANTES de abrir o modal e bloqueia valor <= 0
  const openPixModal = async () => {
    if (selectedServices.length === 0) return;
    if (selectedTotal <= 0) {
      alert('O valor líquido a pagar está zerado ou negativo (provavelmente o "Em Mãos" cobre o valor dos serviços). Revise os valores antes de gerar o PIX.');
      return;
    }
    // garante que a chave/CPF digitados no campo estejam persistidos antes do pagamento
    if (pixKey !== (technician.pixKey || '') || cpf !== (technician.cpf || '')) {
      await storage.saveTechnician({ ...technician, pixKey, cpf });
      onUpdate();
    }
    setIsPixModalOpen(true);
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
      scheduleIds: selectedServices,
      proofUrl: receiptPreview || undefined
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
    const data = paidSchedules.map(s => {
      const dateStr = s.confirmedDate || s.preferredDate;
      let formattedDate = '--/--/----';
      if (dateStr) {
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month, day] = dateStr.split('-');
          formattedDate = `${day}/${month}/${year}`;
        } else {
          formattedDate = new Date(dateStr).toLocaleDateString('pt-BR');
        }
      }

      return [
        formattedDate,
        s.vehiclePlate,
        s.serviceType,
        `R$ ${getCalculatedPaymentAmount(s).toFixed(2)}`,
        `R$ ${(s.displacementValue || 0).toFixed(2)}`,
        `R$ ${(s.amountReceivedByTechnician || 0).toFixed(2)}`,
        s.financialObs || ''
      ];
    });

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
    setReceiptFile(null);
    setReceiptPreview(null);
    setQrDataUrl('');
    onUpdate();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`Relatório Financeiro: ${technician.name}`, 14, 22);

    doc.setFontSize(11);
    doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`, 14, 30);
    doc.text(`Chave PIX: ${pixKey || 'Não cadastrada'}`, 14, 36);
    doc.text(`CPF: ${cpf || 'Não cadastrado'}`, 14, 42);

    const headers = [['Data', 'Placa', 'Serviço', 'Status', 'Valor Serv.', 'Desloc.', 'Em Mãos', 'Pago Emp.', 'OBS']];
    const data = editingSchedules.map(s => {
      const dateStr = s.confirmedDate || s.preferredDate;
      let formattedDate = '--/--/----';
      if (dateStr) {
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month, day] = dateStr.split('-');
          formattedDate = `${day}/${month}/${year}`;
        } else {
          formattedDate = new Date(dateStr).toLocaleDateString('pt-BR');
        }
      }

      return [
        formattedDate,
        s.vehiclePlate,
        s.serviceType,
        s.status,
        `R$ ${getCalculatedPaymentAmount(s).toFixed(2)}`,
        `R$ ${(s.displacementValue || 0).toFixed(2)}`,
        `R$ ${(s.amountReceivedByTechnician || 0).toFixed(2)}`,
        s.technicianPaid ? 'Sim' : 'Não',
        s.financialObs || ''
      ];
    });

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
    const rows = editingSchedules.map(s => {
      const dateStr = s.confirmedDate || s.preferredDate;
      let formattedDate = '--/--/----';
      if (dateStr) {
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month, day] = dateStr.split('-');
          formattedDate = `${day}/${month}/${year}`;
        } else {
          formattedDate = new Date(dateStr).toLocaleDateString('pt-BR');
        }
      }

      return [
        formattedDate,
        s.vehiclePlate,
        s.serviceType,
        s.status,
        getCalculatedPaymentAmount(s),
        s.displacementValue || 0,
        s.amountReceivedByTechnician || 0,
        s.technicianPaid ? 'Sim' : 'Não'
      ];
    });

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
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-6xl rounded-[32px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl relative flex flex-col max-h-[90vh]">
        <div className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 md:top-8 md:right-8 p-2 text-zinc-400 hover:text-zinc-600 transition-colors bg-zinc-100 dark:bg-zinc-800 rounded-xl z-10"><X size={20}/></button>

          <div className="pr-12">
            <h2 className="text-xl md:text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Financeiro: {technician.name}</h2>
          </div>

          <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab('services')}
              className={`pb-2 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'services' ? 'text-primary-500 border-b-2 border-primary-500' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Serviços
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'history' ? 'text-primary-500 border-b-2 border-primary-500' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Histórico de Pagamentos
            </button>
          </div>
        </div>

        {activeTab === 'services' && (
          <>
          <div className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-6 relative">
            <div className="flex flex-col xl:flex-row gap-6">
            {/* Left Column: Filters and Inputs */}
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none w-full" />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none w-full" />

                <div className="relative col-span-2 md:col-span-1 lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar por placa ou OS..."
                    className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none border border-transparent focus:border-primary-500"
                  />
                </div>

                <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none w-full">
                  <option value="date_desc">Mais recentes</option>
                  <option value="date_asc">Mais antigos</option>
                  <option value="az">Placa A-Z</option>
                  <option value="za">Placa Z-A</option>
                  <option value="value_desc">Maior valor</option>
                  <option value="value_asc">Menor valor</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none w-full">
                  <option value="all">Todos os status</option>
                  <option value="Solicitada">Solicitada</option>
                  <option value="Confirmada">Confirmada</option>
                  <option value="Concluída">Concluída</option>
                  <option value="Frustrada">Frustrada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
                <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as any)} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none w-full">
                  <option value="all">Todos (Pagamento)</option>
                  <option value="paid">Pago Emp.</option>
                  <option value="unpaid">Não Pago Emp.</option>
                </select>
              </div>

              <div className="flex flex-wrap items-end gap-3">
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
                  className="bg-primary-500 hover:bg-primary-600 text-white p-2 rounded-xl transition-colors w-full sm:w-auto flex justify-center h-[38px] items-center"
                  title="Salvar Dados do Técnico"
                >
                  <Save size={20} />
                </button>
              </div>
            </div>

            {/* Right Column: Totals and Actions */}
            <div className="flex flex-col sm:flex-row xl:flex-col gap-4 xl:w-72 shrink-0">
              <div className="flex gap-4 w-full">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 flex-1">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">A Receber</p>
                  <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">R$ {totalToReceive.toFixed(2)}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-2xl border border-amber-100 dark:border-amber-800/30 flex-1">
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Em Mãos</p>
                  <p className="text-lg font-black text-amber-700 dark:text-amber-300">R$ {totalInHand.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  onClick={onUpdate}
                  className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold py-2 px-3 rounded-xl transition-colors text-xs"
                >
                  <Activity size={16} /> Atualizar
                </button>
                <div className="flex flex-1 gap-2">
                  <button onClick={handleExportPDF} className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold py-2 px-3 rounded-xl transition-colors text-xs" title="Exportar PDF">
                    <FileText size={16} /> PDF
                  </button>
                  <button onClick={handleExportCSV} className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold py-2 px-3 rounded-xl transition-colors text-xs" title="Exportar CSV">
                    <Download size={16} /> CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-4">
          {/* Header Row */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            <div className="lg:col-span-1 flex items-center justify-center gap-2">
              <span>ID</span>
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

          {editingSchedules.map((s, index) => (
            <div key={s.id} className={`flex flex-col lg:grid lg:grid-cols-12 gap-4 items-start lg:items-center p-4 rounded-2xl border transition-colors ${selectedServices.includes(s.id) ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/30' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'}`}>
              <div className="lg:col-span-1 flex items-center justify-between w-full lg:w-auto lg:justify-center gap-2">
                <span className="text-xs font-bold text-zinc-400">#{index + 1}</span>
                <button onClick={() => toggleSelection(s.id)} className={`p-1 ${selectedServices.includes(s.id) ? 'text-primary-500' : 'text-zinc-400 hover:text-primary-500'}`}>
                  {selectedServices.includes(s.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              </div>
              <div className="lg:col-span-2 w-full">
                <p className="text-xs text-zinc-500 mb-1">
                  {(() => {
                    const dateStr = s.confirmedDate || s.preferredDate;
                    if (!dateStr) return '--/--/----';
                    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                      const [year, month, day] = dateStr.split('-');
                      return `${day}/${month}/${year}`;
                    }
                    return new Date(dateStr).toLocaleDateString('pt-BR');
                  })()} - {s.vehiclePlate}
                </p>
                <select value={s.serviceType} onChange={e => handleLocalChange(s.id, 'serviceType', e.target.value, true)} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full">
                  {['Instalação', 'Manutenção', 'Retirada', 'Vistoria'].map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="lg:col-span-1 w-full">
                <span className="lg:hidden text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Status</span>
                <select value={s.status} onChange={e => handleLocalChange(s.id, 'status', e.target.value)} className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 text-xs font-bold w-full">
                  {['Solicitada', 'Confirmada', 'Concluída', 'Frustrada', 'Cancelada'].map(status => <option key={status} value={status}>{status}</option>)}
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
              onClick={openPixModal}
              disabled={selectedServices.length === 0}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors w-full sm:w-auto"
            >
              <QrCode size={20} /> Pagar Selecionados (R$ {selectedTotal.toFixed(2)})
            </button>
          </div>
        </div>
        </>
        )}

        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/80 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                <div>Data do Pagamento</div>
                <div>Valor Pago</div>
                <div>Qtd. Serviços</div>
                <div className="text-right">Comprovante</div>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {payments.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-sm">
                    Nenhum pagamento registrado no histórico.
                  </div>
                ) : (
                  payments.map(payment => (
                    <div key={payment.id} className="grid grid-cols-4 gap-4 p-4 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">
                        {new Date(payment.date).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        R$ {payment.amount.toFixed(2)}
                      </div>
                      <div className="text-sm text-zinc-500">
                        {payment.scheduleIds?.length || 0} serviços
                      </div>
                      <div className="text-right">
                        {payment.proofUrl ? (
                          <a
                            href={payment.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-bold hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                          >
                            <FileText size={14} /> Ver Comprovante
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-400">Sem comprovante</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PIX Payment Modal */}
      {isPixModalOpen && (
        <div className="fixed inset-0 z-[4100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase">Pagamento PIX</h3>
              <button onClick={() => setIsPixModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 rounded-xl"><X size={20}/></button>
            </div>

            <div className="space-y-6">
              <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl text-center">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Valor a Pagar</p>
                <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">R$ {selectedTotal.toFixed(2)}</p>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Resumo do Pagamento</p>
                <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <p><span className="font-bold">Período:</span> {new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  <p><span className="font-bold">Qtd. Serviços:</span> {selectedServices.length}</p>
                  <p className="font-bold">Placas Vinculadas:</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(selectedServices.map(id => editingSchedules.find(s => s.id === id)?.vehiclePlate).filter(Boolean))).map(plate => (
                      <span key={plate} className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-xs font-mono">{plate}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* FIX 1 + 3: QR usa a chave do STATE (pixKey) e é gerado LOCALMENTE */}
              {pixKey ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-200">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR Code PIX" className="w-44 h-44" />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-xs text-zinc-400">
                        Gerando QR...
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const payload = generatePixPayload(pixKey, selectedTotal);
                      if (payload) navigator.clipboard.writeText(payload);
                    }}
                    className="text-xs font-bold text-primary-500 hover:text-primary-600 uppercase flex items-center gap-2"
                  >
                    <CheckSquare size={14} /> Copiar PIX Copia e Cola
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-4 rounded-2xl text-center text-xs font-bold text-amber-700 dark:text-amber-400">
                  Cadastre uma chave PIX para gerar o QR Code.
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Chave PIX do Técnico</p>
                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-mono font-bold text-zinc-900 dark:text-white break-all">{pixKey || 'Não cadastrada'}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(pixKey || '')}
                    className="text-xs font-bold text-primary-500 hover:text-primary-600 uppercase shrink-0 ml-2"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">CPF do Técnico</p>
                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-mono font-bold text-zinc-900 dark:text-white">{cpf || 'Não cadastrado'}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(cpf || '')}
                    className="text-xs font-bold text-primary-500 hover:text-primary-600 uppercase"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Comprovante de Pagamento</p>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-300 border-dashed rounded-xl cursor-pointer bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-700 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileText className="w-8 h-8 mb-3 text-zinc-400" />
                      <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400"><span className="font-bold">Clique para enviar</span> ou arraste o arquivo</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">PNG, JPG ou PDF (MAX. 5MB)</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleReceiptChange} />
                  </label>
                </div>
                {receiptPreview && (
                  <div className="mt-4 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-500 truncate max-w-[200px]">{receiptFile?.name}</span>
                    <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }} className="text-red-500 hover:text-red-600 p-1"><X size={14}/></button>
                  </div>
                )}
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