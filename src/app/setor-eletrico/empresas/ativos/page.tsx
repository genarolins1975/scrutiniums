import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { Nome } from "@/components/i18n/Nome";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
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
import { tx } from "@/lib/energia/idioma";
import { DEFINICAO_EMPRESAS_EN, DOWNLOAD_EMPRESAS_EN, REGIME_EN, comNomes, traduzir } from "@/lib/energia/i18n/empresas-leiloes";
import { SIGLAS, SIGLAS_IDIOMAS } from "@/lib/energia/siglas";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { RalieResumo } from "@/lib/energia/empresas";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/empresas/ativos", {
    title: tx("Quem são os donos dos ativos? Usinas e linhas por CNPJ", "Who owns the assets? Plants and lines by CNPJ"),
    description: tx(
      "Usinas do SIGA e ativos de transmissão do SIGET ligados ao CNPJ do proprietário publicado pela ANEEL, com a cobertura dos vínculos, o mapa das usinas, os maiores proprietários e as usinas sem vínculo completo.",
      "SIGA plants and SIGET transmission assets linked to the owner's CNPJ published by ANEEL, with link coverage, the plant map, the largest owners and the plants without a complete link.",
    ),
    alternates: { canonical: "/setor-eletrico/empresas/ativos" },
  }, anterior);
}

function colunasRamos(): ColunaTabela[] {
  return [
    { id: "ramo", rotulo: tx("Ramo declarado", "Declared line of business"), tipo: "texto" },
    { id: "ativos", rotulo: tx("Agentes ativos", "Active agents"), tipo: "numero", casas: 0 },
    { id: "todos", rotulo: tx("Incluindo inativos", "Including inactive"), tipo: "numero", casas: 0 }, // i18n: dado
  ];
}
function colunasConferencia(): ColunaTabela[] {
  return [
    { id: "nucleo", rotulo: tx("Núcleo do CEG", "CEG core"), tipo: "texto" },
    { id: "motivo", rotulo: tx("Diferença", "Difference"), tipo: "texto", categorica: true },
    { id: "siga", rotulo: "SIGA", tipo: "texto" },
    { id: "agentes", rotulo: tx("Agentes de Geração", "Generation agents dataset"), tipo: "texto" },
  ];
}

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

/** Definição publicada pela gold, no idioma da página (tabela exata; sem forma inglesa, o texto como veio). */
const def = (x: string) => traduzir(DEFINICAO_EMPRESAS_EN, x);

export default function PaginaP036() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cadastro;
  const a = c.ativos;
  const t = c.transmissao;
  const fonteCadastro = tx("ANEEL, SIGA e Agentes do Setor Elétrico", "ANEEL, SIGA and power sector agents");
  const dataSiga = dataTexto(a.data);
  // a carteira do RALIE vem da gold de Expansão: a conciliação com as fases do SIGA usa os números dela, sem refazer conta
  const ralie = lerGold<{ estagios?: { ralie?: RalieResumo } }>("expansao.json")?.estagios?.ralie ?? null;
  const csvDe = (url: string) => {
    const x = g.downloads.find((y) => y.url === url);
    return x ? { ...x, rotulo: traduzir(DOWNLOAD_EMPRESAS_EN, x.rotulo) } : null;
  };
  const csvProprietarios = csvDe("/energia/series/empresas_proprietarios.csv");
  const csvAtivos = csvDe("/energia/series/empresas_ativos.csv");
  const csvTransmissao = csvDe("/energia/series/empresas_transmissao.csv");

  const oQueMudou = tx(
    <>
      Revisões detectadas nos dados desta publicação: {inteiro(g.proveniencia.ativos.revisoes_conhecidas?.total)}. O SIGA e o SIGET são lidos todo dia; o cadastro de agentes e o conjunto Agentes de
      Geração, todo mês. <span data-nivel="analisar">{textoConferenciaAgentes(a.conferencia_agentes_geracao)}</span>
    </>,
    <>
      Revisions detected in the data of this release: {inteiro(g.proveniencia.ativos.revisoes_conhecidas?.total)}. SIGA and SIGET are read every day; the agent registry and the{" "}
      <Nome>Agentes de Geração</Nome> dataset, every month. <span data-nivel="analisar">{comNomes(textoConferenciaAgentes(a.conferencia_agentes_geracao))}</span>
    </>,
  );
  const comoInterpretar = tx(
    <>
      A potência é a fiscalizada nas usinas em operação e a outorgada nas demais fases (as duas não se somam). Capacidade proporcional reparte a potência de cada usina pela participação de cada dono;
      capacidade sob controle direto conta a usina inteira para quem tem mais de 50%. Na transmissão, km de circuito conta duas vezes a linha de circuito duplo, e a mesma subestação pode ter módulos
      de mais de uma concessionária.
    </>,
    <>
      Capacity is the inspected capacity of plants in operation and the granted capacity in the other phases (the two are not added together). Proportional capacity splits each plant&apos;s capacity
      by each owner&apos;s stake; capacity under direct control counts the whole plant for whoever holds more than 50%. In transmission, circuit km counts a double-circuit line twice, and the same
      substation can have modules from more than one concession holder.
    </>,
  );
  const naoConcluir = tx(
    <>
      Não se conclui controle econômico indireto (a página de controle trata do grupo), nem energia gerada: capacidade instalada não é geração. Uma usina com vínculo incompleto não é usina sem
      dono, e sim usina em que a fonte não publica o CNPJ de todos. Subestações não se somam entre concessionárias.
    </>,
    <>
      Indirect economic control cannot be concluded (the control page deals with the group), nor energy generated: installed capacity is not generation. A plant with an incomplete link is not a plant
      without an owner, but a plant for which the source does not publish the CNPJ of all owners. Substations are not added across concession holders.
    </>,
  );
  const vinculo = tx(g.definicoes.vinculo.replace(/^Vínculo provado = /, "Vínculo provado: "), def(g.definicoes.vinculo).replace(/^Proven link = /, "Proven link: "));

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:empresas-ativos" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="p036" />
        <CabecalhoModulo
          rotulo={tx("Empresas", "Companies")}
          siglas={["SIGA", "CEG", "SIGET", "CNPJ", "ANEEL"]}
          titulo={painel("p036").pergunta}
          lead={tx(
            `Donos de usinas e de linhas de transmissão, pelo CNPJ (${SIGLAS.CNPJ}) que a ANEEL (${SIGLAS.ANEEL}) publica no registro do ativo.`,
            `Owners of plants and transmission lines, by the CNPJ (${SIGLAS_IDIOMAS.en.CNPJ}) that ANEEL (${SIGLAS_IDIOMAS.en.ANEEL}) publishes in the asset's record.`,
          )}
          recorte={tx(
            `Usinas do SIGA (${SIGLAS.SIGA}) de ${dataSiga} · linhas do SIGET (${SIGLAS.SIGET}) de ${dataTexto(t?.data)} · MW, km de circuito e contagens`,
            `SIGA (${SIGLAS_IDIOMAS.en.SIGA}) plants as of ${dataSiga} · SIGET (${SIGLAS_IDIOMAS.en.SIGET}) lines as of ${dataTexto(t?.data)} · MW, circuit km and counts`,
          )}
          fonte={tx("ANEEL, cadastros de geração, de transmissão e de agentes", "ANEEL, generation, transmission and agent registries")}
          referencia={tx(
            <>
              SIGA de {dataSiga}; SIGET de {dataTexto(t?.data)}; cadastro de agentes e Agentes de Geração de {dataTexto(c.agentes.data)}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              SIGA as of {dataSiga}; SIGET as of {dataTexto(t?.data)}; agent registry and <Nome>Agentes de Geração</Nome> as of {dataTexto(c.agentes.data)}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: tx(`SIGA (${SIGLAS.SIGA})`, `SIGA (${SIGLAS_IDIOMAS.en.SIGA})`), texto: tx(`até ${dataSiga}`, `up to ${dataSiga}`), natureza: "OBSERVADO" },
                ...(t ? [{ rotulo: tx(`SIGET (${SIGLAS.SIGET})`, `SIGET (${SIGLAS_IDIOMAS.en.SIGET})`), texto: tx(`até ${dataTexto(t.data)}`, `up to ${dataTexto(t.data)}`), natureza: "OBSERVADO" as const }] : []),
                { rotulo: tx("Cadastro de agentes", "Agent registry"), texto: tx(`de ${dataTexto(c.agentes.data)}`, `as of ${dataTexto(c.agentes.data)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Agentes de Geração (conferência)", "Agentes de Geração (cross-check)"),
                  texto: tx(`de ${dataTexto(g.datas.agentes_geracao)}`, `as of ${dataTexto(g.datas.agentes_geracao)}`),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores do cadastro de ativos", "Asset registry indicators")}
              nota={
                <>
                  {tx(
                    "Medidas do SIGA e do SIGET inteiros, fixas: não mudam com os filtros do mapa nem com a escolha de um proprietário.",
                    "Measures of the whole SIGA and SIGET, fixed: they do not change with the map filters or the choice of an owner.",
                  )}{" "}
                  {vinculo}
                </>
              }
            >
              <Numero
                variante="faixa"
                rotulo={tx("Usinas em operação", "Plants in operation")}
                natureza="CALCULADO"
                valor={a.operacao.usinas}
                formato="num"
                casas={0}
                unidade={tx("usinas", "plants")}
                periodo={tx(`SIGA de ${dataSiga}`, `SIGA as of ${dataSiga}`)}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Potência fiscalizada", "Inspected capacity")}
                natureza="CALCULADO"
                valor={a.operacao.mw_fiscalizado}
                formato="num"
                casas={1}
                unidade="MW"
                periodo={tx(`SIGA de ${dataSiga}`, `SIGA as of ${dataSiga}`)}
                nota={tx("Capacidade, não energia gerada.", "Capacity, not energy generated.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Potência com donos identificados", "Capacity with identified owners")}
                natureza="CALCULADO"
                evidencia={comValorExibido(a.evidencia, pctTexto(a.evidencia.valor_calculo, 2))}
                formato="pct"
                casas={2}
                unidade={tx("da potência", "of capacity")}
                nota={tx(`${pctTexto(a.pct_usinas_operacao_vinculadas, 2)} das usinas em operação.`, `${pctTexto(a.pct_usinas_operacao_vinculadas, 2)} of the plants in operation.`)}
                endereco={ancoraPainel("p036")}
              />
              {t && (
                <Numero
                  variante="faixa"
                  rotulo={tx("Módulos de transmissão com CNPJ", "Transmission modules with CNPJ")}
                  natureza="CALCULADO"
                  evidencia={comValorExibido(t.evidencia, pctTexto(t.evidencia.valor_calculo, 1))}
                  formato="pct"
                  casas={1}
                  unidade={tx("dos módulos", "of the modules")}
                  nota={tx(`${inteiro(t.resumo.modulos_com_cnpj)} de ${inteiro(t.resumo.modulos)} módulos do SIGET.`, `${inteiro(t.resumo.modulos_com_cnpj)} of ${inteiro(t.resumo.modulos)} SIGET modules.`)}
                  endereco={ancoraPainel("p036")}
                />
              )}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              A fonte das usinas é o SIGA, que registra a propriedade direta (a empresa titular da outorga, em geral uma sociedade de propósito específico); a das linhas é o SIGET, em que cada módulo é ligado ao
              contrato de concessão e ao CNPJ da concessionária. O grupo econômico vem da página de controle. Nenhuma ligação é feita por semelhança de nome.
            </>,
            <>
              The source for plants is SIGA, which records direct ownership (the company holding the grant, usually a special purpose company); the source for lines is SIGET, in which each module is linked to
              the concession contract and to the concession holder&apos;s CNPJ. The economic group comes from the control page. No link is made by name similarity.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="cadastro">
            <PainelEvidencia
              id="p036"
              pergunta={tx("Quem tem mais capacidade instalada?", "Who has the most installed capacity?")}
              subtitulo={tx(
                "Usinas do SIGA e ativos de transmissão do SIGET ligados ao CNPJ do proprietário · MW, km de circuito, contagens",
                "SIGA plants and SIGET transmission assets linked to the owner's CNPJ · MW, circuit km, counts",
              )}
              porQueImporta={tx(
                <>
                  Saber quem é dono de cada usina e de cada linha é o primeiro passo para discutir concentração, responsabilidade por atrasos e o peso de cada empresa no sistema. O vínculo só conta
                  quando a própria fonte publica o CNPJ no registro do ativo.
                </>,
                <>
                  Knowing who owns each plant and each line is the first step to discuss concentration, responsibility for delays and the weight of each company in the system. The link only counts
                  when the source itself publishes the CNPJ in the asset&apos;s record.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.ativos}
              complementares={[
                { rotulo: tx("Cadastro de agentes", "Agent registry"), p: g.proveniencia.cadastro_agentes },
                ...(g.proveniencia.transmissao ? [{ rotulo: tx("Transmissão por CNPJ (SIGET)", "Transmission by CNPJ (SIGET)"), p: g.proveniencia.transmissao }] : []),
              ]}
            >
              <div className="space-y-6">
                <EmpresasProprietarios proprietarios={c.proprietarios} totalComCnpj={a.proprietarios_cnpj} csv={csvProprietarios} fonte={fonteCadastro} versao={a.data ?? ""} />
                {/* a faixa já traz o número; a resposta vem depois da figura, para o gráfico começar na primeira tela */}
                <RespostaCurta id="p036" veredito={comNomes(vereditoCadastro(c), c.proprietarios.map((x) => x.nome))} depois>
                  {respostaCadastro(c)}
                </RespostaCurta>
                <EmpresasRecorte
                  periodo={tx(
                    <>
                      SIGA de {dataSiga}; SIGET de {dataTexto(t?.data)}; cadastro de agentes e Agentes de Geração de {dataTexto(c.agentes.data)}
                    </>,
                    <>
                      SIGA as of {dataSiga}; SIGET as of {dataTexto(t?.data)}; agent registry and <Nome>Agentes de Geração</Nome> as of {dataTexto(c.agentes.data)}
                    </>,
                  )}
                  universo={tx(
                    <>
                      {inteiro(a.usinas)} usinas do SIGA em todas as fases ({inteiro(a.operacao.usinas)} em operação); {inteiro(c.agentes.total)} agentes no cadastro ({inteiro(c.agentes.ativos)} ativos)
                      {t ? `; ${inteiro(t.resumo.contratos)} contratos de transmissão` : ""}
                    </>,
                    <>
                      {inteiro(a.usinas)} SIGA plants in all phases ({inteiro(a.operacao.usinas)} in operation); {inteiro(c.agentes.total)} agents in the registry ({inteiro(c.agentes.ativos)} active)
                      {t ? `; ${inteiro(t.resumo.contratos)} transmission contracts` : ""}
                    </>,
                  )}
                  unidade={tx(
                    "MW (fiscalizada em operação, outorgada nas demais fases); km de circuito; contagens",
                    "MW (inspected in operation, granted in the other phases); circuit km; counts",
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="mapa" titulo={tx("Onde estão as usinas e de quem são?", "Where are the plants and who owns them?")}>
                  <EmpresasMapaAtivos urlAtivos={g.series.ativos} totalUsinas={a.usinas} dataSiga={a.data} fonte="ANEEL, SIGA" versao={a.data ?? ""} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="regimes"
                  titulo={tx("Em que regime de exploração a capacidade é detida?", "Under which operating regime is the capacity held?")}
                  lead={tx(
                    `${a.por_regime.map((r) => `${r.rotulo} (${r.regime})`).join(", ")}: a capacidade proporcional das usinas em operação, por regime sob o qual cada parcela de propriedade é explorada.`,
                    `${a.por_regime.map((r) => `${traduzir(REGIME_EN, r.rotulo)} (${r.regime})`).join(", ")}: the proportional capacity of the plants in operation, by the regime under which each ownership stake is operated.`,
                  )}
                >
                  <div className="grid gap-6 lg:grid-cols-2">
                    <GraficoBarras
                      titulo={tx("Capacidade proporcional por regime de exploração (usinas em operação)", "Proportional capacity by operating regime (plants in operation)")}
                      dados={linhasRegimes(a)}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "mw_proporcional", rotulo: tx("Capacidade proporcional", "Proportional capacity"), cor: COR_MEDIDA.proporcional }]}
                      unidade="MW"
                      casas={1}
                      orientacao="horizontal"
                      rotulosValor
                    />
                    <TabelaInterativa
                      titulo={tx("Parcelas de propriedade por regime de exploração", "Ownership stakes by operating regime")}
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
                  titulo={tx("Que usinas ficam sem vínculo completo, e por quê?", "Which plants are left without a complete link, and why?")}
                  lead={tx(
                    `${inteiro(a.sem_vinculo_total)} usinas em operação ficam sem vínculo completo: a fonte não publica o proprietário, publica um sem CNPJ ou publica participações que não somam 100%. Todas continuam identificadas.`,
                    `${inteiro(a.sem_vinculo_total)} plants in operation are left without a complete link: the source does not publish the owner, publishes one without CNPJ or publishes stakes that do not add up to 100%. All remain identified.`,
                  )}
                >
                  <TabelaInterativa
                    titulo={tx(`Estado do vínculo de propriedade, SIGA de ${dataSiga}`, `Ownership link status, SIGA as of ${dataSiga}`)}
                    colunas={COLUNAS_ESTADOS}
                    linhas={linhasEstados(a)}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte="ANEEL, SIGA"
                    versao={a.data ?? ""}
                    nomeArquivo="empresas-estado-vinculo"
                  />
                  <TabelaInterativa
                    titulo={tx(
                      `As ${a.sem_vinculo.length} maiores usinas em operação sem vínculo completo (de ${inteiro(a.sem_vinculo_total)})`,
                      `The ${a.sem_vinculo.length} largest plants in operation without a complete link (of ${inteiro(a.sem_vinculo_total)})`,
                    )}
                    colunas={COLUNAS_SEM_VINCULO}
                    linhas={linhasSemVinculo(a)}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte="ANEEL, SIGA"
                    versao={a.data ?? ""}
                    nomeArquivo="empresas-usinas-sem-vinculo"
                    chaveUrl="sv"
                    ordemInicial={{ coluna: "mw", direcao: "desc" }}
                    nota={tx(
                      <>
                        Mesma raiz de CNPJ: matriz e filial publicadas com 100% cada (a mesma pessoa jurídica, sem consolidação). A lista inteira, das {inteiro(a.sem_vinculo_total)} usinas, está no{" "}
                        {csvAtivos ? <Baixar url={csvAtivos.url} rotulo={csvAtivos.rotulo} /> : "CSV de usinas e proprietários"}.
                      </>,
                      <>
                        Same CNPJ root: head office and branch published with 100% each (the same legal entity, without consolidation). The full list, of the {inteiro(a.sem_vinculo_total)} plants, is in
                        the {csvAtivos ? <Baixar url={csvAtivos.url} rotulo={csvAtivos.rotulo} /> : "plants and owners CSV"}.
                      </>,
                    )}
                  />
                </SecaoDoPainel>

                {t && (
                  <SecaoDoPainel
                    id="transmissao"
                    titulo={tx("Quem opera as linhas de transmissão?", "Who operates the transmission lines?")}
                    lead={`${semNomesDeCampo(def(t.definicoes.km_circuito))} ${semNomesDeCampo(def(t.regra_vinculo))}`}
                  >
                    {textoGruposNaTransmissao(t) && (
                      <p className="max-w-prose2 text-sm text-carvao-muted" data-grupos-transmissao="">
                        {comNomes(textoGruposNaTransmissao(t), t.maiores.flatMap((x) => [x.grupo_nome, x.nome]))}
                      </p>
                    )}
                    <GraficoBarras
                      rotulosSaoNomes
                      titulo={tx(
                        `As ${t.maiores.length} maiores concessionárias por km de circuito em operação, SIGET de ${dataTexto(t.data)}`,
                        `The ${t.maiores.length} largest concession holders by circuit km in operation, SIGET as of ${dataTexto(t.data)}`,
                      )}
                      dados={linhasTransmissao(t)}
                      chaveCategoria="id"
                      chaveRotulo="nome"
                      series={[{ id: "km", rotulo: tx("Circuito em operação", "Circuit in operation"), cor: COR_MEDIDA.circuito }]}
                      unidade="km" // i18n: dado
                      casas={1}
                      orientacao="horizontal"
                      rotulosValor
                    />
                    <EmpresasNota>
                      {tx(
                        <>
                          O gráfico mostra {inteiro(t.maiores.length)} das {inteiro(t.resumo.cnpjs)} concessionárias com contrato ({inteiro(t.resumo.cnpjs_com_modulos)} com módulos); as demais estão no{" "}
                          {csvTransmissao ? <Baixar url={csvTransmissao.url} rotulo={csvTransmissao.rotulo} /> : "CSV de transmissão"}.
                        </>,
                        <>
                          The chart shows {inteiro(t.maiores.length)} of the {inteiro(t.resumo.cnpjs)} concession holders with a contract ({inteiro(t.resumo.cnpjs_com_modulos)} with modules); the others are in
                          the {csvTransmissao ? <Baixar url={csvTransmissao.url} rotulo={csvTransmissao.rotulo} /> : "transmission CSV"}.
                        </>,
                      )}
                    </EmpresasNota>
                    <TabelaInterativa
                      titulo={tx("Concessionárias de transmissão: circuitos, subestações e transformação", "Transmission concession holders: circuits, substations and transformation")}
                      colunas={COLUNAS_TRANSMISSAO}
                      linhas={linhasTransmissao(t)}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte="ANEEL, SIGET"
                      versao={t.data ?? ""}
                      nomeArquivo="empresas-transmissao-maiores"
                      ordemInicial={{ coluna: "km", direcao: "desc" }}
                      nota={tx(
                        `Total do SIGET: ${numTexto(t.resumo.km_circuito_operacao)} km de circuito em operação, ${inteiro(t.resumo.subestacoes_distintas)} subestações distintas com equipamento. Todas as ${inteiro(t.resumo.cnpjs)} concessionárias com contrato estão no CSV de transmissão.`,
                        `SIGET total: ${numTexto(t.resumo.km_circuito_operacao)} circuit km in operation, ${inteiro(t.resumo.subestacoes_distintas)} distinct substations with equipment. All ${inteiro(t.resumo.cnpjs)} concession holders with a contract are in the transmission CSV.`,
                      )}
                    />
                    <TabelaInterativa
                      titulo={tx("Os maiores grupos na transmissão (topo da cadeia declarada)", "The largest groups in transmission (top of the declared chain)")}
                      colunas={COLUNAS_GRUPOS_TRANSMISSAO}
                      linhas={linhasGruposTransmissao(t)}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte={tx("ANEEL, SIGET e Composição Societária", "ANEEL, SIGET and shareholding structure dataset")}
                      versao={t.data ?? ""}
                      nomeArquivo="empresas-transmissao-grupos"
                      ordemInicial={{ coluna: "km", direcao: "desc" }}
                      nota={tx(
                        "Subestações do grupo: a união das subestações das empresas do grupo (a mesma subestação não conta duas vezes).",
                        "The group's substations: the union of the substations of the group's companies (the same substation does not count twice).",
                      )}
                    />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="fases" titulo={tx("Fases do SIGA e ramos declarados", "SIGA phases and declared lines of business")} nivel="analisar">
                  <TabelaInterativa
                    titulo={tx("Usinas por fase no SIGA", "Plants by phase in SIGA")}
                    colunas={COLUNAS_FASES}
                    linhas={linhasFases(a)}
                    chaveLinha="id"
                    colunaRotulo="fase"
                    fonte="ANEEL, SIGA"
                    versao={a.data ?? ""}
                    nomeArquivo="empresas-usinas-fase"
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-conciliacao-ralie="">
                    {textoFasesSigaERalie(a, ralie)}
                  </p>
                  <TabelaInterativa
                    titulo={tx(`Ramos declarados no cadastro de agentes (${c.agentes.ramos_universo})`, `Lines of business declared in the agent registry (${def(c.agentes.ramos_universo)})`)}
                    colunas={colunasRamos()}
                    linhas={(["geracao", "transmissao", "distribuicao", "comercializacao"] as const).map((r) => ({
                      id: r,
                      ramo: {
                        geracao: tx("Geração", "Generation"),
                        transmissao: tx("Transmissão", "Transmission"),
                        distribuicao: tx("Distribuição", "Distribution"),
                        comercializacao: tx("Comercialização", "Trading"),
                      }[r],
                      ativos: c.agentes.ramos[r],
                      todos: c.agentes.ramos_incluindo_inativos[r],
                    }))}
                    chaveLinha="id"
                    colunaRotulo="ramo"
                    fonte={tx("ANEEL, Agentes do Setor Elétrico", "ANEEL, power sector agents")}
                    versao={c.agentes.data ?? ""}
                    nomeArquivo="empresas-ramos-agentes"
                    nota={tx(
                      "O ramo é autodeclarado: o ramo distribuição inclui agentes que não são distribuidoras (por isso o índice da página de distribuidoras usa as bases reguladas).",
                      "The line of business is self-declared: the distribution line includes agents that are not distribution utilities (that is why the index on the distribution utilities page uses the regulated databases).",
                    )}
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      `${inteiro(a.proprietarios_cnpj)} proprietários com CNPJ nas usinas; ${inteiro(a.proprietarios_no_cadastro)} estão no cadastro de agentes e ${inteiro(a.proprietarios_fora_do_cadastro)} não.`,
                      `${inteiro(a.proprietarios_cnpj)} owners with CNPJ in the plants; ${inteiro(a.proprietarios_no_cadastro)} are in the agent registry and ${inteiro(a.proprietarios_fora_do_cadastro)} are not.`,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="regras-vinculo" titulo={tx("Regras de vínculo e conferências", "Link rules and cross-checks")} nivel="auditar">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-carvao">{tx("Vínculo", "Link")}</dt>
                      <dd className="mt-0.5 text-carvao-muted">{def(g.definicoes.vinculo)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-carvao">{tx("Capacidade proporcional", "Proportional capacity")}</dt>
                      <dd className="mt-0.5 text-carvao-muted">{def(g.definicoes.capacidade_proporcional)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-carvao">{tx("Capacidade sob controle direto", "Capacity under direct control")}</dt>
                      <dd className="mt-0.5 text-carvao-muted">{def(g.definicoes.capacidade_controle_direto)}</dd>
                    </div>
                    {t && (
                      <div>
                        <dt className="font-medium text-carvao">{tx("Vínculo na transmissão", "Link in transmission")}</dt>
                        <dd className="mt-0.5 text-carvao-muted">
                          {def(t.regra_vinculo)} {def(t.definicoes.km_circuito)} {def(t.definicoes.subestacoes)} {def(t.definicoes.mva)}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="text-sm text-carvao-muted">{comNomes(textoConferenciaAgentes(a.conferencia_agentes_geracao))}</p>
                  {a.conferencia_agentes_geracao && a.conferencia_agentes_geracao.exemplos.length > 0 && (
                    <TabelaInterativa
                      titulo={tx(
                        "Exemplos de usinas com CNPJ ou percentual diferente entre o SIGA e o conjunto Agentes de Geração",
                        "Examples of plants with a different CNPJ or percentage between SIGA and ANEEL's generation agents dataset",
                      )}
                      colunas={colunasConferencia()}
                      linhas={a.conferencia_agentes_geracao.exemplos.map((x) => ({
                        id: x.nucleo,
                        nucleo: x.nucleo,
                        motivo: x.motivo === "cnpj" ? tx("CNPJ diferente", "different CNPJ") : tx("percentual diferente", "different percentage"),
                        siga: textoParcelas(x.siga),
                        agentes: textoParcelas(x.agentes),
                      }))}
                      chaveLinha="id"
                      colunaRotulo="nucleo"
                      fonte={tx("ANEEL, SIGA e Agentes de Geração", "ANEEL, SIGA and generation agents dataset")}
                      versao={a.conferencia_agentes_geracao.data ?? ""}
                      nomeArquivo="empresas-conferencia-agentes-geracao"
                    />
                  )}
                  {t && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          Cobertura do SIGET: {inteiro(t.cobertura.modulos_lt_com_linha)} de {inteiro(t.cobertura.modulos_lt)} módulos de linha com extensão publicada; {inteiro(t.cobertura.modulos_me_com_equipamento)} de{" "}
                          {inteiro(t.cobertura.modulos_me)} módulos de equipamento com subestação; {inteiro(t.cobertura.modulos_sem_contrato)} módulos sem contrato; {inteiro(t.resumo.contratos_sem_cnpj)} contrato sem CNPJ;{" "}
                          {inteiro(t.resumo.cnpj_completados_com_zeros)} CNPJ publicados sem os zeros à esquerda e completados. Conferência com o cadastro: {inteiro(t.conferencia_cadastro_agentes.no_cadastro)} das{" "}
                          {inteiro(t.conferencia_cadastro_agentes.cnpjs_com_modulos)} concessionárias com módulos estão no cadastro de agentes, {inteiro(t.conferencia_cadastro_agentes.com_ramo_transmissao)} com o ramo
                          transmissão; {inteiro(t.conferencia_cadastro_agentes.ativos_com_ramo_sem_modulo_no_siget)} agentes ativos declaram o ramo e não têm módulo no SIGET.
                        </>,
                        <>
                          SIGET coverage: {inteiro(t.cobertura.modulos_lt_com_linha)} of {inteiro(t.cobertura.modulos_lt)} line modules with published length; {inteiro(t.cobertura.modulos_me_com_equipamento)} of{" "}
                          {inteiro(t.cobertura.modulos_me)} equipment modules with a substation; {inteiro(t.cobertura.modulos_sem_contrato)} modules without a contract; {inteiro(t.resumo.contratos_sem_cnpj)} contract(s)
                          without CNPJ; {inteiro(t.resumo.cnpj_completados_com_zeros)} CNPJs published without leading zeros and completed. Cross-check with the registry:{" "}
                          {inteiro(t.conferencia_cadastro_agentes.no_cadastro)} of the {inteiro(t.conferencia_cadastro_agentes.cnpjs_com_modulos)} concession holders with modules are in the agent registry,{" "}
                          {inteiro(t.conferencia_cadastro_agentes.com_ramo_transmissao)} with the transmission line of business; {inteiro(t.conferencia_cadastro_agentes.ativos_com_ramo_sem_modulo_no_siget)} active
                          agents declare the line of business and have no module in SIGET.
                        </>,
                      )}
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
                  ]).map((x) => ({ ...x, rotulo: traduzir(DOWNLOAD_EMPRESAS_EN, x.rotulo) }))}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
