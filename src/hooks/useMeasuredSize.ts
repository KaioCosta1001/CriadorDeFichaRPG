"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MEDIÇÃO REAL DE UM ELEMENTO (`getBoundingClientRect`)                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE MEDIR E NÃO CALCULAR
 *
 * O layout é gravado em CÉLULAS, e a célula em pixels depende da largura do
 * container (que varia com a janela). Recalcular "célula × w" no componente
 * repete a mesma conta do grid — e erra na mesma hora, porque o valor
 * exibido vem do ESTADO, enquanto o que o usuário vê vem do LAYOUT REAL.
 *
 * Quando os dois divergem (padding somando, borda fora do `box-sizing`,
 * conteúdo esticando o painel), o indicador mente: mostra "12×12" para um
 * bloco que na tela é retangular. A medição direta não tem como divergir —
 * ela lê a mesma caixa que o olho do usuário vê.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM `ResizeObserver`
 *
 * O tamanho muda por três motivos que não disparam re-render do React: a
 * janela muda de largura (a grade recalcula as células), o conteúdo muda de
 * altura, e o bloco é redimensionado. O `ResizeObserver` cobre os três; um
 * `useEffect` com dependência de `layout` cobriria só o terceiro.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A COMPARAÇÃO NO `setSize`
 *
 * O `ResizeObserver` dispara a medição; se cada medição criasse um objeto
 * novo, o `setSize` dispararia um render, que dispararia outra medição, que
 * dispararia outro render — um laço. Comparando os valores antes de gravar,
 * o estado só muda quando o tamanho MUDA de verdade.
 * ───────────────────────────────────────────────────────────────────────────
 */
export interface MeasuredSize {
  /** Largura em pixels, arredondada. */
  width: number;
  /** Altura em pixels, arredondada. */
  height: number;
}

/** Só troca o estado quando o valor REALMENTE mudou. */
function sameSize(a: MeasuredSize | null, b: MeasuredSize | null): boolean {
  if (a === null || b === null) return a === b;
  return a.width === b.width && a.height === b.height;
}

export function useMeasuredSize(): {
  /** Ref a anexar ao elemento que se quer medir. */
  ref: (node: HTMLElement | null) => void;
  /** Tamanho medido — `null` enquanto não houver elemento. */
  size: MeasuredSize | null;
} {
  const nodeRef = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState<MeasuredSize | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      const next = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };

      setSize((atual) => (sameSize(atual, next) ? atual : next));
    };

    measure();

    // O `ResizeObserver` dispara quando a caixa muda — seja por redimensionar
    // o bloco, seja pela grade recalcular as células quando a janela muda.
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    // A janela muda a largura do container, e a grade recalcula as células
    // a partir dela. O `ResizeObserver` do nó pega isso, mas o `window.resize`
    // garante a medição mesmo que o nó não mude de tamanho.
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return { ref, size };
}
