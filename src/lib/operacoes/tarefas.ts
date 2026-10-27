import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, newId, schema } from "@/lib/db";
import { ESTADOS_TAREFA, type RegistroTarefa, type Tarefa } from "./modelo";

const prazo = z.string().refine((s) => s === "" || (/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s));
export const esquemaEdicao = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,100}$/).optional(), titulo: z.string().trim().min(3).max(240).optional(),
  detalhe: z.string().trim().max(2000).optional(), estado: z.enum(ESTADOS_TAREFA),
  nota: z.string().trim().max(2000), responsavel: z.string().trim().max(100), prazo,
  versao: z.number().int().min(0),
}).strict();
export type EdicaoTarefa = z.infer<typeof esquemaEdicao>;

function serializar(t: typeof schema.tarefasOperacao.$inferSelect): RegistroTarefa {
  return { id: t.id, titulo: t.titulo, detalhe: t.detalhe, origem: t.origem, desde: t.desde.toISOString(),
    tipo: t.tipo as Tarefa["tipo"], estado: t.estado as Tarefa["estado"], nota: t.nota, responsavel: t.responsavel,
    prazo: t.prazo, versao: t.versao };
}
export async function listarTarefas(): Promise<RegistroTarefa[]> {
  const db = await getDb();
  return (await db.select().from(schema.tarefasOperacao)).map(serializar);
}

/** Atualização otimista e auditoria na mesma transação. Notas privadas não entram nos logs. */
export async function salvarTarefa(usuario: string, edicao: EdicaoTarefa, sugeridas: Tarefa[]) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const tabela = schema.tarefasOperacao;
    const existente = edicao.id ? (await tx.select().from(tabela).where(eq(tabela.id, edicao.id)).limit(1))[0] : null;
    const sugerida = sugeridas.find((t) => t.id === edicao.id);
    if (edicao.id && !existente && !sugerida) return { tipo: "invalida" as const };
    if (!edicao.id && (!edicao.titulo || edicao.versao !== 0)) return { tipo: "invalida" as const };
    const origem = existente ? serializar(existente) : sugerida;
    const id = origem?.id ?? `manual-${newId()}`;
    const atualizadoEm = new Date();
    const manual = !origem || origem.tipo === "manual";
    const dados = { titulo: (manual ? edicao.titulo : undefined) ?? origem?.titulo ?? edicao.titulo!,
      detalhe: (manual ? edicao.detalhe : undefined) ?? origem?.detalhe ?? "",
      origem: origem?.origem ?? null, desde: new Date(origem?.desde ?? atualizadoEm), tipo: origem?.tipo ?? "manual",
      estado: edicao.estado, nota: edicao.nota, responsavel: edicao.responsavel, prazo: edicao.prazo,
      versao: edicao.versao + 1, atualizadoEm };
    const alteradas = edicao.versao === 0
      ? await tx.insert(tabela).values({ id, ...dados }).onConflictDoNothing().returning()
      : await tx.update(tabela).set(dados).where(and(eq(tabela.id, id), eq(tabela.versao, edicao.versao))).returning();
    if (!alteradas.length) return { tipo: "conflito" as const };
    await tx.insert(schema.auditLogs).values({ id: newId(), userId: usuario, action: "TAREFA_OPERACIONAL_ALTERADA",
      detail: JSON.stringify({ id, estado: edicao.estado, versao: dados.versao }), createdAt: atualizadoEm });
    return { tipo: "salva" as const, tarefa: serializar(alteradas[0]) };
  });
}
