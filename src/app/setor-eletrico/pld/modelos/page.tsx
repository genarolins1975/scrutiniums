import { semCaminhosDeArquivo } from "@/lib/energia/bastidor";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { PrevisoesModelos, type CartaoModelo } from "@/components/energia/PrevisoesModelos";
import {
  PrevisoesAnalise,
  PrevisoesAuditoria,
  PrevisoesAviso,
  PrevisoesFichaLinha,
  PrevisoesIndisponivel,
  PrevisoesLeitura,
  PrevisoesNavegacao,
  PrevisoesRecorte,
  PrevisoesResposta,
  PrevisoesSeguir,
} from "@/components/energia/PrevisoesPagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, plural } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_AMOSTRA,
  COLUNAS_DECISOES,
  COLUNAS_DESEMPENHO,
  COLUNAS_PROSPECTIVO,
  COLUNAS_VALIDACOES,
  GOLD_PREVISOES,
  ROTA_MODELOS,
  coeficientesDoSegmento,
  colunasCoeficientes,
  d7AcimaDe1,
  downloadsDoPainel,
  emissaoDoModelo,
  enderecoPainel,
  fichasOrdenadas,
  linhasAmostra,
  linhasCoeficientes,
  linhasDesempenho,
  linhasModelos,
  linhasProspectivo,
  linhasReexecucao,
  minimoCalibracao,
  perguntaPainel,
  proximoPainel,
  respostaP014,
  respostaP016,
  rotaModelo,
  rotuloEstadoModelo,
  segmentosCoeficientes,
  slugModelo,
  textoCoeficientes,
  textoReexecucao,
} from "@/lib/energia/previsoes";
import type { PrevisoesDesempenhoGold } from "@/lib/energia/tipos-previsoes";
import { snapshotLegivel } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Modelos de previsão do PLD: fichas, pesos e desempenho",
  description:
    "Registro dos modelos de previsão do PLD (B0, S0, C1, C2-P e C2-H) com estado, entradas, fórmula, pesos do último ajuste, reexecução das previsões arquivadas e a situação do teste de desempenho e da calibração das faixas.",
  alternates: { canonical: ROTA_MODELOS },
};

const ROTULO_RESULTADO: Record<string, string> = { aprovado: "aprovado", ressalva: "com ressalva", reprovado: "reprovado" };

export default function ModelosPage() {
  const g = lerGold<PrevisoesDesempenhoGold>(GOLD_PREVISOES);
  if (!integra(g)) return <PrevisoesIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const fichas = fichasOrdenadas(g.fichas);
  const cartoes: CartaoModelo[] = fichas.map((f) => ({
    id: slugModelo(f.codigo),
    codigo: f.codigo,
    nome: f.nome,
    versao: f.versao,
    estado: f.estado,
    papel: f.papel ?? "sem papel registrado",
    emite: emissaoDoModelo(f, g),
    entradas: f.entradas,
    formula: f.formula,
    reexecucao: textoReexecucao(f),
    limitacao: f.limitacoes?.[0] ?? (f.motivo_sem_implementacao ? semCaminhosDeArquivo(f.motivo_sem_implementacao) : f.motivo_sem_implementacao),
    href: rotaModelo(f.codigo),
  }));
  const coef = linhasCoeficientes(fichas);
  const segmentos = segmentosCoeficientes(fichas);
  const barras = Object.fromEntries(segmentos.map((s) => [s.id, coeficientesDoSegmento(fichas, s.id)]));
  const textos = Object.fromEntries(segmentos.map((s) => [s.id, textoCoeficientes(fichas, s.id)]));
  const acima = d7AcimaDe1(fichas);
  const ajuste = coef[0]?.origem_ajuste ?? null;
  const reexec = linhasReexecucao(g);
  const amostra = linhasAmostra(g);
  const prospectivo = linhasProspectivo(g);
  const minimo = minimoCalibracao(g.definicoes.calibracao);
  const versao = g.gerado_em.slice(0, 10);
  const fonte = "Observatório, registro de modelos de previsão do PLD";
  const pubDes = g.publicacao_desempenho;
  const decisoes = g.governanca.decisao_revisavel.map((d, i) => ({
    id: `d${i}`,
    item: d.item,
    estado: d.estado ?? "sem estado",
    responsavel: d.responsavel ?? "não indicado",
    evidencia: d.evidencia ?? "sem evidência registrada",
  }));
  const validacoes = g.validacoes.map((v, i) => ({ id: `v${i}`, nome: v.nome, resultado: ROTULO_RESULTADO[v.resultado] ?? v.resultado, detalhe: v.detalhe }));
  const avaliados = g.modelos.filter((m) => m.avaliado).map((m) => m.codigo);
  const naoAvaliados = g.modelos.filter((m) => !m.avaliado);
  const desempenho = g.desempenho.publicado ? linhasDesempenho(g.desempenho.por_horizonte) : [];

  return (
    <>
      <CabecalhoEnergia atual="pld-modelos" />
      <MarcaVisita secao="energia:pld-modelos" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-4 pb-16 sm:px-6">
        <nav aria-label="Trilha" className="pt-6 text-sm text-mineral">
          <Link href="/setor-eletrico/pld" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            PLD
          </Link>{" "}
          · Previsões e modelos · Registro de modelos e desempenho
        </nav>
        <CabecalhoModulo
          rotulo="Previsões e modelos do PLD"
          titulo="Como cada previsão é calculada, e se ela supera as referências simples"
          referencia={
            <>
              {plural(fichas.length, "modelo registrado", "modelos registrados")}; teste retrospectivo com {g.dados.origens.n.toLocaleString("pt-BR")} origens; processado em{" "}
              {carimbo(g.gerado_em)}.<span data-nivel="analisar"> Configuração sha256 {g.dados.configuracao_sha256.slice(0, 12)}.</span>
            </>
          }
        >
          Cada modelo tem uma ficha com entradas, fórmula, pesos, corte, hipóteses, aprovação e limitações, e cada previsão arquivada pode ser refeita. O segundo painel
          diz o que já se pode afirmar sobre o desempenho: o teste fora da amostra, o acompanhamento depois de cada rodada e a calibração das faixas.
        </CabecalhoModulo>
        <PrevisoesNavegacao pagina="modelos" />
        <ModoProfundidade>
          <Bloco id="registro">
            <PainelEvidencia
              id="p014"
              pergunta={perguntaPainel("p014")}
              subtitulo="Fichas dos modelos, pesos do último ajuste e reexecução do arquivo · coeficientes na unidade de cada variável"
              natureza="PREVISTO"
              porQueImporta={
                <>
                  Um número de previsão sem a receita não pode ser conferido nem comparado. A ficha diz que informação entra, como é transformada, o que estava disponível no
                  corte e quem aprovou o uso; a reexecução mostra que o número arquivado sai de novo do mesmo dado.
                </>
              }
              oQueMudou={
                <>
                  {ajuste ? `Último ajuste dos candidatos C2 em ${dataBR(ajuste)} (os pesos mudam a cada domingo). ` : ""}
                  Configuração registrada {g.dados.configuracao_registrada_sha256 === g.dados.configuracao_sha256 ? "igual" : "diferente"} à usada nesta execução.
                </>
              }
              comoInterpretar={
                <>
                  B0 e S0 são referências simples: repetir o último período ou o mesmo período do ano anterior. Os candidatos C2 partem do B0 e somam correções pesadas pelos
                  coeficientes; coeficiente zero não corrige, acima de 1 na média dos 7 dias amplia o desvio recente. Estado em pesquisa quer dizer que o modelo não alimenta
                  a previsão principal.
                </>
              }
              naoConcluir={
                <>
                  Coeficiente grande não quer dizer que a variável cause o preço, nem que o modelo erre menos. A ficha não diz qual modelo é melhor: isso é o painel de
                  desempenho.{" "}
                  {fichas
                    .filter((f) => !f.implementado_no_repositorio)
                    .map((f) => `Os pesos do ${f.codigo} não são publicáveis e não foram reconstruídos.`)
                    .join(" ")}
                </>
              }
              proveniencia={g.proveniencia}
            >
              <div className="space-y-6">
                <PrevisoesResposta id="p014">{respostaP014(g)}</PrevisoesResposta>
                <PrevisoesRecorte
                  periodo={<>Versões vigentes na execução de {carimbo(g.gerado_em)}{ajuste ? `; pesos do ajuste de ${dataBR(ajuste)}` : ""}</>}
                  universo={<>{fichas.map((f) => f.codigo).join(", ")}; sete horizontes e quatro submercados</>}
                  unidade="R$/MWh nas previsões; coeficientes em R$/MWh de correção por R$/MWh (ou por ponto percentual) da variável"
                />

                {reexec.length > 0 && (
                  <section aria-labelledby="reexec-titulo" className="space-y-2" data-reexecucao="">
                    <h3 id="reexec-titulo" className="font-serif text-lg text-carvao">
                      O que mudaria nas previsões arquivadas do B0 se fossem refeitas com o dado do corte?
                    </h3>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                      Cada valor abaixo é o número arquivado na rodada mais recente; a prova de cada um mostra as horas somadas, os arquivos da CCEE capturados até o corte
                      com sha256 e o resultado da reexecução.
                    </p>
                    <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Previsões arquivadas refeitas (rolável)">
                      <table className="w-full min-w-[36rem] border-collapse text-sm">
                        <caption className="sr-only">Previsões arquivadas do B0 e resultado da reexecução</caption>
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
                            <tr key={r.id} data-reexec={r.id}>
                              <th scope="row" className="border-b border-linha px-2 py-1 text-left font-normal text-carvao">
                                {r.sm}
                              </th>
                              <td className="border-b border-linha px-2 py-1 text-carvao">{r.frequencia}</td>
                              <td className="border-b border-linha px-2 py-1 tabular-nums">
                                {g.evidencias[r.id] ? <ComproveNumero variante="valor" evidencia={g.evidencias[r.id]} endereco={enderecoPainel("p014")} /> : "sem prova"}
                              </td>
                              <td className="border-b border-linha px-2 py-1 text-carvao">{ROTULO_RESULTADO[r.resultado] ?? r.resultado}</td>
                              <td className="border-b border-linha px-2 py-1 text-xs text-carvao-muted">{r.detalhe}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                <PrevisoesModelos
                  cartoes={cartoes}
                  linhasModelos={linhasModelos(g)}
                  coeficientes={coef}
                  colunasCoeficientes={colunasCoeficientes(fichas)}
                  segmentos={segmentos}
                  barras={barras}
                  textos={textos}
                  segmentoPadrao={segmentos[0]?.id ?? ""}
                  fonte={fonte}
                  versao={versao}
                />

                <PrevisoesLeitura
                  comoLer={
                    <>
                      Escolha até quatro fichas para ver lado a lado; a tabela abaixo delas tem as mesmas informações das cinco. No modo Analisar, escolha um segmento para ver
                      os pesos de cada variável nos dois candidatos: barra à direita do zero soma ao B0 quando a variável é positiva, à esquerda subtrai. A linha 1 marca o
                      ponto a partir do qual a correção pela média dos 7 dias amplia o desvio.
                    </>
                  }
                  naoPermite={
                    <>
                      Não permite dizer qual modelo acerta mais, nem que um peso seja estável: os coeficientes são do último ajuste e mudam a cada domingo.{" "}
                      {acima.length
                        ? `No último ajuste, ${plural(acima.length, "segmento passa", "segmentos passam")} de 1 na média dos 7 dias (${acima.map((a) => `${a.modelo} ${a.segmento}`).join(", ")}), um sinal de que a correção amplia o desvio recente em vez de reduzi-lo.`
                        : "No último ajuste, nenhum segmento passa de 1 na média dos 7 dias."}
                    </>
                  }
                />

                <PrevisoesAuditoria id="configuracao" titulo="Configuração congelada, dados de entrada e pendências da governança">
                  <dl>
                    <PrevisoesFichaLinha rotulo="Configuração">
                      sha256 <span className="font-mono text-xs">{g.dados.configuracao_sha256}</span>;{" "}
                      {g.dados.configuracao_registrada_sha256 === g.dados.configuracao_sha256 ? "confere com a registrada no registro de modelos" : "diferente da registrada no registro de modelos"}.
                    </PrevisoesFichaLinha>
                    {Object.entries(g.dados.snapshots).map(([k, s]) => (
                      <PrevisoesFichaLinha key={k} rotulo={`Dado ${k}`}>
                        {s.id ? snapshotLegivel(s.id) : "sem identificador"}; última captura {carimbo(s.ultima_captura)}; {s.revisoes ?? 0} revisões detectadas
                      </PrevisoesFichaLinha>
                    ))}
                    {(["ear", "ena"] as const).map((k) => (
                      <PrevisoesFichaLinha key={k} rotulo={`Dicionário ONS (${k.toUpperCase()})`}>
                        {g.dados.dicionarios_ons[k].leitura}{" "}
                        <a href={g.dados.dicionarios_ons[k].url} className="text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                          dicionário em PDF
                        </a>
                      </PrevisoesFichaLinha>
                    ))}
                    <PrevisoesFichaLinha rotulo="Integrado até">
                      PLD até {dataBR(g.dados.ultimo_dia_pld)}; <Termo slug="ear">EAR</Termo> até {dataBR(g.dados.ultimo_dia_ear)}; <Termo slug="ena">ENA</Termo> até{" "}
                      {dataBR(g.dados.ultimo_dia_ena)}
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo="Estados">{g.governanca.estados}</PrevisoesFichaLinha>
                    {g.governanca.pendencias.map((p) => (
                      <PrevisoesFichaLinha key={p.id} rotulo={`${p.id}: ${p.titulo}`}>
                        {p.descricao} Encaminhamento: {p.encaminhamento} Responsável: {p.responsavel}. Estado: {p.estado.replace(/_/g, " ").toLowerCase()}.
                      </PrevisoesFichaLinha>
                    ))}
                  </dl>
                  <TabelaInterativa
                    titulo="Decisões revisáveis e quem as toma"
                    colunas={COLUNAS_DECISOES}
                    linhas={decisoes}
                    chaveLinha="id"
                    colunaRotulo="item"
                    fonte={fonte}
                    versao={versao}
                    nomeArquivo="previsoes-pld-decisoes-revisaveis"
                  />
                </PrevisoesAuditoria>

                <PrevisoesSeguir
                  ancora="p014"
                  proximo={{ href: `#${proximoPainel("p014").id}`, pergunta: proximoPainel("p014").pergunta }}
                  downloads={downloadsDoPainel(g, "p014")}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          <Bloco id="desempenho">
            <PainelEvidencia
              id="p016"
              pergunta={perguntaPainel("p016")}
              subtitulo="Teste retrospectivo fora da amostra, acompanhamento prospectivo e calibração das faixas · entregas e R$/MWh"
              natureza="PREVISTO"
              porQueImporta={
                <>
                  Um modelo só vale a pena se errar menos que repetir o último preço (B0) ou o do ano anterior (S0), em amostra que ele não viu e com a informação disponível
                  em cada corte. Sem isso, qualquer gráfico bonito engana.
                </>
              }
              oQueMudou={
                <>
                  {pubDes.publicado
                    ? "Números de desempenho liberados para o portal."
                    : `Decisão de publicação: ${pubDes.decisao?.estado === "PENDENTE" || !pubDes.decisao ? "pendente" : (pubDes.decisao?.estado ?? "").toLowerCase()}.`}{" "}
                  {g.prospectivo.leitura}
                </>
              }
              comoInterpretar={
                <>
                  O teste retrospectivo refaz, para cada dia desde {dataBR(g.dados.origens.inicio)}, a previsão com o dado disponível naquele corte (hipótese LAT1D) e a
                  compara com o realizado; o acompanhamento prospectivo usa só rodadas registradas antes do resultado. Uma faixa é calibrada quando contém o realizado na
                  proporção prometida, medida em entregas distintas, não em origens.
                </>
              }
              naoConcluir={
                <>
                  {pubDes.publicado
                    ? "Ganho pequeno com intervalo que inclui zero não mostra que um modelo supera outro."
                    : "Enquanto os números estiverem retidos, nada aqui diz que um modelo supera outro."}{" "}
                  Teste retrospectivo é reconstrução sob hipótese, não operação real. Origens vizinhas preveem a mesma entrega: o tamanho que conta é o de entregas
                  distintas.
                </>
              }
              proveniencia={g.proveniencia}
            >
              <div className="space-y-6">
                <PrevisoesResposta id="p016">{respostaP016(g)}</PrevisoesResposta>
                <PrevisoesRecorte
                  periodo={
                    <>
                      Origens de {dataBR(g.dados.origens.inicio)} a {dataBR(g.dados.origens.fim)}; {g.definicoes.periodos.desenvolvimento}; {g.definicoes.periodos.teste}
                    </>
                  }
                  universo={
                    <>
                      Modelos avaliados: {avaliados.join(", ")}
                      {naoAvaliados.length ? ` (sem avaliação: ${naoAvaliados.map((m) => m.codigo).join(", ")})` : ""}; sete horizontes; quatro submercados
                    </>
                  }
                  unidade="Entregas distintas; R$/MWh nominais para erro e ganho"
                />
                {!pubDes.publicado && (
                  <PrevisoesAviso tipo="alerta">
                    <p>
                      <span className="font-medium">Por que não há números de desempenho aqui:</span> {pubDes.motivo}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium">O que libera a publicação:</span> {pubDes.para_liberar}
                    </p>
                  </PrevisoesAviso>
                )}

                {g.desempenho.publicado && desempenho.length > 0 && (
                  <>
                    <GraficoPontos
                      titulo="MAE no teste final por modelo e horizonte, contra o B0 nas mesmas células"
                      itens={desempenho
                        .filter((l) => l.periodo === "teste" && l.modelo !== "B0")
                        .map((l) => ({ id: l.id, rotulo: `${l.modelo} ${l.horizonte}`, valor: l.mae, referencia: l.mae_b0, detalhe: `${l.entregas} entregas distintas` }))}
                      unidade="R$/MWh"
                      casas={2}
                      rotuloValor="MAE do modelo"
                      rotuloReferencia="MAE do B0"
                    />
                    <TabelaInterativa
                      titulo="Métricas por modelo, horizonte e período"
                      colunas={COLUNAS_DESEMPENHO}
                      linhas={desempenho}
                      chaveLinha="id"
                      colunaRotulo="modelo"
                      fonte={fonte}
                      versao={versao}
                      nomeArquivo="previsoes-pld-desempenho"
                      chaveUrl="des"
                    />
                  </>
                )}

                {amostra.length > 0 && (
                  <>
                    <GraficoPontos
                      titulo="Entregas distintas do teste por horizonte, contra o mínimo para calibrar a faixa"
                      itens={amostra.map((a) => ({ id: a.id, rotulo: a.horizonte, valor: a.entregas, referencia: a.minimo, detalhe: `estado: ${a.estado}` }))}
                      unidade="entregas"
                      casas={0}
                      rotuloValor="Entregas no teste"
                      rotuloReferencia={minimo !== null ? `Mínimo de ${minimo}` : "Mínimo para calibrar"}
                      unidadeDiferenca="entregas"
                      zeroNoEixo
                    />
                    <TabelaInterativa
                      titulo="Amostra de calibração por horizonte"
                      colunas={COLUNAS_AMOSTRA}
                      linhas={amostra}
                      chaveLinha="id"
                      colunaRotulo="horizonte"
                      fonte={fonte}
                      versao={versao}
                      nomeArquivo="previsoes-pld-amostra-calibracao"
                      nota="Contagem de entregas distintas do período de teste com quantis, gravada em cada célula da rodada mais recente; a cobertura medida está retida com os demais números de desempenho."
                    />
                  </>
                )}

                {prospectivo.length > 0 && (
                  <>
                    <GraficoBarras
                      titulo="Acompanhamento prospectivo: previsões com número por horizonte, com e sem realizado"
                      dados={prospectivo}
                      chaveCategoria="id"
                      chaveRotulo="horizonte"
                      series={[
                        { id: "apuradas", rotulo: "com realizado", cor: "var(--cor-energia)" },
                        { id: "aguardando", rotulo: "aguardando o fim da entrega", cor: "var(--cor-mineral-soft)" },
                      ]}
                      unidade="previsões"
                      casas={0}
                      empilhado
                      rotulosValor
                      altura={240}
                    />
                    <TabelaInterativa
                      titulo="Previsões registradas e apuradas por horizonte"
                      colunas={COLUNAS_PROSPECTIVO}
                      linhas={prospectivo}
                      chaveLinha="id"
                      colunaRotulo="horizonte"
                      fonte={fonte}
                      versao={versao}
                      nomeArquivo="previsoes-pld-prospectivo"
                    />
                  </>
                )}

                <PrevisoesLeitura
                  comoLer={
                    <>
                      No primeiro gráfico, o círculo é o número de entregas distintas do teste em cada horizonte e o losango, o mínimo da regra de calibração; a diferença
                      aparece escrita. No segundo, cada barra soma as previsões com número de cada horizonte, separando as que já têm realizado.
                    </>
                  }
                  naoPermite={
                    <>
                      Não permite dizer que a faixa de algum modelo é confiável: sem amostra mínima, a calibração não é avaliada. A contagem de previsões apuradas não é medida
                      de acerto.
                    </>
                  }
                />

                <PrevisoesAnalise id="metodo" titulo="Como o desempenho é medido">
                  <dl>
                    {(["alvo", "realizado", "entregas", "cenario_de_elegibilidade", "erro", "ganho", "perda_quantilica", "cobertura", "calibracao", "quantis"] as const).map((k) => (
                      <PrevisoesFichaLinha key={k} rotulo={rotuloDefinicao(k)}>
                        {g.definicoes[k]}
                      </PrevisoesFichaLinha>
                    ))}
                    <PrevisoesFichaLinha rotulo="Fronteira entre períodos">{g.definicoes.periodos.fronteira}</PrevisoesFichaLinha>
                    {naoAvaliados.map((m) => (
                      <PrevisoesFichaLinha key={m.codigo} rotulo={`${m.codigo} sem avaliação`}>
                        {semCaminhosDeArquivo(m.motivo_sem_avaliacao ?? "motivo não registrado")}
                      </PrevisoesFichaLinha>
                    ))}
                  </dl>
                </PrevisoesAnalise>

                <PrevisoesAnalise id="controles" titulo="Controles do teste retrospectivo, executados a cada publicação">
                  <TabelaInterativa
                    titulo="Controles do teste e da rodada"
                    colunas={COLUNAS_VALIDACOES}
                    linhas={validacoes}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={fonte}
                    versao={versao}
                    nomeArquivo="previsoes-pld-controles"
                  />
                </PrevisoesAnalise>

                <PrevisoesAuditoria id="publicacao" titulo="Regra de publicação e decisão pendente">
                  <dl>
                    <PrevisoesFichaLinha rotulo="Regra">{pubDes.regra}</PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo="Decisão">
                      {pubDes.decisao
                        ? `${pubDes.decisao.estado.toLowerCase()}; decidido por ${pubDes.decisao.decidido_por ?? "ninguém registrado"} em ${pubDes.decisao.decidido_em ? dataBR(pubDes.decisao.decidido_em) : "data não registrada"}`
                        : "nenhuma registrada"}
                      {pubDes.decisao?.pergunta ? `. Pergunta: ${pubDes.decisao.pergunta}` : ""}
                    </PrevisoesFichaLinha>
                    {pubDes.decisao?.registro && <PrevisoesFichaLinha rotulo="Registro">{pubDes.decisao.registro}</PrevisoesFichaLinha>}
                    {!pubDes.publicado && <PrevisoesFichaLinha rotulo="Leitura do implementador">{pubDes.interpretacao_do_implementador}</PrevisoesFichaLinha>}
                    <PrevisoesFichaLinha rotulo="Onde estão os resultados">{g.desempenho.publicado ? "nesta página" : g.desempenho.calculado}</PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo="Linhas do teste">
                      {g.dados.linhas_csv.semanal.toLocaleString("pt-BR")} semanais e {g.dados.linhas_csv.mensal.toLocaleString("pt-BR")} mensais; última entrega apurada no
                      teste: {g.dados.ultima_entrega_apurada_teste ? dataBR(g.dados.ultima_entrega_apurada_teste) : "nenhuma"}
                    </PrevisoesFichaLinha>
                    {Object.entries(g.dados.revisoes_hidrologia).map(([k, r]) => (
                      <PrevisoesFichaLinha key={k} rotulo={`Revisões em ${k.split(":")[1] ?? k}`}>
                        {r.observacoes_revisadas} observações revisadas pelo ONS entre capturas; maior revisão {r.maior_revisao === null ? "sem registro" : `${r.maior_revisao.toLocaleString("pt-BR")} p.p.`}.
                        O teste retrospectivo do modelo com hidrologia usa o valor revisado.
                      </PrevisoesFichaLinha>
                    ))}
                    <PrevisoesFichaLinha rotulo="Estado dos modelos">
                      {g.modelos.map((m) => `${m.codigo} em ${rotuloEstadoModelo(m.estado)}`).join("; ")}
                    </PrevisoesFichaLinha>
                  </dl>
                </PrevisoesAuditoria>

                <PrevisoesSeguir
                  ancora="p016"
                  proximo={{ href: enderecoPainel(proximoPainel("p016").id), pergunta: proximoPainel("p016").pergunta }}
                  downloads={downloadsDoPainel(g, "p016")}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}

const ROTULOS_DEFINICAO: Record<string, string> = {
  alvo: "Alvo",
  realizado: "Realizado",
  entregas: "Entregas",
  cenario_de_elegibilidade: "Dado elegível no corte",
  erro: "Erro e viés",
  ganho: "Ganho sobre o B0",
  perda_quantilica: "Perda quantílica",
  cobertura: "Cobertura",
  calibracao: "Calibração",
  quantis: "Quantis",
};
const rotuloDefinicao = (k: string) => ROTULOS_DEFINICAO[k] ?? k;
