import type { ElementType } from 'react';
import { Headset, Settings2, Rocket, LineChart } from 'lucide-react';

interface Step {
  number: string;
  icon: ElementType;
  title: string;
  description: string;
  highlight: string;
}

const STEPS: Step[] = [
  {
    number: '01',
    icon: Headset,
    title: 'Diagnóstico gratuito',
    description:
      'Analisamos sua operação atual, volume de tags e gargalos. Em 30 minutos você recebe um plano sob medida, sem compromisso.',
    highlight: '30 min',
  },
  {
    number: '02',
    icon: Settings2,
    title: 'Setup whitelabel',
    description:
      'Configuramos sua plataforma com sua marca, domínio próprio e integração com Detran/SGA e gateways de pagamento.',
    highlight: 'Até 48h',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Migração assistida',
    description:
      'Importamos sua base atual de clientes, veículos e tags. Treinamos sua equipe via vídeo-aula e suporte dedicado.',
    highlight: 'Sem downtime',
  },
  {
    number: '04',
    icon: LineChart,
    title: 'Operação em escala',
    description:
      'Sua central no ar com painel completo, alertas inteligentes e relatórios automáticos para crescer com previsibilidade.',
    highlight: 'ROI em 60 dias',
  },
];

export default function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="relative w-full bg-[#0a0a0a] py-24 md:py-28 px-6 md:px-10"
      aria-label="Como funciona o processo de implantação"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block text-[#F5A623] text-[11px] font-semibold tracking-[0.2em] uppercase mb-3">
            Como funciona
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-5">
            Da assinatura à operação{' '}
            <span className="text-[#F5A623]">em menos de uma semana.</span>
          </h2>
          <p className="text-white/55 text-[15px] md:text-base leading-relaxed">
            Sem reuniões intermináveis. Sem cobranças surpresa. Um processo desenhado para tirar sua central do papel rápido.
          </p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />

          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.number}
                className="group relative bg-[#111] border border-white/[0.08] rounded-2xl p-7 hover:border-[#F5A623]/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="relative z-10 w-12 h-12 rounded-xl bg-[#0a0a0a] border border-[#F5A623]/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,166,35,0.08)] group-hover:shadow-[0_0_24px_rgba(245,166,35,0.18)] transition-shadow">
                    <Icon className="w-5 h-5 text-[#F5A623]" strokeWidth={2.2} />
                  </div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/15 px-2.5 py-1 rounded-md">
                    {step.highlight}
                  </span>
                </div>

                <div className="text-[11px] font-bold text-white/30 tracking-[0.25em] uppercase mb-2">
                  Etapa {step.number}
                </div>
                <h3 className="text-lg font-bold text-white mb-3 leading-tight">
                  {step.title}
                </h3>
                <p className="text-[13.5px] text-white/55 leading-relaxed">
                  {step.description}
                </p>
              </article>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-14">
          <a
            href="#solicitar"
            className="bg-[#F5A623] hover:bg-[#ffbf4d] text-black font-bold text-sm px-8 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#F5A623]/20 flex items-center gap-2"
          >
            Quero meu diagnóstico gratuito <span aria-hidden="true">→</span>
          </a>
          <span className="text-white/40 text-xs">
            Sem cartão. Sem compromisso. Resposta em até 24h.
          </span>
        </div>
      </div>
    </section>
  );
}
