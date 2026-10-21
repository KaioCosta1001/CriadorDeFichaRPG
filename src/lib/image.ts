import {
  PHOTO_ALLOWED_MIME_TYPES,
  PHOTO_MAX_DIMENSION_PX,
  PHOTO_MAX_INPUT_BYTES,
  PHOTO_MAX_OUTPUT_BYTES,
  PHOTO_OUTPUT_MIME_TYPE,
  PHOTO_QUALITY,
} from "@/config/constants";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  FOTO DE PERFIL — REDIMENSIONAR E COMPRIMIR NO CLIENTE                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * POR QUE PROCESSAR NO CLIENTE (seção 6)
 * O `localStorage` tem ~5 MB e é compartilhado por TODA a origem. Guardar uma
 * foto de 3 MB em JPEG tiraria a cota de várias fichas, e o app deixaria de
 * salvar justamente quando o usuário mais usa.
 *
 * Pipeline: validar tipo e tamanho → decodificar → desenhar no canvas já no
 * tamanho final → codificar em JPEG com qualidade controlada → conferir o
 * resultado e reduzir a qualidade se ainda estiver grande.
 *
 * NUNCA renderizado como HTML: o resultado é um data URL usado em `<img>`.
 */

/** Erro de imagem com mensagem já pronta para exibir (pt-BR). */
export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

/** Verifica o tipo do arquivo antes de gastar memória decodificando-o. */
export function assertAcceptableImage(file: File): void {
  if (!(PHOTO_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageProcessingError(
      "Formato de imagem não suportado. Use JPG, PNG ou WEBP.",
    );
  }

  if (file.size > PHOTO_MAX_INPUT_BYTES) {
    throw new ImageProcessingError(
      "Imagem muito grande. Escolha um arquivo de até 5 MB.",
    );
  }

  if (file.size === 0) {
    throw new ImageProcessingError("O arquivo está vazio.");
  }
}

/**
 * Processa um arquivo de imagem e devolve o data URL comprimido.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PROPORÇÃO
 * A imagem é sempre reduzida por `PHOTO_MAX_DIMENSION_PX` no lado maior,
 * preservando a proporção. Reduzir sem preservar esticaria o retrato.
 * ───────────────────────────────────────────────────────────────────────────
 */
export async function processProfilePhoto(file: File): Promise<string> {
  assertAcceptableImage(file);

  const source = await decode(file);
  try {
    const { width, height } = fitWithin(source.width, source.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new ImageProcessingError(
        "Não foi possível preparar a imagem neste navegador.",
      );
    }

    context.drawImage(source.image, 0, 0, width, height);

    // Tenta qualidades decrescentes até caber na cota estimada.
    for (const quality of [PHOTO_QUALITY, 0.65, 0.5]) {
      const dataUrl = canvas.toDataURL(PHOTO_OUTPUT_MIME_TYPE, quality);
      if (dataUrl.length <= PHOTO_MAX_OUTPUT_BYTES * 1.4) return dataUrl;
    }

    // Ainda grande demais: entrega mesmo assim, mas o schema limita o
    // comprimento no save — e o usuário recebe o aviso de cota do storage.
    return canvas.toDataURL(PHOTO_OUTPUT_MIME_TYPE, 0.5);
  } finally {
    // O object URL segura o bitmap na memória enquanto a imagem não for
    // coletada. Sem este revoke, abrir 10 fotos seguidas vaza memória.
    if (source.objectUrl) URL.revokeObjectURL(source.objectUrl);
  }
}

/** Dimensions finais, respeitando o lado máximo e a proporção original. */
export function fitWithin(
  originalWidth: number,
  originalHeight: number,
): { width: number; height: number } {
  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new ImageProcessingError("Imagem com dimensões inválidas.");
  }

  const longest = Math.max(originalWidth, originalHeight);
  if (longest <= PHOTO_MAX_DIMENSION_PX) {
    return { width: originalWidth, height: originalHeight };
  }
  const ratio = PHOTO_MAX_DIMENSION_PX / longest;
  return {
    width: Math.max(1, Math.round(originalWidth * ratio)),
    height: Math.max(1, Math.round(originalHeight * ratio)),
  };
}

/** Decodifica o arquivo. Usa `createImageBitmap` quando existir. */
type Decoded =
  | {
      image: CanvasImageSource;
      width: number;
      height: number;
      objectUrl?: never;
    }
  | {
      image: CanvasImageSource;
      width: number;
      height: number;
      objectUrl: string;
    };

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Cai para o caminho com `<img>`, que é mais permissivo.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(
        new ImageProcessingError(
          "Não foi possível ler a imagem. O arquivo pode estar corrompido.",
        ),
      );
    image.src = objectUrl;
  });

  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    objectUrl,
  };
}
