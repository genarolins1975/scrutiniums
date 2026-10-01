import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CargaClima } from "@/components/energia/CargaClima";
import { CargaAnalise, CargaAuditoria, CargaAviso, CargaFontes, CargaIndisponivel, CargaNavegacao, CargaSeguir } from "@/components/energia/CargaPagina";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { NOME_REGIAO, REGIOES, ROTULO_GRUPO, listaTexto, perguntaPainel, rotaPainel } from "@/lib/energia/carga";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { CargaDetalheGold } from "@/lib/energia/tipos-carga";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Carga: clima e calendário",
  description:
    "Decomposição estatística da carga diária do SIN e dos subsistemas em calendário, temperatura, sazonalidade e tendência, estimada só com o passado e avaliada fora da amostra, com intervalos, resíduos, referência ingênua e sensibilidade. Associação, não causa.",
  alternates: { canonical: "/setor-eletrico/carga/clima-e-calendario" },
};

const FONTE = "Decomposição estatística do observatório sobre ONS (carga diária), NASA POWER (temperatura) e IBGE (população)";

const COLUNAS_COEF: ColunaTabela[] = [
  { id: "variavel", rotulo: "Variável", tipo: "texto" },
  { id: "grupo", rotulo: "Grupo", tipo: "texto", categorica: true },
  { id: "coeficiente", rotulo: "Coeficiente (log)", tipo: "numero", casas: 6 },
  { id: "ativa", rotulo: "Ativa no treino", tipo: "texto", categorica: true },
];
const COLUNAS_LEIS: ColunaTabela[] = [
  { id: "norma", rotulo: "Norma", tipo: "texto" },
  { id: "estabelece", rotulo: "Estabelece", tipo: "texto" },
  { id: "ementa", rotulo: "Ementa conferida no Senado", tipo: "texto", categorica: true },
  { id: "texto", rotulo: "Texto relido", tipo: "texto", categorica: true },
  { id: "situacao", rotulo: "Situação do texto", tipo: "texto" },
];
const COLUNAS_EVENTOS: ColunaTabela[] = [
  { id: "data", rotulo: "Data", tipo: "data" },
  { id: "nome", rotulo: "Evento", tipo: "texto" },
  { id: "categoria", rotulo: "Categoria", tipo: "texto", categorica: true },
];
const COLUNAS_PESOS: ColunaTabela[] = [
  { id: "regiao", rotulo: "Região", tipo: "texto", categorica: true },
  { id: "uf", rotulo: "UF", tipo: "texto" },
  { id: "capital", rotulo: "Capital (centroide do município)", tipo: "texto" },
  { id: "peso", rotulo: "Peso na região", tipo: "percentual", casas: 2 },
];

export default function ClimaCalendarioPage() {
  const g = lerGold<CargaDetalheGold>("carga_detalhe.json");
  if (!integra(g)) return <CargaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const p = g.p027;
  const ev = g.evidencias;
  const t = g.temperatura;
  const fontesMes = Object.entries(t.fontes_por_mes);
  const porProduto = new Map<string, string[]>();
  for (const [m, f] of fontesMes) porProduto.set(f, [...(porProduto.get(f) ?? []), m]);
  const downloads = g.downloads.filter((d) => /decomposicao|temperatura|calendario/.test(d.url));
  const categorias = g.calendario.categorias;

  return (
    <>
      <CabecalhoEnergia atual="carga" />
      <MarcaVisita secao="energia:carga-clima" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Carga"
          titulo="Clima e calendário"
          referencia={
            <>
              ONS (carga diária) até {dataBR(g.dia_referencia)}, NASA POWER (temperatura) e IBGE (população); processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quanto da carga de cada dia acompanha o calendário (dia da semana, feriados, fim de ano), a temperatura e a estação do ano, segundo um modelo estatístico estimado só
          com o passado e conferido em dias que ele não viu. É decomposição estatística: mostra associação, não causa.
        </CabecalhoModulo>
        <CargaNavegacao atual="p027" />
        <ModoProfundidade>
          <Bloco id="clima">
            <PainelEvidencia
              id="p027"
              pergunta={perguntaPainel("p027")}
              subtitulo="Decomposição estatística da carga diária, fora da amostra · MWmed, % e log × 100"
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  Uma semana quente ou com feriado muda a carga sem que o consumo de fundo mude. Separar o que acompanha clima e calendário do que sobra (o resíduo) evita ler
                  essas oscilações como tendência, sem atribuir causa.
                </>
              }
              oQueMudou={
                p ? (
                  <>
                    Último ajuste com origem em {dataBR(p.ultimo_ajuste_sin.origem)} ({num(p.ultimo_ajuste_sin.dias_treino, 0)} dias de treino até{" "}
                    {dataBR(p.ultimo_ajuste_sin.ultimo_dia_treino)}). {p.leitura}
                  </>
                ) : (
                  <>A decomposição não foi publicada nesta versão.</>
                )
              }
              comoInterpretar={
                <>
                  O modelo é estimado só com dias anteriores a cada origem mensal e prevê o mês com a temperatura e o calendário que de fato ocorreram (avaliação ex post, não
                  previsão de carga). Contribuição é a mudança da previsão associada a um grupo de variáveis, com o resto fixo, em log × 100 (perto de pontos percentuais). O
                  intervalo vem dos erros fora da amostra de origens anteriores. A referência ingênua repete a carga do mesmo dia da semana 364 dias antes.
                </>
              }
              naoConcluir={
                <>
                  A contribuição da temperatura não é efeito causal nem &ldquo;parcela explicada&rdquo;. O resíduo não é atividade econômica: é o que o modelo não reproduz,
                  incluindo erro de medida da temperatura, MMGD e revisões da carga. A temperatura é de reanálise e análise de modelo (NASA POWER), não de estação.
                </>
              }
              proveniencia={g.proveniencia.modelo}
              complementares={[
                { rotulo: "Temperatura ponderada", p: g.proveniencia.temperatura },
                { rotulo: "Carga diária comparada", p: g.proveniencia.comparacoes },
              ]}
            >
              <div className="space-y-6">
                {p ? (
                  <CargaClima
                    p027={{
                      metricas: p.metricas,
                      periodo_avaliacao: p.periodo_avaliacao,
                      sensibilidade: p.sensibilidade,
                      por_origem_sin: p.por_origem_sin,
                      recente_sin: p.recente_sin,
                      resposta_temperatura: p.resposta_temperatura,
                    }}
                    a07={{ decomposicao: g.a07.decomposicao }}
                    diaReferencia={g.dia_referencia}
                    fonte={FONTE}
                    versao={p.periodo_avaliacao.fim}
                    destaques={
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Numero
                          rotulo="SIN: erro absoluto médio fora da amostra (modelo principal)"
                          natureza="ESTIMADO"
                          evidencia={ev.p027_mape_sin}
                          formato="pct"
                          casas={2}
                          tamanho="medio"
                          cor="var(--cor-energia)"
                          nota={`Referência ingênua de 364 dias: ${num(p.metricas.SIN.mape_referencia_364d_pct, 2)}% nos mesmos dias.`}
                          endereco={`${rotaPainel("p027")}#p027`}
                        />
                      </div>
                    }
                  />
                ) : (
                  <CargaAviso tipo="alerta">
                    A decomposição estatística não foi publicada nesta versão da gold: {g.proveniencia.modelo.limitacoes.join(" ")} A série de carga e as comparações de
                    calendário continuam no painel de nível e crescimento.
                  </CargaAviso>
                )}

                <CargaAnalise id="calendario" titulo="Calendário usado: feriados por lei e pontos facultativos">
                  <p className="text-sm text-carvao-muted">
                    Categorias: {listaTexto(Object.entries(categorias).map(([k, v]) => `${k.replaceAll("_", " ")} (${v})`))}. Pontos facultativos (Carnaval, Cinzas, Corpus
                    Christi) entram no modelo como variáveis próprias e numa variante sem eles.
                  </p>
                  <TabelaInterativa
                    titulo="Feriados e pontos facultativos nos últimos 12 meses"
                    colunas={COLUNAS_EVENTOS}
                    linhas={g.calendario.eventos_12m.map((e) => ({ id: e.data, data: e.data, nome: e.nome, categoria: categorias[e.categoria] ?? e.categoria }))}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte="Senado Federal (leis de feriados) e portarias anuais de pontos facultativos"
                    versao={g.dia_referencia}
                    nomeArquivo="carga-calendario-12-meses"
                  />
                </CargaAnalise>

                {p && (
                  <CargaAuditoria id="modelo" titulo="Especificação, coeficientes e erros do modelo">
                    <dl className="grid gap-2 text-sm text-carvao-muted md:grid-cols-2">
                      {(
                        [
                          ["Alvo", p.especificacao.alvo],
                          ["Estimador", p.especificacao.estimador],
                          ["Início do treino", dataBR(p.especificacao.inicio_treino)],
                          ["Primeira origem", dataBR(p.especificacao.primeira_origem)],
                          ["Origens", p.especificacao.origens],
                          ["Intervalo", p.especificacao.intervalo],
                          ["Contribuições", p.especificacao.contribuicoes],
                          ["Temperatura", p.especificacao.temperatura],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-carvao">{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-sm text-carvao-muted">
                      Variáveis por grupo:{" "}
                      {(Object.keys(ROTULO_GRUPO) as (keyof typeof ROTULO_GRUPO)[])
                        .map((gr) => `${ROTULO_GRUPO[gr].toLowerCase()} (${p.especificacao.variaveis.filter((x) => x.grupo === gr).map((x) => x.nome).join(", ")})`)
                        .join("; ")}
                      . Dobras de temperatura: {REGIOES.map((r) => `${NOME_REGIAO[r]} ${p.especificacao.nos_temperatura[r].map((x) => `${num(x, 2)} °C`).join(" e ")}`).join("; ")}.
                    </p>
                    <p className="text-sm text-carvao-muted">
                      Erros diários do SIN fora da amostra (real contra previsto): 5% abaixo de {num(p.erros_sin_pct.p05, 2)}%, quartis de {num(p.erros_sin_pct.p25, 2)}% e{" "}
                      {num(p.erros_sin_pct.p75, 2)}%, mediana de {num(p.erros_sin_pct.mediana, 2)}%, 5% acima de {num(p.erros_sin_pct.p95, 2)}%. Desvio padrão do resíduo
                      no último treino: {num(p.ultimo_ajuste_sin.dp_residuo_treino_log100, 2)} em log × 100.
                    </p>
                    <TabelaInterativa
                      titulo={`Coeficientes do SIN no ajuste com origem em ${dataBR(p.ultimo_ajuste_sin.origem)}`}
                      colunas={COLUNAS_COEF}
                      linhas={p.coeficientes_sin.map((x) => ({ id: x.variavel, variavel: x.variavel, grupo: ROTULO_GRUPO[x.grupo], coeficiente: x.coeficiente, ativa: x.ativa ? "sim" : "não" }))}
                      chaveLinha="id"
                      colunaRotulo="variavel"
                      fonte={FONTE}
                      versao={p.ultimo_ajuste_sin.origem}
                      nomeArquivo="carga-decomposicao-coeficientes-sin"
                    />
                  </CargaAuditoria>
                )}

                <CargaAuditoria id="temperatura" titulo="Temperatura: produto, pontos e pesos">
                  <p className="text-sm text-carvao-muted">
                    Produto da NASA POWER por mês:{" "}
                    {Array.from(porProduto.entries())
                      .map(([f, ms]) => `${f} em ${ms.length} meses (${mesAno(ms[0])} a ${mesAno(ms[ms.length - 1])})`)
                      .join("; ")}
                    . Pesos: população residente estimada por UF (IBGE{t.ano_populacao ? `, ${t.ano_populacao}` : ""}), normalizada dentro de cada região.
                  </p>
                  <TabelaInterativa
                    titulo="Peso de cada capital na temperatura da região"
                    colunas={COLUNAS_PESOS}
                    linhas={REGIOES.flatMap((r) =>
                      Object.entries(t.pesos[r] ?? {}).map(([uf, peso]) => ({ id: `${r}:${uf}`, regiao: NOME_REGIAO[r], uf, capital: t.capitais[uf]?.nome ?? uf, peso: peso * 100 })),
                    )}
                    chaveLinha="id"
                    colunaRotulo="uf"
                    fonte="IBGE (SIDRA 6579 e malhas) e NASA POWER"
                    versao={t.ano_populacao ?? g.dia_referencia}
                    nomeArquivo="carga-temperatura-pesos"
                    chaveUrl="pesos"
                  />
                  <TabelaInterativa
                    titulo="Leis dos feriados nacionais"
                    colunas={COLUNAS_LEIS}
                    linhas={g.calendario.leis.map((l) => ({
                      id: l.id,
                      norma: l.norma,
                      estabelece: l.estabelece,
                      ementa: l.conferida_ementa ? "sim" : "não",
                      texto: l.conferida_texto ? "sim" : "não",
                      situacao: l.texto_situacao,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="norma"
                    fonte="Senado Federal, dados abertos da legislação"
                    versao={g.dia_referencia}
                    nomeArquivo="carga-leis-feriados"
                  />
                  <CargaFontes fontes={g.fontes.filter((f) => ["temperatura", "populacao", "centroides", "leis"].includes(f.id))} />
                </CargaAuditoria>

                <CargaSeguir ancora="p027" proximo={{ href: `${rotaPainel("p025")}#p025`, pergunta: perguntaPainel("p025") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
