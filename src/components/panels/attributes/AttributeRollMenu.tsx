"use client";

import { RollContextMenu } from "@/components/ui/RollContextMenu";
import {
  pushRoll,
  rollAttribute,
  type RollableAttribute,
} from "@/domain/rolls";
import type { ContextMenuTrigger } from "@/hooks/useContextMenuTrigger";
import type { RollRecord } from "@/schemas";

import type { PanelContext } from "../registry";

interface AttributeRollMenuProps {
  context: PanelContext;
  attribute: RollableAttribute;
  /** Estado do gatilho, vindo do `useContextMenuTrigger` do cartão. */
  menu: ContextMenuTrigger;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MENU DE ROLAGEM DO ATRIBUTO (adendo, seção 3)                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Um botão só: **"Rolar"**, que sorteia `d20 + contribuição do atributo`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM MENU COM UM ITEM
 * Poderia ser um clique direto no cartão. O menu foi pedido assim porque é o
 * MESMO componente da perícia, com o MESMO comportamento de fechamento,
 * teclado, toque longo e tooltip de descoberta — dois gestos diferentes para
 * "rolar" em blocos vizinhos seria pior do que o item a mais.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A CONTRIBUIÇÃO VEM DO SISTEMA (ponto em aberto nº 1)
 * `ATTRIBUTE_ROLL_ADDS_CONTRIBUTION` decide se a parcela entra no total, e o
 * padrão é **somar** — a mesma conversão que a arma usaria. Trocar o padrão
 * é virar a flag em `constants.ts`; o teste de domínio lê a mesma flag, então
 * a mudança aparece como FALHA DE TESTE, e não como resultado diferente e
 * silencioso.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function AttributeRollMenu({
  context,
  attribute,
  menu,
}: AttributeRollMenuProps) {
  function commit(record: RollRecord) {
    context.mutate((current) => ({
      ...current,
      rollHistory: pushRoll(current.rollHistory, record),
    }));
    menu.close();
  }

  return (
    <>
      <RollContextMenu
        onClose={menu.close}
        open={menu.open}
        position={menu.position}
        sections={[
          {
            items: [
              {
                id: "rolar",
                textLabel: "Rolar",
                label: "Rolar",
                onSelect: () =>
                  commit(rollAttribute(attribute, { system: context.system })),
              },
            ],
          },
        ]}
        title={attribute.name || "Atributo"}
      />
    </>
  );
}
