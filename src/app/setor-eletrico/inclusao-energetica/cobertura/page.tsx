import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { InclusaoAnalise, InclusaoAuditoria, InclusaoIndisponivel, InclusaoNavegacao, InclusaoRecorte, InclusaoSeguir, InclusaoSubtitulo } from "@/components/energia/InclusaoPagina";
import { InclusaoCoberturaUf, InclusaoMunicipiosCobertura, InclusaoSerieCobertura } from "@/components/energia/InclusaoCobertura";
import { Numero } from "@/components/energia/Numero";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  FONTE_COB,
  inteiro,
  linhasHistogramaMunicipios,
  mes,
  mudancaCobertura,
  numTexto,
  respostaCobertura,
  rotaPainel,
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
  const mesMapa = g.tarifa_social.mes_mapa ?? g.tarifa_social.mes_referencia;
  const dist = c.distribuicao_municipal;
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));

  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <MarcaVisita secao="energia:inclusao-cobertura" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Inclusão energética"
          titulo="Cobertura potencial da Tarifa Social"
          referencia={
            <>
              Faturas com desconto dos arquivos de Beneficiários da CDE de {mes(g.tarifa_social.mes_mapa)}; Cadastro Único (MI Social) de {mes(c.brasil?.mes)}; série nacional com o SCS até{" "}
              {mes(c.serie_mensal_ultimo?.m)}. Regra de elegibilidade conferida em {dataBR(c.regra_elegibilidade.consultado_em)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quantas faturas com Tarifa Social existem para cada 100 famílias que têm direito pelo critério de renda. É uma proxy, com nome e limites declarados: as bases públicas
          contam faturas de um lado e famílias do outro.
        </CabecalhoModulo>
        <InclusaoNavegacao atual="p060" />
        <ModoProfundidade>
          <Bloco id="cobertura">
            <PainelEvidencia
              id="p060"
              pergunta={c.pergunta}
              subtitulo="Faturas com Tarifa Social por 100 famílias do Cadastro Único com renda por pessoa até ½ salário mínimo · proxy"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Comparar quem recebe o desconto da <Termo slug="tarifa-social">Tarifa Social</Termo> com quem tem direito pelo critério de renda mostra onde o benefício pode não estar chegando. Como as bases públicas contam coisas
                  diferentes, a comparação só pode ser uma proxy, e é publicada como tal.
                </>
              }
              oQueMudou={mudancaCobertura(c)}
              comoInterpretar={
                <>
                  Razão = 100 × faturas com desconto ÷ famílias do Cadastro Único com renda por pessoa até meio salário mínimo, no mesmo mês. O denominador com cadastro atualizado
                  segue o requisito da concessão; com todas as cadastradas, a razão cai. As duas formam uma faixa de sensibilidade à definição do denominador, não um intervalo
                  estatístico. {c.faixa_de_sensibilidade}
                </>
              }
              naoConcluir={
                <>
                  Não é a proporção de famílias elegíveis atendidas e não diz quantas famílias estão fora: fatura não é família, a família pode não ser titular da conta, o numerador
                  inclui quem recebe pelo BPC ou por equipamento médico (o que permite à razão passar de 100 sem erro de cálculo) e famílias sem ligação à rede contam só no denominador.
                </>
              }
              proveniencia={c.proveniencia.cobertura}
            >
              <div className="space-y-6">
                <p className="inline-flex items-center gap-2 border border-carvao px-3 py-1 text-sm text-carvao">
                  <span className="rotulo">Proxy</span>
                  <span>medida indireta, com denominador elegível só pelo critério de renda</span>
                </p>
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p060">
                  {respostaCobertura(c)}
                </p>
                <InclusaoRecorte
                  periodo={
                    <>
                      Mapa e UF em {mes(c.brasil?.mes)}; série nacional de {c.serie_mensal_meses} meses até {mes(c.serie_mensal_ultimo?.m)}
                    </>
                  }
                  universo={
                    <>
                      {c.ufs.length} UF; {dist ? `${inteiro(dist.municipios)} municípios na distribuição (${dist.base_pequena_excluidos} fora por base pequena)` : "municípios sem dado"}
                    </>
                  }
                  unidade="faturas (ou UC na série do SCS) por 100 famílias"
                />
                <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_1fr]">
                  <Numero
                    rotulo="Por 100 famílias com cadastro atualizado"
                    natureza="CALCULADO"
                    evidencia={c.brasil?.evidencia ?? null}
                    casas={1}
                    unidade="faturas por 100 famílias"
                    tamanho="medio"
                    motivoAusencia="Sem cruzamento nesta publicação."
                    endereco={`${rotaPainel("p060")}#p060`}
                  />
                  {/* a outra ponta da faixa não tem ficha própria na gold: fica como leitura de sensibilidade, não como número de destaque sem prova */}
                  {c.brasil && (
                    <div className="space-y-2 border border-linha bg-superficie p-5 text-sm leading-relaxed text-carvao">
                      <p className="rotulo text-mineral">Sensibilidade ao denominador</p>
                      <p>
                        Com todas as famílias cadastradas nessa renda ({inteiro(c.brasil.familias_cadastradas)} em vez de {inteiro(c.brasil.familias_atualizadas)} com cadastro atualizado), o
                        mesmo numerador dá {numTexto(c.brasil.razao_cadastradas_pct, 1)} faturas por 100 famílias em {mes(c.brasil.mes)}. As duas razões são as pontas da faixa no gráfico por UF.
                      </p>
                      <p className="text-carvao-muted">
                        As famílias cadastradas por município estão em{" "}
                        <a href="/energia/series/inclusao_municipios.csv" download className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                          inclusao_municipios.csv
                        </a>
                        , que soma o total nacional.
                      </p>
                    </div>
                  )}
                </div>
                <InclusaoCoberturaUf ufs={c.ufs} mes={c.brasil?.mes ?? mesMapa} fonte={FONTE_COB} />

                {dist && (
                  <>
                    <InclusaoSubtitulo>Como a razão se distribui entre os municípios?</InclusaoSubtitulo>
                    <GraficoBarras
                      titulo={`Municípios por faixa de faturas por 100 famílias atualizadas, ${mes(c.brasil?.mes)}`}
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
                      Faixas de larguras diferentes (a primeira vai de {num(dist.histograma[0]?.de, 0)} a {num(dist.histograma[0]?.ate, 0)}). Quantis: P10 {num(dist.quantis.p10, 1)}, P25 {num(dist.quantis.p25, 1)}, mediana {num(dist.quantis.p50, 1)}, P75{" "}
                      {num(dist.quantis.p75, 1)}, P90 {num(dist.quantis.p90, 1)}. {inteiro(dist.base_pequena_excluidos)} municípios ficam fora por base pequena; {inteiro(dist.acima_de_100)}{" "}
                      passam de 100.
                    </p>
                  </>
                )}

                <InclusaoAnalise titulo="A razão ao longo do tempo (numerador do SCS, meses completos)">
                  <InclusaoSerieCobertura url={c.serie_mensal_json} unidade="UC por 100 famílias" />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Série com UC do SCS no numerador; o ponto de {mes(c.brasil?.mes)} acima usa faturas da CDE. Meses incompletos do SCS ficam fora da série.
                  </p>
                </InclusaoAnalise>

                <InclusaoAnalise titulo="Por município">
                  <InclusaoMunicipiosCobertura csvUrl="/energia/series/inclusao_municipios.csv" mes={c.brasil?.mes ?? mesMapa} fonte={FONTE_COB} />
                </InclusaoAnalise>

                <InclusaoAuditoria titulo="Regra de elegibilidade e por que a medida é proxy">
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
                </InclusaoAuditoria>

                <InclusaoSeguir
                  ancora="p060"
                  href={rotaPainel("p061")}
                  pergunta={g.orcamento.pergunta}
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
