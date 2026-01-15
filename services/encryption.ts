
/**
 * Enterprise Data Encryption Service (E2EE)
 * Utiliza AES-GCM para confidencialidade e autenticidade.
 */

class EncryptionService {
  private key: CryptoKey | null = null;
  private readonly algorithm = 'AES-GCM';

  // Deriva uma chave robusta a partir do ID do usuário ou senha
  async initialize(seed: string) {
    if (!seed) return;
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(seed),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    this.key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('ktag-enterprise-salt-2025'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(text: string): Promise<string> {
    if (!this.key || !text) return text;
    
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12)); // IV único para cada operação
      const encoder = new TextEncoder();
      const encoded = encoder.encode(text);

      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm, iv },
        this.key,
        encoded
      );

      // Concatena IV + Dados Criptografados e converte para Base64
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode(...combined));
    } catch (e) {
      console.error("Erro na criptografia:", e);
      return text;
    }
  }

  async decrypt(base64: string): Promise<string> {
    // Se não houver chave ou o texto for muito curto, provavelmente não está criptografado
    if (!this.key || !base64 || base64.length < 16) return base64;

    try {
      const binaryString = atob(base64);
      const combined = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        combined[i] = binaryString.charCodeAt(i);
      }

      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm, iv },
        this.key,
        data
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      // Falha silenciosa para permitir leitura de dados legados em texto plano
      return base64;
    }
  }
}

export const encryption = new EncryptionService();
