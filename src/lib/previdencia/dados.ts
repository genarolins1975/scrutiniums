/**
 * Leitura da gold do painel Previdência e INSS, somente no servidor (public/previdencia/gold). Nada aqui inventa
 * número: tudo vem da gold (pipeline/previdencia/gold.py). Este módulo só escolhe o recorte que cada página manda ao
 * navegador: a versão aperitivo recebe os poucos valores do município pedido; o painel completo, o município, a UF e a
 * comparação. O arquivo de cada UF é lido só quando um município dela é pedido.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAMPOS_Q, CAMPOS_V, type ArquivoUf, type CampoQ, type CampoV, type GoldPrevidencia, type IdTipo, type MunicipioGold, type TipoMes } from "./tipos";

export const ARQUIVO_GOLD = join("public", "previdencia", "gold", "previdencia.json");
export const PASTA_UF = join("public", "previdencia", "gold", "municipios");

/** UF pelo prefixo de dois dígitos do código IBGE do município (tabela do IBGE). */
export const UF_DO_PREFIXO: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

let cache: GoldPrevidencia | null = null;
const cacheUf = new Map<string, ArquivoUf | null>();

export function goldPrevidencia(): GoldPrevidencia {
  cache ??= JSON.parse(readFileSync(join(process.cwd(), ARQUIVO_GOLD), "utf-8")) as GoldPrevidencia;
  return cache;
}

export function arquivoUf(uf: string): ArquivoUf | null {
  if (!Object.values(UF_DO_PREFIXO).includes(uf)) return null;
  if (!cacheUf.has(uf)) {
    try {
      cacheUf.set(uf, JSON.parse(readFileSync(join(process.cwd(), PASTA_UF, `${uf}.json`), "utf-8")) as ArquivoUf);
    } catch {
      cacheUf.set(uf, null);
    }
  }
  return cacheUf.get(uf) ?? null;
}

export type GruposAno = { q: Record<CampoQ, number>; v: Record<CampoV, number> };

/** As listas da gold de um ano viram registros com nome de campo; null quando o ano não existe para a entidade. */
export function grupos(q: number[] | null | undefined, v: number[] | null | undefined): GruposAno | null {
  if (!q || !v) return null;
  return {
    q: Object.fromEntries(CAMPOS_Q.map((c, i) => [c, q[i]])) as Record<CampoQ, number>,
    v: Object.fromEntries(CAMPOS_V.map((c, i) => [c, v[i]])) as Record<CampoV, number>,
  };
}

export const ultimoAno = (g: GoldPrevidencia = goldPrevidencia()) => g.anual.anos[g.anual.anos.length - 1];

/** Brasil no último dezembro do arquivo municipal (o mesmo universo da consulta por município). */
export function brasilDezembro(g: GoldPrevidencia = goldPrevidencia()) {
  const ano = ultimoAno(g);
  const b = g.anual.brasil[String(ano)];
  return { ano, municipios: b.municipios, ...(grupos(b.q, b.v) as GruposAno) };
}

export type ConsultaMunicipio =
  | { estado: "vazia" }
  | { estado: "invalida"; codigo: string | null }
  | { estado: "ok"; m: MunicipioGold; uf: string; arquivo: ArquivoUf };

/** Só o código IBGE de sete dígitos de um município da gold; o resto é consulta inválida, nunca um palpite. */
export function consultarMunicipio(ibge: string | string[] | undefined): ConsultaMunicipio {
  const valor = (Array.isArray(ibge) ? ibge[0] : ibge)?.trim() ?? "";
  if (valor === "") return { estado: "vazia" };
  if (!/^\d{7}$/.test(valor)) return { estado: "invalida", codigo: null };
  const uf = UF_DO_PREFIXO[valor.slice(0, 2)];
  const arquivo = uf ? arquivoUf(uf) : null;
  const m = arquivo?.municipios.find((x) => x.id === valor);
  if (!uf || !arquivo || !m) return { estado: "invalida", codigo: valor };
  return { estado: "ok", m, uf, arquivo };
}

/** O município no último ano com dado (o mais recente da gold, ou null se ele não aparece nesse ano). */
export function municipioNoAno(m: MunicipioGold, i: number): GruposAno | null {
  return grupos(m.q[i], m.v[i]);
}

/** Tipos da tabela 15 por id. */
export function tiposPorId(g: GoldPrevidencia = goldPrevidencia()): Record<IdTipo, TipoMes> {
  return Object.fromEntries(g.brasil_mes.tipos.map((t) => [t.id, t])) as Record<IdTipo, TipoMes>;
}

/** Índice do último mês da série do BEPS e do mês mais recente sem a parcela do abono anual no valor. */
export function ultimoMesSerie(g: GoldPrevidencia = goldPrevidencia()) {
  const i = g.serie.meses.length - 1;
  return { i, mes: g.serie.meses[i] };
}

/** Os números de manchete do tema (KPIs do painel, "Para você" e camada aberta): um leitor só, sem divergência. */
export function manchete(g: GoldPrevidencia = goldPrevidencia()) {
  const t = tiposPorId(g);
  const r = g.rgps;
  const k = r.anos.length - 1;
  return {
    mes: g.brasil_mes.referencia,
    beneficios: t.total.q,
    rgps: { q: t.rgps.q, medio: t.rgps.medio },
    assistenciais: { q: t.assistenciais.q, medio: t.assistenciais.medio },
    ano: r.anos[k],
    arrecadacao: r.arrecadacao[k],
    despesa: r.beneficios[k],
    resultado: r.resultado[k],
    resultadoPib: r.pct_pib.resultado[k],
    cobertura: r.beneficios[k] ? (100 * r.arrecadacao[k]) / r.beneficios[k] : null,
  };
}

/** Os municípios com mais benefícios no país no último dezembro (painel completo, antes da escolha do leitor). */
export function maioresDoBrasil(n = 10, g: GoldPrevidencia = goldPrevidencia()): { id: string; nome: string; uf: string; q: number; medio: number | null }[] {
  const i = g.anual.anos.length - 1;
  return [...new Set(Object.values(UF_DO_PREFIXO))]
    .flatMap((uf) => {
      const a = arquivoUf(uf);
      return a ? rankingUf(a, i).map((m) => ({ ...m, uf })) : [];
    })
    .sort((a, b) => b.q - a.q || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, n);
}

/** Os municípios de uma UF no ano, ordenados pela quantidade de benefícios (para a comparação no painel completo). */
export function rankingUf(arquivo: ArquivoUf, i: number): { id: string; nome: string; q: number; medio: number | null }[] {
  return arquivo.municipios
    .flatMap((m) => {
      const q = m.q[i];
      const v = m.v[i];
      return q && v ? [{ id: m.id, nome: m.nome, q: q[0], medio: q[0] ? v[0] / q[0] : null }] : [];
    })
    .sort((a, b) => b.q - a.q || a.nome.localeCompare(b.nome, "pt-BR"));
}
