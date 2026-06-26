
import { useState } from 'react';
import { geocodingService } from '../../../services/geocoding';
import { LocationHistory } from '../../../types';

// Chave baseada em coordenadas — garante que mudar lat/lon força nova geocodificação,
// mesmo que o tagId (item.id) permaneça o mesmo.
export const coordKey = (item: Pick<LocationHistory, 'lat' | 'lon'>) =>
  `${item.lat.toFixed(4)},${item.lon.toFixed(4)}`;

export const useAddressResolver = () => {
  const [resolvedAddresses, setResolvedAddresses] = useState<Record<string, string>>({});

  // Resolve endereço de um item específico (se ainda não resolvido para estas coords)
  const resolveAddress = async (item: LocationHistory) => {
      const key = coordKey(item);
      if (!resolvedAddresses[key]) {
          try {
              const addr = await geocodingService.reverseGeocode(item.lat, item.lon);
              setResolvedAddresses(prev => ({ ...prev, [key]: addr }));
          } catch {
              // Ignore errors
          }
      }
  };

  // Resolve múltiplos endereços (ex: para histórico)
  const resolveBatch = async (items: LocationHistory[]) => {
      const newAddresses: Record<string, string> = {};

      await Promise.all(items.map(async (item) => {
          const key = coordKey(item);
          if (!resolvedAddresses[key]) {
              try {
                  const addr = await geocodingService.reverseGeocode(item.lat, item.lon);
                  newAddresses[key] = addr;
              } catch {
                  newAddresses[key] = "Endereço indisponível";
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
