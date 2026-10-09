import { mesAno, mesAnoCurto, num, pct } from "./formato";
import { datasLegiveis } from "./visao";
import type { Proveniencia } from "./tipos";
import type { ColunaTabela, LinhaTabela } from "./tabela";
import type { ResultadoTeste } from "./evidencia";
import type { EntradaDados } from "./tipos-dados";
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

/**
 * Pergunta que é o título de cada página, em até 9 palavras. O painel de cada página faz uma pergunta mais específica (a da gold
 * ou uma sobre a primeira figura), nunca a mesma do título.
 */
export const TITULO_PAGINA_MERCADO: Record<IdPaginaMercado, string> = {
  "livre-regulado": "Como a energia é contratada, alocada e liquidada?",
  agentes: "Quem participa do mercado e como a composição mudou?",
  "mre-gsf": "Como foi o ajuste da garantia física do MRE?",
  encargos: "Quais custos públicos aparecem na liquidação do mercado?",
};

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

/**
 * Nome com que o leitor reconhece os conjuntos abertos da CCEE, cujo título no portal é o próprio código. O texto vem da
 * descrição que o catálogo do observatório já publica para cada conjunto (dados_catalogo.csv); o código fica no recurso e
 * no endereço do conjunto, em Analisar e Auditar ("Sobre este dado").
 */
export const NOME_CONJUNTO_CCEE: Record<string, string> = {
  agente_qtd_contabilizacao: "quantidade de agentes participantes por classe de comercialização",
  consumo_classe_agente: "consumo usado na contabilização do mercado de curto prazo, por classe de agente",
  mre_mensal: "dados do MRE usados na contabilização do mercado de curto prazo",
  encargo_ess_ancilar: "encargos gerados no mercado de curto prazo",
};

export function provenienciasLegiveis(g: MercadoGold): ProvenienciaMercado {
  return Object.fromEntries(
    Object.entries(g.proveniencia).map(([k, v]) => {
      const p = provenienciaLegivel(v);
      const nome = p.fonte.orgao === "CCEE" ? NOME_CONJUNTO_CCEE[p.fonte.dataset] : undefined;
      return [k, nome ? { ...p, fonte: { ...p.fonte, dataset: nome } } : p];
    }),
  ) as ProvenienciaMercado;
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


/** "subiu 4,3%", "caiu 1,2%" ou "não variou": o sentido da variação dito por extenso (a decisão é na precisão exibida). */
export function textoVariacaoVerbo(v: number, casas = 1): string {
  const arred = Number(Math.abs(v).toFixed(casas));
  if (arred === 0) return "não variou";
  return `${v > 0 ? "subiu" : "caiu"} ${num(arred, casas)}%`;
}

/* ---------------------------------------------------------------- vereditos (r8): resposta curta em duas camadas */

/**
 * Cada veredito responde, em palavras simples e com no máximo dois números, à pergunta do título do painel e diz o limite
 * de leitura. Os números saem dos mesmos campos (KPIs) da resposta completa que a gold publica em `paineis[].resposta`,
 * que continua inteira como segunda camada (Analisar e Auditar). Sem o KPI, o veredito é vazio e a página mostra só a
 * mensagem de ausência.
 */

const mesesDoPeriodo = (p: { inicio: string; fim: string }): string[] => {
  const out: string[] = [];
  let [a, m] = p.inicio.split("-").map(Number);
  const [af, mf] = p.fim.split("-").map(Number);
  while (a < af || (a === af && m <= mf)) {
    out.push(`${a}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return out;
};

/** P032: o livre nos dois universos, com a ressalva de que os dois percentuais não se comparam. */
export function vereditoLivreRegulado(g: Pick<MercadoGold, "livre_regulado">): string {
  const k = g.livre_regulado.kpis;
  const epe = k.participacao_livre_12m;
  const ccee = k.participacao_acl_ccee_12m;
  if (!epe && !ccee) return "";
  if (epe && ccee) {
    const igual = epe.periodo.inicio === ccee.periodo.inicio && epe.periodo.fim === ccee.periodo.fim;
    return igual
      ? `Nos 12 meses até ${mesAno(epe.periodo.fim)}, o mercado livre foi ${pct(epe.valor_pct, 1)} do consumo na rede (EPE) e ${pct(ccee.valor_pct, 1)} do consumo contabilizado pela CCEE: os dois percentuais medem universos diferentes e não se comparam.`
      : `O mercado livre foi ${pct(epe.valor_pct, 1)} do consumo na rede (EPE, 12 meses até ${mesAno(epe.periodo.fim)}) e ${pct(ccee.valor_pct, 1)} do consumo contabilizado pela CCEE (12 meses até ${mesAno(ccee.periodo.fim)}): os dois percentuais medem universos diferentes e não se comparam.`;
  }
  if (epe) return `Nos 12 meses até ${mesAno(epe.periodo.fim)}, o mercado livre foi ${pct(epe.valor_pct, 1)} do consumo na rede (EPE). A CCEE não publicou os 12 meses para a segunda medida.`;
  return `Nos 12 meses até ${mesAno(ccee!.periodo.fim)}, o mercado livre foi ${pct(ccee!.valor_pct, 1)} do consumo contabilizado pela CCEE. A EPE não publicou os 12 meses para a segunda medida.`;
}

/** Nota ao lado dos dois percentuais do livre: por que um é da EPE e o outro da CCEE (texto das limitações publicadas). */
export function notaDoisUniversos(g: Pick<MercadoGold, "livre_regulado">): string {
  const k = g.livre_regulado.kpis;
  if (!k.participacao_livre_12m || !k.participacao_acl_ccee_12m) return "";
  return `Os dois percentuais do mercado livre (${pct(k.participacao_livre_12m.valor_pct, 1)} e ${pct(k.participacao_acl_ccee_12m.valor_pct, 1)}) vêm de universos diferentes: a EPE soma o consumo na rede informado pelos agentes; a CCEE contabiliza o consumo referido ao centro de gravidade do submercado, com as perdas da rede básica rateadas, o que o torna maior que o medido no ponto de conexão. A diferença entre as duas não foi decomposta.`;
}

/** P033: o que mudou na composição (unidades livres da EPE) e que as contagens não se somam. */
export function vereditoAgentes(g: Pick<MercadoGold, "agentes_migracao">): string {
  const k = g.agentes_migracao.kpis;
  const u = k.ucs_livres;
  if (!u) {
    return k.agentes_contabilizados ? `Em ${mesAno(k.agentes_contabilizados.mes)}, ${num(k.agentes_contabilizados.valor, 0)} agentes participaram da contabilização da CCEE. Agente, perfil e unidade consumidora são contagens diferentes e não se somam.` : "";
  }
  const v = u.variacao_12m;
  const dif = v === null || v === undefined ? "" : v > 0 ? `, ${num(v, 0)} a mais que 12 meses antes` : v < 0 ? `, ${num(Math.abs(v), 0)} a menos que 12 meses antes` : ", o mesmo número de 12 meses antes";
  return `O mercado livre tinha ${num(u.valor, 0)} unidades consumidoras em ${mesAno(u.mes)}${dif}. A EPE conta unidades, não empresas; os agentes da CCEE são outra contagem e não se somam a ela.`;
}

/** P034: o GSF do mês e o de 12 meses contra os 100% do gráfico, e que o boletim da CCEE traz outro valor para 12 meses. */
export function vereditoGsf(g: Pick<MercadoGold, "mre_gsf">): string {
  const k = g.mre_gsf.kpis;
  const mes = k.gsf_ultimo_mes;
  const doze = k.gsf_12m;
  if (!mes && !doze) return "";
  const divergente = g.mre_gsf.reconciliacao_infomercado.some((x) => x.medida === "gsf_12m_pct" && x.resultado !== "aprovado");
  const resto = divergente ? " O boletim da CCEE traz outro valor para os 12 meses, que o observatório não reproduz." : "";
  if (mes && doze) {
    const abaixo = mes.valor_pct < 100 && doze.valor_pct < 100 ? ": menos que a garantia" : "";
    return `Em ${mesAno(mes.mes)}, as hidrelétricas do MRE geraram ${pct(mes.valor_pct, 1)} da garantia física ajustada, e ${pct(doze.valor_pct, 1)} nos 12 meses até ${mesAno(doze.periodo.fim)}${abaixo}.${resto}`;
  }
  if (mes) return `Em ${mesAno(mes.mes)}, as hidrelétricas do MRE geraram ${pct(mes.valor_pct, 1)} da garantia física ajustada. Os 12 meses não estão publicados.`;
  return `Nos 12 meses até ${mesAno(doze!.periodo.fim)}, as hidrelétricas do MRE geraram ${pct(doze!.valor_pct, 1)} da garantia física ajustada.${resto}`;
}

/** P035: os dois encargos dos 12 meses, ditos como valores de competência (o mês da contabilização), não de pagamento. */
export function vereditoEncargos(g: Pick<MercadoGold, "encargos">): string {
  const k = g.encargos.kpis;
  const ess = k.ess_12m;
  const eer = k.eer_12m;
  if (!ess && !eer) return "";
  if (ess && eer) {
    return `Nos 12 meses até ${mesAno(ess.periodo.fim)}, os encargos de serviços do sistema somaram ${reaisCurto(ess.valor_rs)} e o encargo de energia de reserva, ${reaisCurto(eer.valor_rs)}. São valores do mês de contabilização, não do pagamento.`;
  }
  const um = ess ?? eer!;
  return `Nos 12 meses até ${mesAno(um.periodo.fim)}, ${ess ? "os encargos de serviços do sistema somaram" : "o encargo de energia de reserva somou"} ${reaisCurto(um.valor_rs)}. São valores do mês de contabilização, não do pagamento.`;
}

/** Veredito do painel pelo id; vazio quando o dado falta. */
export function vereditoPainelMercado(g: MercadoGold, id: IdPainelMercado): string {
  switch (id) {
    case "P032":
      return vereditoLivreRegulado(g);
    case "P033":
      return vereditoAgentes(g);
    case "P034":
      return vereditoGsf(g);
    case "P035":
      return vereditoEncargos(g);
  }
}

/**
 * Conciliação do ESS do boletim do MME (seis meses, com a resposta da demanda) com o ESS de 12 meses da CCEE: o boletim
 * soma `periodo` e inclui a resposta da demanda; o conjunto aberto da CCEE nos mesmos meses fecha com o boletim sem ela.
 * Null quando falta o KPI do boletim, o do conjunto da CCEE ou algum mês do conjunto.
 */
export function conciliacaoEssMme(g: Pick<MercadoGold, "encargos">): {
  periodo: { inicio: string; fim: string };
  meses: number;
  mmeMilRs: number;
  respostaDemandaMilRs: number | null;
  cceeRs: number;
  ess12mRs: number;
  periodo12m: { inicio: string; fim: string };
} | null {
  const e = g.encargos;
  const mme = e.kpis.ess_mme_ano;
  const doze = e.kpis.ess_12m;
  if (!mme || !doze) return null;
  const meses = mesesDoPeriodo(mme.periodo);
  const totais = meses.map((m) => e.ess_mensal.find((x) => x.mes === m)?.total);
  if (totais.some((t) => t === null || t === undefined)) return null;
  const rd = meses.map((m) => e.mme.vigente.find((x) => x.tipo === "resposta_demanda" && x.mes === m)?.valor_mil_rs);
  return {
    periodo: mme.periodo,
    meses: meses.length,
    mmeMilRs: mme.valor_mil_rs,
    respostaDemandaMilRs: rd.every((v) => v !== undefined) ? (rd as number[]).reduce((s, v) => s + v, 0) : null,
    cceeRs: (totais as number[]).reduce((s, v) => s + v, 0),
    ess12mRs: doze.valor_rs,
    periodo12m: doze.periodo,
  };
}

/** Frase que explica por que o ESS do boletim do MME e o ESS de 12 meses não se comparam. */
export function notaEssMme(g: Pick<MercadoGold, "encargos">): string {
  const c = conciliacaoEssMme(g);
  if (!c) return "";
  const rd = c.respostaDemandaMilRs === null ? "inclui a resposta da demanda" : `inclui ${reaisCurto(c.respostaDemandaMilRs * 1e3)} de resposta da demanda`;
  return `O cartão do boletim do MME (${reaisCurto(c.mmeMilRs * 1e3)}) soma ${c.meses} meses, ${mesAno(c.periodo.inicio)} a ${mesAno(c.periodo.fim)}, e ${rd}; nesses meses, o ESS da CCEE é ${reaisCurto(c.cceeRs)}. Por isso ele não se compara com os ${reaisCurto(c.ess12mRs)} de 12 meses (${mesAno(c.periodo12m.inicio)} a ${mesAno(c.periodo12m.fim)}), que não incluem a resposta da demanda.`;
}

/**
 * Nota do GSF de 12 meses: três valores em três recortes. O do cartão é do observatório na janela mais recente; o do
 * boletim da CCEE (InfoMercado) tem a janela dele, que termina um mês antes; o terceiro é o do observatório nessa janela.
 */
export function notaGsfDozeMeses(g: Pick<MercadoGold, "mre_gsf">): string {
  const k = g.mre_gsf.kpis;
  const div = g.mre_gsf.reconciliacao_infomercado.find((x) => x.medida === "gsf_12m_pct" && x.resultado !== "aprovado");
  const base = "soma da geração dos 12 meses sobre a soma da garantia física ajustada";
  if (!div || div.publicado === null || div.calculado === null || div.diferenca === null) return base;
  const inicio = mesAno(mesesAntes(div.mes, 11));
  const janela = `${inicio} a ${mesAno(div.mes)}`;
  const cartao = k.gsf_12m ? `${pct(k.gsf_12m.valor_pct, 1)}, de ${textoPeriodoMes(k.gsf_12m.periodo)}` : "";
  return (
    `${base}. Três valores, três recortes: o InfoMercado Nº ${div.numero}, boletim mensal da CCEE, publica ${num(div.publicado, 2)}% para o ajuste médio de 12 meses até ${mesAno(div.mes)}; ` +
    `na mesma janela (${janela}) a razão de energias do observatório dá ${num(div.calculado, 2)}%, ${num(Math.abs(div.diferenca), 2)} pontos percentuais abaixo, diferença que a fonte não explica` +
    (cartao ? `; o cartão mostra ${cartao}. O valor do cartão é o da janela mais recente` : "")
  );
}

/** Mês AAAA-MM n meses antes de outro. */
export function mesesAntes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) - n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------- o que ainda não aparece (estado honesto) */

/** "2023 a 2025" para três anos seguidos ou mais, "2023 e 2024" para dois, "2023, 2025 e 2026" para anos soltos. */
export function textoAnos(anos: readonly string[]): string {
  const a = Array.from(new Set(anos)).sort();
  if (a.length <= 1) return a[0] ?? "";
  const n = a.map(Number);
  const seguidos = n.every((v, i) => i === 0 || v === n[i - 1] + 1);
  if (a.length > 2 && seguidos) return `${a[0]} a ${a[a.length - 1]}`;
  return `${a.slice(0, -1).join(", ")} e ${a[a.length - 1]}`;
}

export type ItemAusenteMercado = { id: string; titulo: string; texto: string; paineis: string[] };

const TITULO_PENDENCIA: Record<string, string> = {
  infomercado_dados_gerais: "Séries da CCEE antes de 2023",
  historico_perfis: "Fluxo mensal de perfis de agentes",
};

/**
 * O que a gold declara como não integrado (pendências) ou como inacessível (bloqueios), em frases de Entender: o título e o texto
 * saem do campo `efeito` de cada item e, no bloqueio do boletim do MME, dos anos cujas pastas pedem login. Nenhum código de
 * conjunto nem identificador interno entra no texto; a descrição completa e a evidência ficam em Analisar.
 */
export function itensAusentesMercado(g: Pick<MercadoGold, "pendencias" | "bloqueios">): ItemAusenteMercado[] {
  const pend = g.pendencias.map((p) => ({ id: p.id, titulo: TITULO_PENDENCIA[p.id] ?? "Dado ainda não integrado", texto: p.efeito, paineis: p.paineis }));
  const bloq = g.bloqueios.map((b) => {
    const pastas = (b.evidencia.pastas ?? []).filter((x) => x.redireciona_login);
    const anos = textoAnos(pastas.map((x) => String(x.ano)));
    const acesso = pastas.length ? `As pastas de ${anos} do Boletim de Monitoramento do MME pedem login, e o observatório não tentou outro caminho de acesso. ` : "";
    return { id: b.id, titulo: pastas.length ? `Boletim de Monitoramento do MME, ${anos}` : "Fonte com acesso bloqueado", texto: `${acesso}${b.efeito}`, paineis: b.paineis };
  });
  return [...pend, ...bloq];
}

export type EntradaCatalogoMercado = Pick<EntradaDados, "id" | "orgao" | "estado" | "titulo"> & { paginas?: { rotulo: string; href: string }[] };

/**
 * O que o catálogo do observatório diz das fontes do módulo: quantas estão publicadas nas páginas de mercado (por órgão) e quantos
 * conjuntos de montantes de contratos da CCEE estão só verificados ou catalogados, sem integração. A contagem sai do catálogo
 * publicado; quando um conjunto de contrato é integrado, ele deixa de contar e a frase desaparece sozinha.
 */
export function resumoCatalogoMercado(entradas: readonly EntradaCatalogoMercado[]): { publicadas: number; porOrgao: { orgao: string; n: number }[]; contratos: number; contratosSoVerificados: boolean } {
  const dePagina = entradas.filter((e) => (e.paginas ?? []).some((p) => p.href.startsWith("/setor-eletrico/mercado")));
  const publicadas = dePagina.filter((e) => e.estado === "PUBLICADO");
  const contagem = new Map<string, number>();
  publicadas.forEach((e) => contagem.set(e.orgao, (contagem.get(e.orgao) ?? 0) + 1));
  const contratos = entradas.filter((e) => e.orgao === "CCEE" && e.id.startsWith("ccee:contrato_montante_") && (e.estado === "CATALOGADO" || e.estado === "RECURSO VERIFICADO"));
  return {
    publicadas: publicadas.length,
    porOrgao: Array.from(contagem).map(([orgao, n]) => ({ orgao, n })).sort((a, b) => b.n - a.n || a.orgao.localeCompare(b.orgao, "pt-BR")),
    contratos: contratos.length,
    contratosSoVerificados: contratos.length > 0 && contratos.every((e) => e.estado === "RECURSO VERIFICADO"),
  };
}

const DO_ORGAO: Record<string, string> = { CCEE: "da", ANEEL: "da", EPE: "da", MME: "do", ONS: "do" };

/** "24 fontes publicadas nestas páginas: 18 da CCEE, 3 da ANEEL, 2 da EPE e 1 do MME." */
export function textoFontesPublicadas(r: Pick<ReturnType<typeof resumoCatalogoMercado>, "publicadas" | "porOrgao">): string {
  if (!r.publicadas) return "";
  const partes = r.porOrgao.map((o) => `${num(o.n, 0)} ${DO_ORGAO[o.orgao] ?? "de"} ${o.orgao}`);
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0];
  return `${num(r.publicadas, 0)} ${r.publicadas === 1 ? "fonte publicada" : "fontes publicadas"} nestas páginas: ${lista}.`;
}

/** Frase do que falta em contratos de energia; null quando nenhum conjunto de montantes de contrato está só verificado ou catalogado. */
export function textoContratosAusentes(r: Pick<ReturnType<typeof resumoCatalogoMercado>, "contratos" | "contratosSoVerificados">): string | null {
  if (!r.contratos) return null;
  const conjuntos = `${num(r.contratos, 0)} ${r.contratos === 1 ? "conjunto de dados aberto" : "conjuntos de dados abertos"} com montantes de contratos de energia`;
  const estado = r.contratosSoVerificados ? "O observatório confirmou que os arquivos existem, mas ainda não os integrou" : "O observatório ainda não os integrou";
  return `A CCEE publica ${conjuntos}. ${estado}: por isso nenhum montante contratado aparece nestas páginas. O observatório também não publica preço de contrato.`;
}

const ROTULO_ESTADO_CATALOGO: Record<string, string> = {
  PUBLICADO: "publicado",
  "RECURSO VERIFICADO": "recurso verificado (acessível), não integrado",
  CATALOGADO: "catalogado, recurso não verificado",
};

/** Linhas da tabela de Auditar com as fontes do módulo no catálogo: as publicadas nas páginas de mercado e os conjuntos de contratos sem integração. */
export function linhasCatalogoMercado(entradas: readonly EntradaCatalogoMercado[]): (string | number | null)[][] {
  const contratos = (e: EntradaCatalogoMercado) => e.orgao === "CCEE" && e.id.startsWith("ccee:contrato_montante_") && (e.estado === "CATALOGADO" || e.estado === "RECURSO VERIFICADO");
  const publicada = (e: EntradaCatalogoMercado) => e.estado === "PUBLICADO" && (e.paginas ?? []).some((p) => p.href.startsWith("/setor-eletrico/mercado"));
  return entradas
    .filter((e) => publicada(e) || contratos(e))
    .slice()
    .sort((a, b) => Number(contratos(a)) - Number(contratos(b)) || a.orgao.localeCompare(b.orgao, "pt-BR") || a.id.localeCompare(b.id))
    .map((e) => [
      e.orgao,
      e.titulo,
      ROTULO_ESTADO_CATALOGO[e.estado] ?? e.estado.toLowerCase(),
      (e.paginas ?? []).filter((p) => p.href.startsWith("/setor-eletrico/mercado")).map((p) => p.rotulo).join("; ") || "nenhuma página",
    ]);
}

/**
 * Quantas vezes o consumo da CCEE é o da EPE no último mês que os dois universos publicam: o ACR da CCEE sobre o cativo da EPE e o
 * ACL da CCEE (sem a exportação) sobre o livre da EPE. Mostra de onde vem a diferença entre os dois percentuais do mercado livre,
 * sem decompô-la. Null quando falta algum dos quatro valores.
 */
export function razoesCceeSobEpe(g: Pick<MercadoGold, "livre_regulado">): { mes: string; regulado: number; livre: number } | null {
  const lr = g.livre_regulado;
  for (let i = lr.ccee_mensal.length - 1; i >= 0; i--) {
    const c = lr.ccee_mensal[i];
    const e = lr.epe_mensal.find((x) => x.mes === c.mes);
    if (e && e.cativo_mwh && e.livre_mwh && c.acr_mwh !== null && c.acr_mwh !== undefined && c.acl_mwh !== null && c.acl_mwh !== undefined) {
      return { mes: c.mes, regulado: c.acr_mwh / e.cativo_mwh, livre: c.acl_mwh / e.livre_mwh };
    }
  }
  return null;
}

/** "em ago/2026 a CCEE mede 1,21 vez o consumo cativo da EPE no ambiente regulado e 1,04 vez o livre, ou seja, a diferença vem sobretudo do regulado"; vazio sem os valores. */
export function textoRazaoUniversos(g: Pick<MercadoGold, "livre_regulado">): string {
  const r = razoesCceeSobEpe(g);
  if (!r) return "";
  const vez = (v: number) => `${num(v, 2)} ${v < 2 ? "vez" : "vezes"}`;
  const dif = r.regulado - r.livre;
  const origem = Math.abs(dif) < 0.03 ? "aparece nos dois ambientes" : dif > 0 ? "vem sobretudo do regulado" : "vem sobretudo do livre";
  return `em ${mesAno(r.mes)} a CCEE mede ${vez(r.regulado)} o consumo cativo da EPE no ambiente regulado e ${vez(r.livre)} o livre, ou seja, a diferença ${origem}`;
}

