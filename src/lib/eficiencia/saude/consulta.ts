import type { CapitalPainel, Ponto, PontoSerie, RefGrupo } from "../consulta";
import { csv, mediana } from "../consulta";
import { GRUPOS_REF, type DadosSaude } from "./payload";
import { MEDIDAS_SAUDE, type MedidaSaude, type MedidaSaudeId, type Moeda } from "./medidas";
import type { ReferenciaExternaSaude, StatusDado } from "./tipos";

export { csv, mediana };
export type { Ponto, PontoSerie, CapitalPainel, RefGrupo };

/**
 * Consulta do módulo Saúde: seleciona, ordena e monta linhas a partir da gold já calculada no pipeline. Nenhum cálculo contábil acontece aqui:
 * as referências do grupo (mediana, quartis, razão agregada) são as do pipeline, e a elegibilidade é a das observações.
 */

const SEM_OBS: Ponto = { valor: null, status: "AUSENTE_NA_COLETA", nota: "Sem registro para este recorte", notaMaterial: true, participacao: null, elegivel: false, situacao: null, motivo: null, quebraSerie: false };

export type PontoComCalculo = Ponto & { numerador: number | null; denominador: number | null; minimoPct: number | null };
const VAZIO: PontoComCalculo = { ...SEM_OBS, numerador: null, denominador: null, minimoPct: null };

export class IndiceSaude {
  private mapa = new Map<string, PontoComCalculo>();
  private refs = new Map<string, RefGrupo>();
  private anosPorChave = new Map<string, Set<number>>();
  constructor(readonly d: DadosSaude) {
    for (const r of d.refs) {
      const [i, k, a, g, noGrupo, comValor, n, media, med, minimo, maximo, q1, q3, qe, sn, sd, razao, cmin, cmax] = r;
      this.refs.set(IndiceSaude.chaveRef(d.indicadores[i], k < 0 ? null : d.componentes[k], a, GRUPOS_REF[g]), {
        noGrupo, comValor, n, media, mediana: med, minimo, maximo, q1, q3, quartisExibicao: qe === 1, somaNumerador: sn, somaDenominador: sd, razaoAgregada: razao,
        capitaisMinimo: cmin.map((c) => d.capitais[c]), capitaisMaximo: cmax.map((c) => d.capitais[c]),
      });
    }
    for (const o of d.obs) {
      const [i, c, a, k, v, s, n, p, eleg, mat, sit, mot, qb, num, den, extra] = o;
      const ind = d.indicadores[i];
      const comp = k < 0 ? null : d.componentes[k];
      this.mapa.set(IndiceSaude.chave(ind, d.capitais[c].cod, a, comp), {
        valor: v, status: d.status[s], nota: n < 0 ? null : d.notas[n], notaMaterial: mat === 1, participacao: p, elegivel: eleg === 1,
        situacao: sit < 0 ? null : d.situacoes[sit], motivo: mot < 0 ? null : d.notas[mot], quebraSerie: qb === 1, numerador: num, denominador: den, minimoPct: extra,
      });
      const ck = `${ind}|${comp ?? ""}`;
      if (!this.anosPorChave.has(ck)) this.anosPorChave.set(ck, new Set());
      this.anosPorChave.get(ck)!.add(a);
    }
  }
  static chave(ind: string, cod: number, ano: number, comp: string | null) {
    return `${ind}|${cod}|${ano}|${comp ?? ""}`;
  }
  static chaveRef(ind: string, comp: string | null, ano: number, grupo: string) {
    return `${ind}|${comp ?? ""}|${ano}|${grupo}`;
  }
  ponto(ind: string, cod: number, ano: number, comp: string | null): PontoComCalculo {
    return this.mapa.get(IndiceSaude.chave(ind, cod, ano, comp)) ?? VAZIO;
  }
  tem(ind: string, cod: number, ano: number, comp: string | null) {
    return this.mapa.has(IndiceSaude.chave(ind, cod, ano, comp));
  }
  referencia(ind: string, comp: string | null, ano: number, grupo: string): RefGrupo | null {
    return this.refs.get(IndiceSaude.chaveRef(ind, comp, ano, grupo)) ?? null;
  }
  anos(ind: string, comp: string | null): number[] {
    return Array.from(this.anosPorChave.get(`${ind}|${comp ?? ""}`) ?? []).sort((a, b) => a - b);
  }
  externas(ind: string, comp: string | null, ano: number): ReferenciaExternaSaude[] {
    return this.d.externas.filter((e) => e.indicador === ind && (e.componente === comp || e.componente === null) && (e.ano === ano || e.ano === null));
  }
}

export const ROTULO_ESTADO: Record<StatusDado, string> = {
  OBSERVADO: "Observado",
  NAO_APLICAVEL: "Não aplicável",
  NAO_DIVULGADO: "Não divulgado pela fonte",
  AUSENTE_NA_COLETA: "Ausente na coleta",
  DESATUALIZADO: "Desatualizado",
  INCONSISTENTE: "Inconsistente",
  NAO_COMPARAVEL: "Fora da comparação",
  INCOMPLETO: "Incompleto",
  INDISPONIVEL_TEMPORARIAMENTE: "Indisponível temporariamente",
};

export type Opcoes = { moeda: Moeda; denominador: "ripsa" | "obee" };

export const componenteDe = (m: MedidaSaude, o: Opcoes) => m.componente(o.moeda, o.denominador);

export function anosDaMedida(ix: IndiceSaude, m: MedidaSaude, o: Opcoes): number[] {
  return ix.anos(m.indicador, componenteDe(m, o));
}

export type ItemComparacao = { cap: CapitalPainel; valor: number; ponto: PontoComCalculo };
export type ExcluidoComparacao = { cap: CapitalPainel; status: StatusDado; motivo: string; comValor: boolean; ponto: PontoComCalculo };
export type Ordem = "alfabetica" | "valor" | "valor_desc";
export type Grupo = "todas" | "regiao";
export type Comparacao = { incluidas: ItemComparacao[]; excluidas: ExcluidoComparacao[]; ref: RefGrupo | null; noGrupo: number };

/** Mesma regra para gráfico, resumo, tabela e CSV: entram as capitais do grupo com valor observado e elegível. */
export function comparar(ix: IndiceSaude, m: MedidaSaude, ano: number, o: Opcoes, grupo: Grupo, destaque: CapitalPainel | null, ordem: Ordem): Comparacao {
  const comp = componenteDe(m, o);
  const regiao = grupo === "regiao" && destaque ? destaque.regiao : null;
  const caps = ix.d.capitais.filter((c) => (regiao ? c.regiao === regiao : true));
  const incluidas: ItemComparacao[] = [];
  const excluidas: ExcluidoComparacao[] = [];
  for (const cap of caps) {
    const ponto = ix.ponto(m.indicador, cap.cod, ano, comp);
    if (ponto.status === "OBSERVADO" && ponto.valor !== null && ponto.elegivel) incluidas.push({ cap, valor: ponto.valor, ponto });
    else excluidas.push({ cap, status: ponto.status, comValor: ponto.status === "OBSERVADO" && ponto.valor !== null, motivo: ponto.motivo ?? ponto.nota ?? "Sem valor para este recorte.", ponto });
  }
  const porNome = (a: ItemComparacao, b: ItemComparacao) => a.cap.nome.localeCompare(b.cap.nome, "pt-BR");
  incluidas.sort(ordem === "valor" ? (a, b) => a.valor - b.valor || porNome(a, b) : ordem === "valor_desc" ? (a, b) => b.valor - a.valor || porNome(a, b) : porNome);
  excluidas.sort((a, b) => a.cap.nome.localeCompare(b.cap.nome, "pt-BR"));
  const ref = ix.referencia(m.indicador, comp, ano, regiao ?? "todas");
  return { incluidas, excluidas, ref, noGrupo: caps.length };
}

/** Série de uma capital: um ponto por ano, sem ponte entre anos sem valor. */
export function serie(ix: IndiceSaude, m: MedidaSaude, cod: number, o: Opcoes): PontoSerie[] {
  const comp = componenteDe(m, o);
  return anosDaMedida(ix, m, o).map((ano) => ({ ano, ...ix.ponto(m.indicador, cod, ano, comp) }));
}

export type PontoMediana = { ano: number; valor: number | null; n: number; quebraSerie: boolean };

/** Mediana do grupo em cada ano, com o número de capitais na comparação: o grupo pode mudar de um ano para o outro. */
export function serieDaMediana(ix: IndiceSaude, m: MedidaSaude, o: Opcoes, regiao: string | null): PontoMediana[] {
  const comp = componenteDe(m, o);
  return anosDaMedida(ix, m, o).map((ano) => {
    const r = ix.referencia(m.indicador, comp, ano, regiao ?? "todas");
    const quebra = ix.d.capitais.some((c) => ix.ponto(m.indicador, c.cod, ano, comp).quebraSerie);
    return { ano, valor: r?.mediana ?? null, n: r?.n ?? 0, quebraSerie: quebra };
  });
}

export type LinhaComposicao = { chave: string; rotulo: string; valor: number; participacao: number };

/** Composição de uma capital e um ano: categorias completas, na ordem informada, só se todas têm valor observado. */
export function composicao(ix: IndiceSaude, indicador: string, cod: number, ano: number, categorias: [string, string][]): { linhas: LinhaComposicao[]; pontoTotal: PontoComCalculo | null; indisponivel: string | null } {
  const pontos = categorias.map(([k, rot]) => ({ k, rot, p: ix.ponto(indicador, cod, ano, k) }));
  const sem = pontos.filter((x) => x.p.status !== "OBSERVADO" || x.p.valor === null);
  const existentes = pontos.filter((x) => x.p.status === "OBSERVADO" && x.p.valor !== null);
  if (existentes.length === 0) {
    const nota = sem.find((x) => x.p.nota)?.p.nota ?? null;
    return { linhas: [], pontoTotal: sem[0]?.p ?? null, indisponivel: nota ?? "Sem composição publicada para este recorte." };
  }
  const total = existentes.reduce((s, x) => s + (x.p.valor ?? 0), 0);
  return {
    linhas: existentes.map((x) => ({ chave: x.k, rotulo: x.rot, valor: x.p.valor!, participacao: x.p.participacao ?? (total ? (100 * x.p.valor!) / total : 0) })),
    pontoTotal: existentes[0].p,
    indisponivel: null,
  };
}

/** Composição agregada: soma, em reais, das categorias nas capitais elegíveis do ano; pesa cada capital pelo seu valor. */
export function composicaoAgregada(ix: IndiceSaude, indicador: string, ano: number, categorias: [string, string][]): { linhas: LinhaComposicao[]; capitais: number } {
  const somas = new Map<string, number>();
  let n = 0;
  for (const cap of ix.d.capitais) {
    const ps = categorias.map(([k]) => ix.ponto(indicador, cap.cod, ano, k));
    if (ps.some((p) => p.status !== "OBSERVADO" || p.valor === null || !p.elegivel)) continue;
    n++;
    categorias.forEach(([k], i) => somas.set(k, (somas.get(k) ?? 0) + ps[i].valor!));
  }
  const total = Array.from(somas.values()).reduce((a, b) => a + b, 0);
  return { linhas: categorias.filter(([k]) => somas.has(k)).map(([k, rot]) => ({ chave: k, rotulo: rot, valor: somas.get(k)!, participacao: total ? (100 * somas.get(k)!) / total : 0 })), capitais: n };
}

export function notasMateriais(c: Comparacao): { texto: string; capitais: string[] }[] {
  const por = new Map<string, string[]>();
  for (const i of c.incluidas) {
    const t = i.ponto.notaMaterial ? i.ponto.nota : null;
    if (t) por.set(t, [...(por.get(t) ?? []), `${i.cap.nome} (${i.cap.uf})`]);
  }
  return Array.from(por.entries()).map(([texto, capitais]) => ({ texto, capitais })).sort((a, b) => b.capitais.length - a.capitais.length);
}

export function variacao(atual: Ponto, anterior: Ponto): { pct: number } | { bloqueio: string } | null {
  if (atual.valor === null || anterior.valor === null || atual.status !== "OBSERVADO" || anterior.status !== "OBSERVADO") return null;
  if (!atual.elegivel || !anterior.elegivel) return { bloqueio: "um dos valores está fora das comparações" };
  if (atual.quebraSerie !== anterior.quebraSerie) return { bloqueio: "a base populacional ou o método mudou entre os dois anos" };
  if (anterior.valor === 0) return { bloqueio: "o valor anterior é zero" };
  return { pct: (atual.valor / anterior.valor - 1) * 100 };
}

export const CABECALHO_CSV_COMPARACAO = ["Capital", "UF", "Região", "Medida", "Período", "Valor", "Valor numérico", "Unidade", "Estado do dado", "Na comparação", "Nota", "Fonte"];

export function linhasCsvComparacao(ix: IndiceSaude, m: MedidaSaude, ano: number, o: Opcoes, c: Comparacao, periodo: string, fonte: string): string[][] {
  const regioes = ix.d.regioes;
  const fmt = (v: number) => m.formata(v);
  const linha = (cap: CapitalPainel, p: Ponto, na: boolean) => [cap.nome, cap.uf, regioes[cap.regiao] ?? cap.regiao, m.rotulo, periodo, p.valor === null ? "" : fmt(p.valor), p.valor === null ? "" : String(p.valor), m.unidade(o.moeda), ROTULO_ESTADO[p.status], na ? "sim" : "não", p.nota ?? "", fonte];
  return [...c.incluidas.map((i) => linha(i.cap, i.ponto, true)), ...c.excluidas.map((x) => linha(x.cap, x.ponto, false))];
}

export function medida(id: MedidaSaudeId): MedidaSaude {
  return MEDIDAS_SAUDE[id];
}
