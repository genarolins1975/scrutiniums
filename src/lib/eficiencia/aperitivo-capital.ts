/**
 * Versão aperitivo da entrada da Eficiência Estatal ("Como está a minha capital?"), SEM dados próprios:
 * recorta do retrato montado no servidor (`montarRetrato`, em `entrada.ts`) quatro das sete condições de
 * 2022 e calcula, pelos valores originais, a posição de cada capital entre as que têm dado. Nada de nota
 * composta, nada escrito à mão: ausência continua ausência. Pode ser importado por componente cliente.
 */
import type {Medida, RetratoDados} from './entrada-nucleo';

/**
 * As quatro condições mais diretas para quem não é especialista, uma por área da vida: dinheiro (renda por
 * pessoa), escola das crianças pequenas, tempo de deslocamento e violência. Ficam no painel com conta as
 * outras três condições (esgotamento, moradia adensada e internet) e os três recursos da prefeitura.
 */
export const INDICADORES_APERITIVO = ['trabalho', 'educacao', 'mobilidade', 'seguranca'] as const;

export type PosicaoCapital = {
  /** 1 é o maior valor; empates dividem a mesma posição (1 + capitais com valor estritamente maior). */
  ordem: number;
  /** Capitais com dado na mesma medida (universo da posição). */
  universo: number;
  /** Outras capitais com exatamente o mesmo valor. */
  empatadas: string[];
};

export type IndicadorAperitivo = Pick<Medida, 'id' | 'pergunta' | 'titulo' | 'unidade' | 'periodo' | 'direcao' | 'nota' | 'precisao' | 'fonte' | 'fonteUrl'> & {
  /** Valor original por código IBGE; `null` é ausência, nunca zero. */
  valores: Record<string, number | null>;
  /** Posição por código IBGE; ausente quando a capital não tem valor. */
  posicoes: Record<string, PosicaoCapital>;
};

export type CapitalAperitivo = {id: string; nome: string; uf: string; populacao: number | null};

export type AperitivoCapital = {capitais: CapitalAperitivo[]; indicadores: IndicadorAperitivo[]; fontePopulacao: string};

/** Posições pelos valores originais: maior valor = 1º, com empates. Capitais sem valor ficam fora do universo. */
export function posicoes(valores: Record<string, number | null>, nomes: Record<string, string>): Record<string, PosicaoCapital> {
  const comDado = Object.entries(valores).filter((e): e is [string, number] => e[1] !== null && Number.isFinite(e[1]));
  const out: Record<string, PosicaoCapital> = {};
  for (const [id, v] of comDado) {
    out[id] = {
      ordem: 1 + comDado.filter(([, w]) => w > v).length,
      universo: comDado.length,
      empatadas: comDado.filter(([outro, w]) => outro !== id && w === v).map(([outro]) => nomes[outro] ?? outro).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    };
  }
  return out;
}

/** Recorte do retrato para o aperitivo: só as capitais (nome, UF, população) e as quatro condições. */
export function montarAperitivoCapital(retrato: RetratoDados): AperitivoCapital {
  const nomes = Object.fromEntries(retrato.capitais.map(c => [c.id, c.nome]));
  const indicadores = INDICADORES_APERITIVO.map(id => {
    const m = retrato.condicoes.find(c => c.id === id);
    if (!m) throw new Error(`Condição ${id} ausente do retrato das capitais`);
    const valores = Object.fromEntries(retrato.capitais.map(c => [c.id, m.valores[c.id]?.valor ?? null]));
    return {id: m.id, pergunta: m.pergunta, titulo: m.titulo, unidade: m.unidade, periodo: m.periodo, direcao: m.direcao,
      nota: m.nota, precisao: m.precisao, fonte: m.fonte, fonteUrl: m.fonteUrl, valores, posicoes: posicoes(valores, nomes)};
  });
  return {capitais: retrato.capitais.map(c => ({id: c.id, nome: c.nome, uf: c.uf, populacao: c.populacao})), indicadores, fontePopulacao: retrato.fontePopulacao};
}

const empate = (nomes: string[]) => !nomes.length ? '' : nomes.length === 1 ? `, empatado com ${nomes[0]}` : `, empatado com ${nomes.length} capitais`;

/** Posição em palavras, sem julgamento: diz só onde o valor está na ordem do maior para o menor. */
export function textoPosicao(p: PosicaoCapital | undefined, total: number): string {
  if (!p) return 'Sem posição: a fonte não traz valor para esta capital';
  const entre = p.universo === total ? `entre as ${total} capitais` : `entre as ${p.universo} capitais com dado`;
  const ultima = p.ordem + p.empatadas.length === p.universo;
  if (p.ordem === 1 && !ultima) return `Maior valor ${entre}${empate(p.empatadas)}`;
  if (ultima && p.ordem !== 1) return `Menor valor ${entre}${empate(p.empatadas)}`;
  if (p.ordem === 1) return `Mesmo valor em todas as ${p.universo} capitais com dado`;
  return `${p.ordem}º maior valor ${entre}${empate(p.empatadas)}`;
}
