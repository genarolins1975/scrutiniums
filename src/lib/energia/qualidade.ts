/**
 * Módulo Qualidade do serviço de distribuição (P051 a P054), lado da interface:
 * lógica pura, sem React, testada em node (src/tests/energia-qualidade.test.ts).
 *
 * O que fica aqui e por quê:
 *  - as respostas curtas e os textos de "o que mudou" de cada painel, montados por
 *    regra a partir dos números da gold (nenhuma frase traz número fixo; quando o
 *    número falta, a frase diz que falta e por quê);
 *  - as linhas que alimentam gráfico, tabela e exportação de cada painel: o gráfico,
 *    a tabela equivalente e o CSV saem da MESMA lista, então mostram as mesmas linhas;
 *  - a leitura dos arquivos de download (municípios e conjuntos), que a página só
 *    busca no navegador quando o mapa ou o explorador de conjuntos aparece (contrato,
 *    seção 5.1), e a conversão de horas decimais em horas e minutos.
 *
 * Nenhuma fórmula do indicador é refeita aqui: DEC, FEC, limites, razões, taxas e
 * compensações vêm prontos do pipeline (pipeline/energia/modulos/qualidade.py). As
 * únicas contas são de exibição: horas decimais em minutos (9,33 h são 9 h 20 min, nunca
 * 9 h 33 min), reais em milhões e classes de histograma de valores já publicados.
 */
import type { Idioma } from "@/lib/idioma";
import type { DistribuicaoHistograma } from "./distribuicao";
import { campo, tiposUrl, type Leitor } from "./estadoUrl";
import { dataBR, mesAno, num, pct } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import { CATEGORIA_IASC_EN, CLASSIFICACAO_EN, ORIGEM_EVENTO_EN, PORTE_EN, ROTULOS_TIPO_COMPENSACAO_EN, traducaoExata } from "./i18n/qualidade-perdas";
import { LIMITE_COMPARACAO, type ColunaTabela, type LinhaTabela } from "./tabela";
import type {
  BrasilAnual,
  Conjuntos,
  Distribuidora,
  FaixaHistograma,
  GrupoParcela,
  ParcialAno,
  QualidadeGold,
  QualidadeSeriesDistribuidorasGold,
  Quantis,
  RelacaoMunicipio,
  TipoCompensacao,
} from "./tipos-qualidade";
import type { Proveniencia } from "./tipos";

/* ---------------------------------------------------------------- unidades */

/**
 * Horas decimais em horas e minutos: a ANEEL publica o DEC em horas e centésimos de
 * hora, então 9,33 h são 9 h e 0,33 × 60 = 19,8 min, arredondados para 20 min.
 * Ler "9,33" como 9 h 33 min é o erro que o critério de aceite do P051 proíbe.
 */
export function horasEMinutos(h: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (h === null || h === undefined || !Number.isFinite(h) || h < 0) return tx("sem dado", "no data", idioma);
  const total = Math.round(h * 60);
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  const local = idioma === "en" ? "en-US" : "pt-BR";
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas.toLocaleString(local)} h`;
  return `${horas.toLocaleString(local)} h ${minutos} min`;
}

/** Reais em milhões, com uma casa ("R$ 1.007,2 milhões"); ausência é "sem dado". */
export function reaisMilhoes(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return tx("sem dado", "no data", idioma);
  return tx(`R$ ${num(v / 1e6, casas)} milhões`, `R$ ${num(v / 1e6, casas, idioma)} million`, idioma);
}

/** Comparação de dois números na precisão exibida: "abaixo", "acima" ou "igual". */
export function comparaNaPrecisao(a: number, b: number, casas: number): "abaixo" | "acima" | "igual" {
  const f = 10 ** casas;
  const x = Math.round(a * f);
  const y = Math.round(b * f);
  return x < y ? "abaixo" : x > y ? "acima" : "igual";
}

/** "vez" abaixo de 2 e "vezes" a partir de 2 (0,86 vez o limite; 2,5 vezes o limite). */
export function vezes(x: number, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") return Math.abs(x) === 1 ? "time" : "times";
  return Math.abs(x) >= 2 ? "vezes" : "vez";
}

/**
 * Cobertura (fração de 0 a 1) em percentual sem arredondar para 100%: 0,9996 vira
 * "99,96%", nunca "100,0%", que diria que ninguém ficou de fora.
 */
export function pctCobertura(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return tx("sem dado", "no data", idioma);
  const x = v * 100;
  for (const casas of [1, 2, 3]) {
    const t = pct(x, casas, idioma);
    if (x >= 100 || Math.round(x * 10 ** casas) < 100 * 10 ** casas) return t;
  }
  return pct(x, 3, idioma);
}

/** Lista em português: "a", "a e b", "a, b e c" (em inglês, "a, b and c"). */
export function listaPt(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}

/** Classificação da distribuidora como a fonte publica, no idioma da página (sem tradução conhecida, como está). */
export function classificacaoNoIdioma(c: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!c) return tx("sem classificação publicada", "no published classification", idioma);
  return idioma === "en" ? (CLASSIFICACAO_EN[c] ?? c) : c;
}

/** Nome exibido de uma distribuidora: sigla publicada pela ANEEL; sem sigla, o nome do IASC; sem os dois, o CNPJ. */
export function rotuloDistribuidora(d: { sigla: string | null; nome_comercial?: string | null; cnpj: string }): string {
  return d.sigla ?? d.nome_comercial ?? `CNPJ ${d.cnpj}`;
}

/* ---------------------------------------------------------------- estado na URL */

const leitorCnpj: Leitor<string> = { ler: (b) => (/^\d{14}$/.test(b) ? b : undefined), escrever: (v) => v };
const leitorMunicipio: Leitor<string> = { ler: (b) => (/^\d{7}$/.test(b) ? b : undefined), escrever: (v) => v };

/**
 * `?dist=` guarda até quatro distribuidoras (CNPJ), a primeira em destaque. Os painéis
 * leem o mesmo parâmetro: escolher um ponto no gráfico de limites marca a mesma linha
 * nas tabelas, abre o histórico dela e entra na comparação dos pequenos múltiplos; o
 * voltar do navegador desfaz a escolha.
 */
export const CAMPO_DIST = campo(tiposUrl.lista(leitorCnpj, { max: LIMITE_COMPARACAO }), [] as string[], { param: "dist" });
/** `?mun=`: município escolhido no mapa (código IBGE de 7 dígitos), o mesmo na tabela e no histórico. */
export const CAMPO_MUN = campo(leitorMunicipio, "", { param: "mun" });

export const MEDIDAS_MAPA = ["dec_max", "dec_min", "fec_max", "fec_min"] as const;
export type MedidaMapa = (typeof MEDIDAS_MAPA)[number];
/** `?med=`: medida colorida no mapa municipal. */
export const CAMPO_MEDIDA = campo(tiposUrl.opcao(MEDIDAS_MAPA), "dec_max" as MedidaMapa, { param: "med" });

export const INDICADORES = ["dec", "fec"] as const;
export type Indicador = (typeof INDICADORES)[number];
/** `?ind=`: DEC ou FEC no painel de limites. */
export const CAMPO_IND = campo(tiposUrl.opcao(INDICADORES), "dec" as Indicador, { param: "ind" });

export const CLASSES = ["concessionaria", "permissionaria"] as const;
export type ClasseDistribuidora = (typeof CLASSES)[number];
/** `?cls=`: grupo de distribuidoras no gráfico de pontos (concessionárias ou permissionárias). */
export const CAMPO_CLASSE = campo(tiposUrl.opcao(CLASSES), "concessionaria" as ClasseDistribuidora, { param: "cls" });

/** Põe a distribuidora em destaque (primeira da lista), sem repetir e sem passar de quatro. */
export function destacar(lista: readonly string[], id: string): string[] {
  return [id, ...lista.filter((x) => x !== id)].slice(0, LIMITE_COMPARACAO);
}

/* ---------------------------------------------------------------- atalhos da gold */

export function anoBrasil(g: QualidadeGold, ano: number): BrasilAnual | null {
  return g.brasil.anual.find((a) => a.ano === ano) ?? null;
}

export function unidadeIndicador(ind: Indicador, idioma: Idioma = idiomaEnergia()): string {
  return ind === "dec" ? "h" : tx("interrupções", "interruptions", idioma);
}

/* ---------------------------------------------------------------- atualidade */

/**
 * Aviso de fonte defasada. Os indicadores de continuidade têm frequência mensal; a
 * ANEEL republica o conjunto inteiro a cada mês. Mais de 60 dias entre a última
 * publicação da fonte e o processamento quer dizer que pelo menos uma publicação
 * mensal esperada não aconteceu: o painel continua com a última versão validada e diz
 * isso. Sem data de publicação informada pela fonte, não há aviso (nunca se usa a data
 * de captura no lugar).
 */
export function avisoDefasagem(publicadoEm: string | null, processadoEm: string, limiteDias = 60, idioma: Idioma = idiomaEnergia()): string | null {
  if (!publicadoEm) return null;
  const dias = Math.floor((Date.parse(processadoEm) - Date.parse(publicadoEm)) / 86_400_000);
  if (!Number.isFinite(dias) || dias <= limiteDias) return null;
  return tx(
    `A última publicação da ANEEL usada aqui é de ${dataBR(publicadoEm.slice(0, 10))}, ${dias} dias antes deste processamento: a fonte mensal deixou de publicar ao menos uma atualização esperada, e o painel mostra a última versão validada.`,
    `The latest ANEEL release used here is from ${dataBR(publicadoEm.slice(0, 10), idioma)}, ${dias} days before this processing: the monthly source missed at least one expected update, and the panel shows the latest validated version.`,
    idioma,
  );
}

/** Período e defasagem da série mensal: último mês publicado e último mês nacional completo. */
export function textoAtualidade(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const ult = g.brasil.mensal.at(-1);
  const incompletos = g.brasil.mensal.filter((m) => !m.completo && m.m > g.ultimo_mes_completo).map((m) => mesAno(m.m, idioma));
  const partes = [
    tx(`Ano completo mais recente: ${g.ano_referencia}.`, `Most recent complete year: ${g.ano_referencia}.`, idioma),
    tx(`Último mês nacional completo: ${mesAno(g.ultimo_mes_completo)}.`, `Latest complete national month: ${mesAno(g.ultimo_mes_completo, idioma)}.`, idioma),
  ];
  if (ult && ult.m > g.ultimo_mes_completo && incompletos.length) {
    partes.push(
      tx(
        `A ANEEL já publicou ${listaPt(incompletos)}, mas sem todas as distribuidoras: ${incompletos.length === 1 ? "esse mês fica" : "esses meses ficam"} fora de totais e comparações até completar.`,
        `ANEEL has already published ${listaPt(incompletos, idioma)}, but without all distribution utilities: ${incompletos.length === 1 ? "that month stays" : "those months stay"} outside totals and comparisons until complete.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

/* ---------------------------------------------------------------- P051: duração e frequência */

/** P051: DEC e FEC do Brasil no ano de referência, os dois universos e o acumulado do ano corrente. */
export function respostaP051(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  if (!a || a.dec === null || a.fec === null)
    return tx(
      `Sem DEC e FEC nacionais para ${ref}: o ano não tem os 12 meses nacionais completos publicados.`,
      `No national DEC and FEC for ${ref}: the year does not have the 12 complete national months published.`,
      idioma,
    );
  const ant = anoBrasil(g, ref - 1);
  let comparacao = "";
  if (ant && ant.dec !== null && ant.fec !== null) {
    const sd = comparaNaPrecisao(a.dec, ant.dec, 2);
    const sf = comparaNaPrecisao(a.fec, ant.fec, 2);
    const rel = (s: "abaixo" | "acima" | "igual") =>
      s === "igual" ? tx("iguais às", "equal to the", idioma) : s === "abaixo" ? tx("abaixo das", "below the", idioma) : tx("acima das", "above the", idioma);
    comparacao = tx(
      sd === sf
        ? `, ${rel(sd)} ${num(ant.dec, 2)} h e ${num(ant.fec, 2)} interrupções de ${ref - 1}`
        : `; a duração ficou ${rel(sd)} ${num(ant.dec, 2)} h de ${ref - 1} e a frequência ${rel(sf)} ${num(ant.fec, 2)} interrupções`,
      sd === sf
        ? `, ${rel(sd)} ${num(ant.dec, 2, idioma)} h and ${num(ant.fec, 2, idioma)} interruptions of ${ref - 1}`
        : `; duration was ${rel(sd)} ${num(ant.dec, 2, idioma)} h of ${ref - 1} and frequency ${rel(sf)} ${num(ant.fec, 2, idioma)} interruptions`,
      idioma,
    );
  }
  const conc =
    a.dec_concessionarias !== null && a.fec_concessionarias !== null
      ? tx(
          ` Só as concessionárias, o universo do número que a ANEEL divulga: ${num(a.dec_concessionarias, 2)} h e ${num(a.fec_concessionarias, 2)} interrupções.`,
          ` Concession holders only, the universe of the number ANEEL announces: ${num(a.dec_concessionarias, 2, idioma)} h and ${num(a.fec_concessionarias, 2, idioma)} interruptions.`,
          idioma,
        )
      : "";
  return tx(
    `Em ${ref}, cada unidade consumidora ficou em média ${num(a.dec, 2)} horas sem energia (${horasEMinutos(a.dec)}) ` +
      `e teve ${num(a.fec, 2)} interrupções, considerando todas as distribuidoras${comparacao}.${conc}${respostaParcial(g.parcial)}`,
    `In ${ref}, each consumer unit was without power for ${num(a.dec, 2, idioma)} hours on average (${horasEMinutos(a.dec, idioma)}) ` +
      `and had ${num(a.fec, 2, idioma)} interruptions, counting all distribution utilities${comparacao}.${conc}${respostaParcial(g.parcial, idioma)}`,
    idioma,
  );
}

/**
 * Veredito do P051: o DEC e o FEC do Brasil no ano de referência, com a comparação ao ano anterior (a mesma precisão da
 * resposta completa) e o limite de leitura: o número não inclui as interrupções que a regra exclui do apurado.
 */
export function vereditoP051(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  if (!a || a.dec === null || a.fec === null)
    return tx(
      `Sem DEC e FEC nacionais para ${ref}: o ano não tem os 12 meses nacionais completos publicados.`,
      `No national DEC and FEC for ${ref}: the year does not have the 12 complete national months published.`,
      idioma,
    );
  const ant = anoBrasil(g, ref - 1);
  let comparacao = "";
  if (ant && ant.dec !== null && ant.fec !== null) {
    const sd = comparaNaPrecisao(a.dec, ant.dec, 2);
    const sf = comparaNaPrecisao(a.fec, ant.fec, 2);
    const rel = (x: "abaixo" | "acima" | "igual") =>
      x === "igual" ? tx("igual ao", "equal to that", idioma) : x === "abaixo" ? tx("menor que o", "lower than that", idioma) : tx("maior que o", "higher than that", idioma);
    comparacao = tx(
      sd === sf ? (sd === "igual" ? `, o mesmo de ${ref - 1}` : `, ${sd === "abaixo" ? "menos" : "mais"} que em ${ref - 1}`) : `; a duração ficou ${rel(sd)} de ${ref - 1} e a frequência ficou ${rel(sf)} dele`,
      sd === sf ? (sd === "igual" ? `, the same as in ${ref - 1}` : `, ${sd === "abaixo" ? "less" : "more"} than in ${ref - 1}`) : `; duration was ${rel(sd)} of ${ref - 1} and frequency was ${rel(sf)} of that year`,
      idioma,
    );
  }
  return tx(
    `Em ${ref}, cada unidade consumidora ficou em média ${num(a.dec, 2)} horas sem energia (${horasEMinutos(a.dec)}) e teve ${num(a.fec, 2)} interrupções${comparacao}.${a.dec_todas_parcelas !== null ? " O número não inclui as interrupções que a regra exclui do apurado." : ""}`,
    `In ${ref}, each consumer unit was without power for ${num(a.dec, 2, idioma)} hours on average (${horasEMinutos(a.dec, idioma)}) and had ${num(a.fec, 2, idioma)} interruptions${comparacao}.${a.dec_todas_parcelas !== null ? " The number does not include the interruptions that the rule excludes from the assessed value." : ""}`,
    idioma,
  );
}

/** Acumulado do ano corrente: só meses nacionais completos nos dois anos; nunca comparado a ano cheio. */
export function respostaParcial(p: ParcialAno | null, idioma: Idioma = idiomaEnergia()): string {
  if (!p || p.dec === null || p.dec_mesmos_meses_ano_anterior === null) return "";
  const meses = listaPt(p.meses_incluidos.map((m) => mesAno(m, idioma).slice(0, 3)), idioma);
  const s = comparaNaPrecisao(p.dec, p.dec_mesmos_meses_ano_anterior, 2);
  const excluidos = listaPt(p.meses_excluidos.map((m) => mesAno(m.m, idioma)), idioma);
  const fora = p.meses_excluidos.length ? tx(` (${excluidos} fora, incompleto)`, ` (${excluidos} excluded, incomplete)`, idioma) : "";
  return tx(
    ` Em ${p.ano}, somando ${meses}${fora}, foram ${num(p.dec, 2)} h, ${s === "igual" ? "iguais às" : s === "abaixo" ? "abaixo das" : "acima das"} ${num(p.dec_mesmos_meses_ano_anterior, 2)} h dos mesmos meses de ${p.ano - 1}.`,
    ` In ${p.ano}, adding ${meses}${fora}, there were ${num(p.dec, 2, idioma)} h, ${s === "igual" ? "equal to the" : s === "abaixo" ? "below the" : "above the"} ${num(p.dec_mesmos_meses_ano_anterior, 2, idioma)} h of the same months of ${p.ano - 1}.`,
    idioma,
  );
}

/**
 * P051, "o que mudou": o maior DEC da série e o ano de referência. O DEC de todas as origens (o que a regra exclui do apurado, somado) está
 * na faixa de métricas e na seção dos expurgos, logo abaixo; repeti-lo aqui só alongava a nota.
 */
export function mudancaP051(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  const completos = g.brasil.anual.filter((x) => x.completo && x.dec !== null);
  if (!a || a.dec === null || !completos.length) return tx("Sem série anual completa publicada.", "No complete annual series published.", idioma);
  const maior = completos.reduce((m, x) => ((x.dec ?? -1) > (m.dec ?? -1) ? x : m));
  return tx(
    `De ${completos[0].ano} a ${ref}, o maior DEC apurado nacional foi o de ${maior.ano} (${num(maior.dec, 2)} h); ${ref} fechou com ${num(a.dec, 2)} h.`,
    `From ${completos[0].ano} to ${ref}, the highest national assessed DEC was that of ${maior.ano} (${num(maior.dec, 2, idioma)} h); ${ref} closed at ${num(a.dec, 2, idioma)} h.`,
    idioma,
  );
}

/** Linhas anuais do Brasil (2001 em diante): gráfico, tabela e exportação usam esta lista. */
export function linhasBrasilAnual(g: QualidadeGold): LinhaTabela[] {
  return g.brasil.anual
    .filter((a) => a.completo)
    .map((a) => ({
      ano: String(a.ano),
      dec: a.dec,
      dec_limite: a.dec_limite,
      fec: a.fec,
      fec_limite: a.fec_limite,
      dec_concessionarias: a.dec_concessionarias,
      fec_concessionarias: a.fec_concessionarias,
      dec_todas_parcelas: a.dec_todas_parcelas,
      ucs_media: a.ucs_media,
      conjuntos: a.conjuntos,
    }));
}

/** Meses do Brasil: o mês publicado antes de todas as distribuidoras enviarem fica fora do gráfico, com marca na tabela. */
export function linhasBrasilMensal(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return g.brasil.mensal.map((m) => ({
    m: m.m,
    dec: m.completo ? m.dec : null,
    fec: m.completo ? m.fec : null,
    dec_publicado: m.dec,
    fec_publicado: m.fec,
    ucs: m.ucs,
    conjuntos: m.conjuntos,
    situacao: m.completo ? tx("completo", "complete", idioma) : tx("incompleto (envio parcial das distribuidoras)", "incomplete (partial submission by the distribution utilities)", idioma),
  }));
}

export const ORDEM_PARCELAS: GrupoParcela[] = ["apurado", "emergencia", "dia_critico", "externa", "ons"];
export const COR_PARCELA: Record<GrupoParcela, string> = {
  apurado: "var(--cor-energia)", // i18n: dado
  emergencia: "var(--serie-termica)",
  dia_critico: "var(--serie-solar)",
  externa: "var(--serie-sm-se)",
  ons: "var(--serie-referencia)",
};
export function rotulosParcelaCurto(idioma: Idioma = idiomaEnergia()): Record<GrupoParcela, string> {
  return {
    apurado: tx("Apurado (parcelas internas)", "Assessed (internal components)", idioma),
    emergencia: tx("Situação de emergência", "Emergency situation", idioma),
    dia_critico: tx("Dia crítico", "Critical day", idioma),
    externa: tx("Origem externa", "External origin", idioma),
    ons: tx("Corte pedido pelo ONS", "Cut requested by the ONS", idioma),
  };
}
export const ROTULO_PARCELA_CURTO: Record<GrupoParcela, string> = rotulosParcelaCurto("pt");

/** Parcelas do DEC nacional por ano (2010 em diante, quando a fonte publica a desagregação atual). */
export function linhasParcelas(g: QualidadeGold): LinhaTabela[] {
  return g.brasil.anual
    .filter((a) => a.completo && a.parcelas_dec)
    .map((a) => ({ ano: String(a.ano), ...a.parcelas_dec!, total: a.dec_todas_parcelas }));
}

/** Distribuidoras do ano de referência para a tabela do P051 (duração, frequência e expurgos). */
export function linhasDistribuidorasP051(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return g.distribuidoras.map((d) => ({
    id: d.cnpj,
    sigla: rotuloDistribuidora(d),
    cnpj: d.cnpj,
    classificacao: classificacaoNoIdioma(d.classificacao, idioma),
    meses: d.meses,
    ucs: d.ucs,
    conjuntos: d.conjuntos,
    dec: d.dec,
    fec: d.fec,
    dec_todas: d.dec_todas_parcelas,
    pct_expurgado: d.pct_dec_expurgado,
    emergencia: d.parcelas_dec.emergencia,
    dia_critico: d.parcelas_dec.dia_critico,
    quebra: d.quebras_perimetro.length ? d.quebras_perimetro.map((q) => String(q.ano)).join(", ") : tx("nenhuma", "none", idioma),
  }));
}

export function colunasDistP051(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const int = tx("interrupções", "interruptions", idioma);
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "classificacao", rotulo: tx("Classificação", "Classification", idioma), tipo: "texto", categorica: true },
    { id: "ucs", rotulo: tx("UCs (média do ano)", "UCs (annual average)", idioma), tipo: "numero", casas: 0 },
    { id: "conjuntos", rotulo: tx("Conjuntos", "Consumer sets", idioma), tipo: "numero", casas: 0 },
    { id: "meses", rotulo: tx("Meses publicados", "Months published", idioma), tipo: "numero", casas: 0 },
    { id: "dec", rotulo: tx("DEC apurado", "Assessed DEC", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "fec", rotulo: tx("FEC apurado", "Assessed FEC", idioma), tipo: "numero", unidade: int, casas: 2 },
    { id: "dec_todas", rotulo: tx("DEC de todas as origens", "DEC from all origins", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "pct_expurgado", rotulo: tx("Parte expurgada do DEC", "Excluded share of DEC", idioma), tipo: "percentual", casas: 1 },
    { id: "emergencia", rotulo: tx("DEC em emergência", "DEC in emergencies", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "dia_critico", rotulo: tx("DEC em dia crítico", "DEC on critical days", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "quebra", rotulo: tx("Quebra de perímetro (ano)", "Perimeter break (year)", idioma), tipo: "texto" },
    { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  ];
}
export const COLUNAS_DIST_P051: ColunaTabela[] = colunasDistP051("pt");

/** As maiores distribuidoras em unidades consumidoras: seleção inicial dos pequenos múltiplos. */
export function maioresDistribuidoras(g: QualidadeGold, n = LIMITE_COMPARACAO): string[] {
  return [...g.distribuidoras]
    .filter((d) => d.ucs !== null)
    .sort((a, b) => (b.ucs ?? 0) - (a.ucs ?? 0) || (a.cnpj < b.cnpj ? -1 : 1))
    .slice(0, n)
    .map((d) => d.cnpj);
}

/**
 * Pequenos múltiplos: uma linha por ano com o DEC (ou FEC) e o limite de cada
 * distribuidora escolhida, nas colunas `<ind>_<cnpj>` e `lim_<cnpj>`. Ano sem valor
 * fica nulo (lacuna), nunca zero.
 */
export function linhasSerieDistribuidoras(serie: QualidadeSeriesDistribuidorasGold, cnpjs: readonly string[], ind: Indicador): LinhaTabela[] {
  const anos = new Set<number>();
  for (const c of cnpjs) for (const a of serie.distribuidoras[c]?.anos ?? []) anos.add(a);
  return Array.from(anos)
    .sort((a, b) => a - b)
    .map((ano) => {
      const l: LinhaTabela = { ano: String(ano) };
      for (const c of cnpjs) {
        const s = serie.distribuidoras[c];
        const i = s ? s.anos.indexOf(ano) : -1;
        l[`${ind}_${c}`] = i >= 0 ? s![ind][i] : null;
        l[`lim_${c}`] = i >= 0 ? s![ind === "dec" ? "dec_limite" : "fec_limite"][i] : null;
      }
      return l;
    });
}

/* ---------------------------------------------------------------- mapa municipal */

export type MunicipioQualidade = {
  cod: string;
  nome: string;
  uf: string;
  conjuntos: string[];
  relacao: RelacaoMunicipio;
  dec_min: number | null;
  dec_max: number | null;
  fec_min: number | null;
  fec_max: number | null;
  cnpjs: string[];
};

/**
 * CSV com ";" como o pipeline escreve (aspas duplas só em campo com separador, aspas
 * ou quebra de linha; BOM opcional). Vazio é ausência e fica como texto vazio.
 */
export function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campoAtual = "";
  let linha: string[] = [];
  let aspas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campoAtual += '"';
          i++;
        } else aspas = false;
      } else campoAtual += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") {
      linha.push(campoAtual);
      campoAtual = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campoAtual);
      campoAtual = "";
      if (linha.length > 1 || linha[0] !== "") linhas.push(linha);
      linha = [];
    } else campoAtual += c;
  }
  if (campoAtual !== "" || linha.length) {
    linha.push(campoAtual);
    linhas.push(linha);
  }
  const [cab, ...resto] = linhas;
  if (!cab) return [];
  return resto.map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i] ?? ""])));
}

const numeroOuNulo = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

const RELACOES: readonly RelacaoMunicipio[] = ["conjunto_exclusivo", "conjunto_compartilhado", "varios_conjuntos", "sem_conjunto_ativo", "sem_relacao_na_fonte"];

/**
 * Municípios do CSV de download (qualidade_municipios.csv): só os que existem no
 * cadastro do IBGE (no_ibge = 1). Os códigos da base da ANEEL fora do IBGE ficam fora do
 * mapa e são listados na gold (mapa.correspondencia.codigos_sem_ibge).
 */
export function municipiosDoCsv(texto: string): MunicipioQualidade[] {
  return lerCsv(texto)
    .filter((l) => l.no_ibge === "1")
    .map((l) => ({
      cod: l.cod_ibge,
      nome: l.municipio,
      uf: l.uf,
      conjuntos: l.conjuntos ? l.conjuntos.split(" ").filter(Boolean) : [],
      relacao: (RELACOES as readonly string[]).includes(l.relacao) ? (l.relacao as RelacaoMunicipio) : "sem_relacao_na_fonte",
      dec_min: numeroOuNulo(l.dec_min_h),
      dec_max: numeroOuNulo(l.dec_max_h),
      fec_min: numeroOuNulo(l.fec_min),
      fec_max: numeroOuNulo(l.fec_max),
      cnpjs: l.cnpjs ? l.cnpjs.split(" ").filter(Boolean) : [],
    }));
}

export function rotulosRelacao(idioma: Idioma = idiomaEnergia()): Record<RelacaoMunicipio, string> {
  return {
    conjunto_exclusivo: tx("um conjunto, só deste município", "one consumer set, serving only this municipality", idioma),
    conjunto_compartilhado: tx("um conjunto, compartilhado com outros municípios", "one consumer set, shared with other municipalities", idioma),
    varios_conjuntos: tx("vários conjuntos", "several consumer sets", idioma),
    sem_conjunto_ativo: tx("sem conjunto com DEC no ano", "no consumer set with DEC in the year", idioma),
    sem_relacao_na_fonte: tx("não citado na base da ANEEL", "not listed in the ANEEL database", idioma),
  };
}
export const ROTULO_RELACAO: Record<RelacaoMunicipio, string> = rotulosRelacao("pt");

export function rotulosMedida(idioma: Idioma = idiomaEnergia()): Record<MedidaMapa, { rotulo: string; unidade: string; curto: string }> {
  const int = tx("interrupções", "interruptions", idioma);
  return {
    dec_max: { rotulo: tx("Maior DEC entre os conjuntos que atendem o município", "Highest DEC among the consumer sets serving the municipality", idioma), unidade: "h", curto: tx("DEC, maior conjunto", "DEC, highest cluster", idioma) },
    dec_min: { rotulo: tx("Menor DEC entre os conjuntos que atendem o município", "Lowest DEC among the consumer sets serving the municipality", idioma), unidade: "h", curto: tx("DEC, menor conjunto", "DEC, lowest cluster", idioma) },
    fec_max: { rotulo: tx("Maior FEC entre os conjuntos que atendem o município", "Highest FEC among the consumer sets serving the municipality", idioma), unidade: int, curto: tx("FEC, maior conjunto", "FEC, highest cluster", idioma) },
    fec_min: { rotulo: tx("Menor FEC entre os conjuntos que atendem o município", "Lowest FEC among the consumer sets serving the municipality", idioma), unidade: int, curto: tx("FEC, menor conjunto", "FEC, lowest cluster", idioma) },
  };
}
export const ROTULO_MEDIDA: Record<MedidaMapa, { rotulo: string; unidade: string; curto: string }> = rotulosMedida("pt");

/**
 * Cortes fixos (não quantis) para o mapa: a mesma régua em qualquer recorte, para o
 * leitor comparar cores entre medidas de DEC (horas) e entre medidas de FEC.
 */
export const CORTES_MAPA: Record<Indicador, number[]> = { dec: [5, 10, 20, 40], fec: [3, 5, 10, 20] };
export const CORES_MAPA = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

/** Valores do mapa para a medida escolhida: ausência fica nula (hachura), nunca zero. */
export function valoresMapa(municipios: readonly MunicipioQualidade[], medida: MedidaMapa): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const m of municipios) out[m.cod] = m[medida];
  return out;
}

/** Linhas da tabela sincronizada com o mapa (as mesmas que viram CSV e XLSX). */
export function linhasMunicipios(municipios: readonly MunicipioQualidade[], rotuloCnpj: (c: string) => string, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const relacao = rotulosRelacao(idioma);
  return municipios.map((m) => ({
    id: m.cod,
    municipio: m.nome,
    uf: m.uf,
    relacao: relacao[m.relacao],
    n_conjuntos: m.conjuntos.length,
    dec_min: m.dec_min,
    dec_max: m.dec_max,
    fec_min: m.fec_min,
    fec_max: m.fec_max,
    distribuidoras: m.cnpjs.map(rotuloCnpj).join(", "),
    cod_ibge: m.cod,
  }));
}

export function colunasMunicipios(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const int = tx("interrupções", "interruptions", idioma);
  return [
    { id: "municipio", rotulo: tx("Município", "Municipality", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "uf", rotulo: tx("UF", "State (UF)", idioma), tipo: "texto", categorica: true },
    { id: "relacao", rotulo: tx("Relação com os conjuntos", "Relation to the consumer sets", idioma), tipo: "texto", categorica: true },
    { id: "n_conjuntos", rotulo: tx("Conjuntos citados", "Consumer sets listed", idioma), tipo: "numero", casas: 0 },
    { id: "dec_min", rotulo: tx("DEC do menor conjunto", "DEC of the lowest cluster", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "dec_max", rotulo: tx("DEC do maior conjunto", "DEC of the highest cluster", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "fec_min", rotulo: tx("FEC do menor conjunto", "FEC of the lowest cluster", idioma), tipo: "numero", unidade: int, casas: 2 },
    { id: "fec_max", rotulo: tx("FEC do maior conjunto", "FEC of the highest cluster", idioma), tipo: "numero", unidade: int, casas: 2 },
    { id: "distribuidoras", rotulo: tx("Distribuidoras", "Distribution utilities", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "cod_ibge", rotulo: tx("Código IBGE", "IBGE code", idioma), tipo: "texto", buscavel: true },
  ];
}
export const COLUNAS_MUNICIPIOS: ColunaTabela[] = colunasMunicipios("pt");

/** O município escolhido no mapa, em uma frase: intervalo dos conjuntos, nunca um DEC "do município". */
export function respostaMunicipio(m: MunicipioQualidade, ano: number, idioma: Idioma = idiomaEnergia()): string {
  const lugar = `${m.nome} (${m.uf})`;
  const n2 = (v: number | null) => num(v, 2, idioma);
  const dec = (a: number | null, b: number | null) => (a === b ? `${n2(a)} h` : tx(`de ${n2(a)} a ${n2(b)} h`, `from ${n2(a)} to ${n2(b)} h`, idioma));
  const fec = (a: number | null, b: number | null) =>
    a === b ? tx(`${n2(a)} interrupções`, `${n2(a)} interruptions`, idioma) : tx(`de ${n2(a)} a ${n2(b)} interrupções`, `from ${n2(a)} to ${n2(b)} interruptions`, idioma);
  const codigo = m.conjuntos[0] ?? tx("código não publicado", "code not published", idioma);
  switch (m.relacao) {
    case "sem_relacao_na_fonte":
      return tx(
        `${lugar} não aparece na base IndQual Município da ANEEL: nenhum conjunto é atribuído a ele, e o mapa fica sem valor.`,
        `${lugar} does not appear in ANEEL's IndQual Município database: no consumer set is assigned to it, and the map has no value.`,
        idioma,
      );
    case "sem_conjunto_ativo":
      return tx(
        `${lugar} é citado na base da ANEEL, mas nenhum dos conjuntos ligados a ele publicou DEC com 12 meses em ${ano}: sem valor no mapa.`,
        `${lugar} is listed in the ANEEL database, but none of the consumer sets linked to it published a 12-month DEC in ${ano}: no value on the map.`,
        idioma,
      );
    case "conjunto_exclusivo":
      return tx(
        `${lugar} é atendido por um conjunto que só atende este município (${codigo}): DEC de ${num(m.dec_max, 2)} h (${horasEMinutos(m.dec_max)}) e FEC de ${num(m.fec_max, 2)} interrupções em ${ano}.`,
        `${lugar} is served by one consumer set that serves only this municipality (${codigo}): DEC of ${n2(m.dec_max)} h (${horasEMinutos(m.dec_max, idioma)}) and FEC of ${n2(m.fec_max)} interruptions in ${ano}.`,
        idioma,
      );
    case "conjunto_compartilhado":
      return tx(
        `${lugar} é atendido por um conjunto (${codigo}) que também atende outros municípios: DEC de ${num(m.dec_max, 2)} h e FEC de ${num(m.fec_max, 2)} interrupções em ${ano}, valores do conjunto inteiro, não medidos só no município.`,
        `${lugar} is served by one consumer set (${codigo}) that also serves other municipalities: DEC of ${n2(m.dec_max)} h and FEC of ${n2(m.fec_max)} interruptions in ${ano}, values of the whole cluster, not measured in the municipality alone.`,
        idioma,
      );
    default:
      return tx(
        `${lugar} é atendido por ${m.conjuntos.length} conjuntos. Em ${ano}, o DEC anual desses conjuntos vai ${dec(m.dec_min, m.dec_max)} e o FEC ${fec(m.fec_min, m.fec_max)}; a base não informa quantas unidades de cada conjunto ficam no município, então nenhuma média municipal é calculada.`,
        `${lugar} is served by ${m.conjuntos.length} consumer sets. In ${ano}, the annual DEC of these sets ranges ${dec(m.dec_min, m.dec_max)} and the FEC ${fec(m.fec_min, m.fec_max)}; the database does not report how many units of each cluster are in the municipality, so no municipal average is calculated.`,
        idioma,
      );
  }
}

/* ---------------------------------------------------------------- P052: realizado e limites */

/** P052: conjuntos acima do limite, peso em UCs, Brasil diante do limite agregado e as caudas. */
export function respostaP052(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = g.conjuntos;
  const a = anoBrasil(g, c.ano);
  const q = c.quantis_razao_dec;
  const ant = c.historico.find((h) => h.ano === c.ano - 1);
  const partes = [
    tx(
      `Em ${c.ano}, ${num(c.acima_limite_dec, 0)} dos ${num(c.com_limite, 0)} conjuntos com limite (${pct(c.pct_acima_limite_dec, 1)}) ficaram acima do limite anual de DEC, com ${pct(c.pct_ucs_acima_limite_dec, 1)} das unidades consumidoras` +
        (ant ? `, contra ${pct(ant.pct_acima_limite_dec, 1)} dos conjuntos em ${ant.ano}` : "") +
        `; ${num(c.acima_limite_fec, 0)} passaram do limite de FEC.`,
      `In ${c.ano}, ${num(c.acima_limite_dec, 0, idioma)} of the ${num(c.com_limite, 0, idioma)} consumer sets with a limit (${pct(c.pct_acima_limite_dec, 1, idioma)}) were above the annual DEC limit, with ${pct(c.pct_ucs_acima_limite_dec, 1, idioma)} of the consumer units` +
        (ant ? `, against ${pct(ant.pct_acima_limite_dec, 1, idioma)} of the clusters in ${ant.ano}` : "") +
        `; ${num(c.acima_limite_fec, 0, idioma)} exceeded the FEC limit.`,
      idioma,
    ),
  ];
  if (a && a.dec !== null && a.dec_limite !== null && a.razao_dec !== null) {
    const s = comparaNaPrecisao(a.dec, a.dec_limite, 2);
    partes.push(
      tx(
        `No Brasil, o DEC apurado (${num(a.dec, 2)} h) ficou ${s === "igual" ? "igual ao" : s === "abaixo" ? "abaixo do" : "acima do"} limite agregado (${num(a.dec_limite, 2)} h), ${num(a.razao_dec, 3)} ${vezes(a.razao_dec)} o limite.`,
        `In Brazil, the assessed DEC (${num(a.dec, 2, idioma)} h) was ${s === "igual" ? "equal to the" : s === "abaixo" ? "below the" : "above the"} aggregate limit (${num(a.dec_limite, 2, idioma)} h), ${num(a.razao_dec, 3, idioma)} ${vezes(a.razao_dec, idioma)} the limit.`,
        idioma,
      ),
    );
  }
  if (q.p50 !== null && q.p90 !== null) {
    partes.push(
      tx(
        `A média esconde as pontas: metade dos conjuntos ficou abaixo de ${num(q.p50, 2)} ${vezes(q.p50)} o próprio limite e um em cada dez ficou acima de ${num(q.p90, 2)} ${vezes(q.p90)}.`,
        `The average hides the tails: half of the consumer sets were below ${num(q.p50, 2, idioma)} ${vezes(q.p50, idioma)} their own DEC limit and one in ten was above ${num(q.p90, 2, idioma)} ${vezes(q.p90, idioma)}.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

/**
 * Veredito do P052: que fração dos conjuntos com limite passou do limite anual de DEC e como estava no ano anterior. Os
 * conjuntos em número, o peso em unidades consumidoras, o Brasil diante do limite agregado e as caudas ficam na resposta completa.
 */
export function vereditoP052(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = g.conjuntos;
  const ant = c.historico.find((h) => h.ano === c.ano - 1);
  const contra =
    ant && ant.pct_acima_limite_dec !== null ? tx(`, contra ${pct(ant.pct_acima_limite_dec, 1)} em ${ant.ano}`, `, against ${pct(ant.pct_acima_limite_dec, 1, idioma)} in ${ant.ano}`, idioma) : "";
  const q = c.quantis_razao_dec;
  const pontas =
    q.p90 !== null && q.p90 > 1
      ? tx(" A média do Brasil esconde as pontas: há conjuntos bem acima do próprio limite.", " The Brazilian average hides the tails: some consumer sets are well above their own limit.", idioma)
      : "";
  return tx(
    `Em ${c.ano}, ${pct(c.pct_acima_limite_dec, 1)} dos conjuntos com limite ficaram acima do limite anual de DEC${contra}.${pontas}`,
    `In ${c.ano}, ${pct(c.pct_acima_limite_dec, 1, idioma)} of the consumer sets with a limit were above the annual DEC limit${contra}.${pontas}`,
    idioma,
  );
}

/** P052, "o que mudou": trajetória da fração de conjuntos acima do limite. */
export function mudancaP052(c: Conjuntos, idioma: Idioma = idiomaEnergia()): string {
  const h = c.historico.filter((x) => x.pct_acima_limite_dec !== null);
  if (h.length < 2) return tx("Sem histórico suficiente de conjuntos com limite.", "Not enough history of consumer sets with a limit.", idioma);
  const maior = h.reduce((m, x) => ((x.pct_acima_limite_dec ?? -1) > (m.pct_acima_limite_dec ?? -1) ? x : m));
  const ult = h[h.length - 1];
  return tx(
    `De ${h[0].ano} a ${ult.ano}, a fração de conjuntos acima do limite de DEC teve o máximo em ${maior.ano} (${pct(maior.pct_acima_limite_dec, 1)}) e fechou ${ult.ano} em ${pct(ult.pct_acima_limite_dec, 1)}. O limite de cada conjunto também muda de um ano para outro, então a fração acima dele mistura desempenho e meta.`,
    `From ${h[0].ano} to ${ult.ano}, the share of consumer sets above the DEC limit peaked in ${maior.ano} (${pct(maior.pct_acima_limite_dec, 1, idioma)}) and closed ${ult.ano} at ${pct(ult.pct_acima_limite_dec, 1, idioma)}. The limit of each cluster also changes from one year to the next, so the share above it mixes performance and target.`,
    idioma,
  );
}

/** Itens do gráfico de pontos realizado × limite (um por distribuidora, ano de referência). */
export function itensLimite(g: QualidadeGold, ind: Indicador, idioma: Idioma = idiomaEnergia()): { id: string; rotulo: string; valor: number | null; referencia: number | null; detalhe?: string }[] {
  return g.distribuidoras.map((d) => {
    const valor = ind === "dec" ? d.dec : d.fec;
    const ref = ind === "dec" ? d.dec_limite : d.fec_limite;
    const notas = [
      d.meses < 12 ? tx(`${d.meses} meses publicados: sem valor anual`, `${d.meses} months published: no annual value`, idioma) : null,
      d.cobertura_limite !== null && d.cobertura_limite < 1
        ? tx(`limite cobre ${pct(d.cobertura_limite * 100, 0)} das UCs`, `limit covers ${pct(d.cobertura_limite * 100, 0, idioma)} of the UCs`, idioma)
        : null,
      d.quebras_perimetro.some((q) => q.ano === g.ano_referencia) ? tx("perímetro mudou no ano (incorporação)", "perimeter changed in the year (merger)", idioma) : null,
    ].filter(Boolean) as string[];
    return {
      id: d.cnpj,
      rotulo: rotuloDistribuidora(d),
      valor,
      referencia: ref,
      detalhe: notas.length ? notas.join("; ") : undefined,
    };
  });
}

/** Tabela do P052: realizado, limite, razão e DGC (calculado ao lado do publicado no ranking). */
export function linhasLimites(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return g.distribuidoras.map((d) => ({
    id: d.cnpj,
    sigla: rotuloDistribuidora(d),
    classificacao: classificacaoNoIdioma(d.classificacao, idioma),
    dec: d.dec,
    dec_limite: d.dec_limite,
    razao_dec: d.razao_dec,
    fec: d.fec,
    fec_limite: d.fec_limite,
    razao_fec: d.razao_fec,
    situacao: situacaoLimite(d, idioma),
    dgc_calculado: d.dgc_calculado,
    dgc_publicado: d.dgc_publicado,
    posicao: d.posicao_ranking,
    porte: d.porte_ranking ? (idioma === "en" ? (PORTE_EN[d.porte_ranking] ?? d.porte_ranking) : d.porte_ranking) : tx("fora do ranking", "not in the ranking", idioma),
    cobertura_limite: d.cobertura_limite === null ? null : d.cobertura_limite * 100,
    cnpj: d.cnpj,
  }));
}

/** Situação diante dos dois limites agregados, decidida nas duas casas que a ANEEL publica. */
export function situacaoLimite(d: Pick<Distribuidora, "dec" | "fec" | "dec_limite" | "fec_limite">, idioma: Idioma = idiomaEnergia()): string {
  if (d.dec === null || d.fec === null || d.dec_limite === null || d.fec_limite === null) return tx("sem valor anual ou sem limite", "no annual value or no limit", idioma);
  const sd = comparaNaPrecisao(d.dec, d.dec_limite, 2) === "acima";
  const sf = comparaNaPrecisao(d.fec, d.fec_limite, 2) === "acima";
  if (sd && sf) return tx("acima dos dois limites", "above both limits", idioma);
  if (sd) return tx("acima do limite de DEC", "above the DEC limit", idioma);
  if (sf) return tx("acima do limite de FEC", "above the FEC limit", idioma);
  return tx("dentro dos dois limites", "within both limits", idioma);
}

export function colunasLimites(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const int = tx("interrupções", "interruptions", idioma);
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "situacao", rotulo: tx("Situação", "Status", idioma), tipo: "texto", categorica: true },
    { id: "dec", rotulo: tx("DEC apurado", "Assessed DEC", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "dec_limite", rotulo: tx("Limite de DEC", "DEC limit", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "razao_dec", rotulo: tx("DEC ÷ limite", "DEC ÷ limit", idioma), tipo: "numero", casas: 3 },
    { id: "fec", rotulo: tx("FEC apurado", "Assessed FEC", idioma), tipo: "numero", unidade: int, casas: 2 },
    { id: "fec_limite", rotulo: tx("Limite de FEC", "FEC limit", idioma), tipo: "numero", unidade: int, casas: 2 },
    { id: "razao_fec", rotulo: tx("FEC ÷ limite", "FEC ÷ limit", idioma), tipo: "numero", casas: 3 },
    { id: "dgc_calculado", rotulo: tx("DGC calculado", "Calculated DGC", idioma), tipo: "numero", casas: 3 },
    { id: "dgc_publicado", rotulo: tx("DGC no ranking da ANEEL", "DGC in the ANEEL ranking", idioma), tipo: "numero", casas: 2 },
    { id: "posicao", rotulo: tx("Posição no ranking da ANEEL", "Position in the ANEEL ranking", idioma), tipo: "numero", casas: 0 },
    { id: "porte", rotulo: tx("Porte no ranking da ANEEL", "Size group in the ANEEL ranking", idioma), tipo: "texto", categorica: true },
    { id: "classificacao", rotulo: tx("Classificação", "Classification", idioma), tipo: "texto", categorica: true },
    { id: "cobertura_limite", rotulo: tx("UCs com limite", "UCs with a limit", idioma), tipo: "percentual", casas: 0 },
    { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  ];
}
export const COLUNAS_LIMITES: ColunaTabela[] = colunasLimites("pt");

/** Histórico de uma distribuidora (série sob demanda), em uma frase com o último ano e a quebra de perímetro. */
export function respostaHistoricoDistribuidora(
  rotulo: string,
  s: { anos: number[]; dec: (number | null)[]; fec: (number | null)[]; dec_limite: (number | null)[]; fec_limite: (number | null)[]; quebras: number[] } | undefined,
  ind: Indicador,
  idioma: Idioma = idiomaEnergia(),
): string {
  if (!s || !s.anos.length) return tx(`${rotulo}: sem série anual publicada.`, `${rotulo}: no annual series published.`, idioma);
  const v = s[ind];
  const l = s[ind === "dec" ? "dec_limite" : "fec_limite"];
  const nome = ind === "dec" ? "DEC" : "FEC";
  const un = unidadeIndicador(ind, idioma);
  let acima = 0;
  let comparados = 0;
  for (let i = 0; i < s.anos.length; i++) {
    const x = v[i];
    const y = l[i];
    if (x === null || y === null) continue;
    comparados++;
    if (comparaNaPrecisao(x, y, 2) === "acima") acima++;
  }
  const i = s.anos.length - 1;
  const ult =
    v[i] !== null && l[i] !== null
      ? tx(` Em ${s.anos[i]}: ${num(v[i], 2)} ${un} para um limite de ${num(l[i], 2)} ${un}.`, ` In ${s.anos[i]}: ${num(v[i], 2, idioma)} ${un} for a limit of ${num(l[i], 2, idioma)} ${un}.`, idioma)
      : "";
  const anosQuebra = listaPt(s.quebras.map(String), idioma);
  const quebra = s.quebras.length
    ? tx(` O perímetro mudou em ${anosQuebra} (incorporação): antes e depois não são a mesma área.`, ` The perimeter changed in ${anosQuebra} (merger): before and after are not the same area.`, idioma)
    : "";
  return tx(
    `${rotulo}: ${nome} acima do limite em ${acima} de ${comparados} anos com valor e limite, de ${s.anos[0]} a ${s.anos[i]}.${ult}${quebra}`,
    `${rotulo}: ${nome} above the limit in ${acima} of ${comparados} years with a value and a limit, from ${s.anos[0]} to ${s.anos[i]}.${ult}${quebra}`,
    idioma,
  );
}

/**
 * Histograma da razão apurado ÷ limite a partir das faixas publicadas na gold (os 3.146
 * conjuntos ficam no CSV). A última faixa é aberta na fonte ("3 ou mais"); ela fecha no
 * máximo publicado, para o desenho ter largura, e o rótulo diz o máximo. Os quantis são
 * os da gold, não recalculados.
 */
export function histogramaDeFaixas(faixas: readonly FaixaHistograma[], q: Quantis): DistribuicaoHistograma {
  const classes = faixas.map((f, i) => {
    const ultima = i === faixas.length - 1;
    const fim = f.ate ?? (q.max !== null && q.max > f.de ? q.max : f.de + (faixas[i - 1] ? f.de - faixas[i - 1].de : 1));
    return { inicio: f.de, fim, contagem: f.conjuntos, fechadaDireita: ultima };
  });
  const larguras = classes.map((c) => c.fim - c.inicio);
  const n = classes.reduce((s, c) => s + c.contagem, 0);
  return {
    classes,
    massas: [],
    resumo: { n, semDado: 0, min: q.min, p10: q.p10, p25: q.p25, mediana: q.p50, p75: q.p75, p90: q.p90, max: q.max },
    foraDasClasses: { abaixo: 0, acima: 0 },
    larguraReferencia: Math.min(...larguras),
    larguraUniforme: larguras.every((w) => Math.abs(w - larguras[0]) < 1e-9),
  };
}

/** Série histórica dos conjuntos acima do limite (gráfico e tabela). */
export function linhasHistoricoConjuntos(c: Conjuntos): LinhaTabela[] {
  return c.historico.map((h) => ({
    ano: String(h.ano),
    pct_acima: h.pct_acima_limite_dec,
    pct_ucs_acima: h.pct_ucs_acima_limite_dec,
    acima: h.acima_limite_dec,
    com_limite: h.com_limite,
    razao_p50: h.razao_p50,
    razao_p90: h.razao_p90,
    dec_p50: h.dec_p50,
    dec_p90: h.dec_p90,
  }));
}

/** Matriz faixa de limite × faixa da razão (contagem de conjuntos), para a tabela. */
export function linhasMatriz(c: Conjuntos, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return c.matriz_limite_razao_dec.map((m) => ({
    id: `${m.limite_de}`,
    faixa:
      m.limite_ate === null
        ? tx(`${num(m.limite_de, 0)} h ou mais`, `${num(m.limite_de, 0, idioma)} h or more`, idioma)
        : tx(`${num(m.limite_de, 0)} a menos de ${num(m.limite_ate, 0)} h`, `${num(m.limite_de, 0, idioma)} to less than ${num(m.limite_ate, 0, idioma)} h`, idioma),
    r0: m["razao_0_0.5"],
    r1: m["razao_0.5_1.0"],
    r2: m["razao_1.0_1.5"],
    r3: m["razao_1.5_mais"],
    total: m["razao_0_0.5"] + m["razao_0.5_1.0"] + m["razao_1.0_1.5"] + m["razao_1.5_mais"],
  }));
}

export function colunasMatriz(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "faixa", rotulo: tx("Limite de DEC do conjunto", "DEC limit of the consumer set", idioma), tipo: "texto" },
    { id: "r0", rotulo: tx("Até metade do limite", "Up to half the limit", idioma), tipo: "numero", casas: 0 },
    { id: "r1", rotulo: tx("Da metade até o limite", "From half up to the limit", idioma), tipo: "numero", casas: 0 },
    { id: "r2", rotulo: tx("De 1 a 1,5 vez o limite", "From 1 to 1.5 times the limit", idioma), tipo: "numero", casas: 0 },
    { id: "r3", rotulo: tx("1,5 vez o limite ou mais", "1.5 times the limit or more", idioma), tipo: "numero", casas: 0 },
    { id: "total", rotulo: tx("Conjuntos", "Consumer sets", idioma), tipo: "numero", casas: 0 }, // i18n: dado
  ];
}
export const COLUNAS_MATRIZ: ColunaTabela[] = colunasMatriz("pt");

/** Caudas publicadas (25 maiores razões e 25 maiores DEC). */
export function linhasCauda(itens: Conjuntos["cauda_dec"]): LinhaTabela[] {
  return itens.map((x) => ({
    id: String(x.conjunto),
    conjunto: String(x.conjunto),
    nome: x.nome,
    sigla: x.sigla,
    dec: x.dec,
    dec_limite: x.dec_limite,
    razao_dec: x.razao_dec,
    fec: x.fec,
    fec_limite: x.fec_limite,
    ucs: x.ucs,
  }));
}

export function colunasCauda(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const int = tx("interrupções", "interruptions", idioma);
  return [
    { id: "nome", rotulo: tx("Conjunto", "Consumer set", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "conjunto", rotulo: tx("Código", "Code", idioma), tipo: "texto" },
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", categorica: true, idiomaTexto: "nome" },
    { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
    { id: "dec_limite", rotulo: tx("Limite de DEC", "DEC limit", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "razao_dec", rotulo: tx("DEC ÷ limite", "DEC ÷ limit", idioma), tipo: "numero", casas: 3 },
    { id: "fec", rotulo: "FEC", tipo: "numero", unidade: int, casas: 2 },
    { id: "fec_limite", rotulo: tx("Limite de FEC", "FEC limit", idioma), tipo: "numero", unidade: int, casas: 2 },
    { id: "ucs", rotulo: tx("UCs (média do ano)", "UCs (annual average)", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_CAUDA: ColunaTabela[] = colunasCauda("pt");

/* ---------------------------------------------------------------- explorador de conjuntos (CSV sob demanda) */

/** Linhas dos conjuntos de um ano, lidas do CSV anual por década (o mesmo arquivo de download). */
/**
 * O FEC de um conjunto diante do limite. A razão e a marca "acima do limite" só existem com os 12 meses de FEC publicados; com menos meses
 * (e FEC e limite publicados) o conjunto fica fora da contagem, e a frase diz se ele já passa do limite com os meses que existem.
 */
export function situacaoFecDoConjunto(
  l: { acima: string; fec: number | null; limite: number | null; razao: number | null; mesesFec?: number | null },
  idioma: Idioma = idiomaEnergia(),
): string {
  if (l.acima === "1") return tx("acima do limite", "above the limit", idioma);
  if (l.acima === "0") return tx("até o limite", "up to the limit", idioma);
  if (l.fec !== null && l.limite !== null && l.razao === null) {
    const meses =
      l.mesesFec !== null && l.mesesFec !== undefined && l.mesesFec < 12
        ? tx(`${l.mesesFec} meses de FEC`, `${l.mesesFec} months of FEC`, idioma)
        : tx("menos de 12 meses de FEC", "fewer than 12 months of FEC", idioma);
    return comparaNaPrecisao(l.fec, l.limite, 2) === "acima" ? tx(`${meses}, já acima do limite`, `${meses}, already above the limit`, idioma) : meses;
  }
  return tx("sem FEC ou sem limite de FEC", "no FEC or no FEC limit", idioma);
}

export function conjuntosDoCsv(texto: string, ano: number, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return lerCsv(texto)
    .filter((l) => Number(l.ano) === ano)
    .map((l) => {
      // sem a marca do limite: ou o conjunto tem menos de 12 meses de DEC (o valor do arquivo é a soma dos meses publicados, não um ano), ou não tem limite
      const meses = numeroOuNulo(l.meses);
      const acima =
        l.acima_limite_dec === "1"
          ? tx("acima do limite", "above the limit", idioma)
          : l.acima_limite_dec === "0"
            ? tx("até o limite", "up to the limit", idioma)
            : meses !== null && meses < 12
              ? tx("menos de 12 meses publicados", "fewer than 12 months published", idioma)
              : tx("sem limite publicado", "no limit published", idioma);
      return {
        id: l.conjunto,
        conjunto: l.conjunto,
        nome: l.nome,
        sigla: l.sigla,
        meses: numeroOuNulo(l.meses),
        dec: numeroOuNulo(l.dec_h),
        dec_limite: numeroOuNulo(l.dec_limite_h),
        razao_dec: numeroOuNulo(l.razao_dec),
        fec: numeroOuNulo(l.fec_interrupcoes),
        fec_limite: numeroOuNulo(l.fec_limite_interrupcoes),
        razao_fec: numeroOuNulo(l.razao_fec),
        ucs: numeroOuNulo(l.ucs_media),
        situacao_dec: acima,
        situacao_fec: situacaoFecDoConjunto(
          {
            acima: l.acima_limite_fec ?? "",
            fec: numeroOuNulo(l.fec_interrupcoes),
            limite: numeroOuNulo(l.fec_limite_interrupcoes),
            razao: numeroOuNulo(l.razao_fec),
            mesesFec: numeroOuNulo(l.meses_fec),
          },
          idioma,
        ),
      };
    });
}

export function colunasConjuntos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const int = tx("interrupções", "interruptions", idioma);
  return [
    { id: "nome", rotulo: tx("Conjunto", "Consumer set", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "conjunto", rotulo: tx("Código", "Code", idioma), tipo: "texto" },
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", categorica: true, idiomaTexto: "nome" },
    { id: "situacao_dec", rotulo: tx("DEC diante do limite", "DEC against the limit", idioma), tipo: "texto", categorica: true },
    { id: "meses", rotulo: tx("Meses", "Months", idioma), tipo: "numero", casas: 0 },
    { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
    { id: "dec_limite", rotulo: tx("Limite de DEC", "DEC limit", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "razao_dec", rotulo: tx("DEC ÷ limite", "DEC ÷ limit", idioma), tipo: "numero", casas: 3 },
    { id: "fec", rotulo: "FEC", tipo: "numero", unidade: int, casas: 2 },
    { id: "fec_limite", rotulo: tx("Limite de FEC", "FEC limit", idioma), tipo: "numero", unidade: int, casas: 2 },
    { id: "razao_fec", rotulo: tx("FEC ÷ limite", "FEC ÷ limit", idioma), tipo: "numero", casas: 3 },
    { id: "situacao_fec", rotulo: tx("FEC diante do limite", "FEC against the limit", idioma), tipo: "texto", categorica: true },
    { id: "ucs", rotulo: tx("UCs (média do ano)", "UCs (annual average)", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_CONJUNTOS: ColunaTabela[] = colunasConjuntos("pt");

/** Arquivo anual por década que contém o ano (o pipeline publica 2000-2009, 2010-2019 e 2020-2029). */
export function arquivoConjuntosDoAno(ano: number): string {
  const d = Math.floor(ano / 10) * 10;
  return `/energia/series/qualidade_conjuntos_anual_${d}_${d + 9}.csv`;
}

/* ---------------------------------------------------------------- P053: compensações */

export const ORDEM_TIPOS: TipoCompensacao[] = ["mensal", "trimestral", "anual", "dicri", "dise"];
export function rotulosTipoCurto(idioma: Idioma = idiomaEnergia()): Record<TipoCompensacao, string> {
  return { mensal: tx("mensal", "monthly", idioma), trimestral: tx("trimestral", "quarterly", idioma), anual: tx("anual", "annual", idioma), dicri: "DICRI", dise: "DISE" };
}
export const ROTULO_TIPO_CURTO: Record<TipoCompensacao, string> = rotulosTipoCurto("pt");
/** Rótulo das barras por tipo: curto o bastante para caber no celular; a definição completa fica na tabela por tipo. */
function rotulosTipoBarra(idioma: Idioma): Record<TipoCompensacao, string> {
  return {
    mensal: tx("Mensal (DIC, FIC, DMIC)", "Monthly (DIC, FIC, DMIC)", idioma),
    trimestral: tx("Trimestral (DIC, FIC)", "Quarterly (DIC, FIC)", idioma),
    anual: tx("Anual (DIC, FIC)", "Annual (DIC, FIC)", idioma),
    dicri: tx("DICRI (dia crítico)", "DICRI (critical day)", idioma),
    dise: tx("DISE (emergência)", "DISE (emergency)", idioma),
  };
}

/** Rótulos completos dos tipos de violação (gold), no idioma da página; tipo sem tradução fica como a gold publica. */
export function rotulosTipoNoIdioma(rotulos: Record<TipoCompensacao, string>, idioma: Idioma = idiomaEnergia()): Record<TipoCompensacao, string> {
  if (idioma !== "en") return rotulos;
  return Object.fromEntries(Object.entries(rotulos).map(([k, v]) => [k, traducaoExata(v, ROTULOS_TIPO_COMPENSACAO_EN) ?? v])) as Record<TipoCompensacao, string>;
}

/** P053: total pago a unidades consumidoras no ano de referência, unidades geradoras à parte e concentração. */
export function respostaP053(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  if (!a || a.valor_uc === null)
    return tx(
      `Sem total de compensações para ${c.ano_referencia}: o ano não tem os 12 meses informados pelas distribuidoras.`,
      `No total of compensation payments for ${c.ano_referencia}: the year does not have the 12 months reported by the distribution utilities.`,
      idioma,
    );
  const ant = c.anual.find((x) => x.ano === c.ano_referencia - 1 && x.completo);
  let comp = "";
  if (ant && ant.valor_uc !== null) {
    const s = comparaNaPrecisao(a.valor_uc / 1e6, ant.valor_uc / 1e6, 1);
    comp = tx(
      s === "igual" ? `, o mesmo de ${ant.ano}` : `, ${s === "abaixo" ? "menos" : "mais"} que os ${reaisMilhoes(ant.valor_uc)} de ${ant.ano}`,
      s === "igual" ? `, the same as in ${ant.ano}` : `, ${s === "abaixo" ? "less" : "more"} than the ${reaisMilhoes(ant.valor_uc, 1, idioma)} of ${ant.ano}`,
      idioma,
    );
  }
  const qt =
    a.quantidade_uc !== null
      ? tx(` em ${num(a.quantidade_uc / 1e6, 1)} milhões de compensações`, ` in ${num(a.quantidade_uc / 1e6, 1, idioma)} million compensation payments`, idioma)
      : "";
  const ug =
    a.valor_ug !== null ? tx(` Unidades geradoras receberam ${reaisMilhoes(a.valor_ug, 2)} à parte.`, ` Generating units received ${reaisMilhoes(a.valor_ug, 2, idioma)} separately.`, idioma) : "";
  // a concentração é calculada sobre o valor de unidades consumidoras e geradoras somadas (o "valor" de cada distribuidora), não sobre o total só de UC
  const conc =
    c.concentracao_5_maiores_pct !== null
      ? tx(
          ` As cinco distribuidoras que mais pagaram somam ${pct(c.concentracao_5_maiores_pct, 1)} do total do ano de unidades consumidoras e geradoras somadas.`,
          ` The five distribution utilities that paid the most account for ${pct(c.concentracao_5_maiores_pct, 1, idioma)} of the year's total for consumer and generating units combined.`,
          idioma,
        )
      : "";
  return tx(
    `Em ${a.ano}, as distribuidoras informaram ${reaisMilhoes(a.valor_uc)} pagos a unidades consumidoras${qt}, por violação de limites individuais de continuidade (valores nominais da competência)${comp}.${ug}${conc}`,
    `In ${a.ano}, distribution utilities reported ${reaisMilhoes(a.valor_uc, 1, idioma)} paid to consumer units${qt}, for violation of individual continuity limits (nominal values of the accrual month)${comp}.${ug}${conc}`,
    idioma,
  );
}

/** Veredito do P053: o total pago a unidades consumidoras no ano de referência e a comparação ao ano anterior completo. */
export function vereditoP053(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  if (!a || a.valor_uc === null)
    return tx(
      `Sem total de compensações para ${c.ano_referencia}: o ano não tem os 12 meses informados pelas distribuidoras.`,
      `No total of compensation payments for ${c.ano_referencia}: the year does not have the 12 months reported by the distribution utilities.`,
      idioma,
    );
  const ant = c.anual.find((x) => x.ano === c.ano_referencia - 1 && x.completo);
  let comp = "";
  if (ant && ant.valor_uc !== null) {
    const s = comparaNaPrecisao(a.valor_uc / 1e6, ant.valor_uc / 1e6, 1);
    comp = tx(
      s === "igual" ? `, o mesmo de ${ant.ano}` : `, ${s === "abaixo" ? "menos" : "mais"} que os ${reaisMilhoes(ant.valor_uc)} de ${ant.ano}`,
      s === "igual" ? `, the same as in ${ant.ano}` : `, ${s === "abaixo" ? "less" : "more"} than the ${reaisMilhoes(ant.valor_uc, 1, idioma)} of ${ant.ano}`,
      idioma,
    );
  }
  return tx(
    `Em ${a.ano}, as distribuidoras pagaram ${reaisMilhoes(a.valor_uc)} a unidades consumidoras que tiveram limites individuais de continuidade violados${comp}.`,
    `In ${a.ano}, distribution utilities paid ${reaisMilhoes(a.valor_uc, 1, idioma)} to consumer units whose individual continuity limits were violated${comp}.`,
    idioma,
  );
}

/** P053, "o que mudou": maior ano da série (com a quebra de regime de 2022 dita junto) e o acumulado do ano corrente, marcado como parcial. */
export function mudancaP053(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = g.compensacoes;
  const completos = c.anual.filter((x) => x.completo && x.valor_uc !== null);
  if (!completos.length) return tx("Sem anos completos de compensação publicados.", "No complete years of compensation payments published.", idioma);
  const maior = completos.reduce((m, x) => ((x.valor_uc ?? -1) > (m.valor_uc ?? -1) ? x : m));
  const parcial = c.anual.find((x) => !x.completo);
  const p =
    parcial && c.ultimo_mes_completo
      ? tx(
          ` Em ${parcial.ano}, até ${mesAno(c.ultimo_mes_completo)}: ${reaisMilhoes(parcial.valor_uc)} a unidades consumidoras, soma parcial que não se compara a um ano cheio.`,
          ` In ${parcial.ano}, up to ${mesAno(c.ultimo_mes_completo, idioma)}: ${reaisMilhoes(parcial.valor_uc, 1, idioma)} to consumer units, a partial sum that is not comparable to a full year.`,
          idioma,
        )
      : "";
  const quebra = textoQuebraCompensacaoCurto(g, idioma);
  return tx(
    `Na série desde ${completos[0].ano}, o maior total pago a unidades consumidoras foi o de ${maior.ano} (${reaisMilhoes(maior.valor_uc)}), em reais de cada ano, sem correção pela inflação.${quebra ? ` ${quebra}` : ""}${p}`,
    `In the series since ${completos[0].ano}, the highest total paid to consumer units was that of ${maior.ano} (${reaisMilhoes(maior.valor_uc, 1, idioma)}), in reais of each year, not adjusted for inflation.${quebra ? ` ${quebra}` : ""}${p}`,
    idioma,
  );
}

/**
 * Anos de compensação (gráfico, tabela e exportação): unidades consumidoras e geradoras separadas. A situação diz também o regime da fonte
 * (com ou sem os tipos que deixam de ser publicados), para a linha de antes e a de depois da quebra não passarem por comparáveis.
 */
export function linhasCompensacaoAnual(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const q = quebraCompensacao(g);
  const regime = (ano: number) =>
    q ? tx(`, ${ano < q.ano ? "com" : "sem"} as compensações ${tiposQueSomem(q, idioma)}`, `, ${ano < q.ano ? "with" : "without"} the ${tiposQueSomem(q, idioma)} compensation payments`, idioma) : "";
  const ultimo = g.compensacoes.ultimo_mes_completo ? mesAno(g.compensacoes.ultimo_mes_completo, idioma) : tx("mês não informado", "month not reported", idioma);
  return g.compensacoes.anual.map((a) => ({
    ano: String(a.ano),
    situacao: (a.completo ? tx("ano completo", "complete year", idioma) : tx(`parcial até ${ultimo}`, `partial up to ${ultimo}`, idioma)) + regime(a.ano),
    valor_uc_mi: a.completo && a.valor_uc !== null ? a.valor_uc / 1e6 : null,
    valor_uc: a.valor_uc,
    quantidade_uc: a.quantidade_uc,
    valor_ug: a.valor_ug,
    quantidade_ug: a.quantidade_ug,
    valor_por_uc: a.valor_por_uc,
  }));
}

export function colunasCompAnual(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto" }, // i18n: dado
    { id: "situacao", rotulo: tx("Situação", "Status", idioma), tipo: "texto", categorica: true },
    { id: "valor_uc", rotulo: tx("Valor a unidades consumidoras", "Amount to consumer units", idioma), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "quantidade_uc", rotulo: tx("Compensações a unidades consumidoras", "Compensation payments to consumer units", idioma), tipo: "numero", casas: 0 },
    { id: "valor_ug", rotulo: tx("Valor a unidades geradoras", "Amount to generating units", idioma), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "quantidade_ug", rotulo: tx("Compensações a unidades geradoras", "Compensation payments to generating units", idioma), tipo: "numero", casas: 0 },
    { id: "valor_por_uc", rotulo: tx("Valor (UC e UG) ÷ UCs (normalização)", "Amount (UC and UG) ÷ UCs (normalization)", idioma), tipo: "numero", unidade: tx("R$ por UC", "R$ per UC", idioma), casas: 2 },
  ];
}
export const COLUNAS_COMP_ANUAL: ColunaTabela[] = colunasCompAnual("pt");

/** Meses de compensação: mês ainda incompleto fica fora do gráfico (o valor publicado segue na tabela, marcado). */
export function linhasCompensacaoMensal(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return g.compensacoes.mensal.map((m) => ({
    m: m.m,
    valor_mi: m.completo && m.valor !== null ? m.valor / 1e6 : null,
    quantidade_mil: m.completo && m.quantidade !== null ? m.quantidade / 1e3 : null,
    valor_publicado: m.valor,
    quantidade_publicada: m.quantidade,
    situacao: m.completo ? tx("completo", "complete", idioma) : tx("incompleto (nem todas as distribuidoras informaram)", "incomplete (not all distribution utilities reported)", idioma),
  }));
}

/**
 * Valor pago a unidades consumidoras por tipo de violação em cada ano. Só UC, o universo do
 * total que a ANEEL divulga: desde 2022 os tipos trimestral e anual de UC não são publicados e
 * os de unidades geradoras vêm com zero, então a soma UC + UG mostraria zero onde há ausência.
 * Tipo sem linha de UC no ano é ausência, nunca zero.
 */
export function linhasCompensacaoTipo(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return g.compensacoes.anual.map((a) => {
    const l: LinhaTabela = { ano: String(a.ano), situacao: a.completo ? tx("ano completo", "complete year", idioma) : tx("parcial", "partial", idioma) };
    for (const t of ORDEM_TIPOS) l[t] = a.por_tipo[t]?.valor_uc ?? null;
    l.valor_ug = a.valor_ug;
    return l;
  });
}

/**
 * Composição do ano de referência por tipo (barras), só unidades consumidoras. Entram os tipos
 * com alguma linha no ano; o que só tem linha de unidade geradora fica como barra ausente
 * (hachura), não como zero.
 */
export function linhasTipoAnoReferencia(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const a = g.compensacoes.anual.find((x) => x.ano === g.compensacoes.ano_referencia);
  if (!a) return [];
  const barra = rotulosTipoBarra(idioma);
  return ORDEM_TIPOS.filter((t) => a.por_tipo[t] !== undefined).map((t) => {
    const p = a.por_tipo[t]!;
    return {
      id: t,
      tipo: barra[t],
      valor_mi: p.valor_uc === null ? null : p.valor_uc / 1e6,
      quantidade: p.quantidade_uc,
    };
  });
}

/** Trechos contínuos de anos: [2011, 2012, 2013, 2016] vira [[2011, 2013], [2016, 2016]]. */
function trechosDeAnos(anos: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const a of [...anos].sort((x, y) => x - y)) {
    const u = out[out.length - 1];
    if (u && a === u[1] + 1) u[1] = a;
    else out.push([a, a]);
  }
  return out;
}

/**
 * Em que anos cada tipo tem valor publicado para unidades consumidoras, dito a partir da
 * própria série (nenhum ano escrito à mão): "trimestral de 2011 a 2021; DISE desde 2026".
 */
export function notaTiposCompensacao(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const anos = g.compensacoes.anual.map((a) => a.ano);
  if (!anos.length) return tx("Sem série de compensações por tipo.", "No series of compensation payments by type.", idioma);
  const ultimo = Math.max(...anos);
  const curto = rotulosTipoCurto(idioma);
  const partes = ORDEM_TIPOS.map((t) => {
    const com = g.compensacoes.anual.filter((a) => a.por_tipo[t]?.valor_uc !== null && a.por_tipo[t]?.valor_uc !== undefined).map((a) => a.ano);
    if (!com.length) return tx(`${curto[t]}: nenhum ano`, `${curto[t]}: no year`, idioma);
    const txt = trechosDeAnos(com).map(([i, f]) =>
      f === ultimo && i !== f ? tx(`desde ${i}`, `since ${i}`, idioma) : i === f ? String(i) : tx(`de ${i} a ${f}`, `from ${i} to ${f}`, idioma),
    );
    return `${curto[t]} ${listaPt(txt, idioma)}`;
  });
  const causa = textoQuebraCompensacaoCurto(g, idioma);
  return tx(
    `Valores pagos a unidades consumidoras. Tipo sem valor publicado no ano é ausência, não zero. Anos com valor por tipo: ${partes.join("; ")}.${causa ? ` ${causa}` : ""} Unidades geradoras na última coluna, somadas.`,
    `Amounts paid to consumer units. A type with no published value in the year is absence, not zero. Years with a value by type: ${partes.join("; ")}.${causa ? ` ${causa}` : ""} Generating units in the last column, summed.`,
    idioma,
  );
}

/**
 * Tipos com linha no ano de referência mas sem valor para unidades consumidoras, em uma frase:
 * diz se a fonte trouxe o tipo só para unidades geradoras e com que valor (lido da gold). Vazio
 * quando todos os tipos do ano têm valor de UC.
 */
export function notaTiposSemUc(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const ano = g.compensacoes.ano_referencia;
  const a = g.compensacoes.anual.find((x) => x.ano === ano);
  if (!a) return "";
  const sem = ORDEM_TIPOS.filter((t) => a.por_tipo[t] !== undefined && a.por_tipo[t]!.valor_uc === null);
  if (!sem.length) return "";
  const curto = rotulosTipoCurto(idioma);
  const nomes = listaPt(sem.map((t) => curto[t]), idioma);
  const ug = sem.map((t) => a.por_tipo[t]!.valor_ug);
  const valores = listaPt(sem.map((t, i) => `${curto[t]}: ${reaisMilhoes(ug[i], 2, idioma)}`), idioma);
  const origem = ug.every((v) => v === 0)
    ? tx("a fonte traz esses tipos só para unidades geradoras, com valor zero", "the source reports these types only for generating units, with a value of zero", idioma)
    : ug.every((v) => v !== null)
      ? tx(`a fonte traz esses tipos só para unidades geradoras (${valores})`, `the source reports these types only for generating units (${valores})`, idioma)
      : tx("a fonte não traz valor de unidade consumidora para esses tipos", "the source reports no consumer unit value for these types", idioma);
  return tx(
    `${ano}: ${nomes} sem valor publicado para unidades consumidoras; a barra hachurada é ausência, não zero (${origem}).`,
    `${ano}: ${nomes} with no published value for consumer units; the hatched bar is absence, not zero (${origem}).`,
    idioma,
  );
}

/** Compensações por distribuidora no ano de referência (valor total, por tipo e normalizado por UC). */
export function linhasCompensacaoDistribuidoras(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return g.distribuidoras
    .filter((d) => d.compensacao)
    .map((d) => {
      const c = d.compensacao!;
      const l: LinhaTabela = {
        id: d.cnpj,
        sigla: rotuloDistribuidora(d),
        classificacao: classificacaoNoIdioma(d.classificacao, idioma),
        valor: c.valor,
        quantidade: c.quantidade,
        valor_por_uc: c.valor_por_uc,
        ucs: d.ucs,
      };
      // por tipo, só unidades consumidoras (o "valor no ano" soma UC e UG)
      for (const t of ORDEM_TIPOS) l[t] = c.valor_uc_por_tipo[t] ?? null;
      return l;
    });
}

export function colunasCompensacaoDistribuidoras(rotulos: Record<TipoCompensacao, string>, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const r = rotulosTipoNoIdioma(rotulos, idioma);
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "classificacao", rotulo: tx("Classificação", "Classification", idioma), tipo: "texto", categorica: true },
    { id: "valor", rotulo: tx("Valor no ano (UC e UG)", "Amount in the year (UC and UG)", idioma), tipo: "numero", unidade: "R$", casas: 2 }, // i18n: dado
    { id: "quantidade", rotulo: tx("Compensações no ano (UC e UG)", "Compensation payments in the year (UC and UG)", idioma), tipo: "numero", casas: 0 },
    { id: "valor_por_uc", rotulo: tx("Valor (UC e UG) ÷ UCs (normalização)", "Amount (UC and UG) ÷ UCs (normalization)", idioma), tipo: "numero", unidade: tx("R$ por UC", "R$ per UC", idioma), casas: 2 },
    { id: "ucs", rotulo: tx("UCs (média do ano)", "UCs (annual average)", idioma), tipo: "numero", casas: 0 },
    ...ORDEM_TIPOS.map((t) => ({ id: t, rotulo: tx(`${r[t]}, só UC`, `${r[t]}, UC only`, idioma), tipo: "numero" as const, unidade: "R$", casas: 2 })),
  ];
}

/* ---------------------------------------------------------------- P054: atendimento e resiliência */

/** P054: reclamações por exposição, Ouvidoria, IASC com a amostra e tempo de atendimento emergencial. */
/**
 * Motivo de ausência de taxa de reclamações, como o pipeline o escreve; em inglês, a forma conhecida ("ano parcial: nenhuma das N
 * distribuidoras com manifestações em AAAA tem os 12 meses enviados; ...") é reescrita com os mesmos números, e outra forma fica
 * como está (o componente marca o trecho só em português quando pode).
 */
export function motivoAusenciaNoIdioma(motivo: string | null | undefined, idioma: Idioma = idiomaEnergia()): string | null {
  if (!motivo) return motivo ?? null;
  if (idioma !== "en") return motivo;
  const m = /^ano parcial: nenhuma das (\d+) distribuidoras com manifestações em (\d{4}) tem os 12 meses enviados; soma de meses parciais não é publicada como total do ano$/.exec(motivo);
  if (m) return tx(motivo, `partial year: none of the ${m[1]} distribution utilities with complaints in ${m[2]} has sent the 12 months; a sum of partial months is not published as the annual total`, idioma);
  return motivo;
}

export function respostaP054(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const ref = g.ano_referencia;
  const at = g.atendimento;
  const rec = at.reclamacoes_distribuidora.find((x) => x.ano === ref);
  const ouv = at.ouvidoria_aneel.find((x) => x.ano === ref);
  const tmae = at.tmae.find((x) => x.ano === ref && x.completo);
  const partes: string[] = [];
  if (rec && rec.por_ucs !== null) {
    partes.push(
      tx(
        `Em ${ref}, as distribuidoras registraram ${num(rec.por_ucs, 1)} reclamações por mil unidades consumidoras` +
          (rec.interrupcao_por_mil_uc !== null ? `, ${num(rec.interrupcao_por_mil_uc, 1)} delas sobre interrupção` : "") +
          ` (${rec.distribuidoras} distribuidoras com os 12 meses enviados, ${pctCobertura(rec.cobertura_ucs)} das UCs).`,
        `In ${ref}, distribution utilities recorded ${num(rec.por_ucs, 1, idioma)} complaints per thousand consumer units` +
          (rec.interrupcao_por_mil_uc !== null ? `, ${num(rec.interrupcao_por_mil_uc, 1, idioma)} of them about interruptions` : "") +
          ` (${rec.distribuidoras} distribution utilities with the 12 months sent, ${pctCobertura(rec.cobertura_ucs, idioma)} of the UCs).`,
        idioma,
      ),
    );
  } else if (rec)
    partes.push(
      tx(
        `Reclamações nas distribuidoras em ${ref}: sem taxa (${rec.motivo_ausencia ?? "universo vazio"}).`,
        `Complaints at the distribution utilities in ${ref}: no rate (${motivoAusenciaNoIdioma(rec.motivo_ausencia, idioma) ?? "empty universe"}).`,
        idioma,
      ),
    );
  if (ouv && ouv.por_ucs !== null)
    partes.push(
      tx(
        `Na Ouvidoria Setorial da ANEEL, segunda instância, foram ${num(ouv.por_ucs, 1)} reclamações por 100 mil unidades consumidoras.`,
        `At the ANEEL Sector Ombudsman (Ouvidoria Setorial), the second level, there were ${num(ouv.por_ucs, 1, idioma)} complaints per 100 thousand consumer units.`,
        idioma,
      ),
    );
  if (at.iasc.ano !== null && at.iasc.quantis.p50 !== null) {
    partes.push(
      tx(
        `Na pesquisa IASC de ${at.iasc.ano}, com ${num(at.iasc.entrevistas, 0)} entrevistas em ${at.iasc.distribuidoras} distribuidoras, o índice mediano foi ${num(at.iasc.quantis.p50, 1)} de 100.`,
        `In the ${at.iasc.ano} IASC survey, with ${num(at.iasc.entrevistas, 0, idioma)} interviews at ${at.iasc.distribuidoras} distribution utilities, the median index was ${num(at.iasc.quantis.p50, 1, idioma)} on a 100-point scale.`,
        idioma,
      ),
    );
  }
  if (tmae && tmae.tmae_min !== null)
    partes.push(
      tx(
        `O atendimento a uma ocorrência emergencial levou em média ${num(tmae.tmae_min, 0)} minutos (${horasEMinutos(tmae.tmae_min / 60)}) da reclamação ao restabelecimento.`,
        `Responding to an emergency occurrence took ${num(tmae.tmae_min, 0, idioma)} minutes on average (${horasEMinutos(tmae.tmae_min / 60, idioma)}) from the complaint to restoration.`,
        idioma,
      ),
    );
  return partes.join(" ") || tx("Sem indicadores de atendimento publicados para o ano de referência.", "No customer service indicators published for the reference year.", idioma);
}

/** Veredito do P054: reclamações por mil unidades consumidoras nas distribuidoras e quantas foram sobre interrupção. */
export function vereditoP054(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const ref = g.ano_referencia;
  const rec = g.atendimento.reclamacoes_distribuidora.find((x) => x.ano === ref);
  if (!rec || rec.por_ucs === null)
    return rec
      ? tx(
          `Reclamações nas distribuidoras em ${ref}: sem taxa (${rec.motivo_ausencia ?? "universo vazio"}).`,
          `Complaints at the distribution utilities in ${ref}: no rate (${motivoAusenciaNoIdioma(rec.motivo_ausencia, idioma) ?? "empty universe"}).`,
          idioma,
        )
      : tx("Sem indicadores de atendimento publicados para o ano de referência.", "No customer service indicators published for the reference year.", idioma);
  const interrupcao =
    rec.interrupcao_por_mil_uc !== null
      ? tx(`, ${num(rec.interrupcao_por_mil_uc, 1)} delas sobre interrupção`, `, ${num(rec.interrupcao_por_mil_uc, 1, idioma)} of them about interruptions`, idioma)
      : "";
  return tx(
    `Em ${ref}, as distribuidoras registraram ${num(rec.por_ucs, 1)} reclamações por mil unidades consumidoras${interrupcao}.`,
    `In ${ref}, distribution utilities recorded ${num(rec.por_ucs, 1, idioma)} complaints per thousand consumer units${interrupcao}.`,
    idioma,
  );
}

/** P054, "o que mudou": evolução das taxas (anos completos) e o ano corrente sem taxa. */
export function mudancaP054(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const at = g.atendimento;
  const anos = at.reclamacoes_distribuidora.filter((x) => x.por_ucs !== null);
  const partes: string[] = [];
  if (anos.length >= 2) {
    const a = anos[0];
    const b = anos[anos.length - 1];
    const s = comparaNaPrecisao(b.por_ucs!, a.por_ucs!, 1);
    partes.push(
      tx(
        `Reclamações por mil UCs nas distribuidoras: ${num(a.por_ucs, 1)} em ${a.ano} e ${num(b.por_ucs, 1)} em ${b.ano} (${s === "igual" ? "estável" : s === "abaixo" ? "queda" : "alta"}).`,
        `Complaints per thousand UCs at the distribution utilities: ${num(a.por_ucs, 1, idioma)} in ${a.ano} and ${num(b.por_ucs, 1, idioma)} in ${b.ano} (${s === "igual" ? "stable" : s === "abaixo" ? "down" : "up"}).`,
        idioma,
      ),
    );
  }
  const semTaxa = at.reclamacoes_distribuidora.find((x) => x.por_ucs === null && x.motivo_ausencia);
  if (semTaxa) partes.push(tx(`${semTaxa.ano}: sem taxa, ${semTaxa.motivo_ausencia}.`, `${semTaxa.ano}: no rate, ${motivoAusenciaNoIdioma(semTaxa.motivo_ausencia, idioma)}.`, idioma));
  // anos cheios se comparam entre si; o ano corrente aparece à parte, com o número de meses
  const tm = at.tmae.filter((x) => x.tmae_min !== null && x.completo);
  const tmParcial = at.tmae.find((x) => x.tmae_min !== null && !x.completo);
  if (tm.length >= 2) {
    const a = tm[0];
    const b = tm[tm.length - 1];
    partes.push(
      tx(
        `Tempo médio de atendimento emergencial: ${num(a.tmae_min, 0)} min em ${a.ano} e ${num(b.tmae_min, 0)} min em ${b.ano}` +
          (tmParcial ? `; ${tmParcial.ano} tem só ${tmParcial.meses} meses (${num(tmParcial.tmae_min, 0)} min), sem comparação com ano cheio.` : "."),
        `Average emergency response time: ${num(a.tmae_min, 0, idioma)} min in ${a.ano} and ${num(b.tmae_min, 0, idioma)} min in ${b.ano}` +
          (tmParcial ? `; ${tmParcial.ano} has only ${tmParcial.meses} months (${num(tmParcial.tmae_min, 0, idioma)} min), not compared with a full year.` : "."),
        idioma,
      ),
    );
  }
  return partes.join(" ") || tx("Sem série de atendimento com mais de um ano.", "No customer service series with more than one year.", idioma);
}

/** Indicadores nacionais de atendimento, cada um com o seu escopo e a sua unidade (nunca somados entre si). */
export function linhasEscopos(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const at = g.atendimento;
  const out: LinhaTabela[] = [];
  const porMil = tx("por mil UCs", "per thousand UCs", idioma);
  const anoParcial = tx("ano parcial", "partial year", idioma);
  for (const r of at.reclamacoes_distribuidora) {
    out.push({
      id: `rec-${r.ano}`,
      indicador: tx("Reclamações na distribuidora (1º nível)", "Complaints at the distribution utility (1st level)", idioma),
      escopo: tx("todas as reclamações registradas pelas distribuidoras com os 12 meses enviados", "all complaints recorded by the distribution utilities that sent the 12 months", idioma),
      ano: String(r.ano),
      valor: r.por_ucs,
      unidade: porMil,
      base: r.total,
      motivo: motivoAusenciaNoIdioma(r.motivo_ausencia, idioma) ?? (r.completo ? "" : anoParcial),
    });
    out.push({
      id: `rec-int-${r.ano}`,
      indicador: tx("Reclamações de interrupção (1º nível)", "Interruption complaints (1st level)", idioma),
      escopo: tx("tipologia de interrupção do fornecimento (REN 1.000/2021)", "supply interruption category (REN 1.000/2021)", idioma),
      ano: String(r.ano),
      valor: r.interrupcao_por_mil_uc,
      unidade: porMil,
      base: r.interrupcao,
      motivo: motivoAusenciaNoIdioma(r.motivo_ausencia, idioma) ?? (r.completo ? "" : anoParcial),
    });
  }
  for (const o of at.ouvidoria_aneel) {
    const meses = o.meses_max !== null ? tx(`até ${o.meses_max} meses`, `up to ${o.meses_max} months`, idioma) : tx("meses não informados", "months not reported", idioma);
    out.push({
      id: `ouv-${o.ano}`,
      indicador: tx("Reclamações na Ouvidoria Setorial da ANEEL", "Complaints at the ANEEL Sector Ombudsman", idioma),
      escopo: tx("segunda instância: depois do atendimento na distribuidora", "second level: after the distribution utility's own service", idioma),
      ano: String(o.ano),
      valor: o.por_ucs,
      unidade: tx("por 100 mil UCs", "per 100 thousand UCs", idioma),
      base: o.total,
      motivo: motivoAusenciaNoIdioma(o.motivo_ausencia, idioma) ?? (o.completo ? "" : tx(`ano parcial (${meses}): sem taxa anual`, `partial year (${meses}): no annual rate`, idioma)),
    });
  }
  for (const t of at.tmae) {
    const periodo = t.periodo ? tx(` (${mesAno(t.periodo.inicio)} a ${mesAno(t.periodo.fim)})`, ` (${mesAno(t.periodo.inicio, idioma)} to ${mesAno(t.periodo.fim, idioma)})`, idioma) : "";
    out.push({
      id: `tmae-${t.ano}`,
      indicador: tx("Tempo médio de atendimento emergencial (TMAE)", "Average emergency response time (TMAE)", idioma),
      escopo: tx(
        "ocorrências emergenciais com os três tempos informados (preparação, deslocamento e execução)",
        "emergency occurrences with the three times reported (preparation, travel and execution)",
        idioma,
      ),
      ano: String(t.ano),
      valor: t.tmae_min,
      unidade: tx("minutos", "minutes", idioma),
      base: t.ocorrencias,
      motivo: t.completo ? "" : tx(`parcial: ${t.meses} meses${periodo}`, `partial: ${t.meses} months${periodo}`, idioma),
    });
  }
  return out;
}

export function colunasEscopos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "indicador", rotulo: tx("Indicador", "Indicator", idioma), tipo: "texto", categorica: true },
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto", categorica: true }, // i18n: dado
    { id: "valor", rotulo: tx("Valor", "Value", idioma), tipo: "numero", casas: 1 }, // i18n: dado
    { id: "unidade", rotulo: tx("Unidade", "Unit", idioma), tipo: "texto" },
    { id: "base", rotulo: tx("Contagem na base", "Count in the database", idioma), tipo: "numero", casas: 0 },
    { id: "escopo", rotulo: tx("Escopo", "Scope", idioma), tipo: "texto" },
    { id: "motivo", rotulo: tx("Ausência ou parcial", "Absent or partial", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_ESCOPOS: ColunaTabela[] = colunasEscopos("pt");

/** Taxas nacionais de reclamação por ano para as barras (ano parcial fica sem barra: taxa ausente, com motivo). */
export function linhasReclamacoesNacional(g: QualidadeGold): LinhaTabela[] {
  return g.atendimento.reclamacoes_distribuidora.map((r) => ({
    ano: String(r.ano),
    total: r.por_ucs,
    interrupcao: r.interrupcao_por_mil_uc,
    n2: r.n2_por_mil_uc,
  }));
}

export function linhasOuvidoriaNacional(g: QualidadeGold): LinhaTabela[] {
  return g.atendimento.ouvidoria_aneel.map((o) => ({ ano: String(o.ano), total: o.por_ucs, procedentes: o.procedentes_por_100mil_uc }));
}

/** Atendimento telefônico: % dos distribuidora-meses dentro de cada padrão (INS e IAb não se agregam). */
export function linhasTelefonico(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return g.atendimento.telefonico.anual.map((t) => ({
    ano: String(t.ano),
    ins: t.pct_meses_ins_ok,
    iab: t.pct_meses_iab_ok,
    ico: t.pct_meses_ico_ok,
    meses: t.meses,
    distribuidoras: t.distribuidoras,
    ico_nacional: t.ico_pct,
    situacao: t.completo ? tx("ano completo", "complete year", idioma) : tx(`parcial, ${t.meses} meses`, `partial, ${t.meses} months`, idioma),
  }));
}

/** Parcelas de emergência e dia crítico (resiliência) por ano, 2010 em diante. */
export function linhasResiliencia(g: QualidadeGold): LinhaTabela[] {
  return g.atendimento.resiliencia_parcelas
    .filter((r) => r.dec_emergencia !== null || r.dec_dia_critico !== null)
    .map((r) => ({ ano: String(r.ano), emergencia: r.dec_emergencia, dia_critico: r.dec_dia_critico, apurado: r.dec_apurado, todas: r.dec_todas_parcelas }));
}

/** Eventos em situação de emergência com maior CHI (consumidores × horas interrompidas). */
export function linhasEventos(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return g.atendimento.eventos_emergencia.maiores_chi.map((e) => ({
    id: `${e.cnpj ?? ""}|${e.codigo}|${e.competencia}`,
    sigla: e.sigla ?? (e.cnpj ? `CNPJ ${e.cnpj}` : tx("sem distribuidora identificada", "no distribution utility identified", idioma)),
    codigo: e.codigo,
    competencia: e.competencia,
    inicio: e.inicio,
    fim: e.fim,
    duracao_h: e.duracao_h,
    chi_evento: e.chi_evento,
    chi_limite: e.chi_limite,
    razao_chi: e.razao_chi,
    origem: idioma === "en" && e.origem ? (ORIGEM_EVENTO_EN[e.origem] ?? e.origem) : e.origem,
  }));
}

export function colunasEventos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const chi = tx("consumidor × hora", "consumer × hour", idioma);
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", categorica: true, idiomaTexto: "nome" },
    { id: "codigo", rotulo: tx("Código do evento", "Event code", idioma), tipo: "texto" },
    { id: "competencia", rotulo: tx("Competência", "Accrual month", idioma), tipo: "texto" },
    { id: "inicio", rotulo: tx("Início", "Start", idioma), tipo: "texto" },
    { id: "fim", rotulo: tx("Fim", "End", idioma), tipo: "texto" },
    { id: "duracao_h", rotulo: tx("Duração", "Duration", idioma), tipo: "numero", unidade: "h", casas: 1 },
    { id: "chi_evento", rotulo: tx("CHI do evento", "Event CHI", idioma), tipo: "numero", unidade: chi, casas: 0 },
    { id: "chi_limite", rotulo: tx("CHI limite", "CHI limit", idioma), tipo: "numero", unidade: chi, casas: 0 },
    { id: "razao_chi", rotulo: tx("CHI ÷ limite", "CHI ÷ limit", idioma), tipo: "numero", casas: 2 },
    { id: "origem", rotulo: tx("Origem declarada", "Declared origin", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_EVENTOS: ColunaTabela[] = colunasEventos("pt");

/** Atendimento por distribuidora (ano de referência), cada medida com a sua exposição. */
export function linhasAtendimentoDistribuidoras(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const categoria = (c: string | null | undefined) => (c ? (idioma === "en" ? (CATEGORIA_IASC_EN[c] ?? c) : c) : tx("fora da pesquisa no ano", "not in the survey that year", idioma));
  return g.distribuidoras.map((d) => ({
    id: d.cnpj,
    sigla: rotuloDistribuidora(d),
    classificacao: classificacaoNoIdioma(d.classificacao, idioma),
    ucs: d.ucs,
    iasc: d.iasc?.valor ?? null,
    iasc_amostra: d.iasc?.amostra ?? null,
    iasc_categoria: categoria(d.iasc?.categoria),
    rec_mil: d.reclamacoes?.n1_por_mil_uc ?? null,
    rec_int_mil: d.reclamacoes?.interrupcao_n1_por_mil_uc ?? null,
    rec_n2_mil: d.reclamacoes?.n2_por_mil_uc ?? null,
    ouv_100mil: d.reclamacoes?.ouvidoria_aneel_por_100mil_uc ?? null,
    tmae: d.tmae_min,
    tel_ins_min: d.telefonico?.ins_min_pct ?? null,
    tel_meses_ins: d.telefonico ? tx(`${d.telefonico.meses_ins_ok} de ${d.telefonico.meses}`, `${d.telefonico.meses_ins_ok} of ${d.telefonico.meses}`, idioma) : tx("não obrigada", "not required", idioma),
    tel_oferecidas_mil: d.telefonico?.oferecidas_por_mil_uc ?? null,
    eventos_2026: d.eventos_emergencia_2026,
  }));
}

function colunasAtendimentoBase(idioma: Idioma): ColunaTabela[] {
  const porMil = tx("por mil UCs", "per thousand UCs", idioma);
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "classificacao", rotulo: tx("Classificação", "Classification", idioma), tipo: "texto", categorica: true },
    { id: "ucs", rotulo: tx("UCs (média do ano)", "UCs (annual average)", idioma), tipo: "numero", casas: 0 },
    { id: "iasc", rotulo: "IASC", tipo: "numero", unidade: tx("0 a 100", "0 to 100", idioma), casas: 2 },
    { id: "iasc_amostra", rotulo: tx("Entrevistas do IASC", "IASC interviews", idioma), tipo: "numero", casas: 0 },
    { id: "iasc_categoria", rotulo: tx("Categoria do IASC", "IASC category", idioma), tipo: "texto", categorica: true },
    { id: "rec_mil", rotulo: tx("Reclamações na distribuidora", "Complaints at the distribution utility", idioma), tipo: "numero", unidade: porMil, casas: 1 },
    { id: "rec_int_mil", rotulo: tx("Reclamações de interrupção", "Interruption complaints", idioma), tipo: "numero", unidade: porMil, casas: 1 },
    { id: "rec_n2_mil", rotulo: tx("Reclamações no 2º nível", "Complaints at the 2nd level", idioma), tipo: "numero", unidade: porMil, casas: 2 },
    { id: "ouv_100mil", rotulo: tx("Ouvidoria da ANEEL", "ANEEL Ombudsman", idioma), tipo: "numero", unidade: tx("por 100 mil UCs", "per 100 thousand UCs", idioma), casas: 1 },
    { id: "tmae", rotulo: "TMAE", tipo: "numero", unidade: "min", casas: 0 }, // i18n: dado
    { id: "tel_ins_min", rotulo: tx("Pior INS mensal", "Lowest monthly INS", idioma), tipo: "percentual", casas: 1 },
    { id: "tel_meses_ins", rotulo: tx("Meses com INS no padrão", "Months with INS within the standard", idioma), tipo: "texto" },
    { id: "tel_oferecidas_mil", rotulo: tx("Chamadas oferecidas", "Calls offered", idioma), tipo: "numero", unidade: porMil, casas: 0 },
    { id: "eventos_2026", rotulo: tx("Eventos de emergência declarados", "Declared emergency events", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_ATENDIMENTO: ColunaTabela[] = colunasAtendimentoBase("pt");

/**
 * Colunas da tabela de atendimento por distribuidora: o rótulo da contagem de eventos diz o
 * período da base publicada (datas da gold), não um ano escrito à mão.
 */
export function colunasAtendimento(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const e = g.atendimento.eventos_emergencia;
  const periodo =
    e.inicio_min && e.inicio_max
      ? tx(
          `, início de ${dataBR(e.inicio_min.slice(0, 10))} a ${dataBR(e.inicio_max.slice(0, 10))}`,
          `, start from ${dataBR(e.inicio_min.slice(0, 10), idioma)} to ${dataBR(e.inicio_max.slice(0, 10), idioma)}`,
          idioma,
        )
      : "";
  return colunasAtendimentoBase(idioma).map((c) => (c.id === "eventos_2026" ? { ...c, rotulo: tx(`Eventos de emergência declarados${periodo}`, `Declared emergency events${periodo}`, idioma) } : c));
}

/* ---------------------------------------------------------------- carga sob demanda no navegador */

const cache = new Map<string, Promise<unknown>>();

/**
 * Busca um arquivo publicado uma única vez por visita (todas as instâncias da página
 * compartilham a mesma promessa). Falha não fica em cache: a próxima tentativa refaz.
 */
export function carregarUmaVez<T>(url: string, ler: (r: Response) => Promise<T>): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} ao buscar ${url}`);
      return ler(r);
    });
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

/* ---------------------------------------------------------------- tabelas abertas sob demanda */

/**
 * Tabelas de análise e auditoria que a página não manda prontas no HTML (contrato,
 * seção 5.1: o peso da página). Cada uma é montada no navegador, quando a pessoa a abre,
 * a partir da própria gold publicada (/energia/gold/qualidade.json) e destas mesmas
 * funções: o que a tabela mostra e exporta é o que o teste confere contra os CSV.
 */
export const TABELAS_SOB_DEMANDA = [
  "dist-p051",
  "limites",
  "mensal",
  "identidade",
  "matriz",
  "cauda-razao",
  "cauda-dec",
  "dgc",
  "comp-anual",
  "comp-tipo",
  "comp-dist",
  "divulgado",
  "escopos",
  "eventos",
  "atendimento",
  "validacao",
  "arquivos",
] as const;
export type IdTabela = (typeof TABELAS_SOB_DEMANDA)[number];

export type DefinicaoTabela = {
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  colunaRotulo?: string;
  fonte: string;
  versao: string;
  nomeArquivo: string;
  ordemInicial?: { coluna: string; direcao: "asc" | "desc" };
  dicaBusca?: string;
  nota?: string;
};

export function fonteContinuidade(idioma: Idioma = idiomaEnergia()): string {
  return tx("ANEEL, Indicadores Coletivos de Continuidade (DEC e FEC)", "ANEEL, Collective Continuity Indicators (DEC and FEC)", idioma);
}
export const FONTE_CONTINUIDADE = fonteContinuidade("pt");

function colunasMensal(idioma: Idioma): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "texto" },
    { id: "situacao", rotulo: tx("Situação", "Status", idioma), tipo: "texto", categorica: true },
    { id: "dec_publicado", rotulo: tx("DEC publicado", "Published DEC", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "fec_publicado", rotulo: tx("FEC publicado", "Published FEC", idioma), tipo: "numero", unidade: tx("interrupções", "interruptions", idioma), casas: 2 },
    { id: "ucs", rotulo: tx("UCs com DEC", "UCs with DEC", idioma), tipo: "numero", casas: 0 },
    { id: "conjuntos", rotulo: tx("Conjuntos", "Consumer sets", idioma), tipo: "numero", casas: 0 },
  ];
}

function colunasIdentidade(idioma: Idioma): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto" }, // i18n: dado
    { id: "conjunto_meses", rotulo: tx("Conjunto-meses", "Cluster-months", idioma), tipo: "numero", casas: 0 },
    { id: "pct_dec", rotulo: "DEC = IP + IND", tipo: "percentual", casas: 2 },
    { id: "pct_fec", rotulo: "FEC = IP + IND", tipo: "percentual", casas: 2 },
  ];
}

function colunasDgc(idioma: Idioma): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto" }, // i18n: dado
    { id: "comparados", rotulo: tx("Distribuidoras comparadas", "Distribution utilities compared", idioma), tipo: "numero", casas: 0 },
    { id: "ate_1_centesimo", rotulo: tx("Até 0,01 de diferença", "Up to 0.01 difference", idioma), tipo: "numero", casas: 0 },
    { id: "exatos", rotulo: tx("Iguais em duas casas", "Equal to two decimals", idioma), tipo: "numero", casas: 0 },
    { id: "maior", rotulo: tx("Maior diferença", "Largest difference", idioma), tipo: "numero", casas: 3 }, // i18n: dado
    { id: "divergentes", rotulo: tx("Divergentes (publicado × calculado)", "Divergent (published × calculated)", idioma), tipo: "texto" },
  ];
}

function colunasDivulgado(idioma: Idioma): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto" }, // i18n: dado
    { id: "valor_uc", rotulo: tx("Valor a UCs (soma dos dados abertos)", "Amount to UCs (sum of the open data)", idioma), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "divulgado_valor", rotulo: tx("Divulgado pela ANEEL", "Announced by ANEEL", idioma), tipo: "numero", unidade: "R$", casas: 0 },
    { id: "dentro_valor", rotulo: tx("Dentro da precisão divulgada (R$ 0,5 milhão)", "Within the announced precision (R$ 0.5 million)", idioma), tipo: "texto", categorica: true },
    { id: "quantidade_uc", rotulo: tx("Compensações a UCs (soma dos dados abertos)", "Compensation payments to UCs (sum of the open data)", idioma), tipo: "numero", casas: 0 },
    { id: "divulgado_qt", rotulo: tx("Divulgado pela ANEEL (quantidade)", "Announced by ANEEL (quantity)", idioma), tipo: "numero", casas: 0 },
    { id: "dentro_qt", rotulo: tx("Dentro da precisão divulgada (50 mil)", "Within the announced precision (50 thousand)", idioma), tipo: "texto", categorica: true },
  ];
}

function colunasValidacao(idioma: Idioma): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("Controle", "Check", idioma), tipo: "texto", idiomaTexto: "portugues" },
    { id: "resultado", rotulo: tx("Resultado", "Result", idioma), tipo: "texto", categorica: true },
    { id: "critico", rotulo: tx("Crítico", "Critical", idioma), tipo: "texto", categorica: true },
    { id: "detalhe", rotulo: tx("Detalhe", "Detail", idioma), tipo: "texto", idiomaTexto: "portugues" },
  ];
}

function colunasArquivos(idioma: Idioma): ColunaTabela[] {
  return [
    { id: "dataset", rotulo: tx("Conjunto", "Dataset", idioma), tipo: "texto", categorica: true, idiomaTexto: "nome" },
    { id: "recurso", rotulo: tx("Recurso", "Resource", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "publicado_em", rotulo: tx("Publicado pela fonte", "Published by the source", idioma), tipo: "texto" },
    { id: "capturado_em", rotulo: tx("Capturado", "Captured", idioma), tipo: "texto" },
    { id: "versao", rotulo: tx("Regra de importação", "Import rule", idioma), tipo: "texto" },
    { id: "sha256", rotulo: "sha256", tipo: "texto" },
  ];
}

const simNao = (v: boolean | null, idioma: Idioma) => (v === null ? tx("sem divulgação", "not announced", idioma) : v ? tx("sim", "yes", idioma) : tx("não", "no", idioma));

/** Resultado de um controle de validação como o pipeline o grava, no idioma da página. */
function resultadoNoIdioma(r: string, idioma: Idioma): string {
  return tx(r, ({ aprovado: "passed", ressalva: "caveat", reprovado: "failed" } as Record<string, string>)[r] ?? r, idioma);
}

/**
 * Definição (colunas, linhas, fonte, arquivo) de cada tabela aberta sob demanda. `avisos` traz a marca de cobertura parcial do FEC
 * (a página manda a versão com os meses lidos do CSV mensal; sem ela, a regra é refeita aqui só com a gold).
 */
export function tabelaQualidade(id: IdTabela, g: QualidadeGold, avisos: AvisosFec = avisosFec(g), idioma: Idioma = idiomaEnergia()): DefinicaoTabela {
  const ref = String(g.ano_referencia);
  const c = g.conjuntos;
  const comp = g.compensacoes;
  const dist = new Map(g.distribuidoras.map((d) => [d.cnpj, d]));
  const comFec = (l: LinhaTabela): LinhaTabela => {
    const d = dist.get(String(l.id));
    return d ? { ...l, ...camposFecDaDistribuidora(d, avisos, idioma) } : l;
  };
  const FONTE = fonteContinuidade(idioma);
  const FONTE_COMPENSACOES = tx("ANEEL, compensações por violação de limites de continuidade", "ANEEL, compensation payments for violation of continuity limits", idioma);
  const FONTE_ATENDIMENTO = tx(
    "ANEEL: manifestações, Ouvidoria, IASC, atendimento emergencial e telefônico",
    "ANEEL: complaints, Ombudsman, IASC, emergency and telephone service",
    idioma,
  );
  const dicaSigla = tx("Sigla ou CNPJ", "Acronym or CNPJ", idioma);
  switch (id) {
    case "dist-p051":
      return {
        colunas: comColunasFec(colunasDistP051(idioma), idioma),
        linhas: linhasDistribuidorasP051(g, idioma).map(comFec),
        colunaRotulo: "sigla",
        fonte: FONTE,
        versao: ref,
        nomeArquivo: "qualidade-distribuidoras",
        ordemInicial: { coluna: "dec", direcao: "desc" },
        dicaBusca: dicaSigla,
        nota: tx(
          `Distribuidora com menos de 12 meses publicados fica sem valor anual (ausência, nunca soma de meses). ${notaFecCobertura(avisos)}`,
          `A distribution utility with fewer than 12 months published has no annual value (absence, never a sum of months). ${notaFecCobertura(avisos, idioma)}`,
          idioma,
        ),
      };
    case "limites":
      return {
        colunas: comColunasFec(colunasLimites(idioma), idioma),
        linhas: linhasLimites(g, idioma).map(comFec),
        colunaRotulo: "sigla",
        fonte: FONTE,
        versao: ref,
        nomeArquivo: "qualidade-limites-distribuidoras",
        ordemInicial: { coluna: "razao_dec", direcao: "desc" },
        dicaBusca: dicaSigla,
        nota: tx(
          `DGC (desempenho global de continuidade) = média simples de DEC ÷ limite e FEC ÷ limite, como no ranking da ANEEL; o publicado tem duas casas. Posição, porte e DGC publicado são do ranking da ANEEL; as demais colunas são calculadas aqui. ${notaFecCobertura(avisos)}`,
          `DGC (overall continuity performance) = simple average of DEC ÷ limit and FEC ÷ limit, as in the ANEEL ranking; the published value has two decimals. Position, size group and published DGC come from the ANEEL ranking; the other columns are calculated here. ${notaFecCobertura(avisos, idioma)}`,
          idioma,
        ),
      };
    case "mensal":
      return {
        colunas: colunasMensal(idioma),
        linhas: linhasBrasilMensal(g, idioma).map((m) => ({ ...m, id: String(m.m) })),
        colunaRotulo: "m",
        fonte: FONTE,
        versao: g.ultimo_mes_completo,
        nomeArquivo: "qualidade-brasil-mensal",
        ordemInicial: { coluna: "m", direcao: "desc" },
      };
    case "identidade":
      return {
        colunas: colunasIdentidade(idioma),
        linhas: g.brasil.identidade_apurado.map((x) => ({
          id: String(x.ano),
          ano: String(x.ano),
          conjunto_meses: x.conjunto_meses,
          pct_dec: x.pct_dec_igual_ip_mais_ind,
          pct_fec: x.pct_fec_igual_ip_mais_ind,
        })),
        fonte: FONTE,
        versao: ref,
        nomeArquivo: "qualidade-identidade-apurado",
      };
    case "matriz":
      return { colunas: colunasMatriz(idioma), linhas: linhasMatriz(c, idioma), colunaRotulo: "faixa", fonte: FONTE, versao: String(c.ano), nomeArquivo: "qualidade-matriz-limite-razao" };
    case "cauda-razao":
      return {
        colunas: colunasCauda(idioma),
        linhas: linhasCauda(c.cauda_razao_dec),
        colunaRotulo: "nome",
        fonte: FONTE,
        versao: String(c.ano),
        nomeArquivo: "qualidade-cauda-razao",
        ordemInicial: { coluna: "razao_dec", direcao: "desc" },
      };
    case "cauda-dec":
      return {
        colunas: colunasCauda(idioma),
        linhas: linhasCauda(c.cauda_dec),
        colunaRotulo: "nome",
        fonte: FONTE,
        versao: String(c.ano),
        nomeArquivo: "qualidade-cauda-dec",
        ordemInicial: { coluna: "dec", direcao: "desc" },
      };
    case "dgc":
      return {
        colunas: colunasDgc(idioma),
        linhas: g.reconciliacao.dgc.map((r) => ({
          id: String(r.ano),
          ano: String(r.ano),
          comparados: r.comparados,
          ate_1_centesimo: r.ate_1_centesimo,
          exatos: r.exatos_2_casas,
          maior: r.maior_diferenca,
          divergentes: r.divergentes.map((d) => `${d.sigla_ranking ?? d.empresa}: ${num(d.dgc_publicado, 2, idioma)} × ${num(d.dgc_calculado, 3, idioma)}`).join("; ") || tx("nenhuma", "none", idioma),
        })),
        fonte: tx("ANEEL, ranking da continuidade; cálculo do observatório", "ANEEL, continuity ranking; observatory calculation", idioma),
        versao: ref,
        nomeArquivo: "qualidade-reconciliacao-dgc",
      };
    case "comp-anual": {
      const inicioUg = comp.anual.find((x) => x.valor_ug !== null)?.ano ?? null;
      const quebra = textoQuebraCompensacao(g, idioma);
      return {
        colunas: colunasCompAnual(idioma),
        linhas: linhasCompensacaoAnual(g, idioma).map((l) => ({ ...l, id: String(l.ano) })),
        colunaRotulo: "ano", // i18n: dado
        fonte: FONTE_COMPENSACOES,
        versao: comp.ultimo_mes_completo ?? String(comp.ano_referencia),
        nomeArquivo: "qualidade-compensacoes-anual",
        ordemInicial: { coluna: "ano", direcao: "desc" }, // i18n: dado
        nota: tx(
          `Unidade geradora sem linha na fonte${inicioUg ? ` (antes de ${inicioUg})` : ""} é ausência, não zero. O ano corrente é parcial e fica fora do gráfico.${quebra ? ` ${quebra}` : ""}`,
          `A generating unit with no line in the source${inicioUg ? ` (before ${inicioUg})` : ""} is absence, not zero. The current year is partial and is kept outside the chart.${quebra ? ` ${quebra}` : ""}`,
          idioma,
        ),
      };
    }
    case "comp-tipo": {
      const rotulos = rotulosTipoNoIdioma(comp.rotulos_tipo, idioma);
      return {
        colunas: [
          { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto" }, // i18n: dado
          { id: "situacao", rotulo: tx("Situação", "Status", idioma), tipo: "texto", categorica: true },
          ...ORDEM_TIPOS.map((t) => ({ id: t, rotulo: tx(`${rotulos[t]}, só UC`, `${rotulos[t]}, UC only`, idioma), tipo: "numero" as const, unidade: "R$", casas: 2 })),
          { id: "valor_ug", rotulo: tx("Unidades geradoras, todos os tipos", "Generating units, all types", idioma), tipo: "numero" as const, unidade: "R$", casas: 2 },
        ],
        linhas: linhasCompensacaoTipo(g, idioma).map((l) => ({ ...l, id: String(l.ano) })),
        colunaRotulo: "ano", // i18n: dado
        fonte: FONTE_COMPENSACOES,
        versao: String(comp.ano_referencia),
        nomeArquivo: "qualidade-compensacoes-tipo",
        ordemInicial: { coluna: "ano", direcao: "desc" }, // i18n: dado
        nota: notaTiposCompensacao(g, idioma),
      };
    }
    case "comp-dist":
      return {
        colunas: colunasCompensacaoDistribuidoras(comp.rotulos_tipo, idioma),
        linhas: linhasCompensacaoDistribuidoras(g, idioma),
        colunaRotulo: "sigla",
        fonte: FONTE_COMPENSACOES,
        versao: String(comp.ano_referencia),
        nomeArquivo: "qualidade-compensacoes-distribuidoras",
        ordemInicial: { coluna: "valor", direcao: "desc" }, // i18n: dado
        dicaBusca: dicaSigla,
      };
    case "divulgado":
      return {
        colunas: colunasDivulgado(idioma),
        linhas: comp.anual
          .filter((x) => x.divulgado_aneel)
          .map((x) => ({
            id: String(x.ano),
            ano: String(x.ano),
            valor_uc: x.valor_uc,
            divulgado_valor: x.divulgado_aneel!.valor,
            dentro_valor: simNao(x.divulgado_aneel!.dentro_da_precisao_valor, idioma),
            quantidade_uc: x.quantidade_uc,
            divulgado_qt: x.divulgado_aneel!.quantidade,
            dentro_qt: simNao(x.divulgado_aneel!.dentro_da_precisao_quantidade, idioma),
          })),
        fonte: tx("ANEEL, compensações (dados abertos) e notícia anual do ranking", "ANEEL, compensation payments (open data) and the annual ranking news release", idioma),
        versao: String(comp.ano_referencia),
        nomeArquivo: "qualidade-compensacoes-divulgado",
      };
    case "escopos":
      return {
        colunas: colunasEscopos(idioma),
        linhas: linhasEscopos(g, idioma),
        colunaRotulo: "indicador",
        fonte: tx("ANEEL: manifestações, Ouvidoria Setorial e atendimento emergencial", "ANEEL: complaints, Sector Ombudsman and emergency response", idioma),
        versao: ref,
        nomeArquivo: "qualidade-atendimento-nacional",
      };
    case "eventos":
      return {
        colunas: colunasEventos(idioma),
        linhas: linhasEventos(g, idioma),
        colunaRotulo: "sigla",
        fonte: tx("ANEEL, Evento Situação de Emergência", "ANEEL, Emergency Situation Events (Evento Situação de Emergência)", idioma),
        versao: g.atendimento.eventos_emergencia.inicio_max?.slice(0, 10) ?? ref,
        nomeArquivo: "qualidade-eventos-emergencia",
        ordemInicial: { coluna: "chi_evento", direcao: "desc" },
        nota: tx(
          "CHI: consumidores × horas interrompidas. Evento que atravessa o mês aparece em mais de uma competência; nada é somado entre registros.",
          "CHI: consumers × hours interrupted. An event that crosses the month appears in more than one accrual month; nothing is summed across records.",
          idioma,
        ),
      };
    case "atendimento":
      return {
        colunas: colunasAtendimento(g, idioma),
        linhas: linhasAtendimentoDistribuidoras(g, idioma),
        colunaRotulo: "sigla",
        fonte: FONTE_ATENDIMENTO,
        versao: ref,
        nomeArquivo: "qualidade-atendimento-distribuidoras",
        ordemInicial: { coluna: "rec_mil", direcao: "desc" },
        dicaBusca: tx("Sigla ou categoria do IASC", "Acronym or IASC category", idioma),
        nota: tx(
          "Reclamações por mil UCs só com os 12 meses enviados pela distribuidora; Ouvidoria por 100 mil UCs; IASC com a amostra ao lado.",
          "Complaints per thousand UCs only with the 12 months sent by the distribution utility; Ombudsman per 100 thousand UCs; IASC with the sample alongside.",
          idioma,
        ),
      };
    case "validacao":
      return {
        colunas: colunasValidacao(idioma),
        linhas: g.validacao.map((x, i) => ({
          id: String(i),
          // nome e detalhe do controle são frases do pipeline, só em português (a tabela no navegador não tem como marcar a célula)
          nome: paraLeitor(x.nome),
          resultado: resultadoNoIdioma(x.resultado, idioma),
          critico: x.critico ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
          detalhe: paraLeitor(x.detalhe),
        })),
        colunaRotulo: "nome",
        fonte: tx("Pipeline do observatório (pipeline/energia/modulos/qualidade.py)", "Observatory pipeline (pipeline/energia/modulos/qualidade.py)", idioma),
        versao: g.gerado_em.slice(0, 10),
        nomeArquivo: "qualidade-validacao",
      };
    case "arquivos":
      return {
        colunas: colunasArquivos(idioma),
        linhas: g.controles.map((x, i) => ({
          id: String(i),
          dataset: x.dataset,
          recurso: x.recurso,
          publicado_em: x.publicado_em ?? tx("não informado pela fonte", "not reported by the source", idioma),
          capturado_em: x.capturado_em,
          versao: x.versao_importacao ?? tx("não registrada", "not recorded", idioma),
          sha256: x.sha256,
        })),
        colunaRotulo: "recurso",
        fonte: tx("ANEEL e IBGE (arquivos originais)", "ANEEL and IBGE (original files)", idioma),
        versao: g.gerado_em.slice(0, 10),
        nomeArquivo: "qualidade-arquivos",
      };
  }
}

/* ---------------------------------------------------------------- redesenho: painéis, abertura e arquivos */

/**
 * Os quatro painéis da página: âncora do bloco, nome curto, título do painel e a pergunta que cada um responde (a descrição dos
 * capítulos e a "próxima pergunta" de cada rodapé saem daqui, o mesmo texto nos dois lugares).
 */
export function paineisQualidade(idioma: Idioma = idiomaEnergia()) {
  return [
    {
      id: "p051",
      ancora: "duracao",
      rotulo: tx("Duração e frequência", "Duration and frequency", idioma),
      titulo: tx("Duração e frequência das interrupções no Brasil, ano a ano", "Duration and frequency of interruptions in Brazil, year by year", idioma),
      descricao: tx(
        "Por quanto tempo e quantas vezes falta energia, no Brasil, nas distribuidoras e nos conjuntos?",
        "For how long and how often is power interrupted, in Brazil, at the distribution utilities and in the consumer sets?",
        idioma,
      ),
    },
    {
      id: "p052",
      ancora: "limites",
      rotulo: tx("Limites", "Limits", idioma),
      titulo: tx("Cada distribuidora e cada conjunto diante do próprio limite", "Each distribution utility and each consumer set against its own limit", idioma),
      descricao: tx(
        "Quantos conjuntos passam do limite de DEC e como cada distribuidora fica diante do próprio limite?",
        "How many consumer sets exceed the DEC limit and how does each distribution utility stand against its own limit?",
        idioma,
      ),
    },
    {
      id: "p053",
      ancora: "compensacoes",
      rotulo: tx("Compensações", "Compensation payments", idioma),
      titulo: tx("Quais compensações foram pagas?", "What compensation payments were made?", idioma),
      descricao: tx("Quanto foi pago a quem teve um limite individual de continuidade violado?", "How much was paid to those whose individual continuity limit was violated?", idioma),
    },
    {
      id: "p054",
      ancora: "atendimento",
      rotulo: tx("Atendimento", "Customer service", idioma),
      titulo: tx("Como o consumidor é atendido e como a rede se recupera?", "How are consumers served and how does the grid recover?", idioma),
      descricao: tx(
        "Como o consumidor é atendido, o que ele responde na pesquisa de satisfação e como a rede se recupera?",
        "How are consumers served, what do they answer in the satisfaction survey and how does the grid recover?",
        idioma,
      ),
    },
  ] as const;
}
export const PAINEIS_QUALIDADE = paineisQualidade("pt");
export type PainelQualidade = (typeof PAINEIS_QUALIDADE)[number]["id"];
export const painelQualidade = (id: PainelQualidade, idioma: Idioma = idiomaEnergia()) => paineisQualidade(idioma).find((p) => p.id === id)!;

/**
 * Duas páginas (diagnóstico de layout de 20/10/2026, item 6): a entrada responde ao leitor pelo município e mostra a duração, as
 * compensações e o atendimento (P051, P053, P054); a comparação entre distribuidoras diante do próprio limite (P052) tem página própria,
 * como a Carga. A escolha de distribuidora segue no endereço (`?dist=`) de uma página à outra.
 */
export const ROTA_QUALIDADE = "/setor-eletrico/qualidade";
export const ROTA_COMPARAR_DISTRIBUIDORAS = `${ROTA_QUALIDADE}/comparar-distribuidoras`;
export type PaginaQualidade = "entrada" | "comparar";
export const paginaDoPainelQualidade = (id: PainelQualidade): PaginaQualidade => (id === "p052" ? "comparar" : "entrada");

/** Endereço de um painel visto de uma das duas páginas: âncora no mesmo documento, ou rota e âncora quando o painel mora na outra. */
export function hrefPainelQualidade(id: PainelQualidade, de: PaginaQualidade, idioma: Idioma = idiomaEnergia()): string {
  const ancora = painelQualidade(id, idioma).ancora;
  const destino = paginaDoPainelQualidade(id);
  if (destino === de) return `#${ancora}`;
  return `${destino === "comparar" ? ROTA_COMPARAR_DISTRIBUIDORAS : ROTA_QUALIDADE}#${ancora}`;
}

/** As duas páginas como itens de navegação local: o nome curto e a pergunta de cada uma. */
export function paginasQualidade(idioma: Idioma = idiomaEnergia()): { id: PaginaQualidade; href: string; rotulo: string; pergunta: string }[] {
  return [
    {
      id: "entrada",
      href: ROTA_QUALIDADE,
      rotulo: tx("No meu município e no Brasil", "In my municipality and in Brazil", idioma),
      pergunta: tx("Quanto tempo e quantas vezes falta luz?", "How long and how often is the power cut?", idioma),
    },
    {
      id: "comparar",
      href: ROTA_COMPARAR_DISTRIBUIDORAS,
      rotulo: tx("Comparar distribuidoras", "Compare distribution utilities", idioma),
      pergunta: tx("Como cada distribuidora fica diante do próprio limite?", "How does each distribution utility stand against its own limit?", idioma),
    },
  ];
}

/**
 * Valores da faixa de métricas da abertura. São os mesmos que a resposta, o gráfico e a tabela do P051 e do P052 leem (o ano de
 * referência da gold e o anterior); a faixa não calcula nada, só escolhe e converte a unidade de exibição (horas e minutos).
 */
export type MetricasAbertura = {
  ano: number;
  anoAnterior: number | null;
  dec: number | null;
  decAnterior: number | null;
  /** O DEC em horas e minutos (9,33 h são 9 h 20 min), nunca por leitura literal dos centésimos. */
  decHorasMinutos: string;
  fec: number | null;
  fecAnterior: number | null;
  /** DEC de todas as origens publicadas: o apurado mais as parcelas expurgadas. */
  decTodasOrigens: number | null;
  decTodasOrigensHorasMinutos: string;
  conjuntos: {
    ano: number;
    acima: number;
    comLimite: number;
    pct: number | null;
    anoAnterior: number | null;
    pctAnterior: number | null;
  };
};

export function metricasAbertura(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): MetricasAbertura {
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  const ant = anoBrasil(g, ref - 1);
  const anterior = ant && ant.dec !== null && ant.fec !== null ? ant : null;
  const c = g.conjuntos;
  const antC = c.historico.find((h) => h.ano === c.ano - 1) ?? null;
  return {
    ano: ref,
    anoAnterior: anterior ? anterior.ano : null,
    dec: a?.dec ?? null,
    decAnterior: anterior?.dec ?? null,
    decHorasMinutos: horasEMinutos(a?.dec, idioma),
    fec: a?.fec ?? null,
    fecAnterior: anterior?.fec ?? null,
    decTodasOrigens: a?.dec_todas_parcelas ?? null,
    decTodasOrigensHorasMinutos: horasEMinutos(a?.dec_todas_parcelas, idioma),
    conjuntos: {
      ano: c.ano,
      acima: c.acima_limite_dec,
      comLimite: c.com_limite,
      pct: c.pct_acima_limite_dec,
      anoAnterior: antC && antC.pct_acima_limite_dec !== null ? antC.ano : null,
      pctAnterior: antC?.pct_acima_limite_dec ?? null,
    },
  };
}

/** Universo do DEC e do FEC nacionais, para o recorte: quantas distribuidoras e conjuntos entram e o recorte das concessionárias. */
export function textoUniversoBrasil(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const a = anoBrasil(g, g.ano_referencia);
  if (!a) return tx("Sem ano nacional completo publicado.", "No complete national year published.", idioma);
  const distribuidoras = g.distribuidoras.filter((d) => d.dec !== null).length;
  const base = tx(
    `Todas as distribuidoras com indicadores publicados, inclusive permissionárias: ${num(distribuidoras, 0)} distribuidoras e ${num(a.conjuntos, 0)} conjuntos em ${a.ano}.`,
    `All distribution utilities with published indicators, including permit holders: ${num(distribuidoras, 0, idioma)} distribution utilities and ${num(a.conjuntos, 0, idioma)} consumer sets in ${a.ano}.`,
    idioma,
  );
  if (a.dec_concessionarias === null || a.fec_concessionarias === null || a.concessionarias === null) return base;
  return tx(
    `${base} Só as ${num(a.concessionarias, 0)} concessionárias, o universo do número que a ANEEL divulga: ${num(a.dec_concessionarias, 2)} h e ${num(a.fec_concessionarias, 2)} interrupções.`,
    `${base} Only the ${num(a.concessionarias, 0, idioma)} concession holders, the universe of the number ANEEL announces: ${num(a.dec_concessionarias, 2, idioma)} h and ${num(a.fec_concessionarias, 2, idioma)} interruptions.`,
    idioma,
  );
}

function frasesParcela(idioma: Idioma): Record<GrupoParcela, string> {
  return {
    apurado: tx("no apurado, a parte comparada ao limite", "in the assessed value, the part compared with the limit", idioma),
    emergencia: tx("em situação de emergência", "in emergency situations", idioma),
    dia_critico: tx("em dia crítico", "on critical days", idioma),
    externa: tx("de origem externa ao sistema de distribuição", "of origin external to the distribution system", idioma),
    ons: tx("de racionamento ou alívio de carga pelo ONS", "from rationing or load relief by the ONS", idioma),
  };
}

/**
 * As parcelas do DEC do ano de referência por extenso: o que entra no apurado e o que a regra expurga, com a soma de todas as origens.
 * O que a fonte não publica (parcela nula) é dito como ausência, nunca como zero. Vazio sem parcelas publicadas.
 */
export function textoParcelasAno(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const a = anoBrasil(g, g.ano_referencia);
  const p = a?.parcelas_dec ?? null;
  if (!a || !p || a.dec_todas_parcelas === null) return "";
  const frase = frasesParcela(idioma);
  const itens = ORDEM_PARCELAS.map((k) =>
    p[k] === null ? tx(`sem valor publicado ${frase[k]}`, `no published value ${frase[k]}`, idioma) : `${num(p[k], 2, idioma)} h ${frase[k]}`,
  );
  return tx(
    `Em ${a.ano}, o DEC de todas as origens foi de ${num(a.dec_todas_parcelas, 2)} h (${horasEMinutos(a.dec_todas_parcelas)}): ${listaPt(itens)}. As quatro últimas parcelas são expurgadas do apurado.`,
    `In ${a.ano}, the DEC from all origins was ${num(a.dec_todas_parcelas, 2, idioma)} h (${horasEMinutos(a.dec_todas_parcelas, idioma)}): ${listaPt(itens, idioma)}. The last four components are excluded from the assessed value.`,
    idioma,
  );
}

/**
 * Primeiro ano a partir do qual o DEC e o FEC apurados são, em todos os conjunto-meses, a soma das parcelas internas programada e não
 * programada (IP + IND): antes disso o apurado de parte dos conjuntos incluía também as externas não críticas. Lido da tabela de
 * identidade do apurado, nunca escrito à mão; null quando a identidade vale desde o primeiro ano publicado ou nunca fecha.
 */
export function anoApuradoUniforme(g: QualidadeGold): number | null {
  const id = g.brasil.identidade_apurado;
  let ano: number | null = null;
  for (let i = id.length - 1; i >= 0; i--) {
    const x = id[i];
    if (x.pct_dec_igual_ip_mais_ind === 100 && x.pct_fec_igual_ip_mais_ind === 100) ano = x.ano;
    else break;
  }
  return ano !== null && ano > (id[0]?.ano ?? ano) ? ano : null;
}

/**
 * Marco do eixo dos anos nos gráficos de DEC e FEC: o ano a partir do qual o apurado passa a ser só IP + IND (antes, o apurado de parte
 * dos conjuntos incluía as externas não críticas). É a quebra que importa para comparar um ano com outro; o ano vem da identidade do
 * apurado, nunca de número escrito à mão. O início das parcelas em separado aparece no gráfico das parcelas, que começa nele.
 */
export function marcosHistoriaApurado(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): { x: string; rotulo: string }[] {
  const uniforme = anoApuradoUniforme(g);
  return uniforme === null ? [] : [{ x: String(uniforme), rotulo: tx(`${uniforme}: muda o que entra no apurado`, `${uniforme}: what enters the assessed value changes`, idioma) }];
}

/** Compensações do ano de referência para a faixa do P053: totais em milhões, unidades consumidoras e geradoras sempre separadas. */
export function metricasCompensacao(g: QualidadeGold) {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia) ?? null;
  const ant = c.anual.find((x) => x.ano === c.ano_referencia - 1 && x.completo) ?? null;
  const milhoes = (v: number | null | undefined) => (v === null || v === undefined ? null : v / 1e6);
  return {
    ano: c.ano_referencia,
    valorUcMilhoes: milhoes(a?.valor_uc),
    valorUcAnteriorMilhoes: milhoes(ant?.valor_uc),
    anoAnterior: ant && ant.valor_uc !== null ? ant.ano : null,
    quantidadeUcMilhoes: milhoes(a?.quantidade_uc),
    valorUgMilhoes: milhoes(a?.valor_ug),
  };
}

/**
 * O total que a ANEEL divulga para o ano de referência, quando a soma dos dados abertos difere dele além da precisão divulgada
 * (a conferência fica marcada e a diferença não foi explicada). Vazio quando não há divulgação ou quando ela confere.
 */
export function textoDivulgadoAno(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  const d = a?.divulgado_aneel ?? null;
  if (!a || !d || d.valor === null || a.valor_uc === null || d.dentro_da_precisao_valor !== false) return "";
  return tx(
    `A ANEEL divulga ${reaisMilhoes(d.valor, 0)} para ${a.ano}, e a soma dos dados abertos é ${reaisMilhoes(a.valor_uc)}: a diferença passa da precisão divulgada e não foi explicada (a conferência está em Auditar).`,
    `ANEEL announces ${reaisMilhoes(d.valor, 0, idioma)} for ${a.ano}, and the sum of the open data is ${reaisMilhoes(a.valor_uc, 1, idioma)}: the difference exceeds the announced precision and has not been explained (the check is under Audit).`,
    idioma,
  );
}

/* ---- arquivos para baixar: nome legível para o leitor, o nome do arquivo só em Auditar */

function rotulosArquivo(idioma: Idioma): Record<string, string> {
  return {
    "qualidade_brasil.csv": tx("DEC e FEC do Brasil, por ano e por mês", "DEC and FEC of Brazil, by year and by month", idioma),
    "qualidade_distribuidoras_anual.csv": tx("DEC, FEC e limites de cada distribuidora, por ano", "DEC, FEC and limits of each distribution utility, by year", idioma),
    "qualidade_distribuidoras_mensal.csv": tx("DEC e FEC de cada distribuidora, por mês", "DEC and FEC of each distribution utility, by month", idioma),
    "qualidade_conjuntos_mensal.csv": tx("DEC e FEC de cada conjunto, por mês", "DEC and FEC of each consumer set, by month", idioma),
    "qualidade_municipios.csv": tx("Conjuntos que atendem cada município, com o DEC e o FEC deles", "Consumer sets serving each municipality, with their DEC and FEC", idioma),
    "qualidade_mapa.json": tx("Mapa por município (JSON)", "Map by municipality (JSON)", idioma),
    "qualidade_distribuidoras_serie.json": tx("Série anual de cada distribuidora (JSON)", "Annual series of each distribution utility (JSON)", idioma),
    "qualidade_reconciliacao_dgc.csv": tx("DGC calculado e DGC publicado no ranking da ANEEL", "Calculated DGC and DGC published in the ANEEL ranking", idioma),
    "qualidade_compensacoes.csv": tx("Compensações por distribuidora, mês e tipo de violação", "Compensation payments by distribution utility, month and type of violation", idioma),
    "qualidade_atendimento.csv": tx(
      "Reclamações, Ouvidoria, IASC e atendimento emergencial por distribuidora",
      "Complaints, Ombudsman, IASC and emergency response by distribution utility",
      idioma,
    ),
    "qualidade_atendimento_telefonico.csv": tx("Atendimento telefônico por distribuidora e mês", "Telephone service by distribution utility and month", idioma),
    "qualidade_eventos_emergencia.csv": tx("Eventos em situação de emergência", "Events in emergency situations", idioma),
  };
}

/** Nome legível do arquivo publicado (o conjunto anual por década diz o seu período, lido do nome do arquivo). */
export function rotuloArquivo(url: string, idioma: Idioma = idiomaEnergia()): string {
  const nome = url.split("/").at(-1) ?? url;
  const decada = /^qualidade_conjuntos_anual_(\d{4})_(\d{4})\.csv$/.exec(nome);
  if (decada) return tx(`DEC, FEC e limites de cada conjunto, por ano, de ${decada[1]} a ${decada[2]}`, `DEC, FEC and limits of each consumer set, by year, from ${decada[1]} to ${decada[2]}`, idioma);
  return rotulosArquivo(idioma)[nome] ?? tx("Arquivo de dados", "Data file", idioma);
}

const ARQUIVOS_DO_PAINEL: Record<PainelQualidade, (string | RegExp)[]> = {
  p051: ["qualidade_brasil.csv", "qualidade_distribuidoras_anual.csv", "qualidade_distribuidoras_mensal.csv", "qualidade_conjuntos_mensal.csv", "qualidade_municipios.csv"],
  p052: ["qualidade_distribuidoras_anual.csv", /^qualidade_conjuntos_anual_\d{4}_\d{4}\.csv$/, "qualidade_reconciliacao_dgc.csv"],
  p053: ["qualidade_compensacoes.csv"],
  p054: ["qualidade_atendimento.csv", "qualidade_atendimento_telefonico.csv", "qualidade_eventos_emergencia.csv"],
};

/** Arquivos de um painel, com nome legível, entre os que a gold publica (um arquivo que a publicação não traz não aparece). */
export function downloadsDoPainel(g: QualidadeGold, painel: PainelQualidade, idioma: Idioma = idiomaEnergia()): { rotulo: string; url: string }[] {
  const quer = ARQUIVOS_DO_PAINEL[painel];
  return g.downloads
    .filter((d) => {
      const nome = d.url.split("/").at(-1) ?? "";
      return quer.some((q) => (typeof q === "string" ? q === nome : q.test(nome)));
    })
    .map((d) => ({ rotulo: rotuloArquivo(d.url, idioma), url: d.url }));
}

/* ================================================================ ressalvas das avaliações independentes, no ponto de uso */

/*
 * O que há abaixo nasceu das avaliações técnica e de produto da versão anterior: cada seletor devolve texto ou valor derivado dos
 * campos da gold (e dos CSV publicados com ela), nunca um número escrito à mão, e nenhum deles refaz um indicador. Quando a gold
 * é reconstruída, as frases se refazem sozinhas; quando o dado de que a frase depende falta, a função devolve vazio ou a frase sem
 * aquele trecho.
 */

/* ---------------------------------------------------------------- FEC de cobertura parcial */

/**
 * Diferença, em centésimos de interrupção, entre o FEC anual de uma distribuidora e a soma das parcelas internas (FECIP + FECIND, o grupo
 * "apurado" das parcelas) acima da qual o FEC do ano é marcado como de cobertura parcial. Desde o ano em que o apurado é uniforme (IP + IND
 * em todos os conjunto-meses) as duas contas têm de fechar; quando não fecham, algum mês entrou no anual com parte das unidades consumidoras
 * sem FEC publicado.
 */
export const LIMITE_FEC_PARCIAL_CENTESIMOS = 2;
/** Fração das UCs com número de unidades que o FEC de um mês precisa cobrir (a mesma regra de 99% do mês completo do DEC). */
export const COBERTURA_MINIMA_FEC_MES = 0.99;

/** Mês cujo FEC cobre menos que o mínimo das unidades consumidoras (colunas ucs_fec e ucs_total do CSV mensal por distribuidora). */
export type MesFecParcial = { mes: string; ucsFec: number; ucsTotal: number; cobertura: number };

export type AvisoFec = {
  cnpj: string;
  rotulo: string;
  ano: number;
  fec: number;
  /** FEC anual pela soma das parcelas internas (FECIP + FECIND); null quando a gold não traz as parcelas. */
  fecPelasParcelas: number | null;
  /** FEC apurado menos FEC pelas parcelas, em interrupções. */
  diferenca: number | null;
  /** Meses do ano com cobertura abaixo do mínimo, lidos do CSV mensal; vazio quando o arquivo não foi lido. */
  meses: MesFecParcial[];
  /** A frase completa, no ponto de uso do valor. */
  frase: string;
  /** A marca curta, para célula de tabela. */
  marca: string;
};
export type AvisosFec = Record<string, AvisoFec>;

const centesimos = (x: number) => Math.round(x * 100);

/** Campos que a gold pode passar a trazer por distribuidora e ano (próxima coleta): lidos quando existem, nunca exigidos. */
type CamposCoberturaFec = { meses_fec?: number | null; cobertura_fec?: number | null };

function fraseAvisoFec(
  rotulo: string,
  ano: number,
  fec: number,
  parcelas: number | null,
  meses: MesFecParcial[],
  diverge: boolean,
  idioma: Idioma,
): { frase: string; marca: string } {
  const cobertura = (m: MesFecParcial) => pct(m.cobertura * 100, 2, idioma);
  const n2 = (v: number | null) => num(v, 2, idioma);
  const minimo = pct(COBERTURA_MINIMA_FEC_MES * 100, 0, idioma);
  const refeito =
    parcelas !== null && diverge
      ? tx(
          `; pela soma das parcelas internas, programada e não programada (FECIP + FECIND), o anual é ${n2(parcelas)}, contra ${n2(fec)} apurado`,
          `; by the sum of the internal planned and unplanned components (FECIP + FECIND), the annual value is ${n2(parcelas)}, against ${n2(fec)} assessed`,
          idioma,
        )
      : "";
  let frase: string;
  let marca: string;
  if (meses.length === 1) {
    const mes = mesAno(meses[0].mes, idioma);
    frase = tx(`O FEC de ${mes} cobre ${cobertura(meses[0])} das UCs${refeito}.`, `The FEC of ${mes} covers ${cobertura(meses[0])} of the UCs${refeito}.`, idioma);
    marca = tx(`parcial: ${mes} cobre ${cobertura(meses[0])} das UCs`, `partial: ${mes} covers ${cobertura(meses[0])} of the UCs`, idioma);
  } else if (meses.length > 1) {
    const lista = listaPt(meses.map((m) => `${mesAno(m.mes, idioma)} (${cobertura(m)})`), idioma);
    frase = tx(`O FEC cobre menos de ${minimo} das UCs em ${lista}${refeito}.`, `The FEC covers less than ${minimo} of the UCs in ${lista}${refeito}.`, idioma);
    marca = tx(`parcial: ${meses.length} meses com menos de ${minimo} das UCs`, `partial: ${meses.length} months with less than ${minimo} of the UCs`, idioma);
  } else if (parcelas !== null && diverge) {
    frase = tx(
      `O FEC apurado (${n2(fec)}) difere da soma das parcelas internas, programada e não programada (FECIP + FECIND), ${n2(parcelas)}.`,
      `The assessed FEC (${n2(fec)}) differs from the sum of the internal planned and unplanned components (FECIP + FECIND), ${n2(parcelas)}.`,
      idioma,
    );
    marca = tx(`parcial: difere em ${n2(Math.abs(fec - parcelas))} das parcelas internas`, `partial: differs by ${n2(Math.abs(fec - parcelas))} from the internal components`, idioma);
  } else {
    frase = tx(
      `O FEC apurado (${n2(fec)}) não cobre todas as unidades consumidoras em todos os meses do ano.`,
      `The assessed FEC (${n2(fec)}) does not cover all consumer units in every month of the year.`,
      idioma,
    );
    marca = tx("parcial: nem todas as UCs em todos os meses", "partial: not all UCs in every month", idioma);
  }
  return { frase: tx(`${rotulo}, cobertura parcial do FEC em ${ano}. ${frase}`, `${rotulo}, partial FEC coverage in ${ano}. ${frase}`, idioma), marca };
}

/**
 * Distribuidoras cujo FEC anual do ano de referência é de cobertura parcial: o FEC difere da soma das parcelas internas em mais de
 * LIMITE_FEC_PARCIAL_CENTESIMOS (só em ano de apurado uniforme, onde as duas contas têm de fechar) ou a gold passa a dizer, em campo
 * próprio (`meses_fec` ou `cobertura_fec`), que o FEC do ano não cobre os 12 meses. O valor do anual na gold não muda: a marca e o valor
 * pelas parcelas vão ao lado dele. `mesesPorCnpj` (opcional) traz os meses de cobertura baixa, lidos do CSV mensal.
 */
export function fecComCoberturaParcial(g: QualidadeGold, mesesPorCnpj: Readonly<Record<string, readonly MesFecParcial[]>> = {}, idioma: Idioma = idiomaEnergia()): AvisoFec[] {
  const uniforme = anoApuradoUniforme(g);
  const out: AvisoFec[] = [];
  for (const d of g.distribuidoras) {
    if (d.fec === null) continue;
    const parcelas = d.parcelas_fec?.apurado ?? null;
    const diverge = uniforme !== null && d.ano >= uniforme && parcelas !== null && Math.abs(centesimos(d.fec) - centesimos(parcelas)) > LIMITE_FEC_PARCIAL_CENTESIMOS;
    const extra = d as Distribuidora & CamposCoberturaFec;
    const porCampo = (typeof extra.meses_fec === "number" && extra.meses_fec < d.meses) || (typeof extra.cobertura_fec === "number" && extra.cobertura_fec < COBERTURA_MINIMA_FEC_MES);
    if (!diverge && !porCampo) continue;
    const meses = [...(mesesPorCnpj[d.cnpj] ?? [])].sort((a, b) => a.mes.localeCompare(b.mes));
    const rotulo = rotuloDistribuidora(d);
    const { frase, marca } = fraseAvisoFec(rotulo, d.ano, d.fec, parcelas, meses, diverge, idioma);
    out.push({
      cnpj: d.cnpj,
      rotulo,
      ano: d.ano,
      fec: d.fec,
      fecPelasParcelas: parcelas,
      diferenca: parcelas === null ? null : (centesimos(d.fec) - centesimos(parcelas)) / 100,
      meses,
      frase,
      marca,
    });
  }
  return out.sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** O mesmo, indexado pelo CNPJ (o que os gráficos, as tabelas e os pequenos múltiplos consultam). */
export function avisosFec(g: QualidadeGold, mesesPorCnpj: Readonly<Record<string, readonly MesFecParcial[]>> = {}, idioma: Idioma = idiomaEnergia()): AvisosFec {
  return Object.fromEntries(fecComCoberturaParcial(g, mesesPorCnpj, idioma).map((a) => [a.cnpj, a]));
}

/**
 * Meses de um ano em que o FEC de cada distribuidora pedida cobre menos que COBERTURA_MINIMA_FEC_MES das unidades consumidoras, lidos
 * do CSV mensal por distribuidora (colunas cnpj, mes, ucs_fec e ucs_total). Só as linhas das distribuidoras pedidas são lidas.
 */
export function mesesComFecParcial(csv: string, cnpjs: readonly string[], ano: number): Record<string, MesFecParcial[]> {
  const out: Record<string, MesFecParcial[]> = {};
  if (!cnpjs.length || !csv) return out;
  const linhas = csv.replace(/^﻿/, "").split(/\r?\n/);
  const querem = cnpjs.map((c) => `${c};`);
  const escolhidas = [linhas[0] ?? "", ...linhas.slice(1).filter((l) => querem.some((q) => l.startsWith(q)))];
  for (const l of lerCsv(escolhidas.join("\n"))) {
    const ucsFec = numeroOuNulo(l.ucs_fec);
    const ucsTotal = numeroOuNulo(l.ucs_total);
    if (ucsFec === null || ucsTotal === null || ucsTotal <= 0 || !l.mes?.startsWith(`${ano}-`)) continue;
    const cobertura = ucsFec / ucsTotal;
    if (cobertura < COBERTURA_MINIMA_FEC_MES) (out[l.cnpj] ??= []).push({ mes: l.mes, ucsFec, ucsTotal, cobertura });
  }
  return out;
}

/** Colunas que a marca acrescenta às tabelas por distribuidora: a cobertura e o FEC refeito pelas parcelas, ao lado do FEC apurado. */
export function colunasFecCobertura(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "fec_cobertura", rotulo: tx("Cobertura do FEC no ano", "FEC coverage in the year", idioma), tipo: "texto", categorica: true },
    {
      id: "fec_parcelas",
      rotulo: tx("FEC pelas parcelas internas (FECIP + FECIND)", "FEC by the internal components (FECIP + FECIND)", idioma),
      tipo: "numero",
      unidade: tx("interrupções", "interruptions", idioma),
      casas: 2,
    },
  ];
}
export const COLUNAS_FEC_COBERTURA: ColunaTabela[] = colunasFecCobertura("pt");

/** Valores das duas colunas para uma distribuidora: a marca, quando há; senão, se o FEC confere com as parcelas ou se falta o que conferir. */
export function camposFecDaDistribuidora(d: Distribuidora, avisos: AvisosFec, idioma: Idioma = idiomaEnergia()): { fec_cobertura: string; fec_parcelas: number | null } {
  const aviso = avisos[d.cnpj];
  const parcelas = d.parcelas_fec?.apurado ?? null;
  const confere = parcelas !== null && d.fec !== null ? Math.abs(centesimos(d.fec) - centesimos(parcelas)) <= LIMITE_FEC_PARCIAL_CENTESIMOS : null;
  return {
    fec_cobertura: aviso
      ? aviso.marca
      : confere === null
        ? tx("sem parcelas para conferir", "no components to check", idioma)
        : confere
          ? tx("confere com as parcelas internas", "matches the internal components", idioma)
          : tx("difere das parcelas internas", "differs from the internal components", idioma),
    fec_parcelas: parcelas,
  };
}

/** Insere as colunas da cobertura do FEC logo depois da coluna do FEC apurado (junto do valor que elas qualificam). */
export function comColunasFec(colunas: readonly ColunaTabela[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const i = colunas.findIndex((c) => c.id === "fec");
  const fec = colunasFecCobertura(idioma);
  return i < 0 ? [...colunas, ...fec] : [...colunas.slice(0, i + 1), ...fec, ...colunas.slice(i + 1)];
}

/** Nota de rodapé das tabelas por distribuidora: o que a marca quer dizer e quais distribuidoras a têm. */
export function notaFecCobertura(avisos: AvisosFec, idioma: Idioma = idiomaEnergia()): string {
  const lista = Object.values(avisos);
  const regra = tx(
    `A cobertura parcial do FEC vale também para a razão de FEC e para o DGC calculado da distribuidora; o valor da tabela segue como está na base, e o FEC pelas parcelas internas vai ao lado. Marca: FEC do ano que difere em mais de ${num(LIMITE_FEC_PARCIAL_CENTESIMOS / 100, 2)} da soma das parcelas internas.`,
    `Partial FEC coverage also applies to the FEC ratio and to the distribution utility's calculated DGC; the table value stays as it is in the database, and the FEC by the internal components appears alongside. Mark: annual FEC that differs by more than ${num(LIMITE_FEC_PARCIAL_CENTESIMOS / 100, 2, idioma)} from the sum of the internal components.`,
    idioma,
  );
  return lista.length ? `${lista.map((a) => a.frase).join(" ")} ${regra}` : regra;
}

/**
 * Uma distribuidora para o painel de limites, com DEC e FEC e os dois limites do ano de referência. É o que viaja ao navegador: uma lista só
 * (em vez de uma por indicador, cada uma repetindo CNPJ e nome), com a classe em uma letra e as notas só onde existem.
 */
export type ItemLimites = {
  id: string;
  rotulo: string;
  /** c: concessionária; p: permissionária; s: sem classificação publicada. */
  classe: "c" | "p" | "s";
  dec: number | null;
  decLim: number | null;
  fec: number | null;
  fecLim: number | null;
  /** Notas do ano (meses publicados, cobertura do limite, perímetro). */
  det?: string;
  /** DGC calculado que difere do publicado pela ANEEL no ano de referência. */
  dgc?: string;
};

export function itensLimites(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): ItemLimites[] {
  const fec = new Map(itensLimite(g, "fec", idioma).map((i) => [i.id, i]));
  const dgc = detalheDgcDoAno(g, idioma);
  const classe = new Map(g.distribuidoras.map((d) => [d.cnpj, d.classificacao === "Concessionária" ? "c" : d.classificacao === "Permissionária" ? "p" : "s"] as const));
  return itensLimite(g, "dec", idioma).map((i) => {
    const f = fec.get(i.id);
    const item: ItemLimites = { id: i.id, rotulo: i.rotulo, classe: classe.get(i.id) ?? "s", dec: i.valor, decLim: i.referencia, fec: f?.valor ?? null, fecLim: f?.referencia ?? null };
    if (i.detalhe) item.det = i.detalhe;
    if (dgc[i.id]) item.dgc = dgc[i.id];
    return item;
  });
}

/**
 * Pares realizado × limite de um indicador para o gráfico de pontos, com as ressalvas da avaliação: no FEC, a distribuidora de cobertura
 * parcial leva um asterisco no nome e a frase na dica; nos dois indicadores, a distribuidora cujo DGC calculado difere do publicado no
 * ano de referência leva a diferença na dica. O valor de cada ponto é o da gold.
 */
export function paresLimites(itens: readonly ItemLimites[], ind: Indicador, avisos: AvisosFec): { id: string; rotulo: string; valor: number | null; referencia: number | null; detalhe?: string }[] {
  return itens.map((i) => {
    const aviso = ind === "fec" ? avisos[i.id] : undefined;
    const notas = [i.det, aviso ? aviso.frase.replace(/\.$/, "") : null, i.dgc].filter((x): x is string => !!x);
    const par: { id: string; rotulo: string; valor: number | null; referencia: number | null; detalhe?: string } = {
      id: i.id,
      rotulo: aviso ? `${i.rotulo} *` : i.rotulo,
      valor: ind === "dec" ? i.dec : i.fec,
      referencia: ind === "dec" ? i.decLim : i.fecLim,
    };
    if (notas.length) par.detalhe = notas.join("; ");
    return par;
  });
}

/** Só as colunas pedidas de cada linha (o que um gráfico lê): o resto não viaja ao navegador. Ausência continua nula. */
export function recorteColunas(linhas: readonly LinhaTabela[], ids: readonly string[]): LinhaTabela[] {
  return linhas.map((l) => Object.fromEntries(ids.map((k) => [k, l[k] ?? null])));
}

/* ---- conjuntos acima do limite de FEC: a contagem é um mínimo */

export type ResumoSemRazaoFec = {
  ano: number;
  /** Conjuntos com FEC e limite de FEC publicados, mas sem razão (menos de 12 meses de FEC): ficam fora da contagem. */
  total: number;
  porDistribuidora: { sigla: string; n: number }[];
  /** Os que já passam do limite com os meses publicados, comparados em centésimos. */
  acima: { conjunto: string; nome: string; sigla: string; fec: number; limite: number }[];
};

/** Resumo dos conjuntos do ano sem razão de FEC, a partir das linhas do CSV anual (conjuntosDoCsv). */
export function resumoSemRazaoFec(linhas: readonly LinhaTabela[], ano: number, idioma: Idioma = idiomaEnergia()): ResumoSemRazaoFec {
  const sem = linhas.filter((l) => typeof l.fec === "number" && typeof l.fec_limite === "number" && (l.razao_fec === null || l.razao_fec === undefined));
  const por = new Map<string, number>();
  for (const l of sem) {
    const sigla = String(l.sigla || tx("distribuidora sem sigla", "distribution utility without an acronym", idioma));
    por.set(sigla, (por.get(sigla) ?? 0) + 1);
  }
  return {
    ano,
    total: sem.length,
    porDistribuidora: Array.from(por, ([sigla, n]) => ({ sigla, n })).sort((a, b) => b.n - a.n || a.sigla.localeCompare(b.sigla, "pt-BR")),
    acima: sem
      .filter((l) => comparaNaPrecisao(l.fec as number, l.fec_limite as number, 2) === "acima")
      .map((l) => ({ conjunto: String(l.conjunto), nome: String(l.nome), sigla: String(l.sigla), fec: l.fec as number, limite: l.fec_limite as number })),
  };
}

/**
 * A contagem de conjuntos acima do limite de FEC (da gold) só inclui conjuntos com os 12 meses de FEC publicados: é um mínimo. Com o resumo dos
 * conjuntos sem razão, a frase diz quantos ficam fora, de quem são e quais já passam do limite com os meses publicados.
 */
export function textoContagemFec(g: QualidadeGold, resumo: ResumoSemRazaoFec | null, idioma: Idioma = idiomaEnergia()): string {
  const n = g.conjuntos.acima_limite_fec;
  const base = tx(
    `A contagem de FEC é de pelo menos ${num(n, 0)}: só entram os conjuntos com os 12 meses de FEC publicados.`,
    `The FEC count is at least ${num(n, 0, idioma)}: only consumer sets with the 12 months of FEC published are included.`,
    idioma,
  );
  if (!resumo || resumo.total === 0 || !resumo.porDistribuidora.length) return base;
  const [maior] = resumo.porDistribuidora;
  const outros = resumo.total - maior.n;
  const quem = tx(
    `${num(maior.n, 0)} da ${maior.sigla}${outros > 0 ? ` e ${num(outros, 0)} de ${outros === 1 ? "outra distribuidora" : "outras distribuidoras"}` : ""}`,
    `${num(maior.n, 0, idioma)} from ${maior.sigla}${outros > 0 ? ` and ${num(outros, 0, idioma)} from ${outros === 1 ? "another distribution utility" : "other distribution utilities"}` : ""}`,
    idioma,
  );
  const lista = listaPt(
    resumo.acima.map((x) =>
      tx(
        `${x.nome}, conjunto ${x.conjunto} (FEC ${num(x.fec, 2)} contra limite de ${num(x.limite, 2)})`,
        `${x.nome}, consumer set ${x.conjunto} (FEC ${num(x.fec, 2, idioma)} against a limit of ${num(x.limite, 2, idioma)})`,
        idioma,
      ),
    ),
    idioma,
  );
  const acima = resumo.acima.length
    ? tx(
        ` ${resumo.acima.length === 1 ? "Um deles já passa" : `${num(resumo.acima.length, 0)} deles já passam`} do limite com os meses publicados: ${lista}.`,
        ` ${resumo.acima.length === 1 ? "One of them already exceeds" : `${num(resumo.acima.length, 0, idioma)} of them already exceed`} the limit with the months published: ${lista}.`,
        idioma,
      )
    : "";
  return tx(
    `${base} ${num(resumo.total, 0)} ${resumo.total === 1 ? "conjunto com limite de FEC tem menos meses e fica" : "conjuntos com limite de FEC têm menos meses e ficam"} fora (${quem}).${acima}`,
    `${base} ${num(resumo.total, 0, idioma)} ${resumo.total === 1 ? "consumer set with a FEC limit has fewer months and is" : "consumer sets with a FEC limit have fewer months and are"} excluded (${quem}).${acima}`,
    idioma,
  );
}

/* ---------------------------------------------------------------- fração de conjuntos: o universo muda */

/**
 * O número de conjuntos com limite muda ao longo da série (e o limite de cada um também): a fração de conjuntos acima do limite mistura
 * desempenho, meta e mudança de universo. A frase diz os números (primeiro ano, o menor, o último) e aponta a fração das unidades
 * consumidoras, que pesa cada conjunto pelo tamanho, como a leitura principal.
 */
export function textoUniversosConjuntos(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const h = g.conjuntos.historico.filter((x) => x.com_limite > 0);
  if (h.length < 2) return "";
  const primeiro = h[0];
  const ultimo = h[h.length - 1];
  const menor = h.reduce((m, x) => (x.com_limite < m.com_limite ? x : m));
  const em = (x: { com_limite: number; ano: number }) => tx(`${num(x.com_limite, 0)} em ${x.ano}`, `${num(x.com_limite, 0, idioma)} in ${x.ano}`, idioma);
  const itens = [em(primeiro)];
  if (menor.ano !== primeiro.ano && menor.ano !== ultimo.ano) itens.push(em(menor));
  itens.push(em(ultimo));
  return tx(
    `O número de conjuntos com limite foi de ${listaPt(itens)}, e o limite de cada um também muda: a fração de conjuntos mistura desempenho, meta e mudança de universo. A fração das unidades consumidoras que estão em conjuntos acima do limite pesa cada conjunto pelo seu tamanho e é a leitura principal.`,
    `The number of consumer sets with a limit was ${listaPt(itens, idioma)}, and the limit of each one also changes: the share of clusters mixes performance, target and change of universe. The share of consumer units in clusters above the limit weights each cluster by its size and is the main reading.`,
    idioma,
  );
}

/* ---------------------------------------------------------------- o maior DEC apurado cruza regras do apurado */

export type ComparacaoApurado = {
  /** Primeiro ano com a parcela apurada (IP + IND) publicada. */
  desde: number;
  /** Primeiro ano em que o apurado publicado é, em todos os conjunto-meses, só IP + IND. */
  uniforme: number | null;
  maiorPublicado: { ano: number; dec: number };
  maiorMesmaDefinicao: { anos: number[]; dec: number };
  referencia: { ano: number; publicado: number; mesmaDefinicao: number };
};

/**
 * Compara o DEC apurado publicado com a parcela apurada refeita pela regra única de hoje (IP + IND, o grupo "apurado" das parcelas), que a
 * gold traz desde o primeiro ano com parcelas. Nulo quando faltam as parcelas.
 */
export function comparacaoApurado(g: QualidadeGold): ComparacaoApurado | null {
  const todos = g.brasil.anual.filter((x) => x.completo && x.dec !== null);
  const comParcela = todos.filter((x) => x.parcelas_dec && x.parcelas_dec.apurado !== null);
  const ref = comParcela.find((x) => x.ano === g.ano_referencia);
  if (comParcela.length < 2 || !ref || ref.dec === null) return null;
  const maiorPub = todos.reduce((m, x) => ((x.dec ?? -1) > (m.dec ?? -1) ? x : m));
  const maxIp = Math.max(...comParcela.map((x) => x.parcelas_dec!.apurado!));
  return {
    desde: comParcela[0].ano,
    uniforme: anoApuradoUniforme(g),
    maiorPublicado: { ano: maiorPub.ano, dec: maiorPub.dec! },
    maiorMesmaDefinicao: { anos: comParcela.filter((x) => centesimos(x.parcelas_dec!.apurado!) === centesimos(maxIp)).map((x) => x.ano), dec: maxIp },
    referencia: { ano: ref.ano, publicado: ref.dec, mesmaDefinicao: ref.parcelas_dec!.apurado! },
  };
}

/**
 * Aviso de quebra para a frase "o maior DEC apurado foi o de ...": o apurado publicado mudou de regra ao longo da série, e a comparação com
 * o ano de referência feita pela mesma definição (a parcela apurada, desde o primeiro ano com parcelas) vai na frase. Vazio sem parcelas.
 */
export function textoQuebraApurado(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = comparacaoApurado(g);
  if (!c) return "";
  const regras =
    c.uniforme !== null
      ? tx(
          `O maior valor publicado, o de ${c.maiorPublicado.ano}, cruza regras diferentes do apurado: de ${c.desde} a ${c.uniforme - 1} ele incluía, em parte dos conjuntos, interrupções de origem externa; desde ${c.uniforme}, inclui só as internas.`,
          `The highest published value, that of ${c.maiorPublicado.ano}, spans different rules for the assessed value: from ${c.desde} to ${c.uniforme - 1} it included, in part of the consumer sets, interruptions of external origin; since ${c.uniforme}, it includes only internal ones.`,
          idioma,
        )
      : tx(
          `O maior valor publicado, o de ${c.maiorPublicado.ano}, cruza regras diferentes do apurado: antes de ${c.desde} a fonte usa outra desagregação.`,
          `The highest published value, that of ${c.maiorPublicado.ano}, spans different rules for the assessed value: before ${c.desde} the source uses another breakdown.`,
          idioma,
        );
  const anos = listaPt(c.maiorMesmaDefinicao.anos.map(String), idioma);
  return tx(
    `${regras} Pela regra de ${c.uniforme ?? c.referencia.ano} aplicada desde ${c.desde}, o maior DEC foi o de ${anos} (${num(c.maiorMesmaDefinicao.dec, 2)} h), e ${c.referencia.ano} fechou com ${num(c.referencia.mesmaDefinicao, 2)} h.`,
    `${regras} By the ${c.uniforme ?? c.referencia.ano} rule applied since ${c.desde}, the highest DEC was that of ${anos} (${num(c.maiorMesmaDefinicao.dec, 2, idioma)} h), and ${c.referencia.ano} closed at ${num(c.referencia.mesmaDefinicao, 2, idioma)} h.`,
    idioma,
  );
}

/* ---------------------------------------------------------------- DGC: divergências com o ranking da ANEEL */

export type DivergenciaDgc = { ano: number; rotulo: string; cnpj: string | null; publicado: number | null; calculado: number | null; diferenca: number | null };

/** Comparações em que o DGC calculado difere do publicado além da tolerância, de todos os anos da reconciliação. */
export function divergenciasDgc(g: QualidadeGold): DivergenciaDgc[] {
  return g.reconciliacao.dgc.flatMap((r) =>
    r.divergentes.map((d) => ({ ano: r.ano, rotulo: d.sigla_ranking ?? d.empresa, cnpj: d.cnpj, publicado: d.dgc_publicado, calculado: d.dgc_calculado, diferenca: d.diferenca })),
  );
}

/** A reconciliação do DGC em uma frase: quantas comparações, quantas divergem e quais, sem explicar o que a base não explica. */
export function textoDivergenciasDgc(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const r = g.reconciliacao.dgc;
  if (!r.length) return "";
  const comparados = r.reduce((s, x) => s + x.comparados, 0);
  const d = divergenciasDgc(g);
  const ini = r[0].ano;
  const fim = r[r.length - 1].ano;
  if (!d.length)
    return tx(
      `De ${ini} a ${fim}, ${num(comparados, 0)} comparações entre o DGC publicado pela ANEEL e o calculado aqui ficaram dentro da tolerância de 0,01.`,
      `From ${ini} to ${fim}, ${num(comparados, 0, idioma)} comparisons between the DGC published by ANEEL and the one calculated here were within the 0.01 tolerance.`,
      idioma,
    );
  const lista = listaPt(
    d.map((x) =>
      tx(
        `${x.rotulo} em ${x.ano} (publicado ${num(x.publicado, 2)}, calculado ${num(x.calculado, 2)})`,
        `${x.rotulo} in ${x.ano} (published ${num(x.publicado, 2, idioma)}, calculated ${num(x.calculado, 2, idioma)})`,
        idioma,
      ),
    ),
    idioma,
  );
  return tx(
    `De ${ini} a ${fim}, ${num(d.length, 0)} de ${num(comparados, 0)} comparações entre o DGC publicado pela ANEEL e o calculado aqui diferem em mais de 0,01: ${lista}. Nesses casos o limite agregado calculado não coincide com o da ANEEL; a causa não está nos dados publicados, e revisão posterior dos indicadores, decisão judicial ou limite diferente na nota técnica são hipóteses não verificadas.`,
    `From ${ini} to ${fim}, ${num(d.length, 0, idioma)} of ${num(comparados, 0, idioma)} comparisons between the DGC published by ANEEL and the one calculated here differ by more than 0.01: ${lista}. In these cases the calculated aggregate limit does not match ANEEL's; the cause is not in the published data, and a later revision of the indicators, a court decision or a different limit in the technical note are unverified hypotheses.`,
    idioma,
  );
}

/** Dica do gráfico de pontos: a distribuidora cujo DGC calculado difere do publicado no ano de referência (por CNPJ). */
export function detalheDgcDoAno(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const x of divergenciasDgc(g)) {
    if (x.ano !== g.ano_referencia || !x.cnpj || x.publicado === null || x.calculado === null) continue;
    out[x.cnpj] = tx(
      `DGC calculado ${num(x.calculado, 3)} difere do publicado pela ANEEL, ${num(x.publicado, 2)}`,
      `calculated DGC ${num(x.calculado, 3, idioma)} differs from the one published by ANEEL, ${num(x.publicado, 2, idioma)}`,
      idioma,
    );
  }
  return out;
}

/* ---------------------------------------------------------------- abertura: perímetro e divulgado */

/**
 * Nota do cartão do DEC e do FEC sobre o perímetro: o número da abertura é de todas as distribuidoras, e a ANEEL divulga o das concessionárias.
 * Vazio quando o ano não tem o recorte das concessionárias.
 */
export function notaPerimetroAbertura(g: QualidadeGold, ind: Indicador, idioma: Idioma = idiomaEnergia()): string {
  const a = anoBrasil(g, g.ano_referencia);
  const v = ind === "dec" ? a?.dec_concessionarias : a?.fec_concessionarias;
  if (!a || v === null || v === undefined) return "";
  const un = ind === "dec" ? " h" : "";
  return tx(`Só as concessionárias, como a ANEEL divulga: ${num(v, 2)}${un}.`, `Concession holders only, as ANEEL announces: ${num(v, 2, idioma)}${un}.`, idioma);
}

/** Nota curta do cartão de compensações: o total divulgado pela ANEEL, quando a soma dos dados abertos difere além da precisão divulgada. */
export function notaDivulgadoCartao(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  const d = a?.divulgado_aneel ?? null;
  if (!a || !d || d.valor === null || d.dentro_da_precisao_valor !== false) return "";
  return tx(
    `A ANEEL divulga ${reaisMilhoes(d.valor, 0)}: a diferença passa da precisão divulgada e não foi explicada.`,
    `ANEEL announces ${reaisMilhoes(d.valor, 0, idioma)}: the difference exceeds the announced precision and has not been explained.`,
    idioma,
  );
}

/* ---------------------------------------------------------------- reclamações: duas bases */

/** Taxa por mil UCs escrita na base de 100 mil UCs da Ouvidoria (só a base de exibição muda; a taxa da gold é a mesma). */
export function taxaNaBaseDaOuvidoria(porMilUcs: number | null | undefined): number | null {
  return porMilUcs === null || porMilUcs === undefined || !Number.isFinite(porMilUcs) ? null : porMilUcs * 100;
}

/* ---------------------------------------------------------------- definições no ponto de uso (texto visível) */

export function definicaoConjunto(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "Conjunto elétrico é uma subdivisão da área de uma distribuidora para a qual a ANEEL fixa limites de DEC e de FEC.",
    "A consumer set is a subdivision of a distribution utility's area for which ANEEL sets DEC and FEC limits.",
    idioma,
  );
}
export const DEFINICAO_CONJUNTO = definicaoConjunto("pt");
/** A mesma definição em poucas palavras, para o cartão da faixa de métricas (onde cada linha custa altura da primeira tela). */
export function definicaoConjuntoCurta(idioma: Idioma = idiomaEnergia()): string {
  return tx("Conjunto elétrico: subdivisão da área de uma distribuidora, com limites próprios.", "Consumer set: a subdivision of a distribution utility's area, with its own limits.", idioma);
}
export const DEFINICAO_CONJUNTO_CURTA = definicaoConjuntoCurta("pt");
export function definicaoLimitesIndividuais(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "Os limites individuais valem para cada unidade consumidora: DIC (duração de interrupção individual), FIC (frequência de interrupção individual), DMIC (duração máxima de interrupção contínua), DICRI (duração da interrupção individual ocorrida em dia crítico) e DISE (duração da interrupção individual ocorrida em situação de emergência).",
    "Individual limits apply to each consumer unit: DIC (individual interruption duration), FIC (individual interruption frequency), DMIC (maximum continuous interruption duration), DICRI (duration of an individual interruption on a critical day) and DISE (duration of an individual interruption in an emergency situation).",
    idioma,
  );
}
export const DEFINICAO_LIMITES_INDIVIDUAIS = definicaoLimitesIndividuais("pt");

/* ---------------------------------------------------------------- texto para o leitor: sem marcação crua nem nome interno */

/**
 * Nomes de campo e termos internos que não são palavras do leitor, e o que vai no lugar. As trocas entram no meio de texto da gold,
 * que é português (na página inglesa ele sai marcado como só em português), então o que vai no lugar também é português.
 */
const TERMOS_INTERNOS: [RegExp, string][] = [
  // "(dec, fec)" e "(dec_concessionarias, fec_concessionarias)": só nomes de campo entre parênteses
  [/\s*\(\s*(?:(?:dec|fec)(?:_[a-z]+)?)(?:\s*,\s*(?:dec|fec)(?:_[a-z]+)?)*\s*\)/g, ""],
  [/\s*\((?:Nie|NumOcorr)\)/g, ""],
  [/vai em dec_concessionarias e fec_concessionarias/g, "aparece à parte"], // i18n: dado
  [/\bdec_concessionarias\b/g, "DEC das concessionárias"], // i18n: dado
  [/\bfec_concessionarias\b/g, "FEC das concessionárias"], // i18n: dado
  [/\bNumCon\b/g, "número de UCs informado"], // i18n: dado
  [/\bnão expurgável\b/g, "que a regra não exclui"], // i18n: dado
  [/\bNumOcorr\b/g, "total de ocorrências"], // i18n: dado
  [/\bNie\b/g, "ocorrências com interrupção"], // i18n: dado
  [/\bo silver\b/g, "a base tratada"], // i18n: dado
  [/\bsilver\b/g, "base tratada"], // i18n: dado
  [/\bbronze\b/g, "arquivo original"], // i18n: dado
  [/\bhoje (\d{4}-\d{2}-\d{2})/g, "processamento em $1"], // i18n: dado
];

/**
 * Texto de uma fonte ou de uma regra escrito para o leitor: tira a marcação copiada da fonte (__negrito__, _itálico_, itens com asterisco e
 * quebras de linha) e troca nomes de campo e termos internos (silver, bronze, NumCon, dec_concessionarias) por palavras comuns. Idempotente.
 */
export function paraLeitor(texto: string): string {
  let t = texto;
  t = t.replace(/__([^_\n]+?)__/g, "$1").replace(/(^|[\s(])_([^_\n]+?)_(?=[\s).,;:]|$)/g, "$1$2");
  t = t.replace(/\s*\n\s*\*\s+/g, (m, pos: number, todo: string) => (/(?:[;:,]|\s(?:e|ou))\s*$/.test(todo.slice(0, pos)) ? " " : "; "));
  t = t.replace(/\s*\n+\s*/g, " ");
  for (const [de, para] of TERMOS_INTERNOS) t = t.replace(de, para);
  return t.replace(/\s{2,}/g, " ").trim();
}

/** Corta um texto longo no fim de uma frase, com o aviso de que ele foi resumido (a descrição completa fica na página da fonte). */
export function resumirTexto(texto: string, max = 700): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const fim = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("; "));
  const base = fim >= max * 0.4 ? corte.slice(0, fim + 1) : corte.slice(0, corte.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "…";
  // o aviso fica junto do texto da fonte, que é português
  return `${base} (texto resumido; a descrição completa está na página da fonte)`; // i18n: dado
}

/** Ficha de origem com os textos escritos para o leitor (sem marcação crua nem termo interno) e a descrição longa da fonte resumida. */
export function limpaProveniencia<T extends Proveniencia>(p: T): T {
  return {
    ...p,
    notas_fonte: p.notas_fonte ? resumirTexto(paraLeitor(p.notas_fonte)) : p.notas_fonte,
    limitacoes: p.limitacoes.map(paraLeitor),
    transformacoes: p.transformacoes.map(paraLeitor),
    formula: p.formula ? paraLeitor(p.formula) : p.formula,
  };
}

/* ---------------------------------------------------------------- conjuntos do município (ficha do mapa) */

/**
 * Colunas da tabela dos conjuntos que atendem o município escolhido: os números primeiro (no celular a tabela rola para o lado e a primeira
 * coluna fica fixa), com os meses publicados logo depois do nome, para a soma parcial de um conjunto de menos de 12 meses não passar por anual.
 */
export function colunasConjuntosMunicipio(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const int = tx("interrupções", "interruptions", idioma);
  return [
    { id: "nome", rotulo: tx("Conjunto", "Consumer set", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "meses", rotulo: tx("Meses publicados", "Months published", idioma), tipo: "numero", casas: 0 },
    { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
    { id: "dec_limite", rotulo: tx("Limite de DEC", "DEC limit", idioma), tipo: "numero", unidade: "h", casas: 2 },
    { id: "razao_dec", rotulo: tx("DEC ÷ limite", "DEC ÷ limit", idioma), tipo: "numero", casas: 3 },
    { id: "fec", rotulo: "FEC", tipo: "numero", unidade: int, casas: 2 },
    { id: "fec_limite", rotulo: tx("Limite de FEC", "FEC limit", idioma), tipo: "numero", unidade: int, casas: 2 },
    { id: "razao_fec", rotulo: tx("FEC ÷ limite", "FEC ÷ limit", idioma), tipo: "numero", casas: 3 },
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", categorica: true, idiomaTexto: "nome" },
    { id: "situacao_dec", rotulo: tx("DEC diante do limite", "DEC against the limit", idioma), tipo: "texto", categorica: true },
    { id: "situacao_fec", rotulo: tx("FEC diante do limite", "FEC against the limit", idioma), tipo: "texto", categorica: true },
    { id: "conjunto", rotulo: tx("Código", "Code", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_CONJUNTOS_MUNICIPIO: ColunaTabela[] = colunasConjuntosMunicipio("pt");

/**
 * Linhas do ano (conjuntosDoCsv) dos conjuntos citados para o município, na ordem em que a base os cita, e os códigos que a base cita
 * mas que não têm valor anual nesse ano (nunca preenchidos com zero).
 */
export function conjuntosDoMunicipio(linhasAno: readonly LinhaTabela[], codigos: readonly string[]): { linhas: LinhaTabela[]; semValor: string[] } {
  const porCodigo = new Map(linhasAno.map((l) => [String(l.conjunto), l]));
  const linhas: LinhaTabela[] = [];
  const semValor: string[] = [];
  for (const c of codigos) {
    const l = porCodigo.get(c);
    if (l) linhas.push(l);
    else semValor.push(c);
  }
  return { linhas, semValor };
}

/** O que o mapa pinta num município com vários conjuntos: o maior ou o menor deles, com o número de conjuntos que a base cita. */
export function textoCorDoMapa(m: MunicipioQualidade, medida: MedidaMapa, idioma: Idioma = idiomaEnergia()): string {
  const maior = medida.endsWith("max");
  const valor = m[medida];
  if (valor === null || !m.conjuntos.length) return "";
  const un = medida.startsWith("dec") ? `${num(valor, 2, idioma)} h` : tx(`${num(valor, 2)} interrupções`, `${num(valor, 2, idioma)} interruptions`, idioma);
  if (m.conjuntos.length === 1) return tx(`Cor do mapa: o valor do único conjunto citado, ${un}.`, `Map color: the value of the only consumer set listed, ${un}.`, idioma);
  return tx(
    `Cor do mapa: ${maior ? "o maior" : "o menor"} valor entre os ${num(m.conjuntos.length, 0)} conjuntos citados, ${un}.`,
    `Map color: the ${maior ? "highest" : "lowest"} value among the ${num(m.conjuntos.length, 0, idioma)} consumer sets listed, ${un}.`,
    idioma,
  );
}

/**
 * O efeito da cobertura parcial do FEC no número nacional: o FEC do ano de referência e a soma das parcelas internas, comparados nas duas
 * casas publicadas. Vazio sem as duas.
 */
export function textoFecBrasilConfere(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const a = anoBrasil(g, g.ano_referencia);
  const parcelas = a?.parcelas_fec?.apurado ?? null;
  if (!a || a.fec === null || parcelas === null) return "";
  return centesimos(a.fec) === centesimos(parcelas)
    ? tx(
        `No Brasil, o FEC de ${a.ano} (${num(a.fec, 2)}) e a soma das parcelas internas coincidem nas duas casas: a ressalva não muda o número nacional.`,
        `In Brazil, the FEC of ${a.ano} (${num(a.fec, 2, idioma)}) and the sum of the internal components match to two decimals: the caveat does not change the national number.`,
        idioma,
      )
    : tx(
        `No Brasil, o FEC de ${a.ano} (${num(a.fec, 2)}) difere da soma das parcelas internas (${num(parcelas, 2)}).`,
        `In Brazil, the FEC of ${a.ano} (${num(a.fec, 2, idioma)}) differs from the sum of the internal components (${num(parcelas, 2, idioma)}).`,
        idioma,
      );
}

/**
 * Na ficha do município: conjuntos citados com menos de 12 meses de DEC ou de FEC. O arquivo de municípios calcula o intervalo de DEC e de FEC
 * só com os conjuntos de 12 meses; a tabela mostra todos os citados, e esta frase diz quais ficam fora do intervalo (nunca o valor parcial como se fosse anual).
 */
export function textoMesesIncompletos(linhas: readonly LinhaTabela[], idioma: Idioma = idiomaEnergia()): string {
  const dec = linhas.filter((l) => typeof l.meses === "number" && l.meses < 12).length;
  // a situação do FEC vem de situacaoFecDoConjunto, no idioma da página
  const fec = linhas.filter((l) => typeof l.situacao_fec === "string" && /meses de FEC|months of FEC/.test(l.situacao_fec)).length;
  if (!dec && !fec) return "";
  const partes = [
    dec ? tx(`${num(dec, 0)} com menos de 12 meses de DEC`, `${num(dec, 0, idioma)} with fewer than 12 months of DEC`, idioma) : null,
    fec ? tx(`${num(fec, 0)} com menos de 12 meses de FEC`, `${num(fec, 0, idioma)} with fewer than 12 months of FEC`, idioma) : null,
  ].filter((x): x is string => !!x);
  return tx(
    `Dos ${num(linhas.length, 0)} conjuntos da tabela, ${listaPt(partes)}: mostram a soma dos meses publicados, sem razão, e não entram no intervalo de ${dec && fec ? "DEC e de FEC" : dec ? "DEC" : "FEC"} da frase acima.`,
    `Of the ${num(linhas.length, 0, idioma)} consumer sets in the table, ${listaPt(partes, idioma)}: they show the sum of the months published, without a ratio, and do not enter the ${dec && fec ? "DEC and FEC" : dec ? "DEC" : "FEC"} range of the sentence above.`,
    idioma,
  );
}

/* ================================================================ rodada 2: o que a segunda avaliação pediu */

/* ---------------------------------------------------------------- painel de limites: a frase acompanha o recorte */

/**
 * Frase do gráfico de limites que acompanha o recorte escolhido (indicador e grupo de distribuidoras). O painel tem um veredito nacional
 * dos conjuntos em DEC; esta frase diz o que o gráfico mostra agora: quantas distribuidoras do grupo passaram do limite agregado do
 * indicador e qual ficou mais longe dele. Compara em centésimos, como a ANEEL publica; quem não tem valor ou limite no ano fica fora da
 * conta e é contada à parte. Com FEC, a distribuidora de cobertura parcial (marca com asterisco) é dita, porque o valor dela tem ressalva.
 */
export function respostaRecorteLimites(
  itens: readonly ItemLimites[],
  ind: Indicador,
  classe: "c" | "p",
  ano: number,
  avisos: AvisosFec = {},
  idioma: Idioma = idiomaEnergia(),
): string {
  const nome = ind === "dec" ? "DEC" : "FEC";
  const un = unidadeIndicador(ind, idioma);
  const grupo = classe === "c" ? tx("concessionárias", "concession holders", idioma) : tx("permissionárias", "permit holders", idioma);
  const doGrupo = itens.filter((i) => i.classe === classe);
  const pares = doGrupo
    .map((i) => ({ i, v: ind === "dec" ? i.dec : i.fec, l: ind === "dec" ? i.decLim : i.fecLim }))
    .filter((x): x is { i: ItemLimites; v: number; l: number } => x.v !== null && x.l !== null);
  if (!pares.length)
    return tx(
      `Nenhuma das ${num(doGrupo.length, 0)} ${grupo} tem ${nome} e limite publicados em ${ano}.`,
      `None of the ${num(doGrupo.length, 0, idioma)} ${grupo} has ${nome} and a limit published in ${ano}.`,
      idioma,
    );
  const acima = pares.filter((x) => comparaNaPrecisao(x.v, x.l, 2) === "acima");
  const total = pares.length;
  const quantas =
    acima.length === 0
      ? tx(
          `Em ${ano}, nenhuma das ${num(total, 0)} ${grupo} com ${nome} e limite ficou acima do limite agregado de ${nome}.`,
          `In ${ano}, none of the ${num(total, 0, idioma)} ${grupo} with ${nome} and a limit was above the aggregate ${nome} limit.`,
          idioma,
        )
      : acima.length === total && total > 1
        ? tx(
            `Em ${ano}, todas as ${num(total, 0)} ${grupo} com ${nome} e limite ficaram acima do limite agregado de ${nome}.`,
            `In ${ano}, all ${num(total, 0, idioma)} ${grupo} with ${nome} and a limit were above the aggregate ${nome} limit.`,
            idioma,
          )
        : tx(
            `Em ${ano}, ${num(acima.length, 0)} de ${num(total, 0)} ${grupo} com ${nome} e limite ${acima.length === 1 ? "ficou" : "ficaram"} acima do limite agregado de ${nome}.`,
            `In ${ano}, ${num(acima.length, 0, idioma)} of ${num(total, 0, idioma)} ${grupo} with ${nome} and a limit ${acima.length === 1 ? "was" : "were"} above the aggregate ${nome} limit.`,
            idioma,
          );
  let maior = "";
  if (acima.length) {
    const m = acima.reduce((a, x) => (x.v - x.l > a.v - a.l ? x : a));
    const parcial =
      ind === "fec" && avisos[m.i.id] ? tx(" (FEC de cobertura parcial, marcado com asterisco)", " (FEC with partial coverage, marked with an asterisk)", idioma) : "";
    maior = tx(
      ` A mais distante do limite é a ${m.i.rotulo}${parcial}: ${num(m.v, 2)} ${un} para um limite de ${num(m.l, 2)}.`,
      ` The furthest from the limit is ${m.i.rotulo}${parcial}: ${num(m.v, 2, idioma)} ${un} for a limit of ${num(m.l, 2, idioma)}.`,
      idioma,
    );
  }
  const comMarca = ind === "fec" ? acima.filter((x) => avisos[x.i.id]).length : 0;
  const marca =
    comMarca > 1
      ? tx(` ${num(comMarca, 0)} delas têm FEC de cobertura parcial, marcado com asterisco.`, ` ${num(comMarca, 0, idioma)} of them have FEC with partial coverage, marked with an asterisk.`, idioma)
      : "";
  const sem = doGrupo.length - total;
  const fora =
    sem > 0
      ? tx(
          ` ${num(sem, 0)} sem valor ou sem limite no ano ${sem === 1 ? "fica" : "ficam"} só na tabela.`,
          ` ${num(sem, 0, idioma)} with no value or no limit in the year ${sem === 1 ? "appears" : "appear"} only in the table.`,
          idioma,
        )
      : "";
  return `${quantas}${maior}${marca}${fora}`;
}

/* ---------------------------------------------------------------- compensações: o que a fonte deixou de publicar em 2022 */

export type QuebraCompensacao = {
  /** Primeiro ano do regime novo da fonte (o seguinte ao último ano em que os tipos que somem tinham valor para unidades consumidoras). */
  ano: number;
  /** Tipos de compensação que a fonte deixa de publicar para unidades consumidoras nesse ano. */
  somem: TipoCompensacao[];
  antes: { ano: number; valorUc: number | null; quantidadeUc: number | null };
  depois: { ano: number; valorUc: number | null; quantidadeUc: number | null };
};

/**
 * Quebra de regime da série de compensações: tipos que tinham valor para unidades consumidoras e deixam de tê-lo, enquanto a série
 * continua. O ano vem da própria série (o último ano com valor mais um), nunca escrito à mão; tipo que só aparece no fim (DISE, no ano
 * corrente) não é quebra. Nulo quando nenhum tipo some ou quando falta um ano completo de cada lado.
 */
export function quebraCompensacao(g: QualidadeGold): QuebraCompensacao | null {
  const anual = g.compensacoes.anual;
  const completos = anual.filter((a) => a.completo);
  if (!completos.length) return null;
  const ultimoCompleto = Math.max(...completos.map((a) => a.ano));
  const ultimoComValor = (t: TipoCompensacao): number | null => {
    const anos = completos.filter((a) => (a.por_tipo[t]?.valor_uc ?? 0) > 0).map((a) => a.ano);
    return anos.length ? Math.max(...anos) : null;
  };
  const somem = ORDEM_TIPOS.filter((t) => {
    const u = ultimoComValor(t);
    return u !== null && u < ultimoCompleto;
  });
  if (!somem.length) return null;
  const ano = Math.min(...somem.map((t) => (ultimoComValor(t) as number) + 1));
  const antes = completos.find((a) => a.ano === ano - 1);
  const depois = completos.find((a) => a.ano === ano);
  if (!antes || !depois) return null;
  const cor = (a: typeof antes) => ({ ano: a.ano, valorUc: a.valor_uc, quantidadeUc: a.quantidade_uc });
  return { ano, somem: somem.filter((t) => (ultimoComValor(t) as number) + 1 === ano), antes: cor(antes), depois: cor(depois) };
}

/** Os tipos que somem, por extenso ("trimestrais e anuais"), para a frase e a legenda. */
function tiposQueSomem(q: QuebraCompensacao, idioma: Idioma = idiomaEnergia()): string {
  const plural: Record<TipoCompensacao, string> = {
    mensal: tx("mensais", "monthly", idioma),
    trimestral: tx("trimestrais", "quarterly", idioma),
    anual: tx("anuais", "annual", idioma),
    dicri: tx("de DICRI", "DICRI", idioma),
    dise: tx("de DISE", "DISE", idioma),
  };
  return listaPt(q.somem.map((t) => plural[t]), idioma);
}

/**
 * Aviso da quebra de 2022 junto do gráfico anual e da frase do maior total: o que a fonte deixou de publicar, o salto da quantidade e do
 * valor ao cruzar o ano (neutro: os dois números, sem dizer que houve queda ou alta real) e o que isso impede, comparar anos dos dois
 * regimes. Vazio quando a série não tem a quebra.
 */
export function textoQuebraCompensacao(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const q = quebraCompensacao(g);
  if (!q) return "";
  const qa = q.antes.quantidadeUc;
  const qd = q.depois.quantidadeUc;
  const tipos = tiposQueSomem(q, idioma);
  const numeros =
    qa !== null && qd !== null
      ? tx(
          ` A quantidade vai de ${num(qa / 1e6, 1)} milhões em ${q.antes.ano} para ${num(qd / 1e6, 1)} milhões em ${q.depois.ano}, e o valor de ${reaisMilhoes(q.antes.valorUc)} para ${reaisMilhoes(q.depois.valorUc)}.`,
          ` The quantity goes from ${num(qa / 1e6, 1, idioma)} million in ${q.antes.ano} to ${num(qd / 1e6, 1, idioma)} million in ${q.depois.ano}, and the amount from ${reaisMilhoes(q.antes.valorUc, 1, idioma)} to ${reaisMilhoes(q.depois.valorUc, 1, idioma)}.`,
          idioma,
        )
      : "";
  return tx(
    `Desde ${q.ano}, a fonte não publica mais as compensações ${tipos} a unidades consumidoras: a série muda de regime.${numeros} Não leia a diferença como queda das compensações; anos de antes e de depois de ${q.ano} não se comparam.`,
    `Since ${q.ano}, the source no longer publishes the ${tipos} compensation payments to consumer units: the series changes regime.${numeros} Do not read the difference as a fall in compensation payments; years before and after ${q.ano} are not comparable.`,
    idioma,
  );
}

/** Versão de uma linha, para a legenda do gráfico e a nota da tabela. */
export function textoQuebraCompensacaoCurto(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const q = quebraCompensacao(g);
  if (!q) return "";
  const tipos = tiposQueSomem(q, idioma);
  return tx(
    `Desde ${q.ano} a fonte não publica as compensações ${tipos} a unidades consumidoras: antes e depois não se comparam.`,
    `Since ${q.ano} the source does not publish the ${tipos} compensation payments to consumer units: before and after are not comparable.`,
    idioma,
  );
}

/** Rótulos dos dois regimes do gráfico anual de compensações (a legenda diz onde a série muda), ou null sem a quebra. */
export function regimesCompensacao(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): { ano: number; antes: string; depois: string } | null {
  const q = quebraCompensacao(g);
  if (!q) return null;
  const tipos = tiposQueSomem(q, idioma);
  return {
    ano: q.ano,
    antes: tx(`Até ${q.antes.ano}: com as compensações ${tipos}`, `Up to ${q.antes.ano}: with the ${tipos} compensation payments`, idioma),
    depois: tx(`Desde ${q.ano}: sem as compensações ${tipos}`, `Since ${q.ano}: without the ${tipos} compensation payments`, idioma),
  };
}

/** Participação das unidades geradoras no total pago no ano de referência (o valor por UC divide UC e UG somadas). Vazio sem os dois valores. */
export function textoParticipacaoUg(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  if (!a || a.valor_ug === null || a.valor === null || a.valor <= 0) return "";
  return tx(
    `As unidades geradoras somam ${pct((a.valor_ug / a.valor) * 100, 1)} do valor pago em ${a.ano}.`,
    `Generating units account for ${pct((a.valor_ug / a.valor) * 100, 1, idioma)} of the amount paid in ${a.ano}.`,
    idioma,
  );
}

/**
 * A quantidade de compensações que a ANEEL divulga para o ano de referência, quando a soma dos dados abertos difere dela além da precisão
 * divulgada (a diferença não foi explicada). Vazio quando não há divulgação ou quando ela confere.
 */
export function notaQuantidadeDivulgada(g: QualidadeGold, idioma: Idioma = idiomaEnergia()): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  const d = a?.divulgado_aneel ?? null;
  if (!a || !d || d.quantidade === null || a.quantidade_uc === null || d.dentro_da_precisao_quantidade !== false) return "";
  return tx(
    `A ANEEL divulga ${num(d.quantidade / 1e6, 1)} milhões; a soma dos dados abertos é ${num(a.quantidade_uc / 1e6, 2)} milhões, diferença não explicada.`,
    `ANEEL announces ${num(d.quantidade / 1e6, 1, idioma)} million; the sum of the open data is ${num(a.quantidade_uc / 1e6, 2, idioma)} million, an unexplained difference.`,
    idioma,
  );
}

/* ---------------------------------------------------------------- conferência com o número divulgado: os anos que a conferência cobre */

/** Primeiro e último ano em que a gold confere o total de compensações com o que a ANEEL divulga (a conferência do DEC e do FEC nacionais cobre os mesmos anos). */
export function anosDivulgados(g: QualidadeGold): { de: number; ate: number } | null {
  const anos = g.compensacoes.anual.filter((a) => a.divulgado_aneel !== null).map((a) => a.ano);
  return anos.length ? { de: Math.min(...anos), ate: Math.max(...anos) } : null;
}

/**
 * A linha das concessionárias desde o primeiro ano em que todas as distribuidoras do ano têm classificação publicada, e os anos em que ela
 * foi conferida com o número que a ANEEL divulga (só esses): o universo é o mesmo nos anos anteriores, mas a conferência não vai tão longe.
 */
export function textoConcessionariasDesde(g: QualidadeGold, desde: number | null, idioma: Idioma = idiomaEnergia()): string {
  const conferido = anosDivulgados(g);
  const ate = conferido
    ? tx(
        ` A conferência com o número que a ANEEL divulga cobre ${conferido.de === conferido.ate ? conferido.de : `${conferido.de} a ${conferido.ate}`}.`,
        ` The check against the number ANEEL announces covers ${conferido.de === conferido.ate ? conferido.de : `${conferido.de} to ${conferido.ate}`}.`,
        idioma,
      )
    : "";
  if (desde === null)
    return tx(
      "A linha só das concessionárias não tem anos com todas as distribuidoras classificadas nesta publicação.",
      "The concession-holders-only line has no years with all distribution utilities classified in this release.",
      idioma,
    );
  return tx(
    `A linha das concessionárias começa em ${desde}, o primeiro ano com todas as distribuidoras classificadas, e usa o universo do número que a ANEEL divulga.${ate}`,
    `The concession holders line starts in ${desde}, the first year with all distribution utilities classified, and uses the universe of the number ANEEL announces.${ate}`,
    idioma,
  );
}

/* ---------------------------------------------------------------- município sem dado: para onde ir */

/**
 * Orientação para quem mora num município que o mapa deixa sem valor: sem dado não quer dizer sem energia, e a pessoa precisa saber a quem
 * perguntar. Vazio quando o município tem valor. O link para a página Conta de luz (que acha a distribuidora pelo município) fica no componente.
 */
/**
 * O que os números da resposta do município são, em uma frase de leitor: do conjunto inteiro, do menor ao maior dos conjuntos, nunca
 * uma média municipal (a fonte não diz quantas unidades de cada conjunto ficam no município), e médias por unidade.
 */
export function notaValoresMunicipio(m: Pick<MunicipioQualidade, "relacao" | "conjuntos">, idioma: Idioma = idiomaEnergia()): string {
  const medias = tx(" São médias por unidade consumidora: há casas bem acima delas.", " They are averages per consumer unit: some homes are well above them.", idioma);
  switch (m.relacao) {
    case "conjunto_exclusivo":
      return tx("Um conjunto elétrico atende só este município: os números são dele.", "One consumer set serves only this municipality: the figures are its own.", idioma) + medias;
    case "conjunto_compartilhado":
      return (
        tx(
          "O conjunto que atende o município também atende outros: os números são do conjunto inteiro, não medidos só aqui.",
          "The consumer set serving the municipality also serves others: the figures are for the whole set, not measured here alone.",
          idioma,
        ) + medias
      );
    default:
      return (
        tx(
          `${num(m.conjuntos.length, 0)} conjuntos atendem o município: os números vão do menor ao maior deles, e a ANEEL não publica média por município.`,
          `${num(m.conjuntos.length, 0, idioma)} consumer sets serve the municipality: the figures range from the lowest to the highest of them, and ANEEL does not publish a municipal average.`,
          idioma,
        ) + medias
      );
  }
}

export function orientacaoSemDado(m: Pick<MunicipioQualidade, "relacao">, idioma: Idioma = idiomaEnergia()): string {
  if (m.relacao !== "sem_relacao_na_fonte" && m.relacao !== "sem_conjunto_ativo") return "";
  return tx(
    "Sem dado não quer dizer sem energia: a base da ANEEL não traz um conjunto com DEC no ano para este município. Para saber qual distribuidora atende você, veja a sua conta de luz ou use a busca da página Conta de luz. Reclamações sobre falta de energia vão primeiro à distribuidora e, depois, à Ouvidoria da ANEEL.",
    "No data does not mean no power: the ANEEL database has no consumer set with DEC in the year for this municipality. To learn which distribution utility serves you, check your electricity bill or use the search on the Electricity bill page. Complaints about power outages go first to the distribution utility and then to the ANEEL Ombudsman.",
    idioma,
  );
}

/* ---------------------------------------------------------------- busca por município na primeira tela */

/** Município do CSV como a busca de regiões o lê (id, nome e UF), sem copiar o resto. */
export function regiaoDoMunicipio(m: Pick<MunicipioQualidade, "cod" | "nome" | "uf">): { id: string; nome: string; uf: string } {
  return { id: m.cod, nome: m.nome, uf: m.uf };
}

/**
 * Resumo de uma linha do município escolhido na primeira tela: o intervalo dos conjuntos (nunca um DEC "do município") e o que fazer a
 * seguir. A ficha completa, com o limite de cada conjunto e o histórico, está na seção do mapa.
 */
export function resumoMunicipio(m: MunicipioQualidade, ano: number, idioma: Idioma = idiomaEnergia()): string {
  const lugar = `${m.nome} (${m.uf})`;
  const n2 = (v: number | null) => num(v, 2, idioma);
  const dec = m.dec_min === m.dec_max ? `${n2(m.dec_max)} h` : tx(`de ${n2(m.dec_min)} a ${n2(m.dec_max)} h`, `from ${n2(m.dec_min)} to ${n2(m.dec_max)} h`, idioma);
  const fec =
    m.fec_min === m.fec_max
      ? tx(`${n2(m.fec_max)} interrupções`, `${n2(m.fec_max)} interruptions`, idioma)
      : tx(`de ${n2(m.fec_min)} a ${n2(m.fec_max)} interrupções`, `from ${n2(m.fec_min)} to ${n2(m.fec_max)} interruptions`, idioma);
  switch (m.relacao) {
    case "sem_relacao_na_fonte":
      return tx(`${lugar} não aparece na base da ANEEL: sem valor em ${ano}.`, `${lugar} does not appear in the ANEEL database: no value in ${ano}.`, idioma);
    case "sem_conjunto_ativo":
      return tx(
        `${lugar} é citado na base da ANEEL, mas sem conjunto com DEC de 12 meses em ${ano}.`,
        `${lugar} is listed in the ANEEL database, but with no consumer set with a 12-month DEC in ${ano}.`,
        idioma,
      );
    case "conjunto_exclusivo":
    case "conjunto_compartilhado":
      return tx(
        `${lugar}: um conjunto atende o município, com DEC de ${dec} e FEC de ${fec} em ${ano}${m.relacao === "conjunto_compartilhado" ? " (valores do conjunto inteiro)" : ""}.`,
        `${lugar}: one consumer set serves the municipality, with a DEC of ${dec} and a FEC of ${fec} in ${ano}${m.relacao === "conjunto_compartilhado" ? " (values of the whole cluster)" : ""}.`,
        idioma,
      );
    default:
      return tx(
        `${lugar}: ${num(m.conjuntos.length, 0)} conjuntos atendem o município; em ${ano}, o DEC deles vai ${dec} e o FEC ${fec} (nenhuma média municipal).`,
        `${lugar}: ${num(m.conjuntos.length, 0, idioma)} consumer sets serve the municipality; in ${ano}, their DEC ranges ${dec} and their FEC ${fec} (no municipal average).`,
        idioma,
      );
  }
}

const municipiosLidos = new Map<string, Promise<MunicipioQualidade[]>>();

/**
 * Os municípios do CSV publicado, lidos e interpretados uma vez por visita: a busca da primeira tela e o mapa pedem o mesmo arquivo e
 * compartilham a mesma leitura, em vez de baixar e interpretar duas vezes. Falha não fica em cache.
 */
export function carregarMunicipios(url: string): Promise<MunicipioQualidade[]> {
  let p = municipiosLidos.get(url);
  if (!p) {
    p = carregarUmaVez(url, (r) => r.text()).then(municipiosDoCsv);
    municipiosLidos.set(url, p);
    p.catch(() => municipiosLidos.delete(url));
  }
  return p;
}
