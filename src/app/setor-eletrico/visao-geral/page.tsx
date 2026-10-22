import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/energia/LinkSemPrefetch";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DadosArquivos, itensDeArquivos } from "@/components/energia/DadosArquivos";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import { VisaoDeterminantes } from "@/components/energia/VisaoDeterminantes";
import { VisaoDestaques, VisaoFrases, type MarcaDeRegra } from "@/components/energia/VisaoFrases";
import { VisaoObservar, type ItemObservar, type LinhaComparavel } from "@/components/energia/VisaoObservar";
import { PainelVisao, VisaoAtencao, VisaoAviso, VisaoControles, VisaoDatas, VisaoIndisponivel, VisaoRecorte } from "@/components/energia/VisaoPagina";
import { VisaoRegraResumo } from "@/components/energia/VisaoRegras";
import { VisaoLinhaTempo, VisaoSociedadeCartoes } from "@/components/energia/VisaoSociedade";
import { VisaoTabelasSobDemanda } from "@/components/energia/VisaoTabelasSobDemanda";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { partirBastidor } from "@/lib/energia/bastidor";
import { carimbo, dataBR, num, plural } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { comNomesProprios, goldEmString, goldNoBloco, valorProvaNoIdioma } from "@/lib/energia/i18n/entrada-visao";
import type { Idioma } from "@/lib/idioma";
import { integra, lerGold } from "@/lib/energia/gold";
import { COLUNAS_ARQUIVO } from "@/lib/energia/datasets";
import { manifestoDados, publicacaoDados } from "@/lib/energia/dados-servidor";
import { PAGINAS_MAPA } from "@/lib/energia/mapa";
import type { IdFrase, IdRegra, RegraObservar, SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import {
  ANCORAS_DETERMINANTES,
  ROTA_VISAO,
  URL_GOLD_VISAO,
  colunasFrases,
  colunasSociedade,
  determinantesDaPagina,
  dominioEstados,
  linhasFrases,
  linhasSociedade,
  minuscula,
  multiplosNoIdioma,
  notaCarga,
  notaCmoNorte,
  notaRede,
  notaTarifaSocial,
  paineisVisao,
  pedeAtencao,
  periodoCurto,
  posicaoDeterminante,
  referenciasFrases,
  regrasDaFrase,
  respostaDeterminantes,
  respostaObservar,
  respostaSistema,
  respostaSociedade,
  rotuloEstado,
  rotuloFrase,
  textoFrequenciaConjunta,
  textoJanelaTermica,
  textoLinhaEstado,
  textoMudouDeterminantes,
  trechosEstado,
  vereditoDeterminantes,
  vereditoObservar,
  vereditoSistema,
  vereditoSociedade,
  type MesSerieTarifaSocial,
  type SemanaCmo,
} from "@/lib/energia/visao";
import { contextoVisao } from "@/lib/energia/visao-servidor";

/**
 * Visão geral (P004 a P007): o resumo de poucos minutos do sistema elétrico, lido de public/energia/gold/sintese.json (módulo
 * `visao`, pipeline/energia/modulos/visao.py). Quatro painéis numa página só, na ordem em que a figura vem antes do texto: os cinco
 * determinantes lado a lado (P005), os fatos do sistema com a prova de cada número (P004), o que chega ao consumidor (P006) e as
 * regras que dizem o que observar (P007). Cada painel tem a pergunta, a resposta curta derivada da gold, o recorte, a figura com
 * referência, a tabela equivalente em Analisar, "Comprove este número", os downloads, o link com o recorte e a próxima pergunta.
 *
 * A síntese reutiliza o dado, o corte e a regra de cada módulo de origem. Quando a Visão geral e o módulo diferem (a data da EAR,
 * a janela da carga, o critério do PLD), a diferença está escrita junto da medida; nada é unificado em silêncio. Nenhum número é
 * recalculado aqui: frases e alertas vêm de regras fixas do pipeline, e cada um leva à evidência.
 *
 * As âncoras da antiga página inicial (sistema, preco, agua, geracao, consumo, rede, observar e as variantes -painel) continuam
 * válidas: sistema e observar são painéis desta página; as demais caem nos cartões dos determinantes (ANCORAS_DETERMINANTES).
 */

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/visao-geral", {
    title: tx("Visão geral: o que está acontecendo no sistema elétrico", "Overview: what is happening in the power system"),
    description: tx(
      "O sistema elétrico brasileiro em poucos minutos: preço, água, geração, carga e rede alinhados pelo calendário, cada um com a data da sua fonte e uma referência ao lado do número; seis fatos com evidência; custo e qualidade para o consumidor com o período de cada número; e as regras que dizem o que observar, com limiar, duração e histórico.",
      "The Brazilian power system in a few minutes: price, water, generation, load and grid aligned by the calendar, each with the date of its source and a reference beside the number; six facts with evidence; cost and quality for the consumer with the period of each number; and the rules that say what to watch, with threshold, duration and history.",
    ),
    alternates: { canonical: "/setor-eletrico/visao-geral" },
  }, anterior);
}

type PainelDaPagina = ReturnType<typeof paineisVisao>[number];

/** Os quatro painéis da página por id, com a pergunta no idioma da rota. */
function paineisPorId(idioma: Idioma): Record<PainelDaPagina["id"], PainelDaPagina> {
  return Object.fromEntries(paineisVisao(idioma).map((p) => [p.id, p])) as Record<PainelDaPagina["id"], PainelDaPagina>;
}

/** Itens do "O que observar": o resumo de cada regra montado no servidor; o detalhe é lido da gold ao abrir. */
function itensObservar(observar: readonly RegraObservar[], notas: Partial<Record<IdRegra, string | null>>, titulosConjuntos: Record<string, string>, idioma: Idioma): ItemObservar[] {
  return observar.map((o, i) => ({
    id: o.id,
    titulo: goldEmString(o.titulo, idioma),
    tipo: o.tipo,
    assunto: o.assunto,
    estado: o.estado,
    rotuloEstado: rotuloEstado(o.estado, idioma),
    referencia: o.referencia,
    href: o.href,
    resumo: <VisaoRegraResumo o={o} caminho={`observar[${i}]`} nota={notas[o.id]} titulosConjuntos={titulosConjuntos} />,
  }));
}

/** Regras com linha de estado publicada, comparáveis sobre o mesmo eixo de datas. */
function comparaveisObservar(observar: readonly RegraObservar[], idioma: Idioma): LinhaComparavel[] {
  return observar
    .filter((o) => o.linha_estado?.inicio && o.linha_estado.estados)
    .map((o) => ({ id: o.id, rotulo: goldEmString(o.titulo, idioma), trechos: trechosEstado(o.linha_estado), texto: textoLinhaEstado(o, idioma) ?? "" }));
}

/** Comparação inicial: as regras que pedem atenção e, para completar quatro, as de sistema na ordem publicada. */
function padraoComparacao(observar: readonly RegraObservar[], comparaveis: readonly LinhaComparavel[]): string[] {
  const ids = new Set(comparaveis.map((c) => c.id));
  const atencao = observar.filter((o) => pedeAtencao(o) && ids.has(o.id)).map((o) => o.id);
  const sistema = observar.filter((o) => o.assunto === "sistema" && o.tipo === "regra" && ids.has(o.id) && !atencao.includes(o.id)).map((o) => o.id);
  return [...atencao, ...sistema].slice(0, 4);
}

export default function VisaoGeralEnergia() {
  const g = lerGold<SinteseVisaoGold>("sintese.json");
  if (!integra(g)) return <VisaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const idioma = idiomaEnergia();
  const P = paineisPorId(idioma);
  const ctx = contextoVisao(g);
  const refs = referenciasFrases(g.frases);
  // os determinantes com a EAR da série publicada (uma só passagem de arredondamento) e a mediana da data desenhada;
  // em inglês, títulos, unidades e notas dos painéis passam pela tabela da gold antes (os números não mudam)
  const det = g.multiplos ? determinantesDaPagina(multiplosNoIdioma(g.multiplos, idioma), ctx.earSin, ctx.bandasAgua, ctx.medianaAgua.base, idioma) : null;
  const m = det?.m ?? null;
  const datasRef = m ? Object.values(m.datas_referencia).filter((d): d is string => !!d).sort() : [];
  const todasAsDatas = [...datasRef, ...(refs ? [refs.min, refs.max] : [])].sort();
  const titulosRegras = Object.fromEntries(g.observar.map((o) => [o.id, o.titulo]));
  const tituloRegra = (titulo: string) => goldEmString(titulo, idioma);

  // pontes entre números que parecem divergir (janelas, meses e universos diferentes): cada nota lê só dados publicados
  const cmo = lerGold<{ semana_referencia?: string; serie?: SemanaCmo[] }>("cmo.json");
  const inclusao = lerGold<{ tarifa_social?: { serie_mensal?: MesSerieTarifaSocial[] } }>("inclusao.json");
  const beneficios = g.sociedade.itens.find((x) => x.id === "beneficios");
  const notaTS = beneficios ? notaTarifaSocial(beneficios, inclusao?.tarifa_social?.serie_mensal) : null;
  const notasRegras: Partial<Record<IdRegra, string | null>> = {
    cmo_semana: cmo?.semana_referencia
      ? tx(
          `Resultado de modelo do ONS (DECOMP), não previsão da Scrutiniums. ${notaCmoNorte(cmo.serie, cmo.semana_referencia) ?? ""}`.trim(),
          `Result of an ONS model (DECOMP), not a Scrutiniums forecast. ${notaCmoNorte(cmo.serie, cmo.semana_referencia) ?? ""}`.trim(),
        )
      : null,
    atualidade_fontes: notaTS ? tx(`${beneficios!.titulo}: ${notaTS}`, `${goldEmString(beneficios!.titulo, idioma)}: ${notaTS}`) : null,
  };
  // "percentil" como o painel de PLD o define (pld.json, regras.posicao_historica): o texto é o da própria gold
  const pld = lerGold<{ regras?: { posicao_historica?: string } }>("pld.json");
  const termosDasFrases: ReactNode = pld?.regras?.posicao_historica
    ? tx<ReactNode>(
        ` Termos: p.p. é a abreviação de pontos percentuais; percentil, como o painel de PLD o define: ${pld.regras.posicao_historica}`,
        <> Terms: p.p. stands for percentage points; percentile, as the PLD panel defines it: {goldNoBloco(pld.regras.posicao_historica, idioma, "visao-termos-percentil")}</>,
      )
    : tx(" Termos: p.p. é a abreviação de pontos percentuais.", " Terms: p.p. stands for percentage points.");
  const saude = lerGold<{ conjuntos?: { id: string; titulo: string }[] }>("publicacao.json");
  const titulosConjuntos = Object.fromEntries((saude?.conjuntos ?? []).map((c) => [c.id.split("/").pop() ?? c.id, c.titulo]));
  const itens = itensObservar(g.observar, notasRegras, titulosConjuntos, idioma);
  const comparaveis = comparaveisObservar(g.observar, idioma);
  const dominio = dominioEstados(g.observar);
  const regras = g.observar.filter((o) => o.tipo !== "evento");
  const emAlerta = regras.filter((o) => o.ativo);
  const alertaSistema = emAlerta.filter((o) => o.assunto === "sistema");
  const alertaDados = emAlerta.filter((o) => o.assunto === "dados");
  const observacao = regras.filter((o) => o.estado === "em_observacao");
  const fonteTabelas = tx(
    `Scrutiniums, gold sintese.json gerada em ${carimbo(g.gerado_em)} a partir das bases publicadas de origem`,
    `Scrutiniums, gold sintese.json generated on ${carimbo(g.gerado_em)} from the published source bases`,
  );
  const dlPor = (parte: string) => g.downloads.filter((d) => d.url.includes(parte));
  // o rótulo de cada arquivo na língua da rota (a tabela da gold tem os quatro); o endereço não muda
  const dlNoIdioma = (ds: readonly { rotulo: string; url: string }[]) => ds.map((d) => ({ ...d, rotulo: goldEmString(d.rotulo, idioma) }));
  const freq = textoFrequenciaConjunta(g);
  const revisoesOperacao = g.revisoes.operacao ?? [];
  const totalRevisoes = revisoesOperacao.reduce((s, r) => s + (r.revisoes ?? 0), 0);
  const materiais = revisoesOperacao.reduce((s, r) => s + (r.materiais_em_series_usadas ?? 0), 0);

  // a frase de um indicador leva a marca da regra dele quando a regra está em alerta ou em observação
  const marcas: Partial<Record<IdFrase, MarcaDeRegra[]>> = {};
  for (const f of g.frases) {
    const rs = regrasDaFrase(f.id, g.observar);
    if (rs.length) marcas[f.id] = rs.map((r) => ({ id: r.id, titulo: r.titulo, estado: r.estado }));
  }

  /* ---------------- faixa de métricas: a medida de cada determinante, com a data e o corte que esta página usa */
  const painel = (id: string) => m?.paineis.find((p) => p.id === id) ?? null;
  const leve = (id: string) => det?.leves.paineis.find((p) => p.id === id) ?? null;
  const comprove = (id: "preco" | "agua" | "geracao" | "carga" | "rede") => {
    const l = leve(id);
    return l?.comprove ? (
      <div className="-my-2.5">
        <ComproveNumero sobDemanda={{ url: URL_GOLD_VISAO, ...l.comprove, valorExibido: valorProvaNoIdioma(l.comprove.valorExibido, idioma) }} endereco={`${ROTA_VISAO}#${ANCORAS_DETERMINANTES[id].id}`} />
      </div>
    ) : null;
  };
  const pPreco = painel("preco");
  const pAgua = painel("agua");
  const pGeracao = painel("geracao");
  const pCarga = painel("carga");
  const posCarga = m && pCarga ? posicaoDeterminante(pCarga, m) : null;
  const medianaNoDia = m && pAgua ? m.dados.find((l) => l.d === pAgua.data_referencia)?.agua_p50 : undefined;
  const sentido = (v: number) => (v >= 0 ? tx("acima", "above") : tx("abaixo", "below"));
  const refPreco =
    ctx.pldReferencia && ctx.pldReferencia.percentilMes !== null && ctx.pldReferencia.percentilTodos !== null
      ? tx(
          `Mesmo mês dos anos anteriores: percentil ${num(ctx.pldReferencia.percentilMes, 1)}; todas as médias desde 2021: ${num(ctx.pldReferencia.percentilTodos, 1)}.`,
          `Same month in previous years: percentile ${num(ctx.pldReferencia.percentilMes, 1)}; all averages since 2021: ${num(ctx.pldReferencia.percentilTodos, 1)}.`,
        )
      : null;
  // um critério só para o número em destaque (o mesmo dia da semana do ano anterior) e para as janelas ao lado dele; o outro critério (as mesmas datas) vem explicado, não misturado
  const cj = ctx.cargaJanelas;
  const acima = (v: number | null | undefined) => (v === null || v === undefined ? tx("sem dado", "no data") : `${num(Math.abs(v), 1)}% ${sentido(v)}`);
  const refCarga = cj
    ? tx(
        `O destaque compara um dia. Mesmo critério (o mesmo dia da semana do ano anterior) em janelas maiores: 7 dias ${acima(cj.semana7)}; 28 dias ${acima(cj.dias28)}; 52 semanas ${acima(cj.semanas52)}.${
          cj.mesmasDatas7 !== null ? ` Com as mesmas datas do ano anterior, em vez do mesmo dia da semana, os 7 dias ficam em ${acima(cj.mesmasDatas7)}.` : ""
        }`,
        `The highlight compares a single day. Same criterion (the same weekday of the previous year) over longer windows: 7 days ${acima(cj.semana7)}; 28 days ${acima(cj.dias28)}; 52 weeks ${acima(cj.semanas52)}.${
          cj.mesmasDatas7 !== null ? ` With the same dates of the previous year, instead of the same weekday, the 7 days come to ${acima(cj.mesmasDatas7)}.` : ""
        }`,
      )
    : null;
  const refTermica =
    ctx.termica && ctx.termica.p10 !== null && ctx.termica.p90 !== null
      ? tx(
          `Faixa de ${num(ctx.termica.p10, 1)}% a ${num(ctx.termica.p90, 1)}% em 365 janelas de 7 dias anteriores à que termina no dia de referência, sem sobreposição com ela.`,
          `Range of ${num(ctx.termica.p10, 1)}% to ${num(ctx.termica.p90, 1)}% across the 365 7-day windows before the one ending on the reference day, without overlapping it.`,
        )
      : null;
  const notaJanelaTermica = ctx.termica ? textoJanelaTermica({ p10: ctx.termica.p10, p90: ctx.termica.p90 }, pGeracao?.data_referencia ?? null) : "";
  const refAgua = [
    typeof medianaNoDia === "number" ? tx(`Mediana da data: ${num(medianaNoDia, 1)}%.`, `Median for the date: ${num(medianaNoDia, 1)}%.`) : "",
    ctx.aguaModulo ? tx(`A página Água e clima traz ${num(ctx.aguaModulo.pct, 1)}% em ${dataBR(ctx.aguaModulo.dia)}.`, `The Water and climate page shows ${num(ctx.aguaModulo.pct, 1)}% on ${dataBR(ctx.aguaModulo.dia)}.`) : "",
  ]
    .filter(Boolean)
    .join(" ");

  /* ---------------- notas dos painéis */
  const oQueMudouDeterminantes = m ? textoMudouDeterminantes(m) : tx("Os determinantes alinhados não foram publicados nesta execução.", "The aligned determinants were not published in this run.");
  const titulosDestaques = g.destaques.itens.map((d) => minuscula(tituloRegra(d.titulo))).join("; ");
  const oQueMudouSistema: ReactNode = g.destaques.itens.length
    ? tx(
        `${plural(g.destaques.itens.length, "regra sobre o sistema teve o alerta confirmado", "regras sobre o sistema tiveram o alerta confirmado")} nos últimos ${plural(g.destaques.novidade_dias, "dia", "dias")}: ${g.destaques.itens
          .map((d) => minuscula(d.titulo))
          .join("; ")}.`,
        `${plural(g.destaques.itens.length, "rule about the system had its alert confirmed", "rules about the system had their alert confirmed")} in the last ${plural(g.destaques.novidade_dias, "day", "days")}: ${titulosDestaques}.`,
      )
    : g.destaques.vazio
      ? goldNoBloco(g.destaques.vazio, idioma, "visao-destaques-vazio")
      : tx("Nenhum destaque nesta publicação.", "No highlight in this publication.");
  // a página não compara com a publicação anterior: diz o que vale para a leitura das regras e não repete a frase de abertura do painel
  const oQueMudouObservar = tx(
    `Sem comparação com a publicação anterior nesta página: o histórico das regras é reavaliado desde ${dataBR(g.historico_regras.inicio)} com os dados da data de processamento. ${
      g.alertas_nao_confirmados.length
        ? `${plural(g.alertas_nao_confirmados.length, "alerta publicado deixou", "alertas publicados deixaram")} de se confirmar depois de revisão da fonte.`
        : "Nenhum alerta publicado deixou de se confirmar depois de revisão da fonte."
    }`,
    `No comparison with the previous publication on this page: the rule history is reassessed since ${dataBR(g.historico_regras.inicio)} with the data as of the processing date. ${
      g.alertas_nao_confirmados.length
        ? `${plural(g.alertas_nao_confirmados.length, "published alert was", "published alerts were")} not confirmed after a source revision.`
        : "No published alert failed to be confirmed after a source revision."
    }`,
  );
  const oQueMudouSociedade = g.sociedade.itens.length
    ? tx(
        `Cada indicador tem período próprio: ${g.sociedade.itens.map((it) => `${minuscula(it.titulo)}, ${periodoCurto(it)}`).join("; ")}.`,
        `Each indicator has its own period: ${g.sociedade.itens.map((it) => `${minuscula(goldEmString(it.titulo, idioma))}, ${periodoCurto(it)}`).join("; ")}.`,
      )
    : tx("Nenhum indicador de energia e sociedade disponível nesta publicação.", "No energy and society indicator available in this publication.");

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:visao-geral" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16">
        <CabecalhoModulo
          siglas={["SIN", "PLD", "EAR", "ENA", "MLT", "MMGD", "MWmed", "ONS", "ANEEL", "CCEE", "CMO", "DEC", "FEC", "CDE", "UC", "SCS"]}
          titulo={PAGINAS_MAPA["visao-geral"].pergunta}
          lead={tx(
            <>
              Preço, água, geração, carga e rede do <Termo slug="sin">Sistema Interligado Nacional (SIN)</Termo> no mesmo calendário, cada um com a data da sua fonte e uma referência ao lado. Como
              essas partes se ligam, da geração ao consumidor, está no{" "}
              <Link href="/setor-eletrico#mapa-conceitual" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                mapa do sistema
              </Link>
              .
            </>,
            <>
              Price, water, generation, load and grid of the <Termo slug="sin">National Interconnected System (SIN)</Termo> on the same calendar, each with the date of its source and a reference beside it. How
              these parts connect, from generation to the consumer, is shown on the{" "}
              <Link href="/setor-eletrico#mapa-conceitual" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                system map
              </Link>
              .
            </>,
          )}
          limite={tx(
            "Alinhar as medidas pelo calendário não diz que uma determina a outra, e estar dentro da faixa de referência não diz que o valor é esperado ou desejável.",
            "Aligning the measures by the calendar does not say that one determines the other, and being inside the reference range does not say that the value is expected or desirable.",
          )}
          recorte={
            todasAsDatas.length
              ? tx(
                  `${dataBR(todasAsDatas[0])} a ${dataBR(todasAsDatas[todasAsDatas.length - 1])} · SIN e submercados · cada medida com data e unidade próprias`,
                  `${dataBR(todasAsDatas[0])} to ${dataBR(todasAsDatas[todasAsDatas.length - 1])} · SIN and submarkets · each measure with its own date and unit`,
                )
              : tx("sem data nesta publicação", "no date in this publication")
          }
          fonte={tx("ONS, CCEE e ANEEL", "ONS, CCEE and ANEEL")}
          referencia={tx(
            <>
              Processado em {dataBR(g.data_processamento)} (data civil de Brasília). Cada número usa a data de referência da sua fonte, escrita junto dele; indicadores de energia e sociedade
              têm período próprio (vigência, ano ou mês).
            </>,
            <>
              Processed on {dataBR(g.data_processamento)} (calendar date in Brasília). Each number uses the reference date of its source, written next to it; energy and society indicators
              have their own period (validity period, year or month).
            </>,
          )}
          datas={
            <VisaoDatas
              itens={[
                ...(m
                  ? m.paineis.map((p) => ({
                      rotulo: p.titulo,
                      texto: tx(`${p.id === "geracao" ? "7 dias até " : "até "}${dataBR(p.data_referencia)}`, `${p.id === "geracao" ? "7 days through " : "through "}${dataBR(p.data_referencia)}`),
                      natureza: p.natureza,
                    }))
                  : []),
                {
                  rotulo: tx("Fatos do sistema", "System facts"),
                  texto: refs
                    ? refs.min === refs.max
                      ? dataBR(refs.min)
                      : tx(`${dataBR(refs.min)} a ${dataBR(refs.max)}, uma data por fato`, `${dataBR(refs.min)} to ${dataBR(refs.max)}, one date per fact`)
                    : tx("sem dado nesta publicação", "no data in this publication"),
                },
                { rotulo: tx("Energia e sociedade", "Energy and society"), texto: tx("vigência, ano ou mês de cada indicador", "validity period, year or month of each indicator") },
              ]}
            />
          }
          metricas={
            m && pPreco && pAgua && pGeracao && pCarga ? (
              <FaixaMetricas colunas={4} rotulo={tx("Indicadores do sistema, cada um na data da sua fonte", "System indicators, each on the date of its source")}>
                <Numero
                  variante="faixa"
                  rotulo={tx(
                    `PLD (Preço de Liquidação das Diferenças)${pPreco.valor_atual.rotulo ? `, ${pPreco.valor_atual.rotulo}` : ""}`,
                    `Spot price (PLD)${pPreco.valor_atual.rotulo ? `, ${pPreco.valor_atual.rotulo}` : ""}`,
                  )}
                  natureza={pPreco.natureza}
                  valor={pPreco.valor_atual.valor}
                  formato="reais"
                  casas={2}
                  unidade="R$/MWh"
                  periodo={tx(`média do dia ${dataBR(pPreco.data_referencia)}`, `daily average on ${dataBR(pPreco.data_referencia)}`)}
                  cor="var(--serie-sm-se)"
                  nota={
                    <>
                      {refPreco}
                      {comprove("preco")}
                    </>
                  }
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Energia armazenada (EAR) nos reservatórios do SIN", "Stored energy (EAR) in the SIN reservoirs")}
                  natureza={pAgua.natureza}
                  valor={pAgua.valor_atual.valor}
                  formato="pct"
                  casas={1}
                  unidade={tx("da EAR máxima", "of maximum EAR")}
                  periodo={dataBR(pAgua.data_referencia)}
                  cor="var(--serie-hidraulica)"
                  nota={
                    <>
                      {refAgua}
                      {comprove("agua")}
                    </>
                  }
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Carga do SIN, em megawatts médios (MWmed)", "SIN load, in average megawatts (MWavg)")}
                  natureza={pCarga.natureza}
                  valor={pCarga.valor_atual.valor}
                  formato="num"
                  casas={0}
                  unidade={tx("MWmed", "MWavg")}
                  periodo={tx(`dia ${dataBR(pCarga.data_referencia)}`, `day ${dataBR(pCarga.data_referencia)}`)}
                  cor="var(--cor-energia)"
                  variacao={
                    posCarga && posCarga.variacao_pct !== null
                      ? { valor: posCarga.variacao_pct, casas: 1, sufixo: "%", referencia: tx("frente ao mesmo dia da semana do ano anterior", "versus the same weekday of the previous year") }
                      : undefined
                  }
                  nota={
                    <>
                      {refCarga}
                      {comprove("carga")}
                    </>
                  }
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Participação térmica na geração do SIN", "Thermal share of SIN generation")}
                  natureza={pGeracao.natureza}
                  valor={pGeracao.valor_atual.valor}
                  formato="pct"
                  casas={1}
                  unidade={tx("da geração verificada", "of verified generation")}
                  periodo={tx(`7 dias até ${dataBR(pGeracao.data_referencia)}`, `7 days through ${dataBR(pGeracao.data_referencia)}`)}
                  cor="var(--serie-termica)"
                  nota={
                    <>
                      {refTermica}
                      {comprove("geracao")}
                    </>
                  }
                />
              </FaixaMetricas>
            ) : undefined
          }
        >
          {tx(
            <>
              A página reúne quatro painéis: os cinco determinantes lado a lado, os fatos do sistema com a prova de cada número, o que chega ao consumidor em custo e qualidade, e as regras que
              dizem o que observar. Tudo é lido das bases publicadas dos módulos de origem; o que não está integrado aparece como ausência, nunca como estimativa.
            </>,
            <>
              The page brings together four panels: the five determinants side by side, the system facts with the proof of each number, what reaches the consumer in cost and quality, and the rules
              that say what to watch. Everything is read from the published bases of the source modules; what is not integrated appears as an absence, never as an estimate.
            </>,
          )}
        </CabecalhoModulo>

        <div className="mt-6">
          <VisaoAtencao
            alertaSistema={alertaSistema.map((o) => ({ id: o.id, titulo: o.titulo }))}
            observacao={observacao.map((o) => ({ id: o.id, titulo: o.titulo }))}
            alertaDados={alertaDados.map((o) => ({ id: o.id, titulo: o.titulo }))}
          />
        </div>

        <ModoProfundidade>
          {/* P005 */}
          <PainelVisao
            id="determinantes"
            subtitulo={tx(
              "Preço, água armazenada, geração térmica, carga e fluxo entre regiões, que o observatório publica em módulos próprios, lidos no mesmo calendário",
              "Price, stored water, thermal generation, load and flow between regions, which the observatory publishes in modules of their own, read on the same calendar",
            )}
            fonte={tx(
              <>
                Fontes: ONS (energia armazenada, carga, geração e rede) e CCEE (PLD), lidas dos módulos de origem
                {datasRef.length ? `; referência de ${dataBR(datasRef[0])} a ${dataBR(datasRef[datasRef.length - 1])}` : ""}. Processado em {dataBR(g.data_processamento)}.
              </>,
              <>
                Sources: ONS (stored energy, load, generation and grid) and CCEE (PLD), read from the source modules
                {datasRef.length ? `; reference from ${dataBR(datasRef[0])} to ${dataBR(datasRef[datasRef.length - 1])}` : ""}. Processed on {dataBR(g.data_processamento)}.
              </>,
            )}
          >
            {m && det ? (
              <>
                <VisaoDeterminantes
                  d={det.leves}
                  ancoras={ANCORAS_DETERMINANTES}
                  fonte={fonteTabelas}
                  // a da água diz que o mesmo percentual em épocas diferentes não é a mesma energia: ressalva da faixa, fica no Entender
                  notasAVista={["agua"]}
                  notas={{
                    preco: ctx.doisCriteriosPld ? [ctx.doisCriteriosPld] : [],
                    agua: [ctx.capacidadeAgua, ctx.earNoModulo].filter((x): x is string => !!x),
                    geracao: notaJanelaTermica ? [notaJanelaTermica] : [],
                    carga: [notaCarga({ frases: g.frases, multiplos: m }), ctx.cargaNoModulo].filter((x): x is string => !!x),
                    rede: [notaRede({ frases: g.frases, multiplos: m }), ctx.saldoRede].filter((x): x is string => !!x),
                  }}
                />
                <VisaoAviso tipo="alerta">{goldNoBloco(g.multiplos?.aviso_datas ?? m.aviso_datas, idioma, "visao-determinantes-aviso-datas")}</VisaoAviso>
                <RespostaCurta id="determinantes" veredito={vereditoDeterminantes(m)} depois>
                  <ul className="space-y-1.5">
                    {respostaDeterminantes(m).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </RespostaCurta>
                <NotasDoPainel
                  nome={P.determinantes.pergunta}
                  oQueMudou={oQueMudouDeterminantes}
                  comoInterpretar={tx(
                    <>
                      Cada painel traz a própria referência, escrita sob o gráfico: a faixa histórica da data para a água, o intervalo entre percentis para o preço e para a participação térmica,
                      o mesmo dia da semana do ano anterior para a carga e o zero para o sentido do fluxo. Estar dentro da faixa quer dizer que o valor está entre os dois percentis da
                      referência. Os valores são copiados das bases publicadas de origem, célula a célula, sem recálculo; dia em branco é dia sem valor na origem, nunca zero.
                    </>,
                    <>
                      Each panel carries its own reference, written under the chart: the historical range for the date for water, the interval between percentiles for the price and for the thermal share,
                      the same weekday of the previous year for load, and zero for the direction of the flow. Being inside the range means that the value lies between the two percentiles of the
                      reference. The values are copied from the published source bases, cell by cell, without recalculation; a blank day is a day with no value at the source, never zero.
                    </>,
                  )}
                  naoConcluir={tx(
                    "Alinhar os painéis pelo calendário não afirma que um determina o outro. Estar dentro da faixa não diz que o valor é esperado ou desejável. Fluxo alto na rede não indica congestionamento: os limites de intercâmbio não estão integrados.",
                    "Aligning the panels by the calendar does not claim that one determines the other. Being inside the range does not say that the value is expected or desirable. High flow on the grid does not indicate congestion: the interchange limits are not integrated.",
                  )}
                />
                <p data-nivel="auditar" className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                  {tx("Regra do painel:", "Panel rule:")} {goldNoBloco(g.multiplos?.regra ?? m.regra, idioma, "visao-determinantes-regra")}
                </p>
              </>
            ) : (
              <VisaoAviso tipo="alerta">
                {tx(
                  "Os determinantes alinhados não foram publicados nesta execução: o bloco de determinantes da gold está ausente; os painéis de origem continuam disponíveis nos módulos.",
                  "The aligned determinants were not published in this run: the determinants block of the gold is missing; the source panels are still available in the modules.",
                )}
              </VisaoAviso>
            )}
            <SeguirPainel
              ancora="determinantes"
              proximo={{ href: "#sistema", pergunta: P.sistema.pergunta }}
              downloads={(m?.download ?? []).map((d) => ({
                ...d,
                rotulo: tx(
                  "Determinantes alinhados, sempre os 90 dias publicados (CSV; não muda com a janela escolhida e não traz a mediana da água nem as faixas de referência do gráfico)",
                  "Aligned determinants, always the 90 published days (CSV; it does not change with the chosen window and does not include the water median or the chart's reference ranges)",
                ),
              }))}
            />
          </PainelVisao>

          {/* P004 */}
          <PainelVisao
            id="sistema"
            subtitulo={tx(
              "O sistema em 60 segundos: uma frase por indicador (reservatórios, afluência, carga, térmicas, preço e rede), cada uma na sua data e com a prova do número; a frase não explica a relação entre eles",
              "The system in 60 seconds: one sentence per indicator (reservoirs, inflow, load, thermal plants, price and grid), each on its own date and with the proof of the number; the sentence does not explain the relationship between them",
            )}
            fonte={tx(
              "Fontes: as bases publicadas dos módulos de origem, cada fato na data da sua fonte; a prova de cada número refaz o cálculo.",
              "Sources: the published bases of the source modules, each fact on the date of its source; the proof of each number redoes the calculation.",
            )}
          >
            <RespostaCurta id="sistema" veredito={vereditoSistema(g)}>
              {respostaSistema(g)}
            </RespostaCurta>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
              <div className="min-w-0">
                {g.frases.length ? (
                  <VisaoFrases frases={g.frases} notas={{ carga: notaCarga(g) ?? undefined, rede: notaRede(g) ?? undefined }} marcas={marcas} />
                ) : (
                  <VisaoAviso tipo="alerta">{tx("Nenhuma frase pôde ser escrita nesta publicação: faltam os dados de origem.", "No sentence could be written in this publication: the source data are missing.")}</VisaoAviso>
                )}
                {g.frases_ausentes.length > 0 && (
                  <p className="mt-3 text-xs text-carvao-muted">
                    {tx("Sem frase nesta publicação:", "No sentence in this publication:")} {g.frases_ausentes.map((id) => tx(id, rotuloFrase(id, idioma))).join(", ")}.
                  </p>
                )}
              </div>
              <VisaoDestaques destaques={g.destaques} fatosEHipoteses={g.fatos_e_hipoteses} titulos={titulosRegras} />
            </div>
            <NotasDoPainel
              nome={P.sistema.pergunta}
              oQueMudou={oQueMudouSistema}
              comoInterpretar={tx(
                <>
                  Cada frase é um fato de um indicador na data da sua fonte, com a defasagem até o processamento. O trecho sublinhado leva ao painel que publica o número, e o botão de
                  prova refaz o cálculo por outro caminho. A caixa de destaques só mostra regras sobre o sistema confirmadas há poucos dias; vazia é o normal.{termosDasFrases}
                </>,
                <>
                  Each sentence is a fact about one indicator on the date of its source, with the lag up to processing. The underlined passage leads to the panel that publishes the number, and the
                  proof button redoes the calculation another way. The highlights box only shows rules about the system confirmed a few days ago; empty is the normal state.{termosDasFrases}
                </>,
              )}
              naoConcluir={tx(
                "As frases descrevem o estado de cada indicador na sua data, não a relação entre eles: reservatório, afluência, carga, térmicas, preço e rede não são apresentados como explicação uns dos outros. Hipóteses, quando aparecem, estão rotuladas e não foram testadas nesta página.",
                "The sentences describe the state of each indicator on its date, not the relationship between them: reservoir, inflow, load, thermal plants, price and grid are not presented as explaining one another. Hypotheses, when they appear, are labeled and were not tested on this page.",
              )}
            />
            <SecaoDoPainel nivel="analisar" id="sistema-tabela" titulo={tx("As frases como tabela: referência, defasagem, atualidade e revisões", "The sentences as a table: reference, lag, timeliness and revisions")}>
              <TabelaInterativa
                titulo={tx("Frases da síntese", "Summary sentences")}
                colunas={colunasFrases(idioma)}
                linhas={linhasFrases(g.frases)}
                chaveLinha="id"
                colunaRotulo="indicador"
                fonte={fonteTabelas}
                versao={g.data_processamento}
                nomeArquivo="visao-geral-frases"
                chaveUrl="p004.t"
                nota={tx("Mesmas frases da lista acima, na mesma ordem; a defasagem é contada até a data de processamento.", "The same sentences as in the list above, in the same order; the lag is counted up to the processing date.")}
              />
            </SecaoDoPainel>
            <SecaoDoPainel
              nivel="auditar"
              id="sistema-auditoria"
              titulo={tx("Como as frases são montadas e reproduzidas: valores, caminhos e versões", "How the sentences are built and reproduced: values, paths and versions")}
            >
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{goldNoBloco(g.nota, idioma, "visao-nota")}</p>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {tx(
                  <>
                    Cada frase é um fato de um indicador, montado por um modelo fixo a partir de números da base publicada de origem. A cada publicação a frase é refeita a partir do par modelo e valores; se a frase refeita
                    diferir da publicada, a gold vira stub e a última publicação válida é mantida. Os valores abaixo são os da base publicada de origem, com o caminho de cada um.
                  </>,
                  <>
                    Each sentence is a fact about one indicator, built by a fixed template from numbers in the published source base. In every publication the sentence is rebuilt from the template and values pair; if
                    the rebuilt sentence differs from the published one, the gold becomes a stub and the last valid publication is kept. The values below are those of the published source base, with the path of each one.
                  </>,
                )}
              </p>
              <VisaoTabelasSobDemanda conjunto="sistema-auditoria" fonte={fonteTabelas} versao={g.data_processamento} downloads={dlPor("sintese_revisoes")} />
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {tx(
                  <>
                    Revisões entre capturas nas séries desta página: {num(totalRevisoes, 0)} {totalRevisoes === 1 ? "referência revisada" : "referências revisadas"} nos conjuntos de operação,{" "}
                    {materiais === 0 ? "nenhuma material nas séries usadas" : `${num(materiais, 0)} ${materiais === 1 ? "material" : "materiais"} nas séries usadas`}.
                  </>,
                  <>
                    Revisions between captures in the series on this page: {num(totalRevisoes, 0)} {totalRevisoes === 1 ? "revised reference" : "revised references"} in the operation datasets,{" "}
                    {materiais === 0 ? "none material in the series used" : `${num(materiais, 0)} material in the series used`}.
                  </>,
                )}{" "}
                {goldNoBloco(g.revisoes.regra_material, idioma, "visao-revisoes-regra")}
              </p>
              <p className="rotulo text-mineral">{tx("Controles desta publicação", "Checks in this publication")}</p>
              <VisaoControles controles={g.validacao} />
            </SecaoDoPainel>
            <SeguirPainel ancora="sistema" proximo={{ href: "#sociedade", pergunta: P.sociedade.pergunta }} downloads={dlNoIdioma(dlPor("sintese_revisoes"))} />
          </PainelVisao>

          {/* P006 */}
          <PainelVisao
            id="sociedade"
            subtitulo={tx(
              "Tarifa residencial, continuidade do fornecimento (DEC, a duração equivalente de interrupção por unidade consumidora), perdas na distribuição e Tarifa Social: cada indicador tem data e universo próprios, e lidos juntos mostram o custo e a qualidade que cada fonte registra, sem descrever o dia",
              "Residential tariff, continuity of supply (DEC, the equivalent interruption duration per consumer unit), distribution losses and the Tarifa Social: each indicator has its own date and universe, and read together they show the cost and quality that each source records, without describing the day",
            )}
            fonte={tx(
              `Fontes: ANEEL (tarifas, continuidade, perdas e Tarifa Social), cada indicador no período da sua fonte; processado em ${dataBR(g.data_processamento)}.`,
              `Sources: ANEEL (tariffs, continuity, losses and Tarifa Social), each indicator in the period of its source; processed on ${dataBR(g.data_processamento)}.`,
            )}
          >
            <RespostaCurta id="sociedade" veredito={vereditoSociedade(g.sociedade, ctx.sociedade)}>
              {comNomesProprios(respostaSociedade(g.sociedade, ctx.sociedade), idioma, ctx.sociedade.dec?.universo?.parciais.map((x) => x.sigla))}
            </RespostaCurta>
            <VisaoRecorte
              periodo={
                g.sociedade.itens.length
                  ? g.sociedade.itens.map((it) => tx(`${minuscula(it.titulo)}: ${periodoCurto(it)}`, `${minuscula(goldEmString(it.titulo, idioma))}: ${periodoCurto(it)}`)).join("; ")
                  : tx("sem indicador nesta publicação", "no indicator in this publication")
              }
              universo={tx("Distribuidoras e consumidores do país, no universo de cada conjunto da ANEEL", "Distribution utilities and consumers in the country, in the universe of each ANEEL dataset")}
              unidade={tx(
                "R$/kWh, horas e interrupções por unidade consumidora (UC), % da energia injetada, unidades consumidoras com desconto",
                "R$/kWh, hours and interruptions per consumer unit (UC), % of injected energy, consumer units with a discount",
              )}
            />
            {/* diagnóstico de layout de 20/10/2026, item 7: o período de cada número fica no cartão ("não é a situação do dia"); o aviso e a linha do
                tempo que o detalham descem para Analisar */}
            <div data-nivel="analisar" className="space-y-4">
            <VisaoAviso>
              {tx(
                <>
                  Estes números têm período próprio e defasagem própria: uma tarifa vale pela vigência, continuidade e perdas valem pelo ano completo, o alcance da Tarifa Social vale pelo mês publicado. A
                  linha do tempo abaixo mostra o período de cada um contra a data de processamento.
                </>,
                <>
                  These numbers have their own period and their own lag: a tariff holds for its validity period, continuity and losses hold for the full year, the reach of the Tarifa Social holds for the
                  published month. The timeline below shows the period of each one against the processing date.
                </>,
              )}
            </VisaoAviso>
            </div>
            <VisaoSociedadeCartoes s={g.sociedade} ctx={ctx.sociedade} notas={{ beneficios: notaTS }} />
            {g.sociedade.ausentes.length > 0 && (
              <ul className="space-y-1 text-sm text-carvao-muted">
                {g.sociedade.ausentes.map((a) => (
                  <li key={a.id}>
                    {tx("Sem dado para", "No data for")} {a.id}: {goldNoBloco(a.motivo, idioma, `visao-sociedade-ausente-${a.id}`)}
                  </li>
                ))}
              </ul>
            )}
            <div data-nivel="analisar">
              <VisaoLinhaTempo s={g.sociedade} dataProcessamento={g.data_processamento} />
            </div>
            <NotasDoPainel
              nome={P.sociedade.pergunta}
              oQueMudou={oQueMudouSociedade}
              comoInterpretar={tx(
                "Cada cartão traz o valor e a prova do módulo de origem, o período a que o número se refere, a defasagem até o processamento, a cobertura e a atualidade do conjunto. Conjunto atrasado no painel de saúde dos dados aparece marcado. A ressalva que muda a leitura do número está logo abaixo dele.",
                "Each card carries the value and the proof from the source module, the period the number refers to, the lag up to processing, the coverage and the timeliness of the dataset. A dataset that is late in the data health panel appears flagged. The caveat that changes how the number is read is right below it.",
              )}
              naoConcluir={tx(
                "Um ano completo ou um mês de referência não descreve a situação do dia, e indicadores de universos diferentes (todas as distribuidoras, um conjunto de concessionárias, as unidades com Tarifa Social) não se somam nem se comparam entre si.",
                "A full year or a reference month does not describe the situation of the day, and indicators from different universes (all distribution utilities, a set of concession holders, the units with the Tarifa Social) are neither added up nor compared with one another.",
              )}
            />
            <SecaoDoPainel nivel="analisar" id="sociedade-tabela" titulo={tx("Os indicadores como tabela: período, defasagem, cobertura e atualidade", "The indicators as a table: period, lag, coverage and timeliness")}>
              <TabelaInterativa
                titulo={tx("Energia e sociedade", "Energy and society")}
                colunas={colunasSociedade(idioma)}
                linhas={linhasSociedade(g.sociedade)}
                chaveLinha="id"
                colunaRotulo="indicador"
                fonte={fonteTabelas}
                versao={g.data_processamento}
                nomeArquivo="visao-geral-sociedade"
                chaveUrl="p006.t"
                nota={tx(
                  "Valor e texto exibido copiados do módulo de origem, sem recálculo; o período é o do indicador, não o do processamento.",
                  "Value and displayed text copied from the source module, without recalculation; the period is that of the indicator, not that of the processing.",
                )}
              />
              <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                {tx("Regra do painel:", "Panel rule:")} {goldNoBloco(g.sociedade.regra, idioma, "visao-sociedade-regra")}
              </p>
            </SecaoDoPainel>
            <SeguirPainel ancora="sociedade" proximo={{ href: "#observar", pergunta: P.observar.pergunta }} downloads={[]} />
          </PainelVisao>

          {/* P007 */}
          <PainelVisao
            id="observar"
            subtitulo={tx(
              "Regras explícitas sobre os dados mais recentes, com condição, limiar, duração mínima e histórico de cada uma; a regra é escrita antes de olhar o dado, para o alerta não mudar conforme o resultado",
              "Explicit rules on the most recent data, with the condition, threshold, minimum duration and history of each one; the rule is written before looking at the data, so the alert does not change with the result",
            )}
            fonte={tx(
              `Fontes: as bases publicadas dos módulos de origem; histórico das regras reavaliado desde ${dataBR(g.historico_regras.inicio)} com os dados da data de processamento.`,
              `Sources: the published bases of the source modules; rule history reassessed since ${dataBR(g.historico_regras.inicio)} with the data as of the processing date.`,
            )}
          >
            <RespostaCurta id="observar" veredito={vereditoObservar(g.observar)}>
              {respostaObservar(g.observar)}
            </RespostaCurta>
            <VisaoRecorte
              periodo={tx(
                `Estado do dia na data de referência de cada regra; linha de estado dos últimos 365 dias; histórico reavaliado desde ${dataBR(g.historico_regras.inicio)} com os dados da data de processamento`,
                `State of the day on the reference date of each rule; state line for the last 365 days; history reassessed since ${dataBR(g.historico_regras.inicio)} with the data as of the processing date`,
              )}
              universo={tx(
                `${plural(regras.length, "regra", "regras")} sobre o sistema e sobre os próprios dados, e ${plural(g.observar.length - regras.length, "evento de calendário", "eventos de calendário")}`,
                `${plural(regras.length, "rule", "rules")} about the system and about the data themselves, and ${plural(g.observar.length - regras.length, "calendar event", "calendar events")}`,
              )}
              unidade={tx("Cada regra na unidade do indicador que avalia; limiares publicados na mesma unidade", "Each rule in the unit of the indicator it assesses; thresholds published in the same unit")}
            />
            {g.observar_sem_dado.length > 0 && (
              <VisaoAviso tipo="alerta">
                {tx<ReactNode>(
                  `Sem dado para avaliar nesta publicação: ${g.observar_sem_dado.map((x) => `${titulosRegras[x.id] ?? x.id} (${x.motivo})`).join("; ")}.`,
                  <>
                    No data to assess in this publication:{" "}
                    {g.observar_sem_dado.map((x, i) => (
                      <span key={x.id}>
                        {i > 0 && "; "}
                        {titulosRegras[x.id] ? tituloRegra(titulosRegras[x.id]) : x.id} ({goldNoBloco(x.motivo, idioma, `visao-observar-${x.id}`)})
                      </span>
                    ))}
                    .
                  </>,
                )}
              </VisaoAviso>
            )}
            <VisaoObservar itens={itens} comparaveis={comparaveis} padraoComparacao={padraoComparacao(g.observar, comparaveis)} dominio={dominio} />
            <NotasDoPainel
              nome={P.observar.pergunta}
              oQueMudou={oQueMudouObservar}
              comoInterpretar={tx(
                "O estado do dia vem com o valor avaliado e os limiares, e a linha de estado mostra os últimos 365 dias. Em alerta sobre os dados significa que a própria publicação pede cautela (fonte atrasada, PLD sem atualização, revisão material). Em observação, a condição já existe, mas ainda não durou o mínimo para virar alerta.",
                "The state of the day comes with the assessed value and the thresholds, and the state line shows the last 365 days. In alert about the data means that the publication itself calls for caution (late source, PLD not updated, material revision). Under observation, the condition already exists but has not yet lasted the minimum to become an alert.",
              )}
              naoConcluir={tx<ReactNode>(
                `Um alerta descreve uma condição e nunca atribui causa. ${g.historico_regras.falso_alarme}`,
                <>
                  An alert describes a condition and never says what produced it. {goldNoBloco(g.historico_regras.falso_alarme, idioma, "visao-falso-alarme")}
                </>,
              )}
            />
            <SecaoDoPainel nivel="analisar" id="observar-historico" titulo={tx("Frequência de disparo, sensibilidade e episódios", "Trigger frequency, sensitivity and episodes")}>
              {freq && <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{freq}</p>}
              <VisaoTabelasSobDemanda conjunto="observar-analise" fonte={fonteTabelas} versao={g.data_processamento} downloads={[...dlPor("sintese_regras_diario"), ...dlPor("sintese_episodios")]} />
              <p className="rotulo text-mineral">{tx("Arquivos para baixar e o estado de cada um", "Files to download and the state of each one")}</p>
              <DadosArquivos
                itens={itensDeArquivos([...dlPor("sintese_regras_diario"), ...dlPor("sintese_episodios")].map((d) => ({ rotulo: goldEmString(d.rotulo, idioma), url: d.url })), {
                  pub: publicacaoDados(),
                  manifesto: manifestoDados(),
                  dicionario: COLUNAS_ARQUIVO,
                })}
              />
            </SecaoDoPainel>
            <SecaoDoPainel
              nivel="auditar"
              id="observar-auditoria"
              titulo={tx("Registro das publicações, alertas não confirmados e origem das golds", "Record of publications, unconfirmed alerts and origin of the golds")}
            >
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {tx("O histórico das regras começa em", "The rule history starts on")} {dataBR(g.historico_regras.inicio)}. {goldNoBloco(g.historico_regras.regra, idioma, "visao-historico-regra")}
              </p>
              {g.alertas_nao_confirmados.length > 0 ? (
                <ul className="space-y-1 text-sm text-carvao-muted">
                  {g.alertas_nao_confirmados.map((a, i) => (
                    <li key={i} className="[overflow-wrap:anywhere]">
                      {JSON.stringify(a)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-carvao-muted">
                  {tx(
                    "Nenhum alerta publicado deixou de se confirmar depois de revisão da fonte, entre as publicações registradas.",
                    "No published alert failed to be confirmed after a source revision, among the recorded publications.",
                  )}
                </p>
              )}
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {tx(
                  <>
                    {emAlerta.length ? `Em alerta nesta publicação: ${emAlerta.map((o) => o.titulo).join("; ")}.` : "Nenhuma regra em alerta nesta publicação."} Publicação anterior registrada nesta execução:{" "}
                    {g.historico_regras.registro_publicacoes?.publicacao_anterior_registrada_nesta_execucao ? "sim" : "não"}.
                  </>,
                  <>
                    {emAlerta.length ? `In alert in this publication: ${emAlerta.map((o) => tituloRegra(o.titulo)).join("; ")}.` : "No rule in alert in this publication."} Previous publication recorded in this run:{" "}
                    {g.historico_regras.registro_publicacoes?.publicacao_anterior_registrada_nesta_execucao ? "yes" : "no"}.
                  </>,
                )}
              </p>
              <p className="rotulo text-mineral">{tx("Golds lidas nesta publicação", "Golds read in this publication")}</p>
              <ul className="space-y-1 text-xs leading-relaxed text-carvao-muted">
                {g.origens.map((o) => (
                  <li key={o.gold} className="[overflow-wrap:anywhere]">
                    {tx(
                      <>
                        {o.gold}: {o.disponivel ? `gerada em ${carimbo(o.gerado_em)}` : "indisponível"}
                        {o.versao_codigo ? `, código ${o.versao_codigo}` : ""}; {o.origem}; lida em {carimbo(o.lida_em)}
                        {o.idade_horas !== null && o.idade_horas !== undefined ? ` (${num(o.idade_horas, 1)} h de idade)` : ""}.
                      </>,
                      <>
                        {o.gold}: {o.disponivel ? `generated on ${carimbo(o.gerado_em)}` : "unavailable"}
                        {o.versao_codigo ? <>, code <code>{o.versao_codigo}</code></> : ""}; {goldNoBloco(o.origem, idioma, `visao-origem-${o.gold}`)}; read on {carimbo(o.lida_em)}
                        {o.idade_horas !== null && o.idade_horas !== undefined ? ` (${num(o.idade_horas, 1)} h old)` : ""}.
                      </>,
                    )}
                  </li>
                ))}
              </ul>
            </SecaoDoPainel>
            <SeguirPainel
              ancora="observar"
              proximo={{ href: PAGINAS_MAPA.pld.href, pergunta: PAGINAS_MAPA.pld.pergunta }}
              downloads={dlNoIdioma([...dlPor("sintese_regras_diario"), ...dlPor("sintese_episodios")])}
            />
          </PainelVisao>

          <footer className="mt-10 space-y-4 border-t border-linha pt-6 text-sm leading-relaxed text-carvao-muted">
            <div>
              <p className="rotulo text-mineral">{tx("Limitações desta publicação", "Limitations of this publication")}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {g.limitacoes.map((l, i) => (
                  <li key={l} data-nivel={partirBastidor(l).leitor ? undefined : "analisar"}>
                    {tx<ReactNode>(<TextoDoLeitor texto={l} />, goldNoBloco(l, idioma, `visao-limitacao-${i}`))}
                  </li>
                ))}
              </ul>
            </div>
            <p>
              {tx("Síntese publicada em", "Summary published on")} {carimbo(g.gerado_em)}.
              <span data-nivel="analisar">
                {" "}
                {tx(
                  <>
                    Base {g.gold}, versão {g.versao_pipeline} (código {g.versao_codigo}).
                  </>,
                  <>
                    Base {g.gold}, version {g.versao_pipeline} (code {g.versao_codigo}).
                  </>,
                )}
              </span>{" "}
              <Link href="/setor-eletrico/metodologia#sintese" className="text-energia-dark underline underline-offset-4">
                {tx("Regras das frases e dos alertas", "Rules for the sentences and the alerts")}
              </Link>
              {" · "}
              <Link href="/setor-eletrico/dados" className="text-energia-dark underline underline-offset-4">
                {tx("Dados e catálogo", "Data and catalog")}
              </Link>

            </p>
          </footer>
        </ModoProfundidade>
      </main>
    </>
  );
}
