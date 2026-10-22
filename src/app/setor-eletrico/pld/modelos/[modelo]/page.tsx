import type { ReactNode } from "react";
import type { Idioma } from "@/lib/idioma";
import type { Metadata, ResolvingMetadata } from "next";
import { caminhoComParametros, metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { notFound } from "next/navigation";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { SituacaoDoModelo } from "@/components/energia/EstadoModelo";
import { PrevisoesCoeficientes } from "@/components/energia/PrevisoesCoeficientes";
import {
  PrevisoesAuditoria,
  PrevisoesAviso,
  PrevisoesFaixaFichas,
  PrevisoesFichaLinha,
  PrevisoesLegenda,
  PrevisoesRecorte,
  PrevisoesResposta,
  PrevisoesResumoFicha,
  PrevisoesSeguir,
  PrevisoesTermos,
} from "@/components/energia/PrevisoesPagina";
import { PrevisoesReexecucao } from "@/components/energia/PrevisoesReexecucao";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { CONFIG_MODELOS_EN, marcadoMercado, textoRegistroModelos, traducaoExata, traducaoPrevisoes } from "@/lib/energia/i18n/mercado-preco";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { semCaminhosDeArquivo } from "@/lib/energia/bastidor";
import type { ModelosGold } from "@/lib/energia/tipos";
import {
  GOLD_PREVISOES,
  VARIAVEL_D7,
  colunasCoeficientes,
  emissaoDoModelo,
  enderecoPainel,
  exemploDoModelo,
  fichasOrdenadas,
  formulaEmPalavras,
  linhasCoeficientes,
  linhasReexecucao,
  minusculaInicial,
  motivoGravado,
  notaEntradas,
  papelCurto,
  paraLeitorPrevisoes,
  perguntaPainel,
  provenienciaParaLeitor,
  reexecucaoCurta,
  respostaFicha,
  rotaModelo,
  rotuloEstadoModelo,
  semCodigoDeEstado,
  semCodigosInternos,
  situacaoDoModelo,
  slugModelo,
  termosPrevisoes,
  textoReexecucao,
  textoTolerancia,
  vereditoFicha,
} from "@/lib/energia/previsoes";
import type { Ficha, PrevisoesDesempenhoGold } from "@/lib/energia/tipos-previsoes";

export const dynamic = "force-static";
export const dynamicParams = false;

const gold = () => lerGold<PrevisoesDesempenhoGold>(GOLD_PREVISOES);

export function generateStaticParams() {
  const g = gold();
  return integra(g) ? g.fichas.map((f) => ({ modelo: slugModelo(f.codigo) })) : [];
}

function metadadosDaPagina({ params }: { params: { modelo: string } }): Metadata {
  const g = gold();
  const f = integra(g) ? g.fichas.find((x) => slugModelo(x.codigo) === params.modelo) : undefined;
  if (!f) return {};
  const idioma = idiomaEnergia();
  return {
    title: tx(
      `Como o ${f.codigo} calcula a previsão do PLD: ficha do modelo ${f.nome}`,
      `How ${f.codigo} calculates the PLD forecast: sheet of the ${textoRegistroModelos(f.nome, idioma)} model`,
    ),
    description: tx(
      `Situação (${rotuloEstadoModelo(f.estado)}), entradas, fórmula, transformações, configuração, corte, hipóteses, aprovação, limitações e reexecução do modelo ${f.codigo} de previsão do PLD.`,
      `Status (${rotuloEstadoModelo(f.estado, idioma)}), inputs, formula, transformations, configuration, cutoff, hypotheses, approval, limitations and rerun of the ${f.codigo} spot price (PLD) forecast model.`,
    ),
    alternates: { canonical: rotaModelo(f.codigo) },
  };
}

export async function generateMetadata(props: { params: { modelo: string } }, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia(caminhoComParametros("/setor-eletrico/pld/modelos/[modelo]", props.params), metadadosDaPagina(props), anterior);
}

/** Texto fixo da gold de previsões ou do registro de modelos: a forma inglesa pela tabela exata; sem entrada, o texto sai em português marcado. */
function Gold({ texto, regiao = "previsoes-ficha" }: { texto: string | null | undefined; regiao?: string }) {
  if (!texto) return null;
  const en = traducaoPrevisoes(texto, idiomaEnergia());
  return en ? <>{en}</> : <TrechoPortugues regiao={regiao}>{texto}</TrechoPortugues>;
}

/** Valor de configuração em texto legível (lista, objeto por frequência ou número). */
/** Arquivos do código do modelo ("pipeline/.../variaveis.py (b0) e modelos_pld.py"): na página inglesa, a ligação em inglês e os arquivos como código. */
function codigoImplementacao(texto: string, idioma: Idioma): ReactNode {
  if (idioma !== "en") return texto;
  return marcadoMercado(texto.replace(/ e /g, " and ").replace(/\(sazonal\)/g, "(seasonal)"), idioma);
}

function textoConfig(v: unknown): string {
  const locale = idiomaEnergia() === "en" ? "en-US" : "pt-BR";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "number" ? x.toLocaleString(locale) : String(x))).join("; ");
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${textoConfig(x)}`).join("; ");
  if (typeof v === "number") return v.toLocaleString(locale);
  // valor de texto da configuração publicada: forma inglesa pela tabela exata (nomes de série como ear_pct ficam como estão)
  return traducaoExata(CONFIG_MODELOS_EN, String(v), idiomaEnergia()) ?? String(v);
}

export default function FichaModelo({ params }: { params: { modelo: string } }) {
  const idioma = idiomaEnergia();
  const g = gold();
  if (!integra(g)) notFound();
  const f: Ficha | undefined = g.fichas.find((x) => slugModelo(x.codigo) === params.modelo);
  if (!f) notFound();

  const versao = g.gerado_em.slice(0, 10);
  const fonte = tx("Observatório, registro de modelos de previsão do PLD", "Observatory, PLD forecast model registry");
  const fichas = fichasOrdenadas(g.fichas);
  const coef = linhasCoeficientes([f], idioma);
  const variaveis = (f.coeficientes_ultimo_ajuste?.variaveis ?? []).map((v) => ({ id: v.id, rotulo: textoRegistroModelos(v.rotulo, idioma) }));
  const reexec = f.aprovacao.referencia_experimental ? linhasReexecucao(g, idioma) : [];
  const nomeModelo = textoRegistroModelos(f.nome, idioma);
  const ancora = `ficha-${slugModelo(f.codigo)}`;
  const registro = lerGold<ModelosGold>("modelos.json");
  const resumoModelo = integra(registro) ? registro.modelos.find((x) => x.codigo === f.codigo) : undefined;
  const downloads = g.downloads.filter((d) => (coef.length ? /previsoes_ajustes_c2|previsoes_emissoes/ : /previsoes_emissoes/).test(d.url));
  const proveniencia = provenienciaParaLeitor(f.aprovacao.referencia_experimental && "proveniencia" in g.previsao_atual && g.previsao_atual.proveniencia ? g.previsao_atual.proveniencia : g.proveniencia);
  const impl = f.implementacao as { codigo?: string; versao?: string; mesma_definicao_da_pesquisa?: boolean; diferencas?: string[]; restricao_preco?: string } | null;
  const situacao = situacaoDoModelo(f, idioma);
  const resumo = resumoModelo?.resumo?.trim();
  const lead = resumo ? <Gold texto={resumo.split(/(?<=[.!?])\s+/)[0] ?? resumo} /> : tx(`${f.codigo} é o modelo ${f.nome}.`, `${f.codigo} is the ${nomeModelo} model.`);
  const ajuste = f.coeficientes_ultimo_ajuste?.segmentos[0]?.origem_ajuste ?? null;
  const limitacaoPrincipal = resumoModelo?.limitacao_principal ?? (f.limitacoes?.length ? paraLeitorPrevisoes(f.limitacoes[0]) : "");
  const tolerancia = f.reproducao?.reexecucao_do_arquivo?.tolerancia;
  const termos = termosPrevisoes(g.definicoes, idioma);
  const exemplo = exemploDoModelo(f, g, resumoModelo?.metodologia, idioma);

  const oQueMudou = (
    <>
      {ajuste
        ? tx(`Pesos reajustados em ${dataBR(ajuste)}. `, `Weights refitted on ${dataBR(ajuste)}. `)
        : tx("Sem pesos ajustados: o modelo não tem coeficientes. ", "No fitted weights: the model has no coefficients. ")}
      {tx(
        `${situacao.rotulo} no registro${f.aprovacao.promovido_em ? `, promovido em ${dataBR(f.aprovacao.promovido_em)}` : ", nunca promovido a produção"}.`,
        `${situacao.rotulo} in the registry${f.aprovacao.promovido_em ? `, promoted on ${dataBR(f.aprovacao.promovido_em)}` : ", never promoted to production"}.`,
      )}
    </>
  );
  const comoInterpretar = (
    <>
      {situacao.rotulo}: {minusculaInicial(situacao.definicao)}
      {f.formula && (
        <span data-nivel="analisar">
          {tx(" Fórmula no registro: ", " Formula in the registry: ")}
          {textoRegistroModelos(f.formula, idioma)}
        </span>
      )}
    </>
  );
  const naoConcluir = (
    <>
      {tx("A ficha não diz se o modelo acerta: o desempenho está no painel de desempenho.", "The sheet does not say whether the model is accurate: performance is in the performance panel.")}{" "}
      <Gold texto={limitacaoPrincipal} />
      {reexec.length
        ? tx(
            " A reexecução confere a conta do observatório e não é aprovação metodológica independente.",
            " The rerun checks the observatory's arithmetic and is not an independent methodological approval.",
          )
        : ""}
    </>
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:pld-modelos" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <PrevisoesFaixaFichas atual={slugModelo(f.codigo)} fichas={fichas} />
        <CabecalhoModulo
          siglas={f.codigo === "C2-H" ? ["PLD", "EAR", "ENA", "MLT"] : ["PLD"]}
          rotulo={tx(`Ficha do modelo · versão ${f.versao}`, `Model sheet · version ${f.versao}`)}
          titulo={tx(`Como o ${f.codigo} calcula a previsão do PLD?`, `How does ${f.codigo} calculate the spot price (PLD) forecast?`)}
          lead={lead}
          recorte={tx(
            `${f.nome} · versão ${f.versao} · registro de ${dataBR(versao)} · R$/MWh nominais`,
            `${nomeModelo} · version ${f.versao} · registry of ${dataBR(versao)} · nominal R$/MWh`,
          )}
          fonte={fonte}
          referencia={
            <>
              {tx(`Registro de modelos na execução de ${carimbo(g.gerado_em)}.`, `Model registry in the run of ${carimbo(g.gerado_em)}.`)}
              <span data-nivel="analisar">{tx(` Configuração sha256 ${g.dados.configuracao_sha256.slice(0, 12)}.`, ` Configuration sha256 ${g.dados.configuracao_sha256.slice(0, 12)}.`)}</span>
            </>
          }
          metricas={
            <PrevisoesResumoFicha
              itens={[
                { rotulo: tx("Situação", "Status"), valor: <SituacaoDoModelo situacao={situacao} comTexto idioma={idioma} /> },
                { rotulo: tx("Papel", "Role"), valor: papelCurto(f.papel, idioma) },
                { rotulo: tx("Número publicado", "Published number"), valor: emissaoDoModelo(f, g, idioma) },
                { rotulo: tx("Reexecução do arquivo", "Archive rerun"), valor: reexecucaoCurta(f, idioma) },
              ]}
            />
          }
        />
        <ModoProfundidade>
          <Bloco id="ficha">
            <PainelEvidencia
              id={ancora}
              pergunta={tx(`Situação, entradas, fórmula e limites do ${f.codigo}`, `Status, inputs, formula and limits of ${f.codigo}`)}
              subtitulo={tx(
                `${f.nome}, versão ${f.versao} · ${semCodigosInternos(f.papel ?? "sem papel registrado")}`,
                `${nomeModelo}, version ${f.versao} · ${f.papel ? textoRegistroModelos(semCodigosInternos(f.papel), idioma) : "no role recorded"}`,
              )}
              natureza="PREVISTO"
              porQueImporta={tx(
                "A ficha é a receita do número: sem ela, ninguém confere a previsão arquivada nem entende por que ela muda. Também diz o que o modelo não pode fazer.",
                "The sheet is the recipe for the number: without it, nobody can check the archived forecast or understand why it changes. It also says what the model cannot do.",
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={proveniencia}
            >
              <div className="space-y-6">
                <PrevisoesResposta id="p014" veredito={vereditoFicha(f, resumoModelo?.resumo, g, idioma)}>
                  {resumoModelo?.resumo ? (
                    <>
                      <Gold texto={resumoModelo.resumo} />{" "}
                    </>
                  ) : (
                    ""
                  )}
                  {respostaFicha(f, g, idioma)}
                </PrevisoesResposta>
                <PrevisoesRecorte
                  periodo={
                    ajuste
                      ? tx(`Versão ${f.versao}; último ajuste em ${dataBR(ajuste)}`, `Version ${f.versao}; latest fit on ${dataBR(ajuste)}`)
                      : tx(`Versão ${f.versao}`, `Version ${f.versao}`)
                  }
                  universo={tx(
                    "Sete horizontes (W1 a W4 e M1 a M3) e quatro submercados; um ajuste por horizonte e submercado nos candidatos",
                    "Seven horizons (W1 to W4 and M1 to M3) and four submarkets; one fit per horizon and submarket in the candidates",
                  )}
                  unidade={
                    coef.length
                      ? tx("Coeficientes na unidade de cada variável; previsões em R$/MWh", "Coefficients in the unit of each variable; forecasts in R$/MWh")
                      : tx("R$/MWh nominais", "nominal R$/MWh")
                  }
                />
                {exemplo && (
                  <p className="max-w-prose2 border-l-2 border-linha pl-4 text-sm leading-relaxed text-carvao" data-exemplo={f.codigo}>
                    {exemplo}
                  </p>
                )}
                {!f.implementado_no_repositorio && (
                  <div data-nivel="analisar">
                    <PrevisoesAviso tipo="alerta">
                      {tx("Sem implementação no observatório:", "No implementation in the observatory:")}{" "}
                      {f.motivo_sem_implementacao ? (
                        <Gold texto={minusculaInicial(paraLeitorPrevisoes(semCaminhosDeArquivo(f.motivo_sem_implementacao)))} />
                      ) : (
                        tx("motivo não registrado", "reason not recorded")
                      )}
                      {f.pesos_c1_motivo && f.pesos_c1_motivo !== f.motivo_sem_implementacao ? (
                        <>
                          {" "}
                          <Gold texto={paraLeitorPrevisoes(semCaminhosDeArquivo(f.pesos_c1_motivo))} />
                        </>
                      ) : (
                        ""
                      )}
                      <span>
                        {" "}
                        {tx("Texto do registro: Sem implementação no repositório:", "Registry text: No implementation in the repository:")}{" "}
                        <TrechoPortugues regiao="previsoes-ficha">{minusculaInicial(semCaminhosDeArquivo(f.motivo_sem_implementacao ?? "motivo não registrado"))}</TrechoPortugues>
                      </span>
                    </PrevisoesAviso>
                  </div>
                )}

                {reexec.length > 0 && (
                  <SecaoDoPainel id="reexecucao" titulo={tx("Números arquivados na rodada mais recente, com a prova de cada um", "Numbers archived in the latest run, with the evidence for each")}>
                    <PrevisoesReexecucao linhas={reexec} evidencias={g.evidencias} endereco={`${rotaModelo(f.codigo)}#${ancora}`} tolerancia={tolerancia} modelo={f.codigo} />
                  </SecaoDoPainel>
                )}

                {coef.length > 0 && (
                  <SecaoDoPainel
                    id="pesos"
                    titulo={tx("Pesos do último ajuste por segmento", "Weights of the latest fit by segment")}
                    lead={f.coeficientes_ultimo_ajuste?.leitura ? <Gold texto={f.coeficientes_ultimo_ajuste.leitura} /> : undefined}
                  >
                    <PrevisoesCoeficientes
                      modelo={f.codigo}
                      linhas={coef}
                      colunas={colunasCoeficientes([f], idioma)}
                      variaveis={variaveis}
                      variavelPadrao={variaveis.some((v) => v.id === VARIAVEL_D7) ? VARIAVEL_D7 : (variaveis[0]?.id ?? "")}
                      fonte={fonte}
                      versao={versao}
                    />
                    <PrevisoesLegenda>
                      {tx(
                        "A fórmula diz como o dado vira previsão e o corte diz o que estava disponível. No gráfico, escolha uma variável para ver o peso dela em cada segmento; a tabela tem todas as variáveis e os mesmos números.",
                        "The formula says how the data becomes a forecast and the cutoff says what was available. In the chart, choose a variable to see its weight in each segment; the table has all the variables and the same numbers.",
                      )}
                    </PrevisoesLegenda>
                  </SecaoDoPainel>
                )}

                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="receita" titulo={tx(`A receita do ${f.codigo}: entradas, fórmula, corte e limites`, `The recipe of ${f.codigo}: inputs, formula, cutoff and limits`)}>
                  <dl>
                    <PrevisoesFichaLinha rotulo={tx("Situação e aprovação", "Status and approval")}>
                      {textoRegistroModelos(semCodigosInternos(f.aprovacao.leitura.trim()), idioma)}{" "}
                      {f.aprovacao.promovido_em
                        ? tx(`Promovido em ${dataBR(f.aprovacao.promovido_em)}.`, `Promoted on ${dataBR(f.aprovacao.promovido_em)}.`)
                        : tx("Nunca promovido a produção.", "Never promoted to production.")}
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Revisão registrada", "Recorded review")}>
                      {resumoModelo?.auditoria ? <Gold texto={resumoModelo.auditoria} /> : tx("nenhuma revisão registrada", "no review recorded")}
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Número no arquivo", "Number in the archive")}>{emissaoDoModelo(f, g, idioma)}</PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Alvo", "Target")}>
                      <Gold texto={g.definicoes.alvo} />
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Entregas", "Deliveries")} nivel="analisar">
                      <Gold texto={g.definicoes.entregas} />
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Entradas", "Inputs")}>
                      {f.entradas ? (
                        <ul className="list-disc space-y-0.5 pl-5">
                          {f.entradas.map((x) => (
                            <li key={x}>{textoRegistroModelos(x, idioma)}</li>
                          ))}
                        </ul>
                      ) : (
                        tx("não publicadas", "not published")
                      )}
                      {notaEntradas(f, idioma) ? <p className="mt-1 text-xs text-carvao-muted">{notaEntradas(f, idioma)}</p> : null}
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Fórmula", "Formula")}>
                      {(() => {
                        const fp = formulaEmPalavras(f, idioma);
                        return fp ? textoRegistroModelos(fp, idioma) : tx("não publicada", "not published");
                      })()}
                    </PrevisoesFichaLinha>
                    {f.formula && formulaEmPalavras(f, "pt") !== f.formula && (
                      <PrevisoesFichaLinha rotulo={tx("Fórmula no registro", "Formula in the registry")} nivel="analisar">
                        <code className="block whitespace-pre-wrap break-words bg-papel px-2 py-1.5 font-mono text-xs">{textoRegistroModelos(f.formula, idioma)}</code>
                      </PrevisoesFichaLinha>
                    )}
                    <PrevisoesFichaLinha rotulo={tx("Transformações", "Transformations")} nivel="analisar">
                      {f.transformacoes ? (
                        <ol className="list-decimal space-y-0.5 pl-5">
                          {f.transformacoes.map((x) => (
                            <li key={x}>
                              <Gold texto={x} />
                            </li>
                          ))}
                        </ol>
                      ) : (
                        tx("não publicadas", "not published")
                      )}
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Corte", "Cutoff")}>
                      <Gold texto={semCodigosInternos(f.corte)} />
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Hipóteses", "Hypotheses")}>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {f.hipoteses.map((x) => (
                          <li key={x}>
                            <Gold texto={semCodigosInternos(x)} />
                          </li>
                        ))}
                      </ul>
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Faixa de incerteza", "Uncertainty band")}>
                      <Gold texto={semCodigoDeEstado(g.governanca.referencia_experimental.faixas)} />
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Principal limitação", "Main limitation")}>
                      {resumoModelo?.limitacao_principal ? (
                        <Gold texto={resumoModelo.limitacao_principal} />
                      ) : f.limitacoes?.length ? (
                        <Gold texto={paraLeitorPrevisoes(f.limitacoes[0])} />
                      ) : (
                        tx("nenhuma registrada", "none recorded")
                      )}
                      {f.limitacoes && f.limitacoes.length > 1
                        ? tx(
                            ` Há mais ${f.limitacoes.length - 1 === 1 ? "uma limitação registrada" : `${f.limitacoes.length - 1} limitações registradas`}, em Analisar.`,
                            ` There ${f.limitacoes.length - 1 === 1 ? "is one more recorded limitation" : `are ${f.limitacoes.length - 1} more recorded limitations`}, in Analyze.`,
                          )
                        : ""}
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Limitações registradas", "Recorded limitations")} nivel="analisar">
                      {f.limitacoes?.length ? (
                        <ul className="list-disc space-y-0.5 pl-5">
                          {f.limitacoes.map((x) => (
                            <li key={x}>
                              <Gold texto={x} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        tx("nenhuma registrada", "none recorded")
                      )}
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Falhas conhecidas", "Known failures")}>
                      {f.falhas_conhecidas?.length ? (
                        <ul className="list-disc space-y-0.5 pl-5">
                          {f.falhas_conhecidas.map((x) => (
                            <li key={x}>
                              <Gold texto={motivoGravado(semCodigosInternos(x))} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        tx("nenhuma registrada", "none recorded")
                      )}
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={tx("Reexecução", "Rerun")}>{textoReexecucao(f, idioma)}</PrevisoesFichaLinha>
                  </dl>
                  <PrevisoesTermos itens={termos} />
                </SecaoDoPainel>

                <PrevisoesAuditoria id="implementacao" titulo={tx("Implementação, configuração e reprodução", "Implementation, configuration and reproduction")}>
                  <dl>
                    <PrevisoesFichaLinha rotulo={tx("Hipóteses e falhas, como no registro", "Hypotheses and failures, as in the registry")}>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {[...f.hipoteses, ...(f.falhas_conhecidas ?? [])].map((x) => (
                          <li key={x}>
                            <TrechoPortugues regiao="previsoes-ficha">{x}</TrechoPortugues>
                          </li>
                        ))}
                      </ul>
                    </PrevisoesFichaLinha>
                    {impl && (
                      <PrevisoesFichaLinha rotulo={tx("Código", "Code")}>
                        {impl.codigo ? codigoImplementacao(impl.codigo, idioma) : tx("não informado", "not reported")}
                        {impl.mesma_definicao_da_pesquisa === false
                          ? tx("; reimplementação do observatório, não a definição exata da pesquisa", "; reimplementation by the observatory, not the exact research definition")
                          : ""}
                        {impl.restricao_preco ? (
                          <>
                            ; <TrechoPortugues regiao="previsoes-ficha">{impl.restricao_preco}</TrechoPortugues>
                          </>
                        ) : (
                          ""
                        )}
                      </PrevisoesFichaLinha>
                    )}
                    {impl?.diferencas?.length ? (
                      <PrevisoesFichaLinha rotulo={tx("Diferenças da pesquisa", "Differences from the research")}>
                        <ul className="list-disc space-y-0.5 pl-5">
                          {impl.diferencas.map((x) => (
                            <li key={x}>
                              <TrechoPortugues regiao="previsoes-ficha">{x}</TrechoPortugues>
                            </li>
                          ))}
                        </ul>
                      </PrevisoesFichaLinha>
                    ) : null}
                    {f.configuracao ? (
                      <PrevisoesFichaLinha rotulo={tx("Configuração", "Configuration")}>
                        <span className="block">
                          sha256 <code className="font-mono text-xs">{f.configuracao.sha256}</code>
                        </span>
                        <ul className="mt-1 space-y-0.5 text-xs text-carvao-muted">
                          {Object.entries(f.configuracao)
                            .filter(([k]) => k !== "sha256")
                            .map(([k, x]) => (
                              <li key={k}>
                                <code className="font-mono">{k}</code>: {textoConfig(x)}
                              </li>
                            ))}
                        </ul>
                      </PrevisoesFichaLinha>
                    ) : (
                      <PrevisoesFichaLinha rotulo={tx("Configuração", "Configuration")}>{tx("não publicada", "not published")}</PrevisoesFichaLinha>
                    )}
                    {f.reproducao && (
                      <PrevisoesFichaLinha rotulo={tx("Reprodução", "Reproduction")}>
                        <code className="block whitespace-pre-wrap break-words font-mono text-xs">{f.reproducao.comando}</code>
                        <code className="mt-1 block whitespace-pre-wrap break-words font-mono text-xs">{f.reproducao.teste}</code>
                        <span className="mt-1 block">
                          {tx("Tolerância:", "Tolerance:")} {textoTolerancia(f.reproducao.tolerancia, idioma)}
                        </span>
                      </PrevisoesFichaLinha>
                    )}
                  </dl>
                </PrevisoesAuditoria>

                <PrevisoesSeguir ancora={ancora} proximo={{ href: enderecoPainel("p016"), pergunta: perguntaPainel("p016", idioma) }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
