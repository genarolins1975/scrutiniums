import type { Metadata } from "next";
import Link from "next/link";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import {
  DadosAnalise,
  DadosAuditoria,
  DadosLimitacoes,
  DadosNavegacao,
  DadosRecorte,
  DadosResposta,
  DadosSeguir,
  ReferenciaDados,
} from "@/components/energia/DadosPainel";
import { MetodologiaRegras } from "@/components/energia/MetodologiaRegras";
import { Numero } from "@/components/energia/Numero";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { LISTA_UNIDADES } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { afirmacoesConferidas, linhasMetricas, respostaRegras, resumoMetricas, ROTULO_ESTADO_DADOS, URL_GOLD } from "@/lib/energia/dados";
import { metricasPublicadas, provenienciaDados, publicacaoDados } from "@/lib/energia/dados-servidor";
import { carimbo, dataBR, num, rotuloRegra } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Metodologia do Observatório do Setor Elétrico",
  description:
    "Taxonomia de natureza do dado, regra editorial, linhagem das séries, vintages sem look-ahead, regras de classificação publicadas, governança de previsão e limitações do Observatório Brasileiro do Setor Elétrico.",
  alternates: { canonical: "/setor-eletrico/metodologia" },
};

function S({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-linha py-10">
      <h2 id={`${id}-h`} className="font-serif text-2xl text-carvao">{titulo}</h2>
      <div className="mt-4 max-w-4xl space-y-4 leading-relaxed text-carvao">{children}</div>
    </section>
  );
}

const ROTULO_FRASE: Record<string, string> = {
  reservatorios: "Reservatórios",
  afluencias: "Afluências",
  carga: "Carga",
  termica: "Participação térmica",
  pld: "PLD",
  preco: "PLD",
  descolamento: "Diferença entre submercados",
};

function Regras({ titulo, regras }: { titulo: string; regras?: Record<string, string> }) {
  if (!regras) return null;
  return (
    <div className="border border-linha bg-superficie p-5">
      <h3 className="font-medium text-carvao">{titulo}</h3>
      <dl className="mt-3 space-y-3">
        {Object.entries(regras).map(([k, v]) => (
          <div key={k}>
            <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
            <dd className="mt-0.5 text-sm text-carvao">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function MetodologiaEnergia() {
  const meta = gold.meta();
  const sintese = gold.sintese();
  const pub = publicacaoDados();
  const pendentes = CONCEITOS.filter((c) => c.estado === "PENDENTE");
  const metricas = metricasPublicadas();
  const rm = resumoMetricas(metricas);
  const afirm = pub ? afirmacoesConferidas(pub) : [];
  const conferidas = afirm.filter((x) => x.conferida).length;
  const prov = pub ? provenienciaDados(pub.proveniencia.validacao) : null;
  const evAfirm = pub?.evidencias.afirmacoes_conferidas;
  const evReprovadas = pub?.evidencias.checagens_reprovadas;
  const eixos = pub?.eixos;
  const SITUACOES = ["reconciliacao_aprovada", "controles_aprovados", "ressalva", "divergencia", "pendencia"] as const;
  return (
    <>
      <CabecalhoEnergia atual="metodologia" />
      <MarcaVisita secao="energia:metodologia" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo siglas={["CMO", "PLD", "SIN"]}
          rotulo="Metodologia"
          titulo="Quais interpretações são permitidas?"
          referencia={pub ? <ReferenciaDados geradoEm={pub.gerado_em} referencia={dataBR(pub.referencia.hoje)} /> : undefined}
        >
          Esta página descreve o caminho de cada número, da fonte primária à tela, e a regra de cada indicador: definição, unidade, recortes, cálculo, revisão e o que ele não permite concluir. A documentação técnica completa (arquitetura, catálogo de fontes, auditabilidade e governança de previsão) está no{" "}
          <a href="https://github.com/genarolins1975/scrutiniums/tree/main/docs/observatorios" target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
            repositório público do projeto ↗
          </a>
          , junto com o código que produz cada número.
        </CabecalhoModulo>
        <DadosNavegacao atual="regras" />

        <ModoProfundidade>
          {pub && prov && metricas.length > 0 ? (
            <>
              <Bloco id="regras">
                <PainelEvidencia
                  id="painel-regras"
                  pergunta="Quais interpretações são permitidas?"
                  subtitulo={`${num(rm.total, 0)} indicadores em ${rm.modulos} módulos · regra, unidade, recortes, cobertura e limitações de cada um`}
                  proveniencia={prov}
                  porQueImporta={
                    <>
                      Um número sem regra convida a leitura que a regra não sustenta. Aqui, cada indicador diz o que mede, em que unidade, para qual recorte, como se agrega, o que acontece quando falta dado e o que ele não permite concluir.
                    </>
                  }
                  oQueMudou={
                    <>
                      O catálogo tem {num(rm.total, 0)} indicadores, {num(rm.comFormula, 0)} com fórmula publicada. {conferidas === afirm.length ? `As ${num(afirm.length, 0)} afirmações sobre fontes integradas correspondem a conjuntos com recurso verificado.` : `${num(afirm.length - conferidas, 0)} de ${num(afirm.length, 0)} afirmações sobre fontes integradas não correspondem a recurso verificado.`}
                    </>
                  }
                  comoInterpretar={
                    <>
                      A natureza do dado de origem e a do resultado são diferentes: um valor observado pode virar um calculado, e um calculado de dado estimado continua dependendo da estimativa. Mista é a combinação de naturezas. A regra de cobertura diz o mínimo para publicar; a política de ausência diz o que aparece
                      quando falta (nunca zero).
                    </>
                  }
                  naoConcluir={
                    <>
                      Que a regra publicada garanta a ausência de erro: ela diz o que o pipeline faz, e as validações e a evidência de cada número dizem se deu certo. Que um indicador de um módulo possa ser comparado com um de outro sem olhar o recorte e a unidade. Que a lista esteja completa para o que a
                      fonte publica: só entram os números que o observatório exibe.
                    </>
                  }
                >
                  <DadosResposta
                    painel="P070"
                    prova={
                      <>
                        {evAfirm && <ComproveNumero evidencia={evAfirm} rotulo="Comprove as afirmações conferidas" endereco="https://scrutiniums.com/setor-eletrico/metodologia#regras" />}
                        {evReprovadas && <ComproveNumero evidencia={evReprovadas} rotulo="Comprove as checagens reprovadas" endereco="https://scrutiniums.com/setor-eletrico/metodologia#regras" />}
                      </>
                    }
                  >
                    {respostaRegras(rm)}
                  </DadosResposta>
                  <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Numero rotulo="Indicadores com regra publicada" natureza="CALCULADO" valor={rm.total} casas={0} unidade="indicadores" tamanho="medio" periodo={dataBR(pub.gerado_em.slice(0, 10))} nota={<>em {rm.modulos} módulos</>} endereco="https://scrutiniums.com/setor-eletrico/metodologia#regras" />
                    <Numero rotulo="Com fórmula publicada" natureza="CALCULADO" valor={rm.comFormula} casas={0} unidade="indicadores" tamanho="medio" periodo={dataBR(pub.gerado_em.slice(0, 10))} nota={<>os demais têm definição e regra de agregação</>} endereco="https://scrutiniums.com/setor-eletrico/metodologia#regras" />
                    <Numero
                      rotulo="Afirmações de fonte integrada conferidas"
                      natureza="CALCULADO"
                      evidencia={evAfirm ?? null}
                      valor={conferidas}
                      casas={0}
                      unidade="afirmações"
                      tamanho="medio"
                      nota={<>de {num(afirm.length, 0)}, contra o estado real do catálogo</>}
                      motivoAusencia="Sem afirmações conferidas nesta publicação."
                      endereco="https://scrutiniums.com/setor-eletrico/metodologia#regras"
                    />
                    <Numero
                      rotulo="Checagens automáticas reprovadas"
                      natureza="CALCULADO"
                      evidencia={evReprovadas ?? null}
                      valor={pub.resumo.validacao.reprovado}
                      casas={0}
                      unidade="checagens"
                      tamanho="medio"
                      nota={<>de {num(pub.resumo.validacao.checagens, 0)}; {num(pub.resumo.validacao.ressalva, 0)} com ressalva</>}
                      endereco="https://scrutiniums.com/setor-eletrico/metodologia#regras"
                    />
                  </div>
                  <DadosRecorte
                    periodo={<>regras da versão de {dataBR(pub.gerado_em.slice(0, 10))}; cada indicador traz o seu período</>}
                    universo={`${num(rm.total, 0)} indicadores publicados pelos módulos temáticos`}
                    unidade="a de cada indicador, escrita na regra"
                  />
                  <div id="tabela" className="scroll-mt-28">
                    <MetodologiaRegras linhas={linhasMetricas(metricas)} versao={pub.gerado_em} />
                  </div>
                  <DadosLimitacoes
                    itens={[
                      <>A lista é a do pipeline em {dataBR(pub.gerado_em.slice(0, 10))}; indicador novo só aparece depois da próxima execução.</>,
                      <>{eixos?.limitacao_natureza}</>,
                    ]}
                  />
                  <DadosSeguir
                    ancora="painel-regras"
                    proximo={{ href: "/setor-eletrico/dados", pergunta: "Quais dados estão de fato validados?" }}
                    downloads={[{ rotulo: "Catálogo de métricas (JSON)", url: URL_GOLD.metricas }, { rotulo: "Natureza e validação por ficha (CSV)", url: "/energia/series/dados_eixos.csv" }]}
                  />
                </PainelEvidencia>
              </Bloco>

              <Bloco id="afirmacoes">
                <DadosAnalise titulo="Afirmações sobre fontes integradas, conferidas com o catálogo" id="afirmacoes-analise">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Cada frase abaixo é escrita pelo pipeline a partir do estado real do catálogo: o conjunto só é descrito como integrado, validado ou publicado se a escada chegou lá. Uma afirmação cujo conjunto está fora do catálogo, ou só catalogado, reprova.
                  </p>
                  <ul className="space-y-3" data-lista="afirmacoes">
                    {afirm.map(({ afirmacao: a, conferida, motivo }) => (
                      <li key={a.id} className="border border-linha bg-superficie p-4" data-afirmacao={a.id}>
                        <p className="flex flex-wrap items-baseline gap-x-3">
                          <strong className="font-medium text-carvao">{a.tema}</strong>
                          <span className={`rotulo ${conferida ? "text-sucesso" : "text-erro"}`}>{conferida ? "● conferida com o catálogo" : `✕ não confere: ${motivo}`}</span>
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">{a.texto}</p>
                        <p className="mt-2 text-xs leading-relaxed text-mineral">
                          Conjuntos citados:{" "}
                          {a.conjuntos.map((c) => `${c.id} (${ROTULO_ESTADO_DADOS[c.estado].toLowerCase()})`).join("; ")}.
                        </p>
                        {a.afirmacao_anterior && (
                          <p className="mt-2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao">
                            <span className="rotulo mr-2 text-aviso">Correção</span>
                            {a.afirmacao_anterior} {a.correcao_metodologia ?? ""}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </DadosAnalise>
              </Bloco>

              {eixos && (
                <Bloco id="eixos">
                  <DadosAnalise titulo="Natureza do dado e situação da validação, ficha a ficha" id="eixos-analise">
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                      Cada ficha de evidência ({num(eixos.fichas, 0)}) tem uma natureza e uma situação de validação. {num(eixos.fichas_sem_natureza_vinculada, 0)} fichas não têm natureza vinculada com segurança e aparecem como sem vínculo: a situação da validação é publicada, e a natureza fica em aberto em vez de ser chutada.
                    </p>
                    <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Fichas por natureza e situação da validação (tabela rolável)">
                      <table className="w-full min-w-[40rem] border-collapse text-xs">
                        <caption className="sr-only">Número de fichas de evidência por natureza do dado e situação da validação</caption>
                        <thead>
                          <tr className="text-left text-mineral">
                            <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Natureza</th>
                            {SITUACOES.map((x) => (
                              <th key={x} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                                {x.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(eixos.matriz).map(([n, linha]) => (
                            <tr key={n} className="border-b border-linha">
                              <th scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                                {n === "SEM_VINCULO" ? "Sem natureza vinculada" : NATUREZAS[n as Natureza]?.rotulo ?? n}
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
                          <dt className="font-medium text-carvao">{x.replace(/_/g, " ")}</dt>
                          <dd className="mt-0.5 leading-relaxed text-carvao-muted">{eixos.situacoes[x]}</dd>
                        </div>
                      ))}
                    </dl>
                  </DadosAnalise>
                </Bloco>
              )}

              <Bloco id="regras-pipeline">
                <DadosAuditoria titulo="Regras do pipeline: estados, uso, validação, horizonte e tempo" id="regras-pipeline-auditoria">
                  <dl className="space-y-4 text-sm">
                    <div>
                      <dt className="rotulo text-mineral">Uso e estado</dt>
                      <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">{pub.regras.uso}</dd>
                    </div>
                    <div>
                      <dt className="rotulo text-mineral">Validação</dt>
                      <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">{pub.regras.validacao}</dd>
                    </div>
                    <div>
                      <dt className="rotulo text-mineral">Revisão</dt>
                      <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">{pub.regras.revisao}</dd>
                    </div>
                    <div>
                      <dt className="rotulo text-mineral">Datas distinguidas</dt>
                      <dd className="mt-1">
                        <dl className="space-y-1.5">
                          {Object.entries(pub.regras.tempo).map(([k, v]) => (
                            <div key={k}>
                              <dt className="inline font-medium text-carvao">{rotuloRegra(k)}: </dt>
                              <dd className="inline leading-relaxed text-carvao-muted">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </dd>
                    </div>
                    <div>
                      <dt className="rotulo text-mineral">Referências legitimamente posteriores à captura (horizonte)</dt>
                      <dd className="mt-1">
                        <ul className="list-disc space-y-0.5 pl-5 leading-relaxed text-carvao-muted">
                          {Object.entries(pub.regras.horizonte).map(([k, v]) => (
                            <li key={k}>
                              <span className="font-medium text-carvao">{k}</span>: {v}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  </dl>
                </DadosAuditoria>
              </Bloco>
            </>
          ) : (
            <Bloco id="regras">
              <p className="border border-dashed border-mineral bg-papel p-5 text-sm leading-relaxed text-carvao-muted" role="status">
                As regras por indicador não estão disponíveis nesta publicação: o catálogo de métricas ou a gold de publicação não foi gerado. As seções abaixo, escritas à mão, continuam valendo.
              </p>
            </Bloco>
          )}
        </ModoProfundidade>

        <S id="natureza" titulo="Taxonomia de natureza do dado">
          <p>Todo número exibido carrega um selo. As categorias nunca se confundem, e a forma do selo muda com a categoria, não só a cor.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {(Object.keys(NATUREZAS) as Natureza[]).map((n) => (
              <li key={n} className="flex items-start gap-3 border border-linha bg-superficie p-4">
                <SeloNatureza natureza={n} />
                <span className="text-sm text-carvao-muted">{NATUREZAS[n].definicao}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-carvao-muted">
            O CMO semanal é publicado pelo ONS como saída do modelo DECOMP: para a plataforma é OBSERVADO (valor oficial), com a nota de que é resultado
            de modelo da fonte. Médias diárias do PLD e participações por fonte são CALCULADAS pela Scrutiniums a partir de valores observados.
          </p>
        </S>

        <S id="unidades" titulo="Unidades">
          <p>Convenções de medida usadas neste observatório, com a unidade em que cada fonte publica:</p>
          <dl className="grid gap-3 md:grid-cols-3">
            {LISTA_UNIDADES.map((x) => (
              <div key={x.u} className="border border-linha bg-superficie p-4">
                <dt className="font-medium text-carvao">{x.u} · {x.nome}</dt>
                <dd className="mt-1 text-sm text-carvao-muted">{x.dica}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-carvao-muted">
            Preços em reais por megawatt-hora (R$/MWh), sempre nominais: sem correção pela inflação. A descrição do conjunto de PLD na CCEE registra a
            unidade apenas como R$; a do CMO semanal, no dicionário do ONS, como R$/MW.
          </p>
        </S>

        <S id="editorial" titulo="Regra editorial">
          <p>Toda visualização relevante responde, nesta ordem: o que estou vendo, por que importa, o que mudou, como interpretar, o que não é possível concluir e qual é a fonte. A regra é obrigatória no componente de painel: um painel sem esses campos não é construído.</p>
        </S>

        <S id="linhagem" titulo="Linhagem e vintages">
          <p>
            O processamento tem três camadas, com nomes usuais em engenharia de dados: bronze guarda o arquivo original de cada captura, silver guarda o
            histórico de observações por captura (vintage) e gold reúne os dados processados que as páginas publicam.
          </p>
          <pre tabIndex={0} aria-label="Linhagem dos dados, do arquivo da fonte à visualização (rolável)" className="overflow-x-auto border border-linha bg-superficie p-4 font-mono text-xs leading-relaxed text-carvao">{`FONTE (CCEE, ONS, ANEEL)
  ↓ captura: arquivo original, sha256, url, capturado_em, publicado_em (metadado da fonte)
BRONZE: cópia imutável por captura
  ↓ normalização determinística
SILVER (histórico): observações por vintage; só acrescenta, nunca apaga
  ↓ regras publicadas
GOLD (dados processados): indicadores com proveniência, publicados em /energia/gold
  ↓
INDICADOR → VISUALIZAÇÃO | MODELO

Previsões: VINTAGE DA FONTE → VARIÁVEIS DE ENTRADA → VERSÃO DO MODELO → PUBLICAÇÃO → REALIZADO → APURAÇÃO`}</pre>
          <p>
            Cada observação guarda a vintage de onde veio. Uma revisão da fonte (o ONS declara que seus dados passam por consistência recorrente) cria uma vintage
            nova sem apagar a anterior. A consulta &quot;como estava em&quot; devolve o valor conhecido em qualquer instante (com fuso explícito, sem
            ambiguidade de data) e é a que as variáveis de entrada de modelos em produção e os testes retrospectivos por vintage devem usar. O backtest da pesquisa atual foi feito
            sobre um snapshot único, em pseudo tempo real; a limitação está declarada em cada cartão de modelo.
          </p>
          <p className="text-sm text-carvao-muted">
            Datas distinguidas: período de referência; publicação pela fonte (quando informada); captura pela Scrutiniums; corte da previsão; emissão.
          </p>
        </S>

        <S id="classificacao" titulo="Regras de classificação publicadas">
          <p>Nenhuma classificação (&quot;baixo&quot;, &quot;alto&quot;, &quot;fora da faixa usual&quot;) existe sem regra estatística declarada. As regras em vigor, lidas dos próprios dados publicados:</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Regras titulo="PLD" regras={gold.pld()?.regras} />
            <Regras titulo="Hidrologia" regras={gold.hidrologia()?.regras} />
            <Regras titulo="Carga" regras={gold.carga()?.regras} />
            <Regras titulo="Geração" regras={gold.geracao()?.regras} />
            <Regras titulo="Rede" regras={gold.rede()?.regras} />
          </div>
        </S>

        <S id="sintese" titulo="Frases e alertas da Visão geral">
          <p>A síntese &quot;o sistema em 60 segundos&quot; e a lista &quot;o que observar&quot; são montadas por regras fixas a partir dos dados processados; nenhum texto é redigido livremente. Cada frase tem sua regra; cada alerta, sua condição.</p>
          {sintese && (
            <ul className="space-y-2 text-sm">
              {sintese.frases.map((f) => (
                <li key={f.id} className="border border-linha bg-superficie p-3"><strong className="font-medium">{ROTULO_FRASE[f.id] ?? f.id}:</strong> {f.regra}</li>
              ))}
              {sintese.observar.map((o) => (
                <li key={o.id} className="border border-linha bg-superficie p-3"><strong className="font-medium">{o.titulo}:</strong> {o.condicao}</li>
              ))}
            </ul>
          )}
        </S>

        <S id="previsao" titulo="Governança de previsão">
          <p>
            Modelos têm estado explícito: PESQUISA, VALIDAÇÃO, PRODUÇÃO ou APOSENTADO. Só modelo em PRODUÇÃO alimenta a previsão principal. Cada previsão
            registrada ganha um identificador e um sha256 do conteúdo; correção cria novo registro que aponta para o original, com motivo. Faixas de
            incerteza só são chamadas de &quot;80%&quot; quando a cobertura medida fora do ajuste sustenta isso.
          </p>
          <p>
            Veja o <Link href="/setor-eletrico/pld/modelos" className="text-energia-dark underline underline-offset-4">registro de modelos</Link> e o{" "}
            <Link href="/setor-eletrico/pld/previsoes" className="text-energia-dark underline underline-offset-4">histórico de previsões</Link>.
          </p>
        </S>

        <S id="limitacoes" titulo="Limitações gerais desta fase">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              O portal de dados abertos da CCEE recusa consultas automáticas comuns. O observatório usa um cliente próprio, com coleta autorizada pelo responsável em 06/10/2026 para o PLD horário, os conjuntos abertos do Mercado e o InfoMercado, e tenta a
              coleta em cada atualização agendada. O histórico do PLD de 2021 a 2025 vem das capturas primárias de 27/09/2026.
              <span data-nivel="analisar">
                {" "}
                Detalhe técnico: a recusa é um HTTP 403 com página de acesso bloqueado para o curl; o cliente do pipeline segue com o User-Agent do projeto e sem disfarce de navegador, e as capturas são versionadas com sha256.
              </span>{" "}
              {meta?.fontes?.ccee_pld_horario?.ultima_tentativa
                ? `Última tentativa do PLD horário: ${carimbo(meta.fontes.ccee_pld_horario.ultima_tentativa.tentado_em)}, ${meta.fontes.ccee_pld_horario.ultima_tentativa.ok ? "bem-sucedida" : "sem sucesso"}.`
                : "Nenhuma tentativa registrada nesta publicação."}
            </li>
            <li>
              Os limites regulatórios do PLD (piso, teto horário e teto estrutural) vêm dos atos da ANEEL, com o ato e a vigência de cada valor, no{" "}
              <Link href="/setor-eletrico/regulacao#p044" className="text-energia-dark underline underline-offset-4">painel de limites da Regulação</Link>; o &quot;menor valor observado no ano&quot; é descritivo e nunca é chamado de piso.
            </li>
            {/* afirmações de integração geradas pelo pipeline a partir do estado real do catálogo (achado A06) */}
            {(pub?.afirmacoes ?? [])
              .filter((a) => ["limites_intercambio", "cvu_usina", "geracao_usina", "despacho_termico"].includes(a.id))
              .map((a) => (
                <li key={a.id}>{a.texto}</li>
              ))}
            <li>
              {pendentes.length === 0
                ? "Todos os verbetes do Aprenda têm a definição conferida em fonte primária."
                : `${pendentes.length === 1 ? "Um verbete do Aprenda aparece" : `${pendentes.length} verbetes do Aprenda aparecem`} em preparação, sem definição, porque a fonte primária que o define não foi encontrada nos documentos consultados (${pendentes.map((c) => c.sigla ?? c.nome).join(", ")}); cada um diz o que já foi consultado e o que falta.`}
            </li>
            <li>Valores monetários em R$ nominais.</li>
            <li>O histórico de vintages persiste no cache da automação (GitHub Actions). O silver (banco com vintages e observações) tem cópia durável numa release do repositório; os arquivos brutos do bronze não têm, mas o sha256 de cada um fica registrado no silver. Se cache e cópia se perderem, a automação abre um alerta, os dados publicados continuam corretos e só o registro de revisões anteriores se perde.</li>
              <li>Quando a fonte remove uma referência de um arquivo, a remoção não é registrada: a série continua com o último valor publicado para ela. Revisões de valor são registradas.</li>
          </ul>
        </S>

        <S id="versao" titulo="Versão desta publicação">
          {meta ? (
            <p className="text-sm">
              Último processamento completo do pipeline (meta.json): {carimbo(meta.gerado_em)} · versão do processamento {meta.versao_pipeline}
              {meta.versao_codigo ? ` · código ${meta.versao_codigo}` : ""} · coleta executada nesse processamento: {meta.coleta_executada ? "sim" : "não (reconstrução a partir do estado salvo)"} ·
              falhas de construção: {meta.builders_falhos.length} · regressões retidas: {meta.regressoes.length}.
            </p>
          ) : (
            <p className="text-sm text-mineral">Metadados da publicação indisponíveis.</p>
          )}
        </S>
      </main>
    </>
  );
}
