import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import BrandMark from './BrandMark';

const NAV_ITEMS = [
  { label: 'Plataforma', href: '#plataforma' },
  { label: 'Resultados', href: '#resultados' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Preços', href: '#precos' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10 py-3'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
          <BrandMark />

          <div className="hidden lg:flex items-center gap-1 bg-white/[0.03] border border-white/5 p-1 rounded-full">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-neutral-400 hover:text-white hover:bg-white/10 transition-all text-sm px-5 py-2 rounded-full font-medium"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-4 shrink-0">
            <a href="#login" className="text-white/70 hover:text-white text-sm font-semibold transition-colors">
              Entrar
            </a>
            <a
              href="#solicitar"
              className="bg-[#F5A623] hover:bg-[#C8841A] text-black text-sm font-bold rounded-xl px-6 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(245,166,35,0.3)]"
            >
              Solicitar Acesso
            </a>
          </div>

          <button
            className="lg:hidden text-white p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      <div
        className={`fixed inset-0 bg-[#0a0a0a] z-40 lg:hidden transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full pt-28 px-6 pb-12">
          <div className="flex flex-col gap-6 text-xl font-medium">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white/80 hover:text-[#F5A623] transition-colors border-b border-white/10 pb-4"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-4">
            <a
              href="#login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full border border-white/20 text-white text-center py-4 rounded-xl font-bold"
            >
              Entrar na Conta
            </a>
            <a
              href="#solicitar"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full bg-[#F5A623] text-black text-center py-4 rounded-xl font-bold"
            >
              Solicitar Acesso
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
