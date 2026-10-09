import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GeracaoCapacidadeAneel, GeracaoCapacidadeDistribuicao } from "@/components/energia/GeracaoCapacidade";
import {
  GeracaoAviso,
  GeracaoDatas,
  GeracaoFrases,
  GeracaoIndisponivel,
  GeracaoNavegacao,
  GeracaoRecorte,
  GeracaoRegras,
  GeracaoSeguir,
} from "@/components/energia/GeracaoPagina";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import {
  CATEGORIAS_CAPACIDADE,
  COLUNAS_FC_ACIMA_100,
  COLUNAS_MMGD_CAPACIDADE,
  COR_CATEGORIA,
  CURTO_CATEGORIA,
  ROTULO_CASAMENTO,
  ROTULO_REGRA,
  colunasCapacidade,
  coberturaDaPotencia,
  diferencasAneelOns,
  downloadsDoPainel,
  emPortugues,
  linhasCapacidade,
  linhasFcAcima100,
  linhasFcConferencia,
  linhasFcMensal,
  linhasMmgdCapacidade,
  linhasPotenciaMensal,
  paraTabela,
  perguntaPainel,
  respostaCapacidade,
  rotaPainel,
  situacaoMensal,
  textoMudancaMensal,
  textoSemComparacaoMensal,
  vereditoCapacidade,
} from "@/lib/energia/geracao";
import { integra, lerGold } from "@/lib/energia/gold";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Geração: quanto está instalado e quanto produz",
  description:
    "Potência das usinas despachadas pelo ONS por fonte, fator de capacidade com a potência em operação de cada mês, distribuição por usina, a capacidade da ANEEL e a micro e minigeração distribuída lado a lado nas mesmas datas, sem somar universos diferentes.",
  alternates: { canonical: "/setor-eletrico/geracao/capacidade" },
};

const FONTE = "ONS, Capacidade Instalada de Geração e Geração por Usina";
const FONTE_ANEEL = "ANEEL, série histórica da capacidade instalada por tipo de geração";

/** Categorias que abrem visíveis na série mensal (as demais ficam na legenda, ocultas). */
const VISIVEIS_MENSAL = ["hidraulica", "eolica", "solar_centralizada"];

export default function GeracaoCapacidadePage() {
  const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json");
  if (!integra(g) || !g.capacidade) {
    return <GeracaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo ?? (g ? "A capacidade e o fator de capacidade não estão na base publicada nesta atualização." : undefined)} />;
  }
  const c = g.capacidade;
  const ev = g.evidencias;
  const u = c.ultimos_12m;
  const ultimoMes = c.mensal.meses[c.mensal.meses.length - 1] ?? null;
  const atual = situacaoMensal(ultimoMes, g.gerado_em, "o fator de capacidade mensal");
  const versao = ultimoMes ?? g.dia_referencia;
  const periodo12 = u ? `${mesAno(u.inicio)} a ${mesAno(u.fim)}` : "12 meses";
  const linhas = linhasCapacidade(c);
  const retrato = [...c.retrato.por_categoria].sort((a, b) => (b.mw ?? 0) - (a.mw ?? 0));
  // as duas figuras seguem a mesma ordem de fontes (da maior potência para a menor): instalado e produzido lado a lado, linha com linha
  const fcNaOrdem = retrato.map((x) => linhas.find((l) => l.id === x.categoria)).filter((l): l is NonNullable<typeof l> => !!l);
  const ocultas = CATEGORIAS_CAPACIDADE.filter((k) => !VISIVEIS_MENSAL.includes(k));
  const mmgd = c.contexto.mmgd;
  const siga = c.contexto.siga;
  const sigaHist = c.contexto.siga_historico;
  const par = c.pareamento;

  const diferencas = diferencasAneelOns(linhas);
  const parteDaPotencia = coberturaDaPotencia(linhas);
  const usinasNoRetrato = Object.fromEntries(c.retrato.por_categoria.map((x) => [x.categoria, x.usinas]));
  // o que mudou: o fator de capacidade e a potência das fontes de referência no último mês completo, contra o mês anterior e o mesmo mês de um ano antes
  const mudancas = [
    textoMudancaMensal({ nome: "o fator de capacidade das eólicas", unidade: "%", percentual: true, casas: 1, meses: c.mensal.meses, valores: c.mensal.fator_capacidade_pct.eolica ?? [], mes: ultimoMes }),
    textoMudancaMensal({ nome: "o fator de capacidade da solar centralizada", unidade: "%", percentual: true, casas: 1, meses: c.mensal.meses, valores: c.mensal.fator_capacidade_pct.solar_centralizada ?? [], mes: ultimoMes }),
    textoMudancaMensal({ nome: "a potência eólica em operação comercial, média do mês,", unidade: "MW", casas: 0, meses: c.mensal.meses, valores: c.mensal.potencia_operacional_mw.eolica ?? [], mes: ultimoMes }),
  ].filter((x) => x);
  const oQueMudou = (
    <>
      {mudancas.join(" ")} {textoSemComparacaoMensal(ultimoMes, g.gerado_em, "o fator de capacidade mensal")}
    </>
  );
  const comoInterpretar = (
    <>
      Fator de capacidade = geração do mês ÷ (potência em operação comercial média do mês × horas com dado), somado nos 12 meses como razão de energias, só nas usinas pareadas com a Capacidade
      Instalada do ONS. A cobertura diz quanto da geração da categoria entrou no pareamento. O retrato é a potência de {dataBR(c.retrato.data)}; a série mensal usa a potência de cada mês.
    </>
  );
  const naoConcluir = (
    <>
      Que a capacidade da ANEEL e a do ONS medem o mesmo universo: a ANEEL inclui usinas fora do despacho do ONS, e as duas nunca são somadas. Que a micro e minigeração distribuída cadastrada
      tenha fator de capacidade calculável aqui: a geração dela é estimada pelo ONS e a razão entre as duas não é publicada. Por que uma usina tem fator de capacidade baixo ou alto: o painel não
      separa causas como entrada em operação no período, manutenção ou restrição pelo ONS.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="geracao" />
      <MarcaVisita secao="energia:geracao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <GeracaoNavegacao atual="p024" />
        <CabecalhoModulo
          siglas={["MWmed", "SIGA", "CEG", "ANEEL", "ONS"]}
          rotulo="Geração"
          titulo={perguntaPainel("p024")}
          lead="A potência das usinas despachadas pelo ONS, por fonte, e quanto cada fonte produziu em relação ao máximo que essa potência permitiria (o fator de capacidade)."
          recorte={`Retrato de ${dataBR(c.retrato.data)} · fator de capacidade de ${periodo12} · MW e %`}
          fonte={FONTE}
          referencia={
            <>
              {FONTE}: retrato de {dataBR(c.retrato.data)} e meses até {ultimoMes ? mesAno(ultimoMes) : "mês não publicado"}; {FONTE_ANEEL} e cadastro de micro e minigeração distribuída da ANEEL;
              processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <GeracaoDatas
              itens={[
                { rotulo: "Potência instalada (ONS)", texto: `retrato de ${dataBR(c.retrato.data)}`, natureza: "OBSERVADO" },
                { rotulo: "Fator de capacidade", texto: `até ${ultimoMes ? mesAno(ultimoMes) : "mês não publicado"} (último mês completo)`, natureza: "CALCULADO" },
                ...(siga?.data_referencia ? [{ rotulo: "Capacidade da ANEEL (SIGA)", texto: `retrato de ${dataBR(siga.data_referencia)}`, natureza: "OBSERVADO" as const }] : []),
                ...(mmgd?.data_cadastro ? [{ rotulo: "MMGD cadastrada na ANEEL", texto: `cadastro de ${dataBR(mmgd.data_cadastro)}`, natureza: "OBSERVADO" as const }] : []),
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={3} rotulo="Potência instalada e fator de capacidade" nota="Universo: usinas despachadas pelo ONS em operação comercial; a micro e minigeração distribuída fica fora.">
              <Numero
                variante="faixa"
                rotulo="Potência das usinas despachadas pelo ONS"
                natureza="OBSERVADO"
                evidencia={ev.capacidade_retrato_total}
                casas={0}
                periodo={`Retrato de ${dataBR(c.retrato.data)}`}
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p024")}#p024`}
              />
              <Numero
                variante="faixa"
                rotulo="Fator de capacidade das eólicas"
                natureza="CALCULADO"
                evidencia={ev.capacidade_12m_fc_eolica}
                formato="pct"
                casas={1}
                unidade="do máximo que a potência permitiria"
                cor={COR_CATEGORIA.eolica}
                endereco={`${rotaPainel("p024")}#p024`}
              />
              <Numero
                variante="faixa"
                rotulo="Fator de capacidade da solar centralizada"
                natureza="CALCULADO"
                evidencia={ev.capacidade_12m_fc_solar_centralizada}
                formato="pct"
                casas={1}
                unidade="do máximo que a potência permitiria"
                cor={COR_CATEGORIA.solar_centralizada}
                endereco={`${rotaPainel("p024")}#p024`}
              />
            </FaixaMetricas>
          }
        >
          Potência instalada diz quanto as usinas podem entregar; o fator de capacidade diz quanto entregaram, dividindo a geração pela
          potência em operação comercial ao longo de cada mês, nunca pela capacidade final aplicada ao histórico. A capacidade fiscalizada pela ANEEL e a micro e minigeração
          distribuída aparecem ao lado, nas mesmas datas, sem serem somadas à potência do ONS.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="capacidade">
            <PainelEvidencia
              id="p024"
              pergunta="Potência instalada e fator de capacidade, fonte por fonte"
              subtitulo="Potência em operação comercial e fator de capacidade por fonte · MW e %"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A potência instalada sozinha não diz quanto uma fonte contribui: eólica e solar têm fator de capacidade menor que hidráulica e nuclear, e as térmicas variam com
                  o despacho. Comparar instalado e produzido evita ler crescimento de capacidade como crescimento de geração na mesma proporção.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.capacidade!}
            >
              <div className="space-y-6">
                {atual.defasada && <GeracaoAviso tipo="alerta">{atual.texto}</GeracaoAviso>}
                <div className="grid gap-x-10 gap-y-6 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
                  <RespostaCurta id="p024" veredito={vereditoCapacidade(c) || respostaCapacidade(c)}>
                    {respostaCapacidade(c)}
                  </RespostaCurta>

                  <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
                    <GraficoBarras
                      titulo={`Potência em operação por fonte, ${dataBR(c.retrato.data)}`}
                      dados={retrato.map((x) => ({ id: x.categoria, rotulo: CURTO_CATEGORIA[x.categoria], mw: x.mw }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "mw", rotulo: "Potência em operação", cor: "var(--cor-energia)" }]}
                      unidade="MW"
                      casas={0}
                      orientacao="horizontal"
                      alturaCategoria={44}
                      rotulosValor
                    />
                    <GraficoBarras
                      titulo={`Fator de capacidade por fonte, ${periodo12}`}
                      dados={fcNaOrdem.map((l) => ({ id: l.id, rotulo: l.categoria, painel: l.fc_pct }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "painel", rotulo: "Fator de capacidade (potência em operação de cada mês)", cor: "var(--cor-energia)" }]}
                      unidade="%"
                      casas={1}
                      orientacao="horizontal"
                      alturaCategoria={44}
                      rotulosValor
                    />
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-carvao-muted">
                  As duas figuras seguem a mesma ordem de fontes, da maior para a menor potência instalada, para a leitura lado a lado.
                  {linhas.some((l) => l.fc_ons_pct !== null) && (
                    <>
                      {" "}
                      O ONS publica fator de capacidade só para eólica e solar:{" "}
                      {linhas
                        .filter((l) => l.fc_ons_pct !== null && l.fc_pct !== null)
                        .map((l) => `${l.categoria.toLowerCase()} ${num(l.fc_ons_pct, 1)}% contra ${num(l.fc_pct, 1)}% do painel`)
                        .join("; ")}{" "}
                      nos mesmos 12 meses. A conferência mês a mês está no modo Analisar.
                    </>
                  )}
                </p>

                {parteDaPotencia.length > 0 && (
                  <p className="text-xs leading-relaxed text-carvao-muted" data-nota="cobertura-potencia">
                    Fator de capacidade com parte da potência: {parteDaPotencia.map((x) => `${x.categoria.toLowerCase()} ${num(x.fc, 1)}% usa ${num(x.denominador, 1)} MW de potência com dado de geração, de ${num(x.potencia, 1)} MW em operação em média (${num(x.pct, 0)}%)`).join("; ")}. A Geração por Usina
                    publicou menos usinas dessas categorias, como mostram as ressalvas de universo da{" "}
                    <Link href={`${rotaPainel("p021")}#composicao`} className="text-energia-dark underline underline-offset-4">
                      matriz efetiva
                    </Link>
                    .
                  </p>
                )}
                {diferencas.length > 0 && (
                  <p className="text-xs leading-relaxed text-carvao-muted" data-nota="aneel-ons">
                    A capacidade fiscalizada da ANEEL (SIGA) é outro universo: inclui usinas fora do despacho do ONS e classifica as fontes de outro modo. Onde a diferença passa de 25%:{" "}
                    {diferencas.map((x) => `${x.categoria.toLowerCase()}, ${num(x.aneel, 1)} MW na ANEEL contra ${num(x.ons, 1)} MW no ONS`).join("; ")}. As duas colunas ficam lado a lado na tabela e nunca se somam.
                  </p>
                )}

                <GeracaoRecorte
                  periodo={`retrato de ${dataBR(c.retrato.data)}; fator de capacidade de ${periodo12} (12 meses completos); série mensal de ${mesAno(c.mensal.meses[0])} a ${ultimoMes ? mesAno(ultimoMes) : "mês não publicado"}`}
                  universo={
                    <>
                      unidades geradoras das usinas despachadas pelo ONS <span data-nivel="analisar">(Tipo I, II-A, II-B e II-C) </span>em operação comercial: {num(c.retrato.por_categoria.reduce((s, x) => s + x.usinas, 0), 0)} usinas e{" "}
                      {num(c.retrato.por_categoria.reduce((s, x) => s + x.unidades, 0), 0)} unidades no retrato
                    </>
                  }
                  unidade="MW (potência), % (fator de capacidade e parcela), MWmed (geração estimada da MMGD)"
                />

                <TabelaInterativa
                  titulo="Tabela equivalente: potência, fator de capacidade e capacidade da ANEEL por categoria"
                  colunas={colunasCapacidade(c)}
                  linhas={paraTabela(linhas)}
                  chaveLinha="id"
                  colunaRotulo="categoria"
                  fonte={FONTE}
                  versao={versao}
                  nomeArquivo="geracao-capacidade-categorias"
                  chaveUrl="cap"
                  nota={`A coluna da ANEEL (SIGA) é outro universo, ao lado para contexto: não é somada nem comparada usina a usina. ${(siga?.nota_temporal ?? "").replace(/\s*\(contexto\.siga_historico\)/, "")}`}
                />

                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                {u && (
                  <SecaoDoPainel id="distribuicao" titulo={`Quanto o fator de capacidade varia entre as usinas, ${periodo12}?`}>
                    <GeracaoCapacidadeDistribuicao ultimos12m={u} fonte={FONTE} versao={versao} usinasNoRetrato={usinasNoRetrato} />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="capacidade-mensal" titulo="Como o fator de capacidade e a potência em operação evoluíram, mês a mês?">
                  <GraficoLinhas
                    chaveUrl="fcm"
                    titulo="Fator de capacidade mensal por fonte"
                    dados={linhasFcMensal(c, CATEGORIAS_CAPACIDADE)}
                    chaveX="m"
                    formatoX="mes"
                    series={CATEGORIAS_CAPACIDADE.map((k) => ({ id: k, rotulo: CURTO_CATEGORIA[k], cor: COR_CATEGORIA[k] }))}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    legendaInterativa
                    ocultasIniciais={ocultas}
                    zoom
                    altura={300}
                  />
                  <GeracaoAviso>
                    Fator de capacidade acima de 100% numa usina num mês aparece em {num(par.fc_acima_de_100.n, 0)} usina-meses da série ({num(par.fc_acima_de_100.ultimos_12m, 0)} nos 12 meses): geração em teste antes da operação comercial e potência
                    nominal da ANEEL abaixo da geração bruta, como na nuclear. Esses valores ficam como publicados e entram na soma de cada fonte; o detalhe está em Auditar.
                  </GeracaoAviso>
                  <GraficoLinhas
                    chaveUrl="pot"
                    titulo={`Potência em operação comercial, média de cada mês, a partir do retrato de ${dataBR(c.retrato.data)}`}
                    dados={linhasPotenciaMensal(c, CATEGORIAS_CAPACIDADE)}
                    chaveX="m"
                    formatoX="mes"
                    series={CATEGORIAS_CAPACIDADE.map((k) => ({ id: k, rotulo: CURTO_CATEGORIA[k], cor: COR_CATEGORIA[k] }))}
                    unidade="MW"
                    casas={0}
                    zeroNoEixo
                    legendaInterativa
                    ocultasIniciais={ocultas}
                    altura={260}
                  />
                  <GeracaoAviso>
                    A potência de cada mês vem do retrato da Capacidade Instalada de {dataBR(c.retrato.data)}, pelas datas de entrada e saída de cada unidade: usinas que já deixaram o despacho
                    centralizado não aparecem, e repotenciações antigas não são reconstituídas.
                  </GeracaoAviso>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="analisar" id="contexto-capacidade" titulo="Conferência com o ONS, a capacidade da ANEEL e a micro e minigeração distribuída">
                  <GraficoLinhas
                    titulo="Fator de capacidade das eólicas: o do painel e o publicado pelo ONS, mês a mês"
                    dados={linhasFcConferencia(c, "eolica")}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "painel", rotulo: "Painel", cor: COR_CATEGORIA.eolica, espessura: 2.5 },
                      { id: "ons", rotulo: "Publicado pelo ONS", cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={220}
                  />
                  <GraficoLinhas
                    titulo="Fator de capacidade da solar centralizada: o do painel e o publicado pelo ONS, mês a mês"
                    dados={linhasFcConferencia(c, "solar_centralizada")}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "painel", rotulo: "Painel", cor: COR_CATEGORIA.solar_centralizada, espessura: 2.5 },
                      { id: "ons", rotulo: "Publicado pelo ONS", cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={220}
                  />
                  {sigaHist && (
                    <>
                      <p className="text-sm leading-relaxed text-carvao-muted">{emPortugues(sigaHist.regra)}</p>
                      <GeracaoCapacidadeAneel historico={sigaHist} fonte={FONTE_ANEEL} />
                    </>
                  )}
                  {mmgd?.mensal && (
                    <>
                      <p className="text-sm leading-relaxed text-carvao-muted">
                        Micro e minigeração distribuída: {num(mmgd.potencia_mw, 0)} MW cadastrados na ANEEL em {mmgd.data_cadastro ? dataBR(mmgd.data_cadastro) : "data não informada"}. {emPortugues(mmgd.mensal.regra)}
                      </p>
                      <GraficoLinhas
                        titulo="Potência de micro e minigeração distribuída cadastrada na ANEEL, fim de cada mês"
                        dados={mmgd.mensal.meses.map((m, i) => ({ m, potencia: mmgd.mensal!.potencia_cadastrada_mw[i] }))}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "potencia", rotulo: "Potência cadastrada", cor: COR_CATEGORIA.solar_mmgd, espessura: 2.5 }]}
                        unidade="MW"
                        casas={0}
                        zeroNoEixo
                        altura={220}
                      />
                      <GraficoLinhas
                        titulo="Geração de micro e minigeração distribuída estimada pelo ONS, média de cada mês"
                        dados={mmgd.mensal.meses.map((m, i) => ({ m, geracao: mmgd.mensal!.mes_completo_na_geracao[i] ? mmgd.mensal!.geracao_estimada_ons_mwmed[i] : null }))}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "geracao", rotulo: "Geração estimada", cor: "var(--serie-solar)", espessura: 2.5 }]}
                        unidade="MWmed"
                        casas={0}
                        zeroNoEixo
                        altura={220}
                      />
                      <TabelaInterativa
                        titulo="Tabela equivalente: micro e minigeração distribuída cadastrada e estimada, mês a mês"
                        colunas={COLUNAS_MMGD_CAPACIDADE.map((col) => (col.id === "mes" ? { ...col, id: "m", tipo: "data" as const } : col))}
                        linhas={paraTabela(linhasMmgdCapacidade(mmgd.mensal))}
                        chaveLinha="id"
                        colunaRotulo="m"
                        fonte="ANEEL, cadastro de micro e minigeração distribuída; ONS, Geração por Usina (Solar MMGD)"
                        versao={versao}
                        nomeArquivo="geracao-capacidade-mmgd"
                        chaveUrl="mm"
                        ordemInicial={{ coluna: "m", direcao: "desc" }}
                        nota="As duas grandezas ficam lado a lado e nunca são somadas nem divididas. Mês incompleto na geração fica sem valor no gráfico. Cadastro provisório: os seis meses mais recentes do arquivo da ANEEL, que crescem nas capturas seguintes por registro tardio (revisões medidas no módulo Transição)."
                      />
                    </>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="pareamento" titulo="Pareamento de usinas e controles">
                  <p className="text-sm leading-relaxed text-carvao-muted">{emPortugues(par.regra)}</p>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    Usina-meses por forma de pareamento:{" "}
                    {Object.entries(par.usina_meses_por_casamento)
                      .map(([k, n]) => `${ROTULO_CASAMENTO[k] ?? k}, ${num(n, 0)}`)
                      .join("; ")}
                    . Unidades que apareceriam em mais de um grupo e foram contadas uma vez: {num(par.unidades_repetidas_evitadas, 0)}. No retrato,{" "}
                    {num(c.retrato.unidades_desativadas_no_retrato, 0)} unidades desativadas ficam fora da potência e {num(c.retrato.nao_mapeadas_mw, 1)} MW sem categoria.
                  </p>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    Fator de capacidade mensal acima de 100% numa usina: {num(par.fc_acima_de_100.n, 0)} usina-meses na série ({num(par.fc_acima_de_100.ultimos_12m, 0)} nos 12 meses), por
                    categoria:{" "}
                    {Object.entries(par.fc_acima_de_100.por_categoria)
                      .map(([k, n]) => `${CURTO_CATEGORIA[k as keyof typeof CURTO_CATEGORIA] ?? k} ${num(n ?? 0, 0)}`)
                      .join("; ")}
                    . Mantidos como publicados, contados como ressalva. O fator passa de 100% por dois motivos: a geração em teste antes da operação comercial, que infla o mês de entrada, e a potência nominal do ato da ANEEL abaixo da geração bruta, que mantém as usinas nucleares perto de 101% em muitos meses de operação normal (76 dos 228 casos).
                  </p>
                  <TabelaInterativa
                    chaveUrl="fxm"
                    titulo="Maiores fatores de capacidade mensais acima de 100%"
                    colunas={COLUNAS_FC_ACIMA_100.map((col) => (col.id === "mes" ? { ...col, id: "m", tipo: "data" as const } : col))}
                    linhas={paraTabela(linhasFcAcima100(par).map((l, i) => ({ ...l, m: par.fc_acima_de_100.exemplos[i].mes })))}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={FONTE}
                    versao={versao}
                    nomeArquivo="geracao-capacidade-acima-100"
                    ordemInicial={{ coluna: "fc_pct", direcao: "desc" }}
                  />
                  {siga && siga.fontes_em_outros.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      No SIGA, a categoria outras térmicas reúne: {siga.fontes_em_outros.map((x) => `${x.fonte ?? x.origem ?? "sem fonte"} (${num(x.mw, 1)} MW)`).join("; ")}.
                    </p>
                  )}
                  {sigaHist && Object.keys(sigaHist.tipos_fora_dos_grupos).length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      Tipos da série da ANEEL fora dos grupos comparados (aparecem em datas da série):{" "}
                      {Object.entries(sigaHist.tipos_fora_dos_grupos)
                        .map(([k, n]) => `${k} em ${num(n, 0)} datas`)
                        .join("; ")}
                      .
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="regras-capacidade" titulo="Regras e limitações">
                  <GeracaoRegras regras={[{ rotulo: ROTULO_REGRA.capacidade, texto: g.regras.capacidade }]} />
                  <GeracaoFrases itens={g.proveniencia.capacidade?.limitacoes ?? []} />
                </SecaoDoPainel>

                <GeracaoSeguir ancora="p024" proximo={{ href: `${rotaPainel("p021")}#p021`, pergunta: perguntaPainel("p021") }} downloads={downloadsDoPainel(g.downloads, "p024")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
