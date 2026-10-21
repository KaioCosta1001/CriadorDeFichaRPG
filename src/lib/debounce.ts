/**
 * "Debounce" para escritas no storage.
 *
 * POR QUE EXISTE (seção 5.10): digitar o nome de um personagem dispara uma
 * atualização por tecla. Sem agrupamento, isso vira uma escrita do documento
 * inteiro (com foto e inventário) várias vezes por segundo — lento, e capaz
 * de estourar a cota do `localStorage`.
 *
 * Garantias:
 *  - `flush()` executa a escrita pendente imediatamente (usado no
 *    download do JSON, na troca de ficha e no `beforeunload`).
 *  - `cancel()` descarta a escrita pendente (usado ao desmontar).
 *  - `pending()` permite desligar o temporizador quando não há nada a fazer.
 */
export interface DebouncedTask {
  /** Agenda a execução, reiniciando o temporizador a cada chamada. */
  schedule: () => void;
  /** Executa agora, se havia algo pendente. Devolve se executou. */
  flush: () => boolean;
  /** Descarta o que estava pendente. */
  cancel: () => void;
  /** `true` se há execução pendente. */
  pending: () => boolean;
}

export function createDebouncedTask(
  task: () => void,
  delayMs: number,
): DebouncedTask {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = (): boolean => {
    if (timer === null) return false;
    clearTimeout(timer);
    timer = null;
    task();
    return true;
  };

  return {
    schedule() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        task();
      }, delayMs);
    },
    flush: run,
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    pending() {
      return timer !== null;
    },
  };
}
