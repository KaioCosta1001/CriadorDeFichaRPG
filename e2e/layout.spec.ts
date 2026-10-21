import { expect, test } from "@playwright/test";

import {
  GAP,
  GRID_COLUMNS,
  cellBox,
  dragHandle,
  dragListItem,
  dragPanel,
  enableEditMode,
  gridCellSide,
  layoutEntry,
  openBlockEdit,
  openSheet,
  panelBox,
  panelNode,
  readLayout,
  sizeIndicator,
  waitForLayout,
} from "./helpers";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  E2E — LAYOUT: MEDIDAS, HITBOX E MOVIMENTO LIVRE                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Três problemas, três conjuntos de testes. Cada um mede em um navegador REAL:
 * o jsdom não calcula layout, e sem layout não há `getBoundingClientRect()`,
 * nem `elementFromPoint`, nem destino de arraste.
 */

const PAINEIS = ["profile", "inventory", "roll-result", "attributes", "skills"];

/* ===========================================================================
 * PROBLEMA A — tamanho mostrado ≠ tamanho real
 * ======================================================================== */

test.describe("A — o tamanho real bate com o informado", () => {
  test("o Perfil padrão é visualmente QUADRADO", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    const box = await panelBox(page, "profile");

    // Com células retangulares (w fluida, h fixa em 10px), "12x12" saía
    // 252x120 — retangular, como o sintoma descreve.
    expect(
      Math.abs(box.width - box.height),
      `Perfil deveria ser quadrado, mas mediu ${box.width}x${box.height}`,
    ).toBeLessThanOrEqual(1);
  });

  test("o bounding box de cada bloco bate com w×h em células", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    const cell = await gridCellSide(page);

    for (const id of PAINEIS) {
      const entry = await layoutEntry(page, id);
      const box = await cellBox(page, id);

      // A conversão correta é `cells * CELL + (cells - 1) * GAP`: o gap entra
      // ENTRE as células, não depois de cada uma.
      const esperadoW = entry.w * cell + (entry.w - 1) * GAP;
      const esperadoH = entry.h * cell + (entry.h - 1) * GAP;

      expect(
        Math.abs(box.width - esperadoW),
        `${id}: largura mediu ${box.width}px, esperado ${esperadoW.toFixed(1)}px`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(box.height - esperadoH),
        `${id}: altura mediu ${box.height}px, esperado ${esperadoH.toFixed(1)}px`,
      ).toBeLessThanOrEqual(1);
    }
  });

  test("a moldura desenhada tem EXATAMENTE a caixa da célula", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    // A hitbox é a área clicável. Se o conteúdo esticar a moldura para fora
    // da célula, a moldura é MAIOR que a célula — e o clique fora da grade
    // atinge o bloco.
    for (const id of PAINEIS) {
      const celula = await cellBox(page, id);
      const moldura = await panelBox(page, id);

      expect(
        Math.abs(moldura.width - celula.width),
        `${id}: a moldura (${moldura.width}px) é maior que a célula (${celula.width}px)`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(moldura.height - celula.height),
        `${id}: a moldura (${moldura.height}px) é maior que a célula (${celula.height}px)`,
      ).toBeLessThanOrEqual(1);
    }
  });

  test("o indicador de tamanho mostra px E células, e o px bate com a caixa", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    for (const id of PAINEIS) {
      const box = await panelBox(page, id);
      const indicador = sizeIndicator(page, id);

      await expect(indicador).toContainText("px");
      await expect(indicador).toContainText(/\d+\s*×\s*\d+/);

      const texto = (await indicador.textContent()) ?? "";
      const px = /(\d+)\s*px\s*×\s*(\d+)\s*px/.exec(texto);
      expect(px, `indicador sem px: "${texto}"`).not.toBeNull();

      const largura = Number(px?.[1]);
      const altura = Number(px?.[2]);
      expect(
        Math.abs(largura - box.width),
        `${id}: indicador diz ${largura}px, a caixa mede ${box.width}px`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(altura - box.height),
        `${id}: indicador diz ${altura}px, a caixa mede ${box.height}px`,
      ).toBeLessThanOrEqual(1);
    }
  });
});

/* ===========================================================================
 * PROBLEMA A — hitbox: o clique fora da moldura NÃO pode atingir o bloco
 * ======================================================================== */

test.describe("A — hitbox igual ao visual", () => {
  test("2px fora da borda o clique NÃO atinge o bloco", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    for (const id of PAINEIS) {
      // Rola até o bloco: `elementFromPoint` só responde dentro da janela.
      await panelNode(page, id).scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);

      const box = await panelBox(page, id);

      // Pontos 2px FORA de cada borda.
      const fora = [
        { x: box.x - 2, y: box.y + box.height / 2 },
        { x: box.x + box.width + 2, y: box.y + box.height / 2 },
        { x: box.x + box.width / 2, y: box.y - 2 },
        { x: box.x + box.width / 2, y: box.y + box.height + 2 },
      ];

      for (const ponto of fora) {
        const alvo = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return (
            el?.closest("[data-panel-id]")?.getAttribute("data-panel-id") ??
            null
          );
        }, ponto);
        expect(
          alvo,
          `${id}: o ponto (${Math.round(ponto.x)}, ${Math.round(ponto.y)}) 2px fora atingiu "${alvo}"`,
        ).not.toBe(id);
      }
    }
  });

  test("2px dentro da borda o clique ATINGE o bloco", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    for (const id of PAINEIS) {
      await panelNode(page, id).scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);

      const box = await panelBox(page, id);

      const dentro = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return (
            el?.closest("[data-panel-id]")?.getAttribute("data-panel-id") ??
            null
          );
        },
        { x: box.x + 2, y: box.y + 2 },
      );

      expect(dentro, `${id}: 2px dentro não atingiu o bloco`).toBe(id);
    }
  });

  test("as alças de resize ficam DENTRO da caixa do bloco", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    await panelNode(page, "profile").scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);

    const box = await panelBox(page, "profile");
    const alca = panelNode(page, "profile").getByRole("button", {
      name: /Redimensionar pela borda direita/,
    });
    const caixaAlca = await alca.boundingBox();

    expect(caixaAlca).not.toBeNull();
    // A alça pode TOCAR a borda, mas não ultrapassá-la: uma alça de 16px
    // pendurada 4px fora do painel captura cliques do vizinho.
    expect(caixaAlca!.x + caixaAlca!.width).toBeLessThanOrEqual(
      box.x + box.width + 1,
    );
    expect(caixaAlca!.y).toBeGreaterThanOrEqual(box.y - 1);
    expect(caixaAlca!.y + caixaAlca!.height).toBeLessThanOrEqual(
      box.y + box.height + 1,
    );
  });
});

/* ===========================================================================
 * PROBLEMA B — mover livremente nos DOIS eixos
 * ======================================================================== */

test.describe("B — mover livremente pelo handle", () => {
  test("arrastar na DIAGONAL altera x E y", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    const antes = await layoutEntry(page, "profile");
    await dragPanel(page, "profile", 120, 80);
    const depois = await waitForLayout(
      page,
      "profile",
      (e) => e.x !== antes.x || e.y !== antes.y,
    );

    // O sintoma era "só para cima e para baixo". Se o X não muda, o
    // movimento vertical funciona e o horizontal não.
    expect(depois.x, "o X não mudou — o arraste está preso no eixo Y").not.toBe(
      antes.x,
    );
    expect(depois.y, "o Y não mudou").not.toBe(antes.y);
  });

  test("arrastar para a DIREITA aumenta x", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    const antes = await layoutEntry(page, "profile");
    await dragPanel(page, "profile", 150, 0);
    const depois = await waitForLayout(page, "profile", (e) => e.x !== antes.x);

    expect(depois.x).toBeGreaterThan(antes.x);
    expect(depois.y).toBe(antes.y);
  });

  test("arrastar para a BAIXO aumenta y", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    const antes = await layoutEntry(page, "profile");
    await dragPanel(page, "profile", 0, 150);
    const depois = await waitForLayout(page, "profile", (e) => e.y !== antes.y);

    expect(depois.y).toBeGreaterThan(antes.y);
    expect(depois.x).toBe(antes.x);
  });

  test("arrastar para a ESQUERDA diminui x", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    // O `createSnapModifier` do dnd-kit arredonda com `Math.ceil`: para a
    // esquerda, `ceil(-1/32)` é `0` — o bloco NUNCA passaria da célula
    // atual. Este teste existe para travar essa regressão.
    await dragPanel(page, "profile", 200, 0);
    const meio = await waitForLayout(page, "profile", (e) => e.x > 0);
    expect(meio.x).toBeGreaterThan(0);

    await dragPanel(page, "profile", -200, 0);
    const fim = await waitForLayout(page, "profile", (e) => e.x < meio.x);
    expect(fim.x, "o X não diminuiu ao arrastar para a esquerda").toBeLessThan(
      meio.x,
    );
  });

  test("o bloco NUNCA sai da área do grid", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    // Para fora, em todas as direções, com folga.
    await dragPanel(page, "profile", -600, -400);
    await waitForLayout(page, "profile", (e) => e.x === 0 && e.y === 0);
    await dragPanel(page, "profile", 2000, 1500);
    await page.waitForTimeout(600);

    const entry = await layoutEntry(page, "profile");
    expect(entry.x).toBeGreaterThanOrEqual(0);
    expect(entry.y).toBeGreaterThanOrEqual(0);
    expect(entry.x + entry.w).toBeLessThanOrEqual(GRID_COLUMNS);
  });

  test("ida e volta devolve o bloco à posição original (sem deriva)", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    const inicial = await layoutEntry(page, "profile");

    // ───────────────────────────────────────────────────────────────────
    // O GESTO PRECISA SER EM ESPAÇO LIVRE
    //
    // O Perfil tem 12 colunas e o Inventário começa na 12: um arraste para a
    // DIREITA colide, e a colisão REACOMODA o Inventário — que não volta
    // atrás quando o Perfil volta. Isso é o comportamento pedido (adendo
    // §3.4), não um bug.
    //
    // Para medir a DERIVA (o arredondamento acumulando a cada gesto), o
    // gesto desce — e as linhas abaixo do Perfil estão vazias na coluna 0.
    // ───────────────────────────────────────────────────────────────────
    const celula = await gridCellSide(page);
    const distancia = 8 * (celula + GAP);

    await dragPanel(page, "profile", 0, distancia);
    await waitForLayout(page, "profile", (e) => e.y !== inicial.y);

    const meio = await layoutEntry(page, "profile");
    expect(meio.y, "o bloco não desceu").toBeGreaterThan(inicial.y);
    expect(meio.x, "o X não pode mudar num gesto vertical").toBe(inicial.x);

    await dragPanel(page, "profile", 0, -distancia);
    const final = await waitForLayout(
      page,
      "profile",
      (e) => e.y === inicial.y,
    );

    expect(final.x, `x drifted: ${inicial.x} -> ${final.x}`).toBe(inicial.x);
    expect(final.y, `y drifted: ${inicial.y} -> ${final.y}`).toBe(inicial.y);
  });

  test("a deriva não se acumula: três idas e voltas", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    const inicial = await layoutEntry(page, "profile");
    const celula = await gridCellSide(page);
    const distancia = 8 * (celula + GAP);

    for (let volta = 0; volta < 3; volta += 1) {
      await dragPanel(page, "profile", 0, distancia);
      await waitForLayout(page, "profile", (e) => e.y !== inicial.y);
      await dragPanel(page, "profile", 0, -distancia);
      await waitForLayout(page, "profile", (e) => e.y === inicial.y);
    }

    const final = await layoutEntry(page, "profile");
    expect(
      final.x,
      `x drifted after 3 voltas: ${inicial.x} -> ${final.x}`,
    ).toBe(inicial.x);
    expect(
      final.y,
      `y drifted after 3 voltas: ${inicial.y} -> ${final.y}`,
    ).toBe(inicial.y);
  });

  test("nenhum bloco fica sobreposto depois de vários arrastes", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    await dragPanel(page, "profile", 100, 100);
    await waitForLayout(page, "profile", (e) => e.x !== 0 || e.y !== 0);
    await dragPanel(page, "inventory", -100, 100);
    await page.waitForTimeout(600);

    // Mede as caixas REAIS: dois blocos sobrepostos são dois na mesma tela.
    const caixas = [];
    for (const id of PAINEIS) {
      caixas.push({ id, ...(await cellBox(page, id)) });
    }

    for (let i = 0; i < caixas.length; i += 1) {
      for (let j = i + 1; j < caixas.length; j += 1) {
        const a = caixas[i]!;
        const b = caixas[j]!;
        const sobrepoe =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(sobrepoe, `"${a.id}" e "${b.id}" estão sobrepostos`).toBe(false);
      }
    }
  });

  test("a ordem dos blocos no arquivo continua a mesma depois de mover", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    const antes = (await readLayout(page)).map((e) => e.panelId);
    await dragPanel(page, "profile", 120, 80);
    await waitForLayout(page, "profile", (e) => e.x !== 0 || e.y !== 0);
    const depois = (await readLayout(page)).map((e) => e.panelId);

    // `resolveCollisions` resolvia sobre um array ORDENADO por (y, x, order) e
    // devolvia essa ordem — embaralhando a ordem de leitura gravada.
    expect(depois).toEqual(antes);
  });
});

/* ===========================================================================
 * PROBLEMA C — o "⠿" das LISTAS
 * ======================================================================== */

test.describe("C — o handle das listas funciona", () => {
  test("o handle de lista tem área clicável ≥ 32×32px", async ({ page }) => {
    await openSheet(page);
    await openBlockEdit(page, "skills");

    const handle = page.getByRole("button", { name: /^Reordenar / }).first();
    await expect(handle).toBeVisible();

    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    expect(
      box!.width,
      `handle com ${box!.width}px de largura`,
    ).toBeGreaterThanOrEqual(32);
    expect(
      box!.height,
      `handle com ${box!.height}px de altura`,
    ).toBeGreaterThanOrEqual(32);
  });

  test("o handle NÃO aparece sem o Editar do bloco", async ({ page }) => {
    await openSheet(page);

    await expect(page.getByRole("button", { name: /^Reordenar / })).toHaveCount(
      0,
    );
  });

  test("com apenas o Editar Geral, as listas NÃO reordenam", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    // O Editar Geral move o PAINEL. O handle de lista pertence ao LÁPIS do
    // bloco — é a "causa comum" do adendo §3.4.
    await expect(page.getByRole("button", { name: /^Reordenar / })).toHaveCount(
      0,
    );
  });

  test("arrastar o handle de lista reordena e PERSISTE", async ({ page }) => {
    await openSheet(page);
    await openBlockEdit(page, "skills");

    const handles = page.getByRole("button", { name: /^Reordenar / });
    await expect(handles).not.toHaveCount(0);

    const nomes = () =>
      panelNode(page, "skills")
        .getByRole("button", { name: /^Nome da perícia:/ })
        .allInnerTexts();

    const antes = await nomes();
    expect(antes.length).toBeGreaterThanOrEqual(3);

    // Pega o terceiro item e joga sobre o primeiro.
    await dragListItem(page, handles.nth(2), handles.nth(0));

    const depois = await nomes();
    expect(depois, "a ordem das perícias não mudou").not.toEqual(antes);

    // ───────────────────────────────────────────────────────────────────
    // ESPERA O AUTOSAVE ANTES DE RECARREGAR
    //
    // A gravação é debounced (400ms). Recarregar antes disso lê a ficha
    // ANTIGA — e o teste acusaria "não persistiu" sem que houvesse bug.
    // ───────────────────────────────────────────────────────────────────
    await page.waitForFunction(
      (primeiro) => {
        const prefix = "rpgv3";
        const index = window.localStorage.getItem(`${prefix}:sheets`);
        const summaries = index ? (JSON.parse(index) as { id: string }[]) : [];
        const first = summaries[0];
        if (!first) return false;
        const raw = window.localStorage.getItem(`${prefix}:sheet:${first.id}`);
        if (!raw) return false;
        const sheet = JSON.parse(raw) as { skills: { name: string }[] };
        return sheet.skills[0]?.name === primeiro;
      },
      depois[0],
      { timeout: 8000 },
    );

    // E persiste: recarrega a página e confere.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const persistido = await panelNode(page, "skills")
      .getByRole("button", { name: /^Nome da perícia:/ })
      .allInnerTexts();
    expect(persistido).toEqual(depois);
  });

  test("arrastar um handle de lista NUNCA move o painel", async ({ page }) => {
    await openSheet(page);
    await openBlockEdit(page, "skills");

    const antes = await layoutEntry(page, "skills");

    const handles = page.getByRole("button", { name: /^Reordenar / });
    await dragListItem(page, handles.nth(2), handles.nth(0));
    await page.waitForTimeout(600);

    const depois = await layoutEntry(page, "skills");
    expect(depois.x).toBe(antes.x);
    expect(depois.y).toBe(antes.y);
  });
});

/* ===========================================================================
 * PROBLEMA B/C — o handle do PAINEL
 * ======================================================================== */

test.describe("B — o handle do painel", () => {
  test("o handle do painel tem área clicável de 28×28px", async ({ page }) => {
    await openSheet(page);
    await enableEditMode(page);

    const box = await dragHandle(page, "profile").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(28);
    expect(box!.height).toBeGreaterThanOrEqual(28);
  });
});
