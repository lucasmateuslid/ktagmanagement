import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import BrandMark from './BrandMark';

const NAV_ITEMS = [
  { label: 'Produto', href: '#produto' }, { label: 'Operação', href: '#operacao' },
  { label: 'Integrações', href: '#integracoes' }, { label: 'Para quem é', href: '#para-quem' }, { label: 'FAQ', href: '#faq' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 24); onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false); document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [open]);
  return (
    <header className={`marketing-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="marketing-shell marketing-nav__inner">
        <BrandMark />
        <nav className="marketing-nav__links" aria-label="Navegação principal">{NAV_ITEMS.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        <a className="marketing-button marketing-button--compact" href="#demonstracao">Agendar demonstração</a>
        <button className="marketing-nav__toggle" type="button" aria-expanded={open} aria-controls="marketing-mobile-menu" aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen(value => !value)}>{open ? <X /> : <Menu />}</button>
      </div>
      <nav id="marketing-mobile-menu" className={`marketing-mobile-menu ${open ? 'is-open' : ''}`} aria-label="Navegação mobile">
        {NAV_ITEMS.map(item => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}
        <a className="marketing-button" href="#demonstracao" onClick={() => setOpen(false)}>Agendar demonstração</a>
      </nav>
    </header>
  );
}
