import { describe, expect, it } from 'vitest';
import { buildWhatsAppLeadUrl } from './LeadForm';

describe('buildWhatsAppLeadUrl', () => {
  it('gera o contato comercial provisório com todos os dados do lead', () => {
    const url = buildWhatsAppLeadUrl({
      name: 'Lucas', company: 'Operação Norte', phone: '84999999999',
      email: 'lucas@empresa.com.br', vehicles: 'De 501 a 2.000',
    });
    expect(url).toMatch(/^https:\/\/wa\.me\/558440028922\?text=/);
    const message = decodeURIComponent(url.split('?text=')[1]);
    expect(message).toContain('Quero conhecer o Monitora360');
    expect(message).toContain('Empresa: Operação Norte');
    expect(message).toContain('Quantidade aproximada de veículos: De 501 a 2.000');
  });
});
