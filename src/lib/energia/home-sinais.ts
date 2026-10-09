/**
 * Os seis sinais da página inicial: uma medida de abertura para cada pergunta prioritária (conta de luz, qualidade do serviço,
 * perdas, reservatórios, PLD e expansão). Cada seletor lê a mesma gold que a página do módulo lê, pelas mesmas funções do
 * módulo (conta.json, qualidade.ts, perdas.ts, agua.ts, pld.json, expansao.ts), e devolve só o resumo: um valor, a unidade, o
 * período, o universo, a referência e a ressalva. Nenhuma série detalhada é carregada na inicial.
 *
 * Regras que valem para os seis:
 *  - nenhum número é escrito aqui: o valor, a variação e as referências vêm da gold; a inicial e a página do módulo mostram o
 *    mesmo número porque leem o mesmo campo (a Visão geral lê esses mesmos caminhos, e o teste confere a igualdade);
 *  - ausência é um estado (`ausente`, quando o módulo existe e o valor falta; `indisponivel`, quando a gold do módulo não foi
 *    publicada), com o motivo em palavras; nunca vira zero, nunca é preenchida com outro período;
 *  - o período é o do dado (vigência, ano ou dia de referência), no grão em que a fonte o publica; a data de captura não entra;
 *  - a ficha "Comprove este número" só acompanha o número quando a gold publica a evidência dele e o valor dela confere com o
 *    exibido; a ficha é lida sob demanda (o JSON público da própria gold), então a inicial não carrega as fichas nas props.
 *
 * Cada seletor aceita a gold por parâmetro, para o teste exercitar a ausência com golds sintéticas.
 */
import { lerGold, integra } from "./gold";
import { dataBR, num, pct, reais } from "./formato";
import { valorDestaque, type Evidencia, type FormatoNumero, type Variacao } from "./evidencia";
import { ID_SINAIS, PERGUNTAS_PRIORITARIAS, type IdSinal } from "./mapa";
import { horasEMinutos, anoBrasil } from "./qualidade";
import { linhaNacional, variacaoMesmas } from "./perdas";
import { entidadesEar, periodoBase } from "./agua";
import { NOME_SM, SUBMERCADOS } from "./pld";
import { estagio, inteiro, mwTexto, dataTexto, temValor } from "./expansao";
import type { Natureza, PldGold } from "./tipos";
import type { ContaGold } from "./tipos-conta";
import type { QualidadeGold } from "./tipos-qualidade";
import type { PerdasGold } from "./tipos-perdas";
import type { AguaDetalheGold } from "./tipos-agua";
import type { ExpansaoGold } from "./tipos-expansao";
import type { SinteseVisaoGold } from "./tipos-visao";

/** Como a ficha "Comprove este número" encontra a evidência: o JSON público da gold e o caminho do objeto dentro dele. */
export type ProvaSinal = { url: string; caminho: string; indicador: string; valorExibido: string };

type Base = {
  id: IdSinal;
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
  /** Onde o número está no módulo de origem: a citação da ficha aponta para lá. */
  endereco: string;
};

export type SinalAusente = Base & {
  /** "ausente": o módulo existe e este valor falta; "indisponivel": a gold do módulo não foi publicada. */
  estado: "ausente" | "indisponivel";
  motivo: string;
  periodo: string | null;
};

export type SinalHome = SinalDisponivel | SinalAusente;

/* ------------------------------------------------------------------ apoio */

const enderecoDe = (id: IdSinal): string => PERGUNTAS_PRIORITARIAS.find((p) => p.id === id)?.link.href ?? "/setor-eletrico";

function ausente(id: IdSinal, medida: string, motivo: string, periodo: string | null = null, estado: SinalAusente["estado"] = "ausente"): SinalAusente {
  return { id, medida, natureza: "CALCULADO", estado, motivo, periodo };
}

function motivoDaGold(g: { motivo?: string } | null, padrao: string): string {
  return g?.motivo?.trim() ? g.motivo : padrao;
}

/** A evidência prova o número exibido: o valor de cálculo dela, na mesma escala, cai no arredondamento do valor mostrado. */
function provaConfere(ev: Pick<Evidencia, "valor_calculo"> | null | undefined, valor: number, casas: number, escala = 1): boolean {
  return !!ev && temValor(ev.valor_calculo) && Math.abs(ev.valor_calculo / escala - valor) <= 0.5 * 10 ** -casas + 1e-9;
}

function prova(url: string, caminho: string, medida: string, ev: Pick<Evidencia, "valor_exibido">): ProvaSinal {
  return { url, caminho, indicador: medida, valorExibido: ev.valor_exibido };
}

const kwh = (rsMwh: number) => reais(rsMwh / 1000, 4);

/* ------------------------------------------------------------------ 1. conta de luz */

const MEDIDA_CONTA = "Tarifa residencial mediana entre as distribuidoras";

/** Perfil de consumo de referência da tarifa: o do meio da lista que o módulo publica (200 kWh, quando a lista é 100, 200 e 300). */
function perfilDeReferencia(perfis: readonly number[]): number | null {
  if (!perfis.length) return null;
  return perfis.includes(200) ? 200 : perfis[Math.floor(perfis.length / 2)];
}

export function sinalConta(g: ContaGold | null = lerGold<ContaGold>("conta.json")): SinalHome {
  if (!integra(g)) return ausente("conta", MEDIDA_CONTA, motivoDaGold(g, "A base publicada de Conta de luz não foi processada nesta publicação."), null, "indisponivel");
  const r = g.tarifas.resumo;
  const data = dataBR(g.data_referencia);
  if (!temValor(r.mediana)) return ausente("conta", MEDIDA_CONTA, `Nenhuma distribuidora tem tarifa residencial em vigor em ${data} no arquivo da ANEEL.`, `vigente em ${data}`);
  const valor = r.mediana / 1000;
  const perfil = perfilDeReferencia(g.perfis_kwh);
  const custo = perfil === null ? null : r.perfis_mediana[String(perfil) as "100" | "200" | "300"];
  const referencias: string[] = [];
  if (perfil !== null && temValor(custo)) referencias.push(`${num(perfil, 0)} kWh por mês custam ${reais(custo)} nessa tarifa.`);
  if (temValor(r.p25) && temValor(r.p75)) referencias.push(`Metade das distribuidoras fica entre ${kwh(r.p25)} e ${kwh(r.p75)} por kWh.`);
  const ev = g.tarifas.evidencia_mediana;
  return {
    id: "conta",
    estado: "disponivel",
    medida: MEDIDA_CONTA,
    natureza: "CALCULADO",
    valor,
    formato: "reais",
    casas: 4,
    valorTexto: valorDestaque(valor, "reais", 4),
    unidade: "por kWh",
    periodo: `vigente em ${data}`,
    universo: `Mediana de ${num(r.n, 0)} distribuidoras com tarifa residencial em vigor (grupo B1, modalidade convencional); cada uma pesa igual, sem ponderar pelo número de consumidores.`,
    variacao: null,
    referencias,
    ressalva: "É a tarifa homologada de energia e de uso da rede, sem tributos, bandeira nem iluminação pública: não é o valor da fatura.",
    prova: provaConfere(ev, valor, 4, 1000) ? prova("/energia/gold/conta.json", "tarifas.evidencia_mediana", MEDIDA_CONTA, ev) : null,
    endereco: enderecoDe("conta"),
  };
}

/* ------------------------------------------------------------------ 2. qualidade do serviço */

const MEDIDA_QUALIDADE = "Tempo médio sem energia por unidade consumidora (DEC)";

export function sinalQualidade(g: QualidadeGold | null = lerGold<QualidadeGold>("qualidade.json")): SinalHome {
  if (!integra(g)) return ausente("qualidade", MEDIDA_QUALIDADE, motivoDaGold(g, "A base publicada de Qualidade do serviço não foi processada nesta publicação."), null, "indisponivel");
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  if (!a || !temValor(a.dec)) {
    return ausente("qualidade", MEDIDA_QUALIDADE, `Sem DEC nacional para ${ref}: o ano não tem os 12 meses nacionais completos publicados.`, `ano de ${ref}`);
  }
  const ant = anoBrasil(g, ref - 1);
  const variacao: Variacao | null = ant && temValor(ant.dec) ? { valor: a.dec - ant.dec, casas: 2, sufixo: " h", referencia: `contra ${ref - 1}` } : null;
  const todas = temValor(a.dec_todas_parcelas) ? a.dec_todas_parcelas : null;
  const ev = g.evidencias?.dec_brasil ?? null;
  return {
    id: "qualidade",
    estado: "disponivel",
    medida: MEDIDA_QUALIDADE,
    natureza: "CALCULADO",
    valor: a.dec,
    formato: "num",
    casas: 2,
    valorTexto: valorDestaque(a.dec, "num", 2),
    unidade: "horas",
    periodo: `ano de ${ref}`,
    universo: `Todas as distribuidoras com DEC publicado, inclusive as permissionárias, em ${num(a.conjuntos, 0)} conjuntos elétricos; média ponderada pelas unidades consumidoras.`,
    variacao,
    referencias: [`Equivale a ${horasEMinutos(a.dec)} por unidade consumidora.`],
    ressalva: `É o DEC apurado: não inclui as interrupções que a regra exclui (emergência, dia crítico, origem externa e cortes pedidos pelo ONS)${
      todas !== null ? `; com elas, o total é de ${num(todas, 2)} h` : ""
    }.`,
    prova: ev && provaConfere(ev, a.dec, 2) ? prova("/energia/gold/qualidade.json", "evidencias.dec_brasil", MEDIDA_QUALIDADE, ev) : null,
    endereco: enderecoDe("qualidade"),
  };
}

/* ------------------------------------------------------------------ 3. perdas */

const MEDIDA_PERDAS = "Perdas totais das concessionárias de distribuição";

/** Quantas distribuidoras têm dado no ano de referência e quantas são concessionárias e permissionárias (o total nacional soma só as primeiras). */
export function universoPerdas(g: PerdasGold | null): { ano: number; total: number; concessionarias: number; permissionarias: number } | null {
  if (!integra(g)) return null;
  const ano = g.referencia.ano;
  const com = g.distribuidoras.filter((d) => d.referencia?.ano === ano);
  const concessionarias = com.filter((d) => d.grupo === "concessionaria").length;
  const permissionarias = com.filter((d) => d.grupo === "permissionaria").length;
  return concessionarias && permissionarias ? { ano, total: com.length, concessionarias, permissionarias } : null;
}

export function sinalPerdas(g: PerdasGold | null = lerGold<PerdasGold>("perdas.json")): SinalHome {
  if (!integra(g)) return ausente("perdas", MEDIDA_PERDAS, motivoDaGold(g, "A base publicada de Perdas não foi processada nesta publicação."), null, "indisponivel");
  const ano = g.referencia.ano;
  const nac = linhaNacional(g, ano);
  if (!nac || !temValor(nac.taxa_total_pct)) {
    return ausente("perdas", MEDIDA_PERDAS, `Sem taxa nacional de perdas para ${ano}: nenhuma concessionária tem os 12 meses do ano sem alerta.`, `ano de ${ano}`);
  }
  const u = universoPerdas(g);
  const mesmas = nac.mesmas_ano_anterior;
  const dif = mesmas ? variacaoMesmas(mesmas.taxa_total_pct) : null;
  const variacao: Variacao | null = mesmas && dif !== null ? { valor: dif, casas: 2, sufixo: " p.p.", referencia: `contra ${ano - 1}, nas mesmas ${num(mesmas.n_total, 0)} concessionárias` } : null;
  const ev = g.evidencias?.taxa_nacional ?? null;
  return {
    id: "perdas",
    estado: "disponivel",
    medida: MEDIDA_PERDAS,
    natureza: "CALCULADO",
    valor: nac.taxa_total_pct,
    formato: "pct",
    casas: 2,
    valorTexto: valorDestaque(nac.taxa_total_pct, "pct", 2),
    unidade: "da energia injetada",
    periodo: `ano de ${ano}`,
    universo: `${num(nac.n_distribuidoras, 0)} concessionárias com os 12 meses de ${ano} e sem alerta${
      u ? `; das ${num(u.total, 0)} distribuidoras com dado no ano, as ${num(u.permissionarias, 0)} permissionárias ficam fora deste total` : "; as permissionárias ficam fora deste total"
    }.`,
    variacao,
    referencias: [],
    ressalva: "Soma perdas técnicas e não técnicas; perda não técnica não é sinônimo de furto.",
    prova: ev && provaConfere(ev, nac.taxa_total_pct, 2) ? prova("/energia/gold/perdas.json", "evidencias.taxa_nacional", MEDIDA_PERDAS, ev) : null,
    endereco: enderecoDe("perdas"),
  };
}

/* ------------------------------------------------------------------ 4. reservatórios */

const MEDIDA_AGUA = "Energia armazenada no SIN";

export function sinalAgua(g: AguaDetalheGold | null = lerGold<AguaDetalheGold>("agua_detalhe.json")): SinalHome {
  if (!integra(g)) return ausente("agua", MEDIDA_AGUA, motivoDaGold(g, "A base publicada de Água e clima não foi processada nesta publicação."), null, "indisponivel");
  const sin = entidadesEar(g.armazenamento).find((e) => e.tipo === "subsistema" && e.id === "SIN") ?? null;
  const dia = sin?.dia ?? g.dias_referencia.ear ?? null;
  if (!sin || !temValor(sin.ear_pct)) {
    return ausente("agua", MEDIDA_AGUA, `Sem a energia armazenada do SIN${dia ? ` em ${dataBR(dia)}` : " nesta publicação"}.`, dia ? dataBR(dia) : null);
  }
  const variacao: Variacao | null = temValor(sin.variacao_30d_pp) ? { valor: sin.variacao_30d_pp, casas: 1, sufixo: " p.p.", referencia: "em 30 dias" } : null;
  const ev = g.evidencias?.ear_sin ?? null;
  const referencias: string[] = [];
  if (temValor(sin.p50)) referencias.push(`Mediana do mesmo dia do ano em ${periodoBase(sin.periodo_base)}: ${pct(sin.p50, 1)} da EAR máxima.`);
  return {
    id: "agua",
    estado: "disponivel",
    medida: MEDIDA_AGUA,
    natureza: "CALCULADO",
    valor: sin.ear_pct,
    formato: "pct",
    casas: 1,
    valorTexto: valorDestaque(sin.ear_pct, "pct", 1),
    unidade: "da EAR máxima",
    periodo: dia ? dataBR(dia) : "dia não informado",
    universo: "Sistema Interligado Nacional: soma da energia armazenada dos quatro subsistemas sobre a soma das capacidades, e não a média dos percentuais.",
    variacao,
    referencias,
    ressalva: sin.capacidade_mudou_na_base
      ? "O percentual não mede risco de desabastecimento, e a EAR máxima mudou ao longo da base."
      : "O percentual não mede risco de desabastecimento.",
    prova: ev && provaConfere(ev, sin.ear_pct, 1) ? prova("/energia/gold/agua_detalhe.json", "evidencias.ear_sin", MEDIDA_AGUA, ev) : null,
    endereco: enderecoDe("agua"),
  };
}

/* ------------------------------------------------------------------ 5. PLD */

const MEDIDA_PLD = "PLD médio do dia no Sudeste/Centro-Oeste";

/** Evidência do mesmo número na Visão geral (o painel de preço lê pld.json#cartoes[SE].media_dia): só vale se o dia e o valor forem os mesmos. */
function provaPld(sintese: SinteseVisaoGold | null, dia: string, valor: number): ProvaSinal | null {
  const m = integra(sintese) ? sintese.multiplos : null;
  const i = m ? m.paineis.findIndex((p) => p.id === "preco") : -1;
  const p = m && i >= 0 ? m.paineis[i] : null;
  if (!p || !p.evidencia || p.data_referencia !== dia) return null;
  if (p.evidencia.entidade !== NOME_SM.SE || !provaConfere(p.evidencia, valor, 2)) return null;
  return prova("/energia/gold/sintese.json", `multiplos.paineis[${i}].evidencia`, MEDIDA_PLD, p.evidencia);
}

export function sinalPld(g: PldGold | null = lerGold<PldGold>("pld.json"), sintese: SinteseVisaoGold | null = lerGold<SinteseVisaoGold>("sintese.json")): SinalHome {
  if (!integra(g)) return ausente("pld", MEDIDA_PLD, motivoDaGold(g, "A base publicada do PLD não foi processada nesta publicação."), null, "indisponivel");
  const dia = g.dia_referencia;
  const se = g.cartoes.find((c) => c.sm === "SE") ?? null;
  if (!se || !temValor(se.media_dia)) return ausente("pld", MEDIDA_PLD, `Sem a média do dia ${dataBR(dia)} no Sudeste/Centro-Oeste: o dia não tem as 24 horas publicadas.`, dataBR(dia));
  // os outros submercados, cada um com o próprio nome e valor: nenhum "PLD Brasil" por média dos quatro
  const outros = SUBMERCADOS.filter((sm) => sm !== "SE")
    .map((sm) => {
      const c = g.cartoes.find((x) => x.sm === sm);
      return `${NOME_SM[sm]} ${temValor(c?.media_dia) ? reais(c!.media_dia) : "sem dado"}`;
    })
    .join("; ");
  return {
    id: "pld",
    estado: "disponivel",
    medida: MEDIDA_PLD,
    natureza: "CALCULADO",
    valor: se.media_dia,
    formato: "reais",
    casas: 2,
    valorTexto: valorDestaque(se.media_dia, "reais", 2),
    unidade: "por MWh",
    periodo: dataBR(dia),
    universo: "Média simples das 24 horas do dia, em valores nominais.",
    variacao: null,
    referencias: [`Nos outros submercados: ${outros}.`],
    ressalva: "É o preço das diferenças liquidadas no mercado de curto prazo, e não a tarifa que a distribuidora cobra.",
    prova: provaPld(sintese, dia, se.media_dia),
    endereco: enderecoDe("pld"),
  };
}

/* ------------------------------------------------------------------ 6. expansão */

const MEDIDA_EXPANSAO = "Usinas em construção, potência outorgada";

export function sinalExpansao(g: ExpansaoGold | null = lerGold<ExpansaoGold>("expansao.json")): SinalHome {
  if (!integra(g)) return ausente("expansao", MEDIDA_EXPANSAO, motivoDaGold(g, "A base publicada de Expansão não foi processada nesta publicação."), null, "indisponivel");
  const data = dataTexto(g.estagios.data_referencia);
  const con = estagio(g, "construcao");
  if (!con || !temValor(con.mw_outorgado)) return ausente("expansao", MEDIDA_EXPANSAO, `Sem a potência em construção no SIGA de ${data}.`, data);
  const op = estagio(g, "operacao");
  const nao = estagio(g, "construcao_nao_iniciada");
  const referencias: string[] = [];
  if (op && temValor(op.mw_fiscalizado)) referencias.push(`Em operação, no mesmo cadastro: ${mwTexto(op.mw_fiscalizado)} fiscalizados em ${inteiro(op.usinas)} usinas.`);
  if (nao && temValor(nao.mw_outorgado)) referencias.push(`Outorgadas com a obra ainda não iniciada: ${mwTexto(nao.mw_outorgado)} em ${inteiro(nao.usinas)} usinas.`);
  return {
    id: "expansao",
    estado: "disponivel",
    medida: MEDIDA_EXPANSAO,
    natureza: "CALCULADO",
    valor: con.mw_outorgado,
    formato: "num",
    casas: 1,
    valorTexto: valorDestaque(con.mw_outorgado, "num", 1),
    unidade: "MW",
    periodo: data,
    universo: `${inteiro(con.usinas)} usinas na fase de construção do SIGA, o Sistema de Informações de Geração da ANEEL.`,
    variacao: null,
    referencias,
    ressalva: "MW é potência, e não energia. Outorga não é obra, obra não é entrada certa, e as três etapas não se somam.",
    // a gold publica a ficha da potência em operação e a da obra não iniciada, mas não a da fase de construção: sem ficha, sem prova
    prova: null,
    endereco: enderecoDe("expansao"),
  };
}

/* ------------------------------------------------------------------ os seis */

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
