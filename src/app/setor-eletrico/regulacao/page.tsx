import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RegulacaoLimites } from "@/components/energia/RegulacaoLimites";
import {
  FichaDoAto,
  RegulacaoAviso,
  RegulacaoCapitulos,
  RegulacaoDatas,
  RegulacaoIndisponivel,
  RegulacaoLinkExterno,
  RegulacaoNavegacao,
  RegulacaoRecorte,
} from "@/components/energia/RegulacaoPagina";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  ALCANCE_LIMITE,
  COLUNAS_ATOS,
  COLUNAS_BANDEIRAS,
  COLUNAS_CONFERENCIAS_DETALHE,
  COLUNAS_CONTAGEM_CONFERENCIAS,
  COLUNAS_PROCEDIMENTOS,
  COR_LIMITE,
  NOME_LIMITE,
  CAMPOS_LIMITE,
  ROTA_REGULACAO,
  SERIES_PROCEDIMENTOS,
  anosLimites,
  atosDoAno,
  avisoToleranciaIpca,
  contagemProcedimentos,
  downloadsDoPainel,
  limitesVigentes,
  linhasAtos,
  linhasBandeiras,
  linhasConferenciasDetalhe,
  linhasContagemConferencias,
  linhasLimites,
  linhasProcedimentos,
  oQueMudouLimites,
  paresRegraIpca,
  perguntaPainel,
  proximoPainel,
  respostaLimites,
  respostaP044,
  respostaProcedimentos,
  rotaPainel,
  rotuloDownload,
  semTravessao,
  textoAtosDoAno,
  textoConferenciaAcionamento,
  textoVigenciaCurta,
  vereditoLimites,
  vereditoP044,
  vigenteEm,
} from "@/lib/energia/regulacao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { GoldRegulacao } from "@/lib/energia/tipos-regulacao";
import { snapshotLegivel } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Regulação: limites do PLD e regras de preço por período",
  description:
    "Piso, teto estrutural e teto horário do PLD de cada ano com o ato da ANEEL que os fixou, a publicação no Diário Oficial separada da vigência, as conferências no texto do ato e pelo IPCA, os adicionais das bandeiras tarifárias e as versões vigentes do PRODIST e do PRORET.",
  alternates: { canonical: ROTA_REGULACAO },
};

const FONTE_LIMITES = "ANEEL, atos de limites do PLD (texto do ato ou documento oficial do processo)";
/** Painel do PLD que cruza estes limites com o preço observado (horas no piso e nos tetos). */
const ROTA_PLD_LIMITES = "/setor-eletrico/pld/limites";

const COLUNAS_ACIONAMENTO: ColunaTabela[] = [
  { id: "patamar", rotulo: "Patamar", tipo: "texto", categorica: true },
  { id: "rs_mwh", rotulo: "Valor no recurso Acionamento", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "inicio", rotulo: "Primeiro mês", tipo: "data" },
  { id: "fim", rotulo: "Último mês", tipo: "data" },
  { id: "meses", rotulo: "Meses", tipo: "numero", casas: 0 },
  { id: "motivo", rotulo: "Por que não há resolução", tipo: "texto", categorica: true },
];

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default function RegulacaoPage() {
  const g = lerGold<GoldRegulacao>("regulacao.json");
  if (!integra(g)) return <RegulacaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const L = g.limites_pld;
  const linhas = linhasLimites(g);
  const anos = anosLimites(g);
  const vig = vigenteEm(L.vigencias, g.data_referencia);
  const anoPadrao = linhas.find((l) => l.inicio === vig?.inicio)?.id ?? linhas[linhas.length - 1]?.id ?? "";
  const respostas = Object.fromEntries(linhas.map((l) => [l.id, respostaLimites(g, l.ano)]));
  const vereditos = Object.fromEntries(linhas.map((l) => [l.id, vereditoLimites(g, l.ano)]));
  const detalhes = Object.fromEntries(
    linhas.map((l) => [
      l.id,
      atosDoAno(g, l.ano).map((a) => <FichaDoAto key={a.ato} a={a} />),
    ]),
  );
  const ev = g.evidencias.limites;
  const regra = g.regras_limites;
  const proc = g.procedimentos;
  const band = g.bandeiras;
  const pendencias = L.pendencias;
  const proximo = proximoPainel("p044");
  const versao = g.data_referencia;
  const ipca = paresRegraIpca(g);
  const avisoIpca = avisoToleranciaIpca(g);
  const semPublicacao = Array.from(new Set(L.atos.filter((a) => !a.data_publicacao).map((a) => a.ano)));
  // anos em que nenhum ato foi lido no texto: o valor veio de documento oficial do mesmo processo
  const anosSemTexto = Array.from(new Set(L.atos.filter((a) => a.nivel_conferencia !== "texto_do_ato").map((a) => a.ano))).sort((a, b) => a - b);
  const { vigencia, limites } = limitesVigentes(g);
  const atosMaisRecente = L.atos.slice().sort((a, b) => (b.data_publicacao ?? b.vigencia_inicio).localeCompare(a.data_publicacao ?? a.vigencia_inicio))[0];
  const dataRef = dataBR(g.data_referencia);

  const oQueMudou = <>{oQueMudouLimites(g)}</>;
  const comoInterpretar = (
    <>
      O teto horário limita cada hora; o teto estrutural limita a média diária dos preços horários, e a CCEE (Câmara de Comercialização de Energia Elétrica) ajusta o dia
      quando a média passa dele; o piso vale para todas as horas. Os valores são os escritos no ato, conferidos no PDF guardado; quando o texto do ato não está acessível,
      o valor foi lido em voto ou nota técnica do mesmo processo e isso aparece em cada ato.
    </>
  );
  const naoConcluir = (
    <>
      Os valores são nominais: a diferença entre anos inclui a inflação, já que os tetos são atualizados pelo IPCA, e não mede aumento real. O menor PLD observado nunca
      substitui o piso: sem ato, o campo fica vazio. Esta página não diz quantas horas o PLD ficou no piso ou nos tetos: isso está em{" "}
      <a href={ROTA_PLD_LIMITES} className="text-energia-dark underline underline-offset-4">
        limites, piso e tetos do PLD
      </a>
      . A versão que a página oficial do PRODIST ou do PRORET publica não prova que ela é a vigente quando há ato posterior que aprova outra.
      {semPublicacao.length
        ? ` A publicação no DOU de ${semPublicacao.join(", ")} não foi conferida, porque o extrato do ato não está acessível: a data fica vazia, nunca com a data de captura.`
        : ""}{" "}
      A leitura dos atos é do observatório: não é parecer jurídico, e o texto oficial de cada ato está em Analisar.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="regulacao" />
      <MarcaVisita secao="energia:regulacao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <RegulacaoNavegacao atual="p044" />
        <CabecalhoModulo
          siglas={["PLD", "DOU", "ANEEL", "CCEE", "PRODIST", "PRORET", "REN", "REH"]}
          titulo={perguntaPainel("p044")}
          lead="O piso e os dois tetos do preço de curto prazo (PLD, Preço de Liquidação das Diferenças) em cada ano, com o ato da ANEEL que os fixou e as datas de publicação e de vigência separadas."
          recorte={`Vigência em ${dataRef} · limites de ${anos[0]} a ${anos[anos.length - 1]} · R$/MWh nominais`}
          fonte="ANEEL, Agência Nacional de Energia Elétrica, atos anuais de limites do PLD"
          referencia={
            <>
              ANEEL, atos de limites do PLD, recursos de bandeiras tarifárias e páginas oficiais do PRODIST e do PRORET; data de referência {dataRef}; processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <RegulacaoDatas
              itens={[
                {
                  rotulo: "Limites do PLD",
                  texto: `${atosMaisRecente ? `ato mais recente publicado em ${dataBR(atosMaisRecente.data_publicacao ?? atosMaisRecente.vigencia_inicio)}; ` : ""}atos conferidos em ${dataBR(L.conferido_em)}`,
                  natureza: "OBSERVADO",
                },
                { rotulo: "Bandeiras", texto: `adicionais gerados pela ANEEL em ${dataBR(band.gerado_pela_fonte_em)}`, natureza: "OBSERVADO" },
                { rotulo: "PRODIST e PRORET", texto: `páginas verificadas em ${carimbo(proc.verificado_em.prodist)}`, natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={`Limites do PLD vigentes em ${dataRef}`}
              nota={
                <>
                  Valores vigentes em {dataRef}; não mudam com o ano escolhido no gráfico. {limites.length ? textoAtosDoAno(g, vig?.ano ?? 0) : ""}
                </>
              }
            >
              {CAMPOS_LIMITE.map((c) => {
                const l = limites.find((x) => x.campo === c);
                return ev[c] && l ? (
                  <Numero
                    key={c}
                    variante="faixa"
                    rotulo={NOME_LIMITE[c]}
                    natureza="OBSERVADO"
                    evidencia={ev[c]}
                    formato="reais"
                    casas={2}
                    periodo={textoVigenciaCurta(l.inicio, l.fim)}
                    cor={COR_LIMITE[c]}
                    nota={maiuscula(`${ALCANCE_LIMITE[c]}.`)}
                    endereco={`${ROTA_REGULACAO}#p044`}
                  />
                ) : (
                  <Numero
                    key={c}
                    variante="faixa"
                    rotulo={NOME_LIMITE[c]}
                    natureza="OBSERVADO"
                    valor={null}
                    cor={COR_LIMITE[c]}
                    motivoAusencia={`Sem ato em vigor que fixe este limite em ${dataRef}.`}
                  />
                );
              })}
            </FaixaMetricas>
          }
        >
          Esta página responde quais regras de preço valem em cada período e qual ato as fixou, com a data em que o ato saiu no Diário Oficial e a data em que começou a valer
          em campos separados. Ela parte dos <Termo slug="limites-do-pld">limites</Termo> do <Termo slug="pld">PLD</Termo>, que a página do preço usa para dizer se um valor
          está no piso ou no teto. As outras duas páginas são a linha do tempo do que mudou e as consultas abertas e a agenda da ANEEL.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="limites">
            <PainelEvidencia
              id="p044"
              pergunta="Quais são os limites de cada ano e qual ato os fixou?"
              subtitulo="Limites do PLD por ano, adicionais das bandeiras e versões do PRODIST e do PRORET · R$/MWh nominais"
              natureza="OBSERVADO"
              porQueImporta={
                <>
                  O piso e os tetos dizem até onde o PLD pode ir em cada hora e em cada dia; sem eles, um PLD no piso parece só um preço baixo. Saber qual ato vale, e desde
                  quando, evita aplicar o limite de um ano a outro e confundir a data em que a regra foi publicada com a data em que passou a valer.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.limites}
              complementares={[
                { rotulo: "Adicionais das bandeiras tarifárias", p: g.proveniencia.bandeiras },
                { rotulo: "Versões do PRODIST e do PRORET", p: g.proveniencia.procedimentos },
              ]}
            >
              <div className="space-y-6">
                <RegulacaoLimites
                  linhas={linhas}
                  anoPadrao={anoPadrao}
                  respostas={respostas}
                  vereditos={vereditos}
                  detalhes={detalhes}
                  fonte={FONTE_LIMITES}
                  versao={versao}
                  legendaFigura={
                    <>
                      Cada grupo de barras é um ano; as três barras partem do zero, então a altura compara valores. Escolha um ano no gráfico, na tabela ou no seletor para ver os
                      atos dele.
                    </>
                  }
                  avisos={
                    <div className="space-y-3">
                      {anosSemTexto.length > 0 && (
                        <RegulacaoAviso>
                          Os valores de {anosSemTexto.join(" e ")} foram lidos em documento oficial do mesmo processo, porque o texto do ato não estava acessível. O detalhe de cada
                          limitação está em Analisar.
                        </RegulacaoAviso>
                      )}
                      {g.limites_em_revisao.length > 0 && (
                        <RegulacaoAviso>
                          Em revisão na Agenda Regulatória: {g.limites_em_revisao.map((a) => `${a.codigo}, ${semTravessao(a.atividade.replace(/\.$/, ""))}, prevista para ${a.ano_previsto}`).join("; ")}. O ano é
                          previsão da ANEEL.{" "}
                          <a href={`${rotaPainel("p046")}#agenda`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                            Ver a agenda inteira
                          </a>
                        </RegulacaoAviso>
                      )}
                      {pendencias.length > 0 && (
                        <div data-nivel="analisar">
                          <RegulacaoAviso>
                            Limitação declarada: {pendencias.map((p) => `${p.ano}: ${p.item} ${p.situacao}; ${p.efeito}`).join(" ")}
                          </RegulacaoAviso>
                        </div>
                      )}
                    </div>
                  }
                  resposta={
                    <RespostaCurta id="p044" depois veredito={vereditoP044(g)}>
                      {respostaP044(g)}
                    </RespostaCurta>
                  }
                  recorte={
                    <RegulacaoRecorte
                      periodo={
                        <>
                          {anos.length ? `${anos[0]} a ${anos[anos.length - 1]}, por ano civil de vigência` : "sem ato integrado"}; bandeiras de {dataBR(band.vigencias[0]?.vigencia_inicio ?? null)} em
                          diante
                        </>
                      }
                      universo="Limites do PLD fixados pela ANEEL para todos os submercados; adicionais das bandeiras; módulos do PRODIST e submódulos do PRORET"
                      unidade="R$/MWh nominais, como escritos nos atos"
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<RegulacaoCapitulos />}
                />

                <SecaoDoPainel
                  id="bandeiras"
                  titulo="Quanto cada bandeira tarifária acrescenta à tarifa, e desde quando?"
                  lead={
                    <>
                      Quanto cada patamar de <Termo slug="bandeira-tarifaria">bandeira</Termo> acrescenta à tarifa, por resolução, em R$/MWh. O fim de cada valor é a véspera do valor
                      seguinte do mesmo patamar, salvo quando o recurso de acionamento mensal mostra outro valor antes (fim conhecido só pelo mês) ou o patamar foi extinto.{" "}
                      {textoConferenciaAcionamento(band.conferencia_acionamento)}
                    </>
                  }
                >
                  <GraficoBarras
                    titulo="Adicional de cada patamar, desde a vigência de cada resolução"
                    dados={linhasBandeiras(g)}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[{ id: "rs_mwh", rotulo: "Adicional", cor: "var(--cor-energia)" }]}
                    unidade="R$/MWh"
                    casas={2}
                    orientacao="horizontal"
                    rotulosValor
                    alturaMaxima={520}
                  />
                  <TabelaInterativa
                    titulo="Vigências dos adicionais das bandeiras"
                    colunas={COLUNAS_BANDEIRAS}
                    linhas={linhasBandeiras(g)}
                    chaveLinha="id"
                    colunaRotulo="patamar"
                    fonte="ANEEL, Bandeiras Tarifárias (recursos Adicional e Acionamento)"
                    versao={band.acionamento_gerado_pela_fonte_em ?? versao}
                    nomeArquivo="regulacao-bandeiras-adicionais"
                    chaveUrl="band"
                    nota={`Recurso Adicional gerado pela ANEEL em ${dataBR(band.gerado_pela_fonte_em)}; recurso Acionamento com ${band.acionamento_meses} meses (${dataBR(band.acionamento_periodo?.inicio ?? null)} a ${dataBR(band.acionamento_periodo?.fim ?? null)}). A data de publicação das resoluções não é informada pela fonte.`}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="procedimentos"
                  titulo="Que versões do PRODIST e do PRORET as páginas oficiais publicam?"
                  lead={
                    <>
                      PRODIST é o conjunto de Procedimentos de Distribuição de Energia Elétrica no Sistema Elétrico Nacional e PRORET, o de Procedimentos de Regulação Tarifária.{" "}
                      <span data-resposta-procedimentos="">{respostaProcedimentos(proc)}</span>
                    </>
                  }
                >
                  <GraficoBarras
                    titulo="Itens por conjunto e resultado da conferência"
                    dados={contagemProcedimentos(proc.itens)}
                    chaveCategoria="id"
                    chaveRotulo="conjunto"
                    series={SERIES_PROCEDIMENTOS}
                    unidade="itens"
                    casas={0}
                    orientacao="horizontal"
                    empilhado
                    rotulosValor
                  />
                  <TabelaInterativa
                    titulo="Módulos do PRODIST e submódulos do PRORET"
                    colunas={COLUNAS_PROCEDIMENTOS}
                    linhas={linhasProcedimentos(proc.itens)}
                    chaveLinha="id"
                    colunaRotulo="modulo"
                    fonte="ANEEL, páginas oficiais do PRODIST e do PRORET, atas da Diretoria e Resoluções Normativas lidas"
                    versao={(proc.verificado_em.prodist ?? versao).slice(0, 10)}
                    nomeArquivo="regulacao-procedimentos"
                    chaveUrl="proc"
                    dicaBusca="Módulo, título ou ato"
                    nota={
                      <>
                        Páginas verificadas em {carimbo(proc.verificado_em.prodist)} (PRODIST) e {carimbo(proc.verificado_em.proret)} (PRORET). O conteúdo dos módulos não foi lido: os PDFs
                        estão num servidor da ANEEL que bloqueia acesso automatizado. <RegulacaoLinkExterno href={proc.paginas.PRODIST}>Página do PRODIST</RegulacaoLinkExterno>;{" "}
                        <RegulacaoLinkExterno href={proc.paginas.PRORET}>página do PRORET</RegulacaoLinkExterno>.
                      </>
                    }
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="regra" nivel="analisar" titulo="A regra dos limites e como os atos a aplicam">
                  {regra ? (
                    <div className="space-y-2 text-sm leading-relaxed text-carvao-muted">
                      <p>
                        <span className="text-carvao">{regra.ato}</span>, {regra.dispositivo}; vigência desde {dataBR(regra.vigencia_inicio)}. {regra.resumo}
                      </p>
                      <p className="text-carvao" data-pratica-dos-atos="">
                        {regra.pratica_dos_atos.texto}
                      </p>
                      <details>
                        <summary className="inline-flex min-h-[44px] cursor-pointer items-center underline underline-offset-4">Trecho literal da resolução</summary>
                        <p className="border-l-2 border-linha pl-3">
                          <q>{regra.trecho}</q>
                        </p>
                      </details>
                      {regra.url_oficial && <RegulacaoLinkExterno href={regra.url_oficial} bloco>Texto da resolução no endereço oficial da ANEEL</RegulacaoLinkExterno>}
                    </div>
                  ) : (
                    <RegulacaoAviso>A resolução que regula os limites não foi lida nesta publicação; a regra fica sem descrição em vez de escrita de memória.</RegulacaoAviso>
                  )}
                  <div>
                    <p className="rotulo text-mineral">Limites em revisão na Agenda Regulatória</p>
                    {g.limites_em_revisao.length ? (
                      <ul className="mt-1 space-y-1 text-sm text-carvao">
                        {g.limites_em_revisao.map((a) => (
                          <li key={a.codigo}>
                            <span className="tabular-nums">{a.codigo}</span>: {a.atividade} Prevista para {a.ano_previsto}.
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-carvao-muted">Nenhuma atividade da agenda trata dos limites do PLD.</p>
                    )}
                  </div>
                </SecaoDoPainel>

                <SecaoDoPainel id="atos" nivel="auditar" titulo="Todos os atos de limites, com documento, página e sha256">
                  <TabelaInterativa
                    titulo="Atos de limites do PLD"
                    colunas={COLUNAS_ATOS}
                    linhas={linhasAtos(g)}
                    chaveLinha="id"
                    colunaRotulo="ato"
                    fonte={FONTE_LIMITES}
                    versao={L.conferido_em}
                    nomeArquivo="regulacao-limites-pld-atos"
                    chaveUrl="atos"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="conferencias" nivel="auditar" titulo="Conferências executadas a cada publicação">
                  <TabelaInterativa
                    titulo="Resultado das conferências por tipo"
                    colunas={COLUNAS_CONTAGEM_CONFERENCIAS}
                    linhas={linhasContagemConferencias(g)}
                    chaveLinha="id"
                    colunaRotulo="conferencia"
                    fonte="Conferências do observatório sobre os atos da ANEEL e o IPCA do IBGE"
                    versao={L.conferido_em}
                    nomeArquivo="regulacao-conferencias-contagem"
                    chaveUrl="cconf"
                  />
                  {ipca.length > 0 && (
                    <GraficoPontos
                      titulo="Teto publicado e teto refeito pelo encadeamento do IPCA"
                      itens={ipca}
                      unidade="R$/MWh"
                      casas={2}
                      rotuloValor="Publicado no ato"
                      rotuloReferencia="Teto do ano anterior × IPCA de novembro"
                      unidadeDiferenca="R$/MWh"
                    />
                  )}
                  {avisoIpca && <RegulacaoAviso>{avisoIpca}</RegulacaoAviso>}
                  <TabelaInterativa
                    titulo="Conferências numéricas, uma por ato, ano e campo"
                    colunas={COLUNAS_CONFERENCIAS_DETALHE}
                    linhas={linhasConferenciasDetalhe(g)}
                    chaveLinha="id"
                    colunaRotulo="ato"
                    fonte="Conferências do observatório sobre os atos da ANEEL e o IPCA do IBGE"
                    versao={L.conferido_em}
                    nomeArquivo="regulacao-conferencias-detalhe"
                    chaveUrl="conf"
                  />
                  {L.metodo && <p className="text-sm leading-relaxed text-carvao-muted">{L.metodo}</p>}
                </SecaoDoPainel>

                <SecaoDoPainel id="bandeiras-acionamento" nivel="auditar" titulo="Valores do recurso Acionamento sem resolução no recurso Adicional">
                  <TabelaInterativa
                    titulo="Valores vistos só no recurso Acionamento"
                    colunas={COLUNAS_ACIONAMENTO}
                    linhas={band.acionamentos_sem_resolucao.map((x) => ({
                      id: `${x.patamar}:${x.inicio}`,
                      patamar: x.patamar,
                      rs_mwh: x.rs_mwh,
                      inicio: x.inicio,
                      fim: x.fim,
                      meses: x.meses,
                      motivo: x.motivo === "valor_diferente" ? "há resolução no mês, com outro valor" : "nenhuma resolução cobre o mês",
                    }))}
                    chaveLinha="id"
                    colunaRotulo="patamar"
                    fonte="ANEEL, Bandeiras Tarifárias (recurso Acionamento)"
                    versao={band.acionamento_gerado_pela_fonte_em ?? versao}
                    nomeArquivo="regulacao-bandeiras-acionamento-sem-resolucao"
                    chaveUrl="acion"
                    semLinhas="Todos os meses acionados têm resolução correspondente."
                    nota={band.conferencia_acionamento.regra}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="bloqueios" nivel="auditar" titulo="Fontes bloqueadas e o que foi feito">
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {L.bloqueios.map((b) => (
                      <li key={b.fonte} className="[overflow-wrap:anywhere]">
                        <span className="text-carvao">{b.fonte}</span> (verificado em {dataBR(b.verificado_em)}): {b.resposta}. Conduta: {b.conduta}.
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted [overflow-wrap:anywhere]">
                    Curadoria versionada {g.curadoria.snapshot.id ? snapshotLegivel(g.curadoria.snapshot.id) : "sem identificador"} (sha256 {g.curadoria.snapshot.sha256 ?? "não informado"}):{" "}
                    {g.curadoria.arquivos.map((a) => `${a.arquivo} (sha256 ${a.sha256.slice(0, 12)}…, registrado em ${carimbo(a.registrado_em)})`).join("; ")}.
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {g.limitacoes.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-mineral">
                    {num(L.atos.length, 0)} atos; conferências refeitas em {dataBR(L.conferido_em)}. Para reproduzir: python3 pipeline/energia/executar_modulo.py regulacao --sem-coleta.
                  </p>
                </SecaoDoPainel>

                <SeguirPainel
                  ancora="p044"
                  proximo={{ href: `${proximo.rota}#${proximo.id}`, pergunta: proximo.pergunta }}
                  downloads={downloadsDoPainel(g, "p044").map((d) => ({ ...d, rotulo: rotuloDownload(d.rotulo) }))}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
