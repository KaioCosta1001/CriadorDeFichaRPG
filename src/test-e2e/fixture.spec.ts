import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { STORAGE_KEYS, sheetStorageKey } from "@/config/constants";
import { DEFAULT_DIE_TYPE } from "@/config/constants";
import { createSheet } from "@/domain/sheetFactory";
import { extraPanelId } from "@/domain/layout";
import { generateId } from "@/lib/id";
import { SheetSchema } from "@/schemas";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  FIXTURE PARA OS TESTES E2E (Playwright)                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É UM TESTE E NÃO UM SCRIPT
 *
 * O fixture é gerado com o `createSheet` REAL do app. Se alguém mudar o
 * formato da ficha, este teste regenera o fixture — e o teste E2E continua
 * funcionando sem ninguém lembrar de atualizar um JSON à mão.
 *
 * Um JSON copiado no repositório envelheceria em silêncio: quando o formato
 * mudasse, o E2E falharia com "Ficha não encontrada", e a causa real estaria
 * a três arquivos de distância.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE O E2E FAZ COM ISTO
 *
 * O `localStorage` é semeado antes da página carregar (`addInitScript`), com:
 *   - a ficha completa, na chave `rpgv3:sheet:<id>`;
 *   - o índice de resumos, na chave `rpgv3:sheets`.
 *
 * Assim o E2E abre direto na ficha, sem depender do fluxo de criação.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O FIXTURE TEM ARMAS, ITENS E UM BLOCO DE LISTA
 *
 * O adendo §3.5 exige o E2E de reordenação em CADA lista: Armas, Itens,
 * Atributos, Perícias e o bloco de lista.
 *
 * A ficha nova nasce com UMA arma de exemplo e nenhum item — e o bloco de
 * lista é criado pelo usuário. Sem isto no fixture, três das cinco listas
 * ficariam sem cobertura, e o E2E passaria a testar menos do que o adendo
 * pede.
 * ───────────────────────────────────────────────────────────────────────────
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../e2e/fixtures/sheet.json");

describe("fixture E2E", () => {
  it("gera um ficheiro que o schema aceita", () => {
    const sheet = createSheet({
      system: "dnd5e",
      templateId: "dnd5e-completo",
      name: "Gandalf",
      title: "Gandalf",
    });

    // ───────────────────────────────────────────────────────────────────
    // ARMAS E ITENS — as listas precisam de TRÊS itens para o E2E
    // (reordenar o 3º para o 1º).
    // ───────────────────────────────────────────────────────────────────
    sheet.inventory.weapons = [
      {
        id: generateId(),
        name: "Espada longa",
        die: DEFAULT_DIE_TYPE,
        diceCount: 1,
        attackBonus: 0,
        attributeIds: [],
        color: null,
        itemId: null,
        isItem: false,
      },
      {
        id: generateId(),
        name: "Cajado",
        die: DEFAULT_DIE_TYPE,
        diceCount: 1,
        attackBonus: 0,
        attributeIds: [],
        color: null,
        itemId: null,
        isItem: false,
      },
      {
        id: generateId(),
        name: "Arco",
        die: DEFAULT_DIE_TYPE,
        diceCount: 1,
        attackBonus: 0,
        attributeIds: [],
        color: null,
        itemId: null,
        isItem: false,
      },
    ];

    sheet.inventory.items = [
      {
        id: generateId(),
        name: "Poção de cura",
        quantity: 2,
        weight: 0.5,
        value: 50,
        color: null,
        favorite: false,
        weaponData: null,
        equippedWeaponId: null,
      },
      {
        id: generateId(),
        name: "Rolo de pergaminho",
        quantity: 1,
        weight: 0.1,
        value: 10,
        color: null,
        favorite: false,
        weaponData: null,
        equippedWeaponId: null,
      },
      {
        id: generateId(),
        name: "Frasco de tinta",
        quantity: 1,
        weight: 0.2,
        value: 25,
        color: null,
        favorite: false,
        weaponData: null,
        equippedWeaponId: null,
      },
    ];

    // ───────────────────────────────────────────────────────────────────
    // O BLOCO DE LISTA DO USUÁRIO
    //
    // A chave no LAYOUT é `extra:<id>` — é o que a grade usa para saber que
    // o bloco é do usuário e buscar o dado dele em `extraPanels`. Com o id
    // cru, o bloco renderizaria vazio, sem título e sem lista.
    // ───────────────────────────────────────────────────────────────────
    const listaId = generateId();
    sheet.extraPanels = [
      {
        id: listaId,
        title: "Lista de teste",
        type: "list",
        content: "",
        entries: [
          { id: generateId(), name: "Alfa", number: 1, color: null },
          { id: generateId(), name: "Beta", number: 2, color: null },
          { id: generateId(), name: "Gamma", number: 3, color: null },
        ],
      },
    ];
    sheet.layout = [
      ...sheet.layout,
      {
        panelId: extraPanelId(listaId),
        x: 0,
        y: 64,
        w: 24,
        h: 12,
        visible: true,
        order: sheet.layout.length,
      },
    ];

    // Se o formato da ficha mudar, o fixture deixaria de ser aceito e o E2E
    // passaria a falhar por um motivo que ninguém entenderia.
    const validado = SheetSchema.safeParse(sheet);
    expect(validado.success).toBe(true);

    const payload = {
      sheet,
      sheetKey: sheetStorageKey(sheet.id),
      indexKey: STORAGE_KEYS.sheets,
      summary: {
        id: sheet.id,
        name: sheet.name,
        title: sheet.title,
        system: sheet.system,
        templateId: sheet.templateId,
        updatedAt: sheet.updatedAt,
      },
    };

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");

    expect(sheet.layout.length).toBeGreaterThan(0);
    expect(sheet.extraPanels).toHaveLength(1);
    expect(sheet.inventory.weapons).toHaveLength(3);
    expect(sheet.inventory.items).toHaveLength(3);
  });
});
