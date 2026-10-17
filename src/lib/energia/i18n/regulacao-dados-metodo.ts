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
