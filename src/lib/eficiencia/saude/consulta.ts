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

/** quebraPerimetro: o perímetro da despesa difere do dos outros exercícios (conferência); quebraSerie é só a base populacional ou o método. A variação exige as duas marcas iguais. */
export type PontoComCalculo = Ponto & { numerador: number | null; denominador: number | null; minimoPct: number | null; quebraPerimetro: boolean };
const VAZIO: PontoComCalculo = { ...SEM_OBS, numerador: null, denominador: null, minimoPct: null, quebraPerimetro: false };

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");

export class IndiceSaude {
  private mapa = new Map<string, PontoComCalculo>();
  private refs = new Map<string, RefGrupo>();
  private anosPorChave = new Map<string, Set<number>>();
  constructor(readonly d: DadosSaude) {
    for (const r of d.refs) {
      const [i, k, a, g, noGrupo, comValor, n, media, med, minimo, maximo, q1, q3, qe, sn, sd, razao, cmin, cmax] = r;
      this.refs.set(IndiceSaude.chaveRef(d.indicadores[i], k < 0 ? null : d.componentes[k], a, GRUPOS_REF[g]), {
        noGrupo, comValor, n, media, mediana: med, minimo, maximo, q1, q3, quartisExibicao: qe === 1, somaNumerador: sn, somaDenominador: sd, razaoAgregada: razao,
        capitaisMinimo: cmin.map((c) => d.capitais[c]).sort(porNome), capitaisMaximo: cmax.map((c) => d.capitais[c]).sort(porNome),
      });
    }
    for (const o of d.obs) {
      const [i, c, a, k, v, s, n, p, eleg, mat, sit, mot, qb, num, den, extra] = o;
      const ind = d.indicadores[i];
      const comp = k < 0 ? null : d.componentes[k];
      this.mapa.set(IndiceSaude.chave(ind, d.capitais[c].cod, a, comp), {
        valor: v, status: d.status[s], nota: n < 0 ? null : d.notas[n], notaMaterial: mat === 1, participacao: p, elegivel: eleg === 1,
        situacao: sit < 0 ? null : d.situacoes[sit], motivo: mot < 0 ? null : d.notas[mot], quebraSerie: (qb & 1) === 1, quebraPerimetro: (qb & 2) === 2, numerador: num, denominador: den, minimoPct: extra,
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
    // marca de base da mediana: a da maioria das capitais do grupo; o perímetro distinto de uma capital não troca a base das demais
    const grupo = ix.d.capitais.filter((c) => (regiao ? c.regiao === regiao : true));
    const marcas = grupo.map((c) => ix.ponto(m.indicador, c.cod, ano, comp)).filter((p) => p.valor !== null).map((p) => p.quebraSerie);
    const quebra = marcas.filter(Boolean).length > marcas.length / 2;
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

export type ForaDaSoma = { cap: CapitalPainel; motivo: string };
export type ComposicaoAgregada = { linhas: LinhaComposicao[]; capitais: number; universo: number; fora: ForaDaSoma[] };

/**
 * Composição agregada: soma, em reais, de cada categoria nas capitais que entram no agregado, com cada capital pesando pelo seu valor.
 * Entra a capital com pelo menos uma categoria observada e elegível e nenhuma categoria observada fora das comparações. Com `exigeTodas`
 * (natureza e fonte, em que a abertura é completa ou não existe) a capital precisa ter todas as categorias observadas; sem ela (subfunção,
 * em que a categoria sem linha na declaração não existe e vale ausência de despesa naquela subfunção, não dado faltante) soma-se o que a
 * declaração traz, que reproduz o total da função. Quem fica de fora é devolvido com o motivo, para a interface nomear.
 */
export function composicaoAgregada(ix: IndiceSaude, indicador: string, ano: number, categorias: [string, string][], opcoes: { exigeTodas?: boolean } = {}): ComposicaoAgregada {
  const somas = new Map<string, number>();
  const fora: ForaDaSoma[] = [];
  let n = 0;
  for (const cap of ix.d.capitais) {
    const ps = categorias.map(([k]) => ix.ponto(indicador, cap.cod, ano, k));
    const observadas = ps.filter((p) => p.status === "OBSERVADO" && p.valor !== null);
    if (observadas.length === 0) {
      const nota = ps.find((p) => p.status === "INCONSISTENTE" && p.nota)?.nota ?? "";
      const motivo = /nenhum registro/.test(nota)
        ? "a MSC de dezembro não traz registros deste exercício"
        : /sem natureza da despesa identificável/.test(nota)
          ? "a MSC traz linhas sem natureza identificável"
          : /não reproduz a DCA|difere do total/.test(nota)
            ? "a abertura não reproduz a DCA"
            : "sem abertura publicada";
      fora.push({ cap, motivo });
      continue;
    }
    if (observadas.some((p) => !p.elegivel)) {
      fora.push({ cap, motivo: "valor oficial fora das comparações" });
      continue;
    }
    if (opcoes.exigeTodas && observadas.length < categorias.length) {
      fora.push({ cap, motivo: "abertura incompleta" });
      continue;
    }
    n++;
    categorias.forEach(([k], i) => {
      const p = ps[i];
      if (p.status === "OBSERVADO" && p.valor !== null) somas.set(k, (somas.get(k) ?? 0) + p.valor);
    });
  }
  const total = Array.from(somas.values()).reduce((a, b) => a + b, 0);
  return {
    linhas: categorias.filter(([k]) => somas.has(k)).map(([k, rot]) => ({ chave: k, rotulo: rot, valor: somas.get(k)!, participacao: total ? (100 * somas.get(k)!) / total : 0 })),
    capitais: n,
    universo: ix.d.capitais.length,
    fora,
  };
}

export function notasMateriais(c: Comparacao): { texto: string; capitais: string[] }[] {
  const por = new Map<string, string[]>();
  for (const i of c.incluidas) {
    const t = i.ponto.notaMaterial ? i.ponto.nota : null;
    if (t) por.set(t, [...(por.get(t) ?? []), `${i.cap.nome} (${i.cap.uf})`]);
  }
  return Array.from(por.entries()).map(([texto, capitais]) => ({ texto, capitais })).sort((a, b) => b.capitais.length - a.capitais.length);
}

export function variacao(atual: Ponto & { quebraPerimetro?: boolean }, anterior: Ponto & { quebraPerimetro?: boolean }): { pct: number } | { bloqueio: string } | null {
  if (atual.valor === null || anterior.valor === null || atual.status !== "OBSERVADO" || anterior.status !== "OBSERVADO") return null;
  if (!atual.elegivel || !anterior.elegivel) return { bloqueio: "um dos valores está fora das comparações" };
  if (atual.quebraSerie !== anterior.quebraSerie) return { bloqueio: "a base populacional ou o método mudou entre os dois anos" };
  if (!!atual.quebraPerimetro !== !!anterior.quebraPerimetro) return { bloqueio: "o perímetro da despesa mudou entre os dois anos" };
  if (anterior.valor === 0) return { bloqueio: "o valor anterior é zero" };
  return { pct: (atual.valor / anterior.valor - 1) * 100 };
}

export const RESSALVA_CSV = "Os valores descrevem recursos, estrutura registrada e resultados observados; não classificam governos, não indicam meta e não demonstram causa. Célula vazia não é zero. A mediana descreve as capitais na comparação e não é referência de desempenho.";

/** Metadados que acompanham toda exportação: o arquivo precisa se explicar fora do site (fonte, endereço, captura, versão e hash). */
export function metaCsv(ix: IndiceSaude, m: MedidaSaude, o: Opcoes = { moeda: "nominal", denominador: "obee" }) {
  const ficha = ix.d.fichas.find((f) => f.id === m.indicador);
  // o IPCA só é fonte do valor em reais de 2025; a população do IBGE só é fonte da taxa de ICSAP quando o denominador é o do exercício
  const ids = (ficha?.fontes ?? []).filter((i) => (i !== "ibge_ipca" || (m.moeda && o.moeda === "real")) && (i !== "ibge_populacao" || m.id !== "icsap_taxa" || o.denominador === "obee"));
  const fontes = ids.map((i) => ix.d.fontes[i]).filter(Boolean);
  const datas = fontes.map((f) => f.capturado_em).filter(Boolean).sort();
  return {
    fonte: fontes.map((f) => f.nome).join("; "),
    url: Array.from(new Set(fontes.flatMap((f) => f.url.split(" ")).filter(Boolean))).join(" "),
    captura: datas.length ? datas[datas.length - 1] : "",
    versao: ficha?.versao_metodologica ?? "",
    geradoEm: ix.d.meta.gerado_em,
    hash: ix.d.meta.hash_dados,
  };
}

const CAUDA_META = ["Fonte", "Páginas oficiais da fonte", "Data de captura", "Versão metodológica", "Dados gerados em", "Hash dos dados", "Leia antes de usar"];
const caudaMeta = (ix: IndiceSaude, m: MedidaSaude, o: Opcoes) => {
  const x = metaCsv(ix, m, o);
  return [x.fonte, x.url, x.captura, x.versao, x.geradoEm, x.hash, RESSALVA_CSV];
};

export const CABECALHO_CSV_COMPARACAO = ["Capital", "UF", "Região", "Medida", "Período", "Valor (texto formatado)", "Valor numérico (ponto decimal)", "Unidade", "Estado do dado", "Na comparação", "Nota", "Numerador", "Denominador", "Mediana do grupo", "Capitais na comparação", ...CAUDA_META];

export function linhasCsvComparacao(ix: IndiceSaude, m: MedidaSaude, ano: number, o: Opcoes, c: Comparacao, periodo: string): string[][] {
  const regioes = ix.d.regioes;
  const fmt = (v: number) => m.formata(v);
  const mediana = c.ref?.mediana ?? null;
  const cauda = caudaMeta(ix, m, o);
  const linha = (cap: CapitalPainel, p: PontoComCalculo, na: boolean) => [
    cap.nome, cap.uf, regioes[cap.regiao] ?? cap.regiao, m.rotulo, periodo, p.valor === null ? "" : fmt(p.valor), p.valor === null ? "" : String(p.valor), m.unidade(o.moeda), ROTULO_ESTADO[p.status], na ? "sim" : "não",
    p.nota ?? "", p.numerador === null ? "" : String(p.numerador), p.denominador === null ? "" : String(p.denominador), mediana === null ? "" : String(mediana), c.ref ? String(c.ref.n) : "", ...cauda,
  ];
  return [...c.incluidas.map((i) => linha(i.cap, i.ponto, true)), ...c.excluidas.map((x) => linha(x.cap, x.ponto, false))];
}

export const CABECALHO_CSV_SERIE = ["Capital ou conjunto", "UF", "Medida", "Período", "Valor (texto formatado)", "Valor numérico (ponto decimal)", "Unidade", "Estado do dado", "Na comparação", "Marca de base (anos consecutivos só são comparáveis com a mesma marca)", "Perímetro da despesa distinto (sim quando difere dos demais anos)", "Base do denominador", "Nota", "Mediana das capitais no período", "Capitais na mediana", ...CAUDA_META];

/** Base da população do denominador no ano, quando a medida tem denominador populacional; vazio nas demais. */
function basesDoDenominador(ix: IndiceSaude, m: MedidaSaude, o: Opcoes, ano: number): string {
  const comp = componenteDe(m, o);
  return ix.d.basesDoDenominador[`${m.indicador}|${comp ?? ""}`]?.[ano] ?? "";
}

/** Série mostrada na visão Evolução: um ano por linha, com a marca de base e a mediana do grupo no mesmo ano. */
export function linhasCsvSerie(ix: IndiceSaude, m: MedidaSaude, o: Opcoes, cap: CapitalPainel | null, regiao: string | null, periodoDe: (ano: number) => string): string[][] {
  const cauda = caudaMeta(ix, m, o);
  const medianas = serieDaMediana(ix, m, o, regiao);
  const porAno = new Map(medianas.map((x) => [x.ano, x]));
  const nome = cap ? cap.nome : regiao ? `Mediana das capitais da região ${ix.d.regioes[regiao] ?? regiao}` : "Mediana das capitais na comparação";
  const pontos = cap
    ? serie(ix, m, cap.cod, o)
    : medianas.map((x) => ({ ano: x.ano, valor: x.valor, status: (x.valor === null ? "NAO_COMPARAVEL" : "OBSERVADO") as StatusDado, nota: x.valor === null ? "Nenhuma capital entra na comparação neste período: os valores oficiais existem e ficam fora da mediana." : null, notaMaterial: false, participacao: null, elegivel: x.valor !== null, situacao: null, motivo: null, quebraSerie: x.quebraSerie }));
  return pontos.map((p) => {
    const x = porAno.get(p.ano);
    return [
      nome, cap?.uf ?? "", m.rotulo, periodoDe(p.ano), p.valor === null ? "" : m.formata(p.valor), p.valor === null ? "" : String(p.valor), m.unidade(o.moeda), ROTULO_ESTADO[p.status], p.elegivel ? "sim" : "não",
      p.quebraSerie ? "sim" : "nao", cap ? ((p as { quebraPerimetro?: boolean }).quebraPerimetro ? "sim" : "nao") : "", basesDoDenominador(ix, m, o, p.ano), p.nota ?? "", x?.valor === null || x === undefined ? "" : String(x.valor), x ? String(x.n) : "", ...cauda,
    ];
  });
}

const POR_POPULACAO_DO_EXERCICIO: MedidaSaudeId[] = ["despesa_hab", "ubs_10mil", "esf_10mil", "eap_10mil"];

/**
 * Aviso único sobre o período escolhido: base da população do denominador nas medidas por habitante e a regra de cálculo e a base da população de referência
 * na cobertura potencial. Texto curto, sempre visível, no lugar de ressalvas repetidas em blocos recolhidos.
 */
export function avisoDoPeriodo(m: MedidaSaude, ano: number, o: Opcoes, d: DadosSaude): string | null {
  if (m.id === "cobertura_aps") {
    if (ano === 2021) return "Dezembro de 2021 segue regra anterior de equipes e de cadastro e não reproduz a fórmula da Nota Técnica nº 2/2025: os valores oficiais ficam à vista, fora das medianas e das comparações.";
    if (ano === 2022) return "A população de referência de dezembro de 2022 é anterior ao Censo 2022; a de dezembro de 2023 é a do Censo. A variação entre 2022 e 2023 não mede só a cobertura.";
    if (ano === 2023 || ano === 2024) return "Dezembro de 2023 e dezembro de 2024 usam a mesma população de referência, a do Censo 2022: a variação entre os dois meses vem só da capacidade das equipes. A de dezembro de 2025 é a estimativa de 2024, e a passagem para ela não mede só a cobertura.";
    return "A população de referência de dezembro de 2025 é a estimativa de 2024, posterior ao Censo 2022; a de dezembro de 2023 e a de dezembro de 2024 é a do Censo. A variação entre dezembro de 2024 e dezembro de 2025 mistura dois anos de crescimento populacional e não mede só a cobertura.";
  }
  const porPopulacao = POR_POPULACAO_DO_EXERCICIO.includes(m.id) || (m.id === "icsap_taxa" && o.denominador === "obee");
  const base = d.basePopulacional[ano];
  if (!porPopulacao || !base) return null;
  return `População de ${ano}: ${base}. Dois exercícios vizinhos só têm variação por habitante comparável quando a base é a mesma; a visão Evolução interrompe a linha onde a base muda.`;
}

/** Quantas capitais têm a mesma população nos dois denominadores do ICSAP no ano: quando todas, alternar o denominador não muda nada. */
export function denominadoresIcsapIguais(ix: IndiceSaude, ano: number): { iguais: number; total: number } {
  let iguais = 0;
  let total = 0;
  for (const c of ix.d.capitais) {
    const a = ix.ponto("sau.icsap.taxa", c.cod, ano, "ripsa");
    const b = ix.ponto("sau.icsap.taxa", c.cod, ano, "populacao_ibge_obee");
    if (a.valor === null || b.valor === null) continue;
    total++;
    if (a.valor === b.valor) iguais++;
  }
  return { iguais, total };
}

export function medida(id: MedidaSaudeId): MedidaSaude {
  return MEDIDAS_SAUDE[id];
}
