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
  gases: {
    unidade: string;
    /** Desvio máximo, por setor, entre a soma das abas por gás convertidas pelo GWP AR5 e o CO2e publicado (fração). */
    conferenciaDesvioMaximoPorSetor: Record<Setor, number>;
    series: {
      gas: string;
      /** "kt do gás": massa do próprio gás, não CO2e. */
      unidade: string;
      gwpAr5: number;
      porSetor: Partial<Record<Setor, Record<string, number | null>>>;
      /** Massa do gás no país, kt do gás. */
      total: Record<string, number>;
      /** Massa × GWP AR5, kt CO2e: conversão da plataforma, a fonte não publica CO2e por gás. */
      totalCo2eAr5Derivado: Record<string, number>;
    }[];
  };
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

/** Os três gases que o leitor reconhece; os demais (HFCs, PFCs e SF6) entram juntos como "gases fluorados". */
export const GASES_PRINCIPAIS = ["CO2", "CH4", "N2O"] as const;
export type GasPrincipal = (typeof GASES_PRINCIPAIS)[number];

export const NOME_GAS: Record<GasPrincipal, string> = {
  CO2: "Gás carbônico (CO2)",
  CH4: "Metano (CH4)",
  N2O: "Óxido nitroso (N2O)",
};

export type AnoBalanca = {
  ano: number;
  /** Soma das categorias do inventário com saldo acima de zero no ano, kt CO2e, aberta por setor. */
  positivo: number;
  positivoPorSetor: Record<Setor, number>;
  /** Soma das categorias com saldo abaixo de zero no ano (número negativo), kt CO2e. */
  negativo: number;
  /** As categorias com saldo negativo no ano, da maior remoção líquida para a menor. */
  categoriasNegativas: { codigo: string; nome: string; valor: number }[];
  /** Positivo mais negativo: o total líquido publicado. */
  liquido: number;
  /** Categorias sem valor publicado no ano (não entram em nenhum dos lados; nunca viram zero). */
  semValor: number;
};

/**
 * A balança do carbono de cada ano, montada das categorias de primeiro nível do IPCC que a gold traz (34 categorias, que somam o
 * total líquido). A fonte publica o uso da terra só como saldo por categoria: o lado negativo é a soma das categorias cujo saldo
 * ficou abaixo de zero, não a remoção bruta; o positivo é a soma das categorias com saldo acima de zero, não a emissão bruta.
 */
export function balancaPorAno(g: GoldEmissoes): AnoBalanca[] {
  return g.anos.map((a) => {
    const chave = String(a.ano);
    const positivoPorSetor = Object.fromEntries(SETORES.map((s) => [s, 0])) as Record<Setor, number>;
    let positivo = 0;
    let negativo = 0;
    let semValor = 0;
    const categoriasNegativas: AnoBalanca["categoriasNegativas"] = [];
    for (const c of g.subsetores) {
      const v = c.valores[chave];
      if (v === null || v === undefined) {
        semValor++;
        continue;
      }
      if (v > 0) {
        positivo += v;
        positivoPorSetor[c.setor] += v;
      } else if (v < 0) {
        negativo += v;
        categoriasNegativas.push({ codigo: c.codigo, nome: c.nome, valor: v });
      }
    }
    categoriasNegativas.sort((x, y) => x.valor - y.valor);
    return { ano: a.ano, positivo, positivoPorSetor, negativo, categoriasNegativas, liquido: positivo + negativo, semValor };
  });
}

/** Série de um gás pelo nome na gold (undefined quando a captura não trouxe o gás: ausência, nunca zero). */
export function serieGas(g: GoldEmissoes, gas: string) {
  return g.gases.series.find((s) => s.gas === gas);
}
