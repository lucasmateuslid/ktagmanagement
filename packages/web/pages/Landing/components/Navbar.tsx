import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import BrandMark from "./BrandMark";
const NAV_ITEMS = [
  ["Plataforma", "#produto"],
  ["Como funciona", "#como-funciona"],
  ["Simulador", "#simulador"],
  ["Planos", "#planos"],
] as const;
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header className="sales-nav">
      <div className="sales-shell sales-nav__inner">
        <BrandMark />
        <nav className="sales-nav__links" aria-label="Navegação principal">
          {NAV_ITEMS.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <Button asChild className="sales-button sales-nav__cta">
          <a href="#demonstracao">
            Falar com especialista <ArrowUpRight size={16} />
          </a>
        </Button>
        <button
          ref={toggle}
          className="sales-nav__toggle"
          type="button"
          aria-expanded={open}
          aria-controls="sales-mobile-menu"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <nav
        id="sales-mobile-menu"
        hidden={!open}
        className="sales-mobile-menu"
        aria-label="Navegação mobile"
      >
        {NAV_ITEMS.map(([label, href]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
        <a href="#demonstracao" onClick={() => setOpen(false)}>
          Falar com especialista <ArrowUpRight size={16} />
        </a>
      </nav>
    </header>
  );
}
