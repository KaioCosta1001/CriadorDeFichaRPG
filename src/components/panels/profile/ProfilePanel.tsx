"use client";

import { useState } from "react";

import { NameEditNotice } from "./NameEditNotice";
import { ProfilePhoto } from "./ProfilePhoto";
import { ProfileSlot, ProfileSlotGhost } from "./ProfileSlot";
import {
  PROFILE_SLOT_POSITIONS,
  type ProfileSlotPosition,
} from "@/config/profileSlots";
import { NOTICE_NAME_EDIT_LOCKED } from "@/config/constants";
import type { ProfileSlot as ProfileSlotType } from "@/schemas";
import type { PanelProps } from "../registry";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BLOCO DE PERFIL — seção 8.1 + adendo §2                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 *   ┌───────────────────────────────┐
 *   │ [header: título ......... ⚙ ] │   ← engrenagem no HEADER (registry)
 *   │ ┌────┐                  (extra: │
 *   │ │ CA │                  desligado│
 *   │ └────┘                  por padrão)│
 *   │          ╭─────────╮         │
 *   │          │  NOME   │         │
 *   │          │ ╭─────╮ │         │
 *   │          │ │FOTO │ │         │   ← foto NO CENTRO
 *   │          │ ╰─────╯ │         │
 *   │          ╰─────────╯         │
 *   │ ┌──────┐               ┌────┐ │
 *   │ │SANID.│               │ PV │ │
 *   │ └──────┘               └────┘ │
 *   └───────────────────────────────┘
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE GRID 3×3 COM COLUNAS SIMÉTRICAS
 *
 * A primeira versão posicionava tudo com `absolute` nos cantos e a foto no
 * centro. Em painel largo ficava bonito; estreitado, a foto passava por trás
 * dos orbes.
 *
 * O grid de três colunas — `1fr auto 1fr` — reserva espaço real para os dois
 * lados, então a foto fica EXATAMENTE no centro (as colunas laterais têm a
 * mesma largura por construção, independentemente do tamanho do orbe) e nunca
 * é coberta. Em vez de trocar o desenho quando falta espaço, ele se comprime.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O NOME FICA SOBRE A FOTO, E NÃO NO HEADER
 *
 * O §2 deixa a escolha em aberto. No header ele brigaria com o título do bloco
 * e com a engrenagem, e o Perfil é o único bloco cujo nome é conteúdo e não
 * metadado — o nome do personagem é a primeira coisa que se procura.
 *
 * Sobre a foto ele fica no eixo vertical do retrato, que é onde o olho já vai.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * REGRAS QUE ESTE COMPONENTE CARREGA
 *  - Slots de posição FIXA nos quatro cantos, ligáveis e desligáveis;
 *  - RÓTULO editável só no Editar Geral; VALOR por clique duplo, sempre;
 *  - O NOME DO PERSONAGEM só é editável no Editar Geral. Fora dele, o duplo
 *    clique mostra o aviso "Poderá ser editado em 'Editar' no painel principal";
 *  - A engrenagem de Configurações fica no CABEÇALHO do bloco (§2.1), injetada
 *    por `PanelDefinition.HeaderActions` — ver `ProfileHeaderActions`;
 *  - A foto é redimensionada e comprimida no cliente.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O AVISO DO NOME VIVE AQUI
 * O texto é exigido literalmente pela §8.1. Deixá-lo em constante
 * (`NOTICE_NAME_EDIT_LOCKED`) garante que a frase não se degrade em edições de
 * copy — e o teste verifica o texto exato.
 */
export function ProfilePanel({ context }: PanelProps) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profile = context.sheet.profile;

  function patchSlot(slotId: string, patch: Partial<ProfileSlotType>) {
    context.mutate((current) => ({
      ...current,
      profile: {
        ...current.profile,
        slots: current.profile.slots.map((slot) =>
          slot.id === slotId ? { ...slot, ...patch } : slot,
        ),
      },
    }));
  }

  /** O slot de um canto, se existir. */
  const slotAt = (position: ProfileSlotPosition) =>
    profile.slots.find((slot) => slot.position === position);

  /**
   * Renderiza um canto.
   *
   *Ligado, mostra o slot. Desligado, mostra o fantasma — mas SÓ no Editar
   * Geral, fora dele o canto fica vazio. É o que mantém o botão de desligar
   * reversível: sem o fantasma, desligar um campo seria um caminho sem volta
   * dentro da própria interface.
   */
  function corner(position: ProfileSlotPosition, align: string) {
    const slot = slotAt(position);

    if (!slot) return null;

    if (!slot.enabled) {
      if (!context.editMode) return null;
      return (
        <div className={align}>
          <ProfileSlotGhost
            position={position}
            slot={slot}
            onEnable={() => {
              patchSlot(slot.id, { enabled: true });
              setEditingSlotId(slot.id);
            }}
          />
        </div>
      );
    }

    return (
      <div className={align}>
        <ProfileSlot
          active={editingSlotId === slot.id}
          editMode={context.editMode}
          position={position}
          slot={slot}
          onActivate={() => setEditingSlotId(slot.id)}
          onChange={(patch) => patchSlot(slot.id, patch)}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col p-3">
      {/* Aviso do nome. Fica por cima do nome e não captura o ponteiro. */}
      <NameEditNotice
        message={NOTICE_NAME_EDIT_LOCKED}
        open={noticeOpen}
        onClosed={() => setNoticeOpen(false)}
      />

      {/*
       * Grade dos quatro cantos com a foto no miolo.

       * `1fr auto 1fr` nas colunas é o que garante que a foto fique no centro
       * EXATO: as duas colunas laterais têm sempre a mesma largura, mesmo que
       * os orbes sejam de tamanhos diferentes.
       */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] grid-rows-[auto_1fr_auto] items-center gap-2 overflow-y-auto">
        {corner(
          "top-left",
          "col-start-1 row-start-1 self-start justify-self-start",
        )}
        {corner(
          "top-right",
          "col-start-3 row-start-1 self-start justify-self-end",
        )}

        {/* Centro: nome sobre a foto. */}
        <div className="col-start-2 row-start-2 flex min-w-0 flex-col items-center gap-2">
          <ProfilePhoto
            context={context}
            onError={setError}
            onShowNameNotice={() => setNoticeOpen(true)}
            profile={profile}
          />
        </div>

        {corner(
          "bottom-left",
          "col-start-1 row-start-3 self-end justify-self-start",
        )}
        {corner(
          "bottom-right",
          "col-start-3 row-start-3 self-end justify-self-end",
        )}
      </div>

      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}

      {/* Nome guardado para leitura de tela do bloco. */}
      <span className="sr-only">
        Perfil de {context.sheet.name || "personagem sem nome"}
      </span>
    </div>
  );
}

/** Posições em ordem de leitura, para os testes. */
export const PROFILE_CORNERS = PROFILE_SLOT_POSITIONS;
