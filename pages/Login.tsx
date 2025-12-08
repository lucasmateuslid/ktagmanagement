
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login = () => {
  const { login, register, isAuthenticated } = useAuth();
  const { t } = useLanguage();
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

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
        if (isLogin) {
            const err = await login(email);
            if (err) setError(err);
        } else {
            if (!name) throw new Error("Name is required");
            await register(name, email, ip || 'Unknown IP');
            setSuccess("Registro pedente de aprovação pelo gestor.");
            setIsLogin(true);
            setName('');
            setPassword('');
        }
    } catch (e: any) {
        setError(e.message || "An error occurred");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex font-sans">
      
      {/* Left Side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-32 relative z-10">
         <div className="mb-12">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-black font-display font-black text-2xl mb-6">
                K
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight mb-3">
              {isLogin ? 'Bem-Vindo!' : 'Join K-TAG'}
            </h1>
            <p className="text-zinc-500">
              {t('portalSubtitle')}
            </p>
         </div>

         <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">{error}</div>}
            {success && <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm">{success}</div>}

            {!isLogin && (
               <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('fullName')}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                    placeholder="Jane Doe"
                  />
               </div>
            )}

            <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('email')}</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                placeholder="name@company.com"
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('password')}</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                placeholder="••••••••"
                />
            </div>

            <button type="submit" disabled={loading}
                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 className="animate-spin" /> : (
                    <>
                       {isLogin ? t('signIn') : t('createAccount')} 
                       <ArrowRight size={20} />
                    </>
                )}
            </button>
         </form>

         <div className="mt-8 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-zinc-500 hover:text-white transition-colors text-sm">
                {isLogin ? t('noAccount') : t('haveAccount')}
            </button>
         </div>
      </div>

      {/* Right Side: Visual */}
      <div className="hidden lg:flex w-1/2 bg-zinc-900 relative overflow-hidden items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-black opacity-50"></div>
          
          {/* Abstract C6 Style Visual */}
          <div className="relative z-10 w-96 h-96">
             <div className="absolute inset-0 border-[1px] border-zinc-700 rounded-full opacity-20"></div>
             <div className="absolute inset-4 border-[1px] border-zinc-700 rounded-full opacity-20"></div>
             <div className="absolute inset-8 border-[1px] border-zinc-700 rounded-full opacity-20"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                 <ShieldCheck size={120} className="text-primary-500 opacity-80 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]" />
             </div>
          </div>
          
          <div className="absolute bottom-12 left-12 text-zinc-500 text-xs font-mono">
             SECURE ACCESS GATEWAY v2.0 - Developed By Lucasmateus.tech
          </div>
      </div>

    </div>
  );
};
