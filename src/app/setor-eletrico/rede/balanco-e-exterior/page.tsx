import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RedeBalanco } from "@/components/energia/RedeBalanco";
import { RedeAviso, RedeCapitulos, RedeDatas, RedeDicionarios, RedeIndisponivel, RedeNavegacao, RedeRegras, RedeSeguir } from "@/components/energia/RedePagina";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, mesAno, num } from "@/lib/energia/formato";
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
  textoMudancaBalanco,
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
  // horas conferidas de cada conta da faixa: o denominador das contagens de resíduo, lido das mesmas identidades da tabela
  const horasDa = (id: string) => b.identidades.find((x) => x.id === id)?.horas ?? null;
  const horasSin = horasDa("balanco.SIN");
  const horasSul = horasDa("perimetro.S");
  const ultimaHoraExterior = (["ARGENTINA", "URUGUAI", "PARAGUAI"] as const)
    .map((p) => g.exterior.por_pais[p]?.ultima_hora)
    .filter((h): h is string => !!h)
    .sort()
    .at(-1);
  const mesesExterior = g.exterior.resumo_12m.ARGENTINA?.meses ?? null;
  const oQueMudou = (
    <>
      {atual.texto} {textoMudancaBalanco(b)}
      <span data-nivel="analisar"> Estado da verificação do balanço: {a.status}.</span>
    </>
  );
  const comoInterpretar = (
    <>
      {a.perimetro} {a.sinais} Uma conta fecha numa hora quando a diferença fica em até {num(b.tolerancia_mwmed, 1)} MWmed. Desde {dataBR(q?.dia)} a geração solar e a carga do
      balanço incluem a MMGD estimada pelo ONS, sem a parcela separada.
    </>
  );
  const naoConcluir = (
    <>
      A causa dos resíduos: a fonte não a informa, e nenhuma das contas tem termo de perdas. Também não se separa, no balanço, o que é medição do que é estimativa da MMGD desde{" "}
      {dataBR(q?.dia)}, nem se comparam geração e carga mensais dos dois lados dessa data.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="rede" />
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["MWmed", "SIN", "ONS", "CCEE", "MMGD"]}
          rotulo="Rede · Balanço e exterior"
          titulo={perguntaPainel("p029")}
          lead="Em cada região, geração menos carga deve igualar o intercâmbio, e o intercâmbio, os fluxos das fronteiras e do exterior. Resíduo é a diferença que sobra quando a conta não fecha."
          recorte={`${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}, hora a hora · SIN e subsistemas · horas e MWh`}
          fonte="ONS, Balanço de Energia nos Subsistemas, intercâmbios e Itaipu"
          referencia={
            <>
              ONS, balanço de energia, intercâmbios e Itaipu, de {dataBR(periodo.inicio)} a {dataBR(periodo.fim)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <RedeDatas
              itens={[
                { rotulo: "Balanço de energia", texto: `até ${dataBR(periodo.fim)}`, natureza: g.proveniencia.balanco.natureza },
                { rotulo: "Intercâmbio com outros países", texto: ultimaHoraExterior ? `até ${horaLocal(ultimaHoraExterior)}` : null, natureza: g.proveniencia.exterior.natureza },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo="Horas com resíduo no SIN e no Sul, e saldo do intercâmbio internacional"
              nota="Valores do SIN e do Sul e do intercâmbio internacional, fixos: a região escolhida abaixo muda só a resposta, as barras e a série mensal. Resíduo não tem causa atribuída pela fonte."
            >
              <Numero
                variante="faixa"
                rotulo="Horas em que geração menos carga não fecha com o intercâmbio, SIN"
                natureza="CALCULADO"
                evidencia={ev.a05_balanco_sin ?? null}
                casas={0}
                periodo={`${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}`}
                cor="var(--cor-energia)"
                nota={horasSin !== null ? `De ${num(horasSin, 0)} horas conferidas. Causa não informada pela fonte.` : "Causa não informada pela fonte."}
                endereco={`${rotaPainel("p029")}#p029`}
              />
              <Numero
                variante="faixa"
                rotulo="Horas em que o intercâmbio do Sul não fecha com fronteira e exterior"
                natureza="CALCULADO"
                evidencia={ev.a05_perimetro_sul ?? null}
                casas={0}
                periodo={`${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}`}
                cor="var(--serie-sm-s)"
                nota={`Intercâmbio do Sul no balanço contra a fronteira com o Sudeste/Centro-Oeste somada a Argentina e Uruguai${horasSul !== null ? `; de ${num(horasSul, 0)} horas conferidas` : ""}.`}
                endereco={`${rotaPainel("p029")}#p029`}
              />
              <Numero
                variante="faixa"
                rotulo="Saldo do intercâmbio internacional em 12 meses (positivo = exportação)"
                natureza="CALCULADO"
                evidencia={ev.exterior_12m ?? null}
                casas={0}
                periodo={mesesExterior ? `${mesAno(mesesExterior[0])} a ${mesAno(mesesExterior[1])}` : undefined}
                cor="var(--serie-5)"
                nota="Soma de Argentina e Uruguai; o Paraguai não tem hora publicada no período."
                endereco={`${rotaPainel("p029")}#p029`}
              />
            </FaixaMetricas>
          }
        >
          O ONS publica, hora a hora, a geração, a carga e o <Termo slug="intercambio">intercâmbio</Termo> de cada região do <Termo slug="sin">SIN</Termo>, e publica à parte o fluxo
          de cada fronteira e o intercâmbio com outros países. Se os números forem consistentes, geração menos carga é igual ao intercâmbio da região, e o intercâmbio da
          região é igual aos fluxos que cruzam as suas fronteiras, com outros países incluídos quando for o caso (o observatório chama esta segunda conta de perímetro).
          O painel faz as duas contas hora a hora e mostra em que horas sobra uma diferença maior que {num(b.tolerancia_mwmed, 1)} MWmed, o resíduo, sem atribuí-lo a perdas
          nem a outra causa.
        </CabecalhoModulo>
        <RedeNavegacao atual="p029" />
        <ModoProfundidade>
          <Bloco id="balanco">
            <PainelEvidencia
              id="p029"
              pergunta="As contas do balanço, conferidas hora a hora"
              subtitulo="Contas do balanço conferidas hora a hora, resíduos e intercâmbio internacional · horas e MWh"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Se o intercâmbio de uma região não fecha com as fronteiras, ou geração menos carga não fecha com o intercâmbio, comparações entre regiões e com o SIN herdam a
                  diferença. Saber onde e quando isso acontece evita atribuir a perdas ou ao exterior o que a fonte não explica.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
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
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<RedeCapitulos atual="p029" />}
                />

                <SecaoDoPainel id="a05" nivel="analisar" titulo="O balanço dos intercâmbios, identidade por identidade">
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="a05">
                    {frasesA05(a).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    {datasLegiveis(a.exterior)} {datasLegiveis(a.perdas)}
                  </p>
                </SecaoDoPainel>

                {q && (
                  <SecaoDoPainel id="quebra-mmgd" nivel="auditar" titulo={`Quebra metodológica de ${dataBR(q.dia)}: MMGD estimada no balanço`}>
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
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="identidades" nivel="auditar" titulo="As onze identidades conferidas">
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
                </SecaoDoPainel>

                <SecaoDoPainel id="cobertura-exterior" nivel="auditar" titulo="Cobertura das fontes e conferência com o outro coletor">
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
                </SecaoDoPainel>

                <SecaoDoPainel id="dicionarios" nivel="auditar" titulo="Dicionários de dados do ONS: sinal e definições">
                  <RedeDicionarios dicionarios={[dic.ons_rede_balanco, dic.ons_rede_intercambio_internacional, dic.ons_rede_itaipu].filter(Boolean)} />
                </SecaoDoPainel>

                <RedeSeguir ancora="p029" proximo={{ href: `${rotaPainel("p030")}#p030`, pergunta: perguntaPainel("p030") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
