import { linhasArquivo, resumoRodadas, rotuloTipo, textoMotivo } from "@/lib/energia/previsoes";
import { lerCsvPrevisoes } from "@/lib/energia/previsoes-arquivos";
import { fonteLegivel, fraseDeRecusa, semCaminhosDeArquivo } from "@/lib/energia/bastidor";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import type { ReactNode } from "react";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { FiguraAnalitica, GraficoBarras, GraficoLinhas, PaginaPainel, TabelaDados, type CelulaTabela, type CorSerie, type NumeroProps } from "@/components/painel";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { provenienciaLegivel } from "@/lib/energia/mercado";
import { rotuloDoGrupo } from "@/lib/energia/navegacao";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { Conferido } from "@/components/evidencia/Conferido";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import type { NoComEstado } from "@/components/energia/DiagramaFormacao";
import { PldFormacao } from "@/components/energia/PldFormacao";
import { PldAviso, PldCapitulos, PldDatas, PldNavegacao, PldPassagem, PldRecorte, PldSeguir, PldTextoGold } from "@/components/energia/PldPagina";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MapaSubmercados } from "@/components/energia/MapaSubmercados";
import { PldPeriodos, type PeriodoPld } from "@/components/energia/PldPeriodos";
import { IlustracaoDistribuicao } from "@/components/energia/IlustracaoDistribuicao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { carimbo, dataBR, dataCurta, horaLocal, num, reais, rotuloRegra } from "@/lib/energia/formato";
import { semUtc } from "@/lib/painel/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { identificador, marcadoMercado } from "@/lib/energia/i18n/mercado-preco";
import type { Idioma } from "@/lib/idioma";
import { textoAmplitude } from "@/lib/energia/resumos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { NOS_FORMACAO_IDIOMAS, PLD_NAO_E_IDIOMAS, TIPOS_RELACAO_IDIOMAS } from "@/lib/energia/conteudo/pld";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { CONTRASTES_IDIOMAS } from "@/lib/energia/conteudo/complementos";
import { estadoCarga, estadoEar, estadoEna, estadoPld } from "@/lib/energia/leituras";
import type { PldGold } from "@/lib/energia/tipos";
import type { PldDetalheGold, RegimeLimites } from "@/lib/energia/tipos-pld";
import {
  COR_SM,
  nomeSm,
  documentosCitados,
  estadoRenovaveisBalanco,
  estadoTermicasBalanco,
  extremosMediaDiaria,
  horasPorSentidoNoDia,
  intervaloSemanaOperativa,
  ligacoesFormacao,
  linhasMediaDiaria,
  nomesDosSubmercados,
  notaDoisPercentis,
  perguntaPainel,
  pontesSeparacao,
  proximoPainel,
  provenienciaSemRessalvaObsoleta,
  regimeVigenteEm,
  resumoLigacoes,
  respostaP008,
  rotaPainel,
  semCodigoHttp,
  semRessalvaDeLimitesNaoAuditados,
  textoEmpatesMediaDiaria,
  textoHidraulicaBalanco,
  textoLimitesVigentes,
  textoMenorValorEPiso,
  textoMudancaMediaDiaria,
  textoReferenciaDistancia,
  textoRegimesDistribuicao,
  textoHora,
  textoSentidoNoDia,
  variacaoComumDoGrupo,
  vereditoMediaDiaria,
  vereditoP008,
} from "@/lib/energia/pld";
import { horarioRecentePld } from "@/lib/energia/pld-arquivos";
import { snapshotLegivel, datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/pld", {
    title: tx("PLD: o preço horário da energia por submercado, explicado", "PLD: the hourly spot price of energy by submarket, explained"),
    description: tx(
      "O que é o PLD, o que ele não é, de onde vem o preço, o que aconteceu no último dia publicado nos quatro submercados e o estado real da previsão, com fonte, regra e limitação em cada número.",
      "What the spot price (PLD) is, what it is not, where the price comes from, what happened on the latest published day in the four submarkets and the real state of the forecast, with source, rule and limitation for each number.",
    ),
    alternates: { canonical: "/setor-eletrico/pld" },
  }, anterior);
}

function periodos(p: PldGold): PeriodoPld[] {
  const x = (arr: Record<string, unknown>[], chave: string) =>
    arr.map((r) => ({ x: String(r[chave]), SE: r.SE as number | null, S: r.S as number | null, NE: r.NE as number | null, N: r.N as number | null }));
  const h30 = x(p.horario_30d as unknown as Record<string, unknown>[], "t");
  const curva = p.curva_horaria.horas.map((r) => ({ x: `${p.curva_horaria.dia}T${r.h}`, SE: r.SE, S: r.S, NE: r.NE, N: r.N }));
  const diario = x(p.diario as unknown as Record<string, unknown>[], "d");
  const mensal = x(p.mensal as unknown as Record<string, unknown>[], "m");
  const base = (id: keyof PldGold["periodos"], rotulo: string, serie: Record<string, string | number | null>[], formatoX: PeriodoPld["formatoX"], descricaoSerie: string): PeriodoPld => ({
    id,
    rotulo,
    inicio: p.periodos[id].inicio,
    fim: p.periodos[id].fim,
    nHoras: p.periodos[id].n_horas,
    stats: p.periodos[id].por_submercado,
    diferenca: p.periodos[id].diferenca,
    serie,
    formatoX,
    descricaoSerie,
  });
  return [
    base(
      "hoje",
      tx(`Dia ${dataBR(p.dia_referencia).slice(0, 5)}`, `Day ${dataCurta(p.dia_referencia, "en")}`),
      curva,
      "hora",
      tx(`curva horária de ${dataBR(p.dia_referencia)} (valores observados)`, `hourly curve for ${dataBR(p.dia_referencia)} (observed values)`),
    ),
    base("7d", tx("7 dias", "7 days"), h30.slice(-168), "hora", tx("valores horários (observados)", "hourly values (observed)")),
    base("30d", tx("30 dias", "30 days"), h30, "hora", tx("valores horários (observados)", "hourly values (observed)")),
    base("12m", tx("12 meses", "12 months"), diario.slice(-365), "data", tx("médias diárias (calculadas)", "daily averages (calculated)")),
    base(
      "historico",
      tx("Histórico", "History"),
      mensal,
      "mes",
      tx("médias mensais desde jan/2021 (calculadas; mês corrente parcial)", "monthly averages since Jan 2021 (calculated; current month partial)"),
    ),
  ];
}

const ligacaoTexto = "underline underline-offset-4 text-energia-dark hover:text-carvao";

/** Estado do modelo da última rodada, na frase inglesa (o código da gold fica para o português). */
function rotuloEstadoModeloEn(estado: string): string {
  switch (estado) {
    case "VALIDACAO":
      return "in validation";
    case "PRODUCAO":
      return "in production";
    case "APOSENTADO":
      return "retired";
    default:
      return "in research";
  }
}

/** Como o PLD e a conta de luz se relacionam, na frase do registro de contrastes do observatório (a mesma que o verbete usa), no idioma da página. */
function ligacaoComAConta(idioma: Idioma): string {
  return (
    CONTRASTES_IDIOMAS[idioma].find((c) => c.a === "pld" && c.b === "tarifa-te-tusd")?.texto ??
    tx(
      "O PLD é o preço das diferenças liquidadas no Mercado de Curto Prazo. A conta do consumidor atendido pela distribuidora segue a TE e a TUSD, que a ANEEL homologa, mais bandeira e tributos.",
      "The PLD is the price of the differences settled in the Short-Term Market. The bill of a consumer served by the distribution utility follows the TE and TUSD tariffs approved by ANEEL, plus the tariff flag and taxes.",
      idioma,
    )
  );
}

export default function PldPage() {
  const idioma = idiomaEnergia();
  const NOS_FORMACAO = NOS_FORMACAO_IDIOMAS[idioma];
  const PLD_NAO_E = PLD_NAO_E_IDIOMAS[idioma];
  const TIPOS_RELACAO = TIPOS_RELACAO_IDIOMAS[idioma];
  const pld = gold.pld();
  const hid = gold.hidrologia();
  const ger = gold.geracao();
  const carga = gold.carga();
  const rede = gold.rede();
  const cmo = gold.cmo();
  // limites oficiais (atos anuais da ANEEL, com vigência) publicados pelo módulo PLD
  const detalhe = lerGold<PldDetalheGold>("pld_detalhe.json");
  const limDet = integra(detalhe) && detalhe.limites.disponivel ? detalhe.limites : null;
  // o trecho de limites que vale no dia de referência (e não simplesmente o último da lista)
  const diaRef = integra(pld) ? pld.dia_referencia : integra(detalhe) ? detalhe.referencia.dia : null;
  const regimeVigente: RegimeLimites | null = limDet && diaRef ? regimeVigenteEm(limDet.regimes, diaRef) : null;
  const prev = gold.previsoes();
  const mods = gold.modelos();
  const cPld = conceito("pld");

  const semanaRef = integra(detalhe) ? detalhe.cmo_pld.semana_referencia : null;

  const estados: Record<string, NoComEstado["estado"]> = {
    afluencias: estadoEna(hid)
      ? { texto: estadoEna(hid)!, natureza: "CALCULADO", historico: { rotulo: tx("Histórico da ENA", "ENA history"), href: "/setor-eletrico/agua-e-clima/afluencia#p018" } }
      : null,
    reservatorios: estadoEar(hid) ? { texto: estadoEar(hid)!, natureza: "CALCULADO", historico: { rotulo: tx("Histórico da EAR", "EAR history"), href: "/setor-eletrico/agua-e-clima#ear" } } : null,
    carga: estadoCarga(carga) ? { texto: estadoCarga(carga)!, natureza: "CALCULADO", historico: { rotulo: tx("Histórico da carga", "Load history"), href: "/setor-eletrico/carga" } } : null,
    // participações do Balanço de Energia do ONS, cuja solar inclui a MMGD estimada: o texto diz isso e o selo é Estimado
    renovaveis: estadoRenovaveisBalanco(ger) ? { texto: estadoRenovaveisBalanco(ger)!, natureza: "ESTIMADO", historico: { rotulo: tx("Matriz por janela", "Mix by window"), href: "/setor-eletrico/geracao" } } : null,
    termicas: estadoTermicasBalanco(ger) ? { texto: estadoTermicasBalanco(ger)!, natureza: "ESTIMADO", historico: { rotulo: tx("Térmicas em contexto", "Thermal plants in context"), href: "/setor-eletrico/geracao#termica" } } : null,
    rede: integra(rede)
      ? {
          texto: tx(
            `Em ${dataBR(rede.dia_referencia)}: ${rede.fronteiras
              .map((f) => {
                if (f.fluxo_dia === null) return `${f.de} e ${f.para} sem dado`; // i18n: dado
                const [o, d] = f.fluxo_dia >= 0 ? [f.de, f.para] : [f.para, f.de];
                return `${o}→${d} ${num(Math.abs(f.fluxo_dia), 0)} MWmed`;
              })
              .join("; ")}. Limites de intercâmbio não integrados.`,
            `On ${dataBR(rede.dia_referencia)}: ${rede.fronteiras
              .map((f) => {
                if (f.fluxo_dia === null) return `${f.de} and ${f.para} no data`;
                const [o, d] = f.fluxo_dia >= 0 ? [f.de, f.para] : [f.para, f.de];
                return `${o}→${d} ${num(Math.abs(f.fluxo_dia), 0)} MWavg`;
              })
              .join("; ")}. Interchange limits not integrated.`,
          ),
          natureza: "CALCULADO",
          historico: { rotulo: tx("Intercâmbios", "Interchanges"), href: "/setor-eletrico/rede" },
        }
      : null,
    otimizacao: null,
    cmo: integra(cmo)
      ? {
          // a semana mais recente publicada pelo ONS e a última semana completa nos três produtos (a da tabela de Analisar) são semanas diferentes: as duas vêm com o intervalo
          texto: tx(
            `CMO semanal do DECOMP publicado pelo ONS para a semana operativa de ${dataBR(intervaloSemanaOperativa(cmo.semana_referencia).inicio)} a ${dataBR(cmo.semana_referencia)} (a mais recente): ${cmo.ultima_semana.map((s) => `${s.sm === "SE" ? "SE/CO" : s.sm} ${reais(s.semanal)}`).join("; ")} por MWh.${semanaRef ? ` A tabela deste capítulo compara a última semana completa nos três produtos, de ${dataBR(semanaRef.inicio)} a ${dataBR(semanaRef.fim)}.` : ""}`,
            `Weekly DECOMP CMO published by ONS for the operating week from ${dataBR(intervaloSemanaOperativa(cmo.semana_referencia).inicio)} to ${dataBR(cmo.semana_referencia)} (the most recent): ${cmo.ultima_semana.map((s) => `${s.sm === "SE" ? "SE/CW" : s.sm} ${reais(s.semanal)}`).join("; ")} per MWh.${semanaRef ? ` The table in this chapter compares the latest week complete in all three products, from ${dataBR(semanaRef.inicio)} to ${dataBR(semanaRef.fim)}.` : ""}`,
          ),
          // natureza vem da proveniência da gold (ESTIMADO: resultado do modelo DECOMP), nunca escrita aqui
          natureza: cmo.proveniencia.cmo.natureza,
          historico: { rotulo: tx("Série do CMO", "CMO series"), href: "#cmo" },
        }
      : null,
    limites: regimeVigente
      ? {
          texto: tx(
            `Limites oficiais vigentes desde ${dataBR(regimeVigente.inicio)}: piso ${reais(regimeVigente.pld_min)}/MWh, teto horário ${reais(regimeVigente.pld_max_horario)}/MWh e teto estrutural ${reais(regimeVigente.pld_max_estrutural)}/MWh (${regimeVigente.ato_pld_min ?? "ato não identificado"}).`,
            `Official limits in force since ${dataBR(regimeVigente.inicio)}: floor ${reais(regimeVigente.pld_min)}/MWh, hourly cap ${reais(regimeVigente.pld_max_horario)}/MWh and structural cap ${reais(regimeVigente.pld_max_estrutural)}/MWh (${regimeVigente.ato_pld_min ?? "act not identified"}).`,
          ),
          natureza: "OBSERVADO",
        }
      : null,
    pld: estadoPld(pld) ? { texto: estadoPld(pld)!, natureza: "CALCULADO", historico: { rotulo: tx("O que está acontecendo", "What is happening"), href: "#hoje" } } : null,
  };
  const nos: NoComEstado[] = NOS_FORMACAO.map((n) => ({ ...n, estado: estados[n.id] ?? null }));

  const amplitude = integra(rede) ? rede.serie_amplitude_pld.map((a) => ({ x: a.d, amp: a.amplitude })) : [];
  const ult = prev?.atual?.ultima_execucao;
  // P008: ligações do diagrama conferidas nas passagens normativas e técnicas da gold do módulo
  const conceitoDet = integra(detalhe) ? detalhe.conceito : null;
  const ligacoes = conceitoDet ? ligacoesFormacao(NOS_FORMACAO, conceitoDet.fontes_textuais) : null;
  const resumoLig = ligacoes ? resumoLigacoes(ligacoes) : null;
  const docs = conceitoDet ? documentosCitados(conceitoDet) : null;
  const passagem = (id: string) => conceitoDet?.fontes_textuais.find((f) => f.id === id && f.texto) ?? null;
  const exemplo = conceitoDet?.exemplo_liquidacao ?? null;
  const bloqueioCcee = conceitoDet?.bloqueios.find((b) => b.fonte.startsWith("CCEE")) ?? null;
  const bloqueioCepel = conceitoDet?.bloqueios.find((b) => b.fonte.startsWith("CEPEL")) ?? null;
  // o histórico de previsões é o mesmo arquivo da página de previsões: as contagens saem do CSV completo, não do trecho legado da gold
  const csvEmissoes = lerCsvPrevisoes("/energia/series/previsoes_emissoes.csv");
  const linhasEmissoes = csvEmissoes ? linhasArquivo(csvEmissoes.linhas, Object.fromEntries((mods?.modelos ?? []).map((m) => [m.codigo, m.estado]))) : [];
  const rodadasEmissoes = resumoRodadas(linhasEmissoes);
  const notaPercentis = integra(detalhe) && integra(pld) ? notaDoisPercentis(pld.cartoes.find((c) => c.sm === "SE"), detalhe.historico.posicao_referencia.find((x) => x.sm === "SE")) : null;

  // abertura: a média diária de cada submercado, os extremos (com os empates) e a distância entre as regiões, todos da mesma lista
  const medias = integra(pld) ? linhasMediaDiaria(pld.cartoes) : [];
  const extremos = extremosMediaDiaria(medias);
  const referenciaDistancia = integra(pld) && integra(rede) ? textoReferenciaDistancia(rede.resumo_amplitude, pld.dia_referencia) : null;
  const empates = extremos ? textoEmpatesMediaDiaria(extremos) : null;

  // ponte entre os dois critérios de diferença entre submercados (R$ 1,00 aqui; R$ 0,01 em Diferenças regionais): só nos períodos em que a
  // gold regional tem a mesma janela (mesmas horas e mesma contagem acima de R$ 1,00, que a própria gold publica igual nas duas)
  const pontesRegional = integra(detalhe) ? pontesSeparacao(detalhe.regional) : {};
  const pontes =
    integra(pld) && integra(detalhe)
      ? Object.fromEntries(
          (["30d", "12m"] as const).flatMap((id) => {
            const a = detalhe.regional.amplitude.find((x) => x.periodo === id);
            const per = pld.periodos[id];
            return a && pontesRegional[id] && a.horas === per.n_horas && a.horas_acima_1 === per.diferenca.horas_acima_limiar ? [[id, pontesRegional[id]] as const] : [];
          }),
        )
      : {};
  const notaMenorValor = limDet ? textoMenorValorEPiso(limDet.conferencias) : null;
  const textoRegimes = limDet ? textoRegimesDistribuicao(limDet) : null;
  // o mapa de submercados usa o último dia com fluxo publicado para o preço e para o fluxo: o mesmo dia nas duas medidas
  const recHorario = integra(detalhe) ? horarioRecentePld(detalhe.horario_recente.url) : null;
  const diaDoFluxo = integra(rede) ? rede.dia_referencia : null;
  const diarioDoFluxo = integra(pld) && diaDoFluxo ? pld.diario.find((x) => x.d === diaDoFluxo) : undefined;
  const sentidosNoDia = recHorario && diaDoFluxo ? horasPorSentidoNoDia(recHorario, diaDoFluxo) : [];

  // abertura: a média diária do menor e do maior submercado (com os empates) e a distância entre eles, todos da mesma lista do gráfico
  const fontePld = tx("CCEE, PLD horário", "CCEE, hourly PLD");
  const numerosAbertura: NumeroProps[] =
    integra(pld) && extremos
      ? [
          ...([
            [tx("Menor média diária", "Lowest daily average"), extremos.menor] as const,
            [tx("Maior média diária", "Highest daily average"), extremos.maior] as const,
          ].map(([rotulo, e]): NumeroProps => {
            const variacao = variacaoComumDoGrupo(medias, e.submercados);
            return {
              rotulo,
              natureza: "CALCULADO",
              valor: e.valor,
              formato: "reais",
              casas: 2,
              unidade: "R$/MWh",
              recorte: `${nomesDosSubmercados(e.submercados)}${e.submercados.length > 1 && extremos.distancia > 0 ? tx(" (mesmo valor)", " (same value)") : ""}`,
              periodo: dataBR(pld.dia_referencia),
              fonte: fontePld,
              marcador: e.submercados.length === 1 ? (COR_SM[e.submercados[0]] as CorSerie) : undefined,
              variacao: variacao === null ? undefined : { valor: variacao, casas: 2, unidade: "absoluta", base: tx("em relação ao dia anterior", "relative to the previous day") },
            };
          })),
          {
            rotulo: tx("Distância entre regiões", "Distance between regions"),
            natureza: "CALCULADO",
            valor: extremos.distancia,
            formato: "reais",
            casas: 2,
            unidade: "R$/MWh",
            recorte: tx("maior menos menor", "highest minus lowest"),
            periodo: dataBR(pld.dia_referencia),
            fonte: fontePld,
            nota: referenciaDistancia ?? undefined,
          },
        ]
      : [
          {
            rotulo: tx("Média diária do PLD", "Daily PLD average"),
            natureza: "CALCULADO",
            valor: null,
            unidade: "R$/MWh",
            periodo: tx("último dia publicado", "latest published day"),
            fonte: fontePld,
            motivoAusencia: tx("Sem dia com as 24 horas publicadas nos quatro submercados nesta publicação.", "No day with all 24 hours published in the four submarkets in this publication."),
          },
        ];

  // notas do painel de abertura: o que mudou (dia anterior e histórico da distância), como interpretar (regra e limites vigentes) e o que não concluir
  const oQueMudouPrecos = integra(pld) ? (
    <>{textoMudancaMediaDiaria(pld.dia_referencia, medias)}</>
  ) : (
    <>{tx("Sem dia com as 24 horas publicadas nos quatro submercados nesta publicação.", "No day with all 24 hours published in the four submarkets in this publication.")}</>
  );
  const comoInterpretarPrecos = (
    <>
      {tx(
        "O PLD valora, no mercado de curto prazo, as diferenças entre a energia contratada e a verificada de cada agente, e a CCEE o calcula para cada hora e cada submercado. Cada barra é a média simples das 24 horas do dia em um submercado, em valores nominais; a escala começa em zero e é a mesma nas quatro.",
        "The PLD values, in the short-term market, the differences between each agent's contracted and verified energy, and CCEE calculates it for each hour and each submarket. Each bar is the simple average of the 24 hours of the day in one submarket, in nominal values; the scale starts at zero and is the same for all four.",
      )}{" "}
      {regimeVigente ? textoLimitesVigentes(regimeVigente) : tx("Os limites vigentes não estão integrados nesta publicação.", "The limits in force are not integrated in this publication.")}
    </>
  );
  const naoConcluirPrecos = (
    <>
      {tx(
        "O PLD não é a tarifa nem a conta de luz: PLD, CMO, tarifa e fatura são medidas diferentes (veja",
        "The PLD is not the tariff or the electricity bill: PLD, CMO, tariff and bill are different measures (see",
      )}{" "}
      <a href="#o-que-e" className={ligacaoTexto}>
        {tx("o que o PLD não é", "what the PLD is not")}
      </a>{" "}
      {tx("e a página", "and the page")}{" "}
      <Link href="/setor-eletrico/conta-de-luz" className={ligacaoTexto}>
        {tx("Conta de luz", "Electricity bill")}
      </Link>
      {tx(
        "). A média do dia não mostra a variação das horas, que está abaixo, e este painel não diz para onde o preço vai.",
        "). The daily average does not show the variation across hours, which is below, and this panel does not say where the price is heading.",
      )}
    </>
  );

  // tabelas equivalentes e de conferência: as mesmas listas do gráfico, da faixa e do mapa, nunca outra conta
  const colunasDia = [tx("Submercado", "Submarket"), tx("Média do dia (R$/MWh)", "Day average (R$/MWh)"), tx("Mínimo horário", "Hourly minimum"), tx("Máximo horário", "Hourly maximum"), tx("Vs. dia anterior (R$/MWh)", "Vs. previous day (R$/MWh)"), tx("Posição desde 2021", "Position since 2021")];
  const linhasDia: CelulaTabela[][] = integra(pld)
    ? pld.cartoes.map((c) => [
        tx(c.nome, nomeSm(c.sm, "en")),
        c.media_dia,
        c.min_hora,
        c.max_hora,
        c.variacao_dia_anterior ? c.variacao_dia_anterior.abs : null,
        c.posicao.percentil !== null ? tx(`percentil ${num(c.posicao.percentil, 1)} de ${num(c.posicao.n_dias, 0)} dias`, `percentile ${num(c.posicao.percentil, 1)} of ${num(c.posicao.n_dias, 0)} days`) : null,
      ])
    : [];
  const curvaDoDia = integra(pld) ? pld.curva_horaria.horas : [];
  const linhasFormacao: CelulaTabela[][] = ligacoes
    ? nos.flatMap((n) =>
        (ligacoes[n.id] ?? []).map((l) => [
          n.titulo,
          nos.find((x) => x.id === l.para)?.titulo ?? l.para,
          TIPOS_RELACAO[l.tipo]?.rotulo ?? l.tipo,
          l.estado === "CONFERIDO" ? tx("conferida em documento", "checked in a document") : tx("conferência documental pendente", "documentary check pending"),
        ]),
      )
    : [];

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:pld" />
      <PaginaPainel
        rota="/setor-eletrico/pld"
        idioma={idioma}
        profundidade
        // na abertura do PLD as páginas irmãs entram como capítulos dentro da primeira figura (PldCapitulos); a faixa só existe nas filhas
        navegacaoLocal={<PldNavegacao atual="p008" />}
        abertura={{
          grupo: rotuloDoGrupo("precos-e-mercado"),
          acento: "energia",
          titulo: tx("Quanto custa a energia no curto prazo?", "How much does energy cost in the short term?"),
          lead: tx(
            "O Preço de Liquidação das Diferenças (PLD), calculado pela CCEE para cada hora e para cada submercado: a média do último dia publicado e a distância entre as regiões.",
            "The spot price (PLD), calculated by CCEE for each hour and each submarket: the average for the latest published day and the distance between regions.",
          ),
          recorte: {
            periodo: integra(pld) ? dataBR(pld.dia_referencia) : tx("dia não publicado nesta publicação", "day not published in this release"),
            universo: tx("quatro submercados · médias diárias", "four submarkets · daily averages"),
            unidade: tx("R$/MWh nominais", "nominal R$/MWh"),
            fonte: tx("CCEE, PLD horário por submercado", "CCEE, hourly PLD by submarket"),
          },
          limite: tx(
            "para onde o preço vai, nem quanto vem na conta de luz: o PLD não é a tarifa, e a média do dia esconde a variação das horas.",
            "where the price is heading, nor how much comes on the electricity bill: the PLD is not the tariff, and the day's average hides the variation across hours.",
          ),
          fontesDatasSiglas: (
            <>
              {integra(pld) && (
                <p className="t-meta text-mineral">
                  <span className="font-medium text-carvao-muted">{tx("Fontes e datas de referência: ", "Sources and reference dates: ")}</span>
                  {tx(
                    `CCEE (PLD horário até ${horaLocal(pld.ultima_hora)})${integra(rede) ? `, ONS (intercâmbio entre subsistemas até ${dataBR(rede.dia_referencia)})` : ""}${limDet ? " e ANEEL (atos anuais dos limites do PLD)" : ""}; processado em ${carimbo(pld.gerado_em)}.`,
                    `CCEE (hourly PLD through ${horaLocal(pld.ultima_hora)})${integra(rede) ? `, ONS (interchange between subsystems through ${dataBR(rede.dia_referencia)})` : ""}${limDet ? " and ANEEL (annual PLD limits acts)" : ""}; processed on ${carimbo(pld.gerado_em)}.`,
                  )}
                </p>
              )}
              {integra(pld) && (
                <PldDatas
                  itens={[
                    { rotulo: tx("PLD horário", "Hourly PLD"), ate: tx(`até ${horaLocal(pld.ultima_hora)}`, `through ${horaLocal(pld.ultima_hora)}`), natureza: "OBSERVADO" },
                    { rotulo: tx("Média diária", "Daily average"), ate: dataBR(pld.dia_referencia), natureza: "CALCULADO" },
                    {
                      rotulo: tx("Intercâmbio entre subsistemas (mapa)", "Interchange between subsystems (map)"),
                      ate: integra(rede) ? tx(`até ${dataBR(rede.dia_referencia)}`, `through ${dataBR(rede.dia_referencia)}`) : null,
                      natureza: "OBSERVADO",
                    },
                    ...(integra(detalhe)
                      ? [
                          {
                            rotulo: tx("CMO semanal (DECOMP)", "Weekly CMO (DECOMP)"),
                            ate: tx(`até a semana de ${dataBR(detalhe.referencia.ultima_semana_decomp)}`, `through the week of ${dataBR(detalhe.referencia.ultima_semana_decomp)}`),
                            natureza: "ESTIMADO" as const,
                          },
                        ]
                      : []),
                    ...(regimeVigente
                      ? [{ rotulo: tx("Limites vigentes", "Limits in force"), ate: tx(`desde ${dataBR(regimeVigente.inicio)}`, `since ${dataBR(regimeVigente.inicio)}`), natureza: "OBSERVADO" as const }]
                      : []),
                  ]}
                />
              )}
              <LegendaDeSiglas siglas={["CCEE", "CMO", "MWmed", "ENA", "EAR", "CVU", "ONS", "ANEEL", "REN"]} />
            </>
          ),
        }}
        rotuloNumeros={tx("Média diária do PLD: menor e maior entre os submercados e a distância entre elas", "Daily PLD average: lowest and highest among the submarkets and the distance between them")}
        numeros={numerosAbertura}
        notaNumeros={
          integra(pld) ? (
            <>
              <span className="font-medium text-carvao">{tx("Média diária:", "Daily average:")}</span> <PldTextoGold texto={pld.regras.media_diaria} regiao="pld-regra" />{" "}
              {tx(
                "Não existe um PLD único do Brasil: cada submercado tem o seu preço, e a média simples dos quatro não é publicada pela CCEE.",
                "There is no single PLD for Brazil: each submarket has its own price, and CCEE does not publish the simple average of the four.",
              )}
            </>
          ) : undefined
        }
        figuras={
          <>
            {integra(pld) && extremos ? (
              <FiguraAnalitica
                id="hoje"
                pergunta={tx("A média do dia em cada submercado, na mesma escala", "The day's average in each submarket, on the same scale")}
                subtitulo={tx(
                  "Média das 24 horas de cada submercado no último dia publicado · R$/MWh nominais",
                  "Average of the 24 hours of each submarket on the latest published day · nominal R$/MWh",
                )}
                natureza="CALCULADO"
                legivel={fonteLegivel}
                porQueImporta={tx(
                  "O PLD valora as diferenças entre a energia contratada e a verificada; quando os submercados têm preços diferentes, a mesma diferença vale mais em uma região do que em outra. A média diária resume as 24 horas de cada região e permite compará-las na mesma escala, mas não substitui o perfil horário, que vem logo abaixo.",
                  "The PLD values the differences between contracted and verified energy; when submarkets have different prices, the same difference is worth more in one region than in another. The daily average summarizes the 24 hours of each region and allows them to be compared on the same scale, but it does not replace the hourly profile, which comes right below.",
                )}
                oQueMudou={oQueMudouPrecos}
                comoInterpretar={comoInterpretarPrecos}
                naoConcluir={naoConcluirPrecos}
                proveniencia={provenienciaLegivel(provenienciaSemRessalvaObsoleta(pld.proveniencia.diario))}
                extraFonte={<>{tx(`Captura primária de ${carimbo(pld.proveniencia.horario.capturado_em)}.`, `Primary capture of ${carimbo(pld.proveniencia.horario.capturado_em)}.`)}</>}
                complementares={[
                  { rotulo: tx("Sobre o PLD horário", "On the hourly PLD"), p: provenienciaSemRessalvaObsoleta(pld.proveniencia.horario) },
                  ...(pld.proveniencia.estatisticas
                    ? [{ rotulo: tx("Sobre as estatísticas do período", "On the period statistics"), p: provenienciaSemRessalvaObsoleta(pld.proveniencia.estatisticas) }]
                    : []),
                  ...(pld.proveniencia.mensal ? [{ rotulo: tx("Sobre as médias mensais", "On the monthly averages"), p: provenienciaSemRessalvaObsoleta(pld.proveniencia.mensal) }] : []),
                  { rotulo: tx("Sobre a posição histórica", "On the historical position"), p: provenienciaSemRessalvaObsoleta(pld.proveniencia.posicao) },
                  ...(integra(rede)
                    ? [
                        { rotulo: tx("Sobre os fluxos", "On the flows"), p: rede.proveniencia.fluxo },
                        { rotulo: tx("Sobre a diferença entre o maior e o menor PLD médio", "On the difference between the highest and the lowest average PLD"), p: rede.proveniencia.amplitude },
                      ]
                    : []),
                ].map((c) => ({ ...c, p: provenienciaLegivel(c.p) }))}
                tabela={{
                  titulo: tx(`Média diária do PLD por submercado, ${dataBR(pld.dia_referencia)} (R$/MWh)`, `Daily PLD average by submarket, ${dataBR(pld.dia_referencia)} (R$/MWh)`),
                  colunas: [tx("Submercado", "Submarket"), tx("Média diária (R$/MWh)", "Daily average (R$/MWh)")],
                  linhas: medias.map((m) => [nomeSm(m.id), m.media]),
                  casas: [null, 2],
                }}
                leitura={
                  <RespostaCurta id="hoje" depois veredito={vereditoMediaDiaria(pld.dia_referencia, extremos)}>
                    <p>
                      <PldTextoGold texto={pld.regras.dia_referencia} regiao="pld-regra" />
                    </p>
                    <p className="mt-1">
                      <PldTextoGold texto={pld.regras.media_diaria} regiao="pld-regra" />
                    </p>
                    <p className="mt-1">
                      {tx(
                        "Empate é igualdade nos centavos exibidos: se mais de um submercado tem a maior ou a menor média, todos aparecem. A distância é a maior média menos a menor, calculada sobre esses valores.",
                        "A tie is equality in the cents shown: if more than one submarket has the highest or the lowest average, all of them appear. The distance is the highest average minus the lowest, calculated on these values.",
                      )}
                    </p>
                  </RespostaCurta>
                }
                complemento={
                  <>
                    <TabelaDados
                      id="dia-em-detalhe"
                      recolhida={false}
                      tituloVisivel={tx("O dia em detalhe, por submercado", "The day in detail, by submarket")}
                      lead={tx(
                        "Faixa horária observada, variação contra o dia anterior e posição da média entre as médias diárias desde 2021.",
                        "Observed hourly range, change against the previous day and position of the average among the daily averages since 2021.",
                      )}
                      titulo={tx(`O dia em detalhe por submercado, ${dataBR(pld.dia_referencia)}`, `The day in detail by submarket, ${dataBR(pld.dia_referencia)}`)}
                      colunas={colunasDia}
                      linhas={linhasDia}
                      casas={[null, 2, 2, 2, 2, null]}
                      fixarPrimeiraColuna
                      nota={
                        <>
                      <span className="rotulo mr-1 text-mineral">{tx("O que não é possível concluir:", "What cannot be concluded:")}</span>
                      {tx(
                        "a posição no histórico não diz para onde o preço vai, e a faixa horária mostra os extremos de um único dia. Faixa horária: valores observados; média, variação e percentil: calculados.",
                        "the position in the history does not say where the price is heading, and the hourly range shows the extremes of a single day. Hourly range: observed values; average, change and percentile: calculated.",
                      )}
                        </>
                      }
                    />
                    {textoRegimes && (
                      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="nominal-e-regimes">
                        <span className="rotulo mr-1 text-mineral">{tx("Percentil e faixas:", "Percentile and bands:")}</span>
                        {textoRegimes}{" "}
                        <Link href={`${rotaPainel("p010")}#p010`} className="text-energia-dark underline underline-offset-4">
                          {tx("Ver os limites de cada ano", "See the limits for each year")}
                        </Link>
                        {tx(
                          ". A série semanal do PLD de 2001 a 2020, que a CCEE também publica, tem outra granularidade e ainda não está integrada: as referências começam em janeiro de 2021.",
                          ". The weekly PLD series from 2001 to 2020, which CCEE also publishes, has a different granularity and is not yet integrated: the references start in January 2021.",
                        )}
                      </p>
                    )}
                    {notaPercentis && (
                      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="dois-percentis">
                        {notaPercentis}{" "}
                        <Link href={`${rotaPainel("p011")}#p011`} className="text-energia-dark underline underline-offset-4">
                          {tx("Ver o Histórico", "See the History")}
                        </Link>
                        .
                      </p>
                    )}
                    <p className="text-sm">
                      <Link href={`${rotaPainel("p011")}#p011`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                        {perguntaPainel("p011")} {tx("Percentis da mesma época e médias ponderadas", "Percentiles for the same time of year and weighted averages")}
                      </Link>
                    </p>
                  </>
                }
                // as perguntas irmãs vêm depois das notas e da proveniência da figura, como no desenho anterior (notas, depois capítulos)
                depois={
                  <>
                    <PldCapitulos />
                    <PldSeguir ancora="hoje" proximo={proximoPainel("p008")} downloads={pld.downloads} />
                  </>
                }
              >
                <GraficoBarras
                  titulo={tx(`Média diária do PLD por submercado, ${dataBR(pld.dia_referencia)}`, `Daily PLD average by submarket, ${dataBR(pld.dia_referencia)}`)}
                  series={[{ id: "media", nome: tx("Média diária", "Daily average"), cor: "var(--cor-energia)", pontos: medias.map((m) => ({ x: m.id, rotulo: nomeSm(m.id), y: m.media })) }]} // i18n: dado
                  eixoY={{ unidade: "R$/MWh", zero: true, casas: 2 }}
                  orientacao="horizontal"
                  rotulosValor
                />
                <p className="t-meta mt-3 text-carvao-muted" data-texto="empates-media-diaria">
                  {tx("Escala iniciada em zero e igual para os quatro submercados.", "Scale starting at zero and the same for the four submarkets.")} {empates}
                </p>
              </FiguraAnalitica>
            ) : (
              <Recolhido id="hoje" aberto nivelTitulo={2} titulo={tx("PLD indisponível", "PLD unavailable")} resumo={tx("Os preços do último dia não estão nesta publicação.", "The latest day's prices are not in this release.")}>
                <Indisponivel
                  titulo={tx("PLD indisponível", "PLD unavailable")}
                  motivo={pld?.motivo ? <TrechoPortugues regiao="pld-motivo">{pld.motivo}</TrechoPortugues> : tx("Os dados processados do PLD não foram gerados.", "The processed PLD data were not generated.")}
                />
                <div className="mt-6">
                  <PldCapitulos />
                </div>
              </Recolhido>
            )}

            {integra(pld) && (
              <FiguraAnalitica
                id="periodos"
                pergunta={tx("Em que horas o preço sobe, e as regiões se separam?", "At what hours does the price rise, and do the regions diverge?")}
                subtitulo={tx("PLD por submercado · R$/MWh nominais · hora local de Brasília", "PLD by submarket · nominal R$/MWh · Brasília local time")}
                natureza="OBSERVADO"
                legivel={fonteLegivel}
                proveniencia={provenienciaLegivel(provenienciaSemRessalvaObsoleta(pld.proveniencia.horario))}
                complementares={pld.proveniencia.mensal ? [{ rotulo: tx("Sobre as médias mensais", "On the monthly averages"), p: provenienciaLegivel(provenienciaSemRessalvaObsoleta(pld.proveniencia.mensal)) }] : []}
                oQueMudou={
                        <>
                          {tx(
                            `Nos últimos 30 dias, ${pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de ${reais(pld.limiar_diferenca)}/MWh entre submercados.`,
                            `In the last 30 days, ${pld.periodos["30d"].diferenca.horas_acima_limiar} hours had a difference above ${reais(pld.limiar_diferenca)}/MWh between submarkets.`,
                          )}
                        </>
                }
                comoInterpretar={
                        <>
                          {tx(
                            "Alterne os períodos. O dia de referência, 7 e 30 dias mostram horas; 12 meses mostra médias diárias; o histórico, médias mensais desde 2021.",
                            "Switch between periods. The reference day, 7 and 30 days show hours; 12 months shows daily averages; the history, monthly averages since 2021.",
                          )}
                        </>
                }
                naoConcluir={
                        <>
                          {tx(
                            "Uma posição alta ou baixa no histórico não diz para onde o preço vai. Anos diferentes têm limites regulatórios diferentes (piso e tetos de cada ano, com o ato da ANEEL, no modo Auditar e na página de limites).",
                            "A high or low position in the history does not say where the price is heading. Different years have different regulatory limits (each year's floor and caps, with the ANEEL act, in Audit mode and on the limits page).",
                          )}
                        </>
                }
                tabela={{
                  titulo: tx(`PLD horário por submercado em ${dataBR(pld.curva_horaria.dia)} (R$/MWh; os outros períodos estão no arquivo)`, `Hourly PLD by submarket on ${dataBR(pld.curva_horaria.dia, "en")} (R$/MWh; the other periods are in the file)`),
                  colunas: [tx("Hora", "Hour"), "SE/CO", tx("Sul", "South"), tx("Nordeste", "Northeast"), tx("Norte", "North")],
                  linhas: curvaDoDia.map((r) => [`${r.h}h`, r.SE, r.S, r.NE, r.N]),
                  casas: [null, 2, 2, 2, 2],
                  limite: 24,
                }}
                complemento={
                    <p className="text-sm">
                      <Link href={`${rotaPainel("p010")}#p010`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                        {perguntaPainel("p010")} {tx("Calendário e permanência no piso e nos tetos", "Calendar and time at the floor and caps")}
                      </Link>
                    </p>
                }
              >
                    <PldPeriodos
                      periodos={periodos(pld)}
                      limiar={pld.limiar_diferenca}
                      ponte={pontes}
                      regimes={limDet?.regimes ?? []}
                      fonte={tx("CCEE, PLD horário por submercado", "CCEE, hourly PLD by submarket")}
                      versao={pld.dia_referencia}
                      notaMenorValor={notaMenorValor}
                    />
              </FiguraAnalitica>
            )}

            {integra(pld) && integra(rede) ? (
              <FiguraAnalitica
                id="submercados"
                pergunta={tx("Por que os preços dos submercados podem diferir?", "Why can submarket prices differ?")}
                subtitulo={tx(
                  `PLD médio do dia por submercado e fluxo médio entre as regiões · R$/MWh e MWmed · ${dataBR(rede.dia_referencia)}`,
                  `Day's average PLD by submarket and average flow between regions · R$/MWh and MWavg · ${dataBR(rede.dia_referencia)}`,
                )}
                natureza="OBSERVADO"
                legivel={fonteLegivel}
                proveniencia={provenienciaLegivel(rede.proveniencia.fluxo)}
                complementares={[{ rotulo: tx("Sobre o PLD do dia", "On the day's PLD"), p: provenienciaLegivel(provenienciaSemRessalvaObsoleta(pld.proveniencia.diario)) }]}
                naoConcluir={tx(
                  "O mapa não mostra limites de transferência nem explica diferenças de preço.",
                  "The map does not show transfer limits or explain price differences.",
                )}
                tabela={{
                  titulo: tx("Dados do mapa: PLD médio por submercado e fluxo por fronteira", "Map data: average PLD by submarket and flow by border"),
                  colunas: [tx("Item", "Item"), tx("Valor", "Value"), tx("Unidade", "Unit"), tx("Dia", "Day")],
                  linhas: [
                    ...pld.cartoes.map((c) => [tx(`PLD médio, ${c.nome}`, `Average PLD, ${nomeSm(c.sm)}`), c.media_dia, "R$/MWh", dataBR(pld.dia_referencia)] as CelulaTabela[]),
                    ...rede.fronteiras.map(
                      (f) =>
                        [
                          tx(`Fluxo ${f.nome}`, `Flow between ${nomeSm(f.de, idioma)} and ${nomeSm(f.para, idioma)}`),
                          f.fluxo_dia === null ? null : num(f.fluxo_dia, 0),
                          tx("MWmed", "MWavg"),
                          dataBR(rede.dia_referencia),
                        ] as CelulaTabela[],
                    ),
                  ],
                  casas: [null, 2, null, null],
                }}
              >
                <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <div data-mapa-legado="submercados">
                          <MapaSubmercados
                            fluxos={rede.fronteiras.map((f) => ({ de: f.de, para: f.para, fluxo: f.fluxo_dia }))}
                            precos={
                              diarioDoFluxo
                                ? { SE: diarioDoFluxo.SE, S: diarioDoFluxo.S, NE: diarioDoFluxo.NE, N: diarioDoFluxo.N }
                                : Object.fromEntries(pld.cartoes.map((c) => [c.sm, c.media_dia]))
                            }
                            diaFluxo={dataBR(rede.dia_referencia)}
                            diaPreco={diarioDoFluxo ? dataBR(rede.dia_referencia) : dataBR(pld.dia_referencia)}
                          />
                    </div>
                          {diarioDoFluxo && rede.dia_referencia !== pld.dia_referencia && (
                            <p className="mt-2 text-xs leading-relaxed text-carvao-muted" data-texto="mapa-mesmo-dia">
                              {tx(
                                `O último dia com PLD é ${dataBR(pld.dia_referencia)}; o fluxo do ONS está publicado até ${dataBR(rede.dia_referencia)}. O mapa usa o dia ${dataBR(rede.dia_referencia)} para o preço e para o fluxo, e as setas mostram o sentido da média do dia.`,
                                `The latest day with a PLD is ${dataBR(pld.dia_referencia)}; the ONS flow is published through ${dataBR(rede.dia_referencia)}. The map uses ${dataBR(rede.dia_referencia)} for both price and flow, and the arrows show the direction of the day's average.`,
                              )}
                            </p>
                          )}
                          {sentidosNoDia.some((x) => x.horas > 0) && (
                            <div className="mt-2 text-xs leading-relaxed text-carvao-muted" data-texto="horas-por-sentido">
                              <p className="font-medium text-carvao">
                                {tx(`Horas em cada sentido em ${dataBR(rede.dia_referencia)}, no arquivo horário do ONS:`, `Hours in each direction on ${dataBR(rede.dia_referencia)}, in the ONS hourly file:`)}
                              </p>
                              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                {sentidosNoDia.map((x) => {
                                  const t = textoSentidoNoDia(x);
                                  return t ? <li key={x.fronteira}>{t}</li> : null;
                                })}
                              </ul>
                            </div>
                          )}
                  </div>
                        <div className="min-w-0 space-y-4 leading-relaxed text-carvao">
                          <p>
                            {tx(
                              <>
                                A CCEE calcula um PLD para cada submercado. As regiões estão ligadas por linhas de transmissão de fronteira, e o ONS mede o{" "}
                                <Termo slug="intercambio">intercâmbio</Termo> entre elas hora a hora, em MWmed (megawatt médio).
                              </>,
                              <>
                                CCEE calculates a PLD for each submarket. The regions are connected by border transmission lines, and ONS measures the{" "}
                                <Termo slug="intercambio">interchange</Termo> between them hour by hour, in MWavg (average megawatts).
                              </>,
                            )}
                          </p>
                          <p className="border border-dashed border-mineral p-3 text-sm text-carvao-muted">
                            <span className="rotulo mb-1 block text-mineral">{tx("Leitura usual do setor, ainda não conferida em documento primário", "Usual reading in the sector, not yet checked in a primary document")}</span>
                            {tx(
                              "Se a energia pudesse circular sem limite, o custo de atender uma carga a mais seria o mesmo em todo lugar. Como a capacidade de transferência entre regiões é finita, uma região com sobra pode não conseguir enviar tudo o que teria para outra, e os preços se separam.",
                              "If energy could flow without limit, the cost of serving one more unit of load would be the same everywhere. As transfer capacity between regions is finite, a region with surplus might not be able to send everything it has to another, and prices diverge.",
                            )}
                          </p>
                          <ul className="space-y-1 text-xs text-mineral">
                            <li className="flex flex-wrap items-center gap-2">
                              {tx("Definições de PLD por submercado (CCEE) e de intercâmbio (ONS):", "Definitions of PLD by submarket (CCEE) and of interchange (ONS):")} <Conferido ok />
                            </li>
                            <li className="flex flex-wrap items-center gap-2">
                              {tx("Mecanismo de separação por limite de transferência:", "Mechanism of divergence by transfer limit:")} <Conferido ok={false} />
                            </li>
                          </ul>
                          <p className="flex flex-wrap items-center gap-2 border-l-2 border-energia pl-4 text-sm text-carvao-muted">
                            <span>
                              {rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia) ? (
                                <>
                                  {tx(
                                    `Em ${dataBR(pld.dia_referencia)}, a diferença entre o maior e o menor PLD médio foi de ${reais(rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia)!.amplitude)}/MWh.`,
                                    `On ${dataBR(pld.dia_referencia)}, the difference between the highest and the lowest average PLD was ${reais(rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia)!.amplitude)}/MWh.`,
                                  )}{" "}
                                </>
                              ) : null}
                              {tx(
                                `Nos últimos 30 dias, ${pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de ${reais(pld.limiar_diferenca)}/MWh.`,
                                `In the last 30 days, ${pld.periodos["30d"].diferenca.horas_acima_limiar} hours had a difference above ${reais(pld.limiar_diferenca)}/MWh.`,
                              )}
                            </span>
                            <SeloNatureza natureza="CALCULADO" />
                          </p>
                        </div>
                </div>
              </FiguraAnalitica>
            ) : (
              <Recolhido id="submercados" aberto nivelTitulo={2} titulo={tx("Por que os preços dos submercados podem diferir?", "Why can submarket prices differ?")} resumo={tx("Dados de rede indisponíveis nesta publicação.", "Grid data unavailable in this release.")}>
                <Indisponivel
                  titulo={tx("Dados de rede indisponíveis", "Grid data unavailable")}
                  motivo={tx("As golds de rede ou de PLD não foram geradas nesta publicação.", "The grid or PLD gold files were not generated in this publication.")}
                />
              </Recolhido>
            )}

            {integra(rede) && (
              <FiguraAnalitica
                id="amplitude"
                pergunta={tx("Quando os submercados se separaram no último ano?", "When did the submarkets diverge in the last year?")}
                subtitulo={tx("Diferença entre o maior e o menor PLD médio diário · R$/MWh · quatro submercados", "Difference between the highest and the lowest daily average PLD · R$/MWh · four submarkets")}
                natureza="CALCULADO"
                legivel={fonteLegivel}
                proveniencia={provenienciaLegivel(rede.proveniencia.amplitude)}
                oQueMudou={<>{textoAmplitude(rede.resumo_amplitude)}</>}
                comoInterpretar={
                          <>
                            {tx(
                              "Zero significa os quatro submercados com a mesma média diária. A série usa médias diárias; diferenças de poucas horas podem sumir na média.",
                              "Zero means the four submarkets had the same daily average. The series uses daily averages; differences lasting a few hours can vanish in the average.",
                            )}
                          </>
                }
                naoConcluir={
                          <>
                            {tx(
                              "A série não identifica qual fronteira ou linha causou a separação, nem se o limite de transferência foi atingido: os limites não estão integrados. A causa de uma separação não é atribuída.",
                              "The series does not identify which border or line was behind the divergence, nor whether the transfer limit was reached: the limits are not integrated. No reason is attributed to a divergence.",
                            )}
                          </>
                }
                tabela={{
                  titulo: tx("Diferença entre o maior e o menor PLD médio diário (R$/MWh)", "Difference between the highest and the lowest daily average PLD (R$/MWh)"),
                  colunas: [tx("Dia", "Day"), tx("Diferença (R$/MWh)", "Difference (R$/MWh)")],
                  linhas: amplitude.map((a) => [dataBR(a.x), a.amp]),
                  casas: [null, 2],
                }}
                complemento={
                      <p className="text-sm">
                        <Link href={`${rotaPainel("p012")}#p012`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                          {perguntaPainel("p012")} {tx("Separação hora a hora, por par e com o fluxo na mesma hora", "Divergence hour by hour, by pair and with the flow in the same hour")}
                        </Link>
                      </p>
                }
              >
                <GraficoLinhas
                  titulo={tx("Diferença entre o maior e o menor PLD médio diário", "Difference between the highest and the lowest daily average PLD")}
                  series={[{ id: "amp", nome: tx("Diferença máx.−mín.", "Max−min difference"), cor: "var(--cor-energia)", pontos: amplitude.map((a) => ({ x: a.x, y: a.amp })) }]} // i18n: dado
                  eixoY={{ unidade: "R$/MWh", zero: true, casas: 2 }}
                />
              </FiguraAnalitica>
            )}

            {/* a aula: o que é o PLD, o que ele não é e as bases conferidas; capítulo aberto, que o leitor pode recolher */}
            <Recolhido id="o-que-e" aberto nivelTitulo={2} titulo={tx("O que é o PLD, e o que ele não é", "What the PLD is, and what it is not")} resumo={tx("Entenda em 90 segundos", "Understand it in 90 seconds")}>
              <div className="space-y-6">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div>
                {/* Entender: a resposta curta. A norma, as citações e a leitura usual do setor estão em Analisar */}
                <p className="ed-lead text-carvao">
                  {tx(
                    <>
                      No <Termo slug="mcp">Mercado de Curto Prazo</Termo>, a CCEE compara, hora a hora e por submercado, a energia que cada agente contratou com a que gerou ou
                      consumiu de fato, e calcula o resultado financeiro dessa diferença. O PLD é o preço desse mercado.
                    </>,
                    <>
                      In the <Termo slug="mcp">Short-Term Market</Termo>, CCEE compares, hour by hour and by submarket, the energy each agent contracted with what it actually
                      generated or consumed, and calculates the financial result of that difference. The spot price (PLD) is the price of this market.
                    </>,
                  )}
                </p>
                <p className="mt-3 text-base leading-relaxed text-carvao">
                  {tx(
                    <>
                      É um valor em R$/MWh que a CCEE calcula todos os dias para cada hora do dia seguinte e para cada um dos quatro <Termo slug="submercado">submercados</Termo>. O
                      cálculo é feito por modelos computacionais (<Termo slug="newave">NEWAVE</Termo>, <Termo slug="decomp">DECOMP</Termo> e <Termo slug="dessem">DESSEM</Termo>), tem
                      como base o <Termo slug="cmo">custo marginal de operação</Termo> e respeita os <Termo slug="limites-do-pld">limites mínimo e máximos</Termo> vigentes.
                    </>,
                    <>
                      It is a value in R$/MWh that CCEE calculates every day for each hour of the following day and for each of the four <Termo slug="submercado">submarkets</Termo>.
                      The calculation is made by computer models (<Termo slug="newave">NEWAVE</Termo>, <Termo slug="decomp">DECOMP</Termo> and <Termo slug="dessem">DESSEM</Termo>),
                      is based on the <Termo slug="cmo">marginal operating cost</Termo> (CMO) and respects the <Termo slug="limites-do-pld">minimum and maximum limits</Termo> in force.
                    </>,
                  )}
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mineral [overflow-wrap:anywhere]">
                  {tx(
                    `Base: descrições oficiais da CCEE no portal de dados abertos, capturadas em ${dataBR("2026-09-27")} e ${dataBR("2026-09-28")}.`,
                    `Basis: official CCEE descriptions on the open data portal, captured on ${dataBR("2026-09-27")} and ${dataBR("2026-09-28")}.`,
                  )}{" "}
                  <Conferido ok />
                  <span data-nivel="auditar">
                    {" "}
                    {tx("Conjuntos consultados:", "Datasets consulted:")}{" "}
                    <Nome>PLD_HORARIO, PLD_HORARIO_SUBMERCADO, SUMARIO_BE_HORARIO_SUBMERCADO</Nome> {tx("e", "and")} <Nome>SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO</Nome>.
                  </span>
                </p>

                <div data-nivel="analisar" className="mt-6 space-y-6" data-bloco="aula-analisar">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      "A CCEE publica os valores do balanço de energia (MWh) e do resultado (R$) somados por submercado e hora e, no consolidado do mês, separa o resultado de venda e o de compra; na descrição da CCEE, os dois são apurados para cada perfil de agente, por submercado e hora.",
                      "CCEE publishes the energy balance (MWh) and result (R$) values summed by submarket and hour and, in the monthly consolidation, separates the sales result from the purchase result; in the CCEE description, both are calculated for each agent profile, by submarket and hour.",
                    )}
                  </p>
                  {passagem("ren957_art5_p4") && (
                    <div className="border-l-2 border-energia pl-4 text-sm leading-relaxed text-carvao">
                      <p className="rotulo text-mineral">{tx("O que a norma diz", "What the rule says")}</p>
                      <p className="mt-2">
                        {tx(
                          "Pela Convenção de Comercialização da ANEEL, as operações no Mercado de Curto Prazo são contabilizadas pela CCEE e as exposições dos agentes são valoradas ao PLD. A plataforma não mostra valores de liquidação de nenhum agente: o painel abaixo traz um exemplo sintético, com quantidades hipotéticas e o PLD real de uma hora, para mostrar o mecanismo.",
                          "Under ANEEL's Trading Convention, operations in the Short-Term Market are accounted by CCEE and agents' exposures are valued at the PLD. The platform does not show settlement values for any agent: the panel below gives a synthetic example, with hypothetical quantities and the real PLD of one hour, to show the mechanism.",
                        )}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
                        <Nome>{passagem("ren957_art5_p4")!.origem}</Nome>. <Conferido ok />
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="leading-relaxed text-carvao-muted">
                      {tx(
                        "Como o balanço de cada agente é formado (contratos, geração e consumo medidos) e como o resultado é liquidado entre quem vende e quem compra estão nas Regras de Comercialização da CCEE.",
                        "How each agent's balance is formed (contracts, measured generation and consumption) and how the result is settled between sellers and buyers are set out in the CCEE Trading Rules.",
                      )}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral [overflow-wrap:anywhere]">
                      {tx("Regras de Comercialização:", "Trading Rules:")} <Conferido ok={false} />{" "}
                      {bloqueioCcee ? (
                        <>
                          {tx("o documento não pôde ser lido nesta publicação.", "the document could not be read in this publication.")}{" "}
                          <TrechoPortugues regiao="pld-bloqueio">{bloqueioCcee.consequencia}</TrechoPortugues>
                          {/* a frase da recusa já sai no idioma da página, com a data da evidência nos dois */}
                          {fraseDeRecusa(bloqueioCcee.evidencia, "da CCEE") // i18n: dado
                            ? ` ${fraseDeRecusa(bloqueioCcee.evidencia, "da CCEE")}` // i18n: dado
                            : ""}
                          <span data-nivel="auditar">
                            {" "}
                            {tx("Evidência registrada:", "Recorded evidence:")} <TrechoPortugues regiao="pld-bloqueio">{bloqueioCcee.evidencia.replace(/\.$/, "")}</TrechoPortugues>.
                          </span>
                        </>
                      ) : (
                        tx("documento não conferido nesta publicação.", "document not checked in this publication.")
                      )}
                    </p>
                  </div>
                  <div className="border-l-2 border-energia pl-5">
                    <p className="rotulo text-mineral">{tx("A ideia central", "The central idea")}</p>
                    {textoHidraulicaBalanco(ger) && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 leading-relaxed text-carvao">
                        <span>{textoHidraulicaBalanco(ger)}</span>
                        <SeloNatureza natureza="ESTIMADO" />
                      </p>
                    )}
                    <p className="mt-3 border border-dashed border-mineral p-3 text-sm leading-relaxed text-carvao-muted">
                      <span className="rotulo mb-1 block text-mineral">{tx("Leitura usual do setor, ainda não conferida em documento primário", "Usual reading in the sector, not yet checked in a primary document")}</span>
                      {tx(
                        <>
                          O sistema brasileiro é descrito como <strong className="font-medium">hidrotérmico e intertemporal</strong>: parte da geração hidráulica vem de usinas com
                          reservatório, e a água usada agora não estará disponível depois. Nessa leitura, a água guardada tem valor para o futuro, esse valor pesa na decisão de gerar
                          com água agora ou acionar outras fontes, e o preço sai dessa decisão, não de uma única variável.
                        </>,
                        <>
                          The Brazilian system is described as <strong className="font-medium">hydrothermal and intertemporal</strong>: part of hydro generation comes from plants with
                          reservoirs, and water used now will not be available later. In this reading, stored water has a value for the future, that value weighs on the decision to
                          generate with water now or to dispatch other sources, and the price comes out of that decision, not out of a single variable.
                        </>,
                      )}
                    </p>
                    {passagem("dessem_acoplamento") && (
                      <div className="mt-3">
                        <PldPassagem p={passagem("dessem_acoplamento")!} />
                      </div>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral [overflow-wrap:anywhere]">
                      {tx("Mecanismo do valor da água:", "Mechanism of the value of water:")} <Conferido ok={false} />{" "}
                      {bloqueioCepel
                        ? tx(
                            "o manual do DESSEM confirma o acoplamento pela função de custo futuro (trecho acima), mas não descreve o valor da água; os manuais do DECOMP e do NEWAVE não estão entre os arquivos públicos do CEPEL.",
                            "the DESSEM manual confirms the coupling through the future cost function (excerpt above), but does not describe the value of water; the DECOMP and NEWAVE manuals are not among CEPEL's public files.",
                          )
                        : tx("documentação dos modelos não acessada nesta publicação.", "model documentation not accessed in this publication.")}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="rotulo text-mineral">{tx("O que o PLD não é", "What the PLD is not")}</h3>
                <ul className="mt-3 space-y-5">
                  {PLD_NAO_E.map((x, i) => {
                    // o cartão da tarifa é reconhecido pelo título em português, o mesmo nos dois idiomas
                    const tarifa = /tarifa/i.test(PLD_NAO_E_IDIOMAS.pt[i]?.titulo ?? "");
                    return (
                      <li key={x.titulo} className="border-l-2 border-linha pl-4">
                        <p className="font-medium text-carvao">{x.titulo}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{x.porque}</p>
                        {tarifa && (
                          <div className="mt-2" data-texto="pld-e-conta">
                            {/* a frase do registro de contrastes repete o que o cartão já diz (e não expande TE e TUSD): fica em Analisar, e o link fica à vista */}
                            <p data-nivel="analisar" className="text-sm leading-relaxed text-carvao-muted">
                              {ligacaoComAConta(idioma)}
                            </p>
                            <Link href="/setor-eletrico/conta-de-luz" className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                              {tx("Ver como a conta de luz é formada", "See how the electricity bill is made up")}
                            </Link>
                          </div>
                        )}
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
                          {x.base} <Conferido ok={x.conferencia === "CONFERIDO"} />
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            {cPld?.fontes[0]?.trecho && (
              <blockquote data-nivel="auditar" className="border border-linha bg-superficie p-5 text-sm leading-relaxed text-carvao-muted">
                <p className="rotulo mb-2 text-mineral">{tx("Íntegra da fonte (CCEE)", "Full source text (CCEE)")}</p>
                <TrechoPortugues regiao="trecho-pld">“{cPld.fontes[0].trecho}”</TrechoPortugues>
                <footer className="mt-2 text-xs text-mineral">
                  <a href={cPld.fontes[0].url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {marcadoMercado(cPld.fontes[0].documento, idioma)}
                  </a>
                </footer>
              </blockquote>
            )}
              </div>
            </Recolhido>

            {/* de onde vem o preço: a formação em etapas (P008), o exemplo de liquidação e o CMO */}
            <Recolhido id="formacao" aberto nivelTitulo={2} titulo={tx("De onde vem o preço", "Where the price comes from")} resumo={tx("A formação do preço em etapas, um exemplo sintético de liquidação e o CMO na mesma semana.", "Price formation in stages, a synthetic settlement example and the CMO in the same week.")}>
              <div className="space-y-10">
                {conceitoDet && ligacoes && resumoLig && docs && integra(pld) ? (
                  <>
                    <FiguraAnalitica
                      id="p008"
                      nivelTitulo={3}
                      pergunta={perguntaPainel("p008")}
                      subtitulo={tx(
                        "Conceito nas normas vigentes, formação do preço em etapas e exemplo sintético de liquidação · R$/MWh",
                        "Concept in the rules in force, price formation in stages and a synthetic settlement example · R$/MWh",
                      )}
                      natureza="OBSERVADO"
                      legivel={fonteLegivel}
                      porQueImporta={tx(
                        "O PLD não é tarifa nem cotação de bolsa: é o preço que valora as diferenças entre o contratado e o verificado no Mercado de Curto Prazo, calculado a partir do custo marginal dos modelos oficiais e limitado pela ANEEL. Saber de onde ele vem ajuda a não confundir regra com causa.",
                        "The PLD is neither a tariff nor an exchange quote: it is the price that values the differences between contracted and verified energy in the Short-Term Market, calculated from the marginal cost of the official models and bounded by ANEEL. Knowing where it comes from helps avoid confusing a rule with a driver.",
                      )}
                      oQueMudou={
                  <>
                    {tx(
                      `Passagens conferidas nos documentos baixados até ${dataBR(detalhe!.gerado_em.slice(0, 10))}: ${resumoLig.conferidas} de ${resumoLig.total} ligações do diagrama conferidas.`,
                      `Passages checked in the documents downloaded through ${dataBR(detalhe!.gerado_em.slice(0, 10))}: ${resumoLig.conferidas} of ${resumoLig.total} diagram links checked.`,
                    )}
                    {resumoLig.pendentes.length
                      ? tx(
                          ` Pendentes: ${resumoLig.pendentes.map((l) => `${NOS_FORMACAO.find((n) => n.id === l.de)?.titulo ?? l.de} para ${NOS_FORMACAO.find((n) => n.id === l.para)?.titulo ?? l.para}`).join("; ")}.`, // i18n: dado
                          ` Pending: ${resumoLig.pendentes.map((l) => `${NOS_FORMACAO.find((n) => n.id === l.de)?.titulo ?? l.de} to ${NOS_FORMACAO.find((n) => n.id === l.para)?.titulo ?? l.para}`).join("; ")}.`,
                        )
                      : ""}
                  </>
                      }
                comoInterpretar={tx(
                  "Toque em cada etapa do diagrama: o detalhe, ao lado do diagrama em tela larga e abaixo dele no celular, diz o que ela é, o último dado publicado quando há dado integrado e cada ligação com a etapa seguinte, com o tipo da relação e o trecho do documento que a sustenta. Ligação marcada como pendente tem só base editorial.",
                  "Tap each stage of the diagram: the detail, next to the diagram on a wide screen and below it on a phone, says what the stage is, the latest published data when data is integrated and each link to the next stage, with the type of relation and the document excerpt that supports it. A link marked as pending has only an editorial basis.",
                )}
                naoConcluir={tx(
                  "O exemplo de liquidação é sintético: não reproduz a contabilização de nenhum agente nem de nenhum mês, e a convenção de crédito e débito é do exemplo, porque as regras algébricas da CCEE estão inacessíveis. O diagrama descreve regras e entradas dos modelos; não mede quanto cada etapa pesou no preço de uma hora.",
                  "The settlement example is synthetic: it does not reproduce the accounting of any agent or any month, and the credit and debit convention belongs to the example, since the CCEE algebraic rules are inaccessible. The diagram describes rules and model inputs; it does not measure how much each stage weighed on the price of an hour.",
                )}
                      proveniencia={provenienciaLegivel(pld.proveniencia.horario)}
                      tabela={{
                        titulo: tx("Ligações do diagrama da formação do PLD e a conferência de cada uma", "Links in the PLD formation diagram and the check of each one"),
                        colunas: [tx("Etapa", "Stage"), tx("Liga-se a", "Links to"), tx("Tipo de relação", "Type of relation"), tx("Conferência", "Check")],
                        linhas: linhasFormacao,
                        limite: Math.max(30, linhasFormacao.length),
                      }}
                      leitura={
                  <RespostaCurta id="p008" veredito={vereditoP008(conceitoDet)}>
                    {respostaP008(conceitoDet, ligacoes)}
                  </RespostaCurta>
                      }
                      complemento={
                        <>
                  <PldRecorte
                    periodo={tx(
                      `Normas e procedimentos vigentes, conferidos nas capturas mais recentes; exemplo com o PLD de ${exemplo ? `${dataBR(exemplo.pld.hora)} às ${exemplo.pld.hora.slice(11, 13)}h` : "uma hora real"}`,
                      `Rules and procedures in force, checked in the most recent captures; example with the PLD of ${exemplo ? textoHora(exemplo.pld.hora) : "a real hour"}`,
                    )}
                    universo={tx("Mercado de Curto Prazo da CCEE; PLD horário dos quatro submercados", "CCEE Short-Term Market; hourly PLD of the four submarkets")}
                    unidade={tx("R$/MWh (preço); MWh e R$ no exemplo", "R$/MWh (price); MWh and R$ in the example")}
                  />
                  <div className="grid gap-3 md:grid-cols-2" data-nivel="analisar">
                    {["ren957_art2_xiii", "ren957_art5_p4", "d5163_art57_p1", "ren957_art78"].map((id) => {
                      const f = passagem(id);
                      return f ? <PldPassagem key={id} p={f} compacta /> : null;
                    })}
                  </div>
                        </>
                      }
                      depois={<PldSeguir ancora="p008" proximo={proximoPainel("p008")} downloads={detalhe!.downloads.filter((d) => /cmo_horario/.test(d.url))} />}
                    >
                      <SecaoDoPainel id="diagrama-formacao" titulo={tx("O PLD emerge de um sistema, não de uma variável", "The PLD emerges from a system, not from a single variable")}>
                        <div data-figura-legado="formacao">
                          <PldFormacao nos={nos} ligacoes={ligacoes} />
                        </div>
                      </SecaoDoPainel>
                    </FiguraAnalitica>

                  {exemplo && (
                    <SecaoDoPainel
                      id="exemplo-liquidacao"
                      titulo={tx("Como a diferença entre contratado e verificado é valorada ao PLD?", "How is the difference between contracted and verified energy valued at the PLD?")}
                    >
                      <div className="space-y-3 border border-dashed border-mineral bg-papel p-4 md:p-5">
                        <p className="rotulo text-mineral">{tx("Exemplo sintético, não é contabilização real", "Synthetic example, not real accounting")}</p>
                        <p className="text-sm leading-relaxed text-carvao">
                          <PldTextoGold texto={exemplo.aviso} regiao="pld-exemplo" />
                        </p>
                        <p className="text-sm text-carvao-muted">
                          {tx(
                            `PLD usado: ${reais(exemplo.pld.valor)}/MWh, ${exemplo.pld.nome}, ${dataBR(exemplo.pld.hora)} às ${exemplo.pld.hora.slice(11, 13)}h (`,
                            `PLD used: ${reais(exemplo.pld.valor)}/MWh, ${nomeSm(exemplo.pld.sm)}, ${textoHora(exemplo.pld.hora)} (`,
                          )}
                          <PldTextoGold texto={exemplo.pld.fonte.replace(/PLD_HORARIO/g, "PLD horário por submercado")} regiao="pld-exemplo" />;{" "}
                          <PldTextoGold texto={exemplo.pld.regra_escolha} regiao="pld-exemplo" />) <SeloNatureza natureza="OBSERVADO" />
                        </p>
                        <p className="text-sm text-carvao-muted">
                          {tx("Regra do exemplo:", "Example rule:")} <PldTextoGold texto={exemplo.formula} regiao="pld-exemplo" />.
                        </p>
                        <TabelaDados
                          recolhida={false}
                          titulo={tx("Exemplo sintético de liquidação: quantidades hipotéticas e PLD real da hora", "Synthetic settlement example: hypothetical quantities and the real PLD of the hour")}
                          colunas={[
                            tx("Agente hipotético", "Hypothetical agent"),
                            tx("Compras contratadas (MWh)", "Contracted purchases (MWh)"),
                            tx("Vendas contratadas (MWh)", "Contracted sales (MWh)"),
                            tx("Geração verificada (MWh)", "Verified generation (MWh)"),
                            tx("Consumo verificado (MWh)", "Verified consumption (MWh)"),
                            tx("Diferença (MWh)", "Difference (MWh)"),
                            tx("Valor no MCP", "Value in the MCP"),
                          ]}
                          linhas={exemplo.agentes.map((a) => [
                            <PldTextoGold key="r" texto={a.rotulo} regiao="pld-exemplo" />,
                            a.compras_contratadas_mwh,
                            a.vendas_contratadas_mwh,
                            a.geracao_verificada_mwh,
                            a.consumo_verificado_mwh,
                            a.diferenca_mwh,
                            <span key="v">
                              {reais(a.valor_rs)} (<PldTextoGold texto={a.resultado} regiao="pld-exemplo" />)
                            </span>,
                          ])}
                          casas={[null, 0, 0, 0, 0, 0, null]}
                          limite={exemplo.agentes.length}
                        />
                        <p className="text-sm leading-relaxed text-carvao">
                          <PldTextoGold texto={exemplo.leitura} regiao="pld-exemplo" />
                        </p>
                        <div>
                          <p className="rotulo text-mineral">{tx("Simplificações do exemplo", "Simplifications of the example")}</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
                            {exemplo.simplificacoes.map((t) => (
                              <li key={t}>
                                <PldTextoGold texto={semCodigoHttp(t)} regiao="pld-exemplo" />
                              </li>
                            ))}
                          </ul>
                        </div>
                        <details className="text-sm">
                          <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">
                            {tx("Base normativa do exemplo", "Regulatory basis of the example")}
                          </summary>
                          <div className="mt-2 space-y-2">
                            {exemplo.base_normativa.map((id) => {
                              const f = passagem(id);
                              return f ? <PldPassagem key={id} p={f} /> : null;
                            })}
                          </div>
                        </details>
                      </div>
                    </SecaoDoPainel>
                  )}

                  <SecaoDoPainel id="tipos-de-relacao" titulo={tx("Tipos de relação usados no diagrama", "Types of relation used in the diagram")} nivel="analisar">
                    <dl className="grid gap-3 md:grid-cols-2">
                      {Object.values(TIPOS_RELACAO).map((t) => (
                        <div key={t.rotulo}>
                          <dt className="font-medium text-carvao">{t.rotulo}</dt>
                          <dd className="text-sm text-carvao-muted">{t.definicao}</dd>
                        </div>
                      ))}
                    </dl>
                  </SecaoDoPainel>

                  <SecaoDoPainel id="cmo" titulo={tx("CMO e PLD: três produtos na mesma semana", "CMO and PLD: three products in the same week")}>
                    {semanaRef ? (
                      <>
                        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                          {tx(
                            `Semana operativa de ${dataBR(semanaRef.inicio)} a ${dataBR(semanaRef.fim)}: o CMO semanal do DECOMP (ONS), a média das meias horas do CMO do DESSEM (ONS) e a média das horas do PLD (CCEE), em R$/MWh. São produtos diferentes; a comparação só vale no mesmo intervalo.`,
                            `Operating week from ${dataBR(semanaRef.inicio)} to ${dataBR(semanaRef.fim)}: the weekly DECOMP marginal operating cost (CMO) (ONS), the average of the half hours of the DESSEM CMO (ONS) and the average of the PLD hours (CCEE), in R$/MWh. They are different products; the comparison only holds over the same interval.`,
                          )}
                        </p>
                        <TabelaDados
                          recolhida={false}
                          titulo={tx("CMO semanal do DECOMP, média do DESSEM e média do PLD na semana de referência, R$/MWh", "Weekly DECOMP CMO, DESSEM average and PLD average in the reference week, R$/MWh")}
                          colunas={[tx("Submercado", "Submarket"), tx("CMO semanal (DECOMP)", "Weekly CMO (DECOMP)"), tx("Média do DESSEM", "DESSEM average"), tx("Média do PLD", "PLD average")]}
                          linhas={semanaRef.por_sm.map((x) => [nomeSm(x.sm), reais(x.decomp), reais(x.dessem), reais(x.pld)])}
                          limite={semanaRef.por_sm.length}
                        />
                      </>
                    ) : (
                      <p className="text-sm text-carvao-muted">
                        {tx("Nenhuma semana operativa completa nos três produtos nesta publicação.", "No operating week complete in all three products in this publication.")}
                      </p>
                    )}
                    <p className="text-sm">
                      <Link href={`${rotaPainel("p009")}#p009`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                        {tx(
                          "Séries alinhadas, momento do cálculo e relação por ano no painel CMO e formação de preço",
                          "Aligned series, calculation time and relation by year in the CMO and price formation panel",
                        )}
                      </Link>
                    </p>
                  </SecaoDoPainel>

                  <SecaoDoPainel
                    id="normas"
                    titulo={tx("Documentos normativos e técnicos citados, com a passagem conferida", "Regulatory and technical documents cited, with the passage checked")}
                    nivel="auditar"
                  >
                    {docs.documentos.map((d) => (
                      <div key={d.id} className="space-y-2">
                        <p className="text-sm text-carvao [overflow-wrap:anywhere]">
                          <span className="font-medium">
                            <Nome>{d.doc.titulo}</Nome>
                          </span>
                          . {tx("Órgão:", "Body:")} <Nome>{d.doc.orgao}</Nome>.{" "}
                          <a href={d.doc.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                            {tx("Endereço oficial", "Official address")}
                          </a>
                          {d.doc.url_copia ? (
                            <>
                              {"; "}
                              <a href={d.doc.url_copia} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                                {tx("cópia lida", "copy read")}
                              </a>
                            </>
                          ) : null}
                          {tx<ReactNode>(
                            `. Captura de ${carimbo(d.doc.capturado_em)}; sha256 ${d.doc.sha256 ?? "não registrado"}.`,
                            <>
                              . Captured on {carimbo(d.doc.capturado_em)}; sha256 {d.doc.sha256 ? identificador(d.doc.sha256, idioma) : "not recorded"}.
                            </>,
                          )}{" "}
                          <TrechoPortugues regiao="pld-licenca">{d.doc.licenca}</TrechoPortugues>
                        </p>
                        {d.passagens.length === 0 ? (
                          <p className="text-xs text-aviso">{tx("Nenhuma passagem deste documento conferida nesta publicação.", "No passage of this document checked in this publication.")}</p>
                        ) : (
                          d.passagens.map((f) => <PldPassagem key={f.id} p={f} compacta />)
                        )}
                      </div>
                    ))}
                    <p className="rotulo text-mineral">{tx("Descrições oficiais dos conjuntos de dados", "Official descriptions of the datasets")}</p>
                    {docs.descricoes.map((f) => (
                      <PldPassagem key={f.id} p={f} />
                    ))}
                    {conceitoDet.normas_nao_conferidas.length > 0 && (
                      <PldAviso tipo="alerta">
                        {tx("Passagens não conferidas e fora da página:", "Passages not checked and left off the page:")}{" "}
                        <TrechoPortugues regiao="pld-normas">{conceitoDet.normas_nao_conferidas.map((n) => `${n.documento}, ${n.dispositivo} (${n.motivo})`).join("; ")}</TrechoPortugues>.
                      </PldAviso>
                    )}
                  </SecaoDoPainel>

                  <SecaoDoPainel id="bloqueios" titulo={tx("O que não foi possível conferir e por quê", "What could not be checked, and why")} nivel="auditar">
                    <ul className="space-y-2 text-sm text-carvao-muted">
                      {conceitoDet.bloqueios.map((b) => (
                        <li key={b.fonte} className="leading-relaxed [overflow-wrap:anywhere]">
                          <TrechoPortugues regiao="pld-bloqueio">
                            <span className="text-carvao">{b.fonte}</span>: {semUtc(datasLegiveis(b.evidencia.replace(/\.$/, ""), "pt"), "pt")}. {semUtc(datasLegiveis(b.consequencia, "pt"), "pt")}
                          </TrechoPortugues>
                        </li>
                      ))}
                    </ul>
                  </SecaoDoPainel>
                  </>
                ) : (
                  <>
                <PldAviso tipo="alerta">
                  {tx(
                    "As passagens normativas conferidas não estão nesta publicação: o diagrama abaixo mostra só as ligações do conteúdo editorial, com o estado de conferência de cada uma.",
                    "The checked regulatory passages are not in this publication: the diagram below shows only the links from the editorial content, with the verification state of each.",
                  )}
                </PldAviso>
                <PldFormacao nos={nos} ligacoes={Object.fromEntries(nos.map((n) => [n.id, n.relacaoSaida ? [{ de: n.id, para: n.relacaoSaida.para, tipo: n.relacaoSaida.tipo, texto: n.relacaoSaida.texto, estado: n.relacaoSaida.conferencia, bases: [], faltantes: [], baseTexto: n.relacaoSaida.fonte, origem: "conteudo" as const }] : []]))} />
                  </>
                )}
              </div>
            </Recolhido>

            {/* para onde o PLD pode ir: o estado real da previsão */}
            <Recolhido id="previsao" aberto nivelTitulo={2} titulo={tx("Para onde o PLD pode ir?", "Where could the PLD go?")} resumo={tx("Previsão é distribuição de possibilidades, não um único número.", "A forecast is a distribution of possibilities, not a single number.")}>
              <div className="space-y-6">
            <div className="grid items-start gap-8 lg:grid-cols-2">
              <IlustracaoDistribuicao />
              <div>
                {prev && !prev.atual.disponivel ? (
                  <Indisponivel
                    titulo={tx("Previsão indisponível", "Forecast unavailable")}
                    motivo={
                      <>
                        <TrechoPortugues regiao="pld-previsao-motivo">{prev.atual.motivo}</TrechoPortugues>{" "}
                        {tx("A Scrutiniums não publica previsão de modelo em pesquisa ou em validação.", "Scrutiniums does not publish forecasts from models in research or validation.")}
                      </>
                    }
                    ultimaExecucao={
                      ult ? (
                        <>
                          {tx(
                            `${rotuloTipo(ult.tipo).replace(/^./, (c) => c.toUpperCase())} de ${dataBR(ult.origem)}, com o modelo ${ult.modelo} (${ult.estado_modelo === "PESQUISA" ? "em pesquisa" : ult.estado_modelo.toLowerCase()}): ${ult.celulas} previsões tentadas, ${ult.com_numero === 0 ? "nenhuma com número" : `${ult.com_numero} com número`}.`,
                            `${rotuloTipo(ult.tipo).replace(/^./, (c) => c.toUpperCase())} of ${dataBR(ult.origem)}, with model ${ult.modelo} (${ult.estado_modelo === "PESQUISA" ? "in research" : rotuloEstadoModeloEn(ult.estado_modelo)}): ${ult.celulas} forecasts attempted, ${ult.com_numero === 0 ? "none with a number" : `${ult.com_numero} with a number`}.`,
                          )}
                          {ult.motivos.length > 0 ? tx(` Motivo: ${ult.motivos.map((m) => textoMotivo(m)).join("; ")}.`, ` Reason: ${ult.motivos.map((m) => textoMotivo(m)).join("; ")}.`) : ""}
                        </>
                      ) : (
                        tx("Nenhuma rodada registrada.", "No run recorded.")
                      )
                    }
                    faltante={prev.atual.informacao_faltante?.map((f) => (
                      <TrechoPortugues key={f} regiao="pld-previsao-motivo">
                        {f}
                      </TrechoPortugues>
                    ))}
                    estado={
                      <TrechoPortugues regiao="pld-previsao-motivo">
                        {semCaminhosDeArquivo(prev.atual.estado_pipeline ?? "").replace(/ no workflow [\w.-]+\.yml/, "")}
                      </TrechoPortugues>
                    }
                  >
                    <p className="mt-5 flex flex-wrap gap-4 text-sm">
                      <Link href="/setor-eletrico/pld/modelos" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                        {tx("Registro de modelos", "Model registry")}
                      </Link>
                      <Link href="/setor-eletrico/pld/previsoes" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                        {tx(
                          `Histórico de previsões (${csvEmissoes ? `${linhasEmissoes.length.toLocaleString("pt-BR")} registros de ${rodadasEmissoes.length} ${rodadasEmissoes.length === 1 ? "rodada" : "rodadas"}` : "arquivo não lido nesta publicação"})`,
                          `Forecast history (${csvEmissoes ? `${num(linhasEmissoes.length, 0)} records from ${rodadasEmissoes.length} ${rodadasEmissoes.length === 1 ? "run" : "runs"}` : "file not read in this publication"})`,
                        )}
                      </Link>
                    </p>
                  </Indisponivel>
                ) : prev && prev.atual.disponivel ? (
                  <div className="border-l-2 border-energia pl-4">
                    <p className="rotulo text-mineral">{tx("Previsão publicada", "Published forecast")}</p>
                    <p className="mt-2 text-sm leading-relaxed text-carvao">
                      {tx(
                        "Há publicação do modelo em produção no arquivo imutável de previsões. Cada registro traz modelo, versão, corte e faixas de incerteza.",
                        "There is a publication from the production model in the immutable forecast archive. Each record carries model, version, cutoff and uncertainty bands.",
                      )}
                    </p>
                    <Link href="/setor-eletrico/pld/previsoes" className="mt-3 inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
                      {tx("Ver no histórico de previsões", "See in the forecast history")}
                    </Link>
                  </div>
                ) : (
                  <Indisponivel
                    titulo={tx("Previsão indisponível", "Forecast unavailable")}
                    motivo={tx("O arquivo de previsões não foi gerado nesta publicação.", "The forecast archive was not generated in this publication.")}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-x-8 gap-y-6 md:grid-cols-3" data-nivel="analisar">
              <div className="border-l-2 border-linha pl-4">
                <h3 className="ed-h3 font-serif text-carvao">{tx("Como ler, quando houver previsão", "How to read it, when there is a forecast")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  {tx(
                    "A mediana é o valor central da distribuição. As faixas mostram onde o realizado caiu no passado em casos comparáveis. A frase “em cerca de 80% dos casos” só aparece quando a cobertura medida sustentar; caso contrário, a página diz quanto a faixa realmente cobriu.",
                    "The median is the central value of the distribution. The bands show where the actual value fell in the past in comparable cases. The phrase “in about 80% of cases” only appears when the measured coverage supports it; otherwise, the page says how much the band actually covered.",
                  )}
                </p>
              </div>
              <div className="border-l-2 border-linha pl-4">
                <h3 className="ed-h3 font-serif text-carvao">{tx("O que mudou desde a previsão anterior", "What changed since the previous forecast")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  {tx(
                    <>
                      Sem previsões publicadas para comparar. Quando houver, esta seção separa o que <strong className="font-medium">mudou na informação</strong> (EAR, ENA, carga, renováveis, térmicas, intercâmbio) do que foi <strong className="font-medium">contribuição do modelo</strong>, que nunca é chamada de causa.
                    </>,
                    <>
                      No published forecasts to compare. When there are, this section separates what <strong className="font-medium">changed in the information</strong> (EAR, ENA, load, renewables, thermal plants, interchange) from what was the <strong className="font-medium">model contribution</strong>, which is never presented as the reason for an outcome.
                    </>,
                  )}
                </p>
              </div>
              <div className="border-l-2 border-linha pl-4">
                <h3 className="ed-h3 font-serif text-carvao">{tx("Por que confiar? O modelo tem acertado?", "Why trust it? Has the model been accurate?")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  {tx(
                    `Ainda não há previsão publicada com realizado para comparar. Os resultados retrospectivos da pesquisa estão ${mods?.publicacao_resultados.liberada ? "no registro de modelos" : "retidos até a conclusão da revisão da pesquisa e a liberação pelo responsável pela plataforma"}. Toda avaliação futura começa por previsão, realizado e erro, depois erro típico, depois cobertura da faixa, e só então métricas técnicas contra referências simples.`,
                    `There is not yet a published forecast with an actual value to compare. The retrospective research results are ${mods?.publicacao_resultados.liberada ? "in the model registry" : "withheld until the research review is completed and the platform owner releases them"}. Every future evaluation starts with forecast, actual and error, then typical error, then band coverage, and only then technical metrics against simple benchmarks.`,
                  )}
                </p>
              </div>
            </div>
            <SecaoDoPainel id="governanca" titulo={tx("Regras de governança aplicadas", "Governance rules applied")} nivel="auditar">
              <dl className="grid gap-4 md:grid-cols-2">
                {prev &&
                  Object.entries(prev.regras).map(([k, v]) => (
                    <div key={k}>
                      <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-carvao">
                        <TrechoPortugues regiao="pld-governanca">{v}</TrechoPortugues>
                      </dd>
                    </div>
                  ))}
              </dl>
              <p className="text-sm text-carvao-muted">
                {tx(
                  "Validações automáticas, executadas a cada atualização antes de publicar (validador de governança do código do portal), bloqueiam: publicação de modelo não promovido, uso de dado posterior ao corte, alteração silenciosa de registro publicado, previsão sem versão ou snapshot, faixa não calibrada rotulada como 80%, cenário como previsão e ausência como número.",
                  "Automatic validations, run on every update before publishing (the portal code's governance validator), block: publication of a model that was not promoted, use of data after the cutoff, silent change to a published record, a forecast without version or snapshot, an uncalibrated band labeled as 80%, a scenario presented as a forecast and an absence presented as a number.",
                )}
              </p>
            </SecaoDoPainel>
              </div>
            </Recolhido>
          </>
        }
        tabelas={
          <>
            {limDet && (
              <TabelaDados
                id="limites-por-vigencia"
                nivel="auditar"
                recolhida={false}
                tituloVisivel={tx("Limites oficiais do PLD por vigência", "Official PLD limits by period in force")}
                lead={
                  <>
                        {tx(
                          "Piso, teto horário e teto estrutural fixados nos atos anuais da ANEEL, em vigor em cada trecho; o último trecho vai até o dia de referência.",
                          "Floor, hourly cap and structural cap set in the annual ANEEL acts, in force in each period; the last period runs until the reference day.",
                        )}{" "}
                        <TrechoPortugues regiao="pld-atos">{limDet.conferencia_atos.leitura}</TrechoPortugues>
                  </>
                }
                titulo={tx("Limites do PLD por trecho de vigência (R$/MWh)", "PLD limits by period in force (R$/MWh)")}
                colunas={[tx("Início", "Start"), tx("Fim", "End"), tx("Piso", "Floor"), tx("Teto horário", "Hourly cap"), tx("Teto estrutural", "Structural cap"), tx("Ato do piso", "Floor act")]}
                linhas={limDet.regimes.map((r) => [dataBR(r.inicio), dataBR(r.fim), r.pld_min, r.pld_max_horario, r.pld_max_estrutural, r.ato_pld_min])}
                casas={[null, null, 2, 2, 2, null]}
                idiomaTexto={[null, null, null, null, null, "nome"]}
                limite={limDet.regimes.length}
              />
            )}
            {integra(pld) && (
              <TabelaDados
                id="menor-valor-por-ano"
                nivel="auditar"
                recolhida={false}
                tituloVisivel={tx("Menor valor horário observado por ano", "Lowest hourly value observed by year")}
                lead={
                  <>
                      {tx(
                        `Referência descritiva, nunca usada como piso: o piso regulatório é o do ato vigente${limDet ? " (tabela acima)" : ""}.`,
                        `Descriptive reference, never used as a floor: the regulatory floor is the one in the act in force${limDet ? " (table above)" : ""}.`,
                      )}
                  </>
                }
                titulo={tx("Menor valor horário observado por ano e submercado", "Lowest hourly value observed by year and submarket")}
                colunas={[tx("Ano", "Year"), tx("Até", "Through"), tx("SE/CO", "SE/CW"), tx("Sul", "South"), tx("Nordeste", "Northeast"), tx("Norte", "North")]}
                linhas={pld.menor_valor_ano.map((m) => [String(m.ano), dataBR(m.ate), m.SE, m.S, m.NE, m.N])}
                casas={[null, null, 2, 2, 2, 2]}
                limite={pld.menor_valor_ano.length}
                nota={
                  <span className="[overflow-wrap:anywhere]">
                      {tx<ReactNode>(
                        `Versão dos dados ${pld.snapshot.id ? semUtc(snapshotLegivel(pld.snapshot.id)) : "sem identificador"} · sha256 ${pld.snapshot.sha256} · série de ${horaLocal(pld.primeira_hora)} a ${horaLocal(pld.ultima_hora)} (horário de Brasília)`,
                        <>
                          Data version {pld.snapshot.id ? semUtc(snapshotLegivel(pld.snapshot.id)) : "no identifier"} · sha256 {identificador(pld.snapshot.sha256, idioma)} · series from {horaLocal(pld.primeira_hora)} to{" "}
                          {horaLocal(pld.ultima_hora)} (Brasília time)
                        </>,
                      )}
                  </span>
                }
              />
            )}
          </>
        }
        metodo={
          <>
            {integra(pld) && (
                  <SecaoDoPainel
                    id="regras"
                    titulo={tx("Como classificamos", "How we classify")}
                    nivel="analisar"
                    lead={tx(
                      "Nenhuma classificação sem regra. Estas são as regras que produzem cada resposta desta seção.",
                      "No classification without a rule. These are the rules that produce each answer in this section.",
                    )}
                  >
                    <dl className="grid gap-4 md:grid-cols-2">
                      {Object.entries(pld.regras).map(([k, v]) => (
                        <div key={k}>
                          <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                          <dd className="mt-1 text-sm leading-relaxed text-carvao">
                            <PldTextoGold texto={semRessalvaDeLimitesNaoAuditados(v)} regiao="pld-regra" />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </SecaoDoPainel>
            )}
            <p>
              {tx(
                "Cada número desta página sai do PLD horário publicado pela CCEE, sem ajuste: as médias diárias são médias simples das 24 horas de cada submercado, a distância entre as regiões é a maior média menos a menor, e os limites vêm dos atos anuais da ANEEL, com a vigência de cada um.",
                "Every number on this page comes from the hourly PLD published by CCEE, without adjustment: daily averages are simple averages of the 24 hours of each submarket, the distance between regions is the highest average minus the lowest, and the limits come from ANEEL's annual acts, with each one's period in force.",
              )}{" "}
              <Link href="/setor-eletrico/metodologia" className={ligacaoTexto}>
                {tx("Metodologia do observatório", "Observatory methodology")}
              </Link>
              .
            </p>
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/setor-eletrico"]} variante="metodo" idioma={idioma} />}
      />
    </>
  );
}
