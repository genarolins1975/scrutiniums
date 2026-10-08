import { mesAno, mesAnoCurto, num } from "./formato";
import { datasLegiveis } from "./visao";
import type { Proveniencia } from "./tipos";
import type { ColunaTabela, LinhaTabela } from "./tabela";
import type { ResultadoTeste } from "./evidencia";
import type {
  ConferenciaInfoMercado,
  EstadoPainel,
  MercadoGold,
  PagamentoMensal,
  PainelMercado,
  ProvenienciaMercado,
  SituacaoLiquidacao,
} from "./tipos-mercado";

/**
 * Derivações puras das páginas do módulo Mercado (P032 a P035): séries dos gráficos, linhas
 * das tabelas equivalentes e rótulos de estado. Nada aqui recalcula indicador: participações,
 * fatores e somas de 12 meses chegam prontos da gold (pipeline/energia/modulos/mercado.py); a
 * página só escolhe colunas, ordena e converte unidade de exibição (R$ para R$ milhões, MWh
 * para TWh). Ausência continua ausência: null vira lacuna no gráfico e "sem dado" na tabela, e
 * os meses que a fonte não publicou ou publicou como zero não confirmado levam o motivo escrito.
 */

/* ---------------------------------------------------------------- páginas */

export const PAGINAS_MERCADO = [
  { id: "livre-regulado", href: "/setor-eletrico/mercado", rotulo: "Livre e regulado", painel: "P032" },
  { id: "agentes", href: "/setor-eletrico/mercado/agentes", rotulo: "Agentes e migração", painel: "P033" },
  { id: "mre-gsf", href: "/setor-eletrico/mercado/mre-e-gsf", rotulo: "MRE e GSF", painel: "P034" },
  { id: "encargos", href: "/setor-eletrico/mercado/encargos", rotulo: "Encargos e liquidação", painel: "P035" },
] as const;

export type IdPaginaMercado = (typeof PAGINAS_MERCADO)[number]["id"];
export type IdPainelMercado = PainelMercado["id"];

export const URL_GOLD_MERCADO = "/energia/gold/mercado.json";
export const URL_DETALHE_MERCADO = "/energia/series/mercado_detalhe.json";

export const CSV_MERCADO = {
  nacional: { rotulo: "EPE e SAMP, Brasil por mês (CSV)", url: "/energia/series/mercado_nacional_mensal.csv" },
  consumo: { rotulo: "EPE por região, subsistema e classe (CSV)", url: "/energia/series/mercado_consumo_mensal.csv" },
  uf: { rotulo: "EPE por UF (CSV)", url: "/energia/series/mercado_consumo_uf.csv" },
  ccee: { rotulo: "Séries da CCEE por conjunto (CSV)", url: "/energia/series/mercado_ccee_mensal.csv" },
  distribuidorasAno: { rotulo: "Distribuidoras no ano, SAMP (CSV)", url: "/energia/series/mercado_distribuidoras_ano.csv" },
  distribuidorasMes: { rotulo: "Distribuidoras por mês, SAMP (CSV)", url: "/energia/series/mercado_distribuidoras_mensal.csv" },
  desligamentos: { rotulo: "Desligamentos da CCEE (CSV)", url: "/energia/series/mercado_ccee_desligamentos.csv" },
  agentesAneel: { rotulo: "Agentes cadastrados na ANEEL (CSV)", url: "/energia/series/mercado_agentes_aneel.csv" },
  contaBandeira: { rotulo: "Conta Bandeira por distribuidora (CSV)", url: "/energia/series/mercado_conta_bandeira.csv" },
  encargosMme: { rotulo: "Encargos no boletim do MME (CSV)", url: "/energia/series/mercado_encargos_mme.csv" },
} as const;

/**
 * Proveniência com as datas soltas do texto do pipeline ("2023-07 a 2026-08") escritas como na
 * página ("jul/2023 a ago/2026"); identificadores com data (VALOR_INAD@2026-07) ficam como estão.
 */
export function provenienciaLegivel(p: Proveniencia): Proveniencia {
  return {
    ...p,
    notas_fonte: p.notas_fonte === null ? null : datasLegiveis(p.notas_fonte),
    limitacoes: p.limitacoes.map(datasLegiveis),
    transformacoes: p.transformacoes.map(datasLegiveis),
  };
}

export function provenienciasLegiveis(g: MercadoGold): ProvenienciaMercado {
  return Object.fromEntries(Object.entries(g.proveniencia).map(([k, v]) => [k, provenienciaLegivel(v)])) as ProvenienciaMercado;
}

export function painelMercado(g: MercadoGold, id: IdPainelMercado): PainelMercado | null {
  return g.paineis.find((p) => p.id === id) ?? null;
}

export const ROTULO_ESTADO: Record<EstadoPainel, string> = {
  concluido_com_limitacao: "concluído com limitação",
  parcial: "parcial",
  bloqueado: "bloqueado",
  pendente_decisao_acesso: "pendente de decisão sobre o acesso à CCEE",
};

export const ROTULO_RESULTADO: Record<ResultadoTeste, string> = { aprovado: "aprovado", ressalva: "com ressalva", reprovado: "reprovado" };

/** "AAAA-MM" de um período como texto da página: "set/2025 a ago/2026" ou um só mês. */
export function textoPeriodoMes(p: { inicio: string; fim: string } | null | undefined): string {
  if (!p) return "período não publicado";
  return p.inicio === p.fim ? mesAno(p.inicio) : `${mesAno(p.inicio)} a ${mesAno(p.fim)}`;
}

/** Valor em reais como texto curto: "R$ 1,60 bilhão", "R$ 958,1 milhões" (o mesmo critério das evidências). */
export function reaisCurto(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${num(v / 1e9, 2)} ${Math.abs(v / 1e9) < 2 ? "bilhão" : "bilhões"}`;
  if (a >= 1e6) return `R$ ${num(v / 1e6, 1)} ${Math.abs(v / 1e6) < 2 ? "milhão" : "milhões"}`;
  return `R$ ${num(v, 0)}`;
}

/** Mês curto para o eixo das barras ("mai/23"): o rótulo longo não cabe em 40 categorias. */
export const mesCurto = mesAnoCurto;

const milhoes = (v: number | null | undefined) => (v === null || v === undefined ? null : v / 1e6);
const bilhoes = (v: number | null | undefined) => (v === null || v === undefined ? null : v / 1e9);

/* ---------------------------------------------------------------- P032: livre e regulado */

/** Participação do mercado livre no consumo na rede (EPE), mês a mês desde epe_mensal_desde. */
export function serieLivreEpe(g: MercadoGold) {
  return g.livre_regulado.epe_mensal.map((m) => ({ mes: m.mes, livre: m.livre_pct }));
}

/** Série anual da EPE desde 2004, só anos completos (o ano aberto fica fora do gráfico e na tabela). */
export function serieLivreEpeAnual(g: MercadoGold) {
  return g.livre_regulado.epe_anual.filter((a) => a.completo).map((a) => ({ ano: a.ano, livre: a.livre_pct }));
}

/** Consumo contabilizado pela CCEE por ambiente, em MW médios: ACR, ACL e exportação empilhados. */
export function serieAmbientesCcee(g: MercadoGold) {
  return g.livre_regulado.ccee_mensal.map((m) => ({ mes: m.mes, rotulo: mesCurto(m.mes), acr: m.acr_mwmed, acl: m.acl_mwmed, exportacao: m.exportacao_mwmed }));
}

/** Participação do livre nos dois universos mensais (EPE na rede e CCEE no centro de gravidade). */
export function serieComparacaoUniversos(g: MercadoGold) {
  return g.livre_regulado.comparacao_universos.map((c) => ({ mes: c.mes, epe: c.epe_livre_pct, ccee: c.ccee_acl_pct }));
}

/** Participação do livre por UF nos últimos 12 meses, da maior para a menor. */
export function barrasUf(g: MercadoGold) {
  return [...g.livre_regulado.epe_uf_12m]
    .filter((u) => u.livre_pct !== null)
    .sort((a, b) => (b.livre_pct ?? 0) - (a.livre_pct ?? 0))
    .map((u) => ({ uf: u.chave, livre: u.livre_pct }));
}

/** Último ano completo da abertura por classe da EPE (ou null). */
export function anoClasseCompleto(g: MercadoGold): string | null {
  const anos = g.livre_regulado.epe_classe_anual.filter((x) => x.completo).map((x) => x.ano);
  return anos.length ? anos.sort().at(-1)! : null;
}

export function barrasClasse(g: MercadoGold, ano: string) {
  return g.livre_regulado.epe_classe_anual
    .filter((x) => x.ano === ano)
    .sort((a, b) => (b.livre_pct ?? 0) - (a.livre_pct ?? 0))
    .map((x) => ({ classe: x.chave, livre: x.livre_pct, cativoTwh: x.cativo_mwh / 1e6, livreTwh: x.livre_mwh / 1e6 }));
}

/** Abertura dos últimos 12 meses por subsistema da EPE (os quatro submercados e os sistemas isolados). */
export const NOME_SUBSISTEMA: Record<string, string> = { SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte", ISOL: "Sistemas isolados" };

export const COLUNAS_DISTRIBUIDORAS: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "livre_gwh", rotulo: "Livre faturado", tipo: "numero", unidade: "GWh", casas: 0 },
  { id: "cativo_gwh", rotulo: "Cativo faturado", tipo: "numero", unidade: "GWh", casas: 0 },
  { id: "livre_pct", rotulo: "Livre na energia faturada", tipo: "percentual", casas: 1 },
  { id: "livre_uc", rotulo: "Unidades livres em dezembro", tipo: "numero", casas: 0 },
  { id: "variacao_uc", rotulo: "Variação no ano", tipo: "numero", casas: 0 },
  { id: "incentivada", rotulo: "Livres incentivadas", tipo: "numero", casas: 0 },
  { id: "observacao", rotulo: "Observação", tipo: "texto" },
];

export function linhasDistribuidoras(g: MercadoGold): LinhaTabela[] {
  return g.livre_regulado.distribuidoras.linhas.map((d) => ({
    id: d.cnpj,
    sigla: d.sigla ?? d.cnpj,
    livre_gwh: d.livre_mwh === null ? null : d.livre_mwh / 1e3,
    cativo_gwh: d.cativo_mwh === null ? null : d.cativo_mwh / 1e3,
    livre_pct: d.livre_pct_faturada,
    livre_uc: d.livre_uc_dez,
    variacao_uc: d.variacao_livre_uc,
    incentivada: d.livre_uc_incentivada_dez,
    observacao: [!d.completo ? `${d.meses} meses no ano: sem participação anual` : "", d.meses_repetidos.length ? `meses repetidos na fonte: ${d.meses_repetidos.map((m) => mesAno(m.slice(0, 7)) + m.slice(7)).join(", ")}` : ""].filter(Boolean).join("; ") || null,
  }));
}

export const COLUNAS_SAMP: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "data" },
  { id: "distribuidoras", rotulo: "Distribuidoras", tipo: "numero", casas: 0 },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "livre_uc", rotulo: "Unidades livres (SAMP)", tipo: "numero", casas: 0 },
  { id: "epe_livre_uc", rotulo: "Unidades livres (EPE)", tipo: "numero", casas: 0 },
  { id: "razao", rotulo: "SAMP ÷ EPE", tipo: "percentual", casas: 1 },
  { id: "ocorrencias", rotulo: "Ocorrências", tipo: "texto" },
];

export function linhasSamp(g: MercadoGold): LinhaTabela[] {
  return g.livre_regulado.samp_nacional_mensal.map((s) => ({
    id: s.mes,
    mes: s.mes,
    distribuidoras: s.distribuidoras,
    situacao: s.comparavel ? "comparável" : s.completo ? "completo, fora da comparação" : "incompleto",
    // mês incompleto não entra na razão: o valor não é comparável com a EPE
    livre_uc: s.livre_uc,
    epe_livre_uc: s.epe_livre_uc,
    razao: s.comparavel ? s.samp_sobre_epe_uc_pct : null,
    ocorrencias: [s.motivo_incompleto, ...s.ocorrencias].filter(Boolean).join("; ") || null,
  }));
}

/* ---------------------------------------------------------------- conferências */

export const COLUNAS_INFOMERCADO: ColunaTabela[] = [
  { id: "edicao", rotulo: "InfoMercado", tipo: "texto" },
  { id: "mes", rotulo: "Mês", tipo: "data" },
  { id: "medida", rotulo: "Medida", tipo: "texto" },
  { id: "publicado", rotulo: "Publicado", tipo: "numero", casas: 2 },
  { id: "calculado", rotulo: "Calculado", tipo: "numero", casas: 2 },
  { id: "diferenca", rotulo: "Diferença", tipo: "numero", casas: 2 },
  { id: "tolerancia", rotulo: "Tolerância", tipo: "texto" },
  { id: "resultado", rotulo: "Resultado", tipo: "texto", categorica: true },
  { id: "pagina", rotulo: "Página do PDF", tipo: "texto" },
];

const MEDIDA_INFOMERCADO: Record<string, string> = {
  consumo_contabilizado_mwmed: "Consumo contabilizado (MW médios)",
  exportacao_mwmed: "Exportação (MW médios)",
  acl_variacao_sem_exportacao_pct: "Variação do ACL sem exportação (%)",
  gsf_pct: "GSF do mês (%)",
  gsf_12m_pct: "GSF de 12 meses (%)",
};

export function linhasInfoMercado(c: ConferenciaInfoMercado[]): LinhaTabela[] {
  return c.map((x, i) => ({
    id: `${x.numero}-${x.medida}-${i}`,
    edicao: `Nº ${x.numero}`,
    mes: x.mes,
    medida: MEDIDA_INFOMERCADO[x.medida] ?? x.medida.replace(/_/g, " "),
    publicado: x.publicado,
    calculado: x.calculado,
    diferenca: x.diferenca,
    tolerancia: x.tolerancia,
    resultado: ROTULO_RESULTADO[x.resultado],
    pagina: x.pagina,
  }));
}

/* ---------------------------------------------------------------- P033: agentes e migração */

/** Agentes contabilizados por classe no último mês, da maior para a menor. */
export function barrasAgentesClasse(g: MercadoGold) {
  const u = g.agentes_migracao.agentes_por_classe_mensal.at(-1);
  if (!u) return { mes: null as string | null, linhas: [] as { classe: string; agentes: number }[] };
  return {
    mes: u.mes,
    linhas: Object.entries(u.por_classe)
      .map(([classe, agentes]) => ({ classe, agentes }))
      .sort((a, b) => b.agentes - a.agentes),
  };
}

export function serieAgentesTotal(g: MercadoGold) {
  return g.agentes_migracao.agentes_por_classe_mensal.map((m) => ({ mes: m.mes, total: m.total }));
}

/** Unidades consumidoras livres (EPE), estoque no fim de cada mês. */
export function serieUcsLivres(g: MercadoGold) {
  return g.livre_regulado.epe_mensal.map((m) => ({ mes: m.mes, livres: m.livre_uc }));
}

/** Parcelas de carga do ACL e migrações no mês (CCEE). */
export function serieParcelas(g: MercadoGold) {
  return g.agentes_migracao.parcelas_mensal.map((p) => ({ mes: p.mes, rotulo: mesCurto(p.mes), parcelas: p.parcelas, migracoes: p.migracoes_no_mes }));
}

/** Entradas e saídas da lista de associados (CNPJ), sem o primeiro mês da série (sem mês anterior). */
export function serieFluxosAssociados(g: MercadoGold) {
  return g.agentes_migracao.associados_fluxos
    .filter((f) => f.entradas !== null || f.saidas !== null)
    .map((f) => ({ mes: f.mes, rotulo: mesCurto(f.mes), entradas: f.entradas, saidas: f.saidas }));
}

/** Desligamentos por ano (voluntário e compulsório empilhados); o ano corrente leva "até mês" no rótulo. */
export function barrasDesligamentos(g: MercadoGold) {
  const anos = new Map<string, { ano: string; rotulo: string; voluntario: number | null; compulsorio: number | null }>();
  for (const d of g.agentes_migracao.desligamentos_por_ano) {
    const r = anos.get(d.ano) ?? { ano: d.ano, rotulo: d.completo ? d.ano : `${d.ano} (até ${mesAno(d.ultima_data.slice(0, 7))})`, voluntario: null, compulsorio: null };
    if (d.tipo.startsWith("volunt")) r.voluntario = d.desligamentos;
    else r.compulsorio = d.desligamentos;
    anos.set(d.ano, r);
  }
  return Array.from(anos.values()).sort((a, b) => a.ano.localeCompare(b.ano));
}

export const COLUNAS_PERFIS: ColunaTabela[] = [
  { id: "classe", rotulo: "Classe", tipo: "texto" },
  { id: "perfis_ativo", rotulo: "Perfis ativos", tipo: "numero", casas: 0 },
  { id: "perfis_encerrado", rotulo: "Perfis encerrados", tipo: "numero", casas: 0 },
  { id: "agentes_ativo", rotulo: "Agentes com perfil ativo", tipo: "numero", casas: 0 },
  { id: "agentes_encerrado", rotulo: "Agentes com perfil encerrado", tipo: "numero", casas: 0 },
];

export function linhasPerfis(g: MercadoGold): LinhaTabela[] {
  return g.agentes_migracao.perfis.por_classe.map((p) => ({
    id: p.classe,
    classe: p.classe,
    perfis_ativo: p.perfis_ativo ?? null,
    perfis_encerrado: p.perfis_encerrado ?? null,
    agentes_ativo: p.agentes_ativo ?? null,
    agentes_encerrado: p.agentes_encerrado ?? null,
  }));
}

export const COLUNAS_PARCELAS: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "data" },
  { id: "parcelas", rotulo: "Parcelas do ACL", tipo: "numero", casas: 0 },
  { id: "migracoes", rotulo: "Migrações no mês", tipo: "numero", casas: 0 },
  { id: "perfis", rotulo: "Perfis com parcela", tipo: "numero", casas: 0 },
  { id: "cnpj", rotulo: "CNPJ de carga", tipo: "numero", casas: 0 },
  { id: "consumo_gwh", rotulo: "Consumo das parcelas do ACL e exportação, sem a classe varejista", tipo: "numero", unidade: "GWh", casas: 0 },
  { id: "distribuidoras", rotulo: "Parcelas das distribuidoras (ACR, à parte)", tipo: "numero", casas: 0 },
  { id: "conferencia", rotulo: "Conferência com o consumo por classe", tipo: "texto", categorica: true },
];

export function linhasParcelas(g: MercadoGold): LinhaTabela[] {
  return g.agentes_migracao.parcelas_mensal.map((p) => ({
    id: p.mes,
    mes: p.mes,
    parcelas: p.parcelas,
    migracoes: p.migracoes_no_mes,
    perfis: p.perfis_com_parcela,
    cnpj: p.cnpj_carga,
    consumo_gwh: p.consumo_acl_mwh === null ? null : p.consumo_acl_mwh / 1e3,
    distribuidoras: p.parcelas_distribuidoras,
    conferencia: p.conferencia_ok === null ? "sem conferência" : p.conferencia_ok ? "fecha" : "fora da tolerância (ressalva)",
  }));
}

/* ---------------------------------------------------------------- P034: MRE e GSF */

/** GSF mensal com a linha de 100% (geração igual à garantia física ajustada). */
export function serieGsf(g: MercadoGold) {
  return g.mre_gsf.mensal.map((m) => ({ mes: m.mes, gsf: m.gsf_pct, cem: 100 }));
}

/** Geração do MRE e garantia física ajustada (denominador do GSF), em MW médios, em colunas separadas. */
export function serieGeracaoGarantia(g: MercadoGold) {
  return g.mre_gsf.mensal.map((m) => ({ mes: m.mes, geracao: m.geracao_mre_mwmed, garantia: m.gf_modulada_fdisp_mwmed }));
}

export function barrasSubmercadosGsf(g: MercadoGold) {
  const nome: Record<string, string> = { SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" };
  return g.mre_gsf.submercados_ultimo_mes.linhas.map((l) => ({ id: l.submercado, rotulo: nome[l.submercado] ?? l.submercado, geracao: l.geracao_mre_mwmed, garantia: l.gf_sazonalizada_mwmed }));
}

/** Risco hidrológico do ACR por ano (soma nacional da Conta Bandeira), em R$ bilhões. */
export function barrasRiscoHidrologico(g: MercadoGold) {
  return g.mre_gsf.risco_hidrologico_acr.anual.map((a) => ({
    ano: a.ano,
    rotulo: a.meses < 12 ? `${a.ano} (${a.meses} meses)` : a.ano,
    itaipu: bilhoes(a.rh_itaipu),
    repactuadas: bilhoes(a.rh_repactuadas),
    ccgf: bilhoes(a.rh_ccgf),
  }));
}

export const COLUNAS_GSF: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "data" },
  { id: "gsf", rotulo: "GSF", tipo: "percentual", casas: 2 },
  { id: "geracao", rotulo: "Geração do MRE", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "garantia", rotulo: "Garantia física ajustada", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "cotas", rotulo: "Geração das usinas em cotas", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "disponibilidade", rotulo: "Fator de disponibilidade", tipo: "percentual", casas: 2 },
  { id: "teo", rotulo: "TEO", tipo: "numero", unidade: "R$/MWh", casas: 2 },
];

export function linhasGsf(g: MercadoGold): LinhaTabela[] {
  return g.mre_gsf.mensal.map((m) => ({
    id: m.mes,
    mes: m.mes,
    gsf: m.gsf_pct,
    geracao: m.geracao_mre_mwmed,
    garantia: m.gf_modulada_fdisp_mwmed,
    cotas: m.geracao_mre_cotas_mwmed,
    disponibilidade: m.fator_disponibilidade_pct,
    teo: m.teo_rs_mwh,
  }));
}

/* ---------------------------------------------------------------- P035: encargos e liquidação */

/** ESS por grupo, em R$ milhões, empilhado: restrição de operação, serviços ancilares e os demais tipos. */
export function serieEss(g: MercadoGold) {
  return g.encargos.ess_mensal.map((e) => {
    // o grupo só tem valor quando os quatro tipos foram publicados: ausência não vira zero na soma
    const outros = [e.seguranca_energetica, e.deslocamento_hidraulico, e.importacao, e.reserva_operativa];
    const completos = outros.every((v) => v !== null && v !== undefined);
    return {
      mes: e.mes,
      rotulo: mesCurto(e.mes),
      restricao: milhoes(e.restricao_operacao),
      ancilares: milhoes(e.servicos_ancilares),
      outros: completos ? milhoes(outros.reduce<number>((s, v) => s + (v as number), 0)) : null,
    };
  });
}

export function serieEer(g: MercadoGold) {
  return g.encargos.eer_mensal.map((e) => ({ mes: e.mes, rotulo: mesCurto(e.mes), eer: milhoes(e.encargo_energia_reserva) }));
}

export const ROTULO_LIQUIDACAO: Record<SituacaoLiquidacao, string> = {
  liquidada: "liquidada",
  liquidacao_nao_informada: "liquidação não informada (zero publicado não confirmado)",
  identidade_nao_fecha: "a liquidar ≠ liquidado + inadimplência",
  sem_valor: "sem valor publicado",
  mes_ausente_na_fonte: "mês ausente do conjunto da CCEE",
};

/** Liquidação: liquidado e inadimplência empilhados (somam o valor a liquidar), em R$ milhões; meses sem liquidação ficam vazios. */
export function serieLiquidacao(g: MercadoGold) {
  return g.encargos.liquidacao_mensal.map((l) => ({
    mes: l.mes,
    rotulo: l.situacao === "liquidada" ? mesCurto(l.mes) : `${mesCurto(l.mes)} (sem dado)`,
    liquidado: l.situacao === "liquidada" ? milhoes(l.liquidado) : null,
    inadimplencia: l.situacao === "liquidada" ? milhoes(l.inadimplencia) : null,
  }));
}

export function serieInadimplencia(g: MercadoGold) {
  return g.encargos.liquidacao_mensal.map((l) => ({ mes: l.mes, inadimplencia: l.inadimplencia_pct }));
}

/** Meses da liquidação sem valor, com o motivo, para a nota abaixo do gráfico. */
export function lacunasLiquidacao(g: MercadoGold) {
  return g.encargos.liquidacao_mensal.filter((l) => l.situacao !== "liquidada").map((l) => ({ mes: l.mes, motivo: ROTULO_LIQUIDACAO[l.situacao] }));
}

export const COLUNAS_LIQUIDACAO: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "data" },
  { id: "a_liquidar", rotulo: "A liquidar", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "liquidado", rotulo: "Liquidado", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "inadimplencia", rotulo: "Inadimplência", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "inadimplencia_pct", rotulo: "Inadimplência sobre o valor a liquidar", tipo: "percentual", casas: 1 },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
];

export function linhasLiquidacao(g: MercadoGold): LinhaTabela[] {
  return g.encargos.liquidacao_mensal.map((l) => ({
    id: l.mes,
    mes: l.mes,
    a_liquidar: milhoes(l.a_liquidar),
    liquidado: milhoes(l.liquidado),
    inadimplencia: milhoes(l.inadimplencia),
    inadimplencia_pct: l.inadimplencia_pct,
    situacao: ROTULO_LIQUIDACAO[l.situacao],
  }));
}

const ROTULO_PAGAMENTO: Record<PagamentoMensal["situacao_pagamento_ess"], string> = {
  publicado: "publicado",
  zero_nao_confirmado: "zero publicado em sequência, não confirmado: exibido como nulo",
  sem_valor: "sem valor publicado",
  mes_ausente_na_fonte: "mês ausente do conjunto da CCEE",
};

export const COLUNAS_PAGAMENTO: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "data" },
  { id: "pagamento_ess", rotulo: "Pagamento de ESS", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "situacao", rotulo: "Situação do pagamento de ESS", tipo: "texto", categorica: true },
  { id: "seguranca", rotulo: "Pagamento de segurança energética", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "alivio", rotulo: "Recursos para alívio do ESS", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "excedente", rotulo: "Sobra do excedente financeiro", tipo: "numero", unidade: "R$ milhões", casas: 1 },
];

export function linhasPagamento(g: MercadoGold): LinhaTabela[] {
  return g.encargos.pagamento_mensal.map((p) => ({
    id: p.mes,
    mes: p.mes,
    pagamento_ess: milhoes(p.pagamento_ess),
    situacao: ROTULO_PAGAMENTO[p.situacao_pagamento_ess],
    seguranca: milhoes(p.pagamento_seguranca_energetica),
    alivio: milhoes(p.recursos_alivio_ess),
    excedente: milhoes(p.sobra_excedente_financeiro),
  }));
}

export const COLUNAS_ESS: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "data" },
  { id: "total", rotulo: "ESS (nove tipos)", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "on", rotulo: "Constrained-on", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "off", rotulo: "Constrained-off", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "uc", rotulo: "Unit commitment", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "reativo", rotulo: "Suporte de reativos", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "outros_anc", rotulo: "Outros ancilares", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "seguranca", rotulo: "Segurança energética", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "deslocamento", rotulo: "Deslocamento hidráulico", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "importacao", rotulo: "Importação", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "reserva", rotulo: "Reserva operativa", tipo: "numero", unidade: "R$ milhões", casas: 2 },
  { id: "rd", rotulo: "Resposta da demanda (conjunto próprio)", tipo: "numero", unidade: "R$ milhões", casas: 2 },
];

export function linhasEss(g: MercadoGold): LinhaTabela[] {
  return g.encargos.ess_mensal.map((e) => ({
    id: e.mes,
    mes: e.mes,
    total: milhoes(e.total),
    on: milhoes(e.ro_constrained_on),
    off: milhoes(e.ro_constrained_off),
    uc: milhoes(e.ro_unit_commitment),
    reativo: milhoes(e.suporte_reativo),
    outros_anc: milhoes(e.outros_ancilares),
    seguranca: milhoes(e.seguranca_energetica),
    deslocamento: milhoes(e.deslocamento_hidraulico),
    importacao: milhoes(e.importacao),
    reserva: milhoes(e.reserva_operativa),
    rd: milhoes(e.resposta_demanda),
  }));
}

/* ---------------------------------------------------------------- textos curtos derivados */

/** Frase do estado do painel, com o critério de aceite da especificação. */
export function textoEstado(p: PainelMercado): string {
  const ressalvas = p.verificacoes.filter((v) => v.resultado !== "aprovado");
  const essenciais = ressalvas.filter((v) => v.essencial).length;
  const partes = [`Estado dos dados: ${ROTULO_ESTADO[p.estado_dados]}`];
  partes.push(`${p.verificacoes.length} ${p.verificacoes.length === 1 ? "verificação" : "verificações"}`);
  if (ressalvas.length) partes.push(`${ressalvas.length} com ressalva (${essenciais} no critério de aceite)`);
  return `${partes.join("; ")}.`;
}

/** Variação em pontos percentuais entre a janela atual e a anterior, como texto. */
export function textoVariacaoPp(atual: number | null | undefined, anterior: number | null | undefined): string | null {
  if (atual === null || atual === undefined || anterior === null || anterior === undefined) return null;
  const d = atual - anterior;
  return `${d >= 0 ? "+" : "−"}${num(Math.abs(d), 1)} p.p.`;
}

