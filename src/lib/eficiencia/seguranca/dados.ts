/**
 * Leitura da gold do painel Segurança pública (public/eficiencia/seguranca-publica/gold/seguranca.json), só no servidor.
 * Nenhum número do painel é escrito no código: contagens, taxas, posições, diferenças, variações, coberturas e datas
 * vêm prontos da gold (pipeline/seguranca/gold.py). Este módulo só escolhe o recorte que cada página mostra.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataBr } from "./formato";
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

// Perguntas reescritas pela vida do leitor, não pela base (diagnóstico de 24/11/2026, item 2.2.4); o conteúdo de cada página é o mesmo.
export const GRUPOS: Record<Exclude<GrupoId, "qualidade" | "recursos">, { titulo: string; pergunta: string; nota: string }> = {
  letalidade: {
    titulo: "Violência letal",
    pergunta: "Quantas pessoas morrem de forma violenta, e de que forma?",
    nota: "Categorias apresentadas separadamente. Homicídio doloso, latrocínio, lesão corporal seguida de morte e mortes por intervenção de agentes do Estado são classificações policiais distintas e não formam aqui uma soma. O óbito por agressão vem do registro de saúde, com outra regra de contagem.",
  },
  mulheres: {
    titulo: "Mulheres e violência sexual",
    pergunta: "A violência contra mulheres e a violência sexual estão crescendo?",
    nota: "Feminicídio é uma classificação penal específica e não equivale a todo homicídio de mulher; o registro de saúde conta os óbitos de mulheres por agressão. Estupro e estupro de vulnerável contam vítimas de qualquer sexo. Violência sexual registrada não mede toda a vitimização: acesso à denúncia e classificação influenciam os registros.",
  },
  patrimonio: {
    titulo: "Crimes patrimoniais",
    pergunta: "Roubos e furtos de veículos e de carga ficaram mais raros?",
    nota: "Ocorrências não equivalem a vítimas únicas. A variação dos registros depende também da denúncia e da classificação. O recorte cobre veículos, carga e instituições financeiras; não todo crime patrimonial. A taxa de veículos usa a população como base, não a frota.",
  },
  resposta: {
    titulo: "Busca e atividade policial",
    pergunta: "Quantas pessoas desaparecem, e o que a polícia registra de atividade?",
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
  /** A série nacional inteira, para a evolução: taxa (ou contagem, sem denominador) por ano, com a marca do ano incompleto. */
  serie: SerieNacional;
};

/**
 * Série nacional de um indicador para desenhar a evolução: o valor de cada ano (taxa quando há denominador, contagem quando não) e
 * a marca dos anos que não são do Brasil inteiro (soma parcial, com UFs de fora) ou que ainda são preliminares (SIM). Ausência é null.
 */
export type SerieNacional = {
  medida: "taxa" | "n";
  valor: (number | null)[];
  /** true quando o ano não cobre as 27 UFs ou é preliminar: desenhado vazado e tracejado, nunca emendado como se fosse completo. */
  incompleto: boolean[];
  cobertura: number[];
  preliminar: boolean[];
};

export function serieNacional(g: GoldSeguranca, id: string): SerieNacional {
  const i = indicador(g, id);
  const br = serieBR(g, id);
  const preliminar = g.anos.map((a) => i.fonte === "sim" && g.fontes.sim.situacao[String(a)] === "preliminar");
  const medida = br.taxa ? "taxa" : "n";
  return {
    medida,
    valor: g.anos.map((_, k) => (medida === "taxa" ? br.taxa?.[k] ?? null : br.n[k])),
    incompleto: g.anos.map((_, k) => br.situacao[k] !== "ok" || preliminar[k]),
    cobertura: br.cobertura,
    preliminar,
  };
}

/** Variação percentual entre dois valores publicados (b sobre a), para frases factuais; null sem os dois. */
export function variacaoPct(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || a === 0) return null;
  return (b / a - 1) * 100;
}

/** Primeiro ano com as 27 UFs na sequência contínua que termina no último ano completo (o começo de uma comparação justa). */
export function inicioSequenciaCompleta(g: GoldSeguranca, id: string): number {
  const br = serieBR(g, id);
  let k = ultimoIndice(g, id);
  while (k > 0 && br.situacao[k - 1] === "ok") k--;
  return k;
}

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
        serie: serieNacional(g, i.id),
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

/** Só o que a comparação desenha: a razão por UF fica na gold e no CSV, fora do payload do navegador. */
function semRazao(serie: SerieUF | SerieBrasil): SerieUF | SerieBrasil {
  if (!("razao" in serie)) return serie;
  const { razao: _razao, ...resto } = serie as SerieUF; // eslint-disable-line @typescript-eslint/no-unused-vars
  return resto;
}

export function pacoteEstados(g: GoldSeguranca, filtro: (i: Indicador) => boolean = () => true): PacoteEstados {
  const indicadores = g.indicadores.filter((i) => NA_COMPARACAO(i) && filtro(i));
  return {
    anos: g.anos,
    ufs: g.ufs.map(({ sigla, nome, regiao }) => ({ sigla, nome, regiao })),
    indicadores,
    series: Object.fromEntries(indicadores.map((i) => [i.id, Object.fromEntries(Object.entries(g.series[i.id] as Record<string, SerieUF | SerieBrasil>).map(([uf, x]) => [uf, semRazao(x)]))])),
    populacao: g.populacao,
    simSituacao: g.fontes.sim.situacao,
    policiaSaude: {},
    rotuloFonte: {
      sinesp: `Sinesp VDE (MJSP), captura de ${dataBr(g.fontes.sinesp.capturado_em)}`,
      sim: `SIM (Ministério da Saúde), dados finais até ${g.fontes.sim.final_ate}`,
      siconfi: `Siconfi (Tesouro Nacional), DCA, captura de ${dataBr(g.fontes.siconfi.capturado_em)}`,
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

/** Payload da comparação polícia e saúde: só as duas taxas por UF, a razão da gold e a situação do SIM. */
export type PacotePoliciaSaude = Pick<PacoteEstados, "anos" | "ufs" | "simSituacao" | "policiaSaude"> & {
  policia: Record<string, { taxa: (number | null)[]; n: (number | null)[] }>;
  saude: Record<string, { taxa: (number | null)[]; n: (number | null)[] }>;
};

export function pacotePoliciaSaude(g: GoldSeguranca): PacotePoliciaSaude {
  const duas = (id: string) => Object.fromEntries(Object.entries(g.series[id] as Record<string, SerieUF | SerieBrasil>).map(([uf, x]) => [uf, { taxa: x.taxa ?? [], n: x.n }]));
  return {
    anos: g.anos,
    ufs: g.ufs.map(({ sigla, nome, regiao }) => ({ sigla, nome, regiao })),
    simSituacao: g.fontes.sim.situacao,
    policiaSaude: g.policia_saude,
    policia: duas("homicidio"),
    saude: duas("agressoes"),
  };
}
