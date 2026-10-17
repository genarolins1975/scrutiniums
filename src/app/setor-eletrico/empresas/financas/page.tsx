import { fraseDeRecusa } from "@/lib/energia/bastidor";
import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasEvolucaoFinancas, EmpresasTabelaCompanhias } from "@/components/energia/EmpresasFinancas";
import {
  EmpresasAviso,
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
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_CONTAS,
  COLUNAS_NAO_APRESENTADAS,
  COLUNAS_SALTOS,
  contasGrafico,
  dataTexto,
  downloadsDe,
  entidadesCompanhias,
  inteiro,
  linhasCompanhias,
  linhasContas,
  linhasNaoApresentadas,
  linhasSaltos,
  padraoFinancas,
  painel,
  respostaFinancas,
  resumoCompanhias,
  rotaPainel,
  rotuloSetorCvm,
  vereditoFinancas,
} from "@/lib/energia/empresas";
import { evidenciasReceita, seriesFinanceirasDe } from "@/lib/energia/empresas-arquivos";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import { FINANCAS_REGRA_EN, LIMITACAO_EMPRESAS_EN, NOTA_EMPRESAS_EN, escalaPorCompanhia, traduzir } from "@/lib/energia/i18n/empresas-leiloes";
import { SIGLAS, SIGLAS_IDIOMAS } from "@/lib/energia/siglas";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/empresas/financas", {
    title: tx("Como evoluem os fundamentos reportados? Companhias abertas do setor", "How do the reported fundamentals evolve? The sector's publicly held companies"),
    description: tx(
      "Demonstrações societárias das companhias abertas do setor elétrico na CVM (DFP e ITR), consolidado e individual separados, com reapresentações, conversões de escala e o bloqueio das demonstrações regulatórias documentado.",
      "Corporate financial statements of the power sector's publicly held companies at the CVM (DFP and ITR), consolidated and individual kept separate, with restatements, scale conversions and the documented block on the regulatory statements.",
    ),
    alternates: { canonical: "/setor-eletrico/empresas/financas" },
  }, anterior);
}

export default function PaginaP038() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const f = g.financas;
  const fonteCvm = tx("CVM, cadastro de companhias abertas, DFP e ITR", "CVM, registry of publicly held companies, DFP and ITR");
  const bloqueioP038 = g.bloqueios.filter((b) => b.painel === "P038");
  const decisoesP038 = g.decisoes_metodo.filter((x) => x.painel === "P038");
  // companhia padrão do gráfico: as séries e a ficha dela chegam com a página
  const padraoFin = padraoFinancas(f.companhias);
  const seriesIniciais = seriesFinanceirasDe(g.series.financas, padraoFin) ?? {};
  const evidenciasIniciais = evidenciasReceita(g.series.evidencias, padraoFin);
  const dataCadastro = dataTexto(g.datas.cvm_cadastro_capturado_em?.slice(0, 10));
  const semDado = tx("sem dado", "no data");
  const exercicios = tx(
    `${f.periodos.exercicios[0] ?? semDado} a ${f.periodos.ultimo_exercicio ?? semDado}`,
    `${f.periodos.exercicios[0] ?? semDado} to ${f.periodos.ultimo_exercicio ?? semDado}`,
  );
  const notaCobertura = traduzir(NOTA_EMPRESAS_EN, f.universo.nota_cobertura);
  const regra = (x: string) => traduzir(FINANCAS_REGRA_EN, x);
  const lim = (x: string) => traduzir(LIMITACAO_EMPRESAS_EN, x);
  /** Frase de leitor para a recusa da fonte, no idioma da página (a forma portuguesa vem de fraseDeRecusa). */
  const recusaAneel = (evidencia: string) => {
    // i18n: dado (argumento de fraseDeRecusa, forma portuguesa)
    const pt = fraseDeRecusa(evidencia, "da ANEEL");
    if (!pt) return "";
    const data = /(\d{2})\/(\d{2})\/(\d{4})/.exec(evidencia);
    return tx(
      pt,
      data
        ? `On ${dataTexto(`${data[3]}-${data[2]}-${data[1]}`)}, ANEEL's servers refused the observatory's automated queries.`
        : "ANEEL's servers refused the observatory's automated queries.",
    );
  };

  const oQueMudou = tx(
    <>
      {inteiro(f.revisoes.documentos_com_mais_de_uma_versao)} documentos têm mais de uma versão na CVM e {inteiro(f.revisoes.valores_reapresentados)} valores foram reapresentados no comparativo do ano
      seguinte; {inteiro(f.revisoes.inversoes_de_escala_resolvidas)} diferenças que eram só troca da marca de escala deixaram de contar como reapresentação.
    </>,
    <>
      {inteiro(f.revisoes.documentos_com_mais_de_uma_versao)} documents have more than one version at the CVM and {inteiro(f.revisoes.valores_reapresentados)} values were restated in the following
      year&apos;s comparative; {inteiro(f.revisoes.inversoes_de_escala_resolvidas)} differences that were only a swap of the scale flag no longer count as restatements.
    </>,
  );
  const comoInterpretar = tx(
    <>
      Consolidado (a companhia e as controladas) e individual (só a companhia) são séries separadas; o escopo exibido na tabela é o consolidado quando apresentado. Valores de fluxo (receita, lucro,
      caixa) são do período; valores de saldo (ativo, dívida, patrimônio), do fim do período. No ITR, a receita é do trimestre e o caixa é acumulado desde janeiro.
    </>,
    <>
      Consolidated (the company and its subsidiaries) and individual (the company alone) are separate series; the scope shown in the table is the consolidated one when presented. Flow values
      (revenue, income, cash) are for the period; balance values (assets, debt, equity), for the end of the period. In the ITR, revenue is for the quarter and cash is accumulated since January.
    </>,
  );
  const naoConcluir = tx(
    <>
      Não se soma nada entre companhias: a controladora já consolida as controladas. {f.universo.nota_cobertura} As demonstrações regulatórias da ANEEL, que usam outro plano de contas, não estão aqui
      (ver o aviso &ldquo;Fonte indisponível&rdquo;, acima). O resultado antes do financeiro e dos tributos não é EBITDA.
    </>,
    <>
      Nothing is added across companies: the parent company already consolidates its subsidiaries. {notaCobertura} ANEEL&apos;s regulatory financial statements, which use another chart of
      accounts, are not here (see the &ldquo;Source unavailable&rdquo; notice above). Earnings before financial result and taxes are not EBITDA.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-financas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="p038" />
        <CabecalhoModulo
          rotulo={tx("Empresas", "Companies")}
          siglas={["CVM", "DFP", "ITR", "ANEEL", "CNPJ"]}
          titulo={painel("p038").pergunta}
          lead={tx(
            `Receita, resultado, dívida, patrimônio e caixa das companhias abertas do setor, como reportados à CVM (${SIGLAS.CVM}). Nada se soma entre companhias.`,
            `Revenue, earnings, debt, equity and cash of the sector's publicly held companies, as reported to the CVM (${SIGLAS_IDIOMAS.en.CVM}). Nothing is added across companies.`,
          )}
          recorte={tx(
            `Exercícios de ${exercicios} (DFP) · trimestres até ${dataTexto(f.periodos.ultimo_trimestre)} (ITR) · R$ nominais, em R$ milhões`,
            `Fiscal years ${exercicios} (DFP) · quarters up to ${dataTexto(f.periodos.ultimo_trimestre)} (ITR) · nominal R$, in R$ million`,
          )}
          fonte={tx(
            "CVM, Demonstrações Financeiras Padronizadas (DFP) e Informações Trimestrais (ITR)",
            `CVM, ${SIGLAS_IDIOMAS.en.DFP} (DFP) and ${SIGLAS_IDIOMAS.en.ITR} (ITR)`,
          )}
          referencia={tx(
            <>
              Cadastro de companhias abertas da CVM capturado em {carimbo(g.datas.cvm_cadastro_capturado_em)}; DFP até o exercício de {f.periodos.ultimo_exercicio ?? "sem dado"}; ITR até{" "}
              {dataTexto(f.periodos.ultimo_trimestre)}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              CVM registry of publicly held companies captured on {carimbo(g.datas.cvm_cadastro_capturado_em)}; DFP up to fiscal year {f.periodos.ultimo_exercicio ?? semDado}; ITR up to{" "}
              {dataTexto(f.periodos.ultimo_trimestre)}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: tx("Cadastro da CVM", "CVM registry"), texto: tx(`capturado em ${dataCadastro}`, `captured on ${dataCadastro}`), natureza: "OBSERVADO" },
                { rotulo: tx("DFP (anual)", "DFP (annual)"), texto: tx(`exercícios de ${exercicios}`, `fiscal years ${exercicios}`), natureza: "OBSERVADO" },
                { rotulo: tx("ITR (trimestral)", "ITR (quarterly)"), texto: tx(`até ${dataTexto(f.periodos.ultimo_trimestre)}`, `up to ${dataTexto(f.periodos.ultimo_trimestre)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Valores com escala convertida", "Values with converted scale"),
                  texto: tx(`${inteiro(f.exclusoes.escala.valores_corrigidos)} valores`, `${inteiro(f.exclusoes.escala.valores_corrigidos)} values`),
                  natureza: "ESTIMADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores do universo de companhias abertas", "Indicators of the universe of publicly held companies")}
              nota={tx(
                `${f.universo.nota_cobertura} Contagens fixas: não mudam com as escolhas do gráfico.`,
                `${notaCobertura} Fixed counts: they do not change with the chart choices.`,
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Companhias abertas no cadastro", "Publicly held companies in the registry")}
                natureza="CALCULADO"
                valor={f.universo.companhias}
                formato="num"
                casas={0}
                unidade={tx("companhias", "companies")}
                periodo={tx(`cadastro da CVM de ${dataCadastro}`, `CVM registry as of ${dataCadastro}`)}
                nota={tx(`${inteiro(f.universo.ativas)} ativas, ${inteiro(f.universo.canceladas)} canceladas.`, `${inteiro(f.universo.ativas)} active, ${inteiro(f.universo.canceladas)} canceled.`)}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Com demonstrações anuais (DFP)", "With annual statements (DFP)")}
                natureza="CALCULADO"
                valor={f.universo.com_dfp}
                formato="num"
                casas={0}
                unidade={tx("companhias", "companies")}
                periodo={tx(`exercícios de ${exercicios}`, `fiscal years ${exercicios}`)}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Com informações trimestrais (ITR)", "With quarterly information (ITR)")}
                natureza="CALCULADO"
                valor={f.universo.com_itr}
                formato="num"
                casas={0}
                unidade={tx("companhias", "companies")}
                periodo={tx(`até ${dataTexto(f.periodos.ultimo_trimestre)}`, `up to ${dataTexto(f.periodos.ultimo_trimestre)}`)}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Valores reapresentados", "Restated values")}
                natureza="CALCULADO"
                valor={f.revisoes.valores_reapresentados}
                formato="num"
                casas={0}
                unidade={tx("valores", "values")}
                periodo={tx(`exercícios de ${exercicios}`, `fiscal years ${exercicios}`)}
                nota={tx(
                  `Reapresentados no comparativo do ano seguinte; ${inteiro(f.revisoes.documentos_com_mais_de_uma_versao)} documentos com mais de uma versão.`,
                  `Restated in the following year's comparative; ${inteiro(f.revisoes.documentos_com_mais_de_uma_versao)} documents with more than one version.`,
                )}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Cada companhia reporta à CVM as demonstrações anuais (DFP, {SIGLAS.DFP}) e as informações trimestrais (ITR, {SIGLAS.ITR}) no plano de contas padronizado; a controladora já consolida as
              controladas, e por isso nenhum valor se soma entre companhias. Reapresentações e conversões de escala são tratadas e ditas, e as demonstrações regulatórias da ANEEL, bloqueadas na fonte, não foram
              substituídas.
            </>,
            <>
              Each company reports to the CVM its annual statements (DFP, {SIGLAS_IDIOMAS.en.DFP}) and quarterly information (ITR, {SIGLAS_IDIOMAS.en.ITR}) in the standardized chart of accounts; the
              parent company already consolidates its subsidiaries, so no value is added across companies. Restatements and scale conversions are handled and stated, and ANEEL&apos;s regulatory
              statements, blocked at the source, were not replaced.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="financas">
            <PainelEvidencia
              id="p038"
              pergunta={tx("Como evolui uma conta em até quatro companhias?", "How does an account evolve in up to four companies?")}
              subtitulo={tx(
                "Demonstrações societárias das companhias abertas na CVM, consolidadas e individuais separadas · R$ nominais",
                "Corporate financial statements of publicly held companies at the CVM, consolidated and individual kept separate · nominal R$",
              )}
              porQueImporta={tx(
                <>
                  Receita, resultado, dívida e investimento mostram a capacidade das empresas de manter e expandir a rede e o parque gerador. As demonstrações padronizadas da CVM são a fonte pública
                  comparável entre companhias abertas.
                </>,
                <>
                  Revenue, earnings, debt and investment show the companies&apos; capacity to maintain and expand the grid and the generation fleet. The CVM&apos;s standardized statements are the public
                  source that is comparable across publicly held companies.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.financas}
              complementares={[{ rotulo: tx("Valores com a escala convertida", "Values with the converted scale"), p: g.proveniencia.financas_escala }]}
            >
              <div className="space-y-6">
                <EmpresasEvolucaoFinancas
                  entidades={entidadesCompanhias(f.companhias)}
                  contas={contasGrafico(f.contas)}
                  padrao={padraoFin}
                  seriesIniciais={seriesIniciais}
                  evidenciasIniciais={evidenciasIniciais}
                  urlSeries={g.series.financas}
                  urlEvidencias={g.series.evidencias}
                  resumo={resumoCompanhias(f.companhias)}
                  fonte={fonteCvm}
                  versao={f.periodos.ultimo_trimestre ?? String(f.periodos.ultimo_exercicio ?? "")}
                />
                {/* a faixa já traz as contagens; a resposta vem depois da figura, para o comparador começar na primeira tela */}
                <RespostaCurta id="p038" veredito={vereditoFinancas(f)} depois>
                  {respostaFinancas(f)}
                </RespostaCurta>

                {bloqueioP038.map((b) => (
                  <EmpresasAviso key={b.id} rotulo={tx("Fonte indisponível", "Source unavailable")}>
                    <p>
                      {lim(b.descricao)} {recusaAneel(b.evidencia)} <TextoDoLeitor texto={lim(b.evidencia)} />
                    </p>
                    <p className="mt-1">
                      {tx("O que se entrega no lugar:", "What is delivered instead:")} {lim(b.alternativa)}
                    </p>
                  </EmpresasAviso>
                ))}

                <EmpresasRecorte
                  periodo={tx(
                    <>
                      Exercícios de {exercicios} (DFP); trimestres de {dataTexto(f.periodos.trimestres[0])} a {dataTexto(f.periodos.ultimo_trimestre)} (ITR)
                    </>,
                    <>
                      Fiscal years {exercicios} (DFP); quarters from {dataTexto(f.periodos.trimestres[0])} to {dataTexto(f.periodos.ultimo_trimestre)} (ITR)
                    </>,
                  )}
                  universo={tx(
                    <>
                      {inteiro(f.universo.companhias)} companhias abertas com setor de energia elétrica declarado à CVM ({inteiro(f.universo.ativas)} ativas, {inteiro(f.universo.distribuidoras_abertas)}{" "}
                      distribuidoras)
                    </>,
                    <>
                      {inteiro(f.universo.companhias)} publicly held companies with the electric power sector declared to the CVM ({inteiro(f.universo.ativas)} active,{" "}
                      {inteiro(f.universo.distribuidoras_abertas)} distribution utilities)
                    </>,
                  )}
                  unidade={tx("R$ nominais (R$ milhões nas tabelas e nos gráficos)", "Nominal R$ (R$ million in the tables and charts)")}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel
                  id="companhias"
                  titulo={tx("Quais companhias abertas estão no universo?", "Which publicly held companies are in the universe?")}
                  lead={tx(
                    `As ${inteiro(f.universo.companhias)} companhias do cadastro da CVM com setor de energia elétrica, cada uma pelo CNPJ (${SIGLAS.CNPJ}), com o último exercício de cada uma. Escolha uma linha para pô-la em primeiro lugar na comparação do alto da página.`,
                    `The ${inteiro(f.universo.companhias)} companies in the CVM registry with the electric power sector, each one by its CNPJ (${SIGLAS_IDIOMAS.en.CNPJ}), with each one's latest fiscal year. Choose a row to put it first in the comparison at the top of the page.`,
                  )}
                >
                  <EmpresasTabelaCompanhias linhas={linhasCompanhias(f.companhias)} padrao={padraoFin} fonte={fonteCvm} versao={f.periodos.ultimo_trimestre ?? String(f.periodos.ultimo_exercicio ?? "")} />
                </SecaoDoPainel>

                <SecaoDoPainel id="contas" titulo={tx("Contas, setores e revisões", "Accounts, sectors and revisions")} nivel="analisar">
                  {decisoesP038.map((x) => (
                    <EmpresasAviso key={x.id} rotulo={tx("Decisão de método", "Method decision")}>
                      <p>
                        {regra(x.decisao)} {regra(x.motivo)}
                      </p>
                    </EmpresasAviso>
                  ))}
                  <TabelaInterativa
                    titulo={tx("Contas publicadas (plano padronizado da CVM, só contas fixas)", "Published accounts (CVM standardized chart, fixed accounts only)")}
                    colunas={COLUNAS_CONTAS}
                    linhas={linhasContas(f.contas)}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte={fonteCvm}
                    versao={String(f.periodos.ultimo_exercicio ?? "")}
                    nomeArquivo="empresas-contas-cvm"
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Setor declarado à CVM: {Object.entries(f.universo.por_setor).map(([s, n]) => `${s}, ${inteiro(n)}`).join("; ")}. {inteiro(f.universo.com_dfp)} com DFP e {inteiro(f.universo.com_itr)} com ITR.{" "}
                        {f.revisoes.regra}
                      </>,
                      <>
                        Sector declared to the CVM: {Object.entries(f.universo.por_setor).map(([s, n]) => `${rotuloSetorCvm(s)}, ${inteiro(n)}`).join("; ")}. {inteiro(f.universo.com_dfp)} with DFP and{" "}
                        {inteiro(f.universo.com_itr)} with ITR. {regra(f.revisoes.regra)}
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="saidas" titulo={tx("O que saiu das séries e por quê", "What was left out of the series, and why")} nivel="auditar">
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        {f.exclusoes.regra_nao_apresentada} Total: {inteiro(f.exclusoes.colunas_nao_apresentadas.documentos)} colunas e {inteiro(f.exclusoes.colunas_nao_apresentadas.valores)} valores.
                      </>,
                      <>
                        {regra(f.exclusoes.regra_nao_apresentada)} Total: {inteiro(f.exclusoes.colunas_nao_apresentadas.documentos)} columns and {inteiro(f.exclusoes.colunas_nao_apresentadas.valores)}{" "}
                        values.
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Colunas não apresentadas no exercício ou trimestre corrente", "Columns not presented in the current fiscal year or quarter")}
                    colunas={COLUNAS_NAO_APRESENTADAS}
                    linhas={linhasNaoApresentadas(f)}
                    chaveLinha="id"
                    colunaRotulo="companhia"
                    fonte={fonteCvm}
                    versao={f.periodos.ultimo_trimestre ?? ""}
                    nomeArquivo="empresas-colunas-nao-apresentadas"
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        {f.exclusoes.regra_nao_preenchida} Total: {inteiro(f.exclusoes.colunas_nao_preenchidas.colunas)} colunas e {inteiro(f.exclusoes.colunas_nao_preenchidas.valores)} valores.
                        {f.exclusoes.colunas_nao_preenchidas.exercicio_ou_trimestre.length ? ` No período corrente: ${datasLegiveis(f.exclusoes.colunas_nao_preenchidas.exercicio_ou_trimestre.join("; "))}.` : ""}
                      </>,
                      <>
                        {regra(f.exclusoes.regra_nao_preenchida)} Total: {inteiro(f.exclusoes.colunas_nao_preenchidas.colunas)} columns and {inteiro(f.exclusoes.colunas_nao_preenchidas.valores)} values.
                        {f.exclusoes.colunas_nao_preenchidas.exercicio_ou_trimestre.length
                          ? ` In the current period: ${datasLegiveis(f.exclusoes.colunas_nao_preenchidas.exercicio_ou_trimestre.join("; "))}.`
                          : ""}
                      </>,
                    )}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        {f.exclusoes.escala.regra} {inteiro(f.exclusoes.escala.documentos_corrigidos)} documentos de {inteiro(f.exclusoes.escala.companhias)} companhias, {inteiro(f.exclusoes.escala.valores_corrigidos)}{" "}
                        valores: {datasLegiveis(f.exclusoes.escala.por_companhia.join("; "))}.
                      </>,
                      <>
                        {regra(f.exclusoes.escala.regra)} {inteiro(f.exclusoes.escala.documentos_corrigidos)} documents from {inteiro(f.exclusoes.escala.companhias)} companies,{" "}
                        {inteiro(f.exclusoes.escala.valores_corrigidos)} values: {datasLegiveis(f.exclusoes.escala.por_companhia.map((x) => escalaPorCompanhia(x)).join("; "))}.
                      </>,
                    )}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        {f.exclusoes.regra_inicio} {inteiro(f.exclusoes.inicio_inconsistente.length)} exercícios aceitos com nota; {inteiro(f.exclusoes.exercicios_irregulares.valores)} valores de exercícios curtos
                        ({inteiro(f.exclusoes.exercicios_irregulares.companhias)} companhias) e {inteiro(f.exclusoes.periodos_irregulares_itr.valores)} de períodos irregulares do ITR ficam só nos CSV, com recorte próprio.
                      </>,
                      <>
                        {regra(f.exclusoes.regra_inicio)} {inteiro(f.exclusoes.inicio_inconsistente.length)} fiscal years accepted with a note; {inteiro(f.exclusoes.exercicios_irregulares.valores)} values from
                        short fiscal years ({inteiro(f.exclusoes.exercicios_irregulares.companhias)} companies) and {inteiro(f.exclusoes.periodos_irregulares_itr.valores)} from irregular ITR periods stay
                        only in the CSVs, with their own scope.
                      </>,
                    )}
                  </p>
                  <p className="text-sm text-carvao-muted">{regra(f.exclusoes.saltos_ativo.regra)}</p>
                  <TabelaInterativa
                    titulo={tx("Saltos de 300 vezes ou mais no ativo total, publicados como a fonte entregou", "Jumps of 300 times or more in total assets, published as the source delivered them")}
                    colunas={COLUNAS_SALTOS}
                    linhas={linhasSaltos(f)}
                    chaveLinha="id"
                    colunaRotulo="companhia"
                    fonte={fonteCvm}
                    versao={String(f.periodos.ultimo_exercicio ?? "")}
                    nomeArquivo="empresas-saltos-ativo"
                  />
                  {decisoesP038.map((x) => (
                    <p key={x.id} className="text-sm text-carvao-muted">
                      {tx("Insumo disponível:", "Available input:")} {regra(x.insumo_disponivel)} {tx("Como mudar:", "How to change:")} {regra(x.como_mudar)}
                    </p>
                  ))}
                </SecaoDoPainel>

                <EmpresasSeguir
                  ancora="p038"
                  proximo={{ href: rotaPainel("p037"), pergunta: painel("p037").pergunta }}
                  downloads={[
                    ...downloadsDe(g.downloads, [
                      "/energia/series/empresas_companhias_cvm.csv",
                      "/energia/series/empresas_financas_anual.csv",
                      "/energia/series/empresas_financas_trimestral.csv",
                    ]),
                    { rotulo: tx("Ajustes de escala e colunas não preenchidas (CSV)", "Scale adjustments and unfilled columns (CSV)"), url: "/energia/series/empresas_financas_ajustes.csv" },
                  ]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
