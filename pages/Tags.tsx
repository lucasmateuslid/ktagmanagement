
import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { storage } from '../services/storage';
import { Tag, Vehicle, TagType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { xadtagService } from '../services/xadtag';
import { geocodingService } from '../services/geocoding'; 
import { 
  Plus, Trash2, Edit2, Save, X, Upload, CheckSquare, Square, 
  Wifi, Search, Car, Activity, BatteryCharging, 
  Check, Cpu, ListChecks, FileSpreadsheet, 
  Loader2, Terminal, RefreshCw, ChevronRight, FileText,
  Signal, CheckCircle2, XCircle, Box, AlertTriangle,
  Power, MapPin, Clock, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { ktagBatteryStatus } from '../services/api';

const { useSearchParams } = ReactRouterDOM as any;
const MotionDiv = motion.div as any;

interface ConsoleLog {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'warning';
  method?: string;
  url?: string;
  status?: number;
  requestBody?: any;
  responseBody?: any;
  duration?: number;
  expanded?: boolean;
}

export const Tags = () => {
  const [searchParams] = useSearchParams();
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importConfig, setImportConfig] = useState<{ type: TagType, warranty: number }>({ type: 'K_TAG', warranty: 1 });
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'validate' | 'processing'>('upload');
  const [validationSummary, setValidationSummary] = useState({ valid: 0, invalid: 0 });
  const [importProgress, setImportProgress] = useState(0);

  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [activeTestTag, setActiveTestTag] = useState<Tag | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { status: 'success' | 'error' | 'loading', code?: number, timestamp: number, battery?: any }>>({});
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<Tag>>({ batteryWarrantyYears: 1, type: 'K_TAG' });
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const { user } = useAuth();

  const loadData = async () => {
    const [loadedTags, loadedVehicles] = await Promise.all([
      storage.getTags(),
      storage.getVehicles()
    ]);
    setTags(loadedTags);
    setVehicles(loadedVehicles);
  };

  useEffect(() => {
    loadData();
    if (searchParams.get('action') === 'new') {
        setFormData({ batteryWarrantyYears: 1, type: 'K_TAG' });
        setIsModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isConsoleOpen && logsEndRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs, isConsoleOpen]);

  const stats = useMemo(() => {
      return {
          totalKTag: tags.filter(t => t.type === 'K_TAG').length,
          totalXadTag: tags.filter(t => t.type === 'XADTAG').length
      };
  }, [tags]);

  const filteredTags = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return tags.filter(tag => {
      const linkedVehicle = vehicles.find(v => v.tagId === tag.id);
      
      const matchesText = (
        tag.name.toLowerCase().includes(term) ||
        tag.accessoryId.toLowerCase().includes(term) ||
        (tag.imei && tag.imei.toLowerCase().includes(term)) ||
        (linkedVehicle && linkedVehicle.plate.toLowerCase().includes(term))
      );

      if (!matchesText) return false;
      if (filterType !== 'all' && tag.type !== filterType) return false;
      if (filterStatus === 'linked' && !linkedVehicle) return false;
      if (filterStatus === 'stock' && linkedVehicle) return false;

      return true;
    });
  }, [tags, searchTerm, vehicles, filterType, filterStatus]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedTags(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTags.size === filteredTags.length && filteredTags.length > 0) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(filteredTags.map(t => t.id)));
    }
  };

  const handleExportSelected = (format: 'xlsx' | 'csv') => {
      if (selectedTags.size === 0) return;

      const dataToExport = tags
          .filter(t => selectedTags.has(t.id))
          .map(t => {
              const linkedVehicle = vehicles.find(v => v.tagId === t.id);
              return {
                  "Nome": t.name,
                  "Tipo": t.type,
                  "Serial (Accessory ID)": t.accessoryId,
                  "IMEI": t.imei || '-',
                  "Traqcare ID": t.traqcareId || '-',
                  "Status": linkedVehicle ? 'VINCULADO' : 'ESTOQUE',
                  "Veículo Vinculado": linkedVehicle ? linkedVehicle.plate : '-',
                  "Data Cadastro": new Date(t.createdAt).toLocaleDateString()
              };
          });

      if (format === 'csv') {
          const headers = Object.keys(dataToExport[0]);
          const csvContent = [
            headers.join(','),
            ...dataToExport.map(row => headers.map(h => `"${(row as any)[h]}"`).join(','))
          ].join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement("a");
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", `tags_export_${Date.now()}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } else {
          const ws = XLSX.utils.json_to_sheet(dataToExport);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Equipamentos Selecionados");
          XLSX.writeFile(wb, `tags_export_${Date.now()}.xlsx`);
      }
      
      addNotification('success', 'Exportação Concluída', `${selectedTags.size} itens exportados.`);
      setSelectedTags(new Set());
  };

  const handleActivate = async (tag: Tag) => {
      const success = await xadtagService.activate(tag);
      if (success) {
          addNotification('success', 'Ativação XADTAG', `Comando enviado.`);
          const updated = { ...tag, isActivated: true };
          await storage.saveTag(updated);
          loadData();
      } else {
          addNotification('error', 'Erro', `Falha na ativação.`);
      }
  };

  // --- CONSOLE LOGIC ---

  const addLog = (log: Omit<ConsoleLog, 'id' | 'timestamp'>) => {
      setConsoleLogs(prev => [...prev, { ...log, id: crypto.randomUUID(), timestamp: Date.now(), expanded: true }]);
  };

  const toggleLogExpand = (id: string) => {
      setConsoleLogs(prev => prev.map(l => l.id === id ? { ...l, expanded: !l.expanded } : l));
  };

  const clearConsole = () => setConsoleLogs([]);

  // COMMAND HANDLER FOR XADTAG
  const handleXadCommand = async (command: 'ping' | 'location' | 'history') => {
      if (!activeTestTag || activeTestTag.type !== 'XADTAG') return;
      setTesting(true);

      const label = command === 'ping' ? 'Teste de Conectividade (Ping)' : 
                    command === 'location' ? 'Localização Atual' : 'Histórico (24h)';
      
      addLog({
          type: 'info',
          method: 'CMD',
          url: `Solicitando: ${label}`,
          responseBody: { target: activeTestTag.name, deviceId: activeTestTag.traqcareId }
      });

      const startTime = Date.now();

      try {
          let resultData: any;
          
          if (command === 'ping') {
              const diagnosis = await xadtagService.diagnose(activeTestTag);
              resultData = {
                  summary: diagnosis.summary,
                  rawResponse: diagnosis.raw
              };
          } 
          else if (command === 'location') {
              const locations = await xadtagService.fetchLocation(activeTestTag);
              if (locations.length > 0) {
                  const loc = locations[0];
                  const address = await geocodingService.reverseGeocode(loc.lat, loc.lon);
                  resultData = {
                      coords: `${loc.lat}, ${loc.lon}`,
                      address: address,
                      battery: `${loc.battery.level}% (${loc.battery.label})`,
                      lastUpdate: loc.isodatetime,
                      active: loc.status === 1
                  };
              } else {
                  resultData = { message: "Dispositivo não retornou localização recente." };
              }
          } 
          else if (command === 'history') {
              const end = Date.now();
              const start = end - (24 * 60 * 60 * 1000);
              const history = await xadtagService.fetchHistory(activeTestTag, start, end);
              
              if (history.length > 0) {
                  const first = history[0];
                  const last = history[history.length - 1];
                  const address = await geocodingService.reverseGeocode(first.lat, first.lon);
                  resultData = {
                      pointsFound: history.length,
                      latestPoint: { time: first.isodatetime, coords: `${first.lat}, ${first.lon}`, address },
                      oldestPoint: { time: last.isodatetime, coords: `${last.lat}, ${last.lon}` }
                  };
              } else {
                  resultData = { message: "Nenhum histórico encontrado nas últimas 24h." };
              }
          }

          addLog({
              type: 'success',
              method: 'GET',
              url: '/api/xadtag',
              status: 200,
              responseBody: resultData,
              duration: Date.now() - startTime
          });

      } catch (e: any) {
          addLog({
              type: 'error',
              method: 'ERROR',
              url: 'System',
              responseBody: { error: e.message }
          });
      } finally {
          setTesting(false);
      }
  };

  const handleTestConnection = async (tag: Tag | null = activeTestTag) => {
      if (!tag) return;
      setActiveTestTag(tag);
      setIsConsoleOpen(true);
      
      // Se for XADTAG, executa o Ping
      if (tag.type === 'XADTAG') {
          await handleXadCommand('ping');
          return;
      }

      // K-TAG Legacy Ping
      setTesting(true);
      addLog({ type: 'info', method: 'INFO', url: 'Ping K-TAG', responseBody: { sn: tag.accessoryId } });
      try {
          const settings = await storage.getSettings();
          const auth = `Basic ${btoa(`${settings.ktagUser}:${settings.ktagPass}`)}`;
          const res = await fetch(settings.customProxyUrl, {
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  url: settings.ktagUrl,
                  method: 'POST',
                  headers: { 'Authorization': auth },
                  body: { accessoryId: tag.accessoryId, hashed_keys: [tag.hashedAdvKey], priv_keys: [tag.privateKey] }
              })
          });
          const json = await res.json();
          addLog({ type: res.ok ? 'success' : 'error', status: res.status, responseBody: json });
      } catch (e: any) {
          addLog({ type: 'error', responseBody: e.message });
      } finally {
          setTesting(false);
      }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const tag: Tag = {
            id: formData.id || crypto.randomUUID(),
            name: formData.name || '',
            type: formData.type || 'K_TAG',
            accessoryId: formData.accessoryId || '',
            createdAt: formData.createdAt || Date.now(),
            hashedAdvKey: formData.hashedAdvKey,
            privateKey: formData.privateKey,
            imei: formData.imei,
            traqcareId: formData.traqcareId,
            batteryWarrantyYears: formData.batteryWarrantyYears
        };

        if (!tag.name) throw new Error("Nome é obrigatório");
        if (tag.type === 'K_TAG' && !tag.accessoryId) throw new Error("Serial Number é obrigatório para K-TAG");
        if (tag.type === 'XADTAG' && !tag.traqcareId) throw new Error("ID Traqcare é obrigatório para XADTAG");

        await storage.saveTag(tag);
        addNotification('success', 'Sucesso', 'Equipamento salvo com sucesso.');
        setIsModalOpen(false);
        loadData();
    } catch (error: any) {
        addNotification('error', 'Erro', error.message);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
      if(e) e.stopPropagation();
      if(confirm('Tem certeza que deseja excluir este equipamento?')) {
          await storage.deleteTag(id);
          addNotification('success', 'Sucesso', 'Equipamento removido.');
          loadData();
      }
  };

  const handleMassDelete = async () => {
    const count = selectedTags.size;
    if (count === 0) return;
    if (!confirm(`ATENÇÃO: Você está prestes a excluir ${count} equipamentos.\n\nEquipamentos vinculados a veículos perderão a associação.\nDeseja continuar?`)) return;

    try {
        const promises = Array.from(selectedTags).map((id: string) => storage.deleteTag(id));
        await Promise.all(promises);
        
        const vehicleUpdates = vehicles
            .filter(v => v.tagId && selectedTags.has(v.tagId))
            .map(v => storage.saveVehicle({ ...v, tagId: undefined }));
        await Promise.all(vehicleUpdates);

        addNotification('success', 'Exclusão em Massa', `${count} equipamentos foram removidos do estoque.`);
        setSelectedTags(new Set());
        loadData();
    } catch (error: unknown) {
        addNotification('error', 'Erro', 'Falha ao processar exclusão.');
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      { 
        "Identificacao": "Tag Exemplo 01", 
        "Serial/IMEI": "ABC12345", 
        "Chave Publica (Opcional K-Tag)": "key_hash...", 
        "Chave Privada (Opcional K-Tag)": "priv_key..." 
      }
    ];
    const ws = XLSX.utils.json_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Importacao");
    XLSX.writeFile(wb, "template_equipamentos_ktag.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          addNotification('error', 'Arquivo Vazio', 'A planilha não contém dados.');
          return;
        }

        const validatedData = data.map((row: any) => {
            const serial = row['Serial/IMEI'] || row['serial'] || row['imei'] || row['sn'];
            return {
                ...row,
                _valid: !!serial,
                _serial: serial
            };
        });

        const validCount = validatedData.filter((r: any) => r._valid).length;
        setImportData(validatedData);
        setValidationSummary({ valid: validCount, invalid: validatedData.length - validCount });
        setImportStep('validate');
        setIsImportModalOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        addNotification('error', 'Erro de Leitura', 'Falha ao processar o arquivo.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async () => {
    setImportStep('processing');
    setImportProgress(0);
    setImporting(true);
    let successCount = 0;
    
    const validRows = importData.filter(d => d._valid);
    const total = validRows.length;

    try {
      for (let i = 0; i < total; i++) {
          const row = validRows[i];
          const name = row['Identificacao'] || row['nome'] || row['name'] || `Equip-${Math.floor(Math.random()*10000)}`;
          const serial = row._serial;
          const pubKey = row['Chave Publica (Opcional K-Tag)'] || row['public'] || row['hashed'];
          const privKey = row['Chave Privada (Opcional K-Tag)'] || row['private'] || row['priv'];

          const exists = tags.some(t => t.accessoryId === serial || t.imei === serial);
          if (!exists) {
              const newTag: Tag = {
                id: crypto.randomUUID(),
                name: name,
                type: importConfig.type,
                accessoryId: serial,
                imei: importConfig.type === 'XADTAG' ? serial : undefined,
                hashedAdvKey: pubKey,
                privateKey: privKey,
                batteryWarrantyYears: importConfig.warranty,
                createdAt: Date.now()
              };

              await storage.saveTag(newTag);
              successCount++;
          }

          setImportProgress(Math.round(((i + 1) / total) * 100));
          await new Promise(r => setTimeout(r, 20));
      }
      
      addNotification('success', 'Importação Concluída', `${successCount} equipamentos importados.`);
      setIsImportModalOpen(false);
      loadData();
    } catch (e) {
      addNotification('error', 'Erro Crítico', 'Falha durante o processamento.');
    } finally {
      setImporting(false);
      setImportStep('upload');
    }
  };

  return (
    <div className="space-y-8 pb-32 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Estoque de Equipamentos</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium italic opacity-70">Gestão e controle de ativos de segurança.</p>
          
          <div className="flex gap-3 mt-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-primary-500/10 border border-primary-500/20 rounded-lg">
                  <div className="w-2 h-2 bg-primary-500 rounded-full"/>
                  <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest">K-Tag: {stats.totalKTag}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <div className="w-2 h-2 bg-cyan-500 rounded-full"/>
                  <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">XadTag: {stats.totalXadTag}</span>
              </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-1 shadow-sm">
                <button onClick={handleDownloadTemplate} title="Baixar Template Excel" className="p-3 text-zinc-400 hover:text-emerald-500 transition-colors border-r border-zinc-100 dark:border-zinc-800">
                    <FileSpreadsheet size={18} />
                </button>
                <button onClick={() => { setImportStep('upload'); setImportConfig({ type: 'K_TAG', warranty: 1 }); setIsImportModalOpen(true); }} className="px-5 py-3 flex items-center gap-3 font-black uppercase text-[10px] tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all">
                  <Upload size={16} /> Importar Lista
                </button>
            </div>
            
            <button onClick={() => { setFormData({ batteryWarrantyYears: 1, type: 'K_TAG' }); setIsModalOpen(true); }} className="bg-primary-500 hover:bg-primary-400 text-black px-8 py-4 rounded-[20px] flex items-center gap-3 font-black uppercase text-[10px] tracking-widest transition-all shadow-2xl shadow-primary-500/20 active:scale-95">
              <Plus size={18} strokeWidth={3} /> NOVO EQUIPAMENTO
            </button>
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv, .xlsx, .xls" className="hidden" />

      {/* FILTER BAR */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2 pl-4 rounded-[28px] border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col xl:flex-row gap-3 items-center transition-all">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Pesquisar por SN, IMEI ou Placa..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-8 pr-4 py-3 bg-transparent border-none text-sm font-bold outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" 
          />
        </div>

        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-1 px-1">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none min-w-[120px]">
                <option value="all">Todos Tipos</option>
                <option value="K_TAG">K-Tag</option>
                <option value="XADTAG">XADTAG</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none min-w-[120px]">
                <option value="all">Todos Status</option>
                <option value="linked">Em Uso</option>
                <option value="stock">Em Estoque</option>
            </select>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-hidden px-2 border-l border-zinc-100 dark:border-zinc-800 pl-4">
            <AnimatePresence mode="popLayout">
                {selectedTags.size > 0 && (
                    <MotionDiv 
                        initial={{ opacity: 0, x: 20 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-2"
                    >
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-primary-500/10 text-primary-600 rounded-xl border border-primary-500/20">
                            <ListChecks size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{selectedTags.size}</span>
                        </div>
                        
                        <button onClick={() => handleExportSelected('xlsx')} className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95" title="Exportar Excel">
                            <FileSpreadsheet size={14} /> XLSX
                        </button>
                        <button onClick={() => handleExportSelected('csv')} className="px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95" title="Exportar CSV">
                            <FileText size={14} /> CSV
                        </button>

                        <button onClick={handleMassDelete} className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all active:scale-95">
                            <Trash2 size={14} />
                        </button>
                        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                    </MotionDiv>
                )}
            </AnimatePresence>

            <button onClick={handleSelectAll} className={`px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 transition-all border ${selectedTags.size === filteredTags.length && filteredTags.length > 0 ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent shadow-md' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}>
                {selectedTags.size === filteredTags.length && filteredTags.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                {selectedTags.size === filteredTags.length && filteredTags.length > 0 ? 'Desmarcar' : 'Todos'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTags.map((tag) => {
          const isSelected = selectedTags.has(tag.id);
          const testResult = testResults[tag.id];

          return (
            <MotionDiv 
                layout key={tag.id} 
                onClick={() => toggleSelect(tag.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5 }}
                className={`bg-white dark:bg-zinc-900 p-10 rounded-[40px] border transition-all cursor-pointer group flex flex-col justify-between min-h-[360px] relative overflow-hidden ${isSelected ? 'border-primary-500 ring-4 ring-primary-500/10 shadow-2xl' : 'border-zinc-200 dark:border-zinc-800 shadow-sm'}`}
            >
                {isSelected && (
                  <div className="absolute top-0 right-0 p-6">
                      <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white shadow-lg animate-in zoom-in duration-200">
                          <Check size={16} strokeWidth={4} />
                      </div>
                  </div>
                )}

                <div className="flex justify-between items-start">
                    <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${tag.type === 'XADTAG' ? 'bg-cyan-500 text-white' : 'bg-primary-500 text-black'}`}>
                        {tag.type === 'XADTAG' ? <Cpu size={28} /> : <Wifi size={28} />}
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                        {!isSelected && (
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                {tag.type === 'XADTAG' && (
                                    <button 
                                        onClick={() => handleActivate(tag)} 
                                        className={`p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm ${tag.isActivated ? 'text-emerald-500 hover:text-emerald-600' : 'text-zinc-400 hover:text-cyan-500'}`}
                                        title={tag.isActivated ? "Reenviar Ativação" : "Ativar Dispositivo"}
                                    >
                                        <Power size={16}/>
                                    </button>
                                )}
                                <button onClick={() => handleTestConnection(tag)} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-emerald-500 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <Activity size={16}/>
                                </button>
                                <button onClick={() => { setFormData(tag); setIsModalOpen(true); }} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-primary-500 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <Edit2 size={16}/>
                                </button>
                                <button onClick={(e) => handleDelete(tag.id, e)} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-red-500 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        )}
                        
                        {testResult && !isSelected && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm animate-in fade-in slide-in-from-right-4 ${
                                testResult.status === 'loading' ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500' :
                                testResult.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                            }`}>
                                {testResult.status === 'loading' ? <Loader2 size={12} className="animate-spin"/> : <Signal size={12}/>}
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        {testResult.status === 'loading' ? 'PING...' : 
                                        testResult.status === 'success' ? `200 OK` : 
                                        `ERR ${testResult.code || 'TIMEOUT'}`}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8">
                    <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter truncate">{tag.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${tag.type === 'XADTAG' ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' : 'bg-primary-500/10 text-primary-600 border-primary-500/20'}`}>{tag.type}</span>
                        <span className="text-[10px] font-mono text-zinc-400 font-bold">{tag.type === 'XADTAG' ? `IMEI: ${tag.imei}` : `SN: ${tag.accessoryId}`}</span>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                     <div className="flex flex-col">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Status</span>
                        {vehicles.find(v => v.tagId === tag.id) ? <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1.5 mt-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/> VINCULADO</span> : <span className="text-[10px] font-black text-zinc-300 uppercase mt-1">NO ESTOQUE</span>}
                     </div>
                     {vehicles.find(v => v.tagId === tag.id) ? (
                        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
                            <span className="text-sm font-black text-zinc-900 dark:text-white font-mono">{vehicles.find(v => v.tagId === tag.id)?.plate}</span>
                        </div>
                     ) : (
                        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
                            <span className="text-[10px] font-black text-zinc-300 uppercase flex items-center gap-2"><Box size={12}/> Livre</span>
                        </div>
                     )}
                </div>
            </MotionDiv>
          );
        })}
      </div>

      <AnimatePresence>
        {isConsoleOpen && (
            <MotionDiv
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="fixed bottom-0 left-0 right-0 z-[5000] bg-zinc-950 border-t border-zinc-800 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] h-[50vh] lg:h-[450px] flex flex-col font-mono text-xs rounded-t-[30px]"
            >
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50 rounded-t-[30px]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-800 rounded-lg text-emerald-500"><Terminal size={16}/></div>
                        <div>
                            <h3 className="font-bold text-zinc-300 uppercase tracking-wider">Terminal {activeTestTag?.type}</h3>
                            <p className="text-[10px] text-zinc-500">{activeTestTag?.name} ({activeTestTag?.accessoryId})</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {activeTestTag?.type === 'XADTAG' && (
                            <div className="flex items-center gap-1 mr-4 bg-zinc-800 rounded-lg p-1 border border-zinc-700">
                                <button onClick={() => handleXadCommand('ping')} disabled={testing} className="px-4 py-2 bg-zinc-700 hover:bg-cyan-600 hover:text-white text-zinc-300 rounded-md transition-all font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2 text-[10px]">
                                    <Activity size={12}/> Ping
                                </button>
                                <button onClick={() => handleXadCommand('location')} disabled={testing} className="px-4 py-2 bg-zinc-700 hover:bg-cyan-600 hover:text-white text-zinc-300 rounded-md transition-all font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2 text-[10px]">
                                    <MapPin size={12}/> Localização
                                </button>
                                <button onClick={() => handleXadCommand('history')} disabled={testing} className="px-4 py-2 bg-zinc-700 hover:bg-cyan-600 hover:text-white text-zinc-300 rounded-md transition-all font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2 text-[10px]">
                                    <History size={12}/> Histórico
                                </button>
                            </div>
                        )}
                        <button onClick={clearConsole} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-all font-bold uppercase tracking-wider">Limpar</button>
                        <button onClick={() => setIsConsoleOpen(false)} className="px-4 py-2 bg-zinc-800 hover:bg-red-500/20 hover:text-red-500 text-zinc-400 rounded-lg transition-all"><X size={16}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0c0c0c] custom-scrollbar text-zinc-300">
                    {consoleLogs.map(log => (
                        <div key={log.id} className="border-b border-zinc-900 pb-2 mb-2 last:border-0">
                            <div onClick={() => toggleLogExpand(log.id)} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                                <span className="text-zinc-600 font-bold">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${log.type === 'error' ? 'bg-red-900/30 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>{log.method || 'LOG'}</span>
                                <span className="flex-1 truncate font-medium text-zinc-400">{log.url}</span>
                                {log.status && <span className={`font-bold ${log.status === 200 ? 'text-emerald-500' : 'text-red-500'}`}>{log.status}</span>}
                                <ChevronRight size={14} className={`transform transition-transform ${log.expanded ? 'rotate-90' : ''} text-zinc-600`}/>
                            </div>
                            {log.expanded && (
                                <div className="mt-2 pl-4 border-l-2 border-zinc-800 space-y-2 animate-in slide-in-from-top-1 fade-in duration-200">
                                    {log.responseBody && (
                                        <pre className={`bg-zinc-900 p-3 rounded-lg overflow-x-auto text-[10px] ${log.type === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
                                            {(() => {
                                                try {
                                                    return JSON.stringify(log.responseBody, null, 2);
                                                } catch (e) {
                                                    return String(log.responseBody);
                                                }
                                            })()}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </MotionDiv>
        )}
      </AnimatePresence>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-lg p-8 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative my-auto animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                        {formData.id ? 'Editar Equipamento' : 'Novo Equipamento'}
                    </h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X size={24}/></button>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    <div className="bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-2xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                        <button type="button" onClick={() => setFormData({...formData, type: 'K_TAG'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'K_TAG' ? 'bg-primary-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
                            K-Tag (Padrão)
                        </button>
                        <button type="button" onClick={() => setFormData({...formData, type: 'XADTAG'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'XADTAG' ? 'bg-cyan-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
                            XADTAG (Satélite)
                        </button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Identificação (Nome/Apelido) <span className="text-red-500">*</span></label>
                        <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500" placeholder="Ex: Tag 01 - Reserva" />
                    </div>

                    {formData.type === 'K_TAG' ? (
                        <>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Serial Number (SN) <span className="text-red-500">*</span></label>
                                <input type="text" required value={formData.accessoryId || ''} onChange={e => setFormData({...formData, accessoryId: e.target.value})} className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono font-bold text-sm outline-none focus:border-primary-500" placeholder="Ex: KTAG-12345" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Chave Pública (Hashed)</label>
                                    <input type="text" value={formData.hashedAdvKey || ''} onChange={e => setFormData({...formData, hashedAdvKey: e.target.value})} className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-[10px] outline-none" placeholder="Opcional" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Chave Privada</label>
                                    <input type="text" value={formData.privateKey || ''} onChange={e => setFormData({...formData, privateKey: e.target.value})} className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-[10px] outline-none" placeholder="Opcional" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">IMEI <span className="text-red-500">*</span></label>
                                <input type="text" required value={formData.imei || ''} onChange={e => setFormData({...formData, imei: e.target.value})} className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono font-bold text-sm outline-none focus:border-cyan-500" placeholder="Apenas números" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">ID TraqCare</label>
                                <input type="text" value={formData.traqcareId || ''} onChange={e => setFormData({...formData, traqcareId: e.target.value})} className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono font-bold text-sm outline-none focus:border-cyan-500" placeholder="ID Interno da API" />
                            </div>
                        </>
                    )}

                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-2"><BatteryCharging size={12}/> Garantia Bateria (Anos)</label>
                        <input type="number" min="1" max="10" value={formData.batteryWarrantyYears || 1} onChange={e => setFormData({...formData, batteryWarrantyYears: parseInt(e.target.value)})} className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500" />
                    </div>

                    <button type="submit" className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg mt-4">
                        <Save size={16} /> Salvar Equipamento
                    </button>
                </form>
            </div>
        </div>
      )}

      {isImportModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
              <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl relative my-auto flex flex-col max-h-[90vh]">
                  <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50 rounded-t-[32px]">
                      <div>
                          <h2 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Importação em Massa</h2>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                              {importStep === 'upload' ? 'Selecione o arquivo e tipo' : importStep === 'validate' ? 'Validação de Dados' : 'Processando...'}
                          </p>
                      </div>
                      <button onClick={() => setIsImportModalOpen(false)} disabled={importing} className="p-2 text-zinc-400 hover:text-zinc-600 disabled:opacity-50"><X size={20}/></button>
                  </div>

                  <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                      {importStep === 'upload' && (
                          <div className="space-y-6">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Tipo de Equipamento na Planilha</label>
                                  <div className="bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-2xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                                      <button onClick={() => setImportConfig({...importConfig, type: 'K_TAG'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${importConfig.type === 'K_TAG' ? 'bg-primary-500 text-black shadow-md' : 'text-zinc-500'}`}>K-Tag</button>
                                      <button onClick={() => setImportConfig({...importConfig, type: 'XADTAG'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${importConfig.type === 'XADTAG' ? 'bg-cyan-500 text-white shadow-md' : 'text-zinc-500'}`}>XADTAG</button>
                                  </div>
                              </div>

                              <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Garantia Padrão (Anos)</label>
                                  <input type="number" min="1" value={importConfig.warranty} onChange={e => setImportConfig({...importConfig, warranty: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" />
                              </div>

                              <div 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                              >
                                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                                      <FileSpreadsheet size={32} />
                                  </div>
                                  <div className="text-center">
                                      <p className="font-bold text-zinc-700 dark:text-zinc-300">Clique para selecionar arquivo</p>
                                      <p className="text-xs text-zinc-400 mt-1">Suporta .xlsx, .xls ou .csv</p>
                                  </div>
                              </div>
                          </div>
                      )}

                      {(importStep === 'validate' || importStep === 'processing') && (
                          <div className="space-y-6">
                              <div className="flex gap-4">
                                  <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold"><Check size={20}/></div>
                                      <div>
                                          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{validationSummary.valid}</p>
                                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70">Registros Válidos</p>
                                      </div>
                                  </div>
                                  <div className="flex-1 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold"><AlertTriangle size={20}/></div>
                                      <div>
                                          <p className="text-2xl font-black text-red-600 dark:text-red-400">{validationSummary.invalid}</p>
                                          <p className="text-[9px] font-black uppercase tracking-widest text-red-600/70 dark:text-red-400/70">Inválidos (Sem Serial)</p>
                                      </div>
                                  </div>
                              </div>

                              <div className="max-h-60 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                                  <table className="w-full text-left text-xs">
                                      <thead className="bg-zinc-100 dark:bg-zinc-950 font-bold text-zinc-500 sticky top-0">
                                          <tr>
                                              <th className="p-3">Status</th>
                                              <th className="p-3">Identificação</th>
                                              <th className="p-3">Serial/IMEI</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                          {importData.slice(0, 50).map((row, idx) => (
                                              <tr key={idx} className={row._valid ? '' : 'bg-red-50 dark:bg-red-900/10'}>
                                                  <td className="p-3">
                                                      {row._valid ? <CheckCircle2 size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-red-500"/>}
                                                  </td>
                                                  <td className="p-3 font-medium truncate max-w-[150px]">{row['Identificacao'] || row['nome'] || 'Sem Nome'}</td>
                                                  <td className="p-3 font-mono text-zinc-500">{row._serial || '-'}</td>
                                              </tr>
                                          ))}
                                          {importData.length > 50 && (
                                              <tr><td colSpan={3} className="p-3 text-center text-zinc-400 italic">...e mais {importData.length - 50} itens</td></tr>
                                          )}
                                      </tbody>
                                  </table>
                              </div>

                              {importStep === 'processing' && (
                                  <div className="space-y-2">
                                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                          <span>Processando...</span>
                                          <span>{importProgress}%</span>
                                      </div>
                                      <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                          <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${importProgress}%` }} />
                                      </div>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>

                  <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 rounded-b-[32px] flex justify-end gap-3">
                      {importStep === 'validate' && (
                          <>
                              <button onClick={() => { setImportStep('upload'); setImportData([]); }} className="px-6 py-3 rounded-xl font-bold text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">Cancelar</button>
                              <button onClick={processImport} disabled={validationSummary.valid === 0} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                  <ListChecks size={16}/> Confirmar Importação
                              </button>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
