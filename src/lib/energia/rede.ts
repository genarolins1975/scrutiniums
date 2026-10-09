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
 * Sinais (iguais aos da gold): fronteira na orientação N→NE, N→SE/CO, NE→SE/CO e
 * S→SE/CO, positivo da primeira para a segunda região; exterior positivo é exportação
 * do Brasil; desvio = verificado − programado na mesma orientação.
 */
import { dataBR, horaLocal, mesAno, num, plural, reais } from "./formato";
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
export const PERGUNTA_MODULO_REDE = "Como a energia circula entre regiões e que restrições são documentadas?";

/**
 * Um painel por página: cada um tem séries, várias tabelas equivalentes e fichas de
 * prova; juntos passariam da meta de cerca de 600 KB de HTML por página (contrato,
 * seção 5.1). As perguntas são as do Anexo A; a do P030 é a pergunta própria que os
 * dados públicos sustentam (os limites operativos não são públicos, achado A06).
 */
export const PAINEIS_REDE: { id: PainelRede; rotulo: string; caminho: string; pergunta: string }[] = [
  { id: "p028", rotulo: "Circulação de energia", caminho: "", pergunta: "Como a energia circula entre regiões?" },
  { id: "p029", rotulo: "Balanço e exterior", caminho: "/balanco-e-exterior", pergunta: "As contas do balanço de energia fecham?" },
  { id: "p030", rotulo: "Restrições publicadas", caminho: "/restricoes", pergunta: "Quando há evidência publicada de limitação da rede?" },
  { id: "p031", rotulo: "Programado e verificado", caminho: "/programado", pergunta: "Quanto o fluxo divergiu do programa?" },
];

export function rotaPainel(id: PainelRede): string {
  return `${ROTA_REDE}${PAINEIS_REDE.find((p) => p.id === id)?.caminho ?? ""}`;
}

export function perguntaPainel(id: PainelRede): string {
  return PAINEIS_REDE.find((p) => p.id === id)?.pergunta ?? "";
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
const PARA_O: Record<SubsistemaOuSin, string> = { SE: "para o Sudeste/Centro-Oeste", S: "para o Sul", NE: "para o Nordeste", N: "para o Norte", SIN: "para o SIN" };
const NO: Record<SubsistemaOuSin, string> = { SE: "no Sudeste/Centro-Oeste", S: "no Sul", NE: "no Nordeste", N: "no Norte", SIN: "no SIN" };
export const NOME_PAIS: Record<PaisRede, string> = { ARGENTINA: "Argentina", URUGUAI: "Uruguai", PARAGUAI: "Paraguai" };

/** As duas pontas de cada fronteira, na orientação da gold. */
export const PONTAS: Record<FronteiraRede, [Submercado, Submercado]> = { N_NE: ["N", "NE"], N_SE: ["N", "SE"], NE_SE: ["NE", "SE"], S_SE: ["S", "SE"] };

export const COR_SM: Record<SubsistemaOuSin, string> = {
  SIN: "var(--cor-energia)",
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
export function nomeFronteira(par: FronteiraRede): string {
  const [a, b] = PONTAS[par];
  return `${NOME_SM[a]} → ${NOME_SM[b]}`;
}

/** "N→SE/CO". */
export function curtoFronteira(par: FronteiraRede): string {
  const [a, b] = PONTAS[par];
  return `${CURTO_SM[a]}→${CURTO_SM[b]}`;
}

/** "entre Norte e Sudeste/Centro-Oeste": a fronteira sem sentido. */
export function entreFronteira(par: FronteiraRede): string {
  const [a, b] = PONTAS[par];
  return `entre ${NOME_SM[a]} e ${NOME_SM[b]}`;
}

export function ehFronteira(par: string): par is FronteiraRede {
  return (FRONTEIRAS as readonly string[]).includes(par);
}

/** Fronteira pelo nome da orientação; país pelo nome (positivo = exportação do Brasil). */
export function nomePar(par: ParProgramado): string {
  return ehFronteira(par) ? nomeFronteira(par) : NOME_PAIS[par];
}

export function curtoPar(par: ParProgramado): string {
  return ehFronteira(par) ? curtoFronteira(par) : NOME_PAIS[par];
}

/** Sentido positivo do par, em palavras ("do Norte para o Nordeste", "do Brasil para a Argentina"). */
export function sentidoPositivo(par: ParProgramado): string {
  if (ehFronteira(par)) {
    const [a, b] = PONTAS[par];
    return `${DO_SM[a]} ${PARA_O[b]}`;
  }
  return `do Brasil para ${par === "ARGENTINA" ? "a Argentina" : "o Uruguai"}`;
}

/** Sentido negativo do par, em palavras. */
export function sentidoNegativo(par: ParProgramado): string {
  if (ehFronteira(par)) {
    const [a, b] = PONTAS[par];
    return `${DO_SM[b]} ${PARA_O[a]}`;
  }
  return `${par === "ARGENTINA" ? "da Argentina" : "do Uruguai"} para o Brasil`;
}

/* ---------- utilidades de texto ---------- */

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "a, b e c". */
export function listaTexto(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** "a; b; e c": para itens que já têm vírgula dentro. */
export function listaLonga(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join("; ")}; e ${itens[itens.length - 1]}`;
}

/** "entre 01/01/2026 e 14/05/2026" ou "em 14/09/2022" quando é o mesmo dia. */
function entreDatas(a: string, b: string): string {
  return a.slice(0, 10) === b.slice(0, 10) ? `em ${dataBR(a)}` : `entre ${dataBR(a)} e ${dataBR(b)}`;
}

const mwh = (v: number | null | undefined) => `${num(v, 0)} MWh`;
const mwmed = (v: number | null | undefined, casas = 0) => `${num(v, casas)} MWmed`;
const horas = (v: number | null | undefined, casas = 0) => (v === null || v === undefined ? "sem dado" : casas === 0 ? plural(v, "hora", "horas") : `${num(v, casas)} ${v === 1 ? "hora" : "horas"}`);

/**
 * Datas ISO que o pipeline escreve dentro de frases (achado A05) em formato brasileiro:
 * "AAAA-MM-DDTHH:00" vira "DD/MM/AAAA às HHh" e "AAAA-MM-DD" vira "DD/MM/AAAA". Só a
 * forma muda; números e palavras ficam como vieram.
 */
export function datasLegiveis(texto: string): string {
  return texto
    .replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):00/g, (_, a, m, d, h) => `${d}/${m}/${a} às ${h}h`)
    .replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/g, (_, a, m, d, h, mi) => `${d}/${m}/${a} às ${h}h${mi}`)
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
export const ROTULO_REGRA: Record<string, string> = {
  orientacao: "Orientação e sinal",
  energia: "Energia",
  bruto_liquido: "Bruto e líquido",
  nulo: "Fluxo nulo",
  pld: "PLD na mesma hora",
  balanco: "Identidades do balanço",
  tolerancia_balanco: "Tolerância do balanço",
  limites: "Limites de intercâmbio",
  materialidade: "Materialidade do desvio",
};

/** Booleanos e listas viram texto para a tabela (sim/não; itens separados por vírgula). */
export function paraTabela<T extends object>(linhas: readonly T[]): LinhaTabela[] {
  return linhas.map((l) =>
    Object.fromEntries(
      Object.entries(l)
        .filter(([, v]) => v === null || typeof v !== "object" || Array.isArray(v))
        .map(([k, v]) => [k, typeof v === "boolean" ? (v ? "sim" : "não") : Array.isArray(v) ? v.join(", ") : (v as ValorCelula)]),
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
export function situacaoAtualidade(diaReferencia: string, geradoEm: string, folgaDias = 3): { defasada: boolean; dias: number; texto: string } {
  const proc = diaDeBrasilia(geradoEm);
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - Date.parse(`${diaReferencia.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  if (dias > folgaDias) {
    return {
      defasada: true,
      dias,
      texto: `Fonte defasada: o dia mais recente é ${dataBR(diaReferencia)}, ${plural(dias, "dia", "dias")} antes do processamento (${dataBR(proc)}), mais que o atraso habitual de publicação do ONS. Os números são os da última publicação válida.`,
    };
  }
  return { defasada: false, dias, texto: `Dado até ${dataBR(diaReferencia)}, processado em ${dataBR(proc)} (${plural(dias, "dia", "dias")} depois).` };
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
export function rotuloSentidoSaldo(par: FronteiraRede, liquido: number | null | undefined): string {
  if (liquido === null || liquido === undefined) return "sem dado";
  const s = sentidoDoSaldo(par, liquido);
  return s ? `${CURTO_SM[s.origem]}→${CURTO_SM[s.destino]}` : "sem saldo";
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
export function respostaCirculacao(resumo: readonly ResumoFronteira30d[]): string {
  if (!resumo.length) return "Sem fluxo publicado na janela de 30 dias.";
  const inicio = resumo.map((r) => r.inicio).sort()[0];
  const fim = resumo.map((r) => r.fim).sort().at(-1)!;
  const saldos: string[] = [];
  const sem: string[] = [];
  for (const r of resumo) {
    if (r.horas === 0) {
      sem.push(entreFronteira(r.par));
      continue;
    }
    const s = sentidoDoSaldo(r.par, r.liquido_mwh);
    saldos.push(s ? `${DO_SM[s.origem]} ${PARA_O[s.destino]} (${mwh(Math.abs(r.liquido_mwh))})` : `${entreFronteira(r.par)}, saldo nulo`);
  }
  const frases = [`De ${dataBR(inicio)} a ${dataBR(fim)}, o saldo de energia foi ${listaTexto(saldos)}.`];
  const comDado = resumo.filter((r) => r.horas > 0);
  const umSentido = comDado.filter((r) => horasContraSaldo(r) === 0);
  const doisSentidos = comDado.filter((r) => horasContraSaldo(r) > 0);
  if (umSentido.length === comDado.length) {
    frases.push(`Em nenhuma das fronteiras o fluxo passou de ${mwmed(LIMIAR_NULO_MWMED)} no sentido contrário ao saldo, então o saldo não esconde energia.`);
  } else {
    const partes = doisSentidos.map((r) => `${mwh(r.contra_saldo_mwh)} ${entreFronteira(r.par)} (${num(horasContraSaldo(r), 0)} de ${num(r.horas, 0)} horas)`);
    const um = umSentido.length
      ? `${umSentido.length === 1 ? "Uma fronteira" : `${cap(numeroPorExtenso(umSentido.length))} fronteiras`} ${umSentido.length === 1 ? "teve" : "tiveram"} fluxo num só sentido (${listaTexto(umSentido.map((r) => entreFronteira(r.par)))}); `
      : "";
    frases.push(`${um}${um ? "nas outras" : "Em todas"}, o saldo esconde energia que passou no sentido contrário: ${listaTexto(partes)}.`);
  }
  const incompletos = comDado.filter((r) => r.dias_completos < r.dias);
  if (incompletos.length) frases.push(`Janela com dias incompletos em ${listaTexto(incompletos.map((r) => `${entreFronteira(r.par)} (${r.dias_completos} de ${r.dias} dias com as 24 horas)`))}.`);
  if (sem.length) frases.push(`Sem fluxo publicado ${listaTexto(sem)}.`);
  return frases.join(" ");
}

function numeroPorExtenso(n: number): string {
  return ["zero", "uma", "duas", "três", "quatro"][n] ?? String(n);
}

/** "o Sudeste/Centro-Oeste", "o Norte": a região com o artigo, para frases com sujeito. */
const O_SM: Record<SubsistemaOuSin, string> = { SE: "o Sudeste/Centro-Oeste", S: "o Sul", NE: "o Nordeste", N: "o Norte", SIN: "o SIN" };

/**
 * Veredito do P028 em palavras simples: para onde a energia foi no saldo dos últimos 30 dias e se o saldo esconde energia
 * que passou no sentido contrário. As quantidades de cada fronteira ficam em respostaCirculacao; aqui só o maior valor
 * escondido, lido dos mesmos campos (contra_saldo_mwh).
 */
export function vereditoCirculacao(resumo: readonly ResumoFronteira30d[]): string {
  const comDado = resumo.filter((r) => r.horas > 0);
  if (!comDado.length) return "Sem fluxo publicado na janela de 30 dias.";
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
    .map(([destino, origens], i) => `${O_SM[destino]} recebeu ${i === 0 ? "energia " : ""}${listaTexto(origens.map((o) => DO_SM[o]))}`);
  const frases = [`Nos ${dias} dias até ${dataBR(fim)}, ${recebimentos.length ? recebimentos.join("; ") : "o saldo foi nulo em todas as fronteiras com fluxo publicado"}.`];
  const escondem = comDado.filter((r) => horasContraSaldo(r) > 0);
  if (!escondem.length) {
    frases.push("Em nenhuma fronteira o saldo esconde energia que passou no sentido contrário.");
  } else {
    const maior = Math.max(...escondem.map((r) => r.contra_saldo_mwh));
    const onde = escondem.length === 1 ? "Em uma fronteira" : `Em ${numeroPorExtenso(escondem.length)} fronteiras`;
    frases.push(`${onde}, o saldo esconde energia que passou no sentido contrário: ${escondem.length === 1 ? "" : "até "}${mwh(maior)}.`);
  }
  return frases.join(" ");
}

/** Preço nas pontas, nas horas da janela de 30 dias: separação descrita, sem diagnóstico. */
export function textoPrecos30d(resumo: readonly ResumoFronteira30d[]): string {
  const partes = resumo
    .filter((r) => r.horas_pld > 0)
    .map((r) => {
      const base = `${entreFronteira(r.par)}, ${num(r.horas_precos_separados, 0)} de ${num(r.horas_pld, 0)} horas com PLD`;
      if (!r.horas_precos_separados) return base;
      return `${base} (fluxo do mais barato para o mais caro em ${num(r.horas_separados_fluxo_para_mais_caro, 0)}, do mais caro para o mais barato em ${num(r.horas_separados_fluxo_para_mais_barato, 0)})`;
    });
  if (!partes.length) return "Sem PLD publicado nas horas da janela.";
  return `Horas em que os PLDs das duas pontas diferiram mais de ${reais(LIMIAR_PRECOS_RS_MWH)}/MWh na mesma hora do fluxo: ${listaLonga(partes)}. É descrição da coincidência entre preço e fluxo, não diagnóstico de fronteira no limite.`;
}

/** Sentido do saldo em palavras ("do Nordeste para o Norte"); null quando o saldo é ausente ou nulo. */
export function textoSentidoSaldo(par: FronteiraRede, liquido: number | null | undefined): string | null {
  const s = sentidoDoSaldo(par, liquido);
  return s ? `${DO_SM[s.origem]} ${PARA_O[s.destino]}` : null;
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
export function medidasFronteiras30d(resumo: readonly ResumoFronteira30d[]): MedidaFronteira30d[] {
  return FRONTEIRAS.map((par) => {
    const r = resumo.find((x) => x.par === par);
    if (!r || r.horas === 0) {
      return {
        par,
        rotulo: `Saldo em 30 dias, ${entreFronteira(par)}`,
        valor: null,
        periodo: r ? `${dataBR(r.inicio)} a ${dataBR(r.fim)}` : "",
        nota: "Sem fluxo publicado na janela.",
      };
    }
    const sentido = textoSentidoSaldo(par, r.liquido_mwh);
    const contra = horasContraSaldo(r) === 0 ? `Fluxo num só sentido nas ${num(r.horas, 0)} horas.` : `No sentido contrário: ${mwh(r.contra_saldo_mwh)}.`;
    const trocas = r.dias_com_reversao > 0 ? ` Troca de sentido em ${num(r.dias_com_reversao, 0)} de ${num(r.dias, 0)} dias.` : "";
    return {
      par,
      rotulo: `Saldo em ${plural(r.dias, "dia", "dias")}, ${sentido ?? entreFronteira(par)}`,
      valor: Math.abs(r.liquido_mwh),
      periodo: `${dataBR(r.inicio)} a ${dataBR(r.fim)}`,
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
export function linhasResumo30d(resumo: readonly ResumoFronteira30d[]): LinhaResumo30d[] {
  return resumo.map((r) => ({
    id: r.par,
    fronteira: nomeFronteira(r.par),
    inicio: r.inicio,
    fim: r.fim,
    dias_completos: r.dias_completos,
    horas: r.horas,
    sentido_saldo: rotuloSentidoSaldo(r.par, r.liquido_mwh),
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

export const COLUNAS_RESUMO_30D: ColunaTabela[] = [
  { id: "fronteira", rotulo: "Fronteira (sentido positivo)", tipo: "texto" },
  { id: "sentido_saldo", rotulo: "Sentido do saldo", tipo: "texto" },
  { id: "liquido_mwh", rotulo: "Saldo em 30 dias", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "canonico_mwh", rotulo: "No sentido da fronteira", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "inverso_mwh", rotulo: "No sentido contrário", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "contra_saldo_mwh", rotulo: "Escondida pelo saldo de 30 dias", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "contra_saldo_dias_mwh", rotulo: "Escondida pelos saldos diários", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas_canonico", rotulo: "Horas no sentido da fronteira", tipo: "numero", casas: 0 },
  { id: "horas_inverso", rotulo: "Horas no sentido contrário", tipo: "numero", casas: 0 },
  { id: "dias_com_reversao", rotulo: "Dias com troca de sentido", tipo: "numero", casas: 0 },
  { id: "horas", rotulo: "Horas com fluxo", tipo: "numero", casas: 0 },
  { id: "dias_completos", rotulo: "Dias com as 24 horas", tipo: "numero", casas: 0 },
  { id: "horas_pld", rotulo: "Horas com PLD nas duas pontas", tipo: "numero", casas: 0 },
  { id: "horas_precos_separados", rotulo: "Horas com PLDs diferentes", tipo: "numero", casas: 0 },
  { id: "horas_fluxo_para_mais_caro", rotulo: "Dessas, fluxo para o mais caro", tipo: "numero", casas: 0 },
  { id: "horas_fluxo_para_mais_barato", rotulo: "Dessas, fluxo para o mais barato", tipo: "numero", casas: 0 },
];

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
export function linhasFronteirasDia(c: Pick<CirculacaoRede, "diario">, dia: string): LinhaFronteiraDia[] {
  const i = c.diario.dias.indexOf(dia);
  return FRONTEIRAS.map((par) => {
    const s = c.diario.por_par[par];
    const v = (k: keyof typeof s) => (i >= 0 ? (s[k][i] ?? null) : null);
    return {
      id: par,
      fronteira: nomeFronteira(par),
      dia,
      sentido_saldo: rotuloSentidoSaldo(par, v("liquido_mwh")),
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

export const COLUNAS_FRONTEIRAS_DIA: ColunaTabela[] = [
  { id: "fronteira", rotulo: "Fronteira (sentido positivo)", tipo: "texto" },
  { id: "sentido_saldo", rotulo: "Sentido do saldo", tipo: "texto" },
  { id: "liquido_mwh", rotulo: "Saldo", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "canonico_mwh", rotulo: "No sentido da fronteira", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "inverso_mwh", rotulo: "No sentido contrário", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "contra_saldo_mwh", rotulo: "Escondida pelo saldo", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas", rotulo: "Horas com fluxo publicado", tipo: "numero", casas: 0 },
  { id: "horas_inverso", rotulo: "Horas no sentido contrário", tipo: "numero", casas: 0 },
  { id: "reversoes", rotulo: "Trocas de sentido", tipo: "numero", casas: 0 },
  { id: "horas_precos_separados", rotulo: "Horas com PLDs diferentes nas pontas", tipo: "numero", casas: 0 },
  { id: "horas_fluxo_para_mais_caro", rotulo: "Dessas, fluxo para o mais caro", tipo: "numero", casas: 0 },
  { id: "horas_fluxo_para_mais_barato", rotulo: "Dessas, fluxo para o mais barato", tipo: "numero", casas: 0 },
];

/** Resposta do dia escolhido: uma fronteira (selecionada) ou as quatro. */
export function respostaDia(linhas: readonly LinhaFronteiraDia[], par: FronteiraRede | null): string {
  const dia = linhas[0]?.dia ?? "";
  const alvo = par ? linhas.filter((l) => l.id === par) : linhas;
  const partes = alvo.map((l) => {
    if (l.liquido_mwh === null || l.horas === null || l.horas === 0) return `${entreFronteira(l.id)}, sem fluxo publicado`;
    const s = sentidoDoSaldo(l.id, l.liquido_mwh);
    const saldo = s ? `${mwh(Math.abs(l.liquido_mwh))} ${DO_SM[s.origem]} ${PARA_O[s.destino]}` : `saldo nulo ${entreFronteira(l.id)}`;
    const escondida = l.contra_saldo_mwh ? `, com ${mwh(l.contra_saldo_mwh)} no sentido contrário` : "";
    const trocas = par && l.reversoes ? ` e ${plural(l.reversoes, "troca", "trocas")} de sentido entre horas seguidas` : "";
    const incompleto = l.horas < 24 ? ` (${l.horas} de 24 horas publicadas)` : "";
    return `${saldo}${escondida}${trocas}${incompleto}`;
  });
  return `Em ${dataBR(dia)}: ${listaLonga(partes)}.`;
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

export const COLUNAS_DIARIO_FRONTEIRA: ColunaTabela[] = [
  { id: "d", rotulo: "Dia", tipo: "data" },
  { id: "canonico_mwh", rotulo: "No sentido da fronteira", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "inverso_mwh", rotulo: "No sentido contrário", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "liquido_mwh", rotulo: "Saldo", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "contra_saldo_mwh", rotulo: "Escondida pelo saldo", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas", rotulo: "Horas com fluxo", tipo: "numero", casas: 0 },
  { id: "horas_inverso", rotulo: "Horas no sentido contrário", tipo: "numero", casas: 0 },
  { id: "reversoes", rotulo: "Trocas de sentido", tipo: "numero", casas: 0 },
  { id: "horas_precos_separados", rotulo: "Horas com PLDs diferentes", tipo: "numero", casas: 0 },
];

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
export function linhasMensalFronteira(c: Pick<CirculacaoRede, "mensal">, par: FronteiraRede): LinhaMesFronteira[] {
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
      mes_completo: h !== null && cal !== null && h === cal ? "sim" : `não (${num(h, 0)} de ${num(cal, 0)} horas)`,
      horas_inverso: s.horas_inverso[i] ?? null,
      horas_precos_separados: s.horas_precos_separados[i] ?? null,
    };
  });
}

export const COLUNAS_MENSAL_FRONTEIRA: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "data" },
  { id: "canonico_mwh", rotulo: "No sentido da fronteira", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "inverso_mwh", rotulo: "No sentido contrário", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "liquido_mwh", rotulo: "Saldo", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "contra_saldo_dias_mwh", rotulo: "Escondida pelos saldos diários", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas", rotulo: "Horas com fluxo", tipo: "numero", casas: 0 },
  { id: "horas_calendario", rotulo: "Horas do mês", tipo: "numero", casas: 0 },
  { id: "mes_completo", rotulo: "Mês completo", tipo: "texto", categorica: true },
  { id: "horas_inverso", rotulo: "Horas no sentido contrário", tipo: "numero", casas: 0 },
  { id: "horas_precos_separados", rotulo: "Horas com PLDs diferentes", tipo: "numero", casas: 0 },
];

/** Colunas da tabela equivalente aos saldos das fronteiras escolhidas (dia ou mês e uma coluna por fronteira). */
export function colunasSaldoFronteiras(chave: "d" | "m", pares: readonly FronteiraRede[]): ColunaTabela[] {
  return [
    { id: chave, rotulo: chave === "d" ? "Dia" : "Mês", tipo: "data" },
    ...pares.map((p): ColunaTabela => ({ id: p, rotulo: `Saldo ${curtoFronteira(p)} (positivo no sentido do nome)`, tipo: "numero", unidade: "MWh", casas: 0 })),
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
export function linhasSubsistemasDia(c: Pick<CirculacaoRede, "subsistemas_diario">, dia: string): LinhaSubsistemaDia[] {
  const i = c.subsistemas_diario.dias.indexOf(dia);
  return SUBSISTEMAS.map((sm) => {
    const s = c.subsistemas_diario.por_sm[sm];
    const v = (k: keyof typeof s) => (i >= 0 ? (s[k][i] ?? null) : null);
    return {
      id: sm,
      subsistema: NOME_SM[sm],
      exportacao_bruta_mwh: v("exportacao_bruta_mwh"),
      importacao_bruta_mwh: v("importacao_bruta_mwh"),
      liquido_mwh: v("liquido_mwh"),
      horas_transito: v("horas_transito"),
    };
  });
}

export const COLUNAS_SUBSISTEMAS_DIA: ColunaTabela[] = [
  { id: "subsistema", rotulo: "Subsistema", tipo: "texto" },
  { id: "exportacao_bruta_mwh", rotulo: "Exportação bruta", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "importacao_bruta_mwh", rotulo: "Importação bruta", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "liquido_mwh", rotulo: "Saldo (positivo = exporta)", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas_transito", rotulo: "Horas de trânsito", tipo: "numero", casas: 0 },
];

/** Quem exportou e quem importou no dia, pelo saldo das fronteiras (e do exterior, no Sul). */
export function respostaSubsistemasDia(linhas: readonly LinhaSubsistemaDia[], dia: string): string {
  const exp = linhas.filter((l) => (l.liquido_mwh ?? 0) > 0);
  const imp = linhas.filter((l) => (l.liquido_mwh ?? 0) < 0);
  const sem = linhas.filter((l) => l.liquido_mwh === null);
  const transito = linhas.filter((l) => (l.horas_transito ?? 0) > 0);
  const partes = [
    exp.length ? `exportaram ${listaTexto(exp.map((l) => `${NOME_SM[l.id]} (${mwh(l.liquido_mwh)})`))}` : "nenhum subsistema exportou",
    imp.length ? `importaram ${listaTexto(imp.map((l) => `${NOME_SM[l.id]} (${mwh(Math.abs(l.liquido_mwh!))})`))}` : "nenhum importou",
  ];
  let t = `Em ${dataBR(dia)}, ${partes.join("; ")}.`;
  if (transito.length) t += ` Houve trânsito (exportar por uma fronteira e importar por outra na mesma hora) ${listaTexto(transito.map((l) => `${NO[l.id]} em ${plural(l.horas_transito!, "hora", "horas")}`))}.`;
  if (sem.length) t += ` Sem dado para ${listaTexto(sem.map((l) => NOME_SM[l.id]))}.`;
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
export function linhasHora(j: JanelaHorariaRede, i: number): LinhaHoraFronteira[] {
  const hora = j.horas[i] ?? "";
  return FRONTEIRAS.map((par) => {
    const [a, b] = PONTAS[par];
    const f = j.fluxo[par]?.[i] ?? null;
    const p = j.programado[par]?.[i] ?? null;
    return {
      id: par,
      fronteira: nomeFronteira(par),
      hora,
      fluxo_mwmed: f,
      sentido_fluxo: rotuloSentidoSaldo(par, f),
      programado_mwmed: p,
      sentido_programado: rotuloSentidoSaldo(par, p),
      pld_de: j.pld[a]?.[i] ?? null,
      pld_para: j.pld[b]?.[i] ?? null,
    };
  });
}

export const COLUNAS_HORA: ColunaTabela[] = [
  { id: "fronteira", rotulo: "Fronteira (sentido positivo)", tipo: "texto" },
  { id: "fluxo_mwmed", rotulo: "Fluxo verificado", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "sentido_fluxo", rotulo: "Sentido do fluxo", tipo: "texto" },
  { id: "programado_mwmed", rotulo: "Programado", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "sentido_programado", rotulo: "Sentido programado", tipo: "texto" },
  { id: "pld_de", rotulo: "PLD na primeira região", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "pld_para", rotulo: "PLD na segunda região", tipo: "numero", unidade: "R$/MWh", casas: 2 },
];

/** Resposta da hora escolhida para uma fronteira (fluxo, programa e PLD na mesma hora). */
export function respostaHora(linhas: readonly LinhaHoraFronteira[], par: FronteiraRede, exterior?: Partial<Record<PaisSul, number | null>>): string {
  const l = linhas.find((x) => x.id === par);
  if (!l) return "";
  const [a, b] = PONTAS[par];
  const quando = l.hora ? horaLocal(l.hora) : "sem hora";
  const fluxo =
    l.fluxo_mwmed === null
      ? `${entreFronteira(par)}, sem fluxo publicado`
      : l.fluxo_mwmed === 0
        ? `${entreFronteira(par)}, fluxo nulo`
        : `passavam ${mwmed(Math.abs(l.fluxo_mwmed))} ${l.fluxo_mwmed > 0 ? sentidoPositivo(par) : sentidoNegativo(par)}`;
  let prog: string;
  if (l.programado_mwmed === null) prog = "sem programa publicado para a hora";
  else if (l.fluxo_mwmed !== null && l.fluxo_mwmed !== 0 && l.programado_mwmed !== 0 && Math.sign(l.programado_mwmed) !== Math.sign(l.fluxo_mwmed))
    prog = `o programa previa ${mwmed(Math.abs(l.programado_mwmed))} no sentido contrário`;
  else if (l.programado_mwmed === 0) prog = "o programa previa fluxo nulo";
  else prog = `o programa previa ${mwmed(Math.abs(l.programado_mwmed))} ${l.programado_mwmed > 0 ? sentidoPositivo(par) : sentidoNegativo(par)}`;
  const pld = `PLD na mesma hora: ${reais(l.pld_de)}/MWh ${NO[a]} e ${reais(l.pld_para)}/MWh ${NO[b]}`;
  let ext = "";
  if (par === "S_SE" && exterior) {
    const partes = PAISES_SUL.map((p) => {
      const v = exterior[p];
      return v === null || v === undefined ? `${NOME_PAIS[p]} sem dado` : v === 0 ? `${NOME_PAIS[p]} sem fluxo` : `${NOME_PAIS[p]} ${mwmed(Math.abs(v))} (${v > 0 ? "exportação" : "importação"})`;
    });
    ext = ` Exterior do Sul na hora: ${listaTexto(partes)}.`;
  }
  return `Em ${quando}, ${fluxo}; ${prog}. ${pld}.${ext}`;
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

export function colunasJanela(par: FronteiraRede): ColunaTabela[] {
  const [a, b] = PONTAS[par];
  return [
    { id: "h", rotulo: "Hora (início, Brasília)", tipo: "data" },
    { id: "fluxo", rotulo: `Fluxo verificado, positivo ${sentidoPositivo(par)}`, tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "programado", rotulo: "Programado, mesmo sinal", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "pld_de", rotulo: `PLD ${NO[a]}`, tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "pld_para", rotulo: `PLD ${NO[b]}`, tipo: "numero", unidade: "R$/MWh", casas: 2 },
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
export function linhasEsquemaNacional(e: Pick<EsquemaFonteRede, "intercambio_nacional">): LinhaEsquemaNacional[] {
  return e.intercambio_nacional.map((x) => ({
    id: x.recurso,
    recurso: x.recurso,
    linhas: x.linhas,
    orientacao: x.orientacao_fixa ? "fixa, valor com sinal" : "pelo sentido do fluxo da hora",
    orientacoes: Object.entries(x.orientacoes)
      .map(([o, n]) => `${o.replace("->", "→")}: ${num(n, 0)}`)
      .join("; "),
    tem_programado: x.tem_programado ? "sim" : "não",
    verificado_negativo: x.verificado_negativo,
    verificado_zero: x.verificado_zero,
    primeira: x.primeira,
    ultima: x.ultima,
    conflitos: x.conflitos,
  }));
}

/** Quais arquivos anuais usam orientação fixa com sinal e quais orientam a linha pelo sentido da hora, lido do esquema publicado. */
export function textoOrientacaoArquivos(e: Pick<EsquemaFonteRede, "intercambio_nacional">): string {
  const ano = (r: string) => r.replace(/\D/g, "");
  const fixa = e.intercambio_nacional.filter((x) => x.orientacao_fixa).map((x) => ano(x.recurso));
  const hora = e.intercambio_nacional.filter((x) => !x.orientacao_fixa).map((x) => ano(x.recurso));
  const partes: string[] = [];
  if (fixa.length) partes.push(`${fixa.length === 1 ? "o arquivo de" : "os arquivos de"} ${listaTexto(fixa)} ${fixa.length === 1 ? "usa" : "usam"} orientação fixa com valor com sinal`);
  if (hora.length) partes.push(`${hora.length === 1 ? "o de" : "os de"} ${listaTexto(hora)} ${hora.length === 1 ? "orienta" : "orientam"} cada linha pelo sentido do fluxo da hora`);
  return partes.length ? `${cap(partes.join("; "))}.` : "Nenhum arquivo do conjunto foi lido nesta publicação.";
}

export const COLUNAS_ESQUEMA_NACIONAL: ColunaTabela[] = [
  { id: "recurso", rotulo: "Arquivo do ONS", tipo: "texto" },
  { id: "linhas", rotulo: "Linhas", tipo: "numero", casas: 0 },
  { id: "orientacao", rotulo: "Orientação das linhas", tipo: "texto", categorica: true },
  { id: "orientacoes", rotulo: "Linhas por orientação publicada", tipo: "texto" },
  { id: "tem_programado", rotulo: "Traz programado", tipo: "texto", categorica: true },
  { id: "verificado_negativo", rotulo: "Verificado negativo", tipo: "numero", casas: 0 },
  { id: "verificado_zero", rotulo: "Verificado zero", tipo: "numero", casas: 0 },
  { id: "primeira", rotulo: "Primeira hora", tipo: "data" },
  { id: "ultima", rotulo: "Última hora", tipo: "data" },
  { id: "conflitos", rotulo: "Horas com duas linhas da mesma fronteira", tipo: "numero", casas: 0 },
];

export type LinhaCobertura = { id: string; dia: string; horas_min: number; horas_max: number; por_serie: string };

/** Dias sem as 24 horas em alguma série: mínimo e máximo de horas e as horas de cada série. */
export function linhasCobertura(c: CoberturaFonte): LinhaCobertura[] {
  return c.lista.map((d) => ({
    id: d.dia,
    dia: d.dia,
    horas_min: d.horas,
    horas_max: d.horas_max,
    por_serie: Object.entries(d.por_serie)
      .map(([k, n]) => `${NOME_PAIS[k as PaisRede] ?? (ehFronteira(k) ? curtoFronteira(k) : (CURTO_SM[k as SubsistemaOuSin] ?? k))}: ${n}`)
      .join("; "),
  }));
}

export const COLUNAS_COBERTURA: ColunaTabela[] = [
  { id: "dia", rotulo: "Dia", tipo: "data" },
  { id: "horas_min", rotulo: "Menor número de horas entre as séries", tipo: "numero", casas: 0 },
  { id: "horas_max", rotulo: "Maior número de horas entre as séries", tipo: "numero", casas: 0 },
  { id: "por_serie", rotulo: "Horas por série", tipo: "texto" },
];

/** Resumo da cobertura de uma fonte (dias incompletos, sem nenhum dado e parciais). */
export function textoCobertura(nome: string, c: CoberturaFonte, periodo: { inicio: string; fim: string }): string {
  if (!c.dias_incompletos) return `${nome}: todos os dias de ${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)} têm as 24 horas em todas as séries.`;
  return `${nome}: ${plural(c.dias_incompletos, "dia", "dias")} sem as 24 horas em alguma série de ${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)} (${plural(c.dias_sem_nenhum_dado, "dia sem nenhum dado", "dias sem nenhum dado")} e ${plural(c.dias_parciais, "dia parcial", "dias parciais")}). Hora ausente fica fora das somas; nenhuma é preenchida.`;
}

/** Releitura contra o silver principal (outro coletor e outro parser), em uma frase. */
export function textoConferenciaSilver(nome: string, c: ConferenciaSilver | null | undefined): string {
  if (!c) return `${nome}: conferência com o silver principal não executada nesta publicação.`;
  const dif = c.diferentes_no_mesmo_arquivo + c.diferentes_por_revisao;
  const ex = c.exemplo_divergencia ? ` Primeira divergência: ${c.exemplo_divergencia[0]}, ${num(c.exemplo_divergencia[1], 3)} contra ${num(c.exemplo_divergencia[2], 3)}.` : "";
  return `${nome}: ${num(c.horas_comparadas, 0)} valores horários comparados com o silver principal (outro coletor e outro parser), ${num(c.iguais, 0)} iguais e ${num(dif, 0)} diferentes (${num(c.diferentes_no_mesmo_arquivo, 0)} no mesmo arquivo, ${num(c.diferentes_por_revisao, 0)} por revisão entre capturas).${ex}`;
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

export const COLUNAS_ULTIMO_ANO: ColunaTabela[] = [
  { id: "d", rotulo: "Dia", tipo: "data" },
  ...FRONTEIRAS.map((p): ColunaTabela => ({ id: p, rotulo: `Fluxo médio ${curtoFronteira(p)}`, tipo: "numero", unidade: "MWmed", casas: 0 })),
  { id: "amplitude", rotulo: "Maior menos menor PLD médio diário", tipo: "numero", unidade: "R$/MWh", casas: 2 },
];

/* ====================================================================== */
/* P029: balanço e exterior                                                */
/* ====================================================================== */

export const ROTULO_IDENTIDADE: Record<IdentidadeBalanco["identidade"], string> = {
  balanco: "Balanço interno: geração − carga − intercâmbio",
  perimetro: "Perímetro: intercâmbio do balanço − fronteiras e exterior",
  soma_sin: "Soma: intercâmbio do SIN − soma dos quatro subsistemas",
};

/** Nome curto de cada conta, para o eixo das barras (o rótulo longo, com a conta escrita, fica na tabela e na legenda sob o gráfico). */
export const ROTULO_CURTO_IDENTIDADE: Record<IdentidadeBalanco["identidade"], string> = {
  balanco: "Balanço interno",
  perimetro: "Perímetro",
  soma_sin: "Soma dos subsistemas",
};

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
export function linhasIdentidades(ids: readonly IdentidadeBalanco[]): LinhaIdentidade[] {
  return ids.map((x) => ({
    id: x.id,
    identidade: ROTULO_IDENTIDADE[x.identidade],
    identidade_curta: ROTULO_CURTO_IDENTIDADE[x.identidade],
    regiao: NOME_SM[x.sm],
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
      .map(([a, n]) => `${a}: ${num(n, 0)}`)
      .join("; "),
  }));
}

/** Colunas das identidades; tolerância e faixas vêm da gold (balanco.tolerancia_mwmed e faixas_mwmed). */
export function colunasIdentidades(b: Pick<BalancoRede, "tolerancia_mwmed" | "faixas_mwmed">): ColunaTabela[] {
  const tol = num(b.tolerancia_mwmed, 1);
  const [f1, f10, f100] = b.faixas_mwmed.map((f) => num(f, 0));
  return [
    { id: "identidade", rotulo: "Conta conferida", tipo: "texto", categorica: true },
    { id: "regiao", rotulo: "Região", tipo: "texto", categorica: true },
    { id: "horas", rotulo: "Horas com todas as parcelas", tipo: "numero", casas: 0 },
    { id: "horas_fecham", rotulo: `Horas que fecham (até ${tol} MWmed)`, tipo: "numero", casas: 0 },
    { id: "horas_residuo", rotulo: "Horas com resíduo", tipo: "numero", casas: 0 },
    { id: "horas_entre_0_01_e_tolerancia", rotulo: `Fecham com diferença entre 0,01 e ${tol} MWmed`, tipo: "numero", casas: 0 },
    { id: "acima_1", rotulo: `Resíduo acima de ${f1} MWmed`, tipo: "numero", casas: 0 },
    { id: "acima_10", rotulo: `Acima de ${f10} MWmed`, tipo: "numero", casas: 0 },
    { id: "acima_100", rotulo: `Acima de ${f100} MWmed`, tipo: "numero", casas: 0 },
    { id: "igual_menos_exterior", rotulo: "Resíduo igual a menos o exterior da hora", tipo: "numero", casas: 0 },
    { id: "maior_residuo_mwmed", rotulo: "Maior resíduo", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "maior_residuo_em", rotulo: "Hora do maior resíduo", tipo: "data" },
    { id: "primeira_hora_residuo", rotulo: "Primeira hora com resíduo", tipo: "data" },
    { id: "ultima_hora_residuo", rotulo: "Última hora com resíduo", tipo: "data" },
    { id: "sequencias", rotulo: "Sequências de horas com resíduo", tipo: "numero", casas: 0 },
    { id: "por_ano", rotulo: "Horas com resíduo por ano", tipo: "texto" },
  ];
}

/** "fecha em todas as N horas" ou "fecha em X de N horas". */
function fecha(x: IdentidadeBalanco): string {
  return x.horas_residuo === 0 ? `fecha em todas as ${num(x.horas, 0)} horas` : `fecha em ${num(x.horas_fecham, 0)} de ${num(x.horas, 0)} horas`;
}

/**
 * Resposta do P029 para a região escolhida: em quantas horas cada identidade fecha e,
 * quando há resíduo, onde ele está (período e maior valor), sem atribuir causa.
 */
export function respostaBalanco(b: Pick<BalancoRede, "identidades" | "tolerancia_mwmed">, sm: SubsistemaOuSin, periodo: { inicio: string; fim: string }): string {
  const ids = identidadesDa(b, sm);
  const bal = ids.find((x) => x.identidade === "balanco");
  const per = ids.find((x) => x.identidade === "perimetro");
  const soma = ids.find((x) => x.identidade === "soma_sin");
  const onde = sm === "SIN" ? "No SIN" : cap(NO[sm]);
  const frases: string[] = [];
  // frase de leitor antes da contagem: a menor parcela de horas que fecha entre as identidades conferidas
  const conferidas = [bal, per, soma].filter((x): x is IdentidadeBalanco => !!x && x.horas > 0);
  if (conferidas.length) {
    const menor = Math.min(...conferidas.map((x) => x.horas_fecham / x.horas));
    frases.push(
      menor === 1
        ? `${sm === "SIN" ? "No SIN" : cap(NO[sm])}, os números do balanço de energia fecham entre si em todas as horas conferidas.`
        : `${sm === "SIN" ? "No SIN" : cap(NO[sm])}, os números do balanço de energia fecham entre si em pelo menos ${num(Math.floor(menor * 100), 0)}% das horas conferidas; as horas em que não fecham estão listadas abaixo.`,
    );
  }
  const quem = sm === "SIN" ? "o intercâmbio internacional" : sm === "S" ? "a fronteira com o Sudeste/Centro-Oeste mais Argentina e Uruguai" : "a soma das fronteiras";
  const partes: string[] = [];
  if (per) partes.push(`o intercâmbio publicado no balanço fecha com ${quem} ${fecha(per).replace(/^fecha /, "")}`);
  if (bal) partes.push(`geração menos carga fecha com o intercâmbio ${fecha(bal).replace(/^fecha /, "")}`);
  if (soma) partes.push(`o intercâmbio do SIN fecha com a soma dos quatro subsistemas ${fecha(soma).replace(/^fecha /, "")}`);
  frases.push(`${onde}, de ${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)} (tolerância de ${num(b.tolerancia_mwmed, 1)} MWmed por hora): ${listaLonga(partes)}.`);
  for (const x of ids.filter((y) => y.horas_residuo > 0)) {
    const nome = x.identidade === "balanco" ? "No balanço interno" : x.identidade === "perimetro" ? "No perímetro" : "Na soma dos subsistemas";
    const quando = x.primeira_hora_residuo && x.ultima_hora_residuo ? ` ${entreDatas(x.primeira_hora_residuo, x.ultima_hora_residuo)}` : "";
    const maior = x.maior_residuo_mwmed !== null && x.maior_residuo_em ? `; o maior foi ${mwmed(x.maior_residuo_mwmed, 1)} em ${horaLocal(x.maior_residuo_em)}` : "";
    const ext = x.horas_residuo_igual_menos_exterior ? `; em ${num(x.horas_residuo_igual_menos_exterior, 0)} delas o resíduo é igual a menos o intercâmbio internacional da mesma hora` : "";
    frases.push(`${nome}, ${x.horas_residuo === 1 ? "a hora com resíduo fica" : `as ${num(x.horas_residuo, 0)} horas com resíduo ficam`}${quando}${maior}${ext}.`);
  }
  if (ids.some((y) => y.horas_residuo > 0)) frases.push("A fonte não informa a causa dos resíduos, e nenhuma é atribuída aqui.");
  return frases.join(" ");
}

/**
 * Veredito do P029 em palavras simples: em quantas horas os números do balanço conferem entre si na região escolhida e o
 * que a fonte não diz. A contagem por identidade, o período de cada resíduo e o maior valor ficam em respostaBalanco.
 */
export function vereditoBalanco(b: Pick<BalancoRede, "identidades" | "tolerancia_mwmed">, sm: SubsistemaOuSin, periodo: { inicio: string; fim: string }): string {
  const ids = identidadesDa(b, sm);
  const conferidas = ids.filter((x) => x.horas > 0);
  if (!conferidas.length) return "";
  const menor = Math.min(...conferidas.map((x) => x.horas_fecham / x.horas));
  const onde = sm === "SIN" ? "No SIN" : cap(NO[sm]);
  const confere =
    menor === 1
      ? "todas as horas conferidas"
      : `pelo menos ${num(Math.floor(menor * 100), 0)}% das horas conferidas`;
  // quando todas as horas com resíduo da região caem num só ano, a frase diz qual: a média de 95% ou mais sozinha esconderia onde elas estão
  const anosComResiduo = Array.from(new Set(ids.flatMap((y) => Object.entries(y.horas_residuo_por_ano).filter(([, n]) => n > 0).map(([a]) => a))));
  const quando = anosComResiduo.length === 1 ? ` As horas com resíduo estão todas em ${anosComResiduo[0]}.` : "";
  const resto = ids.some((y) => y.horas_residuo > 0) ? ` Nas horas em que não conferem, a fonte não informa o motivo e o observatório não atribui causa.${quando}` : "";
  return `${onde}, geração, carga e intercâmbio conferem entre si em ${confere}, de ${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}.${resto}`;
}

/**
 * Onde estão as horas com resíduo do balanço interno do SIN, lido da contagem por ano e das horas extremas da gold: os anos com
 * resíduo, o período, o maior valor e os anos cobertos em que o balanço fecha em todas as horas. Sem causa atribuída.
 */
export function textoMudancaBalanco(b: Pick<BalancoRede, "identidades" | "mensal">): string {
  const x = identidadesDa(b, "SIN").find((y) => y.identidade === "balanco");
  if (!x || x.horas === 0) return "";
  if (x.horas_residuo === 0) return `No balanço interno do SIN, nenhuma das ${num(x.horas, 0)} horas conferidas tem resíduo.`;
  const comResiduo = Object.entries(x.horas_residuo_por_ano)
    .filter(([, n]) => n > 0)
    .map(([a]) => a)
    .sort();
  const cobertos = Array.from(new Set(b.mensal.meses.map((m) => m.slice(0, 4)))).sort();
  const outros = cobertos.filter((a) => !comResiduo.includes(a));
  const quando = x.primeira_hora_residuo && x.ultima_hora_residuo ? ` (${entreDatas(x.primeira_hora_residuo, x.ultima_hora_residuo)})` : "";
  const maior = x.maior_residuo_mwmed !== null && x.maior_residuo_em ? `; o maior foi de ${mwmed(x.maior_residuo_mwmed, 1)}, em ${horaLocal(x.maior_residuo_em)}` : "";
  const fecha = outros.length ? ` Em ${listaTexto(outros)}, o balanço interno fecha em todas as horas conferidas.` : "";
  return `No balanço interno do SIN, as ${num(x.horas_residuo, 0)} horas com resíduo estão em ${listaTexto(comResiduo)}${quando}${maior}.${fecha}`;
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

export const ROTULO_MMGD: Record<RegimeMmgd, string> = {
  sem: "sem MMGD estimada",
  parcial: "MMGD estimada em parte do mês",
  com: "com MMGD estimada",
};

/** O balanço mensal da região (duas somas por mês, cada uma sobre as suas horas). */
export function linhasBalancoMensal(b: Pick<BalancoRede, "mensal">, sm: SubsistemaOuSin): LinhaMesBalanco[] {
  const s = b.mensal.por_sm[sm];
  return b.mensal.meses.map((m, i) => ({
    id: m,
    m,
    mmgd: ROTULO_MMGD[b.mensal.mmgd_estimada[i]] ?? "sem dado",
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

export const COLUNAS_BALANCO_MENSAL: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "data" },
  { id: "mmgd", rotulo: "Geração solar e carga", tipo: "texto", categorica: true },
  { id: "geracao_mwh", rotulo: "Geração", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "carga_mwh", rotulo: "Carga", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "intercambio_mwh", rotulo: "Intercâmbio no balanço", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "residuo_balanco_mwh", rotulo: "Resíduo do balanço interno", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas_completas", rotulo: "Horas com as três parcelas", tipo: "numero", casas: 0 },
  { id: "horas_residuo_balanco", rotulo: "Horas com resíduo (balanço)", tipo: "numero", casas: 0 },
  { id: "intercambio_perimetro_mwh", rotulo: "Intercâmbio nas horas do perímetro", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "fronteiras_exterior_mwh", rotulo: "Fronteiras e exterior", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "residuo_perimetro_mwh", rotulo: "Resíduo do perímetro", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas_perimetro", rotulo: "Horas do perímetro", tipo: "numero", casas: 0 },
  { id: "horas_residuo_perimetro", rotulo: "Horas com resíduo (perímetro)", tipo: "numero", casas: 0 },
  { id: "horas", rotulo: "Horas no balanço", tipo: "numero", casas: 0 },
];

/** Horas com resíduo no balanço interno, por mês, das regiões escolhidas (até quatro). */
export function linhasResiduoMensal(b: Pick<BalancoRede, "mensal">, sms: readonly SubsistemaOuSin[]): ({ id: string; m: string } & Partial<Record<SubsistemaOuSin, number | null>>)[] {
  return b.mensal.meses.map((m, i) => ({ id: m, m, ...Object.fromEntries(sms.map((sm) => [sm, b.mensal.por_sm[sm].horas_residuo_balanco[i] ?? null])) }));
}

/** Marcos das quebras metodológicas do balanço no eixo mensal. */
export function marcosQuebras(b: Pick<BalancoRede, "quebras">): { x: string; rotulo: string }[] {
  return b.quebras.map((q) => ({ x: q.dia.slice(0, 7), rotulo: `${dataBR(q.dia)}: ${q.id === "mmgd_2023" ? "MMGD" : "quebra"}` }));
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

export const COLUNAS_EXTERIOR_MENSAL: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "data" },
  { id: "exportacao_mwh", rotulo: "Exportação do Brasil", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "importacao_mwh", rotulo: "Importação do Brasil", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas", rotulo: "Horas publicadas", tipo: "numero", casas: 0 },
  { id: "horas_com_fluxo", rotulo: `Horas com fluxo acima de ${num(LIMIAR_NULO_MWMED, 0)} MWmed`, tipo: "numero", casas: 0 },
  { id: "programado_liquido_mwh", rotulo: "Saldo programado (vazio antes do programa publicado)", tipo: "numero", unidade: "MWh", casas: 0 },
];

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

export function linhasExterior12m(e: Pick<ExteriorRede, "resumo_12m" | "por_pais">): LinhaExterior12m[] {
  return PAISES.map((p) => {
    const r = e.resumo_12m[p];
    return {
      id: p,
      pais: NOME_PAIS[p],
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

export const COLUNAS_EXTERIOR_12M: ColunaTabela[] = [
  { id: "pais", rotulo: "País", tipo: "texto" },
  { id: "inicio", rotulo: "Primeiro mês", tipo: "data" },
  { id: "fim", rotulo: "Último mês", tipo: "data" },
  { id: "horas", rotulo: "Horas publicadas", tipo: "numero", casas: 0 },
  { id: "exportacao_mwh", rotulo: "Exportação do Brasil", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "importacao_mwh", rotulo: "Importação do Brasil", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas_com_fluxo", rotulo: "Horas com fluxo", tipo: "numero", casas: 0 },
  { id: "ultima_hora", rotulo: "Última hora publicada", tipo: "data" },
];

/** Exportação e importação de 12 meses por país; país sem hora na janela é dito ausente, nunca zero. */
export function respostaExterior(e: Pick<ExteriorRede, "resumo_12m" | "por_pais">): string {
  const linhas = linhasExterior12m(e);
  const com = linhas.filter((l) => l.horas > 0);
  const sem = linhas.filter((l) => l.horas === 0);
  const per = com[0]?.inicio && com[0]?.fim ? `De ${mesAno(com[0].inicio)} a ${mesAno(com[0].fim)}` : "Nos 12 meses completos mais recentes";
  const partes = com.map((l) => `com ${l.id === "ARGENTINA" ? "a" : "o"} ${l.pais}, ${mwh(l.exportacao_mwh)} exportados e ${mwh(l.importacao_mwh)} importados (fluxo acima de ${mwmed(LIMIAR_NULO_MWMED)} em ${num(l.horas_com_fluxo, 0)} de ${num(l.horas, 0)} horas)`);
  let t = `${per}, o Brasil trocou energia ${listaTexto(partes)}.`;
  if (sem.length) t += ` ${listaTexto(sem.map((l) => `${l.id === "ARGENTINA" ? "A" : "O"} ${l.pais}`))} não ${sem.length === 1 ? "tem" : "têm"} nenhuma hora publicada no período${sem.map((l) => (l.ultima_hora ? ` (último registro em ${dataBR(l.ultima_hora)})` : "")).join("")}: ausência, não zero.`;
  return t;
}

/**
 * Veredito do exterior em palavras simples: o saldo dos 12 meses (exportação menos importação) dos países com hora
 * publicada e o país sem hora, dito ausente. É a soma dos mesmos campos da resposta completa e do número em destaque do
 * painel; as quantidades de cada país ficam em respostaExterior.
 */
export function vereditoExterior(e: Pick<ExteriorRede, "resumo_12m" | "por_pais">): string {
  const linhas = linhasExterior12m(e);
  const com = linhas.filter((l) => l.horas > 0);
  const sem = linhas.filter((l) => l.horas === 0);
  if (!com.length) return "Nenhum país tem hora publicada de intercâmbio nos 12 meses completos mais recentes: é ausência de dado, não zero.";
  const saldo = com.reduce((s, l) => s + (l.exportacao_mwh ?? 0) - (l.importacao_mwh ?? 0), 0);
  const per = com[0].inicio && com[0].fim ? `De ${mesAno(com[0].inicio)} a ${mesAno(com[0].fim)}` : "Nos 12 meses completos mais recentes";
  const paises = listaTexto(com.map((l) => `${l.id === "ARGENTINA" ? "a" : "o"} ${l.pais}`));
  const rumo = saldo > 0 ? `exportou ${mwh(saldo)} a mais do que importou` : saldo < 0 ? `importou ${mwh(-saldo)} a mais do que exportou` : "exportou e importou a mesma energia";
  let t = `${per}, o Brasil ${rumo} na troca com ${paises}.`;
  if (sem.length) {
    t += ` ${listaTexto(sem.map((l) => `${l.id === "ARGENTINA" ? "A" : "O"} ${l.pais}`))} ${sem.length === 1 ? "não tem" : "não têm"} hora publicada no período: ausência de dado, não zero.`;
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
export function textoIdentidadesItaipu(x: Pick<ExteriorRede, "itaipu_identidades">["itaipu_identidades"]): string {
  const n = x.linhas;
  if (n === null || n === undefined) return "Itaipu: identidades das parcelas não conferidas nesta publicação.";
  const parte = (dif: number | null, texto: string) => (dif === null || dif === undefined ? `${texto}: não conferido` : `${texto} em ${num(n - dif, 0)} de ${num(n, 0)} horas`);
  return `Itaipu: ${parte(x.total_diferente_de_60_mais_50, "total igual a 60 Hz mais 50 Hz")}; ${parte(x.brasil_diferente_de_60_mais_50_brasil, "parcela do Brasil igual às duas frequências destinadas ao Brasil")}.`;
}

export const COLUNAS_ITAIPU: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "data" },
  { id: "total_mwh", rotulo: "Geração total", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "brasil_mwh", rotulo: "Destinada ao Brasil", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "nao_brasil_mwh", rotulo: "Não destinada ao Brasil (diferença)", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas", rotulo: "Horas", tipo: "numero", casas: 0 },
];

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

/** Nome do fluxo como o leitor o entende: a definição conferida em documento público do ONS; sem ela, a sigla do ONS. */
export function nomeFluxo(f: Pick<FluxoAtls, "fluxo" | "definicao">): string {
  return f.definicao ?? f.fluxo;
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
export function medidasRestricoes(r: Pick<RestricoesRede, "atls">): MedidasRestricoes {
  const ativos = fluxosAtivos(r.atls);
  const janela = ativos[0]?.ultimos_12_meses ?? null;
  if (!ativos.length || !janela) return { fluxosAcima: null, maisHoras: null };
  const periodo = `${mesAno(janela.inicio)} a ${mesAno(janela.fim)}`;
  const com = ativos.filter((f) => (f.ultimos_12_meses?.horas_violacao ?? 0) > 0);
  return {
    fluxosAcima: { valor: com.length, de: ativos.length, periodo },
    maisHoras: { fluxo: ativos[0].fluxo, nome: nomeFluxo(ativos[0]), horas: janela.horas_violacao, periodo },
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

export function linhasAtls(fluxos: readonly FluxoAtls[]): LinhaAtls[] {
  return fluxos.map((f) => ({
    id: f.fluxo,
    nome: nomeFluxo(f),
    fluxo: f.fluxo,
    definicao: f.definicao ?? "sem definição em documento público conferido",
    publicado_no_ultimo_mes: f.ativo ? "sim" : "não",
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

export const COLUNAS_ATLS: ColunaTabela[] = [
  { id: "nome", rotulo: "Fluxo", tipo: "texto" },
  { id: "fluxo", rotulo: "Sigla do ONS", tipo: "texto", nivel: "analisar" },
  { id: "definicao", rotulo: "Definição conferida", tipo: "texto" },
  { id: "publicado_no_ultimo_mes", rotulo: "Publicado no último mês", tipo: "texto", categorica: true },
  { id: "inicio_12m", rotulo: "Início dos 12 meses", tipo: "data" },
  { id: "fim_12m", rotulo: "Fim dos 12 meses", tipo: "data" },
  { id: "horas_12m", rotulo: "Horas acima do limite em 12 meses", tipo: "numero", unidade: "h", casas: 1 },
  { id: "meses_12m", rotulo: "Meses com violação em 12 meses", tipo: "numero", casas: 0 },
  { id: "inicio", rotulo: "Primeiro mês no arquivo", tipo: "data" },
  { id: "fim", rotulo: "Último mês no arquivo", tipo: "data" },
  { id: "meses", rotulo: "Meses publicados", tipo: "numero", casas: 0 },
  { id: "meses_com_violacao", rotulo: "Meses com violação", tipo: "numero", casas: 0 },
  { id: "horas_violacao_total", rotulo: "Horas acima do limite no histórico", tipo: "numero", unidade: "h", casas: 1 },
];

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
export function respostaRestricoes(r: Pick<RestricoesRede, "atls" | "interrupcoes">): string {
  const ativos = fluxosAtivos(r.atls);
  const com = ativos.filter((f) => (f.ultimos_12_meses?.horas_violacao ?? 0) > 0);
  const sem = ativos.filter((f) => f.ultimos_12_meses && f.ultimos_12_meses.horas_violacao === 0);
  const janela = ativos[0]?.ultimos_12_meses;
  const frases: string[] = [];
  if (janela && ativos.length) {
    const lista = com.map((f) => `${f.fluxo} ${num(f.ultimos_12_meses!.horas_violacao, 1)} h`);
    frases.push(
      `De ${mesAno(janela.inicio)} a ${mesAno(janela.fim)}, ${num(com.length, 0)} dos ${num(ativos.length, 0)} fluxos que o ONS acompanha no indicador ATLS ficaram acima do limite estabelecido por algum tempo${lista.length ? `: ${listaTexto(lista)}` : ""}${sem.length ? `; ${listaTexto(sem.map((f) => f.fluxo))} não ${sem.length === 1 ? "ficou" : "ficaram"}` : ""}.`,
    );
  } else {
    frases.push("O indicador ATLS não tem fluxo publicado no último mês do arquivo.");
  }
  const u = r.interrupcoes.ultimos_12_meses;
  if (u.inicio && u.fim) {
    frases.push(
      `De ${dataBR(u.inicio)} a ${dataBR(u.fim)}, o ONS registrou ${plural(u.registros, "corte de carga", "cortes de carga")} em ${plural(u.perturbacoes, "perturbação", "perturbações")}, com ${num(u.ens_mwh, 1)} MWh de energia não suprida (${num(u.registros_rede_basica, 0)} dos registros na rede básica).`,
    );
  }
  frases.push("Os limites operativos e as suas vigências não são públicos: nenhuma utilização da rede é calculada.");
  return frases.join(" ");
}

/**
 * Veredito do P030 em palavras simples: em quantos dos fluxos acompanhados o tempo acima do limite foi diferente de zero e
 * quantos cortes de carga o ONS registrou, com o limite de leitura (os limites de cada fronteira não são públicos). O tempo de
 * cada fluxo, os períodos exatos e a energia não suprida ficam em respostaRestricoes.
 */
export function vereditoRestricoes(r: Pick<RestricoesRede, "atls" | "interrupcoes">): string {
  const ativos = fluxosAtivos(r.atls);
  const com = ativos.filter((f) => (f.ultimos_12_meses?.horas_violacao ?? 0) > 0);
  const u = r.interrupcoes.ultimos_12_meses;
  const frases: string[] = [];
  if (ativos.length && ativos[0].ultimos_12_meses) {
    frases.push(`Em 12 meses, ${num(com.length, 0)} dos ${num(ativos.length, 0)} fluxos acompanhados pelo ONS passaram algum tempo acima do limite estabelecido${u.inicio && u.fim ? `, e houve ${plural(u.registros, "corte de carga", "cortes de carga")}` : ""}.`);
  } else if (u.inicio && u.fim) {
    frases.push(`Em 12 meses, o ONS registrou ${plural(u.registros, "corte de carga", "cortes de carga")}; o indicador de tempo acima do limite não tem fluxo publicado no último mês.`);
  } else {
    frases.push("Não há evidência publicada de limitação na janela de 12 meses desta publicação.");
  }
  frases.push("Os limites de cada fronteira não são públicos: isso não mostra se a rede estava no limite.");
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

export function linhasInterrupcoesAno(i: Pick<RestricoesRede["interrupcoes"], "anual">, sm: SubsistemaOuSin): LinhaInterrupcaoAno[] {
  const s = i.anual.por_sm[sm];
  return i.anual.anos.map((ano, k) => ({
    id: ano,
    ano: i.anual.parcial[k] ? `${ano} (parcial)` : ano,
    parcial: i.anual.parcial[k] ? "sim" : "não",
    registros: s.registros[k] ?? null,
    perturbacoes: s.perturbacoes[k] ?? null,
    ens_mwh: s.ens_mwh[k] ?? null,
    registros_rede_basica: s.registros_rede_basica[k] ?? null,
    ens_rede_basica_mwh: s.ens_rede_basica_mwh[k] ?? null,
    registros_100mw: s.registros_100mw[k] ?? null,
  }));
}

export const COLUNAS_INTERRUPCOES_ANO: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "parcial", rotulo: "Ano parcial", tipo: "texto", categorica: true },
  { id: "registros", rotulo: "Registros de corte", tipo: "numero", casas: 0 },
  { id: "perturbacoes", rotulo: "Perturbações", tipo: "numero", casas: 0 },
  { id: "ens_mwh", rotulo: "Energia não suprida", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "registros_rede_basica", rotulo: "Registros na rede básica", tipo: "numero", casas: 0 },
  { id: "ens_rede_basica_mwh", rotulo: "Energia não suprida, rede básica", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "registros_100mw", rotulo: "Registros com 100 MW ou mais", tipo: "numero", casas: 0 },
];

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

export function linhasPerturbacoes(lista: readonly Perturbacao[]): LinhaPerturbacao[] {
  return lista.map((p) => ({
    id: `${p.cod_perturbacao}|${p.inicio}`,
    cod_perturbacao: p.cod_perturbacao,
    // o arquivo do ONS separa data e hora com espaço; com "T" a célula sai como 10/11/2009 22:13 e o arquivo baixado guarda os segundos
    inicio: p.inicio.replace(" ", "T"),
    registros: p.registros,
    ens_mwh: p.ens_mwh,
    carga_interrompida_mw_soma: p.carga_interrompida_mw_soma,
    ufs: p.ufs.join(", "),
    subsistemas: p.subsistemas.map((s) => CURTO_SM[s as SubsistemaOuSin] ?? s).join(", "),
    rede_basica: p.rede_basica ? "sim" : "não",
  }));
}

export const COLUNAS_PERTURBACOES: ColunaTabela[] = [
  { id: "cod_perturbacao", rotulo: "Perturbação (código do ONS)", tipo: "texto" },
  { id: "inicio", rotulo: "Início", tipo: "data" },
  { id: "registros", rotulo: "Registros", tipo: "numero", casas: 0 },
  { id: "ens_mwh", rotulo: "Energia não suprida", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "carga_interrompida_mw_soma", rotulo: "Carga interrompida (soma dos registros)", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "ufs", rotulo: "UF", tipo: "texto" },
  { id: "subsistemas", rotulo: "Subsistemas", tipo: "texto" },
  { id: "rede_basica", rotulo: "Rede básica", tipo: "texto", categorica: true },
];

export function linhasBuscaLimites(busca: readonly BuscaLimite[]): { id: string; onde: string; resultado: string; url: string }[] {
  return busca.map((b, i) => ({ id: `busca-${i + 1}`, onde: b.onde, resultado: b.resultado, url: b.url }));
}

export const COLUNAS_BUSCA: ColunaTabela[] = [
  { id: "onde", rotulo: "Onde se procurou", tipo: "texto" },
  { id: "resultado", rotulo: "Resultado", tipo: "texto" },
  { id: "url", rotulo: "Endereço consultado", tipo: "texto" },
];

/* ====================================================================== */
/* P031: programado e verificado                                           */
/* ====================================================================== */

export type BaseDesvio = "com" | "sem";

/** Estado distinto de "não" e de ausência: a regra não vale para a entidade (seção 11.6). */
export const NAO_SE_APLICA = "não se aplica";

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
export function linhasDistribuicao(p: Pick<ProgramadoRede, "distribuicao">, base: BaseDesvio): LinhaDistribuicao[] {
  return PARES_PROGRAMADO.map((par) => {
    const d = distribuicaoDe(p, par, base);
    const completa = p.distribuicao[par];
    return {
      id: par,
      par: nomePar(par),
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
): MedidasProgramado | null {
  const d = distribuicaoDe(p, par, base);
  if (!d) return null;
  const completa = p.distribuicao[par];
  return {
    par,
    nome: nomePar(par),
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
export function colunasDistribuicao(p: Pick<ProgramadoRede, "limiar_material_mwmed">): ColunaTabela[] {
  const rotulo = (l: number) => `Horas com desvio de ${num(l, 0)} MWmed ou mais${l === p.limiar_material_mwmed ? " (materiais)" : ""}`;
  return [
    { id: "par", rotulo: "Fronteira ou país", tipo: "texto" },
    { id: "horas", rotulo: "Horas comparadas", tipo: "numero", casas: 0 },
    { id: "desvio_abs_medio_mwmed", rotulo: "Desvio absoluto médio", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "p50_abs_mwmed", rotulo: "Mediana do desvio absoluto", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "p90_abs_mwmed", rotulo: "Percentil 90", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "p99_abs_mwmed", rotulo: "Percentil 99", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "max_abs_mwmed", rotulo: "Maior desvio absoluto", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "vies_mwmed", rotulo: "Viés (verificado − programado)", tipo: "numero", unidade: "MWmed", casas: 1 },
    ...LIMIARES.map((l): ColunaTabela => ({ id: `horas_${l}`, rotulo: rotulo(Number(l)), tipo: "numero", casas: 0 })),
    { id: "horas_inversao", rotulo: "Horas com sentido oposto ao programado", tipo: "numero", casas: 0 },
    { id: "programado_abs_mediano_mwmed", rotulo: "Programa mediano (módulo)", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "dias_rotulados_excluidos", rotulo: "Dias rotulados excluídos", tipo: "numero", casas: 0 },
  ];
}

const LIMIARES: readonly LimiarSensibilidade[] = ["500", "1000", "2000"];

/**
 * Resposta do P031 para o par escolhido: quanto o verificado se afastou do programa,
 * em média e na mediana, quantas horas passaram do limiar material e quantas tiveram
 * sentido oposto ao programado; com a base sem os dias rotulados quando pedida.
 * Desvio não é chamado de falha.
 */
export function respostaProgramado(p: Pick<ProgramadoRede, "distribuicao" | "limiar_material_mwmed" | "programa_repetido">, par: ParProgramado, base: BaseDesvio): string {
  const d = distribuicaoDe(p, par, base);
  if (!d) return `Sem programado e verificado comparáveis para ${nomePar(par)}.`;
  const completa = p.distribuicao[par]!;
  const lim = p.limiar_material_mwmed;
  const nome = ehFronteira(par) ? `na fronteira ${nomeFronteira(par)}` : `no intercâmbio com ${par === "ARGENTINA" ? "a Argentina" : "o Uruguai"}`;
  const vies =
    d.vies_mwmed === 0
      ? "sem viés médio"
      : `em média, o verificado ficou ${mwmed(Math.abs(d.vies_mwmed), 1)} deslocado em relação ao programa no sentido ${d.vies_mwmed > 0 ? sentidoPositivo(par) : sentidoNegativo(par)}`;
  const frases = [
    `De ${dataBR(d.inicio)} a ${dataBR(d.fim)}, ${nome}, o fluxo verificado se afastou do programado em ${mwmed(d.desvio_abs_medio_mwmed, 1)} por hora, em média (mediana de ${mwmed(d.p50_abs_mwmed, 1)}); em ${num(d.horas_materiais[String(lim) as "1000"] ?? null, 0)} das ${num(d.horas, 0)} horas a diferença chegou a ${num(lim, 0)} MWmed ou mais, e em ${num(d.horas_inversao, 0)} o fluxo correu no sentido oposto ao programado; ${vies}.`,
  ];
  const rot = completa.dias_rotulados;
  const dias = p.programa_repetido.dias.map((x) => dataBR(x.dia));
  if (rot > 0 && ehFronteira(par)) {
    if (base === "sem") frases.push(`Esta base exclui ${plural(rot, "dia rotulado", "dias rotulados")} por programa repetido (${listaTexto(dias)}); com ${rot === 1 ? "ele" : "eles"}, a média seria ${mwmed(completa.desvio_abs_medio_mwmed, 1)}.`);
    else if (completa.sem_dias_rotulados) frases.push(`Sem ${rot === 1 ? "o dia rotulado" : "os dias rotulados"} por programa repetido (${listaTexto(dias)}), a média cai para ${mwmed(completa.sem_dias_rotulados.desvio_abs_medio_mwmed, 1)}.`);
  }
  return frases.join(" ");
}

/**
 * Veredito do P031 em palavras simples: quanto o fluxo medido se afastou do programa, em média, para o par e a base
 * escolhidos, ao lado do tamanho do programa (a mediana do programado em módulo) quando ele existe. Mediana, percentis,
 * horas acima do limiar e horas no sentido oposto ficam em respostaProgramado. Desvio não é falha.
 */
export function vereditoProgramado(p: Pick<ProgramadoRede, "distribuicao" | "limiar_material_mwmed" | "programa_repetido">, par: ParProgramado, base: BaseDesvio): string {
  const d = distribuicaoDe(p, par, base);
  if (!d) return `Sem programado e verificado comparáveis para ${nomePar(par)}.`;
  const nome = ehFronteira(par) ? `na fronteira ${nomeFronteira(par)}` : `no intercâmbio com ${par === "ARGENTINA" ? "a Argentina" : "o Uruguai"}`;
  const tamanho = d.programado_abs_mediano_mwmed > 0 ? `O programa, em módulo, tem mediana de ${mwmed(d.programado_abs_mediano_mwmed, 0)}.` : "A mediana do programa, em módulo, é zero.";
  const semRotulados = base === "sem" && ehFronteira(par) && p.distribuicao[par] && p.distribuicao[par]!.dias_rotulados > 0 ? ", sem os dias rotulados por programa repetido" : "";
  return `Desde ${dataBR(d.inicio)}, ${nome}, o fluxo medido se afastou do programado em ${mwmed(d.desvio_abs_medio_mwmed, 1)} por hora, em média${semRotulados}. ${tamanho} Desvio não é falha; a fonte não informa o motivo.`;
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

export function linhasProgramadoDiario(p: Pick<ProgramadoRede, "diario" | "programa_repetido">, par: ParProgramado): LinhaDiaProgramado[] {
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
    dia_rotulado: ehFronteira(par) ? (rotulados.has(d) ? "sim" : "não") : NAO_SE_APLICA,
  }));
}

export const COLUNAS_PROGRAMADO_DIARIO: ColunaTabela[] = [
  { id: "d", rotulo: "Dia", tipo: "data" },
  { id: "programado_mwh", rotulo: "Programado (saldo do dia)", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "verificado_mwh", rotulo: "Verificado (saldo do dia)", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "desvio_abs_mwh", rotulo: "Soma dos desvios absolutos", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas_materiais", rotulo: "Horas materiais", tipo: "numero", casas: 0 },
  { id: "horas_inversao", rotulo: "Horas com sentido oposto", tipo: "numero", casas: 0 },
  { id: "dia_rotulado", rotulo: "Dia rotulado (programa repetido)", tipo: "texto", categorica: true },
];

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

export const COLUNAS_PROGRAMADO_MENSAL: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "data" },
  { id: "horas", rotulo: "Horas comparadas", tipo: "numero", casas: 0 },
  { id: "programado_mwh", rotulo: "Programado (saldo do mês)", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "verificado_mwh", rotulo: "Verificado (saldo do mês)", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "desvio_abs_mwh", rotulo: "Soma dos desvios absolutos", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas_materiais", rotulo: "Horas materiais", tipo: "numero", casas: 0 },
  { id: "horas_inversao", rotulo: "Horas com sentido oposto", tipo: "numero", casas: 0 },
  { id: "dias_rotulados", rotulo: "Dias rotulados no mês", tipo: "numero", casas: 0 },
];

/** Nos países a coluna de dias rotulados não se aplica (a regra só rotula dias das fronteiras) e sai da tabela. */
export function colunasProgramadoMensal(par: ParProgramado): ColunaTabela[] {
  return ehFronteira(par) ? COLUNAS_PROGRAMADO_MENSAL : COLUNAS_PROGRAMADO_MENSAL.filter((c) => c.id !== "dias_rotulados");
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
export function avisoMesIncompleto(m: string | undefined, horasComparadas: number | null | undefined): string | null {
  if (!m || horasComparadas === null || horasComparadas === undefined) return null;
  const cal = horasDoMes(m);
  if (horasComparadas >= cal) return null;
  return `${mesAno(m)} tem ${num(horasComparadas, 0)} de ${num(cal, 0)} horas comparadas: as contagens desse mês não se comparam diretamente com as dos meses completos.`;
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

export function linhasMaioresDesvios(lista: readonly MaiorDesvio[]): LinhaMaiorDesvio[] {
  return lista.map((x) => ({
    id: `${x.hora}|${x.par}`,
    hora: x.hora,
    par: nomePar(x.par),
    programado_mwmed: x.programado_mwmed,
    verificado_mwmed: x.verificado_mwmed,
    desvio_mwmed: x.desvio_mwmed,
    inversao: x.inversao ? "sim" : "não",
    dia_rotulado: ehFronteira(x.par) ? (x.dia_rotulado ? "sim" : "não") : NAO_SE_APLICA,
  }));
}

export const COLUNAS_MAIORES_DESVIOS: ColunaTabela[] = [
  { id: "hora", rotulo: "Hora (início, Brasília)", tipo: "data" },
  { id: "par", rotulo: "Fronteira ou país", tipo: "texto", categorica: true },
  { id: "programado_mwmed", rotulo: "Programado", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "verificado_mwmed", rotulo: "Verificado", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "desvio_mwmed", rotulo: "Desvio (verificado − programado)", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "inversao", rotulo: "Sentido oposto ao programa", tipo: "texto", categorica: true },
  { id: "dia_rotulado", rotulo: "Dia rotulado", tipo: "texto", categorica: true },
];

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
export function linhasProgramaRepetido(p: Pick<ProgramadoRede, "programa_repetido">): LinhaProgramaRepetido[] {
  return p.programa_repetido.dias.flatMap((d) =>
    FRONTEIRAS.map((par) => {
      const x = d.por_par[par];
      const seq = d.sequencias.filter((s) => s.par === par);
      return {
        id: `${d.dia}|${par}`,
        dia: d.dia,
        fronteira: nomeFronteira(par),
        programado_mwh: x?.programado_mwh ?? null,
        verificado_mwh: x?.verificado_mwh ?? null,
        desvio_abs_mwh: x?.desvio_abs_mwh ?? null,
        horas_materiais: x?.horas_materiais ?? null,
        sequencia: seq.length ? seq.map((s) => `${plural(s.horas, "hora", "horas")} seguidas com ${mwmed(s.valor_mwmed, 3)}`).join("; ") : "nenhuma",
      };
    }),
  );
}

export const COLUNAS_PROGRAMA_REPETIDO: ColunaTabela[] = [
  { id: "dia", rotulo: "Dia", tipo: "data" },
  { id: "fronteira", rotulo: "Fronteira", tipo: "texto" },
  { id: "programado_mwh", rotulo: "Programado (saldo do dia)", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "verificado_mwh", rotulo: "Verificado (saldo do dia)", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "desvio_abs_mwh", rotulo: "Soma dos desvios absolutos", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "horas_materiais", rotulo: "Horas materiais", tipo: "numero", casas: 0 },
  { id: "sequencia", rotulo: "Programa repetido", tipo: "texto" },
];

/** Frase sobre os dias rotulados (sem afirmar se o programa é real ou defeito do arquivo). */
export function textoProgramaRepetido(p: Pick<ProgramadoRede, "programa_repetido">): string {
  const dias = p.programa_repetido.dias;
  if (!dias.length) return `Nenhum dia com programa repetido por ${p.programa_repetido.minimo_horas} horas seguidas ou mais numa fronteira.`;
  const partes = dias.map((d) => `${dataBR(d.dia)} (${listaTexto(d.sequencias.map((s) => `${nomeFronteira(s.par)} com ${mwmed(s.valor_mwmed, 3)} em ${plural(s.horas, "hora seguida", "horas seguidas")}`))})`);
  return `${dias.length === 1 ? "Dia rotulado" : "Dias rotulados"} por programa repetido: ${listaTexto(partes)}. ${dias.length === 1 ? "O dia não é descartado" : "Os dias não são descartados"}: a distribuição sai com e sem ${dias.length === 1 ? "ele" : "eles"}, e nada aqui afirma se o programa é real ou defeito do arquivo.`;
}

/** Conferência do programa do exterior com o PDO das conversoras, em uma frase. */
export function textoConferenciaPdo(p: Pick<ProgramadoRede, "versao_programa">): string {
  const c = p.versao_programa.conferencia_pdo;
  const sem = c.dias_sem_programado_no_conjunto.length ? `; ${listaTexto(c.dias_sem_programado_no_conjunto.map(dataBR))} ainda sem programado no conjunto internacional` : "";
  return `Programa do exterior conferido com o PDO das conversoras em ${num(c.dias_comparados, 0)} de ${num(c.dias, 0)} dias da amostra (${c.amostra}${sem}): ${num(c.horas_conferem, 0)} de ${num(c.horas, 0)} horas conferem dentro de ${num(c.tolerancia_mwmed, 1)} MWmed, ${num(c.horas_com_programa_ou_pdo_conferem, 0)} de ${num(c.horas_com_programa_ou_pdo, 0)} entre as horas com programa ou PDO diferente de zero.`;
}

/* ---------- utilidades comuns às tabelas ---------- */

/** Mês "2026-09" como "set/2026" na coluna de texto (o arquivo exportado mantém o mês ISO na chave). */
export function rotuloMes(m: string): string {
  return mesAno(m);
}

export { mwh as textoMwh, mwmed as textoMwmed, horas as textoHoras };
