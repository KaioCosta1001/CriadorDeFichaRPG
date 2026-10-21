"use client";

import { RuneButton } from "@/components/ui/RuneButton";
import { EyeIcon, EyeOffIcon, PlusIcon } from "@/components/ui/icons";
import { FIELD_VALUE_MAX_LENGTH } from "@/config/constants";
import { ORB_COLORS, detectOrbRole, type OrbRole } from "@/config/constants";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import type { ProfileSlot as ProfileSlotType } from "@/schemas";

interface ProfileSlotProps {
  slot: ProfileSlotType;
  onChange: (patch: Partial<ProfileSlotType>) => void;
  /** `true` no Editar Geral: habilita editar o rótulo e o valor máximo. */
  editMode: boolean;
  /** `true` enquanto este slot está sendo editado (revela "Máx."). */
  active: boolean;
  onActivate: () => void;
  /** Posição no canto — usada no rótulo para leitores de tela. */
  position: string;
}

/**
 * Um slot do Perfil como medalhão/orbe (seção 8.1 + adendo §2 e §5).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O ORBE
 * PV/Vida ganha preenchimento de brasa proporcional a `value / max`.
 * SANIDADE/FOOCO ganha tom azul-violeta frio. O contraste entre os dois é
 * proposital: numa ficha é comum ter PV e Sanidade lado a lado, e o jogador
 * precisa distingui-los num olhar.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A COR VEM DO PAPEL, NÃO DO NOME
 * Se a cor estivesse presa ao rótulo, renomear "PV" para "Vida" mudaria o
 * orbe sem querer. O papel é detectado pelo rótulo e pode ser fixado pelo
 * usuário — ver `detectOrbRole`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O PREENCHIMENTO É SÓ VISUAL
 * `max` não participa de nenhuma regra de jogo (a §8.1 é explícita: "apenas
 * visual, sem criar regra nova"). A rolagem e o peso do inventário não olham
 * para cá. Sem `max`, o orbe é só um medalhão com aro.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * RÓTULO: SÓ NO EDITAR GERAL (adendo §2.2)
 *
 * O prompt principal tratava rótulo e valor do mesmo jeito: clique duplo nos
 * dois, a qualquer momento. O adendo separa:
 *
 *  - o VALOR continua por clique duplo, sempre;
 *  - o RÓTULO só no Editar Geral. Fora dele é texto fixo.
 *
 * A razão é de ergonomia: uma lista de quatro campos com rótulo clicável
 * convida a erro — o jogador clica duas vezes em "PV" esperando abrir o
 * número e não abre nada. Tirando o rótulo do caminho do duplo clique, o
 * clique duplo significa sempre "editar o número", sem exceção para aprender.
 *
 * E para quem nunca entrou no Editar Geral, os rótulos são a terminologia do
 * sistema: não é uma edição que se descobre por dedução.
 */
export function ProfileSlot({
  slot,
  onChange,
  editMode,
  active,
  onActivate,
  position,
}: ProfileSlotProps) {
  const role: OrbRole = slot.orbRole ?? detectOrbRole(slot.label);
  const colors = ORB_COLORS[role];
  const nome = slot.label || "campo";

  const value = useInlineEdit({
    value: slot.value,
    commit: (next) => onChange({ value: next }),
  });

  const label = useInlineEdit({
    value: slot.label,
    // `disabled` trava o duplo clique e dispara o aviso — que é o mecanismo
    // que o §8.1 já usa para o nome do personagem.
    disabled: !editMode,
    commit: (next) => onChange({ label: next }),
  });

  const numeric = Number.parseInt(slot.value, 10);
  const ratio =
    slot.max && slot.max > 0 && Number.isFinite(numeric)
      ? Math.max(0, Math.min(1, numeric / slot.max))
      : null;

  return (
    <div className="flex items-center gap-2">
      <div className="border-frame bg-surface-sunken relative grid size-14 shrink-0 place-items-center rounded-full border shadow-[inset_0_0_0_1px_var(--frame-inner)]">
        {/* Preenchimento do orbe — só quando há valor máximo. */}
        {ratio !== null ? (
          <span
            aria-hidden="true"
            className="absolute inset-1 overflow-hidden rounded-full"
          >
            <span
              className="absolute inset-x-0 bottom-0 transition-[height] duration-300"
              style={{
                height: `${ratio * 100}%`,
                background: `linear-gradient(to top, ${colors.fill}, ${colors.glow})`,
                opacity: 0.55,
              }}
            />
          </span>
        ) : null}

        {/* Anel do orbe, na cor do papel. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0.5 rounded-full border-2"
          style={{
            borderColor: colors.glow,
            opacity: ratio !== null ? 0.9 : 0.55,
            boxShadow: `0 0 12px -4px ${colors.glow}`,
          }}
        />

        {value.editing ? (
          <input
            aria-label={`Valor de ${nome}`}
            className="border-accent bg-surface font-display relative z-10 w-12 rounded border px-1 text-center text-sm outline-none"
            maxLength={FIELD_VALUE_MAX_LENGTH}
            value={value.draft}
            {...value.inputProps}
          />
        ) : (
          <button
            type="button"
            aria-label={`${nome}: ${slot.value || "sem valor"}. Clique duas vezes para editar.`}
            className="font-display text-text relative z-10 w-12 cursor-default truncate text-center text-base font-bold"
            onDoubleClick={value.onDoubleClick}
          >
            {slot.value || "—"}
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {label.editing ? (
          <input
            aria-label={`Rótulo de ${position}`}
            className="border-accent bg-surface w-full rounded-[var(--radius-sm)] border px-1 py-0.5 text-xs tracking-[0.14em] uppercase outline-none"
            value={label.draft}
            {...label.inputProps}
          />
        ) : editMode ? (
          // No Editar Geral o rótulo VIRA campo. Fora dele é texto fixo — e por
          // isso não é botão: um `<button>` sem ação seria enganoso para o
          // leitor de tela, que anunciaria "botão" sem nada a fazer.
          <input
            aria-label={`Rótulo de ${position}`}
            className="label-caps border-frame bg-surface-sunken focus:border-accent w-full rounded-[var(--radius-sm)] border-b border-transparent bg-transparent px-0 py-0.5 transition-colors outline-none"
            maxLength={64}
            placeholder="rótulo"
            value={slot.label}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        ) : (
          <span className="label-caps block truncate">
            {slot.label || "Campo"}
          </span>
        )}

        {/* O máximo só aparece no Editar Geral: fora dele é ruído visual,
            porque ele não participa de nenhuma regra. */}
        {editMode && active ? (
          <label className="text-text-muted mt-1 flex items-center gap-1 text-[10px]">
            <span>Máx.</span>
            <input
              aria-label={`Valor máximo de ${nome}`}
              className="border-frame bg-surface focus:border-accent w-14 rounded border px-1 font-mono outline-none"
              inputMode="numeric"
              placeholder="—"
              value={slot.max ?? ""}
              onChange={(event) =>
                onChange({
                  max:
                    event.target.value.trim() === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
        ) : null}
      </div>

      {editMode ? (
        <RuneButton
          aria-pressed={slot.enabled}
          // O rótulo reflete o que o BOTÃO FAZ: desligar um campo ligado,
          // ligar um desligado. Usar `active` (o slot selecionado) aqui
          // mentiria — o clique altera `enabled`, não `active`.
          label={
            slot.enabled ? `Desligar campo ${nome}` : `Ligar campo ${nome}`
          }
          onClick={() => {
            onChange({ enabled: !slot.enabled });
            // Ao ligar um campo desligado, já o deixamos selecionado: assim
            // o campo de "valor máximo" aparece onde o usuário está olhando.
            if (!slot.enabled) onActivate();
          }}
        >
          {slot.enabled ? <EyeIcon /> : <EyeOffIcon />}
        </RuneButton>
      ) : null}
    </div>
  );
}

/**
 * SLOT DESLIGADO, MOSTRADO SÓ NO EDITAR GERAL (adendo §2.2).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É NECESSÁRIO
 *
 * A versão anterior renderizava `if (!slot.enabled) return null` — e o botão
 * que religa um slot desligado ficava DENTRO do slot. Ou seja: desligar um
 * campo era um caminho sem volta dentro da própria interface.
 *
 * O conserto é o que o adendo pede: "no Editar Geral também é possível
 * ligar/desligar cada slot". Um slot desligado aparece como um retângulo
 * tracejado, com o rótulo que teria e um sinal de "ligar".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE SÓ NO EDITAR GERAL
 *
 * Fora dele, um campo desligado tem que sumir de verdade. Mostrar um fantasma
 * em toda ficha seria pior que o problema original: o jogador veria um espaço
 * reservado que não pode preencher.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function ProfileSlotGhost({
  slot,
  position,
  onEnable,
}: {
  slot: ProfileSlotType;
  position: string;
  onEnable: () => void;
}) {
  const nome = slot.label || "campo extra";

  return (
    <button
      type="button"
      aria-label={`Ligar o campo ${nome} no ${position}`}
      className="border-frame/70 text-text-muted hover:border-accent hover:text-text flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed px-2 py-1.5 text-[10px] tracking-[0.12em] uppercase transition-colors"
      onClick={onEnable}
    >
      <PlusIcon className="text-base" />
      <span className="truncate">{nome}</span>
    </button>
  );
}
