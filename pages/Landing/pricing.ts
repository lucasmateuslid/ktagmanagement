/** Catálogo comercial público; não altera módulos ou faturamento dos tenants. */
export type BillingPeriod = "monthly" | "annual";
export type PlanId = "basic" | "pro" | "enterprise";
export type OperationMode = "integrated" | "standalone";
export const INCLUDED_VEHICLES = 1500;
export const MAX_SIMULATED_VEHICLES = 1000000;
export const EXCESS_TIERS = [
  { from: 1501, to: 3000, rateCents: 300 },
  { from: 3001, to: 5000, rateCents: 240 },
  { from: 5001, to: 10000, rateCents: 180 },
  { from: 10001, to: null, rateCents: 120 },
] as const;
export const PLANS = [
  {
    id: "basic" as const,
    name: "Básico",
    label: "Organize sua base",
    description: "Visibilidade para começar a operar com mais controle.",
    monthlyCents: 38990,
    annualMonthlyCents: 29990,
    features: [
      "Localização e rastreamento",
      "Cadastro de rastreadores e chips",
      "Agendamento de serviços",
      "Histórico e relatórios básicos",
      "Suporte padrão",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    label: "Prepare sua expansão",
    description: "Conecte a operação e acompanhe o crescimento da sua base.",
    monthlyCents: 53990,
    annualMonthlyCents: 42990,
    features: [
      "Todos os recursos do Básico",
      "Controle avançado de estoque e chips",
      "Gestão de roubos e recuperações",
      "Integrações com sistemas compatíveis",
      "Dashboards e suporte prioritário",
    ],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    label: "Escale do seu jeito",
    description:
      "Uma proposta para múltiplas empresas e necessidades específicas.",
    monthlyCents: null,
    annualMonthlyCents: null,
    features: [
      "Todos os recursos do Pro",
      "Condições comerciais sob medida",
      "Estrutura para múltiplas empresas",
      "Identidade visual da sua operação",
      "Implantação e integrações planejadas",
    ],
  },
];
export type CommercialQuote = {
  planId: PlanId;
  period: BillingPeriod;
  vehicles: number | null;
  mode: OperationMode;
};
export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const formatCount = (value: number) => value.toLocaleString("pt-BR");
export const modeLabel = (mode: OperationMode) =>
  mode === "integrated"
    ? "Integrado ao meu sistema"
    : "Monitora 360 como sistema de rastreamento";
export const tierLabel = (tier: (typeof EXCESS_TIERS)[number]) =>
  tier.to === null
    ? `A partir do ${formatCount(tier.from)}º`
    : `Do ${formatCount(tier.from)}º ao ${formatCount(tier.to)}º`;

export function calculatePlanCost(
  planId: PlanId,
  vehicles: number,
  period: BillingPeriod,
) {
  if (
    !Number.isSafeInteger(vehicles) ||
    vehicles < 1 ||
    vehicles > MAX_SIMULATED_VEHICLES
  )
    return null;
  const plan = PLANS.find((item) => item.id === planId)!;
  const baseCents =
    period === "annual" ? plan.annualMonthlyCents : plan.monthlyCents;
  const tiers =
    baseCents === null
      ? []
      : EXCESS_TIERS.map((tier) => {
          const quantity = Math.max(
            0,
            Math.min(vehicles, tier.to ?? vehicles) - tier.from + 1,
          );
          return { ...tier, quantity, totalCents: quantity * tier.rateCents };
        }).filter((tier) => tier.quantity > 0);
  const excessCents =
    baseCents === null
      ? null
      : tiers.reduce((total, tier) => total + tier.totalCents, 0);
  const monthlyCents =
    baseCents === null || excessCents === null ? null : baseCents + excessCents;
  return {
    plan,
    baseCents,
    excessCents,
    monthlyCents,
    tiers,
    excessVehicles: Math.max(0, vehicles - INCLUDED_VEHICLES),
    annualTotalCents: monthlyCents === null ? null : monthlyCents * 12,
    savingsCents:
      plan.monthlyCents === null || baseCents === null
        ? null
        : (plan.monthlyCents - baseCents) * 12,
    perVehicleCents:
      monthlyCents === null ? null : Math.round(monthlyCents / vehicles),
    includedPercent: Math.min(100, (vehicles / INCLUDED_VEHICLES) * 100),
    includedRemaining: Math.max(0, INCLUDED_VEHICLES - vehicles),
  };
}
export function estimateUsage(
  vehicles: number,
  period: BillingPeriod,
  advanced = false,
  multiCompany = false,
) {
  // Os recursos definem o plano; o volume define os adicionais, sem teto artificial.
  return calculatePlanCost(
    multiCompany ? "enterprise" : advanced ? "pro" : "basic",
    vehicles,
    period,
  );
}
