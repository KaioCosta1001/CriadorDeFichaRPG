"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useState } from "react";

import { RuneButton } from "@/components/ui/RuneButton";
import { PencilIcon, PlusIcon } from "@/components/ui/icons";
import {
  ATTRIBUTE_NAME_MAX_LENGTH,
  DND_ACTIVATION_DISTANCE_PX,
  MAX_ATTRIBUTES,
} from "@/config/constants";

import { generateId } from "@/lib/id";
import type { Attribute } from "@/schemas";

import { AttributeCard } from "./AttributeCard";
import type { PanelProps } from "../registry";

/** Largura mínima de uma coluna da grade de atributos. */
export const MIN_CARD_WIDTH_PX = 96;

/**
 * Bloco de Atributos (seção 8.4).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * AS DUAS PORTAS DE EDIÇÃO, E POR QUE SÃO DUAS
 *
 * A §8.4 pede duas coisas que, lidas como uma só, se contradizem:
 *
 *   a) "Botão Editar (cabeçalho do bloco): libera mudança de cor de cada
 *       atributo e botão de exclusão";
 *   b) "A quantidade de atributos é sensível: só no Editar Geral".
 *
 * A leitura que satisfaz as duas, e é a implementada aqui:
 *
 *   - **Lápis do bloco** → cor + exclusão. É o que (a) pede, literalmente.
 *   - **Editar Geral**   → o "+" (criar) e o arraste (reordenar). É o que (b)
 *                         protege: a quantidade e a ordem dos atributos são a
 *                         estrutura da ficha, não uma decoração.
 *
 * O inverso também incomoda: se o "+" ficasse só no lápis do bloco, bastaria
 * um clique para inflar a ficha; se a exclusão ficasse só no Editar Geral,
 * apagar um atributo errado seria um caminho longo demais para um engano
 * comum — e o Editar Geral é justamente onde o usuário mexe em tudo ao mesmo
 * tempo, o pior momento para um clique acidental.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * REMOVER UM ATRIBUTO NÃO QUEBRA MAIS NADA
 * Na v1, cada perícia guardava um `attributeId` fixo e apagar o atributo
 * deixava as perícias apontando para o vazio. O adendo de rolagem removeu o
 * vínculo: o atributo é escolhido no menu, a cada rolagem. Apagar um atributo
 * é agora puramente local — nada em outra parte da ficha aponta para ele.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ARRASTE EM GRADE, NÃO EM LISTA
 * Os atributos são uma grade, então a estratégia é `rectSortingStrategy`
 * (troca em duas dimensões). `arrayMove` é o caminho canônico do dnd-kit e
 * resolve os dois eixos de uma vez.
 */
export function AttributesPanel({ context }: PanelProps) {
  /** Lápis do bloco: libera cor e exclusão. */
  const [blockEdit, setBlockEdit] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DND_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const attributes = context.sheet.attributes;
  const atLimit = attributes.length >= MAX_ATTRIBUTES;

  function patch(attributeId: string, change: Partial<Attribute>) {
    context.mutate((current) => ({
      ...current,
      attributes: current.attributes.map((attribute) =>
        attribute.id === attributeId ? { ...attribute, ...change } : attribute,
      ),
    }));
  }

  function addAttribute() {
    if (atLimit) return;
    // O nome começa preenchido ("NOVO", "NOVO 2"…). Uma caixa vazia seria
    // indistinguível de um cartão que falhou ao carregar.
    //
    // A contagem é feita sobre o prefixo, não sobre o total: se o usuário já
    // tiver 30 atributos, "NOVO 31" não diz nada. O que interessa é quantos
    // placeholders já existem.
    const existing = attributes.filter((attribute) =>
      attribute.name.startsWith("NOVO"),
    ).length;
    const name = existing === 0 ? "NOVO" : `NOVO ${existing + 1}`;

    const attribute: Attribute = {
      id: generateId(),
      name: name.slice(0, ATTRIBUTE_NAME_MAX_LENGTH),
      value: 10,
      color: null,
    };

    context.mutate((current) => ({
      ...current,
      attributes: [...current.attributes, attribute],
    }));
    setNotice(null);
  }

  function removeAttribute(attributeId: string) {
    const name = attributes.find((item) => item.id === attributeId)?.name;

    // ───────────────────────────────────────────────────────────────────────
    // NÃO HÁ MAIS VÍNCULO PARA DESFAZER
    // Na v1 do schema, cada perícia guardava um `attributeId` fixo. O adendo
    // de rolagem removeu esse campo: o atributo é escolhido no menu da
    // rolagem, a cada vez. Apagar um atributo agora é puramente local — nada
    // em outra parte da ficha aponta para ele.
    //
    // (Era `unlinkSkillsOfAttribute`, em `domain/skills`. A regra morreu com o
    // vínculo; o que sobrou está no cabeçalho daquele arquivo.)
    // ───────────────────────────────────────────────────────────────────────
    context.mutate((current) => ({
      ...current,
      attributes: current.attributes.filter(
        (attribute) => attribute.id !== attributeId,
      ),
    }));

    setNotice(`"${name || "Atributo"}" removido.`);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = attributes.findIndex((item) => item.id === active.id);
    const to = attributes.findIndex((item) => item.id === over.id);
    if (from === -1 || to === -1) return;

    context.mutate((current) => ({
      ...current,
      attributes: arrayMove(current.attributes, from, to),
    }));
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-text-muted min-w-0 flex-1 truncate text-xs">
          {attributes.length} de {MAX_ATTRIBUTES} atributos
        </span>

        {/* O lápis do bloco (§8.4) — distinto do Editar Geral. */}
        <RuneButton
          aria-pressed={blockEdit}
          label={blockEdit ? "Concluir edição do bloco" : "Editar bloco"}
          onClick={() => {
            setBlockEdit((value) => !value);
            setNotice(null);
          }}
        >
          <PencilIcon />
        </RuneButton>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={attributes.map((attribute) => attribute.id)}
          strategy={rectSortingStrategy}
        >
          <div
            className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_CARD_WIDTH_PX}px, 1fr))`,
            }}
          >
            {attributes.map((attribute) => (
              <AttributeCard
                key={attribute.id}
                attribute={attribute}
                context={context}
                editMode={blockEdit}
                reorderMode={blockEdit}
                onChange={(change) => patch(attribute.id, change)}
                onRemove={() => removeAttribute(attribute.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ─────────────────────────────────────────────────────────────────
          O "+" SAI DO EDITAR GERAL E FICA NO LAPIS DO BLOCO (adendo, secao 1)

          Criar atributo e uma decisao sobre o CONTEUDO da ficha — quantos
          atributos o personagem tem — e nao sobre a disposicao na tela. O
          Editar Geral reorganiza; este lapis cria.

          Fora do lapis a grade fica limpa: so as caixas, sem um botao
          flutuando embaixo de uma lista que o jogador talvez nem esteja
          lendo.
          ───────────────────────────────────────────────────────────────── */}
      {blockEdit ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-text-muted min-w-0 flex-1 truncate text-xs">
            {atLimit ? "Limite de atributos atingido" : ""}
          </span>
          <RuneButton
            disabled={atLimit}
            label={
              atLimit ? "Limite de atributos atingido" : "Adicionar atributo"
            }
            tone="primary"
            onClick={addAttribute}
          >
            <PlusIcon />
          </RuneButton>
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="text-accent mt-1 text-xs">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
