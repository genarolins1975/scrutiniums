import { ETAPAS, type Etapa, type GoldEducacao, type Serie, type VariacaoIdeb } from "./tipos";

/**
 * Divisão logarítmica da mudança do Ideb entre aprendizagem (N) e fluxo (P): a mesma regra de `analise_serie` em
 * pipeline/educacao/gold.py, aplicada no servidor às séries do Brasil (redes municipais) e dos estados (rede pública), que o
 * pipeline ainda não divide. Roda só na renderização do servidor, nunca no navegador, e o teste
 * src/tests/educacao-decomposicao.test.ts prova que ela reproduz, par a par, as variações que o pipeline publicou para os
 * municípios. Quando o pipeline passar a publicar o Brasil e os estados, este módulo vira só leitura.
 *
 * Contribuições nulas significam mudança do produto menor que 0,05 ponto ou logaritmo indefinido; nunca contribuição zero.
 */
export function decompor(s: Pick<Serie, "n" | "p">, i: number, j: number): VariacaoIdeb | null {
  const n0 = s.n[i], n1 = s.n[j], p0 = s.p[i], p1 = s.p[j];
  if (n0 == null || n1 == null || p0 == null || p1 == null) return null;
  const v0 = n0 * p0;
  const v1 = n1 * p1;
  // o pipeline compara a mudança exata (Decimal) com 0,05; o arredondamento a 10 casas tira o ruído do ponto flutuante
  const delta = Math.round((v1 - v0) * 1e10) / 1e10;
  let cn: number | null = null;
  let cp: number | null = null;
  if (Math.abs(delta) >= 0.05 && Math.min(n0, n1, p0, p1) > 0) {
    cn = ((Math.log(n1) - Math.log(n0)) / (Math.log(v1) - Math.log(v0))) * (v1 - v0);
    cp = v1 - v0 - cn;
  }
  return [i, j, n1 - n0, p1 - p0, v0, v1, cn, cp];
}

/** A mudança de uma etapa entre duas edições, com o que a sustenta. */
export type MudancaEtapa = {
  etapa: Etapa;
  inicio: number;
  fim: number;
  ideb: [number, number];
  n: [number, number];
  p: [number, number];
  /** Parcelas da aprendizagem e do fluxo, em ponto de Ideb; null quando a regra não divide (ver `decompor`). */
  parcelaN: number | null;
  parcelaP: number | null;
  produto: [number, number];
  aprov: [number | null, number | null];
  mat: [number | null, number | null];
  port: [number | null, number | null];
};

export type PeriodoDecomposto = { inicio: number; fim: number; etapas: MudancaEtapa[] };

/** Um recorte da seção (Brasil ou estado): a rede, o nome e os períodos divididos. */
export type RecorteDecomposto = { id: string; nome: string; rede: string; periodos: PeriodoDecomposto[] };

/** Anos de início da comparação: a primeira edição, a última década e a edição de seis anos antes (o par que a ficha abre). */
export function iniciosDosPeriodos(anos: number[], ano: number): number[] {
  return [...new Set([anos[0], ano - 10, ano - 6])].filter((a) => anos.includes(a) && a < ano);
}

/** Os períodos de um par de séries (anos iniciais e finais), até a edição mais recente; etapa sem dado fica de fora, nunca vira zero. */
export function periodos(series: Record<Etapa, Serie | null | undefined>, anos: number[], ano: number): PeriodoDecomposto[] {
  const fim = anos.indexOf(ano);
  if (fim < 0) return [];
  return iniciosDosPeriodos(anos, ano)
    .map((a) => {
      const i = anos.indexOf(a);
      const etapas: MudancaEtapa[] = [];
      for (const e of ETAPAS) {
        const s = series[e];
        if (!s) continue;
        const v = decompor(s, i, fim);
        const i0 = s.ideb[i], i1 = s.ideb[fim];
        if (!v || i0 == null || i1 == null) continue;
        etapas.push({
          etapa: e, inicio: a, fim: ano, ideb: [i0, i1], n: [s.n[i]!, s.n[fim]!], p: [s.p[i]!, s.p[fim]!], parcelaN: v[6], parcelaP: v[7], produto: [v[4], v[5]],
          aprov: [s.aprov[i], s.aprov[fim]], mat: [s.mat[i], s.mat[fim]], port: [s.port[i], s.port[fim]],
        });
      }
      return { inicio: a, fim: ano, etapas };
    })
    .filter((p) => p.etapas.length > 0);
}

/** Brasil (redes municipais, como publica o INEP) e os estados (rede pública: a planilha estadual não separa a municipal). */
export function recortesDecompostos(g: GoldEducacao, nomeUf: (s: string) => string): RecorteDecomposto[] {
  const { anos, ano } = g.ideb;
  const brasil: RecorteDecomposto = { id: "BR", nome: "Brasil", rede: "redes municipais", periodos: periodos({ ai: g.ideb.brasil.ai.municipal, af: g.ideb.brasil.af.municipal }, anos, ano) };
  const ufs = Object.keys(g.ideb.ufs.ai)
    .sort((a, b) => nomeUf(a).localeCompare(nomeUf(b), "pt-BR"))
    .map((s) => ({ id: s, nome: nomeUf(s), rede: "rede pública", periodos: periodos({ ai: g.ideb.ufs.ai[s]?.publica, af: g.ideb.ufs.af[s]?.publica }, anos, ano) }));
  return [brasil, ...ufs].filter((r) => r.periodos.length > 0);
}
