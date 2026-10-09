import { leitor } from "./bastidor";
import { carimbo, datasLegiveis, dataBR, num, plural } from "./formato";
import { listaEmPortugues, refLegivel, type ConferenciaManifesto, type ResumoCatalogo, type ResumoMetricas, type ResumoSaude } from "./dados";
import type { EstadoDoArquivo, VersaoDoCodigo } from "./dados-servidor";
import type { Afirmacao, CatalogoDados, ConjuntoIntegrado, DiaCalendario, ManifestoGold, PublicacaoGold } from "./tipos-dados";

/**
 * Textos de Entender das quatro páginas de Dados e Metodologia (rodada r8 de conteúdo): vereditos em duas camadas, o
 * bloco "O que mudou", a conciliação entre o catálogo e as integrações e as datas que as páginas mostram. Tudo é função
 * pura dos campos das golds (catalogo.json, publicacao.json, manifesto.json, metricas.json); número nenhum é digitado aqui.
 * As respostas completas (respostaCatalogo, respostaSaude, respostaReproducao, respostaRegras) seguem em dados.ts, intactas.
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
  const soCatalogo = c.orgaosSoNoCatalogo.length ? ` ${plural(c.orgaosSoNoCatalogo.length, "órgão aparece", "órgãos aparecem")} só no catálogo: ${listaEmPortugues(c.orgaosSoNoCatalogo)}.` : "";
  return (
    `O catálogo conta conjuntos: ${num(c.conjuntos, 0)}, de ${num(c.orgaos, 0)} órgãos. A página Saúde e o rodapé do observatório contam integrações: ${num(c.integracoes, 0)}, de ${num(c.orgaosComIntegracao, 0)} órgãos. ` +
    `Integração é o uso de um conjunto por um módulo do observatório. ${num(c.conjuntosComIntegracao, 0)} conjuntos têm ao menos uma, ${num(c.conjuntosComVariasIntegracoes, 0)} têm mais de uma e ${num(c.integracoesDeVariosConjuntos, 0)} integrações reúnem mais de um conjunto. ` +
    `Os outros ${num(c.conjuntosSemIntegracao, 0)} conjuntos não têm integração.${soCatalogo}`
  );
}

/**
 * O que o rodapé do observatório precisaria dizer para não contar integrações como conjuntos. O rodapé é de outro agente: a
 * função só entrega o texto, lido dos mesmos campos.
 */
export function textoRodapeDasFontes(c: ConciliacaoIntegracoes, orgaos: readonly string[]): { resumo: string; detalhe: string } {
  return {
    resumo: `${num(c.orgaosComIntegracao, 0)} órgãos, ${num(c.integracoes, 0)} integrações`,
    detalhe: `Dados abertos de ${listaEmPortugues([...orgaos])}, em ${num(c.integracoes, 0)} integrações de conjuntos (${num(c.conjuntosComIntegracao, 0)} dos ${num(c.conjuntos, 0)} conjuntos do catálogo). O catálogo traz ${num(c.orgaos, 0)} órgãos.`,
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
  return `Dos ${num(r.total, 0)} conjuntos catalogados, ${num(c.PUBLICADO, 0)} chegaram à última etapa: foram integrados, validados e alimentam uma base publicada. Validado quer dizer sem checagem reprovada; não atesta que o dado esteja atualizado.`;
}

/** P068: quem estava atrasado na data de referência e se a fonte revisou valores, com o limite de leitura de "sem prazo". */
export function vereditoSaude(r: Pick<ResumoSaude, "hoje" | "atrasados" | "comRevisao">): string {
  const dh = dataBR(r.hoje);
  const atraso = (c: ConjuntoIntegrado) => c.atualidade.dias_atraso ?? 0;
  const semPrazo = "as sem prazo declarado não entram nessa conta";
  let a: string;
  if (r.atrasados.length === 0) a = `Em ${dh}, nenhuma integração estava atrasada; ${semPrazo}.`;
  else if (r.atrasados.length === 1) a = `Em ${dh}, só uma integração estava atrasada: ${tituloCurto(r.atrasados[0].titulo)}, ${plural(atraso(r.atrasados[0]), "dia", "dias")} além do prazo; ${semPrazo}.`;
  else a = `Em ${dh}, ${num(r.atrasados.length, 0)} integrações estavam atrasadas, a maior com ${plural(Math.max(...r.atrasados.map(atraso)), "dia", "dias")} além do prazo; ${semPrazo}.`;
  const rev = r.comRevisao.length
    ? ` Em ${plural(r.comRevisao.length, "integração", "integrações")} a fonte revisou valores já publicados; uma revisão grande não prova erro.`
    : " Nenhuma revisão de valores já publicados foi detectada.";
  return a + rev;
}

/** P069: se os arquivos publicados conferem com a lista de impressões digitais, com o limite de leitura da coleta. */
export function vereditoReproducao(m: Pick<ManifestoGold, "totais">, c: Pick<ConferenciaManifesto, "total" | "conferidos" | "divergentes" | "ausentes">): string {
  const limite = "Refazer o arquivo não refaz a coleta: ela depende de a fonte estar no ar.";
  if (c.conferidos === c.total) return `Sim. Cada um dos ${num(m.totais.arquivos, 0)} arquivos publicados tem a impressão digital registrada numa lista, e todos conferiram na construção desta página. ${limite}`;
  return `Em parte. De ${num(c.total, 0)} arquivos publicados, ${num(c.divergentes.length + c.ausentes.length, 0)} não conferiram com a lista de impressões digitais na construção desta página. ${limite}`;
}

/** P070: a resposta a "quais interpretações são permitidas?" nos termos da própria página: as que a regra do indicador sustenta. */
export function vereditoRegras(r: Pick<ResumoMetricas, "total" | "comFormula">): string {
  return `Só as que a regra de cada indicador sustenta. Os ${num(r.total, 0)} indicadores têm definição, unidade, recorte e limites escritos; ${num(r.comFormula, 0)} têm fórmula publicada.`;
}

/* ---------------------------------------------------------------- "O que mudou" */

/** P067: o que se sabe que mudou nas listagens das fontes e o que a página não compara. */
export function textoMudancaCatalogo(cat: Pick<CatalogoDados, "recursos">): string {
  const portais = Object.keys(cat.recursos);
  const removidos = Object.values(cat.recursos).reduce((s, x) => s + (x.removidos ?? 0), 0);
  const fontes = listaEmPortugues(portais);
  const arquivos = removidos === 0 ? `Nenhum arquivo sumiu das listagens de ${fontes} desde que o observatório as registra.` : `${plural(removidos, "arquivo sumiu", "arquivos sumiram")} das listagens de ${fontes} desde que o observatório as registra (lista em Analisar).`;
  return `${arquivos} O catálogo guarda só a situação da última coleta, por isso esta página não compara as contagens com a publicação anterior.`;
}

/**
 * Aviso curto quando o maior salto troca o sinal do valor (de negativo para positivo). O observatório guarda as duas capturas como vieram; a
 * página não decide qual está certa, mas diz o que um valor negativo implica: carga, geração e preço não são negativos na fonte, então a
 * primeira captura pode ter vindo incompleta. Sem troca de sinal, não há aviso.
 */
export function avisoDeSinal(e: { de: number; para: number } | null | undefined): string | null {
  return e && e.de < 0 && e.para > 0
    ? "O valor anterior é negativo: se a grandeza não pode ser negativa (carga, por exemplo), a primeira captura pode ter vindo incompleta; as duas continuam guardadas."
    : null;
}

/** P068: os valores que a fonte revisou e o maior salto relativo, com as duas capturas. */
export function textoMudancaSaude(r: Pick<ResumoSaude, "comRevisao" | "observacoesRevisadas" | "referenciasRevisadas">): string {
  if (!r.comRevisao.length) return "Nenhuma revisão de valores já guardados foi detectada nesta publicação.";
  const maior = r.comRevisao
    .map((c) => ({ c, e: c.revisoes?.maior_rel }))
    .filter((x): x is { c: ConjuntoIntegrado; e: NonNullable<typeof x.e> } => !!x.e && x.e.relativa_pct !== null)
    .sort((a, b) => (b.e.relativa_pct ?? 0) - (a.e.relativa_pct ?? 0))[0];
  const geral = `Em ${plural(r.comRevisao.length, "conjunto", "conjuntos")} a fonte mudou valores que o observatório já tinha guardado: ${num(r.observacoesRevisadas, 0)} valores, em ${plural(r.referenciasRevisadas, "período distinto", "períodos distintos")}.`;
  if (!maior) return geral;
  const { c, e } = maior;
  const dia = (iso: string) => carimbo(iso).slice(0, 10);
  return `${geral} O maior salto relativo está em ${c.titulo} (${c.orgao}), em ${refLegivel(e.ref)}: de ${num(e.de, 1)} para ${num(e.para, 1)}, entre as capturas de ${dia(e.capturado_de)} e ${dia(e.capturado_para)}. Uma revisão grande não prova erro da fonte nem do observatório.${avisoDeSinal(e) ? ` ${avisoDeSinal(e)}` : ""}`;
}

/** P069: a data da lista de arquivos e o que ela mede, sem fingir que há comparação com a lista anterior. */
export function textoMudancaReproducao(m: Pick<ManifestoGold, "gerado_em" | "totais" | "completo">, processadoEm: string): string {
  return (
    `A lista de arquivos (manifesto) foi refeita em ${carimbo(m.gerado_em)}, depois do processamento de ${carimbo(processadoEm)}: ela é refeita no fim de cada execução que reescreve arquivos publicados, e muda de id quando algum arquivo muda. ` +
    `A lista traz ${num(m.totais.arquivos, 0)} arquivos e ${m.completo ? "inclui todos os publicados" : "ainda não inclui os arquivos reescritos depois do módulo Dados"}. Esta página não compara com a lista anterior; o histórico de cada arquivo está no GitHub.`
  );
}

/** P070: a correção de afirmações desta página, lida das afirmações com `afirmacao_anterior`, e as que conferem com o catálogo. */
export function textoMudancaRegras(afirmacoes: readonly Pick<Afirmacao, "tema" | "afirmacao_anterior" | "texto">[], conferidas: number): string {
  const corrigidas = afirmacoes.filter((a) => a.afirmacao_anterior);
  if (!corrigidas.length) return "Nenhuma afirmação desta página foi corrigida nesta publicação.";
  const cada = corrigidas.map((a) => `${a.afirmacao_anterior} Agora a página diz: ${a.texto.split(/(?<=\.)\s/)[0]}`).join(" ");
  const restantes = afirmacoes.length - corrigidas.length;
  const confere = conferidas === afirmacoes.length ? `As outras ${num(restantes, 0)} afirmações sobre fontes integradas conferem com o catálogo.` : `${num(afirmacoes.length - conferidas, 0)} de ${num(afirmacoes.length, 0)} afirmações sobre fontes integradas não conferem com o catálogo.`;
  return `${plural(corrigidas.length, "afirmação desta página foi corrigida", "afirmações desta página foram corrigidas")}. ${cada} ${confere}`;
}

/* ---------------------------------------------------------------- ressalvas do catálogo, para o leitor */

/**
 * Ressalva do catálogo em palavras do leitor: o estado fica em minúsculas, "snapshot" vira "cópia do arquivo" e a captura com
 * sha256 vira "arquivo baixado e guardado com impressão digital". O texto original segue no catálogo (Analisar).
 */
export function ressalvaParaLeitor(t: string): string {
  return leitor(t)
    .replace(/Capturado com sha256/g, "O arquivo foi baixado e guardado com impressão digital")
    .replace(/\bsha256\b/g, "impressão digital")
    .replace(/\bo snapshot\b/g, "a cópia do arquivo")
    .replace(/\bsnapshot\b/g, "cópia do arquivo")
    .replace(/RECURSO VERIFICADO/g, "recurso verificado")
    .replace(/\bINTEGRADO\b/g, "integrado")
    .replace(/\bPUBLICADO\b/g, "publicado");
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
    { rotulo: "Data de referência dos dados", valor: dataBR(a.referencia), mede: "o dia para o qual valem a situação (em dia, atrasado) e as contagens do catálogo" },
    { rotulo: "Catálogo e saúde processados em", valor: carimbo(a.processadoEm), mede: "quando o observatório calculou o catálogo e a situação de cada conjunto" },
  ];
  if (a.manifestoEm) linhas.push({ rotulo: "Lista de arquivos gerada em", valor: carimbo(a.manifestoEm), mede: "quando a lista de arquivos publicados (manifesto) foi refeita; é refeita sempre que arquivos publicados são reescritos" });
  if (a.indicadoresEm) linhas.push({ rotulo: "Catálogo de indicadores gerado em", valor: carimbo(a.indicadoresEm), mede: "quando a lista de regras por indicador foi gerada" });
  if (a.metaEm) linhas.push({ rotulo: "Último processamento completo em", valor: carimbo(a.metaEm), mede: "o último processamento de todos os módulos juntos" });
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
  const captura = primeiraCaptura ? `As primeiras capturas registradas são de ${dataBR(primeiraCaptura)}` : "Não há captura registrada";
  const historico = reconstruido ? `, mas o histórico completo de capturas e revisões foi reconstruído em ${reconstruido} e começa aí` : "";
  const revisao = primeiraRevisao ? `; a primeira revisão de valores registrada é de ${dataBR(primeiraRevisao)}` : "";
  return `${captura}${historico}${revisao}. Antes disso, ausência de revisão não quer dizer que a fonte não revisou: o observatório não tinha como comparar.`;
}

/** Limitação escrita pelo pipeline em palavras do leitor: vocabulário de engenharia trocado e "SLA" dito como prazo de atualização. */
export function limitacaoParaLeitor(t: string): string {
  return leitor(t).replace(/\bo SLA\b/g, "o prazo de atualização").replace(/\bSLA\b/g, "prazo de atualização");
}

/** A regra de prazo da publicação (tolerância por frequência), escrita a partir de regras.sla. */
export function textoPrazos(sla: Record<string, { tolerancia_dias: number }>): string {
  const nome: Record<string, string> = { diaria: "diária", semanal: "semanal", quinzenal: "quinzenal", mensal: "mensal", trimestral: "trimestral", anual: "anual" };
  const itens = Object.entries(sla).map(([k, v]) => `${nome[k] ?? k}, ${plural(v.tolerancia_dias, "dia", "dias")}`);
  return `O prazo vem da frequência que a própria fonte declara, somada a uma tolerância: ${itens.join("; ")}. A tolerância se soma ao fim do período seguinte ao último disponível. Conjunto sem frequência legível fica sem prazo declarado.`;
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
  const base = `${dataBR(a.decididaEm)} é a data da decisão do responsável, um registro de autorização, e não uma data dos dados; a data de referência dos dados do catálogo e da saúde é ${dataBR(referencia)}.`;
  if (!a.conjuntosCapturadosDepois) return base;
  return `${base} A coleta autorizada é posterior ao processamento de ${carimbo(processadoEm)}: ${plural(a.conjuntosCapturadosDepois, "fonte da CCEE (conjuntos abertos e InfoMercado) foi capturada", "fontes da CCEE (conjuntos abertos e InfoMercado) foram capturadas")} depois dele (a última captura é de ${carimbo(a.ultimaCaptura)}). A página Mercado já usa essas capturas; as contagens do catálogo e da saúde só as incluem na próxima atualização.`;
}

/* ---------------------------------------------------------------- estado de cada arquivo para baixar */

/** O que o validador diz de cada tipo de problema de um CSV, em palavras de leitor (o texto exato da checagem fica em Analisar). */
function problemaEmPalavras(tipo: string, detalhe: string): string {
  if (tipo === "datas_futuras") return "há datas depois da data de referência da publicação, porque o arquivo traz valores previstos";
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
  if (e.veredito === "sem_validacao") return { frase: "Validação automática: o relatório desta publicação não cobre este arquivo.", tecnico: "" };
  if (e.veredito === "aprovado") return { frase: "Validação automática: aprovada.", tecnico: "" };
  const detalhes = e.problemas.map((p) => `${p.tipo}: ${datasLegiveis(p.detalhe)}`).join("; ");
  if (e.veredito === "ressalva") {
    const frase = e.problemas.map((p) => problemaEmPalavras(p.tipo, p.detalhe)).join("; ");
    return { frase: `Validação automática: aprovada com ressalva (${frase}).`, tecnico: `Checagens com ressalva: ${detalhes}.` };
  }
  // reprovado
  const r = e.releitura;
  const reprovou = e.problemas.map((p) => problemaEmPalavras(p.tipo, p.detalhe)).join("; ");
  const relida = r && r.divergentes === 0 ? ` Relido como CSV, o arquivo publicado tem ${num(r.colunas, 0)} colunas em todas as ${num(r.linhas, 0)} linhas.` : r ? ` Relido como CSV, o arquivo publicado tem ${plural(r.divergentes, "linha", "linhas")} com número de colunas diferente do cabeçalho, entre ${num(r.linhas, 0)}.` : "";
  const dia = e.outraVersao?.julgadaEm ? carimbo(e.outraVersao.julgadaEm).slice(0, 10) : null;
  const frase = e.outraVersao
    ? `Validação automática: reprovada na versão de ${dia ?? "uma execução anterior"} (${reprovou}); o arquivo publicado é outra versão.${relida}`
    : `Validação automática: reprovada (${reprovou}).${relida}`;
  const tecnico = e.outraVersao
    ? `Checagem: ${detalhes}. Impressão digital julgada pela validação: ${e.outraVersao.julgada}. Impressão digital do arquivo na lista de arquivos: ${e.outraVersao.publicada}.`
    : `Checagem: ${detalhes}.`;
  return { frase, tecnico };
}

/**
 * A explicação das checagens automáticas reprovadas, em três camadas: `curta` cabe na nota da faixa de métricas, `frase` explica em
 * palavras de leitor (sem nome de arquivo nem de campo) e `tecnico` traz, para Analisar, cada arquivo, a checagem como o validador a
 * escreve, as impressões digitais comparadas e a releitura. Nada é reaprovado: o relatório da publicação continua sendo o registro.
 * `checagens` é o número que o relatório informa; `arquivos` são os estados dos arquivos que ele reprova.
 */
export function textoChecagensReprovadas(arquivos: readonly EstadoDoArquivo[], checagens: number): { curta: string; frase: string; tecnico: string } {
  const reprovados = arquivos.filter((e) => e.veredito === "reprovado");
  if (!reprovados.length || checagens <= 0) return { curta: "", frase: "", tecnico: "" };
  const n = reprovados.length;
  const outra = reprovados.filter((e) => e.outraVersao).length;
  const relidos = reprovados.filter((e) => e.releitura && e.releitura.divergentes === 0).length;
  const tipos = Array.from(new Set(reprovados.reduce<string[]>((s, e) => s.concat(e.problemas.filter((p) => p.resultado === "reprovado").map((p) => p.tipo)), [])));
  const o = n === 1 ? "o arquivo" : `os ${n} arquivos`;
  const reescritos = outra === 0 ? "nenhum foi reescrito" : outra === 1 ? "1 foi reescrito" : `${outra} foram reescritos`;
  const curta =
    outra === n
      ? `${n === 1 ? "É de um arquivo reescrito" : `São de ${n} arquivos reescritos`} depois da validação.`
      : `${plural(n, "arquivo reprovado", "arquivos reprovados")}; ${reescritos} depois da validação.`;
  const onde = checagens === n ? (n === 1 ? "A checagem reprovada é" : `As ${n} checagens reprovadas são`) : `As ${checagens} checagens reprovadas estão em ${n} arquivos`;
  const oQue = tipos.length === 1 && tipos[0] === "esquema" ? "linhas com número de colunas diferente do cabeçalho" : "problemas no formato do arquivo";
  const versao =
    outra === n
      ? ` ${n === 1 ? "O arquivo foi reescrito" : `Os ${n} arquivos foram reescritos`} depois da validação: a impressão digital que o relatório julgou é diferente da que está na lista de arquivos publicados, então o relatório não diz nada sobre a versão que você baixa.`
      : outra > 0
        ? ` ${outra} de ${n} arquivos foram reescritos depois da validação: o relatório julgou outra versão deles.`
        : " O relatório julgou a mesma versão que está publicada.";
  const releitura =
    relidos === n
      ? ` Relido na construção desta página, ${n === 1 ? "o arquivo publicado tem" : "cada arquivo publicado tem"} o número de colunas do cabeçalho em todas as linhas.`
      : relidos > 0
        ? ` Relidos na construção desta página, ${relidos} dos ${n} arquivos publicados têm o número de colunas do cabeçalho em todas as linhas; os outros ainda têm linhas diferentes.`
        : ` Relidos na construção desta página, ${o} publicado${n === 1 ? "" : "s"} ainda tem linhas com número de colunas diferente do cabeçalho.`;
  const frase = `${onde} de arquivos CSV: ${oQue}.${versao}${releitura} Nada foi reaprovado à mão: o relatório da publicação continua como foi gerado.`;
  const tecnico = reprovados
    .map((e) => {
      const nome = e.caminho.split("/").pop() ?? e.caminho;
      const checagem = e.problemas.filter((p) => p.resultado === "reprovado").map((p) => `${p.tipo}: ${datasLegiveis(p.detalhe)}`).join("; ");
      const digitais = e.outraVersao ? ` Impressão digital julgada: ${e.outraVersao.julgada}. Impressão digital na lista de arquivos: ${e.outraVersao.publicada}.` : "";
      const r = e.releitura ? ` Releitura: ${num(e.releitura.linhas, 0)} linhas, ${num(e.releitura.colunas, 0)} colunas no cabeçalho, ${num(e.releitura.divergentes, 0)} linhas com número de colunas diferente.` : "";
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
  const resumo =
    `Das ${num(v.length, 0)} bases publicadas, ${alterado} ${alterado === 1 ? "foi gerada" : "foram geradas"} com código que tinha mudanças ainda não registradas (sufixo +alterado)` +
    `${limpas ? `, ${limpas} com o código todo registrado` : ""}${semVersao ? ` e ${semVersao} sem versão de código registrada` : ""}.`;
  return {
    resumo,
    sufixo:
      "A versão do código é o identificador curto da versão registrada no repositório quando a base foi gerada. O sufixo +alterado quer dizer que, nesse momento, o código tinha mudanças ainda não registradas: a base não corresponde exatamente à versão indicada, e refazê-la a partir dela pode dar um resultado diferente do publicado. O sufixo desaparece quando a base é gerada de novo com o código todo registrado.",
    alterado,
    limpas,
    semVersao,
  };
}

/* ---------------------------------------------------------------- revisões: duas leituras da mesma pergunta */

/** A ponte entre a revisão da Saúde (capturas consecutivas do mesmo arquivo) e a de Água e clima (histórico principal contra uma recaptura). */
export const TEXTO_PONTE_REVISOES =
  "A Saúde compara capturas consecutivas do mesmo arquivo e conta cada par de série e período uma vez. A página Água e clima compara, nos últimos 30 dias, o valor do histórico principal com o de uma recaptura. São critérios diferentes para a mesma pergunta, então as contagens de dias e de valores revisados não coincidem.";
