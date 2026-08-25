import BrandMark from './BrandMark';
import { BRAND, WHATSAPP_URL } from '../brand';

export default function Footer() {
  return <footer className="marketing-footer"><div className="marketing-shell"><BrandMark/><nav aria-label="Rodapé"><a href="#produto">Produto</a><a href="#operacao">Recursos</a><a href="#integracoes">Integrações</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer">Contato</a></nav><p>© {new Date().getFullYear()} {BRAND.name}</p></div></footer>;
}
