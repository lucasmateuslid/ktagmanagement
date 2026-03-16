
export const getStatusStyle = (status: string) => {
  switch (status) {
      case 'Autorizada': return { color: '#10b981', badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30', badgeText: 'text-emerald-700 dark:text-emerald-300' };
      case 'Em orçamento': return { color: '#f59e0b', badgeBg: 'bg-amber-100 dark:bg-amber-900/30', badgeText: 'text-amber-700 dark:text-amber-400' };
      case 'Em análise': return { color: '#f59e0b', badgeBg: 'bg-amber-50 dark:bg-amber-900/10', badgeText: 'text-amber-600 dark:text-amber-400' };
      case 'Solicitada': return { color: '#a1a1aa', badgeBg: 'bg-zinc-100 dark:bg-zinc-800', badgeText: 'text-zinc-600 dark:text-zinc-400' };
      case 'Confirmada': return { color: '#06b6d4', badgeBg: 'bg-cyan-100 dark:bg-cyan-900/30', badgeText: 'text-cyan-700 dark:text-cyan-300' };
      case 'Concluída': return { color: '#14b8a6', badgeBg: 'bg-teal-100 dark:bg-teal-900/30', badgeText: 'text-teal-700 dark:text-teal-300' };
      case 'Cancelada': return { color: '#ef4444', badgeBg: 'bg-red-100 dark:bg-red-900/30', badgeText: 'text-red-700 dark:text-red-300' };
      default: return { color: '#a1a1aa', badgeBg: 'bg-zinc-100 dark:bg-zinc-800', badgeText: 'text-zinc-600' };
  }
};
