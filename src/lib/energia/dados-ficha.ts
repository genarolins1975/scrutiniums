import { carimbo, dataBR, plural } from "./formato";
import { fraseFrequencia, listaEmPortugues, partirLicenca, pelo, refLegivel } from "./dados";
import type { Cadencia, ConjuntoIntegrado, EntradaDados } from "./tipos-dados";

/**
 * Ficha de um conjunto de dados em linguagem de leitor (rodada r8 de conteúdo). Tudo o que está aqui é função pura dos
 * campos que o catálogo (catalogo.json) e a publicação (publicacao.json) já trazem: nada é buscado na fonte, nada é
 * escrito de memória. Quando o dado não diz, a frase diz que o dado não diz.
 */

/* ---------------------------------------------------------------- nome do conjunto */

/** Título que a fonte publica como identificador técnico: maiúsculas, dígitos e ao menos um sublinhado (LISTA_AGENTE_ASSOCIADO). */
export function eTituloTecnico(t: string): boolean {
  return /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(t.trim());
}

/**
 * Nome com que o próprio observatório chama um conjunto cujo título e cujo nome de integração são identificadores. Cada entrada
 * repete um nome que o observatório já publica (o teste confere contra publicacao.json).
 */
export const NOME_DO_CONJUNTO_TECNICO: Record<string, string> = {
  PLD_HORARIO: "PLD horário",
};

/**
 * Grafias da fonte que o observatório corrige na exibição. O título original continua na ficha, em Analisar, e na
 * citação em Auditar, como a fonte o publica.
 */
const CORRECOES_DE_GRAFIA: readonly (readonly [RegExp, string])[] = [[/\bPublicas\b/g, "Públicas"]];

export function corrigeGrafia(t: string): string {
  return CORRECOES_DE_GRAFIA.reduce((s, [re, certo]) => s.replace(re, certo), t);
}

const humaniza = (t: string) => {
  const s = t.toLowerCase().replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export type NomeDoConjunto = {
  /** O que o leitor lê no título da ficha. */
  nome: string;
  /** O título como a fonte o publica, quando difere do nome; nulo quando são iguais. */
  tituloNaFonte: string | null;
  /** Por que o nome difere do título da fonte: identificador técnico, grafia sem acento, nome técnico da consulta ou travessão como separador. */
  motivo: "identificador" | "grafia" | "nome tecnico" | "separador" | null;
};

/** Nome técnico de consulta que o título de uma entrada de portal carrega ("(API CKAN package_search)", "(package_show)"). */
const NOME_TECNICO_NO_TITULO = /\s*\((?:API CKAN package_search|package_show)\)/g;

/**
 * Nome do conjunto para o leitor. Título que é identificador técnico troca pelo nome que a integração do conjunto traz (o
 * título que o módulo do observatório registrou); sem ele, pelo nome que o observatório já usa; sem nenhum, o identificador
 * em minúsculas e sem sublinhado. A grafia sem acento da fonte é corrigida, o nome técnico da consulta sai do título e o travessão
 * usado como separador vira dois-pontos; o título original fica anotado.
 */
export function nomeDoConjunto(e: Pick<EntradaDados, "titulo">, integracoes: readonly Pick<ConjuntoIntegrado, "titulo">[] = []): NomeDoConjunto {
  const fonte = e.titulo.trim();
  let nome = fonte;
  let motivo: NomeDoConjunto["motivo"] = null;
  if (eTituloTecnico(fonte)) {
    const legivel = integracoes.map((i) => i.titulo.trim()).find((t) => t && !eTituloTecnico(t));
    nome = legivel ?? NOME_DO_CONJUNTO_TECNICO[fonte] ?? humaniza(fonte);
    motivo = "identificador";
  }
  const semNomeTecnico = nome.replace(NOME_TECNICO_NO_TITULO, "");
  if (semNomeTecnico !== nome) {
    nome = semNomeTecnico;
    motivo ??= "nome tecnico";
  }
  const semTravessao = nome.replace(/\s[\u2013\u2014]\s/g, ": ");
  if (semTravessao !== nome) {
    nome = semTravessao;
    motivo ??= "separador";
  }
  const corrigido = corrigeGrafia(nome);
  if (corrigido !== nome) {
    nome = corrigido;
    motivo ??= "grafia";
  }
  return { nome, tituloNaFonte: nome !== fonte ? fonte : null, motivo: nome !== fonte ? motivo : null };
}

/* ---------------------------------------------------------------- abertura */

/**
 * Frase completa da abertura, montada só com o que o catálogo tem: o órgão, a frequência que a fonte declara (ou a falta
 * dela) e as páginas do observatório que usam o conjunto.
 */
export function fraseAbertura(a: { orgao: string; cadencias: readonly string[] | null | undefined; paginas: readonly { rotulo: string }[] }): string {
  const frequencia = fraseFrequencia(a.cadencias) ?? "A fonte não declara a frequência de atualização.";
  const rotulos = a.paginas.map((p) => p.rotulo);
  const onde = rotulos.length ? ` O observatório usa o conjunto ${rotulos.length === 1 ? "na página" : "nas páginas"} ${listaEmPortugues(rotulos)}.` : "";
  return `Este é um conjunto de dados abertos publicado ${pelo(a.orgao)} ${a.orgao}. ${frequencia}${onde}`;
}

/* ---------------------------------------------------------------- situação dos dados: o critério */

const ADJETIVO_CADENCIA: Record<Cadencia, string> = {
  diaria: "diária",
  semanal: "semanal",
  quinzenal: "quinzenal",
  mensal: "mensal",
  trimestral: "trimestral",
  anual: "anual",
};

type FatiaIntegracao = Pick<ConjuntoIntegrado, "atualidade" | "capturas" | "frequencia" | "dado">;
type RegrasPrazo = Record<Cadencia, { tolerancia_dias: number }>;

/** Data (dd/mm/aaaa) no horário de Brasília de um instante em UTC. */
const diaEmBrasilia = (iso: string): string => carimbo(iso).slice(0, 10);

/** Referência registrada para os dados quando o conjunto não tem último período (ano ou intervalo de uma pesquisa). */
function referenciaRegistrada(c: FatiaIntegracao): string | null {
  const d = c.dado;
  if (!d?.ref_max) return null;
  return d.ref_min && d.ref_min !== d.ref_max ? `de ${refLegivel(d.ref_min)} a ${refLegivel(d.ref_max)}` : refLegivel(d.ref_max);
}

/**
 * O critério da situação em palavras simples: qual é o prazo, de onde ele parte e a que data os dias além do prazo se
 * contam. Lê os campos de atualidade que o pipeline publica (caso, base, cadência, tolerância, prazo, dias de atraso) e a
 * regra de tolerância da própria publicação; não recalcula prazo nem atraso. Vazio quando não há o que acrescentar.
 */
export function criterioDaSituacao(c: FatiaIntegracao, sla: RegrasPrazo, hoje: string): string {
  const a = c.atualidade;
  const cad = a.cadencia ?? c.frequencia.cadencias[0];
  const adj = cad ? ADJETIVO_CADENCIA[cad] : null;
  const ref = referenciaRegistrada(c);

  if (a.situacao === "SEM SLA") {
    const referencia = !a.ultimo_periodo && ref ? ` Os dados se referem a ${ref}.` : "";
    return `Isso não indica se o dado está ou não desatualizado.${referencia}`;
  }

  if (a.situacao === "SEM DADO") {
    if (!adj) return "";
    const unica = ref ? ` registrada (${ref})` : "";
    return `A fonte declara atualização ${adj}, mas o conjunto tem uma única referência${unica} e não forma uma série que se renove no tempo.`;
  }

  const tol = a.cadencia ? sla[a.cadencia]?.tolerancia_dias : undefined;
  const prazo = a.prazo_proximo ? dataBR(a.prazo_proximo) : null;
  if (!prazo || tol === undefined) return "";

  const partes: string[] = [];

  if (a.base === "publicacao_da_fonte") {
    const publicada = c.capturas.ultima_publicacao_fonte ? diaEmBrasilia(c.capturas.ultima_publicacao_fonte) : null;
    const grao = c.dado?.granularidade ?? "";
    if (a.caso === "E") partes.push(`A fonte declara atualização ${adj ?? "frequente"}, mais frequente que o período dos próprios dados (${grao || "sem período regular"}).`);
    else if (/^cadastro/.test(grao)) partes.push("A lista não traz um período de referência.");
    else partes.push("O conjunto não tem série regular de referência.");
    partes.push(
      `O prazo parte da data da última publicação informada pela fonte${publicada ? ` (${publicada})` : ""}, mais um período ${adj ?? "da frequência declarada"} e ${plural(tol, "dia", "dias")} de tolerância: ${prazo}.`,
    );
  } else {
    const ultimo = a.ultimo_periodo ? refLegivel(a.ultimo_periodo) : null;
    if (a.caso === "B") {
      partes.push(
        `O dado sai em lotes: a próxima remessa deve chegar até o fim do último período disponível${ultimo ? ` (${ultimo})` : ""} mais um período ${adj ?? "da frequência declarada"} e ${plural(tol, "dia", "dias")} de tolerância: ${prazo}.`,
      );
    } else {
      partes.push(
        `O período seguinte ao último disponível${ultimo ? ` (${ultimo})` : ""} deve chegar até ${plural(tol, "dia", "dias")}${adj ? ` (a tolerância para atualização ${adj})` : ""} depois do seu próprio fim: ${prazo}.`,
      );
    }
  }
  if (a.periodo_parcial) partes.push("O último período ainda não terminou e não alonga o prazo, que parte do último período completo.");
  if (a.publicacao_nao_acompanha_conteudo) partes.push("A data de modificação informada pela fonte é anterior ao período mais recente do próprio arquivo, por isso vale o fim do último período completo.");

  const dHoje = dataBR(hoje);
  if (a.situacao === "ATRASADO") {
    partes.push(`Esse prazo venceu em ${prazo}; os ${plural(a.dias_atraso ?? 0, "dia", "dias")} além do prazo contam dessa data até ${dHoje}, a data de referência desta publicação.`);
  } else {
    partes.push(`Em ${dHoje}, a data de referência desta publicação, esse prazo ainda não tinha vencido.`);
  }
  return partes.join(" ");
}

/* ---------------------------------------------------------------- data de referência do conjunto */

/**
 * O que o conjunto diz sobre a data a que os dados se referem. Último período quando há; a referência única de uma pesquisa;
 * a data da publicação pela fonte quando o conjunto é um cadastro. Período que ainda estava em curso na última captura
 * diz por que já existe.
 */
export function fraseReferencia(c: FatiaIntegracao | null | undefined, haIntegracao = true): string {
  if (!c) return haIntegracao ? "sem período registrado para este conjunto" : "conjunto sem integração: sem período medido";
  const a = c.atualidade;
  if (a.ultimo_periodo) {
    const base = `último período disponível ${refLegivel(a.ultimo_periodo)}`;
    const captura = c.capturas.ultima ? diaEmBrasilia(c.capturas.ultima) : null;
    const emCurso = !!(a.fim_ultimo_periodo && captura && captura.split("/").reverse().join("-") <= a.fim_ultimo_periodo);
    if (emCurso && c.capturas.ultima_publicacao_fonte) {
      return `${base}. Esse período ainda não tinha terminado na última captura (${captura}): a fonte já o havia publicado em ${diaEmBrasilia(c.capturas.ultima_publicacao_fonte)}.`;
    }
    return base;
  }
  const ref = referenciaRegistrada(c);
  if (c.dado?.formato === "nao_temporal" && ref) return `uma única referência, ${ref}: o conjunto não é uma série no tempo`;
  if (/^cadastro/.test(c.dado?.granularidade ?? "")) {
    return c.capturas.ultima_publicacao_fonte
      ? `sem período de referência: a lista não traz um período a que se refira; vale a data em que a fonte a publicou (${diaEmBrasilia(c.capturas.ultima_publicacao_fonte)})`
      : "sem período de referência: a lista não traz um período a que se refira";
  }
  return "sem período registrado para este conjunto";
}

/* ---------------------------------------------------------------- mudanças metodológicas depois do último período */

/** Mudança metodológica posterior ao último período disponível: os dados disponíveis ainda não refletem essa mudança. */
export function notasDeQuebraPosterior(quebras: readonly { data: string; descricao: string }[], c: Pick<ConjuntoIntegrado, "atualidade">): string[] {
  const fim = c.atualidade.fim_ultimo_periodo;
  if (!fim || !c.atualidade.ultimo_periodo) return [];
  return quebras
    .filter((q) => q.data > fim)
    .map((q) => `A mudança de ${dataBR(q.data)} (${q.descricao.replace(/[.\s]+$/, "")}) é posterior ao último período disponível, ${refLegivel(c.atualidade.ultimo_periodo!)}: os dados disponíveis ainda não refletem essa mudança.`);
}

/* ---------------------------------------------------------------- página oficial */

/** O endereço é só a página inicial do portal (sem caminho): não leva ao conjunto. */
/** "do" ou "da" antes do nome do órgão ("do IBGE", "da ANEEL"). */
export const doOrgao = (orgao: string): "do" | "da" => (pelo(orgao) === "pelo" ? "do" : "da");

/**
 * Texto do link para a página oficial: o que o endereço é (a página do conjunto, o arquivo oficial ou só a página inicial do
 * portal), no lugar do endereço cru; o endereço fica em Analisar.
 */
export function rotuloDoLinkOficial(url: string | null | undefined, orgao: string): string {
  const ext = extensaoDoEndereco(url);
  if (ext && ext !== "html" && ext !== "htm") return `Abrir o arquivo oficial (.${ext}) no site ${doOrgao(orgao)} ${orgao}`;
  if (eApenasPaginaInicial(url)) return `Abrir a página inicial do portal ${doOrgao(orgao)} ${orgao}`;
  return `Abrir a página do conjunto no portal ${doOrgao(orgao)} ${orgao}`;
}

export function eApenasPaginaInicial(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash;
  } catch {
    return false;
  }
}

/** Extensão de arquivo no fim do endereço oficial (".zip"), quando há. */
export function extensaoDoEndereco(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return /\.([a-z0-9]{2,5})$/i.exec(new URL(url).pathname)?.[1].toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Formatos publicados: os que o catálogo traz; sem eles, diz que o catálogo não informa e o que o endereço oficial mostra. */
export function fraseFormatos(formatos: readonly string[] | null | undefined, urlOficial: string | null | undefined): string {
  if (formatos?.length) return formatos.join(", ");
  const ext = extensaoDoEndereco(urlOficial);
  return ext ? `não informados no catálogo; o endereço oficial é um arquivo .${ext}` : "não informados no catálogo";
}

/* ---------------------------------------------------------------- licença */

export const NOME_ODBL = "Open Data Commons Open Database License (ODbL)";

/** Nomes de uma mesma licença que os portais escrevem de jeitos diferentes, reunidos no nome que o portal da ANEEL usa. */
const NOMES_DA_MESMA_LICENCA: readonly (readonly [RegExp, string])[] = [
  [/Licença Aberta para Bases de Dados \(ODbL\) do Open Data Commons/g, NOME_ODBL],
  [/^Creative Commons Attribution$/, "Creative Commons Atribuição"],
];

export type LicencaDoLeitor = {
  /** O nome da licença, o mesmo em todas as páginas. */
  nome: string;
  /** Observação de coleta, sem jargão. */
  nota: string | null;
  /** Base legal citada entre parênteses no texto do catálogo (Lei nº ...). */
  baseLegal: string | null;
};

/**
 * Licença escrita para o leitor. O nome da licença é um só para a mesma licença (a ODbL aparece com três grafias no
 * catálogo); a base legal em parênteses sai do nome e vai para a observação; a observação de coleta troca o jargão
 * ("desafio de navegador", "integração") pelo que aconteceu.
 */
export function licencaDoLeitor(bruta: string): LicencaDoLeitor {
  const p = partirLicenca(bruta);
  let nome = NOMES_DA_MESMA_LICENCA.reduce((s, [re, certo]) => s.replace(re, certo), p.curta.trim());
  let baseLegal: string | null = null;
  const lei = /\s*\((Lei [^)]*)\)/.exec(nome);
  if (lei) {
    baseLegal = lei[1];
    nome = nome.replace(lei[0], "");
  }
  nome = nome.replace(/\s+,/g, ",").replace(/\.$/, "").trim();
  const nota = p.nota
    ? p.nota
        .replace(/respondeu com desafio de navegador/g, "recusou a consulta automática do observatório")
        .replace(/e não foi relida nesta integração/g, "e não foi relida ao integrar este conjunto")
        .replace(/não foi relida nesta integração/g, "não foi relida ao integrar este conjunto")
    : null;
  return { nome, nota, baseLegal };
}

/** A licença como entra na citação: o nome curto. Texto jurídico longo vira "domínio público"; o resto, até o primeiro ponto e vírgula ou dois-pontos. */
export function licencaParaCitacao(nome: string): string {
  if (/domínio público/i.test(nome)) return "domínio público";
  if (nome.length <= 90) return nome;
  return nome.split(/[:;]/)[0].trim();
}

/* ---------------------------------------------------------------- arquivos para baixar */

/**
 * Nome legível dos arquivos que as fichas oferecem e cujo nome não repete o título do conjunto. Cada nome é a descrição
 * que o dicionário de arquivos (arquivos.json) dá ao próprio arquivo, em poucas palavras.
 */
export const ROTULO_DO_ARQUIVO: Record<string, string> = {
  "/energia/series/empresas_ativos.csv": "Usinas e proprietários do SIGA",
  "/energia/series/regulacao_consultas.csv": "Consultas e audiências públicas reconstituídas das atas da Diretoria",
  "/energia/series/regulacao_limites_pld_atos.csv": "Atos que fixam os limites do PLD (piso e tetos), com a vigência de cada um",
  "/energia/series/inclusao_tsee_distribuidoras.csv": "Tarifa Social por distribuidora e por mês",
  "/energia/series/inclusao_tsee_mensal.csv": "Tarifa Social por mês, total das distribuidoras",
  "/energia/series/inclusao_pof.csv": "Medidas da POF 2017-2018 por território e classe de rendimento",
  "/energia/series/agua_ear_recortes_diario.csv": "EAR e ENA diárias por reservatório equivalente e por bacia",
  "/energia/series/agua_ear_recortes_mensal.csv": "EAR no último dia do mês e ENA mensal, por reservatório equivalente e por bacia",
  "/energia/series/mercado_ccee_mensal.csv": "Séries mensais dos conjuntos abertos da CCEE",
  "/energia/series/carga_calendario.csv": "Calendário de feriados nacionais, Paixão e pontos facultativos, de 2003 a 2027",
};

/** Nome do arquivo no fim do endereço. */
export const nomeDoArquivo = (url: string): string => url.split("/").pop() ?? url;

const FORMATO_DO_ARQUIVO: Record<string, string> = { csv: "CSV", json: "JSON", parquet: "Parquet", geojson: "GeoJSON" };

export function formatoDoArquivo(url: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(nomeDoArquivo(url))?.[1].toLowerCase() ?? "";
  return FORMATO_DO_ARQUIVO[ext] ?? ext.toUpperCase();
}

/**
 * Nome legível de um arquivo: o da tabela acima; senão a descrição que o dicionário dá antes da lista de colunas, quando ele
 * a traz ("Mudanças da MLT por usina. Colunas: ..."); senão o nome do arquivo sem extensão e sem sublinhados.
 */
export function rotuloDoArquivo(url: string, dicionario?: string | null): string {
  const dado = ROTULO_DO_ARQUIVO[url];
  if (dado) return dado;
  const antes = /^([^:;]{10,140}?)\.\s+Colunas:/.exec(dicionario ?? "")?.[1];
  if (antes) return antes.charAt(0).toUpperCase() + antes.slice(1);
  const t = nomeDoArquivo(url).replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}


/* ---------------------------------------------------------------- descrição guardada */

export type DescricaoParaAnalisar = {
  texto: string | null;
  /** De onde vem o texto: o catálogo compacto da ficha, a íntegra publicada em dados_catalogo.csv ou nenhuma. */
  origem: "catalogo" | "csv" | "nenhuma";
  /** O texto mostrado termina cortado (reticências): a íntegra não está disponível. */
  cortada: boolean;
};

/**
 * Descrição do conjunto para o nível Analisar. O catálogo compacto guarda só o começo (cortado em reticências); a íntegra
 * está publicada em dados_catalogo.csv. A íntegra só vale se começa exatamente pelo texto guardado: sem isso, o texto
 * guardado fica como está, com o corte declarado. Nada é buscado na fonte.
 */
export function escolheDescricao(guardada: string | null | undefined, doCsv: string | null | undefined): DescricaoParaAnalisar {
  const g = (guardada ?? "").trim();
  const c = (doCsv ?? "").trim();
  if (!g) return c ? { texto: c, origem: "csv", cortada: c.endsWith("…") } : { texto: null, origem: "nenhuma", cortada: false };
  if (!g.endsWith("…")) return { texto: g, origem: "catalogo", cortada: false };
  const inicio = g.slice(0, -1);
  if (c && c.length > inicio.length && c.startsWith(inicio)) return { texto: c, origem: "csv", cortada: c.endsWith("…") };
  return { texto: g, origem: "catalogo", cortada: true };
}
