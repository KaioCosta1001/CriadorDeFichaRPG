import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  dragPanel,
  enableEditMode,
  openBlockEdit,
  openSheet,
  panelNode,
} from "./helpers";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CAPTURAS DE TELA DO ADENDO DE AUDITORIA DE DnD                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Este teste grava as telas que o resumo do adendo cita. As imagens ficam em
 * `e2e/screenshots/` — versionadas, para o resumo não depender de uma pasta
 * de resultados que o próximo run apaga.
 *
 * O `trace` do Playwright (o que mostra cada evento de mouse, o DOM em cada
 * passo e o screenshot do momento exato) fica em `test-results/`, e é o que
 * reproduz um gesto de arraste passo a passo.
 */

const SAIDA = resolve(
  process.cwd(),
  process.env.E2E_SHOT_DIR ?? "e2e/screenshots",
);

test.describe("capturas", () => {
  test("A — Perfil no Editar Geral, com o indicador de tamanho medido", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    mkdirSync(SAIDA, { recursive: true });

    // O PERFIL, com o Editar Geral ligado: o contorno tracejado, o handle de
    // arraste, as alças de resize DENTRO do painel e o indicador de tamanho
    // mostrando pixels MEDIDOS + células.
    await panelNode(page, "profile").screenshot({
      path: resolve(SAIDA, "A-perfil-indicador-de-tamanho.png"),
    });

    // A GRADE INTEIRA, para ver a relação entre os blocos.
    await page.screenshot({
      path: resolve(SAIDA, "A-grade-editar-geral.png"),
      fullPage: false,
    });

    expect(true).toBe(true);
  });

  test("B — o bloco movido na diagonal, com a grade de fundo", async ({
    page,
  }) => {
    await openSheet(page);
    await enableEditMode(page);

    // Arrasta na diagonal: o bloque andou nos DOIS eixos.
    await dragPanel(page, "profile", 120, 80);
    await page.waitForTimeout(400);

    mkdirSync(SAIDA, { recursive: true });
    await page.screenshot({
      path: resolve(SAIDA, "B-bloco-movido-na-diagonal.png"),
    });

    expect(true).toBe(true);
  });

  test("C — o handle da lista, no Editar do bloco", async ({ page }) => {
    await openSheet(page);

    mkdirSync(SAIDA, { recursive: true });

    // ───────────────────────────────────────────────────────────────────
    // POR QUE DUAS CAPTURAS
    //
    // A causa raiz do adendo é a handle estar na PORTA ERRADA: ela vivia no
    // Editar Geral (que move o PAINEL) em vez do lápis do bloco (que
    // reordena a LISTA). Mostrar as duas portas deixa isso visível.
    // ───────────────────────────────────────────────────────────────────

    // O Editar Geral: move o PAINEL, e NÃO deve mostrar handle de lista.
    await enableEditMode(page);
    await panelNode(page, "skills").screenshot({
      path: resolve(SAIDA, "C1-editar-geral-sem-handle-de-lista.png"),
    });

    // Sai do Editar Geral e abre o lápis do bloco de Perícias.
    await page.getByRole("button", { name: "Concluir edição" }).first().click();
    await openBlockEdit(page, "skills");

    await panelNode(page, "skills").screenshot({
      path: resolve(SAIDA, "C2-editar-do-bloco-com-handle-de-lista.png"),
    });

    expect(true).toBe(true);
  });
});
