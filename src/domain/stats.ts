import { STAT_VALUE_MAX, STAT_VALUE_MIN } from "@/config/constants";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  NÚMEROS DE ATRIBUTO E PERÍCIA                                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Funções puras de normalização de texto numérico. Vivem no domínio (e não no
 * componente) porque o mesmo parsing é usado pela edição inline, pela
 * importação de ficha e pelos testes.
 */

/**
 * Converte o que o usuário digitou em um inteiro dentro da faixa.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ESTA FUNÇÃO EXISTE, E NÃO SÓ O `boundedInt` DO SCHEMA
 *
 * `boundedInt` **rejeita** em vez de limitar: `99999` viola o `.refine()` e o
 * `sheetStore.mutate` devolve `false` sem aplicar nada. O usuário digita
 * "99999" no valor de uma perícia, solta o campo e… nada acontece, sem
 * explicação. É o pior tipo de falha: o app parece quebrado.
 *
 * Aqui o texto é convertido para o maior valor aceito. O usuário vê `999` no
 * campo e entende. O limite é visível, não silencioso.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE "abc" VIRA O VALOR ANTERIOR E NÃO 0
 * Um "0" inventado é pior que uma recusa: o usuário lê 0, acredita que a
 * perícia vale zero e segue jogando com a ficha errada. Fallback no valor
 * anterior mantém a ficha correta e deixa o texto digitado ser descartado.
 */
export function parseStatValue(raw: string, fallback: number): number {
  const trimmed = raw.trim();

  // Aceita "12", "+3", "-2" e também "12.9" (o teclado numérico de celular
  // oferece "."). NOTA: "1e5" é recusado de propósito — notação científica
  // não sai de um teclado de personnage e quase sempre é erro de digitação;
  // aceitar transformaria um engano em 100000.
  if (!/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return clampStat(fallback);

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return clampStat(fallback);

  return clampStat(Math.trunc(parsed));
}

/** Mantém um inteiro dentro de `[STAT_VALUE_MIN, STAT_VALUE_MAX]`. */
export function clampStat(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(STAT_VALUE_MAX, Math.max(STAT_VALUE_MIN, Math.trunc(value)));
}

/**
 * Formata um valor com sinal, para o detalhamento do bônus.
 *
 * `3` → `"+3"`, `-2` → `"−2"` (usa o sinal de menos tipográfico, que é mais
 * legível em Cinzel do que o hífen), `0` → `"0"`.
 *
 * Por que zero NÃO vira "+0": um "+0" na ficha sugere um bônus que existe e é
 * nulo; "0" diz a verdade — não há bônus.
 */
export function formatSigned(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value);
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}
