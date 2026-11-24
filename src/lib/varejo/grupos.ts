/**
 * Seletores dos grupos do Varejo: o ranking dos 20 maiores (IRTT Top 300, na curadoria), a busca por marca, a participação na
 * amostra, as fichas e a ligação de cada grupo com a companhia aberta (gold da CVM) e com o segmento. Como em dados.ts, cada
 * número tem um seletor só: o gráfico, a tabela, a frase e o CSV leem a mesma função. Nada aqui lê arquivo: a curadoria e a
 * gold chegam por parâmetro, e campo ausente segue ausente (null, lista vazia), nunca vira zero.
 */
import { normalizar } from "@/lib/busca/normalizar";
import { hrefComRecorte } from "@/lib/painel/recorte";
import type { Natureza } from "@/lib/painel/tipos";
import { paginaVarejo, ROTA_SEGMENTOS } from "./paginas";
import type { CuradoriaVarejo, EmpresaGold, FichaCuradoria, FonteCuradoria, GoldEmpresas, GrupoRanking, Operacional, PeriodoEmpresa, ValorOperacional } from "./tipos";

export const ROTA_GRUPOS = paginaVarejo("grupos").href;
export const ROTA_COMPARADOR = paginaVarejo("comparador").href;
export const ROTA_GRUPOS_CSV = `${ROTA_GRUPOS}.csv`;
export const hrefFicha = (slug: string, de?: string | null) => hrefComRecorte(`${ROTA_GRUPOS}/${slug}`, { de: de || null });

/* ------------------------------------------------------------------ natureza do dado */

export type NaturezaCurada = "divulgado" | "estimado_pela_fonte" | "calculado" | "nao_informada";

export function naturezaCurada(v: unknown): NaturezaCurada {
  return v === "divulgado" || v === "estimado_pela_fonte" || v === "calculado" ? v : "nao_informada";
}

/** Rótulo escrito por extenso: a marca nunca depende de cor. */
export const ROTULO_NATUREZA: Record<NaturezaCurada, string> = {
  divulgado: "divulgado",
  estimado_pela_fonte: "estimado pela fonte",
  calculado: "calculado",
  nao_informada: "natureza não informada",
};

/** A natureza da curadoria no vocabulário do kit de painel (selo do número e da figura). */
export const naturezaDoKit = (n: NaturezaCurada): Natureza => (n === "estimado_pela_fonte" ? "ESTIMADO" : n === "calculado" ? "CALCULADO" : "OBSERVADO");

/* ------------------------------------------------------------------ segmentos do ranking */

/** Nome curto de cada segmento da curadoria, para filtro, tabela e eixo; o nome da fonte (segmento_irtt) fica na tabela e no CSV. */
export const SEGMENTO_CURTO: Record<string, string> = {
  alimentar: "Alimentar",
  "farmacia-beleza": "Farmácia e beleza",
  eletromoveis: "Eletromóveis",
  departamento: "Departamento",
  moda: "Moda",
  foodservice: "Restaurantes",
  digital: "Digital",
  construcao: "Material de construção",
  outros: "Outros",
};

export const nomeDoSegmento = (slug: string | undefined | null): string => (slug ? SEGMENTO_CURTO[slug] ?? slug : "não informado");

/** O segmento existe na página de segmentos (curadoria de segmentos)? Só então a ficha liga para lá. */
export function hrefDoSegmento(c: CuradoriaVarejo, slug: string | undefined | null): string | null {
  if (!slug || !(c.segmentos?.segmentos ?? []).some((s) => s.slug === slug)) return null;
  return `${hrefComRecorte(ROTA_SEGMENTOS, { segmento: slug })}#segmento`;
}

/* ------------------------------------------------------------------ ranking */

export type LinhaRanking = GrupoRanking & {
  natureza_dado: NaturezaCurada;
  /** Vendas do grupo ÷ soma das vendas dos grupos listados × 100. Não é participação de mercado. */
  participacao_na_amostra: number | null;
  tem_ficha: boolean;
};

export type Amostra = {
  /** Grupos listados. */
  n: number;
  /** Soma das vendas dos grupos listados, em R$ milhões (inclui as estimativas da fonte). */
  total_milhoes: number;
  estimados: number;
  estimado_milhoes: number;
  divulgados: number;
  sem_valor: number;
};

/** O denominador da participação: a soma dos grupos listados, com a parte que é estimativa da fonte dita à parte. */
export function amostraDoRanking(c: CuradoriaVarejo): Amostra {
  const grupos = c.ranking?.grupos ?? [];
  const comValor = grupos.filter((g) => typeof g.vendas_milhoes === "number");
  const est = comValor.filter((g) => naturezaCurada(g.natureza) === "estimado_pela_fonte");
  const soma = (l: GrupoRanking[]) => l.reduce((s, g) => s + (g.vendas_milhoes as number), 0);
  return { n: grupos.length, total_milhoes: soma(comValor), estimados: est.length, estimado_milhoes: soma(est), divulgados: comValor.filter((g) => naturezaCurada(g.natureza) === "divulgado").length, sem_valor: grupos.length - comValor.length };
}

/** O ranking como publicado (ordem da fonte), com a natureza normalizada, a participação na amostra e se há ficha. */
export function linhasDoRanking(c: CuradoriaVarejo): LinhaRanking[] {
  const a = amostraDoRanking(c);
  return [...(c.ranking?.grupos ?? [])]
    .sort((x, y) => x.posicao - y.posicao)
    .map((g) => ({
      ...g,
      natureza_dado: naturezaCurada(g.natureza),
      participacao_na_amostra: typeof g.vendas_milhoes === "number" && a.total_milhoes > 0 ? (100 * g.vendas_milhoes) / a.total_milhoes : null,
      tem_ficha: Boolean(c.fichas[g.slug]),
    }));
}

export const ORDENS = ["posicao", "crescimento", "lojas", "nome"] as const;
export type Ordem = (typeof ORDENS)[number];
export const NOME_ORDEM: Record<Ordem, string> = { posicao: "Posição na fonte", crescimento: "Crescimento", lojas: "Lojas", nome: "Nome" };

/** Reordena sem mexer na posição publicada: valor ausente vai para o fim, nunca conta como zero. */
export function ordenarRanking(linhas: LinhaRanking[], ordem: Ordem): LinhaRanking[] {
  if (ordem === "posicao") return [...linhas].sort((a, b) => a.posicao - b.posicao);
  if (ordem === "nome") return [...linhas].sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR"));
  const valor = (l: LinhaRanking) => (ordem === "crescimento" ? crescimentoDe(l) : l.lojas ?? null);
  return [...linhas].sort((a, b) => {
    const x = valor(a);
    const y = valor(b);
    if (x === null && y === null) return a.posicao - b.posicao;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || a.posicao - b.posicao;
  });
}

/** Crescimento com uma casa, calculado das duas vendas publicadas; sem as duas, o percentual impresso pela fonte (sem casa decimal). */
export function crescimentoDe(g: GrupoRanking): number | null {
  if (typeof g.vendas_milhoes === "number" && typeof g.vendas_ano_anterior_milhoes === "number" && g.vendas_ano_anterior_milhoes > 0) return Number(((100 * g.vendas_milhoes) / g.vendas_ano_anterior_milhoes - 100).toFixed(1));
  return typeof g.crescimento_pct === "number" ? g.crescimento_pct : null;
}

export const segmentosDoRanking = (c: CuradoriaVarejo): string[] => Array.from(new Set((c.ranking?.grupos ?? []).map((g) => g.segmento).filter((s): s is string => Boolean(s))));

/** Fonte curta do ranking, para a prova de cada número: "IRTT, Top 300 do Varejo Brasileiro, edição 2026". */
export function fonteDoRanking(c: CuradoriaVarejo): string {
  const f = c.ranking?.fonte;
  const edicao = /\d{4}/.exec(String(f?.edicao ?? ""))?.[0];
  return `IRTT, Top 300 do Varejo Brasileiro${edicao ? `, edição ${edicao}` : ""}`;
}

export const exercicioDoRanking = (c: CuradoriaVarejo): string => (c.ranking?.fonte?.exercicio ? String(c.ranking.fonte.exercicio) : "exercício não informado");

/* ------------------------------------------------------------------ busca por marca ou grupo */

export type AchadoGrupo = {
  slug: string;
  grupo: string;
  /** Posição no ranking; null quando o grupo tem ficha e não está no ranking (Mercado Livre). */
  posicao: number | null;
  /** Bandeiras cujo nome casa com a busca (vazio quando casou pelo nome do grupo). */
  bandeiras: string[];
  controlador: string | null;
};

export type AchadoCompanhia = { slug: string; nome: string };

export type ResultadoBusca = { termo: string; grupos: AchadoGrupo[]; companhias: AchadoCompanhia[] };

/** As bandeiras de um grupo: as do ranking e as da ficha, sem repetir (a ficha detalha mais; o ranking traz o nome que a fonte usa). */
export function bandeirasDoGrupo(c: CuradoriaVarejo, slug: string): string[] {
  const doRanking = (c.ranking?.grupos ?? []).find((g) => g.slug === slug)?.bandeiras ?? [];
  const daFicha = (c.fichas[slug]?.bandeiras ?? []).map((b) => b.nome);
  const vistos = new Set<string>();
  return [...doRanking, ...daFicha].filter((b) => {
    const k = normalizar(b);
    if (!b || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/**
 * Busca por marca ou grupo: devolve o grupo dono da bandeira no exercício do ranking, com o controlador que a ficha registra.
 * Compara sem acento e sem caixa; o termo precisa de pelo menos duas letras. Uma bandeira dividida entre dois grupos (Extra)
 * devolve os dois. Companhia aberta da gold sem ficha (fora do Top 20) vem à parte, com o caminho do comparador.
 */
export function buscarGrupos(c: CuradoriaVarejo, e: GoldEmpresas, pedido: string | null): ResultadoBusca | null {
  const termo = (pedido ?? "").trim().slice(0, 60);
  const alvo = normalizar(termo);
  if (alvo.length < 2) return null;
  const casa = (texto: string) => normalizar(texto).includes(alvo);
  const slugs = Array.from(new Set([...(c.ranking?.grupos ?? []).map((g) => g.slug), ...Object.keys(c.fichas)]));
  const grupos: AchadoGrupo[] = [];
  for (const slug of slugs) {
    const noRanking = (c.ranking?.grupos ?? []).find((g) => g.slug === slug);
    const ficha = c.fichas[slug];
    const grupo = noRanking?.grupo ?? ficha?.grupo ?? slug;
    const bandeiras = bandeirasDoGrupo(c, slug).filter(casa);
    if (!bandeiras.length && !casa(grupo)) continue;
    grupos.push({ slug, grupo, posicao: noRanking?.posicao ?? null, bandeiras, controlador: ficha?.controlador?.nome?.trim() || null });
  }
  grupos.sort((a, b) => (a.posicao ?? 999) - (b.posicao ?? 999));
  const comFicha = new Set(slugs.map((s) => c.fichas[s]?.empresa_gold ?? (c.ranking?.grupos ?? []).find((g) => g.slug === s)?.empresa_gold).filter(Boolean));
  const companhias = Object.entries(e.empresas)
    .filter(([slug, x]) => !comFicha.has(slug) && (casa(x.nome) || casa(x.denominacao_cvm)))
    .map(([slug, x]) => ({ slug, nome: x.nome }));
  return { termo, grupos, companhias };
}

/* ------------------------------------------------------------------ fichas */

export const slugsDasFichas = (c: CuradoriaVarejo): string[] => Object.keys(c.fichas).sort();

const lista = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A ficha com as listas garantidas (campo ausente vira lista vazia) e os textos aparados; null quando o slug não existe. */
export function fichaDoGrupo(c: CuradoriaVarejo, slug: string): (FichaCuradoria & Required<Pick<FichaCuradoria, "bandeiras" | "formatos" | "canais" | "fontes_de_receita" | "concorrentes" | "operacionais" | "eventos" | "campos_sem_divulgacao" | "fontes">>) | null {
  const f = Object.prototype.hasOwnProperty.call(c.fichas, slug) ? c.fichas[slug] : null;
  if (!f) return null;
  return {
    ...f,
    bandeiras: lista(f.bandeiras).filter((b) => txt(b?.nome)),
    formatos: lista(f.formatos).filter((x) => txt(x)),
    canais: lista(f.canais).filter((x) => txt(x)),
    fontes_de_receita: lista(f.fontes_de_receita).filter((x) => txt(x?.nome)),
    concorrentes: lista(f.concorrentes).filter((x) => txt(x?.nome)),
    operacionais: lista(f.operacionais).filter((x) => txt(x?.indicador)),
    eventos: lista(f.eventos).filter((x) => txt(x?.descricao)),
    campos_sem_divulgacao: lista(f.campos_sem_divulgacao).filter((x) => txt(x)),
    fontes: lista(f.fontes).filter((x) => txt(x?.titulo) || txt(x?.nome)),
  };
}

/** A companhia aberta da ficha na gold da CVM; null quando o grupo é fechado ou a gold não a tem. */
export function empresaDaFicha(e: GoldEmpresas, f: Pick<FichaCuradoria, "empresa_gold">): EmpresaGold | null {
  const slug = f.empresa_gold;
  return slug && Object.prototype.hasOwnProperty.call(e.empresas, slug) ? e.empresas[slug] : null;
}

export const TIPO_EVENTO: Record<string, string> = {
  aquisicao: "Aquisição",
  desinvestimento: "Desinvestimento",
  reapresentacao: "Reapresentação",
  recuperacao_judicial: "Recuperação judicial",
  fechamento_de_capital: "Fechamento de capital",
  mudanca_de_controle: "Mudança de controle",
  outro: "Outro evento",
};

/** Eventos do mais recente para o mais antigo; evento sem data vai para o fim. */
export function eventosOrdenados<T extends { data?: string }>(eventos: T[]): T[] {
  return [...eventos].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
}

export const CAPITAL: Record<string, string> = { aberto: "Capital aberto (ações na bolsa brasileira)", fechado: "Capital fechado", "aberto no exterior": "Capital aberto no exterior" };

/**
 * Valor de um indicador operacional num exercício: o período escrito como o ano ("2025") ou como o fim dele ("dez/2025"), que é
 * como a curadoria registra fluxos e saldos. Trimestre isolado não vale por exercício.
 */
export function valorOperacional(f: Pick<FichaCuradoria, "operacionais"> | null, padrao: RegExp, ano: number): { o: Operacional; v: ValorOperacional } | null {
  const periodos = [String(ano), `dez/${ano}`];
  for (const o of f?.operacionais ?? []) {
    if (!padrao.test(o.indicador)) continue;
    const v = (o.valores ?? []).find((x) => periodos.includes(x.periodo ?? "") && typeof x.valor === "number");
    if (v) return { o, v };
  }
  return null;
}

/* ------------------------------------------------------------------ demonstrações da ficha */

export type IndicadorFicha = {
  id: string;
  rotulo: string;
  /** "R$ bilhões" ou "%". */
  unidade: "R$ bilhões" | "%";
  casas: number;
  valor: (p: PeriodoEmpresa) => number | null;
  natureza: Natureza;
  nota?: string;
};

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const bi = (v: unknown): number | null => (n(v) === null ? null : (n(v) as number) / 1e9);

/** Os indicadores que a ficha mostra, um gráfico pequeno por indicador. Investimento sai positivo (a gold o traz como saída de caixa). */
export const INDICADORES_FICHA: IndicadorFicha[] = [
  { id: "receita", rotulo: "Receita líquida", unidade: "R$ bilhões", casas: 1, valor: (p) => bi(p.receita_liquida), natureza: "OBSERVADO" },
  { id: "margem-bruta", rotulo: "Margem bruta", unidade: "%", casas: 1, valor: (p) => n(p.margem_bruta_pct), natureza: "CALCULADO" },
  { id: "margem-operacional", rotulo: "Margem operacional", unidade: "%", casas: 1, valor: (p) => n(p.margem_operacional_pct), natureza: "CALCULADO" },
  { id: "lucro", rotulo: "Lucro líquido", unidade: "R$ bilhões", casas: 2, valor: (p) => bi(p.lucro_liquido), natureza: "OBSERVADO" },
  { id: "caixa", rotulo: "Caixa operacional", unidade: "R$ bilhões", casas: 1, valor: (p) => bi(p.caixa_operacional), natureza: "OBSERVADO" },
  { id: "investimentos", rotulo: "Investimentos", unidade: "R$ bilhões", casas: 2, valor: (p) => (n(p.capex) === null ? null : Math.abs(n(p.capex) as number) / 1e9), natureza: "CALCULADO" },
];

export const dividaLiquida = (p: PeriodoEmpresa | null): number | null => bi(p?.divida_liquida_sem_arrendamento);
export const passivoArrendamento = (p: PeriodoEmpresa | null): number | null => bi(p?.passivo_arrendamento);

/** Os exercícios que a gold cobre, do mais antigo ao mais recente (até cinco). Exercício sem demonstração segue na lista, como lacuna. */
export const exerciciosDaGold = (e: GoldEmpresas): number[] => [...(e.fontes.dfp.exercicios ?? [])].sort((a, b) => a - b).slice(-5);

export const periodoDe = (emp: EmpresaGold | null | undefined, ano: number): PeriodoEmpresa | null => emp?.anuais.find((a) => a.exercicio === ano) ?? null;

export const ultimoExercicio = (emp: EmpresaGold | null | undefined): PeriodoEmpresa | null => (emp?.anuais.length ? emp.anuais[emp.anuais.length - 1] : null);

/** Exercícios em que o exercício seguinte reapresentou receita ou lucro com valor diferente do publicado. */
export function reapresentacoes(emp: EmpresaGold): { exercicio: number; campo: "Receita líquida" | "Lucro líquido"; publicado: number | null; reapresentado: number | null }[] {
  const saida: ReturnType<typeof reapresentacoes> = [];
  for (const a of emp.anuais) {
    const r = a.reapresentado_no_exercicio_seguinte;
    if (!r) continue;
    if (r.receita_liquida !== a.receita_liquida) saida.push({ exercicio: a.exercicio, campo: "Receita líquida", publicado: a.receita_liquida, reapresentado: r.receita_liquida });
    if (r.lucro_liquido !== a.lucro_liquido) saida.push({ exercicio: a.exercicio, campo: "Lucro líquido", publicado: a.lucro_liquido, reapresentado: r.lucro_liquido });
  }
  return saida;
}

/* ------------------------------------------------------------------ fontes */

export const tituloDaFonte = (f: FonteCuradoria | undefined | null): string | null => txt(f?.titulo) ?? txt(f?.nome);

/**
 * Endereço externo que pode virar link: só http(s). Os dados abertos da CVM trazem o link do documento em http; o mesmo
 * endereço responde em https (conferido em 23/11/2026), e é assim que a página o abre.
 */
export const urlSegura = (u: unknown): string | null => (typeof u === "string" && /^https?:\/\//.test(u.trim()) ? u.trim().replace(/^http:\/\/(www\.)?rad\.cvm\.gov\.br\//, "https://www.rad.cvm.gov.br/") : null);

/* ------------------------------------------------------------------ volta ao ranking */

export const PADRAO_GRUPOS = { ordem: "posicao" } as const;

/** O recorte do ranking (`q`, `segmento`, `ordem`) numa string só, para viajar no `?de=` da ficha e voltar intacto. */
export function recorteParaLevar(r: { q?: string | null; segmento?: string | null; ordem?: string | null }): string {
  const q = new URLSearchParams();
  if (r.q) q.set("q", r.q);
  if (r.segmento) q.set("segmento", r.segmento);
  if (r.ordem && r.ordem !== PADRAO_GRUPOS.ordem) q.set("ordem", r.ordem);
  return q.toString();
}

/** O link de volta ao ranking a partir do `?de=` da ficha: só os parâmetros conhecidos passam, com valores aparados. */
export function voltaAoRanking(de: string | null): string {
  const origem = new URLSearchParams(de ?? "");
  const ordem = origem.get("ordem");
  const q = recorteParaLevar({
    q: (origem.get("q") ?? "").trim().slice(0, 60) || null,
    segmento: /^[a-z-]{2,30}$/.test(origem.get("segmento") ?? "") ? origem.get("segmento") : null,
    ordem: (ORDENS as readonly string[]).includes(ordem ?? "") ? ordem : null,
  });
  return `${ROTA_GRUPOS}${q ? `?${q}` : ""}#ranking`;
}
