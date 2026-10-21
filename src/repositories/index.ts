import { LocalStorageSheetRepository } from "./localStorageSheetRepository";
import type { SheetRepository } from "./types";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PONTO ÚNICO DE INJEÇÃO DA CAMADA DE DADOS                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Este é o ÚNICO lugar do projeto que decide ONDE os dados ficam.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🚀 COMO TROCAR LOCALSTORAGE POR MONGODB (passo a passo)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. CRIE O ARQUITRO `src/repositories/mongoSheetRepository.ts`:
 *
 *      export class MongoSheetRepository implements SheetRepository {
 *        constructor(private readonly http: HttpLike) {}
 *        // mesma assinatura de LocalStorageSheetRepository —
 *        // todos os métodos continuam ASSÍNCRONOS
 *      }
 *
 * 2. CRIE AS ROUTE HANDLERS do Next, em `src/app/api/`:
 *      src/app/api/sheets/route.ts             → GET (listar), POST (criar)
 *      src/app/api/sheets/[id]/route.ts        → GET, PUT, DELETE
 *      src/app/api/sheets/[id]/duplicate/route.ts
 *      src/app/api/settings/route.ts
 *
 * 3. TROQUE UMA LINHA AQUI, ABAIXO:
 *
 *      export const sheetRepository: SheetRepository =
 *        new MongoSheetRepository(fetchAdapter);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * É isso. Nenhum componente, hook, store ou regra de business muda.
 *
 * Por que já é possível: `SheetRepository` (em `types.ts`) é 100% assíncrona
 * e não expõe nenhum detalhe de storage. Nada acima importa `localStorage`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTA: `sheetRepository` é uma instância única (criada uma vez no módulo).
 * O estado por usuário NÃO mora aqui — cada documento já carrega `ownerId`,
 * reservado para o multiusuário futuro. Quando houver login, este arquivo
 * passa a passar o `ownerId` atual para o repositório, sem mudar a interface.
 */

/** Implementação ativa. Troque ESTA LINHA para migrar de banco. */
export const sheetRepository: SheetRepository =
  new LocalStorageSheetRepository();

export type { SheetRepository } from "./types";
export {
  buildExportFileName,
  LocalStorageSheetRepository,
} from "./localStorageSheetRepository";
export { ImportError, RepositoryError } from "./types";
