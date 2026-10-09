import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasComparador, EmpresasIndiceDistribuidoras } from "@/components/energia/EmpresasDistribuidoras";
import {
  EmpresasComoLer,
  EmpresasDatas,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasRecorte,
  EmpresasSeguir,
} from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_DISTRIBUIDORAS,
  ancoraPainel,
  dadosComparacao,
  dataTexto,
  downloadsDe,
  entidadesDistribuidoras,
  inteiro,
  linhasDistribuidoras,
  padraoComparacao,
  painel,
  pctTexto,
  referenciaPerdasNacional,
  respostaDistribuidoras,
  rotaEntidade,
  semNomesDeCampo,
  vereditoDistribuidoras,
} from "@/lib/energia/empresas";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { comValorExibido, type Evidencia } from "@/lib/energia/evidencia";
import { SIGLAS } from "@/lib/energia/siglas";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Como a distribuidora atende sua área? Índice e comparador",
  description:
    "Índice das distribuidoras pelo CNPJ, com perdas (SAMP), continuidade (DEC e FEC diante do limite) e tarifa residencial B1 copiadas dos módulos de origem, comparador de até quatro e link para a ficha de cada uma.",
  alternates: { canonical: "/setor-eletrico/empresas/distribuidoras" },
};

export default function PaginaP037() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const d = g.distribuidoras;
  const prov = g.proveniencia;
  const golds = d.golds_origem;
  // referência nacional de perdas: a da gold de Perdas, só quando é do mesmo ano das perdas por distribuidora
  const evTaxaNacional = lerGold<{ evidencias?: { taxa_nacional?: Evidencia } }>("perdas.json")?.evidencias?.taxa_nacional ?? null;
  const anoPerdas = d.indice.find((x) => x.perdas?.ano)?.perdas?.ano ?? null;
  const anoQualidade = d.indice.find((x) => x.qualidade?.ano)?.qualidade?.ano ?? null;
  const refPerdas = referenciaPerdasNacional(evTaxaNacional, anoPerdas);
  // a taxa nacional aparece com duas casas, como a legenda do gráfico de perdas e as perdas de cada distribuidora
  const evTaxaNacional2 = evTaxaNacional ? comValorExibido(evTaxaNacional, pctTexto(evTaxaNacional.valor_calculo, 2)) : null;
  const perdasDestino = DESTINOS_NAVEGACAO.find((x) => x.slug === "perdas");
  const dataIndice = dataTexto(g.gerado_em.slice(0, 10));
  // data do arquivo de tarifas da base publicada de Conta de luz: a vigência de cada tarifa é decidida nessa data
  const dataTarifas = lerGold<{ data_referencia?: string }>("conta.json")?.data_referencia ?? null;

  const oQueMudou = (
    <>
      As bases publicadas de origem foram geradas em {carimbo(golds["perdas.json"].gerado_em)} (Perdas), {carimbo(golds["qualidade.json"].gerado_em)} (Qualidade) e {carimbo(golds["conta.json"].gerado_em)}{" "}
      (Conta de luz). A evolução de cada distribuidora (perdas em {inteiro(d.resumo.com_evolucao.perdas)}, continuidade em {inteiro(d.resumo.com_evolucao.qualidade)} e tarifa em{" "}
      {inteiro(d.resumo.com_evolucao.tarifa)}) está na ficha.
    </>
  );
  const comoInterpretar = <>{semNomesDeCampo(d.pares)}</>;
  const naoConcluir = (
    <>
      Não se conclui eficiência nem culpa: perdas, continuidade e tarifa dependem da área atendida (densidade, clima, renda, rede herdada). Anos de referência diferentes não se comparam. A tarifa B1
      residencial não é a conta inteira (tributos e bandeiras ficam fora). O ramo declarado no cadastro de agentes não define distribuidora.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-distribuidoras" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="p037" />
        <CabecalhoModulo
          rotulo="Empresas"
          siglas={["SAMP", "DEC", "FEC", "TE", "TUSD", "ANEEL"]}
          titulo={painel("p037").pergunta}
          lead={`Perdas, continuidade e tarifa residencial de cada distribuidora, pelo CNPJ (${SIGLAS.CNPJ}) das bases reguladas da ANEEL (${SIGLAS.ANEEL}).`}
          recorte={`Perdas de ${anoPerdas ?? "sem dado"} · continuidade de ${anoQualidade ?? "sem dado"} · tarifa vigente na data do arquivo de tarifas · % da energia injetada, horas, interrupções e R$/MWh`}
          fonte="ANEEL, bases de perdas, continuidade e tarifas, copiadas dos módulos de origem"
          referencia={
            <>
              Perdas de {anoPerdas ?? "sem dado"} e continuidade de {anoQualidade ?? "sem dado"}, copiadas da base publicada de Perdas, gerada em {carimbo(golds["perdas.json"].gerado_em)}, e da de Qualidade,
              gerada em {carimbo(golds["qualidade.json"].gerado_em)}; tarifas da base publicada de Conta de luz, gerada em {carimbo(golds["conta.json"].gerado_em)}. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: "Índice pelo CNPJ", texto: `de ${dataIndice}`, natureza: prov.distribuidoras.natureza },
                { rotulo: "Perdas", texto: `${anoPerdas ?? "sem dado"}, base publicada de Perdas`, natureza: prov.distribuidoras_perdas?.natureza ?? "CALCULADO" },
                { rotulo: "Continuidade", texto: `${anoQualidade ?? "sem dado"}, base publicada de Qualidade`, natureza: prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO" },
                { rotulo: "Tarifa B1", texto: `vigente na data do arquivo de tarifas${dataTarifas ? ` (${dataTexto(dataTarifas)})` : ""}, base publicada de Conta de luz`, natureza: prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo="Indicadores das distribuidoras"
              nota="Contagens do índice inteiro e referência nacional, fixas: não mudam com a comparação escolhida."
            >
              <Numero
                variante="faixa"
                rotulo="Distribuidoras pelo CNPJ"
                natureza={prov.distribuidoras.natureza}
                valor={d.resumo.distribuidoras}
                formato="num"
                casas={0}
                unidade="distribuidoras"
                periodo={`índice de ${dataIndice}`}
                nota={`${inteiro(d.resumo.ativas)} ativas; ${inteiro(d.resumo.concessionarias)} concessionárias e ${inteiro(d.resumo.permissionarias)} permissionárias.`}
              />
              {evTaxaNacional2 && refPerdas ? (
                <Numero
                  variante="faixa"
                  rotulo="Referência: perdas, Brasil"
                  natureza={prov.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                  evidencia={evTaxaNacional2}
                  formato="pct"
                  casas={2}
                  unidade="da energia injetada"
                  nota="Concessionárias em conjunto: somas, não média das taxas."
                  endereco={ancoraPainel("p037")}
                />
              ) : (
                <Numero
                  variante="faixa"
                  rotulo="Referência: perdas totais na distribuição, Brasil"
                  natureza="CALCULADO"
                  valor={null}
                  motivoAusencia="A base publicada de Perdas não publica a taxa nacional do mesmo ano das perdas por distribuidora."
                />
              )}
              <Numero
                variante="faixa"
                rotulo="Com continuidade publicada"
                natureza={prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO"}
                valor={d.resumo.com_qualidade}
                formato="num"
                casas={0}
                unidade="distribuidoras"
                periodo={`DEC e FEC de ${anoQualidade ?? "sem dado"}`}
                nota="Cada uma com o limite que a ANEEL fixa para ela."
              />
              <Numero
                variante="faixa"
                rotulo="Com tarifa residencial vigente"
                natureza={prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO"}
                valor={d.resumo.com_tarifa_vigente}
                formato="num"
                casas={0}
                unidade="distribuidoras"
                periodo={`tarifa B1 no arquivo de tarifas de ${dataTarifas ? dataTexto(dataTarifas) : "data sem registro"}`}
              />
            </FaixaMetricas>
          }
        >
          O índice de todas as distribuidoras, identificadas pelo CNPJ que as próprias bases reguladas publicam, com as perdas, a continuidade do serviço e a tarifa residencial de cada uma, um comparador de
          até quatro e a ficha completa de cada distribuidora, com a evolução própria e os pares. Os números são cópia das páginas de Perdas, Qualidade e Conta de luz, sem recálculo.
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="distribuidoras">
            <PainelEvidencia
              id="p037"
              pergunta="Como se comparam as distribuidoras escolhidas?"
              subtitulo="Distribuidoras pelo CNPJ: perdas, continuidade, tarifa residencial e controle · %, horas, interrupções, R$/MWh"
              porQueImporta={
                <>
                  A distribuidora é a empresa com que o consumidor lida: quem leva a energia, quanto se perde no caminho (<Termo slug="perdas-de-energia">perdas</Termo>), quanto tempo e quantas vezes falta
                  luz (<Termo slug="dec">DEC</Termo> e <Termo slug="fec">FEC</Termo>) e quanto custa a <Termo slug="tarifa-te-tusd">tarifa</Termo>. A ficha junta esses números, que estão em bases
                  diferentes da ANEEL, pela mesma identidade.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.distribuidoras}
              complementares={[
                ...(prov.distribuidoras_perdas ? [{ rotulo: "Perdas totais (base publicada de Perdas)", p: prov.distribuidoras_perdas }] : []),
                ...(prov.distribuidoras_pnt ? [{ rotulo: "Perdas não técnicas (estimadas pela fonte)", p: prov.distribuidoras_pnt }] : []),
                ...(prov.distribuidoras_qualidade ? [{ rotulo: "DEC e FEC (base publicada de Qualidade)", p: prov.distribuidoras_qualidade }] : []),
                ...(prov.distribuidoras_tarifa ? [{ rotulo: "Tarifa B1 (base publicada de Conta de luz)", p: prov.distribuidoras_tarifa }] : []),
              ]}
            >
              <div className="space-y-6">
                <EmpresasComparador
                  entidades={entidadesDistribuidoras(d.indice)}
                  padrao={padraoComparacao(d.indice)}
                  comparacao={dadosComparacao(
                    d.indice,
                    d.indice.map((x) => x.slug),
                  )}
                  referenciaPerdas={refPerdas}
                />
                {/* a faixa já traz os números; a resposta vem depois das figuras, para o comparador começar na primeira tela */}
                <RespostaCurta id="p037" veredito={vereditoDistribuidoras(d, refPerdas?.valor ?? null, anoPerdas)} depois>
                  {respostaDistribuidoras(d)}
                </RespostaCurta>
                <EmpresasComoLer />
                <EmpresasRecorte
                  periodo={
                    <>
                      Perdas de {anoPerdas ?? "sem dado"} e continuidade de {anoQualidade ?? "sem dado"} (ano de referência de cada módulo); tarifas vigentes na data do arquivo de tarifas da ANEEL
                    </>
                  }
                  universo={
                    <>
                      {inteiro(d.resumo.distribuidoras)} distribuidoras com CNPJ no SAMP ({SIGLAS.SAMP}), nos indicadores de continuidade ou nas tarifas ({inteiro(d.resumo.ativas)} ativas)
                      {evTaxaNacional2 && refPerdas ? `; referência nacional de perdas: ${evTaxaNacional2.universo}` : ""}
                    </>
                  }
                  unidade="% da energia injetada; horas e interrupções por unidade consumidora; R$/MWh sem tributos"
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel
                  id="indice"
                  titulo="Qual é a distribuidora, e onde está a ficha dela?"
                  lead={`As ${inteiro(d.resumo.distribuidoras)} distribuidoras pelo CNPJ, com os números de referência de cada módulo de origem. Escolha uma linha para ver o resumo e abrir a ficha.`}
                >
                  <EmpresasIndiceDistribuidoras
                    entidades={entidadesDistribuidoras(d.indice)}
                    padrao={padraoComparacao(d.indice)}
                    linhas={linhasDistribuidoras(d.indice)}
                    fonte="ANEEL, SAMP, indicadores de continuidade e tarifas de aplicação (pelas bases publicadas dos módulos de origem)"
                    versao={g.gerado_em.slice(0, 10)}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="fichas" titulo="Todas as fichas e de onde vem a evolução de cada uma" nivel="analisar">
                  <nav aria-label="Fichas das distribuidoras">
                    <ul className="grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
                      {d.indice
                        .slice()
                        .sort((x, y) => x.sigla.localeCompare(y.sigla, "pt-BR"))
                        .map((x) => (
                          <li key={x.slug}>
                            <Link href={rotaEntidade(x.slug)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                              {x.sigla}
                              {x.ativa ? "" : " (inativa)"}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </nav>
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {(["perdas", "qualidade", "tarifa"] as const).map((m) => {
                      const s = d.series_evolucao[m];
                      return (
                        <li key={m}>
                          <span className="font-medium text-carvao">{{ perdas: "Perdas", qualidade: "Continuidade", tarifa: "Tarifa B1" }[m]}:</span>{" "}
                          {s ? (
                            <>
                              <a href={s.url} className="underline underline-offset-4 hover:text-carvao">
                                {s.url.split("/").pop()}
                              </a>{" "}
                              ({s.chave}; unidade {typeof s.unidade === "string" ? s.unidade : Object.values(s.unidade).join(", ")})
                            </>
                          ) : (
                            "a base publicada de origem não publica a série nesta publicação"
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel id="regra-universo" titulo="Regra do universo e identidade" nivel="auditar">
                  <p className="text-sm text-carvao-muted">{d.regra_universo}</p>
                  <p className="text-sm text-carvao-muted">
                    {inteiro(d.resumo.conflitos_classificacao)} conflitos de classificação entre SAMP e continuidade; {inteiro(d.resumo.sem_uf)} distribuidoras sem conjunto elétrico vigente ficam sem UF (a
                    área oficial vem da relação conjunto × município publicada pelo módulo Perdas, sem replicar taxas por município). Os números são cópia da base publicada de origem pelo CNPJ, sem
                    recálculo, com a natureza e a unidade de origem (selos acima).
                  </p>
                  <p className="text-sm text-carvao-muted">Colunas do índice, como na exportação: {COLUNAS_DISTRIBUIDORAS.map((x) => x.rotulo).join("; ")}.</p>
                </SecaoDoPainel>

                <EmpresasSeguir
                  ancora="p037"
                  proximo={{ href: perdasDestino?.href ?? "/setor-eletrico/perdas", pergunta: perdasDestino?.pergunta ?? "Onde a energia se perde?" }}
                  downloads={downloadsDe(g.downloads, ["/energia/series/empresas_distribuidoras.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
