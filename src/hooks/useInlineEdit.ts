"use client";

import { useCallback, useState } from "react";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  EDIÇÃO INLINE POR CLIQUE DUPLO                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Regra geral da especificação: "edição de valores acontece com clique duplo
 * nos blocos de atributo/perícia/perfil". Este hook centraliza esse
 * comportamento — ele vai ser reusado em TODOS os campos das Fases 6 e 7.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE CLIQUE DUPLO E NÃO CLIQUE SIMPLES
 * Um clique simples para editar destrói o "ver antes de mexer": para ler o
 * valor de PV ou de uma perícia, o usuário precisaria abrir e fechar cada
 * célula. O duplo clique mantém a leitura passiva e faz da edição um gesto
 * deliberado — e é o que o usuário espera de uma ficha de RPG.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O RASCUNHO É LOCAL (e não vai direto ao store)
 * O `sheetStore.mutate` valida a ficha inteira a cada tecla, e o `trim()` do
 * schema apagaria os espaços entre palavras a cada tecla. Ver o bug
 * documentado em `useDraftValue` e no README.
 * ───────────────────────────────────────────────────────────────────────────
 */
export interface InlineEdit<T> {
  /** `true` enquanto o campo está aberto para edição. */
  editing: boolean;
  /** Abre a edição. */
  start: () => void;
  /** Fecha sem gravar. */
  cancel: () => void;
  /**
   * Handler de duplo clique para o alvo visível.
   *
   * `disabled` liga para quando o campo NÃO pode ser editado naquele
   * contexto — por exemplo, o nome do personagem fora do Editar Geral. Nesse
   * caso o consumidor chama outra coisa (avisar o usuário) no lugar.
   */
  onDoubleClick: () => void;
  /** Props para espalhar no `<input>` de edição. */
  inputProps: {
    autoFocus: true;
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    onBlur: () => void;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  };
  /** Valor atual do rascunho. */
  draft: T;
  setDraft: (next: T) => void;
}

/** Opções do hook. */
export interface InlineEditOptions<T> {
  /** Valor persistido. */
  value: T;
  /** Grava o novo valor. Só é chamado quando o valor realmente mudou. */
  commit: (next: T) => void;
  /**
   * `true` quando a edição está bloqueada no contexto atual. O duplo clique
   * então chama `onBlocked` em vez de abrir o campo.
   */
  disabled?: boolean;
  /** Chamado quando o usuário tenta editar algo bloqueado. */
  onBlocked?: () => void;
}

export function useInlineEdit<T extends string>({
  value,
  commit,
  disabled = false,
  onBlocked,
}: InlineEditOptions<T>): InlineEdit<T> {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(value);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const start = useCallback(() => {
    if (disabled) {
      onBlocked?.();
      return;
    }
    setDraft(value);
    setEditing(true);
  }, [disabled, onBlocked, value]);

  const handleDoubleClick = useCallback(() => {
    if (disabled) {
      onBlocked?.();
      return;
    }
    start();
  }, [disabled, onBlocked, start]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (draft !== value) commit(draft);
        setEditing(false);
        return;
      }
      if (event.key === "Escape") {
        // Escape cancela — é a convenção universal e evita gravar por engano.
        event.preventDefault();
        cancel();
      }
    },
    [cancel, commit, draft, value],
  );

  const handleBlur = useCallback(() => {
    if (draft !== value) commit(draft);
    setEditing(false);
  }, [commit, draft, value]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      // O campo é de texto: o valor do input é sempre `string`, e `T` é
      // restringido a `string` no hook.
      setDraft(event.target.value as T);
    },
    [],
  );

  return {
    editing,
    start,
    cancel,
    onDoubleClick: handleDoubleClick,
    draft,
    setDraft,
    inputProps: {
      autoFocus: true,
      onKeyDown: handleKeyDown,
      onBlur: handleBlur,
      onChange: handleChange,
    },
  };
}
