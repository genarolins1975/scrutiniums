/**
 * Lógica pura das páginas da Rede (P028 circulação, P029 balanço e exterior, P030
 * restrições publicadas, P031 programado e verificado), testada em node sem navegador.
 *
 * Nada aqui recalcula indicador: energia em cada sentido, saldos, resíduos, horas de
 * violação, energia não suprida e desvios vêm prontos da gold
 * (pipeline/energia/modulos/rede_detalhe.py). As funções escolhem o recorte pedido na
 * URL, montam as linhas que o gráfico, a tabela equivalente e a exportação usam (as
 * mesmas linhas, para que os três nunca divirjam) e escrevem as respostas curtas por
 * regra determinística: mudar o número muda o texto, e nenhuma frase traz número
 * fixo. Ausência continua ausência (null), nunca zero.
 *
 * Idioma: toda função que escreve texto para o leitor recebe o idioma no último
 * argumento (padrão: o da página, idiomaEnergia()); as constantes exportadas em
 * maiúsculas são a forma portuguesa, e a função de mesmo nome em minúsculas dá a forma
 * de cada idioma.
 *
 * Sinais (iguais aos da gold): fronteira na orientação N→NE, N→SE/CO, NE→SE/CO e
 * S→SE/CO, positivo da primeira para a segunda região; exterior positivo é exportação
 * do Brasil; desvio = verificado − programado na mesma orientação.
 */
import type { Idioma } from "@/lib/idioma";
import { formatos, mesAno } from "./formato";
import { idiomaEnergia, porIdioma, tx } from "./idioma";
import { DEFINICAO_FLUXO_EN, rotuloDaGold } from "./i18n/agua-carga-rede";
import type { ColunaTabela, LinhaTabela, ValorCelula } from "./tabela";
import type { Submercado } from "./tipos";
import type {
  AchadosRede,
  BalancoRede,
  BuscaLimite,
  CirculacaoRede,
  CoberturaFonte,
  ConferenciaSilver,
  DistribuicaoBase,
  EsquemaFonteRede,
  ExteriorRede,
  FluxoAtls,
  FronteiraRede,
  IdentidadeBalanco,
  LimiarSensibilidade,
  JanelaHorariaRede,
  MaiorDesvio,
  PaisRede,
  PaisSul,
  ParProgramado,
  Perturbacao,
  ProgramadoRede,
  RegimeMmgd,
  RestricoesRede,
  ResumoFronteira30d,
  SubsistemaOuSin,
} from "./tipos-rede";

/* ---------- rotas e painéis ---------- */

export const ROTA_REDE = "/setor-eletrico/rede";
export type PainelRede = "p028" | "p029" | "p030" | "p031";

/** Pergunta do destino Rede no menu (navegacao.ts) e título da página principal. */
export const PERGUNTA_MODULO_REDE = "Como a energia circula entre regiões?"; // i18n: dado

/**
 * Um painel por página: cada um tem séries, várias tabelas equivalentes e fichas de
 * prova; juntos passariam da meta de cerca de 600 KB de HTML por página (contrato,
 * seção 5.1). As perguntas são as do Anexo A; a do P030 é a pergunta própria que os
 * dados públicos sustentam (os limites operativos não são públicos, achado A06).
 */
export function paineisRede(idioma: Idioma = idiomaEnergia()): { id: PainelRede; rotulo: string; caminho: string; pergunta: string }[] {
  return [
    {
      id: "p028",
      rotulo: tx("Circulação de energia", "Energy flows", idioma),
      caminho: "",
      pergunta: tx("Como a energia circula entre regiões?", "How does energy flow between regions?", idioma),
    },
    {
      id: "p029",
      rotulo: tx("Balanço e exterior", "Balance and exterior", idioma),
      caminho: "/balanco-e-exterior",
      pergunta: tx("As contas do balanço de energia fecham?", "Do the energy balance accounts add up?", idioma),
    },
    {
      id: "p030",
      rotulo: tx("Restrições publicadas", "Published restrictions", idioma),
      caminho: "/restricoes",
      pergunta: tx("Quando há evidência publicada de limitação da rede?", "When is there published evidence of grid limitation?", idioma),
    },
    {
      id: "p031",
      rotulo: tx("Programado e verificado", "Scheduled and verified", idioma),
      caminho: "/programado",
      pergunta: tx("Quanto o fluxo divergiu do programa?", "How far did the flow diverge from the schedule?", idioma),
    },
  ];
}
export const PAINEIS_REDE = paineisRede("pt");

export function rotaPainel(id: PainelRede): string {
  return `${ROTA_REDE}${PAINEIS_REDE.find((p) => p.id === id)?.caminho ?? ""}`;
}

export function perguntaPainel(id: PainelRede, idioma: Idioma = idiomaEnergia()): string {
  return paineisRede(idioma).find((p) => p.id === id)?.pergunta ?? "";
}

/* ---------- entidades, nomes e cores ---------- */

export const FRONTEIRAS: readonly FronteiraRede[] = ["N_NE", "N_SE", "NE_SE", "S_SE"];
export const SUBSISTEMAS: readonly Submercado[] = ["SE", "S", "NE", "N"];
export const REGIOES_BALANCO: readonly SubsistemaOuSin[] = ["SIN", "SE", "S", "NE", "N"];
export const PAISES: readonly PaisRede[] = ["ARGENTINA", "URUGUAI", "PARAGUAI"];
export const PAISES_SUL: readonly PaisSul[] = ["ARGENTINA", "URUGUAI"];
export const PARES_PROGRAMADO: readonly ParProgramado[] = ["N_NE", "N_SE", "NE_SE", "S_SE", "ARGENTINA", "URUGUAI"];

export const NOME_SM: Record<SubsistemaOuSin, string> = { SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte", SIN: "SIN" };
export const CURTO_SM: Record<SubsistemaOuSin, string> = { SE: "SE/CO", S: "S", NE: "NE", N: "N", SIN: "SIN" };
/** "do Norte", "para o Nordeste": contração com o artigo de cada nome. */
export const DO_SM: Record<SubsistemaOuSin, string> = { SE: "do Sudeste/Centro-Oeste", S: "do Sul", NE: "do Nordeste", N: "do Norte", SIN: "do SIN" };
const PARA_O: Record<SubsistemaOuSin, string> = { SE: "para o Sudeste/Centro-Oeste", S: "para o Sul", NE: "para o Nordeste", N: "para o Norte", SIN: "para o SIN" }; // i18n: dado
const NO: Record<SubsistemaOuSin, string> = { SE: "no Sudeste/Centro-Oeste", S: "no Sul", NE: "no Nordeste", N: "no Norte", SIN: "no SIN" };
export const NOME_PAIS: Record<PaisRede, string> = { ARGENTINA: "Argentina", URUGUAI: "Uruguai", PARAGUAI: "Paraguai" };

const NOME_SM_EN: Record<SubsistemaOuSin, string> = { SE: "Southeast/Center-West", S: "South", NE: "Northeast", N: "North", SIN: "SIN" };
const CURTO_SM_EN: Record<SubsistemaOuSin, string> = { SE: "SE/CW", S: "S", NE: "NE", N: "N", SIN: "SIN" };
const NOME_PAIS_EN: Record<PaisRede, string> = { ARGENTINA: "Argentina", URUGUAI: "Uruguay", PARAGUAI: "Paraguay" };

/** Nome do subsistema no idioma ("Norte", "North"). */
export function nomeSm(sm: SubsistemaOuSin, idioma: Idioma = idiomaEnergia()): string {
  return porIdioma(idioma, { pt: NOME_SM, en: NOME_SM_EN })[sm];
}
/** Sigla do subsistema no idioma ("SE/CO", "SE/CW"). */
export function curtoSm(sm: SubsistemaOuSin, idioma: Idioma = idiomaEnergia()): string {
  return porIdioma(idioma, { pt: CURTO_SM, en: CURTO_SM_EN })[sm];
}
/** "do Norte", "from the North". */
export function doSm(sm: SubsistemaOuSin, idioma: Idioma = idiomaEnergia()): string {
  return tx(DO_SM[sm], `from the ${NOME_SM_EN[sm]}`, idioma);
}
/** "para o Norte", "to the North". */
function paraO(sm: SubsistemaOuSin, idioma: Idioma): string {
  return tx(PARA_O[sm], `to the ${NOME_SM_EN[sm]}`, idioma);
}
/** "no Norte", "in the North". */
export function noSm(sm: SubsistemaOuSin, idioma: Idioma = idiomaEnergia()): string {
  return tx(NO[sm], `in the ${NOME_SM_EN[sm]}`, idioma);
}
/** Nome do país no idioma. */
export function nomePais(p: PaisRede, idioma: Idioma = idiomaEnergia()): string {
  return porIdioma(idioma, { pt: NOME_PAIS, en: NOME_PAIS_EN })[p];
}
/** "a Argentina", "o Uruguai"; em inglês, só o nome. */
function oPais(p: PaisRede, idioma: Idioma): string {
  return tx(`${p === "ARGENTINA" ? "a" : "o"} ${NOME_PAIS[p]}`, NOME_PAIS_EN[p], idioma);
}

/** As duas pontas de cada fronteira, na orientação da gold. */
export const PONTAS: Record<FronteiraRede, [Submercado, Submercado]> = { N_NE: ["N", "NE"], N_SE: ["N", "SE"], NE_SE: ["NE", "SE"], S_SE: ["S", "SE"] };

export const COR_SM: Record<SubsistemaOuSin, string> = {
  SIN: "var(--cor-energia)", // i18n: dado
  SE: "var(--serie-sm-se)",
  S: "var(--serie-sm-s)",
  NE: "var(--serie-sm-ne)",
  N: "var(--serie-sm-n)",
};
export const COR_PAR: Record<ParProgramado, string> = {
  N_NE: "var(--serie-comp-1)",
  N_SE: "var(--serie-comp-2)",
  NE_SE: "var(--serie-comp-3)",
  S_SE: "var(--serie-comp-4)",
  ARGENTINA: "var(--serie-5)",
  URUGUAI: "var(--serie-6)",
};
export const COR_COMPARACAO = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"] as const;

/** "Norte → Nordeste": a orientação da fronteira (positivo da primeira para a segunda). */
export function nomeFronteira(par: FronteiraRede, idioma: Idioma = idiomaEnergia()): string {
  const [a, b] = PONTAS[par];
  return `${nomeSm(a, idioma)} → ${nomeSm(b, idioma)}`;
}

/** "N→SE/CO". */
export function curtoFronteira(par: FronteiraRede, idioma: Idioma = idiomaEnergia()): string {
  const [a, b] = PONTAS[par];
  return `${curtoSm(a, idioma)}→${curtoSm(b, idioma)}`;
}

/** "entre Norte e Sudeste/Centro-Oeste": a fronteira sem sentido. */
export function entreFronteira(par: FronteiraRede, idioma: Idioma = idiomaEnergia()): string {
  const [a, b] = PONTAS[par];
  return tx(`entre ${NOME_SM[a]} e ${NOME_SM[b]}`, `between ${NOME_SM_EN[a]} and ${NOME_SM_EN[b]}`, idioma);
}

export function ehFronteira(par: string): par is FronteiraRede {
  return (FRONTEIRAS as readonly string[]).includes(par);
}

/** Fronteira pelo nome da orientação; país pelo nome (positivo = exportação do Brasil). */
export function nomePar(par: ParProgramado, idioma: Idioma = idiomaEnergia()): string {
  return ehFronteira(par) ? nomeFronteira(par, idioma) : nomePais(par, idioma);
}

export function curtoPar(par: ParProgramado, idioma: Idioma = idiomaEnergia()): string {
  return ehFronteira(par) ? curtoFronteira(par, idioma) : nomePais(par, idioma);
}

/** Sentido positivo do par, em palavras ("do Norte para o Nordeste", "do Brasil para a Argentina"). */
export function sentidoPositivo(par: ParProgramado, idioma: Idioma = idiomaEnergia()): string {
  if (ehFronteira(par)) {
    const [a, b] = PONTAS[par];
    return `${doSm(a, idioma)} ${paraO(b, idioma)}`;
  }
  return tx(`do Brasil para ${par === "ARGENTINA" ? "a Argentina" : "o Uruguai"}`, `from Brazil to ${NOME_PAIS_EN[par]}`, idioma);
}

/** Sentido negativo do par, em palavras. */
export function sentidoNegativo(par: ParProgramado, idioma: Idioma = idiomaEnergia()): string {
  if (ehFronteira(par)) {
    const [a, b] = PONTAS[par];
    return `${doSm(b, idioma)} ${paraO(a, idioma)}`;
  }
  return tx(`${par === "ARGENTINA" ? "da Argentina" : "do Uruguai"} para o Brasil`, `from ${NOME_PAIS_EN[par]} to Brazil`, idioma);
}

/* ---------- utilidades de texto ---------- */

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "a, b e c". */
export function listaTexto(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}

/** "a; b; e c": para itens que já têm vírgula dentro. */
export function listaLonga(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join("; ")}; ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}

/** "entre 01/01/2026 e 14/05/2026" ou "em 14/09/2022" quando é o mesmo dia. */
function entreDatas(a: string, b: string, idioma: Idioma): string {
  const f = formatos(idioma);
  return a.slice(0, 10) === b.slice(0, 10)
    ? tx(`em ${f.dataBR(a)}`, `on ${f.dataBR(a)}`, idioma)
    : tx(`entre ${f.dataBR(a)} e ${f.dataBR(b)}`, `between ${f.dataBR(a)} and ${f.dataBR(b)}`, idioma);
}

const mwh = (v: number | null | undefined, idioma: Idioma = idiomaEnergia()) => `${formatos(idioma).num(v, 0)} MWh`;
const mwmed = (v: number | null | undefined, casas = 0, idioma: Idioma = idiomaEnergia()) => `${formatos(idioma).num(v, casas)} ${tx("MWmed", "MWavg", idioma)}`;
const horas = (v: number | null | undefined, casas = 0, idioma: Idioma = idiomaEnergia()) => {
  const f = formatos(idioma);
  return v === null || v === undefined
    ? tx("sem dado", "no data", idioma)
    : casas === 0
      ? f.plural(v, tx("hora", "hour", idioma), tx("horas", "hours", idioma))
      : `${f.num(v, casas)} ${v === 1 ? tx("hora", "hour", idioma) : tx("horas", "hours", idioma)}`;
};

/**
 * Datas ISO que o pipeline escreve dentro de frases (achado A05) em formato brasileiro:
 * "AAAA-MM-DDTHH:00" vira "DD/MM/AAAA às HHh" e "AAAA-MM-DD" vira "DD/MM/AAAA". Só a
 * forma muda; números e palavras ficam como vieram.
 */
export function datasLegiveis(texto: string): string {
  return texto
    .replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):00/g, (_, a, m, d, h) => `${d}/${m}/${a} às ${h}h`) // i18n: dado
    .replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/g, (_, a, m, d, h, mi) => `${d}/${m}/${a} às ${h}h${mi}`) // i18n: dado
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, a, m, d) => `${d}/${m}/${a}`);
}

/**
 * Regras publicadas na gold citam, entre parênteses, campos internos da própria gold
 * ("em esquema_fonte", "programado.justificativa_limiar"). Na página, o leitor não
 * tem esses caminhos: o parêntese sai e o resto do texto fica como veio.
 */
export function semCaminhosInternos(texto: string): string {
  return (
    texto
      // trecho final de parêntese que remete a um bloco da gold ("; lista por país em cobertura.exterior")
      .replace(/;\s*[^;()]*\bem (?:cobertura|circulacao|balanco|exterior|restricoes|programado|achados|regras)\.[a-z0-9_.]+(?=\))/g, "")
      .replace(/\s*\([^()]*\b[a-z0-9]+_[a-z0-9_.]+\b[^()]*\)/g, "")
  );
}

/**
 * Proveniência com as limitações sem caminhos internos da gold (o parêntese com
 * "programado.programa_repetido" não diz nada ao leitor). O resto vem como publicado.
 */
export function provenienciaLegivel<T extends { limitacoes: string[] }>(p: T): T {
  // a gold publicada traz uma lista dentro da lista em proveniencia.exterior.limitacoes; achatada, cada limitação vira
  // um item próprio (sem achatar, o React cola as duas frases num item só)
  const itens = (p.limitacoes as unknown[]).flat(2).filter((x): x is string => typeof x === "string" && x.trim() !== "");
  return { ...p, limitacoes: itens.map(semCaminhosInternos) };
}

/** Rótulos das regras publicadas na gold (chaves de RegrasRede). */
export function rotulosRegra(idioma: Idioma = idiomaEnergia()): Record<string, string> {
  return {
    orientacao: tx("Orientação e sinal", "Orientation and sign", idioma),
    energia: tx("Energia", "Energy", idioma),
    bruto_liquido: tx("Bruto e líquido", "Gross and net", idioma),
    nulo: tx("Fluxo nulo", "Zero flow", idioma),
    pld: tx("PLD na mesma hora", "PLD in the same hour", idioma),
    balanco: tx("Identidades do balanço", "Balance identities", idioma),
    tolerancia_balanco: tx("Tolerância do balanço", "Balance tolerance", idioma),
    limites: tx("Limites de intercâmbio", "Interchange limits", idioma),
    materialidade: tx("Materialidade do desvio", "Deviation materiality", idioma),
  };
}
export const ROTULO_REGRA: Record<string, string> = rotulosRegra("pt");

/** "sim" e "não" no idioma. */
function simNao(v: boolean, idioma: Idioma): string {
  return v ? tx("sim", "yes", idioma) : tx("não", "no", idioma);
}

/** Booleanos e listas viram texto para a tabela (sim/não; itens separados por vírgula). */
export function paraTabela<T extends object>(linhas: readonly T[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return linhas.map((l) =>
    Object.fromEntries(
      Object.entries(l)
        .filter(([, v]) => v === null || typeof v !== "object" || Array.isArray(v))
        .map(([k, v]) => [k, typeof v === "boolean" ? simNao(v, idioma) : Array.isArray(v) ? v.join(", ") : (v as ValorCelula)]),
    ),
  );
}

/* ---------- atualidade ---------- */

/** Dia de Brasília (AAAA-MM-DD) de um carimbo UTC. */
export function diaDeBrasilia(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Defasagem do dado contra o processamento. O ONS publica intercâmbio e balanço com
 * um a dois dias de atraso; acima da folga, a página avisa que a fonte está defasada
 * e que os números são os da última publicação válida.
 */
export function situacaoAtualidade(diaReferencia: string, geradoEm: string, folgaDias = 3, idioma: Idioma = idiomaEnergia()): { defasada: boolean; dias: number; texto: string } {
  const f = formatos(idioma);
  const proc = diaDeBrasilia(geradoEm);
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - Date.parse(`${diaReferencia.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  const nDias = f.plural(dias, tx("dia", "day", idioma), tx("dias", "days", idioma));
  if (dias > folgaDias) {
    return {
      defasada: true,
      dias,
      texto: tx(
        `Fonte defasada: o dia mais recente é ${f.dataBR(diaReferencia)}, ${nDias} antes do processamento (${f.dataBR(proc)}), mais que o atraso habitual de publicação do ONS. Os números são os da última publicação válida.`,
        `Source behind schedule: the most recent day is ${f.dataBR(diaReferencia)}, ${nDias} before processing (${f.dataBR(proc)}), more than the usual ONS publication delay. The numbers are those of the last valid release.`,
        idioma,
      ),
    };
  }
  return {
    defasada: false,
    dias,
    texto: tx(
      `Dado até ${f.dataBR(diaReferencia)}, processado em ${f.dataBR(proc)} (${nDias} depois).`,
      `Data through ${f.dataBR(diaReferencia)}, processed on ${f.dataBR(proc)} (${nDias} later).`,
      idioma,
    ),
  };
}

/** Meses entre dois AAAA-MM (fim − início), para a defasagem de séries mensais. */
export function mesesEntre(inicio: string, fim: string): number {
  return (Number(fim.slice(0, 4)) - Number(inicio.slice(0, 4))) * 12 + Number(fim.slice(5, 7)) - Number(inicio.slice(5, 7));
}

/**
 * Limiares de método da gold, usados nos textos: fluxo até 1 MWmed em módulo conta como
 * nulo (regras.nulo) e preços se separam acima de R$ 0,01/MWh (regras.pld). O teste
 * confere que os textos das regras publicadas trazem estes valores.
 */
export const LIMIAR_NULO_MWMED = 1;
export const LIMIAR_PRECOS_RS_MWH = 0.01;

/* ====================================================================== */
/* P028: circulação                                                         */
/* ====================================================================== */

/** Dia pedido, se existir na janela; senão o último dia publicado. */
export function diaEscolhido(dias: readonly string[], pedido: string): string {
  return pedido && dias.includes(pedido) ? pedido : (dias[dias.length - 1] ?? "");
}

/** Origem e destino do saldo (null quando o saldo é ausente ou zero). */
export function sentidoDoSaldo(par: FronteiraRede, liquido: number | null | undefined): { origem: Submercado; destino: Submercado } | null {
  if (liquido === null || liquido === undefined || !Number.isFinite(liquido) || liquido === 0) return null;
  const [a, b] = PONTAS[par];
  return liquido > 0 ? { origem: a, destino: b } : { origem: b, destino: a };
}

/** "N→SE/CO" no sentido do saldo; "sem saldo" ou "sem dado". */
export function rotuloSentidoSaldo(par: FronteiraRede, liquido: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (liquido === null || liquido === undefined) return tx("sem dado", "no data", idioma);
  const s = sentidoDoSaldo(par, liquido);
  return s ? `${curtoSm(s.origem, idioma)}→${curtoSm(s.destino, idioma)}` : tx("sem saldo", "no net flow", idioma);
}

/** Horas no sentido contrário ao saldo (as que o saldo esconde), pela contagem com |fluxo| > 1 MWmed. */
function horasContraSaldo(r: Pick<ResumoFronteira30d, "liquido_mwh" | "horas_canonico" | "horas_inverso">): number {
  return r.liquido_mwh >= 0 ? r.horas_inverso : r.horas_canonico;
}

/**
 * Resposta curta do P028 (30 dias): para onde foi o saldo em cada fronteira e quanto
 * ele esconde de energia no sentido contrário. Fronteira sem nenhuma hora acima de
 * 1 MWmed no sentido contrário é dita "num só sentido"; as demais citam a energia e as
 * horas no sentido contrário.
 */
export function respostaCirculacao(resumo: readonly ResumoFronteira30d[], idioma: Idioma = idiomaEnergia()): string {
  if (!resumo.length) return tx("Sem fluxo publicado na janela de 30 dias.", "No flow published in the 30-day window.", idioma);
  const f = formatos(idioma);
  const inicio = resumo.map((r) => r.inicio).sort()[0];
  const fim = resumo.map((r) => r.fim).sort().at(-1)!;
  const saldos: string[] = [];
  const sem: string[] = [];
  for (const r of resumo) {
    if (r.horas === 0) {
      sem.push(entreFronteira(r.par, idioma));
      continue;
    }
    const s = sentidoDoSaldo(r.par, r.liquido_mwh);
    saldos.push(
      s
        ? `${doSm(s.origem, idioma)} ${paraO(s.destino, idioma)} (${mwh(Math.abs(r.liquido_mwh), idioma)})`
        : tx(`${entreFronteira(r.par, "pt")}, saldo nulo`, `${entreFronteira(r.par, "en")}, zero net flow`, idioma),
    );
  }
  const frases = [
    tx(
      `De ${f.dataBR(inicio)} a ${f.dataBR(fim)}, o saldo de energia foi ${listaTexto(saldos, idioma)}.`,
      `From ${f.dataBR(inicio)} to ${f.dataBR(fim)}, the net energy flow was ${listaTexto(saldos, idioma)}.`,
      idioma,
    ),
  ];
  const comDado = resumo.filter((r) => r.horas > 0);
  const umSentido = comDado.filter((r) => horasContraSaldo(r) === 0);
  const doisSentidos = comDado.filter((r) => horasContraSaldo(r) > 0);
  if (umSentido.length === comDado.length) {
    frases.push(
      tx(
        `Em nenhuma das fronteiras o fluxo passou de ${mwmed(LIMIAR_NULO_MWMED, 0, idioma)} no sentido contrário ao saldo, então o saldo não esconde energia.`,
        `At none of the boundaries did the flow exceed ${mwmed(LIMIAR_NULO_MWMED, 0, idioma)} against the net flow, so the net flow hides no energy.`,
        idioma,
      ),
    );
  } else {
    const partes = doisSentidos.map((r) =>
      tx(
        `${mwh(r.contra_saldo_mwh, idioma)} ${entreFronteira(r.par, idioma)} (${f.num(horasContraSaldo(r), 0)} de ${f.num(r.horas, 0)} horas)`,
        `${mwh(r.contra_saldo_mwh, idioma)} ${entreFronteira(r.par, idioma)} (${f.num(horasContraSaldo(r), 0)} of ${f.num(r.horas, 0)} hours)`,
        idioma,
      ),
    );
    const listaUm = listaTexto(
      umSentido.map((r) => entreFronteira(r.par, idioma)),
      idioma,
    );
    const um = umSentido.length
      ? tx(
          `${umSentido.length === 1 ? "Uma fronteira" : `${cap(numeroPorExtenso(umSentido.length, "pt"))} fronteiras`} ${umSentido.length === 1 ? "teve" : "tiveram"} fluxo num só sentido (${listaUm}); `,
          `${umSentido.length === 1 ? "One boundary" : `${cap(numeroPorExtenso(umSentido.length, "en"))} boundaries`} had flow in one direction only (${listaUm}); `,
          idioma,
        )
      : "";
    frases.push(
      tx(
        `${um}${um ? "nas outras" : "Em todas"}, o saldo esconde energia que passou no sentido contrário: ${listaTexto(partes, idioma)}.`,
        `${um}${um ? "at the others" : "At all of them"}, the net flow hides energy that went the opposite way: ${listaTexto(partes, idioma)}.`,
        idioma,
      ),
    );
  }
  const incompletos = comDado.filter((r) => r.dias_completos < r.dias);
  if (incompletos.length) {
    const lista = listaTexto(
      incompletos.map((r) =>
        tx(
          `${entreFronteira(r.par, "pt")} (${r.dias_completos} de ${r.dias} dias com as 24 horas)`,
          `${entreFronteira(r.par, "en")} (${r.dias_completos} of ${r.dias} days with all 24 hours)`,
          idioma,
        ),
      ),
      idioma,
    );
    frases.push(tx(`Janela com dias incompletos em ${lista}.`, `Window with incomplete days ${lista}.`, idioma));
  }
  if (sem.length) frases.push(tx(`Sem fluxo publicado ${listaTexto(sem, "pt")}.`, `No flow published ${listaTexto(sem, "en")}.`, idioma));
  return frases.join(" ");
}

function numeroPorExtenso(n: number, idioma: Idioma = idiomaEnergia()): string {
  return porIdioma(idioma, { pt: ["zero", "uma", "duas", "três", "quatro"], en: ["zero", "one", "two", "three", "four"] })[n] ?? String(n);
}

/** "o Sudeste/Centro-Oeste", "o Norte": a região com o artigo, para frases com sujeito. */
const O_SM: Record<SubsistemaOuSin, string> = { SE: "o Sudeste/Centro-Oeste", S: "o Sul", NE: "o Nordeste", N: "o Norte", SIN: "o SIN" };
function oSm(sm: SubsistemaOuSin, idioma: Idioma): string {
  return tx(O_SM[sm], `the ${NOME_SM_EN[sm]}`, idioma);
}

/**
 * Veredito do P028 em palavras simples: para onde a energia foi no saldo dos últimos 30 dias e se o saldo esconde energia
 * que passou no sentido contrário. As quantidades de cada fronteira ficam em respostaCirculacao; aqui só o maior valor
 * escondido, lido dos mesmos campos (contra_saldo_mwh).
 */
export function vereditoCirculacao(resumo: readonly ResumoFronteira30d[], idioma: Idioma = idiomaEnergia()): string {
  const comDado = resumo.filter((r) => r.horas > 0);
  if (!comDado.length) return tx("Sem fluxo publicado na janela de 30 dias.", "No flow published in the 30-day window.", idioma);
  const f = formatos(idioma);
  const fim = resumo.map((r) => r.fim).sort().at(-1)!;
  const dias = Math.max(...resumo.map((r) => r.dias));
  // quem recebeu energia de quem, no saldo da janela, na ordem em que as fronteiras aparecem
  const porDestino = new Map<Submercado, Submercado[]>();
  for (const r of comDado) {
    const s = sentidoDoSaldo(r.par, r.liquido_mwh);
    if (s) porDestino.set(s.destino, [...(porDestino.get(s.destino) ?? []), s.origem]);
  }
  const recebimentos = Array.from(porDestino.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([destino, origens], i) => {
      const de = listaTexto(
        origens.map((o) => doSm(o, idioma)),
        idioma,
      );
      return tx(`${O_SM[destino]} recebeu ${i === 0 ? "energia " : ""}${de}`, `${oSm(destino, "en")} received ${i === 0 ? "energy " : ""}${de}`, idioma);
    });
  const frases = [
    tx(
      `Nos ${dias} dias até ${f.dataBR(fim)}, ${recebimentos.length ? recebimentos.join("; ") : "o saldo foi nulo em todas as fronteiras com fluxo publicado"}.`,
      `In the ${dias} days through ${f.dataBR(fim)}, ${recebimentos.length ? recebimentos.join("; ") : "the net flow was zero at every boundary with published flow"}.`,
      idioma,
    ),
  ];
  const escondem = comDado.filter((r) => horasContraSaldo(r) > 0);
  if (!escondem.length) {
    frases.push(tx("Em nenhuma fronteira o saldo esconde energia que passou no sentido contrário.", "At no boundary does the net flow hide energy that went the opposite way.", idioma));
  } else {
    const maior = Math.max(...escondem.map((r) => r.contra_saldo_mwh));
    const onde =
      escondem.length === 1
        ? tx("Em uma fronteira", "At one boundary", idioma)
        : tx(`Em ${numeroPorExtenso(escondem.length, "pt")} fronteiras`, `At ${numeroPorExtenso(escondem.length, "en")} boundaries`, idioma);
    frases.push(
      tx(
        `${onde}, o saldo esconde energia que passou no sentido contrário: ${escondem.length === 1 ? "" : "até "}${mwh(maior, idioma)}.`,
        `${onde}, the net flow hides energy that went the opposite way: ${escondem.length === 1 ? "" : "up to "}${mwh(maior, idioma)}.`,
        idioma,
      ),
    );
  }
  return frases.join(" ");
}

/** Preço nas pontas, nas horas da janela de 30 dias: separação descrita, sem diagnóstico. */
export function textoPrecos30d(resumo: readonly ResumoFronteira30d[], idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const partes = resumo
    .filter((r) => r.horas_pld > 0)
    .map((r) => {
      const base = tx(
        `${entreFronteira(r.par, "pt")}, ${f.num(r.horas_precos_separados, 0)} de ${f.num(r.horas_pld, 0)} horas com PLD`,
        `${entreFronteira(r.par, "en")}, ${f.num(r.horas_precos_separados, 0)} of ${f.num(r.horas_pld, 0)} hours with PLD`,
        idioma,
      );
      if (!r.horas_precos_separados) return base;
      return tx(
        `${base} (fluxo do mais barato para o mais caro em ${f.num(r.horas_separados_fluxo_para_mais_caro, 0)}, do mais caro para o mais barato em ${f.num(r.horas_separados_fluxo_para_mais_barato, 0)})`,
        `${base} (flow from the cheaper to the more expensive side in ${f.num(r.horas_separados_fluxo_para_mais_caro, 0)}, from the more expensive to the cheaper side in ${f.num(r.horas_separados_fluxo_para_mais_barato, 0)})`,
        idioma,
      );
    });
  if (!partes.length) return tx("Sem PLD publicado nas horas da janela.", "No PLD published in the hours of the window.", idioma);
  return tx(
    `Horas em que os PLDs das duas pontas diferiram mais de ${f.reais(LIMIAR_PRECOS_RS_MWH)}/MWh na mesma hora do fluxo: ${listaLonga(partes, idioma)}. É descrição da coincidência entre preço e fluxo, não diagnóstico de fronteira no limite.`,
    `Hours in which the PLDs at the two ends differed by more than ${f.reais(LIMIAR_PRECOS_RS_MWH)}/MWh in the same hour as the flow: ${listaLonga(partes, idioma)}. This describes the coincidence of price and flow; it is not a diagnosis of a boundary at its limit.`,
    idioma,
  );
}

/** Sentido do saldo em palavras ("do Nordeste para o Norte"); null quando o saldo é ausente ou nulo. */
export function textoSentidoSaldo(par: FronteiraRede, liquido: number | null | undefined, idioma: Idioma = idiomaEnergia()): string | null {
  const s = sentidoDoSaldo(par, liquido);
  return s ? `${doSm(s.origem, idioma)} ${paraO(s.destino, idioma)}` : null;
}

export type MedidaFronteira30d = {
  par: FronteiraRede;
  /** "Saldo em 30 dias, do Nordeste para o Norte" (sem saldo: "entre Norte e Nordeste"). */
  rotulo: string;
  /** Módulo do saldo em MWh; null sem fluxo publicado na janela (ausência, nunca zero). */
  valor: number | null;
  periodo: string;
  /** O que o saldo esconde: a energia no sentido contrário e as trocas de sentido, ou "fluxo num só sentido". */
  nota: string;
};

/**
 * Medidas da abertura da Rede: o saldo de cada fronteira na janela de 30 dias, em módulo e com o sentido no rótulo, e o que passou no sentido
 * contrário. São os mesmos campos do resumo de 30 dias que alimenta o gráfico dos dois sentidos, a tabela e a exportação.
 */
export function medidasFronteiras30d(resumo: readonly ResumoFronteira30d[], idioma: Idioma = idiomaEnergia()): MedidaFronteira30d[] {
  const f = formatos(idioma);
  return FRONTEIRAS.map((par) => {
    const r = resumo.find((x) => x.par === par);
    if (!r || r.horas === 0) {
      return {
        par,
        rotulo: tx(`Saldo em 30 dias, ${entreFronteira(par, "pt")}`, `Net flow over 30 days, ${entreFronteira(par, "en")}`, idioma),
        valor: null,
        periodo: r ? tx(`${f.dataBR(r.inicio)} a ${f.dataBR(r.fim)}`, `${f.dataBR(r.inicio)} to ${f.dataBR(r.fim)}`, idioma) : "",
        nota: tx("Sem fluxo publicado na janela.", "No flow published in the window.", idioma),
      };
    }
    const sentido = textoSentidoSaldo(par, r.liquido_mwh, idioma);
    const contra =
      horasContraSaldo(r) === 0
        ? tx(`Fluxo num só sentido nas ${f.num(r.horas, 0)} horas.`, `Flow in one direction only over the ${f.num(r.horas, 0)} hours.`, idioma)
        : tx(`No sentido contrário: ${mwh(r.contra_saldo_mwh, idioma)}.`, `Opposite direction: ${mwh(r.contra_saldo_mwh, idioma)}.`, idioma);
    const trocas =
      r.dias_com_reversao > 0
        ? tx(
            ` Troca de sentido em ${f.num(r.dias_com_reversao, 0)} de ${f.num(r.dias, 0)} dias.`,
            ` Change of direction on ${f.num(r.dias_com_reversao, 0)} of ${f.num(r.dias, 0)} days.`,
            idioma,
          )
        : "";
    return {
      par,
      rotulo: tx(
        `Saldo em ${f.plural(r.dias, "dia", "dias")}, ${sentido ?? entreFronteira(par, "pt")}`,
        `Net flow over ${f.plural(r.dias, "day", "days")}, ${sentido ?? entreFronteira(par, "en")}`,
        idioma,
      ),
      valor: Math.abs(r.liquido_mwh),
      periodo: tx(`${f.dataBR(r.inicio)} a ${f.dataBR(r.fim)}`, `${f.dataBR(r.inicio)} to ${f.dataBR(r.fim)}`, idioma),
      nota: `${contra}${trocas}`,
    };
  });
}

/** Fronteira mostrada no detalhe quando nenhuma foi escolhida: a com mais energia escondida pelo saldo em 30 dias. */
export function fronteiraDestaque(resumo: readonly ResumoFronteira30d[]): FronteiraRede {
  let melhor: ResumoFronteira30d | null = null;
  for (const r of resumo) if (!melhor || r.contra_saldo_mwh > melhor.contra_saldo_mwh) melhor = r;
  return melhor?.par ?? FRONTEIRAS[0];
}

export type LinhaResumo30d = {
  id: FronteiraRede;
  fronteira: string;
  inicio: string;
  fim: string;
  dias_completos: number;
  horas: number;
  sentido_saldo: string;
  liquido_mwh: number;
  canonico_mwh: number;
  inverso_mwh: number;
  contra_saldo_mwh: number;
  contra_saldo_dias_mwh: number;
  horas_canonico: number;
  horas_inverso: number;
  dias_com_reversao: number;
  horas_pld: number;
  horas_precos_separados: number;
  horas_fluxo_para_mais_caro: number;
  horas_fluxo_para_mais_barato: number;
};

/** O resumo de 30 dias por fronteira (os números de destaque e a resposta saem destas linhas). */
export function linhasResumo30d(resumo: readonly ResumoFronteira30d[], idioma: Idioma = idiomaEnergia()): LinhaResumo30d[] {
  return resumo.map((r) => ({
    id: r.par,
    fronteira: nomeFronteira(r.par, idioma),
    inicio: r.inicio,
    fim: r.fim,
    dias_completos: r.dias_completos,
    horas: r.horas,
    sentido_saldo: rotuloSentidoSaldo(r.par, r.liquido_mwh, idioma),
    liquido_mwh: r.liquido_mwh,
    canonico_mwh: r.canonico_mwh,
    inverso_mwh: r.inverso_mwh,
    contra_saldo_mwh: r.contra_saldo_mwh,
    contra_saldo_dias_mwh: r.contra_saldo_dias_mwh,
    horas_canonico: r.horas_canonico,
    horas_inverso: r.horas_inverso,
    dias_com_reversao: r.dias_com_reversao,
    horas_pld: r.horas_pld,
    horas_precos_separados: r.horas_precos_separados,
    horas_fluxo_para_mais_caro: r.horas_separados_fluxo_para_mais_caro,
    horas_fluxo_para_mais_barato: r.horas_separados_fluxo_para_mais_barato,
  }));
}

export function colunasResumo30d(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "fronteira", rotulo: tx("Fronteira (sentido positivo)", "Boundary (positive direction)", idioma), tipo: "texto" },
    { id: "sentido_saldo", rotulo: tx("Sentido do saldo", "Direction of the net flow", idioma), tipo: "texto" },
    { id: "liquido_mwh", rotulo: tx("Saldo em 30 dias", "Net flow over 30 days", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "canonico_mwh", rotulo: tx("No sentido da fronteira", "In the boundary direction", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "inverso_mwh", rotulo: tx("No sentido contrário", "In the opposite direction", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "contra_saldo_mwh", rotulo: tx("Escondida pelo saldo de 30 dias", "Hidden by the 30-day net flow", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "contra_saldo_dias_mwh", rotulo: tx("Escondida pelos saldos diários", "Hidden by the daily net flows", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas_canonico", rotulo: tx("Horas no sentido da fronteira", "Hours in the boundary direction", idioma), tipo: "numero", casas: 0 },
    { id: "horas_inverso", rotulo: tx("Horas no sentido contrário", "Hours in the opposite direction", idioma), tipo: "numero", casas: 0 },
    { id: "dias_com_reversao", rotulo: tx("Dias com troca de sentido", "Days with a change of direction", idioma), tipo: "numero", casas: 0 },
    { id: "horas", rotulo: tx("Horas com fluxo", "Hours with flow", idioma), tipo: "numero", casas: 0 },
    { id: "dias_completos", rotulo: tx("Dias com as 24 horas", "Days with all 24 hours", idioma), tipo: "numero", casas: 0 },
    { id: "horas_pld", rotulo: tx("Horas com PLD nas duas pontas", "Hours with PLD at both ends", idioma), tipo: "numero", casas: 0 },
    { id: "horas_precos_separados", rotulo: tx("Horas com PLDs diferentes", "Hours with different PLDs", idioma), tipo: "numero", casas: 0 },
    { id: "horas_fluxo_para_mais_caro", rotulo: tx("Dessas, fluxo para o mais caro", "Of these, flow toward the more expensive side", idioma), tipo: "numero", casas: 0 },
    { id: "horas_fluxo_para_mais_barato", rotulo: tx("Dessas, fluxo para o mais barato", "Of these, flow toward the cheaper side", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_RESUMO_30D: ColunaTabela[] = colunasResumo30d("pt");

export type LinhaFronteiraDia = {
  id: FronteiraRede;
  fronteira: string;
  dia: string;
  sentido_saldo: string;
  liquido_mwh: number | null;
  canonico_mwh: number | null;
  inverso_mwh: number | null;
  contra_saldo_mwh: number | null;
  horas: number | null;
  horas_inverso: number | null;
  reversoes: number | null;
  horas_precos_separados: number | null;
  horas_fluxo_para_mais_caro: number | null;
  horas_fluxo_para_mais_barato: number | null;
};

/** Uma linha por fronteira no dia escolhido (mapa, tabela e exportação usam as mesmas linhas). */
export function linhasFronteirasDia(c: Pick<CirculacaoRede, "diario">, dia: string, idioma: Idioma = idiomaEnergia()): LinhaFronteiraDia[] {
  const i = c.diario.dias.indexOf(dia);
  return FRONTEIRAS.map((par) => {
    const s = c.diario.por_par[par];
    const v = (k: keyof typeof s) => (i >= 0 ? (s[k][i] ?? null) : null);
    return {
      id: par,
      fronteira: nomeFronteira(par, idioma),
      dia,
      sentido_saldo: rotuloSentidoSaldo(par, v("liquido_mwh"), idioma),
      liquido_mwh: v("liquido_mwh"),
      canonico_mwh: v("canonico_mwh"),
      inverso_mwh: v("inverso_mwh"),
      contra_saldo_mwh: v("contra_saldo_mwh"),
      horas: v("horas"),
      horas_inverso: v("horas_inverso"),
      reversoes: v("reversoes"),
      horas_precos_separados: v("horas_precos_separados"),
      horas_fluxo_para_mais_caro: v("horas_separados_fluxo_para_mais_caro"),
      horas_fluxo_para_mais_barato: v("horas_separados_fluxo_para_mais_barato"),
    };
  });
}

export function colunasFronteirasDia(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "fronteira", rotulo: tx("Fronteira (sentido positivo)", "Boundary (positive direction)", idioma), tipo: "texto" },
    { id: "sentido_saldo", rotulo: tx("Sentido do saldo", "Direction of the net flow", idioma), tipo: "texto" },
    { id: "liquido_mwh", rotulo: tx("Saldo", "Net flow", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "canonico_mwh", rotulo: tx("No sentido da fronteira", "In the boundary direction", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "inverso_mwh", rotulo: tx("No sentido contrário", "In the opposite direction", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "contra_saldo_mwh", rotulo: tx("Escondida pelo saldo", "Hidden by the net flow", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas", rotulo: tx("Horas com fluxo publicado", "Hours with published flow", idioma), tipo: "numero", casas: 0 },
    { id: "horas_inverso", rotulo: tx("Horas no sentido contrário", "Hours in the opposite direction", idioma), tipo: "numero", casas: 0 },
    { id: "reversoes", rotulo: tx("Trocas de sentido", "Changes of direction", idioma), tipo: "numero", casas: 0 },
    { id: "horas_precos_separados", rotulo: tx("Horas com PLDs diferentes nas pontas", "Hours with different PLDs at the ends", idioma), tipo: "numero", casas: 0 },
    { id: "horas_fluxo_para_mais_caro", rotulo: tx("Dessas, fluxo para o mais caro", "Of these, flow toward the more expensive side", idioma), tipo: "numero", casas: 0 },
    { id: "horas_fluxo_para_mais_barato", rotulo: tx("Dessas, fluxo para o mais barato", "Of these, flow toward the cheaper side", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_FRONTEIRAS_DIA: ColunaTabela[] = colunasFronteirasDia("pt");

/** Resposta do dia escolhido: uma fronteira (selecionada) ou as quatro. */
export function respostaDia(linhas: readonly LinhaFronteiraDia[], par: FronteiraRede | null, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const dia = linhas[0]?.dia ?? "";
  const alvo = par ? linhas.filter((l) => l.id === par) : linhas;
  const partes = alvo.map((l) => {
    if (l.liquido_mwh === null || l.horas === null || l.horas === 0)
      return tx(`${entreFronteira(l.id, "pt")}, sem fluxo publicado`, `${entreFronteira(l.id, "en")}, no flow published`, idioma);
    const s = sentidoDoSaldo(l.id, l.liquido_mwh);
    const saldo = s
      ? `${mwh(Math.abs(l.liquido_mwh), idioma)} ${doSm(s.origem, idioma)} ${paraO(s.destino, idioma)}`
      : tx(`saldo nulo ${entreFronteira(l.id, "pt")}`, `zero net flow ${entreFronteira(l.id, "en")}`, idioma);
    const escondida = l.contra_saldo_mwh
      ? tx(`, com ${mwh(l.contra_saldo_mwh, idioma)} no sentido contrário`, `, with ${mwh(l.contra_saldo_mwh, idioma)} in the opposite direction`, idioma)
      : "";
    const trocas =
      par && l.reversoes
        ? tx(
            ` e ${f.plural(l.reversoes, "troca", "trocas")} de sentido entre horas seguidas`,
            ` and ${f.plural(l.reversoes, "change", "changes")} of direction between consecutive hours`,
            idioma,
          )
        : "";
    const incompleto = l.horas < 24 ? tx(` (${l.horas} de 24 horas publicadas)`, ` (${l.horas} of 24 hours published)`, idioma) : "";
    return `${saldo}${escondida}${trocas}${incompleto}`;
  });
  return tx(`Em ${f.dataBR(dia)}: ${listaLonga(partes, idioma)}.`, `On ${f.dataBR(dia)}: ${listaLonga(partes, idioma)}.`, idioma);
}

export type LinhaDiaFronteira = {
  id: string;
  d: string;
  canonico_mwh: number | null;
  inverso_mwh: number | null;
  liquido_mwh: number | null;
  contra_saldo_mwh: number | null;
  horas: number | null;
  horas_inverso: number | null;
  reversoes: number | null;
  horas_precos_separados: number | null;
};

/** Os 30 dias de uma fronteira: energia em cada sentido, saldo e o que ele esconde. */
export function linhasDiarioFronteira(c: Pick<CirculacaoRede, "diario">, par: FronteiraRede): LinhaDiaFronteira[] {
  const s = c.diario.por_par[par];
  return c.diario.dias.map((d, i) => ({
    id: d,
    d,
    canonico_mwh: s.canonico_mwh[i] ?? null,
    inverso_mwh: s.inverso_mwh[i] ?? null,
    liquido_mwh: s.liquido_mwh[i] ?? null,
    contra_saldo_mwh: s.contra_saldo_mwh[i] ?? null,
    horas: s.horas[i] ?? null,
    horas_inverso: s.horas_inverso[i] ?? null,
    reversoes: s.reversoes[i] ?? null,
    horas_precos_separados: s.horas_precos_separados[i] ?? null,
  }));
}

export function colunasDiarioFronteira(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "d", rotulo: tx("Dia", "Day", idioma), tipo: "data" },
    { id: "canonico_mwh", rotulo: tx("No sentido da fronteira", "In the boundary direction", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "inverso_mwh", rotulo: tx("No sentido contrário", "In the opposite direction", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "liquido_mwh", rotulo: tx("Saldo", "Net flow", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "contra_saldo_mwh", rotulo: tx("Escondida pelo saldo", "Hidden by the net flow", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas", rotulo: tx("Horas com fluxo", "Hours with flow", idioma), tipo: "numero", casas: 0 },
    { id: "horas_inverso", rotulo: tx("Horas no sentido contrário", "Hours in the opposite direction", idioma), tipo: "numero", casas: 0 },
    { id: "reversoes", rotulo: tx("Trocas de sentido", "Changes of direction", idioma), tipo: "numero", casas: 0 },
    { id: "horas_precos_separados", rotulo: tx("Horas com PLDs diferentes", "Hours with different PLDs", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_DIARIO_FRONTEIRA: ColunaTabela[] = colunasDiarioFronteira("pt");

/** Saldo diário das fronteiras escolhidas (até quatro), uma coluna por fronteira. */
export function linhasSaldoDiario(c: Pick<CirculacaoRede, "diario">, pares: readonly FronteiraRede[]): ({ id: string; d: string } & Partial<Record<FronteiraRede, number | null>>)[] {
  return c.diario.dias.map((d, i) => ({ id: d, d, ...Object.fromEntries(pares.map((p) => [p, c.diario.por_par[p].liquido_mwh[i] ?? null])) }));
}

export type LinhaMesFronteira = {
  id: string;
  m: string;
  canonico_mwh: number | null;
  inverso_mwh: number | null;
  liquido_mwh: number | null;
  contra_saldo_dias_mwh: number | null;
  horas: number | null;
  horas_calendario: number | null;
  mes_completo: string;
  horas_inverso: number | null;
  horas_precos_separados: number | null;
};

/** Meses desde 2021 de uma fronteira; mês com menos horas que o calendário é marcado. */
export function linhasMensalFronteira(c: Pick<CirculacaoRede, "mensal">, par: FronteiraRede, idioma: Idioma = idiomaEnergia()): LinhaMesFronteira[] {
  const f = formatos(idioma);
  const s = c.mensal.por_par[par];
  return c.mensal.meses.map((m, i) => {
    const h = s.horas[i] ?? null;
    const cal = c.mensal.horas_calendario[i] ?? null;
    return {
      id: m,
      m,
      canonico_mwh: s.canonico_mwh[i] ?? null,
      inverso_mwh: s.inverso_mwh[i] ?? null,
      liquido_mwh: s.liquido_mwh[i] ?? null,
      contra_saldo_dias_mwh: s.contra_saldo_dias_mwh[i] ?? null,
      horas: h,
      horas_calendario: cal,
      mes_completo:
        h !== null && cal !== null && h === cal
          ? tx("sim", "yes", idioma)
          : tx(`não (${f.num(h, 0)} de ${f.num(cal, 0)} horas)`, `no (${f.num(h, 0)} of ${f.num(cal, 0)} hours)`, idioma),
      horas_inverso: s.horas_inverso[i] ?? null,
      horas_precos_separados: s.horas_precos_separados[i] ?? null,
    };
  });
}

export function colunasMensalFronteira(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "data" },
    { id: "canonico_mwh", rotulo: tx("No sentido da fronteira", "In the boundary direction", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "inverso_mwh", rotulo: tx("No sentido contrário", "In the opposite direction", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "liquido_mwh", rotulo: tx("Saldo", "Net flow", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "contra_saldo_dias_mwh", rotulo: tx("Escondida pelos saldos diários", "Hidden by the daily net flows", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas", rotulo: tx("Horas com fluxo", "Hours with flow", idioma), tipo: "numero", casas: 0 },
    { id: "horas_calendario", rotulo: tx("Horas do mês", "Hours in the month", idioma), tipo: "numero", casas: 0 },
    { id: "mes_completo", rotulo: tx("Mês completo", "Complete month", idioma), tipo: "texto", categorica: true },
    { id: "horas_inverso", rotulo: tx("Horas no sentido contrário", "Hours in the opposite direction", idioma), tipo: "numero", casas: 0 },
    { id: "horas_precos_separados", rotulo: tx("Horas com PLDs diferentes", "Hours with different PLDs", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_MENSAL_FRONTEIRA: ColunaTabela[] = colunasMensalFronteira("pt");

/** Colunas da tabela equivalente aos saldos das fronteiras escolhidas (dia ou mês e uma coluna por fronteira). */
export function colunasSaldoFronteiras(chave: "d" | "m", pares: readonly FronteiraRede[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: chave, rotulo: chave === "d" ? tx("Dia", "Day", idioma) : tx("Mês", "Month", idioma), tipo: "data" },
    ...pares.map(
      (p): ColunaTabela => ({
        id: p,
        rotulo: tx(`Saldo ${curtoFronteira(p, "pt")} (positivo no sentido do nome)`, `Net flow ${curtoFronteira(p, "en")} (positive in the direction of the name)`, idioma),
        tipo: "numero",
        unidade: "MWh",
        casas: 0,
      }),
    ),
  ];
}

/** Saldo mensal das fronteiras escolhidas. */
export function linhasSaldoMensal(c: Pick<CirculacaoRede, "mensal">, pares: readonly FronteiraRede[]): ({ id: string; m: string } & Partial<Record<FronteiraRede, number | null>>)[] {
  return c.mensal.meses.map((m, i) => ({ id: m, m, ...Object.fromEntries(pares.map((p) => [p, c.mensal.por_par[p].liquido_mwh[i] ?? null])) }));
}

export type LinhaSubsistemaDia = {
  id: Submercado;
  subsistema: string;
  exportacao_bruta_mwh: number | null;
  importacao_bruta_mwh: number | null;
  liquido_mwh: number | null;
  horas_transito: number | null;
};

/** Exportação e importação brutas de cada subsistema no dia (o Sul inclui Argentina e Uruguai). */
export function linhasSubsistemasDia(c: Pick<CirculacaoRede, "subsistemas_diario">, dia: string, idioma: Idioma = idiomaEnergia()): LinhaSubsistemaDia[] {
  const i = c.subsistemas_diario.dias.indexOf(dia);
  return SUBSISTEMAS.map((sm) => {
    const s = c.subsistemas_diario.por_sm[sm];
    const v = (k: keyof typeof s) => (i >= 0 ? (s[k][i] ?? null) : null);
    return {
      id: sm,
      subsistema: nomeSm(sm, idioma),
      exportacao_bruta_mwh: v("exportacao_bruta_mwh"),
      importacao_bruta_mwh: v("importacao_bruta_mwh"),
      liquido_mwh: v("liquido_mwh"),
      horas_transito: v("horas_transito"),
    };
  });
}

export function colunasSubsistemasDia(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "subsistema", rotulo: tx("Subsistema", "Subsystem", idioma), tipo: "texto" },
    { id: "exportacao_bruta_mwh", rotulo: tx("Exportação bruta", "Gross export", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "importacao_bruta_mwh", rotulo: tx("Importação bruta", "Gross import", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "liquido_mwh", rotulo: tx("Saldo (positivo = exporta)", "Net (positive = exports)", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas_transito", rotulo: tx("Horas de trânsito", "Transit hours", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_SUBSISTEMAS_DIA: ColunaTabela[] = colunasSubsistemasDia("pt");

/** Quem exportou e quem importou no dia, pelo saldo das fronteiras (e do exterior, no Sul). */
export function respostaSubsistemasDia(linhas: readonly LinhaSubsistemaDia[], dia: string, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const exp = linhas.filter((l) => (l.liquido_mwh ?? 0) > 0);
  const imp = linhas.filter((l) => (l.liquido_mwh ?? 0) < 0);
  const sem = linhas.filter((l) => l.liquido_mwh === null);
  const transito = linhas.filter((l) => (l.horas_transito ?? 0) > 0);
  const listaExp = listaTexto(
    exp.map((l) => `${nomeSm(l.id, idioma)} (${mwh(l.liquido_mwh, idioma)})`),
    idioma,
  );
  const listaImp = listaTexto(
    imp.map((l) => `${nomeSm(l.id, idioma)} (${mwh(Math.abs(l.liquido_mwh!), idioma)})`),
    idioma,
  );
  const partes = [
    exp.length ? tx(`exportaram ${listaExp}`, `exporters: ${listaExp}`, idioma) : tx("nenhum subsistema exportou", "no subsystem exported", idioma),
    imp.length ? tx(`importaram ${listaImp}`, `importers: ${listaImp}`, idioma) : tx("nenhum importou", "none imported", idioma),
  ];
  let t = tx(`Em ${f.dataBR(dia)}, ${partes.join("; ")}.`, `On ${f.dataBR(dia)}, ${partes.join("; ")}.`, idioma);
  if (transito.length) {
    const lista = listaTexto(
      transito.map((l) =>
        tx(
          `${NO[l.id]} em ${f.plural(l.horas_transito!, "hora", "horas")}`,
          `${noSm(l.id, "en")} in ${f.plural(l.horas_transito!, "hour", "hours")}`,
          idioma,
        ),
      ),
      idioma,
    );
    t += tx(
      ` Houve trânsito (exportar por uma fronteira e importar por outra na mesma hora) ${lista}.`,
      ` There was transit (exporting through one boundary and importing through another in the same hour) ${lista}.`,
      idioma,
    );
  }
  if (sem.length) {
    const lista = listaTexto(
      sem.map((l) => nomeSm(l.id, idioma)),
      idioma,
    );
    t += tx(` Sem dado para ${lista}.`, ` No data for ${lista}.`, idioma);
  }
  return t;
}

/* ---------- janela horária (sob demanda) ---------- */

/** Índice da hora pedida na janela; senão a última hora. */
export function indiceHora(j: Pick<JanelaHorariaRede, "horas">, pedida: string): number {
  const i = pedida ? j.horas.indexOf(pedida) : -1;
  return i >= 0 ? i : j.horas.length - 1;
}

/** Dias da janela horária (para a escolha em dois passos: dia e hora). */
export function diasDaJanela(j: Pick<JanelaHorariaRede, "horas">): string[] {
  return Array.from(new Set(j.horas.map((h) => h.slice(0, 10))));
}

export type LinhaHoraFronteira = {
  id: FronteiraRede;
  fronteira: string;
  hora: string;
  fluxo_mwmed: number | null;
  sentido_fluxo: string;
  programado_mwmed: number | null;
  sentido_programado: string;
  pld_de: number | null;
  pld_para: number | null;
};

/** Uma linha por fronteira na hora escolhida: fluxo, programa e PLD das duas pontas na mesma hora. */
export function linhasHora(j: JanelaHorariaRede, i: number, idioma: Idioma = idiomaEnergia()): LinhaHoraFronteira[] {
  const hora = j.horas[i] ?? "";
  return FRONTEIRAS.map((par) => {
    const [a, b] = PONTAS[par];
    const f = j.fluxo[par]?.[i] ?? null;
    const p = j.programado[par]?.[i] ?? null;
    return {
      id: par,
      fronteira: nomeFronteira(par, idioma),
      hora,
      fluxo_mwmed: f,
      sentido_fluxo: rotuloSentidoSaldo(par, f, idioma),
      programado_mwmed: p,
      sentido_programado: rotuloSentidoSaldo(par, p, idioma),
      pld_de: j.pld[a]?.[i] ?? null,
      pld_para: j.pld[b]?.[i] ?? null,
    };
  });
}

export function colunasHora(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "fronteira", rotulo: tx("Fronteira (sentido positivo)", "Boundary (positive direction)", idioma), tipo: "texto" },
    { id: "fluxo_mwmed", rotulo: tx("Fluxo verificado", "Verified flow", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "sentido_fluxo", rotulo: tx("Sentido do fluxo", "Flow direction", idioma), tipo: "texto" },
    { id: "programado_mwmed", rotulo: tx("Programado", "Scheduled", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "sentido_programado", rotulo: tx("Sentido programado", "Scheduled direction", idioma), tipo: "texto" },
    { id: "pld_de", rotulo: tx("PLD na primeira região", "PLD in the first region", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "pld_para", rotulo: tx("PLD na segunda região", "PLD in the second region", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}
export const COLUNAS_HORA: ColunaTabela[] = colunasHora("pt");

/** Resposta da hora escolhida para uma fronteira (fluxo, programa e PLD na mesma hora). */
export function respostaHora(linhas: readonly LinhaHoraFronteira[], par: FronteiraRede, exterior?: Partial<Record<PaisSul, number | null>>, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const l = linhas.find((x) => x.id === par);
  if (!l) return "";
  const [a, b] = PONTAS[par];
  const quando = l.hora ? f.horaLocal(l.hora) : tx("sem hora", "no hour", idioma);
  const sentido = (v: number) => (v > 0 ? sentidoPositivo(par, idioma) : sentidoNegativo(par, idioma));
  const fluxo =
    l.fluxo_mwmed === null
      ? tx(`${entreFronteira(par, "pt")}, sem fluxo publicado`, `${entreFronteira(par, "en")}, no flow published`, idioma)
      : l.fluxo_mwmed === 0
        ? tx(`${entreFronteira(par, "pt")}, fluxo nulo`, `${entreFronteira(par, "en")}, zero flow`, idioma)
        : tx(`passavam ${mwmed(Math.abs(l.fluxo_mwmed), 0, idioma)} ${sentido(l.fluxo_mwmed)}`, `${mwmed(Math.abs(l.fluxo_mwmed), 0, idioma)} were flowing ${sentido(l.fluxo_mwmed)}`, idioma);
  let prog: string;
  if (l.programado_mwmed === null) prog = tx("sem programa publicado para a hora", "no schedule published for the hour", idioma);
  else if (l.fluxo_mwmed !== null && l.fluxo_mwmed !== 0 && l.programado_mwmed !== 0 && Math.sign(l.programado_mwmed) !== Math.sign(l.fluxo_mwmed))
    prog = tx(
      `o programa previa ${mwmed(Math.abs(l.programado_mwmed), 0, idioma)} no sentido contrário`,
      `the schedule expected ${mwmed(Math.abs(l.programado_mwmed), 0, idioma)} in the opposite direction`,
      idioma,
    );
  else if (l.programado_mwmed === 0) prog = tx("o programa previa fluxo nulo", "the schedule expected zero flow", idioma);
  else
    prog = tx(
      `o programa previa ${mwmed(Math.abs(l.programado_mwmed), 0, idioma)} ${sentido(l.programado_mwmed)}`,
      `the schedule expected ${mwmed(Math.abs(l.programado_mwmed), 0, idioma)} ${sentido(l.programado_mwmed)}`,
      idioma,
    );
  const pld = tx(
    `PLD na mesma hora: ${f.reais(l.pld_de)}/MWh ${NO[a]} e ${f.reais(l.pld_para)}/MWh ${NO[b]}`,
    `PLD in the same hour: ${f.reais(l.pld_de)}/MWh ${noSm(a, "en")} and ${f.reais(l.pld_para)}/MWh ${noSm(b, "en")}`,
    idioma,
  );
  let ext = "";
  if (par === "S_SE" && exterior) {
    const partes = PAISES_SUL.map((p) => {
      const v = exterior[p];
      return v === null || v === undefined
        ? tx(`${NOME_PAIS[p]} sem dado`, `${NOME_PAIS_EN[p]} no data`, idioma)
        : v === 0
          ? tx(`${NOME_PAIS[p]} sem fluxo`, `${NOME_PAIS_EN[p]} no flow`, idioma)
          : tx(
              `${NOME_PAIS[p]} ${mwmed(Math.abs(v), 0, idioma)} (${v > 0 ? "exportação" : "importação"})`,
              `${NOME_PAIS_EN[p]} ${mwmed(Math.abs(v), 0, idioma)} (${v > 0 ? "export" : "import"})`,
              idioma,
            );
    });
    ext = tx(` Exterior do Sul na hora: ${listaTexto(partes, "pt")}.`, ` South exterior in the hour: ${listaTexto(partes, "en")}.`, idioma);
  }
  return tx(`Em ${quando}, ${fluxo}; ${prog}. ${pld}.${ext}`, `At ${quando}, ${fluxo}; ${prog}. ${pld}.${ext}`, idioma);
}

export type LinhaJanela = { id: string; h: string; fluxo: number | null; programado: number | null; pld_de: number | null; pld_para: number | null };

/** As 168 horas de uma fronteira: fluxo, programa e PLD das pontas (dois gráficos alinhados e a mesma tabela). */
export function serieJanela(j: JanelaHorariaRede, par: FronteiraRede): LinhaJanela[] {
  const [a, b] = PONTAS[par];
  return j.horas.map((h, i) => ({
    id: h,
    h,
    fluxo: j.fluxo[par]?.[i] ?? null,
    programado: j.programado[par]?.[i] ?? null,
    pld_de: j.pld[a]?.[i] ?? null,
    pld_para: j.pld[b]?.[i] ?? null,
  }));
}

export function colunasJanela(par: FronteiraRede, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const [a, b] = PONTAS[par];
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "h", rotulo: tx("Hora (início, Brasília)", "Hour (start, Brasília)", idioma), tipo: "data" },
    { id: "fluxo", rotulo: tx(`Fluxo verificado, positivo ${sentidoPositivo(par, "pt")}`, `Verified flow, positive ${sentidoPositivo(par, "en")}`, idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "programado", rotulo: tx("Programado, mesmo sinal", "Scheduled, same sign", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "pld_de", rotulo: `PLD ${noSm(a, idioma)}`, tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "pld_para", rotulo: `PLD ${noSm(b, idioma)}`, tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}

/* ---------- auditoria do P028: esquema da fonte, cobertura e outro coletor ---------- */

export type LinhaEsquemaNacional = {
  id: string;
  recurso: string;
  linhas: number;
  orientacao: string;
  orientacoes: string;
  tem_programado: string;
  verificado_negativo: number;
  verificado_zero: number;
  primeira: string | null;
  ultima: string | null;
  conflitos: number;
};

/** Como cada arquivo anual publicou as fronteiras (orientação fixa com sinal ou pelo sentido da hora). */
export function linhasEsquemaNacional(e: Pick<EsquemaFonteRede, "intercambio_nacional">, idioma: Idioma = idiomaEnergia()): LinhaEsquemaNacional[] {
  const f = formatos(idioma);
  return e.intercambio_nacional.map((x) => ({
    id: x.recurso,
    recurso: x.recurso,
    linhas: x.linhas,
    orientacao: x.orientacao_fixa ? tx("fixa, valor com sinal", "fixed, signed value", idioma) : tx("pelo sentido do fluxo da hora", "by the direction of the hour's flow", idioma),
    orientacoes: Object.entries(x.orientacoes)
      .map(([o, n]) => `${o.replace("->", "→")}: ${f.num(n, 0)}`)
      .join("; "),
    tem_programado: simNao(x.tem_programado, idioma),
    verificado_negativo: x.verificado_negativo,
    verificado_zero: x.verificado_zero,
    primeira: x.primeira,
    ultima: x.ultima,
    conflitos: x.conflitos,
  }));
}

/** Quais arquivos anuais usam orientação fixa com sinal e quais orientam a linha pelo sentido da hora, lido do esquema publicado. */
export function textoOrientacaoArquivos(e: Pick<EsquemaFonteRede, "intercambio_nacional">, idioma: Idioma = idiomaEnergia()): string {
  const ano = (r: string) => r.replace(/\D/g, "");
  const fixa = e.intercambio_nacional.filter((x) => x.orientacao_fixa).map((x) => ano(x.recurso));
  const hora = e.intercambio_nacional.filter((x) => !x.orientacao_fixa).map((x) => ano(x.recurso));
  const partes: string[] = [];
  if (fixa.length)
    partes.push(
      tx(
        `${fixa.length === 1 ? "o arquivo de" : "os arquivos de"} ${listaTexto(fixa, "pt")} ${fixa.length === 1 ? "usa" : "usam"} orientação fixa com valor com sinal`,
        `${fixa.length === 1 ? "the file for" : "the files for"} ${listaTexto(fixa, "en")} ${fixa.length === 1 ? "uses" : "use"} a fixed orientation with a signed value`,
        idioma,
      ),
    );
  if (hora.length)
    partes.push(
      tx(
        `${hora.length === 1 ? "o de" : "os de"} ${listaTexto(hora, "pt")} ${hora.length === 1 ? "orienta" : "orientam"} cada linha pelo sentido do fluxo da hora`,
        `${hora.length === 1 ? "the one for" : "those for"} ${listaTexto(hora, "en")} ${hora.length === 1 ? "orients" : "orient"} each row by the direction of the hour's flow`,
        idioma,
      ),
    );
  return partes.length ? `${cap(partes.join("; "))}.` : tx("Nenhum arquivo do conjunto foi lido nesta publicação.", "No file of the dataset was read in this release.", idioma);
}

export function colunasEsquemaNacional(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "recurso", rotulo: tx("Arquivo do ONS", "ONS file", idioma), tipo: "texto" },
    { id: "linhas", rotulo: tx("Linhas", "Rows", idioma), tipo: "numero", casas: 0 },
    { id: "orientacao", rotulo: tx("Orientação das linhas", "Row orientation", idioma), tipo: "texto", categorica: true },
    { id: "orientacoes", rotulo: tx("Linhas por orientação publicada", "Rows by published orientation", idioma), tipo: "texto" },
    { id: "tem_programado", rotulo: tx("Traz programado", "Includes scheduled", idioma), tipo: "texto", categorica: true },
    { id: "verificado_negativo", rotulo: tx("Verificado negativo", "Negative verified", idioma), tipo: "numero", casas: 0 },
    { id: "verificado_zero", rotulo: tx("Verificado zero", "Zero verified", idioma), tipo: "numero", casas: 0 },
    { id: "primeira", rotulo: tx("Primeira hora", "First hour", idioma), tipo: "data" },
    { id: "ultima", rotulo: tx("Última hora", "Last hour", idioma), tipo: "data" },
    { id: "conflitos", rotulo: tx("Horas com duas linhas da mesma fronteira", "Hours with two rows for the same boundary", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_ESQUEMA_NACIONAL: ColunaTabela[] = colunasEsquemaNacional("pt");

export type LinhaCobertura = { id: string; dia: string; horas_min: number; horas_max: number; por_serie: string };

/** Dias sem as 24 horas em alguma série: mínimo e máximo de horas e as horas de cada série. */
export function linhasCobertura(c: CoberturaFonte, idioma: Idioma = idiomaEnergia()): LinhaCobertura[] {
  return c.lista.map((d) => ({
    id: d.dia,
    dia: d.dia,
    horas_min: d.horas,
    horas_max: d.horas_max,
    por_serie: Object.entries(d.por_serie)
      .map(([k, n]) => {
        const nome = k in NOME_PAIS ? nomePais(k as PaisRede, idioma) : ehFronteira(k) ? curtoFronteira(k, idioma) : k in CURTO_SM ? curtoSm(k as SubsistemaOuSin, idioma) : k;
        return `${nome}: ${n}`;
      })
      .join("; "),
  }));
}

export function colunasCobertura(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "dia", rotulo: tx("Dia", "Day", idioma), tipo: "data" }, // i18n: dado
    { id: "horas_min", rotulo: tx("Menor número de horas entre as séries", "Smallest number of hours among the series", idioma), tipo: "numero", casas: 0 },
    { id: "horas_max", rotulo: tx("Maior número de horas entre as séries", "Largest number of hours among the series", idioma), tipo: "numero", casas: 0 },
    { id: "por_serie", rotulo: tx("Horas por série", "Hours by series", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_COBERTURA: ColunaTabela[] = colunasCobertura("pt");

/** Resumo da cobertura de uma fonte (dias incompletos, sem nenhum dado e parciais). */
export function textoCobertura(nome: string, c: CoberturaFonte, periodo: { inicio: string; fim: string }, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  if (!c.dias_incompletos)
    return tx(
      `${nome}: todos os dias de ${f.dataBR(periodo.inicio)} a ${f.dataBR(periodo.fim)} têm as 24 horas em todas as séries.`,
      `${nome}: every day from ${f.dataBR(periodo.inicio)} to ${f.dataBR(periodo.fim)} has all 24 hours in every series.`,
      idioma,
    );
  return tx(
    `${nome}: ${f.plural(c.dias_incompletos, "dia", "dias")} sem as 24 horas em alguma série de ${f.dataBR(periodo.inicio)} a ${f.dataBR(periodo.fim)} (${f.plural(c.dias_sem_nenhum_dado, "dia sem nenhum dado", "dias sem nenhum dado")} e ${f.plural(c.dias_parciais, "dia parcial", "dias parciais")}). Hora ausente fica fora das somas; nenhuma é preenchida.`,
    `${nome}: ${f.plural(c.dias_incompletos, "day", "days")} without all 24 hours in some series from ${f.dataBR(periodo.inicio)} to ${f.dataBR(periodo.fim)} (${f.plural(c.dias_sem_nenhum_dado, "day with no data", "days with no data")} and ${f.plural(c.dias_parciais, "partial day", "partial days")}). A missing hour is left out of the sums; none is filled in.`,
    idioma,
  );
}

/** Releitura contra o silver principal (outro coletor e outro parser), em uma frase. */
export function textoConferenciaSilver(nome: string, c: ConferenciaSilver | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!c) return tx(`${nome}: conferência com o silver principal não executada nesta publicação.`, `${nome}: check against the main silver not run in this release.`, idioma);
  const f = formatos(idioma);
  const dif = c.diferentes_no_mesmo_arquivo + c.diferentes_por_revisao;
  const ex = c.exemplo_divergencia
    ? tx(
        ` Primeira divergência: ${c.exemplo_divergencia[0]}, ${f.num(c.exemplo_divergencia[1], 3)} contra ${f.num(c.exemplo_divergencia[2], 3)}.`,
        ` First divergence: ${c.exemplo_divergencia[0]}, ${f.num(c.exemplo_divergencia[1], 3)} against ${f.num(c.exemplo_divergencia[2], 3)}.`,
        idioma,
      )
    : "";
  return tx(
    `${nome}: ${f.num(c.horas_comparadas, 0)} valores horários comparados com o silver principal (outro coletor e outro parser), ${f.num(c.iguais, 0)} iguais e ${f.num(dif, 0)} diferentes (${f.num(c.diferentes_no_mesmo_arquivo, 0)} no mesmo arquivo, ${f.num(c.diferentes_por_revisao, 0)} por revisão entre capturas).${ex}`,
    `${nome}: ${f.num(c.horas_comparadas, 0)} hourly values compared with the main silver (another collector and another parser), ${f.num(c.iguais, 0)} equal and ${f.num(dif, 0)} different (${f.num(c.diferentes_no_mesmo_arquivo, 0)} in the same file, ${f.num(c.diferentes_por_revisao, 0)} by revision between captures).${ex}`,
    idioma,
  );
}

/* ---------- último ano, da gold de operação (rede.json) ---------- */

export type LinhaUltimoAno = { id: string; d: string; amplitude: number | null } & Partial<Record<FronteiraRede, number | null>>;

/**
 * Fluxo médio diário por fronteira e diferença entre o maior e o menor PLD médio
 * diário, juntos pela data (nunca pela posição): dia sem uma das séries fica nulo
 * nela.
 */
export function linhasUltimoAno(
  serieFluxos: readonly ({ d: string } & Record<string, number | null | string>)[],
  serieAmplitude: readonly { d: string; amplitude: number }[],
): LinhaUltimoAno[] {
  const amp = new Map(serieAmplitude.map((x) => [x.d, x.amplitude]));
  const flu = new Map(serieFluxos.map((x) => [x.d, x]));
  const dias = Array.from(new Set([...serieFluxos.map((x) => x.d), ...serieAmplitude.map((x) => x.d)])).sort();
  return dias.map((d) => {
    const f = flu.get(d);
    const linha: LinhaUltimoAno = { id: d, d, amplitude: amp.get(d) ?? null };
    for (const p of FRONTEIRAS) {
      const x = f?.[p];
      linha[p] = typeof x === "number" ? x : null;
    }
    return linha;
  });
}

export function colunasUltimoAno(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "d", rotulo: tx("Dia", "Day", idioma), tipo: "data" },
    ...FRONTEIRAS.map(
      (p): ColunaTabela => ({
        id: p,
        rotulo: tx(`Fluxo médio ${curtoFronteira(p, "pt")}`, `Average flow ${curtoFronteira(p, "en")}`, idioma),
        tipo: "numero",
        unidade: tx("MWmed", "MWavg", idioma),
        casas: 0,
      }),
    ),
    { id: "amplitude", rotulo: tx("Maior menos menor PLD médio diário", "Highest minus lowest daily average PLD", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}
export const COLUNAS_ULTIMO_ANO: ColunaTabela[] = colunasUltimoAno("pt");

/* ====================================================================== */
/* P029: balanço e exterior                                                */
/* ====================================================================== */

export function rotulosIdentidade(idioma: Idioma = idiomaEnergia()): Record<IdentidadeBalanco["identidade"], string> {
  return {
    balanco: tx("Balanço interno: geração − carga − intercâmbio", "Internal balance: generation − load − interchange", idioma),
    perimetro: tx("Perímetro: intercâmbio do balanço − fronteiras e exterior", "Perimeter: balance interchange − boundaries and exterior", idioma),
    soma_sin: tx("Soma: intercâmbio do SIN − soma dos quatro subsistemas", "Sum: SIN interchange − sum of the four subsystems", idioma),
  };
}
export const ROTULO_IDENTIDADE: Record<IdentidadeBalanco["identidade"], string> = rotulosIdentidade("pt");

/** Nome curto de cada conta, para o eixo das barras (o rótulo longo, com a conta escrita, fica na tabela e na legenda sob o gráfico). */
export function rotulosCurtosIdentidade(idioma: Idioma = idiomaEnergia()): Record<IdentidadeBalanco["identidade"], string> {
  return {
    balanco: tx("Balanço interno", "Internal balance", idioma),
    perimetro: tx("Perímetro", "Perimeter", idioma),
    soma_sin: tx("Soma dos subsistemas", "Sum of the subsystems", idioma),
  };
}
export const ROTULO_CURTO_IDENTIDADE: Record<IdentidadeBalanco["identidade"], string> = rotulosCurtosIdentidade("pt");

/** As identidades de uma região, na ordem balanço interno, perímetro, soma. */
export function identidadesDa(b: Pick<BalancoRede, "identidades">, sm: SubsistemaOuSin): IdentidadeBalanco[] {
  const ordem = { balanco: 0, perimetro: 1, soma_sin: 2 } as const;
  return b.identidades.filter((x) => x.sm === sm).sort((x, y) => ordem[x.identidade] - ordem[y.identidade]);
}

export type LinhaIdentidade = {
  id: string;
  identidade: string;
  /** Nome curto da conta, para o eixo das barras. */
  identidade_curta: string;
  regiao: string;
  horas: number;
  horas_fecham: number;
  horas_residuo: number;
  horas_entre_0_01_e_tolerancia: number;
  acima_1: number;
  acima_10: number;
  acima_100: number;
  igual_menos_exterior: number;
  maior_residuo_mwmed: number | null;
  maior_residuo_em: string | null;
  primeira_hora_residuo: string | null;
  ultima_hora_residuo: string | null;
  sequencias: number;
  por_ano: string;
};

/** Uma linha por identidade (as barras de horas que fecham e com resíduo usam as mesmas linhas). */
export function linhasIdentidades(ids: readonly IdentidadeBalanco[], idioma: Idioma = idiomaEnergia()): LinhaIdentidade[] {
  const f = formatos(idioma);
  const longos = rotulosIdentidade(idioma);
  const curtos = rotulosCurtosIdentidade(idioma);
  return ids.map((x) => ({
    id: x.id,
    identidade: longos[x.identidade],
    identidade_curta: curtos[x.identidade],
    regiao: nomeSm(x.sm, idioma),
    horas: x.horas,
    horas_fecham: x.horas_fecham,
    horas_residuo: x.horas_residuo,
    horas_entre_0_01_e_tolerancia: x.horas_entre_0_01_e_tolerancia,
    acima_1: x.horas_acima["1"],
    acima_10: x.horas_acima["10"],
    acima_100: x.horas_acima["100"],
    igual_menos_exterior: x.horas_residuo_igual_menos_exterior,
    maior_residuo_mwmed: x.maior_residuo_mwmed,
    maior_residuo_em: x.maior_residuo_em,
    primeira_hora_residuo: x.primeira_hora_residuo,
    ultima_hora_residuo: x.ultima_hora_residuo,
    sequencias: x.n_periodos,
    por_ano: Object.entries(x.horas_residuo_por_ano)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([a, n]) => `${a}: ${f.num(n, 0)}`)
      .join("; "),
  }));
}

/** Colunas das identidades; tolerância e faixas vêm da gold (balanco.tolerancia_mwmed e faixas_mwmed). */
export function colunasIdentidades(b: Pick<BalancoRede, "tolerancia_mwmed" | "faixas_mwmed">, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const f = formatos(idioma);
  const tol = f.num(b.tolerancia_mwmed, 1);
  const [f1, f10, f100] = b.faixas_mwmed.map((x) => f.num(x, 0));
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "identidade", rotulo: tx("Conta conferida", "Account checked", idioma), tipo: "texto", categorica: true },
    { id: "regiao", rotulo: tx("Região", "Region", idioma), tipo: "texto", categorica: true },
    { id: "horas", rotulo: tx("Horas com todas as parcelas", "Hours with every component", idioma), tipo: "numero", casas: 0 },
    { id: "horas_fecham", rotulo: tx(`Horas que fecham (até ${tol} MWmed)`, `Hours that close (up to ${tol} MWavg)`, idioma), tipo: "numero", casas: 0 },
    { id: "horas_residuo", rotulo: tx("Horas com resíduo", "Hours with a residual", idioma), tipo: "numero", casas: 0 },
    {
      id: "horas_entre_0_01_e_tolerancia",
      rotulo: tx(`Fecham com diferença entre 0,01 e ${tol} MWmed`, `Close with a difference between ${f.num(0.01, 2)} and ${tol} MWavg`, idioma),
      tipo: "numero",
      casas: 0,
    },
    { id: "acima_1", rotulo: tx(`Resíduo acima de ${f1} MWmed`, `Residual above ${f1} MWavg`, idioma), tipo: "numero", casas: 0 },
    { id: "acima_10", rotulo: tx(`Acima de ${f10} MWmed`, `Above ${f10} MWavg`, idioma), tipo: "numero", casas: 0 },
    { id: "acima_100", rotulo: tx(`Acima de ${f100} MWmed`, `Above ${f100} MWavg`, idioma), tipo: "numero", casas: 0 },
    { id: "igual_menos_exterior", rotulo: tx("Resíduo igual a menos o exterior da hora", "Residual equal to minus the hour's exterior", idioma), tipo: "numero", casas: 0 },
    { id: "maior_residuo_mwmed", rotulo: tx("Maior resíduo", "Largest residual", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "maior_residuo_em", rotulo: tx("Hora do maior resíduo", "Hour of the largest residual", idioma), tipo: "data" },
    { id: "primeira_hora_residuo", rotulo: tx("Primeira hora com resíduo", "First hour with a residual", idioma), tipo: "data" },
    { id: "ultima_hora_residuo", rotulo: tx("Última hora com resíduo", "Last hour with a residual", idioma), tipo: "data" },
    { id: "sequencias", rotulo: tx("Sequências de horas com resíduo", "Runs of hours with a residual", idioma), tipo: "numero", casas: 0 },
    { id: "por_ano", rotulo: tx("Horas com resíduo por ano", "Hours with a residual by year", idioma), tipo: "texto" },
  ];
}

/** "fecha em todas as N horas" ou "fecha em X de N horas". */
function fecha(x: IdentidadeBalanco, idioma: Idioma): string {
  const f = formatos(idioma);
  return x.horas_residuo === 0
    ? tx(`fecha em todas as ${f.num(x.horas, 0)} horas`, `closes in all ${f.num(x.horas, 0)} hours`, idioma)
    : tx(`fecha em ${f.num(x.horas_fecham, 0)} de ${f.num(x.horas, 0)} horas`, `closes in ${f.num(x.horas_fecham, 0)} of ${f.num(x.horas, 0)} hours`, idioma);
}

/** "No SIN", "No Norte"; "In the SIN", "In the North". */
function ondeSm(sm: SubsistemaOuSin, idioma: Idioma): string {
  return sm === "SIN" ? tx("No SIN", "In the SIN", idioma) : cap(noSm(sm, idioma));
}

/**
 * Resposta do P029 para a região escolhida: em quantas horas cada identidade fecha e,
 * quando há resíduo, onde ele está (período e maior valor), sem atribuir causa.
 */
export function respostaBalanco(
  b: Pick<BalancoRede, "identidades" | "tolerancia_mwmed">,
  sm: SubsistemaOuSin,
  periodo: { inicio: string; fim: string },
  idioma: Idioma = idiomaEnergia(),
): string {
  const f = formatos(idioma);
  const ids = identidadesDa(b, sm);
  const bal = ids.find((x) => x.identidade === "balanco");
  const per = ids.find((x) => x.identidade === "perimetro");
  const soma = ids.find((x) => x.identidade === "soma_sin");
  const onde = ondeSm(sm, idioma);
  const frases: string[] = [];
  // frase de leitor antes da contagem: a menor parcela de horas que fecha entre as identidades conferidas
  const conferidas = [bal, per, soma].filter((x): x is IdentidadeBalanco => !!x && x.horas > 0);
  if (conferidas.length) {
    const menor = Math.min(...conferidas.map((x) => x.horas_fecham / x.horas));
    frases.push(
      menor === 1
        ? tx(
            `${onde}, os números do balanço de energia fecham entre si em todas as horas conferidas.`,
            `${onde}, the energy balance figures agree with each other in every hour checked.`,
            idioma,
          )
        : tx(
            `${onde}, os números do balanço de energia fecham entre si em pelo menos ${f.num(Math.floor(menor * 100), 0)}% das horas conferidas; as horas em que não fecham estão listadas abaixo.`,
            `${onde}, the energy balance figures agree with each other in at least ${f.num(Math.floor(menor * 100), 0)}% of the hours checked; the hours in which they do not are listed below.`,
            idioma,
          ),
    );
  }
  const quem =
    sm === "SIN"
      ? tx("o intercâmbio internacional", "the international interchange", idioma)
      : sm === "S"
        ? tx("a fronteira com o Sudeste/Centro-Oeste mais Argentina e Uruguai", "the boundary with the Southeast/Center-West plus Argentina and Uruguay", idioma)
        : tx("a soma das fronteiras", "the sum of the boundaries", idioma);
  const sem = (x: IdentidadeBalanco) => fecha(x, idioma).replace(/^(fecha|closes) /, "");
  const partes: string[] = [];
  if (per) partes.push(tx(`o intercâmbio publicado no balanço fecha com ${quem} ${sem(per)}`, `the interchange published in the balance closes with ${quem} ${sem(per)}`, idioma));
  if (bal) partes.push(tx(`geração menos carga fecha com o intercâmbio ${sem(bal)}`, `generation minus load closes with the interchange ${sem(bal)}`, idioma));
  if (soma) partes.push(tx(`o intercâmbio do SIN fecha com a soma dos quatro subsistemas ${sem(soma)}`, `the SIN interchange closes with the sum of the four subsystems ${sem(soma)}`, idioma));
  frases.push(
    tx(
      `${onde}, de ${f.dataBR(periodo.inicio)} a ${f.dataBR(periodo.fim)} (tolerância de ${f.num(b.tolerancia_mwmed, 1)} MWmed por hora): ${listaLonga(partes, idioma)}.`,
      `${onde}, from ${f.dataBR(periodo.inicio)} to ${f.dataBR(periodo.fim)} (tolerance of ${f.num(b.tolerancia_mwmed, 1)} MWavg per hour): ${listaLonga(partes, idioma)}.`,
      idioma,
    ),
  );
  for (const x of ids.filter((y) => y.horas_residuo > 0)) {
    const nome =
      x.identidade === "balanco"
        ? tx("No balanço interno", "In the internal balance", idioma)
        : x.identidade === "perimetro"
          ? tx("No perímetro", "In the perimeter", idioma)
          : tx("Na soma dos subsistemas", "In the sum of the subsystems", idioma);
    const quando = x.primeira_hora_residuo && x.ultima_hora_residuo ? ` ${entreDatas(x.primeira_hora_residuo, x.ultima_hora_residuo, idioma)}` : "";
    const maior =
      x.maior_residuo_mwmed !== null && x.maior_residuo_em
        ? tx(
            `; o maior foi ${mwmed(x.maior_residuo_mwmed, 1, idioma)} em ${f.horaLocal(x.maior_residuo_em)}`,
            `; the largest was ${mwmed(x.maior_residuo_mwmed, 1, idioma)} at ${f.horaLocal(x.maior_residuo_em)}`,
            idioma,
          )
        : "";
    const ext = x.horas_residuo_igual_menos_exterior
      ? tx(
          `; em ${f.num(x.horas_residuo_igual_menos_exterior, 0)} delas o resíduo é igual a menos o intercâmbio internacional da mesma hora`,
          `; in ${f.num(x.horas_residuo_igual_menos_exterior, 0)} of them the residual equals minus the international interchange of the same hour`,
          idioma,
        )
      : "";
    frases.push(
      tx(
        `${nome}, ${x.horas_residuo === 1 ? "a hora com resíduo fica" : `as ${f.num(x.horas_residuo, 0)} horas com resíduo ficam`}${quando}${maior}${ext}.`,
        `${nome}, ${x.horas_residuo === 1 ? "the hour with a residual falls" : `the ${f.num(x.horas_residuo, 0)} hours with a residual fall`}${quando}${maior}${ext}.`,
        idioma,
      ),
    );
  }
  if (ids.some((y) => y.horas_residuo > 0)) frases.push(tx("A fonte não informa a causa dos resíduos, e nenhuma é atribuída aqui.", "The source does not state the cause of the residuals, and none is attributed here.", idioma));
  return frases.join(" ");
}

/**
 * Veredito do P029 em palavras simples: em quantas horas os números do balanço conferem entre si na região escolhida e o
 * que a fonte não diz. A contagem por identidade, o período de cada resíduo e o maior valor ficam em respostaBalanco.
 */
export function vereditoBalanco(
  b: Pick<BalancoRede, "identidades" | "tolerancia_mwmed">,
  sm: SubsistemaOuSin,
  periodo: { inicio: string; fim: string },
  idioma: Idioma = idiomaEnergia(),
): string {
  const f = formatos(idioma);
  const ids = identidadesDa(b, sm);
  const conferidas = ids.filter((x) => x.horas > 0);
  if (!conferidas.length) return "";
  const menor = Math.min(...conferidas.map((x) => x.horas_fecham / x.horas));
  const onde = ondeSm(sm, idioma);
  const confere =
    menor === 1
      ? tx("todas as horas conferidas", "every hour checked", idioma)
      : tx(`pelo menos ${f.num(Math.floor(menor * 100), 0)}% das horas conferidas`, `at least ${f.num(Math.floor(menor * 100), 0)}% of the hours checked`, idioma);
  // quando todas as horas com resíduo da região caem num só ano, a frase diz qual: a média de 95% ou mais sozinha esconderia onde elas estão
  const anosComResiduo = Array.from(new Set(ids.flatMap((y) => Object.entries(y.horas_residuo_por_ano).filter(([, n]) => n > 0).map(([a]) => a))));
  const quando = anosComResiduo.length === 1 ? tx(` As horas com resíduo estão todas em ${anosComResiduo[0]}.`, ` The hours with a residual are all in ${anosComResiduo[0]}.`, idioma) : "";
  const resto = ids.some((y) => y.horas_residuo > 0)
    ? tx(
        ` Nas horas em que não conferem, a fonte não informa o motivo e o observatório não atribui causa.${quando}`,
        ` In the hours in which they do not agree, the source does not state the reason and the observatory does not attribute a cause.${quando}`,
        idioma,
      )
    : "";
  return tx(
    `${onde}, geração, carga e intercâmbio conferem entre si em ${confere}, de ${f.dataBR(periodo.inicio)} a ${f.dataBR(periodo.fim)}.${resto}`,
    `${onde}, generation, load and interchange agree with each other in ${confere}, from ${f.dataBR(periodo.inicio)} to ${f.dataBR(periodo.fim)}.${resto}`,
    idioma,
  );
}

/**
 * Onde estão as horas com resíduo do balanço interno do SIN, lido da contagem por ano e das horas extremas da gold: os anos com
 * resíduo, o período, o maior valor e os anos cobertos em que o balanço fecha em todas as horas. Sem causa atribuída.
 */
export function textoMudancaBalanco(b: Pick<BalancoRede, "identidades" | "mensal">, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const x = identidadesDa(b, "SIN").find((y) => y.identidade === "balanco");
  if (!x || x.horas === 0) return "";
  if (x.horas_residuo === 0)
    return tx(
      `No balanço interno do SIN, nenhuma das ${f.num(x.horas, 0)} horas conferidas tem resíduo.`,
      `In the SIN internal balance, none of the ${f.num(x.horas, 0)} hours checked has a residual.`,
      idioma,
    );
  const comResiduo = Object.entries(x.horas_residuo_por_ano)
    .filter(([, n]) => n > 0)
    .map(([a]) => a)
    .sort();
  const cobertos = Array.from(new Set(b.mensal.meses.map((m) => m.slice(0, 4)))).sort();
  const outros = cobertos.filter((a) => !comResiduo.includes(a));
  const quando = x.primeira_hora_residuo && x.ultima_hora_residuo ? ` (${entreDatas(x.primeira_hora_residuo, x.ultima_hora_residuo, idioma)})` : "";
  const maior =
    x.maior_residuo_mwmed !== null && x.maior_residuo_em
      ? tx(
          `; o maior foi de ${mwmed(x.maior_residuo_mwmed, 1, idioma)}, em ${f.horaLocal(x.maior_residuo_em)}`,
          `; the largest was ${mwmed(x.maior_residuo_mwmed, 1, idioma)}, at ${f.horaLocal(x.maior_residuo_em)}`,
          idioma,
        )
      : "";
  const fechaTodas = outros.length
    ? tx(
        ` Em ${listaTexto(outros, "pt")}, o balanço interno fecha em todas as horas conferidas.`,
        ` In ${listaTexto(outros, "en")}, the internal balance closes in every hour checked.`,
        idioma,
      )
    : "";
  return tx(
    `No balanço interno do SIN, as ${f.num(x.horas_residuo, 0)} horas com resíduo estão em ${listaTexto(comResiduo, "pt")}${quando}${maior}.${fechaTodas}`,
    `In the SIN internal balance, the ${f.num(x.horas_residuo, 0)} hours with a residual are in ${listaTexto(comResiduo, "en")}${quando}${maior}.${fechaTodas}`,
    idioma,
  );
}

export type LinhaMesBalanco = {
  id: string;
  m: string;
  mmgd: string;
  geracao_mwh: number | null;
  carga_mwh: number | null;
  intercambio_mwh: number | null;
  residuo_balanco_mwh: number | null;
  horas: number | null;
  horas_completas: number | null;
  horas_residuo_balanco: number | null;
  intercambio_perimetro_mwh: number | null;
  fronteiras_exterior_mwh: number | null;
  residuo_perimetro_mwh: number | null;
  horas_perimetro: number | null;
  horas_residuo_perimetro: number | null;
};

export function rotulosMmgd(idioma: Idioma = idiomaEnergia()): Record<RegimeMmgd, string> {
  return {
    sem: tx("sem MMGD estimada", "without estimated MMGD", idioma),
    parcial: tx("MMGD estimada em parte do mês", "estimated MMGD in part of the month", idioma),
    com: tx("com MMGD estimada", "with estimated MMGD", idioma),
  };
}
export const ROTULO_MMGD: Record<RegimeMmgd, string> = rotulosMmgd("pt");

/** O balanço mensal da região (duas somas por mês, cada uma sobre as suas horas). */
export function linhasBalancoMensal(b: Pick<BalancoRede, "mensal">, sm: SubsistemaOuSin, idioma: Idioma = idiomaEnergia()): LinhaMesBalanco[] {
  const s = b.mensal.por_sm[sm];
  const rotulos = rotulosMmgd(idioma);
  return b.mensal.meses.map((m, i) => ({
    id: m,
    m,
    mmgd: rotulos[b.mensal.mmgd_estimada[i]] ?? tx("sem dado", "no data", idioma),
    geracao_mwh: s.geracao_mwh[i] ?? null,
    carga_mwh: s.carga_mwh[i] ?? null,
    intercambio_mwh: s.intercambio_mwh[i] ?? null,
    residuo_balanco_mwh: s.residuo_balanco_mwh[i] ?? null,
    horas: s.horas[i] ?? null,
    horas_completas: s.horas_completas[i] ?? null,
    horas_residuo_balanco: s.horas_residuo_balanco[i] ?? null,
    intercambio_perimetro_mwh: s.intercambio_perimetro_mwh[i] ?? null,
    fronteiras_exterior_mwh: s.fronteiras_exterior_mwh[i] ?? null,
    residuo_perimetro_mwh: s.residuo_perimetro_mwh[i] ?? null,
    horas_perimetro: s.horas_perimetro[i] ?? null,
    horas_residuo_perimetro: s.horas_residuo_perimetro[i] ?? null,
  }));
}

export function colunasBalancoMensal(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "data" },
    { id: "mmgd", rotulo: tx("Geração solar e carga", "Solar generation and load", idioma), tipo: "texto", categorica: true },
    { id: "geracao_mwh", rotulo: tx("Geração", "Generation", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "carga_mwh", rotulo: tx("Carga", "Load", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "intercambio_mwh", rotulo: tx("Intercâmbio no balanço", "Interchange in the balance", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "residuo_balanco_mwh", rotulo: tx("Resíduo do balanço interno", "Internal balance residual", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas_completas", rotulo: tx("Horas com as três parcelas", "Hours with all three components", idioma), tipo: "numero", casas: 0 },
    { id: "horas_residuo_balanco", rotulo: tx("Horas com resíduo (balanço)", "Hours with a residual (balance)", idioma), tipo: "numero", casas: 0 },
    { id: "intercambio_perimetro_mwh", rotulo: tx("Intercâmbio nas horas do perímetro", "Interchange in the perimeter hours", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "fronteiras_exterior_mwh", rotulo: tx("Fronteiras e exterior", "Boundaries and exterior", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "residuo_perimetro_mwh", rotulo: tx("Resíduo do perímetro", "Perimeter residual", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas_perimetro", rotulo: tx("Horas do perímetro", "Perimeter hours", idioma), tipo: "numero", casas: 0 },
    { id: "horas_residuo_perimetro", rotulo: tx("Horas com resíduo (perímetro)", "Hours with a residual (perimeter)", idioma), tipo: "numero", casas: 0 },
    { id: "horas", rotulo: tx("Horas no balanço", "Hours in the balance", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_BALANCO_MENSAL: ColunaTabela[] = colunasBalancoMensal("pt");

/** Horas com resíduo no balanço interno, por mês, das regiões escolhidas (até quatro). */
export function linhasResiduoMensal(b: Pick<BalancoRede, "mensal">, sms: readonly SubsistemaOuSin[]): ({ id: string; m: string } & Partial<Record<SubsistemaOuSin, number | null>>)[] {
  return b.mensal.meses.map((m, i) => ({ id: m, m, ...Object.fromEntries(sms.map((sm) => [sm, b.mensal.por_sm[sm].horas_residuo_balanco[i] ?? null])) }));
}

/** Marcos das quebras metodológicas do balanço no eixo mensal. */
export function marcosQuebras(b: Pick<BalancoRede, "quebras">, idioma: Idioma = idiomaEnergia()): { x: string; rotulo: string }[] {
  const f = formatos(idioma);
  return b.quebras.map((q) => ({ x: q.dia.slice(0, 7), rotulo: `${f.dataBR(q.dia)}: ${q.id === "mmgd_2023" ? "MMGD" : tx("quebra", "break", idioma)}` }));
}

/** Frases do achado A05 (geradas no pipeline pelos contadores), com datas no formato brasileiro. */
export function frasesA05(a: Pick<AchadosRede["A05"], "frases">): string[] {
  return a.frases.map(datasLegiveis);
}

export type LinhaMesExterior = {
  id: string;
  m: string;
  exportacao_mwh: number | null;
  importacao_mwh: number | null;
  horas: number | null;
  horas_com_fluxo: number | null;
  programado_liquido_mwh: number | null;
};

export function linhasExteriorMensal(e: Pick<ExteriorRede, "meses" | "por_pais">, pais: PaisRede): LinhaMesExterior[] {
  const s = e.por_pais[pais];
  return e.meses.map((m, i) => ({
    id: m,
    m,
    exportacao_mwh: s.exportacao_mwh[i] ?? null,
    importacao_mwh: s.importacao_mwh[i] ?? null,
    horas: s.horas[i] ?? null,
    horas_com_fluxo: s.horas_com_fluxo[i] ?? null,
    programado_liquido_mwh: s.programado_liquido_mwh[i] ?? null,
  }));
}

export function colunasExteriorMensal(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const f = formatos(idioma);
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "data" },
    { id: "exportacao_mwh", rotulo: tx("Exportação do Brasil", "Exports from Brazil", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "importacao_mwh", rotulo: tx("Importação do Brasil", "Imports into Brazil", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas", rotulo: tx("Horas publicadas", "Hours published", idioma), tipo: "numero", casas: 0 },
    {
      id: "horas_com_fluxo",
      rotulo: tx(`Horas com fluxo acima de ${f.num(LIMIAR_NULO_MWMED, 0)} MWmed`, `Hours with flow above ${f.num(LIMIAR_NULO_MWMED, 0)} MWavg`, idioma),
      tipo: "numero",
      casas: 0,
    },
    {
      id: "programado_liquido_mwh",
      rotulo: tx("Saldo programado (vazio antes do programa publicado)", "Scheduled net flow (empty before the published schedule)", idioma),
      tipo: "numero",
      unidade: "MWh",
      casas: 0,
    },
  ];
}
export const COLUNAS_EXTERIOR_MENSAL: ColunaTabela[] = colunasExteriorMensal("pt");

export type LinhaExterior12m = {
  id: PaisRede;
  pais: string;
  inicio: string | null;
  fim: string | null;
  horas: number;
  exportacao_mwh: number | null;
  importacao_mwh: number | null;
  horas_com_fluxo: number | null;
  ultima_hora: string | null;
};

export function linhasExterior12m(e: Pick<ExteriorRede, "resumo_12m" | "por_pais">, idioma: Idioma = idiomaEnergia()): LinhaExterior12m[] {
  return PAISES.map((p) => {
    const r = e.resumo_12m[p];
    return {
      id: p,
      pais: nomePais(p, idioma),
      inicio: r.meses?.[0] ?? null,
      fim: r.meses?.[1] ?? null,
      horas: r.horas,
      exportacao_mwh: r.exportacao_mwh,
      importacao_mwh: r.importacao_mwh,
      horas_com_fluxo: r.horas_com_fluxo,
      ultima_hora: e.por_pais[p].ultima_hora,
    };
  });
}

export function colunasExterior12m(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "pais", rotulo: tx("País", "Country", idioma), tipo: "texto" },
    { id: "inicio", rotulo: tx("Primeiro mês", "First month", idioma), tipo: "data" },
    { id: "fim", rotulo: tx("Último mês", "Last month", idioma), tipo: "data" },
    { id: "horas", rotulo: tx("Horas publicadas", "Hours published", idioma), tipo: "numero", casas: 0 },
    { id: "exportacao_mwh", rotulo: tx("Exportação do Brasil", "Exports from Brazil", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "importacao_mwh", rotulo: tx("Importação do Brasil", "Imports into Brazil", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas_com_fluxo", rotulo: tx("Horas com fluxo", "Hours with flow", idioma), tipo: "numero", casas: 0 },
    { id: "ultima_hora", rotulo: tx("Última hora publicada", "Last hour published", idioma), tipo: "data" },
  ];
}
export const COLUNAS_EXTERIOR_12M: ColunaTabela[] = colunasExterior12m("pt");

/** "A Argentina", "O Uruguai"; em inglês, só o nome. */
function oPaisMaiusculo(p: PaisRede, idioma: Idioma): string {
  return tx(`${p === "ARGENTINA" ? "A" : "O"} ${NOME_PAIS[p]}`, NOME_PAIS_EN[p], idioma);
}

/** Exportação e importação de 12 meses por país; país sem hora na janela é dito ausente, nunca zero. */
export function respostaExterior(e: Pick<ExteriorRede, "resumo_12m" | "por_pais">, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const linhas = linhasExterior12m(e, idioma);
  const com = linhas.filter((l) => l.horas > 0);
  const sem = linhas.filter((l) => l.horas === 0);
  const per =
    com[0]?.inicio && com[0]?.fim
      ? tx(`De ${f.mesAno(com[0].inicio)} a ${f.mesAno(com[0].fim)}`, `From ${f.mesAno(com[0].inicio)} to ${f.mesAno(com[0].fim)}`, idioma)
      : tx("Nos 12 meses completos mais recentes", "In the most recent 12 complete months", idioma);
  const partes = com.map((l) =>
    tx(
      `com ${oPais(l.id, "pt")}, ${mwh(l.exportacao_mwh, idioma)} exportados e ${mwh(l.importacao_mwh, idioma)} importados (fluxo acima de ${mwmed(LIMIAR_NULO_MWMED, 0, idioma)} em ${f.num(l.horas_com_fluxo, 0)} de ${f.num(l.horas, 0)} horas)`,
      `with ${oPais(l.id, "en")}, ${mwh(l.exportacao_mwh, idioma)} exported and ${mwh(l.importacao_mwh, idioma)} imported (flow above ${mwmed(LIMIAR_NULO_MWMED, 0, idioma)} in ${f.num(l.horas_com_fluxo, 0)} of ${f.num(l.horas, 0)} hours)`,
      idioma,
    ),
  );
  let t = tx(`${per}, o Brasil trocou energia ${listaTexto(partes, "pt")}.`, `${per}, Brazil exchanged energy ${listaTexto(partes, "en")}.`, idioma);
  if (sem.length) {
    const nomes = listaTexto(
      sem.map((l) => oPaisMaiusculo(l.id, idioma)),
      idioma,
    );
    const ultimos = sem
      .map((l) => (l.ultima_hora ? tx(` (último registro em ${f.dataBR(l.ultima_hora)})`, ` (last record on ${f.dataBR(l.ultima_hora)})`, idioma) : ""))
      .join("");
    t += tx(
      ` ${nomes} não ${sem.length === 1 ? "tem" : "têm"} nenhuma hora publicada no período${ultimos}: ausência, não zero.`,
      ` ${nomes} ${sem.length === 1 ? "has" : "have"} no hour published in the period${ultimos}: missing, not zero.`,
      idioma,
    );
  }
  return t;
}

/**
 * Veredito do exterior em palavras simples: o saldo dos 12 meses (exportação menos importação) dos países com hora
 * publicada e o país sem hora, dito ausente. É a soma dos mesmos campos da resposta completa e do número em destaque do
 * painel; as quantidades de cada país ficam em respostaExterior.
 */
export function vereditoExterior(e: Pick<ExteriorRede, "resumo_12m" | "por_pais">, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const linhas = linhasExterior12m(e, idioma);
  const com = linhas.filter((l) => l.horas > 0);
  const sem = linhas.filter((l) => l.horas === 0);
  if (!com.length)
    return tx(
      "Nenhum país tem hora publicada de intercâmbio nos 12 meses completos mais recentes: é ausência de dado, não zero.",
      "No country has a published interchange hour in the most recent 12 complete months: the data is missing, not zero.",
      idioma,
    );
  const saldo = com.reduce((s, l) => s + (l.exportacao_mwh ?? 0) - (l.importacao_mwh ?? 0), 0);
  const per =
    com[0].inicio && com[0].fim
      ? tx(`De ${f.mesAno(com[0].inicio)} a ${f.mesAno(com[0].fim)}`, `From ${f.mesAno(com[0].inicio)} to ${f.mesAno(com[0].fim)}`, idioma)
      : tx("Nos 12 meses completos mais recentes", "In the most recent 12 complete months", idioma);
  const paises = listaTexto(
    com.map((l) => oPais(l.id, idioma)),
    idioma,
  );
  const rumo =
    saldo > 0
      ? tx(`exportou ${mwh(saldo, idioma)} a mais do que importou`, `exported ${mwh(saldo, idioma)} more than it imported`, idioma)
      : saldo < 0
        ? tx(`importou ${mwh(-saldo, idioma)} a mais do que exportou`, `imported ${mwh(-saldo, idioma)} more than it exported`, idioma)
        : tx("exportou e importou a mesma energia", "exported and imported the same energy", idioma);
  let t = tx(`${per}, o Brasil ${rumo} na troca com ${paises}.`, `${per}, Brazil ${rumo} in the exchange with ${paises}.`, idioma);
  if (sem.length) {
    const nomes = listaTexto(
      sem.map((l) => oPaisMaiusculo(l.id, idioma)),
      idioma,
    );
    t += tx(
      ` ${nomes} ${sem.length === 1 ? "não tem" : "não têm"} hora publicada no período: ausência de dado, não zero.`,
      ` ${nomes} ${sem.length === 1 ? "has" : "have"} no hour published in the period: missing data, not zero.`,
      idioma,
    );
  }
  return t;
}

export type LinhaItaipu = { id: string; m: string; total_mwh: number | null; brasil_mwh: number | null; nao_brasil_mwh: number | null; horas: number | null };

export function linhasItaipu(e: Pick<ExteriorRede, "meses" | "itaipu">): LinhaItaipu[] {
  return e.meses.map((m, i) => ({
    id: m,
    m,
    total_mwh: e.itaipu.total_mwh[i] ?? null,
    brasil_mwh: e.itaipu.brasil_mwh[i] ?? null,
    nao_brasil_mwh: e.itaipu.nao_brasil_mwh[i] ?? null,
    horas: e.itaipu.horas[i] ?? null,
  }));
}

/**
 * Conferência das parcelas de Itaipu (total = 60 Hz + 50 Hz; Brasil = as duas
 * frequências destinadas ao Brasil). Contagem ausente é dita não conferida, nunca
 * vira zero diferença.
 */
export function textoIdentidadesItaipu(x: Pick<ExteriorRede, "itaipu_identidades">["itaipu_identidades"], idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const n = x.linhas;
  if (n === null || n === undefined) return tx("Itaipu: identidades das parcelas não conferidas nesta publicação.", "Itaipu: component identities not checked in this release.", idioma);
  const parte = (dif: number | null, texto: string) =>
    dif === null || dif === undefined
      ? tx(`${texto}: não conferido`, `${texto}: not checked`, idioma)
      : tx(`${texto} em ${f.num(n - dif, 0)} de ${f.num(n, 0)} horas`, `${texto} in ${f.num(n - dif, 0)} of ${f.num(n, 0)} hours`, idioma);
  return `Itaipu: ${parte(x.total_diferente_de_60_mais_50, tx("total igual a 60 Hz mais 50 Hz", "total equal to 60 Hz plus 50 Hz", idioma))}; ${parte(
    x.brasil_diferente_de_60_mais_50_brasil,
    tx("parcela do Brasil igual às duas frequências destinadas ao Brasil", "Brazil's share equal to the two frequencies allocated to Brazil", idioma),
  )}.`;
}

export function colunasItaipu(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "data" },
    { id: "total_mwh", rotulo: tx("Geração total", "Total generation", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "brasil_mwh", rotulo: tx("Destinada ao Brasil", "Allocated to Brazil", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "nao_brasil_mwh", rotulo: tx("Não destinada ao Brasil (diferença)", "Not allocated to Brazil (difference)", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas", rotulo: tx("Horas", "Hours", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_ITAIPU: ColunaTabela[] = colunasItaipu("pt");

/* ====================================================================== */
/* P030: restrições publicadas                                             */
/* ====================================================================== */

/** Fluxos publicados no último mês do arquivo, do maior para o menor número de horas em 12 meses. */
export function fluxosAtivos(atls: Pick<RestricoesRede["atls"], "fluxos">): FluxoAtls[] {
  return atls.fluxos
    .filter((f) => f.ativo)
    .slice()
    .sort((a, b) => (b.ultimos_12_meses?.horas_violacao ?? -1) - (a.ultimos_12_meses?.horas_violacao ?? -1) || a.fluxo.localeCompare(b.fluxo));
}

/** Fluxo pedido, se publicado; senão o ativo com mais horas acima do limite em 12 meses. */
export function fluxoEscolhido(atls: Pick<RestricoesRede["atls"], "fluxos">, pedido: string): FluxoAtls | null {
  return atls.fluxos.find((f) => f.fluxo === pedido) ?? fluxosAtivos(atls)[0] ?? atls.fluxos[0] ?? null;
}

/**
 * Nome do fluxo como o leitor o entende: a definição conferida em documento público do ONS; sem ela, a sigla do ONS. Em
 * inglês, a definição passa pela tabela DEFINICAO_FLUXO_EN; sem entrada, sai como a gold publicou.
 */
export function nomeFluxo(f: Pick<FluxoAtls, "fluxo" | "definicao">, idioma: Idioma = idiomaEnergia()): string {
  return f.definicao ? rotuloDaGold(DEFINICAO_FLUXO_EN, f.definicao, idioma) : f.fluxo;
}

export type MedidasRestricoes = {
  /** Fluxos publicados no último mês que passaram alguma hora acima do limite nos 12 meses, e o total de publicados. Nulo sem fluxo publicado. */
  fluxosAcima: { valor: number; de: number; periodo: string } | null;
  /** O fluxo publicado com mais horas acima do limite nos 12 meses (a ficha de prova existe para os publicados no último mês). Nulo sem fluxo. */
  maisHoras: { fluxo: string; nome: string; horas: number; periodo: string } | null;
};

/**
 * Medidas da abertura do P030: quantos dos fluxos acompanhados passaram algum tempo acima do limite estabelecido nos 12 meses e qual teve
 * mais horas. São os mesmos campos do arquivo do ATLS que alimentam o gráfico de barras, a tabela e a exportação (fluxosAtivos).
 */
export function medidasRestricoes(r: Pick<RestricoesRede, "atls">, idioma: Idioma = idiomaEnergia()): MedidasRestricoes {
  const f = formatos(idioma);
  const ativos = fluxosAtivos(r.atls);
  const janela = ativos[0]?.ultimos_12_meses ?? null;
  if (!ativos.length || !janela) return { fluxosAcima: null, maisHoras: null };
  const periodo = tx(`${f.mesAno(janela.inicio)} a ${f.mesAno(janela.fim)}`, `${f.mesAno(janela.inicio)} to ${f.mesAno(janela.fim)}`, idioma);
  const com = ativos.filter((x) => (x.ultimos_12_meses?.horas_violacao ?? 0) > 0);
  return {
    fluxosAcima: { valor: com.length, de: ativos.length, periodo },
    maisHoras: { fluxo: ativos[0].fluxo, nome: nomeFluxo(ativos[0], idioma), horas: janela.horas_violacao, periodo },
  };
}

export type LinhaAtls = {
  id: string;
  /** Nome legível (a definição conferida; sem ela, a própria sigla). */
  nome: string;
  fluxo: string;
  definicao: string;
  publicado_no_ultimo_mes: string;
  inicio_12m: string | null;
  fim_12m: string | null;
  horas_12m: number | null;
  meses_12m: number | null;
  inicio: string | null;
  fim: string | null;
  meses: number;
  meses_com_violacao: number;
  horas_violacao_total: number;
};

export function linhasAtls(fluxos: readonly FluxoAtls[], idioma: Idioma = idiomaEnergia()): LinhaAtls[] {
  return fluxos.map((f) => ({
    id: f.fluxo,
    nome: nomeFluxo(f, idioma),
    fluxo: f.fluxo,
    definicao: f.definicao ? rotuloDaGold(DEFINICAO_FLUXO_EN, f.definicao, idioma) : tx("sem definição em documento público conferido", "no definition in a checked public document", idioma),
    publicado_no_ultimo_mes: simNao(f.ativo, idioma),
    inicio_12m: f.ultimos_12_meses?.inicio ?? null,
    fim_12m: f.ultimos_12_meses?.fim ?? null,
    horas_12m: f.ultimos_12_meses?.horas_violacao ?? null,
    meses_12m: f.ultimos_12_meses?.meses_com_violacao ?? null,
    inicio: f.inicio,
    fim: f.fim,
    meses: f.meses,
    meses_com_violacao: f.meses_com_violacao,
    horas_violacao_total: f.horas_violacao_total,
  }));
}

export function colunasAtls(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("Fluxo", "Flow", idioma), tipo: "texto" },
    { id: "fluxo", rotulo: tx("Sigla do ONS", "ONS code", idioma), tipo: "texto", nivel: "analisar" },
    { id: "definicao", rotulo: tx("Definição conferida", "Checked definition", idioma), tipo: "texto" },
    { id: "publicado_no_ultimo_mes", rotulo: tx("Publicado no último mês", "Published in the last month", idioma), tipo: "texto", categorica: true },
    { id: "inicio_12m", rotulo: tx("Início dos 12 meses", "Start of the 12 months", idioma), tipo: "data" },
    { id: "fim_12m", rotulo: tx("Fim dos 12 meses", "End of the 12 months", idioma), tipo: "data" },
    { id: "horas_12m", rotulo: tx("Horas acima do limite em 12 meses", "Hours above the limit in 12 months", idioma), tipo: "numero", unidade: "h", casas: 1 },
    { id: "meses_12m", rotulo: tx("Meses com violação em 12 meses", "Months with a violation in 12 months", idioma), tipo: "numero", casas: 0 },
    { id: "inicio", rotulo: tx("Primeiro mês no arquivo", "First month in the file", idioma), tipo: "data" },
    { id: "fim", rotulo: tx("Último mês no arquivo", "Last month in the file", idioma), tipo: "data" },
    { id: "meses", rotulo: tx("Meses publicados", "Months published", idioma), tipo: "numero", casas: 0 },
    { id: "meses_com_violacao", rotulo: tx("Meses com violação", "Months with a violation", idioma), tipo: "numero", casas: 0 },
    { id: "horas_violacao_total", rotulo: tx("Horas acima do limite no histórico", "Hours above the limit in the history", idioma), tipo: "numero", unidade: "h", casas: 1 },
  ];
}
export const COLUNAS_ATLS: ColunaTabela[] = colunasAtls("pt");

/**
 * Série mensal das horas acima do limite dos fluxos escolhidos (até quatro). Mês em que
 * o fluxo não foi publicado fica nulo (ausência), distinto de zero hora publicada.
 */
export function serieAtls(fluxos: readonly FluxoAtls[]): ({ id: string; m: string } & Record<string, number | null | string>)[] {
  const meses = Array.from(new Set(fluxos.flatMap((f) => f.serie.meses))).sort();
  const porFluxo = new Map(fluxos.map((f) => [f.fluxo, new Map(f.serie.meses.map((m, i) => [m, f.serie.horas_violacao[i] ?? null]))]));
  return meses.map((m) => ({ id: m, m, ...Object.fromEntries(fluxos.map((f) => [f.fluxo, porFluxo.get(f.fluxo)?.get(m) ?? null])) }));
}

/**
 * Primeiro mês do arquivo do ATLS (o mais antigo entre os fluxos). A gold traz a série
 * mensal só desde o ano inicial do módulo; o histórico inteiro fica no CSV para download.
 */
export function inicioArquivoAtls(atls: Pick<RestricoesRede["atls"], "fluxos">): string | null {
  return atls.fluxos.map((f) => f.inicio).filter((x): x is string => !!x).sort()[0] ?? null;
}

/** Resposta do P030: horas acima do limite nos fluxos publicados e cortes de carga em 12 meses. */
export function respostaRestricoes(r: Pick<RestricoesRede, "atls" | "interrupcoes">, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const ativos = fluxosAtivos(r.atls);
  const com = ativos.filter((x) => (x.ultimos_12_meses?.horas_violacao ?? 0) > 0);
  const sem = ativos.filter((x) => x.ultimos_12_meses && x.ultimos_12_meses.horas_violacao === 0);
  const janela = ativos[0]?.ultimos_12_meses;
  const frases: string[] = [];
  if (janela && ativos.length) {
    const lista = com.map((x) => `${x.fluxo} ${f.num(x.ultimos_12_meses!.horas_violacao, 1)} h`);
    const listaSem = listaTexto(
      sem.map((x) => x.fluxo),
      idioma,
    );
    frases.push(
      tx(
        `De ${f.mesAno(janela.inicio)} a ${f.mesAno(janela.fim)}, ${f.num(com.length, 0)} dos ${f.num(ativos.length, 0)} fluxos que o ONS acompanha no indicador ATLS ficaram acima do limite estabelecido por algum tempo${lista.length ? `: ${listaTexto(lista, "pt")}` : ""}${sem.length ? `; ${listaSem} não ${sem.length === 1 ? "ficou" : "ficaram"}` : ""}.`,
        `From ${f.mesAno(janela.inicio)} to ${f.mesAno(janela.fim)}, ${f.num(com.length, 0)} of the ${f.num(ativos.length, 0)} flows that ONS tracks in the ATLS indicator were above the established limit for some time${lista.length ? `: ${listaTexto(lista, "en")}` : ""}${sem.length ? `; ${listaSem} ${sem.length === 1 ? "was" : "were"} not` : ""}.`,
        idioma,
      ),
    );
  } else {
    frases.push(tx("O indicador ATLS não tem fluxo publicado no último mês do arquivo.", "The ATLS indicator has no flow published in the last month of the file.", idioma));
  }
  const u = r.interrupcoes.ultimos_12_meses;
  if (u.inicio && u.fim) {
    frases.push(
      tx(
        `De ${f.dataBR(u.inicio)} a ${f.dataBR(u.fim)}, o ONS registrou ${f.plural(u.registros, "corte de carga", "cortes de carga")} em ${f.plural(u.perturbacoes, "perturbação", "perturbações")}, com ${f.num(u.ens_mwh, 1)} MWh de energia não suprida (${f.num(u.registros_rede_basica, 0)} dos registros na rede básica).`,
        `From ${f.dataBR(u.inicio)} to ${f.dataBR(u.fim)}, ONS recorded ${f.plural(u.registros, "load cut", "load cuts")} in ${f.plural(u.perturbacoes, "disturbance", "disturbances")}, with ${f.num(u.ens_mwh, 1)} MWh of energy not supplied (${f.num(u.registros_rede_basica, 0)} of the records in the basic grid).`,
        idioma,
      ),
    );
  }
  frases.push(
    tx(
      "Os limites operativos e as suas vigências não são públicos: nenhuma utilização da rede é calculada.",
      "The operating limits and their validity periods are not public: no grid utilization is calculated.",
      idioma,
    ),
  );
  return frases.join(" ");
}

/**
 * Veredito do P030 em palavras simples: em quantos dos fluxos acompanhados o tempo acima do limite foi diferente de zero e
 * quantos cortes de carga o ONS registrou, com o limite de leitura (os limites de cada fronteira não são públicos). O tempo de
 * cada fluxo, os períodos exatos e a energia não suprida ficam em respostaRestricoes.
 */
export function vereditoRestricoes(r: Pick<RestricoesRede, "atls" | "interrupcoes">, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const ativos = fluxosAtivos(r.atls);
  const com = ativos.filter((x) => (x.ultimos_12_meses?.horas_violacao ?? 0) > 0);
  const u = r.interrupcoes.ultimos_12_meses;
  const frases: string[] = [];
  const cortes = tx(
    f.plural(u.registros, "corte de carga", "cortes de carga"),
    f.plural(u.registros, "load cut", "load cuts"),
    idioma,
  );
  if (ativos.length && ativos[0].ultimos_12_meses) {
    frases.push(
      tx(
        `Em 12 meses, ${f.num(com.length, 0)} dos ${f.num(ativos.length, 0)} fluxos acompanhados pelo ONS passaram algum tempo acima do limite estabelecido${u.inicio && u.fim ? `, e houve ${cortes}` : ""}.`,
        `In 12 months, ${f.num(com.length, 0)} of the ${f.num(ativos.length, 0)} flows tracked by ONS spent some time above the established limit${u.inicio && u.fim ? `, and there were ${cortes}` : ""}.`,
        idioma,
      ),
    );
  } else if (u.inicio && u.fim) {
    frases.push(
      tx(
        `Em 12 meses, o ONS registrou ${cortes}; o indicador de tempo acima do limite não tem fluxo publicado no último mês.`,
        `In 12 months, ONS recorded ${cortes}; the time-above-limit indicator has no flow published in the last month.`,
        idioma,
      ),
    );
  } else {
    frases.push(tx("Não há evidência publicada de limitação na janela de 12 meses desta publicação.", "There is no published evidence of limitation in the 12-month window of this release.", idioma));
  }
  frases.push(tx("Os limites de cada fronteira não são públicos: isso não mostra se a rede estava no limite.", "The limits of each boundary are not public: this does not show whether the grid was at its limit.", idioma));
  return frases.join(" ");
}

export type LinhaInterrupcaoAno = {
  id: string;
  ano: string;
  parcial: string;
  registros: number | null;
  perturbacoes: number | null;
  ens_mwh: number | null;
  registros_rede_basica: number | null;
  ens_rede_basica_mwh: number | null;
  registros_100mw: number | null;
};

export function linhasInterrupcoesAno(i: Pick<RestricoesRede["interrupcoes"], "anual">, sm: SubsistemaOuSin, idioma: Idioma = idiomaEnergia()): LinhaInterrupcaoAno[] {
  const s = i.anual.por_sm[sm];
  return i.anual.anos.map((ano, k) => ({
    id: ano,
    ano: i.anual.parcial[k] ? tx(`${ano} (parcial)`, `${ano} (partial)`, idioma) : ano,
    parcial: simNao(!!i.anual.parcial[k], idioma),
    registros: s.registros[k] ?? null,
    perturbacoes: s.perturbacoes[k] ?? null,
    ens_mwh: s.ens_mwh[k] ?? null,
    registros_rede_basica: s.registros_rede_basica[k] ?? null,
    ens_rede_basica_mwh: s.ens_rede_basica_mwh[k] ?? null,
    registros_100mw: s.registros_100mw[k] ?? null,
  }));
}

export function colunasInterrupcoesAno(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto" }, // i18n: dado
    { id: "parcial", rotulo: tx("Ano parcial", "Partial year", idioma), tipo: "texto", categorica: true },
    { id: "registros", rotulo: tx("Registros de corte", "Load cut records", idioma), tipo: "numero", casas: 0 },
    { id: "perturbacoes", rotulo: tx("Perturbações", "Disturbances", idioma), tipo: "numero", casas: 0 },
    { id: "ens_mwh", rotulo: tx("Energia não suprida", "Energy not supplied", idioma), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "registros_rede_basica", rotulo: tx("Registros na rede básica", "Records in the basic grid", idioma), tipo: "numero", casas: 0 },
    { id: "ens_rede_basica_mwh", rotulo: tx("Energia não suprida, rede básica", "Energy not supplied, basic grid", idioma), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "registros_100mw", rotulo: tx("Registros com 100 MW ou mais", "Records with 100 MW or more", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_INTERRUPCOES_ANO: ColunaTabela[] = colunasInterrupcoesAno("pt");

export type LinhaPerturbacao = {
  id: string;
  cod_perturbacao: string;
  inicio: string;
  registros: number;
  ens_mwh: number;
  carga_interrompida_mw_soma: number;
  ufs: string;
  subsistemas: string;
  rede_basica: string;
};

export function linhasPerturbacoes(lista: readonly Perturbacao[], idioma: Idioma = idiomaEnergia()): LinhaPerturbacao[] {
  return lista.map((p) => ({
    id: `${p.cod_perturbacao}|${p.inicio}`,
    cod_perturbacao: p.cod_perturbacao,
    // o arquivo do ONS separa data e hora com espaço; com "T" a célula sai como 10/11/2009 22:13 e o arquivo baixado guarda os segundos
    inicio: p.inicio.replace(" ", "T"),
    registros: p.registros,
    ens_mwh: p.ens_mwh,
    carga_interrompida_mw_soma: p.carga_interrompida_mw_soma,
    ufs: p.ufs.join(", "),
    subsistemas: p.subsistemas.map((s) => (s in CURTO_SM ? curtoSm(s as SubsistemaOuSin, idioma) : s)).join(", "),
    rede_basica: simNao(p.rede_basica, idioma),
  }));
}

export function colunasPerturbacoes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "cod_perturbacao", rotulo: tx("Perturbação (código do ONS)", "Disturbance (ONS code)", idioma), tipo: "texto" },
    { id: "inicio", rotulo: tx("Início", "Start", idioma), tipo: "data" },
    { id: "registros", rotulo: tx("Registros", "Records", idioma), tipo: "numero", casas: 0 },
    { id: "ens_mwh", rotulo: tx("Energia não suprida", "Energy not supplied", idioma), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "carga_interrompida_mw_soma", rotulo: tx("Carga interrompida (soma dos registros)", "Interrupted load (sum of the records)", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "ufs", rotulo: tx("UF", "State", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "subsistemas", rotulo: tx("Subsistemas", "Subsystems", idioma), tipo: "texto" },
    { id: "rede_basica", rotulo: tx("Rede básica", "Basic grid", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_PERTURBACOES: ColunaTabela[] = colunasPerturbacoes("pt");

export function linhasBuscaLimites(busca: readonly BuscaLimite[]): { id: string; onde: string; resultado: string; url: string }[] {
  return busca.map((b, i) => ({ id: `busca-${i + 1}`, onde: b.onde, resultado: b.resultado, url: b.url }));
}

export function colunasBusca(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "onde", rotulo: tx("Onde se procurou", "Where it was searched", idioma), tipo: "texto", idiomaTexto: "portugues" },
    { id: "resultado", rotulo: tx("Resultado", "Result", idioma), tipo: "texto", idiomaTexto: "portugues" },
    { id: "url", rotulo: tx("Endereço consultado", "Address consulted", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_BUSCA: ColunaTabela[] = colunasBusca("pt");

/* ====================================================================== */
/* P031: programado e verificado                                           */
/* ====================================================================== */

export type BaseDesvio = "com" | "sem";

/** Estado distinto de "não" e de ausência: a regra não vale para a entidade (seção 11.6). */
export const NAO_SE_APLICA = "não se aplica"; // i18n: dado
export function naoSeAplica(idioma: Idioma = idiomaEnergia()): string {
  return tx(NAO_SE_APLICA, "not applicable", idioma);
}

/** A distribuição pedida: com todos os dias ou sem os dias rotulados por programa repetido. */
export function distribuicaoDe(p: Pick<ProgramadoRede, "distribuicao">, par: ParProgramado, base: BaseDesvio): DistribuicaoBase | null {
  const d = p.distribuicao[par];
  if (!d) return null;
  return base === "sem" ? (d.sem_dias_rotulados ?? d) : d;
}

export type LinhaDistribuicao = {
  id: ParProgramado;
  par: string;
  horas: number | null;
  vies_mwmed: number | null;
  desvio_abs_medio_mwmed: number | null;
  p50_abs_mwmed: number | null;
  p90_abs_mwmed: number | null;
  p99_abs_mwmed: number | null;
  max_abs_mwmed: number | null;
  horas_500: number | null;
  horas_1000: number | null;
  horas_2000: number | null;
  horas_inversao: number | null;
  programado_abs_mediano_mwmed: number | null;
  dias_rotulados_excluidos: number;
};

/** Uma linha por par (faixa de desvios, tabela e exportação usam as mesmas linhas). */
export function linhasDistribuicao(p: Pick<ProgramadoRede, "distribuicao">, base: BaseDesvio, idioma: Idioma = idiomaEnergia()): LinhaDistribuicao[] {
  return PARES_PROGRAMADO.map((par) => {
    const d = distribuicaoDe(p, par, base);
    const completa = p.distribuicao[par];
    return {
      id: par,
      par: nomePar(par, idioma),
      horas: d?.horas ?? null,
      vies_mwmed: d?.vies_mwmed ?? null,
      desvio_abs_medio_mwmed: d?.desvio_abs_medio_mwmed ?? null,
      p50_abs_mwmed: d?.p50_abs_mwmed ?? null,
      p90_abs_mwmed: d?.p90_abs_mwmed ?? null,
      p99_abs_mwmed: d?.p99_abs_mwmed ?? null,
      max_abs_mwmed: d?.max_abs_mwmed ?? null,
      horas_500: d?.horas_materiais["500"] ?? null,
      horas_1000: d?.horas_materiais["1000"] ?? null,
      horas_2000: d?.horas_materiais["2000"] ?? null,
      horas_inversao: d?.horas_inversao ?? null,
      programado_abs_mediano_mwmed: d?.programado_abs_mediano_mwmed ?? null,
      dias_rotulados_excluidos: base === "sem" ? (completa?.dias_rotulados ?? 0) : 0,
    };
  });
}

export type MedidasProgramado = {
  par: ParProgramado;
  nome: string;
  inicio: string;
  fim: string;
  /** Horas com programado e verificado comparáveis na base escolhida. */
  horas: number;
  desvio_abs_medio_mwmed: number;
  p50_abs_mwmed: number;
  /** Limiar material publicado (MWmed) e as horas com desvio nesse limiar ou acima. */
  limiar_mwmed: number;
  horas_materiais: number | null;
  /** Horas em que verificado e programado correram em sentidos opostos, os dois acima do limiar de zero. */
  horas_inversao: number;
  /** Dias rotulados por programa repetido que a base "sem" exclui (zero na base "com"). */
  dias_excluidos: number;
};

/**
 * Medidas da abertura do P031 para o par e a base escolhidos: o desvio absoluto médio e a mediana, as horas com desvio material e as horas
 * no sentido oposto ao programa. São os mesmos campos da distribuição (distribuicaoDe) que alimentam a resposta, a faixa de desvios, a
 * tabela e a exportação. Nulo quando o par não tem horas comparáveis.
 */
export function medidasProgramado(
  p: Pick<ProgramadoRede, "distribuicao" | "limiar_material_mwmed">,
  par: ParProgramado,
  base: BaseDesvio,
  idioma: Idioma = idiomaEnergia(),
): MedidasProgramado | null {
  const d = distribuicaoDe(p, par, base);
  if (!d) return null;
  const completa = p.distribuicao[par];
  return {
    par,
    nome: nomePar(par, idioma),
    inicio: d.inicio,
    fim: d.fim,
    horas: d.horas,
    desvio_abs_medio_mwmed: d.desvio_abs_medio_mwmed,
    p50_abs_mwmed: d.p50_abs_mwmed,
    limiar_mwmed: p.limiar_material_mwmed,
    horas_materiais: d.horas_materiais[String(p.limiar_material_mwmed) as "1000"] ?? null,
    horas_inversao: d.horas_inversao,
    dias_excluidos: base === "sem" ? (completa?.dias_rotulados ?? 0) : 0,
  };
}

/** Colunas da distribuição; os rótulos das contagens usam os limiares publicados na gold. */
export function colunasDistribuicao(p: Pick<ProgramadoRede, "limiar_material_mwmed">, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const f = formatos(idioma);
  const mw = tx("MWmed", "MWavg", idioma);
  const rotulo = (l: number) =>
    tx(
      `Horas com desvio de ${f.num(l, 0)} MWmed ou mais${l === p.limiar_material_mwmed ? " (materiais)" : ""}`,
      `Hours with a deviation of ${f.num(l, 0)} MWavg or more${l === p.limiar_material_mwmed ? " (material)" : ""}`,
      idioma,
    );
  return [
    { id: "par", rotulo: tx("Fronteira ou país", "Boundary or country", idioma), tipo: "texto" },
    { id: "horas", rotulo: tx("Horas comparadas", "Hours compared", idioma), tipo: "numero", casas: 0 },
    { id: "desvio_abs_medio_mwmed", rotulo: tx("Desvio absoluto médio", "Mean absolute deviation", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "p50_abs_mwmed", rotulo: tx("Mediana do desvio absoluto", "Median absolute deviation", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "p90_abs_mwmed", rotulo: tx("Percentil 90", "90th percentile", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "p99_abs_mwmed", rotulo: tx("Percentil 99", "99th percentile", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "max_abs_mwmed", rotulo: tx("Maior desvio absoluto", "Largest absolute deviation", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "vies_mwmed", rotulo: tx("Viés (verificado − programado)", "Bias (verified − scheduled)", idioma), tipo: "numero", unidade: mw, casas: 1 },
    ...LIMIARES.map((l): ColunaTabela => ({ id: `horas_${l}`, rotulo: rotulo(Number(l)), tipo: "numero", casas: 0 })),
    { id: "horas_inversao", rotulo: tx("Horas com sentido oposto ao programado", "Hours in the direction opposite to the schedule", idioma), tipo: "numero", casas: 0 },
    { id: "programado_abs_mediano_mwmed", rotulo: tx("Programa mediano (módulo)", "Median schedule (absolute value)", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "dias_rotulados_excluidos", rotulo: tx("Dias rotulados excluídos", "Flagged days excluded", idioma), tipo: "numero", casas: 0 },
  ];
}

const LIMIARES: readonly LimiarSensibilidade[] = ["500", "1000", "2000"];

/** "na fronteira Norte → Nordeste", "no intercâmbio com a Argentina". */
function nomeNoPar(par: ParProgramado, idioma: Idioma): string {
  return ehFronteira(par)
    ? tx(`na fronteira ${nomeFronteira(par, "pt")}`, `at the ${nomeFronteira(par, "en")} boundary`, idioma)
    : tx(`no intercâmbio com ${par === "ARGENTINA" ? "a Argentina" : "o Uruguai"}`, `in the interchange with ${NOME_PAIS_EN[par]}`, idioma);
}

/**
 * Resposta do P031 para o par escolhido: quanto o verificado se afastou do programa,
 * em média e na mediana, quantas horas passaram do limiar material e quantas tiveram
 * sentido oposto ao programado; com a base sem os dias rotulados quando pedida.
 * Desvio não é chamado de falha.
 */
export function respostaProgramado(
  p: Pick<ProgramadoRede, "distribuicao" | "limiar_material_mwmed" | "programa_repetido">,
  par: ParProgramado,
  base: BaseDesvio,
  idioma: Idioma = idiomaEnergia(),
): string {
  const f = formatos(idioma);
  const d = distribuicaoDe(p, par, base);
  if (!d) return tx(`Sem programado e verificado comparáveis para ${nomePar(par, "pt")}.`, `No comparable scheduled and verified values for ${nomePar(par, "en")}.`, idioma);
  const completa = p.distribuicao[par]!;
  const lim = p.limiar_material_mwmed;
  const nome = nomeNoPar(par, idioma);
  const sentido = d.vies_mwmed > 0 ? sentidoPositivo(par, idioma) : sentidoNegativo(par, idioma);
  const vies =
    d.vies_mwmed === 0
      ? tx("sem viés médio", "no average bias", idioma)
      : tx(
          `em média, o verificado ficou ${mwmed(Math.abs(d.vies_mwmed), 1, idioma)} deslocado em relação ao programa no sentido ${sentido}`,
          `on average, the verified flow was shifted ${mwmed(Math.abs(d.vies_mwmed), 1, idioma)} from the schedule in the direction ${sentido}`,
          idioma,
        );
  const materiais = f.num(d.horas_materiais[String(lim) as "1000"] ?? null, 0);
  const frases = [
    tx(
      `De ${f.dataBR(d.inicio)} a ${f.dataBR(d.fim)}, ${nome}, o fluxo verificado se afastou do programado em ${mwmed(d.desvio_abs_medio_mwmed, 1, idioma)} por hora, em média (mediana de ${mwmed(d.p50_abs_mwmed, 1, idioma)}); em ${materiais} das ${f.num(d.horas, 0)} horas a diferença chegou a ${f.num(lim, 0)} MWmed ou mais, e em ${f.num(d.horas_inversao, 0)} o fluxo correu no sentido oposto ao programado; ${vies}.`,
      `From ${f.dataBR(d.inicio)} to ${f.dataBR(d.fim)}, ${nome}, the verified flow deviated from the scheduled flow by ${mwmed(d.desvio_abs_medio_mwmed, 1, idioma)} per hour on average (median of ${mwmed(d.p50_abs_mwmed, 1, idioma)}); in ${materiais} of the ${f.num(d.horas, 0)} hours the difference reached ${f.num(lim, 0)} MWavg or more, and in ${f.num(d.horas_inversao, 0)} the flow ran opposite to the schedule; ${vies}.`,
      idioma,
    ),
  ];
  const rot = completa.dias_rotulados;
  const dias = listaTexto(
    p.programa_repetido.dias.map((x) => f.dataBR(x.dia)),
    idioma,
  );
  if (rot > 0 && ehFronteira(par)) {
    if (base === "sem")
      frases.push(
        tx(
          `Esta base exclui ${f.plural(rot, "dia rotulado", "dias rotulados")} por programa repetido (${dias}); com ${rot === 1 ? "ele" : "eles"}, a média seria ${mwmed(completa.desvio_abs_medio_mwmed, 1, idioma)}.`,
          `This basis excludes ${f.plural(rot, "day flagged", "days flagged")} for a repeated schedule (${dias}); with ${rot === 1 ? "it" : "them"}, the average would be ${mwmed(completa.desvio_abs_medio_mwmed, 1, idioma)}.`,
          idioma,
        ),
      );
    else if (completa.sem_dias_rotulados)
      frases.push(
        tx(
          `Sem ${rot === 1 ? "o dia rotulado" : "os dias rotulados"} por programa repetido (${dias}), a média cai para ${mwmed(completa.sem_dias_rotulados.desvio_abs_medio_mwmed, 1, idioma)}.`,
          `Without the ${rot === 1 ? "day" : "days"} flagged for a repeated schedule (${dias}), the average drops to ${mwmed(completa.sem_dias_rotulados.desvio_abs_medio_mwmed, 1, idioma)}.`,
          idioma,
        ),
      );
  }
  return frases.join(" ");
}

/**
 * Veredito do P031 em palavras simples: quanto o fluxo medido se afastou do programa, em média, para o par e a base
 * escolhidos, ao lado do tamanho do programa (a mediana do programado em módulo) quando ele existe. Mediana, percentis,
 * horas acima do limiar e horas no sentido oposto ficam em respostaProgramado. Desvio não é falha.
 */
export function vereditoProgramado(
  p: Pick<ProgramadoRede, "distribuicao" | "limiar_material_mwmed" | "programa_repetido">,
  par: ParProgramado,
  base: BaseDesvio,
  idioma: Idioma = idiomaEnergia(),
): string {
  const f = formatos(idioma);
  const d = distribuicaoDe(p, par, base);
  if (!d) return tx(`Sem programado e verificado comparáveis para ${nomePar(par, "pt")}.`, `No comparable scheduled and verified values for ${nomePar(par, "en")}.`, idioma);
  const nome = nomeNoPar(par, idioma);
  const tamanho =
    d.programado_abs_mediano_mwmed > 0
      ? tx(
          `O programa, em módulo, tem mediana de ${mwmed(d.programado_abs_mediano_mwmed, 0, idioma)}.`,
          `The schedule, in absolute value, has a median of ${mwmed(d.programado_abs_mediano_mwmed, 0, idioma)}.`,
          idioma,
        )
      : tx("A mediana do programa, em módulo, é zero.", "The median of the schedule, in absolute value, is zero.", idioma);
  const semRotulados =
    base === "sem" && ehFronteira(par) && p.distribuicao[par] && p.distribuicao[par]!.dias_rotulados > 0
      ? tx(", sem os dias rotulados por programa repetido", ", without the days flagged for a repeated schedule", idioma)
      : "";
  return tx(
    `Desde ${f.dataBR(d.inicio)}, ${nome}, o fluxo medido se afastou do programado em ${mwmed(d.desvio_abs_medio_mwmed, 1, idioma)} por hora, em média${semRotulados}. ${tamanho} Desvio não é falha; a fonte não informa o motivo.`,
    `Since ${f.dataBR(d.inicio)}, ${nome}, the measured flow deviated from the scheduled flow by ${mwmed(d.desvio_abs_medio_mwmed, 1, idioma)} per hour on average${semRotulados}. ${tamanho} A deviation is not a failure; the source does not state the reason.`,
    idioma,
  );
}

export type LinhaDiaProgramado = {
  id: string;
  d: string;
  programado_mwh: number | null;
  verificado_mwh: number | null;
  desvio_abs_mwh: number | null;
  horas_materiais: number | null;
  horas_inversao: number | null;
  dia_rotulado: string;
};

export function linhasProgramadoDiario(p: Pick<ProgramadoRede, "diario" | "programa_repetido">, par: ParProgramado, idioma: Idioma = idiomaEnergia()): LinhaDiaProgramado[] {
  const s = p.diario.por_par[par];
  const rotulados = new Set(p.programa_repetido.dias.map((x) => x.dia));
  return p.diario.dias.map((d, i) => ({
    id: d,
    d,
    programado_mwh: s.programado_mwh[i] ?? null,
    verificado_mwh: s.verificado_mwh[i] ?? null,
    desvio_abs_mwh: s.desvio_abs_mwh[i] ?? null,
    horas_materiais: s.horas_materiais[i] ?? null,
    horas_inversao: s.horas_inversao[i] ?? null,
    // a regra do programa repetido só rotula dias das fronteiras; nos países ela não se aplica (regra publicada na gold)
    dia_rotulado: ehFronteira(par) ? simNao(rotulados.has(d), idioma) : naoSeAplica(idioma),
  }));
}

export function colunasProgramadoDiario(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "d", rotulo: tx("Dia", "Day", idioma), tipo: "data" },
    { id: "programado_mwh", rotulo: tx("Programado (saldo do dia)", "Scheduled (net for the day)", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "verificado_mwh", rotulo: tx("Verificado (saldo do dia)", "Verified (net for the day)", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "desvio_abs_mwh", rotulo: tx("Soma dos desvios absolutos", "Sum of absolute deviations", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas_materiais", rotulo: tx("Horas materiais", "Material hours", idioma), tipo: "numero", casas: 0 },
    { id: "horas_inversao", rotulo: tx("Horas com sentido oposto", "Hours in the opposite direction", idioma), tipo: "numero", casas: 0 },
    { id: "dia_rotulado", rotulo: tx("Dia rotulado (programa repetido)", "Flagged day (repeated schedule)", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_PROGRAMADO_DIARIO: ColunaTabela[] = colunasProgramadoDiario("pt");

export type LinhaMesProgramado = {
  id: string;
  m: string;
  horas: number | null;
  programado_mwh: number | null;
  verificado_mwh: number | null;
  desvio_abs_mwh: number | null;
  horas_materiais: number | null;
  horas_inversao: number | null;
  dias_rotulados: number | null;
};

export function linhasProgramadoMensal(p: Pick<ProgramadoRede, "mensal">, par: ParProgramado): LinhaMesProgramado[] {
  const s = p.mensal.por_par[par];
  return p.mensal.meses.map((m, i) => ({
    id: m,
    m,
    horas: s.horas[i] ?? null,
    programado_mwh: s.programado_mwh[i] ?? null,
    verificado_mwh: s.verificado_mwh[i] ?? null,
    desvio_abs_mwh: s.desvio_abs_mwh[i] ?? null,
    horas_materiais: s.horas_materiais[i] ?? null,
    horas_inversao: s.horas_inversao[i] ?? null,
    // nos países a regra não rotula dias: a coluna sai da tabela (colunasProgramadoMensal), em vez de mostrar zero
    dias_rotulados: ehFronteira(par) ? (p.mensal.dias_rotulados[i] ?? null) : null,
  }));
}

function colunasProgramadoMensalTodas(idioma: Idioma): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "data" },
    { id: "horas", rotulo: tx("Horas comparadas", "Hours compared", idioma), tipo: "numero", casas: 0 },
    { id: "programado_mwh", rotulo: tx("Programado (saldo do mês)", "Scheduled (net for the month)", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "verificado_mwh", rotulo: tx("Verificado (saldo do mês)", "Verified (net for the month)", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "desvio_abs_mwh", rotulo: tx("Soma dos desvios absolutos", "Sum of absolute deviations", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas_materiais", rotulo: tx("Horas materiais", "Material hours", idioma), tipo: "numero", casas: 0 },
    { id: "horas_inversao", rotulo: tx("Horas com sentido oposto", "Hours in the opposite direction", idioma), tipo: "numero", casas: 0 },
    { id: "dias_rotulados", rotulo: tx("Dias rotulados no mês", "Flagged days in the month", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_PROGRAMADO_MENSAL: ColunaTabela[] = colunasProgramadoMensalTodas("pt");

/** Nos países a coluna de dias rotulados não se aplica (a regra só rotula dias das fronteiras) e sai da tabela. */
export function colunasProgramadoMensal(par: ParProgramado, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const todas = colunasProgramadoMensalTodas(idioma);
  return ehFronteira(par) ? todas : todas.filter((c) => c.id !== "dias_rotulados");
}

/** Horas do mês no calendário (AAAA-MM), sem horário de verão: o Brasil não o adota desde 2019. */
export function horasDoMes(m: string): number {
  const [a, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(a, mm, 0)).getUTCDate() * 24;
}

/**
 * Aviso de mês incompleto na série mensal do programado: só quando as horas comparadas
 * do último mês ficam abaixo das horas do calendário (o texto nunca afirma parcial sem
 * conferir). Sem horas, não há aviso.
 */
export function avisoMesIncompleto(m: string | undefined, horasComparadas: number | null | undefined, idioma: Idioma = idiomaEnergia()): string | null {
  if (!m || horasComparadas === null || horasComparadas === undefined) return null;
  const f = formatos(idioma);
  const cal = horasDoMes(m);
  if (horasComparadas >= cal) return null;
  return tx(
    `${f.mesAno(m)} tem ${f.num(horasComparadas, 0)} de ${f.num(cal, 0)} horas comparadas: as contagens desse mês não se comparam diretamente com as dos meses completos.`,
    `${f.mesAno(m)} has ${f.num(horasComparadas, 0)} of ${f.num(cal, 0)} hours compared: the counts for that month are not directly comparable with those of complete months.`,
    idioma,
  );
}

/** Horas materiais por mês dos pares escolhidos (até quatro). */
export function linhasMateriaisMensal(p: Pick<ProgramadoRede, "mensal">, pares: readonly ParProgramado[]): ({ id: string; m: string } & Partial<Record<ParProgramado, number | null>>)[] {
  return p.mensal.meses.map((m, i) => ({ id: m, m, ...Object.fromEntries(pares.map((x) => [x, p.mensal.por_par[x].horas_materiais[i] ?? null])) }));
}

export type LinhaMaiorDesvio = {
  id: string;
  hora: string;
  par: string;
  programado_mwmed: number;
  verificado_mwmed: number;
  desvio_mwmed: number;
  inversao: string;
  dia_rotulado: string;
};

export function linhasMaioresDesvios(lista: readonly MaiorDesvio[], idioma: Idioma = idiomaEnergia()): LinhaMaiorDesvio[] {
  return lista.map((x) => ({
    id: `${x.hora}|${x.par}`,
    hora: x.hora,
    par: nomePar(x.par, idioma),
    programado_mwmed: x.programado_mwmed,
    verificado_mwmed: x.verificado_mwmed,
    desvio_mwmed: x.desvio_mwmed,
    inversao: simNao(x.inversao, idioma),
    dia_rotulado: ehFronteira(x.par) ? simNao(x.dia_rotulado, idioma) : naoSeAplica(idioma),
  }));
}

export function colunasMaioresDesvios(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "hora", rotulo: tx("Hora (início, Brasília)", "Hour (start, Brasília)", idioma), tipo: "data" },
    { id: "par", rotulo: tx("Fronteira ou país", "Boundary or country", idioma), tipo: "texto", categorica: true },
    { id: "programado_mwmed", rotulo: tx("Programado", "Scheduled", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "verificado_mwmed", rotulo: tx("Verificado", "Verified", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "desvio_mwmed", rotulo: tx("Desvio (verificado − programado)", "Deviation (verified − scheduled)", idioma), tipo: "numero", unidade: mw, casas: 1 },
    { id: "inversao", rotulo: tx("Sentido oposto ao programa", "Opposite to the schedule", idioma), tipo: "texto", categorica: true },
    { id: "dia_rotulado", rotulo: tx("Dia rotulado", "Flagged day", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_MAIORES_DESVIOS: ColunaTabela[] = colunasMaioresDesvios("pt");

export type LinhaProgramaRepetido = {
  id: string;
  dia: string;
  fronteira: string;
  programado_mwh: number | null;
  verificado_mwh: number | null;
  desvio_abs_mwh: number | null;
  horas_materiais: number | null;
  sequencia: string;
};

/** Os dias rotulados por programa repetido, uma linha por fronteira. */
export function linhasProgramaRepetido(p: Pick<ProgramadoRede, "programa_repetido">, idioma: Idioma = idiomaEnergia()): LinhaProgramaRepetido[] {
  const f = formatos(idioma);
  return p.programa_repetido.dias.flatMap((d) =>
    FRONTEIRAS.map((par) => {
      const x = d.por_par[par];
      const seq = d.sequencias.filter((s) => s.par === par);
      return {
        id: `${d.dia}|${par}`,
        dia: d.dia,
        fronteira: nomeFronteira(par, idioma),
        programado_mwh: x?.programado_mwh ?? null,
        verificado_mwh: x?.verificado_mwh ?? null,
        desvio_abs_mwh: x?.desvio_abs_mwh ?? null,
        horas_materiais: x?.horas_materiais ?? null,
        sequencia: seq.length
          ? seq
              .map((s) =>
                tx(
                  `${f.plural(s.horas, "hora", "horas")} seguidas com ${mwmed(s.valor_mwmed, 3, idioma)}`,
                  `${f.plural(s.horas, "consecutive hour", "consecutive hours")} at ${mwmed(s.valor_mwmed, 3, idioma)}`,
                  idioma,
                ),
              )
              .join("; ")
          : tx("nenhuma", "none", idioma),
      };
    }),
  );
}

export function colunasProgramaRepetido(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "dia", rotulo: tx("Dia", "Day", idioma), tipo: "data" }, // i18n: dado
    { id: "fronteira", rotulo: tx("Fronteira", "Boundary", idioma), tipo: "texto" },
    { id: "programado_mwh", rotulo: tx("Programado (saldo do dia)", "Scheduled (net for the day)", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "verificado_mwh", rotulo: tx("Verificado (saldo do dia)", "Verified (net for the day)", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "desvio_abs_mwh", rotulo: tx("Soma dos desvios absolutos", "Sum of absolute deviations", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "horas_materiais", rotulo: tx("Horas materiais", "Material hours", idioma), tipo: "numero", casas: 0 },
    { id: "sequencia", rotulo: tx("Programa repetido", "Repeated schedule", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_PROGRAMA_REPETIDO: ColunaTabela[] = colunasProgramaRepetido("pt");

/** Frase sobre os dias rotulados (sem afirmar se o programa é real ou defeito do arquivo). */
export function textoProgramaRepetido(p: Pick<ProgramadoRede, "programa_repetido">, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const dias = p.programa_repetido.dias;
  if (!dias.length)
    return tx(
      `Nenhum dia com programa repetido por ${p.programa_repetido.minimo_horas} horas seguidas ou mais numa fronteira.`,
      `No day with a schedule repeated for ${p.programa_repetido.minimo_horas} consecutive hours or more at a boundary.`,
      idioma,
    );
  const partes = dias.map((d) => {
    const seqs = listaTexto(
      d.sequencias.map((s) =>
        tx(
          `${nomeFronteira(s.par, "pt")} com ${mwmed(s.valor_mwmed, 3, idioma)} em ${f.plural(s.horas, "hora seguida", "horas seguidas")}`,
          `${nomeFronteira(s.par, "en")} at ${mwmed(s.valor_mwmed, 3, idioma)} for ${f.plural(s.horas, "consecutive hour", "consecutive hours")}`,
          idioma,
        ),
      ),
      idioma,
    );
    return `${f.dataBR(d.dia)} (${seqs})`;
  });
  return tx(
    `${dias.length === 1 ? "Dia rotulado" : "Dias rotulados"} por programa repetido: ${listaTexto(partes, "pt")}. ${dias.length === 1 ? "O dia não é descartado" : "Os dias não são descartados"}: a distribuição sai com e sem ${dias.length === 1 ? "ele" : "eles"}, e nada aqui afirma se o programa é real ou defeito do arquivo.`,
    `${dias.length === 1 ? "Day flagged" : "Days flagged"} for a repeated schedule: ${listaTexto(partes, "en")}. ${dias.length === 1 ? "The day is not discarded" : "The days are not discarded"}: the distribution is shown with and without ${dias.length === 1 ? "it" : "them"}, and nothing here states whether the schedule is real or a file defect.`,
    idioma,
  );
}

/** Conferência do programa do exterior com o PDO das conversoras, em uma frase. */
export function textoConferenciaPdo(p: Pick<ProgramadoRede, "versao_programa">, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const c = p.versao_programa.conferencia_pdo;
  const diasSem = listaTexto(
    c.dias_sem_programado_no_conjunto.map((x) => f.dataBR(x)),
    idioma,
  );
  const sem = c.dias_sem_programado_no_conjunto.length
    ? tx(`; ${diasSem} ainda sem programado no conjunto internacional`, `; ${diasSem} still without scheduled values in the international dataset`, idioma)
    : "";
  return tx(
    `Programa do exterior conferido com o PDO das conversoras em ${f.num(c.dias_comparados, 0)} de ${f.num(c.dias, 0)} dias da amostra (${c.amostra}${sem}): ${f.num(c.horas_conferem, 0)} de ${f.num(c.horas, 0)} horas conferem dentro de ${f.num(c.tolerancia_mwmed, 1)} MWmed, ${f.num(c.horas_com_programa_ou_pdo_conferem, 0)} de ${f.num(c.horas_com_programa_ou_pdo, 0)} entre as horas com programa ou PDO diferente de zero.`,
    `Exterior schedule checked against the converter stations' PDO on ${f.num(c.dias_comparados, 0)} of ${f.num(c.dias, 0)} sample days (${c.amostra}${sem}): ${f.num(c.horas_conferem, 0)} of ${f.num(c.horas, 0)} hours agree within ${f.num(c.tolerancia_mwmed, 1)} MWavg, ${f.num(c.horas_com_programa_ou_pdo_conferem, 0)} of ${f.num(c.horas_com_programa_ou_pdo, 0)} among the hours with a nonzero schedule or PDO.`,
    idioma,
  );
}

/* ---------- utilidades comuns às tabelas ---------- */

/** Mês "2026-09" como "set/2026" na coluna de texto (o arquivo exportado mantém o mês ISO na chave). */
export function rotuloMes(m: string, idioma: Idioma = idiomaEnergia()): string {
  return mesAno(m, idioma);
}

export { mwh as textoMwh, mwmed as textoMwmed, horas as textoHoras };
