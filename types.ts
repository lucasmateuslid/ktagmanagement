
export interface UserNotificationPreferences {
  newTechnicalRequest: boolean;
  serviceCompleted: boolean;
  theftRegistered: boolean;
  newComment: boolean;
  schedulingNeedsConfirmation: boolean;
  schedulingNeedsCompletion: boolean;
}

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
  notificationPreferences?: UserNotificationPreferences;
}

export interface Company {
  id: string;
  name: string;
  prefix: string;
  hasSgaIntegration?: boolean;
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
  cpfHash?: string;
}

// K-Tag API v1.2 - Battery Info Structure
export interface KTagBatteryInfo {
  level: number;
  label: string;
  color: string;
}

export interface LocationHistory {
  id: string;
  tagId: string;
  lat: number;
  lon: number;
  conf: number;
  status: number; // Raw status from API
  battery?: KTagBatteryInfo; // Interpreted battery status
  timestamp: number;
  isodatetime: string;
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
  ownershipStatus?: 'leased' | 'purchased'; 
  createdAt: number;
  updatedBy?: string;
  chassis?: string;
  fipeCode?: string;
  hinovaId?: string;
  plateHash?: string;
  // New Field for Offline Persistence
  lastPosition?: LocationHistory; 
}

// Result format for location fetching APIs
export interface KTagLocationResult {
  lat: number;
  lon: number;
  conf: number;
  status: number;
  battery: KTagBatteryInfo;
  timestamp: number;
  isodatetime: string;
  distance?: number;
  tagId?: string;
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
  plateApiUrl?: string;
  plateApiToken?: string;
  minStockLevel?: number;
  criticalStockLevel?: number;
  budgetMarginThreshold?: number; 
}

export type ScheduleStatus = 'Solicitada' | 'Em análise' | 'Em orçamento' | 'Autorizada' | 'Confirmada' | 'Reagendada' | 'Técnico no local' | 'Cancelada' | 'Concluída';
export type DeviceType = 'Rastreador' | 'Rastreador + Tag' | 'Tag' | 'Não precisa';
export type ServiceType = 'Instalação' | 'Manutenção' | 'Retirada' | 'Vistoria';

export interface Technician {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  color?: string; 
  services?: string[]; // Lista de DeviceTypes que o técnico atende
  unavailableDates?: string[]; // Array de datas ISO (YYYY-MM-DD)
  serviceRates?: {
    installation: number;
    maintenance: number;
    removal: number;
    inspection: number;
  };
}

export interface ScheduleHistory {
  actionBy: string; 
  action: string; 
  timestamp: number;
  details?: string;
  statusSnapshot?: string;
}

export interface Schedule {
  id: string;
  requesterId: string;
  requesterName: string;
  clientName?: string; 
  clientPhone?: string;
  vehiclePlate: string;
  vehicleModel: string;
  fipeValue: string; 
  deviceType: DeviceType;
  serviceType: ServiceType;
  companyId?: string; 
  preferredDate: string; 
  preferredTime: string; 
  notes?: string; 
  cancellationReason?: string; 
  needsInspection?: boolean; 
  paymentOnSite?: boolean; 
  installedImei?: string; 
  isRemoteLocation?: boolean; 
  displacementKm?: number; 
  displacementValue?: number; 
  adhesionValue?: number; 
  locationAddress: string;
  locationLat: number;
  locationLng: number;
  status: ScheduleStatus;
  technicianId?: string;
  confirmedDate?: string; 
  confirmedTime?: string; 
  history: ScheduleHistory[];
  createdAt: number;
  analysisStartedAt?: number; 
}

export type FeedbackType = 'suggestion' | 'bug' | 'improvement';

export interface Feedback {
  id: string;
  userId: string;
  userName: string;
  type: FeedbackType;
  content: string;
  attachments?: string[]; 
  createdAt: number;
}

export interface SystemUpdate {
  id: string;
  version: string;
  title: string;
  content: string;
  date: number;
  type: 'feature' | 'fix' | 'announcement';
}
