import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';
import type { Vehicle, LocationHistory } from '../types';
import { trackingApi, type FleetRefreshReport } from '../services/trackingApi';

interface UpdateTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  onLocationsUpdated?: (locations: LocationHistory[]) => void;
}

const statusLabel = { updated: 'Atualizado', unchanged: 'Sem mudança', no_tag: 'Sem tag', no_position: 'Sem posição', error: 'Erro' } as const;

export const UpdateTagsModal: React.FC<UpdateTagsModalProps> = ({ isOpen, onClose, vehicles, onLocationsUpdated }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [report, setReport] = useState<FleetRefreshReport | null>(null);
  const [error, setError] = useState('');

  const handleUpdate = async () => {
    if (isUpdating || vehicles.length === 0) return;
    setIsUpdating(true); setReport(null); setError('');
    try {
      const next = report?.busy ? await trackingApi.latestFleetRefresh() : await trackingApi.refreshFleet();
      setReport(next);
      onLocationsUpdated?.(next.locations as LocationHistory[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a frota.');
    } finally { setIsUpdating(false); }
  };

  return <AnimatePresence>{isOpen && (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: .95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .95, y: 20 }} className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 p-6 dark:border-zinc-800">
          <div><h3 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Atualizar toda a frota</h3><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{vehicles.length} veículos</p></div>
          <button onClick={onClose} disabled={isUpdating} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 disabled:opacity-50 dark:bg-zinc-800"><X size={20} /></button>
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-hidden p-6">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-5 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <RefreshCw size={32} className={`text-primary-500 ${isUpdating ? 'animate-spin' : ''}`} />
            <p className="max-w-lg text-sm font-bold text-zinc-600 dark:text-zinc-400">{isUpdating ? 'Atualizando posições e endereços…' : report?.busy ? 'Atualização em andamento.' : report ? 'Atualização concluída.' : 'Atualize agora as posições e os endereços da frota.'}</p>
            <button onClick={handleUpdate} disabled={isUpdating || vehicles.length === 0} className="h-12 w-full rounded-xl bg-zinc-900 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-primary-500 hover:text-zinc-900 disabled:opacity-50 dark:bg-white dark:text-zinc-900">{isUpdating ? 'Atualizando…' : report?.busy ? 'Verificar novamente' : report ? 'Atualizar novamente' : 'Atualizar agora'}</button>
            {error && <p className="text-xs font-bold text-red-500">{error}</p>}
          </div>
          {report && !report.busy && <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['Veículos', report.summary.totalVehicles], ['Posições', report.summary.positionsUpdated], ['Endereços', report.summary.addressesResolved], ['Erros', report.summary.errors]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"><div className="text-lg font-black text-zinc-900 dark:text-white">{value}</div><div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</div></div>)}
            </div>
            <div className="min-h-[180px] flex-1 space-y-1 overflow-y-auto rounded-2xl border border-zinc-100 p-2 dark:border-zinc-800">
              {report.vehicles.map(item => {
                const success = item.status === 'updated'; const failed = item.status === 'error';
                return <div key={item.vehicleId} className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
                  {success ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" /> : failed ? <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" /> : <MinusCircle size={18} className="mt-0.5 shrink-0 text-zinc-400" />}
                  <div className="min-w-0"><div className="truncate text-xs font-black text-zinc-800 dark:text-zinc-200">{item.plate} {item.model && `· ${item.model}`}</div><div className="truncate text-[10px] text-zinc-500">{item.address || item.error || (item.tagIdentifier ? `Tag ${item.tagIdentifier}` : 'Veículo sem tag vinculada')}</div></div>
                  <span className={`ml-auto shrink-0 text-[9px] font-black uppercase tracking-widest ${success ? 'text-emerald-500' : failed ? 'text-red-500' : 'text-zinc-400'}`}>{statusLabel[item.status]}</span>
                </div>;
              })}
            </div>
          </>}
        </div>
      </motion.div>
    </div>
  )}</AnimatePresence>;
};
