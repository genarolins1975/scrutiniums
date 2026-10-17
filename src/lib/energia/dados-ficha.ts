import { carimbo, dataBR, plural } from "./formato";
import { tx } from "./idioma";
import { fraseFrequencia, listaEmPortugues, partirLicenca, pelo, refLegivel, type ContextoCatalogo } from "./dados";
import type { Cadencia, CatalogoDados, ConjuntoIntegrado, EntradaDados, PublicacaoGold } from "./tipos-dados";

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
  PLD_HORARIO: "PLD horário", // i18n: dado (nome próprio do conjunto, exibido marcado como nome)
};

/**
 * Grafias da fonte que o observatório corrige na exibição. O título original continua na ficha, em Analisar, e na
 * citação em Auditar, como a fonte o publica.
 */
const CORRECOES_DE_GRAFIA: readonly (readonly [RegExp, string])[] = [[/\bPublicas\b/g, "Públicas"]]; // i18n: dado

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

/**
 * Troca, num texto escrito pelo observatório, o identificador técnico de um conjunto da CCEE ("CONSUMO_CLASSE_AGENTE") pelo nome
 * que a ficha dele usa. Identificador sem nome conhecido fica como está.
 */
export function trocaIdentificadores(texto: string, nomes: ReadonlyMap<string, string>): string {
  return texto.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, (id) => nomes.get(id) ?? id);
}

/** Nome legível de cada conjunto cujo título é identificador técnico, pelo título da fonte. */
export function nomesLegiveisDosTitulos(
  entradas: readonly (Pick<EntradaDados, "titulo"> & { integracoes?: { id: string }[] })[],
  integracoes: readonly Pick<ConjuntoIntegrado, "id" | "titulo">[],
): Map<string, string> {
  const porId = new Map(integracoes.map((i) => [i.id, i]));
  const m = new Map<string, string>();
  for (const e of entradas) {
    if (!eTituloTecnico(e.titulo)) continue;
    m.set(e.titulo.trim(), nomeDoConjunto(e, (e.integracoes ?? []).map((i) => porId.get(i.id)).filter((x): x is Pick<ConjuntoIntegrado, "id" | "titulo"> => !!x)).nome);
  }
  return m;
}

/**
 * O que a lista do catálogo lê de fora do catálogo: o nome legível de cada conjunto (o mesmo que a ficha usa no título), o último período
 * dos dados da primeira integração (o mesmo que a ficha chama de data de referência) e as fichas que existem. Só leitura dos campos
 * publicados; conjunto sem integração fica sem período, nunca com um valor de reserva.
 */
export function contextoDoCatalogo(cat: Pick<CatalogoDados, "entradas">, pub: Pick<PublicacaoGold, "conjuntos"> | null, fichas: ReadonlySet<string>): ContextoCatalogo {
  const porId = new Map((pub?.conjuntos ?? []).map((c) => [c.id, c]));
  const nomes = new Map<string, string>();
  const periodos = new Map<string, string | null>();
  for (const e of cat.entradas) {
    const integ = (e.integracoes ?? []).map((i) => porId.get(i.id)).filter((c): c is ConjuntoIntegrado => !!c);
    nomes.set(e.id, nomeDoConjunto(e, integ).nome);
    periodos.set(e.id, integ[0]?.atualidade.ultimo_periodo ?? null);
  }
  return { nomes, periodos, fichas };
}

/**
 * A ficha de cada fonte que uma regra de indicador cita. A regra escreve a fonte pelo identificador interno do módulo ("ear_subsistema_di"):
 * a entrada do catálogo a que ele corresponde é a que tem esse identificador interno ou, quando não há, a que tem uma integração cujo
 * identificador termina nele ("aneel_distribuicao/aneel_continuidade_limites"). Fonte sem entrada no catálogo, ou cuja entrada não tem
 * ficha, fica fora do mapa: a regra diz que ela não tem ficha própria, em vez de inventar um nome.
 */
export function fichasDasFontes(
  fontes: readonly string[],
  cat: Pick<CatalogoDados, "entradas">,
  pub: Pick<PublicacaoGold, "conjuntos"> | null,
  fichas: ReadonlySet<string>,
): Record<string, { slug: string; nome: string }> {
  const porInterno = new Map<string, EntradaDados>();
  const porIntegracao = new Map<string, EntradaDados>();
  cat.entradas.forEach((e) => {
    if (e.interno && !porInterno.has(e.interno)) porInterno.set(e.interno, e);
    (e.integracoes ?? []).forEach((i) => {
      const fim = i.id.split("/").pop() ?? i.id;
      if (!porIntegracao.has(fim)) porIntegracao.set(fim, e);
    });
  });
  const nomes = contextoDoCatalogo(cat, pub, fichas).nomes ?? new Map<string, string>();
  const out: Record<string, { slug: string; nome: string }> = {};
  fontes.forEach((f) => {
    const e = porInterno.get(f) ?? porIntegracao.get(f);
    if (e?.slug && fichas.has(e.slug)) out[f] = { slug: e.slug, nome: nomes.get(e.id) ?? e.titulo };
  });
  return out;
}

/* ---------------------------------------------------------------- abertura */

/**
 * Frase completa da abertura, montada só com o que o catálogo tem: o órgão, a frequência que a fonte declara (ou a falta
 * dela) e as páginas do observatório que usam o conjunto.
 */
export function fraseAbertura(a: { orgao: string; cadencias: readonly string[] | null | undefined; paginas: readonly { rotulo: string }[] }): string {
  const frequencia = fraseFrequencia(a.cadencias) ?? tx("A fonte não declara a frequência de atualização.", "The source does not declare its update frequency.");
  const rotulos = a.paginas.map((p) => p.rotulo);
  const onde = rotulos.length
    ? tx(
        ` O observatório usa o conjunto ${rotulos.length === 1 ? "na página" : "nas páginas"} ${listaEmPortugues(rotulos)}.`,
        ` The observatory uses the dataset on the ${rotulos.length === 1 ? "page" : "pages"} ${listaEmPortugues(rotulos)}.`,
      )
    : "";
  return tx(
    `Este é um conjunto de dados abertos publicado ${pelo(a.orgao)} ${a.orgao}. ${frequencia}${onde}`,
    `This is an open dataset published by ${a.orgao}. ${frequencia}${onde}`,
  );
}

/* ---------------------------------------------------------------- situação dos dados: o critério */

const adjetivosCadencia = (): Record<Cadencia, string> =>
  tx(
    { diaria: "diária", semanal: "semanal", quinzenal: "quinzenal", mensal: "mensal", trimestral: "trimestral", anual: "anual" },
    { diaria: "daily", semanal: "weekly", quinzenal: "fortnightly", mensal: "monthly", trimestral: "quarterly", anual: "annual" },
  );

type FatiaIntegracao = Pick<ConjuntoIntegrado, "atualidade" | "capturas" | "frequencia" | "dado">;
type RegrasPrazo = Record<Cadencia, { tolerancia_dias: number }>;

/** Data (dd/mm/aaaa) no horário de Brasília de um instante em UTC. */
export const diaEmBrasilia = (iso: string): string => dataBR(carimbo(iso, "pt").slice(0, 10).split("/").reverse().join("-"));

/** Referência registrada para os dados quando o conjunto não tem último período (ano ou intervalo de uma pesquisa). */
function referenciaRegistrada(c: FatiaIntegracao): string | null {
  const d = c.dado;
  if (!d?.ref_max) return null;
  return d.ref_min && d.ref_min !== d.ref_max
    ? tx(`de ${refLegivel(d.ref_min)} a ${refLegivel(d.ref_max)}`, `from ${refLegivel(d.ref_min)} to ${refLegivel(d.ref_max)}`)
    : refLegivel(d.ref_max);
}

/**
 * O critério da situação em palavras simples: qual é o prazo, de onde ele parte e a que data os dias além do prazo se
 * contam. Lê os campos de atualidade que o pipeline publica (caso, base, cadência, tolerância, prazo, dias de atraso) e a
 * regra de tolerância da própria publicação; não recalcula prazo nem atraso. Vazio quando não há o que acrescentar.
 */
export function criterioDaSituacao(c: FatiaIntegracao, sla: RegrasPrazo, hoje: string): string {
  const a = c.atualidade;
  const cad = a.cadencia ?? c.frequencia.cadencias[0];
  const adj = cad ? adjetivosCadencia()[cad] : null;
  const ref = referenciaRegistrada(c);

  if (a.situacao === "SEM SLA") {
    const referencia = !a.ultimo_periodo && ref ? tx(` Os dados se referem a ${ref}.`, ` The data refer to ${ref}.`) : "";
    return tx(`Isso não indica se o dado está ou não desatualizado.${referencia}`, `This does not show whether the data are out of date or not.${referencia}`);
  }

  if (a.situacao === "SEM DADO") {
    if (!adj) return "";
    const unica = ref ? tx(` registrada (${ref})`, ` recorded (${ref})`) : "";
    return tx(
      `A fonte declara atualização ${adj}, mas o conjunto tem uma única referência${unica} e não forma uma série que se renove no tempo.`,
      `The source declares ${adj} updates, but the dataset has a single reference${unica} and does not form a series that renews over time.`,
    );
  }

  const tol = a.cadencia ? sla[a.cadencia]?.tolerancia_dias : undefined;
  const prazo = a.prazo_proximo ? dataBR(a.prazo_proximo) : null;
  if (!prazo || tol === undefined) return "";

  const partes: string[] = [];

  if (a.base === "publicacao_da_fonte") {
    const publicada = c.capturas.ultima_publicacao_fonte ? diaEmBrasilia(c.capturas.ultima_publicacao_fonte) : null;
    const grao = c.dado?.granularidade ?? "";
    const grao_ = grao ? tx(grao, ({ "cadência irregular": "irregular cadence" } as Record<string, string>)[grao] ?? grao) : tx("sem período regular", "no regular period");
    if (a.caso === "E")
      partes.push(
        tx(
          `A fonte declara atualização ${adj ?? "frequente"}, mais frequente que o período dos próprios dados (${grao_}).`,
          `The source declares ${adj ?? "frequent"} updates, more frequent than the period of the data itself (${grao_}).`,
        ),
      );
    else if (/^cadastro/.test(grao)) partes.push(tx("A lista não traz um período de referência.", "The list carries no reference period."));
    else partes.push(tx("O conjunto não tem série regular de referência.", "The dataset has no regular reference series."));
    partes.push(
      tx(
        `O prazo parte da data da última publicação informada pela fonte${publicada ? ` (${publicada})` : ""}, mais um período ${adj ?? "da frequência declarada"} e ${plural(tol, "dia", "dias")} de tolerância: ${prazo}.`,
        `The deadline starts from the date of the latest publication reported by the source${publicada ? ` (${publicada})` : ""}, plus one ${adj ?? "declared-frequency"} period and ${plural(tol, "day", "days")} of tolerance: ${prazo}.`,
      ),
    );
  } else {
    const ultimo = a.ultimo_periodo ? refLegivel(a.ultimo_periodo) : null;
    if (a.caso === "B") {
      partes.push(
        tx(
          `O dado sai em lotes: a próxima remessa deve chegar até o fim do último período disponível${ultimo ? ` (${ultimo})` : ""} mais um período ${adj ?? "da frequência declarada"} e ${plural(tol, "dia", "dias")} de tolerância: ${prazo}.`,
          `The data come out in batches: the next batch should arrive by the end of the latest period available${ultimo ? ` (${ultimo})` : ""} plus one ${adj ?? "declared-frequency"} period and ${plural(tol, "day", "days")} of tolerance: ${prazo}.`,
        ),
      );
    } else {
      partes.push(
        tx(
          `O período seguinte ao último disponível${ultimo ? ` (${ultimo})` : ""} deve chegar até ${plural(tol, "dia", "dias")}${adj ? ` (a tolerância para atualização ${adj})` : ""} depois do seu próprio fim: ${prazo}.`,
          `The period after the latest one available${ultimo ? ` (${ultimo})` : ""} should arrive within ${plural(tol, "day", "days")}${adj ? ` (the tolerance for ${adj} updates)` : ""} after its own end: ${prazo}.`,
        ),
      );
    }
  }
  if (a.periodo_parcial)
    partes.push(tx("O último período ainda não terminou e não alonga o prazo, que parte do último período completo.", "The latest period has not ended yet and does not extend the deadline, which starts from the latest complete period."));
  if (a.publicacao_nao_acompanha_conteudo)
    partes.push(
      tx(
        "A data de modificação informada pela fonte é anterior ao período mais recente do próprio arquivo, por isso vale o fim do último período completo.",
        "The modification date reported by the source is earlier than the most recent period in the file itself, so the end of the latest complete period applies.",
      ),
    );

  const dHoje = dataBR(hoje);
  if (a.situacao === "ATRASADO") {
    partes.push(
      tx(
        `Esse prazo venceu em ${prazo}; os ${plural(a.dias_atraso ?? 0, "dia", "dias")} além do prazo contam dessa data até ${dHoje}, a data de referência desta publicação.`,
        `This deadline expired on ${prazo}; the ${plural(a.dias_atraso ?? 0, "day", "days")} past the deadline count from that date to ${dHoje}, the reference date of this publication.`,
      ),
    );
  } else {
    partes.push(tx(`Em ${dHoje}, a data de referência desta publicação, esse prazo ainda não tinha vencido.`, `On ${dHoje}, the reference date of this publication, this deadline had not yet expired.`));
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
  const semPeriodo = tx("sem período registrado para este conjunto", "no period recorded for this dataset");
  if (!c) return haIntegracao ? semPeriodo : tx("conjunto sem integração: sem período medido", "dataset without integration: no period measured");
  const a = c.atualidade;
  if (a.ultimo_periodo) {
    const base = tx(`último período disponível ${refLegivel(a.ultimo_periodo)}`, `latest period available ${refLegivel(a.ultimo_periodo)}`);
    // a conta compara o dia da captura em dd/mm/aaaa (carimbo português), qualquer que seja o idioma da página
    const capturaPt = c.capturas.ultima ? carimbo(c.capturas.ultima, "pt").slice(0, 10) : null;
    const captura = c.capturas.ultima ? diaEmBrasilia(c.capturas.ultima) : null;
    const emCurso = !!(a.fim_ultimo_periodo && capturaPt && capturaPt.split("/").reverse().join("-") <= a.fim_ultimo_periodo);
    if (emCurso && c.capturas.ultima_publicacao_fonte) {
      return tx(
        `${base}. Esse período ainda não tinha terminado na última captura (${captura}): a fonte já o havia publicado em ${diaEmBrasilia(c.capturas.ultima_publicacao_fonte)}.`,
        `${base}. This period had not yet ended at the latest capture (${captura}): the source had already published it on ${diaEmBrasilia(c.capturas.ultima_publicacao_fonte)}.`,
      );
    }
    return base;
  }
  const ref = referenciaRegistrada(c);
  if (c.dado?.formato === "nao_temporal" && ref) return tx(`uma única referência, ${ref}: o conjunto não é uma série no tempo`, `a single reference, ${ref}: the dataset is not a time series`);
  if (/^cadastro/.test(c.dado?.granularidade ?? "")) {
    return c.capturas.ultima_publicacao_fonte
      ? tx(
          `sem período de referência: a lista não traz um período a que se refira; vale a data em que a fonte a publicou (${diaEmBrasilia(c.capturas.ultima_publicacao_fonte)})`,
          `no reference period: the list carries no period it refers to; the date the source published it applies (${diaEmBrasilia(c.capturas.ultima_publicacao_fonte)})`,
        )
      : tx("sem período de referência: a lista não traz um período a que se refira", "no reference period: the list carries no period it refers to");
  }
  return semPeriodo;
}

/* ---------------------------------------------------------------- mudanças metodológicas depois do último período */

/** As mudanças metodológicas posteriores ao último período disponível, com a descrição sem o ponto final e o último período legível. */
export function quebrasPosteriores(
  quebras: readonly { data: string; descricao: string }[],
  c: Pick<ConjuntoIntegrado, "atualidade">,
): { data: string; descricao: string; ultimo: string }[] {
  const fim = c.atualidade.fim_ultimo_periodo;
  if (!fim || !c.atualidade.ultimo_periodo) return [];
  const ultimo = refLegivel(c.atualidade.ultimo_periodo);
  return quebras.filter((q) => q.data > fim).map((q) => ({ data: q.data, descricao: q.descricao.replace(/[.\s]+$/, ""), ultimo }));
}

/** Mudança metodológica posterior ao último período disponível: os dados disponíveis ainda não refletem essa mudança. */
export function notasDeQuebraPosterior(quebras: readonly { data: string; descricao: string }[], c: Pick<ConjuntoIntegrado, "atualidade">): string[] {
  const fim = c.atualidade.fim_ultimo_periodo;
  if (!fim || !c.atualidade.ultimo_periodo) return [];
  return quebras
    .filter((q) => q.data > fim)
    .map((q) =>
      tx(
        `A mudança de ${dataBR(q.data)} (${q.descricao.replace(/[.\s]+$/, "")}) é posterior ao último período disponível, ${refLegivel(c.atualidade.ultimo_periodo!)}: os dados disponíveis ainda não refletem essa mudança.`,
        `The change of ${dataBR(q.data)} (${q.descricao.replace(/[.\s]+$/, "")}) is later than the latest period available, ${refLegivel(c.atualidade.ultimo_periodo!)}: the data available do not yet reflect this change.`,
      ),
    );
}

/* ---------------------------------------------------------------- página oficial */

/** O endereço é só a página inicial do portal (sem caminho): não leva ao conjunto. */
/** "do" ou "da" antes do nome do órgão ("do IBGE", "da ANEEL"). */
export const doOrgao = (orgao: string): "do" | "da" => (pelo(orgao) === "pelo" ? "do" : "da"); // i18n: dado

/**
 * Texto do link para a página oficial: o que o endereço é (a página do conjunto, o arquivo oficial ou só a página inicial do
 * portal), no lugar do endereço cru; o endereço fica em Analisar.
 */
export function rotuloDoLinkOficial(url: string | null | undefined, orgao: string): string {
  const ext = extensaoDoEndereco(url);
  if (ext && ext !== "html" && ext !== "htm") return tx(`Abrir o arquivo oficial (.${ext}) no site ${doOrgao(orgao)} ${orgao}`, `Open the official file (.${ext}) on the ${orgao} website`);
  if (eApenasPaginaInicial(url)) return tx(`Abrir a página inicial do portal ${doOrgao(orgao)} ${orgao}`, `Open the home page of the ${orgao} portal`);
  return tx(`Abrir a página do conjunto no portal ${doOrgao(orgao)} ${orgao}`, `Open the dataset page on the ${orgao} portal`);
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
  return ext
    ? tx(`não informados no catálogo; o endereço oficial é um arquivo .${ext}`, `not reported in the catalog; the official address is a .${ext} file`)
    : tx("não informados no catálogo", "not reported in the catalog");
}

/* ---------------------------------------------------------------- licença */

export const NOME_ODBL = "Open Data Commons Open Database License (ODbL)";

/** Nomes de uma mesma licença que os portais escrevem de jeitos diferentes, reunidos no nome que o portal da ANEEL usa. */
const NOMES_DA_MESMA_LICENCA: readonly (readonly [RegExp, string])[] = [
  [/Licença Aberta para Bases de Dados \(ODbL\) do Open Data Commons/g, NOME_ODBL],
  [/^Creative Commons Attribution$/, "Creative Commons Atribuição"], // i18n: dado (nome que o portal da ANEEL usa; a forma inglesa vem de LICENCA_EN)
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
        // i18n: dado (a nota é texto da fonte, mostrada em português marcado; só o jargão é trocado)
        .replace(/respondeu com desafio de navegador/g, "recusou a consulta automática do observatório")
        // i18n: dado
        .replace(/e não foi relida nesta integração/g, "e não foi relida ao integrar este conjunto")
        // i18n: dado
        .replace(/não foi relida nesta integração/g, "não foi relida ao integrar este conjunto")
    : null;
  return { nome, nota, baseLegal };
}

/** A licença como entra na citação: o nome curto. Texto jurídico longo vira "domínio público"; o resto, até o primeiro ponto e vírgula ou dois-pontos. */
export function licencaParaCitacao(nome: string): string {
  if (/domínio público/i.test(nome)) return tx("domínio público", "public domain");
  if (nome.length <= 90) return nome;
  return nome.split(/[:;]/)[0].trim();
}

/* ---------------------------------------------------------------- arquivos para baixar */

/**
 * Nome legível dos arquivos que as fichas oferecem e cujo nome não repete o título do conjunto. Cada nome é a descrição
 * que o dicionário de arquivos (arquivos.json) dá ao próprio arquivo, em poucas palavras.
 */
export const ROTULO_DO_ARQUIVO: Record<string, string> = {
  get "/energia/series/empresas_ativos.csv"() { return tx("Usinas e proprietários do SIGA", "Power plants and owners from SIGA"); },
  get "/energia/series/regulacao_consultas.csv"() { return tx("Consultas e audiências públicas reconstituídas das atas da Diretoria", "Public consultations and hearings reconstructed from the Board minutes"); },
  get "/energia/series/regulacao_limites_pld_atos.csv"() { return tx("Atos que fixam os limites do PLD (piso e tetos), com a vigência de cada um", "Acts that set the PLD limits (floor and ceilings), with the validity of each"); },
  get "/energia/series/inclusao_tsee_distribuidoras.csv"() { return tx("Tarifa Social por distribuidora e por mês", "Tarifa Social by distribution utility and by month"); },
  get "/energia/series/inclusao_tsee_mensal.csv"() { return tx("Tarifa Social por mês, total das distribuidoras", "Tarifa Social by month, total of the distribution utilities"); },
  get "/energia/series/inclusao_pof.csv"() { return tx("Medidas da POF 2017-2018 por território e classe de rendimento", "POF 2017-2018 measures by territory and income class"); },
  get "/energia/series/agua_ear_recortes_diario.csv"() { return tx("EAR e ENA diárias por reservatório equivalente e por bacia", "Daily EAR and ENA by equivalent reservoir and by basin"); },
  get "/energia/series/agua_ear_recortes_mensal.csv"() { return tx("EAR no último dia do mês e ENA mensal, por reservatório equivalente e por bacia", "EAR on the last day of the month and monthly ENA, by equivalent reservoir and by basin"); },
  get "/energia/series/mercado_ccee_mensal.csv"() { return tx("Séries mensais dos conjuntos abertos da CCEE", "Monthly series of the CCEE open datasets"); },
  get "/energia/series/carga_calendario.csv"() { return tx("Calendário de feriados nacionais, Paixão e pontos facultativos, de 2003 a 2027", "Calendar of national holidays, Good Friday and optional days off, from 2003 to 2027"); },
};

/** Nome do arquivo no fim do endereço. */
export const nomeDoArquivo = (url: string): string => url.split("/").pop() ?? url;

const FORMATO_DO_ARQUIVO: Record<string, string> = { csv: "CSV", json: "JSON", parquet: "Parquet", geojson: "GeoJSON" };

export function formatoDoArquivo(url: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(nomeDoArquivo(url))?.[1].toLowerCase() ?? "";
  return FORMATO_DO_ARQUIVO[ext] ?? ext.toUpperCase();
}

/** Descrição que o dicionário dá ao arquivo antes da lista de colunas ("Mudanças da MLT por usina"), em português; nula sem ela ou com rótulo próprio. */
export function descricaoDoArquivo(url: string, dicionario?: string | null): string | null {
  if (ROTULO_DO_ARQUIVO[url]) return null;
  const antes = /^([^:;]{10,140}?)\.\s+Colunas:/.exec(dicionario ?? "")?.[1]; // i18n: dado
  return antes ? antes.charAt(0).toUpperCase() + antes.slice(1) : null;
}

/**
 * Nome legível de um arquivo: o da tabela acima; senão a descrição que o dicionário dá antes da lista de colunas, quando ele
 * a traz ("Mudanças da MLT por usina. Colunas: ..."); senão o nome do arquivo sem extensão e sem sublinhados.
 */
export function rotuloDoArquivo(url: string, dicionario?: string | null): string {
  const dado = ROTULO_DO_ARQUIVO[url];
  if (dado) return dado;
  // em inglês, sem rótulo próprio, vale o nome técnico do arquivo (a descrição do dicionário e as palavras do nome são portuguesas)
  const tecnico = tx<string | null>(null, nomeDoArquivo(url).replace(/\.[a-z0-9]+$/i, ""));
  if (tecnico) return tecnico;
  const antes = /^([^:;]{10,140}?)\.\s+Colunas:/.exec(dicionario ?? "")?.[1];
  if (antes) return antes.charAt(0).toUpperCase() + antes.slice(1);
  const palavras = nomeDoArquivo(url).replace(/\.[a-z0-9]+$/i, "").split("_").map((w) => PALAVRA_DO_NOME[w.toLowerCase()] ?? w);
  const t = palavras.join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Palavras dos nomes de arquivo que o leitor lê em maiúsculas (siglas) ou com acento: o nome do arquivo os escreve sem acento e em minúsculas,
 * e a falta deles ("Regulacao limites pld") era o que a lista de arquivos mostrava quando nada descrevia o arquivo. O nome original continua
 * em Analisar; palavra fora da lista fica como está.
 */
const PALAVRA_DO_NOME: Record<string, string> = {
  // siglas
  pld: "PLD", cmo: "CMO", ear: "EAR", ena: "ENA", mlt: "MLT", cvu: "CVU", mmgd: "MMGD", cde: "CDE", tsee: "TSEE", ipca: "IPCA", uf: "UF", dgc: "DGC", ralie: "RALIE",
  siga: "SIGA", ccee: "CCEE", ons: "ONS", aneel: "ANEEL", cvm: "CVM", epe: "EPE", mme: "MME", mcti: "MCTI", pnad: "PNAD", pdo: "PDO", b1: "B1", bt: "BT", pde2035: "PDE 2035",
  brasil: "Brasil",
  // acentos
  agua: "água", reservatorios: "reservatórios", mudancas: "mudanças", horario: "horário", horaria: "horária", diario: "diário", diaria: "diária", geracao: "geração", // i18n: dado
  regulacao: "regulação", regulatorias: "regulatórias", expansao: "expansão", inclusao: "inclusão", transicao: "transição", composicao: "composição", conferencia: "conferência", // i18n: dado
  conferencias: "conferências", vigencias: "vigências", previsao: "previsão", previsoes: "previsões", reconciliacao: "reconciliação", liberacoes: "liberações", leiloes: "leilões", // i18n: dado
  trajetorias: "trajetórias", tecnicas: "técnicas", municipio: "município", municipios: "municípios", proprietarios: "proprietários", financas: "finanças", territorio: "território", // i18n: dado
  restricao: "restrição", interrupcoes: "interrupções", telefonico: "telefônico", historico: "histórico", serie: "série", series: "séries", emergencia: "emergência", // i18n: dado
  subsidios: "subsídios", tipico: "típico", balanco: "balanço", rotulos: "rótulos", areas: "áreas", catalogo: "catálogo", transmissao: "transmissão", societaria: "societária", // i18n: dado
  compensacoes: "compensações", distribuicao: "distribuição", utilizacao: "utilização", // i18n: dado
};


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
  if (!g) return c ? { texto: c, origem: "csv", cortada: c.endsWith("…") } : { texto: null, origem: "nenhuma", cortada: false }; // i18n: dado
  if (!g.endsWith("…")) return { texto: g, origem: "catalogo", cortada: false };
  const inicio = g.slice(0, -1);
  if (c && c.length > inicio.length && c.startsWith(inicio)) return { texto: c, origem: "csv", cortada: c.endsWith("…") };
  return { texto: g, origem: "catalogo", cortada: true };
}
