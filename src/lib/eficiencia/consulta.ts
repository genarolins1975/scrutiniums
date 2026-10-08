/**
 * Consulta do painel Educação municipal nas capitais: lógica pura, sem React,
 * usada pelo servidor (HTML inicial) e pelo cliente (filtros). Nenhum cálculo
 * contábil acontece aqui: os valores vêm prontos da gold. Esta camada só
 * seleciona, ordena, delimita pares e monta as linhas exibidas e exportadas.
 */
import type { EtapaId, FichaIndicador, IndicadorId, StatusDado } from "./tipos";
import { decimal, inteiro, percentual, reaisCompleto, reaisCurto, reaisExtenso } from "./formato";

/* ------------------------------------------------------------------ payload compacto */

/**
 * [indicador, capital, ano, etapa, componente, valor, status, nota, participação, elegível para comparação,
 *  nota material, situação da conferência, motivo da inelegibilidade, quebra de série]
 * Índices -1 = ausente. Textos (notas e motivos) deduplicados em `notas`; situações em `situacoes`.
 */
export type ObsCompacta = [number, number, number, number, number, number | null, number, number, number | null, 0 | 1, 0 | 1, number, number, 0 | 1];

export type CapitalPainel = { id: string; cod: number; nome: string; uf: string; regiao: string };

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

export class Indice {
  private mapa = new Map<string, Ponto>();
  constructor(readonly d: DadosPainel) {
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

export type MedidaId = "despesa" | "matriculas" | "conveniadas" | "atu" | "aprovacao" | "ideb" | "saeb";
export const MEDIDAS: MedidaId[] = ["despesa", "matriculas", "conveniadas", "atu", "aprovacao", "ideb", "saeb"];

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
  despesa: { id: "despesa", indicador: "edu.despesa.funcao_educacao", rotulo: "Despesa liquidada na função Educação", familia: "recursos", anos: "financeiros", etapas: null },
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
  if (m === "despesa") return moeda === "real" ? "real_2025" : "nominal";
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
  if (m === "matriculas" || m === "conveniadas") return inteiro(v);
  const t = Number.isInteger(v) ? inteiro(v) : decimal(v, 1);
  return m === "aprovacao" ? `${t}%` : t;
}

/** Valor completo, na precisão publicada, para tabela e exportação. */
export function formataCompleto(ind: IndicadorId, v: number): string {
  if (ind === "edu.despesa.funcao_educacao" || ind === "edu.despesa.subfuncao") return reaisCompleto(v);
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
  if (md.anos === "financeiros") return `exercício ${ano}`;
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
    m === "despesa" ? (moeda === "real" ? "reais de 2025" : "reais correntes") : null].filter(Boolean).join(", ");
  const criterio =
    `${grupo === "regiao" ? `Capitais da região ${regiao}` : "Todas as capitais estaduais"}; ${recorte}. ` +
    "Entram as capitais com valor observado e elegível para comparação" +
    (m === "despesa" ? " pela política de conferência da despesa" : "") + ".";
  return { criterio, universoIndicador: f.universo_curto, universo, comValor, incluidas, excluidas, mediana: mediana(incluidas.map((i) => i.valor)) };
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
    String(comp.incluidas.length), f.versao_metodologica, d.meta.gerado_em, d.meta.hash_dados, fonteLegivel(d, md.indicador, ano)];
  const sit = (p: Ponto) => (p.situacao ? d.rotulosSituacao[p.situacao] ?? p.situacao : "");
  const linhas = [
    ...comp.incluidas.map((i) => [...comum(i.cap), String(i.valor), formata(m, i.valor), unidade(m, moeda), ROTULO_STATUS.OBSERVADO,
      "sim", "sim", sit(i.ponto), "", i.ponto.nota ?? "", ...cauda]),
    ...comp.excluidas.map((x) => [...comum(x.cap), x.comValor && x.ponto.valor !== null ? String(x.ponto.valor) : "",
      x.comValor && x.ponto.valor !== null ? formata(m, x.ponto.valor) : "", unidade(m, moeda), ROTULO_STATUS[x.ponto.status],
      x.comValor ? "nao" : "", "nao", sit(x.ponto), x.motivo, x.ponto.nota ?? "", ...cauda]),
  ];
  const ordem = new Map(d.capitais.map((c, i) => [String(c.cod), i]));
  return linhas.sort((a, b) => (ordem.get(a[7]) ?? 0) - (ordem.get(b[7]) ?? 0));
}
