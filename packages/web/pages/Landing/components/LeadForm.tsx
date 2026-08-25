import { FormEvent, useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { BRAND, WHATSAPP_URL } from '../brand';

type Lead = { name: string; company: string; phone: string; email: string; vehicles: string };
const initialLead: Lead = { name: '', company: '', phone: '', email: '', vehicles: '' };

export function buildWhatsAppLeadUrl(lead: Lead) {
  const message = [
    'Olá! Quero conhecer o Monitora360.', '',
    `Nome: ${lead.name}`, `Empresa: ${lead.company}`, `WhatsApp: ${lead.phone}`,
    `E-mail corporativo: ${lead.email}`, `Quantidade aproximada de veículos: ${lead.vehicles}`,
  ].join('\n');
  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}

export default function LeadForm() {
  const [lead, setLead] = useState(initialLead);
  const [error, setError] = useState('');
  const update = (field: keyof Lead, value: string) => setLead(current => ({ ...current, [field]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const phoneDigits = lead.phone.replace(/\D/g, '');
    if (!lead.name.trim() || !lead.company.trim() || phoneDigits.length < 10 || !/^\S+@\S+\.\S+$/.test(lead.email) || !lead.vehicles) {
      setError('Preencha todos os campos com dados válidos.');
      return;
    }
    setError('');
    window.open(buildWhatsAppLeadUrl({ ...lead, phone: phoneDigits }), '_blank', 'noopener,noreferrer');
  };
  return (
    <section id="demonstracao" className="marketing-section final-cta">
      <div className="marketing-shell final-cta__grid">
        <div><p className="marketing-kicker">Próximo passo</p><h2>Sua operação cresceu.<br/>O sistema também precisa crescer.</h2><p>Veja como o Monitora360 pode organizar sua operação de rastreamento.</p><div className="contact-line"><MessageCircle/><span>Atendimento comercial via WhatsApp<small>{BRAND.domain}</small></span></div></div>
        <form onSubmit={submit} noValidate>
          <div className="form-grid"><label><span>Nome</span><input value={lead.name} onChange={e => update('name', e.target.value)} autoComplete="name" placeholder="Seu nome"/></label><label><span>Empresa</span><input value={lead.company} onChange={e => update('company', e.target.value)} autoComplete="organization" placeholder="Nome da operação"/></label><label><span>WhatsApp</span><input value={lead.phone} onChange={e => update('phone', e.target.value)} autoComplete="tel" inputMode="tel" placeholder="(00) 00000-0000"/></label><label><span>E-mail corporativo</span><input value={lead.email} onChange={e => update('email', e.target.value)} autoComplete="email" inputMode="email" placeholder="voce@empresa.com.br"/></label><label className="form-grid__wide"><span>Quantidade aproximada de veículos</span><select value={lead.vehicles} onChange={e => update('vehicles', e.target.value)}><option value="">Selecione uma faixa</option><option>Até 500</option><option>De 501 a 2.000</option><option>De 2.001 a 5.000</option><option>Mais de 5.000</option></select></label></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="marketing-button" type="submit">Quero conhecer o Monitora360 <ArrowRight/></button>
          <small>Ao continuar, uma conversa será aberta no WhatsApp com os dados acima.</small>
        </form>
      </div>
    </section>
  );
}
