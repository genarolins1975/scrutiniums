import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { InclusaoDatas, InclusaoIndisponivel, InclusaoNavegacao, InclusaoRecorte, InclusaoSeguir } from "@/components/energia/InclusaoPagina";
import { InclusaoHistoricoUfTsee, InclusaoMapaTsee, InclusaoSerieTsee } from "@/components/energia/InclusaoTarifaSocial";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_DISTRIBUIDORAS,
  COLUNAS_MESES_CDE,
  COLUNAS_SERIE_TSEE,
  dadosMediaCde,
  datasMedidas,
  FONTE_CDE,
  FONTE_SCS,
  inteiro,
  linhasDistribuidoras,
  linhasMesesCde,
  linhasTabelaSerieTsee,
  marcosEventos,
  mes,
  mudancaTarifaSocial,
  numTexto,
  reaisGrandes,
  reaisTexto,
  respostaTarifaSocial,
  rotaPainel,
  textoCusteioTarifaSocial,
  ufsAtingidasPorAusencia,
  vereditoTarifaSocial,
} from "@/lib/energia/inclusao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Tarifa Social: quantas UC recebem, onde e quanto",
  description:
    "Unidades consumidoras com Tarifa Social por distribuidora e mês (ANEEL, SCS), participação nas UC residenciais, DMR e faturas com desconto por UF e mês nos arquivos de Beneficiários da CDE, com a conferência entre as duas bases.",
  alternates: { canonical: "/setor-eletrico/inclusao-energetica/tarifa-social" },
};

const ROTULO_REGRA: Record<string, string> = {
  mes_completo: "Mês completo do SCS",
  residencial_inconsistente: "Total residencial inconsistente",
  incorporacao: "Incorporação de distribuidora",
  maiores_diferencas: "Corte da conferência SCS e CDE",
  desconto_liquido: "Desconto líquido",
  despacho_vigente: "Despacho vigente",
  mes_mapa: "Mês do mapa",
  mes_cde_sem_original: "Mês da CDE sem original guardado",
  municipio_valido: "Município válido",
};

const COLUNAS_INCORPORACOES: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês da ruptura", tipo: "texto" },
  { id: "sucessora", rotulo: "Sucessora", tipo: "texto" },
  { id: "incorporadas", rotulo: "Incorporadas", tipo: "texto" },
  { id: "total", rotulo: "UC residenciais das incorporadas", tipo: "numero", casas: 0 },
  { id: "salto", rotulo: "Salto da sucessora", tipo: "numero", casas: 0 },
];

const COLUNAS_CONFERENCIA: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "grupo", rotulo: "Grupo", tipo: "texto", categorica: true },
  { id: "uc_scs", rotulo: "UC no SCS", tipo: "numero", casas: 0 },
  { id: "faturas_cde", rotulo: "Faturas na CDE", tipo: "numero", casas: 0 },
  { id: "diferenca_pct", rotulo: "Diferença", tipo: "percentual", casas: 2 },
  { id: "dmr", rotulo: "DMR (SCS)", tipo: "numero", unidade: "R$", casas: 2 },
  { id: "desconto", rotulo: "Desconto (CDE)", tipo: "numero", unidade: "R$", casas: 2 },
];

const COLUNAS_ANTIGA: ColunaTabela[] = [
  { id: "m", rotulo: "Trimestre", tipo: "texto" },
  { id: "antiga", rotulo: "UC baixa renda (série antiga)", tipo: "numero", casas: 0 },
  { id: "scs", rotulo: "UC com Tarifa Social (SCS)", tipo: "numero", casas: 0 },
  { id: "dif", rotulo: "Diferença", tipo: "percentual", casas: 2 },
  { id: "repete", rotulo: "Repete o trimestre", tipo: "texto" },
];

export default function TarifaSocialPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const t = g.tarifa_social;
  const k = t.kpis;
  const serie = t.serie_mensal;
  const mesMapa = t.mes_mapa ?? t.mes_referencia;
  const cdeMapa = t.cde_meses.find((m) => m.mes === t.mes_mapa) ?? null;
  const cdeComValor = t.cde_meses.filter((m) => m.original_no_bronze);
  const dadosCde = dadosMediaCde(t.cde_meses);
  const conf = t.conferencia_scs_cde;
  const antiga = t.serie_antiga;
  const custeio = t.custeio_cde;
  const atingidas = ufsAtingidasPorAusencia(t.cde_meses, t.distribuidoras);
  const marcosScs = marcosEventos(t.eventos, serie[0]?.m ?? "", serie.at(-1)?.m ?? "");
  const marcosCde = marcosEventos(t.eventos, cdeComValor[0]?.mes ?? "", cdeComValor.at(-1)?.mes ?? "");
  const ultimoScs = g.referencias.scs_ultimo_mes_no_arquivo;
  const geracaoScs = t.diagnostico_scs?.data_geracao.at(-1) ?? null;
  const ufsComFaturas = t.ufs.length;
  const municipiosComFaturas = t.ufs.reduce((s, u) => s + u.municipios_com_faturas, 0);
  const linhasConferencia = conf
    ? [
        ...conf.maiores_diferencas.map((d) => ({ ...d, grupo: `${inteiro(conf.uc_minima_maiores_diferencas)} UC ou mais` })),
        ...conf.diferencas_distribuidoras_pequenas.map((d) => ({ ...d, grupo: `menos de ${inteiro(conf.uc_minima_maiores_diferencas)} UC` })),
      ].map((d) => ({
        id: d.cnpj,
        sigla: d.sigla ?? `CNPJ ${d.cnpj}`,
        grupo: d.grupo,
        uc_scs: d.uc_scs,
        faturas_cde: d.faturas_cde,
        diferenca_pct: d.diferenca_pct,
        dmr: d.dmr_scs_reais,
        desconto: d.desconto_cde_reais,
      }))
    : [];
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));
  const oQueMudou = mudancaTarifaSocial(t);
  const comoInterpretar = (
    <>
      O SCS conta UC no pedido de reembolso de cada distribuidora (despacho vigente, cinco faixas de consumo somadas, DMR lida uma vez por mês). Depois do fim do SCS, a evolução vem dos arquivos
      mensais da CDE, que contam faturas: as duas séries ficam em gráficos separados e não se emendam. Mês em que falta distribuidora esperada fica em linha tracejada, fora da comparação. A
      participação é razão de somas das mesmas distribuidoras.
    </>
  );
  const naoConcluir = (
    <>
      Não se conclui número de famílias nem de pessoas beneficiadas: UC e fatura são unidades da conta. A DMR é a receita que a distribuidora deixa de cobrar, não o desconto de cada família. A
      queda num mês incompleto não é queda de beneficiários. Diferenças entre UF não têm causa atribuída aqui.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <MarcaVisita secao="energia:inclusao-tarifa-social" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <InclusaoNavegacao atual="p059" />
        <CabecalhoModulo
          siglas={["UC", "SCS", "CDE", "DMR", "ANEEL", "UF"]}
          rotulo="Inclusão energética"
          titulo="Tarifa Social de Energia Elétrica"
          lead="Quantas unidades consumidoras (UC) recebem o desconto da Tarifa Social, onde estão e quanto o desconto vale. UC e faturas vêm de fontes diferentes, com meses diferentes, e não se somam."
          recorte={`SCS ${mes(serie[0]?.m)} a ${mes(serie.at(-1)?.m)} · CDE ${mes(cdeComValor[0]?.mes)} a ${mes(cdeComValor.at(-1)?.mes)} · UC, faturas e R$ correntes`}
          fonte="ANEEL, SCS e Beneficiários da CDE"
          referencia={
            <>
              SCS da ANEEL até {mes(ultimoScs)} (arquivo gerado pela fonte em {dataBR(geracaoScs)}; último mês completo {mes(t.mes_referencia)}); Beneficiários da CDE até{" "}
              {mes(g.referencias.cde_mes_mais_recente)} (último mês completo {mes(mesMapa)}). Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={<InclusaoDatas itens={datasMedidas(g).filter((d) => d.id === "scs" || d.id === "cde")} />}
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo="Indicadores da Tarifa Social"
              nota={
                <>
                  <p>Fonte defasada, declarada. Um mês só entra nas comparações quando todas as distribuidoras enviaram o informe.</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    <li>
                      SCS (UC): arquivo gerado em {dataBR(geracaoScs)}, publicado até {mes(ultimoScs)}; o último mês com todas as distribuidoras é {mes(t.mes_referencia)}, o dos números de UC. UC é o
                      ponto de ligação com conta própria.
                    </li>
                    <li>
                      Beneficiários da CDE (faturas): publicados até {mes(g.referencias.cde_mes_mais_recente)}; o último mês com todas as distribuidoras é {mes(mesMapa)}, o dos números de fatura e
                      do mapa. Fatura é cada conta emitida com desconto no mês, e uma UC pode ter mais de uma fatura no arquivo.
                    </li>
                  </ul>
                </>
              }
            >
              <Numero
                variante="faixa"
                rotulo="UC com Tarifa Social"
                natureza="OBSERVADO"
                evidencia={k.uc_tsee.evidencia}
                casas={0}
                unidade="UC"
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p059")}#p059`}
              />
              <Numero
                variante="faixa"
                rotulo="Das UC residenciais"
                natureza="CALCULADO"
                evidencia={k.participacao_pct.evidencia}
                formato="pct"
                casas={1}
                cor="var(--cor-energia)"
                nota={
                  k.variacao_12m_pct.valor !== null
                    ? `UC com Tarifa Social ${k.variacao_12m_pct.valor >= 0 ? "cresceram" : "caíram"} ${pct(Math.abs(k.variacao_12m_pct.valor), 1)} desde ${mes(k.variacao_12m_pct.mes_base)}${k.variacao_12m_pct.comparavel ? "" : " (mês base incompleto)"}.`
                    : undefined
                }
                endereco={`${rotaPainel("p059")}#p059`}
              />
              <Numero
                variante="faixa"
                rotulo="DMR do mês"
                natureza="OBSERVADO"
                evidencia={k.dmr_mes_reais.evidencia}
                formato="reais"
                casas={0}
                unidade="R$"
                cor="var(--serie-referencia)"
                nota={`${reaisTexto(k.dmr_por_uc_reais.valor)} por UC; ${numTexto(k.kwh_por_uc.valor, 1)} kWh por UC no mês.`}
                endereco={`${rotaPainel("p059")}#p059`}
              />
              <Numero
                variante="faixa"
                rotulo="Faturas com desconto (CDE)"
                natureza="CALCULADO"
                evidencia={k.faturas_cde_mapa?.evidencia ?? null}
                casas={0}
                unidade="faturas"
                cor="var(--serie-comp-2)"
                motivoAusencia="Nenhum arquivo da CDE com todas as distribuidoras."
                nota={cdeMapa ? `${reaisTexto(cdeMapa.desconto_medio_por_fatura_reais)} de desconto médio por fatura.` : undefined}
                endereco={`${rotaPainel("p059")}#p059`}
              />
            </FaixaMetricas>
          }
        >
          Os números são agregados, por distribuidora, UF e mês: nenhum beneficiário individual aparece aqui.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="tarifa-social">
            <PainelEvidencia
              id="p059"
              pergunta={t.pergunta}
              subtitulo="UC com Tarifa Social (SCS) e faturas com desconto (Beneficiários da CDE) · UC, faturas e R$ correntes"
              natureza="OBSERVADO"
              porQueImporta={
                <>
                  A <Termo slug="tarifa-social">Tarifa Social de Energia Elétrica</Termo> dá desconto na conta da subclasse residencial baixa renda, custeado pela Conta de Desenvolvimento Energético (CDE). Saber quantas
                  unidades recebem, onde e com que desconto é o ponto de partida para discutir o alcance do benefício.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={t.proveniencia.scs}
              complementares={[
                { rotulo: "Participação nas UC residenciais", p: t.proveniencia.participacao },
                { rotulo: "Faturas e desconto (CDE)", p: t.proveniencia.cde },
                ...(t.proveniencia.custeio ? [{ rotulo: "Custeio anual da CDE", p: t.proveniencia.custeio }] : []),
                ...(t.proveniencia.antiga ? [{ rotulo: "Série antiga (descontinuada)", p: t.proveniencia.antiga }] : []),
              ]}
            >
              <div className="space-y-6">
                <InclusaoSerieTsee
                  serie={serie}
                  marcos={marcosScs}
                  resposta={
                    <RespostaCurta id="p059" veredito={vereditoTarifaSocial(t)}>
                      {respostaTarifaSocial(t)}
                    </RespostaCurta>
                  }
                  recorte={
                    <InclusaoRecorte
                      periodo={
                        <>
                          SCS de {mes(serie[0]?.m)} a {mes(serie.at(-1)?.m)} (referência {mes(t.mes_referencia)}); CDE de {mes(cdeComValor[0]?.mes)} a {mes(cdeComValor.at(-1)?.mes)} (mapa em {mes(mesMapa)})
                        </>
                      }
                      universo={
                        <>
                          {t.distribuidoras.length} distribuidoras no SCS; {ufsComFaturas} UF e {inteiro(municipiosComFaturas)} municípios com faturas no mês do mapa
                        </>
                      }
                      unidade="UC (SCS); faturas (CDE); R$ correntes"
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel
                  id="cde"
                  titulo="Depois do SCS: o que os arquivos da CDE mostram mês a mês?"
                  lead="Desconto médio por fatura (desconto das faturas ÷ faturas, calculado pelo observatório). Meses em que faltam distribuidoras ficam tracejados; os meses mais recentes, cujos arquivos ainda não trazem todas as distribuidoras, aparecem só na tabela, com a cobertura."
                >
                  <GraficoLinhas
                    titulo={`Desconto médio por fatura com Tarifa Social, ${mes(cdeComValor[0]?.mes)} a ${mes(cdeComValor.at(-1)?.mes)} (Beneficiários da CDE)`}
                    dados={dadosCde}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "completo", rotulo: "Mês completo", sigla: "Completo", cor: "var(--cor-energia)" },
                      ...(dadosCde.some((d) => d.incompleto !== null)
                        ? [{ id: "incompleto", rotulo: "Mês incompleto (fora da comparação)", sigla: "Incompleto", cor: "var(--serie-referencia)", tracejada: true }]
                        : []),
                    ]}
                    unidade="R$ por fatura"
                    casas={2}
                    zeroNoEixo
                    marcos={marcosCde}
                    altura={280}
                  />
                  <TabelaInterativa
                    titulo="Arquivos mensais de Beneficiários da CDE: cobertura, faturas e desconto"
                    colunas={COLUNAS_MESES_CDE}
                    linhas={linhasMesesCde(t.cde_meses)}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte={FONTE_CDE}
                    versao={g.referencias.cde_mes_mais_recente ?? mesMapa}
                    nomeArquivo="inclusao-cde-meses"
                    chaveUrl="ts.cde"
                    tamanhoPagina={25}
                    nota={t.regras.mes_cde_sem_original}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="uf" titulo="Onde: faturas com desconto por UF">
                  <InclusaoMapaTsee ufs={t.ufs} mesMapa={mesMapa} fonte={FONTE_CDE} />
                </SecaoDoPainel>

                <SecaoDoPainel id="historico-uf" titulo="Como as UF escolhidas evoluíram mês a mês?">
                  <InclusaoHistoricoUfTsee ufs={t.ufs} serieUfUrl={t.serie_cde_uf_json} atingidas={atingidas} marcos={marcosCde} />
                </SecaoDoPainel>

                <SecaoDoPainel id="modalidades" titulo={`Quem recebe e quanto consome: modalidade e faixa de consumo em ${mes(t.modalidades_referencia.mes)}`}>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-carvao">Modalidades em {mes(t.modalidades_referencia.mes)}</p>
                      <div className="tabela-scroll">
                        <table className="w-full text-sm">
                          <caption className="sr-only">UC com Tarifa Social por modalidade</caption>
                          <thead>
                            <tr className="border-b border-linha text-left text-mineral">
                              <th scope="col" className="py-2 pr-4 font-normal">
                                Modalidade
                              </th>
                              <th scope="col" className="py-2 text-right font-normal">
                                UC
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(
                              [
                                ["baixa_renda", "Baixa renda (Cadastro Único)"],
                                ["bpc", "Benefício de Prestação Continuada"],
                                ["quilombola", "Quilombola"],
                                ["indigena", "Indígena"],
                                ["multifamiliar", "Multifamiliar"],
                              ] as const
                            ).map(([id, rot]) => (
                              <tr key={id} className="border-b border-linha">
                                <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                                  {rot}
                                </th>
                                <td className="py-2 text-right tabular-nums text-carvao">{t.modalidades_referencia[id] === null ? "sem dado" : inteiro(t.modalidades_referencia[id])}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <GraficoBarras
                      titulo={`UC com Tarifa Social por faixa de consumo: ${mes(t.faixas_consumo.mes_anterior)} e ${mes(t.faixas_consumo.mes)}`}
                      dados={t.faixas_consumo.linhas.map((l) => ({
                        id: l.faixa,
                        rotulo: l.rotulo,
                        atual: l.pct_das_uc_tsee,
                        anterior: t.faixas_consumo.linhas_anterior.find((x) => x.faixa === l.faixa)?.pct_das_uc_tsee ?? null,
                      }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[
                        { id: "anterior", rotulo: mes(t.faixas_consumo.mes_anterior), cor: "var(--serie-referencia)" },
                        { id: "atual", rotulo: mes(t.faixas_consumo.mes), cor: "var(--cor-energia)" },
                      ]}
                      unidade="% das UC com Tarifa Social"
                      casas={1}
                      altura={280}
                    />
                  </div>
                </SecaoDoPainel>

                {custeio && (
                  <SecaoDoPainel id="custeio" titulo="Quanto a CDE destina à Tarifa Social por ano?">
                    <GraficoBarras
                      titulo={`Valor anual da CDE para a Tarifa Social, ${custeio.linhas[0]?.ano ?? ""} a ${custeio.linhas.at(-1)?.ano ?? ""} (R$ bilhões correntes)`}
                      dados={custeio.linhas.map((l) => ({
                        id: l.ano,
                        rotulo: l.ano === custeio.ano_corrente ? `${l.ano} (ano em curso)` : l.ano,
                        valor: l.tarifa_social_reais === null ? null : l.tarifa_social_reais / 1e9,
                      }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "valor", rotulo: "Tarifa Social na CDE", cor: "var(--cor-energia)" }]}
                      unidade="R$ bilhões"
                      casas={2}
                      altura={280}
                    />
                    <p className="max-w-prose2 text-sm text-carvao-muted">{textoCusteioTarifaSocial(custeio)}</p>
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="distribuidoras" nivel="analisar" titulo={`Distribuidoras em ${mes(t.mes_referencia)}: UC, participação, DMR e conferência com a CDE`}>
                  <TabelaInterativa
                    titulo={`Tarifa Social por distribuidora, ${mes(t.mes_referencia)} (SCS)`}
                    colunas={COLUNAS_DISTRIBUIDORAS}
                    linhas={linhasDistribuidoras(t.distribuidoras)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={FONTE_SCS}
                    versao={t.mes_referencia}
                    nomeArquivo="inclusao-tarifa-social-distribuidoras"
                    chaveUrl="ts.dist"
                    ordemInicial={{ coluna: "uc_tsee", direcao: "desc" }}
                    dicaBusca="Sigla, CNPJ ou UF"
                    nota="Participação nula quando o total residencial do mês é inconsistente (regra no modo Auditar). Faturas contra UC: diferença do arquivo da CDE do mesmo mês."
                  />
                  <TabelaInterativa
                    titulo="Série mensal nacional do SCS, todos os meses publicados"
                    colunas={COLUNAS_SERIE_TSEE}
                    linhas={linhasTabelaSerieTsee(serie)}
                    chaveLinha="id"
                    colunaRotulo="m"
                    fonte={FONTE_SCS}
                    versao={t.mes_referencia}
                    nomeArquivo="inclusao-tarifa-social-mensal"
                    chaveUrl="ts.mes"
                    ordemInicial={{ coluna: "m", direcao: "desc" }}
                    dicaBusca="Mês (AAAA-MM)"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="regras-p059" nivel="auditar" titulo="Regras, conferências e a série antiga">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {Object.entries(t.regras).map(([id, txt]) => (
                      <div key={id}>
                        <dt className="font-medium text-carvao">{ROTULO_REGRA[id] ?? id}</dt>
                        <dd className="mt-0.5 text-carvao-muted">{txt}</dd>
                      </div>
                    ))}
                  </dl>
                  {conf && (
                    <>
                      <p className="text-sm text-carvao-muted">
                        Conferência SCS e CDE em {mes(conf.mes)}, mesmas {conf.distribuidoras_comparadas} distribuidoras: {inteiro(conf.uc_scs)} UC e {inteiro(conf.faturas_cde)} faturas (
                        {pct(conf.diferenca_pct, 2)}); {reaisGrandes(conf.dmr_scs_reais)} de DMR e {reaisGrandes(conf.desconto_cde_reais)} de desconto ({pct(conf.diferenca_valor_pct, 2)});{" "}
                        {conf.distribuidoras_ate_2pct} distribuidoras dentro de 2%. Tolerância: {conf.tolerancia}
                        {conf.so_na_cde.length ? ` Só na CDE: ${conf.so_na_cde.join(", ")}.` : ""}
                        {conf.so_no_scs.length ? ` Só no SCS: ${conf.so_no_scs.join(", ")}.` : ""}
                      </p>
                      <TabelaInterativa
                        titulo={`Maiores diferenças entre UC do SCS e faturas da CDE, ${mes(conf.mes)}`}
                        colunas={COLUNAS_CONFERENCIA}
                        linhas={linhasConferencia}
                        chaveLinha="id"
                        colunaRotulo="sigla"
                        fonte={`${FONTE_SCS}; ${FONTE_CDE}`}
                        versao={conf.mes}
                        nomeArquivo="inclusao-conferencia-scs-cde"
                        chaveUrl="ts.conf"
                        ordemInicial={{ coluna: "diferenca_pct", direcao: "desc" }}
                      />
                    </>
                  )}
                  {t.incorporacoes.length > 0 && (
                    <TabelaInterativa
                      titulo="Incorporações detectadas no SCS (não são inconsistência)"
                      colunas={COLUNAS_INCORPORACOES}
                      linhas={t.incorporacoes.map((i) => ({
                        id: `${i.mes_ruptura}|${i.sucessora}`,
                        mes: i.mes_ruptura,
                        sucessora: i.sigla_sucessora ?? i.sucessora,
                        incorporadas: i.siglas_incorporadas.map((s, j) => s ?? i.incorporadas[j]).join(", "),
                        total: i.total_incorporadas,
                        salto: i.salto_sucessora,
                      }))}
                      chaveLinha="id"
                      colunaRotulo="mes"
                      fonte={FONTE_SCS}
                      versao={t.mes_referencia}
                      nomeArquivo="inclusao-incorporacoes-scs"
                      chaveUrl="ts.inc"
                    />
                  )}
                  {t.siglas_de_outra_fonte.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      Siglas tomadas de outra fonte: {t.siglas_de_outra_fonte.map((s) => `CNPJ ${s.cnpj} exibido como ${s.sigla} (${s.origem})`).join("; ")}.
                    </p>
                  )}
                  {t.diagnostico_scs && (
                    <p className="text-sm text-carvao-muted">
                      Arquivo do SCS: {inteiro(t.diagnostico_scs.linhas)} linhas, {inteiro(t.diagnostico_scs.pares)} pares distribuidora e competência;{" "}
                      {inteiro(t.diagnostico_scs.pares_com_mais_de_um_despacho)} pares em mais de um despacho, {t.diagnostico_scs.pares_com_despachos_divergentes} com valores divergentes;{" "}
                      {t.diagnostico_scs.pares_com_faixas_incompletas} com faixas incompletas.
                    </p>
                  )}
                  {antiga && (
                    <>
                      <p className="text-sm text-carvao-muted">
                        Série antiga descontinuada: o portal a intitula &ldquo;{antiga.titulo_no_portal}&rdquo;. Teste do recurso em {carimbo(antiga.teste_do_recurso.testado_em)}: HTTP{" "}
                        {antiga.teste_do_recurso.status_http}, {antiga.teste_do_recurso.conclusao}. Cópia usada: <span className="break-all">{antiga.copia_usada}</span>. Ela entra só como
                        histórico identificado, nunca como fonte atual.
                      </p>
                      <TabelaInterativa
                        titulo="Série antiga da ANEEL contra o SCS nos trimestres comuns"
                        colunas={COLUNAS_ANTIGA}
                        linhas={antiga.comparacao_scs.map((x) => ({
                          id: x.m,
                          m: x.m,
                          antiga: x.uc_baixa_renda_antiga,
                          scs: x.uc_tsee_scs,
                          dif: x.diferenca_pct,
                          repete: x.repete_trimestre ?? "",
                        }))}
                        chaveLinha="id"
                        colunaRotulo="m"
                        fonte="ANEEL, Tarifa Social de Energia Elétrica: Beneficiários (descontinuado)"
                        versao={antiga.comparacao_scs.at(-1)?.m ?? ""}
                        nomeArquivo="inclusao-serie-antiga-contra-scs"
                        chaveUrl="ts.ant"
                        nota="Trimestre que repete a contagem de outro no arquivo original fica marcado e fora da estatística de concordância."
                      />
                    </>
                  )}
                </SecaoDoPainel>

                <InclusaoSeguir
                  ancora="p059"
                  proximo={{ href: rotaPainel("p060"), pergunta: "Quantas faturas há para cada 100 famílias do Cadastro Único (proxy)?" }}
                  downloads={downloads([
                    "/energia/series/inclusao_tsee_mensal.csv",
                    "/energia/series/inclusao_tsee_distribuidoras.csv",
                    "/energia/series/inclusao_cde_mensal_uf.csv",
                    "/energia/series/inclusao_tsee_antiga.csv",
                    "/energia/series/inclusao_cde_custeio.csv",
                  ])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
