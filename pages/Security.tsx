
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../services/storage';
import { StolenRecord, Vehicle, Client } from '../types';
import { 
  ShieldAlert, AlertTriangle, Plus, Search, MapPin, 
  CheckCircle, FileText, Calendar, Lock, Car, X, 
  RefreshCw, Activity, User, Phone, Fingerprint, ChevronDown, ShieldQuestion,
  TrendingDown, TrendingUp, DollarSign, Share2, Copy, ExternalLink, Trash2
} from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';

import { ConfirmModal } from '../components/ConfirmModal';

const MotionDiv = motion.div as any;

export const Security = () => {
  const [activeRecords, setActiveRecords] = useState<StolenRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<StolenRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);
  const [isConfirmLostOpen, setIsConfirmLostOpen] = useState(false);
  const [selectedRecordToRecover, setSelectedRecordToRecover] = useState<StolenRecord | null>(null);
  const { addNotification } = useNotification();

  // Estados do Formulário de Roubo
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [theftType, setTheftType] = useState<'theft' | 'robbery'>('theft');
  const [policeReport, setPoliceReport] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [stolenValue, setStolenValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Estados do Formulário de Recuperação
  const [recoveredValue, setRecoveredValue] = useState<string>('');

  const handleOpenRecoverModal = (record: StolenRecord) => {
    setSelectedRecordToRecover(record);
    const vehicle = vehicles.find(v => v.id === record.vehicleId);
    if (vehicle?.fipeValue) {
      setRecoveredValue(vehicle.fipeValue.toString());
    } else {
      setRecoveredValue('');
    }
    setIsRecoverModalOpen(true);
  };

  const handleMarkAsLost = async (record: StolenRecord) => {
    try {
      setIsLoading(true);
      await storage.markAsLost(record.id, record.vehicleId);
      addNotification('info', 'Segurança', 'Veículo marcado como não recuperado.');
      await loadData();
    } catch (error) {
      addNotification('error', 'Erro', 'Falha ao atualizar status.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    const [allRecords, allVehicles, allClients] = await Promise.all([
      storage.getStolenRecords(),
      storage.getVehicles(),
      storage.getClients()
    ]);
    setActiveRecords(allRecords.filter(r => r.status === 'open').sort((a, b) => b.timestamp - a.timestamp));
    setHistoryRecords(allRecords.filter(r => r.status !== 'open').sort((a, b) => (b.recoveredAt || b.lostAt || 0) - (a.recoveredAt || a.lostAt || 0)));
    setVehicles(allVehicles);
    setClients(allClients);
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Estatísticas
  const stats = useMemo(() => {
    const totalStolen = historyRecords.reduce((acc, r) => acc + (r.stolenValue || 0), 0) + 
                        activeRecords.reduce((acc, r) => acc + (r.stolenValue || 0), 0);
    const totalRecovered = historyRecords.reduce((acc, r) => acc + (r.recoveredValue || 0), 0);
    const totalLost = totalStolen - totalRecovered;
    const recoveryRate = totalStolen > 0 ? (totalRecovered / totalStolen) * 100 : 0;
    
    return {
      totalStolen,
      totalRecovered,
      totalLost,
      recoveryRate: recoveryRate.toFixed(1)
    };
  }, [activeRecords, historyRecords]);

  const filteredVehicles = useMemo(() => {
    const term = vehicleSearch.toLowerCase().trim();
    return vehicles.filter(v => 
      v.status !== 'stolen' && 
      (v.plate.toLowerCase().includes(term) || v.model.toLowerCase().includes(term))
    ).slice(0, 5);
  }, [vehicles, vehicleSearch]);

  const selectedClient = useMemo(() => {
    if (!selectedVehicle) return null;
    return clients.find(c => c.id === selectedVehicle.clientId) || null;
  }, [selectedVehicle, clients]);

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    let lastLocation = { lat: 0, lon: 0, address: 'Localização não disponível' };
    if (selectedVehicle.tagId) {
        const history = await storage.getLocations(selectedVehicle.tagId);
        if (history.length > 0) {
            lastLocation = { lat: history[0].lat, lon: history[0].lon, address: 'Coordenadas em tempo real' };
        } else if (selectedVehicle.lastPosition) {
            lastLocation = { 
                lat: selectedVehicle.lastPosition.lat, 
                lon: selectedVehicle.lastPosition.lon, 
                address: 'Última posição conhecida' 
            };
        }
    }

    const timestamp = new Date(eventDate + 'T12:00:00').getTime();
    const trackingToken = crypto.randomUUID().split('-')[0].toUpperCase();

    const newRecord: StolenRecord = {
        id: crypto.randomUUID(),
        vehicleId: selectedVehicle.id,
        vehiclePlate: selectedVehicle.plate,
        vehicleModel: selectedVehicle.model,
        type: theftType,
        timestamp,
        status: 'open',
        location: lastLocation,
        policeReport,
        notes,
        stolenValue: parseFloat(stolenValue) || 0,
        trackingToken
    };

    await storage.reportTheft(newRecord);
    addNotification('success', 'Alerta Ativado!', `O veículo ${selectedVehicle.plate} foi marcado como roubado.`);
    setIsModalOpen(false);
    resetForm();
    loadData();
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordToRecover) return;

    await storage.recoverTheft(selectedRecordToRecover.id, parseFloat(recoveredValue) || 0);
    addNotification('success', 'Vitória!', `Veículo ${selectedRecordToRecover.vehiclePlate} recuperado com sucesso.`);
    setIsRecoverModalOpen(false);
    setSelectedRecordToRecover(null);
    setRecoveredValue('');
    loadData();
  };

  const copyTrackingLink = (token: string) => {
    const url = `${window.location.origin}/#/track/${token}`;
    navigator.clipboard.writeText(url);
    addNotification('info', 'Link Copiado', 'O link de rastreamento policial foi copiado para a área de transferência.');
  };

  const resetForm = () => {
    setSelectedVehicle(null);
    setVehicleSearch('');
    setTheftType('theft');
    setPoliceReport('');
    setEventDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setStolenValue('');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-10 pb-20 font-sans">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-[24px] bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20 shadow-lg shadow-red-500/10">
                    <ShieldAlert size={32} />
                </div>
                <div>
                    <h1 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Security Center</h1>
                    <p className="text-zinc-500 mt-2 font-medium">Gestão de sinistros e inteligência de recuperação.</p>
                </div>
            </div>
            <button 
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-[20px] flex items-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-red-600/30 transition-all hover:scale-[1.02]"
            >
                <AlertTriangle size={20} /> Registrar Roubo
            </button>
        </div>

        {/* Indicators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Sinistrado</p>
                    <div className="p-2 bg-red-500/10 text-red-500 rounded-xl"><TrendingDown size={16} /></div>
                </div>
                <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white">{formatCurrency(stats.totalStolen)}</h3>
                <p className="text-xs text-zinc-500 mt-2 font-medium">Valor total de veículos roubados</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Recuperado</p>
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl"><TrendingUp size={16} /></div>
                </div>
                <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white">{formatCurrency(stats.totalRecovered)}</h3>
                <p className="text-xs text-zinc-500 mt-2 font-medium">Patrimônio salvo pela operação</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Perdido</p>
                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl"><TrendingDown size={16} /></div>
                </div>
                <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white">{formatCurrency(stats.totalLost)}</h3>
                <p className="text-xs text-zinc-500 mt-2 font-medium">Prejuízo acumulado</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <CheckCircle size={120} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Taxa de Sucesso</p>
                        <div className="p-2 bg-primary-500/10 text-primary-500 rounded-xl"><Activity size={16} /></div>
                    </div>
                    <h3 className="text-3xl font-display font-black text-white">{stats.recoveryRate}%</h3>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-primary-500 h-full transition-all duration-1000" style={{ width: `${stats.recoveryRate}%` }} />
                    </div>
                </div>
            </div>
        </div>

        {/* Alerts Grid */}
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Ocorrências Ativas</h2>
            </div>
            
            {activeRecords.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-[40px] p-16 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-20 h-20 rounded-[32px] bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-6 border border-emerald-500/20"><CheckCircle size={40} /></div>
                    <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Frota em Segurança</h3>
                    <p className="text-zinc-500 mt-2">Nenhum veículo em estado de alerta no momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeRecords.map(record => (
                        <div key={record.id} className="bg-zinc-900 rounded-[32px] p-8 border border-zinc-800 shadow-2xl relative overflow-hidden group">
                             <div className="absolute top-0 right-0 -mr-10 -mt-10 opacity-5 group-hover:opacity-10 transition-opacity">
                                <ShieldAlert size={200} />
                             </div>
                             <div className="relative z-10">
                                <div className="flex justify-between mb-4">
                                    <span className="bg-red-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{record.type === 'robbery' ? 'Assalto' : 'Furto'}</span>
                                    <span className="text-[10px] font-mono text-zinc-500">{new Date(record.timestamp).toLocaleDateString()}</span>
                                </div>
                                <h3 className="text-3xl font-display font-black text-white mb-1 uppercase tracking-tighter">{record.vehiclePlate}</h3>
                                <p className="text-zinc-500 text-[10px] font-black uppercase mb-6 tracking-widest">{record.vehicleModel}</p>
                                
                                <div className="space-y-3 border-t border-zinc-800 pt-6">
                                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                                        <MapPin size={14} className="text-red-500" /> 
                                        <span className="truncate">{record.location.address}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                                        <FileText size={14} className="text-blue-500" /> 
                                        <span>B.O: {record.policeReport || 'Pendente'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                                        <DollarSign size={14} className="text-emerald-500" /> 
                                        <span>Valor: {formatCurrency(record.stolenValue || 0)}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 mt-8">
                                    <div className="flex gap-2">
                                        <Link to={`/map?tagId=${vehicles.find(v => v.id === record.vehicleId)?.tagId}&autoStart=true`} className="flex-1 bg-zinc-800 text-white py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all">
                                            <MapPin size={14} /> Rastrear
                                        </Link>
                                        <button 
                                            onClick={() => copyTrackingLink(record.trackingToken || '')}
                                            className="w-12 bg-zinc-800 text-zinc-400 hover:text-primary-500 py-3 rounded-2xl flex items-center justify-center transition-all"
                                            title="Copiar Link Policial"
                                        >
                                            <Share2 size={16} />
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleOpenRecoverModal(record)}
                                            className="flex-1 bg-emerald-500 text-black py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest hover:bg-emerald-400 transition-all"
                                        >
                                            <CheckCircle size={14} /> Recuperado
                                        </button>
                                        <button 
                                            onClick={() => { setSelectedRecordToRecover(record); setIsConfirmLostOpen(true); }}
                                            className="px-4 bg-zinc-800 text-zinc-400 py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all"
                                            title="Não Recuperado / Perda Total"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                             </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* History Area */}
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-zinc-400" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Histórico de Recuperações</h3>
                </div>
                <button onClick={loadData} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-400"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
            </div>
            
            {/* VIEW MOBILE: CARDS */}
            <div className="flex flex-col gap-4 p-4 md:hidden">
                {historyRecords.length === 0 ? <div className="text-center py-8 text-zinc-400 font-bold uppercase text-xs">Sem histórico</div> : (
                    historyRecords.map(record => (
                        <div key={record.id} className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-black text-zinc-900 dark:text-white uppercase">{record.vehiclePlate}</h4>
                                    <p className="text-[10px] text-zinc-500 uppercase">{record.vehicleModel}</p>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase ${record.status === 'recovered' ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                    {record.status === 'recovered' ? <CheckCircle size={10} /> : <X size={10} />}
                                    {record.status === 'recovered' ? 'Recuperado' : 'Perda Total'}
                                </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="text-[9px] font-bold bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-400 uppercase">{record.type === 'robbery' ? 'Assalto' : 'Furto'}</span>
                                <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded uppercase">{formatCurrency(record.recoveredValue || 0)}</span>
                            </div>
                            <p className="text-[9px] text-zinc-400 mt-3 border-t border-zinc-200 dark:border-zinc-800 pt-2">
                                {record.status === 'recovered' ? 'Recuperado em: ' : 'Finalizado em: '} 
                                {new Date(record.recoveredAt || record.lostAt || 0).toLocaleDateString()}
                            </p>
                        </div>
                    ))
                )}
            </div>

            {/* VIEW DESKTOP: TABLE */}
            <div className="hidden md:block overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-8 py-5">Veículo</th>
                            <th className="px-8 py-5">Tipo / B.O</th>
                            <th className="px-8 py-5">Valor Sinistrado</th>
                            <th className="px-8 py-5">Valor Recuperado</th>
                            <th className="px-8 py-5">Data Recuperação</th>
                            <th className="px-8 py-5 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                        {historyRecords.map(record => (
                            <tr key={record.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-8 py-5">
                                    <div className="font-black text-zinc-900 dark:text-white uppercase">{record.vehiclePlate}</div>
                                    <div className="text-[10px] font-bold text-zinc-400 uppercase mt-1">{record.vehicleModel}</div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{record.type === 'robbery' ? 'Assalto' : 'Furto'}</div>
                                    <div className="text-[10px] font-mono text-zinc-400 mt-1">B.O: {record.policeReport || 'N/A'}</div>
                                </td>
                                <td className="px-8 py-5 text-red-500 text-xs font-bold">{formatCurrency(record.stolenValue || 0)}</td>
                                <td className="px-8 py-5 text-emerald-500 text-xs font-bold">{formatCurrency(record.recoveredValue || 0)}</td>
                                <td className="px-8 py-5 text-zinc-500 text-xs">{record.recoveredAt || record.lostAt ? new Date(record.recoveredAt || record.lostAt || 0).toLocaleString() : '-'}</td>
                                <td className="px-8 py-5 text-right">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${record.status === 'recovered' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20'}`}>
                                        {record.status === 'recovered' ? 'Recuperado' : 'Perda Total'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        </div>

        {/* Modal Registrar Roubo */}
        {isModalOpen && (
             <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
                <div className="bg-white dark:bg-zinc-900 rounded-[40px] w-full max-w-xl p-8 md:p-10 shadow-2xl border border-red-500/20 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3 text-red-500">
                            <ShieldAlert size={32} />
                            <h2 className="text-2xl font-display font-black uppercase tracking-tight">Novo Sinistro</h2>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors"><X size={24}/></button>
                    </div>

                    <form onSubmit={handleReport} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* DATA DA OCORRÊNCIA */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Data do Evento</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <input 
                                        type="date" 
                                        required 
                                        value={eventDate} 
                                        onChange={e => setEventDate(e.target.value)} 
                                        className="w-full pl-11 pr-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-red-500 transition-all text-sm" 
                                    />
                                </div>
                            </div>

                            {/* TIPO DE OCORRÊNCIA */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Tipo de Sinistro</label>
                                <div className="grid grid-cols-2 gap-2 h-[46px]">
                                    <button type="button" onClick={() => setTheftType('theft')} className={`rounded-2xl font-black uppercase text-[9px] tracking-widest border transition-all ${theftType === 'theft' ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>Furto</button>
                                    <button type="button" onClick={() => setTheftType('robbery')} className={`rounded-2xl font-black uppercase text-[9px] tracking-widest border transition-all ${theftType === 'robbery' ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>Assalto</button>
                                </div>
                            </div>
                        </div>

                        {/* VEÍCULO ALVO */}
                        <div className="space-y-1 relative">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Veículo Alvo</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Digite Placa ou Modelo..." 
                                    value={selectedVehicle ? selectedVehicle.plate : vehicleSearch}
                                    onFocus={() => { setIsDropdownOpen(true); if(selectedVehicle) { setVehicleSearch(selectedVehicle.plate); setSelectedVehicle(null); } }}
                                    onChange={e => setVehicleSearch(e.target.value.toUpperCase())}
                                    className="w-full pl-11 pr-10 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-black outline-none focus:border-red-500 transition-all text-base uppercase" 
                                />
                                {selectedVehicle && <X className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 cursor-pointer" size={16} onClick={() => { setSelectedVehicle(null); setVehicleSearch(''); }} />}
                            </div>

                            {isDropdownOpen && !selectedVehicle && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[1100] overflow-hidden">
                                    {filteredVehicles.length === 0 ? (
                                        <div className="p-5 text-center text-xs font-bold text-zinc-400 uppercase italic">Nenhum veículo disponível</div>
                                    ) : (
                                        filteredVehicles.map(v => (
                                            <button key={v.id} type="button" onClick={() => { 
                                                setSelectedVehicle(v); 
                                                setIsDropdownOpen(false); 
                                                if (v.fipeValue) setStolenValue(v.fipeValue.toString());
                                            }} className="w-full p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between border-b last:border-0 border-zinc-100 dark:border-zinc-800 group text-left">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center text-zinc-400 group-hover:text-red-500"><Car size={16}/></div>
                                                    <div>
                                                        <span className="text-sm font-black uppercase text-zinc-900 dark:text-white block leading-none">{v.plate}</span>
                                                        <span className="text-[9px] font-bold text-zinc-500 uppercase">{v.model} {v.fipeValue ? `(FIPE: ${formatCurrency(v.fipeValue)})` : ''}</span>
                                                    </div>
                                                </div>
                                                <Plus size={14} className="text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* VALOR ESTIMADO */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Valor Estimado do Veículo (R$)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <input 
                                    type="number" 
                                    required
                                    value={stolenValue} 
                                    onChange={e => setStolenValue(e.target.value)} 
                                    className="w-full pl-11 pr-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-red-500 transition-all text-sm" 
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Boletim de Ocorrência (Opcional)</label>
                            <input type="text" value={policeReport} onChange={e => setPoliceReport(e.target.value)} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-red-500 font-bold text-sm" placeholder="Digite o nº do B.O..." />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Notas Operacionais</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-red-500 font-medium text-xs min-h-[100px]" placeholder="Informações adicionais relevantes..." />
                        </div>

                        <button 
                            type="submit" 
                            disabled={!selectedVehicle}
                            className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-red-600/30 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3"
                        >
                            <Activity size={18} /> Ativar Alerta Geral
                        </button>
                    </form>
                </div>
                {isDropdownOpen && !selectedVehicle && <div className="fixed inset-0 z-[1099]" onClick={() => setIsDropdownOpen(false)} />}
             </div>
        )}

        {/* Modal Recuperação */}
        {isRecoverModalOpen && (
             <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-[40px] w-full max-w-md p-8 shadow-2xl border border-emerald-500/20 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3 text-emerald-500">
                            <CheckCircle size={32} />
                            <h2 className="text-2xl font-display font-black uppercase tracking-tight">Recuperação</h2>
                        </div>
                        <button onClick={() => setIsRecoverModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors"><X size={24}/></button>
                    </div>

                    <p className="text-zinc-500 text-sm mb-6">Confirme a recuperação do veículo <strong>{selectedRecordToRecover?.vehiclePlate}</strong> e informe o valor recuperado (patrimônio salvo).</p>

                    <form onSubmit={handleRecover} className="space-y-6">
                        <div className="space-y-1">
                            <div className="flex justify-between items-end mb-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Valor Recuperado (R$)</label>
                                <button 
                                    type="button"
                                    onClick={() => addNotification('info', 'FIPE', 'Consulte o valor atualizado no cadastro do veículo ou insira manualmente.')}
                                    className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                                >
                                    <Search size={10} /> Consultar FIPE
                                </button>
                            </div>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <input 
                                    type="number" 
                                    required
                                    value={recoveredValue} 
                                    onChange={e => setRecoveredValue(e.target.value)} 
                                    className="w-full pl-11 pr-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-emerald-500 transition-all text-sm" 
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <CheckCircle size={18} /> Confirmar Recuperação
                        </button>
                    </form>
                </div>
             </div>
        )}

        <ConfirmModal 
            isOpen={isConfirmLostOpen}
            onClose={() => setIsConfirmLostOpen(false)}
            onConfirm={() => selectedRecordToRecover && handleMarkAsLost(selectedRecordToRecover)}
            title="Confirmar Perda Total"
            message={`Deseja marcar o veículo ${selectedRecordToRecover?.vehiclePlate} como NÃO RECUPERADO? Isso moverá o registro para o histórico como perda total.`}
            confirmText="Sim, Perda Total"
            cancelText="Voltar"
            type="danger"
        />
    </div>
  );
};
