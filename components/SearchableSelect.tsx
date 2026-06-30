import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
  data?: any;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string, option?: Option) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchPlaceholder?: string;
  renderOption?: (option: Option, isSelected: boolean) => React.ReactNode;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  disabled = false,
  className = '',
  searchPlaceholder = 'Buscar...',
  renderOption
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = useMemo(() => options.find(o => o.id === value), [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const term = search.toLowerCase();
    return options.filter(o => 
      o.label.toLowerCase().includes(term) || 
      (o.subLabel && o.subLabel.toLowerCase().includes(term))
    );
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target as Node) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target as Node))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  const dropdownContent = (
    <div 
      ref={dropdownRef}
      className="absolute mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[60000] overflow-hidden flex flex-col"
      style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: '350px' }}
    >
      <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ring-primary-500/20 text-zinc-900 dark:text-white"
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
        {filteredOptions.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-400 font-medium">Nenhum resultado encontrado</div>
        ) : (
          filteredOptions.map((option, index) => {
            const isSelected = option.id === value;
            return (
              <div 
                key={`${option.id}-${index}`} 
                onClick={() => {
                  onChange(option.id, option);
                  setIsOpen(false);
                }} 
                className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
              >
                {renderOption ? renderOption(option, isSelected) : (
                  <div className="flex flex-col">
                    <span className="text-sm font-bold truncate">{option.label}</span>
                    {option.subLabel && <span className="text-[10px] text-zinc-500 truncate">{option.subLabel}</span>}
                  </div>
                )}
                {isSelected && <Check size={14} className="shrink-0 text-primary-500" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className={`w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-500'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`truncate font-bold text-sm ${selectedOption ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  );
};
