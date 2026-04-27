
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { X, Send, Sparkles, Bot, Loader2, Download, Activity, Terminal, MapPin, FileText, BarChart3, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../services/storage';
import { hinovaService } from '../services/hinova';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

const MotionDiv = motion.div as any;

interface ChatMessage {
    id: string;
    role: 'user' | 'model' | 'tool';
    content: React.ReactNode;
    rawText: string;
}

export const AiAssistant: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  
  const [status, setStatus] = useState<string>('Terminal Conectado');
  const [messages, setMessages] = useState<ChatMessage[]>([{
      id: 'init',
      role: 'model',
      rawText: 'Olá! Sou a **K-TAG AI**, sua assistente analítica de operações. Posso localizar veículos, checar a saúde da frota, alertar sobre atrasos e analisar gargalos técnicos do seu negócio. Como posso ajudar agora?',
      content: 'Olá! Sou a **K-TAG AI**, sua assistente analítica de operações. Posso localizar veículos, checar a saúde da frota, alertar sobre atrasos e analisar gargalos técnicos do seu negócio. Como posso ajudar agora?'
  }]);
  const [loading, setLoading] = useState(false);
  
  const hasAlertedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  /* ----------------------------- TOOLS DEFINITION ----------------------------- */
  const tools = useMemo(() => {
      return [{
        functionDeclarations: [
            {
                name: 'get_vehicle_location',
                description: 'Localiza um veículo pela placa informada, retornando a localização no mapa de tempo real, além do seu status geral de saúde e hardware.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: { plate: { type: 'STRING' as any, description: 'Placa do veículo' } },
                    required: ['plate']
                }
            },
            {
                name: 'get_fleet_stats',
                description: 'Lê as tabelas de Hardware (Tags) e Frotas registradas (Veículos), retornando quanto está vinculado na nuvem e o que está livre em prateleira de estoque.',
                parameters: { type: 'OBJECT' as any, properties: {} }
            },
            {
                name: 'search_external_data',
                description: 'Busca os dados crús da integração do integrador parceiro (SGA do cliente) como Chassi pelo Hinova.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: { query: { type: 'STRING' as any, description: 'Placa ou Chassi' } },
                    required: ['query']
                }
            },
            {
                name: 'analyze_operations',
                description: 'Ação crítica: Faz uma varredura cruzada no volume da frota, disponibilidade de estoque, fila pendente de Ordem de Serviços aguardando resposta humana e a quantidade atual de técnicos disponiveis. Use isso quando o gerente pedir um sumario analitico de status.',
                parameters: { type: 'OBJECT' as any, properties: {} }
            }
        ]
      }];
  }, []);

  /* ------------------------- EXECUTION LOGIC ----------------------- */
  const executeTool = async (name: string, args: any): Promise<{ visual: React.ReactNode, textual: string }> => {
    setStatus(`Executando Função Autônoma: ${name}...`);
    
    try {
      if (name === 'get_vehicle_location') {
        const vehicles = await storage.getVehicles();
        const cleanPlate = (args.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const v = vehicles.find(veh => veh.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
        
        if (!v) return {
            visual: <div className="text-amber-500 font-mono text-[10px] w-full">O veículo {cleanPlate} não existe no banco local de rastreamento.</div>,
            textual: `O veículo da placa solicitada (${cleanPlate}) não consta em nossa base unificada local de GPS.`
        };
        
        const resultLink = v.tagId ? `${window.location.origin}/#/map?tagId=${v.tagId}&autoStart=true` : null;
        
        return {
            textual: `Dados do veículo ${v.plate}: O modelo é um ${v.model}. Seu status sistêmico atual é ${v.status}. Encontrei o link para a grade de localização da API associando com a tag que enviou o GPS. O que você gostaria de ordenar em relação a isso?`,
            visual: (
                <div className="bg-zinc-800/80 p-3 rounded-xl border border-zinc-700 w-full mb-1">
                    <div className="flex items-center gap-2 mb-2 text-primary-500">
                        <MapPin size={14}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Base de GPS Recuperada</span>
                    </div>
                    <div className="flex justify-between items-start mb-2 mt-2">
                        <div>
                            <h4 className="text-white font-black text-sm tracking-tight">{v.plate}</h4>
                            <p className="text-zinc-400 text-[10px] font-bold uppercase">{v.model}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${v.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>{v.status === 'active' ? 'Ativo' : 'Offline'}</span>
                    </div>
                    {resultLink ? (
                        <a href={resultLink} target="_blank" rel="noreferrer" className="w-full py-2 bg-primary-500 hover:bg-primary-400 text-black text-center rounded-lg font-black text-[9px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                             Abrir Grid Geográfico Ao Vivo
                        </a>
                    ) : (
                        <div className="p-2 bg-zinc-900 rounded-lg text-center text-zinc-500 text-[9px] font-bold uppercase border border-zinc-800">Sem comunicação GPS</div>
                    )}
                </div>
            )
        };
      }

      if (name === 'get_fleet_stats') {
        const [tags, vehs] = await Promise.all([storage.getTags(), storage.getVehicles()]);
        const linkedCount = vehs.filter(v => v.tagId).length;
        const stockCount = tags.length - linkedCount;
        
        return {
            textual: `Contagem atualizada em nuvem - Possuímos ${vehs.length} veículos com rastreador, num momento em que existem ${stockCount} rastreadores físicos na gaveta sem uso. O número parece correto comparado ao total da empresa?`,
            visual: (
                <div className="grid grid-cols-2 gap-2 w-full mb-1">
                    <div className="bg-zinc-800/80 p-2 rounded-xl border border-zinc-700 text-center">
                        <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Frota Ativa</p>
                        <p className="text-xl font-black text-white">{vehs.length}</p>
                    </div>
                    <div className="bg-zinc-800/80 p-2 rounded-xl border border-primary-500 text-center">
                        <p className="text-[8px] text-primary-500 font-black uppercase tracking-widest">Estoque Ocioso</p>
                        <p className="text-xl font-black text-primary-500">{stockCount}</p>
                    </div>
                </div>
            )
        };
      }

      if (name === 'search_external_data') {
        const query = (args.query || '').toUpperCase();
        const data = await hinovaService.searchVehicle(query).catch(() => null);
        if (!data) return {
            textual: "Fui à API parceira do sistema legado (Hinova/SGA) e recebi falha. Este carro ou chassi realmente não existe por lá.",
            visual: <div className="text-red-400 font-mono text-[10px] w-full">Vínculo SGA quebrado ou desativado remotamente.</div>
        };
        
        return {
            textual: `Extração Completa: Este veículo do SGA é referenciado ao cliente proprietário '${data.client.name}' e porta as especificações '${data.vehicle.model}'.`,
            visual: (
                <div className="bg-zinc-800/80 p-3 rounded-xl border border-zinc-700 w-full mb-1">
                    <div className="flex items-center gap-2 mb-2 text-emerald-500">
                        <Sparkles size={12}/>
                        <span className="text-[9px] font-black uppercase tracking-widest">SGA - Sincronizado Sucesso</span>
                    </div>
                    <p className="text-white font-bold text-xs">{data.vehicle.model}</p>
                    <p className="text-zinc-400 text-[10px] font-mono mb-2">{data.vehicle.plate} • {data.vehicle.chassis}</p>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 mt-2">
                        <p className="text-zinc-300 text-[10px] font-bold">{data.client.name}</p>
                    </div>
                </div>
            )
        };
      }

      if (name === 'analyze_operations') {
        const [vehs, tags, scheds, techs] = await Promise.all([
             storage.getVehicles(), storage.getTags(), storage.getSchedules('admin', ''), storage.getTechnicians()
        ]);
        
        const pendingSchedules = scheds.filter(s => s.status === 'Solicitada' || s.status === 'Em análise' || s.status === 'Reagendada');
        const activeTechs = techs.filter(t => t.active);
        
        const payload = JSON.stringify({
            data_warehouse: {
                veiculos_sincronizados: vehs.length,
                hardware_parado_estoque: tags.length,
                tecnicos_atendendo_rua: activeTechs.length,
                demandas_os_pendentes: pendingSchedules.length
            }
        });

        return {
            textual: `O JSON Bruto extraído para Análise Macro é: ${payload}. Analise e explique de forma amigável e relatoria estes 4 eixos!`,
            visual: (
                <div className="bg-[#121214] border border-zinc-800 p-3 rounded-xl w-full mb-1">
                    <div className="flex items-center gap-2 text-primary-500 mb-2">
                        <BarChart3 size={14}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Data Extraída (Backoffice Integrado)</span>
                    </div>
                    <p className="text-zinc-500 text-[10px] font-mono leading-tight">Analítica processada através das chaves de banco cruzadas de forma distribuída.</p>
                </div>
            )
        };
      }

      return { textual: "Sem dados para esta operação especial.", visual: <></> };
    } catch (e: any) {
      return { textual: `Um erro fatal derrubou a ferramenta: ${e.message}`, visual: <div className="text-red-500 text-xs w-full mt-1 bg-red-900/10 p-2 rounded">API Crashing: {e.message}</div> };
    }
  };

  const SYSTEM_INSTRUCTION = `Você é a "K-TAG AI", uma Inteligência Artificial analítica, proativa e avançada, embutida num sistema Premium de Gestão de Frotas de Veículos (Locadoras) e Despacho de Técnicos em Rastreio. O ambiente do usuário é escuro (Dark Mode).

DIRETRIZES DE PERSONA:
1. Responda num tom de Engenheiro Operacional de Logística. Profissional, direto, seguro, cortês mas que detém inteligência real do negócio. 
2. Use parágrafos muito curtos, formatação moderna com marcações **Negrito** nos números e dados-chave.
3. Não use jargões de código ou diga "chamei um JSON". Diga "Concluí uma varredura massiva em milisegundos...".
4. Sua principal ferramenta seleta é o "analyze_operations", que lê os Agendamentos em Aberto contra a frota de Técnicos Ativos, retornando o cenário geral. 
5. Quando requisitada essa análise cruzada, crie um relatório curto listando se a "fila de Os's vs Técnicos" está crítica (mais fila do que equipe) e mande uma recomendação de Gestão.
6. Ao buscar placas em SGA ou Mapa em Tempo Real, forneça de cara o contexto geral sobre a disponibilidade. Diga do que a plataforma que você controla é capaz se lhe questionar (Relatórios integrados, análise de telemetria, controle do estoque em prateleira x rua). Em hipótese nenhuma cometa erros no markdown.`;

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

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const formattedHistory: any[] = messages.filter(m => m.role !== 'tool').map(m => ({
          role: m.role,
          parts: [{ text: m.rawText }]
      })).slice(-10); // Mantém o contexto curto, últimas 10 msgs para n quebrar limite do token
      
      formattedHistory.push({ role: 'user', parts: [{ text: userMessage }] });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: formattedHistory,
        config: {
            tools: tools as any,
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.2 // Resposta Focada e Analitica
        }
      });

      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
          setStatus('Executando Middleware do Servidor...');
          const call = functionCalls[0];
          
          if (call.name) {
            const { visual, textual } = await executeTool(call.name, call.args);
            
            // Adiciona a Interface (Card da Ferramenta)
            setMessages(prev => [...prev, {
                id: Date.now().toString() + '_tool',
                role: 'tool',
                rawText: `[Tool Return]: ${textual}`,
                content: visual
            }]);

            // Segundo Turno (A AI recebe a saída dela mesma)
            setStatus('Analisando Deep Data Resultante...');
            
            formattedHistory.push({ role: 'model', parts: [{ functionCall: call }] });
            formattedHistory.push({ role: 'function', parts: [{ functionResponse: { name: call.name, response: { result: textual }}}]});
            
            const secondResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: formattedHistory,
                config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
            });
            
            setMessages(prev => [...prev, {
                id: Date.now().toString() + '_final',
                role: 'model',
                rawText: secondResponse.text || '',
                content: secondResponse.text || "Operação Realizada."
            }]);
          }
      } else {
          setMessages(prev => [...prev, {
              id: Date.now().toString() + '_reply',
              role: 'model',
              rawText: response.text || '',
              content: response.text || "Sem reposta disponível no meu banco central."
          }]);
      }

      setStatus('AI Link Ativo');
    } catch (err) {
      console.error(err);
      setStatus('Sinal da Conexão Rompido');
      setMessages(prev => [...prev, {
          id: Date.now().toString() + '_err',
          role: 'model',
          rawText: 'Falha.',
          content: <div className="text-red-500 font-mono text-[10px]">Exceção Crítica I/O: Timeout alcançado. Seu Kernel de Chaves de IA pode ter recusado processar devido a limites do servidor da Google.</div>
      }]);
    } finally {
      setLoading(false);
    }
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
                <Sparkles size={14} className="text-primary-500"/>
                <span className="font-mono font-bold text-[11px] text-white tracking-widest shadow-sm">K-TAG AI ADMIN</span>
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
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[95%] text-sm rounded-[18px] ${
                            msg.role === 'user' 
                                ? 'bg-primary-500 text-black px-4 py-2.5 rounded-tr-sm shadow-md' 
                                : msg.role === 'tool'
                                  ? 'w-full !max-w-full p-0 bg-transparent' // Remove o padding para que as visualizacoes quebrem todo o espaco horizontal
                                  : 'bg-zinc-800 text-zinc-300 px-4 py-3 border border-zinc-700/50 rounded-tl-sm shadow-lg'
                        }`}>
                            {msg.role === 'user' ? (
                                <p className="text-[13px] font-semibold leading-snug">{msg.rawText}</p>
                            ) : msg.role === 'tool' ? (
                                msg.content
                            ) : (
                                <div className="text-[12px] font-medium leading-relaxed markdown-override space-y-3">
                                    {typeof msg.content === 'string' ? (
                                        <ReactMarkdown 
                                            components={{
                                                strong: ({node, ...props}) => <span className="font-black text-white" {...props}/>,
                                                p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props}/>,
                                                ul: ({node, ...props}) => <ul className="list-disc pl-4 my-1 space-y-1.5 text-zinc-400" {...props}/>,
                                                li: ({node, ...props}) => <li {...props}/>,
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    ) : msg.content}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                {loading && (
                    <div className="flex items-start">
                        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                             <Loader2 size={12} className="animate-spin text-primary-500"/>
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
                    <button key={i} onClick={() => { 
                        handleConsoleSubmit(btn.cmd); 
                    }} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all shrink-0 border border-zinc-700/50 shadow-sm">
                        <btn.icon size={10} /> {btn.label}
                    </button>
                  ))}
               </div>
               
               <form onSubmit={(e) => { e.preventDefault(); handleConsoleSubmit(); }} className="relative flex items-center group">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Questione o seu assistente de gestão..."
                    className="w-full pl-4 pr-12 py-3.5 bg-[#09090b] border border-zinc-800 rounded-xl outline-none focus:border-primary-500/50 focus:bg-zinc-900/50 text-zinc-100 text-[13px] placeholder:text-zinc-600 transition-all font-medium shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="absolute right-1.5 p-2 bg-primary-500 text-black hover:bg-primary-400 rounded-lg disabled:opacity-50 transition-all shadow-md group-focus-within:opacity-100 opacity-60"
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
            : 'bg-primary-500 text-black hover:scale-105 shadow-[0_0_20px_rgba(245,158,11,0.2)] active:scale-95'
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

