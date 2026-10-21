import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { InclusaoDatas, InclusaoIndisponivel, InclusaoNavegacao, InclusaoRecorte, InclusaoSeguir } from "@/components/energia/InclusaoPagina";
import { InclusaoHistoricoPnad, InclusaoIsolados, InclusaoLpt, InclusaoMapaPnad, InclusaoRegioesPnad } from "@/components/energia/InclusaoAcesso";
import { InclusaoPorIndicadorPnad } from "@/components/energia/InclusaoPorEstado";
import { AcessoCartaoIndicador, AcessoResposta } from "@/components/energia/InclusaoTextos";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { comNomes, dadoNo, dadoTexto } from "@/lib/energia/i18n/conta-inclusao";
import { Nome } from "@/components/i18n/Nome";
import type { ReactNode } from "react";
import {
  colunasLpt,
  datasMedidas,
  fontesInclusao,
  inteiro,
  linhasLptAnual,
  mes,
  mudancaAcesso,
  rotaPainel,
  textoPrecisaoPnad,
} from "@/lib/energia/inclusao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/inclusao-energetica/acesso", {
    title: tx("Acesso à energia, sistemas isolados e Luz para Todos", "Access to energy, isolated systems and Luz para Todos"),
    description: tx(
      "Domicílios sem energia elétrica e com fornecimento em tempo integral (PNAD Contínua), localidades e população dos sistemas isolados (PASI, EPE) e domicílios atendidos pelo Luz para Todos (MME), por UF e ano.",
      "Households without electricity and with full-time supply (Continuous PNAD), localities and population of isolated systems (PASI, EPE) and households served by Luz para Todos (the federal rural electrification program, MME), by state and year.",
    ),
    alternates: { canonical: "/setor-eletrico/inclusao-energetica/acesso" },
  }, anterior);
}

function colunasCiclos(): ColunaTabela[] {
  return [
    { id: "ciclo", rotulo: tx("Ciclo do PASI", "PASI cycle"), tipo: "texto" },
    { id: "localidades", rotulo: tx("Localidades", "Localities"), tipo: "numero", casas: 0 },
    { id: "populacao", rotulo: tx("População informada", "Reported population"), tipo: "numero", unidade: tx("pessoas", "people"), casas: 0 },
    { id: "sem_pop", rotulo: tx("Sem população informada", "Without reported population"), tipo: "numero", casas: 0 },
    { id: "previsao", rotulo: tx("Com previsão de interligação", "With planned interconnection"), tipo: "numero", casas: 0 },
    { id: "sairam", rotulo: tx("Saíram da lista", "Left the list"), tipo: "numero", casas: 0 },
  ];
}

function colunasMunLpt(): ColunaTabela[] {
  return [
    { id: "municipio", rotulo: tx("Município", "Municipality"), tipo: "texto", idiomaTexto: "nome" },
    { id: "uf", rotulo: tx("UF", "State"), tipo: "texto", categorica: true },
    { id: "cod", rotulo: tx("Código IBGE (6 dígitos)", "IBGE code (6 digits)"), tipo: "texto" },
    { id: "domicilios", rotulo: tx("Domicílios atendidos desde jan/2023", "Households served since Jan 2023"), tipo: "numero", casas: 0 },
  ];
}

/** Nome da fonte de recurso do Luz para Todos e o tipo de valor (contratado ou pago), no idioma. */
function rotuloFonteRecurso(fonte: string, tipo: string): string {
  const nomes: Record<string, string> = {
    cde: "CDE",
    rgr: "RGR",
    caixa_outras: tx("Caixa ou outras", "Caixa or others"),
    agente_executor: tx("Agente executor", "Executing agent"),
  };
  const tipoTela = tipo === "pago" ? tx("pago", "paid") : tipo === "contratado" ? tx("contratado", "contracted") : tipo;
  return `${nomes[fonte] ?? fonte}, ${tipoTela}`;
}

export default function AcessoPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const idioma = idiomaEnergia();
  const fontes = fontesInclusao();
  const semDado = tx("sem dado", "no data");
  const a = g.acesso;
  const custeio = g.tarifa_social.custeio_cde;
  const si = a.sistemas_isolados;
  const lpt = a.universalizacao.luz_para_todos;
  const primeiroAno = a.pnad_serie[0]?.ano ?? "";
  const recursosCols: ColunaTabela[] = lpt
    ? [
        { id: "nome", rotulo: tx("UF", "State"), tipo: "texto", idiomaTexto: "nome" },
        { id: "contratos", rotulo: tx("Contratos", "Contracts"), tipo: "numero", casas: 0 },
        ...Array.from(new Set(lpt.recursos_por_uf.flatMap((r) => Object.keys(r).filter((x) => x.endsWith("_reais")))))
          .sort()
          .map((id): ColunaTabela => {
            const m = /^(.*)_(contratado|pago)_reais$/.exec(id);
            const rot = m ? rotuloFonteRecurso(m[1], m[2]) : id;
            return { id, rotulo: rot, tipo: "numero", unidade: "R$", casas: 2 };
          }),
      ]
    : [];
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url)).map((d) => ({ ...d, rotulo: dadoTexto(d.rotulo, idioma) }));
  const acessoPnad = { ano_referencia: a.ano_referencia, pnad_serie: a.pnad_serie, pnad_situacao: a.pnad_situacao };
  // as figuras de série leem só Brasil e grandes regiões (o histórico por UF vem do CSV publicado): enviar as UF delas só pesaria no HTML
  const serieRegioes = a.pnad_serie.filter((l) => l.territorio === "BR" || l.territorio.startsWith("RG-"));
  const serieBrasil = a.pnad_serie.filter((l) => l.territorio === "BR");
  const oQueMudou = mudancaAcesso(a);
  const comoInterpretar = tx(
    <>
      Três dimensões, três fontes: a PNAD Contínua estima domicílios sem energia de nenhuma fonte e o fornecimento em tempo integral entre os
      ligados à rede geral; o PASI, da EPE, lista as localidades atendidas por sistemas isolados; o Luz para Todos conta domicílios
      ligados por ano do atendimento. Elas não se somam. O percentual em tempo integral é sobre os ligados à rede, não sobre todos os domicílios.
    </>,
    <>
      Three dimensions, three sources: IBGE&rsquo;s Continuous PNAD estimates households without energy from any source and full-time supply among those connected to the general grid; EPE&rsquo;s
      PASI lists the localities served by isolated systems; Luz para Todos counts households connected by year of service. They do not add up. The full-time percentage is over those
      connected to the grid, not over all households.
    </>,
  );
  const naoConcluir = tx(
    <>
      A carga do SIN não mede acesso: sistemas isolados e domicílios sem ligação ficam fora dela. Ligação feita não garante serviço confiável depois. {textoPrecisaoPnad(acessoPnad)} Localidade
      isolada não é localidade sem energia.
    </>,
    <>
      The SIN load does not measure access: isolated systems and households without a connection are outside it. A connection made does not guarantee reliable service afterwards.{" "}
      {textoPrecisaoPnad(acessoPnad)} An isolated locality is not a locality without energy.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <MarcaVisita secao="energia:inclusao-acesso" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <InclusaoNavegacao atual="p062" />
        <CabecalhoModulo
          siglas={["IBGE", "EPE", "MME", "UC", "UF", "CDE", "CCC", "ANEEL"]}
          rotulo={tx("Inclusão energética", "Energy inclusion")}
          titulo={tx("Acesso à energia e sistemas isolados", "Access to energy and isolated systems")}
          lead={tx(
            "Quem ainda não tem energia, com que regularidade ela chega a quem tem ligação à rede e quem vive fora do Sistema Interligado Nacional (SIN). Cada fonte conta uma unidade diferente: domicílios, pessoas ou ligações.",
            "Who still has no energy, how regularly it reaches those connected to the grid and who lives outside the National Interconnected System (SIN). Each source counts a different unit: households, people or connections.",
          )}
          recorte={tx(
            `Domicílios ${primeiroAno} a ${a.ano_referencia} · pessoas, ciclo ${si?.ciclo ?? semDado} · ligações até ${mes(lpt?.ultimo_mes)}`,
            `Households ${primeiroAno} to ${a.ano_referencia} · people, cycle ${si?.ciclo ?? semDado} · connections up to ${mes(lpt?.ultimo_mes)}`,
          )}
          fonte={comNomes(
            tx(
              "IBGE, Pesquisa Nacional por Amostra de Domicílios (PNAD) Contínua; EPE, Portal de Acompanhamento e Informações dos Sistemas Isolados (PASI); MME, Luz para Todos",
              "IBGE, Continuous National Household Sample Survey (Continuous PNAD); EPE, Portal de Acompanhamento e Informações dos Sistemas Isolados (PASI, isolated systems portal); MME, Luz para Todos (rural electrification program)",
            ),
            idioma,
          )}
          referencia={tx(
            <>
              IBGE, PNAD Contínua anual até {a.ano_referencia}; PASI, ciclo {si?.ciclo ?? "sem dado"} (EPE); Luz para Todos até{" "}
              {mes(lpt?.ultimo_mes)} (MME); custeio da CDE até {custeio?.linhas.at(-1)?.ano ?? "sem dado"}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              IBGE, annual Continuous PNAD up to {a.ano_referencia}; PASI, cycle {si?.ciclo ?? semDado} (EPE); Luz para Todos up to {mes(lpt?.ultimo_mes)} (MME); CDE funding up to{" "}
              {custeio?.linhas.at(-1)?.ano ?? semDado}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={<InclusaoDatas itens={datasMedidas(g).filter((d) => d.id === "pnad" || d.id === "pasi" || d.id === "lpt")} />}
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={tx("Indicadores de acesso", "Access indicators")}
              nota={tx(
                "Domicílio, pessoa e ligação do programa são unidades diferentes, de fontes e datas diferentes: os três números não se somam.",
                "Household, person and program connection are different units, from different sources and dates: the three numbers do not add up.",
              )}
            >
              <InclusaoPorIndicadorPnad
                variantes={{ sem: <AcessoCartaoIndicador a={a} ind="sem" />, rede: <AcessoCartaoIndicador a={a} ind="rede" />, integral: <AcessoCartaoIndicador a={a} ind="integral" /> }} // i18n: dado
              />
              <Numero
                variante="faixa"
                rotulo={tx(`Pessoas em localidades isoladas, ciclo ${si?.ciclo ?? ""}`.trim(), `People in isolated localities, cycle ${si?.ciclo ?? ""}`.trim())}
                natureza="OBSERVADO"
                evidencia={si?.evidencia_populacao ?? null}
                casas={0}
                unidade={tx("pessoas", "people")}
                cor="var(--serie-termica)"
                motivoAusencia={tx("PASI não processado nesta publicação.", "PASI not processed in this publication.")}
                nota={tx(
                  "Pessoa: a população das localidades isoladas, informada pelas distribuidoras ao PASI. Isolamento não é falta de acesso: é acesso fora do SIN.",
                  "Person: the population of the isolated localities, reported by the distribution utilities to PASI. Isolation is not a lack of access: it is access outside the SIN.",
                )}
                endereco={`${rotaPainel("p062")}#p062`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Domicílios atendidos pelo Luz para Todos", "Households served by Luz para Todos")}
                natureza="OBSERVADO"
                evidencia={lpt?.evidencia_total ?? null}
                casas={0}
                unidade={tx("domicílios", "households")}
                cor="var(--serie-referencia)"
                motivoAusencia={tx("Arquivo do MME não processado nesta publicação.", "MME file not processed in this publication.")}
                nota={tx(
                  "Domicílios ligados pelo programa, não pessoas nem UC com benefício. A ligação não mede a qualidade do fornecimento depois dela.",
                  "Households connected by the program, not people or consumer units with a benefit. The connection does not measure the quality of supply after it.",
                )}
                endereco={`${rotaPainel("p062")}#p062`}
              />
            </FaixaMetricas>
          }
        />
        <ModoProfundidade>
          <Bloco id="acesso">
            <PainelEvidencia
              id="p062"
              pergunta={dadoTexto(a.pergunta, idioma)}
              subtitulo={tx(
                "Domicílios sem energia e com rede em tempo integral (PNAD), localidades isoladas (PASI) e ligações do Luz para Todos · domicílios e pessoas",
                "Households without energy and with a full-time grid (PNAD), isolated localities (PASI) and Luz para Todos connections · households and people",
              )}
              natureza="ESTIMADO"
              porQueImporta={tx(
                <>
                  Ter ligação e ter serviço confiável são coisas diferentes, e as duas faltam em lugares diferentes. Localidades fora do Sistema Interligado têm energia, em geral de usinas a óleo diesel
                  pagas em parte pela CCC, e o Luz para Todos registra as ligações novas que o programa fez.
                </>,
                <>
                  Having a connection and having reliable service are different things, and both are missing in different places. Localities outside the Interconnected System have energy,
                  generally from diesel plants paid in part by the CCC (Fuel Consumption Account), and Luz para Todos records the new connections the program made.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={a.proveniencia.pnad}
              complementares={[
                ...(a.proveniencia.isolados ? [{ rotulo: tx("Sistemas isolados (PASI)", "Isolated systems (PASI)"), p: a.proveniencia.isolados }] : []),
                ...(a.proveniencia.luz_para_todos ? [{ rotulo: "Luz para Todos", p: a.proveniencia.luz_para_todos }] : []), // i18n: dado (nome do programa)
                ...(custeio ? [{ rotulo: tx("Custeio anual da CDE", "Annual CDE funding"), p: custeio.proveniencia }] : []),
              ]}
            >
              <div className="space-y-6">
                <InclusaoRegioesPnad
                  serie={serieRegioes}
                  resposta={
                    <InclusaoPorIndicadorPnad
                      variantes={{ sem: <AcessoResposta a={a} ind="sem" />, rede: <AcessoResposta a={a} ind="rede" />, integral: <AcessoResposta a={a} ind="integral" /> }} // i18n: dado
                    />
                  }
                  recorte={
                    <InclusaoRecorte
                      periodo={tx(
                        <>
                          PNAD de {a.pnad_serie[0]?.ano} a {a.ano_referencia}; PASI ciclos {si?.ciclos.map((x) => x.ciclo).join(", ") ?? "sem dado"}; Luz para Todos de{" "}
                          {mes(lpt?.evidencia_total.periodo.inicio)} a {mes(lpt?.ultimo_mes)}
                        </>,
                        <>
                          PNAD from {a.pnad_serie[0]?.ano} to {a.ano_referencia}; PASI cycles {si?.ciclos.map((x) => x.ciclo).join(", ") ?? semDado}; Luz para Todos from{" "}
                          {mes(lpt?.evidencia_total.periodo.inicio)} to {mes(lpt?.ultimo_mes)}
                        </>,
                      )}
                      universo={tx(
                        <>Domicílios particulares permanentes do Brasil, regiões e UF; localidades isoladas do planejamento da EPE; atendimentos homologados pelo MME</>,
                        <>Permanent private households of Brazil, regions and states; isolated localities in EPE&rsquo;s planning; services approved by the MME</>,
                      )}
                      unidade={tx("domicílios (mil e %); pessoas; domicílios atendidos", "households (thousands and %); people; households served")}
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel id="pnad-uf" titulo={tx("Como o acesso se distribui entre as UF?", "How is access distributed across the states?")}>
                  <InclusaoMapaPnad acesso={acessoPnad} fonte={fontes.pnad} />
                </SecaoDoPainel>

                <SecaoDoPainel id="pnad-historico" titulo={tx(`Como as UF escolhidas evoluíram desde ${primeiroAno}?`, `How have the chosen states evolved since ${primeiroAno}?`)}>
                  <InclusaoHistoricoPnad serieBr={serieBrasil} csvUrl="/energia/series/inclusao_acesso_pnad.csv" />
                </SecaoDoPainel>

                {si && (
                  <SecaoDoPainel
                    id="isolados"
                    titulo={tx("Quem vive fora do Sistema Interligado?", "Who lives outside the Interconnected System?")}
                    lead={tx(
                      "Localidades atendidas por sistemas isolados no planejamento da EPE (PASI). Isolamento não é falta de acesso: é acesso fora do SIN, em geral por usinas térmicas locais. A população é informada pelas distribuidoras, não é contagem censitária.",
                      "Localities served by isolated systems in EPE's planning (PASI). Isolation is not a lack of access: it is access outside the SIN, generally from local thermal plants. The population is reported by the distribution utilities, it is not a census count.",
                    )}
                  >
                    <InclusaoIsolados si={{ ciclo: si.ciclo, por_uf: si.por_uf, localidades_mais_populosas: si.localidades_mais_populosas, pontos_json: si.pontos_json }} fonte={fontes.pasi} />
                    <TabelaInterativa
                      titulo={tx("Localidades isoladas por ciclo do PASI", "Isolated localities by PASI cycle")}
                      colunas={colunasCiclos()}
                      linhas={si.ciclos.map((x) => ({
                        id: x.ciclo,
                        ciclo: x.ciclo,
                        localidades: x.localidades,
                        populacao: x.populacao,
                        sem_pop: x.localidades_sem_populacao,
                        previsao: x.com_previsao_interligacao,
                        sairam: x.sairam_da_lista ?? null,
                      }))}
                      chaveLinha="id"
                      colunaRotulo="ciclo"
                      fonte={fontes.pasi}
                      versao={si.ciclo}
                      nomeArquivo="inclusao-pasi-ciclos"
                      chaveUrl="ac.cic"
                      nota={tx(
                        "Sair da lista de um ciclo para o seguinte costuma indicar interligação ao SIN, mas o PASI não informa o motivo em cada caso. O primeiro ciclo não tem anterior: saídas sem dado.",
                        "Leaving the list from one cycle to the next usually indicates interconnection to the SIN, but PASI does not give the reason in each case. The first cycle has no previous one: departures have no data.",
                      )}
                    />
                  </SecaoDoPainel>
                )}

                {lpt && (
                  <SecaoDoPainel id="luz-para-todos" titulo={tx("Quantas ligações o Luz para Todos fez, e onde?", "How many connections did Luz para Todos make, and where?")}>
                    <InclusaoLpt lpt={{ serie_anual: lpt.serie_anual, ultimo_mes: lpt.ultimo_mes, programas: lpt.programas, por_uf: lpt.por_uf }} fonte={fontes.lpt} />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="cde-lpt-ccc" titulo={tx("Quanto a CDE destina ao Luz para Todos e à CCC por ano?", "How much does the CDE allocate to Luz para Todos and to the CCC each year?")}>
                  <GraficoBarras
                    titulo={tx(
                      `Valores anuais da CDE para o Luz para Todos e para a CCC, ${a.universalizacao.luz_para_todos_cde[0]?.ano ?? "sem dado"} a ${a.universalizacao.luz_para_todos_cde.at(-1)?.ano ?? "sem dado"} (R$ bilhões correntes; o ano em curso é orçado)`,
                      `Annual CDE amounts for Luz para Todos and for the CCC, ${a.universalizacao.luz_para_todos_cde[0]?.ano ?? semDado} to ${a.universalizacao.luz_para_todos_cde.at(-1)?.ano ?? semDado} (current R$ billion; the current year is budgeted)`,
                    )}
                    dados={a.universalizacao.luz_para_todos_cde.map((l) => {
                      const ccc = a.universalizacao.ccc_cde.find((x) => x.ano === l.ano)?.valor_reais ?? null;
                      return {
                        id: l.ano,
                        rotulo: l.ano === a.universalizacao.ano_corrente_orcado ? tx(`${l.ano} (ano em curso)`, `${l.ano} (current year)`) : l.ano,
                        lpt: l.valor_reais === null ? null : l.valor_reais / 1e9,
                        ccc: ccc === null ? null : ccc / 1e9,
                      };
                    })}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[
                      { id: "lpt", rotulo: "Luz para Todos", cor: "var(--cor-energia)" }, // i18n: dado (nome do programa)
                      { id: "ccc", rotulo: tx("CCC (sistemas isolados)", "CCC (isolated systems)"), cor: "var(--serie-termica)" },
                    ]}
                    unidade={tx("R$ bilhões", "R$ billion")}
                    casas={2}
                    altura={300}
                  />
                </SecaoDoPainel>

                {lpt && (
                  <SecaoDoPainel id="detalhes-atendimento" nivel="analisar" titulo={tx("Detalhes do atendimento: municípios e recursos", "Service details: municipalities and funds")}>
                    <TabelaInterativa
                      titulo={tx(
                        `Municípios com mais domicílios atendidos desde jan/2023 (até ${mes(lpt.ultimo_mes)})`,
                        `Municipalities with the most households served since Jan 2023 (up to ${mes(lpt.ultimo_mes)})`,
                      )}
                      colunas={colunasMunLpt()}
                      linhas={lpt.municipios_mais_atendidos_desde_2023.map((m, i) => ({ id: `${m.uf}|${m.cod ?? i}`, municipio: m.municipio, uf: m.uf, cod: m.cod, domicilios: m.domicilios }))}
                      chaveLinha="id"
                      colunaRotulo="municipio"
                      fonte={fontes.lpt}
                      versao={lpt.ultimo_mes}
                      nomeArquivo="inclusao-luz-para-todos-municipios-desde-2023"
                      chaveUrl="ac.mun"
                      ordemInicial={{ coluna: "domicilios", direcao: "desc" }}
                    />
                    <TabelaInterativa
                      titulo={tx("Luz para Todos por ano do atendimento e programa", "Luz para Todos by year of service and program")}
                      colunas={colunasLpt(lpt)}
                      linhas={linhasLptAnual(lpt)}
                      chaveLinha="id"
                      colunaRotulo="ano" // i18n: dado
                      fonte={fontes.lpt}
                      versao={lpt.ultimo_mes}
                      nomeArquivo="inclusao-luz-para-todos-anual"
                      chaveUrl="ac.ano" // i18n: dado
                      nota={tx(
                        "Sem dado: nenhuma linha do programa no ano. Zero: linhas com quantidade zero no arquivo do MME.",
                        "No data: no row of the program in the year. Zero: rows with a quantity of zero in the MME file.",
                      )}
                    />
                    <TabelaInterativa
                      titulo={tx("Recursos do Luz para Todos por UF e fonte (contratado e pago não se somam)", "Luz para Todos funds by state and source (contracted and paid do not add up)")}
                      colunas={recursosCols}
                      linhas={lpt.recursos_por_uf.map((r) => ({ id: r.uf, ...r, nome: r.nome ?? r.uf }))}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte={fontes.lpt}
                      versao={lpt.ultimo_mes}
                      nomeArquivo="inclusao-luz-para-todos-recursos-uf"
                      chaveUrl="ac.rec"
                      nota={tx(
                        "R$ correntes, sem correção pela inflação. Os recursos por contrato e o valor anual da CDE para o programa são grandezas diferentes.",
                        "Current R$, without inflation adjustment. The funds per contract and the annual CDE amount for the program are different quantities.",
                      )}
                    />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel
                  id="conferencias-p062"
                  nivel="auditar" // i18n: dado
                  titulo={tx("Conferências, lacunas e fontes tentadas", "Checks, gaps and sources tried")}
                >
                  {si?.conferencia_pdf && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          PASI contra o caderno em PDF ({si.conferencia_pdf.documento}, página {si.conferencia_pdf.pagina}): {si.conferencia_pdf.localidades_pdf} localidades e{" "}
                          {num(si.conferencia_pdf.populacao_milhoes_pdf, 3)} milhão de pessoas no texto; {si.conferencia_pdf.localidades_xlsx} localidades e{" "}
                          {inteiro(si.conferencia_pdf.populacao_xlsx)} pessoas na exportação. Resultado: {si.conferencia_pdf.resultado}. Tolerância: {si.conferencia_pdf.tolerancia}.
                        </>,
                        <>
                          PASI against the PDF report ({dadoNo(si.conferencia_pdf.documento, "conferencia-pasi", idioma)}, page {si.conferencia_pdf.pagina}):{" "}
                          {si.conferencia_pdf.localidades_pdf} localities and {num(si.conferencia_pdf.populacao_milhoes_pdf, 3)} million people in the text;{" "}
                          {si.conferencia_pdf.localidades_xlsx} localities and {inteiro(si.conferencia_pdf.populacao_xlsx)} people in the export. Result:{" "}
                          {dadoNo(si.conferencia_pdf.resultado, "conferencia-pasi", idioma)}. Tolerance: {dadoNo(si.conferencia_pdf.tolerancia, "conferencia-pasi", idioma)}.
                        </>,
                      )}
                    </p>
                  )}
                  {lpt && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          Luz para Todos: {inteiro(lpt.municipios.total)} nomes de município no arquivo, {inteiro(lpt.municipios.com_codigo_ibge)} com código IBGE pelo nome exato na UF;{" "}
                          {lpt.municipios.sem_codigo_ibge} sem correspondência ({inteiro(lpt.municipios.domicilios_sem_codigo)} domicílios, contados na UF e no total). Maiores sem código:{" "}
                        </>,
                        <>
                          Luz para Todos: {inteiro(lpt.municipios.total)} municipality names in the file, {inteiro(lpt.municipios.com_codigo_ibge)} with an IBGE code by the exact name in the
                          state; {lpt.municipios.sem_codigo_ibge} without a match ({inteiro(lpt.municipios.domicilios_sem_codigo)} households, counted in the state and in the total). Largest
                          without a code:{" "}
                        </>,
                      )}
                      {tx<ReactNode>(
                        lpt.municipios.maiores_sem_codigo
                          .slice(0, 5)
                          .map((m) => `${m.municipio} (${m.uf})`)
                          .join(", "),
                        <Nome>
                          {lpt.municipios.maiores_sem_codigo
                            .slice(0, 5)
                            .map((m) => `${m.municipio} (${m.uf})`)
                            .join(", ")}
                        </Nome>,
                      )}
                      .
                    </p>
                  )}
                  <p className="text-sm text-carvao-muted">{dadoNo(a.universalizacao.limitacao, "limitacao-universalizacao", idioma)}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {a.universalizacao.fontes_tentadas.map((f) => (
                      <li key={f} className="break-words">
                        {dadoNo(f, "fontes-tentadas", idioma)}
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <InclusaoSeguir
                  ancora="p062"
                  proximo={{
                    href: "/setor-eletrico/conta-de-luz",
                    pergunta: tx("Quanto custa a energia ao consumidor e o que compõe a conta?", "How much does energy cost the consumer and what makes up the bill?"),
                  }}
                  downloads={downloads([
                    "/energia/series/inclusao_acesso_pnad.csv",
                    "/energia/series/inclusao_sistemas_isolados.csv",
                    "/energia/series/inclusao_luz_para_todos_mensal.csv",
                    "/energia/series/inclusao_luz_para_todos_municipios.csv",
                    "/energia/series/inclusao_luz_para_todos_recursos.csv",
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
