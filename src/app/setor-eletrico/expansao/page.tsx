import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import {
  ExpansaoCapitulos,
  ExpansaoDatas,
  ExpansaoIndisponivel,
  ExpansaoNavegacao,
  ExpansaoNota,
  ExpansaoRecorte,
} from "@/components/energia/ExpansaoPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, datasLegiveis } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  NOTA_ETAPAS,
  PERGUNTA_CAPACIDADE,
  PERGUNTA_EXPANSAO,
  ROTA_EXPANSAO,
  capacidadeNoCenario,
  dataTexto,
  inteiro,
  linhasRalieTipoNoGrafico,
  metricasEtapas,
  mesTexto,
  mudancaCarteira,
  notaEtapa,
  notaRetratosSigaRalie,
  painel,
  respostaCarteira,
  respostaCenarios,
  respostaCronograma,
  respostaSintese,
  respostaTransmissao,
  ressalvaLegivel,
  rotaPainel,
  ultimaConfiabilidade,
  vereditoCarteira,
  vereditoCenarios,
  vereditoCronograma,
  vereditoSintese,
  vereditoTransmissao,
  type MetricaEtapa,
  provenienciasDoLeitor,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Expansão da oferta e da rede: carteira, cronograma, transmissão e cenários",
  description:
    "O que está sendo construído: usinas em operação (potência fiscalizada), em construção e com obra não iniciada (potência outorgada) no SIGA e no RALIE da ANEEL, cronograma com data-base e o que atrasou, obras e leilões de transmissão ao lado da geração, e o PDE 2035 como cenário, com um painel completo para cada pergunta.",
  alternates: { canonical: "/setor-eletrico/expansao" },
};

/** Cor de identificação de cada etapa na faixa de métricas (a mesma dos gráficos da carteira); nunca é cor de texto. */
const COR_ETAPA: Record<string, string> = {
  operacao: "var(--cor-mineral)",
  construcao: "var(--cor-energia)",
  construcao_nao_iniciada: "var(--serie-comp-3)",
};

/** As três camadas do módulo e as unidades que nunca se somam: definições que acompanham a abertura, depois da informação. */
const CAMADAS = [
  ["Realizado", "O que já opera e o que entrou: usinas em operação no SIGA, liberações para operação comercial e obras de transmissão energizadas no SIGET."],
  ["Carteira", "O que está outorgado ou em obra, com a previsão da fiscalização datada pela fotografia do RALIE, e as obras de transmissão em andamento."],
  ["Cenário", "O Plano Decenal de Expansão: o que o planejamento oficial supõe para os próximos dez anos, com data-base e hipóteses da edição. Não é previsão."],
] as const;
const UNIDADES = [
  ["MW", "Potência de geração. Não é energia (MWh) nem garantia física."],
  ["km de circuito", "Extensão das linhas no SIGET: linha de circuito duplo conta cada circuito."],
  ["km de traçado", "Comprimento da geometria das linhas no mapa da EPE."],
  ["MVA", "Capacidade de transformação das subestações, sem o transformador reserva."],
  ["R$ nominais", "Investimento previsto e receita anual dos leilões, na moeda da data de cada leilão."],
] as const;

/**
 * Abertura da Expansão: o que está sendo construído, com operação, obras e obra não iniciada em etapas separadas (potência
 * fiscalizada de um lado, outorgada do outro, sem total), a carteira por fonte no retrato do RALIE com a data própria, e as quatro
 * perguntas das páginas, cada uma com a resposta curta derivada da gold, o limite da leitura e o caminho para o painel completo
 * (mapa, séries, tabelas, downloads, modos Analisar e Auditar). A página não repete os gráficos dos painéis.
 */
export default function ExpansaoPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const ref = g.referencias;
  const ev = g.evidencias;
  const r = g.estagios.ralie;
  const p = provenienciasDoLeitor(g);
  const etapas = metricasEtapas(g);
  const dataSiga = dataTexto(g.estagios.data_referencia);
  const conf = ultimaConfiabilidade(g);
  const cenario = capacidadeNoCenario(g);
  const evidenciaDe = (m: MetricaEtapa) => (m.id === "operacao" ? ev.capacidade_total : m.id === "construcao_nao_iniciada" ? ev.outorgado_sem_obra : undefined);
  const enderecoAbertura = `${ROTA_EXPANSAO}#chegando`;
  const oQueMudou = mudancaCarteira(g);
  const comoInterpretar = (
    <>
      Potência fiscalizada é a que a ANEEL registra para a usina em operação; potência outorgada é a do ato de outorga, usada em construção e obra não iniciada. As etapas são fases do SIGA e
      não se somam. O RALIE é o acompanhamento da fiscalização das unidades geradoras em implantação, com data própria: não é o mesmo retrato do SIGA.
    </>
  );
  const naoConcluir = (
    <>
      Que a carteira vá virar capacidade em operação, nem em que prazo. Também não permite somar a carteira ao parque em operação, nem converter MW em energia ou em garantia física.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SIGA", "RALIE", "PDE", "ANEEL", "EPE", "SIGET"]}
          titulo={PERGUNTA_EXPANSAO}
          lead="Operação, obras e obra não iniciada em etapas separadas, cada uma na sua medida."
          recorte={`SIGA de ${dataSiga} · RALIE de ${dataTexto(r.data_ralie)} · MW`}
          fonte="ANEEL, SIGA e RALIE"
          referencia={
            <>
              SIGA da ANEEL de {dataTexto(ref.siga)}; RALIE na fotografia de {dataTexto(ref.ralie)} (histórico desde {dataTexto(ref.ralie_historico_desde)}); liberações comerciais até{" "}
              {dataTexto(ref.liberacoes_ultima_data)}; atos de outorga até {dataTexto(ref.atos)}; SIGET de {dataTexto(ref.siget)}; leilões de transmissão até {dataTexto(ref.leiloes_transmissao)};
              linhas da EPE capturadas em {dataTexto(ref.rede_epe_capturada_em)}; {ref.pde}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <ExpansaoDatas
              itens={[
                { rotulo: "SIGA", texto: `até ${dataSiga}`, natureza: "OBSERVADO" },
                { rotulo: "RALIE", texto: `fotografia de ${dataTexto(ref.ralie)}, histórico desde ${dataTexto(ref.ralie_historico_desde)}`, natureza: "OBSERVADO" },
                { rotulo: "Liberações comerciais", texto: `até ${dataTexto(ref.liberacoes_ultima_data)}`, natureza: "OBSERVADO" },
                { rotulo: "Atos de outorga", texto: `até ${dataTexto(ref.atos)}`, natureza: "OBSERVADO" },
                { rotulo: "SIGET", texto: `até ${dataTexto(ref.siget)}`, natureza: "OBSERVADO" },
                { rotulo: "Leilões de transmissão", texto: `até ${dataTexto(ref.leiloes_transmissao)}`, natureza: "OBSERVADO" },
                { rotulo: "Linhas da EPE", texto: `capturadas em ${dataTexto(ref.rede_epe_capturada_em)}`, natureza: "OBSERVADO" },
                { rotulo: "Plano decenal", texto: ref.pde, natureza: "CENARIO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo="Indicadores da expansão" nota={NOTA_ETAPAS}>
              {etapas.map((m) => (
                <Numero
                  key={m.id}
                  variante="faixa"
                  rotulo={m.rotulo}
                  natureza="CALCULADO"
                  valor={m.mw}
                  evidencia={evidenciaDe(m) ?? null}
                  formato="num"
                  casas={1}
                  unidade="MW"
                  periodo={`SIGA de ${dataSiga}`}
                  cor={COR_ETAPA[m.id]}
                  nota={notaEtapa(m)}
                  motivoAusencia="Sem a soma do SIGA nesta publicação."
                  endereco={enderecoAbertura}
                />
              ))}
              <Numero
                variante="faixa"
                rotulo="Prevista e liberada em 12 meses"
                natureza="CALCULADO"
                evidencia={ev.confiabilidade_ultima ?? null}
                formato="pct"
                casas={1}
                unidade="da potência prevista"
                periodo={conf ? `previsões de ${dataTexto(conf.ralie)}` : undefined}
                cor="var(--serie-referencia)"
                nota="Coorte passada, não probabilidade."
                motivoAusencia="Sem janela de 12 meses encerrada nesta publicação."
                endereco={`${rotaPainel("p041")}#p041`}
              />
            </FaixaMetricas>
          }
        >
          O que está outorgado e em obra, quando deve entrar, se a rede acompanha e como o planejamento oficial enxerga a matriz. Carteira, cronograma e cenário aparecem separados do que já
          opera: outorga não é obra, obra não é entrada certa e cenário não é previsão.
        </CabecalhoModulo>
        <ExpansaoNavegacao atual="sintese" />

        <ModoProfundidade>
          <Bloco id="expansao">
            <PainelEvidencia
              id="chegando"
              pergunta={PERGUNTA_CAPACIDADE}
              subtitulo="Unidades geradoras em implantação acompanhadas pela fiscalização da ANEEL, por tipo de geração · MW · fotografia do RALIE"
              porQueImporta={
                <>
                  A carteira mostra o que pode vir a operar e de que fontes, em escala com o que já opera. Outorga e obra não garantem a entrada em operação: parte das outorgas já foi
                  revogada ou extinta, e o desfecho de cada grupo de usinas está na página da carteira.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={p.ralie}
              complementares={[
                { rotulo: "Etapas do SIGA", p: p.estagios },
                { rotulo: "Previsões liberadas no prazo", p: p.confiabilidade },
              ]}
            >
              <div className="space-y-6">
                <div className="grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-start">
                  <Numero
                    variante="faixa"
                    rotulo="Unidades em implantação no RALIE"
                    natureza="CALCULADO"
                    evidencia={ev.ralie_em_implantacao ?? null}
                    casas={1}
                    unidade="MW"
                    periodo={`RALIE de ${dataTexto(r.data_ralie)}`}
                    cor="var(--cor-energia)"
                    nota="Potência das unidades geradoras acompanhadas pela fiscalização; não é energia nem garantia física."
                    motivoAusencia="Sem a fotografia do RALIE nesta publicação."
                    endereco={enderecoAbertura}
                  />
                  <GraficoBarras
                    titulo={`Carteira em implantação por tipo de geração, fotografia do RALIE de ${dataTexto(r.data_ralie)} (MW das unidades)`}
                    dados={linhasRalieTipoNoGrafico(g)}
                    chaveCategoria="id"
                    chaveRotulo="tipo"
                    series={[{ id: "mw", rotulo: "Unidades em implantação", cor: "var(--cor-energia)" }]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                </div>
                {/* a faixa de cima já traz os números; a resposta vem depois da figura para que ela comece na primeira tela */}
                <RespostaCurta id="sintese" depois veredito={vereditoSintese(g) || respostaSintese(g)}>
                  {respostaSintese(g)}
                </RespostaCurta>
                <ExpansaoNota>{notaRetratosSigaRalie(g)}</ExpansaoNota>
                <ExpansaoRecorte
                  periodo={
                    <>
                      RALIE de {dataTexto(r.data_ralie)} (carteira em implantação); SIGA de {dataSiga} (etapas)
                    </>
                  }
                  universo={
                    <>
                      {inteiro(r.usinas)} usinas e {inteiro(r.ugs)} unidades geradoras no RALIE; usinas do SIGA nas fases Operação, Construção e Construção não iniciada
                    </>
                  }
                  unidade="MW de potência: das unidades em implantação (RALIE), outorgada (construção e obra não iniciada) e fiscalizada (operação); não é energia"
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <ExpansaoCapitulos
                  itens={[
                    {
                      id: "p040",
                      resposta: (
                        <RespostaCurta id="p040" tamanho="sm" veredito={vereditoCarteira(g) || respostaCarteira(g)}>
                          {respostaCarteira(g)}
                        </RespostaCurta>
                      ),
                      contexto: (
                        <>
                          Fases do SIGA de {dataSiga}; desfecho das usinas acompanhadas pelo RALIE desde {dataTexto(ref.ralie_historico_desde)}; outorgas encerradas desde{" "}
                          {g.estagios.encerramentos.desde}.
                        </>
                      ),
                      limite: "quanto da carteira atual vai entrar: o desfecho dos grupos de usinas de anos anteriores não é probabilidade para a carteira atual.",
                    },
                    {
                      id: "p041",
                      resposta: (
                        <RespostaCurta id="p041" tamanho="sm" veredito={vereditoCronograma(g) || respostaCronograma(g)}>
                          {respostaCronograma(g)}
                        </RespostaCurta>
                      ),
                      contexto: (
                        <>
                          Previsões da fotografia de {dataTexto(g.cronograma.data_ralie)}; confiabilidade nas {g.cronograma.confiabilidade.length} fotografias mensais com a janela de 12 meses
                          encerrada, desde {dataTexto(g.cronograma.confiabilidade[0]?.ralie)}, contra as liberações até {dataTexto(ref.liberacoes_ultima_data)}.
                        </>
                      ),
                      limite: "a data provável de cada usina: boa parte da carteira tem previsão numa data convencional atribuída em bloco.",
                    },
                    {
                      id: "p042",
                      resposta: (
                        <RespostaCurta id="p042" tamanho="sm" veredito={vereditoTransmissao(g) || respostaTransmissao(g)}>
                          {respostaTransmissao(g)}
                        </RespostaCurta>
                      ),
                      numero: (
                        <Numero
                          variante="faixa"
                          rotulo="Linhas novas em obras de transmissão em andamento"
                          natureza="CALCULADO"
                          evidencia={ev.transmissao_em_andamento ?? null}
                          casas={1}
                          cor="var(--serie-comp-2)"
                          endereco={`${rotaPainel("p042")}#p042`}
                          motivoAusencia="Sem o SIGET nesta publicação."
                        />
                      ),
                      contexto: (
                        <>
                          SIGET de {dataTexto(g.transmissao.obras.data_referencia)}; leilões de transmissão até o {g.transmissao.leiloes.ultimo_leilao.leilao ?? "último do arquivo"} (
                          {dataTexto(g.transmissao.leiloes.ultimo_leilao.data)}); rede da EPE capturada em {dataTexto(ref.rede_epe_capturada_em)}; por UF e por ano.
                        </>
                      ),
                      limite: "se a rede é suficiente para escoar a geração de uma UF: isso depende do desenho da rede (topologia) e dos limites dela, não de km ou MVA.",
                    },
                    {
                      id: "p043",
                      resposta: (
                        <RespostaCurta id="p043" tamanho="sm" veredito={vereditoCenarios(g) || respostaCenarios(g)}>
                          {respostaCenarios(g)}
                        </RespostaCurta>
                      ),
                      numero: (
                        <Numero
                          variante="faixa"
                          rotulo={`Capacidade nacional em ${mesTexto(cenario.fim?.ref)} no cenário de referência`}
                          natureza="CENARIO"
                          evidencia={ev.pde_capacidade_2035 ?? null}
                          casas={1}
                          cor="var(--serie-comp-4)"
                          endereco={`${rotaPainel("p043")}#p043`}
                          motivoAusencia="Sem a Figura 3-25 nesta publicação."
                        />
                      ),
                      contexto: (
                        <>
                          {g.cenarios.edicao}, data-base {g.cenarios.data_base_premissas}, horizonte {g.cenarios.horizonte}; realizado do SIGA e carteira do RALIE em camadas separadas.
                        </>
                      ),
                      limite: "que o cenário vai se realizar, nem que a distância entre o cenário e o realizado é atraso: as categorias não coincidem uma a uma.",
                    },
                  ]}
                />

                <SecaoDoPainel id="camadas" titulo="Três camadas e cinco unidades que não se misturam">
                  <ul className="grid gap-x-8 gap-y-4 md:grid-cols-3">
                    {CAMADAS.map(([n, d]) => (
                      <li key={n} className="border-l-2 border-linha pl-4">
                        <p className="rotulo text-mineral">{n}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</p>
                      </li>
                    ))}
                  </ul>
                  <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
                    {UNIDADES.map(([n, d]) => (
                      <li key={n} className="border-l-2 border-linha pl-4">
                        <p className="rotulo text-mineral">{n}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</p>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                {g.ressalvas.length > 0 && (
                  <SecaoDoPainel id="ressalvas" titulo="Ressalvas da validação desta publicação" nivel="analisar">
                    <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                      {g.ressalvas.map((x) => {
                        const rv = ressalvaLegivel(datasLegiveis(x));
                        return (
                          <li key={x}>
                            {rv.texto}
                            {rv.campo && <span data-nivel="auditar"> Campo da base publicada: {rv.campo}.</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </SecaoDoPainel>
                )}

                <div id="arquivos" className="scroll-mt-28">
                  <SeguirPainel
                    ancora="chegando"
                    proximo={{ href: rotaPainel("p040"), pergunta: painel("p040").pergunta }}
                    downloads={g.downloads}
                    extra={<p className="max-w-prose2 pb-1 text-xs text-carvao-muted">CSV com ponto e vírgula, ponto decimal e campo vazio para ausência; os JSON são lidos pelos mapas sob demanda.</p>}
                  />
                </div>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
