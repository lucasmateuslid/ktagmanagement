
import * as React from 'react';
import { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { storage } from '../services/storage';
import { StolenRecord, Vehicle } from '../types';
import { ShieldAlert, AlertTriangle, Plus, Search, MapPin, CheckCircle, FileText, Calendar, Lock, Car, X, RefreshCw, Activity } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';

const { Link } = ReactRouterDOM as any;

export const Security = () => {
  const [activeRecords, setActiveRecords] = useState<StolenRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<StolenRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addNotification } = useNotification();

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [theftType, setTheftType] = useState<'theft' | 'robbery'>('theft');
  const [policeReport, setPoliceReport] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const [allRecords, allVehicles] = await Promise.all([
      storage.getStolenRecords(),
      storage.getVehicles()
    ]);
    setActiveRecords(allRecords.filter(r => r.status === 'open'));
    setHistoryRecords(allRecords.filter(r => r.status === 'recovered'));
    setVehicles(allVehicles);
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (!vehicle) return;

    let lastLocation = { lat: 0, lon: 0, address: 'Unknown' };
    if (vehicle.tagId) {
        const history = await storage.getLocations(vehicle.tagId);
        if (history.length > 0) {
            lastLocation = { lat: history[0].lat, lon: history[0].lon, address: 'Coordenadas Salvas' };
        }
    }

    const newRecord: StolenRecord = {
        id: crypto.randomUUID(),
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        vehicleModel: vehicle.model,
        type: theftType,
        timestamp: Date.now(),
        status: 'open',
        location: lastLocation,
        policeReport,
        notes
    };

    await storage.reportTheft(newRecord);
    addNotification('success', 'Alerta!', `O veículo ${vehicle.plate} foi marcado como roubado.`);
    setIsModalOpen(false);
    loadData();
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
                    <p className="text-zinc-500 mt-2 font-medium">Controle de sinistros e monitoramento de riscos da frota.</p>
                </div>
            </div>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-[20px] flex items-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-red-600/30 transition-all hover:scale-[1.02]"
            >
                <AlertTriangle size={20} /> Registrar Roubo
            </button>
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
                                    <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{record.type}</span>
                                    <span className="text-[10px] font-mono text-zinc-500">{new Date(record.timestamp).toLocaleDateString()}</span>
                                </div>
                                <h3 className="text-3xl font-display font-black text-white mb-1 uppercase tracking-tighter">{record.vehiclePlate}</h3>
                                <p className="text-zinc-500 text-xs font-bold uppercase mb-6">{record.vehicleModel}</p>
                                
                                <div className="space-y-3 border-t border-zinc-800 pt-6">
                                    <div className="flex items-center gap-3 text-xs text-zinc-400"><MapPin size={14} className="text-red-500" /> {record.location.lat.toFixed(5)}, {record.location.lon.toFixed(5)}</div>
                                    <div className="flex items-center gap-3 text-xs text-zinc-400"><FileText size={14} className="text-blue-500" /> B.O: {record.policeReport || 'Não informado'}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-8">
                                    <Link to={`/map?tagId=${vehicles.find(v => v.id === record.vehicleId)?.tagId}&autoStart=true`} className="bg-zinc-800 text-white py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all">Rastrear</Link>
                                    <button onClick={() => {}} className="bg-emerald-500 text-black py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest hover:bg-emerald-400 transition-all">Recuperado</button>
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
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Histórico de Ocorrências</h3>
                </div>
                <button onClick={loadData} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-400"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
            </div>
            <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-8 py-5">Veículo</th>
                            <th className="px-8 py-5">Tipo / B.O</th>
                            <th className="px-8 py-5">Data Início</th>
                            <th className="px-8 py-5">Recuperado Em</th>
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
                                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{record.type}</div>
                                    <div className="text-[10px] font-mono text-zinc-400 mt-1">B.O: {record.policeReport || 'N/A'}</div>
                                </td>
                                <td className="px-8 py-5 text-zinc-500 text-xs">{new Date(record.timestamp).toLocaleString()}</td>
                                <td className="px-8 py-5 text-zinc-500 text-xs">{record.recoveredAt ? new Date(record.recoveredAt).toLocaleString() : '-'}</td>
                                <td className="px-8 py-5 text-right">
                                    <span className="inline-flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-emerald-500/20">Recuperado</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        </div>

        {/* Modal reestilizado para Security */}
        {isModalOpen && (
             <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-[40px] w-full max-w-md p-10 shadow-2xl border border-red-500/20 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3 text-red-500">
                            <ShieldAlert size={32} />
                            <h2 className="text-2xl font-display font-black uppercase tracking-tight">Novo Sinistro</h2>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="text-zinc-400"><X/></button>
                    </div>
                    <form onSubmit={handleReport} className="space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500">Veículo Alvo</label>
                            <select required value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-red-500">
                                <option value="">Selecione...</option>
                                {vehicles.filter(v => v.status !== 'stolen').map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500">Tipo de Ocorrência</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => setTheftType('theft')} className={`py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest border transition-all ${theftType === 'theft' ? 'bg-red-500 text-white border-red-500' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>Furto</button>
                                <button type="button" onClick={() => setTheftType('robbery')} className={`py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest border transition-all ${theftType === 'robbery' ? 'bg-red-500 text-white border-red-500' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>Roubo</button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500">Boletim de Ocorrência</label>
                            <input type="text" value={policeReport} onChange={e => setPoliceReport(e.target.value)} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-red-500" placeholder="Opcional..." />
                        </div>
                        <button type="submit" className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-red-600/30 active:scale-95 transition-all">Ativar Alerta Geral</button>
                    </form>
                </div>
             </div>
        )}
    </div>
  );
};
