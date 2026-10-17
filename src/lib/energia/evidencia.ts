import type { Download, Periodo } from "@/lib/energia/tipos";
import { dataBR, nomeMes, num, pct, reais, sinal } from "@/lib/energia/formato";
import { idiomaEnergia, tx, tx as traduz } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";
import { MENSAGEM_COPIA_EN } from "@/lib/energia/i18n/nucleo";
import { rotuloFicha, valorExibidoNoIdioma as valorFichaNoIdioma } from "@/lib/energia/i18n/aprenda";
import { hrefNoIdioma } from "@/lib/i18n-href";

/**
 * Evidência "Comprove este número" (seção 11.5 da especificação): contrato do
 * objeto que o pipeline anexa às golds (pipeline/energia/evidencia.py monta e
 * valida o mesmo dicionário, com as chaves na mesma ordem) e a lógica pura que a
 * interface usa para exibi-lo.
 *
 * Por que um contrato próprio, separado da `Proveniencia`: a proveniência (drawer
 * "Sobre este dado") descreve uma SÉRIE inteira: fonte, frequência, cobertura
 * histórica, transformações. A evidência comprova UM número exibido (um KPI, uma
 * célula, um agregado de gráfico): o valor antes do arredondamento, o arquivo
 * exato e o seu sha256, as chaves das observações que entraram na conta, a fórmula
 * com numerador e denominador, os testes e a reconciliação, e como refazer a conta.
 *
 * A citação publicada pelo pipeline não tem data de acesso, porque a data é do
 * leitor: `citacaoAcademica` a acrescenta no momento da leitura (horário de
 * Brasília). `citacaoBase` e `textoPeriodo` seguem exatamente as funções
 * `citacao` e `texto_periodo` do Python; os dois lados têm teste com o mesmo
 * exemplo e o mesmo texto esperado, para que não divirjam em silêncio.
 *
 * Idioma: na página inglesa, os textos da prova (citação, reprodução, resumos, avisos) saem em inglês e os números
 * no formato inglês; a forma portuguesa é a que espelha o Python e não muda.
 */

/* ---------------------------------------------------------------- contrato */

export type ResultadoTeste = "aprovado" | "ressalva" | "reprovado";
export const RESULTADOS: readonly ResultadoTeste[] = ["aprovado", "ressalva", "reprovado"];

/** Um arquivo capturado: o sha256 prova a identidade do arquivo, não a acurácia do número. */
export type ArquivoEvidencia = {
  recurso: string | null;
  arquivo: string | null;
  sha256: string | null;
  capturado_em: string | null;
  /** Data de publicação pela fonte; null quando a fonte não informa (nunca inventada). */
  publicado_em: string | null;
};

export type FonteEvidencia = ArquivoEvidencia & {
  orgao: string;
  conjunto: string;
  url: string;
  /** Número que usa mais de um arquivo (anos diferentes, por exemplo). */
  arquivos?: ArquivoEvidencia[] | null;
};

/** Número extraído de PDF: documento, edição, página ou tabela e como a extração foi conferida. */
export type ExtracaoPdf = { documento: string; edicao: string; pagina: string; conferencia: string };

export type TermoRazao = { descricao: string; valor: number | null };

export type TesteEvidencia = { nome: string; resultado: ResultadoTeste; detalhe: string };

/** Conferência por outro caminho ou outro produto; tolerância é texto com unidade ("0,005 R$/MWh"). */
export type Reconciliacao = { descricao: string; resultado: ResultadoTeste; tolerancia: string };

export type VersaoEvidencia = {
  pipeline: string;
  /** Commit curto; sufixo "+alterado" quando o código tinha alteração fora do commit. */
  codigo: string | null;
  /** Carimbo UTC da publicação da gold. */
  publicacao: string;
};

export type Evidencia = {
  indicador: string;
  /** Texto exatamente como aparece na tela ("R$ 0,8123/kWh"); "sem dado" quando ausente. */
  valor_exibido: string;
  /** Valor antes do arredondamento; null é ausência (nunca zero). */
  valor_calculo: number | null;
  unidade: string;
  periodo: Periodo;
  entidade: string;
  universo: string;
  filtros: string[];
  fonte: FonteEvidencia;
  extracao_pdf?: ExtracaoPdf | null;
  /** Chaves das observações de origem (no máximo 50; acima disso, consulta e manifesto). */
  chaves_origem: string[];
  /** Contagem real quando a lista foi truncada. */
  chaves_total?: number | null;
  /** Consulta que seleciona as observações (alternativa ou complemento às chaves). */
  consulta?: string | null;
  /** Lista completa das chaves para baixar. */
  manifesto?: Download | null;
  formula: string;
  numerador?: TermoRazao | null;
  denominador?: TermoRazao | null;
  pesos?: string | null;
  exclusoes: string[];
  cobertura: string;
  tratamento_ausencia: string;
  versao: VersaoEvidencia;
  revisoes: string;
  testes: TesteEvidencia[];
  reconciliacao: Reconciliacao | null;
  download: Download[];
  /** Comando ou passos (uma linha por passo) que refazem o número. */
  reproducao: string;
  /** Citação sem data de acesso (a interface acrescenta). */
  citacao: string;
};

/**
 * Nome com que o leitor reconhece os conjuntos cujo código é o nome técnico da fonte. É a leitura palavra por palavra do
 * próprio código (acentuação e preposições restauradas), sem acrescentar significado que o código não tenha.
 */
/* forma portuguesa: leitura do código; a inglesa (NOME_DO_CONJUNTO_EN) traduz a mesma leitura */
const NOME_DO_CONJUNTO: Record<string, string> = { // i18n: dado
  pld_horario: "PLD horário por submercado",
  agente_qtd_contabilizacao: "quantidade de agentes na contabilização", // i18n: dado
  consumo_classe_agente: "consumo por classe de agente", // i18n: dado
  consumo_mensal_ambiente_comercializacao: "consumo mensal por ambiente de comercialização", // i18n: dado
  encargo_ess_ancilar: "encargo de serviço ancilar (ESS)", // i18n: dado
  encargo_pgto_mensal: "pagamento mensal de encargos", // i18n: dado
  garantia_fisica_sazo_mre_submercado: "garantia física sazonalizada do MRE por submercado", // i18n: dado
  geracao_submercado: "geração por submercado", // i18n: dado
  lista_agente_associado: "lista de agentes associados", // i18n: dado
  lista_perfil_v1: "lista de perfis (versão 1)", // i18n: dado
  mre_mensal: "MRE mensal",
  parcela_carga_consumo: "parcela de carga de consumo", // i18n: dado
  rd_encargos_contab_mensal: "encargos na contabilização mensal", // i18n: dado
  reserva_encargo: "encargo de reserva", // i18n: dado
  sumario_mensal_compra_venda_submercado: "sumário mensal de compra e venda por submercado", // i18n: dado
  sumario_mensal_liquidacao: "sumário mensal da liquidação", // i18n: dado
  aneel_continuidade: "indicadores de continuidade (ANEEL)", // i18n: dado
  aneel_samp_balanco: "balanço do SAMP (ANEEL)", // i18n: dado
  aneel_scs: "SCS (ANEEL)",
  aneel_tarifas_aplicacao: "tarifas de aplicação (ANEEL)", // i18n: dado
  desligamento_compulsorio: "desligamento compulsório", // i18n: dado
  desligamento_voluntario: "desligamento voluntário", // i18n: dado
  imerg_prectot: "precipitação total (IMERG)", // i18n: dado
};

const NOME_DO_CONJUNTO_EN: Record<string, string> = {
  pld_horario: "hourly PLD by submarket",
  agente_qtd_contabilizacao: "number of agents in settlement accounting",
  consumo_classe_agente: "consumption by agent class",
  consumo_mensal_ambiente_comercializacao: "monthly consumption by contracting environment",
  encargo_ess_ancilar: "ancillary service charge (ESS)",
  encargo_pgto_mensal: "monthly payment of charges",
  garantia_fisica_sazo_mre_submercado: "seasonalized MRE physical guarantee by submarket",
  geracao_submercado: "generation by submarket",
  lista_agente_associado: "list of member agents",
  lista_perfil_v1: "list of profiles (version 1)",
  mre_mensal: "monthly MRE",
  parcela_carga_consumo: "consumption load share",
  rd_encargos_contab_mensal: "charges in monthly settlement accounting",
  reserva_encargo: "reserve charge",
  sumario_mensal_compra_venda_submercado: "monthly purchase and sale summary by submarket",
  sumario_mensal_liquidacao: "monthly settlement summary",
  aneel_continuidade: "continuity indicators (ANEEL)",
  aneel_samp_balanco: "SAMP balance (ANEEL)",
  aneel_scs: "SCS (ANEEL)",
  aneel_tarifas_aplicacao: "application tariffs (ANEEL)",
  desligamento_compulsorio: "compulsory disconnection",
  desligamento_voluntario: "voluntary disconnection",
  imerg_prectot: "total precipitation (IMERG)", // i18n: dado
};

const CODIGO_NO_TEXTO = /(?<![\w])(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|[a-z][a-z0-9]*(?:_[a-z0-9]+)+)(?![\w])/g;

/**
 * Nome do conjunto da fonte como o leitor o lê, mais os códigos técnicos que ficaram de fora. Códigos de conjunto da
 * CCEE (PLD_HORARIO, mre_mensal) saem do texto de Entender e vão para Analisar: o nome legível vem do dicionário acima,
 * do texto entre parênteses que a própria fonte já traz ("PLD_HORARIO (PLD horário por submercado)") ou, na falta de
 * ambos, do próprio código com espaços no lugar do sublinhado. Vale para o código em qualquer posição do texto
 * ("GERACAO_SUBMERCADO e MRE_MENSAL", "PLD_HORARIO; Balanço de Energia nos Subsistemas").
 */
export function conjuntoLegivel(conjunto: string, idioma: Idioma = idiomaEnergia()): { texto: string; codigos: string[] } {
  const codigos: string[] = [];
  const nomes = tx(NOME_DO_CONJUNTO, NOME_DO_CONJUNTO_EN, idioma);
  const legivel = (cod: string) => nomes[cod.toLowerCase()] ?? cod.replace(/_/g, " ").toLowerCase();
  const comParenteses = conjunto.replace(new RegExp(`(${CODIGO_NO_TEXTO.source})\\s*\\(([^()]+)\\)`, "g"), (_t, cod: string, nome: string) => {
    codigos.push(cod);
    return nome;
  });
  const texto = comParenteses.replace(CODIGO_NO_TEXTO, (cod) => {
    codigos.push(cod);
    return legivel(cod);
  });
  return { texto, codigos };
}

export const SEM_DADO = "sem dado"; // i18n: dado (forma portuguesa; a tela usa semDado())
/** "sem dado" no idioma da página. */
export const semDado = (idioma: Idioma = idiomaEnergia()) => tx(SEM_DADO, "no data", idioma);
export const SITE = "https://scrutiniums.com/setor-eletrico";

/* ---------------------------------------------------------------- datas e números */

const MESES_ABNT = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/** 'AAAA', 'AAAA-MM', 'AAAA-MM-DD' ou 'AAAA-MM-DDTHH:MM' → texto brasileiro, sem conversão
 * de fuso (datas de referência são locais). `hora` mantém a hora local (espelho de _data_br). */
export function dataRef(iso: string | null | undefined, hora = false, idioma: Idioma = idiomaEnergia()): string | null {
  if (!iso) return null;
  const partes = iso.slice(0, 10).split("-");
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return idioma === "en" ? dataBR(iso.slice(0, 7), "en") : `${partes[1]}/${partes[0]}`;
  const [a, m, d] = partes;
  let txt = idioma === "en" ? dataBR(iso.slice(0, 10), "en") : `${d}/${m}/${a}`;
  if (hora && iso.length >= 16 && iso[10] === "T" && !iso.endsWith("Z")) txt += idioma === "en" ? `, ${iso.slice(11, 16)}` : ` ${iso.slice(11, 16)}`;
  return txt;
}

/** Dia (AAAA-MM-DD) de um carimbo com fuso no horário de Brasília (UTC−3 fixo desde 2019,
 * sem horário de verão). Data sem hora passa igual; hora sem fuso é local. */
export function diaBrasilia(instante: string | null | undefined): string | null {
  if (!instante) return null;
  if (instante.length <= 10) return instante;
  const temFuso = instante.includes("T") && /(Z|[+-]\d\d:?\d\d)$/.test(instante);
  if (!temFuso) return instante.slice(0, 10);
  const t = Date.parse(instante);
  if (Number.isNaN(t)) return instante.slice(0, 10);
  return new Date(t - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Um só instante quando início e fim coincidem; hora local mantida quando o período é horário. */
export function textoPeriodo(p: Partial<Periodo> | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  const ini = dataRef(p?.inicio, true, idioma);
  const fim = dataRef(p?.fim, true, idioma);
  if (!ini && !fim) return tx("período não informado", "period not reported", idioma);
  if (ini === fim || !fim) return ini as string;
  if (!ini) return tx(`até ${fim}`, `until ${fim}`, idioma);
  return tx(`${ini} a ${fim}`, `${ini} to ${fim}`, idioma);
}

/** Data de acesso no formato ABNT ("30 set. 2026"), no dia de Brasília; em inglês, "30 Sep 2026". */
export function dataAbnt(acesso: Date | string, idioma: Idioma = idiomaEnergia()): string {
  const iso = typeof acesso === "string" ? acesso : acesso.toISOString();
  const dia = diaBrasilia(iso) ?? iso.slice(0, 10);
  const [a, m, d] = dia.split("-");
  return `${Number(d)} ${idioma === "en" ? nomeMes(Number(m), "en") : MESES_ABNT[Number(m) - 1]} ${a}`;
}

/**
 * Valor de cálculo com todos os algarismos que o número de ponto flutuante carrega
 * (a menor representação que volta ao mesmo valor), em pt-BR: vírgula decimal,
 * ponto de milhar e sinal de menos tipográfico. Nunca arredonda e nunca usa notação
 * científica: é a leitura "antes do arredondamento" da seção 11.5.
 */
export function numeroCompleto(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return semDado(idioma);
  let s = String(Math.abs(v));
  if (/e/i.test(s)) {
    const [mant, expTxt] = s.toLowerCase().split("e");
    const exp = Number(expTxt);
    const [int, frac = ""] = mant.split(".");
    const digitos = int + frac;
    const pos = int.length + exp;
    if (pos <= 0) s = `0.${"0".repeat(-pos)}${digitos}`;
    else if (pos >= digitos.length) s = digitos + "0".repeat(pos - digitos.length);
    else s = `${digitos.slice(0, pos)}.${digitos.slice(pos)}`;
  }
  const [inteira, fracao] = s.split(".");
  // em inglês, vírgula de milhar e ponto decimal (os mesmos algarismos)
  const [milhar, decimal] = idioma === "en" ? [",", "."] : [".", ","];
  const agrupada = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, milhar);
  return `${v < 0 ? "−" : ""}${agrupada}${fracao ? `${decimal}${fracao}` : ""}`;
}

/** Mesmo valor no formato de máquina (ponto decimal), como um programa o imprime. */
export function numeroMaquina(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return semDado(idioma);
  return numeroCompleto(v, "pt").replace(/−/, "-").replaceAll(".", "").replace(",", ".");
}

/* ---------------------------------------------------------------- citação */

const SO_NUMERO = /^[−+-]?[\d.,]+$/;

/** Número de um texto pt-BR com milhar em ponto e decimal em vírgula ("12,12%" vira 12.12); null se o texto não começa por número. */
function numeroDoTexto(s: string): { valor: number; casas: number; resto: string } | null {
  const m = /^(-?\d{1,3}(?:\.\d{3})*|-?\d+)(?:,(\d+))?/.exec(s.trim());
  if (!m) return null;
  return { valor: Number(m[1].replace(/\./g, "") + (m[2] ? `.${m[2]}` : "")), casas: m[2]?.length ?? 0, resto: s.trim().slice(m[0].length) };
}

/**
 * Ficha com o valor escrito como o cartão o exibe. O Comprove tem de mostrar o mesmo texto do número que
 * prova; quando a ficha foi publicada com menos casas que o cartão (12,1% na ficha, 12,12% no cartão), o
 * texto é reescrito, mas só se o novo for o arredondamento de `valor_calculo` e trouxer a mesma unidade
 * escrita: nunca inventa dígito. Qualquer dúvida devolve a ficha como veio.
 */
export function comValorExibido(ev: Evidencia, texto: string): Evidencia {
  const novo = numeroDoTexto(texto);
  const velho = numeroDoTexto(ev.valor_exibido);
  if (!novo || !velho || ev.valor_calculo === null || !Number.isFinite(ev.valor_calculo)) return ev;
  if (novo.resto.trim() !== velho.resto.trim()) return ev;
  if (Math.abs(novo.valor - ev.valor_calculo) > 0.5 * 10 ** -novo.casas + 1e-9) return ev;
  const citacao = ev.citacao?.includes(`: ${ev.valor_exibido},`) ? ev.citacao.replace(`: ${ev.valor_exibido},`, `: ${texto.trim()},`) : ev.citacao;
  return { ...ev, valor_exibido: texto.trim(), citacao };
}

/** Referência ABNT simplificada sem data de acesso: espelho de `citacao()` no Python. */
/** Endereço da página citada na irmã inglesa, quando ela tem tradução publicada. */
function enderecoEmIngles(endereco: string): string {
  const base = "https://scrutiniums.com";
  if (!endereco.startsWith(base + "/")) return hrefNoIdioma(endereco, "en");
  return base + hrefNoIdioma(endereco.slice(base.length), "en");
}

export function citacaoBase(ev: Evidencia, endereco: string = SITE, idioma: Idioma = idiomaEnergia()): string {
  const pub = diaBrasilia(ev.versao?.publicacao);
  const ano = pub ? pub.slice(0, 4) : tx("s.d.", "n.d.", idioma);
  const cap = dataRef(diaBrasilia(ev.fonte?.capturado_em), false, idioma);
  const recurso = ev.fonte?.recurso ? tx(`recurso ${ev.fonte.recurso}`, `resource ${ev.fonte.recurso}`, idioma) : tx("recurso não identificado", "resource not identified", idioma);
  const captura = cap ? tx(`, capturado em ${cap}`, `, captured on ${cap}`, idioma) : "";
  const codigo = ev.versao?.codigo ? tx(`código ${ev.versao.codigo}`, `code ${ev.versao.codigo}`, idioma) : tx("código não registrado", "code not recorded", idioma);
  // a unidade entra só quando o texto exibido é um número puro ("123,46"); texto que
  // já traz unidade própria ("R$ 0,8123/kWh", "12,3%") fica como está na tela
  const valor = SO_NUMERO.test(ev.valor_exibido) && ev.unidade ? `${ev.valor_exibido} ${ev.unidade}` : ev.valor_exibido;
  const publicada = dataRef(pub, false, idioma) ?? tx("data não registrada", "date not recorded", idioma);
  return tx(
    `SCRUTINIUMS. ${ev.indicador}: ${valor}, ${ev.entidade}, ${textoPeriodo(ev.periodo, idioma)}. ` +
      `Observatório Brasileiro do Setor Elétrico, ${ano}. ` +
      `Dados primários: ${ev.fonte?.orgao}, ${ev.fonte?.conjunto} (${recurso}${captura}). ` +
      `Versão ${ev.versao?.pipeline}, ${codigo}, publicada em ${publicada}. ` +
      `Disponível em: ${endereco}.`,
    `SCRUTINIUMS. ${rotuloFicha(ev.indicador, "en") ?? ev.indicador}: ${valorFichaNoIdioma(valor, "en")}, ${rotuloFicha(ev.entidade, "en") ?? ev.entidade}, ${textoPeriodo(ev.periodo, idioma)}. ` +
      `Brazilian Power Sector Observatory, ${ano}. ` +
      `Primary data: ${ev.fonte?.orgao}, ${ev.fonte?.conjunto} (${recurso}${captura}). ` +
      `Version ${ev.versao?.pipeline}, ${codigo}, published on ${publicada}. ` +
      `Available at: ${enderecoEmIngles(endereco)}.`,
    idioma,
  );
}

/**
 * Citação acadêmica completa (ABNT simplificada) com a data de acesso do leitor.
 * Sem `endereco`, usa a citação publicada pelo pipeline (ou a recalcula se vier
 * vazia); com `endereco` (a página e a âncora onde o número aparece), recalcula
 * a partir dos campos para apontar ao lugar exato.
 */
export function citacaoAcademica(ev: Evidencia, acesso: Date | string, endereco?: string, idioma: Idioma = idiomaEnergia()): string {
  const publicada = ev.citacao?.trim();
  // a citação publicada pelo pipeline é portuguesa: na página inglesa, a citação é refeita dos campos
  const base = endereco || !publicada || idioma === "en" ? citacaoBase(ev, endereco ?? SITE, idioma) : publicada;
  // uma citação publicada nunca deveria trazer acesso; se trouxer, vale o do leitor
  const semAcesso = base.replace(/\s*Acesso em:[\s\S]*$/, "");
  return tx(`${semAcesso} Acesso em: ${dataAbnt(acesso, idioma)}.`, `${semAcesso} Accessed on: ${dataAbnt(acesso, idioma)}.`, idioma);
}

/* ---------------------------------------------------------------- testes e chaves */

/* rótulos lidos na hora (getter), no idioma da página */
export const ROTULO_RESULTADO: Record<ResultadoTeste, { rotulo: string; glifo: string }> = {
  aprovado: { get rotulo() { return tx("Aprovado", "Passed"); }, glifo: "✓" },
  ressalva: { get rotulo() { return tx("Com ressalva", "With caveat"); }, glifo: "!" },
  reprovado: { get rotulo() { return tx("Reprovado", "Failed"); }, glifo: "✕" },
};

export function ehResultado(r: unknown): r is ResultadoTeste {
  return typeof r === "string" && (RESULTADOS as readonly string[]).includes(r);
}

/** Contagem por resultado e frase de resumo ("3 testes: 2 aprovados, 1 com ressalva, nenhum reprovado."). */
export function resumoTestes(testes: { resultado: string }[], idioma: Idioma = idiomaEnergia()): { aprovado: number; ressalva: number; reprovado: number; fora: number; texto: string } {
  const c = { aprovado: 0, ressalva: 0, reprovado: 0, fora: 0 };
  for (const t of testes) {
    if (ehResultado(t.resultado)) c[t.resultado] += 1;
    else c.fora += 1;
  }
  if (!testes.length) return { ...c, texto: tx("Nenhum teste registrado para este número.", "No test recorded for this number.", idioma) };
  if (idioma === "en") {
    const parteEn = (n: number, rotulo: string) => (n === 0 ? `none ${rotulo}` : `${n} ${rotulo}`);
    const partesEn = [parteEn(c.aprovado, "passed"), parteEn(c.ressalva, "with caveat"), parteEn(c.reprovado, "failed")];
    if (c.fora) partesEn.push(`${c.fora} with a result outside the standard`);
    return { ...c, texto: `${testes.length === 1 ? "1 test" : `${testes.length} tests`}: ${partesEn.join(", ")}.` };
  }
  // forma portuguesa (espelho do Python); a inglesa está logo acima
  const parte = (n: number, um: string, varios: string) => (n === 0 ? `nenhum ${um}` : `${n} ${n === 1 ? um : varios}`); // i18n: dado
  const partes = [
    parte(c.aprovado, "aprovado", "aprovados"),
    parte(c.ressalva, "com ressalva", "com ressalva"), // i18n: dado
    parte(c.reprovado, "reprovado", "reprovados"),
  ];
  if (c.fora) partes.push(`${c.fora} com resultado fora do padrão`); // i18n: dado
  const total = testes.length === 1 ? "1 teste" : `${testes.length} testes`;
  return { ...c, texto: `${total}: ${partes.join(", ")}.` };
}

/** Como as observações de origem estão identificadas (lista, lista truncada com manifesto ou consulta). */
export function resumoChaves(ev: Pick<Evidencia, "chaves_origem" | "chaves_total" | "consulta" | "manifesto">, idioma: Idioma = idiomaEnergia()): string {
  const n = ev.chaves_origem.length;
  const total = ev.chaves_total ?? n;
  const milhar = (x: number) => x.toLocaleString(idioma === "en" ? "en-US" : "pt-BR");
  if (n === 0 && ev.consulta)
    return tx("Observações selecionadas pela consulta abaixo; a lista não é publicada na interface.", "Observations selected by the query below; the list is not published in the interface.", idioma);
  if (n === 0) return tx("Nenhuma chave de origem registrada.", "No source key recorded.", idioma);
  if (total > n) {
    const man = ev.manifesto
      ? tx(" A lista completa está no manifesto para baixar.", " The full list is in the manifest to download.", idioma)
      : tx(" A lista completa não foi publicada.", " The full list was not published.", idioma);
    return tx(`Primeiras ${milhar(n)} de ${milhar(total)} chaves de origem.${man}`, `First ${milhar(n)} of ${milhar(total)} source keys.${man}`, idioma);
  }
  return n === 1 ? tx("1 chave de origem.", "1 source key.", idioma) : tx(`${milhar(n)} chaves de origem.`, `${milhar(n)} source keys.`, idioma);
}

/* ---------------------------------------------------------------- reprodução */

function recuo(texto: string, prefixo = "   "): string {
  return texto
    .split("\n")
    .map((l) => (l.trim() ? prefixo + l : l))
    .join("\n");
}

function linhasArquivo(a: ArquivoEvidencia, idioma: Idioma): string[] {
  const out: string[] = [];
  const nome = a.arquivo ?? a.recurso;
  if (nome) out.push(tx(`Arquivo: ${nome}${a.capturado_em ? ` (capturado em ${a.capturado_em})` : ""}`, `File: ${nome}${a.capturado_em ? ` (captured on ${a.capturado_em})` : ""}`, idioma));
  if (a.publicado_em) out.push(tx(`Publicado pela fonte em: ${a.publicado_em}`, `Published by the source on: ${a.publicado_em}`, idioma));
  if (a.sha256 && nome) out.push(tx(`Integridade: sha256sum ${nome} deve resultar em ${a.sha256}`, `Integrity: sha256sum ${nome} must give ${a.sha256}`, idioma));
  else if (!a.sha256) out.push(tx("Integridade: sha256 não registrado para este arquivo.", "Integrity: sha256 not recorded for this file.", idioma));
  return out;
}

/**
 * Texto copiável que refaz o número, em passos numerados: versão do código,
 * arquivo e hash, execução, seleção das observações, fórmula e o valor esperado
 * antes do arredondamento (em formato de máquina, para comparar com a saída do
 * programa). `reproducao` de várias linhas entra como está, recuada.
 */
export function textoReproducao(ev: Evidencia, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string) => traduz(pt, en, idioma);
  const l: string[] = [];
  l.push(tx(`Reproduzir: ${ev.indicador}, ${ev.valor_exibido} (${textoPeriodo(ev.periodo, idioma)}).`, `Reproduce: ${ev.indicador}, ${ev.valor_exibido} (${textoPeriodo(ev.periodo, idioma)}).`));
  const pub = dataRef(diaBrasilia(ev.versao.publicacao), false, idioma);
  l.push(
    tx(
      `Versão ${ev.versao.pipeline}, código ${ev.versao.codigo ?? "não registrado"}, publicada em ${pub ?? "data não registrada"}.`,
      `Version ${ev.versao.pipeline}, code ${ev.versao.codigo ?? "not recorded"}, published on ${pub ?? "date not recorded"}.`,
    ),
  );
  l.push("");
  let n = 0;
  const passo = (titulo: string, corpo: string[] = []) => {
    n += 1;
    l.push(`${n}. ${titulo}`);
    for (const c of corpo) l.push(recuo(c));
  };

  const codigo = ev.versao.codigo;
  if (codigo) {
    const commit = codigo.replace(/\+alterado$/, "");
    const aviso = codigo.endsWith("+alterado")
      ? [
          tx(
            `Atenção: a publicação saiu de código com alterações fora do commit ${commit}; o resultado pode diferir.`,
            `Note: the publication came from code with changes outside commit ${commit}; the result may differ.`,
          ),
        ]
      : [];
    passo(tx(`Obtenha o código na versão publicada: git checkout ${commit}`, `Get the code at the published version: git checkout ${commit}`), aviso);
  } else {
    passo(tx(`Código não registrado nesta publicação: use a versão ${ev.versao.pipeline} do pipeline.`, `Code not recorded in this publication: use version ${ev.versao.pipeline} of the pipeline.`));
  }

  const f = ev.fonte;
  const corpoFonte = [tx(`Endereço: ${f.url}`, `Address: ${f.url}`)];
  if (f.arquivos?.length) for (const a of f.arquivos) corpoFonte.push(...linhasArquivo(a, idioma));
  else corpoFonte.push(...linhasArquivo(f, idioma));
  if (ev.extracao_pdf) {
    const x = ev.extracao_pdf;
    corpoFonte.push(
      tx(`PDF: ${x.documento}, edição ${x.edicao}, ${x.pagina}.`, `PDF: ${x.documento}, edition ${x.edicao}, ${x.pagina}.`),
      tx(`Conferência da extração: ${x.conferencia}`, `Extraction check: ${x.conferencia}`),
    );
  }
  passo(tx(`Obtenha o arquivo da fonte: ${f.orgao}, ${f.conjunto}.`, `Get the source file: ${f.orgao}, ${f.conjunto}.`), corpoFonte);

  passo(tx("Execute:", "Run:"), [ev.reproducao.trim() || tx("rotina de reprodução não registrada", "reproduction routine not recorded")]);

  const obs: string[] = [];
  if (ev.consulta) obs.push(tx(`Consulta: ${ev.consulta}`, `Query: ${ev.consulta}`));
  if (ev.chaves_origem.length) obs.push(tx(`Chaves: ${ev.chaves_origem.join("; ")}`, `Keys: ${ev.chaves_origem.join("; ")}`));
  if ((ev.chaves_total ?? 0) > ev.chaves_origem.length)
    obs.push(tx(`Lista truncada: ${ev.chaves_origem.length} de ${ev.chaves_total}.`, `Truncated list: ${ev.chaves_origem.length} of ${ev.chaves_total}.`));
  if (ev.manifesto) obs.push(tx(`Manifesto completo: ${ev.manifesto.url}`, `Full manifest: ${ev.manifesto.url}`));
  if (ev.filtros.length) obs.push(tx(`Filtros: ${ev.filtros.join("; ")}`, `Filters: ${ev.filtros.join("; ")}`));
  if (ev.exclusoes.length) obs.push(tx(`Exclusões: ${ev.exclusoes.join("; ")}`, `Exclusions: ${ev.exclusoes.join("; ")}`));
  passo(tx("Selecione as observações de origem.", "Select the source observations."), obs.length ? obs : [tx("nenhuma chave nem consulta registrada", "no key or query recorded")]);

  const conta = [ev.formula];
  if (ev.numerador) conta.push(tx(`Numerador: ${ev.numerador.descricao} = ${numeroMaquina(ev.numerador.valor)}`, `Numerator: ${ev.numerador.descricao} = ${numeroMaquina(ev.numerador.valor)}`));
  if (ev.denominador)
    conta.push(tx(`Denominador: ${ev.denominador.descricao} = ${numeroMaquina(ev.denominador.valor)}`, `Denominator: ${ev.denominador.descricao} = ${numeroMaquina(ev.denominador.valor)}`));
  if (ev.pesos) conta.push(tx(`Pesos: ${ev.pesos}`, `Weights: ${ev.pesos}`));
  passo(tx("Aplique a fórmula:", "Apply the formula:"), conta);

  passo(
    ev.valor_calculo === null
      ? tx(
          `Confira: não há valor para este recorte (${ev.tratamento_ausencia}); a tela mostra "${ev.valor_exibido}".`,
          `Check: there is no value for this selection (${ev.tratamento_ausencia}); the screen shows "${ev.valor_exibido}".`,
        )
      : tx(
          `Confira: valor antes do arredondamento ${numeroMaquina(ev.valor_calculo)} ${ev.unidade}; exibido como ${ev.valor_exibido}.`,
          `Check: value before rounding ${numeroMaquina(ev.valor_calculo)} ${ev.unidade}; shown as ${ev.valor_exibido}.`,
        ),
  );
  return l.join("\n");
}

/* ---------------------------------------------------------------- conferência na interface */

const ALGARISMO = /\d/;
const SHA256 = /^[0-9a-f]{64}$/;
const texto = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Problemas que impedem a evidência de comprovar o número. O pipeline já recusa
 * esses casos na geração (evidencia.py, `validar`); a interface confere de novo
 * um subconjunto e mostra o aviso em vez de exibir uma prova incompleta como se
 * fosse completa (gold antiga, montada à mão ou de módulo fora do construtor).
 */
export function problemasEvidencia(ev: Evidencia, idioma: Idioma = idiomaEnergia()): string[] {
  const p: string[] = [];
  const tx = (pt: string, en: string) => traduz(pt, en, idioma);
  for (const campo of ["indicador", "valor_exibido", "unidade", "entidade", "universo", "formula", "cobertura", "tratamento_ausencia", "reproducao"] as const) {
    if (!texto(ev[campo])) p.push(tx(`campo "${campo}" vazio`, `field "${campo}" empty`));
  }
  const v = ev.valor_calculo;
  const valido = v === null || (typeof v === "number" && Number.isFinite(v));
  if (!valido) p.push(tx("valor de cálculo não é número finito nem ausência", "computed value is neither a finite number nor missing"));
  const presente = valido && v !== null;
  if (v === null && ALGARISMO.test(ev.valor_exibido ?? "")) p.push(tx("valor de cálculo ausente, mas a tela mostra um número", "computed value missing, but the screen shows a number"));
  if (presente && !ALGARISMO.test(ev.valor_exibido ?? "")) p.push(tx("valor de cálculo presente, mas a tela não mostra número", "computed value present, but the screen shows no number"));
  if (!texto(ev.periodo?.inicio) || !texto(ev.periodo?.fim)) p.push(tx("período sem início ou fim", "period without start or end"));
  if (!texto(ev.fonte?.orgao) || !texto(ev.fonte?.url)) p.push(tx("fonte sem órgão ou endereço", "source without body or address"));
  if (presente) {
    const arquivos = ev.fonte?.arquivos?.length ? ev.fonte.arquivos : [ev.fonte];
    if (arquivos.some((a) => !a?.sha256 || !SHA256.test(a.sha256))) p.push(tx("arquivo da fonte sem sha256 válido", "source file without a valid sha256"));
    if (arquivos.some((a) => !a?.capturado_em)) p.push(tx("arquivo da fonte sem instante de captura", "source file without a capture instant"));
    if (!ev.chaves_origem?.length && !texto(ev.consulta)) p.push(tx("sem chaves nem consulta das observações de origem", "no keys or query for the source observations"));
    if (!ev.testes?.length) p.push(tx("nenhum teste executado", "no test run"));
    if (!ev.download?.length) p.push(tx("sem download dos dados", "no data download"));
  }
  if (!ev.numerador !== !ev.denominador) p.push(tx("numerador sem denominador (ou o contrário)", "numerator without denominator (or the reverse)"));
  for (const te of ev.testes ?? [])
    if (!ehResultado(te.resultado)) p.push(tx(`teste "${te.nome}" com resultado fora de aprovado, ressalva, reprovado`, `test "${te.nome}" with a result other than passed, caveat, failed`));
  if (ev.reconciliacao) {
    if (!ehResultado(ev.reconciliacao.resultado)) p.push(tx("reconciliação com resultado fora de aprovado, ressalva, reprovado", "reconciliation with a result other than passed, caveat, failed"));
    if (!texto(ev.reconciliacao.tolerancia)) p.push(tx("reconciliação sem tolerância com unidade", "reconciliation without a tolerance with unit"));
  }
  return p;
}

/* ---------------------------------------------------------------- número de destaque */

/** "variacao" e "variacao_pct": o próprio número de destaque é uma variação e leva sinal
 * explícito (+ ou −, tipográfico); zero depois de arredondar não leva sinal. */
export type FormatoNumero = "num" | "reais" | "pct" | "variacao" | "variacao_pct";

/** Valor grande do KPI; ausência vira "sem dado", nunca zero nem traço. */
export function valorDestaque(v: number | null | undefined, formato: FormatoNumero = "num", casas = 1, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return semDado(idioma);
  if (formato === "reais") return reais(v, casas, idioma);
  if (formato === "pct") return pct(v, casas, idioma);
  if (formato === "variacao" || formato === "variacao_pct") {
    const arred = Number(v.toFixed(casas));
    const suf = formato === "variacao_pct" ? "%" : "";
    return arred === 0 ? `${num(0, casas, idioma)}${suf}` : sinal(arred, casas, suf, idioma);
  }
  return num(v, casas, idioma);
}

/** Unidade ao lado do número grande sem repetir o que o formato já escreve:
 * "R$/MWh" com formato reais vira "/MWh"; "%" com formato pct some; "% da energia injetada"
 * com formato pct vira "da energia injetada" (o número já termina em %). */
export function unidadeDestaque(unidade: string | null | undefined, formato: FormatoNumero = "num"): string {
  const u = (unidade ?? "").trim();
  if (formato === "reais") return u.replace(/^R\$\s*/, "");
  if (formato === "pct" || formato === "variacao_pct") return u.replace(/^%\s*/, "");
  return u;
}

export type Variacao = {
  valor: number | null;
  casas?: number;
  /** Colado ao número: "%", " p.p.", " R$/MWh". */
  sufixo?: string;
  /** "em relação ao dia anterior". */
  referencia: string;
};

/**
 * Variação com direção decidida sobre o valor JÁ arredondado: +0,04 com uma casa
 * é "estável 0,0", não "+0,0" com seta de alta. Glifo e palavra ao mesmo tempo
 * (a cor nunca é o único portador), sem juízo de bom ou ruim.
 */
export function descreverVariacao(v: Variacao, idioma: Idioma = idiomaEnergia()): { direcao: "alta" | "queda" | "estavel" | null; glifo: string | null; texto: string; leitura: string } {
  const casas = v.casas ?? 1;
  const sufixo = v.sufixo ?? "";
  if (v.valor === null || !Number.isFinite(v.valor)) {
    return { direcao: null, glifo: null, texto: semDado(idioma), leitura: tx(`Variação ${v.referencia}: sem dado.`, `Change ${v.referencia}: no data.`, idioma) };
  }
  const arred = Number(v.valor.toFixed(casas));
  if (arred === 0) {
    const t = `${num(0, casas, idioma)}${sufixo}`;
    return { direcao: "estavel", glifo: "=", texto: t, leitura: tx(`Estável ${v.referencia} (${t}).`, `Stable ${v.referencia} (${t}).`, idioma) };
  }
  const t = sinal(arred, casas, sufixo, idioma);
  const alta = arred > 0;
  const absoluto = `${num(Math.abs(arred), casas, idioma)}${sufixo}`;
  return {
    direcao: alta ? "alta" : "queda",
    glifo: alta ? "▲" : "▼",
    texto: t,
    leitura: tx(`${alta ? "Alta" : "Queda"} de ${absoluto} ${v.referencia}.`, `${alta ? "Rise" : "Fall"} of ${absoluto} ${v.referencia}.`, idioma),
  };
}

/* ---------------------------------------------------------------- cópia */

export type ResultadoCopia = "copiado" | "selecionado" | "falhou";

export type MeiosCopia = {
  /** navigator.clipboard (só existe em contexto seguro). */
  clipboard?: { writeText(t: string): Promise<void> } | null;
  /** Seleciona o texto do bloco na página; devolve se conseguiu. */
  selecionar?: () => boolean;
  /** document.execCommand("copy") sobre a seleção; devolve se copiou. */
  copiarSelecao?: () => boolean;
};

/**
 * Copia com três degraus: API da área de transferência; seleção do bloco com o
 * comando de cópia antigo; e, se nada copiar, deixa o texto selecionado para o
 * leitor usar Ctrl+C. Cada degrau falho segue para o próximo sem lançar erro.
 */
export async function copiarComFallback(textoCopiar: string, meios: MeiosCopia): Promise<ResultadoCopia> {
  if (meios.clipboard) {
    try {
      await meios.clipboard.writeText(textoCopiar);
      return "copiado";
    } catch {
      // permissão negada ou contexto inseguro: segue para a seleção
    }
  }
  let selecionou = false;
  try {
    selecionou = meios.selecionar?.() ?? false;
  } catch {
    selecionou = false;
  }
  if (selecionou) {
    try {
      if (meios.copiarSelecao?.()) return "copiado";
    } catch {
      // comando descontinuado ou bloqueado: o texto continua selecionado
    }
    return "selecionado";
  }
  return "falhou";
}

/* mensagens lidas na hora (getter), no idioma da página; a forma inglesa é a do núcleo (MENSAGEM_COPIA_EN), fonte única */
export const MENSAGEM_COPIA: Record<ResultadoCopia, string> = {
  get copiado() { return tx("Copiado para a área de transferência.", MENSAGEM_COPIA_EN.copiado); },
  get selecionado() { return tx("Texto selecionado: use Ctrl+C (ou Copiar, no menu) para copiar.", MENSAGEM_COPIA_EN.selecionado); },
  get falhou() { return tx("Não foi possível copiar: selecione o texto do bloco e copie.", MENSAGEM_COPIA_EN.falhou); },
};

/** Mensagem de cópia num idioma explícito (componente cliente que já leu o idioma da página). */
export function mensagemCopia(r: ResultadoCopia, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? MENSAGEM_COPIA_EN[r] : MENSAGEM_COPIA[r];
}
