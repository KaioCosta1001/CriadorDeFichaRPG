import { describe, expect, it } from "vitest";

import { GRID_COLUMNS, GRID_MAX_W } from "@/config/constants";
import { minSizeOf } from "@/config/panelTypes";
import { SYSTEM_LIST } from "@/config/systems";
import { createBlankSheet, createSheet } from "./sheetFactory";

const DND = {
  system: "dnd5e",
  templateId: "dnd5e-completo",
  name: "Gandalf",
  title: "Gandalf",
} as const;
const COC = {
  system: "coc",
  templateId: "coc-investigador",
  name: "Investigador",
  title: "Investigador",
} as const;

describe("createSheet — com modelo", () => {
  it("aplica os atributos do modelo do D&D 5e", () => {
    const sheet = createSheet(DND);

    expect(sheet.attributes).toHaveLength(6);
    expect(sheet.attributes.map((a) => a.name)).toContain("Força");
    expect(sheet.attributes.every((a) => a.value === 10)).toBe(true);
  });

  it("aplica as 18 perícias do modelo clássico", () => {
    expect(createSheet(DND).skills).toHaveLength(18);
  });

  it("NÃO grava mais o atributo vinculado na perícia (adendo de rolagem)", () => {
    const sheet = createSheet(DND);

    // A v1 guardava `attributeId`. O vínculo agora é escolhido no menu, a
    // cada rolagem — guardar um valor aqui criaria um segundo lugar onde a
    // escolha acontece.
    for (const skill of sheet.skills) {
      expect(skill).not.toHaveProperty("attributeId");
    }
  });

  it("gera ids de atributo ÚNICOS (o menu lista por eles)", () => {
    const sheet = createSheet(DND);
    const ids = sheet.attributes.map((a) => a.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => !id.includes("forca"))).toBe(true);
  });

  it("grava o templateId do modelo, não o que foi digitado", () => {
    expect(createSheet(DND).templateId).toBe("dnd5e-completo");
  });

  it("modelo em branco não cria atributos nem perícias", () => {
    const sheet = createSheet({
      ...DND,
      templateId: "dnd5e-branco",
    });

    expect(sheet.attributes).toEqual([]);
    expect(sheet.skills).toEqual([]);
  });

  it("aplica o layout do modelo sobre o padrão", () => {
    const sheet = createSheet(DND);
    const attributes = sheet.layout.find(
      (entry) => entry.panelId === "attributes",
    );

    expect(attributes?.visible).toBe(true);
    expect(attributes?.w).toBeGreaterThan(0);
  });
});

describe("createSheet — Call of Cthulhu", () => {
  it("habilita o slot inferior esquerdo como Sanidade", () => {
    const sheet = createSheet(COC);
    const sanidade = sheet.profile.slots.find(
      (slot) => slot.id === "slot-sanidade",
    );

    expect(sanidade?.enabled).toBe(true);
    expect(sanidade?.label).toBe("Sanidade");
    // E é o canto que o adendo §2 especifica para a Sanidade.
    expect(sanidade?.position).toBe("bottom-left");
  });

  it("mantém os demais slots como vieram da configuração padrão", () => {
    const sheet = createSheet(COC);
    const ac = sheet.profile.slots.find((slot) => slot.id === "slot-ac");
    const pv = sheet.profile.slots.find((slot) => slot.id === "slot-pv");

    expect(ac?.enabled).toBe(true);
    expect(ac?.label).toBe("CA");
    expect(pv?.label).toBe("PV");
  });

  it("usa os percentuais iniciais do 7e", () => {
    const sheet = createSheet(COC);
    expect(sheet.attributes.every((a) => a.value === 50)).toBe(true);
    expect(sheet.attributes.find((a) => a.name === "Sanidade")).toBeDefined();
  });

  it("cada perícia nasce com id próprio, distinto do do atributo", () => {
    const sheet = createSheet(COC);
    const skillIds = sheet.skills.map((s) => s.id);
    const attributeIds = new Set(sheet.attributes.map((a) => a.id));

    expect(new Set(skillIds).size).toBe(skillIds.length);
    // Sem vínculo guardado, um id repetido entre perícia e atributo só
    // atrapalharia a lista do menu de rolagem.
    expect(skillIds.some((id) => attributeIds.has(id))).toBe(false);
  });
});

describe("createSheet — caminhos de segurança", () => {
  it("modelo inexistente cai numa ficha em branco, sem quebrar", () => {
    const sheet = createSheet({ ...DND, templateId: "modelo-fantasma" });

    expect(sheet.attributes).toEqual([]);
    expect(sheet.templateId).toBe("modelo-fantasma");
  });

  it("sistema inexistente é recusado pelo schema, não aceito calado", () => {
    // O schema é a última linha de defesa: um sistema fora da lista viraria
    // ficha que ninguém sabe renderizar. Falhar cedo é melhor que salvar
    // dado que não volta.
    expect(() =>
      createSheet({ ...DND, system: "sistema-fantasma" as never }),
    ).toThrow();
  });

  it("sempre respeita o layout padrão do diagrama da seção 7", () => {
    for (const system of SYSTEM_LIST) {
      const template = system.templates[1];
      if (!template) continue;

      const sheet = createSheet({
        system: system.id as never,
        templateId: template.id,
        name: "Teste",
        title: "Teste",
      });

      const byId = new Map(sheet.layout.map((entry) => [entry.panelId, entry]));

      // ───────────────────────────────────────────────────────────────────────
      // EM CÉLULAS, DERIVADO DE `GRID_COLUMNS` (adendo §1.8)
      //
      // O diagrama da §1.8 pede: Perfil quadrado, Inventário com o DOBRO da
      // largura do Perfil, Resultado quadrado; abaixo, Atributos e Perícias em
      // largura total.
      //
      // O `+ 12` que estava aqui era o `PANEL_GAP_PX` sendo somado à largura
      // do bloco — o gap entre células, que é responsabilidade da grade, e
      // nunca devia entrar na conta de TAMANHO. Agora a proporção é exata:
      // 12 : 24 : 12 numa grade de 48.
      // ───────────────────────────────────────────────────────────────────────
      expect(byId.get("profile")?.w).toBe(byId.get("roll-result")?.w);
      expect(byId.get("inventory")?.w).toBe((byId.get("profile")?.w ?? 0) * 2);

      // A borda direita do ÚLTIMO bloco da linha de cima tem que fechar a
      // grade, sem sobra e sem estouro. Somar `x + w` de todos daria o
      // triplo do valor — o que interessa é o MAIOR, que é onde a linha
      // termina.
      const bordaDireita = Math.max(
        ...["profile", "inventory", "roll-result"].map((id) => {
          const entry = byId.get(id);
          return (entry?.x ?? 0) + (entry?.w ?? 0);
        }),
      );
      expect(bordaDireita).toBe(GRID_COLUMNS);

      // E a linha não pode ter buraco: cada bloco começa onde o anterior
      // termina. É o que garante que os três fiquem colados, sem vão vazio
      // entre eles.
      for (const [esquerdo, direito] of [
        ["profile", "inventory"],
        ["inventory", "roll-result"],
      ] as const) {
        const a = byId.get(esquerdo);
        const b = byId.get(direito);
        expect(b?.x, `${direito} não encosta em ${esquerdo}`).toBe(
          (a?.x ?? 0) + (a?.w ?? 0),
        );
      }

      // Atributos e Perícias em largura total, abaixo.
      expect(byId.get("attributes")?.w).toBe(byId.get("skills")?.w);
      expect(byId.get("skills")?.y ?? 0).toBeGreaterThan(
        byId.get("attributes")?.y ?? 0,
      );
    }
  });

  it("TODOS os blocos nascem dentro dos limites do seu TIPO", () => {
    // Um bloco que nasce abaixo do mínimo é empurrado pelo `normalizeLayout` na
    // carga — e o usuário veria o bloco "crescer sozinho" ao abrir a ficha.
    for (const system of SYSTEM_LIST) {
      const template = system.templates[1];
      if (!template) continue;

      const sheet = createSheet({
        system: system.id as never,
        templateId: template.id,
        name: "Teste",
        title: "Teste",
      });

      for (const entry of sheet.layout) {
        const min = minSizeOf(entry.panelId);
        expect(entry.w, `${entry.panelId} largo demais`).toBeLessThanOrEqual(
          GRID_MAX_W,
        );
        expect(entry.w, `${entry.panelId} estreito`).toBeGreaterThanOrEqual(
          min.w,
        );
        expect(entry.h, `${entry.panelId} baixo`).toBeGreaterThanOrEqual(min.h);
      }
    }
  });
});

describe("createBlankSheet", () => {
  it("ignora o modelo pedido", () => {
    const sheet = createBlankSheet(DND);
    expect(sheet.attributes).toEqual([]);
    expect(sheet.skills).toEqual([]);
  });

  it("mantém os slots padrão (sem o ajuste de Sanidade do CoC)", () => {
    const sheet = createBlankSheet(COC);
    const sanidade = sheet.profile.slots.find(
      (slot) => slot.id === "slot-sanidade",
    );
    // Fora do CoC a Sanidade continua DESLIGADA: nem todo sistema tem esse
    // campo, e um orbe vazio ocupa o mesmo espaço que um preenchido.
    expect(sanidade?.enabled).toBe(false);
  });

  it("mesma configuração base em qualquer sistema", () => {
    const dnd = createBlankSheet(DND);
    const coc = createBlankSheet(COC);

    expect(dnd.inventory.weapons).toHaveLength(1);
    expect(coc.inventory.weapons).toHaveLength(1);
    expect(coc.settings.sellEnabled).toBe(false);
  });
});
