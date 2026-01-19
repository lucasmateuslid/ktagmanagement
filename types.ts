
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
  createdAt: number;
  updatedBy?: string;
  // Added properties for Hinova and Plate API integrations
  chassis?: string;
  fipeCode?: string;
  hinovaId?: string;
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
}
