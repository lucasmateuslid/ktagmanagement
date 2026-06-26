export interface ModuleCatalogItem {
  id: string;
  label: string;
  description: string;
}

/**
 * Catálogo de módulos que um plano pode liberar (ou uma empresa via override).
 * Apenas catálogo + seleção por enquanto — a enforcement real (bloquear telas/
 * funcionalidades quando o módulo não está liberado) é trabalho futuro.
 */
export const MODULE_CATALOG: ModuleCatalogItem[] = [
  { id: 'ktag', label: 'K-TAG', description: 'Integração com a plataforma K-TAG (rastreamento/telemetria)' },
  { id: 'hinova', label: 'Hinova', description: 'Integração com o sistema de gestão Hinova' },
  { id: 'melhorEnvio', label: 'Melhor Envio', description: 'Cotação e etiquetas de frete via Melhor Envio' },
  { id: 'ai', label: 'IA / Assistente', description: 'Recursos de inteligência artificial dentro do app' },
  { id: 'relatorios_avancados', label: 'Relatórios avançados', description: 'Relatórios e exportações além do plano básico' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Notificações e atendimento via WhatsApp' },
];

export function moduleLabel(id: string): string {
  return MODULE_CATALOG.find(m => m.id === id)?.label || id;
}
