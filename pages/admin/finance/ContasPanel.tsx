import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Loader2, AlertTriangle, CheckCircle2, Clock, ArrowDownCircle, ArrowUpCircle,
  Trash2, Tag as TagIcon, X,
} from 'lucide-react';
import { adminApi } from '../../../services/adminApi';
import type { Expense, ExpenseCategory, ExpenseStatus, ExpenseType } from '../../../types';
import { Select, type SelectOption } from '../../../components/ui/select';
import { CurrencyInput } from '../../../components/ui/currency-input';
import { SkeletonRows } from '../../../components/ui/skeleton';
import { Badge } from '../../../components/ui/badge';
import { ResponsiveModal, ModalSection, ModalFooterActions } from '../../../components/ui/responsive-modal';

const fmtBRL = (cents?: number) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ms?: number | null) =>
  ms ? new Date(ms).toLocaleDateString('pt-BR') : '—';

const TYPE_OPTIONS: SelectOption<'all' | ExpenseType>[] = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'payable', label: 'A pagar', icon: <ArrowUpCircle size={13} /> },
  { value: 'receivable', label: 'A receber', icon: <ArrowDownCircle size={13} /> },
];

const STATUS_OPTIONS: SelectOption<'all' | ExpenseStatus>[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente', icon: <Clock size={13} /> },
  { value: 'paid', label: 'Pago', icon: <CheckCircle2 size={13} /> },
  { value: 'overdue', label: 'Vencido', icon: <AlertTriangle size={13} /> },
];

export const ContasPanel = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | ExpenseType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ExpenseStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [error, setError] = useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [exp, cats] = await Promise.all([
        adminApi.listExpenses({
          type: typeFilter === 'all' ? undefined : typeFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
        }),
        adminApi.listExpenseCategories(),
      ]);
      setExpenses(exp.expenses);
      setCategories(cats.categories);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, categoryFilter]);

  useEffect(() => { void load(); }, [load]);

  const categoryLabel = (id: string | null) => categories.find(c => c.id === id)?.label || 'Sem categoria';

  const markPaid = async (id: string) => {
    await adminApi.updateExpense({ id, status: 'paid' });
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este lançamento?')) return;
    await adminApi.deleteExpense(id);
    void load();
  };

  const totals = useMemo(() => {
    let payable = 0, receivable = 0;
    for (const e of expenses) {
      if (e.status === 'paid') continue;
      if (e.type === 'payable') payable += e.amountCents;
      else receivable += e.amountCents;
    }
    return { payable, receivable };
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">A pagar (pendente)</span>
            <ArrowUpCircle size={16} className="text-red-400" />
          </div>
          <div className="font-display text-xl font-black text-red-400">{fmtBRL(totals.payable)}</div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">A receber (pendente)</span>
            <ArrowDownCircle size={16} className="text-emerald-400" />
          </div>
          <div className="font-display text-xl font-black text-emerald-400">{fmtBRL(totals.receivable)}</div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44"><Select value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} /></div>
        <div className="w-44"><Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} /></div>
        <div className="w-52">
          <Select<string>
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: 'all', label: 'Todas categorias' }, ...categories.map(c => ({ value: c.id, label: c.label }))]}
          />
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setShowCategoryForm(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white px-3 py-2 rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors"
          >
            <TagIcon size={13} /> Categorias
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-zinc-950 bg-amber-500 hover:bg-amber-400 px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={13} /> Nova conta
          </button>
        </div>
      </div>

      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-5"><SkeletonRows rows={5} cols={5} /></div>
        ) : expenses.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum lançamento</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
                <tr>
                  <th className="text-left px-5 py-3.5">Descrição</th>
                  <th className="text-left px-5 py-3.5">Categoria</th>
                  <th className="text-left px-5 py-3.5">Tipo</th>
                  <th className="text-left px-5 py-3.5">Vencimento</th>
                  <th className="text-left px-5 py-3.5">Valor</th>
                  <th className="text-left px-5 py-3.5">Status</th>
                  <th className="text-right px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 font-bold text-xs">{e.description}</td>
                    <td className="px-5 py-3.5 text-zinc-400 text-xs">{categoryLabel(e.categoryId)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={e.type === 'payable' ? 'red' : 'emerald'}>{e.type === 'payable' ? 'A pagar' : 'A receber'}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400 text-xs">{fmtDate(e.dueDate)}</td>
                    <td className="px-5 py-3.5 font-mono text-zinc-200">{fmtBRL(e.amountCents)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={e.status === 'paid' ? 'emerald' : e.status === 'overdue' ? 'red' : 'amber'}>
                        {e.status === 'paid' ? 'Pago' : e.status === 'overdue' ? 'Vencido' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {e.status !== 'paid' && (
                          <button
                            onClick={() => markPaid(e.id)}
                            className="text-xs font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300"
                          >
                            Marcar pago
                          </button>
                        )}
                        <button onClick={() => remove(e.id)} className="text-zinc-500 hover:text-red-400 p-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <NewExpenseModal
          categories={categories}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); void load(); }}
        />
      )}
      {showCategoryForm && (
        <CategoriesModal
          categories={categories}
          onClose={() => setShowCategoryForm(false)}
          onChanged={(cats) => setCategories(cats)}
        />
      )}
    </div>
  );
};

const NewExpenseModal = ({
  categories, onClose, onCreated,
}: { categories: ExpenseCategory[]; onClose: () => void; onCreated: () => void }) => {
  const [type, setType] = useState<ExpenseType>('payable');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await adminApi.createExpense({
        type,
        categoryId: categoryId || undefined,
        description: description.trim(),
        amountCents,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      });
      onCreated();
    } catch (e: any) {
      setError(e?.message || 'Falha ao criar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      size="md"
      title="Nova conta"
      footer={
        <ModalFooterActions>
          <button type="button" onClick={onClose} className="flex-1 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white py-2.5 rounded-xl border border-white/5 hover:bg-white/[0.04]">
            Cancelar
          </button>
          <button type="submit" form="new-expense-form" disabled={submitting} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs py-2.5 rounded-xl">
            {submitting ? <Loader2 className="inline animate-spin" size={14} /> : 'Criar'}
          </button>
        </ModalFooterActions>
      }
    >
      <ModalSection>
        <form id="new-expense-form" onSubmit={submit} className="space-y-3">
          {error && <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Tipo</label>
            <Select<ExpenseType>
              value={type}
              onChange={setType}
              options={[
                { value: 'payable', label: 'A pagar (despesa)' },
                { value: 'receivable', label: 'A receber' },
              ]}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Valor</label>
            <CurrencyInput value={amountCents} onChange={setAmountCents} minCents={1} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Categoria</label>
            <Select<string>
              value={categoryId}
              onChange={setCategoryId}
              options={[{ value: '', label: 'Sem categoria' }, ...categories.map(c => ({ value: c.id, label: c.label }))]}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Vencimento</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
            />
          </div>
        </form>
      </ModalSection>
    </ResponsiveModal>
  );
};

const CategoriesModal = ({
  categories, onClose, onChanged,
}: { categories: ExpenseCategory[]; onClose: () => void; onChanged: (cats: ExpenseCategory[]) => void }) => {
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    try {
      const res = await adminApi.upsertExpenseCategory({ label: label.trim() });
      onChanged(res.categories);
      setLabel('');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    const res = await adminApi.deleteExpenseCategory(id);
    onChanged(res.categories);
  };

  return (
    <ResponsiveModal open onClose={onClose} size="sm" title="Categorias de despesa">
      <ModalSection>
        <div className="space-y-2 mb-4">
          {categories.length === 0 && (
            <p className="text-xs text-zinc-600 italic">Nenhuma categoria cadastrada.</p>
          )}
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
              <span className="text-sm">{c.label}</span>
              <button onClick={() => remove(c.id)} className="text-zinc-500 hover:text-red-400 p-1">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={add} className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nova categoria (ex: Hospedagem)"
            className="flex-1 bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
          />
          <button type="submit" disabled={submitting || !label.trim()} className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs">
            <Plus size={14} />
          </button>
        </form>
      </ModalSection>
    </ResponsiveModal>
  );
};
