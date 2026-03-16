
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
  ArrowUp,
  ArrowDown,
  Clock,
  ExternalLink
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const AuditLogs = () => {
  const { isAdmin, user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States para filtros e visualização
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
      // Busca logs (limitado aos últimos 2000 para performance)
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
      const term = searchTerm.toLowerCase().trim();
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

  const toggleSort = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("K-TAG - Relatório de Auditoria", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()} | Total: ${filteredLogs.length} registros`, 14, 28);
    
    const tableData = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.userName,
      log.action,
      log.entity,
      log.details
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Detalhes']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [24, 24, 27] },
      styles: { fontSize: 7 }
    });

    doc.save(`audit_ktag_${Date.now()}.pdf`);
  };

  const getEntityIcon = (entity: string) => {
    const e = entity.toLowerCase();
    if (e.includes('vehicle')) return <Car size={14} />;
    if (e.includes('tag')) return <TagIcon size={14} />;
    if (e.includes('user')) return <UserIcon size={14} />;
    if (e.includes('setting')) return <SettingsIcon size={14} />;
    return <Database size={14} />;
  };

  if (!isAdmin) return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-400 gap-4">
        <ShieldAlert size={64} className="opacity-20" />
        <p className="font-black uppercase tracking-[0.3em] text-[10px]">Acesso Restrito ao Administrador</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 max-w-[1400px] mx-auto">
       {/* HEADER */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
             <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-primary-500 border border-zinc-800 shadow-xl shrink-0">
                <ClipboardList size={28} />
             </div>
             <div>
                <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Auditoria de Sistema</h1>
                <p className="text-zinc-500 mt-2 text-xs font-medium uppercase tracking-widest opacity-70">Monitoramento de integridade e histórico operacional.</p>
             </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button onClick={exportPDF} className="flex-1 md:flex-none px-5 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-red-500 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-sm">
              <FileText size={16}/> Exportar PDF
            </button>
            <button onClick={loadData} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-primary-500 transition-all shadow-sm">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''}/>
            </button>
          </div>
       </div>

       {/* FILTROS REFINADOS */}
       <div className="bg-white dark:bg-zinc-900 p-4 rounded-[28px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex flex-col xl:flex-row gap-3">
             <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Pesquisar detalhes, usuários ou IDs..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:border-primary-500/50 transition-all font-medium" 
                />
             </div>
             <div className="flex gap-2">
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="pl-9 pr-3 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none" 
                  />
                </div>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="pl-9 pr-3 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none" 
                  />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2 xl:w-[360px]">
                <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none">
                    <option value="ALL">Todas Ações</option>
                    <option value="CREATE">Inclusão</option>
                    <option value="UPDATE">Edição</option>
                    <option value="DELETE">Remoção</option>
                    <option value="REPORT">Sinistro</option>
                    <option value="CONFIG">Sistema</option>
                </select>
                <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none">
                    <option value="ALL">Todas Entidades</option>
                    {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
                </select>
             </div>
          </div>
       </div>

       {/* VIEW MOBILE: CARDS */}
       <div className="flex flex-col gap-4 md:hidden">
          {loading ? (
             <div className="py-20 text-center text-zinc-400"><RefreshCw className="animate-spin inline-block mr-2" /> Carregando logs...</div>
          ) : currentItems.length === 0 ? (
             <div className="p-8 text-center text-zinc-400 font-bold uppercase text-xs border-2 border-dashed border-zinc-800 rounded-xl">Sem registros</div>
          ) : (
             currentItems.map(log => (
                <div key={log.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                   <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">{log.userName.charAt(0)}</div>
                         <div>
                            <p className="text-xs font-black text-zinc-900 dark:text-white uppercase">{log.userName}</p>
                            <p className="text-[9px] text-zinc-400">{new Date(log.timestamp).toLocaleDateString()} • {new Date(log.timestamp).toLocaleTimeString()}</p>
                         </div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                          log.action === 'DELETE' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                          log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                          log.action === 'REPORT' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                          'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                          {log.action}
                      </span>
                   </div>
                   
                   <div className="mb-3 flex items-center gap-2 text-zinc-400 font-black uppercase text-[9px] tracking-widest">
                        {getEntityIcon(log.entity)} {log.entity}
                   </div>

                   <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                      {log.details}
                   </p>
                </div>
             ))
          )}
       </div>

       {/* VIEW DESKTOP: TABELA */}
       <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800">
                      <tr>
                          <th className="px-8 py-5">
                             <button onClick={toggleSort} className="flex items-center gap-2 hover:text-primary-500 transition-colors">
                                Horário do Evento {sortOrder === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
                             </button>
                          </th>
                          <th className="px-8 py-5">Colaborador / Conta</th>
                          <th className="px-8 py-5">Operação</th>
                          <th className="px-8 py-5">Módulo</th>
                          <th className="px-8 py-5">Detalhes da Transação</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-20 text-center">
                            <RefreshCw className="animate-spin text-primary-500 mx-auto" size={32} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-4">Sincronizando logs do servidor...</p>
                          </td>
                        </tr>
                      ) : currentItems.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-8 py-20 text-center opacity-30 flex flex-col items-center gap-4">
                                <Database size={48} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Nenhum registro encontrado</span>
                            </td>
                        </tr>
                      ) : (
                        currentItems.map(log => (
                            <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group">
                                <td className="px-8 py-5 whitespace-nowrap">
                                    <div className="flex flex-col">
                                        <span className="text-zinc-900 dark:text-zinc-200 font-bold text-xs">{new Date(log.timestamp).toLocaleDateString()}</span>
                                        <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1"><Clock size={10}/> {new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-black border border-zinc-200 dark:border-zinc-700 text-zinc-500 group-hover:bg-zinc-900 group-hover:text-white transition-colors">{log.userName.charAt(0)}</div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-zinc-900 dark:text-zinc-200 text-xs uppercase truncate tracking-tight">{log.userName}</div>
                                            <div className="text-[9px] text-zinc-400 font-medium truncate">{log.userEmail}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                        log.action === 'DELETE' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                        log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                        log.action === 'REPORT' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    }`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2 text-zinc-400 font-black uppercase text-[9px] tracking-widest">
                                        {getEntityIcon(log.entity)} {log.entity}
                                    </div>
                                </td>
                                <td className="px-8 py-5 max-w-xs xl:max-w-md">
                                    <div className="text-zinc-500 dark:text-zinc-400 text-xs font-medium leading-relaxed" title={log.details}>
                                        {log.details}
                                    </div>
                                    {log.entityId && (
                                      <div className="text-[8px] font-mono text-zinc-400 mt-1 flex items-center gap-1 opacity-50 uppercase">
                                        <ExternalLink size={8}/> UUID: {log.entityId}
                                      </div>
                                    )}
                                </td>
                            </tr>
                        ))
                      )}
                  </tbody>
              </table>
          </div>
       </div>

       {/* PAGINAÇÃO */}
       <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/20 gap-4 rounded-b-[32px]">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <span className="text-zinc-900 dark:text-white">{currentPage}</span> / {totalPages}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="flex gap-1.5">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p-1))} 
                    className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-primary-500 hover:border-primary-500/50 disabled:opacity-30 transition-all shadow-sm active:scale-90"
                  >
                    <ChevronLeft size={18}/>
                  </button>
                  <button 
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)} 
                    className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-primary-500 hover:border-primary-500/50 disabled:opacity-30 transition-all shadow-sm active:scale-90"
                  >
                    <ChevronRight size={18}/>
                  </button>
              </div>
          </div>
       </div>
    </div>
  );
};
