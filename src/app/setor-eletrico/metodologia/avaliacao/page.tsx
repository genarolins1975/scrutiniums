import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { AvaliacaoPaginas } from "@/components/energia/AvaliacaoPaginas";
import { AvaliacaoEvolucao, AvaliacaoJornadas, AvaliacaoMatriz, AvaliacaoMetodo, AvaliacaoRevisao, AvaliacaoRubrica } from "@/components/energia/AvaliacaoPartes";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { DadosAviso, DadosIndisponivel, DadosLimitacoes, DadosNavegacao, DadosRecorte, DadosResposta, DadosSeguir, ReferenciaDados } from "@/components/energia/DadosPainel";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { COLUNAS_DEFEITOS, COLUNAS_PAGINAS, URL_AVALIACAO, compararRodadas, dadosPorDimensao, linhasDefeitos, linhasPaginas, respostaAvaliacao } from "@/lib/energia/avaliacao";
import { compactarLinhas } from "@/lib/energia/dados";
import { avaliacaoPublicada, provenienciaAvaliacao } from "@/lib/energia/avaliacao-servidor";
import { dataBR, num, plural } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

export const dynamic = "force-static";

const ENDERECO = "https://scrutiniums.com/setor-eletrico/metodologia/avaliacao#avaliacao";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/metodologia/avaliacao", {
    title: tx("Avaliação dos painéis: como demonstrar que a qualidade evoluiu", "Panel evaluation: how to show that quality has improved"),
    description: tx(
      "Nota de cada página do observatório em dez dimensões, com a evidência de cada nota, as jornadas de usuário executadas, os defeitos abertos e a evolução entre rodadas. Nota só existe com medição, teste ou revisão registrada.",
      "Score of each observatory page in ten dimensions, with the evidence for each score, the user journeys run, the open defects and the progress between rounds. A score exists only with a recorded measurement, test or review.",
    ),
    alternates: { canonical: "/setor-eletrico/metodologia/avaliacao" },
  }, anterior);
}

export default function AvaliacaoPage() {
  const a = avaliacaoPublicada();
  if (!a)
    return (
      <DadosIndisponivel
        atual="metodologia"
        motivo={tx(
          "A avaliação dos painéis (P071) ainda não foi publicada nesta versão: sem o arquivo avaliacao.json não há nota, e a página não mostra nenhuma.",
          "The panel evaluation (P071) has not yet been published in this version: without the avaliacao.json file there is no score, and the page shows none.",
        )}
      />
    );

  const r = a.resumo;
  const prov = provenienciaAvaliacao(a.proveniencia.avaliacao);
  const dims = dadosPorDimensao(a);
  const matriz = compactarLinhas(linhasPaginas(a), COLUNAS_PAGINAS.map((c) => c.id));
  const defeitos = linhasDefeitos(a.defeitos);
  const cmp = compararRodadas(a);
  const versao = a.gerado_em;
  const semNota = Object.values(r.por_dimensao).reduce((s, d) => s + d.nao_avaliadas, 0);
  const inspecao = dataBR(a.rodada.data_inspecao);

  const defeitosAnteriores = cmp ? Object.values(cmp.anterior.defeitos_por_severidade).reduce((s, v) => s + v, 0) : 0;
  const oQueMudou = cmp
    ? tx(
        <>
          Rodada anterior ({cmp.anterior.id}): {plural(cmp.anterior.atendem_meta, "página dentro", "páginas dentro")} da meta e {plural(defeitosAnteriores, "defeito aberto", "defeitos abertos")}. Nas {cmp.comuns.length} dimensões avaliadas nas duas rodadas a média foi de {num(cmp.mediaAnterior, 1)} para {num(cmp.mediaAtual, 1)};{" "}
          {plural(r.defeitos.corrigidos_desde_a_rodada_anterior, "defeito foi corrigido", "defeitos foram corrigidos")} desde então.
        </>,
        <>
          Previous round ({cmp.anterior.id}): {plural(cmp.anterior.atendem_meta, "page", "pages")} within the target and {plural(defeitosAnteriores, "open defect", "open defects")}. In the {cmp.comuns.length} dimensions assessed in both rounds the average went from {num(cmp.mediaAnterior, 1)} to {num(cmp.mediaAtual, 1)};{" "}
          {plural(r.defeitos.corrigidos_desde_a_rodada_anterior, "defect has", "defects have")} been fixed since then.
        </>,
      )
    : tx(
        <>Primeira rodada registrada: ainda não há rodada anterior, e a evolução começa a ser medida a partir desta.</>,
        <>First round recorded: there is no previous round yet, and progress starts being measured from this one.</>,
      );
  const comoInterpretar = tx(
    <>
      Cada célula da matriz é a média das notas das páginas da entrega naquela dimensão. A meta de produto é 9,0 em todas as dimensões, 9,5 em didatismo e qualidade visual, e nenhum defeito crítico; uma página só atende se nenhuma dimensão aplicável ficar sem avaliação. Célula sem número é dimensão não avaliada ou que não se aplica, e não é zero. Cada nota tem tetos escritos: o teto de acessibilidade, por exemplo, existe porque nenhum leitor de tela real foi usado.
    </>,
    <>
      Each cell of the matrix is the average of the scores of the delivery&apos;s pages in that dimension. The product target is 9.0 in every dimension, 9.5 in didactic and visual quality, and no critical defect; a page only meets it if no applicable dimension is left unassessed. A cell without a number is a dimension not assessed or not applicable, and is not zero. Each score has written caps: the accessibility cap, for example, exists because no real screen reader was used.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que uma nota alta prove que uma pessoa entende ou confia na página: a revisão visual e didática é de revisores em contexto limpo (agentes), e as jornadas são roteiros por script, sem participante humano. Que a nota de uma página amostrada valha para as outras da família. Que acessibilidade esteja certificada, ou que o desempenho de laboratório seja o de campo. Que a correção dos números tenha sido reconciliada de novo com a fonte primária nesta rodada: ela vem das validações já publicadas.
    </>,
    <>
      That a high score proves a person understands or trusts the page: the visual and didactic review is by reviewers in a clean context (agents), and the journeys are scripts, with no human participant. That the score of a sampled page applies to the others in its family. That accessibility is certified, or that lab performance is field performance. That the correctness of the numbers was reconciled again with the primary source in this round: it comes from the validations already published.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="metodologia" />
      <MarcaVisita secao="energia:dados:avaliacao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <DadosNavegacao atual="avaliacao" />
        <CabecalhoModulo
          titulo={tx("Como demonstrar que a qualidade evoluiu?", "How can we show that quality has improved?")}
          lead={tx(
            "Cada página recebe uma nota de 0 a 10 em dez dimensões, e cada nota traz a prova que a sustenta. A escala é uma ferramenta de revisão do próprio observatório, não uma certificação externa; o que não foi testado fica como não avaliado, nunca como nota.",
            "Each page gets a score from 0 to 10 in ten dimensions, and each score carries the proof behind it. The scale is a review tool of the observatory itself, not an external certification; what was not tested stays as not assessed, never as a score.",
          )}
          recorte={tx(
            `${num(r.paginas, 0)} páginas · rodada ${a.rodada.id} · inspeção de ${inspecao}`,
            `${num(r.paginas, 0)} pages · round ${a.rodada.id} · inspection of ${inspecao}`,
          )}
          fonte={tx(`Scrutiniums, avaliação dos painéis (rubrica ${a.versao_rubrica})`, `Scrutiniums, panel evaluation (rubric ${a.versao_rubrica})`)}
          referencia={
            <ReferenciaDados
              geradoEm={a.gerado_em}
              referencia={inspecao}
              extra={tx(
                <>Rodada {a.rodada.id}; dados de referência das golds em {dataBR(a.rodada.referencia_dos_dados)}.</>,
                <>Round {a.rodada.id}; reference data of the gold files on {dataBR(a.rodada.referencia_dos_dados)}.</>,
              )}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores da avaliação", "Evaluation indicators")}
              nota={tx(
                "Medidas da rodada inteira, na data da inspeção e não na do dia em que você lê; não mudam com a tabela de páginas.",
                "Measures of the whole round, on the inspection date and not on the day you read; they do not change with the page table.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Nota ponderada média", "Average weighted score")}
                natureza="CALCULADO"
                evidencia={a.evidencias.nota_media}
                valor={r.nota_ponderada_media}
                casas={1}
                unidade={tx("de 10", "out of 10")}
                periodo={inspecao}
                nota={tx(<>Média das {num(r.paginas, 0)} páginas.</>, <>Average of the {num(r.paginas, 0)} pages.</>)}
                motivoAusencia={tx("Nenhuma página com nota.", "No page with a score.")}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Páginas na meta de produto", "Pages on the product target")}
                natureza="CALCULADO"
                evidencia={a.evidencias.atendem_meta}
                valor={r.atendem_meta}
                casas={0}
                unidade={tx(`de ${num(r.paginas, 0)}`, `of ${num(r.paginas, 0)}`)}
                periodo={inspecao}
                nota={tx(<>{num(r.completas, 0)} com todas as dimensões aplicáveis avaliadas.</>, <>{num(r.completas, 0)} with all applicable dimensions assessed.</>)}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Defeitos abertos", "Open defects")}
                natureza="CALCULADO"
                evidencia={a.evidencias.defeitos}
                valor={r.defeitos.abertos}
                casas={0}
                unidade={tx("defeitos", "defects")}
                periodo={inspecao}
                nota={tx(
                  <>
                    {r.defeitos.por_severidade.critico} críticos, {r.defeitos.por_severidade.alto} altos.
                  </>,
                  <>
                    {r.defeitos.por_severidade.critico} critical, {r.defeitos.por_severidade.alto} high.
                  </>,
                )}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Jornadas cumpridas", "Journeys completed")}
                natureza="OBSERVADO"
                valor={r.jornadas.cumpridas}
                casas={0}
                unidade={tx(`de ${num(r.jornadas.total, 0)}`, `of ${num(r.jornadas.total, 0)}`)}
                periodo={inspecao}
                nota={tx(<>Roteiro por script, sem pessoas.</>, <>Scripted run, without people.</>)}
                endereco={ENDERECO}
              />
            </FaixaMetricas>
          }
        />

        <ModoProfundidade>
          <Bloco id="avaliacao">
            <PainelEvidencia
              id="painel-avaliacao"
              pergunta={tx("Em quais dimensões cada entrega chega à meta?", "In which dimensions does each delivery reach the target?")}
              subtitulo={tx(
                `${num(r.paginas, 0)} páginas · rodada ${a.rodada.id} · nota de 0 a 10 por dimensão · inspeção de ${inspecao}`,
                `${num(r.paginas, 0)} pages · round ${a.rodada.id} · score from 0 to 10 by dimension · inspection of ${inspecao}`,
              )}
              proveniencia={prov}
              porQueImporta={tx(
                <>
                  Sem uma régua publicada, qualidade vira adjetivo. Aqui cada nota nasce de uma medição em navegador, de um teste do repositório, de uma validação já publicada nas golds ou de uma revisão registrada, e a rubrica que a calcula está aberta. Quem compara duas rodadas vê o que mudou e o que ficou sem teste.
                </>,
                <>
                  Without a published yardstick, quality becomes an adjective. Here each score comes from a browser measurement, a repository test, a validation already published in the gold files or a recorded review, and the rubric that computes it is open. Whoever compares two rounds sees what changed and what was left untested.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              extraFonte={tx(<>Rubrica {a.versao_rubrica}.</>, <>Rubric {a.versao_rubrica}.</>)}
            >
              <div className="space-y-6">
                <AvaliacaoMatriz a={a} />

                <GraficoBarras
                  titulo={tx(`Nota média e menor nota de cada dimensão, rodada ${a.rodada.id}`, `Average score and lowest score of each dimension, round ${a.rodada.id}`)}
                  dados={dims.map((d) => ({ id: d.id, rotulo: d.rotulo, media: d.media, minimo: d.minimo }))}
                  chaveCategoria="id"
                  chaveRotulo="rotulo"
                  series={[
                    { id: "media", rotulo: tx("Média das páginas", "Average of the pages"), cor: "var(--escala-seq-4)" },
                    { id: "minimo", rotulo: tx("Menor nota", "Lowest score"), cor: "var(--escala-seq-2)" },
                  ]}
                  unidade={tx("nota de 0 a 10", "score from 0 to 10")}
                  casas={1}
                  orientacao="horizontal"
                  rotulosValor
                  alturaCategoria={56}
                  referencias={[
                    {
                      valor: a.rubrica.metas.geral,
                      rotulo: tx(
                        `Meta de produto (${num(a.rubrica.metas.geral, 1)}; didatismo e visual ${num(a.rubrica.metas.didatismo, 1)})`,
                        `Product target (${num(a.rubrica.metas.geral, 1)}; didactic and visual ${num(a.rubrica.metas.didatismo, 1)})`,
                      ),
                    },
                  ]}
                />
                <DadosAviso>
                  {tx(
                    "Barra ausente é dimensão sem nenhuma página avaliada, nunca nota zero. A meta de didatismo e de qualidade visual é 9,5; a linha mostra 9,0, a meta das demais dimensões.",
                    "A missing bar is a dimension with no page assessed, never a score of zero. The target for didactic and visual quality is 9.5; the line shows 9.0, the target for the other dimensions.",
                  )}
                </DadosAviso>

                <NotasDoPainel
                  oQueMudou={oQueMudou}
                  comoInterpretar={comoInterpretar}
                  naoConcluir={naoConcluir}
                  nome={tx("Em quais dimensões cada entrega chega à meta?", "In which dimensions does each delivery reach the target?")}
                />

                <DadosResposta depois painel="P071">
                  {respostaAvaliacao(a)}
                </DadosResposta>

                <DadosRecorte
                  periodo={
                    tx(
                      <>
                        inspeção de {inspecao}; golds com referência em {dataBR(a.rodada.referencia_dos_dados)}
                      </>,
                      <>
                        inspection of {inspecao}; gold files with reference on {dataBR(a.rodada.referencia_dos_dados)}
                      </>,
                    )
                  }
                  universo={tx(
                    `${num(r.paginas, 0)} de ${a.rodada.rotas_construidas === null ? "número não registrado de" : num(a.rodada.rotas_construidas, 0)} rotas construídas: todas as páginas de módulo e uma amostra de seis em cada família dinâmica (verbetes, fichas de conjuntos e de empresas)`,
                    `${num(r.paginas, 0)} of ${a.rodada.rotas_construidas === null ? "an unrecorded number of" : num(a.rodada.rotas_construidas, 0)} routes built: all module pages and a sample of six in each dynamic family (entries, dataset records and company records)`,
                  )}
                  unidade={tx(
                    "nota de 0 a 10, truncada em uma casa decimal; contagem de páginas e de defeitos",
                    "score from 0 to 10, truncated to one decimal place; count of pages and defects",
                  )}
                />
                <DadosAviso>
                  {semNota > 0
                    ? tx(
                        `${plural(semNota, "ocorrência de dimensão não avaliada", "ocorrências de dimensão não avaliada")} entre as páginas: aparece como n.av. e não satisfaz o aceite. `,
                        `${plural(semNota, "occurrence of an unassessed dimension", "occurrences of an unassessed dimension")} across the pages: shown as n.a., it does not meet acceptance. `,
                      )
                    : tx("Nenhuma dimensão aplicável ficou sem avaliação nesta rodada. ", "No applicable dimension was left unassessed in this round. ")}
                  {tx(
                    "A revisão de didatismo e de qualidade visual foi feita por revisores em contexto limpo sobre capturas abertas e o texto da página; não é teste com pessoas.",
                    "The didactic and visual quality review was done by reviewers in a clean context on open screenshots and the page text; it is not a test with people.",
                  )}
                </DadosAviso>
                {a.rodada.corrigido_depois_da_medicao.length > 0 && (
                  <DadosAviso>
                    {tx("Corrigido depois da medição e ainda não medido:", "Fixed after the measurement and not yet measured:")}{" "}
                    <TrechoPortugues regiao="avaliacao-corrigido-depois">{a.rodada.corrigido_depois_da_medicao.join(" ")}</TrechoPortugues>
                  </DadosAviso>
                )}

                <SecaoDoPainel id="paginas" nivel="analisar" titulo={tx("Nota de cada página, com a evidência", "Score of each page, with the evidence")}>
                  <AvaliacaoPaginas matriz={matriz} versao={versao} />
                </SecaoDoPainel>

                <SecaoDoPainel id="defeitos" nivel="analisar" titulo={tx("Defeitos abertos", "Open defects")}>
                  <TabelaInterativa
                    titulo={tx("Defeitos abertos nesta rodada, agrupados por causa", "Open defects in this round, grouped by cause")}
                    colunas={COLUNAS_DEFEITOS}
                    linhas={defeitos}
                    chaveLinha="id"
                    colunaRotulo="id"
                    fonte={tx("Scrutiniums, avaliacao.json (defeitos agrupados por dimensão, código e descrição)", "Scrutiniums, avaliacao.json (defects grouped by dimension, code and description)")}
                    versao={versao}
                    nomeArquivo="avaliacao-defeitos"
                    chaveUrl="def"
                    ordemInicial={{ coluna: "n_paginas", direcao: "desc" }}
                    tamanhoPagina={25}
                    dicaBusca={tx("Descrição do defeito", "Defect description")}
                    semLinhas={tx("Nenhum defeito aberto nesta rodada.", "No open defect in this round.")}
                    nota={tx(
                      "Severidade: crítico é dado errado, navegação quebrada, foco preso ou falha de operação; alto é violação séria de acessibilidade, erro de console, controle que não aciona ou rolagem horizontal; médio e baixo são os demais. Um defeito lista todas as páginas em que apareceu.",
                      "Severity: critical is wrong data, broken navigation, trapped focus or an operation failure; high is a serious accessibility violation, a console error, a control that does not respond or horizontal scrolling; medium and low are the rest. A defect lists every page where it appeared.",
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="jornadas" nivel="analisar" titulo={tx("Jornadas de usuário executadas", "User journeys run")}>
                  <AvaliacaoJornadas a={a} />
                </SecaoDoPainel>

                <SecaoDoPainel id="revisao" nivel="analisar" titulo={tx("Problemas que os revisores viram em várias páginas", "Problems the reviewers saw across several pages")}>
                  <AvaliacaoRevisao a={a} />
                </SecaoDoPainel>

                <SecaoDoPainel id="evolucao" nivel="analisar" titulo={tx("Evolução entre rodadas", "Progress between rounds")}>
                  <AvaliacaoEvolucao a={a} />
                </SecaoDoPainel>

                <SecaoDoPainel id="rubrica" nivel="auditar" titulo={tx("Rubrica, método e entradas", "Rubric, method and inputs")}>
                  <AvaliacaoRubrica a={a} />
                  <AvaliacaoMetodo a={a} />
                </SecaoDoPainel>

                <DadosLimitacoes
                  itens={a.limites.map((l) => (
                    <TrechoPortugues key={l} regiao="avaliacao-limite">
                      {l}
                    </TrechoPortugues>
                  ))}
                />
                <DadosSeguir
                  ancora="painel-avaliacao"
                  proximo={{ href: "/setor-eletrico/dados", pergunta: tx("Quais dados estão de fato validados?", "Which data are actually validated?") }}
                  downloads={[{ rotulo: tx("Avaliação completa, com a evidência de cada nota (JSON)", "Full evaluation, with the evidence for each score (JSON)"), url: URL_AVALIACAO }]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
