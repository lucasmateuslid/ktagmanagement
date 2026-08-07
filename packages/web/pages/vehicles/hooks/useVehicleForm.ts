
import React, { useState, useMemo, useCallback } from 'react';
import { Vehicle, Client, User } from '../../../types';
import { storage } from '../../../services/storage';
import { useNotification } from '../../../contexts/NotificationContext';
import { validateBrazilianPlate } from '../utils/plateValidation';
import { isValidCPF } from '../../../utils/brDocument';

export const useVehicleForm = (
  vehicles: Vehicle[],
  clients: Client[], 
  currentUser: User | null, 
  onSuccess: () => void
) => {
  const { addNotification } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
    } else {
        // CPF não corresponde a NENHUM cliente. Se o formulário ainda carregava
        // a identidade de um cliente anterior (id + nome/telefone), descarta-a:
        // manter o id antigo aqui faria o save sobrescrever o cliente errado
        // (bug de cross-cliente). Preserva apenas o CPF digitado e o toggle de acesso.
        setClientData(prev => prev.id
          ? { hasAccess: prev.hasAccess, cpf }
          : { ...prev, cpf });
    }
  }, [clients, addNotification]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Idempotência: bloqueia reentrância (duplo-clique / rede lenta). Sem isto,
    // cada submit gerava um novo crypto.randomUUID() e criava veículo/cliente
    // duplicados em vez de sobrescrever o mesmo doc.
    if (isSaving) return;

    const isPlateValid = validateBrazilianPlate(formData.plate || '');

    if (!isPlateValid) {
      addNotification('error', 'Placa Inválida', 'Por favor, corrija o formato da placa (ex: AAA0000).');
      return;
    }
    if (!formData.plate || !formData.model || !clientData.cpf) return;
    if (!isValidCPF(clientData.cpf)) {
      addNotification('error', 'CPF inválido', 'Informe um CPF válido. Sequências repetidas não são aceitas.');
      return;
    }

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

    // GUARD DE INTEGRIDADE (anti cross-cliente):
    // Se o formulário ainda carrega o id de um cliente cujo CPF NÃO é o digitado,
    // salvar gravaria o conteúdo deste formulário por cima do cadastro de OUTRA
    // pessoa. Bloqueia e orienta a corrigir antes de sobrescrever.
    if (clientData.id) {
      const loaded = clients.find(c => c.id === clientData.id);
      if (loaded && loaded.cpf.replace(/\D/g, '') !== cleanCpf) {
        addNotification('error', 'Conflito de Cliente',
          'O CPF informado não corresponde ao cliente carregado no formulário. Limpe os dados do cliente e preencha novamente para não sobrescrever outro cadastro.');
        return;
      }
    }
    // id do cliente: reutiliza só quando o CPF aponta para um cliente existente
    // (ou para o id já fixado num retry). CPF novo => id fresco. Protegido pelo
    // guard acima, que garante que clientData.id nunca pertence a outro CPF.
    const finalClientId = existingClient ? existingClient.id : (clientData.id || crypto.randomUUID());
    const vehicleId = formData.id || crypto.randomUUID();

    // Só grava o doc do cliente quando é seguro:
    //  - cliente novo (CPF inédito), OU
    //  - o formulário estava de fato editando ESTE cliente (id confere).
    // Se o CPF aponta para um cliente existente que NÃO estava sendo editado
    // (ex.: aberto em branco e digitado o CPF dele), apenas VINCULAMOS o veículo
    // e preservamos os dados do cliente — nunca sobrescrevemos com o que está no form.
    const isEditingThisClient = !!existingClient && clientData.id === existingClient.id;
    const shouldWriteClient = !existingClient || isEditingThisClient;

    setIsSaving(true);
    try {
      if (shouldWriteClient) {
        const clientToSave: Client = {
            ...clientData as Client,
            id: finalClientId,
            createdAt: clientData.createdAt || existingClient?.createdAt || Date.now()
        };
        await storage.saveClient(clientToSave);
      }

      const vehicleToSave: Vehicle = {
          ...formData as Vehicle,
          id: vehicleId,
          clientId: finalClientId,
          plate: currentPlate,
          createdAt: formData.createdAt || Date.now(),
          updatedBy: currentUser?.name || 'SISTEMA',
          createdBy: formData.createdBy || currentUser?.id,
          createdByName: formData.createdByName || currentUser?.name,
          ownershipStatus: formData.ownershipStatus || 'leased'
      };
      // Fixa os ids no estado antes do write: se o write falhar e o usuário
      // tentar de novo, reaproveita o mesmo id (não duplica). Só fixa o id do
      // cliente quando de fato escrevemos o doc dele (no modo "apenas vincular"
      // não tocamos na identidade do cliente existente).
      if (shouldWriteClient) setClientData(prev => ({ ...prev, id: finalClientId }));
      setFormData(prev => ({ ...prev, id: vehicleId }));

      // storage.saveVehicle/saveClient já registram auditoria (CREATE/UPDATE) —
      // não duplicar o log aqui.
      await storage.saveVehicle(vehicleToSave);

      addNotification('success', 'Sucesso', 'Veículo gravado no sistema.');
      setIsModalOpen(false);
      onSuccess();
    } catch (err: any) {
      console.error('Falha ao salvar veículo:', err);
      addNotification('error', 'Erro', err?.message || 'Não foi possível salvar o veículo. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
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
    isSaving,
    formData, setFormData,
    clientData, setClientData,
    tagSearch, setTagSearch,
    handleSave,
    checkExistingClient,
    openNew,
    openEdit
  };
};
