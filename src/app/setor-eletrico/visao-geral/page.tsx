import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { VisaoDeterminantes } from "@/components/energia/VisaoDeterminantes";
import { VisaoDestaques, VisaoFrases } from "@/components/energia/VisaoFrases";
import { VisaoObservar, type ItemObservar, type LinhaComparavel } from "@/components/energia/VisaoObservar";
import { VisaoAnalise, VisaoAuditoria, VisaoAviso, VisaoControles, VisaoIndisponivel, VisaoNavegacao, VisaoRecorte, VisaoResposta, VisaoSeguir } from "@/components/energia/VisaoPagina";
import { VisaoRegraResumo } from "@/components/energia/VisaoRegras";
import { VisaoTabelasSobDemanda } from "@/components/energia/VisaoTabelasSobDemanda";
import { VisaoLinhaTempo, VisaoSociedadeCartoes } from "@/components/energia/VisaoSociedade";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num, plural } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { PAGINAS_MAPA } from "@/lib/energia/mapa";
import type { RegraObservar, SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import {
  ANCORAS_DETERMINANTES,
  COLUNAS_FRASES,
  COLUNAS_SOCIEDADE,
  PAINEIS_VISAO,
  ROTULO_ESTADO,
  dominioEstados,
  linhasFrases,
  linhasSociedade,
  pedeAtencao,
  referenciasFrases,
  respostaDeterminantes,
  respostaObservar,
  respostaSistema,
  respostaSociedade,
  textoFrequenciaConjunta,
  textoLinhaEstado,
  trechosEstado,
} from "@/lib/energia/visao";

/**
 * Visão geral (P004 a P007): o resumo de poucos minutos do sistema elétrico, lido de
 * public/energia/gold/sintese.json (módulo `visao`, pipeline/energia/modulos/visao.py).
 * Quatro painéis numa página só (seção 9.1 da especificação), cada um com a anatomia da
 * seção 7.2: pergunta, resposta curta derivada da gold, recorte, visual com referência,
 * tabela equivalente nos modos Analisar e Auditar, "Comprove este número", downloads,
 * link compartilhável e a próxima pergunta. Nenhum número é recalculado aqui; frases e
 * alertas vêm de regras fixas do pipeline, e cada um leva à evidência.
 *
 * As âncoras da antiga página inicial (sistema, preco, agua, geracao, consumo, rede,
 * observar e as variantes -painel) continuam válidas: sistema e observar são blocos desta
 * página; as demais caem nos cartões dos determinantes (ANCORAS_DETERMINANTES).
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Visão geral: o que está acontecendo no sistema elétrico",
  description:
    "O sistema elétrico brasileiro em poucos minutos: seis fatos com evidência e data própria, preço, água, geração, carga e rede alinhados pelo calendário, custo e qualidade para o consumidor com o período de cada número, e as regras que dizem o que observar, com limiar, duração e histórico.",
  alternates: { canonical: "/setor-eletrico/visao-geral" },
};

const P = Object.fromEntries(PAINEIS_VISAO.map((p) => [p.id, p])) as Record<(typeof PAINEIS_VISAO)[number]["id"], (typeof PAINEIS_VISAO)[number]>;

/** Título de um painel: código, rótulo e a pergunta da especificação. */
function TituloPainel({ id }: { id: keyof typeof P }) {
  const p = P[id];
  return (
    <div className="mb-5">
      <p className="rotulo flex items-center gap-3 text-mineral">
        <span className="font-serif text-lg normal-case tracking-normal text-energia">{p.codigo}</span>
        {p.rotulo}
      </p>
      <h2 id={`${id}-h`} className="mt-2 max-w-3xl font-serif text-2xl leading-snug text-carvao md:text-3xl">
        {p.pergunta}
      </h2>
    </div>
  );
}

function ComoLer({ comoLer, naoConcluir }: { comoLer: React.ReactNode; naoConcluir: React.ReactNode }) {
  return (
    <div className="grid gap-4 text-sm leading-relaxed text-carvao-muted md:grid-cols-2">
      <div>
        <p className="rotulo text-mineral">Como ler</p>
        <p className="mt-1">{comoLer}</p>
      </div>
      <div>
        <p className="rotulo text-mineral">O que não permite concluir</p>
        <p className="mt-1">{naoConcluir}</p>
      </div>
    </div>
  );
}

/** Itens do "O que observar": o resumo de cada regra montado no servidor; o detalhe é lido da gold ao abrir. */
function itensObservar(observar: readonly RegraObservar[]): ItemObservar[] {
  return observar.map((o, i) => ({
    id: o.id,
    titulo: o.titulo,
    tipo: o.tipo,
    assunto: o.assunto,
    estado: o.estado,
    rotuloEstado: ROTULO_ESTADO[o.estado] ?? o.estado,
    referencia: o.referencia,
    href: o.href,
    resumo: <VisaoRegraResumo o={o} caminho={`observar[${i}]`} />,
  }));
}

/** Regras com linha de estado publicada, comparáveis sobre o mesmo eixo de datas. */
function comparaveisObservar(observar: readonly RegraObservar[]): LinhaComparavel[] {
  return observar
    .filter((o) => o.linha_estado?.inicio && o.linha_estado.estados)
    .map((o) => ({ id: o.id, rotulo: o.titulo, trechos: trechosEstado(o.linha_estado), texto: textoLinhaEstado(o) ?? "" }));
}

/** Comparação inicial: as regras que pedem atenção hoje e, para completar quatro, as de sistema na ordem publicada. */
function padraoComparacao(observar: readonly RegraObservar[], comparaveis: readonly LinhaComparavel[]): string[] {
  const ids = new Set(comparaveis.map((c) => c.id));
  const atencao = observar.filter((o) => pedeAtencao(o) && ids.has(o.id)).map((o) => o.id);
  const sistema = observar.filter((o) => o.assunto === "sistema" && o.tipo === "regra" && ids.has(o.id) && !atencao.includes(o.id)).map((o) => o.id);
  return [...atencao, ...sistema].slice(0, 4);
}

export default function VisaoGeralEnergia() {
  const g = lerGold<SinteseVisaoGold>("sintese.json");
  if (!integra(g)) return <VisaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const refs = referenciasFrases(g.frases);
  const m = g.multiplos;
  const datasRef = m ? Object.values(m.datas_referencia).filter((d): d is string => !!d).sort() : [];
  const titulosRegras = Object.fromEntries(g.observar.map((o) => [o.id, o.titulo]));
  const itens = itensObservar(g.observar);
  const comparaveis = comparaveisObservar(g.observar);
  const dominio = dominioEstados(g.observar);
  const regras = g.observar.filter((o) => o.tipo !== "evento");
  const emAlerta = regras.filter((o) => o.ativo);
  const fonteTabelas = `Scrutiniums, gold sintese.json gerada em ${carimbo(g.gerado_em)} a partir das bases publicadas de origem`;
  const dlPor = (parte: string) => g.downloads.filter((d) => d.url.includes(parte));
  const freq = textoFrequenciaConjunta(g);
  const revisoesOperacao = g.revisoes.operacao ?? [];
  const totalRevisoes = revisoesOperacao.reduce((s, r) => s + (r.revisoes ?? 0), 0);
  const materiais = revisoesOperacao.reduce((s, r) => s + (r.materiais_em_series_usadas ?? 0), 0);

  return (
    <>
      <CabecalhoEnergia atual="visao-geral" />
      <MarcaVisita secao="energia:visao-geral" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo siglas={["PLD", "MWmed", "FEC", "DEC"]}
          rotulo="Visão geral"
          titulo={PAGINAS_MAPA["visao-geral"].pergunta}
          referencia={
            <>
              Processado em {dataBR(g.data_processamento)} (data civil de Brasília). Cada número usa a data de referência da sua fonte: fatos de {refs ? `${dataBR(refs.min)} a ${dataBR(refs.max)}` : "sem data"};
              determinantes até {datasRef.length ? `${dataBR(datasRef[0])} a ${dataBR(datasRef[datasRef.length - 1])}` : "sem data"}; indicadores de energia e sociedade com período próprio (vigência, ano ou mês).
            </>
          }
        >
          O <Termo slug="sin">Sistema Interligado Nacional</Termo> em poucos minutos, em quatro painéis: os fatos de hoje com a evidência de cada número, os cinco determinantes lado a lado, o que chega ao consumidor
          em custo e qualidade, e as regras que dizem o que observar. Tudo lido das bases publicadas dos módulos de origem; o que não está integrado aparece como ausência, nunca como estimativa.
        </CabecalhoModulo>
        <VisaoNavegacao />

        <ModoProfundidade>
          {/* P004 */}
          <Bloco id="sistema">
            <section aria-labelledby="sistema-h" className="space-y-5">
              <TituloPainel id="sistema" />
              <VisaoResposta painel="sistema">{respostaSistema(g)}</VisaoResposta>
              <VisaoRecorte
                periodo={refs ? (refs.min === refs.max ? dataBR(refs.min) : `${dataBR(refs.min)} a ${dataBR(refs.max)}, uma data por frase`) : "sem data"}
                universo="Sistema Interligado Nacional; carga e intercâmbio por subsistema, PLD por submercado"
                unidade="Cada frase na unidade da sua fonte (% da EAR máxima, % da MLT, MWmed, % da geração, R$/MWh)"
              />
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
                <div className="min-w-0">
                  {g.frases.length ? (
                    <VisaoFrases frases={g.frases} />
                  ) : (
                    <VisaoAviso tipo="alerta">Nenhuma frase pôde ser escrita nesta publicação: faltam os dados de origem.</VisaoAviso>
                  )}
                  {g.frases_ausentes.length > 0 && (
                    <p className="mt-3 text-xs text-carvao-muted">Sem frase nesta publicação: {g.frases_ausentes.join(", ")}.</p>
                  )}
                </div>
                <VisaoDestaques destaques={g.destaques} fatosEHipoteses={g.fatos_e_hipoteses} titulos={titulosRegras} />
              </div>
              <ComoLer
                comoLer="Cada frase é um fato de um indicador, montado por um modelo fixo a partir de números da base publicada de origem; o trecho sublinhado leva ao painel que publica o número e o botão de prova refaz o cálculo por outro caminho. A caixa de destaques só mostra regras sobre o sistema confirmadas há poucos dias; vazia é o normal."
                naoConcluir="As frases descrevem o estado de cada indicador na sua data, não a relação entre eles: reservatório, afluência, carga, térmicas, preço e rede não são apresentados como explicação uns dos outros. Hipóteses, quando aparecem, estão rotuladas e não foram testadas nesta página."
              />
              <VisaoAnalise titulo="As frases como tabela: referência, defasagem, atualidade e revisões" id="sistema-tabela">
                <TabelaInterativa
                  titulo="Frases da síntese"
                  colunas={COLUNAS_FRASES}
                  linhas={linhasFrases(g.frases)}
                  chaveLinha="id"
                  colunaRotulo="indicador"
                  fonte={fonteTabelas}
                  versao={g.data_processamento}
                  nomeArquivo="visao-geral-frases"
                  chaveUrl="p004.t"
                  nota="Mesmas frases da lista acima, na mesma ordem; a defasagem é contada até a data de processamento."
                />
              </VisaoAnalise>
              <VisaoAuditoria titulo="Reprodução das frases: valores, caminhos e versões" id="sistema-auditoria">
                <p className="text-sm leading-relaxed text-carvao-muted">
                  Cada frase é refeita a cada publicação a partir do par modelo e valores; se a frase refeita diferir da publicada, a gold vira stub e a última publicação válida é mantida. Os valores abaixo são os da base publicada de origem, com o caminho de cada um.
                </p>
                <VisaoTabelasSobDemanda conjunto="sistema-auditoria" fonte={fonteTabelas} versao={g.data_processamento} downloads={dlPor("sintese_revisoes")} />
                <p className="text-sm leading-relaxed text-carvao-muted">
                  Revisões entre capturas nas séries desta página: {num(totalRevisoes, 0)} {totalRevisoes === 1 ? "referência revisada" : "referências revisadas"} nos conjuntos de operação,{" "}
                  {materiais === 0 ? "nenhuma material nas séries usadas" : `${num(materiais, 0)} ${materiais === 1 ? "material" : "materiais"} nas séries usadas`}. {g.revisoes.regra_material}
                </p>
                <p className="rotulo text-mineral">Controles desta publicação</p>
                <VisaoControles controles={g.validacao} />
              </VisaoAuditoria>
              <VisaoSeguir ancora="sistema" proximo={{ href: "#determinantes", pergunta: P.determinantes.pergunta }} downloads={[...dlPor("sintese_revisoes")]} />
            </section>
          </Bloco>

          {/* P005 */}
          <Bloco id="determinantes">
            <section aria-labelledby="determinantes-h" className="space-y-5">
              <TituloPainel id="determinantes" />
              {m ? (
                <>
                  <VisaoResposta painel="determinantes">
                    <ul className="space-y-1.5">
                      {respostaDeterminantes(m).map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </VisaoResposta>
                  <VisaoRecorte
                    periodo={`${dataBR(m.janela.inicio)} a ${dataBR(m.janela.fim)} (${plural(m.janela.dias, "dia", "dias")} alinhados pelo calendário); cada painel termina na sua data de referência`}
                    universo="PLD por submercado; EAR e carga do SIN; participação térmica do SIN em 7 dias; intercâmbio nas fronteiras do ONS"
                    unidade={m.paineis.map((p) => `${p.titulo.toLowerCase()} em ${p.unidade}`).join("; ")}
                  />
                  <VisaoAviso tipo="alerta">{m.aviso_datas}</VisaoAviso>
                  <VisaoDeterminantes m={m} ancoras={ANCORAS_DETERMINANTES} fonte={fonteTabelas} />
                  <ComoLer
                    comoLer="Cinco gráficos pequenos sobre o mesmo calendário, cada um com a sua referência de comparação: faixa histórica do dia para a água, quartis para o preço e a participação térmica, o mesmo dia da semana do ano anterior para a carga, o zero para o sentido do fluxo. Os valores são copiados das bases publicadas de origem, célula a célula, sem recálculo."
                    naoConcluir="Alinhar os painéis pelo calendário não afirma que um determina o outro. Fluxo alto na rede não indica congestionamento: os limites de intercâmbio não estão integrados. Dia em branco é dia sem valor na origem, nunca zero."
                  />
                  <p className="text-xs leading-relaxed text-carvao-muted">Regra do painel: {m.regra}</p>
                </>
              ) : (
                <VisaoAviso tipo="alerta">Os determinantes alinhados não foram publicados nesta execução: o bloco multiplos da gold está ausente; os painéis de origem continuam disponíveis nos módulos.</VisaoAviso>
              )}
              <VisaoSeguir ancora="determinantes" proximo={{ href: "#sociedade", pergunta: P.sociedade.pergunta }} downloads={m?.download ?? []} />
            </section>
          </Bloco>

          {/* P006 */}
          <Bloco id="sociedade">
            <section aria-labelledby="sociedade-h" className="space-y-5">
              <TituloPainel id="sociedade" />
              <VisaoResposta painel="sociedade">{respostaSociedade(g.sociedade)}</VisaoResposta>
              <VisaoRecorte
                periodo="Vigência, ano completo ou mês de referência, conforme o indicador; nenhum descreve o dia"
                universo="Distribuidoras e consumidores do país, no universo de cada conjunto da ANEEL"
                unidade="R$/kWh, horas e interrupções por consumidor, % da energia injetada, unidades consumidoras"
              />
              <VisaoAviso>
                Estes números têm período próprio e defasagem própria: uma tarifa vale pela vigência, continuidade e perdas valem pelo ano completo, o alcance da Tarifa Social vale pelo mês publicado. A linha do tempo abaixo mostra o período de cada um contra a data de processamento.
              </VisaoAviso>
              <VisaoSociedadeCartoes s={g.sociedade} />
              {g.sociedade.ausentes.length > 0 && (
                <ul className="space-y-1 text-sm text-carvao-muted">
                  {g.sociedade.ausentes.map((a) => (
                    <li key={a.id}>Sem dado para {a.id}: {a.motivo}</li>
                  ))}
                </ul>
              )}
              <VisaoLinhaTempo s={g.sociedade} dataProcessamento={g.data_processamento} />
              <ComoLer
                comoLer="Cada cartão traz o valor e a evidência do módulo de origem, o período a que o número se refere, a defasagem até o processamento, a cobertura e a atualidade do conjunto. Conjunto atrasado no painel de saúde dos dados aparece marcado."
                naoConcluir="Um ano completo ou um mês de referência não descreve a situação de hoje, e indicadores de universos diferentes (todas as distribuidoras, um conjunto de concessionárias, as unidades com Tarifa Social) não se somam nem se comparam entre si."
              />
              <VisaoAnalise titulo="Os indicadores como tabela: período, defasagem, cobertura e atualidade" id="sociedade-tabela">
                <TabelaInterativa
                  titulo="Energia e sociedade"
                  colunas={COLUNAS_SOCIEDADE}
                  linhas={linhasSociedade(g.sociedade)}
                  chaveLinha="id"
                  colunaRotulo="indicador"
                  fonte={fonteTabelas}
                  versao={g.data_processamento}
                  nomeArquivo="visao-geral-sociedade"
                  chaveUrl="p006.t"
                  nota="Valor e texto exibido copiados do módulo de origem, sem recálculo; o período é o do indicador, não o do processamento."
                />
                <p className="text-xs leading-relaxed text-carvao-muted">Regra do painel: {g.sociedade.regra}</p>
              </VisaoAnalise>
              <VisaoSeguir ancora="sociedade" proximo={{ href: "#observar", pergunta: P.observar.pergunta }} downloads={[]} />
            </section>
          </Bloco>

          {/* P007 */}
          <Bloco id="observar">
            <section aria-labelledby="observar-h" className="space-y-5">
              <TituloPainel id="observar" />
              <VisaoResposta painel="observar">{respostaObservar(g.observar)}</VisaoResposta>
              <VisaoRecorte
                periodo={`Estado do dia na data de referência de cada regra; linha de estado dos últimos 365 dias; histórico reavaliado desde ${dataBR(g.historico_regras.inicio)} com os dados de hoje`}
                universo={`${plural(regras.length, "regra", "regras")} sobre o sistema e sobre os próprios dados, e ${plural(g.observar.length - regras.length, "evento de calendário", "eventos de calendário")}`}
                unidade="Cada regra na unidade do indicador que avalia; limiares publicados na mesma unidade"
              />
              {g.observar_sem_dado.length > 0 && (
                <VisaoAviso tipo="alerta">Sem dado para avaliar nesta publicação: {g.observar_sem_dado.map((x) => `${titulosRegras[x.id] ?? x.id} (${x.motivo})`).join("; ")}.</VisaoAviso>
              )}
              <VisaoObservar itens={itens} comparaveis={comparaveis} padraoComparacao={padraoComparacao(g.observar, comparaveis)} dominio={dominio} />
              <ComoLer
                comoLer="Cada regra tem condição, limiar, duração mínima para confirmar o alerta e regra de retorno à normalidade; o estado do dia vem com o valor avaliado e os limiares, e a linha de estado mostra os últimos 365 dias. Em alerta sobre os dados significa que a própria publicação pede cautela (fonte atrasada, PLD sem atualização, revisão material)."
                naoConcluir={`Um alerta descreve uma condição e nunca atribui causa. ${g.historico_regras.falso_alarme}`}
              />
              <VisaoAnalise titulo="Frequência de disparo, sensibilidade e episódios" id="observar-historico">
                {freq && <p className="text-sm leading-relaxed text-carvao-muted">{freq}</p>}
                <VisaoTabelasSobDemanda conjunto="observar-analise" fonte={fonteTabelas} versao={g.data_processamento} downloads={[...dlPor("sintese_regras_diario"), ...dlPor("sintese_episodios")]} />
              </VisaoAnalise>
              <VisaoAuditoria titulo="Registro das publicações, alertas não confirmados e origem das golds" id="observar-auditoria">
                <p className="text-sm leading-relaxed text-carvao-muted">
                  O histórico das regras começa em {dataBR(g.historico_regras.inicio)}. {g.historico_regras.regra}
                </p>
                {g.alertas_nao_confirmados.length > 0 ? (
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {g.alertas_nao_confirmados.map((a, i) => (
                      <li key={i} className="[overflow-wrap:anywhere]">{JSON.stringify(a)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-carvao-muted">Nenhum alerta publicado deixou de se confirmar depois de revisão da fonte, entre as publicações registradas.</p>
                )}
                <p className="text-sm leading-relaxed text-carvao-muted">
                  {emAlerta.length ? `Em alerta nesta publicação: ${emAlerta.map((o) => o.titulo).join("; ")}.` : "Nenhuma regra em alerta nesta publicação."} Publicação anterior registrada nesta execução:{" "}
                  {g.historico_regras.registro_publicacoes?.publicacao_anterior_registrada_nesta_execucao ? "sim" : "não"}.
                </p>
                <p className="rotulo text-mineral">Golds lidas nesta publicação</p>
                <ul className="space-y-1 text-xs leading-relaxed text-carvao-muted">
                  {g.origens.map((o) => (
                    <li key={o.gold} className="[overflow-wrap:anywhere]">
                      {o.gold}: {o.disponivel ? `gerada em ${carimbo(o.gerado_em)}` : "indisponível"}
                      {o.versao_codigo ? `, código ${o.versao_codigo}` : ""}; {o.origem}; lida em {carimbo(o.lida_em)}
                      {o.idade_horas !== null && o.idade_horas !== undefined ? ` (${num(o.idade_horas, 1)} h de idade)` : ""}.
                    </li>
                  ))}
                </ul>
              </VisaoAuditoria>
              <VisaoSeguir ancora="observar" proximo={{ href: PAGINAS_MAPA.pld.href, pergunta: PAGINAS_MAPA.pld.pergunta }} downloads={[...dlPor("sintese_regras_diario"), ...dlPor("sintese_episodios")]} />
            </section>
          </Bloco>
        </ModoProfundidade>

        <footer className="mt-10 space-y-4 border-t border-linha pt-6 text-sm leading-relaxed text-carvao-muted">
          <p>{g.nota}</p>
          <div>
            <p className="rotulo text-mineral">Limitações desta publicação</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {g.limitacoes.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
          <p>
            Gold {g.gold}, versão {g.versao_pipeline} (código {g.versao_codigo}), gerada em {carimbo(g.gerado_em)}.{" "}
            <Link href="/setor-eletrico/metodologia#sintese" className="text-energia-dark underline underline-offset-4">Regras das frases e dos alertas</Link>
            {" · "}
            <Link href="/setor-eletrico/dados" className="text-energia-dark underline underline-offset-4">Dados e catálogo</Link>
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {g.downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </footer>
      </main>
    </>
  );
}
