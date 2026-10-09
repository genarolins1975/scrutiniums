import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { PldCmo } from "@/components/energia/PldCmo";
import { PldAviso, PldControles, PldIndisponivel, PldNavegacao, PldPassagem, PldSeguir } from "@/components/energia/PldPagina";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, num, reais } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_COBERTURA,
  NOME_SM,
  SUBMERCADOS,
  atualidadePld,
  linhasCobertura,
  marcosSemanais,
  notaHorasEntreLimites,
  perguntaPainel,
  proximoPainel,
  partesDistanciaSemanal,
} from "@/lib/energia/pld";
import { fichasPld, horarioRecentePld } from "@/lib/energia/pld-arquivos";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { PldDetalheGold } from "@/lib/energia/tipos-pld";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "PLD: CMO e formação de preço",
  description:
    "CMO semanal do DECOMP, CMO semi-horário do DESSEM e PLD horário como três produtos separados, alinhados na mesma semana operativa e na mesma hora, com o momento do cálculo de cada um, a relação por ano e a sequência de CMO zero conferida no arquivo original.",
  alternates: { canonical: "/setor-eletrico/pld/cmo-e-formacao" },
};

const FONTE = "ONS, CMO Semanal (DECOMP) e CMO Semi-Horário (DESSEM); CCEE, PLD horário por submercado";

const COLUNAS_CONVENCAO: ColunaTabela[] = [
  { id: "sm", rotulo: "Submercado", tipo: "texto" },
  { id: "semanas", rotulo: "Semanas comparadas", tipo: "numero", casas: 0 },
  { id: "corr_fim", rotulo: "Correlação com a semana que termina na data", tipo: "numero", casas: 3 },
  { id: "corr_seg", rotulo: "Correlação com a semana seguinte", tipo: "numero", casas: 3 },
  { id: "horas", rotulo: "Horas na conferência da meia hora", tipo: "numero", casas: 0 },
  { id: "erro_ini", rotulo: "Erro médio, instante = início", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "erro_fim", rotulo: "Erro médio, instante = fim", tipo: "numero", unidade: "R$/MWh", casas: 2 },
];

const COLUNAS_SEQUENCIAS: ColunaTabela[] = [
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "inicio", rotulo: "Primeira semana (sexta)", tipo: "data" },
  { id: "fim", rotulo: "Última semana (sexta)", tipo: "data" },
  { id: "semanas", rotulo: "Semanas", tipo: "numero", casas: 0 },
];

const COLUNAS_A02_ARQUIVOS: ColunaTabela[] = [
  { id: "recurso", rotulo: "Arquivo", tipo: "texto" },
  { id: "formas", rotulo: "Forma do zero no texto", tipo: "texto" },
  { id: "semanas", rotulo: "Semanas da sequência no arquivo", tipo: "numero", casas: 0 },
  { id: "zeradas", rotulo: "Linhas zeradas", tipo: "numero", casas: 0 },
  { id: "esperadas", rotulo: "Linhas esperadas", tipo: "numero", casas: 0 },
  { id: "parquet", rotulo: "Células iguais ao Parquet oficial", tipo: "texto" },
  { id: "sha256", rotulo: "sha256 do CSV", tipo: "texto" },
];

export default function PldCmoPage() {
  const g = lerGold<PldDetalheGold>("pld_detalhe.json");
  if (!integra(g)) return <PldIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const c = g.cmo_pld;
  const a02 = g.achados.A02;
  const a03 = g.achados.A03;
  const fichas = fichasPld(g.evidencias.arquivo, [...SUBMERCADOS.flatMap((sm) => [`pld_semana_${sm}`, `dessem_semana_${sm}`]), "a02_zeros"]);
  const rec = horarioRecentePld(g.horario_recente.url);
  const horario = rec ? { t: rec.t, pld: rec.pld, cmo: rec.cmo_dessem } : null;
  const marcos = marcosSemanais(a02, c.semanal.fim);
  const atual = atualidadePld(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const fontesPorId = new Map(g.conceito.fontes_textuais.map((f) => [f.id, f]));
  const ref = c.semana_referencia;
  const controles = g.controles.filter((x) => /CMO|meia hora|semanal|Equival|S3/i.test(x.nome));
  const downloads = g.downloads.filter((d) => /cmo_semanal|cmo_horario|horario_recente/.test(d.url));
  const n = c.semanal.fim.length;
  const limitesDisponiveis = g.limites.disponivel ? g.limites : null;
  const notasEntreLimites = Object.fromEntries(SUBMERCADOS.map((sm) => [sm, notaHorasEntreLimites(c, limitesDisponiveis, sm)]));
  const distanciaSemanal = partesDistanciaSemanal(ref);
  const seqZeros = a02.sequencia_comum_mais_longa;
  const notaMarcos = seqZeros ? (
    <>
      A marca vertical indica a maior sequência, comum aos quatro subsistemas, de semanas seguidas com CMO semanal zero publicado pelo ONS: {num(seqZeros.semanas, 0)} semanas, de{" "}
      {dataBR(seqZeros.inicio)} a {dataBR(seqZeros.fim)} (datas das sextas-feiras que encerram as semanas). A fonte não informa o motivo dos zeros, e esta página não atribui causa.
    </>
  ) : null;
  // os quatro submercados da semana de referência lado a lado, com a distância entre eles escrita
  const quatroSubmercados = ref ? (
    <SecaoDoPainel id="quatro-submercados" titulo="Os quatro submercados na mesma semana" lead={`Semana operativa de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)}, em R$/MWh nominais.`}>
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Os três valores da semana de referência nos quatro submercados (tabela rolável)">
        <table className="w-full border-collapse text-sm tabular-nums sm:min-w-[28rem]">
          <caption className="sr-only">CMO semanal do DECOMP, média do CMO do DESSEM e média do PLD na semana de referência, por submercado, R$/MWh</caption>
          <thead>
            <tr className="border-b border-linha text-left text-xs text-mineral">
              <th scope="col" className="py-2 pr-3 font-normal">Submercado</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">CMO semanal (DECOMP)</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">Média do DESSEM</th>
              <th scope="col" className="py-2 text-right font-normal">Média do PLD</th>
            </tr>
          </thead>
          <tbody>
            {ref.por_sm.map((x) => (
              <tr key={x.sm} className="border-b border-linha">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">{NOME_SM[x.sm]}</th>
                <td className="py-2 pr-3 text-right">{reais(x.decomp)}</td>
                <td className="py-2 pr-3 text-right">{reais(x.dessem)}</td>
                <td className="py-2 text-right">{reais(x.pld)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {distanciaSemanal && (
        <div className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="distancia-semanal">
          <p className="text-carvao">{distanciaSemanal.introducao}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {distanciaSemanal.itens.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mt-2">{distanciaSemanal.ressalva}</p>
        </div>
      )}
    </SecaoDoPainel>
  ) : null;

  const oQueMudou = (
    <>
      {atual.texto}{" "}
      {ref ? `A semana de referência é a última semana operativa completa nos três produtos (${dataBR(ref.inicio)} a ${dataBR(ref.fim)}).` : "Nenhuma semana completa nos três produtos."}
    </>
  );
  const comoInterpretar = (
    <>
      O CMO é o custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no sistema interligado. Compare só o que está no mesmo intervalo: o valor
      semanal do DECOMP contra as médias do DESSEM (336 meias horas) e do PLD (168 horas) da mesma semana de sábado a sexta; o PLD de uma hora contra o CMO do DESSEM da mesma hora. O
      DECOMP é um valor do modelo para a semana inteira, não uma média de horas. As diferenças são escritas em R$/MWh, nunca como razão.
    </>
  );
  const naoConcluir = (
    <>
      Os dados não dizem por que o PLD difere do CMO: os conjuntos do ONS não identificam deck, versão nem revisão do modelo de cada valor, e a descrição pública da CCEE não
      detalha a configuração da sua execução. Diferença entre produtos não é erro de nenhum deles. No piso e nos tetos, o PLD é o limite do ato e a diferença mede o limite.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["CMO", "ONS", "CCEE"]}
          rotulo="Preço de Liquidação das Diferenças"
          titulo={perguntaPainel("p009")}
          lead={
            <>
              O <Termo slug="cmo">custo marginal de operação</Termo> (CMO) que o ONS publica por semana (modelo <Termo slug="decomp">DECOMP</Termo>) e por meia hora (modelo{" "}
              <Termo slug="dessem">DESSEM</Termo>) e o PLD que a CCEE calcula para cada hora: três produtos diferentes, comparados só no mesmo intervalo.
            </>
          }
          recorte={ref ? `semana operativa de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)} · quatro submercados · R$/MWh nominais` : "quatro submercados · R$/MWh nominais"}
          fonte="ONS (CMO) e CCEE (PLD)"
          referencia={
            <>
              ONS (CMO semanal até a semana de {dataBR(g.referencia.ultima_semana_decomp)}; CMO semi-horário até {horaLocal(g.referencia.ultima_meia_hora_cmo)}) e CCEE (PLD até{" "}
              {horaLocal(g.referencia.ultima_hora_pld)}); processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          O <Termo slug="cmo">custo marginal de operação</Termo> (CMO) é o custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no
          sistema interligado; segundo a CCEE, é a base do PLD. O ONS publica dois CMOs: o do modelo <Termo slug="decomp">DECOMP</Termo>, por semana operativa, e o do modelo{" "}
          <Termo slug="dessem">DESSEM</Termo>, por meia hora e para cada barra do sistema. A CCEE calcula o PLD de cada hora com os próprios processamentos. Esta página põe os
          três valores lado a lado, só no mesmo intervalo.
        </CabecalhoModulo>
        <PldNavegacao atual="p009" />
        <ModoProfundidade>
          <Bloco id="cmo-e-formacao">
            <PainelEvidencia
              id="p009"
              pergunta="Os três valores na mesma semana operativa"
              subtitulo="CMO semanal do DECOMP, CMO do DESSEM e PLD na mesma semana operativa e na mesma hora · R$/MWh"
              porQueImporta={
                <>
                  Pela norma, o PLD tem como base o custo marginal de operação e é limitado por piso e tetos. Ver o quanto o PLD se afasta do CMO publicado pelo ONS, no mesmo
                  intervalo, mostra o que a série pública do operador permite (e o que não permite) dizer sobre a formação do preço.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.comparacao_semanal}
              complementares={[
                { rotulo: "Sobre o CMO semi-horário (DESSEM)", p: g.proveniencia.cmo_semi_horario },
                { rotulo: "Sobre o CMO na hora", p: g.proveniencia.cmo_horario },
                { rotulo: "Sobre a relação por ano", p: g.proveniencia.relacao_pld_cmo },
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <PldAviso tipo="alerta">{atual.texto}</PldAviso>}
                <PldCmo
                  c={{ semanal: c.semanal, semana_referencia: c.semana_referencia, relacao_anual: c.relacao_anual }}
                  horario={horario}
                  marcos={marcos}
                  fichas={fichas}
                  fonte={FONTE}
                  versao={versao}
                  notasEntreLimites={notasEntreLimites}
                  quatroSubmercados={quatroSubmercados}
                  notaMarcos={notaMarcos}
                  regimes={limitesDisponiveis?.regimes ?? []}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  avisoGrafico={
                    <PldAviso>
                      O gráfico tem as últimas {num(n, 0)} semanas; o CSV semanal tem as {num(c.semanal_recorte.semanas_no_csv, 0)} desde 2021.
                      <span data-nivel="analisar">
                        {" "}
                        O CSV foi conferido célula a célula contra a base publicada ({num(c.equivalencia_csv.celulas, 0)} células, {num(c.equivalencia_csv.divergentes, 0)} divergentes).
                      </span>
                    </PldAviso>
                  }
                />

                <SecaoDoPainel id="nao-equivalencia" titulo="O que diferencia o CMO do DECOMP, o CMO do DESSEM e o PLD?">
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao" data-textos="nao-equivalencia">
                    {c.nao_equivalencia.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel id="produtos" titulo="Três produtos, três momentos de cálculo" nivel="analisar">
                  <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
                    {c.produtos.map((p) => (
                      <article key={p.id} className="min-w-0 border-l-2 border-linha pl-4 text-sm [overflow-wrap:anywhere]">
                        <h4 className="font-serif text-lg text-carvao">{p.rotulo}</h4>
                        <p className="mt-1 text-xs text-mineral">
                          {p.orgao}; modelo: {p.modelo}
                        </p>
                        <dl className="mt-3 space-y-2 text-carvao-muted">
                          <div>
                            <dt className="rotulo text-mineral">Intervalo de cada valor</dt>
                            <dd className="text-carvao">{p.resolucao}</dd>
                          </div>
                          <div>
                            <dt className="rotulo text-mineral">Grão geográfico</dt>
                            <dd>{p.grao_geografico}</dd>
                          </div>
                          <div>
                            <dt className="rotulo text-mineral">Quando é calculado</dt>
                            <dd>{p.momento_do_calculo ?? `Não conferido: ${p.momento_do_calculo_motivo ?? "sem motivo publicado"}`}</dd>
                          </div>
                          <div>
                            <dt className="rotulo text-mineral">Unidade no dicionário</dt>
                            <dd>
                              {p.unidade_no_dicionario ?? "não informada"}
                              {p.unidade_patamares_no_dicionario ? `; patamares em ${p.unidade_patamares_no_dicionario}` : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="rotulo text-mineral">Deck e versão</dt>
                            <dd>{p.deck_versao}</dd>
                          </div>
                        </dl>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                          Conjunto de dados
                        </a>
                      </article>
                    ))}
                  </div>
                </SecaoDoPainel>

                <SecaoDoPainel id="a02" titulo="A sequência de semanas com CMO semanal igual a zero" nivel="analisar">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-textos="a02">
                    {a02.texto ?? `Situação: ${a02.status}.`}
                  </p>
                  {fichas.a02_zeros && (
                    <p className="text-sm">
                      <ComproveNumero evidencia={fichas.a02_zeros} endereco="/setor-eletrico/pld/cmo-e-formacao#a02" />
                    </p>
                  )}
                  {a02.observacao_formato && <p className="text-xs text-carvao-muted">{a02.observacao_formato}</p>}
                  <TabelaInterativa
                    titulo="Sequências de 4 semanas seguidas ou mais com CMO semanal zero, por subsistema (desde 2005)"
                    colunas={COLUNAS_SEQUENCIAS}
                    linhas={SUBMERCADOS.flatMap((sm) => a02.sequencias_por_sm[sm].map((s) => ({ id: `${sm}:${s.inicio}`, sm: NOME_SM[sm], inicio: s.inicio, fim: s.fim, semanas: s.semanas })))}
                    chaveLinha="id"
                    colunaRotulo="inicio"
                    fonte="ONS, CMO Semanal (DECOMP), arquivos originais"
                    versao={versao}
                    nomeArquivo="pld-a02-sequencias"
                    chaveUrl="a02"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="a02-arquivos" titulo="Os zeros no arquivo original do ONS" nivel="auditar">
                  <TabelaInterativa
                    titulo="Arquivos anuais do CMO semanal relidos (CSV e Parquet oficiais)"
                    colunas={COLUNAS_A02_ARQUIVOS}
                    linhas={a02.arquivos.map((f) => ({
                      id: f.recurso,
                      recurso: f.recurso,
                      formas: f.formas_do_zero.join(", "),
                      semanas: f.semanas_no_trecho,
                      zeradas: f.linhas_zeradas_no_trecho,
                      esperadas: f.linhas_esperadas_no_trecho,
                      parquet: f.parquet.celulas !== null ? `${num(f.parquet.celulas_iguais, 0)} de ${num(f.parquet.celulas, 0)}` : (f.parquet.erro ?? "sem conferência"),
                      sha256: f.sha256,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="recurso"
                    fonte="ONS, CMO Semanal (DECOMP)"
                    versao={versao}
                    nomeArquivo="pld-a02-arquivos"
                  />
                  <p className="text-sm text-carvao-muted">
                    A base publicada pelo observatório contra a releitura do arquivo original: {num(a02.reconciliacao_silver_principal.iguais, 0)} semanas-subsistema iguais,{" "}
                    {num(a02.reconciliacao_silver_principal.diferentes, 0)} diferentes. {a02.reconciliacao_silver_principal.nota}
                  </p>
                  {a02.dicionario_permite && (
                    <p className="text-sm text-carvao-muted">
                      Dicionário do ONS (PDF): {Object.entries(a02.dicionario_permite).map(([campo, p]) => `${campo} ${p.zerado ? "admite zero" : "não admite zero"}`).join("; ")}.
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="a03" titulo="Unidade do CMO semanal" nivel="auditar">
                  <p className="text-sm leading-relaxed text-carvao">{a03.decisao}</p>
                  <p className="text-sm text-carvao-muted">
                    Dicionário: média semanal em {a03.unidade_media_semanal_no_dicionario ?? "unidade não informada"}; patamares em {a03.unidade_patamares_no_dicionario ?? "unidade não informada"};
                    semi-horário em {a03.unidade_semi_horario_no_dicionario ?? "unidade não informada"}. {a03.verificacao.leitura} ({num(a03.verificacao.media_entre_min_e_max_dos_patamares, 0)}{" "}
                    de {num(a03.verificacao.semanas_subsistema, 0)} semanas-subsistema).
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="alinhamento" titulo="Alinhamento: convenções conferidas nos dados" nivel="auditar">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    <li>{c.alinhamento.hora}</li>
                    <li>{c.alinhamento.semana}</li>
                    <li>{g.achados.A01.regra}</li>
                  </ul>
                  <TabelaInterativa
                    titulo="Conferência da data da semana e do instante da meia hora"
                    colunas={COLUNAS_CONVENCAO}
                    linhas={SUBMERCADOS.map((sm) => ({
                      id: sm,
                      sm: NOME_SM[sm],
                      semanas: c.alinhamento.convencao_semana[sm].semanas,
                      corr_fim: c.alinhamento.convencao_semana[sm].corr_semana_que_termina_na_data,
                      corr_seg: c.alinhamento.convencao_semana[sm].corr_semana_seguinte,
                      horas: c.alinhamento.convencao_meia_hora[sm].horas,
                      erro_ini: c.alinhamento.convencao_meia_hora[sm].erro_abs_medio_inicio,
                      erro_fim: c.alinhamento.convencao_meia_hora[sm].erro_abs_medio_fim,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte={FONTE}
                    versao={versao}
                    nomeArquivo="pld-convencoes"
                    nota={`Meia hora: ${c.alinhamento.convencao_meia_hora.SE.filtro}.`}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="cobertura" titulo="Cobertura do CMO semi-horário publicado pelo ONS" nivel="auditar">
                  <TabelaInterativa
                    titulo="Meias horas esperadas e publicadas por ano"
                    colunas={COLUNAS_COBERTURA}
                    linhas={linhasCobertura(g.cobertura.cmo_semi_horario)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte="ONS, CMO Semi-Horário (DESSEM)"
                    versao={versao}
                    nomeArquivo="pld-cobertura-dessem"
                    nota="Dia sem nenhuma meia hora publicada fica sem CMO na hora e fora das médias semanais; nunca é preenchido."
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="normas-produtos" titulo="Passagens que sustentam a descrição de cada produto" nivel="auditar">
                  {c.produtos.map((p) => (
                    <div key={p.id} className="space-y-2">
                      <p className="rotulo text-mineral">{p.rotulo}</p>
                      {p.fontes_normativas
                        .map((id) => fontesPorId.get(id))
                        .filter((f): f is NonNullable<typeof f> => !!f && !!f.texto)
                        .map((f) => (
                          <PldPassagem key={f.id} p={f} />
                        ))}
                    </div>
                  ))}
                </SecaoDoPainel>

                <SecaoDoPainel id="controles" titulo="Controles automáticos da construção" nivel="auditar">
                  <PldControles controles={controles} />
                </SecaoDoPainel>

                <PldSeguir ancora="p009" proximo={proximoPainel("p009")} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
