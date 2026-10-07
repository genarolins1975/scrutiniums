import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { Numero } from "@/components/energia/Numero";
import { RedeBalanco } from "@/components/energia/RedeBalanco";
import { RedeAnalise, RedeAuditoria, RedeAviso, RedeDicionarios, RedeIndisponivel, RedeNavegacao, RedeRegras, RedeSeguir } from "@/components/energia/RedePagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_COBERTURA,
  colunasIdentidades,
  datasLegiveis,
  frasesA05,
  linhasCobertura,
  linhasIdentidades,
  paraTabela,
  perguntaPainel,
  provenienciaLegivel,
  rotaPainel,
  semCaminhosInternos,
  situacaoAtualidade,
  textoCobertura,
  textoConferenciaSilver,
  textoIdentidadesItaipu,
  ROTULO_REGRA,
} from "@/lib/energia/rede";
import type { ConferenciaDegrauMmgd, GoldRedeDetalhe } from "@/lib/energia/tipos-rede";

export const dynamic = "force-static";
/** Descrição com a data da quebra lida da gold (nenhuma data escrita à mão). */
export function generateMetadata(): Metadata {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  const q = integra(g) ? g.balanco.quebras.find((x) => x.id === "mmgd_2023") : undefined;
  return {
    title: "Rede: balanço de energia, resíduos e intercâmbio com outros países",
    description: `Identidades do balanço de energia do ONS conferidas hora a hora (geração, carga, intercâmbio, fronteiras e exterior), resíduos sinalizados sem causa atribuída,${q ? ` quebra da MMGD estimada em ${dataBR(q.dia)},` : ""} exportação e importação com Argentina, Uruguai e Paraguai e geração de Itaipu.`,
    alternates: { canonical: "/setor-eletrico/rede/balanco-e-exterior" },
  };
}

const FONTE = "ONS, Balanço de Energia nos Subsistemas e intercâmbios (releitura do módulo Rede)";

function conferido(x: ConferenciaDegrauMmgd | { erro: string } | null): x is ConferenciaDegrauMmgd {
  return !!x && !("erro" in x);
}

export default function RedeBalancoPage() {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  if (!integra(g)) return <RedeIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const b = g.balanco;
  const a = g.achados.A05;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const periodo = { inicio: g.cobertura.inicio, fim: g.cobertura.fim };
  const downloads = g.downloads.filter((d) => /balanco|exterior/.test(d.url));
  const q = b.quebras[0];
  const dic = g.achados.dicionarios;

  return (
    <>
      <CabecalhoEnergia atual="rede" />
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-4 sm:px-6">
        <CabecalhoModulo siglas={["SIN", "MWmed", "MMGD"]}
          rotulo="Rede · Balanço e exterior"
          titulo={perguntaPainel("p029")}
          referencia={
            <>
              ONS, balanço de energia, intercâmbios e Itaipu, de {dataBR(periodo.inicio)} a {dataBR(periodo.fim)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          O ONS publica, para cada subsistema e para o <Termo slug="sin">SIN</Termo>, geração, carga e intercâmbio líquido de cada hora, e publica à parte o fluxo de cada fronteira e
          o intercâmbio com outros países. Este painel confere, hora a hora, se essas parcelas fecham entre si e mostra onde não fecham, sem forçar soma zero e sem atribuir o
          resíduo a perdas.
        </CabecalhoModulo>
        <RedeNavegacao atual="p029" />
        <ModoProfundidade>
          <Bloco id="balanco">
            <PainelEvidencia
              id="p029"
              pergunta={perguntaPainel("p029")}
              subtitulo="Identidades do balanço conferidas hora a hora, resíduos e intercâmbio internacional · horas e MWh"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Se o intercâmbio de uma região não fecha com as fronteiras, ou geração menos carga não fecha com o intercâmbio, comparações entre regiões e com o SIN herdam a
                  diferença. Saber onde e quando isso acontece evita atribuir a perdas ou ao exterior o que a fonte não explica.
                </>
              }
              oQueMudou={
                <>
                  {atual.texto}<span data-nivel="analisar"> Estado da verificação do balanço: {a.status}.</span>
                </>
              }
              comoInterpretar={
                <>
                  {a.perimetro} {a.sinais} Uma identidade fecha numa hora quando a diferença fica em até {num(b.tolerancia_mwmed, 1)} MWmed. Desde {dataBR(q?.dia)} a geração solar e a
                  carga do balanço incluem a MMGD estimada pelo ONS, sem a parcela separada.
                </>
              }
              naoConcluir={
                <>
                  A causa dos resíduos: a fonte não a informa, e nenhuma identidade tem termo de perdas. Também não se separa, no balanço, o que é medição do que é estimativa da
                  MMGD desde {dataBR(q?.dia)}, nem se comparam geração e carga mensais dos dois lados dessa data.
                </>
              }
              proveniencia={provenienciaLegivel(g.proveniencia.balanco)}
              complementares={[{ rotulo: "Intercâmbio internacional por país", p: provenienciaLegivel(g.proveniencia.exterior) }]}
            >
              <div className="space-y-6">
                {atual.defasada && <RedeAviso tipo="alerta">{atual.texto}</RedeAviso>}
                <RedeBalanco
                  balanco={{ identidades: b.identidades, mensal: b.mensal, quebras: b.quebras, tolerancia_mwmed: b.tolerancia_mwmed, faixas_mwmed: b.faixas_mwmed }}
                  exterior={{ meses: g.exterior.meses, por_pais: g.exterior.por_pais, resumo_12m: g.exterior.resumo_12m, itaipu: g.exterior.itaipu }}
                  periodo={periodo}
                  fonte={FONTE}
                  versao={versao}
                  destaques={
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Numero
                        rotulo="Horas em que geração menos carga não fecha com o intercâmbio, SIN"
                        natureza="CALCULADO"
                        evidencia={ev.a05_balanco_sin ?? null}
                        casas={0}
                        tamanho="medio"
                        cor="var(--cor-energia)"
                        nota="Resíduo nas parcelas de geração ou carga do balanço; causa não informada pela fonte."
                        endereco={`${rotaPainel("p029")}#p029`}
                      />
                      <Numero
                        rotulo="Horas em que o intercâmbio do Sul no balanço difere da fronteira com o Sudeste/Centro-Oeste somada ao exterior publicado"
                        natureza="CALCULADO"
                        evidencia={ev.a05_perimetro_sul ?? null}
                        casas={0}
                        tamanho="medio"
                        cor="var(--serie-sm-s)"
                        endereco={`${rotaPainel("p029")}#p029`}
                      />
                      <Numero
                        rotulo="Saldo do intercâmbio internacional em 12 meses (positivo = exportação)"
                        natureza="CALCULADO"
                        evidencia={ev.exterior_12m ?? null}
                        casas={0}
                        tamanho="medio"
                        cor="var(--serie-5)"
                        endereco={`${rotaPainel("p029")}#p029`}
                      />
                    </div>
                  }
                />

                <RedeAnalise id="a05" titulo="Achado A05: o balanço dos intercâmbios, identidade por identidade">
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="a05">
                    {frasesA05(a).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    {datasLegiveis(a.exterior)} {datasLegiveis(a.perdas)}
                  </p>
                </RedeAnalise>

                {q && (
                  <RedeAuditoria id="quebra-mmgd" titulo={`Quebra metodológica de ${dataBR(q.dia)}: MMGD estimada no balanço`}>
                    <p className="text-sm text-carvao-muted">{semCaminhosInternos(q.descricao)}</p>
                    <p className="text-sm text-carvao-muted [overflow-wrap:anywhere]">
                      Declaração do ONS ({q.declaracao.conjunto}, <a href={q.declaracao.url} className="text-energia-dark underline underline-offset-4">descrição do conjunto</a>
                      {q.declaracao.capturado_em ? `, capturada em ${carimbo(q.declaracao.capturado_em)}` : ""}): &ldquo;{q.declaracao.trecho}&rdquo; (
                      {q.declaracao.confere === true ? "conferido literalmente" : q.declaracao.confere === false ? "não encontrado na captura" : "descrição não capturada"}).{" "}
                      {q.declaracao.observacao}
                    </p>
                    {conferido(q.conferencia_arquivo) ? (
                      <p className="text-sm text-carvao-muted">
                        No arquivo {q.conferencia_arquivo.arquivo} (sha256 {q.conferencia_arquivo.sha256.slice(0, 12)}…), a geração solar do SIN às 12h passa de{" "}
                        {num(q.conferencia_arquivo.solar_12h_dia_anterior_mwmed, 3)} MWmed em {dataBR(q.conferencia_arquivo.dia_anterior)} para{" "}
                        {num(q.conferencia_arquivo.solar_12h_dia_mwmed, 3)} MWmed em {dataBR(q.conferencia_arquivo.dia)}; a energia solar do dia, de{" "}
                        {num(q.conferencia_arquivo.solar_mwh_dia_anterior, 0)} para {num(q.conferencia_arquivo.solar_mwh_dia, 0)} MWh. O balanço fecha em{" "}
                        {q.conferencia_arquivo.horas_balanco_fecha_dia_anterior} e {q.conferencia_arquivo.horas_balanco_fecha_dia} das 24 horas dos dois dias. Regra de detecção do degrau: {semCaminhosInternos(q.regra_degrau)}.{" "}
                        {semCaminhosInternos(q.efeito)}
                      </p>
                    ) : (
                      <p className="text-sm text-carvao-muted">
                        Conferência no arquivo original não executada nesta publicação
                        {q.conferencia_arquivo && "erro" in q.conferencia_arquivo ? ` (${q.conferencia_arquivo.erro})` : ""}. {semCaminhosInternos(q.efeito)}
                      </p>
                    )}
                  </RedeAuditoria>
                )}

                <RedeAuditoria id="identidades" titulo="As onze identidades conferidas">
                  <RedeRegras regras={(["balanco", "tolerancia_balanco"] as const).map((k) => ({ rotulo: ROTULO_REGRA[k], texto: g.regras[k] }))} />
                  <TabelaInterativa
                    titulo="Todas as identidades, todas as regiões"
                    colunas={colunasIdentidades(b)}
                    linhas={paraTabela(linhasIdentidades(b.identidades))}
                    chaveLinha="id"
                    colunaRotulo="identidade"
                    fonte={FONTE}
                    versao={versao}
                    nomeArquivo="rede-identidades"
                    chaveUrl="ids"
                  />
                </RedeAuditoria>

                <RedeAuditoria id="cobertura-exterior" titulo="Cobertura das fontes e conferência com o outro coletor">
                  <p className="text-sm text-carvao-muted">{textoCobertura("Exterior", g.cobertura.exterior, g.cobertura)}</p>
                  <TabelaInterativa
                    titulo="Dias sem as 24 horas no intercâmbio internacional"
                    colunas={COLUNAS_COBERTURA}
                    linhas={paraTabela(linhasCobertura(g.cobertura.exterior))}
                    chaveLinha="id"
                    colunaRotulo="dia"
                    fonte="ONS, Intercâmbio do SIN com Outros Países"
                    versao={versao}
                    nomeArquivo="rede-cobertura-exterior"
                    chaveUrl="cobx"
                    semLinhas="Todos os dias têm as 24 horas de Argentina e Uruguai."
                  />
                  <p className="text-sm text-carvao-muted">{textoCobertura("Balanço", g.cobertura.balanco, g.cobertura)}</p>
                  <p className="text-sm text-carvao-muted">{textoConferenciaSilver("Intercâmbio do balanço", g.conferencia_silver_principal?.ons_rede_balanco)}</p>
                  <p className="text-sm text-carvao-muted">{textoIdentidadesItaipu(g.exterior.itaipu_identidades)}</p>
                </RedeAuditoria>

                <RedeAuditoria id="dicionarios" titulo="Dicionários de dados do ONS: sinal e definições">
                  <RedeDicionarios dicionarios={[dic.ons_rede_balanco, dic.ons_rede_intercambio_internacional, dic.ons_rede_itaipu].filter(Boolean)} />
                </RedeAuditoria>

                <RedeSeguir ancora="p029" proximo={{ href: `${rotaPainel("p030")}#p030`, pergunta: perguntaPainel("p030") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
