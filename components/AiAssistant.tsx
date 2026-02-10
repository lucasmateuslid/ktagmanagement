
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { X, Send, Sparkles, Bot, Loader2, Download, Activity, Terminal, MapPin, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../services/storage';
import { hinovaService } from '../services/hinova';
import { useAuth } from '../contexts/AuthContext';

const MotionDiv = motion.div as any;

export const AiAssistant: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  
  // Estado do Console (Substitui o Chat History)
  const [status, setStatus] = useState<string>('Terminal pronto. Aguardando instrução...');
  const [resultContent, setResultContent] = useState<React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);
  
  const hasAlertedRef = useRef(false);

  // --- MONITORAMENTO INTELIGENTE (SEM INTERAÇÃO HUMANA) ---
  useEffect(() => {
    if (!currentUser || hasAlertedRef.current) return;

    const checkCriticalSchedules = async () => {
        try {
            const roleForQuery = (currentUser.role === 'admin' || currentUser.role === 'moderator') ? 'admin' : 'user';
            const schedules = await storage.getSchedules(roleForQuery, currentUser.id);
            const now = Date.now();
            const criticalLimit = 30 * 60 * 1000; // 30 minutos

            const delayedSchedules = schedules.filter(s => {
                if (!['Solicitada', 'Em análise'].includes(s.status)) return false;
                const startTime = s.status === 'Em análise' && s.analysisStartedAt ? s.analysisStartedAt : s.createdAt;
                return (now - startTime) > criticalLimit;
            });

            if (delayedSchedules.length > 0) {
                const count = delayedSchedules.length;
                
                // Exibe alerta direto no console sem "chat"
                setResultContent(
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
                        <Activity className="text-red-500 shrink-0" size={20}/>
                        <div>
                            <h4 className="text-red-500 font-black uppercase text-xs tracking-widest mb-1">
                                SLA Crítico Detectado
                            </h4>
                            <p className="text-sm text-zinc-300 font-medium">
                                Existem <strong>{count} serviço(s)</strong> aguardando ação há mais de 30 minutos.
                            </p>
                            <div className="mt-3">
                                <button onClick={() => window.location.hash = '#/schedules'} className="text-[10px] bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold uppercase transition-colors">
                                    Ver Fila de Atendimento
                                </button>
                            </div>
                        </div>
                    </div>
                );
                setStatus('Alerta Operacional Automático');
                setIsOpen(true);
                hasAlertedRef.current = true;
            }
        } catch (e) {
            console.error("Auto-Check Error:", e);
        }
    };

    const timer = setTimeout(checkCriticalSchedules, 5000);
    return () => clearTimeout(timer);
  }, [currentUser]);

  /* ----------------------------- TOOLS DEFINITION ----------------------------- */
  // OBS: Usando 'as any' e strings literais para evitar erros de importação do Enum Type
  
  const tools = useMemo(() => {
      return [{
        functionDeclarations: [
            {
                name: 'get_vehicle_location',
                description: 'Localiza um veículo pela placa, retornando status e link do mapa.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: { plate: { type: 'STRING' as any, description: 'Placa do veículo' } },
                    required: ['plate']
                }
            },
            {
                name: 'get_fleet_stats',
                description: 'Retorna estatísticas numéricas da frota (total, estoque, ativos).',
                parameters: { type: 'OBJECT' as any, properties: {} }
            },
            {
                name: 'search_external_data',
                description: 'Consulta dados na base externa (SGA/Hinova) para cadastro.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: { query: { type: 'STRING' as any, description: 'Placa ou Chassi' } },
                    required: ['query']
                }
            },
            {
                name: 'generate_report_link',
                description: 'Gera um link para exportação de relatório PDF.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: { 
                        days: { type: 'NUMBER' as any, description: 'Número de dias atrás (padrão 7)' }
                    }
                }
            }
        ]
      }];
  }, []);

  /* ------------------------- EXECUTION LOGIC ----------------------- */

  const executeTool = async (name: string, args: any) => {
    setStatus(`Executando: ${name}...`);
    
    try {
      // 1. LOCALIZAR VEÍCULO
      if (name === 'get_vehicle_location') {
        const vehicles = await storage.getVehicles();
        const cleanPlate = (args.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const v = vehicles.find(veh => veh.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
        
        if (!v) return <div className="text-amber-500 font-mono text-xs">Veículo {cleanPlate} não encontrado na base ativa.</div>;
        
        const resultLink = v.tagId ? `${window.location.origin}/#/map?tagId=${v.tagId}&autoStart=true` : null;
        
        return (
            <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h4 className="text-white font-black text-lg tracking-tight">{v.plate}</h4>
                        <p className="text-zinc-400 text-xs font-bold uppercase">{v.model}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${v.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>{v.status}</span>
                </div>
                {resultLink ? (
                    <a href={resultLink} target="_blank" rel="noreferrer" className="w-full py-2.5 bg-primary-500 hover:bg-primary-400 text-black text-center rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                        <MapPin size={14}/> Rastrear no Mapa
                    </a>
                ) : (
                    <div className="p-2 bg-zinc-900 rounded text-center text-zinc-500 text-[10px] font-bold uppercase border border-zinc-800">Sem rastreador vinculado</div>
                )}
            </div>
        );
      }

      // 2. ESTATÍSTICAS
      if (name === 'get_fleet_stats') {
        const [tags, vehs] = await Promise.all([storage.getTags(), storage.getVehicles()]);
        const linkedCount = vehs.filter(v => v.tagId).length;
        const stockCount = tags.length - linkedCount;
        
        return (
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 text-center">
                    <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">Frota Ativa</p>
                    <p className="text-2xl font-black text-white">{vehs.length}</p>
                </div>
                <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 text-center">
                    <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">Estoque</p>
                    <p className="text-2xl font-black text-primary-500">{stockCount}</p>
                </div>
                <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 col-span-2 flex justify-between items-center px-4">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Total Equipamentos</span>
                    <span className="text-sm font-mono font-bold text-white">{tags.length}</span>
                </div>
            </div>
        );
      }

      // 3. CONSULTA EXTERNA (HINOVA)
      if (name === 'search_external_data') {
        const query = (args.query || '').toUpperCase();
        try {
            const data = await hinovaService.searchVehicle(query);
            if (!data) throw new Error("Não encontrado no SGA.");
            
            return (
                <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                    <div className="flex items-center gap-2 mb-2 text-emerald-500">
                        <Sparkles size={14}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Dados Recuperados (SGA)</span>
                    </div>
                    <div className="space-y-1 mb-4">
                        <p className="text-white font-bold text-sm">{data.vehicle.model}</p>
                        <p className="text-zinc-400 text-xs font-mono">{data.vehicle.plate} • {data.vehicle.chassis}</p>
                    </div>
                    <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                        <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Proprietário</p>
                        <p className="text-zinc-300 text-xs font-bold">{data.client.name}</p>
                        <p className="text-zinc-500 text-[10px] font-mono">{data.client.cpf}</p>
                    </div>
                    <div className="mt-3 text-[10px] text-zinc-500 italic text-center">
                        Para cadastrar, acesse a tela de "Veículos".
                    </div>
                </div>
            );
        } catch (e) {
            return <div className="text-red-400 font-mono text-xs">Erro na consulta externa: Veículo não localizado.</div>;
        }
      }

      // 4. RELATÓRIO
      if (name === 'generate_report_link') {
          return (
              <div className="flex flex-col gap-2">
                  <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <FileText className="text-primary-500" size={20}/>
                          <div>
                              <p className="text-xs font-bold text-white uppercase">Relatório de Atividades</p>
                              <p className="text-[10px] text-zinc-400">Últimos {args.days || 7} dias</p>
                          </div>
                      </div>
                      <button onClick={() => window.location.hash = '#/reports'} className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors">
                          Abrir Módulo
                      </button>
                  </div>
              </div>
          );
      }

      return <div className="text-zinc-500 text-xs">Comando executado sem retorno visual.</div>;

    } catch (e: any) {
      return <div className="text-red-500 text-xs font-bold bg-red-500/10 p-2 rounded">Erro de execução: {e.message}</div>;
    }
  };

  const handleConsoleSubmit = async (textOverride?: string) => {
    const command = (textOverride ?? input).trim();
    if (!command || loading) return;

    setLoading(true);
    setStatus('Processando comando...');
    setResultContent(null);
    setInput('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = ai.getGenerativeModel({ 
          model: 'gemini-2.5-flash-lite-latest', // Modelo rápido para comandos simples
          tools: tools 
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: command }] }]
      });

      const response = result.response;
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
          // Executa a primeira ferramenta encontrada
          const call = functionCalls[0];
          const visualResult = await executeTool(call.name, call.args);
          setResultContent(visualResult);
          setStatus('Execução Finalizada');
      } else {
          // Se não chamou ferramenta, mostra o texto, mas tenta ser breve
          const text = response.text();
          setResultContent(
              <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-mono whitespace-pre-wrap">
                  {text || "Comando não reconhecido. Tente 'localizar placa ABC1234' ou 'status frota'."}
              </div>
          );
          setStatus('Resposta do Sistema');
      }

    } catch (err) {
      setStatus('Erro de Conexão');
      setResultContent(<div className="text-red-500 text-xs font-mono">Falha na comunicação com o núcleo de IA.</div>);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-4 font-sans">
      <AnimatePresence>
        {isOpen && (
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-[90vw] sm:w-[380px] bg-black rounded-[24px] shadow-2xl border border-zinc-800 flex flex-col overflow-hidden"
          >
            {/* Header Terminal */}
            <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 px-1">
                <Terminal size={14} className="text-primary-500"/>
                <span className="font-mono font-bold text-[10px] text-zinc-400 uppercase tracking-widest">K-TAG Command Line</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-zinc-600 hover:text-white transition-colors"><X size={16} /></button>
            </div>

            {/* Display / Output */}
            <div className="p-5 bg-[#09090b] min-h-[180px] max-h-[350px] overflow-y-auto flex flex-col gap-4">
                {/* Status Line */}
                <div className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest border-b border-zinc-900 pb-2 flex justify-between">
                    <span>STATUS: {loading ? <span className="text-primary-500 animate-pulse">PROCESSANDO...</span> : <span className="text-zinc-400">{status}</span>}</span>
                    <span>{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
                
                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 size={24} className="animate-spin text-zinc-800"/>
                    </div>
                ) : resultContent ? (
                    <MotionDiv initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                        {resultContent}
                    </MotionDiv>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 opacity-30">
                        <Bot size={32} className="text-zinc-500"/>
                        <span className="text-[10px] font-black uppercase text-zinc-600">Aguardando Input</span>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-zinc-900 border-t border-zinc-800 space-y-3">
               {/* Quick Chips */}
               <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { label: 'Relatório', cmd: 'Gerar link para relatório dos últimos 7 dias', icon: Download },
                    { label: 'Status Frota', cmd: 'Quais as estatísticas da frota agora?', icon: Activity },
                    { label: 'Localizar', cmd: 'Localize o veículo placa ', icon: MapPin }
                  ].map((btn, i) => (
                    <button key={i} onClick={() => { 
                        if(btn.label === 'Localizar') setInput(btn.cmd); 
                        else handleConsoleSubmit(btn.cmd); 
                    }} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all shrink-0 border border-zinc-700/50">
                        <btn.icon size={10} /> {btn.label}
                    </button>
                  ))}
               </div>
               
               <form onSubmit={(e) => { e.preventDefault(); handleConsoleSubmit(); }} className="relative flex items-center">
                  <span className="absolute left-3 text-primary-500 font-mono text-xs">{'>'}</span>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite um comando..."
                    className="w-full pl-6 pr-10 py-3 bg-black border border-zinc-800 rounded-xl outline-none focus:border-primary-500/50 text-zinc-300 font-mono text-xs placeholder:text-zinc-700 transition-all"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="absolute right-2 p-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg disabled:opacity-0 transition-all"
                  >
                    <Send size={12} />
                  </button>
               </form>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl shadow-2xl transition-all duration-300 flex items-center justify-center border-2 relative ${
            isOpen 
            ? 'bg-zinc-900 border-zinc-800 text-zinc-500 rotate-90' 
            : 'bg-primary-500 border-primary-400 text-black hover:scale-110 active:scale-95'
        }`}
      >
        {isOpen ? <X size={20} /> : <Terminal size={24} />}
      </button>
    </div>
  );
};
