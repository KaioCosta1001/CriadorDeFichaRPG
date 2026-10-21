"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Rascunho local para um campo de texto, com gravação por confirmação.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE (bug real encontrado na Fase 4)
 *
 * O `SheetSchema` aplica `.trim()` em todo texto, por desenho — dado salvo
 * não deve ter espaço sobrando. Mas o `sheetStore.mutate` valida a ficha
 * inteira a cada tecla. O resultado era este:
 *
 *   digita "lembrete" → grava "lembrete"
 *   digita " "        → grava "lembrete"   ← o espaço é aparado na hora
 *   digita "i"       → grava "lembretei"  ← o espaço sumiu de vez
 *
 * Digitar duas palavras virava uma. O corte é invisível numa tela curta e
 * muito desconcertante numa nota longa.
 *
 * A solução é não passar o store por CADA tecla: o campo mantém um rascunho
 * local e grava só quando o usuário confirma (blur, Enter, ou fechar o
 * bloco). O `trim()` do schema continua valendo — no momento certo.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * QUANDO O VALOR MUDA POR FORA
 * Se outra parte do app mudar o valor (resetar layout, desfazer, importar),
 * o rascunho é sincronizado. O efeito só dispara quando `value` muda de
 * verdade, então digitar não é interrompido a cada tecla.
 * ───────────────────────────────────────────────────────────────────────────
 */
export interface DraftValue {
  draft: string;
  setDraft: (next: string) => void;
  /** Grava o rascunho (se mudou) e avisa o chamador. */
  save: () => void;
  /** Volta ao último valor salvo, descartando o rascunho. */
  revert: () => void;
  isDirty: () => boolean;
}

export function useDraftValue(
  value: string,
  commit: (next: string) => void,
): DraftValue {
  const [draft, setDraftState] = useState(value);
  const saved = useRef(value);

  // Sincroniza quando o valor EXTERNO muda; nunca a cada tecla.
  useEffect(() => {
    if (value === saved.current) return;
    saved.current = value;
    setDraftState(value);
  }, [value]);

  const setDraft = useCallback((next: string) => {
    setDraftState(next);
  }, []);

  const save = useCallback(() => {
    if (draft === saved.current) return;
    saved.current = draft;
    commit(draft);
  }, [commit, draft]);

  const revert = useCallback(() => {
    setDraftState(saved.current);
  }, []);

  const isDirty = useCallback(() => draft !== saved.current, [draft]);

  return { draft, setDraft, save, revert, isDirty };
}
