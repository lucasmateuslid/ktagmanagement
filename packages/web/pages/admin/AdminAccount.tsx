import * as React from 'react';
import { useState } from 'react';
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useSystemAdmin } from '../../contexts/SystemAdminContext';
import {
  Shield, KeyRound, AlertTriangle, CheckCircle2, Loader2, Eye, EyeOff, Mail, User as UserIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  tone: 'red' | 'amber' | 'emerald';
  hints: string[];
}

/** Heurística simples para força de senha — 0 (vazia) a 4 (forte). */
function scorePassword(pw: string): PasswordStrength {
  const hints: string[] = [];
  let score = 0;
  if (pw.length >= 8) score++; else hints.push('Mínimo 8 caracteres');
  if (pw.length >= 12) score++; else if (pw.length >= 8) hints.push('Ideal: 12+ caracteres');
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++; else hints.push('Misturar MAIÚSCULAS e minúsculas');
  if (/\d/.test(pw)) score++; else hints.push('Incluir números');
  if (/[^A-Za-z0-9]/.test(pw)) score = Math.min(4, score + 1); else hints.push('Incluir símbolo (!, @, #…)');

  const label =
    score >= 4 ? 'Forte' :
      score === 3 ? 'Boa' :
        score === 2 ? 'Média' :
          score === 1 ? 'Fraca' :
            'Muito fraca';
  const tone: 'red' | 'amber' | 'emerald' = score >= 4 ? 'emerald' : score >= 2 ? 'amber' : 'red';

  return { score: score as PasswordStrength['score'], label, tone, hints };
}

export const AdminAccount = () => {
  const { admin } = useSystemAdmin();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const strength = React.useMemo(() => scorePassword(newPassword), [newPassword]);
  const passwordsMatch = newPassword === confirmPassword;
  const minMet = newPassword.length >= 8;
  const canSubmit = currentPassword.length > 0 && minMet && passwordsMatch && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!auth?.currentUser || !auth.currentUser.email) {
      setError('Sessão expirada. Faça login novamente.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('A nova senha deve ser diferente da atual.');
      return;
    }
    setSubmitting(true);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPassword);
      setSuccess('Senha alterada com sucesso. Você pode continuar usando o painel.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Senha atual incorreta.');
      } else if (code === 'auth/weak-password') {
        setError('Nova senha rejeitada pelo Firebase — escolha algo mais forte.');
      } else if (code === 'auth/requires-recent-login') {
        setError('Por segurança, refaça o login e tente novamente.');
      } else if (code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
      } else {
        setError(e?.message || 'Falha ao alterar senha.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Minha conta</h1>
        <p className="text-zinc-500 text-sm mt-1">Informações da sua sessão e segurança</p>
      </header>

      {/* Identidade */}
      <section className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-60 h-60 rounded-full bg-amber-500/10 blur-[100px]" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center text-zinc-950 font-display font-black text-xl shadow-lg shadow-amber-500/30">
            {(admin?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display font-black text-lg truncate">
                {admin?.displayName || admin?.email?.split('@')[0] || 'admin'}
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                <Shield size={10} /> Super Admin
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Mail size={11} className="text-zinc-600" /> {admin?.email || '—'}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-mono mt-1">
              <UserIcon size={10} /> UID: {admin?.uid}
            </div>
          </div>
        </div>
      </section>

      {/* Alteração de senha */}
      <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound size={16} className="text-amber-500" />
          <h2 className="font-display font-black text-sm uppercase tracking-widest">Alterar senha</h2>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <PasswordField
            label="Senha atual"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent(v => !v)}
            autoComplete="current-password"
            required
          />

          <PasswordField
            label="Nova senha"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggleShow={() => setShowNew(v => !v)}
            autoComplete="new-password"
            required
          />

          {/* Indicador de força */}
          {newPassword && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className={cn(
                      'flex-1 h-1 rounded-full transition-colors',
                      i <= strength.score
                        ? strength.tone === 'emerald' ? 'bg-emerald-500'
                          : strength.tone === 'amber' ? 'bg-amber-500'
                            : 'bg-red-500'
                        : 'bg-white/10',
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className={cn(
                  'text-[10px] font-black uppercase tracking-widest',
                  strength.tone === 'emerald' ? 'text-emerald-400' :
                    strength.tone === 'amber' ? 'text-amber-400' :
                      'text-red-400',
                )}>
                  {strength.label}
                </span>
                {strength.hints.length > 0 && newPassword.length > 0 && (
                  <span className="text-[10px] text-zinc-500">{strength.hints[0]}</span>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Confirmar nova senha</label>
            <input
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              className={cn(
                'w-full bg-white/[0.03] border rounded-xl px-3 py-2.5 text-sm font-mono outline-none transition-colors',
                'placeholder:text-zinc-600 focus:bg-white/[0.05]',
                confirmPassword && !passwordsMatch
                  ? 'border-red-500/40 focus:border-red-500/60'
                  : confirmPassword && passwordsMatch
                    ? 'border-emerald-500/40 focus:border-emerald-500/60'
                    : 'border-white/5 hover:border-white/10 focus:border-amber-500/40',
              )}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-red-400">As senhas não coincidem</p>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2"
            >
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3 py-2"
            >
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </motion.div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-[10px] text-zinc-600 leading-relaxed flex-1">
              Sua sessão atual permanece ativa após a troca. Outros dispositivos podem precisar fazer login novamente.
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0',
                canSubmit
                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20'
                  : 'bg-amber-500/20 text-amber-300/60 cursor-not-allowed',
              )}
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
              Alterar senha
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

const PasswordField = ({
  label, value, onChange, show, onToggleShow, autoComplete, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
  required?: boolean;
}) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{label}</label>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 focus:bg-white/[0.05] rounded-xl px-3 py-2.5 pr-10 text-sm font-mono outline-none transition-colors placeholder:text-zinc-600"
      />
      <button
        type="button"
        onClick={onToggleShow}
        tabIndex={-1}
        aria-label={show ? 'Ocultar' : 'Mostrar'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-amber-400 p-1.5 rounded-md hover:bg-white/5 transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  </div>
);
