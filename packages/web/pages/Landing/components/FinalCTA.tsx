import { TypewriterEffectSmooth } from './TypewriterEffect';

const WORDS = [
  { text: 'Pare' },
  { text: 'de' },
  { text: 'perder' },
  { text: 'dinheiro' },
  { text: 'com' },
  { text: 'frota' },
  { text: 'descontrolada.', className: 'text-[#F5A623]' },
];

export default function FinalCTA() {
  return (
    <section
      id="solicitar"
      className="relative bg-[#0a0a0a] py-28 md:py-32 px-6 md:px-10 text-center w-full border-t border-white/[0.06] overflow-hidden"
      aria-label="Última chamada"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-[720px] h-[280px] rounded-full bg-[#F5A623]/[0.05] blur-3xl"
      />

      <div className="relative max-w-3xl mx-auto">
        <div className="flex justify-center mb-6">
          <TypewriterEffectSmooth
            words={WORDS}
            className="justify-center"
            cursorClassName="bg-[#F5A623]"
          />
        </div>

        <p className="text-lg md:text-xl text-white/65 mx-auto mb-10 max-w-2xl leading-relaxed">
          Cada dia sem controle é dinheiro saindo do caixa.{' '}
          <span className="text-white font-semibold">Solicite acesso hoje</span> e veja sua operação rodando em até 48 horas — sem cartão e sem letras miúdas.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <a
            href="#contato"
            className="group bg-[#F5A623] hover:bg-[#ffbf4d] text-black font-bold text-base px-9 py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#F5A623]/25 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Solicitar acesso agora
            <span className="text-lg group-hover:translate-x-0.5 transition-transform">→</span>
          </a>

          <a
            href="#especialista"
            className="border border-white/15 hover:border-white/30 hover:bg-white/[0.03] text-white font-semibold text-base px-9 py-4 rounded-2xl transition-all flex items-center justify-center"
          >
            Falar com especialista
          </a>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-x-7 gap-y-3 text-[13px] text-white/55">
          {['Garantia de 30 dias', 'Onboarding em até 48h', 'Sem cartão na ativação', 'Cancele quando quiser'].map(
            (label) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold" aria-hidden="true">✓</span>
                {label}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
