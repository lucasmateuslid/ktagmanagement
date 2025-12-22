import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import * as ReactRouterDOM from 'react-router-dom';
import { ShieldCheck, ArrowRight, Loader2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const { useNavigate } = ReactRouterDOM as any;

export const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  
  const [emailOrCpf, setEmailOrCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        // Se for apenas números, tratamos como login de cliente
        let loginIdentifier = emailOrCpf.trim();
        if (/^\d+$/.test(loginIdentifier)) {
          loginIdentifier = `${loginIdentifier}@client.ktag`;
        }

        const err = await login(loginIdentifier, password);
        if (err) {
            setError(err);
            addNotification('error', 'Falha no Login', err);
        }
    } catch (e: any) {
        setError(e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex font-sans overflow-hidden">
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-32 relative z-10 bg-black min-h-screen">
         <div className="flex-1 flex flex-col justify-center py-12">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-12">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black font-display font-black text-xl mb-6 shadow-2xl">K</div>
                <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight mb-3">Portal de Acesso</h1>
                <p className="text-zinc-500 font-medium">Empresas e Clientes: Gerencie sua segurança aqui.</p>
            </motion.div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">E-mail ou CPF</label>
                    <input type="text" required value={emailOrCpf} onChange={e => setEmailOrCpf(e.target.value)} 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:border-primary-500 outline-none font-bold"
                    placeholder="E-mail ou CPF (Só números)"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Senha</label>
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:border-primary-500 outline-none font-bold"
                    placeholder="••••••••"
                    />
                </div>
                <button type="submit" disabled={loading}
                    className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-[0.2em] text-xs py-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <>Entrar no Console <ArrowRight size={18} strokeWidth={3} /></>}
                </button>
            </form>
            
            <div className="mt-12 text-center text-zinc-600 text-[10px] font-black uppercase tracking-widest leading-loose">
                Clientes: Use seu CPF e os 6 primeiros dígitos para o primeiro acesso.<br/> 
                Problemas com acesso? Contate sua central de rastreamento.
            </div>
         </div>

         {/* Mobile Attribution Footer */}
         <div className="pb-8 flex flex-col items-center gap-1 text-center lg:hidden opacity-40">
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
              K-Tag Manager Secure. v3.0.2
            </p>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
              developed by <a href="https://lucasmateus.tech/" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-primary-500/40 transition-colors">lucasmateus.tech</a>
            </p>
         </div>
      </div>

      <div className="hidden lg:flex w-1/2 bg-zinc-900 relative flex-col items-center justify-center gap-10">
          <ShieldCheck size={140} className="text-primary-500 opacity-90 drop-shadow-[0_0_50px_rgba(245,158,11,0.4)]" />
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] opacity-60">
              K-Tag Manager Secure. v3.0.2
            </p>
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
              developed by <a href="https://lucasmateus.tech/" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-primary-500/40 transition-colors">lucasmateus.tech</a>
            </p>
          </div>
      </div>
    </div>
  );
};