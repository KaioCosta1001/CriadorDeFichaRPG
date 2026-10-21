"use client";

import { GearIcon } from "@/components/ui/icons";
import { RuneButton } from "@/components/ui/RuneButton";

import type { PanelContext } from "../registry";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ENGRENAGEM DE CONFIGURAÇÕES — cabeçalho do Perfil (adendo §2.1)           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O §8.1 original dizia "botão de configurações no canto superior direito do
 * bloco". A versão anterior seguia a letra e o colocava **dentro da área de
 * conteúdo**, colado no canto da foto.
 *
 * O §2.1 pede explicitamente outra coisa: no **HEADER**, junto do título.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A MUDANÇA É MAIS QUE COSMÉTICA
 *
 * Na posição antiga, a engrenagem ficava embaixo da foto e competia com o
 * controle de upload. Pior: ela ficava dentro de uma área com
 * `overflow-y-auto`, de modo que rolando o painel ela saía de vista — o
 * único botão de configuração do app desaparecia.
 *
 * No cabeçalho ela acompanha o bloco, é sempre visível e divide o espaço com
 * as ações do Editar Geral, que é onde o usuário já está procurando.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM ARQUIVO SEPARADO
 *
 * Porque o cabeçalho pertence ao `PanelFrame`, e o `ProfilePanel` é
 * renderizado DENTRO dele — um botão do painel não sobe até o cabeçalho.
 *
 * A entrada `HeaderActions` em `panelRegistry` é quem liga os dois: a grade
 * renderiza o que a definição declarar. Assim a promessa do registro
 * ("adicionar um tipo de painel é UMA entrada aqui") continua valendo, e a
 * grade não precisa saber nada sobre o Perfil.
 */
export function ProfileHeaderActions({ context }: { context: PanelContext }) {
  return (
    <RuneButton label="Abrir configurações" onClick={context.openSettings}>
      <GearIcon />
    </RuneButton>
  );
}
