/**
 * Leitura da gold do painel Segurança pública (public/eficiencia/seguranca-publica/gold/seguranca.json), só no servidor.
 * Nenhum número do painel é escrito no código: contagens, taxas, posições, diferenças, variações, coberturas e datas
 * vêm prontos da gold (pipeline/seguranca/gold.py). Este módulo só escolhe o recorte que cada página mostra.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRASIL, type GoldSeguranca, type GrupoId, type Indicador, type SerieBrasil, type SeriePercentual, type SerieUF } from "./tipos";

export { BRASIL };

export const ARQUIVO_GOLD = join("public", "eficiencia", "seguranca-publica", "gold", "seguranca.json");
export const HREF_GOLD = "/eficiencia/seguranca-publica/gold/seguranca.json";
export const HREF_CSV = "/eficiencia/seguranca-publica/gold/taxas-por-uf.csv";
export const ROTA = "/eficiencia-estatal/seguranca-publica";

let cache: GoldSeguranca | null = null;

export function goldSeguranca(): GoldSeguranca {
  cache ??= JSON.parse(readFileSync(join(process.cwd(), ARQUIVO_GOLD), "utf-8")) as GoldSeguranca;
  return cache;
}

export function indicador(g: GoldSeguranca, id: string): Indicador {
  const i = g.indicadores.find((x) => x.id === id);
  if (!i) throw new Error(`indicador ${id} ausente da gold da Segurança pública`);
  return i;
}

export function serieUF(g: GoldSeguranca, id: string, uf: string): SerieUF {
  return g.series[id][uf] as SerieUF;
}

export function serieBR(g: GoldSeguranca, id: string): SerieBrasil {
  return g.series[id][BRASIL] as SerieBrasil;
}

export function seriePct(g: GoldSeguranca, id: string, uf: string): SeriePercentual {
  return g.series[id][uf] as SeriePercentual;
}

/** Índice do último ano em que o Brasil tem valor publicado nas 27 UFs (ou, sem nenhum, com soma parcial). */
export function ultimoIndice(g: GoldSeguranca, id: string, exigirCompleto = true): number {
  const br = serieBR(g, id);
  for (let k = g.anos.length - 1; k >= 0; k--) {
    if (br.n[k] !== null && (!exigirCompleto || br.situacao[k] === "ok")) return k;
  }
  if (exigirCompleto) return ultimoIndice(g, id, false);
  throw new Error(`indicador ${id} sem nenhum ano publicado`);
}

/** Último ano com dado final do SIM (o preliminar fica de fora dos números de abertura). */
export function ultimoIndiceSimFinal(g: GoldSeguranca): number {
  return g.anos.indexOf(g.fontes.sim.final_ate);
}

export const GRUPOS: Record<Exclude<GrupoId, "qualidade" | "recursos">, { titulo: string; pergunta: string; nota: string }> = {
  letalidade: {
    titulo: "Violência letal",
    pergunta: "Quantas mortes violentas cada registro conta?",
    nota: "Categorias apresentadas separadamente. Homicídio doloso, latrocínio, lesão corporal seguida de morte e mortes por intervenção de agentes do Estado são classificações policiais distintas e não formam aqui uma soma. O óbito por agressão vem do registro de saúde, com outra regra de contagem.",
  },
  mulheres: {
    titulo: "Mulheres e violência sexual",
    pergunta: "O que os registros mostram sobre a violência contra mulheres e a violência sexual?",
    nota: "Feminicídio é uma classificação penal específica e não equivale a todo homicídio de mulher; o registro de saúde conta os óbitos de mulheres por agressão. Estupro e estupro de vulnerável contam vítimas de qualquer sexo. Violência sexual registrada não mede toda a vitimização: acesso à denúncia e classificação influenciam os registros.",
  },
  patrimonio: {
    titulo: "Crimes patrimoniais",
    pergunta: "Como variaram os crimes patrimoniais registrados?",
    nota: "Ocorrências não equivalem a vítimas únicas. A variação dos registros depende também da denúncia e da classificação. O recorte cobre veículos, carga e instituições financeiras; não todo crime patrimonial. A taxa de veículos usa a população como base, não a frota.",
  },
  resposta: {
    titulo: "Busca e atividade policial",
    pergunta: "Que atividades e registros de busca são contabilizados?",
    nota: "Localizações podem se referir a desaparecimentos de outros anos: dividir localizados por desaparecidos não produz taxa de resolução. Apreensões e mandados cumpridos medem atividade registrada, não qualidade nem eficiência, e por isso aparecem sem taxa por habitante.",
  },
};

export type LinhaNacional = {
  indicador: Indicador;
  ano: number;
  n: number;
  situacao: string;
  cobertura: number;
  fora: string[];
  taxa: number | null;
  variacao: number | null;
  anoAnterior: number | null;
};

/** Os indicadores de um grupo no último ano publicado de cada um, com a variação nacional calculada pela gold. */
export function linhasNacionais(g: GoldSeguranca, grupo: GrupoId): LinhaNacional[] {
  return g.indicadores
    .filter((i) => i.grupo === grupo && i.id !== "indeterminadas_pct")
    .map((i) => {
      const k = i.fonte === "sim" ? ultimoIndiceSimFinal(g) : ultimoIndice(g, i.id);
      const br = serieBR(g, i.id);
      return {
        indicador: i,
        ano: g.anos[k],
        n: br.n[k] as number,
        situacao: br.situacao[k],
        cobertura: br.cobertura[k],
        fora: br.fora[k],
        taxa: br.taxa ? br.taxa[k] : null,
        variacao: br.variacao[k],
        anoAnterior: k > 0 ? g.anos[k - 1] : null,
      };
    });
}

/** Payload da comparação por UF que vai ao navegador (página com conta): indicadores com série por UF. */
export type PacoteEstados = {
  anos: number[];
  ufs: { sigla: string; nome: string; regiao: string }[];
  indicadores: Indicador[];
  series: Record<string, Record<string, SerieUF | SerieBrasil>>;
  populacao: Record<string, { total: number[]; mulheres: number[] }>;
  simSituacao: Record<string, "final" | "preliminar">;
  policiaSaude: Record<string, (number | null)[]>;
  rotuloFonte: Record<string, string>;
};

export const NA_COMPARACAO = (i: Indicador) => i.id !== "indeterminadas_pct" && i.id !== "despesa_participacao";

export function pacoteEstados(g: GoldSeguranca): PacoteEstados {
  const indicadores = g.indicadores.filter(NA_COMPARACAO);
  return {
    anos: g.anos,
    ufs: g.ufs.map(({ sigla, nome, regiao }) => ({ sigla, nome, regiao })),
    indicadores,
    series: Object.fromEntries(indicadores.map((i) => [i.id, g.series[i.id] as Record<string, SerieUF | SerieBrasil>])),
    populacao: g.populacao,
    simSituacao: g.fontes.sim.situacao,
    policiaSaude: g.policia_saude,
    rotuloFonte: {
      sinesp: `Sinesp VDE (MJSP), captura de ${g.fontes.sinesp.capturado_em.slice(0, 10)}`,
      sim: `SIM (Ministério da Saúde), dados finais até ${g.fontes.sim.final_ate}`,
      siconfi: `Siconfi (Tesouro Nacional), DCA, captura de ${g.fontes.siconfi.capturado_em.slice(0, 10)}`,
      ibge: `IBGE, ${g.fontes.ibge.rotulo}`,
    },
  };
}

/** Maior e menor taxa entre as UFs num ano: a amplitude que a abertura mostra, sem adjetivo. */
export function amplitude(g: GoldSeguranca, id: string, k: number): { max: { uf: string; taxa: number }; min: { uf: string; taxa: number }; comparadas: number } {
  const linhas = g.ufs
    .map((u) => ({ uf: u.sigla, nome: u.nome, taxa: serieUF(g, id, u.sigla).taxa?.[k] ?? null }))
    .filter((x): x is { uf: string; nome: string; taxa: number } => x.taxa !== null)
    .sort((a, b) => b.taxa - a.taxa);
  return { max: linhas[0], min: linhas[linhas.length - 1], comparadas: linhas.length };
}

export function nomeUF(g: GoldSeguranca, sigla: string): string {
  return g.ufs.find((u) => u.sigla === sigla)?.nome ?? sigla;
}
