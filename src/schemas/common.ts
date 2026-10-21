import { z } from "zod";

/**
 * Schemas primitivos compartilhados por toda a aplicação.
 *
 * REGRA DO PROJETO: todo dado que entra no app (storage, import, formulário)
 * passa por um schema. Tipos TypeScript de dados persistidos são SEMPRE
 * derivados daqui via `z.infer` — nunca escritos à mão.
 */

/**
 * Identificador estável.
 *
 * Nunca é um índice de array: vínculos (arma ↔ item, perícia ↔ atributo,
 * painel ↔ layout) dependem de IDs estáveis. Vem de `crypto.randomUUID()`
 * (ver `src/lib/id.ts`).
 */
export const IdSchema = z
  .string()
  .min(1, "Identificador não pode ser vazio")
  .max(64, "Identificador longo demais");

/** Data/hora em ISO 8601 (`new Date().toISOString()`). */
export const TimestampSchema = z
  .string()
  .min(1)
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Data/hora inválida",
  });

/**
 * Texto livre de usuário (nomes, rótulos, descrições).
 *
 * `trim` é aplicado na ENTRADA — é por isso que " " vira "" e é rejeitado.
 * Nunca usamos `dangerouslySetInnerHTML`: isso aqui é sempre texto puro.
 */
export function trimmedText(options: {
  max: number;
  label: string;
  allowEmpty?: boolean;
}): z.ZodType<string> {
  const { max, label, allowEmpty = true } = options;
  return z
    .string()
    .max(max * 4, `${label} excedeu o limite antes de ser normalizado`)
    .transform((value) => value.trim())
    .refine(
      (value) => value.length <= max,
      `${label} deve ter no máximo ${max} caracteres`,
    )
    .refine(
      (value) => allowEmpty || value.length > 0,
      `${label} é obrigatório`,
    );
}

/**
 * Número inteiro com limites.
 *
 * Normaliza entrada viciada de formulários: `null`, `undefined`, `""`,
 * `NaN` e `Infinity` viram o fallback, e o resultado é sempre um inteiro
 * finito dentro da faixa. Assim nenhum `NaN` chega ao estado.
 *
 * Strings são aceitas porque `<input type="number">` entrega texto; uma
 * string que NÃO é número é recusada em vez de virar `0` silenciosamente
 * (um "0" inventado é pior do que uma mensagem de erro).
 */
export function boundedInt(options: {
  min: number;
  max: number;
  label: string;
  fallback?: number;
}): z.ZodType<number, unknown> {
  const { min, max, label, fallback = 0 } = options;

  return z
    .unknown()
    .transform((value, ctx): number => {
      const coerced = coerceNumericInput(value, fallback);
      if (coerced === INVALID_NUMBER) {
        ctx.addIssue({
          code: "custom",
          message: `${label} deve ser um número`,
        });
        return z.NEVER;
      }
      return Math.round(coerced);
    })
    .refine((value) => value >= min, `${label} deve ser no mínimo ${min}`)
    .refine((value) => value <= max, `${label} deve ser no máximo ${max}`);
}

/**
 * Número real (aceita decimais) com limites — peso, valor, capacidade.
 * Mesma normalização de `boundedInt`, sem arredondar.
 */
export function boundedNumber(options: {
  min: number;
  max: number;
  label: string;
  fallback?: number;
}): z.ZodType<number, unknown> {
  const { min, max, label, fallback = 0 } = options;

  return z
    .unknown()
    .transform((value, ctx): number => {
      const coerced = coerceNumericInput(value, fallback);
      if (coerced === INVALID_NUMBER) {
        ctx.addIssue({
          code: "custom",
          message: `${label} deve ser um número`,
        });
        return z.NEVER;
      }
      return coerced;
    })
    .refine((value) => value >= min, `${label} deve ser no mínimo ${min}`)
    .refine((value) => value <= max, `${label} deve ser no máximo ${max}`);
}

/** Marca "isto não é um número recuperável" (diferente de 0). */
const INVALID_NUMBER = Symbol("invalid-number");

/**
 * Converte entrada heterogênea em número finito.
 *
 * - `null` / `undefined` / `""` / texto só com espaços → `fallback`
 * - `NaN` / `Infinity` / `-Infinity`               → `fallback`
 * - número finito                                 → ele mesmo
 * - string numérica                               → o número
 * - qualquer outra coisa                          → `INVALID_NUMBER`
 *
 * NOTA: `z.number()` do Zod já rejeita `NaN`, então a normalização precisa
 * acontecer ANTES da validação de tipo — é o que esta função faz.
 */
function coerceNumericInput(
  value: unknown,
  fallback: number,
): number | typeof INVALID_NUMBER {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : INVALID_NUMBER;
  }

  return INVALID_NUMBER;
}

/** Cor de identificação de linha/caixa: hexadecimal de 6 dígitos ou `null`. */
export const RowColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve estar no formato #rrggbb")
  .nullable();

export type RowColorValue = z.infer<typeof RowColorSchema>;

/** `ownerId` fica reservado para o futuro multiusuário. Hoje é sempre `null`. */
export const OwnerIdSchema = IdSchema.nullable();
