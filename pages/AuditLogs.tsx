
import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { storage } from '../services/storage';
import { AuditLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  ClipboardList, 
  RefreshCw, 
  Search, 
  ShieldAlert, 
  User, 
  Filter, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  X,
  Database
} from 'lucide-react';

export const AuditLogs = () => {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const loadData = async () => {
    setLoading(true);
    if (isAdmin) {
      const data = await storage.getAuditLogs(500); 
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [isAdmin]);

  const filteredLogs = useMemo(() => {
    let res = [...logs];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      res = res.filter(l => l.userName.toLowerCase().includes(term) || l.details.toLowerCase().includes(term));
    }
    if (filterAction !== 'ALL') res = res.filter(l => l.action === filterAction);
    res.sort((a, b) => sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);
    return res;
  }, [logs, searchTerm, filterAction, sortOrder]);

  const currentItems = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!isAdmin) return <div className="py-20 text-center text-zinc-500 uppercase font-black">Acesso Restrito</div>;

  return (
    <div className="space-y-8 pb-20 font-sans">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 rounded-[24px] bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/10"><ClipboardList size={32} /></div>
             <div>
                <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Audit Trail</h1>
                <p className="text-zinc-500 mt-2 font-medium">Histórico de ações e trilha de segurança do sistema.</p>
             </div>
          </div>
          <button onClick={loadData} className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-indigo-500 transition-all"><RefreshCw size={20} className={loading ? 'animate-spin' : ''}/></button>
       </div>

       <div className="bg-white dark:bg-zinc-900 p-3 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="text" placeholder="Buscar no log..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-zinc-900 dark:text-white" />
          </div>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-500 outline-none">
              <option value="ALL">Todas as Ações</option>
              <option value="CREATE">Criação</option>
              <option value="UPDATE">Edição</option>
              <option value="DELETE">Exclusão</option>
              <option value="LOGIN">Login</option>
          </select>
       </div>

       <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <table className="w-full text-left">
              <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                      <th className="px-8 py-5">Timestamp</th>
                      <th className="px-8 py-5">Colaborador</th>
                      <th className="px-8 py-5">Operação</th>
                      <th className="px-8 py-5">Entidade</th>
                      <th className="px-8 py-5">Detalhes</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {currentItems.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-8 py-5 text-zinc-500 font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black">{log.userName.charAt(0)}</div>
                                  <div className="font-bold text-zinc-900 dark:text-zinc-200 text-xs truncate max-w-[150px]">{log.userName}</div>
                              </div>
                          </td>
                          <td className="px-8 py-5">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${log.action === 'DELETE' ? 'bg-red-500/10 text-red-500 border-red-500/20' : log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>{log.action}</span>
                          </td>
                          <td className="px-8 py-5 text-zinc-400 font-black uppercase text-[10px]">{log.entity}</td>
                          <td className="px-8 py-5 text-zinc-500 text-xs break-words max-w-xs">{log.details}</td>
                      </tr>
                  ))}
              </tbody>
          </table>
          <div className="p-8 border-t border-zinc-50 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/30 dark:bg-zinc-950/20">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Página {currentPage} de {Math.ceil(filteredLogs.length / itemsPerPage)}</span>
              <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-indigo-500 transition-all"><ChevronLeft size={18}/></button>
                  <button onClick={() => setCurrentPage(p => p + 1)} className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-indigo-500 transition-all"><ChevronRight size={18}/></button>
              </div>
          </div>
       </div>
    </div>
  );
};
