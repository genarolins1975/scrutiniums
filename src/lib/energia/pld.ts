/**
 * Lógica pura das páginas do PLD (painéis P008 a P012): rotas, nomes, linhas de
 * gráfico e tabela, matrizes dos mapas de calor e os textos de resposta.
 *
 * Regras que valem para todo o arquivo:
 * - Nenhum número é recalculado aqui. Médias, diferenças, frações, percentis e
 *   contagens vêm prontos da gold (pipeline/energia/modulos/pld_detalhe.py); a
 *   interface só escolhe o recorte, converte fração em percentual para exibir e
 *   monta texto. Assim o gráfico, a tabela, o arquivo exportado e a resposta
 *   escrita leem as mesmas linhas.
 * - Ausência é null e continua null: nunca vira zero, nunca é interpolada.
 * - Os textos de resposta são regras determinísticas sobre os números da gold
 *   (seção 7.4 da especificação) e não atribuem causa: diferença entre CMO e PLD,
 *   separação entre submercados e posição no histórico são descritas, não
 *   explicadas.
 * - Sem travessão nem hífen como pontuação no texto visível; sinal de menos
 *   tipográfico pelos formatadores de formato.ts.
 */
import type { NoFormacao, TipoRelacao } from "@/lib/energia/conteudo/pld";
import { NAO_SE_APLICA } from "@/lib/energia/escalas";
import { dataBR, fracPct, mesAno, nomeMes as nomeMesFmt, nomeSubmercado, num, plural, reais } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";
import type { EventoDatado } from "@/lib/energia/linha-do-tempo";
import type { EscalaCores, ValorCelula } from "@/lib/energia/mapa-calor";
import type { ColunaTabela, LinhaTabela } from "@/lib/energia/tabela";
import type { GeracaoGold, PldCartao, Submercado } from "@/lib/energia/tipos";
import type {
  AchadoA02,
  AmplitudePeriodo,
  AtoLimite,
  BlocoCmoPld,
  BlocoHistorico,
  BlocoLimitesDisponivel,
  BlocoRegional,
  ConceitoPld,
  CoberturaDessemAno,
  DocumentoNormativo,
  DocumentoNormativoId,
  FonteTextual,
  Fronteira,
  Par,
  PermanenciaAnual,
  PldHoraDiaArquivo,
  PldHorarioRecenteArquivo,
  PosicaoReferencia,
  RegimeLimites,
  SemanaReferencia,
  SensibilidadePeso,
} from "@/lib/energia/tipos-pld";

/* ---------- rotas e painéis ---------- */

export const ROTA_PLD = "/setor-eletrico/pld";
export type PainelPld = "p008" | "p009" | "p010" | "p011" | "p012";

/**
 * Um painel por página (o P008 fica na página principal, com os capítulos de
 * conceito e formação): cada painel numérico tem séries semanais, mensais ou
 * horárias, várias tabelas equivalentes e fichas de prova; juntos passariam da
 * meta de cerca de 600 KB de HTML por página (contrato, seção 5.1).
 */
/** Rótulo e pergunta de cada painel no idioma pedido (componente de cliente passa o de useIdioma()). */
function textosPainel(id: PainelPld, idioma: Idioma): { rotulo: string; pergunta: string } {
  switch (id) {
    case "p008":
      return { rotulo: tx("Entenda o preço", "Understand the price", idioma), pergunta: tx("O que o PLD remunera e como é formado?", "What does the PLD pay for and how is it formed?", idioma) };
    case "p009":
      return { rotulo: tx("CMO e formação de preço", "CMO and price formation", idioma), pergunta: tx("Qual a relação entre custo e preço?", "How do cost and price relate?", idioma) };
    case "p010":
      return { rotulo: tx("Limites, piso e tetos", "Limits, floor and caps", idioma), pergunta: tx("Quando o preço encosta nos limites?", "When does the price hit the limits?", idioma) };
    case "p011":
      return { rotulo: tx("Histórico e distribuição", "History and distribution", idioma), pergunta: tx("O preço está alto para esta época?", "Is the price high for this time of year?", idioma) };
    case "p012":
      return { rotulo: tx("Diferenças regionais", "Regional differences", idioma), pergunta: tx("Quando e quanto os preços se separam?", "When and by how much do prices diverge?", idioma) };
  }
}

/** Os painéis; rótulo e pergunta são lidos no render, no idioma da página. */
export const PAINEIS_PLD: { id: PainelPld; rotulo: string; caminho: string; pergunta: string }[] = (
  [
    { id: "p008", caminho: "" },
    { id: "p009", caminho: "/cmo-e-formacao" },
    { id: "p010", caminho: "/limites" },
    { id: "p011", caminho: "/historico" },
    { id: "p012", caminho: "/diferencas-regionais" },
  ] as const
).map((p) => ({
  id: p.id,
  caminho: p.caminho,
  get rotulo() {
    return textosPainel(p.id, idiomaEnergia()).rotulo;
  },
  get pergunta() {
    return textosPainel(p.id, idiomaEnergia()).pergunta;
  },
}));

export function rotaPainel(id: PainelPld): string {
  return `${ROTA_PLD}${PAINEIS_PLD.find((p) => p.id === id)?.caminho ?? ""}`;
}

export function rotuloPainel(id: PainelPld, idioma: Idioma = idiomaEnergia()): string {
  return textosPainel(id, idioma).rotulo;
}

export function perguntaPainel(id: PainelPld, idioma: Idioma = idiomaEnergia()): string {
  return PAINEIS_PLD.some((p) => p.id === id) ? textosPainel(id, idioma).pergunta : "";
}

/** Próxima pergunta sugerida (seção 7.2, item 10): a sequência dos painéis e, no fim, a previsão. */
export function proximoPainel(id: PainelPld, idioma: Idioma = idiomaEnergia()): { href: string; pergunta: string } {
  const i = PAINEIS_PLD.findIndex((p) => p.id === id);
  const prox = PAINEIS_PLD[i + 1];
  if (prox) return { href: `${rotaPainel(prox.id)}#${prox.id}`, pergunta: perguntaPainel(prox.id, idioma) };
  return { href: `${ROTA_PLD}#previsao`, pergunta: tx("Para onde o PLD pode ir?", "Where could the PLD go?", idioma) };
}

/* ---------- submercados, pares e fronteiras ---------- */

export const SUBMERCADOS: readonly Submercado[] = ["SE", "S", "NE", "N"];
export const NOME_SM: Record<Submercado, string> = { SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" };
export const CURTO_SM: Record<Submercado, string> = { SE: "SE/CO", S: "Sul", NE: "Nordeste", N: "Norte" };
export const DO_SM: Record<Submercado, string> = { SE: "do Sudeste/Centro-Oeste", S: "do Sul", NE: "do Nordeste", N: "do Norte" };
export const NO_SM: Record<Submercado, string> = { SE: "no Sudeste/Centro-Oeste", S: "no Sul", NE: "no Nordeste", N: "no Norte" };

/** Nome do submercado no idioma (as tabelas acima são as formas portuguesas). */
export function nomeSm(sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? nomeSubmercado(sm, "en") : NOME_SM[sm];
}
export function curtoSm(sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? nomeSubmercado(sm, "en", true) : CURTO_SM[sm];
}
/** "do Sudeste/Centro-Oeste" em português; "in the Southeast/Center-West" em inglês. */
export function doSm(sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? `in the ${nomeSubmercado(sm, "en")}` : DO_SM[sm];
}
/** "no Sudeste/Centro-Oeste" em português; "in the Southeast/Center-West" em inglês. */
export function noSm(sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? `in the ${nomeSubmercado(sm, "en")}` : NO_SM[sm];
}
export const COR_SM: Record<Submercado, string> = { SE: "var(--serie-sm-se)", S: "var(--serie-sm-s)", NE: "var(--serie-sm-ne)", N: "var(--serie-sm-n)" };

export const PARES: readonly Par[] = ["SE_S", "SE_NE", "SE_N", "S_NE", "S_N", "NE_N"];
export const FRONTEIRAS: readonly Fronteira[] = ["N_NE", "N_SE", "NE_SE", "S_SE"];

export function pontasPar(p: Par): [Submercado, Submercado] {
  return p.split("_") as [Submercado, Submercado];
}
export function nomePar(p: Par, idioma: Idioma = idiomaEnergia()): string {
  const [a, b] = pontasPar(p);
  return tx(`${NOME_SM[a]} e ${NOME_SM[b]}`, `${nomeSm(a, "en")} and ${nomeSm(b, "en")}`, idioma);
}
export function curtoPar(p: Par, idioma: Idioma = idiomaEnergia()): string {
  const [a, b] = pontasPar(p);
  return tx(`${CURTO_SM[a]} e ${CURTO_SM[b]}`, `${curtoSm(a, "en")} and ${curtoSm(b, "en")}`, idioma);
}
/** Fronteira do ONS: fluxo positivo da primeira para a segunda ponta (regra_fluxo da gold). */
export function pontasFronteira(f: Fronteira): { de: Submercado; para: Submercado } {
  const [de, para] = f.split("_") as [Submercado, Submercado];
  return { de, para };
}
export function nomeFronteira(f: Fronteira, idioma: Idioma = idiomaEnergia()): string {
  const { de, para } = pontasFronteira(f);
  return tx(`${NOME_SM[de]} e ${NOME_SM[para]}`, `${nomeSm(de, "en")} and ${nomeSm(para, "en")}`, idioma);
}

/* ---------- utilidades de texto ---------- */

/** "a, b e c". */
export function listaTexto(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")}${tx(" e ", " and ", idioma)}${itens[itens.length - 1]}`;
}

/** Fração 0..1 publicada pela gold em percentual (0..100) para tabela e gráfico; ausência continua ausência. */
export function emPct(f: number | null | undefined): number | null {
  return f === null || f === undefined || !Number.isFinite(f) ? null : f * 100;
}

/**
 * Diferença publicada pela gold, escrita com o sentido decidido sobre o valor
 * arredondado a centavos: "R$ 26,20/MWh acima do CMO", "abaixo da média" ou
 * "igual à média". O gênero do termo comparado decide a contração (do, da, ao, à).
 */
export function diferencaTexto(v: number | null, termo: string, genero: "m" | "f", idioma: Idioma = idiomaEnergia(), termoEn: string = termo): string {
  const de = genero === "f" ? "da" : "do"; // i18n: dado
  const a = genero === "f" ? "à" : "ao"; // i18n: dado
  if (v === null || !Number.isFinite(v)) return tx(`sem diferença calculável em relação ${a} ${termo}`, `with no calculable difference from the ${termoEn}`, idioma);
  const centavos = Math.round(Math.abs(v) * 100);
  if (centavos === 0) return tx(`igual ${a} ${termo}`, `equal to the ${termoEn}`, idioma);
  return tx(`${reais(Math.abs(v), 2, idioma)}/MWh ${v > 0 ? "acima" : "abaixo"} ${de} ${termo}`, `${reais(Math.abs(v), 2, idioma)}/MWh ${v > 0 ? "above" : "below"} the ${termoEn}`, idioma);
}

/** Nome do mês por extenso no idioma ("janeiro", "January"). */
export function nomeMes(m: number, idioma: Idioma = idiomaEnergia()): string {
  return m >= 1 && m <= 12 ? nomeMesFmt(m, idioma, true) : String(m);
}

/* ====================================================================== */
/* P008: conceito e formação                                              */
/* ====================================================================== */

/**
 * Ligações do diagrama de formação que podem ser conferidas nas passagens
 * normativas e técnicas publicadas pela gold (conceito.fontes_textuais). A gold
 * só publica uma passagem depois de encontrá-la, literalmente, no documento
 * baixado (fontes/normas_pld.py); por isso a ligação vale como CONFERIDA só
 * quando TODAS as passagens que a sustentam estão na gold, e o texto de cada
 * ligação diz apenas o que as passagens dizem (a solar, que o trecho do ONS não
 * cita, fica fora da afirmação sobre fontes intermitentes).
 */
export type LigacaoConferivel = { de: string; para: string; tipo: TipoRelacao; texto: string; fontes: string[] };

export const LIGACOES_CONFERIVEIS: readonly LigacaoConferivel[] = [
  {
    de: "afluencias",
    para: "otimizacao",
    tipo: "informacao_modelos",
    get texto() {
      return tx("A previsão de vazões é dado de entrada do modelo de curtíssimo prazo do ONS (DESSEM), que resulta no CMO semi-horário.", "The flow forecast is an input to ONS's very-short-term model (DESSEM), which produces the half-hourly marginal operating cost (CMO).");
    },
    fontes: ["pr24_cmo_semi_horario"],
  },
  {
    de: "carga",
    para: "otimizacao",
    tipo: "informacao_modelos",
    get texto() {
      return tx("A previsão de carga é dado de entrada do modelo de curtíssimo prazo do ONS (DESSEM), que resulta no CMO semi-horário.", "The load forecast is an input to ONS's very-short-term model (DESSEM), which produces the half-hourly CMO.");
    },
    fontes: ["pr24_cmo_semi_horario"],
  },
  {
    de: "renovaveis",
    para: "otimizacao",
    tipo: "informacao_modelos",
    get texto() {
      return tx("A previsão da geração eólica é dado de entrada do DESSEM. O trecho citado não menciona a geração solar, que fica sem ligação conferida.", "The wind generation forecast is an input to DESSEM. The excerpt cited does not mention solar generation, which is left without a checked link.");
    },
    fontes: ["pr24_cmo_semi_horario"],
  },
  {
    de: "rede",
    para: "otimizacao",
    tipo: "informacao_modelos",
    get texto() {
      return tx(
        "A rede elétrica é dado de entrada do DESSEM; o cálculo do PLD deve observar as restrições de transmissão entre submercados, e os próprios submercados são definidos pela presença e duração de restrições relevantes de transmissão.",
        "The electrical grid is an input to DESSEM; the PLD calculation must observe transmission constraints between submarkets, and the submarkets themselves are defined by the presence and duration of relevant transmission constraints.",
      );
    },
    fontes: ["pr24_cmo_semi_horario", "d5163_art57_p1", "d5163_art57_p1_v", "d5163_art57_p4"],
  },
  {
    de: "termicas",
    para: "limites",
    tipo: "regra_regulatoria",
    get texto() {
      return tx("O valor máximo do PLD, estabelecido pela ANEEL, é calculado levando em conta os custos variáveis de operação das termelétricas disponíveis para o despacho centralizado.", "The maximum PLD, set by ANEEL, is calculated taking into account the variable operating costs of the thermal plants available for centralized dispatch.");
    },
    fontes: ["d5163_art57_p2"],
  },
  {
    de: "otimizacao",
    para: "cmo",
    tipo: "resultado_modelos",
    get texto() {
      return tx(
        "O DESSEM se acopla à função de custo futuro do DECOMP, que se acopla à do NEWAVE. O DESSEM resulta no CMO semi-horário e o DECOMP, no CMO médio semanal por subsistema e patamar de carga.",
        "DESSEM couples to DECOMP's future cost function, which couples to NEWAVE's. DESSEM produces the half-hourly CMO and DECOMP the average weekly CMO by subsystem and load level.",
      );
    },
    fontes: ["dessem_acoplamento", "pr24_cmo_semi_horario", "pr43_cmo_semanal"],
  },
  {
    de: "cmo",
    para: "limites",
    tipo: "regra_regulatoria",
    get texto() {
      return tx(
        "O PLD é calculado antecipadamente, tem como base o custo marginal de operação e é limitado por preços mínimo e máximo; no DESSEM, os custos marginais de meia hora são a base da formação do preço horário.",
        "The PLD is calculated in advance, is based on the marginal operating cost and is bounded by minimum and maximum prices; in DESSEM, half-hourly marginal costs are the basis for forming the hourly price.",
      );
    },
    fontes: ["d5163_art57_p1", "ren957_art78", "dessem_resultado_cmo"],
  },
  {
    de: "limites",
    para: "pld",
    tipo: "regra_regulatoria",
    get texto() {
      return tx(
        "Os valores máximo e mínimo do PLD são estabelecidos pela ANEEL: o máximo leva em conta os custos variáveis das termelétricas disponíveis; o mínimo, os custos de operação e manutenção das hidrelétricas e a compensação financeira pelo uso dos recursos hídricos.",
        "The maximum and minimum PLD values are set by ANEEL: the maximum takes into account the variable costs of the available thermal plants; the minimum, the operation and maintenance costs of hydropower plants and the financial compensation for the use of water resources.",
      );
    },
    fontes: ["d5163_art57_p2", "d5163_art57_p3"],
  },
  {
    de: "pld",
    para: "liquidacao",
    tipo: "regra_regulatoria",
    get texto() {
      return tx("A contabilização e a liquidação no Mercado de Curto Prazo são realizadas com base no PLD, e as exposições dos agentes da CCEE são valoradas ao PLD.", "Accounting and settlement in the Short-Term Market are carried out on the basis of the PLD, and the exposures of CCEE agents are valued at the PLD.");
    },
    fontes: ["d5163_art57_caput", "ren957_art5_p4"],
  },
];

export type LigacaoFormacao = {
  de: string;
  para: string;
  tipo: TipoRelacao;
  texto: string;
  estado: "CONFERIDO" | "PENDENTE";
  /** Passagens encontradas na gold que sustentam a ligação. */
  bases: FonteTextual[];
  /** Ids exigidos e ausentes da gold (ligação conferível que ficou pendente). */
  faltantes: string[];
  /** Base declarada no conteúdo editorial (ligação que a gold não cobre). */
  baseTexto: string | null;
  origem: "gold" | "conteudo";
};

function passagemValida(f: FonteTextual | undefined): f is FonteTextual {
  return !!f && typeof f.texto === "string" && f.texto.trim().length > 0;
}

/**
 * Ligações de cada etapa do diagrama: as conferíveis (estado decidido pela
 * presença das passagens na gold) e as do conteúdo editorial que a gold não
 * cobre, com o estado que o conteúdo declara. Ligação conferida na gold substitui
 * a do conteúdo com o mesmo par de etapas; conferível que ficou pendente cede
 * lugar à do conteúdo, quando existe, para a mesma ligação não aparecer duas vezes.
 */
export function ligacoesFormacao(nos: readonly NoFormacao[], fontes: readonly FonteTextual[]): Record<string, LigacaoFormacao[]> {
  const porId = new Map(fontes.map((f) => [f.id, f]));
  const conferiveis: LigacaoFormacao[] = LIGACOES_CONFERIVEIS.map((l) => {
    const bases = l.fontes.map((id) => porId.get(id)).filter(passagemValida);
    const faltantes = l.fontes.filter((id) => !passagemValida(porId.get(id)));
    return { de: l.de, para: l.para, tipo: l.tipo, texto: l.texto, estado: faltantes.length === 0 ? "CONFERIDO" : "PENDENTE", bases, faltantes, baseTexto: null, origem: "gold" };
  });
  const saida: Record<string, LigacaoFormacao[]> = {};
  for (const n of nos) {
    const r = n.relacaoSaida;
    const daGold = conferiveis.filter((c) => c.de === n.id);
    const lista: LigacaoFormacao[] = [];
    if (r) {
      const substituta = daGold.find((c) => c.para === r.para && c.estado === "CONFERIDO");
      if (!substituta) lista.push({ de: n.id, para: r.para, tipo: r.tipo, texto: r.texto, estado: r.conferencia, bases: [], faltantes: [], baseTexto: r.fonte, origem: "conteudo" });
    }
    for (const c of daGold) {
      if (c.estado === "PENDENTE" && r && r.para === c.para) continue;
      lista.push(c);
    }
    saida[n.id] = lista;
  }
  return saida;
}

export function resumoLigacoes(lig: Record<string, LigacaoFormacao[]>): { total: number; conferidas: number; pendentes: LigacaoFormacao[] } {
  const todas = Object.values(lig).flat();
  const pendentes = todas.filter((l) => l.estado !== "CONFERIDO");
  return { total: todas.length, conferidas: todas.length - pendentes.length, pendentes };
}

/** Passagens normativas e técnicas agrupadas pelo documento conferido, na ordem da gold. */
export type DocumentoCitado = { id: DocumentoNormativoId; doc: DocumentoNormativo; passagens: FonteTextual[] };

export function documentosCitados(c: ConceitoPld): { documentos: DocumentoCitado[]; descricoes: FonteTextual[] } {
  const documentos: DocumentoCitado[] = [];
  for (const [id, doc] of Object.entries(c.documentos_normativos) as [DocumentoNormativoId, DocumentoNormativo][]) {
    const passagens = c.fontes_textuais.filter((f) => f.documento === id && passagemValida(f));
    documentos.push({ id, doc, passagens });
  }
  const descricoes = c.fontes_textuais.filter((f) => !f.documento && passagemValida(f));
  return { documentos, descricoes };
}

/**
 * Resposta curta do P008, montada só com o que as passagens conferidas sustentam:
 * cada frase depende das passagens que cita estarem na gold. Termina com a contagem
 * do que foi conferido e do que segue pendente.
 */
export function respostaP008(c: ConceitoPld, lig: Record<string, LigacaoFormacao[]>, idioma: Idioma = idiomaEnergia()): string {
  const tem = (...ids: string[]) => ids.every((id) => passagemValida(c.fontes_textuais.find((f) => f.id === id)));
  const partes: string[] = [];
  if (tem("ren957_art2_xiii", "ren957_art5_p4"))
    partes.push(
      tx(
        "O PLD é o preço ao qual a CCEE valora, no Mercado de Curto Prazo, as diferenças entre a energia contratada e a geração ou o consumo verificados de cada agente (Convenção de Comercialização, REN ANEEL nº 957/2021, art. 2º, XIII, e art. 5º, § 4º).",
        "The PLD is the price at which CCEE values, in the Short-Term Market, the differences between contracted energy and each agent's verified generation or consumption (Trading Convention, ANEEL normative resolution (REN) No. 957/2021, art. 2, XIII, and art. 5, § 4).",
        idioma,
      ),
    );
  if (tem("d5163_art57_p1", "ren957_art78"))
    partes.push(
      tx(
        "Ele é calculado antecipadamente, tem como base o custo marginal de operação e é limitado por preços mínimo e máximo fixados pela ANEEL (Decreto nº 5.163/2004, art. 57, § 1º; REN nº 957/2021, art. 78).",
        "It is calculated in advance, is based on the marginal operating cost and is bounded by minimum and maximum prices set by ANEEL (Decree No. 5,163/2004, art. 57, § 1; REN No. 957/2021, art. 78).",
        idioma,
      ),
    );
  if (!partes.length) partes.push(tx("As passagens normativas que sustentam a definição não estão nesta publicação; a explicação abaixo fica sem conferência.", "The regulatory passages that support the definition are not in this publication; the explanation below remains unchecked.", idioma));
  const { documentos } = documentosCitados(c);
  const comPassagem = documentos.filter((d) => d.passagens.length > 0);
  const nPass = comPassagem.reduce((s, d) => s + d.passagens.length, 0);
  const r = resumoLigacoes(lig);
  partes.push(
    tx(
      `Nesta página, ${plural(nPass, "passagem", "passagens", idioma)} de ${plural(comPassagem.length, "documento normativo ou técnico", "documentos normativos e técnicos", idioma)} estão conferidas literalmente nos arquivos baixados; ${num(r.conferidas, 0, idioma)} de ${num(r.total, 0, idioma)} ligações do diagrama de formação estão conferidas e ${num(r.pendentes.length, 0, idioma)} seguem com conferência pendente.`,
      `On this page, ${plural(nPass, "passage", "passages", idioma)} from ${plural(comPassagem.length, "regulatory or technical document", "regulatory and technical documents", idioma)} are checked word for word in the downloaded files; ${num(r.conferidas, 0, idioma)} of ${num(r.total, 0, idioma)} links in the formation diagram are checked and ${num(r.pendentes.length, 0, idioma)} are still pending checking.`,
      idioma,
    ),
  );
  return partes.join(" ");
}

/**
 * Veredito do P008 em palavras simples: o que o PLD é e de onde sai, sem número. Cada frase depende das mesmas passagens
 * conferidas que sustentam a resposta completa (respostaP008); sem elas, o veredito diz que a definição não está conferida.
 */
export function vereditoP008(c: ConceitoPld, idioma: Idioma = idiomaEnergia()): string {
  const tem = (...ids: string[]) => ids.every((id) => passagemValida(c.fontes_textuais.find((f) => f.id === id)));
  const partes: string[] = [];
  if (tem("ren957_art2_xiii", "ren957_art5_p4"))
    partes.push(tx("O PLD é o preço usado para valorar a diferença entre a energia contratada e a verificada de cada agente.", "The PLD is the price used to value the difference between each agent's contracted and verified energy.", idioma));
  if (tem("d5163_art57_p1", "ren957_art78")) partes.push(tx("Tem como base o custo marginal de operação e fica entre um mínimo e um máximo fixados pela ANEEL.", "It is based on the marginal operating cost and stays between a minimum and a maximum set by ANEEL.", idioma));
  if (!partes.length) return tx("As passagens normativas que sustentam a definição não estão nesta publicação; a explicação fica sem conferência.", "The regulatory passages that support the definition are not in this publication; the explanation remains unchecked.", idioma);
  return partes.join(" ");
}

/** Tira o código HTTP entre parênteses de uma frase escrita para a gold ("... não estão acessíveis (HTTP 403)." vira "... não estão acessíveis."). */
export function semCodigoHttp(texto: string): string {
  return texto.replace(/\s*\(HTTP [45]\d{2}[^)]*\)/g, "");
}

/* ====================================================================== */
/* P009: CMO e formação de preço                                          */
/* ====================================================================== */

export type LinhaSemana = { id: string; inicio: string; fim: string; decomp: number | null; dessem: number | null; pld: number | null };

/** Semanas operativas de um submercado: as mesmas linhas no gráfico, na tabela e no arquivo exportado. */
export function linhasSemanais(c: BlocoCmoPld, sm: Submercado): LinhaSemana[] {
  const s = c.semanal;
  const col = s[sm];
  return s.fim.map((fim, i) => ({ id: fim, inicio: s.inicio[i], fim, decomp: col.decomp[i] ?? null, dessem: col.dessem[i] ?? null, pld: col.pld[i] ?? null }));
}

export function colunasSemanas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "inicio", rotulo: tx("Início (sábado)", "Start (Saturday)", idioma), tipo: "data" },
    { id: "fim", rotulo: tx("Fim (sexta publicada pelo ONS)", "End (Friday published by ONS)", idioma), tipo: "data" },
    { id: "decomp", rotulo: tx("CMO semanal do DECOMP", "DECOMP weekly CMO", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "dessem", rotulo: tx("Média do CMO do DESSEM na semana", "Average DESSEM CMO in the week", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "pld", rotulo: tx("Média do PLD na semana", "Average PLD in the week", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}
export const COLUNAS_SEMANAS: ColunaTabela[] = colunasSemanas("pt");

/** Ano mais recente da relação horária PLD contra CMO de um submercado. */
export function relacaoMaisRecente(c: BlocoCmoPld, sm: Submercado) {
  return c.relacao_anual.filter((r) => r.sm === sm).sort((a, b) => b.ano - a.ano)[0] ?? null;
}

export function respostaP009(c: BlocoCmoPld, sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  const ref = c.semana_referencia;
  const x = ref?.por_sm.find((p) => p.sm === sm) ?? null;
  const partes: string[] = [];
  const R = (v: number | null) => reais(v, 2, idioma);
  if (!ref || !x) {
    partes.push(tx("Nenhuma semana operativa completa com os três produtos (CMO semanal do DECOMP, CMO do DESSEM e PLD) nesta publicação.", "No complete operating week with all three products (DECOMP weekly CMO, DESSEM CMO and PLD) in this publication.", idioma));
  } else {
    partes.push(
      tx(
        `Na semana operativa de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)}, ${NO_SM[sm]}, o CMO semanal do DECOMP foi ${reais(x.decomp)}/MWh, a média das 336 meias horas do CMO do DESSEM foi ${reais(x.dessem)}/MWh e a média das 168 horas do PLD foi ${reais(x.pld)}/MWh.`,
        `In the operating week from ${dataBR(ref.inicio, idioma)} to ${dataBR(ref.fim, idioma)}, ${noSm(sm, idioma)}, the DECOMP weekly CMO was ${R(x.decomp)}/MWh, the average of the 336 half-hours of the DESSEM CMO was ${R(x.dessem)}/MWh and the average of the 168 hours of the PLD was ${R(x.pld)}/MWh.`,
        idioma,
      ),
    );
    partes.push(
      tx(
        `Na mesma semana, o PLD médio ficou ${diferencaTexto(x.pld_menos_dessem, "média do DESSEM", "f", idioma)} e ${diferencaTexto(x.pld_menos_decomp, "CMO semanal do DECOMP", "m", idioma)}.`,
        `In the same week, the average PLD was ${diferencaTexto(x.pld_menos_dessem, "média do DESSEM", "f", idioma, "DESSEM average")} and ${diferencaTexto(x.pld_menos_decomp, "CMO semanal do DECOMP", "m", idioma, "DECOMP weekly CMO")}.`,
        idioma,
      ),
    );
  }
  const r = relacaoMaisRecente(c, sm);
  if (r?.entre && r.entre.n > 0 && r.entre.mediana_abs_dif !== null) {
    partes.push(
      tx(
        `Em ${r.ano}${r.parcial ? " (ano parcial)" : ""}, nas ${num(r.entre.n, 0)} horas com o PLD entre os limites, a diferença absoluta entre o PLD e o CMO do DESSEM na mesma hora teve mediana de ${reais(r.entre.mediana_abs_dif)}/MWh.`,
        `In ${r.ano}${r.parcial ? " (partial year)" : ""}, in the ${num(r.entre.n, 0, idioma)} hours with the PLD between the limits, the absolute difference between the PLD and the DESSEM CMO in the same hour had a median of ${R(r.entre.mediana_abs_dif)}/MWh.`,
        idioma,
      ),
    );
  }
  partes.push(tx("São produtos diferentes (modelo, resolução e regras de cálculo); estes dados não explicam a diferença.", "They are different products (model, resolution and calculation rules); these data do not explain the difference.", idioma));
  return partes.join(" ");
}

/**
 * Veredito do P009 em palavras simples: onde o PLD médio da semana de referência ficou frente ao CMO semanal do DECOMP e à média do
 * DESSEM, e o que a página compara. Usa as mesmas diferenças prontas da gold que a resposta completa (respostaP009); o sentido
 * (acima, abaixo, igual) é o do valor arredondado a centavos, como em diferencaTexto.
 */
export function vereditoP009(c: BlocoCmoPld, sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  const ref = c.semana_referencia;
  const x = ref?.por_sm.find((p) => p.sm === sm) ?? null;
  if (!ref || !x) return tx("Nenhuma semana operativa completa com os três valores (CMO semanal do DECOMP, CMO do DESSEM e PLD) nesta publicação.", "No complete operating week with all three values (DECOMP weekly CMO, DESSEM CMO and PLD) in this publication.", idioma);
  return tx(
    `Na semana que terminou em ${dataBR(ref.fim)}, o PLD ${DO_SM[sm]} ficou ${diferencaTexto(x.pld_menos_decomp, "CMO semanal do DECOMP", "m", idioma)} ` +
      `e ${diferencaTexto(x.pld_menos_dessem, "CMO médio do DESSEM", "m", idioma)}. A página compara os três valores no mesmo intervalo.`,
    `In the week ending ${dataBR(ref.fim, idioma)}, the PLD ${doSm(sm, idioma)} was ${diferencaTexto(x.pld_menos_decomp, "CMO semanal do DECOMP", "m", idioma, "DECOMP weekly CMO")} ` +
      `and ${diferencaTexto(x.pld_menos_dessem, "CMO médio do DESSEM", "m", idioma, "average DESSEM CMO")}. The page compares the three values over the same interval.`,
    idioma,
  );
}

/**
 * Por que a contagem de horas entre os limites daqui difere da página de limites no mesmo ano: aqui só entram as horas com o CMO do
 * DESSEM publicado. Devolve null quando as duas contagens coincidem ou falta um dos blocos. As duas leem pld_detalhe.json.
 */
export function notaHorasEntreLimites(c: BlocoCmoPld, l: BlocoLimitesDisponivel | null, sm: Submercado, idioma: Idioma = idiomaEnergia()): string | null {
  const r = relacaoMaisRecente(c, sm);
  const p = l && r ? permanencia(l, r.ano, sm) : null;
  if (!r || !p || r.entre === null || r.entre.n === p.horas_entre) return null;
  return tx(
    `Na página de limites, ${r.ano}${r.parcial ? " (ano parcial)" : ""} tem ${num(p.horas_entre, 0)} horas entre os limites ${DO_SM[sm]}; aqui são ${num(r.entre.n, 0)}, ` +
      `porque entram só as horas com o CMO do DESSEM publicado (${num(r.horas_com_cmo, 0)} das ${num(r.horas_pld, 0)} horas do ano).`,
    `On the limits page, ${r.ano}${r.parcial ? " (partial year)" : ""} has ${num(p.horas_entre, 0, idioma)} hours between the limits ${doSm(sm, idioma)}; here there are ${num(r.entre.n, 0, idioma)}, ` +
      `because only hours with a published DESSEM CMO are included (${num(r.horas_com_cmo, 0, idioma)} of the ${num(r.horas_pld, 0, idioma)} hours of the year).`,
    idioma,
  );
}

export type LinhaRelacao = LinhaTabela & { id: string };

export function linhasRelacaoAnual(c: BlocoCmoPld, sm: Submercado, idioma: Idioma = idiomaEnergia()): LinhaRelacao[] {
  return c.relacao_anual
    .filter((r) => r.sm === sm)
    .sort((a, b) => a.ano - b.ano)
    .map((r) => ({
      id: String(r.ano),
      ano: r.parcial ? tx(`${r.ano} (parcial)`, `${r.ano} (partial)`, idioma) : String(r.ano),
      horas_pld: r.horas_pld,
      horas_com_cmo: r.horas_com_cmo,
      piso: r.por_situacao.piso,
      teto_horario: r.por_situacao.teto_horario,
      teto_estrutural_no_dia: r.por_situacao.teto_estrutural_no_dia,
      entre: r.por_situacao.entre,
      media_dif: r.todas.media_dif,
      media_abs_dif: r.todas.media_abs_dif,
      entre_media_dif: r.entre?.media_dif ?? null,
      entre_mediana_abs: r.entre?.mediana_abs_dif ?? null,
      entre_ate_1: emPct(r.entre?.frac_abs_ate_1),
      piso_cmo_no_piso: emPct(r.piso?.frac_cmo_no_piso_ou_abaixo),
    }));
}

export function colunasRelacao(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto" }, // i18n: dado
    { id: "horas_pld", rotulo: tx("Horas com PLD", "Hours with PLD", idioma), tipo: "numero", casas: 0 },
    { id: "horas_com_cmo", rotulo: tx("Horas com CMO do DESSEM", "Hours with DESSEM CMO", idioma), tipo: "numero", casas: 0 },
    { id: "piso", rotulo: tx("Horas no piso", "Hours at the floor", idioma), tipo: "numero", casas: 0 },
    { id: "teto_horario", rotulo: tx("Horas no teto horário", "Hours at the hourly cap", idioma), tipo: "numero", casas: 0 },
    { id: "teto_estrutural_no_dia", rotulo: tx("Horas em dia no teto estrutural", "Hours on a day at the structural cap", idioma), tipo: "numero", casas: 0 },
    { id: "entre", rotulo: tx("Horas entre os limites", "Hours between the limits", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "media_dif", rotulo: tx("PLD − CMO, média (todas as horas)", "PLD − CMO, average (all hours)", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "media_abs_dif", rotulo: tx("|PLD − CMO|, média (todas as horas)", "|PLD − CMO|, average (all hours)", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "entre_media_dif", rotulo: tx("PLD − CMO, média (entre os limites)", "PLD − CMO, average (between the limits)", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "entre_mediana_abs", rotulo: tx("|PLD − CMO|, mediana (entre os limites)", "|PLD − CMO|, median (between the limits)", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "entre_ate_1", rotulo: tx("Horas entre os limites com |PLD − CMO| ≤ R$ 1,00/MWh", "Hours between the limits with |PLD − CMO| ≤ R$ 1.00/MWh", idioma), tipo: "percentual", casas: 2 },
    { id: "piso_cmo_no_piso", rotulo: tx("Horas no piso com CMO no piso ou abaixo", "Hours at the floor with the CMO at or below the floor", idioma), tipo: "percentual", casas: 1 },
  ];
}
export const COLUNAS_RELACAO: ColunaTabela[] = colunasRelacao("pt");

/** PLD e CMO do DESSEM na mesma hora nas últimas 168 horas (arquivo sob demanda), para o painel alinhado. */
export function linhasHorariasCmo(r: PldHorarioRecenteArquivo, sm: Submercado): { t: string; pld: number | null; cmo: number | null }[] {
  return r.t.map((t, i) => ({ t, pld: r.pld[sm][i] ?? null, cmo: r.cmo_dessem[sm][i] ?? null }));
}

/** Marcos de evento com evidência no eixo semanal: primeira e última semana da sequência de CMO semanal zero (A02), quando estão no recorte. */
export function marcosSemanais(a02: AchadoA02, fins: readonly string[], idioma: Idioma = idiomaEnergia()): { x: string; rotulo: string }[] {
  const seq = a02.sequencia_comum_mais_longa;
  if (!seq || !fins.length) return [];
  const m: { x: string; rotulo: string }[] = [];
  if (seq.inicio >= fins[0] && seq.inicio <= fins[fins.length - 1]) m.push({ x: seq.inicio, rotulo: tx(`primeira semana com CMO semanal zero (${seq.semanas} seguidas)`, `first week with a zero weekly CMO (${seq.semanas} in a row)`, idioma) });
  if (seq.fim >= fins[0] && seq.fim <= fins[fins.length - 1]) m.push({ x: seq.fim, rotulo: tx("última semana com CMO semanal zero", "last week with a zero weekly CMO", idioma) });
  return m;
}

export function linhasCobertura(cob: CoberturaDessemAno[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return cob.map((c) => ({
    id: String(c.ano),
    ano: String(c.ano),
    esperadas: c.meias_horas_esperadas,
    presentes: c.meias_horas_presentes,
    ausentes: c.dias_ausentes.length,
    incompletos: c.dias_incompletos.length,
    lista: c.dias_ausentes.map((x) => dataBR(x, idioma)).join(", "),
  }));
}

export function colunasCobertura(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto" }, // i18n: dado
    { id: "esperadas", rotulo: tx("Meias horas esperadas", "Expected half-hours", idioma), tipo: "numero", casas: 0 },
    { id: "presentes", rotulo: tx("Meias horas publicadas", "Published half-hours", idioma), tipo: "numero", casas: 0 },
    { id: "ausentes", rotulo: tx("Dias sem nenhuma meia hora", "Days with no half-hour", idioma), tipo: "numero", casas: 0 },
    { id: "incompletos", rotulo: tx("Dias incompletos", "Incomplete days", idioma), tipo: "numero", casas: 0 },
    { id: "lista", rotulo: tx("Dias sem publicação", "Days without publication", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_COBERTURA: ColunaTabela[] = colunasCobertura("pt");

/* ====================================================================== */
/* P010: limites, piso e tetos                                            */
/* ====================================================================== */

export type LimiteHora = "piso" | "teto_horario";
export const LIMITES_HORA: readonly LimiteHora[] = ["piso", "teto_horario"];

export function anosPermanencia(l: BlocoLimitesDisponivel): number[] {
  return Array.from(new Set(l.permanencia_anual.map((p) => p.ano))).sort((a, b) => a - b);
}

export function permanencia(l: BlocoLimitesDisponivel, ano: number, sm: Submercado): PermanenciaAnual | null {
  return l.permanencia_anual.find((p) => p.ano === ano && p.sm === sm) ?? null;
}

/** Trechos de vigência que tocam o ano (um por ano no histórico integrado; mais de um quando um ato muda no meio do ano). */
export function regimesDoAno(l: BlocoLimitesDisponivel, ano: number): RegimeLimites[] {
  const a = String(ano);
  return l.regimes.filter((r) => r.inicio.slice(0, 4) <= a && r.fim.slice(0, 4) >= a);
}

export function respostaP010(l: BlocoLimitesDisponivel, ano: number, sm: Submercado, diaReferencia: string, idioma: Idioma = idiomaEnergia()): string {
  const p = permanencia(l, ano, sm);
  if (!p) return tx(`Sem permanência publicada para ${ano} ${NO_SM[sm]}.`, `No duration published for ${ano} ${noSm(sm, idioma)}.`, idioma);
  const regs = regimesDoAno(l, ano);
  const r = regs.length === 1 ? regs[0] : null;
  const R = (v: number | null) => reais(v, 2, idioma);
  const periodo = p.parcial ? tx(`${ano} (parcial, até ${dataBR(diaReferencia)})`, `${ano} (partial, up to ${dataBR(diaReferencia, idioma)})`, idioma) : String(ano);
  const piso = r ? ` (${R(r.pld_min)}/MWh, ${r.ato_pld_min ?? tx("ato não identificado", "act not identified", idioma)})` : "";
  const tetoH = r ? ` (${R(r.pld_max_horario)}/MWh)` : "";
  const tetoE = r ? ` (${R(r.pld_max_estrutural)}/MWh)` : "";
  const partes = [
    tx(
      `Em ${periodo}, o PLD ${DO_SM[sm]} ficou no piso${piso} em ${num(p.horas_piso, 0)} de ${plural(p.horas_com_limite, "hora", "horas")} com limite vigente (${fracPct(p.frac_piso, 2)}) e no teto horário${tetoH} em ${plural(p.horas_teto_horario, "hora", "horas")}.`,
      `In ${periodo}, the PLD ${doSm(sm, idioma)} was at the floor${piso} in ${num(p.horas_piso, 0, idioma)} of ${plural(p.horas_com_limite, "hour", "hours", idioma)} with a limit in force (${fracPct(p.frac_piso, 2, idioma)}) and at the hourly cap${tetoH} in ${plural(p.horas_teto_horario, "hour", "hours", idioma)}.`,
      idioma,
    ),
    p.dias_teto_estrutural === 0
      ? tx(`Nenhum dia teve a média diária no teto estrutural${tetoE}.`, `No day had its daily average at the structural cap${tetoE}.`, idioma)
      : tx(`${plural(p.dias_teto_estrutural, "dia teve", "dias tiveram")} a média diária no teto estrutural${tetoE}.`, `${plural(p.dias_teto_estrutural, "day", "days", idioma)} had the daily average at the structural cap${tetoE}.`, idioma),
  ];
  if (regs.length > 1) partes.push(tx("O ano tem mais de um trecho de vigência; os valores de cada trecho estão na tabela de limites.", "The year has more than one period in force; the values for each period are in the limits table.", idioma));
  const fora = p.controle_abaixo_do_piso + p.controle_acima_do_teto;
  partes.push(
    fora === 0
      ? tx("Nenhuma hora ficou abaixo do piso nem acima do teto horário.", "No hour was below the floor or above the hourly cap.", idioma)
      : tx(`${plural(fora, "hora ficou", "horas ficaram")} fora dos limites do ato e estão sob conferência.`, `${plural(fora, "hour was", "hours were", idioma)} outside the act's limits and are under review.`, idioma),
  );
  if (p.horas_um_centavo_acima_do_piso > 0)
    partes.push(
      tx(
        `${plural(p.horas_um_centavo_acima_do_piso, "hora ficou", "horas ficaram")} exatamente um centavo acima do piso e não contam como piso.`,
        `${plural(p.horas_um_centavo_acima_do_piso, "hour was", "hours were", idioma)} exactly one cent above the floor and do not count as the floor.`,
        idioma,
      ),
    );
  return partes.join(" ");
}

/**
 * Veredito do P010 em palavras simples: quanto do tempo o PLD ficou no piso e no teto horário no ano e submercado escolhidos, e se
 * algum dia teve a média no teto estrutural. Lê os mesmos campos de permanência que a resposta completa (respostaP010).
 */
export function vereditoP010(l: BlocoLimitesDisponivel, ano: number, sm: Submercado, diaReferencia: string, idioma: Idioma = idiomaEnergia()): string {
  const p = permanencia(l, ano, sm);
  if (!p) return tx(`Sem permanência publicada para ${ano} ${NO_SM[sm]}.`, `No duration published for ${ano} ${noSm(sm, idioma)}.`, idioma);
  const periodo = p.parcial ? tx(`${ano} (até ${dataBR(diaReferencia, idioma)})`, `${ano} (up to ${dataBR(diaReferencia, idioma)})`, idioma) : String(ano);
  const teto =
    p.horas_teto_horario === 0
      ? tx("em nenhuma hora no teto horário", "in no hour at the hourly cap", idioma)
      : tx(`no teto horário em ${plural(p.horas_teto_horario, "hora", "horas", idioma)}`, `at the hourly cap in ${plural(p.horas_teto_horario, "hour", "hours", idioma)}`, idioma);
  const estrutural =
    p.dias_teto_estrutural === 0
      ? tx("Nenhum dia teve a média no teto estrutural.", "No day had its average at the structural cap.", idioma)
      : tx(`${plural(p.dias_teto_estrutural, "dia teve", "dias tiveram", idioma)} a média no teto estrutural.`, `${plural(p.dias_teto_estrutural, "day", "days", idioma)} had the average at the structural cap.`, idioma);
  return tx(
    `Em ${periodo}, o PLD ${DO_SM[sm]} ficou no piso (valor mínimo) em ${fracPct(p.frac_piso, 2, idioma)} das horas e ${teto}. ${estrutural}`,
    `In ${periodo}, the PLD ${doSm(sm, idioma)} was at the floor (minimum value) in ${fracPct(p.frac_piso, 2, idioma)} of hours and ${teto}. ${estrutural}`,
    idioma,
  );
}

export type LinhaPermanencia = LinhaTabela & { id: string; rotulo: string };

/** Permanência por ano de um submercado: barras (em %) e tabela leem estas linhas. */
export function linhasPermanencia(l: BlocoLimitesDisponivel, sm: Submercado, idioma: Idioma = idiomaEnergia()): LinhaPermanencia[] {
  return l.permanencia_anual
    .filter((p) => p.sm === sm)
    .sort((a, b) => a.ano - b.ano)
    .map((p) => ({
      id: String(p.ano),
      rotulo: p.parcial ? tx(`${p.ano} (parcial)`, `${p.ano} (partial)`, idioma) : String(p.ano),
      piso_pct: emPct(p.frac_piso),
      teto_pct: emPct(p.frac_teto_horario),
      horas: p.horas,
      horas_com_limite: p.horas_com_limite,
      horas_piso: p.horas_piso,
      horas_teto_horario: p.horas_teto_horario,
      horas_entre: p.horas_entre,
      um_centavo: p.horas_um_centavo_acima_do_piso,
      sens_piso: p.sensibilidade_um_centavo.horas_piso,
      dias_teto_estrutural: p.dias_teto_estrutural,
      dias_teto_estrutural_com_hora_acima: p.dias_teto_estrutural_com_hora_acima,
      fora: p.controle_abaixo_do_piso + p.controle_acima_do_teto,
    }));
}

export function colunasPermanencia(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Ano", "Year", idioma), tipo: "texto" },
    { id: "piso_pct", rotulo: tx("Horas no piso", "Hours at the floor", idioma), tipo: "percentual", casas: 2 },
    { id: "teto_pct", rotulo: tx("Horas no teto horário", "Hours at the hourly cap", idioma), tipo: "percentual", casas: 2 },
    { id: "horas_com_limite", rotulo: tx("Horas com limite vigente", "Hours with a limit in force", idioma), tipo: "numero", casas: 0 },
    { id: "horas_piso", rotulo: tx("Horas no piso", "Hours at the floor", idioma), tipo: "numero", casas: 0 },
    { id: "horas_teto_horario", rotulo: tx("Horas no teto horário", "Hours at the hourly cap", idioma), tipo: "numero", casas: 0 },
    { id: "horas_entre", rotulo: tx("Horas entre os limites", "Hours between the limits", idioma), tipo: "numero", casas: 0 },
    { id: "um_centavo", rotulo: tx("Horas um centavo acima do piso", "Hours one cent above the floor", idioma), tipo: "numero", casas: 0 },
    { id: "sens_piso", rotulo: tx("Horas no piso com R$ 0,01/MWh (sensibilidade)", "Hours at the floor with R$ 0.01/MWh (sensitivity)", idioma), tipo: "numero", casas: 0 },
    { id: "dias_teto_estrutural", rotulo: tx("Dias com média no teto estrutural", "Days with the average at the structural cap", idioma), tipo: "numero", casas: 0 },
    { id: "dias_teto_estrutural_com_hora_acima", rotulo: tx("Desses, com hora acima do teto estrutural", "Of these, with an hour above the structural cap", idioma), tipo: "numero", casas: 0 },
    { id: "fora", rotulo: tx("Horas fora dos limites (controle)", "Hours outside the limits (check)", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_PERMANENCIA: ColunaTabela[] = colunasPermanencia("pt");

export type LinhaEmpate = LinhaTabela & { id: string; rotulo: string };

/** Horas do ano pelo número de submercados no piso na mesma hora (composição que soma as horas do ano). */
export function linhasEmpates(l: BlocoLimitesDisponivel, idioma: Idioma = idiomaEnergia()): LinhaEmpate[] {
  return l.empates_piso.map((e) => ({
    id: String(e.ano),
    rotulo: e.parcial ? tx(`${e.ano} (parcial)`, `${e.ano} (partial)`, idioma) : String(e.ano),
    q0: e.por_quantidade_no_piso["0"],
    q1: e.por_quantidade_no_piso["1"],
    q2: e.por_quantidade_no_piso["2"],
    q3: e.por_quantidade_no_piso["3"],
    q4: e.por_quantidade_no_piso["4"],
    horas: e.horas,
    quatro_pct: emPct(e.frac_quatro_no_piso),
  }));
}

export function colunasEmpates(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Ano", "Year", idioma), tipo: "texto" },
    { id: "q0", rotulo: tx("Nenhum submercado no piso", "No submarket at the floor", idioma), tipo: "numero", casas: 0 },
    { id: "q1", rotulo: tx("Um no piso", "One at the floor", idioma), tipo: "numero", casas: 0 },
    { id: "q2", rotulo: tx("Dois no piso", "Two at the floor", idioma), tipo: "numero", casas: 0 },
    { id: "q3", rotulo: tx("Três no piso", "Three at the floor", idioma), tipo: "numero", casas: 0 },
    { id: "q4", rotulo: tx("Os quatro no piso", "All four at the floor", idioma), tipo: "numero", casas: 0 },
    { id: "horas", rotulo: tx("Horas do ano", "Hours in the year", idioma), tipo: "numero", casas: 0 },
    { id: "quatro_pct", rotulo: tx("Horas com os quatro no piso", "Hours with all four at the floor", idioma), tipo: "percentual", casas: 2 },
  ];
}
export const COLUNAS_EMPATES: ColunaTabela[] = colunasEmpates("pt");

/** Escala das horas no limite por dia (0 a 24): classes explícitas, zero é valor e tem cor. */
export function escalaHorasDia(idioma: Idioma = idiomaEnergia()): EscalaCores {
  return {
    tipo: "sequencial",
    limites: [1, 6, 12, 24],
    cores: ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"],
    rotulos: tx(
      ["nenhuma hora", "1 a 5 horas", "6 a 11 horas", "12 a 23 horas", "24 horas (o dia inteiro)"],
      ["no hour", "1 to 5 hours", "6 to 11 hours", "12 to 23 hours", "24 hours (the whole day)"],
      idioma,
    ),
  };
}
export const ESCALA_HORAS_DIA: EscalaCores = escalaHorasDia("pt");

function diasSemana(idioma: Idioma) {
  return tx(
    [
      { id: "seg", rotulo: "segunda-feira", curto: "seg" },
      { id: "ter", rotulo: "terça-feira", curto: "ter" },
      { id: "qua", rotulo: "quarta-feira", curto: "qua" },
      { id: "qui", rotulo: "quinta-feira", curto: "qui" },
      { id: "sex", rotulo: "sexta-feira", curto: "sex" },
      { id: "sab", rotulo: "sábado", curto: "sáb" },
      { id: "dom", rotulo: "domingo", curto: "dom" },
    ],
    [
      { id: "seg", rotulo: "Monday", curto: "Mon" },
      { id: "ter", rotulo: "Tuesday", curto: "Tue" },
      { id: "qua", rotulo: "Wednesday", curto: "Wed" },
      { id: "qui", rotulo: "Thursday", curto: "Thu" },
      { id: "sex", rotulo: "Friday", curto: "Fri" },
      { id: "sab", rotulo: "Saturday", curto: "Sat" },
      { id: "dom", rotulo: "Sunday", curto: "Sun" },
    ],
    idioma,
  );
}
type DiaDaSemana = { id: string; rotulo: string; curto: string };

/** Dia da semana com segunda = 0, pelo calendário (sem fuso: a data é local). */
function diaSemanaSeg0(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
}
function somaDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Calendário dos últimos 366 dias completos: uma linha por semana (de segunda a
 * domingo), uma coluna por dia da semana; o valor é o número de horas do dia no
 * limite escolhido. Dias fora do recorte são "não se aplica"; dia do recorte sem
 * valor publicado é ausência (null), nunca zero.
 */
export function calendarioLimite(
  cal: BlocoLimitesDisponivel["calendario"],
  sm: Submercado,
  limite: LimiteHora,
  ultimosDias?: number,
  idioma: Idioma = idiomaEnergia(),
): { linhas: { id: string; rotulo: string; curto: string }[]; colunas: DiaDaSemana[]; valores: ValorCelula[][] } {
  const DIAS_SEMANA = diasSemana(idioma);
  const ini = ultimosDias ? Math.max(0, cal.dias.length - ultimosDias) : 0;
  const dias = cal.dias.slice(ini);
  if (!dias.length) return { linhas: [], colunas: DIAS_SEMANA, valores: [] };
  const serie = (limite === "piso" ? cal[sm].horas_piso : cal[sm].horas_teto_horario).slice(ini);
  const porDia = new Map(dias.map((d, i) => [d, serie[i] ?? null]));
  const inicio = somaDias(dias[0], -diaSemanaSeg0(dias[0]));
  const fim = dias[dias.length - 1];
  const linhas: { id: string; rotulo: string; curto: string }[] = [];
  const valores: ValorCelula[][] = [];
  for (let seg = inicio; seg <= fim; seg = somaDias(seg, 7)) {
    linhas.push({ id: seg, rotulo: tx(`semana de ${dataBR(seg)}`, `week of ${dataBR(seg, idioma)}`, idioma), curto: idioma === "en" ? dataBR(seg, "en").replace(/, \d{4}$/, "") : dataBR(seg).slice(0, 5) });
    valores.push(
      DIAS_SEMANA.map((_, j) => {
        const d = somaDias(seg, j);
        if (!porDia.has(d)) return NAO_SE_APLICA;
        const v = porDia.get(d);
        return typeof v === "number" ? v : null;
      }),
    );
  }
  return { linhas, colunas: DIAS_SEMANA, valores };
}

/** Os mesmos dias do calendário, em tabela (dia, horas no piso, horas no teto horário, média no teto estrutural). */
export function linhasCalendario(cal: BlocoLimitesDisponivel["calendario"], sm: Submercado, ultimosDias?: number, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const est = new Set(cal[sm].dias_teto_estrutural);
  const sem = new Set(cal[sm].dias_sem_teto_estrutural_vigente);
  const ini = ultimosDias ? Math.max(0, cal.dias.length - ultimosDias) : 0;
  return cal.dias.map((d, i) => ({
    id: d,
    dia: d,
    horas_piso: cal[sm].horas_piso[i] ?? null,
    horas_teto_horario: cal[sm].horas_teto_horario[i] ?? null,
    teto_estrutural: sem.has(d)
      ? tx("sem teto estrutural vigente", "no structural cap in force", idioma)
      : est.has(d)
        ? tx("média no teto estrutural", "average at the structural cap", idioma)
        : tx("média abaixo do teto estrutural", "average below the structural cap", idioma),
  })).slice(ini);
}

/** Janelas do calendário: o último semestre (padrão, mais leve) ou os 366 dias publicados. */
export const JANELAS_CALENDARIO = { "6m": 183, "12m": 366 } as const;
export type JanelaCalendario = keyof typeof JANELAS_CALENDARIO;

export function colunasCalendario(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "dia", rotulo: tx("Dia", "Day", idioma), tipo: "data" }, // i18n: dado
    { id: "horas_piso", rotulo: tx("Horas no piso", "Hours at the floor", idioma), tipo: "numero", casas: 0 },
    { id: "horas_teto_horario", rotulo: tx("Horas no teto horário", "Hours at the hourly cap", idioma), tipo: "numero", casas: 0 },
    { id: "teto_estrutural", rotulo: tx("Média diária e teto estrutural", "Daily average and structural cap", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_CALENDARIO: ColunaTabela[] = colunasCalendario("pt");

export function rotuloNivel(n: string | null, idioma: Idioma = idiomaEnergia()): string {
  switch (n ?? "sem_registro") {
    case "texto_do_ato":
      return tx("valores lidos no texto do próprio ato", "values read in the text of the act itself", idioma);
    case "documento_oficial_do_processo":
      return tx("valores lidos em voto ou nota técnica do processo (texto do ato não acessado)", "values read in a vote or technical note of the proceeding (text of the act not accessed)", idioma);
    case "sem_registro":
      return tx("sem registro de conferência", "no record of checking", idioma);
  }
  return n ?? tx("sem registro de conferência", "no record of checking", idioma);
}

function valoresAto(a: AtoLimite, idioma: Idioma): string {
  const v = (rot: string, x: number | null) => `${rot} ${x === null ? tx("não fixado neste ato", "not set in this act", idioma) : `${reais(x, 2, idioma)}/MWh`}`;
  return `${v(tx("piso", "floor", idioma), a.pld_min)}; ${v(tx("teto horário", "hourly cap", idioma), a.pld_max_horario)}; ${v(tx("teto estrutural", "structural cap", idioma), a.pld_max_estrutural)}`;
}

/** Atos anuais como eventos datados (publicação e vigência separadas) para a linha do tempo. */
export function eventosAtos(atos: readonly AtoLimite[], idioma: Idioma = idiomaEnergia()): EventoDatado[] {
  return atos.map((a, i) => ({
    id: `ato-${i}`,
    titulo: `${a.ato}${a.ano !== null ? tx(`: limites de ${a.ano}`, `: limits for ${a.ano}`, idioma) : ""}`,
    categoria: a.nivel_conferencia ?? "sem_registro",
    publicacao: a.data_publicacao,
    vigencia: a.vigencia_inicio,
    fimVigencia: a.vigencia_fim,
    resumo: tx(`${valoresAto(a, idioma)}. Conferência: ${rotuloNivel(a.nivel_conferencia, idioma)}.`, `${valoresAto(a, idioma)}. Check: ${rotuloNivel(a.nivel_conferencia, idioma)}.`, idioma),
    dispositivo: a.dispositivo ?? undefined,
    orgao: "ANEEL",
    fonte: { rotulo: a.documento_titulo ?? a.ato, url: a.documento_url ?? a.url },
    nomesNoTitulo: [a.ato],
    citacoesEmPortugues: true,
  }));
}

export function categoriasAtos(idioma: Idioma = idiomaEnergia()) {
  return [
    { id: "texto_do_ato", rotulo: tx("Valores lidos no ato", "Values read in the act", idioma) },
    { id: "documento_oficial_do_processo", rotulo: tx("Valores lidos em voto ou nota técnica", "Values read in a vote or technical note", idioma) },
    { id: "sem_registro", rotulo: tx("Sem registro de conferência", "No record of checking", idioma) },
  ];
}
export const CATEGORIAS_ATOS = categoriasAtos("pt");

export function linhasAtos(atos: readonly AtoLimite[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return atos.map((a, i) => ({
    id: `ato-${i}`,
    ano: a.ano,
    ato: a.ato,
    publicacao: a.data_publicacao,
    inicio: a.vigencia_inicio,
    fim: a.vigencia_fim,
    piso: a.pld_min,
    teto_h: a.pld_max_horario,
    teto_e: a.pld_max_estrutural,
    nivel: rotuloNivel(a.nivel_conferencia, idioma),
    documento: a.documento_titulo,
    oficial: a.documento_url ?? a.url,
    copia: a.documento_copia,
    sha256: a.documento_sha256,
  }));
}

export function colunasAtos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano de vigência", "Year in force", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "ato", rotulo: tx("Ato", "Act", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "publicacao", rotulo: tx("Publicação", "Publication", idioma), tipo: "data" },
    { id: "inicio", rotulo: tx("Início da vigência", "Start of validity", idioma), tipo: "data" },
    { id: "fim", rotulo: tx("Fim da vigência", "End of validity", idioma), tipo: "data" },
    { id: "piso", rotulo: tx("Piso", "Floor", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "teto_h", rotulo: tx("Teto horário", "Hourly cap", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "teto_e", rotulo: tx("Teto estrutural", "Structural cap", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "nivel", rotulo: tx("Nível de conferência", "Level of checking", idioma), tipo: "texto", categorica: true },
    { id: "documento", rotulo: tx("Documento em que os valores foram lidos", "Document in which the values were read", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "oficial", rotulo: tx("Endereço oficial", "Official address", idioma), tipo: "texto" },
    { id: "copia", rotulo: tx("Cópia lida", "Copy read", idioma), tipo: "texto" },
    { id: "sha256", rotulo: tx("sha256 do documento", "Document sha256", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_ATOS: ColunaTabela[] = colunasAtos("pt");

export function linhasRegimes(regimes: readonly RegimeLimites[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return regimes.map((r) => ({
    id: r.inicio,
    inicio: r.inicio,
    fim: r.fim,
    piso: r.pld_min,
    teto_h: r.pld_max_horario,
    teto_e: r.pld_max_estrutural,
    ato_piso: r.ato_pld_min,
    ato_tetos:
      r.ato_pld_max_horario === r.ato_pld_max_estrutural
        ? r.ato_pld_max_horario
        : listaTexto([r.ato_pld_max_horario ?? tx("sem ato", "no act", idioma), r.ato_pld_max_estrutural ?? tx("sem ato", "no act", idioma)], idioma),
  }));
}

export function colunasRegimes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "inicio", rotulo: tx("Início", "Start", idioma), tipo: "data" },
    { id: "fim", rotulo: tx("Fim", "End", idioma), tipo: "data" },
    { id: "piso", rotulo: tx("Piso", "Floor", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "teto_h", rotulo: tx("Teto horário", "Hourly cap", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "teto_e", rotulo: tx("Teto estrutural", "Structural cap", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "ato_piso", rotulo: tx("Ato do piso", "Floor act", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "ato_tetos", rotulo: tx("Ato dos tetos", "Caps act", idioma), tipo: "texto", idiomaTexto: "nome" },
  ];
}
export const COLUNAS_REGIMES: ColunaTabela[] = colunasRegimes("pt");

export function linhasConferencias(l: BlocoLimitesDisponivel, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const simNao = (v: boolean | null) => (v === null ? null : v ? tx("sim", "yes", idioma) : tx("não", "no", idioma));
  return l.conferencias.map((c) => ({
    id: `${c.ano}:${c.sm}`,
    ano: c.ano,
    sm: curtoSm(c.sm, idioma),
    menor: c.menor_observado,
    piso: c.pld_min_atos.length ? c.pld_min_atos.map((v) => num(v, 2, idioma)).join(tx(" e ", " and ", idioma)) : null,
    menor_igual: simNao(c.menor_igual_ao_piso),
    maior: c.maior_observado,
    teto: c.pld_max_horario_atos.length ? c.pld_max_horario_atos.map((v) => num(v, 2, idioma)).join(tx(" e ", " and ", idioma)) : null,
    maior_igual: simNao(c.maior_igual_ao_teto_horario),
  }));
}

export function colunasConferencias(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "sm", rotulo: tx("Submercado", "Submarket", idioma), tipo: "texto", categorica: true },
    { id: "menor", rotulo: tx("Menor valor observado", "Lowest value observed", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 }, // i18n: dado
    { id: "piso", rotulo: tx("Piso dos atos (R$/MWh)", "Floor in the acts (R$/MWh)", idioma), tipo: "texto" },
    { id: "menor_igual", rotulo: tx("Menor observado igual ao piso", "Lowest observed equal to the floor", idioma), tipo: "texto", categorica: true },
    { id: "maior", rotulo: tx("Maior valor observado", "Highest value observed", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 }, // i18n: dado
    { id: "teto", rotulo: tx("Teto horário dos atos (R$/MWh)", "Hourly cap in the acts (R$/MWh)", idioma), tipo: "texto" },
    { id: "maior_igual", rotulo: tx("Maior observado igual ao teto horário", "Highest observed equal to the hourly cap", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_CONFERENCIAS: ColunaTabela[] = colunasConferencias("pt");

/* ====================================================================== */
/* P011: histórico e distribuição                                         */
/* ====================================================================== */

export type MedidaMensal = "temporal" | "ponderada_carga" | "ponderada_carga_sem_mmgd" | "real";
export const MEDIDAS_MENSAIS: readonly MedidaMensal[] = ["temporal", "ponderada_carga", "ponderada_carga_sem_mmgd", "real"];
export function rotuloMedida(m: MedidaMensal, idioma: Idioma = idiomaEnergia()): string {
  switch (m) {
    case "temporal":
      return tx("Média temporal (todas as horas pesam igual)", "Time-weighted average (every hour weighs the same)", idioma);
    case "ponderada_carga":
      return tx("Ponderada pela carga do balanço do ONS", "Weighted by ONS balance load", idioma);
    case "ponderada_carga_sem_mmgd":
      return tx("Ponderada pela carga sem MMGD (mesma base em toda a série)", "Weighted by load without MMGD (same basis across the series)", idioma);
    case "real":
      return tx("Média temporal em moeda constante (IPCA)", "Time-weighted average in constant currency (IPCA)", idioma);
  }
}
export function curtoMedida(m: MedidaMensal, idioma: Idioma = idiomaEnergia()): string {
  switch (m) {
    case "temporal":
      return tx("temporal", "time-weighted", idioma);
    case "ponderada_carga":
      return tx("ponderada (balanço)", "weighted (balance)", idioma);
    case "ponderada_carga_sem_mmgd":
      return tx("ponderada sem MMGD", "weighted without MMGD", idioma);
    case "real":
      return tx("temporal em moeda constante", "time-weighted in constant currency", idioma);
  }
}
export const ROTULO_MEDIDA: Record<MedidaMensal, string> = Object.fromEntries(MEDIDAS_MENSAIS.map((m) => [m, rotuloMedida(m, "pt")])) as Record<MedidaMensal, string>;
export const CURTO_MEDIDA: Record<MedidaMensal, string> = Object.fromEntries(MEDIDAS_MENSAIS.map((m) => [m, curtoMedida(m, "pt")])) as Record<MedidaMensal, string>;

export function rotuloPerimetro(p: string, idioma: Idioma = idiomaEnergia()): string {
  switch (p) {
    case "P1":
      return tx("P1: carga de usinas despachadas pelo ONS", "P1: load of plants dispatched by ONS", idioma);
    case "P2":
      return tx("P2: inclui previsão de usinas não despachadas", "P2: includes the forecast for non-dispatched plants", idioma);
    case "P3":
      return tx("P3: inclui também a MMGD estimada", "P3: also includes estimated MMGD", idioma);
    case "P2_P3":
      return tx("mudança de P2 para P3 dentro do mês", "change from P2 to P3 within the month", idioma);
    case "P1_P2":
      return tx("mudança de P1 para P2 dentro do mês", "change from P1 to P2 within the month", idioma);
  }
  return p;
}

/** Meses de um submercado: o gráfico mensal, a tabela equivalente e o CSV mensal têm estas mesmas colunas. */
export function linhasMensais(h: BlocoHistorico, sm: Submercado, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const m = h.mensal;
  const s = m[sm];
  const simNao = (v: boolean) => (v ? tx("sim", "yes", idioma) : tx("não", "no", idioma));
  return m.meses.map((mes, i) => ({
    id: mes,
    m: mes,
    dias: m.dias_completos[i],
    parcial: simNao(m.parcial[i]),
    perimetro: m.perimetro_carga[i],
    temporal: s.temporal[i] ?? null,
    ponderada_carga: s.ponderada_carga[i] ?? null,
    ponderada_carga_sem_mmgd: s.ponderada_carga_sem_mmgd[i] ?? null,
    real: s.real[i] ?? null,
    horas: s.horas[i],
    horas_com_carga: s.horas_com_carga[i],
    mesmas_horas: simNao(s.mesmas_horas[i]),
    horas_com_carga_sem_mmgd: s.horas_com_carga_sem_mmgd[i],
    mesmas_horas_sem_mmgd: simNao(s.mesmas_horas_sem_mmgd[i]),
  }));
}

export function colunasMensais(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "texto" },
    { id: "dias", rotulo: tx("Dias completos", "Complete days", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "parcial", rotulo: tx("Mês parcial", "Partial month", idioma), tipo: "texto", categorica: true },
    { id: "perimetro", rotulo: tx("Perímetro da carga do balanço", "Balance load perimeter", idioma), tipo: "texto", categorica: true },
    { id: "temporal", rotulo: tx("Média temporal", "Time-weighted average", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "ponderada_carga", rotulo: tx("Ponderada pela carga do balanço", "Weighted by balance load", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "ponderada_carga_sem_mmgd", rotulo: tx("Ponderada pela carga sem MMGD", "Weighted by load without MMGD", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "real", rotulo: tx("Média temporal em moeda constante", "Time-weighted average in constant currency", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "horas", rotulo: tx("Horas com PLD", "Hours with PLD", idioma), tipo: "numero", casas: 0 },
    { id: "horas_com_carga", rotulo: tx("Horas com carga do balanço", "Hours with balance load", idioma), tipo: "numero", casas: 0 },
    { id: "mesmas_horas", rotulo: tx("Ponderada nas mesmas horas da temporal", "Weighted over the same hours as the time-weighted", idioma), tipo: "texto", categorica: true },
    { id: "horas_com_carga_sem_mmgd", rotulo: tx("Horas com carga sem MMGD", "Hours with load without MMGD", idioma), tipo: "numero", casas: 0 },
    { id: "mesmas_horas_sem_mmgd", rotulo: tx("Sem MMGD nas mesmas horas", "Without MMGD over the same hours", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_MENSAIS: ColunaTabela[] = colunasMensais("pt");

/** Uma medida para vários submercados (comparação de até quatro na mesma escala). */
export function serieMedidaPorSm(h: BlocoHistorico, medida: MedidaMensal, sms: readonly Submercado[]): Record<string, string | number | null>[] {
  return h.mensal.meses.map((mes, i) => {
    const linha: Record<string, string | number | null> = { m: mes };
    for (const sm of sms) linha[sm] = h.mensal[sm][medida][i] ?? null;
    return linha;
  });
}

/** Mudanças de perímetro do peso declaradas pelo ONS, como marcos no eixo mensal. */
export function marcosPerimetro(h: BlocoHistorico): { x: string; rotulo: string }[] {
  return h.ponderacao.quebras.map((q) => ({ x: q.mes, rotulo: `${q.descricao.replace(/\.$/, "")} (${dataBR(q.data)})` }));
}

export function respostaP011(h: BlocoHistorico, sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  const R = (v: number | null) => reais(v, 2, idioma);
  const n = (v: number, casas: number) => num(v, casas, idioma);
  const p = h.posicao_referencia.find((x) => x.sm === sm);
  const partes: string[] = [];
  if (!p || p.media_dia === null) {
    partes.push(tx(`Sem média diária completa no dia de referência ${NO_SM[sm]}.`, `No complete daily average on the reference day ${noSm(sm, idioma)}.`, idioma));
  } else {
    const mm = p.mesmo_mes;
    const anos = Array.from(new Set(h.sazonal_mes.find((s) => s.sm === sm && s.mes === mm.mes)?.anos ?? []));
    const faixaAnos = anos.length ? tx(` de ${anos[0]} a ${anos[anos.length - 1]}`, ` ${anos[0]} to ${anos[anos.length - 1]}`, idioma) : "";
    const abertura = tx(
      `Em ${dataBR(p.dia, idioma)}, a média diária do PLD ${DO_SM[sm]} foi ${R(p.media_dia)}/MWh: `,
      `On ${dataBR(p.dia, idioma)}, the daily average PLD ${doSm(sm, idioma)} was ${R(p.media_dia)}/MWh: `,
      idioma,
    );
    const corpo =
      mm.percentil === null
        ? tx(`sem percentil, porque não há dias de ${nomeMes(mm.mes, idioma)} em anos anteriores.`, `no percentile, because there are no days in ${nomeMes(mm.mes, idioma)} in previous years.`, idioma)
        : tx(
            `percentil ${n(mm.percentil, 1)} entre as ${n(mm.n_dias, 0)} médias diárias de ${nomeMes(mm.mes, idioma)}${faixaAnos} (mediana ${R(mm.p50)}/MWh)`,
            `percentile ${n(mm.percentil, 1)} among the ${n(mm.n_dias, 0)} daily averages for ${nomeMes(mm.mes, idioma)}${faixaAnos} (median ${R(mm.p50)}/MWh)`,
            idioma,
          ) +
          (p.mesma_semana_iso.percentil === null
            ? "."
            : tx(
                ` e percentil ${n(p.mesma_semana_iso.percentil, 1)} entre os ${n(p.mesma_semana_iso.n_dias, 0)} dias da mesma semana ISO (${p.mesma_semana_iso.semana}) desses anos.`,
                ` and percentile ${n(p.mesma_semana_iso.percentil, 1)} among the ${n(p.mesma_semana_iso.n_dias, 0)} days of the same ISO week (${p.mesma_semana_iso.semana}) in those years.`,
                idioma,
              ));
    partes.push(abertura + corpo);
  }
  const mc = h.mes_corrente.find((x) => x.sm === sm);
  if (mc && mc.media_dias_completos !== null) {
    const ant = mc.mesmo_mes_anos_anteriores.filter((a) => a.media !== null).map((a) => `${a.ano}: ${R(a.media)}`);
    partes.push(
      `${mesAno(mc.mes, idioma)}${mc.parcial ? tx(` (parcial, ${plural(mc.dias, "dia completo", "dias completos", idioma)})`, ` (partial, ${plural(mc.dias, "complete day", "complete days", idioma)})`, idioma) : ""}` +
        tx(`: média temporal de ${R(mc.media_dias_completos)}/MWh`, `: time-weighted average of ${R(mc.media_dias_completos)}/MWh`, idioma) +
        (ant.length ? tx(`; no mesmo mês dos anos anteriores, ${listaTexto(ant, idioma)} (R$/MWh).`, `; in the same month of previous years, ${listaTexto(ant, idioma)} (R$/MWh).`, idioma) : "."),
    );
  }
  partes.push(tx("Percentil não é previsão, e cada ano teve piso e tetos próprios.", "A percentile is not a forecast, and each year had its own floor and caps.", idioma));
  return partes.join(" ");
}

/** A mesma resposta do P011, em inglês (mesmos campos, mesmos números). */

/**
 * Veredito do P011 em palavras simples. O critério é o que a página já tem: a mediana e o percentil das médias diárias do mesmo mês
 * em anos anteriores (percentil = fração de dias menores mais metade dos empates). A frase "em X% desses dias a média foi menor" só
 * sai quando não há empate; com empate, o veredito diz o percentil. A metade central vai do 25º ao 75º percentil, a mesma regra
 * das faixas baixa, central e alta da página principal.
 */
export function vereditoP011(h: BlocoHistorico, sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  const p = h.posicao_referencia.find((x) => x.sm === sm);
  if (!p || p.media_dia === null) return tx(`Sem média diária completa no dia de referência ${NO_SM[sm]}.`, `No complete daily average on the reference day ${noSm(sm, idioma)}.`, idioma);
  const mm = p.mesmo_mes;
  if (mm.percentil === null || mm.p50 === null)
    return tx(`Em ${dataBR(p.dia, idioma)}, não há dias de ${nomeMes(mm.mes, idioma)} em anos anteriores para comparar.`, `On ${dataBR(p.dia, idioma)}, there are no days in ${nomeMes(mm.mes, idioma)} in previous years to compare with.`, idioma);
  const anos = Array.from(new Set(h.sazonal_mes.find((s) => s.sm === sm && s.mes === mm.mes)?.anos ?? []));
  const faixaAnos =
    anos.length > 1
      ? tx(` de ${anos[0]} a ${anos[anos.length - 1]}`, ` ${anos[0]} to ${anos[anos.length - 1]}`, idioma)
      : anos.length === 1
        ? tx(` de ${anos[0]}`, ` ${anos[0]}`, idioma)
        : "";
  const centavos = (v: number) => Math.round(v * 100);
  const frenteMediana =
    centavos(p.media_dia) === centavos(mm.p50)
      ? tx("igual à mediana", "equal to the median", idioma)
      : p.media_dia < mm.p50
        ? tx("abaixo da mediana", "below the median", idioma)
        : tx("acima da mediana", "above the median", idioma);
  const faixa =
    mm.percentil < 25
      ? tx("entre os 25% mais baixos", "among the lowest 25%", idioma)
      : mm.percentil > 75
        ? tx("entre os 25% mais altos", "among the highest 25%", idioma)
        : tx("na metade central", "in the middle half", idioma);
  const posicao =
    mm.empates === 0
      ? tx(`Em ${num(mm.percentil, 1, idioma)}% desses dias a média foi menor.`, `On ${num(mm.percentil, 1, idioma)}% of those days the average was lower.`, idioma)
      : tx(`A posição entre esses dias é o percentil ${num(mm.percentil, 1, idioma)}.`, `The position among those days is percentile ${num(mm.percentil, 1, idioma)}.`, idioma);
  return tx(
    `Em ${dataBR(p.dia, idioma)}, a média diária do PLD ${DO_SM[sm]} ficou ${frenteMediana} dos dias de ${nomeMes(mm.mes, idioma)}${faixaAnos} e ${faixa} deles. ${posicao}`,
    `On ${dataBR(p.dia, idioma)}, the daily average PLD ${doSm(sm, idioma)} was ${frenteMediana} of the days in ${nomeMes(mm.mes, idioma)}${faixaAnos} and ${faixa} of them. ${posicao}`,
    idioma,
  );
}

/**
 * Por que o percentil do cartão da página principal difere do percentil do Histórico para o mesmo dia e a mesma média: o cartão
 * compara o dia com todas as médias diárias desde 2021 (todos os meses); o Histórico, só com os dias do mesmo mês de anos anteriores.
 * Devolve null quando falta um dos dois percentis. Os dois números vêm da gold (pld.json e pld_detalhe.json).
 */
export function notaDoisPercentis(
  cartao: { sm: Submercado; media_dia: number | null; posicao: { percentil: number | null; n_dias: number } } | undefined,
  historico: PosicaoReferencia | undefined,
): string | null {
  if (!cartao || !historico || cartao.posicao.percentil === null || historico.mesmo_mes.percentil === null || cartao.media_dia === null) return null;
  return tx(
    `O percentil dos cartões compara a média do dia com as ${num(cartao.posicao.n_dias, 0)} médias diárias desde 2021, de todos os meses; o painel Histórico compara com os ` +
      `${num(historico.mesmo_mes.n_dias, 0)} dias de ${nomeMes(historico.mesmo_mes.mes)} de anos anteriores. Por isso os dois diferem para a mesma média: no ${CURTO_SM[cartao.sm]}, ` +
      `percentil ${num(cartao.posicao.percentil, 1)} nos cartões e ${num(historico.mesmo_mes.percentil, 1)} no Histórico, com média de ${reais(cartao.media_dia)}/MWh.`,
    `The card percentile compares the day's average with the ${num(cartao.posicao.n_dias, 0)} daily averages since 2021, across all months; the History panel compares it with the ` +
      `${num(historico.mesmo_mes.n_dias, 0)} days in ${nomeMes(historico.mesmo_mes.mes)} of previous years. That is why the two differ for the same average: in the ${curtoSm(cartao.sm)}, ` +
      `percentile ${num(cartao.posicao.percentil, 1)} in the cards and ${num(historico.mesmo_mes.percentil, 1)} in History, with an average of ${reais(cartao.media_dia)}/MWh.`,
  );
}

/**
 * "O que mudou" do P011 sem a frase confusa da gold: em cada submercado, a média ponderada pela carga do balanço contra a média
 * temporal e contra a ponderada sem MMGD, no mês das fichas. Os limites vêm de por_sm (a gold traz as diferenças prontas); o sentido
 * (acima ou abaixo) só é escrito quando é o mesmo nos quatro submercados.
 */
export function textoSensibilidadePeso(sp: SensibilidadePeso, idioma: Idioma = idiomaEnergia()): string {
  const R = (v: number) => reais(v, 2, idioma);
  const faixa = (vs: number[], termo: string) => {
    if (!vs.length) return null;
    const todosPos = vs.every((v) => v > 0);
    const todosNeg = vs.every((v) => v < 0);
    if (!todosPos && !todosNeg) return tx(`de ${R(Math.min(...vs))} a ${R(Math.max(...vs))}/MWh em relação ${termo}`, `from ${R(Math.min(...vs))} to ${R(Math.max(...vs))}/MWh relative to ${termo}`, idioma);
    const abs = vs.map(Math.abs);
    return tx(`de ${R(Math.min(...abs))} a ${R(Math.max(...abs))}/MWh ${todosPos ? "acima" : "abaixo"} ${termo}`, `from ${R(Math.min(...abs))} to ${R(Math.max(...abs))}/MWh ${todosPos ? "above" : "below"} ${termo}`, idioma);
  };
  const a = faixa(sp.por_sm.map((x) => x.ponderada_menos_temporal), tx("da média temporal", "the time-weighted average", idioma));
  const b = faixa(sp.por_sm.map((x) => x.ponderada_menos_sem_mmgd), tx("da ponderada pela carga sem MMGD", "the average weighted by load without MMGD", idioma));
  if (!a || !b) return "";
  return tx(
    `Em ${mesAno(sp.mes, idioma)}, nos quatro submercados, a média ponderada pela carga do balanço (com a MMGD estimada) ficou ${a} e ${b}. A escolha do peso muda o resultado; as duas ponderadas são publicadas, cada uma com o seu perímetro.`,
    `In ${mesAno(sp.mes, idioma)}, in all four submarkets, the average weighted by balance load (with estimated MMGD) was ${a} and ${b}. The choice of weight changes the result; both weighted averages are published, each with its own perimeter.`,
    idioma,
  );
}

export function linhasSazonal(h: BlocoHistorico, sm: Submercado, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return h.sazonal_mes
    .filter((s) => s.sm === sm)
    .sort((a, b) => a.mes - b.mes)
    .map((s) => ({ id: String(s.mes), mes: nomeMesFmt(s.mes, idioma), n: s.n, anos: s.anos.join(", "), p10: s.p10, p25: s.p25, p50: s.p50, p75: s.p75, p90: s.p90 }));
}

export function colunasSazonal(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "mes", rotulo: tx("Mês", "Month", idioma), tipo: "texto" },
    { id: "n", rotulo: tx("Dias", "Days", idioma), tipo: "numero", casas: 0 },
    { id: "anos", rotulo: tx("Anos", "Years", idioma), tipo: "texto" }, // i18n: dado
    { id: "p10", rotulo: tx("Percentil 10", "Percentile 10", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p25", rotulo: tx("Percentil 25", "Percentile 25", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p50", rotulo: tx("Mediana", "Median", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p75", rotulo: tx("Percentil 75", "Percentile 75", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p90", rotulo: tx("Percentil 90", "Percentile 90", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}
export const COLUNAS_SAZONAL: ColunaTabela[] = colunasSazonal("pt");

/**
 * Faixa sazonal (médias diárias de anos anteriores, por mês do ano) com a média
 * mensal do ano de referência na mesma linha do mês: a mesma regra de rótulo no
 * gráfico e na tabela. A média do mês é média das horas, menos dispersa que os
 * dias; o texto "Como ler" do painel diz isso.
 */
export function serieSazonal(h: BlocoHistorico, sm: Submercado, anoReferencia: number, idioma: Idioma = idiomaEnergia()): Record<string, string | number | null>[] {
  const mensal = h.mensal;
  return linhasSazonal(h, sm, idioma).map((l) => {
    const mes = `${anoReferencia}-${String(l.id).padStart(2, "0")}`;
    const i = mensal.meses.indexOf(mes);
    return { mes: l.mes as string, p10: l.p10 as number | null, p25: l.p25 as number | null, p50: l.p50 as number | null, p75: l.p75 as number | null, p90: l.p90 as number | null, ano: i >= 0 ? (mensal[sm].temporal[i] ?? null) : null };
  });
}

export type FaixaRegime = { id: string; rotulo: string; p10: number | null; p25: number | null; p50: number | null; p75: number | null; p90: number | null; media: number | null; piso: number | null; teto_h: number | null; teto_e: number | null; n: number; frac_piso: number | null; frac_teto: number | null; parcial: boolean };

/** Distribuição do PLD horário por ano (regime anual de limites) de um submercado. */
export function faixasRegimes(h: BlocoHistorico, sm: Submercado, idioma: Idioma = idiomaEnergia()): FaixaRegime[] {
  return h.regimes
    .filter((r) => r.sm === sm)
    .sort((a, b) => a.ano - b.ano)
    .map((r) => {
      const l = r.limites.length === 1 ? r.limites[0] : null;
      return {
        id: String(r.ano),
        rotulo: r.parcial ? tx(`${r.ano} (parcial)`, `${r.ano} (partial)`, idioma) : String(r.ano),
        p10: r.p10,
        p25: r.p25,
        p50: r.p50,
        p75: r.p75,
        p90: r.p90,
        media: r.media,
        piso: l?.pld_min ?? null,
        teto_h: l?.pld_max_horario ?? null,
        teto_e: l?.pld_max_estrutural ?? null,
        n: r.n,
        frac_piso: emPct(r.frac_piso),
        frac_teto: emPct(r.frac_teto_horario),
        parcial: r.parcial,
      };
    });
}

export function colunasRegimesDist(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Ano", "Year", idioma), tipo: "texto" },
    { id: "n", rotulo: tx("Horas", "Hours", idioma), tipo: "numero", casas: 0 },
    { id: "p10", rotulo: tx("Percentil 10", "Percentile 10", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p25", rotulo: tx("Percentil 25", "Percentile 25", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p50", rotulo: tx("Mediana", "Median", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p75", rotulo: tx("Percentil 75", "Percentile 75", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p90", rotulo: tx("Percentil 90", "Percentile 90", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "media", rotulo: tx("Média", "Average", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "piso", rotulo: tx("Piso do ano", "Floor for the year", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "teto_e", rotulo: tx("Teto estrutural do ano", "Structural cap for the year", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "teto_h", rotulo: tx("Teto horário do ano", "Hourly cap for the year", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "frac_piso", rotulo: tx("Horas no piso", "Hours at the floor", idioma), tipo: "percentual", casas: 2 },
    { id: "frac_teto", rotulo: tx("Horas no teto horário", "Hours at the hourly cap", idioma), tipo: "percentual", casas: 2 },
  ];
}
export const COLUNAS_REGIMES_DIST: ColunaTabela[] = colunasRegimesDist("pt");

/**
 * Escala fixa do PLD nos mapas de calor (R$/MWh nominais). Fixa, e não por
 * quantis do recorte, para que a mesma cor signifique o mesmo preço em qualquer
 * submercado, mês ou janela (seção 8.3: escala fixa por padrão).
 */
export const ESCALA_PLD: EscalaCores = {
  tipo: "sequencial",
  limites: [80, 150, 300, 600],
  cores: ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"],
};

/** As 24 horas do dia ("00h às 01h", "00h to 01h"). */
export function horasDoDia(idioma: Idioma = idiomaEnergia()) {
  return Array.from({ length: 24 }, (_, h) => ({
    id: String(h).padStart(2, "0"),
    rotulo: tx(`${String(h).padStart(2, "0")}h às ${String((h + 1) % 24).padStart(2, "0")}h`, `${String(h).padStart(2, "0")}h to ${String((h + 1) % 24).padStart(2, "0")}h`, idioma),
    curto: `${h}h`,
  }));
}
export const HORAS_DO_DIA = horasDoDia("pt");

/** Perfil hora × mês (médias por hora do dia nos últimos 12 meses), direto da gold. */
export function perfilHoraMes(h: BlocoHistorico, sm: Submercado, idioma: Idioma = idiomaEnergia()): { linhas: { id: string; rotulo: string; curto: string }[]; valores: ValorCelula[][] } {
  const p = h.perfil_hora_mes;
  return {
    linhas: p.meses.map((m, i) => ({ id: m, rotulo: `${mesAno(m, idioma)}${p.parcial[i] ? tx(" (parcial)", " (partial)", idioma) : ""}`, curto: mesAno(m, idioma) })),
    valores: p[sm].map((linha) => linha.map((v) => (typeof v === "number" ? v : null))),
  };
}

export const JANELAS_HORA_DIA = [30, 60, 90] as const;
export type JanelaHoraDia = (typeof JANELAS_HORA_DIA)[number];

/** Últimos n dias do mapa hora × dia (arquivo sob demanda); hora sem PLD é ausência. */
export function horaDiaRecorte(a: PldHoraDiaArquivo, sm: Submercado, n: number, idioma: Idioma = idiomaEnergia()): { linhas: { id: string; rotulo: string; curto: string }[]; valores: ValorCelula[][] } {
  const ini = Math.max(0, a.dias.length - n);
  return {
    linhas: a.dias.slice(ini).map((d) => ({ id: d, rotulo: dataBR(d, idioma), curto: idioma === "en" ? dataBR(d, "en").replace(/, \d{4}$/, "") : dataBR(d).slice(0, 5) })),
    valores: a[sm].slice(ini).map((linha) => linha.map((v) => (typeof v === "number" ? v : null))),
  };
}

export function linhasRevisoesCarga(h: BlocoHistorico, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return h.ponderacao.revisoes_carga.map((r) => ({
    id: `${r.sm}:${r.mes}`,
    sm: curtoSm(r.sm, idioma),
    mes: r.mes,
    horas: r.horas_revisadas,
    max_abs: r.max_abs_mwmed,
    quando: r.quando_max,
    media_abs: r.media_abs_mwmed,
    max_rel: emPct(r.max_rel),
    troca: r.horas_com_troca_de_sinal,
    primeira: r.ponderada_primeira_captura,
    vigente: r.ponderada_vigente,
    efeito: r.efeito_na_ponderada,
  }));
}

export function colunasRevisoesCarga(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "sm", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto", categorica: true },
    { id: "mes", rotulo: tx("Mês", "Month", idioma), tipo: "texto" },
    { id: "horas", rotulo: tx("Horas revistas", "Hours revised", idioma), tipo: "numero", casas: 0 },
    { id: "max_abs", rotulo: tx("Maior variação absoluta", "Largest absolute change", idioma), tipo: "numero", unidade: mw, casas: 3 },
    { id: "quando", rotulo: tx("Hora da maior variação", "Hour of the largest change", idioma), tipo: "texto" }, // i18n: dado
    { id: "media_abs", rotulo: tx("Variação absoluta média", "Average absolute change", idioma), tipo: "numero", unidade: mw, casas: 3 },
    { id: "max_rel", rotulo: tx("Maior variação relativa", "Largest relative change", idioma), tipo: "percentual", casas: 2 },
    { id: "troca", rotulo: tx("Horas com troca de sinal", "Hours with a change of sign", idioma), tipo: "numero", casas: 0 },
    { id: "primeira", rotulo: tx("Ponderada com a primeira captura", "Weighted with the first capture", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "vigente", rotulo: tx("Ponderada vigente", "Current weighted", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "efeito", rotulo: tx("Efeito da revisão na ponderada", "Effect of the revision on the weighted average", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}
export const COLUNAS_REVISOES_CARGA: ColunaTabela[] = colunasRevisoesCarga("pt");

export function linhasPerimetros(h: BlocoHistorico, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const simNao = (v: boolean) => (v ? tx("sim", "yes", idioma) : tx("não", "no", idioma));
  return h.ponderacao.perimetros.map((p) => ({
    id: p.id,
    perimetro: rotuloPerimetro(p.id, idioma),
    meses: p.primeiro_mes && p.ultimo_mes ? tx(`${mesAno(p.primeiro_mes)} a ${mesAno(p.ultimo_mes)}`, `${mesAno(p.primeiro_mes, idioma)} to ${mesAno(p.ultimo_mes, idioma)}`, idioma) : null,
    n: p.n_meses,
    natureza: p.natureza_do_peso === "OBSERVADO" ? tx("observado", "observed", idioma) : tx("estimado", "estimated", idioma),
    mmgd: simNao(p.inclui_mmgd),
    componente: p.componente_estimado,
    trecho: p.trecho,
    conferido: p.trecho_conferido === null ? tx("sem captura", "no capture", idioma) : simNao(p.trecho_conferido),
    erro_com_se: p.conferencia?.SE.erro_abs_medio_com_mmgd ?? null,
    erro_sem_se: p.conferencia?.SE.erro_abs_medio_sem_mmgd ?? null,
  }));
}

export function colunasPerimetros(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "perimetro", rotulo: tx("Perímetro", "Perimeter", idioma), tipo: "texto" },
    { id: "meses", rotulo: tx("Meses", "Months", idioma), tipo: "texto" },
    { id: "n", rotulo: tx("Nº de meses", "No. of months", idioma), tipo: "numero", casas: 0 },
    { id: "natureza", rotulo: tx("Natureza do peso", "Nature of the weight", idioma), tipo: "texto", categorica: true },
    { id: "mmgd", rotulo: tx("Inclui MMGD", "Includes MMGD", idioma), tipo: "texto", categorica: true },
    { id: "componente", rotulo: tx("Componente estimado", "Estimated component", idioma), tipo: "texto", idiomaTexto: "portugues" },
    { id: "trecho", rotulo: tx("Trecho da descrição do ONS", "Excerpt from the ONS description", idioma), tipo: "texto", idiomaTexto: "portugues" },
    { id: "conferido", rotulo: tx("Trecho conferido na captura", "Excerpt checked in the capture", idioma), tipo: "texto", categorica: true },
    { id: "erro_com_se", rotulo: tx("SE/CO: erro médio contra a carga com MMGD", "SE/CW: average error against load with MMGD", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "erro_sem_se", rotulo: tx("SE/CO: erro médio contra a carga sem MMGD", "SE/CW: average error against load without MMGD", idioma), tipo: "numero", unidade: mw, casas: 1 },
  ];
}
export const COLUNAS_PERIMETROS: ColunaTabela[] = colunasPerimetros("pt");

/* ====================================================================== */
/* P012: diferenças regionais                                             */
/* ====================================================================== */

export function rotuloPeriodo(r: BlocoRegional, id: string, idioma: Idioma = idiomaEnergia()): string {
  const rot = r.periodos.find((p) => p.id === id)?.rotulo;
  return rot === undefined ? id : rotuloPeriodoRegional(rot, idioma);
}

/** Rótulo de período da gold regional no idioma ("Últimos 12 meses", "2025 (parcial)"...). */
export function rotuloPeriodoRegional(rotulo: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return rotulo;
  return rotulo
    .replace(/^Últimos 12 meses$/i, "Last 12 months")
    .replace(/^Últimos 30 dias$/i, "Last 30 days")
    .replace(/\(parcial\)/i, "(partial)");
}

export function respostaP012(r: BlocoRegional, periodo: string, idioma: Idioma = idiomaEnergia()): string {
  const R = (v: number | null) => reais(v, 2, idioma);
  const n = (v: number) => num(v, 0, idioma);
  const a = r.amplitude.find((x) => x.periodo === periodo);
  const per = r.periodos.find((p) => p.id === periodo);
  if (!a || !per) return tx("Sem horas com os quatro submercados publicados neste período.", "No hours with all four submarkets published in this period.", idioma);
  const partes = [
    tx(
      `${per.rotulo}, ${dataBR(a.inicio, idioma)} a ${dataBR(a.fim, idioma)}: em ${n(a.horas_com_separacao)} de ${plural(a.horas, "hora", "horas", idioma)} com os quatro submercados (${fracPct(a.frac_com_separacao, 1, idioma)}), o maior e o menor PLD da mesma hora diferiram em mais de R$ 0,01/MWh; em ${n(a.horas_acima_1)} horas a diferença passou de R$ 1,00/MWh e em ${n(a.horas_acima_10)}, de R$ 10,00/MWh.`,
      `${rotuloPeriodoRegional(per.rotulo, idioma)}, ${dataBR(a.inicio, idioma)} to ${dataBR(a.fim, idioma)}: in ${n(a.horas_com_separacao)} of ${plural(a.horas, "hour", "hours", idioma)} with all four submarkets (${fracPct(a.frac_com_separacao, 1, idioma)}), the highest and lowest PLD in the same hour differed by more than R$ 0.01/MWh; in ${n(a.horas_acima_1)} hours the difference exceeded R$ 1.00/MWh and in ${n(a.horas_acima_10)}, R$ 10.00/MWh.`,
      idioma,
    ),
  ];
  if (a.media !== null && a.max !== null) {
    partes.push(
      tx(
        `A diferença entre o maior e o menor preço teve média de ${R(a.media)}/MWh no período e chegou a ${R(a.max)}/MWh em ${dataBR(a.quando_max, idioma)} às ${a.quando_max.slice(11, 13)}h.`,
        `The difference between the highest and lowest price averaged ${R(a.media)}/MWh in the period and reached ${R(a.max)}/MWh on ${dataBR(a.quando_max, idioma)} at ${a.quando_max.slice(11, 13)}h.`,
        idioma,
      ),
    );
    const base = textoMediaDaAmplitude(a, idioma);
    if (base) partes.push(base);
  }
  const pares = r.separacao.filter((s) => s.periodo === periodo && s.frac_separadas !== null).sort((x, y) => (y.frac_separadas ?? 0) - (x.frac_separadas ?? 0));
  if (pares.length >= 2) {
    const mais = pares[0];
    const menos = pares[pares.length - 1];
    partes.push(
      tx(
        `O par que mais se separou foi ${nomePar(mais.par, idioma)} (${fracPct(mais.frac_separadas, 1, idioma)} das horas); o que menos, ${nomePar(menos.par, idioma)} (${fracPct(menos.frac_separadas, 1, idioma)}).`,
        `The pair that diverged most was ${nomePar(mais.par, idioma)} (${fracPct(mais.frac_separadas, 1, idioma)} of hours); the one that diverged least, ${nomePar(menos.par, idioma)} (${fracPct(menos.frac_separadas, 1, idioma)}).`,
        idioma,
      ),
    );
  }
  partes.push(tx("A contagem descreve quando os preços diferem; sem os limites de intercâmbio, não diz por quê.", "The count describes when prices differ; without the interchange limits, it does not say why.", idioma));
  return partes.join(" ");
}

/** A mesma resposta do P012, em inglês (mesmos campos, mesmos números). */

/**
 * Veredito do P012 em palavras simples: em que fração das horas os preços dos submercados diferiram (mais de um centavo, o limiar
 * da página) e quanto, na média, entre o maior e o menor. Lê os mesmos campos de amplitude que a resposta completa (respostaP012).
 */
export function vereditoP012(r: BlocoRegional, periodo: string, idioma: Idioma = idiomaEnergia()): string {
  const a = r.amplitude.find((x) => x.periodo === periodo);
  const per = r.periodos.find((p) => p.id === periodo);
  if (!a || !per) return tx("Sem horas com os quatro submercados publicados neste período.", "No hours with all four submarkets published in this period.", idioma);
  const quando =
    periodo === "12m"
      ? tx("Nos últimos 12 meses", "In the last 12 months", idioma)
      : periodo === "30d"
        ? tx("Nos últimos 30 dias", "In the last 30 days", idioma)
        : /parcial/i.test(per.rotulo)
          ? tx(`Em ${per.rotulo.replace(/\s*\(parcial\)/i, "")} (até ${dataBR(a.fim, idioma)})`, `In ${per.rotulo.replace(/\s*\(parcial\)/i, "")} (up to ${dataBR(a.fim, idioma)})`, idioma)
          : tx(`Em ${per.rotulo}`, `In ${rotuloPeriodoRegional(per.rotulo, idioma)}`, idioma);
  // os dois critérios lado a lado: um centavo (o da página) e R$ 1,00 (o da página PLD); a média vale para todas as horas do período
  const acima1 =
    a.horas > 0
      ? tx(` e em mais de ${reais(1, 2, idioma)}/MWh em ${fracPct(a.horas_acima_1 / a.horas, 1, idioma)}`, ` and by more than ${reais(1, 2, idioma)}/MWh in ${fracPct(a.horas_acima_1 / a.horas, 1, idioma)}`, idioma)
      : "";
  const media =
    a.media === null
      ? ""
      : tx(`; em média ${reais(a.media, 2, idioma)}/MWh entre o maior e o menor, contando todas as horas`, `; on average ${reais(a.media, 2, idioma)}/MWh between the highest and the lowest, counting all hours`, idioma);
  return tx(
    `${quando}, os preços dos quatro submercados diferiram em mais de um centavo em ${fracPct(a.frac_com_separacao, 1, idioma)} das horas${acima1}${media}. A contagem não diz o motivo.`,
    `${quando}, the prices of the four submarkets differed by more than one cent in ${fracPct(a.frac_com_separacao, 1, idioma)} of hours${acima1}${media}. The count does not say why.`,
    idioma,
  );
}

export function linhasSeparacao(r: BlocoRegional, periodo: string, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return PARES.map((par) => {
    const s = r.separacao.find((x) => x.periodo === periodo && x.par === par);
    return {
      id: par,
      par: nomePar(par, idioma),
      horas: s?.horas ?? null,
      separadas: s?.horas_separadas ?? null,
      frac: emPct(s?.frac_separadas),
      um_centavo: s?.horas_diferenca_de_um_centavo ?? null,
      acima_1: s?.horas_acima_1 ?? null,
      acima_10: s?.horas_acima_10 ?? null,
      dif_media: s?.dif_media ?? null,
      dif_abs_media: s?.dif_abs_media ?? null,
      dif_abs_p95: s?.dif_abs_p95 ?? null,
      dif_max: s?.dif_max ?? null,
      quando: s?.quando_max ?? null,
    };
  });
}

export function colunasSeparacao(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "par", rotulo: tx("Par (A e B)", "Pair (A and B)", idioma), tipo: "texto" },
    { id: "frac", rotulo: tx("Horas separadas", "Hours diverged", idioma), tipo: "percentual", casas: 2 },
    { id: "separadas", rotulo: tx("Horas separadas (nº)", "Hours diverged (no.)", idioma), tipo: "numero", casas: 0 },
    { id: "horas", rotulo: tx("Horas com os dois preços", "Hours with both prices", idioma), tipo: "numero", casas: 0 },
    { id: "um_centavo", rotulo: tx("Horas com diferença de um centavo", "Hours with a one-cent difference", idioma), tipo: "numero", casas: 0 },
    { id: "acima_1", rotulo: tx("Horas acima de R$ 1,00/MWh", "Hours above R$ 1.00/MWh", idioma), tipo: "numero", casas: 0 },
    { id: "acima_10", rotulo: tx("Horas acima de R$ 10,00/MWh", "Hours above R$ 10.00/MWh", idioma), tipo: "numero", casas: 0 },
    { id: "dif_media", rotulo: tx("PLD A − PLD B, média", "PLD A − PLD B, average", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "dif_abs_media", rotulo: tx("|PLD A − PLD B|, média", "|PLD A − PLD B|, average", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "dif_abs_p95", rotulo: tx("|PLD A − PLD B|, percentil 95", "|PLD A − PLD B|, percentile 95", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "dif_max", rotulo: tx("Maior diferença (com sinal)", "Largest difference (signed)", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "quando", rotulo: tx("Hora da maior diferença", "Hour of the largest difference", idioma), tipo: "texto" }, // i18n: dado
  ];
}
export const COLUNAS_SEPARACAO: ColunaTabela[] = colunasSeparacao("pt");

export function linhasAmplitude(r: BlocoRegional, quatroNoPiso?: Record<string, QuatroNoPiso>, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return r.amplitude.map((a) => ({
    id: a.periodo,
    periodo: rotuloPeriodoRegional(a.rotulo, idioma),
    horas: a.horas,
    separacao: emPct(a.frac_com_separacao),
    horas_sep: a.horas_com_separacao,
    acima_1: a.horas_acima_1,
    acima_10: a.horas_acima_10,
    media: a.media,
    p50: a.p50,
    p95: a.p95,
    max: a.max,
    quando: a.quando_max,
    quatro_piso: quatroNoPiso?.[a.periodo]?.horas ?? null,
  }));
}

export function colunasAmplitude(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "periodo", rotulo: tx("Período", "Period", idioma), tipo: "texto" },
    { id: "horas", rotulo: tx("Horas com os quatro", "Hours with all four", idioma), tipo: "numero", casas: 0 },
    { id: "separacao", rotulo: tx("Horas com separação", "Hours with divergence", idioma), tipo: "percentual", casas: 2 },
    { id: "horas_sep", rotulo: tx("Horas com separação (nº)", "Hours with divergence (no.)", idioma), tipo: "numero", casas: 0 },
    { id: "acima_1", rotulo: tx("Horas acima de R$ 1,00/MWh", "Hours above R$ 1.00/MWh", idioma), tipo: "numero", casas: 0 },
    { id: "acima_10", rotulo: tx("Horas acima de R$ 10,00/MWh", "Hours above R$ 10.00/MWh", idioma), tipo: "numero", casas: 0 },
    { id: "media", rotulo: tx("Amplitude média", "Average spread", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p50", rotulo: tx("Amplitude mediana", "Median spread", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p95", rotulo: tx("Amplitude, percentil 95", "Spread, percentile 95", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "max", rotulo: tx("Amplitude máxima", "Maximum spread", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "quando", rotulo: tx("Hora da máxima", "Hour of the maximum", idioma), tipo: "texto" }, // i18n: dado
    { id: "quatro_piso", rotulo: tx("Horas com os quatro no piso (só anos)", "Hours with all four at the floor (years only)", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_AMPLITUDE: ColunaTabela[] = colunasAmplitude("pt");

export type MedidaMatriz = "dif_media" | "frac_separadas";

type MatrizRegional = BlocoRegional["matriz"];

function montarMatriz(m: MatrizRegional, medida: MedidaMatriz, idioma: Idioma): { eixo: { id: string; rotulo: string; curto: string }[]; valores: ValorCelula[][] } {
  const eixo = m.ordem.map((sm) => ({ id: sm, rotulo: nomeSm(sm, idioma), curto: curtoSm(sm, idioma) }));
  const fonte = medida === "dif_media" ? m.dif_media : m.frac_separadas;
  const valores = fonte.map((linha, i) => linha.map((v, j) => (i === j ? NAO_SE_APLICA : medida === "frac_separadas" ? emPct(v) : typeof v === "number" ? v : null)));
  return { eixo, valores };
}

/** Matriz de diferenças 4 × 4 (últimos 12 meses): diagonal "não se aplica"; fração em %. */
export function matrizRegional(r: BlocoRegional, medida: MedidaMatriz, idioma: Idioma = idiomaEnergia()): { eixo: { id: string; rotulo: string; curto: string }[]; valores: ValorCelula[][] } {
  return montarMatriz(r.matriz, medida, idioma);
}

/**
 * A mesma matriz para qualquer período que a gold publica por par (`separacao`): cada célula é a média da diferença e a fração de horas
 * separadas do par naquele período, e a célula simétrica leva a média com o sinal trocado. Nada é recalculado, só reorganizado: para os
 * últimos 12 meses o resultado é igual à matriz publicada (`matriz`), e o teste confere célula a célula. Par sem linha no período fica
 * sem dado.
 */
export function matrizDoPeriodo(r: BlocoRegional, periodo: string): MatrizRegional {
  const ordem = r.matriz.ordem;
  const vazia = () => ordem.map(() => ordem.map((): number | null => null));
  const dif = vazia();
  const frac = vazia();
  ordem.forEach((a, i) =>
    ordem.forEach((b, j) => {
      if (i >= j) return;
      const s = r.separacao.find((x) => x.periodo === periodo && x.par === `${a}_${b}`);
      if (!s) return;
      dif[i][j] = s.dif_media;
      dif[j][i] = s.dif_media === null ? null : s.dif_media === 0 ? 0 : -s.dif_media;
      frac[i][j] = s.frac_separadas;
      frac[j][i] = s.frac_separadas;
    }),
  );
  return { periodo, ordem, dif_media: dif, frac_separadas: frac };
}

export function matrizRegionalDoPeriodo(r: BlocoRegional, medida: MedidaMatriz, periodo: string, idioma: Idioma = idiomaEnergia()): { eixo: { id: string; rotulo: string; curto: string }[]; valores: ValorCelula[][] } {
  return montarMatriz(matrizDoPeriodo(r, periodo), medida, idioma);
}

/**
 * Maior e menor valor da matriz em palavras, para o leitor que não tem o número em cada célula. Na fração de horas separadas, os pares
 * são simétricos (conta cada par uma vez); na diferença média, o maior valor tem o sinal da célula ("a linha mais cara que a coluna") e o
 * menor é o de menor valor absoluto. Lê as mesmas células que o mapa (matrizRegional).
 */
export function extremosMatriz(m: { eixo: { id: string; rotulo: string; curto: string }[]; valores: ValorCelula[][] }, medida: MedidaMatriz, idioma: Idioma = idiomaEnergia()): string | null {
  const itens: { i: number; j: number; v: number }[] = [];
  m.valores.forEach((linha, i) =>
    linha.forEach((v, j) => {
      if (typeof v === "number" && Number.isFinite(v) && (medida === "frac_separadas" ? i < j : true)) itens.push({ i, j, v });
    }),
  );
  if (!itens.length) return null;
  const par = (i: number, j: number) => `${m.eixo[i].curto}${tx(" e ", " and ", idioma)}${m.eixo[j].curto}`;
  if (medida === "frac_separadas") {
    const maior = itens.reduce((a, b) => (b.v > a.v ? b : a));
    const menor = itens.reduce((a, b) => (b.v < a.v ? b : a));
    return tx(
      `Maior valor: ${par(maior.i, maior.j)}, ${num(maior.v, 1)}% das horas. Menor valor: ${par(menor.i, menor.j)}, ${num(menor.v, 1)}% das horas.`,
      `Highest value: ${par(maior.i, maior.j)}, ${num(maior.v, 1, idioma)}% of hours. Lowest value: ${par(menor.i, menor.j)}, ${num(menor.v, 1, idioma)}% of hours.`,
      idioma,
    );
  }
  const maior = itens.reduce((a, b) => (b.v > a.v ? b : a));
  const menor = itens.filter((x) => x.i < x.j).reduce((a, b) => (Math.abs(b.v) < Math.abs(a.v) ? b : a));
  return tx(
    `Maior diferença: ${m.eixo[maior.i].curto} acima de ${m.eixo[maior.j].curto} em ${reais(maior.v)}/MWh. Menor diferença: ${par(menor.i, menor.j)}, ${reais(Math.abs(menor.v))}/MWh.`,
    `Largest difference: ${m.eixo[maior.i].curto} above ${m.eixo[maior.j].curto} by ${reais(maior.v, 2, idioma)}/MWh. Smallest difference: ${par(menor.i, menor.j)}, ${reais(Math.abs(menor.v), 2, idioma)}/MWh.`,
    idioma,
  );
}

function linhasDaMatriz(m: MatrizRegional, idioma: Idioma): LinhaTabela[] {
  const linhas: LinhaTabela[] = [];
  m.ordem.forEach((a, i) =>
    m.ordem.forEach((b, j) => {
      if (i === j) return;
      linhas.push({ id: `${a}_${b}`, a: nomeSm(a, idioma), b: nomeSm(b, idioma), dif_media: m.dif_media[i][j], frac: emPct(m.frac_separadas[i][j]) });
    }),
  );
  return linhas;
}

/** Linhas da tabela equivalente da matriz (pares ordenados A, B), com os mesmos valores das células. */
export function linhasMatriz(r: BlocoRegional, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return linhasDaMatriz(r.matriz, idioma);
}

/** As mesmas linhas para o período escolhido (ver matrizDoPeriodo). */
export function linhasMatrizDoPeriodo(r: BlocoRegional, periodo: string, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return linhasDaMatriz(matrizDoPeriodo(r, periodo), idioma);
}

export function colunasMatriz(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "a", rotulo: tx("Submercado A (linha)", "Submarket A (row)", idioma), tipo: "texto", categorica: true },
    { id: "b", rotulo: tx("Submercado B (coluna)", "Submarket B (column)", idioma), tipo: "texto", categorica: true },
    { id: "dif_media", rotulo: tx("PLD A − PLD B, média", "PLD A − PLD B, average", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "frac", rotulo: tx("Horas separadas", "Hours diverged", idioma), tipo: "percentual", casas: 2 },
  ];
}
export const COLUNAS_MATRIZ: ColunaTabela[] = colunasMatriz("pt");

/** Escala divergente da diferença média entre pares (R$/MWh), centrada em zero. */
export const ESCALA_DIFERENCA: EscalaCores = {
  tipo: "divergente",
  limites: [-25, -5, 5, 25],
  centro: 0,
  cores: ["var(--escala-div-neg-2)", "var(--escala-div-neg-1)", "var(--escala-div-centro)", "var(--escala-div-pos-1)", "var(--escala-div-pos-2)"],
};

/** Escala da fração de horas separadas (%). */
export const ESCALA_FRACAO: EscalaCores = {
  tipo: "sequencial",
  limites: [10, 20, 30, 40],
  cores: ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"],
};

/** Fração das horas separadas por hora do dia e par, nos últimos 12 meses (em %), para os pequenos múltiplos. */
export function serieSeparacaoHoraria(r: BlocoRegional): Record<string, string | number | null>[] {
  return HORAS_DO_DIA.map((h, i) => {
    const linha: Record<string, string | number | null> = { h: h.id };
    for (const par of PARES) linha[par] = emPct(r.perfil_horario_separacao_12m[par]?.[i]);
    return linha;
  });
}

export function linhasFluxos(r: BlocoRegional, periodo: string, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return FRONTEIRAS.map((f) => {
    const x = r.fluxos.find((y) => y.periodo === periodo && y.fronteira === f);
    return {
      id: f,
      fronteira: nomeFronteira(f, idioma),
      horas_com_fluxo: x?.horas_com_fluxo ?? null,
      separadas: x?.horas_separadas ?? null,
      menor_maior: x?.do_menor_para_o_maior ?? null,
      maior_menor: x?.do_maior_para_o_menor ?? null,
      nulo: x?.fluxo_nulo ?? null,
      frac: emPct(x?.frac_do_menor_para_o_maior),
      medio_sep: x?.fluxo_medio_separadas ?? null,
      medio_nao: x?.fluxo_medio_nao_separadas ?? null,
    };
  });
}

export function colunasFluxos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "fronteira", rotulo: tx("Fronteira (positivo da primeira para a segunda)", "Boundary (positive from the first to the second)", idioma), tipo: "texto" },
    { id: "separadas", rotulo: tx("Horas separadas com fluxo", "Hours diverged with flow", idioma), tipo: "numero", casas: 0 },
    { id: "menor_maior", rotulo: tx("Do menor para o maior preço", "From the lower to the higher price", idioma), tipo: "numero", casas: 0 },
    { id: "maior_menor", rotulo: tx("Do maior para o menor preço", "From the higher to the lower price", idioma), tipo: "numero", casas: 0 },
    { id: "nulo", rotulo: tx("Fluxo nulo (até 1 MWmed)", "Zero flow (up to 1 MWavg)", idioma), tipo: "numero", casas: 0 },
    { id: "frac", rotulo: tx("Do menor para o maior", "From the lower to the higher", idioma), tipo: "percentual", casas: 1 },
    { id: "medio_sep", rotulo: tx("Fluxo médio nas horas separadas", "Average flow in hours diverged", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "medio_nao", rotulo: tx("Fluxo médio nas horas não separadas", "Average flow in hours not diverged", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "horas_com_fluxo", rotulo: tx("Horas com fluxo publicado", "Hours with published flow", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_FLUXOS: ColunaTabela[] = colunasFluxos("pt");

/** Linhas horárias da janela recente: PLD dos quatro, amplitude e fluxo das quatro fronteiras na mesma hora. */
export function linhasJanelaHoraria(rec: PldHorarioRecenteArquivo): LinhaTabela[] {
  return rec.t.map((t, i) => ({
    id: t,
    t,
    SE: rec.pld.SE[i] ?? null,
    S: rec.pld.S[i] ?? null,
    NE: rec.pld.NE[i] ?? null,
    N: rec.pld.N[i] ?? null,
    amplitude: rec.amplitude[i] ?? null,
    N_NE: rec.fluxo.N_NE[i] ?? null,
    N_SE: rec.fluxo.N_SE[i] ?? null,
    NE_SE: rec.fluxo.NE_SE[i] ?? null,
    S_SE: rec.fluxo.S_SE[i] ?? null,
  }));
}

export function colunasJanelaHoraria(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "t", rotulo: tx("Hora (início, Brasília)", "Hour (start, Brasília time)", idioma), tipo: "texto" },
    ...SUBMERCADOS.map((sm): ColunaTabela => ({ id: sm, rotulo: `PLD ${curtoSm(sm, idioma)}`, tipo: "numero", unidade: "R$/MWh", casas: 2 })),
    { id: "amplitude", rotulo: tx("Maior menos menor PLD", "Highest minus lowest PLD", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    ...FRONTEIRAS.map(
      (f): ColunaTabela => ({
        id: f,
        rotulo: tx(`Fluxo ${CURTO_SM[pontasFronteira(f).de]} para ${CURTO_SM[pontasFronteira(f).para]}`, `Flow ${curtoSm(pontasFronteira(f).de, "en")} to ${curtoSm(pontasFronteira(f).para, "en")}`, idioma),
        tipo: "numero",
        unidade: tx("MWmed", "MWavg", idioma),
        casas: 1,
      }),
    ),
  ];
}
export const COLUNAS_JANELA_HORARIA: ColunaTabela[] = colunasJanelaHoraria("pt");

/** Estado de uma hora da janela: preços e fluxos da MESMA hora, para o esquema e a tabela. */
export function estadoHora(rec: PldHorarioRecenteArquivo, t: string) {
  const i = rec.t.indexOf(t);
  if (i < 0) return null;
  return {
    t,
    precos: Object.fromEntries(SUBMERCADOS.map((sm) => [sm, rec.pld[sm][i] ?? null])) as Record<Submercado, number | null>,
    fluxos: FRONTEIRAS.map((f) => ({ ...pontasFronteira(f), fluxo: rec.fluxo[f][i] ?? null })),
    amplitude: rec.amplitude[i] ?? null,
  };
}

/** Hora padrão do esquema: a de maior amplitude entre as horas com fluxo publicado (empate: a mais recente). */
export function horaPadrao(rec: PldHorarioRecenteArquivo): string {
  let melhor = -1;
  for (let i = 0; i < rec.t.length; i++) {
    const a = rec.amplitude[i];
    const comFluxo = FRONTEIRAS.every((f) => typeof rec.fluxo[f][i] === "number");
    if (typeof a !== "number" || !comFluxo) continue;
    if (melhor < 0 || a >= (rec.amplitude[melhor] ?? -Infinity)) melhor = i;
  }
  return melhor >= 0 ? rec.t[melhor] : (rec.t[rec.t.length - 1] ?? "");
}

export function textoHora(t: string, idioma: Idioma = idiomaEnergia()): string {
  return tx(`${dataBR(t)} às ${t.slice(11, 13)}h`, `${dataBR(t, idioma)} at ${t.slice(11, 13)}h`, idioma);
}

/** Leitura da hora escolhida no esquema: preços e sentido do fluxo, sem afirmar congestionamento. */
export function respostaHora(e: NonNullable<ReturnType<typeof estadoHora>>, idioma: Idioma = idiomaEnergia()): string {
  const precos = SUBMERCADOS.map((sm) => `${curtoSm(sm, idioma)} ${reais(e.precos[sm], 2, idioma)}`).join("; ");
  const fl = e.fluxos.map((f) => {
    if (f.fluxo === null) return tx(`${CURTO_SM[f.de]} e ${CURTO_SM[f.para]}: fluxo sem dado`, `${curtoSm(f.de, idioma)} and ${curtoSm(f.para, idioma)}: no flow data`, idioma);
    const [o, d] = f.fluxo >= 0 ? [f.de, f.para] : [f.para, f.de];
    return tx(`${CURTO_SM[o]} para ${CURTO_SM[d]} ${num(Math.abs(f.fluxo), 0)} MWmed`, `${curtoSm(o, idioma)} to ${curtoSm(d, idioma)} ${num(Math.abs(f.fluxo), 0, idioma)} MWavg`, idioma);
  });
  return tx(
    `${textoHora(e.t, idioma)}: PLD ${precos} (R$/MWh); diferença entre o maior e o menor de ${reais(e.amplitude)}/MWh. Fluxo verificado na mesma hora: ${listaTexto(fl, idioma)}.`,
    `${textoHora(e.t, idioma)}: PLD ${precos} (R$/MWh); difference between the highest and the lowest of ${reais(e.amplitude, 2, idioma)}/MWh. Verified flow in the same hour: ${listaTexto(fl, idioma)}.`,
    idioma,
  );
}

/* ====================================================================== */
/* Atualidade                                                             */
/* ====================================================================== */

/** Dias corridos entre o dia de referência e o dia (em Brasília, UTC−3) em que a gold foi processada. */
export function diasDeDefasagem(diaReferencia: string, geradoEm: string): number | null {
  const g = new Date(geradoEm);
  if (Number.isNaN(g.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(diaReferencia)) return null;
  const local = new Date(g.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const [a1, m1, d1] = diaReferencia.split("-").map(Number);
  const [a2, m2, d2] = local.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/**
 * O PLD de um dia é calculado na véspera; com a publicação em dia, o último dia
 * com PLD é o próprio dia do processamento ou o anterior. Mais de dois dias de
 * distância é fonte defasada (ou captura falhando), e a página diz isso em vez de
 * apresentar o último dia como atual.
 */
export function atualidadePld(diaReferencia: string, geradoEm: string, idioma: Idioma = idiomaEnergia()): { defasada: boolean; dias: number | null; texto: string } {
  const dias = diasDeDefasagem(diaReferencia, geradoEm);
  if (dias === null) return { defasada: true, dias, texto: tx("Data de referência ou de processamento ilegível nesta publicação.", "Reference or processing date unreadable in this publication.", idioma) };
  if (dias > 2)
    return {
      defasada: true,
      dias,
      texto: tx(
        `Fonte defasada: o último dia com PLD é ${dataBR(diaReferencia)}, ${plural(dias, "dia", "dias")} antes do processamento desta publicação. Os números abaixo valem até esse dia; a CCEE não publicou dias seguintes ou a captura falhou.`,
        `Outdated source: the last day with a PLD is ${dataBR(diaReferencia, idioma)}, ${plural(dias, "day", "days", idioma)} before this publication was processed. The numbers below are valid up to that day; CCEE did not publish the following days or the capture failed.`,
        idioma,
      ),
    };
  return { defasada: false, dias, texto: tx(`Último dia com PLD publicado: ${dataBR(diaReferencia)}.`, `Last day with a published PLD: ${dataBR(diaReferencia, idioma)}.`, idioma) };
}

/**
 * Regra de comparabilidade da ponderada pelo balanço, escrita a partir dos
 * perímetros publicados (sem os nomes de campo da gold): cada perímetro com os
 * meses que cobre e a indicação da série que atravessa as mudanças.
 */
export function textoComparabilidade(h: BlocoHistorico, idioma: Idioma = idiomaEnergia()): string {
  const per = h.ponderacao.perimetros
    .filter((p) => p.primeiro_mes && p.ultimo_mes)
    .map((p) =>
      tx(
        `${p.id} de ${mesAno(p.primeiro_mes!)} a ${mesAno(p.ultimo_mes!)}${p.inclui_mmgd ? " (com MMGD estimada)" : ""}`,
        `${p.id} from ${mesAno(p.primeiro_mes!, idioma)} to ${mesAno(p.ultimo_mes!, idioma)}${p.inclui_mmgd ? " (with estimated MMGD)" : ""}`,
        idioma,
      ),
    );
  const meio = h.mensal.meses.filter((_, i) => h.mensal.perimetro_carga[i].includes("_")).map((x) => mesAno(x, idioma));
  const partes = [tx(`A média ponderada pela carga do balanço só se compara entre meses do mesmo perímetro: ${listaTexto(per)}.`, `The average weighted by balance load can only be compared between months with the same perimeter: ${listaTexto(per, idioma)}.`, idioma)];
  if (meio.length) partes.push(tx(`${listaTexto(meio)} ${meio.length === 1 ? "tem" : "têm"} a mudança declarada dentro do mês.`, `${listaTexto(meio, idioma)} ${meio.length === 1 ? "has" : "have"} the change declared within the month.`, idioma));
  partes.push(
    h.ponderacao.peso_sem_mmgd.disponivel
      ? tx("Para comparar meses de perímetros diferentes, use a média ponderada pela carga sem MMGD, de perímetro homogêneo.", "To compare months with different perimeters, use the average weighted by load without MMGD, which has a uniform perimeter.", idioma)
      : tx("A média ponderada sem MMGD, de perímetro homogêneo, não está nesta publicação; meses de perímetros diferentes não se comparam pela ponderada.", "The average weighted without MMGD, with a uniform perimeter, is not in this publication; months with different perimeters cannot be compared using the weighted average.", idioma),
  );
  return partes.join(" ");
}

/* ====================================================================== */
/* Abertura da página PLD: média diária, extremos e distância             */
/* ====================================================================== */

/**
 * Média diária de cada submercado no dia de referência. Uma só lista (a mesma que a gold publica nos cartões do dia e que o mapa dos
 * submercados usa) alimenta a faixa de métricas, a frase de resposta, o gráfico de barras e a tabela da abertura: a faixa nunca calcula
 * por conta própria. A regra da média diária é a que a própria gold publica (média aritmética simples das 24 horas do dia, no horário
 * de Brasília). Não existe PLD único do Brasil: nenhuma média dos quatro submercados é calculada aqui, nem pode ser apresentada como preço.
 */
export type CartaoMediaDiaria = Pick<PldCartao, "sm" | "media_dia" | "variacao_dia_anterior">;

export type MediaDiariaSm = {
  id: Submercado;
  nome: string;
  rotulo: string;
  media: number;
  /** Diferença contra a média do dia anterior no mesmo submercado, como a gold a publica. */
  variacao: { abs: number; pct: number | null } | null;
};

/** Um submercado por linha, sempre na ordem regional (SE/CO, Sul, Nordeste, Norte); submercado sem média completa não entra. */
export function linhasMediaDiaria(cartoes: readonly CartaoMediaDiaria[], idioma: Idioma = idiomaEnergia()): MediaDiariaSm[] {
  return SUBMERCADOS.flatMap((sm) => {
    const c = cartoes.find((x) => x.sm === sm);
    if (!c || typeof c.media_dia !== "number" || !Number.isFinite(c.media_dia)) return [];
    return [{ id: sm, nome: nomeSm(sm, idioma), rotulo: curtoSm(sm, idioma), media: c.media_dia, variacao: c.variacao_dia_anterior ?? null }];
  });
}

/** Menor ou maior média do dia: o valor e todos os submercados que o têm (empate é igualdade nos centavos, a precisão exibida). */
export type ExtremoMediaDiaria = { valor: number; submercados: Submercado[] };
export type ExtremosMediaDiaria = { menor: ExtremoMediaDiaria; maior: ExtremoMediaDiaria; distancia: number };

const emCentavos = (v: number) => Math.round(v * 100);

/**
 * Menor e maior média diária entre os submercados e a distância entre elas (maior menos menor). Os empates são preservados: se dois
 * submercados têm a maior média, os dois aparecem. A distância sai dos valores em centavos que o leitor vê, para que a subtração feita
 * à mão dê o mesmo número; a gold publica a mesma conta em `amplitude_dia`, e o teste confere as duas.
 */
export function extremosMediaDiaria(linhas: readonly MediaDiariaSm[]): ExtremosMediaDiaria | null {
  if (linhas.length < 2) return null;
  const cent = linhas.map((l) => emCentavos(l.media));
  const menorC = Math.min(...cent);
  const maiorC = Math.max(...cent);
  const com = (alvo: number): ExtremoMediaDiaria => {
    const ls = linhas.filter((l) => emCentavos(l.media) === alvo);
    return { valor: ls[0].media, submercados: ls.map((l) => l.id) };
  };
  return { menor: com(menorC), maior: com(maiorC), distancia: (maiorC - menorC) / 100 };
}

/** "SE/CO e Norte"; com os quatro, "os quatro submercados". */
export function nomesDosSubmercados(ids: readonly Submercado[], idioma: Idioma = idiomaEnergia()): string {
  if (ids.length === SUBMERCADOS.length) return tx("os quatro submercados", "all four submarkets", idioma);
  return listaTexto(ids.map((s) => curtoSm(s, idioma)), idioma);
}

/** Veredito da abertura: os dois extremos da média diária com quem os tem (empate dito) e a distância entre eles. */
export function vereditoMediaDiaria(dia: string, e: ExtremosMediaDiaria, idioma: Idioma = idiomaEnergia()): string {
  const R = (v: number) => reais(v, 2, idioma);
  if (e.distancia === 0)
    return tx(
      `Em ${dataBR(dia)}, a média diária foi igual nos quatro submercados, ${reais(e.menor.valor)}/MWh; a distância entre o maior e o menor foi de ${reais(0)}/MWh.`,
      `On ${dataBR(dia, idioma)}, the daily average was the same in all four submarkets, ${R(e.menor.valor)}/MWh; the distance between the highest and the lowest was ${R(0)}/MWh.`,
      idioma,
    );
  const quem = (x: ExtremoMediaDiaria) => `${nomesDosSubmercados(x.submercados, idioma)}${x.submercados.length > 1 ? tx(", mesmo valor", ", same value", idioma) : ""}`;
  return tx(
    `Em ${dataBR(dia)}, a média diária foi de ${reais(e.menor.valor)}/MWh (${quem(e.menor)}) a ${reais(e.maior.valor)}/MWh (${quem(e.maior)}); a distância entre o maior e o menor foi de ${reais(e.distancia)}/MWh.`,
    `On ${dataBR(dia, idioma)}, the daily average ranged from ${R(e.menor.valor)}/MWh (${quem(e.menor)}) to ${R(e.maior.valor)}/MWh (${quem(e.maior)}); the distance between the highest and the lowest was ${R(e.distancia)}/MWh.`,
    idioma,
  );
}

/**
 * Os empates da média diária ditos por extenso, para ficarem à vista junto das barras: quando dois ou mais submercados têm a maior (ou a
 * menor) média nos centavos, a página escreve quais são. Sem empate, ou com a distância zero (todos iguais), devolve null.
 */
export function textoEmpatesMediaDiaria(e: ExtremosMediaDiaria, idioma: Idioma = idiomaEnergia()): string | null {
  if (e.distancia === 0) return null;
  const partes: string[] = [];
  if (e.maior.submercados.length > 1) partes.push(tx(`Empate na maior média: ${nomesDosSubmercados(e.maior.submercados)}, ${reais(e.maior.valor)}/MWh.`, `Tie for the highest average: ${nomesDosSubmercados(e.maior.submercados, idioma)}, ${reais(e.maior.valor, 2, idioma)}/MWh.`, idioma));
  if (e.menor.submercados.length > 1) partes.push(tx(`Empate na menor média: ${nomesDosSubmercados(e.menor.submercados)}, ${reais(e.menor.valor)}/MWh.`, `Tie for the lowest average: ${nomesDosSubmercados(e.menor.submercados, idioma)}, ${reais(e.menor.valor, 2, idioma)}/MWh.`, idioma));
  return partes.length ? partes.join(" ") : null;
}

/** Dia civil anterior a uma data AAAA-MM-DD, sem depender de fuso. */
export function diaAnterior(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** "O que mudou" da abertura: a média de cada submercado contra a do dia anterior, em R$/MWh e em %, com o sentido em palavras. */
export function textoMudancaMediaDiaria(dia: string, linhas: readonly MediaDiariaSm[], idioma: Idioma = idiomaEnergia()): string {
  const itens = linhas
    .filter((l) => l.variacao !== null)
    .map((l) => {
      const v = l.variacao!;
      if (emCentavos(v.abs) === 0) return tx(`${l.rotulo}: igual`, `${l.rotulo}: unchanged`, idioma);
      return tx(
        `${l.rotulo}: ${reais(Math.abs(v.abs))}/MWh ${v.abs > 0 ? "acima" : "abaixo"}${v.pct === null ? "" : ` (${num(Math.abs(v.pct), 1)}%)`}`,
        `${l.rotulo}: ${reais(Math.abs(v.abs), 2, idioma)}/MWh ${v.abs > 0 ? "higher" : "lower"}${v.pct === null ? "" : ` (${num(Math.abs(v.pct), 1, idioma)}%)`}`,
        idioma,
      );
    });
  if (!itens.length) return tx(`Sem a média do dia anterior para comparar com ${dataBR(dia)}.`, `No average for the previous day to compare with ${dataBR(dia, idioma)}.`, idioma);
  return tx(`Em relação ao dia anterior (${dataBR(diaAnterior(dia))}): ${itens.join("; ")}.`, `Compared with the previous day (${dataBR(diaAnterior(dia), idioma)}): ${itens.join("; ")}.`, idioma);
}

/**
 * Variação comum a um grupo de submercados contra o dia anterior, para a linha de referência de uma medida da faixa. Só devolve valor
 * quando todos os submercados do grupo têm variação e ela é a mesma nos centavos; em empate de média com variações diferentes, devolve
 * null e a página não afirma nenhuma delas (a lista por submercado fica em "O que mudou").
 */
export function variacaoComumDoGrupo(linhas: readonly MediaDiariaSm[], ids: readonly Submercado[]): number | null {
  const vs = ids.map((id) => linhas.find((l) => l.id === id)?.variacao?.abs);
  if (!vs.length || vs.some((v) => v === undefined || v === null || !Number.isFinite(v))) return null;
  const c = vs.map((v) => emCentavos(v as number));
  return c.every((x) => x === c[0]) ? (c[0] / 100) : null;
}

/** Trecho de limites que vale no dia (início e fim inclusive); null quando nenhum trecho integrado cobre o dia. */
export function regimeVigenteEm(regimes: readonly RegimeLimites[], dia: string): RegimeLimites | null {
  const d = dia.slice(0, 10);
  return regimes.find((r) => r.inicio <= d && d <= r.fim) ?? null;
}

/**
 * Os três limites do trecho vigente, cada um com o objeto a que se aplica: o piso e o teto horário valem para cada hora; o teto
 * estrutural, para a média diária. Valor que o ato integrado não traz é dito, nunca preenchido.
 */
export function textoLimitesVigentes(r: RegimeLimites, idioma: Idioma = idiomaEnergia()): string {
  const v = (x: number | null) => (x === null ? tx("sem valor integrado", "no value integrated", idioma) : `${reais(x, 2, idioma)}/MWh`);
  const ni = tx("ato não identificado", "act not identified", idioma);
  const atos = [r.ato_pld_min, r.ato_pld_max_horario, r.ato_pld_max_estrutural];
  const iguais = atos.every((a) => a === atos[0]);
  const origem = iguais
    ? ` (${atos[0] ?? ni})`
    : tx(
        `; piso: ${r.ato_pld_min ?? ni}; teto horário: ${r.ato_pld_max_horario ?? ni}; teto estrutural: ${r.ato_pld_max_estrutural ?? ni}`,
        `; floor: ${r.ato_pld_min ?? ni}; hourly cap: ${r.ato_pld_max_horario ?? ni}; structural cap: ${r.ato_pld_max_estrutural ?? ni}`,
        idioma,
      );
  return tx(
    `Limites vigentes desde ${dataBR(r.inicio)}${origem}: piso de ${v(r.pld_min)} e teto horário de ${v(r.pld_max_horario)}, que valem para cada hora, e teto estrutural de ${v(r.pld_max_estrutural)}, que vale para a média diária.`,
    `Limits in force since ${dataBR(r.inicio, idioma)}${origem}: a floor of ${v(r.pld_min)} and an hourly cap of ${v(r.pld_max_horario)}, which apply to each hour, and a structural cap of ${v(r.pld_max_estrutural)}, which applies to the daily average.`,
    idioma,
  );
}

/**
 * Referência da distância entre regiões: a média dos 30 dias até o dia de referência e a maior distância desse período, do resumo que
 * a gold de rede publica. Só vale quando o resumo é do mesmo dia; com outro dia, devolve null e a faixa fica sem a linha.
 */
export function textoReferenciaDistancia(
  resumo: { dia: string; media_30d: number | null; maior_30d: { dia: string; valor: number } } | null | undefined,
  dia: string,
  idioma: Idioma = idiomaEnergia(),
): string | null {
  if (!resumo || resumo.dia !== dia || resumo.media_30d === null) return null;
  return tx(
    `Média dos 30 dias até ${dataBR(resumo.dia)}: ${reais(resumo.media_30d)}/MWh; maior distância do período: ${reais(resumo.maior_30d.valor)}/MWh em ${dataBR(resumo.maior_30d.dia)}.`,
    `Average for the 30 days to ${dataBR(resumo.dia, idioma)}: ${reais(resumo.media_30d, 2, idioma)}/MWh; largest distance in the period: ${reais(resumo.maior_30d.valor, 2, idioma)}/MWh on ${dataBR(resumo.maior_30d.dia, idioma)}.`,
    idioma,
  );
}

/* ====================================================================== */
/* Pontes entre critérios, recortes e ressalvas                            */
/* ====================================================================== */

/**
 * Exceções declaradas à regra de que nenhum número é recalculado aqui. Cada uma é uma conta de uma linha sobre números já publicados,
 * com a regra escrita na página e conferida em teste: a distância entre as médias diárias (maior menos menor), a média simples das
 * horas de uma faixa na grade estreita dos mapas de calor, a média nas horas separadas (com limites de erro, só exibida quando o
 * arredondamento não muda) e a inflação acumulada entre o primeiro e o último mês da série em moeda constante (razão entre as duas
 * séries mensais publicadas). Fora delas, vale o que o cabeçalho diz.
 */

/** Limiar de "separação" nas diferenças regionais: |PLD A − PLD B| > R$ 0,01/MWh (regra da gold regional). */
export const LIMIAR_SEPARACAO = 0.01;

export type PonteSeparacao = { horas: number; horas_separadas: number; frac: number | null };

/** Contagem de separação (R$ 0,01/MWh) por período da gold regional, para ligar os dois critérios na página PLD. */
export function pontesSeparacao(r: BlocoRegional): Record<string, PonteSeparacao> {
  return Object.fromEntries(r.amplitude.map((a) => [a.periodo, { horas: a.horas, horas_separadas: a.horas_com_separacao, frac: a.frac_com_separacao }]));
}

/**
 * O critério do cartão "Há diferença entre submercados?" e, ao lado, o das diferenças regionais para o mesmo período. As duas páginas
 * contam coisas diferentes (acima de R$ 1,00/MWh aqui, acima de R$ 0,01/MWh lá); quando a gold regional tem o mesmo período, a frase dá
 * a contagem do segundo critério.
 */
export function textoPonteLimiar(limiar: number, ponte: PonteSeparacao | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  const base = tx(
    `Aqui conta só a hora em que o maior e o menor preço diferem em mais de ${reais(limiar)}/MWh. A página Diferenças regionais conta toda hora com diferença acima de ${reais(LIMIAR_SEPARACAO)}/MWh`,
    `Here, only hours in which the highest and lowest prices differ by more than ${reais(limiar, 2, idioma)}/MWh count. The Regional differences page counts every hour with a difference above ${reais(LIMIAR_SEPARACAO, 2, idioma)}/MWh`,
    idioma,
  );
  if (!ponte || ponte.frac === null) return `${base}.`;
  return tx(
    `${base}: neste período, ${plural(ponte.horas_separadas, "hora", "horas")} de ${num(ponte.horas, 0)} (${fracPct(ponte.frac, 1)}).`,
    `${base}: in this period, ${plural(ponte.horas_separadas, "hour", "hours", idioma)} of ${num(ponte.horas, 0, idioma)} (${fracPct(ponte.frac, 1, idioma)}).`,
    idioma,
  );
}

/**
 * Média da diferença entre o maior e o menor preço nas horas separadas, em reais inteiros. A gold publica a média sobre todas as horas
 * do período (duas casas) e o número de horas separadas; cada hora sem separação soma no máximo R$ 0,01. Com essas duas margens (o
 * arredondamento da média e as horas sem separação), o valor só é devolvido quando o limite de baixo e o de cima dão o mesmo inteiro.
 */
export function mediaNasHorasSeparadas(a: Pick<AmplitudePeriodo, "horas" | "horas_com_separacao" | "media">): number | null {
  const sep = a.horas_com_separacao;
  if (a.media === null || a.horas <= 0 || sep <= 0 || sep > a.horas) return null;
  const soma = a.media * a.horas;
  const folga = 0.005 * a.horas;
  const maximo = (soma + folga) / sep;
  const minimo = (soma - folga - LIMIAR_SEPARACAO * (a.horas - sep)) / sep;
  const inteiro = Math.round(maximo);
  return Math.round(Math.max(0, minimo)) === inteiro ? inteiro : null;
}

/**
 * O que a média da diferença entre o maior e o menor preço cobre: todas as horas do período, as separadas e as que não se separaram.
 * Dá a mediana de todas as horas (da gold) e, quando o arredondamento permite, a média nas horas separadas.
 */
export function textoMediaDaAmplitude(a: AmplitudePeriodo, idioma: Idioma = idiomaEnergia()): string | null {
  if (a.media === null) return null;
  const n = (v: number) => num(v, 0, idioma);
  const semSeparacao = a.horas - a.horas_com_separacao;
  let t = tx(
    `Média sobre todas as ${n(a.horas)} horas do período, inclusive as ${n(semSeparacao)} sem separação`,
    `Average over all ${n(a.horas)} hours of the period, including the ${n(semSeparacao)} with no divergence`,
    idioma,
  );
  const m = mediaNasHorasSeparadas(a);
  if (m !== null)
    t += tx(
      `; nas ${n(a.horas_com_separacao)} horas separadas, cerca de ${reais(m, 0, idioma)}/MWh (soma das diferenças dividida pelas horas separadas)`,
      `; in the ${n(a.horas_com_separacao)} hours diverged, about ${reais(m, 0, idioma)}/MWh (sum of the differences divided by the hours diverged)`,
      idioma,
    );
  if (a.p50 !== null) t += tx(`. Mediana de todas as horas: ${reais(a.p50, 2, idioma)}/MWh`, `. Median of all hours: ${reais(a.p50, 2, idioma)}/MWh`, idioma);
  return `${t}.`;
}

/** Horas com os quatro submercados juntos no piso, por ano (a gold de limites só tem anos civis). */
export type QuatroNoPiso = { horas: number; frac: number | null; parcial: boolean };

export function quatroNoPisoPorAno(l: Pick<BlocoLimitesDisponivel, "empates_piso"> | null | undefined): Record<string, QuatroNoPiso> {
  return Object.fromEntries((l?.empates_piso ?? []).map((e) => [String(e.ano), { horas: e.horas_quatro_no_piso, frac: e.frac_quatro_no_piso, parcial: e.parcial }]));
}

/** Frase do ano em que os quatro submercados ficaram juntos no piso: nessas horas o preço é igual por regra, e a separação não mede o custo. */
export function textoQuatroNoPiso(q: QuatroNoPiso | null | undefined, rotuloAno: string, idioma: Idioma = idiomaEnergia()): string | null {
  if (!q || q.horas <= 0) return null;
  return tx(
    `Em ${rotuloAno}, os quatro submercados ficaram juntos no piso em ${plural(q.horas, "hora", "horas")}${q.frac === null ? "" : ` (${fracPct(q.frac, 1)} das horas)`}: nessas horas os preços são iguais por regra, e isso reduz a contagem de horas separadas.`,
    `In ${rotuloPeriodoRegional(rotuloAno, idioma)}, all four submarkets were at the floor together in ${plural(q.horas, "hour", "hours", idioma)}${q.frac === null ? "" : ` (${fracPct(q.frac, 1, idioma)} of hours)`}: in those hours prices are equal by rule, and this reduces the count of hours diverged.`,
    idioma,
  );
}

/* ---------- calendário de limites ---------- */

export type DiaNoLimite = { dia: string; horas: number };

/** Dias da janela com pelo menos uma hora no limite escolhido, com a contagem de horas de cada um (as mesmas do calendário). */
export function diasNoLimite(cal: BlocoLimitesDisponivel["calendario"], sm: Submercado, limite: LimiteHora, ultimosDias?: number): DiaNoLimite[] {
  const ini = ultimosDias ? Math.max(0, cal.dias.length - ultimosDias) : 0;
  const serie = limite === "piso" ? cal[sm].horas_piso : cal[sm].horas_teto_horario;
  return cal.dias.slice(ini).flatMap((dia, k) => {
    const h = serie[ini + k];
    return typeof h === "number" && h > 0 ? [{ dia, horas: h }] : [];
  });
}

/**
 * Os dias no limite ditos por data quando são poucos (até `maximo`): o calendário de uma janela sem eventos ou com poucos fica uma grade
 * uniforme, e a lista por data diz onde estão. Com mais dias que o máximo, devolve null e o calendário fala por si.
 */
export function textoDiasNoLimite(dias: readonly DiaNoLimite[], limite: LimiteHora, janelaDias: number, maximo = 10, idioma: Idioma = idiomaEnergia()): string | null {
  const objeto = limite === "piso" ? tx("no piso", "at the floor", idioma) : tx("no teto horário", "at the hourly cap", idioma);
  if (!dias.length) return tx(`Nenhuma hora ${objeto} nos ${num(janelaDias, 0, idioma)} dias do calendário.`, `No hour ${objeto} in the ${num(janelaDias, 0, idioma)} days of the calendar.`, idioma);
  if (dias.length > maximo) return null;
  const total = dias.reduce((s, d) => s + d.horas, 0);
  const lista = listaTexto(dias.map((d) => `${dataBR(d.dia, idioma)} (${plural(d.horas, tx("hora", "hour", idioma), tx("horas", "hours", idioma), idioma)})`), idioma);
  return tx(
    `${plural(total, "hora", "horas", idioma)} ${objeto} em ${plural(dias.length, "dia", "dias", idioma)} dos ${num(janelaDias, 0, idioma)} do calendário: ${lista}.`,
    `${plural(total, "hour", "hours", idioma)} ${objeto} on ${plural(dias.length, "day", "days", idioma)} of the ${num(janelaDias, 0, idioma)} in the calendar: ${lista}.`,
    idioma,
  );
}

/* ---------- faixas de horas na grade estreita ---------- */

/** Seis faixas de quatro horas (cada coluna começa na hora indicada), para os mapas de calor em tela estreita. */
export function faixasDeHoras(idioma: Idioma = idiomaEnergia()): { id: string; rotulo: string; curto: string }[] {
  return [0, 4, 8, 12, 16, 20].map((h) => ({
    id: String(h).padStart(2, "0"),
    rotulo: tx(`${String(h).padStart(2, "0")}h às ${String((h + 4) % 24).padStart(2, "0")}h`, `${String(h).padStart(2, "0")}h to ${String((h + 4) % 24).padStart(2, "0")}h`, idioma),
    curto: `${h}h`,
  }));
}
export const FAIXAS_DE_HORAS: { id: string; rotulo: string; curto: string }[] = faixasDeHoras("pt");

/**
 * Agrupa as 24 colunas de hora em faixas de quatro horas: cada valor é a média simples dos quatro valores horários da faixa (sem
 * pesos). Faixa com qualquer hora sem dado fica sem dado: nunca é média de menos horas.
 */
export function agruparEmFaixasDeHoras(valores: readonly (readonly ValorCelula[])[], passo = 4): ValorCelula[][] {
  return valores.map((linha) =>
    Array.from({ length: Math.ceil(linha.length / passo) }, (_, g) => {
      const trecho = linha.slice(g * passo, g * passo + passo);
      const completo = trecho.length === passo && trecho.every((v) => typeof v === "number" && Number.isFinite(v));
      return completo ? (trecho as number[]).reduce((a, b) => a + b, 0) / passo : null;
    }),
  );
}

/* ---------- marcas numeradas do gráfico mensal ---------- */

/** As mudanças de perímetro da carga como marcas numeradas (1, 2) no gráfico, com a legenda escrita à parte: o texto longo não cabe sobre o desenho. */
export function marcosNumerados(h: Pick<BlocoHistorico, "ponderacao">, idioma: Idioma = idiomaEnergia()): { marcos: { x: string; rotulo: string }[]; legenda: { n: number; data: string; texto: string }[] } {
  const q = h.ponderacao.quebras;
  return {
    marcos: q.map((x, i) => ({ x: x.mes, rotulo: String(i + 1) })),
    // a descrição é texto da gold (português); quem exibe a marca como trecho em português na página inglesa
    legenda: q.map((x, i) => ({ n: i + 1, data: dataBR(x.data, idioma), texto: x.descricao.replace(/\.$/, "") })),
  };
}

/* ---------- distância entre submercados na semana de referência ---------- */

export type ValorPorSubmercado = { id: Submercado; valor: number | null };

/** Menor e maior valor entre os submercados, com os empates (igualdade nos centavos) e a distância entre eles; a mesma regra da média diária. */
export function extremosPorSubmercado(itens: readonly ValorPorSubmercado[], idioma: Idioma = idiomaEnergia()): ExtremosMediaDiaria | null {
  const linhas: MediaDiariaSm[] = itens.flatMap((x) =>
    typeof x.valor === "number" && Number.isFinite(x.valor) ? [{ id: x.id, nome: nomeSm(x.id, idioma), rotulo: curtoSm(x.id, idioma), media: x.valor, variacao: null }] : [],
  );
  return extremosMediaDiaria(linhas);
}

/**
 * Os três valores da semana de referência lado a lado entre os submercados: para cada produto, de quanto a quanto vai e a distância entre
 * o maior e o menor, em R$/MWh (nunca como razão). Descrição, não explicação: os dados publicados não dizem por que os submercados
 * diferem. `partes` devolve a frase de abertura, um item por produto e a ressalva, para a página montar uma lista.
 */
export function partesDistanciaSemanal(sem: Pick<SemanaReferencia, "inicio" | "fim" | "por_sm"> | null | undefined, idioma: Idioma = idiomaEnergia()): { introducao: string; itens: string[]; ressalva: string } | null {
  if (!sem) return null;
  const R = (v: number) => reais(v, 2, idioma);
  const produtos = [
    [tx("O CMO semanal do DECOMP", "The DECOMP weekly CMO", idioma), "decomp"],
    [tx("A média do CMO do DESSEM", "The average DESSEM CMO", idioma), "dessem"],
    [tx("A média do PLD", "The average PLD", idioma), "pld"],
  ] as const;
  const quem = (x: ExtremoMediaDiaria) => `${nomesDosSubmercados(x.submercados, idioma)}${x.submercados.length > 1 && x.submercados.length < SUBMERCADOS.length ? tx(", mesmo valor", ", same value", idioma) : ""}`;
  const itens = produtos.flatMap(([rotulo, k]) => {
    const e = extremosPorSubmercado(sem.por_sm.map((x) => ({ id: x.sm, valor: x[k] })), idioma);
    if (!e) return [];
    if (e.distancia === 0) return [tx(`${rotulo} foi igual nos quatro submercados, ${reais(e.menor.valor)}/MWh.`, `${rotulo} was the same in all four submarkets, ${R(e.menor.valor)}/MWh.`, idioma)];
    return [
      tx(
        `${rotulo} foi de ${reais(e.menor.valor)}/MWh (${quem(e.menor)}) a ${reais(e.maior.valor)}/MWh (${quem(e.maior)}), distância de ${reais(e.distancia)}/MWh.`,
        `${rotulo} ranged from ${R(e.menor.valor)}/MWh (${quem(e.menor)}) to ${R(e.maior.valor)}/MWh (${quem(e.maior)}), a distance of ${R(e.distancia)}/MWh.`,
        idioma,
      ),
    ];
  });
  if (!itens.length) return null;
  return {
    introducao: tx(`Entre os submercados, na semana de ${dataBR(sem.inicio)} a ${dataBR(sem.fim)}:`, `Across the submarkets, in the week from ${dataBR(sem.inicio, idioma)} to ${dataBR(sem.fim, idioma)}:`, idioma),
    itens,
    ressalva: tx(
      "Os dados publicados não dizem por que os valores diferem entre submercados; esta página descreve a diferença, não a explica.",
      "The published data do not say why the values differ between submarkets; this page describes the difference, it does not explain it.",
      idioma,
    ),
  };
}

export function textoDistanciaSemanal(sem: Pick<SemanaReferencia, "inicio" | "fim" | "por_sm"> | null | undefined, idioma: Idioma = idiomaEnergia()): string | null {
  const p = partesDistanciaSemanal(sem, idioma);
  return p ? `${p.introducao} ${p.itens.join(" ")} ${p.ressalva}` : null;
}

/* ---------- limites vigentes diante dos valores ---------- */

/** Limites do ato vigente na data (null onde o ato integrado não traz o valor). */
export type LimitesVigentes = { piso: number | null; teto_horario: number | null; teto_estrutural: number | null };

export function limitesVigentesEm(regimes: readonly RegimeLimites[], dia: string): LimitesVigentes | null {
  const r = regimeVigenteEm(regimes, dia);
  return r ? { piso: r.pld_min, teto_horario: r.pld_max_horario, teto_estrutural: r.pld_max_estrutural } : null;
}

/** "igual ao teto horário vigente (R$ X/MWh)" quando o máximo mostrado coincide, nos centavos, com o teto horário do ato vigente na data do máximo. */
export function textoPicoFrenteAoLimite(max: number | null, quando: string | null | undefined, regimes: readonly RegimeLimites[], idioma: Idioma = idiomaEnergia()): string | null {
  if (max === null || !quando) return null;
  const lim = limitesVigentesEm(regimes, quando.slice(0, 10));
  if (!lim || lim.teto_horario === null) return null;
  return emCentavos(max) === emCentavos(lim.teto_horario)
    ? tx(`igual ao teto horário vigente na data (${reais(lim.teto_horario)}/MWh)`, `equal to the hourly cap in force on that date (${reais(lim.teto_horario, 2, idioma)}/MWh)`, idioma)
    : null;
}

/**
 * Quando o CMO semanal do DECOMP passa dos limites do PLD vigentes na semana, a página diz: o CMO não é limitado, o PLD é. Devolve null
 * quando o CMO está dentro dos dois tetos ou o ato vigente não traz o valor.
 */
export function textoCmoFrenteAosLimites(sm: Submercado, decomp: number | null, lim: LimitesVigentes | null, idioma: Idioma = idiomaEnergia()): string | null {
  if (decomp === null || !lim) return null;
  const acimaHorario = lim.teto_horario !== null && emCentavos(decomp) > emCentavos(lim.teto_horario);
  const acimaEstrutural = lim.teto_estrutural !== null && emCentavos(decomp) > emCentavos(lim.teto_estrutural);
  if (!acimaHorario && !acimaEstrutural) return null;
  const R = (v: number | null) => reais(v, 2, idioma);
  const tetos: string[] = [];
  if (acimaHorario) tetos.push(tx(`o teto horário do ato vigente (${reais(lim.teto_horario)}/MWh, limite de cada hora do PLD)`, `the hourly cap in the act in force (${R(lim.teto_horario)}/MWh, the limit for each PLD hour)`, idioma));
  if (acimaEstrutural) tetos.push(tx(`o teto estrutural (${reais(lim.teto_estrutural)}/MWh, limite da média diária do PLD)`, `the structural cap (${R(lim.teto_estrutural)}/MWh, the limit for the daily average PLD)`, idioma));
  return tx(
    `O CMO semanal do DECOMP ${DO_SM[sm]}, ${reais(decomp)}/MWh, é maior que ${listaTexto(tetos)}. Os tetos valem para o PLD, não para o CMO que o ONS publica.`,
    `The DECOMP weekly CMO ${doSm(sm, idioma)}, ${R(decomp)}/MWh, is higher than ${listaTexto(tetos, idioma)}. The caps apply to the PLD, not to the CMO that ONS publishes.`,
    idioma,
  );
}

/** Piso e tetos vigentes em cada semana (pelo último dia da semana), para desenhar no gráfico semanal quando os valores os alcançam. */
export function limitesPorSemana(fins: readonly string[], regimes: readonly RegimeLimites[]): LimitesVigentes[] {
  return fins.map((fim) => limitesVigentesEm(regimes, fim) ?? { piso: null, teto_horario: null, teto_estrutural: null });
}

/** Algum valor semanal (DECOMP, DESSEM ou PLD) alcança o teto estrutural vigente na sua semana: só então os limites entram no gráfico. */
export function valoresAlcancamTeto(linhas: readonly Pick<LinhaSemana, "fim" | "decomp" | "dessem" | "pld">[], regimes: readonly RegimeLimites[]): boolean {
  return linhas.some((l) => {
    const lim = limitesVigentesEm(regimes, l.fim);
    if (!lim || lim.teto_estrutural === null) return false;
    return [l.decomp, l.dessem, l.pld].some((v) => v !== null && emCentavos(v) >= emCentavos(lim.teto_estrutural as number));
  });
}

/* ---------- nominal, regimes e inflação ---------- */

/**
 * O que a distribuição de preços desde 2021 mistura: preços nominais de anos com limites diferentes. Usa só o que a gold de limites
 * publica: a faixa dos pisos, o número de tetos horários diferentes e os anos com mais da metade das horas do submercado no piso.
 */
export function textoRegimesDistribuicao(l: Pick<BlocoLimitesDisponivel, "regimes" | "permanencia_anual">, sm: Submercado = "SE", idioma: Idioma = idiomaEnergia()): string | null {
  const pisos = l.regimes.map((r) => r.pld_min).filter((v): v is number => typeof v === "number");
  if (!pisos.length) return null;
  const tetos = new Set(l.regimes.map((r) => r.pld_max_horario).filter((v) => v !== null)).size;
  const anos = l.permanencia_anual.filter((p) => p.sm === sm && p.frac_piso !== null && p.frac_piso > 0.5).sort((a, b) => a.ano - b.ano);
  const partes = [
    tx(
      `o piso foi de ${reais(Math.min(...pisos), 2, idioma)} a ${reais(Math.max(...pisos), 2, idioma)}/MWh e o teto horário teve ${tetos} valores diferentes`,
      `the floor ranged from ${reais(Math.min(...pisos), 2, idioma)} to ${reais(Math.max(...pisos), 2, idioma)}/MWh and the hourly cap had ${tetos} different values`,
      idioma,
    ),
  ];
  if (anos.length) {
    const fr = anos.map((a) => a.frac_piso as number);
    const menor = fracPct(Math.min(...fr), 1, idioma);
    const maior = fracPct(Math.max(...fr), 1, idioma);
    const faixa = menor === maior ? menor : tx(`de ${menor} a ${maior}`, `from ${menor} to ${maior}`, idioma);
    const quantos = anos.length === 1 ? tx("um ano", "one year", idioma) : tx(`${anos.length} anos`, `${anos.length} years`, idioma);
    partes.push(
      tx(
        `em ${quantos} (${listaTexto(anos.map((a) => String(a.ano)), idioma)}), ${faixa} das horas ${DO_SM[sm]} ficaram no piso`,
        `in ${quantos} (${listaTexto(anos.map((a) => String(a.ano)), idioma)}), ${faixa} of hours ${doSm(sm, idioma)} were at the floor`,
        idioma,
      ),
    );
  }
  return tx(
    `Os valores são nominais, sem correção pela inflação, e de anos com limites diferentes: ${partes.join("; ")}.`,
    `The values are nominal, not adjusted for inflation, and come from years with different limits: ${partes.join("; ")}.`,
    idioma,
  );
}

/** Inflação acumulada entre o primeiro mês da série em moeda constante e o mês-base, pela razão entre a série real e a nominal do mesmo mês. */
export function inflacaoAcumulada(mensal: Pick<BlocoHistorico["mensal"], "meses" | "SE">): { de: string; ate: string; frac: number } | null {
  const real = mensal.SE.real;
  const nom = mensal.SE.temporal;
  const i = real.findIndex((v, k) => typeof v === "number" && typeof nom[k] === "number" && nom[k] !== 0);
  const f = real.map((v, k) => (typeof v === "number" && typeof nom[k] === "number" && nom[k] !== 0 ? k : -1)).filter((k) => k >= 0);
  if (i < 0 || !f.length) return null;
  const ultimo = f[f.length - 1];
  // a razão real/nominal de cada mês é o índice do mês-base dividido pelo índice do mês: a inflação entre dois meses é a razão entre elas
  const razaoPrimeiro = (real[i] as number) / (nom[i] as number);
  const razaoUltimo = (real[ultimo] as number) / (nom[ultimo] as number);
  return { de: mensal.meses[i], ate: mensal.meses[ultimo], frac: razaoPrimeiro / razaoUltimo - 1 };
}

export function textoInflacao(i: { de: string; ate: string; frac: number } | null, idioma: Idioma = idiomaEnergia()): string | null {
  if (!i) return null;
  return tx(
    `O IPCA acumulou cerca de ${num(Math.round(i.frac * 100), 0)}% de ${mesAno(i.de)} a ${mesAno(i.ate)}: R$ 100/MWh nominais de ${mesAno(i.de)} equivalem a cerca de R$ ${num(Math.round(100 * (1 + i.frac)), 0)}/MWh em ${mesAno(i.ate)}.`,
    `Cumulative IPCA inflation was about ${num(Math.round(i.frac * 100), 0, idioma)}% from ${mesAno(i.de, idioma)} to ${mesAno(i.ate, idioma)}: R$ 100/MWh nominal in ${mesAno(i.de, idioma)} is equivalent to about R$ ${num(Math.round(100 * (1 + i.frac)), 0, idioma)}/MWh in ${mesAno(i.ate, idioma)}.`,
    idioma,
  );
}

/** O menor valor horário do ano contra o piso do ato: em quantas combinações de ano e submercado conferidas os dois coincidem. */
export function textoMenorValorEPiso(conferencias: BlocoLimitesDisponivel["conferencias"] | null | undefined, idioma: Idioma = idiomaEnergia()): string | null {
  if (!conferencias?.length) return null;
  const decididas = conferencias.filter((c) => c.menor_igual_ao_piso !== null);
  if (!decididas.length) return null;
  const iguais = decididas.filter((c) => c.menor_igual_ao_piso === true).length;
  return iguais === decididas.length
    ? tx(
        `O menor valor horário observado no ano é igual ao piso do ato vigente nas ${decididas.length} combinações de ano e submercado conferidas.`,
        `The lowest hourly value observed in the year equals the floor in the act in force in all ${decididas.length} combinations of year and submarket checked.`,
        idioma,
      )
    : tx(
        `O menor valor horário observado no ano é igual ao piso do ato vigente em ${iguais} das ${decididas.length} combinações de ano e submercado conferidas.`,
        `The lowest hourly value observed in the year equals the floor in the act in force in ${iguais} of the ${decididas.length} combinations of year and submarket checked.`,
        idioma,
      );
}

/* ---------- texto atualizado das ressalvas sobre limites ---------- */

/**
 * Algumas limitações e regras da gold dizem que os limites "não foram auditados nesta fase". A página de limites mostra os atos da ANEEL
 * conferidos, de modo que a frase ficou desatualizada. Esta troca só mexe nessa cláusula e devolve o texto igual quando ela não existe
 * (quando a gold for regerada com a frase nova, a troca deixa de valer sozinha).
 */
export function semRessalvaDeLimitesNaoAuditados(texto: string): string {
  return texto
    .replace(/ e não foram auditados nesta fase;/, "; os valores vigentes em cada ano, conferidos nos atos da ANEEL, estão na página Limites;")
    .replace(/o limite oficial vigente não foi auditado nesta fase\./, "o piso vigente é o do ato da ANEEL, conferido na página Limites.");
}

/** A mesma troca em uma proveniência inteira (lista de limitações), sem alterar o objeto de origem. */
export function provenienciaSemRessalvaObsoleta<T extends { limitacoes?: string[] }>(p: T): T {
  return p.limitacoes ? { ...p, limitacoes: p.limitacoes.map(semRessalvaDeLimitesNaoAuditados) } : p;
}

/**
 * Nota sobre o teto estrutural na gold: a conferência empírica (quantos dias-submercado a média diária ficou no teto) continua valendo
 * como confirmação, mas a frase final diz que a regra não está citada, e a Resolução Normativa ANEEL nº 1.032/2022 (art. 23) a escreve.
 * Tira só essa frase final.
 */
export function notaTetoComConfirmacaoEmpirica(nota: string): string {
  const i = nota.indexOf("A regra de aplicação não está");
  return i < 0 ? nota : `${nota.slice(0, i).trim()} A regra está na norma citada nesta seção; o padrão observado confirma a leitura.`; // i18n: dado
}

/* ---------- geração do Balanço do ONS (diagrama e ideia central) ---------- */

function baseBalanco(idioma: Idioma): string {
  return tx("geração do SIN no Balanço de Energia nos Subsistemas do ONS", "SIN generation in the ONS Energy Balance by Subsystem", idioma);
}

function ressalvaMmgd(g: GeracaoGold, idioma: Idioma): string {
  const desde = g.inicio_regime_atual ? tx(` desde ${dataBR(g.inicio_regime_atual)}`, ` since ${dataBR(g.inicio_regime_atual, idioma)}`, idioma) : "";
  return tx(`a solar inclui a micro e minigeração distribuída (MMGD) estimada pelo ONS${desde}`, `solar includes distributed micro and mini generation (MMGD) estimated by ONS${desde}`, idioma);
}

/** Eólica e solar do SIN em 7 dias, ditas como parcelas do Balanço do ONS, com a ressalva da MMGD estimada na solar (nunca "verificada"). */
export function estadoRenovaveisBalanco(g: GeracaoGold | null, idioma: Idioma = idiomaEnergia()): string | null {
  if (!g?.disponivel) return null;
  const m = g.regioes.find((r) => r.rg === "SIN")?.["7d"];
  if (!m) return null;
  return tx(
    `Nos 7 dias até ${dataBR(m.fim)}, a eólica respondeu por ${num(m.participacao.eolica, 1)}% e a solar por ${num(m.participacao.solar, 1)}% da ${baseBalanco(idioma)}; ${ressalvaMmgd(g, idioma)}.`,
    `In the 7 days to ${dataBR(m.fim, idioma)}, wind accounted for ${num(m.participacao.eolica, 1, idioma)}% and solar for ${num(m.participacao.solar, 1, idioma)}% of ${baseBalanco(idioma)}; ${ressalvaMmgd(g, idioma)}.`,
    idioma,
  );
}

export function estadoTermicasBalanco(g: GeracaoGold | null, idioma: Idioma = idiomaEnergia()): string | null {
  if (!g?.disponivel) return null;
  const t = g.termica_contexto;
  if (t.participacao_7d === null) return null;
  return tx(
    `As térmicas responderam por ${num(t.participacao_7d, 1)}% da ${baseBalanco(idioma)} nos 7 dias até ${dataBR(g.dia_referencia)} (mediana dos 12 meses anteriores: ${num(t.mediana_365d, 1)}%); ${ressalvaMmgd(g, idioma)}, e a MMGD entra no total em que a participação é medida. O custo variável unitário por usina está catalogado e ainda não integrado.`,
    `Thermal plants accounted for ${num(t.participacao_7d, 1, idioma)}% of ${baseBalanco(idioma)} in the 7 days to ${dataBR(g.dia_referencia, idioma)} (median of the previous 12 months: ${num(t.mediana_365d, 1, idioma)}%); ${ressalvaMmgd(g, idioma)}, and MMGD is included in the total against which the share is measured. The variable unit cost (CVU) by plant is cataloged and not yet integrated.`,
    idioma,
  );
}

/** A ideia central do capítulo: parcela da hidráulica na geração do Balanço do ONS em 12 meses, com a ressalva da MMGD no total. */
export function textoHidraulicaBalanco(g: GeracaoGold | null, idioma: Idioma = idiomaEnergia()): string | null {
  if (!g?.disponivel) return null;
  const m = g.regioes.find((r) => r.rg === "SIN")?.["12m"];
  if (!m) return null;
  return tx(
    `Nos 12 meses até ${dataBR(m.fim)}, a geração hidráulica respondeu por ${num(m.participacao.hidraulica, 1)}% da geração do Sistema Interligado Nacional (SIN) no Balanço de Energia nos Subsistemas do ONS; ${ressalvaMmgd(g, idioma)}, e a MMGD estimada entra no total.`,
    `In the 12 months to ${dataBR(m.fim, idioma)}, hydropower accounted for ${num(m.participacao.hidraulica, 1, idioma)}% of generation in the National Interconnected System (SIN) in the ONS Energy Balance by Subsystem; ${ressalvaMmgd(g, idioma)}, and estimated MMGD is included in the total.`,
    idioma,
  );
}

/* ---------- fluxo por hora no dia do mapa ---------- */

export type SentidoDoFluxoNoDia = { fronteira: Fronteira; de: Submercado; para: Submercado; horas: number; no_sentido: number; contrario: number; nulo: number };

/**
 * Para cada fronteira, quantas das horas do dia o fluxo publicado foi no sentido de `de` para `para`, no sentido contrário, ou nulo
 * (|fluxo| até 1 MWmed). Só conta as horas com fluxo publicado (ausência não é zero). O sinal é o do arquivo: positivo da primeira para a
 * segunda ponta da fronteira.
 */
export function horasPorSentidoNoDia(rec: Pick<PldHorarioRecenteArquivo, "t" | "fluxo">, dia: string): SentidoDoFluxoNoDia[] {
  const idx = rec.t.map((t, i) => (t.startsWith(dia) ? i : -1)).filter((i) => i >= 0);
  return FRONTEIRAS.map((f) => {
    const { de, para } = pontasFronteira(f);
    let no_sentido = 0;
    let contrario = 0;
    let nulo = 0;
    for (const i of idx) {
      const v = rec.fluxo[f][i];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      if (Math.abs(v) <= 1) nulo++;
      else if (v > 0) no_sentido++;
      else contrario++;
    }
    return { fronteira: f, de, para, horas: no_sentido + contrario + nulo, no_sentido, contrario, nulo };
  });
}

export function textoSentidoNoDia(s: SentidoDoFluxoNoDia, idioma: Idioma = idiomaEnergia()): string | null {
  if (s.horas === 0) return null;
  const dePara = tx(`${CURTO_SM[s.de]} para ${CURTO_SM[s.para]}`, `${curtoSm(s.de, idioma)} to ${curtoSm(s.para, idioma)}`, idioma);
  const paraDe = tx(`${CURTO_SM[s.para]} para ${CURTO_SM[s.de]}`, `${curtoSm(s.para, idioma)} to ${curtoSm(s.de, idioma)}`, idioma);
  const partes = [tx(`${dePara}: ${s.no_sentido} de ${s.horas} horas`, `${dePara}: ${s.no_sentido} of ${s.horas} hours`, idioma), `${paraDe}: ${s.contrario}`];
  if (s.nulo > 0) partes.push(tx(`fluxo nulo: ${s.nulo}`, `zero flow: ${s.nulo}`, idioma));
  return partes.join("; ");
}

/* ---------- semana operativa do CMO ---------- */

/** Semana operativa (sábado a sexta) que termina na data: início e fim por extenso. */
export function intervaloSemanaOperativa(fim: string): { inicio: string; fim: string } {
  return { inicio: somaDias(fim.slice(0, 10), -6), fim: fim.slice(0, 10) };
}

/**
 * Tira nome de arquivo de um texto de Entender: "o histórico horário inteiro está em pld_cmo_horario.csv" diz, em palavras, que o arquivo
 * horário de CMO e PLD está entre os downloads do painel. Texto sem nome de arquivo volta igual.
 */
export function notaSemNomeDeArquivo(texto: string): string {
  // o texto é da gold (português) e continua em português: a troca só tira o nome de arquivo
  return texto.replace(/está em pld_cmo_horario\.csv/g, "está no arquivo horário de CMO e PLD (CSV, em Baixar os dados)").replace(/\b[\w-]+\.(?:csv|json|parquet)\b/g, "arquivo do painel"); // i18n: dado
}
