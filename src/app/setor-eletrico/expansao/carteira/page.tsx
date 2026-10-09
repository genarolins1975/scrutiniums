import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ExpansaoCarteiraUf } from "@/components/energia/ExpansaoCarteira";
import { ExpansaoMapaUsinas } from "@/components/energia/ExpansaoMapas";
import {
  ExpansaoAnalise,
  ExpansaoAuditoria,
  ExpansaoDatas,
  ExpansaoIndisponivel,
  ExpansaoLimitacoes,
  ExpansaoNavegacao,
  ExpansaoNota,
  ExpansaoRecorte,
  ExpansaoSeguir,
  ExpansaoTabelaSimples,
  tamanhoPublicado,
} from "@/components/energia/ExpansaoPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_COORTES,
  COLUNAS_ENCERRAMENTOS,
  COLUNAS_ESTAGIOS_TIPO,
  COLUNAS_JUSTIFICATIVAS,
  COLUNAS_OBRA_VIABILIDADE,
  COR_DESFECHO,
  DESFECHOS,
  DOWNLOADS_PAINEL,
  FONTE_ATOS,
  FONTE_LIBERACOES,
  FONTE_RALIE,
  FONTE_SIGA,
  NOTA_ETAPAS,
  ROTULO_DESFECHO,
  dadosHistoricoCarteira,
  dataTexto,
  downloadsDe,
  inteiro,
  linhasCarteiraUf,
  linhasCoortes,
  linhasEncerramentos,
  linhasEstagios,
  linhasEstagiosTipo,
  linhasJustificativas,
  linhasObraViabilidade,
  marcosAtipicos,
  mesTexto,
  metricasEtapas,
  mudancaCarteira,
  mwTexto,
  notaEtapa,
  notaRalieSiga,
  numTexto,
  painel,
  pctTexto,
  estagio,
  respostaCarteira,
  semNomeDeCampo,
  vereditoCarteira,
  type MetricaEtapa,
  provenienciasDoLeitor,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Carteira de projetos de geração: outorgado, em construção, em operação e encerrado",
  description:
    "Usinas do SIGA por estágio (outorgado sem obra, em construção, em operação), carteira do RALIE por situação da obra e viabilidade, desfecho das usinas acompanhadas desde a primeira fotografia do RALIE e outorgas revogadas ou extintas, por tipo e UF, com mapa e tabelas.",
  alternates: { canonical: "/setor-eletrico/expansao/carteira" },
};

const URL_PONTOS = "/energia/series/expansao_usinas_pontos.json";

/** Cor de identificação de cada etapa na faixa de métricas (a mesma do gráfico por UF); nunca é cor de texto. */
const COR_ETAPA: Record<string, string> = {
  operacao: "var(--cor-mineral)",
  construcao: "var(--cor-energia)",
  construcao_nao_iniciada: "var(--serie-comp-3)",
};

export default function CarteiraPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const e = g.estagios;
  const r = e.ralie;
  const enc = e.encerramentos;
  const p = provenienciasDoLeitor(g);
  const ev = g.evidencias;
  const pp = painel("p040");
  const hist = dadosHistoricoCarteira(e.historico_mensal);
  const atip = e.unidades_atipicas;
  const rec = g.capacidade_instalada.reconciliacao;
  const etapas = metricasEtapas(g);
  const dataSiga = dataTexto(e.data_referencia);
  const evidenciaDe = (m: MetricaEtapa) => (m.id === "operacao" ? ev.capacidade_total : m.id === "construcao_nao_iniciada" ? ev.outorgado_sem_obra : undefined);
  const oQueMudou = mudancaCarteira(g);
  const comoInterpretar = (
    <>
      Estágio é a fase da usina no SIGA na data do arquivo; as três fases são disjuntas. A carteira do RALIE é o acompanhamento da fiscalização das usinas em implantação, com a situação da
      obra e a viabilidade atribuídas pela ANEEL. O desfecho de cada coorte pondera as usinas pela potência das unidades em implantação na primeira fotografia, limitada à outorga.{" "}
      {g.regras.outorga}
    </>
  );
  const naoConcluir = (
    <>
      Quanto da carteira vai entrar, nem quando: o desfecho das coortes passadas descreve o que aconteceu com elas, não é probabilidade para a carteira atual. Também não permite somar a
      carteira ao parque em operação como capacidade futura, nem converter MW em energia.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao-carteira" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <ExpansaoNavegacao atual="p040" />
        <CabecalhoModulo
          siglas={["RALIE", "SIGA", "CEG", "ANEEL", "IBGE"]}
          rotulo="Expansão"
          titulo={pp.pergunta}
          lead="Etapas do SIGA, carteira do RALIE e desfecho das usinas acompanhadas, em potência fiscalizada na operação e outorgada no restante."
          recorte={`SIGA de ${dataSiga} · RALIE de ${dataTexto(r.data_ralie)} · MW`}
          fonte="ANEEL, SIGA, RALIE e atos de outorga"
          referencia={
            <>
              SIGA da ANEEL de {dataTexto(g.referencias.siga)}; RALIE na fotografia de {dataTexto(g.referencias.ralie)}, com histórico desde {dataTexto(g.referencias.ralie_historico_desde)}; atos de outorga até{" "}
              {dataTexto(g.referencias.atos)}; liberações comerciais até {dataTexto(g.referencias.liberacoes_ultima_data)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <ExpansaoDatas
              itens={[
                { rotulo: "SIGA", texto: `até ${dataSiga}`, natureza: "OBSERVADO" },
                { rotulo: "RALIE", texto: `fotografia de ${dataTexto(g.referencias.ralie)}, histórico desde ${dataTexto(g.referencias.ralie_historico_desde)}`, natureza: "OBSERVADO" },
                { rotulo: "Atos de outorga", texto: `até ${dataTexto(g.referencias.atos)}`, natureza: "OBSERVADO" },
                { rotulo: "Liberações comerciais", texto: `até ${dataTexto(g.referencias.liberacoes_ultima_data)}`, natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={5} rotulo="Indicadores da carteira" nota={<>{NOTA_ETAPAS} {notaRalieSiga(g)}</>}>
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
                  endereco="/setor-eletrico/expansao/carteira#p040"
                />
              ))}
              <Numero
                variante="faixa"
                rotulo="Unidades em implantação no RALIE"
                natureza="CALCULADO"
                evidencia={ev.ralie_em_implantacao ?? null}
                casas={1}
                unidade="MW"
                periodo={`RALIE de ${dataTexto(r.data_ralie)}`}
                cor="var(--serie-referencia)"
                nota="Outro retrato da carteira: unidades geradoras, não usinas."
                motivoAusencia="Sem a fotografia do RALIE nesta publicação."
                endereco="/setor-eletrico/expansao/carteira#p040"
              />
              <Numero
                variante="faixa"
                rotulo={`Em implantação em ${dataTexto(g.referencias.ralie_historico_desde)}, entrou em operação`}
                natureza="CALCULADO"
                evidencia={ev.coorte_inicial_operacao ?? null}
                formato="pct"
                casas={1}
                unidade="da potência"
                periodo={`até ${dataTexto(g.referencias.ralie)}`}
                cor="var(--serie-comp-4)"
                nota="Coorte da primeira fotografia: o resto teve a outorga encerrada, segue em implantação ou saiu sem desfecho."
                motivoAusencia="Sem o desfecho das coortes nesta publicação."
                endereco="/setor-eletrico/expansao/carteira#p040"
              />
            </FaixaMetricas>
          }
        >
          O que está outorgado, o que está em obra, o que já opera e o que teve a outorga revogada ou extinta. Outorga não é obra, e obra não é entrada certa; o desfecho das usinas
          acompanhadas pelo RALIE desde {dataTexto(g.referencias.ralie_historico_desde)} aparece ao lado da carteira.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="carteira">
            <PainelEvidencia
              id="p040"
              pergunta="Etapas: quanto está outorgado, em obra e em operação"
              subtitulo="Usinas e potência por estágio do SIGA, carteira do RALIE e desfecho das usinas acompanhadas · MW"
              porQueImporta={
                <>
                  A carteira mostra o que pode vir a operar e onde. Lida como capacidade certa, ela superestima a expansão: parte das outorgas é revogada antes da obra, e potência
                  instalada em MW não é energia entregue nem garantia física.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={p.estagios}
              complementares={[
                { rotulo: "Carteira do RALIE", p: p.ralie },
                { rotulo: "Desfecho das coortes", p: p.coortes },
                { rotulo: "Outorgas encerradas", p: p.encerramentos },
                { rotulo: "Capacidade em operação", p: p.capacidade },
              ]}
            >
              <div className="space-y-6">
                <RespostaCurta id="p040" veredito={vereditoCarteira(g) || respostaCarteira(g)}>
                  {respostaCarteira(g)}
                </RespostaCurta>
                {estagio(g, "operacao") && (
                  <ExpansaoNota>
                    Em operação aparecem dois valores porque a medida muda: o cartão mostra a potência fiscalizada ({mwTexto(estagio(g, "operacao")?.mw_fiscalizado)}) e o gráfico, a outorgada ({mwTexto(estagio(g, "operacao")?.mw_outorgado)}),
                    a mesma das outras duas fases.
                  </ExpansaoNota>
                )}
                <GraficoBarras
                  titulo={`Usinas do SIGA por estágio, ${dataSiga} (MW outorgado)`}
                  dados={linhasEstagios(g)}
                  chaveCategoria="id"
                  chaveRotulo="rotulo"
                  series={[{ id: "mw_outorgado", rotulo: "Potência outorgada", cor: "var(--cor-energia)" }]}
                  unidade="MW"
                  casas={1}
                  orientacao="horizontal"
                  rotulosValor
                />
                <ExpansaoNota>
                  A mesma medida nas três fases (potência outorgada) para que as etapas se comparem; a potência fiscalizada, que só existe para o que opera, está na tabela do gráfico. A
                  fase não é um funil com entrada garantida: desde {enc.desde}, {inteiro(enc.total.atos)} atos revogaram ou extinguiram outorgas de {inteiro(enc.total.usinas)} usinas (
                  {mwTexto(enc.total.mw_usinas)}).
                </ExpansaoNota>
                <ExpansaoRecorte
                  periodo={
                    <>
                      SIGA de {dataSiga}; RALIE de {dataTexto(r.data_ralie)}; desfechos de {dataTexto(g.referencias.ralie_historico_desde)} a {dataTexto(g.referencias.ralie)}
                    </>
                  }
                  universo={
                    <>
                      Usinas do SIGA nas fases Operação, Construção e Construção não iniciada; {inteiro(r.usinas)} usinas e {inteiro(r.ugs)} unidades geradoras no RALIE
                    </>
                  }
                  unidade="MW de potência (outorgada para a carteira, fiscalizada para a operação); não é energia"
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="coortes" titulo="O que aconteceu com a potência que estava em implantação?">
                  <GraficoBarras
                    titulo={`Desfecho das usinas acompanhadas pelo RALIE, por coorte, até ${dataTexto(g.referencias.ralie)} (% da potência em implantação na primeira fotografia)`}
                    dados={linhasCoortes(g)}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={DESFECHOS.map((d) => ({ id: `pct_${d}`, rotulo: ROTULO_DESFECHO[d], cor: COR_DESFECHO[d] }))}
                    unidade="%"
                    casas={1}
                    orientacao="horizontal"
                    empilhado
                    rotulosValor
                  />
                  <ExpansaoNota>
                    Coorte é o grupo de usinas que entrou no acompanhamento do RALIE no mesmo ano; a primeira é o estoque da primeira fotografia. Coortes recentes tiveram menos tempo para chegar à operação: a parcela que segue em implantação é maior nelas por construção, não por pior desempenho. Percentuais
                    arredondados a uma casa; a soma de cada barra pode diferir de 100 por arredondamento. Das usinas que saíram sem desfecho,{" "}
                    {e.sem_desfecho_no_siga.map((s) => `${inteiro(s.usinas)} ${s.situacao_siga === "ausente do SIGA" ? "estão fora do arquivo aberto do SIGA" : `estão na fase ${s.situacao_siga} do SIGA`} (${mwTexto(s.mw_outorgado)} outorgados)`).join("; ")}.
                  </ExpansaoNota>
                  <TabelaInterativa
                    titulo="Desfecho por coorte, com as potências que formam cada parcela"
                    colunas={COLUNAS_COORTES}
                    linhas={linhasCoortes(g)}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte={`${FONTE_RALIE}; ${FONTE_LIBERACOES}; ${FONTE_ATOS}`}
                    versao={g.referencias.ralie}
                    nomeArquivo="expansao-desfecho-coortes"
                    chaveUrl="car.coo"
                    nota={semNomeDeCampo(e.coortes_peso.regra)}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="onde-esta" titulo="Onde está a carteira?">
                  <ExpansaoCarteiraUf
                    linhas={linhasCarteiraUf(g)}
                    data={dataSiga}
                    dataRalie={dataTexto(r.data_ralie)}
                    fonte={`${FONTE_SIGA}; ${FONTE_RALIE}`}
                    multiestaduais={`${inteiro(g.capacidade_instalada.multiestaduais.usinas)} usinas multiestaduais em operação, ${mwTexto(g.capacidade_instalada.multiestaduais.mw_fiscalizado)}`}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="fontes" titulo="De que fontes é a carteira?">
                  <GraficoBarras
                    titulo={`Carteira do SIGA por tipo de geração, ${dataSiga} (MW outorgado)`}
                    dados={linhasEstagiosTipo(g)}
                    chaveCategoria="id"
                    chaveRotulo="nome"
                    series={[
                      { id: "nao_iniciada_mw", rotulo: "Outorgado, construção não iniciada", cor: "var(--serie-comp-3)" },
                      { id: "construcao_mw", rotulo: "Em construção", cor: "var(--cor-energia)" },
                    ]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <ExpansaoNota>
                    As duas etapas aparecem lado a lado, cada uma na sua barra e sem total: são usinas diferentes na mesma medida (MW outorgado). A operação por tipo, também em potência
                    outorgada, está na tabela do modo Analisar; a potência fiscalizada por tipo está no CSV de capacidade em operação.
                  </ExpansaoNota>
                </SecaoDoPainel>

                <SecaoDoPainel id="historico" titulo={`Como a carteira mudou desde ${mesTexto(g.referencias.ralie_historico_desde)}?`}>
                  <GraficoLinhas
                    titulo={`Carteira do RALIE na última fotografia de cada mês, ${mesTexto(hist[0]?.ralie)} a ${mesTexto(hist.at(-1)?.ralie)} (MW)`}
                    dados={hist}
                    chaveX="ralie"
                    formatoX="data"
                    series={[
                      { id: "mw_outorgado", rotulo: "Potência outorgada das usinas", sigla: "Outorgada", cor: "var(--cor-mineral)", tracejada: true },
                      { id: "mw_ugs", rotulo: "Unidades em implantação", sigla: "Unidades", cor: "var(--cor-energia)" },
                      { id: "mw_ugs_sem_previsao", rotulo: "Unidades sem previsão da fiscalização", sigla: "Sem previsão", cor: "var(--serie-comp-3)" },
                    ]}
                    marcos={marcosAtipicos(e.historico_mensal)}
                    unidade="MW"
                    casas={1}
                    zeroNoEixo
                    zoom
                    legendaInterativa
                  />
                  <GraficoLinhas
                    titulo={`Carteira do RALIE por situação da obra, ${mesTexto(hist[0]?.ralie)} a ${mesTexto(hist.at(-1)?.ralie)} (MW outorgado)`}
                    dados={hist}
                    chaveX="ralie"
                    formatoX="data"
                    series={[
                      { id: "obra_nao_iniciada", rotulo: "Obra não iniciada", sigla: "Não iniciada", cor: "var(--serie-comp-3)" },
                      { id: "obra_em_andamento", rotulo: "Obra em andamento", sigla: "Em andamento", cor: "var(--cor-energia)" },
                      { id: "obra_paralisada", rotulo: "Obra paralisada", sigla: "Paralisada", cor: "var(--escala-div-neg-1)", tracejada: true },
                    ]}
                    unidade="MW"
                    casas={1}
                    zeroNoEixo
                    zoom
                    legendaInterativa
                  />
                  <ExpansaoNota>
                    {atip.pares > 0
                      ? `Nas fotografias marcadas, unidades de usinas com potência fora de escala no arquivo histórico (soma de ${numTexto(atip.fator, 0)} vezes a outorga ou mais) foram excluídas dos campos por unidade; a potência outorgada das usinas fica. `
                      : ""}
                    Fotografias com intervalo irregular: a série usa a última de cada mês.
                  </ExpansaoNota>
                </SecaoDoPainel>

                <SecaoDoPainel id="encerramentos" titulo="Quanta potência teve a outorga revogada ou extinta, ano a ano?">
                  <GraficoBarras
                    titulo={`Potência das usinas com outorga revogada ou extinta, por ano de publicação do ato, ${enc.desde} a ${dataTexto(g.referencias.atos)} (MW)`}
                    dados={linhasEncerramentos(enc.por_ano)}
                    chaveCategoria="id"
                    chaveRotulo="ano"
                    series={[{ id: "mw_usinas", rotulo: "Potência das usinas (uma vez por usina)", cor: "var(--escala-div-neg-1)" }]}
                    unidade="MW"
                    casas={1}
                  />
                  <TabelaInterativa
                    titulo="Atos de encerramento por ano"
                    colunas={COLUNAS_ENCERRAMENTOS}
                    linhas={linhasEncerramentos(enc.por_ano)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte={FONTE_ATOS}
                    versao={g.referencias.atos ?? g.referencias.siga}
                    nomeArquivo="expansao-encerramentos-ano"
                    chaveUrl="car.enc"
                    nota={`Ano parcial marcado. Atos sem data de publicação na fonte (${inteiro(enc.sem_data_publicacao.atos)}, ${mwTexto(enc.sem_data_publicacao.mw_usinas)}) ficam fora da série anual e entram no total. Outorga encerrada não é usina retirada: ${enc.usinas_em_operacao_no_siga.nota}`}
                  />
                  <p data-nivel="analisar" className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {enc.regra_tipo}
                  </p>
                </SecaoDoPainel>

                <ExpansaoAnalise titulo="Carteira do RALIE: situação da obra e viabilidade" id="ralie">
                  <GraficoBarras
                    titulo={`Unidades em implantação por situação da obra e viabilidade, fotografia de ${dataTexto(r.data_ralie)} (MW)`}
                    dados={linhasObraViabilidade(g)}
                    chaveCategoria="id"
                    chaveRotulo="obra"
                    series={[
                      { id: "alta", rotulo: "Viabilidade alta", cor: "var(--escala-seq-5)" },
                      { id: "media", rotulo: "Viabilidade média", cor: "var(--escala-seq-3)" },
                      { id: "baixa", rotulo: "Viabilidade baixa", cor: "var(--escala-seq-1)" },
                    ]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    empilhado
                    rotulosValor
                  />
                  <ExpansaoNota>
                    Viabilidade é a classificação da fiscalização da ANEEL. {inteiro(r.leilao.usinas_com_compromisso)} usinas ({mwTexto(r.leilao.mw_outorgado_com_compromisso)} outorgados) têm
                    compromisso de venda em leilão; {inteiro(r.leilao.usinas_sem_compromisso)} não têm. Fase no SIGA das usinas do RALIE:{" "}
                    {r.fase_no_siga.map((f) => `${f.fase} ${inteiro(f.usinas)}`).join("; ")}.
                  </ExpansaoNota>
                  <GraficoBarras
                    titulo={`Por que a previsão está como está: justificativa da fiscalização, fotografia de ${dataTexto(r.data_ralie)} (MW das unidades)`}
                    dados={linhasJustificativas(g)}
                    chaveCategoria="id"
                    chaveRotulo="justificativa"
                    series={[{ id: "mw", rotulo: "Unidades em implantação", cor: "var(--cor-energia)" }]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <TabelaInterativa
                    titulo={`Situação da obra e viabilidade, ${dataTexto(r.data_ralie)}`}
                    colunas={COLUNAS_OBRA_VIABILIDADE}
                    linhas={linhasObraViabilidade(g)}
                    chaveLinha="id"
                    colunaRotulo="obra"
                    fonte={FONTE_RALIE}
                    versao={r.data_ralie}
                    nomeArquivo="expansao-ralie-obra-viabilidade"
                    chaveUrl="car.obr"
                    nota="Combinação de obra e viabilidade sem usina é zero observado: o cruzamento cobre todas as usinas do RALIE."
                  />
                  <TabelaInterativa
                    titulo={`Justificativas da previsão, ${dataTexto(r.data_ralie)}`}
                    colunas={COLUNAS_JUSTIFICATIVAS}
                    linhas={linhasJustificativas(g)}
                    chaveLinha="id"
                    colunaRotulo="justificativa"
                    fonte={FONTE_RALIE}
                    versao={r.data_ralie}
                    nomeArquivo="expansao-ralie-justificativas"
                    chaveUrl="car.jus"
                  />
                </ExpansaoAnalise>

                <ExpansaoAnalise titulo="Carteira e operação por tipo de geração" id="por-tipo">
                  <TabelaInterativa
                    titulo={`Carteira e operação por tipo de geração (SIGA de ${dataSiga})`}
                    colunas={COLUNAS_ESTAGIOS_TIPO}
                    linhas={linhasEstagiosTipo(g)}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={FONTE_SIGA}
                    versao={g.referencias.siga}
                    nomeArquivo="expansao-estagios-tipo"
                    chaveUrl="car.tip"
                    ordemInicial={{ coluna: "construcao_mw", direcao: "desc" }}
                    nota="As três etapas na mesma medida (MW outorgado), cada uma em colunas próprias e sem total. A potência fiscalizada da operação por tipo está no CSV de capacidade em operação."
                  />
                </ExpansaoAnalise>

                <ExpansaoAnalise titulo="Mapa das usinas" id="mapa-usinas">
                  <ExpansaoMapaUsinas url={URL_PONTOS} tamanho={tamanhoPublicado(URL_PONTOS)} dataSiga={dataSiga} fonte={FONTE_SIGA} />
                </ExpansaoAnalise>

                <ExpansaoAuditoria titulo="Regras, conferências e ressalvas" id="auditoria-carteira">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    <li>{datasLegiveis(g.regras.estagio)}</li>
                    <li>{datasLegiveis(g.regras.encerramentos)}</li>
                    <li>{datasLegiveis(g.regras.potencia)}</li>
                  </ul>
                  <ExpansaoTabelaSimples
                    titulo={`Reconciliação do SIGA com o agregado oficial "empreendimentos em operação" (${mesTexto(rec.referencia_tipo)}), por tipo`}
                    cabecalho={["Tipo", "SIGA (MW)", "Agregado (MW)", "Liberado no intervalo (MW)", "Resíduo (MW)", "Resíduo (%)"]}
                    linhas={rec.por_tipo.map((t) => [t.tipo, numTexto(t.siga_mw, 1), numTexto(t.agregado_mw, 1), numTexto(t.liberado_no_intervalo_mw, 1), numTexto(t.residuo_mw, 1), pctTexto(t.residuo_pct, 2)])}
                  />
                  <ExpansaoNota>
                    Liberações descontadas de {dataTexto(rec.janela_tipo?.liberacoes_descontadas.inicio)} a {dataTexto(rec.janela_tipo?.liberacoes_descontadas.fim)}
                    {rec.janela_tipo?.sem_liberacoes_publicadas
                      ? `; de ${dataTexto(rec.janela_tipo.sem_liberacoes_publicadas.inicio)} a ${dataTexto(rec.janela_tipo.sem_liberacoes_publicadas.fim)} não há liberação publicada, e o que entrou fica no resíduo`
                      : ""}
                    . Tolerância: {rec.justificativa_tolerancia} Fora da tolerância: tipos {rec.fora_da_tolerancia.tipos.length ? rec.fora_da_tolerancia.tipos.join(", ") : "nenhum"}; UF{" "}
                    {rec.fora_da_tolerancia.ufs.length ? rec.fora_da_tolerancia.ufs.join(", ") : "nenhuma"}.
                  </ExpansaoNota>
                  <ExpansaoNota>
                    RALIE atual contra o Parquet histórico da mesma fotografia ({dataTexto(g.conferencias.ralie_csv_x_parquet.fotografia)}): {inteiro(g.conferencias.ralie_csv_x_parquet.ugs_iguais)} de{" "}
                    {inteiro(g.conferencias.ralie_csv_x_parquet.ugs_csv)} unidades iguais, {mwTexto(g.conferencias.ralie_csv_x_parquet.mw_csv, 3)} contra {mwTexto(g.conferencias.ralie_csv_x_parquet.mw_parquet, 3)};
                    resultado: {g.conferencias.ralie_csv_x_parquet.resultado}.
                  </ExpansaoNota>
                  <ExpansaoTabelaSimples
                    titulo={`Unidades fora de escala no Parquet histórico (soma das unidades ${numTexto(atip.fator, 0)} vezes a outorga ou mais), conferidas nas fotografias vizinhas`}
                    cabecalho={["Usina", "Fotografia", "Unidades", "Soma das unidades (MW)", "Outorga (MW)", "Fotografia seguinte"]}
                    linhas={atip.casos.map((c) => [
                      `${c.nome ?? c.nucleo} (${c.tipo ?? "tipo sem dado"})`,
                      `${dataTexto(c.ralie)}${c.fotografia_mensal ? " (mensal)" : ""}`,
                      inteiro(c.ugs),
                      numTexto(c.mw_ugs, 1),
                      numTexto(c.mw_outorgado, 1),
                      c.seguinte ? `${dataTexto(c.seguinte.ralie)}: ${inteiro(c.seguinte.ugs)} unidades, ${mwTexto(c.seguinte.mw_ugs, 2)}` : "sem fotografia seguinte",
                    ])}
                  />
                  <ExpansaoNota>{atip.regra}</ExpansaoNota>
                  <ExpansaoTabelaSimples
                    titulo="Atos de encerramento com potência corrigida (kW no campo de MW) ou fora da soma"
                    cabecalho={["Usina", "Publicação", "Tipo no ato", "Tipo no SIGA", "MW no ato", "MW usado", "Motivo"]}
                    linhas={[...enc.potencia_conferida.corrigidas_kw, ...enc.potencia_conferida.fora_da_soma].map((a) => [
                      a.nome ?? a.chave,
                      dataTexto(a.publicacao),
                      a.tipo ?? "sem dado",
                      a.tipo_no_cadastro ?? "fora do SIGA",
                      numTexto(a.mw_no_ato, 3),
                      a.mw_usado === null ? "fora da soma" : numTexto(a.mw_usado, 3),
                      a.motivo ?? "",
                    ])}
                  />
                  <ExpansaoNota>
                    {enc.potencia_conferida.regra}. Repetições: {inteiro(enc.repeticoes.usinas_com_mais_de_um_ato)} usinas com mais de um ato; somar por ato repetiria{" "}
                    {mwTexto(enc.repeticoes.mw_que_a_soma_por_ato_repetiria)}. {enc.sem_chave_de_usina.nota} ({inteiro(enc.sem_chave_de_usina.atos)} atos, {mwTexto(enc.sem_chave_de_usina.mw_usado)}).
                    Tipo do ato diferente do tipo atual no SIGA em {inteiro(enc.tipo_do_ato_diferente_do_cadastro.atos)} atos:{" "}
                    {enc.tipo_do_ato_diferente_do_cadastro.pares.map((x) => `${x.tipo_no_ato} no ato e ${x.tipo_no_cadastro} no SIGA (${x.outorga_no_siga ?? "outorga sem dado"}), ${inteiro(x.atos)}`).join("; ")}.
                  </ExpansaoNota>
                  <ExpansaoNota>
                    Peso das coortes: {inteiro(e.coortes_peso.usinas_com_peso_limitado_pela_outorga)} usinas tiveram o peso limitado pela outorga; {inteiro(e.coortes_peso.usinas_que_ja_operavam)} eram
                    ampliações de usinas que já operavam, {inteiro(e.coortes_peso.usinas_que_ja_operavam_em_operacao_no_siga_sem_liberacao)} delas em operação no SIGA sem a liberação das unidades da
                    ampliação. Pares (fotografia, usina) com a soma das unidades entre {numTexto(atip.mantidos_entre_atencao_e_fator.fator_minimo, 1)} e {numTexto(atip.fator, 0)} vezes a
                    outorga ficam como estão ({inteiro(atip.mantidos_entre_atencao_e_fator.pares)} pares de {inteiro(atip.mantidos_entre_atencao_e_fator.usinas)} usinas), por não terem a assinatura de
                    erro de ordem de grandeza.
                  </ExpansaoNota>
                  <p className="rotulo text-mineral">Ressalvas da validação desta publicação</p>
                  <ExpansaoLimitacoes itens={g.ressalvas} />
                  <p className="rotulo text-mineral">Limitações declaradas na proveniência</p>
                  <ExpansaoLimitacoes itens={[...p.estagios.limitacoes, ...p.ralie.limitacoes, ...p.coortes.limitacoes]} />
                </ExpansaoAuditoria>

                <ExpansaoSeguir id="p040" downloads={downloadsDe(g, DOWNLOADS_PAINEL.p040)} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
