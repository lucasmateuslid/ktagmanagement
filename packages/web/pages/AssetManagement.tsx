import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Cpu, Plus, Radio, RefreshCw, WalletCards } from 'lucide-react';
import { EquipmentSupplier, SimCard, Tag, Tracker } from '../types';
import { storage } from '../services/storage';
import { auditSimCards, auditTags, auditTrackers } from '../services/assetAudit';

type Kind = 'sim_card';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const inputClass = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900';

export const AssetManagement = () => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [sims, setSims] = useState<SimCard[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [suppliers, setSuppliers] = useState<EquipmentSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind] = useState<Kind>('sim_card');
  const [showForm, setShowForm] = useState(false);
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
    return {
      id, iccid: identifier.trim(), phoneNumber: phone?.trim() || form.phone.trim() || undefined,
      provider: form.provider as SimCard['provider'], supplierId: form.supplierId || undefined,
      monthlyCost: Number(form.cost) || 0, status: 'in_stock', stockEnteredAt: now, createdAt: now, updatedAt: now,
    };
  };

  const saveOne = async () => {
    if (!form.identifier.trim()) return setMessage('Informe o ICCID.');
    const item = buildItem(form.identifier);
    await storage.saveSimCard(item as SimCard);
    setMessage('Item cadastrado e incluído na auditoria.'); setShowForm(false); setForm({ ...form, identifier: '', phone: '' }); await load();
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
        <div className="flex gap-2"><button onClick={() => void load()} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700" title="Atualizar"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button><button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-xs font-black uppercase text-white"><Plus size={17}/> Nova linha / chip</button></div>
      </header>
      {message && <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({label,value,detail,icon:Icon}) => <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase text-zinc-500">{label}</span><Icon size={19} className="text-primary-500"/></div><div className="mt-3 text-3xl font-black dark:text-white">{value}</div><div className="mt-1 text-xs text-zinc-500">{detail}</div></div>)}</section>

      {showForm && <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4"><h2 className="font-black dark:text-white">Cadastrar linha / chip</h2><p className="text-xs text-zinc-500">Cadastre a linha antes de vinculá-la a um equipamento na aba Rastreadores. Importações em lote de equipamentos ficam centralizadas naquela aba.</p></div>
        <div className="grid gap-3 md:grid-cols-3"><input className={inputClass} placeholder="ICCID" value={form.identifier} onChange={(e)=>setForm({...form,identifier:e.target.value})}/><input className={inputClass} placeholder="Número da linha" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/><input className={inputClass} type="number" step="0.01" placeholder="Custo mensal" value={form.cost} onChange={(e)=>setForm({...form,cost:e.target.value})}/><select className={inputClass} value={form.supplierId} onChange={(e)=>setForm({...form,supplierId:e.target.value})}><option value="">Sem fornecedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select className={inputClass} value={form.provider} onChange={(e)=>setForm({...form,provider:e.target.value})}>{['smartsim','allcom','algar','arqia','arya','smartgps','other'].map(p=><option key={p}>{p}</option>)}</select><div className="flex gap-2"><button onClick={() => void saveOne()} className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-black uppercase text-white dark:bg-white dark:text-black">Salvar linha</button><button onClick={() => void addSupplier()} className="rounded-xl border px-3 text-xs font-bold dark:border-zinc-700">Fornecedor +</button></div></div>
      </section>}

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 p-5 dark:border-zinc-800"><h2 className="font-black dark:text-white">Equipamentos organizados</h2><p className="text-xs text-zinc-500">Cadastro e lotes são administrados exclusivamente em Rastreadores.</p></div>
          <div className="max-h-80 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">{trackers.length ? trackers.map(item=><div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 p-4"><div><div className="font-mono text-xs font-bold dark:text-white">{item.imei}</div><div className="mt-1 text-xs text-zinc-500">{item.model || (item as any).modelName || 'Modelo não informado'} · {item.stockId || 'Estoque não informado'}{item.batch ? ` · Lote ${item.batch}` : ''}</div></div><span className="self-center rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{item.status.replace('_',' ')}</span></div>) : <div className="p-8 text-center text-sm text-zinc-500">Nenhum equipamento cadastrado.</div>}</div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 p-5 dark:border-zinc-800"><h2 className="font-black dark:text-white">Linhas e chips</h2><p className="text-xs text-zinc-500">Linhas disponíveis podem ser selecionadas no cadastro individual do rastreador.</p></div>
          <div className="max-h-80 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">{sims.length ? sims.map(item=><div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 p-4"><div><div className="font-mono text-xs font-bold dark:text-white">{item.iccid}</div><div className="mt-1 text-xs text-zinc-500">{item.phoneNumber || 'Sem número'} · {item.provider} · {money.format(item.monthlyCost || 0)}/mês</div></div><span className={`self-center rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.trackerId ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}`}>{item.trackerId ? 'Vinculado' : 'Disponível'}</span></div>) : <div className="p-8 text-center text-sm text-zinc-500">Nenhuma linha cadastrada.</div>}</div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"><div className="border-b p-5 dark:border-zinc-800"><h2 className="font-black dark:text-white">Auditoria de ociosidade</h2><p className="text-xs text-zinc-500">Ativos sem vínculo, offline ou parados/retornados há 30 dias.</p></div><div className="divide-y dark:divide-zinc-800">{alerts.length ? alerts.slice(0,20).map(a=><div key={`${a.id}-${a.reason}`} className="flex items-center justify-between gap-4 p-4"><div><div className="text-sm font-bold dark:text-white">{a.label}</div><div className="text-xs text-zinc-500">{a.reason.replace(/_/g,' ')} · {a.daysIdle} dias</div></div><span className="text-sm font-black text-rose-500">{a.monthlyCost ? money.format(a.monthlyCost) : 'Atenção'}</span></div>) : <div className="p-10 text-center text-sm text-zinc-500">Nenhuma ociosidade crítica encontrada.</div>}</div></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center gap-2"><Boxes className="text-primary-500"/><h2 className="font-black dark:text-white">Regras da auditoria</h2></div><ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400"><li>• Linha ativa sem rastreador vinculado entra como desperdício.</li><li>• Item em estoque ou devolvido há 30 dias entra como ocioso.</li><li>• Equipamento instalado sem comunicação há 30 dias entra como offline.</li><li>• O custo sob risco soma a mensalidade real das linhas afetadas.</li><li>• Movimentações são imutáveis e podem referenciar cliente, veículo e ordem de serviço.</li></ul></div>
      </section>
    </div>
  </div>;
};
