
import React from 'react';
import { Search, Loader2, ChevronRight, ArrowLeft, X } from 'lucide-react';
import { FipeReference } from '../../../services/fipe';

interface FipeModalProps {
  onClose: () => void;
  step: number;
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  currentType: string;
  selectedBrand: FipeReference | null;
  selectedModel: FipeReference | null;
  filteredList: FipeReference[];
  handleSelection: (item: FipeReference) => void;
  handleBack: () => void;
}

export const FipeModal: React.FC<FipeModalProps> = ({
  onClose, step, loading, searchTerm, setSearchTerm, currentType,
  selectedBrand, selectedModel, filteredList, handleSelection, handleBack
}) => {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-[32px] shadow-2xl relative border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                {step > 1 && (
                    <button onClick={handleBack} className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary-500 transition-colors">
                        <ArrowLeft size={18} />
                    </button>
                )}
                <div>
                    <h3 className="text-lg font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                        {step === 1 ? 'Selecione a Marca' : step === 2 ? 'Selecione o Modelo' : 'Selecione o Ano'}
                    </h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        {step === 1 ? `Tipo: ${currentType}` : step === 2 ? selectedBrand?.nome : selectedModel?.nome}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                <X size={20}/>
            </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                    type="text" 
                    placeholder={step === 1 ? "Buscar marca..." : step === 2 ? "Buscar modelo..." : "Buscar ano..."} 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold outline-none focus:border-primary-500 transition-all" 
                    autoFocus
                />
            </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
              <div className="py-20 flex flex-col items-center gap-4 text-zinc-400">
                  <Loader2 className="animate-spin text-primary-500" size={32} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Carregando Tabela FIPE...</span>
              </div>
          ) : filteredList.length === 0 ? (
              <div className="py-20 text-center text-zinc-400 font-bold uppercase text-xs opacity-50">Nenhum resultado encontrado</div>
          ) : (
              <div className="space-y-2">
                  {filteredList.map((item) => (
                      <button 
                        key={item.codigo} 
                        onClick={() => handleSelection(item)} 
                        className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-primary-500 hover:text-black border border-zinc-100 dark:border-zinc-800 hover:border-primary-500 rounded-2xl text-left transition-all group shadow-sm active:scale-[0.98]"
                      >
                          <span className="font-bold text-xs uppercase tracking-tight">{item.nome}</span>
                          <ChevronRight size={16} className="opacity-30 group-hover:opacity-100 transition-opacity"/>
                      </button>
                  ))}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};
