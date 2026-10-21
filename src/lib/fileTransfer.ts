import { IMPORT_MAX_FILE_BYTES } from "@/config/constants";

/**
 * Importação e exportação de ficha em arquivo JSON.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEGURANÇA (seção 6)
 *  - O conteúdo NUNCA é executado: só `JSON.parse` + schema Zod.
 *  - O tamanho é conferido ANTES de ler, para não travar a aba com um
 *    arquivo enorme.
 *  - Só aceitamos `application/json` e `.json`, mas a checagem é apenas
 *    de UX: a validação real é o schema.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Erro de importação já com mensagem em pt-BR. */
export class FileReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileReadError";
  }
}

/** Lê um arquivo `.json` escolhido pelo usuário e devolve o texto. */
export async function readJsonFile(file: File): Promise<string> {
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    throw new FileReadError("O arquivo é grande demais para importar.");
  }

  const text = await file.text();

  // Segunda barreira: o `File.size` pode mentir em alguns casos (arquivo
  // virtual), então conferimos o conteúdo também.
  if (text.length > IMPORT_MAX_FILE_BYTES) {
    throw new FileReadError("O arquivo é grande demais para importar.");
  }

  return text;
}

/**
 * Dispara o download de um texto como arquivo.
 *
 * O objeto `URL` é revogado logo em seguida — sem isso, o blob fica preso
 * na memória até a aba ser fechada.
 */
export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType = "application/json",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

/** Formata uma data ISO em pt-BR, tolerando valor inválido. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
