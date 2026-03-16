
import React from 'react';
import { Wrench, Activity, RotateCcw, ClipboardCheck } from 'lucide-react';

interface ServiceTypesRowProps {
  data: {
    installation: number;
    maintenance: number;
    removal: number;
    inspection: number;
  };
}

export const ServiceTypesRow: React.FC<ServiceTypesRowProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-5 rounded-[24px] flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <Wrench size={20} strokeWidth={2.5}/>
            </div>
            <div>
                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block">Instalação</span>
                <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{data.installation}</span>
            </div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 p-5 rounded-[24px] flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                <Activity size={20} strokeWidth={2.5}/>
            </div>
            <div>
                <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest block">Manutenção</span>
                <span className="text-2xl font-black text-orange-700 dark:text-orange-300">{data.maintenance}</span>
            </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-5 rounded-[24px] flex items-center gap-4">
            <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                <RotateCcw size={20} strokeWidth={2.5}/>
            </div>
            <div>
                <span className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest block">Retirada</span>
                <span className="text-2xl font-black text-red-700 dark:text-red-300">{data.removal}</span>
            </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 p-5 rounded-[24px] flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                <ClipboardCheck size={20} strokeWidth={2.5}/>
            </div>
            <div>
                <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block">Vistoria</span>
                <span className="text-2xl font-black text-purple-700 dark:text-purple-300">{data.inspection}</span>
            </div>
        </div>
    </div>
  );
};
