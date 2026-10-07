import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { PldCmo } from "@/components/energia/PldCmo";
import {
  PldAnalise,
  PldAuditoria,
  PldAviso,
  PldCabecalho,
  PldControles,
  PldIndisponivel,
  PldNavegacao,
  PldPassagem,
  PldSeguir,
} from "@/components/energia/PldPagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_COBERTURA,
  NOME_SM,
  SUBMERCADOS,
  atualidadePld,
  linhasCobertura,
  marcosSemanais,
  perguntaPainel,
  proximoPainel,
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

const FONTE = "ONS, CMO Semanal (DECOMP) e CMO Semi-Horário (DESSEM); CCEE, PLD_HORARIO";

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

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <PldCabecalho siglas={["ONS", "ANEEL"]}
          titulo="CMO e formação de preço"
          referencia={
            <>
              ONS (CMO semanal até a semana de {dataBR(g.referencia.ultima_semana_decomp)}; CMO semi-horário até {horaLocal(g.referencia.ultima_meia_hora_cmo)}) e CCEE (PLD até{" "}
              {horaLocal(g.referencia.ultima_hora_pld)}); processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          O <Termo slug="cmo">custo marginal de operação</Termo> é a base do PLD, mas o ONS publica dois CMOs diferentes, um do <Termo slug="decomp">DECOMP</Termo> por semana
          operativa e outro do <Termo slug="dessem">DESSEM</Termo> por meia hora, e a CCEE calcula o PLD de cada hora com os próprios processamentos. Este painel põe os três
          lado a lado só no mesmo intervalo.
        </PldCabecalho>
        <PldNavegacao atual="p009" />
        <ModoProfundidade>
          <Bloco id="cmo-e-formacao">
            <PainelEvidencia
              id="p009"
              pergunta={perguntaPainel("p009")}
              subtitulo="CMO semanal do DECOMP, CMO do DESSEM e PLD na mesma semana operativa e na mesma hora · R$/MWh"
              porQueImporta={
                <>
                  Pela norma, o PLD tem como base o custo marginal de operação e é limitado por piso e tetos. Ver o quanto o PLD se afasta do CMO publicado pelo ONS, no mesmo
                  intervalo, mostra o que a série pública do operador permite (e o que não permite) dizer sobre a formação do preço.
                </>
              }
              oQueMudou={
                <>
                  {atual.texto}{" "}
                  {ref ? `A semana de referência é a última semana operativa completa nos três produtos (${dataBR(ref.inicio)} a ${dataBR(ref.fim)}).` : "Nenhuma semana completa nos três produtos."}
                </>
              }
              comoInterpretar={
                <>
                  Compare só o que está no mesmo intervalo: o valor semanal do DECOMP contra as médias do DESSEM (336 meias horas) e do PLD (168 horas) da mesma semana de sábado
                  a sexta; o PLD de uma hora contra o CMO do DESSEM da mesma hora. O DECOMP é um valor do modelo para a semana inteira, não uma média de horas. As diferenças são
                  escritas em R$/MWh, nunca como razão.
                </>
              }
              naoConcluir={
                <>
                  Os dados não dizem por que o PLD difere do CMO: os conjuntos do ONS não identificam deck, versão nem revisão do modelo de cada valor, e a descrição pública
                  da CCEE não detalha a configuração da sua execução. Diferença entre produtos não é erro de nenhum deles. No piso e nos tetos, o PLD é o limite do ato e a
                  diferença mede o limite.
                </>
              }
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
                />
                <PldAviso>
                  O gráfico tem as últimas {num(n, 0)} semanas; o CSV semanal tem as {num(c.semanal_recorte.semanas_no_csv, 0)} desde 2021, conferido célula a célula contra a base publicada
                  ({num(c.equivalencia_csv.celulas, 0)} células, {num(c.equivalencia_csv.divergentes, 0)} divergentes).
                </PldAviso>

                <PldAnalise id="produtos" titulo="Três produtos, três momentos de cálculo">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {c.produtos.map((p) => (
                      <article key={p.id} className="min-w-0 border border-linha bg-superficie p-4 text-sm [overflow-wrap:anywhere]">
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
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao" data-textos="nao-equivalencia">
                    {c.nao_equivalencia.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </PldAnalise>

                <PldAnalise id="a02" titulo="A sequência de CMO semanal igual a zero (achado A02)">
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
                    titulo="Sequências de semanas com CMO semanal zero, por subsistema (desde 2005)"
                    colunas={COLUNAS_SEQUENCIAS}
                    linhas={SUBMERCADOS.flatMap((sm) => a02.sequencias_por_sm[sm].map((s) => ({ id: `${sm}:${s.inicio}`, sm: NOME_SM[sm], inicio: s.inicio, fim: s.fim, semanas: s.semanas })))}
                    chaveLinha="id"
                    colunaRotulo="inicio"
                    fonte="ONS, CMO Semanal (DECOMP), arquivos originais"
                    versao={versao}
                    nomeArquivo="pld-a02-sequencias"
                    chaveUrl="a02"
                  />
                </PldAnalise>

                <PldAuditoria id="a02-arquivos" titulo="A02: os zeros no arquivo original">
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
                    Silver principal contra a releitura do arquivo original: {num(a02.reconciliacao_silver_principal.iguais, 0)} semanas-subsistema iguais,{" "}
                    {num(a02.reconciliacao_silver_principal.diferentes, 0)} diferentes. {a02.reconciliacao_silver_principal.nota}
                  </p>
                  {a02.dicionario_permite && (
                    <p className="text-sm text-carvao-muted">
                      Dicionário do ONS (PDF): {Object.entries(a02.dicionario_permite).map(([campo, p]) => `${campo} ${p.zerado ? "admite zero" : "não admite zero"}`).join("; ")}.
                    </p>
                  )}
                </PldAuditoria>

                <PldAuditoria id="a03" titulo="Unidade do CMO semanal (achado A03)">
                  <p className="text-sm leading-relaxed text-carvao">{a03.decisao}</p>
                  <p className="text-sm text-carvao-muted">
                    Dicionário: média semanal em {a03.unidade_media_semanal_no_dicionario ?? "unidade não informada"}; patamares em {a03.unidade_patamares_no_dicionario ?? "unidade não informada"};
                    semi-horário em {a03.unidade_semi_horario_no_dicionario ?? "unidade não informada"}. {a03.verificacao.leitura} ({num(a03.verificacao.media_entre_min_e_max_dos_patamares, 0)}{" "}
                    de {num(a03.verificacao.semanas_subsistema, 0)} semanas-subsistema).
                  </p>
                </PldAuditoria>

                <PldAuditoria id="alinhamento" titulo="Alinhamento: convenções conferidas nos dados (achado A01)">
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
                </PldAuditoria>

                <PldAuditoria id="cobertura" titulo="Cobertura do CMO semi-horário publicado pelo ONS">
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
                </PldAuditoria>

                <PldAuditoria id="normas-produtos" titulo="Passagens que sustentam a descrição de cada produto">
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
                </PldAuditoria>

                <PldAuditoria id="controles" titulo="Controles automáticos da construção">
                  <PldControles controles={controles} />
                </PldAuditoria>

                <PldSeguir ancora="p009" proximo={proximoPainel("p009")} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
