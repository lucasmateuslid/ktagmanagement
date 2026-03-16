
import { useState, useEffect } from 'react';
import { storage } from '../../../services/storage';
import { Tag, Vehicle, VehicleCategory, Client, User } from '../../../types';

export const useFleetData = (user: User | null) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const loadData = async () => {
        let [allTags, allVehicles, allCategories, allClients] = await Promise.all([
          storage.getTags(), 
          storage.getVehicles(),
          storage.getCategories(),
          storage.getClients()
        ]);
        
        // Regra de Cliente: Filtra apenas os próprios veículos
        if (user?.role === 'client' && user?.cpf) {
          const myClientData = allClients.find(c => c.cpf.replace(/\D/g, '') === user.cpf);
          if (myClientData) {
            allVehicles = allVehicles.filter(v => v.clientId === myClientData.id);
            allTags = allTags.filter(t => allVehicles.some(v => v.tagId === t.id));
          }
        }
        
        setTags(allTags);
        setVehicles(allVehicles);
        setCategories(allCategories);
        setClients(allClients);
    };
    
    if (user) loadData();
  }, [user]);

  return { tags, vehicles, categories, clients };
};
