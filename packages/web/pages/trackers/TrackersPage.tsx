import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, CircleOff, Edit2, Link2, PackagePlus, Plus, RefreshCw, Satellite, Search, Trash2, Upload } from 'lucide-react';
import type { ManagedTracker, TrackerModel } from '@ktag/shared';
import type { EquipmentSupplier } from '../../types';
import { authenticatedFetch } from '../../services/authenticatedFetch';
import { storage } from '../../services/storage';
import { Modal } from '../../components/ui/modal';
import { Badge } from '../../components/ui/badge';
import { ConfirmModal } from '../../components/ConfirmModal';

type AvailableSim = { id: string; iccid: string; phoneNumber?: string; provider?: string };
type TrackerForm = {
  invertedLockOutput: boolean; modelId: string; imei: string; simCardId: string; password: string;
  minBatteryVoltage: string; maxBatteryVoltage: string; purchaseDate: string; purchaseValue: string;
  supplierId: string; warrantyMonths: string; stockId: string; batch: string; serialNumber: string; notes: string;
};
const emptyForm = (modelId = ''): TrackerForm => ({ invertedLockOutput: false, modelId, imei: '', simCardId: '', password: '', minBatteryVoltage: '', maxBatteryVoltage: '', purchaseDate: '', purchaseValue: '', supplierId: '', warrantyMonths: '12', stockId: 'ESTOQUE PADRÃO', batch: '', serialNumber: '', notes: '' });
const fieldClass = 'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Falha no módulo de rastreadores.');
  return payload.data as T;
}

export function TrackersPage() {
  const [trackers, setTrackers] = useState<ManagedTracker[]>([]);
  const [models, setModels] = useState<TrackerModel[]>([]);
  const [simCards, setSimCards] = useState<AvailableSim[]>([]);
  const [suppliers, setSuppliers] = useState<EquipmentSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTracker, setEditingTracker] = useState<ManagedTracker | null>(null);
  const [deletingTracker, setDeletingTracker] = useState<ManagedTracker | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TrackerForm>(emptyForm());
  const [batchImeis, setBatchImeis] = useState('');
  const [batchResult, setBatchResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rows, modelRows, chips, supplierRows] = await Promise.all([
        api<ManagedTracker[]>('/api/trackers'), api<TrackerModel[]>('/api/trackers/models'),
        api<AvailableSim[]>('/api/trackers/available-sim-cards'), storage.getEquipmentSuppliers(),
      ]);
      setTrackers(rows); setModels(modelRows); setSimCards(chips); setSuppliers(supplierRows);
      setForm(previous => ({ ...previous, modelId: previous.modelId || modelRows[0]?.id || '' }));
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return !term ? trackers : trackers.filter(item => [item.imei, item.serialNumber, item.modelName, item.manufacturer, item.status, item.stockId, item.batch].some(value => String(value || '').toLowerCase().includes(term)));
  }, [search, trackers]);
  const stats = useMemo(() => ({ total: trackers.length, stock: trackers.filter(t => t.status === 'disponível').length, linked: trackers.filter(t => !!t.vehicleId).length, maintenance: trackers.filter(t => t.status === 'manutencao').length }), [trackers]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const path = editingTracker ? `/api/trackers/${encodeURIComponent(editingTracker.id)}` : '/api/trackers';
      await api(path, { method: editingTracker ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setModalOpen(false); setEditingTracker(null); setForm(emptyForm(models[0]?.id)); await load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };
  const saveBatch = async () => {
    const imeis = batchImeis.split(/[\n;,\t]+/).map(value => value.replace(/\D/g, '')).filter(Boolean);
    if (!imeis.length) return setBatchResult('Informe ao menos um IMEI.');
    setSaving(true); setBatchResult('');
    try {
      const result = await api<{ created: number; errors: Array<{ row: number; error: string }> }>('/api/trackers/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaults: { ...form, imei: undefined, simCardId: undefined }, items: imeis.map(imei => ({ imei })) }) });
      setBatchResult(`${result.created} equipamento(s) cadastrado(s).${result.errors.length ? ` ${result.errors.length} linha(s) com erro.` : ''}`);
      if (result.created) { setBatchImeis(''); await load(); }
    } catch (err: any) { setBatchResult(err.message); }
    finally { setSaving(false); }
  };
  const openCreate = () => { setEditingTracker(null); setForm(emptyForm(models[0]?.id)); setModalOpen(true); };
  const openEdit = (tracker: ManagedTracker) => {
    setEditingTracker(tracker);
    setForm({
      invertedLockOutput: tracker.invertedLockOutput === true, modelId: tracker.modelId, imei: tracker.imei,
      simCardId: tracker.simCardId || '', password: tracker.password || '',
      minBatteryVoltage: tracker.minBatteryVoltage?.toString() || '', maxBatteryVoltage: tracker.maxBatteryVoltage?.toString() || '',
      purchaseDate: tracker.purchaseDate || '', purchaseValue: tracker.purchaseValue?.toString() || '', supplierId: tracker.supplierId || '',
      warrantyMonths: tracker.warrantyMonths?.toString() || '12', stockId: tracker.stockId || '', batch: tracker.batch || '',
      serialNumber: tracker.serialNumber || '', notes: tracker.notes || '',
    });
    setModalOpen(true);
  };
  const remove = async () => {
    if (!deletingTracker) return;
    try {
      await api(`/api/trackers/${encodeURIComponent(deletingTracker.id)}`, { method: 'DELETE' });
      setDeletingTracker(null); await load();
    } catch (err: any) { setError(err.message); throw err; }
  };

  return <div className="relative space-y-8 pb-32">
    <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
      <div><h1 className="font-display text-3xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Rastreadores</h1><p className="mt-1 text-sm font-medium italic text-zinc-500 opacity-70">Estoque, lotes, chips, vínculos e compatibilidade de protocolo.</p></div>
      <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
        <div className="flex rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><button type="button" onClick={load} disabled={loading} className="border-r border-zinc-100 p-3 text-zinc-400 transition-colors hover:text-primary-500 disabled:opacity-50 dark:border-zinc-800" title="Atualizar"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button><button type="button" onClick={()=>setBatchOpen(true)} className="flex items-center gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"><Upload size={16}/> Importar lista</button></div>
        <button type="button" onClick={openCreate} className="flex flex-1 items-center justify-center gap-3 rounded-[20px] bg-primary-500 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-black shadow-2xl shadow-primary-500/20 transition-all hover:bg-primary-400 active:scale-95 md:flex-none md:px-8"><Plus size={18} strokeWidth={3}/> Novo equipamento</button>
      </div>
    </header>
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
    <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {[["Total em estoque",stats.total,Satellite,'text-zinc-400'],["Disponíveis",stats.stock,Boxes,'text-blue-500'],["Vinculados",stats.linked,Link2,'text-emerald-500'],["Manutenção",stats.maintenance,CircleOff,'text-amber-500']].map(([label,value,Icon,tone]: any)=><div key={label} className="flex min-h-32 flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-start justify-between"><span className={`text-[10px] font-black uppercase tracking-widest ${tone}`}>{label}</span><Icon size={16} className={tone}/></div><div className="mt-4 text-3xl font-black text-zinc-900 dark:text-white">{value}</div></div>)}
    </section>
    <div className="sticky top-0 z-10 flex items-center rounded-[28px] border border-zinc-200 bg-white/95 p-2 pl-4 shadow-xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95"><div className="relative w-full"><Search size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-400"/><input className="w-full border-none bg-transparent py-3 pl-8 pr-4 text-sm font-bold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white" placeholder="Pesquisar por IMEI, modelo, estoque ou lote..." value={search} onChange={event=>setSearch(event.target.value)}/></div></div>
    <div className="overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="hidden overflow-x-auto md:block"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">{['IMEI','Modelo','Chip','Estoque / lote','Status','Vínculo','Ações'].map(label=><th key={label} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</th>)}</tr></thead><tbody>{filtered.map(item=><TrackerRow key={item.id} item={item} onEdit={openEdit} onDelete={setDeletingTracker}/>)}</tbody></table></div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 md:hidden">{filtered.map(item=><TrackerCard key={item.id} item={item} onEdit={openEdit} onDelete={setDeletingTracker}/>)}</div>
      {!loading && !filtered.length && <div className="p-12 text-center text-sm text-zinc-500">Nenhum equipamento encontrado.</div>}
    </div>
    <p className="text-xs text-content-muted">Modelos baseados no <a className="font-bold text-primary-500 hover:underline" href="https://www.traccar.org/devices/" target="_blank" rel="noreferrer">catálogo oficial de dispositivos do Traccar</a>.</p>

    <TrackerFormModal open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingTracker(null); }} title={editingTracker ? 'Editar equipamento' : 'Cadastrar equipamento'} form={form} setForm={setForm} models={models} simCards={simCards} suppliers={suppliers} saving={saving} onSave={save} editing={!!editingTracker}/>
    <ConfirmModal isOpen={!!deletingTracker} onClose={() => setDeletingTracker(null)} onConfirm={remove} title="Excluir equipamento" message={deletingTracker ? `Tem certeza que deseja excluir o rastreador ${deletingTracker.imei}? O chip vinculado será liberado para o estoque.` : ''} confirmText="Sim, excluir" type="danger" />
    <Modal open={batchOpen} onOpenChange={setBatchOpen} title="Cadastro em lote de rastreadores" size="xl" className="!bg-white dark:!bg-zinc-950">
      <div className="space-y-5"><div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">Um IMEI por linha. Modelo, estoque, fornecedor, garantia, lote e demais parâmetros abaixo serão aplicados ao lote. Chips não são vinculados automaticamente.</div><textarea className={`${fieldClass} min-h-36 font-mono`} placeholder={'860000000000001\n860000000000002'} value={batchImeis} onChange={e=>setBatchImeis(e.target.value)}/><TrackerFields form={form} setForm={setForm} models={models} simCards={[]} suppliers={suppliers} batchMode/>{batchResult && <div className="rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">{batchResult}</div>}<div className="-mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/60 sm:flex-row sm:justify-end"><button type="button" onClick={()=>setBatchOpen(false)} className="rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">Cancelar</button><button type="button" disabled={saving || !form.modelId || !form.stockId} onClick={()=>void saveBatch()} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40 dark:bg-white dark:text-black"><PackagePlus size={15}/>{saving?'Importando...':'Cadastrar lote'}</button></div></div>
    </Modal>
  </div>;
}

function TrackerRow({ item, onEdit, onDelete }: { item: ManagedTracker; onEdit: (item: ManagedTracker) => void; onDelete: (item: ManagedTracker) => void }) {
  return <tr className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/50"><td className="p-4 font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.imei}</td><td className="p-4"><div className="font-bold text-zinc-900 dark:text-white">{item.manufacturer}</div><div className="text-xs text-zinc-500">{item.modelName}</div></td><td className="p-4 text-xs text-zinc-500">{item.simCardId || '—'}</td><td className="p-4"><div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{item.stockId || '—'}</div><div className="mt-0.5 text-[10px] text-zinc-500">{item.batch || 'Sem lote'}</div></td><td className="p-4"><Badge tone={item.status === 'em_uso' ? 'emerald' : item.status === 'manutencao' ? 'amber' : 'neutral'}>{item.status.replace('_',' ')}</Badge></td><td className="p-4 text-xs text-zinc-500">{item.vehicleId || 'Não vinculado'}</td><td className="p-4"><div className="flex gap-1"><button type="button" className="rounded-xl p-2 text-zinc-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-500/10" onClick={()=>onEdit(item)} aria-label={`Editar ${item.imei}`}><Edit2 size={16}/></button><button type="button" className="rounded-xl p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" onClick={()=>onDelete(item)} aria-label={`Excluir ${item.imei}`}><Trash2 size={16}/></button></div></td></tr>;
}

function TrackerCard({ item, onEdit, onDelete }: { item: ManagedTracker; onEdit: (item: ManagedTracker) => void; onDelete: (item: ManagedTracker) => void }) {
  return <article className="p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600"><Satellite size={20}/></div><div className="min-w-0"><div className="truncate font-bold text-zinc-900 dark:text-white">{item.manufacturer} {item.modelName}</div><div className="mt-0.5 font-mono text-[11px] text-zinc-500">{item.imei}</div></div></div><div className="flex"><button type="button" onClick={()=>onEdit(item)} className="shrink-0 rounded-xl p-2 text-zinc-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-500/10"><Edit2 size={16}/></button><button type="button" onClick={()=>onDelete(item)} className="shrink-0 rounded-xl p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><Trash2 size={16}/></button></div></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60"><div><span className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">Estoque</span><span className="mt-1 block font-bold text-zinc-700 dark:text-zinc-300">{item.stockId || '—'}</span></div><div><span className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">Lote</span><span className="mt-1 block font-bold text-zinc-700 dark:text-zinc-300">{item.batch || '—'}</span></div><div><span className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">Chip</span><span className="mt-1 block truncate text-zinc-600 dark:text-zinc-400">{item.simCardId || '—'}</span></div><div><span className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">Status</span><span className="mt-1 block"><Badge tone={item.status === 'em_uso' ? 'emerald' : item.status === 'manutencao' ? 'amber' : 'neutral'}>{item.status.replace('_',' ')}</Badge></span></div></div></article>;
}

function TrackerFormModal(props: { open:boolean; onOpenChange:(v:boolean)=>void; title:string; form:TrackerForm; setForm:React.Dispatch<React.SetStateAction<TrackerForm>>; models:TrackerModel[]; simCards:AvailableSim[]; suppliers:EquipmentSupplier[]; saving:boolean; onSave:()=>void; editing?: boolean }) {
  return <Modal open={props.open} onOpenChange={props.onOpenChange} title={props.title} size="xl" className="!bg-white dark:!bg-zinc-950"><div className="space-y-5"><TrackerFields {...props}/><div className="-mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/60 sm:flex-row sm:justify-end"><button type="button" onClick={()=>props.onOpenChange(false)} className="rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 transition hover:bg-zinc-200 dark:hover:bg-zinc-800">Cancelar</button><button type="button" disabled={props.saving || props.form.imei.length!==15 || !props.form.modelId || !props.form.stockId} onClick={()=>void props.onSave()} className="rounded-xl bg-zinc-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200">{props.saving?'Salvando...':'Salvar equipamento'}</button></div></div></Modal>;
}

function TrackerFields({ form, setForm, models, simCards, suppliers, batchMode=false, editing=false }: { form:TrackerForm; setForm:React.Dispatch<React.SetStateAction<TrackerForm>>; models:TrackerModel[]; simCards:AvailableSim[]; suppliers:EquipmentSupplier[]; batchMode?:boolean; editing?: boolean; [key:string]:any }) {
  const set = (key:keyof TrackerForm, value:any) => setForm(previous=>({...previous,[key]:value}));
  return <div className="grid gap-4 md:grid-cols-2">
    <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-bold"><input type="checkbox" checked={form.invertedLockOutput} onChange={e=>set('invertedLockOutput',e.target.checked)} className="h-4 w-4 accent-primary-500"/> Saída de bloqueio invertida</label>
    <L label="Modelo *"><select className={fieldClass} value={form.modelId} onChange={e=>set('modelId',e.target.value)}><option value="">Selecione</option>{models.map(m=><option key={m.id} value={m.id}>{m.manufacturer} — {m.name} ({m.protocol})</option>)}</select></L>
    {!batchMode && <L label="IMEI *"><input className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`} disabled={editing} inputMode="numeric" maxLength={15} value={form.imei} onChange={e=>set('imei',e.target.value.replace(/\D/g,''))}/></L>}
    {!batchMode && <L label="Chip"><select className={fieldClass} value={form.simCardId} onChange={e=>set('simCardId',e.target.value)}><option value="">Sem chip</option>{form.simCardId && !simCards.some(s => s.id === form.simCardId) && <option value={form.simCardId}>Chip atual — {form.simCardId}</option>}{simCards.map(s=><option key={s.id} value={s.id}>{s.phoneNumber || 'Sem número'} — {s.iccid} ({s.provider || 'operadora'})</option>)}</select></L>}
    <L label="Senha"><input className={fieldClass} type="password" maxLength={80} value={form.password} onChange={e=>set('password',e.target.value)}/></L>
    <L label="Número de série"><input className={fieldClass} maxLength={80} value={form.serialNumber} onChange={e=>set('serialNumber',e.target.value)}/></L>
    <L label="Voltagem mínima da bateria"><input className={fieldClass} type="number" step="0.01" min="0" value={form.minBatteryVoltage} onChange={e=>set('minBatteryVoltage',e.target.value)}/></L>
    <L label="Voltagem máxima da bateria"><input className={fieldClass} type="number" step="0.01" min="0" value={form.maxBatteryVoltage} onChange={e=>set('maxBatteryVoltage',e.target.value)}/></L>
    <L label="Data da compra"><input className={fieldClass} type="date" value={form.purchaseDate} onChange={e=>set('purchaseDate',e.target.value)}/></L>
    <L label="Valor"><input className={fieldClass} type="number" step="0.01" min="0" value={form.purchaseValue} onChange={e=>set('purchaseValue',e.target.value)}/></L>
    <L label="Fornecedor"><select className={fieldClass} value={form.supplierId} onChange={e=>set('supplierId',e.target.value)}><option value="">Sem fornecedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></L>
    <L label="Garantia (meses)"><input className={fieldClass} type="number" min="0" value={form.warrantyMonths} onChange={e=>set('warrantyMonths',e.target.value)}/></L>
    <L label="Estoque *"><input className={fieldClass} maxLength={80} value={form.stockId} onChange={e=>set('stockId',e.target.value)}/></L>
    <L label="Lote"><input className={fieldClass} maxLength={80} value={form.batch} onChange={e=>set('batch',e.target.value)}/></L>
    <label className="md:col-span-2"><span className="mb-1.5 block text-xs font-black uppercase text-content-muted">Obs</span><textarea maxLength={500} className={`${fieldClass} min-h-24`} value={form.notes} onChange={e=>set('notes',e.target.value)}/></label>
  </div>;
}
const L=({label,children}:{label:string;children:React.ReactNode})=><label><span className="mb-1.5 block text-xs font-black uppercase text-content-muted">{label}</span>{children}</label>;
