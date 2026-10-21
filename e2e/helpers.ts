import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import { GRID_GAP_PX } from "../src/config/constants";

/**
 * Helpers dos testes E2E.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O FIXTURE VEM DO CÓDIGO REAL
 *
 * `src/test-e2e/fixture.spec.ts` gera `e2e/fixtures/sheet.json` com o
 * `createSheet` do app. Se o formato mudar, o fixture é regenerado — não há
 * JSON desatualizado no repositório.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O CAMINHO VEM DE `process.cwd()` E NÃO DE `import.meta.url`
 *
 * O Playwright compila os `.ts` para CommonJS, e `import.meta` não existe
 * nesse modo. O runner sempre roda na raiz do projeto, então `cwd()` é
 * confiável — e é o que a documentação do Playwright prescreve.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE AS CONSTANTES DO APP SÃO IMPORTADAS DE VERDADE
 *
 * O `GRID_GAP_PX` que o E2E usa é o mesmo do app. Se alguém mudar a
 * constante, o teste continua medindo a fórmula certa — em vez de passar
 * porque copiou o número errado para o teste.
 * ───────────────────────────────────────────────────────────────────────────
 */
interface Fixture {
  sheet: {
    id: string;
    layout: { panelId: string; x: number; y: number; w: number; h: number }[];
  };
  sheetKey: string;
  indexKey: string;
  summary: Record<string, unknown>;
}

export function readFixture(): Fixture {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "e2e/fixtures/sheet.json"), "utf8"),
  ) as Fixture;
}

/**
 * Semeia a ficha no `localStorage` ANTES da página carregar.
 *
 * `addInitScript` roda em todo documento, antes de qualquer script da página —
 * que é o que garante que o app encontre a ficha já na hidratação.
 */
export async function seedSheet(page: Page): Promise<Fixture> {
  const fixture = readFixture();

  await page.addInitScript(
    (data: {
      sheetKey: string;
      indexKey: string;
      sheet: unknown;
      summary: unknown;
    }) => {
      // ───────────────────────────────────────────────────────────────────
      // SÓ SEMEIA SE AINDA NÃO HOUVER FICHA
      //
      // O `addInitScript` roda em TODA navegação — inclusive num `reload()`.
      // Sem esta guarda, o reload do teste de PERSISTÊNCIA sobrescreveria a
      // ordem salva com o fixture original, e o teste acusaria "não
      // persistiu" quando o app tinha gravado certinho.
      //
      // A guarda é a mesma de um usuário: o que já está no storage manda; a
      // semente só existe para o primeiro carregamento.
      // ───────────────────────────────────────────────────────────────────
      if (!window.localStorage.getItem(data.sheetKey)) {
        window.localStorage.setItem(data.sheetKey, JSON.stringify(data.sheet));
      }
      if (!window.localStorage.getItem(data.indexKey)) {
        window.localStorage.setItem(
          data.indexKey,
          JSON.stringify([data.summary]),
        );
      }
    },
    {
      sheetKey: fixture.sheetKey,
      indexKey: fixture.indexKey,
      sheet: fixture.sheet,
      summary: fixture.summary,
    },
  );

  return fixture;
}

/** Abre a ficha e espera os blocos aparecerem. */
export async function openSheet(page: Page): Promise<Fixture> {
  const fixture = await seedSheet(page);
  await page.goto(`/fichas/${fixture.sheet.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return fixture;
}

/** Liga o Editar Geral. */
export async function enableEditMode(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  // Os handles de arraste dos blocos ficam visíveis.
  await expect(dragHandle(page, "profile")).toBeVisible();
}

/** O nó POSICIONADO de um bloco (o que tem `position: absolute` no grid). */
export function panelNode(page: Page, panelId: string): Locator {
  return page.locator(`[data-panel-id="${panelId}"]`);
}

/** A MOLDURA visível do bloco (dentro do nó posicionado). */
export function panelFrame(page: Page, panelId: string): Locator {
  return panelNode(page, panelId).locator("section").first();
}

/** O handle de arraste de um bloco. */
export function dragHandle(page: Page, panelId: string): Locator {
  return panelNode(page, panelId).getByRole("button", { name: /^Mover bloco/ });
}

/** O indicador de tamanho de um bloco. */
export function sizeIndicator(page: Page, panelId: string): Locator {
  return panelNode(page, panelId).locator("[data-size-indicator]");
}

/** A caixa de um bloco, medida no navegador. */
export async function panelBox(
  page: Page,
  panelId: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await panelFrame(page, panelId).boundingBox();
  if (!box) throw new Error(`bloco "${panelId}" sem bounding box`);
  return box;
}

/**
 * A caixa do NÓ POSICIONADO (a célula do grid).
 *
 * O adendo §2.5 exige que o bounding box do nó de layout seja
 * `w*CELL + (w-1)*GAP`. O `section` é o desenho; este div é a célula.
 */
export async function cellBox(
  page: Page,
  panelId: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await panelNode(page, panelId).boundingBox();
  if (!box) throw new Error(`célula de "${panelId}" sem bounding box`);
  return box;
}

/**
 * O LADO DA CÉLULA, em pixels, medido do container real da grade.
 *
 * A fórmula é a mesma do `cellSize` do app:
 *
 *     usable = larguraDoContainer - GAP * (COLUNAS - 1)
 *     side   = usable / COLUNAS
 *
 * O E2E mede o container NO NAVEGADOR — não recalcula a partir do estado do
 * React — para que o teste concorde com o que a tela mostra.
 */
export async function gridCellSide(page: Page): Promise<number> {
  const width = await page.evaluate(() => {
    const grid = document.querySelector("[data-grid-container]");
    if (!grid) return 0;
    return grid.getBoundingClientRect().width;
  });

  // A MESMA conta do `cellSize` do app:
  //
  //     usable = larguraDoContainer - GAP * (COLUNAS - 1)
  //     side   = usable / COLUNAS
  //
  // O container e medido NO NAVEGADOR; o gap e o numero de colunas vem da
  // constante do app, importada aqui — assim o teste concorda com a tela.
  const usable = width - GRID_GAP_PX * (GRID_COLUMNS - 1);
  return usable / GRID_COLUMNS;
}

/**
 * Arrasta um bloco pelo handle, em passos pequenos.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE PASSOS PEQUENOS E NÃO UM `dragTo`
 *
 * O dnd-kit não usa o evento nativo de drag-and-drop: ele escuta
 * `pointerdown`/`pointermove`/`pointerup`. Um `mouse.move` grande e único
 * passa por cima da distância de ativação, mas o dnd-kit calcula a posição
 * do ponteiro a cada `pointermove` — e um salto só produz um destino, não
 * o caminho. Passos pequenos reproduzem o que o dedo faz.
 * ───────────────────────────────────────────────────────────────────────────
 */
export async function dragPanel(
  page: Page,
  panelId: string,
  dx: number,
  dy: number,
): Promise<void> {
  const handle = dragHandle(page, panelId);

  // Rola até o handle: sem isso, o bloco pode estar fora da janela, e o
  // `pointerdown` cairia no `<html>` em vez do handle.
  await handle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(60);

  const box = await handle.boundingBox();
  if (!box) throw new Error(`handle de "${panelId}" sem bounding box`);

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(startX + (dx * i) / steps, startY + (dy * i) / steps);
  }

  await page.mouse.up();
  // O layout é gravado no fim do gesto; esperar o `pointerup` processar evita
  // medir o estado anterior.
  await page.waitForTimeout(200);
}

/** Arrasta um handle de LISTA de um item para a posição de outro. */
export async function dragListItem(
  page: Page,
  from: Locator,
  to: Locator,
): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  await page.waitForTimeout(60);

  const boxFrom = await from.boundingBox();
  const boxTo = await to.boundingBox();
  if (!boxFrom || !boxTo) throw new Error("handles de lista sem caixa");

  const startX = boxFrom.x + boxFrom.width / 2;
  const startY = boxFrom.y + boxFrom.height / 2;
  const endX = boxTo.x + boxTo.width / 2;
  const endY = boxTo.y + boxTo.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      startX + ((endX - startX) * i) / steps,
      startY + ((endY - startY) * i) / steps,
    );
  }

  await page.mouse.up();
  await page.waitForTimeout(250);
}

/** Lê o layout salvo no `localStorage` (a fonte de verdade da posição). */
export async function readLayout(
  page: Page,
): Promise<{ panelId: string; x: number; y: number; w: number; h: number }[]> {
  return page.evaluate(() => {
    const prefix = "rpgv3";
    const index = window.localStorage.getItem(`${prefix}:sheets`);
    const summaries = index ? (JSON.parse(index) as { id: string }[]) : [];
    const first = summaries[0];
    if (!first) return [];
    const raw = window.localStorage.getItem(`${prefix}:sheet:${first.id}`);
    if (!raw) return [];
    const sheet = JSON.parse(raw) as {
      layout: { panelId: string; x: number; y: number; w: number; h: number }[];
    };
    return sheet.layout;
  });
}

/** O item de um painel dentro do layout salvo. */
export async function layoutEntry(
  page: Page,
  panelId: string,
): Promise<{ x: number; y: number; w: number; h: number }> {
  const layout = await readLayout(page);
  const found = layout.find((entry) => entry.panelId === panelId);
  if (!found) throw new Error(`painel "${panelId}" ausente do layout salvo`);
  return found;
}

/**
 * Espera o AUTOSAVE gravar uma condição no layout.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ESPERAR POR CONDIÇÃO E NÃO POR TEMPO
 *
 * A gravação é debounced (`SAVE_DEBOUNCE_MS`): o gesto marca a ficha como
 * suja e agenda a escrita. Ler o `localStorage` no mesmo instante lê o
 * estado ANTERIOR — e o teste falha sem que exista bug nenhum.
 *
 * Esperar por um tempo fixo resolve, mas é uma aposta: em máquina sob carga
 * o debounce estica, e o teste vira uma loteria. Esperar pela CONDIÇÃO é
 * determinístico: ou a gravação aconteceu, ou o tempo acabou.
 * ───────────────────────────────────────────────────────────────────────────
 */
export async function waitForLayout(
  page: Page,
  panelId: string,
  check: (entry: { x: number; y: number; w: number; h: number }) => boolean,
  timeoutMs = 8000,
): Promise<{ x: number; y: number; w: number; h: number }> {
  const limite = Date.now() + timeoutMs;
  let ultimo = await layoutEntry(page, panelId);

  while (Date.now() < limite) {
    if (check(ultimo)) return ultimo;
    await page.waitForTimeout(120);
    ultimo = await layoutEntry(page, panelId);
  }

  return ultimo;
}

/** Abre o lápis do Editar de um bloco (não o Editar Geral). */
export async function openBlockEdit(
  page: Page,
  panelId: string,
): Promise<void> {
  const lapis = panelNode(page, panelId).getByRole("button", {
    name: "Editar bloco",
  });

  // Rola até o lápis: o bloco pode estar muito abaixo da dobra, e o clique
  // automático do Playwright nem sempre deixa o botão no ponto certo.
  await lapis.scrollIntoViewIfNeeded();
  await lapis.click();
  await expect(
    panelNode(page, panelId).getByRole("button", {
      name: "Concluir edição do bloco",
    }),
  ).toBeVisible();
}

/** O número de colunas do grid (a constante do app). */
export const GRID_COLUMNS = 48;

/** O gap em pixels entre células. */
export const GAP = GRID_GAP_PX;
