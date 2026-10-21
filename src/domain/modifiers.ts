import type { SystemId } from "@/schemas";

import type { AttributeContributionStrategy } from "@/config/systems/types";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PONTO EM ABERTO 14.1 — ESTRATÉGIAS DE CÁLCULO (ISOLADAS E TROCADÁVEIS)  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Tudo aqui é FUNÇÃO PURA: sem React, sem storage, sem efeito colateral.
 * É por isso que dá para testar cada regra isoladamente (veja
 * `modifiers.test.ts`).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠️ ESTE É O ARQUIVO A EDITAR QUANDO A REGRA DEFINITIVA FOR DEFINIDA.
 *
 * Para trocar a regra do D&D 5e, por exemplo, edite APENAS
 * `dnd5eAbilityModifier`. Nenhum componente, schema ou store muda.
 *
 * Mantenha o contrato:
 *   - devolve um INTEIRO (o detalhamento da rolagem mostra "+3", não "+3.4");
 *   - devolve o valor com sinal (atributo baixo = contribuição negativa);
 *   - nunca lança e nunca devolve `NaN`.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Normaliza qualquer entrada para um inteiro finito (defesa contra `NaN`). */
function toSafeInt(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/**
 * D&D 5e — modificador de habilidade: `floor((valor - 10) / 2)`.
 *
 * Exemplos: 1 → -5, 8 → -1, 10 → 0, 11 → 0, 16 → +3, 20 → +5.
 */
export const dnd5eAbilityModifier: AttributeContributionStrategy = (
  attributeValue,
) => toSafeInt(Math.floor((toSafeInt(attributeValue) - 10) / 2));

/**
 * Old Dragon.
 *
 * provisório: usa o mesmo cálculo do D&D 5e, mas em uma função SEPARADA.
 * Isso é deliberado: quando a regra definitiva do Old Dragon sair, o autor
 * muda só esta função e o D&D 5e permanece intacto.
 */
export const oldDragonAbilityModifier: AttributeContributionStrategy = (
  attributeValue,
) => toSafeInt(Math.floor((toSafeInt(attributeValue) - 10) / 2));

/**
 * Call of Cthulhu — soma o valor do atributo direto.
 *
 * No 7e o teste de perícia é `1d100 + valor da perícia + valor do atributo`,
 * sem conversão. O dado base (d100) vem do `skillDie` do sistema.
 */
export const cthulhuAbilityValue: AttributeContributionStrategy = (
  attributeValue,
) => toSafeInt(attributeValue);

/**
 * Estratégia por sistema.
 *
 * Adicionar um sistema = acrescentar uma entrada aqui. Um sistema ausente
 * cairia em `dnd5eAbilityModifier`, que é o comportamento menos surpreendente.
 */
export const CONTRIBUTION_STRATEGIES: Record<
  SystemId,
  AttributeContributionStrategy
> = {
  dnd5e: dnd5eAbilityModifier,
  olddragon: oldDragonAbilityModifier,
  coc: cthulhuAbilityValue,
};

/**
 * Quanto o atributo soma na rolagem.
 *
 * É a função que o resto do app deve chamar — nunca a estratégia direto.
 * Concentrar a chamada aqui significa que trocar a regra é uma edição de
 * um arquivo só, e que o comportamento padrão (sistema desconhecido) está
 * definido em um lugar.
 */
export function calculateAttributeContribution(
  systemId: SystemId,
  attributeValue: number,
  kind: "weapon" | "skill",
): number {
  const strategy = CONTRIBUTION_STRATEGIES[systemId] ?? dnd5eAbilityModifier;
  return strategy(attributeValue, { systemId, kind });
}

/** Rótulo curto da regra, exibido no detalhamento da rolagem. */
export const CONTRIBUTION_LABELS: Record<SystemId, string> = {
  dnd5e: "Modificador",
  olddragon: "Modificador",
  coc: "Valor do atributo",
};
