import { Mail, MessageCircle, Linkedin, Instagram } from 'lucide-react';
import BrandMark from './BrandMark';
import { BRAND } from '../brand';

interface NavGroup {
  title: string;
  links: { label: string; href: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Plataforma',
    links: [
      { label: 'Recursos', href: '#plataforma' },
      { label: 'Resultados', href: '#resultados' },
      { label: 'Como funciona', href: '#como-funciona' },
      { label: 'Depoimentos', href: '#depoimentos' },
      { label: 'Preços', href: '#precos' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: `Sobre a ${BRAND.name}`, href: '#sobre' },
      { label: 'Casos de sucesso', href: '#depoimentos' },
      { label: 'Blog', href: '#blog' },
      { label: 'Trabalhe conosco', href: '#carreiras' },
    ],
  },
  {
    title: 'Suporte',
    links: [
      { label: 'Central de ajuda', href: '#ajuda' },
      { label: 'Documentação API', href: '#api' },
      { label: 'Status do sistema', href: '#status' },
      { label: 'Falar com vendas', href: '#solicitar' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Termos de uso', href: '#termos' },
      { label: 'Política de privacidade', href: '#privacidade' },
      { label: 'LGPD', href: '#lgpd' },
      { label: 'Contrato SLA', href: '#sla' },
    ],
  },
];

const SOCIALS = [
  { Icon: Linkedin, label: 'LinkedIn', href: '#linkedin' },
  { Icon: Instagram, label: 'Instagram', href: '#instagram' },
  { Icon: MessageCircle, label: 'WhatsApp', href: '#whatsapp' },
  { Icon: Mail, label: 'E-mail', href: `mailto:${BRAND.email}` },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#050505] border-t border-white/[0.06] pt-20 pb-10 px-6 md:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
          <div className="lg:col-span-4">
            <div className="mb-5">
              <BrandMark size="sm" />
            </div>

            <p className="text-white/50 text-sm leading-relaxed max-w-sm mb-6">
              Tecnologia de ponta para centrais de rastreamento. Sua marca, sua operação, nossa estrutura.
            </p>

            <div className="flex items-center gap-2">
              {SOCIALS.map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.02] hover:border-[#F5A623]/30 hover:bg-[#F5A623]/5 hover:text-[#F5A623] text-white/50 flex items-center justify-center transition-colors"
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-white text-[11px] font-bold tracking-[0.2em] uppercase mb-5">
                  {group.title}
                </h3>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-white/50 hover:text-white text-sm transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <p className="text-white/35 text-xs">
            © {currentYear} {BRAND.name}. Todos os direitos reservados. CNPJ XX.XXX.XXX/0001-XX
          </p>
          <p className="text-white/30 text-xs">
            Feito no Brasil <span className="text-[#F5A623]" aria-hidden="true">•</span> Suporte 100% em Português
          </p>
        </div>
      </div>
    </footer>
  );
}
