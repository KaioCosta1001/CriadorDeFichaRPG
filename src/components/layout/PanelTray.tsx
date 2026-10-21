"use client";

import { Menu, MenuItem, Tooltip } from "@mui/material";
import { useState } from "react";

import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { CONTEXT_MENU_FADE_MS } from "@/config/constants";
import { isPanelTypeHideable } from "@/config/panelTypes";
import type { PanelType } from "@/config/panelTypes";
import { extraIdFromKey, isExtraPanelKey } from "@/domain/layout";
import type { Sheet } from "@/schemas";

import { getPanelTitle } from "../panels/registry";

interface PanelTrayProps {
  sheet: Sheet;
  /** Liga/desliga a visibilidade de um bloco. */
  onToggleVisible: (panelId: string, nextVisible: boolean) => void;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BANDEJA DE BLOCOS ("PAINÉIS")                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A ficha tem duas portas de entrada: o olho no cabeçalho de cada bloco, e
 * esta bandeja.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A BANDEJA NÃO É OPCIONAL
 *
 * Esconder é fácil demais e desfazer é chato demais: um clique errado no olho
 * some com um bloco inteiro, e o único caminho de volta era "Resetar layout" —
 * que mexe em posição, tamanho e ordem de **todos** os blocos. Ou seja: para
 * recuperar um bloco, o usuário perdia o arranjo inteiro da ficha.
 *
 * Isso é a razão de o adendo tratar a bandeja como requisito e não como
 * conveniência: esconder algo sem caminho de volta barato é um beco sem saída,
 * e o custo de consertar é desproporcional ao ganho de esconder.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE FICA ABERTA OU FECHADA?
 *
 * Fica num `<Menu>` do MUI, que entrega foco preso, navegação por setas, `Esc`
 * e devolução do foco ao botão de origem. Reescrever isso à mão seria trocar o
 * padrão WAI-ARIA por conta própria.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PERFIL E INVENTÁRIO NÃO TÊM TOGGLE
 *
 * Esconder os dois deixaria a ficha sem nome e sem bagagem — e a bandeja é
 * justamente a função que FAZ o usuário esconder coisas. `isPanelTypeHideable`
 * centraliza a regra; ver `config/panelTypes.ts`.
 */
export function PanelTray({ sheet, onToggleVisible }: PanelTrayProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  // Ordena pela ordem salva: a bandeja é um mapa da tela, e o jogador a lê
  // comparando com o que está vendo.
  const entries = [...sheet.layout].sort(
    (a, b) => a.order - b.order || a.y - b.y || a.x - b.x,
  );

  const hidden = entries.filter((panel) => !panel.visible);

  return (
    <>
      <Tooltip
        title={
          hidden.length > 0
            ? `${hidden.length} bloco(s) oculto(s) — clique para ver`
            : "Nenhum bloco oculto"
        }
        enterDelay={400}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          aria-label={
            hidden.length > 0 ? `Painéis (${hidden.length} ocultos)` : "Painéis"
          }
          onClick={(event) => setAnchor(event.currentTarget)}
          className={[
            "border-frame bg-surface-sunken relative flex items-center gap-1.5",
            "rounded-[var(--radius-sm)] border px-2 py-1 text-xs transition-colors",
            hidden.length > 0
              ? "text-accent border-accent shadow-[0_0_14px_-6px_var(--glow)]"
              : "text-text-muted hover:text-text",
          ].join(" ")}
        >
          {hidden.length > 0 ? <EyeOffIcon /> : <EyeIcon />}
          <span className="hidden sm:inline">Painéis</span>
          {/* Contador de ocultos. O selo é o que torna o botão discoverível:
              um olho sem número não diz se há algo a recuperar. */}
          {hidden.length > 0 ? (
            <span
              aria-hidden="true"
              className="border-accent text-accent ml-0.5 rounded-full border px-1 text-[10px] font-bold tabular-nums"
            >
              {hidden.length}
            </span>
          ) : null}
        </button>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        transitionDuration={CONTEXT_MENU_FADE_MS}
        onClose={() => setAnchor(null)}
        slotProps={{
          list: { "aria-label": "Blocos da ficha" },
          paper: {
            variant: "outlined",
            sx: {
              backgroundImage: "none",
              backgroundColor: "var(--surface-raised)",
              borderColor: "var(--frame)",
              boxShadow:
                "0 18px 40px -18px rgb(0 0 0 / 0.9), 0 0 0 1px rgb(0 0 0 / 0.5)",
              minWidth: "16rem",
              padding: "0.25rem",
            },
          },
        }}
      >
        {entries.map((panel) => {
          const type = isExtraPanelKey(panel.panelId)
            ? sheet.extraPanels.find(
                (extra) => extra.id === extraIdFromKey(panel.panelId),
              )?.type
            : (panel.panelId as PanelType);

          const title = isExtraPanelKey(panel.panelId)
            ? (sheet.extraPanels.find(
                (extra) => extra.id === extraIdFromKey(panel.panelId),
              )?.title ?? "Bloco")
            : getPanelTitle(type ?? (panel.panelId as PanelType));

          const hideable = type ? isPanelTypeHideable(type) : true;
          const visible = panel.visible;

          return (
            <MenuItem
              key={panel.panelId}
              aria-label={
                // Para um bloco FIXO, o rótulo explica o porquê do bloqueio.
                // Deixar "Esconder bloco X" num item desabilitado faria o
                // leitor de tela anunciar uma ação que não existe.
                !hideable
                  ? `${title} não pode ser ocultado`
                  : visible
                    ? `Esconder bloco ${title}`
                    : `Mostrar bloco ${title}`
              }
              disabled={!hideable}
              onClick={() => {
                if (!hideable) return;
                onToggleVisible(panel.panelId, !visible);
                // A bandeja FECHA depois de um toggle: o jogador já fez o que
                // foi até ali, e manter a lista aberta sobre o bloco que
                // acabou de aparecer esconderia o resultado da ação.
                setAnchor(null);
              }}
              sx={{
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8125rem",
                gap: 1,
                // Item esmaecido quando o bloco está oculto: o estado fica
                // legível num relance, sem precisar da cor do ícone.
                opacity: hideable ? (visible ? 1 : 0.45) : 0.45,
                "&.Mui-focused": {
                  backgroundColor:
                    "color-mix(in srgb, var(--accent) 18%, transparent)",
                  outline: "1px solid var(--accent)",
                  outlineOffset: "-1px",
                },
              }}
            >
              {visible ? <EyeIcon /> : <EyeOffIcon />}
              <span className="min-w-0 flex-1 truncate">{title}</span>
              {!hideable ? (
                <span className="text-text-muted text-[10px] tracking-[0.12em] uppercase">
                  fixo
                </span>
              ) : null}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
