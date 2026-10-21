/**
 * Leitura de public/obs/data/gold/juros.json (pipeline do Crédito, fonte BCB txjuros) para as consultas Next
 * "Quanto meu banco cobra?" e "Simulador do custo da dívida". Só no servidor: o arquivo fica na pasta fechada
 * /obs/data e a página entrega ao navegador apenas o recorte escolhido e as listas dos seletores.
 *
 * Contrato usado do arquivo: `gerado_em`, `fonte`, `conceitos`, `modalidades[]` (id, segmento, modalidade, janela,
 * stats n/min/p25/mediana/p75/max e ranking com cnpj8, nome, taxa_am, taxa_aa, posicao) e `perfis_if[]` (cnpj8, nome).
 * Nenhum número é recalculado além de diferenças e contagens declaradas na página.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rotuloModalidade, slugModalidade } from "./modalidades";

export { ehPosFixada, naoEhParcelada, partesDaModalidade, rotuloModalidade, slugModalidade } from "./modalidades";

export type Segmento = "pf" | "pj";

export type LinhaRanking = {
  cnpj8: string;
  nome: string;
  taxa_am: number;
  taxa_aa: number;
  posicao: number;
  vs_mediana: number;
};

export type ModalidadeJuros = {
  id: string;
  segmento: "PF" | "PJ";
  modalidade: string;
  janela: { inicio: string; fim: string };
  stats: { n: number; min: number; p25: number; mediana: number; p75: number; max: number };
  ranking: LinhaRanking[];
};

export type GoldJuros = {
  gerado_em: string;
  tipo: string;
  fonte: string;
  conceitos: Record<string, string>;
  modalidades: ModalidadeJuros[];
  perfis_if: { cnpj8: string; nome: string; modalidades: { id: string }[] }[];
};

const ARQUIVO = join(process.cwd(), "public", "obs", "data", "gold", "juros.json");

let cache: { gold: GoldJuros | null; lido: boolean } = { gold: null, lido: false };

/** A gold de juros, ou null quando o arquivo falta ou não tem modalidades (a página declara a ausência). */
export function goldJuros(): GoldJuros | null {
  if (!cache.lido) {
    let gold: GoldJuros | null = null;
    try {
      const bruto = JSON.parse(readFileSync(ARQUIVO, "utf-8")) as GoldJuros;
      gold = Array.isArray(bruto?.modalidades) && bruto.modalidades.length > 0 ? bruto : null;
    } catch {
      gold = null;
    }
    cache = { gold, lido: true };
  }
  return cache.gold;
}

/** Para testes: força nova leitura do arquivo. */
export function _limparCacheJuros() {
  cache = { gold: null, lido: false };
}

export function segmentoDe(m: ModalidadeJuros): Segmento {
  return m.segmento === "PJ" ? "pj" : "pf";
}

export type OpcoesSeletor = {
  segmentos: { id: Segmento; rotulo: string }[];
  modalidades: { slug: string; segmento: Segmento; rotulo: string; n: number }[];
  bancos: { cnpj8: string; nome: string }[];
};

export const ROTULO_SEGMENTO: Record<Segmento, string> = { pf: "Pessoa física", pj: "Empresa (pessoa jurídica)" };

/** Listas dos seletores: as 20 modalidades e as instituições que aparecem em pelo menos uma delas, em ordem alfabética. */
export function opcoesSeletor(gold: GoldJuros): OpcoesSeletor {
  const segmentos = (["pf", "pj"] as const).filter((s) => gold.modalidades.some((m) => segmentoDe(m) === s)).map((id) => ({ id, rotulo: ROTULO_SEGMENTO[id] }));
  const modalidades = gold.modalidades
    .map((m) => ({ slug: slugModalidade(m.modalidade), segmento: segmentoDe(m), rotulo: rotuloModalidade(m.modalidade), n: m.stats.n }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const vistos = new Map<string, string>();
  for (const p of gold.perfis_if ?? []) vistos.set(p.cnpj8, p.nome);
  for (const m of gold.modalidades) for (const r of m.ranking) if (!vistos.has(r.cnpj8)) vistos.set(r.cnpj8, r.nome);
  const bancos = [...vistos].map(([cnpj8, nome]) => ({ cnpj8, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { segmentos, modalidades, bancos };
}

/** Parâmetros da URL (?seg=&mod=&banco=), como chegam do Next. */
export type ParametrosConsulta = Record<string, string | string[] | undefined>;

function primeiro(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export type Posicao = {
  posicao: number;
  n: number;
  menores: number;
  iguais: number;
  maiores: number;
};

export type Consulta = {
  segmento: Segmento;
  modalidade: ModalidadeJuros;
  slug: string;
  /** Instituição escolhida, quando o código existe na publicação. */
  banco: { cnpj8: string; nome: string } | null;
  /** Linha do banco na modalidade, ou null quando a instituição não aparece nela nesta janela. */
  linha: LinhaRanking | null;
  posicao: Posicao | null;
  /** Taxa do banco menos a mediana, em pontos percentuais ao ano. */
  distanciaPp: number | null;
  /** A mesma distância em % da mediana. */
  distanciaPct: number | null;
  /** Modalidades em que o banco aparece, para oferecer quando ele não aparece na escolhida. */
  outrasDoBanco: { slug: string; rotulo: string; segmento: Segmento }[];
  /** Parâmetro pedido que não existe na publicação (endereço antigo ou digitado): a página avisa e usa o padrão. */
  ignorados: string[];
};

/** Modalidade padrão do segmento: a que reúne mais instituições na publicação. */
function padraoDoSegmento(gold: GoldJuros, seg: Segmento): ModalidadeJuros {
  const doSeg = gold.modalidades.filter((m) => segmentoDe(m) === seg);
  const lista = doSeg.length ? doSeg : gold.modalidades;
  return [...lista].sort((a, b) => b.stats.n - a.stats.n || a.modalidade.localeCompare(b.modalidade, "pt-BR"))[0];
}

/** Resolve a consulta a partir da URL. Valor desconhecido abre no padrão e é avisado, nunca vira outro recorte em silêncio. */
export function resolverConsulta(gold: GoldJuros, params: ParametrosConsulta): Consulta {
  const ignorados: string[] = [];
  const segPedido = primeiro(params.seg).toLowerCase();
  const modPedido = primeiro(params.mod);
  const bancoPedido = primeiro(params.banco).replace(/\D/g, "");

  // o mesmo nome de modalidade existe nos dois segmentos (ex.: cheque especial): procura primeiro no segmento pedido
  const segValido = segPedido === "pf" || segPedido === "pj" ? (segPedido as Segmento) : null;
  if (segPedido && !segValido) ignorados.push("segmento");
  const comSlug = modPedido ? gold.modalidades.filter((m) => slugModalidade(m.modalidade) === modPedido) : [];
  let modalidade = comSlug.find((m) => !segValido || segmentoDe(m) === segValido);
  if (modPedido && !modalidade) ignorados.push("modalidade");
  modalidade ??= padraoDoSegmento(gold, segValido ?? "pf");
  const segmento = segmentoDe(modalidade);

  const opcoes = opcoesSeletor(gold);
  const banco = bancoPedido ? opcoes.bancos.find((b) => b.cnpj8 === bancoPedido) ?? null : null;
  if (bancoPedido && !banco) ignorados.push("instituição");

  const linha = banco ? modalidade.ranking.find((r) => r.cnpj8 === banco.cnpj8) ?? null : null;
  const mediana = modalidade.stats.mediana;
  let posicao: Posicao | null = null;
  if (linha) {
    const taxas = modalidade.ranking.map((r) => r.taxa_aa);
    posicao = {
      posicao: linha.posicao,
      n: modalidade.stats.n,
      menores: taxas.filter((t) => t < linha.taxa_aa).length,
      iguais: taxas.filter((t) => t === linha.taxa_aa).length - 1,
      maiores: taxas.filter((t) => t > linha.taxa_aa).length,
    };
  }
  const distanciaPp = linha ? linha.taxa_aa - mediana : null;
  const distanciaPct = linha && mediana > 0 ? ((linha.taxa_aa - mediana) / mediana) * 100 : null;
  const outrasDoBanco = banco
    ? gold.modalidades
        .filter((m) => m !== modalidade && m.ranking.some((r) => r.cnpj8 === banco.cnpj8))
        .map((m) => ({ slug: slugModalidade(m.modalidade), rotulo: rotuloModalidade(m.modalidade), segmento: segmentoDe(m) }))
    : [];
  return {
    segmento,
    modalidade,
    slug: slugModalidade(modalidade.modalidade),
    banco,
    linha,
    posicao,
    distanciaPp,
    distanciaPct,
    outrasDoBanco,
    ignorados,
  };
}

/** Endereço de uma consulta, com os parâmetros na ordem seg, mod, banco e os extras dados. */
export function hrefConsulta(base: string, seg: Segmento, slug: string, banco?: string | null, extras: Record<string, string> = {}): string {
  const p = new URLSearchParams({ seg, mod: slug });
  if (banco) p.set("banco", banco);
  for (const [k, v] of Object.entries(extras)) if (v) p.set(k, v);
  return `${base}?${p.toString()}`;
}
