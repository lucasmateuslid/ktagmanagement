import * as React from 'react';
import { useState } from 'react';
import { useSystemAdmin } from '../../contexts/SystemAdminContext';
import { ShieldCheck, Loader2, AlertTriangle, Sun, Moon } from 'lucide-react';
import { useAdminTheme } from '../../hooks/useAdminTheme';
import { cn } from '../../lib/utils';

export const AdminLogin = () => {
  const { login } = useSystemAdmin();
  const { theme, toggle: toggleTheme } = useAdminTheme();
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
    <main className="relative min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 overflow-hidden">
      {/* Backdrop ornaments */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-[28rem] h-[28rem] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-32 w-[28rem] h-[28rem] bg-amber-500/5 rounded-full blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Toggle de tema canto superior direito */}
      <button
        onClick={toggleTheme}
        aria-label={theme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
        title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        className={cn(
          'absolute top-5 right-5 z-10 inline-flex items-center gap-2 px-3 h-9 rounded-xl',
          'text-zinc-400 hover:text-amber-400 bg-white/[0.03] hover:bg-white/[0.06]',
          'border border-white/5 hover:border-white/10 transition-colors text-[10px] font-black uppercase tracking-widest',
        )}
      >
        {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        {theme === 'light' ? 'Dark' : 'Light'}
      </button>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/40 blur-xl rounded-full" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/40 flex items-center justify-center">
              <ShieldCheck className="text-amber-400" size={30} />
            </div>
          </div>
          <div className="text-amber-500 text-[10px] font-black uppercase tracking-[0.3em]">K-TAG Platform</div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest">Super Admin</h1>
          <p className="text-[11px] font-bold text-zinc-500 tracking-widest uppercase">Acesso restrito · auditado</p>
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-2xl p-6 shadow-2xl shadow-black/40">
          {error && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/50 text-red-200 px-4 py-3 rounded-xl text-sm font-medium mb-4">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="username"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : 'Entrar no painel'}
            </button>
          </form>
        </div>

        <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center mt-6">
          Acesso liberado apenas a usuários em <code className="text-amber-500">/system_admins</code>
        </p>
      </div>
    </main>
  );
};
