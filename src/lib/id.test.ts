import { describe, expect, it } from "vitest";

import { IdSchema } from "@/schemas";

import { generateId, generateIdChecked } from "./id";

describe("generateId", () => {
  it("gera ids diferentes a cada chamada", () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId()));
    // 500 chamadas sem colisão: o id nunca pode ser derivado de índice.
    expect(ids.size).toBe(500);
  });

  it("gera um id aceito pelo IdSchema", () => {
    expect(IdSchema.safeParse(generateId()).success).toBe(true);
  });

  it("lança se o id estiver fora da faixa (falha de desenvolvimento)", () => {
    const curto = {
      safeParse: () => ({ success: false, error: { message: "curto" } }),
    } as unknown as Parameters<typeof generateIdChecked>[0];

    expect(() => generateIdChecked(curto)).toThrow(/id inválido/);
  });
});
