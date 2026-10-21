import { defineConfig, devices } from "@playwright/test";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CONFIGURAÇÃO DO PLAYWRIGHT (E2E)                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE E2E E NÃO SÓ JSDOM
 *
 * Porque três dos bugs deste adendo são INVISÍVEIS no jsdom:
 *
 *  1. **Célula quadrada.** O jsdom não calcula layout: `getBoundingClientRect()`
 *     devolve zeros. Só um navegador real diz que "12x12 células" saiu
 *     retangular.
 *  2. **Hitbox.** `document.elementFromPoint` precisa de layout real para
 *     responder "o que está neste ponto da tela".
 *  3. **Arraste diagonal.** O dnd-kit calcula o destino a partir de
 *     `getBoundingClientRect()` de cada alvo — com retângulos zerados, não há
 *     para onde ir.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `webServer`
 *
 * Sobe o app de PRODUÇÃO (`next build` + `next start`), não o de
 * desenvolvimento. O build é o que o usuário recebe, e ele valida o CSP com
 * nonce — que quebraria o E2E se o servidor fosse o de desenvolvimento.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * TRACE E SCREENSHOT
 *
 * `trace: "retain-on-failure"` guarda o trace da execução que falhou — o
 * `trace.zip` mostra cada evento de mouse, o DOM em cada passo e o screenshot
 * do momento exato da falha. `screenshot: "only-on-failure"` salva o PNG.
 *
 * Os dois ficam em `test-results/`, e o resumo do adendo cita os caminhos.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  /* O E2E de layout é lento (arrastar 20x, medir caixas): o padrão de 30 s
     estoura em máquina sob carga. */
  timeout: 90_000,
  expect: { timeout: 15_000 },
  /* Um worker só: os testes mexem no mesmo `localStorage` e no mesmo servidor,
     e o paralelismo só compraria interferência. */
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    /* O app persiste em `localStorage`; cada teste começa limpo. */
    viewport: { width: 1600, height: 1000 },
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // ─────────────────────────────────────────────────────────────────
        // O VIEWPORT PRECISA SER EXPLICITO AQUI
        //
        // O `use` do projeto tem precedência sobre o `use` de nível superior.
        // O `devices["Desktop Chrome"]` traz 1280×720, que substituía os
        // 1600×1000 do topo — e a grade não cabe em 720px de altura.
        //
        // Com o bloco testado FORA da janela, o `elementFromPoint` devolvia
        // `null` e o `pointerdown` caía no `<html>`: o arraste nunca
        // começava, e o teste falhava sem que houvesse bug nenhum.
        // ─────────────────────────────────────────────────────────────────
        viewport: { width: 1600, height: 1200 },
      },
    },
  ],

  webServer: {
    command: `npm.cmd run build && npm.cmd start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
