import { fraseDeRecusa } from "@/lib/energia/bastidor";
import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasFinancas } from "@/components/energia/EmpresasFinancas";
import {
  EmpresasAnalise,
  EmpresasAuditoria,
  EmpresasAviso,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasRecorte,
  EmpresasResposta,
  EmpresasSeguir,
} from "@/components/energia/EmpresasPagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
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
} from "@/lib/energia/empresas";
import { evidenciasReceita, seriesFinanceirasDe } from "@/lib/energia/empresas-arquivos";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Como evoluem os fundamentos reportados? Companhias abertas do setor",
  description:
    "Demonstrações societárias das companhias abertas do setor elétrico na CVM (DFP e ITR), consolidado e individual separados, com reapresentações, conversões de escala e o bloqueio das demonstrações regulatórias documentado.",
  alternates: { canonical: "/setor-eletrico/empresas/financas" },
};

export default function PaginaP038() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const f = g.financas;
  const fonteCvm = "CVM, cadastro de companhias abertas, DFP e ITR";
  const bloqueioP038 = g.bloqueios.filter((b) => b.painel === "P038");
  const decisoesP038 = g.decisoes_metodo.filter((x) => x.painel === "P038");
  // companhia padrão do gráfico: as séries e a ficha dela chegam com a página
  const padraoFin = padraoFinancas(f.companhias);
  const seriesIniciais = seriesFinanceirasDe(g.series.financas, padraoFin) ?? {};
  const evidenciasIniciais = evidenciasReceita(g.series.evidencias, padraoFin);

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-financas" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["DFP", "CVM", "ANEEL"]}
          rotulo="Empresas"
          titulo={painel("p038").pergunta}
          referencia={
            <>
              Cadastro de companhias abertas da CVM capturado em {carimbo(g.datas.cvm_cadastro_capturado_em)}; DFP até o exercício de {f.periodos.ultimo_exercicio ?? "sem dado"}; ITR até{" "}
              {dataTexto(f.periodos.ultimo_trimestre)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Receita, resultado, dívida, patrimônio e caixa das companhias abertas do setor, como reportados à CVM, com o consolidado e o individual separados, as reapresentações e as
          conversões de escala declaradas. Nada se soma entre companhias: a controladora já consolida as controladas.
        </CabecalhoModulo>
        <EmpresasNavegacao atual="p038" />
        <ModoProfundidade>

          <Bloco id="financas">
            <PainelEvidencia
              id="p038"
              pergunta={painel("p038").pergunta}
              subtitulo="Demonstrações societárias das companhias abertas na CVM, consolidadas e individuais separadas · R$ nominais"
              porQueImporta={
                <>
                  Receita, resultado, dívida e investimento mostram a capacidade das empresas de manter e expandir a rede e o parque gerador. As demonstrações padronizadas da CVM são a
                  fonte pública comparável entre companhias abertas.
                </>
              }
              oQueMudou={
                <>
                  {inteiro(f.revisoes.documentos_com_mais_de_uma_versao)} documentos têm mais de uma versão na CVM e {inteiro(f.revisoes.valores_reapresentados)} valores foram reapresentados no
                  comparativo do ano seguinte; {inteiro(f.revisoes.inversoes_de_escala_resolvidas)} diferenças que eram só troca da marca de escala deixaram de contar como reapresentação.
                </>
              }
              comoInterpretar={
                <>
                  Consolidado (a companhia e as controladas) e individual (só a companhia) são séries separadas; o escopo exibido na tabela é o consolidado quando apresentado. Valores de
                  fluxo (receita, lucro, caixa) são do período; valores de saldo (ativo, dívida, patrimônio), do fim do período. No ITR, a receita é do trimestre e o caixa é acumulado
                  desde janeiro.
                </>
              }
              naoConcluir={
                <>
                  Não se soma nada entre companhias: a controladora já consolida as controladas. {f.universo.nota_cobertura} As demonstrações regulatórias da ANEEL, que usam outro plano de
                  contas, não estão aqui (bloqueio abaixo). O resultado antes do financeiro e dos tributos não é EBITDA.
                </>
              }
              proveniencia={g.proveniencia.financas}
              complementares={[{ rotulo: "Valores com a escala convertida", p: g.proveniencia.financas_escala }]}
            >
              <div className="space-y-6">
                <EmpresasResposta id="p038">{respostaFinancas(f)}</EmpresasResposta>
                <EmpresasRecorte
                  periodo={
                    <>
                      Exercícios de {f.periodos.exercicios[0] ?? "sem dado"} a {f.periodos.ultimo_exercicio ?? "sem dado"} (DFP); trimestres de {dataTexto(f.periodos.trimestres[0])} a{" "}
                      {dataTexto(f.periodos.ultimo_trimestre)} (ITR)
                    </>
                  }
                  universo={
                    <>
                      {inteiro(f.universo.companhias)} companhias abertas com setor de energia elétrica declarado à CVM ({inteiro(f.universo.ativas)} ativas, {inteiro(f.universo.distribuidoras_abertas)}{" "}
                      distribuidoras)
                    </>
                  }
                  unidade="R$ nominais (R$ milhões nas tabelas e nos gráficos)"
                />
                {bloqueioP038.map((b) => (
                  <EmpresasAviso key={b.id} rotulo="Fonte indisponível">
                    <p>
                      {b.descricao} {fraseDeRecusa(b.evidencia, "da ANEEL")} <TextoDoLeitor texto={b.evidencia} />
                    </p>
                    <p className="mt-1">O que se entrega no lugar: {b.alternativa}</p>
                  </EmpresasAviso>
                ))}
                {decisoesP038.map((x) => (
                  <EmpresasAviso key={x.id} rotulo="Decisão de método">
                    <p>
                      {x.decisao} {x.motivo}
                    </p>
                  </EmpresasAviso>
                ))}
                <EmpresasFinancas
                  linhas={linhasCompanhias(f.companhias)}
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

                <EmpresasAnalise titulo="Contas, setores e revisões">
                  <TabelaInterativa
                    titulo="Contas publicadas (plano padronizado da CVM, só contas fixas)"
                    colunas={COLUNAS_CONTAS}
                    linhas={linhasContas(f.contas)}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte={fonteCvm}
                    versao={String(f.periodos.ultimo_exercicio ?? "")}
                    nomeArquivo="empresas-contas-cvm"
                  />
                  <p className="text-sm text-carvao-muted">
                    Setor declarado à CVM: {Object.entries(f.universo.por_setor).map(([s, n]) => `${s}, ${inteiro(n)}`).join("; ")}. {inteiro(f.universo.com_dfp)} com DFP e {inteiro(f.universo.com_itr)} com ITR.{" "}
                    {f.revisoes.regra}
                  </p>
                </EmpresasAnalise>

                <EmpresasAuditoria titulo="O que saiu das séries e por quê">
                  <p className="text-sm text-carvao-muted">
                    {f.exclusoes.regra_nao_apresentada} Total: {inteiro(f.exclusoes.colunas_nao_apresentadas.documentos)} colunas e {inteiro(f.exclusoes.colunas_nao_apresentadas.valores)} valores.
                  </p>
                  <TabelaInterativa
                    titulo="Colunas não apresentadas no exercício ou trimestre corrente"
                    colunas={COLUNAS_NAO_APRESENTADAS}
                    linhas={linhasNaoApresentadas(f)}
                    chaveLinha="id"
                    colunaRotulo="companhia"
                    fonte={fonteCvm}
                    versao={f.periodos.ultimo_trimestre ?? ""}
                    nomeArquivo="empresas-colunas-nao-apresentadas"
                  />
                  <p className="text-sm text-carvao-muted">
                    {f.exclusoes.regra_nao_preenchida} Total: {inteiro(f.exclusoes.colunas_nao_preenchidas.colunas)} colunas e {inteiro(f.exclusoes.colunas_nao_preenchidas.valores)} valores.
                    {f.exclusoes.colunas_nao_preenchidas.exercicio_ou_trimestre.length ? ` No período corrente: ${datasLegiveis(f.exclusoes.colunas_nao_preenchidas.exercicio_ou_trimestre.join("; "))}.` : ""}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {f.exclusoes.escala.regra} {inteiro(f.exclusoes.escala.documentos_corrigidos)} documentos de {inteiro(f.exclusoes.escala.companhias)} companhias, {inteiro(f.exclusoes.escala.valores_corrigidos)}{" "}
                    valores: {f.exclusoes.escala.por_companhia.join("; ")}.
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {f.exclusoes.regra_inicio} {inteiro(f.exclusoes.inicio_inconsistente.length)} exercícios aceitos com nota; {inteiro(f.exclusoes.exercicios_irregulares.valores)} valores de exercícios curtos
                    ({inteiro(f.exclusoes.exercicios_irregulares.companhias)} companhias) e {inteiro(f.exclusoes.periodos_irregulares_itr.valores)} de períodos irregulares do ITR ficam só nos CSV, com recorte próprio.
                  </p>
                  <p className="text-sm text-carvao-muted">{f.exclusoes.saltos_ativo.regra}</p>
                  <TabelaInterativa
                    titulo="Saltos de 300 vezes ou mais no ativo total, publicados como a fonte entregou"
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
                      Insumo disponível: {x.insumo_disponivel} Como mudar: {x.como_mudar}
                    </p>
                  ))}
                </EmpresasAuditoria>

                <EmpresasSeguir
                  ancora="p038"
                  proximo={{ href: rotaPainel("p037"), pergunta: painel("p037").pergunta }}
                  downloads={[
                    ...downloadsDe(g.downloads, [
                      "/energia/series/empresas_companhias_cvm.csv",
                      "/energia/series/empresas_financas_anual.csv",
                      "/energia/series/empresas_financas_trimestral.csv",
                    ]),
                    { rotulo: "Ajustes de escala e colunas não preenchidas (CSV)", url: "/energia/series/empresas_financas_ajustes.csv" },
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
