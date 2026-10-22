"use client";

import { useState } from "react";

import { RollContextMenu } from "@/components/ui/RollContextMenu";
import {
  pushRoll,
  rollSkillDry,
  rollSkillWithAttribute,
  type RollableSkill,
} from "@/domain/rolls";
import type { ContextMenuTrigger } from "@/hooks/useContextMenuTrigger";
import type { Attribute, RollRecord } from "@/schemas";

import type { PanelContext } from "../registry";

interface SkillsRollMenuProps {
  context: PanelContext;
  skill: RollableSkill;
  /** Estado do gatilho, vindo do `useContextMenuTrigger` do cartão. */
  menu: ContextMenuTrigger;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MENU DE ROLAGEM DA PERÍCIA (adendo, seção 2)                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O popup tem **dois** controles:
 *
 *  1. um **`<select>`** com os atributos da ficha, `nome (valor)`, na ordem
 *     do bloco de Atributos — cuja primeira opção é a **rolagem seca**;
 *  2. o botão **"Rolar"**, que executa com o que estiver selecionado.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM SELECT E NÃO UMA LISTA DE ITENS
 * Com seis atributos, "Rolar seca" + divisor + seis itens ocupava meia tela
 * do popup. Com trinta (ficha de campanha), não cabia. O `<select>` nativo
 * resolve os dois: uma linha em qualquer altura, rolagem interna do próprio
 * navegador, e teclado e leitor de tela de graça, sem código nosso.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A ROLAGEM SECA É A OPÇÃO EM BRANCO DO SELECT
 * E não um item separado. Com as duas coisas, haveria dois caminhos para a
 * mesma escolha — o item "Rolar seca" e a opção vazia do select — e o
 * jogador teria que adivinhar qual manda.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O SELECT NÃO É UM ITEM DE MENU
 * Ele é renderizado no slot `above` do popup, fora do `role="menuitem"`. Um
 * `<select>` embrulhado em `MenuItem` seria anunciado como "menuitem" por
 * qualquer leitor de tela, e a navegação por setas passaria a mexer nas
 * opções do select em vez de navegar no menu.
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO GUARDAMOS "O ATRIBUTO DA ÚLTIMA VEZ"
 * Ponto em aberto nº 2 do adendo: cada rolagem é uma escolha nova. Destacar a
 * última usada viraria atalho — e atalho aqui significa rolar SEM o jogador
 * pensar em qual atributo está somando, que é o erro que a escolha na hora
 * evita. Se mudar de ideia, o lugar é UM `useState` com uma opção já
 * selecionada ao abrir; nada em `domain/` mudaria.
 */
export function SkillsRollMenu({ context, skill, menu }: SkillsRollMenuProps) {
  const [attributeId, setAttributeId] = useState("");

  const attributes = context.sheet.attributes;
  const selected = attributes.find((item) => item.id === attributeId);

  function commit(record: RollRecord) {
    context.mutate((current) => ({
      ...current,
      rollHistory: pushRoll(current.rollHistory, record),
    }));
    menu.close();
  }

  function roll() {
    if (selected) {
      commit(
        rollSkillWithAttribute(skill, selected, { system: context.system }),
      );
    } else {
      commit(rollSkillDry(skill, { system: context.system }));
    }
  }

  return (
    <>
      <RollContextMenu
        above={
          <label className="text-amber-100 flex items-center gap-2 px-3 py-1.5">
            <span className="text-text-muted shrink-0 text-[10px] tracking-[0.12em] uppercase">
              Atrib.
            </span>
            <select
              aria-label="Atributo usado na rolagem"
              className="text-amber-100 border-frame bg-surface focus:border-accent min-w-0 flex-1 rounded-[var(--radius-sm)] border px-1 py-1 text-xs outline-none"
              value={attributeId}
              // Sem isto, o `MenuList` do MUI trataria o "Enter" aqui como
              // seleção de item e fecharia o popup no meio da escolha.
              onKeyDown={(event) => event.stopPropagation()}
              onChange={(event) => setAttributeId(event.target.value)}
            >
              <option value="">-Sem Atributo-</option>
              {attributes.map((attribute: Attribute) => (
                <option key={attribute.id} value={attribute.id}>
                  {attribute.name || "Sem nome"} ({attribute.value})
                </option>
              ))}
            </select>
          </label>
        }
        onClose={menu.close}
        open={menu.open}
        position={menu.position}
        sections={[
          {
            label: "Rolar",
            items: [
              {
                id: "rolar",
                textLabel: selected
                  ? `Rolar ${skill.name || "perícia"} com ${selected.name}`
                  : `Rolar ${skill.name || "perícia"} seca`,
                label: "Rolar",
                onSelect: roll,
              },
            ],
          },
        ]}
        title={skill.name || "Perícia"}
      />
    </>
  );
}
