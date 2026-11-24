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

/* ------------------------------------------------------------------ figuras do redesenho dos grupos (24/11/2026) */

/** Nome curto de uma companhia para a placa tipográfica e os rótulos de figura: sem "Grupo", "Supermercados" e "Brasil" nas pontas. */
export function nomeCurtoDoGrupo(nome: string): string {
  const curto = nome.replace(/\s*\(.*\)\s*$/, "").replace(/^(Grupo|Supermercados|Lojas)\s+/i, "").replace(/\s+Brasil$/i, "").trim();
  return curto || nome;
}

export type BlocoDeTamanho = { slug: string; grupo: string; posicao: number; vendas_milhoes: number; participacao: number; natureza: NaturezaCurada; tem_ficha: boolean };
export type SegmentoDeTamanho = { segmento: string; nome: string; vendas_milhoes: number; participacao: number; blocos: BlocoDeTamanho[] };

/**
 * "O tamanho de cada grupo": os grupos com venda publicada, reunidos por segmento, do maior segmento para o menor e, dentro dele,
 * do maior grupo para o menor. A participação é sempre sobre a soma dos grupos listados (amostraDoRanking), nunca sobre o mercado;
 * as dos segmentos somam 100% e a de cada segmento é a soma das dos seus grupos. Grupo sem venda publicada não entra no desenho
 * (a página o lista à parte).
 */
export function tamanhosPorSegmento(c: CuradoriaVarejo): SegmentoDeTamanho[] {
  const porSegmento = new Map<string, BlocoDeTamanho[]>();
  for (const l of linhasDoRanking(c)) {
    if (typeof l.vendas_milhoes !== "number" || l.participacao_na_amostra === null) continue;
    const s = l.segmento ?? "outros";
    porSegmento.set(s, [...(porSegmento.get(s) ?? []), { slug: l.slug, grupo: l.grupo, posicao: l.posicao, vendas_milhoes: l.vendas_milhoes, participacao: l.participacao_na_amostra, natureza: l.natureza_dado, tem_ficha: l.tem_ficha }]);
  }
  return Array.from(porSegmento, ([segmento, blocos]) => ({
    segmento,
    nome: nomeDoSegmento(segmento),
    vendas_milhoes: blocos.reduce((s, b) => s + b.vendas_milhoes, 0),
    participacao: blocos.reduce((s, b) => s + b.participacao, 0),
    blocos: [...blocos].sort((a, b) => b.vendas_milhoes - a.vendas_milhoes || a.posicao - b.posicao),
  })).sort((a, b) => b.vendas_milhoes - a.vendas_milhoes);
}

export type Movimento = {
  slug: string;
  grupo: string;
  segmento: string | null;
  atual: number;
  /** Posição no ranking do exercício anterior; null quando a fonte não a publica (sem base de comparação). */
  anterior: number | null;
  /** Posições ganhas (positivo: subiu) ou perdidas (negativo); null sem a posição anterior. */
  ganho: number | null;
  natureza: NaturezaCurada;
  tem_ficha: boolean;
};

/** "Quem subiu e quem desceu": a posição publicada no exercício e a do anterior, com as posições ganhas. Ordem da fonte. */
export function movimentosDoRanking(c: CuradoriaVarejo): Movimento[] {
  return linhasDoRanking(c).map((l) => {
    const anterior = typeof l.posicao_anterior === "number" && l.posicao_anterior > 0 ? l.posicao_anterior : null;
    return { slug: l.slug, grupo: l.grupo, segmento: l.segmento ?? null, atual: l.posicao, anterior, ganho: anterior === null ? null : anterior - l.posicao, natureza: l.natureza_dado, tem_ficha: l.tem_ficha };
  });
}

/** O maior deslocamento, em posições, entre os grupos com posição anterior (0 quando ninguém se moveu ou não há base). */
export const maiorMovimento = (m: readonly Movimento[]): number => Math.max(0, ...m.map((x) => Math.abs(x.ganho ?? 0)));

export type ModeloDeLoja = {
  slug: string;
  grupo: string;
  segmento: string | null;
  vendas_milhoes: number | null;
  lojas: number | null;
  /** Venda do exercício ÷ lojas no fim do exercício, em R$ milhões por loja; null sem um dos dois. */
  venda_por_loja_milhoes: number | null;
  natureza: NaturezaCurada;
  tem_ficha: boolean;
};

/** Vendas × lojas de cada grupo e a venda por loja (conta desta página sobre dois valores da fonte). Ausência segue ausência. */
export function modelosDeLoja(c: CuradoriaVarejo): ModeloDeLoja[] {
  return linhasDoRanking(c).map((l) => {
    const vendas = typeof l.vendas_milhoes === "number" ? l.vendas_milhoes : null;
    const lojas = typeof l.lojas === "number" && l.lojas > 0 ? l.lojas : null;
    return { slug: l.slug, grupo: l.grupo, segmento: l.segmento ?? null, vendas_milhoes: vendas, lojas, venda_por_loja_milhoes: vendas !== null && lojas !== null ? vendas / lojas : null, natureza: l.natureza_dado, tem_ficha: l.tem_ficha };
  });
}

export type ParteDoCrescimento = { id: "vendas" | "lojas" | "venda_por_loja"; rotulo: string; atual: number | null; anterior: number | null; variacao_pct: number | null };

const varPct = (atual: number | null, anterior: number | null): number | null => (atual === null || anterior === null || anterior <= 0 ? null : (100 * atual) / anterior - 100);

/**
 * Decomposição do crescimento de um grupo entre o exercício anterior e o do ranking: vendas, lojas e venda por loja, cada uma com a
 * variação percentual. As três fecham por multiplicação, (1 + vendas) = (1 + lojas) × (1 + venda por loja), não por soma. Sem um dos
 * quatro valores da fonte, a parte que depende dele fica ausente.
 */
export function decomposicaoDoCrescimento(g: Pick<GrupoRanking, "vendas_milhoes" | "vendas_ano_anterior_milhoes" | "lojas" | "lojas_ano_anterior"> | null): ParteDoCrescimento[] {
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const v1 = num(g?.vendas_milhoes), v0 = num(g?.vendas_ano_anterior_milhoes), l1 = num(g?.lojas), l0 = num(g?.lojas_ano_anterior);
  const p1 = v1 !== null && l1 !== null ? v1 / l1 : null;
  const p0 = v0 !== null && l0 !== null ? v0 / l0 : null;
  return [
    { id: "vendas", rotulo: "Vendas", atual: v1, anterior: v0, variacao_pct: varPct(v1, v0) },
    { id: "lojas", rotulo: "Lojas", atual: l1, anterior: l0, variacao_pct: varPct(l1, l0) },
    { id: "venda_por_loja", rotulo: "Venda por loja", atual: p1, anterior: p0, variacao_pct: varPct(p1, p0) },
  ];
}

export type LinhaPlataforma = {
  nome: string;
  /** Ficha ou grupo do ranking com o mesmo nome, quando existe. */
  slug: string | null;
  gmv_milhoes: number | null;
  /** Parte vendida por terceiros (3P), quando a fonte publica. */
  terceiros_milhoes: number | null;
  /** Valor negociado menos a parte de terceiros: a venda própria (1P), conta desta página; null sem os dois. */
  propria_milhoes: number | null;
  natureza: NaturezaCurada;
  pagina: number | string | null;
};

/** A régua das plataformas: valor negociado (GMV) de cada uma, com a parte de terceiros quando a fonte a publica. Ordem da fonte. */
export function reguaDasPlataformas(c: CuradoriaVarejo): LinhaPlataforma[] {
  const mk = c.ranking?.marketplaces;
  const nomes = new Map<string, string>();
  for (const g of c.ranking?.grupos ?? []) nomes.set(g.grupo, g.slug);
  for (const [slug, f] of Object.entries(c.fichas)) if (!nomes.has(f.grupo)) nomes.set(f.grupo, slug);
  return (mk?.lista ?? []).map((m) => {
    const gmv = typeof m.gmv_digital_2025_milhoes === "number" ? m.gmv_digital_2025_milhoes : null;
    const terceiros = typeof m.venda_de_sellers_2025_milhoes === "number" ? m.venda_de_sellers_2025_milhoes : null;
    const slug = nomes.get(m.nome) ?? null;
    return { nome: m.nome, slug: slug && c.fichas[slug] ? slug : null, gmv_milhoes: gmv, terceiros_milhoes: terceiros, propria_milhoes: gmv !== null && terceiros !== null ? gmv - terceiros : null, natureza: naturezaCurada(m.natureza), pagina: m.pagina ?? mk?.pagina ?? null };
  });
}

export type ParDeListas = { slug: string; grupo: string; irtt_milhoes: number | null; outra_milhoes: number; diferenca_milhoes: number | null; tem_ficha: boolean };

/** Conferência com a ABRAS: o valor de cada grupo alimentar nas duas listas, em R$ milhões, e a diferença (ABRAS menos IRTT). */
export function paresDaAbras(c: CuradoriaVarejo): ParDeListas[] {
  const abras = (c.ranking?.conferencias ?? []).find((x) => x.valores_abras_reais);
  if (!abras?.valores_abras_reais) return [];
  return linhasDoRanking(c)
    .filter((l) => typeof abras.valores_abras_reais![l.slug] === "number")
    .map((l) => {
      const outra = abras.valores_abras_reais![l.slug] / 1e6;
      return { slug: l.slug, grupo: l.grupo, irtt_milhoes: typeof l.vendas_milhoes === "number" ? l.vendas_milhoes : null, outra_milhoes: outra, diferenca_milhoes: typeof l.vendas_milhoes === "number" ? outra - l.vendas_milhoes : null, tem_ficha: l.tem_ficha };
    });
}

export type LiderNoSegmento = LiderSegmentoBase & { parte_do_lider_pct: number | null };
type LiderSegmentoBase = { segmento_irtt: string; lider: string; slug: string | null; tem_ficha: boolean; posicao_geral: number | null; vendas_milhoes: number | null; vendas_segmento_milhoes: number | null; empresas: number | null; parte_nas_300_pct: number | null; natureza: NaturezaCurada };

/** O líder de cada segmento da fonte com o tamanho do segmento e a parte do líder nele (venda do líder ÷ vendas do segmento × 100). */
export function lideresNosSegmentos(c: CuradoriaVarejo): LiderNoSegmento[] {
  return (c.ranking?.lideres_por_segmento ?? []).map((l) => {
    const lider = typeof l.vendas_milhoes === "number" ? l.vendas_milhoes : null;
    const seg = typeof l.vendas_segmento_bilhoes === "number" ? l.vendas_segmento_bilhoes * 1000 : null;
    return {
      segmento_irtt: l.segmento_irtt, lider: l.lider, slug: l.slug ?? null, tem_ficha: Boolean(l.slug && c.fichas[l.slug]), posicao_geral: typeof l.posicao_geral === "number" ? l.posicao_geral : null,
      vendas_milhoes: lider, vendas_segmento_milhoes: seg, empresas: typeof l.empresas_no_segmento === "number" ? l.empresas_no_segmento : null,
      parte_nas_300_pct: typeof l.participacao_no_top300_pct === "number" ? l.participacao_no_top300_pct : null, natureza: naturezaCurada(l.natureza),
      parte_do_lider_pct: lider !== null && seg !== null && seg > 0 ? (100 * lider) / seg : null,
    };
  });
}

/* ------------------------------------------------------------------ figuras da ficha */

export type Presenca = {
  /** "todos": a fonte diz que o grupo está em todas as unidades da federação; "lista": estados nomeados; "nao_divulgado": nenhum dos dois. */
  tipo: "todos" | "lista" | "nao_divulgado";
  ufs: string[];
  /** De onde veio a lista: a ficha do grupo (documentos da companhia) ou o ranking. */
  origem: "ficha" | "ranking" | null;
};

const UFS_VALIDAS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

/**
 * Onde o grupo atua, por unidade da federação: a lista da ficha quando existe (é a que cita documento), senão a do ranking. "Todos"
 * e "não divulgado" são estados diferentes: o primeiro pinta as 27; o segundo não pinta nenhuma e diz que a lista não foi publicada.
 */
export function presencaPorEstado(c: CuradoriaVarejo, slug: string): Presenca {
  const limpa = (l: readonly string[]) => Array.from(new Set(l.map((x) => x.trim().toUpperCase()).filter((x) => UFS_VALIDAS.includes(x)))).sort();
  const daFicha = limpa(c.fichas[slug]?.regioes?.estados ?? []);
  const fecha = (ufs: string[], origem: "ficha" | "ranking"): Presenca => ({ tipo: ufs.length === UFS_VALIDAS.length ? "todos" : "lista", ufs, origem });
  if (daFicha.length > 0) return fecha(daFicha, "ficha");
  const g = (c.ranking?.grupos ?? []).find((x) => x.slug === slug);
  const texto = (g?.estados ?? "").trim();
  if (/^todos$/i.test(texto)) return { tipo: "todos", ufs: [...UFS_VALIDAS], origem: "ranking" };
  const doRanking = limpa(texto.split(/[,;]/));
  if (doRanking.length > 0) return fecha(doRanking, "ranking");
  return { tipo: "nao_divulgado", ufs: [], origem: null };
}

export type PontoDaSerie = { exercicio: number; valor: number | null; /** Valor que a demonstração do exercício seguinte republicou, quando difere do publicado. */ reapresentado: number | null };
export type SerieDaFicha = { id: string; rotulo: string; unidade: "R$ bilhões" | "%"; casas: number; pontos: PontoDaSerie[]; /** Segunda série na mesma unidade e escala (o passivo de arrendamento ao lado da dívida líquida). */ par?: { rotulo: string; pontos: PontoDaSerie[] } };

/**
 * As séries dos pequenos múltiplos da ficha: os indicadores de INDICADORES_FICHA e, por último, a dívida líquida com o passivo de
 * arrendamento como par. Todas nos mesmos exercícios (exerciciosDaGold); exercício sem demonstração é ponto ausente. Receita e lucro
 * trazem o valor reapresentado no exercício seguinte quando ele difere do publicado.
 */
export function seriesDaFicha(emp: EmpresaGold, anos: readonly number[]): SerieDaFicha[] {
  const reap = (p: PeriodoEmpresa | null, campo: "receita_liquida" | "lucro_liquido"): number | null => {
    const r = p?.reapresentado_no_exercicio_seguinte;
    return p && r && r[campo] !== null && r[campo] !== p[campo] ? (r[campo] as number) / 1e9 : null;
  };
  const series: SerieDaFicha[] = INDICADORES_FICHA.map((ind) => ({
    id: ind.id, rotulo: ind.rotulo, unidade: ind.unidade, casas: ind.casas,
    pontos: anos.map((a) => {
      const p = periodoDe(emp, a);
      return { exercicio: a, valor: p ? ind.valor(p) : null, reapresentado: ind.id === "receita" ? reap(p, "receita_liquida") : ind.id === "lucro" ? reap(p, "lucro_liquido") : null };
    }),
  }));
  series.push({
    id: "divida", rotulo: "Dívida líquida sem arrendamento", unidade: "R$ bilhões", casas: 1,
    pontos: anos.map((a) => ({ exercicio: a, valor: dividaLiquida(periodoDe(emp, a)), reapresentado: null })),
    par: { rotulo: "Passivo de arrendamento", pontos: anos.map((a) => ({ exercicio: a, valor: passivoArrendamento(periodoDe(emp, a)), reapresentado: null })) },
  });
  return series;
}

export type PeriodicidadeOperacional = "anual" | "trimestral";
export type SerieComparavel = { periodicidade: PeriodicidadeOperacional; pontos: { periodo: string; ordem: number; valor: number }[] };

/** Período da curadoria na periodicidade e na ordem do tempo: "2025" e "dez/2025" são o exercício; "4T24" é um trimestre. O resto não se ordena. */
export function periodoOperacional(periodo: string | undefined): { periodicidade: PeriodicidadeOperacional; ordem: number } | null {
  const p = (periodo ?? "").trim();
  const ano = /^(?:dez\/)?(\d{4})$/.exec(p);
  if (ano) return { periodicidade: "anual", ordem: Number(ano[1]) };
  const tri = /^([1-4])T(\d{2})$/.exec(p);
  if (tri) return { periodicidade: "trimestral", ordem: (2000 + Number(tri[2])) * 4 + Number(tri[1]) - 1 };
  return null;
}

/**
 * A parte de uma série operacional que pode virar minigráfico: três ou mais valores da mesma periodicidade (só exercícios, ou só
 * trimestres), em ordem do tempo. Trimestre e ano nunca dividem o eixo; com as duas periodicidades, vale a que tem mais pontos
 * (empate: a anual). Menos de três pontos comparáveis: null, e a série segue em pares rótulo e valor.
 */
export function serieComparavel(o: Pick<Operacional, "valores">): SerieComparavel | null {
  const grupos: Record<PeriodicidadeOperacional, SerieComparavel["pontos"]> = { anual: [], trimestral: [] };
  for (const v of o.valores ?? []) {
    const p = periodoOperacional(v.periodo);
    if (!p || typeof v.valor !== "number" || !Number.isFinite(v.valor)) continue;
    if (grupos[p.periodicidade].some((x) => x.ordem === p.ordem)) continue;
    grupos[p.periodicidade].push({ periodo: (v.periodo ?? "").trim(), ordem: p.ordem, valor: v.valor });
  }
  const periodicidade: PeriodicidadeOperacional = grupos.trimestral.length > grupos.anual.length ? "trimestral" : "anual";
  const pontos = grupos[periodicidade].sort((a, b) => a.ordem - b.ordem);
  return pontos.length >= 3 ? { periodicidade, pontos } : null;
}

/** A venda do ranking e a receita líquida do mesmo exercício na CVM, em R$ milhões, com a parte que a receita representa da venda. */
export function rankingContraCvm(vendaMilhoes: number | null, emp: EmpresaGold | null, anoRanking: string): { venda_milhoes: number | null; receita_milhoes: number | null; exercicio: number | null; mesmo_ano: boolean; razao_pct: number | null; diferenca_milhoes: number | null; base: string | null } {
  const doAno = emp ? periodoDe(emp, Number(anoRanking)) : null;
  const p = doAno ?? ultimoExercicio(emp);
  const receita = p?.receita_liquida != null ? p.receita_liquida / 1e6 : null;
  const mesmo = Boolean(doAno);
  const comparavel = mesmo && vendaMilhoes !== null && vendaMilhoes > 0 && receita !== null;
  return { venda_milhoes: vendaMilhoes, receita_milhoes: receita, exercicio: p?.exercicio ?? null, mesmo_ano: mesmo, razao_pct: comparavel ? (100 * receita!) / vendaMilhoes! : null, diferenca_milhoes: comparavel ? vendaMilhoes! - receita! : null, base: p?.base ?? null };
}

/**
 * A partir de quantas posições um movimento é destacado no gráfico de inclinação: o terceiro maior deslocamento da lista, nunca
 * menos de duas posições. Com isso a figura destaca poucos grupos (os empates do terceiro entram) e nunca destaca troca de um lugar.
 */
export function limiarDeDestaque(m: readonly Movimento[]): number {
  const ordenados = m.map((x) => Math.abs(x.ganho ?? 0)).sort((a, b) => b - a);
  return Math.max(2, ordenados[Math.min(2, ordenados.length - 1)] ?? 2);
}
