/**
 * Leitura da gold do painel Conectividade, somente no servidor (public/conectividade/gold). Nada aqui inventa número:
 * tudo vem da gold (pipeline/conectividade/gold.py). Este módulo escolhe o recorte que cada página manda ao navegador:
 * a versão aperitivo recebe os poucos valores do município pedido; o painel completo, o município, a UF e as
 * comparações. O arquivo de cada UF é lido só quando um município dela é pedido.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ArquivoUf, GoldConectividade, MedidaPosicao, MunicipioGold, Quantis, UfGold } from "./tipos";

export const ARQUIVO_GOLD = join("public", "conectividade", "gold", "conectividade.json");
export const PASTA_UF = join("public", "conectividade", "gold", "municipios");

/** UF pelo prefixo de dois dígitos do código IBGE do município (tabela do IBGE). */
export const UF_DO_PREFIXO: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

let cache: GoldConectividade | null = null;
const cacheUf = new Map<string, ArquivoUf | null>();

export function goldConectividade(): GoldConectividade {
  cache ??= JSON.parse(readFileSync(join(process.cwd(), ARQUIVO_GOLD), "utf-8")) as GoldConectividade;
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

export const ufGold = (uf: string, g: GoldConectividade = goldConectividade()): UfGold | null => g.ufs.find((u) => u.uf === uf) ?? null;

/** Parte dos moradores coberta por uma tecnologia, do município ou null. */
export const cobertos = (m: MunicipioGold, tec: "todas" | "g4" | "g5"): number | null => m.cobertura?.tecnologias[tec]?.[0] ?? null;

/** O valor de uma medida de posição, lido do mesmo lugar que o pipeline usou para ordenar. */
export function valorDaMedida(m: MunicipioGold, medida: MedidaPosicao): number | null {
  switch (medida) {
    case "fixa_densidade":
      return m.fixa?.densidade ?? null;
    case "fixa_fibra_pct":
      return m.fixa?.fibra_pct ?? null;
    case "fixa_vel_100_mais_pct":
      return m.fixa?.vel_100_mais_pct ?? null;
    case "movel_densidade":
      return m.movel?.densidade ?? null;
    case "movel_g5_pct":
      return m.movel?.g5_pct ?? null;
    case "cobertura_g4_moradores":
      return cobertos(m, "g4");
    case "cobertura_g5_moradores":
      return cobertos(m, "g5");
  }
}

/** Em que quarto da distribuição dos municípios o valor cai: "entre os 10% mais altos", "acima da metade", etc. */
export function faixaNaDistribuicao(v: number | null, q: Quantis): string | null {
  if (v === null || !q) return null;
  if (v >= q.p90) return "entre os 10% de municípios mais altos";
  if (v >= q.p75) return "no quarto mais alto dos municípios";
  if (v >= q.p50) return "acima da metade dos municípios";
  if (v >= q.p25) return "abaixo da metade dos municípios";
  if (v >= q.p10) return "no quarto mais baixo dos municípios";
  return "entre os 10% de municípios mais baixos";
}

/** Os maiores municípios da UF em acessos fixos (para a lista de partida quando nenhum foi escolhido). */
export function maioresDaUf(arquivo: ArquivoUf, n = 10): MunicipioGold[] {
  return [...arquivo.municipios].filter((m) => m.fixa).sort((a, b) => (b.fixa!.acessos ?? 0) - (a.fixa!.acessos ?? 0)).slice(0, n);
}

/** As UFs ordenadas por uma medida (maior primeiro), sem as que não têm o valor. */
export function ufsPor(g: GoldConectividade, valor: (u: UfGold) => number | null): { u: UfGold; v: number }[] {
  return g.ufs
    .map((u) => ({ u, v: valor(u) }))
    .filter((x): x is { u: UfGold; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v);
}

/** Série nacional por trimestre de uma tecnologia da cobertura, com o trimestre. */
export function serieCobertura(g: GoldConectividade, tec: "todas" | "g4" | "g5"): { t: string; v: number | null }[] {
  return g.brasil.cobertura.trimestres.map((t, i) => ({ t, v: g.brasil.cobertura.serie[tec]?.[i] ?? null }));
}

/** Dezembro de cada ano e o último mês da série mensal de acessos (para o gráfico anual, sem interpolar). */
export function pontosAnuais(serie: { meses: string[]; acessos: number[] }): { mes: string; acessos: number }[] {
  const out: { mes: string; acessos: number }[] = [];
  serie.meses.forEach((m, i) => {
    if (m.endsWith("-12") || i === serie.meses.length - 1) out.push({ mes: m, acessos: serie.acessos[i] });
  });
  return out;
}
