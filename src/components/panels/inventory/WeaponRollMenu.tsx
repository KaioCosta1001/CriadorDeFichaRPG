"use client";

import { RollContextMenu } from "@/components/ui/RollContextMenu";
import type { DieType } from "@/config/constants";
import { pushRoll, rollWeapon } from "@/domain/rolls";
import type { ContextMenuTrigger } from "@/hooks/useContextMenuTrigger";
import type { Attribute } from "@/schemas";

import type { PanelContext } from "../registry";

/** Só o que a rolagem precisa da arma — `die` já validado pelo schema. */
export type WeaponForRoll = {
  id: string;
  name: string;
  die: DieType;
  diceCount: number;
  attackBonus: number;
  attributeIds: string[];
};

interface WeaponRollMenuProps {
  context: PanelContext;
  weapon: WeaponForRoll;
  attributes: readonly Attribute[];
  /** Estado do gatilho, vindo do `useContextMenuTrigger` da linha. */
  menu: ContextMenuTrigger;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MENU DE ROLAGEM DA ARMA (§8.2.1)                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Uma única opção: **"Rolar"**. Não há "rolar seca" — a arma já tem o dado, o
 * bônus de ataque e os atributos que o usuário configurou na linha; a escolha
 * do que soma foi feita ali, e o menu só executa.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO HÁ SELECT DE ATRIBUTOS AQUI (ao contrário da perícia)
 * Na arma, `attributeIds` é um VÍNCULO FIXO e editável: o usuário decide na
 * linha quais atributos somam, e a rolagem respeita isso sempre.
 *
 * Na perícia não existe vínculo fixo — o atributo é escolhido a cada rolagem.
 * É a diferença entre "configurar" e "escolher agora", e é por isso que só a
 * perícia precisa de Select no popup.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * §8.2.1 — OS DADOS SÃO INDEPENDENTES
 * `diceCount` vai direto para `rollWeapon`, que sorteia N vezes e soma. A
 * dádica `2d8` fica visível na linha, então o jogador vê que a rolagem será
 * `2d8 [5] [3] + ...` — nunca "16", nunca "o dobro de um d8".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O SORTEIO ACONTECE DENTRO DA RECEITA DO `mutate`
 * Se o `RollRecord` fosse montado antes, o `rng` seria consumido fora da
 * atualização — e o histórico mostraria o MESMO resultado para armas
 * diferentes sorteadas no mesmo tique.
 */
export function WeaponRollMenu({
  context,
  weapon,
  attributes,
  menu,
}: WeaponRollMenuProps) {
  const displayName = weapon.name || "Arma";

  return (
    <RollContextMenu
      onClose={menu.close}
      open={menu.open}
      position={menu.position}
      sections={[
        {
          label: `${weapon.diceCount}${weapon.die}`,
          items: [
            {
              id: "rolar",
              textLabel: `Rolar ${displayName}`,
              label: "Rolar",
              onSelect: () => {
                context.mutate((current) => {
                  const record = rollWeapon(
                    weapon,
                    weapon.attributeIds,
                    attributes,
                    { system: context.system },
                  );
                  return {
                    ...current,
                    rollHistory: pushRoll(current.rollHistory, record),
                  };
                });
                menu.close();
              },
            },
          ],
        },
      ]}
      title={displayName}
    />
  );
}
