import * as React from 'react';
import { useState } from 'react';
import { useSystemAdmin } from '../../contexts/SystemAdminContext';
import { ShieldCheck, Loader2 } from 'lucide-react';

export const AdminLogin = () => {
  const { login } = useSystemAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const err = await login(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <ShieldCheck className="text-amber-500" size={28} />
          </div>
          <h1 className="font-display text-xl font-black uppercase tracking-widest">Painel Super Admin</h1>
          <p className="text-xs font-bold text-zinc-500 tracking-widest uppercase">Acesso restrito</p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900/50 text-red-200 px-4 py-3 rounded-xl text-sm text-center font-bold">
            {error}
          </div>
        )}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            autoComplete="username"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            autoComplete="current-password"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Entrar'}
          </button>
        </form>

        <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center">
          Acesso liberado apenas a usuários presentes em <code className="text-amber-500">/system_admins</code>.
        </p>
      </div>
    </main>
  );
};
