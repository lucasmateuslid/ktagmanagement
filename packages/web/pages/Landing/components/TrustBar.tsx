const PARTNERS = [
  { name: 'Parceiro 01', placeholder: 'LOGO' },
  { name: 'Parceiro 02', placeholder: 'LOGO' },
  { name: 'Parceiro 03', placeholder: 'LOGO' },
  { name: 'Parceiro 04', placeholder: 'LOGO' },
  { name: 'Parceiro 05', placeholder: 'LOGO' },
  { name: 'Parceiro 06', placeholder: 'LOGO' },
];

export default function TrustBar() {
  return (
    <section
      className="relative w-full bg-[#0a0a0a] border-y border-white/[0.06] py-14 md:py-16"
      aria-label="Empresas que confiam na plataforma"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="text-center mb-10">
          <span className="inline-block text-[#F5A623] text-[11px] font-semibold tracking-[0.2em] uppercase mb-3">
            Quem confia
          </span>
          <p className="text-white/60 text-sm md:text-base font-medium max-w-xl mx-auto">
            Centrais de rastreamento e operações de frota em todo o Brasil já operam com nossa tecnologia.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 md:gap-6">
          {PARTNERS.map((p) => (
            <div
              key={p.name}
              className="group relative flex items-center justify-center h-16 md:h-20 rounded-xl border border-dashed border-white/10 bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03] transition-colors"
              aria-label={p.name}
            >
              <span className="text-white/20 group-hover:text-white/40 text-[10px] font-bold tracking-[0.25em] uppercase transition-colors">
                {p.placeholder}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
