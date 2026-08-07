import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Tag, Vehicle, LocationHistory } from '../types';
import { fetchTagsLocationBatch } from '../services/api';
import { storage } from '../services/storage';

interface UpdateTagsModalProps {
    isOpen: boolean;
    onClose: () => void;
    tags: Tag[];
    vehicles: Vehicle[];
    onLocationsUpdated?: (locs: LocationHistory[]) => void;
}

export const UpdateTagsModal: React.FC<UpdateTagsModalProps> = ({ isOpen, onClose, tags, vehicles, onLocationsUpdated }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<{ tagId: string; status: 'success' | 'error'; label: string }[]>([]);
    
    // Filtramos apenas as tags que desejamos atualizar neste batch
    // (Apenas XADTAGs ou tags vinculadas a veículos)
    const tagsToUpdate = tags.filter(t => {
        const isLinked = vehicles.some(v => v.tagId === t.id);
        const isXad = t.type === 'XADTAG';
        return isLinked || isXad;
    });

    const handleUpdate = async () => {
        if (isUpdating || tagsToUpdate.length === 0) return;
        setIsUpdating(true);
        setResults([]);
        setProgress(0);

        try {
            const validLocs = await fetchTagsLocationBatch(tagsToUpdate, 3, (idx, total, currentTag) => {
                setProgress(Math.round((idx / total) * 100));
                
                // Vehicle label
                const v = vehicles.find(v => v.tagId === currentTag.id);
                // currentTag label uses id
            });

            // Processar salvamento
            for (const loc of validLocs) {
                const tagId = loc.tagId || '';
                const tag = tagsToUpdate.find(t => t.id === tagId);
                const v = vehicles.find(v => v.tagId === tagId);
                const label = v ? `${v.plate} / ${v.model}` : tag?.id || tagId;

                try {
                    // Atualiza veiculo se existir (caminho tenant-aware via storage)
                    if (v) {
                        // Histórico só quando a posição muda (dedup vs. lastPosition persistido)
                        await storage.updateVehiclePosition(v.id, loc as LocationHistory);
                    }

                    // Se logar sucesso do tag
                    setResults(prev => [{ tagId, status: 'success', label }, ...prev]);
                } catch (err) {
                    setResults(prev => [{ tagId, status: 'error', label }, ...prev]);
                }
            }

            // Notifica o mapa para refletir as novas posições imediatamente
            onLocationsUpdated?.(validLocs as LocationHistory[]);

            setProgress(100);
        } catch (error) {
            console.error('Update Tags flow error:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Atualização de Tags</h3>
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{tagsToUpdate.length} equipamentos suportados</p>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={isUpdating}
                                className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 flex flex-col gap-6 overflow-hidden flex-1">
                            {/* Actions / Progress */}
                            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center border border-zinc-100 dark:border-zinc-800">
                                {isUpdating || results.length > 0 ? (
                                    <div className="w-full flex flex-col gap-3">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-xs font-black uppercase text-zinc-600 dark:text-zinc-400">Progresso</span>
                                            <span className="text-xs font-black text-primary-500">{progress}%</span>
                                        </div>
                                        <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                            <motion.div 
                                                className="h-full bg-primary-500"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ ease: "linear" }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center">
                                            <RefreshCw size={32} />
                                        </div>
                                        <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400 max-w-sm">
                                            Inicie a varredura para atualizar as coordenadas de toda a sua frota / estoque em tempo real.
                                        </p>
                                    </>
                                )}

                                {!isUpdating && progress !== 100 && (
                                    <button
                                        onClick={handleUpdate}
                                        className="mt-2 w-full h-12 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-primary-500 hover:text-zinc-900 transition-colors"
                                    >
                                        Iniciar Atualização
                                    </button>
                                )}
                                
                                {!isUpdating && progress === 100 && (
                                    <button
                                        onClick={handleUpdate}
                                        className="mt-2 w-full h-12 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        Refazer Atualização
                                    </button>
                                )}
                            </div>

                            {/* Results list */}
                            {results.length > 0 && (
                                <div className="flex-1 overflow-y-auto min-h-[200px] border border-zinc-100 dark:border-zinc-800 rounded-2xl p-2 space-y-1">
                                    {results.map((res, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl">
                                            {res.status === 'success' ? (
                                                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                                            ) : (
                                                <AlertCircle size={18} className="text-red-500 shrink-0" />
                                            )}
                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
                                                {res.label}
                                            </span>
                                            <span className={`ml-auto text-[10px] font-black uppercase tracking-widest ${res.status === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {res.status === 'success' ? 'OK' : 'ERRO'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
