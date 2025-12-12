
import * as React from 'react';
import { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { StolenRecord, Vehicle } from '../types';
import { ShieldAlert, AlertTriangle, Plus, Search, MapPin, CheckCircle, FileText, Calendar, Lock, Car, X, RefreshCw } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { Link } from 'react-router-dom';

export const Security = () => {
  const [activeRecords, setActiveRecords] = useState<StolenRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<StolenRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addNotification } = useNotification();

  // Form State
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

  useEffect(() => {
    loadData();
  }, []);

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return;

    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (!vehicle) return;

    // Fetch Last Location
    let lastLocation = { lat: 0, lon: 0, address: 'Unknown' };
    if (vehicle.tagId) {
        const history = await storage.getLocations(vehicle.tagId);
        if (history.length > 0) {
            lastLocation = { 
                lat: history[0].lat, 
                lon: history[0].lon, 
                address: `${history[0].lat}, ${history[0].lon}` // We could reverse geocode here if needed
            };
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
    addNotification('success', 'Alerta Registrado', `Veículo ${vehicle.plate} marcado como roubado.`);
    setIsModalOpen(false);
    resetForm();
    loadData();
  };

  const handleRecover = async (record: StolenRecord) => {
    if (confirm(`Confirmar recuperação do veículo ${record.vehiclePlate}?`)) {
        await storage.recoverVehicle(record.id, record.vehicleId);
        addNotification('success', 'Recuperado', 'Veículo marcado como ativo novamente.');
        loadData();
    }
  };

  const resetForm = () => {
    setSelectedVehicleId('');
    setTheftType('theft');
    setPoliceReport('');
    setNotes('');
  };

  return (
    <div className="space-y-8 pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
                    <ShieldAlert size={32} />
                    <h1 className="text-3xl font-display font-bold text-zinc-900 dark:text-white">
                        Centro de Segurança
                    </h1>
                </div>
                <p className="text-zinc-500 text-sm">Gestão de alertas de roubo, furto e histórico de sinistros.</p>
            </div>
            
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-red-500/20 transition-all hover:scale-105"
            >
                <AlertTriangle size={20} /> Registrar Sinistro
            </button>
        </div>

        {/* Active Alerts Grid */}
        <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Alertas Ativos ({activeRecords.length})
            </h2>
            
            {activeRecords.length === 0 ? (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                    <CheckCircle size={48} className="text-emerald-500 mb-2" />
                    <h3 className="text-emerald-800 dark:text-emerald-200 font-bold text-lg">Sem Veículos Roubados</h3>
                    <p className="text-emerald-600 dark:text-emerald-400 text-sm">A frota está segura no momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeRecords.map(record => (
                        <div key={record.id} className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ShieldAlert size={100} className="text-red-600" />
                            </div>
                            
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                                        {record.type === 'robbery' ? 'Roubo (Assalto)' : 'Furto'}
                                    </span>
                                    <span className="text-xs font-mono text-red-700 dark:text-red-300">
                                        {new Date(record.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                
                                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{record.vehiclePlate}</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{record.vehicleModel}</p>
                                
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                                        <MapPin size={14} className="text-red-500" />
                                        <span>Última Loc: {record.location.lat.toFixed(5)}, {record.location.lon.toFixed(5)}</span>
                                    </div>
                                    {record.policeReport && (
                                        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                                            <FileText size={14} className="text-blue-500" />
                                            <span>B.O: {record.policeReport}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6 z-10">
                                <Link 
                                    to={`/map?tagId=${vehicles.find(v => v.id === record.vehicleId)?.tagId}&autoStart=true`}
                                    className="flex-1 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                                >
                                    <MapPin size={16} /> Rastrear
                                </Link>
                                <button 
                                    onClick={() => handleRecover(record)}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                                >
                                    <CheckCircle size={16} /> Recuperado
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* History Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center">
                <h3 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <Calendar size={18} className="text-zinc-500" /> Histórico de Sinistros
                </h3>
                <button onClick={loadData} className="text-zinc-400 hover:text-primary-500 p-1 rounded">
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                        <tr>
                            <th className="px-6 py-3">Data/Hora</th>
                            <th className="px-6 py-3">Veículo</th>
                            <th className="px-6 py-3">Tipo</th>
                            <th className="px-6 py-3">B.O.</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Recuperado Em</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {historyRecords.map(record => (
                            <tr key={record.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td className="px-6 py-4 text-zinc-500">{new Date(record.timestamp).toLocaleString()}</td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-zinc-900 dark:text-white">{record.vehiclePlate}</div>
                                    <div className="text-xs text-zinc-500">{record.vehicleModel}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${record.type === 'robbery' ? 'text-red-600 bg-red-100' : 'text-orange-600 bg-orange-100'}`}>
                                        {record.type === 'robbery' ? 'Roubo' : 'Furto'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-zinc-500 font-mono">{record.policeReport || '-'}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 rounded text-xs font-bold uppercase text-emerald-600 bg-emerald-100">
                                        Recuperado
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-zinc-500">
                                    {record.recoveredAt ? new Date(record.recoveredAt).toLocaleString() : '-'}
                                </td>
                            </tr>
                        ))}
                        {historyRecords.length === 0 && (
                             <tr><td colSpan={6} className="p-8 text-center text-zinc-400">Nenhum histórico encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Modal: Report Theft */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-200 dark:border-red-900/30 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                            <AlertTriangle /> Registrar Roubo/Furto
                        </h2>
                        <button onClick={() => setIsModalOpen(false)}><X className="text-zinc-400 hover:text-zinc-600" /></button>
                    </div>

                    <form onSubmit={handleReport} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Veículo</label>
                            <div className="relative">
                                <Car size={18} className="absolute left-3 top-3 text-zinc-400" />
                                <select 
                                    required
                                    value={selectedVehicleId}
                                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-red-500"
                                >
                                    <option value="">Selecione o veículo...</option>
                                    {vehicles.filter(v => v.status !== 'stolen').map(v => (
                                        <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Tipo de Sinistro</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    type="button"
                                    onClick={() => setTheftType('theft')}
                                    className={`py-2 rounded-lg font-bold text-sm border transition-all ${theftType === 'theft' ? 'bg-orange-100 border-orange-500 text-orange-700' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}
                                >
                                    FURTO (Ausente)
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setTheftType('robbery')}
                                    className={`py-2 rounded-lg font-bold text-sm border transition-all ${theftType === 'robbery' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}
                                >
                                    ROUBO (Assalto)
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Boletim de Ocorrência (Opcional)</label>
                            <input 
                                type="text"
                                value={policeReport}
                                onChange={e => setPoliceReport(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="Número do B.O."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Notas Adicionais</label>
                            <textarea 
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-red-500 h-24 resize-none"
                                placeholder="Detalhes do ocorrido..."
                            />
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                             <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                             <p>Ao registrar, o veículo será marcado como ROUBADO e a última localização conhecida será salva no histórico de segurança.</p>
                        </div>

                        <button 
                            type="submit"
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                        >
                            <ShieldAlert size={20} /> CONFIRMAR ALERTA
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
