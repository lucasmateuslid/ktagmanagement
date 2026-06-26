
import React from 'react';
import { LayoutGrid } from 'lucide-react';

export const EmptyState: React.FC = () => {
  return (
    <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-30 gap-4">
        <LayoutGrid size={48} className="text-zinc-400 dark:text-zinc-600"/>
        <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Nenhuma solicitação nesta aba</span>
    </div>
  );
};
