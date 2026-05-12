import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { storage } from '../../services/storage';
import { useAiTools } from './useAiTools';
import { ChatMessage } from './types';

const SYSTEM_INSTRUCTION = `Você é a "K-TAG AI", uma Inteligência Artificial analítica, proativa e de alto nível executivo, embutida no sistema corporativo K-TAG Manager (Gestão de Frotas, Telemetria e Despacho de Técnicos).

O seu objetivo é atuar como um COO (Chief Operating Officer) digital ou Engenheiro de Logística Sênior, não apenas um robô que repete dados.
Quando buscar dados operativos, você JAMAIS deve apenas listá-los. Você deve ANALISAR as correlações, avaliar a saúde geral, identificar GARGALOS, oferecer INSIGHTS TÁTICOS (o que fazer de imediato) e ESTRATÉGICOS (visões de negócio).

DIRETRIZES TÉCNICO-COMPORTAMENTAIS:
1. TOM: Executivo, profundo, astuto, focado em alta performance, redução de ociosidade, lucro e cumprimento de SLA. Use cordialidade institucional.
2. ESTRUTURA: Entregue respostas ricas e estruturadas. Use Bullet Points para métricas cruzadas, destaque KPIs em **negrito**.
3. IMERSÃO TOTAL: Você É o cérebro da plataforma. Nunca diga "o back-end me informou", "recebi um JSON" ou "minha ferramenta retornou". Diga: "Ao investigar nossos grids logísticos...", "Cruzei a base de telemetria...", "Identifiquei em nossos clusters operacionais...".
4. SENSO CRÍTICO: 
    - Se a fila de OS (Ordens de Serviço) sobrecarregar a capacidade de técnicos ativos: dispare um ALERTA de ruptura iminente de SLA.
    - Se houver muito rastreador ocioso no estoque: alerte para dinheiro parado, recomende acelerar instalações.
    - Ao buscar placa de veículo: além de relatar o status, faça inferências (ex: "Sendo um carro offline, recomendo vistoria presencial urgente").
5. VARIABILIDADE: Fuja de respostas engessadas ou repetititvas. Mude a abordagem, não repita os mesmos bordões e proponha ações assertivas exclusivas para cada contexto lido. Ao fim de um relatório denso, faça perguntas direcionadas (ex: "Deseja que eu comande o disparo de alertas aos técnicos disponíveis?").
6. Seja direto. Nunca comece textos com "Claro, analisarei", vá direto aos fatos.`;

export const useAiLogic = ({
    messages,
    setMessages,
    setStatus,
    setLoading
}: {
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    setStatus: (s: string) => void;
    setLoading: (l: boolean) => void;
}) => {
    const { toolsInfo, openAiTools, anthropicTools, executeTool } = useAiTools();

    const processMessage = async (userMessage: string) => {
        try {
            const settings = await storage.getSettings();
            
            // Basic Provider selection handling
            const provider = settings.aiProvider || 'gemini';
            
            let keyToUse = '';
            if (provider === 'gemini') keyToUse = settings.geminiApiKey?.trim() || process.env.GEMINI_API_KEY || '';
            else if (provider === 'openai') keyToUse = settings.openAiApiKey?.trim() || '';
            else if (provider === 'anthropic') keyToUse = settings.anthropicApiKey?.trim() || '';
            else if (provider === 'groq') keyToUse = settings.groqApiKey?.trim() || '';
            else if (provider === 'deepseek') keyToUse = settings.deepseekApiKey?.trim() || '';
            
            if (!keyToUse) {
                if (provider === 'gemini') {
                    throw new Error("Nenhuma Chave de API Google configurada ou a padrão estourou a cota. Acesse as Configurações de API e insira sua API Key do Gemini.");
                } else {
                    throw new Error(`Nenhuma Chave de API configurada para o provedor ${String(provider).toUpperCase()}. Acesse as Configurações de API e insira a chave correta.`);
                }
            }

            // At the moment, we only execute tool calling properly through GoogleGenAI SDK in this environment
            // If the user selected another provider, we could implement standard fetch logic here, but for now we throw if they want full tool calling without Gemini SDK adapted
            // We will do a generic fetch for OpenAI just for basic chat if they choose it, since tools are complex.
            
            if (provider === 'openai') {
                await handleOpenAICompatible(keyToUse, userMessage, messages, setMessages, setStatus, 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', openAiTools, executeTool, settings.customProxyUrl);
                return;
            } else if (provider === 'groq') {
                await handleOpenAICompatible(keyToUse, userMessage, messages, setMessages, setStatus, 'https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile', openAiTools, executeTool, settings.customProxyUrl);
                return;
            } else if (provider === 'deepseek') {
                await handleOpenAICompatible(keyToUse, userMessage, messages, setMessages, setStatus, 'https://api.deepseek.com/chat/completions', 'deepseek-chat', openAiTools, executeTool, settings.customProxyUrl);
                return;
            } else if (provider === 'anthropic') {
                await handleAnthropicRequest(keyToUse, userMessage, messages, setMessages, setStatus, anthropicTools, executeTool, settings.customProxyUrl);
                return;
            } else if (provider !== 'gemini') {
                throw new Error(`O provedor ${String(provider).toUpperCase()} foi selecionado mas seu SDK ainda não foi totalmente mapeado neste ambiente. Use Gemini ou OpenAI.`);
            }

            // GEMINI FLOW
            const ai = new GoogleGenAI({ apiKey: keyToUse });
            
            const formattedHistory: any[] = messages.filter(m => m.role !== 'tool').map(m => ({
                role: m.role,
                parts: [{ text: m.rawText }]
            })).slice(-10);
            
            formattedHistory.push({ role: 'user', parts: [{ text: userMessage }] });

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: formattedHistory,
              config: {
                  tools: toolsInfo as any,
                  systemInstruction: SYSTEM_INSTRUCTION,
                  temperature: 0.5
              }
            });

            const functionCalls = response.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
                setStatus('Executando Middleware do Servidor...');
                const call = functionCalls[0];
                
                if (call.name) {
                  const { visual, textual } = await executeTool(call.name, call.args);
                  
                  setMessages(prev => [...prev, {
                      id: Date.now().toString() + '_tool',
                      role: 'tool',
                      rawText: `[Tool Return]: ${textual}`,
                      content: visual
                  }]);

                  setStatus('Analisando Deep Data Resultante...');
                  
                  formattedHistory.push({ role: 'model', parts: [{ functionCall: call }] });
                  formattedHistory.push({ role: 'function', parts: [{ functionResponse: { name: call.name, response: { result: textual }}}]});
                  
                  const secondResponse = await ai.models.generateContent({
                      model: 'gemini-2.5-flash',
                      contents: formattedHistory,
                      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.6 }
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
            console.error('AI Processing Error:', err);
            setStatus('Sinal da Conexão Rompido');
            handleErrorMessage(err, setMessages);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAICompatible = async (apiKey: string, userMessage: string, msgHistory: ChatMessage[], appendMsg: any, setStat: any, endpoint: string, model: string, tools: any, executeTool: any, proxyUrl?: string) => {
        setStat(`Conectando ao provedor...`);
        const apiMessages: any[] = msgHistory.filter(m => m.role !== 'tool').slice(-10).map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.rawText
        }));
        
        apiMessages.unshift({ role: 'system', content: SYSTEM_INSTRUCTION });
        apiMessages.push({ role: 'user', content: userMessage });
        
        const fetchPayload = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: apiMessages,
                temperature: 0.5,
                tools: tools,
                tool_choice: "auto"
            })
        };

        let res;
        
        try {
            if (proxyUrl || model.includes('llama') || model.includes('deepseek')) {
                // Force proxy for groq/deepseek that block browser CORS completely or if proxy URL explicitly provided
                const proxyBody = JSON.stringify({
                   url: endpoint,
                   method: 'POST',
                   headers: fetchPayload.headers,
                   body: JSON.parse(fetchPayload.body)
                });
                
                let usingProxy = proxyUrl || '/api/proxy';
                try {
                    res = await fetch(usingProxy, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: proxyBody
                    });
                } catch (e) {
                    if (usingProxy !== '/api/proxy') {
                        res = await fetch('/api/proxy', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: proxyBody
                        });
                    } else {
                        throw e;
                    }
                }
            } else {
                res = await fetch(endpoint, fetchPayload);
            }
        } catch (e: any) {
            throw new Error(`Failed to fetch API via Proxy/Direct (${e.message})`);
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(`API Error: ${errorData.error?.message || res.statusText}`);
        }

        const data = await res.json();
        const responseMessage = data.choices[0]?.message;

        if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
            setStat('Executando Middleware do Servidor...');
            const toolCall = responseMessage.tool_calls[0];
            const name = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments || '{}');
            
            const { visual, textual } = await executeTool(name, args);
            
            appendMsg((prev: any) => [...prev, {
                id: Date.now().toString() + '_tool',
                role: 'tool',
                rawText: `[Tool Return]: ${textual}`,
                content: visual
            }]);
            
            setStat('Analisando Deep Data Resultante...');
            
            apiMessages.push(responseMessage);
            apiMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: textual
            });
            
            const secondPayload = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: model,
                    messages: apiMessages,
                    temperature: 0.6
                })
            };

            let secondRes;

            try {
                if (proxyUrl || model.includes('llama') || model.includes('deepseek')) {
                    const proxyBody = JSON.stringify({
                       url: endpoint,
                       method: 'POST',
                       headers: secondPayload.headers,
                       body: JSON.parse(secondPayload.body)
                    });
                    
                    let usingProxy = proxyUrl || '/api/proxy';
                    try {
                        secondRes = await fetch(usingProxy, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: proxyBody
                        });
                    } catch (e) {
                         if (usingProxy !== '/api/proxy') {
                             secondRes = await fetch('/api/proxy', {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: proxyBody
                             });
                         } else {
                             throw e;
                         }
                    }
                } else {
                    secondRes = await fetch(endpoint, secondPayload);
                }
            } catch (e: any) {
                throw new Error(`Failed to fetch second step API via Proxy/Direct (${e.message})`);
            }
            
            if (!secondRes.ok) {
                throw new Error("Erro na solicitação pós-ferramenta.");
            }
            
            const secondData = await secondRes.json();
            const text = secondData.choices[0]?.message?.content || "Operação Realizada.";
            appendMsg((prev: any) => [...prev, {
                id: Date.now().toString() + '_final',
                role: 'model',
                rawText: text,
                content: text
            }]);
        } else {
            const text = responseMessage?.content || 'Sem resposta.';
            appendMsg((prev: any) => [...prev, {
                id: Date.now().toString() + '_reply',
                role: 'model',
                rawText: text,
                content: text
            }]);
        }
        setStat('AI Link Ativo');
    };

    const handleAnthropicRequest = async (apiKey: string, userMessage: string, msgHistory: ChatMessage[], appendMsg: any, setStat: any, tools: any, executeTool: any, proxyUrl?: string) => {
        setStat('Conectando ao Anthropic...');
        const apiMessages: any[] = msgHistory.filter(m => m.role !== 'tool').slice(-10).map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.rawText
        }));
        
        apiMessages.push({ role: 'user', content: userMessage });
        
        const fetchPayload = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                system: SYSTEM_INSTRUCTION,
                messages: apiMessages,
                max_tokens: 1024,
                temperature: 0.5,
                tools: tools
            })
        };
        
        let res;

        try {
            if (proxyUrl) {
                const proxyBody = JSON.stringify({
                   url: 'https://api.anthropic.com/v1/messages',
                   method: 'POST',
                   headers: fetchPayload.headers,
                   body: JSON.parse(fetchPayload.body)
                });
                let usingProxy = proxyUrl || '/api/proxy';
                try {
                    res = await fetch(usingProxy, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: proxyBody
                    });
                } catch (e) {
                     if (usingProxy !== '/api/proxy') {
                         res = await fetch('/api/proxy', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: proxyBody
                         });
                     } else {
                         throw e;
                     }
                }
            } else {
                res = await fetch('https://api.anthropic.com/v1/messages', fetchPayload);
            }
        } catch (e: any) {
            throw new Error(`Failed to fetch Anthropic API via Proxy/Direct (${e.message})`);
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(`Anthropic Error: ${errorData.error?.message || res.statusText}`);
        }

        const data = await res.json();
        
        const toolUse = data.content?.find((c: any) => c.type === 'tool_use');

        if (toolUse) {
            setStat('Executando Middleware do Servidor...');
            const { visual, textual } = await executeTool(toolUse.name, toolUse.input || {});
            
            appendMsg((prev: any) => [...prev, {
                id: Date.now().toString() + '_tool',
                role: 'tool',
                rawText: `[Tool Return]: ${textual}`,
                content: visual
            }]);
            
            setStat('Analisando Deep Data Resultante...');
            
            apiMessages.push({
                role: "assistant",
                content: data.content
            });
            
            apiMessages.push({
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: toolUse.id,
                        content: textual
                    }
                ]
            });
            
            const secondPayload = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    system: SYSTEM_INSTRUCTION,
                    messages: apiMessages,
                    max_tokens: 1024,
                    temperature: 0.6
                })
            };

            let secondRes;

            try {
                if (proxyUrl) {
                    const proxyBody = JSON.stringify({
                       url: 'https://api.anthropic.com/v1/messages',
                       method: 'POST',
                       headers: secondPayload.headers,
                       body: JSON.parse(secondPayload.body)
                    });
                    
                    let usingProxy = proxyUrl || '/api/proxy';
                    try {
                        secondRes = await fetch(usingProxy, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: proxyBody
                        });
                    } catch (e) {
                         if (usingProxy !== '/api/proxy') {
                             secondRes = await fetch('/api/proxy', {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: proxyBody
                             });
                         } else {
                             throw e;
                         }
                    }
                } else {
                    secondRes = await fetch('https://api.anthropic.com/v1/messages', secondPayload);
                }
            } catch (e: any) {
                throw new Error(`Failed to fetch second step Anthropic API (${e.message})`);
            }
            
            if (!secondRes.ok) {
                throw new Error("Erro na solicitação pós-ferramenta.");
            }
            
            const secondData = await secondRes.json();
            const text = secondData.content?.[0]?.text || "Operação Realizada.";
            appendMsg((prev: any) => [...prev, {
                id: Date.now().toString() + '_final',
                role: 'model',
                rawText: text,
                content: text
            }]);
        } else {
            const text = data.content?.[0]?.text || 'Sem resposta.';
            appendMsg((prev: any) => [...prev, {
                id: Date.now().toString() + '_reply',
                role: 'model',
                rawText: text,
                content: text
            }]);
        }
        setStat('AI Link Ativo');
    };

    const handleErrorMessage = (err: any, appendMsg: any) => {
        let errorMessage = err instanceof Error ? err.message : 'Timeout ou Limite de API Alcançado.';
        
        if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429')) {
           errorMessage = "Limite de cota ou faturamento da API excedido. Se você está usando a chave padrão, acesse Configurações > Provedores de Inteligência Artificial e adicione a sua própria chave. Se já adicionou, verifique o saldo do seu provedor (Google AI Studio ou OpenAI).";
        } else if (errorMessage.startsWith('{')) {
            try {
                const parsed = JSON.parse(errorMessage);
                if (parsed.error && parsed.error.message) {
                    errorMessage = parsed.error.message;
                }
            } catch (e) {}
        }
        
        appendMsg((prev: any) => [...prev, {
            id: Date.now().toString() + '_err',
            role: 'model',
            rawText: 'Falha.',
            content: React.createElement("div", { className: "text-red-500 font-mono text-[10px]" }, `Falha Cognitiva: ${errorMessage}`)
        }]);
    };

    return { processMessage };
};
