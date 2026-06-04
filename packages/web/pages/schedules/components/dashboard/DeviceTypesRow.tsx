
import React from 'react';
import { Tag, Radio, Layers } from 'lucide-react';

interface DeviceTypesRowProps {
  data: {
    deviceTagOnly: number;
    deviceTrackerOnly: number;
    deviceCombo: number;
  };
}

export const DeviceTypesRow: React.FC<DeviceTypesRowProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 p-5 rounded-[24px] flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Tag size={20} strokeWidth={2.5}/>
            </div>
            <div>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Só Tag</span>
                <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{data.deviceTagOnly}</span>
            </div>
        </div>
        <div className="bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/20 p-5 rounded-[24px] flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/30">
                <Radio size={20} strokeWidth={2.5}/>
            </div>
            <div>
                <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest block">Só Rastreador</span>
                <span className="text-2xl font-black text-sky-700 dark:text-sky-300">{data.deviceTrackerOnly}</span>
            </div>
        </div>
        <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/20 p-5 rounded-[24px] flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
                <Layers size={20} strokeWidth={2.5}/>
            </div>
            <div>
                <span className="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest block">Rastreador + Tag</span>
                <span className="text-2xl font-black text-violet-700 dark:text-violet-300">{data.deviceCombo}</span>
            </div>
        </div>
    </div>
  );
};
