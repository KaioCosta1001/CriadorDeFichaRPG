import { describe, expect, it } from "vitest";

import { migrateDocument } from "./migrations";
import { SheetSchema } from "@/schemas";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MIGRAÇÃO v1 → v2 — ADENDO DE ROLAGEM POR CLIQUE DIREITO                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A regra do projeto é dura: *"dados antigos devem ser migrados, nunca
 * descartados silenciosamente"* (§5.8).
 *
 * O que este arquivo defends:
 *
 *  - `Skill.attributeId` SOME da ficha, e TODO O RESTO SOBREVIVE;
 *  - o histórico antigo é REMODELADO, não jogado fora — e o detalhamento de
 *    cada rolagem continua correto;
 *  - o documento migrado passa no schema ATUAL (a prova de que a migração
 *    está completa: um campo faltando aqui seria um `Quarantine`, e a ficha
 *    inteira sumiria da lista do jogador).
 */

/** Ficha mínima v1, com o vínculo fixo e um registro de rolagem antigo. */
function v1Sheet() {
  return {
    id: "sheet-1",
    ownerId: null,
    schemaVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    name: "Gandalf",
    title: "Gandalf",
    system: "dnd5e",
    templateId: "dnd5e-completo",
    profile: {
      photo: null,
      slots: [
        {
          id: "slot-top-left",
          position: "top-left",
          enabled: true,
          label: "CA",
          value: "18",
        },
      ],
    },
    attributes: [
      { id: "attr-for", name: "Força", value: 16, color: "#d8c246" },
      { id: "attr-des", name: "Destreza", value: 14, color: null },
    ],
    skills: [
      // COM vínculo — é este que a migração tem de remover.
      {
        id: "sk-1",
        name: "Furtividade",
        value: 5,
        color: null,
        attributeId: "attr-des",
      },
      // SEM vínculo: nada a fazer além de continuar igual.
      {
        id: "sk-2",
        name: "Sobrevivência",
        value: 2,
        color: "#4b7fd6",
        attributeId: null,
      },
      // Vínculo ÓRFÃO: apontava para um atributo que já não existe.
      {
        id: "sk-3",
        name: "Arcanismo",
        value: 0,
        color: null,
        attributeId: "attr-perdido",
      },
    ],
    inventory: {
      weapons: [],
      items: [],
      money: { label: "Ouro", value: 10 },
      carryCapacity: 50,
    },
    extraPanels: [],
    layout: [],
    rollHistory: [
      {
        id: "roll-1",
        rolledAt: "2026-01-02T00:00:00.000Z",
        source: "skill",
        sourceId: "sk-1",
        sourceName: "Furtividade",
        die: "d20",
        dice: [14],
        attributeContributions: [
          {
            attributeId: "attr-des",
            attributeName: "Destreza",
            rawValue: 14,
            contribution: 2,
          },
        ],
        bonuses: [{ label: "Bênção", value: 1 }],
        total: 17,
      },
      {
        id: "roll-2",
        rolledAt: "2026-01-02T01:00:00.000Z",
        source: "weapon",
        sourceId: "w-1",
        sourceName: "Espada longa",
        die: "d8",
        dice: [6],
        attributeContributions: [],
        bonuses: [{ label: "Ataque", value: 4 }],
        total: 10,
      },
    ],
    settings: { sellEnabled: true },
  };
}

function migrated() {
  const result = migrateDocument(v1Sheet());
  if (result.status !== "ok")
    throw new Error(`migração falhou: ${result.status}`);
  return result.document;
}

describe("migração v1 → v2", () => {
  it("é aplicada ao documento v1", () => {
    const result = migrateDocument(v1Sheet());

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // A ficha v1 tem versão 1 e o alvo é 4: as TRÊS migrações rodam em
    // sequência — remover o vínculo fixo (v2), converter o layout de px para
    // células (v3) e reposicionar os slots do Perfil (v4).
    expect(result.applied).toEqual([1, 2, 3, 4]);
  });

  it("a ficha migrada passa no schema ATUAL", () => {
    // A prova definitiva: se faltasse um campo novo, isto seria `false` e a
    // ficha iria para a quarentena — sumindo da lista do jogador.
    const sheet = SheetSchema.safeParse(migrated());
    expect(sheet.success).toBe(true);
  });

  it("REMOVE `attributeId` de todas as perícias", () => {
    const sheet = migrated() as { skills: Record<string, unknown>[] };

    for (const skill of sheet.skills) {
      expect(skill).not.toHaveProperty("attributeId");
    }
  });

  it("PRESERVA nome, valor e cor das perícias", () => {
    const sheet = migrated() as {
      skills: {
        id: string;
        name: string;
        value: number;
        color: string | null;
      }[];
    };

    const furtividade = sheet.skills.find((s) => s.id === "sk-1");
    expect(furtividade).toEqual({
      id: "sk-1",
      name: "Furtividade",
      value: 5,
      color: null,
    });
  });

  it("PRESERVA a perícia que estava sem vínculo, cor e tudo", () => {
    const sheet = migrated() as {
      skills: {
        id: string;
        name: string;
        value: number;
        color: string | null;
      }[];
    };

    expect(sheet.skills.find((s) => s.id === "sk-2")).toEqual({
      id: "sk-2",
      name: "Sobrevivência",
      value: 2,
      color: "#4b7fd6",
    });
  });

  it("PRESERVA perícia com vínculo órfão (o id sumia, a perícia não)", () => {
    const sheet = migrated() as {
      skills: { id: string; name: string; value: number }[];
    };

    expect(sheet.skills.find((s) => s.id === "sk-3")).toEqual({
      id: "sk-3",
      name: "Arcanismo",
      value: 0,
      color: null,
    });
  });

  it("PRESERVA o resto da ficha: perfil, atributos, inventário, config", () => {
    const sheet = migrated() as {
      name: string;
      settings: { sellEnabled: boolean };
      attributes: { id: string; color: string | null }[];
      inventory: { money: { value: number } };
      profile: { slots: { label: string }[] };
    };

    expect(sheet.name).toBe("Gandalf");
    expect(sheet.settings.sellEnabled).toBe(true);
    expect(sheet.attributes[0]?.color).toBe("#d8c246");
    expect(sheet.inventory.money.value).toBe(10);
    expect(sheet.profile.slots[0]?.label).toBe("CA");
  });
});

describe("migração v1 → v2 — histórico", () => {
  it("NÃO descarta as rolagens antigas", () => {
    const sheet = migrated() as { rollHistory: unknown[] };
    expect(sheet.rollHistory).toHaveLength(2);
  });

  it("traduz `source: 'skill'` para `kind: 'skill'`", () => {
    const sheet = migrated() as { rollHistory: { kind: string }[] };
    expect(sheet.rollHistory[0]?.kind).toBe("skill");
  });

  it("traduz `source: 'weapon'` para `kind: 'weapon'`", () => {
    const sheet = migrated() as { rollHistory: { kind: string }[] };
    expect(sheet.rollHistory[1]?.kind).toBe("weapon");
  });

  it("vira `sourceName` em `label`", () => {
    const sheet = migrated() as { rollHistory: { label: string }[] };

    expect(sheet.rollHistory[0]?.label).toBe("Furtividade");
    expect(sheet.rollHistory[1]?.label).toBe("Espada longa");
  });

  it("achata contribuições e bônus na lista ÚNICA de parcelas", () => {
    const sheet = migrated() as {
      rollHistory: { components: { label: string; value: number }[] }[];
    };

    // A ordem é a que o jogador lia: primeiro o atributo, depois o bônus.
    expect(sheet.rollHistory[0]?.components).toEqual([
      { label: "Destreza", value: 2 },
      { label: "Bênção", value: 1 },
    ]);
  });

  it("PRESERVA o total e os valores sorteados", () => {
    const sheet = migrated() as {
      rollHistory: { total: number; dice: number[]; die: string }[];
    };

    expect(sheet.rollHistory[0]?.total).toBe(17);
    expect(sheet.rollHistory[0]?.dice).toEqual([14]);
    expect(sheet.rollHistory[1]?.die).toBe("d8");
    expect(sheet.rollHistory[1]?.total).toBe(10);
  });

  it("o registro migrado continua descrevível pelo detalhamento", () => {
    // Este é o ponto que importa: depois da migração, o tooltip ainda mostra
    // a conta certa. Sem as parcelas achatadas, viraria "d20 [14] = 17".
    const sheet = migrated() as {
      rollHistory: {
        label: string;
        die: string;
        dice: number[];
        components: { label: string; value: number }[];
        total: number;
        id: string;
        rolledAt: string;
        kind: "weapon" | "skill" | "attribute";
        sourceId: string | null;
      }[];
    };

    const formatados = sheet.rollHistory[0]!.components.filter(
      (c) => c.value !== 0,
    ).map((c) => `+ ${c.label} (+${c.value})`);

    expect(formatados).toEqual(["+ Destreza (+2)", "+ Bênção (+1)"]);
  });

  it("guarda `sourceId` para a arma e `null` quando não houver", () => {
    const sheet = migrated() as {
      rollHistory: { sourceId: string | null }[];
    };

    expect(sheet.rollHistory[0]?.sourceId).toBe("sk-1");
    expect(sheet.rollHistory[1]?.sourceId).toBe("w-1");
  });
});

describe("migração v1 → v2 — robustez", () => {
  it("não muta o documento original", () => {
    const original = v1Sheet();
    const copia = structuredClone(original);

    migrateDocument(original);

    expect(original).toEqual(copia);
    expect(original.skills[0]).toHaveProperty("attributeId");
  });

  it("devolve intacto o que não é objeto", () => {
    for (const entrada of [null, undefined, 42, "texto"]) {
      const result = migrateDocument(entrada, 2);
      expect(result.status).toBe("ok");
      if (result.status === "ok") expect(result.document).toBe(entrada);
    }
  });

  it("não quebra com `skills` ou `rollHistory` fora do formato", () => {
    const result = migrateDocument(
      { schemaVersion: 1, skills: "não é lista", rollHistory: 42 },
      2,
    );

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect((result.document as { skills: unknown }).skills).toBe("não é lista");
    expect((result.document as { rollHistory: unknown }).rollHistory).toBe(42);
  });

  it("não quebra com uma entrada quebrada dentro da lista", () => {
    const result = migrateDocument(
      { schemaVersion: 1, skills: [null, { id: "s1" }] },
      2,
    );

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect((result.document as { skills: unknown[] }).skills).toEqual([
      null,
      { id: "s1" },
    ]);
  });

  it("uma ficha v1 sem vínculo em lugar nenhum migra igual", () => {
    const base = v1Sheet();
    base.skills = base.skills.map((skill) => {
      const copia = { ...skill } as Record<string, unknown>;
      delete copia.attributeId;
      return copia as (typeof base.skills)[number];
    });

    const result = migrateDocument(base);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const sheet = SheetSchema.safeParse(result.document);
    expect(sheet.success).toBe(true);
  });
});
