
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { X, Send, Sparkles, Bot, BarChart3, MapPin, AlertTriangle, Tag as TagIcon, HelpCircle, CheckCircle2, Loader2, ClipboardCheck, ArrowRight, Plus, FileText, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../services/storage';
import { hinovaService } from '../services/hinova';
import { Vehicle } from '../types';
import { useAuth } from '../contexts/AuthContext';

const MotionDiv = motion.div as any;

const sanitizeHTML = (dirtyHtml: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${dirtyHtml}</div>`, 'text/html');
  const ALLOWED_TAGS = new Set(['B', 'BR', 'A', 'DIV', 'SPAN', 'UL', 'LI', 'STRONG', 'P']);
  const ALLOWED_ATTRS: Record<string, Set<string>> = {
    A: new Set(['href', 'target', 'rel', 'class']),
    DIV: new Set(['class']),
    SPAN: new Set(['class']),
    B: new Set(['class']),
    STRONG: new Set(['class']),
  };

  function walk(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (!ALLOWED_TAGS.has(el.tagName)) {
        const text = document.createTextNode(el.textContent || '');
        el.parentNode?.replaceChild(text, el);
        return;
      }
      const allowed = ALLOWED_ATTRS[el.tagName] ?? new Set<string>();
      Array.from(el.attributes).forEach(attr => {
        if (!allowed.has(attr.name)) {
          el.removeAttribute(attr.name);
        } else if (el.tagName === 'A' && attr.name === 'href') {
          const href = el.getAttribute('href') || '';
          if (!href.startsWith('http') && !href.startsWith('/') && !href.startsWith('#')) {
            el.removeAttribute('href');
          } else {
            el.setAttribute('rel', 'noopener noreferrer');
            if (!el.getAttribute('target')) el.setAttribute('target', '_blank');
          }
        }
      });
    }
    node.childNodes.forEach(walk);
  }

  const root = doc.body;
  walk(root);
  const wrapper = root.querySelector('div');
  return wrapper ? wrapper.innerHTML : '';
};

/* ----------------------------- Types ----------------------------- */
interface Message {
  role: 'user' | 'model';
  text: string;
}

export const AiAssistant: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Olá! Sou seu **Coordenador K-TAG Intelligence**. Posso analisar sua frota, localizar veículos e até **gerar relatórios PDF** profissionais. Como posso agilizar sua operação hoje?' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  /* ----------------------------- Tool Declarations ----------------------------- */
  
  const getVehicleLocationTool: FunctionDeclaration = useMemo(() => ({
    name: 'get_vehicle_location',
    description: 'Localiza um veículo pela placa e retorna status e link de rastreio.',
    parameters: {
      type: Type.OBJECT,
      properties: { plate: { type: Type.STRING, description: 'Placa do veículo' } },
      required: ['plate']
    }
  }), []);

  const getFleetStatsTool: FunctionDeclaration = useMemo(() => ({
    name: 'get_fleet_stats',
    description: 'Resumo estatístico da frota, estoque de tags e regionais.',
    parameters: { type: Type.OBJECT, properties: {} }
  }), []);

  const prepareRegistrationDraftTool: FunctionDeclaration = useMemo(() => ({
    name: 'prepare_registration_draft',
    description: 'Consulta a Hinova e o estoque para preparar um cadastro semi-automático.',
    parameters: {
      type: Type.OBJECT,
      properties: { plate: { type: Type.STRING, description: 'Placa para consulta' } },
      required: ['plate']
    }
  }), []);

  const generateReportTool: FunctionDeclaration = useMemo(() => ({
    name: 'generate_pdf_report',
    description: 'Gera um arquivo PDF analítico com cards e tabelas de veículos.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        startDate: { type: Type.STRING, description: 'Data inicial YYYY-MM-DD. OBRIGATÓRIO SE DEFINIDO PELO USUÁRIO.' },
        endDate: { type: Type.STRING, description: 'Data final YYYY-MM-DD. OBRIGATÓRIO SE DEFINIDO PELO USUÁRIO.' }
      }
    }
  }), []);

  const commitRegistrationTool: FunctionDeclaration = useMemo(() => ({
    name: 'commit_registration',
    description: 'Finaliza a gravação do veículo no sistema.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        plate: { type: Type.STRING },
        model: { type: Type.STRING },
        year: { type: Type.STRING },
        type: { type: Type.STRING },
        tagId: { type: Type.STRING },
        companyId: { type: Type.STRING },
        clientId: { type: Type.STRING }
      },
      required: ['plate', 'model', 'tagId', 'companyId', 'type']
    }
  }), []);

  /* ------------------------- Implementation Logic ----------------------- */

  const handleToolExecution = async (call: any): Promise<any> => {
    const { name, args } = call;
    
    try {
      if (name === 'get_vehicle_location') {
        const vehicles = await storage.getVehicles();
        const cleanPlate = (args.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const v = vehicles.find(veh => veh.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
        if (!v) return { error: 'Veículo não localizado na base ativa.' };
        return { 
            vehicle: { plate: v.plate, model: v.model, status: v.status }, 
            mapLink: v.tagId ? `${window.location.origin}/#/map?tagId=${v.tagId}&autoStart=true` : null
        };
      }

      if (name === 'get_fleet_stats') {
        const [tags, vehs, comps, cats] = await Promise.all([
          storage.getTags(), storage.getVehicles(), storage.getCompanies(), storage.getCategories()
        ]);
        const linkedIds = new Set(vehs.map(v => v.tagId));
        return {
          stock: { total: tags.length, free: tags.filter(t => !linkedIds.has(t.id)).length },
          vehicles: { total: vehs.length, stolen: vehs.filter(v => v.status === 'stolen').length },
          companies: comps.map(c => ({ label: c.name, count: vehs.filter(v => v.companyId === c.id).length })),
          categories: cats.map(cat => ({ label: cat.name, count: vehs.filter(v => v.type === cat.id).length }))
        };
      }

      if (name === 'prepare_registration_draft') {
        const plate = (args.plate || '').toUpperCase();
        const [hinovaData, allTags, allVehs, companies, clients, categories] = await Promise.all([
          hinovaService.searchVehicle(plate).catch(() => null),
          storage.getTags(),
          storage.getVehicles(),
          storage.getCompanies(),
          storage.getClients(),
          storage.getCategories()
        ]);
        const linkedTagIds = new Set(allVehs.map(v => v.tagId));
        const freeTags = allTags.filter(t => !linkedTagIds.has(t.id)).slice(0, 5);
        return {
          hinova: hinovaData,
          tags: freeTags.map(t => ({ id: t.id, label: `${t.name} (SN: ${t.accessoryId})` })),
          companies: companies.map(c => ({ id: c.id, label: c.name })),
          categories: categories.map(c => ({ id: c.id, label: c.name })),
          clientExists: hinovaData ? clients.some(c => c.cpf === hinovaData.client.cpf) : false
        };
      }

      if (name === 'generate_pdf_report') {
        // Lógica de Datas CRÍTICA: Pega do Hoje Real se não informado
        const now = new Date();
        const start = args.startDate ? new Date(args.startDate + 'T00:00:00').getTime() : now.getTime() - (7 * 24 * 60 * 60 * 1000);
        const end = args.endDate ? new Date(args.endDate + 'T23:59:59').getTime() : now.getTime();
        
        const [vehs, cats] = await Promise.all([storage.getVehicles(), storage.getCategories()]);
        const filtered = vehs.filter(v => v.createdAt && v.createdAt >= start && v.createdAt <= end);
        
        if (filtered.length === 0) return { error: 'Nenhum veículo encontrado para o período solicitado.' };

        const { jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        const doc = new jsPDF();
        const total = filtered.length;
        const soTag = filtered.filter(v => v.installationType !== 'tag_tracker').length;
        const tagTracker = total - soTag;

        // --- DESIGN CONFORME IMAGEM DE REFERÊNCIA ---
        
        // 1. HEADER
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.setTextColor(24, 24, 27);
        doc.text("K-TAG INSIGHT REPORT", 14, 22);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(113, 113, 122);
        doc.text(`Período: ${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`, 14, 30);
        doc.text(`Gerado por: ${currentUser?.name || 'IA Assistant'} (System) em ${new Date().toLocaleString()}`, 14, 36);

        // 2. DASHBOARD CARDS
        // Total (Dark)
        doc.setFillColor(24, 24, 27);
        doc.roundedRect(14, 45, 58, 30, 4, 4, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text("TOTAL ATIVAÇÕES", 19, 53);
        doc.setFontSize(18);
        doc.text(total.toString(), 19, 68);

        // Só Tag (Orange)
        doc.setFillColor(245, 158, 11);
        doc.roundedRect(76, 45, 58, 30, 4, 4, "F");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.text("SÓ TAG", 81, 53);
        doc.setFontSize(18);
        const soTagPerc = total > 0 ? ((soTag / total) * 100).toFixed(1) : "0";
        doc.text(`${soTag} (${soTagPerc}%)`, 81, 68);

        // Tag + Tracker (Grey)
        doc.setFillColor(244, 244, 245);
        doc.roundedRect(138, 45, 58, 30, 4, 4, "F");
        doc.setTextColor(24, 24, 27);
        doc.setFontSize(8);
        doc.text("TAG + RASTREADOR", 143, 53);
        doc.setFontSize(18);
        const tagTrackerPerc = total > 0 ? ((tagTracker / total) * 100).toFixed(1) : "0";
        doc.text(`${tagTracker} (${tagTrackerPerc}%)`, 143, 68);

        // 3. DISTRIBUIÇÃO POR CATEGORIA
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(24, 24, 27);
        doc.text("Distribuição por Categoria", 14, 88);

        const counts: Record<string, number> = {};
        filtered.forEach(v => {
            const name = cats.find(c => c.id === v.type)?.name || 'Outro';
            counts[name] = (counts[name] || 0) + 1;
        });

        const categorySummary = Object.keys(counts).map(name => [
            name, 
            counts[name], 
            total > 0 ? `${((counts[name] / total) * 100).toFixed(1)}%` : '0%'
        ]);

        autoTable(doc, {
            startY: 93,
            head: [['Categoria', 'Quantidade', 'Representatividade (%)']],
            body: categorySummary,
            theme: 'striped',
            headStyles: { fillColor: [63, 63, 70], textColor: [255, 255, 255] }
        });

        // 4. LISTAGEM DETALHADA
        doc.setFontSize(14);
        doc.text("Listagem Detalhada de Veículos", 14, (doc as any).lastAutoTable.finalY + 15);

        const tableBody = filtered.map(v => [
          new Date(v.createdAt!).toLocaleDateString(),
          v.plate,
          v.model,
          cats.find(c => c.id === v.type)?.name || 'Outro',
          v.installationType === 'tag_tracker' ? 'Tag + Tracker' : 'Só Tag'
        ]);

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [['Data', 'Placa', 'Modelo', 'Categoria', 'Equipamento']],
          body: tableBody,
          theme: 'striped',
          headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0] },
          styles: { fontSize: 8 }
        });

        const fileName = `insight_report_${new Date().getTime()}.pdf`;
        doc.save(fileName);
        return { success: true, count: filtered.length, period: `${new Date(start).toLocaleDateString()} a ${new Date(end).toLocaleDateString()}` };
      }

      if (name === 'commit_registration') {
        const newVehicle: Vehicle = {
            id: crypto.randomUUID(),
            plate: args.plate.toUpperCase(),
            model: args.model,
            year: args.year,
            type: args.type,
            tagId: args.tagId,
            companyId: args.companyId,
            clientId: args.clientId,
            createdAt: Date.now(),
            status: 'active'
        };
        await storage.saveVehicle(newVehicle);
        return { success: true, plate: newVehicle.plate };
      }

    } catch (e: any) {
      return { error: e.message };
    }
  };

  const handleSend = async (textOverride?: string) => {
    const userMsg = (textOverride ?? input).trim();
    if (!userMsg || loading) return;

    const todayDate = new Date().toISOString().split('T')[0];

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
            tools: [{ functionDeclarations: [getVehicleLocationTool, getFleetStatsTool, prepareRegistrationDraftTool, generateReportTool, commitRegistrationTool] }],
            systemInstruction: `Você é o **Operador K-TAG Intelligence**, focado em automação e segurança.
            
            DATA ATUAL: Hoje é ${todayDate}. Use esta data como referência absoluta para calcular "ontem", "esta semana" ou "mês passado".
            
            DIRETRIZES DE RELATÓRIO:
            - Ao pedirem um relatório/PDF, use 'generate_pdf_report'. 
            - Se o usuário não disser o período, NÃO peça a ele; assuma automaticamente os últimos 7 dias a partir de hoje (${todayDate}).
            - Confirme para o usuário: "Estou preparando seu Insight Report referente ao período de [X] a [Y]..."
            
            DIRETRIZES DE SEGURANÇA:
            - NUNCA exponha IDs técnicos (como cat-car) ou código-fonte.
            - Seja proativo: se o estoque estiver baixo (<10), avise no final da resposta.`
        }
      });

      let currentResponse = response;
      
      while (currentResponse.functionCalls && currentResponse.functionCalls.length > 0) {
        const toolResponses = await Promise.all(
          currentResponse.functionCalls.map(async (call) => {
            const result = await handleToolExecution(call);
            return {
              functionResponse: { id: call.id, name: call.name, response: { result } }
            };
          })
        );

        currentResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            { role: 'user', parts: [{ text: userMsg }] },
            currentResponse.candidates[0].content,
            { role: 'function', parts: toolResponses }
          ],
          config: {
             tools: [{ functionDeclarations: [getVehicleLocationTool, getFleetStatsTool, prepareRegistrationDraftTool, generateReportTool, commitRegistrationTool] }]
          }
        });
      }

      setMessages(prev => [...prev, { role: 'model', text: currentResponse.text || 'Operação concluída.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: 'Ops, tive um problema na rede. Pode tentar de novo?' }]);
    } finally {
      setLoading(false);
    }
  };

  const formatMessage = (text: string) => {
    if (!text) return '';
    let clean = text.replace(/```.*?```/gs, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    clean = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-500 font-bold hover:underline">$1</a>');
    clean = clean.replace(/\n/g, '<br />');
    return clean;
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-4 font-sans">
      <AnimatePresence>
        {isOpen && (
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="w-[95vw] sm:w-[500px] h-[720px] bg-white dark:bg-zinc-900 rounded-[40px] shadow-[0_25px_100px_rgba(0,0,0,0.4)] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-500 rounded-[18px] flex items-center justify-center text-black shadow-lg shadow-primary-500/30">
                    <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="font-display font-black text-sm uppercase tracking-widest leading-none">Intelligence AI</h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Operação Assistida</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2.5 hover:bg-white/10 rounded-2xl transition-all"><X size={20} /></button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-zinc-50/20 dark:bg-black/20 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-6 py-4 rounded-[30px] text-[13px] leading-relaxed shadow-sm border ${
                        msg.role === 'user' 
                        ? 'bg-zinc-900 text-white border-zinc-800 rounded-tr-none' 
                        : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 rounded-tl-none'
                    }`}>
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(formatMessage(msg.text)) }} />
                    </div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] px-3">{msg.role === 'user' ? 'Operador' : 'K-TAG Intelligence'}</span>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start items-center gap-3">
                   <div className="px-6 py-4 bg-white dark:bg-zinc-800 rounded-[30px] rounded-tl-none border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-3">
                      <Loader2 size={16} className="animate-spin text-primary-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Acessando Banco de Dados...</span>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input & Quick Actions */}
            <div className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
               <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                  {[
                    { label: '📊 Insight Report', prompt: 'Gere um relatório analítico PDF de hoje.', icon: Download },
                    { label: '🚗 Novo Cadastro', prompt: 'Preciso cadastrar a placa: ', icon: Plus },
                    { label: '📦 Estoque Tags', prompt: 'Quantas tags livres temos em estoque agora?', icon: TagIcon }
                  ].map((btn, i) => (
                    <button key={i} onClick={() => setInput(btn.prompt)} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-primary-500 hover:text-black rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <btn.icon size={14} /> {btn.label}
                    </button>
                  ))}
               </div>
               
               <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ex: 'Gere o relatório de ontem'..."
                    className="w-full pl-6 pr-16 py-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all font-bold text-sm"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="absolute right-2 top-2 bottom-2 px-4 bg-zinc-900 dark:bg-primary-500 text-white dark:text-black rounded-[20px] hover:scale-105 active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center"
                  >
                    <Send size={20} />
                  </button>
               </form>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-20 h-20 rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500 flex items-center justify-center border-[6px] relative ${
            isOpen 
            ? 'bg-zinc-950 border-zinc-900 text-white rotate-90 scale-90' 
            : 'bg-primary-500 border-primary-400 text-black hover:scale-110 active:scale-90'
        }`}
      >
        {isOpen ? <X size={32} /> : <Sparkles size={32} />}
        {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-6 w-6">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-6 w-6 bg-primary-600 border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-xl">!</span>
            </span>
        )}
      </button>
    </div>
  );
};

export default AiAssistant;
