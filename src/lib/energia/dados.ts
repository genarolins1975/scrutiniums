import { carimbo, dataBR, num, plural } from "./formato";
import { NAO_SE_APLICA } from "./escalas";
import { tx } from "./idioma";
import { FREQUENCIA_EN, rotuloDado } from "./i18n/regulacao-dados-metodo";
import { textoData, type ColunaTabela, type LinhaTabela } from "./tabela";
import type {
  Afirmacao,
  Cadencia,
  CatalogoDados,
  ConjuntoIntegrado,
  DiaCalendario,
  EntradaDados,
  EstadoDados,
  EtapaId,
  ItemManifesto,
  ManifestoGold,
  PublicacaoGold,
  SituacaoAtualidade,
} from "./tipos-dados";

/**
 * Derivações puras das páginas de Dados e Metodologia (P067 a P070): linhas das tabelas,
 * respostas curtas e conferências. Nada aqui recalcula indicador do pipeline: contagens,
 * estados, SLA, revisões e sha256 chegam prontos das golds (catalogo.json, publicacao.json,
 * manifesto.json, metricas.json); a página escolhe colunas, ordena e escreve o texto a partir
 * dos números. Estado ausente é ausência, nunca valor de reserva.
 *
 * Data de referência: as golds de Dados trazem a data do processamento (referencia.hoje).
 * Toda situação (em dia, atrasado) vale para essa data e as páginas a escrevem, nunca "hoje".
 *
 * Sem leitura de disco: este módulo também roda no navegador (colunas, conferência de arquivo).
 * A leitura das golds no build está em dados-servidor.ts.
 *
 * Idioma: rótulos e frases passam por tx(), no idioma da página que os lê; as constantes exportadas
 * com texto leem o rótulo na hora (getter), para que o mesmo módulo sirva às duas versões da página.
 */

/* ---------------------------------------------------------------- páginas */

export const PAGINAS_DADOS = [
  {
    id: "catalogo",
    href: "/setor-eletrico/dados",
    get rotulo() { return tx("Catálogo", "Catalog"); },
    painel: "P067",
    get pergunta() { return tx("Quais dados estão de fato validados?", "Which data are actually validated?"); },
    modulo: "dados", // i18n: dado
  },
  {
    id: "saude",
    href: "/setor-eletrico/dados/saude",
    get rotulo() { return tx("Saúde e revisões", "Health and revisions"); },
    painel: "P068",
    get pergunta() { return tx("O que atrasou ou mudou?", "What is late or has changed?"); },
    modulo: "dados", // i18n: dado
  },
  {
    id: "reproducao",
    href: "/setor-eletrico/dados/reproducao",
    get rotulo() { return tx("Download e reprodução", "Download and reproduction"); },
    painel: "P069",
    get pergunta() { return tx("Consigo reproduzir este gráfico?", "Can I reproduce this chart?"); },
    modulo: "dados", // i18n: dado
  },
  {
    id: "regras",
    href: "/setor-eletrico/metodologia",
    get rotulo() { return tx("Metodologia", "Methodology"); },
    painel: "P070",
    get pergunta() { return tx("Quais interpretações são permitidas?", "Which interpretations are allowed?"); },
    modulo: "metodologia",
  },
  {
    id: "avaliacao",
    href: "/setor-eletrico/metodologia/avaliacao",
    get rotulo() { return tx("Avaliação dos painéis", "Panel evaluation"); },
    painel: "P071",
    get pergunta() { return tx("Como demonstrar que a qualidade evoluiu?", "How can we show that quality has improved?"); },
    modulo: "metodologia",
  },
] as const;

export type IdPaginaDados = (typeof PAGINAS_DADOS)[number]["id"];

export const URL_GOLD = {
  catalogo: "/energia/gold/catalogo.json",
  publicacao: "/energia/gold/publicacao.json",
  manifesto: "/energia/gold/manifesto.json",
  metricas: "/energia/gold/metricas.json",
  arquivos: "/energia/gold/arquivos.json",
} as const;

export const CSV_DADOS = {
  conjuntos: { get rotulo() { return tx("Saúde por conjunto integrado (CSV)", "Health by integrated dataset (CSV)"); }, url: "/energia/series/dados_conjuntos.csv" },
  calendario: { get rotulo() { return tx("Calendário de capturas, falhas e revisões (CSV)", "Calendar of captures, failures and revisions (CSV)"); }, url: "/energia/series/dados_calendario.csv" },
  revisoes: { get rotulo() { return tx("Revisões entre capturas (CSV)", "Revisions between captures (CSV)"); }, url: "/energia/series/dados_revisoes.csv" },
  validacoes: { get rotulo() { return tx("Validações por conjunto e por arquivo (CSV)", "Validations by dataset and by file (CSV)"); }, url: "/energia/series/dados_validacoes.csv" },
  catalogo: { get rotulo() { return tx("Catálogo com a descrição completa (CSV)", "Catalog with the full description (CSV)"); }, url: "/energia/series/dados_catalogo.csv" },
  eixos: { get rotulo() { return tx("Natureza e validação por ficha (CSV)", "Nature and validation by record (CSV)"); }, url: "/energia/series/dados_eixos.csv" },
  recursosCcee: { get rotulo() { return tx("Recursos da CCEE, um a um (CSV)", "CCEE resources, one by one (CSV)"); }, url: "/energia/series/dados_recursos_ccee.csv" },
  recursosAneel: { get rotulo() { return tx("Recursos da ANEEL, um a um (CSV)", "ANEEL resources, one by one (CSV)"); }, url: "/energia/series/dados_recursos_aneel.csv" },
  recursosOns: { get rotulo() { return tx("Recursos do ONS, um a um (CSV)", "ONS resources, one by one (CSV)"); }, url: "/energia/series/dados_recursos_ons.csv" },
} as const;

/* ---------------------------------------------------------------- escada do catálogo (P067) */

export const ESTADOS_ESCADA: readonly EstadoDados[] = ["CATALOGADO", "RECURSO VERIFICADO", "INTEGRADO", "VALIDADO", "PUBLICADO"];
export const ETAPAS: readonly { id: EtapaId; estado: EstadoDados; rotulo: string }[] = [
  { id: "catalogado", estado: "CATALOGADO", get rotulo() { return tx("Catalogado", "Cataloged"); } },
  { id: "recurso_verificado", estado: "RECURSO VERIFICADO", get rotulo() { return tx("Recurso verificado", "Resource verified"); } },
  { id: "integrado", estado: "INTEGRADO", get rotulo() { return tx("Integrado", "Integrated"); } },
  { id: "validado", estado: "VALIDADO", get rotulo() { return tx("Validado", "Validated"); } },
  { id: "publicado", estado: "PUBLICADO", get rotulo() { return tx("Publicado", "Published"); } },
];

export const ROTULO_ESTADO_DADOS: Record<EstadoDados, string> = {
  get CATALOGADO() { return tx("Catalogado", "Cataloged"); },
  get "RECURSO VERIFICADO"() { return tx("Recurso verificado", "Resource verified"); },
  get INTEGRADO() { return tx("Integrado", "Integrated"); },
  get VALIDADO() { return tx("Validado", "Validated"); },
  get PUBLICADO() { return tx("Publicado", "Published"); },
};

export const rankEstado = (e: EstadoDados): number => ESTADOS_ESCADA.indexOf(e);

export type SituacaoEtapa = "sim" | "nao" | "falhou";

/**
 * Etapas da escada de uma entrada. A escada é cumulativa: a etapa vale quando o estado calculado
 * a alcançou. "falhou" só no recurso verificado: o pipeline tentou o arquivo e a requisição
 * parcial não deu certo (verificacao.ok === false), e o conjunto não foi acessado de outro modo.
 */
export function situacaoEtapas(e: Pick<EntradaDados, "estado" | "verificacao">): Record<EtapaId, SituacaoEtapa> {
  const r = rankEstado(e.estado);
  const out = {} as Record<EtapaId, SituacaoEtapa>;
  ETAPAS.forEach((et, i) => {
    out[et.id] = r >= i ? "sim" : "nao";
  });
  if (out.recurso_verificado === "nao" && e.verificacao?.ok === false) out.recurso_verificado = "falhou";
  return out;
}

/** Quantos conjuntos chegaram a cada estado ou além (a escada é cumulativa). */
export function contagemCumulativa(contagem: Partial<Record<EstadoDados, number>>): Record<EstadoDados, number> {
  const out = {} as Record<EstadoDados, number>;
  ESTADOS_ESCADA.forEach((s, i) => {
    out[s] = ESTADOS_ESCADA.slice(i).reduce((t, x) => t + (contagem[x] ?? 0), 0);
  });
  return out;
}

export const ROTULO_PAPEL: Record<string, string> = {
  get indicador() { return tx("indicador", "indicator"); },
  get modelo() { return tx("modelo", "model"); },
  get conferencia() { return tx("conferência", "cross-check"); },
  get contexto() { return tx("contexto", "context"); },
  get historico() { return tx("histórico", "history"); },
};

const rotulosTema = (): Record<string, string> =>
  tx(
    {
      preco: "Preço",
      hidrologia: "Hidrologia",
      geracao: "Geração",
      carga: "Carga",
      rede: "Rede",
      distribuicao: "Distribuição",
      expansao: "Expansão",
      regulacao: "Regulação",
      empresas: "Empresas",
      mercado: "Mercado",
      normas: "Normas",
      ambiente: "Ambiente",
      contexto: "Contexto",
      outros: "Outros",
    },
    {
      preco: "Price",
      hidrologia: "Hydrology",
      geracao: "Generation",
      carga: "Load",
      rede: "Grid",
      distribuicao: "Distribution",
      expansao: "Expansion",
      regulacao: "Regulation",
      empresas: "Companies",
      mercado: "Market",
      normas: "Rules",
      ambiente: "Environment",
      contexto: "Context",
      outros: "Other",
    },
  );
export const rotuloTema = (t: string) => rotulosTema()[t] ?? t;

/**
 * "mensal" e "Mensal" são a mesma declaração: a primeira letra em maiúscula. Em inglês, a declaração da fonte passa pela tabela exata
 * de frequências (sem entrada, fica a da fonte).
 */
function frequenciaLegivel(t: string | undefined): string {
  if (!t) return tx("não declarada", "not declared");
  const s = t.trim();
  if (!s) return tx("não declarada", "not declared");
  const pt = s[0].toUpperCase() + s.slice(1);
  return rotuloDado(FREQUENCIA_EN, pt);
}

/** Formatos de referência temporal que a coluna de data aceita ("2026", "2026-09", "2026-09-29" e hora): o resto fica sem dado. */
const REFERENCIA_ORDENAVEL = /^\d{4}(-\d{2}){0,2}(T\d{2}:\d{2})?$/;

/**
 * O que a lista do catálogo precisa de fora do próprio catálogo, já calculado pelo servidor: o nome legível de cada conjunto
 * (o título da fonte é um identificador em alguns), o último período dos dados (só os conjuntos integrados o têm, em publicacao.json)
 * e as fichas que existem (nem todo conjunto com endereço de ficha tem a página).
 */
export type ContextoCatalogo = {
  nomes?: ReadonlyMap<string, string>;
  periodos?: ReadonlyMap<string, string | null>;
  fichas?: ReadonlySet<string>;
};

/**
 * Linhas do catálogo para a lista e para a tabela; `n` é a posição em entradas (a ficha lê a entrada completa sob demanda).
 * O estado de cada linha é o MAIS AVANÇADO que o conjunto alcançou; os anteriores continuam valendo (a escada é cumulativa) e
 * aparecem no detalhe. Campo opcional sem valor fica ausente (sem dado), nunca zero.
 */
export function linhasCatalogo(cat: CatalogoDados, ctx: ContextoCatalogo = {}): LinhaTabela[] {
  const sim = tx("sim", "yes");
  const nao = tx("não", "no");
  const falhou = tx("falhou", "failed");
  return cat.entradas.map((e, n) => {
    const et = situacaoEtapas(e);
    const simnao = (s: SituacaoEtapa) => (s === "sim" ? sim : s === "falhou" ? falhou : nao);
    const periodo = ctx.periodos?.get(e.id) ?? null;
    return {
      id: e.id,
      n,
      titulo: ctx.nomes?.get(e.id) ?? e.titulo,
      orgao: e.orgao,
      tema: rotuloTema(e.tema),
      estado: ROTULO_ESTADO_DADOS[e.estado],
      etapas: ETAPAS.filter((x) => et[x.id] === "sim").length,
      verificado: simnao(et.recurso_verificado),
      integrado: simnao(et.integrado),
      validado: simnao(et.validado),
      publicado: simnao(et.publicado),
      uso: (e.papeis ?? []).length
        ? (e.papeis ?? []).map((p) => ROTULO_PAPEL[p] ?? p).join(tx(" e ", " and "))
        : e.usado_em.length
          ? ROTULO_PAPEL.indicador
          : tx("sem uso declarado", "no declared use"),
      ressalva: (e.ressalvas ?? []).length ? sim : nao,
      frequencia: frequenciaLegivel(e.frequencia_declarada),
      periodo: periodo && REFERENCIA_ORDENAVEL.test(periodo) ? periodo : null,
      modificado: e.modificado_na_fonte ?? e.recursos_resumo?.ultimo_publicado ?? null,
      recursos: e.recursos_resumo?.total ?? null,
      acessados: e.recursos_resumo ? (e.recursos_resumo.acessados ?? 0) : null,
      descontinuado: e.descontinuado ? sim : nao,
      ficha: e.slug && ctx.fichas?.has(e.slug) ? sim : nao,
      slug: e.slug && ctx.fichas?.has(e.slug) ? e.slug : null,
      baixar: e.slug && ctx.fichas?.has(e.slug) && (e.downloads ?? []).length ? (e.downloads ?? []).length : null,
      url: e.url ?? null,
      formatos: (e.formatos ?? []).join(", ") || null,
    };
  });
}

/* rótulos de coluna lidos na hora (getter), no idioma da página */
export const COLUNAS_CATALOGO: ColunaTabela[] = [
  { id: "titulo", get rotulo() { return tx("Conjunto", "Dataset"); }, tipo: "texto" },
  { id: "orgao", get rotulo() { return tx("Órgão", "Body"); }, tipo: "texto", categorica: true },
  { id: "tema", get rotulo() { return tx("Tema", "Theme"); }, tipo: "texto", categorica: true },
  { id: "estado", get rotulo() { return tx("Estado mais avançado", "Most advanced state"); }, tipo: "texto", categorica: true },
  { id: "etapas", get rotulo() { return tx("Etapas cumpridas (de 5)", "Stages completed (of 5)"); }, tipo: "numero", casas: 0 },
  { id: "verificado", get rotulo() { return tx("Recurso verificado", "Resource verified"); }, tipo: "texto", categorica: true, buscavel: false },
  { id: "integrado", get rotulo() { return tx("Integrado", "Integrated"); }, tipo: "texto", categorica: true, buscavel: false },
  { id: "validado", get rotulo() { return tx("Validado", "Validated"); }, tipo: "texto", categorica: true, buscavel: false },
  { id: "publicado", get rotulo() { return tx("Publicado", "Published"); }, tipo: "texto", categorica: true, buscavel: false },
  { id: "uso", get rotulo() { return tx("Uso declarado", "Declared use"); }, tipo: "texto", categorica: true },
  { id: "ressalva", get rotulo() { return tx("Ressalva declarada", "Declared caveat"); }, tipo: "texto", categorica: true, buscavel: false },
  { id: "descontinuado", get rotulo() { return tx("Descontinuado pela fonte", "Discontinued by the source"); }, tipo: "texto", categorica: true, buscavel: false },
  { id: "frequencia", get rotulo() { return tx("Frequência declarada pela fonte", "Frequency declared by the source"); }, tipo: "texto", categorica: true },
  { id: "periodo", get rotulo() { return tx("Último período dos dados", "Latest data period"); }, tipo: "data" },
  { id: "modificado", get rotulo() { return tx("Modificado na fonte", "Modified at the source"); }, tipo: "data" },
  { id: "recursos", get rotulo() { return tx("Recursos (arquivos)", "Resources (files)"); }, tipo: "numero", casas: 0 },
  { id: "acessados", get rotulo() { return tx("Arquivos acessados pelo observatório", "Files accessed by the observatory"); }, tipo: "numero", casas: 0 },
  { id: "ficha", get rotulo() { return tx("Ficha no observatório", "Record in the observatory"); }, tipo: "texto", categorica: true, buscavel: false },
  // i18n: dado
  { id: "baixar", get rotulo() { return tx("Arquivos para baixar", "Files to download"); }, tipo: "numero", casas: 0 },
  { id: "formatos", get rotulo() { return tx("Formatos", "Formats"); }, tipo: "texto", ordenavel: false },
];

/** Colunas só de apoio à lista (endereço da ficha e da página oficial): não vão para a tabela nem para o arquivo exportado. */
export const CAMPOS_DE_APOIO_DO_CATALOGO = ["n", "slug", "url"] as const;

/** Estados da etapa dada em diante: a escada é cumulativa, então "chegou pelo menos a X" é a lista de X até o fim. */
export const estadosAPartirDe = (e: EstadoDados): EstadoDados[] => ESTADOS_ESCADA.slice(rankEstado(e));

/** Opções do filtro "chegou pelo menos a": o rótulo diz "ou além" nas etapas que incluem as seguintes. */
export const ROTULO_ESTADO_ATE: Record<EstadoDados, string> = {
  get CATALOGADO() { return tx("Qualquer estado", "Any state"); },
  get "RECURSO VERIFICADO"() { return tx("Recurso verificado ou além", "Resource verified or beyond"); },
  get INTEGRADO() { return tx("Integrado ou além", "Integrated or beyond"); },
  get VALIDADO() { return tx("Validado ou além", "Validated or beyond"); },
  get PUBLICADO() { return tx("Publicado", "Published"); },
};

/** Cada etapa em uma frase curta, para o ponto de uso (o filtro e a legenda do estado); a definição técnica e o critério ficam em Analisar. */
export const DEFINICAO_CURTA_ETAPA: Record<EstadoDados, string> = {
  get CATALOGADO() {
    return tx(
      "Aparece na listagem oficial do portal da fonte ou no registro do observatório, com endereço e licença.",
      "Appears in the official listing of the source portal or in the observatory register, with address and license.",
    );
  },
  get "RECURSO VERIFICADO"() {
    return tx("O observatório abriu pelo menos um arquivo do conjunto e conferiu o formato e o cabeçalho.", "The observatory opened at least one file of the dataset and checked its format and header.");
  },
  get INTEGRADO() {
    return tx("O observatório coleta o conjunto e guarda o arquivo original de cada coleta.", "The observatory collects the dataset and stores the original file of each collection.");
  },
  get VALIDADO() {
    return tx("Integrado, com conferências automáticas registradas e nenhuma reprovada.", "Integrated, with automatic checks recorded and none failed.");
  },
  get PUBLICADO() {
    return tx("Validado e alimentando uma base publicada do observatório.", "Validated and feeding a published observatory base.");
  },
};

/** Matriz compacta: as chaves uma vez e uma lista de valores por linha. O HTML da página carrega cada linha sem repetir o nome dos campos. */
export type MatrizLinhas = { chaves: string[]; valores: (string | number | null)[][] };

export function compactarLinhas(linhas: readonly LinhaTabela[], chaves: readonly string[]): MatrizLinhas {
  return { chaves: [...chaves], valores: linhas.map((l) => chaves.map((k) => (l[k] === undefined ? null : l[k]) as string | number | null)) };
}

export function expandirLinhas(m: MatrizLinhas): LinhaTabela[] {
  return m.valores.map((v) => Object.fromEntries(m.chaves.map((k, i) => [k, v[i]])) as LinhaTabela);
}

/** Página oficial do conjunto: a URL da entrada ou a do portal seguida do nome (campo `compactacao` do catálogo). */
export function urlOficial(e: Pick<EntradaDados, "id" | "orgao" | "url">, portais: CatalogoDados["portais"]): string | null {
  if (e.url) return e.url;
  const base = portais[e.orgao]?.url_conjunto;
  return base ? base + e.id.slice(e.id.indexOf(":") + 1) : null;
}

const origemCatalogo = (): Record<string, string> =>
  tx(
    {
      listagem: "listagem oficial do portal",
      package_show: "package_show versionado no repositório",
      registro: "registro de um módulo do pipeline",
      manual: "cadastro manual do projeto",
    },
    {
      listagem: "official portal listing",
      package_show: "package_show versioned in the repository",
      registro: "register of a pipeline module",
      manual: "manual entry by the project",
    },
  );
const viaRecurso = (): Record<string, string> =>
  tx(
    {
      captura: "arquivo baixado e guardado com sha256",
      requisicao_parcial: "leitura parcial do arquivo (primeiros 64 KB)",
      captura_outro_dataset: "arquivo capturado por outro conjunto",
    },
    {
      captura: "file downloaded and stored with sha256",
      requisicao_parcial: "partial read of the file (first 64 KB)",
      captura_outro_dataset: "file captured by another dataset",
    },
  );

export type EvidenciaEtapa = { id: EtapaId; rotulo: string; situacao: SituacaoEtapa; detalhe: string };

const dia = (iso: string | undefined) => (iso ? dataBR(iso.slice(0, 10)) : null);

/** Resultado de validação escrito pelo pipeline ("aprovado", "com_ressalva") no idioma da página. */
function resultadoLegivel(r: string): string {
  const pt = r.replace("_", " ");
  return tx(pt, ({ aprovado: "passed", reprovado: "failed", "com ressalva": "with caveat", ressalva: "caveat" } as Record<string, string>)[pt] ?? pt);
}

/**
 * A evidência de cada etapa da escada de uma entrada, escrita só com o que o catálogo publica.
 * Etapa não alcançada diz isso, e a falha do recurso diz a falha: nenhuma etapa é preenchida por inferência.
 */
export function evidenciaEtapas(e: EntradaDados): EvidenciaEtapa[] {
  const sit = situacaoEtapas(e);
  const et = e.etapas;
  const ver = et?.recurso_verificado ?? e.verificacao;
  const out: EvidenciaEtapa[] = [];

  const origens = origemCatalogo();
  const origem = origens[et?.catalogado?.origem ?? e.catalogado?.origem ?? "listagem"] ?? origens.listagem;
  out.push({
    id: "catalogado",
    rotulo: ETAPAS[0].rotulo,
    situacao: sit.catalogado,
    detalhe: `${origem}; ${e.metadados_verificados ? tx("metadados verificados", "metadata verified") : tx("metadados não verificados na fonte", "metadata not verified at the source")}.`,
  });

  let dv = tx("nenhum arquivo do conjunto foi acessado pelo pipeline.", "no file of the dataset was accessed by the pipeline.");
  if (sit.recurso_verificado === "falhou")
    dv = tx(
      `tentativa registrada, sem êxito${e.verificacao?.detalhe ? `: ${e.verificacao.detalhe}` : ""}.`,
      `attempt recorded, unsuccessful${e.verificacao?.detalhe ? `: ${e.verificacao.detalhe}` : ""}.`,
    );
  else if (sit.recurso_verificado === "sim") {
    const partes = [ver?.via ? viaRecurso()[ver.via] : tx("arquivo acessado pelo pipeline", "file accessed by the pipeline")];
    if (ver?.recurso) partes.push(tx(`recurso ${ver.recurso}`, `resource ${ver.recurso}`));
    if (ver?.formato) partes.push(tx(`formato ${ver.formato}`, `format ${ver.formato}`));
    if (ver?.colunas) partes.push(tx(`${plural(ver.colunas, "coluna", "colunas")} no cabeçalho`, `${plural(ver.colunas, "column", "columns")} in the header`));
    if (ver?.arquivos) partes.push(tx(plural(ver.arquivos, "arquivo", "arquivos"), plural(ver.arquivos, "file", "files")));
    if (ver?.capturas) partes.push(tx(plural(ver.capturas, "captura", "capturas"), plural(ver.capturas, "capture", "captures")));
    if (ver?.em) partes.push(tx(`em ${dia(ver.em)}`, `on ${dia(ver.em)}`));
    dv = `${partes.join("; ")}.`;
  }
  out.push({ id: "recurso_verificado", rotulo: ETAPAS[1].rotulo, situacao: sit.recurso_verificado, detalhe: dv });

  const integ = et?.integrado;
  let di = tx(
    "o conjunto não está declarado na integração de nenhum módulo, ou a integração não passou da verificação do recurso.",
    "the dataset is not declared in the integration of any module, or the integration did not get past resource verification.",
  );
  if (sit.integrado === "sim") {
    const p: string[] = [];
    if (integ?.observacoes) p.push(tx(`${num(integ.observacoes, 0)} observações no histórico de capturas`, `${num(integ.observacoes, 0)} observations in the capture history`));
    if (integ?.registros) p.push(tx(`${num(integ.registros, 0)} registros`, `${num(integ.registros, 0)} records`));
    if (integ?.documento) p.push(tx("documento original guardado para citação", "original document stored for citation"));
    if (integ?.leitura_do_original) p.push(tx("lido direto do original, com o snapshot citado pela gold", "read directly from the original, with the snapshot cited by the gold file"));
    di = `${p.length ? p.join("; ") : tx("capturas com sha256 no histórico", "captures with sha256 in the history")}.`;
  }
  out.push({ id: "integrado", rotulo: ETAPAS[2].rotulo, situacao: sit.integrado, detalhe: di });

  const val = et?.validado;
  let dval = tx("sem validação registrada, porque a integração não foi concluída.", "no validation recorded, because the integration was not completed.");
  if (sit.validado === "sim") {
    const p = [val?.resultado ? tx(`resultado ${resultadoLegivel(val.resultado)}`, `result ${resultadoLegivel(val.resultado)}`) : tx("sem checagem reprovada", "no failed check")];
    if (val?.aprovadas !== undefined) p.push(tx(plural(val.aprovadas, "checagem aprovada", "checagens aprovadas"), plural(val.aprovadas, "check passed", "checks passed")));
    if (val?.ressalvas) p.push(tx(plural(val.ressalvas, "ressalva", "ressalvas"), plural(val.ressalvas, "caveat", "caveats")));
    if (val?.reprovadas) p.push(tx(plural(val.reprovadas, "reprovada", "reprovadas"), plural(val.reprovadas, "failed", "failed")));
    dval = `${p.join("; ")}.`;
  }
  out.push({ id: "validado", rotulo: ETAPAS[3].rotulo, situacao: sit.validado, detalhe: dval });

  const pub = et?.publicado;
  let dp = tx("não alimenta nenhuma base publicada e íntegra.", "does not feed any published, intact base.");
  if (sit.publicado === "sim") {
    const golds = pub?.golds ?? e.usado_em;
    dp = golds.length ? tx(`alimenta ${golds.join(", ")}.`, `feeds ${golds.join(", ")}.`) : tx("alimenta as bases do módulo dono do conjunto.", "feeds the bases of the module that owns the dataset.");
    if (pub?.citado_por?.length) dp += tx(` Citado no snapshot de ${pub.citado_por.join(", ")}.`, ` Cited in the snapshot of ${pub.citado_por.join(", ")}.`);
  }
  out.push({ id: "publicado", rotulo: ETAPAS[4].rotulo, situacao: sit.publicado, detalhe: dp });
  return out;
}

export type ResumoCatalogo = {
  total: number;
  orgaos: number;
  cumulativo: Record<EstadoDados, number>;
  exato: Record<EstadoDados, number>;
  descontinuados: number;
  /** Entradas que declaram uso em indicador, modelo ou conferência e não chegaram a PUBLICADO. */
  usadasAbaixo: EntradaDados[];
  /** Descontinuadas pela fonte e ainda no estado PUBLICADO (uso histórico). */
  descontinuadasPublicadas: EntradaDados[];
};

export function resumoCatalogo(cat: CatalogoDados): ResumoCatalogo {
  const exato = Object.fromEntries(ESTADOS_ESCADA.map((s) => [s, cat.contagem[s] ?? 0])) as Record<EstadoDados, number>;
  return {
    total: cat.total,
    orgaos: new Set(cat.entradas.map((e) => e.orgao)).size,
    cumulativo: contagemCumulativa(cat.contagem),
    exato,
    descontinuados: cat.descontinuados,
    usadasAbaixo: cat.entradas.filter((e) => e.usado_em.length > 0 && e.estado !== "PUBLICADO"),
    descontinuadasPublicadas: cat.entradas.filter((e) => e.descontinuado && e.estado === "PUBLICADO"),
  };
}

export function respostaCatalogo(r: ResumoCatalogo): string {
  const c = r.cumulativo;
  const partes = [
    tx(`${num(r.total, 0)} conjuntos catalogados em ${plural(r.orgaos, "órgão", "órgãos")}.`, `${num(r.total, 0)} datasets cataloged across ${plural(r.orgaos, "body", "bodies")}.`),
    tx(
      `${num(c["RECURSO VERIFICADO"], 0)} tiveram ao menos um arquivo acessado pela coleta automática, ${num(c.INTEGRADO, 0)} foram integrados, ${num(c.VALIDADO, 0)} passaram na validação sem checagem reprovada e ${num(c.PUBLICADO, 0)} alimentam uma base publicada e íntegra. A página Saúde conta integrações, e não conjuntos: um mesmo conjunto pode ser integrado por mais de um módulo.`,
      `${num(c["RECURSO VERIFICADO"], 0)} had at least one file accessed by automatic collection, ${num(c.INTEGRADO, 0)} were integrated, ${num(c.VALIDADO, 0)} passed validation with no failed check and ${num(c.PUBLICADO, 0)} feed a published, intact base. The Health page counts integrations, not datasets: the same dataset can be integrated by more than one module.`,
    ),
  ];
  if (r.usadasAbaixo.length)
    partes.push(
      tx(
        `${plural(r.usadasAbaixo.length, "conjunto declara", "conjuntos declaram")} uso em indicador sem ter passado da verificação do recurso, e cada um aparece com a ressalva escrita.`,
        `${plural(r.usadasAbaixo.length, "dataset declares", "datasets declare")} use in an indicator without having passed resource verification, and each one appears with the caveat written out.`,
      ),
    );
  partes.push(
    tx(
      `${plural(r.descontinuados, "conjunto é descontinuado", "conjuntos são descontinuados")} segundo a própria fonte.`,
      `${plural(r.descontinuados, "dataset is discontinued", "datasets are discontinued")} according to the source itself.`,
    ),
  );
  return partes.join(" ");
}

const textoAtualidade = (): Record<SituacaoAtualidade, string> =>
  tx<Record<SituacaoAtualidade, string>>(
    {
      "EM DIA": "em dia",
      ATRASADO: "atrasado",
      "SEM SLA": "sem SLA (a fonte não declara frequência)",
      "SEM DADO": "sem dado para medir",
    },
    {
      "EM DIA": "up to date",
      ATRASADO: "late",
      "SEM SLA": "no SLA (the source does not declare a frequency)",
      "SEM DADO": "no data to measure",
    },
  );

/** Referência temporal do pipeline ("2026-09-01T11:00", "2025-06", "2026") na forma da página. */
export function refLegivel(ref: string): string {
  return textoData(ref);
}

/**
 * Evidência de cada integração de um conjunto (publicacao.json), em frases: estado, capturas,
 * observações ou registros, validação, gold que consome e atualidade. Só o que a gold registra.
 */
export function linhasIntegracao(c: ConjuntoIntegrado): string[] {
  const e = c.etapas;
  const p: string[] = [tx(`Integração ${c.id}, estado ${ROTULO_ESTADO_DADOS[c.estado].toLowerCase()}.`, `Integration ${c.id}, state ${ROTULO_ESTADO_DADOS[c.estado].toLowerCase()}.`)];
  const integ = e.integrado;
  if (integ.ok) {
    const q: string[] = [];
    if (integ.observacoes) q.push(tx(`${num(integ.observacoes, 0)} observações`, `${num(integ.observacoes, 0)} observations`));
    if (integ.registros) q.push(tx(`${num(integ.registros, 0)} registros`, `${num(integ.registros, 0)} records`));
    if (integ.documento) q.push(tx("documento original guardado", "original document stored"));
    if (integ.leitura_do_original) q.push(tx("lido do original", "read from the original"));
    const ultima = c.capturas.ultima ? dataBR(c.capturas.ultima.slice(0, 10)) : null;
    p.push(
      tx(
        `Integrado: ${q.length ? q.join(", ") : "capturas com sha256"}${ultima ? `; última captura em ${ultima}` : ""}.`,
        `Integrated: ${q.length ? q.join(", ") : "captures with sha256"}${ultima ? `; latest capture on ${ultima}` : ""}.`,
      ),
    );
  } else p.push(tx("Integrado: não alcançado.", "Integrated: not reached."));
  const v = e.validado;
  if (v.ok) {
    const q = [v.resultado ? tx(`resultado ${resultadoLegivel(v.resultado)}`, `result ${resultadoLegivel(v.resultado)}`) : tx("sem checagem reprovada", "no failed check")];
    if (v.aprovadas !== undefined) q.push(tx(plural(v.aprovadas, "checagem aprovada", "checagens aprovadas"), plural(v.aprovadas, "check passed", "checks passed")));
    if (v.ressalvas) q.push(tx(plural(v.ressalvas, "ressalva", "ressalvas"), plural(v.ressalvas, "caveat", "caveats")));
    if (v.reprovadas) q.push(tx(plural(v.reprovadas, "reprovada", "reprovadas"), plural(v.reprovadas, "failed", "failed")));
    p.push(tx(`Validado: ${q.join("; ")}.`, `Validated: ${q.join("; ")}.`));
  } else p.push(tx("Validado: não alcançado.", "Validated: not reached."));
  if (e.publicado.ok)
    p.push(
      tx(
        `Publicado: alimenta ${(e.publicado.golds ?? c.golds).join(", ") || "as golds do módulo"}.`,
        `Published: feeds ${(e.publicado.golds ?? c.golds).join(", ") || "the module's gold files"}.`,
      ),
    );
  const a = c.atualidade;
  p.push(
    tx(
      `Atualidade: ${textoAtualidade()[a.situacao]}${a.ultimo_periodo ? `; último período disponível ${refLegivel(a.ultimo_periodo)}` : ""}${a.dias_atraso ? `; ${plural(a.dias_atraso, "dia", "dias")} além do prazo` : ""}.`,
      `Timeliness: ${textoAtualidade()[a.situacao]}${a.ultimo_periodo ? `; latest period available ${refLegivel(a.ultimo_periodo)}` : ""}${a.dias_atraso ? `; ${plural(a.dias_atraso, "day", "days")} past the deadline` : ""}.`,
    ),
  );
  return p;
}

/* ---------------------------------------------------------------- recurso a recurso (CCEE) */

export type RecursoCsv = Record<string, string>;

/** CSV publicado pelo pipeline (separador ";", cabeçalho na primeira linha, sem aspas). */
export function lerCsv(texto: string): RecursoCsv[] {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (!linhas.length) return [];
  const cab = linhas[0].split(";");
  return linhas.slice(1).map((l) => {
    const c = l.split(";");
    return Object.fromEntries(cab.map((k, i) => [k, c[i] ?? ""]));
  });
}

export const COLUNAS_RECURSOS: ColunaTabela[] = [
  { id: "conjunto", get rotulo() { return tx("Conjunto", "Dataset"); }, tipo: "texto" },
  { id: "recurso", get rotulo() { return tx("Recurso (arquivo)", "Resource (file)"); }, tipo: "texto" },
  { id: "estado", get rotulo() { return tx("Estado do recurso", "Resource state"); }, tipo: "texto", categorica: true },
  { id: "formato", get rotulo() { return tx("Formato", "Format"); }, tipo: "texto", categorica: true },
  { id: "publicado_em", get rotulo() { return tx("Publicado na fonte em", "Published at the source on"); }, tipo: "data" },
  { id: "via", get rotulo() { return tx("Como foi acessado", "How it was accessed"); }, tipo: "texto", categorica: true },
  { id: "capturas", get rotulo() { return tx("Capturas com sha256", "Captures with sha256"); }, tipo: "numero", casas: 0 },
  { id: "ultima_captura", get rotulo() { return tx("Última captura", "Latest capture"); }, tipo: "data" },
  { id: "verificado_em", get rotulo() { return tx("Verificado em", "Verified on"); }, tipo: "data" },
  { id: "presente", get rotulo() { return tx("Na listagem atual", "In the current listing"); }, tipo: "texto", categorica: true },
];

export function linhasRecursos(csv: RecursoCsv[]): LinhaTabela[] {
  return csv.map((r) => ({
    id: r.recurso_id,
    conjunto: r.conjunto,
    recurso: r.recurso,
    estado: ROTULO_ESTADO_DADOS[r.estado as EstadoDados] ?? r.estado,
    formato: r.formato || null,
    publicado_em: r.publicado_em ? r.publicado_em.slice(0, 10) : null,
    via: r.via || (r.estado === "CATALOGADO" ? tx("não acessado", "not accessed") : null),
    capturas: r.capturas === "" ? null : Number(r.capturas),
    ultima_captura: r.ultima_captura ? r.ultima_captura.slice(0, 10) : null,
    verificado_em: r.verificado_em ? r.verificado_em.slice(0, 10) : null,
    presente: r.presente === "1" ? tx("sim", "yes") : tx("removido pela fonte", "removed by the source"),
  }));
}

/* ---------------------------------------------------------------- saúde e revisões (P068) */

export const ROTULO_SITUACAO: Record<SituacaoAtualidade, string> = {
  get "EM DIA"() { return tx("Em dia", "Up to date"); }, // i18n: dado
  get ATRASADO() { return tx("Atrasado", "Late"); },
  get "SEM SLA"() { return tx("Sem prazo declarado", "No declared deadline"); }, // i18n: dado
  get "SEM DADO"() { return tx("Sem dado", "No data"); }, // i18n: dado
};

const rotulosFormatoRef = (): Record<string, string> =>
  tx(
    {
      horaria: "hora",
      diaria: "dia",
      mensal: "mês",
      trimestral: "trimestre",
      anual: "ano",
      intervalo: "intervalo",
      vigencia: "vigência",
      nao_temporal: "sem referência temporal",
      misto: "misto",
    },
    {
      horaria: "hour",
      diaria: "day",
      mensal: "month",
      trimestral: "quarter",
      anual: "year",
      intervalo: "interval",
      vigencia: "validity period",
      nao_temporal: "no time reference",
      misto: "mixed",
    },
  );

/** Granularidade escrita pelo pipeline (texto livre) no idioma da página; sem entrada, a do pipeline. */
const granularidadeLegivel = (g: string) =>
  tx(g, ({ "cadência irregular": "irregular cadence", diária: "daily", mensal: "monthly", anual: "annual", horária: "hourly", semanal: "weekly" } as Record<string, string>)[g] ?? g);

/** Módulos e família do conjunto, em texto. */
const rotuloFamilia = (id: string) => id.split("/")[0].replace(/_/g, " ");

export function linhasSaude(pub: PublicacaoGold): LinhaTabela[] {
  const sim = tx("sim", "yes");
  const nao = tx("não", "no");
  return pub.conjuntos.map((c) => {
    const a = c.atualidade;
    const d = c.dado;
    const r = c.revisoes;
    const cobertura = d?.series && d.series_no_ultimo !== undefined ? (100 * d.series_no_ultimo) / d.series : null;
    return {
      id: c.id,
      titulo: c.titulo,
      familia: rotuloFamilia(c.id),
      situacao: ROTULO_SITUACAO[a.situacao],
      frequencia: c.frequencia.declarada ? frequenciaLegivel(c.frequencia.declarada) : tx("não declarada", "not declared"),
      caso: a.caso ?? null,
      grao: d ? (rotulosFormatoRef()[d.formato ?? ""] ?? granularidadeLegivel(d.granularidade)) : null,
      ultimo_periodo: a.ultimo_periodo ?? null,
      prazo: a.prazo_proximo ?? null,
      atraso: a.dias_atraso ?? null,
      captura: c.capturas.ultima ?? null,
      completude: d?.completude_interna !== undefined ? 100 * d.completude_interna : null,
      cobertura,
      tentativas: c.coleta.tentativas,
      falhas: c.coleta.falhas,
      ultima_falha: c.coleta.ultima_falha?.tentado_em ?? null,
      revisoes: r?.observacoes ?? 0,
      maior_rel: r?.maior_rel?.relativa_pct ?? null,
      atras_fonte: c.capturas.fonte_mais_nova ? sim : nao,
      descontinuado: c.descontinuado ? sim : nao,
    };
  });
}

export const COLUNAS_SAUDE: ColunaTabela[] = [
  { id: "titulo", get rotulo() { return tx("Conjunto", "Dataset"); }, tipo: "texto" },
  { id: "familia", get rotulo() { return tx("Família", "Family"); }, tipo: "texto", categorica: true },
  { id: "situacao", get rotulo() { return tx("Situação", "Status"); }, tipo: "texto", categorica: true },
  { id: "frequencia", get rotulo() { return tx("Frequência declarada pela fonte", "Frequency declared by the source"); }, tipo: "texto", categorica: true },
  { id: "caso", get rotulo() { return tx("Regra de prazo aplicada (caso A a E)", "Deadline rule applied (case A to E)"); }, tipo: "texto", categorica: true },
  { id: "grao", get rotulo() { return tx("Grão do dado", "Data granularity"); }, tipo: "texto", categorica: true },
  { id: "ultimo_periodo", get rotulo() { return tx("Último período disponível", "Latest period available"); }, tipo: "texto" },
  { id: "prazo", get rotulo() { return tx("Prazo do próximo período", "Deadline for the next period"); }, tipo: "data" },
  { id: "atraso", get rotulo() { return tx("Atraso", "Delay"); }, tipo: "numero", get unidade() { return tx("dias", "days"); }, casas: 0 },
  { id: "captura", get rotulo() { return tx("Última captura", "Latest capture"); }, tipo: "data" },
  { id: "completude", get rotulo() { return tx("Completude interna", "Internal completeness"); }, tipo: "percentual", casas: 1 },
  { id: "cobertura", get rotulo() { return tx("Séries no último período", "Series in the latest period"); }, tipo: "percentual", casas: 1 },
  { id: "tentativas", get rotulo() { return tx("Tentativas de coleta", "Collection attempts"); }, tipo: "numero", casas: 0 },
  { id: "falhas", get rotulo() { return tx("Falhas de coleta", "Collection failures"); }, tipo: "numero", casas: 0 },
  { id: "ultima_falha", get rotulo() { return tx("Última falha", "Latest failure"); }, tipo: "data" },
  { id: "revisoes", get rotulo() { return tx("Valores revisados", "Revised values"); }, tipo: "numero", casas: 0 },
  { id: "maior_rel", get rotulo() { return tx("Maior revisão relativa", "Largest relative revision"); }, tipo: "percentual", casas: 1 },
  { id: "atras_fonte", get rotulo() { return tx("Fonte com arquivo mais novo", "Source with a newer file"); }, tipo: "texto", categorica: true },
  { id: "descontinuado", get rotulo() { return tx("Descontinuado", "Discontinued"); }, tipo: "texto", categorica: true },
];

export type ResumoSaude = {
  hoje: string;
  integracoes: number;
  porSituacao: Partial<Record<SituacaoAtualidade, number>>;
  atrasados: ConjuntoIntegrado[];
  comRevisao: ConjuntoIntegrado[];
  comFalha: ConjuntoIntegrado[];
  comFalhaRecente: number;
  atrasFonte: ConjuntoIntegrado[];
  observacoesRevisadas: number;
  referenciasRevisadas: number;
};

export function resumoSaude(pub: PublicacaoGold): ResumoSaude {
  const cj = pub.conjuntos;
  return {
    hoje: pub.referencia.hoje,
    integracoes: pub.resumo.integracoes,
    porSituacao: pub.resumo.por_situacao,
    atrasados: cj.filter((c) => c.atualidade.situacao === "ATRASADO"),
    comRevisao: cj.filter((c) => (c.revisoes?.observacoes ?? 0) > 0),
    comFalha: cj.filter((c) => c.coleta.falhas > 0),
    comFalhaRecente: pub.resumo.com_falha_recente,
    atrasFonte: cj.filter((c) => c.capturas.fonte_mais_nova),
    observacoesRevisadas: pub.resumo.observacoes_revisadas,
    referenciasRevisadas: pub.resumo.referencias_revisadas,
  };
}

export function respostaSaude(r: ResumoSaude): string {
  const s = r.porSituacao;
  const partes = [
    tx(
      `Na data de referência desta publicação (${dataBR(r.hoje)}), das ${num(r.integracoes, 0)} integrações de conjuntos, ${num(s["EM DIA"] ?? 0, 0)} estavam em dia, ${num(s.ATRASADO ?? 0, 0)} atrasada${(s.ATRASADO ?? 0) === 1 ? "" : "s"}, ${num(s["SEM SLA"] ?? 0, 0)} sem SLA (a fonte não declara frequência) e ${num(s["SEM DADO"] ?? 0, 0)} sem dado para medir.`,
      `On the reference date of this publication (${dataBR(r.hoje)}), of the ${num(r.integracoes, 0)} dataset integrations, ${num(s["EM DIA"] ?? 0, 0)} were up to date, ${num(s.ATRASADO ?? 0, 0)} late, ${num(s["SEM SLA"] ?? 0, 0)} without an SLA (the source does not declare a frequency) and ${num(s["SEM DADO"] ?? 0, 0)} with no data to measure.`,
    ),
  ];
  if (r.atrasados.length)
    partes.push(
      tx(
        `${r.atrasados.map((c) => tx(`${c.titulo} está ${plural(c.atualidade.dias_atraso ?? 0, "dia", "dias")} além do prazo`, "")).join("; ")}.`,
        `${r.atrasados.map((c) => `${c.titulo} is ${plural(c.atualidade.dias_atraso ?? 0, "day", "days")} past the deadline`).join("; ")}.`,
      ),
    );
  if (r.comRevisao.length)
    partes.push(
      tx(
        `${plural(r.comRevisao.length, "conjunto teve", "conjuntos tiveram")} valores revisados entre capturas do mesmo arquivo: ${num(r.observacoesRevisadas, 0)} observações em ${num(r.referenciasRevisadas, 0)} referências.`,
        `${plural(r.comRevisao.length, "dataset had", "datasets had")} values revised between captures of the same file: ${num(r.observacoesRevisadas, 0)} observations in ${num(r.referenciasRevisadas, 0)} references.`,
      ),
    );
  partes.push(
    tx(
      `${plural(r.comFalha.length, "conjunto registra", "conjuntos registram")} falha de coleta e, em ${num(r.atrasFonte.length, 0)}, a fonte publicou arquivo mais novo que a última captura.`,
      `${plural(r.comFalha.length, "dataset records", "datasets record")} a collection failure and, in ${num(r.atrasFonte.length, 0)}, the source published a file newer than the latest capture.`,
    ),
  );
  return partes.join(" ");
}

export const ROTULO_CADENCIA: Record<Cadencia | "sem", string> = {
  get diaria() { return tx("Diária", "Daily"); },
  get semanal() { return tx("Semanal", "Weekly"); },
  get quinzenal() { return tx("Quinzenal", "Fortnightly"); },
  get mensal() { return tx("Mensal", "Monthly"); },
  get trimestral() { return tx("Trimestral", "Quarterly"); },
  get anual() { return tx("Anual", "Annual"); },
  get sem() { return tx("Sem cadência declarada", "No declared cadence"); },
};
const ORDEM_CADENCIA: readonly (Cadencia | "sem")[] = ["diaria", "semanal", "quinzenal", "mensal", "trimestral", "anual", "sem"]; // i18n: dado

export type LinhaCadencia = { cadencia: Cadencia | "sem"; rotulo: string; tolerancia: number | null; "EM DIA": number; ATRASADO: number; "SEM DADO": number; "SEM SLA": number; total: number }; // i18n: dado

/**
 * Situação dos conjuntos por cadência a que o SLA foi aplicado (a cadência da regra, não a
 * primeira declarada: quem declara duas, como diária e mensal, entra na que a regra usou).
 * Conjunto sem cadência legível entra em "sem cadência declarada" e fica sem SLA.
 */
export function situacaoPorCadencia(pub: PublicacaoGold): LinhaCadencia[] {
  const linhas = new Map<Cadencia | "sem", LinhaCadencia>(
    ORDEM_CADENCIA.map((c) => [c, { cadencia: c, rotulo: ROTULO_CADENCIA[c], tolerancia: c === "sem" ? null : pub.regras.sla[c].tolerancia_dias, "EM DIA": 0, ATRASADO: 0, "SEM DADO": 0, "SEM SLA": 0, total: 0 }]),
  );
  for (const c of pub.conjuntos) {
    const l = linhas.get(c.atualidade.cadencia ?? "sem")!;
    l[c.atualidade.situacao]++;
    l.total++;
  }
  return ORDEM_CADENCIA.map((c) => linhas.get(c)!).filter((l) => l.total > 0);
}

/* ---------------------------------------------------------------- calendário de capturas e mudanças */

export type MedidaCalendario = "capturas" | "recapturas" | "falhas" | "revisoes" | "fonte";

export const MEDIDAS_CALENDARIO: readonly { id: MedidaCalendario; rotulo: string; detalhe: string; unidade: string; campo: keyof DiaCalendario; deCaptura: boolean }[] = [
  {
    id: "fonte", // i18n: dado
    get rotulo() { return tx("Publicações da fonte", "Source publications"); },
    get detalhe() { return tx("arquivos cuja data de modificação na fonte cai no dia", "files whose modification date at the source falls on the day"); },
    get unidade() { return tx("arquivos", "files"); },
    campo: "publicacoes_fonte",
    deCaptura: false,
  },
  {
    id: "capturas",
    get rotulo() { return tx("Capturas novas", "New captures"); },
    get detalhe() { return tx("arquivos baixados com conteúdo novo, que o observatório guardou como versão nova", "files downloaded with new content, which the observatory stored as a new version"); },
    get unidade() { return tx("capturas", "captures"); },
    campo: "capturas_novas",
    deCaptura: true,
  },
  {
    id: "recapturas",
    get rotulo() { return tx("Recapturas sem mudança", "Recaptures with no change"); },
    get detalhe() { return tx("downloads idênticos a uma versão já guardada", "downloads identical to a version already stored"); },
    get unidade() { return tx("recapturas", "recaptures"); },
    campo: "recapturas_sem_mudanca",
    deCaptura: true,
  },
  {
    id: "falhas",
    get rotulo() { return tx("Falhas de coleta", "Collection failures"); },
    get detalhe() { return tx("tentativas que não trouxeram o arquivo", "attempts that did not bring the file"); },
    get unidade() { return tx("falhas", "failures"); },
    campo: "falhas",
    deCaptura: true,
  },
  {
    id: "revisoes",
    get rotulo() { return tx("Valores revisados", "Revised values"); },
    get detalhe() { return tx("valores (de uma série, em um período) diferentes dos da captura anterior", "values (of a series, in a period) different from those of the previous capture"); },
    get unidade() { return tx("valores", "values"); },
    campo: "observacoes_revisadas",
    deCaptura: true,
  },
];

export const ESCALA_CALENDARIO: Record<MedidaCalendario, { limites: number[]; rotulos: string[] }> = {
  capturas: { limites: [1, 10, 100, 1000], get rotulos() { return tx(["nenhuma", "1 a 9", "10 a 99", "100 a 999", "1.000 ou mais"], ["none", "1 to 9", "10 to 99", "100 to 999", "1,000 or more"]); } },
  recapturas: { limites: [1, 10, 100, 300], get rotulos() { return tx(["nenhuma", "1 a 9", "10 a 99", "100 a 299", "300 ou mais"], ["none", "1 to 9", "10 to 99", "100 to 299", "300 or more"]); } },
  falhas: { limites: [1, 2, 5, 10], get rotulos() { return tx(["nenhuma", "1", "2 a 4", "5 a 9", "10 ou mais"], ["none", "1", "2 to 4", "5 to 9", "10 or more"]); } },
  revisoes: { limites: [1, 100, 1000, 3000], get rotulos() { return tx(["nenhuma", "1 a 99", "100 a 999", "1.000 a 2.999", "3.000 ou mais"], ["none", "1 to 99", "100 to 999", "1,000 to 2,999", "3,000 or more"]); } },
  fonte: { limites: [1, 5, 20, 40], get rotulos() { return tx(["nenhuma", "1 a 4", "5 a 19", "20 a 39", "40 ou mais"], ["none", "1 to 4", "5 to 19", "20 to 39", "40 or more"]); } },
};

/** Unidade no singular ou no plural conforme o valor ("1 conjunto", "2 conjuntos"). */
export const uni = (n: number, singular: string, plural_: string) => (n === 1 ? singular : plural_);

const DIA_MS = 86_400_000;
const paraMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const paraIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Janela do calendário: os `janelaDias` dias que terminam na data de referência (inclusive). */
export function janelaCalendario(hoje: string, janelaDias: number): { inicio: string; fim: string } {
  return { inicio: paraIso(paraMs(hoje) - (janelaDias - 1) * DIA_MS), fim: hoje };
}

/** Primeiro dia com captura registrada (nova ou idêntica): antes dele o ambiente não registrava capturas. */
export function inicioRegistroCapturas(cal: readonly DiaCalendario[]): string | null {
  const d = cal.filter((x) => x.capturas_novas + x.recapturas_sem_mudanca + x.falhas > 0).map((x) => x.dia).sort();
  return d[0] ?? null;
}

export type CalendarioMatriz = {
  semanas: { id: string; rotulo: string; curto: string }[];
  dias: { id: string; rotulo: string }[];
  valores: (number | null | typeof NAO_SE_APLICA)[][];
  janela: { inicio: string; fim: string };
  inicioRegistro: string | null;
};

/* dias da semana: o id fica em português (é a chave da coluna); o rótulo segue o idioma */
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]; // i18n: dado
const DIAS_SEMANA_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Calendário em semanas (linhas, segunda a domingo nas colunas) da janela que termina na data de
 * referência. Dia sem evento é zero quando o ambiente já registrava capturas; antes do primeiro
 * registro, as medidas de captura são "sem dado" (não havia registro, e zero seria afirmar que
 * nada foi capturado). Publicações da fonte vêm da data de modificação dos arquivos atuais e
 * valem para toda a janela. Dias fora da janela, nas pontas da primeira e da última semana, não se aplicam.
 */
export function matrizCalendario(cal: readonly DiaCalendario[], hoje: string, janelaDias: number, medida: MedidaCalendario): CalendarioMatriz {
  const m = MEDIDAS_CALENDARIO.find((x) => x.id === medida)!;
  const fim = paraMs(hoje);
  const inicio = fim - (janelaDias - 1) * DIA_MS;
  const porDia = new Map(cal.map((x) => [x.dia, x]));
  const reg = inicioRegistroCapturas(cal);
  // segunda-feira da semana do primeiro dia
  const dow = (new Date(inicio).getUTCDay() + 6) % 7;
  const ini = inicio - dow * DIA_MS;
  const nSemanas = Math.ceil((fim - ini) / DIA_MS / 7 + 1 / 7);
  const semanas: CalendarioMatriz["semanas"] = [];
  const valores: CalendarioMatriz["valores"] = [];
  for (let s = 0; s < nSemanas; s++) {
    const linha: CalendarioMatriz["valores"][number] = [];
    const comeco = ini + s * 7 * DIA_MS;
    for (let d = 0; d < 7; d++) {
      const t = comeco + d * DIA_MS;
      if (t < inicio || t > fim) {
        linha.push(NAO_SE_APLICA);
        continue;
      }
      const dia = paraIso(t);
      const reg_ = porDia.get(dia);
      const v = reg_ ? Number(reg_[m.campo]) : 0;
      linha.push(m.deCaptura && reg && dia < reg ? null : v);
    }
    valores.push(linha);
    const comecoIso = paraIso(comeco);
    semanas.push({
      id: comecoIso,
      rotulo: tx(`semana de ${dataBR(comecoIso)}`, `week of ${dataBR(comecoIso)}`),
      curto: tx(dataBR(comecoIso).slice(0, 5), dataBR(comecoIso).replace(/, \d{4}$/, "")),
    });
  }
  const rotulosDias = tx(DIAS_SEMANA, DIAS_SEMANA_EN);
  return {
    semanas,
    dias: DIAS_SEMANA.map((r, i) => ({ id: r, rotulo: rotulosDias[i] })),
    valores,
    janela: { inicio: paraIso(inicio), fim: hoje },
    inicioRegistro: reg,
  };
}

/** Eventos de revisão e de falha, para as listas do modo Analisar. */
export function conjuntosComRevisao(pub: PublicacaoGold): ConjuntoIntegrado[] {
  return pub.conjuntos
    .filter((c) => (c.revisoes?.observacoes ?? 0) > 0)
    .sort((a, b) => (b.revisoes?.observacoes ?? 0) - (a.revisoes?.observacoes ?? 0));
}

/* ---------------------------------------------------------------- download e reprodução (P069) */

/** Séries antigas, anteriores ao dicionário por módulo (arquivos.json): o módulo vem do prefixo do nome. */
const PREFIXO_SERIE: readonly (readonly [RegExp, string])[] = [
  [/^(pld|cmo)_/, "pld.json"],
  [/^(ear|ena)_/, "hidrologia.json"],
  [/^carga_/, "carga.json"],
  [/^geracao_/, "geracao.json"],
  [/^intercambio_/, "rede.json"],
  [/^previsoes_/, "previsoes.json"],
];

/**
 * Módulo de um arquivo do manifesto: o do dicionário (arquivos.json), o do CSV de que o Parquet
 * veio, o da gold pelo nome, o das séries antigas pelo prefixo; geometria é compartilhada.
 * "módulo não identificado" fica para o que nenhuma regra alcança (o teste exige que não haja).
 */
export function moduloDoArquivo(caminho: string, dic: Record<string, { gold: string }>): string {
  if (dic[caminho]) return moduloDaGold(dic[caminho].gold);
  if (caminho.endsWith(".parquet")) {
    const csv = caminho.replace(/\.parquet$/, ".csv");
    if (dic[csv]) return moduloDaGold(dic[csv].gold);
  }
  const nome = caminho.split("/").pop() ?? caminho;
  const naoIdentificado = tx("módulo não identificado", "unidentified module");
  if (caminho.startsWith("/energia/gold/")) return modulosDaGold()[nome] ?? naoIdentificado;
  if (caminho.startsWith("/energia/geo/")) return tx("Geometrias compartilhadas", "Shared geometries");
  const p = PREFIXO_SERIE.find(([r]) => r.test(nome));
  return p ? moduloDaGold(p[1]) : naoIdentificado;
}

export const COLUNAS_MANIFESTO: ColunaTabela[] = [
  { id: "caminho", get rotulo() { return tx("Arquivo", "File"); }, tipo: "texto" },
  { id: "tipo", get rotulo() { return tx("Tipo", "Type"); }, tipo: "texto", categorica: true },
  { id: "modulo", get rotulo() { return tx("Módulo", "Module"); }, tipo: "texto", categorica: true },
  { id: "kb", get rotulo() { return tx("Tamanho", "Size"); }, tipo: "numero", unidade: "KB", casas: 1 },
  { id: "linhas", get rotulo() { return tx("Linhas", "Rows"); }, tipo: "numero", casas: 0 },
  { id: "colunas", get rotulo() { return tx("Colunas", "Columns"); }, tipo: "numero", casas: 0 },
  { id: "dicionario", get rotulo() { return tx("Dicionário publicado", "Published dictionary"); }, tipo: "texto", categorica: true },
  { id: "parquet", get rotulo() { return tx("Parquet equivalente", "Equivalent Parquet"); }, tipo: "texto", categorica: true },
  { id: "validacao", get rotulo() { return tx("Validação automática", "Automatic validation"); }, tipo: "texto", categorica: true },
  { id: "sha256", rotulo: "sha256", tipo: "texto", ordenavel: false },
];

/** Veredito da validação automática de um arquivo publicado (só os CSV são validados um a um; os demais não se aplicam). */
export type VereditoDoArquivo = "aprovado" | "ressalva" | "reprovado" | "sem_validacao" | "nao_se_aplica";

export const ROTULO_VEREDITO_ARQUIVO: Record<VereditoDoArquivo, string> = {
  get aprovado() { return tx("Aprovada", "Passed"); },
  get ressalva() { return tx("Com ressalva", "With caveat"); },
  get reprovado() { return tx("Reprovada", "Failed"); },
  get sem_validacao() { return tx("Sem validação registrada", "No validation recorded"); },
  get nao_se_aplica() { return tx("Não se aplica", "Not applicable"); },
};

const rotulosTipoArquivo = (): Record<ItemManifesto["tipo"], string> =>
  tx({ gold: "gold", serie: "série", parquet: "Parquet", geometria: "geometria" }, { gold: "gold", serie: "series", parquet: "Parquet", geometria: "geometry" });

export function linhasManifesto(m: ManifestoGold, dic: Record<string, { gold: string }>, vereditos: ReadonlyMap<string, VereditoDoArquivo> = new Map()): LinhaTabela[] {
  const tipos = rotulosTipoArquivo();
  const sim = tx("sim", "yes");
  const nao = tx("não", "no");
  const naoSeAplica = tx("não se aplica", "not applicable");
  return m.arquivos.map((a) => ({
    id: a.caminho,
    caminho: a.caminho.replace(/^\/energia\//, ""),
    tipo: tipos[a.tipo],
    modulo: moduloDoArquivo(a.caminho, dic),
    kb: a.bytes / 1024,
    linhas: a.linhas ?? null,
    colunas: a.colunas ? a.colunas.length : null,
    dicionario: a.tipo === "serie" && a.caminho.endsWith(".csv") ? (a.dicionario ? sim : nao) : naoSeAplica,
    parquet: a.parquet ? sim : a.caminho.endsWith(".csv") ? nao : naoSeAplica,
    validacao: ROTULO_VEREDITO_ARQUIVO[vereditos.get(a.caminho) ?? "nao_se_aplica"],
    sha256: a.sha256,
  }));
}

/** Resultado da conferência de um arquivo baixado contra o manifesto. */
export type ConferenciaArquivo =
  | { resultado: "igual"; item: ItemManifesto }
  | { resultado: "outra_versao"; item: ItemManifesto }
  | { resultado: "desconhecido" };

/**
 * Compara o sha256 de um arquivo baixado com o manifesto: primeiro pelo hash (o arquivo pode ter
 * outro nome ao ser salvo), depois pelo nome (mesmo nome com hash diferente é outra versão ou
 * arquivo alterado). Nunca "parece igual": ou o hash coincide, ou não.
 */
export function conferirArquivo(sha256: string, nome: string, itens: readonly ItemManifesto[]): ConferenciaArquivo {
  const h = sha256.trim().toLowerCase();
  const porHash = itens.find((i) => i.sha256 === h);
  if (porHash) return { resultado: "igual", item: porHash };
  const base = nome.split(/[\\/]/).pop() ?? nome;
  const porNome = itens.find((i) => i.caminho.split("/").pop() === base);
  return porNome ? { resultado: "outra_versao", item: porNome } : { resultado: "desconhecido" };
}

/**
 * Link permanente para um arquivo publicado (/energia/...): o commit do build, quando conhecido
 * (o conteúdo de um commit não muda), ou o histórico do arquivo no ramo principal (exata = false).
 * Mesma regra de urlVersaoGithub em datasets.ts, sem leitura de disco, para rodar no navegador.
 */
export function urlVersao(caminho: string, commit: string | null, repositorio = "https://github.com/genarolins1975/scrutiniums"): { url: string; exata: boolean } {
  const c = caminho.startsWith("/") ? caminho : `/${caminho}`;
  return commit ? { url: `${repositorio}/blob/${commit}/public${c}`, exata: true } : { url: `${repositorio}/commits/main/public${c}`, exata: false };
}

export type ParquetEquivalente = { parquet: string; bytes_csv: number | null; bytes_parquet: number | null; linhas: number | null; equivalente: boolean };

export type ConferenciaManifesto = { total: number; conferidos: number; divergentes: string[]; ausentes: string[]; foraDoManifesto: string[] };

export function respostaReproducao(m: ManifestoGold, pub: PublicacaoGold, c: ConferenciaManifesto): string {
  const pq = pub.resumo.parquet;
  const mb = num(m.totais.bytes / 1024 / 1024, 0);
  const partes = [
    tx(
      `Todo arquivo publicado tem o sha256 no manifesto da publicação (${num(m.totais.arquivos, 0)} arquivos, ${mb} MB), e o id da publicação, ${m.id_publicacao.slice(0, 12)}, resume a lista inteira.`,
      `Every published file has its sha256 in the publication manifest (${num(m.totais.arquivos, 0)} files, ${mb} MB), and the publication id, ${m.id_publicacao.slice(0, 12)}, summarizes the whole list.`,
    ),
    c.conferidos === c.total
      ? tx(`Na construção desta página, os ${num(c.total, 0)} arquivos entregues tinham o sha256 do manifesto.`, `When this page was built, the ${num(c.total, 0)} files delivered had the manifest sha256.`)
      : tx(
          `Na construção desta página, ${num(c.divergentes.length + c.ausentes.length, 0)} de ${num(c.total, 0)} arquivos não conferiram com o manifesto (lista no modo Auditar).`,
          `When this page was built, ${num(c.divergentes.length + c.ausentes.length, 0)} of ${num(c.total, 0)} files did not match the manifest (list in Audit mode).`,
        ),
    tx(
      `${num(pq.equivalentes, 0)} de ${num(pq.arquivos, 0)} arquivos Parquet foram conferidos célula a célula contra o CSV.`,
      `${num(pq.equivalentes, 0)} of ${num(pq.arquivos, 0)} Parquet files were checked cell by cell against the CSV.`,
    ),
    tx(
      "A tabela de cada painel exporta CSV e XLSX das linhas filtradas, com fonte, versão e dicionário.",
      "Each panel's table exports CSV and XLSX of the filtered rows, with source, version and dictionary.",
    ),
  ];
  return partes.join(" ");
}

export function afirmacoesConferidas(pub: PublicacaoGold): { afirmacao: Afirmacao; conferida: boolean; motivo: string | null }[] {
  return pub.afirmacoes.map((a) => {
    const abaixo = a.conjuntos.filter((c) => rankEstado(c.estado) < rankEstado("RECURSO VERIFICADO"));
    if (a.ausentes_no_catalogo.length)
      return { afirmacao: a, conferida: false, motivo: tx(`conjunto fora do catálogo: ${a.ausentes_no_catalogo.join(", ")}`, `dataset not in the catalog: ${a.ausentes_no_catalogo.join(", ")}`) };
    if (abaixo.length)
      return { afirmacao: a, conferida: false, motivo: tx(`conjunto só catalogado: ${abaixo.map((c) => c.id).join(", ")}`, `dataset only cataloged: ${abaixo.map((c) => c.id).join(", ")}`) };
    return { afirmacao: a, conferida: true, motivo: null };
  });
}

/* ---------------------------------------------------------------- regras por indicador (P070) */

export type MetricaPublicada = {
  gold: string;
  paginas: string[];
  versao_formula: string;
  id: string;
  titulo: string;
  pergunta: string;
  definicao: string;
  unidade: string;
  grao_geografico: string;
  grao_temporal: string;
  fontes: string[];
  regra_agregacao: string;
  natureza_fonte: string;
  natureza_transformacao: string;
  dimensoes: string[];
  regras_comparabilidade: string[];
  regra_cobertura: string;
  politica_ausencia: string;
  validacoes: string[];
  limitacoes: string[];
  arquivo: string;
  formula?: string;
  numerador?: string;
  denominador?: string;
};

/* módulo de cada gold, no idioma da página (a tabela de terminologia dá os nomes ingleses) */
const modulosDaGold = (): Record<string, string> => {
  const [pld, agua, carga, geracao, rede, previsoes, dados, conta, empresas, expansao, inclusao, leiloes, mercado, perdas, qualidade, regulacao, visao, regiao, transicao] = tx(
    ["PLD", "Água e clima", "Carga", "Geração", "Rede", "Previsões e modelos", "Dados e metodologia", "Conta de luz", "Empresas", "Expansão", "Inclusão energética", "Leilões", "Mercado", "Perdas", "Qualidade do serviço", "Regulação", "Visão geral", "Minha região", "Transição e ambiente"],
    ["PLD", "Water and climate", "Load", "Generation", "Grid", "Forecasts and models", "Data and methodology", "Electricity bill", "Companies", "Expansion", "Energy inclusion", "Auctions", "Market", "Losses", "Quality of supply", "Regulation", "Overview", "My region", "Transition and environment"],
  );
  return {
    "pld.json": pld,
    "cmo.json": pld,
    "hidrologia.json": agua,
    "carga.json": carga,
    "geracao.json": geracao,
    "rede.json": rede,
    "modelos.json": previsoes,
    "previsoes.json": previsoes,
    "catalogo.json": dados,
    "meta.json": dados,
    "metricas.json": dados,
    "arquivos.json": dados,
    "avaliacao.json": dados,
    "agua_detalhe.json": agua,
    "carga_detalhe.json": carga,
    "conta.json": conta,
    "empresas.json": empresas,
    "listadas.json": empresas,
    "expansao.json": expansao,
    "geracao_detalhe.json": geracao,
    "inclusao.json": inclusao,
    "leiloes.json": leiloes,
    "mercado.json": mercado,
    "perdas.json": perdas,
    "pld_detalhe.json": pld,
    "previsoes_desempenho.json": previsoes,
    "previsoes_desempenho_interno.json": previsoes,
    "publicacao.json": dados,
    "manifesto.json": dados,
    "qualidade.json": qualidade,
    "rede_detalhe.json": rede,
    "regulacao.json": regulacao,
    "sintese.json": visao,
    "territorio.json": regiao,
    "transicao.json": transicao,
  };
};
export const moduloDaGold = (gold: string) => modulosDaGold()[gold] ?? gold.replace(/\.json$/, "");

const rotulosNatureza = (): Record<string, string> =>
  tx(
    { OBSERVADO: "Observado", CALCULADO: "Calculado", ESTIMADO: "Estimado", PREVISTO: "Previsto", CENARIO: "Cenário" },
    { OBSERVADO: "Observed", CALCULADO: "Calculated", ESTIMADO: "Estimated", PREVISTO: "Forecast", CENARIO: "Scenario" },
  );

/** Natureza escrita por extenso na ficha: o rótulo quando é uma só, o texto da regra quando é mista. */
export const rotuloNatureza = (n: string): string => rotulosNatureza()[n] ?? n;

/** "MISTO: OBSERVADO (…) e ESTIMADO (…)" vira "Mista"; o texto completo fica na ficha. */
export function naturezaCurta(n: string): string {
  if (n.startsWith("MISTO") || n.includes(" e ")) return tx("Mista", "Mixed");
  return rotulosNatureza()[n] ?? n.charAt(0) + n.slice(1).toLowerCase();
}

export const COLUNAS_METRICAS: ColunaTabela[] = [
  { id: "titulo", get rotulo() { return tx("Indicador", "Indicator"); }, tipo: "texto" },
  { id: "pergunta", get rotulo() { return tx("Pergunta que responde", "Question it answers"); }, tipo: "texto" },
  { id: "modulo", get rotulo() { return tx("Módulo", "Module"); }, tipo: "texto", categorica: true },
  { id: "natureza_fonte", get rotulo() { return tx("Natureza do dado de origem", "Nature of the source data"); }, tipo: "texto", categorica: true },
  { id: "natureza_calculo", get rotulo() { return tx("Natureza do resultado", "Nature of the result"); }, tipo: "texto", categorica: true },
  { id: "unidade", get rotulo() { return tx("Unidade", "Unit"); }, tipo: "texto" },
  { id: "grao_geografico", get rotulo() { return tx("Recorte geográfico", "Geographic breakdown"); }, tipo: "texto" },
  { id: "grao_temporal", get rotulo() { return tx("Recorte temporal", "Time breakdown"); }, tipo: "texto" },
  { id: "formula", get rotulo() { return tx("Tem fórmula publicada", "Has a published formula"); }, tipo: "texto", categorica: true, buscavel: false },
  { id: "paginas", get rotulo() { return tx("Páginas", "Pages"); }, tipo: "numero", casas: 0 },
];

export function linhasMetricas(ms: readonly MetricaPublicada[]): LinhaTabela[] {
  const sim = tx("sim", "yes");
  const nao = tx("não", "no");
  return ms.map((m, n) => ({
    id: m.id,
    n,
    titulo: m.titulo,
    pergunta: m.pergunta,
    modulo: moduloDaGold(m.gold),
    natureza_fonte: naturezaCurta(m.natureza_fonte),
    natureza_calculo: naturezaCurta(m.natureza_transformacao),
    unidade: m.unidade,
    grao_geografico: m.grao_geografico,
    grao_temporal: m.grao_temporal,
    formula: m.formula ? sim : nao,
    paginas: m.paginas.length,
  }));
}

export type ResumoMetricas = { total: number; modulos: number; comFormula: number; observadas: number; mistas: number; semPagina: number };

export function resumoMetricas(ms: readonly MetricaPublicada[]): ResumoMetricas {
  return {
    total: ms.length,
    modulos: new Set(ms.map((m) => m.gold).map((g) => modulosDaGold()[g] ?? g.replace(/\.json$/, ""))).size,
    comFormula: ms.filter((m) => m.formula).length,
    observadas: ms.filter((m) => m.natureza_fonte === "OBSERVADO").length,
    mistas: ms.filter((m) => naturezaCurta(m.natureza_fonte) === tx("Mista", "Mixed")).length,
    semPagina: ms.filter((m) => m.paginas.length === 0).length,
  };
}

export function respostaRegras(r: ResumoMetricas): string {
  return tx(
    `Cada um dos ${num(r.total, 0)} indicadores publicados em ${r.modulos} módulos tem definição, unidade, recorte geográfico e temporal, regra de agregação, regra de cobertura, política de ausência, validações e limitações escritas; ${num(r.comFormula, 0)} têm fórmula publicada e ${num(r.observadas, 0)} usam dado de origem observado. A lista abaixo é a mesma que o pipeline usa para calcular: uma regra que não está nela não é aplicada.`,
    `Each of the ${num(r.total, 0)} indicators published across ${r.modulos} modules has a written definition, unit, geographic and time breakdown, aggregation rule, coverage rule, missing-data policy, validations and limitations; ${num(r.comFormula, 0)} have a published formula and ${num(r.observadas, 0)} use observed source data. The list below is the same one the pipeline uses to compute: a rule that is not in it is not applied.`,
  );
}

/** Link para o arquivo de código que implementa a regra, na versão do ramo principal. */
export const urlCodigoMetrica = (arquivo: string) => `https://github.com/genarolins1975/scrutiniums/blob/main/${arquivo}`;



/**
 * Órgãos das fontes que o rodapé do observatório cita, lidos das integrações de publicacao.json
 * (um órgão por conjunto integrado, do que tem mais conjuntos para o que tem menos, empate pelo nome).
 * O texto fixo anterior citava só CCEE e ONS e contradizia as páginas de ANEEL, CVM, IBGE e EPE.
 */
export function orgaosDasFontes(pub: Pick<PublicacaoGold, "conjuntos"> | null): { orgao: string; conjuntos: number }[] {
  const n = new Map<string, number>();
  for (const c of pub?.conjuntos ?? []) n.set(c.orgao, (n.get(c.orgao) ?? 0) + 1);
  return Array.from(n, ([orgao, conjuntos]) => ({ orgao, conjuntos })).sort((a, b) => b.conjuntos - a.conjuntos || a.orgao.localeCompare(b.orgao, "pt-BR"));
}

/** Lista no idioma da página: "A, B e C" ("A, B and C" em inglês). */
export function listaEmPortugues(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")}${tx(" e ", " and ")}${itens[itens.length - 1]}`;
}


/* ---------------------------------------------------------------- ficha do conjunto, em linguagem de leitor */

/**
 * Descrição da fonte sem o corte do catálogo compacto: havendo frase inteira antes do corte, a frase interrompida
 * não é mostrada; sem ela, o começo vem como está, com as reticências. Diz se houve corte.
 */
export function descricaoLegivel(d: string | null | undefined): { texto: string | null; cortada: boolean } {
  const t = (d ?? "").trim();
  if (!t) return { texto: null, cortada: false };
  if (!t.endsWith("…")) return { texto: t, cortada: false };
  const base = t.slice(0, -1);
  const i = Math.max(base.lastIndexOf(". "), base.lastIndexOf(".\n"), base.endsWith(".") ? base.length - 1 : -1);
  // sem uma frase inteira antes do corte, o começo da descrição ainda diz o que o conjunto contém
  return i > 20 ? { texto: base.slice(0, i + 1), cortada: true } : { texto: t, cortada: true };
}

/** Licença em duas partes: o que vale para o leitor e a observação de coleta que o catálogo anexa ao texto. */
export function partirLicenca(l: string): { curta: string; nota: string | null } {
  const m = /\.\s+(?=(A página|O portal|O site|Nota|Observação|Não foi|Em pesquisa))/.exec(l); // i18n: dado
  if (m) return { curta: l.slice(0, m.index + 1), nota: l.slice(m.index + m[0].length) };
  if (l.length > 200) {
    const i = l.indexOf("; ", 60);
    if (i > 0) return { curta: l.slice(0, i), nota: l.slice(i + 2) };
  }
  return { curta: l, nota: null };
}

/**
 * Frequência que a fonte declara, escrita a partir das cadências já normalizadas pelo pipeline (e não do
 * texto livre da fonte, que traz erros de grafia como "Diariamento"). Sem cadência declarada, nada é dito.
 */
export function fraseFrequencia(cadencias: readonly string[] | null | undefined): string | null {
  const r = (cadencias ?? []).filter((c): c is Cadencia => c in ROTULO_CADENCIA && c !== "sem").map((c) => ROTULO_CADENCIA[c].toLowerCase());
  return r.length ? tx(`A fonte declara atualização ${listaEmPortugues(r)}.`, `The source declares ${listaEmPortugues(r)} updates.`) : null;
}

const ORGAOS_MASCULINOS = new Set(["IBGE", "ONS", "INMET", "CEPEL", "MME", "MCTI", "MDS", "Senado Federal", "Open-Meteo"]);

/** "pelo" ou "pela" antes do nome do órgão ("pelo IBGE", "pela ANEEL"). */
export function pelo(orgao: string): "pelo" | "pela" {
  return ORGAOS_MASCULINOS.has(orgao) ? "pelo" : "pela"; // i18n: dado
}

/** Instantes ISO em UTC escritos pelo pipeline dentro de frases ficam no horário de Brasília, como o resto da página. */
export function instantesLegiveis(texto: string): string {
  return texto.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z/g, (iso) => carimbo(iso));
}

/** Cada etapa da escada do catálogo em palavras do leitor; a definição técnica do catálogo fica em Analisar. */
export const DEFINICAO_ETAPA_LEITOR: Record<string, string> = {
  get CATALOGADO() {
    return tx(
      "O conjunto aparece na listagem oficial do portal da fonte, ou no registro do observatório, com endereço e licença. Entrada cadastrada à mão fica aqui, com os dados de cadastro ainda não conferidos.",
      "The dataset appears in the official listing of the source portal, or in the observatory register, with address and license. An entry registered by hand stays here, with its registration data not yet checked.",
    );
  },
  get "RECURSO VERIFICADO"() {
    return tx(
      "O observatório abriu pelo menos um arquivo do conjunto e conferiu o formato e o cabeçalho, mas ainda não guarda o histórico dos dados.",
      "The observatory opened at least one file of the dataset and checked its format and header, but does not yet store the data history.",
    );
  },
  get INTEGRADO() {
    return tx(
      "O observatório coleta o conjunto automaticamente, guarda o arquivo original de cada coleta e extrai os dados para o histórico. Documentos ficam guardados para citação.",
      "The observatory collects the dataset automatically, stores the original file of each collection and extracts the data into the history. Documents are stored for citation.",
    );
  },
  get VALIDADO() {
    return tx(
      "Integrado e com conferências automáticas registradas nesta publicação, nenhuma reprovada: arquivo original conferido, datas dentro do esperado e formato igual ao da fonte.",
      "Integrated and with automatic checks recorded in this publication, none failed: original file checked, dates within what is expected and format equal to the source's.",
    );
  },
  get PUBLICADO() {
    return tx(
      "Validado e alimentando uma base publicada do observatório, usada em alguma página, sem reprovação no contrato de fonte, links e formato.",
      "Validated and feeding a published observatory base, used on some page, with no failure in the source, link and format contract.",
    );
  },
};

/** Situação dos dados de um conjunto em uma frase de leitor, com a causa quando a fonte está atrasada. */
export function situacaoDoConjunto(c: Pick<ConjuntoIntegrado, "atualidade">): { alerta: boolean; titulo: string; texto: string } {
  const a = c.atualidade;
  const periodo = a.ultimo_periodo ? tx(`O último período disponível é ${refLegivel(a.ultimo_periodo)}.`, `The latest period available is ${refLegivel(a.ultimo_periodo)}.`) : "";
  if (a.situacao === "ATRASADO") {
    return {
      alerta: true,
      titulo: tx(
        `Dado atrasado${a.dias_atraso ? `: ${plural(a.dias_atraso, "dia", "dias")} além do prazo${a.prazo_proximo ? ` de ${dataBR(a.prazo_proximo)}` : ""}` : ""}`,
        `Data late${a.dias_atraso ? `: ${plural(a.dias_atraso, "day", "days")} past the deadline${a.prazo_proximo ? ` of ${dataBR(a.prazo_proximo)}` : ""}` : ""}`,
      ),
      texto: `${periodo} ${instantesLegiveis(a.causa ?? tx("A fonte não publicou período mais recente.", "The source has not published a more recent period."))}`.trim(),
    };
  }
  if (a.situacao === "EM DIA") return { alerta: false, titulo: tx("Dado em dia", "Data up to date"), texto: periodo };
  if (a.situacao === "SEM SLA")
    return {
      alerta: false,
      titulo: tx("Sem prazo de atualização declarado", "No declared update deadline"),
      texto: tx(`${periodo} A fonte não declara a frequência, e por isso o atraso não é medido.`, `${periodo} The source does not declare its frequency, so the delay is not measured.`).trim(),
    };
  return {
    alerta: false,
    titulo: tx("Atraso não medido", "Delay not measured"),
    texto: a.motivo_sem_sla ?? tx("Sem série regular de referência e sem data de publicação da fonte.", "No regular reference series and no publication date from the source."),
  };
}
