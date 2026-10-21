import { describe, expect, it } from "vitest";

import { SYSTEM_IDS, WEAPON_DIE_TYPES } from "@/config/constants";
import { CONTRIBUTION_STRATEGIES } from "@/domain/modifiers";
import type { SystemId } from "@/schemas";

import { SYSTEM_LIST, getSystem, getSystemLabel, getTemplate } from "./index";

/**
 * Este arquivo protege os DADOS de `config/systems/`.
 *
 * Um vínculo quebrado aqui (uma perícia apontando para um atributo que não
 * existe) viraria uma ficha com perícia órfã — e isso é praticamente
 * invisível na interface. Por isso a validação é feita aqui, e não "na
 * confiança".
 */

describe("registro de sistemas", () => {
  it("tem uma definição para cada id em SYSTEM_IDS", () => {
    for (const id of SYSTEM_IDS) {
      expect(getSystem(id), `sistema ${id} ausente`).not.toBeNull();
    }
  });

  it("tem uma estratégia de cálculo para cada sistema", () => {
    for (const id of SYSTEM_IDS) {
      expect(typeof CONTRIBUTION_STRATEGIES[id]).toBe("function");
    }
  });

  it("mantém a lista na mesma ordem de SYSTEM_IDS", () => {
    expect(SYSTEM_LIST.map((system) => system.id)).toEqual([...SYSTEM_IDS]);
  });

  it("oferece exatamente 3 modelos por sistema (seção 12)", () => {
    for (const system of SYSTEM_LIST) {
      expect(system.templates, `${system.id} não tem 3 modelos`).toHaveLength(
        3,
      );
    }
  });

  it("tem rótulo e descrição em pt-BR para cada sistema", () => {
    for (const system of SYSTEM_LIST) {
      expect(system.label).toMatch(/\S/);
      expect(system.description).toMatch(/\S/);
      expect(system.attributeRuleDescription).toMatch(/\S/);
    }
  });

  it("usa um dado de perícia válido em cada sistema", () => {
    for (const system of SYSTEM_LIST) {
      expect(system.skillDie).toMatch(/^d\d+$/);
    }
  });

  it("tem ids de modelo únicos dentro de cada sistema", () => {
    for (const system of SYSTEM_LIST) {
      const ids = system.templates.map((template) => template.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("tem exatamente um modelo 'Em branco' por sistema", () => {
    for (const system of SYSTEM_LIST) {
      expect(
        system.templates.filter((template) => template.blank),
      ).toHaveLength(1);
    }
  });
});

describe("dados dos modelos", () => {
  it("nunca deixa uma perícia apontando para um atributo inexistente", () => {
    for (const system of SYSTEM_LIST) {
      for (const template of system.templates) {
        const keys = new Set(template.attributes.map((seed) => seed.key));

        for (const skill of template.skills) {
          expect(
            skill.attributeKey === null || keys.has(skill.attributeKey),
            `${system.id}/${template.id}: perícia "${skill.name}" aponta para ` +
              `"${skill.attributeKey}", que não existe`,
          ).toBe(true);
        }
      }
    }
  });

  it("nunca deixa um modelo com nomes vazios ou duplicados", () => {
    for (const system of SYSTEM_LIST) {
      for (const template of system.templates) {
        const attributeNames = template.attributes.map((seed) => seed.name);
        expect(
          new Set(attributeNames).size,
          `${template.id} tem atributos repetidos`,
        ).toBe(attributeNames.length);

        const skillNames = template.skills.map((seed) => seed.name);
        expect(
          new Set(skillNames).size,
          `${template.id} tem perícias repetidas`,
        ).toBe(skillNames.length);

        for (const name of [...attributeNames, ...skillNames]) {
          expect(name.trim()).not.toBe("");
        }
      }
    }
  });

  it("mantém as chaves de atributo únicas dentro de um modelo", () => {
    for (const system of SYSTEM_LIST) {
      for (const template of system.templates) {
        const keys = template.attributes.map((seed) => seed.key);
        expect(new Set(keys).size, `${template.id} tem chaves repetidas`).toBe(
          keys.length,
        );
      }
    }
  });

  it("respeita os limites de array do schema", () => {
    for (const system of SYSTEM_LIST) {
      for (const template of system.templates) {
        expect(template.attributes.length).toBeLessThanOrEqual(40);
        expect(template.skills.length).toBeLessThanOrEqual(200);
      }
    }
  });

  it("só sobrescreve slots que existem na configuração do Perfil", () => {
    // Se alguém digitar "slot-sanidade" num modelo, o ajuste é ignorado
    // silenciosamente — este teste avisa antes.
    const validSlotIds = new Set([
      "slot-ac",
      "slot-pv",
      "slot-sanidade",
      "slot-extra",
    ]);

    for (const system of SYSTEM_LIST) {
      for (const template of system.templates) {
        for (const override of template.slots ?? []) {
          expect(
            validSlotIds.has(override.slotId),
            `${template.id}: slot "${override.slotId}" não existe`,
          ).toBe(true);
        }
      }
    }
  });

  it("só sobrescreve painéis que existem no layout padrão", () => {
    const validPanelIds = new Set([
      "profile",
      "inventory",
      "roll-result",
      "attributes",
      "skills",
    ]);

    for (const system of SYSTEM_LIST) {
      for (const template of system.templates) {
        for (const override of template.layout ?? []) {
          expect(
            validPanelIds.has(override.panelId),
            `${template.id}: painel "${override.panelId}" não existe`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("requisitos específicos por sistema (seção 12)", () => {
  it("D&D 5e: o modelo clássico tem 6 atributos e 18 perícias", () => {
    const template = getTemplate("dnd5e", "dnd5e-completo");
    expect(template?.attributes).toHaveLength(6);
    expect(template?.skills).toHaveLength(18);
  });

  it("D&D 5e: o modelo simplificado tem menos perícias que o clássico", () => {
    const completo = getTemplate("dnd5e", "dnd5e-completo");
    const simplificado = getTemplate("dnd5e", "dnd5e-simplificado");
    expect(simplificado!.skills.length).toBeLessThan(completo!.skills.length);
  });

  it("Call of Cthulhu: o slot inferior esquerdo vem ligado como Sanidade", () => {
    for (const id of ["coc-investigador", "coc-simplificado"]) {
      const template = getTemplate("coc", id);
      expect(template?.slots, `${id} sem ajuste de slot`).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            slotId: "slot-sanidade",
            label: "Sanidade",
          }),
        ]),
      );
    }
  });

  it("Call of Cthulhu: perícias são roladas em d100", () => {
    expect(getSystem("coc")?.skillDie).toBe("d100");
  });

  it("D&D 5e e Old Dragon: perícias são roladas em d20", () => {
    expect(getSystem("dnd5e")?.skillDie).toBe("d20");
    expect(getSystem("olddragon")?.skillDie).toBe("d20");
  });

  it("a arma continua limitada a d4…d20, mesmo com o d100 reservado", () => {
    expect(WEAPON_DIE_TYPES).not.toContain("d100");
    expect([...WEAPON_DIE_TYPES]).toEqual([
      "d4",
      "d6",
      "d8",
      "d10",
      "d12",
      "d20",
    ]);
  });
});

describe("busca tolerante", () => {
  it("devolve null para sistema desconhecido, em vez de lançar", () => {
    expect(getSystem("nope")).toBeNull();
    expect(getTemplate("nope", "qualquer")).toBeNull();
  });

  it("devolve null para modelo inexistente num sistema válido", () => {
    expect(getTemplate("dnd5e", "modelo-que-nao-existe")).toBeNull();
  });

  it("tem rótulo legível até para sistema desconhecido", () => {
    expect(getSystemLabel("nope" as SystemId)).toBe("Sistema desconhecido");
    expect(getSystemLabel("dnd5e")).toBe("D&D 5e");
  });
});
