import { describe, expect, it } from "vitest";

import {
  MAX_ATTRIBUTES,
  MAX_DICE_PER_ROLL,
  MAX_ITEMS,
  MAX_WEAPONS,
  STAT_VALUE_MAX,
} from "@/config/constants";
import { createBlankSheet } from "@/domain/sheetFactory";
import {
  CreateSheetInputSchema,
  SheetSchema,
  WeaponSchema,
  boundedInt,
  boundedNumber,
  trimmedText,
} from "@/schemas";

const BASE_INPUT = {
  system: "dnd5e",
  templateId: "dnd5e-completo",
  name: "Gandalf",
  title: "Gandalf",
} as const;

/** Ficha válida usada como ponto de partida dos testes. */
function makeSheet() {
  return createBlankSheet(CreateSheetInputSchema.parse(BASE_INPUT));
}

describe("trimmedText", () => {
  it("remove espaços nas pontas", () => {
    const schema = trimmedText({ max: 20, label: "Nome" });
    expect(schema.parse("  Gandalf  ")).toBe("Gandalf");
  });

  it("rejeita texto maior que o limite", () => {
    const schema = trimmedText({ max: 5, label: "Nome" });
    expect(schema.safeParse("123456").success).toBe(false);
    expect(schema.safeParse("12345").success).toBe(true);
  });

  it("aceita vazio por padrão, mas recusa quando obrigatório", () => {
    expect(trimmedText({ max: 5, label: "X" }).parse("   ")).toBe("");
    expect(
      trimmedText({ max: 5, label: "X", allowEmpty: false }).safeParse("  ")
        .success,
    ).toBe(false);
  });
});

describe("boundedInt", () => {
  const schema = boundedInt({ min: 0, max: 10, label: "Teste", fallback: 0 });

  it("arredonda para inteiro", () => {
    expect(schema.parse(4.6)).toBe(5);
  });

  it("substitui valores não finitos pelo fallback (nada de NaN no estado)", () => {
    expect(schema.parse(Number.NaN)).toBe(0);
    expect(schema.parse(Number.POSITIVE_INFINITY)).toBe(0);
    expect(schema.parse(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(Number.isNaN(schema.parse(Number.NaN))).toBe(false);
  });

  it("trata campo vazio como fallback", () => {
    expect(schema.parse("")).toBe(0);
    expect(schema.parse("   ")).toBe(0);
    expect(schema.parse(null)).toBe(0);
    expect(schema.parse(undefined)).toBe(0);
  });

  it("aceita string numérica (vem de <input type=number>)", () => {
    expect(schema.parse("7")).toBe(7);
    expect(schema.parse(" 3 ")).toBe(3);
  });

  it("rejeita lixo em vez de inventar um zero", () => {
    expect(schema.safeParse("abc").success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse(true).success).toBe(false);
  });

  it("rejeita fora da faixa", () => {
    expect(schema.safeParse(-1).success).toBe(false);
    expect(schema.safeParse(11).success).toBe(false);
  });
});

describe("boundedNumber", () => {
  const schema = boundedNumber({ min: 0, max: 10, label: "Peso", fallback: 0 });

  it("preserva decimais", () => {
    expect(schema.parse(2.5)).toBe(2.5);
  });

  it("normaliza vazio e não-finito", () => {
    expect(schema.parse("")).toBe(0);
    expect(schema.parse(Number.NaN)).toBe(0);
  });
});

describe("SheetSchema", () => {
  it("aceita a ficha criada pela fábrica", () => {
    expect(SheetSchema.safeParse(makeSheet()).success).toBe(true);
  });

  it("recusa documento sem id", () => {
    const sheet = makeSheet() as unknown as Record<string, unknown>;
    delete sheet.id;
    expect(SheetSchema.safeParse(sheet).success).toBe(false);
  });

  it("recusa documento com versão de schema desconhecida", () => {
    const sheet = { ...makeSheet(), schemaVersion: 0 };
    expect(SheetSchema.safeParse(sheet).success).toBe(false);
  });

  it("descarta chaves desconhecidas em vez de falhar", () => {
    const sheet = { ...makeSheet(), campoDoFuturo: "qualquer coisa" };
    const result = SheetSchema.safeParse(sheet);
    expect(result.success).toBe(true);
    if (result.success) {
      expect("campoDoFuturo" in result.data).toBe(false);
    }
  });

  it("aceita exatamente os limites de arrays", () => {
    const sheet = makeSheet();
    const attribute = {
      id: "a1",
      name: "FOR",
      value: 10,
      color: null,
    };
    const many = {
      ...sheet,
      attributes: Array.from({ length: MAX_ATTRIBUTES }, (_, i) => ({
        ...attribute,
        id: `attr-${i}`,
      })),
    };
    expect(SheetSchema.safeParse(many).success).toBe(true);
    expect(
      SheetSchema.safeParse({
        ...many,
        attributes: [...many.attributes, { ...attribute, id: "extra" }],
      }).success,
    ).toBe(false);
  });
});

describe("WeaponSchema", () => {
  const base = {
    id: "w1",
    name: "Espada",
    die: "d20" as const,
    diceCount: 2,
    attackBonus: 3,
    attributeIds: [] as string[],
    color: null,
    itemId: null,
    isItem: false,
  };

  it("aceita uma arma bem formada", () => {
    expect(WeaponSchema.safeParse(base).success).toBe(true);
  });

  it("recusa tipo de dado fora da lista", () => {
    expect(WeaponSchema.safeParse({ ...base, die: "d7" }).success).toBe(false);
    expect(WeaponSchema.safeParse({ ...base, die: "20" }).success).toBe(false);
    expect(WeaponSchema.safeParse({ ...base, die: "d0" }).success).toBe(false);
  });

  it("aceita d100, reservado a sistemas que o usam", () => {
    // O seletor de arma só oferece d4…d20, mas o schema aceita d100 porque
    // o Call of Cthulhu rola em d100 (perícias e combate).
    expect(WeaponSchema.safeParse({ ...base, die: "d100" }).success).toBe(true);
  });

  it("recusa quantidade de dados fora de 1..MAX_DICE_PER_ROLL", () => {
    expect(WeaponSchema.safeParse({ ...base, diceCount: 0 }).success).toBe(
      false,
    );
    expect(
      WeaponSchema.safeParse({ ...base, diceCount: MAX_DICE_PER_ROLL }).success,
    ).toBe(true);
    expect(
      WeaponSchema.safeParse({ ...base, diceCount: MAX_DICE_PER_ROLL + 1 })
        .success,
    ).toBe(false);
  });

  it("aceita valor de atributo no limite superior", () => {
    expect(
      SheetSchema.safeParse({
        ...makeSheet(),
        attributes: [
          { id: "a", name: "FOR", value: STAT_VALUE_MAX, color: null },
        ],
      }).success,
    ).toBe(true);
  });

  it("limita o número de armas e itens", () => {
    const sheet = makeSheet();
    const weapon = { ...base, id: "w" };
    const item = {
      id: "i",
      name: "Item",
      weight: 1,
      quantity: 1,
      value: 1,
      color: null,
      favorite: false,
      weaponData: null,
      equippedWeaponId: null,
    };
    const withWeapons = {
      ...sheet,
      inventory: {
        ...sheet.inventory,
        weapons: Array.from({ length: MAX_WEAPONS }, (_, i) => ({
          ...weapon,
          id: `w${i}`,
        })),
      },
    };
    expect(SheetSchema.safeParse(withWeapons).success).toBe(true);
    expect(
      SheetSchema.safeParse({
        ...withWeapons,
        inventory: {
          ...withWeapons.inventory,
          items: Array.from({ length: MAX_ITEMS + 1 }, (_, i) => ({
            ...item,
            id: `i${i}`,
          })),
        },
      }).success,
    ).toBe(false);
  });
});

describe("createBlankSheet", () => {
  it("gera id único a cada chamada", () => {
    expect(makeSheet().id).not.toBe(makeSheet().id);
  });

  it("mantém o ownerId nulo (multiusuário ainda não existe)", () => {
    expect(makeSheet().ownerId).toBeNull();
  });

  it("começa com uma linha genérica na aba Armas", () => {
    expect(makeSheet().inventory.weapons).toHaveLength(1);
  });

  it("mantém o id do slot de perfil estável entre fichas", () => {
    expect(makeSheet().profile.slots[0]?.id).toBe(
      makeSheet().profile.slots[0]?.id,
    );
  });

  it("usa o nome como título quando o título vem vazio", () => {
    const sheet = createBlankSheet({ ...BASE_INPUT, title: "" });
    expect(sheet.title).toBe("Gandalf");
  });
});
