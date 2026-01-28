
/**
 * Enterprise Data Encryption Service (E2EE)
 * Utiliza AES-GCM para confidencialidade e autenticidade.
 */

class EncryptionService {
  private key: CryptoKey | null = null;
  private readonly algorithm = 'AES-GCM';
  private initializationPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  public isReady: boolean = false;

  constructor() {
    this.initializationPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  // Garante que qualquer chamada aguarde a inicialização
  async waitReady() {
    if (this.isReady) return;
    return this.initializationPromise;
  }

  // Deriva uma chave robusta a partir do ID do usuário ou senha
  async initialize(seed: string) {
    if (!seed) return;
    
    try {
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(seed),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // Generate cryptographically secure random salt
      const salt = crypto.getRandomValues(new Uint8Array(32));
      
      this.key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 600000, // Increased from 100k to 600k for better security
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: this.algorithm, length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      this.isReady = true;
      if (this.resolveReady) this.resolveReady();
    } catch (e) {
      console.error("Erro ao inicializar motor de segurança:", e);
    }
  }

  async encrypt(text: string): Promise<string> {
    if (!text) return text;
    await this.waitReady(); // Bloqueia até ter a chave
    if (!this.key) return text;
    
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const encoded = encoder.encode(text);

      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm, iv },
        this.key,
        encoded
      );

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
    // Se a string não parecer base64 ou for muito curta, retorna original
    if (!base64 || base64.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(base64)) {
        return base64;
    }

    await this.waitReady(); // Crucial: aguarda a chave estar na memória
    if (!this.key) return base64;

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
      // Se falhar a decriptografia, provavelmente o dado não está encriptado 
      // ou a chave mudou. Retorna o original para evitar quebra da UI.
      return base64;
    }
  }
}

export const encryption = new EncryptionService();
