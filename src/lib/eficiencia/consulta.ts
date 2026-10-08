/**
 * Consulta do painel Educação municipal nas capitais: lógica pura, sem React,
 * usada pelo servidor (HTML inicial) e pelo cliente (filtros). Nenhum cálculo
 * contábil acontece aqui: os valores vêm prontos da gold. Esta camada só
 * seleciona, ordena, delimita pares e monta as linhas exibidas e exportadas.
 */
import type { EtapaId, FichaIndicador, IndicadorId, StatusDado } from "./tipos";
import { decimal, inteiro, percentual, reaisCompleto, reaisCurto, reaisExtenso } from "./formato";

/* ------------------------------------------------------------------ payload compacto */

/** [indicador, capital, ano, etapa, componente, valor, status, nota, participação, comparável] */
export type ObsCompacta = [number, number, number, number, number, number | null, number, number, number | null, 0 | 1];

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
  fontes: Record<string, { instituicao: string; conjunto: string; pagina: string; capturado_em: string }>;
  meta: { gerado_em: string; versao_pipeline: string; versao_codigo: string | null; hash_dados: string };
  excluidos: { nome: string; uf: string; motivo: string }[];
};

export type Ponto = {
  valor: number | null;
  status: StatusDado;
  nota: string | null;
  participacao: number | null;
  comparavel: boolean;
  fonte: string | null;
};

const SEM_OBS: Ponto = {
  valor: null,
  status: "AUSENTE_NA_COLETA",
  nota: "Sem registro para este recorte",
  participacao: null,
  comparavel: true,
  fonte: null,
};

export class Indice {
  private mapa = new Map<string, Ponto>();
  constructor(readonly d: DadosPainel) {
    for (const o of d.obs) {
      const [i, c, a, e, k, v, s, n, p, comp] = o;
      const chave = Indice.chave(d.indicadores[i], d.capitais[c].cod, a, e < 0 ? null : d.etapas[e].id, k < 0 ? null : d.componentes[k]);
      this.mapa.set(chave, {
        valor: v,
        status: d.status[s],
        nota: n < 0 ? null : d.notas[n],
        participacao: p,
        comparavel: comp === 1,
        fonte: null,
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

export type ItemComparacao = { cap: CapitalPainel; valor: number };
export type ExcluidoComparacao = { cap: CapitalPainel; status: StatusDado; motivo: string };

export type Comparacao = {
  criterio: string;
  universo: CapitalPainel[];
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
  for (const cap of universo) {
    const p = ix.ponto(MEDIDA[m].indicador, cap.cod, ano, e, k);
    if (p.status !== "OBSERVADO" || p.valor === null) {
      excluidas.push({ cap, status: p.status, motivo: p.nota ?? "" });
    } else if (!p.comparavel) {
      excluidas.push({ cap, status: "NAO_COMPARAVEL", motivo: p.nota ?? "" });
    } else {
      incluidas.push({ cap, valor: p.valor });
    }
  }
  if (ordem === "valor") incluidas.sort((a, b) => a.valor - b.valor || a.cap.nome.localeCompare(b.cap.nome, "pt-BR"));
  const regiao = d.regioes[capSel.regiao];
  const criterio =
    (grupo === "regiao" ? `Capitais da região ${regiao}` : "Todas as capitais estaduais") +
    `, rede municipal, ${ano}${e ? `, ${nomeEtapa(d, e)}` : ""}, mesma definição e mesma fonte; entram as capitais com valor observado e comparável.`;
  return { criterio, universo, incluidas, excluidas, mediana: mediana(incluidas.map((i) => i.valor)) };
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
  etapa: string;
  componente: string;
  periodo: string;
  valor: string;
  unidade: string;
  status: StatusDado;
  nota: string;
  fonte: string;
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
  NAO_COMPARAVEL: "Não comparável",
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
    let valor = o[5] === null ? "" : formataCompleto(ind, o[5]);
    if (ind === "edu.despesa.subfuncao" && o[8] !== null && o[5] !== null) valor += ` (${percentual(o[8], 1)})`;
    out.push({
      indicador: ind,
      medida: f.nome_curto,
      etapa: etapa?.nome ?? "Não se aplica",
      componente: rotuloComponente(d, ind, k),
      periodo: rotuloPeriodo(ind, o[2]),
      valor,
      unidade: ind === "edu.despesa.subfuncao" ? "R$ (% da função)" : k === "real_2025" ? "R$ de 2025" : f.unidade,
      status: st,
      nota: o[7] < 0 ? "" : d.notas[o[7]],
      fonte: fonteLegivel(d, ind, o[2]),
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

export const CABECALHO_TABELA = ["Medida", "Etapa", "Componente", "Período", "Valor", "Unidade", "Estado do dado", "Nota", "Fonte"];

export function linhasCsvTabela(linhas: LinhaTabela[]): string[][] {
  return linhas.map((l) => [l.medida, l.etapa, l.componente, l.periodo, l.valor, l.unidade, ROTULO_STATUS[l.status], l.nota, l.fonte]);
}
