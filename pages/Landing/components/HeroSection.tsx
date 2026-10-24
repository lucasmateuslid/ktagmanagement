import { ArrowDown, ArrowUpRight, Check, Layers, Radio } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { OperationWindow } from "./OperationPreview";
export default function HeroSection() {
  return (
    <section id="topo" className="sales-hero">
      <div className="sales-shell">
        <div className="sales-hero__grid">
          <div className="sales-hero__copy">
            <span className="hero-label">
              <span /> MAIS PROTEÇÃO. MAIS POSSIBILIDADES.
            </span>
            <h1>
              Proteja muito <br />
              mais.
              <br />
              <span>
                Gastando <br />
                bem menos.
              </span>
            </h1>
            <p>
              Faça sua empresa de rastreamento ou proteção veicular crescer com
              localização, estoque, chips e ocorrências sob controle.
            </p>
            <div className="hero-actions">
              <Button asChild className="sales-button" size="lg">
                <a href="#simulador">
                  Calcular meu plano <ArrowUpRight size={18} />
                </a>
              </Button>
              <a className="sales-text-link" href="#produto">
                Ver como funciona <ArrowDown size={16} />
              </a>
            </div>
            <div className="hero-checks">
              <span>
                <Check size={14} /> Integrado ao seu sistema
              </span>
              <span>
                <Check size={14} /> Ou sua própria central de rastreamento
              </span>
            </div>
          </div>
          <div className="sales-hero__visual">
            <div className="hero-window-label">
              <span>
                <Radio size={13} /> SUA OPERAÇÃO, CONECTADA
              </span>
              <span>360°</span>
            </div>
            <OperationWindow />
            <div className="hero-connection">
              <span>
                <Layers size={19} />
              </span>
              <div>
                <strong>Mais controle para ir mais longe.</strong>
                <p>Rastreamento + estoque + chips + ocorrências</p>
              </div>
              <ArrowUpRight size={19} />
            </div>
          </div>
        </div>
        <div className="hero-bottom">
          <span>
            FEITO PARA QUEM
            <br />
            <strong>protege o que importa.</strong>
          </span>
          <span>Empresas de rastreamento</span>
          <span>Associações de proteção veicular</span>
          <a href="#como-funciona" aria-label="Conhecer os modos de uso">
            <ArrowDown size={20} />
          </a>
        </div>
      </div>
    </section>
  );
}
