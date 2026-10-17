import { leitor } from "./bastidor";
import { carimbo, datasLegiveis, dataBR, num, plural } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import { listaEmPortugues, refLegivel, type ConferenciaManifesto, type ResumoCatalogo, type ResumoMetricas, type ResumoSaude } from "./dados";
import type { EstadoDoArquivo, VersaoDoCodigo } from "./dados-servidor";
import type { Afirmacao, CatalogoDados, ConjuntoIntegrado, DiaCalendario, ManifestoGold, PublicacaoGold } from "./tipos-dados";
import type { Idioma } from "@/lib/idioma";

/**
 * Textos de Entender das quatro páginas de Dados e Metodologia (rodada r8 de conteúdo): vereditos em duas camadas, o
 * bloco "O que mudou", a conciliação entre o catálogo e as integrações e as datas que as páginas mostram. Tudo é função
 * pura dos campos das golds (catalogo.json, publicacao.json, manifesto.json, metricas.json); número nenhum é digitado aqui.
 * As respostas completas (respostaCatalogo, respostaSaude, respostaReproducao, respostaRegras) seguem em dados.ts, intactas.
 *
 * Idioma: cada frase passa por tx(), no idioma da página. Texto escrito pela gold (ressalvas, limitações, afirmações) continua
 * em português; a página que o mostra em inglês o marca como trecho em português.
 */

/* ---------------------------------------------------------------- catálogo e integrações */

export type ConciliacaoIntegracoes = {
  /** Entradas do catálogo (conjuntos) e órgãos distintos entre elas. */
  conjuntos: number;
  orgaos: number;
  /** Conjuntos com ao menos uma integração, e quantos têm mais de uma. */
  conjuntosComIntegracao: number;
  conjuntosComVariasIntegracoes: number;
  conjuntosSemIntegracao: number;
  /** Integrações de publicacao.json (as que a página Saúde e o rodapé contam), e quantas reúnem mais de um conjunto. */
  integracoes: number;
  integracoesDeVariosConjuntos: number;
  /** Órgãos com ao menos uma integração, e os que só aparecem no catálogo. */
  orgaosComIntegracao: number;
  orgaosSoNoCatalogo: string[];
};

/**
 * Por que o catálogo conta 415 conjuntos de 18 órgãos e o rodapé e a Saúde contam 151 de 13: o catálogo conta
 * conjuntos (cada entrada das listagens e dos registros dos módulos); a publicação conta integrações (o uso de um conjunto
 * por um módulo). Um conjunto pode ter mais de uma, e uma integração pode reunir mais de um conjunto.
 */
export function conciliarCatalogoEIntegracoes(cat: Pick<CatalogoDados, "entradas">, pub: Pick<PublicacaoGold, "conjuntos">): ConciliacaoIntegracoes {
  const entradas = cat.entradas;
  const comIntegracao = entradas.filter((e) => (e.integracoes ?? []).length > 0);
  const porIntegracao = new Map<string, number>();
  for (const e of comIntegracao) for (const i of e.integracoes ?? []) porIntegracao.set(i.id, (porIntegracao.get(i.id) ?? 0) + 1);
  const orgaosCatalogo = new Set(entradas.map((e) => e.orgao));
  const orgaosPub = new Set(pub.conjuntos.map((c) => c.orgao));
  return {
    conjuntos: entradas.length,
    orgaos: orgaosCatalogo.size,
    conjuntosComIntegracao: comIntegracao.length,
    conjuntosComVariasIntegracoes: comIntegracao.filter((e) => (e.integracoes ?? []).length > 1).length,
    conjuntosSemIntegracao: entradas.length - comIntegracao.length,
    integracoes: pub.conjuntos.length,
    integracoesDeVariosConjuntos: Array.from(porIntegracao.values()).filter((n) => n > 1).length,
    orgaosComIntegracao: orgaosPub.size,
    orgaosSoNoCatalogo: Array.from(orgaosCatalogo).filter((o) => !orgaosPub.has(o)).sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

/** A explicação, em frases, para o catálogo e para a Saúde. */
export function textoConciliacao(c: ConciliacaoIntegracoes): string {
  const soCatalogo = c.orgaosSoNoCatalogo.length
    ? tx(
        ` ${plural(c.orgaosSoNoCatalogo.length, "órgão aparece", "órgãos aparecem")} só no catálogo: ${listaEmPortugues(c.orgaosSoNoCatalogo)}.`,
        ` ${plural(c.orgaosSoNoCatalogo.length, "body appears", "bodies appear")} only in the catalog: ${listaEmPortugues(c.orgaosSoNoCatalogo)}.`,
      )
    : "";
  return tx(
    `O catálogo conta conjuntos: ${num(c.conjuntos, 0)}, de ${num(c.orgaos, 0)} órgãos. A página Saúde e o rodapé do observatório contam integrações: ${num(c.integracoes, 0)}, de ${num(c.orgaosComIntegracao, 0)} órgãos. ` +
      `Integração é o uso de um conjunto por um módulo do observatório. ${num(c.conjuntosComIntegracao, 0)} conjuntos têm ao menos uma, ${num(c.conjuntosComVariasIntegracoes, 0)} têm mais de uma e ${num(c.integracoesDeVariosConjuntos, 0)} integrações reúnem mais de um conjunto. ` +
      `Os outros ${num(c.conjuntosSemIntegracao, 0)} conjuntos não têm integração.${soCatalogo}`,
    `The catalog counts datasets: ${num(c.conjuntos, 0)}, from ${num(c.orgaos, 0)} bodies. The Health page and the observatory footer count integrations: ${num(c.integracoes, 0)}, from ${num(c.orgaosComIntegracao, 0)} bodies. ` +
      `An integration is the use of a dataset by an observatory module. ${num(c.conjuntosComIntegracao, 0)} datasets have at least one, ${num(c.conjuntosComVariasIntegracoes, 0)} have more than one and ${num(c.integracoesDeVariosConjuntos, 0)} integrations combine more than one dataset. ` +
      `The other ${num(c.conjuntosSemIntegracao, 0)} datasets have no integration.${soCatalogo}`,
  );
}

/**
 * O que o rodapé do observatório precisaria dizer para não contar integrações como conjuntos. O rodapé é de outro agente: a
 * função só entrega o texto, lido dos mesmos campos.
 */
export function textoRodapeDasFontes(c: ConciliacaoIntegracoes, orgaos: readonly string[]): { resumo: string; detalhe: string } {
  return {
    resumo: tx(`${num(c.orgaosComIntegracao, 0)} órgãos, ${num(c.integracoes, 0)} integrações`, `${num(c.orgaosComIntegracao, 0)} bodies, ${num(c.integracoes, 0)} integrations`),
    detalhe: tx(
      `Dados abertos de ${listaEmPortugues([...orgaos])}, em ${num(c.integracoes, 0)} integrações de conjuntos (${num(c.conjuntosComIntegracao, 0)} dos ${num(c.conjuntos, 0)} conjuntos do catálogo). O catálogo traz ${num(c.orgaos, 0)} órgãos.`,
      `Open data from ${listaEmPortugues([...orgaos])}, in ${num(c.integracoes, 0)} dataset integrations (${num(c.conjuntosComIntegracao, 0)} of the ${num(c.conjuntos, 0)} datasets in the catalog). The catalog covers ${num(c.orgaos, 0)} bodies.`,
    ),
  };
}

/* ---------------------------------------------------------------- vereditos */

/** "SCS", de "SCS: Sistema de Controle de ... (Tarifa Social por distribuidora)": a sigla antes dos dois-pontos, ou o título até o parêntese. */
export function tituloCurto(t: string): string {
  const antes = t.split(": ")[0];
  if (antes !== t && antes.length <= 12) return antes;
  return t.replace(/\s*\(.*$/, "").trim();
}

/** P067: quantos conjuntos chegaram ao fim da escada, com o limite de leitura do estado "validado". */
export function vereditoCatalogo(r: Pick<ResumoCatalogo, "total" | "cumulativo">): string {
  const c = r.cumulativo;
  return tx(
    `Dos ${num(r.total, 0)} conjuntos catalogados, ${num(c.PUBLICADO, 0)} chegaram à última etapa: foram integrados, validados e alimentam uma base publicada. Validado quer dizer sem checagem reprovada; não atesta que o dado esteja atualizado.`,
    `Of the ${num(r.total, 0)} cataloged datasets, ${num(c.PUBLICADO, 0)} reached the last stage: they were integrated, validated and feed a published base. Validated means no failed check; it does not certify that the data are up to date.`,
  );
}

/** P068: quem estava atrasado na data de referência e se a fonte revisou valores, com o limite de leitura de "sem prazo". */
export function vereditoSaude(r: Pick<ResumoSaude, "hoje" | "atrasados" | "comRevisao">): string {
  const dh = dataBR(r.hoje);
  const atraso = (c: ConjuntoIntegrado) => c.atualidade.dias_atraso ?? 0;
  const semPrazo = tx("as sem prazo declarado não entram nessa conta", "those with no declared deadline are not counted");
  let a: string;
  if (r.atrasados.length === 0) a = tx(`Em ${dh}, nenhuma integração estava atrasada; ${semPrazo}.`, `On ${dh}, no integration was late; ${semPrazo}.`);
  else if (r.atrasados.length === 1)
    a = tx(
      `Em ${dh}, só uma integração estava atrasada: ${tituloCurto(r.atrasados[0].titulo)}, ${plural(atraso(r.atrasados[0]), "dia", "dias")} além do prazo; ${semPrazo}.`,
      `On ${dh}, only one integration was late: ${tituloCurto(r.atrasados[0].titulo)}, ${plural(atraso(r.atrasados[0]), "day", "days")} past the deadline; ${semPrazo}.`,
    );
  else
    a = tx(
      `Em ${dh}, ${num(r.atrasados.length, 0)} integrações estavam atrasadas, a maior com ${plural(Math.max(...r.atrasados.map(atraso)), "dia", "dias")} além do prazo; ${semPrazo}.`,
      `On ${dh}, ${num(r.atrasados.length, 0)} integrations were late, the largest by ${plural(Math.max(...r.atrasados.map(atraso)), "day", "days")} past the deadline; ${semPrazo}.`,
    );
  const rev = r.comRevisao.length
    ? tx(
        ` Em ${plural(r.comRevisao.length, "integração", "integrações")} a fonte revisou valores já publicados; uma revisão grande não prova erro.`,
        ` In ${plural(r.comRevisao.length, "integration", "integrations")} the source revised values already published; a large revision does not prove an error.`,
      )
    : tx(" Nenhuma revisão de valores já publicados foi detectada.", " No revision of values already published was detected.");
  return a + rev;
}

/** P069: se os arquivos publicados conferem com a lista de impressões digitais, com o limite de leitura da coleta. */
export function vereditoReproducao(m: Pick<ManifestoGold, "totais">, c: Pick<ConferenciaManifesto, "total" | "conferidos" | "divergentes" | "ausentes">): string {
  const limite = tx("Refazer o arquivo não refaz a coleta: ela depende de a fonte estar no ar.", "Rebuilding the file does not redo the collection: that depends on the source being online.");
  if (c.conferidos === c.total)
    return tx(
      `Sim. Cada um dos ${num(m.totais.arquivos, 0)} arquivos publicados tem a impressão digital registrada numa lista, e todos conferiram na construção desta página. ${limite}`,
      `Yes. Each of the ${num(m.totais.arquivos, 0)} published files has its fingerprint recorded in a list, and all of them matched when this page was built. ${limite}`,
    );
  return tx(
    `Em parte. De ${num(c.total, 0)} arquivos publicados, ${num(c.divergentes.length + c.ausentes.length, 0)} não conferiram com a lista de impressões digitais na construção desta página. ${limite}`,
    `In part. Of ${num(c.total, 0)} published files, ${num(c.divergentes.length + c.ausentes.length, 0)} did not match the fingerprint list when this page was built. ${limite}`,
  );
}

/** P070: a resposta a "quais interpretações são permitidas?" nos termos da própria página: as que a regra do indicador sustenta. */
export function vereditoRegras(r: Pick<ResumoMetricas, "total" | "comFormula">): string {
  return tx(
    `Só as que a regra de cada indicador sustenta. Os ${num(r.total, 0)} indicadores têm definição, unidade, recorte e limites escritos; ${num(r.comFormula, 0)} têm fórmula publicada.`,
    `Only those that each indicator's rule supports. The ${num(r.total, 0)} indicators have a written definition, unit, breakdown and limits; ${num(r.comFormula, 0)} have a published formula.`,
  );
}

/* ---------------------------------------------------------------- "O que mudou" */

/** P067: o que se sabe que mudou nas listagens das fontes e o que a página não compara. */
export function textoMudancaCatalogo(cat: Pick<CatalogoDados, "recursos">): string {
  const portais = Object.keys(cat.recursos);
  const removidos = Object.values(cat.recursos).reduce((s, x) => s + (x.removidos ?? 0), 0);
  const fontes = listaEmPortugues(portais);
  const arquivos =
    removidos === 0
      ? tx(`Nenhum arquivo sumiu das listagens de ${fontes} desde que o observatório as registra.`, `No file has disappeared from the ${fontes} listings since the observatory started recording them.`)
      : tx(
          `${plural(removidos, "arquivo sumiu", "arquivos sumiram")} das listagens de ${fontes} desde que o observatório as registra (lista em Analisar).`,
          `${plural(removidos, "file has", "files have")} disappeared from the ${fontes} listings since the observatory started recording them (list under Analyze).`,
        );
  return tx(
    `${arquivos} O catálogo guarda só a situação da última coleta, por isso esta página não compara as contagens com a publicação anterior.`,
    `${arquivos} The catalog keeps only the status of the latest collection, so this page does not compare the counts with the previous publication.`,
  );
}

/**
 * Aviso curto quando o maior salto troca o sinal do valor (de negativo para positivo). O observatório guarda as duas capturas como vieram; a
 * página não decide qual está certa, mas diz o que um valor negativo implica: carga, geração e preço não são negativos na fonte, então a
 * primeira captura pode ter vindo incompleta. Sem troca de sinal, não há aviso.
 */
export function avisoDeSinal(e: { de: number; para: number } | null | undefined): string | null {
  return e && e.de < 0 && e.para > 0
    ? tx(
        "O valor anterior é negativo: se a grandeza não pode ser negativa (carga, por exemplo), a primeira captura pode ter vindo incompleta; as duas continuam guardadas.",
        "The previous value is negative: if the quantity cannot be negative (load, for example), the first capture may have come in incomplete; both are still stored.",
      )
    : null;
}

/** P068: os valores que a fonte revisou e o maior salto relativo, com as duas capturas. */
export function textoMudancaSaude(r: Pick<ResumoSaude, "comRevisao" | "observacoesRevisadas" | "referenciasRevisadas">): string {
  if (!r.comRevisao.length) return tx("Nenhuma revisão de valores já guardados foi detectada nesta publicação.", "No revision of values already stored was detected in this publication.");
  const maior = r.comRevisao
    .map((c) => ({ c, e: c.revisoes?.maior_rel }))
    .filter((x): x is { c: ConjuntoIntegrado; e: NonNullable<typeof x.e> } => !!x.e && x.e.relativa_pct !== null)
    .sort((a, b) => (b.e.relativa_pct ?? 0) - (a.e.relativa_pct ?? 0))[0];
  const geral = tx(
    `Em ${plural(r.comRevisao.length, "conjunto", "conjuntos")} a fonte mudou valores que o observatório já tinha guardado: ${num(r.observacoesRevisadas, 0)} valores, em ${plural(r.referenciasRevisadas, "período distinto", "períodos distintos")}.`,
    `In ${plural(r.comRevisao.length, "dataset", "datasets")} the source changed values the observatory had already stored: ${num(r.observacoesRevisadas, 0)} values, in ${plural(r.referenciasRevisadas, "distinct period", "distinct periods")}.`,
  );
  if (!maior) return geral;
  const { c, e } = maior;
  const dia = (iso: string) => dataBR(carimbo(iso, "pt").slice(0, 10).split("/").reverse().join("-"));
  const aviso = avisoDeSinal(e);
  return tx(
    `${geral} O maior salto relativo está em ${c.titulo} (${c.orgao}), em ${refLegivel(e.ref)}: de ${num(e.de, 1)} para ${num(e.para, 1)}, entre as capturas de ${dia(e.capturado_de)} e ${dia(e.capturado_para)}. Uma revisão grande não prova erro da fonte nem do observatório.${aviso ? ` ${aviso}` : ""}`,
    `${geral} The largest relative jump is in ${c.titulo} (${c.orgao}), in ${refLegivel(e.ref)}: from ${num(e.de, 1)} to ${num(e.para, 1)}, between the captures of ${dia(e.capturado_de)} and ${dia(e.capturado_para)}. A large revision proves no error by the source or by the observatory.${aviso ? ` ${aviso}` : ""}`,
  );
}

/** P069: a data da lista de arquivos e o que ela mede, sem fingir que há comparação com a lista anterior. */
export function textoMudancaReproducao(m: Pick<ManifestoGold, "gerado_em" | "totais" | "completo">, processadoEm: string): string {
  return tx(
    `A lista de arquivos (manifesto) foi refeita em ${carimbo(m.gerado_em)}, depois do processamento de ${carimbo(processadoEm)}: ela é refeita no fim de cada execução que reescreve arquivos publicados, e muda de id quando algum arquivo muda. ` +
      `A lista traz ${num(m.totais.arquivos, 0)} arquivos e ${m.completo ? "inclui todos os publicados" : "ainda não inclui os arquivos reescritos depois do módulo Dados"}. Esta página não compara com a lista anterior; o histórico de cada arquivo está no GitHub.`,
    `The file list (manifest) was rebuilt on ${carimbo(m.gerado_em)}, after the processing of ${carimbo(processadoEm)}: it is rebuilt at the end of every run that rewrites published files, and its id changes when any file changes. ` +
      `The list carries ${num(m.totais.arquivos, 0)} files and ${m.completo ? "includes all the published ones" : "does not yet include the files rewritten after the Data module"}. This page does not compare it with the previous list; the history of each file is on GitHub.`,
  );
}

/** P070: a correção de afirmações desta página, lida das afirmações com `afirmacao_anterior`, e as que conferem com o catálogo. */
export function textoMudancaRegras(afirmacoes: readonly Pick<Afirmacao, "tema" | "afirmacao_anterior" | "texto">[], conferidas: number): string {
  const corrigidas = afirmacoes.filter((a) => a.afirmacao_anterior);
  if (!corrigidas.length) return tx("Nenhuma afirmação desta página foi corrigida nesta publicação.", "No statement on this page was corrected in this publication.");
  const cada = corrigidas.map((a) => tx(`${a.afirmacao_anterior} Agora a página diz: ${a.texto.split(/(?<=\.)\s/)[0]}`, `${a.afirmacao_anterior} The page now says: ${a.texto.split(/(?<=\.)\s/)[0]}`)).join(" ");
  const restantes = afirmacoes.length - corrigidas.length;
  const confere =
    conferidas === afirmacoes.length
      ? tx(`As outras ${num(restantes, 0)} afirmações sobre fontes integradas conferem com o catálogo.`, `The other ${num(restantes, 0)} statements about integrated sources match the catalog.`)
      : tx(
          `${num(afirmacoes.length - conferidas, 0)} de ${num(afirmacoes.length, 0)} afirmações sobre fontes integradas não conferem com o catálogo.`,
          `${num(afirmacoes.length - conferidas, 0)} of ${num(afirmacoes.length, 0)} statements about integrated sources do not match the catalog.`,
        );
  return tx(
    `${plural(corrigidas.length, "afirmação desta página foi corrigida", "afirmações desta página foram corrigidas")}. ${cada} ${confere}`,
    `${plural(corrigidas.length, "statement on this page was corrected", "statements on this page were corrected")}. ${cada} ${confere}`,
  );
}

/* ---------------------------------------------------------------- ressalvas do catálogo, para o leitor */

/**
 * Ressalva do catálogo em palavras do leitor: o estado fica em minúsculas, "snapshot" vira "cópia do arquivo" e a captura com
 * sha256 vira "arquivo baixado e guardado com impressão digital". O texto original segue no catálogo (Analisar). A ressalva é
 * texto do catálogo, em português (na página inglesa, marcada como trecho em português).
 */
export function ressalvaParaLeitor(t: string): string {
  // i18n: dado (trocas de vocabulário dentro de texto português da gold)
  return leitor(t)
    .replace(/Capturado com sha256/g, "O arquivo foi baixado e guardado com impressão digital") // i18n: dado
    .replace(/\bsha256\b/g, "impressão digital") // i18n: dado
    .replace(/\bo snapshot\b/g, "a cópia do arquivo") // i18n: dado
    .replace(/\bsnapshot\b/g, "cópia do arquivo") // i18n: dado
    .replace(/RECURSO VERIFICADO/g, "recurso verificado") // i18n: dado
    .replace(/\bINTEGRADO\b/g, "integrado") // i18n: dado
    .replace(/\bPUBLICADO\b/g, "publicado"); // i18n: dado
}

/** Agrupa as entradas pelo texto da ressalva para o leitor: a mesma frase aparece uma vez, com os títulos que ela vale. */
export function agruparRessalvas<T extends { ressalvas?: string[] }>(entradas: readonly T[], titulo: (e: T) => string): { texto: string; titulos: string[] }[] {
  const grupos = new Map<string, string[]>();
  for (const e of entradas) {
    const texto = ressalvaParaLeitor((e.ressalvas ?? []).join(" ").trim());
    grupos.set(texto, [...(grupos.get(texto) ?? []), titulo(e)]);
  }
  return Array.from(grupos, ([texto, titulos]) => ({ texto, titulos })).sort((a, b) => b.titulos.length - a.titulos.length);
}

/* ---------------------------------------------------------------- datas das páginas */

/**
 * O que cada data mede, para as páginas de Dados e Metodologia: a data de referência (o dia a que valem a situação e as
 * contagens), o processamento do catálogo e da saúde, a lista de arquivos e o último processamento completo.
 */
export function quadroDeDatas(a: { referencia: string; processadoEm: string; manifestoEm?: string | null; metaEm?: string | null; indicadoresEm?: string | null }): { rotulo: string; valor: string; mede: string }[] {
  const linhas = [
    {
      rotulo: tx("Data de referência dos dados", "Reference date of the data"),
      valor: dataBR(a.referencia),
      mede: tx("o dia para o qual valem a situação (em dia, atrasado) e as contagens do catálogo", "the day to which the status (up to date, late) and the catalog counts apply"),
    },
    {
      rotulo: tx("Catálogo e saúde processados em", "Catalog and health processed on"),
      valor: carimbo(a.processadoEm),
      mede: tx("quando o observatório calculou o catálogo e a situação de cada conjunto", "when the observatory computed the catalog and the status of each dataset"),
    },
  ];
  if (a.manifestoEm)
    linhas.push({
      rotulo: tx("Lista de arquivos gerada em", "File list generated on"),
      valor: carimbo(a.manifestoEm),
      mede: tx(
        "quando a lista de arquivos publicados (manifesto) foi refeita; é refeita sempre que arquivos publicados são reescritos",
        "when the list of published files (manifest) was rebuilt; it is rebuilt whenever published files are rewritten",
      ),
    });
  if (a.indicadoresEm)
    linhas.push({
      rotulo: tx("Catálogo de indicadores gerado em", "Indicator catalog generated on"),
      valor: carimbo(a.indicadoresEm),
      mede: tx("quando a lista de regras por indicador foi gerada", "when the list of rules by indicator was generated"),
    });
  if (a.metaEm)
    linhas.push({
      rotulo: tx("Último processamento completo em", "Latest full processing on"),
      valor: carimbo(a.metaEm),
      mede: tx("o último processamento de todos os módulos juntos", "the latest processing of all modules together"),
    });
  return linhas;
}

/* ---------------------------------------------------------------- limitações da Saúde, em palavras do leitor */

/** Primeiro dia (UTC) do calendário com valor revisado entre capturas; nulo quando nenhum. */
export function primeiroDiaComRevisao(cal: readonly DiaCalendario[]): string | null {
  return cal.filter((d) => d.observacoes_revisadas > 0).map((d) => d.dia).sort()[0] ?? null;
}

/**
 * A limitação sobre o início do registro, num só texto: a primeira captura, a primeira revisão e, quando a limitação do
 * pipeline traz a data da reconstrução do histórico ("reconstruídos em 29 e 30/09/2026"), essa data. As datas vêm do
 * calendário e do texto da gold; nada é digitado aqui.
 */
export function limitacaoInicioDoRegistro(primeiraCaptura: string | null, primeiraRevisao: string | null, limitacoesDaGold: readonly string[]): string {
  const reconstruido = limitacoesDaGold.map((l) => /reconstru[ií]dos em ([^:]+):/.exec(l)?.[1]).find(Boolean);
  // a data da reconstrução vem escrita pela gold ("29 e 30/09/2026"): em inglês, o "e" vira "and"
  const reconstruidoEn = reconstruido?.replace(/ e /g, " and ");
  const captura = primeiraCaptura
    ? tx(`As primeiras capturas registradas são de ${dataBR(primeiraCaptura)}`, `The first captures recorded are from ${dataBR(primeiraCaptura)}`)
    : tx("Não há captura registrada", "There is no capture recorded");
  const historico = reconstruido
    ? tx(`, mas o histórico completo de capturas e revisões foi reconstruído em ${reconstruido} e começa aí`, `, but the full history of captures and revisions was rebuilt on ${reconstruidoEn} and starts there`)
    : "";
  const revisao = primeiraRevisao ? tx(`; a primeira revisão de valores registrada é de ${dataBR(primeiraRevisao)}`, `; the first value revision recorded is from ${dataBR(primeiraRevisao)}`) : "";
  return tx(
    `${captura}${historico}${revisao}. Antes disso, ausência de revisão não quer dizer que a fonte não revisou: o observatório não tinha como comparar.`,
    `${captura}${historico}${revisao}. Before that, the absence of revisions does not mean the source did not revise: the observatory had no way to compare.`,
  );
}

/** Limitação escrita pelo pipeline em palavras do leitor: vocabulário de engenharia trocado e "SLA" dito como prazo de atualização. */
export function limitacaoParaLeitor(t: string): string {
  // i18n: dado (troca dentro de texto português da gold)
  return leitor(t).replace(/\bo SLA\b/g, "o prazo de atualização").replace(/\bSLA\b/g, "prazo de atualização");
}

/** A regra de prazo da publicação (tolerância por frequência), escrita a partir de regras.sla. */
export function textoPrazos(sla: Record<string, { tolerancia_dias: number }>): string {
  const nome: Record<string, string> = tx(
    { diaria: "diária", semanal: "semanal", quinzenal: "quinzenal", mensal: "mensal", trimestral: "trimestral", anual: "anual" },
    { diaria: "daily", semanal: "weekly", quinzenal: "fortnightly", mensal: "monthly", trimestral: "quarterly", anual: "annual" },
  );
  const itens = Object.entries(sla).map(([k, v]) => `${nome[k] ?? k}, ${tx(plural(v.tolerancia_dias, "dia", "dias"), plural(v.tolerancia_dias, "day", "days"))}`);
  return tx(
    `O prazo vem da frequência que a própria fonte declara, somada a uma tolerância: ${itens.join("; ")}. A tolerância se soma ao fim do período seguinte ao último disponível. Conjunto sem frequência legível fica sem prazo declarado.`,
    `The deadline comes from the frequency the source itself declares, plus a tolerance: ${itens.join("; ")}. The tolerance is added to the end of the period after the latest one available. A dataset without a readable frequency has no declared deadline.`,
  );
}

/* ---------------------------------------------------------------- identificadores entre parênteses */

/**
 * Tira de uma frase os identificadores de conjunto entre parênteses ("(ons:cvu-usitermica)", "(ons:cmo-semanal, ons:cmo-semi-horario)"),
 * que o leitor não tem como consultar, e devolve a frase sem eles e a lista tirada, para o nível Analisar.
 */
export function separaIdentificadores(t: string): { texto: string; tecnico: string } {
  const tecnico: string[] = [];
  // identificadores de conjunto entre parênteses, com ou sem um estado depois ("(ons:documentos-limites-intercambio, publicado)")
  let texto = t.replace(/\s*\(([a-zà-ú][a-zà-ú ]*:[\w.-]+(?:,\s*(?:[a-zà-ú][a-zà-ú ]*:[\w.-]+|[a-zà-ú]+))*)\)/g, (_, lista: string) => {
    tecnico.push(`(${lista})`);
    return "";
  });
  // nome de coluna ou de campo entre parênteses ("(coluna mmgd_estimada)")
  texto = texto.replace(/\s*\((?:colunas?|campos?)\s+[a-z][a-z0-9_]*(?:(?:,|\se)\s*[a-z][a-z0-9_]*)*\)/g, (trecho) => {
    tecnico.push(trecho.trim());
    return "";
  });
  // a frase que cita o achado da auditoria ("Achado A06 (...): ...") é bastidor: fica em Analisar
  const achado = /\s+(Achado A\d+\b[\s\S]*)$/.exec(texto);
  if (achado) {
    tecnico.push(achado[1]);
    texto = texto.slice(0, achado.index);
  }
  return { texto, tecnico: tecnico.join(" ") };
}

/** Primeira letra em maiúscula, para o título de um alerta que a gold escreve em minúsculas. */
export const maiuscula = (t: string): string => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/* ---------------------------------------------------------------- coleta da CCEE: data da decisão e capturas posteriores */

export type ResumoAcessoCcee = {
  /** Data (AAAA-MM-DD) em que o responsável autorizou a coleta. */
  decididaEm: string | null;
  /** Última captura feita no portal da CCEE (instante em UTC) e quantos conjuntos tiveram captura depois do processamento dado. */
  ultimaCaptura: string | null;
  conjuntosCapturadosDepois: number;
};

/**
 * Resume o registro de acesso à CCEE (mercado.json, acesso_ccee): a data da decisão e as capturas feitas depois do
 * processamento do catálogo e da saúde. A data do registro de uma decisão não é a data de referência dos dados.
 */
export function resumirAcessoCcee(
  acesso: { decisao?: { decidida_em?: string }; capturas?: { ultima_captura: string }[] } | null | undefined,
  processadoEm: string,
): ResumoAcessoCcee {
  const capturas = acesso?.capturas ?? [];
  return {
    decididaEm: acesso?.decisao?.decidida_em ?? null,
    ultimaCaptura: capturas.map((c) => c.ultima_captura).sort().at(-1) ?? null,
    conjuntosCapturadosDepois: capturas.filter((c) => c.ultima_captura > processadoEm).length,
  };
}

/** A diferença entre a data da decisão e a data de referência dos dados, dita só quando os dados mostram que há capturas posteriores. */
export function textoDatasDaColetaCcee(a: ResumoAcessoCcee, referencia: string, processadoEm: string): string {
  if (!a.decididaEm) return "";
  const base = tx(
    `${dataBR(a.decididaEm)} é a data da decisão do responsável, um registro de autorização, e não uma data dos dados; a data de referência dos dados do catálogo e da saúde é ${dataBR(referencia)}.`,
    `${dataBR(a.decididaEm)} is the date of the decision by the person in charge, an authorization record, not a data date; the reference date of the catalog and health data is ${dataBR(referencia)}.`,
  );
  if (!a.conjuntosCapturadosDepois) return base;
  return tx(
    `${base} A coleta autorizada é posterior ao processamento de ${carimbo(processadoEm)}: ${plural(a.conjuntosCapturadosDepois, "fonte da CCEE (conjuntos abertos e InfoMercado) foi capturada", "fontes da CCEE (conjuntos abertos e InfoMercado) foram capturadas")} depois dele (a última captura é de ${carimbo(a.ultimaCaptura)}). A página Mercado já usa essas capturas; as contagens do catálogo e da saúde só as incluem na próxima atualização.`,
    `${base} The authorized collection is later than the processing of ${carimbo(processadoEm)}: ${plural(a.conjuntosCapturadosDepois, "CCEE source (open datasets and InfoMercado) was captured", "CCEE sources (open datasets and InfoMercado) were captured")} after it (the latest capture is from ${carimbo(a.ultimaCaptura)}). The Market page already uses these captures; the catalog and health counts include them only in the next update.`,
  );
}

/* ---------------------------------------------------------------- estado de cada arquivo para baixar */

/** O que o validador diz de cada tipo de problema de um CSV, em palavras de leitor (o texto exato da checagem fica em Analisar). */
function problemaEmPalavras(tipo: string, detalhe: string): string {
  if (tipo === "datas_futuras")
    return tx("há datas depois da data de referência da publicação, porque o arquivo traz valores previstos", "there are dates after the reference date of the publication, because the file carries forecast values");
  // i18n: dado (troca dentro do texto do validador, que é português)
  if (tipo === "chaves_unicas") return detalhe.replace(/a chave inferida/g, "a mesma chave");
  return datasLegiveis(detalhe);
}

/**
 * O estado de um arquivo para baixar em duas camadas: `frase`, que cabe em Entender (sem nome de campo, de arquivo nem data crua), e
 * `tecnico`, para Analisar e Auditar (a checagem exatamente como o validador a escreve e as impressões digitais comparadas). Quando a
 * validação reprova um CSV que foi reescrito depois dela, a frase diz as duas coisas: o que a validação julgou e o que a releitura do
 * arquivo publicado mostra. Nada é corrigido: o veredito da publicação continua sendo o que o relatório registra.
 */
export function textoEstadoDoArquivo(e: EstadoDoArquivo): { frase: string; tecnico: string } {
  if (e.veredito === "nao_se_aplica") return { frase: "", tecnico: "" };
  if (e.veredito === "sem_validacao")
    return { frase: tx("Validação automática: o relatório desta publicação não cobre este arquivo.", "Automatic validation: this publication's report does not cover this file."), tecnico: "" };
  if (e.veredito === "aprovado") return { frase: tx("Validação automática: aprovada.", "Automatic validation: passed."), tecnico: "" };
  const detalhes = e.problemas.map((p) => `${p.tipo}: ${datasLegiveis(p.detalhe)}`).join("; ");
  if (e.veredito === "ressalva") {
    const frase = e.problemas.map((p) => problemaEmPalavras(p.tipo, p.detalhe)).join("; ");
    return {
      frase: tx(`Validação automática: aprovada com ressalva (${frase}).`, `Automatic validation: passed with a caveat (${frase}).`),
      tecnico: tx(`Checagens com ressalva: ${detalhes}.`, `Checks with a caveat: ${detalhes}.`),
    };
  }
  // reprovado
  const r = e.releitura;
  const reprovou = e.problemas.map((p) => problemaEmPalavras(p.tipo, p.detalhe)).join("; ");
  const relida =
    r && r.divergentes === 0
      ? tx(` Relido como CSV, o arquivo publicado tem ${num(r.colunas, 0)} colunas em todas as ${num(r.linhas, 0)} linhas.`, ` Reread as CSV, the published file has ${num(r.colunas, 0)} columns in all ${num(r.linhas, 0)} rows.`)
      : r
        ? tx(
            ` Relido como CSV, o arquivo publicado tem ${plural(r.divergentes, "linha", "linhas")} com número de colunas diferente do cabeçalho, entre ${num(r.linhas, 0)}.`,
            ` Reread as CSV, the published file has ${plural(r.divergentes, "row", "rows")} with a number of columns different from the header, out of ${num(r.linhas, 0)}.`,
          )
        : "";
  const dia = e.outraVersao?.julgadaEm ? dataBR(carimbo(e.outraVersao.julgadaEm, "pt").slice(0, 10).split("/").reverse().join("-")) : null;
  const frase = e.outraVersao
    ? tx(
        `Validação automática: reprovada na versão de ${dia ?? "uma execução anterior"} (${reprovou}); o arquivo publicado é outra versão.${relida}`,
        `Automatic validation: failed on the version of ${dia ?? "an earlier run"} (${reprovou}); the published file is another version.${relida}`,
      )
    : tx(`Validação automática: reprovada (${reprovou}).${relida}`, `Automatic validation: failed (${reprovou}).${relida}`);
  const tecnico = e.outraVersao
    ? tx(
        `Checagem: ${detalhes}. Impressão digital julgada pela validação: ${e.outraVersao.julgada}. Impressão digital do arquivo na lista de arquivos: ${e.outraVersao.publicada}.`,
        `Check: ${detalhes}. Fingerprint judged by the validation: ${e.outraVersao.julgada}. Fingerprint of the file in the file list: ${e.outraVersao.publicada}.`,
      )
    : tx(`Checagem: ${detalhes}.`, `Check: ${detalhes}.`);
  return { frase, tecnico };
}

/**
 * A explicação das checagens automáticas reprovadas, em três camadas: `curta` cabe na nota da faixa de métricas, `frase` explica em
 * palavras de leitor (sem nome de arquivo nem de campo) e `tecnico` traz, para Analisar, cada arquivo, a checagem como o validador a
 * escreve, as impressões digitais comparadas e a releitura. Nada é reaprovado: o relatório da publicação continua sendo o registro.
 * `checagens` é o número que o relatório informa; `arquivos` são os estados dos arquivos que ele reprova.
 */
export function textoChecagensReprovadas(arquivos: readonly EstadoDoArquivo[], checagens: number, idioma: Idioma = idiomaEnergia()): { curta: string; frase: string; tecnico: string } {
  const reprovados = arquivos.filter((e) => e.veredito === "reprovado");
  if (!reprovados.length || checagens <= 0) return { curta: "", frase: "", tecnico: "" };
  const n = reprovados.length;
  const outra = reprovados.filter((e) => e.outraVersao).length;
  const relidos = reprovados.filter((e) => e.releitura && e.releitura.divergentes === 0).length;
  const tipos = Array.from(new Set(reprovados.reduce<string[]>((s, e) => s.concat(e.problemas.filter((p) => p.resultado === "reprovado").map((p) => p.tipo)), [])));
  const esquema = tipos.length === 1 && tipos[0] === "esquema";
  // daqui em diante, só a forma portuguesa (a inglesa está em checagensReprovadasEn): os literais levam a marca i18n: dado
  if (idioma === "en") return checagensReprovadasEn(reprovados, checagens, outra, relidos, esquema);
  const o = n === 1 ? "o arquivo" : `os ${n} arquivos`;
  const reescritos = outra === 0 ? "nenhum foi reescrito" : outra === 1 ? "1 foi reescrito" : `${outra} foram reescritos`; // i18n: dado
  const curta =
    outra === n
      ? `${n === 1 ? "É de um arquivo reescrito" : `São de ${n} arquivos reescritos`} depois da validação.` // i18n: dado
      : `${plural(n, "arquivo reprovado", "arquivos reprovados", "pt")}; ${reescritos} depois da validação.`; // i18n: dado
  const onde = checagens === n ? (n === 1 ? "A checagem reprovada é" : `As ${n} checagens reprovadas são`) : `As ${checagens} checagens reprovadas estão em ${n} arquivos`; // i18n: dado
  const oQue = esquema ? "linhas com número de colunas diferente do cabeçalho" : "problemas no formato do arquivo"; // i18n: dado
  const versao =
    outra === n
      ? ` ${n === 1 ? "O arquivo foi reescrito" : `Os ${n} arquivos foram reescritos`} depois da validação: a impressão digital que o relatório julgou é diferente da que está na lista de arquivos publicados, então o relatório não diz nada sobre a versão que você baixa.` // i18n: dado
      : outra > 0
        ? ` ${outra} de ${n} arquivos foram reescritos depois da validação: o relatório julgou outra versão deles.` // i18n: dado
        : " O relatório julgou a mesma versão que está publicada."; // i18n: dado
  const releitura =
    relidos === n
      ? ` Relido na construção desta página, ${n === 1 ? "o arquivo publicado tem" : "cada arquivo publicado tem"} o número de colunas do cabeçalho em todas as linhas.` // i18n: dado
      : relidos > 0
        ? ` Relidos na construção desta página, ${relidos} dos ${n} arquivos publicados têm o número de colunas do cabeçalho em todas as linhas; os outros ainda têm linhas diferentes.` // i18n: dado
        : ` Relidos na construção desta página, ${o} publicado${n === 1 ? "" : "s"} ainda tem linhas com número de colunas diferente do cabeçalho.`; // i18n: dado
  const frase = `${onde} de arquivos CSV: ${oQue}.${versao}${releitura} Nada foi reaprovado à mão: o relatório da publicação continua como foi gerado.`; // i18n: dado
  const tecnico = reprovados
    .map((e) => {
      const nome = e.caminho.split("/").pop() ?? e.caminho;
      const checagem = e.problemas.filter((p) => p.resultado === "reprovado").map((p) => `${p.tipo}: ${datasLegiveis(p.detalhe, "pt")}`).join("; ");
      const digitais = e.outraVersao ? ` Impressão digital julgada: ${e.outraVersao.julgada}. Impressão digital na lista de arquivos: ${e.outraVersao.publicada}.` : ""; // i18n: dado
      const r = e.releitura ? ` Releitura: ${num(e.releitura.linhas, 0, "pt")} linhas, ${num(e.releitura.colunas, 0, "pt")} colunas no cabeçalho, ${num(e.releitura.divergentes, 0, "pt")} linhas com número de colunas diferente.` : ""; // i18n: dado
      return `${nome}: ${checagem}.${digitais}${r}`;
    })
    .join(" ");
  return { curta, frase, tecnico };
}

/** A mesma explicação das checagens reprovadas, escrita em inglês (as contagens são as mesmas). */
function checagensReprovadasEn(reprovados: readonly EstadoDoArquivo[], checagens: number, outra: number, relidos: number, esquema: boolean): { curta: string; frase: string; tecnico: string } {
  const n = reprovados.length;
  const reescritos = outra === 0 ? "none was rewritten" : outra === 1 ? "1 was rewritten" : `${outra} were rewritten`;
  const curta = outra === n ? `${n === 1 ? "It is from one file rewritten" : `They are from ${n} files rewritten`} after the validation.` : `${plural(n, "failed file", "failed files", "en")}; ${reescritos} after the validation.`;
  const onde = checagens === n ? (n === 1 ? "The failed check is" : `The ${n} failed checks are`) : `The ${checagens} failed checks are in ${n} files`;
  const oQue = esquema ? "rows with a number of columns different from the header" : "problems in the file format";
  const versao =
    outra === n
      ? ` ${n === 1 ? "The file was rewritten" : `The ${n} files were rewritten`} after the validation: the fingerprint the report judged differs from the one in the list of published files, so the report says nothing about the version you download.`
      : outra > 0
        ? ` ${outra} of ${n} files were rewritten after the validation: the report judged another version of them.`
        : " The report judged the same version that is published.";
  const releitura =
    relidos === n
      ? ` Reread when this page was built, ${n === 1 ? "the published file has" : "each published file has"} the header's number of columns in every row.`
      : relidos > 0
        ? ` Reread when this page was built, ${relidos} of the ${n} published files have the header's number of columns in every row; the others still have different rows.`
        : ` Reread when this page was built, the published ${n === 1 ? "file still has" : `${n} files still have`} rows with a number of columns different from the header.`;
  const frase = `${onde} in CSV files: ${oQue}.${versao}${releitura} Nothing was approved again by hand: the publication report stays as it was generated.`;
  const tecnico = reprovados
    .map((e) => {
      const nome = e.caminho.split("/").pop() ?? e.caminho;
      const checagem = e.problemas.filter((p) => p.resultado === "reprovado").map((p) => `${p.tipo}: ${datasLegiveis(p.detalhe, "en")}`).join("; ");
      const digitais = e.outraVersao ? ` Fingerprint judged: ${e.outraVersao.julgada}. Fingerprint in the file list: ${e.outraVersao.publicada}.` : "";
      const r = e.releitura
        ? ` Reread: ${num(e.releitura.linhas, 0, "en")} rows, ${num(e.releitura.colunas, 0, "en")} columns in the header, ${num(e.releitura.divergentes, 0, "en")} rows with a different number of columns.`
        : "";
      return `${nome}: ${checagem}.${digitais}${r}`;
    })
    .join(" ");
  return { curta, frase, tecnico };
}

/* ---------------------------------------------------------------- versão do código das bases */

/**
 * O sufixo "+alterado" da versão do código, explicado: o que ele quer dizer, o que muda na reprodução e quantas bases o levam. Lê só o campo
 * versao_codigo de cada base; base sem o campo é dita sem versão registrada.
 */
export function textoVersaoDoCodigo(v: readonly VersaoDoCodigo[]): { resumo: string; sufixo: string; alterado: number; limpas: number; semVersao: number } {
  const alterado = v.filter((x) => x.versao?.endsWith("+alterado")).length;
  const semVersao = v.filter((x) => !x.versao).length;
  const limpas = v.length - alterado - semVersao;
  const resumo = tx(
    `Das ${num(v.length, 0)} bases publicadas, ${alterado} ${alterado === 1 ? "foi gerada" : "foram geradas"} com código que tinha mudanças ainda não registradas (sufixo +alterado)` +
      `${limpas ? `, ${limpas} com o código todo registrado` : ""}${semVersao ? ` e ${semVersao} sem versão de código registrada` : ""}.`,
    `Of the ${num(v.length, 0)} published bases, ${alterado} ${alterado === 1 ? "was generated" : "were generated"} with code that had changes not yet committed (suffix +alterado)` +
      `${limpas ? `, ${limpas} with all code committed` : ""}${semVersao ? ` and ${semVersao} with no code version recorded` : ""}.`,
  );
  return {
    resumo,
    sufixo: tx(
      "A versão do código é o identificador curto da versão registrada no repositório quando a base foi gerada. O sufixo +alterado quer dizer que, nesse momento, o código tinha mudanças ainda não registradas: a base não corresponde exatamente à versão indicada, e refazê-la a partir dela pode dar um resultado diferente do publicado. O sufixo desaparece quando a base é gerada de novo com o código todo registrado.",
      "The code version is the short identifier of the version committed to the repository when the base was generated. The suffix +alterado (changed) means that, at that moment, the code had changes not yet committed: the base does not correspond exactly to the version shown, and rebuilding it from that version may give a result different from the published one. The suffix disappears when the base is generated again with all code committed.",
    ),
    alterado,
    limpas,
    semVersao,
  };
}

/* ---------------------------------------------------------------- revisões: duas leituras da mesma pergunta */

/** A ponte entre a revisão da Saúde (capturas consecutivas do mesmo arquivo) e a de Água e clima (histórico principal contra uma recaptura). */
export function textoPonteRevisoes(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "A Saúde compara capturas consecutivas do mesmo arquivo e conta cada par de série e período uma vez. A página Água e clima compara, nos últimos 30 dias, o valor do histórico principal com o de uma recaptura. São critérios diferentes para a mesma pergunta, então as contagens de dias e de valores revisados não coincidem.",
    "The Health page compares consecutive captures of the same file and counts each series and period pair once. The Water and climate page compares, over the last 30 days, the value in the main history with that of a recapture. They are different criteria for the same question, so the counts of days and of revised values do not match.",
    idioma,
  );
}

/** A mesma ponte, em português (forma anterior, mantida para quem a importa como constante). */
export const TEXTO_PONTE_REVISOES = textoPonteRevisoes("pt");
