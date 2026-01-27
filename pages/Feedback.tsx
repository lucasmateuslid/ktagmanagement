
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../services/storage';
import { Feedback, FeedbackType } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { 
  MessageSquarePlus, Image as ImageIcon, Send, Paperclip, 
  Bug, Lightbulb, TrendingUp, X, User, Clock, FileText 
} from 'lucide-react';

export const FeedbackPage = () => {
  const { user, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [type, setType] = useState<FeedbackType>('suggestion');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const loadFeedbacks = async () => {
    setLoading(true);
    const data = await storage.getFeedbacks();
    setFeedbacks(data);
    setLoading(false);
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setAttachments(prev => [...prev, reader.result as string]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) handleFileRead(blob);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
        addNotification('error', 'Erro', 'Digite algum comentário.');
        return;
    }
    if (!user) return;

    const newFeedback: Feedback = {
        id: crypto.randomUUID(),
        userId: user.id,
        userName: user.name,
        type,
        content,
        attachments,
        createdAt: Date.now()
    };

    await storage.saveFeedback(newFeedback);
    setFeedbacks([newFeedback, ...feedbacks]);
    
    // Reset Form
    setContent('');
    setAttachments([]);
    addNotification('success', 'Enviado', 'Obrigado pelo seu feedback!');
  };

  const getTypeStyles = (t: FeedbackType) => {
      switch(t) {
          case 'bug': return 'bg-red-500 text-white';
          case 'suggestion': return 'bg-blue-500 text-white';
          case 'improvement': return 'bg-emerald-500 text-white';
      }
  };

  const getTypeLabel = (t: FeedbackType) => {
      switch(t) {
          case 'bug': return 'Bug / Erro';
          case 'suggestion': return 'Sugestão';
          case 'improvement': return 'Melhoria';
      }
  };

  const getTypeIcon = (t: FeedbackType) => {
      switch(t) {
          case 'bug': return <Bug size={14}/>;
          case 'suggestion': return <Lightbulb size={14}/>;
          case 'improvement': return <TrendingUp size={14}/>;
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">
            {isAdmin ? 'Comentários & Feedback' : 'Feedback & Sugestões'}
          </h1>
          <p className="text-zinc-500 mt-2 font-medium text-sm">
            {isAdmin ? 'Monitore sugestões e reports da equipe.' : 'Ajude-nos a melhorar o sistema reportando bugs ou sugerindo melhorias.'}
          </p>
        </div>
      </div>

      {/* FORMULÁRIO DE ENVIO */}
      <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
         <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl w-fit border border-zinc-200 dark:border-zinc-800">
                {(['suggestion', 'bug', 'improvement'] as FeedbackType[]).map(t => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${type === t ? getTypeStyles(t) + ' shadow-md' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                    >
                        {getTypeIcon(t)} {getTypeLabel(t)}
                    </button>
                ))}
            </div>

            <div className="relative">
                <textarea 
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Descreva sua sugestão ou reporte um erro... (Você pode colar imagens aqui com Ctrl+V)"
                    className="w-full min-h-[120px] p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:border-primary-500 transition-all text-sm font-medium resize-y"
                />
                
                {/* Image Preview Strip */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 p-2 overflow-x-auto mt-2">
                        {attachments.map((img, idx) => (
                            <div key={idx} className="relative group w-20 h-20 shrink-0">
                                <img src={img} alt="preview" className="w-full h-full object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"/>
                                <button type="button" onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:scale-110 transition-transform">
                                    <X size={12}/>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-zinc-500 text-xs font-bold transition-all">
                        <Paperclip size={16}/> Anexar Arquivo/Imagem
                    </button>
                    <input type="file" ref={fileInputRef} onChange={e => e.target.files?.[0] && handleFileRead(e.target.files[0])} accept="image/*" className="hidden"/>
                </div>
                <button type="submit" className="bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all">
                    <Send size={16}/> Enviar
                </button>
            </div>
         </form>
      </div>

      {/* LISTA DE FEEDBACKS */}
      <div className="grid grid-cols-1 gap-6">
          {feedbacks.length === 0 && !loading && (
              <div className="text-center py-10 opacity-40">
                  <MessageSquarePlus size={48} className="mx-auto mb-2 text-zinc-400"/>
                  <p className="text-xs font-bold text-zinc-500 uppercase">Nenhum comentário registrado</p>
              </div>
          )}

          {feedbacks.map(fb => (
              <div key={fb.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-zinc-500 uppercase">
                              {fb.userName.charAt(0)}
                          </div>
                          <div>
                              <p className="text-xs font-black text-zinc-900 dark:text-white uppercase">{fb.userName}</p>
                              <p className="text-[10px] text-zinc-400 flex items-center gap-1"><Clock size={10}/> {new Date(fb.createdAt).toLocaleString()}</p>
                          </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
                          fb.type === 'bug' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                          fb.type === 'suggestion' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 
                          'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}>
                          {getTypeIcon(fb.type)} {getTypeLabel(fb.type)}
                      </span>
                  </div>

                  <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{fb.content}</p>

                  {fb.attachments && fb.attachments.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pt-2 pb-1">
                          {fb.attachments.map((att, idx) => (
                              <div key={idx} className="cursor-pointer" onClick={() => { const w = window.open(); if(w) { w.document.write(`<img src="${att}" style="max-width:100%"/>`); } }}>
                                  <img src={att} className="h-24 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:opacity-80 transition-opacity" alt="attachment"/>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          ))}
      </div>
    </div>
  );
};
