import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Cpu, Plus, Radio, RefreshCw, Upload, WalletCards } from 'lucide-react';
import { EquipmentSupplier, SimCard, Tag, Tracker } from '../types';
import { storage } from '../services/storage';
import { auditSimCards, auditTags, auditTrackers } from '../services/assetAudit';

type Kind = 'tracker' | 'sim_card';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const inputClass = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900';

export const AssetManagement = () => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [sims, setSims] = useState<SimCard[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [suppliers, setSuppliers] = useState<EquipmentSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>('tracker');
  const [showForm, setShowForm] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ identifier: '', model: '', supplierId: '', cost: '', warranty: '12', provider: 'smartsim', phone: '' });

  const load = async () => {
    setLoading(true);
    const [trackerRows, simRows, tagRows, supplierRows] = await Promise.all([
      storage.getTrackers(), storage.getSimCards(), storage.getTags(), storage.getEquipmentSuppliers(),
    ]);
    setTrackers(trackerRows); setSims(simRows); setTags(tagRows); setSuppliers(supplierRows);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const audits = useMemo(() => ({ trackers: auditTrackers(trackers), sims: auditSimCards(sims), tags: auditTags(tags) }), [trackers, sims, tags]);
  const alerts = [...audits.sims.lines, ...audits.trackers.lines].sort((a, b) => b.monthlyCost - a.monthlyCost || b.daysIdle - a.daysIdle);

  const buildItem = (identifier: string, phone?: string): Tracker | SimCard => {
    const now = Date.now();
    const id = crypto.randomUUID();
    if (kind === 'tracker') return {
      id, imei: identifier.trim(), model: form.model.trim() || 'Não informado', status: 'disponível',
      supplierId: form.supplierId || undefined, unitCost: Number(form.cost) || 0,
      warrantyMonths: Number(form.warranty) || 0, purchasedAt: now,
      warrantyEndsAt: now + (Number(form.warranty) || 0) * 30 * 86_400_000,
      stockEnteredAt: now, createdAt: now, updatedAt: now,
    };
    return {
      id, iccid: identifier.trim(), phoneNumber: phone?.trim() || form.phone.trim() || undefined,
      provider: form.provider as SimCard['provider'], supplierId: form.supplierId || undefined,
      monthlyCost: Number(form.cost) || 0, status: 'in_stock', stockEnteredAt: now, createdAt: now, updatedAt: now,
    };
  };

  const saveOne = async () => {
    if (!form.identifier.trim()) return setMessage(kind === 'tracker' ? 'Informe o IMEI.' : 'Informe o ICCID.');
    const item = buildItem(form.identifier);
    if (kind === 'tracker') await storage.saveTracker(item as Tracker); else await storage.saveSimCard(item as SimCard);
    setMessage('Item cadastrado e incluído na auditoria.'); setShowForm(false); setForm({ ...form, identifier: '', phone: '' }); await load();
  };

  const importBatch = async () => {
    const rows = batchText.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
    if (!rows.length) return setMessage('Cole ao menos um item por linha.');
    const items = rows.map((row) => { const [identifier, phone] = row.split(/[;,\t]/); return buildItem(identifier, phone); });
    await storage.saveAssetBatch(kind === 'tracker' ? 'trackers' : 'sim_cards', items);
    setBatchText(''); setMessage(`${items.length} itens importados com sucesso.`); await load();
  };

  const addSupplier = async () => {
    const name = window.prompt('Nome do fornecedor');
    if (!name?.trim()) return;
    const now = Date.now();
    await storage.saveEquipmentSupplier({ id: crypto.randomUUID(), name: name.trim(), active: true, createdAt: now, updatedAt: now });
    await load();
  };

  const cards = [
    { label: 'Rastreadores', value: audits.trackers.total, detail: `${audits.trackers.inUse} vinculados · ${audits.trackers.inStock} em estoque`, icon: Cpu },
    { label: 'Tags', value: audits.tags.total, detail: `${audits.tags.inUse} em uso · ${audits.tags.inStock} disponíveis`, icon: Radio },
    { label: 'Linhas / chips', value: audits.sims.total, detail: `${audits.sims.inUse} vinculadas · ${audits.sims.idle} ociosas`, icon: WalletCards },
    { label: 'Custo mensal', value: money.format(audits.sims.totalMonthlyCost), detail: `${money.format(audits.sims.wastedMonthlyCost)} sob risco`, icon: AlertTriangle },
  ];

  return <div className="min-h-full bg-zinc-50 p-4 dark:bg-zinc-950 md:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.2em] text-primary-500">Ativos e conectividade</p><h1 className="text-3xl font-black text-zinc-900 dark:text-white">Controle operacional</h1><p className="mt-1 text-sm text-zinc-500">Estoque, vínculos, garantia, linhas e desperdício por empresa.</p></div>
        <div className="flex gap-2"><button onClick={() => void load()} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700" title="Atualizar"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button><button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-xs font-black uppercase text-white"><Plus size={17}/> Novo ativo</button></div>
      </header>
      {message && <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({label,value,detail,icon:Icon}) => <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase text-zinc-500">{label}</span><Icon size={19} className="text-primary-500"/></div><div className="mt-3 text-3xl font-black dark:text-white">{value}</div><div className="mt-1 text-xs text-zinc-500">{detail}</div></div>)}</section>

      {showForm && <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-black dark:text-white">Cadastro único ou em lote</h2><div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">{(['tracker','sim_card'] as Kind[]).map((item) => <button key={item} onClick={() => setKind(item)} className={`rounded-lg px-3 py-2 text-xs font-bold ${kind === item ? 'bg-white shadow dark:bg-zinc-700' : 'text-zinc-500'}`}>{item === 'tracker' ? 'Rastreador' : 'Chip / linha'}</button>)}</div></div>
        <div className="grid gap-3 md:grid-cols-3"><input className={inputClass} placeholder={kind === 'tracker' ? 'IMEI' : 'ICCID'} value={form.identifier} onChange={(e)=>setForm({...form,identifier:e.target.value})}/>{kind === 'tracker' ? <input className={inputClass} placeholder="Modelo" value={form.model} onChange={(e)=>setForm({...form,model:e.target.value})}/> : <input className={inputClass} placeholder="Número da linha" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/>}<input className={inputClass} type="number" step="0.01" placeholder={kind === 'tracker' ? 'Custo unitário' : 'Custo mensal'} value={form.cost} onChange={(e)=>setForm({...form,cost:e.target.value})}/><select className={inputClass} value={form.supplierId} onChange={(e)=>setForm({...form,supplierId:e.target.value})}><option value="">Sem fornecedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>{kind === 'tracker' ? <input className={inputClass} type="number" placeholder="Garantia em meses" value={form.warranty} onChange={(e)=>setForm({...form,warranty:e.target.value})}/> : <select className={inputClass} value={form.provider} onChange={(e)=>setForm({...form,provider:e.target.value})}>{['smartsim','allcom','algar','arqia','arya','smartgps','other'].map(p=><option key={p}>{p}</option>)}</select>}<div className="flex gap-2"><button onClick={() => void saveOne()} className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-black uppercase text-white dark:bg-white dark:text-black">Salvar</button><button onClick={() => void addSupplier()} className="rounded-xl border px-3 text-xs font-bold dark:border-zinc-700">Fornecedor +</button></div></div>
        <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800"><label className="text-xs font-black uppercase text-zinc-500">Importação em lote — um por linha {kind === 'sim_card' && '(ICCID;telefone)'}</label><div className="mt-2 flex flex-col gap-2 md:flex-row"><textarea className={`${inputClass} min-h-24 font-mono`} value={batchText} onChange={(e)=>setBatchText(e.target.value)} placeholder={kind === 'tracker' ? '860000000000001\n860000000000002' : '895500000000001;+5511999999999'}/><button onClick={() => void importBatch()} className="flex items-center justify-center gap-2 rounded-xl border border-primary-500 px-5 text-xs font-black uppercase text-primary-600"><Upload size={17}/> Importar</button></div></div>
      </section>}

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"><div className="border-b p-5 dark:border-zinc-800"><h2 className="font-black dark:text-white">Auditoria de ociosidade</h2><p className="text-xs text-zinc-500">Ativos sem vínculo, offline ou parados/retornados há 30 dias.</p></div><div className="divide-y dark:divide-zinc-800">{alerts.length ? alerts.slice(0,20).map(a=><div key={`${a.id}-${a.reason}`} className="flex items-center justify-between gap-4 p-4"><div><div className="text-sm font-bold dark:text-white">{a.label}</div><div className="text-xs text-zinc-500">{a.reason.replace(/_/g,' ')} · {a.daysIdle} dias</div></div><span className="text-sm font-black text-rose-500">{a.monthlyCost ? money.format(a.monthlyCost) : 'Atenção'}</span></div>) : <div className="p-10 text-center text-sm text-zinc-500">Nenhuma ociosidade crítica encontrada.</div>}</div></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center gap-2"><Boxes className="text-primary-500"/><h2 className="font-black dark:text-white">Regras da auditoria</h2></div><ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400"><li>• Linha ativa sem rastreador vinculado entra como desperdício.</li><li>• Item em estoque ou devolvido há 30 dias entra como ocioso.</li><li>• Equipamento instalado sem comunicação há 30 dias entra como offline.</li><li>• O custo sob risco soma a mensalidade real das linhas afetadas.</li><li>• Movimentações são imutáveis e podem referenciar cliente, veículo e ordem de serviço.</li></ul></div>
      </section>
    </div>
  </div>;
};
