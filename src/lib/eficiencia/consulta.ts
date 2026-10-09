/**
 * Consulta do painel Educação municipal nas capitais: lógica pura, sem React,
 * usada pelo servidor (HTML inicial) e pelo cliente (filtros). Nenhum cálculo
 * contábil acontece aqui: os valores vêm prontos da gold. Esta camada só
 * seleciona, ordena, delimita pares e monta as linhas exibidas e exportadas.
 */
import type { ComparabilidadeReferencia, EtapaId, FichaIndicador, GrupoNacionalCalculado, IndicadorId, InternacionalGrupo, OrigemReferencia, ReferenciaNacionalCalculada, StatusDado } from "./tipos";
import { decimal, inteiro, percentual, reaisCompleto, reaisCurto, reaisExtenso, reaisInteiro } from "./formato";

/* ------------------------------------------------------------------ payload compacto */

/**
 * [indicador, capital, ano, etapa, componente, valor, status, nota, participação, elegível para comparação,
 *  nota material, situação da conferência, motivo da inelegibilidade, quebra de série]
 * Índices -1 = ausente. Textos (notas e motivos) deduplicados em `notas`; situações em `situacoes`.
 */
export type ObsCompacta = [number, number, number, number, number, number | null, number, number, number | null, 0 | 1, 0 | 1, number, number, 0 | 1];

export type CapitalPainel = { id: string; cod: number; nome: string; uf: string; regiao: string };

/**
 * Estatística do grupo, compacta:
 * [indicador, componente, etapa, ano, grupo (0 = todas; 1 a 5 = regiões N, NE, SE, S, CO), capitais no grupo, com valor, na comparação,
 *  média, mediana, mínimo, máximo, q1, q3, quartis exibidos, soma dos numeradores, soma dos denominadores, razão agregada,
 *  capitais do mínimo, capitais do máximo]. Índices -1 = ausente; capitais por índice em `capitais`.
 */
export type RefCompacta = [number, number, number, number, number, number, number, number, number | null, number | null, number | null, number | null, number | null, number | null, 0 | 1, number | null, number | null, number | null, number[], number[]];

/** Referência externa do painel: [indicador, componente, etapa, ano, tipo (0 = mesmo universo, 1 = outro universo), valor, descritor]. */
export type ExternaCompacta = [number, number, number, number, 0 | 1, number, number];
export type DescritorExterno = {
  rotulo: string;
  unidade: string;
  unidade_diferenca: string | null;
  escopo: string;
  origem: OrigemReferencia;
  comparabilidade: ComparabilidadeReferencia;
};

export const GRUPOS_REF = ["todas", "N", "NE", "SE", "S", "CO"] as const;

export type DadosPainel = {
  capitais: CapitalPainel[];
  regioes: Record<string, string>;
  etapas: { id: EtapaId; nome: string }[];
  fichas: FichaIndicador[];
  subfuncoes: Record<string, string>;
  anos: { financeiros: number[]; censo: number[]; ideb: number[] };
  indicadores: IndicadorId[];
  componentes: string[];
  status: StatusDado[];
  notas: string[];
  obs: ObsCompacta[];
  situacoes: string[];
  rotulosSituacao: Record<string, string>;
  refs: RefCompacta[];
  externas: ExternaCompacta[];
  descritores: DescritorExterno[];
  internacionais: Omit<InternacionalGrupo, "fonte" | "agregados_na_fonte">[];
  /** referência nacional calculada pelo OBEE (vazia enquanto a coleta nacional do exercício não estiver completa) */
  nacionalCalculada: ReferenciaNacionalCalculada[];
  populacao: Record<string, { tipo: string | null; referencia: string | null }>;
  limiarQuartis: number;
  /** parcela intraorçamentária da função Educação em cada capital e ano, em % da função (RREO, 6º bimestre): [ano, código IBGE, %] */
  intraPct: [number, number, number][];
  fontes: Record<string, { instituicao: string; conjunto: string; pagina: string; capturado_em: string }>;
  meta: {
    gerado_em: string;
    versao_pipeline: string;
    versao_codigo: string | null;
    hash_dados: string;
    versao_catalogo: string;
    dados_capturados_ate: string;
  };
  excluidos: { nome: string; uf: string; motivo: string }[];
};

/**
 * Três dimensões separadas: o valor oficial (valor, status), o resultado da conferência (situacao)
 * e a elegibilidade para comparações, medianas e variações (elegivel). Um valor observado pode
 * estar disponível para consulta e fora das comparações.
 */
export type Ponto = {
  valor: number | null;
  status: StatusDado;
  nota: string | null;
  /** a nota é uma restrição que precisa aparecer junto do dado */
  notaMaterial: boolean;
  participacao: number | null;
  elegivel: boolean;
  situacao: string | null;
  motivo: string | null;
  quebraSerie: boolean;
};

const SEM_OBS: Ponto = {
  valor: null,
  status: "AUSENTE_NA_COLETA",
  nota: "Sem registro para este recorte",
  notaMaterial: true,
  participacao: null,
  elegivel: false,
  situacao: null,
  motivo: null,
  quebraSerie: false,
};

export type RefGrupo = {
  noGrupo: number;
  comValor: number;
  n: number;
  media: number | null;
  mediana: number | null;
  minimo: number | null;
  maximo: number | null;
  q1: number | null;
  q3: number | null;
  quartisExibicao: boolean;
  somaNumerador: number | null;
  somaDenominador: number | null;
  razaoAgregada: number | null;
  capitaisMinimo: CapitalPainel[];
  capitaisMaximo: CapitalPainel[];
};

export class Indice {
  private mapa = new Map<string, Ponto>();
  private refs = new Map<string, RefGrupo>();
  constructor(readonly d: DadosPainel) {
    for (const r of d.refs) {
      const [i, k, e, a, g, noGrupo, comValor, n, media, mediana, minimo, maximo, q1, q3, qe, sn, sd, razao, cmin, cmax] = r;
      this.refs.set(Indice.chaveRef(d.indicadores[i], k < 0 ? null : d.componentes[k], e < 0 ? null : d.etapas[e].id, a, GRUPOS_REF[g]), {
        noGrupo, comValor, n, media, mediana, minimo, maximo, q1, q3, quartisExibicao: qe === 1, somaNumerador: sn, somaDenominador: sd, razaoAgregada: razao,
        capitaisMinimo: cmin.map((c) => d.capitais[c]), capitaisMaximo: cmax.map((c) => d.capitais[c]),
      });
    }
    for (const o of d.obs) {
      const [i, c, a, e, k, v, s, n, p, eleg, mat, sit, mot, qb] = o;
      const chave = Indice.chave(d.indicadores[i], d.capitais[c].cod, a, e < 0 ? null : d.etapas[e].id, k < 0 ? null : d.componentes[k]);
      this.mapa.set(chave, {
        valor: v,
        status: d.status[s],
        nota: n < 0 ? null : d.notas[n],
        notaMaterial: mat === 1,
        participacao: p,
        elegivel: eleg === 1,
        situacao: sit < 0 ? null : d.situacoes[sit],
        motivo: mot < 0 ? null : d.notas[mot],
        quebraSerie: qb === 1,
      });
    }
  }
  static chaveRef(ind: IndicadorId, comp: string | null, etapa: EtapaId | null, ano: number, grupo: string) {
    return `${ind}|${comp ?? ""}|${etapa ?? ""}|${ano}|${grupo}`;
  }
  /** Estatística do grupo calculada pelo pipeline (referencias.py); null quando nenhuma capital do grupo tem valor. */
  referencia(ind: IndicadorId, comp: string | null, etapa: EtapaId | null, ano: number, grupo: string): RefGrupo | null {
    return this.refs.get(Indice.chaveRef(ind, comp, etapa, ano, grupo)) ?? null;
  }
  static chave(ind: IndicadorId, cod: number, ano: number, etapa: EtapaId | null, comp: string | null) {
    return `${ind}|${cod}|${ano}|${etapa ?? ""}|${comp ?? ""}`;
  }
  ponto(ind: IndicadorId, cod: number, ano: number, etapa: EtapaId | null, comp: string | null): Ponto {
    return this.mapa.get(Indice.chave(ind, cod, ano, etapa, comp)) ?? SEM_OBS;
  }
  tem(ind: IndicadorId, cod: number, ano: number, etapa: EtapaId | null, comp: string | null): boolean {
    return this.mapa.has(Indice.chave(ind, cod, ano, etapa, comp));
  }
}

/* ------------------------------------------------------------------ medidas selecionáveis */

export type MedidaId = "despesa" | "despesa_hab" | "despesa_mat" | "matriculas" | "conveniadas" | "atu" | "aprovacao" | "ideb" | "saeb";
export const MEDIDAS: MedidaId[] = ["despesa", "despesa_hab", "despesa_mat", "matriculas", "conveniadas", "atu", "aprovacao", "ideb", "saeb"];
/** As três escalas da despesa: volume, por habitante e por matrícula. Nenhuma substitui as outras. */
export const ESCALAS_DESPESA: MedidaId[] = ["despesa", "despesa_hab", "despesa_mat"];
export const ehDespesa = (m: MedidaId) => ESCALAS_DESPESA.includes(m);

export type Medida = {
  id: MedidaId;
  indicador: IndicadorId;
  rotulo: string;
  familia: "recursos" | "atendimento" | "resultado";
  anos: "financeiros" | "censo" | "ideb";
  etapas: EtapaId[] | null;
};

const ETAPAS_MATRICULA: EtapaId[] = ["total", "creche", "pre_escola", "anos_iniciais", "anos_finais", "ensino_medio", "eja", "profissional"];

export const MEDIDA: Record<MedidaId, Medida> = {
  despesa: { id: "despesa", indicador: "edu.despesa.funcao_educacao", rotulo: "Despesa liquidada na função Educação, total", familia: "recursos", anos: "financeiros", etapas: null },
  despesa_hab: { id: "despesa_hab", indicador: "edu.despesa.por_habitante", rotulo: "Despesa liquidada em Educação por habitante", familia: "recursos", anos: "financeiros", etapas: null },
  despesa_mat: { id: "despesa_mat", indicador: "edu.despesa.aplicacao_direta_por_matricula", rotulo: "Despesa de aplicação direta por matrícula da rede municipal", familia: "recursos", anos: "financeiros", etapas: null },
  matriculas: { id: "matriculas", indicador: "edu.matriculas.rede_municipal", rotulo: "Matrículas na rede municipal", familia: "atendimento", anos: "censo", etapas: ETAPAS_MATRICULA },
  conveniadas: { id: "conveniadas", indicador: "edu.matriculas.conveniadas_municipais", rotulo: "Matrículas em escolas privadas conveniadas com o município", familia: "atendimento", anos: "censo", etapas: ETAPAS_MATRICULA },
  atu: { id: "atu", indicador: "edu.atu.rede_municipal", rotulo: "Média de alunos por turma na rede municipal", familia: "atendimento", anos: "censo", etapas: ["creche", "pre_escola", "anos_iniciais", "anos_finais"] },
  aprovacao: { id: "aprovacao", indicador: "edu.aprovacao.rede_municipal", rotulo: "Taxa de aprovação na rede municipal", familia: "resultado", anos: "censo", etapas: ["anos_iniciais", "anos_finais"] },
  ideb: { id: "ideb", indicador: "edu.ideb.rede_municipal", rotulo: "Ideb da rede municipal", familia: "resultado", anos: "ideb", etapas: ["anos_iniciais", "anos_finais"] },
  saeb: { id: "saeb", indicador: "edu.saeb.rede_municipal", rotulo: "Proficiência média no Saeb da rede municipal", familia: "resultado", anos: "ideb", etapas: ["anos_iniciais", "anos_finais"] },
};

export type Moeda = "nominal" | "real";
export type Disciplina = "matematica" | "portugues";

export function componente(m: MedidaId, moeda: Moeda, disc: Disciplina): string | null {
  if (ehDespesa(m)) return moeda === "real" ? "real_2025" : "nominal";
  if (m === "ideb") return "ideb";
  if (m === "saeb") return disc;
  return null;
}

/** Etapa efetiva de uma medida: null quando a medida não é desagregada por etapa. */
export function etapaDaMedida(m: MedidaId, etapa: EtapaId): EtapaId | null {
  return MEDIDA[m].etapas ? etapa : null;
}

export function etapaValida(m: MedidaId, etapa: EtapaId): boolean {
  const e = MEDIDA[m].etapas;
  return e === null || e.includes(etapa);
}

/** Unidade, com o período-base quando a moeda é real. */
export function unidade(m: MedidaId, moeda: Moeda): string {
  switch (m) {
    case "despesa":
      return moeda === "real" ? "R$ de 2025 (IPCA)" : "R$ correntes";
    case "despesa_hab":
      return moeda === "real" ? "R$ de 2025 (IPCA) por habitante por ano" : "R$ correntes por habitante por ano";
    case "despesa_mat":
      return moeda === "real" ? "R$ de 2025 (IPCA) por matrícula por ano" : "R$ correntes por matrícula por ano";
    case "matriculas":
    case "conveniadas":
      return "matrículas";
    case "atu":
      return "alunos por turma";
    case "aprovacao":
      return "%";
    case "ideb":
      return "índice de 0 a 10";
    case "saeb":
      return "pontos na escala Saeb";
  }
}

/** Valor formatado com a unidade (curto: para eixo e rótulo de gráfico). */
export function formata(m: MedidaId, v: number, curto = false): string {
  switch (m) {
    case "despesa":
      return curto ? reaisCurto(v) : reaisExtenso(v);
    case "despesa_hab":
    case "despesa_mat":
      return reaisInteiro(v);
    case "matriculas":
    case "conveniadas":
      return inteiro(v);
    case "atu":
      return decimal(v, 1);
    case "aprovacao":
      return percentual(v, 1);
    case "ideb":
      return decimal(v, 1);
    case "saeb":
      return decimal(v, curto ? 1 : 2);
  }
}

/** Rótulo de eixo: inteiro quando o tique é inteiro, uma casa decimal quando não é. */
export function formataEixo(m: MedidaId, v: number): string {
  if (m === "despesa") return reaisCurto(v);
  if (m === "despesa_hab" || m === "despesa_mat") return reaisInteiro(v);
  if (m === "matriculas" || m === "conveniadas") return inteiro(v);
  const t = Number.isInteger(v) ? inteiro(v) : decimal(v, 1);
  return m === "aprovacao" ? `${t}%` : t;
}

/** Valor completo, na precisão publicada, para tabela e exportação. */
export function formataCompleto(ind: IndicadorId, v: number): string {
  if (ind === "ctx.populacao.residente") return inteiro(v);
  if (ind.startsWith("edu.despesa")) return reaisCompleto(v);
  if (ind.startsWith("edu.matriculas")) return inteiro(v);
  if (ind === "edu.saeb.rede_municipal") return decimal(v, 2);
  if (ind === "edu.ideb.rede_municipal") return String(v).replace(".", ",");
  return decimal(v, 1);
}

/* ------------------------------------------------------------------ períodos */

export function anosDaMedida(d: DadosPainel, m: MedidaId): number[] {
  return d.anos[MEDIDA[m].anos];
}

/** O Ideb é bienal: para um ano par, a edição exibida é a anterior, e isso é dito. */
export function edicaoIdeb(ano: number): { edicao: number; exata: boolean } {
  return ano % 2 === 1 ? { edicao: ano, exata: true } : { edicao: ano - 1, exata: false };
}

/* ------------------------------------------------------------------ séries */

export type PontoSerie = Ponto & { ano: number };

export function serie(ix: Indice, m: MedidaId, cod: number, etapa: EtapaId, moeda: Moeda, disc: Disciplina): PontoSerie[] {
  const e = etapaDaMedida(m, etapa);
  const k = componente(m, moeda, disc);
  return anosDaMedida(ix.d, m).map((ano) => ({ ano, ...ix.ponto(MEDIDA[m].indicador, cod, ano, e, k) }));
}

/**
 * Mediana das capitais em cada ano, com o número de capitais na comparação. Herda a mudança de base do dado: o ano é marcado como
 * quebra de série quando a maioria das capitais tem o valor desse ano marcado (a população de referência, por exemplo, muda para todas).
 */
export type PontoMediana = { ano: number; valor: number | null; n: number; quebraSerie: boolean };

export function serieDaMediana(ix: Indice, m: MedidaId, etapa: EtapaId, moeda: Moeda, disc: Disciplina, regiao: string | null = null): PontoMediana[] {
  const e = etapaDaMedida(m, etapa);
  const k = componente(m, moeda, disc);
  const ind = MEDIDA[m].indicador;
  return anosDaMedida(ix.d, m).map((ano) => {
    const r = ix.referencia(ind, k, e, ano, regiao ?? "todas");
    const grupo = ix.d.capitais.filter((c) => !regiao || c.regiao === regiao);
    const marcadas = grupo.filter((c) => ix.ponto(ind, c.cod, ano, e, k).quebraSerie).length;
    return { ano, valor: r?.mediana ?? null, n: r?.n ?? 0, quebraSerie: marcadas > grupo.length / 2 };
  });
}

/* ------------------------------------------------------------------ comparação */

export type Grupo = "todas" | "regiao";
export type Ordem = "alfabetica" | "valor";

export type ItemComparacao = { cap: CapitalPainel; valor: number; ponto: Ponto };
/** comValor: há valor oficial, mas fora da comparação (perímetro distinto ou conferência pendente). */
export type ExcluidoComparacao = { cap: CapitalPainel; status: StatusDado; motivo: string; comValor: boolean; ponto: Ponto };

export type Comparacao = {
  criterio: string;
  universoIndicador: string;
  universo: CapitalPainel[];
  comValor: number;
  incluidas: ItemComparacao[];
  excluidas: ExcluidoComparacao[];
  /** Estatísticas do grupo (pipeline): a mesma regra do gráfico, da tabela e do download. */
  ref: RefGrupo | null;
  mediana: number | null;
};

export function mediana(vs: number[]): number | null {
  if (!vs.length) return null;
  const s = [...vs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function ficha(d: DadosPainel, ind: IndicadorId): FichaIndicador {
  return d.fichas.find((f) => f.id === ind)!;
}

export function rotuloPeriodoMedida(m: MedidaId, ano: number): string {
  const md = MEDIDA[m];
  if (md.anos === "financeiros") return m === "despesa_mat" ? `exercício ${ano} (despesa) e Censo Escolar ${ano} (matrículas)` : m === "despesa_hab" ? `exercício ${ano} (despesa) e população de ${ano}` : `exercício ${ano}`;
  if (md.anos === "ideb") return `edição ${ano}`;
  return m === "aprovacao" ? `ano letivo ${ano}` : `Censo Escolar ${ano}`;
}

/**
 * Comparação entre capitais. Uma única regra serve ao gráfico, à mediana, à tabela e ao download:
 * entram só valores observados e elegíveis; os demais ficam listados com estado e motivo,
 * inclusive os que têm valor oficial disponível para consulta.
 */
export function comparar(
  ix: Indice,
  m: MedidaId,
  ano: number,
  etapa: EtapaId,
  moeda: Moeda,
  disc: Disciplina,
  grupo: Grupo,
  capSel: CapitalPainel,
  ordem: Ordem,
): Comparacao {
  const d = ix.d;
  const universo = grupo === "regiao" ? d.capitais.filter((c) => c.regiao === capSel.regiao) : d.capitais;
  const e = etapaDaMedida(m, etapa);
  const k = componente(m, moeda, disc);
  const incluidas: ItemComparacao[] = [];
  const excluidas: ExcluidoComparacao[] = [];
  let comValor = 0;
  for (const cap of universo) {
    const p = ix.ponto(MEDIDA[m].indicador, cap.cod, ano, e, k);
    const observado = p.status === "OBSERVADO" && p.valor !== null;
    if (observado) comValor++;
    if (!observado) {
      excluidas.push({ cap, status: p.status, motivo: p.nota ?? "", comValor: false, ponto: p });
    } else if (!p.elegivel) {
      excluidas.push({ cap, status: "NAO_COMPARAVEL", motivo: p.motivo ?? p.nota ?? "", comValor: true, ponto: p });
    } else {
      incluidas.push({ cap, valor: p.valor as number, ponto: p });
    }
  }
  if (ordem === "valor") incluidas.sort((a, b) => a.valor - b.valor || a.cap.nome.localeCompare(b.cap.nome, "pt-BR"));
  const f = ficha(d, MEDIDA[m].indicador);
  const regiao = d.regioes[capSel.regiao];
  const recorte = [rotuloPeriodoMedida(m, ano), e ? nomeEtapa(d, e).toLowerCase() : null, m === "saeb" ? (disc === "matematica" ? "Matemática" : "Língua Portuguesa") : null,
    ehDespesa(m) ? (moeda === "real" ? "reais de 2025" : "reais correntes") : null].filter(Boolean).join(", ");
  const criterio =
    `${grupo === "regiao" ? `Capitais da região ${regiao}` : "Todas as capitais estaduais"}; ${recorte}. ` +
    "Entram as capitais com valor observado e elegível para comparação" +
    (ehDespesa(m) ? " pela política de conferência da despesa" : "") + ".";
  const ref = ix.referencia(MEDIDA[m].indicador, k, e, ano, grupo === "regiao" ? capSel.regiao : "todas");
  return { criterio, universoIndicador: f.universo_curto, universo, comValor, incluidas, excluidas, ref, mediana: ref?.mediana ?? null };
}

/** Variação entre dois períodos, só quando os dois valores são elegíveis. */
export function variacao(atual: Ponto, anterior: Ponto): { pct: number } | { bloqueio: string } | null {
  if (atual.valor === null || anterior.valor === null) return null;
  if (!atual.elegivel || !anterior.elegivel) {
    const motivo = !atual.elegivel ? atual.motivo : anterior.motivo;
    return { bloqueio: motivo ?? "um dos valores está fora das comparações" };
  }
  if (anterior.valor === 0) return null;
  return { pct: ((atual.valor - anterior.valor) / anterior.valor) * 100 };
}

export function nomeEtapa(d: DadosPainel, e: EtapaId | null): string {
  if (!e) return "";
  return d.etapas.find((x) => x.id === e)?.nome ?? e;
}

/* ------------------------------------------------------------------ composição */

export type LinhaComposicao = { codigo: string; rotulo: string; valor: number; participacao: number };

/** Subfunções na ordem da classificação funcional (Portaria MOG nº 42/1999), nunca pelo valor. */
const ORDEM_SUBFUNCOES = ["361", "362", "363", "364", "365", "366", "367", "368", "122", "FU12"];

export function composicaoDespesa(ix: Indice, cod: number, ano: number): { linhas: LinhaComposicao[]; total: Ponto; inconsistente: boolean } {
  const total = ix.ponto("edu.despesa.funcao_educacao", cod, ano, null, "nominal");
  const linhas: LinhaComposicao[] = [];
  let inconsistente = false;
  const codigos = [...ORDEM_SUBFUNCOES, ...Object.keys(ix.d.subfuncoes).filter((c) => !ORDEM_SUBFUNCOES.includes(c))];
  for (const c of codigos) {
    if (!ix.tem("edu.despesa.subfuncao", cod, ano, null, c)) continue;
    const p = ix.ponto("edu.despesa.subfuncao", cod, ano, null, c);
    if (p.status === "INCONSISTENTE") inconsistente = true;
    if (p.status === "OBSERVADO" && p.valor !== null && p.participacao !== null) {
      linhas.push({ codigo: c, rotulo: ix.d.subfuncoes[c] ?? c, valor: p.valor, participacao: p.participacao });
    }
  }
  return { linhas, total, inconsistente };
}

export type LinhaEtapa = { etapa: EtapaId; rotulo: string; rede: number | null; conveniadas: number | null };

export function distribuicaoMatriculas(ix: Indice, cod: number, ano: number): { linhas: LinhaEtapa[]; total: Ponto } {
  const total = ix.ponto("edu.matriculas.rede_municipal", cod, ano, "total", null);
  const linhas = ix.d.etapas
    .filter((e) => e.id !== "total")
    .map((e) => {
      const r = ix.ponto("edu.matriculas.rede_municipal", cod, ano, e.id, null);
      const c = ix.ponto("edu.matriculas.conveniadas_municipais", cod, ano, e.id, null);
      return { etapa: e.id, rotulo: e.nome, rede: r.status === "OBSERVADO" ? r.valor : null, conveniadas: c.status === "OBSERVADO" ? c.valor : null };
    });
  return { linhas, total };
}

/* ------------------------------------------------------------------ tabela auditável e exportação */

export type LinhaTabela = {
  indicador: IndicadorId;
  medida: string;
  universo: string;
  etapa: string;
  componente: string;
  periodo: string;
  /** valor como exibido (texto) */
  valor: string;
  /** valor numérico na precisão da fonte, com ponto decimal; vazio quando não há valor */
  valorNumerico: string;
  participacao: string;
  unidade: string;
  status: StatusDado;
  elegivel: boolean;
  situacao: string;
  nota: string;
  notaMaterial: boolean;
  fonte: string;
  versao: string;
};

const ROTULO_COMPONENTE: Record<string, string> = {
  nominal: "Valor nominal",
  real_2025: "Valor em reais de 2025 (IPCA)",
  ad_demais_elementos: "Aplicação direta, demais elementos (numerador)",
  ad_beneficiario_indeterminado: "Aplicação direta com beneficiário indeterminado (numerador)",
  inativos: "Aposentadorias, pensões e outros benefícios previdenciários",
  ensino_superior: "Ensino superior (subfunção 364)",
  transf_privadas: "Transferências a instituições privadas",
  transf_outros_entes: "Transferências a outros entes (modalidades 20 a 46, 70 a 76 e 80)",
  delegacao_recebida: "Recursos recebidos por delegação de outro ente (modalidade 92)",
  ppp: "Parcerias público-privadas (modalidade 67)",
  uso_atipico: "Modalidades de uso atípico em Educação (95, 96 e 99)",
  modalidade_nao_reconhecida: "Modalidade fora da lista oficial",
  intra: "Operações intraorçamentárias (fora da DCA exceto intra)",
  sem_natureza: "Linhas da MSC sem natureza da despesa",
  diferenca_dca_msc: "Diferença entre a DCA e a MSC (sem intraorçamentárias)",
  dca_total: "Total da função Educação na DCA",
  ideb: "Ideb",
  p_rendimento: "Indicador de rendimento (P)",
  n_nota_padronizada: "Nota média padronizada (N)",
  matematica: "Matemática",
  portugues: "Língua Portuguesa",
};

export function rotuloComponente(d: DadosPainel, ind: IndicadorId, k: string | null): string {
  if (!k) return "";
  if (ind === "edu.despesa.subfuncao") return `Subfunção ${k === "FU12" ? "" : `${k} `}${d.subfuncoes[k] ?? ""}`.trim();
  return ROTULO_COMPONENTE[k] ?? k;
}

export const ROTULO_STATUS: Record<StatusDado, string> = {
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

function rotuloPeriodo(ind: IndicadorId, ano: number): string {
  if (ind === "ctx.populacao.residente") return `População de ${ano}`;
  if (ind.startsWith("edu.despesa")) return `Exercício ${ano}`;
  if (ind === "edu.ideb.rede_municipal" || ind === "edu.saeb.rede_municipal") return `Edição ${ano}`;
  if (ind === "edu.aprovacao.rede_municipal") return `Ano letivo ${ano}`;
  return `Censo Escolar ${ano}`;
}

/**
 * Linhas da tabela auditável para uma capital e um ano. O Ideb e o Saeb entram
 * pela edição correspondente (o próprio ano, se ímpar; a anterior, se par), e o
 * período de cada linha é escrito por extenso.
 */
export function linhasTabela(ix: Indice, cod: number, ano: number): LinhaTabela[] {
  const d = ix.d;
  const fichas = new Map(d.fichas.map((f) => [f.id, f]));
  const out: LinhaTabela[] = [];
  const { edicao } = edicaoIdeb(ano);
  for (const o of d.obs) {
    const ind = d.indicadores[o[0]];
    if (d.capitais[o[1]].cod !== cod) continue;
    const alvo = ind === "edu.ideb.rede_municipal" || ind === "edu.saeb.rede_municipal" ? edicao : ano;
    if (o[2] !== alvo) continue;
    const etapa = o[3] < 0 ? null : d.etapas[o[3]];
    const k = o[4] < 0 ? null : d.componentes[o[4]];
    const st = d.status[o[6]];
    const f = fichas.get(ind)!;
    const valor = o[5] === null ? "" : formataCompleto(ind, o[5]);
    out.push({
      indicador: ind,
      medida: f.nome_curto,
      universo: f.universo_curto,
      etapa: etapa?.nome ?? "Não se aplica",
      componente: rotuloComponente(d, ind, k),
      periodo: rotuloPeriodo(ind, o[2]),
      valor,
      valorNumerico: o[5] === null ? "" : String(o[5]),
      participacao: o[8] === null ? "" : String(o[8]),
      unidade: ind === "edu.despesa.subfuncao" ? "R$ correntes" : k === "real_2025" ? "R$ de 2025 (IPCA)" : ind === "edu.despesa.funcao_educacao" ? "R$ correntes" : f.unidade,
      status: st,
      elegivel: o[9] === 1,
      situacao: o[11] < 0 ? "" : d.rotulosSituacao[d.situacoes[o[11]]] ?? d.situacoes[o[11]],
      nota: o[7] < 0 ? "" : d.notas[o[7]],
      notaMaterial: o[10] === 1,
      fonte: fonteLegivel(d, ind, o[2]),
      versao: f.versao_metodologica,
    });
  }
  return out;
}

export function fonteLegivel(d: DadosPainel, ind: IndicadorId, ano: number): string {
  if (ind === "ctx.populacao.residente") return ano === 2022 ? "IBGE, Censo Demográfico 2022 (SIDRA, tabela 4714)" : `IBGE, estimativas da população ${ano} (SIDRA, tabela 6579)`;
  if (ind === "edu.despesa.por_habitante") return `Siconfi, DCA ${ano}, Anexo I\u2011E; IBGE, população ${ano}`;
  if (ind === "edu.despesa.aplicacao_direta_por_matricula") return `Siconfi, MSC de dezembro de ${ano} e DCA ${ano}; INEP, Censo Escolar ${ano}`;
  if (ind === "edu.despesa.ponte_matricula") return `Siconfi, MSC de dezembro de ${ano}, função 12, e DCA ${ano}`;
  if (ind.startsWith("edu.despesa")) return `Siconfi, DCA ${ano}, Anexo I\u2011E`;
  if (ind.startsWith("edu.matriculas")) return `INEP, microdados do Censo Escolar ${ano}`;
  if (ind === "edu.atu.rede_municipal") return `INEP, Média de Alunos por Turma ${ano}`;
  if (ind === "edu.aprovacao.rede_municipal") return `INEP, Taxas de Rendimento ${ano}`;
  return "INEP, planilhas do Ideb 2025 (série 2005 a 2025)";
}

/** CSV (separador ponto e vírgula, padrão de planilha em português) com BOM para acentuação. */
export function csv(cabecalho: string[], linhas: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(esc).join(";")).join("\n") + "\n";
}

export const CABECALHO_TABELA = ["Medida", "Etapa", "Componente", "Período", "Valor", "Unidade", "Estado do dado", "Comparação", "Nota", "Fonte"];

/** Exportação da tabela: valor como exibido e valor numérico em colunas separadas, participação à parte. */
export const CABECALHO_CSV_TABELA = [
  "capital", "codigo_ibge", "indicador_id", "medida", "universo", "etapa", "componente", "periodo", "valor_exibido",
  "valor_numerico", "participacao_pct", "unidade", "estado_do_dado", "elegivel_comparacao", "conferencia",
  "nota", "nota_material", "fonte", "versao_metodologica", "dados_gerados_em", "hash_dados",
];

export function rotuloComparacao(l: { status: StatusDado; elegivel: boolean }): string {
  if (l.status !== "OBSERVADO") return "Sem valor";
  return l.elegivel ? "Elegível" : "Fora da comparação";
}

export function linhasCsvTabela(d: DadosPainel, cap: CapitalPainel, linhas: LinhaTabela[]): string[][] {
  return linhas.map((l) => [
    cap.nome, String(cap.cod), l.indicador, l.medida, l.universo, l.etapa, l.componente, l.periodo, l.valor, l.valorNumerico,
    l.participacao, l.unidade, ROTULO_STATUS[l.status], l.status !== "OBSERVADO" ? "" : l.elegivel ? "sim" : "nao", l.situacao,
    l.nota, l.notaMaterial ? "sim" : "nao", l.fonte, l.versao, d.meta.gerado_em, d.meta.hash_dados,
  ]);
}

/** Exportação da comparação: todas as capitais do grupo, incluídas e excluídas, com estado, motivo e contexto. */
export const CABECALHO_CSV_COMPARACAO = [
  "indicador_id", "indicador", "universo_do_indicador", "grupo_de_comparacao", "periodo", "etapa", "componente",
  "codigo_ibge", "capital", "uf", "valor_numerico", "valor_exibido", "unidade", "estado_do_dado", "elegivel_comparacao",
  "incluida_na_comparacao", "conferencia", "motivo_exclusao", "nota", "mediana_das_incluidas", "capitais_no_grupo",
  "capitais_com_valor", "capitais_incluidas", "versao_metodologica", "dados_gerados_em", "hash_dados", "fonte",
  "media_simples_das_incluidas", "minimo_das_incluidas", "maximo_das_incluidas", "primeiro_quartil", "terceiro_quartil", "quartis_exibidos",
  "razao_agregada_do_grupo", "politica_de_referencias", "parcela_intraorcamentaria_pct_da_funcao",
];

export function linhasCsvComparacao(
  d: DadosPainel, comp: Comparacao, m: MedidaId, ano: number, etapa: EtapaId, moeda: Moeda, disc: Disciplina,
): string[][] {
  const md = MEDIDA[m];
  const f = ficha(d, md.indicador);
  const e = etapaDaMedida(m, etapa);
  const k = componente(m, moeda, disc);
  const comum = (cap: CapitalPainel) => [md.indicador, f.nome, f.universo_curto, comp.criterio, rotuloPeriodoMedida(m, ano),
    e ? nomeEtapa(d, e) : "Não se aplica", rotuloComponente(d, md.indicador, k), String(cap.cod), cap.nome, cap.uf];
  const cauda = [comp.mediana === null ? "" : String(comp.mediana), String(comp.universo.length), String(comp.comValor),
    String(comp.incluidas.length), f.versao_metodologica, d.meta.gerado_em, d.meta.hash_dados, fonteLegivel(d, md.indicador, ano),
    ...[comp.ref?.media, comp.ref?.minimo, comp.ref?.maximo, comp.ref?.q1, comp.ref?.q3].map((v) => (v == null ? "" : String(v))),
    comp.ref?.quartisExibicao ? "sim" : "nao", comp.ref?.razaoAgregada == null ? "" : String(comp.ref.razaoAgregada),
    "média simples (peso igual por capital), mediana, quartis de tipo 7 (exibidos com 8 ou mais valores) e razão agregada dos mesmos pares; ver politica_referencias na gold"];
  const sit = (p: Ponto) => (p.situacao ? d.rotulosSituacao[p.situacao] ?? p.situacao : "");
  // despesa: a parcela intraorçamentária da função fica fora do valor e difere entre capitais; vai junto de cada linha
  const intra = (cap: CapitalPainel) => (ehDespesa(m) ? String(intraDaCapital(d, cap.cod, ano) ?? "") : "");
  const linhas = [
    ...comp.incluidas.map((i) => [...comum(i.cap), String(i.valor), formata(m, i.valor), unidade(m, moeda), ROTULO_STATUS.OBSERVADO,
      "sim", "sim", sit(i.ponto), "", i.ponto.nota ?? "", ...cauda, intra(i.cap)]),
    ...comp.excluidas.map((x) => [...comum(x.cap), x.comValor && x.ponto.valor !== null ? String(x.ponto.valor) : "",
      x.comValor && x.ponto.valor !== null ? formata(m, x.ponto.valor) : "", unidade(m, moeda), ROTULO_STATUS[x.ponto.status],
      x.comValor ? "nao" : "", "nao", sit(x.ponto), x.motivo, x.ponto.nota ?? "", ...cauda, intra(x.cap)]),
  ];
  const ordem = new Map(d.capitais.map((c, i) => [String(c.cod), i]));
  return linhas.sort((a, b) => (ordem.get(a[7]) ?? 0) - (ordem.get(b[7]) ?? 0));
}

/* ------------------------------------------------------------------ diferença para a referência */

export type Diferenca = {
  /** diferença na escala da medida: reais, alunos por turma, pontos percentuais, pontos ou matrículas */
  abs: number;
  /** diferença relativa em %, só em escala de razão e com base diferente de zero; null quando bloqueada */
  pct: number | null;
  unidade: string;
  /** "acima da", "abaixo da" ou "igual à" */
  sentido: "acima da" | "abaixo da" | "igual à";
  texto: string;
};

/**
 * Diferença descritiva entre um valor e uma referência, respeitando a escala: R$ e porcentagem para despesas e contagens;
 * alunos por turma em valor absoluto; pontos percentuais para taxas; pontos para Ideb e Saeb. Diferença relativa com base
 * zero é bloqueada. Linguagem descritiva: nunca "melhor" ou "pior".
 */
export function diferenca(m: MedidaId, valor: number, referencia: number | null, nomeRef = "mediana"): Diferenca | null {
  if (referencia === null) return null;
  const abs = valor - referencia;
  const igual = Math.abs(abs) < 1e-9;
  const sentido: Diferenca["sentido"] = igual ? "igual à" : abs > 0 ? "acima da" : "abaixo da";
  const sinalTxt = abs >= 0 ? "+" : "−";
  // a diferença escrita é a dos valores como aparecem na tela (arredondados à mesma precisão), para que a conta feita pelo leitor feche;
  // só o total da despesa, mostrado em milhões ou bilhões, usa a diferença exata
  const casas = m === "saeb" ? 2 : m === "atu" || m === "aprovacao" || m === "ideb" ? 1 : 0;
  const arred = (v: number) => Math.round(v * 10 ** casas) / 10 ** casas;
  const exibida = Math.abs(arred(valor) - arred(referencia));
  const a = m === "despesa" || exibida === 0 ? Math.abs(abs) : exibida;
  // dois valores que aparecem iguais na tela mas não são: a diferença é menor que a precisão mostrada, e o texto diz isso em vez de escrever um número que a conta do leitor não reproduz
  const abaixoDaPrecisao = !igual && m !== "despesa" && exibida === 0;
  let txt: string;
  let pct: number | null = null;
  let unidadeD: string;
  if (ehDespesa(m)) {
    pct = referencia !== 0 ? (abs / referencia) * 100 : null;
    unidadeD = "R$";
    txt = `${sinalTxt}${m === "despesa" ? reaisExtenso(a) : reaisInteiro(a)}${pct !== null ? ` (${sinalTxt}${decimal(Math.abs(pct), 1)}%)` : ""}`;
  } else if (m === "matriculas" || m === "conveniadas") {
    pct = referencia !== 0 ? (abs / referencia) * 100 : null;
    unidadeD = "matrículas";
    txt = `${sinalTxt}${inteiro(a)} matrículas${pct !== null ? ` (${sinalTxt}${decimal(Math.abs(pct), 1)}%)` : ""}`;
  } else if (m === "atu") {
    unidadeD = "alunos por turma";
    txt = `${sinalTxt}${decimal(a, 1)} aluno${a >= 1.05 ? "s" : ""} por turma`;
  } else if (m === "aprovacao") {
    unidadeD = "pontos percentuais";
    txt = `${sinalTxt}${decimal(a, 1)} ${a >= 1.05 ? "pontos percentuais" : "ponto percentual"}`;
  } else {
    unidadeD = "pontos";
    txt = `${sinalTxt}${decimal(a, m === "saeb" ? 2 : 1)} ponto${a >= 1.05 ? "s" : ""}`;
  }
  if (abaixoDaPrecisao) {
    const MENOS: Record<string, string> = { despesa_hab: "R$ 1", despesa_mat: "R$ 1", matriculas: "1 matrícula", conveniadas: "1 matrícula", atu: "0,1 aluno por turma", aprovacao: "0,1 ponto percentual", ideb: "0,1 ponto", saeb: "0,01 ponto" };
    txt = `${abs > 0 ? "+" : "−"}menos de ${MENOS[m]}`;
  }
  return { abs, pct, unidade: unidadeD, sentido, texto: igual ? `igual à ${nomeRef}` : `${txt}, ${sentido} ${nomeRef}` };
}

/* ------------------------------------------------------------------ referências externas */

export type NivelExterno = {
  id: string;
  indicador: IndicadorId;
  componente: string | null;
  etapa: EtapaId | null;
  ano: number;
  tipo: "nacional_mesmo_universo" | "nacional_outro_universo";
  valor: number;
  rotulo: string;
  unidade: string;
  unidade_diferenca: string | null;
  escopoTexto: string;
  origem: OrigemReferencia;
  comparabilidade: ComparabilidadeReferencia;
};

/**
 * Referência oficial externa de uma medida, para o período e a etapa em exibição: nacional do mesmo universo (INEP, rede municipal
 * do Brasil), nacional de outro universo (INEP, todas as redes públicas, só 2021). Internacional fica em `internacionaisDa`.
 */
export function referenciasExternas(d: DadosPainel, m: MedidaId, ano: number, etapa: EtapaId, comp: string | null): NivelExterno[] {
  const md = MEDIDA[m];
  const e: EtapaId | null = m === "despesa_mat" ? "total" : etapaDaMedida(m, etapa);
  const alvoComp = m === "despesa_mat" ? null : comp;
  const out: NivelExterno[] = [];
  for (const [i, k, et, a, tipo, valor, desc] of d.externas) {
    if (d.indicadores[i] !== md.indicador || a !== ano) continue;
    if ((et < 0 ? null : d.etapas[et].id) !== e) continue;
    if ((k < 0 ? null : d.componentes[k]) !== alvoComp) continue;
    const ds = d.descritores[desc];
    out.push({ id: `${d.indicadores[i]}.${a}.${e ?? ""}.${alvoComp ?? ""}.${tipo}`, indicador: d.indicadores[i], componente: alvoComp, etapa: e, ano: a, tipo: tipo === 0 ? "nacional_mesmo_universo" : "nacional_outro_universo", valor, rotulo: ds.rotulo, unidade: ds.unidade, unidade_diferenca: ds.unidade_diferenca, escopoTexto: ds.escopo, origem: ds.origem, comparabilidade: ds.comparabilidade });
  }
  return out;
}

export type ContextoInternacional = Omit<InternacionalGrupo, "fonte" | "agregados_na_fonte">;

/** Conjuntos internacionais de contexto pertinentes à medida e à etapa. Nunca entram na distribuição das capitais. */
export function internacionaisDa(d: DadosPainel, m: MedidaId, etapa: EtapaId): ContextoInternacional[] {
  const candidatos =
    m === "atu"
      ? d.internacionais.filter((g) => g.conjunto === "ocde_tamanho_turma" && g.etapa === etapa && g.instituicoes === "publicas")
      : m === "despesa_mat"
        // a despesa municipal é pública e do ensino fundamental: só instituições públicas e os níveis ISCED 1 e 2; o agregado
        // ISCED 1 a 8 inclui o ensino superior e não corresponde ao objeto do indicador
        ? d.internacionais.filter((g) => g.conjunto === "ocde_despesa_por_estudante" && g.instituicoes === "publicas" && g.nivel !== "ISCED11_1T8")
        : [];
  // só o ano mais recente de cada nível, preferindo dado definitivo ao preliminar; o ano da OCDE é dito junto do dado,
  // porque difere do ano em exibição no painel
  const recente = new Map<string, ContextoInternacional>();
  for (const g of candidatos) {
    const k = `${g.conjunto}|${g.nivel}|${g.instituicoes}`;
    const atual = recente.get(k);
    if (!atual || (atual.preliminar && !g.preliminar) || (atual.preliminar === g.preliminar && atual.ano < g.ano)) recente.set(k, g);
  }
  return Array.from(recente.values());
}

/** Rótulo de exibição da classe de uma referência, em duas dimensões: quem calculou e quão comparável é. */
export function classeDaReferencia(origem: OrigemReferencia, comparabilidade: ComparabilidadeReferencia): string {
  if (comparabilidade === "incompativel") return "Incompatível com as dimensões de origem";
  if (comparabilidade === "contexto") return origem === "calculado_obee" ? "Calculado pelo OBEE, contextual" : "Contextual";
  return origem === "calculado_obee" ? "Calculado pelo OBEE com fontes oficiais" : "Oficial publicado";
}

/**
 * Referência nacional calculada pelo OBEE para o exercício, quando existe: despesa municipal por habitante, mesmos municípios elegíveis
 * no numerador e no denominador. Só se aplica à medida `despesa_hab`; a despesa por matrícula não tem referência nacional.
 */
export function nacionalCalculada(d: DadosPainel, m: MedidaId, ano: number): ReferenciaNacionalCalculada | null {
  if (m !== "despesa_hab") return null;
  return d.nacionalCalculada.find((r) => r.ano === ano) ?? null;
}

export type DiferencaNacional = { grupo: GrupoNacionalCalculado; texto: string };

/** Diferença descritiva em reais por habitante entre a capital e a mediana e a razão agregada dos municípios elegíveis. */
export function diferencaNacionalCalculada(valor: number, g: GrupoNacionalCalculado): { mediana: string | null; agregada: string | null } {
  const dif = (ref: number | null, rotulo: string) => {
    if (ref === null) return null;
    const delta = valor - ref;
    return `${reaisInteiro(Math.abs(delta))} ${delta >= 0 ? "acima" : "abaixo"} ${rotulo}`;
  };
  return { mediana: dif(g.mediana, "da mediana dos municípios elegíveis"), agregada: dif(g.razao_agregada, "da razão agregada dos municípios elegíveis") };
}

/* ------------------------------------------------------------------ tabela comparativa completa */

export type ColunaId =
  | "despesa"
  | "populacao"
  | "despesa_hab"
  | "intra_pct"
  | "matriculas"
  | "despesa_mat"
  | "conveniadas_pct"
  | "atu"
  | "aprovacao"
  | "ideb"
  | "saeb";

export type ColunaDef = {
  id: ColunaId;
  rotulo: string;
  grupo: "recursos" | "atendimento" | "resultado";
  /** medida que serve de referência quando a coluna é a medida selecionada */
  medida: MedidaId | null;
  /** coluna que depende da etapa em exibição */
  porEtapa: boolean;
  /** medida central: fica visível em tela estreita na visão "Todas" */
  central: boolean;
};

export const COLUNAS: ColunaDef[] = [
  { id: "despesa", rotulo: "Despesa total na função Educação", grupo: "recursos", medida: "despesa", porEtapa: false, central: true },
  { id: "populacao", rotulo: "População residente", grupo: "recursos", medida: null, porEtapa: false, central: false },
  { id: "despesa_hab", rotulo: "Despesa por habitante", grupo: "recursos", medida: "despesa_hab", porEtapa: false, central: true },
  { id: "intra_pct", rotulo: "Parcela intraorçamentária da função (RREO)", grupo: "recursos", medida: null, porEtapa: false, central: false },
  { id: "matriculas", rotulo: "Matrículas na rede municipal", grupo: "recursos", medida: "matriculas", porEtapa: false, central: true },
  { id: "despesa_mat", rotulo: "Despesa por matrícula", grupo: "recursos", medida: "despesa_mat", porEtapa: false, central: true },
  { id: "conveniadas_pct", rotulo: "Conveniadas ÷ rede municipal", grupo: "atendimento", medida: null, porEtapa: false, central: false },
  { id: "atu", rotulo: "Alunos por turma", grupo: "atendimento", medida: "atu", porEtapa: true, central: false },
  { id: "aprovacao", rotulo: "Taxa de aprovação", grupo: "resultado", medida: "aprovacao", porEtapa: true, central: false },
  { id: "ideb", rotulo: "Ideb", grupo: "resultado", medida: "ideb", porEtapa: true, central: false },
  { id: "saeb", rotulo: "Saeb", grupo: "resultado", medida: "saeb", porEtapa: true, central: false },
];

export type Celula = { valor: number | null; texto: string; ponto: Ponto; elegivel: boolean; foraDoEscopo: boolean };

export type LinhaComparativa = {
  cap: CapitalPainel;
  celulas: Record<ColunaId, Celula>;
  /** diferença para a mediana do grupo na medida selecionada, quando a capital está na comparação */
  diferenca: Diferenca | null;
  ressalvas: { coluna: string; texto: string; material: boolean }[];
};

export type ResumoColuna = { n: number; media: number | null; mediana: number | null; minimo: number | null; maximo: number | null; noGrupo: number; comValor: number };

const SEM_ESCOPO: Ponto = { ...SEM_OBS, status: "NAO_APLICAVEL", nota: "Fora do escopo desta etapa", notaMaterial: false };
/** Ideb e Saeb são bienais: em ano par não há edição, o que é diferente de a medida não existir na etapa. */
const SEM_EDICAO: Ponto = { ...SEM_OBS, status: "NAO_APLICAVEL", nota: "Sem edição neste ano: o Ideb e o Saeb são bienais", notaMaterial: false };

/**
 * Tabela comparativa: uma linha por capital do grupo, com despesa total, população, despesa por habitante, matrículas, despesa por
 * matrícula, participação das conveniadas e os resultados da etapa em exibição. As colunas de recursos valem para todas as etapas
 * da rede; só as de atendimento por etapa e de resultado seguem a etapa escolhida.
 */
export function tabelaComparativa(
  ix: Indice, ano: number, etapa: EtapaId, moeda: Moeda, disc: Disciplina, grupo: Grupo, capSel: CapitalPainel, medida: MedidaId,
): { linhas: LinhaComparativa[]; resumo: Record<ColunaId, ResumoColuna | null>; edicao: number; edicaoExata: boolean } {
  const d = ix.d;
  const universo = grupo === "regiao" ? d.capitais.filter((c) => c.regiao === capSel.regiao) : d.capitais;
  const { edicao, exata } = edicaoIdeb(ano);
  const comp = (m: MedidaId) => componente(m, moeda, disc);
  const grp = grupo === "regiao" ? capSel.regiao : "todas";
  const linhas: LinhaComparativa[] = universo.map((cap) => {
    const get = (m: MedidaId, a = ano, et: EtapaId | null = etapaDaMedida(m, etapa)) => ix.ponto(MEDIDA[m].indicador, cap.cod, a, et, comp(m));
    const bruto: Record<ColunaId, Ponto> = {
      despesa: get("despesa"),
      populacao: ix.ponto("ctx.populacao.residente", cap.cod, ano, null, null),
      despesa_hab: get("despesa_hab"),
      intra_pct: intraDaCapital(d, cap.cod, ano) === null
        ? { ...SEM_OBS, nota: "O RREO do ano não traz a parcela intraorçamentária desta capital" }
        : { ...SEM_OBS, valor: intraDaCapital(d, cap.cod, ano), status: "OBSERVADO" as StatusDado, nota: null, notaMaterial: false, elegivel: true },
      matriculas: ix.ponto("edu.matriculas.rede_municipal", cap.cod, ano, "total", null),
      despesa_mat: get("despesa_mat"),
      conveniadas_pct: { ...SEM_OBS },
      atu: etapaValida("atu", etapa) ? get("atu") : SEM_ESCOPO,
      aprovacao: etapaValida("aprovacao", etapa) ? get("aprovacao") : SEM_ESCOPO,
      ideb: !etapaValida("ideb", etapa) ? SEM_ESCOPO : exata ? get("ideb") : SEM_EDICAO,
      saeb: !etapaValida("saeb", etapa) ? SEM_ESCOPO : exata ? get("saeb") : SEM_EDICAO,
    };
    const conv = ix.ponto("edu.matriculas.conveniadas_municipais", cap.cod, ano, "total", null);
    const mt = bruto.matriculas;
    bruto.conveniadas_pct =
      conv.status === "OBSERVADO" && mt.status === "OBSERVADO" && conv.valor !== null && mt.valor ? { ...conv, valor: (100 * conv.valor) / mt.valor, nota: null, notaMaterial: false } : { ...SEM_OBS, nota: "Sem matrículas observadas na rede ou nas conveniadas" };
    const celulas = {} as Record<ColunaId, Celula>;
    for (const c of COLUNAS) {
      const p = bruto[c.id];
      const fora = p === SEM_ESCOPO || p === SEM_EDICAO;
      const medidaCol = c.medida;
      const txt =
        p.valor === null ? "" : c.id === "populacao" ? inteiro(p.valor) : c.id === "conveniadas_pct" || c.id === "intra_pct" ? percentual(p.valor, 1) : medidaCol ? formata(medidaCol, p.valor) : String(p.valor);
      celulas[c.id] = { valor: p.valor, texto: txt, ponto: p, elegivel: p.elegivel, foraDoEscopo: fora };
    }
    const ressalvas: LinhaComparativa["ressalvas"] = [];
    for (const c of COLUNAS) {
      const p = bruto[c.id];
      if (p === SEM_ESCOPO || p === SEM_EDICAO) continue;
      if (p.status === "OBSERVADO") {
        const texto = !p.elegivel ? p.motivo ?? p.nota : p.nota;
        if (texto) ressalvas.push({ coluna: c.rotulo, texto, material: p.notaMaterial || !p.elegivel });
      } else if (p.nota) ressalvas.push({ coluna: c.rotulo, texto: `${ROTULO_STATUS[p.status]}. ${p.nota}`, material: true });
    }
    return { cap, celulas, diferenca: null, ressalvas };
  });
  const colSel = COLUNAS.find((c) => c.medida === medida);
  const e = etapaDaMedida(medida, etapa);
  const refSel = ix.referencia(MEDIDA[medida].indicador, comp(medida), e, ano, grp);
  if (colSel && refSel) {
    for (const l of linhas) {
      const c = l.celulas[colSel.id];
      l.diferenca = c.valor !== null && c.elegivel && !c.foraDoEscopo ? diferenca(medida, c.valor, refSel.mediana) : null;
    }
  }
  const resumo = {} as Record<ColunaId, ResumoColuna | null>;
  for (const c of COLUNAS) {
    if (!c.medida) {
      resumo[c.id] = null;
      continue;
    }
    const ok = !c.porEtapa || (etapaValida(c.medida, etapa) && (MEDIDA[c.medida].anos !== "ideb" || exata));
    const r = ok ? ix.referencia(MEDIDA[c.medida].indicador, comp(c.medida), etapaDaMedida(c.medida, etapa), ano, grp) : null;
    resumo[c.id] = r ? { n: r.n, media: r.media, mediana: r.mediana, minimo: r.minimo, maximo: r.maximo, noGrupo: r.noGrupo, comValor: r.comValor } : null;
  }
  // matrículas na tabela são sempre o total da rede (etapa total): a estatística correspondente é a do total
  const rm = ix.referencia("edu.matriculas.rede_municipal", null, "total", ano, grp);
  resumo.matriculas = rm ? { n: rm.n, media: rm.media, mediana: rm.mediana, minimo: rm.minimo, maximo: rm.maximo, noGrupo: rm.noGrupo, comValor: rm.comValor } : null;
  const rp = ix.referencia("ctx.populacao.residente", null, null, ano, grp);
  resumo.populacao = rp ? { n: rp.n, media: rp.media, mediana: rp.mediana, minimo: rp.minimo, maximo: rp.maximo, noGrupo: rp.noGrupo, comValor: rp.comValor } : null;
  return { linhas, resumo, edicao, edicaoExata: exata };
}

/** Ordenação da tabela: ausentes e fora das comparações não recebem posição numérica e ficam depois, em ordem alfabética. */
export function ordenaTabela(linhas: LinhaComparativa[], coluna: ColunaId | "alfabetica", decrescente: boolean): LinhaComparativa[] {
  const nome = (a: LinhaComparativa, b: LinhaComparativa) => a.cap.nome.localeCompare(b.cap.nome, "pt-BR");
  if (coluna === "alfabetica") return [...linhas].sort(nome);
  const num = (l: LinhaComparativa) => {
    const c = l.celulas[coluna];
    return c.valor !== null && c.ponto.status === "OBSERVADO" && (c.elegivel || coluna === "populacao" || coluna === "conveniadas_pct" || coluna === "intra_pct") && !c.foraDoEscopo ? c.valor : null;
  };
  return [...linhas].sort((a, b) => {
    const x = num(a);
    const y = num(b);
    if (x === null && y === null) return nome(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return (decrescente ? y - x : x - y) || nome(a, b);
  });
}

export const CABECALHO_CSV_TABELA_COMPARATIVA = [
  "capital", "codigo_ibge", "uf", "ano", "etapa_dos_resultados", "grupo_de_comparacao", "coluna", "valor_numerico", "valor_exibido", "unidade",
  "estado_do_dado", "elegivel_comparacao", "nota_ou_ressalva", "medida_de_referencia", "mediana_do_grupo", "media_do_grupo", "capitais_na_referencia",
  "diferenca_para_a_mediana", "versao_metodologica", "dados_gerados_em", "hash_dados",
];

/** Indicador de cada coluna da tabela comparativa, para gravar no CSV a versão metodológica que vale para ela. */
const INDICADOR_DA_COLUNA: Record<ColunaId, IndicadorId> = {
  despesa: "edu.despesa.funcao_educacao",
  populacao: "ctx.populacao.residente",
  despesa_hab: "edu.despesa.por_habitante",
  intra_pct: "edu.despesa.funcao_educacao",
  matriculas: "edu.matriculas.rede_municipal",
  despesa_mat: "edu.despesa.aplicacao_direta_por_matricula",
  conveniadas_pct: "edu.matriculas.conveniadas_municipais",
  atu: "edu.atu.rede_municipal",
  aprovacao: "edu.aprovacao.rede_municipal",
  ideb: "edu.ideb.rede_municipal",
  saeb: "edu.saeb.rede_municipal",
};

const UNIDADE_COLUNA: Record<ColunaId, (moeda: Moeda) => string> = {
  despesa: (m) => unidade("despesa", m),
  populacao: () => "habitantes",
  despesa_hab: (m) => unidade("despesa_hab", m),
  intra_pct: () => "% da despesa da função Educação (RREO, 6º bimestre)",
  matriculas: () => "matrículas",
  despesa_mat: (m) => unidade("despesa_mat", m),
  conveniadas_pct: () => "% das matrículas da rede municipal",
  atu: () => "alunos por turma",
  aprovacao: () => "%",
  ideb: () => "índice de 0 a 10",
  saeb: () => "pontos na escala Saeb",
};

export function linhasCsvTabelaComparativa(
  d: DadosPainel, t: ReturnType<typeof tabelaComparativa>, ano: number, etapa: EtapaId, moeda: Moeda, grupo: Grupo, capSel: CapitalPainel, medida: MedidaId, ix: Indice, disc: Disciplina,
): string[][] {
  const grp = grupo === "regiao" ? `Capitais da região ${d.regioes[capSel.regiao]}` : "Todas as capitais estaduais";
  const refSel = ix.referencia(MEDIDA[medida].indicador, componente(medida, moeda, disc), etapaDaMedida(medida, etapa), ano, grupo === "regiao" ? capSel.regiao : "todas");
  const colSel = COLUNAS.find((c) => c.medida === medida)?.id;
  const out: string[][] = [];
  for (const l of t.linhas) {
    for (const c of COLUNAS) {
      const cel = l.celulas[c.id];
      out.push([
        l.cap.nome, String(l.cap.cod), l.cap.uf, String(ano), c.porEtapa ? nomeEtapa(d, etapa) : "Não depende da etapa", grp, c.rotulo,
        cel.valor === null ? "" : String(cel.valor), cel.texto, UNIDADE_COLUNA[c.id](moeda),
        cel.foraDoEscopo ? (cel.ponto === SEM_EDICAO ? "Sem edição neste ano (medida bienal)" : "Fora do escopo da etapa") : ROTULO_STATUS[cel.ponto.status],
        cel.ponto.status !== "OBSERVADO" || cel.foraDoEscopo ? "" : cel.elegivel ? "sim" : "nao",
        (cel.ponto.status === "OBSERVADO" ? (!cel.elegivel ? cel.ponto.motivo ?? cel.ponto.nota : cel.ponto.nota) : cel.ponto.nota) ?? "",
        MEDIDA[medida].rotulo, refSel?.mediana == null ? "" : String(refSel.mediana), refSel?.media == null ? "" : String(refSel.media), refSel ? String(refSel.n) : "",
        c.id === colSel && l.diferenca ? l.diferenca.texto : "", ficha(d, INDICADOR_DA_COLUNA[c.id]).versao_metodologica, d.meta.gerado_em, d.meta.hash_dados,
      ]);
    }
  }
  return out;
}


/* ------------------------------------------------------------------ perímetro da despesa: intraorçamentárias */

export type PerimetroIntra = {
  ano: number;
  /** capitais com a parcela conhecida no ano */
  n: number;
  menor: { nome: string; uf: string; pct: number };
  maior: { nome: string; uf: string; pct: number };
};

/** Parcela das despesas intraorçamentárias na função Educação de uma capital, em % da função (RREO); null quando o RREO do ano não a traz. */
export function intraDaCapital(d: DadosPainel, cod: number, ano: number): number | null {
  return d.intraPct.find((x) => x[0] === ano && x[1] === cod)?.[2] ?? null;
}

/**
 * Menor e maior parcela intraorçamentária entre as capitais no ano. A despesa do painel (DCA, exceto intraorçamentárias) é calculada
 * por uma regra única, mas a parcela excluída difere muito entre as capitais: o leitor precisa saber disso junto do número.
 */
export function perimetroIntra(d: DadosPainel, ano: number): PerimetroIntra | null {
  const linhas = d.intraPct.filter((x) => x[0] === ano);
  if (!linhas.length) return null;
  const com = linhas.map((x) => ({ cap: d.capitais.find((c) => c.cod === x[1]), pct: x[2] })).filter((x): x is { cap: CapitalPainel; pct: number } => !!x.cap);
  if (!com.length) return null;
  const ord = [...com].sort((a, b) => a.pct - b.pct || a.cap.nome.localeCompare(b.cap.nome, "pt-BR"));
  const f = (x: { cap: CapitalPainel; pct: number }) => ({ nome: x.cap.nome, uf: x.cap.uf, pct: x.pct });
  return { ano, n: com.length, menor: f(ord[0]), maior: f(ord[ord.length - 1]) };
}

/** Ressalva do perímetro, para ficar junto do número de despesa. */
export function textoPerimetroIntra(p: PerimetroIntra | null, ano: number, medida: MedidaId = "despesa"): string {
  const base =
    medida === "despesa_mat"
      ? "O numerador parte da despesa liquidada na função Educação (DCA), exceto as operações intraorçamentárias."
      : "Despesa liquidada na função Educação (DCA), exceto as operações intraorçamentárias.";
  if (!p) return `${base} A parcela intraorçamentária de ${ano} não consta do RREO usado pelo painel, e a comparação entre capitais não a corrige.`;
  const pc = (v: number) => `${decimal(v, 1)}%`;
  return `${base} Em ${p.ano} essa parcela pesa de ${pc(p.menor.pct)} da função em ${p.menor.nome} (${p.menor.uf}) a ${pc(p.maior.pct)} em ${p.maior.nome} (${p.maior.uf}) (RREO): a comparação entre capitais não corrige a diferença.`;
}

/* ------------------------------------------------------------------ referência no gráfico, notas materiais e grupos */

/**
 * Referência que aparece como traço no gráfico das capitais: a nacional do mesmo universo, quando existe; senão a mediana nacional
 * calculada pelo OBEE (outro universo, rotulado). Gráfico e legenda dizem de onde vem.
 */
export function referenciaExternaDoGrafico(d: DadosPainel, m: MedidaId, ano: number, etapa: EtapaId, comp: string | null): { rotulo: string; valor: number } | null {
  const mesmo = referenciasExternas(d, m, ano, etapa, comp).filter((x) => x.tipo === "nacional_mesmo_universo");
  if (mesmo[0]) return { rotulo: "Brasil", valor: mesmo[0].valor };
  const g = nacionalCalculada(d, m, ano)?.grupos.find((x) => x.id === "elegiveis");
  return g && g.mediana !== null ? { rotulo: "Municípios do país", valor: g.mediana } : null;
}

/**
 * Notas materiais do recorte, sem depender de a capital estar escolhida: cada texto distinto com as capitais a que se aplica.
 * A restrição que vale para o conjunto (a população de 2021, por exemplo) precisa estar à vista junto do gráfico.
 */
export function notasMateriais(comp: Comparacao): { texto: string; capitais: string[] }[] {
  const mapa = new Map<string, string[]>();
  for (const i of comp.incluidas) {
    if (i.ponto.nota && i.ponto.notaMaterial) mapa.set(i.ponto.nota, [...(mapa.get(i.ponto.nota) ?? []), `${i.cap.nome} (${i.cap.uf})`]);
  }
  return Array.from(mapa.entries()).map(([texto, capitais]) => ({ texto, capitais })).sort((a, b) => b.capitais.length - a.capitais.length || a.texto.localeCompare(b.texto, "pt-BR"));
}

/** Regiões com capitais no painel, na ordem do catálogo, com o número de capitais de cada uma. */
export function regioesDoPainel(d: DadosPainel): { id: string; nome: string; n: number }[] {
  return Object.entries(d.regioes).map(([id, nome]) => ({ id, nome, n: d.capitais.filter((c) => c.regiao === id).length })).filter((r) => r.n > 0);
}

/* ------------------------------------------------------------------ dicionário das exportações */

/**
 * Dicionário de colunas dos dois CSV baixáveis (comparação de um indicador e tabela comparativa), com as ressalvas que valem para
 * qualquer arquivo e a citação sugerida. Vai num arquivo à parte porque o CSV não admite comentários sem quebrar leitores de planilha.
 */
const DESCRICAO_COLUNA: Record<string, string> = {
  indicador_id: "Identificador do indicador no catálogo do OBEE.",
  indicador: "Nome do indicador.",
  universo_do_indicador: "O que o indicador cobre: orçamento do município na função Educação, rede municipal de ensino etc.",
  grupo_de_comparacao: "Conjunto de capitais em que a mediana e as demais estatísticas foram calculadas (todas as capitais estaduais ou as de uma região).",
  periodo: "Exercício financeiro, ano do Censo Escolar ou edição bienal, conforme o indicador.",
  etapa: "Etapa de ensino do recorte; 'Não se aplica' quando o indicador não varia por etapa.",
  componente: "Base do valor: nominal (reais correntes), real (reais de 2025 pelo IPCA) ou, no Saeb, a disciplina.",
  codigo_ibge: "Código do município no IBGE (7 dígitos).",
  capital: "Nome da capital.",
  uf: "Sigla da unidade da federação.",
  valor_numerico: "Valor do indicador, em número, na unidade da coluna 'unidade'. Pode estar arredondado a 12 algarismos significativos; a série completa está na gold.",
  valor_exibido: "O mesmo valor como aparece no painel.",
  unidade: "Unidade do valor.",
  estado_do_dado: "Observado, não divulgado, não aplicável, ausente na coleta, inconsistente etc. Valor vazio nunca significa zero.",
  elegivel_comparacao: "'sim' quando o valor entra em medianas, médias e comparações; 'nao' quando há valor oficial mas ele fica fora (perímetro distinto, conferência pendente).",
  incluida_na_comparacao: "'sim' quando a capital entrou nas estatísticas do grupo neste recorte.",
  conferencia: "Resultado da conferência da despesa entre DCA, RREO e MSC.",
  motivo_exclusao: "Por que a capital ficou fora da comparação, quando ficou.",
  nota: "Nota ou ressalva do dado nesta capital e período.",
  mediana_das_incluidas: "Mediana das capitais incluídas no grupo.",
  capitais_no_grupo: "Número de capitais do grupo.",
  capitais_com_valor: "Capitais do grupo com valor oficial observado.",
  capitais_incluidas: "Capitais do grupo que entraram nas estatísticas.",
  versao_metodologica: "Versão metodológica do indicador (a da última revisão que o alterou).",
  dados_gerados_em: "Data e hora de geração dos dados publicados.",
  hash_dados: "Hash do conteúdo dos dados publicados; identifica a base exata de onde saiu a linha.",
  fonte: "Fonte oficial e conjunto de dados.",
  media_simples_das_incluidas: "Média simples (peso igual por capital) das capitais incluídas.",
  minimo_das_incluidas: "Menor valor entre as capitais incluídas.",
  maximo_das_incluidas: "Maior valor entre as capitais incluídas.",
  primeiro_quartil: "Primeiro quartil (tipo 7); só vale quando 'quartis_exibidos' é 'sim'.",
  terceiro_quartil: "Terceiro quartil (tipo 7); só vale quando 'quartis_exibidos' é 'sim'.",
  quartis_exibidos: "'sim' quando há 8 ou mais valores e os quartis são mostrados.",
  razao_agregada_do_grupo: "Soma dos numeradores ÷ soma dos denominadores das mesmas capitais (despesa por habitante e por matrícula); é diferente da média simples.",
  politica_de_referencias: "Como as referências foram calculadas.",
  parcela_intraorcamentaria_pct_da_funcao: "Despesa: parcela das operações intraorçamentárias na despesa liquidada da função Educação (RREO, 6º bimestre), em %, que fica fora do valor. Vazio nas demais medidas.",
  etapa_dos_resultados: "Etapa de ensino que vale para as colunas de resultado e atendimento por etapa.",
  coluna: "Medida a que a linha se refere.",
  medida_de_referencia: "Medida usada nas colunas de mediana, média e diferença.",
  mediana_do_grupo: "Mediana do grupo para a medida de referência.",
  media_do_grupo: "Média simples do grupo para a medida de referência.",
  capitais_na_referencia: "Número de capitais usado na referência.",
  diferenca_para_a_mediana: "Diferença descritiva entre a capital e a mediana do grupo, na unidade da medida; não é avaliação.",
  ano: "Ano do recorte: exercício financeiro, Censo Escolar ou edição bienal.",
  nota_ou_ressalva: "Nota ou ressalva do dado.",
};

export function dicionarioExportacoes(): string[][] {
  const arquivo = (nome: string, cols: string[]) => cols.map((c) => [nome, c, DESCRICAO_COLUNA[c] ?? ""]);
  return [
    ...arquivo("comparação de um indicador", CABECALHO_CSV_COMPARACAO),
    ...arquivo("tabela comparativa", CABECALHO_CSV_TABELA_COMPARATIVA),
    ["todos", "(leia antes de usar)", "Os valores descrevem o gasto, o atendimento e os resultados observados; não classificam governos, não indicam meta e não demonstram causa. Mediana e média descrevem o grupo de capitais e não são referência de desempenho. Células vazias não são zero."],
    ["todos", "(universo e período)", "As 26 capitais estaduais, na rede municipal de ensino; a despesa de total e por habitante é do orçamento do município na função Educação, exceto operações intraorçamentárias. Gasto anual, Censo Escolar e Ideb têm períodos próprios e não devem ser alinhados sem cuidado."],
    ["todos", "(como citar)", "Scrutiniums, Observatório Brasileiro de Eficiência Estatal, Educação nas capitais. Indique a data de geração (dados_gerados_em) e o hash_dados da linha utilizada."],
  ];
}

/* ------------------------------------------------------------------ população e ponte da despesa por matrícula */

export type LinhaPonte = { componente: string; rotulo: string; valor: number; participacao: number | null; dentro: boolean };

/** Ponte do total da DCA ao numerador por matrícula, na ordem de leitura. Vazio quando a MSC não reconcilia ou não existe. */
export function ponteMatricula(ix: Indice, cod: number, ano: number): { linhas: LinhaPonte[]; total: number | null; reconcilia: boolean } {
  const ordem = [
    "dca_total", "transf_privadas", "transf_outros_entes", "delegacao_recebida", "ppp", "uso_atipico", "modalidade_nao_reconhecida",
    "ensino_superior", "inativos", "sem_natureza", "diferenca_dca_msc", "ad_beneficiario_indeterminado", "ad_demais_elementos",
  ];
  const total = ix.ponto("edu.despesa.ponte_matricula", cod, ano, null, "dca_total");
  if (total.valor === null) return { linhas: [], total: null, reconcilia: false };
  const linhas: LinhaPonte[] = [];
  for (const k of ordem) {
    if (!ix.tem("edu.despesa.ponte_matricula", cod, ano, null, k)) continue;
    const p = ix.ponto("edu.despesa.ponte_matricula", cod, ano, null, k);
    if (p.valor === null) continue;
    if (k !== "dca_total" && k !== "ad_demais_elementos" && k !== "ad_beneficiario_indeterminado" && Math.abs(p.valor) < 0.005) continue;
    linhas.push({ componente: k, rotulo: ROTULO_COMPONENTE[k] ?? k, valor: p.valor, participacao: total.valor ? (100 * p.valor) / total.valor : null, dentro: k === "ad_demais_elementos" || k === "ad_beneficiario_indeterminado" });
  }
  return { linhas, total: total.valor, reconcilia: total.elegivel };
}
