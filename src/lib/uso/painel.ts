/**
 * Leitura da medição de uso para o painel de administração (server-only).
 * Janela: os últimos 30 dias civis no fuso de Brasília, hoje incluído,
 * a mesma das demais séries do painel (DIAS_SERIE em adminStats.ts).
 */
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { diaDeBrasilia, usoAnonimoAtivo } from "./coleta";
import { FORA_DOS_OBSERVATORIOS, nomeDoGrupo } from "./rotas";
import { buscar } from "@/lib/busca/buscar";
import { indiceDeBusca } from "@/lib/busca/indice";
import { FORA_DO_INDICE } from "./busca";

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
  /**
   * Primeiro dia com visita sem conta registrada (null: nenhuma). A contagem sem conta pode ser ligada no meio da janela:
   * os dias anteriores a este não foram medidos, e o painel diz isso em vez de somá-los como zero.
   */
  primeiroSemConta: string | null;
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

  const [linhas, primeiro, primeiroSem] = await Promise.all([
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
    db.select({ dia: sql<string | null>`min(${t.dia})` }).from(t).where(eq(t.comConta, false)),
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
  const primeiroDiaSem = primeiroSem[0]?.dia ?? null;
  return {
    inicio,
    fim,
    dias: DIAS_USO,
    primeiroRegistro: primeiroDia ? String(primeiroDia).slice(0, 10) : null,
    anonimoAtivo,
    semContaMedido: anonimoAtivo || haSemConta,
    primeiroSemConta: primeiroDiaSem ? String(primeiroDiaSem).slice(0, 10) : null,
    porObservatorio,
    porPagina,
  };
}

export type TermoBuscado = { termo: string; comConta: number; semConta: number; resultados: number };

export type BuscasDoPeriodo = {
  inicio: string;
  fim: string;
  anonimoAtivo: boolean;
  /** Primeiro dia com qualquer busca registrada (null: nenhuma ainda). */
  primeiroRegistro: string | null;
  total: number;
  /** Buscas cujo texto não foi gravado (fora do vocabulário do índice ou com cara de dado pessoal; src/lib/uso/busca.ts). */
  foraDoIndice: number;
  /**
   * Termos da janela, do mais para o menos buscado; `resultados` é o que a busca devolve hoje para o termo, com o resultado
   * parcial contado como zero: nenhum destino tem todas as palavras, e é isso que o quadro "Buscas sem resultado" precisa ver.
   */
  termos: TermoBuscado[];
};

/**
 * Termos buscados nos últimos 30 dias (uso_busca_dia), com o número de resultados que o índice atual devolve a cada um: um
 * termo sem resultado é um destino que o leitor procura e a plataforma não tem, ou um sinônimo que falta (sinonimos.json).
 */
export async function getBuscasDoPeriodo(agora = new Date(), env: Record<string, string | undefined> = process.env): Promise<BuscasDoPeriodo> {
  const db = await getDb();
  const t = schema.usoBuscaDia;
  const fim = diaDeBrasilia(agora);
  const inicio = diaDeBrasilia(new Date(Date.parse(`${fim}T12:00:00-03:00`) - (DIAS_USO - 1) * 86_400_000));
  const [linhas, primeiro] = await Promise.all([
    db
      .select({ termo: t.termo, comConta: t.comConta, buscas: sql<string>`sum(${t.buscas})` })
      .from(t)
      .where(and(gte(t.dia, inicio), lte(t.dia, fim)))
      .groupBy(t.termo, t.comConta),
    db.select({ dia: sql<string | null>`min(${t.dia})` }).from(t),
  ]);
  const porTermo = new Map<string, TermoBuscado>();
  let foraDoIndice = 0;
  for (const l of linhas) {
    if (l.termo === FORA_DO_INDICE) {
      foraDoIndice += Number(l.buscas);
      continue;
    }
    const x = porTermo.get(l.termo) ?? { termo: l.termo, comConta: 0, semConta: 0, resultados: 0 };
    if (l.comConta) x.comConta += Number(l.buscas);
    else x.semConta += Number(l.buscas);
    porTermo.set(l.termo, x);
  }
  const indice = indiceDeBusca();
  const termos = Array.from(porTermo.values())
    .map((x) => {
      const r = buscar(indice, x.termo);
      return { ...x, resultados: r.parcial ? 0 : r.resultados.length };
    })
    .sort((a, b) => b.comConta + b.semConta - (a.comConta + a.semConta) || a.termo.localeCompare(b.termo));
  const primeiroDia = primeiro[0]?.dia ?? null;
  return {
    inicio,
    fim,
    anonimoAtivo: usoAnonimoAtivo(env),
    primeiroRegistro: primeiroDia ? String(primeiroDia).slice(0, 10) : null,
    total: termos.reduce((s, x) => s + x.comConta + x.semConta, 0) + foraDoIndice,
    foraDoIndice,
    termos,
  };
}
