import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, CheckCircle2, XCircle, Play, FileSpreadsheet, Activity } from 'lucide-react';
import { Vehicle } from '../../../types';

const MotionDiv = motion.div as any;
const MotionTr = motion.tr as any;

interface VehicleScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicles: Vehicle[];
}

interface ScanResult {
    plate: string;
    found: boolean;
    model?: string;
    tagLinked?: string;
    createdAt?: number;
    createdBy?: string;
    equipamentStatus?: string;
}

export const VehicleScanModal: React.FC<VehicleScanModalProps> = ({ isOpen, onClose, vehicles }) => {
    const [platesInput, setPlatesInput] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [results, setResults] = useState<ScanResult[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    
    // Derived stats
    const totalLines = platesInput.split('\n').map(p => p.trim()).filter(p => p.length > 0).length;
    const scannedCount = results.length;
    const foundCount = results.filter(r => r.found).length;
    const notFoundCount = results.filter(r => !r.found).length;

    useEffect(() => {
        if (!isOpen) {
            setPlatesInput('');
            setIsScanning(false);
            setResults([]);
            setCurrentIndex(-1);
        }
    }, [isOpen]);

    const startScan = async () => {
        const plates = platesInput.split('\n').map(p => p.trim().toUpperCase()).filter(p => p.length > 0);
        if (plates.length === 0) return;
        
        setIsScanning(true);
        setResults([]);
        
        for (let i = 0; i < plates.length; i++) {
            setCurrentIndex(i);
            const rawPlate = plates[i];
            const cleanPlate = rawPlate.replace(/[^A-Za-z0-9]/g, '');
            
            // Artificial delay for visual effect
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const v = vehicles.find(v => v.plate.replace(/[^A-Za-z0-9]/g, '') === cleanPlate);
            
            let tagInfo = 'Sem Tag';
            let equipText = 'Sem Equipamento';
            if (v) {
                if (v.installationType === 'tag_tracker') equipText = 'Rastreador + Tag';
                else if (v.installationType === 'tag_only') equipText = 'Somente Tag';
                else equipText = 'Não definido';
                
                if (v.tagId) tagInfo = `Vinculada (${v.tagId})`;
            }

            setResults(prev => [...prev, {
                plate: rawPlate,
                found: !!v,
                model: v?.model,
                tagLinked: tagInfo,
                createdAt: v?.createdAt,
                createdBy: v?.createdByName || 'N/A',
                equipamentStatus: equipText
            }]);
        }
        
        setCurrentIndex(-1);
        setIsScanning(false);
    };

    const handleExport = async () => {
        try {
            const XLSX = await import('xlsx');
            const data = results.map(r => ({
                "Placa Buscada": r.plate,
                "Encontrado?": r.found ? "SIM" : "NÃO",
                "Modelo": r.model || "-",
                "Equipamento": r.equipamentStatus || "-",
                "Status Tag": r.tagLinked || "-",
                "Data Cadastro": r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : "-",
                "Cadastrado Por": r.createdBy || "-"
            }));
            
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Varredura");
            XLSX.writeFile(wb, `Resultado_Varredura_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (e) {
            console.error("Export error", e);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <MotionDiv
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={!isScanning ? onClose : undefined}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <MotionDiv
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
                <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-500/10 text-primary-500 rounded-2xl flex items-center justify-center">
                            <Search size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Varredura de Placas</h2>
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Verificação em lote</p>
                        </div>
                    </div>
                    {!isScanning && (
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-xl transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-6">
                    {/* Input Section */}
                    {results.length === 0 && !isScanning ? (
                        <div className="flex-1 flex flex-col gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1 mb-2 block">
                                    Insira as placas (uma por linha)
                                </label>
                                <textarea
                                    value={platesInput}
                                    onChange={e => setPlatesInput(e.target.value)}
                                    placeholder="AAA1234&#10;ABC1D23"
                                    className="w-full h-[300px] bg-zinc-50 dark:bg-black p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:border-primary-500 transition-colors font-mono text-sm resize-none"
                                />
                            </div>
                            <button
                                onClick={startScan}
                                disabled={totalLines === 0}
                                className="w-full py-4 bg-primary-500 text-black rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-primary-600 transition-all disabled:opacity-50"
                            >
                                <Play size={16} /> Iniciar Varredura ({totalLines} linhas)
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col h-[500px]">
                            {/* Scanning Progress Header */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-zinc-50 dark:bg-black p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-zinc-900 dark:text-white">{scannedCount}/{totalLines}</span>
                                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Processados</span>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-500">{foundCount}</span>
                                    <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-500 tracking-widest">Encontrados</span>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-200 dark:border-red-800 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-red-600 dark:text-red-500">{notFoundCount}</span>
                                    <span className="text-[9px] font-black uppercase text-red-600 dark:text-red-500 tracking-widest">Não Cadastros</span>
                                </div>
                            </div>
                            
                            {isScanning && (
                                <div className="mb-4 flex items-center justify-center gap-2 text-primary-500">
                                    <Activity size={16} className="animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Consultando base de dados...</span>
                                </div>
                            )}

                            {/* Results Table */}
                            <div className="flex-1 overflow-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-50 dark:bg-black sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Placa</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Status</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Modelo</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Cadastro</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <AnimatePresence>
                                            {results.map((r, i) => (
                                                <MotionTr
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    key={i}
                                                    className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/20"
                                                >
                                                    <td className="px-4 py-3 font-mono text-xs font-bold">{r.plate}</td>
                                                    <td className="px-4 py-3">
                                                        {r.found ? (
                                                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
                                                                <CheckCircle2 size={14} />
                                                                <span className="text-[10px] uppercase font-bold">Cadastrado</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500">
                                                                <XCircle size={14} />
                                                                <span className="text-[10px] uppercase font-bold">Não Encontrado</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {r.found ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-zinc-900 dark:text-white line-clamp-1">{r.model}</span>
                                                                <span className="text-[10px] text-zinc-500">{r.equipamentStatus} • {r.tagLinked}</span>
                                                            </div>
                                                        ) : <span className="text-zinc-400">-</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {r.found ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-zinc-900 dark:text-white">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : '-'}</span>
                                                                <span className="text-[10px] text-zinc-500">{r.createdBy}</span>
                                                            </div>
                                                        ) : <span className="text-zinc-400">-</span>}
                                                    </td>
                                                </MotionTr>
                                            ))}
                                        </AnimatePresence>
                                        
                                        {isScanning && currentIndex !== -1 && (
                                            <tr className="bg-zinc-50/50 dark:bg-black/50">
                                                <td className="px-4 py-3 font-mono text-xs text-zinc-400">{platesInput.split('\n')[currentIndex].trim().toUpperCase()}</td>
                                                <td className="px-4 py-3 flex items-center gap-2 text-zinc-400"><Activity size={14} className="animate-spin"/> <span className="text-[10px] uppercase font-bold">Lendo...</span></td>
                                                <td></td>
                                                <td></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {results.length > 0 && !isScanning && (
                    <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-black flex justify-between items-center">
                        <button onClick={() => {setResults([]); setPlatesInput('');}} className="px-4 py-3 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                            Nova Varredura
                        </button>
                        <button onClick={handleExport} className="px-6 py-3 bg-primary-500 text-black hover:bg-primary-600 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all">
                            <FileSpreadsheet size={16}/> Baixar Relatório (Excel)
                        </button>
                    </div>
                )}
            </MotionDiv>
        </div>
    );
};
