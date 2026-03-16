
import { Vehicle, Tag, Company, VehicleCategory, Client } from '../../../types';

export const mapVehiclesToExportData = (
  vehicles: Vehicle[],
  tags: Tag[],
  companies: Company[],
  categories: VehicleCategory[],
  clients: Client[]
) => {
  return vehicles.map(v => {
    const client = clients.find(c => c.id === v.clientId);
    const category = categories.find(c => c.id === v.type);
    const company = companies.find(c => c.id === v.companyId);
    const tag = tags.find(t => t.id === v.tagId);
    
    return {
      'Placa': v.plate,
      'Status': v.status === 'active' ? 'Ativo' : v.status === 'stolen' ? 'Roubado' : 'Manutenção',
      'Modelo': v.model,
      'Ano': v.year || '-',
      'Categoria': category?.name || '-',
      'Regional': company?.name || '-',
      'Cliente': client?.name || 'Sem Vínculo',
      'CPF Cliente': client?.cpf || '-',
      'Equipamento': v.installationType === 'tag_tracker' ? 'Tag + Rastreador' : 'Só Tag',
      'Propriedade': v.ownershipStatus === 'purchased' ? 'Adquirido' : 'Comodato',
      'ID Tag': tag?.accessoryId || '-',
      'Cadastrado por': v.updatedBy || 'SISTEMA',
      'Data Cadastro': new Date(v.createdAt).toLocaleDateString()
    };
  });
};
