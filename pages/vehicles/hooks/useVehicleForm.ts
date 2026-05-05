
import React, { useState, useMemo, useCallback } from 'react';
import { Vehicle, Client, User } from '../../../types';
import { storage } from '../../../services/storage';
import { useNotification } from '../../../contexts/NotificationContext';
import { validateBrazilianPlate } from '../utils/plateValidation';

export const useVehicleForm = (
  vehicles: Vehicle[],
  clients: Client[], 
  currentUser: User | null, 
  onSuccess: () => void
) => {
  const { addNotification } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Vehicle>>({ status: 'active', installationType: 'tag_only', ownershipStatus: 'leased' });
  const [clientData, setClientData] = useState<Partial<Client>>({ hasAccess: false });
  const [tagSearch, setTagSearch] = useState('');

  // Auto-fill existing client data
  const checkExistingClient = useCallback((cpf: string) => {
    if (!cpf) return;
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length < 11) return;
    const existing = clients.find(c => c.cpf.replace(/\D/g, '') === cleanCpf);
    if (existing) {
        setClientData(existing);
        addNotification('info', 'Banco de Dados', `Cliente ${existing.name} já cadastrado. Dados carregados.`);
    }
  }, [clients, addNotification]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPlateValid = validateBrazilianPlate(formData.plate || '');
    
    if (!isPlateValid) {
      addNotification('error', 'Placa Inválida', 'Por favor, corrija o formato da placa (ex: AAA0000).');
      return;
    }
    if (!formData.plate || !formData.model || !clientData.cpf) return;

    const currentPlate = formData.plate.toUpperCase();
    const samePlates = vehicles.filter(v => v.plate === currentPlate && v.id !== formData.id);

    if (samePlates.length > 0) {
      const hasComodato = samePlates.some(v => v.ownershipStatus === 'leased') || formData.ownershipStatus === 'leased';
      if (hasComodato) {
        addNotification('error', 'Placa Duplicada', 'Não é possível cadastrar: Essa placa já possui cadastro e para o modelo COMODATO é permitido apenas um cadastro por placa.');
        return;
      }
    }

    const cleanCpf = clientData.cpf.replace(/\D/g, '');
    const existingClient = clients.find(c => c.cpf.replace(/\D/g, '') === cleanCpf);

    let finalClientId = existingClient ? existingClient.id : (clientData.id || crypto.randomUUID());
    const clientToSave: Client = {
        ...clientData as Client, 
        id: finalClientId, 
        createdAt: clientData.createdAt || Date.now()
    };
    await storage.saveClient(clientToSave);

    const vehicleId = formData.id || crypto.randomUUID();
    const isNew = !formData.id;
    const vehicleToSave: Vehicle = {
        ...formData as Vehicle, 
        id: vehicleId, 
        clientId: finalClientId,
        plate: formData.plate.toUpperCase(), 
        createdAt: formData.createdAt || Date.now(),
        updatedBy: currentUser?.name || 'SISTEMA',
        createdBy: formData.createdBy || currentUser?.id,
        createdByName: formData.createdByName || currentUser?.name,
        ownershipStatus: formData.ownershipStatus || 'leased'
    };
    await storage.saveVehicle(vehicleToSave);
    
    // Auditoria
    storage.logAction(
        currentUser, 
        isNew ? 'CREATE' : 'UPDATE', 
        'Vehicle', 
        `${isNew ? 'Cadastrou' : 'Editou'} veículo: ${vehicleToSave.plate}`, 
        vehicleId
    );

    addNotification('success', 'Sucesso', 'Veículo gravado no sistema.');
    setIsModalOpen(false); 
    onSuccess();
  };

  const openNew = () => {
      setFormData({ status: 'active', installationType: 'tag_only', type: 'cat-car', ownershipStatus: 'leased' }); 
      setClientData({ hasAccess: false }); 
      setTagSearch(''); 
      setIsModalOpen(true);
  };

  const openEdit = (v: Vehicle, tags: any[]) => {
      setFormData(v); 
      setClientData(clients.find(c => c.id === v.clientId) || {}); 
      setTagSearch(tags.find(t => t.id === v.tagId)?.accessoryId || ''); 
      setIsModalOpen(true);
  };

  return {
    isModalOpen, setIsModalOpen,
    formData, setFormData,
    clientData, setClientData,
    tagSearch, setTagSearch,
    handleSave,
    checkExistingClient,
    openNew,
    openEdit
  };
};