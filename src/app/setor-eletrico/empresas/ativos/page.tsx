import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasMapaAtivos } from "@/components/energia/EmpresasMapaAtivos";
import {
  EmpresasDatas,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasNota,
  EmpresasRecorte,
  EmpresasSeguir,
} from "@/components/energia/EmpresasPagina";
import { EmpresasProprietarios } from "@/components/energia/EmpresasProprietarios";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_ESTADOS,
  COLUNAS_FASES,
  COLUNAS_GRUPOS_TRANSMISSAO,
  COLUNAS_REGIMES,
  COLUNAS_SEM_VINCULO,
  COLUNAS_TRANSMISSAO,
  COR_MEDIDA,
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
import { SIGLAS } from "@/lib/energia/siglas";
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

/** Link para o arquivo com o universo inteiro, no ponto em que a página mostra só uma parte dele. */
function Baixar({ url, rotulo }: { url: string; rotulo: string }) {
  return (
    <a href={url} download className="text-energia-dark underline underline-offset-4 hover:text-carvao">
      {rotulo}
    </a>
  );
}

export default function PaginaP036() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cadastro;
  const a = c.ativos;
  const t = c.transmissao;
  const fonteCadastro = "ANEEL, SIGA e Agentes do Setor Elétrico";
  const dataSiga = dataTexto(a.data);
  // a carteira do RALIE vem da gold de Expansão: a conciliação com as fases do SIGA usa os números dela, sem refazer conta
  const ralie = lerGold<{ estagios?: { ralie?: RalieResumo } }>("expansao.json")?.estagios?.ralie ?? null;
  const csvDe = (url: string) => g.downloads.find((x) => x.url === url) ?? null;
  const csvProprietarios = csvDe("/energia/series/empresas_proprietarios.csv");
  const csvAtivos = csvDe("/energia/series/empresas_ativos.csv");
  const csvTransmissao = csvDe("/energia/series/empresas_transmissao.csv");

  const oQueMudou = (
    <>
      Revisões detectadas nos dados desta publicação: {inteiro(g.proveniencia.ativos.revisoes_conhecidas?.total)}. O SIGA e o SIGET são lidos todo dia; o cadastro de agentes e o conjunto Agentes de
      Geração, todo mês. <span data-nivel="analisar">{textoConferenciaAgentes(a.conferencia_agentes_geracao)}</span>
    </>
  );
  const comoInterpretar = (
    <>
      A potência é a fiscalizada nas usinas em operação e a outorgada nas demais fases (as duas não se somam). Capacidade proporcional reparte a potência de cada usina pela participação de cada dono;
      capacidade sob controle direto conta a usina inteira para quem tem mais de 50%. Na transmissão, km de circuito conta duas vezes a linha de circuito duplo, e a mesma subestação pode ter módulos
      de mais de uma concessionária.
    </>
  );
  const naoConcluir = (
    <>
      Não se conclui controle econômico indireto (a página de controle trata do grupo), nem energia gerada: capacidade instalada não é geração. Uma usina com vínculo incompleto não é usina sem
      dono, e sim usina em que a fonte não publica o CNPJ de todos. Subestações não se somam entre concessionárias.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-ativos" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="p036" />
        <CabecalhoModulo
          rotulo="Empresas"
          siglas={["SIGA", "CEG", "SIGET", "CNPJ", "ANEEL"]}
          titulo={painel("p036").pergunta}
          lead={`Quem é dono de cada usina e de cada linha de transmissão, pelo CNPJ (${SIGLAS.CNPJ}) que a ANEEL (${SIGLAS.ANEEL}) publica no registro do ativo. O ativo sem vínculo completo continua identificado, com o motivo.`}
          recorte={`Usinas do SIGA (${SIGLAS.SIGA}) de ${dataSiga} · linhas do SIGET (${SIGLAS.SIGET}) de ${dataTexto(t?.data)} · MW, km de circuito e contagens`}
          fonte="ANEEL, cadastros de geração, de transmissão e de agentes"
          referencia={
            <>
              SIGA de {dataSiga}; SIGET de {dataTexto(t?.data)}; cadastro de agentes e Agentes de Geração de {dataTexto(c.agentes.data)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: `SIGA (${SIGLAS.SIGA})`, texto: `até ${dataSiga}`, natureza: "OBSERVADO" },
                ...(t ? [{ rotulo: `SIGET (${SIGLAS.SIGET})`, texto: `até ${dataTexto(t.data)}`, natureza: "OBSERVADO" as const }] : []),
                { rotulo: "Cadastro de agentes", texto: `de ${dataTexto(c.agentes.data)}`, natureza: "OBSERVADO" },
                { rotulo: "Agentes de Geração (conferência)", texto: `de ${dataTexto(g.datas.agentes_geracao)}`, natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo="Indicadores do cadastro de ativos"
              nota={
                <>
                  Medidas do SIGA e do SIGET inteiros, fixas: não mudam com os filtros do mapa nem com a escolha de um proprietário. {g.definicoes.vinculo.replace(/^Vínculo provado = /, "Vínculo provado: ")}
                </>
              }
            >
              <Numero variante="faixa" rotulo="Usinas em operação" natureza="CALCULADO" valor={a.operacao.usinas} formato="num" casas={0} unidade="usinas" periodo={`SIGA de ${dataSiga}`} />
              <Numero
                variante="faixa"
                rotulo="Potência fiscalizada"
                natureza="CALCULADO"
                valor={a.operacao.mw_fiscalizado}
                formato="num"
                casas={1}
                unidade="MW"
                periodo={`usinas em operação, SIGA de ${dataSiga}`}
                nota="Capacidade instalada: não é energia gerada."
              />
              <Numero
                variante="faixa"
                rotulo="Potência com todos os donos identificados"
                natureza="CALCULADO"
                evidencia={comValorExibido(a.evidencia, pctTexto(a.evidencia.valor_calculo, 2))}
                formato="pct"
                casas={2}
                unidade="da potência fiscalizada"
                nota={`${pctTexto(a.pct_usinas_operacao_vinculadas, 2)} das usinas em operação; ${pctTexto(a.pct_usinas_vinculadas, 2)} das ${a.universo_pct_usinas_vinculadas}.`}
                endereco={ancoraPainel("p036")}
              />
              {t && (
                <Numero
                  variante="faixa"
                  rotulo="Módulos de transmissão ligados ao CNPJ"
                  natureza="CALCULADO"
                  evidencia={comValorExibido(t.evidencia, pctTexto(t.evidencia.valor_calculo, 1))}
                  formato="pct"
                  casas={1}
                  unidade="dos módulos"
                  nota={`${inteiro(t.resumo.modulos_com_cnpj)} de ${inteiro(t.resumo.modulos)} módulos do SIGET; ${inteiro(t.resumo.cnpjs_com_modulos)} concessionárias com módulos.`}
                  endereco={ancoraPainel("p036")}
                />
              )}
            </FaixaMetricas>
          }
        >
          A fonte das usinas é o SIGA, que registra a propriedade direta (a empresa titular da outorga, em geral uma sociedade de propósito específico); a das linhas é o SIGET, em que cada módulo é ligado ao
          contrato de concessão e ao CNPJ da concessionária. O grupo econômico vem da página de controle. Nenhuma ligação é feita por semelhança de nome.
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="cadastro">
            <PainelEvidencia
              id="p036"
              pergunta="Quem tem mais capacidade instalada?"
              subtitulo="Usinas do SIGA e ativos de transmissão do SIGET ligados ao CNPJ do proprietário · MW, km de circuito, contagens"
              porQueImporta={
                <>
                  Saber quem é dono de cada usina e de cada linha é o primeiro passo para discutir concentração, responsabilidade por atrasos e o peso de cada empresa no sistema. O vínculo só conta
                  quando a própria fonte publica o CNPJ no registro do ativo.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
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
                <EmpresasProprietarios proprietarios={c.proprietarios} totalComCnpj={a.proprietarios_cnpj} csv={csvProprietarios} fonte={fonteCadastro} versao={a.data ?? ""} />
                <EmpresasRecorte
                  periodo={
                    <>
                      SIGA de {dataSiga}; SIGET de {dataTexto(t?.data)}; cadastro de agentes e Agentes de Geração de {dataTexto(c.agentes.data)}
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
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="mapa" titulo="Onde estão as usinas e de quem são?">
                  <EmpresasMapaAtivos urlAtivos={g.series.ativos} totalUsinas={a.usinas} dataSiga={a.data} fonte="ANEEL, SIGA" versao={a.data ?? ""} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="regimes"
                  titulo="Em que regime de exploração a capacidade é detida?"
                  lead={`${a.por_regime.map((r) => `${r.rotulo} (${r.regime})`).join(", ")}: a capacidade proporcional das usinas em operação, por regime sob o qual cada parcela de propriedade é explorada.`}
                >
                  <div className="grid gap-6 lg:grid-cols-2">
                    <GraficoBarras
                      titulo="Capacidade proporcional por regime de exploração (usinas em operação)"
                      dados={linhasRegimes(a)}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "mw_proporcional", rotulo: "Capacidade proporcional", cor: COR_MEDIDA.proporcional }]}
                      unidade="MW"
                      casas={1}
                      orientacao="horizontal"
                      rotulosValor
                    />
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
                  </div>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="sem-vinculo"
                  titulo="Que usinas ficam sem vínculo completo, e por quê?"
                  lead={`${inteiro(a.sem_vinculo_total)} usinas em operação ficam sem vínculo completo: a fonte não publica o proprietário, publica um sem CNPJ ou publica participações que não somam 100%. Todas continuam identificadas.`}
                >
                  <TabelaInterativa
                    titulo={`Estado do vínculo de propriedade, SIGA de ${dataSiga}`}
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
                    nota={
                      <>
                        Mesma raiz de CNPJ: matriz e filial publicadas com 100% cada (a mesma pessoa jurídica, sem consolidação). A lista inteira, das {inteiro(a.sem_vinculo_total)} usinas, está no{" "}
                        {csvAtivos ? <Baixar url={csvAtivos.url} rotulo={csvAtivos.rotulo} /> : "CSV de usinas e proprietários"}.
                      </>
                    }
                  />
                </SecaoDoPainel>

                {t && (
                  <SecaoDoPainel
                    id="transmissao"
                    titulo="Quem opera as linhas de transmissão?"
                    lead={`${semNomesDeCampo(t.definicoes.km_circuito)} ${semNomesDeCampo(t.regra_vinculo)}`}
                  >
                    {textoGruposNaTransmissao(t) && (
                      <p className="max-w-prose2 text-sm text-carvao-muted" data-grupos-transmissao="">
                        {textoGruposNaTransmissao(t)}
                      </p>
                    )}
                    <GraficoBarras
                      titulo={`As ${t.maiores.length} maiores concessionárias por km de circuito em operação, SIGET de ${dataTexto(t.data)}`}
                      dados={linhasTransmissao(t)}
                      chaveCategoria="id"
                      chaveRotulo="nome"
                      series={[{ id: "km", rotulo: "Circuito em operação", cor: COR_MEDIDA.circuito }]}
                      unidade="km"
                      casas={1}
                      orientacao="horizontal"
                      rotulosValor
                    />
                    <EmpresasNota>
                      O gráfico mostra {inteiro(t.maiores.length)} das {inteiro(t.resumo.cnpjs)} concessionárias com contrato ({inteiro(t.resumo.cnpjs_com_modulos)} com módulos); as demais estão no{" "}
                      {csvTransmissao ? <Baixar url={csvTransmissao.url} rotulo={csvTransmissao.rotulo} /> : "CSV de transmissão"}.
                    </EmpresasNota>
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
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="fases" titulo="Fases do SIGA e ramos declarados" nivel="analisar">
                  <TabelaInterativa titulo="Usinas por fase no SIGA" colunas={COLUNAS_FASES} linhas={linhasFases(a)} chaveLinha="id" colunaRotulo="fase" fonte="ANEEL, SIGA" versao={a.data ?? ""} nomeArquivo="empresas-usinas-fase" />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-conciliacao-ralie="">
                    {textoFasesSigaERalie(a, ralie)}
                  </p>
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
                    nota="O ramo é autodeclarado: o ramo distribuição inclui agentes que não são distribuidoras (por isso o índice da página de distribuidoras usa as bases reguladas)."
                  />
                  <p className="text-sm text-carvao-muted">
                    {inteiro(a.proprietarios_cnpj)} proprietários com CNPJ nas usinas; {inteiro(a.proprietarios_no_cadastro)} estão no cadastro de agentes e {inteiro(a.proprietarios_fora_do_cadastro)} não.
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="regras-vinculo" titulo="Regras de vínculo e conferências" nivel="auditar">
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
                </SecaoDoPainel>

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
