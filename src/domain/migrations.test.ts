import { afterEach, describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "@/config/constants";

import { MIGRATIONS, migrateDocument } from "./migrations";

/**
 * `SCHEMA_VERSION` é 1 enquanto não existir um formato v0 real. Para
 * exercitar a cadeia, os testes passam uma versão-alvo explícita — é para
 * isso que o segundo parâmetro de `migrateDocument` existe.
 */
const TARGET = SCHEMA_VERSION + 2;

describe("migrateDocument", () => {
  afterEach(() => {
    // Garante que um teste não vaza migração para o seguinte.
    for (const key of Object.keys(MIGRATIONS)) {
      delete MIGRATIONS[Number(key)];
    }
  });

  it("devolve o documento intacto quando a versão já é a atual", () => {
    const document = { schemaVersion: SCHEMA_VERSION, valor: 1 };
    const result = migrateDocument(document);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.document).toEqual(document);
      expect(result.applied).toEqual([]);
    }
  });

  it("trata documento sem schemaVersion como versão 1", () => {
    const result = migrateDocument({ valor: 1 });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.applied).toEqual([]);
    }
  });

  it("recusa documento de uma versão mais nova que a deste app", () => {
    const result = migrateDocument({ schemaVersion: SCHEMA_VERSION + 1 });

    expect(result.status).toBe("too-new");
  });

  it("aplica a cadeia de migrações na ordem correta", () => {
    const order: string[] = [];
    MIGRATIONS[1] = (doc) => {
      order.push("1->2");
      return { ...(doc as object), passo: 2 };
    };
    MIGRATIONS[2] = (doc) => {
      order.push("2->3");
      return { ...(doc as object), passo: 3 };
    };

    const result = migrateDocument({ schemaVersion: 1, passo: 1 }, TARGET);

    expect(order).toEqual(["1->2", "2->3"]);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.applied).toEqual([1, 2]);
      expect(result.document).toMatchObject({ passo: 3 });
    }
  });

  it("pula etapas sem migração registrada, sem quebrar", () => {
    MIGRATIONS[2] = (doc) => ({ ...(doc as object), passo: 3 });

    const result = migrateDocument({ schemaVersion: 1, passo: 1 }, TARGET);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.applied).toEqual([2]);
      expect(result.document).toMatchObject({ passo: 3 });
    }
  });

  it("começa da versão mais recente quando o documento já foi migrado", () => {
    MIGRATIONS[1] = (doc) => ({ ...(doc as object), passo: 2 });
    MIGRATIONS[2] = (doc) => ({ ...(doc as object), passo: 3 });

    const result = migrateDocument({ schemaVersion: 2 }, TARGET);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      // Só a etapa 2->3 roda; a 1->2 já tinha sido aplicada antes.
      expect(result.applied).toEqual([2]);
    }
  });

  it("ignora schemaVersion que não é inteiro", () => {
    const result = migrateDocument({ schemaVersion: "dois" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.applied).toEqual([]);
    }
  });

  it("não muta o documento original", () => {
    const original: Record<string, unknown> = { schemaVersion: 1 };
    MIGRATIONS[1] = (doc) => ({ ...(doc as object), added: true });

    migrateDocument(original, TARGET);

    expect(original).toEqual({ schemaVersion: 1 });
  });

  it("não descarta o documento quando a migração devolve algo inesperado", () => {
    // Uma migração mal escrita pode devolver qualquer coisa; o motor não
    // valida, quem valida é o schema logo em seguida.
    MIGRATIONS[1] = () => null;

    const result = migrateDocument({ schemaVersion: 1 }, TARGET);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.document).toBeNull();
    }
  });
});
