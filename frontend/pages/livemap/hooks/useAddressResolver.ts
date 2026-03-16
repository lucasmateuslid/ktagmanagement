
import { useState } from 'react';
import { geocodingService } from '../../../services/geocoding';
import { LocationHistory } from '../../../types';

export const useAddressResolver = () => {
  const [resolvedAddresses, setResolvedAddresses] = useState<Record<string, string>>({});

  // Resolve endereço de um item específico (se ainda não resolvido)
  const resolveAddress = async (item: LocationHistory) => {
      if (!resolvedAddresses[item.id]) {
          try {
              const addr = await geocodingService.reverseGeocode(item.lat, item.lon);
              setResolvedAddresses(prev => ({ ...prev, [item.id]: addr }));
          } catch {
              // Ignore errors
          }
      }
  };

  // Resolve múltiplos endereços (ex: para histórico)
  const resolveBatch = async (items: LocationHistory[]) => {
      const newAddresses: Record<string, string> = {};
      
      await Promise.all(items.map(async (item) => {
          if (!resolvedAddresses[item.id]) {
              try {
                  const addr = await geocodingService.reverseGeocode(item.lat, item.lon);
                  newAddresses[item.id] = addr;
              } catch {
                  newAddresses[item.id] = "Endereço indisponível";
              }
          }
      }));

      if (Object.keys(newAddresses).length > 0) {
          setResolvedAddresses(prev => ({ ...prev, ...newAddresses }));
      }
  };

  // Atualizador manual de estado (usado na exportação)
  const addResolvedAddress = (id: string, address: string) => {
      setResolvedAddresses(prev => ({ ...prev, [id]: address }));
  };

  return { resolvedAddresses, resolveAddress, resolveBatch, addResolvedAddress };
};
