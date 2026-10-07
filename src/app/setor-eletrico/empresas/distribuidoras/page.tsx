import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasDistribuidoras } from "@/components/energia/EmpresasDistribuidoras";
import {
  EmpresasAnalise,
  EmpresasAuditoria,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasRecorte,
  EmpresasResposta,
  EmpresasSeguir,
} from "@/components/energia/EmpresasPagina";
import { Numero } from "@/components/energia/Numero";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_DISTRIBUIDORAS,
  ancoraPainel,
  dadosComparacao,
  downloadsDe,
  entidadesDistribuidoras,
  inteiro,
  linhasDistribuidoras,
  padraoComparacao,
  painel,
  referenciaPerdasNacional,
  respostaDistribuidoras,
  rotaEntidade,
} from "@/lib/energia/empresas";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import type { Evidencia } from "@/lib/energia/evidencia";
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
  const golds = d.golds_origem;
  // referência nacional de perdas: a da gold de Perdas, só quando é do mesmo ano das perdas por distribuidora
  const evTaxaNacional = lerGold<{ evidencias?: { taxa_nacional?: Evidencia } }>("perdas.json")?.evidencias?.taxa_nacional ?? null;
  const anoPerdas = d.indice.find((x) => x.perdas?.ano)?.perdas?.ano ?? null;
  const anoQualidade = d.indice.find((x) => x.qualidade?.ano)?.qualidade?.ano ?? null;
  const refPerdas = referenciaPerdasNacional(evTaxaNacional, anoPerdas);
  const perdasDestino = DESTINOS_NAVEGACAO.find((x) => x.slug === "perdas");

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-distribuidoras" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Empresas"
          titulo={painel("p037").pergunta}
          referencia={
            <>
              Perdas de {anoPerdas ?? "sem dado"} e continuidade de {anoQualidade ?? "sem dado"}, copiadas da base publicada de Perdas, gerada em {carimbo(golds["perdas.json"].gerado_em)}, e da de Qualidade,
              gerada em {carimbo(golds["qualidade.json"].gerado_em)}; tarifas da base publicada de Conta de luz, gerada em {carimbo(golds["conta.json"].gerado_em)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          O índice de todas as distribuidoras, identificadas pelo CNPJ que as próprias bases reguladas publicam, com as perdas, a continuidade do serviço e a tarifa residencial de
          cada uma, um comparador de até quatro e a ficha completa de cada distribuidora, com a evolução própria e os pares.
        </CabecalhoModulo>
        <EmpresasNavegacao atual="p037" />
        <ModoProfundidade>

          <Bloco id="distribuidoras">
            <PainelEvidencia
              id="p037"
              pergunta={painel("p037").pergunta}
              subtitulo="Distribuidoras pelo CNPJ: perdas, continuidade, tarifa residencial e controle · %, horas, interrupções, R$/MWh"
              porQueImporta={
                <>
                  A distribuidora é a empresa com que o consumidor lida: quem leva a energia, quanto se perde no caminho (<Termo slug="perdas-de-energia">perdas</Termo>), quanto tempo e quantas
                  vezes falta luz (<Termo slug="dec">DEC</Termo> e <Termo slug="fec">FEC</Termo>) e quanto custa a <Termo slug="tarifa-te-tusd">tarifa</Termo>. A ficha junta esses números, que estão em
                  bases diferentes da ANEEL, pela mesma identidade.
                </>
              }
              oQueMudou={
                <>
                  As bases publicadas de origem foram geradas em {carimbo(golds["perdas.json"].gerado_em)} (Perdas), {carimbo(golds["qualidade.json"].gerado_em)} (Qualidade) e{" "}
                  {carimbo(golds["conta.json"].gerado_em)} (Conta de luz). A evolução de cada distribuidora (perdas em {inteiro(d.resumo.com_evolucao.perdas)}, continuidade em{" "}
                  {inteiro(d.resumo.com_evolucao.qualidade)} e tarifa em {inteiro(d.resumo.com_evolucao.tarifa)}) está na ficha.
                </>
              }
              comoInterpretar={<>{d.pares}</>}
              naoConcluir={
                <>
                  Não se conclui eficiência nem culpa: perdas, continuidade e tarifa dependem da área atendida (densidade, clima, renda, rede herdada). Anos de referência diferentes não se
                  comparam. A tarifa B1 residencial não é a conta inteira (tributos e bandeiras ficam fora). O ramo declarado no cadastro de agentes não define distribuidora.
                </>
              }
              proveniencia={g.proveniencia.distribuidoras}
              complementares={[
                ...(g.proveniencia.distribuidoras_perdas ? [{ rotulo: "Perdas totais (base publicada de Perdas)", p: g.proveniencia.distribuidoras_perdas }] : []),
                ...(g.proveniencia.distribuidoras_pnt ? [{ rotulo: "Perdas não técnicas (estimadas pela fonte)", p: g.proveniencia.distribuidoras_pnt }] : []),
                ...(g.proveniencia.distribuidoras_qualidade ? [{ rotulo: "DEC e FEC (base publicada de Qualidade)", p: g.proveniencia.distribuidoras_qualidade }] : []),
                ...(g.proveniencia.distribuidoras_tarifa ? [{ rotulo: "Tarifa B1 (base publicada de Conta de luz)", p: g.proveniencia.distribuidoras_tarifa }] : []),
              ]}
            >
              <div className="space-y-6">
                <EmpresasResposta id="p037">{respostaDistribuidoras(d)}</EmpresasResposta>
                <EmpresasRecorte
                  periodo={
                    <>
                      Perdas de {anoPerdas ?? "sem dado"} e continuidade de {anoQualidade ?? "sem dado"} (ano de referência de cada módulo); tarifas vigentes na data do arquivo de tarifas da ANEEL
                    </>
                  }
                  universo={
                    <>
                      {inteiro(d.resumo.distribuidoras)} distribuidoras com CNPJ no SAMP, nos indicadores de continuidade ou nas tarifas ({inteiro(d.resumo.ativas)} ativas)
                    </>
                  }
                  unidade="% da energia injetada; horas e interrupções por unidade consumidora; R$/MWh sem tributos"
                />
                {evTaxaNacional && refPerdas && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Numero
                      rotulo="Referência: perdas totais na distribuição, Brasil"
                      natureza={g.proveniencia.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                      evidencia={evTaxaNacional}
                      formato="pct"
                      casas={1}
                      tamanho="medio"
                      nota="Número do módulo Perdas, usado como referência nas barras do comparador (mesmo ano das perdas por distribuidora)."
                      endereco={ancoraPainel("p037")}
                    />
                  </div>
                )}
                <EmpresasDistribuidoras
                  linhas={linhasDistribuidoras(d.indice)}
                  entidades={entidadesDistribuidoras(d.indice)}
                  comparacao={dadosComparacao(
                    d.indice,
                    d.indice.map((x) => x.slug),
                  )}
                  padrao={padraoComparacao(d.indice)}
                  referenciaPerdas={refPerdas}
                  fonte="ANEEL, SAMP, indicadores de continuidade e tarifas de aplicação (pelas bases publicadas dos módulos de origem)"
                  versao={g.gerado_em.slice(0, 10)}
                />

                <EmpresasAnalise titulo="Todas as fichas e de onde vem a evolução de cada uma">
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
                </EmpresasAnalise>

                <EmpresasAuditoria titulo="Regra do universo e identidade">
                  <p className="text-sm text-carvao-muted">{d.regra_universo}</p>
                  <p className="text-sm text-carvao-muted">
                    {inteiro(d.resumo.conflitos_classificacao)} conflitos de classificação entre SAMP e continuidade; {inteiro(d.resumo.sem_uf)} distribuidoras sem conjunto elétrico vigente ficam sem UF
                    (a área oficial vem da relação conjunto × município publicada pelo módulo Perdas, sem replicar taxas por município). Os números são cópia da base publicada de origem pelo CNPJ, sem
                    recálculo, com a natureza e a unidade de origem (selos acima).
                  </p>
                  <p className="text-sm text-carvao-muted">Colunas do índice, como na exportação: {COLUNAS_DISTRIBUIDORAS.map((x) => x.rotulo).join("; ")}.</p>
                </EmpresasAuditoria>

                <EmpresasSeguir
                  ancora="p037"
                  proximo={{ href: perdasDestino?.href ?? "/setor-eletrico/perdas", pergunta: perdasDestino?.pergunta ?? "Onde se perde energia, quanto e com que efeito econômico?" }}
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
