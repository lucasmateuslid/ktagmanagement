
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { storage } from '../services/storage';

type Language = 'pt' | 'en';

const translations = {
  en: {
    // Layout
    dashboard: 'Dashboard',
    liveMap: 'Live Map',
    tags: 'Tags',
    vehicles: 'Vehicles',
    settings: 'Settings',
    signOut: 'Sign Out',
    systemOnline: 'System Online',
    syncing: 'Syncing Data...',
    connectionError: 'Connection Error',
    offline: 'Offline Mode',
    notifications: 'Notifications',
    clearAll: 'Clear all',
    noNotifications: 'No notifications',

    // Dashboard
    overview: 'Dashboard Overview',
    quickActions: 'Quick Actions',
    recentActivity: 'Recent Activity',
    totalTags: 'Total Tags',
    totalVehicles: 'Total Vehicles',
    linkedTags: 'Linked Tags',
    unlinkedTags: 'Unlinked Tags',
    tagLinkStatus: 'Tag Link Status',
    vehicleDist: 'Vehicle Distribution',
    cars: 'Cars',
    trucks: 'Trucks',
    motorcycles: 'Motorcycles',

    // Tags
    tagManagement: 'Tag Management',
    searchTags: 'Search by Name, SN, MAC or Plate...',
    deleteSelected: 'Delete Selected',
    importCSV: 'Import CSV',
    addTag: 'Add Tag',
    selectAll: 'Select All',
    noTags: 'No tags found matching your search.',
    editTag: 'Edit Tag',
    newTag: 'Register New Tag',
    tagName: 'Tag Name (Key)',
    accessoryId: 'Accessory ID (SN)',
    macAddress: 'MAC Address',
    hashedKey: 'Hashed Adv Key',
    privateKey: 'Private Key',
    saveTag: 'Save Tag',
    importSuccess: 'Successfully imported tags.',
    deleteConfirm: 'Are you sure you want to delete this tag?',
    massDeleteConfirm: 'Are you sure you want to delete selected tags?',

    // Vehicles
    vehicleFleet: 'Vehicle Fleet',
    addVehicle: 'Add Vehicle',
    type: 'Type',
    model: 'Model',
    year: 'Year',
    plate: 'Plate',
    linkedTag: 'Linked Tag',
    actions: 'Actions',
    noVehicles: 'No vehicles found.',
    editVehicle: 'Edit Vehicle',
    newVehicle: 'New Vehicle',
    searchFipe: 'Search FIPE Table',
    selectBrand: 'Select Brand',
    selectModel: 'Select Model',
    selectYear: 'Select Year',
    loadingFipe: 'Loading FIPE data...',
    saveVehicle: 'Save Vehicle',
    noLink: '-- No Link --',

    // Map
    selectTracker: 'Select Tracker',
    searchTracker: 'Search tracker...',
    action: 'Action',
    startTracking: 'Start Tracking',
    stop: 'Stop',
    linkedVehicle: 'Linked Vehicle',
    noVehicleLinked: 'No vehicle linked',
    liveData: 'Live Data',
    pointsFound: 'points found',
    updating: 'Updating...',
    noHistory: 'No location history available.',
    refresh: 'Refresh',
    exportCSV: 'CSV',
    shareLocation: 'Share Location',
    locationCopied: 'Location link copied to clipboard!',

    // Settings
    systemSettings: 'System Settings',
    manageConfig: 'Manage API connections, credentials, and external services',
    generalSettings: 'General Settings',
    language: 'Language',
    proxyConfig: 'Proxy / Backend Configuration',
    cloudFunctionUrl: 'Cloud Function URL (Firebase)',
    cloudFunctionDesc: 'Deploy the provided function to Firebase and paste the URL here to fix CORS/HTTP issues.',
    ktagConfig: 'K-Tag API Configuration',
    apiEndpoint: 'API Endpoint URL',
    directIpDesc: 'Direct IP or Domain.',
    username: 'Username',
    password: 'Password',
    mapProviders: 'Map Providers',
    googleKey: 'Google Maps Javascript API Key',
    googleDesc: 'Leave empty to use OpenStreetMap.',
    mapboxKey: 'Mapbox Access Token',
    saveConfig: 'Save Configuration',
    savedSuccess: 'Settings Saved',
    savedError: 'Failed to save settings',

    // Login
    portalTitle: 'K-TAG Portal',
    portalSubtitle: 'Professional Tracking Management',
    fullName: 'Full Name',
    email: 'Email Address',
    signIn: 'Sign In',
    createAccount: 'Create Account',
    haveAccount: 'Already have an account? Sign in',
    noAccount: "Don't have an account? Sign up",
  },
  pt: {
    // Layout
    dashboard: 'Painel de Controle',
    liveMap: 'Mapa ao Vivo',
    tags: 'Tags',
    vehicles: 'Veículos',
    settings: 'Configurações',
    signOut: 'Sair',
    systemOnline: 'Sistema Online',
    syncing: 'Sincronizando...',
    connectionError: 'Erro de Conexão',
    offline: 'Modo Offline',
    notifications: 'Notificações',
    clearAll: 'Limpar tudo',
    noNotifications: 'Sem notificações',

    // Dashboard
    overview: 'Visão Geral',
    quickActions: 'Ações Rápidas',
    recentActivity: 'Atividade Recente',
    totalTags: 'Total de Tags',
    totalVehicles: 'Total de Veículos',
    linkedTags: 'Tags Vinculadas',
    unlinkedTags: 'Tags Soltas',
    tagLinkStatus: 'Status de Vínculo',
    vehicleDist: 'Distribuição da Frota',
    cars: 'Carros',
    trucks: 'Caminhões',
    motorcycles: 'Motos',

    // Tags
    tagManagement: 'Gerenciamento de Tags',
    searchTags: 'Buscar por Nome, SN, MAC ou Placa...',
    deleteSelected: 'Excluir Selecionados',
    importCSV: 'Importar CSV',
    addTag: 'Adicionar Tag',
    selectAll: 'Selecionar Todos',
    noTags: 'Nenhuma tag encontrada para sua busca.',
    editTag: 'Editar Tag',
    newTag: 'Registrar Nova Tag',
    tagName: 'Nome da Tag (Chave)',
    accessoryId: 'ID do Acessório (SN)',
    macAddress: 'Endereço MAC',
    hashedKey: 'Chave Pública (Hashed)',
    privateKey: 'Chave Privada',
    saveTag: 'Salvar Tag',
    importSuccess: 'Tags importadas com sucesso.',
    deleteConfirm: 'Tem certeza que deseja excluir esta tag?',
    massDeleteConfirm: 'Tem certeza que deseja excluir as tags selecionadas?',

    // Vehicles
    vehicleFleet: 'Frota de Veículos',
    addVehicle: 'Adicionar Veículo',
    type: 'Tipo',
    model: 'Modelo',
    year: 'Ano',
    plate: 'Placa',
    linkedTag: 'Tag Vinculada',
    actions: 'Ações',
    noVehicles: 'Nenhum veículo encontrado.',
    editVehicle: 'Editar Veículo',
    newVehicle: 'Novo Veículo',
    searchFipe: 'Consultar Tabela FIPE',
    selectBrand: 'Selecione a Marca',
    selectModel: 'Selecione o Modelo',
    selectYear: 'Selecione o Ano',
    loadingFipe: 'Carregando FIPE...',
    saveVehicle: 'Salvar Veículo',
    noLink: '-- Sem Vínculo --',

    // Map
    selectTracker: 'Selecionar Rastreador',
    searchTracker: 'Buscar rastreador...',
    action: 'Ação',
    startTracking: 'Iniciar Rastreio',
    stop: 'Parar',
    linkedVehicle: 'Veículo Vinculado',
    noVehicleLinked: 'Nenhum veículo',
    liveData: 'Dados em Tempo Real',
    pointsFound: 'pontos encontrados',
    updating: 'Atualizando...',
    noHistory: 'Sem histórico de localização.',
    refresh: 'Atualizar',
    exportCSV: 'CSV',
    shareLocation: 'Compartilhar Local',
    locationCopied: 'Link de localização copiado!',

    // Settings
    systemSettings: 'Configurações do Sistema',
    manageConfig: 'Gerencie conexões de API, credenciais e serviços externos',
    generalSettings: 'Geral',
    language: 'Idioma',
    proxyConfig: 'Configuração de Proxy / Backend',
    cloudFunctionUrl: 'URL da Cloud Function (Firebase)',
    cloudFunctionDesc: 'Implante a função fornecida no Firebase e cole a URL aqui para corrigir problemas de CORS/HTTP.',
    ktagConfig: 'Configuração API K-Tag',
    apiEndpoint: 'URL do Endpoint',
    directIpDesc: 'IP Direto ou Domínio.',
    username: 'Usuário',
    password: 'Senha',
    mapProviders: 'Provedores de Mapa',
    googleKey: 'Chave API Google Maps (Javascript)',
    googleDesc: 'Deixe vazio para usar OpenStreetMap.',
    mapboxKey: 'Token de Acesso Mapbox',
    saveConfig: 'Salvar Configuração',
    savedSuccess: 'Configurações Salvas',
    savedError: 'Falha ao salvar configurações',

    // Login
    portalTitle: 'Portal K-TAG',
    portalSubtitle: 'Gestão Profissional de Rastreamento',
    fullName: 'Nome Completo',
    email: 'Endereço de Email',
    signIn: 'Entrar',
    createAccount: 'Criar Conta',
    haveAccount: 'Já tem uma conta? Entre',
    noAccount: "Não tem conta? Cadastre-se",
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children?: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('pt'); // Default to PT

  useEffect(() => {
    const init = async () => {
      const settings = await storage.getSettings();
      if (settings.language) setLanguage(settings.language);
    };
    init();
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  const t = (key: keyof typeof translations['en']): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
};
