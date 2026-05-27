import { Quote, Star } from 'lucide-react';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  initials: string;
  metric: { value: string; label: string };
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Migramos 1.200 tags em 3 dias. O painel é tão claro que a equipe parou de abrir chamados pra coisas básicas — economizamos um analista inteiro só com isso.',
    author: 'Ricardo Almeida',
    role: 'Diretor de Operações',
    company: 'Central de Rastreamento Sul-RS',
    initials: 'RA',
    metric: { value: '−40%', label: 'em chamados internos' },
  },
  {
    quote:
      'O white-label foi decisivo. Apresentamos a plataforma com nossa marca para o cliente final e isso aumentou nossa percepção de valor no contrato corporativo.',
    author: 'Camila Vasconcelos',
    role: 'CEO',
    company: 'TrackFleet Brasil',
    initials: 'CV',
    metric: { value: '+R$ 28k', label: 'em ticket médio anual' },
  },
  {
    quote:
      'Os alertas automáticos pegam ocorrências que antes passavam despercebidas. Em 6 meses, evitamos 2 sinistros graves só pela detecção precoce de cerca violada.',
    author: 'Júlio Pereira',
    role: 'Gerente de Frota',
    company: 'LogiCargas Express',
    initials: 'JP',
    metric: { value: '0', label: 'sinistros não detectados' },
  },
];

export default function ProductShowcase() {
  return (
    <section
      id="depoimentos"
      className="relative w-full bg-[#0a0a0a] py-24 md:py-28 px-6 md:px-10 border-t border-white/[0.06]"
      aria-label="Depoimentos de clientes"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-[640px] h-[200px] rounded-full bg-[#F5A623]/[0.04] blur-3xl"
      />

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block text-[#F5A623] text-[11px] font-semibold tracking-[0.2em] uppercase mb-3">
            Quem usa, recomenda
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-5">
            Centrais que <span className="text-[#F5A623]">cresceram</span> com a gente.
          </h2>
          <p className="text-white/55 text-[15px] md:text-base leading-relaxed">
            Casos reais de operações B2B que escalaram receita, reduziram custo e profissionalizaram o atendimento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <article
              key={t.author}
              className={`relative flex flex-col rounded-2xl p-7 border transition-colors ${
                i === 1
                  ? 'bg-[#141414] border-[#F5A623]/20 md:-translate-y-2'
                  : 'bg-[#111] border-white/[0.08] hover:border-white/[0.16]'
              }`}
            >
              <Quote className="w-7 h-7 text-[#F5A623]/40 mb-5" strokeWidth={2} />

              <p className="text-white/85 text-[15px] leading-relaxed font-medium mb-6 flex-1">
                "{t.quote}"
              </p>

              <div className="flex items-center gap-1 mb-5" aria-label="Avaliação 5 de 5">
                {[...Array(5)].map((_, idx) => (
                  <Star
                    key={idx}
                    className="w-3.5 h-3.5 text-[#F5A623] fill-[#F5A623]"
                    aria-hidden="true"
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 pb-5 mb-5 border-b border-white/[0.07]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F5A623] to-[#C8841A] flex items-center justify-center font-bold text-black text-sm shrink-0">
                  {t.initials}
                </div>
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">{t.author}</div>
                  <div className="text-white/45 text-xs truncate">
                    {t.role} · {t.company}
                  </div>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#F5A623] tracking-tight">
                  {t.metric.value}
                </span>
                <span className="text-white/50 text-xs font-medium">{t.metric.label}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-3 mt-14 text-[13px] text-white/40">
          <div className="flex items-center gap-2">
            <span className="text-[#F5A623] font-bold">4.9/5</span>
            <span>de satisfação</span>
          </div>
          <span aria-hidden="true" className="text-white/15">•</span>
          <div>
            <span className="text-white/70 font-bold">+80</span> centrais ativas
          </div>
          <span aria-hidden="true" className="text-white/15">•</span>
          <div>
            <span className="text-white/70 font-bold">15k+</span> tags gerenciadas
          </div>
        </div>
      </div>
    </section>
  );
}
