import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Using notionists style for all avatars
const AVATARS = Array.from({ length: 48 }).map((_, i) => {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=Avatar${i}&backgroundColor=transparent`;
});

interface AvatarSelectorProps {
  currentAvatar?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

export const AvatarSelector = ({ currentAvatar, onSelect, onClose }: AvatarSelectorProps) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string | undefined>(currentAvatar);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden pointer-events-auto"
      >
        <div className="p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50 shrink-0">
          <div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">Escolha seu Avatar</h2>
            <p className="text-xs text-zinc-500 font-medium hidden sm:block">Personalize sua foto de perfil</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 sm:p-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
            {/* Preview Section */}
            <div className="sm:w-1/3 border-b sm:border-b-0 sm:border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-6 flex flex-row sm:flex-col items-center justify-center shrink-0 gap-6 sm:gap-0">
                <div className="w-24 h-24 sm:w-48 sm:h-48 rounded-full border-4 border-white dark:border-zinc-800 shadow-xl bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden sm:mb-6 shrink-0">
                    {selectedAvatar ? (
                        <img src={selectedAvatar} alt="Preview do Avatar" className="w-full h-full object-cover p-2 sm:p-4" />
                    ) : (
                        <span className="text-zinc-400 text-xs sm:text-sm font-bold uppercase tracking-widest text-center">Nenhum<br/>Selecionado</span>
                    )}
                </div>
                <div className="text-left sm:text-center">
                    <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-1">Preview</p>
                    <p className="text-[10px] sm:text-xs text-zinc-400 hidden sm:block">Assim que você será visto</p>
                </div>
            </div>

            {/* Selector Section */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-4">
                {AVATARS.map((url, idx) => {
                  const isSelected = selectedAvatar === url;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedAvatar(url)}
                      className={`relative aspect-square rounded-2xl border-2 overflow-hidden transition-all hover:scale-105 active:scale-95 ${
                        isSelected 
                          ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50 dark:bg-primary-900/20 scale-105 shadow-md z-10' 
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-primary-500/50 bg-zinc-50 dark:bg-zinc-800/50'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover p-1.5 sm:p-2 drop-shadow-sm" />
                      {isSelected && (
                        <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary-500 flex items-center justify-center text-black shadow-lg">
                            <Check size={12} strokeWidth={4} />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end gap-3 shrink-0">
            <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                Cancelar
            </button>
            <button
                onClick={() => selectedAvatar && onSelect(selectedAvatar)}
                disabled={!selectedAvatar || selectedAvatar === currentAvatar}
                className="px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-black bg-primary-500 hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20"
                >
                Salvar Avatar
            </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
