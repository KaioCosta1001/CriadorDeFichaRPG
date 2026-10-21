import { describe, expect, it } from "vitest";

import {
  PHOTO_MAX_DIMENSION_PX,
  PHOTO_MAX_INPUT_BYTES,
  detectOrbRole,
  ORB_COLORS,
} from "@/config/constants";

import {
  ImageProcessingError,
  assertAcceptableImage,
  fitWithin,
} from "./image";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  FOTO DE PERFIL — VALIDAÇÃO E PROPORÇÃO                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O jsdom não tem canvas, então a compressão em si não é testável aqui. O que
 * É testável — e é o que protege o usuário — é a barreira ANTES do canvas:
 * tipo, tamanho e dimensões. É exatamente o caminho de um arquivo hostil ou
 * simplesmente errado.
 */

function fileOf(type: string, sizeBytes: number, name = "foto.jpg"): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

describe("assertAcceptableImage", () => {
  it("aceita os formatos permitidos", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(() => assertAcceptableImage(fileOf(type, 1024))).not.toThrow();
    }
  });

  it("recusa formato não permitido — SVG e HTML Included", () => {
    // SVG e HTML podem carregar script; nunca devem entrar.
    for (const type of ["image/svg+xml", "text/html", "application/pdf"]) {
      expect(() => assertAcceptableImage(fileOf(type, 1024))).toThrow(
        ImageProcessingError,
      );
    }
  });

  it("a mensagem de formato recusado é em pt-BR", () => {
    expect(() => assertAcceptableImage(fileOf("image/gif", 1024))).toThrow(
      /não suportado/i,
    );
  });

  it("recusa arquivo acima do limite de tamanho", () => {
    expect(() =>
      assertAcceptableImage(fileOf("image/jpeg", PHOTO_MAX_INPUT_BYTES + 1)),
    ).toThrow(/muito grande/i);
  });

  it("aceita arquivo exatamente no limite", () => {
    expect(() =>
      assertAcceptableImage(fileOf("image/jpeg", PHOTO_MAX_INPUT_BYTES)),
    ).not.toThrow();
  });

  it("recusa arquivo vazio", () => {
    expect(() => assertAcceptableImage(fileOf("image/jpeg", 0))).toThrow(
      /vazio/i,
    );
  });
});

describe("fitWithin", () => {
  it("não altera imagem que já cabe no limite", () => {
    expect(fitWithin(200, 150)).toEqual({ width: 200, height: 150 });
  });

  it("reduz pela LARGURA quando a imagem é horizontal", () => {
    const result = fitWithin(2048, 1024);
    expect(result.width).toBe(PHOTO_MAX_DIMENSION_PX);
    expect(result.height).toBe(PHOTO_MAX_DIMENSION_PX / 2);
  });

  it("reduz pela ALTURA quando a imagem é vertical", () => {
    const result = fitWithin(1024, 2048);
    expect(result.height).toBe(PHOTO_MAX_DIMENSION_PX);
    expect(result.width).toBe(PHOTO_MAX_DIMENSION_PX / 2);
  });

  it("preserva a proporção (o retrato não pode esticar)", () => {
    const result = fitWithin(3000, 1000);
    const originalRatio = 3000 / 1000;
    const newRatio = result.width / result.height;
    // Tolerância de 1 casa decimal: as dimensões finais são inteiras, então
    // existe arredondamento inevitável (1000/3000 daria 170.67 px).
    expect(newRatio).toBeCloseTo(originalRatio, 1);
  });

  it("só desvia por arredondamento de inteiro", () => {
    const result = fitWithin(3000, 1000);
    expect(
      Math.abs(result.width * (1000 / 3000) - result.height),
    ).toBeLessThanOrEqual(1);
  });

  it("nunca devolve dimensão zero (canvas 0×0 quebraria)", () => {
    const result = fitWithin(10000, 1);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it("recusa dimensões inválidas em vez de devolver NaN", () => {
    expect(() => fitWithin(0, 100)).toThrow(ImageProcessingError);
    expect(() => fitWithin(100, -1)).toThrow(ImageProcessingError);
  });
});

describe("detectOrbRole", () => {
  it("reconhece PV e Vida como orbe de vida", () => {
    expect(detectOrbRole("PV")).toBe("life");
    expect(detectOrbRole("vida")).toBe("life");
    expect(detectOrbRole("Pontos de Vida")).toBe("life");
  });

  it("reconhece Sanidade e Foco como orbe mental", () => {
    expect(detectOrbRole("Sanidade")).toBe("mind");
    expect(detectOrbRole("Foco")).toBe("mind");
  });

  it("reconhece CA como orbe de armadura", () => {
    expect(detectOrbRole("CA")).toBe("armor");
    expect(detectOrbRole("Armadura")).toBe("armor");
  });

  it("usa detecção por palavra-chave em rótulos mais longos", () => {
    expect(detectOrbRole("PV do Dragão")).toBe("life");
    expect(detectOrbRole("Sanidade restante")).toBe("mind");
  });

  it("não confunde rótulos parecidos", () => {
    // "CASCOS" contém "ca" como substring, mas não é classe de armadura.
    expect(detectOrbRole("Cascos")).toBe("generic");
  });

  it("cai no genérico quando não reconhece nada", () => {
    expect(detectOrbRole("")).toBe("generic");
    expect(detectOrbRole("Humor")).toBe("generic");
  });

  it("cada papel tem cor e brilho distintos", () => {
    const fills = new Set(Object.values(ORB_COLORS).map((c) => c.fill));
    expect(fills.size).toBe(Object.keys(ORB_COLORS).length);
  });
});
