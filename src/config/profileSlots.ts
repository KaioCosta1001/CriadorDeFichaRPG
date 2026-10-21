/**
 * Slots de posição fixa do bloco de Perfil.
 *
 * O Perfil tem QUATRO posições: canto superior esquerdo, superior direito,
 * inferior esquerdo e inferior direito. Cada posição é um SLOT que pode estar
 * LIGADO ou DESLIGADO, e cujo rótulo ("CA", "PV", "Sanidade"...) é editável
 * pelo usuário.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  O DESENHO DO ADENDO §2                                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 *   ┌───────────────────────────────┐
 *   │ [header: nome ................ ⚙ ] │   ← engrenagem no HEADER
 *   │ ┌────┐                  (extra: │
 *   │ │ CA │                  desligado│
 *   │ └────┘                  por padrão)│
 *   │            ╭───────╮          │
 *   │            │ FOTO  │          │   ← foto NO CENTRO
 *   │            ╰───────╯          │
 *   │ ┌──────┐               ┌────┐ │
 *   │ │SANID.│               │ PV │ │
 *   │ └──────┘               └────┘ │
 *   └───────────────────────────────┘
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE PV MUDOU DE CANTO
 *
 * O prompt principal punha PV no superior direito. O adendo §2 substitui isso:
 * PV vai para o INFERIOR DIREITO, ao lado da Sanidade.
 *
 * A lógica é de leitura: PV e Sanidade são os dois números que o jogador
 * consulta o tempo todo, e o par na base fica perto do polegar e longe do
 * cursor da foto. Ficando separados (esquerda e direita), eles também não
 * competem visualmente — o que a §2 pede ao dizer que a Sanidade é
 * "provisória".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE SANIDADE NASCE DESLIGADA
 *
 * Porque nem toda ficha tem Sanidade. D&D não tem; Call of Cthulhu tem, e é
 * o campo mais consultado do sistema. Deixar ligado por padrão mostraria um
 * orbe a mais em toda ficha de D&D, e um orbe vazio ocupa o mesmo espaço que
 * um preenchido — o usuário leria "falta preencher" onde não há nada a
 * preencher.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * COMO ADICIONAR UM NOVO SLOT
 * 1. Acrescente a posição em `PROFILE_SLOT_POSITIONS` (aqui e no schema Zod).
 * 2. Acrescente uma entrada em `DEFAULT_PROFILE_SLOTS`.
 * Nada mais precisa mudar: o layout do bloco de Perfil lê esta lista.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * OS `id` SÃO ESTÁVEIS E NUNCA MUDAM
 *
 * É o `id` que preserva o rótulo e o valor digitados pelo usuário entre
 * versões do app. Renomear um `id` aqui apaga o que a pessoa escreveu.
 *
 * Por isso o `migrateV3toV4` REPOSICIONA os slots em vez de recriá-los: o
 * mesmo `id`, com o mesmo rótulo e o mesmo valor, muda de canto.
 */

/** Posições possíveis de um slot no bloco de Perfil. */
export const PROFILE_SLOT_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type ProfileSlotPosition = (typeof PROFILE_SLOT_POSITIONS)[number];

/**
 * Estado inicial dos slots de uma ficha nova.
 *
 * `enabled: true`  = o slot aparece desde o começo.
 * `enabled: false` = o slot existe na estrutura mas fica oculto, e aparece
 *                    como "fantasma" no Editar Geral para poder ser ligado.
 *
 * `max` é APENAS visual (preenchimento do orbe). Ver `ProfileSlotSchema.max`.
 */
export const DEFAULT_PROFILE_SLOTS: readonly {
  id: string;
  position: ProfileSlotPosition;
  enabled: boolean;
  label: string;
  max: number | null;
}[] = [
  {
    id: "slot-ac",
    position: "top-left",
    enabled: true,
    label: "CA",
    max: null,
  },
  {
    // Slot EXTRA, reservado para um quarto valor. Sem rótulo e desligado:
    // quem quiser um "Fôlego" ou um "Foco" liga e nomeia; quem não quiser,
    // nunca vê.
    id: "slot-extra",
    position: "top-right",
    enabled: false,
    label: "",
    max: null,
  },
  {
    // Nome provisório, editável como os demais — e LIGÁVEL/DESLIGÁVEL no
    // Editar Geral, porque "Sanidade" só faz sentido em parte dos sistemas.
    id: "slot-sanidade",
    position: "bottom-left",
    enabled: false,
    label: "Sanidade",
    max: null,
  },
  {
    id: "slot-pv",
    position: "bottom-right",
    enabled: true,
    label: "PV",
    max: null,
  },
];

/**
 * Onde cada `id` ficava ANTES do adendo §2.
 *
 * Usado pela migração para decidir o que reposicionar: um slot só muda de
 * canto se estiver exatamente onde o padrão antigo punha. Um slot que o usuário
 * (ou um modelo de sistema) colocou em outro lugar é deixado em paz.
 */
export const LEGACY_PROFILE_SLOT_POSITIONS: Readonly<Record<string, string>> = {
  "slot-ac": "top-left",
  "slot-pv": "top-right",
  "slot-extra": "bottom-left",
};

/** Rótulos sugeridos para os campos sem nome (usados no D&D e Old Dragon). */
export const PROFILE_SLOT_SUGGESTED_LABELS = [
  "Sanidade",
  "Fôlego",
  "Foco",
  "Mana",
] as const;
