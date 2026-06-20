export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // hard reject acima disso (evita DoS de memória no canvas/FileReader)
export const MAX_BASE64_BYTES = 360 * 1024;       // teto após resize, defensivo
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

/**
 * Lê um arquivo de imagem e retorna como base64, redimensionando via canvas
 * (mantém aspect ratio, máx 512px no maior lado) para caber no teto de
 * armazenamento. SVG passa direto, já é vetorial e leve.
 */
export async function readImageAsBase64(file: File): Promise<string> {
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao ler SVG.'));
      reader.readAsDataURL(file);
    });
  }

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 512;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const r = Math.min(MAX / width, MAX / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas indisponível.'));
      ctx.drawImage(img, 0, 0, width, height);
      const out = canvas.toDataURL('image/png', 0.92);
      resolve(out);
    };
    img.onerror = () => reject(new Error('Imagem inválida.'));
    img.src = dataUrl;
  });
}
