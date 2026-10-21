"use client";

import type { Modifier } from "@dnd-kit/core";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SNAP DE CÉLULAS — COM `Math.round` (adendo §1 e §2)                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO USAR `createSnapModifier` DO dnd-kit
 *
 * O `createSnapModifier` do `@dnd-kit/modifiers` arredonda com **`Math.ceil`**
 * — sempre para CIMA:
 *
 *     x: Math.ceil(transform.x / gridSize) * gridSize
 *
 * Isso quebra o arraste em dois sentidos:
 *
 *  1. **Arrastar para a esquerda nunca sai da célula.** `ceil(-1/32)` é `0`, e
 *     `0 * 32` é `0`. O bloco volta para a borda da célula e fica lá — o
 *     sintoma de "mover só para um lado".
 *
 *  2. **Um pixel de movimento vira um salto de célula.** `ceil(1/32)` é `1`, e
 *     `1 * 32` é 32 px. O bloco pula a célula inteira com o primeiro pixel de
 *     arrasto, e a posição final fica sempre deslocada para um lado.
 *
 * É a razão de o "⠿" parecer travado: o snapped não é o que o jogador pediu,
 * é o teto mais próximo SEMPRE acima. O adendo §1 exige `Math.round`, e é
 * exatamente isso que este modifier faz.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM MODIFIER E NÃO CONVERTER SÓ NO `onDragEnd`
 *
 * Converter só no fim funciona, mas o bloco "pula" no último instante: ele
 * segue o ponteiro livre durante o arraste e só encaixa ao soltar. Com o
 * modifier, o bloco já anda em passos de célula enquanto o dedo se move — que
 * é o que dá a sensação de grade.
 *
 * O `onDragEnd` continua convertendo e aplicando `clamp` + colisão: o modifier
 * cuida do VISUAL, a função pura cuida do DADO.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function createCellSnapModifier(gridSizePx: number): Modifier {
  // Uma célula de 0 px faria `x / 0` = `Infinity` e o transform virar `NaN`.
  // O piso de 1 px mantém o modifier inofensivo.
  const step = Math.max(1, gridSizePx);

  return ({ transform }) => ({
    ...transform,
    x: Math.round(transform.x / step) * step,
    y: Math.round(transform.y / step) * step,
  });
}
