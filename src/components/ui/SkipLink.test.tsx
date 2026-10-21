import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LIST_CONTENT_ID, SHEET_CONTENT_ID, SkipLink } from "./SkipLink";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PULAR PARA O CONTEÚDO — WCAG 2.4.1 (Bypass Blocks)                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Um pulador quebrado é o pior tipo de defeito acessível: o link existe, tem
 * o visual certo, e no clique não acontece nada. Não há erro no console nem
 * nada vermelho na tela — só a pessoa voltando ao topo sem entender por quê.
 *
 * Estes testes travam o CONTRATO do componente. A verificação de que o alvo
 * existe de fato na tela é feita em `SheetScreen.test.tsx`, que monta a tela
 * inteira; aqui não há tela nenhuma para montar.
 */
describe("SkipLink", () => {
  it("é um link de verdade, não uma div com onclick", () => {
    render(<SkipLink targetId="alvo" />);

    // Sem `href` não há navegação por teclado, não há menu de contexto com
    // "abrir em nova aba" e o leitor de tela não anuncia como link.
    const link = screen.getByRole("link");

    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#alvo");
  });

  it("usa a classe que o CSS conhece", () => {
    render(<SkipLink targetId="alvo" />);
    // A regra `.skip-link` é o que esconde o link até ele receber foco. Se o
    // nome da classe mudar aqui sem mudar no CSS, o link fica visível para
    // sempre — e passa a ser um elemento estranho no topo da tela.
    expect(screen.getByRole("link").className).toContain("skip-link");
  });
});

describe("SkipLink — rótulo", () => {
  it("tem um rótulo padrão que já diz o destino", () => {
    render(<SkipLink targetId="alvo" />);
    expect(screen.getByRole("link").textContent).toBe("Pular para o conteúdo");
  });

  it("aceita rótulo próprio por tela", () => {
    render(<SkipLink targetId="alvo" label="Pular para os blocos" />);
    expect(screen.getByText("Pular para os blocos")).toBeDefined();
  });

  it("o texto é visível para o leitor de tela — não é só um ícone", () => {
    // Um `aria-label` resolveria, mas texto real é melhor: funciona também
    // quando o CSS falha e o link aparece por acidente.
    render(<SkipLink targetId="alvo" />);
    expect(screen.getByRole("link").innerHTML).toBe("Pular para o conteúdo");
  });
});

describe("SkipLink — os ids de destino", () => {
  it("os dois ids são distintos", () => {
    // Se fossem iguais, as duas telas montadas ao mesmo tempo disputariam o
    // mesmo alvo e o pulador da ficha jogaria o foco no lugar errado.
    expect(SHEET_CONTENT_ID).not.toBe(LIST_CONTENT_ID);
  });

  it("são válidos como âncora HTML", () => {
    // Um id com espaço ou acento funciona como âncora mas quebra em
    // `querySelector` e em alguns leitores. O prefixo de letra garante que
    // começa como nome, não como número.
    for (const id of [SHEET_CONTENT_ID, LIST_CONTENT_ID]) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("o link montado para cada tela aponta para o id correspondente", () => {
    const { unmount } = render(<SkipLink targetId={SHEET_CONTENT_ID} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      `#${SHEET_CONTENT_ID}`,
    );
    unmount();

    render(<SkipLink targetId={LIST_CONTENT_ID} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      `#${LIST_CONTENT_ID}`,
    );
  });
});
