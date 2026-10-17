import { createElement, Fragment, type ReactNode } from "react";
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "@/lib/energia/idioma";
import { Nome } from "@/components/i18n/Nome";

/**
 * Nome de ato, lei ou consulta citado dentro de uma frase montada pela lib ("pelo Despacho ANEEL nº 3.850/2025",
 * "a Consulta Pública nº 30/2026"): o nome próprio fica em português e, na página inglesa, ganha a marca de nome
 * (<Nome>) sem que a frase precise virar JSX na lib. Os padrões são os dos atos que a gold publica.
 */
const NOME_ATO =
  /(?:Retificação da )?(?:Resolução Normativa|Resolução Homologatória|Resolução Autorizativa|Resolução CREG|Resolução|Portaria Normativa|Portaria Interministerial|Portaria|Despacho|Lei Complementar|Lei|Medida Provisória|Decreto|Consulta Pública|Audiência Pública|Retif\. REH|RES CREG|REN|REH|REA|LC|MP)(?: (?:ANEEL|MME|CREG|GM\/MME|Normativa))? nº ?[\d.]+(?:\/\d{4})?(?:,? de \d{1,2}º? de [a-zç]+ de \d{4})?/g;

/** Frase com nomes de atos marcados: em português, o texto como veio; em inglês, os nomes dentro de <Nome>. */
export function comNomes(texto: string | null | undefined, idioma: Idioma = idiomaEnergia()): ReactNode {
  if (!texto || idioma !== "en") return texto ?? "";
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(NOME_ATO)) {
    const i = m.index ?? 0;
    if (i > ultimo) partes.push(texto.slice(ultimo, i));
    partes.push(createElement(Nome, { key: `n${i}` } as unknown as { children: ReactNode }, m[0]));
    ultimo = i + m[0].length;
  }
  if (!partes.length) return texto;
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return createElement(Fragment, null, ...partes);
}

/**
 * Tabelas exatas português → inglês para rótulos que vêm dos dados (gold) nas páginas de Regulação,
 * Dados e Metodologia. A chave é o valor exato publicado pela gold; o valor é a forma inglesa. Valor
 * sem entrada não é traduzido por aproximação: o chamador o mostra em português, marcado
 * (<TrechoPortugues>) quando é texto de tela.
 */

/** Rótulo de painel citado pela gold (links "painéis afetados" e "painéis relacionados"). */
export const PAINEIS_EN: Record<string, string> = {
  Carga: "Load",
  "Conta de luz": "Electricity bill",
  "Inclusão energética": "Energy inclusion",
  Mercado: "Market",
  PLD: "PLD",
  Perdas: "Losses",
  "Previsões": "Forecasts",
  Qualidade: "Quality of supply",
  "Rede e geração": "Grid and generation",
  "Transição e ambiente": "Transition and environment",
  "Água e clima": "Water and climate",
  Rede: "Grid",
  "Geração": "Generation",
  "Expansão": "Expansion",
  "Transição": "Transition",
  "Território": "Territory",
  Empresas: "Companies",
  "Leilões": "Auctions",
  "Regulação": "Regulation",
  Dados: "Data",
  Metodologia: "Methodology",
  "Visão geral": "Overview",
  "Página inicial": "Home page",
  "PLD e previsões": "PLD and forecasts",
  "PLD (formação)": "PLD (formation)",
  "Água e clima: afluência": "Water and climate: inflow",
  Aprenda: "Learn",
  "Dados e metodologia": "Data and methodology",
  "Previsões e modelos": "Forecasts and models",
  "Qualidade do serviço": "Quality of supply",
  "Minha região": "My region",
};

/** Tipo de ato da linha do tempo (campo tipo_ato). */
export const TIPO_ATO_EN: Record<string, string> = {
  "Resolução Normativa": "Normative resolution",
  "Resolução Homologatória": "Ratifying resolution",
  "Resolução Autorizativa": "Authorizing resolution",
  "Resolução": "Resolution",
  Despacho: "Order",
  "Medida Provisória": "Provisional measure",
  Portaria: "Ordinance",
  "Registro mensal de acionamento": "Monthly activation record",
  Lei: "Law",
  "Lei Complementar": "Complementary law",
  Decreto: "Decree",
};

/** Órgão emissor (campo orgao); siglas ficam. */
export const ORGAO_EN: Record<string, string> = {
  ANEEL: "ANEEL",
  MME: "MME",
  CREG: "CREG",
  CCEE: "CCEE",
  ONS: "ONS",
  EPE: "EPE",
  "Presidência da República": "Presidency of the Republic",
  "Congresso Nacional": "National Congress",
};

/** Modalidade da consulta. */
export const MODALIDADE_EN: Record<string, string> = {
  "Consulta Pública": "Public consultation",
  "Audiência Pública": "Public hearing",
};

/** Fase da consulta (campo fase_atual). */
export const FASE_EN: Record<string, string> = {
  abertura: "opening",
  "2ª fase": "2nd phase",
  "3ª fase": "3rd phase",
  "4ª fase": "4th phase",
};

/** Patamar das bandeiras tarifárias. */
export const PATAMAR_EN: Record<string, string> = {
  Verde: "Green",
  Amarela: "Yellow",
  "Vermelha P1": "Red P1",
  "Vermelha P2": "Red P2",
  "Escassez Hídrica": "Water Scarcity",
};

/** Rótulos dos arquivos para baixar publicados pela gold da Regulação. */
export const DOWNLOADS_REGULACAO_EN: Record<string, string> = {
  "Atos de limites do PLD": "PLD limit acts",
  "Limites vigentes por período": "Limits in force by period",
  "Conferências dos limites": "Checks of the limits",
  "Adicionais das bandeiras": "Tariff flag surcharges",
  "Procedimentos vigentes (PRODIST e PRORET)": "Procedures in force (PRODIST and PRORET)",
  "Linha do tempo": "Timeline",
  "Consultas e audiências públicas (histórico)": "Public consultations and hearings (history)",
  "Agenda Regulatória 2026-2027": "Regulatory agenda 2026-2027",
};

/**
 * Valor da gold no idioma da página: em português, o próprio valor; em inglês, a forma da tabela ou,
 * sem entrada, o valor português (quem mostra na tela marca com <TrechoPortugues>; ver traduzido()).
 */
export function rotuloDado(tabela: Record<string, string>, valor: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return valor;
  return tabela[valor] ?? valor;
}

/** Se o valor tem forma inglesa na tabela (em português, sempre verdadeiro). */
export function traduzido(tabela: Record<string, string>, valor: string, idioma: Idioma = idiomaEnergia()): boolean {
  return idioma !== "en" || valor in tabela;
}

/** Frequência de atualização declarada pela fonte (campo frequencia_declarada, com a primeira letra em maiúscula). */
export const FREQUENCIA_EN: Record<string, string> = {
  Mensal: "Monthly",
  "Diariamento, as 12h e 19h": "Daily, at 12h and 19h",
  Anual: "Annual",
  "Única": "One-off",
  Trimestral: "Quarterly",
  "Diária": "Daily",
  Semanal: "Weekly",
  Quinzenal: "Fortnightly",
  "Não aplicável": "Not applicable",
  "Mensal e diária": "Monthly and daily",
  "Diariamente, 9:15h, 14:15 e 17h": "Daily, 9:15h, 14:15 and 17h",
  "Conforme calendário dos processos de revisão tarifária das distribuidoras de energia elétrica": "According to the schedule of the distribution utilities' tariff review processes",
  "Conforme envios dos agentes": "As agents submit",
  "Sem atualização": "No updates",
  "Semanalmente - Ordinário, Quando houver atualização - Regularização": "Weekly (ordinary); when there is an update (regularization)",
  "A depender da ocorrência.": "Depending on occurrence.",
  "Quando houver nova deliberação": "When there is a new decision",
  "Periódica": "Periodic",
  "A depender do surgimento de novos termos.": "Depending on new terms appearing.",
  "Quando houver atualização": "When there is an update",
  "Diariamente de 15 em 15 min": "Daily, every 15 min",
  "Sob demanda": "On demand",
};

/** Licença declarada (campo licenca do catálogo e dos portais). Licença com nota de coleta longa fica sem entrada: sai marcada em português. */
export const LICENCA_EN: Record<string, string> = {
  "Licença Aberta para Bases de Dados (ODbL) do Open Data Commons": "Open Data Commons Open Database License (ODbL)",
  "Creative Commons Attribution": "Creative Commons Attribution",
  "Creative Commons Attribution 4.0": "Creative Commons Attribution 4.0",
  "Creative Commons Atribuição": "Creative Commons Attribution",
  "Open Data Commons Open Database License (ODbL)": "Open Data Commons Open Database License (ODbL)",
  "Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), conforme o rodapé do portal da EPE": "Creative Commons Attribution 4.0 International (CC BY 4.0), according to the footer of the EPE portal",
  "Licença Aberta para Bases de Dados (ODbL) do Open Data Commons, conforme o portal de dados abertos da CVM": "Open Data Commons Open Database License (ODbL), according to the CVM open data portal",
  "Creative Commons Attribution 4.0 (CC-BY-4.0), conforme o portal de dados abertos da CCEE": "Creative Commons Attribution 4.0 (CC-BY-4.0), according to the CCEE open data portal",
  "Dados públicos do IBGE, uso livre com citação da fonte (política de dados abertos do IBGE)": "Public IBGE data, free use with source citation (IBGE open data policy)",
  "Uso livre com citação da fonte (IBGE)": "Free use with source citation (IBGE)",
  "Uso livre com citação da fonte (IBGE).": "Free use with source citation (IBGE).",
  "Creative Commons Atribuição (CC-BY), conforme o portal de dados abertos do ONS": "Creative Commons Attribution (CC-BY), according to the ONS open data portal",
  "Open Data Commons Open Database License (ODbL), conforme o portal de dados abertos da ANEEL": "Open Data Commons Open Database License (ODbL), according to the ANEEL open data portal",
  "Conteúdo de portal do Governo Federal (gov.br), uso livre com citação da fonte": "Federal Government portal content (gov.br), free use with source citation",
  "Ato oficial publicado no Diário Oficial da União; texto normativo de domínio público (Lei nº 9.610/1998, art. 8º, IV)":
    "Official act published in the Official Gazette of the Union; normative text in the public domain (Lei nº 9.610/1998, art. 8º, IV)",
  "Ato normativo da ANEEL: texto oficial de domínio público (Lei nº 9.610/1998, art. 8º, IV)": "ANEEL normative act: official text in the public domain (Lei nº 9.610/1998, art. 8º, IV)",
  "Ato normativo federal: texto oficial de domínio público (Lei nº 9.610/1998, art. 8º, IV)": "Federal normative act: official text in the public domain (Lei nº 9.610/1998, art. 8º, IV)",
  "Publicação da CCEE; números reproduzidos com atribuição, apenas para conferência": "CCEE publication; numbers reproduced with attribution, for cross-checking only",
  "Outra (Aberta), conforme o campo de licença do portal de dados abertos do MME": "Other (Open), according to the license field of the MME open data portal",
  "Creative Commons Atribuição (CC-BY), conforme o portal de dados abertos do ONS; documento do acervo digital do ONS":
    "Creative Commons Attribution (CC-BY), according to the ONS open data portal; document from the ONS digital collection",
  "Texto normativo de domínio público (Lei nº 9.610/1998, art. 8º, IV), no portal de Legislação Federal do Senado":
    "Normative text in the public domain (Lei nº 9.610/1998, art. 8º, IV), on the Senate's Federal Legislation portal",
  "Texto normativo e metadados de legislação federal: domínio público (Lei nº 9.610/1998, art. 8º, IV), portal de Legislação Federal do Senado":
    "Normative text and federal legislation metadata: public domain (Lei nº 9.610/1998, art. 8º, IV), Senate's Federal Legislation portal",
  "Conteúdo público do portal gov.br da ANEEL; reprodução com citação da fonte (política de uso do portal gov.br)":
    "Public content of ANEEL's gov.br portal; reproduction with source citation (gov.br portal usage policy)",
  "Dados públicos da EPE (WebMap EPE), uso com citação da fonte; direitos da camada: EPE, ONS e IBGE": "Public EPE data (WebMap EPE), use with source citation; layer rights: EPE, ONS and IBGE",
  "Dados públicos do IBGE (API de localidades), uso livre com citação da fonte (termos de uso do servicodados.ibge.gov.br)":
    "Public IBGE data (localities API), free use with source citation (servicodados.ibge.gov.br terms of use)",
  "Dados públicos do IBGE; reprodução permitida com citação da fonte (IBGE, Sistema IBGE de Recuperação Automática, SIDRA)":
    "Public IBGE data; reproduction allowed with source citation (IBGE, IBGE Automatic Retrieval System, SIDRA)",
};
