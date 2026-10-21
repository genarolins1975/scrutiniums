/**
 * Medição de uso agregada (server-only). Documento: docs/observatorios/MEDICAO_DE_USO.md.
 *
 * Cada visita a uma página soma 1 no contador do dia, do modelo da rota e da
 * presença de conta (upsert em uso_paginas_dia). Nada que identifique pessoa é
 * gravado: nem id de usuário, nem IP, nem navegador, nem cookie novo, nem
 * parâmetro de endereço.
 *
 * - Com sessão: contagem ligada (não associa a visita à conta).
 * - Sem sessão: contagem pronta e DESLIGADA, até o dono decidir a base legal;
 *   liga com USO_ANONIMO_ATIVO=1 no ambiente do servidor.
 * - Do Not Track ou Global Privacy Control: nunca conta (sinais.ts).
 */
import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { grupoDaRota, normalizarRota } from "./rotas";
import { cabecalhosRecusamRastreio } from "./sinais";

export const VARIAVEL_USO_ANONIMO = "USO_ANONIMO_ATIVO";

/** A contagem de visitantes sem conta só liga com USO_ANONIMO_ATIVO=1 (padrão: desligada). */
export function usoAnonimoAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env[VARIAVEL_USO_ANONIMO]?.trim() === "1";
}

const diaFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/** Dia civil no fuso de Brasília, AAAA-MM-DD. */
export function diaDeBrasilia(data: Date): string {
  return diaFmt.format(data);
}

export type MotivoSemContagem = "nao-rastrear" | "anonimo-desligado" | "rota-recusada";
export type DecisaoDeColeta = { contar: true; rota: string } | { contar: false; motivo: MotivoSemContagem };

type Contexto = { comConta: boolean; cabecalhos: Pick<Headers, "get">; env?: Record<string, string | undefined> };

/** Motivo para descartar a visita antes de ler IP ou corpo: recusa de rastreio ou visitante sem conta com a contagem anônima desligada. */
export function recusaAntesDoCaminho(ctx: Contexto): MotivoSemContagem | null {
  if (cabecalhosRecusamRastreio(ctx.cabecalhos)) return "nao-rastrear";
  if (!ctx.comConta && !usoAnonimoAtivo(ctx.env)) return "anonimo-desligado";
  return null;
}

/** Decide, sem tocar no banco, se a visita entra na contagem e com qual rota. */
export function decidirColeta(entrada: Contexto & { caminho: unknown }): DecisaoDeColeta {
  const recusa = recusaAntesDoCaminho(entrada);
  if (recusa) return { contar: false, motivo: recusa };
  const rota = normalizarRota(entrada.caminho);
  if (!rota) return { contar: false, motivo: "rota-recusada" };
  return { contar: true, rota };
}

/**
 * Soma uma visita ao contador agregado. A rota precisa já estar normalizada
 * (decidirColeta); rota fora da lista é recusada aqui também. Falha de banco
 * nunca derruba a página: devolve false.
 */
export async function registrarVisita(rota: string, comConta: boolean, agora = new Date()): Promise<boolean> {
  if (normalizarRota(rota) !== rota) return false;
  try {
    const db = await getDb();
    const t = schema.usoPaginasDia;
    await db
      .insert(t)
      .values({ dia: diaDeBrasilia(agora), rota, observatorio: grupoDaRota(rota), comConta, visitas: 1 })
      .onConflictDoUpdate({ target: [t.dia, t.rota, t.comConta], set: { visitas: sql`${t.visitas} + 1` } });
    return true;
  } catch {
    return false;
  }
}

// O sal nasce com o processo e nunca sai da memória: a chave do limite de taxa
// não guarda o IP em claro e não é comparável entre processos ou reinícios.
const globalForSal = globalThis as unknown as { __usoSal?: Buffer };
const sal = (globalForSal.__usoSal ??= randomBytes(16));

/** Chave do limite de taxa por IP, só em memória: hash salgado, nunca gravado nem registrado em log. */
export function chaveDeTaxa(ip: string): string {
  return `uso:ip:${createHash("sha256").update(sal).update(ip).digest("hex").slice(0, 32)}`;
}
