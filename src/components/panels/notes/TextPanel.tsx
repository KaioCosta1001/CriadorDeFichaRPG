"use client";

import { TEXT_BLOCK_MAX_LENGTH } from "@/config/constants";
import { useDraftValue } from "@/hooks/useDraftValue";

import type { PanelProps } from "../registry";

/**
 * Bloco de texto livre (seção 9.5, "Bloco de texto").
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SEGURANÇA (seção 6)
 *  - NUNCA `dangerouslySetInnerHTML`. É um `<textarea>`, cujo valor é
 *    TEXTO PURO — o React escapa tudo por padrão, e não há caminho neste
 *    componente que transforme texto em HTML.
 *  - O limite de tamanho vale na entrada do usuário (`maxLength`) E na
 *    validação do schema, para dados vindos de fora também respeitarem.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ───────────────────────────────────────────────────────────────────────────
 * RASCUNHO LOCAL (`useDraftValue`)
 * Grava no blur, não a cada tecla. Motivo em `useDraftValue`: o `trim()` do
 * schema, rodando a cada tecla, apagava os espaços entre palavras.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function TextPanel({ context, extra }: PanelProps) {
  const commit = (next: string) => {
    const panelId = extra?.id;
    if (!panelId) return;
    context.mutate((current) => ({
      ...current,
      extraPanels: current.extraPanels.map((panel) =>
        panel.id === panelId ? { ...panel, content: next } : panel,
      ),
    }));
  };

  const { draft, setDraft, save } = useDraftValue(extra?.content ?? "", commit);

  return (
    <div className="h-full overflow-hidden p-2">
      <textarea
        aria-label={`Conteúdo do bloco ${extra?.title ?? "de notas"}`}
        className="border-frame bg-surface focus:border-accent placeholder:text-text-muted h-full w-full resize-none rounded-[var(--radius-sm)] border p-3 text-sm leading-relaxed outline-none"
        maxLength={TEXT_BLOCK_MAX_LENGTH}
        placeholder="Escreva suas notas aqui…"
        value={draft}
        onBlur={save}
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  );
}
