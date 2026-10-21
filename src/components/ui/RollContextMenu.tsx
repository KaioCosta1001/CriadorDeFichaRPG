"use client";

import { Menu, MenuItem, Tooltip } from "@mui/material";
import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { CONTEXT_MENU_FADE_MS, LONG_PRESS_MS } from "@/config/constants";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MENU DE CONTEXTO DE ROLAGEM                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Menu ancorado no CURSOR (`anchorReference="anchorPosition"`), no estilo de
 * pergaminho e metal do grimário.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A POSIÇÃO
 * O MUI posiciona sozinho a partir de `{ top, left }` e inverte o menu quando
 * ele sairia da tela. Não tentamos centralizar no elemento: o usuário abriu o
 * menu APONTANDO para alguma coisa, e o menu na ponta do cursor é o que a mão
 * espera.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠️ NÃO ENVOLVA O CONTEÚDO NUM `MenuList`
 *
 * O `<Menu>` do MUI JÁ renderiza o seu próprio `<ul role="menu">` e coloca os
 * `children` DENTRO dele. Envolver em outro `MenuList` produz dois menus
 * aninhados: o leitor de tela anuncia dois widgets, e a navegação por setas
 * se perde na fronteira. É por isso que as seções aqui são `<li
 * role="presentation">` (decorações), e não listas.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ACESSIBILIDADE
 * O `Menu` do MUI já entrega: foco preso dentro do menu, navegação por
 * setas, `Esc` fecha, `aria-haspopup`, `role="menu"`/`role="menuitem"`, e
 * retorno do foco ao elemento de origem ao fechar. Reescrever isso aqui seria
 * trocar o padrão WAI-ARIA por conta própria.
 *
 * `prefers-reduced-motion` zera a duração da transição — o menu APARECE
 * igual, só sem deslizar. Some a animação, não a função.
 */

export interface RollMenuItem {
  id: string;
  /** Conteúdo visível (pode ser um nó, para "Destreza (16)" alinhado). */
  label: ReactNode;
  /** Texto simples, usado no `aria-label` quando `label` é um nó. */
  textLabel: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface RollMenuSection {
  /** Título de seção (ex.: "Rolar com atributo"). */
  label?: string;
  items: RollMenuItem[];
}

export interface RollContextMenuProps {
  open: boolean;
  position: { top: number; left: number };
  /** Título do menu — o nome da perícia ou do atributo. */
  title: string;
  sections: RollMenuSection[];
  /**
   * Conteúdo renderizado ANTES dos itens, dentro da lista.
   *
   * Existe para o `<select>` de atributo da perícia: um controle de
   * formulário dentro de um `role="menu"` não é um item de menu, e
   * embrulhá-lo em `MenuItem` faria o leitor de tela anunciar "menuitem"
   * para o que é, na verdade, uma caixa de combinação.
   */
  above?: ReactNode;
  onClose: () => void;
}

export function RollContextMenu({
  open,
  position,
  title,
  sections,
  above,
  onClose,
}: RollContextMenuProps) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : CONTEXT_MENU_FADE_MS;

  return (
    <Menu
      anchorPosition={position}
      anchorReference="anchorPosition"
      onClose={onClose}
      open={open}
      // `transitionDuration` é a prop de duração do MUI v9 (o `duration` do
      // react-transition-group virou `timeout` no slot). O `easing` do
      // GrowTransition aceita só nomes de curva: `easeOut` é o mais próximo do
      // `entrance` do adendo, e em 120 ms a diferença não aparece.
      transitionDuration={duration}
      slotProps={{
        list: { "aria-label": title },
        paper: {
          // `variant="outlined"` dá o contorno fino dourado; o fundo vem do
          // token `--surface-raised`, o mesmo do resto do app.
          variant: "outlined",
          sx: {
            backgroundImage: "none",
            backgroundColor: "var(--surface-raised)",
            borderColor: "var(--frame)",
            boxShadow:
              "0 18px 40px -18px rgb(0 0 0 / 0.9), 0 0 0 1px rgb(0 0 0 / 0.5)",
            minWidth: "15rem",
            padding: "0.25rem",
          },
        },
      }}
    >
      {/* Cabeçalho do menu: nome da perícia/atributo. Decorative — quem lê
          é o `aria-label` do `MenuList`, que já carrega o mesmo texto. */}
      <li
        aria-hidden="true"
        className="label-caps text-text-muted border-frame/70 px-3 pt-2 pb-1"
      >
        {title}
      </li>

      {above ? <li role="presentation">{above}</li> : null}

      {sections.map((section) => (
        <li key={section.label ?? "principal"} role="presentation">
          {section.label ? (
            <span className="text-text-muted block px-3 pt-2 pb-1 text-[10px] tracking-[0.14em] uppercase">
              {section.label}
            </span>
          ) : null}

          {section.items.map((item) => (
            <MenuItem
              key={item.id}
              aria-label={item.textLabel}
              disabled={item.disabled}
              onClick={item.onSelect}
              sx={{
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8125rem",
                minHeight: "2rem",
                // Foco do teclado visível: sem isto, quem navega por setas
                // se moveria entre as opções sem saber onde está.
                "&.Mui-focused": {
                  backgroundColor:
                    "color-mix(in srgb, var(--accent) 18%, transparent)",
                  outline: "1px solid var(--accent)",
                  outlineOffset: "-1px",
                },
                "&.Mui-disabled": { opacity: 0.45 },
              }}
            >
              {item.label}
            </MenuItem>
          ))}

          {/* Divisor discreto entre "Rolar seca" e a lista de atributos. */}
          {section.label ? (
            <span
              aria-hidden="true"
              className="bg-frame/50 mx-3 my-1 block h-px"
            />
          ) : null}
        </li>
      ))}
    </Menu>
  );
}

/**
 * Dica de descoberta: "Botão direito para rolar".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM TOOLTIP E NÃO UM TEXTO FIXO
 * Clique direito é o gesto mais difícil de adivinhar, mas um aviso-permanente
 * embaixo de cada perícia poluiria a leitura da lista. O tooltip aparece
 * só quando o usuário está olhando, que é quando ele precisa da dica.
 *
 * O texto cita o toque longo também: quem está no celular não tem botão
 * direito, e ver apenas "botão direito" o levaria a concluir que a rolagem
 * não existe no celular.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function RollHintTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip
      title={`Botão direito (ou Menu / Shift+F10, ou toque de ${LONG_PRESS_MS / 1000}s) para rolar`}
      enterDelay={600}
      slotProps={{ tooltip: { sx: { fontSize: "0.7rem", maxWidth: 240 } } }}
    >
      {children as React.ReactElement}
    </Tooltip>
  );
}
