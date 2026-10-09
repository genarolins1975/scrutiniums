import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { InclusaoDatas, InclusaoIndisponivel, InclusaoNavegacao, InclusaoRecorte, InclusaoSeguir } from "@/components/energia/InclusaoPagina";
import { InclusaoCoberturaUf, InclusaoMunicipiosCobertura, InclusaoSerieCobertura } from "@/components/energia/InclusaoCobertura";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  datasMedidas,
  FONTE_COB,
  inteiro,
  linhasHistogramaMunicipios,
  mes,
  mudancaCobertura,
  respostaCobertura,
  rotaPainel,
  vereditoCobertura,
} from "@/lib/energia/inclusao";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Cobertura potencial da Tarifa Social (proxy)",
  description:
    "Faturas com Tarifa Social por 100 famílias do Cadastro Único com renda por pessoa até meio salário mínimo, por UF e município, com a faixa de sensibilidade ao denominador e a regra de elegibilidade vigente. Proxy declarada, não taxa de cobertura.",
  alternates: { canonical: "/setor-eletrico/inclusao-energetica/cobertura" },
};

export default function CoberturaPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cobertura;
  const b = c.brasil;
  const mesMapa = g.tarifa_social.mes_mapa ?? g.tarifa_social.mes_referencia;
  const mesCob = b?.mes ?? mesMapa;
  const dist = c.distribuicao_municipal;
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));
  const evidenciaFaturas = g.tarifa_social.kpis.faturas_cde_mapa?.evidencia ?? null;
  const oQueMudou = mudancaCobertura(c);
  const comoInterpretar = (
    <>
      Razão = 100 × faturas com desconto ÷ famílias do Cadastro Único com renda por pessoa até meio salário mínimo, no mesmo mês. O denominador com cadastro atualizado segue o requisito da
      concessão; com todas as cadastradas, a razão cai. As duas formam uma faixa de sensibilidade à definição do denominador. {c.faixa_de_sensibilidade}
    </>
  );
  const naoConcluir = (
    <>
      Não é a proporção de famílias elegíveis atendidas e não diz quantas famílias estão fora: fatura não é família, a família pode não ser titular da conta, o numerador inclui quem recebe pelo
      BPC ou por equipamento médico (o que permite à razão passar de 100 sem erro de cálculo) e famílias sem ligação à rede contam só no denominador. A pergunta &ldquo;{c.pergunta}&rdquo; não
      tem resposta nesta razão.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <MarcaVisita secao="energia:inclusao-cobertura" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <InclusaoNavegacao atual="p060" />
        <CabecalhoModulo
          siglas={["UC", "CDE", "REN", "IBGE", "ANEEL", "MME"]}
          rotulo="Inclusão energética"
          titulo="Cobertura potencial da Tarifa Social"
          lead="Faturas com Tarifa Social para cada 100 famílias do Cadastro Único com renda por pessoa até meio salário mínimo. É uma proxy: fatura não é família."
          recorte={`${mes(mesCob)} · ${c.ufs.length} UF e municípios · faturas por 100 famílias`}
          fonte="ANEEL, Beneficiários da CDE; MDS, Cadastro Único (MI Social)"
          referencia={
            <>
              Faturas com desconto dos arquivos de Beneficiários da CDE de {mes(g.tarifa_social.mes_mapa)}; Cadastro Único (MI Social) de {mes(b?.mes)}; série nacional com o SCS até{" "}
              {mes(c.serie_mensal_ultimo?.m)}. Regra de elegibilidade conferida em {dataBR(c.regra_elegibilidade.consultado_em)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={<InclusaoDatas itens={datasMedidas(g).filter((d) => d.id === "cde" || d.id === "cadunico" || d.id === "scs")} />}
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo="Indicadores da cobertura potencial"
              nota="A razão é 100 × faturas ÷ famílias, no mesmo mês. Fatura e família são unidades diferentes, e o denominador usa só o critério de renda: por isso é uma proxy, e não a proporção de famílias atendidas."
            >
              <Numero
                variante="faixa"
                rotulo="Faturas por 100 famílias, cadastro atualizado (proxy)"
                natureza="CALCULADO"
                evidencia={b?.evidencia ?? null}
                casas={1}
                unidade="por 100 famílias"
                cor="var(--cor-energia)"
                motivoAusencia="Sem cruzamento nesta publicação."
                endereco={`${rotaPainel("p060")}#p060`}
              />
              <Numero
                variante="faixa"
                rotulo="Faturas por 100 famílias, todas as cadastradas (proxy)"
                natureza="CALCULADO"
                valor={b?.razao_cadastradas_pct ?? null}
                casas={1}
                unidade="por 100 famílias"
                periodo={b ? mes(b.mes) : undefined}
                cor="var(--serie-referencia)"
                motivoAusencia="Sem cruzamento nesta publicação."
              />
              <Numero
                variante="faixa"
                rotulo="Numerador: faturas com desconto (CDE)"
                natureza="CALCULADO"
                evidencia={evidenciaFaturas}
                casas={0}
                unidade="faturas"
                cor="var(--serie-comp-2)"
                motivoAusencia="Nenhum arquivo da CDE com todas as distribuidoras."
                endereco={`${rotaPainel("p059")}#p059`}
              />
              <Numero
                variante="faixa"
                rotulo="Denominador: famílias até ½ salário mínimo, cadastro atualizado"
                natureza="CALCULADO"
                valor={b?.familias_atualizadas ?? null}
                casas={0}
                unidade="famílias"
                periodo={b ? mes(b.mes) : undefined}
                cor="var(--serie-comp-3)"
                nota={b ? `Com todas as famílias cadastradas nessa renda, o denominador é ${inteiro(b.familias_cadastradas)}.` : undefined}
                motivoAusencia="Sem cruzamento nesta publicação."
              />
            </FaixaMetricas>
          }
        />
        <ModoProfundidade>
          <Bloco id="cobertura">
            <PainelEvidencia
              id="p060"
              pergunta="Faturas por 100 famílias do Cadastro Único, UF a UF"
              subtitulo="Numerador: faturas com Tarifa Social · denominador: famílias do Cadastro Único até ½ salário mínimo · proxy"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Comparar quem recebe o desconto da <Termo slug="tarifa-social">Tarifa Social</Termo> com as famílias que o critério de renda alcança mostra onde o benefício pode estar abaixo ou acima do
                  que o cadastro sugere. Como as bases públicas contam coisas diferentes, a comparação só pode ser uma proxy, e é publicada como tal.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={c.proveniencia.cobertura}
            >
              <div className="space-y-6">
                <p className="inline-flex items-center gap-2 border border-carvao px-3 py-1 text-sm text-carvao">
                  <span className="rotulo">Proxy</span>
                  <span>medida indireta, com denominador elegível só pelo critério de renda</span>
                </p>
                <InclusaoCoberturaUf
                  ufs={c.ufs}
                  mes={mesCob}
                  fonte={FONTE_COB}
                  resposta={
                    <RespostaCurta id="p060" veredito={vereditoCobertura(c)}>
                      {respostaCobertura(c)}
                    </RespostaCurta>
                  }
                  recorte={
                    <InclusaoRecorte
                      periodo={
                        <>
                          Mapa e UF em {mes(b?.mes)}; série nacional de {c.serie_mensal_meses} meses até {mes(c.serie_mensal_ultimo?.m)}
                        </>
                      }
                      universo={
                        <>
                          {c.ufs.length} UF; {dist ? `${inteiro(dist.municipios)} municípios na distribuição (${dist.base_pequena_excluidos} fora por base pequena)` : "municípios sem dado"}
                        </>
                      }
                      unidade="faturas (ou UC na série do SCS) por 100 famílias"
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                {b && (
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    As famílias cadastradas por município estão em{" "}
                    <a href="/energia/series/inclusao_municipios.csv" download className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                      famílias cadastradas por município (CSV)
                    </a>
                    , que soma o total nacional ({inteiro(b.familias_cadastradas)} famílias).
                  </p>
                )}

                {dist && (
                  <SecaoDoPainel id="municipios-distribuicao" titulo="Como a razão se distribui entre os municípios?">
                    <GraficoBarras
                      titulo={`Municípios por faixa de faturas por 100 famílias atualizadas, ${mes(b?.mes)}`}
                      dados={linhasHistogramaMunicipios(dist)}
                      chaveCategoria="id"
                      chaveRotulo="faixa"
                      series={[{ id: "municipios", rotulo: "Municípios", cor: "var(--cor-energia)" }]}
                      unidade="municípios"
                      casas={0}
                      rotulosValor
                      altura={280}
                    />
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      Faixas de larguras diferentes (a primeira vai de {num(dist.histograma[0]?.de, 0)} a {num(dist.histograma[0]?.ate, 0)}). Quantis: P10 {num(dist.quantis.p10, 1)}, P25{" "}
                      {num(dist.quantis.p25, 1)}, mediana {num(dist.quantis.p50, 1)}, P75 {num(dist.quantis.p75, 1)}, P90 {num(dist.quantis.p90, 1)}. {inteiro(dist.base_pequena_excluidos)} municípios
                      ficam fora por base pequena; {inteiro(dist.acima_de_100)} passam de 100.
                    </p>
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel
                  id="serie"
                  titulo="A razão ao longo do tempo (numerador do SCS, meses completos)"
                  lead={`Série com UC do SCS no numerador; o ponto de ${mes(b?.mes)} acima usa faturas da CDE. Meses incompletos do SCS ficam fora da série.`}
                >
                  <InclusaoSerieCobertura url={c.serie_mensal_json} unidade="UC por 100 famílias" />
                </SecaoDoPainel>

                <SecaoDoPainel id="municipios" nivel="analisar" titulo="Por município">
                  <InclusaoMunicipiosCobertura csvUrl="/energia/series/inclusao_municipios.csv" mes={mesCob} fonte={FONTE_COB} />
                </SecaoDoPainel>

                <SecaoDoPainel id="regra-elegibilidade" nivel="auditar" titulo="Regra de elegibilidade e por que a medida é proxy">
                  <p className="text-sm text-carvao-muted">
                    Conferida em {dataBR(c.regra_elegibilidade.consultado_em)} na página da ANEEL (
                    <a href={c.regra_elegibilidade.fonte} className="break-all text-energia-dark underline underline-offset-4">
                      {c.regra_elegibilidade.fonte}
                    </a>
                    ). Base legal: {c.regra_elegibilidade.base_legal}
                  </p>
                  <ul className="space-y-1 text-sm text-carvao">
                    {c.regra_elegibilidade.criterios.map((cr) => (
                      <li key={cr.id}>
                        <strong className="font-medium">Critério {cr.id}</strong> ({cr.no_denominador ? "no denominador" : "fora do denominador"}): {cr.texto}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">Requisitos: {c.regra_elegibilidade.requisitos.join(" ")}</p>
                  <p className="text-sm text-carvao-muted">Vigência: {c.regra_elegibilidade.vigencia}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {c.regra_elegibilidade.por_que_proxy.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <InclusaoSeguir
                  ancora="p060"
                  proximo={{ href: rotaPainel("p061"), pergunta: g.orcamento.pergunta }}
                  downloads={downloads(["/energia/series/inclusao_municipios.csv", "/energia/series/inclusao_cobertura_mensal.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
