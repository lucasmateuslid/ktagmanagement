import type { ElementType } from 'react';
import { TrendingDown, TrendingUp, Clock, Shield } from 'lucide-react';

interface ResultMetric {
  icon: ElementType;
  value: string;
  label: string;
  description: string;
  trend: 'up' | 'down';
}

const RESULTS: ResultMetric[] = [
  {
    icon: TrendingDown,
    value: '−38%',
    label: 'Custo operacional',
    description: 'Redução média de despesas com gestão de frota no primeiro semestre.',
    trend: 'down',
  },
  {
    icon: Clock,
    value: '7×',
    label: 'Mais rápido',
    description: 'Tempo médio de resposta a ocorrências comparado a centrais sem automação.',
    trend: 'up',
  },
  {
    icon: TrendingUp,
    value: '+62%',
    label: 'Retenção de clientes',
    description: 'Aumento na renovação de contratos B2B após adoção da plataforma.',
    trend: 'up',
  },
  {
    icon: Shield,
    value: '99.97%',
    label: 'Uptime garantido',
    description: 'SLA contratual com infraestrutura distribuída e redundância ativa.',
    trend: 'up',
  },
];

export default function StatsSection() {
  return (
    <section
      id="resultados"
      className="relative w-full bg-[#0a0a0a] py-24 md:py-28 px-6 md:px-10 border-t border-white/[0.06]"
      aria-label="Resultados reais com a plataforma"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block text-[#F5A623] text-[11px] font-semibold tracking-[0.2em] uppercase mb-3">
            Resultados
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-5">
            Números que <span className="text-[#F5A623]">impactam</span> o seu caixa.
          </h2>
          <p className="text-white/55 text-[15px] md:text-base leading-relaxed">
            Não vendemos promessa — entregamos resultado. Métricas auditadas com nossos clientes nos últimos 12 meses.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RESULTS.map((m) => {
            const Icon = m.icon;
            return (
              <article
                key={m.label}
                className="group relative bg-[#111] border border-white/[0.08] rounded-2xl p-7 hover:border-[#F5A623]/30 hover:bg-[#141414] transition-colors"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-xl bg-[#F5A623]/10 border border-[#F5A623]/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#F5A623]" strokeWidth={2.2} />
                  </div>
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-md text-emerald-400 bg-emerald-500/10 border border-emerald-500/15">
                    {m.trend === 'up' ? '↑ alta' : '↓ queda'}
                  </span>
                </div>

                <div className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-none mb-2">
                  {m.value}
                </div>
                <div className="text-sm font-semibold text-white/85 mb-3">{m.label}</div>
                <p className="text-[13px] text-white/45 leading-relaxed">{m.description}</p>
              </article>
            );
          })}
        </div>

        <p className="text-center text-white/30 text-xs mt-10 max-w-xl mx-auto">
          Dados baseados em amostra de operações ativas. Resultados podem variar conforme porte e maturidade da operação.
        </p>
      </div>
    </section>
  );
}
