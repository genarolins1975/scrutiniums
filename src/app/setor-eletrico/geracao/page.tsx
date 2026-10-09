import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { GeracaoMatriz } from "@/components/energia/GeracaoMatriz";
import {
  GeracaoAnalise,
  GeracaoAuditoria,
  GeracaoAviso,
  GeracaoDocumentos,
  GeracaoFrases,
  GeracaoIndisponivel,
  GeracaoNavegacao,
  GeracaoRegras,
  GeracaoSeguir,
} from "@/components/energia/GeracaoPagina";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RedirecionaAncoraAntiga } from "@/components/energia/RedirecionaAncoraAntiga";
import { GeracaoTabelaSobDemanda } from "@/components/energia/GeracaoTabelasSobDemanda";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import {
  COR_CATEGORIA,
  COR_NATUREZA,
  CURTO_CATEGORIA,
  CURTO_NATUREZA,
  NATUREZAS,
  PERGUNTA_MODULO_GERACAO,
  ROTULO_REGRA,
  downloadsDoPainel,
  fontesDoGrupoTipo3,
  linhasDozeMeses,
  linhasMmgdApi,
  linhasNaturezaMensal,
  linhasRecentes,
  marcosMensais,
  nomesCategorias,
  perguntaPainel,
  rotaPainel,
  situacaoAtualidade,
  textoA11,
  textoDozeMeses,
} from "@/lib/energia/geracao";
import { integra, lerGold } from "@/lib/energia/gold";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Geração: quais fontes atenderam a carga",
  description:
    "Matriz efetiva do SIN e dos subsistemas pela Geração por Usina do ONS: hidráulica, eólica, solar centralizada, MMGD estimada, nuclear, gás, carvão, óleo, biomassa e demais térmicas, em energia e participação, com e sem a MMGD, a quebra de 29/04/2023 conferida na fonte, ressalvas de universo e a reconciliação com o Balanço de Energia.",
  alternates: { canonical: "/setor-eletrico/geracao" },
};

const FONTE = "ONS, Geração por Usina em Base Horária";

export default function GeracaoPage() {
  const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json");
  if (!integra(g)) return <GeracaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const m = g.matriz;
  const ev = g.evidencias;
  const nomes = nomesCategorias(g.categorias);
  const atual = situacaoAtualidade(g.dia_referencia, g.gerado_em);
  const versao = g.dia_referencia;
  const sin12 = m.janelas.SIN["12m"];
  const doze = m.comparacao_12m ? linhasDozeMeses(m.comparacao_12m, sin12) : [];
  const dozeGrafico = doze.filter((l) => !m.comparacao_12m?.variacao_suprimida[l.id]);
  const diario = linhasRecentes(m.diario_sin_recente.dias, m.diario_sin_recente);
  const horario = linhasRecentes(m.horario_sin_recente.horas, m.horario_sin_recente);
  const natureza = linhasNaturezaMensal(m.natureza_mensal_sin);
  const a11 = g.a11;
  const mmgdApi = linhasMmgdApi(a11);
  const marcos = marcosMensais(g.quebras, m.mensal_sin.meses);
  const rec = m.reconciliacao_balanco;
  const lac = m.universo.lacuna_ultimo_mes;
  const seq = m.universo.sequencias_zero_identificadores;
  const serieCats = (cats: readonly (keyof typeof COR_CATEGORIA)[]) => cats.map((c) => ({ id: c, rotulo: CURTO_CATEGORIA[c], cor: COR_CATEGORIA[c] }));

  return (
    <>
      <CabecalhoEnergia atual="geracao" />
      <MarcaVisita secao="energia:geracao" />
      {/* o contexto térmico de 7 dias foi para o painel de despacho térmico; links antigos seguem para lá */}
      <RedirecionaAncoraAntiga ancoras={["termica", "termica-ctx"]} destino={rotaPainel("p022")} />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo siglas={["ONS", "MWmed", "SIN", "CEG", "CVU", "SIGA", "ANEEL"]}
          rotulo="Geração"
          titulo={PERGUNTA_MODULO_GERACAO}
          referencia={
            <>
              {FONTE}, até {dataBR(g.dia_referencia)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          A <Termo slug="geracao-centralizada">geração verificada</Termo> de cada usina, conjunto e grupo de pequenas usinas que o ONS publica hora a hora, somada por
          fonte e combustível, em <Unidade u="MWmed" /> e em participação. Desde 29/04/2023 a mesma base inclui a estimativa do ONS para a{" "}
          <Termo slug="geracao-distribuida">micro e minigeração distribuída</Termo>, conferida na documentação da fonte; por isso a matriz sai em dois perímetros, com e sem
          ela. Os outros painéis respondem por que as térmicas foram acionadas, quanto da eólica e da solar foi restringido e quanto está instalado.
        </CabecalhoModulo>
        <GeracaoNavegacao atual="p021" />
        <ModoProfundidade>
          <Bloco id="matriz">
            <PainelEvidencia
              id="p021"
              pergunta={perguntaPainel("p021")}
              subtitulo="Geração por categoria e participação, SIN e subsistemas · MWmed e %"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A matriz efetiva mostra de onde veio a energia que atendeu a carga: quanto foi água, vento, sol, combustível nuclear, gás, carvão, óleo e biomassa, separados
                  por combustível onde a fonte permite, e quanto é estimativa do próprio ONS.
                </>
              }
              oQueMudou={
                <>
                  {atual.texto} {m.comparacao_12m ? textoDozeMeses(m.comparacao_12m) : "Sem duas janelas de 365 dias comparáveis nesta publicação."}
                </>
              }
              comoInterpretar={
                <>
                  Participação é a energia da categoria dividida pela energia de todas as categorias no mesmo período e região. No perímetro com MMGD o total soma as mesmas fontes do
                  Balanço de Energia do ONS e fica próximo dele, com diferenças por fonte e por dia que a reconciliação do modo Auditar mostra; no perímetro sem MMGD, a estimativa sai do numerador e do denominador. Categoria com ressalva de universo teve menos usinas
                  publicadas com dado no período; a ressalva aparece junto da participação.
                </>
              }
              naoConcluir={
                <>
                  Participação não é capacidade instalada (ver o painel de capacidade). A MMGD e os grupos Tipo III são estimativa e previsão do ONS, não medição. A
                  participação da biomassa cobre só as usinas despachadas com combustível declarado e não representa a biomassa do país; parte dela (licor negro de
                  celulose) está em outras térmicas, como o ONS rotula. Uma participação maior não indica, sozinha, preço menor ou maior.
                </>
              }
              proveniencia={g.proveniencia.matriz!}
              complementares={g.proveniencia.a11 ? [{ rotulo: "Quebra de 29/04/2023", p: g.proveniencia.a11 }] : []}
            >
              <div className="space-y-6">
                {atual.defasada && <GeracaoAviso tipo="alerta">{atual.texto}</GeracaoAviso>}
                <GeracaoMatriz
                  janelas={m.janelas}
                  mensal={m.mensal_sin}
                  nomes={nomes}
                  marcos={marcos}
                  fonte={FONTE}
                  versao={versao}
                  fontesTipo3={fontesDoGrupoTipo3(m.rotulos, g.categorias)}
                  destaques={
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Numero rotulo="Geração do SIN, últimos 30 dias, com a MMGD estimada" natureza="CALCULADO" evidencia={ev.matriz_30d_total} casas={0} tamanho="medio" cor="var(--cor-energia)" endereco={`${rotaPainel("p021")}#p021`} />
                      <Numero rotulo="Participação da eólica, SIN, 30 dias" natureza="CALCULADO" evidencia={ev.matriz_30d_eolica} formato="pct" casas={1} unidade="%" tamanho="medio" cor={COR_CATEGORIA.eolica} endereco={`${rotaPainel("p021")}#p021`} />
                      <Numero rotulo="Participação da MMGD estimada pelo ONS, SIN, 30 dias" natureza="ESTIMADO" evidencia={ev.matriz_30d_solar_mmgd} formato="pct" casas={1} unidade="%" tamanho="medio" cor={COR_CATEGORIA.solar_mmgd} nota="Estimativa do ONS com previsão meteorológica, não medição." endereco={`${rotaPainel("p021")}#p021`} />
                      <Numero rotulo="Participação do gás natural, SIN, 30 dias" natureza="CALCULADO" evidencia={ev.matriz_30d_gas} formato="pct" casas={1} unidade="%" tamanho="medio" cor={COR_CATEGORIA.gas} endereco={`${rotaPainel("p021")}#p021`} />
                    </div>
                  }
                />

                {m.comparacao_12m && (
                  <GeracaoAnalise id="doze-meses" titulo={`O que mudou em 365 dias: ${dataBR(m.comparacao_12m.atual.inicio)} a ${dataBR(m.comparacao_12m.atual.fim)} contra o ano anterior`}>
                    <p className="text-sm text-carvao-muted">{textoDozeMeses(m.comparacao_12m)}</p>
                    <GraficoPontos
                      titulo="Geração média por categoria nos 365 dias mais recentes e nos 365 anteriores, SIN"
                      itens={dozeGrafico.map((l) => ({ id: l.id, rotulo: l.rotulo, valor: l.atual, referencia: l.anterior }))}
                      unidade="MWmed"
                      casas={0}
                      rotuloValor="365 dias mais recentes"
                      rotuloReferencia="365 dias anteriores"
                      zeroNoEixo
                      ordemInicial={{ por: "valor", direcao: "desc" }}
                      chaveUrl="dzg"
                    />
                    <GeracaoTabelaSobDemanda tabela="doze" versao={versao} />
                  </GeracaoAnalise>
                )}

                <GeracaoAnalise id="recentes" titulo="Os últimos 60 dias e as últimas 72 horas, SIN">
                  <GraficoLinhas
                    chaveUrl="dia"
                    titulo={`Geração diária do SIN por categoria, ${dataBR(m.diario_sin_recente.dias[0])} a ${dataBR(m.diario_sin_recente.dias[m.diario_sin_recente.dias.length - 1])}`}
                    dados={diario}
                    chaveX="x"
                    formatoX="data"
                    series={serieCats(m.diario_sin_recente.categorias)}
                    unidade="MWmed"
                    casas={0}
                    zeroNoEixo
                    legendaInterativa
                  />
                  <GeracaoTabelaSobDemanda tabela="diaria" versao={versao} />
                  <GraficoLinhas
                    chaveUrl="hor"
                    titulo={`Geração horária do SIN por categoria, de ${dataBR(m.horario_sin_recente.horas[0])} a ${dataBR(m.horario_sin_recente.horas[m.horario_sin_recente.horas.length - 1])}`}
                    dados={horario}
                    chaveX="x"
                    formatoX="hora"
                    series={serieCats(m.horario_sin_recente.categorias)}
                    unidade="MWmed"
                    casas={0}
                    zeroNoEixo
                    legendaInterativa
                  />
                  <GeracaoTabelaSobDemanda tabela="horaria" versao={versao} />
                </GeracaoAnalise>

                <GeracaoAnalise id="natureza" titulo="Quanto da energia é medição, previsão ou estimativa, mês a mês">
                  <p className="text-sm text-carvao-muted">
                    A geração publicada soma três naturezas: medição das usinas com relacionamento com o ONS, previsão do ONS para grupos de pequenas usinas Tipo III (desde
                    mar/2021) e estimativa do ONS para a MMGD (desde 29/04/2023). Mês sem a natureza fica vazio.
                  </p>
                  <GraficoLinhas
                    titulo="Parcela da geração do SIN por natureza do dado"
                    dados={natureza}
                    chaveX="m"
                    formatoX="mes"
                    series={NATUREZAS.map((n) => ({ id: n, rotulo: CURTO_NATUREZA[n], cor: COR_NATUREZA[n] }))}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    marcos={marcos}
                  />
                  <GeracaoTabelaSobDemanda tabela="natureza" versao={versao} />
                </GeracaoAnalise>

                <GeracaoAnalise id="anos" titulo="Participação por ano, no perímetro sem MMGD">
                  <GeracaoTabelaSobDemanda tabela="anual" versao={versao} />
                </GeracaoAnalise>

                <GeracaoAnalise id="a11" titulo="A quebra de 29/04/2023: MMGD estimada dentro da solar">
                  <p className="text-sm leading-relaxed text-carvao">{a11.conclusao}</p>
                  <p className="text-sm text-carvao-muted">{textoA11(a11)}</p>
                  <GeracaoDocumentos documentos={a11.evidencias_documentais} />
                  <p className="rotulo text-mineral">Tratamento aplicado</p>
                  <GeracaoFrases itens={a11.tratamento} />
                  <GeracaoTabelaSobDemanda tabela="a11" versao={versao} />
                  <GraficoLinhas
                    titulo="MMGD estimada pelo ONS: na Geração por Usina e na carga verificada (API), por mês"
                    dados={mmgdApi}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "usina_mwmed", rotulo: "Geração por Usina", cor: COR_CATEGORIA.solar_mmgd, espessura: 2.5 },
                      { id: "api_mwmed", rotulo: "Carga verificada (API)", cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade="MWmed"
                    casas={0}
                    zeroNoEixo
                  />
                  <GeracaoTabelaSobDemanda tabela="mmgd-api" versao={versao} />
                </GeracaoAnalise>

                <GeracaoAuditoria id="reconciliacao" titulo="Reconciliação com o Balanço de Energia nos Subsistemas">
                  <p className="text-sm text-carvao-muted">
                    Soma das usinas por fonte do Balanço (térmica com a nuclear), subsistema e dia, contra o Balanço publicado pelo ONS, com tolerância de{" "}
                    {num(rec.tolerancia_mwh_por_subsistema_dia, 0)} MWh por subsistema e dia. Nada é corrigido: o painel mostra os dois. {rec.roraima.regra} Último dia com a
                    térmica de Roraima fora do Balanço: {dataBR(rec.roraima.ultimo_dia_excluida)} ({num(rec.roraima.dias_balanco_exclui, 0)} dias).
                  </p>
                  <GeracaoTabelaSobDemanda tabela="rec-fonte" versao={versao} />
                  <GeracaoTabelaSobDemanda tabela="rec-mensal" versao={versao} />
                  <GeracaoTabelaSobDemanda tabela="divergencias" versao={versao} />
                </GeracaoAuditoria>

                <GeracaoAuditoria id="universo" titulo="Universo da fonte: usinas com dado, saltos e mudanças de rótulo">
                  <p className="text-sm text-carvao-muted">{m.universo.regra}</p>
                  <p className="text-sm text-carvao-muted">{m.universo.regra_ressalvas}</p>
                  {lac && (
                    <GeracaoTabelaSobDemanda tabela="lacuna" versao={versao} />
                  )}
                  <GeracaoTabelaSobDemanda tabela="quebras" versao={versao} />
                  <p className="text-sm text-carvao-muted">
                    {m.universo.regra_sequencias_zero} {num(seq.n, 0)} identificadores com zero exato por 6 meses ou mais depois de produção positiva (
                    {num(seq.continuam_no_ultimo_mes, 0)} até o último mês). Nada é excluído: térmica sem despacho e usina parada também produzem zero.
                  </p>
                  <GeracaoTabelaSobDemanda tabela="rotulos" versao={versao} />
                  {m.outros_por_ceg && (
                    <GeracaoTabelaSobDemanda tabela="outros-ceg" versao={versao} />
                  )}
                </GeracaoAuditoria>

                <GeracaoAuditoria id="controles" titulo="Controles, regras, limitações e fontes">
                  <GeracaoTabelaSobDemanda tabela="controles" versao={versao} />
                  <GeracaoRegras regras={Object.entries(g.regras).map(([k, t]) => ({ rotulo: ROTULO_REGRA[k] ?? k, texto: t }))} />
                  <p className="rotulo text-mineral">Limitações da matriz</p>
                  <GeracaoFrases itens={g.proveniencia.matriz?.limitacoes ?? []} />
                  <GeracaoTabelaSobDemanda tabela="fontes" versao={versao} />
                </GeracaoAuditoria>

                <GeracaoSeguir ancora="p021" proximo={{ href: `${rotaPainel("p022")}#p022`, pergunta: perguntaPainel("p022") }} downloads={downloadsDoPainel(g.downloads, "p021")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
