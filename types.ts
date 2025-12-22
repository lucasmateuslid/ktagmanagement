
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role?: 'admin' | 'moderator' | 'user' | 'client'; // Adicionado 'client'
  status?: 'pending' | 'approved' | 'rejected';
  ip?: string;
  companySlug?: string;
  createdAt?: number;
  cpf?: string; // CPF vinculado para login de clientes
  avatarInitial?: string; // Nova: Inicial customizada para o avatar
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

// Added missing Tag interface used for tracking hardware
export interface Tag {
  id: string;
  name: string;
  accessoryId: string;
  hashedAdvKey: string;
  privateKey: string;
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
  hasAccess?: boolean; // Novo: Indica se o cliente tem login
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
  googleMapsKey: string;
  mapboxKey: string;
  plateApiUrl: string;
  plateApiToken: string;
  hinovaUrl: string;
  hinovaToken: string;
  hinovaUser: string;
  hinovaPass: string;
}
