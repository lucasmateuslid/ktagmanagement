
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
  type: TagType; // Novo: Identificador do hardware
  
  // Campos K-TAG
  accessoryId: string; // Também usado como identificador visual para XADTAG
  hashedAdvKey?: string;
  privateKey?: string;
  
  // Campos XADTAG (Traqcare)
  imei?: string;
  traqcareId?: string;
  isActivated?: boolean;
  lastBattery?: number;
  
  macAddress?: string;
  batteryWarrantyYears?: number;
  warrantyStartedAt?: number;
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
}

export interface Vehicle {
  id: string;
  type: string;
  plate: string;
  model: string;
  year?: string;
  fipeCode?: string;
  color?: string;
  chassis?: string;
  tagId?: string;
  companyId?: string;
  clientId?: string;
  hinovaId?: string;
  status?: 'active' | 'stolen' | 'maintenance';
  installationType?: 'tag_only' | 'tag_tracker';
  createdAt: number;
  updatedBy?: string;
}

export interface StolenRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  type: 'theft' | 'robbery';
  timestamp: number;
  location: {
    lat: number;
    lon: number;
    address?: string;
  };
  policeReport?: string;
  notes?: string;
  status: 'open' | 'recovered';
  recoveredAt?: number;
}

export interface KTagLocationResult {
  lat: number;
  lon: number;
  conf: number;
  status: number;
  timestamp: number;
  isodatetime: string;
  key: string;
}

export interface LocationHistory extends KTagLocationResult {
  tagId: string;
  id: string;
}

export interface DashboardStats {
  totalTags: number;
  totalVehicles: number;
  linkedTags: number;
  onlineTags: number;
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
  // Novo: Configuração Traqcare
  traqcareToken: string;
  googleMapsKey: string;
  mapboxKey: string;
  plateApiUrl: string;
  plateApiToken: string;
  hinovaUrl: string;
  hinovaToken: string;
  hinovaUser: string;
  hinovaPass: string;
}
