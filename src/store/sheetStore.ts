"use client";

import { create } from "zustand";

import { SAVE_DEBOUNCE_MS } from "@/config/constants";
import { SheetSchema, type Sheet } from "@/schemas";
import { createDebouncedTask, type DebouncedTask } from "@/lib/debounce";
import { sheetRepository } from "@/repositories";

/**
 * Estado da FICHA ABERTA em edição.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE O ESTADO VIVE AQUI E NÃO NO REPOSITÓRIO
 * O repositório é a FONTE DE VERDADE persistida, mas digitação não pode ir
 * para o disco a cada tecla (seção 5.10). Então:
 *   - a UI mexe neste store (síncrono, instantâneo);
 *   - uma gravação agrupada (`SAVE_DEBOUNCE_MS`) leva o estado ao repositório.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE OS DADOS PASSAM PELO `SheetSchema` AO ENTRAR
 * `mutate` recebe e devolve uma ficha inteira. Validar na borda garante que
 * nenhuma mutação possa introduzir um estado que o repositório recusaria
 * depois (ou que quebraria a interface antes disso).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type SheetStatus =
  /** Nenhuma ficha aberta. */
  | "idle"
  /** Lendo do repositório. A interface mostra um esqueleto. */
  | "loading"
  /** Ficha carregada e editável. */
  | "ready"
  /** Falha ao carregar ou salvar. */
  | "error";

interface SheetState {
  status: SheetStatus;
  sheet: Sheet | null;
  error: string | null;
  /** `true` enquanto há alteração ainda não gravada. */
  dirty: boolean;

  /** Abre uma ficha pelo id. */
  open: (id: string) => Promise<void>;
  /** Fecha a ficha (grava o que estiver pendente). */
  close: () => Promise<void>;

  /**
   * Aplica uma transformação pura e recebe a ficha resultante.
   * Devolve `false` se não houver ficha aberta.
   */
  mutate: (recipe: (current: Sheet) => Sheet) => boolean;

  /** Grava imediatamente, sem esperar o debounce. */
  save: () => Promise<boolean>;
}

/** Grava o que estiver pendente. Criado depois do store (precisa de `getState`). */
let saveTask: DebouncedTask | null = null;

function getSaveTask(): DebouncedTask {
  saveTask ??= createDebouncedTask(() => {
    void persistCurrentSheet();
  }, SAVE_DEBOUNCE_MS);
  return saveTask;
}

async function persistCurrentSheet(): Promise<boolean> {
  const state = useSheetStore.getState();
  const sheet = state.sheet;
  if (!sheet) return false;

  try {
    await sheetRepository.updateSheet(sheet.id, sheet);
    // Só marca como limpa se a ficha não mudou de novo durante a gravação
    // (o usuário pode ter digitado enquanto o `await` estava em voo).
    const current = useSheetStore.getState();
    useSheetStore.setState({ dirty: current.sheet === sheet, error: null });
    return true;
  } catch (error) {
    console.error("[ficha] Falha ao salvar.", error);
    useSheetStore.setState({
      status: "error",
      dirty: true,
      error: "Não foi possível salvar a ficha.",
    });
    return false;
  }
}

export const useSheetStore = create<SheetState>((set, get) => ({
  status: "idle",
  sheet: null,
  error: null,
  dirty: false,

  async open(id) {
    set({ status: "loading", sheet: null, error: null, dirty: false });
    getSaveTask().cancel();

    try {
      const sheet = await sheetRepository.getSheet(id);

      if (!sheet) {
        set({
          status: "error",
          sheet: null,
          error: "Ficha não encontrada.",
        });
        return;
      }

      set({ status: "ready", sheet, error: null, dirty: false });
    } catch (error) {
      console.error("[ficha] Falha ao abrir.", error);
      set({
        status: "error",
        sheet: null,
        error: "Não foi possível abrir a ficha.",
      });
    }
  },

  async close() {
    getSaveTask().cancel();
    await persistCurrentSheet();
    set({ status: "idle", sheet: null, error: null, dirty: false });
  },

  mutate(recipe) {
    const current = get().sheet;
    if (!current || get().status !== "ready") return false;

    try {
      const next = SheetSchema.parse(recipe(current));
      set({ sheet: next, dirty: true });
      getSaveTask().schedule();
      return true;
    } catch (error) {
      // Uma mutação que viola o schema é um bug de programação, não do
      // usuário. Não deixamos o estado inconsistente: a ficha anterior
      // permanece e o erro aparece no console para ser diagnosticado.
      console.error("[ficha] A mutação produziu uma ficha inválida.", error);
      return false;
    }
  },

  async save() {
    getSaveTask().cancel();
    return persistCurrentSheet();
  },
}));

/** Grava imediatamente o que estiver pendente (usado ao trocar de aba/sair). */
export function flushSheet(): boolean {
  return (saveTask ?? getSaveTask()).flush();
}

/** Recomeça do zero. Só existe para os testes. */
export function resetSheetStoreForTests(): void {
  saveTask?.cancel();
  saveTask = null;
  useSheetStore.setState({
    status: "idle",
    sheet: null,
    error: null,
    dirty: false,
  });
}
