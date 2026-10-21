import { type DieFaces, type DieType } from "@/config/constants";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MOTOR DE DADOS                                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Funções puras de sorteio. O gerador (`rng`) é INJETADO de propósito: é o que
 * permite testar "d20 deu 14" sem torcer para o acaso. Nenhum teste deste
 * projeto sorteia de verdade.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE `rng` E NÃO UM ARGUMENTO "RESULTADO"
 * Injetar o resultado já pronto testaria a soma, não o dado — e o dado é
 * exatamente onde mora o erro clássico (`floor(rng * faces)` sem o `+ 1` dá
 * zero; `Math.round` em vez de `floor` enviesaria a distribuição).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE ESTE ARQUIVO NÃO SABE
 * Nada de React, nada de store, nada de ficha. "Que sistema é" e "qual o nome
 * da perícia" são de quem chama. Isso mantém a aritmética da rolagem
 * testável e deixa `rolls.ts` como a única camada que conhece o formato da
 * ficha.
 */

/** Gerador de aleatoriedade no intervalo `[0, 1)`. */
export type Rng = () => number;

/**
 * Sorteia um dado de `faces` lados.
 *
 * @returns um inteiro de 1 a `faces`, inclusive.
 *
 * A entrada do `rng` pode vir de qualquer fonte. Um valor fora de `[0, 1)`
 * (ou `NaN`, que `Math.random` nunca devolve mas um mock mal escrito sim) é
 * tratado como `0`: preferimos um `1` previsível a um `NaN` que contaminaria
 * o total e apareceria na tela como "NaN".
 */
export function rollDie(faces: DieFaces, rng: Rng = Math.random): number {
  if (!Number.isFinite(faces) || faces < 1) return 1;

  const raw = rng();
  const safe = Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0;

  return Math.floor(safe * faces) + 1;
}

/**
 * Sorteia `count` dados independentes.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠️ `2d20` NÃO É "20 DOBRADO" (§8.2.1)
 * Cada elemento é um sorteio novo. Somar dois números em 1..20 dá uma
 * distribuição triangular, que é o que a tabela exige — "o dobro do resultado
 * de um d20" daria de 2 a 40 com peso maior nos extremos, e o jogador
 * perceberia na primeira rolagem.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function rollDice(
  count: number,
  faces: DieFaces,
  rng: Rng = Math.random,
): number[] {
  const total = Math.max(0, Math.min(99, Math.floor(count) || 0));
  return Array.from({ length: total }, () => rollDie(faces, rng));
}

/** Sorteia um dado do tipo `"d20"` (o formato gravado no storage). */
export function rollDieType(die: DieType, rng: Rng = Math.random): number {
  return rollDie(parseDieFaces(die), rng);
}

/** Converte `"d20"` em `20`. Devolve 20 para um formato desconhecido. */
export function parseDieFaces(die: string): DieFaces {
  const faces = Number.parseInt(die.replace(/^d/i, ""), 10);
  return Number.isFinite(faces) && faces > 0 ? (faces as DieFaces) : 20;
}

/** `true` quando o natural tirado no dado único é o máximo (`natural 20`). */
export function isNaturalMaximum(record: {
  die: DieType;
  dice: number[];
}): boolean {
  const first = record.dice[0];
  if (first === undefined) return false;
  return first === parseDieFaces(record.die);
}

/** `true` quando o natural tirado no dado único é 1 (`natural 1`). */
export function isNaturalMinimum(record: {
  die: DieType;
  dice: number[];
}): boolean {
  return record.dice[0] === 1;
}

/**
 * Menos/mais/mais-menos de um valor para uma faixa.
 *
 * O "menos" é calculado a partir do MENOR resultado da lista, não do mínimo
 * teórico: em `3d20`, tirar 1 + 1 + 1 dá menos 2, e descrever como "menos 59"
 * seria verdade mas inútil.
 */
export function degreeOfSuccess(
  total: number,
  target: number,
): "success" | "failure" | "critical" | "fumble" {
  if (total >= target + 10) return "critical";
  if (total >= target) return "success";
  if (total <= target - 10) return "fumble";
  return "failure";
}
