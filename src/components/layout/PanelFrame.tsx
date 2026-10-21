"use client";

import { useDraggable } from "@dnd-kit/core";
import { useCallback, type KeyboardEvent, type ReactNode } from "react";

import {
  ResizeHandles,
  type ResizeResult,
} from "@/components/layout/ResizeHandles";
import { PanelDragHandle } from "@/components/layout/PanelDragHandle";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { RuneButton } from "@/components/ui/RuneButton";
import { EyeOffIcon, TrashIcon } from "@/components/ui/icons";
import { GRID_ROW_HEIGHT_PX, type CellSize } from "@/config/constants";
import { useMeasuredSize } from "@/hooks/useMeasuredSize";
import type { PanelType } from "@/config/panelTypes";
import type { PanelLayout } from "@/schemas";

interface PanelFrameProps {
  panelId: string;
  layout: PanelLayout;
  children: ReactNode;
  /** `true` no Editar Geral — libera arraste e redimensionamento. */
  editMode: boolean;
  /** `false` em telas estreitas: sem arraste/resize, empilhado. */
  interactive: boolean;
  /** Título exibido no cabeçalho. */
  title: string;
  /** Tipo do bloco — usado para o tamanho mínimo por tipo (§1.3). */
  panelType: PanelType | null;
  /** Blocos padrão não podem ser removidos. */
  removable: boolean;
  /** Perfil e Inventário não podem ser escondidos (ver `panelTypes.ts`). */
  hideable: boolean;
  /** Índice na ordem de leitura — controla o atraso da entrada em cascata. */
  index: number;
  /** Tamanho de uma célula do grid. */
  cell: CellSize;
  /** Altura útil da grade, em linhas — teto do redimensionamento vertical. */
  maxRows: number;
  /**
   * Ações do cabeçalho declaradas pelo tipo do bloco (adendo §2.1).
   *
   * Fica no cabeçalho porque é de lá que o usuário procura configuração — e
   * não de dentro da área de conteúdo, que rola e some.
   */
  headerActions?: ReactNode;
  onResize: (next: ResizeResult) => void;
  onMove: (next: { x: number; y: number }) => void;
  onToggleVisible: () => void;
  onRemove: () => void;
}

/**
 * Moldura de um painel: cabeçalho, arraste e alças de redimensionamento.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ARRASTE POR @dnd-kit (§10)
 *
 * Escolhemos o dnd-kit porque ele entrega de graça o que a especificação
 * exige e que é caro de fazer à mão: sensor de TECLADO com anúncios ARIA
 * ("item movido para a posição 2 de 5"), sensor de TOQUE com atraso, e
 * overlay de arrasto sem precisar de portal.
 *
 * No modo de arraste, o painel segue o cursor via `transform`; o layout em
 * `sheet` só é gravado no `onDragEnd` do `PanelGrid`, já com o snap de célula.
 * Assim não dispara uma escrita no storage a cada movimento.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O ARRASTE SÓ NO HANDLE, E POR QUE O CLIQUE NÃO É INTERCEPTADO
 *
 * Os `listeners` ficam no `<button>` do handle, e em NENHUM outro lugar do
 * painel. Se estivessem no painel inteiro, clicar num campo para editar o
 * nome de um atributo seria lido como o começo de um arraste.
 *
 * `onKeyDown` no handle cobre um caso específico: o sensor de teclado do
 * `@dnd-kit` anda o bloco uma célula por aperto, o que torna inviável cruzar
 * doze colunas. Com Shift, o passo é de dez. Ver `handleKeyDown` abaixo.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `touch-action: none` NO HANDLE
 *
 * Sem isso, o celular interpreta o arrasto como rolagem da página — o bloco
 * fica para trás do dedo e nada acontece. É o mesmo motivo das alças.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function PanelFrame({
  panelId,
  layout,
  children,
  editMode,
  interactive,
  title,
  panelType,
  removable,
  hideable,
  index,
  cell,
  maxRows,
  headerActions,
  onResize,
  onMove,
  onToggleVisible,
  onRemove,
}: PanelFrameProps) {
  const draggable = editMode && interactive;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: panelId,
      disabled: !draggable,
    });

  /**
   * O TAMANHO REAL, MEDIDO — não calculado (adendo §2.4)
   *
   * O indicador tem que bater com o bounding box que o usuário vê. Calcular
   * "célula × w" repetiria a conta do grid e mentiria igual: no dia em que
   * o conteúdo esticasse o painel, o estado continuaria dizendo "12×12" e a
   * tela mostraria um retângulo.
   *
   * A medição é feita no MESMO nó que o dnd-kit usa como arrastável — que,
   * com `h-full`, ocupa exatamente a célula.
   */
  const { ref: measureRef, size: measured } = useMeasuredSize();

  // O dnd-kit registra o nó arrastável; a medição precisa do MESMO elemento.
  const attachNode = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      measureRef(node);
    },
    [setNodeRef, measureRef],
  );

  /**
   * Setas movem o bloco em CÉLULAS.
   *
   * O sensor de teclado do `@dnd-kit` já anda o bloco e anuncia a posição, e
   * esse é o caminho preferido. Este handler existe para o passo LARGO (Shift):
   * o dnd-kit anda sempre uma célula, e mover doze colunas com doze apertadas
   * seria impraticável para quem precisa ir longe.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.shiftKey) return;

    const step = 10;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -step;
    else if (event.key === "ArrowRight") dx = step;
    else if (event.key === "ArrowUp") dy = -step;
    else if (event.key === "ArrowDown") dy = step;
    else return;

    event.preventDefault();
    onMove({ x: layout.x + dx, y: layout.y + dy });
  }

  return (
    <div
      ref={attachNode}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        zIndex: isDragging ? 30 : undefined,
      }}
      // `h-full` + `min-h-0`: a moldura ocupa EXATAMENTE a célula do grid.
      // Sem isso, `flex-1` não fazia nada (o pai posicionado não é flex) e
      // a moldura ficava com a altura do CONTEÚDO — pintando fora da grade
      // e ampliando a área clicável do bloco.
      className="relative flex h-full min-h-0 flex-1 flex-col"
    >
      <Panel
        editing={draggable}
        index={index}
        label={title}
        lifted={isDragging}
      >
        <PanelHeader
          actions={
            <>
              {/* Ações do tipo do bloco PRIMEIRO: são as que o jogador usa,
                  e no modo Editar Geral o olho vai do título para a direita. */}
              {headerActions}

              {editMode && hideable ? (
                <>
                  <RuneButton
                    label={`Esconder bloco ${title}`}
                    onClick={onToggleVisible}
                  >
                    <EyeOffIcon />
                  </RuneButton>

                  {removable ? (
                    <RuneButton
                      label={`Remover bloco ${title}`}
                      tone="danger"
                      onClick={onRemove}
                    >
                      <TrashIcon />
                    </RuneButton>
                  ) : (
                    <span className="label-caps px-1 opacity-50">padrão</span>
                  )}
                </>
              ) : null}
            </>
          }
          handle={
            draggable ? (
              <PanelDragHandle
                label={`Mover bloco ${title}`}
                title="Arraste para reposicionar (ou use as setas do teclado; Shift para andar dez células)"
                onKeyDown={handleKeyDown}
                {...attributes}
                {...listeners}
              />
            ) : null
          }
          title={title}
        />

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

        {/* As alças ficam DENTRO do painel: assim acompanham o contorno
            tracejado e o chanfro em vez de flutuar fora dele. */}
        {draggable ? (
          <ResizeHandles
            cell={cell}
            maxRows={maxRows}
            panelType={panelType}
            position={{ x: layout.x, y: layout.y }}
            size={{ w: layout.w, h: layout.h }}
            onResize={onResize}
          />
        ) : null}
      </Panel>

      {/* TAMANHO REAL — PIXELS MEDIDOS + CÉLULAS (adendo §2.4)
       *
       * O formato é "192px × 192px (12 × 12)": os pixels dizem o tamanho que o
       * usuário VEJA, e as células dizem onde o bloco está na grade. Mostrar só
       * as células não permitia ao usuário conferir se o que ele vê bate — e foi
       * justamente a divergência entre as duas leituras que produziu o sintoma
       * "o tamanho mostrado não é o tamanho real".
       *
       * Os pixels vêm do `getBoundingClientRect()` do elemento real (ver
       * `useMeasuredSize`), não de uma conta sobre o estado — por isso batem
       * com a caixa desenhada dentro de 1px.
       */}
      {draggable ? (
        <output
          aria-hidden="true"
          data-size-indicator=""
          className="border-frame/60 bg-surface-sunken text-text-muted pointer-events-none absolute right-1 -bottom-5 z-20 rounded-[var(--radius-sm)] border px-1 font-mono text-[10px] tabular-nums"
        >
          {measured
            ? `${measured.width}px × ${measured.height}px (${layout.w} × ${layout.h})`
            : `${layout.w} × ${layout.h}`}
        </output>
      ) : null}
    </div>
  );
}

/** Reexportado para os testes e para quem só quer a altura de uma linha. */
export const ROW_HEIGHT_PX = GRID_ROW_HEIGHT_PX;
