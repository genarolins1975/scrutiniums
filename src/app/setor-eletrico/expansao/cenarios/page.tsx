import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ExpansaoCamadas, ExpansaoFiguras } from "@/components/energia/ExpansaoCenarios";
import {
  ExpansaoAnalise,
  ExpansaoAuditoria,
  ExpansaoAusencia,
  ExpansaoIndisponivel,
  ExpansaoLimitacoes,
  ExpansaoNavegacao,
  ExpansaoNota,
  ExpansaoRecorte,
  ExpansaoSeguir,
  ExpansaoSubtitulo,
  ExpansaoTabelaSimples,
} from "@/components/energia/ExpansaoPagina";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  DOWNLOADS_PAINEL,
  dadosFigura,
  dataTexto,
  downloadsDe,
  linhasCamadas,
  mesTexto,
  mudancaCenarios,
  numTexto,
  painel,
  respostaCenarios,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Cenários oficiais: como o PDE 2035 enxerga a matriz elétrica",
  description:
    "Plano Decenal de Expansão de Energia 2035 (EPE e MME) com selo de cenário, data-base, hipóteses e universo declarados, ao lado do realizado do SIGA e da carteira do RALIE em camadas separadas, sem diferença calculada.",
  alternates: { canonical: "/setor-eletrico/expansao/cenarios" },
};

export default function CenariosPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cenarios;
  const p = g.proveniencia;
  const pp = painel("p043");
  const f325 = c.figuras.fig_3_25;
  const d325 = f325 ? dadosFigura(f325) : null;
  const notas = Object.fromEntries(c.camadas.map((x) => [x.categoria, x.nota]));
  const anexo = c.anexo_i3;

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao-cenarios" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["RALIE", "SIN", "CDE"]}
          rotulo="Expansão"
          titulo="Cenários oficiais de expansão"
          referencia={
            <>
              {c.edicao} ({c.orgao}); data-base das premissas: {c.data_base_premissas}; horizonte {c.horizonte}; caderno de dados capturado em {dataTexto(c.vintage.capturado_em)}. Realizado do SIGA de{" "}
              {dataTexto(g.referencias.siga)} e carteira do RALIE de {dataTexto(g.referencias.ralie)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Como o planejamento oficial projeta a matriz elétrica, com as hipóteses da edição. É um cenário, não uma previsão nem um compromisso: aparece separado do que já opera e do
          que está em obra.
        </CabecalhoModulo>
        <ExpansaoNavegacao atual="p043" />
        <ModoProfundidade>
          <Bloco id="cenarios">
            <PainelEvidencia
              id="p043"
              pergunta={pp.pergunta}
              subtitulo={`${c.edicao}, ${c.cenario} · GW (capacidade), com outras unidades por figura`}
              natureza="CENARIO"
              porQueImporta={
                <>
                  O plano decenal orienta leilões, transmissão e políticas. Saber o que ele supõe, e onde o realizado e a carteira já estão em relação a ele, ajuda a ler as escolhas do
                  setor sem confundir plano com entrega.
                </>
              }
              oQueMudou={mudancaCenarios(g)}
              comoInterpretar={
                <>
                  {g.regras.cenario} {c.camadas_regra}
                </>
              }
              naoConcluir={
                <>
                  Que o cenário vai se realizar, nem que a distância entre camadas é atraso ou excesso: as categorias do plano e do cadastro não coincidem uma a uma, e nenhuma diferença
                  é calculada. Geração em TWh (Figura 12-4) não se compara com capacidade em GW.
                </>
              }
              proveniencia={p.cenarios}
              complementares={[
                { rotulo: "Realizado (SIGA)", p: p.capacidade },
                { rotulo: "Carteira (RALIE)", p: p.ralie },
              ]}
            >
              <div className="space-y-6">
                <p className="inline-flex flex-wrap items-center gap-2 border border-dotted border-natureza-cenario px-3 py-1 text-sm text-natureza-cenario">
                  <span className="rotulo">{c.selo}</span>
                  <span>
                    {c.edicao}, data-base {c.data_base_premissas}
                    {c.aprovacao ? `, aprovado pela ${c.aprovacao.texto}` : ""}
                  </span>
                </p>
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p043">
                  {respostaCenarios(g)}
                </p>
                <ExpansaoRecorte
                  periodo={
                    <>
                      Horizonte {c.horizonte}; capacidade em dezembro de cada ano; realizado de {dataTexto(g.referencias.siga)}
                    </>
                  }
                  universo={<>{c.universo}</>}
                  unidade="GW de capacidade instalada; MW, km, MVA, R$ bilhões e TWh nas figuras que os usam"
                />
                <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
                  <Numero
                    rotulo="Capacidade instalada nacional em dez/2035 no Cenário de Referência"
                    natureza="CENARIO"
                    evidencia={g.evidencias.pde_capacidade_2035 ?? null}
                    casas={1}
                    tamanho="medio"
                    endereco="/setor-eletrico/expansao/cenarios#p043"
                    motivoAusencia="Sem a Figura 3-25 nesta publicação."
                    nota="Inclui micro e minigeração distribuída, baterias e resposta da demanda; não é previsão."
                  />
                  <div className="space-y-2 border border-linha bg-superficie p-5 text-sm leading-relaxed text-carvao">
                    <p className="rotulo text-mineral">Hipóteses da edição</p>
                    <ul className="list-disc space-y-1.5 pl-5">
                      {c.hipoteses.map((h) => (
                        <li key={h.texto}>
                          {h.texto}
                          {h.pagina ? <span className="text-carvao-muted"> (relatório, p. {h.pagina})</span> : null}
                          {h.ressalva ? (
                            <span className="mt-1 block text-carvao-muted">
                              <span className="rotulo mr-1 text-mineral">Ressalva</span>
                              {h.ressalva}
                              {h.pagina_ressalva ? ` (p. ${h.pagina_ressalva})` : ""}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <ExpansaoSubtitulo>A matriz no cenário: {f325 ? f325.linhas.map((l) => mesTexto(l.ref)).join(" e ") : "sem dado"}</ExpansaoSubtitulo>
                {f325 && d325?.modo === "barras" ? (
                  <GraficoBarras
                    titulo={`Figura 3-25: ${f325.titulo} (cenário; ${f325.unidade})`}
                    dados={d325.dados}
                    chaveCategoria="id"
                    chaveRotulo="coluna"
                    series={d325.series.map((s, i) => ({ id: s.id, rotulo: /^\d{4}-\d{2}$/.test(s.rotulo) ? mesTexto(s.rotulo) : s.rotulo, cor: i === 0 ? "var(--escala-seq-2)" : "var(--serie-comp-4)" }))}
                    unidade={f325.unidade}
                    casas={3}
                    orientacao="horizontal"
                    alturaCategoria={56}
                    rotulosValor
                  />
                ) : (
                  <ExpansaoAusencia titulo="Figura 3-25 ausente nesta publicação">
                    <p>O caderno de dados integrado não trouxe a aba da Figura 3-25; as camadas abaixo seguem com o Anexo I-3 quando ele existe.</p>
                  </ExpansaoAusencia>
                )}
                {f325 && <ExpansaoNota>{f325.nota}</ExpansaoNota>}

                <ExpansaoSubtitulo>Cenário, realizado e carteira, lado a lado</ExpansaoSubtitulo>
                <ExpansaoCamadas linhas={linhasCamadas(g)} notas={notas} datas={{ siga: dataTexto(g.referencias.siga), ralie: dataTexto(g.referencias.ralie) }} />

                <ExpansaoAnalise titulo="Figuras do caderno de dados" id="figuras">
                  <ExpansaoFiguras figuras={c.figuras} />
                </ExpansaoAnalise>

                <ExpansaoAuditoria titulo="Extração, conferências e limitações" id="auditoria-cenarios">
                  {c.aprovacao && (
                    <ExpansaoNota>
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
                    </ExpansaoNota>
                  )}
                  {anexo ? (
                    <>
                      <ExpansaoTabelaSimples
                        titulo={`${anexo.titulo} (p. ${anexo.pagina ?? "sem dado"}, extraída com ${anexo.extracao ?? "sem dado"}), conferida contra as figuras`}
                        cabecalho={["Figura e coluna", "Referência", "Figura (MW)", "Linhas do anexo", "Anexo (MW)", "Diferença (MW)", "Tolerância (MW)", "Resultado"]}
                        linhas={anexo.conferencia_figuras.map((x) => [
                          `${x.figura}, ${x.coluna}`,
                          x.referencia,
                          numTexto(x.figura_mw, 1),
                          x.linhas_anexo.join(" + "),
                          numTexto(x.anexo_mw, 1),
                          numTexto(x.diferenca_mw, 1),
                          numTexto(x.tolerancia_mw, 1),
                          x.resultado,
                        ])}
                      />
                      {anexo.notas && (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                          {Object.entries(anexo.notas).map(([k, n]) => (
                            <li key={k}>
                              Nota {k} do Anexo I-3: {n}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <ExpansaoAusencia titulo="Anexo I-3 não extraído nesta publicação">
                      <p>Sem a tabela do relatório, as camadas não têm o valor comparável sem Itaipu 50 Hz e a hidrelétrica fica sem correspondência.</p>
                    </ExpansaoAusencia>
                  )}
                  <ExpansaoTabelaSimples
                    titulo="Totais das figuras contra os rótulos do relatório"
                    cabecalho={["Conferência", "Calculado (GW)", "Relatório (GW)", "Diferença (GW)", "Tolerância (GW)", "Resultado", "Ressalva"]}
                    linhas={c.conferencia_relatorio.map((x) => [x.descricao, numTexto(x.calculado_gw, 2), numTexto(x.relatorio_gw, 0), numTexto(x.diferenca_gw, 2), numTexto(x.tolerancia_gw, 1), `${x.resultado} (${x.conferencia_de})`, x.ressalva ?? ""])}
                  />
                  {c.atualizacao_planilhas && (
                    <ExpansaoNota>
                      Atualização das abas do caderno de dados, segundo os metadados das planilhas:{" "}
                      {Object.entries(c.atualizacao_planilhas)
                        .map(([k, d]) => `${k} em ${dataTexto(d)}`)
                        .join("; ")}
                      . O servidor da EPE não informa data de publicação.
                    </ExpansaoNota>
                  )}
                  <ExpansaoAusencia titulo="Balanço Energético Nacional (BEN) não integrado">
                    <p>
                      A edição integrada é a do PDE. O realizado de capacidade vem do SIGA da ANEEL; a geração realizada em TWh, comparável à Figura 12-4, está no painel de Geração (ONS), em
                      outra base e com outro universo.
                    </p>
                  </ExpansaoAusencia>
                  <p className="rotulo text-mineral">Limitações declaradas na proveniência</p>
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
