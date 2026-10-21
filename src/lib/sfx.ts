/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ÁUDIO — PONTO DE EXTENSÃO (DESLIGADO)                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A direção visual pediu "ponto de extensão para áudio, sem implementar
 * agora". Este arquivo é esse ponto: a assinatura já está definida, a
 * configuração existe (mas DESLIGADA) e nada é tocado.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE NÃO ESTÁ AQUI, DE PROPÓSITO
 *  - Nenhum arquivo de áudio.
 *  - Nenhuma chamada a `new Audio()`.
 *  - A configuração "Efeitos sonoros" aparece no Dialog de Configurações
 *    marcada como "em breve", e não como um interruptor que não faz nada.
 *
 * QUANDO FOR IMPLEMENTADO
 *  1. Adicione os arquivos em `public/sfx/` (ou gere via WebAudio).
 *  2. Preencha `SFX_LIBRARY` com as URLs.
 *  3. Grave `soundEnabled` em `SheetSettingsSchema` — hoje o campo NÃO
 *     existe, para não sobrar uma opção morta na tela.
 *  4. Respeite `prefers-reduced-motion`? Não: áudio tem preferência própria
 *     (`prefers-reduced-transparency` não existe). O que vale é NÃO
 *     disparar som sem interação do usuário.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Sons previstos. A chave é o que o app chamaria. */
export type SfxName = "dice-roll" | "dice-result" | "coin" | "click" | "error";

/** Catálogo de sons. Vazio de propósito — ver o aviso acima. */
export const SFX_LIBRARY: Partial<Record<SfxName, string>> = {};

/**
 * Toca um efeito sonoro.
 *
 * Hoje é uma no-op documentada. A assinatura já é a definitiva, então os
 * componentes já podem chamar `play("dice-roll")` sem precisar mudar depois.
 */
export function play(_name: SfxName): void {
  const url = SFX_LIBRARY[_name];
  if (!url) return;
  // A implementação entra aqui quando houver arquivos de áudio.
  void url;
}

/** `true` quando há algum som disponível. Usado para exibir "em breve". */
export const SFX_AVAILABLE = Object.keys(SFX_LIBRARY).length > 0;
