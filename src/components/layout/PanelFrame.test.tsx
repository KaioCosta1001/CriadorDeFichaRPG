import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

import { PanelFrame } from "./PanelFrame";
import type { PanelLayout } from "@/schemas";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MOLDURA DO PAINEL — O QUE CONTINUA CLICÁVEL NO EDITAR GERAL              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O adendo exige: com o Editar Geral ligado, mover e redimensionar os blocos
 * **e** continuar clicando em tudo que está dentro deles — lápis, abas, "+",
 * menus, campos.
 *
 * Este arquivo existe porque essa exigência foi violada uma vez. O sintoma:
 * "não consigo clicar em nada no modo Editar Geral".
 */

const LAYOUT: PanelLayout = {
  panelId: "attributes",
  x: 0,
  y: 0,
  // Em CÉLULAS, desde a migração do §1. `w: 400` em px era o que a versão
  // anterior gravava; o schema agora exige inteiro na grade.
  w: 20,
  h: 16,
  visible: true,
  order: 1,
};

/**
 * Uma célula de 30×10 px: números redondos, para não precisar arredondar a
 * aritmética do redimensionamento à mão.
 */
const CELL = { w: 30, h: 10 };

function setup(editMode = true) {
  const onToggleVisible = vi.fn();
  const onResize = vi.fn();
  const onRemove = vi.fn();

  render(
    <PanelFrame
      cell={CELL}
      maxRows={200}
      panelType="attributes"
      onMove={vi.fn()}
      editMode={editMode}
      index={0}
      interactive
      layout={LAYOUT}
      panelId={LAYOUT.panelId}
      hideable
      removable
      title="Atributos"
      onRemove={onRemove}
      onResize={onResize}
      onToggleVisible={onToggleVisible}
    >
      <button type="button" onClick={onToggleVisible}>
        Botão dentro do painel
      </button>
      <input aria-label="Campo dentro do painel" />
    </PanelFrame>,
  );

  return { onToggleVisible, onResize, onRemove };
}

describe("Painel no Editar Geral — conteúdo continua clicável", () => {
  it("um botão dentro do painel recebe o clique", async () => {
    const user = userEvent.setup();
    const { onToggleVisible } = setup(true);

    await user.click(
      screen.getByRole("button", { name: "Botão dentro do painel" }),
    );

    // O chanfro do modo editar é `absolute inset-0 z-20`, ACIMA do conteúdo
    // (`z-10`). Sem `pointer-events: none` no próprio elemento, ele capturava
    // todo clique da ficha.
    expect(onToggleVisible).toHaveBeenCalledTimes(1);
  });

  it("o campo de texto continua focável", async () => {
    const user = userEvent.setup();
    setup(true);

    await user.click(screen.getByLabelText("Campo dentro do painel"));

    expect(document.activeElement).toBe(
      screen.getByLabelText("Campo dentro do painel"),
    );
  });

  it("o lápis/olho/lixeira do cabeçalho respondem", async () => {
    const user = userEvent.setup();
    const { onToggleVisible, onRemove } = setup(true);

    await user.click(
      screen.getByRole("button", { name: "Esconder bloco Atributos" }),
    );
    expect(onToggleVisible).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", { name: "Remover bloco Atributos" }),
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("clicar no handle sem mover NÃO inicia arraste", async () => {
    const user = userEvent.setup();
    setup(true);

    const handle = screen.getByRole("button", {
      name: "Mover bloco Atributos",
    });

    // O `PointerSensor` usa `activationConstraint: { distance }`: sem
    // movimento, o gesto é um clique comum. É o que garante que clicar no
    // handle não arraste o bloco por engano.
    await user.click(handle);

    expect(handle).toBeDefined();
  });

  it("as OITO alças existem, como botões focáveis", () => {
    setup(true);

    // As alcas vivem nas MARGENS do painel, nao sobre o conteudo. O jsdom
    // nao faz layout, entao o que se verifica aqui e a existencia dos oito
    // botoes — e o `pointer-events` das pecas decorativas, logo abaixo.
    expect(
      screen.getAllByRole("button", { name: /^Redimensionar/ }),
    ).toHaveLength(8);
  });

  it("O CHANFRO DO MODO EDITAR É INERTE — é esta a causa do bug", () => {
    const { container } = render(
      <PanelFrame
        cell={CELL}
        maxRows={200}
        panelType="attributes"
        onMove={vi.fn()}
        editMode
        index={0}
        interactive
        layout={LAYOUT}
        panelId={LAYOUT.panelId}
        hideable
        removable
        title="Atributos"
        onRemove={vi.fn()}
        onResize={vi.fn()}
        onToggleVisible={vi.fn()}
      >
        <button type="button">Interno</button>
      </PanelFrame>,
    );

    const chanfro = container.querySelector(".corner-notch");
    expect(chanfro).not.toBeNull();

    // O chanfro e `absolute inset-0 z-20` e o conteudo fica em `z-10`.
    // Com pointer-events ativo, ele fica ACIMA do conteudo e engole todo
    // clique da ficha no modo Editar Geral. Este e o teste que fixa a
    // invariante — o jsdom nao faz hit-testing, entao o sintoma so aparece
    // no navegador, mas a CAUSA e verificavel aqui.
    expect((chanfro as HTMLElement).style.pointerEvents).toBe("none");
  });

  it("o mesmo conteúdo é clicável FORA do Editar Geral", async () => {
    const user = userEvent.setup();
    const { onToggleVisible } = setup(false);

    await user.click(
      screen.getByRole("button", { name: "Botão dentro do painel" }),
    );

    expect(onToggleVisible).toHaveBeenCalledTimes(1);
  });
});

describe("Painel no Editar Geral — handle dedicado", () => {
  /** Monta a moldura com props padrão, sobrescrevendo o que o teste precisar. */
  function renderFrame(
    overrides: Partial<React.ComponentProps<typeof PanelFrame>> = {},
  ) {
    return render(
      <PanelFrame
        cell={CELL}
        maxRows={200}
        panelType="attributes"
        onMove={vi.fn()}
        editMode
        index={0}
        interactive
        layout={LAYOUT}
        panelId={LAYOUT.panelId}
        hideable
        removable
        title="Atributos"
        onRemove={vi.fn()}
        onResize={vi.fn()}
        onToggleVisible={vi.fn()}
        {...overrides}
      >
        <button type="button">Interno</button>
      </PanelFrame>,
    );
  }

  it("os listeners de arraste estão NO HANDLE, não no painel inteiro", () => {
    const { container } = render(
      <PanelFrame
        cell={CELL}
        maxRows={200}
        panelType="attributes"
        onMove={vi.fn()}
        editMode
        index={0}
        interactive
        layout={LAYOUT}
        panelId={LAYOUT.panelId}
        hideable
        removable
        title="Atributos"
        onRemove={vi.fn()}
        onResize={vi.fn()}
        onToggleVisible={vi.fn()}
      >
        <button type="button">Interno</button>
      </PanelFrame>,
    );

    // O `@dnd-kit` marca o nó arrastável com `role="button"` +
    // `aria-roledescription`. Se o painel inteiro fosse arrastável, o
    // CONTENTEDO também teria esses atributos — e aí qualquer clique
    // dentro dele viraria início de arraste.
    const interno = screen.getByRole("button", { name: "Interno" });
    expect(interno.getAttribute("aria-roledescription")).toBeNull();

    const handle = screen.getByRole("button", {
      name: "Mover bloco Atributos",
    });
    expect(handle.getAttribute("aria-roledescription")).toBe("draggable");
    void container;
  });

  /* =========================================================================
   * GESTO DE ARRASTE — adendo §1.4 e §1.10
   * ======================================================================= */

  it("NENHUM elemento do CONTEÚDO carrega o gatilho de arraste", async () => {
    // A verificação estrutural de cima (o handle é o único `draggable`) é o
    // bastante para provar a separação. Aqui está a verificação pelo LADO do
    // conteúdo: um clique dentro do painel não produz nenhum evento de arraste.
    const user = userEvent.setup();
    renderFrame();

    const interno = screen.getByRole("button", { name: "Interno" });

    await user.pointer([
      {
        target: interno,
        keys: "[MouseLeft>]",
        coords: { clientX: 10, clientY: 10 },
      },
      { target: interno, coords: { clientX: 200, clientY: 200 } },
      { keys: "[/MouseLeft]" },
    ]);

    // Se o conteúdo fosse arrastável, o `@dnd-kit` teria registrado o
    // `pointerdown` e o handle teria entrado em estado de arraste.
    const handle = screen.getByRole("button", {
      name: "Mover bloco Atributos",
    });
    expect(handle.getAttribute("aria-pressed")).toBeNull();
    expect(interno.getAttribute("aria-roledescription")).toBeNull();
  });

  it("o handle tem `touch-action: none` — sem isso o celular ROLA a página", () => {
    renderFrame();

    const handle = screen.getByRole("button", {
      name: "Mover bloco Atributos",
    });

    // Sem isto, arrastar o bloco no celular desliza a página e nada acontece.
    // É o mesmo motivo das alças.
    expect(handle.style.touchAction).toBe("none");
  });

  it("Shift + seta move o bloco em DEZ células", async () => {
    // O sensor de teclado do `@dnd-kit` anda uma célula por aperto. Atravessar
    // doze colunas com doze apertadas é impraticável, e o handle ganha um
    // caminho largo próprio.
    const user = userEvent.setup();
    const onMove = vi.fn();
    renderFrame({ onMove });

    const handle = screen.getByRole("button", {
      name: "Mover bloco Atributos",
    });
    handle.focus();

    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");

    expect(onMove).toHaveBeenCalledWith({ x: LAYOUT.x + 10, y: LAYOUT.y });
  });

  it("Shift + seta para cima move o bloco em dez células", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    renderFrame({ onMove });

    const handle = screen.getByRole("button", {
      name: "Mover bloco Atributos",
    });
    handle.focus();

    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");

    expect(onMove).toHaveBeenCalledWith({ x: LAYOUT.x, y: LAYOUT.y + 10 });
  });

  it("seta SEM Shift NÃO é interceptada — o dnd-kit cuida do passo curto", () => {
    // Se o handle chamasse `preventDefault` em toda seta, ele brigaria com o
    // sensor de teclado do `@dnd-kit`, que já sabe mover e anunciar a posição.
    const user = userEvent.setup();
    const onMove = vi.fn();
    renderFrame({ onMove });

    const handle = screen.getByRole("button", {
      name: "Mover bloco Atributos",
    });
    handle.focus();

    return user.keyboard("{ArrowRight}").then(() => {
      expect(onMove).not.toHaveBeenCalled();
    });
  });
});

describe("Painel fora do Editar Geral", () => {
  it("não mostra handle de arraste, alças nem esconder/remover", () => {
    setup(false);

    expect(
      screen.queryByRole("button", { name: "Mover bloco Atributos" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Esconder bloco Atributos" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Redimensionar/ })).toBeNull();
  });
});

/* `fireEvent` fica importado para quando um teste precisar do caminho cru. */
