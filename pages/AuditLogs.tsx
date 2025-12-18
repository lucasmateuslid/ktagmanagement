
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
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  X,
  Database,
  Tag as TagIcon,
  User as UserIcon,
  Car,
  ShieldAlert,
  Settings as SettingsIcon,
  Download,
  FileText,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const AuditLogs = () => {
  const { isAdmin, user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterEntity, setFilterEntity] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const loadData = async () => {
    setLoading(true);
    if (isAdmin) {
      const data = await storage.getAuditLogs(2000); 
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [isAdmin]);

  const entities = useMemo(() => {
    const set = new Set(logs.map(l => l.entity));
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let res = [...logs];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      res = res.filter(l => 
        l.userName.toLowerCase().includes(term) || 
        l.details.toLowerCase().includes(term) ||
        l.entityId?.toLowerCase().includes(term)
      );
    }
    
    if (filterAction !== 'ALL') res = res.filter(l => l.action === filterAction);
    if (filterEntity !== 'ALL') res = res.filter(l => l.entity === filterEntity);
    
    if (startDate) {
      const startTs = new Date(startDate + 'T00:00:00').getTime();
      res = res.filter(l => l.timestamp >= startTs);
    }
    if (endDate) {
      const endTs = new Date(endDate + 'T23:59:59').getTime();
      res = res.filter(l => l.timestamp <= endTs);
    }

    res.sort((a, b) => sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);
    return res;
  }, [logs, searchTerm, filterAction, filterEntity, startDate, endDate, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterAction('ALL');
    setFilterEntity('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(24, 24, 27);
    doc.text("Relatório de Auditoria K-Tag", 14, 20);
    
    const tableData = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      `${log.userName} (${log.userEmail})`,
      log.action,
      log.entity,
      log.details
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Timestamp', 'Usuário', 'Ação', 'Entidade', 'Detalhes']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [24, 24, 27] },
      styles: { fontSize: 8 }
    });

    doc.save(`audit_logs_${Date.now()}.pdf`);
  };

  const getEntityIcon = (entity: string) => {
    switch (entity.toLowerCase()) {
      case 'vehicle': return <Car size={14} />;
      case 'tag': return <TagIcon size={14} />;
      case 'user': return <UserIcon size={14} />;
      case 'settings': return <SettingsIcon size={14} />;
      case 'report': return <ShieldAlert size={14} />;
      default: return <Database size={14} />;
    }
  };

  if (!isAdmin) return <div className="py-20 text-center text-zinc-500 uppercase font-black">Acesso Restrito</div>;

  return (
    <div className="space-y-8 pb-20 font-sans">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 rounded-[28px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-primary-500 border border-zinc-800 shadow-xl shrink-0">
                <ClipboardList size={32} />
             </div>
             <div>
                <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Audit Trail</h1>
                <p className="text-zinc-500 mt-2 font-medium italic">Monitoramento de integridade e histórico operacional.</p>
             </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={exportPDF} className="flex-1 md:flex-none p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-red-500 transition-all shadow-sm"><FileText size={20}/></button>
            <button onClick={loadData} className="flex-1 md:flex-none p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-primary-500 transition-all shadow-sm"><RefreshCw size={20} className={loading ? 'animate-spin' : ''}/></button>
          </div>
       </div>

       {/* FILTROS REFINADOS */}
       <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
          <div className="flex flex-col xl:flex-row gap-4">
             <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type="text" placeholder="Filtrar por nome, detalhes ou ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 transition-all" />
             </div>
             <div className="grid grid-cols-2 gap-3 xl:w-[400px]">
                <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none">
                    <option value="ALL">Todas Ações</option>
                    <option value="CREATE">Inclusão</option>
                    <option value="UPDATE">Edição</option>
                    <option value="DELETE">Remoção</option>
                    <option value="REPORT">Sinistro</option>
                    <option value="CONFIG">Sistema</option>
                </select>
                <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none">
                    <option value="ALL">Entidades</option>
                    {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
                </select>
             </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-50 dark:border-zinc-800/50">
             <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <Calendar size={14} className="text-zinc-400" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase outline-none dark:text-white" />
                <span className="text-zinc-300">até</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase outline-none dark:text-white" />
             </div>
             <button onClick={clearFilters} className="text-[10px] font-black text-zinc-400 hover:text-red-500 uppercase tracking-[0.2em] flex items-center gap-2 px-4 py-2 transition-colors"><X size={14} /> Limpar Filtros</button>
          </div>
       </div>

       {/* TABELA DE LOGS REFATORADA */}
       <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800">
                      <tr>
                          <th className="px-8 py-5">
                             <button 
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="flex items-center gap-2 hover:text-primary-500 transition-colors"
                             >
                                Horário {sortOrder === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
                             </button>
                          </th>
                          <th className="px-8 py-5">Colaborador</th>
                          <th className="px-8 py-5">Operação</th>
                          <th className="px-8 py-5">Entidade</th>
                          <th className="px-8 py-5">Detalhes</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                      {currentItems.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-8 py-20 text-center opacity-40 flex flex-col items-center gap-4">
                                <Database size={48} className="text-zinc-300" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Nenhum evento localizado</span>
                            </td>
                        </tr>
                      ) : (
                        currentItems.map(log => (
                            <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group">
                                <td className="px-8 py-5">
                                    <div className="flex flex-col">
                                        <span className="text-zinc-900 dark:text-zinc-200 font-bold text-xs">{new Date(log.timestamp).toLocaleDateString()}</span>
                                        <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1"><Clock size={10}/> {new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black border border-zinc-200 dark:border-zinc-700">{log.userName.charAt(0)}</div>
                                        <div>
                                            <div className="font-bold text-zinc-900 dark:text-zinc-200 text-xs uppercase tracking-tight">{log.userName}</div>
                                            <div className="text-[9px] text-zinc-400 font-medium">{log.userEmail}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                        log.action === 'DELETE' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                        log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                        log.action === 'REPORT' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    }`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2 text-zinc-400 font-black uppercase text-[10px] tracking-widest">
                                        {getEntityIcon(log.entity)} {log.entity}
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="text-zinc-500 dark:text-zinc-400 text-xs font-medium max-w-xs truncate" title={log.details}>
                                        {log.details}
                                    </div>
                                    {log.entityId && <div className="text-[9px] font-mono text-zinc-400 mt-0.5 opacity-50 uppercase">ID: {log.entityId}</div>}
                                </td>
                            </tr>
                        ))
                      )}
                  </tbody>
              </table>
          </div>

          {/* CONTROLES DE PAGINAÇÃO */}
          <div className="p-6 border-t border-zinc-50 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center bg-zinc-50/30 dark:bg-zinc-950/20 gap-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Exibindo <span className="text-zinc-900 dark:text-white">{Math.min(filteredLogs.length, itemsPerPage)}</span> de <span className="text-zinc-900 dark:text-white">{filteredLogs.length}</span> registros
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p-1))} 
                        className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-primary-500 disabled:opacity-30 transition-all shadow-sm"
                      >
                        <ChevronLeft size={18}/>
                      </button>
                      <button 
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => p + 1)} 
                        className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-primary-500 disabled:opacity-30 transition-all shadow-sm"
                      >
                        <ChevronRight size={18}/>
                      </button>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pág. {currentPage} / {totalPages}</span>
              </div>
          </div>
       </div>
    </div>
  );
};
