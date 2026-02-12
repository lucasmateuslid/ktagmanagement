
import React from 'react';
import { AlertCircle, Calendar, History } from 'lucide-react';

interface ScheduleTabsProps {
  isPrivileged: boolean;
  adminTab: 'pendentes' | 'agendados' | 'historico';
  setAdminTab: (tab: 'pendentes' | 'agendados' | 'historico') => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  showMyRequests: boolean;
}

export const ScheduleTabs: React.FC<ScheduleTabsProps> = ({
  isPrivileged,
  adminTab,
  setAdminTab,
  statusFilter,
  setStatusFilter,
  showMyRequests
}) => {
  // Removido o retorno nulo para permitir que o admin veja as abas de usuário quando 'isPrivileged' for passado como falso pelo pai

  return (
    <div className={`flex p-1 rounded-2xl w-full md:w-auto overflow-x-auto ${isPrivileged ? 'gap-3' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
        {isPrivileged ? (
            <>
                <button 
                    onClick={() => setAdminTab('pendentes')} 
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${adminTab === 'pendentes' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                    <AlertCircle size={14} className={adminTab === 'pendentes' ? 'text-amber-500' : ''}/> Pendentes
                </button>
                <button 
                    onClick={() => setAdminTab('agendados')} 
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${adminTab === 'agendados' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                    <Calendar size={14} className={adminTab === 'agendados' ? 'text-blue-500' : ''}/> Agendados
                </button>
                <button 
                    onClick={() => setAdminTab('historico')} 
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${adminTab === 'historico' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                    <History size={14} className={adminTab === 'historico' ? 'text-zinc-500' : ''}/> Histórico
                </button>
            </>
        ) : (
            <>
                <button onClick={() => setStatusFilter('active')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'active' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}>Em Andamento</button>
                <button onClick={() => setStatusFilter('completed')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'completed' ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}>Histórico</button>
            </>
        )}
    </div>
  );
};
