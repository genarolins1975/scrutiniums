/**
 * Núcleo da entrada do OBEE, SEM dados: tipos, faixa das 26 capitais, mediana,
 * formatação e CSV. Pode ser importado por componentes cliente; os dados chegam
 * por prop, montados no servidor por `entrada.ts`.
 */
import { fmtNumber } from "../format";
import type { Idioma } from "../idioma";

export type Contorno = {d: string; largura: number; altura: number; kmPorUnidade: number; partesDistantes: number; partesPequenas: number};
export type CapitalRetrato = {id: string; nome: string; uf: string; regiao: string;
  populacao: number | null; areaKm2: number | null; contorno: Contorno | null};

/** Valor de uma capital: `null` é ausência ou inelegibilidade, nunca zero. */
export type ValorMedida = {valor: number | null; foraDaComparacao?: string};

export type Medida = {
  id: string; pergunta: string; curto: string; titulo: string; unidade: string; periodo: string;
  direcao: 'maior' | 'menor' | 'nenhuma'; natureza: string; nota: string; precisao: string;
  fonte: string; fonteUrl: string;
  /** `href` aceita {a} e {b} (capital e comparador); `chaves` traduz o código IBGE quando o painel usa outro. */
  painel: {href: string; rotulo: string; chaves?: Record<string, string>} | null;
  valores: Record<string, ValorMedida>;
  /** Posição relativa entre as 26 (0 a 100, metade dos empates), só para as condições da edição v4. */
  posicoes?: Record<string, number>;
};

export type RetratoDados = {
  capitais: CapitalRetrato[]; condicoes: Medida[]; recursos: Medida[];
  fonteContornos: {fonte: string; url: string; capturadoEm: string; tratamento: string};
  fontePopulacao: string;
};

export const RESSALVA_PRECISAO = 'Precisão municipal não quantificada nas medidas amostrais; diferenças pequenas não são diferenças certas.';

/** Link do painel com o recorte das duas capitais, quando o painel aceita parâmetros. */
export function hrefPainel(painel: NonNullable<Medida['painel']>, a: string, b: string) {
  const k = (id: string) => encodeURIComponent(painel.chaves ? painel.chaves[id] ?? '' : id);
  return painel.href.replace('{a}', k(a)).replace('{b}', k(b));
}

export function mediana(valores: number[]): number | null {
  const v = valores.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Valores elegíveis para a referência e a faixa; inelegíveis e ausentes ficam de fora, à vista na tabela. */
export const elegiveis = (m: Medida) =>
  Object.entries(m.valores).filter(([, v]) => v.valor !== null && !v.foraDaComparacao).map(([id, v]) => ({id, valor: v.valor as number}));

/** Domínio da faixa: do menor ao maior valor elegível, com folga; não começa em zero (pontos, não barras). */
export function dominio(m: Medida): [number, number] {
  const v = elegiveis(m).map(x => x.valor);
  const lo = Math.min(...v), hi = Math.max(...v), folga = (hi - lo || Math.abs(hi) || 1) * 0.06;
  return [lo - folga, hi + folga];
}

/** Pontos da faixa no viewBox 0 a 400. A altura só separa pontos próximos; não codifica outra medida. */
export function faixa(m: Medida, largura = 400, margem = 12, passo = 11) {
  const [lo, hi] = dominio(m);
  const x = (v: number) => margem + (v - lo) / (hi - lo) * (largura - 2 * margem);
  const trilhas: number[] = [];
  const pontos = elegiveis(m).sort((a, b) => a.valor - b.valor || a.id.localeCompare(b.id)).map(p => {
    const px = x(p.valor);
    let t = trilhas.findIndex(ultimo => px - ultimo >= passo);
    if (t < 0) t = trilhas.length;
    trilhas[t] = px;
    return {...p, x: px, trilha: t};
  });
  const ref = mediana(pontos.map(p => p.valor));
  return {pontos, trilhas: Math.max(1, trilhas.length), x, dominio: [lo, hi] as [number, number], mediana: ref, medianaX: ref === null ? null : x(ref)};
}

export function numero(v: number | null, unidade: string, casas?: number, idioma: Idioma = 'pt') {
  if (v === null || !Number.isFinite(v)) return 'Não disponível';
  const d = casas ?? (unidade === 'R$' ? 2 : 1);
  const s = fmtNumber(v, d, idioma);
  if (unidade === 'R$') return `R$ ${s}`;
  if (unidade === '%') return `${s}%`;
  return `${s} ${unidade}`;
}

/** Preposição com o nome da capital: "no Rio de Janeiro", "em Recife". */
const COM_ARTIGO = new Set(['Rio de Janeiro']);
export const naCapital = (nome: string) => COM_ARTIGO.has(nome) ? `no ${nome}` : `em ${nome}`;
export const daCapital = (nome: string) => COM_ARTIGO.has(nome) ? `do ${nome}` : `de ${nome}`;
export const aCapital = (nome: string) => COM_ARTIGO.has(nome) ? `ao ${nome}` : `a ${nome}`;

export const inteiro = (v: number | null, idioma: Idioma = 'pt') => v === null ? 'Não disponível' : fmtNumber(Math.round(v), 0, idioma);

/** Diferença A − B na unidade da medida; percentuais viram pontos percentuais. */
export function diferenca(a: number | null, b: number | null, unidade: string, idioma: Idioma = 'pt') {
  if (a === null || b === null) return 'Diferença indisponível';
  const d = a - b, sinal = Math.abs(d) < 1e-9 ? '' : d > 0 ? '+' : '−';
  const abs = Math.abs(d);
  if (unidade === '%') return `${sinal}${fmtNumber(abs, 1, idioma)} p.p.`;
  if (unidade === 'R$') return `${sinal}R$ ${fmtNumber(abs, 2, idioma)}`;
  return `${sinal}${fmtNumber(abs, 1, idioma)} ${unidade}`;
}

/** Barra de escala com comprimento redondo em km, entre 18% e 45% da largura disponível. */
export function escala(kmPorUnidadeDesenho: number, larguraDisponivel: number) {
  const opcoes = [0.5, 1, 2, 5, 10, 20, 50, 100, 200];
  const alvo = larguraDisponivel * kmPorUnidadeDesenho * 0.3;
  const km = opcoes.reduce((m, o) => Math.abs(o - alvo) < Math.abs(m - alvo) ? o : m, opcoes[0]);
  return {km, comprimento: km / kmPorUnidadeDesenho};
}

export function csv(dados: RetratoDados) {
  const medidas = [...dados.condicoes, ...dados.recursos];
  const cab = ['capital', 'codigo_ibge', 'uf', ...medidas.flatMap(m => [`${m.id}_valor`, `${m.id}_unidade`, `${m.id}_periodo`, `${m.id}_situacao`]), 'ressalva'];
  const linhas = dados.capitais.map(c => [c.nome, c.id, c.uf, ...medidas.flatMap(m => {
    const v = m.valores[c.id];
    return [v?.valor ?? '', m.unidade, m.periodo, v?.valor === null || !v ? 'ausente' : v.foraDaComparacao ? 'fora da comparação' : 'observado'];
  }), RESSALVA_PRECISAO]);
  return [cab, ...linhas].map(l => l.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
}
