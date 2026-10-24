import BrandMark from "./BrandMark";
import { WHATSAPP_URL } from "../brand";
export default function Footer() {
  return (
    <footer className="sales-footer">
      <div className="sales-shell">
        <div className="footer-top">
          <BrandMark />
          <p>
            Mais inteligência para sua empresa
            <br />
            proteger mais e crescer melhor.
          </p>
          <nav aria-label="Rodapé">
            <a href="#produto">Plataforma</a>
            <a href="#simulador">Simulador</a>
            <a href="#planos">Planos</a>
            <a href="#faq">Dúvidas</a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              Contato
            </a>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Monitora 360. Todos os direitos
            reservados.
          </span>
          <span>FEITO PARA MANTER SUA OPERAÇÃO EM MOVIMENTO.</span>
        </div>
      </div>
    </footer>
  );
}
