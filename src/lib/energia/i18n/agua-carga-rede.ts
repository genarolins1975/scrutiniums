import { dataBR, nomeMes } from "@/lib/energia/formato";
import type { Idioma } from "@/lib/idioma";

/**
 * Tabelas de tradução dos rótulos que chegam da gold nos módulos Água e clima, Carga e Rede (valores
 * fixos de categoria, gravados em português pelo pipeline). A chave é o texto exato da gold; o valor,
 * a forma inglesa. Valor sem entrada sai como veio (o componente decide se marca como trecho em
 * português). Não altera a gold nem o pipeline.
 */

/** Rótulo de categoria no idioma: em português o valor da gold; em inglês a entrada da tabela, ou o valor da gold se faltar. */
export function rotuloDaGold(tabela: Readonly<Record<string, string>>, valor: string, idioma: Idioma): string {
  return idioma === "en" ? (tabela[valor] ?? valor) : valor;
}

/** O valor tem forma inglesa na tabela (para decidir se a célula leva a marca de trecho em português). */
export function temTraducao(tabela: Readonly<Record<string, string>>, valor: string): boolean {
  return Object.prototype.hasOwnProperty.call(tabela, valor);
}

/** Forma inglesa das mensagens de cópia de MENSAGEM_COPIA (evidencia.ts), usada pelos links de painel destes módulos. */
export const MENSAGEM_COPIA_EN: Readonly<Record<"copiado" | "selecionado" | "falhou", string>> = {
  copiado: "Copied to the clipboard.",
  selecionado: "Text selected: use Ctrl+C (or Copy, in the menu) to copy.",
  falhou: "Could not copy: select the text in the block and copy it.",
};

/* ---------- Carga ---------- */

/** Rótulo das janelas de comparação da carga (carga_detalhe.p025.comparacoes.janelas[].rotulo). */
export const JANELA_CARGA_EN: Readonly<Record<string, string>> = {
  "últimos 7 dias": "last 7 days",
  "últimos 28 dias (4 semanas)": "last 28 days (4 weeks)",
  "mês corrente até o último dia": "current month up to the latest day",
  "último mês completo": "last complete month",
  "últimas 52 semanas": "last 52 weeks",
};

/**
 * O que cada regime do ONS acrescentou à carga, como a página o extrai da descrição publicada (carga_detalhe.regimes[].descricao,
 * primeira frase sem "Inclui").
 */
export const ACRESCIMO_REGIME_EN: Readonly<Record<string, string>> = {
  "a previsão de geração de usinas não despachadas pelo ONS": "the generation forecast of plants not dispatched by ONS",
  "a estimativa da micro e minigeração distribuída (MMGD), com base em dados meteorológicos previstos":
    "the estimate of distributed micro and mini generation (MMGD), based on forecast weather data",
};

/* ---------- Água e clima ---------- */

/** Abrangência de uma revisão da MLT (agua_detalhe.armazenamento.mlt.revisoes_no_mes[].abrangencia). */
export const ABRANGENCIA_EN: Readonly<Record<string, string>> = { ampla: "broad", pontual: "isolated" };

/** Captura usada em cada ano (reconciliacao_ear.captura_por_ano[].fonte, afluencia.captura_por_ano[].fonte). */
export const FONTE_CAPTURA_EN: Readonly<Record<string, string>> = {
  "silver principal": "main silver capture",
  "recaptura do módulo": "module recapture",
};

/** Precisão da fonte na reconciliação por reservatório (reservatorios_por_ano[].precisao). */
export const PRECISAO_EN: Readonly<Record<string, string>> = { inteiro: "whole numbers", "3 casas": "3 decimal places" };

/** Motivo da ausência de balanço por reservatório, contado na gold (reservatorios.sem_balanco_por_motivo, chaves). */
export const MOTIVO_SEM_BALANCO_EN: Readonly<Record<string, string>> = {
  "sem correspondência no cadastro": "no match in the ONS register",
  "sem volume útil no cadastro": "no useful volume in the register",
  "sem volume útil em percentual nos dados hidráulicos": "no useful volume in percent in the hydraulic data",
  "dia sem vazão ou volume na janela": "day without flow or volume in the window",
};

/** Critério do fechamento por construção (reservatorios.criterio_fecham_por_construcao). */
export const CRITERIO_FECHAMENTO_EN: Readonly<Record<string, string>> = {
  "ao menos 95% dos dias da série diária disponível com |resíduo| dentro do arredondamento":
    "at least 95% of the days of the available daily series with |residual| within rounding",
};

/** Variantes do modelo de clima e calendário (carga_detalhe.p027.sensibilidade[].rotulo). */
export const VARIANTE_MODELO_EN: Readonly<Record<string, string>> = {
  "Principal: temperatura média com dobras e defasagem, calendário completo": "Main: average temperature with breakpoints and lag, full calendar",
  "Só feriados por lei (sem Carnaval, Cinzas, Corpus Christi, pontes e fim de ano)":
    "Statutory holidays only (without Carnival, Ash Wednesday, Corpus Christi, bridge days and year-end)",
  "Sem temperatura (só calendário, sazonalidade e tendência)": "No temperature (calendar, seasonality and trend only)",
  "Temperatura média só linear (sem dobras nem defasagem)": "Average temperature, linear only (no breakpoints or lag)",
  "Temperatura máxima em vez da média": "Maximum temperature instead of the average",
};

/**
 * Rótulo da variante no idioma. A variante de janela longa traz as datas da gold no texto ("Treino desde dd/mm/aaaa com
 * degrau no regime de dd/mm/aaaa"): as datas são lidas do próprio rótulo, nunca do código.
 */
export function rotuloVarianteModelo(rotulo: string, idioma: Idioma): string {
  if (idioma !== "en") return rotulo;
  const m = /^Treino desde (\d{2})\/(\d{2})\/(\d{4}) com degrau no regime de (\d{2})\/(\d{2})\/(\d{4})$/.exec(rotulo);
  if (m) return `Training since ${dataBR(`${m[3]}-${m[2]}-${m[1]}`, "en")} with a regime step on ${dataBR(`${m[6]}-${m[5]}-${m[4]}`, "en")}`;
  return VARIANTE_MODELO_EN[rotulo] ?? rotulo;
}

/** Base do intervalo de previsão por origem (carga_detalhe.p027.por_origem_sin[].fonte_intervalo). */
export const FONTE_INTERVALO_EN: Readonly<Record<string, string>> = {
  "erros fora da amostra de origens anteriores": "out-of-sample errors from earlier origins",
  "resíduos do treino": "training residuals",
};

/**
 * Rótulos dos downloads publicados na gold (downloads[].rotulo de agua_detalhe, hidrologia, carga, carga_detalhe, rede e
 * rede_detalhe). A chave troca cada número por "#": anos e contagens de dias vêm do rótulo da gold e voltam no mesmo lugar.
 */
export const DOWNLOAD_EN: Readonly<Record<string, string>> = {
  // Carga
  "Carga diária por subsistema e SIN (CSV)": "Daily load by subsystem and SIN (CSV)",
  "Comparações de carga equivalentes (CSV)": "Equivalent load comparisons (CSV)",
  "Revisões da carga diária (CSV)": "Daily load revisions (CSV)",
  "Curva de carga horária desde # (CSV)": "Hourly load curve since # (CSV)",
  "Pico diário desde # (CSV)": "Daily peak since # (CSV)",
  "Perfil horário típico por mês (CSV)": "Typical hourly profile by month (CSV)",
  "Carga verificada, MMGD e carga líquida por dia (CSV)": "Verified load, MMGD and net load by day (CSV)",
  "Carga verificada, MMGD e carga líquida por hora desde # (CSV)": "Verified load, MMGD and net load by hour since # (CSV)",
  "Decomposição estatística diária (CSV)": "Daily statistical breakdown (CSV)",
  "Backtest por origem e variante (CSV)": "Backtest by origin and variant (CSV)",
  "Temperatura ponderada por subsistema (CSV)": "Weighted temperature by subsystem (CSV)",
  "Calendário oficial de feriados (CSV)": "Official holiday calendar (CSV)",
  // Água e clima
  "Temperatura diária por subsistema e SIN (CSV)": "Daily temperature by subsystem and SIN (CSV)",
  "Temperatura diária por UF, desde # (CSV)": "Daily temperature by state, since # (CSV)",
  "Precipitação diária por bacia, desde # (CSV)": "Daily rainfall by basin, since # (CSV)",
  "Precipitação mensal por bacia e climatologia (CSV)": "Monthly rainfall by basin and climatology (CSV)",
  "Previsão diária por bacia e por subsistema, rodada mais recente (CSV)": "Daily forecast by basin and by subsystem, latest run (CSV)",
  "Manifesto espacial dos pontos de clima (CSV)": "Spatial manifest of the climate points (CSV)",
  "EAR e ENA diárias por subsistema e SIN, desde #, com a captura usada (CSV)": "Daily EAR and ENA by subsystem and SIN, since #, with the capture used (CSV)",
  "EAR e ENA diárias por REE e por bacia, desde # (CSV)": "Daily EAR and ENA by REE and by basin, since # (CSV)",
  "EAR no fim do mês e ENA mensal por REE e por bacia, desde # (CSV)": "End-of-month EAR and monthly ENA by REE and by basin, since # (CSV)",
  "Mudanças da capacidade de armazenamento (CSV)": "Changes in storage capacity (CSV)",
  "Mudanças da MLT por usina (CSV)": "Changes in the MLT by plant (CSV)",
  "Balanço de # dias por reservatório (CSV)": "#-day balance by reservoir (CSV)",
  "Dados hidráulicos diários por reservatório, # dias (CSV)": "Daily hydraulic data by reservoir, # days (CSV)",
  "Séries diárias de # dias dos reservatórios da lista (JSON)": "#-day daily series of the listed reservoirs (JSON)",
  "Contornos das bacias do ONS, projetados e simplificados para o mapa (JSON)": "ONS basin outlines, projected and simplified for the map (JSON)",
  "EAR diária por subsistema e SIN (CSV)": "Daily EAR by subsystem and SIN (CSV)",
  "ENA diária por subsistema e SIN (CSV)": "Daily ENA by subsystem and SIN (CSV)",
  // Rede
  "Intercâmbio diário por fronteira (CSV)": "Daily interchange by boundary (CSV)",
  "Série horária # (CSV)": "Hourly series # (CSV)",
  "Fronteiras por dia (CSV)": "Boundaries by day (CSV)",
  "Subsistemas por dia (CSV)": "Subsystems by day (CSV)",
  "Balanço mensal (CSV)": "Monthly balance (CSV)",
  "Horas com resíduo no balanço (CSV)": "Hours with a residual in the balance (CSV)",
  "Exterior e Itaipu por mês (CSV)": "Exterior and Itaipu by month (CSV)",
  "Indicador ATLS (CSV)": "ATLS indicator (CSV)",
  "Interrupções de carga (CSV)": "Load interruptions (CSV)",
  "Programado e verificado por hora (CSV)": "Scheduled and verified by hour (CSV)",
  "Programado e verificado por dia (CSV)": "Scheduled and verified by day (CSV)",
  "Conferência do programa com o PDO (CSV)": "Check of the schedule against the PDO (CSV)",
};

/** Rótulo de download no idioma; sem entrada na tabela, sai o rótulo da gold. */
export function rotuloDownload(rotulo: string, idioma: Idioma): string {
  if (idioma !== "en") return rotulo;
  const numeros = rotulo.match(/\d+/g) ?? [];
  const en = DOWNLOAD_EN[rotulo.replace(/\d+/g, "#")];
  if (!en) return rotulo;
  let i = 0;
  return en.replace(/#/g, () => numeros[i++] ?? "#");
}

/** Os mesmos downloads, com o rótulo no idioma. */
export function traduzDownloads<T extends { rotulo: string }>(downloads: readonly T[], idioma: Idioma): T[] {
  return downloads.map((d) => ({ ...d, rotulo: rotuloDownload(d.rotulo, idioma) }));
}

/** Nome das séries da carga verificada (proveniencia.api.natureza_por_serie[].rotulo, sem o campo da fonte). */
export const SERIE_API_CARGA_EN: Readonly<Record<string, string>> = {
  MMGD: "MMGD",
  "Carga global líquida de MMGD": "Global load net of MMGD",
  "Carga global": "Global load",
};

/** Componentes das séries da carga verificada (proveniencia.api.natureza_por_serie[].componentes[].descricao). */
export const COMPONENTE_API_CARGA_EN: Readonly<Record<string, string>> = {
  "MMGD estimada pelo ONS, somada à carga líquida observada": "MMGD estimated by ONS, added to the observed net load",
};

/** Categorias do calendário da carga (carga_detalhe.calendario.categorias); o nome do feriado fica em português (nome próprio). */
export const CATEGORIA_CALENDARIO_EN: Readonly<Record<string, string>> = {
  "feriado por lei federal": "holiday under federal law",
  "Sexta-feira da Paixão (Lei nº 9.093/1995; ementa conferida, texto não relido)": "Good Friday (Law No. 9,093/1995; summary checked, text not reread)",
  "ponto facultativo federal (portaria anual), não feriado": "federal optional day off (annual ordinance), not a holiday",
};

/** Definições conferidas dos fluxos do indicador ATLS (rede_detalhe.restricoes.atls.fluxos[].definicao). */
export const DEFINICAO_FLUXO_EN: Readonly<Record<string, string>> = {
  "Fluxo da Interligação Nordeste-Sudeste/Centro-Oeste": "Northeast-Southeast/Center-West interconnection flow",
  "Fluxo sentido Norte-Sul": "North-to-South flow",
  "Geração de Itaipu": "Itaipu generation",
  "Interligação Nordeste-Norte": "Northeast-North interconnection",
  "Recebimento da Região Nordeste": "Intake by the Northeast region",
  "Recebimento pela Região Sul": "Intake by the South region",
  "Recebimento pelo Sudeste": "Intake by the Southeast",
};

/** Unidade publicada do ATLS (rede_detalhe.restricoes.atls.unidade_publicada). */
export const UNIDADE_ATLS_EN: Readonly<Record<string, string>> = {
  "fração de 0 a 1 (o dicionário diz %)": "fraction from 0 to 1 (the data dictionary says %)",
};

/** Tipo de regra da validação física da carga (carga_detalhe.p025.validacao.regras[].tipo). */
export const TIPO_REGRA_CARGA_EN: Readonly<Record<string, string>> = {
  dominio: "domain",
  faixa_plausivel: "plausible range",
  salto: "jump",
  conferencia: "cross-check",
  registros_esperados: "expected records",
};

/* ---------- Água e clima (segunda rodada) ---------- */

/** Modelo da previsão do tempo, como a gold o descreve (agua_detalhe.clima.previsao.modelo). */
export const MODELO_PREVISAO_EN: Readonly<Record<string, string>> = {
  "ECMWF IFS 0,25° (dados abertos do ECMWF), rodada de 00Z pela API de rodadas individuais do Open-Meteo":
    "ECMWF IFS 0.25° (ECMWF open data), 00Z run through the Open-Meteo single-runs API",
};

/** Descrição do modelo da previsão no idioma; sem entrada na tabela, a da gold. */
export function modeloPrevisao(modelo: string, idioma: Idioma): string {
  return rotuloDaGold(MODELO_PREVISAO_EN, modelo, idioma);
}

/* ---------- Rede e Carga (segunda rodada) ---------- */

/** Mês por extenso em português ("janeiro") → número do mês; null se não for mês. */
function numeroDoMes(nome: string): number | null {
  for (let m = 1; m <= 12; m++) if (nomeMes(m, "pt", true) === nome.toLowerCase()) return m;
  return null;
}

/**
 * Amostra da conferência do programa do exterior com o PDO (rede_detalhe.programado.versao_programa.conferencia_pdo.amostra), como o
 * pipeline a escreve: "últimos N dias publicados e dias A e B de cada mês desde <mês> de <ano>". Os números saem da própria gold.
 */
export function amostraPdo(amostra: string, idioma: Idioma): string {
  if (idioma !== "en") return amostra;
  const m = /^últimos (\d+) dias publicados e dias (\d+) e (\d+) de cada mês desde ([a-zç]+) de (\d{4})$/.exec(amostra);
  const mes = m ? numeroDoMes(m[4]) : null;
  if (!m || !mes) return amostra;
  return `last ${m[1]} published days and days ${m[2]} and ${m[3]} of each month since ${nomeMes(mes, "en", true)} ${m[5]}`;
}

/**
 * Motivo de a temperatura da janela da carga ter menos dias (carga_detalhe.a07.janela_modelo.motivo), como o pipeline o escreve:
 * "a temperatura de dd/mm/aaaa ainda não estava publicada pela NASA POWER na última captura". null sem forma inglesa conferida.
 */
export function motivoJanelaTemperatura(motivo: string, idioma: Idioma): string | null {
  if (idioma !== "en") return motivo;
  const m = /^a temperatura de (\d{2})\/(\d{2})\/(\d{4}) ainda não estava publicada pela NASA POWER na última captura$/.exec(motivo);
  return m ? `the temperature for ${dataBR(`${m[3]}-${m[2]}-${m[1]}`, "en")} had not yet been published by NASA POWER at the latest capture` : null;
}

/** Nomes de publicações e conjuntos do ONS citados em frases montadas em src/lib/energia: na página inglesa, marcados em <Nome>. */
export const NOME_RELATORIO_PMO = "Relatório Executivo do PMO"; // i18n: dado (nome próprio, marcado em <Nome>)
export const NOME_CARGA_DIARIA = "Carga de Energia Diária"; // i18n: dado (nome próprio, marcado em <Nome>)
