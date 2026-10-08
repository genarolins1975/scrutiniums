import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { EstadoModelo } from "@/components/energia/EstadoModelo";
import { PrevisoesCoeficientes } from "@/components/energia/PrevisoesCoeficientes";
import {
  PrevisoesAuditoria,
  PrevisoesAviso,
  PrevisoesFichaLinha,
  PrevisoesLeitura,
  PrevisoesRecorte,
  PrevisoesResposta,
  PrevisoesSeguir,
  PrevisoesTermos,
} from "@/components/energia/PrevisoesPagina";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { semCaminhosDeArquivo } from "@/lib/energia/bastidor";
import type { ModelosGold } from "@/lib/energia/tipos";
import {
  GOLD_PREVISOES,
  ROTA_MODELOS,
  VARIAVEL_D7,
  colunasCoeficientes,
  emissaoDoModelo,
  enderecoPainel,
  exemploDoModelo,
  formulaEmPalavras,
  linhasCoeficientes,
  linhasReexecucao,
  minusculaInicial,
  notaEntradas,
  paraLeitorPrevisoes,
  perguntaPainel,
  respostaFicha,
  rotaModelo,
  rotuloEstadoModelo,
  semCodigosInternos,
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

export function generateMetadata({ params }: { params: { modelo: string } }): Metadata {
  const g = gold();
  const f = integra(g) ? g.fichas.find((x) => slugModelo(x.codigo) === params.modelo) : undefined;
  if (!f) return {};
  return {
    title: `Ficha do modelo ${f.codigo}: ${f.nome}`,
    description: `Estado (${rotuloEstadoModelo(f.estado)}), entradas, fórmula, transformações, configuração, corte, hipóteses, aprovação, limitações e reexecução do modelo ${f.codigo} de previsão do PLD.`,
    alternates: { canonical: rotaModelo(f.codigo) },
  };
}

const ROTULO_RESULTADO: Record<string, string> = { aprovado: "aprovado", ressalva: "com ressalva", reprovado: "reprovado" };

/** Valor de configuração em texto legível (lista, objeto por frequência ou número). */
function textoConfig(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "number" ? x.toLocaleString("pt-BR") : String(x))).join("; ");
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${textoConfig(x)}`).join("; ");
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  return String(v);
}

export default function FichaModelo({ params }: { params: { modelo: string } }) {
  const g = gold();
  if (!integra(g)) notFound();
  const f: Ficha | undefined = g.fichas.find((x) => slugModelo(x.codigo) === params.modelo);
  if (!f) notFound();

  const versao = g.gerado_em.slice(0, 10);
  const fonte = "Observatório, registro de modelos de previsão do PLD";
  const coef = linhasCoeficientes([f]);
  const variaveis = f.coeficientes_ultimo_ajuste?.variaveis ?? [];
  const reexec = f.aprovacao.referencia_experimental ? linhasReexecucao(g) : [];
  const ehB0 = f.aprovacao.referencia_experimental;
  const ancora = `ficha-${slugModelo(f.codigo)}`;
  const registro = lerGold<ModelosGold>("modelos.json");
  const resumoModelo = integra(registro) ? registro.modelos.find((x) => x.codigo === f.codigo) : undefined;
  const downloads = g.downloads.filter((d) => (coef.length ? /previsoes_ajustes_c2|previsoes_emissoes/ : /previsoes_emissoes/).test(d.url));
  const proveniencia = ehB0 && "proveniencia" in g.previsao_atual && g.previsao_atual.proveniencia ? g.previsao_atual.proveniencia : g.proveniencia;
  const impl = f.implementacao as { codigo?: string; versao?: string; mesma_definicao_da_pesquisa?: boolean; diferencas?: string[]; restricao_preco?: string } | null;

  return (
    <>
      <CabecalhoEnergia atual="pld-modelos" />
      <MarcaVisita secao="energia:pld-modelos" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-4 pb-16 sm:px-6">
        <nav aria-label="Trilha" className="pt-6 text-sm text-mineral">
          <Link href="/setor-eletrico/pld" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            PLD
          </Link>{" "}
          ·{" "}
          <Link href={ROTA_MODELOS} className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            Registro de modelos
          </Link>{" "}
          · {f.codigo}
        </nav>
        <CabecalhoModulo
          siglas={f.codigo === "C2-H" ? ["PLD", "EAR", "ENA", "MLT"] : ["PLD"]}
          rotulo={`Ficha do modelo · versão ${f.versao}`}
          titulo={`${f.codigo} · ${f.nome}`}
          referencia={<>Registro de modelos na execução de {carimbo(g.gerado_em)}.<span data-nivel="analisar"> Configuração sha256 {g.dados.configuracao_sha256.slice(0, 12)}.</span></>}
        >
          <span className="inline-flex flex-wrap items-center gap-2">
            <EstadoModelo estado={f.estado} comTexto />
          </span>{" "}
          {semCodigosInternos(f.aprovacao.leitura.trim())}
        </CabecalhoModulo>
        <PrevisoesTermos itens={termosPrevisoes(g.definicoes)} />
        <ModoProfundidade>
          <Bloco id="ficha">
            <PainelEvidencia
              id={ancora}
              pergunta={`Como o ${f.codigo} calcula a previsão do PLD?`}
              subtitulo={`${f.nome}, versão ${f.versao} · ${semCodigosInternos(f.papel ?? "sem papel registrado")}`}
              natureza="PREVISTO"
              porQueImporta={
                <>
                  A ficha é a receita do número: sem ela, ninguém confere a previsão arquivada nem entende por que ela muda. Também diz o que o modelo não pode fazer.
                </>
              }
              oQueMudou={
                <>
                  {f.coeficientes_ultimo_ajuste?.segmentos[0]
                    ? `Pesos reajustados em ${dataBR(f.coeficientes_ultimo_ajuste.segmentos[0].origem_ajuste)}. `
                    : "Sem pesos ajustados: o modelo não tem coeficientes. "}
                  Estado {rotuloEstadoModelo(f.aprovacao.estado)}
                  {f.aprovacao.promovido_em ? `, promovido em ${dataBR(f.aprovacao.promovido_em)}` : ", nunca promovido"}.
                </>
              }
              comoInterpretar={
                <>
                  Estado {rotuloEstadoModelo(f.estado)} quer dizer que o modelo não alimenta a previsão principal.
                  {f.formula && <span data-nivel="analisar"> Fórmula no registro: {f.formula}</span>}
                </>
              }
              naoConcluir={
                <>
                  A ficha não diz se o modelo acerta: o desempenho está no painel de desempenho. {resumoModelo?.limitacao_principal ?? paraLeitorPrevisoes(f.limitacoes?.[0] ?? "")}
                </>
              }
              proveniencia={proveniencia}
            >
              <div className="space-y-6">
                <PrevisoesResposta id="p014" veredito={vereditoFicha(f, resumoModelo?.resumo, g)}>
                  {resumoModelo?.resumo ? `${resumoModelo.resumo} ` : ""}
                  {respostaFicha(f, g)}
                </PrevisoesResposta>
                <PrevisoesRecorte
                  periodo={
                    f.coeficientes_ultimo_ajuste?.segmentos[0]
                      ? `Versão ${f.versao}; último ajuste em ${dataBR(f.coeficientes_ultimo_ajuste.segmentos[0].origem_ajuste)}`
                      : `Versão ${f.versao}`
                  }
                  universo="Sete horizontes (W1 a W4 e M1 a M3) e quatro submercados; um ajuste por horizonte e submercado nos candidatos"
                  unidade={coef.length ? "Coeficientes na unidade de cada variável; previsões em R$/MWh" : "R$/MWh nominais"}
                />
                {exemploDoModelo(f, g, resumoModelo?.metodologia) && (
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-exemplo={f.codigo}>
                    {exemploDoModelo(f, g, resumoModelo?.metodologia)}
                  </p>
                )}
                {!f.implementado_no_repositorio && (
                  <div data-nivel="analisar">
                    <PrevisoesAviso tipo="alerta">
                      Sem implementação no observatório: {minusculaInicial(paraLeitorPrevisoes(semCaminhosDeArquivo(f.motivo_sem_implementacao ?? "motivo não registrado")))}
                      {f.pesos_c1_motivo && f.pesos_c1_motivo !== f.motivo_sem_implementacao ? ` ${paraLeitorPrevisoes(semCaminhosDeArquivo(f.pesos_c1_motivo))}` : ""}
                      <span>
                        {" "}
                        Texto do registro: Sem implementação no repositório: {minusculaInicial(semCaminhosDeArquivo(f.motivo_sem_implementacao ?? "motivo não registrado"))}
                      </span>
                    </PrevisoesAviso>
                  </div>
                )}

                {reexec.length > 0 && (
                  <section aria-labelledby="ficha-reexec" className="space-y-2" data-reexecucao="">
                    <h3 id="ficha-reexec" className="font-serif text-lg text-carvao">
                      Números arquivados na rodada mais recente, com a prova de cada um
                    </h3>
                    <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Números arquivados e reexecução (rolável)">
                      <table className="w-full min-w-[36rem] border-collapse text-sm">
                        <caption className="sr-only">Números arquivados do {f.codigo} e resultado da reexecução</caption>
                        <thead>
                          <tr className="text-left text-xs text-mineral">
                            {["Submercado", "Frequência", "Valor arquivado", "Reexecução", "Detalhe"].map((c) => (
                              <th key={c} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reexec.map((r) => (
                            <tr key={r.id}>
                              <th scope="row" className="border-b border-linha px-2 py-1 text-left font-normal text-carvao">
                                {r.sm}
                              </th>
                              <td className="border-b border-linha px-2 py-1">{r.frequencia}</td>
                              <td className="border-b border-linha px-2 py-1 tabular-nums">
                                {g.evidencias[r.id] ? <ComproveNumero variante="valor" evidencia={g.evidencias[r.id]} endereco={`${rotaModelo(f.codigo)}#${ancora}`} /> : "sem prova"}
                              </td>
                              <td className="border-b border-linha px-2 py-1">{ROTULO_RESULTADO[r.resultado] ?? r.resultado}</td>
                              <td className="border-b border-linha px-2 py-1 text-xs text-carvao-muted">{r.detalhe.replace(/\b(\d+)\.(\d+)\b/g, "$1,$2")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {coef.length > 0 && (
                  <section aria-labelledby="ficha-coef" className="space-y-2">
                    <h3 id="ficha-coef" className="font-serif text-lg text-carvao">
                      Pesos do último ajuste por segmento
                    </h3>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{f.coeficientes_ultimo_ajuste?.leitura}</p>
                    <PrevisoesCoeficientes
                      modelo={f.codigo}
                      linhas={coef}
                      colunas={colunasCoeficientes([f])}
                      variaveis={variaveis}
                      variavelPadrao={variaveis.some((v) => v.id === VARIAVEL_D7) ? VARIAVEL_D7 : (variaveis[0]?.id ?? "")}
                      fonte={fonte}
                      versao={versao}
                    />
                  </section>
                )}

                <dl>
                  <PrevisoesFichaLinha rotulo="Estado e aprovação">
                    {rotuloEstadoModelo(f.estado)}; {semCodigosInternos(f.aprovacao.leitura.trim())} {f.aprovacao.promovido_em ? `Promovido em ${dataBR(f.aprovacao.promovido_em)}.` : "Nunca promovido."}
                  </PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Número no arquivo">{emissaoDoModelo(f, g)}</PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Alvo">{g.definicoes.alvo}</PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Entregas">{g.definicoes.entregas}</PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Entradas">
                    {f.entradas ? (
                      <ul className="list-disc space-y-0.5 pl-5">
                        {f.entradas.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      "não publicadas"
                    )}
                    {notaEntradas(f) ? <p className="mt-1 text-xs text-carvao-muted">{notaEntradas(f)}</p> : null}
                  </PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Fórmula">{formulaEmPalavras(f) ?? "não publicada"}</PrevisoesFichaLinha>
                  {f.formula && formulaEmPalavras(f) !== f.formula && (
                    <PrevisoesFichaLinha rotulo="Fórmula no registro" nivel="analisar">
                      <code className="block whitespace-pre-wrap break-words bg-papel px-2 py-1.5 font-mono text-xs">{f.formula}</code>
                    </PrevisoesFichaLinha>
                  )}
                  <PrevisoesFichaLinha rotulo="Transformações" nivel="analisar">
                    {f.transformacoes ? (
                      <ol className="list-decimal space-y-0.5 pl-5">
                        {f.transformacoes.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ol>
                    ) : (
                      "não publicadas"
                    )}
                  </PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Corte">{semCodigosInternos(f.corte)}</PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Hipóteses">
                    <ul className="list-disc space-y-0.5 pl-5">
                      {f.hipoteses.map((x) => (
                        <li key={x}>{semCodigosInternos(x)}</li>
                      ))}
                    </ul>
                  </PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Faixa de incerteza">{g.governanca.referencia_experimental.faixas.replace(/\bCALIBRADO\b/g, "calibrado")}</PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Principal limitação">
                    {resumoModelo?.limitacao_principal ?? (f.limitacoes?.length ? paraLeitorPrevisoes(f.limitacoes[0]) : "nenhuma registrada")}
                    {f.limitacoes && f.limitacoes.length > 1 ? ` Há mais ${f.limitacoes.length - 1 === 1 ? "uma limitação registrada" : `${f.limitacoes.length - 1} limitações registradas`}, em Analisar.` : ""}
                  </PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Limitações registradas" nivel="analisar">
                    {f.limitacoes?.length ? (
                      <ul className="list-disc space-y-0.5 pl-5">
                        {f.limitacoes.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      "nenhuma registrada"
                    )}
                  </PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Falhas conhecidas">
                    {f.falhas_conhecidas?.length ? (
                      <ul className="list-disc space-y-0.5 pl-5">
                        {f.falhas_conhecidas.map((x) => (
                          <li key={x}>{semCodigosInternos(x)}</li>
                        ))}
                      </ul>
                    ) : (
                      "nenhuma registrada"
                    )}
                  </PrevisoesFichaLinha>
                  <PrevisoesFichaLinha rotulo="Reexecução">{textoReexecucao(f)}</PrevisoesFichaLinha>
                </dl>

                <PrevisoesLeitura
                  comoLer={
                    <>
                      A fórmula diz como o dado vira previsão e o corte diz o que estava disponível; as transformações, em ordem, estão em Analisar. {coef.length ? "No gráfico, escolha uma variável para ver o peso dela em cada segmento; a tabela tem todas as variáveis e os mesmos números." : ""}
                    </>
                  }
                  naoPermite={
                    <>
                      Não permite dizer se o {f.codigo} supera as referências: isso depende do teste fora da amostra e do acompanhamento prospectivo, no painel de desempenho.
                    </>
                  }
                />

                <PrevisoesAuditoria id="implementacao" titulo="Implementação, configuração e reprodução">
                  <dl>
                    <PrevisoesFichaLinha rotulo="Hipóteses e falhas, como no registro">
                      <ul className="list-disc space-y-0.5 pl-5">
                        {[...f.hipoteses, ...(f.falhas_conhecidas ?? [])].map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </PrevisoesFichaLinha>
                    {impl && (
                      <PrevisoesFichaLinha rotulo="Código">
                        {impl.codigo ?? "não informado"}
                        {impl.mesma_definicao_da_pesquisa === false ? "; reimplementação do observatório, não a definição exata da pesquisa" : ""}
                        {impl.restricao_preco ? `; ${impl.restricao_preco}` : ""}
                      </PrevisoesFichaLinha>
                    )}
                    {impl?.diferencas?.length ? (
                      <PrevisoesFichaLinha rotulo="Diferenças da pesquisa">
                        <ul className="list-disc space-y-0.5 pl-5">
                          {impl.diferencas.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </PrevisoesFichaLinha>
                    ) : null}
                    {f.configuracao ? (
                      <PrevisoesFichaLinha rotulo="Configuração">
                        <span className="block">
                          sha256 <span className="font-mono text-xs">{f.configuracao.sha256}</span>
                        </span>
                        <ul className="mt-1 space-y-0.5 text-xs text-carvao-muted">
                          {Object.entries(f.configuracao)
                            .filter(([k]) => k !== "sha256")
                            .map(([k, x]) => (
                              <li key={k}>
                                <span className="font-mono">{k}</span>: {textoConfig(x)}
                              </li>
                            ))}
                        </ul>
                      </PrevisoesFichaLinha>
                    ) : (
                      <PrevisoesFichaLinha rotulo="Configuração">não publicada</PrevisoesFichaLinha>
                    )}
                    {f.reproducao && (
                      <PrevisoesFichaLinha rotulo="Reprodução">
                        <code className="block whitespace-pre-wrap break-words font-mono text-xs">{f.reproducao.comando}</code>
                        <code className="mt-1 block whitespace-pre-wrap break-words font-mono text-xs">{f.reproducao.teste}</code>
                        <span className="mt-1 block">Tolerância: {textoTolerancia(f.reproducao.tolerancia)}</span>
                      </PrevisoesFichaLinha>
                    )}
                  </dl>
                </PrevisoesAuditoria>

                <PrevisoesSeguir ancora={ancora} proximo={{ href: enderecoPainel("p016"), pergunta: perguntaPainel("p016") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
        <p className="mt-8 text-sm">
          <Link href={`${ROTA_MODELOS}#p014`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Voltar às fichas lado a lado
          </Link>
        </p>
      </main>
    </>
  );
}
