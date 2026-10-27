import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { listarTarefas, salvarTarefa } from "@/lib/operacoes/tarefas";
import { tarefasSugeridas } from "@/lib/operacoes/modelo";
process.env.DATABASE_URL = "pglite-memory:";
const dados = { estado: "aberta" as const, nota: "Evidência privada de conferência", responsavel: "Operação", prazo: "2026-11-03", versao: 0 };

describe("persistência da fila manual", () => {
  it("cria, altera, reabre e audita sem copiar notas para a auditoria", { timeout: 60_000 }, async () => {
    const criada = await salvarTarefa("adm-teste", { ...dados, titulo: "Conferir edição da fonte" }, []);
    expect(criada.tipo).toBe("salva");
    if (criada.tipo !== "salva") throw new Error("Tarefa não criada");
    const id = criada.tarefa.id;
    expect((await listarTarefas()).find((t) => t.id === id)).toMatchObject({ nota: dados.nota, prazo: dados.prazo, versao: 1 });
    const encerrada = await salvarTarefa("adm-teste", { ...dados, id, titulo: "Conferir nova edição da fonte", estado: "concluida", versao: 1 }, []);
    expect(encerrada.tipo).toBe("salva");
    expect((await salvarTarefa("adm-teste", { ...dados, id, versao: 2 }, [])).tipo).toBe("salva");
    expect((await listarTarefas()).find((t) => t.id === id)?.titulo).toBe("Conferir nova edição da fonte");
    const db = await getDb();
    const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.userId, "adm-teste"));
    expect(logs).toHaveLength(3);
    expect(JSON.stringify(logs)).not.toContain(dados.nota);
  });
  it("impede sobrescrita concorrente e rejeita tarefa automática forjada", async () => {
    const sugeridas = tarefasSugeridas(null);
    const id = sugeridas[0].id;
    expect((await salvarTarefa("adm", { ...dados, id, titulo: "Tentativa de alterar origem" }, sugeridas)).tipo).toBe("salva");
    expect((await listarTarefas()).find((t) => t.id === id)?.titulo).toBe(sugeridas[0].titulo);
    expect((await salvarTarefa("adm", { ...dados, id }, sugeridas)).tipo).toBe("conflito");
    const resultados = await Promise.all([1, 2].map(() => salvarTarefa("adm", { ...dados, id, versao: 1 }, sugeridas)));
    expect(resultados.map((r) => r.tipo).sort()).toEqual(["conflito", "salva"]);
    expect((await salvarTarefa("adm", { ...dados, id: "execucao-forjada" }, sugeridas)).tipo).toBe("invalida");
  });
});
