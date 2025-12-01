
export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'user';
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
  type: 'Car' | 'Truck' | 'Motorcycle' | 'Other';
  plate: string;
  model: string;
  year?: string;
  fipeCode?: string;
  tagId?: string; // Optional link to a tag
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

export interface AppSettings {
  language: 'pt' | 'en';
  customProxyUrl: string; // URL for the Firebase Cloud Function
  ktagUrl: string;
  ktagUser: string;
  ktagPass: string;
  googleMapsKey: string;
  mapboxKey: string;
}
