import { describe, expect, it } from "vitest";

import { createSheet } from "@/domain/sheetFactory";
import {
  DEFAULT_PROFILE_SLOTS,
  PROFILE_SLOT_POSITIONS,
} from "@/config/profileSlots";
import { SheetSchema, type PanelLayout } from "@/schemas";

import { migrateDocument } from "./migrations";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  v3 → v4 — O PERFIL GANHA OS QUATRO CANTOS (adendo §2)                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A MIGRAÇÃO QUE NÃO PODE PERDER DADO
 *
 * O `id` do slot é o que preserva o rótulo e o valor digitados pelo jogador
 * (§8.1). Descartar os slots e recriá-los nos cantos novos zeraria
 * "Sanidade: 45/75" — e o usuário perderia a ficha por causa de uma mudança
 * puramente visual.
 *
 * Por isso o teste mais importante aqui é o de PRESERVAÇÃO, e não o de
 * posição. A posição é verificável olhando o desenho; o dado digitado não tem
 * como ser recuperado depois de perdido.
 */
function v3Sheet(overrides: Record<string, unknown> = {}) {
  return {
    id: "sheet-1",
    ownerId: null,
    schemaVersion: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    name: "Gandalf",
    title: "Gandalf",
    system: "coc",
    templateId: "coc-investigador",
    profile: {
      photo: null,
      slots: [
        {
          id: "slot-ac",
          position: "top-left",
          enabled: true,
          label: "CA",
          value: "18",
          max: null,
          orbRole: null,
        },
        {
          id: "slot-pv",
          position: "top-right",
          enabled: true,
          label: "PV",
          value: "45",
          max: "75",
          orbRole: null,
        },
        {
          id: "slot-extra",
          position: "bottom-left",
          enabled: true,
          label: "Sanidade",
          value: "63",
          max: "99",
          orbRole: null,
        },
      ],
    },
    inventory: {
      weapons: [],
      items: [],
      money: { label: "Ouro", value: 0 },
      carryCapacity: 30,
    },
    attributes: [],
    skills: [],
    extraPanels: [],
    layout: [] as PanelLayout[],
    rollHistory: [],
    settings: { sellEnabled: true },
    ...overrides,
  };
}

interface Migrated {
  profile: {
    slots: {
      id: string;
      position: string;
      enabled: boolean;
      label: string;
      value: string;
      max: number | string | null;
    }[];
  };
}

function migrated(overrides: Record<string, unknown> = {}): Migrated {
  const result = migrateDocument(v3Sheet(overrides));
  if (result.status !== "ok") {
    throw new Error(`migração falhou: ${result.status}`);
  }
  return result.document as Migrated;
}

describe("migração v3 → v4 — posições do Perfil", () => {
  it("é aplicada ao documento v3", () => {
    const result = migrateDocument(v3Sheet());

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // Uma ficha v3 tem versão 3 e o alvo é 4: só a última migração roda.
    expect(result.applied).toEqual([3, 4]);
  });

  it("PV vai do SUPERIOR DIREITO para o INFERIOR DIREITO", () => {
    const pv = migrated().profile.slots.find((slot) => slot.id === "slot-pv");

    // O prompt principal punha PV no superior direito; o adendo §2 trocou.
    expect(pv?.position).toBe("bottom-right");
  });

  it("o slot extra sai do INFERIOR ESQUERDO e vai para o SUPERIOR DIREITO", () => {
    const extra = migrated().profile.slots.find(
      (slot) => slot.id === "slot-extra",
    );

    // O canto inferior esquerdo passou a ser do slot dedicado de Sanidade.
    expect(extra?.position).toBe("top-right");
  });

  it("CA fica onde estava", () => {
    const ac = migrated().profile.slots.find((slot) => slot.id === "slot-ac");
    expect(ac?.position).toBe("top-left");
  });

  it("cria o slot de SANIDADE no inferior esquerdo, DESLIGADO", () => {
    const sanidade = migrated().profile.slots.find(
      (slot) => slot.id === "slot-sanidade",
    );

    expect(sanidade).toBeDefined();
    expect(sanidade?.position).toBe("bottom-left");
    // Desligado porque nem toda ficha tem esse campo, e um orbe vazio ocupa o
    // mesmo espaço que um preenchido — se lê como "faltou preencher".
    expect(sanidade?.enabled).toBe(false);
    expect(sanidade?.label).toBe("Sanidade");
  });

  it("NÃO deixa dois slots no mesmo canto", () => {
    // Se o `slot-extra` fosse movido sem tirar o occupant, dois orbes
    // apareceriam empilhados no mesmo canto.
    const posicoes = migrated().profile.slots.map((slot) => slot.position);

    expect(new Set(posicoes).size).toBe(posicoes.length);
  });

  it("todo slot fica numa posição prevista", () => {
    for (const slot of migrated().profile.slots) {
      expect(PROFILE_SLOT_POSITIONS).toContain(slot.position);
    }
  });
});

describe("migração v3 → v4 — PRESERVAÇÃO", () => {
  it("PRESERVA rótulo, valor e máximo de CADA slot", () => {
    // Este é o teste que importa. Uma migração de geometria que perde o que
    // o jogador digitou é pior do que a mudança visual que ela faz.
    const por = new Map(
      migrated().profile.slots.map((slot) => [slot.id, slot] as const),
    );

    expect(por.get("slot-ac")).toMatchObject({
      label: "CA",
      value: "18",
      enabled: true,
    });
    expect(por.get("slot-pv")).toMatchObject({
      label: "PV",
      value: "45",
      max: "75",
      enabled: true,
    });
    expect(por.get("slot-extra")).toMatchObject({
      label: "Sanidade",
      value: "63",
      max: "99",
      enabled: true,
    });
  });

  it("não duplica o slot que já existia", () => {
    // Uma ficha v3 do CoC já tinha Sanidade — no `slot-extra`. Criar o
    // `slot-sanidade` sem usar o `LEGACY` deixaria duas Sanidades.
    const ids = migrated().profile.slots.map((slot) => slot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === "slot-sanidade")).toHaveLength(1);
  });

  it("NÃO cria Sanidade se a ficha já tem um slot naquele canto", () => {
    // Se um `slot-sanidade` já existir (ficha migrada duas vezes, por
    // exemplo), a migração não pode acrescentar outro.
    const jaMigrada = migrated();
    const segunda = migrateDocument({
      ...v3Sheet(),
      schemaVersion: 4,
      profile: { photo: null, slots: jaMigrada.profile.slots },
    });

    if (segunda.status !== "ok") throw new Error("segunda migração falhou");
    const slots = (segunda.document as Migrated).profile.slots;

    expect(slots.filter((slot) => slot.id === "slot-sanidade")).toHaveLength(1);
  });

  it("PRESERVA o estado ligado/desligado de cada slot", () => {
    const comDesligado = migrated({
      profile: {
        photo: null,
        slots: [
          {
            id: "slot-ac",
            position: "top-left",
            enabled: false,
            label: "CA",
            value: "",
            max: null,
            orbRole: null,
          },
          {
            id: "slot-pv",
            position: "top-right",
            enabled: true,
            label: "PV",
            value: "12",
            max: null,
            orbRole: null,
          },
          {
            id: "slot-extra",
            position: "bottom-left",
            enabled: false,
            label: "",
            value: "",
            max: null,
            orbRole: null,
          },
        ],
      },
    });

    const por = new Map(
      comDesligado.profile.slots.map((slot) => [slot.id, slot] as const),
    );
    expect(por.get("slot-ac")?.enabled).toBe(false);
    expect(por.get("slot-extra")?.enabled).toBe(false);
  });

  it("NÃO move um slot que um modelo de sistema posicionou de propósito", () => {
    // A migração só mexe em quem está exatamente onde o padrão antigo punha.
    // Um slot fora do lugar foi posto ali por alguém — modelo ou usuário — e
    // a migração não tem voto.
    const foraDoPadrao = migrated({
      profile: {
        photo: null,
        slots: [
          {
            id: "slot-ac",
            position: "bottom-left",
            enabled: true,
            label: "CA",
            value: "7",
            max: null,
            orbRole: null,
          },
          {
            id: "slot-pv",
            position: "bottom-right",
            enabled: true,
            label: "PV",
            value: "9",
            max: null,
            orbRole: null,
          },
          {
            id: "slot-extra",
            position: "top-left",
            enabled: false,
            label: "",
            value: "",
            max: null,
            orbRole: null,
          },
        ],
      },
    });

    const ac = foraDoPadrao.profile.slots.find((slot) => slot.id === "slot-ac");
    const extra = foraDoPadrao.profile.slots.find(
      (slot) => slot.id === "slot-extra",
    );

    expect(ac?.position).toBe("bottom-left");
    expect(extra?.position).toBe("top-left");
  });

  it("a ficha migrada passa no schema ATUAL", () => {
    // A prova definitiva: um `value` fora do limite ou um `max` stringado
    // errado reprovaria aqui, e a ficha iria para a quarentena.
    const base = createSheet({
      system: "coc",
      templateId: "coc-investigador",
      name: "Gandalf",
      title: "Gandalf",
    });

    const result = migrateDocument({
      ...v3Sheet(),
      extraPanels: base.extraPanels,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(SheetSchema.safeParse(result.document).success).toBe(true);
  });

  it("não mexe em ficha sem slots", () => {
    const semSlots = { ...v3Sheet(), profile: { photo: null } };
    const result = migrateDocument(semSlots);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // A migração RODOU e decidiu não ter o que converter. O que não pode
    // acontecer é ela inventar slots onde a ficha não tinha perfil nenhum.
    expect(result.applied).toEqual([3, 4]);
    expect(
      (result.document as { profile: { slots?: unknown } }).profile.slots,
    ).toBeUndefined();
  });
});

describe("a configuração dos slots concorda com a migração", () => {
  it("todo slot padrão tem uma posição livre de conflito", () => {
    const posicoes = DEFAULT_PROFILE_SLOTS.map((slot) => slot.position);

    // Se dois padrões dividissem um canto, a ficha nova já nasceria com
    // sobreposição — e a migração não corrigiria, porque ela age em fichas
    // antigas, não em `DEFAULT_PROFILE_SLOTS`.
    expect(new Set(posicoes).size).toBe(posicoes.length);
  });

  it("todo slot padrão tem `id` único", () => {
    const ids = DEFAULT_PROFILE_SLOTS.map((slot) => slot.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("só CA e PV vêm ligados", () => {
    const ligados = DEFAULT_PROFILE_SLOTS.filter((slot) => slot.enabled);

    expect(ligados.map((slot) => slot.id).sort()).toEqual([
      "slot-ac",
      "slot-pv",
    ]);
  });

  it("os quatro cantos do desenho do §2 estão ocupados", () => {
    const por = new Map(
      DEFAULT_PROFILE_SLOTS.map((slot) => [slot.position, slot.id] as const),
    );

    expect(por.get("top-left")).toBe("slot-ac");
    expect(por.get("top-right")).toBe("slot-extra");
    expect(por.get("bottom-left")).toBe("slot-sanidade");
    expect(por.get("bottom-right")).toBe("slot-pv");
  });
});
