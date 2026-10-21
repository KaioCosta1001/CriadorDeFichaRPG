import type { z } from "zod";

/**
 * Geração de identificadores.
 *
 * POR QUE `crypto.randomUUID()` E NÃO `nanoid`
 * - Já existe na plataforma (navegadores modernos e Node), então é uma
 *   dependência a menos.
 * - Usa a mesma CSPRNG do sistema, com a mesma qualidade.
 *
 * REGRA DO PROJETO (seção 5.5): ID NUNCA é baseado em índice de array.
 * Vínculos (arma ↔ item, perícia ↔ atributo, painel ↔ layout) dependem de
 * IDs estáveis, então nada aqui recebe `length` como entrada.
 *
 * ── PONTO DE TROCA ──────────────────────────────────────────────────────────
 * Se um dia for preciso trocar por `nanoid` (ou qualquer outro gerador),
 * altere APENAS `generateId` abaixo. Nenhum outro arquivo sabe como o ID é
 * produzido.
 */

/** Gera um identificador único e opaco. */
export function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback para ambientes sem `randomUUID` (jsdom antigo, navegadores
  // legados). Usa `getRandomValues`, que também é CSPRNG, então a qualidade
  // não muda — apenas o formato (versão 4 sem os bits de versão/variante).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Cria um id e valida com o schema.
 *
 * O `parse` só existe para provar, em tempo de desenvolvimento, que o id
 * gerado respeita `IdSchema` — um id fora da faixa viraria erro de validação
 * silenciosamente mais adiante, muito mais difícil de diagnosticar.
 */
export function generateIdChecked(schema: z.ZodType<string>): string {
  const id = generateId();
  const result = schema.safeParse(id);
  if (!result.success) {
    throw new Error(
      `generateId() produziu um id inválido (${id}): ${result.error.message}`,
    );
  }
  return id;
}
