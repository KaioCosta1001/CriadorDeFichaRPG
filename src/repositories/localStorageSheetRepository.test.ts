import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS, sheetStorageKey } from "@/config/constants";

import {
  LocalStorageSheetRepository,
  buildExportFileName,
} from "./localStorageSheetRepository";
import { ImportError, RepositoryError } from "./types";

const INPUT = {
  system: "dnd5e",
  templateId: "dnd5e-completo",
  name: "Gandalf",
  title: "Gandalf",
} as const;

let repo: LocalStorageSheetRepository;

beforeEach(() => {
  window.localStorage.clear();
  repo = new LocalStorageSheetRepository();
});

describe("LocalStorageSheetRepository — CRUD", () => {
  it("começa vazio", async () => {
    expect(await repo.listSheets()).toEqual([]);
  });

  it("cria e lê uma ficha", async () => {
    const created = await repo.createSheet(INPUT);

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Gandalf");

    const loaded = await repo.getSheet(created.id);
    expect(loaded?.name).toBe("Gandalf");
  });

  it("devolve null para ficha inexistente", async () => {
    expect(await repo.getSheet("nao-existe")).toBeNull();
  });

  it("atualiza a ficha e mexe no updatedAt", async () => {
    const created = await repo.createSheet(INPUT);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await repo.updateSheet(created.id, {
      ...created,
      name: "Gandalf o Branco",
    });

    expect(updated.name).toBe("Gandalf o Branco");
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it("recusa atualizar ficha inexistente", async () => {
    const created = await repo.createSheet(INPUT);
    await repo.deleteSheet(created.id);

    await expect(
      repo.updateSheet(created.id, { ...created, name: "X" }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });

  it("exclui a ficha do storage e do índice", async () => {
    const created = await repo.createSheet(INPUT);
    await repo.deleteSheet(created.id);

    expect(window.localStorage.getItem(sheetStorageKey(created.id))).toBeNull();
    expect(await repo.listSheets()).toEqual([]);
  });

  it("ordena a listagem pela ficha atualizada mais recentemente", async () => {
    const a = await repo.createSheet({ ...INPUT, name: "A" });
    await repo.createSheet({ ...INPUT, name: "B" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repo.updateSheet(a.id, { ...a, name: "A2" });

    const list = await repo.listSheets();
    expect(list.map((s) => s.name)).toEqual(["A2", "B"]);
    expect(list).toHaveLength(2);
  });
});

describe("LocalStorageSheetRepository — duplicação", () => {
  it("gera ids novos na cópia, sem colidir com a original", async () => {
    const original = await repo.createSheet(INPUT);
    const enriched = await repo.updateSheet(original.id, {
      ...original,
      attributes: [{ id: "attr-1", name: "FOR", value: 12, color: null }],
    });

    const copy = await repo.duplicateSheet(enriched.id);

    expect(copy.id).not.toBe(enriched.id);
    expect(copy.attributes[0]?.id).not.toBe("attr-1");
    expect(copy.attributes[0]?.name).toBe("FOR");
  });
  it("da id NOVO a cada copia, sem vínculo de perícia para reescrever", async () => {
    const original = await repo.createSheet(INPUT);
    const enriched = await repo.updateSheet(original.id, {
      ...original,
      attributes: [{ id: "attr-1", name: "FOR", value: 12, color: null }],
      skills: [{ id: "skill-1", name: "Rastrear", value: 5, color: null }],
    });

    const copy = await repo.duplicateSheet(enriched.id);

    // Desde o adendo de rolagem a perícia não guarda `attributeId`; o que a
    // duplicação precisa garantir é que os ids sejam NOVOS, senão remover um
    // atributo na cópia apagaria o da original.
    expect(copy.attributes[0]?.id).not.toBe("attr-1");
    expect(copy.skills[0]?.id).not.toBe("skill-1");
    expect(copy.skills[0]).not.toHaveProperty("attributeId");
  });
  it("reescreve o vínculo item -> arma, preservando os dados de arma", async () => {
    const original = await repo.createSheet(INPUT);
    const enriched = await repo.updateSheet(original.id, {
      ...original,
      inventory: {
        ...original.inventory,
        weapons: [
          {
            id: "w-1",
            name: "Espada",
            die: "d20",
            diceCount: 2,
            attackBonus: 3,
            attributeIds: [],
            color: null,
            itemId: "i-1",
            isItem: true,
          },
        ],
        items: [
          {
            id: "i-1",
            name: "Espada",
            weight: 3,
            quantity: 1,
            value: 15,
            color: null,
            favorite: false,
            weaponData: {
              die: "d20",
              diceCount: 2,
              attackBonus: 3,
              attributeIds: [],
              color: null,
              isItem: true,
            },
            equippedWeaponId: "w-1",
          },
        ],
      },
    });

    const copy = await repo.duplicateSheet(enriched.id);
    const newItemId = copy.inventory.items[0]?.id;
    const newWeaponId = copy.inventory.weapons[0]?.id;

    expect(copy.inventory.weapons[0]?.itemId).toBe(newItemId);
    expect(copy.inventory.items[0]?.equippedWeaponId).toBe(newWeaponId);
    // Dados de arma preservados: é isso que permite re-equipar depois.
    expect(copy.inventory.items[0]?.weaponData?.diceCount).toBe(2);
  });

  it("zera o histórico de rolagens na cópia", async () => {
    const original = await repo.createSheet(INPUT);
    expect((await repo.duplicateSheet(original.id)).rollHistory).toEqual([]);
  });

  it("marca a cópia no título", async () => {
    const original = await repo.createSheet(INPUT);
    expect((await repo.duplicateSheet(original.id)).title).toContain("cópia");
  });
});

describe("LocalStorageSheetRepository — corrupção", () => {
  it("não quebra quando o JSON é inválido: isola e devolve null", async () => {
    const created = await repo.createSheet(INPUT);
    window.localStorage.setItem(
      sheetStorageKey(created.id),
      "{ isto não é json",
    );

    expect(await repo.getSheet(created.id)).toBeNull();

    const quarantine = await repo.listQuarantine();
    expect(quarantine).toHaveLength(1);
    expect(quarantine[0]?.reason).toMatch(/JSON inválido/);
  });

  it("guarda o texto bruto para recuperação do usuário", async () => {
    const created = await repo.createSheet(INPUT);
    const raw = '{"schemaVersion":1,"id":"x","name":123}';
    window.localStorage.setItem(sheetStorageKey(created.id), raw);

    await repo.getSheet(created.id);

    const quarantine = await repo.listQuarantine();
    const entry = quarantine[0];
    expect(entry).toBeDefined();
    expect(await repo.getQuarantinedRaw(entry?.id ?? "")).toBe(raw);
  });

  it("remove o documento corrompido do lugar original", async () => {
    const created = await repo.createSheet(INPUT);
    window.localStorage.setItem(sheetStorageKey(created.id), "nao é json");

    await repo.getSheet(created.id);

    expect(window.localStorage.getItem(sheetStorageKey(created.id))).toBeNull();
  });

  it("descarta documento de versão mais nova que o app", async () => {
    const created = await repo.createSheet(INPUT);
    window.localStorage.setItem(
      sheetStorageKey(created.id),
      JSON.stringify({ schemaVersion: 999, id: created.id }),
    );

    expect(await repo.getSheet(created.id)).toBeNull();
    expect((await repo.listQuarantine())[0]?.reason).toMatch(/mais nova/);
  });

  it("não deixa um documento ruim derrubar os bons", async () => {
    const good = await repo.createSheet({ ...INPUT, name: "Bom" });
    const bad = await repo.createSheet({ ...INPUT, name: "Ruim" });
    window.localStorage.setItem(sheetStorageKey(bad.id), '{"quebrado":true}');

    expect((await repo.getSheet(good.id))?.name).toBe("Bom");
    expect(await repo.getSheet(bad.id)).toBeNull();
  });

  it("permite descartar um item e todos os itens da quarentena", async () => {
    const a = await repo.createSheet({ ...INPUT, name: "A" });
    const b = await repo.createSheet({ ...INPUT, name: "B" });
    window.localStorage.setItem(sheetStorageKey(a.id), "lixo");
    window.localStorage.setItem(sheetStorageKey(b.id), "lixo");
    await repo.getSheet(a.id);
    await repo.getSheet(b.id);

    const quarantine = await repo.listQuarantine();
    expect(quarantine).toHaveLength(2);

    await repo.discardQuarantine(quarantine[0]?.id ?? "");
    expect(await repo.listQuarantine()).toHaveLength(1);

    await repo.discardAllQuarantine();
    expect(await repo.listQuarantine()).toEqual([]);
  });
});

describe("LocalStorageSheetRepository — configurações", () => {
  it("devolve o padrão quando não há nada salvo", async () => {
    expect(await repo.getSettings()).toEqual({
      theme: "grimoire",
      rollAnimationSpeed: 1,
    });
  });

  it("salva e relê as configurações", async () => {
    await repo.saveSettings({ theme: "santuario", rollAnimationSpeed: 1 });
    expect(await repo.getSettings()).toEqual({
      theme: "santuario",
      rollAnimationSpeed: 1,
    });
  });

  it("normaliza temas antigos em vez de perder a preferência", async () => {
    // Quem usou o app nas Fases 1–4 tem "dark"/"light" gravado. O schema
    // mapeia para o tema mais próximo; o inverso seria devolver o padrão
    // e fingir que nada foi salvo.
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ theme: "dark" }),
    );
    expect(await repo.getSettings()).toEqual({
      theme: "santuario",
      rollAnimationSpeed: 1,
    });

    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ theme: "light" }),
    );
    expect(await repo.getSettings()).toEqual({
      theme: "grimoire",
      rollAnimationSpeed: 1,
    });
  });

  it("recusa gravar configuração inválida (nada de dado sujo no storage)", async () => {
    await expect(
      repo.saveSettings({ theme: "arco-iris" } as never),
    ).rejects.toBeTruthy();
    expect(window.localStorage.getItem(STORAGE_KEYS.settings)).toBeNull();
  });

  it("ignora configuração corrompida e usa o padrão", async () => {
    window.localStorage.setItem(STORAGE_KEYS.settings, '{"theme":"neon"}');
    expect(await repo.getSettings()).toEqual({
      theme: "grimoire",
      rollAnimationSpeed: 1,
    });
  });
});

describe("LocalStorageSheetRepository — import/export", () => {
  it("exporta uma ficha como JSON legível", async () => {
    const created = await repo.createSheet(INPUT);
    const json = await repo.exportSheet(created.id);

    expect(JSON.parse(json).name).toBe("Gandalf");
    expect(json).toContain("\n"); // formatado, não minificado
  });

  it("importa uma ficha exportada, com ids novos", async () => {
    const created = await repo.createSheet(INPUT);
    const json = await repo.exportSheet(created.id);

    const imported = await repo.importSheet(json);

    expect(imported.id).not.toBe(created.id);
    expect(imported.name).toBe("Gandalf");
    expect(await repo.listSheets()).toHaveLength(2);
  });

  it("importar o mesmo JSON duas vezes não sobrescreve a primeira cópia", async () => {
    const created = await repo.createSheet(INPUT);
    const json = await repo.exportSheet(created.id);

    const first = await repo.importSheet(json);
    const second = await repo.importSheet(json);

    expect(first.id).not.toBe(second.id);
    expect(await repo.listSheets()).toHaveLength(3);
  });

  it("recusa arquivo que não é JSON, com mensagem em pt-BR", async () => {
    await expect(repo.importSheet("olá mundo")).rejects.toBeInstanceOf(
      ImportError,
    );
    await expect(repo.importSheet("olá mundo")).rejects.toThrow(/JSON válido/);
  });

  it("recusa ficha com campo inválido, sem quebrar", async () => {
    await expect(
      repo.importSheet(JSON.stringify({ id: "x", name: 123 })),
    ).rejects.toBeInstanceOf(ImportError);
  });

  it("recusa arquivo acima do limite de tamanho", async () => {
    const huge = "x".repeat(3 * 1024 * 1024);
    await expect(repo.importSheet(huge)).rejects.toThrow(/grande/);
  });

  it("nunca executa conteúdo do arquivo importado", async () => {
    // O conteúdo só passa por JSON.parse + schema: nada é avaliado.
    const malicious = JSON.stringify({
      ...JSON.parse(JSON.stringify({ id: "x", name: "y" })),
      __proto__: { polluted: true },
    });
    await expect(repo.importSheet(malicious)).rejects.toBeTruthy();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("LocalStorageSheetRepository — falhas do storage", () => {
  it("avisa quando o setItem falha por cota", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("cota", "QuotaExceededError");
    });

    await expect(repo.createSheet(INPUT)).rejects.toThrow(/cheio/);
  });

  it("devolve lista vazia quando o índice está corrompido", async () => {
    window.localStorage.setItem(STORAGE_KEYS.sheets, "{ não é json");
    expect(await repo.listSheets()).toEqual([]);
  });
});

describe("buildExportFileName", () => {
  it("remove acentos e espaços", () => {
    expect(buildExportFileName("Guardião do Norte")).toBe(
      "ficha-guardiao-do-norte.json",
    );
  });

  it("não quebra com título vazio ou só com símbolos", () => {
    expect(buildExportFileName("")).toBe("ficha-sem-nome.json");
    expect(buildExportFileName("///")).toBe("ficha-sem-nome.json");
  });
});
