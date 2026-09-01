
import { useCallback, useRef, useState } from 'react';
import { geocodingService } from '../../../services/geocoding';
import { LocationHistory } from '../../../types';

// Chave baseada em coordenadas — garante que mudar lat/lon força nova geocodificação,
// mesmo que o tagId (item.id) permaneça o mesmo.
export const coordKey = (item: Pick<LocationHistory, 'lat' | 'lon'>) =>
  `${item.lat.toFixed(4)},${item.lon.toFixed(4)}`;

export const useAddressResolver = () => {
  const [resolvedAddresses, setResolvedAddresses] = useState<Record<string, string>>({});
  const resolvedRef = useRef<Record<string, string>>({});
  const attemptedRef = useRef(new Set<string>());

  // Resolve endereço de um item específico (se ainda não resolvido para estas coords)
  const resolveAddress = useCallback(async (item: LocationHistory) => {
    const key = coordKey(item);
      if (item.address || resolvedRef.current[key] || attemptedRef.current.has(key)) return;
      attemptedRef.current.add(key);
      try {
          const address = await geocodingService.reverseGeocode(item.lat, item.lon);
          // O serviço retorna coordenadas quando todos os provedores falham.
          // Não as apresentamos como endereço, nem tentamos novamente em loop.
          const fallback = `${item.lat.toFixed(6)}, ${item.lon.toFixed(6)}`;
          const value = address === fallback ? 'Endereço indisponível' : address;
          resolvedRef.current[key] = value;
          setResolvedAddresses(previous => ({ ...previous, [key]: value }));
      } catch {
          resolvedRef.current[key] = 'Endereço indisponível';
          setResolvedAddresses(previous => ({ ...previous, [key]: 'Endereço indisponível' }));
      }
  }, []);

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
      resolvedRef.current[id] = address;
      setResolvedAddresses(prev => ({ ...prev, [id]: address }));
  };

  return { resolvedAddresses, resolveAddress, resolveBatch, addResolvedAddress };
};
