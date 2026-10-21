import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  NENHUM ARQUIVO DO PROJETO PODE TER ENCODING CORROMPIDO                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE ACONTECEU
 *
 * Um arquivo foi gravado uma vez em que os bytes UTF-8 foram interpretados
 * como Windows-1252. O "ç" (0xC3 0xA7) virou "Ã§", e o "ã" virou "Ã£".
 *
 * O arquivo CONTINUAVA COMPILANDO, os testes CONTINUAVAM PASSANDO — e o
 * botão dizia, na tela do usuário:
 *
 *     Concluir ediÃ§Ã£o do bloco
 *
 * Nada no jsdom denuncia isso: o `aria-label` é uma string qualquer para o
 * DOM. Só quando um teste E2E procurou o botão pelo nome acessível é que a
 * corrupção apareceu.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM TESTE DE ARQUIVO
 *
 * A alternativa — testar cada label — não escala: são centenas de strings,
 * e a maioria só éDigitada por engano de novo. Um teste que varre os
 * ARQUIVOS pega a causa, não os sintomas: qualquer string corrompida, em
 * qualquer lugar, including comentários e mensagens de erro.
 *
 * O padrão procurado é o que a leitura errada produz: uma letra latina
 * (`Ã`, `Â`, `â`) seguida de um símbolo de pontuação (`§`, `£`, `€`, `¢`).
 * Numa frase em português legível, essa combinação não aparece.
 * ───────────────────────────────────────────────────────────────────────────
 */

// O vitest roda da raiz do projeto — `process.cwd()` é o caminho confiável
// (o `import.meta.url` nao existe no ambiente jsdom do vitest).
const RAIZ = resolve(process.cwd(), "src");

const EXTENSOES = new Set([".ts", ".tsx", ".css", ".md", ".json"]);

/** `Ã§`, `Â£`, `â€™`, `€`… — o rastro da leitura errada. */
const MOJIBAKE =
  /Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â€[\u0080-\u00BF]|â[\u0080-\u00BF]¢/u;

/** Arquivos que não são código do projeto. */
function ignorar(diretorio: string): boolean {
  return (
    diretorio === "node_modules" ||
    diretorio === ".next" ||
    diretorio === "test-results" ||
    diretorio === "playwright-report"
  );
}

function listar(diretorio: string): string[] {
  const arquivos: string[] = [];

  for (const entrada of readdirSync(diretorio)) {
    if (ignorar(entrada)) continue;

    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) {
      arquivos.push(...listar(caminho));
    } else if (EXTENSOES.has(extname(entrada))) {
      arquivos.push(caminho);
    }
  }

  return arquivos;
}

describe("encoding dos arquivos", () => {
  it("nenhum arquivo tem texto corrompido", () => {
    const corrompidos: string[] = [];

    for (const arquivo of listar(RAIZ)) {
      // O PRÓPRIO teste contém o padrão procurado — ele é a régua, não a
      // parede. Sem esta exclusão, o teste accuse a si mesmo.
      if (arquivo.endsWith("encoding.spec.ts")) continue;

      const conteudo = readFileSync(arquivo, "utf8");

      // A leitura errada também deixa o caractere de substituição (U+FFFD)
      // quando o byte não existe nem em Windows-1252.
      if (MOJIBAKE.test(conteudo) || conteudo.includes("\uFFFD")) {
        corrompidos.push(arquivo.replace(RAIZ, "src"));
      }
    }

    expect(
      corrompidos,
      `texto corrompido (UTF-8 lido como Windows-1252) em:\n${corrompidos.join("\n")}`,
    ).toEqual([]);
  });
});
