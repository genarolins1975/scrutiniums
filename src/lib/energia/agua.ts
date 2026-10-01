/**
 * Lógica pura das páginas de Água e clima (P017 armazenamento, P018 afluência, P019
 * chuva, temperatura e clima, P020 reservatórios e balanço), testada em node sem
 * navegador.
 *
 * Nada aqui recalcula indicador: EAR, faixas, percentis, ENA de 30 dias, anomalias,
 * balanços e decomposições vêm prontos da gold (pipeline/energia/modulos/agua_detalhe.py).
 * As funções escolhem o recorte pedido na URL, montam as linhas que o gráfico, a tabela
 * equivalente e a exportação usam (as mesmas linhas, para que os três nunca divirjam) e
 * escrevem as respostas curtas por regra determinística: mudar o número muda o texto, e
 * nenhuma frase traz número fixo. Ausência continua ausência (null), nunca zero; "não se
 * aplica" (EAR máxima zero) é dito com essas palavras.
 */
import { somarDias } from "./calendario";
import { diaBrasilia } from "./evidencia";
import { quebrasFixas, type Classificacao } from "./escalas";
import { dataBR, mesAno, num, pct, plural, sinal } from "./formato";
import type { ColunaTabela, LinhaTabela, ValorCelula } from "./tabela";
import type { Regiao, Submercado } from "./tipos";
import type {
  AguaAfluencia,
  AguaArmazenamento,
  AguaCapturaAno,
  AguaColunasRegiao,
  AguaConvencaoDefluencia,
  AguaDecomposicaoEar,
  AguaEnaResumo,
  AguaEventoCapacidade,
  AguaMlt,
  AguaPrecipitacaoBacia,
  AguaPrevisao,
  AguaQuebraPerimetroRee,
  AguaReconciliacaoEar,
  AguaReservatorio,
  AguaReservatorios,
  AguaRevisaoCaptura,
  AguaSemanal,
  AguaSerieReservatorio,
  AguaTemperatura,
  FaixaUsual,
} from "./tipos-agua";

/* ---------- rotas e painéis ---------- */

export const ROTA_AGUA = "/setor-eletrico/agua-e-clima";
export type PainelAgua = "p017" | "p018" | "p019" | "p020";

/**
 * Um painel por página: cada um tem séries, várias tabelas equivalentes e fichas de
 * prova; juntos passariam da meta de cerca de 600 KB de HTML por página (contrato,
 * seção 5.1). As perguntas são as do Anexo A da especificação.
 */
export const PAINEIS_AGUA: { id: PainelAgua; rotulo: string; caminho: string; pergunta: string }[] = [
  { id: "p017", rotulo: "Armazenamento", caminho: "", pergunta: "Quanta energia está armazenada?" },
  { id: "p018", rotulo: "Afluência", caminho: "/afluencia", pergunta: "A água que chega está acima do normal?" },
  { id: "p019", rotulo: "Chuva, temperatura e clima", caminho: "/chuva-e-temperatura", pergunta: "Como o clima se relaciona com a água e com a demanda?" },
  { id: "p020", rotulo: "Reservatórios e balanço", caminho: "/reservatorios", pergunta: "Por que o armazenamento mudou?" },
];

export function rotaPainel(id: PainelAgua): string {
  return `${ROTA_AGUA}${PAINEIS_AGUA.find((p) => p.id === id)?.caminho ?? ""}`;
}

export function perguntaPainel(id: PainelAgua): string {
  return PAINEIS_AGUA.find((p) => p.id === id)?.pergunta ?? "";
}

/** Âncoras da antiga página única que agora vivem na página da afluência (links de outras páginas e de verbetes). */
export const ANCORAS_AFLUENCIA = ["ena", "ena-sm"];

/* ---------- regiões ---------- */

export const REGIOES: readonly Regiao[] = ["SIN", "SE", "S", "NE", "N"];
export const SUBSISTEMAS: readonly Submercado[] = ["SE", "S", "NE", "N"];
export const NOME_REGIAO: Record<Regiao, string> = { SIN: "SIN", SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" };
export const CURTO_REGIAO: Record<Regiao, string> = { SIN: "SIN", SE: "SE/CO", S: "S", NE: "NE", N: "N" };
/** Contração com o artigo de cada nome ("a EAR do Sul"). */
export const DO_REGIAO: Record<Regiao, string> = { SIN: "do SIN", SE: "do Sudeste/Centro-Oeste", S: "do Sul", NE: "do Nordeste", N: "do Norte" };
export const COR_REGIAO: Record<Regiao, string> = {
  SIN: "var(--cor-energia)",
  SE: "var(--serie-sm-se)",
  S: "var(--serie-sm-s)",
  NE: "var(--serie-sm-ne)",
  N: "var(--serie-sm-n)",
};
export const COR_COMPARACAO = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"] as const;

const ehRegiao = (x: string): x is Regiao => (REGIOES as readonly string[]).includes(x);

/* ---------- textos auxiliares ---------- */

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "a, b e c". */
export function listaTexto(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** "2001-2025" (período da base publicado pela gold) → "2001 a 2025"; sem hífen no texto visível. */
export function periodoBase(p: string | null | undefined): string {
  if (!p) return "sem base";
  const [a, b] = p.split("-");
  return b && b !== a ? `${a} a ${b}` : a;
}

/** EAR em MWmês: recortes pequenos (Belo Monte, 28 MWmês de EAR máxima) com uma casa; os demais sem casa. */
export function casasMwmes(v: number | null | undefined): number {
  return v !== null && v !== undefined && Math.abs(v) < 100 ? 1 : 0;
}

export function mwmes(v: number | null | undefined): string {
  return num(v, casasMwmes(v));
}

export const ROTULO_FAIXA: Record<FaixaUsual, string> = {
  abaixo: "abaixo da faixa usual",
  dentro: "dentro da faixa usual",
  acima: "acima da faixa usual",
};

/* ---------- nomes de REE, bacias e reservatórios ---------- */

/**
 * Nomes como o leitor os escreve. O ONS publica em maiúsculas e sem acento ("SAO
 * FRANCISCO"); o nome original continua no identificador, na busca e nos arquivos.
 */
const NOMES: Record<string, string> = {
  "SAO FRANCISCO": "São Francisco",
  "PARAIBA DO SUL": "Paraíba do Sul",
  PARANA: "Paraná",
  PARANAIBA: "Paranaíba",
  PARNAIBA: "Parnaíba",
  PARAGUACU: "Paraguaçu",
  IGUACU: "Iguaçu",
  ITAJAI: "Itajaí",
  JACUI: "Jacuí",
  TIETE: "Tietê",
  "MANAUS-AMAPA": "Manaus/Amapá",
  "SANTA MARIA VIT": "Santa Maria da Vitória",
  "OUTRAS - SUL": "Outras do Sul",
  "OUTRAS- SUDESTE": "Outras do Sudeste",
};
const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

/** Nome próprio a partir do texto do ONS: tabela acima ou iniciais maiúsculas (preposições em minúscula). */
export function nomeProprio(nome: string | null | undefined): string {
  if (!nome) return "sem nome";
  const t = nome.trim();
  if (NOMES[t]) return NOMES[t];
  return t
    .toLocaleLowerCase("pt-BR")
    .split(/(\s+)/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join("");
}

/* ---------- recortes (subsistema, REE, bacia) ---------- */

export type TipoRecorte = "subsistema" | "ree" | "bacia";
export const TIPOS_RECORTE: readonly TipoRecorte[] = ["subsistema", "ree", "bacia"];
export const ROTULO_TIPO_RECORTE: Record<TipoRecorte, string> = { subsistema: "Subsistemas e SIN", ree: "REE", bacia: "Bacias" };

/** Identificador estável na URL: "SE" para subsistema, "ree:PARANA" e "bacia:GRANDE" para os demais (nome do ONS). */
export function idRecorte(tipo: TipoRecorte, nome: string): string {
  return tipo === "subsistema" ? nome : `${tipo}:${nome}`;
}

export function lerIdRecorte(id: string): { tipo: TipoRecorte; nome: string } | null {
  if (ehRegiao(id)) return { tipo: "subsistema", nome: id };
  const m = /^(ree|bacia):(.+)$/.exec(id);
  return m ? { tipo: m[1] as TipoRecorte, nome: m[2] } : null;
}

/** "SIN", "Sudeste/Centro-Oeste", "REE Paraná", "Bacia do Grande". */
export function rotuloRecorte(tipo: TipoRecorte, nome: string): string {
  if (tipo === "subsistema") return ehRegiao(nome) ? NOME_REGIAO[nome] : nome;
  return tipo === "ree" ? `REE ${nomeProprio(nome)}` : `Bacia do ${nomeProprio(nome)}`;
}

/** Com artigo: "o SIN", "o Sul", "o REE Paraná", "a bacia do Grande". */
export function artigoRecorte(tipo: TipoRecorte, nome: string): string {
  if (tipo === "bacia") return `a bacia do ${nomeProprio(nome)}`;
  return `o ${tipo === "ree" ? `REE ${nomeProprio(nome)}` : rotuloRecorte(tipo, nome)}`;
}

/** Contração: "do SIN", "do REE Paraná", "da bacia do Grande". */
export function doRecorte(tipo: TipoRecorte, nome: string): string {
  if (tipo === "subsistema") return ehRegiao(nome) ? DO_REGIAO[nome] : `de ${nome}`;
  return tipo === "ree" ? `do REE ${nomeProprio(nome)}` : `da bacia do ${nomeProprio(nome)}`;
}

/* ---------- atualidade ---------- */

/**
 * Dia de referência contra o dia do processamento (Brasília). A folga é a defasagem
 * normal da fonte (1 a 2 dias para o ONS; cerca de duas semanas para o IMERG no POWER);
 * acima dela a fonte está defasada e a página diz isso, com os números da última
 * publicação válida.
 */
export function situacaoAtualidade(
  diaReferencia: string | null,
  geradoEm: string,
  folgaDias: number,
  normal: string,
): { defasada: boolean; dias: number | null; texto: string } {
  const proc = diaBrasilia(geradoEm) ?? geradoEm.slice(0, 10);
  if (!diaReferencia) return { defasada: true, dias: null, texto: `Sem dia de referência nesta publicação (processada em ${dataBR(proc)}).` };
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - Date.parse(`${diaReferencia}T00:00:00Z`)) / 86_400_000);
  if (dias > folgaDias) {
    return {
      defasada: true,
      dias,
      texto: `Fonte defasada: o dia mais recente é ${dataBR(diaReferencia)}, ${plural(dias, "dia", "dias")} antes do processamento (${dataBR(proc)}), mais que o atraso normal (${normal}). Os números são os da última publicação válida.`,
    };
  }
  return { defasada: false, dias, texto: `Dado até ${dataBR(diaReferencia)}, processado em ${dataBR(proc)} (${plural(dias, "dia", "dias")} depois; ${normal}).` };
}

/* ---------- tabela: linhas planas ---------- */

/** Objetos para LinhaTabela: booleano vira "sim" ou "não", lista vira texto, objeto aninhado sai. */
export function paraLinhas<T extends object>(linhas: readonly T[]): LinhaTabela[] {
  return linhas.map((l) =>
    Object.fromEntries(
      Object.entries(l)
        .filter(([, v]) => v === null || typeof v !== "object" || Array.isArray(v))
        .map(([k, v]) => [k, typeof v === "boolean" ? (v ? "sim" : "não") : Array.isArray(v) ? v.join(", ") : (v as ValorCelula)]),
    ),
  );
}

/** Pontos regulares a partir de d0 (dia sem dado continua null). */
export function diasRegulares(d0: string, passo: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarDias(d0, passo * i) ?? "");
}

/* ======================================================================
 * P017 armazenamento
 * ==================================================================== */

export type EntidadeEar = {
  id: string;
  tipo: TipoRecorte;
  nome: string;
  rotulo: string;
  dia: string | null;
  captura: string | null;
  ear_pct: number | null;
  ear_mwmes: number | null;
  ear_max_mwmes: number | null;
  sem_armazenamento: boolean;
  /** Subsistemas publicam a variação de 7 dias em MWmês; REE e bacias, em p.p. */
  variacao_7d_pp: number | null;
  variacao_7d_mwmes: number | null;
  variacao_30d_pp: number | null;
  variacao_30d_mwmes: number | null;
  variacao_12m_mwmes: number | null;
  participacao_capacidade_sin_pct: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  p10_mwmes: number | null;
  p50_mwmes: number | null;
  p90_mwmes: number | null;
  anos_na_base: number;
  periodo_base: string | null;
  faixa: FaixaUsual | null;
  percentil_na_data: number | null;
  ear_max_base_min_mwmes: number | null;
  ear_max_base_max_mwmes: number | null;
  capacidade_mudou_na_base: boolean;
  base_desde: number | null;
  perimetro_mudou_em: string | null;
  semanal: AguaSemanal | null;
};

/** Todos os recortes de EAR (SIN e subsistemas, REE, bacias), na ordem da página. */
export function entidadesEar(a: AguaArmazenamento): EntidadeEar[] {
  const subs = [...a.subsistemas].sort((x, y) => REGIOES.indexOf(x.sm) - REGIOES.indexOf(y.sm));
  const comuns = (x: AguaArmazenamento["ree"][number] | AguaArmazenamento["subsistemas"][number]) => ({
    ear_pct: x.ear_pct,
    ear_mwmes: x.ear_mwmes,
    ear_max_mwmes: x.ear_max_mwmes,
    variacao_30d_pp: x.variacao_30d_pp,
    variacao_30d_mwmes: x.variacao_30d_mwmes,
    p10: x.p10,
    p50: x.p50,
    p90: x.p90,
    p10_mwmes: x.p10_mwmes,
    p50_mwmes: x.p50_mwmes,
    p90_mwmes: x.p90_mwmes,
    anos_na_base: x.anos_na_base,
    periodo_base: x.periodo_base,
    faixa: x.faixa,
    percentil_na_data: x.percentil_na_data,
    ear_max_base_min_mwmes: x.ear_max_base_min_mwmes,
    ear_max_base_max_mwmes: x.ear_max_base_max_mwmes,
    capacidade_mudou_na_base: x.capacidade_mudou_na_base,
  });
  return [
    ...subs.map(
      (s): EntidadeEar => ({
        ...comuns(s),
        id: s.sm,
        tipo: "subsistema",
        nome: s.sm,
        rotulo: rotuloRecorte("subsistema", s.sm),
        dia: s.dia,
        captura: s.captura,
        // EAR máxima positiva em todos os subsistemas (validação crítica da gold)
        sem_armazenamento: false,
        variacao_7d_pp: null,
        variacao_7d_mwmes: s.variacao_7d_mwmes,
        variacao_12m_mwmes: s.variacao_12m_mwmes,
        participacao_capacidade_sin_pct: s.participacao_capacidade_sin_pct,
        base_desde: null,
        perimetro_mudou_em: null,
        semanal: s.semanal ?? null,
      }),
    ),
    ...(["ree", "bacia"] as const).flatMap((tipo) =>
      (tipo === "ree" ? a.ree : a.bacias).map(
        (r): EntidadeEar => ({
          ...comuns(r),
          id: idRecorte(tipo, r.nome),
          tipo,
          nome: r.nome,
          rotulo: rotuloRecorte(tipo, r.nome),
          dia: r.dia,
          captura: null,
          sem_armazenamento: r.sem_armazenamento,
          variacao_7d_pp: r.variacao_7d_pp,
          variacao_7d_mwmes: null,
          variacao_12m_mwmes: null,
          participacao_capacidade_sin_pct: null,
          base_desde: r.base_desde ?? null,
          perimetro_mudou_em: r.perimetro_mudou_em ?? null,
          semanal: r.semanal,
        }),
      ),
    ),
  ];
}

/** Recorte padrão de cada tipo: o SIN; nos REE e nas bacias, o de maior EAR máxima (empate pelo nome). */
export function recortePadrao(lista: readonly EntidadeEar[], tipo: TipoRecorte): string {
  if (tipo === "subsistema") return "SIN";
  const doTipo = lista.filter((e) => e.tipo === tipo);
  const maior = [...doTipo].sort((a, b) => (b.ear_max_mwmes ?? -1) - (a.ear_max_mwmes ?? -1) || a.nome.localeCompare(b.nome))[0];
  return maior?.id ?? "SIN";
}

/** Recorte pedido na URL, se existir na lista e for do tipo; senão o padrão do tipo. */
export function recorteEscolhido<E extends { id: string; tipo: TipoRecorte }>(lista: readonly E[], tipo: TipoRecorte, id: string, padrao: string): E | null {
  return lista.find((e) => e.tipo === tipo && e.id === id) ?? lista.find((e) => e.id === padrao) ?? null;
}

export function respostaArmazenamento(e: EntidadeEar): string {
  const quem = artigoRecorte(e.tipo, e.nome);
  if (e.dia === null || e.ear_mwmes === null) return `${cap(quem)} não tem EAR publicada no dia de referência: o valor fica ausente, nunca zero.`;
  if (e.sem_armazenamento) {
    return `${cap(quem)} não tem armazenamento: a EAR máxima é zero (só usinas a fio d'água), então percentual, faixa sazonal e percentil não se aplicam. A EAR publicada em ${dataBR(e.dia)} é ${mwmes(e.ear_mwmes)} MWmês.`;
  }
  const partes: string[] = [];
  let p = `Em ${dataBR(e.dia)}, ${quem} guardava ${mwmes(e.ear_mwmes)} MWmês, ${pct(e.ear_pct, 1)} da EAR máxima de ${mwmes(e.ear_max_mwmes)} MWmês`;
  if (e.faixa && e.p10 !== null && e.p90 !== null) {
    p += `, ${ROTULO_FAIXA[e.faixa]} da data (10º a 90º percentil do mesmo dia em ${periodoBase(e.periodo_base)}: ${pct(e.p10, 1)} a ${pct(e.p90, 1)}; percentil ${num(e.percentil_na_data, 1)}).`;
  } else {
    p += `; com ${plural(e.anos_na_base, "ano", "anos")} na base, menos que os 5 exigidos, não há faixa sazonal nem percentil.`;
  }
  partes.push(p);
  if (e.variacao_30d_mwmes !== null) {
    partes.push(
      `Em 30 dias, ${sinal(e.variacao_30d_mwmes, casasMwmes(e.variacao_30d_mwmes))} MWmês${e.variacao_30d_pp !== null ? ` (${sinal(e.variacao_30d_pp, 1)} p.p.)` : ""}.`,
    );
  }
  if (e.capacidade_mudou_na_base) {
    partes.push(
      `A EAR máxima mudou mais de 5% entre os anos da base (de ${mwmes(e.ear_max_base_min_mwmes)} a ${mwmes(e.ear_max_base_max_mwmes)} MWmês): a faixa em % compara capacidades diferentes, e a faixa em MWmês está na tabela.`,
    );
  }
  if (e.perimetro_mudou_em) partes.push(`O perímetro deste REE mudou em ${dataBR(e.perimetro_mudou_em)}: a base começa em ${e.base_desde}.`);
  return partes.join(" ");
}

export const COLUNAS_ARMAZENAMENTO: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Recorte", tipo: "texto" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "dia", rotulo: "Dia", tipo: "data" },
  { id: "ear_mwmes", rotulo: "EAR", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "ear_max_mwmes", rotulo: "EAR máxima", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "ear_pct", rotulo: "EAR", tipo: "percentual", casas: 2 },
  { id: "p10", rotulo: "10º percentil da data", tipo: "percentual", casas: 2 },
  { id: "p50", rotulo: "Mediana da data", tipo: "percentual", casas: 2 },
  { id: "p90", rotulo: "90º percentil da data", tipo: "percentual", casas: 2 },
  { id: "faixa", rotulo: "Posição", tipo: "texto", categorica: true },
  { id: "percentil_na_data", rotulo: "Percentil na data", tipo: "numero", casas: 1 },
  { id: "p10_mwmes", rotulo: "10º percentil", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "p50_mwmes", rotulo: "Mediana", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "p90_mwmes", rotulo: "90º percentil", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "variacao_30d_mwmes", rotulo: "Variação em 30 dias", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "variacao_30d_pp", rotulo: "Variação em 30 dias", tipo: "numero", unidade: "p.p.", casas: 2 },
  { id: "anos_na_base", rotulo: "Anos na base", tipo: "numero", casas: 0 },
  { id: "periodo_base", rotulo: "Período da base", tipo: "texto" },
  { id: "capacidade_mudou_na_base", rotulo: "Capacidade mudou na base", tipo: "texto", categorica: true },
  { id: "nome", rotulo: "Nome no ONS", tipo: "texto" },
];

const ROTULO_POSICAO = (e: { faixa: FaixaUsual | null; sem_armazenamento?: boolean; anos_na_base: number }) =>
  e.sem_armazenamento ? "não se aplica (sem armazenamento)" : e.faixa ? ROTULO_FAIXA[e.faixa] : `sem faixa (${plural(e.anos_na_base, "ano", "anos")} na base)`;

/** As linhas da tabela equivalente e do arquivo exportado (as mesmas do gráfico de pontos). */
export function linhasArmazenamento(lista: readonly EntidadeEar[]): LinhaTabela[] {
  return lista.map((e) => ({
    id: e.id,
    rotulo: e.rotulo,
    tipo: ROTULO_TIPO_RECORTE[e.tipo],
    dia: e.dia,
    ear_mwmes: e.ear_mwmes,
    ear_max_mwmes: e.ear_max_mwmes,
    ear_pct: e.ear_pct,
    p10: e.p10,
    p50: e.p50,
    p90: e.p90,
    faixa: ROTULO_POSICAO(e),
    percentil_na_data: e.percentil_na_data,
    p10_mwmes: e.p10_mwmes,
    p50_mwmes: e.p50_mwmes,
    p90_mwmes: e.p90_mwmes,
    variacao_30d_mwmes: e.variacao_30d_mwmes,
    variacao_30d_pp: e.variacao_30d_pp,
    anos_na_base: e.anos_na_base,
    periodo_base: e.periodo_base ? periodoBase(e.periodo_base) : null,
    capacidade_mudou_na_base: e.sem_armazenamento ? "não se aplica" : e.capacidade_mudou_na_base ? "sim" : "não",
    nome: e.nome,
  }));
}

/** Pontos pareados: EAR do dia contra a mediana da mesma data (recortes sem armazenamento ficam fora do gráfico e na tabela). */
export function itensPontosArmazenamento(lista: readonly EntidadeEar[]) {
  return lista
    .filter((e) => !e.sem_armazenamento)
    .map((e) => ({
      id: e.id,
      rotulo: e.rotulo,
      valor: e.ear_pct,
      referencia: e.p50,
      detalhe:
        e.faixa && e.p10 !== null && e.p90 !== null
          ? `faixa da data ${pct(e.p10, 1)} a ${pct(e.p90, 1)} (${periodoBase(e.periodo_base)}); ${ROTULO_FAIXA[e.faixa]}`
          : `sem faixa: ${plural(e.anos_na_base, "ano", "anos")} na base`,
    }));
}

export type PontoSemanal = { d: string; v: number | null; p10: number | null; p90: number | null };

/** Série a cada 14 dias do último ano com a faixa da data (pontos em d0 + passo × i). */
export function serieSemanal(se: AguaSemanal | null): PontoSemanal[] {
  if (!se) return [];
  return diasRegulares(se.d0, se.passo_dias, se.v.length).map((d, i) => ({ d, v: se.v[i] ?? null, p10: se.p10[i] ?? null, p90: se.p90[i] ?? null }));
}

/** Linhas dos pequenos múltiplos: uma coluna por recorte (o valor) e duas pela faixa ("id·p10", "id·p90"). */
export function linhasMultiplos(entidades: readonly EntidadeEar[]): Record<string, string | number | null>[] {
  const base = entidades.find((e) => e.semanal)?.semanal;
  if (!base) return [];
  const dias = diasRegulares(base.d0, base.passo_dias, base.v.length);
  return dias.map((d, i) => {
    const linha: Record<string, string | number | null> = { d };
    for (const e of entidades) {
      const s = e.semanal;
      // só recortes no mesmo calendário (todos terminam no dia da EAR com passo de 14 dias)
      const ok = s && s.d0 === base.d0 && s.passo_dias === base.passo_dias;
      linha[e.id] = ok ? (s.v[i] ?? null) : null;
      linha[`${e.id}·p10`] = ok ? (s.p10[i] ?? null) : null;
      linha[`${e.id}·p90`] = ok ? (s.p90[i] ?? null) : null;
    }
    return linha;
  });
}

export type PontoRegioes = { d: string } & Record<Regiao, number | null>;

/** Colunas por região com dias regulares desde d0 (EAR diária em MWmês, ENA de 30 dias semanal). */
export function serieRegioes(c: AguaColunasRegiao): PontoRegioes[] {
  const n = c.SIN.length;
  return diasRegulares(c.d0, c.passo_dias, n).map((d, i) => ({
    d,
    SE: c.SE[i] ?? null,
    S: c.S[i] ?? null,
    NE: c.NE[i] ?? null,
    N: c.N[i] ?? null,
    SIN: c.SIN[i] ?? null,
  }));
}

export type PontoMensalEar = { m: string; SE: number | null; S: number | null; NE: number | null; N: number | null; SIN: number | null; SIN_max: number | null };

/** EAR no último dia com dado de cada mês, desde 2000 (MWmês), com a EAR máxima do SIN. */
export function serieMensalEar(s: AguaArmazenamento["serie_mensal_mwmes"]): PontoMensalEar[] {
  return s.m.map((m, i) => ({ m, SE: s.SE[i] ?? null, S: s.S[i] ?? null, NE: s.NE[i] ?? null, N: s.N[i] ?? null, SIN: s.SIN[i] ?? null, SIN_max: s.SIN_max[i] ?? null }));
}

export function textoMesParcial(s: AguaArmazenamento["serie_mensal_mwmes"]): string {
  const outros = s.meses_sem_ultimo_dia.filter((x) => x.m !== s.mes_parcial?.m);
  const partes: string[] = [];
  if (s.mes_parcial) partes.push(`O último ponto (${mesAno(s.mes_parcial.m)}) é parcial: EAR de ${dataBR(s.mes_parcial.d)}, não do fim do mês.`);
  if (outros.length) partes.push(`Meses sem o último dia do calendário: ${listaTexto(outros.map((x) => `${mesAno(x.m)} (EAR de ${dataBR(x.d)})`))}.`);
  if (!partes.length) partes.push("Todos os meses usam a EAR do último dia do calendário.");
  return partes.join(" ");
}

/* --- capacidade --- */

const ROTULO_TIPO_EVENTO: Record<string, string> = { entrada: "entrada", saida: "saída", alteracao: "alteração" };
const ROTULO_PARTE: Record<string, string> = { proprio: "própria", jusante: "a jusante" };

export function respostaCapacidade(c: AguaArmazenamento["capacidade"], dia: string): string {
  const sin = c.variacao_desde_inicio_mwmes.SIN;
  const partes = [
    `De ${dataBR(c.inicio)} a ${dataBR(dia)}, a EAR máxima dos subsistemas mudou em ${plural(c.n_eventos, "dia", "dias")}; ${plural(c.eventos_fechados, "mudança foi atribuída", "mudanças foram atribuídas")} a reservatórios com resíduo dentro da tolerância${c.maior_residuo_mwmes !== null ? ` (maior resíduo: ${num(c.maior_residuo_mwmes, 1)} MWmês)` : ""}.`,
  ];
  if (sin !== null) partes.push(`No período, a EAR máxima do SIN variou ${sinal(sin, 0)} MWmês: um mesmo percentual de anos diferentes não mede a mesma energia.`);
  return partes.join(" ");
}

export const COLUNAS_EVENTOS: ColunaTabela[] = [
  { id: "data", rotulo: "Dia", tipo: "data" },
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "variacao_mwmes", rotulo: "Variação da EAR máxima", tipo: "numero", unidade: "MWmês", casas: 3 },
  { id: "reservatorios", rotulo: "Reservatórios (até três maiores)", tipo: "texto" },
  { id: "n_reservatorios", rotulo: "Reservatórios no evento", tipo: "numero", casas: 0 },
  { id: "residuo_mwmes", rotulo: "Resíduo", tipo: "numero", unidade: "MWmês", casas: 3 },
  { id: "fechado", rotulo: "Dentro da tolerância", tipo: "texto", categorica: true },
];

export function linhasEventos(eventos: readonly AguaEventoCapacidade[]): LinhaTabela[] {
  return eventos.map((e) => ({
    id: `${e.data}:${e.sm}`,
    data: e.data,
    sm: NOME_REGIAO[e.sm],
    variacao_mwmes: e.variacao_mwmes,
    reservatorios: e.reservatorios
      .map((r) => `${nomeProprio(r.nome)} (${ROTULO_TIPO_EVENTO[r.tipo] ?? r.tipo}, parte ${ROTULO_PARTE[r.parte] ?? r.parte}, ${sinal(r.variacao_mwmes, 1)} MWmês)`)
      .join("; "),
    n_reservatorios: e.n_reservatorios,
    residuo_mwmes: e.residuo_mwmes,
    fechado: e.fechado ? "sim" : "não",
  }));
}

export const COLUNAS_FIM_DE_ANO: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "numero", casas: 0 },
  { id: "d", rotulo: "Dia usado", tipo: "data" },
  ...REGIOES.map((r): ColunaTabela => ({ id: r, rotulo: `EAR máxima ${CURTO_REGIAO[r]}`, tipo: "numero", unidade: "MWmês", casas: 1 })),
];

export function linhasFimDeAno(c: AguaArmazenamento["capacidade"]): LinhaTabela[] {
  return c.fim_de_ano.map((x) => ({ id: String(x.ano), ano: x.ano, d: x.d, SIN: x.SIN, SE: x.SE, S: x.S, NE: x.NE, N: x.N }));
}

/* --- perímetro dos REE --- */

export function textoQuebraRee(q: AguaQuebraPerimetroRee): string {
  const mudaram = q.comparacao.filter((c) => c.perimetro_mudou && !c.novo);
  const iguais = q.comparacao.filter((c) => !c.perimetro_mudou && !c.novo);
  const partes = [
    `Em ${dataBR(q.data)} a configuração dos REE mudou nos próprios arquivos do ONS, sem declaração no dicionário: ${listaTexto(q.novos.map(nomeProprio))} ${q.novos.length === 1 ? "apareceu" : "apareceram"} já com EAR máxima positiva.`,
  ];
  if (q.dia_soma_conservada) {
    partes.push(
      `A soma das EAR máximas se conserva entre ${dataBR(q.dia_soma_conservada)} e ${dataBR(q.data)} (${mwmes(q.soma_ear_max_antes_mwmes)} e ${mwmes(q.soma_ear_max_depois_mwmes)} MWmês): é repartição, não capacidade nova.`,
    );
  }
  if (mudaram.length) {
    partes.push(
      `Mudaram de perímetro: ${listaTexto(mudaram.map((c) => `${nomeProprio(c.nome)} (${mwmes(c.ear_max_antes_mwmes)} para ${mwmes(c.ear_max_depois_mwmes)} MWmês)`))}; ${listaTexto(iguais.map((c) => nomeProprio(c.nome)))} não mudaram.`,
    );
  }
  if (q.transicao.length) partes.push(`${listaTexto(q.transicao.map(dataBR))} ${q.transicao.length === 1 ? "é dia" : "são dias"} de transição (perímetro já mudado e REE novos ausentes).`);
  partes.push(`A faixa sazonal dos REE afetados usa só anos do perímetro atual.`);
  return partes.join(" ");
}

export const COLUNAS_QUEBRA_REE: ColunaTabela[] = [
  { id: "nome", rotulo: "REE", tipo: "texto" },
  { id: "antes", rotulo: "EAR máxima antes", tipo: "numero", unidade: "MWmês", casas: 0 },
  { id: "depois", rotulo: "EAR máxima depois", tipo: "numero", unidade: "MWmês", casas: 0 },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
];

export function linhasQuebraRee(q: AguaQuebraPerimetroRee): LinhaTabela[] {
  return q.comparacao.map((c) => ({
    id: c.nome,
    nome: nomeProprio(c.nome),
    antes: c.ear_max_antes_mwmes,
    depois: c.ear_max_depois_mwmes,
    situacao: c.novo ? "REE novo" : c.perimetro_mudou ? "perímetro mudou" : "sem mudança",
  }));
}

/* --- reconciliação e capturas --- */

export function textoReconciliacaoEar(r: AguaReconciliacaoEar): string[] {
  const t: string[] = [];
  t.push(
    `SIN em ${dataBR(r.dia)}: ${num(r.sin_mwmes, 3)} MWmês pela soma dos quatro subsistemas; ${num(r.soma_bacias_mwmes, 3)} pela soma das ${r.n_bacias} bacias e ${num(r.soma_ree_mwmes, 3)} pela soma dos ${r.n_ree} REE, da mesma captura.`,
  );
  if (r.media_simples_dos_percentuais !== null && r.diferenca_media_simples_pp !== null) {
    t.push(
      `A média simples dos percentuais dos subsistemas daria ${pct(r.media_simples_dos_percentuais, 2)}, ${sinal(r.diferenca_media_simples_pp, 2)} p.p. diferente da razão de somas publicada: por isso ela nunca é usada.`,
    );
  }
  if (r.pct_publicado_vs_recalculado_max_pp !== null) {
    t.push(
      `Percentual publicado pelo ONS contra o recalculado (EAR ÷ EAR máxima) em ${num(r.pares_conferidos, 0)} pares: diferença máxima de ${num(r.pct_publicado_vs_recalculado_max_pp, 5)} p.p.`,
    );
  }
  t.push(
    `Soma dos reservatórios contra o subsistema: ${num(r.dias_reservatorios_comparados, 0)} dias comparados, ${num(r.dias_reservatorios_fora_tolerancia, 0)} fora da tolerância; anos sem divergência: ${r.anos_sem_divergencia.length ? listaTexto(r.anos_sem_divergencia.map(String)) : "nenhum"}.`,
  );
  return t;
}

export const COLUNAS_RESERVATORIOS_POR_ANO: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "numero", casas: 0 },
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "dias", rotulo: "Dias comparados", tipo: "numero", casas: 0 },
  { id: "tolerancia_mwmes", rotulo: "Tolerância", tipo: "numero", unidade: "MWmês", casas: 2 },
  { id: "precisao", rotulo: "Precisão da fonte", tipo: "texto" },
  { id: "dias_fora_ear", rotulo: "Dias fora (EAR)", tipo: "numero", casas: 0 },
  { id: "max_dif_ear_mwmes", rotulo: "Maior diferença (EAR)", tipo: "numero", unidade: "MWmês", casas: 3 },
  { id: "dias_fora_ear_max", rotulo: "Dias fora (EAR máxima)", tipo: "numero", casas: 0 },
  { id: "max_dif_ear_max_mwmes", rotulo: "Maior diferença (EAR máxima)", tipo: "numero", unidade: "MWmês", casas: 3 },
];

export function linhasReservatoriosPorAno(r: AguaReconciliacaoEar): LinhaTabela[] {
  return r.reservatorios_por_ano.map((x) => ({ id: `${x.ano}:${x.sm}`, ...x, sm: NOME_REGIAO[x.sm] }));
}

export const COLUNAS_REVISOES_CAPTURAS: ColunaTabela[] = [
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "serie", rotulo: "Série", tipo: "texto", categorica: true },
  { id: "dias_revisados", rotulo: "Dias revisados em 30", tipo: "numero", casas: 0 },
  { id: "dia_maior", rotulo: "Dia da maior revisão", tipo: "data" },
  { id: "silver_principal", rotulo: "Captura anterior", tipo: "numero", casas: 3 },
  { id: "recaptura", rotulo: "Recaptura", tipo: "numero", casas: 3 },
  { id: "diferenca", rotulo: "Diferença", tipo: "numero", casas: 3 },
];

const ROTULO_SERIE: Record<string, string> = {
  ear_mwmes: "EAR (MWmês)",
  ena_bruta_mwmed: "ENA bruta (MWmed)",
  ena_bruta_pct_mlt: "ENA bruta (% da MLT)",
};

export function linhasRevisoesCapturas(rs: readonly AguaRevisaoCaptura[]): LinhaTabela[] {
  return rs.map((r) => ({ id: `${r.sm}:${r.serie}`, ...r, sm: NOME_REGIAO[r.sm], serie: ROTULO_SERIE[r.serie] ?? r.serie }));
}

export function textoRevisoesCapturas(rs: readonly AguaRevisaoCaptura[]): string {
  const com = rs.filter((r) => r.dias_revisados > 0);
  if (!com.length) return "Nenhum valor dos últimos 30 dias mudou entre as duas capturas.";
  return `O ONS revisou valores recentes entre as duas capturas: ${listaTexto(
    com.map((r) => `${NOME_REGIAO[r.sm]}, ${ROTULO_SERIE[r.serie] ?? r.serie}, ${plural(r.dias_revisados, "dia", "dias")} (maior diferença ${sinal(r.diferenca, 3)} em ${dataBR(r.dia_maior)})`),
  )}. Em cada ano vale a captura mais recente.`;
}

export const COLUNAS_CAPTURAS: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "numero", casas: 0 },
  { id: "fonte", rotulo: "Captura usada", tipo: "texto", categorica: true },
  { id: "capturado_em", rotulo: "Capturado em (UTC)", tipo: "texto" },
  { id: "recurso", rotulo: "Arquivo do ONS", tipo: "texto" },
];

export function linhasCapturas(cs: readonly AguaCapturaAno[]): LinhaTabela[] {
  return cs.map((c) => ({ id: String(c.ano), ano: c.ano, fonte: c.fonte, capturado_em: c.capturado_em, recurso: c.recurso }));
}

/* ======================================================================
 * P018 afluência
 * ==================================================================== */

export type EntidadeEna = AguaEnaResumo & { id: string; tipo: TipoRecorte; rotulo: string };

export function entidadesEna(f: AguaAfluencia): EntidadeEna[] {
  const subs = [...f.subsistemas].sort((x, y) => REGIOES.indexOf(x.sm) - REGIOES.indexOf(y.sm));
  return [
    ...subs.map((s): EntidadeEna => ({ ...s, id: s.sm, tipo: "subsistema", nome: s.sm, rotulo: rotuloRecorte("subsistema", s.sm) })),
    ...f.ree.map((r): EntidadeEna => ({ ...r, id: idRecorte("ree", r.nome), tipo: "ree", rotulo: rotuloRecorte("ree", r.nome) })),
    ...f.bacias.map((r): EntidadeEna => ({ ...r, id: idRecorte("bacia", r.nome), tipo: "bacia", rotulo: rotuloRecorte("bacia", r.nome) })),
  ];
}

export function recortePadraoEna(lista: readonly EntidadeEna[], tipo: TipoRecorte): string {
  if (tipo === "subsistema") return "SIN";
  const doTipo = lista.filter((e) => e.tipo === tipo);
  const maior = [...doTipo].sort((a, b) => (b.mlt_30d_soma_mwmed_dia ?? -1) - (a.mlt_30d_soma_mwmed_dia ?? -1) || a.nome.localeCompare(b.nome))[0];
  return maior?.id ?? "SIN";
}

export function respostaAfluencia(e: EntidadeEna): string {
  const de = doRecorte(e.tipo, e.nome);
  if (e.pct_mlt_30d === null) {
    return `Sem ENA de 30 dias ${de} até ${dataBR(e.dia)}: falta dia na janela ou não há MLT publicada, e a razão nunca é calculada com dia faltando.`;
  }
  const partes: string[] = [];
  let p = `Nos 30 dias até ${dataBR(e.dia)}, a ENA bruta ${de} somou ${num(e.ena_30d_soma_mwmed_dia, 0)} MWmed·dia, ${pct(e.pct_mlt_30d, 1)} da MLT do mesmo período (${num(e.mlt_30d_soma_mwmed_dia, 0)} MWmed·dia)`;
  if (e.faixa_30d && e.p10_30d !== null && e.p90_30d !== null) {
    p += `, ${ROTULO_FAIXA[e.faixa_30d]} da mesma janela (10º a 90º percentil em ${periodoBase(e.periodo_base)}: ${pct(e.p10_30d, 1)} a ${pct(e.p90_30d, 1)}; percentil ${num(e.percentil_30d, 1)}).`;
  } else {
    p += `; com ${plural(e.anos_na_base_30d, "ano", "anos")} na base da mesma janela, menos que os 5 exigidos, não há faixa usual.`;
  }
  partes.push(p);
  if (e.pct_mlt_dia !== null) partes.push(`No dia ${dataBR(e.dia)}, ${pct(e.pct_mlt_dia, 1)} da MLT do dia.`);
  if (e.pct_mlt_arm_30d !== undefined && e.pct_mlt_arm_30d !== null) partes.push(`A ENA armazenável, com a mesma regra, ficou em ${pct(e.pct_mlt_arm_30d, 1)} da sua MLT.`);
  return partes.join(" ");
}

export const COLUNAS_AFLUENCIA: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Recorte", tipo: "texto" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "dia", rotulo: "Último dia", tipo: "data" },
  { id: "pct_mlt_30d", rotulo: "ENA de 30 dias", tipo: "numero", unidade: "% da MLT", casas: 1 },
  { id: "ena_30d_soma_mwmed_dia", rotulo: "Soma da ENA", tipo: "numero", unidade: "MWmed·dia", casas: 1 },
  { id: "mlt_30d_soma_mwmed_dia", rotulo: "Soma da MLT", tipo: "numero", unidade: "MWmed·dia", casas: 1 },
  { id: "p10_30d", rotulo: "10º percentil da janela", tipo: "numero", unidade: "% da MLT", casas: 1 },
  { id: "p50_30d", rotulo: "Mediana da janela", tipo: "numero", unidade: "% da MLT", casas: 1 },
  { id: "p90_30d", rotulo: "90º percentil da janela", tipo: "numero", unidade: "% da MLT", casas: 1 },
  { id: "faixa", rotulo: "Posição", tipo: "texto", categorica: true },
  { id: "percentil_30d", rotulo: "Percentil", tipo: "numero", casas: 1 },
  { id: "anos_na_base_30d", rotulo: "Anos na base", tipo: "numero", casas: 0 },
  { id: "periodo_base", rotulo: "Período da base", tipo: "texto" },
  { id: "pct_mlt_dia", rotulo: "ENA do dia", tipo: "numero", unidade: "% da MLT", casas: 1 },
  { id: "nome", rotulo: "Nome no ONS", tipo: "texto" },
];

export function linhasAfluencia(lista: readonly EntidadeEna[]): LinhaTabela[] {
  return lista.map((e) => ({
    id: e.id,
    rotulo: e.rotulo,
    tipo: ROTULO_TIPO_RECORTE[e.tipo],
    dia: e.dia,
    pct_mlt_30d: e.pct_mlt_30d,
    ena_30d_soma_mwmed_dia: e.ena_30d_soma_mwmed_dia,
    mlt_30d_soma_mwmed_dia: e.mlt_30d_soma_mwmed_dia,
    p10_30d: e.p10_30d,
    p50_30d: e.p50_30d,
    p90_30d: e.p90_30d,
    faixa: e.faixa_30d ? ROTULO_FAIXA[e.faixa_30d] : e.pct_mlt_30d === null ? "sem ENA de 30 dias" : `sem faixa (${plural(e.anos_na_base_30d, "ano", "anos")} na base)`,
    percentil_30d: e.percentil_30d,
    anos_na_base_30d: e.anos_na_base_30d,
    periodo_base: e.periodo_base ? periodoBase(e.periodo_base) : null,
    pct_mlt_dia: e.pct_mlt_dia,
    nome: e.nome,
  }));
}

export function itensPontosAfluencia(lista: readonly EntidadeEna[]) {
  return lista.map((e) => ({
    id: e.id,
    rotulo: e.rotulo,
    valor: e.pct_mlt_30d,
    referencia: e.p50_30d,
    detalhe:
      e.faixa_30d && e.p10_30d !== null && e.p90_30d !== null
        ? `faixa da janela ${pct(e.p10_30d, 1)} a ${pct(e.p90_30d, 1)} (${periodoBase(e.periodo_base)}); ${ROTULO_FAIXA[e.faixa_30d]}`
        : e.pct_mlt_30d === null
          ? "sem ENA de 30 dias"
          : `sem faixa: ${plural(e.anos_na_base_30d, "ano", "anos")} na base`,
  }));
}

/* --- MLT --- */

/** O que se sabe da versão da MLT, a partir dos campos da gold (uma frase por achado). */
export function textosMlt(mlt: AguaMlt, anoCorrente: string): string[] {
  const t: string[] = [];
  const iguais = mlt.ano_corrente_igual_ao_anterior;
  if (iguais.length) {
    const tot = iguais.reduce((s, x) => s + x.usinas_comparadas, 0);
    const ig = iguais.reduce((s, x) => s + x.usinas_iguais, 0);
    t.push(
      `No conjunto aberto do ONS, a MLT de ${anoCorrente} é a mesma do ano anterior: no último dia de cada mês encerrado (${mesAno(iguais[0].mes)} a ${mesAno(iguais[iguais.length - 1].mes)}), ${num(ig, 0)} de ${num(tot, 0)} comparações por usina deram valores iguais.`,
    );
  }
  for (const p of mlt.periodos_provisorios) {
    t.push(
      `De ${dataBR(p.inicio)} a ${dataBR(p.fim)} vigorou uma versão provisória (${plural(p.usinas_na_nova_versao, "usina mudou", "usinas mudaram")}); em ${dataBR(p.retorno_em)} ${plural(p.usinas_no_retorno, "usina voltou", "usinas voltaram")} aos valores vigentes em ${dataBR(p.versao_restaurada_igual_a_de)}.`,
    );
  }
  const pmo = mlt.pmo;
  if (pmo.comparacao.length) {
    const dc = pmo.dias_coincidentes.map((d) => `${dataBR(d.inicio)} a ${dataBR(d.fim)}`);
    t.push(
      `O Relatório Executivo do PMO publica a MLT mensal por subsistema: comparada com a MLT implícita do conjunto aberto (tolerância de ${num(pmo.tolerancia_pct, 2)}%, porque o PMO publica MWmed inteiros), ${pmo.meses_coincidentes.length ? `coincide em ${listaTexto(pmo.meses_coincidentes.map(mesAno))}` : "não coincide em nenhum mês inteiro"}${dc.length ? ` e só nos dias ${listaTexto(dc)}` : ""}; diverge em ${listaTexto(pmo.meses_divergentes.map(mesAno))}, com diferença de até ${num(pmo.maior_diferenca_pct, 2)}%.`,
    );
  }
  t.push(
    `${plural(mlt.revisoes_no_mes.length, "mudança", "mudanças")} da MLT de usinas existentes fora do dia 1º (${listaTexto(mlt.revisoes_no_mes.map((r) => `${dataBR(r.data)}: ${r.classificacao === "retorno_a_versao_anterior" ? "retorno a uma versão anterior" : "versão nova"}, ${plural(r.usinas, "usina", "usinas")}`))}). Comparações longas de % da MLT misturam versões da referência.`,
  );
  return t;
}

export const COLUNAS_PMO: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "texto", categorica: true },
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "pmo_mwmed", rotulo: "MLT do PMO", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "aberto_inicio_mwmed", rotulo: "MLT do conjunto aberto no início do mês", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "aberto_fim_mwmed", rotulo: "No fim do mês", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "dif_inicio_pct", rotulo: "Diferença no início", tipo: "percentual", casas: 3 },
  { id: "dif_fim_pct", rotulo: "Diferença no fim", tipo: "percentual", casas: 3 },
  { id: "relatorio", rotulo: "Relatório citado", tipo: "texto" },
  { id: "proprio", rotulo: "Relatório do próprio mês", tipo: "texto", categorica: true },
];

export function linhasPmo(mlt: AguaMlt): LinhaTabela[] {
  return mlt.pmo.comparacao.map((c) => ({
    id: `${c.mes}:${c.sm}`,
    mes: c.mes,
    sm: NOME_REGIAO[c.sm],
    pmo_mwmed: c.pmo_mwmed,
    aberto_inicio_mwmed: c.aberto_inicio_mwmed,
    aberto_fim_mwmed: c.aberto_fim_mwmed,
    dif_inicio_pct: c.dif_inicio_pct,
    dif_fim_pct: c.dif_fim_pct,
    relatorio: c.relatorio,
    proprio: c.relatorio_do_proprio_mes ? "sim" : "não (projeção do mês anterior)",
  }));
}

export const COLUNAS_REVISOES_MLT: ColunaTabela[] = [
  { id: "data", rotulo: "Dia", tipo: "data" },
  { id: "usinas", rotulo: "Usinas", tipo: "numero", casas: 0 },
  { id: "classificacao", rotulo: "Classificação", tipo: "texto", categorica: true },
  { id: "igual_a", rotulo: "Valores iguais aos vigentes em", tipo: "texto" },
  { id: "iguais_1", rotulo: "Iguais a 1 ano antes", tipo: "texto" },
  { id: "iguais_2", rotulo: "Iguais a 2 anos antes", tipo: "texto" },
  { id: "abrangencia", rotulo: "Abrangência", tipo: "texto", categorica: true },
  { id: "variacao_mediana_pct", rotulo: "Variação mediana", tipo: "percentual", casas: 3 },
];

export function linhasRevisoesMlt(mlt: AguaMlt): LinhaTabela[] {
  return mlt.revisoes_no_mes.map((r) => ({
    id: r.data,
    data: r.data,
    usinas: r.usinas,
    classificacao: r.classificacao === "retorno_a_versao_anterior" ? "retorno a uma versão anterior" : "versão nova",
    igual_a: r.igual_a_vigente_em ? dataBR(r.igual_a_vigente_em) : "nenhuma versão comparada",
    iguais_1: `${r.iguais_a_1_ano_antes} de ${r.comparaveis_1_ano_antes}`,
    iguais_2: `${r.iguais_a_2_anos_antes} de ${r.comparaveis_2_anos_antes}`,
    abrangencia: r.abrangencia,
    variacao_mediana_pct: r.variacao_mediana_pct,
  }));
}

export type PontoMlt = { x: string } & Record<Submercado, number | null>;

/** MLT implícita de cada subsistema no dia 15 de janeiro e de julho (x = "AAAA-MM"). */
export function serieMltImplicita(mlt: AguaMlt): PontoMlt[] {
  const s = mlt.implicita_subsistemas;
  return s.ano.map((a, i) => ({ x: `${a}-${String(s.mes[i]).padStart(2, "0")}`, SE: s.SE[i] ?? null, S: s.S[i] ?? null, NE: s.NE[i] ?? null, N: s.N[i] ?? null }));
}

export const COLUNAS_MLT_ANOS: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "numero", casas: 0 },
  { id: "mes", rotulo: "Mês", tipo: "texto", categorica: true },
  { id: "comparadas", rotulo: "Usinas comparadas", tipo: "numero", casas: 0 },
  { id: "diferentes", rotulo: "Com MLT diferente do ano anterior", tipo: "numero", casas: 0 },
];

export function linhasMltAnos(mlt: AguaMlt): LinhaTabela[] {
  const a = mlt.anos;
  return a.ano.map((ano, i) => ({
    id: `${ano}-${a.mes[i]}`,
    ano,
    mes: a.mes[i] === 1 ? "janeiro" : a.mes[i] === 7 ? "julho" : String(a.mes[i]),
    comparadas: a.usinas_comparadas[i],
    diferentes: a.usinas_com_mlt_diferente[i],
  }));
}

export const COLUNAS_UNIDADE: ColunaTabela[] = [
  { id: "sm", rotulo: "Subsistema", tipo: "texto" },
  { id: "dias", rotulo: "Dias comparados", tipo: "numero", casas: 0 },
  { id: "dias_dentro", rotulo: "Dias dentro de 0,1%", tipo: "numero", casas: 0 },
  { id: "max_dif_rel_pct", rotulo: "Maior diferença", tipo: "percentual", casas: 3 },
  { id: "dia", rotulo: "Exemplo: dia", tipo: "data" },
  { id: "soma", rotulo: "Soma das usinas", tipo: "numero", unidade: "MWmed", casas: 3 },
  { id: "subsistema", rotulo: "Subsistema", tipo: "numero", unidade: "MWmed", casas: 3 },
];

export function linhasUnidade(mlt: AguaMlt): LinhaTabela[] {
  return mlt.unidade.map((u) => ({
    id: u.sm,
    sm: NOME_REGIAO[u.sm],
    dias: u.dias,
    dias_dentro: u.dias_dentro_0_1pct,
    max_dif_rel_pct: u.max_dif_rel_pct,
    dia: u.exemplo.dia,
    soma: u.exemplo.soma_reservatorios_mwmed,
    subsistema: u.exemplo.subsistema_mwmed,
  }));
}

/* ======================================================================
 * P019 chuva, temperatura e clima
 * ==================================================================== */

/** Anomalia em %: "4,7% acima", "51,7% abaixo", "igual" (decidido no valor arredondado exibido). */
export function textoAnomaliaPct(a: number | null, casas = 1): string | null {
  if (a === null) return null;
  const r = Number(a.toFixed(casas));
  if (r === 0) return "igual à";
  return `${num(Math.abs(a), casas)}% ${r > 0 ? "acima" : "abaixo"} da`;
}

export function textoAnomaliaGraus(a: number | null, casas = 1): string | null {
  if (a === null) return null;
  const r = Number(a.toFixed(casas));
  if (r === 0) return "igual à";
  return `${num(Math.abs(a), casas)} °C ${r > 0 ? "acima" : "abaixo"} da`;
}

export function respostaChuva(b: AguaPrecipitacaoBacia, base: string): string {
  const onde = `na bacia do ${nomeProprio(b.bacia)}`;
  if (b.mm_30d === null) return `Sem estimativa de chuva de 30 dias ${onde} até ${dataBR(b.dia)}: algum dia da janela ficou abaixo de 80% de cobertura, e a soma nunca é feita com dia faltando.`;
  const partes: string[] = [];
  const an = textoAnomaliaPct(b.anomalia_30d_pct);
  partes.push(
    `Nos 30 dias até ${dataBR(b.dia)}, a estimativa por satélite é de ${num(b.mm_30d, 1)} mm de chuva ${onde}${an ? `, ${an} média dos mesmos dias em ${periodoBase(base)} (${num(b.media_30d_base, 1)} mm)` : ""}${
      b.p10_30d !== null && b.p90_30d !== null ? `; 10º a 90º percentil: ${num(b.p10_30d, 1)} a ${num(b.p90_30d, 1)} mm; percentil ${num(b.percentil_30d, 1)}` : ""
    }.`,
  );
  if (b.preliminar_30d) partes.push("A janela tem dias do IMERG Late, ainda sem calibração por pluviômetros (preliminar).");
  return partes.join(" ");
}

export function respostaTemperatura(t: AguaTemperatura, base: string): string {
  const de = DO_REGIAO[t.recorte];
  if (t.media_30d_c === null) return `Sem temperatura de 30 dias ${de} até ${dataBR(t.dia)}: falta dia com cobertura suficiente na janela.`;
  const an = textoAnomaliaGraus(t.anomalia_30d_c);
  const partes = [
    `Nos 30 dias até ${dataBR(t.dia)}, a temperatura média ${de} foi de ${num(t.media_30d_c, 2)} °C${an ? `, ${an} média dos mesmos dias em ${periodoBase(base)} (${num(t.media_30d_base_c, 2)} °C; percentil ${num(t.percentil_30d, 1)})` : ""}.`,
    `É estimativa de reanálise, média das UF ponderada pela população.`,
  ];
  if (t.preliminar_30d) partes.push("Os dias mais recentes vêm do GEOS-IT e ainda serão trocados pelo MERRA-2 (preliminar).");
  return partes.join(" ");
}

export function textoAssociacao(b: AguaPrecipitacaoBacia): string | null {
  const a = b.associacao_ena;
  if (!a || (a.r_mesmo_mes === null && a.r_mes_seguinte === null)) return null;
  return `Associação, não causa: de ${periodoBase(a.periodo)}, a correlação entre a anomalia mensal de chuva e a ENA em % da MLT da bacia foi de ${num(a.r_mesmo_mes, 2)} no mesmo mês (${plural(a.n_mesmo_mes, "mês", "meses")}) e de ${num(a.r_mes_seguinte, 2)} com a ENA do mês seguinte (${plural(a.n_mes_seguinte, "mês", "meses")}).`;
}

/** Período do mapa: "30d" (janela até o último dia) ou um dos 12 meses completos publicados. */
export function periodosMapa(lista: readonly AguaPrecipitacaoBacia[]): string[] {
  const meses = lista.find((b) => b.mensal.m.length)?.mensal.m ?? [];
  return ["30d", ...[...meses].reverse()];
}

export function rotuloPeriodoMapa(per: string, dia: string | null): string {
  return per === "30d" ? `30 dias até ${dataBR(dia)}` : mesAno(per);
}

/** Anomalia por bacia no período escolhido (mesmo número da tabela). */
export function valoresMapaChuva(lista: readonly AguaPrecipitacaoBacia[], per: string): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const b of lista) {
    if (per === "30d") out[b.bacia] = b.anomalia_30d_pct;
    else {
      const i = b.mensal.m.indexOf(per);
      out[b.bacia] = i >= 0 ? (b.mensal.anomalia_pct[i] ?? null) : null;
    }
  }
  return out;
}

/** Quebras fixas (escala igual em todos os períodos, seção 8.3): de muito abaixo a muito acima da média. */
export const CORTES_ANOMALIA = [-50, -10, 10, 50, 100] as const;
export const CORES_ANOMALIA = [
  "var(--escala-div-neg-2)",
  "var(--escala-div-neg-1)",
  "var(--escala-div-centro)",
  "var(--escala-div-pos-1)",
  "var(--escala-seq-4)",
  "var(--escala-seq-5)",
] as const;

export function classificacaoChuva(valores: Record<string, number | null>): Classificacao {
  return quebrasFixas(CORTES_ANOMALIA, Object.values(valores), { casas: 0, formatar: (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), 0)}%` });
}

export const COLUNAS_CHUVA: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Bacia", tipo: "texto" },
  { id: "mm", rotulo: "Chuva", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "media", rotulo: "Média da base", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "p10", rotulo: "10º percentil", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "p90", rotulo: "90º percentil", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "anomalia", rotulo: "Anomalia", tipo: "percentual", casas: 1 },
  { id: "percentil", rotulo: "Percentil", tipo: "numero", casas: 1 },
  { id: "preliminar", rotulo: "IMERG Late (preliminar)", tipo: "texto", categorica: true },
  { id: "cobertura", rotulo: "Cobertura média", tipo: "percentual", casas: 1 },
  { id: "r_mesmo_mes", rotulo: "Correlação com a ENA no mesmo mês", tipo: "numero", casas: 2 },
  { id: "r_mes_seguinte", rotulo: "Correlação com a ENA do mês seguinte", tipo: "numero", casas: 2 },
  { id: "bacia", rotulo: "Nome no ONS", tipo: "texto" },
];

/** Linhas da tabela equivalente ao mapa (mesmo período, mesmos valores). */
export function linhasChuva(lista: readonly AguaPrecipitacaoBacia[], per: string): LinhaTabela[] {
  return lista.map((b) => {
    const i = per === "30d" ? -1 : b.mensal.m.indexOf(per);
    const mensal = per !== "30d";
    const prelimMes = mensal && b.mensal.preliminar_desde !== null && per >= b.mensal.preliminar_desde;
    return {
      id: b.bacia,
      rotulo: rotuloRecorte("bacia", b.bacia),
      mm: mensal ? (i >= 0 ? (b.mensal.mm[i] ?? null) : null) : b.mm_30d,
      media: mensal ? (i >= 0 ? (b.mensal.media[i] ?? null) : null) : b.media_30d_base,
      p10: mensal ? (i >= 0 ? (b.mensal.p10[i] ?? null) : null) : b.p10_30d,
      p90: mensal ? (i >= 0 ? (b.mensal.p90[i] ?? null) : null) : b.p90_30d,
      anomalia: mensal ? (i >= 0 ? (b.mensal.anomalia_pct[i] ?? null) : null) : b.anomalia_30d_pct,
      percentil: mensal ? null : b.percentil_30d,
      preliminar: (mensal ? prelimMes : b.preliminar_30d) ? "sim" : "não",
      cobertura: mensal ? null : b.cobertura_media_pct,
      r_mesmo_mes: b.associacao_ena?.r_mesmo_mes ?? null,
      r_mes_seguinte: b.associacao_ena?.r_mes_seguinte ?? null,
      bacia: b.bacia,
    };
  });
}

export type PontoMensalChuva = { m: string; mm: number | null; media: number | null; p10: number | null; p90: number | null };

export function serieMensalChuva(b: AguaPrecipitacaoBacia): PontoMensalChuva[] {
  return b.mensal.m.map((m, i) => ({ m, mm: b.mensal.mm[i] ?? null, media: b.mensal.media[i] ?? null, p10: b.mensal.p10[i] ?? null, p90: b.mensal.p90[i] ?? null }));
}

/** Pequenos múltiplos de bacias: chuva do mês e média de cada uma ("bacia", "bacia·media"). */
export function linhasMultiplosChuva(lista: readonly AguaPrecipitacaoBacia[]): Record<string, string | number | null>[] {
  const meses = lista[0]?.mensal.m ?? [];
  return meses.map((m) => {
    const l: Record<string, string | number | null> = { m };
    for (const b of lista) {
      const i = b.mensal.m.indexOf(m);
      l[b.bacia] = i >= 0 ? (b.mensal.mm[i] ?? null) : null;
      l[`${b.bacia}·media`] = i >= 0 ? (b.mensal.media[i] ?? null) : null;
    }
    return l;
  });
}

export type PontoTemperaturaDiaria = { d: string; t: number | null; tmax: number | null; p10: number | null; p90: number | null };

export function serieDiariaTemperatura(t: AguaTemperatura): PontoTemperaturaDiaria[] {
  const s = t.diaria;
  return diasRegulares(s.d0, s.passo_dias, s.t.length).map((d, i) => ({ d, t: s.t[i] ?? null, tmax: s.tmax[i] ?? null, p10: s.p10[i] ?? null, p90: s.p90[i] ?? null }));
}

export type PontoTemperaturaMensal = { m: string; t: number | null; media: number | null; anomalia: number | null };

export function serieMensalTemperatura(t: AguaTemperatura): PontoTemperaturaMensal[] {
  return t.mensal.m.map((m, i) => ({ m, t: t.mensal.t[i] ?? null, media: t.mensal.media[i] ?? null, anomalia: t.mensal.anomalia_c[i] ?? null }));
}

export const COLUNAS_TEMPERATURA: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Recorte", tipo: "texto" },
  { id: "dia", rotulo: "Último dia", tipo: "data" },
  { id: "media", rotulo: "Média de 30 dias", tipo: "numero", unidade: "°C", casas: 2 },
  { id: "base", rotulo: "Média da base", tipo: "numero", unidade: "°C", casas: 2 },
  { id: "anomalia", rotulo: "Anomalia", tipo: "numero", unidade: "°C", casas: 1 },
  { id: "p10", rotulo: "10º percentil", tipo: "numero", unidade: "°C", casas: 2 },
  { id: "p90", rotulo: "90º percentil", tipo: "numero", unidade: "°C", casas: 2 },
  { id: "percentil", rotulo: "Percentil", tipo: "numero", casas: 1 },
  { id: "anos_base", rotulo: "Anos na base", tipo: "numero", casas: 0 },
  { id: "preliminar", rotulo: "GEOS-IT (preliminar)", tipo: "texto", categorica: true },
];

export function linhasTemperatura(lista: readonly AguaTemperatura[]): LinhaTabela[] {
  return [...lista]
    .sort((a, b) => REGIOES.indexOf(a.recorte) - REGIOES.indexOf(b.recorte))
    .map((t) => ({
      id: t.recorte,
      rotulo: NOME_REGIAO[t.recorte],
      dia: t.dia,
      media: t.media_30d_c,
      base: t.media_30d_base_c,
      anomalia: t.anomalia_30d_c,
      p10: t.p10_30d_c,
      p90: t.p90_30d_c,
      percentil: t.percentil_30d,
      anos_base: t.anos_base,
      preliminar: t.preliminar_30d ? "sim" : "não",
    }));
}

/* --- previsão --- */

/** "30/09/2026 00h UTC" a partir de "2026-09-30T00:00Z". */
export function rotuloRodada(emitidaEm: string): string {
  return `${dataBR(emitidaEm.slice(0, 10))} ${emitidaEm.slice(11, 13)}h UTC`;
}

export function respostaPrevisao(pv: AguaPrevisao, bacia: string): string {
  const b = pv.bacias.find((x) => x.bacia === bacia);
  const fim7 = somarDias(pv.d0, 6);
  const fimN = somarDias(pv.d0, pv.n_dias - 1);
  const cab = `Previsão, não observação: rodada de ${rotuloRodada(pv.emitida_em)} do ECMWF IFS 0,25°`;
  if (!b || b.mm_7d === null) return `${cab}; sem previsão completa para a bacia do ${nomeProprio(bacia)}.`;
  return `${cab}, ${num(b.mm_7d, 1)} mm de chuva na bacia do ${nomeProprio(bacia)} de ${dataBR(pv.d0)} a ${dataBR(fim7)} e ${num(b.mm_total, 1)} mm até ${dataBR(fimN)}. A média IMERG dos mesmos dias em ${b.anos_climatologia} anos é de ${num(b.imerg_media_7d_mm, 1)} mm e ${num(b.imerg_media_total_mm, 1)} mm: outro produto, só ordem de grandeza.`;
}

export const COLUNAS_PREVISAO_CHUVA: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Bacia", tipo: "texto" },
  { id: "mm_7d", rotulo: "Prevista, 7 dias", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "imerg_7d", rotulo: "Média IMERG, mesmos 7 dias", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "mm_total", rotulo: "Prevista, todos os dias", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "imerg_total", rotulo: "Média IMERG, mesmos dias", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "bacia", rotulo: "Nome no ONS", tipo: "texto" },
];

export function linhasPrevisaoChuva(pv: AguaPrevisao): LinhaTabela[] {
  return pv.bacias.map((b) => ({
    id: b.bacia,
    rotulo: rotuloRecorte("bacia", b.bacia),
    mm_7d: b.mm_7d,
    imerg_7d: b.imerg_media_7d_mm,
    mm_total: b.mm_total,
    imerg_total: b.imerg_media_total_mm,
    bacia: b.bacia,
  }));
}

export const COLUNAS_PREVISAO_TEMPERATURA: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Recorte", tipo: "texto" },
  { id: "t_7d", rotulo: "Média prevista, 7 dias", tipo: "numero", unidade: "°C", casas: 2 },
  { id: "merra2_7d", rotulo: "Média MERRA-2, mesmos dias", tipo: "numero", unidade: "°C", casas: 2 },
];

export function linhasPrevisaoTemperatura(pv: AguaPrevisao): LinhaTabela[] {
  return [...pv.temperatura]
    .sort((a, b) => REGIOES.indexOf(a.recorte) - REGIOES.indexOf(b.recorte))
    .map((t) => ({ id: t.recorte, rotulo: NOME_REGIAO[t.recorte], t_7d: t.t_media_7d_c, merra2_7d: t.merra2_media_7d_c }));
}

/** Previsão diária (mm) da bacia escolhida e temperatura média prevista por recorte (°C), por dia UTC. */
export function seriePrevisao(pv: AguaPrevisao, bacia: string): ({ d: string; mm: number | null } & Partial<Record<Regiao, number | null>>)[] {
  const b = pv.bacias.find((x) => x.bacia === bacia);
  return diasRegulares(pv.d0, 1, pv.n_dias).map((d, i) => {
    const l: { d: string; mm: number | null } & Partial<Record<Regiao, number | null>> = { d, mm: b ? (b.mm[i] ?? null) : null };
    for (const t of pv.temperatura) l[t.recorte] = t.t[i] ?? null;
    return l;
  });
}

/* --- cobertura e conferência --- */

export const COLUNAS_VALIDACAO: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Bacia", tipo: "texto" },
  { id: "meses", rotulo: "Meses comparados", tipo: "numero", casas: 0 },
  { id: "estacoes_mediana", rotulo: "Estações por mês (mediana)", tipo: "numero", casas: 0 },
  { id: "imerg_mm", rotulo: "IMERG", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "estacoes_mm", rotulo: "Estações", tipo: "numero", unidade: "mm", casas: 1 },
  { id: "vies_pct", rotulo: "Viés do IMERG", tipo: "percentual", casas: 1 },
  { id: "correlacao", rotulo: "Correlação mensal", tipo: "numero", casas: 2 },
];

export function linhasValidacao(v: NonNullable<import("./tipos-agua").AguaClima>["validacao_estacoes"]): LinhaTabela[] {
  return v.bacias.map((b) => ({ id: b.bacia, rotulo: rotuloRecorte("bacia", b.bacia), ...b }));
}

export const COLUNAS_COBERTURA_CHUVA: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Bacia", tipo: "texto" },
  { id: "pontos", rotulo: "Pontos de grade", tipo: "numero", casas: 0 },
  { id: "passos", rotulo: "Passo da grade", tipo: "texto" },
  { id: "poligonos", rotulo: "Polígonos do ONS", tipo: "texto" },
];

export function linhasCoberturaChuva(c: NonNullable<import("./tipos-agua").AguaClima>["cobertura_precipitacao"]): LinhaTabela[] {
  return c.map((x) => ({
    id: x.bacia,
    rotulo: rotuloRecorte("bacia", x.bacia),
    pontos: x.pontos,
    passos: x.passos_grau.map((p) => `${num(p, p < 0.25 ? 1 : 2)}°`).join(", "),
    poligonos: x.poligonos.map(nomeProprio).join(", "),
  }));
}

export const COLUNAS_COBERTURA_TEMPERATURA: ColunaTabela[] = [
  { id: "uf", rotulo: "UF", tipo: "texto" },
  { id: "subsistema", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "celulas", rotulo: "Células MERRA-2", tipo: "numero", casas: 0 },
  { id: "populacao_uf", rotulo: "População da UF", tipo: "numero", casas: 0 },
  { id: "populacao_nas_celulas", rotulo: "População nas células", tipo: "numero", casas: 0 },
  { id: "cobertura_pct", rotulo: "Cobertura", tipo: "percentual", casas: 1 },
];

export function linhasCoberturaTemperatura(c: NonNullable<import("./tipos-agua").AguaClima>["cobertura_temperatura"]): LinhaTabela[] {
  return c.map((x) => ({ id: x.uf, ...x, subsistema: x.subsistema ? NOME_REGIAO[x.subsistema] : null }));
}

/* ======================================================================
 * P020 reservatórios e balanço
 * ==================================================================== */

export const ROTULO_CONVENCAO: Record<AguaConvencaoDefluencia, string> = {
  inclui_outras: "defluência inclui as outras estruturas",
  exclui_outras: "defluência não inclui as outras estruturas",
  sem_outras_estruturas: "sem outras estruturas",
  indeterminada: "convenção indeterminada",
};

export function respostaDecomposicao(d: AguaDecomposicaoEar): string {
  const de = DO_REGIAO[d.sm];
  const fmt = (x: { nome: string | null; cod: string; delta_mwmes: number | null }) => `${nomeProprio(x.nome ?? x.cod)} (${sinal(x.delta_mwmes, 1)})`;
  const partes = [
    `De ${dataBR(d.inicio)} a ${dataBR(d.fim)}, a EAR ${de} variou ${sinal(d.delta_ear_mwmes, 1)} MWmês. A soma das variações dos ${d.n_reservatorios} reservatórios que contam no subsistema (parte própria e parte a jusante) dá ${sinal(d.soma_reservatorios_mwmes, 1)} MWmês, com resíduo de ${num(d.residuo_mwmes, 3)} MWmês.`,
  ];
  const quedas = d.maiores_quedas.filter((x) => (x.delta_mwmes ?? 0) < 0).slice(0, 3);
  const altas = d.maiores_altas.filter((x) => (x.delta_mwmes ?? 0) > 0).slice(0, 3);
  if (quedas.length || altas.length) {
    partes.push(
      `${quedas.length ? `Maiores quedas, em MWmês: ${listaTexto(quedas.map(fmt))}` : "Nenhuma queda"}${altas.length ? `; maiores altas: ${listaTexto(altas.map(fmt))}` : "; nenhuma alta"}.`,
    );
  }
  const c = d.contexto;
  partes.push(
    `Contexto da mesma janela, que não fecha balanço com a variação da EAR: ENA bruta média de ${num(c.ena_bruta_media_mwmed, 0)} MWmed e geração hidráulica média de ${num(c.geracao_hidraulica_media_mwmed, 0)} MWmed.`,
  );
  return partes.join(" ");
}

export type BarraParcela = { id: string; rotulo: string; delta: number | null; cod: string; parte: string };

/** Barras da decomposição: as maiores quedas e altas publicadas, da maior queda à maior alta. */
export function barrasDecomposicao(d: AguaDecomposicaoEar): BarraParcela[] {
  const vistos = new Set<string>();
  const todas = [...d.maiores_quedas, ...d.maiores_altas].filter((x) => {
    const k = `${x.cod}:${x.parte}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  return todas
    .sort((a, b) => (a.delta_mwmes ?? 0) - (b.delta_mwmes ?? 0))
    .map((x) => ({
      id: `${x.cod}:${x.parte}`,
      rotulo: `${nomeProprio(x.nome ?? x.cod)}${x.parte === "jusante" ? " (a jusante)" : ""}`,
      delta: x.delta_mwmes,
      cod: x.cod,
      parte: x.parte,
    }));
}

export const COLUNAS_DECOMPOSICAO: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Reservatório", tipo: "texto" },
  { id: "parte", rotulo: "Parte", tipo: "texto", categorica: true },
  { id: "delta", rotulo: "Variação da EAR", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "cod", rotulo: "Código da usina", tipo: "texto" },
];

export function linhasDecomposicao(d: AguaDecomposicaoEar): LinhaTabela[] {
  return barrasDecomposicao(d).map((b) => ({ id: b.id, rotulo: b.rotulo, parte: ROTULO_PARTE[b.parte] ?? b.parte, delta: b.delta, cod: b.cod }));
}

export const COLUNAS_DECOMPOSICAO_SUBSISTEMAS: ColunaTabela[] = [
  { id: "sm", rotulo: "Subsistema", tipo: "texto" },
  { id: "inicio", rotulo: "De", tipo: "data" },
  { id: "fim", rotulo: "Até", tipo: "data" },
  { id: "delta", rotulo: "Variação da EAR", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "soma", rotulo: "Soma dos reservatórios", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "residuo", rotulo: "Resíduo", tipo: "numero", unidade: "MWmês", casas: 3 },
  { id: "n", rotulo: "Reservatórios", tipo: "numero", casas: 0 },
  { id: "ena", rotulo: "ENA bruta média (contexto)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "ena_arm", rotulo: "ENA armazenável média (contexto)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "geracao", rotulo: "Geração hidráulica média (contexto)", tipo: "numero", unidade: "MWmed", casas: 0 },
];

export function linhasDecomposicaoSubsistemas(ds: readonly AguaDecomposicaoEar[]): LinhaTabela[] {
  return ds.map((d) => ({
    id: d.sm,
    sm: NOME_REGIAO[d.sm],
    inicio: d.inicio,
    fim: d.fim,
    delta: d.delta_ear_mwmes,
    soma: d.soma_reservatorios_mwmes,
    residuo: d.residuo_mwmes,
    n: d.n_reservatorios,
    ena: d.contexto.ena_bruta_media_mwmed,
    ena_arm: d.contexto.ena_armazenavel_media_mwmed,
    geracao: d.contexto.geracao_hidraulica_media_mwmed,
  }));
}

/** Reservatório padrão: o de maior volume útil com balanço calculado (o da ficha de prova). */
export function reservatorioPadrao(lista: readonly AguaReservatorio[]): string {
  const x = [...lista].filter((r) => r.balanco_calculado).sort((a, b) => (b.vol_util_total_hm3 ?? -1) - (a.vol_util_total_hm3 ?? -1))[0];
  return x?.id ?? lista[0]?.id ?? "";
}

/** O reservatório de uma parcela da decomposição, pelo código da usina (nunca pelo nome). */
export function reservatorioDaParcela(lista: readonly AguaReservatorio[], cod: string): AguaReservatorio | null {
  return lista.find((r) => r.cod === cod) ?? null;
}

export function respostaBalanco(r: AguaReservatorio, res: Pick<AguaReservatorios, "inicio" | "fim" | "periodo_fecham_por_construcao">): string {
  const nome = nomeProprio(r.nome);
  if (!r.balanco_calculado || r.dv_obs_hm3 === null || r.residuo_hm3 === null) {
    return `${nome}: sem balanço de 30 dias de ${dataBR(res.inicio)} a ${dataBR(res.fim)} (falta volume ou vazão na janela, ou volume útil no cadastro; o motivo está em agua_reservatorios.csv). Nada é preenchido.`;
  }
  const dv = r.dv_obs_hm3;
  const sentido = Number(dv.toFixed(1)) < 0 ? "caiu" : Number(dv.toFixed(1)) > 0 ? "subiu" : "ficou estável, com variação de";
  const saidas = [
    r.turbinado_hm3 !== null ? `${num(r.turbinado_hm3, 1)} turbinados` : null,
    r.vertido_hm3 !== null ? `${num(r.vertido_hm3, 1)} vertidos` : null,
    r.outras_estruturas_hm3 !== null && r.outras_estruturas_hm3 !== 0
      ? `${num(r.outras_estruturas_hm3, 1)} por outras estruturas${r.convencao_defluencia === "exclui_outras" ? ", publicados à parte e fora da defluência" : ""}`
      : null,
  ].filter((x): x is string => x !== null);
  const partes = [
    `De ${dataBR(res.inicio)} a ${dataBR(res.fim)}, o volume de ${nome} ${sentido} ${num(Math.abs(dv), 1)} hm³ e terminou em ${pct(r.vol_util_pct_fim, 2)} do volume útil. Entraram ${num(r.afluencia_hm3, 1)} hm³ (afluência) e saíram ${num(r.defluencia_hm3, 1)} hm³ (defluência${saidas.length ? `: ${listaTexto(saidas)}` : ""}). O resíduo do balanço, variação observada menos afluência mais defluência, é de ${sinal(r.residuo_hm3, 2)} hm³.`,
  ];
  if (r.transferido_hm3 !== null && r.transferido_hm3 !== 0) {
    partes.push(
      `Houve transferência de ${sinal(r.transferido_hm3, 1)} hm³; somada ao resíduo, ${sinal(r.residuo_com_transferencia_hm3, 2)} hm³ (a convenção de sinal da transferência não é documentada pelo ONS).`,
    );
  }
  const s = r.serie_dias_residuo_dentro_tolerancia_pct;
  const per = res.periodo_fecham_por_construcao ? `de ${dataBR(res.periodo_fecham_por_construcao.inicio)} a ${dataBR(res.periodo_fecham_por_construcao.fim)}` : "da série";
  if (s !== null) {
    partes.push(
      s >= 95
        ? `Em ${pct(s, 1)} dos dias ${per} o resíduo diário fica dentro do arredondamento: a afluência publicada é calculada pelo próprio balanço, e o fechamento não é prova independente.`
        : `Só ${pct(s, 1)} dos dias ${per} fecham dentro do arredondamento: nos demais, o balanço com os dados publicados não fecha, e o resíduo é informação, não ajuste.`,
    );
  }
  return partes.join(" ");
}

export type BarraBalanco = { id: string; rotulo: string; v: number | null };

/** Componentes do balanço de 30 dias em hm³, na ordem da identidade (a vazão natural vem como contexto). */
export function barrasBalanco(r: AguaReservatorio): BarraBalanco[] {
  return [
    { id: "dv", rotulo: "Variação observada do volume", v: r.dv_obs_hm3 },
    { id: "afl", rotulo: "Afluência", v: r.afluencia_hm3 },
    { id: "defl", rotulo: "Defluência", v: r.defluencia_hm3 },
    { id: "turb", rotulo: "Turbinado", v: r.turbinado_hm3 },
    { id: "vert", rotulo: "Vertido", v: r.vertido_hm3 },
    { id: "outras", rotulo: "Outras estruturas", v: r.outras_estruturas_hm3 },
    { id: "nd", rotulo: "Defluência não discriminada", v: r.defluencia_nao_discriminada_hm3 },
    { id: "transf", rotulo: "Transferência", v: r.transferido_hm3 },
    { id: "res", rotulo: "Resíduo do balanço", v: r.residuo_hm3 },
    { id: "nat", rotulo: "Vazão natural (contexto, fora do balanço)", v: r.natural_hm3 },
  ];
}

export const COLUNAS_RESERVATORIOS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Reservatório", tipo: "texto" },
  { id: "subsistema", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "bacia", rotulo: "Bacia", tipo: "texto", categorica: true },
  { id: "ear_max_mwmes", rotulo: "EAR máxima", tipo: "numero", unidade: "MWmês", casas: 1 },
  { id: "vol_util_total_hm3", rotulo: "Volume útil", tipo: "numero", unidade: "hm³", casas: 1 },
  { id: "vol_util_pct_fim", rotulo: "Volume no fim", tipo: "percentual", casas: 2 },
  { id: "dv_obs_hm3", rotulo: "Variação observada", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "afluencia_hm3", rotulo: "Afluência", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "defluencia_hm3", rotulo: "Defluência", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "turbinado_hm3", rotulo: "Turbinado", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "vertido_hm3", rotulo: "Vertido", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "outras_estruturas_hm3", rotulo: "Outras estruturas", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "defluencia_nao_discriminada_hm3", rotulo: "Não discriminada", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "transferido_hm3", rotulo: "Transferência", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "residuo_hm3", rotulo: "Resíduo", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "residuo_com_transferencia_hm3", rotulo: "Resíduo com transferência", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "natural_hm3", rotulo: "Vazão natural (contexto)", tipo: "numero", unidade: "hm³", casas: 2 },
  { id: "janela_pct", rotulo: "Dias dentro do arredondamento, janela", tipo: "percentual", casas: 1 },
  { id: "serie_pct", rotulo: "Dias dentro do arredondamento, série", tipo: "percentual", casas: 1 },
  { id: "convencao", rotulo: "Convenção da defluência", tipo: "texto", categorica: true },
  { id: "balanco", rotulo: "Balanço calculado", tipo: "texto", categorica: true },
  { id: "id", rotulo: "Identificador no ONS", tipo: "texto" },
];

export function linhasReservatorios(lista: readonly AguaReservatorio[]): LinhaTabela[] {
  return lista.map((r) => ({
    id: r.id,
    rotulo: nomeProprio(r.nome),
    subsistema: r.subsistema && ehRegiao(r.subsistema) ? NOME_REGIAO[r.subsistema] : r.subsistema,
    bacia: r.bacia ? nomeProprio(r.bacia) : null,
    ear_max_mwmes: r.ear_max_mwmes,
    vol_util_total_hm3: r.vol_util_total_hm3,
    vol_util_pct_fim: r.vol_util_pct_fim,
    dv_obs_hm3: r.dv_obs_hm3,
    afluencia_hm3: r.afluencia_hm3,
    defluencia_hm3: r.defluencia_hm3,
    turbinado_hm3: r.turbinado_hm3,
    vertido_hm3: r.vertido_hm3,
    outras_estruturas_hm3: r.outras_estruturas_hm3,
    defluencia_nao_discriminada_hm3: r.defluencia_nao_discriminada_hm3,
    transferido_hm3: r.transferido_hm3,
    residuo_hm3: r.residuo_hm3,
    residuo_com_transferencia_hm3: r.residuo_com_transferencia_hm3,
    natural_hm3: r.natural_hm3,
    janela_pct: r.dias_residuo_dentro_tolerancia_pct,
    serie_pct: r.serie_dias_residuo_dentro_tolerancia_pct,
    convencao: ROTULO_CONVENCAO[r.convencao_defluencia] ?? r.convencao_defluencia,
    balanco: r.balanco_calculado ? "sim" : "não",
  }));
}

export type PontoReservatorio = { d: string; vol: number | null; afl: number | null; defl: number | null; turb: number | null; vert: number | null };

export function serieReservatorio(s: AguaSerieReservatorio | null | undefined): PontoReservatorio[] {
  if (!s) return [];
  return diasRegulares(s.d0, s.passo_dias, s.vol.length).map((d, i) => ({
    d,
    vol: s.vol[i] ?? null,
    afl: s.afl[i] ?? null,
    defl: s.defl[i] ?? null,
    turb: s.turb[i] ?? null,
    vert: s.vert[i] ?? null,
  }));
}

/** Volume (% do volume útil) de até quatro reservatórios, uma coluna por id. */
export function linhasMultiplosVolume(series: readonly AguaSerieReservatorio[]): Record<string, string | number | null>[] {
  const base = series[0];
  if (!base) return [];
  return diasRegulares(base.d0, base.passo_dias, base.vol.length).map((d, i) => {
    const l: Record<string, string | number | null> = { d };
    for (const s of series) l[s.id] = s.d0 === base.d0 ? (s.vol[i] ?? null) : null;
    return l;
  });
}

export function textoFechamento(r: Pick<AguaReservatorios, "n_reservatorios" | "n_com_balanco" | "n_fecham_por_construcao" | "n_fecham_na_janela" | "criterio_fecham_por_construcao" | "periodo_fecham_por_construcao" | "sem_balanco_por_motivo" | "convencao_defluencia">): string {
  const motivos = Object.entries(r.sem_balanco_por_motivo).map(([m, n]) => `${n} ${m}`);
  const conv = r.convencao_defluencia;
  return [
    `${plural(r.n_com_balanco, "reservatório tem", "reservatórios têm")} balanço de 30 dias, de ${r.n_reservatorios} nos dados hidráulicos do ONS${motivos.length ? `; sem balanço: ${listaTexto(motivos)}` : ""}.`,
    `${plural(r.n_fecham_por_construcao, "reservatório fecha", "reservatórios fecham")} por construção (${r.criterio_fecham_por_construcao}${r.periodo_fecham_por_construcao ? `, de ${dataBR(r.periodo_fecham_por_construcao.inicio)} a ${dataBR(r.periodo_fecham_por_construcao.fim)}` : ""}); na janela de 30 dias, ${r.n_fecham_na_janela}.`,
    `Convenção da defluência detectada nos dados: ${conv.inclui_outras ?? 0} incluem as outras estruturas, ${conv.exclui_outras ?? 0} não incluem, ${conv.sem_outras_estruturas ?? 0} não têm outras estruturas e ${conv.indeterminada ?? 0} ${conv.indeterminada === 1 ? "fica indeterminado" : "ficam indeterminados"}.`,
  ].join(" ");
}

/* ---------- textos gerais ---------- */

/** Nenhum texto gerado usa travessão nem hífen solto como pontuação (regra de estilo testada). */
export const PONTUACAO_PROIBIDA = /\s[–—-]\s|—/;
