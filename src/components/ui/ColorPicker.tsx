"use client";

import { RARITY_PRESETS } from "@/config/constants";

/**
 * Seletor de cor de uma linha, com **presets de raridade primeiro** e cor
 * livre depois.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE RARIDADE E NÃO SÓ COR LIVRE
 * Um seletor só com cores livres obriga o usuário a decorar o hexadecimal da
 * cor que ele quer. Com presets nomeados, a cor escolhida vira uma
 * convenção compartilhável ("tudo laranja é meu equipamento bom") — e o app
 * continua oferecendo cor livre para quem quiser sair dela.
 *
 * Usado por: Atributos, Perícias, Itens do inventário e linhas de lista.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ACESSIBILIDADE
 * Raridade NUNCA é comunicada só pela cor: cada preset tem `aria-label` com o
 * nome da raridade, `title` para o mouse e `aria-pressed` quando selecionado.
 * Quem não distingue as cores continua lendo nome, valor e quantidade.
 */
export interface ColorPickerProps {
  /** Cor atual (`null` = sem cor). */
  value: string | null;
  onChange: (next: string | null) => void;
  /** Rótulo do grupo, lido por leitor de tela. */
  label: string;
  /** Rótulo do campo de cor livre. */
  customLabel: string;
  className?: string;
}

export function ColorPicker({
  value,
  onChange,
  label,
  customLabel,
  className = "",
}: ColorPickerProps) {
  return (
    <>
      <div
        aria-label={label}
        className={`flex shrink-0 items-center gap-0.5 ${className}`}
        role="group"
      >
        {RARITY_PRESETS.map((preset) => {
          const selected = value === preset.color;
          return (
            <button
              key={preset.id}
              type="button"
              aria-label={`${label}: ${preset.label}`}
              aria-pressed={selected}
              className={`size-3.5 rounded-full border transition-transform hover:scale-110 ${
                selected
                  ? "border-text shadow-[0_0_8px_-2px_var(--glow)]"
                  : "border-frame/60"
              }`}
              style={{ background: preset.color }}
              title={preset.label}
              onClick={() => onChange(selected ? null : preset.color)}
            />
          );
        })}
      </div>

      <input
        type="color"
        aria-label={customLabel}
        className="border-frame size-5 shrink-0 cursor-pointer rounded border bg-transparent p-0"
        value={value ?? "#000000"}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  );
}

/** Nome legível de uma cor de raridade (`null` se não for preset). */
export function colorLabelFor(color: string | null): string | null {
  if (!color) return null;
  return RARITY_PRESETS.find((preset) => preset.color === color)?.label ?? null;
}

/** Glifo do preset que casa com a cor. */
export function colorGlyphFor(color: string | null): string | null {
  if (!color) return null;
  return (
    RARITY_PRESETS.find((preset) => preset.color === color)?.symbol ?? null
  );
}
