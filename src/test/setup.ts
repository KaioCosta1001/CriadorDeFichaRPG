import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Configuração global dos testes.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * LIMITE DE ESPERA DO `waitFor`: 5 SEGUNDOS
 *
 * O padrão do Testing Library é 1000 ms. Numa máquina sob carga (vários
 * arquivos de teste em paralelo, um `tsc` rodando ao lado), um re-render que
 * leva 5 ms em repouso pode passar de 1 s — e o teste falha sendo CORRETO.
 *
 * Testes intermitentes são piores que testes lentos: o time para de confiar
 * na suíte, e uma falha real passa a ser ignorada como "flaky". Aumentar o
 * limite não mascara defeito — uma asserção que depende de 5 s de espera é
 * defeito de qualquer jeito — e só tolera a lentidão da máquina.
 * ───────────────────────────────────────────────────────────────────────────
 */
configure({ asyncUtilTimeout: 5000 });

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APIS DE NAVEGADOR QUE O jsdom NÃO TEM                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE POLYFILLAR EM VEZ DE EVITAR O USO
 *
 * `setPointerCapture` e `ResizeObserver` existem em TODO navegador real desde
 * 2018. Elas não estão aqui porque o jsdom não implementa a captura de ponteiro
 * nem a medição de caixa — não porque o app não deva usá-las.
 *
 * Evitar o uso "para o teste passar" seria trocar um recurso correto por um
 * quebrado: sem captura de ponteiro, arrastar a alça para fora da janela perde
 * o gesto; sem `ResizeObserver`, a grade não reagiria a uma barra lateral que
 * some.
 *
 * O stub de captura registra o id e nada mais — que é tudo o que o componente
 * consulta. O `ResizeObserver` dispara uma vez na observação, como o real faz
 * na montagem.
 * ───────────────────────────────────────────────────────────────────────────
 */
interface ElementComCaptura {
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
  hasPointerCapture: (pointerId: number) => boolean;
  __ponteiroCapturado: number | null;
}

const prototipo = Element.prototype as unknown as ElementComCaptura;

if (typeof prototipo.setPointerCapture !== "function") {
  prototipo.__ponteiroCapturado = null;

  prototipo.setPointerCapture = function (pointerId: number) {
    this.__ponteiroCapturado = pointerId;
  };

  prototipo.releasePointerCapture = function (pointerId: number) {
    if (this.__ponteiroCapturado === pointerId) this.__ponteiroCapturado = null;
  };

  prototipo.hasPointerCapture = function (pointerId: number) {
    return this.__ponteiroCapturado === pointerId;
  };
}

if (typeof globalThis.ResizeObserver === "undefined") {
  /**
   * Stub mínimo: chama o callback uma vez na observação, como o navegador faz
   * na montagem, e nunca mais.
   *
   * Nunca mais é o comportamento CORRETO para o teste: o jsdom não muda
   * tamanho de elemento, então uma segunda medição só produziria um estado que
   * não existe em teste.
   */
  globalThis.ResizeObserver = class {
    constructor(private readonly callback: ResizeObserverCallback) {}

    observe(target: Element): void {
      // O `ResizeObserverEntry` real tem cinco campos, e três deles são
      // caixas que o jsdom não calcula. O componente só usa `target`, mas a
      // assinatura do callback exige o objeto completo — daí o cast.
      const entrada = {
        target,
        contentRect: target.getBoundingClientRect(),
      } as unknown as ResizeObserverEntry;

      this.callback([entrada], this as unknown as ResizeObserver);
    }

    unobserve(): void {}
    disconnect(): void {}
  };
}

/**
 * Deixamos o `localStorage` limpo entre os testes: como o app persiste tudo
 * ali, um resíduo de um teste pode fazer outro passar (ou falhar) por motivo
 * errado.
 */
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
