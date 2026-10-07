import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { PerdasComposicao } from "@/components/energia/PerdasComposicao";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PerdasNavegacao, ReferenciaPerdas, RodapePainel, Recorte, Resposta } from "@/components/energia/PerdasPainel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import {
  ANO_LEIAUTE_SAMP,
  anosSerieNacional,
  fraseCoberturaSeparacao,
  linhaNacional,
  linhasComposicao,
  linhasSeparacaoNacional,
  marcaLeiauteSeparacao,
  motivosComposicao,
  numOu,
  respostaComposicao,
  rotuloDistribuidora,
  serieNacional,
} from "@/lib/energia/perdas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Perdas técnicas e não técnicas por distribuidora",
  description:
    "Composição das perdas de energia de cada distribuidora sobre a mesma energia injetada, a não técnica sobre o mercado de baixa tensão, a cobertura de cada ano e a série de universo fixo, com a fonte da ANEEL.",
  alternates: { canonical: "/setor-eletrico/perdas/composicao" },
};

export default function PerdasComposicaoPage() {
  const g = lerGold<PerdasGold>("perdas.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="perdas" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Perdas indisponíveis" motivo={g?.motivo ?? "Os dados processados de perdas não foram gerados nesta publicação."} />
        </main>
      </>
    );
  }

  const ref = g.referencia.ano;
  const ev = g.evidencias;
  const nac = linhaNacional(g, ref);
  const rotulos = Object.fromEntries(g.distribuidoras.map((d) => [d.cnpj, rotuloDistribuidora(d)]));
  const ids = g.distribuidoras.map((d) => d.cnpj);
  const versao = `SAMP até ${mesAno(g.referencia.ultima_competencia)}, publicado em ${dataBR(g.gerado_em)}`;
  const composicao = linhasComposicao(g.distribuidoras);
  const uf = g.universo_fixo;
  const inicioSerie = anosSerieNacional(g.nacional)?.inicio ?? ref;
  const cobertura = fraseCoberturaSeparacao(g.nacional, ref);

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas:composicao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["SAMP", "ANEEL", "IBGE"]}
          rotulo="Perdas de energia · técnicas e não técnicas"
          titulo="Qual parte das perdas é técnica e qual é não técnica?"
          referencia={<ReferenciaPerdas g={g} />}
        >
          Pela definição da ANEEL, a perda total se divide em <Termo slug="perdas-tecnicas">técnica</Termo>, inevitável no transporte da energia, e{" "}
          <Termo slug="perdas-nao-tecnicas">não técnica</Termo>, a diferença entre a total e a técnica. As duas são estimativas: a técnica do SAMP é o percentual regulatório aplicado à energia
          injetada, e a não técnica herda essa estimativa.
        </CabecalhoModulo>
        <PerdasNavegacao atual="composicao" />

        <ModoProfundidade>
          <Bloco id="composicao">
            <PainelEvidencia
              id="painel-composicao"
              pergunta="Qual parte das perdas é técnica e qual é não técnica?"
              subtitulo={`Técnicas e não técnicas · % da energia injetada e % do mercado de baixa tensão · ${ref}`}
              natureza="ESTIMADO"
              proveniencia={g.proveniencia.separacao}
              complementares={[{ rotulo: "Taxas com denominador explícito", p: g.proveniencia.taxas }]}
              porQueImporta={
                <>
                  As duas parcelas têm causas e tratamentos diferentes: a técnica depende da rede (extensão, tensão, carregamento); a não técnica, de furto, fraude, medição e faturamento. A ANEEL
                  regula as duas com referências próprias.
                </>
              }
              oQueMudou={
                <>
                  Com o leiaute novo do SAMP, a partir de {ANO_LEIAUTE_SAMP}, menos distribuidoras publicam a separação: {cobertura ?? `sem linha nacional das concessionárias em ${ref}.`}{" "}
                  {uf.anos.length > 1
                    ? `Nas mesmas ${uf.n_distribuidoras} concessionárias de ${uf.anos[0]} a ${uf.anos[uf.anos.length - 1]}, a série de universo fixo mostra a tendência sem mudança de composição.`
                    : "Sem série de universo fixo com mais de um ano."}
                </>
              }
              comoInterpretar={
                <>
                  Técnica e não técnica sobre a mesma energia injetada somam a taxa total quando a decomposição fecha; por isso só essas distribuidoras estão nas barras. A não técnica sobre o mercado de
                  baixa tensão (a base da regulação) tem outro denominador e nunca é somada à técnica. A técnica do SAMP é o percentual regulatório aplicado à injetada: estimativa, não medição.
                </>
              }
              naoConcluir={
                <>
                  Que perda não técnica seja só furto (inclui erros de medição, leitura e faturamento); que a tendência nacional da separação depois de {ANO_LEIAUTE_SAMP} valha para todas as distribuidoras (só o universo
                  fixo é comparável); que toda perda técnica possa ser eliminada.
                </>
              }
            >
              <Resposta prova={<ComproveNumero evidencia={ev.pnt_bt_nacional} rotulo={`Comprove a não técnica de ${ref}`} />}>{respostaComposicao(g)}</Resposta>
              <Recorte
                periodo={`${ref} (barras e tabela); ${inicioSerie} a ${ref} (série nacional)`}
                universo={`concessionárias e permissionárias com o ano completo, sem alerta e com a decomposição fechando (${composicao.linhas.length} distribuidoras nas barras)`}
                unidade="% da energia injetada de referência; não técnica também em % do mercado de baixa tensão medido"
              />
              <PerdasComposicao
                linhas={composicao.linhas}
                ids={ids}
                rotulos={rotulos}
                motivos={motivosComposicao(g.distribuidoras, ref)}
                anoRef={ref}
                taxaNacional={nac?.taxa_total_pct ?? null}
                urlAnual={g.series.anual}
                versao={versao}
              />
              <p className="mt-3 text-xs text-carvao-muted">
                Fora das barras em {ref}: {composicao.semSeparacao} distribuidoras válidas sem a separação publicada em todos os meses e {composicao.fora} com a decomposição que não fecha.
              </p>
              <div data-nivel="analisar" className="mt-6 space-y-4">
                <h3 className="font-serif text-lg text-carvao">Separação nacional das concessionárias, com cobertura</h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <GraficoLinhas
                    titulo="Perdas técnicas das concessionárias que publicam a técnica"
                    dados={serieNacional(g.nacional)}
                    chaveX="ano"
                    formatoX="texto"
                    series={[{ id: "tecnica", rotulo: "Técnicas", cor: "var(--escala-seq-4)" }]}
                    unidade="% da energia injetada"
                    casas={2}
                    zeroNoEixo
                    marcos={marcaLeiauteSeparacao(g.nacional, "tecnica")}
                    altura={240}
                  />
                  <GraficoLinhas
                    titulo="Perdas não técnicas das concessionárias com a separação fechando"
                    dados={serieNacional(g.nacional)}
                    chaveX="ano"
                    formatoX="texto"
                    series={[{ id: "pnt_bt", rotulo: "Não técnicas", cor: "var(--serie-termica)" }]}
                    unidade="% do mercado de baixa tensão"
                    casas={2}
                    zeroNoEixo
                    marcos={marcaLeiauteSeparacao(g.nacional, "pnt_bt")}
                    altura={240}
                  />
                </div>
                <TabelaDados
                  titulo="Separação nacional por ano, com o universo de cada medida"
                  colunas={["Ano", "Com técnica", "Cobertura da injetada (%)", "Técnicas (% injetada)", "Técnicas (% injetada publicada)", "Com não técnica", "Cobertura da BT (%)", "Não técnicas (% BT)", "Mesmo universo da não técnica"]}
                  linhas={linhasSeparacaoNacional(g.nacional)}
                  casas={[0, 0, 1, 2, 2, 0, 1, 2, null]}
                  limite={40}
                  csv="/energia/series/perdas_nacional.csv"
                />
                <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Série de universo fixo (tabela rolável)">
                  <table className="w-full min-w-[32rem] border-collapse text-sm tabular-nums">
                    <caption className="mb-2 text-left text-sm text-carvao">
                      Universo fixo: as mesmas {uf.n_distribuidoras} concessionárias de {uf.anos[0]} a {uf.anos[uf.anos.length - 1]} ({uf.criterio}).
                    </caption>
                    <thead>
                      <tr className="text-left text-mineral">
                        {["Ano", "Perdas totais (% injetada)", "Técnicas (% injetada)", "Não técnicas (% BT)", "Não técnicas (GWh)", "Cobertura da BT das válidas (%)"].map((c) => (
                          <th key={c} scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uf.linhas.map((l) => (
                        <tr key={l.ano} className="border-b border-linha">
                          <th scope="row" className="px-2 py-1 text-left font-normal">
                            {l.ano}
                          </th>
                          <td className="px-2 py-1">{numOu(l.taxa_total_pct, 2)}</td>
                          <td className="px-2 py-1">{numOu(l.taxa_tecnica_pct, 2)}</td>
                          <td className="px-2 py-1">{numOu(l.pnt_bt_pct, 2)}</td>
                          <td className="px-2 py-1">{numOu(l.pnt_mwh === null ? null : l.pnt_mwh / 1000, 0)}</td>
                          <td className="px-2 py-1">{numOu(l.cobertura_bt_pct, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <RodapePainel
                ancora="composicao"
                proxima={{ pergunta: "Como o realizado se compara à referência regulatória?", href: "/setor-eletrico/perdas/regulatorio" }}
                downloads={[
                  { rotulo: "Por distribuidora e ano (CSV)", url: "/energia/series/perdas_distribuidoras.csv" },
                  { rotulo: "Balanço mensal para auditoria (CSV)", url: "/energia/series/perdas_mensal.csv" },
                ]}
              />
            </PainelEvidencia>
          </Bloco>

          <PerdasAuditoria g={g} />
        </ModoProfundidade>
      </main>
    </>
  );
}
