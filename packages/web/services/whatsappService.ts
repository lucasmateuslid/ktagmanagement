import { storage } from './storage';
import { isValidPhone, toBrazilianE164 } from '@ktag/shared';

class WhatsAppService {
  /**
   * Envia uma mensagem via Evolution API
   */
  async sendMessage(phone: string, message: string): Promise<boolean> {
    try {
      const settings = await storage.getSettings();
      if (
        !settings?.enableWhatsAppNotifications || 
        !settings?.evolutionApiUrl || 
        !settings?.evolutionApiKey || 
        !settings?.evolutionInstanceName
      ) {
        return false;
      }

      if (!phone || !isValidPhone(phone)) return false;
      const formattedPhone = toBrazilianE164(phone);

      const url = `${settings.evolutionApiUrl}/message/sendText/${settings.evolutionInstanceName}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.evolutionApiKey
        },
        body: JSON.stringify({
          number: formattedPhone,
          options: {
            delay: 1500, // Dá um pequeno delay simulando digitação
            presence: "composing", 
            linkPreview: false
          },
          textMessage: {
            text: message
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na Evolution API: ${response.status} ${response.statusText}`);
      }

      console.log('[WhatsApp] Mensagem enviada com sucesso!');
      return true;
    } catch (error) {
      console.error('[WhatsApp] Falha ao enviar mensagem:', error);
      return false;
    }
  }
  
  /**
   * Templates de Mensagens Prontos
   */
  
  getScheduleStatusMessage(clientName: string, plate: string, status: string, datetime?: string): string {
    let msg = `Olá *${clientName || 'Cliente'}*! Aqui é o atendimento automático de despachos.\n\n`;
    msg += `Sua Ordem de Serviço da placa *${plate}* atualizou para o status: *${status}*.\n`;
    
    if (datetime && status === 'Confirmada') {
       msg += `📅 Está marcado para: *${datetime}*.\n`;
    }
    
    if (status === 'Técnico no local') {
        msg += `\n🧑‍🔧 Nosso técnico acaba de chegar no local! Por favor, receba-o.\n`;
    }

    if (status === 'Concluída') {
        msg += `\n✅ O serviço foi finalizado com sucesso! Agradecemos a confiança.\n`;
    }

    msg += `\n_Mensagem automática, não é necessário responder._`;
    return msg;
  }
}

export const whatsappService = new WhatsAppService();
