import React from 'react';
import { ArrowLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { FipeReference } from '../../../services/fipe';
import { Button, Input } from '../../../components/ui';

interface FipePanelProps {
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

const STEP_TITLE = ['', 'Selecione a marca', 'Selecione o modelo', 'Selecione o ano'];
const STEP_PLACEHOLDER = ['', 'Buscar marca…', 'Buscar modelo…', 'Buscar ano…'];

/** Seletor FIPE em 3 passos (marca → modelo → ano), embutido na página — não é modal. */
export const FipePanel: React.FC<FipePanelProps> = ({
  onClose, step, loading, searchTerm, setSearchTerm, currentType,
  selectedBrand, selectedModel, filteredList, handleSelection, handleBack,
}) => {
  const searchRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { searchRef.current?.focus(); }, [step]);
  return (
  <div className="rounded-xl border border-line bg-surface-2 sm:col-span-2" role="region" aria-label="Busca na tabela FIPE">
    <div className="flex items-center justify-between gap-3 border-b border-line p-4">
      <div className="flex min-w-0 items-center gap-3">
        {step > 1 && (
          <Button type="button" variant="outline" size="icon" aria-label="Voltar um passo" onClick={handleBack}>
            <ArrowLeft size={16} aria-hidden />
          </Button>
        )}
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-tight text-fg-1">{STEP_TITLE[step]}</p>
          <p className="truncate text-label-xs uppercase text-fg-2">
            {step === 1 ? `Tipo: ${currentType}` : step === 2 ? selectedBrand?.nome : selectedModel?.nome}
          </p>
        </div>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label="Fechar busca FIPE" onClick={onClose}>
        <X size={18} aria-hidden />
      </Button>
    </div>

    <div className="border-b border-line p-4">
      <Input
        leadingIcon={<Search size={16} aria-hidden />}
        aria-label={STEP_PLACEHOLDER[step]}
        placeholder={STEP_PLACEHOLDER[step]}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        ref={searchRef}
      />
    </div>

    <div className="max-h-72 overflow-y-auto p-2">
      {loading ? (
        <div role="status" className="flex flex-col items-center gap-3 py-12 text-fg-3">
          <Loader2 className="animate-spin text-accent" size={28} aria-hidden />
          <span className="text-label-xs uppercase">Carregando tabela FIPE…</span>
        </div>
      ) : filteredList.length === 0 ? (
        <p className="py-12 text-center text-label-xs uppercase text-fg-3">Nenhum resultado encontrado</p>
      ) : (
        <ul className="space-y-1">
          {filteredList.map(item => (
            <li key={item.codigo}>
              <button
                type="button"
                onClick={() => handleSelection(item)}
                className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-fg-1 transition-colors hover:bg-primary-500/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <span className="truncate">{item.nome}</span>
                <ChevronRight size={16} className="shrink-0 text-fg-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
  );
};
