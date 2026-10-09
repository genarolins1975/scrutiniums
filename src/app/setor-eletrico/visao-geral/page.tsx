import type { Metadata } from "next";
import { TextoEnergia } from "@/components/energia/TextoEnergia";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
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
import { integra, lerGold } from "@/lib/energia/gold";
import { PAGINAS_MAPA } from "@/lib/energia/mapa";
import type { IdFrase, IdRegra, RegraObservar, SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import {
  ANCORAS_DETERMINANTES,
  COLUNAS_FRASES,
  COLUNAS_SOCIEDADE,
  PAINEIS_VISAO,
  ROTA_VISAO,
  ROTULO_ESTADO,
  URL_GOLD_VISAO,
  determinantesDaPagina,
  dominioEstados,
  linhasFrases,
  linhasSociedade,
  minuscula,
  notaCarga,
  notaCmoNorte,
  notaRede,
  notaTarifaSocial,
  pedeAtencao,
  periodoCurto,
  posicaoDeterminante,
  referenciasFrases,
  regrasDaFrase,
  respostaDeterminantes,
  respostaObservar,
  respostaSistema,
  respostaSociedade,
  textoFrequenciaConjunta,
  textoLinhaEstado,
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

export const metadata: Metadata = {
  title: "Visão geral: o que está acontecendo no sistema elétrico",
  description:
    "O sistema elétrico brasileiro em poucos minutos: preço, água, geração, carga e rede alinhados pelo calendário, cada um com a data da sua fonte e uma referência ao lado do número; seis fatos com evidência; custo e qualidade para o consumidor com o período de cada número; e as regras que dizem o que observar, com limiar, duração e histórico.",
  alternates: { canonical: "/setor-eletrico/visao-geral" },
};

const P = Object.fromEntries(PAINEIS_VISAO.map((p) => [p.id, p])) as Record<(typeof PAINEIS_VISAO)[number]["id"], (typeof PAINEIS_VISAO)[number]>;

/** Itens do "O que observar": o resumo de cada regra montado no servidor; o detalhe é lido da gold ao abrir. */
function itensObservar(observar: readonly RegraObservar[], notas: Partial<Record<IdRegra, string | null>>, titulosConjuntos: Record<string, string>): ItemObservar[] {
  return observar.map((o, i) => ({
    id: o.id,
    titulo: o.titulo,
    tipo: o.tipo,
    assunto: o.assunto,
    estado: o.estado,
    rotuloEstado: ROTULO_ESTADO[o.estado] ?? o.estado,
    referencia: o.referencia,
    href: o.href,
    resumo: <VisaoRegraResumo o={o} caminho={`observar[${i}]`} nota={notas[o.id]} titulosConjuntos={titulosConjuntos} />,
  }));
}

/** Regras com linha de estado publicada, comparáveis sobre o mesmo eixo de datas. */
function comparaveisObservar(observar: readonly RegraObservar[]): LinhaComparavel[] {
  return observar
    .filter((o) => o.linha_estado?.inicio && o.linha_estado.estados)
    .map((o) => ({ id: o.id, rotulo: o.titulo, trechos: trechosEstado(o.linha_estado), texto: textoLinhaEstado(o) ?? "" }));
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

  const ctx = contextoVisao(g);
  const refs = referenciasFrases(g.frases);
  // os determinantes com a EAR da série publicada (uma só passagem de arredondamento) e a mediana da data desenhada
  const det = g.multiplos ? determinantesDaPagina(g.multiplos, ctx.earSin, ctx.bandasAgua, ctx.medianaAgua.base) : null;
  const m = det?.m ?? null;
  const datasRef = m ? Object.values(m.datas_referencia).filter((d): d is string => !!d).sort() : [];
  const todasAsDatas = [...datasRef, ...(refs ? [refs.min, refs.max] : [])].sort();
  const titulosRegras = Object.fromEntries(g.observar.map((o) => [o.id, o.titulo]));

  // pontes entre números que parecem divergir (janelas, meses e universos diferentes): cada nota lê só dados publicados
  const cmo = lerGold<{ semana_referencia?: string; serie?: SemanaCmo[] }>("cmo.json");
  const inclusao = lerGold<{ tarifa_social?: { serie_mensal?: MesSerieTarifaSocial[] } }>("inclusao.json");
  const beneficios = g.sociedade.itens.find((x) => x.id === "beneficios");
  const notaTS = beneficios ? notaTarifaSocial(beneficios, inclusao?.tarifa_social?.serie_mensal) : null;
  const notasRegras: Partial<Record<IdRegra, string | null>> = {
    cmo_semana: cmo?.semana_referencia ? notaCmoNorte(cmo.serie, cmo.semana_referencia) : null,
    atualidade_fontes: notaTS ? `${beneficios!.titulo}: ${notaTS}` : null,
  };
  // "percentil" como o painel de PLD o define (pld.json, regras.posicao_historica): o texto é o da própria gold
  const pld = lerGold<{ regras?: { posicao_historica?: string } }>("pld.json");
  const termosDasFrases = pld?.regras?.posicao_historica
    ? ` Termos: p.p. é a abreviação de pontos percentuais; percentil, como o painel de PLD o define: ${pld.regras.posicao_historica}`
    : " Termos: p.p. é a abreviação de pontos percentuais.";
  const saude = lerGold<{ conjuntos?: { id: string; titulo: string }[] }>("publicacao.json");
  const titulosConjuntos = Object.fromEntries((saude?.conjuntos ?? []).map((c) => [c.id.split("/").pop() ?? c.id, c.titulo]));
  const itens = itensObservar(g.observar, notasRegras, titulosConjuntos);
  const comparaveis = comparaveisObservar(g.observar);
  const dominio = dominioEstados(g.observar);
  const regras = g.observar.filter((o) => o.tipo !== "evento");
  const emAlerta = regras.filter((o) => o.ativo);
  const alertaSistema = emAlerta.filter((o) => o.assunto === "sistema");
  const alertaDados = emAlerta.filter((o) => o.assunto === "dados");
  const observacao = regras.filter((o) => o.estado === "em_observacao");
  const fonteTabelas = `Scrutiniums, gold sintese.json gerada em ${carimbo(g.gerado_em)} a partir das bases publicadas de origem`;
  const dlPor = (parte: string) => g.downloads.filter((d) => d.url.includes(parte));
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
        <ComproveNumero sobDemanda={{ url: URL_GOLD_VISAO, ...l.comprove }} endereco={`${ROTA_VISAO}#${ANCORAS_DETERMINANTES[id].id}`} />
      </div>
    ) : null;
  };
  const pPreco = painel("preco");
  const pAgua = painel("agua");
  const pGeracao = painel("geracao");
  const pCarga = painel("carga");
  const posCarga = m && pCarga ? posicaoDeterminante(pCarga, m) : null;
  const medianaNoDia = m && pAgua ? m.dados.find((l) => l.d === pAgua.data_referencia)?.agua_p50 : undefined;
  const sentido = (v: number) => (v >= 0 ? "acima" : "abaixo");
  const refPreco =
    ctx.pldReferencia && ctx.pldReferencia.percentilMes !== null && ctx.pldReferencia.percentilTodos !== null
      ? `Mesmo mês dos anos anteriores: percentil ${num(ctx.pldReferencia.percentilMes, 1)}; todas as médias desde 2021: ${num(ctx.pldReferencia.percentilTodos, 1)}.`
      : null;
  const refCarga =
    ctx.carga7d && ctx.carga7d.variacaoPct !== null
      ? `7 dias: ${num(Math.abs(ctx.carga7d.variacaoPct), 1)}% ${sentido(ctx.carga7d.variacaoPct)} das mesmas datas do ano anterior${
          ctx.cargaModulo?.mesmosDiasDaSemanaPct != null ? `; a página Carga dá ${num(Math.abs(ctx.cargaModulo.mesmosDiasDaSemanaPct), 2)}%` : ""
        }.`
      : null;
  const refTermica = ctx.termica && ctx.termica.p10 !== null && ctx.termica.p90 !== null ? `Faixa dos 365 dias anteriores: ${num(ctx.termica.p10, 1)}% a ${num(ctx.termica.p90, 1)}%.` : null;
  const refAgua = [
    typeof medianaNoDia === "number" ? `Mediana da data: ${num(medianaNoDia, 1)}%.` : "",
    ctx.aguaModulo ? `A página Água e clima traz ${num(ctx.aguaModulo.pct, 1)}% em ${dataBR(ctx.aguaModulo.dia)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  /* ---------------- notas dos painéis */
  const oQueMudouDeterminantes = m ? vereditoDeterminantes(m) : "Os determinantes alinhados não foram publicados nesta execução.";
  const oQueMudouSistema = g.destaques.itens.length
    ? `${plural(g.destaques.itens.length, "regra sobre o sistema teve o alerta confirmado", "regras sobre o sistema tiveram o alerta confirmado")} nos últimos ${plural(g.destaques.novidade_dias, "dia", "dias")}: ${g.destaques.itens
        .map((d) => minuscula(d.titulo))
        .join("; ")}.`
    : (g.destaques.vazio ?? "Nenhum destaque nesta publicação.");
  const oQueMudouSociedade = g.sociedade.itens.length
    ? `Cada indicador tem período próprio: ${g.sociedade.itens.map((it) => `${minuscula(it.titulo)}, ${periodoCurto(it)}`).join("; ")}.`
    : "Nenhum indicador de energia e sociedade disponível nesta publicação.";

  return (
    <>
      <CabecalhoEnergia atual="visao-geral" />
      <MarcaVisita secao="energia:visao-geral" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16">
        <CabecalhoModulo
          siglas={["SIN", "PLD", "EAR", "ENA", "MLT", "MMGD", "MWmed", "ONS", "ANEEL", "CCEE", "CMO", "DEC", "FEC", "CDE", "UC", "SCS"]}
          titulo={PAGINAS_MAPA["visao-geral"].pergunta}
          lead={
            <>
              Preço, água, geração e carga do <Termo slug="sin">Sistema Interligado Nacional (SIN)</Termo>, cada um com a data da sua fonte e uma referência ao lado do número.
            </>
          }
          recorte={todasAsDatas.length ? `${dataBR(todasAsDatas[0])} a ${dataBR(todasAsDatas[todasAsDatas.length - 1])} · SIN e submercados · cada medida com data e unidade próprias` : "sem data nesta publicação"}
          fonte="ONS, CCEE e ANEEL"
          referencia={
            <>
              Processado em {dataBR(g.data_processamento)} (data civil de Brasília). Cada número usa a data de referência da sua fonte, escrita junto dele; indicadores de energia e sociedade
              têm período próprio (vigência, ano ou mês).
            </>
          }
          datas={
            <VisaoDatas
              itens={[
                ...(m ? m.paineis.map((p) => ({ rotulo: p.titulo, texto: `${p.id === "geracao" ? "7 dias até " : "até "}${dataBR(p.data_referencia)}`, natureza: p.natureza })) : []),
                { rotulo: "Fatos do sistema", texto: refs ? (refs.min === refs.max ? dataBR(refs.min) : `${dataBR(refs.min)} a ${dataBR(refs.max)}, uma data por fato`) : "sem dado nesta publicação" },
                { rotulo: "Energia e sociedade", texto: "vigência, ano ou mês de cada indicador" },
              ]}
            />
          }
          metricas={
            m && pPreco && pAgua && pGeracao && pCarga ? (
              <FaixaMetricas colunas={4} rotulo="Indicadores do sistema, cada um na data da sua fonte">
                <Numero
                  variante="faixa"
                  rotulo={`PLD (Preço de Liquidação das Diferenças)${pPreco.valor_atual.rotulo ? `, ${pPreco.valor_atual.rotulo}` : ""}`}
                  natureza={pPreco.natureza}
                  valor={pPreco.valor_atual.valor}
                  formato="reais"
                  casas={2}
                  unidade="R$/MWh"
                  periodo={`média do dia ${dataBR(pPreco.data_referencia)}`}
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
                  rotulo="Energia armazenada (EAR) nos reservatórios do SIN"
                  natureza={pAgua.natureza}
                  valor={pAgua.valor_atual.valor}
                  formato="pct"
                  casas={1}
                  unidade="da EAR máxima"
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
                  rotulo="Carga do SIN, em megawatts médios (MWmed)"
                  natureza={pCarga.natureza}
                  valor={pCarga.valor_atual.valor}
                  formato="num"
                  casas={0}
                  unidade="MWmed"
                  periodo={`dia ${dataBR(pCarga.data_referencia)}`}
                  cor="var(--cor-energia)"
                  variacao={posCarga && posCarga.variacao_pct !== null ? { valor: posCarga.variacao_pct, casas: 1, sufixo: "%", referencia: "frente ao mesmo dia da semana do ano anterior" } : undefined}
                  nota={
                    <>
                      {refCarga}
                      {comprove("carga")}
                    </>
                  }
                />
                <Numero
                  variante="faixa"
                  rotulo="Participação térmica na geração do SIN"
                  natureza={pGeracao.natureza}
                  valor={pGeracao.valor_atual.valor}
                  formato="pct"
                  casas={1}
                  unidade="da geração verificada"
                  periodo={`7 dias até ${dataBR(pGeracao.data_referencia)}`}
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
          A página reúne quatro painéis: os cinco determinantes lado a lado, os fatos do sistema com a prova de cada número, o que chega ao consumidor em custo e qualidade, e as regras que
          dizem o que observar. Tudo é lido das bases publicadas dos módulos de origem; o que não está integrado aparece como ausência, nunca como estimativa.
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
            porQueImporta="Preço, água armazenada, geração térmica, carga e fluxo entre regiões são cinco medidas que o observatório publica em módulos próprios. Lidas no mesmo calendário, mostram o que mudou nos mesmos dias, sem afirmar que uma explica a outra."
            fonte={
              <>
                Fontes: ONS (energia armazenada, carga, geração e rede) e CCEE (PLD), lidas dos módulos de origem
                {datasRef.length ? `; referência de ${dataBR(datasRef[0])} a ${dataBR(datasRef[datasRef.length - 1])}` : ""}. Processado em {dataBR(g.data_processamento)}.
              </>
            }
          >
            {m && det ? (
              <>
                <VisaoDeterminantes
                  d={det.leves}
                  ancoras={ANCORAS_DETERMINANTES}
                  fonte={fonteTabelas}
                  notas={{
                    preco: ctx.doisCriteriosPld ? [ctx.doisCriteriosPld] : [],
                    agua: [ctx.capacidadeAgua, ctx.earNoModulo].filter((x): x is string => !!x),
                    carga: [notaCarga({ frases: g.frases, multiplos: m }), ctx.cargaNoModulo].filter((x): x is string => !!x),
                    rede: [notaRede({ frases: g.frases, multiplos: m }), ctx.saldoRede].filter((x): x is string => !!x),
                  }}
                />
                <VisaoAviso tipo="alerta">{m.aviso_datas}</VisaoAviso>
                <RespostaCurta id="determinantes" veredito={vereditoDeterminantes(m)} depois>
                  <ul className="space-y-1.5">
                    {respostaDeterminantes(m).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </RespostaCurta>
                <NotasDoPainel
                  oQueMudou={oQueMudouDeterminantes}
                  comoInterpretar={
                    <>
                      Cada painel traz a própria referência, escrita sob o gráfico: a faixa histórica da data para a água, o intervalo entre percentis para o preço e para a participação térmica,
                      o mesmo dia da semana do ano anterior para a carga e o zero para o sentido do fluxo. Estar dentro da faixa quer dizer que o valor está entre os dois percentis da
                      referência. Os valores são copiados das bases publicadas de origem, célula a célula, sem recálculo; dia em branco é dia sem valor na origem, nunca zero.
                    </>
                  }
                  naoConcluir="Alinhar os painéis pelo calendário não afirma que um determina o outro. Estar dentro da faixa não diz que o valor é esperado ou desejável. Fluxo alto na rede não indica congestionamento: os limites de intercâmbio não estão integrados."
                />
                <p data-nivel="auditar" className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                  Regra do painel: {m.regra}
                </p>
              </>
            ) : (
              <VisaoAviso tipo="alerta">Os determinantes alinhados não foram publicados nesta execução: o bloco de determinantes da gold está ausente; os painéis de origem continuam disponíveis nos módulos.</VisaoAviso>
            )}
            <SeguirPainel
              ancora="determinantes"
              proximo={{ href: "#sistema", pergunta: P.sistema.pergunta }}
              downloads={(m?.download ?? []).map((d) => ({ ...d, rotulo: "Determinantes alinhados, sempre os 90 dias publicados (CSV; não muda com a janela escolhida)" }))}
            />
          </PainelVisao>

          {/* P004 */}
          <PainelVisao
            id="sistema"
            subtitulo="O sistema em 60 segundos · seis fatos, cada um na sua data e com a prova do número"
            porQueImporta="Os fatos reúnem, em uma frase por indicador, onde estão os reservatórios, a água que chega a eles, a carga, a participação das térmicas, o preço e o fluxo entre regiões. A frase não explica a relação entre eles; a ligação conceitual entre essas partes está no mapa do observatório."
            fonte="Fontes: as bases publicadas dos módulos de origem, cada fato na data da sua fonte; a prova de cada número refaz o cálculo."
          >
            <RespostaCurta id="sistema" veredito={vereditoSistema(g)}>
              {respostaSistema(g)}
            </RespostaCurta>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
              <div className="min-w-0">
                {g.frases.length ? (
                  <VisaoFrases frases={g.frases} notas={{ carga: notaCarga(g) ?? undefined, rede: notaRede(g) ?? undefined }} marcas={marcas} />
                ) : (
                  <VisaoAviso tipo="alerta">Nenhuma frase pôde ser escrita nesta publicação: faltam os dados de origem.</VisaoAviso>
                )}
                {g.frases_ausentes.length > 0 && <p className="mt-3 text-xs text-carvao-muted">Sem frase nesta publicação: {g.frases_ausentes.join(", ")}.</p>}
              </div>
              <VisaoDestaques destaques={g.destaques} fatosEHipoteses={g.fatos_e_hipoteses} titulos={titulosRegras} />
            </div>
            <NotasDoPainel
              oQueMudou={oQueMudouSistema}
              comoInterpretar={
                <>
                  Cada frase é um fato de um indicador na data da sua fonte, com a defasagem até o processamento. O trecho sublinhado leva ao painel que publica o número, e o botão de
                  prova refaz o cálculo por outro caminho. A caixa de destaques só mostra regras sobre o sistema confirmadas há poucos dias; vazia é o normal.{termosDasFrases}
                </>
              }
              naoConcluir="As frases descrevem o estado de cada indicador na sua data, não a relação entre eles: reservatório, afluência, carga, térmicas, preço e rede não são apresentados como explicação uns dos outros. Hipóteses, quando aparecem, estão rotuladas e não foram testadas nesta página."
            />
            <SecaoDoPainel nivel="analisar" id="sistema-tabela" titulo="As frases como tabela: referência, defasagem, atualidade e revisões">
              <TabelaInterativa
                titulo="Frases da síntese"
                colunas={COLUNAS_FRASES}
                linhas={linhasFrases(g.frases)}
                chaveLinha="id"
                colunaRotulo="indicador"
                fonte={fonteTabelas}
                versao={g.data_processamento}
                nomeArquivo="visao-geral-frases"
                chaveUrl="p004.t"
                nota="Mesmas frases da lista acima, na mesma ordem; a defasagem é contada até a data de processamento."
              />
            </SecaoDoPainel>
            <SecaoDoPainel nivel="auditar" id="sistema-auditoria" titulo="Como as frases são montadas e reproduzidas: valores, caminhos e versões">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{g.nota}</p>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Cada frase é um fato de um indicador, montado por um modelo fixo a partir de números da base publicada de origem. A cada publicação a frase é refeita a partir do par modelo e valores; se a frase refeita
                diferir da publicada, a gold vira stub e a última publicação válida é mantida. Os valores abaixo são os da base publicada de origem, com o caminho de cada um.
              </p>
              <VisaoTabelasSobDemanda conjunto="sistema-auditoria" fonte={fonteTabelas} versao={g.data_processamento} downloads={dlPor("sintese_revisoes")} />
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Revisões entre capturas nas séries desta página: {num(totalRevisoes, 0)} {totalRevisoes === 1 ? "referência revisada" : "referências revisadas"} nos conjuntos de operação,{" "}
                {materiais === 0 ? "nenhuma material nas séries usadas" : `${num(materiais, 0)} ${materiais === 1 ? "material" : "materiais"} nas séries usadas`}. {g.revisoes.regra_material}
              </p>
              <p className="rotulo text-mineral">Controles desta publicação</p>
              <VisaoControles controles={g.validacao} />
            </SecaoDoPainel>
            <SeguirPainel ancora="sistema" proximo={{ href: "#sociedade", pergunta: P.sociedade.pergunta }} downloads={[...dlPor("sintese_revisoes")]} />
          </PainelVisao>

          {/* P006 */}
          <PainelVisao
            id="sociedade"
            subtitulo="Tarifa residencial, continuidade do fornecimento (DEC, a duração equivalente de interrupção por unidade consumidora), perdas na distribuição e Tarifa Social · período próprio de cada indicador"
            porQueImporta="O que chega ao consumidor tem datas e universos próprios: a tarifa vale pela vigência, a continuidade e as perdas pelo ano completo, o alcance da Tarifa Social pelo mês publicado. Lidos juntos, mostram o custo e a qualidade que cada fonte registra, sem descrever o dia."
            fonte={`Fontes: ANEEL (tarifas, continuidade, perdas e Tarifa Social), cada indicador no período da sua fonte; processado em ${dataBR(g.data_processamento)}.`}
          >
            <RespostaCurta id="sociedade" veredito={vereditoSociedade(g.sociedade, ctx.sociedade)}>
              {respostaSociedade(g.sociedade, ctx.sociedade)}
            </RespostaCurta>
            <VisaoRecorte
              periodo={g.sociedade.itens.length ? g.sociedade.itens.map((it) => `${minuscula(it.titulo)}: ${periodoCurto(it)}`).join("; ") : "sem indicador nesta publicação"}
              universo="Distribuidoras e consumidores do país, no universo de cada conjunto da ANEEL"
              unidade="R$/kWh, horas e interrupções por unidade consumidora (UC), % da energia injetada, unidades consumidoras com desconto"
            />
            <VisaoAviso>
              Estes números têm período próprio e defasagem própria: uma tarifa vale pela vigência, continuidade e perdas valem pelo ano completo, o alcance da Tarifa Social vale pelo mês publicado. A
              linha do tempo abaixo mostra o período de cada um contra a data de processamento.
            </VisaoAviso>
            <VisaoSociedadeCartoes s={g.sociedade} ctx={ctx.sociedade} notas={{ beneficios: notaTS }} />
            {g.sociedade.ausentes.length > 0 && (
              <ul className="space-y-1 text-sm text-carvao-muted">
                {g.sociedade.ausentes.map((a) => (
                  <li key={a.id}>
                    Sem dado para {a.id}: {a.motivo}
                  </li>
                ))}
              </ul>
            )}
            <VisaoLinhaTempo s={g.sociedade} dataProcessamento={g.data_processamento} />
            <NotasDoPainel
              oQueMudou={oQueMudouSociedade}
              comoInterpretar="Cada cartão traz o valor e a prova do módulo de origem, o período a que o número se refere, a defasagem até o processamento, a cobertura e a atualidade do conjunto. Conjunto atrasado no painel de saúde dos dados aparece marcado. A ressalva que muda a leitura do número está logo abaixo dele."
              naoConcluir="Um ano completo ou um mês de referência não descreve a situação do dia, e indicadores de universos diferentes (todas as distribuidoras, um conjunto de concessionárias, as unidades com Tarifa Social) não se somam nem se comparam entre si."
            />
            <SecaoDoPainel nivel="analisar" id="sociedade-tabela" titulo="Os indicadores como tabela: período, defasagem, cobertura e atualidade">
              <TabelaInterativa
                titulo="Energia e sociedade"
                colunas={COLUNAS_SOCIEDADE}
                linhas={linhasSociedade(g.sociedade)}
                chaveLinha="id"
                colunaRotulo="indicador"
                fonte={fonteTabelas}
                versao={g.data_processamento}
                nomeArquivo="visao-geral-sociedade"
                chaveUrl="p006.t"
                nota="Valor e texto exibido copiados do módulo de origem, sem recálculo; o período é o do indicador, não o do processamento."
              />
              <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">Regra do painel: {g.sociedade.regra}</p>
            </SecaoDoPainel>
            <SeguirPainel ancora="sociedade" proximo={{ href: "#observar", pergunta: P.observar.pergunta }} downloads={[]} />
          </PainelVisao>

          {/* P007 */}
          <PainelVisao
            id="observar"
            subtitulo="Regras explícitas sobre os dados mais recentes · condição, limiar, duração mínima e histórico de cada uma"
            porQueImporta="Cada regra tem condição, limiar, duração mínima para confirmar o alerta e regra de retorno à normalidade. Escrever a regra antes de olhar o dado evita que o alerta mude conforme o resultado."
            fonte={`Fontes: as bases publicadas dos módulos de origem; histórico das regras reavaliado desde ${dataBR(g.historico_regras.inicio)} com os dados da data de processamento.`}
          >
            <RespostaCurta id="observar" veredito={vereditoObservar(g.observar)}>
              {respostaObservar(g.observar)}
            </RespostaCurta>
            <VisaoRecorte
              periodo={`Estado do dia na data de referência de cada regra; linha de estado dos últimos 365 dias; histórico reavaliado desde ${dataBR(g.historico_regras.inicio)} com os dados da data de processamento`}
              universo={`${plural(regras.length, "regra", "regras")} sobre o sistema e sobre os próprios dados, e ${plural(g.observar.length - regras.length, "evento de calendário", "eventos de calendário")}`}
              unidade="Cada regra na unidade do indicador que avalia; limiares publicados na mesma unidade"
            />
            {g.observar_sem_dado.length > 0 && (
              <VisaoAviso tipo="alerta">Sem dado para avaliar nesta publicação: {g.observar_sem_dado.map((x) => `${titulosRegras[x.id] ?? x.id} (${x.motivo})`).join("; ")}.</VisaoAviso>
            )}
            <VisaoObservar itens={itens} comparaveis={comparaveis} padraoComparacao={padraoComparacao(g.observar, comparaveis)} dominio={dominio} />
            <NotasDoPainel
              oQueMudou={respostaObservar(g.observar)}
              comoInterpretar="O estado do dia vem com o valor avaliado e os limiares, e a linha de estado mostra os últimos 365 dias. Em alerta sobre os dados significa que a própria publicação pede cautela (fonte atrasada, PLD sem atualização, revisão material). Em observação, a condição já existe, mas ainda não durou o mínimo para virar alerta."
              naoConcluir={`Um alerta descreve uma condição e nunca atribui causa. ${g.historico_regras.falso_alarme}`}
            />
            <SecaoDoPainel nivel="analisar" id="observar-historico" titulo="Frequência de disparo, sensibilidade e episódios">
              {freq && <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{freq}</p>}
              <VisaoTabelasSobDemanda conjunto="observar-analise" fonte={fonteTabelas} versao={g.data_processamento} downloads={[...dlPor("sintese_regras_diario"), ...dlPor("sintese_episodios")]} />
            </SecaoDoPainel>
            <SecaoDoPainel nivel="auditar" id="observar-auditoria" titulo="Registro das publicações, alertas não confirmados e origem das golds">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                O histórico das regras começa em {dataBR(g.historico_regras.inicio)}. {g.historico_regras.regra}
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
                <p className="text-sm text-carvao-muted">Nenhum alerta publicado deixou de se confirmar depois de revisão da fonte, entre as publicações registradas.</p>
              )}
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {emAlerta.length ? `Em alerta nesta publicação: ${emAlerta.map((o) => o.titulo).join("; ")}.` : "Nenhuma regra em alerta nesta publicação."} Publicação anterior registrada nesta execução:{" "}
                {g.historico_regras.registro_publicacoes?.publicacao_anterior_registrada_nesta_execucao ? "sim" : "não"}.
              </p>
              <p className="rotulo text-mineral">Golds lidas nesta publicação</p>
              <ul className="space-y-1 text-xs leading-relaxed text-carvao-muted">
                {g.origens.map((o) => (
                  <li key={o.gold} className="[overflow-wrap:anywhere]">
                    {o.gold}: {o.disponivel ? `gerada em ${carimbo(o.gerado_em)}` : "indisponível"}
                    {o.versao_codigo ? `, código ${o.versao_codigo}` : ""}; {o.origem}; lida em {carimbo(o.lida_em)}
                    {o.idade_horas !== null && o.idade_horas !== undefined ? ` (${num(o.idade_horas, 1)} h de idade)` : ""}.
                  </li>
                ))}
              </ul>
            </SecaoDoPainel>
            <SeguirPainel
              ancora="observar"
              proximo={{ href: PAGINAS_MAPA.pld.href, pergunta: PAGINAS_MAPA.pld.pergunta }}
              downloads={[...dlPor("sintese_regras_diario"), ...dlPor("sintese_episodios")]}
            />
          </PainelVisao>

          <footer className="mt-10 space-y-4 border-t border-linha pt-6 text-sm leading-relaxed text-carvao-muted">
            <div>
              <p className="rotulo text-mineral">Limitações desta publicação</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {g.limitacoes.map((l) => (
                  <li key={l} data-nivel={partirBastidor(l).leitor ? undefined : "analisar"}>
                    <TextoDoLeitor texto={l} />
                  </li>
                ))}
              </ul>
            </div>
            <p>
              Síntese publicada em {carimbo(g.gerado_em)}.
              <span data-nivel="analisar">
                {" "}
                Base {g.gold}, versão {g.versao_pipeline} (código {g.versao_codigo}).
              </span>{" "}
              <Link href="/setor-eletrico/metodologia#sintese" className="text-energia-dark underline underline-offset-4">
                Regras das frases e dos alertas
              </Link>
              {" · "}
              <Link href="/setor-eletrico/dados" className="text-energia-dark underline underline-offset-4">
                Dados e catálogo
              </Link>
            </p>
          </footer>
        </ModoProfundidade>
      </main>
    </>
  );
}
