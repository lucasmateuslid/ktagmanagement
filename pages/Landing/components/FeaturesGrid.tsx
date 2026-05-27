import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { BRAND } from '../brand';

function FeatureImage({ src, alt, fallbackText }: { src: string; alt: string; fallbackText: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="mt-5 bg-[#1A1A1A] h-48 md:h-64 rounded-xl flex items-center justify-center text-white/20 text-sm border border-white/8 w-full">
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="mt-5 w-full h-auto object-cover rounded-xl border border-white/8"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

export default function FeaturesGrid() {
  return (
    <section id="plataforma" className="bg-[#0a0a0a] py-24 md:py-28 px-6 md:px-10">
      <div className="text-center max-w-2xl mx-auto mb-14 animate-fade-up">
        <span className="inline-block text-[#F5A623] text-[11px] font-semibold tracking-[0.2em] uppercase mb-3">
          A Plataforma
        </span>
        <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-5">
          Tudo que sua operação precisa.{' '}
          <span className="text-[#F5A623]">Em um lugar só.</span>
        </h2>
        <p className="text-white/55 text-[15px] md:text-base leading-relaxed">
          Do rastreamento em tempo real ao controle de estoque avançado — substitua planilhas, WhatsApp e três sistemas diferentes por uma plataforma profissional.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
        <div className="bg-[#111] border border-white/8 rounded-[32px] overflow-hidden p-7 md:col-span-2 group hover:border-white/20 transition-colors">
          <span className="inline-block bg-[#F5A623]/10 text-[#F5A623] text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4">Dashboard Analytics</span>
          <h3 className="text-2xl font-bold text-white">Visão Geral da Operação</h3>
          <p className="text-white/60 text-sm mt-2 max-w-md font-medium">
            Acompanhe veículos, equipamentos e métricas de desempenho em um painel unificado e personalizável.
          </p>
          <FeatureImage src="/assets/dashboard.png" alt={`Dashboard ${BRAND.name}`} fallbackText="[screenshot: dashboard.png]" />
        </div>

        <div className="bg-[#111] border border-white/8 rounded-[32px] p-7 group hover:border-white/20 transition-colors">
          <div className="bg-[#F5A623]/10 rounded-xl p-3 w-12 h-12 text-[#F5A623] mb-5 flex items-center justify-center">
            <MapPin className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Mapa ao Vivo</h3>
          <p className="text-white/60 text-sm mt-2 font-medium">
            Visualize a posição exata de cada veículo e equipamento em tempo real, com clusters e filtros avançados.
          </p>
          <FeatureImage src="/assets/livemap.png" alt="Mapa ao vivo" fallbackText="[screenshot: livemap.png]" />
        </div>

        <div className="bg-[#F5A623] rounded-[32px] p-7 group">
          <h3 className="text-xl font-bold text-black">Gestão de Estoque</h3>
          <p className="text-black/80 text-sm mt-2 font-medium">
            Controle a vinculação e rastreabilidade total de cada equipamento (Tags) da sua operação de forma simplificada.
          </p>
          <div className="mt-6">
            <span className="text-6xl font-black text-black tracking-tighter">15k<span className="text-4xl">+</span></span>
            <p className="text-black/60 text-sm font-bold mt-1">Equipamentos Gerenciados</p>
          </div>
          <FeatureImage src="/assets/estoque.png" alt="Estoque de Tags" fallbackText="[screenshot: estoque.png]" />
        </div>

        <div className="bg-[#111] border border-white/8 rounded-[32px] p-7 md:col-span-2 group hover:border-white/20 transition-colors">
          <span className="inline-block bg-gradient-to-r from-[#F5A623]/20 to-transparent border border-[#F5A623]/20 text-[#F5A623] text-xs px-3 py-1 rounded-full mb-4 font-semibold uppercase tracking-widest">
            Agendamentos Inteligentes
          </span>
          <h3 className="text-2xl font-bold text-white">Central de Agendamentos</h3>
          <p className="text-white/60 text-sm mt-2 mb-6 font-medium">
            Crie solicitações de serviço, atribua técnicos, acompanhe o status da frota e receba alertas automáticos de forma inteligente.
          </p>
          <div className="flex flex-col gap-3 text-sm text-white/70 mb-6 font-medium">
            <span className="flex items-center gap-2"><span className="text-[#F5A623]">✓</span> Solicitação com auto-preenchimento</span>
            <span className="flex items-center gap-2"><span className="text-[#F5A623]">✓</span> Integração inteligente com API do Detran/SGA</span>
            <span className="flex items-center gap-2"><span className="text-[#F5A623]">✓</span> Calendário visual e intuitivo por técnico</span>
            <span className="flex items-center gap-2"><span className="text-[#F5A623]">✓</span> Alertas de ações e respostas imediatas</span>
          </div>
          <FeatureImage src="/assets/solicitacao.png" alt="Agendamentos" fallbackText="[screenshot: solicitacao.png]" />
        </div>

        <div className="bg-[#111] border border-red-900/30 rounded-[32px] p-7 group hover:border-red-900/60 transition-colors flex flex-col">
          <span className="inline-block self-start bg-red-950/40 border border-red-900/50 text-red-600 text-xs px-3 py-1 rounded-full mb-4 font-semibold uppercase tracking-widest">
            ⚠ Alertas Críticos
          </span>
          <div className="bg-[#161010] border border-red-900/40 text-white text-xs p-4 rounded-xl font-medium mb-6 flex flex-col gap-1.5">
            <span className="font-bold text-red-600 uppercase tracking-widest">Agendamento #TSV2C91</span>
            <span className="text-white/70">Requer ação imediata para liberação.</span>
          </div>
          <div className="mt-auto">
            <h3 className="text-xl font-bold text-white">Alertas Operacionais</h3>
            <p className="text-white/60 text-sm mt-2 font-medium">
              Notificações e urgências em destaque no painel para que sua equipe atue de forma rápida e proativa.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
