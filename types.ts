
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Added for profile updates
  role?: 'admin' | 'moderator' | 'user';
  status?: 'pending' | 'approved' | 'rejected'; // Status da aprovação
  ip?: string; // IP do cadastro
  companySlug?: string; // Added for white-label branding
  createdAt?: number;
}

export interface Company {
  id: string;
  name: string;
  prefix: string; // Iniciais (ex: KTG para K-Tag)
}

export interface VehicleCategory {
  id: string;
  name: string; // Ex: Utilitário, Passeio
  fipeType: 'carros' | 'motos' | 'caminhoes' | 'none'; // Mapeamento para API FIPE
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
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  accessoryId: string;
  hashedAdvKey: string;
  privateKey: string;
  macAddress?: string; // Added MAC address
  createdAt: number;
}

export interface Vehicle {
  id: string;
  type: string; // Agora armazena o ID da VehicleCategory ou string legada
  plate: string;
  model: string;
  year?: string;
  fipeCode?: string;
  color?: string; // Added Color
  chassis?: string; // Added Chassis
  tagId?: string; // Optional link to a tag
  companyId?: string; // ID da empresa responsável
  clientId?: string; // ID do cliente (proprietário/associado)
  hinovaId?: string; // ID externo da Hinova
  status?: 'active' | 'stolen' | 'maintenance'; // Vehicle Status
  installationType?: 'tag_only' | 'tag_tracker'; // New field: Tipo de instalação
  createdAt: number; // Timestamp de criação
  updatedBy?: string; // Nome do usuário que cadastrou/atualizou
}

export interface StolenRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  type: 'theft' | 'robbery'; // Furto vs Roubo (Assalto)
  timestamp: number;
  location: {
    lat: number;
    lon: number;
    address?: string;
  };
  policeReport?: string; // BO
  notes?: string;
  status: 'open' | 'recovered';
  recoveredAt?: number;
}

// K-Tag API Response Shape
export interface KTagLocationResult {
  lat: number;
  lon: number;
  conf: number;
  status: number;
  timestamp: number; // UTC ms
  isodatetime: string;
  key: string;
}

export interface LocationHistory extends KTagLocationResult {
  tagId: string;
  id: string; // Internal ID
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
  entity: string; // e.g., 'Vehicle', 'Tag', 'User'
  entityId?: string;
  details: string;
  timestamp: number;
}

export interface AppSettings {
  language: 'pt' | 'en';
  customProxyUrl: string; // URL for the Firebase Cloud Function
  ktagUrl: string;
  ktagUser: string;
  ktagPass: string;
  googleMapsKey: string;
  mapboxKey: string;
  
  // Real Plate API Config
  plateApiUrl: string; // e.g. https://api.provider.com/v1/plate/{plate}
  plateApiToken: string;

  // Hinova API Config
  hinovaUrl: string;
  hinovaToken: string; // SGA Token (Initial)
  hinovaUser: string;  // Added: Usuario para autenticacao
  hinovaPass: string;  // Added: Senha para autenticacao
}