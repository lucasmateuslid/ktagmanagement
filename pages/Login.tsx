
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
  const { login, register, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [ip, setIp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIp(data.ip))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
        if (isLogin) {
            const err = await login(email, password);
            if (err) {
                setError(err);
                addNotification('error', 'Falha no Login', err);
            }
        } else {
            if (!name) throw new Error("O nome é obrigatório");
            if (!password) throw new Error("A senha é obrigatória");
            await register(name, email, password, ip || 'Unknown IP');
            setSuccess("Registro pendente de aprovação pelo gestor.");
            addNotification('info', 'Solicitação Enviada', 'Aguarde a aprovação do administrador.');
            setIsLogin(true);
            setName('');
            setPassword('');
        }
    } catch (e: any) {
        const msg = e.message || "Ocorreu um erro inesperado.";
        setError(msg);
        addNotification('error', 'Erro', msg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex font-sans overflow-hidden">
      
      {/* Form Side */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-32 relative z-10 bg-black">
         <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-12"
         >
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black font-display font-black text-xl mb-6 shadow-2xl shadow-white/10">
                K
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight mb-3 text-white">
              {isLogin ? 'Bem-Vindo!' : 'Join K-TAG'}
            </h1>
            <p className="text-zinc-500 font-medium">
              {isLogin ? 'Acesse o console de gestão da sua frota.' : 'Solicite acesso ao painel Pro.'}
            </p>
         </motion.div>

         <AnimatePresence mode="wait">
            {error && (
                <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ 
                        opacity: 1, 
                        y: 0, 
                        scale: 1,
                        x: [0, -10, 10, -10, 10, 0] // Shake animation
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-400 shadow-lg shadow-red-500/5"
                >
                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                    <div className="flex-1">
                        <p className="text-xs font-black uppercase tracking-widest mb-1">Erro de Autenticação</p>
                        <p className="text-sm font-medium leading-relaxed">{error}</p>
                    </div>
                    <button onClick={() => setError('')} className="text-red-500/50 hover:text-red-400">
                        <X size={16} />
                    </button>
                </motion.div>
            )}

            {success && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-emerald-400"
                >
                    <ShieldCheck className="shrink-0 mt-0.5" size={18} />
                    <div className="flex-1">
                        <p className="text-xs font-black uppercase tracking-widest mb-1">Sucesso</p>
                        <p className="text-sm font-medium leading-relaxed">{success}</p>
                    </div>
                </motion.div>
            )}
         </AnimatePresence>

         <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('fullName')}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-zinc-700 font-bold"
                    placeholder="Nome do Colaborador"
                  />
               </div>
            )}

            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('email')}</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-zinc-700 font-bold"
                placeholder="exemplo@tag.com"
                />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('password')}</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-zinc-700 font-bold"
                placeholder="••••••••"
                />
            </div>

            <button type="submit" disabled={loading}
                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black uppercase tracking-[0.2em] text-xs py-5 rounded-2xl flex items-center justify-center gap-3 transition-all mt-6 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-primary-500/20 active:scale-95"
            >
                {loading ? <Loader2 className="animate-spin" /> : (
                    <>
                       {isLogin ? 'Entrar no Sistema' : 'Solicitar Acesso'} 
                       <ArrowRight size={18} strokeWidth={3} />
                    </>
                )}
            </button>
         </form>

         <div className="mt-10 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} className="text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
                {isLogin ? 'Não tem uma conta? Solicitar agora' : 'Já possui acesso? Fazer Login'}
            </button>
         </div>
      </div>

      {/* Visual Side */}
      <div className="hidden lg:flex w-1/2 bg-zinc-900 relative overflow-hidden items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-black opacity-50"></div>
          
          <div className="relative z-10 text-center">
             <div className="relative w-96 h-96 mx-auto flex items-center justify-center mb-10">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-[1px] border-zinc-700 rounded-full opacity-20"
                ></motion.div>
                <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-8 border-[1px] border-zinc-700 rounded-full opacity-20"
                ></motion.div>
                <ShieldCheck size={140} className="text-primary-500 opacity-90 drop-shadow-[0_0_50px_rgba(245,158,11,0.4)]" />
             </div>
             
             <h2 className="text-2xl font-display font-black text-white uppercase tracking-[0.3em]">Ambiente Seguro</h2>
          </div>
          
          <div className="absolute bottom-12 left-12 right-12 text-center text-zinc-600 text-[10px] font-mono font-bold uppercase tracking-widest">
             <span>Tag Manager Service: v3.0.2 - developed by lucasmateus.tech</span>
          </div>
      </div>

    </div>
  );
};
