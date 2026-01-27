
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role?: 'admin' | 'moderator' | 'user' | 'client';
  status?: 'pending' | 'approved' | 'rejected';
  ip?: string;
  companySlug?: string;
  createdAt?: number;
  cpf?: string; 
  avatarInitial?: string;
}

export interface Company {
  id: string;
  name: string;
  prefix: string;
}

export interface VehicleCategory {
  id: string;
  name: string;
  fipeType: 'carros' | 'motos' | 'caminhoes' | 'none';
}

export type TagType = 'K_TAG' | 'XADTAG';

export interface Tag {
  id: string;
  name: string;
  type: TagType;
  accessoryId: string;
  hashedAdvKey?: string;
  privateKey?: string;
  imei?: string;
  traqcareId?: string;
  isActivated?: boolean;
  lastBattery?: number;
  batteryWarrantyYears?: number;
  createdAt: number;
}

export interface Client {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  hasAccess?: boolean;
  createdAt: number;
  // Security Index
  cpfHash?: string;
}

export interface Vehicle {
  id: string;
  type: string;
  plate: string;
  model: string;
  year?: string;
  color?: string;
  tagId?: string;
  companyId?: string;
  clientId?: string;
  status?: 'active' | 'stolen' | 'maintenance';
  installationType?: 'tag_only' | 'tag_tracker';
  ownershipStatus?: 'leased' | 'purchased'; // leased = Comodato, purchased = Adquirido
  createdAt: number;
  updatedBy?: string;
  chassis?: string;
  fipeCode?: string;
  hinovaId?: string;
  // Security Index
  plateHash?: string;
}

export interface LocationHistory {
  id: string;
  tagId: string;
  lat: number;
  lon: number;
  conf: number;
  status: number;
  timestamp: number;
  isodatetime: string;
}

// Result format for location fetching APIs
export interface KTagLocationResult {
  lat: number;
  lon: number;
  conf: number;
  status: number;
  timestamp: number;
  isodatetime: string;
}

// Record for vehicle theft/robbery incidents
export interface StolenRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  type: 'theft' | 'robbery';
  timestamp: number;
  status: 'open' | 'recovered';
  location: { lat: number; lon: number; address: string };
  policeReport?: string;
  notes?: string;
  recoveredAt?: number;
}

export interface AppNotification {
  id: string;
  type: 'error' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REPORT' | 'LOGIN' | 'CONFIG';
  entity: string;
  entityId?: string;
  details: string;
  timestamp: number;
}

export interface AppSettings {
  language: 'pt' | 'en';
  customProxyUrl: string;
  ktagUrl: string;
  ktagUser: string;
  ktagPass: string;
  traqcareToken: string;
  googleMapsKey: string;
  mapboxKey: string;
  hinovaUrl: string;
  hinovaToken: string;
  hinovaUser: string;
  hinovaPass: string;
  // Added properties for Plate API configuration
  plateApiUrl?: string;
  plateApiToken?: string;
  // Inventory Levels
  minStockLevel?: number;
  criticalStockLevel?: number;
  // Financeiro
  budgetMarginThreshold?: number; // Porcentagem padrão para aprovação (ex: 25)
}

// --- NEW TYPES FOR SCHEDULING SYSTEM ---

export type ScheduleStatus = 'Solicitada' | 'Em análise' | 'Em orçamento' | 'Autorizada' | 'Confirmada' | 'Reagendada' | 'Técnico no local' | 'Cancelada' | 'Concluída';
export type DeviceType = 'Rastreador' | 'Rastreador + Tag' | 'Tag';
export type ServiceType = 'Instalação' | 'Manutenção' | 'Retirada' | 'Vistoria';

export interface Technician {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  color?: string; // Hex color for calendar
  serviceRates?: {
    installation: number;
    maintenance: number;
    removal: number;
    inspection: number;
  };
}

export interface ScheduleHistory {
  actionBy: string; // User Name
  action: string; // "Confirmou", "Reagendou", "Solicitou"
  timestamp: number;
  details?: string;
  statusSnapshot?: string;
}

export interface Schedule {
  id: string;
  requesterId: string;
  requesterName: string; // Operador/Usuário do sistema
  
  // Client Data (Optional - from SGA)
  clientName?: string; // Nome do Cliente Final (Dono do veículo)
  clientPhone?: string;

  // Vehicle Data
  vehiclePlate: string;
  vehicleModel: string;
  fipeValue: string; // Formatted R$ string
  deviceType: DeviceType;
  serviceType: ServiceType;
  companyId?: string; // ID da Regional/Empresa

  // Preferences
  preferredDate: string; // YYYY-MM-DD
  preferredTime: string; // HH:mm
  notes?: string; // Observações adicionais
  cancellationReason?: string; // Motivo do cancelamento
  
  // Operational Checks
  needsInspection?: boolean; // Vistoria
  paymentOnSite?: boolean; // Pagamento no local
  installedImei?: string; // IMEI do equipamento instalado (Opcional ao finalizar)

  // Remote / Displacement
  isRemoteLocation?: boolean; // Local distante
  displacementKm?: number; // Total KM ida e volta
  displacementValue?: number; // Valor R$ do deslocamento
  
  // Financeiro (Orçamento)
  adhesionValue?: number; // Valor negociado/adesão

  // Location
  locationAddress: string;
  locationLat: number;
  locationLng: number;

  // Status & Assignment
  status: ScheduleStatus;
  technicianId?: string;
  confirmedDate?: string; // YYYY-MM-DD
  confirmedTime?: string; // HH:mm
  
  history: ScheduleHistory[];
  createdAt: number;
  analysisStartedAt?: number; // Para resetar o timer quando entrar em análise
}
