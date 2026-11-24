/**
 * Leitura das golds da coleção Varejo, somente no servidor (public/varejo/gold). Nada aqui inventa número: tudo vem das golds
 * (pipeline/varejo/setor.py e empresas.py) e da curadoria materializada (scripts/materializar-varejo.mjs). Os seletores
 * abaixo são o contrato único de cada número: o título, a frase, o gráfico, a tabela e o CSV de uma página leem a mesma
 * função, para o texto nunca divergir do gráfico. Ausência é null e segue null até a tela.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { direcao, mesExtenso, num, variacao } from "./formato";
import { NOME_CURTO_ATIVIDADE, UFS } from "./paginas";
import type { AtividadePmc, BlocoPmc, CuradoriaVarejo, GoldEmpresas, GoldSetor, GrupoPac, Indicador, PeriodoEmpresa, SegmentoCuradoria, Universo, VariavelPmc } from "./tipos";

export const ARQUIVO_SETOR = join("public", "varejo", "gold", "setor.json");
export const ARQUIVO_EMPRESAS = join("public", "varejo", "gold", "empresas.json");
export const ARQUIVO_CURADORIA = join("public", "varejo", "gold", "curadoria.json");

let cacheSetor: GoldSetor | null = null;
let cacheEmpresas: GoldEmpresas | null = null;

export function goldSetor(): GoldSetor {
  cacheSetor ??= JSON.parse(readFileSync(join(process.cwd(), ARQUIVO_SETOR), "utf-8")) as GoldSetor;
  return cacheSetor;
}

export function goldEmpresas(): GoldEmpresas {
  cacheEmpresas ??= JSON.parse(readFileSync(join(process.cwd(), ARQUIVO_EMPRESAS), "utf-8")) as GoldEmpresas;
  return cacheEmpresas;
}

const CURADORIA_VAZIA: CuradoriaVarejo = { gerado_em: null, ranking: null, segmentos: null, fichas: {}, recusados: [] };

/**
 * A curadoria escrita à mão (ranking, segmentos e fichas), num arquivo só. Arquivo ausente ou ilegível é o estado "em
 * apuração": as páginas dizem isso e seguem de pé. Sem cache: o arquivo é pequeno e chega durante a edição da curadoria.
 */
export function curadoria(): CuradoriaVarejo {
  const caminho = join(process.cwd(), ARQUIVO_CURADORIA);
  if (!existsSync(caminho)) return CURADORIA_VAZIA;
  try {
    const c = JSON.parse(readFileSync(caminho, "utf-8")) as Partial<CuradoriaVarejo>;
    return { gerado_em: c.gerado_em ?? null, ranking: c.ranking ?? null, segmentos: c.segmentos ?? null, fichas: c.fichas ?? {}, recusados: c.recusados ?? [] };
  } catch {
    return CURADORIA_VAZIA;
  }
}

/* ------------------------------------------------------------------ medidas e recortes */

export const UNIVERSOS = ["restrito", "ampliado"] as const satisfies readonly Universo[];
export const NOME_UNIVERSO: Record<Universo, string> = { restrito: "Varejo restrito", ampliado: "Varejo ampliado" };

export type Medida = "mm" | "aa" | "m12";
export const MEDIDAS = ["mm", "aa", "m12"] as const satisfies readonly Medida[];

/** Cada medida com a base escrita por extenso: a variação nunca aparece sem dizer contra o quê. */
export const DEF_MEDIDA: Record<Medida, { rotulo: string; curto: string; base: string; variavel: VariavelPmc }> = {
  mm: { rotulo: "No mês, com ajuste sazonal", curto: "no mês", base: "contra o mês imediatamente anterior, com ajuste sazonal", variavel: "mm" },
  aa: { rotulo: "Contra o mesmo mês do ano anterior", curto: "interanual", base: "contra o mesmo mês do ano anterior, sem ajuste sazonal", variavel: "aa" },
  m12: { rotulo: "Acumulada em 12 meses", curto: "em 12 meses", base: "no acumulado dos últimos 12 meses contra os 12 meses anteriores", variavel: "m12" },
};

export type Periodo = "2019" | "5a" | "24m";
export const PERIODOS = ["24m", "5a", "2019"] as const satisfies readonly Periodo[];
export const NOME_PERIODO: Record<Periodo, string> = { "2019": "Desde 2019", "5a": "5 anos", "24m": "24 meses" };

export const INDICADORES = ["volume", "receita"] as const satisfies readonly Indicador[];
export const NOME_INDICADOR: Record<Indicador, string> = { volume: "Volume de vendas", receita: "Receita nominal" };

/** Índice, em `meses`, do último mês publicado (referencia.pmc). */
export function ultimoIndice(g: GoldSetor = goldSetor()): number {
  const i = g.pmc.meses.lastIndexOf(g.referencia.pmc);
  return i >= 0 ? i : g.pmc.meses.length - 1;
}

/** Primeiro índice do período escolhido: janeiro de 2019, 60 ou 24 meses até o último. */
export function inicioDoPeriodo(g: GoldSetor, periodo: Periodo): number {
  const ult = ultimoIndice(g);
  if (periodo === "2019") return Math.max(0, g.pmc.meses.indexOf("2019-01"));
  return Math.max(0, ult - (periodo === "5a" ? 59 : 23));
}

/** Meses que o leitor pode escolher: de janeiro de 2019 ao último publicado. */
export function mesesSelecionaveis(g: GoldSetor = goldSetor()): string[] {
  return g.pmc.meses.slice(inicioDoPeriodo(g, "2019"), ultimoIndice(g) + 1);
}

/** O mês pedido na URL, quando existe na série; senão o último. */
export function indiceDoMes(g: GoldSetor, mes: string | null): number {
  const validos = mesesSelecionaveis(g);
  return mes && validos.includes(mes) ? g.pmc.meses.indexOf(mes) : ultimoIndice(g);
}

const v = (serie: (number | null)[] | undefined, i: number): number | null => {
  const x = serie?.[i];
  return typeof x === "number" && Number.isFinite(x) ? x : null;
};

/** Diferença entre duas variações, em pontos percentuais; ausente quando uma delas falta. */
export const diferenca = (receita: number | null, volume: number | null): number | null => (receita === null || volume === null ? null : Number((receita - volume).toFixed(1)));

export type PontoBrasil = { mes: string; volume: number | null; receita: number | null; diferenca: number | null };

/** A série do Brasil no recorte: é dela que saem o gráfico principal, a diferença, a tabela e o texto. */
export function serieBrasil(g: GoldSetor, universo: Universo, medida: Medida, periodo: Periodo): PontoBrasil[] {
  return serieDoBloco(g, g.pmc.brasil[universo], medida, periodo);
}

export function serieDoBloco(g: GoldSetor, bloco: BlocoPmc | undefined, medida: Medida, periodo: Periodo): PontoBrasil[] {
  const de = inicioDoPeriodo(g, periodo);
  const ate = ultimoIndice(g);
  const k = DEF_MEDIDA[medida].variavel;
  const saida: PontoBrasil[] = [];
  for (let i = de; i <= ate; i++) {
    const volume = v(bloco?.volume[k], i);
    const receita = v(bloco?.receita[k], i);
    saida.push({ mes: g.pmc.meses[i], volume, receita, diferenca: diferenca(receita, volume) });
  }
  return saida;
}

export type Leitura = { mes: string; volume: Record<Medida, number | null>; receita: Record<Medida, number | null> };

/** As três variações de volume e de receita num mês (padrão: o último publicado). */
export function leitura(g: GoldSetor, bloco: BlocoPmc, i: number = ultimoIndice(g)): Leitura {
  const de = (ind: Indicador) => Object.fromEntries(MEDIDAS.map((m) => [m, v(bloco[ind][DEF_MEDIDA[m].variavel], i)])) as Record<Medida, number | null>;
  return { mes: g.pmc.meses[i], volume: de("volume"), receita: de("receita") };
}

export const leituraBrasil = (g: GoldSetor, universo: Universo, i?: number) => leitura(g, g.pmc.brasil[universo], i);

/**
 * O achado do último mês publicado, em uma linha de até 60 caracteres: o volume do varejo restrito contra o mês anterior, com
 * ajuste sazonal (a mesma série e a mesma medida que o gráfico principal abre). Calculado da gold: se a gold muda, o título muda.
 */
export function tituloDoAchado(g: GoldSetor = goldSetor()): string {
  const l = leituraBrasil(g, "restrito");
  const quando = mesExtenso(l.mes);
  const d = direcao(l.volume.mm);
  if (d === "ausente") return `Vendas do varejo em ${quando}`;
  if (d === "estavel") return `Vendas do varejo ficam estáveis em ${quando}`;
  return `Vendas do varejo ${d === "alta" ? "sobem" : "caem"} ${num(Math.abs(l.volume.mm as number), 1)}% em ${quando}`;
}

/** O mês imediatamente anterior ao último publicado ("agosto"), para a frase que cita a base da variação mensal. */
export function mesAnterior(g: GoldSetor = goldSetor()): string | null {
  const i = ultimoIndice(g);
  return i > 0 ? g.pmc.meses[i - 1] : null;
}

/* ------------------------------------------------------------------ atividades */

export type LinhaAtividade = {
  slug: string;
  nome: string;
  nomeCurto: string;
  universo: AtividadePmc["universo"];
  parteDe: string | null;
  volume: number | null;
  receita: number | null;
  diferenca: number | null;
};

/** As atividades que compõem um universo: restrito, as oito do varejo restrito; ampliado, essas e as três que só ele tem. Sem as de detalhe. */
export function atividadesDoUniverso(g: GoldSetor, universo: Universo): string[] {
  return Object.entries(g.pmc.atividades)
    .filter(([, a]) => a.universo === "restrito" || (universo === "ampliado" && a.universo === "ampliado"))
    .map(([slug]) => slug);
}

export function linhaAtividade(g: GoldSetor, slug: string, medida: Medida, i: number): LinhaAtividade {
  const a = g.pmc.atividades[slug];
  const k = DEF_MEDIDA[medida].variavel;
  const volume = v(a.volume[k], i);
  const receita = v(a.receita[k], i);
  return { slug, nome: a.nome, nomeCurto: NOME_CURTO_ATIVIDADE[slug] ?? a.nome, universo: a.universo, parteDe: a.parte_de, volume, receita, diferenca: diferenca(receita, volume) };
}

/** Todas as atividades, na ordem da gold, com as de detalhe logo depois da atividade de que fazem parte. */
export function linhasAtividades(g: GoldSetor, medida: Medida, i: number = ultimoIndice(g)): LinhaAtividade[] {
  const slugs = Object.keys(g.pmc.atividades);
  const principais = slugs.filter((s) => g.pmc.atividades[s].universo !== "detalhe");
  return principais.flatMap((s) => [s, ...slugs.filter((d) => g.pmc.atividades[d].parte_de === s)]).map((s) => linhaAtividade(g, s, medida, i));
}

export type ContraBrasil = { universo: Universo; volume: number | null; receita: number | null };

/**
 * A variação de uma atividade menos a do varejo do Brasil, em pontos percentuais, na mesma medida e no mesmo mês. A referência
 * é o universo a que a atividade pertence: atividade do varejo restrito (e os detalhes dela) contra o varejo restrito; atividade
 * que só entra no ampliado contra o varejo ampliado. Ausente quando um dos dois valores falta.
 */
export function contraBrasil(g: GoldSetor, l: LinhaAtividade, medida: Medida, i: number = ultimoIndice(g)): ContraBrasil {
  const dono = l.universo === "detalhe" ? g.pmc.atividades[l.parteDe ?? ""]?.universo : l.universo;
  const universo: Universo = dono === "ampliado" ? "ampliado" : "restrito";
  const br = leituraBrasil(g, universo, i);
  return { universo, volume: diferenca(l.volume, br.volume[medida]), receita: diferenca(l.receita, br.receita[medida]) };
}

export type Difusao = { mes: string; total: number; alta: number; queda: number; estavel: number; semDado: number; linhas: LinhaAtividade[] };

/**
 * Difusão: quantas atividades do universo tiveram alta e quantas tiveram queda no mês, na medida e no indicador escolhidos. É
 * contagem, não contribuição: o IBGE não publica os pesos das atividades no SIDRA, e a gold não os estima.
 */
export function difusao(g: GoldSetor, universo: Universo, medida: Medida, indicador: Indicador, i: number = ultimoIndice(g)): Difusao {
  const linhas = atividadesDoUniverso(g, universo).map((s) => linhaAtividade(g, s, medida, i));
  const d = linhas.map((l) => direcao(l[indicador]));
  const conta = (x: string) => d.filter((y) => y === x).length;
  return { mes: g.pmc.meses[i], total: linhas.length, alta: conta("alta"), queda: conta("queda"), estavel: conta("estavel"), semDado: conta("ausente"), linhas };
}

/** Índice com ajuste sazonal dos últimos `n` meses de uma atividade, para a trajetória recente (lacuna continua lacuna). */
export function trajetoria(g: GoldSetor, bloco: BlocoPmc, indicador: Indicador, n = 24): { mes: string; valor: number | null }[] {
  const ult = ultimoIndice(g);
  const de = Math.max(0, ult - n + 1);
  return g.pmc.meses.slice(de, ult + 1).map((mes, j) => ({ mes, valor: v(bloco[indicador].indice_sa, de + j) }));
}

/* ------------------------------------------------------------------ estados */

export type LinhaUf = { uf: string; cod: string; nome: string; volume: number | null; receita: number | null; diferenca: number | null };

export function linhasUf(g: GoldSetor, universo: Universo, medida: Medida, i: number = ultimoIndice(g)): LinhaUf[] {
  const k = DEF_MEDIDA[medida].variavel;
  return Object.entries(g.pmc.ufs)
    .filter(([uf]) => UFS[uf])
    .map(([uf, b]) => {
      const volume = v(b[universo]?.volume[k], i);
      const receita = v(b[universo]?.receita[k], i);
      return { uf, cod: UFS[uf].cod, nome: UFS[uf].nome, volume, receita, diferenca: diferenca(receita, volume) };
    });
}

/** Da maior para a menor variação; estado sem valor vai para o fim, na ordem alfabética, nunca como zero. */
export function ordenarPor<T extends { nome: string }>(linhas: T[], valor: (l: T) => number | null): T[] {
  return [...linhas].sort((a, b) => {
    const x = valor(a);
    const y = valor(b);
    if (x === null && y === null) return a.nome.localeCompare(b.nome, "pt-BR");
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export const ufValida = (uf: string | null, g: GoldSetor = goldSetor()): string | null => (uf && UFS[uf.toUpperCase()] && g.pmc.ufs[uf.toUpperCase()] ? uf.toUpperCase() : null);

export type LinhaAtividadeUf = { slug: string; nomeCurto: string; volumeAa: number | null; volumeM12: number | null; receitaAa: number | null; receitaM12: number | null };

/** As atividades de um estado no único mês em que a gold as traz por UF (o último), interanual e em 12 meses. */
export function atividadesDaUf(g: GoldSetor, uf: string): LinhaAtividadeUf[] {
  const dados = g.pmc.ufs_atividades.dados[uf] ?? {};
  return Object.keys(g.pmc.atividades)
    .filter((s) => g.pmc.atividades[s].universo !== "detalhe")
    .map((slug) => {
      const d = dados[slug];
      const n = (x: number | null | undefined) => (typeof x === "number" && Number.isFinite(x) ? x : null);
      return { slug, nomeCurto: NOME_CURTO_ATIVIDADE[slug] ?? g.pmc.atividades[slug].nome, volumeAa: n(d?.volume?.aa), volumeM12: n(d?.volume?.m12), receitaAa: n(d?.receita?.aa), receitaM12: n(d?.receita?.m12) };
    });
}

/* ------------------------------------------------------------------ PAC */

export const CODIGO_PAC_VAREJO = "83337";
export const CODIGO_PAC_TOTAL = "83311";

/** O comércio varejista (divisão 47 da CNAE) na PAC. */
export const pacVarejo = (g: GoldSetor = goldSetor()): GrupoPac | null => g.pac.grupos[CODIGO_PAC_VAREJO] ?? null;

/** Os grupos de três dígitos do varejo (47.1 a 47.8), que somam a divisão 47. */
/** Nome curto de cada grupo de três dígitos, para o eixo do gráfico; o nome do IBGE fica na tabela. */
const CURTO_PAC: Record<string, string> = {
  "47.1": "Supermercados e lojas não especializadas",
  "47.2": "Alimentos, bebidas e fumo (lojas especializadas)",
  "47.3": "Combustíveis e lubrificantes",
  "47.4": "Material de construção",
  "47.5": "Informática, eletrodomésticos e artigos do lar",
  "47.6": "Artigos culturais, recreativos e esportivos",
  "47.7": "Farmácia, perfumaria e artigos médicos",
  "47.8": "Vestuário, calçados, gás de cozinha e outros",
};

export function gruposDoVarejo(g: GoldSetor = goldSetor()): (GrupoPac & { codigo: string; rotulo: string; curto: string })[] {
  return Object.entries(g.pac.grupos)
    .filter(([, x]) => /^47\.\d /.test(x.nome))
    .map(([codigo, x]) => ({ ...x, codigo, curto: CURTO_PAC[x.nome.slice(0, 4)] ?? x.nome, rotulo: x.nome.replace(/^47\.\d /, "").replace(/^Comércio (de |varejista )?/, "").replace(/^./, (c) => c.toUpperCase()) }));
}

export type Porte = { empresas: number | null; empresas20: number | null; parteEmpresas: number | null; pessoal: number | null; pessoal20: number | null; partePessoal: number | null };

/** O recorte de porte que a fonte permite: empresas com 20 ou mais pessoas ocupadas contra o total do comércio varejista. */
export function porteDoVarejo(g: GoldSetor = goldSetor()): Porte {
  const t = pacVarejo(g);
  const p = g.pac.porte_varejo;
  const parte = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? (100 * a) / b : null);
  return {
    empresas: t?.empresas ?? null, empresas20: p.empresas_20mais ?? null, parteEmpresas: parte(p.empresas_20mais, t?.empresas),
    pessoal: t?.pessoal_ocupado ?? null, pessoal20: p.pessoal_20mais ?? null, partePessoal: parte(p.pessoal_20mais, t?.pessoal_ocupado),
  };
}

/** Formas de comercialização (empresas com 20 ou mais pessoas), da maior para a menor, com a parte de cada uma no total das formas. */
export function formasDeComercializacao(g: GoldSetor = goldSetor()): { forma: string; curto: string; valor: number | null; parte: number | null }[] {
  const formas = g.pac.formas_comercializacao_20mais;
  const total = formas.reduce((s, f) => s + (f.receita_bruta_revenda ?? 0), 0);
  const curto = (f: string) => (f.startsWith("Lojas") ? "Lojas, postos e depósitos" : f.startsWith("Porta a porta") ? "Porta a porta e ambulantes" : f.startsWith("Quiosques") ? "Quiosques e trailers" : f);
  return [...formas]
    .sort((a, b) => (b.receita_bruta_revenda ?? -1) - (a.receita_bruta_revenda ?? -1))
    .map((f) => ({ forma: f.forma, curto: curto(f.forma), valor: f.receita_bruta_revenda, parte: f.receita_bruta_revenda != null && total > 0 ? (100 * f.receita_bruta_revenda) / total : null }));
}

/* ------------------------------------------------------------------ contexto macroeconômico */

export type PontoMacro = { mes: string; valor: number | null };

/** Uma série de contexto no período escolhido, com lacunas preservadas. */
export function serieMacro(g: GoldSetor, valores: Record<string, number | null> | undefined, periodo: Periodo): PontoMacro[] {
  const de = inicioDoPeriodo(g, periodo);
  return g.pmc.meses.slice(de, ultimoIndice(g) + 1).map((mes) => {
    const x = valores?.[mes];
    return { mes, valor: typeof x === "number" && Number.isFinite(x) ? x : null };
  });
}

/** O último ponto com valor de uma série de contexto. */
export function ultimoComValor(pontos: PontoMacro[]): PontoMacro | null {
  for (let i = pontos.length - 1; i >= 0; i--) if (pontos[i].valor !== null) return pontos[i];
  return null;
}

/* ------------------------------------------------------------------ companhias abertas (modelo dos R$ 100) */

export type PerfilCem = {
  slug: string;
  /** Tipo de negócio que a companhia ilustra. */
  perfil: string;
  empresa: string;
  exercicio: number;
  /** Partes de R$ 100 de receita líquida; valores positivos consomem a receita, negativos a devolvem (receita financeira líquida, crédito de imposto). */
  partes: { id: "custo" | "despesas" | "financeiro" | "impostos" | "outros" | "lucro"; rotulo: string; valor: number }[];
  documento: string | null;
};

/**
 * Companhias que ilustram seis tipos de negócio no modelo didático da entrada; em cada perfil vale a primeira com ponte publicada.
 * O tipo de cada uma é o segmento em que o ranking da curadoria a classifica (atacarejo e supermercado são formatos do segmento
 * alimentar). Não é amostra do segmento: é um caso real de cada tipo.
 */
export const PERFIS_DO_MODELO: { perfil: string; slugs: string[] }[] = [
  { perfil: "Atacarejo", slugs: ["assai", "grupo-mateus"] },
  { perfil: "Supermercado", slugs: ["gpa", "carrefour-brasil"] },
  { perfil: "Farmácia", slugs: ["rd-saude", "pague-menos", "panvel"] },
  { perfil: "Moda", slugs: ["lojas-renner", "cea", "guararapes"] },
  { perfil: "Eletromóveis", slugs: ["casas-bahia"] },
  { perfil: "Departamento", slugs: ["magazine-luiza", "americanas"] },
];

/** O último exercício anual com a ponte de R$ 100 calculada. */
export function ultimoComPonte(anuais: PeriodoEmpresa[]): PeriodoEmpresa | null {
  for (let i = anuais.length - 1; i >= 0; i--) if (anuais[i].ponte_100) return anuais[i];
  return null;
}

/** Os perfis do modelo, lidos de `ponte_100` da gold das companhias (CVM). Perfil sem companhia com ponte fica de fora. */
export function perfisDoModelo(e: GoldEmpresas = goldEmpresas()): PerfilCem[] {
  const saida: PerfilCem[] = [];
  for (const { perfil, slugs } of PERFIS_DO_MODELO) {
    for (const slug of slugs) {
      const emp = e.empresas[slug];
      const p = emp ? ultimoComPonte(emp.anuais) : null;
      if (!emp || !p?.ponte_100) continue;
      const b = p.ponte_100;
      saida.push({
        slug, perfil, empresa: emp.nome, exercicio: p.exercicio, documento: p.documento?.link ?? null,
        partes: [
          { id: "custo", rotulo: "Custo da mercadoria vendida", valor: -b.custo },
          { id: "despesas", rotulo: "Despesas de operação", valor: -b.despesas_operacionais },
          { id: "financeiro", rotulo: "Juros e resultado financeiro", valor: -b.resultado_financeiro },
          { id: "impostos", rotulo: "Imposto sobre o lucro", valor: -b.ir_csll },
          { id: "outros", rotulo: "Operações descontinuadas e outros", valor: -b.descontinuadas_e_outros },
          { id: "lucro", rotulo: "Lucro ou prejuízo", valor: b.lucro_liquido },
        ],
      });
      break;
    }
  }
  return saida;
}

/* ------------------------------------------------------------------ curadoria: segmentos */

/** Segmentos empresariais da curadoria que correspondem a uma atividade da PMC. */
export function segmentosDaAtividade(c: CuradoriaVarejo, slugAtividade: string): SegmentoCuradoria[] {
  return (c.segmentos?.segmentos ?? []).filter((s) => (s.atividades_pmc ?? []).includes(slugAtividade));
}

export type Selecao = { atividade: string | null; segmento: SegmentoCuradoria | null };

/** `?segmento=` aceita a atividade da PMC ou o segmento empresarial da curadoria; fora dos dois, nada selecionado. */
export function selecaoDeSegmento(g: GoldSetor, c: CuradoriaVarejo, pedido: string | null): Selecao {
  if (!pedido) return { atividade: null, segmento: null };
  if (g.pmc.atividades[pedido]) return { atividade: pedido, segmento: null };
  const s = (c.segmentos?.segmentos ?? []).find((x) => x.slug === pedido) ?? null;
  if (!s) return { atividade: null, segmento: null };
  const primeira = (s.atividades_pmc ?? []).find((a) => g.pmc.atividades[a]) ?? null;
  return { atividade: primeira, segmento: s };
}

/** Frase do resultado do mês para a abertura e o aperitivo: volume e receita no mês e em 12 meses, com as bases. */
export function fraseDoMes(g: GoldSetor, universo: Universo = "restrito"): string {
  const l = leituraBrasil(g, universo);
  return `volume ${variacao(l.volume.mm)} e receita nominal ${variacao(l.receita.mm)} ante o mês anterior, com ajuste sazonal; em 12 meses, ${variacao(l.volume.m12)} e ${variacao(l.receita.m12)}`;
}

/* ------------------------------------------------------------------ figuras do redesenho (24/11/2026) */

export type ContaDoCupom = {
  /** O que entra: os R$ 100 de venda líquida e, quando houver, linhas que devolveram dinheiro no ano (crédito de imposto, resultado financeiro positivo). */
  entradas: { id: PerfilCem["partes"][number]["id"] | "venda"; rotulo: string; valor: number }[];
  /** O que sai, na ordem da demonstração: custo, despesas, juros, imposto, outros. Só valores positivos. */
  saidas: { id: PerfilCem["partes"][number]["id"]; rotulo: string; valor: number }[];
  /** Lucro (positivo) ou prejuízo (negativo) por R$ 100 de venda. */
  resultado: number;
  /** Soma das saídas mais o lucro, quando há: o comprimento da barra de R$ 1 em R$ 1. */
  total: number;
};

/**
 * A conta do cupom de R$ 100: entradas de um lado, saídas do outro e o que sobra. As saídas mais o lucro fecham com as entradas;
 * com prejuízo, as saídas passam das entradas exatamente no valor dele. Parte menor que meio centavo fica de fora.
 */
export function contaDoCupom(p: PerfilCem): ContaDoCupom {
  const semLucro = p.partes.filter((x) => x.id !== "lucro" && Math.abs(x.valor) >= 0.005);
  const resultado = p.partes.find((x) => x.id === "lucro")?.valor ?? 0;
  const saidas = semLucro.filter((x) => x.valor > 0);
  const devolvidas = semLucro.filter((x) => x.valor < 0).map((x) => ({ id: x.id, rotulo: x.rotulo, valor: -x.valor }));
  return {
    entradas: [{ id: "venda", rotulo: "Venda líquida", valor: 100 }, ...devolvidas],
    saidas,
    resultado,
    total: saidas.reduce((s, x) => s + x.valor, 0) + Math.max(0, resultado),
  };
}

export type PontoTesoura = { mes: string; volume: number | null; receita: number | null; abertura: number | null };

/**
 * A "tesoura": volume e receita nominal em índice com ajuste sazonal, os dois levados a 100 no primeiro mês do período, para a
 * distância entre as linhas mostrar quanto a receita se afastou do volume desde então. É a razão entre o índice de cada mês e o do
 * mês-base, vezes 100: cálculo sobre os índices publicados, sem suavizar. Lacuna continua lacuna; sem o mês-base, tudo ausente.
 */
export function tesoura(g: GoldSetor, bloco: BlocoPmc | undefined, periodo: Periodo): PontoTesoura[] {
  const de = inicioDoPeriodo(g, periodo);
  const ate = ultimoIndice(g);
  const bv = v(bloco?.volume.indice_sa, de);
  const br = v(bloco?.receita.indice_sa, de);
  const saida: PontoTesoura[] = [];
  for (let i = de; i <= ate; i++) {
    const a = v(bloco?.volume.indice_sa, i);
    const b = v(bloco?.receita.indice_sa, i);
    const volume = a === null || !bv ? null : (100 * a) / bv;
    const receita = b === null || !br ? null : (100 * b) / br;
    saida.push({ mes: g.pmc.meses[i], volume, receita, abertura: volume === null || receita === null ? null : receita - volume });
  }
  return saida;
}

/** O último ponto da tesoura com os dois valores. */
export function fimDaTesoura(pontos: PontoTesoura[]): PontoTesoura | null {
  for (let i = pontos.length - 1; i >= 0; i--) if (pontos[i].volume !== null && pontos[i].receita !== null) return pontos[i];
  return null;
}

export type Mosaico = {
  meses: string[];
  linhas: { slug: string; nomeCurto: string; universo: AtividadePmc["universo"]; valores: (number | null)[] }[];
  /** Contagem de altas, quedas, estáveis e sem valor em cada mês (difusão), na mesma ordem de `meses`. */
  contagem: { alta: number; queda: number; estavel: number; semDado: number }[];
  /** Limite da escala de cor, em %: o percentil 90 do valor absoluto, arredondado para cima. Acima dele a cor satura e a legenda diz. */
  limite: number;
};

/**
 * Mosaico das atividades: uma linha por atividade do universo, uma coluna por mês desde janeiro de 2019, com a variação na medida e
 * no indicador escolhidos. A contagem de cada mês é a mesma da difusão (o mesmo seletor). Ausência segue null.
 */
export function mosaicoAtividades(g: GoldSetor, universo: Universo, medida: Medida, indicador: Indicador): Mosaico {
  const de = inicioDoPeriodo(g, "2019");
  const ate = ultimoIndice(g);
  const k = DEF_MEDIDA[medida].variavel;
  const slugs = atividadesDoUniverso(g, universo);
  const meses = g.pmc.meses.slice(de, ate + 1);
  const linhas = slugs.map((slug) => {
    const a = g.pmc.atividades[slug];
    return { slug, nomeCurto: NOME_CURTO_ATIVIDADE[slug] ?? a.nome, universo: a.universo, valores: meses.map((_, j) => v(a[indicador][k], de + j)) };
  });
  const contagem = meses.map((_, j) => {
    const d = difusao(g, universo, medida, indicador, de + j);
    return { alta: d.alta, queda: d.queda, estavel: d.estavel, semDado: d.semDado };
  });
  const abs = linhas.flatMap((l) => l.valores.filter((x): x is number => x !== null).map(Math.abs)).sort((a, b) => a - b);
  const p90 = abs.length ? abs[Math.min(abs.length - 1, Math.floor(0.9 * abs.length))] : 1;
  const degrau = p90 > 20 ? 10 : p90 > 6 ? 3 : 1.5;
  return { meses, linhas, contagem, limite: Math.max(degrau, Math.ceil(p90 / degrau) * degrau) };
}

export type ParteNoComercio = { id: "receita" | "empresas" | "pessoal"; rotulo: string; varejo: number | null; total: number | null; parte: number | null };

/** O comércio varejista (divisão 47) dentro do comércio total da PAC (veículos, atacado e varejo): receita, empresas e pessoas. */
export function varejoNoComercio(g: GoldSetor = goldSetor()): ParteNoComercio[] {
  const t = g.pac.grupos[CODIGO_PAC_TOTAL] ?? null;
  const r = pacVarejo(g);
  const de = (id: ParteNoComercio["id"], rotulo: string, campo: "receita_operacional_liquida" | "empresas" | "pessoal_ocupado"): ParteNoComercio => {
    const varejo = r?.[campo] ?? null;
    const total = t?.[campo] ?? null;
    return { id, rotulo, varejo, total, parte: varejo !== null && total ? (100 * varejo) / total : null };
  };
  return [de("receita", "Receita operacional líquida", "receita_operacional_liquida"), de("empresas", "Empresas", "empresas"), de("pessoal", "Pessoas ocupadas", "pessoal_ocupado")];
}

export type Haltere = LinhaAtividade & {
  /** Universo de referência da atividade e as variações do varejo desse universo no Brasil. */
  referencia: Universo;
  brasilVolume: number | null;
  brasilReceita: number | null;
  /** Volume da atividade menos o do Brasil, em pontos percentuais. */
  contraVolume: number | null;
};

/** As atividades principais (sem as de detalhe) para os halteres, da maior para a menor variação do volume, com a referência do Brasil. */
export function halteres(g: GoldSetor, medida: Medida, i: number = ultimoIndice(g)): Haltere[] {
  const linhas = linhasAtividades(g, medida, i).filter((l) => l.universo !== "detalhe");
  const ordenadas = ordenarPor(linhas.map((l) => ({ ...l, nome: l.nomeCurto })), (l) => l.volume);
  return ordenadas.map((l) => {
    const c = contraBrasil(g, l, medida, i);
    const br = leituraBrasil(g, c.universo, i);
    return { ...l, referencia: c.universo, brasilVolume: br.volume[medida], brasilReceita: br.receita[medida], contraVolume: c.volume };
  });
}

export type Etiqueta = {
  slug: string;
  nome: string;
  /** A primeira frase de "o que se vende", da curadoria. */
  vende: string | null;
  /** A atividade da PMC que dá o número e a trajetória; null quando o segmento não tem equivalente na pesquisa. */
  atividade: string | null;
  equivalencia: SegmentoCuradoria["equivalencia"];
  volume: number | null;
  receita: number | null;
  trajetoria: { mes: string; valor: number | null }[];
};

/** Os segmentos da curadoria como etiquetas de gôndola: nome, o que se vende, o número da primeira atividade equivalente e a trajetória dela. */
export function etiquetasDeSegmento(g: GoldSetor, c: CuradoriaVarejo, medida: Medida, i: number = ultimoIndice(g)): Etiqueta[] {
  return (c.segmentos?.segmentos ?? []).map((s) => {
    // a atividade principal antes da de detalhe: o número da etiqueta é o do agregado que a pesquisa publica com série ajustada
    const equivalentes = (s.atividades_pmc ?? []).filter((a) => g.pmc.atividades[a]);
    const atividade = equivalentes.find((a) => g.pmc.atividades[a].universo !== "detalhe") ?? equivalentes[0] ?? null;
    const l = atividade ? linhaAtividade(g, atividade, medida, i) : null;
    const frase = typeof s.o_que_se_vende === "string" ? s.o_que_se_vende.trim().split(/(?<=[.:])\s/)[0].replace(/[.:]$/, "") : "";
    return {
      slug: s.slug, nome: s.nome, vende: frase || null, atividade, equivalencia: s.equivalencia,
      volume: l?.volume ?? null, receita: l?.receita ?? null,
      trajetoria: atividade ? trajetoria(g, g.pmc.atividades[atividade], "volume") : [],
    };
  });
}

/** Tipos de comércio varejista da PAC, do maior para o menor em receita, com a parte de cada um na receita do comércio varejista. */
export function tiposDeComercio(g: GoldSetor = goldSetor()): { codigo: string; rotulo: string; curto: string; receita: number | null; parte: number | null; empresas: number | null; pessoal: number | null; taxaMargem: number | null }[] {
  const total = pacVarejo(g)?.receita_operacional_liquida ?? null;
  return [...gruposDoVarejo(g)]
    .sort((a, b) => (b.receita_operacional_liquida ?? -1) - (a.receita_operacional_liquida ?? -1))
    .map((x) => ({ codigo: x.codigo, rotulo: x.rotulo, curto: x.curto, receita: x.receita_operacional_liquida, parte: x.receita_operacional_liquida !== null && total ? (100 * x.receita_operacional_liquida) / total : null, empresas: x.empresas, pessoal: x.pessoal_ocupado, taxaMargem: x.taxa_margem }));
}

export type LinhaDeIndicador = { id: string; nome: string; valor: number; /** Exercício ou ano do valor. */ periodo: string; estimado?: boolean; referencia?: boolean };
export type FiguraDeIndicador = { titulo: string; unidade: string; casas: number; fonte: string; linhas: LinhaDeIndicador[] };

/** A taxa de margem de comercialização (PAC) dos grupos da pesquisa anual ligados ao segmento, com o comércio varejista como referência. */
export function taxaDeMargemDoSegmento(s: SegmentoCuradoria, g: GoldSetor): FiguraDeIndicador | null {
  const ano = String(g.pac.ano);
  const linhas: LinhaDeIndicador[] = (s.classes_pac_ids ?? [])
    .map((id) => ({ id, x: g.pac.grupos[id] }))
    .filter((r) => r.x && typeof r.x.taxa_margem === "number")
    .map((r) => ({ id: r.id, nome: r.x.nome.replace(/^[\d.+ ]+/, "").replace(/^Comércio (de |em |varejista )?/, "").replace(/^./, (ch) => ch.toUpperCase()), valor: r.x.taxa_margem as number, periodo: ano }));
  if (!linhas.length) return null;
  const varejo = pacVarejo(g);
  if (typeof varejo?.taxa_margem === "number" && !linhas.some((l) => l.id === CODIGO_PAC_VAREJO)) linhas.push({ id: CODIGO_PAC_VAREJO, nome: "Comércio varejista, total", valor: varejo.taxa_margem, periodo: ano, referencia: true });
  return { titulo: "Taxa de margem de comercialização", unidade: "% sobre o custo das mercadorias revendidas", casas: 1, fonte: `IBGE, Pesquisa Anual de Comércio ${ano}`, linhas };
}

/**
 * O indicador operacional que a curadoria manda acompanhar no segmento, calculado quando a fórmula dela usa só o que as golds e o
 * ranking trazem: giro de estoque, margem bruta e resultado financeiro sobre a receita (demonstrações da CVM, último exercício de
 * cada companhia que a curadoria lista), venda por loja (ranking: venda ÷ lojas dos grupos do segmento) e taxa de margem de
 * comercialização (PAC). Indicador com outra fórmula, ou sem dado para nenhuma empresa, devolve null: a ficha mostra só o texto.
 */
export function indicadorDoSegmento(s: SegmentoCuradoria, g: GoldSetor, e: GoldEmpresas, c: CuradoriaVarejo): FiguraDeIndicador | null {
  const io = s.indicador_operacional;
  const nome = (io?.nome ?? "").toLowerCase();
  if (!io || !nome) return null;
  const cvm = "CVM, Demonstrações Financeiras Padronizadas; cálculo da Scrutiniums";
  const n = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const dasCompanhias = (calc: (p: PeriodoEmpresa) => number | null): LinhaDeIndicador[] =>
    (io.empresas ?? []).flatMap((slug) => {
      const emp = e.empresas[slug];
      if (!emp) return [];
      for (let i = emp.anuais.length - 1; i >= 0; i--) {
        const valor = calc(emp.anuais[i]);
        if (valor !== null) return [{ id: slug, nome: emp.nome, valor, periodo: String(emp.anuais[i].exercicio) }];
      }
      return [];
    });
  const fechar = (unidade: string, casas: number, fonte: string, linhas: LinhaDeIndicador[]): FiguraDeIndicador | null => (linhas.length ? { titulo: io.nome, unidade, casas, fonte, linhas: [...linhas].sort((a, b) => b.valor - a.valor) } : null);
  if (nome.includes("giro de estoque")) return fechar("vezes ao ano", 1, cvm, dasCompanhias((p) => { const custo = n(p.custo); const est = n(p.estoques); return custo !== null && est ? Math.abs(custo) / est : null; }));
  if (nome.includes("margem bruta")) return fechar("% da receita líquida", 1, cvm, dasCompanhias((p) => n(p.margem_bruta_pct) ?? (n(p.lucro_bruto) !== null && n(p.receita_liquida) ? (100 * (p.lucro_bruto as number)) / (p.receita_liquida as number) : null)));
  if (nome.includes("resultado financeiro")) return fechar("% da receita líquida", 1, cvm, dasCompanhias((p) => (n(p.resultado_financeiro) !== null && n(p.receita_liquida) ? (100 * (p.resultado_financeiro as number)) / (p.receita_liquida as number) : null)));
  if (nome.includes("venda por")) {
    const ano = c.ranking?.fonte?.exercicio ? String(c.ranking.fonte.exercicio) : "exercício não informado";
    const linhas = (c.ranking?.grupos ?? [])
      .filter((x) => x.segmento === s.slug && typeof x.vendas_milhoes === "number" && typeof x.lojas === "number" && x.lojas > 0)
      .map((x) => ({ id: x.slug, nome: x.grupo, valor: (x.vendas_milhoes as number) / (x.lojas as number), periodo: ano, estimado: x.natureza === "estimado_pela_fonte" }));
    return fechar("R$ milhões por loja", 1, "IRTT, Top 300 do Varejo Brasileiro (venda bruta ÷ lojas); cálculo da Scrutiniums", linhas);
  }
  if (nome.includes("taxa de margem")) return taxaDeMargemDoSegmento(s, g);
  return null;
}
