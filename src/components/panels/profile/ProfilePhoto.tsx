"use client";

import { RuneButton } from "@/components/ui/RuneButton";
import { PortraitFrame } from "@/components/ui/ornaments";
import { PlusIcon } from "@/components/ui/icons";
import { useState } from "react";

import { ImageProcessingError, processProfilePhoto } from "@/lib/image";
import { useMounted } from "@/hooks/useMounted";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import type { Profile } from "@/schemas";

import type { PanelContext } from "../registry";

interface ProfilePhotoProps {
  profile: Profile;
  context: PanelContext;
  /**
   * Pede o aviso de "o nome só muda no Editar Geral".
   * O estado do aviso fica no `ProfilePanel`, que é quem o renderiza.
   */
  onShowNameNotice: () => void;
  onError: (message: string) => void;
}

/**
 * Nome do personagem + foto, empilhados e centralizados (seção 8.1, adendo §2).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SEGURANÇA DA FOTO
 *  - O arquivo é validado por TIPO e TAMANHO antes de ser decodificado;
 *  - é redimensionado e comprimido no cliente (`lib/image.ts`), porque a
 *    cota do `localStorage` é de ~5 MB e compartilhada por toda a origem;
 *  - o resultado é um data URL usado em `<img>` — NUNCA em
 *    `dangerouslySetInnerHTML`, e nunca com `src` vindo de texto livre.
 *
 * A foto é TEXTO PURO no schema (string), validada em comprimento. Um
 * `data:` URL malicioso não executa nada: `<img>` não interpreta script.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE SAIU DAQUI
 *
 * A engrenagem de Configurações. Ela vivia neste componente, colada no canto
 * da foto — dentro da área que rola, embaixo de tudo. O §2.1 pede no HEADER do
 * bloco, e agora está lá via `PanelDefinition.HeaderActions`.
 *
 * O nome também mudou de lugar: estava à direita da foto, agora fica ACIMA,
 * centralizado. Ao lado, a linha ficava desequilibrada — nome de um lado,
 * retrato do outro — e em painel estreito o nome era a primeira coisa a
 * encolher.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function ProfilePhoto({
  profile,
  context,
  onShowNameNotice,
  onError,
}: ProfilePhotoProps) {
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);

  // Sem foto: um campo de texto puro para o nome. O clique duplo abre a
  // edição (regra geral da §8.1).
  const name = useInlineEdit({
    value: context.sheet.name,
    disabled: !context.editMode,
    onBlocked: onShowNameNotice,
    commit: (next) => {
      context.mutate((current) => ({ ...current, name: next }));
    },
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await processProfilePhoto(file);
      context.mutate((current) => ({
        ...current,
        profile: { ...current.profile, photo: dataUrl },
      }));
    } catch (error) {
      onError(
        error instanceof ImageProcessingError
          ? error.message
          : "Não foi possível usar essa imagem.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    context.mutate((current) => ({
      ...current,
      profile: { ...current.profile, photo: null },
    }));
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {/* ── NOME ────────────────────────────────────────────────────────────
       * Sobre a foto, centralizado. O §2 deixa a escolha ("no header ou logo
       * acima da foto") em aberto; acima vence porque o cabeçalho já tem o
       * título do bloco e a engrenagem, e porque o nome é conteúdo — a
       * primeira coisa que se procura numa ficha.
       */}
      <div className="w-full max-w-full px-1">
        {name.editing ? (
          <input
            aria-label="Nome do personagem"
            className="border-accent bg-surface-sunken font-display w-full rounded-[var(--radius-sm)] border px-2 py-1 text-center outline-none"
            value={name.draft}
            {...name.inputProps}
          />
        ) : (
          <button
            type="button"
            aria-label={`Nome do personagem: ${context.sheet.name || "sem nome"}. Clique duas vezes para editar.`}
            className="font-display text-accent hover:text-text block w-full cursor-default truncate text-center text-lg font-bold tracking-wide transition-[text-shadow,color] hover:text-shadow-[0_0_14px_-4px_var(--glow)]"
            onDoubleClick={name.onDoubleClick}
          >
            {context.sheet.name || "Sem nome"}
          </button>
        )}

        {/* O nome NUNCA é editável fora do Editar Geral. O aviso é exibido
            pelo pai, que controla também o tempo de vida. */}
        {context.editMode ? (
          <p className="text-text-muted mt-0.5 text-center text-[10px] tracking-[0.14em] uppercase">
            nome editável no modo Editar
          </p>
        ) : null}
      </div>

      {/* ── FOTO ────────────────────────────────────────────────────────────
       * Moldura de retrato: aro metálico com bisel, mais o halo quando há
       * foto. Fica absolute para o conteúdo não afetar o layout.
       */}
      <div className="relative size-32 shrink-0">
        {profile.photo ? (
          // `<Image>` do Next é para ARQUIVOS DO SERVIDOR. A foto aqui é um
          // data URL já redimensionado no cliente (512 px, JPEG comprimido) —
          // passar pelo otimizador seria re-comprimir algo que já está no
          // tamanho certo, e exigiria um src remoto.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`Foto de ${context.sheet.name || "personagem"}`}
            className="border-frame size-full rounded-full border object-cover shadow-[0_0_18px_-8px_var(--glow)]"
            src={profile.photo}
          />
        ) : (
          <div className="border-frame bg-surface-sunken grid size-full place-items-center rounded-full border border-dashed">
            <span className="text-text-muted/70 text-3xl">☺</span>
          </div>
        )}
        <PortraitFrame />

        {mounted ? (
          <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-1">
            <RuneButton
              disabled={busy}
              label={profile.photo ? "Trocar foto" : "Enviar foto"}
              onClick={() =>
                document.getElementById("profile-photo-input")?.click()
              }
            >
              <PlusIcon />
            </RuneButton>
            {profile.photo ? (
              <RuneButton
                label="Remover foto"
                tone="danger"
                onClick={handleRemove}
              >
                ✕
              </RuneButton>
            ) : null}
          </div>
        ) : null}
      </div>

      <input
        id="profile-photo-input"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void handleFile(file);
        }}
      />
    </div>
  );
}

/** Reexporta o tipo usado pelo pai. */
export type { Profile };
