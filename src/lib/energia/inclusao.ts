/**
 * Lógica pura da página Inclusão energética (/setor-eletrico/inclusao-energetica),
 * sem React e testável em node (src/tests/energia-inclusao.test.ts).
 *
 * Por que um arquivo próprio: os componentes "use client" só exportam componentes,
 * e as mesmas linhas precisam alimentar o gráfico, a tabela equivalente e a
 * exportação (seção 11.7 da especificação: "equivalência entre gráfico, tabela e
 * exportação"). Cada função `linhas*` ou `dados*` monta UMA matriz que o gráfico e
 * a tabela recebem iguais; o teste confere essa matriz contra os CSV publicados
 * pelo pipeline (pipeline/energia/modulos/inclusao.py).
 *
 * O que fica aqui:
 *  - seleção, ordenação e conversão de unidade (UC para milhões de UC, R$ para R$
 *    milhões) de números publicados na gold; nenhuma razão, média ou soma é
 *    refeita: a fórmula roda no pipeline, a interface só lê;
 *  - as respostas curtas e os textos "o que mudou" de cada painel, gerados por
 *    regra determinística a partir dos números publicados (seção 7.4). Nenhuma
 *    frase traz número fixo: todo número vem do argumento, e a ausência vira
 *    "sem dado";
 *  - os esquemas de estado na URL (useEstadoUrl), que precisam ser constantes de
 *    módulo, e a tabela oficial de códigos de UF do IBGE (os mapas usam o código,
 *    a gold usa a sigla).
 *
 * Unidades nunca se misturam (ver tipos-inclusao.ts): UC (SCS), fatura (CDE),
 * família (Cadastro Único e POF), domicílio (PNAD e Luz para Todos) e pessoa
 * (PASI). Cada função diz a sua.
 */
import type {
  CoberturaUf,
  Cobertura,
  DistribuidoraTsee,
  EstimativaPof,
  InclusaoGold,
  LinhaPnad,
  LinhaPof,
  LuzParaTodos,
  MedidaPof,
  MesCde,
  Orcamento,
  PontoCoberturaMensal,
  PontoSerieTsee,
  ProgramaLpt,
  SerieCdeUf,
  SistemasIsolados,
  TarifaSocial,
  UfTsee,
  Acesso,
} from "./tipos-inclusao";
import type { EventoRegulatorio, GoldRegulacao } from "./tipos-regulacao";
import { campo, tiposUrl } from "./estadoUrl";
import { quebrasFixas, quebrasQuantis, type Classificacao } from "./escalas";
import { mesAno, num, pct, reais } from "./formato";
import { idiomaEnergia } from "./idioma";
import { dadoTexto, txEm } from "./i18n/conta-inclusao";
import { LIMITE_COMPARACAO, type ColunaTabela } from "./tabela";
import type { Idioma } from "@/lib/idioma";

/* ================================================================ comum */

/**
 * Códigos de UF do IBGE (dois dígitos), os mesmos ids da malha publicada em
 * public/energia/geo/uf.json; o teste confere cada par contra o arquivo da malha.
 */
export const CODIGO_UF: Readonly<Record<string, string>> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};
export const UFS: readonly string[] = Object.keys(CODIGO_UF);
const SIGLA_DO_CODIGO: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(CODIGO_UF).map(([s, c]) => [c, s]));

export function codigoUf(sigla: string): string | null {
  return CODIGO_UF[sigla] ?? null;
}
export function siglaDoCodigo(codigo: string | null | undefined): string | null {
  return codigo ? (SIGLA_DO_CODIGO[codigo] ?? null) : null;
}

// i18n: dado (forma portuguesa; a tela usa nomeTerritorio, no idioma da página)
export const NOME_TERRITORIO: Readonly<Record<string, string>> = {
  BR: "Brasil",
  "RG-N": "Norte",
  "RG-NE": "Nordeste",
  "RG-SE": "Sudeste",
  "RG-S": "Sul",
  "RG-CO": "Centro-Oeste",
};
const NOME_TERRITORIO_EN: Readonly<Record<string, string>> = {
  BR: "Brazil",
  "RG-N": "North",
  "RG-NE": "Northeast",
  "RG-SE": "Southeast",
  "RG-S": "South",
  "RG-CO": "Center-West",
};
/** Nome do território (Brasil e grandes regiões do IBGE) no idioma; código desconhecido volta como veio. */
export function nomeTerritorio(id: string, idioma: Idioma = idiomaEnergia()): string {
  return (idioma === "en" ? NOME_TERRITORIO_EN : NOME_TERRITORIO)[id] ?? id;
}
export const TERRITORIOS_POF = ["BR", "RG-N", "RG-NE", "RG-SE", "RG-S", "RG-CO"] as const;

/**
 * Ausência dentro de frase. O traço de AUSENTE (formato.ts) serve às células de tabela; no meio
 * de um texto ele se leria como pontuação ("SCS de – a –"), então as funções de
 * texto deste arquivo dizem "sem dado".
 */
export const SEM_DADO = semDado("pt");
/** "sem dado" no idioma ("no data"). */
export function semDado(idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  return tx("sem dado", "no data");
}
const temValor = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

/** "2025-05" → "mai/2025" ("May 2025"); ausência → "sem dado". */
export function mes(m: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return m ? mesAno(m, idioma) : semDado(idioma);
}

/** Inteiro no formato do idioma (contagens de UC, faturas, famílias, domicílios e pessoas); ausência → "sem dado". */
export function inteiro(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? num(v, 0, idioma) : semDado(idioma);
}

/** Percentual, número e reais para frases: como pct, num e reais, com ausência → "sem dado". */
export function pctTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? pct(v, casas, idioma) : semDado(idioma);
}
export function numTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? num(v, casas, idioma) : semDado(idioma);
}
export function reaisTexto(v: number | null | undefined, casas = 2, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? reais(v, casas, idioma) : semDado(idioma);
}

/**
 * Primeira letra minúscula, o resto intacto: o rótulo de classe da POF ("Até R$ 1.908")
 * entra no meio da frase sem virar "até r$ 1.908".
 */
export function minusculaInicial(s: string): string {
  return s ? s.charAt(0).toLocaleLowerCase("pt-BR") + s.slice(1) : s;
}

/**
 * Os formatadores de frase deste arquivo presos a um idioma, mais o tx: cada função de texto abre com
 * `const { tx, mes, inteiro, ... } = em(idioma)` e escreve as duas formas lado a lado.
 */
function em(idioma: Idioma) {
  return {
    tx: txEm(idioma),
    semDado: semDado(idioma),
    mes: (m: string | null | undefined) => mes(m, idioma),
    inteiro: (v: number | null | undefined) => inteiro(v, idioma),
    pctTexto: (v: number | null | undefined, casas = 1) => pctTexto(v, casas, idioma),
    numTexto: (v: number | null | undefined, casas = 1) => numTexto(v, casas, idioma),
    reaisTexto: (v: number | null | undefined, casas = 2) => reaisTexto(v, casas, idioma),
    reaisGrandes: (v: number | null | undefined) => reaisGrandes(v, idioma),
    listaTexto: (itens: readonly string[]) => listaTexto(itens, idioma),
    pct: (v: number | null | undefined, casas = 1) => pct(v, casas, idioma),
    num: (v: number | null | undefined, casas = 1) => num(v, casas, idioma),
    /** Rótulo da gold (classe da POF, medida, programa, evento) no idioma. */
    dado: (s: string) => dadoTexto(s, idioma),
  };
}

/**
 * Compara dois valores no arredondamento em que aparecem no texto: "maior", "menor"
 * ou "igual". Ausência em qualquer lado → null (o texto não afirma direção).
 */
export function comparaArredondado(a: number | null | undefined, b: number | null | undefined, casas: number): "maior" | "menor" | "igual" | null {
  if (!temValor(a) || !temValor(b)) return null;
  const f = 10 ** casas;
  const ra = Math.round(a * f);
  const rb = Math.round(b * f);
  return ra > rb ? "maior" : ra < rb ? "menor" : "igual"; // i18n: dado
}

/** Conversão de unidade (não é cálculo): valor ÷ 1 milhão; ausência continua ausência. */
export function emMilhoes(v: number | null | undefined): number | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : v / 1e6;
}

/** "R$ 542,4 milhões" ou "R$ 6,50 bilhões"; ausência → "sem dado". */
export function reaisGrandes(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  if (v === null || v === undefined || !Number.isFinite(v)) return semDado(idioma);
  if (Math.abs(v) >= 1e9) return tx(`${reais(v / 1e9, 2, idioma)} bilhões`, `${reais(v / 1e9, 2, idioma)} billion`);
  return tx(`${reais(v / 1e6, 1, idioma)} milhões`, `${reais(v / 1e6, 1, idioma)} million`);
}

/** Lista legível: "a", "a e b", "a, b e c" ("a, b and c"). */
export function listaTexto(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and")} ${itens.at(-1)}`;
}

const leitorUf = tiposUrl.opcao(UFS);

/* ---------- páginas ---------- */

export const ROTA_INCLUSAO = "/setor-eletrico/inclusao-energetica";
export type PainelInclusao = "p059" | "p060" | "p061" | "p062";
/** As quatro páginas de painel, na ordem das perguntas (a próxima pergunta de cada uma é a seguinte); rótulo e título no idioma. */
export function paineisInclusao(idioma: Idioma = idiomaEnergia()): readonly { id: PainelInclusao; slug: string; rotulo: string; titulo: string }[] {
  const tx = txEm(idioma);
  return [
    { id: "p059", slug: "tarifa-social", rotulo: tx("Tarifa Social", "Tarifa Social"), titulo: tx("Tarifa Social de Energia Elétrica", "Tarifa Social (social electricity tariff)") },
    { id: "p060", slug: "cobertura", rotulo: tx("Cobertura potencial", "Potential coverage"), titulo: tx("Cobertura potencial da Tarifa Social", "Potential coverage of the Tarifa Social") },
    { id: "p061", slug: "orcamento", rotulo: tx("Peso no orçamento", "Weight in the budget"), titulo: tx("Peso da energia no orçamento das famílias", "Weight of energy in family budgets") },
    { id: "p062", slug: "acesso", rotulo: tx("Acesso e sistemas isolados", "Access and isolated systems"), titulo: tx("Acesso à energia e sistemas isolados", "Access to energy and isolated systems") },
  ];
}
export const PAINEIS_INCLUSAO = paineisInclusao("pt");
export function rotaPainel(id: PainelInclusao): string {
  const p = PAINEIS_INCLUSAO.find((x) => x.id === id);
  return p ? `${ROTA_INCLUSAO}/${p.slug}` : ROTA_INCLUSAO;
}

/** Fontes de cada painel, como a citação e o CSV as escrevem, no idioma da página (nome de base e de programa ficam como a fonte os publica). */
export function fontesInclusao(idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  return {
    scs: tx("ANEEL, SCS: Sistema de Controle de Subvenções e Programas Sociais", "ANEEL, SCS: Sistema de Controle de Subvenções e Programas Sociais (subsidy and social program control system)"),
    cde: tx("ANEEL, Beneficiários da CDE", "ANEEL, Beneficiários da CDE (CDE beneficiaries)"),
    cob: tx("ANEEL, Beneficiários da CDE; MDS, Cadastro Único (MI Social)", "ANEEL, Beneficiários da CDE (CDE beneficiaries); MDS, Cadastro Único (MI Social)"),
    pof: tx("IBGE, POF 2017-2018 (microdados e tabela 6715)", "IBGE, POF 2017-2018 (microdata and table 6715)"),
    pnad: tx("IBGE, PNAD Contínua anual (tabelas 6731, 6737 e 6738)", "IBGE, annual PNAD Contínua (tables 6731, 6737 and 6738)"),
    pasi: tx("EPE, PASI (Localização Geográfica por ciclo)", "EPE, PASI (geographic location by cycle)"),
    lpt: tx("MME, Luz para Todos (dados abertos)", "MME, Luz para Todos (open data)"),
  };
}
const FONTES_PT = fontesInclusao("pt");
export const FONTE_SCS = FONTES_PT.scs;
export const FONTE_CDE = FONTES_PT.cde;
export const FONTE_COB = FONTES_PT.cob;
export const FONTE_POF = FONTES_PT.pof;
export const FONTE_PNAD = FONTES_PT.pnad;
export const FONTE_PASI = FONTES_PT.pasi;
export const FONTE_LPT = FONTES_PT.lpt;

/* ================================================================ P059: Tarifa Social */

export const MEDIDAS_TSEE = ["uc", "part", "dmr"] as const;
export type MedidaTsee = (typeof MEDIDAS_TSEE)[number];
export function medidaTsee(idioma: Idioma = idiomaEnergia()): Record<MedidaTsee, { rotulo: string; unidade: string; casas: number; titulo: string }> {
  const tx = txEm(idioma);
  return {
    uc: {
      rotulo: tx("UC com Tarifa Social", "Consumer units with Tarifa Social"),
      unidade: tx("milhões de UC", "million consumer units"),
      casas: 2,
      titulo: tx("Unidades consumidoras com Tarifa Social por mês", "Consumer units with Tarifa Social by month"),
    },
    part: {
      rotulo: tx("% das UC residenciais", "% of residential consumer units"),
      unidade: "%",
      casas: 2,
      titulo: tx("Participação da Tarifa Social nas UC residenciais por mês", "Share of the Tarifa Social in residential consumer units by month"),
    },
    dmr: {
      rotulo: "DMR",
      unidade: tx("R$ milhões", "R$ million"),
      casas: 1,
      titulo: tx("Diferença Mensal de Receita (DMR) por mês", "Monthly Revenue Difference (DMR) by month"),
    },
  };
}
export const MEDIDA_TSEE = medidaTsee("pt");

export const MEDIDAS_MAPA_TSEE = ["faturas", "medio", "desconto"] as const;
export type MedidaMapaTsee = (typeof MEDIDAS_MAPA_TSEE)[number];
export function medidaMapaTsee(idioma: Idioma = idiomaEnergia()): Record<MedidaMapaTsee, { rotulo: string; unidade: string; casas: number }> {
  const tx = txEm(idioma);
  return {
    faturas: { rotulo: tx("Faturas com desconto", "Bills with a discount"), unidade: tx("faturas", "bills"), casas: 0 },
    medio: { rotulo: tx("Desconto médio por fatura", "Average discount per bill"), unidade: tx("R$ por fatura", "R$ per bill"), casas: 2 },
    desconto: { rotulo: tx("Desconto das faturas", "Discount on the bills"), unidade: tx("R$ milhões", "R$ million"), casas: 1 },
  };
}
export const MEDIDA_MAPA_TSEE = medidaMapaTsee("pt");

export const MEDIDAS_HIST_UF = ["faturas", "desconto"] as const;
export type MedidaHistUf = (typeof MEDIDAS_HIST_UF)[number];

/** Estado do P059 na URL: medida e intervalo da série nacional, medida do mapa e UF em comparação (até 4). */
export const ESQUEMA_TSEE = {
  medida: campo(tiposUrl.opcao(MEDIDAS_TSEE), "uc", { param: "ts.med" }),
  de: campo(tiposUrl.mes(), "", { param: "ts.de" }), // i18n: dado
  ate: campo(tiposUrl.mes(), "", { param: "ts.ate" }),
  mapa: campo(tiposUrl.opcao(MEDIDAS_MAPA_TSEE), "faturas", { param: "ts.mapa" }),
  hist: campo(tiposUrl.opcao(MEDIDAS_HIST_UF), "faturas", { param: "ts.hist" }),
  ufs: campo(tiposUrl.lista(leitorUf, { max: LIMITE_COMPARACAO }), [] as string[], { param: "ts.uf" }),
};

function valorTsee(p: PontoSerieTsee, medida: MedidaTsee): number | null {
  if (medida === "uc") return emMilhoes(p.uc_tsee);
  if (medida === "part") return p.participacao_pct;
  return emMilhoes(p.dmr_reais);
}

export type LinhaGraficoMensal = { m: string; completo: number | null; incompleto: number | null };

/**
 * Série nacional do SCS para o gráfico: o valor fica em `completo` nos meses
 * completos e em `incompleto` nos demais (linha tracejada, fora da comparação),
 * nunca nos dois; o mês continua na linha do tempo (lacuna, não emenda).
 */
export function dadosSerieTsee(serie: readonly PontoSerieTsee[], medida: MedidaTsee): LinhaGraficoMensal[] {
  return serie.map((p) => {
    const v = valorTsee(p, medida);
    return { m: p.m, completo: p.completo ? v : null, incompleto: p.completo ? null : v };
  });
}

/** Linhas da tabela mensal completa (mesmos números, sem conversão de unidade). */
export function linhasTabelaSerieTsee(serie: readonly PontoSerieTsee[], idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  return serie.map((p) => ({
    id: p.m,
    m: p.m,
    completo: p.completo ? tx("completo", "complete") : tx("incompleto", "incomplete"),
    distribuidoras: p.distribuidoras,
    faltantes: p.distribuidoras_faltantes,
    uc_faltantes: p.uc_tsee_faltantes_ultimo_informe,
    uc_tsee: p.uc_tsee,
    participacao_pct: p.participacao_pct,
    excluidas: p.excluidas_participacao,
    dmr_reais: p.dmr_reais,
    mwh_tsee: p.mwh_tsee,
  }));
}

export function colunasSerieTsee(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "m", rotulo: tx("Mês", "Month"), tipo: "texto" },
    { id: "completo", rotulo: tx("Situação do mês", "Month status"), tipo: "texto", categorica: true },
    { id: "distribuidoras", rotulo: tx("Distribuidoras informantes", "Reporting distribution utilities"), tipo: "numero", casas: 0 },
    { id: "faltantes", rotulo: tx("Distribuidoras esperadas ausentes", "Expected distribution utilities missing"), tipo: "numero", casas: 0 },
    { id: "uc_faltantes", rotulo: tx("UC das ausentes no último informe", "Consumer units of the missing ones in their last report"), tipo: "numero", casas: 0 },
    { id: "uc_tsee", rotulo: tx("UC com Tarifa Social", "Consumer units with Tarifa Social"), tipo: "numero", unidade: tx("UC", "consumer units"), casas: 0 },
    { id: "participacao_pct", rotulo: tx("Das UC residenciais", "Of residential consumer units"), tipo: "percentual", casas: 2 },
    { id: "excluidas", rotulo: tx("Distribuidoras fora da participação", "Distribution utilities left out of the share"), tipo: "numero", casas: 0 },
    { id: "dmr_reais", rotulo: "DMR", tipo: "numero", unidade: "R$", casas: 2 },
    { id: "mwh_tsee", rotulo: tx("Energia faturada com Tarifa Social", "Energy billed with Tarifa Social"), tipo: "numero", unidade: "MWh", casas: 0 },
  ];
}
export const COLUNAS_SERIE_TSEE: ColunaTabela[] = colunasSerieTsee("pt");

/** Eventos da gold dentro do período da série, como marcos do gráfico (mês do evento). */
export function marcosEventos(eventos: TarifaSocial["eventos"], inicio: string, fim: string, idioma: Idioma = idiomaEnergia()): { x: string; rotulo: string }[] {
  return eventos
    .filter((e) => e.data.slice(0, 7) >= inicio && e.data.slice(0, 7) <= fim)
    .map((e) => ({ x: e.data.slice(0, 7), rotulo: `${mes(e.data.slice(0, 7), idioma)}: ${dadoTexto(e.rotulo, idioma)}` }));
}

/** Frase sobre os meses incompletos do SCS desde o início da série publicada (ficam fora da linha cheia). */
export function textoMesesIncompletosScs(serie: readonly PontoSerieTsee[], idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, inteiro, listaTexto } = em(idioma);
  const inc = serie.filter((p) => !p.completo);
  if (!inc.length) return tx("Todos os meses da série têm todas as distribuidoras esperadas.", "Every month in the series has all expected distribution utilities.");
  const partes = inc.map((p) => {
    const n = p.distribuidoras_faltantes;
    const uc = p.uc_tsee_faltantes_ultimo_informe;
    return tx(
      `${mes(p.m)} (${n} ${n === 1 ? "distribuidora esperada ausente" : "distribuidoras esperadas ausentes"}` + `${uc !== null ? `, ${inteiro(uc)} UC no último informe delas` : ""})`,
      `${mes(p.m)} (${n} ${n === 1 ? "expected distribution utility missing" : "expected distribution utilities missing"}` + `${uc !== null ? `, ${inteiro(uc)} consumer units in their last report` : ""})`,
    );
  });
  return tx(
    `${inc.length === 1 ? "Mês incompleto" : "Meses incompletos"}, em linha tracejada e fora da comparação nacional: ${listaTexto(partes)}.`,
    `${inc.length === 1 ? "Incomplete month" : "Incomplete months"}, in a dashed line and outside the national comparison: ${listaTexto(partes)}.`,
  );
}

/* ---------- Beneficiários da CDE: série mensal depois do SCS ---------- */

export function siglasAusentes(m: MesCde, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  return m.distribuidoras_ausentes.length ? m.distribuidoras_ausentes.map((d) => d.sigla ?? d.cnpj).join(", ") : tx("nenhuma", "none");
}

export function linhasMesesCde(meses: readonly MesCde[], idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  return meses.map((m) => ({
    id: m.mes,
    mes: m.mes,
    cobertura: m.cobertura_scs_pct,
    situacao: !m.original_no_bronze
      ? tx("só cobertura (original não guardado)", "coverage only (original not stored)")
      : m.completo
        ? tx("completo", "complete")
        : tx("incompleto", "incomplete"),
    ausentes: siglasAusentes(m, idioma),
    faturas: m.faturas_tsee,
    desconto: m.desconto_faturas_reais,
    medio: m.desconto_medio_por_fatura_reais,
    liquido: m.desconto_liquido_reais,
    fora: m.desconto_fora_das_subclasses_reais,
  }));
}

export function colunasMesesCde(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "mes", rotulo: tx("Mês do arquivo", "File month"), tipo: "texto" },
    { id: "situacao", rotulo: tx("Situação", "Status"), tipo: "texto", categorica: true },
    { id: "cobertura", rotulo: tx("Cobertura pelas UC do SCS", "Coverage by SCS consumer units"), tipo: "percentual", casas: 2 },
    { id: "ausentes", rotulo: tx("Distribuidoras do SCS ausentes", "SCS distribution utilities missing"), tipo: "texto" },
    { id: "faturas", rotulo: tx("Faturas com desconto", "Bills with a discount"), tipo: "numero", unidade: tx("faturas", "bills"), casas: 0 },
    { id: "desconto", rotulo: tx("Desconto das faturas", "Discount on the bills"), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "medio", rotulo: tx("Desconto médio por fatura", "Average discount per bill"), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "liquido", rotulo: tx("Desconto líquido do mês", "Net discount for the month"), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "fora", rotulo: tx("SubsBaixaRenda fora das subclasses 3.2 a 3.6", "SubsBaixaRenda outside subclasses 3.2 to 3.6"), tipo: "numero", unidade: "R$", casas: 2 },
  ];
}
export const COLUNAS_MESES_CDE: ColunaTabela[] = colunasMesesCde("pt");

/**
 * Desconto médio por fatura nos meses com o original no bronze (os sondados e
 * rejeitados não têm valor publicado): `completo` nos meses com cobertura de pelo
 * menos 99,5%, `incompleto` nos demais.
 */
export function dadosMediaCde(meses: readonly MesCde[]): LinhaGraficoMensal[] {
  return meses
    .filter((m) => m.original_no_bronze)
    .map((m) => ({
      m: m.mes,
      completo: m.completo ? m.desconto_medio_por_fatura_reais : null,
      incompleto: m.completo ? null : m.desconto_medio_por_fatura_reais,
    }));
}

/* ---------- mapa e tabela por UF no mês do mapa ---------- */

export function linhasUfsTsee(ufs: readonly UfTsee[], idioma: Idioma = idiomaEnergia()) {
  return ufs.map((u) => ({
    id: u.uf,
    uf: u.uf,
    nome: u.nome,
    regiao: nomeTerritorio(u.regiao, idioma),
    faturas: u.faturas_tsee,
    desconto: emMilhoes(u.desconto_reais),
    medio: u.desconto_medio_por_fatura_reais,
    municipios: u.municipios_com_faturas,
  }));
}

export function colunasUfsTsee(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "nome", rotulo: tx("UF", "State"), tipo: "texto" },
    { id: "uf", rotulo: tx("Sigla", "Abbreviation"), tipo: "texto" },
    { id: "regiao", rotulo: tx("Região", "Region"), tipo: "texto", categorica: true },
    { id: "faturas", rotulo: tx("Faturas com desconto", "Bills with a discount"), tipo: "numero", unidade: tx("faturas", "bills"), casas: 0 },
    { id: "desconto", rotulo: tx("Desconto das faturas", "Discount on the bills"), tipo: "numero", unidade: tx("R$ milhões", "R$ million"), casas: 1 },
    { id: "medio", rotulo: tx("Desconto médio por fatura", "Average discount per bill"), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "municipios", rotulo: tx("Municípios com faturas", "Municipalities with bills"), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_UFS_TSEE: ColunaTabela[] = colunasUfsTsee("pt");

/** Valores do mapa por código IBGE da UF, na medida escolhida (mesmos números da tabela). */
export function valoresMapaTsee(ufs: readonly UfTsee[], medida: MedidaMapaTsee): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const l of linhasUfsTsee(ufs)) {
    const cod = codigoUf(l.uf);
    if (cod) out[cod] = l[medida];
  }
  return out;
}

/**
 * UF atingidas pela ausência de uma distribuidora em cada mês da série da CDE: a
 * distribuidora ausente leva à UF onde tinha faturas no mês do mapa
 * (`ufs_mapa`). Ausente sem UF conhecida marca o mês inteiro (todas as UF), por
 * cautela. Devolve mês → UF → siglas ausentes.
 */
export function ufsAtingidasPorAusencia(meses: readonly MesCde[], distribuidoras: readonly DistribuidoraTsee[]): Record<string, Record<string, string[]>> {
  const ufsDe = new Map(distribuidoras.map((d) => [d.cnpj, d.ufs_mapa.map((u) => u.uf)]));
  const out: Record<string, Record<string, string[]>> = {};
  for (const m of meses) {
    const porUf: Record<string, string[]> = {};
    for (const a of m.distribuidoras_ausentes) {
      const ufs = ufsDe.get(a.cnpj);
      const alvo = ufs && ufs.length ? ufs : UFS;
      for (const uf of alvo) (porUf[uf] ??= []).push(a.sigla ?? a.cnpj);
    }
    out[m.mes] = porUf;
  }
  return out;
}

/**
 * Histórico mensal por UF (JSON sob demanda) para até quatro UF: uma coluna por UF.
 * O mês em que uma distribuidora da UF faltou no arquivo fica sem valor (lacuna):
 * a contagem daquele mês não é comparável; o valor publicado está no CSV.
 */
export function dadosHistoricoUf(
  json: SerieCdeUf,
  ufs: readonly string[],
  medida: MedidaHistUf,
  atingidas: Record<string, Record<string, string[]>>,
): Record<string, string | number | null>[] {
  const fonte = medida === "faturas" ? json.faturas_tsee : json.desconto_faturas_reais;
  return json.meses.map((m, j) => {
    const linha: Record<string, string | number | null> = { m };
    for (const uf of ufs) {
      const i = json.ufs.indexOf(uf);
      const v = i >= 0 ? (fonte[i]?.[j] ?? null) : null;
      const afetada = (atingidas[m]?.[uf]?.length ?? 0) > 0;
      linha[uf] = afetada || v === null ? null : medida === "desconto" ? v / 1e6 : v;
    }
    return linha;
  });
}

/** Frase com as lacunas do histórico das UF escolhidas (mês e distribuidora ausente). */
export function textoLacunasHistorico(ufs: readonly string[], atingidas: Record<string, Record<string, string[]>>, meses: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, listaTexto } = em(idioma);
  const partes: string[] = [];
  for (const uf of ufs) {
    for (const m of meses) {
      const a = atingidas[m]?.[uf];
      if (a?.length) partes.push(tx(`${uf} em ${mes(m)} (${a.join(", ")} fora do arquivo)`, `${uf} in ${mes(m)} (${a.join(", ")} missing from the file)`));
    }
  }
  return partes.length
    ? tx(
        `Sem valor no gráfico por falta de distribuidora da UF no arquivo do mês: ${listaTexto(partes)}. O valor publicado está no CSV, marcado como mês incompleto.`,
        `No value in the chart because a distribution utility of the state is missing from the month's file: ${listaTexto(partes)}. The published value is in the CSV, marked as an incomplete month.`,
      )
    : tx(
        "Nenhuma lacuna nas UF escolhidas: todas as distribuidoras delas aparecem em todos os meses.",
        "No gaps in the chosen states: all their distribution utilities appear in every month.",
      );
}

/* ---------- distribuidoras ---------- */

export function rotuloDistribuidora(sigla: string | null | undefined, cnpj: string): string {
  return sigla && sigla.trim() ? sigla : `CNPJ ${cnpj}`;
}

export function linhasDistribuidoras(ds: readonly DistribuidoraTsee[], idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  return ds.map((d) => ({
    id: d.cnpj,
    sigla: rotuloDistribuidora(d.sigla, d.cnpj),
    cnpj: d.cnpj,
    ufs: d.ufs_mapa.map((u) => u.uf).join(", "),
    uc_tsee: d.uc_tsee,
    uc_residencial: d.uc_residencial,
    participacao_pct: d.participacao_pct,
    residencial: d.residencial_inconsistente ? tx("inconsistente", "inconsistent") : tx("consistente", "consistent"),
    dmr_reais: d.dmr_reais,
    dmr_por_uc_reais: d.dmr_por_uc_reais,
    kwh_por_uc: d.kwh_por_uc,
    variacao_12m_pct: d.variacao_12m_pct,
    faturas_cde: d.conferencia_cde?.faturas_cde ?? null,
    diferenca_cde_pct: d.conferencia_cde?.diferenca_pct ?? null,
    despacho: d.despacho,
  }));
}

export function colunasDistribuidoras(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const uc = tx("UC", "consumer units");
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto" },
    { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
    { id: "ufs", rotulo: tx("UF das faturas", "States of the bills"), tipo: "texto" },
    { id: "uc_tsee", rotulo: tx("UC com Tarifa Social", "Consumer units with Tarifa Social"), tipo: "numero", unidade: uc, casas: 0 },
    { id: "uc_residencial", rotulo: tx("UC residenciais", "Residential consumer units"), tipo: "numero", unidade: uc, casas: 0 },
    { id: "participacao_pct", rotulo: tx("Das UC residenciais", "Of residential consumer units"), tipo: "percentual", casas: 2 },
    { id: "residencial", rotulo: tx("Total residencial", "Residential total"), tipo: "texto", categorica: true },
    { id: "dmr_reais", rotulo: tx("DMR do mês", "DMR for the month"), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "dmr_por_uc_reais", rotulo: tx("DMR por UC", "DMR per consumer unit"), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "kwh_por_uc", rotulo: tx("Consumo por UC", "Consumption per consumer unit"), tipo: "numero", unidade: "kWh", casas: 1 },
    { id: "variacao_12m_pct", rotulo: tx("UC em 12 meses", "Consumer units over 12 months"), tipo: "percentual", casas: 2 },
    { id: "faturas_cde", rotulo: tx("Faturas na CDE (conferência)", "Bills in the CDE (check)"), tipo: "numero", casas: 0 },
    { id: "diferenca_cde_pct", rotulo: tx("Faturas contra UC", "Bills against consumer units"), tipo: "percentual", casas: 2 },
    { id: "despacho", rotulo: tx("Despacho vigente", "Order in force"), tipo: "texto" },
  ];
}
export const COLUNAS_DISTRIBUIDORAS: ColunaTabela[] = colunasDistribuidoras("pt");

/* ---------- textos do P059 ---------- */

/** Resposta curta do P059, derivada dos KPIs publicados. */
export function respostaTarifaSocial(t: TarifaSocial, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, inteiro, pct, reaisTexto } = em(idioma);
  const k = t.kpis;
  const n = t.distribuidoras.length;
  const partes = [
    tx(
      `Em ${mes(k.uc_tsee.mes)}, último mês completo do SCS, ${inteiro(k.uc_tsee.valor)} unidades consumidoras de ${n} distribuidoras tinham Tarifa Social`,
      `In ${mes(k.uc_tsee.mes)}, the latest complete month of the SCS, ${inteiro(k.uc_tsee.valor)} consumer units of ${n} distribution utilities had the Tarifa Social`,
    ) +
      (k.participacao_pct.valor === null
        ? tx(" (participação nas UC residenciais sem dado)", " (share of residential consumer units: no data)")
        : tx(`, ${pct(k.participacao_pct.valor, 1)} das UC residenciais`, `, ${pct(k.participacao_pct.valor, 1)} of residential consumer units`)),
  ];
  const v = k.variacao_12m_pct;
  if (v.valor !== null && v.comparavel)
    partes[0] += tx(
      ` (${v.valor >= 0 ? "alta" : "queda"} de ${pct(Math.abs(v.valor), 1)} sobre ${mes(v.mes_base)})`,
      ` (${v.valor >= 0 ? "up" : "down"} ${pct(Math.abs(v.valor), 1)} on ${mes(v.mes_base)})`,
    );
  partes[0] += ".";
  const mapa = t.cde_meses.find((m) => m.mes === t.mes_mapa);
  if (k.faturas_cde_mapa && mapa) {
    partes.push(
      tx(
        `No arquivo de Beneficiários da CDE de ${mes(mapa.mes)}, o mais recente com todas as distribuidoras, foram ${inteiro(k.faturas_cde_mapa.valor)} faturas com desconto, em média ${reaisTexto(mapa.desconto_medio_por_fatura_reais)} por fatura.`,
        `In the CDE Beneficiaries file for ${mes(mapa.mes)}, the most recent with all distribution utilities, there were ${inteiro(k.faturas_cde_mapa.valor)} bills with a discount, on average ${reaisTexto(mapa.desconto_medio_por_fatura_reais)} per bill.`,
      ),
    );
  }
  return partes.join(" ");
}

/**
 * Veredito do P059 em palavras comuns: quantas unidades consumidoras tinham Tarifa Social no último mês completo do SCS, que
 * parte das residenciais isso é e a variação relativa (em %, não em pontos percentuais) sobre o mesmo mês do ano anterior. As
 * faturas da CDE, o número de distribuidoras e o desconto médio ficam na resposta completa.
 */
export function vereditoTarifaSocial(t: TarifaSocial, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, inteiro, pct } = em(idioma);
  const k = t.kpis;
  const part = k.participacao_pct.valor === null ? "" : tx(` (${pct(k.participacao_pct.valor, 1)} das residenciais)`, ` (${pct(k.participacao_pct.valor, 1)} of residential ones)`);
  const v = k.variacao_12m_pct;
  const variacao =
    v.valor !== null && v.comparavel
      ? tx(`, ${pct(Math.abs(v.valor), 1)} ${v.valor >= 0 ? "a mais" : "a menos"} que em ${mes(v.mes_base)}`, `, ${pct(Math.abs(v.valor), 1)} ${v.valor >= 0 ? "more" : "fewer"} than in ${mes(v.mes_base)}`)
      : "";
  return tx(
    `Em ${mes(k.uc_tsee.mes)}, ${inteiro(k.uc_tsee.valor)} unidades consumidoras${part} tinham Tarifa Social${variacao}.`,
    `In ${mes(k.uc_tsee.mes)}, ${inteiro(k.uc_tsee.valor)} consumer units${part} had the Tarifa Social${variacao}.`,
  );
}

/**
 * "O que mudou" do P059: o evento regulatório mais recente da gold que cai dentro da
 * série da CDE (com um mês com valor antes dele) aparece no desconto médio por
 * fatura. O evento vem da gold, nunca de uma data escrita aqui: com outro evento
 * publicado, o texto acompanha.
 */
export function mudancaTarifaSocial(t: TarifaSocial, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, pctTexto, reaisTexto, reaisGrandes, listaTexto, dado } = em(idioma);
  const comValor = t.cde_meses.filter((m) => m.original_no_bronze && m.desconto_medio_por_fatura_reais !== null);
  const evento = [...t.eventos]
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .reverse()
    .find((e) => {
      const m = e.data.slice(0, 7);
      return comValor.some((x) => x.mes === m) && comValor.some((x) => x.mes < m);
    });
  const antes = evento ? [...comValor].reverse().find((m) => m.mes < evento.data.slice(0, 7)) : undefined;
  const depois = evento ? comValor.find((m) => m.mes === evento.data.slice(0, 7)) : undefined;
  const ultimo = [...comValor].reverse().find((m) => m.completo);
  const partes: string[] = [];
  if (evento && antes && depois) {
    partes.push(
      tx(
        `${evento.rotulo}: o desconto médio por fatura passou de ${reaisTexto(antes.desconto_medio_por_fatura_reais)} em ${mes(antes.mes)} para ${reaisTexto(depois.desconto_medio_por_fatura_reais)} em ${mes(depois.mes)}`,
        `${dado(evento.rotulo)}: the average discount per bill went from ${reaisTexto(antes.desconto_medio_por_fatura_reais)} in ${mes(antes.mes)} to ${reaisTexto(depois.desconto_medio_por_fatura_reais)} in ${mes(depois.mes)}`,
      ),
    );
    if (ultimo && ultimo.mes !== depois.mes)
      partes[0] += tx(` e estava em ${reaisTexto(ultimo.desconto_medio_por_fatura_reais)} em ${mes(ultimo.mes)}`, ` and stood at ${reaisTexto(ultimo.desconto_medio_por_fatura_reais)} in ${mes(ultimo.mes)}`);
    // evento depois do dia 1: o arquivo do mês tem faturas emitidas antes e depois dele
    partes[0] +=
      evento.data.slice(8, 10) > "01"
        ? tx(` (${mes(depois.mes)} mistura faturas emitidas antes e depois da mudança).`, ` (${mes(depois.mes)} mixes bills issued before and after the change).`)
        : ".";
  }
  const sondados = t.cde_meses.filter((m) => !m.original_no_bronze);
  if (sondados.length) {
    const meses = listaTexto(sondados.map((m) => mes(m.mes)));
    const coberturas = listaTexto(sondados.map((m) => pctTexto(m.cobertura_scs_pct, 2)));
    partes.push(
      tx(
        `Os arquivos de ${meses} ainda não trazem todas as distribuidoras (cobertura de ${coberturas}) e publicam só a cobertura.`,
        `The files for ${meses} do not yet include all distribution utilities (coverage of ${coberturas}) and publish only the coverage.`,
      ),
    );
  }
  const k = t.kpis.dmr_12m_reais;
  const n = k.meses_incompletos;
  partes.push(
    tx(
      `De ${mes(k.inicio)} a ${mes(k.fim)}, a DMR somou ${reaisGrandes(k.valor)}${n ? ` (${n} ${n === 1 ? "mês incompleto" : "meses incompletos"} na soma)` : ""}.`,
      `From ${mes(k.inicio)} to ${mes(k.fim)}, the DMR added up to ${reaisGrandes(k.valor)}${n ? ` (${n} ${n === 1 ? "incomplete month" : "incomplete months"} in the sum)` : ""}.`,
    ),
  );
  return partes.join(" ");
}

/**
 * Custeio da Tarifa Social na CDE: as limitações da fonte e o peso no último ano
 * fechado e, à parte, no ano em curso, que só pode ser valor orçado (a fonte não
 * separa orçado de executado). O ano em curso nunca é dito como realizado.
 */
export function textoCusteioTarifaSocial(c: NonNullable<TarifaSocial["custeio_cde"]>, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto, reaisGrandes, dado } = em(idioma);
  const partes = c.proveniencia.limitacoes.map(dado);
  const fechado = [...c.linhas].reverse().find((l) => l.ano !== c.ano_corrente);
  const corrente = c.linhas.find((l) => l.ano === c.ano_corrente);
  if (fechado) {
    const p = pctTexto(fechado.tarifa_social_pct_despesa, 1);
    const r = reaisGrandes(fechado.tarifa_social_reais);
    partes.push(tx(`Em ${fechado.ano}, a Tarifa Social foi ${p} da despesa da CDE (${r}).`, `In ${fechado.ano}, the Tarifa Social was ${p} of CDE expenses (${r}).`));
  }
  if (corrente) {
    const p = pctTexto(corrente.tarifa_social_pct_despesa, 1);
    const r = reaisGrandes(corrente.tarifa_social_reais);
    partes.push(
      tx(
        `Em ${corrente.ano}, ano em curso, o valor orçado é ${p} da despesa prevista (${r}).`,
        `In ${corrente.ano}, the current year, the budgeted value is ${p} of forecast expenses (${r}).`,
      ),
    );
  }
  return partes.join(" ");
}

/* ================================================================ P060: cobertura potencial (proxy) */

export const DENOMINADORES = ["atualizadas", "cadastradas"] as const;
export type Denominador = (typeof DENOMINADORES)[number];

/** Estado do P060 na URL: UF selecionada (mapa, tabela e pontos) e denominador do mapa. */
export const ESQUEMA_COBERTURA = {
  uf: campo(tiposUrl.texto({ max: 2 }), "", { param: "cob.uf" }),
  den: campo(tiposUrl.opcao(DENOMINADORES), "atualizadas", { param: "cob.den" }),
  mun: campo(tiposUrl.booleano(), false, { param: "cob.mun" }),
  /** Município selecionado no mapa e na tabela municipais (código IBGE de 7 dígitos da malha). */
  msel: campo(tiposUrl.texto({ max: 7 }), "", { param: "cob.msel" }),
};

export function linhasCoberturaUf(ufs: readonly CoberturaUf[], idioma: Idioma = idiomaEnergia()) {
  return ufs.map((u) => ({
    id: u.uf,
    uf: u.uf,
    nome: u.nome,
    regiao: nomeTerritorio(u.regiao, idioma),
    faturas: u.faturas_tsee,
    atualizadas: u.familias_atualizadas,
    cadastradas: u.familias_cadastradas,
    razao_atualizadas: u.razao_atualizadas_pct,
    razao_cadastradas: u.razao_cadastradas_pct,
    municipios: u.municipios,
  }));
}

export function colunasCoberturaUf(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const familias = tx("famílias", "families");
  return [
    { id: "nome", rotulo: tx("UF", "State"), tipo: "texto" },
    { id: "uf", rotulo: tx("Sigla", "Abbreviation"), tipo: "texto" },
    { id: "regiao", rotulo: tx("Região", "Region"), tipo: "texto", categorica: true },
    { id: "faturas", rotulo: tx("Faturas com desconto", "Bills with a discount"), tipo: "numero", unidade: tx("faturas", "bills"), casas: 0 },
    { id: "atualizadas", rotulo: tx("Famílias até ½ SM, cadastro atualizado", "Families up to ½ minimum wage, updated record"), tipo: "numero", unidade: familias, casas: 0 },
    { id: "cadastradas", rotulo: tx("Famílias até ½ SM, todas as cadastradas", "Families up to ½ minimum wage, all registered"), tipo: "numero", unidade: familias, casas: 0 },
    { id: "razao_atualizadas", rotulo: tx("Faturas por 100 famílias atualizadas", "Bills per 100 updated families"), tipo: "numero", casas: 2 },
    { id: "razao_cadastradas", rotulo: tx("Faturas por 100 famílias cadastradas", "Bills per 100 registered families"), tipo: "numero", casas: 2 },
    { id: "municipios", rotulo: tx("Municípios", "Municipalities"), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_COBERTURA_UF: ColunaTabela[] = colunasCoberturaUf("pt");

export function valoresMapaCobertura(ufs: readonly CoberturaUf[], den: Denominador): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const u of ufs) {
    const cod = codigoUf(u.uf);
    if (cod) out[cod] = den === "atualizadas" ? u.razao_atualizadas_pct : u.razao_cadastradas_pct;
  }
  return out;
}

/** Itens do gráfico de faixa por UF: círculo = com cadastro atualizado; losango = todas as cadastradas. */
export function itensFaixaCobertura(ufs: readonly CoberturaUf[], idioma: Idioma = idiomaEnergia()) {
  const { tx, inteiro } = em(idioma);
  return ufs.map((u) => ({
    id: u.uf,
    rotulo: u.nome,
    valor: u.razao_atualizadas_pct,
    referencia: u.razao_cadastradas_pct,
    detalhe: tx(
      `${inteiro(u.faturas_tsee)} faturas; ${inteiro(u.familias_atualizadas)} famílias atualizadas e ${inteiro(u.familias_cadastradas)} cadastradas`,
      `${inteiro(u.faturas_tsee)} bills; ${inteiro(u.familias_atualizadas)} updated families and ${inteiro(u.familias_cadastradas)} registered`,
    ),
  }));
}

/** Série mensal nacional (JSON sob demanda): razão com atualizadas e com cadastradas, mesmo mês do numerador e do denominador. */
export function dadosSerieCobertura(serie: readonly PontoCoberturaMensal[]) {
  return serie.map((p) => ({ m: p.m, atualizadas: p.razao_atualizadas_pct, cadastradas: p.razao_cadastradas_pct }));
}

export function linhasHistogramaMunicipios(dist: NonNullable<Cobertura["distribuicao_municipal"]>, idioma: Idioma = idiomaEnergia()) {
  const { tx, num } = em(idioma);
  return dist.histograma.map((h) => ({
    id: `${h.de}`,
    faixa: h.ate === null ? tx(`${num(h.de, 0)} ou mais`, `${num(h.de, 0)} or more`) : tx(`${num(h.de, 0)} a menos de ${num(h.ate, 0)}`, `${num(h.de, 0)} to less than ${num(h.ate, 0)}`),
    municipios: h.municipios,
  }));
}

/** Resposta curta do P060 (proxy declarada na própria frase). */
export function respostaCobertura(c: Cobertura, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, numTexto } = em(idioma);
  const b = c.brasil;
  if (!b)
    return tx(
      "Sem dado: a gold desta publicação não tem o cruzamento entre faturas e Cadastro Único.",
      "No data: this publication's gold does not have the match between bills and the Cadastro Único.",
    );
  const ufs = c.ufs.filter((u) => u.razao_atualizadas_pct !== null);
  const ord = [...ufs].sort((a, z) => (a.razao_atualizadas_pct as number) - (z.razao_atualizadas_pct as number));
  const menor = ord[0];
  const maior = ord.at(-1);
  let t = tx(
    `Proxy, não lacuna: em ${mes(b.mes)} havia ${numTexto(b.razao_atualizadas_pct, 1)} faturas com Tarifa Social para cada 100 famílias do Cadastro Único com renda por pessoa até meio salário mínimo e cadastro atualizado ` +
      `(${numTexto(b.razao_cadastradas_pct, 1)} contando todas as cadastradas nessa renda).`,
    `Proxy, not a gap: in ${mes(b.mes)} there were ${numTexto(b.razao_atualizadas_pct, 1)} bills with the Tarifa Social for every 100 Cadastro Único families with per capita income up to half a minimum wage and an updated record ` +
      `(${numTexto(b.razao_cadastradas_pct, 1)} counting all registered families in that income range).`,
  );
  if (menor && maior && menor !== maior) {
    t += tx(
      ` Entre as UF, a razão vai de ${numTexto(menor.razao_atualizadas_pct, 1)} (${menor.nome}) a ${numTexto(maior.razao_atualizadas_pct, 1)} (${maior.nome}).`,
      ` Across states, the ratio ranges from ${numTexto(menor.razao_atualizadas_pct, 1)} (${menor.nome}) to ${numTexto(maior.razao_atualizadas_pct, 1)} (${maior.nome}).`,
    );
  }
  return t;
}

/**
 * Veredito do P060: a razão de faturas por 100 famílias do Cadastro Único com cadastro atualizado, em palavras comuns, e o
 * limite de leitura (medida indireta: não mede quantas famílias com direito ficaram sem o desconto). A razão contando todas as
 * cadastradas e o intervalo entre as UF ficam na resposta completa.
 */
export function vereditoCobertura(c: Cobertura, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, numTexto } = em(idioma);
  const b = c.brasil;
  if (!b)
    return tx(
      "Sem dado: a gold desta publicação não tem o cruzamento entre faturas e Cadastro Único.",
      "No data: this publication's gold does not have the match between bills and the Cadastro Único.",
    );
  return tx(
    `Em ${mes(b.mes)} havia ${numTexto(b.razao_atualizadas_pct, 1)} faturas com Tarifa Social para cada 100 famílias do Cadastro Único com renda por pessoa até meio salário mínimo e cadastro atualizado. É uma medida indireta: não mede quantas famílias com direito ficaram sem o desconto.`,
    `In ${mes(b.mes)} there were ${numTexto(b.razao_atualizadas_pct, 1)} bills with the Tarifa Social for every 100 Cadastro Único families with per capita income up to half a minimum wage and an updated record. It is an indirect measure: it does not measure how many entitled families went without the discount.`,
  );
}

export function mudancaCobertura(c: Cobertura, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, numTexto, inteiro } = em(idioma);
  const u = c.serie_mensal_ultimo;
  const b = c.brasil;
  const partes: string[] = [];
  if (u) {
    partes.push(
      tx(
        `Na série mensal com o numerador do SCS (UC, meses completos, ${c.serie_mensal_meses} meses), o último ponto é ${mes(u.m)}: ${numTexto(u.razao_atualizadas_pct, 1)} UC por 100 famílias atualizadas e ${numTexto(u.razao_cadastradas_pct, 1)} por 100 cadastradas.`,
        `In the monthly series with the SCS numerator (consumer units, complete months, ${c.serie_mensal_meses} months), the latest point is ${mes(u.m)}: ${numTexto(u.razao_atualizadas_pct, 1)} consumer units per 100 updated families and ${numTexto(u.razao_cadastradas_pct, 1)} per 100 registered.`,
      ),
    );
  }
  if (b) partes.push(tx(`O ponto de ${mes(b.mes)} usa faturas da CDE, outra unidade: as duas séries não se emendam.`, `The ${mes(b.mes)} point uses CDE bills, a different unit: the two series do not join.`));
  const d = c.distribuicao_municipal;
  if (d) {
    // as faixas do histograma começam em número inclusive; "passam de 100" é estritamente acima: a diferença são os municípios com razão exatamente 100
    const deCemEmDiante = d.histograma.filter((h) => h.de >= 100).reduce((acc, h) => acc + h.municipios, 0);
    const faixas =
      deCemEmDiante !== d.acima_de_100
        ? tx(
            ` (as faixas do histograma de 100 em diante somam ${inteiro(deCemEmDiante)} porque a faixa começa em 100, inclusive)`,
            ` (the histogram bands from 100 upward add up to ${inteiro(deCemEmDiante)} because the band starts at 100, inclusive)`,
          )
        : "";
    partes.push(
      tx(
        `Nos municípios, a mediana é ${numTexto(d.quantis.p50, 1)} e metade fica entre ${numTexto(d.quantis.p25, 1)} e ${numTexto(d.quantis.p75, 1)}; ${inteiro(d.acima_de_100)} passam de 100${faixas}, o que a proxy admite sem erro de cálculo: o numerador inclui beneficiários fora do critério de renda do denominador.`,
        `In the municipalities, the median is ${numTexto(d.quantis.p50, 1)} and half fall between ${numTexto(d.quantis.p25, 1)} and ${numTexto(d.quantis.p75, 1)}; ${inteiro(d.acima_de_100)} exceed 100${faixas}, which the proxy allows without a calculation error: the numerator includes beneficiaries outside the denominator's income criterion.`,
      ),
    );
  }
  return partes.join(" ");
}

/* ---------- municípios (CSV sob demanda) ---------- */

export type MunicipioCobertura = {
  cod6: string;
  municipio: string;
  uf: string;
  faturas: number | null;
  atualizadas: number | null;
  cadastradas: number | null;
  razao_atualizadas: number | null;
  razao_cadastradas: number | null;
  base_pequena: boolean;
};

function numeroCsv(s: string | undefined): number | null {
  if (s === undefined || s.trim() === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Leitura do CSV publicado (separador ";", ponto decimal, vazio = ausência) em linhas com cabeçalho. */
export function lerCsv(texto: string): Record<string, string>[] {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (!linhas.length) return [];
  const cab = linhas[0].split(";");
  return linhas.slice(1).map((l) => {
    const c = l.split(";");
    return Object.fromEntries(cab.map((h, i) => [h, c[i] ?? ""]));
  });
}

export function municipiosDoCsv(texto: string): MunicipioCobertura[] {
  return lerCsv(texto).map((r) => ({
    cod6: r.cod_ibge6,
    municipio: r.municipio,
    uf: r.uf,
    faturas: numeroCsv(r.faturas_tsee),
    atualizadas: numeroCsv(r.familias_ate_meio_sm_atualizadas),
    cadastradas: numeroCsv(r.familias_ate_meio_sm),
    razao_atualizadas: numeroCsv(r.razao_proxy_atualizadas),
    razao_cadastradas: numeroCsv(r.razao_proxy_cadastradas),
    base_pequena: r.base_pequena === "1",
  }));
}

export function colunasMunicipios(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "municipio", rotulo: tx("Município", "Municipality"), tipo: "texto" },
    { id: "uf", rotulo: tx("UF", "State"), tipo: "texto", categorica: true },
    { id: "faturas", rotulo: tx("Faturas com desconto", "Bills with a discount"), tipo: "numero", casas: 0 },
    { id: "atualizadas", rotulo: tx("Famílias até ½ SM, atualizadas", "Families up to ½ minimum wage, updated"), tipo: "numero", casas: 0 },
    { id: "razao_atualizadas", rotulo: tx("Faturas por 100 famílias atualizadas", "Bills per 100 updated families"), tipo: "numero", casas: 2 },
    { id: "razao_cadastradas", rotulo: tx("Faturas por 100 famílias cadastradas", "Bills per 100 registered families"), tipo: "numero", casas: 2 },
    { id: "base", rotulo: tx("Base", "Base"), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_MUNICIPIOS: ColunaTabela[] = colunasMunicipios("pt");

/* ================================================================ P061: peso no orçamento (POF) */

/**
 * Parte da gold da POF que os componentes cliente recebem: sem evidências,
 * proveniências e conferências (ficam no servidor), para não pesar a página.
 */
export type OrcamentoBase = Pick<
  Orcamento,
  "classes" | "medidas" | "medidas_uf" | "limiares_pct" | "linhas" | "referencia" | "formato_microdados" | "sensibilidade_media_razoes_renda" | "regra_precisao"
>;

export function orcamentoBase(orc: Orcamento, linhas: (l: LinhaPof) => boolean = () => true): OrcamentoBase {
  return {
    classes: orc.classes,
    medidas: orc.medidas,
    medidas_uf: orc.medidas_uf,
    limiares_pct: orc.limiares_pct,
    linhas: orc.linhas.filter(linhas),
    referencia: orc.referencia,
    formato_microdados: orc.formato_microdados,
    sensibilidade_media_razoes_renda: orc.sensibilidade_media_razoes_renda,
    regra_precisao: orc.regra_precisao,
  };
}

export const BASES_POF = ["despesa", "renda"] as const;
export type BasePof = (typeof BASES_POF)[number];
export const LIMIARES_POF = ["3", "5", "10"] as const;
export type LimiarPof = (typeof LIMIARES_POF)[number];
export const MEDIDAS_MAPA_POF = ["razao_medias_pct", "media_razoes_desp_pct", "media_razoes_renda_pct", "energia_media"] as const;
export type MedidaMapaPof = (typeof MEDIDAS_MAPA_POF)[number];

/** Estado do P061 na URL: territórios comparados (até 4), base da participação, limiar e medida do mapa por UF. */
export const ESQUEMA_ORCAMENTO = {
  ter: campo(tiposUrl.lista(tiposUrl.opcao<string>(TERRITORIOS_POF), { max: LIMITE_COMPARACAO }), ["BR"] as string[], { param: "pof.ter" }),
  base: campo(tiposUrl.opcao(BASES_POF), "despesa", { param: "pof.base" }),
  lim: campo(tiposUrl.opcao(LIMIARES_POF), "5", { param: "pof.lim" }),
  mapa: campo(tiposUrl.opcao(MEDIDAS_MAPA_POF), "razao_medias_pct", { param: "pof.mapa" }),
  uf: campo(tiposUrl.texto({ max: 2 }), "", { param: "pof.uf" }),
};

/**
 * Rótulo do estado de precisão de cada estimativa, com os limites de CV da regra
 * publicada na gold (`regra_precisao`): mudar a regra no pipeline muda o rótulo.
 */
export function rotulosEstadoPof(regra: Orcamento["regra_precisao"], idioma: Idioma = idiomaEnergia()): Record<string, string> {
  const { tx, pct } = em(idioma);
  const c = pct(regra.cautela_cv_pct, 0);
  const s = pct(regra.suprime_cv_pct, 0);
  return {
    publicado: tx(`CV até ${c}`, `CV up to ${c}`),
    cautela: tx(`cautela: CV de ${c} a ${s}`, `caution: CV from ${c} to ${s}`),
    suprimido: tx(`suprimido: CV acima de ${s}`, `suppressed: CV above ${s}`),
    sem_erro_padrao: tx("sem erro-padrão (mediana)", "no standard error (median)"),
    zero_na_amostra: tx("zero na amostra", "zero in the sample"),
    ausente: tx("ausente", "missing"),
  };
}

/** Frase da regra de precisão para notas de tabela e "Como interpretar". */
export function textoPrecisaoPof(regra: Orcamento["regra_precisao"], idioma: Idioma = idiomaEnergia()): string {
  const { tx, pct } = em(idioma);
  const c = pct(regra.cautela_cv_pct, 0);
  const s = pct(regra.suprime_cv_pct, 0);
  return tx(`CV de ${c} a ${s}: cautela; acima de ${s}: suprimido (sem dado).`, `CV from ${c} to ${s}: caution; above ${s}: suppressed (no data).`);
}

/** [valor, CV, estado] de uma medida; medida não publicada no território = ausente. */
export function estimativa(l: LinhaPof | undefined, m: MedidaPof): EstimativaPof {
  return l?.microdados[m] ?? [null, null, "ausente"];
}

export function linhaPof(orc: OrcamentoBase, territorio: string, classe: string): LinhaPof | undefined {
  return orc.linhas.find((l) => l.territorio === territorio && l.classe === classe);
}

/** Medidas comparáveis de cada base: a razão de médias só existe para a despesa total. */
export function medidasBase(idioma: Idioma = idiomaEnergia()): Record<BasePof, { id: MedidaPof; rotulo: string }[]> {
  const tx = txEm(idioma);
  const media = tx("Média das participações", "Average of the shares");
  const mediana = tx("Mediana das participações", "Median of the shares");
  return {
    despesa: [
      { id: "razao_medias_pct", rotulo: tx("Razão de médias", "Ratio of averages") },
      { id: "media_razoes_desp_pct", rotulo: media },
      { id: "mediana_desp_pct", rotulo: mediana },
    ],
    renda: [
      { id: "media_razoes_renda_pct", rotulo: media },
      { id: "mediana_renda_pct", rotulo: mediana },
    ],
  };
}
export const MEDIDAS_BASE: Record<BasePof, { id: MedidaPof; rotulo: string }[]> = medidasBase("pt");

/** Classes de rendimento sem o total (o total é a referência). */
export function classesRenda(orc: OrcamentoBase) {
  return orc.classes.filter((c) => c.codigo !== "7999");
}

/**
 * Barras por classe de rendimento: uma coluna por medida da base escolhida, para UM
 * território. Valor suprimido (CV acima de 30%) é ausência, não zero.
 */
export function dadosClassesPof(orc: OrcamentoBase, territorio: string, base: BasePof, idioma: Idioma = idiomaEnergia()) {
  return classesRenda(orc).map((c) => {
    const l = linhaPof(orc, territorio, c.codigo);
    const linha: Record<string, string | number | null> = { id: c.codigo, rotulo: dadoTexto(c.rotulo, idioma) };
    for (const m of MEDIDAS_BASE[base]) linha[m.id] = estimativa(l, m.id)[0];
    return linha;
  });
}

/** Comparação entre territórios (até 4) numa medida: uma coluna por território. */
export function dadosComparacaoPof(orc: OrcamentoBase, territorios: readonly string[], medida: MedidaPof, idioma: Idioma = idiomaEnergia()) {
  return classesRenda(orc).map((c) => {
    const linha: Record<string, string | number | null> = { id: c.codigo, rotulo: dadoTexto(c.rotulo, idioma) };
    for (const t of territorios) linha[t] = estimativa(linhaPof(orc, t, c.codigo), medida)[0];
    return linha;
  });
}

/** Tabela completa de um território: todas as medidas, CV e estado, por classe (total incluído). */
export function linhasTabelaPof(orc: OrcamentoBase, territorio: string, idioma: Idioma = idiomaEnergia()) {
  const rotulos = rotulosEstadoPof(orc.regra_precisao, idioma);
  return orc.classes.map((c) => {
    const l = linhaPof(orc, territorio, c.codigo);
    const linha: Record<string, string | number | null> = {
      id: c.codigo,
      classe: dadoTexto(c.rotulo, idioma),
      n_amostra: l?.n_amostra ?? null,
      familias: l?.familias ?? null,
    };
    for (const m of orc.medidas) {
      const [v, cv, est] = estimativa(l, m.id);
      linha[m.id] = v;
      linha[`${m.id}__cv`] = cv;
      linha[`${m.id}__estado`] = rotulos[est] ?? est;
    }
    return linha;
  });
}

export function colunasTabelaPof(orc: OrcamentoBase, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const cols: ColunaTabela[] = [
    { id: "classe", rotulo: tx("Classe de rendimento", "Income class"), tipo: "texto" },
    { id: "n_amostra", rotulo: tx("Famílias na amostra", "Families in the sample"), tipo: "numero", casas: 0 },
    { id: "familias", rotulo: tx("Famílias representadas", "Families represented"), tipo: "numero", casas: 0 },
  ];
  for (const m of orc.medidas) {
    const reais_ = m.id === "energia_media" || m.id === "despesa_media";
    const r = dadoTexto(m.rotulo, idioma);
    cols.push({ id: m.id, rotulo: r, tipo: reais_ ? "numero" : "percentual", unidade: reais_ ? "R$" : undefined, casas: 2 });
    cols.push({ id: `${m.id}__cv`, rotulo: `CV: ${r}`, tipo: "percentual", casas: 1 });
    cols.push({ id: `${m.id}__estado`, rotulo: tx(`Precisão: ${r}`, `Precision: ${r}`), tipo: "texto", categorica: true });
  }
  return cols;
}

/** Sensibilidade ao limiar: famílias acima de 3%, 5% ou 10% da renda e da despesa, por classe, num território. */
export function linhasLimiaresPof(orc: OrcamentoBase, territorio: string, limiar: LimiarPof, idioma: Idioma = idiomaEnergia()) {
  const mr = `acima_${limiar}_renda_pct` as MedidaPof;
  const md = `acima_${limiar}_desp_pct` as MedidaPof;
  const rotulos = rotulosEstadoPof(orc.regra_precisao, idioma);
  return orc.classes.map((c) => {
    const l = linhaPof(orc, territorio, c.codigo);
    const [vr, cvr, er] = estimativa(l, mr);
    const [vd, cvd, ed] = estimativa(l, md);
    return {
      id: c.codigo,
      classe: dadoTexto(c.rotulo, idioma),
      renda: vr,
      renda_cv: cvr,
      renda_estado: rotulos[er] ?? er,
      despesa: vd,
      despesa_cv: cvd,
      despesa_estado: rotulos[ed] ?? ed,
    };
  });
}

export function colunasLimiares(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "classe", rotulo: tx("Classe de rendimento", "Income class"), tipo: "texto" },
    { id: "renda", rotulo: tx("Famílias acima do limiar da renda", "Families above the income threshold"), tipo: "percentual", casas: 1 },
    { id: "renda_cv", rotulo: tx("CV (renda)", "CV (income)"), tipo: "percentual", casas: 1 },
    { id: "renda_estado", rotulo: tx("Precisão (renda)", "Precision (income)"), tipo: "texto", categorica: true },
    { id: "despesa", rotulo: tx("Famílias acima do limiar da despesa", "Families above the expense threshold"), tipo: "percentual", casas: 1 },
    { id: "despesa_cv", rotulo: tx("CV (despesa)", "CV (expense)"), tipo: "percentual", casas: 1 },
    { id: "despesa_estado", rotulo: tx("Precisão (despesa)", "Precision (expense)"), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_LIMIARES: ColunaTabela[] = colunasLimiares("pt");

/** UF (só o total: a amostra por classe nas UF é pequena demais). */
export function linhasUfsPof(orc: OrcamentoBase, idioma: Idioma = idiomaEnergia()) {
  const rotulos = rotulosEstadoPof(orc.regra_precisao, idioma);
  return orc.linhas
    .filter((l) => l.classe === "7999" && codigoUf(l.territorio))
    .map((l) => {
      const linha: Record<string, string | number | null> = { id: l.territorio, uf: l.territorio, nome: l.nome, n_amostra: l.n_amostra };
      for (const m of orc.medidas_uf) {
        const [v, cv, est] = estimativa(l, m);
        linha[m] = v;
        linha[`${m}__cv`] = cv;
        linha[`${m}__estado`] = rotulos[est] ?? est;
      }
      return linha;
    });
}

export function colunasUfsPof(orc: OrcamentoBase, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const rot = new Map(orc.medidas.map((m) => [m.id, dadoTexto(m.rotulo, idioma)]));
  const cols: ColunaTabela[] = [
    { id: "nome", rotulo: tx("UF", "State"), tipo: "texto" },
    { id: "uf", rotulo: tx("Sigla", "Abbreviation"), tipo: "texto" },
    { id: "n_amostra", rotulo: tx("Famílias na amostra", "Families in the sample"), tipo: "numero", casas: 0 },
  ];
  for (const m of orc.medidas_uf) {
    const r = rot.get(m) ?? m;
    cols.push({ id: m, rotulo: r, tipo: m === "energia_media" ? "numero" : "percentual", unidade: m === "energia_media" ? "R$" : undefined, casas: 2 });
    cols.push({ id: `${m}__cv`, rotulo: `CV: ${r}`, tipo: "percentual", casas: 1 });
    cols.push({ id: `${m}__estado`, rotulo: tx(`Precisão: ${r}`, `Precision: ${r}`), tipo: "texto", categorica: true });
  }
  return cols;
}

export function valoresMapaPof(orc: OrcamentoBase, medida: MedidaMapaPof): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const l of orc.linhas) {
    if (l.classe !== "7999") continue;
    const cod = codigoUf(l.territorio);
    if (cod) out[cod] = estimativa(l, medida)[0];
  }
  return out;
}

/** Nome curto da pesquisa ("POF 2017-2018"), sem a data de referência dos valores. */
export function nomePof(orc: Pick<OrcamentoBase, "referencia">): string {
  return orc.referencia.split(" (")[0] || orc.referencia;
}

/**
 * Resposta curta do P061: classe mais baixa contra o total, nas duas medidas. A
 * direção ("pesou mais", "pesou menos", "pesou o mesmo") e a comparação entre as
 * medidas saem dos números publicados, no arredondamento em que aparecem; sem um
 * dos números, o texto não afirma direção.
 */
export function respostaOrcamento(orc: OrcamentoBase, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto, dado } = em(idioma);
  const classes = classesRenda(orc);
  const baixa = classes[0];
  const alta = classes.at(-1);
  const t = linhaPof(orc, "BR", "7999");
  const b = baixa ? linhaPof(orc, "BR", baixa.codigo) : undefined;
  const a = alta ? linhaPof(orc, "BR", alta.codigo) : undefined;
  if (!t || !b || !baixa) return tx("Sem dado: a POF não foi processada nesta publicação.", "No data: the POF was not processed in this publication.");
  const rmV = (l: LinhaPof | undefined) => estimativa(l, "razao_medias_pct")[0];
  const mrV = (l: LinhaPof | undefined) => estimativa(l, "media_razoes_desp_pct")[0];
  const rm = (l: LinhaPof | undefined) => pctTexto(rmV(l), 1);
  const mr = (l: LinhaPof | undefined) => pctTexto(mrV(l), 1);
  const dir = comparaArredondado(rmV(b), rmV(t), 1);
  const abertura =
    dir === "maior"
      ? tx("a energia elétrica pesou mais nas famílias de menor renda", "electricity weighed more on lower-income families")
      : dir === "menor"
        ? tx("a energia elétrica pesou menos nas famílias de menor renda", "electricity weighed less on lower-income families")
        : dir === "igual"
          ? tx("a energia elétrica pesou o mesmo nas famílias de menor renda e no conjunto", "electricity weighed the same on lower-income families and on all families")
          : tx(
              "o peso da energia elétrica nas famílias de menor renda não tem as duas estimativas para comparar",
              "the weight of electricity on lower-income families does not have both estimates to compare",
            );
  const classeBaixa = minusculaInicial(dado(baixa.rotulo));
  let s = tx(
    `Na ${nomePof(orc)}, ${abertura}: ${rm(b)} da despesa total das famílias com rendimento ${classeBaixa} (razão de médias), contra ${rm(t)} no conjunto das famílias`,
    `In the ${nomePof(orc)}, ${abertura}: ${rm(b)} of the total expense of families with income ${classeBaixa} (ratio of averages), against ${rm(t)} for all families`,
  );
  if (a && alta) s += tx(` e ${rm(a)} na classe ${minusculaInicial(alta.rotulo)}`, ` and ${rm(a)} in the ${minusculaInicial(dado(alta.rotulo))} class`);
  const db = comparaArredondado(mrV(b), rmV(b), 1);
  const dt = comparaArredondado(mrV(t), rmV(t), 1);
  // só afirma "maior" ou "menor" quando a relação vale nas duas linhas comparadas
  const rel =
    db !== null && db === dt ? (db === "maior" ? tx("maior", "higher") : db === "menor" ? tx("menor", "lower") : tx("a mesma", "the same")) : null;
  s += rel
    ? tx(`. Medida família a família, a participação média é ${rel}: ${mr(b)} e ${mr(t)}.`, `. Measured family by family, the average share is ${rel}: ${mr(b)} and ${mr(t)}.`)
    : tx(`. Medida família a família, a participação média é ${mr(b)} e ${mr(t)}.`, `. Measured family by family, the average share is ${mr(b)} and ${mr(t)}.`);
  return s;
}

/**
 * Veredito do P061: o peso da energia elétrica na despesa das famílias da classe de menor renda contra o conjunto, na razão de
 * médias (despesa média com energia sobre despesa média total). A direção sai dos números no arredondamento em que aparecem; a
 * participação família a família, a classe mais alta e a sensibilidade ficam na resposta completa.
 */
/** Abertura comum dos vereditos da POF: a direção do peso, no idioma. */
function aberturaPeso(dir: "maior" | "menor" | "igual" | null, idioma: Idioma): string {
  const tx = txEm(idioma);
  return dir === "maior"
    ? tx("a energia elétrica pesou mais", "electricity weighed more")
    : dir === "menor"
      ? tx("a energia elétrica pesou menos", "electricity weighed less")
      : dir === "igual"
        ? tx("a energia elétrica pesou o mesmo", "electricity weighed the same")
        : tx("o peso da energia elétrica não tem as duas estimativas para comparar", "the weight of electricity does not have both estimates to compare");
}

export function vereditoOrcamento(orc: OrcamentoBase, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto, dado } = em(idioma);
  const classes = classesRenda(orc);
  const baixa = classes[0];
  const t = linhaPof(orc, "BR", "7999");
  const b = baixa ? linhaPof(orc, "BR", baixa.codigo) : undefined;
  if (!t || !b || !baixa) return tx("Sem dado: a POF não foi processada nesta publicação.", "No data: the POF was not processed in this publication.");
  const rmV = (l: LinhaPof | undefined) => estimativa(l, "razao_medias_pct")[0];
  const dir = comparaArredondado(rmV(b), rmV(t), 1);
  const abertura = aberturaPeso(dir, idioma);
  const quem = dir === "igual" ? tx("nas famílias de menor renda e no conjunto", "on lower-income families and on all families") : tx("nas famílias de menor renda", "on lower-income families");
  const classe = minusculaInicial(dado(baixa.rotulo));
  return tx(
    `Na ${nomePof(orc)}, ${abertura} ${quem}: a despesa média com energia foi ${pctTexto(rmV(b), 1)} da despesa média total das famílias com rendimento ${classe}, contra ${pctTexto(rmV(t), 1)} no conjunto das famílias.`,
    `In the ${nomePof(orc)}, ${abertura} ${quem}: average electricity expense was ${pctTexto(rmV(b), 1)} of the average total expense of families with income ${classe}, against ${pctTexto(rmV(t), 1)} for all families.`,
  );
}

export function mudancaOrcamento(orc: OrcamentoBase, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto, inteiro, dado } = em(idioma);
  const classes = classesRenda(orc);
  const baixa = classes[0];
  const s = baixa ? orc.sensibilidade_media_razoes_renda[baixa.codigo] : undefined;
  const partes = [
    tx(
      `A estatística é da ${orc.referencia}: a pesquisa seguinte ainda não foi publicada pelo IBGE e nenhuma atualização modelada é publicada aqui.`,
      `The statistic is from the ${dado(orc.referencia)}: the next survey has not yet been published by IBGE and no modeled update is published here.`,
    ),
  ];
  if (s && baixa) {
    const dir = comparaArredondado(s.media_sem_energia_acima_da_renda_pct, s.media_razoes_renda_pct, 2);
    const verbo =
      dir === "menor" ? tx("cai para", "falls to") : dir === "maior" ? tx("sobe para", "rises to") : dir === "igual" ? tx("fica em", "stays at") : tx("seria", "would be");
    const classe = minusculaInicial(dado(baixa.rotulo));
    const n = inteiro(s.familias_amostra_energia_acima_da_renda);
    partes.push(
      tx(
        `Na renda da classe ${classe}, a média das participações (${pctTexto(s.media_razoes_renda_pct, 2)}) é sensível às famílias que declaram renda menor que a própria despesa com energia: a mediana é ${pctTexto(s.mediana_renda_pct, 2)} e, sem as ${n} famílias da amostra nessa situação, a média ${verbo} ${pctTexto(s.media_sem_energia_acima_da_renda_pct, 2)}.`,
        `In the income of the ${classe} class, the average of the shares (${pctTexto(s.media_razoes_renda_pct, 2)}) is sensitive to families that report income lower than their own electricity expense: the median is ${pctTexto(s.mediana_renda_pct, 2)} and, without the ${n} sample families in that situation, the average ${verbo} ${pctTexto(s.media_sem_energia_acima_da_renda_pct, 2)}.`,
      ),
    );
  }
  return partes.join(" ");
}

/* ================================================================ P062: acesso e sistemas isolados */

export const INDICADORES_PNAD = ["sem", "rede", "integral"] as const; // i18n: dado
export type IndicadorPnad = (typeof INDICADORES_PNAD)[number];
export function indicadorPnad(idioma: Idioma = idiomaEnergia()): Record<IndicadorPnad, { rotulo: string; campo: keyof LinhaPnad; cv: keyof LinhaPnad | null; unidade: string }> {
  const tx = txEm(idioma);
  const domicilios = tx("% dos domicílios", "% of households");
  return {
    sem: { rotulo: tx("Domicílios sem energia elétrica de nenhuma fonte", "Households without electricity from any source"), campo: "pct_sem_energia", cv: null, unidade: domicilios },
    rede: { rotulo: tx("Domicílios ligados à rede geral", "Households connected to the general grid"), campo: "pct_rede_geral", cv: "cv_pct_rede_geral", unidade: domicilios },
    integral: {
      rotulo: tx("Rede em tempo integral, entre os ligados à rede", "Full-time grid supply, among those connected to the grid"),
      campo: "pct_integral_entre_rede",
      cv: "cv_pct_integral",
      unidade: tx("% dos domicílios ligados à rede geral", "% of households connected to the general grid"),
    },
  };
}
export const INDICADOR_PNAD = indicadorPnad("pt");
export const SITUACOES_PNAD = ["total", "rural"] as const; // i18n: dado
export type SituacaoPnad = (typeof SITUACOES_PNAD)[number];
export const PROGRAMAS_LPT = ["total", "rural", "regioes_remotas", "recurso_distribuidora"] as const; // i18n: dado
export type ProgramaLptUrl = (typeof PROGRAMAS_LPT)[number];

/** Estado do P062 na URL: indicador e situação do mapa, UF em comparação (até 4) e programa do Luz para Todos. */
export const ESQUEMA_ACESSO = {
  ind: campo(tiposUrl.opcao(INDICADORES_PNAD), "sem", { param: "ac.ind" }), // i18n: dado
  sit: campo(tiposUrl.opcao(SITUACOES_PNAD), "total", { param: "ac.sit" }), // i18n: dado
  ufs: campo(tiposUrl.lista(leitorUf, { max: LIMITE_COMPARACAO }), [] as string[], { param: "ac.uf" }),
  prog: campo(tiposUrl.opcao(PROGRAMAS_LPT), "total", { param: "ac.prog" }), // i18n: dado
};

function valorPnad(l: LinhaPnad | undefined, ind: IndicadorPnad): number | null {
  if (!l) return null;
  const v = l[INDICADOR_PNAD[ind].campo];
  return typeof v === "number" ? v : null;
}

/**
 * Anos da série com os anos que o IBGE não publicou no meio (2020 e 2021 na tabela
 * 6737): o ano ausente entra com valor nulo para virar lacuna, nunca emenda.
 */
export function anosComLacunas(anos: readonly string[]): { ano: string; publicado: boolean }[] {
  const uniq = Array.from(new Set(anos)).sort();
  if (!uniq.length) return [];
  const out: { ano: string; publicado: boolean }[] = [];
  for (let a = Number(uniq[0]); a <= Number(uniq.at(-1)); a++) out.push({ ano: String(a), publicado: uniq.includes(String(a)) });
  return out;
}

/** Série anual por território (Brasil e regiões em todos os anos), uma coluna por território. */
export function dadosSeriePnad(serie: readonly LinhaPnad[], territorios: readonly string[], ind: IndicadorPnad) {
  const anos = anosComLacunas(serie.filter((l) => l.situacao === "total").map((l) => l.ano));
  return anos.map(({ ano }) => {
    const linha: Record<string, string | number | null> = { ano };
    for (const t of territorios) linha[t] = valorPnad(serie.find((l) => l.territorio === t && l.ano === ano && l.situacao === "total"), ind);
    return linha;
  });
}

/** Linhas por UF no último ano, na situação escolhida (total vem de pnad_serie; rural de pnad_situacao). */
export type AcessoPnad = Pick<Acesso, "ano_referencia" | "pnad_serie" | "pnad_situacao">;

export function linhasUfsPnad(acesso: AcessoPnad, situacao: SituacaoPnad, idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  const ano = acesso.ano_referencia;
  const fonte = situacao === "total" ? acesso.pnad_serie.filter((l) => l.ano === ano && l.situacao === "total") : acesso.pnad_situacao.filter((l) => l.situacao === "rural");
  return fonte
    .filter((l) => codigoUf(l.territorio))
    .map((l) => ({
      id: l.territorio,
      uf: l.territorio,
      ano: l.ano,
      situacao: l.situacao,
      pct_com: l.pct_com_energia,
      pct_sem: l.pct_sem_energia,
      pct_rede: l.pct_rede_geral,
      pct_integral: l.pct_integral_entre_rede,
      cv_integral: l.cv_pct_integral,
      domicilios_mil: l.domicilios_mil,
      sem_mil: l.domicilios_sem_energia_mil,
      sem_estado: l.domicilios_sem_energia_estado === "menos_de_1_mil" ? tx("menos de 1 mil", "less than 1 thousand") : l.domicilios_sem_energia_estado,
    }));
}

export function colunasUfsPnad(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const mil = tx("mil", "thousand");
  return [
    { id: "uf", rotulo: tx("UF", "State"), tipo: "texto" },
    { id: "pct_sem", rotulo: tx("Sem energia de nenhuma fonte", "Without energy from any source"), tipo: "percentual", casas: 1 },
    { id: "sem_mil", rotulo: tx("Domicílios sem energia", "Households without energy"), tipo: "numero", unidade: mil, casas: 0 },
    { id: "sem_estado", rotulo: tx("Contagem sem energia", "Count without energy"), tipo: "texto", categorica: true },
    { id: "pct_rede", rotulo: tx("Ligados à rede geral", "Connected to the general grid"), tipo: "percentual", casas: 1 },
    { id: "pct_integral", rotulo: tx("Rede em tempo integral (entre os ligados)", "Full-time grid (among those connected)"), tipo: "percentual", casas: 1 },
    { id: "cv_integral", rotulo: tx("CV do tempo integral", "CV of full-time supply"), tipo: "percentual", casas: 1 },
    { id: "domicilios_mil", rotulo: tx("Domicílios", "Households"), tipo: "numero", unidade: mil, casas: 0 },
  ];
}
export const COLUNAS_UFS_PNAD: ColunaTabela[] = colunasUfsPnad("pt");

const CAMPO_LINHA_UF: Record<IndicadorPnad, "pct_sem" | "pct_rede" | "pct_integral"> = { sem: "pct_sem", rede: "pct_rede", integral: "pct_integral" };

export function valoresMapaPnad(acesso: AcessoPnad, situacao: SituacaoPnad, ind: IndicadorPnad): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const l of linhasUfsPnad(acesso, situacao)) {
    const cod = codigoUf(l.uf);
    if (cod) out[cod] = l[CAMPO_LINHA_UF[ind]];
  }
  return out;
}

/** Histórico de UF a partir do CSV publicado (sob demanda): uma coluna por UF, anos não publicados como lacuna. */
export function dadosHistoricoPnadCsv(texto: string, ufs: readonly string[], ind: IndicadorPnad) {
  const linhas = lerCsv(texto).filter((r) => r.situacao === "total");
  const campoCsv = ind === "sem" ? "pct_sem_energia" : ind === "rede" ? "pct_rede_geral" : "pct_integral_entre_rede";
  const anos = anosComLacunas(linhas.map((r) => r.ano));
  return anos.map(({ ano }) => {
    const linha: Record<string, string | number | null> = { ano };
    for (const uf of ufs) {
      const r = linhas.find((x) => x.territorio === uf && x.ano === ano);
      linha[uf] = numeroCsv(r?.[campoCsv]);
    }
    return linha;
  });
}

/** Luz para Todos por ano, no programa escolhido (total ou um programa; nulo = nenhuma linha do programa no ano). */
export function dadosLptAnual(lpt: Pick<LuzParaTodos, "serie_anual" | "ultimo_mes">, prog: ProgramaLptUrl, idioma: Idioma = idiomaEnergia()) {
  const { tx, mes } = em(idioma);
  return lpt.serie_anual.map((a) => ({
    id: a.ano,
    rotulo: a.parcial ? tx(`${a.ano} (até ${mes(lpt.ultimo_mes)})`, `${a.ano} (up to ${mes(lpt.ultimo_mes)})`) : a.ano,
    valor: prog === "total" ? a.total : a[prog as ProgramaLpt],
  }));
}

export function linhasLptAnual(lpt: Pick<LuzParaTodos, "serie_anual" | "ultimo_mes">, idioma: Idioma = idiomaEnergia()) {
  const { tx, mes } = em(idioma);
  return lpt.serie_anual.map((a) => ({
    id: a.ano,
    ano: a.ano,
    situacao: a.parcial ? tx(`parcial (até ${mes(lpt.ultimo_mes)})`, `partial (up to ${mes(lpt.ultimo_mes)})`) : tx("completo", "complete"),
    total: a.total,
    rural: a.rural,
    regioes_remotas: a.regioes_remotas,
    recurso_distribuidora: a.recurso_distribuidora,
  }));
}

export function colunasLpt(lpt: Pick<LuzParaTodos, "programas">, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const domicilios = tx("domicílios", "households");
  return [
    // i18n: dado
    { id: "ano", rotulo: tx("Ano do atendimento", "Year of service"), tipo: "texto" },
    { id: "situacao", rotulo: tx("Ano", "Year"), tipo: "texto", categorica: true },
    { id: "total", rotulo: tx("Total", "Total"), tipo: "numero", unidade: domicilios, casas: 0 }, // i18n: dado
    ...lpt.programas.map((p): ColunaTabela => ({ id: p.id, rotulo: dadoTexto(p.rotulo, idioma), tipo: "numero", unidade: domicilios, casas: 0 })),
  ];
}

export function linhasIsoladosUf(si: Pick<SistemasIsolados, "por_uf">) {
  return si.por_uf.map((u) => ({
    id: u.uf,
    uf: u.uf,
    nome: u.nome ?? u.uf,
    localidades: u.localidades,
    populacao: u.populacao,
    sem_populacao: u.localidades_sem_populacao,
  }));
}

export function colunasIsoladosUf(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "nome", rotulo: tx("UF", "State"), tipo: "texto" },
    { id: "localidades", rotulo: tx("Localidades", "Localities"), tipo: "numero", casas: 0 },
    { id: "populacao", rotulo: tx("População informada", "Reported population"), tipo: "numero", unidade: tx("pessoas", "people"), casas: 0 },
    { id: "sem_populacao", rotulo: tx("Localidades sem população informada", "Localities without reported population"), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_ISOLADOS_UF: ColunaTabela[] = colunasIsoladosUf("pt");

export type LocalidadeLinha = {
  id: string;
  sigla: string;
  nome: string | null;
  uf: string | null;
  municipio: string | null;
  distribuidora: string | null;
  populacao: number | null;
  previsao: string | null;
  programa: string | null;
};

export function linhasLocalidades(locs: SistemasIsolados["localidades_mais_populosas"]): LocalidadeLinha[] {
  return locs.map((l) => ({
    id: l.sigla,
    sigla: l.sigla,
    nome: l.nome,
    uf: l.uf,
    municipio: l.municipio,
    distribuidora: l.distribuidora,
    populacao: l.populacao,
    previsao: l.previsao_interligacao,
    programa: l.programa,
  }));
}

/** Localidades do JSON sob demanda (listas na ordem de `campos`). */
export function localidadesDoJson(j: { campos: string[]; localidades: (string | number | null)[][] }): LocalidadeLinha[] {
  const i = (c: string) => j.campos.indexOf(c);
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? null : String(v));
  return j.localidades.map((l) => ({
    id: String(l[i("sigla")]),
    sigla: String(l[i("sigla")]),
    nome: s(l[i("nome")]),
    uf: s(l[i("uf")]),
    municipio: s(l[i("municipio")]),
    distribuidora: s(l[i("distribuidora")]),
    populacao: typeof l[i("populacao")] === "number" ? (l[i("populacao")] as number) : null,
    previsao: s(l[i("previsao_interligacao")]),
    programa: s(l[i("programa")]),
  }));
}

export function colunasLocalidades(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "nome", rotulo: tx("Localidade", "Locality"), tipo: "texto" },
    { id: "sigla", rotulo: tx("Código PASI", "PASI code"), tipo: "texto" },
    { id: "uf", rotulo: tx("UF", "State"), tipo: "texto", categorica: true },
    { id: "municipio", rotulo: tx("Município", "Municipality"), tipo: "texto" },
    { id: "distribuidora", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto", categorica: true },
    { id: "populacao", rotulo: tx("População informada", "Reported population"), tipo: "numero", unidade: tx("pessoas", "people"), casas: 0 },
    { id: "previsao", rotulo: tx("Previsão de interligação", "Expected interconnection"), tipo: "data" },
    { id: "programa", rotulo: tx("Programa", "Program"), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_LOCALIDADES: ColunaTabela[] = colunasLocalidades("pt");

/** Resposta curta do P062: falta de acesso (PNAD), isolamento (PASI) e atendimento (Luz para Todos), cada um na sua unidade. */
/** "N mil domicílios" sem energia, a contagem que a PNAD publica (ou a marca de menos de mil), no idioma. */
function domiciliosSemEnergia(l: LinhaPnad, idioma: Idioma): string {
  const { tx, inteiro } = em(idioma);
  return l.domicilios_sem_energia_estado === "menos_de_1_mil"
    ? tx("menos de 1 mil domicílios", "less than 1 thousand households")
    : l.domicilios_sem_energia_mil === null
      ? tx("um número sem dado de domicílios", "an unknown number of households")
      : tx(`${inteiro(l.domicilios_sem_energia_mil)} mil domicílios`, `${inteiro(l.domicilios_sem_energia_mil)} thousand households`);
}

export function respostaAcesso(a: Acesso, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, inteiro, pctTexto } = em(idioma);
  const br = a.pnad_serie.find((l) => l.territorio === "BR" && l.ano === a.ano_referencia && l.situacao === "total");
  const rural = a.pnad_situacao.find((l) => l.territorio === "BR" && l.situacao === "rural");
  const partes: string[] = [];
  if (br) {
    const sem = domiciliosSemEnergia(br, idioma);
    const naRural = rural ? tx(`; na área rural, ${pctTexto(rural.pct_sem_energia, 1)}`, `; in rural areas, ${pctTexto(rural.pct_sem_energia, 1)}`) : "";
    partes.push(
      tx(
        `Em ${a.ano_referencia}, ${sem} (${pctTexto(br.pct_sem_energia, 1)}) não tinham energia elétrica de nenhuma fonte, segundo a PNAD Contínua${naRural}.`,
        `In ${a.ano_referencia}, ${sem} (${pctTexto(br.pct_sem_energia, 1)}) had no electricity from any source, according to the PNAD Contínua${naRural}.`,
      ),
    );
    partes.push(
      tx(
        `Entre os domicílios ligados à rede geral, ${pctTexto(br.pct_integral_entre_rede, 1)} tinham fornecimento em tempo integral.`,
        `Among households connected to the general grid, ${pctTexto(br.pct_integral_entre_rede, 1)} had full-time supply.`,
      ),
    );
  }
  const si = a.sistemas_isolados;
  const c = si?.ciclos.find((x) => x.ciclo === si.ciclo);
  if (si && c) {
    const k = c.localidades_sem_populacao;
    partes.push(
      tx(
        `Fora do SIN, ${inteiro(c.localidades)} localidades com ${inteiro(c.populacao)} pessoas${k ? ` (${k} sem população informada)` : ""} dependiam de sistemas isolados no ciclo ${si.ciclo} do PASI.`,
        `Outside the SIN, ${inteiro(c.localidades)} localities with ${inteiro(c.populacao)} people${k ? ` (${k} without reported population)` : ""} depended on isolated systems in PASI cycle ${si.ciclo}.`,
      ),
    );
  }
  const lpt = a.universalizacao.luz_para_todos;
  if (lpt) {
    partes.push(
      tx(
        `O Luz para Todos registra ${inteiro(lpt.evidencia_total.valor_calculo)} domicílios atendidos de ${mes(lpt.evidencia_total.periodo.inicio)} a ${mes(lpt.ultimo_mes)}.`,
        `Luz para Todos records ${inteiro(lpt.evidencia_total.valor_calculo)} households served from ${mes(lpt.evidencia_total.periodo.inicio)} to ${mes(lpt.ultimo_mes)}.`,
      ),
    );
  }
  return partes.join(" ") || tx("Sem dado: o bloco de acesso não foi publicado nesta gold.", "No data: the access block was not published in this release.");
}

/**
 * Veredito do P062: quantos domicílios não tinham energia elétrica de nenhuma fonte (PNAD Contínua), com o limite de leitura:
 * sistemas isolados (pessoas) e Luz para Todos (domicílios atendidos) têm outra unidade e outra fonte e não se somam a esse
 * número. O fornecimento em tempo integral, as localidades e o total atendido ficam na resposta completa.
 */
export function vereditoAcesso(a: Acesso, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto } = em(idioma);
  const br = a.pnad_serie.find((l) => l.territorio === "BR" && l.ano === a.ano_referencia && l.situacao === "total");
  if (!br) return tx("Sem dado: o bloco de acesso não foi publicado nesta gold.", "No data: the access block was not published in this release.");
  const sem = domiciliosSemEnergia(br, idioma);
  return tx(
    `Em ${a.ano_referencia}, ${sem} (${pctTexto(br.pct_sem_energia, 1)}) não tinham energia elétrica de nenhuma fonte, segundo a PNAD Contínua. Sistemas isolados e Luz para Todos têm outra fonte e outra unidade e não se somam a esse número.`,
    `In ${a.ano_referencia}, ${sem} (${pctTexto(br.pct_sem_energia, 1)}) had no electricity from any source, according to the PNAD Contínua. Isolated systems and Luz para Todos have another source and another unit and do not add to this number.`,
  );
}

export function mudancaAcesso(a: Acesso, idioma: Idioma = idiomaEnergia()): string {
  const { tx, inteiro, pctTexto, listaTexto } = em(idioma);
  const serieBr = a.pnad_serie.filter((l) => l.territorio === "BR" && l.situacao === "total").sort((x, y) => (x.ano < y.ano ? -1 : 1));
  const prim = serieBr[0];
  const ult = serieBr.at(-1);
  const partes: string[] = [];
  if (prim && ult && prim !== ult) {
    const mil = (v: number | null) => (v === null ? semDado(idioma) : tx(`${inteiro(v)} mil`, `${inteiro(v)} thousand`));
    const a0 = mil(prim.domicilios_sem_energia_mil);
    const a1 = mil(ult.domicilios_sem_energia_mil);
    const p0 = pctTexto(prim.pct_integral_entre_rede, 1);
    const p1 = pctTexto(ult.pct_integral_entre_rede, 1);
    partes.push(
      tx(
        `Domicílios sem energia: ${a0} em ${prim.ano} e ${a1} em ${ult.ano}; rede em tempo integral entre os ligados, ${p0} e ${p1}.`,
        `Households without energy: ${a0} in ${prim.ano} and ${a1} in ${ult.ano}; full-time grid among those connected, ${p0} and ${p1}.`,
      ),
    );
  }
  const lacunas = anosComLacunas(serieBr.map((l) => l.ano)).filter((x) => !x.publicado);
  const anosLacuna = listaTexto(lacunas.map((x) => x.ano));
  if (lacunas.length)
    partes.push(tx(`O IBGE não publicou ${anosLacuna} nas tabelas 6737 e 6738: a linha fica interrompida.`, `IBGE did not publish ${anosLacuna} in tables 6737 and 6738: the line is interrupted.`));
  const si = a.sistemas_isolados;
  if (si && si.ciclos.length > 1) {
    const p = si.ciclos[0];
    const u = si.ciclos.at(-1)!;
    const sairam = u.sairam_da_lista !== undefined ? tx(` (${inteiro(u.sairam_da_lista)} saíram da lista no último ciclo)`, ` (${inteiro(u.sairam_da_lista)} left the list in the latest cycle)`) : "";
    partes.push(
      tx(
        `Sistemas isolados: ${inteiro(p.localidades)} localidades no ciclo ${p.ciclo} e ${inteiro(u.localidades)} no ciclo ${u.ciclo}${sairam}.`,
        `Isolated systems: ${inteiro(p.localidades)} localities in cycle ${p.ciclo} and ${inteiro(u.localidades)} in cycle ${u.ciclo}${sairam}.`,
      ),
    );
  }
  const lpt = a.universalizacao.luz_para_todos;
  const ultAno = lpt?.serie_anual.filter((x) => !x.parcial).at(-1);
  if (lpt && ultAno)
    partes.push(
      tx(
        `Luz para Todos: ${inteiro(ultAno.total)} domicílios atendidos em ${ultAno.ano}, o último ano completo do arquivo.`,
        `Luz para Todos: ${inteiro(ultAno.total)} households served in ${ultAno.ano}, the latest complete year in the file.`,
      ),
    );
  return partes.join(" ");
}

function rotuloCvPnad(k: "cv_pct_com_energia" | "cv_pct_rede_geral" | "cv_pct_integral", idioma: Idioma): string {
  const tx = txEm(idioma);
  const rotulos = {
    cv_pct_com_energia: tx("domicílios com energia", "households with energy"),
    cv_pct_rede_geral: tx("ligados à rede geral", "connected to the general grid"),
    cv_pct_integral: tx("rede em tempo integral", "full-time grid"),
  };
  return rotulos[k];
}
const CHAVES_CV_PNAD = ["cv_pct_com_energia", "cv_pct_rede_geral", "cv_pct_integral"] as const;

/**
 * Maior coeficiente de variação publicado pelo IBGE entre as UF no ano de
 * referência, no total e por situação: quanto a precisão cai nos recortes
 * pequenos, lido da gold (nunca um limite escrito no texto).
 */
export function maiorCvPnad(acesso: AcessoPnad, idioma: Idioma = idiomaEnergia()): { cv: number; uf: string; indicador: string; situacao: string } | null {
  const tx = txEm(idioma);
  const linhas = [...acesso.pnad_serie.filter((l) => l.ano === acesso.ano_referencia), ...acesso.pnad_situacao].filter((l) => codigoUf(l.territorio));
  let melhor: { cv: number; uf: string; indicador: string; situacao: string } | null = null;
  for (const l of linhas) {
    for (const k of CHAVES_CV_PNAD) {
      const v = l[k];
      if (typeof v === "number" && Number.isFinite(v) && (!melhor || v > melhor.cv)) {
        const situacaoEn = l.situacao === "rural" ? "rural" : l.situacao === "urbana" ? "urban" : l.situacao; // i18n: dado
        melhor = {
          cv: v,
          uf: l.territorio,
          indicador: rotuloCvPnad(k, idioma),
          situacao: l.situacao === "total" ? tx("todos os domicílios", "all households") : tx(`área ${l.situacao}`, `${situacaoEn} area`),
        };
      }
    }
  }
  return melhor;
}

/** Frase do "O que não permite concluir" do P062 sobre precisão amostral. */
export function textoPrecisaoPnad(acesso: AcessoPnad, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto } = em(idioma);
  const m = maiorCvPnad(acesso, idioma);
  const base = tx(
    "Domicílio sem energia não tem erro-padrão publicado (é a diferença entre duas estimativas).",
    "Households without energy have no published standard error (it is the difference between two estimates).",
  );
  return m
    ? tx(
        `${base} Nos recortes pequenos a precisão cai: o maior coeficiente de variação publicado em ${acesso.ano_referencia} entre as UF é ${pctTexto(m.cv, 1)} (${m.indicador}, ${m.uf}, ${m.situacao}).`,
        `${base} In small breakdowns precision falls: the largest coefficient of variation published in ${acesso.ano_referencia} among the states is ${pctTexto(m.cv, 1)} (${m.indicador}, ${m.uf}, ${m.situacao}).`,
      )
    : base;
}

/* ================================================================ abertura editorial: faixa de métricas, datas e notas */

/**
 * Seletores que a faixa de métricas, a linha de recorte e as notas das páginas da Inclusão energética leem. Nenhum número é
 * refeito: cada valor sai da mesma linha da gold que o gráfico e a tabela leem (linhaPof, estimativa), e cada data sai da
 * proveniência ou das referências publicadas. Nada aqui escreve ano, período ou data de referência à mão.
 */

/** Período da pesquisa de orçamento, lido da proveniência dos microdados ("jul/2017 a jul/2018"). */
export function periodoPof(o: Pick<Orcamento, "proveniencia">, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes } = em(idioma);
  const p = o.proveniencia.microdados.periodo_referencia;
  return tx(`${mes(p.inicio)} a ${mes(p.fim)}`, `${mes(p.inicio)} to ${mes(p.fim)}`);
}

/** Data de referência dos valores em reais da pesquisa ("15/01/2018"), lida da unidade que a gold publica; null quando a unidade não a traz. */
export function dataBaseReaisPof(o: Pick<Orcamento, "proveniencia">): string | null {
  return /\((\d{2}\/\d{2}\/\d{4})\)/.exec(o.proveniencia.microdados.unidade)?.[1] ?? null;
}

/**
 * Razão de médias do Brasil (energia na despesa total) nas classes de rendimento mais baixa e mais alta e no conjunto das
 * famílias: as mesmas linhas que o gráfico por classe desenha. Valor suprimido pela precisão vem nulo, nunca zero.
 */
export function destaquesRendaPof(orc: OrcamentoBase): {
  baixa: { rotulo: string; valor: number | null } | null;
  alta: { rotulo: string; valor: number | null } | null;
  total: number | null;
} {
  const classes = classesRenda(orc);
  const valor = (codigo: string) => estimativa(linhaPof(orc, "BR", codigo), "razao_medias_pct")[0];
  const baixa = classes[0];
  const alta = classes.length > 1 ? classes.at(-1) : undefined;
  return {
    baixa: baixa ? { rotulo: baixa.rotulo, valor: valor(baixa.codigo) } : null,
    alta: alta ? { rotulo: alta.rotulo, valor: valor(alta.codigo) } : null,
    total: valor("7999"),
  };
}

/** Frase que declara a idade da pesquisa junto do valor: o ano da publicação vem da própria gold, nunca escrito à mão. */
export function textoPofHistorica(orc: Pick<OrcamentoBase, "referencia">, anoPublicacao: string, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  return tx(
    `Estatística histórica: a POF mais recente publicada pelo IBGE é a ${nomePof(orc)}; o resultado não é projetado para ${anoPublicacao}.`,
    `Historical statistic: the most recent POF published by IBGE is the ${nomePof(orc)}; the result is not projected to ${anoPublicacao}.`,
  );
}

/** Uma medida da abertura com a sua data, a sua unidade e a sua natureza: cada fonte tem calendário próprio e nenhum rótulo genérico de atualização. */
export type DataMedida = {
  id: "pof" | "scs" | "cde" | "cadunico" | "pnad" | "pasi" | "lpt";
  rotulo: string;
  periodo: string;
  unidade: string;
  natureza: "OBSERVADO" | "CALCULADO" | "ESTIMADO";
};

/**
 * Datas de referência de cada parte da página, na ordem em que as medidas aparecem. O mês do SCS e o da CDE trazem o último
 * mês do arquivo e o último mês completo, porque só o mês completo entra nas comparações.
 */
export function datasMedidas(g: Pick<InclusaoGold, "referencias" | "tarifa_social" | "cobertura" | "orcamento" | "acesso">, idioma: Idioma = idiomaEnergia()): DataMedida[] {
  const { tx, mes, semDado } = em(idioma);
  const t = g.tarifa_social;
  const si = g.acesso.sistemas_isolados;
  const lpt = g.acesso.universalizacao.luz_para_todos;
  const mesMapa = t.mes_mapa ?? t.mes_referencia;
  const familias = tx("famílias", "families");
  const domicilios = tx("domicílios", "households");
  return [
    { id: "pof", rotulo: tx("Orçamento das famílias (POF)", "Family budgets (POF)"), periodo: periodoPof(g.orcamento, idioma), unidade: familias, natureza: "ESTIMADO" },
    {
      id: "scs",
      rotulo: tx("Tarifa Social, UC (SCS)", "Tarifa Social, consumer units (SCS)"),
      periodo: tx(
        `até ${mes(g.referencias.scs_ultimo_mes_no_arquivo)}; último mês completo ${mes(t.mes_referencia)}`,
        `up to ${mes(g.referencias.scs_ultimo_mes_no_arquivo)}; latest complete month ${mes(t.mes_referencia)}`,
      ),
      unidade: tx("unidades consumidoras", "consumer units"),
      natureza: "OBSERVADO",
    },
    {
      id: "cde",
      rotulo: tx("Tarifa Social, faturas (Beneficiários da CDE)", "Tarifa Social, bills (CDE Beneficiaries)"),
      periodo: tx(
        `até ${mes(g.referencias.cde_mes_mais_recente)}; último mês completo ${mes(mesMapa)}`,
        `up to ${mes(g.referencias.cde_mes_mais_recente)}; latest complete month ${mes(mesMapa)}`,
      ),
      unidade: tx("faturas", "bills"),
      natureza: "CALCULADO",
    },
    { id: "cadunico", rotulo: tx("Cadastro Único (MI Social)", "Cadastro Único (federal social registry, MI Social)"), periodo: mes(g.cobertura.brasil?.mes), unidade: familias, natureza: "CALCULADO" },
    { id: "pnad", rotulo: tx("Acesso (PNAD Contínua)", "Access (PNAD Contínua)"), periodo: g.acesso.ano_referencia, unidade: domicilios, natureza: "ESTIMADO" },
    { id: "pasi", rotulo: tx("Sistemas isolados (PASI)", "Isolated systems (PASI)"), periodo: si ? tx(`ciclo ${si.ciclo}`, `cycle ${si.ciclo}`) : semDado, unidade: tx("pessoas", "people"), natureza: "OBSERVADO" },
    {
      id: "lpt",
      rotulo: tx("Luz para Todos (MME)", "Luz para Todos (MME electrification program)"),
      periodo: lpt ? tx(`${mes(lpt.evidencia_total.periodo.inicio)} a ${mes(lpt.ultimo_mes)}`, `${mes(lpt.evidencia_total.periodo.inicio)} to ${mes(lpt.ultimo_mes)}`) : semDado,
      unidade: domicilios,
      natureza: "OBSERVADO",
    },
  ];
}

/* ================================================================ rodada 2: valor negativo, estado do controle e base legal */

/**
 * Nota que acompanha todo desconto negativo por UF e mês. O sinal vem do arquivo da ANEEL (o pipeline soma o valor de cada linha
 * com o sinal da fonte) e a página o mostra como está, sem corrigir nem excluir. A regra lê o dado: qualquer UF e qualquer mês com
 * desconto (total ou médio por fatura) negativo recebe a mesma nota, no mapa, na tabela e no histórico.
 */
export function notaDescontoNegativo(idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  return tx(
    "valor negativo na fonte; a fonte não diz o motivo; pode refletir ajuste ou estorno, o que é inferência e não está confirmado. O valor aparece como publicado, sem correção nem exclusão.",
    "negative value in the source; the source does not give the reason; it may reflect an adjustment or reversal, which is an inference and is not confirmed. The value appears as published, without correction or exclusion.",
  );
}
export const NOTA_DESCONTO_NEGATIVO = notaDescontoNegativo("pt");

const negativo = (v: number | null | undefined): v is number => temValor(v) && v < 0;

/** Há valor negativo entre os valores do mapa (número negativo; ausência não conta). */
export function valoresTemNegativo(valores: Readonly<Record<string, number | null>>): boolean {
  return Object.values(valores).some(negativo);
}

/** UF do mês do mapa com desconto das faturas ou desconto médio por fatura negativo, lidas do dado (qualquer UF). */
export function ufsComDescontoNegativo(ufs: readonly UfTsee[]): UfTsee[] {
  return ufs.filter((u) => negativo(u.desconto_reais) || negativo(u.desconto_medio_por_fatura_reais));
}

/** Nota da tabela por UF: nomes das UF com desconto negativo e a nota; null quando nenhuma UF tem valor negativo. */
export function textoDescontoNegativoUf(ufs: readonly UfTsee[], idioma: Idioma = idiomaEnergia()): string | null {
  const neg = ufsComDescontoNegativo(ufs);
  return neg.length ? `${listaTexto(neg.map((u) => u.nome), idioma)}: ${notaDescontoNegativo(idioma)}` : null;
}

/** Nota do mapa: só nas medidas em reais (a contagem de faturas não tem sinal negativo); null sem valor negativo na medida escolhida. */
export function textoDescontoNegativoMapa(ufs: readonly UfTsee[], medida: MedidaMapaTsee, idioma: Idioma = idiomaEnergia()): string | null {
  const tx = txEm(idioma);
  if (medida === "faturas") return null;
  const valores = valoresMapaTsee(ufs, medida);
  const neg = ufs.filter((u) => negativo(valores[codigoUf(u.uf) ?? ""]));
  const nomes = listaTexto(neg.map((u) => u.nome), idioma);
  const nota = notaDescontoNegativo(idioma);
  return neg.length
    ? tx(
        `${nomes}: ${nota} A classe "menos de 0" é só desse valor e não faz parte da escala do desconto positivo.`,
        `${nomes}: ${nota} The "less than 0" class is only for this value and is not part of the positive discount scale.`,
      )
    : null;
}

/**
 * Classes do mapa por UF. O valor negativo fica numa classe própria ("menos de 0") e não entra no cálculo dos quantis do desconto
 * positivo, que define a escala da legenda; sem valor negativo, quantis em cinco classes, como antes.
 */
export function classificacaoMapaTsee(valores: Readonly<Record<string, number | null>>, casas: number): Classificacao {
  const todos = Object.values(valores);
  if (!valoresTemNegativo(valores)) return quebrasQuantis(todos, 5, { casas });
  const formatar = (v: number) => (v === 0 ? "0" : numTexto(v, casas));
  const q = quebrasQuantis(
    todos.filter((v) => !negativo(v)),
    5,
    { casas, formatar },
  );
  return quebrasFixas([0, ...q.cortes.filter((c) => c > 0)], todos, { casas, formatar });
}

/**
 * Meses, por UF escolhida, em que o desconto das faturas é negativo no histórico. Mês sem valor no gráfico (distribuidora da UF
 * ausente do arquivo) fica de fora, porque o ponto não é desenhado.
 */
export function mesesComDescontoNegativo(
  json: Pick<SerieCdeUf, "meses" | "ufs" | "desconto_faturas_reais">,
  ufs: readonly string[],
  atingidas: Record<string, Record<string, string[]>> = {},
): { uf: string; meses: string[]; comValor: number }[] {
  const out: { uf: string; meses: string[]; comValor: number }[] = [];
  for (const uf of ufs) {
    const i = json.ufs.indexOf(uf);
    if (i < 0) continue;
    const visiveis = json.meses.filter((m) => (atingidas[m]?.[uf]?.length ?? 0) === 0);
    const meses = visiveis.filter((m) => negativo(json.desconto_faturas_reais[i]?.[json.meses.indexOf(m)] ?? null));
    if (meses.length) out.push({ uf, meses, comValor: visiveis.length });
  }
  return out;
}

/** Nota do histórico das UF escolhidas na medida "desconto das faturas"; null sem valor negativo nelas. */
export function textoDescontoNegativoHistorico(
  json: Pick<SerieCdeUf, "meses" | "ufs" | "desconto_faturas_reais">,
  ufs: readonly string[],
  nomeUf: (uf: string) => string,
  atingidas: Record<string, Record<string, string[]>> = {},
  idioma: Idioma = idiomaEnergia(),
): string | null {
  const { tx, mes, listaTexto } = em(idioma);
  const neg = mesesComDescontoNegativo(json, ufs, atingidas);
  if (!neg.length) return null;
  const partes = neg.map((x) =>
    x.meses.length === x.comValor
      ? tx(`${nomeUf(x.uf)} em todos os meses com valor`, `${nomeUf(x.uf)} in every month with a value`)
      : tx(`${nomeUf(x.uf)} em ${listaTexto(x.meses.map(mes))}`, `${nomeUf(x.uf)} in ${listaTexto(x.meses.map(mes))}`),
  );
  return `${listaTexto(partes)}: ${notaDescontoNegativo(idioma)}`;
}

/** Linha de "o que não permite concluir" da abertura da Tarifa Social: o limite das unidades e, lidas do dado, as UF com desconto negativo. */
export function limiteTarifaSocial(ufs: readonly UfTsee[], idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const neg = ufsComDescontoNegativo(ufs);
  const base = tx(
    "número de famílias nem de pessoas beneficiadas: UC e fatura são unidades da conta.",
    "the number of families or people benefited: consumer units and bills are units of the electricity account.",
  );
  const nomes = listaTexto(neg.map((u) => u.nome), idioma);
  return neg.length
    ? tx(`${base} UF com desconto negativo na fonte, sem motivo informado: ${nomes}.`, `${base} States with a negative discount in the source, with no reason given: ${nomes}.`)
    : base;
}

/** Veredito da medida escolhida na série nacional (UC, participação ou DMR): a frase acompanha o controle, não só o gráfico. */
export function vereditoTarifaSocialMedida(t: TarifaSocial, medida: MedidaTsee, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, pctTexto, reaisGrandes, reaisTexto } = em(idioma);
  const k = t.kpis;
  if (medida === "uc") return vereditoTarifaSocial(t, idioma);
  if (medida === "part") {
    return tx(
      `Em ${mes(k.participacao_pct.mes)}, ${pctTexto(k.participacao_pct.valor, 1)} das UC residenciais tinham Tarifa Social: a razão entre as UC com o benefício e as UC residenciais das mesmas distribuidoras, em meses completos.`,
      `In ${mes(k.participacao_pct.mes)}, ${pctTexto(k.participacao_pct.valor, 1)} of residential consumer units had the Tarifa Social: the ratio between the consumer units with the benefit and the residential consumer units of the same distribution utilities, in complete months.`,
    );
  }
  return tx(
    `Em ${mes(k.dmr_mes_reais.mes)}, a Diferença Mensal de Receita (DMR) da Tarifa Social foi de ${reaisGrandes(k.dmr_mes_reais.valor)}, ou ${reaisTexto(k.dmr_por_uc_reais.valor)} por UC: a receita que a distribuidora deixa de cobrar, não o desconto de cada família.`,
    `In ${mes(k.dmr_mes_reais.mes)}, the Tarifa Social's Monthly Revenue Difference (DMR) was ${reaisGrandes(k.dmr_mes_reais.valor)}, or ${reaisTexto(k.dmr_por_uc_reais.valor)} per consumer unit: the revenue the distribution utility does not charge, not each family's discount.`,
  );
}

/** Resposta completa da medida escolhida: a da UC já traz as três medidas; as outras abrem pela própria medida. */
export function respostaTarifaSocialMedida(t: TarifaSocial, medida: MedidaTsee, idioma: Idioma = idiomaEnergia()): string {
  const { tx, mes, pctTexto, reaisGrandes, reaisTexto, numTexto } = em(idioma);
  if (medida === "uc") return respostaTarifaSocial(t, idioma);
  const k = t.kpis;
  const abertura =
    medida === "part"
      ? tx(
          `Participação nas UC residenciais: ${pctTexto(k.participacao_pct.valor, 1)} em ${mes(k.participacao_pct.mes)}.`,
          `Share of residential consumer units: ${pctTexto(k.participacao_pct.valor, 1)} in ${mes(k.participacao_pct.mes)}.`,
        )
      : tx(
          `DMR: ${reaisGrandes(k.dmr_mes_reais.valor)} em ${mes(k.dmr_mes_reais.mes)}, ${reaisTexto(k.dmr_por_uc_reais.valor)} por UC e ${numTexto(k.kwh_por_uc.valor, 1)} kWh por UC no mês.`,
          `DMR: ${reaisGrandes(k.dmr_mes_reais.valor)} in ${mes(k.dmr_mes_reais.mes)}, ${reaisTexto(k.dmr_por_uc_reais.valor)} per consumer unit and ${numTexto(k.kwh_por_uc.valor, 1)} kWh per consumer unit in the month.`,
        );
  return `${abertura} ${respostaTarifaSocial(t, idioma)}`;
}

/**
 * Média das participações da energia na renda (Brasil), nas classes mais baixa e mais alta e no conjunto das famílias: as mesmas
 * linhas que o gráfico por classe desenha na base renda. Na renda não há razão de médias. Valor suprimido vem nulo, nunca zero.
 */
export function destaquesParticipacaoRendaPof(orc: OrcamentoBase): {
  baixa: { rotulo: string; valor: number | null } | null;
  alta: { rotulo: string; valor: number | null } | null;
  total: number | null;
} {
  const classes = classesRenda(orc);
  const valor = (codigo: string) => estimativa(linhaPof(orc, "BR", codigo), "media_razoes_renda_pct")[0];
  const baixa = classes[0];
  const alta = classes.length > 1 ? classes.at(-1) : undefined;
  return {
    baixa: baixa ? { rotulo: baixa.rotulo, valor: valor(baixa.codigo) } : null,
    alta: alta ? { rotulo: alta.rotulo, valor: valor(alta.codigo) } : null,
    total: valor("7999"),
  };
}

/** Veredito da base renda: a média das participações da energia na renda da classe de menor renda contra o conjunto, com a mediana ao lado. */
export function vereditoOrcamentoRenda(orc: OrcamentoBase, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto, dado } = em(idioma);
  const classes = classesRenda(orc);
  const baixa = classes[0];
  const t = linhaPof(orc, "BR", "7999");
  const b = baixa ? linhaPof(orc, "BR", baixa.codigo) : undefined;
  if (!t || !b || !baixa) return tx("Sem dado: a POF não foi processada nesta publicação.", "No data: the POF was not processed in this publication.");
  const mr = (l: LinhaPof | undefined) => estimativa(l, "media_razoes_renda_pct")[0];
  const dir = comparaArredondado(mr(b), mr(t), 1);
  const abertura = aberturaPeso(dir, idioma);
  const quem =
    dir === "igual"
      ? tx("na renda das famílias de menor renda e do conjunto", "in the income of lower-income families and of all families")
      : tx("na renda das famílias de menor renda", "in the income of lower-income families");
  const classe = minusculaInicial(dado(baixa.rotulo));
  const mediana = pctTexto(estimativa(b, "mediana_renda_pct")[0], 1);
  return tx(
    `Na ${nomePof(orc)}, ${abertura} ${quem}: a média das participações da energia foi ${pctTexto(mr(b), 1)} da renda das famílias com rendimento ${classe} (mediana ${mediana}), contra ${pctTexto(mr(t), 1)} no conjunto das famílias.`,
    `In the ${nomePof(orc)}, ${abertura} ${quem}: the average share of energy was ${pctTexto(mr(b), 1)} of the income of families with income ${classe} (median ${mediana}), against ${pctTexto(mr(t), 1)} for all families.`,
  );
}

/** Resposta completa da base renda: média e mediana nas três linhas, o que a base não traz e a sensibilidade da classe mais baixa. */
export function respostaOrcamentoRenda(orc: OrcamentoBase, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto, inteiro, dado } = em(idioma);
  const classes = classesRenda(orc);
  const baixa = classes[0];
  const alta = classes.length > 1 ? classes.at(-1) : undefined;
  const t = linhaPof(orc, "BR", "7999");
  const b = baixa ? linhaPof(orc, "BR", baixa.codigo) : undefined;
  const a = alta ? linhaPof(orc, "BR", alta.codigo) : undefined;
  if (!t || !b || !baixa) return tx("Sem dado: a POF não foi processada nesta publicação.", "No data: the POF was not processed in this publication.");
  const mr = (l: LinhaPof | undefined) => pctTexto(estimativa(l, "media_razoes_renda_pct")[0], 2);
  const md = (l: LinhaPof | undefined) => pctTexto(estimativa(l, "mediana_renda_pct")[0], 2);
  const classe = minusculaInicial(dado(baixa.rotulo));
  const classeAlta = alta ? minusculaInicial(dado(alta.rotulo)) : "";
  let s = tx(
    `Na ${nomePof(orc)}, a média das participações da energia na renda foi ${mr(b)} nas famílias com rendimento ${classe}, ${mr(t)} no conjunto das famílias${a && alta ? ` e ${mr(a)} na classe ${classeAlta}` : ""}. A mediana da participação é ${md(b)}, ${md(t)}${a ? ` e ${md(a)}` : ""} nas mesmas linhas.`,
    `In the ${nomePof(orc)}, the average share of energy in income was ${mr(b)} for families with income ${classe}, ${mr(t)} for all families${a && alta ? ` and ${mr(a)} in the ${classeAlta} class` : ""}. The median share is ${md(b)}, ${md(t)}${a ? ` and ${md(a)}` : ""} in the same rows.`,
  );
  s += tx(
    " Na renda o observatório não publica razão de médias: só a média e a mediana das participações, calculadas família a família.",
    " For income the observatory does not publish a ratio of averages: only the average and the median of the shares, calculated family by family.",
  );
  const sens = orc.sensibilidade_media_razoes_renda[baixa.codigo];
  if (sens) {
    const n = inteiro(sens.familias_amostra_energia_acima_da_renda);
    const p = pctTexto(sens.media_sem_energia_acima_da_renda_pct, 2);
    s += tx(
      ` A média da classe mais baixa depende de ${n} famílias da amostra com despesa com energia acima da renda: sem elas, ${p}.`,
      ` The average of the lowest class depends on ${n} sample families with electricity expense above income: without them, ${p}.`,
    );
  }
  return s;
}

/** Indicador do Acesso: a PNAD publica o percentual e o coeficiente de variação de cada um para o Brasil. */
function linhaBrPnad(a: Pick<Acesso, "ano_referencia" | "pnad_serie">): LinhaPnad | undefined {
  return a.pnad_serie.find((l) => l.territorio === "BR" && l.ano === a.ano_referencia && l.situacao === "total");
}

/** Veredito do indicador escolhido (sem energia, ligados à rede geral ou rede em tempo integral): a frase acompanha o controle. */
export function vereditoAcessoIndicador(a: Acesso, ind: IndicadorPnad, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto } = em(idioma);
  if (ind === "sem") return vereditoAcesso(a, idioma);
  const br = linhaBrPnad(a);
  if (!br) return tx("Sem dado: o bloco de acesso não foi publicado nesta gold.", "No data: the access block was not published in this release.");
  const limite = tx(
    "Sistemas isolados e Luz para Todos têm outra fonte e outra unidade e não se somam a esse número.",
    "Isolated systems and Luz para Todos have another source and another unit and do not add to this number.",
  );
  if (ind === "rede") {
    return tx(
      `Em ${a.ano_referencia}, ${pctTexto(br.pct_rede_geral, 1)} dos domicílios estavam ligados à rede geral, segundo a PNAD Contínua. ${limite}`,
      `In ${a.ano_referencia}, ${pctTexto(br.pct_rede_geral, 1)} of households were connected to the general grid, according to the PNAD Contínua. ${limite}`,
    );
  }
  return tx(
    `Em ${a.ano_referencia}, entre os domicílios ligados à rede geral, ${pctTexto(br.pct_integral_entre_rede, 1)} tinham fornecimento em tempo integral, segundo a PNAD Contínua. ${limite}`,
    `In ${a.ano_referencia}, among households connected to the general grid, ${pctTexto(br.pct_integral_entre_rede, 1)} had full-time supply, according to the PNAD Contínua. ${limite}`,
  );
}

/** Resposta completa do indicador escolhido: abre pelo indicador e segue com a resposta que já traz os demais. */
export function respostaAcessoIndicador(a: Acesso, ind: IndicadorPnad, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto } = em(idioma);
  if (ind === "sem") return respostaAcesso(a, idioma);
  const br = linhaBrPnad(a);
  const abertura = !br
    ? ""
    : ind === "rede"
      ? tx(
          `Ligados à rede geral: ${pctTexto(br.pct_rede_geral, 1)} dos domicílios (coeficiente de variação de ${pctTexto(br.cv_pct_rede_geral, 1)}). `,
          `Connected to the general grid: ${pctTexto(br.pct_rede_geral, 1)} of households (coefficient of variation of ${pctTexto(br.cv_pct_rede_geral, 1)}). `,
        )
      : tx(
          `Rede em tempo integral entre os ligados à rede geral: ${pctTexto(br.pct_integral_entre_rede, 1)} (coeficiente de variação de ${pctTexto(br.cv_pct_integral, 1)}). `,
          `Full-time grid among those connected to the general grid: ${pctTexto(br.pct_integral_entre_rede, 1)} (coefficient of variation of ${pctTexto(br.cv_pct_integral, 1)}). `,
        );
  return `${abertura}${respostaAcesso(a, idioma)}`;
}

/** Os três atos da base legal da regra de 80 kWh, lidos da linha do tempo da Regulação; null quando o ato não está lá. */
export type BaseLegalTarifaSocial = {
  mpv: EventoRegulatorio | null;
  lei: EventoRegulatorio | null;
  ren: EventoRegulatorio | null;
};

/** Eventos da linha do tempo da Regulação que a Tarifa Social cita (MPV nº 1.300/2025, Lei nº 15.235/2025 e a REN que a regula). */
export function baseLegalTarifaSocial(reg: Pick<GoldRegulacao, "linha_do_tempo"> | null): BaseLegalTarifaSocial {
  const ev = reg?.linha_do_tempo?.eventos ?? [];
  const por = (id: string) => ev.find((e) => e.id === id) ?? null;
  return { mpv: por("mpv-1300-2025"), lei: por("lei-15235-2025"), ren: por("ren-1147-2025") };
}

/** Âncora do evento na linha do tempo da Regulação. */
export const ROTA_LINHA_DO_TEMPO = "/setor-eletrico/regulacao/linha-do-tempo";
export const ancoraEventoRegulacao = (id: string) => `${ROTA_LINHA_DO_TEMPO}#evento-${id}`;

/**
 * Qual estimador o destaque da faixa de métricas usa e o que isso significa para a leitura. Na despesa, a razão de médias (despesa
 * média com energia sobre despesa média total da classe); na renda, a média das participações família a família, que é a mais
 * sensível a famílias com renda declarada muito baixa e vem com a mediana e a média sem essas famílias, lidas da gold.
 */
export function textoEstimadorDestaque(orc: OrcamentoBase, base: BasePof, idioma: Idioma = idiomaEnergia()): string {
  const { tx, pctTexto, inteiro } = em(idioma);
  if (base === "despesa") {
    return tx(
      "O destaque é a razão de médias: a despesa média com energia sobre a despesa média total da classe, que não depende da participação de cada família.",
      "The highlight is the ratio of averages: the average electricity expense over the average total expense of the class, which does not depend on each family's share.",
    );
  }
  const baixa = classesRenda(orc)[0];
  const sens = baixa ? orc.sensibilidade_media_razoes_renda[baixa.codigo] : undefined;
  const abertura = tx(
    "O destaque é a média das participações família a família, o estimador mais sensível a famílias com renda declarada muito baixa.",
    "The highlight is the average of the shares family by family, the estimator most sensitive to families with very low declared income.",
  );
  if (!sens) return abertura;
  const md = pctTexto(sens.mediana_renda_pct, 1);
  const n = inteiro(sens.familias_amostra_energia_acima_da_renda);
  const sem = pctTexto(sens.media_sem_energia_acima_da_renda_pct, 1);
  return tx(
    `${abertura} Na classe mais baixa a mediana é ${md} e, sem as ${n} famílias da amostra com despesa com energia acima da renda, a média é ${sem}.`,
    `${abertura} In the lowest class the median is ${md} and, without the ${n} sample families with electricity expense above income, the average is ${sem}.`,
  );
}
