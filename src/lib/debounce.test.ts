import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDebouncedTask } from "./debounce";

describe("createDebouncedTask", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não executa antes do tempo", () => {
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 100);

    debounced.schedule();
    vi.advanceTimersByTime(99);

    expect(task).not.toHaveBeenCalled();
  });

  it("executa depois do tempo", () => {
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 100);

    debounced.schedule();
    vi.advanceTimersByTime(100);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("agrupa chamadas repetidas em UMA execução", () => {
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 100);

    // Simula digitar: 10 chamadas em 90 ms.
    for (let i = 0; i < 10; i += 1) {
      debounced.schedule();
      vi.advanceTimersByTime(9);
    }
    vi.advanceTimersByTime(100);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("executa imediatamente com flush, se havia algo pendente", () => {
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 100);

    debounced.schedule();
    expect(debounced.flush()).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);

    // O temporizador não pode disparar depois do flush.
    vi.advanceTimersByTime(1000);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("flush sem nada pendente não executa nada", () => {
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 100);

    expect(debounced.flush()).toBe(false);
    expect(task).not.toHaveBeenCalled();
  });

  it("cancel descarta o que estava pendente", () => {
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 100);

    debounced.schedule();
    debounced.cancel();
    vi.advanceTimersByTime(1000);

    expect(task).not.toHaveBeenCalled();
    expect(debounced.pending()).toBe(false);
  });

  it("informa se há execução pendente", () => {
    const debounced = createDebouncedTask(vi.fn(), 100);
    expect(debounced.pending()).toBe(false);

    debounced.schedule();
    expect(debounced.pending()).toBe(true);

    debounced.cancel();
    expect(debounced.pending()).toBe(false);
  });
});
