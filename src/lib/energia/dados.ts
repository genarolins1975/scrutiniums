import { dataBR, num, plural } from "./formato";
import { NAO_SE_APLICA } from "./escalas";
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
 */

/* ---------------------------------------------------------------- páginas */

export const PAGINAS_DADOS = [
  { id: "catalogo", href: "/setor-eletrico/dados", rotulo: "Catálogo", painel: "P067", pergunta: "Quais dados estão de fato validados?" },
  { id: "saude", href: "/setor-eletrico/dados/saude", rotulo: "Saúde e revisões", painel: "P068", pergunta: "O que atrasou ou mudou?" },
  { id: "reproducao", href: "/setor-eletrico/dados/reproducao", rotulo: "Download e reprodução", painel: "P069", pergunta: "Consigo reproduzir este gráfico?" },
  { id: "regras", href: "/setor-eletrico/metodologia", rotulo: "Metodologia", painel: "P070", pergunta: "Quais interpretações são permitidas?" },
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
  conjuntos: { rotulo: "Saúde por conjunto integrado (CSV)", url: "/energia/series/dados_conjuntos.csv" },
  calendario: { rotulo: "Calendário de capturas, falhas e revisões (CSV)", url: "/energia/series/dados_calendario.csv" },
  revisoes: { rotulo: "Revisões entre capturas (CSV)", url: "/energia/series/dados_revisoes.csv" },
  validacoes: { rotulo: "Validações por conjunto e por arquivo (CSV)", url: "/energia/series/dados_validacoes.csv" },
  catalogo: { rotulo: "Catálogo com a descrição completa (CSV)", url: "/energia/series/dados_catalogo.csv" },
  eixos: { rotulo: "Natureza e validação por ficha (CSV)", url: "/energia/series/dados_eixos.csv" },
  recursosCcee: { rotulo: "Recursos da CCEE, um a um (CSV)", url: "/energia/series/dados_recursos_ccee.csv" },
  recursosAneel: { rotulo: "Recursos da ANEEL, um a um (CSV)", url: "/energia/series/dados_recursos_aneel.csv" },
  recursosOns: { rotulo: "Recursos do ONS, um a um (CSV)", url: "/energia/series/dados_recursos_ons.csv" },
} as const;

/* ---------------------------------------------------------------- escada do catálogo (P067) */

export const ESTADOS_ESCADA: readonly EstadoDados[] = ["CATALOGADO", "RECURSO VERIFICADO", "INTEGRADO", "VALIDADO", "PUBLICADO"];
export const ETAPAS: readonly { id: EtapaId; estado: EstadoDados; rotulo: string }[] = [
  { id: "catalogado", estado: "CATALOGADO", rotulo: "Catalogado" },
  { id: "recurso_verificado", estado: "RECURSO VERIFICADO", rotulo: "Recurso verificado" },
  { id: "integrado", estado: "INTEGRADO", rotulo: "Integrado" },
  { id: "validado", estado: "VALIDADO", rotulo: "Validado" },
  { id: "publicado", estado: "PUBLICADO", rotulo: "Publicado" },
];

export const ROTULO_ESTADO_DADOS: Record<EstadoDados, string> = {
  CATALOGADO: "Catalogado",
  "RECURSO VERIFICADO": "Recurso verificado",
  INTEGRADO: "Integrado",
  VALIDADO: "Validado",
  PUBLICADO: "Publicado",
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
  indicador: "indicador",
  modelo: "modelo",
  conferencia: "conferência",
  contexto: "contexto",
  historico: "histórico",
};

const ROTULO_TEMA: Record<string, string> = {
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
};
export const rotuloTema = (t: string) => ROTULO_TEMA[t] ?? t;

/** "mensal" e "Mensal" são a mesma declaração: a primeira letra em maiúscula. */
function frequenciaLegivel(t: string | undefined): string {
  if (!t) return "não declarada";
  const s = t.trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "não declarada";
}

/** Linhas do catálogo para a tabela interativa; `n` é a posição em entradas (a ficha lê a entrada completa sob demanda). */
export function linhasCatalogo(cat: CatalogoDados): LinhaTabela[] {
  return cat.entradas.map((e, n) => {
    const et = situacaoEtapas(e);
    const simnao = (s: SituacaoEtapa) => (s === "sim" ? "sim" : s === "falhou" ? "falhou" : "não");
    return {
      id: e.id,
      n,
      titulo: e.titulo,
      orgao: e.orgao,
      tema: rotuloTema(e.tema),
      estado: ROTULO_ESTADO_DADOS[e.estado],
      etapas: ETAPAS.filter((x) => et[x.id] === "sim").length,
      verificado: simnao(et.recurso_verificado),
      integrado: simnao(et.integrado),
      validado: simnao(et.validado),
      publicado: simnao(et.publicado),
      uso: (e.papeis ?? []).length ? (e.papeis ?? []).map((p) => ROTULO_PAPEL[p] ?? p).join(" e ") : e.usado_em.length ? "indicador" : "sem uso declarado",
      ressalva: (e.ressalvas ?? []).length ? "sim" : "não",
      frequencia: frequenciaLegivel(e.frequencia_declarada),
      modificado: e.modificado_na_fonte ?? e.recursos_resumo?.ultimo_publicado ?? null,
      recursos: e.recursos_resumo?.total ?? null,
      descontinuado: e.descontinuado ? "sim" : "não",
      formatos: (e.formatos ?? []).join(", ") || null,
    };
  });
}

export const COLUNAS_CATALOGO: ColunaTabela[] = [
  { id: "titulo", rotulo: "Conjunto", tipo: "texto" },
  { id: "orgao", rotulo: "Órgão", tipo: "texto", categorica: true },
  { id: "tema", rotulo: "Tema", tipo: "texto", categorica: true },
  { id: "estado", rotulo: "Estado alcançado", tipo: "texto", categorica: true },
  { id: "etapas", rotulo: "Etapas cumpridas (de 5)", tipo: "numero", casas: 0 },
  { id: "verificado", rotulo: "Recurso verificado", tipo: "texto", categorica: true },
  { id: "integrado", rotulo: "Integrado", tipo: "texto", categorica: true },
  { id: "validado", rotulo: "Validado", tipo: "texto", categorica: true },
  { id: "publicado", rotulo: "Publicado", tipo: "texto", categorica: true },
  { id: "uso", rotulo: "Uso declarado", tipo: "texto", categorica: true },
  { id: "ressalva", rotulo: "Ressalva declarada", tipo: "texto", categorica: true },
  { id: "descontinuado", rotulo: "Descontinuado pela fonte", tipo: "texto", categorica: true },
  { id: "frequencia", rotulo: "Frequência declarada pela fonte", tipo: "texto", categorica: true },
  { id: "modificado", rotulo: "Modificado na fonte", tipo: "data" },
  { id: "recursos", rotulo: "Recursos (arquivos)", tipo: "numero", casas: 0 },
  { id: "formatos", rotulo: "Formatos", tipo: "texto", ordenavel: false },
];

/** Página oficial do conjunto: a URL da entrada ou a do portal seguida do nome (campo `compactacao` do catálogo). */
export function urlOficial(e: Pick<EntradaDados, "id" | "orgao" | "url">, portais: CatalogoDados["portais"]): string | null {
  if (e.url) return e.url;
  const base = portais[e.orgao]?.url_conjunto;
  return base ? base + e.id.slice(e.id.indexOf(":") + 1) : null;
}

const ORIGEM_CATALOGO: Record<string, string> = {
  listagem: "listagem oficial do portal",
  package_show: "package_show versionado no repositório",
  registro: "registro de um módulo do pipeline",
  manual: "cadastro manual do projeto",
};
const VIA_RECURSO: Record<string, string> = {
  captura: "arquivo baixado e guardado com sha256",
  requisicao_parcial: "leitura parcial do arquivo (primeiros 64 KB)",
  captura_outro_dataset: "arquivo capturado por outro conjunto",
};

export type EvidenciaEtapa = { id: EtapaId; rotulo: string; situacao: SituacaoEtapa; detalhe: string };

const dia = (iso: string | undefined) => (iso ? dataBR(iso.slice(0, 10)) : null);

/**
 * A evidência de cada etapa da escada de uma entrada, escrita só com o que o catálogo publica.
 * Etapa não alcançada diz isso, e a falha do recurso diz a falha: nenhuma etapa é preenchida por inferência.
 */
export function evidenciaEtapas(e: EntradaDados): EvidenciaEtapa[] {
  const sit = situacaoEtapas(e);
  const et = e.etapas;
  const ver = et?.recurso_verificado ?? e.verificacao;
  const out: EvidenciaEtapa[] = [];

  const origem = ORIGEM_CATALOGO[et?.catalogado?.origem ?? e.catalogado?.origem ?? "listagem"] ?? "listagem oficial do portal";
  out.push({ id: "catalogado", rotulo: "Catalogado", situacao: sit.catalogado, detalhe: `${origem}; ${e.metadados_verificados ? "metadados verificados" : "metadados não verificados na fonte"}.` });

  let dv = "nenhum arquivo do conjunto foi acessado pelo pipeline.";
  if (sit.recurso_verificado === "falhou") dv = `tentativa registrada, sem êxito${e.verificacao?.detalhe ? `: ${e.verificacao.detalhe}` : ""}.`;
  else if (sit.recurso_verificado === "sim") {
    const partes = [ver?.via ? VIA_RECURSO[ver.via] : "arquivo acessado pelo pipeline"];
    if (ver?.recurso) partes.push(`recurso ${ver.recurso}`);
    if (ver?.formato) partes.push(`formato ${ver.formato}`);
    if (ver?.colunas) partes.push(`${plural(ver.colunas, "coluna", "colunas")} no cabeçalho`);
    if (ver?.arquivos) partes.push(plural(ver.arquivos, "arquivo", "arquivos"));
    if (ver?.capturas) partes.push(plural(ver.capturas, "captura", "capturas"));
    if (ver?.em) partes.push(`em ${dia(ver.em)}`);
    dv = `${partes.join("; ")}.`;
  }
  out.push({ id: "recurso_verificado", rotulo: "Recurso verificado", situacao: sit.recurso_verificado, detalhe: dv });

  const integ = et?.integrado;
  let di = "o conjunto não está declarado na integração de nenhum módulo, ou a integração não passou da verificação do recurso.";
  if (sit.integrado === "sim") {
    const p: string[] = [];
    if (integ?.observacoes) p.push(`${num(integ.observacoes, 0)} observações no histórico de capturas`);
    if (integ?.registros) p.push(`${num(integ.registros, 0)} registros`);
    if (integ?.documento) p.push("documento original guardado para citação");
    if (integ?.leitura_do_original) p.push("lido direto do original, com o snapshot citado pela gold");
    di = `${p.length ? p.join("; ") : "capturas com sha256 no histórico"}.`;
  }
  out.push({ id: "integrado", rotulo: "Integrado", situacao: sit.integrado, detalhe: di });

  const val = et?.validado;
  let dval = "sem validação registrada, porque a integração não foi concluída.";
  if (sit.validado === "sim") {
    const p = [val?.resultado ? `resultado ${val.resultado.replace("_", " ")}` : "sem checagem reprovada"];
    if (val?.aprovadas !== undefined) p.push(plural(val.aprovadas, "checagem aprovada", "checagens aprovadas"));
    if (val?.ressalvas) p.push(plural(val.ressalvas, "ressalva", "ressalvas"));
    if (val?.reprovadas) p.push(plural(val.reprovadas, "reprovada", "reprovadas"));
    dval = `${p.join("; ")}.`;
  }
  out.push({ id: "validado", rotulo: "Validado", situacao: sit.validado, detalhe: dval });

  const pub = et?.publicado;
  let dp = "não alimenta nenhuma gold íntegra publicada.";
  if (sit.publicado === "sim") {
    const golds = pub?.golds ?? e.usado_em;
    dp = golds.length ? `alimenta ${golds.join(", ")}.` : "alimenta as golds do módulo dono do conjunto.";
    if (pub?.citado_por?.length) dp += ` Citado no snapshot de ${pub.citado_por.join(", ")}.`;
  }
  out.push({ id: "publicado", rotulo: "Publicado", situacao: sit.publicado, detalhe: dp });
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
    `${num(r.total, 0)} conjuntos catalogados em ${plural(r.orgaos, "órgão", "órgãos")}.`,
    `${num(c["RECURSO VERIFICADO"], 0)} tiveram ao menos um arquivo acessado pelo pipeline, ${num(c.INTEGRADO, 0)} foram integrados, ${num(c.VALIDADO, 0)} passaram na validação sem checagem reprovada e ${num(c.PUBLICADO, 0)} alimentam uma gold íntegra publicada.`,
  ];
  if (r.usadasAbaixo.length)
    partes.push(
      `${plural(r.usadasAbaixo.length, "conjunto declara", "conjuntos declaram")} uso em indicador sem ter passado da verificação do recurso, e cada um aparece com a ressalva escrita.`,
    );
  partes.push(`${plural(r.descontinuados, "conjunto é descontinuado", "conjuntos são descontinuados")} segundo a própria fonte.`);
  return partes.join(" ");
}

const TEXTO_ATUALIDADE: Record<SituacaoAtualidade, string> = {
  "EM DIA": "em dia",
  ATRASADO: "atrasado",
  "SEM SLA": "sem SLA (a fonte não declara frequência)",
  "SEM DADO": "sem dado para medir",
};

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
  const p: string[] = [`Integração ${c.id}, estado ${ROTULO_ESTADO_DADOS[c.estado].toLowerCase()}.`];
  const integ = e.integrado;
  if (integ.ok) {
    const q: string[] = [];
    if (integ.observacoes) q.push(`${num(integ.observacoes, 0)} observações`);
    if (integ.registros) q.push(`${num(integ.registros, 0)} registros`);
    if (integ.documento) q.push("documento original guardado");
    if (integ.leitura_do_original) q.push("lido do original");
    p.push(`Integrado: ${q.length ? q.join(", ") : "capturas com sha256"}${c.capturas.ultima ? `; última captura em ${dataBR(c.capturas.ultima.slice(0, 10))}` : ""}.`);
  } else p.push("Integrado: não alcançado.");
  const v = e.validado;
  if (v.ok) {
    const q = [v.resultado ? `resultado ${v.resultado.replace("_", " ")}` : "sem checagem reprovada"];
    if (v.aprovadas !== undefined) q.push(plural(v.aprovadas, "checagem aprovada", "checagens aprovadas"));
    if (v.ressalvas) q.push(plural(v.ressalvas, "ressalva", "ressalvas"));
    if (v.reprovadas) q.push(plural(v.reprovadas, "reprovada", "reprovadas"));
    p.push(`Validado: ${q.join("; ")}.`);
  } else p.push("Validado: não alcançado.");
  if (e.publicado.ok) p.push(`Publicado: alimenta ${(e.publicado.golds ?? c.golds).join(", ") || "as golds do módulo"}.`);
  const a = c.atualidade;
  p.push(
    `Atualidade: ${TEXTO_ATUALIDADE[a.situacao]}${a.ultimo_periodo ? `; último período disponível ${refLegivel(a.ultimo_periodo)}` : ""}${a.dias_atraso ? `; ${plural(a.dias_atraso, "dia", "dias")} além do prazo` : ""}.`,
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
  { id: "conjunto", rotulo: "Conjunto", tipo: "texto" },
  { id: "recurso", rotulo: "Recurso (arquivo)", tipo: "texto" },
  { id: "estado", rotulo: "Estado do recurso", tipo: "texto", categorica: true },
  { id: "formato", rotulo: "Formato", tipo: "texto", categorica: true },
  { id: "publicado_em", rotulo: "Publicado na fonte em", tipo: "data" },
  { id: "via", rotulo: "Como foi acessado", tipo: "texto", categorica: true },
  { id: "capturas", rotulo: "Capturas com sha256", tipo: "numero", casas: 0 },
  { id: "ultima_captura", rotulo: "Última captura", tipo: "data" },
  { id: "verificado_em", rotulo: "Verificado em", tipo: "data" },
  { id: "presente", rotulo: "Na listagem atual", tipo: "texto", categorica: true },
];

export function linhasRecursos(csv: RecursoCsv[]): LinhaTabela[] {
  return csv.map((r) => ({
    id: r.recurso_id,
    conjunto: r.conjunto,
    recurso: r.recurso,
    estado: ROTULO_ESTADO_DADOS[r.estado as EstadoDados] ?? r.estado,
    formato: r.formato || null,
    publicado_em: r.publicado_em ? r.publicado_em.slice(0, 10) : null,
    via: r.via || (r.estado === "CATALOGADO" ? "não acessado" : null),
    capturas: r.capturas === "" ? null : Number(r.capturas),
    ultima_captura: r.ultima_captura ? r.ultima_captura.slice(0, 10) : null,
    verificado_em: r.verificado_em ? r.verificado_em.slice(0, 10) : null,
    presente: r.presente === "1" ? "sim" : "removido pela fonte",
  }));
}

/* ---------------------------------------------------------------- saúde e revisões (P068) */

export const ROTULO_SITUACAO: Record<SituacaoAtualidade, string> = {
  "EM DIA": "Em dia",
  ATRASADO: "Atrasado",
  "SEM SLA": "Sem SLA",
  "SEM DADO": "Sem dado",
};

const ROTULO_FORMATO_REF: Record<string, string> = {
  horaria: "hora",
  diaria: "dia",
  mensal: "mês",
  trimestral: "trimestre",
  anual: "ano",
  intervalo: "intervalo",
  vigencia: "vigência",
  nao_temporal: "sem referência temporal",
  misto: "misto",
};

/** Módulos e família do conjunto, em texto. */
const rotuloFamilia = (id: string) => id.split("/")[0].replace(/_/g, " ");

export function linhasSaude(pub: PublicacaoGold): LinhaTabela[] {
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
      frequencia: c.frequencia.declarada ? frequenciaLegivel(c.frequencia.declarada) : "não declarada",
      caso: a.caso ?? null,
      grao: d ? (ROTULO_FORMATO_REF[d.formato ?? ""] ?? d.granularidade) : null,
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
      atras_fonte: c.capturas.fonte_mais_nova ? "sim" : "não",
      descontinuado: c.descontinuado ? "sim" : "não",
    };
  });
}

export const COLUNAS_SAUDE: ColunaTabela[] = [
  { id: "titulo", rotulo: "Conjunto", tipo: "texto" },
  { id: "familia", rotulo: "Família", tipo: "texto", categorica: true },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "frequencia", rotulo: "Frequência declarada pela fonte", tipo: "texto", categorica: true },
  { id: "caso", rotulo: "Caso do SLA", tipo: "texto", categorica: true },
  { id: "grao", rotulo: "Grão do dado", tipo: "texto", categorica: true },
  { id: "ultimo_periodo", rotulo: "Último período disponível", tipo: "texto" },
  { id: "prazo", rotulo: "Prazo do próximo período", tipo: "data" },
  { id: "atraso", rotulo: "Atraso", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "captura", rotulo: "Última captura", tipo: "data" },
  { id: "completude", rotulo: "Completude interna", tipo: "percentual", casas: 1 },
  { id: "cobertura", rotulo: "Séries no último período", tipo: "percentual", casas: 1 },
  { id: "tentativas", rotulo: "Tentativas de coleta", tipo: "numero", casas: 0 },
  { id: "falhas", rotulo: "Falhas de coleta", tipo: "numero", casas: 0 },
  { id: "ultima_falha", rotulo: "Última falha", tipo: "data" },
  { id: "revisoes", rotulo: "Observações revisadas", tipo: "numero", casas: 0 },
  { id: "maior_rel", rotulo: "Maior revisão relativa", tipo: "percentual", casas: 1 },
  { id: "atras_fonte", rotulo: "Fonte com arquivo mais novo", tipo: "texto", categorica: true },
  { id: "descontinuado", rotulo: "Descontinuado", tipo: "texto", categorica: true },
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
    `Na data de referência desta publicação (${dataBR(r.hoje)}), dos ${num(r.integracoes, 0)} conjuntos integrados, ${num(s["EM DIA"] ?? 0, 0)} estavam em dia, ${num(s.ATRASADO ?? 0, 0)} atrasado${(s.ATRASADO ?? 0) === 1 ? "" : "s"}, ${num(s["SEM SLA"] ?? 0, 0)} sem SLA (a fonte não declara frequência) e ${num(s["SEM DADO"] ?? 0, 0)} sem dado para medir.`,
  ];
  if (r.atrasados.length)
    partes.push(
      `${r.atrasados.map((c) => `${c.titulo} está ${plural(c.atualidade.dias_atraso ?? 0, "dia", "dias")} além do prazo`).join("; ")}.`,
    );
  if (r.comRevisao.length)
    partes.push(
      `${plural(r.comRevisao.length, "conjunto teve", "conjuntos tiveram")} valores revisados entre capturas do mesmo arquivo: ${num(r.observacoesRevisadas, 0)} observações em ${num(r.referenciasRevisadas, 0)} referências.`,
    );
  partes.push(
    `${plural(r.comFalha.length, "conjunto registra", "conjuntos registram")} falha de coleta e, em ${num(r.atrasFonte.length, 0)}, a fonte publicou arquivo mais novo que a última captura.`,
  );
  return partes.join(" ");
}

export const ROTULO_CADENCIA: Record<Cadencia | "sem", string> = {
  diaria: "Diária",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  sem: "Sem cadência declarada",
};
const ORDEM_CADENCIA: readonly (Cadencia | "sem")[] = ["diaria", "semanal", "quinzenal", "mensal", "trimestral", "anual", "sem"];

export type LinhaCadencia = { cadencia: Cadencia | "sem"; rotulo: string; tolerancia: number | null; "EM DIA": number; ATRASADO: number; "SEM DADO": number; "SEM SLA": number; total: number };

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
  { id: "fonte", rotulo: "Publicações da fonte", detalhe: "arquivos cuja data de modificação na fonte cai no dia", unidade: "arquivos", campo: "publicacoes_fonte", deCaptura: false },
  { id: "capturas", rotulo: "Capturas novas", detalhe: "arquivos baixados com conteúdo novo (vintage nova com sha256)", unidade: "capturas", campo: "capturas_novas", deCaptura: true },
  { id: "recapturas", rotulo: "Recapturas sem mudança", detalhe: "downloads idênticos a uma vintage já guardada", unidade: "recapturas", campo: "recapturas_sem_mudanca", deCaptura: true },
  { id: "falhas", rotulo: "Falhas de coleta", detalhe: "tentativas que não trouxeram o arquivo", unidade: "falhas", campo: "falhas", deCaptura: true },
  { id: "revisoes", rotulo: "Observações revisadas", detalhe: "pares série e referência com valor diferente do da captura anterior", unidade: "observações", campo: "observacoes_revisadas", deCaptura: true },
];

export const ESCALA_CALENDARIO: Record<MedidaCalendario, { limites: number[]; rotulos: string[] }> = {
  capturas: { limites: [1, 10, 100, 1000], rotulos: ["nenhuma", "1 a 9", "10 a 99", "100 a 999", "1.000 ou mais"] },
  recapturas: { limites: [1, 10, 100, 300], rotulos: ["nenhuma", "1 a 9", "10 a 99", "100 a 299", "300 ou mais"] },
  falhas: { limites: [1, 2, 5, 10], rotulos: ["nenhuma", "1", "2 a 4", "5 a 9", "10 ou mais"] },
  revisoes: { limites: [1, 100, 1000, 3000], rotulos: ["nenhuma", "1 a 99", "100 a 999", "1.000 a 2.999", "3.000 ou mais"] },
  fonte: { limites: [1, 5, 20, 40], rotulos: ["nenhuma", "1 a 4", "5 a 19", "20 a 39", "40 ou mais"] },
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
    semanas.push({ id: paraIso(comeco), rotulo: `semana de ${dataBR(paraIso(comeco))}`, curto: dataBR(paraIso(comeco)).slice(0, 5) });
  }
  return {
    semanas,
    dias: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((r) => ({ id: r, rotulo: r })),
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
  [/^(pld|cmo)_/, "PLD"],
  [/^(ear|ena)_/, "Água e clima"],
  [/^carga_/, "Carga"],
  [/^geracao_/, "Geração"],
  [/^intercambio_/, "Rede"],
  [/^previsoes_/, "Previsões e modelos"],
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
  if (caminho.startsWith("/energia/gold/")) return MODULO_DA_GOLD[nome] ?? "módulo não identificado";
  if (caminho.startsWith("/energia/geo/")) return "Geometrias compartilhadas";
  const p = PREFIXO_SERIE.find(([r]) => r.test(nome));
  return p ? p[1] : "módulo não identificado";
}

export const COLUNAS_MANIFESTO: ColunaTabela[] = [
  { id: "caminho", rotulo: "Arquivo", tipo: "texto" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "modulo", rotulo: "Módulo", tipo: "texto", categorica: true },
  { id: "kb", rotulo: "Tamanho", tipo: "numero", unidade: "KB", casas: 1 },
  { id: "linhas", rotulo: "Linhas", tipo: "numero", casas: 0 },
  { id: "colunas", rotulo: "Colunas", tipo: "numero", casas: 0 },
  { id: "dicionario", rotulo: "Dicionário publicado", tipo: "texto", categorica: true },
  { id: "parquet", rotulo: "Parquet equivalente", tipo: "texto", categorica: true },
  { id: "sha256", rotulo: "sha256", tipo: "texto", ordenavel: false },
];

const ROTULO_TIPO_ARQUIVO: Record<ItemManifesto["tipo"], string> = { gold: "gold", serie: "série", parquet: "Parquet", geometria: "geometria" };

export function linhasManifesto(m: ManifestoGold, dic: Record<string, { gold: string }>): LinhaTabela[] {
  return m.arquivos.map((a) => ({
    id: a.caminho,
    caminho: a.caminho.replace(/^\/energia\//, ""),
    tipo: ROTULO_TIPO_ARQUIVO[a.tipo],
    modulo: moduloDoArquivo(a.caminho, dic),
    kb: a.bytes / 1024,
    linhas: a.linhas ?? null,
    colunas: a.colunas ? a.colunas.length : null,
    dicionario: a.tipo === "serie" && a.caminho.endsWith(".csv") ? (a.dicionario ? "sim" : "não") : "não se aplica",
    parquet: a.parquet ? "sim" : a.caminho.endsWith(".csv") ? "não" : "não se aplica",
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
  const partes = [
    `Todo arquivo publicado tem o sha256 no manifesto da publicação (${num(m.totais.arquivos, 0)} arquivos, ${num(m.totais.bytes / 1024 / 1024, 0)} MB), e o id da publicação, ${m.id_publicacao.slice(0, 12)}, resume a lista inteira.`,
    c.conferidos === c.total
      ? `Na construção desta página, os ${num(c.total, 0)} arquivos entregues tinham o sha256 do manifesto.`
      : `Na construção desta página, ${num(c.divergentes.length + c.ausentes.length, 0)} de ${num(c.total, 0)} arquivos não conferiram com o manifesto (lista no modo Auditar).`,
    `${num(pq.equivalentes, 0)} de ${num(pq.arquivos, 0)} arquivos Parquet foram conferidos célula a célula contra o CSV.`,
    "A tabela de cada painel exporta CSV e XLSX das linhas filtradas, com fonte, versão e dicionário.",
  ];
  return partes.join(" ");
}

export function afirmacoesConferidas(pub: PublicacaoGold): { afirmacao: Afirmacao; conferida: boolean; motivo: string | null }[] {
  return pub.afirmacoes.map((a) => {
    const abaixo = a.conjuntos.filter((c) => rankEstado(c.estado) < rankEstado("RECURSO VERIFICADO"));
    if (a.ausentes_no_catalogo.length) return { afirmacao: a, conferida: false, motivo: `conjunto fora do catálogo: ${a.ausentes_no_catalogo.join(", ")}` };
    if (abaixo.length) return { afirmacao: a, conferida: false, motivo: `conjunto só catalogado: ${abaixo.map((c) => c.id).join(", ")}` };
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

const MODULO_DA_GOLD: Record<string, string> = {
  "pld.json": "PLD",
  "cmo.json": "PLD",
  "hidrologia.json": "Água e clima",
  "carga.json": "Carga",
  "geracao.json": "Geração",
  "rede.json": "Rede",
  "modelos.json": "Previsões e modelos",
  "previsoes.json": "Previsões e modelos",
  "catalogo.json": "Dados e metodologia",
  "meta.json": "Dados e metodologia",
  "metricas.json": "Dados e metodologia",
  "arquivos.json": "Dados e metodologia",
  "avaliacao.json": "Dados e metodologia",
  "agua_detalhe.json": "Água e clima",
  "carga_detalhe.json": "Carga",
  "conta.json": "Conta de luz",
  "empresas.json": "Empresas",
  "expansao.json": "Expansão",
  "geracao_detalhe.json": "Geração",
  "inclusao.json": "Inclusão energética",
  "mercado.json": "Mercado",
  "perdas.json": "Perdas",
  "pld_detalhe.json": "PLD",
  "previsoes_desempenho.json": "Previsões e modelos",
  "previsoes_desempenho_interno.json": "Previsões e modelos",
  "publicacao.json": "Dados e metodologia",
  "manifesto.json": "Dados e metodologia",
  "qualidade.json": "Qualidade do serviço",
  "rede_detalhe.json": "Rede",
  "regulacao.json": "Regulação",
  "sintese.json": "Visão geral",
  "territorio.json": "Minha região",
  "transicao.json": "Transição e ambiente",
};
export const moduloDaGold = (gold: string) => MODULO_DA_GOLD[gold] ?? gold.replace(/\.json$/, "");

const ROTULO_NATUREZA: Record<string, string> = { OBSERVADO: "Observado", CALCULADO: "Calculado", ESTIMADO: "Estimado", PREVISTO: "Previsto", CENARIO: "Cenário" };

/** Natureza escrita por extenso na ficha: o rótulo quando é uma só, o texto da regra quando é mista. */
export const rotuloNatureza = (n: string): string => ROTULO_NATUREZA[n] ?? n;

/** "MISTO: OBSERVADO (…) e ESTIMADO (…)" vira "Mista"; o texto completo fica na ficha. */
export function naturezaCurta(n: string): string {
  if (n.startsWith("MISTO") || n.includes(" e ")) return "Mista";
  return ROTULO_NATUREZA[n] ?? n.charAt(0) + n.slice(1).toLowerCase();
}

export const COLUNAS_METRICAS: ColunaTabela[] = [
  { id: "titulo", rotulo: "Indicador", tipo: "texto" },
  { id: "modulo", rotulo: "Módulo", tipo: "texto", categorica: true },
  { id: "natureza_fonte", rotulo: "Natureza do dado de origem", tipo: "texto", categorica: true },
  { id: "natureza_calculo", rotulo: "Natureza do resultado", tipo: "texto", categorica: true },
  { id: "unidade", rotulo: "Unidade", tipo: "texto" },
  { id: "grao_geografico", rotulo: "Recorte geográfico", tipo: "texto" },
  { id: "grao_temporal", rotulo: "Recorte temporal", tipo: "texto" },
  { id: "formula", rotulo: "Tem fórmula publicada", tipo: "texto", categorica: true },
  { id: "paginas", rotulo: "Páginas", tipo: "numero", casas: 0 },
];

export function linhasMetricas(ms: readonly MetricaPublicada[]): LinhaTabela[] {
  return ms.map((m, n) => ({
    id: m.id,
    n,
    titulo: m.titulo,
    modulo: moduloDaGold(m.gold),
    natureza_fonte: naturezaCurta(m.natureza_fonte),
    natureza_calculo: naturezaCurta(m.natureza_transformacao),
    unidade: m.unidade,
    grao_geografico: m.grao_geografico,
    grao_temporal: m.grao_temporal,
    formula: m.formula ? "sim" : "não",
    paginas: m.paginas.length,
  }));
}

export type ResumoMetricas = { total: number; modulos: number; comFormula: number; observadas: number; mistas: number; semPagina: number };

export function resumoMetricas(ms: readonly MetricaPublicada[]): ResumoMetricas {
  return {
    total: ms.length,
    modulos: new Set(ms.map((m) => moduloDaGold(m.gold))).size,
    comFormula: ms.filter((m) => m.formula).length,
    observadas: ms.filter((m) => m.natureza_fonte === "OBSERVADO").length,
    mistas: ms.filter((m) => naturezaCurta(m.natureza_fonte) === "Mista").length,
    semPagina: ms.filter((m) => m.paginas.length === 0).length,
  };
}

export function respostaRegras(r: ResumoMetricas): string {
  return `Cada um dos ${num(r.total, 0)} indicadores publicados em ${r.modulos} módulos tem definição, unidade, recorte geográfico e temporal, regra de agregação, regra de cobertura, política de ausência, validações e limitações escritas; ${num(r.comFormula, 0)} têm fórmula publicada e ${num(r.observadas, 0)} usam dado de origem observado. A lista abaixo é a mesma que o pipeline usa para calcular: uma regra que não está nela não é aplicada.`;
}

/** Link para o arquivo de código que implementa a regra, na versão do ramo principal. */
export const urlCodigoMetrica = (arquivo: string) => `https://github.com/genarolins1975/scrutiniums/blob/main/${arquivo}`;

