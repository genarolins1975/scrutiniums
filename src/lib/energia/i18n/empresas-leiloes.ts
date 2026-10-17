/**
 * Tabelas de tradução dos rótulos que chegam das golds de Empresas, Listadas e Leilões
 * (public/energia/gold/empresas.json, listadas.json e leiloes.json). Cada tabela vai do texto
 * português exato publicado pela gold para o inglês; valor sem entrada volta como veio (em
 * português), e o componente que o exibe o marca com <TrechoPortugues> quando pode.
 *
 * Nenhuma tabela muda número, data ou nome próprio: só a forma inglesa do mesmo rótulo.
 */
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "../idioma";
import { dataBR } from "../formato";

export type Tabela = Readonly<Record<string, string>>;

/** Forma inglesa do rótulo publicado pela gold, ou o próprio texto quando a tabela não o tem (ou a página é portuguesa). */
export function traduzir(tabela: Tabela, texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  return tabela[texto] ?? texto;
}

/** Se a página inglesa tem a forma inglesa do rótulo (sem ela, o componente marca o trecho como só em português). */
export function temTraducao(tabela: Tabela, texto: string | null | undefined): boolean {
  return !!texto && Object.prototype.hasOwnProperty.call(tabela, texto);
}

/* ---------------------------------------------------------------- Empresas: cadastro (SIGA) */

/** Fases do SIGA. */
export const FASE_SIGA_EN: Tabela = {
  Operação: "Operation",
  Construção: "Construction",
  "Construção não iniciada": "Construction not started",
};

/** Estado do vínculo das usinas, como a gold o descreve (cadastro.ativos.estados[].rotulo). */
export const ESTADO_VINCULO_GOLD_EN: Tabela = {
  "Todos os proprietários com CNPJ e participações somando 100%": "All owners with CNPJ and stakes adding up to 100%",
  "Participações somam 100%, com algum proprietário sem CNPJ (pessoa física)": "Stakes add up to 100%, with some owner without CNPJ (individual)",
  "Participações publicadas não somam 100% (ex.: matriz e filial com 100% cada)": "Published stakes do not add up to 100% (e.g. head office and branch with 100% each)",
  "Proprietário não informado no SIGA": "Owner not reported in SIGA",
};

/** Regimes de exploração do SIGA (cadastro.ativos.por_regime[].rotulo). */
export const REGIME_EN: Tabela = {
  "Produção Independente de Energia": "Independent power production",
  "Serviço Público": "Public service",
  "Autoprodução de Energia": "Self-production of energy",
  Registro: "Registration",
};

/** Notas curtas da gold de Empresas. */
export const NOTA_EMPRESAS_EN: Tabela = {
  "CNPJ diferente nas duas fontes; causa não verificada (troca de proprietário entre as datas dos arquivos ou divergência de cadastro): cada fonte tem uma única captura.":
    "Different CNPJ in the two sources; cause not verified (change of owner between the file dates or a registry discrepancy): each source has a single capture.",
  "Cobertura das companhias abertas; não é o setor inteiro.": "Coverage of publicly held companies; not the whole sector.",
  "usinas de todas as fases do SIGA (operação, construção e construção não iniciada)": "plants in all SIGA phases (operation, construction and construction not started)",
};

/* ---------------------------------------------------------------- Empresas: controle */

/** Motivo da parada da cadeia de controle, como a gold o explica (controle.cobertura.motivos_parada[].rotulo). */
export const MOTIVO_PARADA_GOLD_EN: Tabela = {
  "o agente não aparece na composição societária declarada à ANEEL na janela vigente": "the agent does not appear in the shareholding structure declared to ANEEL in the current window",
  "mais de um sócio marcado como controlador (controle compartilhado)": "more than one shareholder marked as controlling (shared control)",
  "declarações do mesmo trimestre discordam sobre quem é o controlador": "declarations for the same quarter disagree on who the controlling shareholder is",
  "nenhum sócio marcado como controlador": "no shareholder marked as controlling",
  "controlador único sem CNPJ publicado (empresa estrangeira, governo, fundo ou sócio declarado sem documento)":
    "single controlling shareholder without a published CNPJ (foreign company, government, fund or shareholder declared without a document)",
  "controlador único é pessoa física (CPF mascarado pela fonte)": "single controlling shareholder is an individual (CPF masked by the source)",
  "a cadeia de controladores volta a um nó já visitado": "the chain of controlling shareholders returns to a node already visited",
};

/* ---------------------------------------------------------------- Empresas: finanças (CVM) */

/** Contas padronizadas da CVM (financas.contas[].rotulo). */
export const CONTA_CVM_EN: Tabela = {
  "Receita de venda de bens e/ou serviços": "Net revenue from sales of goods and/or services",
  "Resultado antes do resultado financeiro e dos tributos": "Earnings before financial result and taxes (EBIT)",
  "Lucro ou prejuízo do período": "Net income or loss for the period",
  "Lucro atribuído aos sócios da controladora": "Net income attributable to owners of the parent",
  "Ativo total": "Total assets", // i18n: dado
  "Caixa e equivalentes de caixa": "Cash and cash equivalents",
  "Empréstimos e financiamentos no passivo circulante": "Current loans and financing",
  "Empréstimos e financiamentos no passivo não circulante": "Non-current loans and financing",
  "Patrimônio líquido": "Shareholders' equity",
  "Caixa líquido das atividades operacionais": "Net cash from operating activities",
  "Caixa líquido das atividades de investimento": "Net cash from investing activities",
  "Empréstimos, financiamentos e debêntures (circulante + não circulante)": "Loans, financing and debentures (current + non-current)",
};

/** Definição de cada conta (financas.contas[].definicao). */
export const DEFINICAO_CONTA_EN: Tabela = {
  "Receita líquida da DRE (conta 3.01). Nas distribuidoras inclui a receita de construção da infraestrutura da concessão (ICPC 01), que tem custo equivalente na conta 3.02.":
    "Net revenue in the income statement (DRE, account 3.01). For distribution utilities it includes revenue from building the concession infrastructure (ICPC 01), which has an equivalent cost in account 3.02.",
  "Conta 3.05 da DRE (resultado operacional depois da equivalência patrimonial). Não é EBITDA: depreciação e amortização não são somadas de volta.":
    "Account 3.05 of the income statement (operating result after equity method results). It is not EBITDA: depreciation and amortization are not added back.",
  "Conta 3.11 da DRE. No consolidado inclui a parcela dos sócios não controladores (3.11.02).":
    "Account 3.11 of the income statement. In the consolidated statements it includes the share of non-controlling interests (3.11.02).",
  "Conta 3.11.01 da DRE consolidada. No individual a conta não existe (o lucro inteiro é da companhia).":
    "Account 3.11.01 of the consolidated income statement. In the individual statements the account does not exist (all net income belongs to the company).",
  "Conta 1 do balanço patrimonial ativo, no fim do período.": "Account 1 of the balance sheet (assets), at the end of the period.",
  "Conta 1.01.01 do balanço, no fim do período.": "Account 1.01.01 of the balance sheet, at the end of the period.",
  "Conta 2.01.04 (inclui debêntures e, no modelo vigente, arrendamentos quando a companhia os classifica ali).":
    "Account 2.01.04 (includes debentures and, in the current template, leases when the company classifies them there).",
  "Conta 2.02.01 (inclui debêntures).": "Account 2.02.01 (includes debentures).",
  "Conta 2.03. No consolidado inclui a participação dos não controladores (2.03.09).": "Account 2.03. In the consolidated statements it includes non-controlling interests (2.03.09).",
  "Conta 6.01 da demonstração dos fluxos de caixa (método direto ou indireto).": "Account 6.01 of the cash flow statement (direct or indirect method).",
  "Conta 6.02 da DFC. É a medida padronizada mais próxima de investimento: inclui imobilizado e intangível (ativo de concessão), mas também aquisições, aplicações financeiras e resgates; o investimento em ativos da concessão não tem conta fixa própria.":
    "Account 6.02 of the cash flow statement (DFC). It is the standardized measure closest to investment: it includes property, plant and equipment and intangible assets (concession assets), but also acquisitions, financial investments and redemptions; investment in concession assets has no fixed account of its own.",
  "Soma das contas 2.01.04 e 2.02.01 do mesmo escopo e da mesma data; calculada pelo observatório.":
    "Sum of accounts 2.01.04 and 2.02.01 for the same scope and date; calculated by the observatory.",
};

/** Situação do registro na CVM. */
export const SITUACAO_CVM_EN: Tabela = {
  ATIVO: "ACTIVE",
  CANCELADA: "CANCELLED",
  "SUSPENSO(A) - DECISÃO ADM": "SUSPENDED - ADMINISTRATIVE DECISION",
};

/** Setor declarado à CVM. */
export const SETOR_CVM_EN: Tabela = {
  "Energia Elétrica": "Electric power",
  "Emp. Adm. Part. - Energia Elétrica": "Holding companies - Electric power",
};

/* ---------------------------------------------------------------- Empresas: tarifa */

/**
 * Motivo da falta de tarifa vigente, publicado pela gold de Distribuidoras como frase com datas e CNPJ. Os dois padrões
 * conhecidos são reescritos em inglês com as mesmas datas, CNPJ, siglas e atos; outro texto volta como veio.
 */
export function motivoTarifa(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  const data = (d: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
    return m ? dataBR(`${m[3]}-${m[2]}-${m[1]}`, "en") : d;
  };
  let m = /^vigência encerrada em (\d{2}\/\d{2}\/\d{4}); a tarifa seguinte ainda não consta no arquivo gerado pela ANEEL em (\d{2}\/\d{2}\/\d{4})$/.exec(texto);
  if (m) return `validity ended on ${data(m[1])}; the next tariff is not yet in the file generated by ANEEL on ${data(m[2])}`;
  m = /^incorporada pela distribuidora de CNPJ (\d{14}) \(sigla atual ([^)]+)\), REA nº ([\d./]+)( \(provável\))?; a tarifa unificada começa em (\d{2}\/\d{2}\/\d{4})$/.exec(texto);
  if (m) return `merged into the distribution utility with CNPJ ${m[1]} (current acronym ${m[2]}), REA No. ${m[3]}${m[4] ? " (probable)" : ""}; the unified tariff starts on ${data(m[5])}`;
  m = /^sem tarifa publicada desde (\d{2}\/\d{2}\/\d{4}); o conjunto não informa o motivo \(incorporação, extinção ou troca de CNPJ\)$/.exec(texto);
  if (m) return `no tariff published since ${data(m[1])}; the dataset does not state the reason (merger, extinction or change of CNPJ)`;
  return texto;
}

/** Se o motivo tem forma inglesa (para o componente marcar o resto como só em português). */
export function motivoTarifaTraduzido(texto: string): boolean {
  return motivoTarifa(texto, "en") !== texto;
}
