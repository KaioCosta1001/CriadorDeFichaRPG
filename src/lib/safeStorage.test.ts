import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isQuotaExceeded,
  isStorageAvailable,
  safeGetItem,
  safeGetJson,
  safeRemoveItem,
  safeSetItem,
} from "./safeStorage";

describe("safeStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detecta que o storage existe no jsdom", () => {
    expect(isStorageAvailable()).toBe(true);
  });

  it("faz round-trip de uma chave", () => {
    expect(safeSetItem("chave", "valor")).toBe(true);
    expect(safeGetItem("chave")).toBe("valor");
    expect(safeRemoveItem("chave")).toBe(true);
    expect(safeGetItem("chave")).toBeNull();
  });

  it("devolve null em vez de explodir quando o getItem lança", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });

    expect(safeGetItem("qualquer")).toBeNull();
  });

  it("devolve false quando o setItem estoura a cota", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("cota", "QuotaExceededError");
    });

    expect(safeSetItem("chave", "valor")).toBe(false);
  });

  it("reconhece o erro de cota", () => {
    expect(
      isQuotaExceeded(new DOMException("cota", "QuotaExceededError")),
    ).toBe(true);
    expect(isQuotaExceeded(new Error("outro erro"))).toBe(false);
    expect(isQuotaExceeded("texto")).toBe(false);
  });

  it("devolve null para JSON inválido sem lançar", () => {
    safeSetItem("quebrado", "{ isto não é json");

    expect(safeGetJson("quebrado", (raw) => raw)).toBeNull();
  });

  it("entrega o valor ao validador quando o JSON é válido", () => {
    safeSetItem("valido", JSON.stringify({ nome: "Aragorn" }));

    expect(safeGetJson("valido", (raw) => raw)).toEqual({ nome: "Aragorn" });
  });
});
