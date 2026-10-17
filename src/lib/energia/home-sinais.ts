/**
 * Os sinais da página inicial: uma medida de abertura para cada pergunta prioritária (conta de luz, qualidade do serviço,
 * perdas, reservatórios, PLD e expansão) e as duas de acesso e desigualdade (Tarifa Social e domicílios sem energia). Cada seletor lê a mesma
 * gold que a página do módulo lê, pelas mesmas funções do módulo (conta.json, qualidade.ts, perdas.ts, agua.ts, pld.json, expansao.ts,
 * inclusao.json), e devolve só o resumo: um valor, a unidade, o período, o universo, a referência e a ressalva, mais a figura de referência
 * (a faixa em que o valor cai) quando a gold dá os elementos dela. Nenhuma série detalhada é carregada na inicial.
 *
 * Regras que valem para todos:
 *  - nenhum número é escrito aqui: o valor, a variação, as referências e a figura vêm da gold; a inicial e a página do módulo mostram o
 *    mesmo número porque leem o mesmo campo (a Visão geral lê esses mesmos caminhos, e o teste confere a igualdade);
 *  - ausência é um estado (`ausente`, quando o módulo existe e o valor falta; `indisponivel`, quando a gold do módulo não foi
 *    publicada), com o motivo em palavras; nunca vira zero, nunca é preenchida com outro período;
 *  - o período é o do dado (vigência, ano ou dia de referência), no grão em que a fonte o publica; a data de captura não entra;
 *  - a ficha "Comprove este número" só acompanha o número quando a gold publica a evidência dele e o valor dela confere com o
 *    exibido; a ficha é lida sob demanda (o JSON público da própria gold), então a inicial não carrega as fichas nas props. Quando a
 *    gold não publica a ficha, o sinal diz isso (`semFicha`) em vez de calar;
 *  - a precisão de um número é a da ficha dele (`valor_exibido`): a mesma que a Visão geral mostra, para o mesmo número não mudar de casa
 *    de uma página para outra.
 *
 * Cada seletor aceita a gold por parâmetro, para o teste exercitar a ausência com golds sintéticas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerGold, integra } from "./gold";
import { dataBR, nomeMes, nomeSubmercado, num, pct, reais } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import { traduzDaGold, valorProvaNoIdioma } from "./i18n/entrada-visao";
import { horasMinutos, minuscula as minusculaEn } from "./visao";
import { valorDestaque, type Evidencia, type FormatoNumero, type Variacao } from "./evidencia";
import { resumo as resumoDistribuicao } from "./distribuicao";
import { periodoLegivel } from "./home";
import { ID_SINAIS, ID_SINAIS_INCLUSAO, PERGUNTAS_DE_INCLUSAO, PERGUNTAS_PRIORITARIAS, type IdSinal, type IdSinalInclusao } from "./mapa";
import { horasEMinutos, anoBrasil, lerCsv } from "./qualidade";
import { SIGLAS } from "./siglas";
import { linhaNacional, variacaoMesmas } from "./perdas";
import { entidadesEar, periodoBase } from "./agua";
import { NOME_SM, SUBMERCADOS } from "./pld";
import { estagio, inteiro, mwTexto, dataTexto, temValor } from "./expansao";
import type { CatalogoGold, Natureza, PldGold } from "./tipos";
import type { ContaGold } from "./tipos-conta";
import type { QualidadeGold } from "./tipos-qualidade";
import type { OrigemInjetada, PerdasGold } from "./tipos-perdas";
import type { AguaDetalheGold } from "./tipos-agua";
import type { ExpansaoGold } from "./tipos-expansao";
import type { InclusaoGold } from "./tipos-inclusao";
import type { PldDetalheGold } from "./tipos-pld";
import type { GoldTerritorio } from "./tipos-territorio";
import type { SinteseVisaoGold } from "./tipos-visao";

/** Como a ficha "Comprove este número" encontra a evidência: o JSON público da gold e o caminho do objeto dentro dele. */
export type ProvaSinal = { url: string; caminho: string; indicador: string; valorExibido: string };

/** Identificador de um sinal: as seis perguntas prioritárias e as duas de acesso e desigualdade. */
export type IdDoSinal = IdSinal | IdSinalInclusao;

/**
 * A figura de referência de um número: onde ele cai na faixa que a gold dá, sem juízo de valor. `extremos` é a faixa observada (linha fina),
 * `caixa` a metade central (do primeiro ao terceiro quartil), `mediana` o traço fino, `valor` o número do cartão (losango) e `marca` uma
 * referência com nome, como um limite regulatório. A `legenda` diz os números em palavras: é o texto da figura, visível e lido pelo leitor de tela.
 */
export type FiguraReferencia = {
  extremos: [number, number];
  caixa?: [number, number];
  mediana?: number;
  valor: number;
  marca?: { valor: number; rotulo: string };
  legenda: string;
};

type Base = {
  id: IdDoSinal;
  /** O que se mede, em frase curta. */
  medida: string;
  natureza: Natureza;
};

export type SinalDisponivel = Base & {
  estado: "disponivel";
  valor: number;
  formato: FormatoNumero;
  casas: number;
  /** O número como a página o escreve, sem a unidade. */
  valorTexto: string;
  /** Unidade ao lado do número, sem repetir o que o formato já escreve. */
  unidade: string;
  /** Período do dado, no grão da fonte ("vigente em 30/09/2026", "ano de 2025", "29/09/2026"). */
  periodo: string;
  /** Universo e regra de agregação, em uma frase. */
  universo: string;
  /** Variação contra um período anterior comparável, quando a fonte publica os dois valores. */
  variacao: Variacao | null;
  /** Referências para ler a grandeza do número, uma frase cada. */
  referencias: string[];
  /** Ressalva essencial, junto do número. */
  ressalva: string;
  /** Ficha de prova sob demanda; null quando a gold não publica a evidência deste número. */
  prova: ProvaSinal | null;
  /** Ficha completa, no lugar da sob demanda, quando a inicial precisa descrever o número melhor que a gold (hoje só o denominador das perdas). */
  evidencia?: Evidencia;
  /** Onde o número está no módulo de origem: a citação da ficha aponta para lá. */
  endereco: string;
  /** Onde o número cai na faixa de referência que a gold publica; null quando a gold não dá a faixa. */
  figura: FiguraReferencia | null;
  /** O motivo de o número não ter ficha, dito junto dele; null quando tem ficha. */
  semFicha: string | null;
  /** Os arquivos CSV que a gold publica para refazer o número (os da própria ficha). */
  downloads: { rotulo: string; url: string }[];
};

export type SinalAusente = Base & {
  /** "ausente": o módulo existe e este valor falta; "indisponivel": a gold do módulo não foi publicada. */
  estado: "ausente" | "indisponivel";
  motivo: string;
  periodo: string | null;
};

export type SinalHome = SinalDisponivel | SinalAusente;

/* ------------------------------------------------------------------ apoio */

const enderecoDe = (id: IdDoSinal): string =>
  PERGUNTAS_PRIORITARIAS.find((p) => p.id === id)?.link.href ?? PERGUNTAS_DE_INCLUSAO.find((p) => p.id === id)?.link.href ?? "/setor-eletrico";

function ausente(id: IdDoSinal, medida: string, motivo: string, periodo: string | null = null, estado: SinalAusente["estado"] = "ausente"): SinalAusente {
  return { id, medida, natureza: "CALCULADO", estado, motivo, periodo };
}

/** O motivo da ausência como a gold o escreve; a gold só o tem em português, e a página inglesa usa o motivo padrão, em inglês. */
function motivoDaGold(g: { motivo?: string } | null, padrao: string): string {
  if (idiomaEnergia() === "en") return traduzDaGold(g?.motivo?.trim() ?? "") ?? padrao;
  return g?.motivo?.trim() ? g.motivo : padrao;
}

/** "2001-2025" em palavras ("2001 a 2025", "2001 to 2025"), como periodoBase de agua.ts, no idioma da página. */
function periodoDaBase(p: string | null | undefined): string {
  if (idiomaEnergia() !== "en") return periodoBase(p);
  if (!p) return "no base period";
  const [a, b] = p.split("-");
  return b && b !== a ? `${a} to ${b}` : a;
}

/** A evidência prova o número exibido: o valor de cálculo dela, na mesma escala, cai no arredondamento do valor mostrado. */
function provaConfere(ev: Pick<Evidencia, "valor_calculo"> | null | undefined, valor: number, casas: number, escala = 1): boolean {
  return !!ev && temValor(ev.valor_calculo) && Math.abs(ev.valor_calculo / escala - valor) <= 0.5 * 10 ** -casas + 1e-9;
}

function prova(url: string, caminho: string, medida: string, ev: Pick<Evidencia, "valor_exibido">): ProvaSinal {
  // o valor como a gold o escreve, na grafia do idioma (o leitor de tela lê o botão da ficha)
  return { url, caminho, indicador: medida, valorExibido: valorProvaNoIdioma(ev.valor_exibido, idiomaEnergia()) };
}

/** Os CSV da própria ficha: rótulo e endereço, sem repetir o mesmo arquivo. */
function arquivosDaFicha(ev: Pick<Evidencia, "download"> | null | undefined): { rotulo: string; url: string }[] {
  const vistos = new Set<string>();
  const saida: { rotulo: string; url: string }[] = [];
  for (const d of ev?.download ?? []) {
    if (!d?.url || vistos.has(d.url)) continue;
    vistos.add(d.url);
    saida.push({ rotulo: d.rotulo, url: d.url });
  }
  return saida;
}

const kwh = (rsMwh: number) => reais(rsMwh / 1000, 4);

/** A primeira letra em minúscula, para uma frase da gold entrar no meio de outra. */
const minuscula = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

/* ------------------------------------------------------------------ 1. conta de luz */

const MEDIDA_CONTA = () => tx("Tarifa residencial mediana entre as distribuidoras", "Median residential tariff across distribution utilities");

/** Perfil de consumo de referência da tarifa: o do meio da lista que o módulo publica (200 kWh, quando a lista é 100, 200 e 300). */
function perfilDeReferencia(perfis: readonly number[]): number | null {
  if (!perfis.length) return null;
  return perfis.includes(200) ? 200 : perfis[Math.floor(perfis.length / 2)];
}

/**
 * A mediana da tarifa com cada distribuidora pesando pelas suas unidades consumidoras (as do DEC do ano mais recente da gold de Qualidade):
 * a primeira tarifa, em ordem crescente, em que a soma acumulada das unidades alcança metade do total. Só vale quando TODAS as distribuidoras
 * com tarifa em vigor têm unidades consumidoras publicadas; com uma faltando, o peso dela seria inventado, e a função devolve null.
 */
export function medianaPonderadaPorUc(conta: ContaGold | null, qualidade: QualidadeGold | null): { valorMwh: number; n: number; ano: number; cobertura: number } | null {
  if (!integra(conta) || !integra(qualidade)) return null;
  const ano = qualidade.ano_referencia;
  const ucs = new Map<string, number>();
  for (const d of qualidade.distribuidoras) if (d.ano === ano && temValor(d.ucs) && d.ucs > 0) ucs.set(d.cnpj, d.ucs);
  const linhas: { t: number; u: number }[] = [];
  for (const v of conta.tarifas.vigentes) {
    const u = ucs.get(v.cnpj);
    if (!temValor(v.total) || u === undefined) return null;
    linhas.push({ t: v.total, u });
  }
  if (!linhas.length) return null;
  linhas.sort((x, y) => x.t - y.t);
  const total = linhas.reduce((a, l) => a + l.u, 0);
  let acumulado = 0;
  let mediana = linhas[linhas.length - 1].t;
  for (const l of linhas) {
    acumulado += l.u;
    if (acumulado >= total / 2) {
      mediana = l.t;
      break;
    }
  }
  const todas = Array.from(ucs.values()).reduce((a, b) => a + b, 0);
  return { valorMwh: mediana, n: linhas.length, ano, cobertura: todas > 0 ? total / todas : 0 };
}

export function sinalConta(g: ContaGold | null = lerGold<ContaGold>("conta.json"), qualidade: QualidadeGold | null = lerGold<QualidadeGold>("qualidade.json")): SinalHome {
  if (!integra(g)) return ausente("conta", MEDIDA_CONTA(), motivoDaGold(g, tx("A base publicada de Conta de luz não foi processada nesta publicação.", "The published Electricity bill base was not processed in this publication.")), null, "indisponivel");
  const r = g.tarifas.resumo;
  const data = dataBR(g.data_referencia);
  if (!temValor(r.mediana))
    return ausente(
      "conta",
      MEDIDA_CONTA(),
      tx(`Nenhuma distribuidora tem tarifa residencial em vigor em ${data} no arquivo da ANEEL.`, `No distribution utility has a residential tariff in force on ${data} in the ANEEL file.`),
      tx(`vigente em ${data}`, `in force on ${data}`),
    );
  const valor = r.mediana / 1000;
  const perfil = perfilDeReferencia(g.perfis_kwh);
  const custo = perfil === null ? null : r.perfis_mediana[String(perfil) as "100" | "200" | "300"];
  const referencias: string[] = [];
  if (perfil !== null && temValor(custo)) referencias.push(tx(`${num(perfil, 0)} kWh por mês custam ${reais(custo)} nessa tarifa.`, `${num(perfil, 0)} kWh per month cost ${reais(custo)} at this tariff.`));
  const ev = g.tarifas.evidencia_mediana;
  // as distribuidoras que ficam de fora (sem vigência cobrindo a data): o valor muda quando a ANEEL completa o arquivo
  const fora = (r.fora_vigencia_recente ?? 0) + (r.fora_sem_tarifa_ha_mais_de_90_dias ?? 0);
  const ponderada = medianaPonderadaPorUc(g, qualidade);
  const ponderacao = ponderada
    ? tx(
        `Cada distribuidora pesa igual. Pesada pelas unidades consumidoras de ${ponderada.ano}, a mediana seria ${kwh(ponderada.valorMwh)} por kWh.`,
        `Each distribution utility has the same weight. Weighted by the consumer units of ${ponderada.ano}, the median would be ${kwh(ponderada.valorMwh)} per kWh.`,
      )
    : tx(
        "Cada distribuidora pesa igual, sem ponderar pelas unidades consumidoras: pesada por elas, a mediana seria outra.",
        "Each distribution utility has the same weight, with no weighting by consumer units: weighted by them, the median would be different.",
      );
  const figura: FiguraReferencia | null =
    temValor(r.minimo) && temValor(r.maximo) && temValor(r.p25) && temValor(r.p75)
      ? {
          extremos: [r.minimo / 1000, r.maximo / 1000],
          caixa: [r.p25 / 1000, r.p75 / 1000],
          mediana: valor,
          valor,
          legenda: tx(
            `Entre as ${num(r.n, 0)} distribuidoras, de ${kwh(r.minimo)} a ${kwh(r.maximo)} por kWh; a metade central, de ${kwh(r.p25)} a ${kwh(r.p75)}.`,
            `Across the ${num(r.n, 0)} distribution utilities, from ${kwh(r.minimo)} to ${kwh(r.maximo)} per kWh; the middle half, from ${kwh(r.p25)} to ${kwh(r.p75)}.`,
          ),
        }
      : null;
  return {
    id: "conta",
    estado: "disponivel",
    medida: MEDIDA_CONTA(),
    natureza: "CALCULADO",
    valor,
    formato: "reais",
    casas: 4,
    valorTexto: valorDestaque(valor, "reais", 4),
    unidade: tx("por kWh", "per kWh"),
    periodo: tx(`vigente em ${data}`, `in force on ${data}`),
    universo: tx(
      `Mediana de ${num(r.n, 0)} distribuidoras com tarifa em vigor na data (grupo B1, residencial convencional)${
        fora > 0 ? `; outros ${num(fora, 0)} CNPJs ficam de fora por não terem vigência na data, e o valor muda quando a ANEEL completar o arquivo` : ""
      }.`,
      `Median of ${num(r.n, 0)} distribution utilities with a tariff in force on the date (group B1, conventional residential)${
        fora > 0 ? `; another ${num(fora, 0)} CNPJs are left out because they have no validity period on the date, and the value changes when ANEEL completes the file` : ""
      }.`,
    ),
    variacao: null,
    referencias,
    ressalva: tx(
      `${ponderacao} É a tarifa homologada de energia e de uso da rede, sem tributos, bandeira nem iluminação pública: não é o valor da fatura.`,
      `${ponderacao} It is the approved energy and network use tariff, without taxes, tariff flag or public lighting: it is not the amount on the bill.`,
    ),
    prova: provaConfere(ev, valor, 4, 1000) ? prova("/energia/gold/conta.json", "tarifas.evidencia_mediana", MEDIDA_CONTA(), ev) : null,
    endereco: enderecoDe("conta"),
    figura,
    semFicha: null,
    downloads: arquivosDaFicha(ev),
  };
}

/* ------------------------------------------------------------------ 2. qualidade do serviço */

const MEDIDA_QUALIDADE = () =>
  tx("Tempo médio sem energia por unidade consumidora (DEC)", "Average time without power per consumer unit (DEC, equivalent interruption duration per consumer unit)");

export function sinalQualidade(g: QualidadeGold | null = lerGold<QualidadeGold>("qualidade.json")): SinalHome {
  if (!integra(g)) return ausente("qualidade", MEDIDA_QUALIDADE(), motivoDaGold(g, tx("A base publicada de Qualidade do serviço não foi processada nesta publicação.", "The published Quality of supply base was not processed in this publication.")), null, "indisponivel");
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  if (!a || !temValor(a.dec)) {
    return ausente(
      "qualidade",
      MEDIDA_QUALIDADE(),
      tx(`Sem DEC nacional para ${ref}: o ano não tem os 12 meses nacionais completos publicados.`, `No national DEC for ${ref}: the year does not have all 12 complete national months published.`),
      tx(`ano de ${ref}`, `year ${ref}`),
    );
  }
  const ant = anoBrasil(g, ref - 1);
  const variacao: Variacao | null = ant && temValor(ant.dec) ? { valor: a.dec - ant.dec, casas: 2, sufixo: " h", referencia: tx(`contra ${ref - 1}`, `versus ${ref - 1}`) } : null;
  const todas = temValor(a.dec_todas_parcelas) ? a.dec_todas_parcelas : null;
  const ev = g.evidencias?.dec_brasil ?? null;
  // o universo do número nacional: as que têm DEC anual; as que enviaram só parte do ano ficam fora e são contadas à parte
  const doAno = g.distribuidoras.filter((d) => d.ano === ref);
  const comDec = doAno.filter((d) => temValor(d.dec));
  const parciais = doAno.length - comDec.length;
  const r = resumoDistribuicao(comDec.map((d) => d.dec));
  const limite = temValor(a.dec_limite) ? a.dec_limite : null;
  const figura: FiguraReferencia | null =
    r.n > 1 && r.min !== null && r.max !== null && r.p25 !== null && r.p75 !== null
      ? {
          extremos: [r.min, r.max],
          caixa: [r.p25, r.p75],
          ...(r.mediana !== null ? { mediana: r.mediana } : {}),
          valor: a.dec,
          ...(limite !== null ? { marca: { valor: limite, rotulo: tx("limite regulatório", "regulatory limit") } } : {}),
          legenda: tx(
            `Entre as ${num(r.n, 0)} distribuidoras, de ${num(r.min, 2)} h a ${num(r.max, 2)} h; a metade central, de ${num(r.p25, 2)} h a ${num(r.p75, 2)} h.${
              limite !== null ? ` O traço tracejado é o limite regulatório do DEC, ponderado pelas unidades consumidoras: ${num(limite, 2)} h.` : ""
            }`,
            `Across the ${num(r.n, 0)} distribution utilities, from ${num(r.min, 2)} h to ${num(r.max, 2)} h; the middle half, from ${num(r.p25, 2)} h to ${num(r.p75, 2)} h.${
              limite !== null ? ` The dashed line is the regulatory DEC limit, weighted by consumer units: ${num(limite, 2)} h.` : ""
            }`,
          ),
        }
      : null;
  return {
    id: "qualidade",
    estado: "disponivel",
    medida: MEDIDA_QUALIDADE(),
    natureza: "CALCULADO",
    valor: a.dec,
    formato: "num",
    casas: 2,
    valorTexto: valorDestaque(a.dec, "num", 2),
    unidade: tx("horas", "hours"),
    periodo: tx(`ano de ${ref}`, `year ${ref}`),
    universo: tx(
      `${num(comDec.length, 0)} distribuidoras com DEC anual de ${ref}, ponderado pelas unidades consumidoras${
        parciais > 0 ? `; outras ${num(parciais, 0)}, com dado de parte do ano, ficam de fora` : ""
      }.`,
      `${num(comDec.length, 0)} distribution utilities with an annual DEC for ${ref}, weighted by consumer units${
        parciais > 0 ? `; another ${num(parciais, 0)}, with data for part of the year, are left out` : ""
      }.`,
    ),
    variacao,
    referencias: [tx(`Equivale a ${horasEMinutos(a.dec)} por unidade consumidora.`, `Equivalent to ${horasMinutos(a.dec)} per consumer unit.`)],
    ressalva: tx(
      `Não conta as interrupções que a regra exclui${todas !== null ? `; contando todas, são ${num(todas, 2)} h` : ""}.`,
      `It does not count the interruptions that the rule excludes${todas !== null ? `; counting all of them, the total is ${num(todas, 2)} h` : ""}.`,
    ),
    prova: ev && provaConfere(ev, a.dec, 2) ? prova("/energia/gold/qualidade.json", "evidencias.dec_brasil", MEDIDA_QUALIDADE(), ev) : null,
    endereco: enderecoDe("qualidade"),
    figura,
    semFicha: null,
    downloads: arquivosDaFicha(ev),
  };
}

/* ------------------------------------------------------------------ 3. perdas */

const MEDIDA_PERDAS = () => tx("Perdas totais das concessionárias de distribuição", "Total losses of the distribution concession holders");

/** Quantas distribuidoras têm dado no ano de referência e quantas são concessionárias e permissionárias (o total nacional soma só as primeiras). */
export function universoPerdas(g: PerdasGold | null): { ano: number; total: number; concessionarias: number; permissionarias: number } | null {
  if (!integra(g)) return null;
  const ano = g.referencia.ano;
  const com = g.distribuidoras.filter((d) => d.referencia?.ano === ano);
  const concessionarias = com.filter((d) => d.grupo === "concessionaria").length;
  const permissionarias = com.filter((d) => d.grupo === "permissionaria").length;
  return concessionarias && permissionarias ? { ano, total: com.length, concessionarias, permissionarias } : null;
}

/** Texto de um CSV de public/energia/series, lido no build; arquivo ausente ou ilegível devolve null (a página mostra só o que as golds dão). */
function lerSerieCsv(nome: string): string | null {
  try {
    return readFileSync(join(process.cwd(), "public", "energia", "series", nome), "utf-8");
  } catch {
    return null;
  }
}

/**
 * O denominador da taxa nacional de perdas. A taxa é a soma das perdas sobre a "energia injetada de referência" de cada concessionária, e essa
 * referência não é a mesma coisa em todas: onde a ANEEL publica a linha de energia injetada, é ela; onde o leiaute de 2024 deixou de fechar o
 * balanço com a perda calculada pela fonte, é a energia requerida (fornecida mais irregular mais perdas), ou uma mistura dos dois no ano.
 * Este seletor conta quantas concessionárias do total estão em cada caso (campo `origem_injetada` da gold) e, com o arquivo anual por
 * distribuidora que a plataforma publica, soma a energia injetada publicada das mesmas concessionárias e refaz a taxa sobre ela.
 *
 * Só devolve valor quando o que lê concorda: a regra de entrada reproduz o total da gold, e cada linha do arquivo confere com a gold. Se não
 * concorda, não há comparação (null); se o arquivo falta, ficam as contagens e `publicadaTwh` é null.
 */
export type DenominadorDePerdas = {
  ano: number;
  /** Concessionárias que entram no total nacional. */
  n: number;
  /** Quantas têm a linha de energia injetada publicada pela ANEEL como referência, quantas a energia requerida e quantas uma mistura dos dois no ano. */
  nPublicada: number;
  nRequerida: number;
  nMista: number;
  /** Soma da energia injetada de referência (o denominador da taxa), em TWh. */
  referenciaTwh: number;
  /** Soma da energia injetada publicada pela fonte nas mesmas concessionárias, em TWh; null quando o arquivo não a traz para todas. */
  publicadaTwh: number | null;
  /** A taxa do número da página (sobre a referência), em %. */
  taxaPct: number;
  /** A mesma soma de perdas sobre a energia injetada publicada, em %. */
  taxaComPublicadaPct: number | null;
  /** A taxa de perdas totais de cada concessionária do total, em %: é a distribuição em que a taxa nacional cai. */
  taxasPct: number[];
};

export function denominadorDePerdas(g: PerdasGold | null = lerGold<PerdasGold>("perdas.json"), csv: string | null = lerSerieCsv("perdas_distribuidoras.csv")): DenominadorDePerdas | null {
  if (!integra(g)) return null;
  const ano = g.referencia.ano;
  const nac = linhaNacional(g, ano);
  if (!nac || !temValor(nac.taxa_total_pct) || !temValor(nac.injetada_mwh) || !temValor(nac.perdas_totais_mwh)) return null;
  const entram = g.distribuidoras.filter((d) => {
    const r = d.referencia;
    return d.grupo === "concessionaria" && !!r && r.ano === ano && r.completo && r.alertas.length === 0 && temValor(r.injetada_mwh) && temValor(r.perdas_totais_mwh);
  });
  // a regra de entrada precisa reproduzir o total da gold; se não reproduz, não há o que comparar
  if (entram.length !== nac.n_distribuidoras) return null;
  const conta = (o: OrigemInjetada) => entram.filter((d) => d.referencia?.origem_injetada === o).length;

  let publicada: number | null = null;
  if (csv) {
    const porCnpj = new Map(lerCsv(csv).filter((r) => r.ano === String(ano)).map((r) => [r.cnpj, r]));
    let soma = 0;
    let concorda = true;
    for (const d of entram) {
      const r = porCnpj.get(d.cnpj);
      const pub = r && r.injetada_publicada_mwh !== "" ? Number(r.injetada_publicada_mwh) : NaN;
      const ref = r && r.injetada_referencia_mwh !== "" ? Number(r.injetada_referencia_mwh) : NaN;
      // cada linha do arquivo precisa ser a da mesma publicação: a referência dela confere com a da gold (que a guarda em MWh inteiros)
      if (!Number.isFinite(pub) || !Number.isFinite(ref) || Math.abs(ref - d.referencia!.injetada_mwh!) > 1) {
        concorda = false;
        break;
      }
      soma += pub;
    }
    if (concorda && soma > 0) publicada = soma;
  }
  return {
    ano,
    n: entram.length,
    nPublicada: conta("publicada"),
    nRequerida: conta("requerida"),
    nMista: conta("mista"),
    referenciaTwh: nac.injetada_mwh / 1e6,
    publicadaTwh: publicada === null ? null : publicada / 1e6,
    taxaPct: nac.taxa_total_pct,
    taxaComPublicadaPct: publicada === null ? null : (100 * nac.perdas_totais_mwh) / publicada,
    taxasPct: entram.map((d) => d.referencia!.taxa_total_pct).filter((x): x is number => temValor(x)),
  };
}

/**
 * O denominador em palavras, em três tamanhos: uma frase para o sinal, o parágrafo do exemplo e o rótulo que a ficha mostra. As taxas saem com
 * uma casa decimal, a mesma do número da página e da ficha (14,7%): duas casas aqui faziam o mesmo número parecer outro.
 */
export function descreverDenominador(d: DenominadorDePerdas): { curta: string; completa: string; rotuloDaFicha: string } {
  const fora = d.nRequerida + d.nMista;
  const twh = (v: number) => `${num(v, 2)} TWh`;
  const ponto = (x: number) => (Math.abs(x) < 2 ? tx("ponto percentual", "percentage point") : tx("pontos percentuais", "percentage points"));
  const dif = d.taxaComPublicadaPct === null ? null : d.taxaPct - d.taxaComPublicadaPct;
  const comPublicada = d.taxaComPublicadaPct === null ? null : `${num(d.taxaComPublicadaPct, 1)}%`;
  const curta =
    fora === 0
      ? tx(
          `Em todas as ${d.n} concessionárias a energia injetada de referência é a linha que a ANEEL publica.`,
          `In all ${d.n} concession holders, the reference injected energy is the line that ANEEL publishes.`,
        )
      : tx(
          `Em ${fora} das ${d.n} concessionárias a base é a energia requerida, ou uma mistura dela com a energia injetada publicada${
            comPublicada ? `; sobre a injetada publicada, a taxa seria de ${comPublicada}` : ""
          }.`,
          `In ${fora} of the ${d.n} concession holders, the base is the required energy, or a mix of it with the published injected energy${
            comPublicada ? `; on the published injected energy, the rate would be ${comPublicada}` : ""
          }.`,
        );
  const completa =
    fora === 0
      ? tx(
          `O denominador é a energia injetada de referência, ${twh(d.referenciaTwh)} nas ${d.n} concessionárias, e em todas elas é a linha de energia injetada que a ANEEL publica.`,
          `The denominator is the reference injected energy, ${twh(d.referenciaTwh)} in the ${d.n} concession holders, and in all of them it is the injected energy line that ANEEL publishes.`,
        )
      : tx(
          `O denominador é a energia injetada de referência: ${twh(d.referenciaTwh)} nas ${d.n} concessionárias. Em ${d.nPublicada} delas é a linha de energia injetada que a ANEEL publica. Nas outras ${fora} essa linha deixou de fechar o balanço com a perda calculada pela fonte, sem explicação publicada, e a referência é a energia requerida, isto é, fornecida mais irregular mais perdas${
            d.nMista ? ` (em ${d.nMista} delas o ano mistura meses dos dois leiautes)` : ""
          }.${
            d.publicadaTwh !== null && comPublicada !== null && dif !== null
              ? ` Sobre a energia injetada publicada, ${twh(d.publicadaTwh)}, a mesma soma de perdas daria ${comPublicada}, e não ${num(d.taxaPct, 1)}%: uma diferença de ${num(Math.abs(dif), 1)} ${ponto(dif)}.`
              : " A energia injetada publicada, que daria outra taxa, não está disponível nesta publicação."
          }`,
          `The denominator is the reference injected energy: ${twh(d.referenciaTwh)} in the ${d.n} concession holders. In ${d.nPublicada} of them it is the injected energy line that ANEEL publishes. In the other ${fora}, that line no longer balances with the loss calculated by the source, with no published explanation, and the reference is the required energy, that is, energy supplied plus irregular consumption plus losses${
            d.nMista ? ` (in ${d.nMista} of them the year mixes months from both layouts)` : ""
          }.${
            d.publicadaTwh !== null && comPublicada !== null && dif !== null
              ? ` On the published injected energy, ${twh(d.publicadaTwh)}, the same sum of losses would give ${comPublicada}, not ${num(d.taxaPct, 1)}%: a difference of ${num(Math.abs(dif), 1)} ${ponto(dif)}.`
              : " The published injected energy, which would give a different rate, is not available in this publication."
          }`,
        );
  const rotuloDaFicha =
    fora === 0
      ? tx(`a linha de energia injetada publicada pela ANEEL nas ${d.n} concessionárias`, `the injected energy line published by ANEEL in the ${d.n} concession holders`)
      : tx(
          `em ${d.nPublicada} concessionárias, a linha de energia injetada publicada pela ANEEL; nas outras ${fora}, a energia requerida (fornecida + irregular + perdas)${
            d.publicadaTwh !== null && comPublicada ? `; sobre a energia injetada publicada, ${twh(d.publicadaTwh)}, a taxa seria de ${comPublicada}` : ""
          }`,
          `in ${d.nPublicada} concession holders, the injected energy line published by ANEEL; in the other ${fora}, the required energy (supplied + irregular + losses)${
            d.publicadaTwh !== null && comPublicada ? `; on the published injected energy, ${twh(d.publicadaTwh)}, the rate would be ${comPublicada}` : ""
          }`,
        );
  return { curta, completa, rotuloDaFicha };
}

/**
 * A ficha do número com o denominador nomeado. A evidência que a gold publica descreve o denominador só como "energia injetada de referência";
 * na inicial a descrição ganha a origem dele. O valor, o numerador, a fórmula, os testes e o arquivo da fonte ficam como a gold os publica, e
 * a troca só acontece quando o denominador da ficha é a mesma soma que o seletor refez (nunca por aproximação grosseira).
 */
export function evidenciaComDenominadorNomeado<E extends Evidencia>(ev: E, d: DenominadorDePerdas | null): E {
  const den = ev.denominador;
  if (!d || !den || !temValor(den.valor) || Math.abs(den.valor / 1e6 - d.referenciaTwh) > 0.005) return ev;
  return { ...ev, denominador: { ...den, descricao: `${den.descricao}: ${descreverDenominador(d).rotuloDaFicha}` } };
}

/**
 * A quebra de metodologia da fonte que cai no ano do número: o que o catálogo registra para o conjunto do balanço do SAMP na virada para o ano de
 * referência (hoje, 01/01/2025: a ANEEL passa a calcular a energia requerida sobre o mercado medido, e não o faturado, pelo Despacho 1.220/2025).
 * A comparação com o ano anterior atravessa essa data, e a inicial a diz junto da variação. Null quando o catálogo não registra quebra nessa data.
 */
export function quebraDaBaseDePerdas(ano: number, catalogo: CatalogoGold | null = lerGold<CatalogoGold>("catalogo.json")): { data: string; descricao: string } | null {
  if (!catalogo || !Array.isArray(catalogo.entradas)) return null;
  const entrada = catalogo.entradas.find((e) => e.slug === "aneel-samp-balanco" || e.id === "aneel:samp-balanco");
  const q = entrada?.quebras?.find((x) => x.data === `${ano}-01-01` && x.origem === "FONTE");
  return q ? { data: q.data, descricao: q.descricao } : null;
}

export function sinalPerdas(
  g: PerdasGold | null = lerGold<PerdasGold>("perdas.json"),
  csv: string | null = lerSerieCsv("perdas_distribuidoras.csv"),
  catalogo: CatalogoGold | null = lerGold<CatalogoGold>("catalogo.json"),
): SinalHome {
  if (!integra(g)) return ausente("perdas", MEDIDA_PERDAS(), motivoDaGold(g, tx("A base publicada de Perdas não foi processada nesta publicação.", "The published Losses base was not processed in this publication.")), null, "indisponivel");
  const ano = g.referencia.ano;
  const nac = linhaNacional(g, ano);
  if (!nac || !temValor(nac.taxa_total_pct)) {
    return ausente(
      "perdas",
      MEDIDA_PERDAS(),
      tx(`Sem taxa nacional de perdas para ${ano}: nenhuma concessionária tem os 12 meses do ano sem alerta.`, `No national loss rate for ${ano}: no concession holder has all 12 months of the year without an alert.`),
      tx(`ano de ${ano}`, `year ${ano}`),
    );
  }
  const u = universoPerdas(g);
  const mesmas = nac.mesmas_ano_anterior;
  const dif = mesmas ? variacaoMesmas(mesmas.taxa_total_pct) : null;
  const variacao: Variacao | null =
    mesmas && dif !== null
      ? { valor: dif, casas: 2, sufixo: " p.p.", referencia: tx(`contra ${ano - 1}, nas mesmas ${num(mesmas.n_total, 0)} concessionárias`, `versus ${ano - 1}, in the same ${num(mesmas.n_total, 0)} concession holders`) }
      : null;
  const ev = g.evidencias?.taxa_nacional ?? null;
  // o número exibido é o da ficha (14,7%): o valor sem arredondar vem da própria evidência, e não do campo da série nacional, que já traz duas casas
  const valor = ev && temValor(ev.valor_calculo) && Math.abs(ev.valor_calculo - nac.taxa_total_pct) <= 0.006 ? ev.valor_calculo : nac.taxa_total_pct;
  const casas = 1;
  const confere = !!ev && provaConfere(ev, valor, casas);
  const den = denominadorDePerdas(g, csv);
  // a base do denominador entra no rótulo do número: quando alguma concessionária usa a energia requerida, "da energia injetada" sozinho não diz a base
  const baseMista = !!den && den.nRequerida + den.nMista > 0;
  const quebra = quebraDaBaseDePerdas(ano, catalogo);
  const referencias: string[] = [];
  if (quebra) {
    const descricaoEn = traduzDaGold(quebra.descricao);
    referencias.push(
      tx(
        `Em ${dataBR(quebra.data)}, ${minuscula(quebra.descricao.replace(/\.$/, ""))}: a comparação com ${ano - 1} atravessa essa mudança.`,
        descricaoEn
          ? `On ${dataBR(quebra.data)}, ${minusculaEn(descricaoEn.replace(/\.$/, ""))}: the comparison with ${ano - 1} crosses this change.`
          : `On ${dataBR(quebra.data)}, the source changed its methodology for this base: the comparison with ${ano - 1} crosses this change.`,
      ),
    );
  }
  if (den) referencias.push(descreverDenominador(den).curta);
  const r = den ? resumoDistribuicao(den.taxasPct) : null;
  const figura: FiguraReferencia | null =
    r && r.n > 1 && r.min !== null && r.max !== null && r.p25 !== null && r.p75 !== null
      ? {
          extremos: [r.min, r.max],
          caixa: [r.p25, r.p75],
          ...(r.mediana !== null ? { mediana: r.mediana } : {}),
          valor,
          legenda: tx(
            `Entre as ${num(r.n, 0)} concessionárias, de ${pct(r.min, 1)} a ${pct(r.max, 1)}; a metade central, de ${pct(r.p25, 1)} a ${pct(r.p75, 1)}. A taxa nacional pesa cada uma pela energia que recebe; a mediana simples (${pct(r.mediana, 1)}) não.`,
            `Across the ${num(r.n, 0)} concession holders, from ${pct(r.min, 1)} to ${pct(r.max, 1)}; the middle half, from ${pct(r.p25, 1)} to ${pct(r.p75, 1)}. The national rate weights each one by the energy it receives; the simple median (${pct(r.mediana, 1)}) does not.`,
          ),
        }
      : null;
  return {
    id: "perdas",
    estado: "disponivel",
    medida: MEDIDA_PERDAS(),
    natureza: "CALCULADO",
    valor,
    formato: "pct",
    casas,
    valorTexto: valorDestaque(valor, "pct", casas),
    unidade: baseMista ? tx("da energia injetada ou requerida", "of injected or required energy") : tx("da energia injetada", "of injected energy"),
    periodo: tx(`ano de ${ano}`, `year ${ano}`),
    universo: tx(
      `${num(nac.n_distribuidoras, 0)} concessionárias com os 12 meses de ${ano} e sem alerta${
        u ? `; das ${num(u.total, 0)} distribuidoras com dado no ano, as ${num(u.permissionarias, 0)} permissionárias ficam fora deste total` : "; as permissionárias ficam fora deste total"
      }.`,
      `${num(nac.n_distribuidoras, 0)} concession holders with all 12 months of ${ano} and no alert${
        u ? `; of the ${num(u.total, 0)} distribution utilities with data for the year, the ${num(u.permissionarias, 0)} permit holders are left out of this total` : "; permit holders are left out of this total"
      }.`,
    ),
    variacao,
    referencias,
    ressalva: tx(
      "Soma perdas técnicas e não técnicas; perda não técnica não é sinônimo de furto.",
      "It adds technical and non-technical losses; a non-technical loss is not a synonym for theft.",
    ),
    prova: confere ? prova("/energia/gold/perdas.json", "evidencias.taxa_nacional", MEDIDA_PERDAS(), ev!) : null,
    // com o denominador refeito, a ficha vai completa e com ele nomeado; sem ele, vale a ficha lida sob demanda como a gold a publica
    ...(confere && den && ev!.denominador ? { evidencia: evidenciaComDenominadorNomeado(ev as unknown as Evidencia, den) } : {}),
    endereco: enderecoDe("perdas"),
    figura,
    semFicha: null,
    downloads: arquivosDaFicha(ev),
  };
}

/* ------------------------------------------------------------------ 4. reservatórios */

const MEDIDA_AGUA = () => tx("Energia armazenada no Sistema Interligado Nacional (SIN)", "Stored energy (EAR) in the National Interconnected System (SIN)");

/**
 * A EAR do SIN que a Visão geral mostra, quando o dia dela não é o do módulo Água e clima: as duas páginas leem capturas diferentes do ONS (a do
 * módulo é recapturada, a da Visão geral é a da síntese) e podem fechar em dias seguidos. Cada página diz o dia que usa, e esta frase diz qual
 * é o da outra, com o valor, para a diferença de um dia não parecer erro. Null quando o dia é o mesmo ou a síntese não tem o painel de água.
 */
export function earNaVisaoGeral(sintese: SinteseVisaoGold | null, diaDoModulo: string): string | null {
  const painel = integra(sintese) ? sintese.multiplos?.paineis.find((x) => x.id === "agua") : null;
  const dia = painel?.data_referencia ?? null;
  const v = painel?.valor_atual?.valor;
  if (!painel || !dia || dia === diaDoModulo || !temValor(v)) return null;
  return tx(`A Visão geral, de outra captura do ONS, traz ${pct(v, 1)} em ${dataBR(dia)}.`, `The Overview, from another ONS capture, shows ${pct(v, 1)} on ${dataBR(dia)}.`);
}

export function sinalAgua(g: AguaDetalheGold | null = lerGold<AguaDetalheGold>("agua_detalhe.json"), sintese: SinteseVisaoGold | null = lerGold<SinteseVisaoGold>("sintese.json")): SinalHome {
  if (!integra(g)) return ausente("agua", MEDIDA_AGUA(), motivoDaGold(g, tx("A base publicada de Água e clima não foi processada nesta publicação.", "The published Water and climate base was not processed in this publication.")), null, "indisponivel");
  const sin = entidadesEar(g.armazenamento).find((e) => e.tipo === "subsistema" && e.id === "SIN") ?? null;
  const dia = sin?.dia ?? g.dias_referencia.ear ?? null;
  if (!sin || !temValor(sin.ear_pct)) {
    return ausente(
      "agua",
      MEDIDA_AGUA(),
      tx(
        `Sem a energia armazenada do Sistema Interligado Nacional${dia ? ` em ${dataBR(dia)}` : " nesta publicação"}.`,
        `No stored energy for the National Interconnected System${dia ? ` on ${dataBR(dia)}` : " in this publication"}.`,
      ),
      dia ? dataBR(dia) : null,
    );
  }
  const variacao: Variacao | null = temValor(sin.variacao_30d_pp) ? { valor: sin.variacao_30d_pp, casas: 1, sufixo: " p.p.", referencia: tx("em 30 dias", "in 30 days") } : null;
  const ev = g.evidencias?.ear_sin ?? null;
  const referencias: string[] = [];
  const outraCaptura = dia ? earNaVisaoGeral(sintese, dia) : null;
  if (outraCaptura) referencias.push(outraCaptura);
  const figura: FiguraReferencia | null =
    temValor(sin.p10) && temValor(sin.p90) && temValor(sin.p50)
      ? {
          extremos: [sin.p10, sin.p90],
          mediana: sin.p50,
          valor: sin.ear_pct,
          legenda: tx(
            `No mesmo dia do ano, em ${periodoBase(sin.periodo_base)}, de ${pct(sin.p10, 1)} (percentil 10) a ${pct(sin.p90, 1)} (percentil 90), com mediana de ${pct(sin.p50, 1)}.${
              temValor(sin.percentil_na_data) ? ` O dia fica no percentil ${num(sin.percentil_na_data, 0)}.` : ""
            }`,
            `On the same day of the year, from ${periodoDaBase(sin.periodo_base)}, from ${pct(sin.p10, 1)} (10th percentile) to ${pct(sin.p90, 1)} (90th percentile), with a median of ${pct(sin.p50, 1)}.${
              temValor(sin.percentil_na_data) ? ` The day falls at percentile ${num(sin.percentil_na_data, 0)}.` : ""
            }`,
          ),
        }
      : null;
  return {
    id: "agua",
    estado: "disponivel",
    medida: MEDIDA_AGUA(),
    natureza: "CALCULADO",
    valor: sin.ear_pct,
    formato: "pct",
    casas: 1,
    valorTexto: valorDestaque(sin.ear_pct, "pct", 1),
    unidade: tx("da EAR máxima", "of maximum EAR"),
    periodo: dia ? dataBR(dia) : tx("dia não informado", "day not reported"),
    universo: tx(
      "Soma da energia armazenada dos quatro subsistemas sobre a soma das capacidades, e não a média dos percentuais.",
      "Sum of the stored energy of the four subsystems over the sum of their capacities, not the average of the percentages.",
    ),
    variacao,
    referencias,
    ressalva: sin.capacidade_mudou_na_base
      ? tx("O percentual não mede risco de desabastecimento, e a EAR máxima mudou ao longo da base.", "The percentage does not measure the risk of supply shortage, and the maximum EAR changed over the base period.")
      : tx("O percentual não mede risco de desabastecimento.", "The percentage does not measure the risk of supply shortage."),
    prova: ev && provaConfere(ev, sin.ear_pct, 1) ? prova("/energia/gold/agua_detalhe.json", "evidencias.ear_sin", MEDIDA_AGUA(), ev) : null,
    endereco: enderecoDe("agua"),
    figura,
    semFicha: null,
    downloads: arquivosDaFicha(ev),
  };
}

/* ------------------------------------------------------------------ 5. PLD */

const MEDIDA_PLD = () => tx("PLD médio do dia no Sudeste/Centro-Oeste", "Daily average spot price (PLD) in the Southeast/Center-West");

/** Hora de um instante "2026-09-30T06:00": "6 h" ("6:00" em inglês). Null quando o texto não traz a hora. */
function horaDe(instante: string | null | undefined): string | null {
  const m = instante ? /T(\d{2}):/.exec(instante) : null;
  // "hour 6", e não "6:00": o português escreve "6 h", e a hora não ganha um zero que o português não mostra
  return m ? tx(`${Number(m[1])} h`, `hour ${Number(m[1])}`) : null;
}

/** Evidência do mesmo número na Visão geral (o painel de preço lê pld.json#cartoes[SE].media_dia): só vale se o dia e o valor forem os mesmos. */
function evidenciaPldDaVisao(sintese: SinteseVisaoGold | null, dia: string, valor: number): { ev: Evidencia; indice: number } | null {
  const m = integra(sintese) ? sintese.multiplos : null;
  const i = m ? m.paineis.findIndex((p) => p.id === "preco") : -1;
  const p = m && i >= 0 ? m.paineis[i] : null;
  if (!p || !p.evidencia || p.data_referencia !== dia) return null;
  if (p.evidencia.entidade !== NOME_SM.SE || !provaConfere(p.evidencia, valor, 2)) return null;
  return { ev: p.evidencia as unknown as Evidencia, indice: i };
}

export function sinalPld(
  g: PldGold | null = lerGold<PldGold>("pld.json"),
  sintese: SinteseVisaoGold | null = lerGold<SinteseVisaoGold>("sintese.json"),
  detalhe: PldDetalheGold | null = lerGold<PldDetalheGold>("pld_detalhe.json"),
): SinalHome {
  if (!integra(g)) return ausente("pld", MEDIDA_PLD(), motivoDaGold(g, tx("A base publicada do PLD não foi processada nesta publicação.", "The published PLD base was not processed in this publication.")), null, "indisponivel");
  const dia = g.dia_referencia;
  const se = g.cartoes.find((c) => c.sm === "SE") ?? null;
  if (!se || !temValor(se.media_dia))
    return ausente(
      "pld",
      MEDIDA_PLD(),
      tx(`Sem a média do dia ${dataBR(dia)} no Sudeste/Centro-Oeste: o dia não tem as 24 horas publicadas.`, `No daily average for ${dataBR(dia)} in the Southeast/Center-West: the day does not have all 24 hours published.`),
      dataBR(dia),
    );
  // os outros submercados, cada um com o próprio nome e valor: nenhum "PLD Brasil" por média dos quatro
  const outros = SUBMERCADOS.filter((sm) => sm !== "SE")
    .map((sm) => {
      const c = g.cartoes.find((x) => x.sm === sm);
      return `${tx(NOME_SM[sm], nomeSubmercado(sm, "en"))} ${temValor(c?.media_dia) ? reais(c!.media_dia) : tx("sem dado", "no data")}`;
    })
    .join("; ");
  const referencias: string[] = [];
  // a média esconde a amplitude do dia: o menor e o maior preço por hora, com a hora de cada um
  if (temValor(se.min_hora) && temValor(se.max_hora)) {
    const hMin = horaDe(se.quando_min);
    const hMax = horaDe(se.quando_max);
    referencias.push(
      tx(
        `No dia, o preço por hora foi de ${reais(se.min_hora)}${hMin ? ` (às ${hMin})` : ""} a ${reais(se.max_hora)}${hMax ? ` (às ${hMax})` : ""}.`,
        `On the day, the hourly price ranged from ${reais(se.min_hora)}${hMin ? ` (at ${hMin})` : ""} to ${reais(se.max_hora)}${hMax ? ` (at ${hMax})` : ""}.`,
      ),
    );
  }
  referencias.push(tx(`Nos outros submercados: ${outros}.`, `In the other submarkets: ${outros}.`));
  // o dia contra os dias do mesmo mês da série, e contra todos: a mesma posição que a Visão geral mostra
  const posicao = integra(detalhe) ? detalhe.historico.posicao_referencia.find((x) => x.sm === "SE" && x.dia === dia) : undefined;
  const mm = posicao?.mesmo_mes;
  const figura: FiguraReferencia | null =
    mm && temValor(mm.p10) && temValor(mm.p90) && temValor(mm.p25) && temValor(mm.p75) && temValor(mm.p50)
      ? {
          extremos: [mm.p10, mm.p90],
          caixa: [mm.p25, mm.p75],
          mediana: mm.p50,
          valor: se.media_dia,
          legenda: tx(
            `Entre os ${num(mm.n_dias, 0)} dias de ${(mm.mes >= 1 && mm.mes <= 12 ? nomeMes(mm.mes, "pt", true) : undefined) ?? "mesmo mês"} da série, de ${reais(mm.p10)} (percentil 10) a ${reais(mm.p90)} (percentil 90); a metade central, de ${reais(mm.p25)} a ${reais(mm.p75)}.${
              temValor(mm.percentil) && temValor(se.posicao?.percentil) && temValor(se.posicao?.n_dias)
                ? ` A média do dia fica no percentil ${num(mm.percentil, 1)} entre esses dias e no ${num(se.posicao.percentil, 1)} entre todos os ${num(se.posicao.n_dias, 0)} dias da série.`
                : ""
            }`,
            `Across the ${num(mm.n_dias, 0)} days of ${mm.mes >= 1 && mm.mes <= 12 ? nomeMes(mm.mes, "en", true) : "the same month"} in the series, from ${reais(mm.p10)} (10th percentile) to ${reais(mm.p90)} (90th percentile); the middle half, from ${reais(mm.p25)} to ${reais(mm.p75)}.${
              temValor(mm.percentil) && temValor(se.posicao?.percentil) && temValor(se.posicao?.n_dias)
                ? ` The daily average falls at percentile ${num(mm.percentil, 1)} among those days and at ${num(se.posicao.percentil, 1)} among all ${num(se.posicao.n_dias, 0)} days in the series.`
                : ""
            }`,
          ),
        }
      : null;
  const daVisao = evidenciaPldDaVisao(sintese, dia, se.media_dia);
  return {
    id: "pld",
    estado: "disponivel",
    medida: MEDIDA_PLD(),
    natureza: "CALCULADO",
    valor: se.media_dia,
    formato: "reais",
    casas: 2,
    valorTexto: valorDestaque(se.media_dia, "reais", 2),
    unidade: tx("por MWh", "per MWh"),
    periodo: dataBR(dia),
    universo: tx("Média simples das 24 horas do dia, em valores nominais.", "Simple average of the 24 hours of the day, in nominal values."),
    variacao: null,
    referencias,
    ressalva: tx(
      "É o preço das diferenças liquidadas no mercado de curto prazo, e não a tarifa que a distribuidora cobra.",
      "It is the price of the differences settled in the short-term market, not the tariff that the distribution utility charges.",
    ),
    prova: daVisao ? prova("/energia/gold/sintese.json", `multiplos.paineis[${daVisao.indice}].evidencia`, MEDIDA_PLD(), daVisao.ev) : null,
    endereco: enderecoDe("pld"),
    figura,
    semFicha: null,
    downloads: arquivosDaFicha(daVisao?.ev),
  };
}

/* ------------------------------------------------------------------ 6. expansão */

const MEDIDA_EXPANSAO = () => tx("Usinas em construção, potência outorgada", "Plants under construction, granted capacity");

export function sinalExpansao(g: ExpansaoGold | null = lerGold<ExpansaoGold>("expansao.json"), territorio: GoldTerritorio | null = lerGold<GoldTerritorio>("territorio.json")): SinalHome {
  if (!integra(g)) return ausente("expansao", MEDIDA_EXPANSAO(), motivoDaGold(g, tx("A base publicada de Expansão não foi processada nesta publicação.", "The published Expansion base was not processed in this publication.")), null, "indisponivel");
  const data = dataTexto(g.estagios.data_referencia);
  const con = estagio(g, "construcao");
  if (!con || !temValor(con.mw_outorgado))
    return ausente("expansao", MEDIDA_EXPANSAO(), tx(`Sem a potência em construção no SIGA de ${data}.`, `No capacity under construction in the SIGA of ${data}.`), data);
  const op = estagio(g, "operacao");
  const nao = estagio(g, "construcao_nao_iniciada");
  const referencias: string[] = [];
  if (op && temValor(op.mw_fiscalizado)) {
    // a contagem de usinas em operação inclui os registros de até 10 kW, que o Território conta à parte: o cartão diz as duas contagens
    const reg = integra(territorio) ? territorio.resumo.usinas : null;
    const registros = reg && temValor(reg.registros_ate_10kw) && reg.registros_ate_10kw > 0 && reg.registros_ate_10kw <= op.usinas ? reg : null;
    referencias.push(
      tx(
        `Em operação, no mesmo cadastro: ${mwTexto(op.mw_fiscalizado)} fiscalizados em ${inteiro(op.usinas)} usinas${
          registros
            ? `; ${inteiro(registros.registros_ate_10kw)} delas (${num((100 * registros.registros_ate_10kw) / op.usinas, 0)}%) são registros de até ${num(registros.limite_registro_kw, 0)} kW, que o Território conta à parte (sem eles, ${inteiro(op.usinas - registros.registros_ate_10kw)})`
            : ""
        }.`,
        `In operation, in the same registry: ${mwTexto(op.mw_fiscalizado)} inspected in ${inteiro(op.usinas)} plants${
          registros
            ? `; ${inteiro(registros.registros_ate_10kw)} of them (${num((100 * registros.registros_ate_10kw) / op.usinas, 0)}%) are registrations of up to ${num(registros.limite_registro_kw, 0)} kW, which the Territory page counts separately (without them, ${inteiro(op.usinas - registros.registros_ate_10kw)})`
            : ""
        }.`,
      ),
    );
  }
  if (nao && temValor(nao.mw_outorgado))
    referencias.push(
      tx(
        `Outorgadas com a obra ainda não iniciada: ${mwTexto(nao.mw_outorgado)} em ${inteiro(nao.usinas)} usinas.`,
        `Granted with construction not yet started: ${mwTexto(nao.mw_outorgado)} in ${inteiro(nao.usinas)} plants.`,
      ),
    );
  return {
    id: "expansao",
    estado: "disponivel",
    medida: MEDIDA_EXPANSAO(),
    natureza: "CALCULADO",
    valor: con.mw_outorgado,
    formato: "num",
    casas: 1,
    valorTexto: valorDestaque(con.mw_outorgado, "num", 1),
    unidade: "MW",
    periodo: data,
    universo: tx(
      `${inteiro(con.usinas)} usinas na fase de construção do SIGA, o Sistema de Informações de Geração da ANEEL.`,
      `${inteiro(con.usinas)} plants in the construction phase of the SIGA, ANEEL's generation information system.`,
    ),
    variacao: null,
    referencias,
    ressalva: tx(
      "MW é potência, e não energia. Outorga não é obra, obra não é entrada certa, e as três etapas não se somam.",
      "MW is capacity, not energy. A grant is not construction, construction is not certain entry into operation, and the three stages do not add up.",
    ),
    // a gold publica a ficha da potência em operação e a da obra não iniciada, mas não a da fase de construção: sem ficha, sem prova
    prova: null,
    endereco: enderecoDe("expansao"),
    figura: null,
    semFicha: tx(
      "Esta medida ainda não tem a ficha Comprove: a base publicada traz a ficha de outras etapas do SIGA, mas não a da fase de construção.",
      "This measure does not yet have a Check this number record: the published base has the record for other SIGA stages, but not for the construction phase.",
    ),
    // o arquivo do SIGA com a fase de cada usina refaz a soma
    downloads: arquivosDaFicha(g.evidencias?.capacidade_total),
  };
}

/* ------------------------------------------------------------------ acesso e desigualdade */

const MEDIDA_TARIFA_SOCIAL = () => tx("Unidades consumidoras com Tarifa Social", "Consumer units with the Tarifa Social (social electricity tariff)");

/** A sigla do arquivo da ANEEL por extenso na primeira vez que o leitor a vê: "informaram o SCS" vira "informaram ao Sistema de Controle de Subvenções e Programas Sociais (SCS)". */
const SCS_POR_EXTENSO = (t: string) => {
  if (idiomaEnergia() === "en") {
    // o universo da gold só existe em português ("102 distribuidoras que informaram o SCS na competência"): a contagem passa, a frase é a inglesa
    const n = /^(\d[\d.]*) distribuidoras que informaram o SCS/.exec(t)?.[1];
    const quem = n ? `${n} distribution utilities that reported` : "Distribution utilities that reported";
    return `${quem} to the SCS (ANEEL's control system for subsidies and social programs)${/na competência/.test(t) ? " in the reference month" : ""}`;
  }
  const longo = t.replace(/\bo SCS\b/, `ao ${SIGLAS.SCS} (SCS)`).replace(/(?<!\()\bSCS\b(?!\))/, `${SIGLAS.SCS} (SCS)`);
  return `${longo.charAt(0).toUpperCase()}${longo.slice(1)}`;
};
const MEDIDA_ACESSO = () => tx("Domicílios sem energia elétrica", "Households without electricity");

/**
 * Tarifa Social: as unidades consumidoras com desconto no último mês completo do arquivo da ANEEL (SCS), com a participação nas residenciais e a
 * variação contra 12 meses antes. O mês é o da gold, e o aviso diz que o arquivo vai um mês além, com distribuidoras faltando.
 */
export function sinalTarifaSocial(g: InclusaoGold | null = lerGold<InclusaoGold>("inclusao.json")): SinalHome {
  if (!integra(g))
    return ausente("tarifa-social", MEDIDA_TARIFA_SOCIAL(), motivoDaGold(g, tx("A base publicada de Inclusão energética não foi processada nesta publicação.", "The published Energy inclusion base was not processed in this publication.")), null, "indisponivel");
  const k = g.tarifa_social.kpis;
  const mes = g.tarifa_social.mes_referencia;
  const mesLegivel = periodoLegivel(mes) ?? mes;
  if (!k.uc_tsee || !temValor(k.uc_tsee.valor))
    return ausente(
      "tarifa-social",
      MEDIDA_TARIFA_SOCIAL(),
      tx(`Sem as unidades consumidoras com Tarifa Social em ${mesLegivel}: o mês não está completo no arquivo da ANEEL.`, `No consumer units with the Tarifa Social for ${mesLegivel}: the month is not complete in the ANEEL file.`),
      mesLegivel,
    );
  const ev = k.uc_tsee.evidencia;
  const valor = k.uc_tsee.valor;
  const v12 = k.variacao_12m_pct;
  const variacao: Variacao | null =
    v12 && temValor(v12.valor) && v12.comparavel ? { valor: v12.valor, casas: 1, sufixo: "%", referencia: tx(`contra ${periodoLegivel(v12.mes_base) ?? v12.mes_base}`, `versus ${periodoLegivel(v12.mes_base) ?? v12.mes_base}`) } : null;
  const referencias: string[] = [];
  if (k.participacao_pct && temValor(k.participacao_pct.valor))
    referencias.push(tx(`Equivale a ${pct(k.participacao_pct.valor, 1)} das unidades consumidoras residenciais.`, `Equivalent to ${pct(k.participacao_pct.valor, 1)} of residential consumer units.`));
  // o arquivo da fonte vai além do último mês completo, com distribuidoras faltando: a inicial diz por que o mês não é o último do arquivo
  const ultimo = g.referencias.scs_ultimo_mes_no_arquivo;
  const pontoUltimo = g.tarifa_social.serie_mensal.find((x) => x.m === ultimo);
  const alem =
    ultimo && ultimo !== mes
      ? tx(
          ` É o último mês completo: o arquivo da ANEEL vai até ${periodoLegivel(ultimo) ?? ultimo}${pontoUltimo && pontoUltimo.distribuidoras_faltantes > 0 ? `, com ${num(pontoUltimo.distribuidoras_faltantes, 0)} distribuidoras faltando` : ""}.`,
          ` It is the latest complete month: the ANEEL file runs through ${periodoLegivel(ultimo) ?? ultimo}${pontoUltimo && pontoUltimo.distribuidoras_faltantes > 0 ? `, with ${num(pontoUltimo.distribuidoras_faltantes, 0)} distribution ${pontoUltimo.distribuidoras_faltantes === 1 ? "utility" : "utilities"} missing` : ""}.`,
        )
      : "";
  return {
    id: "tarifa-social",
    estado: "disponivel",
    medida: MEDIDA_TARIFA_SOCIAL(),
    natureza: "CALCULADO",
    valor,
    formato: "num",
    casas: 0,
    valorTexto: valorDestaque(valor, "num", 0),
    unidade: tx("unidades consumidoras", "consumer units"),
    periodo: mesLegivel,
    universo: `${SCS_POR_EXTENSO(ev?.universo ?? tx("Distribuidoras que informaram o SCS", "Distribution utilities that reported to the SCS"))}.`,
    variacao,
    referencias,
    ressalva: tx(`Conta unidades consumidoras com desconto, e não famílias.${alem}`, `It counts consumer units with the discount, not families.${alem}`),
    prova: ev && provaConfere(ev, valor, 0) ? prova("/energia/gold/inclusao.json", "tarifa_social.kpis.uc_tsee.evidencia", MEDIDA_TARIFA_SOCIAL(), ev) : null,
    endereco: enderecoDe("tarifa-social"),
    figura: null,
    semFicha: null,
    downloads: arquivosDaFicha(ev),
  };
}

/** Acesso: os domicílios sem energia elétrica no ano da PNAD Contínua, como a diferença de duas estimativas amostrais do IBGE. */
export function sinalAcesso(g: InclusaoGold | null = lerGold<InclusaoGold>("inclusao.json")): SinalHome {
  if (!integra(g)) return ausente("acesso", MEDIDA_ACESSO(), motivoDaGold(g, tx("A base publicada de Inclusão energética não foi processada nesta publicação.", "The published Energy inclusion base was not processed in this publication.")), null, "indisponivel");
  const ev = g.acesso.evidencia_sem_energia;
  const ano = g.acesso.ano_referencia;
  if (!ev || !temValor(ev.valor_calculo))
    return ausente(
      "acesso",
      MEDIDA_ACESSO(),
      tx(`Sem os domicílios sem energia elétrica em ${ano}: a PNAD Contínua não publicou as duas tabelas do ano.`, `No households without electricity for ${ano}: the PNAD Contínua did not publish the two tables for the year.`),
      ano,
    );
  return {
    id: "acesso",
    estado: "disponivel",
    medida: MEDIDA_ACESSO(),
    natureza: "CALCULADO",
    valor: ev.valor_calculo,
    formato: "num",
    casas: 0,
    valorTexto: valorDestaque(ev.valor_calculo, "num", 0),
    unidade: tx("mil domicílios", "thousand households"),
    periodo: ano,
    universo: tx(
      `Domicílios particulares permanentes do país, na ${SIGLAS.PNAD.split(",")[0]} Contínua (PNAD Contínua), do ${SIGLAS.IBGE} (IBGE): uma pesquisa por amostra.`,
      "Permanent private households in the country, in the Continuous National Household Sample Survey (PNAD Contínua) of the Brazilian Institute of Geography and Statistics (IBGE): a sample survey.",
    ),
    variacao: null,
    referencias: [],
    ressalva: tx("É a diferença entre duas estimativas amostrais, e o IBGE não publica o erro-padrão dela.", "It is the difference between two sample estimates, and IBGE does not publish its standard error."),
    prova: provaConfere(ev, ev.valor_calculo, 0) ? prova("/energia/gold/inclusao.json", "acesso.evidencia_sem_energia", MEDIDA_ACESSO(), ev) : null,

    endereco: enderecoDe("acesso"),
    figura: null,
    semFicha: null,
    downloads: arquivosDaFicha(ev),
  };
}

/* ------------------------------------------------------------------ os sinais da página */

/** Os seis sinais na ordem da página, cada um lido da gold do próprio módulo. */
export function sinaisDaInicial(): SinalHome[] {
  const por: Record<IdSinal, () => SinalHome> = {
    conta: () => sinalConta(),
    qualidade: () => sinalQualidade(),
    perdas: () => sinalPerdas(),
    agua: () => sinalAgua(),
    pld: () => sinalPld(),
    expansao: () => sinalExpansao(),
  };
  return ID_SINAIS.map((id) => por[id]());
}

/** Os dois sinais de acesso e desigualdade, abaixo das seis perguntas. */
export function sinaisDeInclusao(): SinalHome[] {
  const por: Record<IdSinalInclusao, () => SinalHome> = { "tarifa-social": () => sinalTarifaSocial(), acesso: () => sinalAcesso() };
  return ID_SINAIS_INCLUSAO.map((id) => por[id]());
}
