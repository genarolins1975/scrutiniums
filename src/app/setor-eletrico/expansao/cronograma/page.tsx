import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ExpansaoPrevisoes, ExpansaoRevisoes } from "@/components/energia/ExpansaoCronograma";
import {
  ExpansaoAnalise,
  ExpansaoAuditoria,
  ExpansaoIndisponivel,
  ExpansaoLimitacoes,
  ExpansaoNavegacao,
  ExpansaoNota,
  ExpansaoRecorte,
  ExpansaoSeguir,
  ExpansaoSubtitulo,
  ExpansaoTabelaSimples,
} from "@/components/energia/ExpansaoPagina";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_ATRASADAS,
  COLUNAS_DATAS_FREQUENTES,
  COLUNAS_DESVIO_PRAZO,
  DOWNLOADS_PAINEL,
  FONTE_LIBERACOES,
  FONTE_RALIE,
  dataTexto,
  diasTexto,
  downloadsDe,
  inteiro,
  linhasAtrasadas,
  linhasConfiabilidade,
  linhasConfiabilidadeTipo,
  linhasDatasFrequentes,
  linhasDeslizamento,
  linhasDesvioPrazo,
  linhasPrevisoesAno,
  linhasProximos24,
  linhasSemPrevisao,
  mudancaCronograma,
  mwTexto,
  notaDatasCronograma,
  painel,
  pctTexto,
  respostaCronograma,
  textoContagemFotografias,
  ultimaConfiabilidade,
  vereditoCronograma,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Cronograma da expansão: previsões com data-base, revisões e o que atrasou",
  description:
    "Previsões de operação comercial da fiscalização da ANEEL (RALIE) com a data da fotografia, datas convencionais em bloco, confiabilidade das previsões contra a liberação comercial real desde a primeira fotografia publicada, revisões em 12 meses e desvio em relação ao prazo outorgado vigente.",
  alternates: { canonical: "/setor-eletrico/expansao/cronograma" },
};

export default function CronogramaPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cronograma;
  const pa = c.previsoes_atuais;
  const p = g.proveniencia;
  const pp = painel("p041");
  const conf = linhasConfiabilidade(g);
  const ult = ultimaConfiabilidade(g);
  const at = pa.atraso_previsto;
  const blocoFoto = c.datas_em_bloco_por_fotografia;
  const ultimoBloco = blocoFoto.at(-1);
  const dataRalie = dataTexto(c.data_ralie);
  const dataLib = dataTexto(c.data_liberacoes);

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao-cronograma" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["RALIE", "ANEEL"]}
          rotulo="Expansão"
          titulo="Cronograma e atrasos da geração"
          referencia={
            <>
              RALIE da ANEEL: fotografia atual de {dataRalie} e histórico de {inteiro(c.historico_fonte.fotografias)} fotografias desde {dataTexto(c.historico_fonte.primeira_fotografia)}; liberações para
              operação comercial até {dataTexto(g.referencias.liberacoes_ultima_data)} (arquivo de {dataLib}). Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quando a fiscalização da ANEEL prevê que cada usina entre em operação, e o que aconteceu com as previsões feitas antes. Toda previsão aparece com a data em que foi feita;
          atraso só é medido contra uma previsão datada.
        </CabecalhoModulo>
        <ExpansaoNavegacao atual="p041" />
        <ModoProfundidade>
          <Bloco id="cronograma">
            <PainelEvidencia
              id="p041"
              pergunta={pp.pergunta}
              subtitulo="Previsões de operação comercial por fotografia do RALIE e liberação comercial real · MW e % da potência"
              porQueImporta={
                <>
                  Quem planeja a rede, o mercado ou a conta precisa saber o que deve entrar e quando, e quanto as previsões costumam errar. Uma previsão sem a data em que foi feita não
                  permite saber se ela foi cumprida.
                </>
              }
              oQueMudou={
                <>
                  {mudancaCronograma(g)} {notaDatasCronograma(g)}
                </>
              }
              comoInterpretar={
                <>
                  Previsão de operação comercial é a previsão da fiscalização da ANEEL por unidade geradora, sempre com a data da fotografia do RALIE em que foi registrada. Confiabilidade: de cada fotografia mensal (a última do mês), a
                  potência com previsão para os 12 meses seguintes e quanto dela foi liberada para operação comercial até o fim desses 12 meses, depois disso ou não foi liberada até a data do arquivo de liberações; só entram janelas
                  encerradas há pelo menos 15 dias. {g.regras.data_em_bloco}
                  <span data-nivel="analisar" className="mt-2 block">
                    Regras como a base publicada as escreve: {g.regras.previsao} {g.regras.confiabilidade}
                  </span>
                </>
              }
              naoConcluir={
                <>
                  A data provável de entrada de uma usina: a previsão é da fiscalização, e boa parte da carteira tem data convencional atribuída em bloco. A confiabilidade passada não é
                  probabilidade para as previsões atuais. O desvio em relação ao prazo outorgado não é atraso: em autorizações recentes esse prazo é um limite anos à frente.
                </>
              }
              proveniencia={p.previsoes}
              complementares={[
                { rotulo: "Confiabilidade das previsões", p: p.confiabilidade },
                { rotulo: "Desvio em relação ao prazo vigente", p: p.desvio_prazo_vigente },
                { rotulo: "Carteira do RALIE", p: p.ralie },
              ]}
            >
              <div className="space-y-6">
                <RespostaCurta id="p041" veredito={vereditoCronograma(g) || respostaCronograma(g)}>
                  {respostaCronograma(g)}
                </RespostaCurta>
                <ExpansaoRecorte
                  periodo={
                    <>
                      Previsões da fotografia de {dataRalie}; confiabilidade de {dataTexto(conf[0]?.ralie as string | undefined)} a {dataTexto(ult?.ralie)}, com liberações até{" "}
                      {dataTexto(g.referencias.liberacoes_ultima_data)}
                    </>
                  }
                  universo={
                    <>
                      Unidades geradoras em implantação acompanhadas pelo RALIE ({inteiro(g.estagios.ralie.ugs)} na fotografia atual); {inteiro(c.historico_fonte.fotografias_mensais)} fotografias mensais
                    </>
                  }
                  unidade="MW das unidades geradoras e % da potência; datas com a data-base da previsão"
                />
                <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
                  <Numero
                    rotulo="Da potência prevista para 12 meses, liberada no prazo"
                    natureza="CALCULADO"
                    evidencia={g.evidencias.confiabilidade_ultima ?? null}
                    formato="pct"
                    unidade=""
                    casas={1}
                    tamanho="medio"
                    endereco="/setor-eletrico/expansao/cronograma#p041"
                    motivoAusencia="Sem janela de 12 meses encerrada nesta publicação."
                    nota={ult ? `Previsões da fotografia de ${dataTexto(ult.ralie)}; janela até ${dataTexto(ult.fim_janela)}.` : undefined}
                  />
                  <div className="space-y-2 border border-linha bg-superficie p-5 text-sm leading-relaxed text-carvao">
                    <p className="rotulo text-mineral">Data-base preservada</p>
                    <p>
                      Cada previsão deste painel sai com a data da fotografia do RALIE em que foi registrada, de {dataTexto(c.historico_fonte.primeira_fotografia)} a {dataTexto(c.historico_fonte.ultima_fotografia)}. Previsões
                      anteriores a {dataTexto(c.historico_fonte.primeira_fotografia)} não são reconstruídas com o estoque atual.
                    </p>
                    <p className="text-carvao-muted" data-contagem="fotografias">
                      {textoContagemFotografias(g)}
                    </p>
                    <p className="text-carvao-muted" data-nivel="analisar">
                      O observatório também guarda a previsão de cada unidade a cada captura do RALIE atual, desde {dataTexto(c.historico_proprio.primeira_captura)} ({inteiro(c.historico_proprio.capturas)}{" "}
                      {c.historico_proprio.capturas === 1 ? "captura" : "capturas"}; {inteiro(c.historico_proprio.ugs_com_previsao_revisada)} previsões revisadas até aqui).
                    </p>
                  </div>
                </div>

                <ExpansaoSubtitulo>Quando deve entrar, segundo a fotografia de {dataRalie}</ExpansaoSubtitulo>
                <ExpansaoPrevisoes porAno={linhasPrevisoesAno(g)} proximos={linhasProximos24(g)} dataRalie={dataRalie} fonte={FONTE_RALIE} />
                <ExpansaoNota>
                  {pa.datas_em_bloco.regra} Na fotografia atual: {pa.datas_em_bloco.datas.map(dataTexto).join(", ")}, com {inteiro(pa.datas_em_bloco.ugs)} unidades e {mwTexto(pa.datas_em_bloco.mw)}.
                </ExpansaoNota>
                <TabelaInterativa
                  titulo={`Datas de previsão mais frequentes, fotografia de ${dataRalie}`}
                  colunas={COLUNAS_DATAS_FREQUENTES}
                  linhas={linhasDatasFrequentes(g)}
                  chaveLinha="id"
                  colunaRotulo="data"
                  fonte={FONTE_RALIE}
                  versao={dataRalie}
                  nomeArquivo="expansao-datas-previsao-frequentes"
                  chaveUrl="cro.dat"
                />

                <ExpansaoSubtitulo>O que atrasou: previsões datadas contra a liberação comercial real</ExpansaoSubtitulo>
                <ExpansaoRevisoes
                  confiabilidade={conf}
                  deslizamentoCom={linhasDeslizamento(g, "com")}
                  deslizamentoSem={linhasDeslizamento(g, "sem")}
                  dataLiberacoes={dataLib}
                  fonte={`${FONTE_RALIE}; ${FONTE_LIBERACOES}`}
                />
                <ExpansaoNota>
                  As janelas mais recentes tiveram menos tempo para a liberação &quot;depois do prazo&quot;. Unidade renumerada entre a fotografia e a liberação aparece como não liberada.{" "}
                  {inteiro(c.historico_fonte.ugs_atipicas_excluidas_das_fotografias_mensais)} unidades de usinas com potência fora de escala no arquivo histórico ficam fora destas contas.
                </ExpansaoNota>
                {ult && (
                  <GraficoBarras
                    titulo={`Liberado no prazo por tipo, previsões da fotografia de ${dataTexto(ult.ralie)} para 12 meses (% da potência prevista)`}
                    dados={linhasConfiabilidadeTipo(g)}
                    chaveCategoria="id"
                    chaveRotulo="tipo"
                    series={[{ id: "pct_no_prazo", rotulo: "Liberado no prazo", cor: "var(--cor-energia)" }]}
                    unidade="%"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                )}
                <ExpansaoNota>Tipos com pouca potência prevista (algumas unidades) dão percentuais extremos: a potência prevista de cada tipo está na tabela do gráfico.</ExpansaoNota>

                <ExpansaoTabelaSimples
                  titulo={`Situação do cronograma atribuída pela fiscalização, fotografia de ${dataRalie}`}
                  cabecalho={["Situação", "Usinas", "Potência outorgada (MW)"]}
                  linhas={c.por_situacao_cronograma.map((s) => [s.situacao, inteiro(s.usinas), mwTexto(s.mw_outorgado)])}
                />
                <TabelaInterativa
                  titulo={`Maiores usinas com cronograma atrasado, fotografia de ${dataRalie}`}
                  colunas={COLUNAS_ATRASADAS}
                  linhas={linhasAtrasadas(g)}
                  chaveLinha="id"
                  colunaRotulo="nome"
                  fonte={FONTE_RALIE}
                  versao={dataRalie}
                  nomeArquivo="expansao-usinas-atrasadas"
                  chaveUrl="cro.atr"
                  ordemInicial={{ coluna: "mw_outorgado", direcao: "desc" }}
                  dicaBusca="Nome da usina, tipo ou UF"
                  nota={`Previsão e data outorgada da última unidade da usina; a diferença tem data-base (a fotografia de ${dataRalie}). Previsão em data em bloco é a data convencional da fiscalização, não cronograma de obra; sem previsão, a diferença fica sem dado.`}
                />

                <ExpansaoAnalise titulo="Quanto da carteira está prevista depois da data outorgada" id="previsto-x-outorgado">
                  <ExpansaoNota>
                    Na fotografia de {dataRalie}, {pctTexto(at.pct_mw_apos_outorgado)} da potência com previsão ({mwTexto(at.mw_com_previsao)}) está prevista para depois da data outorgada, com mediana
                    ponderada de {diasTexto(at.mediana_dias_ponderada)}. Sem as unidades em data em bloco, a parcela é {pctTexto(at.sem_datas_em_bloco.pct_mw_apos_outorgado)} de{" "}
                    {mwTexto(at.sem_datas_em_bloco.mw_com_previsao)}, com mediana de {diasTexto(at.sem_datas_em_bloco.mediana_dias_ponderada)}. A diferença entre as duas leituras é o efeito da data
                    convencional: isso descreve a classificação da fiscalização, não o cronograma das obras.
                  </ExpansaoNota>
                  <GraficoBarras
                    titulo={`Unidades sem previsão da fiscalização, por justificativa, fotografia de ${dataRalie} (MW)`}
                    dados={linhasSemPrevisao(g)}
                    chaveCategoria="id"
                    chaveRotulo="justificativa"
                    series={[{ id: "mw", rotulo: "Unidades sem previsão", cor: "var(--serie-comp-3)" }]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <GraficoLinhas
                    titulo="Potência com previsão em data em bloco, por fotografia mensal (MW)"
                    dados={blocoFoto.map((b) => ({ ralie: b.ralie, mw: b.mw, ugs: b.ugs }))}
                    chaveX="ralie"
                    formatoX="data"
                    series={[{ id: "mw", rotulo: "Potência em datas em bloco", sigla: "Em bloco", cor: "var(--serie-comp-3)" }]}
                    unidade="MW"
                    casas={1}
                    zeroNoEixo
                    zoom
                  />
                  {ultimoBloco?.maior && (
                    <ExpansaoNota>
                      Na fotografia de {dataTexto(ultimoBloco.ralie)}, a maior data em bloco é {dataTexto(ultimoBloco.maior.data)}, atribuída a {inteiro(ultimoBloco.maior.usinas)} usinas,{" "}
                      {diasTexto(ultimoBloco.maior.dias_depois_da_fotografia)} depois da fotografia. {g.regras.deslizamento}
                    </ExpansaoNota>
                  )}
                </ExpansaoAnalise>

                <ExpansaoAnalise titulo="Liberação comercial contra o prazo outorgado vigente (desvio, não atraso)" id="desvio-prazo">
                  <ExpansaoNota>{c.desvio_prazo_vigente.definicao}</ExpansaoNota>
                  <GraficoBarras
                    titulo={`Potência liberada depois e antes do prazo outorgado vigente, por ano da liberação (% da potência com data outorgada)`}
                    dados={linhasDesvioPrazo(g)}
                    chaveCategoria="id"
                    chaveRotulo="ano"
                    series={[
                      { id: "pct_depois", rotulo: "Depois do prazo vigente", cor: "var(--escala-div-neg-1)" },
                      { id: "pct_antes", rotulo: "Antes do prazo vigente", cor: "var(--cor-energia)" },
                    ]}
                    unidade="%"
                    casas={1}
                  />
                  <TabelaInterativa
                    titulo="Desvio da liberação comercial em relação ao prazo outorgado vigente, por ano"
                    colunas={COLUNAS_DESVIO_PRAZO}
                    linhas={linhasDesvioPrazo(g)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte={FONTE_LIBERACOES}
                    versao={dataLib}
                    nomeArquivo="expansao-desvio-prazo-vigente"
                    chaveUrl="cro.dsv"
                    nota="O denominador dos percentuais é a potência com data outorgada; as linhas sem data outorgada ficam à parte. Ano parcial marcado. Mediana negativa é liberação antes do prazo."
                  />
                </ExpansaoAnalise>

                <ExpansaoAuditoria titulo="Regras, cobertura e limitações" id="auditoria-cronograma">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    <li>{g.regras.previsao}</li>
                    <li>{g.regras.confiabilidade}</li>
                    <li>{g.regras.deslizamento}</li>
                    <li>{g.regras.data_em_bloco}</li>
                    <li>{g.regras.desvio_prazo_vigente}</li>
                  </ul>
                  <ExpansaoNota>
                    Histórico da fonte: {inteiro(c.historico_fonte.fotografias)} fotografias ({inteiro(c.historico_fonte.fotografias_mensais)} mensais) de {dataTexto(c.historico_fonte.primeira_fotografia)} a{" "}
                    {dataTexto(c.historico_fonte.ultima_fotografia)}. Liberações detalhadas contra o resumo anual oficial desde {g.conferencias.liberacoes_detalhado_x_resumo.desde}:{" "}
                    {inteiro(g.conferencias.liberacoes_detalhado_x_resumo.iguais)} de {inteiro(g.conferencias.liberacoes_detalhado_x_resumo.grupos_ano_tipo)} grupos (ano e tipo) iguais, tolerância de{" "}
                    {g.conferencias.liberacoes_detalhado_x_resumo.tolerancia_kw.toLocaleString("pt-BR")} kW; resultado: {g.conferencias.liberacoes_detalhado_x_resumo.resultado}.
                  </ExpansaoNota>
                  <p className="rotulo text-mineral">Limitações declaradas na proveniência</p>
                  <ExpansaoLimitacoes itens={[...p.previsoes.limitacoes, ...p.confiabilidade.limitacoes, ...p.desvio_prazo_vigente.limitacoes]} />
                </ExpansaoAuditoria>

                <ExpansaoSeguir id="p041" downloads={downloadsDe(g, DOWNLOADS_PAINEL.p041)} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
