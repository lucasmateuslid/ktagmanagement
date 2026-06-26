import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Bot, Loader2, Activity, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../services/storage';
import { ChatMessage } from './ai-assistant/types';
import { AiMessageItem } from './ai-assistant/AiMessageItem';
import { useAiLogic } from './ai-assistant/useAiLogic';

const MotionDiv = motion.div as any;

export const AiAssistant: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  
  const [status, setStatus] = useState<string>('Terminal Conectado');
  const [messages, setMessages] = useState<ChatMessage[]>([{
      id: 'init',
      role: 'model',
      rawText: 'Olá! Sou a **Monitora 360 AI**, sua assistente analítica de operações. Posso localizar veículos, checar a saúde da frota, alertar sobre atrasos e analisar gargalos técnicos do seu negócio. Como posso ajudar agora?',
      content: 'Olá! Sou a **Monitora 360 AI**, sua assistente analítica de operações. Posso localizar veículos, checar a saúde da frota, alertar sobre atrasos e analisar gargalos técnicos do seu negócio. Como posso ajudar agora?'
  }]);
  const [loading, setLoading] = useState(false);
  
  const hasAlertedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { processMessage } = useAiLogic({ messages, setMessages, setStatus, setLoading });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
        scrollToBottom();
    }
  }, [messages, isOpen, loading]);

  // --- MONITORAMENTO INTELIGENTE ---
  useEffect(() => {
    if (!currentUser || hasAlertedRef.current) return;

    const checkCriticalSchedules = async () => {
        try {
            const roleForQuery = (currentUser.role === 'admin' || currentUser.role === 'moderator') ? 'admin' : 'user';
            const schedules = await storage.getSchedules(roleForQuery, currentUser.id);
            const now = Date.now();
            const criticalLimit = 60 * 60 * 1000; // 60 minutos

            const delayedSchedules = schedules.filter(s => {
                if (!['Solicitada', 'Em análise'].includes(s.status)) return false;
                const startTime = s.status === 'Em análise' && s.analysisStartedAt ? s.analysisStartedAt : s.createdAt;
                return (now - startTime) > criticalLimit;
            });

            if (delayedSchedules.length > 0) {
                const count = delayedSchedules.length;
                
                const alertMsg: ChatMessage = {
                    id: Date.now().toString(),
                    role: 'model',
                    rawText: `Alerta Operacional: ${count} serviços em SLA crítico.`,
                    content: (
                        <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-xl flex items-start gap-3 mt-1 w-full max-w-full overflow-hidden">
                            <Activity className="text-red-500 shrink-0" size={16}/>
                            <div>
                                <h4 className="text-red-500 font-black uppercase text-[10px] tracking-widest mb-1">
                                    SLA Crítico Detectado
                                </h4>
                                <p className="text-xs text-zinc-300 font-medium">
                                    Existem <strong>{count} serviço(s)</strong> aguardando ação há mais de 1 hora.
                                </p>
                                <div className="mt-2">
                                    <button onClick={() => window.location.hash = '#/schedules'} className="text-[9px] bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold uppercase transition-colors">
                                        Ver Fila
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                };
                
                setMessages(prev => [...prev, alertMsg]);
                setStatus('Alerta SLA Detectado');
                setIsOpen(true);
                hasAlertedRef.current = true;
            }
        } catch (e) {
            console.error("Auto-Check Error:", e);
        }
    };

    const timer = setTimeout(checkCriticalSchedules, 10000);
    return () => clearTimeout(timer);
  }, [currentUser]);

  const handleConsoleSubmit = async (textOverride?: string) => {
    const userMessage = (textOverride ?? input).trim();
    if (!userMessage || loading) return;

    const newMsgId = Date.now().toString();
    setMessages(prev => [...prev, {
        id: newMsgId,
        role: 'user',
        rawText: userMessage,
        content: userMessage
    }]);
    
    setInput('');
    setLoading(true);
    setStatus('Inspecionando Lógica Cognitiva...');
    
    await processMessage(userMessage);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-3 font-sans">
      <AnimatePresence>
        {isOpen && (
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30 }}
            className="w-[90vw] sm:w-[420px] bg-[#09090b] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-zinc-800"
          >
            {/* Header */}
            <div className="p-3 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 px-1">
                <Sparkles size={14} className="text-emerald-500"/>
                <span className="font-mono font-bold text-[11px] text-white tracking-widest shadow-sm">Monitora 360 AI</span>
              </div>
              <div className="flex items-center gap-3">
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors bg-zinc-800/50 p-1.5 rounded-md"><X size={14} /></button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="p-4 bg-gradient-to-b from-[#09090b] to-[#040405] min-h-[300px] max-h-[400px] overflow-y-auto flex flex-col gap-4">
                {messages.map((msg) => (
                    <AiMessageItem key={msg.id} msg={msg} />
                ))}
                
                {loading && (
                    <div className="flex items-start">
                        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                             <Loader2 size={12} className="animate-spin text-emerald-500"/>
                             <span className="text-[9px] text-zinc-400 font-mono tracking-widest uppercase">{status}</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-3 bg-zinc-900 border-t border-zinc-800 space-y-2">
               {/* Quick Chips */}
               <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {[
                    { label: 'O que você faz?', cmd: 'O que o sistema lhe permite analisar internamente da nossa gestão?', icon: Bot },
                    { label: 'Visão de Negócio', cmd: 'Quero um parecer gerencial da minha operação atual puxando os analíticos.', icon: BarChart3 },
                    { label: 'Estoque Restante', cmd: 'Quantos hardware temos em estoque físico versus aplicados ativos?', icon: Activity }
                  ].map((btn, i) => (
                    <button key={i} onClick={() => handleConsoleSubmit(btn.cmd)} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all shrink-0 border border-zinc-700/50 shadow-sm">
                        {React.createElement(btn.icon, { size: 10 })} {btn.label}
                    </button>
                  ))}
               </div>
               
               <form onSubmit={(e) => { e.preventDefault(); handleConsoleSubmit(); }} className="relative flex items-center group">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Questione o seu assistente de gestão..."
                    className="w-full pl-4 pr-12 py-3.5 bg-[#09090b] border border-zinc-800 rounded-xl outline-none focus:border-emerald-500/50 focus:bg-zinc-900/50 text-zinc-100 text-[13px] placeholder:text-zinc-600 transition-all font-medium shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="absolute right-1.5 p-2 bg-emerald-500 text-white hover:bg-emerald-400 rounded-lg disabled:opacity-50 transition-all shadow-md group-focus-within:opacity-100 opacity-60"
                  >
                    <Send size={15} className="translate-x-[1px] translate-y-[1px]" />
                  </button>
               </form>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center relative overlow-hidden ${
            isOpen 
            ? 'bg-zinc-800 text-zinc-500 scale-90' 
            : 'bg-emerald-500 text-white hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-95'
        }`}
      >
        {isOpen ? <X size={20} /> : (
            <>
                <Bot size={26} strokeWidth={2.5}/>
                <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-black rounded-full shadow-lg"></span>
            </>
        )}
      </button>
    </div>
  );
};
