
import React from 'react';

export const EmptyState: React.FC = () => {
  return (
    <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-60 gap-6 overflow-hidden">
        <div className="w-full max-w-[300px] h-16 relative flex items-end justify-center border-b border-dashed border-zinc-300 dark:border-zinc-700">
            
            {/* Cacto 1 */}
            <div className="absolute left-10 bottom-0 text-emerald-600/30 dark:text-emerald-500/20">
                <svg width="24" height="32" viewBox="0 0 24 32" fill="currentColor">
                    <path d="M10 32V10a2 2 0 014 0v22h-4z" />
                    <path d="M6 14v4a2 2 0 002 2h2v-4H8v-2a2 2 0 00-2-2z" />
                    <path d="M18 10v6a2 2 0 01-2 2h-2v-4h2v-4a2 2 0 012-2z" />
                </svg>
            </div>
            
            {/* Cacto 2 */}
            <div className="absolute right-12 bottom-0 text-emerald-600/20 dark:text-emerald-500/10 transform scale-75">
                <svg width="24" height="32" viewBox="0 0 24 32" fill="currentColor">
                    <path d="M10 32V6a2 2 0 014 0v26h-4z" />
                    <path d="M6 18v3a2 2 0 002 2h2v-4H8v-1a2 2 0 00-2-2z" />
                    <path d="M18 12v5a2 2 0 01-2 2h-2v-4h2v-3a2 2 0 012-2z" />
                </svg>
            </div>

            <div className="absolute animate-tumbleweed-x w-full flex justify-center z-10">
                <div className="animate-tumbleweed-y text-amber-700/80 dark:text-amber-600/60">
                    <div className="animate-tumbleweed-spin origin-center">
                        <svg width="40" height="40" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M50 10 C25 10, 10 25, 10 50 C10 75, 25 90, 50 90 C75 90, 90 75, 90 50 C90 25, 75 10, 50 10 Z" strokeDasharray="6 8" />
                            <path d="M20 50 Q30 20 50 30 T80 50" />
                            <path d="M30 80 Q20 50 40 40 T70 80" />
                            <path d="M80 30 Q50 10 60 40 T20 70" />
                            <path d="M50 90 Q70 60 40 50 T10 30" />
                            <path d="M35 35 Q50 50 65 35" />
                            <path d="M35 65 Q50 50 65 65" />
                            <path d="M40 20 Q50 40 60 20" />
                            <path d="M40 80 Q50 60 60 80" />
                            <path d="M15 45 Q35 50 15 55" />
                            <path d="M85 45 Q65 50 85 55" />
                            <path d="M25 25 Q50 15 75 25" />
                            <path d="M25 75 Q50 85 75 75" />
                            <path d="M50 20 L50 80" strokeDasharray="3 6" />
                            <path d="M20 50 L80 50" strokeDasharray="3 6" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
        <span className="text-xs font-black text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-2">Nenhuma solicitação por aqui...</span>
    </div>
  );
};
