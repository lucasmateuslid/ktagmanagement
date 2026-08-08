import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { storage } from '../../services/storage';
import { useAiTools } from './useAiTools';
import { ChatMessage } from './types';

const SYSTEM_INSTRUCTION = `Você é a "Monitora 360 AI", inteligência analítica de nível executivo embutida no Monitora 360 (Gestão de Frotas, Telemetria e Despacho de Técnicos). Atue como um COO (Chief Operating Officer) digital / Engenheiro de Logística Sênior.

MISSÃO
Você nunca apenas lista dados. Ao receber resultados das suas bases (dados estruturados), cruze correlações, avalie a saúde operacional, identifique gargalos e entregue insights TÁTICOS (ação imediata) e ESTRATÉGICOS (visão de negócio).

TOM E ESTRUTURA
- Executivo, direto, focado em SLA, redução de ociosidade e lucro. Sem floreio.
- Comece pela conclusão mais importante. Nunca comece com "Claro", "Vou analisar" ou uma explicação do processo.
- Para perguntas simples, responda em 2 a 5 frases. Para diagnósticos, use: **Diagnóstico**, **Evidências** e **Próxima ação**.
- Use bullets apenas quando houver múltiplos fatos. Destaque KPIs e ações em **negrito**.
- IMERSÃO: você É o cérebro da plataforma. Nunca mencione ferramenta, JSON, função, back-end, API, provedor, modelo, token, integração interna ou etapas de processamento.
- Cite dados específicos recebidos: nomes, placas, quantidades, tipos de OS e datas. Nunca generalize quando há detalhe disponível.
- Diferencie fato confirmado de inferência. Se faltar dado, diga exatamente o que não foi encontrado; não preencha lacunas com suposições.
- Nunca afirme que abriu OS, alterou cadastro, notificou alguém ou executou qualquer ação que não tenha sido realmente confirmada pelos dados.
- Não repita a pergunta do usuário nem entregue introduções genéricas. Toda resposta deve terminar com uma recomendação concreta ou, quando útil, uma única pergunta objetiva.

THRESHOLDS DE ALERTA (dispare quando os números cruzarem estes limites)
- ratioOsPorTecnico > 3  → ALERTA de ruptura iminente de SLA: a fila de OS excede a capacidade dos técnicos ativos. Recomende redistribuição / reforço de equipe / priorização.
- percentualEstoqueOcioso > 30  → ALERTA de capital parado: hardware em prateleira sem gerar receita. Recomende acelerar instalações.
- Veículo com status diferente de "active" OU temTagGps=false → recomende vistoria presencial e/ou abertura de OS urgente (ponto cego de telemetria).
- Ao fim de relatórios densos, faça UMA pergunta acionável (ex.: "Quer que eu priorize as OS por proximidade dos técnicos disponíveis?").

EXEMPLOS DE EXCELÊNCIA (padrão de resposta — ilustrativos, não são dados reais)

[Exemplo 1 — diagnóstico operacional]
Dados internos: {"metricas":{"tecnicosAtivos":2,"totalOsPendentes":9,"ratioOsPorTecnico":4.5,"percentualEstoqueOcioso":42},"tecnicos":[{"nome":"Carlos","ativo":true,"especialidades":["Rastreador","Tag"]},{"nome":"Marina","ativo":true,"especialidades":["Tag"]}],"ordensServicoPendentes":[{"placa":"ABC1D23","tipoServico":"Instalação","dispositivo":"Rastreador","dataPreferida":"2026-05-28","solicitante":"Filial Sul"}],"estoque":{"totalTags":50,"ociosas":21}}
Resposta ideal:
🔴 **Ruptura de SLA iminente.** São **9 OS pendentes** para apenas **2 técnicos ativos** (Carlos e Marina) — ratio de **4,5:1**, bem acima do limite saudável de 3:1.
- Gargalo de especialidade: só o **Carlos** cobre Rastreador; a OS da **ABC1D23** (Instalação de Rastreador, Filial Sul, para 28/05) depende exclusivamente dele.
- **42% do estoque ocioso** (21 de 50 tags) = capital parado sem gerar mensalidade.
Ações imediatas: (1) realocar OS de Tag para a Marina e blindar a agenda do Carlos para Rastreadores; (2) avaliar reforço/técnico volante; (3) puxar campanha de instalação para drenar as 21 tags ociosas.
Quer que eu ordene as 9 OS por proximidade geográfica dos técnicos disponíveis?

[Exemplo 2 — veículo específico]
Dados internos: {"encontrado":true,"placa":"XYZ9K88","modelo":"Fiat Toro","status":"maintenance","temTagGps":false}
Resposta ideal:
A **XYZ9K88** (Fiat Toro) está em **manutenção** e **sem Tag GPS vinculada** — hoje é um ponto cego na frota, sem telemetria.
Recomendo **vistoria presencial urgente** e abertura de OS de instalação/reativação antes de liberar o veículo para operação. Quer que eu gere a solicitação de OS para o técnico mais próximo?`;

// Mantém o histórico relevante para o modelo: todas as mensagens não-tool +
// APENAS as últimas 4 mensagens de tool (resultados recentes preservam contexto
// entre perguntas sem inflar o payload). Depois corta para as últimas 12.
const trimHistory = (msgs: ChatMessage[]): ChatMessage[] => {
    const recentToolIds = new Set(
        msgs.filter(m => m.role === 'tool').slice(-4).map(m => m.id)
    );
    return msgs
        .filter(m => m.role !== 'tool' || recentToolIds.has(m.id))
        .slice(-12);
};

const toolStatus = (name: string): string => {
    if (name === 'get_vehicle_location') return 'Localizando o veículo...';
    if (name === 'get_fleet_stats') return 'Conferindo frota e estoque...';
    if (name === 'search_external_data') return 'Consultando registros...';
    if (name === 'analyze_operations') return 'Cruzando indicadores da operação...';
    return 'Consultando dados...';
};

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
            setStatus('Pensando...');
            const settings = await storage.getSettings();

            // Basic Provider selection handling
            const provider = settings.aiProvider || 'gemini';

            let keyToUse = '';
            if (provider === 'gemini') keyToUse = settings.geminiApiKey?.trim() || process.env.GEMINI_API_KEY || '';
            else if (provider === 'openai') keyToUse = settings.openAiApiKey?.trim() || '';
            else if (provider === 'anthropic') keyToUse = settings.anthropicApiKey?.trim() || '';
            else if (provider === 'groq') keyToUse = settings.groqApiKey?.trim() || '';
            else if (provider === 'deepseek') keyToUse = settings.deepseekApiKey?.trim() || '';
            else if (provider === 'nvidia') keyToUse = settings.nvidiaApiKey?.trim() || '';

            if (!keyToUse) {
                if (provider === 'gemini') {
                    throw new Error("O motor de inteligência artificial está temporariamente indisponível. Contate o administrador da plataforma.");
                } else {
                    throw new Error("O motor de inteligência artificial está temporariamente indisponível. Verifique a integração administrativa.");
                }
            }

            if (provider === 'openai') {
                await handleOpenAICompatible(keyToUse, userMessage, messages, setMessages, setStatus, 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', openAiTools, executeTool, settings.customProxyUrl);
                return;
            } else if (provider === 'groq') {
                await handleOpenAICompatible(keyToUse, userMessage, messages, setMessages, setStatus, 'https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile', openAiTools, executeTool, settings.customProxyUrl);
                return;
            } else if (provider === 'deepseek') {
                await handleOpenAICompatible(keyToUse, userMessage, messages, setMessages, setStatus, 'https://api.deepseek.com/chat/completions', 'deepseek-chat', openAiTools, executeTool, settings.customProxyUrl);
                return;
            } else if (provider === 'nvidia') {
                await handleOpenAICompatible(
                    keyToUse,
                    userMessage,
                    messages,
                    setMessages,
                    setStatus,
                    'https://integrate.api.nvidia.com/v1/chat/completions',
                    settings.nvidiaModel?.trim() || 'nvidia/nemotron-3-ultra-550b-a55b',
                    openAiTools,
                    executeTool,
                    settings.customProxyUrl,
                );
                return;
            } else if (provider === 'anthropic') {
                await handleAnthropicRequest(keyToUse, userMessage, messages, setMessages, setStatus, anthropicTools, executeTool, settings.customProxyUrl);
                return;
            } else if (provider !== 'gemini') {
                throw new Error(`O provedor ${String(provider).toUpperCase()} foi selecionado mas seu SDK ainda não foi totalmente mapeado neste ambiente. Use Gemini ou OpenAI.`);
            }

            // GEMINI FLOW (com tool chaining)
            const ai = new GoogleGenAI({ apiKey: keyToUse });

            const formattedHistory: any[] = trimHistory(messages).map(m => ({
                role: m.role === 'tool' ? 'user' : m.role,
                parts: [{ text: m.rawText }]
            }));

            formattedHistory.push({ role: 'user', parts: [{ text: userMessage }] });

            let resp = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: formattedHistory,
              config: {
                  tools: toolsInfo as any,
                  systemInstruction: SYSTEM_INSTRUCTION,
                  temperature: 0.5
              }
            });

            // Loop de tool chaining: continua enquanto o modelo pedir ferramentas (máx 5).
            let iterations = 0;
            while (resp.functionCalls && resp.functionCalls.length > 0 && iterations < 5) {
                iterations++;
                const calls = resp.functionCalls;

                // Turno do modelo com todas as function calls da resposta.
                formattedHistory.push({ role: 'model', parts: calls.map(c => ({ functionCall: c })) });

                const responseParts: any[] = [];
                for (const call of calls) {
                    if (!call.name) continue;
                    setStatus(toolStatus(call.name));
                    const { visual, textual } = await executeTool(call.name, call.args);

                    setMessages(prev => [...prev, {
                        id: `${Date.now()}_tool_${iterations}_${responseParts.length}`,
                        role: 'tool',
                        rawText: `[Tool Return]: ${textual}`,
                        content: visual,
                        hidden: true
                    }]);

                    responseParts.push({ functionResponse: { name: call.name, response: { result: textual } } });
                }
                formattedHistory.push({ role: 'function', parts: responseParts });

                setStatus('Analisando as informações...');

                // A 2ª+ chamada PRECISA reenviar `tools` para permitir o chaining.
                resp = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: formattedHistory,
                    config: {
                        tools: toolsInfo as any,
                        systemInstruction: SYSTEM_INSTRUCTION,
                        temperature: 0.6
                    }
                });
            }

            setMessages(prev => [...prev, {
                id: Date.now().toString() + '_final',
                role: 'model',
                rawText: resp.text || '',
                content: resp.text || "Não encontrei dados suficientes para responder com segurança."
            }]);

            setStatus('Pronta para ajudar');

        } catch (err) {
            console.error('AI Processing Error:', err);
            setStatus('Não foi possível concluir');
            handleErrorMessage(err, setMessages);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAICompatible = async (apiKey: string, userMessage: string, msgHistory: ChatMessage[], appendMsg: any, setStat: any, endpoint: string, model: string, tools: any, executeTool: any, proxyUrl?: string) => {
        setStat('Pensando...');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

        const apiMessages: any[] = trimHistory(msgHistory).map(m => ({
            // mensagens de tool antigas entram como contexto de usuário (rawText já é o dado).
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.rawText
        }));
        apiMessages.unshift({ role: 'system', content: SYSTEM_INSTRUCTION });
        apiMessages.push({ role: 'user', content: userMessage });

        // Faz a chamada (proxy para groq/deepseek/proxy explícito, direto caso contrário).
        const callApi = async (bodyObj: any) => {
            const forceProxy = !!proxyUrl || model.includes('llama') || model.includes('deepseek');
            let res;
            try {
                if (proxyUrl || model.includes('llama') || model.includes('deepseek')) {
                    const proxyBody = JSON.stringify({
                       url: endpoint,
                       method: 'POST',
                       headers,
                       body: bodyObj
                    });
                    
                    const usingProxy = proxyUrl || '/api/proxy';
                    try {
                        res = await fetch(usingProxy, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: proxyBody });
                    } catch (e) {
                        if (usingProxy !== '/api/proxy') {
                            res = await fetch('/api/proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: proxyBody });
                        } else { throw e; }
                    }
                } else {
                    res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(bodyObj) });
                }
            } catch (e: any) {
                throw new Error(`Failed to fetch API via Proxy/Direct (${e.message})`);
            }
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(`API Error: ${errorData.error?.message || res.statusText}`);
            }
            return res.json();
        };

        let data = await callApi({ model, messages: apiMessages, temperature: 0.5, tools, tool_choice: "auto" });
        let responseMessage = data.choices[0]?.message;
        let iterations = 0;

        while (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0 && iterations < 5) {
            iterations++;
            apiMessages.push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
                const name = toolCall.function.name;
                setStat(toolStatus(name));
                let args = {};
                try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch (e) { /* args inválidos → objeto vazio */ }

                const { visual, textual } = await executeTool(name, args);

                appendMsg((prev: any) => [...prev, {
                    id: `${Date.now()}_tool_${iterations}_${toolCall.id}`,
                    role: 'tool',
                    rawText: `[Tool Return]: ${textual}`,
                    content: visual,
                    hidden: true
                }]);

                apiMessages.push({ role: "tool", tool_call_id: toolCall.id, name, content: textual });
            }

            setStat('Analisando as informações...');
            // tools mantido nas chamadas seguintes para permitir chaining.
            data = await callApi({ model, messages: apiMessages, temperature: 0.6, tools, tool_choice: "auto" });
            responseMessage = data.choices[0]?.message;
        }

        const text = responseMessage?.content || "Não encontrei dados suficientes para responder com segurança.";
        appendMsg((prev: any) => [...prev, {
            id: Date.now().toString() + '_final',
            role: 'model',
            rawText: text,
            content: text
        }]);
        setStat('Pronta para ajudar');
    };

    const handleAnthropicRequest = async (apiKey: string, userMessage: string, msgHistory: ChatMessage[], appendMsg: any, setStat: any, tools: any, executeTool: any, proxyUrl?: string) => {
        setStat('Pensando...');
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        };
        const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

        const apiMessages: any[] = trimHistory(msgHistory).map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.rawText
        }));
        apiMessages.push({ role: 'user', content: userMessage });

        const callApi = async (bodyObj: any) => {
            let res;
            try {
                if (proxyUrl) {
                    const proxyBody = JSON.stringify({
                       url: 'https://api.anthropic.com/v1/messages',
                       method: 'POST',
                       headers,
                       body: bodyObj
                    });
                    
                    const usingProxy = proxyUrl || '/api/proxy';
                    try {
                        res = await fetch(usingProxy, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: proxyBody });
                    } catch (e) {
                        if (usingProxy !== '/api/proxy') {
                            res = await fetch('/api/proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: proxyBody });
                        } else { throw e; }
                    }
                } else {
                    res = await fetch(ANTHROPIC_URL, { method: 'POST', headers, body: JSON.stringify(bodyObj) });
                }
            } catch (e: any) {
                throw new Error(`Failed to fetch Anthropic API via Proxy/Direct (${e.message})`);
            }
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(`Anthropic Error: ${errorData.error?.message || res.statusText}`);
            }
            return res.json();
        };

        // max_tokens 4096: respostas ricas (KPIs + recomendações) não cabiam em 1024.
        let data = await callApi({ model: 'claude-3-haiku-20240307', system: SYSTEM_INSTRUCTION, messages: apiMessages, max_tokens: 4096, temperature: 0.5, tools });
        let iterations = 0;
        let toolUse = data.content?.find((c: any) => c.type === 'tool_use');

        while (toolUse && iterations < 5) {
            iterations++;
            apiMessages.push({ role: "assistant", content: data.content });

            const toolResults: any[] = [];
            const toolUses = (data.content || []).filter((c: any) => c.type === 'tool_use');
            for (const tu of toolUses) {
                setStat(toolStatus(tu.name));
                const { visual, textual } = await executeTool(tu.name, tu.input || {});

                appendMsg((prev: any) => [...prev, {
                    id: `${Date.now()}_tool_${iterations}_${tu.id}`,
                    role: 'tool',
                    rawText: `[Tool Return]: ${textual}`,
                    content: visual,
                    hidden: true
                }]);

                toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: textual });
            }
            apiMessages.push({ role: "user", content: toolResults });

            setStat('Analisando as informações...');
            data = await callApi({ model: 'claude-3-haiku-20240307', system: SYSTEM_INSTRUCTION, messages: apiMessages, max_tokens: 4096, temperature: 0.6, tools });
            toolUse = data.content?.find((c: any) => c.type === 'tool_use');
        }

        const text = data.content?.find((c: any) => c.type === 'text')?.text || data.content?.[0]?.text || "Não encontrei dados suficientes para responder com segurança.";
        appendMsg((prev: any) => [...prev, {
            id: Date.now().toString() + '_final',
            role: 'model',
            rawText: text,
            content: text
        }]);
        setStat('Pronta para ajudar');
    };

    const handleErrorMessage = (err: any, appendMsg: any) => {
        let errorMessage = 'Não consegui concluir esta análise agora. Tente novamente em instantes.';
        const technicalMessage = err instanceof Error ? err.message : '';

        if (technicalMessage.includes('RESOURCE_EXHAUSTED') || technicalMessage.includes('429')) {
           errorMessage = 'Estou com alta demanda neste momento. Aguarde um pouco e tente novamente.';
        } else if (/network|fetch|timeout|tempo limite/i.test(technicalMessage)) {
           errorMessage = 'A conexão oscilou durante a análise. Verifique sua rede e tente novamente.';
        }

        appendMsg((prev: any) => [...prev, {
            id: Date.now().toString() + '_err',
            role: 'model',
            rawText: errorMessage,
            content: React.createElement("div", { className: "text-red-400 text-xs font-medium leading-relaxed" }, errorMessage)
        }]);
    };

    return { processMessage };
};
