import React from 'react';

export interface ChatMessage {
    id: string;
    role: 'user' | 'model' | 'tool';
    content: React.ReactNode;
    rawText: string;
    /** Mantém contexto para a IA sem exibir detalhes técnicos ao usuário. */
    hidden?: boolean;
}

export interface AiAssistantState {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    input: string;
    setInput: (input: string) => void;
    status: string;
    setStatus: (status: string) => void;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    loading: boolean;
    setLoading: (loading: boolean) => void;
}
