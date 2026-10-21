import type {
  AppSettings,
  CreateSheetInput,
  QuarantineSummary,
  Sheet,
  SheetSummary,
} from "@/schemas";

/**
 * CONTRATO DE PERSISTÊNCIA (seção 5.2)
 * =============================================================================
 *
 * Este é o ÚNICO ponto que a camada de dados precisa conhecer. Tudo acima
 * (componentes, regras de negócio, stores) fala apenas com esta interface.
 *
 * TODOS os métodos são ASSÍNCRONOS, mesmo os de `localStorage`, que por
 * natureza é síncrono. A razão é simples: quando este contrato for
 * trocado por `MongoSheetRepository` (ver `repositories/index.ts`), nada
 * acima precisa mudar — nem `await` precisa ser adicionado em lugar nenhum.
 *
 * ── COMO TROCAR LOCALSTORAGE POR MONGODB ────────────────────────────────────
 * 1. Escreva `MongoSheetRepository implements SheetRepository`, falando com
 *    Route Handlers do Next (`src/app/api/...`).
 * 2. Troque UMA LINHA em `src/repositories/index.ts`.
 * Nenhum outro arquivo do projeto é alterado.
 */
export interface SheetRepository {
  /**
   * Lista as fichas para a tela inicial.
   *
   * Documentos corrompidos NÃO aparecem aqui: são isolados internamente e
   * ficam disponíveis em `listQuarantine()`.
   */
  listSheets(): Promise<SheetSummary[]>;

  /** Lê uma ficha. Devolve `null` se ela não existir. */
  getSheet(id: string): Promise<Sheet | null>;

  /** Cria uma ficha a partir dos dados de entrada e a persiste. */
  createSheet(data: CreateSheetInput): Promise<Sheet>;

  /** Substitui uma ficha existente. Lança se ela não existir. */
  updateSheet(id: string, sheet: Sheet): Promise<Sheet>;

  /** Remove definitivamente uma ficha. */
  deleteSheet(id: string): Promise<void>;

  /**
   * Cria uma cópia da ficha com IDs NOVOS (seção 5.6).
   * Os vínculos internos (arma ↔ item, perícia ↔ atributo, painel ↔ layout)
   * são reescritos junto, para a cópia não colidir com a original.
   */
  duplicateSheet(id: string): Promise<Sheet>;

  /** Configurações globais do app (hoje: tema). */
  getSettings(): Promise<AppSettings>;

  saveSettings(settings: AppSettings): Promise<AppSettings>;

  /** Ficha como JSON legível (string). Usado no download do arquivo. */
  exportSheet(id: string): Promise<string>;

  /**
   * Valida e cria uma ficha a partir de um JSON.
   * Gera IDs novos para não colidir com o que já existe.
   * Lança `ImportError` com mensagem em pt-BR quando o arquivo é inválido.
   */
  importSheet(json: string): Promise<Sheet>;

  /** Documentos que falharam na validação (seção 5.9). */
  listQuarantine(): Promise<QuarantineSummary[]>;

  /** Texto bruto de um documento isolado — para o usuário exportar e salvar. */
  getQuarantinedRaw(id: string): Promise<string | null>;

  /** Descarta um documento isolado. */
  discardQuarantine(id: string): Promise<void>;

  /** Descarta todos os documentos isolados. */
  discardAllQuarantine(): Promise<void>;
}

/** Erro de importação com mensagem já pronta para exibir ao usuário (pt-BR). */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

/** Erro genérico da camada de dados, com mensagem em pt-BR. */
export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}
