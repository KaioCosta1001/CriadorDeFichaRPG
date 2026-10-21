/**
 * Acesso SEGURO ao `localStorage`.
 *
 * Por que este arquivo existe (seção 6 do projeto — robustez):
 *  - No servidor (SSR) não existe `window`. Todo acesso é protegido.
 *  - O acesso pode lançar: modo privado/anônimo, cota estourada, JSON inválido,
 *    extensão bloqueando storage. Tudo é engolido e registrado.
 *
 * ESTE MÓDULO É PONTO DE TROCA localStorage -> MongoDB.
 * Quando o backend mudar, substitua APENAS o corpo das funções abaixo por
 * chamadas ao repositório; nada mais no app precisa mudar.
 */

/** Verdadeiro apenas no navegador, com storage realmente disponível. */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Alguns navegadores lançam ao ACESSAR `window.localStorage` em modo privado.
    return window.localStorage !== null;
  } catch {
    return false;
  }
}

/**
 * Erro de cota do navegador.
 * Detectar isso separadamente permite avisar o usuário em vez de engolir.
 */
export function isQuotaExceeded(error: unknown): boolean {
  // NÃO usamos `instanceof Error` de propósito: `DOMException` — que é
  // exatamente o que o navegador lança ao estourar a cota — não é subclasse
  // de `Error` em todos os ambientes (o jsdom, por exemplo, não a usa). Um
  // `instanceof Error` aqui faria a detecção de cota falhar silenciosamente.
  if (typeof error !== "object" || error === null) return false;

  const name = (error as { name?: unknown }).name;
  if (name === "QuotaExceededError") return true;
  if (name === "NS_ERROR_DOM_QUOTA_REACHED") return true;

  // DOMException legada do Firefox expõe um `code` numérico em vez de `name`
  // descritivo. O cast é seguro: lemos apenas campos opcionais.
  const legacyCode = (error as { code?: unknown }).code;
  return legacyCode === 22 || legacyCode === 1014;
}

/** Lê uma chave. Devolve `null` em qualquer falha (SSR, storage, JSON). */
export function safeGetItem(key: string): string | null {
  if (!isStorageAvailable()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`[storage] Falha ao ler "${key}".`, error);
    return null;
  }
}

/**
 * Escreve uma chave.
 * Devolve `true` em sucesso e `false` em falha — a UI decide se avisa.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (isQuotaExceeded(error)) {
      console.error(
        `[storage] Cota estourada ao salvar "${key}". Considere remover fotos grandes.`,
      );
    } else {
      console.warn(`[storage] Falha ao gravar "${key}".`, error);
    }
    return false;
  }
}

/** Remove uma chave. Devolve `true` em sucesso. */
export function safeRemoveItem(key: string): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[storage] Falha ao remover "${key}".`, error);
    return false;
  }
}

/**
 * Lê e valida JSON com o schema Zod informado.
 * Dado inválido NÃO lança: devolve `null` e deixa a camada de cima decidir
 * (normalmente: mover para a quarentena e avisar o usuário).
 */
export function safeGetJson<T>(
  key: string,
  parse: (raw: unknown) => T | null,
): T | null {
  const raw = safeGetItem(key);
  if (raw === null) return null;
  try {
    return parse(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn(`[storage] JSON inválido em "${key}".`, error);
    return null;
  }
}
