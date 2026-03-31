
import { useState, useMemo } from 'react';
import { fipeService, FipeReference } from '../../../services/fipe';
import { VehicleCategory } from '../../../types';

export const useFipeSearch = (categories: VehicleCategory[]) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: Marca, 2: Modelo, 3: Ano
  const [list, setList] = useState<FipeReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedBrand, setSelectedBrand] = useState<FipeReference | null>(null);
  const [selectedModel, setSelectedModel] = useState<FipeReference | null>(null);
  const [currentType, setCurrentType] = useState<'carros' | 'motos' | 'caminhoes'>('carros');

  const startSearch = async (categoryId?: string) => {
    let type: 'carros' | 'motos' | 'caminhoes' = 'carros';
    if (categoryId) {
        const cat = categories.find(c => c.id === categoryId);
        if (cat && cat.fipeType !== 'none') {
            type = cat.fipeType;
        }
    }
    setCurrentType(type);
    setStep(1); 
    setSearchTerm('');
    setSelectedBrand(null);
    setSelectedModel(null);
    setLoading(true); 
    setIsOpen(true);
    
    const brands = await fipeService.getBrands(type);
    setList(brands); 
    setLoading(false);
  };

  const handleSelection = async (item: FipeReference, onComplete: (model: string, year: string, price?: number) => void) => {
      setSearchTerm('');
      
      if (step === 1) {
          setSelectedBrand(item);
          setLoading(true);
          const models = await fipeService.getModels(currentType, item.codigo);
          setList(models);
          setStep(2);
          setLoading(false);
      } else if (step === 2) {
          setSelectedModel(item);
          setLoading(true);
          const years = await fipeService.getYears(currentType, selectedBrand!.codigo, item.codigo);
          setList(years);
          setStep(3);
          setLoading(false);
      } else if (step === 3) {
          setLoading(true);
          const details = await fipeService.getDetails(currentType, selectedBrand!.codigo, selectedModel!.codigo, item.codigo);
          const yearStr = item.nome.replace(/\D/g, '');
          
          let priceNum: number | undefined;
          if (details?.Valor) {
              // Convert "R$ 50.000,00" to 50000
              priceNum = parseFloat(details.Valor.replace(/[^\d,]/g, '').replace(',', '.'));
          }

          onComplete(`${selectedBrand?.nome} ${selectedModel?.nome}`, yearStr, priceNum);
          setLoading(false);
          setIsOpen(false);
      }
  };

  const handleBack = async () => {
      setSearchTerm('');
      if (step === 2) {
          setLoading(true);
          const brands = await fipeService.getBrands(currentType);
          setList(brands);
          setStep(1);
          setSelectedBrand(null);
          setLoading(false);
      } else if (step === 3) {
          setLoading(true);
          const models = await fipeService.getModels(currentType, selectedBrand!.codigo);
          setList(models);
          setStep(2);
          setSelectedModel(null);
          setLoading(false);
      }
  };

  const filteredList = useMemo(() => {
      const term = searchTerm.toLowerCase();
      return list.filter(item => item.nome.toLowerCase().includes(term));
  }, [list, searchTerm]);

  return {
    isOpen, setIsOpen,
    step,
    loading,
    searchTerm, setSearchTerm,
    currentType,
    selectedBrand,
    selectedModel,
    filteredList,
    startSearch,
    handleSelection,
    handleBack
  };
};
