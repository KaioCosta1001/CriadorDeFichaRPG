import { z } from "zod";

import { SCHEMA_VERSION } from "@/config/constants";

import { IdSchema, TimestampSchema } from "./common";

/**
 * Documento que falhou na validação e foi isolado.
 *
 * A seção 5.9 exige: não quebrar o app, avisar o usuário e oferecer
 * exportar o bruto ou descartar. Guardar o TEXTO CRU (e não o objeto
 * parseado) é justamente o que torna "exportar o bruto" possível — se
 * guardássemos o objeto já parseado, o dado que o usuário quer recuperar
 * estaría perdido.
 */
export const QuarantinedDocumentSchema = z.object({
  id: IdSchema,
  /** Chave de storage de onde o documento veio (ajuda a depurar). */
  sourceKey: z.string().min(1).max(200),
  /** Resumo do que a ficha era, se deu para extrair algo. */
  title: z.string().max(120).nullable(),
  /** Versão declarada no documento (pode ser `null` se nem isso tinha). */
  declaredSchemaVersion: z.number().int().nullable(),
  /** Motivo da rejeição, em texto legível. */
  reason: z.string().min(1).max(2000),
  /** Caminho do primeiro campo inválido, quando o Zod informa. */
  path: z.string().max(200).nullable(),
  /** O documento EXATO como estava no storage. Nunca executado. */
  raw: z.string().max(2_000_000),
  quarantinedAt: TimestampSchema,
  /** Versão do schema em que tentamos validar. */
  schemaVersion: z.number().int().min(1),
});

export type QuarantinedDocument = z.infer<typeof QuarantinedDocumentSchema>;

export const QuarantineIndexSchema = z.array(
  QuarantinedDocumentSchema.pick({
    id: true,
    sourceKey: true,
    title: true,
    declaredSchemaVersion: true,
    reason: true,
    path: true,
    quarantinedAt: true,
    schemaVersion: true,
  }),
);

/** Lista de metadados de Quarentena (sem o texto bruto, que é pesado). */
export const QuarantineSummary = QuarantinedDocumentSchema.pick({
  id: true,
  sourceKey: true,
  title: true,
  declaredSchemaVersion: true,
  reason: true,
  path: true,
  quarantinedAt: true,
  schemaVersion: true,
});

export type QuarantineSummary = z.infer<typeof QuarantineSummary>;

/** Versão do schema usada ao validar documentos recém-criados. */
export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;
