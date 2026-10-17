import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ExpansaoCamadas, ExpansaoFiguras } from "@/components/energia/ExpansaoCenarios";
import {
  ExpansaoAuditoria,
  ExpansaoAusencia,
  ExpansaoDatas,
  ExpansaoIndisponivel,
  ExpansaoLimitacoes,
  ExpansaoNavegacao,
  ExpansaoNota,
  ExpansaoRecorte,
  ExpansaoSeguir,
  ExpansaoTabelaSimples,
} from "@/components/energia/ExpansaoPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import {
  CENARIO_PDE_EN,
  CONFERENCIA_PDE_EN,
  LINHA_ANEXO_EN,
  ORGAO_EN,
  UNIDADES_EN,
  atoNormativoEn,
  mesPorExtensoEn,
  rotuloDado,
} from "@/lib/energia/i18n/expansao-transicao-territorio";
import {
  colunaFigura,
  hipoteseNoIdioma,
  hipoteseTraduzida,
  rotuloFigura,
  tituloFigura,
  DOWNLOADS_PAINEL,
  capacidadeNoCenario,
  dadosFigura,
  dataTexto,
  downloadsDe,
  linhasCamadas,
  mesTexto,
  mudancaCenarios,
  notaCarteiraAcimaDoCenario,
  numTexto,
  painel,
  respostaCenarios,
  vereditoCenarios,
  provenienciasDoLeitor,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/expansao/cenarios", {
    title: tx("Cenários oficiais: como o PDE 2035 enxerga a matriz elétrica", "Official scenarios: how the PDE 2035 sees the power mix"),
    description: tx(
      "Plano Decenal de Expansão de Energia 2035 (EPE e MME) com selo de cenário, data-base, hipóteses e universo declarados, ao lado do realizado do SIGA e da carteira do RALIE em camadas separadas, sem diferença calculada.",
      "Ten-Year Energy Expansion Plan 2035 (PDE 2035, by EPE and MME) with a scenario label, base date, assumptions and universe declared, next to the SIGA actual and the RALIE portfolio in separate layers, with no calculated difference.",
    ),
    alternates: { canonical: "/setor-eletrico/expansao/cenarios" },
  }, anterior);
}

export default function CenariosPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cenarios;
  const p = provenienciasDoLeitor(g);
  const ev = g.evidencias;
  const pp = painel("p043");
  const f325 = c.figuras.fig_3_25;
  const d325 = f325 ? dadosFigura(f325) : null;
  const notas = Object.fromEntries(c.camadas.map((x) => [x.categoria, x.nota]));
  const anexo = c.anexo_i3;
  const cap = capacidadeNoCenario(g);
  const oQueMudou = mudancaCenarios(g);
  // textos da gold em português, com versão inglesa de trabalho quando a tabela tem a entrada
  const dataBase = tx(c.data_base_premissas, mesPorExtensoEn(c.data_base_premissas));
  const horizonte = tx(c.horizonte, c.horizonte.replace(" a ", " to "));
  const orgao = tx(c.orgao, ORGAO_EN[c.orgao] ?? c.orgao);
  const textoCenario = tx(c.cenario, CENARIO_PDE_EN[c.cenario] ?? c.cenario);
  const universo = tx(<>{c.universo}</>, CENARIO_PDE_EN[c.universo] ? <>{CENARIO_PDE_EN[c.universo]}</> : <TrechoPortugues regiao="expansao-pde-universo">{c.universo}</TrechoPortugues>);
  const unidadeFig = (u: string) => tx(u, UNIDADES_EN[u] ?? u);
  /** "dez/2035" (referência da gold) ou "2035-12" no idioma da página. */
  const refLegivel = (ref: string) => {
    const m = /^([a-z]{3})\/(\d{4})$/.exec(ref);
    const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]; // i18n: dado
    if (m && meses.includes(m[1])) return mesTexto(`${m[2]}-${String(meses.indexOf(m[1]) + 1).padStart(2, "0")}`);
    return /^\d{4}-\d{2}$/.test(ref) ? mesTexto(ref) : ref;
  };
  const atualizacoes = Object.entries(c.atualizacao_planilhas ?? {})
    .map(([k, d]) => tx(`${k} em ${dataTexto(d)}`, `${k.replace(/^Capítulo /, "Chapter ")} on ${dataTexto(d)}`))
    .join("; ");
  const comoInterpretar = tx(
    <>
      {g.regras.cenario} {c.camadas_regra}
    </>,
    <TrechoPortugues regiao="expansao-pde-regras">
      {g.regras.cenario} {c.camadas_regra}
    </TrechoPortugues>,
  );
  const naoConcluir = tx(
    <>
      Que o cenário vai se realizar, nem que a distância entre camadas é atraso ou excesso: as categorias do plano e do cadastro não coincidem uma a uma, e nenhuma diferença
      é calculada. Geração em TWh (Figura 12-4) não se compara com capacidade em GW.
    </>,
    <>
      That the scenario will come true, nor that the gap between layers is a delay or an excess: the categories of the plan and of the register do not match one to one, and no difference is
      calculated. Generation in TWh (Figure 12-4) is not compared with capacity in GW.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao-cenarios" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <ExpansaoNavegacao atual="p043" />
        <CabecalhoModulo
          siglas={["PDE", "SIGA", "RALIE", "SIN", "CDE", "CVU", "MMGD"]}
          rotulo={tx("Expansão", "Expansion")}
          titulo={pp.pergunta}
          lead={tx(
            "Compare a matriz prevista no plano decenal oficial com a capacidade já instalada e os projetos em carteira. O plano descreve um cenário de dez anos, não uma garantia de que as obras serão entregues.",
            "Compare the power mix in the official ten-year plan with the capacity already installed and the projects in the portfolio. The plan describes a ten-year scenario, not a guarantee that the works will be delivered.",
          )}
          recorte={tx(`${c.edicao} · data-base ${dataBase} · horizonte ${horizonte} · GW`, `${c.edicao} · base date ${dataBase} · horizon ${horizonte} · GW`)}
          fonte={tx("EPE e MME, PDE; ANEEL, SIGA e RALIE", "EPE and MME, PDE; ANEEL, SIGA and RALIE")}
          referencia={tx(
            <>
              {c.edicao} ({c.orgao}); data-base das premissas: {c.data_base_premissas}; horizonte {c.horizonte}; caderno de dados capturado em {dataTexto(c.vintage.capturado_em)}. Realizado do SIGA de{" "}
              {dataTexto(g.referencias.siga)} e carteira do RALIE de {dataTexto(g.referencias.ralie)}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {c.edicao} ({orgao}); base date of the assumptions: {dataBase}; horizon {horizonte}; data workbook captured on {dataTexto(c.vintage.capturado_em)}. SIGA actual of{" "}
              {dataTexto(g.referencias.siga)} and RALIE portfolio of {dataTexto(g.referencias.ralie)}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <ExpansaoDatas
              itens={[
                { rotulo: c.edicao, texto: tx(`data-base ${dataBase}, horizonte ${horizonte}`, `base date ${dataBase}, horizon ${horizonte}`), natureza: "CENARIO" },
                { rotulo: tx("Caderno de dados", "Data workbook"), texto: tx(`capturado em ${dataTexto(c.vintage.capturado_em)}`, `captured on ${dataTexto(c.vintage.capturado_em)}`), natureza: "OBSERVADO" },
                { rotulo: tx("Realizado (SIGA)", "Actual (SIGA)"), texto: tx(`até ${dataTexto(g.referencias.siga)}`, `through ${dataTexto(g.referencias.siga)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Carteira (RALIE)", "Portfolio (RALIE)"),
                  texto: tx(`fotografia de ${dataTexto(g.referencias.ralie)}`, `snapshot of ${dataTexto(g.referencias.ralie)}`),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={2}
              rotulo={tx("Capacidade nacional no cenário de referência", "National capacity in the reference scenario")}
              nota={tx(
                "Medidas do cenário, com MMGD, baterias e resposta da demanda; não são previsão nem o que já opera.",
                "Scenario measures, with MMGD, batteries and demand response; they are neither a forecast nor what already operates.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx(`Capacidade instalada nacional em ${mesTexto(cap.inicio?.ref)}`, `National installed capacity in ${mesTexto(cap.inicio?.ref)}`)}
                natureza="CENARIO"
                valor={cap.inicio?.gw ?? null}
                casas={1}
                unidade="GW"
                periodo={tx("Figura 3-25, Cenário de Referência", "Figure 3-25, Reference Scenario")}
                cor="var(--escala-seq-2)"
                motivoAusencia={tx("Sem a Figura 3-25 nesta publicação.", "No Figure 3-25 in this release.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx(`Capacidade instalada nacional em ${mesTexto(cap.fim?.ref)}`, `National installed capacity in ${mesTexto(cap.fim?.ref)}`)}
                natureza="CENARIO"
                evidencia={ev.pde_capacidade_2035 ?? null}
                casas={1}
                unidade="GW"
                periodo={tx("Figura 3-25, Cenário de Referência", "Figure 3-25, Reference Scenario")}
                cor="var(--serie-comp-4)"
                endereco="/setor-eletrico/expansao/cenarios#p043"
                motivoAusencia={tx("Sem a Figura 3-25 nesta publicação.", "No Figure 3-25 in this release.")}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            "Como o planejamento oficial projeta a matriz elétrica, com as hipóteses da edição. É um cenário, não uma previsão nem um compromisso: aparece separado do que já opera e do que está em obra.",
            "How official planning projects the power mix, with the edition's assumptions. It is a scenario, neither a forecast nor a commitment: it appears separately from what already operates and what is under construction.",
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="cenarios">
            <PainelEvidencia
              id="p043"
              pergunta={tx(
                `A matriz no cenário: ${f325 ? f325.linhas.map((l) => mesTexto(l.ref)).join(" e ") : "sem dado"}`,
                `The power mix in the scenario: ${f325 ? f325.linhas.map((l) => mesTexto(l.ref)).join(" and ") : "no data"}`,
              )}
              subtitulo={`${c.edicao}, ${textoCenario}`}
              natureza="CENARIO"
              porQueImporta={tx(
                <>
                  O plano decenal orienta leilões, transmissão e políticas. Saber o que ele supõe, e onde o realizado e a carteira já estão em relação a ele, ajuda a ler as escolhas do
                  setor sem confundir plano com entrega.
                </>,
                <>
                  The ten-year plan guides auctions, transmission and policies. Knowing what it assumes, and where the actual and the portfolio already stand relative to it, helps to read the
                  sector&apos;s choices without confusing plan with delivery.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={p.cenarios}
              complementares={[
                { rotulo: tx("Realizado (SIGA)", "Actual (SIGA)"), p: p.capacidade },
                { rotulo: tx("Carteira (RALIE)", "Portfolio (RALIE)"), p: p.ralie },
              ]}
            >
              <div className="space-y-6">
                <p className="inline-flex flex-wrap items-center gap-2 border border-dotted border-natureza-cenario px-3 py-1 text-sm text-natureza-cenario">
                  <span className="rotulo">{tx(c.selo, CENARIO_PDE_EN[c.selo] ?? c.selo)}</span>
                  <span>
                    {tx(
                      <>
                        {c.edicao}, data-base {c.data_base_premissas}
                        {c.aprovacao ? `, aprovado pela ${c.aprovacao.texto}` : ""}
                      </>,
                      <>
                        {c.edicao}, base date {dataBase}
                        {c.aprovacao ? `, approved by ${atoNormativoEn(c.aprovacao.texto)}` : ""}
                      </>,
                    )}
                  </span>
                </p>
                <RespostaCurta id="p043" veredito={vereditoCenarios(g) || respostaCenarios(g)}>
                  {respostaCenarios(g)}
                </RespostaCurta>
                {f325 && d325?.modo === "barras" ? (
                  <GraficoBarras
                    titulo={tx(`Figura 3-25: ${f325.titulo} (cenário; ${f325.unidade})`, `Figure 3-25: ${tituloFigura(f325.titulo)} (scenario; ${unidadeFig(f325.unidade)})`)}
                    dados={d325.dados}
                    chaveCategoria="id"
                    chaveRotulo="coluna"
                    series={d325.series.map((s, i) => ({ id: s.id, rotulo: /^\d{4}-\d{2}$/.test(s.rotulo) ? mesTexto(s.rotulo) : s.rotulo, cor: i === 0 ? "var(--escala-seq-2)" : "var(--serie-comp-4)" }))}
                    unidade={unidadeFig(f325.unidade)}
                    casas={3}
                    orientacao="horizontal"
                    alturaCategoria={56}
                    rotulosValor
                  />
                ) : (
                  <ExpansaoAusencia titulo={tx("Figura 3-25 ausente nesta publicação", "Figure 3-25 missing in this release")}>
                    <p>
                      {tx(
                        "O caderno de dados integrado não trouxe a aba da Figura 3-25; as camadas abaixo seguem com o Anexo I-3 quando ele existe.",
                        "The integrated data workbook did not include the Figure 3-25 tab; the layers below continue with Annex I-3 when it exists.",
                      )}
                    </p>
                  </ExpansaoAusencia>
                )}
                {f325 && (
                  <ExpansaoNota>
                    <TrechoPortugues regiao="expansao-figura-nota">{f325.nota}</TrechoPortugues>
                  </ExpansaoNota>
                )}
                <ExpansaoRecorte
                  periodo={tx(
                    <>
                      Horizonte {c.horizonte}; capacidade em dezembro de cada ano; realizado de {dataTexto(g.referencias.siga)}
                    </>,
                    <>
                      Horizon {horizonte}; capacity in December of each year; actual of {dataTexto(g.referencias.siga)}
                    </>,
                  )}
                  universo={universo}
                  unidade={tx("GW de capacidade instalada; MW, km, MVA, R$ bilhões e TWh nas figuras que os usam", "GW of installed capacity; MW, km, MVA, R$ billion and TWh in the figures that use them")}
                />
                <div className="space-y-2 border-l-2 border-linha pl-4 text-sm leading-relaxed text-carvao-muted">
                  <p className="rotulo text-mineral">{tx("Hipóteses da edição", "Assumptions of the edition")}</p>
                  <ul className="list-disc space-y-1.5 pl-5 text-carvao">
                    {c.hipoteses.map((h) => (
                      <li key={h.texto}>
                        {hipoteseTraduzida(h.texto) ? hipoteseNoIdioma(h.texto) : <TrechoPortugues regiao="expansao-hipotese">{h.texto}</TrechoPortugues>}
                        {h.pagina ? (
                          <span data-nivel="analisar" className="text-carvao-muted">
                            {" "}
                            {tx(`(relatório, p. ${h.pagina})`, `(report, p. ${h.pagina})`)}
                          </span>
                        ) : null}
                        {h.ressalva ? (
                          <span data-nivel="analisar" className="mt-1 block text-carvao-muted">
                            <span className="rotulo mr-1 text-mineral">{tx("Ressalva", "Caveat")}</span>
                            {hipoteseTraduzida(h.ressalva) ? hipoteseNoIdioma(h.ressalva) : <TrechoPortugues regiao="expansao-hipotese-ressalva">{h.ressalva}</TrechoPortugues>}
                            {h.pagina_ressalva ? ` (p. ${h.pagina_ressalva})` : ""}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="camadas" titulo={tx("Cenário, realizado e carteira, lado a lado", "Scenario, actual and portfolio, side by side")}>
                  <ExpansaoCamadas linhas={linhasCamadas(g)} notas={notas} datas={{ siga: dataTexto(g.referencias.siga), ralie: dataTexto(g.referencias.ralie) }} />
                  {notaCarteiraAcimaDoCenario(g) && <ExpansaoNota>{notaCarteiraAcimaDoCenario(g)}</ExpansaoNota>}
                </SecaoDoPainel>

                <SecaoDoPainel id="figuras" titulo={tx("O que mais o caderno de dados do plano mostra?", "What else does the plan's data workbook show?")}>
                  <ExpansaoFiguras figuras={c.figuras} />
                </SecaoDoPainel>

                <ExpansaoAuditoria titulo={tx("Extração, conferências e limitações", "Extraction, checks and limitations")} id="auditoria-cenarios">
                  {c.aprovacao && (
                    <ExpansaoNota>
                      {tx(
                        <>
                          Aprovação: {c.aprovacao.texto} ({c.aprovacao.verificado_em};{" "}
                          <a href={c.aprovacao.fonte} className="break-all text-energia-dark underline underline-offset-4">
                            página da EPE
                          </a>
                          ). Relatório:{" "}
                          <a href={c.relatorio} className="break-all text-energia-dark underline underline-offset-4">
                            PDF do relatório final
                          </a>
                          ; caderno de dados:{" "}
                          <a href={c.caderno_de_dados} className="break-all text-energia-dark underline underline-offset-4">
                            arquivo ZIP
                          </a>{" "}
                          (sha256 <span className="break-all">{c.vintage.sha256 ?? "sem dado"}</span>).
                        </>,
                        <>
                          Approval: {atoNormativoEn(c.aprovacao.texto)} (<TrechoPortugues regiao="expansao-aprovacao-verificada">{c.aprovacao.verificado_em}</TrechoPortugues>;{" "}
                          <a href={c.aprovacao.fonte} className="break-all text-energia-dark underline underline-offset-4">
                            EPE page
                          </a>
                          ). Report:{" "}
                          <a href={c.relatorio} className="break-all text-energia-dark underline underline-offset-4">
                            PDF of the final report
                          </a>
                          ; data workbook:{" "}
                          <a href={c.caderno_de_dados} className="break-all text-energia-dark underline underline-offset-4">
                            ZIP file
                          </a>{" "}
                          (sha256 <span className="break-all">{c.vintage.sha256 ?? "no data"}</span>).
                        </>,
                      )}
                    </ExpansaoNota>
                  )}
                  {anexo ? (
                    <>
                      <ExpansaoTabelaSimples
                        titulo={tx(
                          `${anexo.titulo} (p. ${anexo.pagina ?? "sem dado"}, extraída com ${anexo.extracao ?? "sem dado"}), conferida contra as figuras`,
                          `${CENARIO_PDE_EN[anexo.titulo] ?? anexo.titulo} (p. ${anexo.pagina ?? "no data"}, extracted with ${anexo.extracao ?? "no data"}), checked against the figures`,
                        )}
                        cabecalho={tx(
                          ["Figura e coluna", "Referência", "Figura (MW)", "Linhas do anexo", "Anexo (MW)", "Diferença (MW)", "Tolerância (MW)", "Resultado"],
                          ["Figure and column", "Reference", "Figure (MW)", "Annex rows", "Annex (MW)", "Difference (MW)", "Tolerance (MW)", "Result"],
                        )}
                        linhas={anexo.conferencia_figuras.map((x) => [
                          tx(`${x.figura}, ${x.coluna}`, `${rotuloFigura(x.figura.replace(/^Figura /, "fig_").replace("-", "_"))}, ${colunaFigura(x.coluna)}`),
                          tx(x.referencia, refLegivel(x.referencia)),
                          numTexto(x.figura_mw, 1),
                          tx(x.linhas_anexo.join(" + "), x.linhas_anexo.map((l) => rotuloDado(l, LINHA_ANEXO_EN, "en")).join(" + ")),
                          numTexto(x.anexo_mw, 1),
                          numTexto(x.diferenca_mw, 1),
                          numTexto(x.tolerancia_mw, 1),
                          tx(x.resultado, rotuloDado(x.resultado, CONFERENCIA_PDE_EN, "en")),
                        ])}
                      />
                      {anexo.notas && (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                          {Object.entries(anexo.notas).map(([k, n]) => (
                            <li key={k}>
                              {tx(
                                <>
                                  Nota {k} do Anexo I-3: {n}
                                </>,
                                <>
                                  Note {k} of Annex I-3: <TrechoPortugues regiao="expansao-anexo-nota">{n}</TrechoPortugues>
                                </>,
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <ExpansaoAusencia titulo={tx("Anexo I-3 não extraído nesta publicação", "Annex I-3 not extracted in this release")}>
                      <p>
                        {tx(
                          "Sem a tabela do relatório, as camadas não têm o valor comparável sem Itaipu 50 Hz e a hidrelétrica fica sem correspondência.",
                          "Without the report's table, the layers do not have the comparable value without Itaipu 50 Hz, and hydropower is left without a match.",
                        )}
                      </p>
                    </ExpansaoAusencia>
                  )}
                  <ExpansaoTabelaSimples
                    titulo={tx("Totais das figuras contra os rótulos do relatório", "Figure totals against the report's labels")}
                    cabecalho={tx(
                      ["Conferência", "Calculado (GW)", "Relatório (GW)", "Diferença (GW)", "Tolerância (GW)", "Resultado", "Ressalva"],
                      ["Check", "Calculated (GW)", "Report (GW)", "Difference (GW)", "Tolerance (GW)", "Result", "Caveat"],
                    )}
                    linhas={c.conferencia_relatorio.map((x) => [
                      tx<React.ReactNode>(x.descricao, <TrechoPortugues regiao="expansao-conferencia-descricao">{x.descricao}</TrechoPortugues>),
                      numTexto(x.calculado_gw, 2),
                      numTexto(x.relatorio_gw, 0),
                      numTexto(x.diferenca_gw, 2),
                      numTexto(x.tolerancia_gw, 1),
                      tx(`${x.resultado} (${x.conferencia_de})`, `${rotuloDado(x.resultado, CONFERENCIA_PDE_EN, "en")} (${rotuloDado(x.conferencia_de, CONFERENCIA_PDE_EN, "en")})`),
                      x.ressalva ? tx<React.ReactNode>(x.ressalva, <TrechoPortugues regiao="expansao-conferencia-ressalva">{x.ressalva}</TrechoPortugues>) : "",
                    ])}
                  />
                  {c.atualizacao_planilhas && (
                    <ExpansaoNota>
                      {tx(
                        <>
                          Atualização das abas do caderno de dados, segundo os metadados das planilhas:{" "}
                          {atualizacoes}. O servidor da EPE não informa data de publicação.
                        </>,
                        <>
                          Update of the data workbook tabs, according to the spreadsheets&apos; metadata:{" "}
                          {atualizacoes}. The EPE server does not report a publication date.
                        </>,
                      )}
                    </ExpansaoNota>
                  )}
                  <ExpansaoAusencia titulo={tx("Balanço Energético Nacional (BEN) não integrado", "National Energy Balance (BEN) not integrated")}>
                    <p>
                      {tx(
                        "A edição integrada é a do PDE. O realizado de capacidade vem do SIGA da ANEEL; a geração realizada em TWh, comparável à Figura 12-4, está no painel de Geração (ONS), em outra base e com outro universo.",
                        "The integrated edition is the PDE's. Actual capacity comes from ANEEL's SIGA; actual generation in TWh, comparable with Figure 12-4, is in the Generation panel (ONS), in another dataset and with another universe.",
                      )}
                    </p>
                  </ExpansaoAusencia>
                  <p className="rotulo text-mineral">{tx("Limitações declaradas na proveniência", "Limitations declared in the provenance")}</p>
                  <ExpansaoLimitacoes itens={p.cenarios.limitacoes} />
                </ExpansaoAuditoria>

                <ExpansaoSeguir id="p043" downloads={downloadsDe(g, DOWNLOADS_PAINEL.p043)} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
