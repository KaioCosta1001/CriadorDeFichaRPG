import { expect, test, type Page } from "@playwright/test";

import {
  cellBox,
  dragListItem,
  enableEditMode,
  gridCellSide,
  layoutEntry,
  openBlockEdit,
  openSheet,
  panelBox,
  panelNode,
  sizeIndicator,
  waitForLayout,
} from "./helpers";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  E2E — TODAS AS LISTAS REORDENAM (adendo §3.5)                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O adendo exige o mesmo comportamento em CADA lista: Armas, Itens, Atributos,
 * Perícias e o bloco de lista. Cada uma tem o seu `DndContext` (contexto
 * separado, sem modifiers globais), mas todas usam o mesmo componente de
 * handle — o `GripHandle`.
 */

/**
 * Uma lista reordenável, no E2E.
 *
 * `itens` localiza os ITENS (não os handles), porque o texto do item é o que
 * prova que a ordem mudou.
 */
interface Lista {
  nome: string;
  panelId: string;
  /** Seletor dos ITENS, dentro do bloco. */
  itens: string;
  /** Abre a aba certa do bloco (o Inventário tem abas). */
  preparar?: (page: Page) => Promise<void>;
  /** Extrai os nomes da lista, da ficha SALVA. */
  salvos: (sheet: unknown) => string[];
}

const LISTAS: Lista[] = [
  {
    nome: "Perícias",
    panelId: "skills",
    itens: 'button[aria-label^="Nome da perícia:"]',
    salvos: (sheet) =>
      (sheet as { skills: { name: string }[] }).skills.map((s) => s.name),
  },
  {
    nome: "Atributos",
    panelId: "attributes",
    itens: 'button[aria-label^="Nome do atributo"]',
    salvos: (sheet) =>
      (sheet as { attributes: { name: string }[] }).attributes.map(
        (a) => a.name,
      ),
  },
  {
    nome: "Armas",
    panelId: "inventory",
    itens: 'button[aria-label^="Nome da arma"]',
    preparar: async (page) => {
      await page.getByRole("tab", { name: /Armas/ }).click();
    },
    salvos: (sheet) =>
      (
        sheet as { inventory: { weapons: { name: string }[] } }
      ).inventory.weapons.map((w) => w.name),
  },
  {
    nome: "Itens",
    panelId: "inventory",
    itens: 'button[aria-label^="Nome do item"]',
    preparar: async (page) => {
      await page.getByRole("tab", { name: /Itens/ }).click();
    },
    salvos: (sheet) =>
      (
        sheet as { inventory: { items: { name: string }[] } }
      ).inventory.items.map((i) => i.name),
  },
];

/** Lê a ficha salva no `localStorage`. */
async function readSavedSheet(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const index = window.localStorage.getItem("rpgv3:sheets");
    const summaries = index ? (JSON.parse(index) as { id: string }[]) : [];
    const first = summaries[0];
    if (!first) return null;
    const raw = window.localStorage.getItem(`rpgv3:sheet:${first.id}`);
    return raw ? (JSON.parse(raw) as unknown) : null;
  });
}

/**
 * Compara duas listas de nomes.
 *
 * O `text-transform: uppercase` do CSS faz o `innerText` do elemento vir
 * "FORÇA" enquanto o dado guardado é "Força". Comparar sem caixa alta
 * deixa o teste falar do DADO, e não da fonte.
 */
function mesmosNomes(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (nome, i) =>
      nome.trim().toLocaleLowerCase("pt-BR") ===
      (b[i] ?? "").trim().toLocaleLowerCase("pt-BR"),
  );
}

for (const lista of LISTAS) {
  test.describe(`C — lista de ${lista.nome}`, () => {
    test("o handle só existe no Editar do bloco", async ({ page }) => {
      await openSheet(page);

      // Sem o lápis do bloco: nenhum handle.
      await expect(
        panelNode(page, lista.panelId).getByRole("button", {
          name: /^Reordenar/,
        }),
      ).toHaveCount(0);

      await openBlockEdit(page, lista.panelId);
      await lista.preparar?.(page);

      await expect(
        panelNode(page, lista.panelId)
          .getByRole("button", { name: /^Reordenar/ })
          .first(),
      ).toBeVisible();
    });

    test("com apenas o Editar Geral, a lista NÃO reordena", async ({
      page,
    }) => {
      await openSheet(page);
      await enableEditMode(page);
      await lista.preparar?.(page);

      await expect(
        panelNode(page, lista.panelId).getByRole("button", {
          name: /^Reordenar/,
        }),
      ).toHaveCount(0);
    });

    test("arrastar o 3º item para o 1º reordena e PERSISTE", async ({
      page,
    }) => {
      await openSheet(page);
      await openBlockEdit(page, lista.panelId);
      await lista.preparar?.(page);

      const bloco = panelNode(page, lista.panelId);
      const handles = bloco.getByRole("button", { name: /^Reordenar/ });
      const itens = bloco.locator(lista.itens);

      const antes = await itens.allInnerTexts();
      expect(
        antes.length,
        `a lista de ${lista.nome} precisa de 3 itens`,
      ).toBeGreaterThanOrEqual(3);

      await dragListItem(page, handles.nth(2), handles.nth(0));

      const depois = await itens.allInnerTexts();
      expect(depois, `a ordem de ${lista.nome} não mudou`).not.toEqual(antes);

      // ───────────────────────────────────────────────────────────────────
      // ESPERA O AUTOSAVE E CONFERE A ORDEM GUARDADA
      //
      // A gravação é debounced (400ms). Recarregar antes disso lê a ficha
      // ANTIGA — e o teste acusaria "não persistiu" sem que houvesse bug.
      // ───────────────────────────────────────────────────────────────────
      await expect
        .poll(
          async () => {
            const sheet = await readSavedSheet(page);
            if (!sheet) return false;
            return mesmosNomes(lista.salvos(sheet), depois);
          },
          {
            timeout: 8000,
            message: `a ordem de ${lista.nome} não foi gravada`,
          },
        )
        .toBe(true);

      // E persiste: recarrega a página e confere.
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await openBlockEdit(page, lista.panelId);
      await lista.preparar?.(page);

      const persistido = await panelNode(page, lista.panelId)
        .locator(lista.itens)
        .allInnerTexts();
      expect(
        persistido,
        `a ordem de ${lista.nome} não sobreviveu ao reload`,
      ).toEqual(depois);
    });

    test("arrastar o handle da lista NUNCA move o painel", async ({ page }) => {
      await openSheet(page);
      await openBlockEdit(page, lista.panelId);
      await lista.preparar?.(page);

      const antes = await layoutEntry(page, lista.panelId);

      const handles = panelNode(page, lista.panelId).getByRole("button", {
        name: /^Reordenar/,
      });
      await dragListItem(page, handles.nth(2), handles.nth(0));
      await page.waitForTimeout(500);

      const depois = await layoutEntry(page, lista.panelId);
      expect(depois.x).toBe(antes.x);
      expect(depois.y).toBe(antes.y);
    });
  });
}

/* ===========================================================================
 * O BLOCO DE LISTA DO USUÁRIO
 * ======================================================================== */

test.describe("C — lista de bloco do usuário", () => {
  test("o bloco de lista reordena e persiste", async ({ page }) => {
    await openSheet(page);

    // O bloco de lista é criado pelo usuário: a chave dele no layout é
    // `extra:<id>`, e o id do bloco vem de dentro da chave.
    const panelId = await page.evaluate(() => {
      const index = window.localStorage.getItem("rpgv3:sheets");
      const summaries = index ? (JSON.parse(index) as { id: string }[]) : [];
      const first = summaries[0];
      if (!first) return "";
      const raw = window.localStorage.getItem(`rpgv3:sheet:${first.id}`);
      if (!raw) return "";
      const sheet = JSON.parse(raw) as {
        layout: { panelId: string }[];
        extraPanels: { id: string; type: string }[];
      };
      const extra = sheet.extraPanels.find((p) => p.type === "list");
      return extra ? `extra:${extra.id}` : "";
    });

    expect(panelId, "o fixture não tem bloco de lista").not.toBe("");

    await openBlockEdit(page, panelId);

    const bloco = panelNode(page, panelId);
    const handles = bloco.getByRole("button", { name: /^Reordenar/ });
    await expect(handles).not.toHaveCount(0);

    // ───────────────────────────────────────────────────────────────────
    // A ORDEM É LIDA DOS PRÓPRIOS HANDLES
    //
    // No modo de edição do bloco, a linha vira um CAMPO (`input`), não um
    // botão — e o campo não tem nome acessível estável. O handle, sim: o
    // label dele é "Reordenar <nome da linha>".
    //
    // Ler a ordem pelo handle é mais direto do que ler o texto do item: o
    // handle é a própria coisa que o jogador arrasta.
    // ───────────────────────────────────────────────────────────────────
    const nomes = async () =>
      (
        await handles.evaluateAll((elementos) =>
          elementos.map(
            (elemento) => elemento.getAttribute("aria-label") ?? "",
          ),
        )
      ).map((label) => label.replace(/^Reordenar /, ""));

    const antes = await nomes();
    expect(
      antes.length,
      "o bloco de lista precisa de 3 linhas",
    ).toBeGreaterThanOrEqual(3);

    await dragListItem(page, handles.nth(2), handles.nth(0));

    const depois = await nomes();
    expect(depois[0], "a linha não subiu").not.toBe(antes[0]);
  });
});

/* ===========================================================================
 * REDIMENSIONAMENTO
 * ======================================================================== */

test.describe("A — redimensionar por uma alça", () => {
  test("a alça da direita aumenta a largura em passos de célula", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    const antes = await layoutEntry(page, "profile");
    const caixaAntes = await cellBox(page, "profile");

    const alca = panelNode(page, "profile").getByRole("button", {
      name: /Redimensionar pela borda direita/,
    });
    const caixaAlca = await alca.boundingBox();
    if (!caixaAlca) throw new Error("alça sem caixa");

    // Arrasta a alça uma célula para a direita.
    const celula = await gridCellSide(page);
    await page.mouse.move(
      caixaAlca.x + caixaAlca.width / 2,
      caixaAlca.y + caixaAlca.height / 2,
    );
    await page.mouse.down();
    const passos = 8;
    for (let i = 1; i <= passos; i += 1) {
      await page.mouse.move(
        caixaAlca.x + caixaAlca.width / 2 + (celula * i) / passos,
        caixaAlca.y + caixaAlca.height / 2,
      );
    }
    await page.mouse.up();

    const depois = await waitForLayout(page, "profile", (e) => e.w !== antes.w);
    expect(depois.w, "a largura não mudou").toBeGreaterThan(antes.w);

    // A caixa REAL cresce junto — e o indicador concorda.
    const caixaDepois = await cellBox(page, "profile");
    expect(caixaDepois.width).toBeGreaterThan(caixaAntes.width + 1);

    const texto = (await sizeIndicator(page, "profile").textContent()) ?? "";
    const px = /(\d+)\s*px\s*×\s*(\d+)\s*px/.exec(texto);
    expect(px, `indicador sem px: "${texto}"`).not.toBeNull();
    expect(Math.abs(Number(px?.[1]) - caixaDepois.width)).toBeLessThanOrEqual(
      1,
    );
  });

  test("a moldura continua com a MESMA caixa da célula depois do resize", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    const alca = panelNode(page, "profile").getByRole("button", {
      name: /Redimensionar pela borda direita/,
    });
    const caixaAlca = await alca.boundingBox();
    if (!caixaAlca) throw new Error("alça sem caixa");

    const celula = await gridCellSide(page);
    await page.mouse.move(
      caixaAlca.x + caixaAlca.width / 2,
      caixaAlca.y + caixaAlca.height / 2,
    );
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(
        caixaAlca.x + caixaAlca.width / 2 + (celula * i) / 8,
        caixaAlca.y + caixaAlca.height / 2,
      );
    }
    await page.mouse.up();
    await waitForLayout(page, "profile", (e) => e.w !== 12);

    const celulaBox = await cellBox(page, "profile");
    const moldura = await panelBox(page, "profile");
    expect(Math.abs(moldura.width - celulaBox.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(moldura.height - celulaBox.height)).toBeLessThanOrEqual(1);
  });
});
