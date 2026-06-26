
import { useState, useEffect } from 'react';
import { storage } from '../../../services/storage';
import { Tag, Vehicle, VehicleCategory, Client, User } from '../../../types';

export const useFleetData = (user: User | null) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    let unsubscribe = () => {};

    const loadInitialData = async () => {
        const [allTags, allCategories, allClients] = await Promise.all([
          storage.getTags(),
          storage.getCategories(),
          storage.getClients()
        ]);
        
        setTags(allTags);
        setCategories(allCategories);
        setClients(allClients);

        // Inscrição em tempo real para veículos (recebe atualizações do Cloud Function)
        unsubscribe = storage.subscribeVehicles((allVehicles) => {
          let filteredVehicles = allVehicles;
          
          if (user?.role === 'client' && user?.cpf) {
            const myClientData = allClients.find(c => c.cpf.replace(/\D/g, '') === user.cpf);
            if (myClientData) {
              filteredVehicles = allVehicles.filter(v => v.clientId === myClientData.id);
              setVehicles(filteredVehicles);
            } else {
              setVehicles([]);
            }
          } else {
            setVehicles(allVehicles);
          }
        });
    };
    
    if (user) {
      loadInitialData();
    }

    return () => unsubscribe();
  }, [user]);

  return { tags, vehicles, categories, clients };
};
