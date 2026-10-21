"use client";

import { Button } from "@mui/material";
import { useState } from "react";

import { AddPanelDialog } from "@/components/dialogs/AddPanelDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { EyeOffIcon, PencilIcon, PlusIcon } from "@/components/ui/icons";
import { EDIT_MODE_TOOLBAR_HEIGHT_PX } from "@/config/constants";
import type { PanelType } from "@/config/panelTypes";
import type { Sheet } from "@/schemas";

import { PanelTray } from "./PanelTray";

interface EditModeToolbarProps {
  editMode: boolean;
  onToggle: () => void;
  onAddPanel: (type: PanelType) => void;
  onResetLayout: () => void;
  onToggleVisible: (panelId: string, nextVisible: boolean) => void;
  extraPanelCount: number;
  /** Abre a bandeja de blocos a partir do chip de ocultos. */
  onShowHidden: () => void;
  /** Quantos blocos estão ocultos ( selo do botão). */
  hiddenCount: number;
  /** A ficha aberta — a bandeja lista os blocos dela. */
  sheet: Sheet | null;
}

/**
 * Barra do Editar Geral (seção 9).
 *
 * Fica ACIMA de tudo, como pede a especificação. A altura mínima é
 * `EDIT_MODE_TOOLBAR_HEIGHT_PX`; a barra é `sticky`, então o botão continua
 * visível ao rolar uma ficha com muitos blocos.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O RESETAR MANTÉM O CONTEÚDO
 * Resetar devolve tamanho, posição, ordem e visibilidade ao padrão, mas não
 * apaga atributos, inventário ou o texto dos blocos. Perder conteúdo ao
 * reorganizar a tela seria uma surpresa muito cara — o usuário teria de
 * desfazer na mão o que ele só queria era arrumar a posição.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function EditModeToolbar({
  editMode,
  onToggle,
  onAddPanel,
  onResetLayout,
  onToggleVisible,
  onShowHidden,
  extraPanelCount,
  hiddenCount,
  sheet,
}: EditModeToolbarProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      {/* Faixa de couro com um leve chanfro: a barra se lê como "menu de
          mesa", não como uma fileira de botões soltos. */}
      <div
        className="border-frame bg-surface-sunken/95 sticky top-0 z-40 flex items-center gap-2 border-b px-2 py-2 shadow-[inset_0_-1px_0_rgb(0_0_0/0.5),0_8px_20px_-14px_rgb(0_0_0/0.9)] backdrop-blur-sm"
        style={{ minHeight: EDIT_MODE_TOOLBAR_HEIGHT_PX }}
      >
        <Button
          aria-pressed={editMode}
          startIcon={<PencilIcon className="text-lg" />}
          
          color={editMode ? "primary" : "inherit"}
          variant={editMode ? "contained" : "outlined"}
          onClick={onToggle}
        >
          {editMode ? "Concluir edição" : "Editar"}
        </Button>

        {/* Selo de "modo edição ativo". O usuário nunca deve ficar em dúvida
            de que está editando — errar isso custa dados perdidos. */}
        {editMode ? (
          <span
            role="status"
            className="border-accent text-accent flex items-center gap-1.5  border px-2 py-2 text-[12px] tracking-[0.16em] uppercase "
          >
            <span
              aria-hidden="true"
              className="bg-accent size-1.5 rounded-full ]"
            />
            Modo edição
          </span>
        ) : null}

        {editMode ? (
          <>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="small"
                color="inherit"
                startIcon={<PlusIcon/>}
                variant="outlined"
                onClick={() => setAddOpen(true)}
              >
                Adicionar bloco
              </Button>
              <Button
                size="small"
                color="primary"
                variant="text"
                onClick={() => setResetOpen(true)}
              >
                Resetar layout
              </Button>
            </div>
          </>
        ) : (
          <span className="text-text-muted hidden text-xs lg:inline">
            Editar libera redimensionar, mover, esconder e adicionar blocos.
          </span>
        )}

        {/*
          A BANDEJA fica ACIMA do `ml-auto`, e é sempre acessível — dentro ou
          fora do Editar Geral.

          ───────────────────────────────────────────────────────────────────
          POR QUE O CHIP DE OCULTOS EXISTE
          Se a única forma de recuperar um bloco escondido fosse abrir o
          Editar Geral, o usuário teria de entrar num modo que ele não pediu
          só para desfazer um clique. O chip resolve isso sem sair de onde
          ele está: aparece só quando há algo oculto, some sozinho quando não
          há, e nunca esconde o botão do Editar Geral — que precisa estar
          clicável o tempo todo, ou o estado é um beco sem saída.
          ───────────────────────────────────────────────────────────────────
        */}
        {hiddenCount > 0 && !editMode ? (
          <span
            role="status"
            className="border-accent text-accent flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase shadow-[0_0_14px_-6px_var(--glow)]"
          >
            <EyeOffIcon />
            {hiddenCount}{" "}
            {hiddenCount === 1 ? "bloco oculto" : "blocos ocultos"}
            <span aria-hidden="true">—</span>
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={onShowHidden}
            >
              Mostrar
            </button>
          </span>
        ) : null}

        {sheet ? (
          <div className={editMode || hiddenCount > 0 ? "" : "ml-auto"}>
            <PanelTray sheet={sheet} onToggleVisible={onToggleVisible} />
          </div>
        ) : null}
      </div>

      <AddPanelDialog
        currentCount={extraPanelCount}
        open={addOpen}
        onAdd={(type) => {
          onAddPanel(type);
          setAddOpen(false);
        }}
        onClose={() => setAddOpen(false)}
      />

      <ConfirmDialog
        confirmLabel="Resetar"
        message="Todos os blocos voltam ao tamanho e à posição originais, e os escondidos reaparecem. O conteúdo de cada bloco é mantido."
        open={resetOpen}
        title="Resetar layout?"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          onResetLayout();
        }}
      />
    </>
  );
}
