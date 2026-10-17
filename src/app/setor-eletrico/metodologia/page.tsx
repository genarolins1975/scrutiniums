import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import type { ReactNode } from "react";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DadosAviso, DadosCapitulos, DadosLimitacoes, DadosResposta, DadosSeguir, ReferenciaDados } from "@/components/energia/DadosPainel";
import { DetalheDoNivel } from "@/components/energia/DetalheDoNivel";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { MetodologiaLinhagem } from "@/components/energia/MetodologiaLinhagem";
import { MetodologiaRegras } from "@/components/energia/MetodologiaRegras";
import { MetodologiaTarefas } from "@/components/energia/MetodologiaTarefas";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { LISTA_UNIDADES } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { conceitos } from "@/lib/energia/conteudo/conceitos";
import { DATASETS_INTEGRADOS, catalogoDados } from "@/lib/energia/datasets";
import { CSV_DADOS, URL_GOLD, afirmacoesConferidas, compactarLinhas, linhasMetricas, respostaRegras, resumoMetricas, ROTULO_ESTADO_DADOS } from "@/lib/energia/dados";
import { fichasDasFontes } from "@/lib/energia/dados-ficha";
import { maiuscula, quadroDeDatas, resumirAcessoCcee, separaIdentificadores, textoChecagensReprovadas, textoDatasDaColetaCcee, textoMudancaRegras, textoVersaoDoCodigo, vereditoRegras } from "@/lib/energia/dados-leitor";
import { acessoCceeDados, contagemNoCsvDoCatalogo, estadoDoArquivo, manifestoDados, metricasGeradoEm, metricasPublicadas, provenienciaDados, publicacaoDados, validacoesDosCsv, versoesDoCodigoDasBases } from "@/lib/energia/dados-servidor";
import { carimbo, dataBR, num, rotuloRegra } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import type { Natureza } from "@/lib/energia/tipos";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/metodologia", {
    title: tx("Do arquivo ao número: metodologia do Observatório do Setor Elétrico", "From the file to the number: methodology of the Power Sector Observatory"),
    description: tx(
      "O caminho de cada número, da fonte à tela, e a regra de cada indicador publicado: definição, unidade, recortes, fórmula, fontes com ficha e limitações. Natureza do dado, regra editorial, regras de classificação, governança de previsão e limitações do Observatório Brasileiro do Setor Elétrico.",
      "The path of each number, from the source to the screen, and the rule of each published indicator: definition, unit, scopes, formula, sources with a record and limitations. Nature of the data, editorial rule, classification rules, forecast governance and limitations of the Brazilian Power Sector Observatory.",
    ),
    alternates: { canonical: "/setor-eletrico/metodologia" },
  }, anterior);
}

/** Seção de página (fora do painel): título de nível 2 e texto em coluna de leitura; `larga` deixa a figura ocupar a largura da página e prende só os parágrafos à coluna. */
function Secao({ id, titulo, children, larga = false }: { id: string; titulo: string; children: ReactNode; larga?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-28 border-t border-linha py-8">
      <h2 id={`${id}-titulo`} className="ed-h2 font-serif text-carvao">
        {titulo}
      </h2>
      <div className={`mt-4 space-y-4 leading-relaxed text-carvao ${larga ? "[&>p]:max-w-4xl [&>div]:max-w-4xl" : "max-w-4xl"}`}>{children}</div>
    </section>
  );
}

/** Rótulo de cada frase da síntese, no idioma da página (função: o texto depende do idioma de quem lê). */
function rotuloFrase(id: string): string | undefined {
  const rotulos: Record<string, string> = tx(
    {
      reservatorios: "Reservatórios",
      afluencias: "Afluências",
      carga: "Carga",
      termica: "Participação térmica",
      pld: "PLD",
      preco: "PLD",
      rede: "Rede",
      descolamento: "Diferença entre submercados",
    },
    {
      reservatorios: "Reservoirs",
      afluencias: "Inflows",
      carga: "Load",
      termica: "Thermal share",
      pld: "PLD",
      preco: "PLD",
      rede: "Grid",
      descolamento: "Difference between submarkets",
    },
  );
  return rotulos[id];
}

/** Rótulos de regra que a gold escreve sem acento e que o rótulo geral não corrige. */
const rotuloDaRegra = (k: string) => (k === "validacao_fisica" ? tx("Validação física", "Physical validation") : rotuloRegra(k));

/** Situação da validação: em português, o identificador da gold com espaços (como sempre foi exibido); em inglês, a tradução. */
const rotuloSituacao = (x: string) =>
  tx(
    x.replace(/_/g, " "),
    (
      {
        reconciliacao_aprovada: "reconciliation approved",
        controles_aprovados: "controls approved",
        ressalva: "caveat",
        divergencia: "divergence",
        pendencia: "pending",
      } as Record<string, string>
    )[x] ?? x.replace(/_/g, " "),
  );

function Regras({ titulo, regras }: { titulo: string; regras?: Record<string, string> }) {
  if (!regras) return null;
  return (
    <div className="border-t border-linha pt-3">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      <dl className="mt-3 space-y-3">
        {Object.entries(regras).map(([k, v]) => (
          <div key={k}>
            <dt className="rotulo text-mineral">{rotuloDaRegra(k)}</dt>
            <dd className="mt-0.5 text-sm text-carvao-muted">
              <TrechoPortugues regiao="metodologia-regra">{v}</TrechoPortugues>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Campos de cada linha da lista de regras, na ordem em que viajam para o navegador (as chaves vão uma vez, não uma por linha). */
const CHAVES_DAS_REGRAS = ["id", "n", "titulo", "pergunta", "modulo", "natureza_fonte", "natureza_calculo", "unidade", "grao_geografico", "grao_temporal", "formula", "paginas"];

const LINK_DO_PASSO = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

const SITUACOES = ["reconciliacao_aprovada", "controles_aprovados", "ressalva", "divergencia", "pendencia"] as const;

export default function MetodologiaEnergia() {
  const meta = gold.meta();
  const sintese = gold.sintese();
  const cat = catalogoDados();
  const pub = publicacaoDados();
  const man = manifestoDados();
  const pendentes = conceitos().filter((c) => c.estado === "PENDENTE");
  const metricas = metricasPublicadas();
  const rm = resumoMetricas(metricas);
  const afirm = pub ? afirmacoesConferidas(pub) : [];
  const conferidas = afirm.filter((x) => x.conferida).length;
  const prov = pub ? provenienciaDados(pub.proveniencia.validacao) : null;
  const evAfirm = pub?.evidencias.afirmacoes_conferidas;
  const evReprovadas = pub?.evidencias.checagens_reprovadas;
  const evPublicados = pub?.evidencias.conjuntos_publicados;
  const eixos = pub?.eixos;
  const ccee = pub ? resumirAcessoCcee(acessoCceeDados(), pub.referencia.executado_em) : null;
  const decisaoCcee = ccee?.decididaEm ? dataBR(ccee.decididaEm) : tx("06/10/2026", dataBR("2026-10-06"));
  // as regras por indicador vêm de metricas.json, gerado em outro momento que o catálogo e a saúde (publicacao.json)
  const geradoRegras = metricasGeradoEm() ?? pub?.gerado_em ?? "";
  const dataRegras = geradoRegras ? dataBR(geradoRegras.slice(0, 10)) : tx("data não registrada", "date not recorded");
  const datas = pub ? quadroDeDatas({ referencia: pub.referencia.hoje, processadoEm: pub.gerado_em, metaEm: meta?.gerado_em, indicadoresEm: geradoRegras }) : [];
  const afirmLimitacoes = (pub?.afirmacoes ?? []).filter((a) => ["limites_intercambio", "cvu_usina", "geracao_usina", "despacho_termico"].includes(a.id));
  const completo = !!(pub && prov && metricas.length > 0);

  // a ficha de cada fonte que as regras citam, lida do catálogo: o nome do conjunto e o endereço da ficha
  const fontesCitadas = Array.from(new Set(metricas.reduce<string[]>((s, m) => s.concat(m.fontes), [])));
  const porIdNoCatalogo = new Set((cat?.entradas ?? []).map((e) => e.id));
  const fichas = new Set(DATASETS_INTEGRADOS.filter((d) => porIdNoCatalogo.has(d.catalogoId)).map((d) => d.slug));
  const fichasPorFonte = cat ? fichasDasFontes(fontesCitadas, cat, pub, fichas) : {};
  const matriz = compactarLinhas(linhasMetricas(metricas), CHAVES_DAS_REGRAS);

  // as checagens reprovadas do relatório, com o que a releitura do arquivo publicado mostra
  const reprovados = pub ? Array.from(validacoesDosCsv()).filter((par) => par[1].veredito === "reprovado").map((par) => estadoDoArquivo(`/energia/series/${par[0]}`, pub, man)) : [];
  const reprovadas = pub?.resumo.validacao.reprovado ?? 0;
  const notaReprovadas = textoChecagensReprovadas(reprovados, reprovadas);

  // o exemplo reproduzível: a mesma conta que a página pede, feita no arquivo que o leitor baixa
  const exemplo = contagemNoCsvDoCatalogo("PUBLICADO");
  const arquivoDoCatalogo = man?.arquivos.find((a) => a.caminho === CSV_DADOS.catalogo.url);
  const versoes = man ? textoVersaoDoCodigo(versoesDoCodigoDasBases(man)) : null;

  const ENDERECO = "https://scrutiniums.com/setor-eletrico/metodologia#regras";

  const oQueMudou = <>{textoMudancaRegras(afirm.map((x) => x.afirmacao), conferidas)}</>;
  const comoInterpretar = tx(
    <>
      A natureza do dado de origem e a do resultado são diferentes: um valor observado pode virar um calculado, e um calculado de dado estimado continua dependendo da estimativa. Mista é a combinação de naturezas. A regra de cobertura diz o mínimo para publicar; a política de ausência diz o que aparece quando falta (nunca zero).
    </>,
    <>
      The nature of the source data and that of the result are different: an observed value can become a calculated one, and a value calculated from estimated data still depends on the estimate. Mixed is the combination of natures. The coverage rule states the minimum to
      publish; the missing data policy states what appears when data are missing (never zero).
    </>,
  );
  const naoConcluir = tx(
    <>
      Que a regra publicada garanta a ausência de erro: ela diz o que o observatório faz, e as validações e a evidência de cada número dizem se deu certo. Que um indicador de um módulo possa ser comparado com um de outro sem olhar o recorte e a unidade. Que a lista esteja completa para o que a fonte publica: só entram os números que o observatório exibe.
    </>,
    <>
      That the published rule guarantees the absence of errors: it states what the observatory does, and the validations and the evidence of each number state whether it worked. That an indicator from one module can be compared with one from another without looking at the
      scope and the unit. That the list is complete for what the source publishes: only the numbers the observatory displays are included.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="metodologia" />
      <MarcaVisita secao="energia:metodologia" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16">
        <CabecalhoModulo
          siglas={["ONS", "ANEEL", "CCEE", "IBGE", "ENA", "REE", "MLT", "CVU", "PLD", "CMO"]}
          titulo={tx("Do arquivo ao número que você vê", "From the file to the number you see")}
          lead={tx(
            "Siga o caminho de um número, da fonte à tela, e consulte a regra de cada indicador: o que ele mede, como é calculado, de onde vem e o que não permite concluir.",
            "Follow the path of a number, from the source to the screen, and look up the rule of each indicator: what it measures, how it is calculated, where it comes from and what it does not allow one to conclude.",
          )}
          recorte={
            completo
              ? tx(`${num(rm.total, 0)} indicadores em ${rm.modulos} módulos · regras de ${dataRegras}`, `${num(rm.total, 0)} indicators in ${rm.modulos} modules · rules of ${dataRegras}`)
              : tx("Regras por indicador indisponíveis nesta publicação", "Rules by indicator unavailable in this publication")
          }
          fonte={tx("Scrutiniums, catálogo de indicadores dos módulos", "Scrutiniums, catalog of module indicators")}
          referencia={
            pub ? (
              <ReferenciaDados
                processadoEm={pub.gerado_em}
                referencia={dataBR(pub.referencia.hoje)}
                extra={tx(
                  <>
                    Catálogo de indicadores gerado em {carimbo(geradoRegras)}.{meta ? <> Último processamento completo: {carimbo(meta.gerado_em)}.</> : null}
                  </>,
                  <>
                    Indicator catalog generated on {carimbo(geradoRegras)}.{meta ? <> Latest full processing: {carimbo(meta.gerado_em)}.</> : null}
                  </>,
                )}
              />
            ) : undefined
          }
          metricas={
            completo ? (
              <FaixaMetricas
                colunas={3}
                rotulo={tx("Indicadores da metodologia", "Methodology indicators")}
                nota={tx("Medidas do catálogo inteiro de indicadores: não mudam com a busca nem com os filtros da lista.", "Measures of the whole indicator catalog: they do not change with the search or the list filters.")}
              >
                <Numero
                  variante="faixa"
                  rotulo={tx("Indicadores com regra publicada", "Indicators with a published rule")}
                  natureza="CALCULADO"
                  valor={rm.total}
                  casas={0}
                  unidade={tx("indicadores", "indicators")}
                  periodo={dataRegras}
                  endereco={ENDERECO}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Com fórmula publicada", "With a published formula")}
                  natureza="CALCULADO"
                  valor={rm.comFormula}
                  casas={0}
                  unidade={tx("indicadores", "indicators")}
                  periodo={dataRegras}
                  nota={tx(<>Nos demais, definição e regra de agregação.</>, <>For the others, definition and aggregation rule.</>)}
                  endereco={ENDERECO}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Com dado de origem observado", "With observed source data")}
                  natureza="CALCULADO"
                  valor={rm.observadas}
                  casas={0}
                  unidade={tx("indicadores", "indicators")}
                  periodo={dataRegras}
                  nota={tx(
                    <>Os outros {num(rm.total - rm.observadas, 0)} partem de dado estimado, calculado, previsto, de cenário ou misto.</>,
                    <>The other {num(rm.total - rm.observadas, 0)} start from estimated, calculated, forecast, scenario or mixed data.</>,
                  )}
                  endereco={ENDERECO}
                />
              </FaixaMetricas>
            ) : undefined
          }
        />

        <ModoProfundidade>
          {completo && pub && prov ? (
            <>
              <MetodologiaTarefas total={rm.total} comFormula={rm.comFormula} />

              <Secao id="linhagem" titulo={tx("Do arquivo da fonte ao número na tela", "From the source file to the number on screen")} larga>
                <MetodologiaLinhagem />
                {tx(
                  <p>
                    Cada valor guarda de qual coleta veio. Quando a fonte revisa um valor (o ONS declara que seus dados passam por consistência recorrente), o observatório guarda a versão nova sem apagar a anterior. A consulta &quot;como estava em&quot; devolve o valor conhecido em qualquer instante (com fuso explícito, sem ambiguidade de data) e é a que as variáveis de entrada de modelos em produção e os testes retrospectivos por versão devem usar. O teste retrospectivo da pesquisa atual foi feito sobre uma única cópia congelada dos dados, simulando o tempo real; a limitação está declarada em cada cartão de modelo.
                    <span data-nivel="analisar"> No vocabulário de engenharia: backtest sobre um snapshot único, em pseudo tempo real, com a vintage de cada observação.</span>
                  </p>,
                  <p>
                    Each value records which collection it came from. When the source revises a value (ONS states that its data undergo recurring consistency checks), the observatory stores the new version without erasing the previous one. The &quot;as it was on&quot;
                    query returns the value known at any instant (with an explicit time zone, with no date ambiguity) and is the one that the input variables of models in production and the retrospective tests by version must use. The retrospective test of the current
                    research was run on a single frozen copy of the data, simulating real time; the limitation is declared on each model card.
                    <span data-nivel="analisar"> In engineering vocabulary: backtest on a single snapshot, in pseudo real time, with the vintage of each observation.</span>
                  </p>,
                )}
                <p className="text-sm text-carvao-muted">
                  {tx(
                    "Datas distinguidas: período de referência; publicação pela fonte (quando informada); captura pela Scrutiniums; corte da previsão; emissão.",
                    "Dates kept apart: reference period; publication by the source (when reported); capture by Scrutiniums; forecast cutoff; issuance.",
                  )}
                </p>
                {tx(
                  <p className="text-sm text-carvao-muted">
                    A documentação técnica completa, com a arquitetura, o catálogo de fontes, a auditabilidade e a governança de previsão, está no{" "}
                    <a href="https://github.com/genarolins1975/scrutiniums/tree/main/docs/observatorios" target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                      repositório público do projeto ↗
                    </a>
                    , junto com o código que produz cada número.
                  </p>,
                  <p className="text-sm text-carvao-muted">
                    The complete technical documentation, with the architecture, the source catalog, auditability and forecast governance, is in the{" "}
                    <a href="https://github.com/genarolins1975/scrutiniums/tree/main/docs/observatorios" target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                      public repository of the project ↗
                    </a>
                    , along with the code that produces each number.
                  </p>,
                )}
                <div data-nivel="analisar" className="space-y-3 border-l-2 border-linha pl-3">
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      "Os nomes usuais em engenharia de dados são bronze (o arquivo original de cada captura), silver (o histórico de observações por captura, a vintage) e gold (os dados processados que as páginas publicam).",
                      "The usual names in data engineering are bronze (the original file of each capture), silver (the history of observations by capture, the vintage) and gold (the processed data the pages publish).",
                    )}
                  </p>
                  <pre tabIndex={0} aria-label={tx("Linhagem dos dados, do arquivo da fonte à visualização (rolável)", "Data lineage, from the source file to the visualization (scrollable)")} className="overflow-x-auto border border-linha bg-superficie p-4 font-mono text-xs leading-relaxed text-carvao">{tx(`FONTE (CCEE, ONS, ANEEL)
  ↓ captura: arquivo original, sha256, url, capturado_em, publicado_em (metadado da fonte)
BRONZE: cópia imutável por captura
  ↓ normalização determinística
SILVER (histórico): observações por vintage; só acrescenta, nunca apaga
  ↓ regras publicadas
GOLD (dados processados): indicadores com proveniência, publicados em /energia/gold
  ↓
INDICADOR → VISUALIZAÇÃO | MODELO

Previsões: VINTAGE DA FONTE → VARIÁVEIS DE ENTRADA → VERSÃO DO MODELO → PUBLICAÇÃO → REALIZADO → APURAÇÃO`, `SOURCE (CCEE, ONS, ANEEL)
  ↓ capture: original file, sha256, url, capturado_em, publicado_em (source metadata)
BRONZE: immutable copy per capture
  ↓ deterministic normalization
SILVER (history): observations by vintage; only appends, never deletes
  ↓ published rules
GOLD (processed data): indicators with provenance, published in /energia/gold
  ↓
INDICATOR → VISUALIZATION | MODEL

Forecasts: SOURCE VINTAGE → INPUT VARIABLES → MODEL VERSION → PUBLICATION → ACTUAL → SCORING`)}</pre>
                </div>
              </Secao>

              <Bloco id="regras">
                <PainelEvidencia
                  id="painel-regras"
                  pergunta={tx("Quais interpretações são permitidas?", "Which interpretations are allowed?")}
                  subtitulo={tx(
                    `${num(rm.total, 0)} indicadores em ${rm.modulos} módulos · regra, unidade, recortes, cobertura e limitações de cada um`,
                    `${num(rm.total, 0)} indicators in ${rm.modulos} modules · rule, unit, scopes, coverage and limitations of each one`,
                  )}
                  proveniencia={prov}
                  porQueImporta={tx(
                    <>
                      Um número sem regra convida a leitura que a regra não sustenta. Aqui, cada indicador diz o que mede, em que unidade, para qual recorte, como se agrega, o que acontece quando falta dado e o que ele não permite concluir.
                    </>,
                    <>
                      A number without a rule invites a reading the rule does not support. Here, each indicator states what it measures, in which unit, for which scope, how it aggregates, what happens when data are missing and what it does not allow one to conclude.
                    </>,
                  )}
                  oQueMudou={oQueMudou}
                  comoInterpretar={comoInterpretar}
                  naoConcluir={naoConcluir}
                  naoConcluirNoCorpo
                >
                  <div className="space-y-6">
                    <MetodologiaRegras
                      matriz={matriz}
                      versao={geradoRegras}
                      fichasPorFonte={fichasPorFonte}
                      arquivoCompleto={{ rotulo: tx("Catálogo de indicadores (JSON)", "Indicator catalog (JSON)"), url: URL_GOLD.metricas }}
                      tituloTabela={tx("Tabela completa das regras, com todas as colunas", "Complete table of the rules, with all the columns")}
                      apoioTabela={tx(
                        "A mesma busca e os mesmos filtros da lista, com as colunas de natureza, unidade e recortes para ordenar e comparar. O recorte escolhido na lista aparece aqui, e a tabela baixa o recorte em CSV ou XLSX.",
                        "The same search and the same filters as the list, with the nature, unit and scope columns to sort and compare. The selection chosen in the list appears here, and the table downloads the selection as CSV or XLSX.",
                      )}
                    >
                      <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} nome={tx("Quais interpretações são permitidas?", "Which interpretations are allowed?")} />

                      <DadosResposta depois painel="P070" veredito={vereditoRegras(rm)}>
                        {respostaRegras(rm)}
                      </DadosResposta>

                      <DadosCapitulos atual="regras" />

                      <SecaoDoPainel
                        id="exemplo-reproduzivel"
                        titulo={tx("Como refazer um número, passo a passo?", "How do I redo a number, step by step?")}
                        lead={tx(
                          "O exemplo refaz, com o arquivo que você baixa, o número de conjuntos publicados no catálogo. O caminho é o mesmo para qualquer número que tenha a ficha Comprove este número.",
                          "The example redoes, with the file you download, the number of datasets published in the catalog. The path is the same for any number that has the Verify this number record.",
                        )}
                      >
                        <ol className="max-w-prose2 space-y-1 text-sm leading-relaxed text-carvao" data-passos="exemplo">
                          <li>
                            <strong className="font-medium">{tx("1. Baixe o arquivo.", "1. Download the file.")}</strong> {tx("O catálogo completo, com uma linha por conjunto.", "The complete catalog, with one row per dataset.")}
                            <span className="block">
                              <a href={CSV_DADOS.catalogo.url} download className={LINK_DO_PASSO}>
                                {tx("Baixar o catálogo (CSV)", "Download the catalog (CSV)")}
                              </a>
                            </span>
                          </li>
                          <li className="pb-2">
                            <strong className="font-medium">{tx("2. Conte.", "2. Count.")}</strong>{" "}
                            {tx(
                              "Cada linha diz até onde o conjunto chegou, de catalogado a publicado. Conte as linhas cujo estado é PUBLICADO.",
                              "Each row states how far the dataset has come, from cataloged to published. Count the rows whose state is PUBLICADO (published).",
                            )}
                          </li>
                          <li>
                            <strong className="font-medium">{tx("3. Compare.", "3. Compare.")}</strong>{" "}
                            {exemplo ? (
                              <>
                                {tx(`Resultado: ${num(exemplo.doEstado, 0)} de ${num(exemplo.linhas, 0)} linhas.`, `Result: ${num(exemplo.doEstado, 0)} of ${num(exemplo.linhas, 0)} rows.`)}{" "}
                                {evPublicados && exemplo.doEstado === evPublicados.valor_calculo
                                  ? tx("É o mesmo número de Publicados no observatório, na primeira faixa da página Dados.", "It is the same number as Published in the observatory, in the first strip of the Data page.")
                                  : tx("Compare com Publicados no observatório, na primeira faixa da página Dados.", "Compare it with Published in the observatory, in the first strip of the Data page.")}
                              </>
                            ) : (
                              tx(
                                <>O resultado deve coincidir com Publicados no observatório, na primeira faixa da página Dados.</>,
                                <>The result should match Published in the observatory, in the first strip of the Data page.</>,
                              )
                            )}
                            <span className="block">
                              <Link href="/setor-eletrico/dados#catalogo" className={LINK_DO_PASSO}>
                                {tx("Abrir a página Dados", "Open the Data page")}
                              </Link>
                            </span>
                          </li>
                          <li>
                            <strong className="font-medium">{tx("4. Confira a origem.", "4. Check the origin.")}</strong>{" "}
                            {tx("A ficha mostra a fórmula, a fonte, a versão e a impressão digital dos arquivos de origem.", "The record shows the formula, the source, the version and the fingerprint of the source files.")}
                            {evPublicados && (
                              <span className="block">
                                <ComproveNumero evidencia={evPublicados} rotulo={tx("Comprove os conjuntos publicados", "Verify the published datasets")} endereco={ENDERECO} />
                              </span>
                            )}
                          </li>
                        </ol>
                        <div data-nivel="analisar" className="max-w-prose2 space-y-1 border-l-2 border-linha pl-3 text-sm leading-relaxed text-carvao-muted">
                          <p>
                            {tx(
                              "Arquivo: dados_catalogo.csv, coluna estado (ponto e vírgula como separador, campos de texto entre aspas).",
                              "File: dados_catalogo.csv, column estado (semicolon as separator, text fields in quotes).",
                            )}{" "}
                            {evPublicados?.consulta ? (
                              <>
                                {tx("Consulta que gera o número:", "Query that generates the number:")} <TrechoPortugues regiao="metodologia-consulta">{evPublicados.consulta}</TrechoPortugues>.
                              </>
                            ) : (
                              ""
                            )}{" "}
                            {evPublicados?.reproducao ? (
                              <>
                                {tx("Para refazer a publicação inteira:", "To redo the whole publication:")} <TrechoPortugues regiao="metodologia-reproducao">{evPublicados.reproducao}</TrechoPortugues>.
                              </>
                            ) : (
                              ""
                            )}
                          </p>
                        </div>
                        {arquivoDoCatalogo && (
                          <p data-nivel="auditar" className="max-w-prose2 break-all border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">
                            {tx(
                              `Impressão digital (sha256) do arquivo na lista de arquivos: ${arquivoDoCatalogo.sha256}. Confira a do arquivo baixado na página Download e reprodução.`,
                              `Fingerprint (sha256) of the file in the file list: ${arquivoDoCatalogo.sha256}. Check that of the downloaded file on the Download and reproduction page.`,
                            )}
                          </p>
                        )}
                      </SecaoDoPainel>

                      <SecaoDoPainel id="checagens" titulo={tx("Como o observatório confere as próprias afirmações e arquivos?", "How does the observatory check its own statements and files?")}>
                        <FaixaMetricas
                          colunas={2}
                          rotulo={tx("Conferências automáticas", "Automatic checks")}
                          nota={tx("Medidas da publicação inteira: não mudam com a busca nem com os filtros da lista.", "Measures of the whole publication: they do not change with the search or the list filters.")}
                        >
                          <Numero
                            variante="faixa"
                            rotulo={tx("Afirmações de fonte integrada conferidas", "Statements about integrated sources checked")}
                            natureza="CALCULADO"
                            evidencia={evAfirm ?? null}
                            valor={conferidas}
                            casas={0}
                            unidade={tx("afirmações", "statements")}
                            nota={tx(<>De {num(afirm.length, 0)}, contra o estado real do catálogo.</>, <>Of {num(afirm.length, 0)}, against the actual state of the catalog.</>)}
                            motivoAusencia={tx("Sem afirmações conferidas nesta publicação.", "No statements checked in this publication.")}
                            endereco={ENDERECO}
                          />
                          <Numero
                            variante="faixa"
                            rotulo={tx("Checagens automáticas reprovadas", "Automatic checks failed")}
                            natureza="CALCULADO"
                            evidencia={evReprovadas ?? null}
                            valor={reprovadas}
                            casas={0}
                            unidade={tx("checagens", "checks")}
                            nota={
                              <>
                                {tx(
                                  `De ${num(pub.resumo.validacao.checagens, 0)}; ${num(pub.resumo.validacao.ressalva, 0)} com ressalva.`,
                                  `Of ${num(pub.resumo.validacao.checagens, 0)}; ${num(pub.resumo.validacao.ressalva, 0)} with a caveat.`,
                                )}{" "}
                                {notaReprovadas.curta}
                              </>
                            }
                            endereco={ENDERECO}
                          />
                        </FaixaMetricas>
                        {reprovadas > 0 && notaReprovadas.frase && (
                          <DadosAviso>
                            <p>{notaReprovadas.frase}</p>
                          </DadosAviso>
                        )}
                        {notaReprovadas.tecnico && (
                          <p data-nivel="analisar" className="max-w-prose2 break-words border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">
                            {notaReprovadas.tecnico}
                          </p>
                        )}
                        <p className="text-sm text-carvao-muted">
                          {tx("O estado de cada arquivo publicado está em", "The state of each published file is in")}{" "}
                          <Link href="/setor-eletrico/dados/reproducao#tabela" className="text-energia-dark underline underline-offset-4">
                            {tx("Download e reprodução", "Download and reproduction")}
                          </Link>
                          .
                        </p>
                      </SecaoDoPainel>
                    </MetodologiaRegras>

                    <SecaoDoPainel id="afirmacoes" nivel="analisar" titulo={tx("Afirmações sobre fontes integradas, conferidas com o catálogo", "Statements about integrated sources, checked against the catalog")}>
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                        {tx(
                          "Cada frase abaixo é escrita pelo pipeline a partir do estado real do catálogo: o conjunto só é descrito como integrado, validado ou publicado se a escada chegou lá. Uma afirmação cujo conjunto está fora do catálogo, ou só catalogado, reprova.",
                          "Each sentence below is written by the pipeline from the actual state of the catalog: the dataset is only described as integrated, validated or published if the ladder got there. A statement whose dataset is outside the catalog, or only cataloged, fails.",
                        )}
                      </p>
                      <ul className="space-y-3" data-lista="afirmacoes">
                        {afirm.map(({ afirmacao: a, conferida, motivo }) => (
                          <li key={a.id} className="border border-linha bg-superficie p-4" data-afirmacao={a.id}>
                            <p className="flex flex-wrap items-baseline gap-x-3">
                              <strong className="font-medium text-carvao">
                                <TrechoPortugues regiao="metodologia-afirmacao">{a.tema}</TrechoPortugues>
                              </strong>
                              <span className={`rotulo ${conferida ? "text-sucesso" : "text-erro"}`}>
                                {conferida ? tx("● conferida com o catálogo", "● checked against the catalog") : tx(`✕ não confere: ${motivo}`, `✕ does not match: ${motivo}`)}
                              </span>
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">
                              <TrechoPortugues regiao="metodologia-afirmacao">{a.texto}</TrechoPortugues>
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-mineral">
                              {tx("Conjuntos citados:", "Datasets cited:")} {a.conjuntos.map((c) => `${c.id} (${ROTULO_ESTADO_DADOS[c.estado].toLowerCase()})`).join("; ")}.
                            </p>
                            {a.afirmacao_anterior && (
                              <p className="mt-2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao">
                                <span className="rotulo mr-2 text-aviso">{tx("Correção", "Correction")}</span>
                                <TrechoPortugues regiao="metodologia-afirmacao">
                                  {a.afirmacao_anterior} {a.correcao_metodologia ?? ""}
                                </TrechoPortugues>
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </SecaoDoPainel>

                    {eixos && (
                      <SecaoDoPainel id="eixos" nivel="analisar" titulo={tx("Natureza do dado e situação da validação, ficha a ficha", "Nature of the data and validation status, record by record")}>
                        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                          {tx(
                            `Cada ficha de evidência (${num(eixos.fichas, 0)}) tem uma natureza e uma situação de validação. ${num(eixos.fichas_sem_natureza_vinculada, 0)} fichas não têm natureza vinculada com segurança e aparecem como sem vínculo: a situação da validação é publicada, e a natureza fica em aberto em vez de ser chutada.`,
                            `Each evidence record (${num(eixos.fichas, 0)}) has a nature and a validation status. ${num(eixos.fichas_sem_natureza_vinculada, 0)} records do not have a reliably linked nature and appear as unlinked: the validation status is published, and the nature is left open instead of being guessed.`,
                          )}
                        </p>
                        <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Fichas por natureza e situação da validação (tabela rolável)", "Records by nature and validation status (scrollable table)")}>
                          <table className="w-full min-w-[40rem] border-collapse text-xs">
                            <caption className="sr-only">{tx("Número de fichas de evidência por natureza do dado e situação da validação", "Number of evidence records by nature of the data and validation status")}</caption>
                            <thead>
                              <tr className="text-left text-mineral">
                                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">
                                  {tx("Natureza", "Nature")}
                                </th>
                                {SITUACOES.map((x) => (
                                  <th key={x} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                                    {rotuloSituacao(x)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(eixos.matriz).map(([n, linha]) => (
                                <tr key={n} className="border-b border-linha">
                                  <th scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                                    {n === "SEM_VINCULO" ? tx("Sem natureza vinculada", "No linked nature") : NATUREZAS[n as Natureza]?.rotulo ?? n}
                                  </th>
                                  {SITUACOES.map((x) => (
                                    <td key={x} className="px-2 py-1.5 tabular-nums text-carvao-muted">
                                      {num(linha[x] ?? 0, 0)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                          {SITUACOES.map((x) => (
                            <div key={x}>
                              <dt className="font-medium text-carvao">{rotuloSituacao(x)}</dt>
                              <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                                <TrechoPortugues regiao="metodologia-situacao">{eixos.situacoes[x]}</TrechoPortugues>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </SecaoDoPainel>
                    )}

                    <SecaoDoPainel id="regras-pipeline" nivel="auditar" titulo={tx("Regras do pipeline: estados, uso, validação, horizonte e tempo", "Pipeline rules: states, use, validation, horizon and time")}>
                      <dl className="space-y-4 text-sm">
                        <div>
                          <dt className="rotulo text-mineral">{tx("Uso e estado", "Use and state")}</dt>
                          <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">
                            <TrechoPortugues regiao="metodologia-regras-pipeline">{pub.regras.uso}</TrechoPortugues>
                          </dd>
                        </div>
                        <div>
                          <dt className="rotulo text-mineral">{tx("Validação", "Validation")}</dt>
                          <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">
                            <TrechoPortugues regiao="metodologia-regras-pipeline">{pub.regras.validacao}</TrechoPortugues>
                          </dd>
                        </div>
                        <div>
                          <dt className="rotulo text-mineral">{tx("Revisão", "Revision")}</dt>
                          <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">
                            <TrechoPortugues regiao="metodologia-regras-pipeline">{pub.regras.revisao}</TrechoPortugues>
                          </dd>
                        </div>
                        <div>
                          <dt className="rotulo text-mineral">{tx("Datas distinguidas", "Dates kept apart")}</dt>
                          <dd className="mt-1">
                            <dl className="space-y-1.5">
                              {Object.entries(pub.regras.tempo).map(([k, v]) => (
                                <div key={k}>
                                  <dt className="inline font-medium text-carvao">{rotuloRegra(k)}: </dt>
                                  <dd className="inline leading-relaxed text-carvao-muted">
                                    <TrechoPortugues regiao="metodologia-regras-pipeline">{v}</TrechoPortugues>
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </dd>
                        </div>
                        <div>
                          <dt className="rotulo text-mineral">{tx("Referências legitimamente posteriores à captura (horizonte)", "References legitimately later than the capture (horizon)")}</dt>
                          <dd className="mt-1">
                            <ul className="list-disc space-y-0.5 pl-5 leading-relaxed text-carvao-muted">
                              {Object.entries(pub.regras.horizonte).map(([k, v]) => (
                                <li key={k}>
                                  <span className="font-medium text-carvao">{k}</span>: <TrechoPortugues regiao="metodologia-regras-pipeline">{v}</TrechoPortugues>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      </dl>
                    </SecaoDoPainel>

                    <DadosLimitacoes
                      itens={[
                        tx(
                          <>A lista é a do observatório em {dataRegras}; indicador novo só aparece na próxima atualização.</>,
                          <>The list is the observatory&apos;s on {dataRegras}; a new indicator only appears at the next update.</>,
                        ),
                        tx(
                          <>O rótulo Estimado não separa o valor estimado pela fonte do estimado pelo observatório: a plataforma tem uma só categoria para os dois, e nenhuma ficha diz qual dos dois é. A separação está pedida e ainda não foi feita.</>,
                          <>The Estimated label does not separate the value estimated by the source from the one estimated by the observatory: the platform has a single category for both, and no record says which of the two it is. The separation has been requested and not yet done.</>,
                        ),
                      ]}
                      tecnicas={
                        eixos?.limitacao_natureza
                          ? [
                              <TrechoPortugues key="natureza" regiao="metodologia-limitacoes">
                                {eixos.limitacao_natureza}
                              </TrechoPortugues>,
                            ]
                          : []
                      }
                    />
                    <DadosSeguir
                      ancora="painel-regras"
                      proximo={{ href: "/setor-eletrico/dados", pergunta: tx("Quais dados estão de fato validados?", "Which data are actually validated?") }}
                      downloads={[
                        { rotulo: tx("Catálogo de métricas (JSON)", "Metrics catalog (JSON)"), url: URL_GOLD.metricas },
                        { rotulo: tx("Natureza e validação por ficha (CSV)", "Nature and validation by record (CSV)"), url: CSV_DADOS.eixos.url },
                      ]}
                    />
                  </div>
                </PainelEvidencia>
              </Bloco>
            </>
          ) : (
            <Bloco id="regras">
              <p className="border border-dashed border-mineral bg-papel p-5 text-sm leading-relaxed text-carvao-muted" role="status">
                {tx(
                  "As regras por indicador não estão disponíveis nesta publicação: o catálogo de métricas ou a gold de publicação não foi gerado. As seções abaixo, escritas à mão, continuam valendo.",
                  "The rules by indicator are not available in this publication: the metrics catalog or the publication gold file was not generated. The sections below, written by hand, still apply.",
                )}
              </p>
            </Bloco>
          )}

          <Secao id="natureza" titulo={tx("Taxonomia de natureza do dado", "Taxonomy of the nature of the data")}>
            <p>
              {tx(
                "Todo número exibido carrega um selo. As categorias nunca se confundem, e a forma do selo muda com a categoria, não só a cor.",
                "Every number displayed carries a badge. The categories are never confused, and the shape of the badge changes with the category, not just the color.",
              )}
            </p>
            <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {(Object.keys(NATUREZAS) as Natureza[]).map((n) => (
                <li key={n} className="flex items-start gap-3 border-t border-linha pt-3">
                  <SeloNatureza natureza={n} />
                  <span className="text-sm text-carvao-muted">{NATUREZAS[n].definicao}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-carvao-muted">
              {tx(
                "O CMO semanal é publicado pelo ONS como saída do modelo DECOMP: para a plataforma é OBSERVADO (valor oficial), com a nota de que é resultado de modelo da fonte. Médias diárias do PLD e participações por fonte são CALCULADAS pela Scrutiniums a partir de valores observados.",
                "The weekly CMO is published by ONS as an output of the DECOMP model: for the platform it is OBSERVED (official value), with the note that it is a result of the source's model. Daily PLD averages and shares by source are CALCULATED by Scrutiniums from observed values.",
              )}
            </p>
          </Secao>

          <Secao id="unidades" titulo={tx("Unidades", "Units")}>
            <p>{tx("Convenções de medida usadas neste observatório, com a unidade em que cada fonte publica:", "Measurement conventions used in this observatory, with the unit in which each source publishes:")}</p>
            <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2 lg:grid-cols-3">
              {LISTA_UNIDADES.map((x) => (
                <div key={x.u} className="border-t border-linha pt-3">
                  <dt className="font-medium text-carvao">
                    {x.u} · {x.nome}
                  </dt>
                  <dd className="mt-1 text-sm text-carvao-muted">{x.dica}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-carvao-muted">
              {tx(
                "Preços em reais por megawatt-hora (R$/MWh), sempre nominais: sem correção pela inflação. A descrição do conjunto de PLD na CCEE registra a unidade apenas como R$; a do CMO semanal, no dicionário do ONS, como R$/MW.",
                "Prices in reais per megawatt-hour (R$/MWh), always nominal: not adjusted for inflation. The description of the PLD dataset at CCEE records the unit only as R$; that of the weekly CMO, in the ONS dictionary, as R$/MW.",
              )}
            </p>
          </Secao>

          <Secao id="editorial" titulo={tx("Regra editorial", "Editorial rule")}>
            <p>
              {tx(
                "Toda visualização relevante responde, nesta ordem: o que estou vendo, por que importa, o que mudou, como interpretar, o que não é possível concluir e qual é a fonte. A regra é obrigatória no componente de painel: um painel sem esses campos não é construído.",
                "Every relevant visualization answers, in this order: what am I seeing, why it matters, what changed, how to interpret it, what cannot be concluded and what the source is. The rule is mandatory in the panel component: a panel without these fields is not built.",
              )}
            </p>
          </Secao>

          <Secao id="classificacao" titulo={tx("Regras de classificação publicadas", "Published classification rules")}>
            {tx(
              <p>Nenhuma classificação (&quot;baixo&quot;, &quot;alto&quot;, &quot;fora da faixa usual&quot;) existe sem regra estatística declarada. As regras em vigor, lidas dos próprios dados publicados:</p>,
              <p>No classification (&quot;low&quot;, &quot;high&quot;, &quot;outside the usual range&quot;) exists without a declared statistical rule. The rules in force, read from the published data themselves:</p>,
            )}
            <DetalheDoNivel resumo={tx("Ver as regras de cada módulo", "See the rules of each module")} abreEm="analisar" className="max-w-none">
              <div className="grid gap-x-8 gap-y-6 pt-3 md:grid-cols-2">
                <Regras titulo="PLD" regras={gold.pld()?.regras} />
                <Regras titulo={tx("Hidrologia", "Hydrology")} regras={gold.hidrologia()?.regras} />
                <Regras titulo={tx("Carga", "Load")} regras={gold.carga()?.regras} />
                <Regras titulo={tx("Geração", "Generation")} regras={gold.geracao()?.regras} />
                <Regras titulo={tx("Rede", "Grid")} regras={gold.rede()?.regras} />
              </div>
            </DetalheDoNivel>
          </Secao>

          <Secao id="sintese" titulo={tx("Frases e alertas da Visão geral", "Sentences and alerts of the Overview")}>
            {tx(
              <p>
                A síntese &quot;o sistema em 60 segundos&quot; e a lista &quot;o que observar&quot; são montadas por regras fixas a partir dos dados processados; nenhum texto é redigido livremente. Cada frase tem sua regra; cada alerta, sua condição. As regras de cada frase repetem as fórmulas acima e estão em Analisar.
              </p>,
              <p>
                The &quot;the system in 60 seconds&quot; summary and the &quot;what to watch&quot; list are assembled by fixed rules from the processed data; no text is written freely. Each sentence has its rule; each alert, its condition. The rules of each sentence repeat
                the formulas above and are in Analyze.
              </p>,
            )}
            {sintese && (
              <ul data-nivel="analisar" className="space-y-2 text-sm">
                {sintese.frases.map((f) => (
                  <li key={f.id} className="border border-linha bg-superficie p-3">
                    <strong className="font-medium">{rotuloFrase(f.id) ?? maiuscula(f.id)}:</strong> <TrechoPortugues regiao="metodologia-sintese">{f.regra}</TrechoPortugues>
                  </li>
                ))}
                {sintese.observar.map((o) => (
                  <li key={o.id} className="border border-linha bg-superficie p-3">
                    <strong className="font-medium">
                      <TrechoPortugues regiao="metodologia-sintese">{maiuscula(o.titulo)}</TrechoPortugues>:
                    </strong>{" "}
                    <TrechoPortugues regiao="metodologia-sintese">{o.condicao}</TrechoPortugues>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao id="previsao" titulo={tx("Governança de previsão", "Forecast governance")}>
            {tx(
              <p>
                Modelos têm estado explícito: PESQUISA, VALIDAÇÃO, PRODUÇÃO ou APOSENTADO. Só modelo em PRODUÇÃO alimenta a previsão principal. Cada previsão registrada ganha um identificador e uma impressão digital do conteúdo<span data-nivel="analisar"> (sha256)</span>; correção cria novo registro que aponta para o original, com motivo. Faixas de incerteza só são chamadas de &quot;80%&quot; quando a cobertura medida fora do ajuste sustenta isso.
              </p>,
              <p>
                Models have an explicit state: RESEARCH, VALIDATION, PRODUCTION or RETIRED. Only a model in PRODUCTION feeds the main forecast. Each recorded forecast gets an identifier and a fingerprint of its content<span data-nivel="analisar"> (sha256)</span>; a
                correction creates a new record that points to the original, with a reason. Uncertainty bands are only called &quot;80%&quot; when the coverage measured outside the fit supports it.
              </p>,
            )}
            {tx(
              <p>
                Veja o{" "}
                <Link href="/setor-eletrico/pld/modelos" className="text-energia-dark underline underline-offset-4">
                  registro de modelos
                </Link>{" "}
                e o{" "}
                <Link href="/setor-eletrico/pld/previsoes" className="text-energia-dark underline underline-offset-4">
                  histórico de previsões
                </Link>
                .
              </p>,
              <p>
                See the{" "}
                <Link href="/setor-eletrico/pld/modelos" className="text-energia-dark underline underline-offset-4">
                  model register
                </Link>{" "}
                and the{" "}
                <Link href="/setor-eletrico/pld/previsoes" className="text-energia-dark underline underline-offset-4">
                  forecast history
                </Link>
                .
              </p>,
            )}
          </Secao>

          <Secao id="limitacoes" titulo={tx("Limitações gerais desta fase", "General limitations of this phase")}>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                {tx(
                  <>
                    O portal de dados abertos da CCEE recusa consultas automáticas comuns. O observatório usa um cliente próprio, com coleta autorizada pelo responsável em {decisaoCcee} para o PLD horário, os conjuntos abertos do Mercado e o InfoMercado, e tenta a coleta em cada atualização agendada. O histórico do PLD de 2021 a 2025 vem das capturas primárias de 27/09/2026.
                    <span data-nivel="analisar">
                      {" "}
                      Detalhe técnico: a recusa é um HTTP 403 com página de acesso bloqueado para o curl; o cliente do pipeline segue com o User-Agent do projeto e sem disfarce de navegador, e as capturas são versionadas com sha256.
                    </span>
                  </>,
                  <>
                    The CCEE open data portal refuses ordinary automated queries. The observatory uses its own client, with collection authorized by the person in charge on {decisaoCcee} for the hourly PLD, the open Market datasets and InfoMercado, and attempts
                    the collection at each scheduled update. The PLD history from 2021 to 2025 comes from the primary captures of {dataBR("2026-09-27")}.
                    <span data-nivel="analisar">
                      {" "}
                      Technical detail: the refusal is an HTTP 403 with a blocked access page for curl; the pipeline client proceeds with the project&apos;s User-Agent and without disguising itself as a browser, and the captures are versioned with sha256.
                    </span>
                  </>,
                )}{" "}
                {meta?.fontes?.ccee_pld_horario?.ultima_tentativa
                  ? tx(
                      `Última tentativa do PLD horário: ${carimbo(meta.fontes.ccee_pld_horario.ultima_tentativa.tentado_em)}, ${meta.fontes.ccee_pld_horario.ultima_tentativa.ok ? "bem-sucedida" : "sem sucesso"}.`,
                      `Latest attempt for the hourly PLD: ${carimbo(meta.fontes.ccee_pld_horario.ultima_tentativa.tentado_em)}, ${meta.fontes.ccee_pld_horario.ultima_tentativa.ok ? "successful" : "unsuccessful"}.`,
                    )
                  : tx("Nenhuma tentativa registrada nesta publicação.", "No attempt recorded in this publication.")}
                {pub && ccee && textoDatasDaColetaCcee(ccee, pub.referencia.hoje, pub.gerado_em) ? <span data-datas-coleta-ccee="true"> {textoDatasDaColetaCcee(ccee, pub.referencia.hoje, pub.gerado_em)}</span> : null}
              </li>
              <li>
                {tx(
                  <>
                    Os limites regulatórios do PLD (piso, teto horário e teto estrutural) vêm dos atos da ANEEL, com o ato e a vigência de cada valor, no{" "}
                    <Link href="/setor-eletrico/regulacao#p044" className="text-energia-dark underline underline-offset-4">
                      painel de limites da Regulação
                    </Link>
                    ; o &quot;menor valor observado no ano&quot; é descritivo e nunca é chamado de piso.
                  </>,
                  <>
                    The regulatory limits of the PLD (floor, hourly ceiling and structural ceiling) come from ANEEL acts, with the act and the validity of each value, in the{" "}
                    <Link href="/setor-eletrico/regulacao#p044" className="text-energia-dark underline underline-offset-4">
                      Regulation limits panel
                    </Link>
                    ; the &quot;lowest value observed in the year&quot; is descriptive and is never called a floor.
                  </>,
                )}
              </li>
              {/* afirmações de integração geradas pelo pipeline a partir do estado real do catálogo */}
              {afirmLimitacoes.map((a) => {
                const { texto, tecnico } = separaIdentificadores(a.texto);
                return (
                  <li key={a.id}>
                    <TrechoPortugues regiao="metodologia-afirmacao">{texto}</TrechoPortugues>
                    {tecnico && <span data-nivel="analisar"> {tecnico}</span>}
                  </li>
                );
              })}
              <li>
                {pendentes.length === 0
                  ? tx("Todos os verbetes do Aprenda têm a definição conferida em fonte primária.", "All Learn entries have their definition checked against a primary source.")
                  : tx(
                      `${pendentes.length === 1 ? "Um verbete do Aprenda aparece" : `${pendentes.length} verbetes do Aprenda aparecem`} em preparação, sem definição, porque a fonte primária que o define não foi encontrada nos documentos consultados (${pendentes.map((c) => c.sigla ?? c.nome).join(", ")}); cada um diz o que já foi consultado e o que falta.`,
                      `${pendentes.length === 1 ? "One Learn entry appears" : `${pendentes.length} Learn entries appear`} in preparation, without a definition, as the primary source that defines ${pendentes.length === 1 ? "it" : "them"} was not found in the documents consulted (${pendentes.map((c) => c.sigla ?? c.nome).join(", ")}); each one says what has already been consulted and what is missing.`,
                    )}
              </li>
              <li>{tx("Valores monetários em R$ nominais.", "Monetary values in nominal R$.")}</li>
              <li>
                {tx(
                  <>
                    O histórico de versões anteriores dos dados persiste no cache da automação (GitHub Actions) e tem uma cópia durável numa versão publicada do repositório. Os arquivos originais de cada coleta não têm cópia, mas a impressão digital de cada um fica registrada no histórico. Se o cache e a cópia se perderem, a automação abre um alerta, os dados publicados continuam corretos e só o registro de revisões anteriores se perde.
                    <span data-nivel="analisar">
                      {" "}
                      No vocabulário de engenharia: o histórico de vintages persiste no cache da automação; o silver (banco com vintages e observações) tem cópia durável numa release; os arquivos brutos do bronze não têm, mas o sha256 de cada um fica registrado no silver.
                    </span>
                  </>,
                  <>
                    The history of previous versions of the data persists in the automation cache (GitHub Actions) and has a durable copy in a published release of the repository. The original files of each collection have no copy, but the fingerprint of each one is
                    recorded in the history. If the cache and the copy are lost, the automation opens an alert, the published data remain correct and only the record of previous revisions is lost.
                    <span data-nivel="analisar">
                      {" "}
                      In engineering vocabulary: the vintage history persists in the automation cache; the silver (database with vintages and observations) has a durable copy in a release; the raw bronze files do not, but the sha256 of each one is recorded in the silver.
                    </span>
                  </>,
                )}
              </li>
              <li>
                {tx(
                  "Quando a fonte remove uma referência de um arquivo, a remoção não é registrada: a série continua com o último valor publicado para ela. Revisões de valor são registradas.",
                  "When the source removes a reference from a file, the removal is not recorded: the series keeps the last value published for it. Value revisions are recorded.",
                )}
              </li>
            </ul>
          </Secao>

          <Secao id="versao" titulo={tx("Versão desta publicação", "Version of this publication")}>
            {meta ? (
              <p className="text-sm">
                {tx(
                  `Último processamento completo dos dados: ${carimbo(meta.gerado_em)} · coleta executada nesse processamento: ${meta.coleta_executada ? "sim" : "não (reconstrução a partir do estado salvo)"}.`,
                  `Latest full processing of the data: ${carimbo(meta.gerado_em)} · collection run in that processing: ${meta.coleta_executada ? "yes" : "no (rebuilt from the saved state)"}.`,
                )}
                <span data-nivel="auditar">
                  {" "}
                  {tx(
                    `Versão do processamento ${meta.versao_pipeline}${meta.versao_codigo ? ` · código ${meta.versao_codigo}` : ""} · falhas de construção: ${meta.builders_falhos.length} · regressões retidas: ${meta.regressoes.length}.`,
                    `Processing version ${meta.versao_pipeline}${meta.versao_codigo ? ` · code ${meta.versao_codigo}` : ""} · build failures: ${meta.builders_falhos.length} · regressions held back: ${meta.regressoes.length}.`,
                  )}
                </span>
              </p>
            ) : (
              <p className="text-sm text-mineral">{tx("Metadados da publicação indisponíveis.", "Publication metadata unavailable.")}</p>
            )}
            {datas.length > 0 && (
              <ul className="space-y-1 text-sm text-carvao-muted" data-lista="datas">
                {datas.map((x) => (
                  <li key={x.rotulo}>
                    <strong className="font-medium text-carvao">
                      {x.rotulo}: {x.valor}.
                    </strong>{" "}
                    {maiuscula(x.mede)}.
                  </li>
                ))}
              </ul>
            )}
            {versoes && (
              <p className="text-sm text-carvao-muted" data-versao-do-codigo="">
                {versoes.resumo}{" "}
                <Link href="/setor-eletrico/dados/reproducao#versao-do-codigo" className="text-energia-dark underline underline-offset-4">
                  {tx("Ver a versão de cada base", "See the version of each base")}
                </Link>
                .<span data-nivel="analisar"> {versoes.sufixo}</span>
              </p>
            )}
          </Secao>
        </ModoProfundidade>
      </main>
    </>
  );
}
