/**
 * Leitura das golds do painel "Apostas e crédito das famílias" (Observatório das Famílias, coleção Dívida e crédito das famílias):
 * public/obs/data/gold/bets.json (curadoria documentada em FONTES_BETS.md, METODOLOGIA_BETS.md e DICIONARIO_DADOS_BETS.md),
 * epae.json (Pix por atividade econômica, do Banco Central) e pulse.json (séries mensais de crédito do explorador). Só servidor.
 *
 * Nada é escrito à mão: valor, período, fonte, grau de evidência (A a E) e situação (fonte primária, calculado, estimativa, imprensa)
 * saem da gold. Este arquivo guarda também o que o painel "Golpes e fraudes" reusa, porque as duas bases seguem o mesmo contrato de
 * evidência: os tipos de grau e situação, a limpeza de pontuação, a proveniência de base curada e as séries de crédito do explorador.
 */
import { lerPublico, dataBr, mesAno } from "@/lib/perguntas/leitura";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";

export const ROTA_APOSTAS = "/divida-das-familias/apostas";
export const TITULO_APOSTAS = "Apostas e crédito das famílias";
export const PERGUNTA_APOSTAS = "As apostas online estão chegando ao crédito das famílias?";
export const DESCRICAO_APOSTAS =
  "O tamanho do mercado regulado de apostas, quem aposta e o que os números oficiais permitem afirmar sobre a ligação com dívida e atraso das famílias, com o grau de evidência de cada número.";
export const SECAO_APOSTAS = "familias:apostas";

/* ------------------------------------------------------------- contrato de evidência (comum a Apostas e a Golpes e fraudes) */

export type Nivel = "A" | "B" | "C" | "D" | "E";
export const NIVEIS: readonly Nivel[] = ["A", "B", "C", "D", "E"];
export type DefNivel = { nivel: Nivel; rotulo: string; descricao: string };

export type Situacao = "oficial" | "calculado" | "estimativa" | "imprensa";
/** Como a situação de cada número aparece na página, sempre em texto. */
export const SITUACAO_TEXTO: Record<Situacao, string> = {
  oficial: "Fonte primária",
  calculado: "Calculado",
  estimativa: "Estimativa",
  imprensa: "Imprensa, aguarda fonte primária",
};
/** Natureza do kit para cada situação da base. Número de imprensa não tem natureza no kit e por isso nunca vai à faixa de números. */
export const NATUREZA_DA_SITUACAO: Record<Exclude<Situacao, "imprensa">, Natureza> = { oficial: "OBSERVADO", calculado: "CALCULADO", estimativa: "ESTIMADO" };

/**
 * Natureza do kit para um número da síntese (auditoria de 10/11/2026, achado 10). A situação "oficial" da base diz quem publicou, não
 * como o número foi obtido: pesquisa amostral de órgão público (grau B, com margem de erro) é estimativa estatística, nunca Observado.
 */
export function naturezaDoItem(k: { situacao: Situacao; nivel: Nivel }): Natureza {
  if (k.situacao === "calculado") return "CALCULADO";
  if (k.situacao === "estimativa" || k.nivel === "B") return "ESTIMADO";
  return "OBSERVADO";
}

/**
 * Unidade de um número de destaque sem o que o valor já diz ao lado: "R$ 37,0 bi" com "R$ bilhões" fica sem unidade, "9,3%" com
 * "% do valor contestado" fica "do valor contestado", "≈ R$ 164/mês" com "R$ por apostador ao mês" fica "por apostador"; e o período
 * que a linha de baixo do número já mostra não se repete na unidade. O valor e a unidade da base não mudam; só a repetição sai da exibição.
 */
export function unidadeSemRepetir(exibir: string, unidade: string, periodo?: string): string {
  let u = unidade.trim();
  // o período já vai na linha de baixo do número: "boletins de ocorrência em 2025" com período "2025" fica "boletins de ocorrência"
  if (periodo && u.endsWith(periodo)) u = u.slice(0, -periodo.length).replace(/\s*\bem\s*$/, "").trim();
  else if (periodo && u.endsWith(`(${periodo})`)) u = u.slice(0, -periodo.length - 2).trim();
  if (/R\$/.test(exibir)) u = u.replace(/^R\$\s*/, "");
  if (/\bbi\b|bilh(ão|ões)/.test(exibir)) u = u.replace(/^bilh(ão|ões)\b\s*/, "");
  if (/\bmi\b|milh(ão|ões)/.test(exibir)) u = u.replace(/^milh(ão|ões)\b\s*/, "");
  if (/%/.test(exibir)) u = u.replace(/^%\s*/, "");
  if (/\/mês/.test(exibir)) u = u.replace(/\s*ao mês$/, "");
  // "79 empresas" com "empresas (SPA)": a palavra com que o valor termina não se repete no começo da unidade
  const ultima = exibir.trim().split(/\s+/).at(-1) ?? "";
  if (ultima && /^[A-Za-zÀ-ÿ]+$/.test(ultima) && u.toLowerCase().startsWith(`${ultima.toLowerCase()} `)) u = u.slice(ultima.length).trim();
  return u;
}

/**
 * Palavras que as bases curadas (bets.json, fraudes.json, epae.json) escrevem em caixa alta para dar ênfase. Na página viram texto
 * comum; siglas (GGR, SIGAP, FBSP) não estão na lista e ficam como estão. A correção de origem é na curadoria das golds.
 */
const ENFASE =
  "NÃO|SEM|NUNCA|APENAS|TODOS|TOTAL|PISO|ADIAM|BRUTAS|CONCEITOS|CONTESTADAS?|CONTESTADO|CONSUMADA|ESTIMATIVA|INSTITUCIONAL|INTEIRA|LÍQUIDA|PLAUSÍVEL|POPULAÇÃO|POPULAÇÕES|POUPANÇA|RELEVANTES|SEÇÃO|SUBESTIMADO|TENTATIVAS|TRANSITÓRIA";
const RE_ENFASE = new RegExp(`(^|[^\\p{L}\\d])(${ENFASE})(?![\\p{L}\\d])`, "gu");
/** Tira a caixa alta de ênfase: minúsculas no meio da frase, só a inicial maiúscula no começo do texto ou depois de ponto. */
export function semEnfase(texto: string): string {
  return texto.replace(RE_ENFASE, (tudo: string, antes: string, palavra: string, pos: number) => {
    const antesDaPalavra = texto.slice(0, pos + antes.length).trimEnd();
    const inicioDeFrase = antesDaPalavra === "" || /[.!?]$/.test(antesDaPalavra);
    const minuscula = palavra.toLowerCase();
    return antes + (inicioDeFrase ? minuscula[0].toUpperCase() + minuscula.slice(1) : minuscula);
  });
}

export function situacaoTexto(s: string | undefined | null): string {
  return s && s in SITUACAO_TEXTO ? SITUACAO_TEXTO[s as Situacao] : "Não informada";
}

/** Texto da base como a página o mostra: sem travessão, meia-risca nem hífen solto como pontuação, espaços normalizados. O conteúdo não muda. */
export function limpar(texto: unknown): string {
  if (texto === null || texto === undefined) return "";
  const limpo = String(texto)
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 a $2")
    .replace(/[—–]/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    // intervalo de anos escrito com hífen ("2020-21", "2024-2025"); número de processo ("/2025-47") fica como está
    .replace(/(?<![\d/.])((?:19|20)\d{2})-(\d{4}|\d{2})(?![\d-])/g, (tudo, a: string, b: string) => {
      const fim = b.length === 2 ? Number(a.slice(0, 2) + b) : Number(b);
      return fim > Number(a) && fim - Number(a) <= 10 ? `${a} a ${fim}` : tudo;
    })
    .replace(/\s+/g, " ")
    .trim();
  return semEnfase(limpo);
}

/** Data da base ("2026-05-29", "2024-04", "2025") na forma da página; o que não é data volta como veio. */
export function dataDaBase(ref: unknown): string {
  const s = String(ref ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return dataBr(s.slice(0, 10));
  if (/^\d{4}-\d{2}$/.test(s)) return mesAno(s);
  return limpar(s);
}

export function niveisDaBase(g: { niveis?: Record<string, { rotulo: string; descricao: string }> }): DefNivel[] {
  return NIVEIS.filter((n) => g.niveis?.[n]).map((n) => ({ nivel: n, rotulo: limpar(g.niveis![n].rotulo), descricao: limpar(g.niveis![n].descricao) }));
}

export type ItemSintese = {
  id: string;
  rotulo: string;
  exibir: string;
  unidade: string;
  conceito: string;
  periodo: string;
  nivel: Nivel;
  fonte: string;
  url: string;
  situacao: Situacao;
  nota: string | null;
  /** Valor numérico da base, quando ela o registra (intervalos ficam só em `exibir`). */
  valor: number | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
export function sinteseDaBase(g: any): ItemSintese[] {
  return (g.sintese as any[]).map((k) => ({
    id: String(k.id),
    // rótulo fiel à unidade da contagem: a base chama de "Pessoas em autoexclusão" um número cuja unidade é "solicitações acumuladas"
    // (auditoria de 10/11/2026, achado 10). Enquanto a curadoria não corrige o rótulo, a página diz o que a base conta.
    rotulo: /^pessoas\b/i.test(String(k.rotulo)) && /^solicitaç/i.test(String(k.unidade)) ? limpar(String(k.rotulo).replace(/^pessoas em\b/i, "Solicitações de")) : limpar(k.rotulo),
    exibir: limpar(k.exibir),
    unidade: limpar(k.unidade),
    conceito: limpar(k.conceito),
    periodo: limpar(k.data_ref),
    nivel: k.nivel as Nivel,
    fonte: limpar(k.fonte),
    url: String(k.url),
    situacao: k.status as Situacao,
    nota: k.nota ? limpar(k.nota) : null,
    valor: typeof k.valor === "number" ? k.valor : null,
  }));
}

/** Proveniência do kit para um número ou série de base curada à mão (sem snapshot nem hash: a limitação diz isso). */
export function provCurada(b: {
  indicador: string;
  natureza: Natureza;
  orgao: string;
  dataset: string;
  recurso?: string;
  url: string;
  unidade: string;
  frequencia: string;
  /** "AAAA", "AAAA-MM" ou "AAAA-MM-DD". */
  inicio: string;
  fim: string;
  /** `gerado_em` da gold. */
  geradoEm: string;
  capturadoEm?: string | null;
  sha256?: string | null;
  formula?: string | null;
  transformacoes?: string[];
  limitacoes?: string[];
  pipeline: string;
  curada?: boolean;
  /** Licença como a base a registra; sem ela, a página diz que a base não registra. */
  licenca?: string;
}): Proveniencia {
  return {
    indicador: b.indicador,
    natureza: b.natureza,
    fonte: {
      orgao: b.orgao,
      dataset: b.dataset,
      recurso: b.recurso ?? b.dataset,
      url_dataset: b.url,
      url_primaria: b.url,
      licenca: b.licenca ?? "Não registrada na base; consultar as condições de uso na página da fonte",
    },
    unidade: b.unidade,
    frequencia: b.frequencia,
    periodo_referencia: { inicio: b.inicio, fim: b.fim },
    publicado_pela_fonte_em: null,
    capturado_em: b.capturadoEm ?? null,
    validado_em: b.geradoEm,
    cobertura_historica: { inicio: b.inicio, fim: b.fim },
    transformacoes: b.transformacoes ?? [],
    formula: b.formula ?? null,
    snapshot: { id: null, sha256: b.sha256 ?? null },
    versao_pipeline: b.pipeline,
    versao_codigo: null,
    revisoes_conhecidas: null,
    limitacoes: [
      ...(b.limitacoes ?? []),
      ...(b.curada === false ? [] : ["Base curada à mão a partir das publicações citadas, sem captura automática nem hash do original; a data de validação é a da última revisão da curadoria."]),
    ],
    download: null,
    notas_fonte: null,
  };
}

/* ------------------------------------------------------------- séries de crédito do explorador (pulse.json) */

export type IndicadorCredito = { key: string; rotulo: string; unidade: string; fonte: string; codigo: string; url: string; ultimaRef: string; coletadoEm: string | null };
export type LinhaCredito = { mes: string } & Record<string, string | number | null>;
export type SeriesCredito = { indicadores: IndicadorCredito[]; linhas: LinhaCredito[]; primeiroMes: string; ultimoMes: string; geradoEm: string };

/** As séries mensais que o explorador da base pede, na ordem dela; indicador sem série na gold fica de fora e é dito na página. */
export function seriesDeCredito(pedidos: { key: string; rotulo: string }[]): SeriesCredito & { ausentes: string[] } {
  const p = lerPublico("obs", "data", "gold", "pulse.json");
  const indicadores: IndicadorCredito[] = [];
  const ausentes: string[] = [];
  const porMes = new Map<string, Record<string, number>>();
  for (const pedido of pedidos) {
    const s = p.series?.[pedido.key];
    const obs: { ref: string; v: number }[] = ((s?.obs ?? []) as any[]).filter((o) => typeof o.v === "number" && Number.isFinite(o.v));
    if (!s || obs.length === 0) {
      ausentes.push(limpar(pedido.rotulo));
      continue;
    }
    for (const o of obs) {
      const mes = String(o.ref).slice(0, 7);
      const linha = porMes.get(mes) ?? {};
      linha[pedido.key] = o.v;
      porMes.set(mes, linha);
    }
    indicadores.push({
      key: pedido.key,
      rotulo: limpar(pedido.rotulo),
      unidade: limpar(s.meta.unit || "valor da série"),
      fonte: `${limpar(s.meta.source)}, série ${s.meta.series_code}`,
      codigo: String(s.meta.series_code),
      url: String(s.meta.url ?? ""),
      ultimaRef: String(obs[obs.length - 1].ref).slice(0, 7),
      coletadoEm: s.meta.last_collected_at ? String(s.meta.last_collected_at) : null,
    });
  }
  const meses = [...porMes.keys()].sort();
  const linhas: LinhaCredito[] = meses.map((mes) => {
    const l: LinhaCredito = { mes };
    for (const i of indicadores) l[i.key] = porMes.get(mes)?.[i.key] ?? null;
    return l;
  });
  return { indicadores, linhas, primeiroMes: meses[0], ultimoMes: meses[meses.length - 1], geradoEm: String(p.gerado_em), ausentes };
}

/* ------------------------------------------------------------- bets.json e epae.json */

export type Elo = { de: string; para: string; status: string; grau: string; evidencia: string };
export type Cadeia = { descricao: string; nos: { nome: string; grau: string }[]; elos: Elo[] };

export function cadeiaDaBase(g: any): Cadeia {
  const legenda: Record<string, string> = g.cadeia.legenda ?? {};
  const grau = (st: string) => limpar(legenda[st] ?? st);
  const elos: Elo[] = (g.cadeia.elos as any[]).map((e) => ({ de: limpar(e.de), para: limpar(e.para), status: String(e.status), grau: grau(e.status), evidencia: limpar(e.evidencia) }));
  // o primeiro nó é o ponto de partida da cadeia: comprovado no Brasil, como na vista de origem
  const nos = [{ nome: elos[0]?.de ?? "", grau: grau("comprovado_brasil") }, ...elos.map((e) => ({ nome: e.para, grau: e.grau }))];
  return { descricao: limpar(g.cadeia.descricao), nos, elos };
}

export type Estudo = { id: string; titulo: string; autores: string; ano: string; veiculo: string; tipo: string; pais: string; periodo: string; base: string; desenho: string; resultado: string; limitacoes: string; aplicabilidade: string; nivel: Nivel; url: string };
export function estudosDaBase(g: any): Estudo[] {
  return ((g.estudos ?? []) as any[]).map((e, i) => ({
    id: String(e.id ?? i),
    titulo: limpar(e.titulo),
    autores: limpar(e.autores),
    ano: String(e.ano),
    veiculo: limpar(e.veiculo),
    tipo: limpar(e.tipo),
    pais: limpar(e.pais),
    periodo: limpar(e.periodo),
    base: limpar(e.base),
    desenho: limpar(e.desenho),
    resultado: limpar(e.resultado),
    limitacoes: limpar(e.limitacoes),
    aplicabilidade: limpar(e.aplicabilidade),
    nivel: e.nivel as Nivel,
    url: String(e.url),
  }));
}

export type Marco = { data: string; ato: string; resumo: string; url: string; parcial: boolean };
export function linhaDoTempoDaBase(g: any): Marco[] {
  return ((g.timeline ?? []) as any[]).map((t) => ({ data: dataDaBase(t.data), ato: limpar(t.ato), resumo: limpar(t.resumo), url: String(t.url), parcial: t.status === "parcial" }));
}

export type DadosApostas = ReturnType<typeof dadosApostas>;

export function dadosApostas() {
  const B = lerPublico("obs", "data", "gold", "bets.json");
  const E = lerPublico("obs", "data", "gold", "epae.json");
  const credito = seriesDeCredito(B.explorador.indicadores);
  return { B, E, credito, sintese: sinteseDaBase(B), niveis: niveisDaBase(B), cadeia: cadeiaDaBase(B), estudos: estudosDaBase(B), linhaDoTempo: linhaDoTempoDaBase(B) };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
