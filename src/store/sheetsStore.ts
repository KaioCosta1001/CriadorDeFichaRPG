"use client";

import { create } from "zustand";

import { ImportError, sheetRepository } from "@/repositories";
import type {
  CreateSheetInput,
  QuarantineSummary,
  SheetSummary,
} from "@/schemas";

/**
 * Estado da TELA DE LISTAGEM de fichas.
 *
 * Separado do `sheetStore` porque os dois têm ciclos de vida diferentes: a
 * listagem existe mesmo sem ficha aberta, e recarregar a lista não deve
 * tocar na ficha em edição.
 */

export type SheetsStatus = "loading" | "ready" | "error";

interface SheetsState {
  status: SheetsStatus;
  sheets: SheetSummary[];
  /** Documentos corrompidos isolados (seção 5.9). */
  quarantine: QuarantineSummary[];
  error: string | null;
  /** Mensagem temporária para a interface (sucesso/erro de uma ação). */
  notice: { kind: "info" | "success" | "error"; text: string } | null;

  reload: () => Promise<void>;
  create: (input: CreateSheetInput) => Promise<string>;
  duplicate: (id: string) => Promise<string | null>;
  remove: (id: string) => Promise<boolean>;
  importFrom: (json: string) => Promise<string | null>;
  exportAs: (id: string) => Promise<string | null>;

  discardQuarantine: (id: string) => Promise<void>;
  discardAllQuarantine: () => Promise<void>;
  exportQuarantinedRaw: (id: string) => Promise<string | null>;

  setNotice: (notice: SheetsState["notice"]) => void;
}

/** Traduz um erro desconhecido em texto exibível ao usuário. */
function describeError(error: unknown): string {
  if (error instanceof ImportError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Ocorreu um erro inesperado.";
}

export const useSheetsStore = create<SheetsState>((set, get) => ({
  status: "loading",
  sheets: [],
  quarantine: [],
  error: null,
  notice: null,

  async reload() {
    set({ status: "loading" });
    try {
      const [sheets, quarantine] = await Promise.all([
        sheetRepository.listSheets(),
        sheetRepository.listQuarantine(),
      ]);
      set({ status: "ready", sheets, quarantine, error: null });
    } catch (error) {
      console.error("[fichas] Falha ao listar.", error);
      set({
        status: "error",
        error: "Não foi possível carregar as fichas.",
      });
    }
  },

  async create(input) {
    try {
      const sheet = await sheetRepository.createSheet(input);
      await get().reload();
      set({
        notice: { kind: "success", text: "Ficha criada." },
      });
      return sheet.id;
    } catch (error) {
      set({ notice: { kind: "error", text: describeError(error) } });
      return "";
    }
  },

  async duplicate(id) {
    try {
      const copy = await sheetRepository.duplicateSheet(id);
      await get().reload();
      set({ notice: { kind: "success", text: "Ficha duplicada." } });
      return copy.id;
    } catch (error) {
      set({ notice: { kind: "error", text: describeError(error) } });
      return null;
    }
  },

  async remove(id) {
    try {
      await sheetRepository.deleteSheet(id);
      await get().reload();
      set({ notice: { kind: "success", text: "Ficha excluída." } });
      return true;
    } catch (error) {
      set({ notice: { kind: "error", text: describeError(error) } });
      return false;
    }
  },

  async importFrom(json) {
    try {
      const sheet = await sheetRepository.importSheet(json);
      await get().reload();
      set({ notice: { kind: "success", text: "Ficha importada." } });
      return sheet.id;
    } catch (error) {
      set({ notice: { kind: "error", text: describeError(error) } });
      return null;
    }
  },

  async exportAs(id) {
    try {
      return await sheetRepository.exportSheet(id);
    } catch (error) {
      set({ notice: { kind: "error", text: describeError(error) } });
      return null;
    }
  },

  async discardQuarantine(id) {
    await sheetRepository.discardQuarantine(id);
    set({ quarantine: get().quarantine.filter((entry) => entry.id !== id) });
  },

  async discardAllQuarantine() {
    await sheetRepository.discardAllQuarantine();
    set({ quarantine: [] });
    set({ notice: { kind: "success", text: "Documentos descartados." } });
  },

  async exportQuarantinedRaw(id) {
    return sheetRepository.getQuarantinedRaw(id);
  },

  setNotice(notice) {
    set({ notice });
  },
}));

/** Recomeça do zero. Só existe para os testes. */
export function resetSheetsStoreForTests(): void {
  useSheetsStore.setState({
    status: "loading",
    sheets: [],
    quarantine: [],
    error: null,
    notice: null,
  });
}
