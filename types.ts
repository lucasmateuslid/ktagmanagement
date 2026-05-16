
export interface CustomRole {
  id: string;
  name: string;
  isSystem?: boolean;
  permissions: string[];
}

export interface UserNotificationPreferences {
  newTechnicalRequest: boolean;
  serviceCompleted: boolean;
  theftRegistered: boolean;
  newComment: boolean;
  schedulingNeedsConfirmation: boolean;
  schedulingNeedsCompletion: boolean;
  schedulingUpdates: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** @deprecated A senha é gerenciada pelo Firebase Auth desde a Fase 2 — nunca persistir no Firestore. */
  password?: string;
  role?: 'admin' | 'moderator' | 'user' | 'client' | 'technician' | 'admin_tecnico' | 'superadmin' | string;
  customRoleId?: string;
  technicianId?: string;
  status?: 'pending' | 'approved' | 'rejected';
  ip?: string;
  tenantId?: string;
  companySlug?: string; // @deprecated — substituído por tenantId; mantido por compat até migração concluir
  exemptFromKtagAlert?: boolean;
  createdAt?: number;
  cpf?: string;
  avatarInitial?: string;
  avatarUrl?: string;
  pixKey?: string;
  notificationPreferences?: UserNotificationPreferences;
}

export type TenantPlan = 'basic' | 'pro' | 'enterprise';

export interface TenantIntegrationFlags {
  ktag?: { enabled: boolean };
  hinova?: { enabled: boolean };
  melhorEnvio?: { enabled: boolean };
  ai?: { provider?: string };
}

export interface TenantSettings {
  maxUsers?: number;
  features?: string[];
  integrations?: TenantIntegrationFlags;
}

export type BillingStatus =
  | 'none'        // sem assinatura criada ainda
  | 'trialing'    // trial, sem cobrança
  | 'active'      // em dia
  | 'overdue'     // tem fatura vencida
  | 'canceled';   // cancelada

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type BillingMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';

export interface TenantBilling {
  status: BillingStatus;
  /** Valor em centavos. Override quando definido; senão pega do plano. */
  priceCents?: number;
  cycle?: BillingCycle;
  method?: BillingMethod;
  /** Dia do mês para vencimento (1-28). */
  dueDay?: number;
  nextDueDate?: number;
  /** IDs do Asaas — null indica que ainda não foi sincronizado. */
  asaasCustomerId?: string | null;
  asaasSubscriptionId?: string | null;
  /** CPF/CNPJ do responsável pelo pagamento (obrigatório no Asaas). */
  payerCpfCnpj?: string;
  payerName?: string;
  payerEmail?: string;
  /** Última sync bem-sucedida com Asaas (epoch ms). */
  lastSyncedAt?: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  active: boolean;
  ownerUserId?: string;
  createdAt: number;
  settings?: TenantSettings;
  billing?: TenantBilling;
}

export type InvoiceStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'CANCELED';

/** Espelho de um charge (payment) do Asaas no Firestore. */
export interface Invoice {
  id: string;                 // = asaasPaymentId
  tenantId: string;
  status: InvoiceStatus;
  /** Valor em centavos. */
  valueCents: number;
  dueDate: number;            // epoch ms
  paidAt?: number;
  billingType: BillingMethod;
  invoiceUrl?: string;        // página de pagamento Asaas
  bankSlipUrl?: string;       // boleto PDF
  pixQrCode?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

/** Plano centralizado em /system_config/plans. */
export interface PlanConfig {
  id: TenantPlan;
  name: string;
  priceCents: number;
  maxUsers: number;
  features: string[];
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
  powerType?: 'battery' | '12v';
  isActivated?: boolean;
  lastBattery?: number;
  batteryWarrantyYears?: number;
  status?: 'disponível' | 'enviada' | 'em_uso' | 'manutencao';
  shipmentId?: string;
  createdAt: number;
}

export interface Tracker {
  id: string;
  imei: string;
  model: string;
  status: 'disponível' | 'enviado' | 'em_uso' | 'manutencao';
  shipmentId?: string;
  createdAt: number;
}

export type ShipmentStatus = 'rascunho' | 'ativo' | 'enviado' | 'entregue' | 'cancelado';
export type ShipmentItemType = 'tag' | 'rastreador' | 'outro';

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  tipo: ShipmentItemType;
  tagId?: string;
  rastreadorId?: string;
  placa?: string;
  veiculoInfo?: {
    placa: string;
    modelo: string;
    cor: string;
    proprietario: string;
  };
  quantidade: number;
  observacoes?: string;
}

export interface Shipment {
  id: string;
  titulo: string;
  codigoRemessa?: string;
  status: ShipmentStatus;
  consultorId: string;
  consultorNome: string;
  destinatario: {
    nome: string;
    enderecoCompleto: string;
    lat: number;
    lng: number;
    placeId?: string;
  };
  codigoRastreio?: string;
  transportadora?: string;
  dataCriacao: number;
  dataEnvio?: number;
  dataEntrega?: number;
  observacoes?: string;
  itens: ShipmentItem[];
  createdBy: string;
  updatedAt: number;
  melhorEnvio?: {
    orderId?: string;
    status?: string;
    tracking?: string;
    price?: number;
    deliveryTime?: number;
    serviceId?: number;
    urlPrint?: string;
  };
}

export interface ShippingAddress {
  id: string;
  consultorId: string;
  apelido: string;
  enderecoCompleto: string;
  lat: number;
  lng: number;
  placeId?: string;
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

export type DisplayLimit = 10 | 30 | 50 | 100 | 200 | 'all';

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
  createdBy?: string;
  createdByName?: string;
  requiresTagReview?: boolean;
  tagReviewUrgentUntil?: number;
  fipeCode?: string;
  fipeValue?: number;
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
  status: 'open' | 'recovered' | 'lost';
  location: { lat: number; lon: number; address: string };
  policeReport?: string;
  notes?: string;
  stolenValue?: number;
  recoveredValue?: number;
  recoveredAt?: number;
  lostAt?: number;
  trackingToken?: string;
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

export interface ShippingPackage {
  id: string;
  name: string;
  weight: number;
  width: number;
  height: number;
  length: number;
  insuranceValue: number;
}

export interface ShippingAddress {
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  document: string;
  name: string;
  phone: string;
  email?: string;
}

export interface GeocoderProviderConfig {
  enabled: boolean;
  api_key: string | null;
}

export interface GeocoderPreferences {
  priority_order: string[];
  providers: Record<string, GeocoderProviderConfig>;
  confidence_threshold: number;
  fallback_on_empty: boolean;
  fallback_on_low_confidence: boolean;
  country_filter: string;
  default_language: string;
}

export interface ThemeColors {
  primaryColor?: string;
  titleColorLight?: string;
  titleColorDark?: string;
  buttonTextColor?: string;
  cardBgLight?: string;
  cardBgDark?: string;
  pageBgLight?: string;
  pageBgDark?: string;
  chartColors?: string;
}

export interface AppSettings {
  language: 'pt' | 'en';
  customProxyUrl: string;
  geocoderPreferences?: GeocoderPreferences;
  customAppName?: string;
  customLogoUrlLight?: string;
  customLogoUrlDark?: string;
  themeColors?: ThemeColors;
  ktagUrl: string;
  ktagUser: string;
  ktagPass: string;
  traqcareToken: string;
  googleMapsKey: string;
  mapboxKey: string;
  geocodingProvider?: 'osm' | 'google';
  schedulingMapProvider?: 'osm' | 'google';
  livemapMapProvider?: 'osm' | 'google';
  hinovaUrl: string;
  hinovaToken: string;
  hinovaUser: string;
  hinovaPass: string;
  plateApiUrl?: string;
  plateApiToken?: string;
  aiProvider?: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek';
  geminiApiKey?: string;
  openAiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  deepseekApiKey?: string;
  minStockLevel?: number;
  criticalStockLevel?: number;
  budgetMarginThreshold?: number; 
  siteRastreioApiKey?: string;
  melhorEnvioEnvironment?: 'sandbox' | 'production';
  melhorEnvioSandboxClientId?: string;
  melhorEnvioSandboxClientSecret?: string;
  melhorEnvioSandboxToken?: string;
  melhorEnvioSandboxRefreshToken?: string;
  melhorEnvioSandboxExpiresAt?: number;
  melhorEnvioProdClientId?: string;
  melhorEnvioProdClientSecret?: string;
  melhorEnvioProdToken?: string;
  melhorEnvioProdRefreshToken?: string;
  melhorEnvioProdExpiresAt?: number;
  // Legacy fields (keep for fallback/migration)
  melhorEnvioClientId?: string;
  melhorEnvioClientSecret?: string;
  melhorEnvioToken?: string;
  melhorEnvioRefreshToken?: string;
  melhorEnvioExpiresAt?: number;
  // WhatsApp / Evolution API
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstanceName?: string;
  enableWhatsAppNotifications?: boolean;
  // Shipping Preferences
  melhorEnvioSenderAddress?: ShippingAddress;
  melhorEnvioPackages?: ShippingPackage[];
  
  // App Announcement
  announcement?: AppAnnouncement;
}

export interface AppAnnouncement {
  title: string;
  message: string;
  isActive: boolean;
  targetRoles: string[]; // e.g. ['all'] or ['admin', 'manager', 'custom_role_id']
  color?: string;
}

export type ScheduleStatus = 'Solicitada' | 'Em análise' | 'Em orçamento' | 'Autorizada' | 'Confirmada' | 'Reagendada' | 'Técnico no local' | 'Cliente no local' | 'Em andamento' | 'Cancelada' | 'Concluída' | 'Frustrada' | 'Aguardando Vínculo';
export type DeviceType = 'Rastreador' | 'Rastreador + Tag' | 'Tag' | 'Não precisa';
export type ServiceType = 'Instalação' | 'Manutenção' | 'Retirada' | 'Vistoria';

export interface TechnicianPayment {
  id: string;
  technicianId: string;
  amount: number;
  date: number;
  proofUrl?: string;
  type: 'salary_deduction' | 'return';
  status: 'pending' | 'paid';
  scheduleIds: string[]; // Services covered by this payment
}

export interface Technician {
  id: string;
  name: string;
  email?: string;
  phone: string;
  cpf?: string;
  pixKey?: string;
  active: boolean;
  color?: string; 
  serviceLocationType?: 'Ponto Fixo' | 'Domicílio';
  services?: string[]; // Lista de DeviceTypes que o técnico atende
  unavailableDates?: string[]; // Array de datas ISO (YYYY-MM-DD)
  serviceRates?: {
    installation: number;
    maintenance: number;
    removal: number;
    inspection: number;
    tagInstallation?: number;
    tagRemoval?: number;
    tagExchange?: number;
  };
  balanceInHand?: number; // Added for financial tracking
}

export interface ScheduleHistory {
  actionBy: string; 
  action: string; 
  timestamp: number;
  details?: string;
  statusSnapshot?: string;
}

export type ChecklistStatus = 'OK' | 'N/OK' | 'N/A' | '';

export interface ChecklistItem {
  name: string;
  before: ChecklistStatus;
  after: ChecklistStatus;
}

export const defaultChecklistItems = [
  'Partida elétrica', 'Setas', 'Pisca alerta', 'Farol baixo', 'Farol alto',
  'Lanterna', 'Luz de freio', 'Buzina', 'Iluminação do painel', 'Luzes de painel',
  'Limpadores', 'Ar condicionado', 'Vidro elétrico', 'Iluminação cortesia',
  'Rádio/CD/MP3', 'Luz de ré', 'Trava elétrica', 'Bloqueio', 'Retrovisor elétrico',
  'Teto solar', 'Desembaçador traseiro', 'Câmera de ré'
];

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
  installedTagImei?: string;
  isRemoteLocation?: boolean; 
  financialObs?: string;
  osNumber?: string;
  osDetails?: string;
  osSignature?: string;
  checklist?: ChecklistItem[];
  displacementKm?: number; 
  displacementValue?: number; 
  adhesionValue?: number; 
  technicianPaid?: boolean;
  technicianPaymentAmount?: number;
  technicianPaymentDate?: string;
  amountReceivedByTechnician?: number; // Dinheiro em mãos (recebido do cliente)
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
