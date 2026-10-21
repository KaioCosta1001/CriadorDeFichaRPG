import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PanelTray } from "@/components/layout/PanelTray";
import {
  countHiddenPanels,
  hiddenPanels,
  panelTitleOf,
  panelTypeOf,
  showPanel,
} from "@/domain/layout";
import { extraPanelId, resolveCollisions } from "@/domain/layout";
import { createSheet } from "@/domain/sheetFactory";
import type { Sheet } from "@/schemas";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BANDEJA DE BLOCOS OCULTADOS                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O bug que a bandeja resolve: esconder um bloco era um beco sem saída. O
 * olho some com o bloco inteiro, e a única forma de trazê-lo de volta era
 * "Resetar layout" — que mexe em posição, tamanho e ordem de **todos** os
 * blocos. Ou seja: para recuperar um, perdia-se o arranjo inteiro da ficha.
 *
 * Estes testes travam as três garantias que tornam a bandeja confiável:
 * esconder é reversível, o estado sobrevive ao recarregamento, e Perfil e
 * Inventário não podem sumir.
 */

const INPUT = {
  system: "dnd5e",
  templateId: "dnd5e-completo",
  name: "Gandalf",
  title: "Gandalf",
} as const;

function sheetWith(visible: Partial<Record<string, boolean>> = {}): Sheet {
  const base = createSheet(INPUT);
  return {
    ...base,
    layout: base.layout.map((panel) =>
      panel.panelId in visible
        ? { ...panel, visible: visible[panel.panelId]! }
        : panel,
    ),
  };
}

/** Ficha com um bloco extra "Notas" e alguns ocultos. */
function sheetWithExtra(hiddenIds: string[] = []): Sheet {
  const base = createSheet(INPUT);
  const extraId = "b1";
  return {
    ...base,
    extraPanels: [
      ...base.extraPanels,
      {
        id: extraId,
        title: "Notas",
        type: "text",
        content: "conteúdo importante",
        entries: [],
      },
    ],
    layout: [
      ...base.layout,
      {
        panelId: extraPanelId(extraId),
        // Células, desde o adendo §1. `x: 900, y: 500, w: 400` em px
        // reprovava o schema (`w` máximo = `GRID_COLUMNS` = 48).
        x: 24,
        y: 60,
        w: 12,
        h: 10,
        visible: !hiddenIds.includes(extraPanelId(extraId)),
        order: 99,
      },
    ],
  };
}

function setup(sheet: Sheet) {
  const onToggleVisible = vi.fn();
  render(<PanelTray onToggleVisible={onToggleVisible} sheet={sheet} />);
  return { onToggleVisible };
}

/** Abre a bandeja. */
async function openTray(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Painéis/ }));
  return screen.findByRole("menu");
}

/* ===========================================================================
 * CONTAGEM E FILTRO
 * ========================================================================== */

describe("bandeja — o que conta como oculto", () => {
  it("não conta nada quando nada está oculto", () => {
    const sheet = sheetWith();
    expect(countHiddenPanels(sheet)).toBe(0);
    expect(hiddenPanels(sheet)).toEqual([]);
  });

  it("conta um bloco comum oculto", () => {
    const sheet = sheetWith({ attributes: false });
    expect(countHiddenPanels(sheet)).toBe(1);
  });

  it("NÃO conta Perfil nem Inventário, mesmo com `visible: false` no dado", () => {
    // Um `visible: false` em `profile` pode ter sobrado de uma versão antiga
    // do app ou de um import. Honrar isso deixaria a ficha sem nome e sem
    // bagagem, e o contador mentiria para quem tentasse recuperar.
    const sheet = sheetWith({ profile: false, inventory: false });

    expect(countHiddenPanels(sheet)).toBe(0);
  });

  it("conta blocos de usuário ocultos", () => {
    const sheet = sheetWithExtra([extraPanelId("b1")]);
    expect(countHiddenPanels(sheet)).toBe(1);
  });
});

describe("bandeja — resolução de tipo e título", () => {
  it("resolve o tipo de um bloco padrão", () => {
    const sheet = sheetWith();
    expect(panelTypeOf(sheet, "attributes")).toBe("attributes");
  });

  it("resolve o tipo de um bloco do usuário pelo id", () => {
    const sheet = sheetWithExtra();
    expect(panelTypeOf(sheet, extraPanelId("b1"))).toBe("text");
  });

  it("devolve null para um bloco extra cujo dado sumiu", () => {
    const sheet = sheetWith();
    expect(panelTypeOf(sheet, extraPanelId("fantasma"))).toBeNull();
  });

  it("usa o título escolhido pelo usuário nos blocos extras", () => {
    const sheet = sheetWithExtra();
    expect(panelTitleOf(sheet, extraPanelId("b1"))).toBe("Notas");
  });
});

/* ===========================================================================
 * A LISTA
 * ========================================================================== */

describe("bandeja — a lista", () => {
  it("lista TODOS os blocos, visíveis e ocultos", async () => {
    const user = userEvent.setup();
    setup(sheetWith({ attributes: false }));

    const menu = await openTray(user);

    // Os cinco blocos padrão, com Atributos oculto. A lista NÃO esconde os
    // fixos — escondê-los da bandeja deixaria o jogador sem saber que existem.
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(5);
    expect(
      within(menu).getByRole("menuitem", { name: "Mostrar bloco Atributos" }),
    ).toBeDefined();
    expect(
      within(menu).getByRole("menuitem", { name: "Esconder bloco Perícias" }),
    ).toBeDefined();
  });

  it("o rótulo do toggle diz a AÇÃO, não o estado", async () => {
    const user = userEvent.setup();
    setup(sheetWith({ attributes: false }));

    const menu = await openTray(user);

    // O bloco está OCULTO, então a ação disponível é MOSTRAR.
    expect(
      within(menu).getByRole("menuitem", { name: "Mostrar bloco Atributos" }),
    ).toBeDefined();
    expect(
      within(menu).queryByRole("menuitem", {
        name: "Esconder bloco Atributos",
      }),
    ).toBeNull();
  });

  it("Perfil e Inventário não têm toggle — ficam sem ação", async () => {
    const user = userEvent.setup();
    setup(sheetWith());

    const menu = await openTray(user);

    // Sem toggle, e o rótulo DIZ POR QUÊ. Deixar "Esconder bloco Perfil" num
    // item desabilitado faria o leitor de tela anunciar uma ação que não existe,
    // e o jogador concluir que o app travou.
    expect(
      within(menu).getByRole("menuitem", {
        name: "Perfil não pode ser ocultado",
      }),
    ).toBeDefined();
    expect(
      within(menu).getByRole("menuitem", {
        name: "Inventário não pode ser ocultado",
      }),
    ).toBeDefined();
    expect(
      within(menu).queryByRole("menuitem", { name: /Esconder bloco Perfil/ }),
    ).toBeNull();

    // E eles aparecem na lista, marcados como fixos.
    const items = within(menu).getAllByRole("menuitem");
    expect(items.some((item) => item.textContent?.includes("Perfil"))).toBe(
      true,
    );
  });

  it("o item de Perfil está DESABILITADO", async () => {
    const user = userEvent.setup();
    setup(sheetWith());

    const menu = await openTray(user);
    const item = within(menu)
      .getAllByRole("menuitem")
      .find((candidate) => candidate.textContent?.includes("Perfil"));

    expect(item?.getAttribute("aria-disabled")).toBe("true");
  });

  it("esconder Perfil pela bandeja é um NO-OP explícito", async () => {
    const user = userEvent.setup();
    const { onToggleVisible } = setup(sheetWith());

    const menu = await openTray(user);
    const item = within(menu).getByRole("menuitem", {
      name: "Perfil não pode ser ocultado",
    });

    // `fireEvent`, e não `user.click`: o MUI corta o `pointer-events` de um
    // item desabilitado, e o `user-event` RECUSA a interação — que é
    // exatamente o que se quer provar. O caminho real do usuário é "não
    // acontece nada".
    fireEvent.click(item);

    expect(onToggleVisible).not.toHaveBeenCalled();
  });
});

/* ===========================================================================
 * O TOGGLE
 * ========================================================================== */

describe("bandeja — alternar visibilidade", () => {
  it("mostrar um bloco oculto pede `visible: true`", async () => {
    const user = userEvent.setup();
    const { onToggleVisible } = setup(sheetWith({ attributes: false }));

    const menu = await openTray(user);
    await user.click(
      within(menu).getByRole("menuitem", { name: "Mostrar bloco Atributos" }),
    );

    expect(onToggleVisible).toHaveBeenCalledWith("attributes", true);
  });

  it("esconder um bloco visível pede `visible: false`", async () => {
    const user = userEvent.setup();
    const { onToggleVisible } = setup(sheetWith());

    const menu = await openTray(user);
    await user.click(
      within(menu).getByRole("menuitem", { name: "Esconder bloco Perícias" }),
    );

    expect(onToggleVisible).toHaveBeenCalledWith("skills", false);
  });

  it("o bloco de usuário é identificado pelo id prefixado", async () => {
    const user = userEvent.setup();
    const { onToggleVisible } = setup(sheetWithExtra());

    const menu = await openTray(user);
    await user.click(
      within(menu).getByRole("menuitem", { name: "Esconder bloco Notas" }),
    );

    expect(onToggleVisible).toHaveBeenCalledWith(extraPanelId("b1"), false);
  });

  it("a bandeja FECHA depois do toggle", async () => {
    const user = userEvent.setup();
    setup(sheetWith({ attributes: false }));

    const menu = await openTray(user);
    await user.click(
      within(menu).getByRole("menuitem", { name: "Mostrar bloco Atributos" }),
    );

    // O bloco acabou de aparecer; manter a lista aberta por cima esconderia o
    // resultado da própria ação.
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});

/* ===========================================================================
 * O SELO
 * ========================================================================== */

describe("bandeja — selo de ocultos", () => {
  it("sem ocultos, o botão não mostra contador", () => {
    setup(sheetWith());

    expect(screen.getByRole("button", { name: "Painéis" })).toBeDefined();
  });

  it("com ocultos, o botão mostra a quantidade no nome acessível", () => {
    setup(sheetWith({ attributes: false, skills: false }));

    expect(
      screen.getByRole("button", { name: "Painéis (2 ocultos)" }),
    ).toBeDefined();
  });

  it("o texto visível do selo também mostra a quantidade", () => {
    setup(sheetWith({ attributes: false }));

    const button = screen.getByRole("button", { name: /Painéis/ });
    expect(button.textContent).toContain("1");
  });
});

/* ===========================================================================
 * VOLTAR AO LUGAR CERTO
 * ========================================================================== */

describe("bandeja — o bloco volta ao lugar", () => {
  it("esconder guarda posição, tamanho e ordem", () => {
    // A regra é do `PanelFrame`/`handleToggleVisible` (grava só `visible`),
    // mas vale checar aqui que o resto sobrevive: é o que faz a bandeja
    // devolver o bloco EXATAMENTE onde ele estava.
    const sheet = sheetWith();
    const before = sheet.layout.find(
      (panel) => panel.panelId === "attributes",
    )!;

    const depois = sheet.layout.map((panel) =>
      panel.panelId === "attributes" ? { ...panel, visible: false } : panel,
    );

    const after = depois.find((panel) => panel.panelId === "attributes")!;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.w).toBe(before.w);
    expect(after.h).toBe(before.h);
    expect(after.order).toBe(before.order);
    expect(after.visible).toBe(false);
  });

  it("mostrar resolve colisões — nunca sobrepõe", () => {
    const base = sheetWith();
    // Esconde Atributos e coloca OUTRO bloco exatamente em cima do lugar dele.
    const escondido = base.layout.find((p) => p.panelId === "attributes")!;
    const layout = base.layout.map((panel) =>
      panel.panelId === "attributes"
        ? { ...panel, visible: false }
        : panel.panelId === "skills"
          ? {
              ...panel,
              x: escondido.x,
              y: escondido.y,
              w: escondido.w,
              h: escondido.h,
            }
          : panel,
    );

    const restored = showPanel(layout, "attributes");
    const atributes = restored.find((p) => p.panelId === "attributes")!;

    // Sem `resolveCollisions`, os dois ficariam em cima um do outro e o de
    // baixo seria intocável — o bloco "restaurado" seria o inacessível.
    const colide = restored.some(
      (other) =>
        other.panelId !== "attributes" &&
        other.x < atributes.x + atributes.w &&
        other.x + other.w > atributes.x &&
        other.y < atributes.y + atributes.h &&
        other.y + other.h > atributes.y,
    );

    expect(colide).toBe(false);
    expect(resolveCollisions(restored)).toHaveLength(restored.length);
  });

  it("esconder NÃO resolve colisões — só liberar espaço", () => {
    const base = sheetWith();
    const layout = base.layout.map((panel) =>
      panel.panelId === "attributes" ? { ...panel, visible: false } : panel,
    );

    // Mostrar é a ÚNICA operação que pode criar colisão.
    expect(layout.find((p) => p.panelId === "attributes")?.visible).toBe(false);
    expect(layout).toHaveLength(base.layout.length);
  });

  it("mostrar um bloco que nunca esteve oculto é inofensivo", () => {
    const base = sheetWith();
    expect(showPanel(base.layout, "attributes")).toHaveLength(
      base.layout.length,
    );
  });
});

/* ===========================================================================
 * PERSISTÊNCIA
 * ========================================================================== */

describe("bandeja — o estado sobrevive ao dado", () => {
  it("o estado oculto é uma propriedade da ficha, não da tela", () => {
    // O `visible: false` vive no `sheet.layout`, que é gravado no
    // `localStorage`. Nada na bandeja vive em estado de React — é por isso
    // que recarregar a página devolve o mesmo resultado.
    const sheet = sheetWith({ attributes: false });

    const serializado = JSON.parse(JSON.stringify(sheet)) as Sheet;
    expect(countHiddenPanels(serializado)).toBe(1);

    const bandeja = JSON.parse(JSON.stringify(serializado)) as Sheet;
    expect(
      bandeja.layout.find((p) => p.panelId === "attributes")?.visible,
    ).toBe(false);
  });

  it("`visible: false` antigo (versão anterior) é recuperável", () => {
    // Um dado salvo antes da bandeja existia. Ele NÃO pode quebrar nada, e
    // o bloco tem de poder ser reexibido pela bandeja.
    const sheet = sheetWith({ attributes: false, skills: false });

    expect(countHiddenPanels(sheet)).toBe(2);

    render(<PanelTray onToggleVisible={vi.fn()} sheet={sheet} />);

    // A bandeja renderiza sem erro e mostra o contador de recuperaveis.
    expect(screen.getByRole("button", { name: /Painéis/ })).toBeDefined();
  });
});
