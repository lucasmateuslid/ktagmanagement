import * as React from 'react';
import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { onSnapshot } from 'firebase/firestore';
import { functions } from '../../services/firebase';
import { systemCollection } from '../../lib/firestore';
import { useSystemAdmin } from '../../contexts/SystemAdminContext';
import { Shield, Plus, Trash2, Loader2 } from 'lucide-react';

interface SystemAdminDoc {
  uid: string;
  addedBy?: string;
  addedAt?: number;
}

export const AdminSystemAdmins = () => {
  const { admin: me } = useSystemAdmin();
  const [admins, setAdmins] = useState<SystemAdminDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [emailToAdd, setEmailToAdd] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(systemCollection('system_admins'), (snap) => {
      const list = snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));
      list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      setAdmins(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!functions) return;
    setError('');
    setAdding(true);
    try {
      const fn = httpsCallable(functions, 'addSystemAdmin');
      await fn({ email: emailToAdd.trim() });
      setEmailToAdd('');
    } catch (e: any) {
      setError(e?.message || 'Falha ao adicionar.');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (uid: string) => {
    if (!functions) return;
    if (!confirm(`Remover ${uid} dos super admins?`)) return;
    try {
      const fn = httpsCallable(functions, 'removeSystemAdmin');
      await fn({ uid });
    } catch (e: any) {
      alert(`Falha: ${e?.message || e}`);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Super Admins</h1>
        <p className="text-zinc-500 text-sm mt-1">Usuários com acesso ao painel da plataforma.</p>
      </header>

      <form onSubmit={add} className="flex gap-2 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
        <input
          type="email"
          required
          value={emailToAdd}
          onChange={(e) => setEmailToAdd(e.target.value)}
          placeholder="email do usuário (já cadastrado no Firebase Auth)"
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-lg"
        >
          {adding ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
          Adicionar
        </button>
      </form>
      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-zinc-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : admins.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <Shield className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum super admin</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="text-left px-5 py-3">UID</th>
                <th className="text-left px-5 py-3">Adicionado em</th>
                <th className="text-right px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.uid} className="border-t border-zinc-800/60">
                  <td className="px-5 py-3 font-mono text-xs">
                    {a.uid}
                    {me?.uid === a.uid && <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-amber-500">(você)</span>}
                  </td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">
                    {a.addedAt ? new Date(a.addedAt).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => remove(a.uid)}
                      className="text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
