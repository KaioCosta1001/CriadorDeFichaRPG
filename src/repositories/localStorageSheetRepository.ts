import type { z } from "zod";

import {
  EXPORT_FILE_EXTENSION,
  EXPORT_FILE_PREFIX,
  IMPORT_MAX_FILE_BYTES,
  QUARANTINE_MAX_ITEMS,
  SCHEMA_VERSION,
  SHEET_TITLE_MAX_LENGTH,
  STORAGE_KEYS,
  quarantineStorageKey,
  sheetStorageKey,
} from "@/config/constants";
import { migrateDocument } from "@/domain/migrations";
import {
  DEFAULT_APP_SETTINGS,
  createBlankSheet,
  createSheet,
  toSheetSummary,
} from "@/domain/sheetFactory";
import { generateId } from "@/lib/id";
import {
  isStorageAvailable,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/safeStorage";
import {
  AppSettingsSchema,
  QuarantineIndexSchema,
  QuarantinedDocumentSchema,
  SheetIndexSchema,
  SheetSchema,
  type AppSettings,
  type CreateSheetInput,
  type Item,
  type QuarantineSummary,
  type Sheet,
  type SheetSummary,
  type Weapon,
} from "@/schemas";

import { ImportError, RepositoryError, type SheetRepository } from "./types";

/* ===========================================================================
 * FUNÇÕES AUXILIARES
 * ========================================================================== */

/** Concatenador de caminhos de erro do Zod em texto legível. */
function formatIssuePath(path: PropertyKey[] | undefined): string | null {
  if (!path || path.length === 0) return null;
  return path.map(String).join(".");
}

/** Primeira mensagem de erro do Zod, já em português. */
function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Dados inválidos";
  const path = formatIssuePath(issue.path);
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Lê e faz o parse de uma chave, devolvendo `null` em qualquer falha. */
function readJson<T>(key: string, schema: z.ZodType<T>): T | null {
  const raw = safeGetItem(key);
  if (raw === null) return null;
  try {
    const result = schema.safeParse(JSON.parse(raw) as unknown);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/* ===========================================================================
 * IMPLEMENTAÇÃO
 * ========================================================================== */

/**
 * Persistência em `localStorage`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ESTE É O ARQUIVO QUE TROCA QUANDO FOR PARA MONGODB.
 * A interface `SheetRepository` (em `types.ts`) é o contrato; nada acima
 * dela conhece `localStorage`. Veja `repositories/index.ts`.
 *
 * Uma chave por ficha (e não um array único) é deliberado:
 *  - um documento corrompido afeta só a si mesmo;
 *  - a quarentena guarda o TEXTO CRU intacto, então "exportar o bruto"
 *    funciona de verdade;
 *  - criar/remover uma ficha é uma única operação de storage;
 *  - salvar uma ficha não reescreve as outras (cota de ~5 MB).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class LocalStorageSheetRepository implements SheetRepository {
  /* ----------------------------------------------------------------------- */
  /* LEITURA                                                                 */
  /* ----------------------------------------------------------------------- */

  async listSheets(): Promise<SheetSummary[]> {
    const index = readJson(STORAGE_KEYS.sheets, SheetIndexSchema) ?? [];

    // Ordenação: mais atualizada primeiro. Datas ISO ordenam lexicograficamente.
    return [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getSheet(id: string): Promise<Sheet | null> {
    const key = sheetStorageKey(id);
    const raw = safeGetItem(key);
    if (raw === null) return null;

    const outcome = this.parseOrQuarantine(raw, key);

    if (outcome.status === "quarantined") {
      // Remove o documento ruim do lugar original: ele não volta a ser lido,
      // mas o texto bruto está preservado na quarentena para recuperação.
      safeRemoveItem(key);
      return null;
    }

    return outcome.sheet;
  }

  /* ----------------------------------------------------------------------- */
  /* ESCRITA                                                                 */
  /* ----------------------------------------------------------------------- */

  async createSheet(data: CreateSheetInput): Promise<Sheet> {
    const sheet = createSheet(data);
    await this.persist(sheet);
    return sheet;
  }

  async updateSheet(id: string, sheet: Sheet): Promise<Sheet> {
    const current = await this.getSheet(id);
    if (!current) {
      throw new RepositoryError("Ficha não encontrada.");
    }

    // O `updatedAt` é sempre reescrito aqui: nenhum componente precisa
    // lembrar de tocá-lo, então a listagem nunca fica desatualizada.
    const next: Sheet = {
      ...sheet,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(next);
    return next;
  }

  async deleteSheet(id: string): Promise<void> {
    safeRemoveItem(sheetStorageKey(id));

    const index = (await this.readIndex()).filter((entry) => entry.id !== id);
    this.writeIndex(index);
  }

  /**
   * Duplica a ficha com IDs NOVOS.
   *
   * Não basta gerar um id novo para a ficha: se os ids internos fossem
   * reaproveitados, dois personagens teriam atributos com o mesmo id e
   * vincular a perícia ao atributo poderia apontar para o objeto errado.
   */
  async duplicateSheet(id: string): Promise<Sheet> {
    const original = await this.getSheet(id);
    if (!original) {
      throw new RepositoryError("Ficha não encontrada.");
    }

    // Mapa id antigo -> id novo, para reescrever todos os vínculos.
    const remap = new Map<string, string>();

    const attributes = original.attributes.map((attribute) => {
      const nextId = generateId();
      remap.set(attribute.id, nextId);
      return { ...attribute, id: nextId };
    });

    // Nao ha mais vinculo para reescrever: desde o adendo de rolagem, a
    // pericia nao guarda `attributeId`. O `remap` continua necessario pelas
    // armas, que referenciam varios atributos por `attributeIds`.
    const skills = original.skills.map((skill) => ({
      ...skill,
      id: generateId(),
    }));

    // Armas e itens se referenciam por id, então armas primeiro; os itens
    // traduzem `equippedWeaponId` depois de saber os ids novos das armas.
    // As anotações explícitas impedem o TypeScript de inferir `null` como
    // tipo literal a partir de `{ itemId: null }`.
    const weapons: Weapon[] = original.inventory.weapons.map((weapon) => {
      const nextId = generateId();
      remap.set(weapon.id, nextId);
      return {
        ...weapon,
        id: nextId,
        attributeIds: weapon.attributeIds.map(
          (attrId) => remap.get(attrId) ?? attrId,
        ),
        itemId: null,
      };
    });

    const items: Item[] = original.inventory.items.map((item) => {
      const nextId = generateId();
      remap.set(item.id, nextId);
      return {
        ...item,
        id: nextId,
        weaponData: item.weaponData
          ? {
              ...item.weaponData,
              attributeIds: item.weaponData.attributeIds.map(
                (attrId) => remap.get(attrId) ?? attrId,
              ),
            }
          : null,
        equippedWeaponId: null,
      };
    });

    // Segunda passada: liga cada item ao id da arma que veio do mesmo original.
    weapons.forEach((weapon, index) => {
      const originalWeapon = original.inventory.weapons[index];
      if (!originalWeapon?.itemId) return;
      weapon.itemId = remap.get(originalWeapon.itemId) ?? null;
    });

    items.forEach((item, index) => {
      const originalItem = original.inventory.items[index];
      if (!originalItem?.equippedWeaponId) return;
      item.equippedWeaponId = remap.get(originalItem.equippedWeaponId) ?? null;
    });

    const extraPanels = original.extraPanels.map((panel) => ({
      ...panel,
      id: generateId(),
      entries: panel.entries.map((entry) => ({ ...entry, id: generateId() })),
    }));

    const copy = SheetSchema.parse({
      ...original,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: original.name,
      title: `${original.title || original.name} (cópia)`.slice(
        0,
        SHEET_TITLE_MAX_LENGTH,
      ),
      attributes,
      skills,
      inventory: {
        ...original.inventory,
        weapons,
        items,
        money: { ...original.inventory.money },
      },
      extraPanels,
      layout: original.layout.map((entry) => ({ ...entry })),
      rollHistory: [],
    });

    await this.persist(copy);
    return copy;
  }

  /* ----------------------------------------------------------------------- */
  /* CONFIGURAÇÕES                                                           */
  /* ----------------------------------------------------------------------- */

  async getSettings(): Promise<AppSettings> {
    return (
      readJson(STORAGE_KEYS.settings, AppSettingsSchema) ?? DEFAULT_APP_SETTINGS
    );
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    // Valida ANTES de gravar: nunca persistimos algo que não sai do schema.
    const validated = AppSettingsSchema.parse(settings);
    const ok = safeSetItem(STORAGE_KEYS.settings, JSON.stringify(validated));
    if (!ok) {
      throw new RepositoryError("Não foi possível salvar as configurações.");
    }
    return validated;
  }

  /* ----------------------------------------------------------------------- */
  /* IMPORT / EXPORT                                                         */
  /* ----------------------------------------------------------------------- */

  async exportSheet(id: string): Promise<string> {
    const sheet = await this.getSheet(id);
    if (!sheet) {
      throw new RepositoryError("Ficha não encontrada.");
    }
    return JSON.stringify(sheet, null, 2);
  }

  /**
   * Importa uma ficha de um JSON.
   *
   * Três defesas, nesta ordem (seção 6):
   *  1. Tamanho máximo do texto.
   *  2. `JSON.parse` dentro de `try/catch` — conteúdo NUNCA é executado,
   *     só lido como dado e validado por schema.
   *  3. Validação por schema + geração de ids novos, para o import não
   *     sobrescrever nem colidir com uma ficha existente.
   */
  async importSheet(json: string): Promise<Sheet> {
    if (json.length > IMPORT_MAX_FILE_BYTES) {
      throw new ImportError("Arquivo muito grande para importar.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json) as unknown;
    } catch {
      throw new ImportError("O arquivo não contém um JSON válido.");
    }

    const migrated = migrateDocument(parsed);
    if (migrated.status !== "ok") {
      throw new ImportError("Formato de ficha não reconhecido.");
    }

    const result = SheetSchema.safeParse(migrated.document);
    if (!result.success) {
      throw new ImportError(
        `Ficha inválida — ${firstIssueMessage(result.error)}`,
      );
    }

    // Ficha nova só para herdar id e timestamps válidos; o conteúdo
    // importado é copiado em seguida.
    const sheet = createBlankSheet({
      system: result.data.system,
      templateId: result.data.templateId,
      name: result.data.name,
      title: result.data.title,
    });

    // Todos os ids são novos: importar duas vezes o mesmo arquivo não pode
    // fazer a segunda cópia sobrescrever a primeira.
    const imported = SheetSchema.parse({
      ...result.data,
      id: sheet.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attributes: result.data.attributes.map((attribute) => ({
        ...attribute,
        id: generateId(),
      })),
      skills: result.data.skills.map((skill) => ({
        ...skill,
        id: generateId(),
        attributeId: null,
      })),
      inventory: {
        ...result.data.inventory,
        weapons: result.data.inventory.weapons.map((weapon) => ({
          ...weapon,
          id: generateId(),
          attributeIds: [],
          itemId: null,
        })),
        items: result.data.inventory.items.map((item) => ({
          ...item,
          id: generateId(),
          equippedWeaponId: null,
        })),
      },
      extraPanels: result.data.extraPanels.map((panel) => ({
        ...panel,
        id: generateId(),
        entries: panel.entries.map((entry) => ({ ...entry, id: generateId() })),
      })),
    });

    await this.persist(imported);
    return imported;
  }

  /* ----------------------------------------------------------------------- */
  /* QUARENTENA                                                              */
  /* ----------------------------------------------------------------------- */

  async listQuarantine(): Promise<QuarantineSummary[]> {
    return this.readQuarantineIndex();
  }

  async getQuarantinedRaw(id: string): Promise<string | null> {
    const document = readJson(
      quarantineStorageKey(id),
      QuarantinedDocumentSchema,
    );
    return document?.raw ?? null;
  }

  async discardQuarantine(id: string): Promise<void> {
    safeRemoveItem(quarantineStorageKey(id));
    const index = (await this.listQuarantine()).filter(
      (entry) => entry.id !== id,
    );
    safeSetItem(STORAGE_KEYS.quarantine, JSON.stringify(index));
  }

  async discardAllQuarantine(): Promise<void> {
    const index = await this.listQuarantine();
    for (const entry of index) {
      safeRemoveItem(quarantineStorageKey(entry.id));
    }
    safeRemoveItem(STORAGE_KEYS.quarantine);
  }

  /* ----------------------------------------------------------------------- */
  /* INTERNOS                                                                */
  /* ----------------------------------------------------------------------- */

  /** Grava a ficha e atualiza o índice da listagem. */
  private async persist(sheet: Sheet): Promise<void> {
    if (!isStorageAvailable()) {
      throw new RepositoryError(
        "Armazenamento indisponível neste navegador (modo privado?).",
      );
    }

    const ok = safeSetItem(sheetStorageKey(sheet.id), JSON.stringify(sheet));
    if (!ok) {
      throw new RepositoryError(
        "Não foi possível salvar a ficha. O armazenamento pode estar cheio — " +
          "tente remover fotos grandes ou exporte e descarte fichas antigas.",
      );
    }

    const index = await this.readIndex();
    const summary = toSheetSummary(sheet);
    const position = index.findIndex((entry) => entry.id === sheet.id);

    if (position === -1) index.push(summary);
    else index[position] = summary;

    this.writeIndex(index);
  }

  private async readIndex(): Promise<SheetSummary[]> {
    return readJson(STORAGE_KEYS.sheets, SheetIndexSchema) ?? [];
  }

  private writeIndex(index: SheetSummary[]): void {
    safeSetItem(STORAGE_KEYS.sheets, JSON.stringify(index));
  }

  /**
   * Valida um documento cru, migrando-o antes.
   *
   * Se falhar, isola o documento na quarentena em vez de deixar o app
   * quebrar (seção 5.9).
   */
  private parseOrQuarantine(
    raw: string,
    sourceKey: string,
  ): { status: "ok"; sheet: Sheet } | { status: "quarantined" } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (error) {
      this.quarantine(
        raw,
        sourceKey,
        `JSON inválido: ${(error as Error).message}`,
        null,
      );
      return { status: "quarantined" };
    }

    const migrated = migrateDocument(parsed);

    if (migrated.status === "too-new") {
      this.quarantine(
        raw,
        sourceKey,
        `Documento na versão ${migrated.declared}, mais nova que a versão ${SCHEMA_VERSION} deste app.`,
        null,
      );
      return { status: "quarantined" };
    }

    if (migrated.status === "unknown-version") {
      this.quarantine(
        raw,
        sourceKey,
        "Não foi possível ler a versão do documento.",
        null,
      );
      return { status: "quarantined" };
    }

    const result = SheetSchema.safeParse(migrated.document);
    if (!result.success) {
      this.quarantine(
        raw,
        sourceKey,
        firstIssueMessage(result.error),
        formatIssuePath(result.error.issues[0]?.path),
      );
      return { status: "quarantined" };
    }

    return { status: "ok", sheet: result.data };
  }

  /**
   * Isola um documento inválido.
   *
   * Guarda o TEXTO CRU — é ele que permite ao usuário exportar e recuperar
   * o que o app não conseguiu entender. O índice é limitado por
   * `QUARANTINE_MAX_ITEMS` para não acumular lixo indefinidamente.
   */
  private quarantine(
    raw: string,
    sourceKey: string,
    reason: string,
    path: string | null,
  ): void {
    const id = generateId();

    const summary: QuarantineSummary = {
      id,
      sourceKey,
      title: this.tryReadTitle(raw),
      declaredSchemaVersion: this.tryReadDeclaredVersion(raw),
      reason,
      path,
      quarantinedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    };

    const document = QuarantinedDocumentSchema.parse({ ...summary, raw });
    const ok = safeSetItem(quarantineStorageKey(id), JSON.stringify(document));
    if (!ok) {
      console.error(
        "[repositório] Não foi possível isolar o documento corrompido; ele será ignorado.",
      );
      return;
    }

    // Mais recente primeiro, limitado por `QUARANTINE_MAX_ITEMS` para não
    // acumular lixo indefinidamente.
    const existing = this.readQuarantineIndex();
    const index = [
      summary,
      ...existing.filter((entry) => entry.id !== id),
    ].slice(0, QUARANTINE_MAX_ITEMS);
    safeSetItem(STORAGE_KEYS.quarantine, JSON.stringify(index));
  }

  private readQuarantineIndex(): QuarantineSummary[] {
    return readJson(STORAGE_KEYS.quarantine, QuarantineIndexSchema) ?? [];
  }

  /** Lê `schemaVersion` de um texto, sem lançar. */
  private tryReadDeclaredVersion(raw: string): number | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "object" || parsed === null) return null;
      const value = (parsed as Record<string, unknown>).schemaVersion;
      return typeof value === "number" && Number.isInteger(value)
        ? value
        : null;
    } catch {
      return null;
    }
  }

  /** Lê o título de um texto, sem lançar — só para a lista de quarentena. */
  private tryReadTitle(raw: string): string | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "object" || parsed === null) return null;
      const record = parsed as Record<string, unknown>;
      for (const key of ["title", "name"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim().length > 0) {
          return value.trim().slice(0, 120);
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

/** Sugestão de nome de arquivo para a exportação (sem acento, sem espaço). */
export function buildExportFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    // Remove os diacríticos combinantes (o acento fica na sequência U+0300..U+036F).
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);

  return `${EXPORT_FILE_PREFIX}-${slug || "sem-nome"}${EXPORT_FILE_EXTENSION}`;
}
