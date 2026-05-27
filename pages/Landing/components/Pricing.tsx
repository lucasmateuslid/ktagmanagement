import { useState } from 'react';
import { Check, ArrowRight, Zap } from 'lucide-react';

type Feature = {
  text: string;
  highlight?: boolean;
};

type Plan = {
  id: string;
  name: string;
  badge?: string;
  monthlyPrice: number | null;
  annualMonthly: number | null;
  annualTotal: number | null;
  annualSavings: number | null;
  description: string;
  features: Feature[];
  cta: string;
  highlighted: boolean;
  isConsult: boolean;
};

const plans: Plan[] = [
  {
    id: 'basic',
    name: 'Básico',
    monthlyPrice: 389.9,
    annualMonthly: 299.9,
    annualTotal: 3599,
    annualSavings: 1080,
    description: 'Ideal para operações B2B que precisam começar rápido.',
    features: [
      { text: 'Agendamento de Serviços' },
      { text: 'Histórico e relatórios básicos' },
      { text: 'Rastreamento por Chamada' },
      { text: 'Suporte padrão' },
      { text: 'até 1500 tags', highlight: true },
    ],
    cta: 'Solicitar Acesso',
    highlighted: false,
    isConsult: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Mais Popular',
    monthlyPrice: 539.9,
    annualMonthly: 429.9,
    annualTotal: 5159,
    annualSavings: 1320,
    description: 'Para operações maiores com recursos avançados e SLA dedicado.',
    features: [
      { text: 'Tudo do plano Básico' },
      { text: 'Controle avançado de estoque' },
      { text: 'Agendamentos e automações' },
      { text: 'Relatórios e dashboards custom' },
      { text: 'Integre qualquer tag via API', highlight: true },
      { text: 'Integrações e API aberta', highlight: true },
      { text: 'Suporte prioritário', highlight: true },
      { text: 'até 5000 tags', highlight: true },
    ],
    cta: 'Falar com Especialista',
    highlighted: true,
    isConsult: false,
  },
  {
    id: 'lifetime',
    name: 'Vitalício',
    badge: 'Oferta Exclusiva',
    monthlyPrice: null,
    annualMonthly: null,
    annualTotal: null,
    annualSavings: null,
    description:
      'Quer o sistema sob medida, sem mensalidades e com acesso vitalício? Fale conosco para um plano personalizado.',
    features: [
      { text: 'Todos os recursos Pro' },
      { text: 'Acesso vitalício garantido', highlight: true },
      { text: 'Atualizações inclusas até 2 anos' },
      { text: 'Suporte dedicado na ativação' },
      { text: 'Tags ilimitadas', highlight: true },
    ],
    cta: 'Falar com Especialista',
    highlighted: false,
    isConsult: true,
  },
];

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="precos" className="relative bg-[#0a0a0a] overflow-hidden py-28 px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F5A623]/20 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-32 w-[640px] h-[360px] rounded-full bg-[#F5A623]/[0.04] blur-3xl"
      />

      <div className="relative text-center max-w-2xl mx-auto mb-14">
        <span className="inline-block text-[#F5A623] text-[11px] font-semibold tracking-[0.2em] uppercase mb-4">
          Planos
        </span>

        <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-5">
          Simples. Transparente.{' '}
          <span className="text-[#F5A623]">Escalável.</span>
        </h2>

        <p className="text-white/50 text-[15px] leading-relaxed mb-9">
          Sem taxa de adesão. Sem letras miúdas.
          <br />
          Cancele quando quiser.
        </p>

        <div className="inline-flex flex-col items-center gap-3">
          <div className="inline-flex items-center rounded-full bg-white/[0.05] border border-white/10 p-1">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                !isAnnual ? 'bg-[#F5A623] text-black' : 'text-white/50 hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`relative px-6 py-2.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
                isAnnual ? 'bg-[#F5A623] text-black' : 'text-white/50 hover:text-white'
              }`}
            >
              Anual
              {!isAnnual && (
                <span className="text-[10px] font-bold text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/20 rounded-full px-2 py-0.5 leading-none">
                  −20%
                </span>
              )}
            </button>
          </div>

          {isAnnual && (
            <p className="text-[13px] text-emerald-400 font-medium">
              Economize até R$ 1.320 por ano no plano anual
            </p>
          )}
        </div>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const price = isAnnual ? plan.annualMonthly : plan.monthlyPrice;

          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-[28px] p-8 border transition-colors ${
                plan.highlighted
                  ? 'bg-[#F5A623] border-[#F5A623] md:-translate-y-4 shadow-2xl shadow-[#F5A623]/15'
                  : 'bg-[#111] border-white/[0.08] hover:border-white/[0.14]'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full ${
                      plan.highlighted
                        ? 'bg-black/15 text-black border border-black/10'
                        : 'bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/20'
                    }`}
                  >
                    {plan.highlighted && (
                      <span className="w-1.5 h-1.5 rounded-full bg-black/50 animate-pulse" />
                    )}
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between mb-5">
                <h3
                  className={`text-xl font-bold ${
                    plan.highlighted ? 'text-black' : 'text-white'
                  }`}
                >
                  {plan.name}
                </h3>

                {isAnnual && plan.annualSavings && (
                  <span
                    className={`text-[11px] font-bold rounded-lg px-2.5 py-1 ${
                      plan.highlighted
                        ? 'bg-black/12 text-black/70'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                    }`}
                  >
                    −R$ {plan.annualSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/ano
                  </span>
                )}
              </div>

              <div className="mb-6">
                {plan.isConsult ? (
                  <>
                    <p
                      className={`text-3xl font-bold leading-none mb-1 ${
                        plan.highlighted ? 'text-black' : 'text-white'
                      }`}
                    >
                      Sob Consulta
                    </p>
                    <p
                      className={`text-sm ${
                        plan.highlighted ? 'text-black/60' : 'text-white/40'
                      }`}
                    >
                      Fale com nossa equipe
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-sm font-semibold ${
                          plan.highlighted ? 'text-black/60' : 'text-white/40'
                        }`}
                      >
                        R$
                      </span>
                      <span
                        className={`text-5xl font-bold leading-none tracking-tight ${
                          plan.highlighted ? 'text-black' : 'text-white'
                        }`}
                      >
                        {formatPrice(price!)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[13px] ${
                          plan.highlighted ? 'text-black/55' : 'text-white/35'
                        }`}
                      >
                        por usuário/mês
                        {isAnnual && ', no plano anual'}
                      </span>
                    </div>

                    {isAnnual && (
                      <p
                        className={`text-[12px] mt-0.5 line-through ${
                          plan.highlighted ? 'text-black/35' : 'text-white/20'
                        }`}
                      >
                        R$ {formatPrice(plan.monthlyPrice!)}/mês
                      </p>
                    )}
                  </>
                )}
              </div>

              <p
                className={`text-sm leading-relaxed pb-6 mb-6 border-b ${
                  plan.highlighted
                    ? 'text-black/60 border-black/10'
                    : 'text-white/45 border-white/[0.07]'
                }`}
              >
                {plan.description}
              </p>

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-2.5">
                    <span className="shrink-0">
                      <Check
                        className={`h-4 w-4 ${
                          plan.highlighted ? 'text-black/70' : 'text-[#F5A623]'
                        }`}
                        strokeWidth={2.5}
                      />
                    </span>
                    <span
                      className={`text-sm ${
                        feature.highlight
                          ? plan.highlighted
                            ? 'text-black font-semibold'
                            : 'text-white font-semibold'
                          : plan.highlighted
                          ? 'text-black/70'
                          : 'text-white/55'
                      }`}
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={`group flex items-center justify-center gap-2 w-full rounded-2xl py-4 text-sm font-bold transition-all duration-200 ${
                  plan.highlighted
                    ? 'bg-black text-white hover:bg-black/80'
                    : 'border border-white/15 text-white hover:bg-white/[0.05] hover:border-white/25'
                }`}
              >
                {plan.cta}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </article>
          );
        })}
      </div>

      <div className="relative flex flex-wrap justify-center items-center gap-x-10 gap-y-4 mt-14 max-w-3xl mx-auto">
        {[
          { Icon: Check, label: 'Garantia de 30 dias' },
          { Icon: Zap, label: 'Ativação imediata' },
          { Icon: Check, label: 'Sem contrato de fidelidade' },
          { Icon: Check, label: 'Suporte 100% em Português' },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-white/30 text-[13px]">
            <Icon className="h-3.5 w-3.5 text-[#F5A623]/50" strokeWidth={2.5} />
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}
