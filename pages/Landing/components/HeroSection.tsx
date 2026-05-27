import { ArrowDown } from 'lucide-react';
import { BRAND } from '../brand';

interface Stat {
  value: string;
  label: string;
  accent?: boolean;
}

const STATS: Stat[] = [
  { value: '+432', label: 'Veículos Monitorados' },
  { value: '+15k', label: 'Tags em Estoque' },
  { value: '+4.8M', label: 'Eventos Diários', accent: true },
];

function StatBlock({ stat, delay }: { stat: Stat; delay: string }) {
  return (
    <div
      className={`flex flex-col animate-fade-up ${delay}`}
      aria-label={`${stat.value} ${stat.label}`}
    >
      <span
        className={`text-4xl md:text-5xl font-bold tracking-tight ${
          stat.accent ? 'text-[#F5A623]' : 'text-white'
        }`}
      >
        {stat.value}
      </span>
      <p className="text-xs md:text-sm text-white/50 mt-1 font-semibold uppercase tracking-wider">
        {stat.label}
      </p>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section
      className="relative min-h-[100svh] h-auto w-full overflow-hidden bg-[#050505] flex flex-col"
      aria-label="Seção principal"
    >
      <video
        className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen"
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        aria-hidden="true"
      >
        <source src="/video.webm" type="video/webm" />
      </video>

      <div
        className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]/30"
        aria-hidden="true"
      />
      <div
        className="landing-glow top-[30%] left-[15%] -translate-x-1/2 -translate-y-1/2 opacity-70"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-10 flex flex-col justify-center flex-1 pt-32 md:pt-40">
        <div className="max-w-3xl flex-1 flex flex-col justify-center pb-12">
          <div className="mb-6 animate-fade-up">
            <span
              className="inline-flex items-center gap-2 bg-[#1A1A1A]/80 border border-white/10 text-white/90 text-xs md:text-sm px-4 py-2 rounded-full font-semibold shadow-xl backdrop-blur-md uppercase tracking-wider"
              role="status"
              aria-live="polite"
            >
              <span
                className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse"
                aria-hidden="true"
              />
              {BRAND.tagline}
            </span>
          </div>

          <h1 className="text-white font-bold text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.05] mb-6 animate-fade-up delay-100">
            A tecnologia definitiva para sua{' '}
            <span className="text-[#F5A623]">central de rastreamento.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl font-medium animate-fade-up delay-200 mb-10">
            Sua marca, nossa tecnologia. Escale sua operação, maximize lucros e retenha clientes com um sistema completo de monitoramento, gestão de estoque e agendamentos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-16 animate-fade-up delay-300">
            <a
              href="#solicitar"
              className="bg-[#F5A623] hover:bg-[#C8841A] text-black font-bold text-base px-8 py-4 rounded-xl transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[#F5A623]/20 flex items-center justify-center gap-2"
            >
              Solicitar Acesso <span aria-hidden="true">→</span>
            </a>
            <a
              href="#plataforma"
              className="bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white border border-white/10 font-bold text-base px-8 py-4 rounded-xl transition-colors flex items-center justify-center"
            >
              Conhecer a Plataforma
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12 pb-12 md:pb-20 border-t border-white/10 pt-10">
          <StatBlock stat={STATS[0]} delay="delay-500" />
          <StatBlock stat={STATS[1]} delay="delay-500 md:delay-[600ms]" />
          <StatBlock stat={STATS[2]} delay="delay-500 md:delay-[700ms]" />
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#0a0a0a]"
        aria-hidden="true"
      />

      <div
        className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40 text-[10px] animate-fade-up delay-[800ms]"
        aria-hidden="true"
      >
        <span className="uppercase tracking-widest font-bold">Scroll</span>
        <ArrowDown className="w-4 h-4 animate-bounce" />
      </div>
    </section>
  );
}
