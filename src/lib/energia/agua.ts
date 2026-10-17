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
import { dataBR, mesAno, nomeMes, nomeSubmercado, num, pct, plural, sinal } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import { ABRANGENCIA_EN, CRITERIO_FECHAMENTO_EN, FONTE_CAPTURA_EN, MOTIVO_SEM_BALANCO_EN, PRECISAO_EN, rotuloDaGold } from "./i18n/agua-carga-rede";
import type { Idioma } from "@/lib/idioma";
import type { ColunaTabela, LinhaTabela, ValorCelula } from "./tabela";
import type { Regiao, Submercado } from "./tipos";
import type {
  AguaAfluencia,
  AguaArmazenamento,
  AguaCapturaAno,
  AguaClima,
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
export function paineisAgua(idioma: Idioma = idiomaEnergia()): { id: PainelAgua; rotulo: string; caminho: string; pergunta: string }[] {
  return [
    { id: "p017", rotulo: tx("Armazenamento", "Storage", idioma), caminho: "", pergunta: tx("Quanta energia está armazenada?", "How much energy is stored?", idioma) },
    { id: "p018", rotulo: tx("Afluência", "Inflow", idioma), caminho: "/afluencia", pergunta: tx("A água que chega está acima do normal?", "Is the incoming water above normal?", idioma) },
    {
      id: "p019",
      rotulo: tx("Chuva, temperatura e clima", "Rainfall, temperature and climate", idioma),
      caminho: "/chuva-e-temperatura",
      pergunta: tx("Onde a chuva e a temperatura se afastam da média?", "Where do rainfall and temperature depart from the average?", idioma),
    },
    { id: "p020", rotulo: tx("Reservatórios e balanço", "Reservoirs and water balance", idioma), caminho: "/reservatorios", pergunta: tx("Onde o armazenamento subiu ou caiu?", "Where did storage rise or fall?", idioma) },
  ];
}
export const PAINEIS_AGUA = paineisAgua("pt");

export function rotaPainel(id: PainelAgua): string {
  return `${ROTA_AGUA}${PAINEIS_AGUA.find((p) => p.id === id)?.caminho ?? ""}`;
}

export function perguntaPainel(id: PainelAgua, idioma: Idioma = idiomaEnergia()): string {
  return paineisAgua(idioma).find((p) => p.id === id)?.pergunta ?? "";
}

/** Âncoras da antiga página única que agora vivem na página da afluência (links de outras páginas e de verbetes). */
export const ANCORAS_AFLUENCIA = ["ena", "ena-sm"];

/* ---------- regiões ---------- */

export const REGIOES: readonly Regiao[] = ["SIN", "SE", "S", "NE", "N"];
export const SUBSISTEMAS: readonly Submercado[] = ["SE", "S", "NE", "N"];
export const NOME_REGIAO: Record<Regiao, string> = { SIN: "SIN", SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" }; // i18n: dado (nomeRegiao traduz)
export const CURTO_REGIAO: Record<Regiao, string> = { SIN: "SIN", SE: "SE/CO", S: "S", NE: "NE", N: "N" };
/** Contração com o artigo de cada nome ("a EAR do Sul"). */
export const DO_REGIAO: Record<Regiao, string> = { SIN: "do SIN", SE: "do Sudeste/Centro-Oeste", S: "do Sul", NE: "do Nordeste", N: "do Norte" }; // i18n: dado (doRegiao traduz)

/** Nome da região no idioma: o SIN fica "SIN"; os subsistemas, pelo nome do submercado ("Southeast/Center-West"). */
export function nomeRegiao(r: Regiao, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" && r !== "SIN" ? nomeSubmercado(r, "en") : NOME_REGIAO[r];
}

/** Nome curto da região no idioma ("SE/CO" vira "SE/CW"). */
export function curtoRegiao(r: Regiao, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" && r === "SE" ? "SE/CW" : CURTO_REGIAO[r];
}

/** "do Sul" em português; "of the South" em inglês. */
export function doRegiao(r: Regiao, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? `of the ${nomeRegiao(r, "en")}` : DO_REGIAO[r];
}
export const COR_REGIAO: Record<Regiao, string> = {
  SIN: "var(--cor-energia)", // i18n: dado
  SE: "var(--serie-sm-se)",
  S: "var(--serie-sm-s)",
  NE: "var(--serie-sm-ne)",
  N: "var(--serie-sm-n)",
};
export const COR_COMPARACAO = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"] as const;

const ehRegiao = (x: string): x is Regiao => (REGIOES as readonly string[]).includes(x);

/* ---------- textos auxiliares ---------- */

/**
 * O idioma pedido, ou o da página quando o segundo argumento não é um idioma: algumas funções de texto são passadas direto a
 * `.map(f)`, que entrega o índice no lugar do idioma.
 */
function idiomaDe(x: Idioma | number | undefined): Idioma {
  return x === "en" || x === "pt" ? x : idiomaEnergia();
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "a, b e c" ("a, b and c" em inglês). */
export function listaTexto(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}

/**
 * "2001-2025" (período da base publicado pela gold) → "2001 a 2025" ("2001 to 2025" em inglês); sem hífen no texto
 * visível. Também lê intervalo de datas ou meses ISO ("2001-01-01/2025-12-31", "2001-01/2025-12") e data ou mês isolado,
 * escritos pelos formatadores no idioma. Forma desconhecida volta como veio.
 */
export function periodoBase(p: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!p) return tx("sem base", "no baseline", idioma);
  const anos = /^(\d{4})-(\d{4})$/.exec(p);
  if (anos) return anos[2] !== anos[1] ? `${anos[1]} ${tx("a", "to", idioma)} ${anos[2]}` : anos[1];
  const data = (x: string) => (/^\d{4}-\d{2}$/.test(x) ? mesAno(x, idioma) : /^\d{4}-\d{2}-\d{2}/.test(x) ? dataBR(x, idioma) : x);
  const intervalo = /^([\d-]+)\/([\d-]+)$/.exec(p);
  if (intervalo) return intervalo[1] === intervalo[2] ? data(intervalo[1]) : `${data(intervalo[1])} ${tx("a", "to", idioma)} ${data(intervalo[2])}`;
  return data(p);
}

/** EAR em MWmês: recortes pequenos (Belo Monte, 28 MWmês de EAR máxima) com uma casa; os demais sem casa. */
export function casasMwmes(v: number | null | undefined): number {
  return v !== null && v !== undefined && Math.abs(v) < 100 ? 1 : 0;
}

export function mwmes(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return num(v, casasMwmes(v), idioma);
}

/** Unidade MWmês no idioma ("MWmonth" em inglês, como o ONS a escreve nas publicações em inglês). */
export function uMwmes(idioma: Idioma = idiomaEnergia()): string {
  return tx("MWmês", "MWmonth", idioma);
}

export function rotuloFaixa(f: FaixaUsual, idioma: Idioma = idiomaEnergia()): string {
  return {
    abaixo: tx("abaixo da faixa usual", "below the usual range", idioma),
    dentro: tx("dentro da faixa usual", "within the usual range", idioma),
    acima: tx("acima da faixa usual", "above the usual range", idioma),
  }[f];
}
export const ROTULO_FAIXA: Record<FaixaUsual, string> = { abaixo: rotuloFaixa("abaixo", "pt"), dentro: rotuloFaixa("dentro", "pt"), acima: rotuloFaixa("acima", "pt") };

/* ---------- nomes de REE, bacias e reservatórios ---------- */

/**
 * Nomes como o leitor os escreve. O ONS publica em maiúsculas e sem acento ("SAO
 * FRANCISCO"); o nome original continua no identificador, na busca e nos arquivos.
 */
const NOMES: Record<string, string> = {
  "SAO FRANCISCO": "São Francisco", // i18n: dado
  "PARAIBA DO SUL": "Paraíba do Sul", // i18n: dado
  PARANA: "Paraná", // i18n: dado
  PARANAIBA: "Paranaíba", // i18n: dado
  PARNAIBA: "Parnaíba", // i18n: dado
  PARAGUACU: "Paraguaçu", // i18n: dado
  IGUACU: "Iguaçu", // i18n: dado
  ITAJAI: "Itajaí", // i18n: dado
  JACUI: "Jacuí", // i18n: dado
  TIETE: "Tietê", // i18n: dado
  "MANAUS-AMAPA": "Manaus/Amapá", // i18n: dado
  "SANTA MARIA VIT": "Santa Maria da Vitória", // i18n: dado
  "OUTRAS - SUL": "Outras do Sul", // i18n: dado
  "OUTRAS- SUDESTE": "Outras do Sudeste", // i18n: dado
  // reservatórios: o ONS publica sem acento ou abreviado; o nome original continua no identificador e nos arquivos
  "SAO ROQUE": "São Roque", // i18n: dado
  TUCURUI: "Tucuruí", // i18n: dado
  "CURUA-UNA": "Curuá-Una", // i18n: dado
  "S.DO FACÃO": "Serra do Facão", // i18n: dado
  CORUMBA: "Corumbá", // i18n: dado
  "CORUMBA-3": "Corumbá III", // i18n: dado
  "CORUMBA-4": "Corumbá IV", // i18n: dado
  "C.BRANCO-1": "Capim Branco I", // i18n: dado
  "A. VERMELHA": "Água Vermelha", // i18n: dado
  "B. BONITA": "Barra Bonita", // i18n: dado
  "I. SOLTEIRA": "Ilha Solteira", // i18n: dado
  "G. B. MUNHOZ": "Governador Bento Munhoz", // i18n: dado
  "G. P. SOUZA": "Governador Parigot de Souza", // i18n: dado
  "M. MORAES": "Mascarenhas de Moraes", // i18n: dado
  "GOV JAYME CANET JR": "Governador Jayme Canet Júnior", // i18n: dado
  "SANTA CLARA-PR": "Santa Clara (Paraná)", // i18n: dado
  CACU: "Caçu", // i18n: dado
  IRAPE: "Irapé", // i18n: dado
};

/** Afluências que o ONS publica agrupadas ("Outras do Sul", "Outras do Sudeste"): não são uma bacia, e não têm MLT publicada. */
const GRUPOS_ONS = new Set(["OUTRAS - SUL", "OUTRAS- SUDESTE"]);

export function ehGrupoOns(nome: string | null | undefined): boolean {
  return !!nome && GRUPOS_ONS.has(nome.trim());
}
const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e"]); // i18n: dado
const ROMANOS = /^(ii|iii|iv|vi|vii|viii|ix|xi|xii)$/i;

/** Nome próprio a partir do texto do ONS: tabela acima ou iniciais maiúsculas (preposições em minúscula). */
export function nomeProprio(nome: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!nome) return tx("sem nome", "no name", idioma);
  const t = nome.trim();
  // os dois grupos do ONS não são nome próprio: em inglês, dizem o que agrupam
  if (idioma === "en" && GRUPOS_EN[t]) return GRUPOS_EN[t];
  if (NOMES[t]) return NOMES[t];
  return t
    .toLocaleLowerCase("pt-BR")
    .split(/(\s+)/)
    .map((p, i) =>
      i > 0 && MINUSCULAS.has(p)
        ? p
        : ROMANOS.test(p)
          ? p.toLocaleUpperCase("pt-BR")
          : // inicial maiúscula também depois de ponto e de hífen ("C.Branco-1", "Corumba-3")
            p.replace(/(^|[.-])([a-zà-ÿ])/g, (_, a: string, l: string) => a + l.toLocaleUpperCase("pt-BR")),
    )
    .join("");
}

const GRUPOS_EN: Record<string, string> = { "OUTRAS - SUL": "Other South basins", "OUTRAS- SUDESTE": "Other Southeast basins" };

/**
 * Entidade de uma ficha de prova ("reservatório SERRA DA MESA (TOSMES)") como o leitor a lê: sem o código da usina no fim
 * e com o nome em maiúsculas e minúsculas. O código fica na tabela e no arquivo.
 */
export function entidadeLegivel(entidade: string, idioma: Idioma = idiomaEnergia()): string {
  const semCodigo = entidade.replace(/\s*\([A-Z0-9]{3,8}\)\s*$/, "");
  if (idioma === "en") {
    return semCodigo.replace(/^(reservat[óo]rio|bacia|REE)\s+(.+)$/i, (_, tipo: string, nome: string) => {
      const n = nomeProprio(nome, "en");
      const k = tipo.toLowerCase();
      return k === "ree" ? `REE ${n}` : k === "bacia" ? `${n} basin` : `${n} reservoir`;
    });
  }
  return semCodigo.replace(/^(reservat[óo]rio|bacia|REE)\s+(.+)$/i, (_, tipo: string, nome: string) => `${tipo.toLowerCase() === "ree" ? "REE" : tipo.toLowerCase()} ${nomeProprio(nome, "pt")}`);
}

/* ---------- recortes (subsistema, REE, bacia) ---------- */

export type TipoRecorte = "subsistema" | "ree" | "bacia";
export const TIPOS_RECORTE: readonly TipoRecorte[] = ["subsistema", "ree", "bacia"];
export function rotuloTipoRecorte(t: TipoRecorte, idioma: Idioma = idiomaEnergia()): string {
  return { subsistema: tx("Subsistemas e SIN", "Subsystems and SIN", idioma), ree: "REE", bacia: tx("Bacias", "Basins", idioma) }[t];
}
export const ROTULO_TIPO_RECORTE: Record<TipoRecorte, string> = { subsistema: rotuloTipoRecorte("subsistema", "pt"), ree: "REE", bacia: rotuloTipoRecorte("bacia", "pt") };

/** Identificador estável na URL: "SE" para subsistema, "ree:PARANA" e "bacia:GRANDE" para os demais (nome do ONS). */
export function idRecorte(tipo: TipoRecorte, nome: string): string {
  return tipo === "subsistema" ? nome : `${tipo}:${nome}`;
}

export function lerIdRecorte(id: string): { tipo: TipoRecorte; nome: string } | null {
  if (ehRegiao(id)) return { tipo: "subsistema", nome: id };
  const m = /^(ree|bacia):(.+)$/.exec(id);
  return m ? { tipo: m[1] as TipoRecorte, nome: m[2] } : null;
}

/**
 * "SIN", "Sudeste/Centro-Oeste", "REE Paraná", "Bacia do Grande", "Outras do Sul (grupo do ONS)". Os dois grupos de afluências
 * agrupadas do ONS não são uma bacia: o rótulo diz isso, em vez de "Bacia do Outras do Sul".
 */
export function rotuloRecorte(tipo: TipoRecorte, nome: string, idioma: Idioma = idiomaEnergia()): string {
  if (tipo === "subsistema") return ehRegiao(nome) ? nomeRegiao(nome, idioma) : nome;
  if (tipo === "bacia" && ehGrupoOns(nome)) return tx(`${nomeProprio(nome, "pt")} (grupo do ONS)`, `${nomeProprio(nome, "en")} (ONS group)`, idioma);
  return tipo === "ree" ? `REE ${nomeProprio(nome, idioma)}` : tx(`Bacia do ${nomeProprio(nome, "pt")}`, `${nomeProprio(nome, "en")} basin`, idioma);
}

/** Com artigo: "o SIN", "o Sul", "o REE Paraná", "a bacia do Grande", "o grupo Outras do Sul". Em inglês: "the SIN", "the South subsystem", "the Grande basin". */
export function artigoRecorte(tipo: TipoRecorte, nome: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") {
    if (tipo === "bacia") return ehGrupoOns(nome) ? `the ${nomeProprio(nome, "en")} group` : `the ${nomeProprio(nome, "en")} basin`;
    if (tipo === "ree") return `the REE ${nomeProprio(nome, "en")}`;
    return nome === "SIN" || !ehRegiao(nome) ? `the ${rotuloRecorte(tipo, nome, "en")}` : `the ${rotuloRecorte(tipo, nome, "en")} subsystem`;
  }
  if (tipo === "bacia") return ehGrupoOns(nome) ? `o grupo ${nomeProprio(nome, "pt")}` : `a bacia do ${nomeProprio(nome, "pt")}`;
  return `o ${tipo === "ree" ? `REE ${nomeProprio(nome, "pt")}` : rotuloRecorte(tipo, nome, "pt")}`;
}

/** Contração com "a": "ao SIN", "ao REE Paraná", "à bacia do Grande", "ao grupo Outras do Sul" ("to the ..." em inglês). */
export function aoRecorte(tipo: TipoRecorte, nome: string, idioma: Idioma = idiomaEnergia()): string {
  return tx(
    tipo === "bacia"
      ? ehGrupoOns(nome)
        ? `ao grupo ${nomeProprio(nome, "pt")}`
        : `à bacia do ${nomeProprio(nome, "pt")}`
      : `ao ${tipo === "ree" ? `REE ${nomeProprio(nome, "pt")}` : rotuloRecorte(tipo, nome, "pt")}`,
    `to ${artigoRecorte(tipo, nome, "en")}`,
    idioma,
  );
}

/** Contração: "do SIN", "do REE Paraná", "da bacia do Grande", "do grupo Outras do Sul" ("of the ..." em inglês). */
export function doRecorte(tipo: TipoRecorte, nome: string, idioma: Idioma = idiomaEnergia()): string {
  return tx(
    tipo === "subsistema"
      ? ehRegiao(nome)
        ? DO_REGIAO[nome]
        : `de ${nome}`
      : tipo === "bacia" && ehGrupoOns(nome)
        ? `do grupo ${nomeProprio(nome, "pt")}`
        : tipo === "ree"
          ? `do REE ${nomeProprio(nome, "pt")}`
          : `da bacia do ${nomeProprio(nome, "pt")}`,
    `of ${artigoRecorte(tipo, nome, "en")}`,
    idioma,
  );
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
  idioma: Idioma = idiomaEnergia(),
): { defasada: boolean; dias: number | null; texto: string } {
  const proc = diaBrasilia(geradoEm) ?? geradoEm.slice(0, 10);
  const d = (x: string) => dataBR(x, idioma);
  if (!diaReferencia) return { defasada: true, dias: null, texto: tx(`Sem dia de referência nesta publicação (processada em ${d(proc)}).`, `No reference day in this release (processed on ${d(proc)}).`, idioma) };
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - Date.parse(`${diaReferencia}T00:00:00Z`)) / 86_400_000);
  const nDias = plural(dias, tx("dia", "day", idioma), tx("dias", "days", idioma), idioma);
  if (dias > folgaDias) {
    return {
      defasada: true,
      dias,
      texto: tx(
        `Fonte defasada: o dia mais recente é ${d(diaReferencia)}, ${nDias} antes do processamento (${d(proc)}), mais que o atraso normal (${normal}). Os números são os da última publicação válida.`,
        `Source behind schedule: the latest day is ${d(diaReferencia)}, ${nDias} before processing (${d(proc)}), more than the normal delay (${normal}). The figures are those of the last valid release.`,
        idioma,
      ),
    };
  }
  return {
    defasada: false,
    dias,
    texto: tx(`Dado até ${d(diaReferencia)}, processado em ${d(proc)} (${nDias} depois; ${normal}).`, `Data through ${d(diaReferencia)}, processed on ${d(proc)} (${nDias} later; ${normal}).`, idioma),
  };
}

/* ---------- tabela: linhas planas ---------- */

/** Objetos para LinhaTabela: booleano vira "sim" ou "não", lista vira texto, objeto aninhado sai. */
export function paraLinhas<T extends object>(linhas: readonly T[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return linhas.map((l) =>
    Object.fromEntries(
      Object.entries(l)
        .filter(([, v]) => v === null || typeof v !== "object" || Array.isArray(v))
        .map(([k, v]) => [k, typeof v === "boolean" ? (v ? tx("sim", "yes", idioma) : tx("não", "no", idioma)) : Array.isArray(v) ? v.join(", ") : (v as ValorCelula)]),
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
export function entidadesEar(a: AguaArmazenamento, idioma: Idioma = idiomaEnergia()): EntidadeEar[] {
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
        rotulo: rotuloRecorte("subsistema", s.sm, idioma),
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
          rotulo: rotuloRecorte(tipo, r.nome, idioma),
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

/**
 * Variação da EAR máxima nos anos da base (do menor ao maior valor) acima da qual a posição frente à faixa em % deixa de ser dita: a
 * faixa em % mistura capacidades de tamanhos muito diferentes. Abaixo disso a posição continua dita, com o aviso de que a capacidade mudou.
 */
export const LIMITE_VARIACAO_CAPACIDADE = 0.25;

type CapacidadeNaBase = Pick<EntidadeEar, "ear_max_base_min_mwmes" | "ear_max_base_max_mwmes" | "capacidade_mudou_na_base" | "sem_armazenamento">;

/** Menor e maior EAR máxima da base e a razão entre elas; null sem base ou sem armazenamento. */
export function amplitudeCapacidade(e: CapacidadeNaBase): { min: number; max: number; razao: number } | null {
  const min = e.ear_max_base_min_mwmes;
  const max = e.ear_max_base_max_mwmes;
  if (e.sem_armazenamento || min === null || max === null || min <= 0) return null;
  return { min, max, razao: max / min };
}

/** A EAR máxima mudou na base além do limite: a faixa em % compara capacidades de tamanhos muito diferentes. */
export function capacidadeMuitoAlterada(e: CapacidadeNaBase): boolean {
  const a = amplitudeCapacidade(e);
  return !!a && e.capacidade_mudou_na_base && a.razao - 1 > LIMITE_VARIACAO_CAPACIDADE;
}

/** "5,7 vezes" quando a EAR máxima mais que dobrou na base; senão a variação em % ("28%"). Em inglês, "5.7-fold" ou "by 28%". */
export function textoAmplitude(razao: number, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") return razao >= 2 ? `${num(razao, 1, "en")}-fold` : `by ${num((razao - 1) * 100, 0, "en")}%`;
  return razao >= 2 ? `${num(razao, 1, "pt")} vezes` : `${num((razao - 1) * 100, 0, "pt")}%`;
}

/** "1 ano", "5 anos" ("1 year", "5 years"). */
const nAnos = (n: number, idioma: Idioma) => plural(n, tx("ano", "year", idioma), tx("anos", "years", idioma), idioma);

export function respostaArmazenamento(e: EntidadeEar, idiomaOuIndice?: Idioma | number): string {
  const idioma = idiomaDe(idiomaOuIndice);
  const quem = artigoRecorte(e.tipo, e.nome, idioma);
  const mw = (v: number | null | undefined) => mwmes(v, idioma);
  const p1 = (v: number | null | undefined) => pct(v, 1, idioma);
  if (e.dia === null || e.ear_mwmes === null) return tx(`${cap(quem)} não tem EAR publicada no dia de referência: o valor fica ausente, nunca zero.`, `${cap(quem)} has no EAR published for the reference day: the value is left absent, never zero.`, idioma);
  const dia = dataBR(e.dia, idioma);
  if (e.sem_armazenamento) {
    return tx(
      `${cap(quem)} não tem armazenamento: a EAR máxima é zero (só usinas a fio d'água), então percentual, faixa sazonal e percentil não se aplicam. A EAR publicada em ${dia} é ${mw(e.ear_mwmes)} MWmês.`,
      `${cap(quem)} has no storage: its maximum EAR is zero (run-of-river plants only), so percentage, seasonal range and percentile do not apply. The EAR published for ${dia} is ${mw(e.ear_mwmes)} MWmonth.`,
      idioma,
    );
  }
  const partes: string[] = [];
  const amp = capacidadeMuitoAlterada(e) ? amplitudeCapacidade(e) : null;
  const base = periodoBase(e.periodo_base, idioma);
  let p = tx(
    `Em ${dia}, ${quem} guardava ${mw(e.ear_mwmes)} MWmês, ${p1(e.ear_pct)} da EAR máxima de ${mw(e.ear_max_mwmes)} MWmês`,
    `On ${dia}, ${quem} held ${mw(e.ear_mwmes)} MWmonth, ${p1(e.ear_pct)} of its maximum EAR of ${mw(e.ear_max_mwmes)} MWmonth`,
    idioma,
  );
  if (amp && e.p10_mwmes !== null && e.p90_mwmes !== null && e.p10 !== null && e.p90 !== null) {
    // capacidade de tamanhos muito diferentes na base: a posição em % não é dita; a faixa vai em MWmês e em %, para o leitor ler
    p += tx(
      `. A EAR máxima variou ${textoAmplitude(amp.razao, idioma)} nos anos da base (de ${mw(amp.min)} a ${mw(amp.max)} MWmês): a faixa em % compara capacidades de tamanhos diferentes, e a posição frente a ela não é dita. Em MWmês, a faixa do mesmo dia em ${base} vai de ${mw(e.p10_mwmes)} (10º percentil) a ${mw(e.p90_mwmes)} (90º percentil), com mediana de ${mw(e.p50_mwmes)}; em %, de ${p1(e.p10)} a ${p1(e.p90)}.`,
      `. The maximum EAR varied ${textoAmplitude(amp.razao, idioma)} over the baseline years (from ${mw(amp.min)} to ${mw(amp.max)} MWmonth): the % range compares capacities of different sizes, and the position against it is not stated. In MWmonth, the range for the same day in ${base} runs from ${mw(e.p10_mwmes)} (10th percentile) to ${mw(e.p90_mwmes)} (90th percentile), with a median of ${mw(e.p50_mwmes)}; in %, from ${p1(e.p10)} to ${p1(e.p90)}.`,
      idioma,
    );
  } else if (e.faixa && e.p10 !== null && e.p90 !== null) {
    p += tx(
      `, ${rotuloFaixa(e.faixa, idioma)} da data (10º a 90º percentil do mesmo dia em ${base}: ${p1(e.p10)} a ${p1(e.p90)}; percentil ${num(e.percentil_na_data, 1, idioma)}).`,
      `, ${rotuloFaixa(e.faixa, idioma)} for the date (10th to 90th percentile of the same day in ${base}: ${p1(e.p10)} to ${p1(e.p90)}; percentile ${num(e.percentil_na_data, 1, idioma)}).`,
      idioma,
    );
  } else {
    p += tx(
      `; com ${nAnos(e.anos_na_base, idioma)} na base, menos que os 5 exigidos, não há faixa sazonal nem percentil.`,
      `; with ${nAnos(e.anos_na_base, idioma)} in the baseline, fewer than the 5 required, there is no seasonal range or percentile.`,
      idioma,
    );
  }
  partes.push(p);
  if (e.variacao_30d_mwmes !== null) {
    const pp = e.variacao_30d_pp !== null ? ` (${sinal(e.variacao_30d_pp, 1, "", idioma)} ${tx("p.p.", "pp", idioma)})` : "";
    partes.push(tx(`Em 30 dias, ${sinal(e.variacao_30d_mwmes, casasMwmes(e.variacao_30d_mwmes), "", idioma)} MWmês${pp}.`, `Over 30 days, ${sinal(e.variacao_30d_mwmes, casasMwmes(e.variacao_30d_mwmes), "", idioma)} MWmonth${pp}.`, idioma));
  }
  if (e.capacidade_mudou_na_base && !amp) {
    partes.push(
      tx(
        `A EAR máxima mudou mais de 5% entre os anos da base (de ${mw(e.ear_max_base_min_mwmes)} a ${mw(e.ear_max_base_max_mwmes)} MWmês): a faixa em % compara capacidades diferentes, e a faixa em MWmês está na tabela.`,
        `The maximum EAR changed by more than 5% across the baseline years (from ${mw(e.ear_max_base_min_mwmes)} to ${mw(e.ear_max_base_max_mwmes)} MWmonth): the % range compares different capacities, and the range in MWmonth is in the table.`,
        idioma,
      ),
    );
  }
  if (e.perimetro_mudou_em) partes.push(tx(`O perímetro deste REE mudou em ${dataBR(e.perimetro_mudou_em, idioma)}: a base começa em ${e.base_desde}.`, `The perimeter of this REE changed on ${dataBR(e.perimetro_mudou_em, idioma)}: the baseline starts in ${e.base_desde}.`, idioma));
  return partes.join(" ");
}

/**
 * Veredito do P017 em palavras simples: quanto da energia que os reservatórios comportam estava guardada no dia, a posição
 * diante da faixa usual da data e a variação em 30 dias. Os percentis, a EAR em MWmês, a EAR máxima e a mudança de perímetro
 * ficam em respostaArmazenamento. Quando a capacidade variou além do limite na base, a posição não é dita e a amplitude entra no lugar.
 */
export function vereditoArmazenamento(e: EntidadeEar, idiomaOuIndice?: Idioma | number): string {
  const idioma = idiomaDe(idiomaOuIndice);
  const quem = artigoRecorte(e.tipo, e.nome, idioma);
  if (e.dia === null || e.ear_mwmes === null) return tx(`${cap(quem)} não tem EAR publicada no dia de referência: o valor fica ausente, nunca zero.`, `${cap(quem)} has no EAR published for the reference day: the value is left absent, never zero.`, idioma);
  if (e.sem_armazenamento) return tx(`${cap(quem)} não tem armazenamento, só usinas a fio d'água: percentual, faixa usual e percentil não se aplicam.`, `${cap(quem)} has no storage, only run-of-river plants: percentage, usual range and percentile do not apply.`, idioma);
  const amp = capacidadeMuitoAlterada(e) ? amplitudeCapacidade(e) : null;
  let t = tx(`Em ${dataBR(e.dia, idioma)}, ${quem} guardava ${pct(e.ear_pct, 1, idioma)} da energia que os reservatórios comportam`, `On ${dataBR(e.dia, idioma)}, ${quem} held ${pct(e.ear_pct, 1, idioma)} of the energy its reservoirs can store`, idioma);
  if (amp) t += tx(`; a capacidade variou ${textoAmplitude(amp.razao, idioma)} na base, e a posição frente à faixa usual não é dita`, `; capacity varied ${textoAmplitude(amp.razao, idioma)} over the baseline, and the position against the usual range is not stated`, idioma);
  else if (e.faixa && e.p10 !== null && e.p90 !== null) t += tx(`, ${rotuloFaixa(e.faixa, idioma)} da data`, `, ${rotuloFaixa(e.faixa, idioma)} for the date`, idioma);
  else t += tx(`; com ${nAnos(e.anos_na_base, idioma)} na base, não há faixa usual`, `; with ${nAnos(e.anos_na_base, idioma)} in the baseline, there is no usual range`, idioma);
  const sentido = (v: number) => (v < 0 ? tx("caiu", "fell", idioma) : v > 0 ? tx("subiu", "rose", idioma) : tx("ficou igual", "was unchanged", idioma));
  if (e.variacao_30d_mwmes !== null) {
    const v = e.variacao_30d_mwmes;
    t += tx(
      `; em 30 dias, a energia armazenada ${sentido(v)}${v === 0 ? "" : ` ${mwmes(Math.abs(v), idioma)} MWmês`}`,
      `; over 30 days, stored energy ${sentido(v)}${v === 0 ? "" : ` by ${mwmes(Math.abs(v), idioma)} MWmonth`}`,
      idioma,
    );
  } else if (e.variacao_30d_pp !== null) {
    const v = e.variacao_30d_pp;
    t += tx(
      `; em 30 dias, a EAR ${sentido(v)}${v === 0 ? "" : ` ${num(Math.abs(v), 1, idioma)} p.p.`}`,
      `; over 30 days, the EAR ${sentido(v)}${v === 0 ? "" : ` by ${num(Math.abs(v), 1, idioma)} pp`}`,
      idioma,
    );
  }
  t += ".";
  if (e.capacidade_mudou_na_base && !amp) t += tx(" A faixa compara capacidades que mudaram ao longo dos anos.", " The range compares capacities that changed over the years.", idioma);
  return t;
}

export function colunasArmazenamentoTodas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const u = uMwmes(idioma);
  const eDia = tx("EAR do dia", "EAR on the day", idioma);
  const mediana = tx("Mediana da data", "Median for the date", idioma);
  const var30 = tx("Variação em 30 dias", "30-day change", idioma);
  return [
    { id: "rotulo", rotulo: tx("Recorte", "Area", idioma), tipo: "texto" },
    { id: "tipo", rotulo: tx("Tipo", "Type", idioma), tipo: "texto", categorica: true },
    { id: "dia", rotulo: tx("Dia", "Day", idioma), tipo: "data" }, // i18n: dado
    { id: "ear_mwmes", rotulo: eDia, tipo: "numero", unidade: u, casas: 1 },
    { id: "ear_max_mwmes", rotulo: tx("EAR máxima", "Maximum EAR", idioma), tipo: "numero", unidade: u, casas: 1 },
    { id: "ear_pct", rotulo: eDia, tipo: "percentual", casas: 2 },
    { id: "p10", rotulo: tx("10º percentil da data", "10th percentile for the date", idioma), tipo: "percentual", casas: 2 },
    { id: "p50", rotulo: mediana, tipo: "percentual", casas: 2 },
    { id: "p90", rotulo: tx("90º percentil da data", "90th percentile for the date", idioma), tipo: "percentual", casas: 2 },
    { id: "faixa", rotulo: tx("Posição", "Position", idioma), tipo: "texto", categorica: true },
    { id: "percentil_na_data", rotulo: tx("Percentil na data", "Percentile for the date", idioma), tipo: "numero", casas: 1 },
    { id: "p10_mwmes", rotulo: tx("10º percentil", "10th percentile", idioma), tipo: "numero", unidade: u, casas: 1 },
    { id: "p50_mwmes", rotulo: mediana, tipo: "numero", unidade: u, casas: 1 },
    { id: "p90_mwmes", rotulo: tx("90º percentil", "90th percentile", idioma), tipo: "numero", unidade: u, casas: 1 },
    { id: "variacao_30d_mwmes", rotulo: var30, tipo: "numero", unidade: u, casas: 1 },
    { id: "variacao_30d_pp", rotulo: var30, tipo: "numero", unidade: tx("p.p.", "pp", idioma), casas: 2 },
    { id: "anos_na_base", rotulo: tx("Anos na base", "Years in the baseline", idioma), tipo: "numero", casas: 0 },
    { id: "periodo_base", rotulo: tx("Período da base", "Baseline period", idioma), tipo: "texto" },
    { id: "ear_max_base_min_mwmes", rotulo: tx("Menor EAR máxima na base", "Lowest maximum EAR in the baseline", idioma), tipo: "numero", unidade: u, casas: 1 },
    { id: "ear_max_base_max_mwmes", rotulo: tx("Maior EAR máxima na base", "Highest maximum EAR in the baseline", idioma), tipo: "numero", unidade: u, casas: 1 },
    { id: "capacidade_mudou_na_base", rotulo: tx("Capacidade mudou na base", "Capacity changed in the baseline", idioma), tipo: "texto", categorica: true },
    { id: "nome", rotulo: tx("Nome no ONS", "Name at ONS", idioma), tipo: "texto", idiomaTexto: "nome" },
  ];
}
export const COLUNAS_ARMAZENAMENTO: ColunaTabela[] = colunasArmazenamentoTodas("pt");

/** Unidade da figura principal da abertura: % da EAR máxima do recorte ou energia em MWmês. */
export type UnidadeEar = "pct" | "mwmes";
export function opcoesUnidadeEar(idioma: Idioma = idiomaEnergia()): { id: UnidadeEar; rotulo: string }[] {
  return [
    { id: "pct", rotulo: tx("% da EAR máxima", "% of maximum EAR", idioma) },
    { id: "mwmes", rotulo: uMwmes(idioma) },
  ];
}
export const OPCOES_UNIDADE_EAR: { id: UnidadeEar; rotulo: string }[] = opcoesUnidadeEar("pt");

const COLUNAS_ESSENCIAIS_EAR: Record<UnidadeEar, readonly string[]> = {
  pct: ["rotulo", "ear_pct", "p50"],
  mwmes: ["rotulo", "ear_mwmes", "p50_mwmes"],
};

/**
 * Colunas da tabela equivalente na unidade da figura: em Entender, o recorte e os dois valores que o gráfico mostra (a EAR do dia e a
 * mediana da data, na mesma unidade), que cabem em 360 px sem esconder número; as demais passam a Analisar. O arquivo leva todas.
 */
export function colunasArmazenamento(unidade: UnidadeEar, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const essenciais = COLUNAS_ESSENCIAIS_EAR[unidade];
  return colunasArmazenamentoTodas(idioma).map((c) => (essenciais.includes(c.id) ? c : { ...c, nivel: "analisar" as const }));
}

const ROTULO_POSICAO = (e: EntidadeEar, idioma: Idioma) => {
  if (e.sem_armazenamento) return tx("não se aplica (sem armazenamento)", "not applicable (no storage)", idioma);
  if (!e.faixa) return tx(`sem faixa (${nAnos(e.anos_na_base, idioma)} na base)`, `no range (${nAnos(e.anos_na_base, idioma)} in the baseline)`, idioma);
  const amp = capacidadeMuitoAlterada(e) ? amplitudeCapacidade(e) : null;
  // a mesma regra da frase, da dica e da figura: com a EAR máxima variando além do limite na base, a posição frente à faixa não é dita,
  // nem na tabela nem no arquivo (os valores da faixa, em % e em MWmês, seguem nas colunas ao lado)
  return amp
    ? tx(`não dita: a EAR máxima variou ${textoAmplitude(amp.razao, idioma)} na base`, `not stated: the maximum EAR varied ${textoAmplitude(amp.razao, idioma)} over the baseline`, idioma)
    : rotuloFaixa(e.faixa, idioma);
};

/** As linhas da tabela equivalente e do arquivo exportado (as mesmas do gráfico de pontos). */
export function linhasArmazenamento(lista: readonly EntidadeEar[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return lista.map((e) => ({
    id: e.id,
    rotulo: e.rotulo,
    tipo: rotuloTipoRecorte(e.tipo, idioma),
    dia: e.dia,
    ear_mwmes: e.ear_mwmes,
    ear_max_mwmes: e.ear_max_mwmes,
    ear_pct: e.ear_pct,
    p10: e.p10,
    p50: e.p50,
    p90: e.p90,
    faixa: ROTULO_POSICAO(e, idioma),
    percentil_na_data: e.percentil_na_data,
    p10_mwmes: e.p10_mwmes,
    p50_mwmes: e.p50_mwmes,
    p90_mwmes: e.p90_mwmes,
    variacao_30d_mwmes: e.variacao_30d_mwmes,
    variacao_30d_pp: e.variacao_30d_pp,
    anos_na_base: e.anos_na_base,
    periodo_base: e.periodo_base ? periodoBase(e.periodo_base, idioma) : null,
    ear_max_base_min_mwmes: e.ear_max_base_min_mwmes,
    ear_max_base_max_mwmes: e.ear_max_base_max_mwmes,
    capacidade_mudou_na_base: e.sem_armazenamento ? tx("não se aplica", "not applicable", idioma) : e.capacidade_mudou_na_base ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
    nome: e.nome,
  }));
}

/**
 * Pontos pareados: EAR do dia contra a mediana da mesma data, na unidade escolhida (recortes sem armazenamento ficam fora do gráfico e
 * na tabela). A dica de cada linha traz a faixa da data na mesma unidade; quando a capacidade variou além do limite, ela diz que a posição não é dita.
 */
export function itensPontosArmazenamento(lista: readonly EntidadeEar[], unidade: UnidadeEar = "pct", idioma: Idioma = idiomaEnergia()) {
  const emMw = unidade === "mwmes";
  const fmt = (v: number | null) => (emMw ? `${mwmes(v, idioma)} ${uMwmes(idioma)}` : pct(v, 1, idioma));
  return lista
    .filter((e) => !e.sem_armazenamento)
    .map((e) => {
      const [inf, sup] = emMw ? [e.p10_mwmes, e.p90_mwmes] : [e.p10, e.p90];
      const amp = capacidadeMuitoAlterada(e) ? amplitudeCapacidade(e) : null;
      const base = periodoBase(e.periodo_base, idioma);
      const detalhe =
        e.faixa && inf !== null && sup !== null
          ? tx(
              `faixa da data ${fmt(inf)} a ${fmt(sup)} (${base}); ${amp ? `a capacidade variou ${textoAmplitude(amp.razao, idioma)} na base, e a posição não é dita` : emMw ? "posição em %: " + rotuloFaixa(e.faixa, idioma) : rotuloFaixa(e.faixa, idioma)}`,
              `range for the date ${fmt(inf)} to ${fmt(sup)} (${base}); ${amp ? `capacity varied ${textoAmplitude(amp.razao, idioma)} over the baseline, and the position is not stated` : emMw ? "position in %: " + rotuloFaixa(e.faixa, idioma) : rotuloFaixa(e.faixa, idioma)}`,
              idioma,
            )
          : tx(`sem faixa: ${nAnos(e.anos_na_base, idioma)} na base`, `no range: ${nAnos(e.anos_na_base, idioma)} in the baseline`, idioma);
      return {
        id: e.id,
        rotulo: e.rotulo,
        valor: emMw ? e.ear_mwmes : e.ear_pct,
        referencia: emMw ? e.p50_mwmes : e.p50,
        detalhe,
      };
    });
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

export function textoMesParcial(s: AguaArmazenamento["serie_mensal_mwmes"], idioma: Idioma = idiomaEnergia()): string {
  const outros = s.meses_sem_ultimo_dia.filter((x) => x.m !== s.mes_parcial?.m);
  const partes: string[] = [];
  const ma = (m: string) => mesAno(m, idioma);
  const d = (x: string) => dataBR(x, idioma);
  if (s.mes_parcial) partes.push(tx(`O último ponto (${ma(s.mes_parcial.m)}) é parcial: EAR de ${d(s.mes_parcial.d)}, não do fim do mês.`, `The last point (${ma(s.mes_parcial.m)}) is partial: EAR of ${d(s.mes_parcial.d)}, not of the end of the month.`, idioma));
  if (outros.length) {
    const itens = listaTexto(outros.map((x) => tx(`${ma(x.m)} (EAR de ${d(x.d)})`, `${ma(x.m)} (EAR of ${d(x.d)})`, idioma)), idioma);
    partes.push(tx(`Meses sem o último dia do calendário: ${itens}.`, `Months without the last calendar day: ${itens}.`, idioma));
  }
  if (!partes.length) partes.push(tx("Todos os meses usam a EAR do último dia do calendário.", "All months use the EAR of the last calendar day.", idioma));
  return partes.join(" ");
}

/* --- capacidade --- */

const rotuloTipoEvento = (k: string, idioma: Idioma): string =>
  ({ entrada: tx("entrada", "addition", idioma), saida: tx("saída", "removal", idioma), alteracao: tx("alteração", "change", idioma) })[k] ?? k;
const rotuloParte = (k: string, idioma: Idioma): string =>
  ({ proprio: tx("própria", "own", idioma), jusante: tx("a jusante", "downstream", idioma), restante: tx("soma dos demais", "sum of the others", idioma) })[k] ?? k;

export function respostaCapacidade(c: AguaArmazenamento["capacidade"], dia: string, idioma: Idioma = idiomaEnergia()): string {
  const sin = c.variacao_desde_inicio_mwmes.SIN;
  const residuo = c.maior_residuo_mwmes !== null ? tx(` (maior resíduo: ${num(c.maior_residuo_mwmes, 1, idioma)} MWmês)`, ` (largest residual: ${num(c.maior_residuo_mwmes, 1, idioma)} MWmonth)`, idioma) : "";
  const partes = [
    tx(
      `De ${dataBR(c.inicio, idioma)} a ${dataBR(dia, idioma)}, a EAR máxima de algum subsistema mudou ${plural(c.n_eventos, "vez", "vezes", idioma)} (cada mudança é um dia num subsistema); ${plural(c.eventos_fechados, "mudança foi atribuída", "mudanças foram atribuídas", idioma)} a reservatórios com resíduo dentro da tolerância${residuo}.`,
      `From ${dataBR(c.inicio, idioma)} to ${dataBR(dia, idioma)}, the maximum EAR of some subsystem changed ${plural(c.n_eventos, "time", "times", idioma)} (each change is one day in one subsystem); ${plural(c.eventos_fechados, "change was", "changes were", idioma)} attributed to reservoirs with a residual within the tolerance${residuo}.`,
      idioma,
    ),
  ];
  if (sin !== null)
    partes.push(
      tx(
        `No período, a EAR máxima do SIN variou ${sinal(sin, 0, "", idioma)} MWmês: um mesmo percentual de anos diferentes não mede a mesma energia.`,
        `Over the period, the maximum EAR of the SIN varied by ${sinal(sin, 0, "", idioma)} MWmonth: the same percentage in different years does not measure the same energy.`,
        idioma,
      ),
    );
  return partes.join(" ");
}

export function colunasEventos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const u = uMwmes(idioma);
  return [
    { id: "data", rotulo: tx("Dia", "Day", idioma), tipo: "data" },
    { id: "sm", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto", categorica: true },
    { id: "variacao_mwmes", rotulo: tx("Variação da EAR máxima", "Change in maximum EAR", idioma), tipo: "numero", unidade: u, casas: 3 },
    { id: "reservatorios", rotulo: tx("Reservatórios (até três maiores)", "Reservoirs (up to the three largest)", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "n_reservatorios", rotulo: tx("Reservatórios no evento", "Reservoirs in the event", idioma), tipo: "numero", casas: 0 },
    { id: "residuo_mwmes", rotulo: tx("Resíduo", "Residual", idioma), tipo: "numero", unidade: u, casas: 3 },
    { id: "fechado", rotulo: tx("Dentro da tolerância", "Within tolerance", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_EVENTOS: ColunaTabela[] = colunasEventos("pt");

export function linhasEventos(eventos: readonly AguaEventoCapacidade[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return eventos.map((e) => ({
    id: `${e.data}:${e.sm}`,
    data: e.data,
    sm: nomeRegiao(e.sm, idioma),
    variacao_mwmes: e.variacao_mwmes,
    reservatorios: e.reservatorios
      .map((r) =>
        tx(
          `${nomeProprio(r.nome, idioma)} (${rotuloTipoEvento(r.tipo, idioma)}, parte ${rotuloParte(r.parte, idioma)}, ${sinal(r.variacao_mwmes, 1, "", idioma)} MWmês)`,
          `${nomeProprio(r.nome, idioma)} (${rotuloTipoEvento(r.tipo, idioma)}, ${rotuloParte(r.parte, idioma)} part, ${sinal(r.variacao_mwmes, 1, "", idioma)} MWmonth)`,
          idioma,
        ),
      )
      .join("; "),
    n_reservatorios: e.n_reservatorios,
    residuo_mwmes: e.residuo_mwmes,
    fechado: e.fechado ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
  }));
}

export function colunasFimDeAno(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "d", rotulo: tx("Dia usado", "Day used", idioma), tipo: "data" },
    ...REGIOES.map((r): ColunaTabela => ({ id: r, rotulo: tx(`EAR máxima ${CURTO_REGIAO[r]}`, `Maximum EAR ${curtoRegiao(r, "en")}`, idioma), tipo: "numero", unidade: uMwmes(idioma), casas: 1 })),
  ];
}
export const COLUNAS_FIM_DE_ANO: ColunaTabela[] = colunasFimDeAno("pt");

export function linhasFimDeAno(c: AguaArmazenamento["capacidade"]): LinhaTabela[] {
  return c.fim_de_ano.map((x) => ({ id: String(x.ano), ano: x.ano, d: x.d, SIN: x.SIN, SE: x.SE, S: x.S, NE: x.NE, N: x.N }));
}

/* --- perímetro dos REE --- */

export function textoQuebraRee(q: AguaQuebraPerimetroRee, idioma: Idioma = idiomaEnergia()): string {
  const mudaram = q.comparacao.filter((c) => c.perimetro_mudou && !c.novo);
  const iguais = q.comparacao.filter((c) => !c.perimetro_mudou && !c.novo);
  const np = (n: string) => nomeProprio(n, idioma);
  const mw = (v: number | null | undefined) => mwmes(v, idioma);
  const d = (x: string) => dataBR(x, idioma);
  const lista = (xs: string[]) => listaTexto(xs, idioma);
  const novos = lista(q.novos.map(np));
  const partes = [
    tx(
      `Em ${d(q.data)} a configuração dos REE mudou nos próprios arquivos do ONS, sem declaração no dicionário: ${novos} ${q.novos.length === 1 ? "apareceu" : "apareceram"} já com EAR máxima positiva.`,
      `On ${d(q.data)} the REE configuration changed in the ONS files themselves, with no statement in the data dictionary: ${novos} appeared already with a positive maximum EAR.`,
      idioma,
    ),
  ];
  if (q.dia_soma_conservada) {
    partes.push(
      tx(
        `A soma das EAR máximas se conserva entre ${d(q.dia_soma_conservada)} e ${d(q.data)} (${mw(q.soma_ear_max_antes_mwmes)} e ${mw(q.soma_ear_max_depois_mwmes)} MWmês): é repartição, não capacidade nova.`,
        `The sum of the maximum EARs is preserved between ${d(q.dia_soma_conservada)} and ${d(q.data)} (${mw(q.soma_ear_max_antes_mwmes)} and ${mw(q.soma_ear_max_depois_mwmes)} MWmonth): it is a reallocation, not new capacity.`,
        idioma,
      ),
    );
  }
  if (mudaram.length) {
    const m = lista(mudaram.map((c) => tx(`${np(c.nome)} (${mw(c.ear_max_antes_mwmes)} para ${mw(c.ear_max_depois_mwmes)} MWmês)`, `${np(c.nome)} (${mw(c.ear_max_antes_mwmes)} to ${mw(c.ear_max_depois_mwmes)} MWmonth)`, idioma)));
    const ig = lista(iguais.map((c) => np(c.nome)));
    partes.push(tx(`Mudaram de perímetro: ${m}; ${ig} não mudaram.`, `Changed perimeter: ${m}; ${ig} did not change.`, idioma));
  }
  if (q.transicao.length) {
    const t = lista(q.transicao.map((x) => d(x)));
    partes.push(
      tx(
        `${t} ${q.transicao.length === 1 ? "é dia" : "são dias"} de transição (perímetro já mudado e REE novos ausentes).`,
        `${t} ${q.transicao.length === 1 ? "is a transition day" : "are transition days"} (perimeter already changed and new REEs absent).`,
        idioma,
      ),
    );
  }
  partes.push(tx(`A faixa sazonal dos REE afetados usa só anos do perímetro atual.`, `The seasonal range of the affected REEs uses only years of the current perimeter.`, idioma));
  return partes.join(" ");
}

export function colunasQuebraRee(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "nome", rotulo: "REE", tipo: "texto" },
    { id: "antes", rotulo: tx("EAR máxima antes", "Maximum EAR before", idioma), tipo: "numero", unidade: uMwmes(idioma), casas: 0 },
    { id: "depois", rotulo: tx("EAR máxima depois", "Maximum EAR after", idioma), tipo: "numero", unidade: uMwmes(idioma), casas: 0 },
    { id: "situacao", rotulo: tx("Situação", "Status", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_QUEBRA_REE: ColunaTabela[] = colunasQuebraRee("pt");

export function linhasQuebraRee(q: AguaQuebraPerimetroRee, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return q.comparacao.map((c) => ({
    id: c.nome,
    nome: nomeProprio(c.nome, idioma),
    antes: c.ear_max_antes_mwmes,
    depois: c.ear_max_depois_mwmes,
    situacao: c.novo ? tx("REE novo", "new REE", idioma) : c.perimetro_mudou ? tx("perímetro mudou", "perimeter changed", idioma) : tx("sem mudança", "no change", idioma),
  }));
}

/* --- reconciliação e capturas --- */

export function textoReconciliacaoEar(r: AguaReconciliacaoEar, idioma: Idioma = idiomaEnergia()): string[] {
  const t: string[] = [];
  const n = (v: number | null | undefined, c: number) => num(v, c, idioma);
  t.push(
    tx(
      `SIN em ${dataBR(r.dia)}: ${num(r.sin_mwmes, 3)} MWmês pela soma dos quatro subsistemas; ${num(r.soma_bacias_mwmes, 3)} pela soma das ${r.n_bacias} bacias e ${num(r.soma_ree_mwmes, 3)} pela soma dos ${r.n_ree} REE, da mesma captura.`,
      `SIN on ${dataBR(r.dia, "en")}: ${n(r.sin_mwmes, 3)} MWmonth as the sum of the four subsystems; ${n(r.soma_bacias_mwmes, 3)} as the sum of the ${r.n_bacias} basins and ${n(r.soma_ree_mwmes, 3)} as the sum of the ${r.n_ree} REEs, from the same capture.`,
      idioma,
    ),
  );
  if (r.media_simples_dos_percentuais !== null && r.diferenca_media_simples_pp !== null) {
    t.push(
      tx(
        `A média simples dos percentuais dos subsistemas daria ${pct(r.media_simples_dos_percentuais, 2)}, ${sinal(r.diferenca_media_simples_pp, 2)} p.p. diferente da razão de somas publicada: por isso ela nunca é usada.`,
        `The simple average of the subsystem percentages would give ${pct(r.media_simples_dos_percentuais, 2, "en")}, ${sinal(r.diferenca_media_simples_pp, 2, "", "en")} pp away from the published ratio of sums: that is why it is never used.`,
        idioma,
      ),
    );
  }
  if (r.pct_publicado_vs_recalculado_max_pp !== null) {
    t.push(
      tx(
        `Percentual publicado pelo ONS contra o recalculado (EAR ÷ EAR máxima) em ${num(r.pares_conferidos, 0)} pares: diferença máxima de ${num(r.pct_publicado_vs_recalculado_max_pp, 5)} p.p.`,
        `Percentage published by ONS against the recalculated one (EAR ÷ maximum EAR) in ${n(r.pares_conferidos, 0)} pairs: maximum difference of ${n(r.pct_publicado_vs_recalculado_max_pp, 5)} pp.`,
        idioma,
      ),
    );
  }
  const anos = r.anos_sem_divergencia.length ? listaTexto(r.anos_sem_divergencia.map(String), idioma) : tx("nenhum", "none", idioma);
  t.push(
    tx(
      `Soma dos reservatórios contra o subsistema: ${num(r.dias_reservatorios_comparados, 0)} dias comparados, ${num(r.dias_reservatorios_fora_tolerancia, 0)} fora da tolerância; anos sem divergência: ${anos}.`,
      `Sum of the reservoirs against the subsystem: ${n(r.dias_reservatorios_comparados, 0)} days compared, ${n(r.dias_reservatorios_fora_tolerancia, 0)} outside the tolerance; years without divergence: ${anos}.`,
      idioma,
    ),
  );
  return t;
}

export function colunasReservatoriosPorAno(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const u = uMwmes(idioma);
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "sm", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto", categorica: true },
    { id: "dias", rotulo: tx("Dias comparados", "Days compared", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "tolerancia_mwmes", rotulo: tx("Tolerância", "Tolerance", idioma), tipo: "numero", unidade: u, casas: 2 },
    { id: "precisao", rotulo: tx("Precisão da fonte", "Source precision", idioma), tipo: "texto" },
    { id: "dias_fora_ear", rotulo: tx("Dias fora (EAR)", "Days outside (EAR)", idioma), tipo: "numero", casas: 0 },
    { id: "max_dif_ear_mwmes", rotulo: tx("Maior diferença (EAR)", "Largest difference (EAR)", idioma), tipo: "numero", unidade: u, casas: 3 },
    { id: "dias_fora_ear_max", rotulo: tx("Dias fora (EAR máxima)", "Days outside (maximum EAR)", idioma), tipo: "numero", casas: 0 },
    { id: "max_dif_ear_max_mwmes", rotulo: tx("Maior diferença (EAR máxima)", "Largest difference (maximum EAR)", idioma), tipo: "numero", unidade: u, casas: 3 },
  ];
}
export const COLUNAS_RESERVATORIOS_POR_ANO: ColunaTabela[] = colunasReservatoriosPorAno("pt");

export function linhasReservatoriosPorAno(r: AguaReconciliacaoEar, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return r.reservatorios_por_ano.map((x) => ({ id: `${x.ano}:${x.sm}`, ...x, sm: nomeRegiao(x.sm, idioma), precisao: rotuloDaGold(PRECISAO_EN, x.precisao, idioma) }));
}

export function colunasRevisoesCapturas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "sm", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto", categorica: true },
    { id: "serie", rotulo: tx("Série", "Series", idioma), tipo: "texto", categorica: true },
    { id: "dias_revisados", rotulo: tx("Dias revisados em 30", "Days revised out of 30", idioma), tipo: "numero", casas: 0 },
    { id: "dia_maior", rotulo: tx("Dia da maior revisão", "Day of the largest revision", idioma), tipo: "data" },
    { id: "silver_principal", rotulo: tx("Captura anterior", "Previous capture", idioma), tipo: "numero", casas: 3 },
    { id: "recaptura", rotulo: tx("Recaptura", "Recapture", idioma), tipo: "numero", casas: 3 },
    { id: "diferenca", rotulo: tx("Diferença", "Difference", idioma), tipo: "numero", casas: 3 },
  ];
}
export const COLUNAS_REVISOES_CAPTURAS: ColunaTabela[] = colunasRevisoesCapturas("pt");

const rotuloSerie = (k: string, idioma: Idioma): string =>
  ({
    ear_mwmes: tx("EAR (MWmês)", "EAR (MWmonth)", idioma),
    ena_bruta_mwmed: tx("ENA bruta (MWmed)", "Gross ENA (MWavg)", idioma),
    ena_bruta_pct_mlt: tx("ENA bruta (% da MLT)", "Gross ENA (% of MLT)", idioma),
  })[k] ?? k;

export function linhasRevisoesCapturas(rs: readonly AguaRevisaoCaptura[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return rs.map((r) => ({ id: `${r.sm}:${r.serie}`, ...r, sm: nomeRegiao(r.sm, idioma), serie: rotuloSerie(r.serie, idioma) }));
}

export function textoRevisoesCapturas(rs: readonly AguaRevisaoCaptura[], idioma: Idioma = idiomaEnergia()): string {
  const com = rs.filter((r) => r.dias_revisados > 0);
  if (!com.length) return tx("Nenhum valor dos últimos 30 dias mudou entre as duas capturas.", "No value from the last 30 days changed between the two captures.", idioma);
  const itens = listaTexto(
    com.map((r) =>
      tx(
        `${NOME_REGIAO[r.sm]}, ${rotuloSerie(r.serie, "pt")}, ${plural(r.dias_revisados, "dia", "dias", "pt")} (maior diferença ${sinal(r.diferenca, 3, "", "pt")} em ${dataBR(r.dia_maior, "pt")})`,
        `${nomeRegiao(r.sm, "en")}, ${rotuloSerie(r.serie, "en")}, ${plural(r.dias_revisados, "day", "days", "en")} (largest difference ${sinal(r.diferenca, 3, "", "en")} on ${dataBR(r.dia_maior, "en")})`,
        idioma,
      ),
    ),
    idioma,
  );
  return tx(`O ONS revisou valores recentes entre as duas capturas: ${itens}. Em cada ano vale a captura mais recente.`, `ONS revised recent values between the two captures: ${itens}. In each year the most recent capture applies.`, idioma);
}

export function colunasCapturas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "fonte", rotulo: tx("Captura usada", "Capture used", idioma), tipo: "texto", categorica: true }, // i18n: dado
    { id: "capturado_em", rotulo: tx("Capturado em (UTC)", "Captured on (UTC)", idioma), tipo: "texto" },
    { id: "recurso", rotulo: tx("Arquivo do ONS", "ONS file", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_CAPTURAS: ColunaTabela[] = colunasCapturas("pt");

export function linhasCapturas(cs: readonly AguaCapturaAno[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return cs.map((c) => ({ id: String(c.ano), ano: c.ano, fonte: rotuloDaGold(FONTE_CAPTURA_EN, c.fonte, idioma), capturado_em: c.capturado_em, recurso: c.recurso }));
}

/* ======================================================================
 * P018 afluência
 * ==================================================================== */

export type EntidadeEna = AguaEnaResumo & { id: string; tipo: TipoRecorte; rotulo: string };

export function entidadesEna(f: AguaAfluencia, idioma: Idioma = idiomaEnergia()): EntidadeEna[] {
  const subs = [...f.subsistemas].sort((x, y) => REGIOES.indexOf(x.sm) - REGIOES.indexOf(y.sm));
  return [
    ...subs.map((s): EntidadeEna => ({ ...s, id: s.sm, tipo: "subsistema", nome: s.sm, rotulo: rotuloRecorte("subsistema", s.sm, idioma) })),
    ...f.ree.map((r): EntidadeEna => ({ ...r, id: idRecorte("ree", r.nome), tipo: "ree", rotulo: rotuloRecorte("ree", r.nome, idioma) })),
    ...f.bacias.map((r): EntidadeEna => ({ ...r, id: idRecorte("bacia", r.nome), tipo: "bacia", rotulo: rotuloRecorte("bacia", r.nome, idioma) })),
  ];
}

export function recortePadraoEna(lista: readonly EntidadeEna[], tipo: TipoRecorte): string {
  if (tipo === "subsistema") return "SIN";
  const doTipo = lista.filter((e) => e.tipo === tipo);
  const maior = [...doTipo].sort((a, b) => (b.mlt_30d_soma_mwmed_dia ?? -1) - (a.mlt_30d_soma_mwmed_dia ?? -1) || a.nome.localeCompare(b.nome))[0];
  return maior?.id ?? "SIN";
}

/**
 * Por que não há ENA de 30 dias em % da MLT, dito pela causa exata e lida dos campos da gold: as afluências que o ONS publica agrupadas
 * ("Outras do Sul", "Outras do Sudeste") não têm MLT; nos demais recortes, falta ENA em algum dia da janela ou falta a MLT.
 */
export function motivoSemEna30d(e: Pick<EntidadeEna, "nome" | "tipo" | "ena_30d_soma_mwmed_dia" | "mlt_30d_soma_mwmed_dia">, idioma: Idioma = idiomaEnergia()): string {
  if (e.tipo === "bacia" && ehGrupoOns(e.nome)) return tx("o ONS publica essas afluências agrupadas sem MLT, e sem MLT não há percentual", "ONS publishes these grouped inflows without an MLT, and without an MLT there is no percentage", idioma);
  if (e.ena_30d_soma_mwmed_dia === null) return tx("falta ENA em algum dia da janela de 30 dias, e a razão nunca é calculada com dia faltando", "ENA is missing on some day of the 30-day window, and the ratio is never calculated with a missing day", idioma);
  if (e.mlt_30d_soma_mwmed_dia === null) return tx("não há MLT publicada para o recorte, e sem MLT não há percentual", "there is no MLT published for this area, and without an MLT there is no percentage", idioma);
  return tx("algum dia da janela ficou sem dado, e a razão nunca é calculada com dia faltando", "some day of the window has no data, and the ratio is never calculated with a missing day", idioma);
}

/** O período da faixa usual da janela, sem a expressão quebrada "em sem base" quando o recorte não tem faixa: "faixa da mesma janela em 2001 a 2025". */
export function textoFaixaJanela(e: Pick<EntidadeEna, "periodo_base" | "anos_na_base_30d" | "pct_mlt_30d" | "faixa_30d">, idioma: Idioma = idiomaEnergia()): string {
  if (e.faixa_30d && e.periodo_base) return tx(`faixa da mesma janela em ${periodoBase(e.periodo_base, "pt")}`, `range of the same window in ${periodoBase(e.periodo_base, "en")}`, idioma);
  if (e.pct_mlt_30d === null) return tx("sem faixa da mesma janela, porque o recorte não tem ENA de 30 dias", "no range for the same window, because the area has no 30-day ENA", idioma);
  return tx(`sem faixa da mesma janela: ${nAnos(e.anos_na_base_30d, "pt")} na base, e o mínimo é 5`, `no range for the same window: ${nAnos(e.anos_na_base_30d, "en")} in the baseline, and the minimum is 5`, idioma);
}

/**
 * A referência da ENA armazenável: o ONS publica o percentual da armazenável sobre a MLT da ENA bruta (a MLT diária que sai da razão
 * armazenável ÷ percentual é a mesma da bruta) e não publica uma MLT própria da armazenável. Dito junto do número, para 100% não ser lido
 * como o normal da energia armazenável.
 */
export function textoSemMltArmazenavel(idioma: Idioma = idiomaEnergia()): string {
  return tx("o ONS não publica uma MLT própria da armazenável, e 100% não é o normal dela", "ONS does not publish a separate MLT for storable ENA, and 100% is not its normal", idioma);
}
export const TEXTO_SEM_MLT_ARMAZENAVEL = textoSemMltArmazenavel("pt");

/** Nota do número da ENA armazenável de 30 dias, com o que ela é e qual é a referência (a unidade do cartão segue "da MLT", como a dos vizinhos, para não quebrar linha). */
export function notaEnaArmazenavel(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    `Em % da MLT da ENA bruta (vazões naturais menos as vertidas): ${textoSemMltArmazenavel("pt")}.`,
    `In % of the MLT of gross ENA (natural flows minus spilled flows): ${textoSemMltArmazenavel("en")}.`,
    idioma,
  );
}
export const NOTA_ENA_ARMAZENAVEL = notaEnaArmazenavel("pt");

type FichaComRazao = { indicador: string; valor_exibido: string; unidade: string; formula: string; denominador?: { descricao: string } | null };

/**
 * A mesma ficha de prova da ENA armazenável com o nome certo da referência. A gold a chama de "% da MLT armazenável" e de "soma das MLT
 * armazenáveis implícitas", mas o denominador é a MLT diária da ENA bruta (no SIN, 1.096.498,51 e 1.096.498,46 MWmed·dia: a mesma soma,
 * até o arredondamento do percentual). A prova (valores, arquivos, passos) segue como está; só o nome e a fórmula dizem a referência.
 * Os textos da ficha vêm da gold, em português; a correção é escrita na mesma língua da ficha.
 */
export function evidenciaEnaArmazenavel<E extends FichaComRazao>(ev: E): E {
  return {
    ...ev,
    indicador: ev.indicador.replace(/ do SIN$/, " do SIN, em % da MLT da ENA bruta"), // i18n: dado
    valor_exibido: ev.valor_exibido.replace("da MLT armazenável", "da MLT da ENA bruta"),
    unidade: "% da MLT da ENA bruta", // i18n: dado
    // i18n: dado
    formula: `${ev.formula.split(",")[0].replace(/MLTarm/g, "MLT")}, com MLT(d) = ENAarm(d) ÷ (percentual da MLT que o ONS publica para a armazenável) × 100. Essa MLT diária é a da ENA bruta: ${TEXTO_SEM_MLT_ARMAZENAVEL}.`,
    // i18n: dado
    denominador: ev.denominador ? { ...ev.denominador, descricao: "soma das MLT diárias implícitas, que são as da ENA bruta (MWmed·dia)" } : ev.denominador,
  };
}

/**
 * Os dois "normais" da afluência lado a lado: 100% é a MLT (a média de longo termo que o ONS calcula) e a mediana da janela é o valor do
 * meio entre os mesmos dias dos anos da base. Sem faixa na base, a mediana não existe e a frase não é escrita.
 */
export function textoMedianaEMlt(e: Pick<EntidadeEna, "p50_30d" | "periodo_base">, idioma: Idioma = idiomaEnergia()): string | null {
  if (e.p50_30d === null || !e.periodo_base) return null;
  return tx(
    `Há dois “normais”: 100% é a MLT, a média de longo termo que o ONS calcula; ${pct(e.p50_30d, 1)} é a mediana da mesma janela em ${periodoBase(e.periodo_base, "pt")}, o valor do meio entre os anos da base. Uma média pode ficar acima da mediana quando poucos anos muito úmidos a puxam para cima.`,
    `There are two “normals”: 100% is the MLT, the long-term average that ONS calculates; ${pct(e.p50_30d, 1, "en")} is the median of the same window in ${periodoBase(e.periodo_base, "en")}, the middle value across the baseline years. An average can sit above the median when a few very wet years pull it up.`,
    idioma,
  );
}

export function respostaAfluencia(e: EntidadeEna, idiomaOuIndice?: Idioma | number): string {
  const idioma = idiomaDe(idiomaOuIndice);
  const de = doRecorte(e.tipo, e.nome, idioma);
  const d = dataBR(e.dia, idioma);
  const n0 = (v: number | null | undefined) => num(v, 0, idioma);
  const p1 = (v: number | null | undefined) => pct(v, 1, idioma);
  if (e.pct_mlt_30d === null) {
    return tx(`Sem ENA de 30 dias ${de} até ${d}: ${motivoSemEna30d(e, idioma)}.`, `No 30-day ENA ${de} through ${d}: ${motivoSemEna30d(e, idioma)}.`, idioma);
  }
  const partes: string[] = [];
  let p = tx(
    `Nos 30 dias até ${d}, a ENA bruta ${de} somou ${n0(e.ena_30d_soma_mwmed_dia)} MWmed·dia, ${p1(e.pct_mlt_30d)} da MLT do mesmo período (${n0(e.mlt_30d_soma_mwmed_dia)} MWmed·dia)`,
    `In the 30 days through ${d}, the gross ENA ${de} added up to ${n0(e.ena_30d_soma_mwmed_dia)} MWavg·day, ${p1(e.pct_mlt_30d)} of the MLT for the same period (${n0(e.mlt_30d_soma_mwmed_dia)} MWavg·day)`,
    idioma,
  );
  const base = periodoBase(e.periodo_base, idioma);
  if (e.faixa_30d && e.p10_30d !== null && e.p90_30d !== null) {
    p += tx(
      `, ${rotuloFaixa(e.faixa_30d, idioma)} da mesma janela (10º a 90º percentil em ${base}: ${p1(e.p10_30d)} a ${p1(e.p90_30d)}; percentil ${num(e.percentil_30d, 1, idioma)}).`,
      `, ${rotuloFaixa(e.faixa_30d, idioma)} for the same window (10th to 90th percentile in ${base}: ${p1(e.p10_30d)} to ${p1(e.p90_30d)}; percentile ${num(e.percentil_30d, 1, idioma)}).`,
      idioma,
    );
  } else {
    p += tx(
      `; com ${nAnos(e.anos_na_base_30d, idioma)} na base da mesma janela, menos que os 5 exigidos, não há faixa usual.`,
      `; with ${nAnos(e.anos_na_base_30d, idioma)} in the baseline for the same window, fewer than the 5 required, there is no usual range.`,
      idioma,
    );
  }
  partes.push(p);
  if (e.pct_mlt_dia !== null) partes.push(tx(`No dia ${d}, ${p1(e.pct_mlt_dia)} da MLT do dia.`, `On ${d}, ${p1(e.pct_mlt_dia)} of the MLT for the day.`, idioma));
  if (e.pct_mlt_arm_30d !== undefined && e.pct_mlt_arm_30d !== null) {
    partes.push(
      tx(
        `A ENA armazenável (as vazões naturais menos as vertidas), com a mesma regra de 30 dias, ficou em ${p1(e.pct_mlt_arm_30d)} da MLT da ENA bruta: ${textoSemMltArmazenavel("pt")}.`,
        `The storable ENA (natural flows minus spilled flows), with the same 30-day rule, stood at ${p1(e.pct_mlt_arm_30d)} of the MLT of gross ENA: ${textoSemMltArmazenavel("en")}.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

/**
 * Veredito do P018 em palavras simples: a água que chegou em 30 dias contra a média de longo termo e contra a faixa usual da
 * janela. As somas em MWmed·dia, o percentil e a ENA armazenável ficam em respostaAfluencia.
 */
export function vereditoAfluencia(e: EntidadeEna, idiomaOuIndice?: Idioma | number): string {
  const idioma = idiomaDe(idiomaOuIndice);
  const d = dataBR(e.dia, idioma);
  if (e.pct_mlt_30d === null) return tx(`Sem ENA de 30 dias ${doRecorte(e.tipo, e.nome, idioma)} até ${d}: ${motivoSemEna30d(e, idioma)}.`, `No 30-day ENA ${doRecorte(e.tipo, e.nome, idioma)} through ${d}: ${motivoSemEna30d(e, idioma)}.`, idioma);
  const base = tx(
    `Nos 30 dias até ${d}, a água que chegou ${aoRecorte(e.tipo, e.nome, idioma)} (ENA) foi ${pct(e.pct_mlt_30d, 1, idioma)} da média de longo termo (MLT) do período`,
    `In the 30 days through ${d}, the water reaching ${artigoRecorte(e.tipo, e.nome, idioma)} (ENA) was ${pct(e.pct_mlt_30d, 1, idioma)} of the long-term average (MLT) for the period`,
    idioma,
  );
  if (e.faixa_30d && e.p10_30d !== null && e.p90_30d !== null) return tx(`${base}, ${rotuloFaixa(e.faixa_30d, idioma)} da mesma janela.`, `${base}, ${rotuloFaixa(e.faixa_30d, idioma)} for the same window.`, idioma);
  return tx(`${base}; com ${nAnos(e.anos_na_base_30d, idioma)} na base da janela, não há faixa usual.`, `${base}; with ${nAnos(e.anos_na_base_30d, idioma)} in the window baseline, there is no usual range.`, idioma);
}

/**
 * Colunas da tabela equivalente da afluência. Em Entender ficam o recorte, a ENA de 30 dias e o percentil (cabem em 360 px, com o número
 * junto do nome; a coluna de texto da posição não cabe ao lado de duas numéricas); as demais vão para Analisar. O arquivo exportado sempre leva todas.
 */
export function colunasAfluencia(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const pm = tx("% da MLT", "% of MLT", idioma);
  const md = tx("MWmed·dia", "MWavg·day", idioma);
  return [
    { id: "rotulo", rotulo: tx("Recorte", "Area", idioma), tipo: "texto" },
    { id: "tipo", rotulo: tx("Tipo", "Type", idioma), tipo: "texto", categorica: true, nivel: "analisar" },
    { id: "dia", rotulo: tx("Último dia", "Last day", idioma), tipo: "data", nivel: "analisar" }, // i18n: dado
    { id: "pct_mlt_30d", rotulo: tx("ENA de 30 dias", "30-day ENA", idioma), tipo: "numero", unidade: pm, casas: 1 },
    { id: "ena_30d_soma_mwmed_dia", rotulo: tx("Soma da ENA", "Sum of ENA", idioma), tipo: "numero", unidade: md, casas: 1, nivel: "analisar" },
    { id: "mlt_30d_soma_mwmed_dia", rotulo: tx("Soma da MLT", "Sum of MLT", idioma), tipo: "numero", unidade: md, casas: 1, nivel: "analisar" },
    { id: "p10_30d", rotulo: tx("10º percentil da janela", "10th percentile of the window", idioma), tipo: "numero", unidade: pm, casas: 1, nivel: "analisar" },
    { id: "p50_30d", rotulo: tx("Mediana da janela", "Median of the window", idioma), tipo: "numero", unidade: pm, casas: 1, nivel: "analisar" },
    { id: "p90_30d", rotulo: tx("90º percentil da janela", "90th percentile of the window", idioma), tipo: "numero", unidade: pm, casas: 1, nivel: "analisar" },
    { id: "faixa", rotulo: tx("Posição", "Position", idioma), tipo: "texto", categorica: true, nivel: "analisar" },
    { id: "percentil_30d", rotulo: tx("Percentil", "Percentile", idioma), tipo: "numero", casas: 1 },
    { id: "anos_na_base_30d", rotulo: tx("Anos na base", "Years in the baseline", idioma), tipo: "numero", casas: 0, nivel: "analisar" },
    { id: "periodo_base", rotulo: tx("Período da base", "Baseline period", idioma), tipo: "texto", nivel: "analisar" },
    { id: "pct_mlt_dia", rotulo: tx("ENA do dia", "ENA on the day", idioma), tipo: "numero", unidade: pm, casas: 1, nivel: "analisar" },
    { id: "nome", rotulo: tx("Nome no ONS", "Name at ONS", idioma), tipo: "texto", nivel: "analisar", idiomaTexto: "nome" },
  ];
}
export const COLUNAS_AFLUENCIA: ColunaTabela[] = colunasAfluencia("pt");

export function linhasAfluencia(lista: readonly EntidadeEna[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return lista.map((e) => ({
    id: e.id,
    rotulo: e.rotulo,
    tipo: rotuloTipoRecorte(e.tipo, idioma),
    dia: e.dia,
    pct_mlt_30d: e.pct_mlt_30d,
    ena_30d_soma_mwmed_dia: e.ena_30d_soma_mwmed_dia,
    mlt_30d_soma_mwmed_dia: e.mlt_30d_soma_mwmed_dia,
    p10_30d: e.p10_30d,
    p50_30d: e.p50_30d,
    p90_30d: e.p90_30d,
    faixa: e.faixa_30d
      ? rotuloFaixa(e.faixa_30d, idioma)
      : e.pct_mlt_30d === null
        ? tx("sem ENA de 30 dias", "no 30-day ENA", idioma)
        : tx(`sem faixa (${nAnos(e.anos_na_base_30d, idioma)} na base)`, `no range (${nAnos(e.anos_na_base_30d, idioma)} in the baseline)`, idioma),
    percentil_30d: e.percentil_30d,
    anos_na_base_30d: e.anos_na_base_30d,
    periodo_base: e.periodo_base ? periodoBase(e.periodo_base, idioma) : null,
    pct_mlt_dia: e.pct_mlt_dia,
    nome: e.nome,
  }));
}

export function itensPontosAfluencia(lista: readonly EntidadeEna[], idioma: Idioma = idiomaEnergia()) {
  return lista.map((e) => ({
    id: e.id,
    rotulo: e.rotulo,
    valor: e.pct_mlt_30d,
    referencia: e.p50_30d,
    detalhe:
      e.faixa_30d && e.p10_30d !== null && e.p90_30d !== null
        ? tx(
            `faixa da janela ${pct(e.p10_30d, 1, idioma)} a ${pct(e.p90_30d, 1, idioma)} (${periodoBase(e.periodo_base, idioma)}); ${rotuloFaixa(e.faixa_30d, idioma)}`,
            `window range ${pct(e.p10_30d, 1, idioma)} to ${pct(e.p90_30d, 1, idioma)} (${periodoBase(e.periodo_base, idioma)}); ${rotuloFaixa(e.faixa_30d, idioma)}`,
            idioma,
          )
        : e.pct_mlt_30d === null
          ? tx("sem ENA de 30 dias", "no 30-day ENA", idioma)
          : tx(`sem faixa: ${nAnos(e.anos_na_base_30d, idioma)} na base`, `no range: ${nAnos(e.anos_na_base_30d, idioma)} in the baseline`, idioma),
  }));
}

/* --- MLT --- */

/** O que se sabe da versão da MLT, a partir dos campos da gold (uma frase por achado). */
export function textosMlt(mlt: AguaMlt, anoCorrente: string, idioma: Idioma = idiomaEnergia()): string[] {
  const t: string[] = [];
  const ma = (m: string) => mesAno(m, idioma);
  const d = (x: string) => dataBR(x, idioma);
  const lista = (xs: string[]) => listaTexto(xs, idioma);
  const iguais = mlt.ano_corrente_igual_ao_anterior;
  if (iguais.length) {
    const tot = iguais.reduce((s, x) => s + x.usinas_comparadas, 0);
    const ig = iguais.reduce((s, x) => s + x.usinas_iguais, 0);
    // a frase segue a contagem: "a mesma" só com todas iguais; 95% ou mais é "repete em quase todas"
    const juizo =
      ig === tot
        ? tx("é a mesma do ano anterior", "is the same as the previous year's", idioma)
        : ig >= 0.95 * tot
          ? tx("repete a do ano anterior em quase todas as usinas", "repeats the previous year's in almost all plants", idioma)
          : tx("difere da do ano anterior", "differs from the previous year's", idioma);
    const ano = iguais[0].mes.slice(0, 4) || anoCorrente;
    t.push(
      tx(
        `No conjunto aberto do ONS, a MLT de ${ano} ${juizo}: no último dia de cada mês encerrado (${ma(iguais[0].mes)} a ${ma(iguais[iguais.length - 1].mes)}), ${num(ig, 0, idioma)} de ${num(tot, 0, idioma)} comparações por usina deram valores iguais.`,
        `In the ONS open dataset, the ${ano} MLT ${juizo}: on the last day of each closed month (${ma(iguais[0].mes)} to ${ma(iguais[iguais.length - 1].mes)}), ${num(ig, 0, idioma)} of ${num(tot, 0, idioma)} plant-by-plant comparisons gave equal values.`,
        idioma,
      ),
    );
  }
  for (const p of mlt.periodos_provisorios) {
    // inferência do observatório (uma versão nova e ampla, desfeita depois por um retorno), não uma classificação do ONS
    t.push(
      tx(
        `De ${d(p.inicio)} a ${d(p.fim)} vigorou uma versão inferida como provisória (a inferência é do observatório, não do ONS: uma versão nova foi desfeita depois por um retorno; ${plural(p.usinas_na_nova_versao, "usina mudou", "usinas mudaram", idioma)}); em ${d(p.retorno_em)} ${plural(p.usinas_no_retorno, "usina voltou", "usinas voltaram", idioma)} aos valores vigentes em ${d(p.versao_restaurada_igual_a_de)}.`,
        `From ${d(p.inicio)} to ${d(p.fim)} a version inferred as provisional was in force (the inference is the observatory's, not ONS's: a new version was later undone by a reversion; ${plural(p.usinas_na_nova_versao, "plant changed", "plants changed", idioma)}); on ${d(p.retorno_em)} ${plural(p.usinas_no_retorno, "plant returned", "plants returned", idioma)} to the values in force on ${d(p.versao_restaurada_igual_a_de)}.`,
        idioma,
      ),
    );
  }
  const pmo = mlt.pmo;
  if (pmo.comparacao.length) {
    const dc = pmo.dias_coincidentes.map((x) => tx(`${d(x.inicio)} a ${d(x.fim)}`, `${d(x.inicio)} to ${d(x.fim)}`, idioma));
    const coincide = pmo.meses_coincidentes.length
      ? tx(`coincide nos meses ${lista(pmo.meses_coincidentes.map((x) => ma(x)))}`, `it matches in the months ${lista(pmo.meses_coincidentes.map((x) => ma(x)))}`, idioma)
      : tx("não coincide em nenhum mês inteiro", "it does not match in any whole month", idioma);
    const dias = dc.length ? tx(`${pmo.meses_coincidentes.length ? " e" : ","} coincide nos dias de ${lista(dc)}`, `${pmo.meses_coincidentes.length ? " and" : ","} it matches on the days of ${lista(dc)}`, idioma) : "";
    t.push(
      tx(
        `O Relatório Executivo do PMO publica a MLT mensal por subsistema. Comparada com a MLT implícita do conjunto aberto (tolerância de ${num(pmo.tolerancia_pct, 2)}%, porque o PMO publica MWmed inteiros), ${coincide}${dias}; diverge em ${lista(pmo.meses_divergentes.map((x) => ma(x)))}, com diferença de até ${num(pmo.maior_diferenca_pct, 2)}%.`,
        `The PMO Executive Report (Relatório Executivo do PMO) publishes the monthly MLT by subsystem. Compared with the implicit MLT of the open dataset (tolerance of ${num(pmo.tolerancia_pct, 2, "en")}%, because the PMO publishes whole MWavg), ${coincide}${dias}; it diverges in ${lista(pmo.meses_divergentes.map((x) => ma(x)))}, with a difference of up to ${num(pmo.maior_diferenca_pct, 2, "en")}%.`,
        idioma,
      ),
    );
    const sem = mesesSemPmo(mlt);
    if (sem.length) {
      t.push(
        tx(
          `Sem comparação em ${listaMeses(sem)}: nenhum relatório do PMO desses meses entrou na coleta, e a MLT do conjunto aberto desses meses não foi conferida (a linha dos gráficos é interrompida).`,
          `No comparison in ${listaMeses(sem, "en")}: no PMO report for those months was collected, and the open-dataset MLT for those months was not checked (the chart line is interrupted).`,
          idioma,
        ),
      );
    }
  }
  const revs = mlt.revisoes_no_mes
    .map((r) =>
      tx(
        `${dataBR(r.data)}, ${r.classificacao === "retorno_a_versao_anterior" ? "retorno a uma versão anterior" : "versão nova"} (${plural(r.usinas, "usina", "usinas")})`,
        `${dataBR(r.data, "en")}, ${r.classificacao === "retorno_a_versao_anterior" ? "reversion to an earlier version" : "new version"} (${plural(r.usinas, "plant", "plants", "en")})`,
        idioma,
      ),
    )
    .join("; ");
  t.push(
    tx(
      `${plural(mlt.revisoes_no_mes.length, "mudança", "mudanças")} da MLT de usinas existentes fora do dia 1º: ${revs}. Comparações longas de % da MLT misturam versões da referência.`,
      `${plural(mlt.revisoes_no_mes.length, "change", "changes", "en")} in the MLT of existing plants outside the 1st day of the month: ${revs}. Long comparisons of % of MLT mix versions of the reference.`,
      idioma,
    ),
  );
  return t;
}

export function colunasPmo(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month", idioma), tipo: "texto", categorica: true },
    { id: "sm", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto", categorica: true },
    { id: "pmo_mwmed", rotulo: tx("MLT do PMO", "PMO MLT", idioma), tipo: "numero", unidade: mw, casas: 0 },
    { id: "aberto_inicio_mwmed", rotulo: tx("MLT do conjunto aberto no início do mês", "Open-dataset MLT at the start of the month", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "aberto_fim_mwmed", rotulo: tx("No fim do mês", "At the end of the month", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "dif_inicio_pct", rotulo: tx("Diferença no início", "Difference at the start", idioma), tipo: "percentual", casas: 3 },
    { id: "dif_fim_pct", rotulo: tx("Diferença no fim", "Difference at the end", idioma), tipo: "percentual", casas: 3 },
    { id: "relatorio", rotulo: tx("Relatório citado", "Report cited", idioma), tipo: "texto" },
    { id: "proprio", rotulo: tx("Relatório do próprio mês", "Report for the month itself", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_PMO: ColunaTabela[] = colunasPmo("pt");

export function linhasPmo(mlt: AguaMlt, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return mlt.pmo.comparacao.map((c) => ({
    id: `${c.mes}:${c.sm}`,
    mes: c.mes,
    sm: nomeRegiao(c.sm, idioma),
    pmo_mwmed: c.pmo_mwmed,
    aberto_inicio_mwmed: c.aberto_inicio_mwmed,
    aberto_fim_mwmed: c.aberto_fim_mwmed,
    dif_inicio_pct: c.dif_inicio_pct,
    dif_fim_pct: c.dif_fim_pct,
    relatorio: c.relatorio,
    proprio: c.relatorio_do_proprio_mes ? tx("sim", "yes", idioma) : tx("não (projeção do mês anterior)", "no (projection from the previous month)", idioma),
  }));
}

export function colunasRevisoesMlt(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "data", rotulo: tx("Dia", "Day", idioma), tipo: "data" },
    { id: "usinas", rotulo: tx("Usinas", "Plants", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "classificacao", rotulo: tx("Classificação", "Classification", idioma), tipo: "texto", categorica: true },
    { id: "igual_a", rotulo: tx("Valores iguais aos vigentes em", "Values equal to those in force on", idioma), tipo: "texto" },
    { id: "iguais_1", rotulo: tx("Iguais a 1 ano antes", "Equal to 1 year earlier", idioma), tipo: "texto" },
    { id: "iguais_2", rotulo: tx("Iguais a 2 anos antes", "Equal to 2 years earlier", idioma), tipo: "texto" },
    { id: "abrangencia", rotulo: tx("Abrangência", "Scope", idioma), tipo: "texto", categorica: true },
    { id: "variacao_mediana_pct", rotulo: tx("Variação mediana", "Median change", idioma), tipo: "percentual", casas: 3 },
  ];
}
export const COLUNAS_REVISOES_MLT: ColunaTabela[] = colunasRevisoesMlt("pt");

export function linhasRevisoesMlt(mlt: AguaMlt, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return mlt.revisoes_no_mes.map((r) => ({
    id: r.data,
    data: r.data,
    usinas: r.usinas,
    classificacao: r.classificacao === "retorno_a_versao_anterior" ? tx("retorno a uma versão anterior", "reversion to an earlier version", idioma) : tx("versão nova", "new version", idioma),
    igual_a: r.igual_a_vigente_em ? dataBR(r.igual_a_vigente_em, idioma) : tx("nenhuma versão comparada", "no version compared", idioma),
    iguais_1: tx(`${r.iguais_a_1_ano_antes} de ${r.comparaveis_1_ano_antes}`, `${r.iguais_a_1_ano_antes} of ${r.comparaveis_1_ano_antes}`, idioma),
    iguais_2: tx(`${r.iguais_a_2_anos_antes} de ${r.comparaveis_2_anos_antes}`, `${r.iguais_a_2_anos_antes} of ${r.comparaveis_2_anos_antes}`, idioma),
    abrangencia: rotuloDaGold(ABRANGENCIA_EN, r.abrangencia, idioma),
    variacao_mediana_pct: r.variacao_mediana_pct,
  }));
}

export type PontoMlt = { x: string } & Record<Submercado, number | null>;

/** MLT implícita de cada subsistema no dia 15 de janeiro e de julho (x = "AAAA-MM"). */
export function serieMltImplicita(mlt: AguaMlt): PontoMlt[] {
  const s = mlt.implicita_subsistemas;
  return s.ano.map((a, i) => ({ x: `${a}-${String(s.mes[i]).padStart(2, "0")}`, SE: s.SE[i] ?? null, S: s.S[i] ?? null, NE: s.NE[i] ?? null, N: s.N[i] ?? null }));
}

/** "abril de 2026" a partir de "2026-04" ("April 2026" em inglês). */
export function mesExtenso(anomes: string, idioma: Idioma = idiomaEnergia()): string {
  const m = nomeMes(Number(anomes.slice(5, 7)), idioma, true);
  return tx(`${m} de ${anomes.slice(0, 4)}`, `${m} ${anomes.slice(0, 4)}`, idioma);
}

/** "abril, maio e junho de 2026"; meses de anos diferentes levam o ano cada um ("dezembro de 2025 e janeiro de 2026"). */
export function listaMeses(meses: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (!meses.length) return "";
  const anos = new Set(meses.map((m) => m.slice(0, 4)));
  if (anos.size === 1) {
    const nomes = listaTexto(meses.map((m) => nomeMes(Number(m.slice(5, 7)), idioma, true)), idioma);
    return tx(`${nomes} de ${meses[0].slice(0, 4)}`, `${nomes} ${meses[0].slice(0, 4)}`, idioma);
  }
  return listaTexto(meses.map((m) => mesExtenso(m, idioma)), idioma);
}

/** Todos os meses ("AAAA-MM") de um extremo ao outro, inclusive. */
export function mesesEntre(inicio: string, fim: string): string[] {
  const out: string[] = [];
  let a = Number(inicio.slice(0, 4));
  let m = Number(inicio.slice(5, 7));
  const af = Number(fim.slice(0, 4));
  const mf = Number(fim.slice(5, 7));
  while ((a < af || (a === af && m <= mf)) && out.length < 600) {
    out.push(`${a}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return out;
}

/** Meses entre o primeiro e o último comparados com o PMO que não têm relatório coletado (a lacuna do eixo e o texto vêm daqui). */
export function mesesSemPmo(mlt: AguaMlt): string[] {
  const meses = Array.from(new Set(mlt.pmo.comparacao.map((c) => c.mes))).sort();
  if (meses.length < 2) return [];
  const com = new Set(meses);
  return mesesEntre(meses[0], meses[meses.length - 1]).filter((m) => !com.has(m));
}

export type PontoMltMensal = { m: string; pmo: number | null; inicio: number | null; fim: number | null };

/**
 * MLT mensal de um subsistema no PMO e no conjunto aberto (início e fim do mês), com todos os meses do período no eixo: o mês sem
 * relatório vira ausência (a linha se interrompe), e o eixo é de tempo real, não de categorias coladas.
 */
export function serieMltMensal(mlt: AguaMlt, sm: Submercado): PontoMltMensal[] {
  const meses = Array.from(new Set(mlt.pmo.comparacao.map((c) => c.mes))).sort();
  if (!meses.length) return [];
  const por = new Map(mlt.pmo.comparacao.filter((c) => c.sm === sm).map((c) => [c.mes, c]));
  return mesesEntre(meses[0], meses[meses.length - 1]).map((m) => {
    const c = por.get(m);
    return { m, pmo: c?.pmo_mwmed ?? null, inicio: c?.aberto_inicio_mwmed ?? null, fim: c?.aberto_fim_mwmed ?? null };
  });
}

export type PontoDiferencaMlt = { m: string; tol_inf: number | null; tol_sup: number | null } & Record<Submercado, number | null>;

/**
 * Diferença da MLT do conjunto aberto contra a do PMO, em %, no início de cada mês, por subsistema, com a tolerância publicada (o PMO
 * publica MWmed inteiros) como faixa em torno de zero. Os números são os `dif_inicio_pct` da gold; mês sem relatório é ausência.
 */
export function serieDiferencaMlt(mlt: AguaMlt): PontoDiferencaMlt[] {
  const meses = Array.from(new Set(mlt.pmo.comparacao.map((c) => c.mes))).sort();
  if (!meses.length) return [];
  const tol = mlt.pmo.tolerancia_pct;
  // a tolerância é referência, não dado: a faixa vale em todos os meses do eixo, inclusive nos sem relatório
  return mesesEntre(meses[0], meses[meses.length - 1]).map((m) => {
    const l = { m, SE: null, S: null, NE: null, N: null, tol_inf: -tol, tol_sup: tol } as PontoDiferencaMlt;
    for (const c of mlt.pmo.comparacao) if (c.mes === m) l[c.sm] = c.dif_inicio_pct;
    return l;
  });
}

/**
 * Meses em que a MLT do conjunto aberto mudou dentro do mês (a diferença no fim do mês não é a do início): a frase diz a diferença
 * do fim, que o gráfico do início do mês não mostra. Vazia quando nenhum mês mudou.
 */
export function textoMudancaMltNoMes(mlt: AguaMlt, idioma: Idioma = idiomaEnergia()): string {
  const meses = Array.from(new Set(mlt.pmo.comparacao.filter((c) => c.dif_inicio_pct !== c.dif_fim_pct).map((c) => c.mes))).sort();
  if (!meses.length) return "";
  const partes = meses.map((m) => {
    const dif = SUBSISTEMAS.map((sm) => mlt.pmo.comparacao.find((c) => c.mes === m && c.sm === sm))
      .filter((c): c is NonNullable<typeof c> => !!c && c.dif_fim_pct !== null)
      .map((c) => `${nomeRegiao(c.sm, idioma)} ${sinal(c.dif_fim_pct, 3, "", idioma)}%`);
    return tx(
      `em ${mesExtenso(m, "pt")} a MLT do conjunto aberto mudou durante o mês, e no fim dele a diferença com o PMO foi de ${listaTexto(dif, "pt")}`,
      `in ${mesExtenso(m, "en")} the open-dataset MLT changed during the month, and at its end the difference from the PMO was ${listaTexto(dif, "en")}`,
      idioma,
    );
  });
  return `${cap(partes.join("; "))}.`;
}

export type PontoMltJanJul = Record<string, string | number | null>;

/**
 * MLT implícita de cada subsistema no dia 15 de janeiro e no dia 15 de julho, uma coluna por subsistema e mês (`SE_1`, `SE_7`), uma
 * linha por ano: janeiro e julho viram duas linhas por subsistema, e a mudança de versão aparece como degrau em cada uma.
 */
export function serieMltJanJul(mlt: AguaMlt): PontoMltJanJul[] {
  const s = mlt.implicita_subsistemas;
  const anos = Array.from(new Set(s.ano)).sort((a, b) => a - b);
  return anos.map((ano) => {
    const l: PontoMltJanJul = { x: String(ano) };
    for (const sm of SUBSISTEMAS) for (const mes of [1, 7]) l[`${sm}_${mes}`] = null;
    s.ano.forEach((a, i) => {
      if (a !== ano) return;
      const mes = s.mes[i];
      for (const sm of SUBSISTEMAS) l[`${sm}_${mes}`] = s[sm][i] ?? null;
    });
    return l;
  });
}

export function colunasMltAnos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "mes", rotulo: tx("Mês", "Month", idioma), tipo: "texto", categorica: true },
    { id: "comparadas", rotulo: tx("Usinas comparadas", "Plants compared", idioma), tipo: "numero", casas: 0 },
    { id: "diferentes", rotulo: tx("Com MLT diferente do ano anterior", "With an MLT different from the previous year", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_MLT_ANOS: ColunaTabela[] = colunasMltAnos("pt");

export function linhasMltAnos(mlt: AguaMlt, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const a = mlt.anos;
  return a.ano.map((ano, i) => ({
    id: `${ano}-${a.mes[i]}`,
    ano,
    mes: a.mes[i] === 1 || a.mes[i] === 7 ? nomeMes(a.mes[i], idioma, true) : String(a.mes[i]),
    comparadas: a.usinas_comparadas[i],
    diferentes: a.usinas_com_mlt_diferente[i],
  }));
}

export function colunasUnidade(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "sm", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto" },
    { id: "dias", rotulo: tx("Dias comparados", "Days compared", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "dias_dentro", rotulo: tx("Dias dentro de 0,1%", "Days within 0.1%", idioma), tipo: "numero", casas: 0 },
    { id: "max_dif_rel_pct", rotulo: tx("Maior diferença", "Largest difference", idioma), tipo: "percentual", casas: 3 },
    { id: "dia", rotulo: tx("Dia de exemplo", "Example day", idioma), tipo: "data" }, // i18n: dado
    { id: "soma", rotulo: tx("Soma das usinas", "Sum of the plants", idioma), tipo: "numero", unidade: mw, casas: 3 },
    { id: "subsistema", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "numero", unidade: mw, casas: 3 },
  ];
}
export const COLUNAS_UNIDADE: ColunaTabela[] = colunasUnidade("pt");

export function linhasUnidade(mlt: AguaMlt, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return mlt.unidade.map((u) => ({
    id: u.sm,
    sm: nomeRegiao(u.sm, idioma),
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

/** Anomalia em %: "4,7% acima", "51,7% abaixo", "igual" (decidido no valor arredondado exibido). Em inglês, "4.7% above the". */
export function textoAnomaliaPct(a: number | null, casas = 1, idioma: Idioma = idiomaEnergia()): string | null {
  if (a === null) return null;
  const r = Number(a.toFixed(casas));
  if (r === 0) return tx("igual à", "equal to the", idioma);
  return tx(`${num(Math.abs(a), casas)}% ${r > 0 ? "acima" : "abaixo"} da`, `${num(Math.abs(a), casas, "en")}% ${r > 0 ? "above" : "below"} the`, idioma);
}

export function textoAnomaliaGraus(a: number | null, casas = 1, idioma: Idioma = idiomaEnergia()): string | null {
  if (a === null) return null;
  const r = Number(a.toFixed(casas));
  if (r === 0) return tx("igual à", "equal to the", idioma);
  return tx(`${num(Math.abs(a), casas)} °C ${r > 0 ? "acima" : "abaixo"} da`, `${num(Math.abs(a), casas, "en")} °C ${r > 0 ? "above" : "below"} the`, idioma);
}

export function respostaChuva(b: AguaPrecipitacaoBacia, base: string, idioma: Idioma = idiomaEnergia()): string {
  const onde = tx(`na bacia do ${nomeProprio(b.bacia, "pt")}`, `in the ${nomeProprio(b.bacia, "en")} basin`, idioma);
  const d = dataBR(b.dia, idioma);
  if (b.mm_30d === null)
    return tx(
      `Sem estimativa de chuva de 30 dias ${onde} até ${d}: algum dia da janela ficou abaixo de 80% de cobertura, e a soma nunca é feita com dia faltando.`,
      `No 30-day rainfall estimate ${onde} through ${d}: some day of the window fell below 80% coverage, and the sum is never made with a missing day.`,
      idioma,
    );
  const partes: string[] = [];
  const an = textoAnomaliaPct(b.anomalia_30d_pct, 1, idioma);
  const n1 = (v: number | null | undefined) => num(v, 1, idioma);
  const pb = periodoBase(base, idioma);
  partes.push(
    tx(
      `Nos 30 dias até ${d}, a estimativa por satélite é de ${n1(b.mm_30d)} mm de chuva ${onde}${an ? `, ${an} média dos mesmos dias em ${pb} (${n1(b.media_30d_base)} mm)` : ""}${
        b.p10_30d !== null && b.p90_30d !== null ? `; 10º a 90º percentil: ${n1(b.p10_30d)} a ${n1(b.p90_30d)} mm; percentil ${n1(b.percentil_30d)}` : ""
      }.`,
      `In the 30 days through ${d}, the satellite estimate is ${n1(b.mm_30d)} mm of rainfall ${onde}${an ? `, ${an} average of the same days in ${pb} (${n1(b.media_30d_base)} mm)` : ""}${
        b.p10_30d !== null && b.p90_30d !== null ? `; 10th to 90th percentile: ${n1(b.p10_30d)} to ${n1(b.p90_30d)} mm; percentile ${n1(b.percentil_30d)}` : ""
      }.`,
      idioma,
    ),
  );
  if (b.preliminar_30d) partes.push(tx("A janela tem dias do IMERG Late, ainda sem calibração por pluviômetros (preliminar).", "The window has IMERG Late days, not yet calibrated against rain gauges (preliminary).", idioma));
  return partes.join(" ");
}

export function respostaTemperatura(t: AguaTemperatura, base: string, idioma: Idioma = idiomaEnergia()): string {
  const de = doRegiao(t.recorte, idioma);
  const d = dataBR(t.dia, idioma);
  if (t.media_30d_c === null) return tx(`Sem temperatura de 30 dias ${de} até ${d}: falta dia com cobertura suficiente na janela.`, `No 30-day temperature ${de} through ${d}: the window lacks a day with sufficient coverage.`, idioma);
  const an = textoAnomaliaGraus(t.anomalia_30d_c, 1, idioma);
  const n2 = (v: number | null | undefined) => num(v, 2, idioma);
  const pb = periodoBase(base, idioma);
  const partes = [
    tx(
      `Nos 30 dias até ${d}, a temperatura média ${de} foi de ${n2(t.media_30d_c)} °C${an ? `, ${an} média dos mesmos dias em ${pb} (${n2(t.media_30d_base_c)} °C; percentil ${num(t.percentil_30d, 1)})` : ""}.`,
      `In the 30 days through ${d}, the average temperature ${de} was ${n2(t.media_30d_c)} °C${an ? `, ${an} average of the same days in ${pb} (${n2(t.media_30d_base_c)} °C; percentile ${num(t.percentil_30d, 1, "en")})` : ""}.`,
      idioma,
    ),
    tx(`É estimativa de reanálise, média das UF ponderada pela população.`, `It is a reanalysis estimate, a population-weighted average of the states.`, idioma),
  ];
  if (t.preliminar_30d) partes.push(tx("Os dias mais recentes vêm do GEOS-IT e ainda serão trocados pelo MERRA-2 (preliminar).", "The most recent days come from GEOS-IT and will still be replaced by MERRA-2 (preliminary).", idioma));
  return partes.join(" ");
}

/**
 * Veredito da chuva do P019 em palavras simples: os milímetros dos 30 dias e a posição entre os mesmos dias de anos anteriores (o
 * percentil), com a média ao lado. A anomalia em % sozinha engana quando a média é pequena (um período seco faz 70 mm virar +351%), por
 * isso ela fica na nota do destaque e em respostaChuva, junto da cautela.
 */
export function vereditoChuva(b: AguaPrecipitacaoBacia, idiomaOuIndice?: Idioma | number): string {
  const idioma = idiomaDe(idiomaOuIndice);
  const onde = tx(`a bacia do ${nomeProprio(b.bacia, "pt")}`, `the ${nomeProprio(b.bacia, "en")} basin`, idioma);
  const d = dataBR(b.dia, idioma);
  if (b.mm_30d === null)
    return tx(
      `Sem estimativa de chuva de 30 dias para ${onde} até ${d}: algum dia da janela ficou abaixo de 80% de cobertura, e a soma nunca é feita com dia faltando.`,
      `No 30-day rainfall estimate for ${onde} through ${d}: some day of the window fell below 80% coverage, and the sum is never made with a missing day.`,
      idioma,
    );
  const pos = b.percentil_30d !== null ? tx(`, no percentil ${num(b.percentil_30d, 0)} dos mesmos dias de anos anteriores`, `, at percentile ${num(b.percentil_30d, 0, "en")} of the same days in previous years`, idioma) : "";
  const media = b.media_30d_base !== null ? tx(` (média desses dias: ${num(b.media_30d_base, 1)} mm)`, ` (average of those days: ${num(b.media_30d_base, 1, "en")} mm)`, idioma) : "";
  const prelim = b.preliminar_30d ? tx(" A janela é preliminar.", " The window is preliminary.", idioma) : "";
  return tx(
    `Nos 30 dias até ${d}, ${onde} recebeu ${num(b.mm_30d, 1)} mm de chuva estimada por satélite${pos}${media}.${prelim}`,
    `In the 30 days through ${d}, ${onde} received ${num(b.mm_30d, 1, "en")} mm of satellite-estimated rainfall${pos}${media}.${prelim}`,
    idioma,
  );
}

/** Veredito da temperatura do P019: a média dos 30 dias ao lado da média dos mesmos dias. Percentil e produto da reanálise ficam em respostaTemperatura. */
export function vereditoTemperatura(t: AguaTemperatura, idioma: Idioma = idiomaEnergia()): string {
  const de = doRegiao(t.recorte, idioma);
  const d = dataBR(t.dia, idioma);
  if (t.media_30d_c === null) return tx(`Sem temperatura de 30 dias ${de} até ${d}: falta dia com cobertura suficiente na janela.`, `No 30-day temperature ${de} through ${d}: the window lacks a day with sufficient coverage.`, idioma);
  const an = textoAnomaliaGraus(t.anomalia_30d_c, 1, idioma);
  const comparacao = an ? tx(`, ${an} média dos mesmos dias (${num(t.media_30d_base_c, 2)} °C)`, `, ${an} average of the same days (${num(t.media_30d_base_c, 2, "en")} °C)`, idioma) : "";
  const prelim = t.preliminar_30d ? tx(" A janela é preliminar.", " The window is preliminary.", idioma) : "";
  return tx(
    `Nos 30 dias até ${d}, a temperatura média ${de} foi de ${num(t.media_30d_c, 2)} °C${comparacao}. É estimativa de reanálise, não medida de estação.${prelim}`,
    `In the 30 days through ${d}, the average temperature ${de} was ${num(t.media_30d_c, 2, "en")} °C${comparacao}. It is a reanalysis estimate, not a station measurement.${prelim}`,
    idioma,
  );
}

/**
 * Veredito da associação entre a chuva e a afluência da bacia: a correlação de Pearson do mesmo mês, com o método dito na frase
 * (anomalia percentual de chuva, sensível a meses secos) e como associação, nunca como causa.
 */
export function vereditoAssociacao(b: AguaPrecipitacaoBacia, idioma: Idioma = idiomaEnergia()): string | null {
  const a = b.associacao_ena;
  if (!a || a.r_mesmo_mes === null) return null;
  return tx(
    `Na bacia do ${nomeProprio(b.bacia, "pt")}, de ${periodoBase(a.periodo, "pt")}, a correlação de Pearson entre a anomalia percentual de chuva do mês e a ENA do mesmo mês é de ${num(a.r_mesmo_mes, 2)} (escala de −1 a 1), sensível a meses secos. É associação, não causa.`,
    `In the ${nomeProprio(b.bacia, "en")} basin, from ${periodoBase(a.periodo, "en")}, the Pearson correlation between the month's percentage rainfall anomaly and the ENA of the same month is ${num(a.r_mesmo_mes, 2, "en")} (scale from −1 to 1), sensitive to dry months. It is an association, not a cause.`,
    idioma,
  );
}

export function textoAssociacao(b: AguaPrecipitacaoBacia, idioma: Idioma = idiomaEnergia()): string | null {
  const a = b.associacao_ena;
  if (!a || (a.r_mesmo_mes === null && a.r_mes_seguinte === null)) return null;
  return tx(
    `Associação, não causa: de ${periodoBase(a.periodo, "pt")}, a correlação de Pearson entre a anomalia mensal percentual de chuva e a ENA em % da MLT da bacia foi de ${num(a.r_mesmo_mes, 2)} no mesmo mês (${plural(a.n_mesmo_mes, "mês", "meses")}) e de ${num(a.r_mes_seguinte, 2)} com a ENA do mês seguinte (${plural(a.n_mes_seguinte, "mês", "meses")}). A anomalia percentual é sensível a meses secos, em que a média é de poucos milímetros, e outros métodos de correlação podem dar outro valor.`,
    `Association, not cause: from ${periodoBase(a.periodo, "en")}, the Pearson correlation between the monthly percentage rainfall anomaly and the basin's ENA in % of MLT was ${num(a.r_mesmo_mes, 2, "en")} in the same month (${plural(a.n_mesmo_mes, "month", "months", "en")}) and ${num(a.r_mes_seguinte, 2, "en")} with the following month's ENA (${plural(a.n_mes_seguinte, "month", "months", "en")}). The percentage anomaly is sensitive to dry months, when the average is only a few millimeters, and other correlation methods may give a different value.`,
    idioma,
  );
}

/** Período do mapa: "30d" (janela até o último dia) ou um dos 12 meses completos publicados. */
export function periodosMapa(lista: readonly AguaPrecipitacaoBacia[]): string[] {
  const meses = lista.find((b) => b.mensal.m.length)?.mensal.m ?? [];
  return ["30d", ...[...meses].reverse()];
}

export function rotuloPeriodoMapa(per: string, dia: string | null, idioma: Idioma = idiomaEnergia()): string {
  return per === "30d" ? tx(`30 dias até ${dataBR(dia, "pt")}`, `30 days through ${dataBR(dia, "en")}`, idioma) : mesAno(per, idioma);
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

export function classificacaoChuva(valores: Record<string, number | null>, idioma: Idioma = idiomaEnergia()): Classificacao {
  return quebrasFixas(CORTES_ANOMALIA, Object.values(valores), { casas: 0, formatar: (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), 0, idioma)}%` });
}

/** Em Entender ficam a bacia, os milímetros e a anomalia (cabem em 360 px, com o número junto do nome); o resto vai para Analisar. O arquivo exportado leva todas. */
export function colunasChuva(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Bacia", "Basin", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "mm", rotulo: tx("Chuva", "Rainfall", idioma), tipo: "numero", unidade: "mm", casas: 1 }, // i18n: dado
    { id: "media", rotulo: tx("Média da base", "Baseline average", idioma), tipo: "numero", unidade: "mm", casas: 1, nivel: "analisar" }, // i18n: dado
    { id: "p10", rotulo: tx("10º percentil", "10th percentile", idioma), tipo: "numero", unidade: "mm", casas: 1, nivel: "analisar" }, // i18n: dado
    { id: "p90", rotulo: tx("90º percentil", "90th percentile", idioma), tipo: "numero", unidade: "mm", casas: 1, nivel: "analisar" }, // i18n: dado
    { id: "anomalia", rotulo: tx("Anomalia", "Anomaly", idioma), tipo: "percentual", casas: 1 },
    { id: "percentil", rotulo: tx("Percentil", "Percentile", idioma), tipo: "numero", casas: 1, nivel: "analisar" },
    { id: "preliminar", rotulo: tx("IMERG Late (preliminar)", "IMERG Late (preliminary)", idioma), tipo: "texto", categorica: true, nivel: "analisar" },
    { id: "cobertura", rotulo: tx("Cobertura média", "Average coverage", idioma), tipo: "percentual", casas: 1, nivel: "analisar" },
    { id: "r_mesmo_mes", rotulo: tx("Correlação com a ENA no mesmo mês", "Correlation with ENA in the same month", idioma), tipo: "numero", casas: 2, nivel: "analisar" },
    { id: "r_mes_seguinte", rotulo: tx("Correlação com a ENA do mês seguinte", "Correlation with the following month's ENA", idioma), tipo: "numero", casas: 2, nivel: "analisar" },
    { id: "bacia", rotulo: tx("Nome no ONS", "Name at ONS", idioma), tipo: "texto", nivel: "analisar", idiomaTexto: "nome" },
  ];
}
export const COLUNAS_CHUVA: ColunaTabela[] = colunasChuva("pt");

/** Linhas da tabela equivalente ao mapa (mesmo período, mesmos valores). */
export function linhasChuva(lista: readonly AguaPrecipitacaoBacia[], per: string, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return lista.map((b) => {
    const i = per === "30d" ? -1 : b.mensal.m.indexOf(per);
    const mensal = per !== "30d";
    const prelimMes = mensal && b.mensal.preliminar_desde !== null && per >= b.mensal.preliminar_desde;
    return {
      id: b.bacia,
      rotulo: rotuloRecorte("bacia", b.bacia, idioma),
      mm: mensal ? (i >= 0 ? (b.mensal.mm[i] ?? null) : null) : b.mm_30d,
      media: mensal ? (i >= 0 ? (b.mensal.media[i] ?? null) : null) : b.media_30d_base,
      p10: mensal ? (i >= 0 ? (b.mensal.p10[i] ?? null) : null) : b.p10_30d,
      p90: mensal ? (i >= 0 ? (b.mensal.p90[i] ?? null) : null) : b.p90_30d,
      anomalia: mensal ? (i >= 0 ? (b.mensal.anomalia_pct[i] ?? null) : null) : b.anomalia_30d_pct,
      percentil: mensal ? null : b.percentil_30d,
      preliminar: (mensal ? prelimMes : b.preliminar_30d) ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
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

export function colunasTemperatura(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Recorte", "Area", idioma), tipo: "texto" },
    { id: "dia", rotulo: tx("Último dia", "Last day", idioma), tipo: "data", nivel: "analisar" }, // i18n: dado
    { id: "media", rotulo: tx("Média de 30 dias", "30-day average", idioma), tipo: "numero", unidade: "°C", casas: 2 },
    { id: "base", rotulo: tx("Média da base", "Baseline average", idioma), tipo: "numero", unidade: "°C", casas: 2, nivel: "analisar" },
    { id: "anomalia", rotulo: tx("Anomalia", "Anomaly", idioma), tipo: "numero", unidade: "°C", casas: 1 },
    { id: "p10", rotulo: tx("10º percentil", "10th percentile", idioma), tipo: "numero", unidade: "°C", casas: 2, nivel: "analisar" },
    { id: "p90", rotulo: tx("90º percentil", "90th percentile", idioma), tipo: "numero", unidade: "°C", casas: 2, nivel: "analisar" },
    { id: "percentil", rotulo: tx("Percentil", "Percentile", idioma), tipo: "numero", casas: 1, nivel: "analisar" },
    { id: "anos_base", rotulo: tx("Anos na base", "Years in the baseline", idioma), tipo: "numero", casas: 0, nivel: "analisar" },
    { id: "preliminar", rotulo: tx("GEOS-IT (preliminar)", "GEOS-IT (preliminary)", idioma), tipo: "texto", categorica: true, nivel: "analisar" },
  ];
}
export const COLUNAS_TEMPERATURA: ColunaTabela[] = colunasTemperatura("pt");

export function linhasTemperatura(lista: readonly AguaTemperatura[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return [...lista]
    .sort((a, b) => REGIOES.indexOf(a.recorte) - REGIOES.indexOf(b.recorte))
    .map((t) => ({
      id: t.recorte,
      rotulo: nomeRegiao(t.recorte, idioma),
      dia: t.dia,
      media: t.media_30d_c,
      base: t.media_30d_base_c,
      anomalia: t.anomalia_30d_c,
      p10: t.p10_30d_c,
      p90: t.p90_30d_c,
      percentil: t.percentil_30d,
      anos_base: t.anos_base,
      preliminar: t.preliminar_30d ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
    }));
}

/* --- previsão --- */

/** "30/09/2026 00h UTC" a partir de "2026-09-30T00:00Z" ("Sep 30, 2026, 00:00 UTC" em inglês). */
export function rotuloRodada(emitidaEm: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") return `${dataBR(emitidaEm.slice(0, 10), "en")}, ${emitidaEm.slice(11, 13)}:00 UTC`;
  return `${dataBR(emitidaEm.slice(0, 10), "pt")} ${emitidaEm.slice(11, 13)}h UTC`;
}

/** Nome curto do modelo publicado na gold ("ECMWF IFS 0,25° (dados abertos ...), rodada ..." → "ECMWF IFS 0,25°"). Em inglês, "0.25°". */
export function modeloCurto(modelo: string, idioma: Idioma = idiomaEnergia()): string {
  const curto = modelo.split(/ \(|, /)[0].trim() || modelo;
  return idioma === "en" ? curto.replace(/(\d),(\d)/g, "$1.$2") : curto;
}

export function respostaPrevisao(pv: AguaPrevisao, bacia: string, idioma: Idioma = idiomaEnergia()): string {
  const b = pv.bacias.find((x) => x.bacia === bacia);
  const fim7 = somarDias(pv.d0, 6);
  const fimN = somarDias(pv.d0, pv.n_dias - 1);
  const d = (x: string | null) => dataBR(x, idioma);
  const n1 = (v: number | null | undefined) => num(v, 1, idioma);
  const cab = tx(`Previsão, não observação: rodada de ${rotuloRodada(pv.emitida_em, "pt")} do ${modeloCurto(pv.modelo, "pt")}`, `Forecast, not observation: ${modeloCurto(pv.modelo, "en")} run of ${rotuloRodada(pv.emitida_em, "en")}`, idioma);
  if (!b || b.mm_7d === null) return tx(`${cab}; sem previsão completa para a bacia do ${nomeProprio(bacia, "pt")}.`, `${cab}; no complete forecast for the ${nomeProprio(bacia, "en")} basin.`, idioma);
  return tx(
    `${cab}, ${n1(b.mm_7d)} mm de chuva na bacia do ${nomeProprio(bacia, "pt")} de ${d(pv.d0)} a ${d(fim7)} e ${n1(b.mm_total)} mm até ${d(fimN)}. A média IMERG dos mesmos dias em ${b.anos_climatologia} anos é de ${n1(b.imerg_media_7d_mm)} mm e ${n1(b.imerg_media_total_mm)} mm: outro produto, só ordem de grandeza.`,
    `${cab}: ${n1(b.mm_7d)} mm of rainfall in the ${nomeProprio(bacia, "en")} basin from ${d(pv.d0)} to ${d(fim7)} and ${n1(b.mm_total)} mm through ${d(fimN)}. The IMERG average for the same days over ${b.anos_climatologia} years is ${n1(b.imerg_media_7d_mm)} mm and ${n1(b.imerg_media_total_mm)} mm: a different product, order of magnitude only.`,
    idioma,
  );
}

export function colunasPrevisaoChuva(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Bacia", "Basin", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "mm_7d", rotulo: tx("Prevista, 7 dias", "Forecast, 7 days", idioma), tipo: "numero", unidade: "mm", casas: 1 }, // i18n: dado
    { id: "imerg_7d", rotulo: tx("Média IMERG, 7 dias", "IMERG average, 7 days", idioma), tipo: "numero", unidade: "mm", casas: 1 }, // i18n: dado
    { id: "mm_total", rotulo: tx("Prevista, todos os dias", "Forecast, all days", idioma), tipo: "numero", unidade: "mm", casas: 1, nivel: "analisar" }, // i18n: dado
    { id: "imerg_total", rotulo: tx("Média IMERG, todos os dias", "IMERG average, all days", idioma), tipo: "numero", unidade: "mm", casas: 1, nivel: "analisar" }, // i18n: dado
    { id: "bacia", rotulo: tx("Nome no ONS", "Name at ONS", idioma), tipo: "texto", nivel: "analisar", idiomaTexto: "nome" },
  ];
}
export const COLUNAS_PREVISAO_CHUVA: ColunaTabela[] = colunasPrevisaoChuva("pt");

export function linhasPrevisaoChuva(pv: AguaPrevisao, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return pv.bacias.map((b) => ({
    id: b.bacia,
    rotulo: rotuloRecorte("bacia", b.bacia, idioma),
    mm_7d: b.mm_7d,
    imerg_7d: b.imerg_media_7d_mm,
    mm_total: b.mm_total,
    imerg_total: b.imerg_media_total_mm,
    bacia: b.bacia,
  }));
}

export function colunasPrevisaoTemperatura(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Recorte", "Area", idioma), tipo: "texto" },
    { id: "t_7d", rotulo: tx("Prevista, 7 dias", "Forecast, 7 days", idioma), tipo: "numero", unidade: "°C", casas: 2 },
    { id: "merra2_7d", rotulo: tx("MERRA-2, mesmos dias", "MERRA-2, same days", idioma), tipo: "numero", unidade: "°C", casas: 2 },
  ];
}
export const COLUNAS_PREVISAO_TEMPERATURA: ColunaTabela[] = colunasPrevisaoTemperatura("pt");

export function linhasPrevisaoTemperatura(pv: AguaPrevisao, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return [...pv.temperatura]
    .sort((a, b) => REGIOES.indexOf(a.recorte) - REGIOES.indexOf(b.recorte))
    .map((t) => ({ id: t.recorte, rotulo: nomeRegiao(t.recorte, idioma), t_7d: t.t_media_7d_c, merra2_7d: t.merra2_media_7d_c }));
}

/**
 * A média do IMERG dos mesmos dias, por dia, para desenhar uma linha de referência no gráfico da chuva prevista por dia: o total da média
 * (publicado para todos os dias da previsão) dividido pelo número de dias dele. É outro produto (satélite, não modelo) e uma média plana
 * de dias diferentes, então o gráfico a rotula como ordem de grandeza. Null sem bacia, sem média ou sem dias.
 */
export function mediaDiariaImerg(pv: Pick<AguaPrevisao, "bacias" | "n_dias">, bacia: string): number | null {
  const b = pv.bacias.find((x) => x.bacia === bacia);
  if (!b || b.imerg_media_total_mm === null || !(pv.n_dias > 0)) return null;
  return b.imerg_media_total_mm / pv.n_dias;
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

export function colunasValidacao(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Bacia", "Basin", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "meses", rotulo: tx("Meses comparados", "Months compared", idioma), tipo: "numero", casas: 0 },
    { id: "estacoes_mediana", rotulo: tx("Estações por mês (mediana)", "Stations per month (median)", idioma), tipo: "numero", casas: 0 },
    { id: "imerg_mm", rotulo: "IMERG", tipo: "numero", unidade: "mm", casas: 1 }, // i18n: dado
    { id: "estacoes_mm", rotulo: tx("Estações", "Stations", idioma), tipo: "numero", unidade: "mm", casas: 1 }, // i18n: dado
    { id: "vies_pct", rotulo: tx("Viés do IMERG", "IMERG bias", idioma), tipo: "percentual", casas: 1 },
    { id: "correlacao", rotulo: tx("Correlação mensal", "Monthly correlation", idioma), tipo: "numero", casas: 2 },
  ];
}
export const COLUNAS_VALIDACAO: ColunaTabela[] = colunasValidacao("pt");

export function linhasValidacao(v: AguaClima["validacao_estacoes"], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return v.bacias.map((b) => ({ id: b.bacia, rotulo: rotuloRecorte("bacia", b.bacia, idioma), ...b }));
}

export function colunasCoberturaChuva(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Bacia", "Basin", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "pontos", rotulo: tx("Pontos de grade", "Grid points", idioma), tipo: "numero", casas: 0 },
    { id: "passos", rotulo: tx("Passo da grade", "Grid spacing", idioma), tipo: "texto" },
    { id: "poligonos", rotulo: tx("Polígonos do ONS", "ONS polygons", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_COBERTURA_CHUVA: ColunaTabela[] = colunasCoberturaChuva("pt");

export function linhasCoberturaChuva(c: AguaClima["cobertura_precipitacao"], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return c.map((x) => ({
    id: x.bacia,
    rotulo: rotuloRecorte("bacia", x.bacia, idioma),
    pontos: x.pontos,
    passos: x.passos_grau.map((p) => `${num(p, p < 0.25 ? 1 : 2, idioma)}°`).join(", "),
    poligonos: x.poligonos.map((p) => nomeProprio(p, idioma)).join(", "),
  }));
}

export function colunasCoberturaTemperatura(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "subsistema", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto", categorica: true },
    { id: "celulas", rotulo: tx("Células MERRA-2", "MERRA-2 cells", idioma), tipo: "numero", casas: 0 },
    { id: "populacao_uf", rotulo: tx("População da UF", "State population", idioma), tipo: "numero", casas: 0 },
    { id: "populacao_nas_celulas", rotulo: tx("População nas células", "Population in the cells", idioma), tipo: "numero", casas: 0 },
    { id: "cobertura_pct", rotulo: tx("Cobertura", "Coverage", idioma), tipo: "percentual", casas: 1 },
  ];
}
export const COLUNAS_COBERTURA_TEMPERATURA: ColunaTabela[] = colunasCoberturaTemperatura("pt");

export function linhasCoberturaTemperatura(c: AguaClima["cobertura_temperatura"], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return c.map((x) => ({ id: x.uf, ...x, subsistema: x.subsistema ? nomeRegiao(x.subsistema, idioma) : null }));
}

/* ======================================================================
 * P020 reservatórios e balanço
 * ==================================================================== */

export function rotuloConvencao(c: AguaConvencaoDefluencia, idioma: Idioma = idiomaEnergia()): string {
  return {
    inclui_outras: tx("defluência inclui as outras estruturas", "outflow includes the other structures", idioma),
    exclui_outras: tx("defluência não inclui as outras estruturas", "outflow does not include the other structures", idioma),
    sem_outras_estruturas: tx("sem outras estruturas", "no other structures", idioma),
    indeterminada: tx("convenção indeterminada", "convention undetermined", idioma),
  }[c];
}
export const ROTULO_CONVENCAO: Record<AguaConvencaoDefluencia, string> = {
  inclui_outras: rotuloConvencao("inclui_outras", "pt"),
  exclui_outras: rotuloConvencao("exclui_outras", "pt"),
  sem_outras_estruturas: rotuloConvencao("sem_outras_estruturas", "pt"),
  indeterminada: rotuloConvencao("indeterminada", "pt"),
};

/**
 * Nome da parcela de um reservatório na decomposição de um subsistema: a parte a jusante diz que é a parte do reservatório que gera noutro
 * subsistema. O mesmo reservatório aparece, por exemplo, na decomposição do Sudeste/Centro-Oeste pela parte própria e na do Norte pela parte
 * a jusante, e sem a palavra "jusante" a frase do Norte pareceria falar de um reservatório do Norte.
 */
export function nomeDaParcela(x: { nome: string | null; cod: string; parte: string }, idioma: Idioma = idiomaEnergia()): string {
  return `${nomeProprio(x.nome ?? x.cod, idioma)}${x.parte === "jusante" ? tx(", parte a jusante", ", downstream part", idioma) : ""}`;
}

/**
 * O que são a parte própria e a parte a jusante de um reservatório na EAR de um subsistema (dicionário do ONS e regra da gold: a EAR do
 * reservatório se divide entre o subsistema da usina e o subsistema a jusante). O exemplo vem da própria decomposição publicada: o primeiro
 * reservatório que aparece pela parte a jusante num subsistema que não é o dele. Sem exemplo, só a definição.
 */
export function textoPartesDaEar(ds: readonly AguaDecomposicaoEar[], lista: readonly Pick<AguaReservatorio, "cod" | "subsistema">[], idioma: Idioma = idiomaEnergia()): string {
  const base = tx(
    "Parte própria: a energia que a água do reservatório produz nas usinas do subsistema em que ele fica. Parte a jusante: a que a mesma água produz nas usinas de outro subsistema, rio abaixo.",
    "Own part: the energy that the reservoir's water produces in the plants of the subsystem where it sits. Downstream part: what the same water produces in the plants of another subsystem, further down the river.",
    idioma,
  );
  for (const d of ds) {
    const p = [...d.maiores_quedas, ...d.maiores_altas].find((x) => x.parte === "jusante");
    const r = p ? lista.find((x) => x.cod === p.cod) : undefined;
    const dele = r?.subsistema ? NOME_REGIAO[r.subsistema as Regiao] : undefined;
    if (p && r && dele && r.subsistema !== d.sm) {
      return tx(
        `${base} Exemplo: ${nomeProprio(p.nome ?? p.cod, "pt")}, do ${dele}, também entra na decomposição ${DO_REGIAO[d.sm]}, pela parte a jusante.`,
        `${base} Example: ${nomeProprio(p.nome ?? p.cod, "en")}, in the ${nomeRegiao(r.subsistema as Regiao, "en")}, also enters the breakdown ${doRegiao(d.sm, "en")}, through its downstream part.`,
        idioma,
      );
    }
  }
  return base;
}

export function respostaDecomposicao(d: AguaDecomposicaoEar, idiomaOuIndice?: Idioma | number): string {
  const idioma = idiomaDe(idiomaOuIndice);
  const de = doRegiao(d.sm, idioma);
  const s1 = (v: number | null | undefined) => sinal(v, 1, "", idioma);
  const fmt = (x: { nome: string | null; cod: string; parte: string; delta_mwmes: number | null }) => `${nomeDaParcela(x, idioma)} (${s1(x.delta_mwmes)})`;
  const ini = dataBR(d.inicio, idioma);
  const fim = dataBR(d.fim, idioma);
  const partes = [
    tx(
      `De ${ini} a ${fim}, a EAR ${de} variou ${s1(d.delta_ear_mwmes)} MWmês. A soma das variações dos ${d.n_reservatorios} reservatórios que contam no subsistema (a parte própria de cada um, nas usinas do subsistema dele, e a parte a jusante, nas usinas de outro subsistema, rio abaixo) dá ${s1(d.soma_reservatorios_mwmes)} MWmês, com resíduo de ${num(d.residuo_mwmes, 3)} MWmês.`,
      `From ${ini} to ${fim}, the EAR ${de} changed by ${s1(d.delta_ear_mwmes)} MWmonth. The sum of the changes of the ${d.n_reservatorios} reservoirs that count in the subsystem (each one's own part, in the plants of its own subsystem, and its downstream part, in the plants of another subsystem further down the river) gives ${s1(d.soma_reservatorios_mwmes)} MWmonth, with a residual of ${num(d.residuo_mwmes, 3, "en")} MWmonth.`,
      idioma,
    ),
  ];
  const quedas = d.maiores_quedas.filter((x) => (x.delta_mwmes ?? 0) < 0).slice(0, 3);
  const altas = d.maiores_altas.filter((x) => (x.delta_mwmes ?? 0) > 0).slice(0, 3);
  if (quedas.length || altas.length) {
    const q = quedas.length ? tx(`Maiores quedas, em MWmês: ${listaTexto(quedas.map(fmt), "pt")}`, `Largest falls, in MWmonth: ${listaTexto(quedas.map(fmt), "en")}`, idioma) : tx("Nenhuma queda", "No fall", idioma);
    const a = altas.length ? tx(`; maiores altas: ${listaTexto(altas.map(fmt), "pt")}`, `; largest rises: ${listaTexto(altas.map(fmt), "en")}`, idioma) : tx("; nenhuma alta", "; no rise", idioma);
    partes.push(`${q}${a}.`);
  }
  const c = d.contexto;
  partes.push(
    tx(
      `Contexto da mesma janela, que não fecha balanço com a variação da EAR: ENA bruta média de ${num(c.ena_bruta_media_mwmed, 0)} MWmed e geração hidráulica média de ${num(c.geracao_hidraulica_media_mwmed, 0)} MWmed.`,
      `Context for the same window, which does not balance against the change in EAR: average gross ENA of ${num(c.ena_bruta_media_mwmed, 0, "en")} MWavg and average hydro generation of ${num(c.geracao_hidraulica_media_mwmed, 0, "en")} MWavg.`,
      idioma,
    ),
  );
  return partes.join(" ");
}

/**
 * Veredito do P020, decomposição: quanto a energia armazenada do subsistema variou na janela de 30 dias e qual reservatório
 * pesou mais nessa variação. A soma dos reservatórios, o resíduo, os três maiores de cada sentido e o contexto (ENA e geração)
 * ficam em respostaDecomposicao.
 */
export function vereditoDecomposicao(d: AguaDecomposicaoEar, idiomaOuIndice?: Idioma | number): string {
  const idioma = idiomaDe(idiomaOuIndice);
  const de = doRegiao(d.sm, idioma);
  const ini = dataBR(d.inicio, idioma);
  const fim = dataBR(d.fim, idioma);
  if (d.delta_ear_mwmes === null) return tx(`Sem variação da energia armazenada ${de} de ${ini} a ${fim} nesta publicação: o valor fica ausente, nunca zero.`, `No change in stored energy ${de} from ${ini} to ${fim} in this release: the value is left absent, never zero.`, idioma);
  const queda = d.delta_ear_mwmes < 0;
  const lista = queda ? d.maiores_quedas : d.maiores_altas;
  const maior = lista.find((x) => (queda ? (x.delta_mwmes ?? 0) < 0 : (x.delta_mwmes ?? 0) > 0));
  const v = num(Math.abs(d.delta_ear_mwmes), 1, idioma);
  const mudou =
    d.delta_ear_mwmes === 0 ? tx("ficou igual", "was unchanged", idioma) : tx(`${queda ? "caiu" : "subiu"} ${v} MWmês`, `${queda ? "fell" : "rose"} by ${v} MWmonth`, idioma);
  const nome = maior ? nomeProprio(maior.nome ?? maior.cod, idioma) : "";
  // a parte a jusante é de um reservatório de outro subsistema: a frase diz que a água dele gera aqui, para não parecer um reservatório de cá
  const quem =
    maior?.parte === "jusante"
      ? tx(`a da parte a jusante de ${nome}, a água dele que gera neste subsistema`, `that of the downstream part of ${nome}, its water that generates in this subsystem`, idioma)
      : tx(`a de ${nome}`, `that of ${nome}`, idioma);
  const vm = maior ? num(Math.abs(maior.delta_mwmes ?? 0), 1, idioma) : "";
  const principal = maior ? tx(`; ${queda ? "a maior queda" : "a maior alta"} foi ${quem} (${vm} MWmês)`, `; ${queda ? "the largest fall" : "the largest rise"} was ${quem} (${vm} MWmonth)`, idioma) : "";
  return tx(`De ${ini} a ${fim}, a energia armazenada ${de} ${mudou}${principal}.`, `From ${ini} to ${fim}, stored energy ${de} ${mudou}${principal}.`, idioma);
}

export type BarraParcela = { id: string; rotulo: string; delta: number | null; cod: string; parte: string };

/** Barras da decomposição: as maiores quedas e altas publicadas, da maior queda à maior alta. */
export function barrasDecomposicao(d: AguaDecomposicaoEar, idioma: Idioma = idiomaEnergia()): BarraParcela[] {
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
      rotulo: `${nomeProprio(x.nome ?? x.cod, idioma)}${x.parte === "jusante" ? tx(" (a jusante)", " (downstream)", idioma) : ""}`,
      delta: x.delta_mwmes,
      cod: x.cod,
      parte: x.parte,
    }));
}

/**
 * O que a decomposição publica e o que fica de fora: as parcelas das maiores quedas e altas (as do gráfico) e a soma das demais, por
 * diferença entre a soma de todas as parcelas do subsistema (publicada) e a soma das listadas. A gold não traz as variações individuais
 * das demais, só a soma delas; sem a soma ou sem parcelas restantes, não há restante.
 */
export function restanteDecomposicao(d: AguaDecomposicaoEar): { nListadas: number; somaListadas: number; nRestantes: number; somaRestantes: number } | null {
  const listadas = barrasDecomposicao(d, "pt");
  const nRestantes = d.n_reservatorios - listadas.length;
  if (d.soma_reservatorios_mwmes === null || nRestantes <= 0) return null;
  const somaListadas = listadas.reduce((t, b) => t + (b.delta ?? 0), 0);
  return { nListadas: listadas.length, somaListadas, nRestantes, somaRestantes: d.soma_reservatorios_mwmes - somaListadas };
}

/** As barras do gráfico: as parcelas listadas e, depois delas, uma barra com a soma dos demais reservatórios (marcada como soma por diferença). */
export function barrasDecomposicaoComRestante(d: AguaDecomposicaoEar, idioma: Idioma = idiomaEnergia()): BarraParcela[] {
  const barras = barrasDecomposicao(d, idioma);
  const r = restanteDecomposicao(d);
  if (!r) return barras;
  const rotulo = tx(`Demais ${plural(r.nRestantes, "reservatório", "reservatórios", "pt")}, soma`, `Other ${plural(r.nRestantes, "reservoir", "reservoirs", "en")}, sum`, idioma);
  return [...barras, { id: "demais", rotulo, delta: r.somaRestantes, cod: "", parte: "restante" }];
}

/**
 * Frase do que o gráfico mostra e do que falta: a soma das parcelas listadas, a soma dos demais (por diferença) e a ressalva de que as
 * variações individuais dos demais não estão publicadas. Vazia quando todas as parcelas estão no gráfico.
 */
export function textoParcelasFaltantes(d: AguaDecomposicaoEar, idioma: Idioma = idiomaEnergia()): string {
  const r = restanteDecomposicao(d);
  if (!r) return "";
  return tx(
    `O gráfico mostra ${r.nListadas} das ${d.n_reservatorios} parcelas; a soma dos demais ${plural(r.nRestantes, "reservatório", "reservatórios")} sai por diferença entre a soma publicada e a das parcelas listadas, e a variação de cada um deles não está publicada.`,
    `The chart shows ${r.nListadas} of the ${d.n_reservatorios} parts; the sum of the other ${plural(r.nRestantes, "reservoir", "reservoirs", "en")} comes out as the difference between the published sum and that of the listed parts, and the change of each of them is not published.`,
    idioma,
  );
}

/** Em Entender: o reservatório, a variação da EAR (junto do nome) e a parte; o código da usina vai para Analisar. */
export function colunasDecomposicao(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Reservatório", "Reservoir", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "delta", rotulo: tx("Variação da EAR", "Change in EAR", idioma), tipo: "numero", unidade: uMwmes(idioma), casas: 1 },
    { id: "parte", rotulo: tx("Parte", "Part", idioma), tipo: "texto", categorica: true },
    { id: "cod", rotulo: tx("Código da usina", "Plant code", idioma), tipo: "texto", nivel: "analisar" },
  ];
}
export const COLUNAS_DECOMPOSICAO: ColunaTabela[] = colunasDecomposicao("pt");

export function linhasDecomposicao(d: AguaDecomposicaoEar, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return barrasDecomposicaoComRestante(d, idioma).map((b) => ({ id: b.id, rotulo: b.rotulo, parte: rotuloParte(b.parte, idioma), delta: b.delta, cod: b.cod }));
}

export function colunasDecomposicaoSubsistemas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const u = uMwmes(idioma);
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "sm", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto" },
    { id: "inicio", rotulo: tx("De", "From", idioma), tipo: "data" },
    { id: "fim", rotulo: tx("Até", "To", idioma), tipo: "data" },
    { id: "delta", rotulo: tx("Variação da EAR", "Change in EAR", idioma), tipo: "numero", unidade: u, casas: 1 },
    { id: "soma", rotulo: tx("Soma dos reservatórios", "Sum of the reservoirs", idioma), tipo: "numero", unidade: u, casas: 1 },
    { id: "residuo", rotulo: tx("Resíduo", "Residual", idioma), tipo: "numero", unidade: u, casas: 3 },
    { id: "n", rotulo: tx("Reservatórios", "Reservoirs", idioma), tipo: "numero", casas: 0 },
    { id: "ena", rotulo: tx("ENA bruta média (contexto)", "Average gross ENA (context)", idioma), tipo: "numero", unidade: mw, casas: 0 },
    { id: "ena_arm", rotulo: tx("ENA armazenável média (contexto)", "Average storable ENA (context)", idioma), tipo: "numero", unidade: mw, casas: 0 },
    { id: "geracao", rotulo: tx("Geração hidráulica média (contexto)", "Average hydro generation (context)", idioma), tipo: "numero", unidade: mw, casas: 0 },
  ];
}
export const COLUNAS_DECOMPOSICAO_SUBSISTEMAS: ColunaTabela[] = colunasDecomposicaoSubsistemas("pt");

export function linhasDecomposicaoSubsistemas(ds: readonly AguaDecomposicaoEar[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return ds.map((d) => ({
    id: d.sm,
    sm: nomeRegiao(d.sm, idioma),
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

/**
 * Reservatórios que abrem a comparação de volume: os quatro de maior volume útil com balanço calculado (o primeiro é o padrão da conta da
 * água). Sem eles a comparação abria vazia e pedia uma escolha antes de mostrar qualquer figura; o leitor remove ou troca à vontade.
 */
export function reservatoriosPadraoComparacao(lista: readonly AguaReservatorio[], n = 4): string[] {
  return [...lista]
    .filter((r) => r.balanco_calculado)
    .sort((a, b) => (b.vol_util_total_hm3 ?? -1) - (a.vol_util_total_hm3 ?? -1) || a.nome.localeCompare(b.nome))
    .slice(0, n)
    .map((r) => r.id);
}

/** O reservatório de uma parcela da decomposição, pelo código da usina (nunca pelo nome). */
export function reservatorioDaParcela(lista: readonly AguaReservatorio[], cod: string): AguaReservatorio | null {
  return lista.find((r) => r.cod === cod) ?? null;
}

/**
 * Por que um reservatório não tem balanço de 30 dias, dito pela causa exata: sem correspondência no cadastro do ONS (que traz o volume
 * útil), cadastro sem volume útil, ou falta de volume ou vazão na janela. `semCadastro` é a lista de identificadores que a gold publica.
 */
export function motivoSemBalanco(r: Pick<AguaReservatorio, "id" | "vol_util_total_hm3">, semCadastro?: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (semCadastro?.includes(r.id)) return tx("o reservatório não tem correspondência no cadastro do ONS, que traz o volume útil", "the reservoir has no match in the ONS register, which holds the useful volume", idioma);
  if (r.vol_util_total_hm3 === null) return tx("o cadastro do ONS não informa o volume útil", "the ONS register does not report the useful volume", idioma);
  return tx("falta volume ou vazão na janela", "volume or flow is missing in the window", idioma);
}

/** O volume no fim da janela fora de 0 a 100% do volume útil: é o valor da fonte (acima do volume máximo normal ou abaixo de zero), e a página o diz. */
export function volumeForaDaFaixa(pctFim: number | null | undefined): "acima" | "abaixo" | null {
  if (pctFim === null || pctFim === undefined || !Number.isFinite(pctFim)) return null;
  return pctFim > 100 ? "acima" : pctFim < 0 ? "abaixo" : null;
}

const avisoVolume = (k: "acima" | "abaixo", idioma: Idioma): string =>
  ({
    acima: tx("valor da fonte, acima do volume máximo normal do reservatório", "source value, above the reservoir's normal maximum volume", idioma),
    abaixo: tx("valor da fonte, abaixo de zero", "source value, below zero", idioma),
  })[k];

/** Frase da tabela e do veredito: quantos reservatórios terminam fora de 0 a 100% do volume útil, com os maiores. Vazia quando nenhum. */
export function textoVolumeForaDaFaixa(lista: readonly Pick<AguaReservatorio, "nome" | "vol_util_pct_fim">[], idioma: Idioma = idiomaEnergia()): string {
  const fora = lista.filter((r) => volumeForaDaFaixa(r.vol_util_pct_fim) !== null);
  if (!fora.length) return "";
  const desvio = (x: number | null) => (x === null ? 0 : x > 100 ? x - 100 : x < 0 ? -x : 0);
  const maiores = [...fora].sort((a, b) => desvio(b.vol_util_pct_fim) - desvio(a.vol_util_pct_fim)).slice(0, 3);
  const itens = listaTexto(maiores.map((r) => `${nomeProprio(r.nome, idioma)} ${pct(r.vol_util_pct_fim, 2, idioma)}`), idioma);
  return tx(
    `${plural(fora.length, "reservatório termina", "reservatórios terminam")} a janela fora de 0 a 100% do volume útil (${itens}${fora.length > maiores.length ? ", entre os maiores desvios" : ""}): é o valor da fonte, acima do volume máximo normal ou abaixo de zero, e a conta da água o usa como veio.`,
    `${plural(fora.length, "reservoir ends", "reservoirs end", "en")} the window outside 0 to 100% of useful volume (${itens}${fora.length > maiores.length ? ", among the largest deviations" : ""}): it is the source value, above the normal maximum volume or below zero, and the water balance uses it as received.`,
    idioma,
  );
}

export function respostaBalanco(r: AguaReservatorio, res: Pick<AguaReservatorios, "inicio" | "fim" | "periodo_fecham_por_construcao">, semCadastro?: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  const nome = nomeProprio(r.nome, idioma);
  const d = (x: string) => dataBR(x, idioma);
  const n1 = (v: number | null | undefined) => num(v, 1, idioma);
  if (!r.balanco_calculado || r.dv_obs_hm3 === null || r.residuo_hm3 === null) {
    return tx(
      `${nome}: sem balanço de 30 dias de ${d(res.inicio)} a ${d(res.fim)}, porque ${motivoSemBalanco(r, semCadastro, idioma)}. Nada é preenchido.`,
      `${nome}: no 30-day water balance from ${d(res.inicio)} to ${d(res.fim)}, because ${motivoSemBalanco(r, semCadastro, idioma)}. Nothing is filled in.`,
      idioma,
    );
  }
  const dv = r.dv_obs_hm3;
  const sentido =
    Number(dv.toFixed(1)) < 0 ? tx("caiu", "fell by", idioma) : Number(dv.toFixed(1)) > 0 ? tx("subiu", "rose by", idioma) : tx("ficou estável, com variação de", "remained stable, with a change of", idioma);
  // outras estruturas entram na lista da defluência só quando a convenção do reservatório as inclui
  const outras = r.outras_estruturas_hm3 !== null && r.outras_estruturas_hm3 !== 0 ? r.outras_estruturas_hm3 : null;
  const dentro = r.convencao_defluencia !== "exclui_outras";
  const saidas = [
    r.turbinado_hm3 !== null ? tx(`${n1(r.turbinado_hm3)} turbinados`, `${n1(r.turbinado_hm3)} turbined`, idioma) : null,
    r.vertido_hm3 !== null ? tx(`${n1(r.vertido_hm3)} vertidos`, `${n1(r.vertido_hm3)} spilled`, idioma) : null,
    outras !== null && dentro ? tx(`${n1(outras)} por outras estruturas`, `${n1(outras)} through other structures`, idioma) : null,
  ].filter((x): x is string => x !== null);
  const fora = volumeForaDaFaixa(r.vol_util_pct_fim);
  const lista = saidas.length ? `: ${listaTexto(saidas, idioma)}` : "";
  const aviso = fora ? ` (${avisoVolume(fora, idioma)})` : "";
  const partes = [
    tx(
      `De ${d(res.inicio)} a ${d(res.fim)}, o volume de ${nome} ${sentido} ${n1(Math.abs(dv))} hm³ e terminou em ${pct(r.vol_util_pct_fim, 2, idioma)} do volume útil${aviso}. Entraram ${n1(r.afluencia_hm3)} hm³ (afluência) e saíram ${n1(r.defluencia_hm3)} hm³ (defluência${lista})${
        outras !== null && !dentro ? `; as outras estruturas, que o ONS publica à parte e fora da defluência deste reservatório, somaram ${n1(outras)} hm³` : ""
      }. O resíduo do balanço, variação observada menos afluência mais defluência, é de ${sinal(r.residuo_hm3, 2, "", idioma)} hm³.`,
      `From ${d(res.inicio)} to ${d(res.fim)}, the volume of ${nome} ${sentido} ${n1(Math.abs(dv))} hm³ and ended at ${pct(r.vol_util_pct_fim, 2, idioma)} of useful volume${aviso}. ${n1(r.afluencia_hm3)} hm³ came in (inflow) and ${n1(r.defluencia_hm3)} hm³ went out (outflow${lista})${
        outras !== null && !dentro ? `; the other structures, which ONS publishes separately and outside this reservoir's outflow, added up to ${n1(outras)} hm³` : ""
      }. The balance residual, observed change minus inflow plus outflow, is ${sinal(r.residuo_hm3, 2, "", idioma)} hm³.`,
      idioma,
    ),
  ];
  if (r.transferido_hm3 !== null && r.transferido_hm3 !== 0) {
    partes.push(
      tx(
        `Houve transferência de ${sinal(r.transferido_hm3, 1)} hm³; somada ao resíduo, ${sinal(r.residuo_com_transferencia_hm3, 2)} hm³ (a convenção de sinal da transferência não é documentada pelo ONS).`,
        `There was a transfer of ${sinal(r.transferido_hm3, 1, "", "en")} hm³; added to the residual, ${sinal(r.residuo_com_transferencia_hm3, 2, "", "en")} hm³ (the sign convention of the transfer is not documented by ONS).`,
        idioma,
      ),
    );
  }
  const s = r.serie_dias_residuo_dentro_tolerancia_pct;
  const per = res.periodo_fecham_por_construcao
    ? tx(`de ${d(res.periodo_fecham_por_construcao.inicio)} a ${d(res.periodo_fecham_por_construcao.fim)}`, `from ${d(res.periodo_fecham_por_construcao.inicio)} to ${d(res.periodo_fecham_por_construcao.fim)}`, idioma)
    : tx("da série", "of the series", idioma);
  if (s !== null) {
    partes.push(
      s >= 95
        ? tx(
            `Em ${pct(s, 1)} dos dias ${per} o resíduo diário fica dentro do arredondamento: a afluência publicada é calculada pelo próprio balanço, e o fechamento não é prova independente.`,
            `On ${pct(s, 1, "en")} of the days ${per} the daily residual stays within rounding: the published inflow is calculated from the balance itself, and the closure is not independent proof.`,
            idioma,
          )
        : tx(
            `Só ${pct(s, 1)} dos dias ${per} fecham dentro do arredondamento: nos demais, o balanço com os dados publicados não fecha, e o resíduo é informação, não ajuste.`,
            `Only ${pct(s, 1, "en")} of the days ${per} close within rounding: on the others, the balance with the published data does not close, and the residual is information, not an adjustment.`,
            idioma,
          ),
    );
  }
  return partes.join(" ");
}

/**
 * A variação de 30 dias do mesmo subsistema na página de armazenamento (janela que termina no último dia da EAR do subsistema)
 * ao lado da decomposição por reservatório (janela que termina no último dia da EAR por reservatório): janelas diferentes, não
 * divergência. Vazia quando as duas terminam no mesmo dia ou quando falta a variação de 30 dias do subsistema.
 */
export function textoOutraJanelaDaEar(d: AguaDecomposicaoEar | null, lista: readonly Pick<EntidadeEar, "id" | "tipo" | "dia" | "variacao_30d_mwmes">[], idioma: Idioma = idiomaEnergia()): string {
  if (!d || d.delta_ear_mwmes === null) return "";
  const e = lista.find((x) => x.tipo === "subsistema" && x.id === d.sm);
  if (!e || e.variacao_30d_mwmes === null || !e.dia || e.dia === d.fim) return "";
  return tx(
    `A página de armazenamento mostra ${sinal(e.variacao_30d_mwmes, 1)} MWmês ${DO_REGIAO[d.sm]} em 30 dias até ${dataBR(e.dia)}. Aqui a janela vai de ${dataBR(d.inicio)} a ${dataBR(d.fim)}, o último dia com EAR por reservatório, e a variação é ${sinal(d.delta_ear_mwmes, 1)} MWmês.`,
    `The storage page shows ${sinal(e.variacao_30d_mwmes, 1, "", "en")} MWmonth ${doRegiao(d.sm, "en")} over the 30 days through ${dataBR(e.dia, "en")}. Here the window runs from ${dataBR(d.inicio, "en")} to ${dataBR(d.fim, "en")}, the last day with EAR by reservoir, and the change is ${sinal(d.delta_ear_mwmes, 1, "", "en")} MWmonth.`,
    idioma,
  );
}

/**
 * Veredito do P020, balanço do reservatório: se saiu mais água do que entrou no reservatório escolhido nos 30 dias, quanto o
 * volume variou e o resíduo da conta. As saídas por estrutura, a transferência e a série de dias ficam em respostaBalanco.
 */
export function vereditoBalancoReservatorio(r: AguaReservatorio, res: Pick<AguaReservatorios, "inicio" | "fim">, semCadastro?: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  const nome = nomeProprio(r.nome, idioma);
  const d = (x: string) => dataBR(x, idioma);
  if (!r.balanco_calculado || r.dv_obs_hm3 === null || r.residuo_hm3 === null) {
    return tx(
      `${nome}: sem balanço de 30 dias de ${d(res.inicio)} a ${d(res.fim)}, porque ${motivoSemBalanco(r, semCadastro, idioma)}. Nada é preenchido.`,
      `${nome}: no 30-day water balance from ${d(res.inicio)} to ${d(res.fim)}, because ${motivoSemBalanco(r, semCadastro, idioma)}. Nothing is filled in.`,
      idioma,
    );
  }
  const dv = Number(r.dv_obs_hm3.toFixed(1));
  const v = num(Math.abs(r.dv_obs_hm3), 1, idioma);
  const quanto =
    dv === 0
      ? tx("o volume ficou estável", "the volume remained stable", idioma)
      : tx(
          `${dv < 0 ? "saiu mais água do que entrou" : "entrou mais água do que saiu"} e o volume ${dv < 0 ? "caiu" : "subiu"} ${v} hm³`,
          `${dv < 0 ? "more water went out than came in" : "more water came in than went out"} and the volume ${dv < 0 ? "fell" : "rose"} by ${v} hm³`,
          idioma,
        );
  return tx(
    `Em ${nome}, nos 30 dias até ${d(res.fim)}, ${quanto}. O resíduo da conta da água, a diferença que sobra quando ela não fecha, é de ${sinal(r.residuo_hm3, 2, "", idioma)} hm³.`,
    `At ${nome}, in the 30 days through ${d(res.fim)}, ${quanto}. The residual of the water balance, the difference left over when it does not close, is ${sinal(r.residuo_hm3, 2, "", idioma)} hm³.`,
    idioma,
  );
}

export type BarraBalanco = { id: string; rotulo: string; v: number | null };

/**
 * Componentes do balanço de 30 dias em hm³ em três grupos, cada um na sua régua: o que entrou, saiu e variou (totais da identidade, mais a
 * vazão natural como contexto fora do balanço), as partes da defluência e o resíduo com a transferência (pequenos, que na régua dos totais
 * sumiriam). Um componente sem dado fica como ausência na barra, nunca como zero.
 */
export function barrasBalanco(r: AguaReservatorio, idioma: Idioma = idiomaEnergia()): BarraBalanco[] {
  return [...barrasBalancoTotais(r, idioma), ...barrasBalancoDefluencia(r, idioma), ...barrasBalancoResiduo(r, idioma)];
}

export function barrasBalancoTotais(r: AguaReservatorio, idioma: Idioma = idiomaEnergia()): BarraBalanco[] {
  return [
    { id: "afl", rotulo: tx("Afluência", "Inflow", idioma), v: r.afluencia_hm3 },
    { id: "defl", rotulo: tx("Defluência", "Outflow", idioma), v: r.defluencia_hm3 },
    { id: "dv", rotulo: tx("Variação observada do volume", "Observed change in volume", idioma), v: r.dv_obs_hm3 },
    { id: "nat", rotulo: tx("Vazão natural (fora do balanço)", "Natural flow (outside the balance)", idioma), v: r.natural_hm3 },
  ];
}

export function barrasBalancoDefluencia(r: AguaReservatorio, idioma: Idioma = idiomaEnergia()): BarraBalanco[] {
  return [
    { id: "turb", rotulo: tx("Turbinado", "Turbined", idioma), v: r.turbinado_hm3 },
    { id: "vert", rotulo: tx("Vertido", "Spilled", idioma), v: r.vertido_hm3 },
    { id: "outras", rotulo: tx("Outras estruturas", "Other structures", idioma), v: r.outras_estruturas_hm3 },
    { id: "nd", rotulo: tx("Defluência não discriminada", "Unspecified outflow", idioma), v: r.defluencia_nao_discriminada_hm3 },
  ];
}

export function barrasBalancoResiduo(r: AguaReservatorio, idioma: Idioma = idiomaEnergia()): BarraBalanco[] {
  return [
    { id: "res", rotulo: tx("Resíduo do balanço", "Balance residual", idioma), v: r.residuo_hm3 },
    { id: "transf", rotulo: tx("Transferência", "Transfer", idioma), v: r.transferido_hm3 },
  ];
}

/**
 * Nota do gráfico das vazões diárias: a defluente (o que sai) e a turbinada (o que passa pelas turbinas) coincidem quando nada é
 * vertido, e a linha de uma cobre a da outra. Vazia quando as duas linhas se distinguem.
 */
export function notaVazoesCoincidem(serie: readonly Pick<PontoReservatorio, "defl" | "turb" | "vert">[], idioma: Idioma = idiomaEnergia()): string {
  const pares = serie.filter((p) => p.defl !== null && p.turb !== null);
  if (pares.length < 2) return "";
  const coincide = pares.every((p) => Math.abs((p.defl as number) - (p.turb as number)) < 0.5);
  if (!coincide) return "";
  const semVertido = serie.every((p) => p.vert === null || p.vert === 0);
  return tx(
    `A linha da vazão defluente cobre a da turbinada: nos dias mostrados, a defluência é igual à vazão que passa pelas turbinas${semVertido ? ", porque nada foi vertido" : ""}.`,
    `The outflow line covers the turbined flow line: on the days shown, the outflow equals the flow passing through the turbines${semVertido ? ", because nothing was spilled" : ""}.`,
    idioma,
  );
}

/**
 * Em Entender ficam o reservatório, a variação observada do volume e o resíduo (cabem em 360 px, com o número junto do nome); as demais
 * colunas, inclusive o volume no fim e o motivo da ausência de balanço, vão para Analisar. O arquivo exportado leva todas.
 */
export function colunasReservatorios(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Reservatório", "Reservoir", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "dv_obs_hm3", rotulo: tx("Variação observada", "Observed change", idioma), tipo: "numero", unidade: "hm³", casas: 2 },
    { id: "residuo_hm3", rotulo: tx("Resíduo", "Residual", idioma), tipo: "numero", unidade: "hm³", casas: 2 },
    { id: "subsistema", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto", categorica: true, nivel: "analisar" },
    { id: "bacia", rotulo: tx("Bacia", "Basin", idioma), tipo: "texto", categorica: true, nivel: "analisar", idiomaTexto: "nome" },
    { id: "ear_max_mwmes", rotulo: tx("EAR máxima", "Maximum EAR", idioma), tipo: "numero", unidade: uMwmes(idioma), casas: 1, nivel: "analisar" },
    { id: "vol_util_total_hm3", rotulo: tx("Volume útil", "Useful volume", idioma), tipo: "numero", unidade: "hm³", casas: 1, nivel: "analisar" },
    { id: "vol_util_pct_fim", rotulo: tx("Volume no fim", "Volume at the end", idioma), tipo: "percentual", casas: 2, nivel: "analisar" },
    { id: "afluencia_hm3", rotulo: tx("Afluência", "Inflow", idioma), tipo: "numero", unidade: "hm³", casas: 2, nivel: "analisar" },
    { id: "defluencia_hm3", rotulo: tx("Defluência", "Outflow", idioma), tipo: "numero", unidade: "hm³", casas: 2, nivel: "analisar" },
    { id: "turbinado_hm3", rotulo: tx("Turbinado", "Turbined", idioma), tipo: "numero", unidade: "hm³", casas: 2, nivel: "analisar" },
    { id: "vertido_hm3", rotulo: tx("Vertido", "Spilled", idioma), tipo: "numero", unidade: "hm³", casas: 2, nivel: "analisar" },
    { id: "outras_estruturas_hm3", rotulo: tx("Outras estruturas", "Other structures", idioma), tipo: "numero", unidade: "hm³", casas: 2, nivel: "analisar" },
    { id: "defluencia_nao_discriminada_hm3", rotulo: tx("Não discriminada", "Unspecified", idioma), tipo: "numero", unidade: "hm³", casas: 2, nivel: "analisar" },
    { id: "transferido_hm3", rotulo: tx("Transferência", "Transfer", idioma), tipo: "numero", unidade: "hm³", casas: 2, nivel: "analisar" },
    { id: "residuo_com_transferencia_hm3", rotulo: tx("Resíduo com transferência", "Residual with transfer", idioma), tipo: "numero", unidade: "hm³", casas: 2, nivel: "analisar" },
    { id: "natural_hm3", rotulo: tx("Vazão natural (contexto)", "Natural flow (context)", idioma), tipo: "numero", unidade: "hm³", casas: 2, nivel: "analisar" },
    { id: "janela_pct", rotulo: tx("Dias dentro do arredondamento, janela", "Days within rounding, window", idioma), tipo: "percentual", casas: 1, nivel: "analisar" },
    { id: "serie_pct", rotulo: tx("Dias dentro do arredondamento, série", "Days within rounding, series", idioma), tipo: "percentual", casas: 1, nivel: "analisar" },
    { id: "convencao", rotulo: tx("Convenção da defluência", "Outflow convention", idioma), tipo: "texto", categorica: true, nivel: "analisar" },
    { id: "balanco", rotulo: tx("Balanço calculado", "Balance calculated", idioma), tipo: "texto", categorica: true, nivel: "analisar" },
    { id: "motivo", rotulo: tx("Observação", "Note", idioma), tipo: "texto", nivel: "analisar" },
    { id: "id", rotulo: tx("Identificador no ONS", "ONS identifier", idioma), tipo: "texto", nivel: "analisar" },
  ];
}
export const COLUNAS_RESERVATORIOS: ColunaTabela[] = colunasReservatorios("pt");

/**
 * Linhas da tabela do balanço. O nome leva o aviso quando o volume no fim está fora de 0 a 100% do volume útil, e a coluna Observação diz
 * o aviso por extenso e, nos reservatórios sem balanço, o motivo exato (`semCadastro` é a lista de identificadores da gold).
 */
export function linhasReservatorios(lista: readonly AguaReservatorio[], semCadastro?: readonly string[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return lista.map((r) => {
    const fora = volumeForaDaFaixa(r.vol_util_pct_fim);
    const sem = !r.balanco_calculado;
    const obs = [
      fora ? `${cap(avisoVolume(fora, idioma))}` : null,
      sem ? tx(`Sem balanço: ${motivoSemBalanco(r, semCadastro, "pt")}`, `No balance: ${motivoSemBalanco(r, semCadastro, "en")}`, idioma) : null,
    ].filter((x): x is string => x !== null);
    const aviso = fora ? tx(` (volume ${fora === "acima" ? "acima de 100%" : "abaixo de 0%"})`, ` (volume ${fora === "acima" ? "above 100%" : "below 0%"})`, idioma) : "";
    return {
      id: r.id,
      rotulo: `${nomeProprio(r.nome, idioma)}${aviso}`,
      subsistema: r.subsistema && ehRegiao(r.subsistema) ? nomeRegiao(r.subsistema, idioma) : r.subsistema,
      bacia: r.bacia ? nomeProprio(r.bacia, idioma) : null,
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
      convencao: r.convencao_defluencia in ROTULO_CONVENCAO ? rotuloConvencao(r.convencao_defluencia, idioma) : r.convencao_defluencia,
      balanco: r.balanco_calculado ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
      motivo: obs.length ? obs.join("; ") : null,
    };
  });
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

export function textoFechamento(
  r: Pick<AguaReservatorios, "n_reservatorios" | "n_com_balanco" | "n_fecham_por_construcao" | "n_fecham_na_janela" | "criterio_fecham_por_construcao" | "periodo_fecham_por_construcao" | "sem_balanco_por_motivo" | "convencao_defluencia">,
  idioma: Idioma = idiomaEnergia(),
): string {
  const motivos = Object.entries(r.sem_balanco_por_motivo).map(([m, n]) => `${n} ${rotuloDaGold(MOTIVO_SEM_BALANCO_EN, m, idioma)}`);
  const conv = r.convencao_defluencia;
  const criterio = rotuloDaGold(CRITERIO_FECHAMENTO_EN, r.criterio_fecham_por_construcao, idioma);
  const per = r.periodo_fecham_por_construcao;
  const lm = motivos.length ? listaTexto(motivos, idioma) : "";
  return tx(
    [
    `${plural(r.n_com_balanco, "reservatório tem", "reservatórios têm", "pt")} balanço de 30 dias, de ${r.n_reservatorios} nos dados hidráulicos do ONS${motivos.length ? `; sem balanço: ${lm}` : ""}.`,
    `${plural(r.n_fecham_por_construcao, "reservatório fecha", "reservatórios fecham", "pt")} por construção (${criterio}${per ? `, de ${dataBR(per.inicio, "pt")} a ${dataBR(per.fim, "pt")}` : ""}); na janela de 30 dias, ${r.n_fecham_na_janela}.`,
    `Convenção da defluência detectada nos dados: ${conv.inclui_outras ?? 0} incluem as outras estruturas, ${conv.exclui_outras ?? 0} não incluem, ${conv.sem_outras_estruturas ?? 0} não têm outras estruturas e ${conv.indeterminada ?? 0} ${conv.indeterminada === 1 ? "fica indeterminado" : "ficam indeterminados"}.`,
  ].join(" "),
    [
      `${plural(r.n_com_balanco, "reservoir has", "reservoirs have", "en")} a 30-day water balance, out of ${r.n_reservatorios} in the ONS hydraulic data${motivos.length ? `; without a balance: ${lm}` : ""}.`,
      `${plural(r.n_fecham_por_construcao, "reservoir closes", "reservoirs close", "en")} by construction (${criterio}${per ? `, from ${dataBR(per.inicio, "en")} to ${dataBR(per.fim, "en")}` : ""}); in the 30-day window, ${r.n_fecham_na_janela}.`,
      `Outflow convention detected in the data: ${conv.inclui_outras ?? 0} include the other structures, ${conv.exclui_outras ?? 0} do not include them, ${conv.sem_outras_estruturas ?? 0} have no other structures and ${conv.indeterminada ?? 0} ${conv.indeterminada === 1 ? "is undetermined" : "are undetermined"}.`,
    ].join(" "),
    idioma,
  );
}

/* ---------- textos gerais ---------- */

/** Nenhum texto gerado usa travessão nem hífen solto como pontuação (regra de estilo testada). */
export const PONTUACAO_PROIBIDA = /\s[\u2013\u2014-]\s|\u2014/;

/* ---------- conferência com o resumo de operação (hidrologia.json) ---------- */

type ResumoHidrologia = {
  gerado_em: string;
  dia_referencia_ear: string;
  dia_referencia_ena: string;
  subsistemas: { sm: Regiao; ear: { valor: number | null; dia: string }; ena: { dia: string; pct_mlt_30d: number | null } }[];
  proveniencia?: { padrao?: { periodo_referencia?: { inicio: string; fim: string } | null } };
};

export function colunasResumo(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const pm = tx("% da MLT", "% of MLT", idioma);
  return [
    { id: "regiao", rotulo: tx("Região", "Region", idioma), tipo: "texto" },
    { id: "dia_resumo", rotulo: tx("Dia da EAR no resumo", "EAR day in the summary", idioma), tipo: "data" },
    { id: "ear_resumo", rotulo: tx("EAR no resumo", "EAR in the summary", idioma), tipo: "percentual", casas: 1 },
    { id: "dia_agua", rotulo: tx("Dia da EAR nesta página", "EAR day on this page", idioma), tipo: "data" },
    { id: "ear_agua", rotulo: tx("EAR nesta página", "EAR on this page", idioma), tipo: "percentual", casas: 2 },
    { id: "dia_ena_resumo", rotulo: tx("Fim da janela da ENA no resumo", "End of the ENA window in the summary", idioma), tipo: "data" },
    { id: "ena_resumo", rotulo: tx("ENA de 30 dias no resumo", "30-day ENA in the summary", idioma), tipo: "numero", unidade: pm, casas: 1 },
    { id: "dia_ena_agua", rotulo: tx("Fim da janela nesta página", "End of the window on this page", idioma), tipo: "data" },
    { id: "ena_agua", rotulo: tx("ENA de 30 dias nesta página", "30-day ENA on this page", idioma), tipo: "numero", unidade: pm, casas: 1 },
  ];
}
export const COLUNAS_RESUMO: ColunaTabela[] = colunasResumo("pt");

/** Os dois números lado a lado, cada um com o seu dia (nenhuma diferença é calculada aqui). */
export function linhasResumo(h: ResumoHidrologia | null, a: AguaArmazenamento, f: AguaAfluencia, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return REGIOES.map((sm) => {
    const hs = h?.subsistemas.find((x) => x.sm === sm);
    const ea = a.subsistemas.find((x) => x.sm === sm);
    const en = f.subsistemas.find((x) => x.sm === sm);
    return {
      id: sm,
      regiao: nomeRegiao(sm, idioma),
      dia_resumo: hs?.ear.dia ?? null,
      ear_resumo: hs?.ear.valor ?? null,
      dia_agua: ea?.dia ?? null,
      ear_agua: ea?.ear_pct ?? null,
      dia_ena_resumo: hs?.ena.dia ?? null,
      ena_resumo: hs?.ena.pct_mlt_30d ?? null,
      dia_ena_agua: en?.dia ?? null,
      ena_agua: en?.pct_mlt_30d ?? null,
    };
  });
}

const ate = (ear: string, ena: string, idioma: Idioma) =>
  ear === ena ? dataBR(ear, idioma) : tx(`${dataBR(ear, "pt")} na EAR e ${dataBR(ena, "pt")} na ENA`, `${dataBR(ear, "en")} for EAR and ${dataBR(ena, "en")} for ENA`, idioma);

export function textoResumo(h: ResumoHidrologia | null, diaEar: string, diaEna: string, baseAgua: string | null = null, idioma: Idioma = idiomaEnergia()): string {
  if (!h)
    return tx(
      "O resumo de operação (hidrologia.json), usado pela Visão geral e pelo PLD, não está disponível nesta publicação; os números desta página não dependem dele.",
      "The operation summary (hidrologia.json), used by the Overview and PLD pages, is not available in this release; the figures on this page do not depend on it.",
      idioma,
    );
  const mesmo = h.dia_referencia_ear === diaEar && h.dia_referencia_ena === diaEna;
  // base da faixa de cada publicação, lida de cada uma (o resumo publica o período de referência da faixa)
  const pr = h.proveniencia?.padrao?.periodo_referencia;
  const baseResumo = pr ? periodoBase(`${pr.inicio.slice(0, 4)}-${pr.fim.slice(0, 4)}`, idioma) : null;
  const baseAqui = baseAgua ? periodoBase(baseAgua, idioma) : null;
  const regra =
    baseResumo && baseAqui
      ? baseResumo === baseAqui
        ? tx(`As duas publicações usam a mesma regra: SIN como razão de somas e faixa do mesmo dia do calendário em ${baseAqui}.`, `Both releases use the same rule: SIN as a ratio of sums and the range of the same calendar day in ${baseAqui}.`, idioma)
        : tx(
            `As duas publicações calculam o SIN como razão de somas, mas a faixa do mesmo dia do calendário usa bases diferentes: ${baseResumo} no resumo e ${baseAqui} nesta página.`,
            `Both releases calculate the SIN as a ratio of sums, but the range of the same calendar day uses different baselines: ${baseResumo} in the summary and ${baseAqui} on this page.`,
            idioma,
          )
      : tx(
          "As duas publicações calculam o SIN como razão de somas; a base da faixa de uma delas não está publicada, e as faixas não são comparadas aqui.",
          "Both releases calculate the SIN as a ratio of sums; the range baseline of one of them is not published, and the ranges are not compared here.",
          idioma,
        );
  return [
    tx(
      `O resumo de operação usado pela Visão geral e pelo PLD (hidrologia.json, processado em ${dataBR(diaBrasilia(h.gerado_em), "pt")}) lê só a captura do silver principal e vai até ${ate(h.dia_referencia_ear, h.dia_referencia_ena, "pt")}; esta página usa, em cada ano, a captura mais recente do arquivo do ONS e vai até ${ate(diaEar, diaEna, "pt")}.`,
      `The operation summary used by the Overview and PLD pages (hidrologia.json, processed on ${dataBR(diaBrasilia(h.gerado_em), "en")}) reads only the main silver capture and runs through ${ate(h.dia_referencia_ear, h.dia_referencia_ena, "en")}; this page uses, for each year, the most recent capture of the ONS file and runs through ${ate(diaEar, diaEna, "en")}.`,
      idioma,
    ),
    mesmo
      ? tx(
          "Os dias coincidem: diferença no mesmo dia vem de revisão do ONS entre as capturas, publicada na tabela de revisões.",
          "The days match: a difference on the same day comes from an ONS revision between the captures, published in the revisions table.",
          idioma,
        )
      : tx(
          "Os números diferem porque os dias diferem; no mesmo dia, diferença vem de revisão do ONS entre as capturas, publicada na tabela de revisões.",
          "The figures differ because the days differ; on the same day, a difference comes from an ONS revision between the captures, published in the revisions table.",
          idioma,
        ),
    regra,
  ].join(" ");
}

/** "Em 30 dias: SIN −7.888 MWmês (−2,7 p.p.); ..." com os subsistemas e o SIN da gold. */
export function textoMudancaArmazenamento(lista: readonly EntidadeEar[], idioma: Idioma = idiomaEnergia()): string {
  const subs = lista.filter((e) => e.tipo === "subsistema");
  const sin = subs.find((e) => e.id === "SIN");
  const u = uMwmes(idioma);
  const partes = subs
    .filter((e) => e.variacao_30d_mwmes !== null)
    .map((e) => `${e.rotulo} ${sinal(e.variacao_30d_mwmes, 0, "", idioma)} ${u}${e.variacao_30d_pp !== null ? ` (${sinal(e.variacao_30d_pp, 1, "", idioma)} ${tx("p.p.", "pp", idioma)})` : ""}`);
  const t = partes.length ? tx(`Em 30 dias: ${partes.join("; ")}.`, `Over 30 days: ${partes.join("; ")}.`, idioma) : tx("Sem variação de 30 dias publicada.", "No 30-day change published.", idioma);
  return sin?.variacao_12m_mwmes !== null && sin?.variacao_12m_mwmes !== undefined
    ? tx(`${t} Em 12 meses, o SIN variou ${sinal(sin.variacao_12m_mwmes, 0)} MWmês.`, `${t} Over 12 months, the SIN changed by ${sinal(sin.variacao_12m_mwmes, 0, "", "en")} MWmonth.`, idioma)
    : t;
}

/** "ENA de 30 dias do SIN: 172,3% da MLT; Sudeste/Centro-Oeste 155,8%; ..." a partir das entidades da gold. */
export function textoMudancaAfluencia(lista: readonly EntidadeEna[], idioma: Idioma = idiomaEnergia()): string {
  const sin = lista.find((e) => e.id === "SIN");
  if (!sin || sin.pct_mlt_30d === null) return tx("Sem ENA de 30 dias do SIN nesta publicação.", "No 30-day ENA for the SIN in this release.", idioma);
  const subs = SUBSISTEMAS.map((sm) => lista.find((e) => e.id === sm))
    .filter((e): e is EntidadeEna => !!e)
    .map((e) => `${e.rotulo} ${pct(e.pct_mlt_30d, 1, idioma)}${e.faixa_30d && e.faixa_30d !== "dentro" ? ` (${rotuloFaixa(e.faixa_30d, idioma)})` : ""}`);
  const fx = sin.faixa_30d ? ` (${rotuloFaixa(sin.faixa_30d, idioma)})` : "";
  return tx(
    `ENA de 30 dias até ${dataBR(sin.dia)}: SIN ${pct(sin.pct_mlt_30d, 1)} da MLT${fx}; ${subs.join("; ")}.`,
    `30-day ENA through ${dataBR(sin.dia, "en")}: SIN ${pct(sin.pct_mlt_30d, 1, "en")} of MLT${fx}; ${subs.join("; ")}.`,
    idioma,
  );
}

export function textoConferenciaBacias(c: AguaAfluencia["conferencia_bacias_sin"], idioma: Idioma = idiomaEnergia()): string | null {
  if (!c) return null;
  return tx(
    `Soma da ENA bruta das bacias contra a do SIN em ${dataBR(c.dia)}: ${num(c.soma_bacias_mwmed, 3)} e ${num(c.sin_mwmed, 3)} MWmed (diferença de ${sinal(c.diferenca_mwmed, 3)} MWmed; SIN da ${c.captura_sin ?? "captura sem registro"}).`,
    `Sum of the basins' gross ENA against the SIN's on ${dataBR(c.dia, "en")}: ${num(c.soma_bacias_mwmed, 3, "en")} and ${num(c.sin_mwmed, 3, "en")} MWavg (difference of ${sinal(c.diferenca_mwmed, 3, "", "en")} MWavg; SIN from the ${c.captura_sin ? rotuloDaGold(FONTE_CAPTURA_EN, c.captura_sin, "en") : "unrecorded capture"}).`,
    idioma,
  );
}

/** Bacia padrão do painel de clima: a de maior EAR máxima entre as que têm chuva estimada (a mesma da ficha de prova). */
export function baciaPadraoChuva(baciasEar: readonly { nome: string; ear_max_mwmes: number | null }[], chuva: readonly AguaPrecipitacaoBacia[]): string {
  const com = new Set(chuva.map((b) => b.bacia));
  const x = [...baciasEar].filter((b) => com.has(b.nome)).sort((a, b) => (b.ear_max_mwmes ?? -1) - (a.ear_max_mwmes ?? -1) || a.nome.localeCompare(b.nome))[0];
  return x?.nome ?? chuva[0]?.bacia ?? "";
}

/** Nota do número de destaque da temperatura: o sentido da anomalia por extenso e o percentil entre os mesmos dias de anos anteriores. */
export function notaAnomaliaTemperatura(t: AguaTemperatura, base: string, idioma: Idioma = idiomaEnergia()): string {
  const an = textoAnomaliaGraus(t.anomalia_30d_c, 1, idioma);
  if (!an || t.media_30d_c === null) return tx("Sem anomalia de 30 dias nesta publicação.", "No 30-day anomaly in this release.", idioma);
  const pos = t.percentil_30d !== null ? tx(`; percentil ${num(t.percentil_30d, 0)}`, `; percentile ${num(t.percentil_30d, 0, "en")}`, idioma) : "";
  return tx(
    `${cap(an)} média dos mesmos dias em ${periodoBase(base)}: ${num(t.media_30d_c, 2)} °C contra ${num(t.media_30d_base_c, 2)} °C${pos}.`,
    `${cap(an)} average of the same days in ${periodoBase(base, "en")}: ${num(t.media_30d_c, 2, "en")} °C against ${num(t.media_30d_base_c, 2, "en")} °C${pos}.`,
    idioma,
  );
}

/**
 * Nota do número de destaque da chuva: a posição entre os mesmos dias de anos anteriores (o percentil) vem antes da anomalia em %, e a
 * cautela fica junto, porque um período seco, de média pequena, faz a anomalia em % crescer muito.
 */
export function notaChuvaBacia(b: AguaPrecipitacaoBacia, base: string, idioma: Idioma = idiomaEnergia()): string {
  const an = textoAnomaliaPct(b.anomalia_30d_pct, 1, idioma);
  if (!an || b.mm_30d === null) return tx("Sem anomalia de 30 dias nesta publicação.", "No 30-day anomaly in this release.", idioma);
  const pos = b.percentil_30d !== null ? tx(`Percentil ${num(b.percentil_30d, 0)} entre os mesmos dias de anos anteriores. `, `Percentile ${num(b.percentil_30d, 0, "en")} among the same days in previous years. `, idioma) : "";
  return tx(
    `${pos}${cap(an)} média dos mesmos dias em ${periodoBase(base)} (${num(b.media_30d_base, 1)} mm). Com média de poucos milímetros, o percentual cresce muito: leia os milímetros e o percentil.`,
    `${pos}${cap(an)} average of the same days in ${periodoBase(base, "en")} (${num(b.media_30d_base, 1, "en")} mm). With an average of only a few millimeters, the percentage grows a lot: read the millimeters and the percentile.`,
    idioma,
  );
}

/** O mês escolhido no mapa: milímetros, média e faixa do mês (10º a 90º percentil), lidos de `mensal` (o percentil do mês não é publicado). */
export function dadosChuvaMes(b: AguaPrecipitacaoBacia, per: string): { mm: number | null; media: number | null; p10: number | null; p90: number | null; anomalia: number | null; preliminar: boolean } | null {
  const i = b.mensal.m.indexOf(per);
  if (i < 0) return null;
  return {
    mm: b.mensal.mm[i] ?? null,
    media: b.mensal.media[i] ?? null,
    p10: b.mensal.p10[i] ?? null,
    p90: b.mensal.p90[i] ?? null,
    anomalia: b.mensal.anomalia_pct[i] ?? null,
    preliminar: b.mensal.preliminar_desde !== null && per >= b.mensal.preliminar_desde,
  };
}

/** Veredito da chuva de um mês completo: os milímetros do mês e a faixa do mês (10º a 90º percentil), com a média ao lado. */
export function vereditoChuvaMes(b: AguaPrecipitacaoBacia, per: string, idioma: Idioma = idiomaEnergia()): string {
  const onde = tx(`a bacia do ${nomeProprio(b.bacia, "pt")}`, `the ${nomeProprio(b.bacia, "en")} basin`, idioma);
  const d = dadosChuvaMes(b, per);
  const mes = mesExtenso(per, idioma);
  if (!d || d.mm === null)
    return tx(
      `Sem estimativa de chuva de ${mes} para ${onde}: o mês só vale com todos os dias, e a soma nunca é feita com dia faltando.`,
      `No rainfall estimate for ${mes} for ${onde}: the month only counts with all its days, and the sum is never made with a missing day.`,
      idioma,
    );
  const n1 = (v: number | null | undefined) => num(v, 1, idioma);
  const faixa = d.p10 !== null && d.p90 !== null ? tx(`; a faixa do mês, do 10º ao 90º percentil, vai de ${n1(d.p10)} a ${n1(d.p90)} mm`, `; the month's range, from the 10th to the 90th percentile, runs from ${n1(d.p10)} to ${n1(d.p90)} mm`, idioma) : "";
  const media = d.media !== null ? tx(` (média do mês: ${n1(d.media)} mm)`, ` (month average: ${n1(d.media)} mm)`, idioma) : "";
  return tx(
    `Em ${mes}, ${onde} recebeu ${n1(d.mm)} mm de chuva estimada por satélite${media}${faixa}.${d.preliminar ? " O mês tem dias preliminares." : ""}`,
    `In ${mes}, ${onde} received ${n1(d.mm)} mm of satellite-estimated rainfall${media}${faixa}.${d.preliminar ? " The month has preliminary days." : ""}`,
    idioma,
  );
}

/** Nota do destaque da chuva de um mês: a anomalia em % da média do mês, com a mesma cautela do período de 30 dias. */
export function notaChuvaMes(b: AguaPrecipitacaoBacia, per: string, base: string, idioma: Idioma = idiomaEnergia()): string {
  const d = dadosChuvaMes(b, per);
  const an = d ? textoAnomaliaPct(d.anomalia, 1, idioma) : null;
  if (!d || !an || d.mm === null) return tx("Sem anomalia deste mês nesta publicação.", "No anomaly for this month in this release.", idioma);
  return tx(
    `${cap(an)} média do mês em ${periodoBase(base)} (${num(d.media, 1)} mm). Com média de poucos milímetros, o percentual cresce muito: leia os milímetros e a faixa do mês.`,
    `${cap(an)} month average in ${periodoBase(base, "en")} (${num(d.media, 1, "en")} mm). With an average of only a few millimeters, the percentage grows a lot: read the millimeters and the month's range.`,
    idioma,
  );
}

/**
 * Resposta completa da chuva de um mês completo (Analisar): milímetros, média e faixa do mês, a anomalia em % e o aviso de que o
 * percentil do mês não é publicado (só o dos 30 dias mais recentes).
 */
export function respostaChuvaMes(b: AguaPrecipitacaoBacia, per: string, base: string, idioma: Idioma = idiomaEnergia()): string {
  const onde = tx(`na bacia do ${nomeProprio(b.bacia, "pt")}`, `in the ${nomeProprio(b.bacia, "en")} basin`, idioma);
  const d = dadosChuvaMes(b, per);
  const mes = mesExtenso(per, idioma);
  if (!d || d.mm === null)
    return tx(
      `Sem estimativa de chuva de ${mes} ${onde}: o mês só vale com todos os dias, e a soma nunca é feita com dia faltando.`,
      `No rainfall estimate for ${mes} ${onde}: the month only counts with all its days, and the sum is never made with a missing day.`,
      idioma,
    );
  const an = textoAnomaliaPct(d.anomalia, 1, idioma);
  const n1 = (v: number | null | undefined) => num(v, 1, idioma);
  const pb = periodoBase(base, idioma);
  const partes = [
    tx(
      `Em ${mes}, a estimativa por satélite é de ${n1(d.mm)} mm de chuva ${onde}${an ? `, ${an} média do mesmo mês em ${pb} (${n1(d.media)} mm)` : ""}${
        d.p10 !== null && d.p90 !== null ? `; 10º a 90º percentil do mês: ${n1(d.p10)} a ${n1(d.p90)} mm` : ""
      }. O percentil do mês não é publicado: só o dos 30 dias mais recentes.`,
      `In ${mes}, the satellite estimate is ${n1(d.mm)} mm of rainfall ${onde}${an ? `, ${an} average of the same month in ${pb} (${n1(d.media)} mm)` : ""}${
        d.p10 !== null && d.p90 !== null ? `; 10th to 90th percentile for the month: ${n1(d.p10)} to ${n1(d.p90)} mm` : ""
      }. The month's percentile is not published: only that of the most recent 30 days.`,
      idioma,
    ),
  ];
  if (d.preliminar) partes.push(tx("O mês tem dias do IMERG Late, ainda sem calibração por pluviômetros (preliminar).", "The month has IMERG Late days, not yet calibrated against rain gauges (preliminary).", idioma));
  return partes.join(" ");
}

/* --- janelas preliminares: o que é estimativa em tempo quase real contra a base de produto final --- */

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Quantos dos dias da janela que termina em `dia` vêm depois do último dia do produto final (`corte`), e se são todos. */
export function diasPreliminares(dia: string | null | undefined, corte: string | null | undefined, janela = 30): { n: number; todos: boolean } {
  if (!dia || !corte) return { n: 0, todos: false };
  const n = Math.max(0, Math.min(janela, diasEntre(corte, dia)));
  return { n, todos: n >= janela };
}

/** Último dia ("AAAA-MM-DD") de um mês "AAAA-MM". */
export function ultimoDiaDoMes(m: string): string {
  const [a, mm] = m.split("-").map(Number);
  return `${m}-${String(new Date(Date.UTC(a, mm, 0)).getUTCDate()).padStart(2, "0")}`;
}

/** Mês com ao menos um dia depois do último dia do produto final: a barra ou o ponto desse mês é parcialmente preliminar. */
export function mesPreliminar(m: string, corte: string | null | undefined): boolean {
  return !!corte && ultimoDiaDoMes(m) > corte;
}

/** Uma frase: quantos dias da janela de chuva são do IMERG Late (preliminar). Vazia quando a janela é toda de produto final. */
export function resumoPreliminarChuva(dia: string | null | undefined, corteFinal: string | null | undefined, janela = 30, idioma: Idioma = idiomaEnergia()): string {
  const { n, todos } = diasPreliminares(dia, corteFinal, janela);
  if (!n) return "";
  const o = tx(
    "vêm do IMERG Late, a versão rápida do produto de chuva por satélite, ainda sem calibração por pluviômetros",
    "they come from IMERG Late, the fast version of the satellite rainfall product, not yet calibrated against rain gauges",
    idioma,
  );
  return todos
    ? tx(`Os ${janela} dias da janela são todos preliminares: ${o}.`, `All ${janela} days of the window are preliminary: ${o}.`, idioma)
    : tx(`${n} dos ${janela} dias da janela são preliminares: ${o}.`, `${n} of the ${janela} days of the window are preliminary: ${o}.`, idioma);
}

/** Uma frase: quantos dias da janela de temperatura são do GEOS-IT (preliminar). Vazia quando nenhum dia é preliminar. */
export function resumoPreliminarTemperatura(dia: string | null | undefined, corteMerra2: string | null | undefined, janela = 30, idioma: Idioma = idiomaEnergia()): string {
  const { n, todos } = diasPreliminares(dia, corteMerra2, janela);
  if (!n) return "";
  const o = tx("do GEOS-IT, a versão preliminar da reanálise, que o MERRA-2 troca quando chega", "from GEOS-IT, the preliminary version of the reanalysis, which MERRA-2 replaces when it arrives", idioma);
  return todos ? tx(`Os ${janela} dias da janela são todos ${o}.`, `All ${janela} days of the window are ${o}.`, idioma) : tx(`${n} dos ${janela} dias da janela são ${o}.`, `${n} of the ${janela} days of the window are ${o}.`, idioma);
}

/**
 * Chuva dos 30 dias: quantos dias são do IMERG Late (sem calibração por pluviômetros) contra a média do IMERG Final, e o que a fonte
 * recomenda para tendência de clima. Vazio quando a janela é toda de produto final.
 */
export function textoPreliminarChuva(dia: string | null | undefined, corteFinal: string | null | undefined, janela = 30, idioma: Idioma = idiomaEnergia()): string {
  const { n, todos } = diasPreliminares(dia, corteFinal, janela);
  if (!n || !corteFinal) return "";
  const quanto = todos
    ? tx(`Todos os ${janela} dias da janela são preliminares`, `All ${janela} days of the window are preliminary`, idioma)
    : tx(`${n} dos ${janela} dias da janela são preliminares`, `${n} of the ${janela} days of the window are preliminary`, idioma);
  return tx(
    `${quanto}: vêm do IMERG Late, sem calibração por pluviômetros, e a média usada para comparar é do IMERG Final, já calibrado, que vai até ${dataBR(corteFinal)}. Para análise de tendência de clima, a documentação do NASA POWER recomenda terminar a série cerca de 3,5 meses antes do tempo quase real. Esta publicação não estima o viés entre o Late e o Final.`,
    `${quanto}: they come from IMERG Late, not calibrated against rain gauges, and the average used for comparison is from IMERG Final, already calibrated, which runs through ${dataBR(corteFinal, "en")}. For climate trend analysis, the NASA POWER documentation recommends ending the series about 3.5 months before near real time. This release does not estimate the bias between Late and Final.`,
    idioma,
  );
}

/** Temperatura dos 30 dias: quantos dias são do GEOS-IT (ainda não trocados pelo MERRA-2) contra a média do MERRA-2. Vazio quando não há dia preliminar. */
export function textoPreliminarTemperatura(dia: string | null | undefined, corteMerra2: string | null | undefined, janela = 30, idioma: Idioma = idiomaEnergia()): string {
  const { n, todos } = diasPreliminares(dia, corteMerra2, janela);
  if (!n || !corteMerra2) return "";
  const quanto = todos ? tx(`Todos os ${janela} dias da janela`, `All ${janela} days of the window`, idioma) : tx(`${n} dos ${janela} dias da janela`, `${n} of the ${janela} days of the window`, idioma);
  return tx(
    `${quanto} vêm do GEOS-IT, ainda preliminar, e a média usada para comparar é do MERRA-2, que vai até ${dataBR(corteMerra2)}. Para análise de tendência de clima, a documentação do NASA POWER recomenda terminar a série cerca de 2 meses antes do tempo quase real. Esta publicação não estima o viés entre o GEOS-IT e o MERRA-2.`,
    `${quanto} come from GEOS-IT, still preliminary, and the average used for comparison is from MERRA-2, which runs through ${dataBR(corteMerra2, "en")}. For climate trend analysis, the NASA POWER documentation recommends ending the series about 2 months before near real time. This release does not estimate the bias between GEOS-IT and MERRA-2.`,
    idioma,
  );
}

/**
 * O último mês completo só com produto final (nenhum dia IMERG Late): os milímetros e a anomalia dele, para ver a anomalia de um período sem
 * dia preliminar ao lado da janela dos 30 dias, que é toda preliminar. Vazio sem mês assim.
 */
export function textoUltimoMesFinalChuva(b: AguaPrecipitacaoBacia, base: string, idioma: Idioma = idiomaEnergia()): string {
  const desde = b.mensal.preliminar_desde;
  const i = b.mensal.m.reduce((u, m, k) => (desde === null || m < desde ? k : u), -1);
  if (i < 0 || b.mensal.mm[i] === null || b.mensal.mm[i] === undefined) return "";
  const an = textoAnomaliaPct(b.mensal.anomalia_pct[i] ?? null, 1, idioma);
  const mes = mesExtenso(b.mensal.m[i], idioma);
  const n1 = (v: number | null | undefined) => num(v, 1, idioma);
  return tx(
    `O último mês completo só com produto final é ${mes}: ${n1(b.mensal.mm[i])} mm${an ? `, ${an} média do mês em ${periodoBase(base)} (${n1(b.mensal.media[i])} mm)` : ""}.`,
    `The last complete month with final product only is ${mes}: ${n1(b.mensal.mm[i])} mm${an ? `, ${an} month average in ${periodoBase(base, "en")} (${n1(b.mensal.media[i])} mm)` : ""}.`,
    idioma,
  );
}

/** O último mês completo só com MERRA-2 (nenhum dia GEOS-IT): a anomalia dele, para ver uma temperatura sem dia preliminar. Vazio sem mês assim. */
export function textoUltimoMesFinalTemperatura(t: AguaTemperatura, corteMerra2: string | null | undefined, base: string, idioma: Idioma = idiomaEnergia()): string {
  const i = t.mensal.m.reduce((u, m, k) => (!mesPreliminar(m, corteMerra2) ? k : u), -1);
  if (i < 0 || t.mensal.t[i] === null || t.mensal.t[i] === undefined) return "";
  const an = textoAnomaliaGraus(t.mensal.anomalia_c[i] ?? null, 1, idioma);
  const mes = mesExtenso(t.mensal.m[i], idioma);
  const n2 = (v: number | null | undefined) => num(v, 2, idioma);
  return tx(
    `O último mês completo só com MERRA-2 é ${mes}: ${n2(t.mensal.t[i])} °C${an ? `, ${an} média do mês em ${periodoBase(base)} (${n2(t.mensal.media[i])} °C)` : ""}.`,
    `The last complete month with MERRA-2 only is ${mes}: ${n2(t.mensal.t[i])} °C${an ? `, ${an} month average in ${periodoBase(base, "en")} (${n2(t.mensal.media[i])} °C)` : ""}.`,
    idioma,
  );
}

/**
 * Marcas dos dias preliminares no eixo de uma série diária: o primeiro dia depois do corte, quando cai dentro da série (a linha mostra
 * onde o produto muda), ou a nota de que a série inteira é preliminar, quando começa depois do corte. Vazios quando não há dia preliminar.
 */
export function marcaPreliminarSerie(dias: readonly string[], corte: string | null | undefined, rotulo: string): { marcos: { x: string; rotulo: string }[]; todaPreliminar: boolean } {
  if (!corte || !dias.length) return { marcos: [], todaPreliminar: false };
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];
  if (ultimo <= corte) return { marcos: [], todaPreliminar: false };
  if (primeiro > corte) return { marcos: [], todaPreliminar: true };
  const depois = somarDias(corte, 1);
  return { marcos: depois && dias.includes(depois) ? [{ x: depois, rotulo }] : [], todaPreliminar: false };
}

/**
 * Linha "Revisões" da ficha da chuva (ou da temperatura): a troca do produto preliminar pelo final é uma revisão certa do dado, e a ficha
 * da gold, que só compara capturas já integradas, diz "nenhuma revisão detectada". Os dois dizem o que é exato: o que já foi comparado e o
 * que ainda vai mudar. Sem dia preliminar na janela, só a primeira parte.
 */
export function textoRevisoesFichaClima(
  dia: string | null | undefined,
  corte: string | null | undefined,
  produtos: { preliminar: string; final: string },
  janela = 30,
  idioma: Idioma = idiomaEnergia(),
): string {
  const { n } = diasPreliminares(dia, corte, janela);
  const comparado = tx("Entre as capturas já integradas, nenhuma revisão foi detectada.", "Among the captures already integrated, no revision was detected.", idioma);
  if (!n) return tx(`${comparado} A janela é toda de produto final.`, `${comparado} The whole window is final product.`, idioma);
  return tx(
    `${n} dos ${janela} dias da janela são do ${produtos.preliminar} e serão trocados pelo ${produtos.final} quando ele chegar: a troca é uma revisão certa do número. ${comparado}`,
    `${n} of the ${janela} days of the window are from ${produtos.preliminar} and will be replaced by ${produtos.final} when it arrives: the replacement is a certain revision of the figure. ${comparado}`,
    idioma,
  );
}

type FichaComFormula = { formula: string };

/**
 * A mesma ficha da anomalia de temperatura com as duas médias da conta escritas na fórmula (a média dos 30 dias e a da mesma janela na
 * base, lidas da gold). A ficha da gold traz só a regra e o valor da diferença, já arredondado; com as duas médias, o leitor refaz a
 * subtração (22,87 − 22,78 = 0,09, que a gold publica como 0,1 °C).
 */
export function evidenciaTemperaturaComMedias<E extends FichaComFormula>(ev: E, t: Pick<AguaTemperatura, "media_30d_c" | "media_30d_base_c">, base: string, idioma: Idioma = idiomaEnergia()): E {
  if (t.media_30d_c === null || t.media_30d_base_c === null) return ev;
  return {
    ...ev,
    formula: tx(
      `média dos 30 dias (${num(t.media_30d_c, 2)} °C) − média da mesma janela em ${periodoBase(base)} (${num(t.media_30d_base_c, 2)} °C); a diferença é publicada já arredondada em 0,1 °C`,
      `30-day average (${num(t.media_30d_c, 2, "en")} °C) − average of the same window in ${periodoBase(base, "en")} (${num(t.media_30d_base_c, 2, "en")} °C); the difference is published already rounded to 0.1 °C`,
      idioma,
    ),
  };
}

/**
 * Quantos dos meses completos da série de temperatura ficam acima da média do mês na base: a média da base cobre vários anos e não separa a
 * tendência de longo prazo da anomalia de cada mês. Vazio sem meses.
 */
export function textoMesesAcimaDaMedia(t: Pick<AguaTemperatura, "mensal" | "anos_base">, base: string, idioma: Idioma = idiomaEnergia()): string {
  const an = t.mensal.anomalia_c.filter((x): x is number => x !== null && x !== undefined && Number.isFinite(x));
  if (!an.length) return "";
  const acima = an.filter((x) => x > 0).length;
  return tx(
    `${plural(acima, "mês ficou", "meses ficaram")} acima da média do mês em ${periodoBase(base)} entre os ${an.length} da série. Essa média cobre ${plural(t.anos_base, "ano", "anos")} e não separa a tendência de longo prazo da anomalia de cada mês.`,
    `${plural(acima, "month was", "months were", "en")} above the month average in ${periodoBase(base, "en")} out of the ${an.length} in the series. That average covers ${plural(t.anos_base, "year", "years", "en")} and does not separate the long-term trend from each month's anomaly.`,
    idioma,
  );
}

/**
 * O erro conhecido do IMERG contra estações diante da classe central do mapa de chuva (de −10% a +10%): em quantas bacias conferidas o viés
 * passa dela, para o leitor não ler diferença de cor entre classes vizinhas como diferença de chuva medida. Vazio quando nenhuma passa.
 */
export function textoClasseCentralEViesImerg(v: AguaClima["validacao_estacoes"], idioma: Idioma = idiomaEnergia()): string {
  const meia = CORTES_ANOMALIA[2];
  const vies = v.bacias.map((b) => b.vies_pct).filter((x): x is number => x !== null && Number.isFinite(x));
  const passa = vies.filter((x) => Math.abs(x) > meia).length;
  if (!vies.length || !passa) return "";
  return tx(
    `O viés do IMERG contra estações passa de ${meia}% (para mais ou para menos) em ${passa} das ${vies.length} bacias conferidas, de ${sinal(Math.min(...vies), 0)}% a ${sinal(Math.max(...vies), 0)}%: a classe central do mapa, de −${meia}% a +${meia}%, é mais estreita que esse erro.`,
    `The IMERG bias against stations exceeds ${meia}% (up or down) in ${passa} of the ${vies.length} basins checked, from ${sinal(Math.min(...vies), 0, "", "en")}% to ${sinal(Math.max(...vies), 0, "", "en")}%: the central class of the map, from −${meia}% to +${meia}%, is narrower than that error.`,
    idioma,
  );
}

/** Bacias do ONS com energia armazenada (EAR) que ficam sem chuva estimada, por não terem contorno na camada usada no mapa. */
export function baciasSemChuva(baciasEar: readonly { nome: string }[], chuva: readonly AguaPrecipitacaoBacia[]): string[] {
  const com = new Set(chuva.map((b) => b.bacia));
  return baciasEar.map((b) => b.nome).filter((n) => !com.has(n));
}

export function textoBaciasSemChuva(nomes: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (!nomes.length) return "";
  const lista = listaTexto(nomes.map((n) => nomeProprio(n, idioma)), idioma);
  return tx(
    `${lista} ${nomes.length === 1 ? "tem" : "têm"} energia armazenada nos dados do ONS, mas ${nomes.length === 1 ? "não tem" : "não têm"} contorno no arquivo de contornos usado neste mapa e ${nomes.length === 1 ? "fica" : "ficam"} sem chuva estimada.`,
    `${lista} ${nomes.length === 1 ? "has" : "have"} stored energy in the ONS data, but ${nomes.length === 1 ? "has" : "have"} no outline in the outline file used in this map and ${nomes.length === 1 ? "is" : "are"} left without estimated rainfall.`,
    idioma,
  );
}

/**
 * Cobertura espacial do clima, com os cortes de versão de cada produto. Quando as tabelas por bacia e por UF somam mais que os totais
 * únicos, o texto diz por quê: um ponto de grade dentro de dois contornos conta nas duas bacias, e uma célula que serve a duas UF conta nas duas.
 */
export function textoCobertura(
  c: Pick<AguaClima, "totais" | "base_climatologica" | "corte_imerg_final" | "corte_merra2"> & Partial<Pick<AguaClima, "cobertura_precipitacao" | "cobertura_temperatura">>,
  idioma: Idioma = idiomaEnergia(),
): string {
  const n0 = (v: number | null | undefined) => num(v, 0, idioma);
  const base = tx(
    `${n0(c.totais.pontos_precipitacao)} pontos de grade de chuva dentro dos contornos das bacias do ONS e ${n0(c.totais.celulas_temperatura)} células de temperatura escolhidas pela população. Climatologia de ${periodoBase(c.base_climatologica)}; IMERG Final até ${dataBR(c.corte_imerg_final)} e Late depois; MERRA-2 até ${dataBR(c.corte_merra2)} e GEOS-IT depois.`,
    `${n0(c.totais.pontos_precipitacao)} rainfall grid points inside the outlines of the ONS basins and ${n0(c.totais.celulas_temperatura)} temperature cells chosen by population. Climatology of ${periodoBase(c.base_climatologica, "en")}; IMERG Final through ${dataBR(c.corte_imerg_final, "en")} and Late afterwards; MERRA-2 through ${dataBR(c.corte_merra2, "en")} and GEOS-IT afterwards.`,
    idioma,
  );
  const somaPontos = c.cobertura_precipitacao?.reduce((t, x) => t + x.pontos, 0);
  const somaCelulas = c.cobertura_temperatura?.reduce((t, x) => t + x.celulas, 0);
  const partes: string[] = [];
  if (somaPontos !== undefined && somaPontos > c.totais.pontos_precipitacao) {
    partes.push(
      tx(
        `as linhas da tabela por bacia somam ${n0(somaPontos)} pontos, ${n0(somaPontos - c.totais.pontos_precipitacao)} a mais que os pontos únicos, porque um ponto dentro de dois contornos conta nas duas bacias`,
        `the rows of the table by basin add up to ${n0(somaPontos)} points, ${n0(somaPontos - c.totais.pontos_precipitacao)} more than the unique points, because a point inside two outlines counts in both basins`,
        idioma,
      ),
    );
  }
  if (somaCelulas !== undefined && somaCelulas > c.totais.celulas_temperatura) {
    partes.push(
      tx(
        `as da tabela por UF somam ${n0(somaCelulas)} células, ${n0(somaCelulas - c.totais.celulas_temperatura)} a mais que as células únicas, porque uma célula que serve a duas UF conta nas duas`,
        `those of the table by state add up to ${n0(somaCelulas)} cells, ${n0(somaCelulas - c.totais.celulas_temperatura)} more than the unique cells, because a cell that serves two states counts in both`,
        idioma,
      ),
    );
  }
  return partes.length ? tx(`${base} Totais únicos: ${partes.join("; ")}.`, `${base} Unique totals: ${partes.join("; ")}.`, idioma) : base;
}

/** "jan/2020 a out/2021": primeiro e último mês comparados com estações (publicados na gold). */
export function periodoValidacao(v: AguaClima["validacao_estacoes"], idioma: Idioma = idiomaEnergia()): string | null {
  const p = v.periodo;
  if (!p) return null;
  return p.inicio === p.fim ? mesAno(p.inicio, idioma) : tx(`${mesAno(p.inicio, "pt")} a ${mesAno(p.fim, "pt")}`, `${mesAno(p.inicio, "en")} to ${mesAno(p.fim, "en")}`, idioma);
}

/**
 * Conferência do IMERG com as estações que o ONS publicou (o período é o dos meses comparados). A correlação junta bacias e meses, então
 * inclui o ciclo sazonal; com `corteFinal`, o texto diz que o período comparado é de produto final, e não o Late dos destaques.
 */
export function textoValidacao(v: AguaClima["validacao_estacoes"], corteFinal?: string | null, idioma: Idioma = idiomaEnergia()): string {
  if (!v.pares) return tx("Sem pares bacia e mês para conferir o IMERG com estações nesta publicação.", "No basin and month pairs to check IMERG against stations in this release.", idioma);
  const per = periodoValidacao(v, idioma);
  const final =
    corteFinal && v.periodo && v.periodo.fim <= corteFinal.slice(0, 7)
      ? tx(" Os meses comparados são de IMERG Final, não do Late que alimenta os destaques.", " The months compared are IMERG Final, not the Late that feeds the highlights.", idioma)
      : "";
  const vies = v.bacias.map((b) => b.vies_pct).filter((x): x is number => x !== null && Number.isFinite(x));
  const porBacia =
    vies.length > 1
      ? tx(`; o viés por bacia vai de ${sinal(Math.min(...vies), 1)}% a ${sinal(Math.max(...vies), 1)}% (tabela)`, `; the bias by basin ranges from ${sinal(Math.min(...vies), 1, "", "en")}% to ${sinal(Math.max(...vies), 1, "", "en")}% (table)`, idioma)
      : "";
  return tx(
    `Conferência do IMERG com as estações que o ONS publicou${per ? ` (meses comparados: ${per})` : ""}: correlação mensal de ${num(v.correlacao_geral, 2)} em ${num(v.pares, 0)} pares bacia e mês, viés geral de ${sinal(v.vies_geral_pct, 1)}% (positivo: o satélite estima mais chuva que as estações). A correlação junta bacias e meses e inclui o ciclo sazonal${porBacia}.${final} A temperatura não foi conferida com estação: o INMET não respondeu nas tentativas de coleta.`,
    `Check of IMERG against the stations ONS published${per ? ` (months compared: ${per})` : ""}: monthly correlation of ${num(v.correlacao_geral, 2, "en")} in ${num(v.pares, 0, "en")} basin and month pairs, overall bias of ${sinal(v.vies_geral_pct, 1, "", "en")}% (positive: the satellite estimates more rainfall than the stations). The correlation pools basins and months and includes the seasonal cycle${porBacia}.${final} Temperature was not checked against stations: INMET did not respond to the collection attempts.`,
    idioma,
  );
}

/** Reservatórios dos dados hidráulicos sem correspondência no cadastro (sem volume útil, sem balanço). */
export function textoSemCadastro(nomes: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (!nomes.length) return tx("Todos os reservatórios dos dados hidráulicos têm correspondência no cadastro do ONS.", "All reservoirs in the hydraulic data have a match in the ONS register.", idioma);
  return tx(
    `${plural(nomes.length, "reservatório dos dados hidráulicos não tem", "reservatórios dos dados hidráulicos não têm")} correspondência no cadastro do ONS e, sem volume útil, ficam sem balanço: ${listaTexto([...nomes], "pt")}.`,
    `${plural(nomes.length, "reservoir in the hydraulic data has", "reservoirs in the hydraulic data have", "en")} no match in the ONS register and, without a useful volume, are left without a balance: ${listaTexto([...nomes], "en")}.`,
    idioma,
  );
}

/* ---------- textos que dependem do tamanho, do período e da composição das séries publicadas ---------- */

/** "a cada 14 dias" ou "por dia", a partir do passo publicado na gold. */
export function textoPasso(passo: number, idioma: Idioma = idiomaEnergia()): string {
  return passo === 1 ? tx("por dia", "daily", idioma) : tx(`a cada ${passo} dias`, `every ${passo} days`, idioma);
}

/** Ano do primeiro ponto de uma série ("2000-01" ou "2000-01-01" → "2000"); null sem ponto. */
export function anoInicial(x: string | null | undefined): string | null {
  return x ? x.slice(0, 4) : null;
}

/**
 * O peso de cada subsistema no SIN, para ler o gráfico em MWmês: quanto vale 1 p.p. de EAR
 * no maior e no menor subsistema (EAR máxima ÷ 100) e a participação do maior na
 * capacidade do SIN, tudo da gold do dia.
 */
export function textoPesoSubsistemas(lista: readonly EntidadeEar[], idioma: Idioma = idiomaEnergia()): string | null {
  const subs = lista
    .filter((e) => e.tipo === "subsistema" && e.id !== "SIN" && e.ear_max_mwmes !== null && e.ear_max_mwmes > 0)
    .sort((a, b) => (b.ear_max_mwmes ?? 0) - (a.ear_max_mwmes ?? 0));
  if (subs.length < 2) return null;
  const maior = subs[0];
  const menor = subs[subs.length - 1];
  const part = maior.participacao_capacidade_sin_pct;
  return tx(
    `Em energia, os subsistemas não pesam o mesmo: em ${dataBR(maior.dia)}, o ${maior.rotulo}${part !== null ? ` tinha ${pct(part, 1)} da EAR máxima do SIN, e` : ""} 1 p.p. de EAR ali equivale a ${mwmes(maior.ear_max_mwmes! / 100)} MWmês, contra ${mwmes(menor.ear_max_mwmes! / 100)} MWmês no ${menor.rotulo}. O SIN (soma dos quatro) está na tabela equivalente do gráfico e no número de destaque.`,
    `In energy terms, the subsystems do not weigh the same: on ${dataBR(maior.dia, "en")}, the ${maior.rotulo}${part !== null ? ` had ${pct(part, 1, "en")} of the SIN's maximum EAR, and` : ""} 1 pp of EAR there is equivalent to ${mwmes(maior.ear_max_mwmes! / 100, "en")} MWmonth, against ${mwmes(menor.ear_max_mwmes! / 100, "en")} MWmonth in the ${menor.rotulo}. The SIN (sum of the four) is in the chart's equivalent table and in the highlight figure.`,
    idioma,
  );
}

/** Recortes que ficam fora dos pontos pareados por não terem armazenamento (na tabela, com "não se aplica"). */
export function textoForaDosPontos(lista: readonly EntidadeEar[], idioma: Idioma = idiomaEnergia()): string | null {
  const fora = lista.filter((e) => e.sem_armazenamento);
  if (!fora.length) return null;
  const nomes = listaTexto(fora.map((e) => e.rotulo), idioma);
  return tx(
    `Fora do gráfico, por não terem armazenamento (EAR máxima zero: percentual e faixa não se aplicam): ${nomes}. ${fora.length === 1 ? "Ele está" : "Estão"} na tabela equivalente, com a EAR em MWmês.`,
    `Left out of the chart because they have no storage (maximum EAR of zero: percentage and range do not apply): ${nomes}. ${fora.length === 1 ? "It is" : "They are"} in the equivalent table, with the EAR in MWmonth.`,
    idioma,
  );
}

/* ---------- P017: textos e cores da abertura de armazenamento ---------- */

/** Cor de um recorte em todos os gráficos da abertura: a do subsistema (o SIN inclusive); REE e bacias, a cor da energia. */
export function corDoRecorte(e: Pick<EntidadeEar, "tipo" | "id">): string {
  return e.tipo === "subsistema" ? COR_REGIAO[e.id as Regiao] : "var(--cor-energia)"; // i18n: dado
}

/** Período do recorte no rodapé da figura: o dia e a base da faixa, ou o motivo exato de não haver faixa. */
export function textoPeriodoDoRecorte(e: Pick<EntidadeEar, "dia" | "sem_armazenamento" | "periodo_base" | "anos_na_base">, idioma: Idioma = idiomaEnergia()): string {
  if (!e.dia) return tx("sem dia de referência", "no reference day", idioma);
  const dia = dataBR(e.dia, idioma);
  if (e.sem_armazenamento) return tx(`${dia}; sem faixa do mesmo dia: o recorte não tem armazenamento (EAR máxima zero)`, `${dia}; no range for the same day: the area has no storage (maximum EAR of zero)`, idioma);
  if (!e.periodo_base) return tx(`${dia}; sem faixa do mesmo dia: ${nAnos(e.anos_na_base, "pt")} na base, menos que os 5 exigidos`, `${dia}; no range for the same day: ${nAnos(e.anos_na_base, "en")} in the baseline, fewer than the 5 required`, idioma);
  return tx(`${dia}; faixa do mesmo dia do calendário nos anos completos de ${periodoBase(e.periodo_base, "pt")}`, `${dia}; range of the same calendar day in the complete years of ${periodoBase(e.periodo_base, "en")}`, idioma);
}

/** Rótulo da faixa na figura do último ano: o período da base só quando existe. */
export function rotuloBandaDaFaixa(e: Pick<EntidadeEar, "periodo_base">, idioma: Idioma = idiomaEnergia()): string {
  return e.periodo_base
    ? tx(`10º a 90º percentil da data (${periodoBase(e.periodo_base, "pt")})`, `10th to 90th percentile for the date (${periodoBase(e.periodo_base, "en")})`, idioma)
    : tx("10º a 90º percentil da data", "10th to 90th percentile for the date", idioma);
}

/**
 * A faixa de cada ponto do último ano usa os anos completos anteriores a ele, então o ano do próprio ponto fica fora: com a base de
 * 2001 a 2025, os pontos de 2025 comparam com 2001 a 2024 e os de 2026, com 2001 a 2025. Os anos saem do período da base e das datas da série.
 */
export function textoBaseDaFaixa(e: Pick<EntidadeEar, "periodo_base" | "semanal">, idioma: Idioma = idiomaEnergia()): string {
  const m = /^(\d{4})-(\d{4})$/.exec(e.periodo_base ?? "");
  if (!m || !e.semanal) return "";
  const ini = Number(m[1]);
  const fim = Number(m[2]);
  const anos = Array.from(new Set(diasRegulares(e.semanal.d0, e.semanal.passo_dias, e.semanal.v.length).map((d) => Number(d.slice(0, 4))))).sort((a, b) => a - b);
  const partes = anos
    .map((y) => ({ y, ate: Math.min(fim, y - 1) }))
    .filter((x) => x.ate >= ini)
    .map((x) => tx(`${periodoBase(`${ini}-${x.ate}`, "pt")} nos pontos de ${x.y}`, `${periodoBase(`${ini}-${x.ate}`, "en")} for the ${x.y} points`, idioma));
  return partes.length ? tx(`A faixa de cada ponto exclui o ano do próprio ponto: ${listaTexto(partes, "pt")}.`, `The range of each point excludes the point's own year: ${listaTexto(partes, "en")}.`, idioma) : "";
}

/**
 * Quando a variação por reservatório (página de reservatórios) termina em outro dia que o da EAR desta página, uma frase diz isso para
 * qualquer recorte; vazia quando os dias coincidem.
 */
export function textoJanelasDaVariacao(dia: string | null, ds: readonly AguaDecomposicaoEar[], idioma: Idioma = idiomaEnergia()): string {
  const fins = Array.from(new Set(ds.filter((d) => d.delta_ear_mwmes !== null).map((d) => d.fim)));
  if (!dia || !fins.length || fins.every((f) => f === dia)) return "";
  return tx(
    `A página de reservatórios mede a variação por reservatório numa janela que termina em ${listaTexto(fins.map((x) => dataBR(x, "pt")), "pt")}, o último dia com EAR por reservatório, e esta página termina em ${dataBR(dia, "pt")}: o valor de um mesmo subsistema difere entre as duas.`,
    `The reservoirs page measures the change by reservoir in a window ending on ${listaTexto(fins.map((x) => dataBR(x, "en")), "en")}, the last day with EAR by reservoir, and this page ends on ${dataBR(dia, "en")}: the value for the same subsystem differs between the two.`,
    idioma,
  );
}

/** A EAR não é medição direta: o ONS a deriva (nota junto da etiqueta "Observado"). */
export function textoEarDerivada(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "A EAR é derivada pelo ONS (a energia que a água armazenada produziria nas usinas, pela produtibilidade acumulada), não é medição direta.",
    "The EAR is derived by ONS (the energy that the stored water would produce in the plants, by accumulated productivity); it is not a direct measurement.",
    idioma,
  );
}
export const TEXTO_EAR_DERIVADA = textoEarDerivada("pt");

/**
 * A unidade da EAR com a conversão para MWh e a fonte dela: um mês de 30 dias de 24 horas, como no glossário do ONS (Dados Relevantes 2010).
 * A conversão não é medida nem calculada pela página: é a convenção da unidade que o ONS publica.
 */
export function textoUnidadeMwmes(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "MWmês, a energia de um megawatt médio durante um mês de 30 dias (1 MWmês = 720 MWh, conversão do glossário do ONS em Dados Relevantes 2010)",
    "MWmonth (MWmês), the energy of one average megawatt over a 30-day month (1 MWmonth = 720 MWh, conversion from the ONS glossary in Dados Relevantes 2010)",
    idioma,
  );
}
export const TEXTO_UNIDADE_MWMES = textoUnidadeMwmes("pt");

/** Linha "Revisões" da ficha da capacidade: os eventos vêm de uma única captura por reservatório, e a tabela de revisões cobre só a EAR. */
export function revisoesCapacidade(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "Ainda não é possível detectar revisões nos eventos: a atribuição por reservatório vem de uma única captura, e a comparação entre capturas desta página cobre só a EAR dos últimos 30 dias.",
    "It is not yet possible to detect revisions in the events: the attribution by reservoir comes from a single capture, and the comparison between captures on this page covers only the EAR of the last 30 days.",
    idioma,
  );
}
export const REVISOES_CAPACIDADE = revisoesCapacidade("pt");

/**
 * Linha "Revisões" da ficha "Comprove este número" da EAR, montada das linhas da tabela de revisões da própria página (as mesmas que
 * `linhasRevisoesCapturas` entrega), para a ficha não dizer "nenhuma revisão" onde a página mostra revisão.
 */
export function textoRevisoesFichaEar(rs: readonly AguaRevisaoCaptura[], idioma: Idioma = idiomaEnergia()): string {
  const ear = rs.filter((r) => r.serie === "ear_mwmes");
  const com = ear.filter((r) => r.dias_revisados > 0);
  if (!com.length) return tx("Nenhum valor da EAR dos últimos 30 dias mudou entre as duas capturas mais recentes.", "No EAR value from the last 30 days changed between the two most recent captures.", idioma);
  const dias = com.map((r) => `${nomeRegiao(r.sm, idioma)} ${r.dias_revisados}`);
  const maior = [...com].sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0))[0];
  return tx(
    `O ONS revisou a EAR dos subsistemas entre as duas capturas mais recentes, em dias dos últimos 30: ${listaTexto(dias, "pt")}. A maior diferença foi de ${sinal(maior.diferenca, 1)} MWmês no ${NOME_REGIAO[maior.sm]}, em ${dataBR(maior.dia_maior)}. O detalhe está na tabela de revisões do ONS desta página, em Auditar.`,
    `ONS revised the subsystems' EAR between the two most recent captures, on days within the last 30: ${listaTexto(dias, "en")}. The largest difference was ${sinal(maior.diferenca, 1, "", "en")} MWmonth in the ${nomeRegiao(maior.sm, "en")}, on ${dataBR(maior.dia_maior, "en")}. The detail is in this page's table of ONS revisions, under Audit.`,
    idioma,
  );
}

/** Nota de provisório dos destaques da EAR: os últimos dias ainda mudam, e a página diz quantos dias mudaram entre as duas capturas mais recentes. */
export function textoEarProvisoria(rs: readonly AguaRevisaoCaptura[], idioma: Idioma = idiomaEnergia()): string {
  const base = tx("A EAR dos últimos dias é provisória: o ONS a revisa depois de publicá-la", "The EAR for the last few days is provisional: ONS revises it after publishing it", idioma);
  const com = rs.filter((r) => r.serie === "ear_mwmes" && r.dias_revisados > 0);
  if (!com.length) return tx(`${base}; entre as duas capturas mais recentes, nenhum valor dos últimos 30 dias mudou.`, `${base}; between the two most recent captures, no value from the last 30 days changed.`, idioma);
  const n = com.map((r) => r.dias_revisados);
  const menor = Math.min(...n);
  const maior = Math.max(...n);
  const quanto = menor === maior ? tx(`${maior} dos 30 dias`, `${maior} of the 30 days`, idioma) : tx(`de ${menor} a ${maior} dos 30 dias`, `from ${menor} to ${maior} of the 30 days`, idioma);
  return tx(
    `${base}. Entre as duas capturas mais recentes, ele revisou ${quanto}, conforme o subsistema (detalhe na tabela de revisões, em Auditar).`,
    `${base}. Between the two most recent captures, it revised ${quanto}, depending on the subsystem (detail in the revisions table, under Audit).`,
    idioma,
  );
}

/* --- eventos de mudança da capacidade --- */

/** O que "entrada", "saída" e "alteração" querem dizer para cada reservatório de um evento, e o que a fonte não diz. */
export function textoTiposDeEvento(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "Cada reservatório de um evento entra (passa a contar na EAR máxima), sai (deixa de contar) ou é alterado (já contava, e a EAR máxima dele mudou naquele dia). A fonte não informa a causa de cada alteração; a EAR máxima é uma capacidade em energia e também muda quando entra uma usina a jusante, pela produtibilidade acumulada, mesmo sem mudança no volume do reservatório.",
    "Each reservoir in an event is added (starts counting in the maximum EAR), removed (stops counting) or changed (it already counted, and its maximum EAR changed on that day). The source does not report the cause of each change; the maximum EAR is a capacity in energy and also changes when a downstream plant comes in, through accumulated productivity, even without any change in the reservoir's volume.",
    idioma,
  );
}
export const TEXTO_TIPOS_DE_EVENTO = textoTiposDeEvento("pt");

const TOLERANCIA_FINA_MWMES = 0.05;
/** Dia em que a fonte passa de MWmês inteiros a três casas decimais (a tolerância dos eventos muda aí; regra em agua_detalhe.py). */
const DIA_TRES_CASAS = "2018-01-01";

/** Eventos que só fecham pela tolerância larga: resíduo acima da tolerância fina no dia da mudança de precisão da fonte ou depois dele. */
export function eventosSoPelaToleranciaLarga(eventos: readonly AguaEventoCapacidade[]): AguaEventoCapacidade[] {
  return eventos.filter((e) => e.fechado && e.residuo_mwmes !== null && Math.abs(e.residuo_mwmes) > TOLERANCIA_FINA_MWMES && e.data >= DIA_TRES_CASAS);
}

/** A regra da tolerância do resíduo com o dia anterior, e os eventos que só fecham por ela (dos dados). */
export function textoToleranciaEventos(eventos: readonly AguaEventoCapacidade[], idioma: Idioma = idiomaEnergia()): string {
  const regra = tx(
    "Tolerância do resíduo: 10 MWmês quando o dia anterior ainda tem valores inteiros na fonte (até 2017) e 0,05 MWmês depois.",
    "Residual tolerance: 10 MWmonth when the previous day still has whole-number values in the source (through 2017) and 0.05 MWmonth afterwards.",
    idioma,
  );
  const csv = tx("A lista completa de reservatórios de cada evento está no CSV, que não traz a tolerância.", "The full list of reservoirs for each event is in the CSV, which does not include the tolerance.", idioma);
  const so = eventosSoPelaToleranciaLarga(eventos);
  if (!so.length) return `${regra} ${csv}`;
  const datas = Array.from(new Set(so.map((e) => e.data))).sort();
  const lista = so.map((e) => `${ehRegiao(e.sm) ? nomeRegiao(e.sm, idioma) : e.sm} ${sinal(e.residuo_mwmes, 3, "", idioma)}`);
  return tx(
    `${regra} Como o evento compara a EAR máxima do dia com a do dia anterior, o primeiro dia de valores com casas decimais ainda usa os 10 MWmês: em ${listaTexto(datas.map((x) => dataBR(x, "pt")), "pt")}, ${plural(so.length, "evento fecha", "eventos fecham")} só por essa regra, com resíduos de ${listaTexto(lista, "pt")} MWmês, acima dos 0,05. ${csv}`,
    `${regra} Because the event compares the day's maximum EAR with the previous day's, the first day of values with decimal places still uses the 10 MWmonth: on ${listaTexto(datas.map((x) => dataBR(x, "en")), "en")}, ${plural(so.length, "event closes", "events close", "en")} only under that rule, with residuals of ${listaTexto(lista, "en")} MWmonth, above 0.05. ${csv}`,
    idioma,
  );
}

/** O que a comparação com o PMO impede de concluir, com a contagem de meses conferidos. */
export function textoMltNaoConcluir(mlt: AguaMlt, idioma: Idioma = idiomaEnergia()): string {
  const meses = Array.from(new Set(mlt.pmo.comparacao.map((c) => c.mes))).sort();
  const div = mlt.pmo.meses_divergentes;
  const fim = tx(
    "e versões antigas da MLT diferem da atual: o percentual não é comparável entre publicações e períodos longos sem esse cuidado.",
    "and old versions of the MLT differ from the current one: the percentage is not comparable across releases and long periods without this care.",
    idioma,
  );
  if (!meses.length) return tx(`A MLT dos relatórios do PMO não foi conferida nesta publicação, ${fim}`, `The MLT of the PMO reports was not checked in this release, ${fim}`, idioma);
  const sem = mesesSemPmo(mlt);
  const per = tx(
    `${mesAno(meses[0], "pt")} a ${mesAno(meses[meses.length - 1], "pt")}${sem.length ? `, sem ${listaMeses(sem, "pt")}` : ""}`,
    `${mesAno(meses[0], "en")} to ${mesAno(meses[meses.length - 1], "en")}${sem.length ? `, without ${listaMeses(sem, "en")}` : ""}`,
    idioma,
  );
  if (!div.length) return tx(`A MLT do conjunto aberto coincidiu com a dos relatórios do PMO nos ${meses.length} meses conferidos (${per}), ${fim}`, `The open-dataset MLT matched that of the PMO reports in the ${meses.length} months checked (${per}), ${fim}`, idioma);
  const quantos =
    div.length === meses.length
      ? tx(`em todos os ${meses.length} meses conferidos`, `in all ${meses.length} months checked`, idioma)
      : tx(`em ${plural(div.length, "mês", "meses")} dos ${meses.length} conferidos`, `in ${plural(div.length, "month", "months", "en")} of the ${meses.length} checked`, idioma);
  return tx(`A MLT do conjunto aberto difere da dos relatórios do PMO ${quantos} (${per}, comparada no fim do mês), ${fim}`, `The open-dataset MLT differs from that of the PMO reports ${quantos} (${per}, compared at the end of the month), ${fim}`, idioma);
}

/** "; Iguaçu, Manaus/Amapá e Paranapanema só existem desde 30/12/2017" (REE novos publicados na gold). */
export function textoReeNovos(novos: readonly { data: string; novos: string[] }[], idioma: Idioma = idiomaEnergia()): string {
  if (!novos.length) return "";
  const itens = novos.map((x) =>
    tx(
      `${listaTexto(x.novos.map((n) => nomeProprio(n, "pt")), "pt")} só ${x.novos.length === 1 ? "existe" : "existem"} desde ${dataBR(x.data, "pt")}`,
      `${listaTexto(x.novos.map((n) => nomeProprio(n, "en")), "en")} only ${x.novos.length === 1 ? "exists" : "exist"} since ${dataBR(x.data, "en")}`,
      idioma,
    ),
  );
  return `; ${listaTexto(itens, idioma)}`;
}

/* ---------- seletores das medidas de abertura das páginas filhas (faixa de métricas) ---------- */

/**
 * Nota da ENA do dia na faixa de métricas da afluência: o percentual da MLT do dia e a própria MLT do dia em MWmed, os dois lidos da gold
 * (a faixa não calcula nada). Sem um dos dois campos, sem nota.
 */
export function notaEnaDoDia(e: Pick<EntidadeEna, "pct_mlt_dia" | "mlt_mwmed_dia">, idioma: Idioma = idiomaEnergia()): string | null {
  if (e.pct_mlt_dia === null || e.mlt_mwmed_dia === null) return null;
  return tx(
    `${pct(e.pct_mlt_dia, 1)} da MLT do dia, de ${num(e.mlt_mwmed_dia, 0)} MWmed (megawatt médio: a potência média do dia).`,
    `${pct(e.pct_mlt_dia, 1, "en")} of the day's MLT, of ${num(e.mlt_mwmed_dia, 0, "en")} MWavg (average megawatts: the average power over the day).`,
    idioma,
  );
}

/**
 * "O que mudou" da decomposição da EAR: a variação de 30 dias de cada subsistema na mesma unidade (MWmês) e no mesmo período, lida da
 * decomposição publicada (a mesma que alimenta a resposta, a tabela dos subsistemas e o arquivo). O período vai uma vez, quando os quatro
 * coincidem, e junto de cada subsistema quando diferem.
 */
export function textoMudancaDecomposicao(ds: readonly AguaDecomposicaoEar[], idioma: Idioma = idiomaEnergia()): string {
  const com = SUBSISTEMAS.map((sm) => ds.find((d) => d.sm === sm)).filter((d): d is AguaDecomposicaoEar => !!d && d.delta_ear_mwmes !== null);
  if (!com.length) return tx("Sem variação da EAR por reservatório nesta publicação.", "No change in EAR by reservoir in this release.", idioma);
  const mesma = com.every((d) => d.inicio === com[0].inicio && d.fim === com[0].fim);
  const d = (x: string) => dataBR(x, idioma);
  const partes = com.map((x) => `${nomeRegiao(x.sm, idioma)} ${sinal(x.delta_ear_mwmes, 1, "", idioma)}${mesma ? "" : tx(` (${d(x.inicio)} a ${d(x.fim)})`, ` (${d(x.inicio)} to ${d(x.fim)})`, idioma)}`);
  return tx(
    `${mesma ? `De ${d(com[0].inicio)} a ${d(com[0].fim)}, a` : "A"} EAR variou, em MWmês: ${partes.join("; ")}.`,
    `${mesma ? `From ${d(com[0].inicio)} to ${d(com[0].fim)}, the` : "The"} EAR changed, in MWmonth: ${partes.join("; ")}.`,
    idioma,
  );
}

/* ---------- revisões do ONS: o que as fichas e os destaques dizem sobre a ENA e o volume ---------- */

/** Linha "Revisões" da ficha de um número que vem de uma única captura (reservatórios, chuva): o que é exato dizer. */
export function revisoesCapturaUnica(idioma: Idioma = idiomaEnergia()): string {
  return tx("Ainda não é possível detectar revisões: há uma única captura.", "It is not yet possible to detect revisions: there is a single capture.", idioma);
}
export const REVISOES_CAPTURA_UNICA = revisoesCapturaUnica("pt");

/**
 * Aviso de provisório dos dados hidráulicos (volume, afluência e defluência), com a mesma estrutura dos avisos da EAR e da ENA: o ONS revisa
 * os dias recentes depois de publicá-los. A publicação tem uma só captura desses dados, e a página diz que por isso não mostra a revisão.
 */
export function textoHidraulicosProvisorios(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "O volume e as vazões dos últimos dias são provisórios: o ONS os revisa depois de publicá-los. Esta publicação tem uma única captura dos dados hidráulicos, então a revisão não aparece aqui.",
    "The volume and flows for the last few days are provisional: ONS revises them after publishing them. This release has a single capture of the hydraulic data, so the revision does not appear here.",
    idioma,
  );
}
export const TEXTO_HIDRAULICOS_PROVISORIOS = textoHidraulicosProvisorios("pt");

/**
 * Linha "Revisões" da ficha "Comprove este número" da ENA, montada das linhas da tabela de revisões da própria página (as mesmas que
 * `linhasRevisoesCapturas` entrega), para a ficha não dizer "nenhuma revisão" onde a página mostra revisão.
 */
export function textoRevisoesFicha(rs: readonly AguaRevisaoCaptura[], idioma: Idioma = idiomaEnergia()): string {
  const com = rs.filter((r) => r.dias_revisados > 0);
  if (!com.length) return tx("Nenhum valor dos últimos 30 dias mudou entre as duas capturas mais recentes.", "No value from the last 30 days changed between the two most recent captures.", idioma);
  const dias = com.map((r) => `${nomeRegiao(r.sm, idioma)} ${r.dias_revisados}`);
  const maior = [...com].sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0))[0];
  return tx(
    `O ONS revisou a ENA bruta entre as duas capturas mais recentes, em dias dos últimos 30: ${listaTexto(dias, "pt")}. A maior diferença foi de ${sinal(maior.diferenca, 1)} MWmed no ${NOME_REGIAO[maior.sm]}, em ${dataBR(maior.dia_maior)}. O detalhe está na tabela de revisões do ONS desta página, em Auditar.`,
    `ONS revised the gross ENA between the two most recent captures, on days within the last 30: ${listaTexto(dias, "en")}. The largest difference was ${sinal(maior.diferenca, 1, "", "en")} MWavg in the ${nomeRegiao(maior.sm, "en")}, on ${dataBR(maior.dia_maior, "en")}. The detail is in this page's table of ONS revisions, under Audit.`,
    idioma,
  );
}

type ProvComRevisoes = {
  revisoes_conhecidas: { detectado_em: string; total: number; vintages_comparadas?: number; arquivos?: number; recapturas_sem_mudanca?: number; ultimo_download_ok?: string | null; exemplos: { serie: string; ref: string; valores: number }[] } | null;
};

/**
 * A mesma proveniência com as revisões que a tabela de revisões da página mostra. A da gold conta as capturas integradas do arquivo
 * principal ("há uma única captura de cada arquivo") e não vê a recaptura feita para a página, então "Sobre este dado" dizia que não é
 * possível detectar revisões onde a página mostra dias revisados. Aqui o total é a soma dos dias revisados da tabela, e cada exemplo é o
 * dia da maior diferença de um subsistema, do mais recente ao mais antigo. Sem dia revisado, a proveniência fica como veio.
 * `oQue` é o que foi revisado, já no idioma da página ("da EAR", "of the EAR").
 */
export function provenienciaComRevisoesDaPagina<P extends ProvComRevisoes>(p: P, rs: readonly AguaRevisaoCaptura[], oQue: string, idioma: Idioma = idiomaEnergia()): P {
  const com = rs.filter((r) => r.dias_revisados > 0);
  if (!p.revisoes_conhecidas || !com.length) return p;
  return {
    ...p,
    revisoes_conhecidas: {
      ...p.revisoes_conhecidas,
      total: com.reduce((t, r) => t + r.dias_revisados, 0),
      exemplos: [...com]
        .sort((a, b) => b.dia_maior.localeCompare(a.dia_maior))
        .map((r) => ({
          serie: tx(
            `maior revisão ${oQue} ${DO_REGIAO[r.sm]} (${plural(r.dias_revisados, "dia revisado", "dias revisados")})`,
            `largest revision ${oQue} ${doRegiao(r.sm, "en")} (${plural(r.dias_revisados, "day revised", "days revised", "en")})`,
            idioma,
          ),
          ref: r.dia_maior,
          valores: r.dias_revisados,
        })),
    },
  };
}

/**
 * Nota de provisório dos destaques da ENA: os últimos dias ainda mudam, e a página mostra quanto mudaram entre as duas capturas
 * mais recentes. Dita em palavras, sem cor de alerta.
 */
export function textoEnaProvisoria(rs: readonly AguaRevisaoCaptura[], idioma: Idioma = idiomaEnergia()): string {
  const base = tx("A ENA dos últimos dias é provisória: o ONS a revisa depois de publicá-la", "The ENA for the last few days is provisional: ONS revises it after publishing it", idioma);
  const com = rs.filter((r) => r.dias_revisados > 0);
  if (!com.length) return tx(`${base}; entre as duas capturas mais recentes, nenhum valor dos últimos 30 dias mudou.`, `${base}; between the two most recent captures, no value from the last 30 days changed.`, idioma);
  const n = com.map((r) => r.dias_revisados);
  const menor = Math.min(...n);
  const maior = Math.max(...n);
  const quanto = menor === maior ? tx(`${maior} dos 30 dias`, `${maior} of the 30 days`, idioma) : tx(`de ${menor} a ${maior} dos 30 dias`, `from ${menor} to ${maior} of the 30 days`, idioma);
  return tx(
    `${base}. Entre as duas capturas mais recentes, ele revisou ${quanto}, conforme o subsistema (detalhe na tabela de revisões, em Auditar).`,
    `${base}. Between the two most recent captures, it revised ${quanto}, depending on the subsystem (detail in the revisions table, under Audit).`,
    idioma,
  );
}

/* ---------- duas janelas de 30 dias para o mesmo subsistema ---------- */

/**
 * Nota curta da variação do subsistema na decomposição por reservatório, com a outra janela ao lado quando a página de armazenamento
 * termina em outro dia ("na página de armazenamento, −3.297,8 MWmês em 30 dias até 29/09/2026"). Vazia quando as duas terminam no mesmo dia.
 */
export function notaOutraJanelaCurta(d: AguaDecomposicaoEar | null, lista: readonly Pick<EntidadeEar, "id" | "tipo" | "dia" | "variacao_30d_mwmes">[], idioma: Idioma = idiomaEnergia()): string {
  if (!d || d.delta_ear_mwmes === null) return "";
  const e = lista.find((x) => x.tipo === "subsistema" && x.id === d.sm);
  if (!e || e.variacao_30d_mwmes === null || !e.dia || e.dia === d.fim) return "";
  return tx(
    `Na página de armazenamento, ${sinal(e.variacao_30d_mwmes, 1)} MWmês em 30 dias até ${dataBR(e.dia)}: outra janela, que termina em outro dia.`,
    `On the storage page, ${sinal(e.variacao_30d_mwmes, 1, "", "en")} MWmonth over the 30 days through ${dataBR(e.dia, "en")}: another window, ending on another day.`,
    idioma,
  );
}

/**
 * O mesmo aviso, escrito para a página de armazenamento: a decomposição por reservatório usa outra janela (a que termina no último dia
 * com EAR por reservatório). Vazia quando as duas terminam no mesmo dia.
 */
export function textoOutraJanelaNaArmazenamento(e: Pick<EntidadeEar, "id" | "tipo" | "dia" | "variacao_30d_mwmes">, ds: readonly AguaDecomposicaoEar[], idioma: Idioma = idiomaEnergia()): string {
  if (e.tipo !== "subsistema" || e.variacao_30d_mwmes === null || !e.dia) return "";
  const d = ds.find((x) => x.sm === e.id);
  if (!d || d.delta_ear_mwmes === null || d.fim === e.dia) return "";
  return tx(
    `A página de reservatórios mostra ${sinal(d.delta_ear_mwmes, 1)} MWmês ${DO_REGIAO[d.sm]} de ${dataBR(d.inicio)} a ${dataBR(d.fim)}, o último dia com EAR por reservatório. Aqui a janela é de 30 dias até ${dataBR(e.dia)}, e a variação é ${sinal(e.variacao_30d_mwmes, 1)} MWmês.`,
    `The reservoirs page shows ${sinal(d.delta_ear_mwmes, 1, "", "en")} MWmonth ${doRegiao(d.sm, "en")} from ${dataBR(d.inicio, "en")} to ${dataBR(d.fim, "en")}, the last day with EAR by reservoir. Here the window is the 30 days through ${dataBR(e.dia, "en")}, and the change is ${sinal(e.variacao_30d_mwmes, 1, "", "en")} MWmonth.`,
    idioma,
  );
}

/* ---------- nomes na ficha "Comprove este número" ---------- */

/**
 * A mesma ficha de prova com o nome e o valor do cartão: o indicador técnico da gold cita o nome do ONS em maiúsculas e o valor com
 * outro arredondamento ("Chuva de 30 dias na bacia PARANAIBA, 70 mm" contra "Bacia do Paranaíba, 70,2 mm"); a prova (valor antes do
 * arredondamento, arquivos, fórmula) segue como está.
 */
export function evidenciaComNome<E extends { indicador: string; valor_exibido: string }>(ev: E, indicador: string, valorExibido: string): E {
  return { ...ev, indicador, valor_exibido: valorExibido };
}

/* ---------- regras da ENA em Auditar, escritas para a ENA (a da gold repete a regra da EAR e cita termos internos) ---------- */

/** Faixa usual da ENA de 30 dias: o que o texto da gold diz da EAR, dito para a ENA e sem nomes de campo nem de camada. */
export function regraFaixaEna(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "Faixa usual da ENA de 30 dias: mediana, 10º e 90º percentis da ENA de 30 dias que termina no mesmo dia do calendário, em % da MLT vigente, nos anos completos anteriores da base de cada recorte (a coluna Período da base da tabela mostra os anos usados). Com menos de 5 anos na base, não há faixa.",
    "Usual range of the 30-day ENA: median, 10th and 90th percentiles of the 30-day ENA ending on the same calendar day, in % of the MLT in force, over the previous complete years of each area's baseline (the Baseline period column of the table shows the years used). With fewer than 5 years in the baseline, there is no range.",
    idioma,
  );
}
export const REGRA_FAIXA_ENA = regraFaixaEna("pt");

/** Captura usada: a recaptura feita pelo observatório vale mais que a captura principal, e as revisões entre as duas são publicadas. */
export function regraCapturaEna(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "Para cada ano vale a captura mais recente do arquivo anual do ONS por subsistema, entre a captura principal do observatório e a recaptura feita para esta página. As revisões entre as duas nos últimos 30 dias são publicadas na tabela de revisões, nesta seção.",
    "For each year, the most recent capture of the annual ONS file by subsystem applies, between the observatory's main capture and the recapture made for this page. The revisions between the two over the last 30 days are published in the revisions table, in this section.",
    idioma,
  );
}
export const REGRA_CAPTURA_ENA = regraCapturaEna("pt");

/* ---------- mapa das bacias: navegação por setas ---------- */

export type DirecaoMapa = "direita" | "esquerda" | "cima" | "baixo";

/**
 * A bacia mais próxima na direção da seta, a partir do ponto de rótulo de cada contorno (a coordenada y cresce para baixo, como no SVG).
 * O ângulo pesa mais que a distância ao longo do eixo: a seta para a direita vai à bacia que está à direita e mais alinhada, não à
 * mais próxima na diagonal. Sem bacia naquela direção, null (o foco fica onde está).
 */
export function vizinhaNoMapa(pontos: Readonly<Record<string, readonly [number, number]>>, id: string, dir: DirecaoMapa): string | null {
  const a = pontos[id];
  if (!a) return null;
  let melhor: string | null = null;
  let melhorNota = Infinity;
  for (const outro of Object.keys(pontos)) {
    if (outro === id) continue;
    const dx = pontos[outro][0] - a[0];
    const dy = pontos[outro][1] - a[1];
    const ao = dir === "direita" ? dx : dir === "esquerda" ? -dx : dir === "baixo" ? dy : -dy;
    if (ao <= 0) continue;
    const lateral = dir === "direita" || dir === "esquerda" ? Math.abs(dy) : Math.abs(dx);
    const nota = ao + 2 * lateral;
    if (nota < melhorNota) {
      melhorNota = nota;
      melhor = outro;
    }
  }
  return melhor;
}
