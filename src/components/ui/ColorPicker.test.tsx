import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RARITY_PRESETS } from "@/config/constants";

import { ColorPicker, colorGlyphFor, colorLabelFor } from "./ColorPicker";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SELETOR DE COR / RARIDADE                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Este componente é usado por Perícias, Atributos, Armas e Itens. O teste do
 * **alternar** (clicar no preset já escolhido desliga a cor) mora AQUI, e não
 * nos painéis.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE AQUI E NÃO NO PAINEL
 * A versão no painel era o 36º teste do arquivo, depois de meia dúzia de
 * outros que montam o inventário inteiro com dezenas de botões e tooltips do
 * MUI. Sob essa carga, o segundo clique às vezes não era registrado — o
 * teste passava sozinho e falhava na suíte completa, que é a pior forma de
 * existir.
 *
 * Aqui o componente é renderizado sozinho, sem Tooltip, sem grade e sem dnd-kit.
 * O mesmo comportamento, sem a fila.
 * ───────────────────────────────────────────────────────────────────────────
 */

function setup(value: string | null = null) {
  const onChange = vi.fn();
  render(
    <ColorPicker
      customLabel="Cor personalizada de Força"
      label="Raridade de Força"
      onChange={onChange}
      value={value}
    />,
  );
  return { onChange };
}

describe("ColorPicker — estrutura", () => {
  it("mostra um preset por raridade", () => {
    setup();

    const grupo = screen.getByRole("group", { name: "Raridade de Força" });
    expect(within(grupo).getAllByRole("button")).toHaveLength(
      RARITY_PRESETS.length,
    );
  });

  it("cada preset é nomeado pela RARIDADE, não pela cor", () => {
    setup();

    // Raridade nunca é comunicada só pela cor: quem não distingue vermelho de
    // dourado precisa ler o nome.
    for (const preset of RARITY_PRESETS) {
      expect(
        screen.getByRole("button", {
          name: `Raridade de Força: ${preset.label}`,
        }),
      ).toBeDefined();
    }
  });

  it("oferece também cor livre", () => {
    setup();

    expect(screen.getByLabelText("Cor personalizada de Força")).toBeDefined();
  });
});

describe("ColorPicker — alternar", () => {
  it("clicar num preset devolve a cor dele", () => {
    const { onChange } = setup();
    const preset = RARITY_PRESETS[2];

    fireEvent.click(
      screen.getByRole("button", {
        name: `Raridade de Força: ${preset.label}`,
      }),
    );

    expect(onChange).toHaveBeenCalledWith(preset.color);
  });

  it("clicar no preset JÁ SELECIONADO devolve null — desliga a cor", () => {
    const preset = RARITY_PRESETS[0];
    const { onChange } = setup(preset.color);

    fireEvent.click(
      screen.getByRole("button", {
        name: `Raridade de Força: ${preset.label}`,
      }),
    );

    // Sem isto, nao haveria como tirar a cor de uma linha ja definida.
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("clicar num preset DIFERENTE troca, e não acumula", () => {
    const antes = RARITY_PRESETS[0];
    const depois = RARITY_PRESETS[3];
    const { onChange } = setup(antes.color);

    fireEvent.click(
      screen.getByRole("button", {
        name: `Raridade de Força: ${depois.label}`,
      }),
    );

    expect(onChange).toHaveBeenCalledWith(depois.color);
  });

  it("a cor livre sempre devolve o valor escolhido", () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText("Cor personalizada de Força"), {
      target: { value: "#123456" },
    });

    expect(onChange).toHaveBeenCalledWith("#123456");
  });
});

describe("ColorPicker — estado acessível", () => {
  it("o preset ativo é o único com aria-pressed=true", async () => {
    const preset = RARITY_PRESETS[2];
    setup(preset.color);

    for (const candidate of RARITY_PRESETS) {
      const button = screen.getByRole("button", {
        name: `Raridade de Força: ${candidate.label}`,
      });
      const esperado = candidate.id === preset.id ? "true" : "false";
      expect(button.getAttribute("aria-pressed")).toBe(esperado);
    }
  });

  it("sem cor, nenhum preset está pressionado", () => {
    setup(null);

    for (const candidate of RARITY_PRESETS) {
      expect(
        screen
          .getByRole("button", {
            name: `Raridade de Força: ${candidate.label}`,
          })
          .getAttribute("aria-pressed"),
      ).toBe("false");
    }
  });

  it("o preset também tem title, para o mouse", () => {
    const preset = RARITY_PRESETS[1];
    setup();

    expect(
      screen.getByRole("button", {
        name: `Raridade de Força: ${preset.label}`,
      }),
    ).toHaveAttribute("title", preset.label);
  });
});

describe("colorLabelFor / colorGlyphFor", () => {
  it("traduz um preset para o nome legível", () => {
    const preset = RARITY_PRESETS[2];
    expect(colorLabelFor(preset.color)).toBe(preset.label);
  });

  it("devolve o glifo do preset", () => {
    const preset = RARITY_PRESETS[2];
    expect(colorGlyphFor(preset.color)).toBe(preset.symbol);
  });

  it("devolve null para cor LIVRE — não há raridade para ela", () => {
    // A cor que o usuário inventou não pertence a nenhuma convenção; inventar
    // um nome seria mentir.
    expect(colorLabelFor("#123456")).toBeNull();
    expect(colorGlyphFor("#123456")).toBeNull();
  });

  it("devolve null sem cor", () => {
    expect(colorLabelFor(null)).toBeNull();
    expect(colorGlyphFor(null)).toBeNull();
  });
});
