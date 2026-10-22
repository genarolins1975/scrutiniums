import { AtalhoLeitura } from "@/components/energia/LeiturasIntegradas";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { Nome } from "@/components/i18n/Nome";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasBusca } from "@/components/energia/EmpresasBusca";
import { MapaCadeia, VitrineListadas } from "@/components/energia/EmpresasEntrada";
import {
  EmpresasCapitulos,
  EmpresasDatas,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasPassosVinculo,
  EmpresasRecorte,
  EmpresasSeguir,
} from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  ancoraPainel,
  dataTexto,
  emMilhoes,
  entidadesBuscaEmpresas,
  inteiro,
  mwTexto,
  nomeOuCnpj,
  padraoFinancas,
  painel,
  passosVinculo,
  pctTexto,
  referenciaPerdasNacional,
  respostaCadastro,
  respostaControle,
  respostaDistribuidoras,
  respostaFinancas,
  rotaEntidade,
  rotaPainel,
  textoFronteiraNoCadastro,
  trimestreTexto,
  vereditoCadastro,
  vereditoControle,
  vereditoDistribuidoras,
  vereditoFinancas,
} from "@/lib/energia/empresas";
import { evidenciasReceita } from "@/lib/energia/empresas-arquivos";
import { cadeiaDoSetor, ucsDistribuidoras, vitrineListadas } from "@/lib/energia/empresas-entrada";
import { carimbo, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { comValorExibido, type Evidencia } from "@/lib/energia/evidencia";
import { tx } from "@/lib/energia/idioma";
import { DOWNLOAD_EMPRESAS_EN, LIMITACAO_EMPRESAS_EN, comNomes, traduzir, universoPerdas } from "@/lib/energia/i18n/empresas-leiloes";
import { SIGLAS, SIGLAS_IDIOMAS } from "@/lib/energia/siglas";
import { lerManifestoLogos } from "@/lib/energia/logos";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";
import type { ListadasGold } from "@/lib/energia/tipos-listadas";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/empresas", {
    title: tx("Empresas do setor elétrico: ativos, distribuidoras, finanças e controle", "Power sector companies: assets, distribution utilities, finances and control"),
    description: tx(
      "Quem opera as usinas e as linhas de transmissão (SIGA e SIGET, pelo CNPJ publicado), o perfil de cada distribuidora (perdas, continuidade e tarifa pelo mesmo CNPJ dos módulos de origem), as demonstrações das companhias abertas na CVM e quem controla quanto da capacidade instalada, com HHI sobre fronteira explícita.",
      "Who operates the plants and transmission lines (SIGA and SIGET, by the published CNPJ), the profile of each distribution utility (losses, continuity of supply and tariff by the same CNPJ as the source modules), the financial statements of publicly held companies at CVM and who controls how much of the installed capacity, with HHI over an explicit boundary.",
    ),
    alternates: { canonical: "/setor-eletrico/empresas" },
  }, anterior);
}

/** As medidas que parecem somáveis e não são: definições que acompanham os números, depois da informação, em Entender. */
function medidas(): [string, string][] {
  return [
    [
      tx("Capacidade proporcional", "Proportional capacity"),
      tx(
        "A potência de cada usina repartida pela participação de cada dono. As parcelas somam a potência da usina, sem dupla contagem.",
        "The capacity of each plant split by each owner's stake. The parts add up to the plant's capacity, without double counting.",
      ),
    ],
    [
      tx("Capacidade sob controle", "Capacity under control"),
      tx(
        "A usina inteira para quem tem mais de 50% dela. Mede comando, não propriedade; não se soma à proporcional.",
        "The whole plant for whoever holds more than 50% of it. It measures command, not ownership; it is not added to the proportional capacity.",
      ),
    ],
    [
      tx("Consolidado e individual", "Consolidated and individual"),
      tx(
        "O consolidado inclui as controladas; o individual, só a companhia. São séries separadas, e nada se soma entre companhias.",
        "The consolidated statements include the subsidiaries; the individual ones, only the company. They are separate series, and nothing is added across companies.",
      ),
    ],
    [
      tx("Potência e energia", "Capacity and energy"),
      tx(
        "MW é capacidade instalada (potência); o que as usinas geram é energia, em MWh, e está na página de Geração.",
        "MW is installed capacity; what the plants generate is energy, in MWh, and it is on the Generation page.",
      ),
    ],
  ];
}

/**
 * Abertura de Empresas, executiva e didática: quatro números do setor (geração, transmissão, distribuição e listadas); a vitrine das
 * companhias listadas do IEE, que é a entrada mais procurada; o mapa da cadeia (o que cada elo faz, como é remunerado e quantos agentes
 * declaram o ramo); a busca; os quatro painéis de aprofundamento com a resposta curta e um número com prova; e, recolhidos no fim, os
 * elos pelo CNPJ, o recorte, as medidas que não se somam e os downloads. A página não repete os gráficos dos painéis.
 */
export default function EmpresasPage() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cadastro;
  const a = c.ativos;
  const t = c.transmissao;
  const d = g.distribuidoras;
  const f = g.financas;
  const ct = g.controle;
  const datas = g.datas;
  const prov = g.proveniencia;
  const dataSiga = dataTexto(a.data);
  const semDado = tx("sem dado", "no data");
  const semJanela = tx("sem janela", "no window");
  const janela = datas.polimero_janela.length
    ? tx(`${trimestreTexto(datas.polimero_janela[0])} a ${trimestreTexto(datas.polimero_janela.at(-1))}`, `${trimestreTexto(datas.polimero_janela[0])} to ${trimestreTexto(datas.polimero_janela.at(-1))}`)
    : semJanela;
  const inicioJanela = datas.polimero_janela.length ? trimestreTexto(datas.polimero_janela[0]) : semJanela;

  const evTaxaNacional = lerGold<{ evidencias?: { taxa_nacional?: Evidencia } }>("perdas.json")?.evidencias?.taxa_nacional ?? null;
  const anoPerdas = d.indice.find((x) => x.perdas?.ano)?.perdas?.ano ?? null;
  const anoQualidade = d.indice.find((x) => x.qualidade?.ano)?.qualidade?.ano ?? null;
  const refPerdas = referenciaPerdasNacional(evTaxaNacional, anoPerdas);
  // a taxa nacional aparece com duas casas, como as perdas de cada distribuidora e a legenda do gráfico do comparador
  const evTaxaNacional2 = evTaxaNacional ? comValorExibido(evTaxaNacional, pctTexto(evTaxaNacional.valor_calculo, 2)) : null;
  const padraoFin = padraoFinancas(f.companhias);
  const compPadrao = f.companhias.find((x) => x.cnpj === padraoFin[0]) ?? null;
  const evReceita = padraoFin.length ? (evidenciasReceita(g.series.evidencias, padraoFin)[padraoFin[0]] ?? null) : null;
  const grupo = ct.concentracao.grupo_proporcional;
  const exemplos = d.indice
    .filter((x) => x.ativa && x.qualidade?.ucs)
    .slice()
    .sort((x, y) => (y.qualidade!.ucs as number) - (x.qualidade!.ucs as number))
    .slice(0, 4)
    .map((x) => ({ rotulo: x.sigla, href: rotaEntidade(x.slug) }));
  const entidades = entidadesBuscaEmpresas(g);
  const listadas = lerGold<ListadasGold>("listadas.json");
  const logos = lerManifestoLogos();
  const cartoes = integra(listadas) ? vitrineListadas(listadas, logos) : [];
  const ucs = ucsDistribuidoras(g);
  const semMmgd = traduzir(
    LIMITACAO_EMPRESAS_EN,
    prov.ativos.limitacoes.find((x) => /micro e minigera/i.test(x)) ?? "Micro e minigeração distribuída não está no SIGA e fica fora das medidas de capacidade.", // i18n: dado (chave da tabela LIMITACAO_EMPRESAS_EN)
  );
  const downloads = g.downloads.map((x) => ({ ...x, rotulo: traduzir(DOWNLOAD_EMPRESAS_EN, x.rotulo) }));

  const oQueMudou = tx(
    <>
      O SIGA e o SIGET são lidos todo dia; o cadastro de agentes e o conjunto Agentes de Geração, todo mês; as declarações de composição societária, a cada trimestre. Revisões detectadas nos
      dados do SIGA nesta publicação: {inteiro(prov.ativos.revisoes_conhecidas?.total)}. Na CVM, {inteiro(f.revisoes.valores_reapresentados)} valores foram reapresentados no comparativo do ano
      seguinte.
    </>,
    <>
      SIGA and SIGET are read every day; the agent registry and the <Nome>Agentes de Geração</Nome> dataset, every month; the shareholding structure declarations, every quarter. Revisions detected
      in the SIGA data in this release: {inteiro(prov.ativos.revisoes_conhecidas?.total)}. At CVM, {inteiro(f.revisoes.valores_reapresentados)} values were restated in the following year&apos;s
      comparative figures.
    </>,
  );
  const comoInterpretar = tx(
    <>
      Cada caminho lê uma fonte com a própria data e a própria unidade. O CNPJ liga a empresa ao ativo, ao grupo e às demonstrações; as medidas de caminhos diferentes não se somam, e a
      seção seguinte diz quais são.
    </>,
    <>
      Each path reads a source with its own date and its own unit. The CNPJ links the company to the asset, the group and the financial statements; measures from different paths are not added
      together, and the next section says which ones they are.
    </>,
  );
  const naoConcluir = tx(
    <>
      Capacidade instalada não é energia gerada. O dono direto de uma usina, em geral uma sociedade de propósito específico, não é o controlador econômico. Companhia sem demonstração na CVM não
      tem métrica econômica aqui.
    </>,
    <>
      Installed capacity is not energy generated. The direct owner of a plant, usually a special purpose company, is not the economic controller. A company without financial statements at CVM
      has no economic metric here.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:empresas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["CNPJ", "SIGA", "SIGET", "CVM", "DFP", "ITR", "HHI", "CADE"]}
          titulo={tx("Quem atua no setor elétrico?", "Who operates in the power sector?")}
          lead={tx(
            "Quem gera, transmite e distribui a energia do país, quem controla essas empresas e como as companhias abertas se saem. Comece pelas listadas na bolsa, pelo mapa do setor ou pela busca.",
            "Who generates, transmits and distributes the country's electricity, who controls these companies and how publicly held companies perform. Start with the companies listed on the stock exchange, the sector map or the search.",
          )}
          recorte={
            integra(listadas)
              ? tx(
                  `Dados de ${dataSiga} (usinas) a ${dataTexto(listadas.datas.carteira_iee)} (bolsa); cada número traz a sua data`,
                  `Data from ${dataSiga} (plants) to ${dataTexto(listadas.datas.carteira_iee)} (stock exchange); each number carries its own date`,
                )
              : tx(`Usinas do SIGA de ${dataSiga}; cada número traz a sua data`, `SIGA plants as of ${dataSiga}; each number carries its own date`)
          }
          fonte={tx(
            "ANEEL (cadastros de geração, transmissão e agentes), CVM (demonstrações) e B3 (carteira do IEE e cotações)",
            "ANEEL (generation, transmission and agent registries), CVM (financial statements) and B3 (IEE portfolio and quotes)",
          )}
          referencia={tx(
            <>
              SIGA de {dataSiga}; SIGET de {dataTexto(t?.data)}; cadastro de agentes de {dataTexto(datas.cadastro_agentes)}; composição societária declarada à ANEEL de {janela}; CVM com DFP até{" "}
              {f.periodos.ultimo_exercicio ?? "sem dado"} e ITR até {dataTexto(f.periodos.ultimo_trimestre)}; números das distribuidoras copiados das bases publicadas de Perdas, Qualidade e Conta de
              luz. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              SIGA as of {dataSiga}; SIGET as of {dataTexto(t?.data)}; agent registry as of {dataTexto(datas.cadastro_agentes)}; shareholding structure declared to ANEEL for {janela}; CVM with DFP up to{" "}
              {f.periodos.ultimo_exercicio ?? "no data"} and ITR up to {dataTexto(f.periodos.ultimo_trimestre)}; distribution utility figures copied from the published Losses, Quality of supply and
              Electricity bill databases. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: tx("SIGA (usinas)", "SIGA (plants)"), texto: tx(`até ${dataSiga}`, `up to ${dataSiga}`), natureza: "OBSERVADO" },
                ...(t ? [{ rotulo: tx("SIGET (transmissão)", "SIGET (transmission)"), texto: tx(`até ${dataTexto(t.data)}`, `up to ${dataTexto(t.data)}`), natureza: "OBSERVADO" as const }] : []),
                { rotulo: tx("Cadastro de agentes", "Agent registry"), texto: tx(`de ${dataTexto(datas.cadastro_agentes)}`, `as of ${dataTexto(datas.cadastro_agentes)}`), natureza: "OBSERVADO" },
                { rotulo: tx("Composição societária", "Shareholding structure"), texto: tx(`declarações de ${janela}`, `declarations for ${janela}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Distribuidoras, perdas", "Distribution utilities, losses"),
                  texto: tx(`${anoPerdas ?? "sem dado"}, base publicada de Perdas`, `${anoPerdas ?? "no data"}, published Losses database`),
                  natureza: prov.distribuidoras_perdas?.natureza ?? "CALCULADO",
                },
                {
                  rotulo: tx("Distribuidoras, continuidade", "Distribution utilities, continuity of supply"),
                  texto: tx(`${anoQualidade ?? "sem dado"}, base publicada de Qualidade`, `${anoQualidade ?? "no data"}, published Quality of supply database`),
                  natureza: prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO",
                },
                {
                  rotulo: tx("Distribuidoras, tarifa", "Distribution utilities, tariff"),
                  texto: tx("vigente na data do arquivo de tarifas, base publicada de Conta de luz", "in force on the date of the tariff file, published Electricity bill database"),
                  natureza: prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO",
                },
                { rotulo: "CVM, DFP", texto: tx(`até o exercício de ${f.periodos.ultimo_exercicio ?? "sem dado"}`, `up to fiscal year ${f.periodos.ultimo_exercicio ?? "no data"}`), natureza: "OBSERVADO" },
                { rotulo: "CVM, ITR", texto: tx(`até ${dataTexto(f.periodos.ultimo_trimestre)}`, `up to ${dataTexto(f.periodos.ultimo_trimestre)}`), natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("O setor elétrico em quatro números", "The power sector in four numbers")}
              nota={
                <>
                  {tx("Cada número tem a sua fonte e a sua data; nenhum se soma ao outro.", "Each number has its own source and date; none is added to another.")} {semMmgd}
                </>
              }
            >
              <Numero
                variante="faixa"
                rotulo={tx("Potência em operação", "Capacity in operation")}
                natureza="CALCULADO"
                valor={a.operacao.mw_fiscalizado}
                formato="num"
                casas={0}
                unidade="MW"
                periodo={tx(`SIGA de ${dataSiga}`, `SIGA as of ${dataSiga}`)}
                nota={tx(
                  `Em ${inteiro(a.operacao.usinas)} usinas. Capacidade instalada, não é energia gerada.`,
                  `In ${inteiro(a.operacao.usinas)} plants. Installed capacity, not energy generated.`,
                )}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Transmissão em operação", "Transmission in operation")}
                natureza="CALCULADO"
                valor={t ? t.resumo.km_circuito_operacao : null}
                formato="num"
                casas={0}
                unidade={tx("km de circuito", "circuit km")}
                periodo={tx(`SIGET de ${dataTexto(t?.data)}`, `SIGET as of ${dataTexto(t?.data)}`)}
                nota={t ? tx(`Em ${inteiro(t.resumo.cnpjs_com_modulos)} concessionárias.`, `In ${inteiro(t.resumo.cnpjs_com_modulos)} concession holders.`) : undefined}
                motivoAusencia={tx("O SIGET não está integrado nesta publicação.", "SIGET is not integrated in this release.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Distribuidoras ativas", "Active distribution utilities")}
                natureza="OBSERVADO"
                valor={d.resumo.ativas}
                formato="num"
                casas={0}
                unidade={tx("distribuidoras", "distribution utilities")}
                periodo={tx(`índice de ${dataTexto(g.gerado_em.slice(0, 10))}`, `index as of ${dataTexto(g.gerado_em.slice(0, 10))}`)}
                nota={
                  ucs.ucs !== null
                    ? tx(
                        `${num(ucs.ucs / 1e6, 1)} milhões de unidades consumidoras em ${ucs.ano}, nas ${inteiro(ucs.distribuidoras)} com continuidade publicada.`,
                        `${num(ucs.ucs / 1e6, 1)} million consumer units in ${ucs.ano}, in the ${inteiro(ucs.distribuidoras)} with published continuity data.`,
                      )
                    : undefined
                }
              />
              <Numero
                variante="faixa"
                rotulo={tx("Companhias no Índice de Energia Elétrica", "Companies in the Electric Power Index (IEE)")}
                natureza="OBSERVADO"
                valor={cartoes.length || null}
                formato="num"
                casas={0}
                unidade={tx("companhias", "companies")}
                periodo={integra(listadas) ? tx(`carteira do IEE de ${dataTexto(listadas.datas.carteira_iee)}`, `IEE portfolio as of ${dataTexto(listadas.datas.carteira_iee)}`) : semDado}
                nota={tx("Listadas na B3; a vitrine logo abaixo leva à ficha de cada uma.", "Listed on B3; the showcase just below leads to each one's profile.")}
                motivoAusencia={tx("A base das companhias listadas não foi publicada nesta atualização.", "The listed companies database was not published in this update.")}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              A página reúne quem opera usinas e linhas, como cada distribuidora atende a sua área, o que as companhias abertas reportam à CVM e quem controla quanto da
              capacidade instalada. Toda ligação entre empresa e ativo é o CNPJ ({SIGLAS.CNPJ}) publicado pela fonte oficial no mesmo registro; nenhuma é feita por semelhança
              de nome.
            </>,
            <>
              The page brings together who operates plants and lines, how each distribution utility serves its area, what publicly held companies report to CVM and who controls how much
              of the installed capacity. Every link between company and asset is the CNPJ ({SIGLAS_IDIOMAS.en.CNPJ}) published by the official source in the same record; none is
              made by name similarity.
            </>,
          )}
        </CabecalhoModulo>
        <EmpresasNavegacao atual="sintese" />

        {integra(listadas) && cartoes.length > 0 && <VitrineListadas cartoes={cartoes} logos={logos} dataCarteira={dataTexto(listadas.datas.carteira_iee)} />}
        <MapaCadeia elos={cadeiaDoSetor(g)} dataAgentes={dataTexto(datas.cadastro_agentes)} />

        <ModoProfundidade>
          <Bloco id="empresas">
            <section id="busca" aria-labelledby="busca-titulo" className="scroll-mt-28 pb-6">
              <p className="rotulo text-mineral">{tx("Busca", "Search")}</p>
              <h2 id="busca-titulo" className="ed-h2 mt-1 font-serif text-carvao">
                {tx("Qual empresa você procura?", "Which company are you looking for?")}
              </h2>
              <div className="mt-2">
                <EmpresasBusca entidades={entidades} hrefArvore={`${rotaPainel("p039")}#arvore`} total={entidades.length} />
              </div>
            </section>

            <EmpresasCapitulos
              itens={[
                {
                  id: "p036",
                  resposta: (
                    <RespostaCurta id="p036" tamanho="sm" veredito={comNomes(vereditoCadastro(c), c.proprietarios.map((x) => x.nome))}>
                      {respostaCadastro(c)}
                    </RespostaCurta>
                  ),
                  numero: (
                    <Numero
                      variante="faixa"
                      rotulo={tx("Potência com donos identificados", "Capacity with identified owners")}
                      natureza="CALCULADO"
                      evidencia={comValorExibido(a.evidencia, pctTexto(a.evidencia.valor_calculo, 2))}
                      formato="pct"
                      casas={2}
                      unidade={tx("da potência", "of capacity")}
                      nota={tx(
                        `${inteiro(a.proprietarios_cnpj)} proprietários com CNPJ; ${inteiro(a.sem_vinculo_total)} registros em operação sem vínculo completo, todos com o motivo.${t ? ` Na transmissão, ${pctTexto(t.evidencia.valor_calculo, 1)} dos módulos estão ligados ao CNPJ.` : ""}`,
                        `${inteiro(a.proprietarios_cnpj)} owners with CNPJ; ${inteiro(a.sem_vinculo_total)} records in operation without a complete link, all with the reason.${t ? ` In transmission, ${pctTexto(t.evidencia.valor_calculo, 1)} of the modules are linked to a CNPJ.` : ""}`,
                      )}
                      endereco={ancoraPainel("p036")}
                    />
                  ),
                  contexto: tx(
                    <>
                      Usinas do SIGA ({SIGLAS.SIGA}) de {dataSiga}, {inteiro(a.usinas)} em todas as fases; linhas do SIGET ({SIGLAS.SIGET}) de {dataTexto(t?.data)}. Potência fiscalizada em operação, em MW.
                    </>,
                    <>
                      SIGA ({SIGLAS_IDIOMAS.en.SIGA}) plants as of {dataSiga}, {inteiro(a.usinas)} in all phases; SIGET ({SIGLAS_IDIOMAS.en.SIGET}) lines as of {dataTexto(t?.data)}.
                      Inspected capacity in operation, in MW.
                    </>,
                  ),
                  limite: tx(
                    "a energia que as usinas geram, nem quem controla economicamente: capacidade instalada não é geração, e o dono direto não é o controlador (essa pergunta está na página de controle).",
                    "the energy the plants generate, or who controls them economically: installed capacity is not generation, and the direct owner is not the controller (that question is on the control page).",
                  ),
                },
                {
                  id: "p037",
                  resposta: (
                    <RespostaCurta id="p037" tamanho="sm" veredito={vereditoDistribuidoras(d, refPerdas?.valor ?? null, anoPerdas)}>
                      {respostaDistribuidoras(d)}
                    </RespostaCurta>
                  ),
                  numero:
                    evTaxaNacional2 && refPerdas ? (
                      <Numero
                        variante="faixa"
                        rotulo={tx("Referência: perdas totais na distribuição, Brasil", "Reference: total distribution losses, Brazil")}
                        natureza={prov.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                        evidencia={evTaxaNacional2}
                        formato="pct"
                        casas={2}
                        nota={tx(
                          `Taxa das concessionárias em conjunto (perdas somadas sobre energia injetada somada, não a média das taxas): ${evTaxaNacional2.universo}. Número do módulo Perdas, a referência das barras de perdas no comparador.`,
                          `Rate of the concession holders together (summed losses over summed energy injected, not the average of the rates): ${universoPerdas(evTaxaNacional2.universo)}. Figure from the Losses module, the reference for the loss bars in the comparator.`,
                        )}
                        endereco={ancoraPainel("p037")}
                      />
                    ) : (
                      <Numero
                        variante="faixa"
                        rotulo={tx("Referência: perdas totais na distribuição, Brasil", "Reference: total distribution losses, Brazil")}
                        natureza="CALCULADO"
                        valor={null}
                        motivoAusencia={tx(
                          "A base publicada de Perdas não publica a taxa nacional do mesmo ano das perdas por distribuidora.",
                          "The published Losses database does not publish the national rate for the same year as the losses by distribution utility.",
                        )}
                      />
                    ),
                  contexto: tx(
                    <>
                      {inteiro(d.resumo.distribuidoras)} distribuidoras pelo CNPJ; perdas de {anoPerdas ?? "sem dado"} (balanço do SAMP, {SIGLAS.SAMP}) e continuidade de {anoQualidade ?? "sem dado"}, o ano de
                      referência de cada módulo de origem, e tarifa vigente na data do arquivo de tarifas.
                    </>,
                    <>
                      {inteiro(d.resumo.distribuidoras)} distribution utilities by CNPJ; losses for {anoPerdas ?? "no data"} (SAMP balance, {SIGLAS_IDIOMAS.en.SAMP}) and continuity of supply for {anoQualidade ?? "no data"}, the reference year of each source module, and the tariff in force on the date of the tariff file.
                    </>,
                  ),
                  limite: tx(
                    "eficiência ou culpa da distribuidora: perdas, interrupções e tarifa dependem da área atendida, e anos de referência diferentes não se comparam.",
                    "the distribution utility's efficiency or fault: losses, interruptions and tariff depend on the area served, and different reference years are not comparable.",
                  ),
                  extra:
                    exemplos.length > 0 ? (
                      <div className="text-sm text-carvao-muted">
                        <p>
                          {tx(
                            "Fichas das distribuidoras com mais unidades consumidoras; as demais estão no índice da página.",
                            "Profiles of the distribution utilities with the most consumer units; the others are in the page's index.",
                          )}
                        </p>
                        <ul className="flex flex-wrap gap-x-5">
                          {exemplos.map((x) => (
                            <li key={x.href}>
                              <Link href={x.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                                <Nome>{x.rotulo}</Nome>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : undefined,
                },
                {
                  id: "p038",
                  resposta: (
                    <RespostaCurta id="p038" tamanho="sm" veredito={vereditoFinancas(f)}>
                      {respostaFinancas(f)}
                    </RespostaCurta>
                  ),
                  numero: compPadrao ? (
                    <Numero
                      variante="faixa"
                      rotulo={tx(
                        `Receita ${compPadrao.ultimo_exercicio ?? ""}: ${nomeOuCnpj(compPadrao.nome, compPadrao.cnpj)}`,
                        `Net revenue ${compPadrao.ultimo_exercicio ?? ""}: ${nomeOuCnpj(compPadrao.nome, compPadrao.cnpj)}`,
                      )}
                      nomesNoRotulo={[nomeOuCnpj(compPadrao.nome, compPadrao.cnpj)]}
                      natureza={compPadrao.alertas.includes("escala_corrigida") ? "ESTIMADO" : "OBSERVADO"}
                      valor={emMilhoes(evReceita?.valor_calculo ?? null)}
                      casas={1}
                      unidade={tx("R$ milhões", "R$ million")}
                      evidencia={evReceita}
                      motivoAusencia={tx("A receita do último exercício não tem ficha publicada.", "Net revenue for the latest fiscal year has no published sheet.")}
                      nota={tx(
                        "A companhia ativa de maior ativo total sem controladora aberta acima dela; na página, escolha qualquer outra.",
                        "The active company with the largest total assets and no publicly held parent above it; on the page, choose any other.",
                      )}
                      endereco={ancoraPainel("p038")}
                    />
                  ) : (
                    <Numero
                      variante="faixa"
                      rotulo={tx("Receita do último exercício", "Net revenue for the latest fiscal year")}
                      natureza="OBSERVADO"
                      valor={null}
                      motivoAusencia={tx("Nenhuma companhia ativa com ativo total publicado.", "No active company with published total assets.")}
                    />
                  ),
                  contexto: tx(
                    <>
                      Companhias abertas registradas na CVM ({SIGLAS.CVM}): {SIGLAS.DFP} (DFP) de {f.periodos.exercicios[0] ?? "sem dado"} a {f.periodos.ultimo_exercicio ?? "sem dado"} e {SIGLAS.ITR} (ITR)
                      até {dataTexto(f.periodos.ultimo_trimestre)}, em R$ nominais.
                    </>,
                    <>
                      Publicly held companies registered with CVM ({SIGLAS_IDIOMAS.en.CVM}): {SIGLAS_IDIOMAS.en.DFP} (DFP) from {f.periodos.exercicios[0] ?? "no data"} to{" "}
                      {f.periodos.ultimo_exercicio ?? "no data"} and {SIGLAS_IDIOMAS.en.ITR} (ITR) up to {dataTexto(f.periodos.ultimo_trimestre)}, in nominal R$.
                    </>,
                  ),
                  limite: tx(
                    "o desempenho do setor inteiro (só companhias abertas), nem soma entre companhias; as demonstrações regulatórias da ANEEL estão bloqueadas na fonte e não foram substituídas.",
                    "the performance of the whole sector (only publicly held companies), or a sum across companies; ANEEL's regulatory financial statements are blocked at the source and were not replaced.",
                  ),
                },
                {
                  id: "p039",
                  resposta: (
                    <RespostaCurta id="p039" tamanho="sm" veredito={comNomes(vereditoControle(ct), ct.concentracao.grupo_proporcional?.maiores.map((m) => m.nome) ?? [])}>
                      {comNomes(respostaControle(ct), ct.concentracao.grupo_proporcional?.maiores.map((m) => m.nome) ?? [])}
                    </RespostaCurta>
                  ),
                  numero: (
                    <Numero
                      variante="faixa"
                      rotulo={tx("Concentração por grupo de controle (HHI)", "Concentration by controlling group (HHI)")}
                      natureza="CALCULADO"
                      evidencia={ct.concentracao.evidencia}
                      casas={0}
                      unidade={tx("pontos", "points")}
                      nota={tx(
                        `${grupo ? `${inteiro(grupo.participantes)} grupos; fronteira de ${mwTexto(ct.fronteira.mw)}. ` : ""}HHI é o ${SIGLAS.HHI}, de 0 a 10.000; as faixas são as do Guia do CADE (${SIGLAS.CADE}). O período vai do primeiro trimestre de declarações considerado (${inicioJanela}) à data do SIGA.`,
                        `${grupo ? `${inteiro(grupo.participantes)} groups; boundary of ${mwTexto(ct.fronteira.mw)}. ` : ""}HHI is the ${SIGLAS_IDIOMAS.en.HHI}, from 0 to 10,000; the bands are those of the CADE Guide (${SIGLAS_IDIOMAS.en.CADE}). The period runs from the first quarter of declarations considered (${inicioJanela}) to the SIGA date.`,
                      )}
                      endereco={ancoraPainel("p039")}
                    />
                  ),
                  contexto: tx(
                    <>
                      SIGA de {dataTexto(ct.fronteira.data)} e declarações de composição societária à ANEEL de {janela}; usinas em operação com participações válidas. {textoFronteiraNoCadastro(ct.fronteira, a)}
                    </>,
                    <>
                      SIGA as of {dataTexto(ct.fronteira.data)} and shareholding structure declarations to ANEEL for {janela}; plants in operation with valid stakes. {textoFronteiraNoCadastro(ct.fronteira, a)}
                    </>,
                  ),
                  limite: tx(
                    "poder de mercado: a fronteira é capacidade instalada, não energia vendida nem mercado relevante, e a participação indireta não é calculada.",
                    "market power: the boundary is installed capacity, not energy sold or a relevant market, and indirect interests are not calculated.",
                  ),
                },
              ]}
            />

            <AtalhoLeitura
              href="/setor-eletrico/empresas/analise"
              titulo={tx("Controle, resultado e investimento na mesma leitura", "Control, earnings and investment in a single reading")}
              texto={tx("Selecione uma companhia, confronte lucro e caixa e avance aos segmentos de negócio.", "Select a company, compare net income and cash and move on to the business segments.")}
            />

            <details id="metodo" className="group mt-8 scroll-mt-28 border-t border-linha pt-4">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-carvao [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="rotulo block text-mineral">{tx("Método, fontes e downloads", "Method, sources and downloads")}</span>
                  <span className="ed-h3 font-serif">{tx("Como uma empresa se liga a ativos, grupos e demonstrações", "How a company links to assets, groups and financial statements")}</span>
                </span>
                <span aria-hidden="true" className="text-xl text-energia-dark transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="pt-4">
            <PainelEvidencia
              id="entrada"
              pergunta={tx("Como uma empresa se liga a ativos, grupos e demonstrações?", "How does a company link to assets, groups and financial statements?")}
              subtitulo={tx(
                "Os quatro elos pelo mesmo CNPJ, com a fonte e a data de cada caminho · contagens, MW e R$ em universos que não se somam",
                "The four links by the same CNPJ, with the source and date of each path · counts, MW and R$ in universes that are not added together",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  Saber quem opera, quem distribui, quem reporta demonstrações e quem controla é o primeiro passo para discutir concentração, responsabilidade por atrasos e o peso de cada empresa no
                  sistema. O vínculo só conta quando a própria fonte publica o identificador no registro.
                </>,
                <>
                  Knowing who operates, who distributes, who reports financial statements and who controls is the first step to discuss concentration, responsibility for delays and the weight of each
                  company in the system. The link only counts when the source itself publishes the identifier in the record.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.ativos}
              complementares={[
                { rotulo: tx("Cadastro de agentes", "Agent registry"), p: prov.cadastro_agentes },
                ...(prov.transmissao ? [{ rotulo: tx("Transmissão por CNPJ (SIGET)", "Transmission by CNPJ (SIGET)"), p: prov.transmissao }] : []),
                { rotulo: tx("Distribuidoras pelo CNPJ", "Distribution utilities by CNPJ"), p: prov.distribuidoras },
                { rotulo: tx("Demonstrações na CVM", "Financial statements at CVM"), p: prov.financas },
                { rotulo: tx("Controle e concentração", "Control and concentration"), p: prov.concentracao },
              ]}
            >
              <div className="space-y-6">
                <EmpresasPassosVinculo passos={passosVinculo(g)} />
                <EmpresasRecorte
                  periodo={tx(
                    <>
                      SIGA de {dataSiga}; SIGET de {dataTexto(t?.data)}; composição societária declarada à ANEEL de {janela}; CVM com DFP até {f.periodos.ultimo_exercicio ?? "sem dado"} e ITR até{" "}
                      {dataTexto(f.periodos.ultimo_trimestre)}; perdas de {anoPerdas ?? "sem dado"} e continuidade de {anoQualidade ?? "sem dado"}
                    </>,
                    <>
                      SIGA as of {dataSiga}; SIGET as of {dataTexto(t?.data)}; shareholding structure declared to ANEEL for {janela}; CVM with DFP up to {f.periodos.ultimo_exercicio ?? "no data"} and ITR up
                      to {dataTexto(f.periodos.ultimo_trimestre)}; losses for {anoPerdas ?? "no data"} and continuity of supply for {anoQualidade ?? "no data"}
                    </>,
                  )}
                  universo={tx(
                    <>
                      {inteiro(a.usinas)} usinas do SIGA ({inteiro(a.operacao.usinas)} em operação); {inteiro(d.resumo.distribuidoras)} distribuidoras; {inteiro(f.universo.companhias)} companhias abertas na CVM;{" "}
                      {inteiro(grupo?.participantes)} grupos de controle
                    </>,
                    <>
                      {inteiro(a.usinas)} SIGA plants ({inteiro(a.operacao.usinas)} in operation); {inteiro(d.resumo.distribuidoras)} distribution utilities; {inteiro(f.universo.companhias)} publicly held
                      companies at CVM; {inteiro(grupo?.participantes)} controlling groups
                    </>,
                  )}
                  unidade={tx(
                    "MW (potência fiscalizada em operação), km de circuito, R$ nominais e contagens; nada se soma entre caminhos",
                    "MW (inspected capacity in operation), circuit km, nominal R$ and counts; nothing is added across paths",
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel
                  id="medidas"
                  titulo={tx("Quais medidas não se somam?", "Which measures are not added together?")}
                  lead={tx("Quatro pares que parecem somáveis e não são. Cada página repete a regra junto do número.", "Four pairs that seem addable but are not. Each page repeats the rule next to the number.")}
                >
                  <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    {medidas().map(([n, x]) => (
                      <li key={n} className="border-l-2 border-linha pl-4">
                        <p className="rotulo text-mineral">{n}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{x}</p>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <div id="dados-do-modulo" className="scroll-mt-28">
                  <EmpresasSeguir ancora="entrada" proximo={{ href: rotaPainel("p036"), pergunta: painel("p036").pergunta }} downloads={downloads} />
                </div>
              </div>
            </PainelEvidencia>
              </div>
            </details>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
