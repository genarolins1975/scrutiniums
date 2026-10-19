/**
 * Leitura da medição de uso para o painel de administração (server-only).
 * Janela: os últimos 30 dias civis no fuso de Brasília, hoje incluído,
 * a mesma das demais séries do painel (DIAS_SERIE em adminStats.ts).
 */
import { and, gte, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { diaDeBrasilia, usoAnonimoAtivo } from "./coleta";
import { FORA_DOS_OBSERVATORIOS, nomeDoGrupo } from "./rotas";

export const DIAS_USO = 30;

export type UsoPorPagina = {
  rota: string;
  observatorio: string;
  nomeObservatorio: string;
  comConta: number;
  semConta: number;
};

export type UsoPorObservatorio = {
  observatorio: string;
  nome: string;
  comConta: number;
  semConta: number;
  paginas: number;
};

export type UsoDoPeriodo = {
  /** Primeiro e último dia da janela, AAAA-MM-DD, fuso de Brasília. */
  inicio: string;
  fim: string;
  dias: number;
  /** Primeiro dia com qualquer registro na tabela (null: nenhum registro ainda). */
  primeiroRegistro: string | null;
  /** Estado atual da contagem de visitantes sem conta (USO_ANONIMO_ATIVO). */
  anonimoAtivo: boolean;
  /** Há números de visitantes sem conta na janela (contagem ligada agora ou em parte do período). */
  semContaMedido: boolean;
  /** Os seis observatórios, na ordem do registro, e o grupo fora deles por último. */
  porObservatorio: UsoPorObservatorio[];
  /** Páginas com visita na janela, da mais para a menos visitada. */
  porPagina: UsoPorPagina[];
};

export async function getUsoDoPeriodo(agora = new Date(), env: Record<string, string | undefined> = process.env): Promise<UsoDoPeriodo> {
  const db = await getDb();
  const t = schema.usoPaginasDia;
  const fim = diaDeBrasilia(agora);
  // meio-dia evita que a troca de horário ou a hora do dia desloque o primeiro dia da janela
  const inicio = diaDeBrasilia(new Date(Date.parse(`${fim}T12:00:00-03:00`) - (DIAS_USO - 1) * 86_400_000));

  const [linhas, primeiro] = await Promise.all([
    db
      .select({
        rota: t.rota,
        observatorio: sql<string>`max(${t.observatorio})`,
        comConta: t.comConta,
        visitas: sql<string>`sum(${t.visitas})`,
      })
      .from(t)
      .where(and(gte(t.dia, inicio), lte(t.dia, fim)))
      .groupBy(t.rota, t.comConta),
    db.select({ dia: sql<string | null>`min(${t.dia})` }).from(t),
  ]);

  const paginas = new Map<string, UsoPorPagina>();
  let haSemConta = false;
  for (const l of linhas) {
    const p = paginas.get(l.rota) ?? {
      rota: l.rota,
      observatorio: l.observatorio,
      nomeObservatorio: nomeDoGrupo(l.observatorio),
      comConta: 0,
      semConta: 0,
    };
    const n = Number(l.visitas);
    if (l.comConta) p.comConta += n;
    else {
      p.semConta += n;
      if (n > 0) haSemConta = true;
    }
    paginas.set(l.rota, p);
  }
  const porPagina = Array.from(paginas.values()).sort(
    (a, b) => b.comConta + b.semConta - (a.comConta + a.semConta) || a.rota.localeCompare(b.rota),
  );

  const grupos = [...OBSERVATORIOS.map((o) => o.id as string), FORA_DOS_OBSERVATORIOS];
  const porObservatorio = grupos.map((g): UsoPorObservatorio => {
    const doGrupo = porPagina.filter((p) => p.observatorio === g);
    return {
      observatorio: g,
      nome: nomeDoGrupo(g),
      comConta: doGrupo.reduce((s, p) => s + p.comConta, 0),
      semConta: doGrupo.reduce((s, p) => s + p.semConta, 0),
      paginas: doGrupo.length,
    };
  });

  const anonimoAtivo = usoAnonimoAtivo(env);
  const primeiroDia = primeiro[0]?.dia ?? null;
  return {
    inicio,
    fim,
    dias: DIAS_USO,
    primeiroRegistro: primeiroDia ? String(primeiroDia).slice(0, 10) : null,
    anonimoAtivo,
    semContaMedido: anonimoAtivo || haSemConta,
    porObservatorio,
    porPagina,
  };
}
