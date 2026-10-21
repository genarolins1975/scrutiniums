/**
 * Leitura da gold de emissões do Território e Clima (public/territorio/gold/emissoes.json),
 * gerada por pipeline/territorio/run.py a partir do inventário oficial do MCTI (SIRENE).
 * kt de CO2 equivalente pela métrica GWP AR5 (100 anos); a gold traz também a variação
 * desde 2005, ano de referência da NDC, e a participação de cada setor no último ano.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const SETORES = ["energia", "ippu", "agropecuaria", "lulucf", "residuos"] as const;
export type Setor = (typeof SETORES)[number];

export const NOME_SETOR: Record<Setor, string> = {
  energia: "Energia",
  ippu: "Processos industriais",
  agropecuaria: "Agropecuária",
  lulucf: "Uso da terra e florestas",
  residuos: "Resíduos",
};

export const EXPLICA_SETOR: Record<Setor, string> = {
  energia: "Queima de combustíveis em transportes, indústria, geração de eletricidade e residências, e vazamentos na produção de petróleo, gás e carvão.",
  ippu: "Gases liberados por processos químicos da indústria, como cimento, aço e alumínio, e gases usados em refrigeração.",
  agropecuaria: "Metano da digestão do gado, adubação e manejo do solo, dejetos animais e cultivo de arroz.",
  lulucf: "Saldo entre o que se emite ao desmatar e converter vegetação e o que florestas e vegetação em crescimento retiram da atmosfera.",
  residuos: "Lixo em aterros e lixões, tratamento de esgoto e incineração.",
};

export type GoldEmissoes = {
  fonte: { nome: string; titulo: string; pagina: string; relatorio: string; licenca: string; natureza: string };
  capturadoEm: string;
  originais: { setor: string; url: string; sha256: string; bytes: number }[];
  edicao: string;
  unidade: string;
  metrica: string;
  anoInicial: number;
  anoFinal: number;
  anos: { ano: number; totalLiquido: number; totalSemLulucf: number; setores: Record<Setor, number> }[];
  metricasAlternativas: Record<string, { nome: string; totalLiquido: Record<string, number> }>;
  subsetores: { setor: Setor; codigo: string; nome: string; valores: Record<string, number | null> }[];
  gases: { unidade: string; series: { gas: string; total: Record<string, number> }[] };
  ressalvas: string[];
  derivados: {
    anoReferenciaNdc: number;
    variacaoDesde2005Pct: Record<"totalLiquido" | "totalSemLulucf" | Setor, number>;
    participacaoUltimoAnoPct: Record<Setor, number>;
  };
};

let cache: GoldEmissoes | null = null;

export function lerEmissoes(): GoldEmissoes {
  cache ??= JSON.parse(readFileSync(join(process.cwd(), "public", "territorio", "gold", "emissoes.json"), "utf-8")) as GoldEmissoes;
  return cache;
}

/** kt → Mt, com uma casa. */
export function mt(kt: number): number {
  return kt / 1000;
}
