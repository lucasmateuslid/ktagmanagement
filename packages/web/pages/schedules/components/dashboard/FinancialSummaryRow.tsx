
import React from 'react';
import { DollarSign, Map as MapIcon } from 'lucide-react';

interface FinancialSummaryRowProps {
  data: {
    totalRevenue: number;
    totalDisplacement: number;
    completed: number;
    scheduled: number;
    byTech: [string, number][];
    byService: [string, number][];
  };
}

export const FinancialSummaryRow: React.FC<FinancialSummaryRowProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-zinc-900 text-white p-8 rounded-[32px] border border-zinc-800 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Valor Total (Mês)</span>
                <h2 className="text-4xl font-display font-black mt-2 tracking-tight">R$ {data.totalRevenue.toFixed(2)}</h2>
                <p className="text-[10px] text-zinc-600 mt-1">{data.completed + data.scheduled} serviços contabilizados</p>
            </div>
            <DollarSign size={120} className="absolute -bottom-10 -right-6 text-zinc-800 opacity-50" />
        </div>
        
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gasto Deslocamento</span>
                <h2 className="text-4xl font-display font-black mt-2 tracking-tight text-zinc-900 dark:text-white">R$ {data.totalDisplacement.toFixed(2)}</h2>
                <p className="text-[10px] text-zinc-400 mt-1">Incluído no total</p>
            </div>
            <MapIcon size={100} className="absolute -bottom-6 -right-6 text-zinc-100 dark:text-zinc-800" />
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-4">Por Técnico</span>
            <div className="space-y-3">
                {data.byTech.map(([name, val], i) => (
                    <div key={i} className="flex justify-between items-center text-xs border-b border-zinc-50 dark:border-zinc-800 pb-2 last:border-0">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">{name}</span>
                        <span className="font-mono font-black text-zinc-900 dark:text-white">R$ {val.toFixed(2)}</span>
                    </div>
                ))}
                {data.byTech.length === 0 && <span className="text-[10px] text-zinc-400 italic">Sem dados</span>}
            </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-4">Por Serviço</span>
            <div className="space-y-3">
                {data.byService.map(([name, val], i) => (
                    <div key={i} className="flex justify-between items-center text-xs border-b border-zinc-50 dark:border-zinc-800 pb-2 last:border-0">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">{name}</span>
                        <span className="font-mono font-black text-zinc-900 dark:text-white">R$ {val.toFixed(2)}</span>
                    </div>
                ))}
                {data.byService.length === 0 && <span className="text-[10px] text-zinc-400 italic">Sem dados</span>}
            </div>
        </div>
    </div>
  );
};
