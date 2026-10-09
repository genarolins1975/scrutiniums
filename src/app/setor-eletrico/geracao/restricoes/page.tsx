import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import {
  GeracaoAviso,
  GeracaoDatas,
  GeracaoFrases,
  GeracaoIndisponivel,
  GeracaoNavegacao,
  GeracaoRegras,
  GeracaoSeguir,
} from "@/components/energia/GeracaoPagina";
import { GeracaoRestricoes, GeracaoRestricoesAnalise, type RestricaoAnaliseCliente, type RestricaoCliente } from "@/components/energia/GeracaoRestricoes";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import {
  COLUNAS_DETALHE,
  CURTO_RAZAO,
  FONTES_RESTRICAO,
  NOME_FONTE_RESTRICAO,
  ROTULO_REGRA,
  downloadsDoPainel,
  linhasDetalhe,
  paraTabela,
  perguntaPainel,
  rotaPainel,
  situacaoMensal,
  textoControlesRestricao,
  textoSemComparacaoMensal,
  type FonteRestricao,
} from "@/lib/energia/geracao";
import { integra, lerGold } from "@/lib/energia/gold";
import type { GoldGeracaoDetalhe, Restricao } from "@/lib/energia/tipos-geracao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Geração: quanta geração eólica e solar foi restringida",
  description:
    "Energia eólica e fotovoltaica não gerada por limitação do ONS, estimada sobre a geração de referência, por razão oficial (energética, confiabilidade, elétrica, parecer de acesso), por usina com mapa e por mês, com a taxa sobre a geração possível e o maior corte simultâneo em MW.",
  alternates: { canonical: "/setor-eletrico/geracao/restricoes" },
};

const FONTE = "ONS, Restrição de Operação por Constrained-off de Usinas Eólicas e Fotovoltaicas";
/** Cor de identificação de cada fonte na faixa de métricas (o marcador antes do rótulo, nunca a cor do texto). */
const COR_FONTE: Record<FonteRestricao, string> = { eolica: "var(--serie-eolica)", solar: "var(--serie-solar)" };

export default function GeracaoRestricoesPage() {
  const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json");
  const rs = integra(g) ? g.restricoes : null;
  const restricoes: Partial<Record<FonteRestricao, Restricao>> = {};
  if (rs?.eolica) restricoes.eolica = rs.eolica;
  if (rs?.solar) restricoes.solar = rs.solar;
  const fontes = FONTES_RESTRICAO.filter((f) => restricoes[f]);
  if (!integra(g) || !fontes.length) {
    return <GeracaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo ?? (g ? "As restrições de eólicas e fotovoltaicas não estão na base publicada nesta atualização." : undefined)} />;
  }
  const ev = g.evidencias;
  const principal = restricoes[fontes[0]]!;
  // cada componente cliente recebe só o que desenha (seção 5.1 do contrato: props pequenas)
  const painel: Partial<Record<FonteRestricao, RestricaoCliente>> = {};
  const analise: Partial<Record<FonteRestricao, RestricaoAnaliseCliente>> = {};
  for (const f of fontes) {
    const { fonte, primeiro_mes, ultimo_mes_completo, mensal_sin, ultimos_12m, usinas_12m, usinas_12m_resumo, diario_recente, descricoes_ultimo_mes } = restricoes[f]!;
    painel[f] = { fonte, primeiro_mes, ultimo_mes_completo, mensal_sin, ultimos_12m, usinas_12m, usinas_12m_resumo };
    analise[f] = { fonte, ultimos_12m, diario_recente, descricoes_ultimo_mes };
  }
  const ultimoMes = fontes.map((f) => restricoes[f]!.ultimo_mes_completo).filter((x): x is string => !!x).sort()[0] ?? null;
  const atual = situacaoMensal(ultimoMes, g.gerado_em, "as restrições de eólicas e fotovoltaicas");
  const versao = ultimoMes ?? g.dia_referencia;
  const prov = fontes[0] === "eolica" ? g.proveniencia.restricao_eolica : g.proveniencia.restricao_solar;
  const provSolar = fontes[0] === "eolica" ? g.proveniencia.restricao_solar : undefined;
  const u12 = principal.ultimos_12m;
  const ultimoDia = principal.diario_recente.dias.at(-1) ?? g.dia_referencia;

  const oQueMudou = <>{textoSemComparacaoMensal(ultimoMes, g.gerado_em, "as restrições de eólicas e fotovoltaicas")}</>;
  const comoInterpretar = (
    <>
      Energia não gerada = geração de referência estimada pelo ONS menos a verificada, só nas meias horas em que o ONS limitou a usina. Taxa = não gerada ÷ (verificada + não gerada), nas mesmas
      usinas e meses: é o denominador documentado, não a capacidade instalada. O maior corte simultâneo é a soma dos cortes de todas as usinas numa mesma meia hora; mede potência, não energia, e
      não se soma ao longo do mês.
    </>
  );
  const naoConcluir = (
    <>
      Que a usina estava indisponível ou que faltou vento ou sol: meia hora sem limitação do ONS não entra, mesmo que a usina tenha gerado abaixo da referência. Que a energia não gerada foi medida: a
      referência é estimativa do ONS. Que a usina no mapa é o lugar onde o corte foi decidido: a marca é a usina afetada, não o ponto da rede que limitou. Que toda razão dá direito a compensação: pela
      regra lida (REN ANEEL nº 1.030/2022, em cópia de 08/01/2025), só a razão de indisponibilidade externa dá direito a <Termo slug="ess">ESS</Termo>, como diz o verbete{" "}
      <Link href="/setor-eletrico/aprenda/constrained-off" className="text-energia-dark underline underline-offset-4">
        Constrained-off
      </Link>
      ; alterações posteriores do ressarcimento não foram verificadas.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="geracao" />
      <MarcaVisita secao="energia:geracao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <GeracaoNavegacao atual="p023" />
        <CabecalhoModulo
          siglas={["SIN", "MMGD", "ONS", "ANEEL", "REN", "ESS", "IBGE"]}
          rotulo="Geração"
          titulo={perguntaPainel("p023")}
          lead={
            <>
              A energia que usinas eólicas e fotovoltaicas deixaram de gerar por limitação do ONS (<Termo slug="constrained-off">constrained-off</Termo>), estimada sobre a geração de referência, e o maior
              corte simultâneo em MW.
            </>
          }
          recorte={u12 ? `${mesAno(u12.inicio)} a ${mesAno(u12.fim)} (12 meses completos) · eólicas e fotovoltaicas despachadas ou programadas pelo ONS · GWh, % e MW` : undefined}
          fonte={FONTE}
          referencia={
            <>
              {FONTE}, até {ultimoMes ? mesAno(ultimoMes) : "mês não publicado"} (último mês completo) e dias até {dataBR(ultimoDia)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <GeracaoDatas
              itens={[
                { rotulo: "Energia não gerada, por mês", texto: `até ${ultimoMes ? mesAno(ultimoMes) : "mês não publicado"} (último mês completo)`, natureza: "ESTIMADO" },
                { rotulo: "Energia não gerada, por dia", texto: `até ${dataBR(ultimoDia)}`, natureza: "ESTIMADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={fontes.length > 1 ? 4 : 2}
              rotulo="Energia não gerada e taxa de restrição, 12 meses completos"
              nota="Denominador: geração verificada mais a não gerada estimada, nas mesmas usinas e meses. Energia e taxa são estimativas do ONS, não medição."
            >
              {fontes.flatMap((f) => {
                const energia = ev[`restricao_${f}_12m_energia`];
                return [
                  <Numero
                    key={`${f}-energia`}
                    variante="faixa"
                    rotulo={`Energia não gerada, ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`}
                    natureza="ESTIMADO"
                    evidencia={energia}
                    valor={energia?.valor_calculo != null ? (energia.valor_calculo as number) / 1e3 : null}
                    unidade="GWh"
                    casas={0}
                    cor={COR_FONTE[f]}
                    endereco={`${rotaPainel("p023")}#p023`}
                  />,
                  <Numero
                    key={`${f}-taxa`}
                    variante="faixa"
                    rotulo={`Taxa de restrição, ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`}
                    natureza="ESTIMADO"
                    evidencia={ev[`restricao_${f}_12m_taxa`]}
                    formato="pct"
                    casas={1}
                    unidade="da geração possível"
                    cor={COR_FONTE[f]}
                    endereco={`${rotaPainel("p023")}#p023`}
                  />,
                ];
              })}
            </FaixaMetricas>
          }
        >
          O ONS limita a geração de usinas eólicas e fotovoltaicas (o que ele chama de <Termo slug="constrained-off">constrained-off</Termo>) e registra a razão de cada limitação em quatro códigos oficiais: elétrica (indisponibilidade externa),
          confiabilidade, energética e parecer de acesso. Este painel estima quanto deixou de ser gerado nessas limitações e separa duas grandezas que costumam ser confundidas:
          a energia não gerada ao longo do tempo (GWh) e o maior corte simultâneo num instante (MW). Restrição não é indisponibilidade da usina nem falta de vento ou de sol.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="restricoes">
            <PainelEvidencia
              id="p023"
              pergunta="Energia não gerada por razão oficial do ONS"
              subtitulo="Energia não gerada por restrição do ONS · GWh, % da geração possível e MW"
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  A energia não gerada mostra quanto da oferta eólica e solar ficou sem uso por decisão da operação, e a razão registrada pelo ONS diz qual tipo de limite
                  prevaleceu em cada caso. Com a expansão dessas fontes, a parcela restringida é um dado central para quem acompanha a operação e o planejamento.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov!}
              complementares={provSolar ? [{ rotulo: "Restrições das fotovoltaicas", p: provSolar }] : []}
            >
              <div className="space-y-6">
                {atual.defasada && <GeracaoAviso tipo="alerta">{atual.texto}</GeracaoAviso>}
                <GeracaoRestricoes
                  restricoes={painel}
                  fonte={FONTE}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  rotulosRazao={Object.fromEntries(g.razoes.map((z) => [z.id, z.rotulo]))}
                />

                <SecaoDoPainel nivel="analisar" id="analise-restricoes" titulo="Razões, origem, subsistemas, os últimos dias e o detalhamento publicado pelo ONS">
                  <GeracaoRestricoesAnalise restricoes={analise} fonte={FONTE} versao={versao} />
                </SecaoDoPainel>

                {fontes.map((f) => {
                  const r = restricoes[f]!;
                  return (
                    <SecaoDoPainel nivel="auditar" key={f} id={`auditoria-${f}`} titulo={`${NOME_FONTE_RESTRICAO[f]}: controles da importação e conferência com o detalhamento por usina`}>
                      <GeracaoFrases itens={textoControlesRestricao(r)} />
                      <p className="text-sm text-carvao-muted">
                        Campo GNRa (geração não realizada apurada) presente em {num(r.gnra.meses_com_campo, 0)} meses desde{" "}
                        {r.gnra.primeiro_mes_com_campo ? mesAno(r.gnra.primeiro_mes_com_campo) : "mês não informado"}; maior diferença mensal entre o campo e a regra:{" "}
                        {num(r.gnra.maior_diferenca_mensal_mwh, 1)} MWh.
                      </p>
                      {r.detalhe && r.detalhe.length > 0 && (
                        <TabelaInterativa
                          chaveUrl={`det-${f}`}
                          titulo={`Detalhamento por usina dos meses mais recentes contra o arquivo principal, ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`}
                          colunas={COLUNAS_DETALHE.map((c) => (c.id === "mes" ? { ...c, id: "id", tipo: "data" as const } : c))}
                          linhas={paraTabela(linhasDetalhe(r))}
                          chaveLinha="id"
                          colunaRotulo="id"
                          fonte={`${FONTE} (detalhamento por usina)`}
                          versao={versao}
                          nomeArquivo={`geracao-restricao-detalhe-${f}`}
                          nota="O ONS publica o detalhamento por usina só para os meses mais recentes; a diferença compara as mesmas usinas e conjuntos nos dois arquivos."
                        />
                      )}
                    </SecaoDoPainel>
                  );
                })}

                <SecaoDoPainel nivel="auditar" id="regras-restricao" titulo="Regras e limitações">
                  <GeracaoRegras regras={[{ rotulo: ROTULO_REGRA.restricao, texto: g.regras.restricao }]} />
                  <GeracaoFrases itens={[...(g.proveniencia.restricao_eolica?.limitacoes ?? []), ...(g.proveniencia.restricao_solar?.limitacoes ?? []).filter((x) => !(g.proveniencia.restricao_eolica?.limitacoes ?? []).includes(x))]} />
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {g.razoes.map((z) => (
                      <li key={z.id}>
                        <span className="text-carvao">{CURTO_RAZAO[z.id]}</span>: {z.rotulo}.
                      </li>
                    ))}
                  </ul>
                  {restricoes.solar && (
                    <p className="text-sm text-carvao-muted">A série das fotovoltaicas começa em {mesAno(restricoes.solar.primeiro_mes)}: antes disso o ONS não publicava o conjunto.</p>
                  )}
                </SecaoDoPainel>

                <GeracaoSeguir ancora="p023" proximo={{ href: `${rotaPainel("p024")}#p024`, pergunta: perguntaPainel("p024") }} downloads={downloadsDoPainel(g.downloads, "p023")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
