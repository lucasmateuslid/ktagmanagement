
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
  FileSpreadsheet
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
      const data = await storage.getAuditLogs(1000); 
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [isAdmin]);

  // Lista dinâmica de entidades únicas encontradas nos logs para o filtro
  const entities = useMemo(() => {
    const set = new Set(logs.map(l => l.entity));
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let res = [...logs];
    
    // Filtro por termo de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      res = res.filter(l => 
        l.userName.toLowerCase().includes(term) || 
        l.details.toLowerCase().includes(term) ||
        l.entityId?.toLowerCase().includes(term)
      );
    }
    
    // Filtro por Ação
    if (filterAction !== 'ALL') res = res.filter(l => l.action === filterAction);
    
    // Filtro por Entidade
    if (filterEntity !== 'ALL') res = res.filter(l => l.entity === filterEntity);
    
    // Filtro por Datas
    if (startDate) {
      const startTs = new Date(startDate + 'T00:00:00').getTime();
      res = res.filter(l => l.timestamp >= startTs);
    }
    if (endDate) {
      const endTs = new Date(endDate + 'T23:59:59').getTime();
      res = res.filter(l => l.timestamp <= endTs);
    }

    // Ordenação
    res.sort((a, b) => sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);
    return res;
  }, [logs, searchTerm, filterAction, filterEntity, startDate, endDate, sortOrder]);

  const currentItems = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterAction('ALL');
    setFilterEntity('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const exportCSV = () => {
    const headers = ['Timestamp', 'Colaborador', 'Email', 'Ação', 'Entidade', 'ID Entidade', 'Detalhes'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.userName,
      log.userEmail,
      log.action,
      log.entity,
      log.entityId || '',
      log.details.replace(/,/g, ';') // Evitar quebra de CSV com vírgulas nos detalhes
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const primaryColor = [79, 70, 229]; // indigo-600

    doc.setFontSize(20);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text("Audit Trail Report", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Administrador: ${currentUser?.name || 'Sistema'}`, 14, 33);
    
    const tableData = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      `${log.userName}\n(${log.userEmail})`,
      log.action,
      `${log.entity}${log.entityId ? '\nID: ' + log.entityId : ''}`,
      log.details
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Detalhes']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 30 },
        4: { cellWidth: 'auto' }
      }
    });

    doc.save(`audit_logs_${new Date().toISOString().split('T')[0]}.pdf`);
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
       {/* Header Section */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 rounded-[24px] bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                <ClipboardList size={32} />
             </div>
             <div>
                <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Audit Trail</h1>
                <p className="text-zinc-500 mt-2 font-medium">Trilha de segurança e histórico detalhado de operações.</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={exportCSV}
                disabled={filteredLogs.length === 0}
                className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-emerald-500 transition-all shadow-sm disabled:opacity-50"
                title="Exportar CSV"
            >
                <FileSpreadsheet size={20}/>
            </button>
            <button 
                onClick={exportPDF}
                disabled={filteredLogs.length === 0}
                className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-500 transition-all shadow-sm disabled:opacity-50"
                title="Exportar PDF"
            >
                <FileText size={20}/>
            </button>
            <button 
                onClick={loadData} 
                className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-indigo-500 transition-all shadow-sm"
                title="Atualizar Logs"
            >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''}/>
            </button>
          </div>
       </div>

       {/* Filtros Avançados */}
       <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex flex-col xl:flex-row gap-4">
             {/* Busca Textual */}
             <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                    type="text" 
                    placeholder="Pesquisar por colaborador, detalhes ou ID..." 
                    value={searchTerm} 
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                    className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-zinc-900 dark:text-white font-medium" 
                />
             </div>

             {/* Dropdown Ação */}
             <div className="flex flex-col min-w-[160px]">
                <select 
                    value={filterAction} 
                    onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }} 
                    className="h-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none focus:border-indigo-500 cursor-pointer"
                >
                    <option value="ALL">TODAS AS AÇÕES</option>
                    <option value="CREATE">CRIAÇÃO</option>
                    <option value="UPDATE">EDIÇÃO</option>
                    <option value="DELETE">EXCLUSÃO</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="CONFIG">CONFIGURAÇÃO</option>
                    <option value="REPORT">SINISTRO</option>
                </select>
             </div>

             {/* Dropdown Entidade */}
             <div className="flex flex-col min-w-[160px]">
                <select 
                    value={filterEntity} 
                    onChange={(e) => { setFilterEntity(e.target.value); setCurrentPage(1); }} 
                    className="h-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none focus:border-indigo-500 cursor-pointer"
                >
                    <option value="ALL">TODAS AS ENTIDADES</option>
                    {entities.map(ent => (
                        <option key={ent} value={ent}>{ent.toUpperCase()}</option>
                    ))}
                </select>
             </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 mt-2 pt-4">
             <div className="flex items-center gap-3 w-full md:w-auto">
                <Calendar size={16} className="text-zinc-400" />
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }} 
                        className="bg-transparent border-none text-[10px] font-black uppercase outline-none dark:text-white" 
                    />
                    <span className="text-zinc-300">|</span>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }} 
                        className="bg-transparent border-none text-[10px] font-black uppercase outline-none dark:text-white" 
                    />
                </div>
             </div>

             <div className="flex-1" />

             <button 
                onClick={clearFilters}
                className="text-[10px] font-black text-zinc-400 hover:text-red-500 uppercase tracking-widest flex items-center gap-2 transition-colors px-4 py-2"
             >
                <X size={14} /> Limpar Filtros
             </button>
          </div>
       </div>

       {/* Tabela de Resultados */}
       <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800">
                      <tr>
                          <th className="px-8 py-5">
                            <button 
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="flex items-center gap-2 hover:text-indigo-500 transition-colors"
                            >
                                Timestamp {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                          </th>
                          <th className="px-8 py-5">Colaborador</th>
                          <th className="px-8 py-5">Operação</th>
                          <th className="px-8 py-5">Entidade</th>
                          <th className="px-8 py-5">Detalhes da Ação</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                      {currentItems.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center gap-4 opacity-40">
                                    <Database size={48} className="text-zinc-400" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Nenhum log encontrado para estes filtros</p>
                                </div>
                            </td>
                        </tr>
                      ) : (
                        currentItems.map(log => (
                            <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group">
                                <td className="px-8 py-5 text-zinc-500 font-mono text-[11px] whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleDateString()}
                                    <br />
                                    <span className="text-[10px] opacity-60">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black border border-zinc-200 dark:border-zinc-700">
                                            {log.userName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-zinc-900 dark:text-zinc-200 text-xs truncate max-w-[150px] uppercase tracking-tight">{log.userName}</div>
                                            <div className="text-[9px] text-zinc-400 font-medium lowercase">{log.userEmail}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border tracking-widest ${
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
                                        {getEntityIcon(log.entity)}
                                        {log.entity}
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="text-zinc-600 dark:text-zinc-400 text-xs font-medium leading-relaxed max-w-sm line-clamp-2">
                                        {log.details}
                                    </div>
                                    {log.entityId && (
                                        <div className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">ID: {log.entityId}</div>
                                    )}
                                </td>
                            </tr>
                        ))
                      )}
                  </tbody>
              </table>
          </div>

          {/* Paginação */}
          <div className="p-6 border-t border-zinc-50 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center bg-zinc-50/30 dark:bg-zinc-950/20 gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Mostrando {Math.min(filteredLogs.length, itemsPerPage)} de {filteredLogs.length} eventos
                </span>
                <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Página {currentPage} de {Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage))}
                </span>
              </div>
              
              <div className="flex gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p-1))} 
                    className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-indigo-500 disabled:opacity-30 disabled:hover:text-zinc-400 transition-all shadow-sm"
                  >
                    <ChevronLeft size={18}/>
                  </button>
                  <button 
                    disabled={currentPage >= Math.ceil(filteredLogs.length / itemsPerPage)}
                    onClick={() => setCurrentPage(p => p + 1)} 
                    className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-indigo-500 disabled:opacity-30 disabled:hover:text-zinc-400 transition-all shadow-sm"
                  >
                    <ChevronRight size={18}/>
                  </button>
              </div>
          </div>
       </div>
    </div>
  );
};
