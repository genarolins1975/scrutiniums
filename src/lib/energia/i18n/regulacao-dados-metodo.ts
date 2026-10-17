import { createElement, Fragment, type ReactNode } from "react";
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "@/lib/energia/idioma";
import { dataBR } from "@/lib/energia/formato";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

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

/** Nomes próprios que as frases da lib citam por extenso (programas, bases oficiais): na página inglesa, marcados como nome. */
export const NOMES_CITADOS: readonly string[] = [
  "Tarifa Social", // i18n: dado
  "Luz para Todos",
  "Setor Elétrico", // i18n: dado
  // unidade como o dicionário do ONS a escreve, citada como termo da fonte
  "MWmês", // i18n: dado
];

/**
 * Identificador técnico no meio de uma frase (arquivo ou tabela com sublinhado, integração "modulo/conjunto", vintage
 * "conjunto@data", impressão digital hexadecimal): não é prosa, nem portuguesa nem inglesa.
 */
const IDENTIFICADOR_TECNICO =
  "(?<![\\p{L}\\p{N}_@/.:-])(?:[A-Za-z0-9][A-Za-z0-9.:@/-]*_[A-Za-z0-9_.:@/-]*|_[A-Za-z0-9][A-Za-z0-9_]*|(?=[0-9]*[a-f])[0-9a-f]{12,64})(?![\\p{L}\\p{N}_])";

const ESTILO_CODIGO = { fontFamily: "inherit", fontSize: "inherit" } as const;

/** Identificador técnico solto (nome de arquivo, slug, hash): na página inglesa em <code> com a fonte do texto; em português, o texto puro. */
export function codigo(texto: string, idioma: Idioma = idiomaEnergia()): ReactNode {
  if (idioma !== "en" || !texto) return texto;
  return createElement("code", { style: ESTILO_CODIGO, translate: "no" }, texto);
}

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Frase montada pela lib com nomes e identificadores dentro: em português, o texto como veio; em inglês, nomes de atos e os nomes
 * citados (NOMES_CITADOS e os de `nomes`) em <Nome>, identificadores técnicos em <code> e os `trechos` (texto da gold citado dentro
 * da frase inglesa, como o título de um evento) em <TrechoPortugues>. O texto não muda, só ganha as marcas.
 */
export function marcado(
  texto: string | null | undefined,
  nomes: readonly string[] = [],
  idioma: Idioma = idiomaEnergia(),
  trechos: readonly string[] = [],
  regiao = "frase-gold",
): ReactNode {
  if (!texto || idioma !== "en") return texto ?? "";
  const lista = [...nomes, ...NOMES_CITADOS].filter(Boolean).sort((a, b) => b.length - a.length);
  const achados: { i: number; f: number; tipo: "nome" | "codigo" | "trecho" }[] = [];
  for (const t of Array.from(new Set(trechos.filter(Boolean)))) {
    for (let i = texto.indexOf(t); i >= 0; i = texto.indexOf(t, i + t.length)) achados.push({ i, f: i + t.length, tipo: "trecho" });
  }
  const junta = (re: RegExp, tipo: "nome" | "codigo") => {
    for (const m of texto.matchAll(re)) {
      let t = m[0];
      if (tipo === "codigo") t = t.replace(/[.:,/-]+$/, "");
      if (t) achados.push({ i: m.index ?? 0, f: (m.index ?? 0) + t.length, tipo });
    }
  };
  junta(new RegExp(NOME_ATO.source, "g"), "nome");
  if (lista.length) junta(new RegExp(`(?<![\\p{L}\\p{N}])(?:${lista.map(escaparRegex).join("|")})(?![\\p{L}\\p{N}])`, "gu"), "nome");
  junta(new RegExp(IDENTIFICADOR_TECNICO, "gu"), "codigo");
  achados.sort((a, b) => a.i - b.i || b.f - a.f);
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const a of achados) {
    if (a.i < ultimo) continue;
    if (a.i > ultimo) partes.push(texto.slice(ultimo, a.i));
    const trecho = texto.slice(a.i, a.f);
    partes.push(
      a.tipo === "trecho"
        ? createElement(TrechoPortugues, { key: `t${a.i}`, regiao } as unknown as { children: ReactNode; regiao: string }, trecho)
        : a.tipo === "nome"
          ? createElement(Nome, { key: `n${a.i}` } as unknown as { children: ReactNode }, trecho)
          : createElement("code", { key: `c${a.i}`, style: ESTILO_CODIGO, translate: "no" }, trecho),
    );
    ultimo = a.f;
  }
  if (!partes.length) return texto;
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return createElement(Fragment, null, ...partes);
}

/**
 * Como o head inglês de uma ficha de conjunto identifica o conjunto: o nome oficial é português e o head não aceita marca de
 * nome, então vale o slug da ficha. Slug que contém palavra portuguesa solta ("ons-dados-hidrologicos-res") sai como o endereço
 * da ficha inglesa, que é identificador e não prosa.
 */
export function identificadorDaFicha(slug: string): string {
  return /(?:^|-)(?:dados|nao|sao)(?:-|$)/.test(slug) ? `/en/setor-eletrico/dados/${slug}` : slug;
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
  "Acesso e sistemas isolados": "Access and isolated systems",
  "Cobertura potencial": "Potential coverage",
  "Modelos de previsão do PLD": "PLD forecasting models",
  "PLD: CMO e formação de preço": "PLD: CMO and price formation",
  "PLD: entenda o preço": "PLD: understanding the price",
  "PLD: histórico e distribuição": "PLD: history and distribution",
  "PLD: histórico em moeda constante": "PLD: history in constant currency",
  "Peso no orçamento": "Weight in the budget",
  "Previsões do PLD": "PLD forecasts",
  "Rede: balanço e exterior": "Grid: balance and abroad",
  "Rede: circulação de energia": "Grid: energy flows",
  "Rede: programado e verificado": "Grid: scheduled and verified",
  "Rede: restrições publicadas": "Grid: published restrictions",
  // nome de programa: fica, e a página que o mostra o marca (marcado())
  "Tarifa Social": "Tarifa Social",
  "Água e clima: armazenamento": "Water and climate: storage",
  "Água e clima: chuva e temperatura": "Water and climate: rainfall and temperature",
  "Água e clima: reservatórios e balanço": "Water and climate: reservoirs and balance",
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
  "Diariamente de 15 em 15 min": "Daily, every 15 min (15-min steps)",
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

/**
 * Frases que o pipeline escreve na atualidade de cada integração (publicacao.json: causa do atraso e motivo de não haver prazo).
 * São poucos modelos fixos: a forma inglesa é a do modelo, com as partes variáveis (instante) copiadas. Frase fora dos modelos
 * volta como veio, em português (quem a mostra marca).
 */
const FRASES_ATUALIDADE_EN: readonly (readonly [RegExp, string])[] = [
  [/^A fonte não publicou período mais recente até a última coleta bem-sucedida \((.+)\)\.$/, "The source has not published a more recent period up to the latest successful collection ($1)."],
  [/^A fonte não publicou período mais recente\.$/, "The source has not published a more recent period."],
  [/^Conjunto descontinuado pela fonte: não há atualização a esperar\.$/, "Dataset discontinued by the source: there is no update to expect."],
  [/^A fonte não declara frequência de atualização em metadado legível\.$/, "The source does not declare an update frequency in readable metadata."],
  [
    /^Sem série regular de referência e sem data de publicação informada pela fonte: não há como medir atraso sem usar a data da captura\.$/,
    "No regular reference series and no publication date reported by the source: the delay cannot be measured without using the capture date.",
  ],
];

export function fraseDeAtualidade(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  const t = texto.trim();
  for (const [re, en] of FRASES_ATUALIDADE_EN) if (re.test(t)) return t.replace(re, en);
  return texto;
}

/** Se a frase da atualidade tem forma inglesa (em português, sempre verdadeiro). */
export function fraseDeAtualidadeTraduzida(texto: string, idioma: Idioma = idiomaEnergia()): boolean {
  return idioma !== "en" || FRASES_ATUALIDADE_EN.some(([re]) => re.test(texto.trim()));
}

/**
 * Detalhe que o validador automático escreve em cada checagem reprovada ou com ressalva (dados_validacoes.csv): poucos modelos
 * fixos, traduzidos pelo modelo com os números copiados. Detalhe fora dos modelos volta como veio.
 */
const DETALHES_VALIDADOR_EN: readonly (readonly [RegExp, string])[] = [
  [/^(\d+) linhas? idênticas? a outra$/, "$1 rows identical to another"],
  [/^(\d+) linhas? repetem a mesma chave com valores diferentes$/, "$1 rows repeat the same key with different values"],
  [/^(\d+) linhas? repetem a chave inferida com valores diferentes$/, "$1 rows repeat the inferred key with different values"],
  [/^(\d+) linhas? com número de colunas diferente do cabeçalho$/, "$1 rows with a number of columns different from the header"],
  [/^Colunas de tempo com valores além de (.+?): (\[.*\])$/, "Time columns with values beyond $1: $2"],
];

export function detalheDoValidador(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  return texto
    .split("; ")
    .map((p) => {
      for (const [re, en] of DETALHES_VALIDADOR_EN) if (re.test(p)) return p.replace(re, en);
      return p;
    })
    .join("; ");
}

/** Datas que o pipeline distingue (publicacao.json, regras.tempo): rótulo inglês de cada chave. */
export const REGRAS_TEMPO_EN: Record<string, string> = {
  periodo_referencia: "Reference period",
  publicado_pela_fonte_em: "Published by the source on",
  capturado_em: "Captured on",
  gerado_em: "Generated on",
  validado_em: "Validated on",
  vigencia: "Validity",
  versoes: "Versions",
};

/**
 * Versão da Agenda Regulatória como a gold a escreve ("Anexo I da Portaria ANEEL nº 7.030/2025 (versão aprovada em 02/12/2025)"): em
 * inglês, a mesma referência com o nome do ato e a data; fora do modelo, a forma inglesa genérica com o texto da gold só no português.
 */
export function versaoDaAgenda(versao: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return versao;
  const m = /^Anexo ([IVX]+) da (Portaria ANEEL nº [\d.]+\/\d{4}) \(versão aprovada em (\d{2})\/(\d{2})\/(\d{4})\)$/.exec(versao.trim());
  if (!m) return "regulatory agenda";
  return `Annex ${m[1]} to ${m[2]} (version approved on ${dataBR(`${m[5]}-${m[4]}-${m[3]}`, "en")})`;
}

/**
 * Como a gold registra a conferência da data de publicação de um ato (linha do tempo): dois modelos fixos, o dos metadados abertos do
 * Senado e o da data escrita no PDF do ato. Em inglês, o mesmo registro com as datas e os identificadores copiados; fora dos modelos,
 * o texto volta como veio.
 */
export function detalhePublicacao(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  const senado = /^metadados abertos do Senado \(sha256 (\w+)\): Publicação Original \[Diário Oficial da União( - Edição Extra)? de (\d{2})\/(\d{2})\/(\d{4})(?: - nº ([\w-]+))?\] \((p\. \d+, col\. \d+)\)$/.exec(texto);
  if (senado) {
    const [, sha, extra, d, m, a, n, pagina] = senado;
    return `Senate open metadata (sha256 ${sha}): original publication in the Official Gazette of the Union${extra ? `, extra edition${n ? ` no. ${n}` : ""}` : ""}, ${dataBR(`${a}-${m}-${d}`, "en")} (${pagina})`;
  }
  const ato = /^data '([\d./]+)' escrita no texto do ato \(sha256 (\w+)\)$/.exec(texto);
  if (ato) return `date '${ato[1]}' written in the text of the act (sha256 ${ato[2]})`;
  return texto;
}
