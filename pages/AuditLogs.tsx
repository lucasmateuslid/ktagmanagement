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
  X
} from 'lucide-react';

export const AuditLogs = () => {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  
  // Data State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterEntity, setFilterEntity] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Sorting & Pagination
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = async () => {
    setLoading(true);
    if (isAdmin) {
      // Increased limit to allow better local filtering
      const data = await storage.getAuditLogs(500); 
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterAction, filterEntity, startDate, endDate]);

  // Helper to force Local Time creation from YYYY-MM-DD string
  const parseLocalDate = (dateStr: string): Date => {
      if (!dateStr) return new Date();
      const parts = dateStr.split('-').map(Number);
      if (parts.length !== 3) return new Date();
      const [year, month, day] = parts;
      return new Date(year, month - 1, day);
  };

  // Format YYYY-MM-DD to DD/MM/YYYY for display
  const formatDateDisplay = (isoDate: string) => {
      if (!isoDate) return '';
      const [y, m, d] = isoDate.split('-');
      return `${d}/${m}/${y}`;
  }

  // --- FILTERING & SORTING LOGIC ---
  const filteredAndSortedLogs = useMemo(() => {
    // CRITICAL: Create a shallow copy to avoid mutating the 'logs' state during sort
    let result = [...logs];

    // 1. Text Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.userName.toLowerCase().includes(term) ||
        log.details.toLowerCase().includes(term) ||
        log.entity.toLowerCase().includes(term)
      );
    }

    // 2. Action Filter
    if (filterAction !== 'ALL') {
      result = result.filter(log => log.action === filterAction);
    }

    // 3. Entity Filter
    if (filterEntity !== 'ALL') {
      result = result.filter(log => log.entity === filterEntity);
    }

    // 4. Date Range Filter (Using Local Time parsing)
    if (startDate) {
      const start = parseLocalDate(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter(log => log.timestamp >= start.getTime());
    }

    if (endDate) {
      const end = parseLocalDate(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(log => log.timestamp <= end.getTime());
    }

    // 5. Sorting
    result.sort((a, b) => {
      return sortOrder === 'asc' 
        ? a.timestamp - b.timestamp 
        : b.timestamp - a.timestamp;
    });

    return result;
  }, [logs, searchTerm, filterAction, filterEntity, startDate, endDate, sortOrder]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedLogs.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedLogs.slice(start, start + itemsPerPage);
  }, [filteredAndSortedLogs, currentPage]);

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));
  const uniqueEntities = Array.from(new Set(logs.map(l => l.entity)));

  if (!isAdmin) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <ShieldAlert size={48} className="mb-4 text-red-500" />
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Acesso Negado</h2>
              <p>Apenas administradores podem ver logs de auditoria.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-10 h-full flex flex-col">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6 shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                <ClipboardList size={28} />
             </div>
             <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Audit Logs</h1>
                <p className="text-zinc-500 text-sm">System activity and security trail</p>
             </div>
          </div>
          <button 
             onClick={loadData} 
             className="p-2 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
             title="Refresh Logs"
          >
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
       </div>

       {/* Filters */}
       <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-4 items-center shrink-0">
          <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                  type="text" 
                  placeholder="Search user, action or details..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
              />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <select 
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
              >
                  <option value="ALL">All Actions</option>
                  {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              <select 
                  value={filterEntity}
                  onChange={(e) => setFilterEntity(e.target.value)}
                  className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
              >
                  <option value="ALL">All Entities</option>
                  {uniqueEntities.map(e => <option key={e} value={e}>{e}</option>)}
              </select>

              <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2">
                  <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent border-none text-xs w-24 text-zinc-700 dark:text-zinc-300 outline-none"
                  />
                  <span className="text-zinc-400">-</span>
                  <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent border-none text-xs w-24 text-zinc-700 dark:text-zinc-300 outline-none"
                  />
                  {(startDate || endDate) && (
                      <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-zinc-400 hover:text-red-500">
                          <X size={14} />
                      </button>
                  )}
              </div>
          </div>
       </div>

       {/* Table */}
       <div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800 uppercase border-b border-zinc-200 dark:border-zinc-700 sticky top-0">
                      <tr>
                          <th className="px-6 py-3 cursor-pointer hover:text-indigo-600" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                              <div className="flex items-center gap-1">Date/Time <ArrowUpDown size={12}/></div>
                          </th>
                          <th className="px-6 py-3">User</th>
                          <th className="px-6 py-3">Action</th>
                          <th className="px-6 py-3">Entity</th>
                          <th className="px-6 py-3 w-1/3">Details</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {currentItems.map(log => (
                          <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                              <td className="px-6 py-4 text-zinc-500 whitespace-nowrap font-mono text-xs">
                                  {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                                          {log.userName.charAt(0)}
                                      </div>
                                      <div className="flex flex-col">
                                          <span className="font-medium text-zinc-900 dark:text-white text-xs">{log.userName}</span>
                                          <span className="text-[10px] text-zinc-400">{log.userEmail}</span>
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                      log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                                      log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                      log.action === 'LOGIN' ? 'bg-purple-100 text-purple-700' :
                                      'bg-zinc-100 text-zinc-700'
                                  }`}>
                                      {log.action}
                                  </span>
                              </td>
                              <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-xs font-mono">
                                  {log.entity}
                              </td>
                              <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-xs break-words">
                                  {log.details}
                                  {log.entityId && <span className="block text-[10px] text-zinc-400 mt-1">ID: {log.entityId}</span>}
                              </td>
                          </tr>
                      ))}
                      {currentItems.length === 0 && (
                          <tr><td colSpan={5} className="p-12 text-center text-zinc-400">No logs found.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
          
          {/* Pagination */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 shrink-0">
              <span className="text-xs text-zinc-500">
                  Showing {currentItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredAndSortedLogs.length)} of {filteredAndSortedLogs.length} entries
              </span>
              <div className="flex gap-2">
                  <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 disabled:opacity-50 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                      <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded">
                      Page {currentPage} of {totalPages || 1}
                  </span>
                  <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="p-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 disabled:opacity-50 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                      <ChevronRight size={16} />
                  </button>
              </div>
          </div>
       </div>
    </div>
  );
};
