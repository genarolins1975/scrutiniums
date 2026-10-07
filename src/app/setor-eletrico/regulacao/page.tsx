import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RegulacaoLimites } from "@/components/energia/RegulacaoLimites";
import {
  RegulacaoAnalise,
  RegulacaoAuditoria,
  RegulacaoAviso,
  RegulacaoIndisponivel,
  RegulacaoLeitura,
  RegulacaoLinkExterno,
  RegulacaoNavegacao,
  RegulacaoRecorte,
  RegulacaoResposta,
  RegulacaoSeguir,
} from "@/components/energia/RegulacaoPagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num, reais } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  ARTIGO_LIMITE,
  CAMPOS_LIMITE,
  COLUNAS_ATOS,
  COLUNAS_BANDEIRAS,
  COLUNAS_CONFERENCIAS_DETALHE,
  COLUNAS_CONTAGEM_CONFERENCIAS,
  COLUNAS_PROCEDIMENTOS,
  NOME_LIMITE,
  ROTA_REGULACAO,
  ROTULO_CONFERENCIA,
  ROTULO_RESULTADO_CONFERENCIA,
  SERIES_PROCEDIMENTOS,
  anosLimites,
  atosDoAno,
  avisoToleranciaIpca,
  contagemProcedimentos,
  downloadsDoPainel,
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
  textoConferenciaAcionamento,
  textoReuniao,
  vigenteEm,
} from "@/lib/energia/regulacao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { AtoLimite, GoldRegulacao } from "@/lib/energia/tipos-regulacao";
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

/** Um ato de limites: o que fixou, quando saiu, desde quando vale, onde foi lido e como foi conferido. */
function CartaoAto({ a }: { a: AtoLimite }) {
  const fixou = CAMPOS_LIMITE.filter((c) => a[c] !== null);
  return (
    <article className="min-w-0 border border-linha bg-superficie p-4 text-sm" data-ato={a.ato}>
      <h4 className="font-serif text-base text-carvao">{a.ato}</h4>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 [&_dd]:[overflow-wrap:anywhere]">
        <dt className="text-carvao-muted">Fixou</dt>
        <dd className="text-carvao">
          {fixou.length ? fixou.map((c) => `${ARTIGO_LIMITE[c].replace(/^o /, "")} ${reais(a[c], 2)}/MWh`).join("; ") : "nenhum dos três limites"}
          {fixou.length < 3 && fixou.length > 0 ? " (os demais limites do ano vêm de outro ato)" : ""}
        </dd>
        <dt className="text-carvao-muted">Data do ato</dt>
        <dd className="tabular-nums text-carvao">{a.data_do_ato ? dataBR(a.data_do_ato) : "não informada"}</dd>
        <dt className="text-carvao-muted">Publicação</dt>
        <dd className="text-carvao">
          {a.data_publicacao ? <time dateTime={a.data_publicacao}>{dataBR(a.data_publicacao)}</time> : <span className="italic text-carvao-muted">não conferida (extrato do ato não acessível)</span>}
          {a.dou ? <span className="block text-xs text-carvao-muted">{a.dou}</span> : null}
        </dd>
        <dt className="text-carvao-muted">Vigência</dt>
        <dd className="tabular-nums text-carvao">
          de {dataBR(a.vigencia_inicio)} a {dataBR(a.vigencia_fim)}
        </dd>
        <dt className="text-carvao-muted">Dispositivo</dt>
        <dd className="text-carvao">{a.dispositivo}</dd>
        <dt className="text-carvao-muted">Onde foi lido</dt>
        <dd className="text-carvao">
          {a.nivel_conferencia === "texto_do_ato" ? "no texto do próprio ato" : "em documento oficial do mesmo processo (o texto do ato não está acessível)"}
          {a.documento_titulo ? `: ${a.documento_titulo}` : ""}
          {a.pagina !== null ? `, página ${a.pagina}` : ""}
        </dd>
        {a.deliberacao && (
          <>
            <dt className="text-carvao-muted">Deliberação</dt>
            <dd className="text-carvao">
              reunião {textoReuniao(a.deliberacao.reuniao)} da Diretoria, em {dataBR(a.deliberacao.data)}
              {a.deliberacao.processo ? `, processo ${a.deliberacao.processo}` : ""}
            </dd>
          </>
        )}
        {a.altera_ou_revoga && (
          <>
            <dt className="text-carvao-muted">Altera ou revoga</dt>
            <dd className="text-carvao">{a.altera_ou_revoga}</dd>
          </>
        )}
      </dl>
      <ul className="mt-2 space-y-0.5 text-xs text-carvao-muted" aria-label={`Conferências de ${a.ato}`}>
        {a.conferencias.map((c, i) => (
          <li key={`${c.conferencia}:${c.campo}:${i}`}>
            <span className="text-carvao">{ROTULO_CONFERENCIA[c.conferencia] ?? c.conferencia}</span>
            {c.campo && ARTIGO_LIMITE[c.campo as keyof typeof ARTIGO_LIMITE] ? ` (${ARTIGO_LIMITE[c.campo as keyof typeof ARTIGO_LIMITE].replace(/^o /, "")})` : ""}: {ROTULO_RESULTADO_CONFERENCIA[c.resultado] ?? c.resultado}. {c.detalhe}
          </li>
        ))}
      </ul>
      <details className="mt-2 text-xs">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">Trecho literal, documento e observações</summary>
        <div className="mt-1 space-y-1.5 border-l-2 border-linha pl-3 text-carvao-muted">
          <p>
            <q>{a.trecho}</q>
          </p>
          {a.observacoes.map((o) => (
            <p key={o}>{o}</p>
          ))}
          <p className="flex flex-wrap gap-x-4">
            {a.url_oficial && <RegulacaoLinkExterno bloco href={a.url_oficial}>Endereço oficial (ANEEL)</RegulacaoLinkExterno>}
            {a.copia_publica && <RegulacaoLinkExterno bloco href={a.copia_publica}>Cópia pública lida, conferida por sha256</RegulacaoLinkExterno>}
          </p>
          {a.sha256 && <p className="[overflow-wrap:anywhere]">sha256 {a.sha256}</p>}
        </div>
      </details>
    </article>
  );
}

export default function RegulacaoPage() {
  const g = lerGold<GoldRegulacao>("regulacao.json");
  if (!integra(g)) return <RegulacaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const L = g.limites_pld;
  const linhas = linhasLimites(g);
  const anos = anosLimites(g);
  const vig = vigenteEm(L.vigencias, g.data_referencia);
  const anoPadrao = linhas.find((l) => l.inicio === vig?.inicio)?.id ?? linhas[linhas.length - 1]?.id ?? "";
  const respostas = Object.fromEntries(linhas.map((l) => [l.id, respostaLimites(g, l.ano)]));
  const detalhes = Object.fromEntries(
    linhas.map((l) => [
      l.id,
      <div key={l.id} className="grid gap-3 lg:grid-cols-2">
        {atosDoAno(g, l.ano).map((a) => (
          <CartaoAto key={a.ato} a={a} />
        ))}
      </div>,
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

  return (
    <>
      <CabecalhoEnergia atual="regulacao" />
      <MarcaVisita secao="energia:regulacao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["PLD", "PRODIST", "DOU", "REH"]}
          rotulo="Regulação"
          titulo="Que regras mudaram, quando e com qual efeito declarado?"
          referencia={
            <>
              ANEEL, atos de limites do PLD, recursos de bandeiras tarifárias e páginas oficiais do PRODIST e do PRORET; data de referência {dataBR(g.data_referencia)};
              processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quais regras valem em cada período, com o ato que as fixou, a data em que saiu no Diário Oficial e a data em que começou a valer, sempre em campos separados. Este
          painel começa pelos <Termo slug="limites-do-pld">limites</Termo> do <Termo slug="pld">PLD</Termo>, que a página do preço usa para dizer se um valor está no piso ou no teto; a linha do tempo das
          mudanças está no segundo painel, e as consultas abertas e a agenda da ANEEL no terceiro.
        </CabecalhoModulo>
        <RegulacaoNavegacao atual="p044" />
        <ModoProfundidade>
          <Bloco id="limites">
            <PainelEvidencia
              id="p044"
              pergunta={perguntaPainel("p044")}
              subtitulo="Limites do PLD por ano, adicionais das bandeiras e versões do PRODIST e do PRORET · R$/MWh nominais"
              natureza="OBSERVADO"
              porQueImporta={
                <>
                  O piso e os tetos dizem até onde o PLD pode ir em cada hora e em cada dia; sem eles, um PLD no piso parece só um preço baixo. Saber qual ato
                  vale, e desde quando, evita aplicar o limite de um ano a outro e confundir a data em que a regra foi publicada com a data em que passou a valer.
                </>
              }
              oQueMudou={<>{oQueMudouLimites(g)}</>}
              comoInterpretar={
                <>
                  O teto horário limita cada hora; o teto estrutural limita a média diária dos preços horários, e a CCEE ajusta o dia quando a média passa dele; o piso vale
                  para todas as horas. Os valores são os escritos no ato, conferidos no PDF guardado; quando o texto do ato não está acessível, o valor foi lido em voto ou nota
                  técnica do mesmo processo e isso aparece em cada ato.
                </>
              }
              naoConcluir={
                <>
                  Os valores são nominais: a diferença entre anos inclui a inflação, já que os tetos são atualizados pelo IPCA, e não mede aumento real. O menor PLD observado
                  nunca substitui o piso: sem ato, o campo fica vazio. A versão que a página oficial do PRODIST ou do PRORET publica não prova que ela é a vigente quando há ato
                  posterior que aprova outra.
                </>
              }
              proveniencia={g.proveniencia.limites}
              complementares={[
                { rotulo: "Adicionais das bandeiras tarifárias", p: g.proveniencia.bandeiras },
                { rotulo: "Versões do PRODIST e do PRORET", p: g.proveniencia.procedimentos },
              ]}
            >
              <div className="space-y-6">
                <RegulacaoResposta id="p044">{respostaP044(g)}</RegulacaoResposta>
                <RegulacaoRecorte
                  periodo={
                    <>
                      {anos.length ? `${anos[0]} a ${anos[anos.length - 1]}, por ano civil de vigência` : "sem ato integrado"}; bandeiras de {dataBR(band.vigencias[0]?.vigencia_inicio ?? null)}{" "}
                      em diante
                    </>
                  }
                  universo="Limites do PLD fixados pela ANEEL para todos os submercados; adicionais das bandeiras; módulos do PRODIST e submódulos do PRORET"
                  unidade="R$/MWh nominais, como escritos nos atos"
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  {(["pld_min", "pld_max_estrutural", "pld_max_horario"] as const).map((c) =>
                    ev[c] ? (
                      <Numero
                        key={c}
                        rotulo={`${NOME_LIMITE[c]} vigente`}
                        natureza="OBSERVADO"
                        evidencia={ev[c]}
                        formato="reais"
                        casas={2}
                        tamanho="medio"
                        cor={c === "pld_min" ? "var(--serie-referencia)" : c === "pld_max_estrutural" ? "var(--cor-energia)" : "var(--cor-energia-dark)"}
                        endereco={`${ROTA_REGULACAO}#p044`}
                      />
                    ) : (
                      <Numero key={c} rotulo={`${NOME_LIMITE[c]} vigente`} natureza="OBSERVADO" valor={null} motivoAusencia="sem ato em vigor que fixe este limite na data de referência" />
                    ),
                  )}
                </div>

                <RegulacaoLimites linhas={linhas} anoPadrao={anoPadrao} respostas={respostas} detalhes={detalhes} fonte={FONTE_LIMITES} versao={versao} />

                <RegulacaoLeitura
                  comoLer={
                    <>
                      Cada grupo de barras é um ano; as três barras partem do zero, então a altura compara valores. A tabela de vigências tem as mesmas linhas, com o ato de cada
                      campo, a publicação no Diário Oficial e o início e o fim da vigência em colunas próprias. Escolha um ano no gráfico, na tabela ou no seletor para ver os
                      atos dele.
                    </>
                  }
                  naoPermite={
                    <>
                      Não permite dizer quantas horas o PLD ficou no piso ou no teto (isso está em{" "}
                      <a href={ROTA_PLD_LIMITES} className="text-energia-dark underline underline-offset-4">
                        limites, piso e tetos do PLD
                      </a>
                      ) nem comparar anos em termos reais.
                      {semPublicacao.length
                        ? ` A publicação no DOU de ${semPublicacao.join(", ")} não foi conferida, porque o extrato do ato não está acessível: a coluna fica vazia, nunca com a data de captura.`
                        : ""}
                    </>
                  }
                />

                {pendencias.length > 0 && (
                  <RegulacaoAviso>
                    Limitação declarada:{" "}
                    {pendencias.map((p) => `${p.ano}: ${p.item} ${p.situacao}; ${p.efeito}`).join(" ")}
                  </RegulacaoAviso>
                )}

                <RegulacaoAnalise id="regra" titulo="A regra dos limites e como os atos a aplicam">
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
                    <p className="mt-1 text-sm">
                      <a href={`${rotaPainel("p046")}#agenda`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                        Ver a agenda inteira no painel de consultas e agenda
                      </a>
                    </p>
                  </div>
                </RegulacaoAnalise>

                <RegulacaoAnalise id="bandeiras" titulo="Adicionais das bandeiras tarifárias por resolução e vigência">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Quanto cada patamar de <Termo slug="bandeira-tarifaria">bandeira</Termo> acrescenta à tarifa, por resolução, em R$/MWh. O fim de cada valor é a véspera do
                    valor seguinte do mesmo patamar, salvo quando o recurso de acionamento mensal mostra outro valor antes (fim conhecido só pelo mês) ou o patamar foi
                    extinto. {textoConferenciaAcionamento(band.conferencia_acionamento)}
                  </p>
                  <GraficoBarras
                    titulo="Adicional de cada patamar por resolução"
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
                </RegulacaoAnalise>

                <RegulacaoAnalise id="procedimentos" titulo="Versões vigentes do PRODIST e do PRORET, conferidas com os atos">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta-procedimentos="">
                    {respostaProcedimentos(proc)}
                  </p>
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
                        Páginas verificadas em {carimbo(proc.verificado_em.prodist)} (PRODIST) e {carimbo(proc.verificado_em.proret)} (PRORET). O conteúdo dos módulos não foi
                        lido: os PDFs estão num servidor da ANEEL que bloqueia acesso automatizado. <RegulacaoLinkExterno href={proc.paginas.PRODIST}>Página do PRODIST</RegulacaoLinkExterno>;{" "}
                        <RegulacaoLinkExterno href={proc.paginas.PRORET}>página do PRORET</RegulacaoLinkExterno>.
                      </>
                    }
                  />
                </RegulacaoAnalise>

                <RegulacaoAuditoria id="atos" titulo="Todos os atos de limites, com documento, página e sha256">
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
                </RegulacaoAuditoria>

                <RegulacaoAuditoria id="conferencias" titulo="Conferências executadas a cada publicação">
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
                </RegulacaoAuditoria>

                <RegulacaoAuditoria id="bandeiras-acionamento" titulo="Valores do recurso Acionamento sem resolução no recurso Adicional">
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
                </RegulacaoAuditoria>

                <RegulacaoAuditoria id="bloqueios" titulo="Fontes bloqueadas e o que foi feito">
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
                    {num(L.atos.length, 0)} atos; conferências refeitas em {dataBR(L.conferido_em)}. Para reproduzir: python3 pipeline/energia/executar_modulo.py regulacao
                    --sem-coleta.
                  </p>
                </RegulacaoAuditoria>

                <RegulacaoSeguir ancora="p044" proximo={{ href: proximo.rota, pergunta: proximo.pergunta }} downloads={downloadsDoPainel(g, "p044")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
