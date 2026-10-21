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
  DND_ACTIVATION_DISTANCE_PX,
  MAX_SKILLS,
  SKILL_CHIP_GAP_PX,
} from "@/config/constants";
import { generateId } from "@/lib/id";
import type { Skill } from "@/schemas";

import { SkillCard } from "./SkillCard";
import type { PanelProps } from "../registry";

/**
 * Bloco de Perícias (seção 8.5).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A §8.5 DIZ "COMUNICAÇÃO APENAS COM ATRIBUTOS"
 * É a regra mais importante do bloco: perícia não sabe nada de arma, item,
 * dinheiro ou painel de resultado. Ela conhece `Sheet.attributes` e o sistema,
 * e nada mais. Por isso o cálculo mora em `domain/rolls`, que recebe só
 * esses dois insumos — mudar o mundo ao redor não muda a aritmética.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O VÍNCULO FIXO COM ATRIBUTO SAIU DAQUI
 * O adendo de rolagem trocou "atributo escolhido uma vez, no modo editar"
 * por "atributo escolhido no menu, a cada rolagem". Este painel perdeu o
 * `<select>` e o aviso de vínculo órfão — os dois existiam só por causa do
 * vínculo fixo, e um vínculo que não existe não tem órfão.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * AS DUAS PORTAS DE EDIÇÃO (mesma leitura do bloco de Atributos)
 * Lápis do bloco → cor e exclusão.
 * Editar Geral   → o "+" e o arraste, porque a quantidade de perícias é
 * informação sensível.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A REGRA DO SISTEMA APARECE AQUI, E NÃO NO MENU
 * `attributeRuleDescription` é o texto que o sistema publica sobre a própria
 * regra ("o atributo entra como modificador: (valor - 10) ÷ 2"). Ele muda por
 * sistema (ponto em aberto 14.1), então mostrar a frase uma vez, no topo do
 * bloco, evita que o jogador descubra a regra errada lendo três resultados.
 */
export function SkillsPanel({ context }: PanelProps) {
  const [blockEdit, setBlockEdit] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DND_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { sheet, system } = context;
  const skills = sheet.skills;
  const atLimit = skills.length >= MAX_SKILLS;

  function patch(skillId: string, change: Partial<Skill>) {
    context.mutate((current) => ({
      ...current,
      skills: current.skills.map((skill) =>
        skill.id === skillId ? { ...skill, ...change } : skill,
      ),
    }));
  }

  function addSkill() {
    if (atLimit) return;
    // Nome vazio de propósito: uma perícia nova NÃO tem nome adivinhado, e o
    // clique duplo abre o campo para o usuário escrever. (O atributo saí de
    // aqui junto com o vínculo fixo — ver `SkillsRollMenu`.)
    const skill: Skill = { id: generateId(), name: "", value: 0, color: null };

    context.mutate((current) => ({
      ...current,
      skills: [...current.skills, skill],
    }));
  }

  function removeSkill(skillId: string) {
    context.mutate((current) => ({
      ...current,
      skills: current.skills.filter((skill) => skill.id !== skillId),
    }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = skills.findIndex((skill) => skill.id === active.id);
    const to = skills.findIndex((skill) => skill.id === over.id);
    if (from === -1 || to === -1) return;

    context.mutate((current) => ({
      ...current,
      skills: arrayMove(current.skills, from, to),
    }));
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-text-muted min-w-0 flex-1 truncate text-xs">
          {skills.length} de {MAX_SKILLS} perícias
        </span>

        <RuneButton
          aria-pressed={blockEdit}
          label={blockEdit ? "Concluir edição do bloco" : "Editar bloco"}
          onClick={() => setBlockEdit((value) => !value)}
        >
          <PencilIcon />
        </RuneButton>
      </div>

      {/* A regra do sistema, exposta uma vez. O usuário não deveria precisar
          descobrir que "Força 16 vira +3" — e a regra muda por sistema
          (ponto em aberto 14.1), então ela vem do próprio sistema. */}
      {system ? (
        <p className="text-text-muted border-border mb-2 border-l-2 pl-2 text-[10px] leading-relaxed">
          <span className="text-text-secondary">{system.label}:</span>{" "}
          {system.attributeRuleDescription}
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={skills.map((skill) => skill.id)}
          // `rectSortingStrategy`, e não a vertical.
          //
          // Os blocos estão em `flex-wrap`: não há "linha 3", há "o bloco que
          // vem depois do quinto na ordem do DOM". A estratégia vertical
          // calcula a troca comparando CENTROS em Y, e num fluxo que quebra
          // linha isso reposiciona o bloco errado — trocar "Furtividade" por
          // "Acrobacia" porque estão na mesma altura em linhas diferentes.
          //
          // A retangular compara o retângulo inteiro, que é o que o fluxo em
          // blocos realmente produz.
          strategy={rectSortingStrategy}
        >
          {/* `flex-wrap`: é o que o §4 pede — blocos lado a lado com quebra
              de linha, em vez de uma coluna. */}
          <ul
            className="flex min-h-0 flex-1 flex-wrap content-start overflow-y-auto pr-1"
            style={{ gap: SKILL_CHIP_GAP_PX }}
          >
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                context={context}
                editMode={blockEdit}
                reorderMode={blockEdit}
                skill={skill}
                onChange={(change) => patch(skill.id, change)}
                onRemove={() => removeSkill(skill.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* ─────────────────────────────────────────────────────────────────
          O "+" SAI DO EDITAR GERAL E FICA NO LAPIS DO BLOCO (adendo, secao 1)

          Criar pericia e uma decisao sobre o CONTEUDO da ficha, e nao sobre
          a disposicao na tela. Criar pelo Editar Geral transformaria o modo de
          organizacao em um cadastro de dados — e a lista sumiria com um
          clique, sem o jogador ter pedido para mudar nada nela.
          ───────────────────────────────────────────────────────────────── */}
      {blockEdit ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-text-muted min-w-0 flex-1 truncate text-xs">
            {atLimit ? "Limite de perícias atingido" : ""}
          </span>
          <RuneButton
            disabled={atLimit}
            label={
              atLimit ? "Limite de perícias atingido" : "Adicionar perícia"
            }
            tone="primary"
            onClick={addSkill}
          >
            <PlusIcon />
          </RuneButton>
        </div>
      ) : null}
    </div>
  );
}
