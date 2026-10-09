import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasMapaAtivos } from "@/components/energia/EmpresasMapaAtivos";
import {
  EmpresasAnalise,
  EmpresasAuditoria,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasRecorte,
  EmpresasSeguir,
  EmpresasSubtitulo,
} from "@/components/energia/EmpresasPagina";
import { EmpresasProprietarios } from "@/components/energia/EmpresasProprietarios";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_ESTADOS,
  COLUNAS_FASES,
  COLUNAS_GRUPOS_TRANSMISSAO,
  COLUNAS_REGIMES,
  COLUNAS_SEM_VINCULO,
  COLUNAS_TRANSMISSAO,
  ancoraPainel,
  dataTexto,
  downloadsDe,
  inteiro,
  linhasEstados,
  linhasFases,
  linhasGruposTransmissao,
  linhasRegimes,
  linhasSemVinculo,
  linhasTransmissao,
  numTexto,
  painel,
  pctTexto,
  respostaCadastro,
  rotaPainel,
  semNomesDeCampo,
  textoConferenciaAgentes,
  textoFasesSigaERalie,
  textoGruposNaTransmissao,
  vereditoCadastro,
} from "@/lib/energia/empresas";
import { comValorExibido } from "@/lib/energia/evidencia";
import { carimbo, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { RalieResumo } from "@/lib/energia/empresas";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quem opera quais ativos? Usinas e linhas por CNPJ",
  description:
    "Usinas do SIGA e ativos de transmissão do SIGET ligados ao CNPJ do proprietário publicado pela ANEEL, com a cobertura dos vínculos, o mapa das usinas, os maiores proprietários e as usinas sem vínculo completo.",
  alternates: { canonical: "/setor-eletrico/empresas/ativos" },
};

const COLUNAS_RAMOS: ColunaTabela[] = [
  { id: "ramo", rotulo: "Ramo declarado", tipo: "texto" },
  { id: "ativos", rotulo: "Agentes ativos", tipo: "numero", casas: 0 },
  { id: "todos", rotulo: "Incluindo inativos", tipo: "numero", casas: 0 },
];
const COLUNAS_CONFERENCIA: ColunaTabela[] = [
  { id: "nucleo", rotulo: "Núcleo do CEG", tipo: "texto" },
  { id: "motivo", rotulo: "Diferença", tipo: "texto", categorica: true },
  { id: "siga", rotulo: "SIGA", tipo: "texto" },
  { id: "agentes", rotulo: "Agentes de Geração", tipo: "texto" },
];

/** Lista de CNPJ (com percentuais, quando a fonte os traz) em texto para a tabela de conferência. */
function textoParcelas(x: string[] | Record<string, number>): string {
  return Array.isArray(x) ? x.join(", ") : Object.entries(x).map(([c, p]) => `${c} (${num(p, 2)}%)`).join(", ");
}

export default function PaginaP036() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cadastro;
  const a = c.ativos;
  const t = c.transmissao;
  const fonteCadastro = "ANEEL, SIGA e Agentes do Setor Elétrico";
  // a carteira do RALIE vem da gold de Expansão: a conciliação com as fases do SIGA usa os números dela, sem refazer conta
  const ralie = lerGold<{ estagios?: { ralie?: RalieResumo } }>("expansao.json")?.estagios?.ralie ?? null;

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-ativos" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo siglas={["SIGA", "CEG", "ANEEL"]}
          rotulo="Empresas"
          titulo={painel("p036").pergunta}
          referencia={
            <>
              SIGA de {dataTexto(a.data)}; SIGET de {dataTexto(t?.data)}; cadastro de agentes e Agentes de Geração de {dataTexto(c.agentes.data)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quem é dono de cada usina e de cada linha de transmissão, pelo CNPJ que a própria ANEEL publica no registro do ativo: nenhuma ligação por semelhança de nome, e o ativo sem
          vínculo completo continua identificado, com o motivo.
        </CabecalhoModulo>
        <EmpresasNavegacao atual="p036" />
        <ModoProfundidade>

          <Bloco id="cadastro">
            <PainelEvidencia
              id="p036"
              pergunta={painel("p036").pergunta}
              subtitulo="Usinas do SIGA e ativos de transmissão do SIGET ligados ao CNPJ do proprietário · MW, km de circuito, contagens"
              porQueImporta={
                <>
                  Saber quem é dono de cada usina e de cada linha é o primeiro passo para discutir concentração, responsabilidade por atrasos e o peso de cada empresa no sistema. O
                  vínculo só conta quando a própria fonte publica o CNPJ no registro do ativo.
                </>
              }
              oQueMudou={
                <>
                  Revisões detectadas nos dados desta publicação: {inteiro(g.proveniencia.ativos.revisoes_conhecidas?.total)}. O SIGA e o SIGET são lidos todo dia; o cadastro de agentes e o conjunto Agentes de Geração, todo mês.{" "}
                  <span data-nivel="analisar">{textoConferenciaAgentes(a.conferencia_agentes_geracao)}</span>
                </>
              }
              comoInterpretar={
                <>
                  A potência é a fiscalizada nas usinas em operação e a outorgada nas demais fases (as duas não se somam). Capacidade proporcional reparte a potência de cada usina pela
                  participação de cada dono; capacidade sob controle direto conta a usina inteira para quem tem mais de 50%. Na transmissão, km de circuito conta duas vezes a linha de
                  circuito duplo, e a mesma subestação pode ter módulos de mais de uma concessionária.
                </>
              }
              naoConcluir={
                <>
                  Não se conclui controle econômico indireto (o painel de controle trata do grupo), nem energia gerada: capacidade instalada não é geração. Uma usina com vínculo incompleto
                  não é usina sem dono, e sim usina em que a fonte não publica o CNPJ de todos. Subestações não se somam entre concessionárias.
                </>
              }
              proveniencia={g.proveniencia.ativos}
              complementares={[
                { rotulo: "Cadastro de agentes", p: g.proveniencia.cadastro_agentes },
                ...(g.proveniencia.transmissao ? [{ rotulo: "Transmissão por CNPJ (SIGET)", p: g.proveniencia.transmissao }] : []),
              ]}
            >
              <div className="space-y-6">
                <RespostaCurta id="p036" veredito={vereditoCadastro(c)}>
                  {respostaCadastro(c)}
                </RespostaCurta>
                <EmpresasRecorte
                  periodo={
                    <>
                      SIGA de {dataTexto(a.data)}; SIGET de {dataTexto(t?.data)}; cadastro de agentes e Agentes de Geração de {dataTexto(c.agentes.data)}
                    </>
                  }
                  universo={
                    <>
                      {inteiro(a.usinas)} usinas do SIGA em todas as fases ({inteiro(a.operacao.usinas)} em operação); {inteiro(c.agentes.total)} agentes no cadastro ({inteiro(c.agentes.ativos)} ativos)
                      {t ? `; ${inteiro(t.resumo.contratos)} contratos de transmissão` : ""}
                    </>
                  }
                  unidade="MW (fiscalizada em operação, outorgada nas demais fases); km de circuito; contagens"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Numero
                    rotulo="Potência em operação com vínculo provado"
                    natureza="CALCULADO"
                    evidencia={comValorExibido(a.evidencia, pctTexto(a.evidencia.valor_calculo, 2))}
                    formato="pct"
                    casas={2}
                    tamanho="medio"
                    nota={`${pctTexto(a.pct_usinas_operacao_vinculadas, 2)} das usinas em operação; ${pctTexto(a.pct_usinas_vinculadas, 2)} das ${a.universo_pct_usinas_vinculadas}.`}
                    endereco={ancoraPainel("p036")}
                  />
                  {t && (
                    <Numero
                      rotulo="Módulos de transmissão ligados ao CNPJ"
                      natureza="CALCULADO"
                      evidencia={comValorExibido(t.evidencia, pctTexto(t.evidencia.valor_calculo, 1))}
                      formato="pct"
                      casas={1}
                      tamanho="medio"
                      nota={`${inteiro(t.resumo.modulos_com_cnpj)} de ${inteiro(t.resumo.modulos)} módulos; ${inteiro(t.resumo.cnpjs_com_modulos)} concessionárias com módulos.`}
                      endereco={ancoraPainel("p036")}
                    />
                  )}
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2" data-como-ler="">
                  <div>
                    <dt className="font-medium text-carvao">Vínculo provado</dt>
                    <dd className="mt-0.5 text-carvao-muted">{g.definicoes.vinculo.replace(/^Vínculo provado = /, "")}</dd>
                  </div>
                  {t && (
                    <div>
                      <dt className="font-medium text-carvao">Módulos de transmissão</dt>
                      <dd className="mt-0.5 text-carvao-muted">
                        {semNomesDeCampo(t.definicoes.km_circuito)} {semNomesDeCampo(t.regra_vinculo)}
                      </dd>
                    </div>
                  )}
                </dl>

                <EmpresasSubtitulo>Onde estão as usinas e de quem são?</EmpresasSubtitulo>
                <EmpresasMapaAtivos urlAtivos={g.series.ativos} totalUsinas={a.usinas} dataSiga={a.data} fonte="ANEEL, SIGA" versao={a.data ?? ""} />

                <EmpresasSubtitulo>Quem tem mais capacidade instalada?</EmpresasSubtitulo>
                <EmpresasProprietarios proprietarios={c.proprietarios} fonte={fonteCadastro} versao={a.data ?? ""} />

                <EmpresasSubtitulo>Que usinas ficam sem vínculo completo, e por quê?</EmpresasSubtitulo>
                <TabelaInterativa
                  titulo={`Estado do vínculo de propriedade, SIGA de ${dataTexto(a.data)}`}
                  colunas={COLUNAS_ESTADOS}
                  linhas={linhasEstados(a)}
                  chaveLinha="id"
                  colunaRotulo="rotulo"
                  fonte="ANEEL, SIGA"
                  versao={a.data ?? ""}
                  nomeArquivo="empresas-estado-vinculo"
                />
                <TabelaInterativa
                  titulo={`As ${a.sem_vinculo.length} maiores usinas em operação sem vínculo completo (de ${inteiro(a.sem_vinculo_total)})`}
                  colunas={COLUNAS_SEM_VINCULO}
                  linhas={linhasSemVinculo(a)}
                  chaveLinha="id"
                  colunaRotulo="nome"
                  fonte="ANEEL, SIGA"
                  versao={a.data ?? ""}
                  nomeArquivo="empresas-usinas-sem-vinculo"
                  chaveUrl="sv"
                  ordemInicial={{ coluna: "mw", direcao: "desc" }}
                  nota="Mesma raiz de CNPJ: matriz e filial publicadas com 100% cada (a mesma pessoa jurídica, sem consolidação). A lista inteira está no CSV de usinas e proprietários."
                />

                {t && (
                  <>
                    <EmpresasSubtitulo>Quem opera as linhas de transmissão?</EmpresasSubtitulo>
                    {textoGruposNaTransmissao(t) && <p className="max-w-prose2 text-sm text-carvao-muted" data-grupos-transmissao="">{textoGruposNaTransmissao(t)}</p>}
                    <GraficoBarras
                      titulo={`As ${t.maiores.length} maiores concessionárias por km de circuito em operação, SIGET de ${dataTexto(t.data)}`}
                      dados={linhasTransmissao(t)}
                      chaveCategoria="id"
                      chaveRotulo="nome"
                      series={[{ id: "km", rotulo: "Circuito em operação", cor: "var(--serie-comp-1)" }]}
                      unidade="km"
                      casas={1}
                      orientacao="horizontal"
                      rotulosValor
                    />
                    <TabelaInterativa
                      titulo="Concessionárias de transmissão: circuitos, subestações e transformação"
                      colunas={COLUNAS_TRANSMISSAO}
                      linhas={linhasTransmissao(t)}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte="ANEEL, SIGET"
                      versao={t.data ?? ""}
                      nomeArquivo="empresas-transmissao-maiores"
                      ordemInicial={{ coluna: "km", direcao: "desc" }}
                      nota={`Total do SIGET: ${numTexto(t.resumo.km_circuito_operacao)} km de circuito em operação, ${inteiro(t.resumo.subestacoes_distintas)} subestações distintas com equipamento. Todas as ${inteiro(t.resumo.cnpjs)} concessionárias com contrato estão no CSV de transmissão.`}
                    />
                    <TabelaInterativa
                      titulo="Os maiores grupos na transmissão (topo da cadeia declarada)"
                      colunas={COLUNAS_GRUPOS_TRANSMISSAO}
                      linhas={linhasGruposTransmissao(t)}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte="ANEEL, SIGET e Composição Societária"
                      versao={t.data ?? ""}
                      nomeArquivo="empresas-transmissao-grupos"
                      ordemInicial={{ coluna: "km", direcao: "desc" }}
                      nota="Subestações do grupo: a união das subestações das empresas do grupo (a mesma subestação não conta duas vezes)."
                    />
                  </>
                )}

                <EmpresasAnalise titulo="Fases, regimes de exploração e ramos declarados">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <TabelaInterativa titulo="Usinas por fase no SIGA" colunas={COLUNAS_FASES} linhas={linhasFases(a)} chaveLinha="id" colunaRotulo="fase" fonte="ANEEL, SIGA" versao={a.data ?? ""} nomeArquivo="empresas-usinas-fase" />
                    <GraficoBarras
                      titulo="Capacidade proporcional por regime de exploração (usinas em operação)"
                      dados={linhasRegimes(a)}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "mw_proporcional", rotulo: "Capacidade proporcional", cor: "var(--serie-comp-2)" }]}
                      unidade="MW"
                      casas={1}
                      orientacao="horizontal"
                      rotulosValor
                    />
                  </div>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-conciliacao-ralie="">
                    {textoFasesSigaERalie(a, ralie)}
                  </p>
                  <TabelaInterativa
                    titulo="Parcelas de propriedade por regime de exploração"
                    colunas={COLUNAS_REGIMES}
                    linhas={linhasRegimes(a)}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte="ANEEL, SIGA"
                    versao={a.data ?? ""}
                    nomeArquivo="empresas-regimes"
                  />
                  <TabelaInterativa
                    titulo={`Ramos declarados no cadastro de agentes (${c.agentes.ramos_universo})`}
                    colunas={COLUNAS_RAMOS}
                    linhas={(["geracao", "transmissao", "distribuicao", "comercializacao"] as const).map((r) => ({
                      id: r,
                      ramo: { geracao: "Geração", transmissao: "Transmissão", distribuicao: "Distribuição", comercializacao: "Comercialização" }[r],
                      ativos: c.agentes.ramos[r],
                      todos: c.agentes.ramos_incluindo_inativos[r],
                    }))}
                    chaveLinha="id"
                    colunaRotulo="ramo"
                    fonte="ANEEL, Agentes do Setor Elétrico"
                    versao={c.agentes.data ?? ""}
                    nomeArquivo="empresas-ramos-agentes"
                    nota="O ramo é autodeclarado: o ramo distribuição inclui agentes que não são distribuidoras (por isso o índice do painel seguinte usa as bases reguladas)."
                  />
                  <p className="text-sm text-carvao-muted">
                    {inteiro(a.proprietarios_cnpj)} proprietários com CNPJ nas usinas; {inteiro(a.proprietarios_no_cadastro)} estão no cadastro de agentes e {inteiro(a.proprietarios_fora_do_cadastro)} não.
                  </p>
                </EmpresasAnalise>

                <EmpresasAuditoria titulo="Regras de vínculo e conferências">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-carvao">Vínculo</dt>
                      <dd className="mt-0.5 text-carvao-muted">{g.definicoes.vinculo}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-carvao">Capacidade proporcional</dt>
                      <dd className="mt-0.5 text-carvao-muted">{g.definicoes.capacidade_proporcional}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-carvao">Capacidade sob controle direto</dt>
                      <dd className="mt-0.5 text-carvao-muted">{g.definicoes.capacidade_controle_direto}</dd>
                    </div>
                    {t && (
                      <div>
                        <dt className="font-medium text-carvao">Vínculo na transmissão</dt>
                        <dd className="mt-0.5 text-carvao-muted">
                          {t.regra_vinculo} {t.definicoes.km_circuito} {t.definicoes.subestacoes} {t.definicoes.mva}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="text-sm text-carvao-muted">{textoConferenciaAgentes(a.conferencia_agentes_geracao)}</p>
                  {a.conferencia_agentes_geracao && a.conferencia_agentes_geracao.exemplos.length > 0 && (
                    <TabelaInterativa
                      titulo="Exemplos de usinas com CNPJ ou percentual diferente entre o SIGA e o conjunto Agentes de Geração"
                      colunas={COLUNAS_CONFERENCIA}
                      linhas={a.conferencia_agentes_geracao.exemplos.map((x) => ({
                        id: x.nucleo,
                        nucleo: x.nucleo,
                        motivo: x.motivo === "cnpj" ? "CNPJ diferente" : "percentual diferente",
                        siga: textoParcelas(x.siga),
                        agentes: textoParcelas(x.agentes),
                      }))}
                      chaveLinha="id"
                      colunaRotulo="nucleo"
                      fonte="ANEEL, SIGA e Agentes de Geração"
                      versao={a.conferencia_agentes_geracao.data ?? ""}
                      nomeArquivo="empresas-conferencia-agentes-geracao"
                    />
                  )}
                  {t && (
                    <p className="text-sm text-carvao-muted">
                      Cobertura do SIGET: {inteiro(t.cobertura.modulos_lt_com_linha)} de {inteiro(t.cobertura.modulos_lt)} módulos de linha com extensão publicada; {inteiro(t.cobertura.modulos_me_com_equipamento)} de{" "}
                      {inteiro(t.cobertura.modulos_me)} módulos de equipamento com subestação; {inteiro(t.cobertura.modulos_sem_contrato)} módulos sem contrato; {inteiro(t.resumo.contratos_sem_cnpj)} contrato sem CNPJ;{" "}
                      {inteiro(t.resumo.cnpj_completados_com_zeros)} CNPJ publicados sem os zeros à esquerda e completados. Conferência com o cadastro: {inteiro(t.conferencia_cadastro_agentes.no_cadastro)} das{" "}
                      {inteiro(t.conferencia_cadastro_agentes.cnpjs_com_modulos)} concessionárias com módulos estão no cadastro de agentes, {inteiro(t.conferencia_cadastro_agentes.com_ramo_transmissao)} com o ramo
                      transmissão; {inteiro(t.conferencia_cadastro_agentes.ativos_com_ramo_sem_modulo_no_siget)} agentes ativos declaram o ramo e não têm módulo no SIGET.
                    </p>
                  )}
                </EmpresasAuditoria>

                <EmpresasSeguir
                  ancora="p036"
                  proximo={{ href: rotaPainel("p039"), pergunta: painel("p039").pergunta }}
                  downloads={downloadsDe(g.downloads, [
                    "/energia/series/empresas_ativos.csv",
                    "/energia/series/empresas_proprietarios.csv",
                    "/energia/series/empresas_transmissao.csv",
                    "/energia/series/empresas_agentes.csv",
                  ])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
