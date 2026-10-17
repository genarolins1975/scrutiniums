import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { LinhaDoTempo } from "@/components/energia/LinhaDoTempo";
import { PldLimites } from "@/components/energia/PldLimites";
import { PldAviso, PldControles, PldIndisponivel, PldNavegacao, PldPassagem, PldSeguir } from "@/components/energia/PldPagina";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import {
  categoriasAtos,
  colunasAtos,
  colunasConferencias,
  colunasRegimes,
  SUBMERCADOS,
  anosPermanencia,
  atualidadePld,
  eventosAtos,
  linhasAtos,
  linhasConferencias,
  linhasRegimes,
  notaTetoComConfirmacaoEmpirica,
  perguntaPainel,
  proximoPainel,
} from "@/lib/energia/pld";
import { fichasPld } from "@/lib/energia/pld-arquivos";
import type { PldDetalheGold } from "@/lib/energia/tipos-pld";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/pld/limites", {
    title: tx("PLD: limites, piso e tetos", "PLD: limits, floor and caps"),
    description: tx(
      "Piso, teto horário e teto estrutural do PLD em cada ano, com o ato da ANEEL, a vigência e o nível de conferência de cada valor; calendário dos dias no limite, permanência por ano e empates no piso, com a tolerância monetária documentada.",
      "Floor, hourly cap and structural cap of the spot price (PLD) in each year, with the ANEEL act, the period in force and the verification level of each value; calendar of days at the limit, duration by year and ties at the floor, with the documented monetary tolerance.",
    ),
    alternates: { canonical: "/setor-eletrico/pld/limites" },
  }, anterior);
}

function fonte(): string {
  return tx("CCEE, PLD horário por submercado; ANEEL, atos anuais de limites do PLD", "CCEE, hourly PLD by submarket; ANEEL, annual PLD limits acts");
}

export default function PldLimitesPage() {
  const FONTE = fonte();
  const g = lerGold<PldDetalheGold>("pld_detalhe.json");
  if (!integra(g)) return <PldIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const l = g.limites;
  const atual = atualidadePld(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const anoRef = Number(g.referencia.dia.slice(0, 4));
  const anoParcial = !g.referencia.dia.endsWith("-12-31");
  // contexto que o dado publicado sustenta para anos com muitas horas no piso: a sequência de CMO semanal zero (achado A02, página CMO e formação de preço)
  const seq = g.achados.A02.sequencia_comum_mais_longa;
  const anosNaSequencia = seq && l.disponivel ? anosPermanencia(l).filter((a) => `${a}-01-01` >= seq.inicio && `${a}-12-31` <= seq.fim) : [];
  const notaPermanencia =
    seq && anosNaSequencia.length ? (
      <>
        {tx(
          `${anosNaSequencia.length === 1 ? `O ano de ${anosNaSequencia[0]} inteiro está dentro de um período` : `Os anos de ${anosNaSequencia.join(" e ")} inteiros estão dentro de um período`} de ${num(seq.semanas, 0)} semanas seguidas, de ${dataBR(seq.inicio)} a ${dataBR(seq.fim)} (datas das sextas-feiras que encerram as semanas), em que o custo marginal de operação (CMO) semanal, estimado pelo modelo DECOMP e publicado pelo ONS, foi zero nos quatro subsistemas.`,
          `${anosNaSequencia.length === 1 ? `The whole year ${anosNaSequencia[0]} lies within a period` : `The whole years ${anosNaSequencia.join(" and ")} lie within a period`} of ${num(seq.semanas, 0)} consecutive weeks, from ${dataBR(seq.inicio)} to ${dataBR(seq.fim)} (dates of the Fridays that close the weeks), in which the weekly marginal operating cost (CMO), estimated by the DECOMP model and published by ONS, was zero in all four subsystems.`,
        )}{" "}
        <Link href="/setor-eletrico/pld/cmo-e-formacao#p009" className="text-energia-dark underline underline-offset-4">
          {tx("Ver na página CMO e formação de preço", "See on the CMO and price formation page")}
        </Link>
        {tx(". A fonte não informa a razão dos zeros, e esta página não atribui causa.", ". The source does not report the reason for the zeros, and this page does not attribute one.")}
      </>
    ) : null;
  const passagensLimites = g.conceito.fontes_textuais.filter((f) => ["d5163_art57_p1", "d5163_art57_p2", "d5163_art57_p3", "ren957_art78"].includes(f.id) && f.texto);
  // a regra dos tetos e do piso está na Resolução Normativa ANEEL nº 1.032/2022 (arts. 22 a 24), nas passagens do verbete dos limites do PLD
  const passagensRen1032 = (conceito("limites-do-pld")?.fontes ?? []).filter((f) => f.trecho && /1\.032/.test(f.documento));

  const ultimo = l.disponivel ? l.regimes[l.regimes.length - 1] : null;
  const oQueMudou = (
    <>
      {atual.texto}{" "}
      {tx(
        `Limites vigentes desde ${dataBR(ultimo?.inicio)}: ${ultimo?.ato_pld_min ?? "ato não identificado"}.`,
        `Limits in force since ${dataBR(ultimo?.inicio)}: ${ultimo?.ato_pld_min ?? "act not identified"}.`,
      )}
    </>
  );
  const comoInterpretar = (
    <>
      {tx(
        "Hora no piso é a hora em que o PLD é igual ao piso do ato ao centavo; o mesmo para o teto horário. O teto estrutural vale para a média das 24 horas do dia: pela Resolução Normativa ANEEL nº 1.032/2022 (art. 23, § 3º), se a média diária dos PLDs horários passa dele, a CCEE ajusta a série horária até que a média seja igual ao teto. Um centavo acima do piso já é outro preço e fica contado à parte. Cada ano é comparado com o próprio piso.",
        "An hour at the floor is an hour in which the PLD equals the act's floor to the cent; the same goes for the hourly cap. The structural cap applies to the average of the 24 hours of the day: under ANEEL Normative Resolution No. 1.032/2022 (art. 23, § 3), if the daily average of hourly PLDs exceeds it, CCEE adjusts the hourly series until the average equals the cap. One cent above the floor is already a different price and is counted separately. Each year is compared with its own floor.",
      )}
    </>
  );
  const naoConcluir = (
    <>
      {tx(
        "Permanência no piso não diz que o custo de operar foi baixo nem por quê: diz que o preço calculado ficou no mínimo do ato. O menor valor observado num ano é só conferência e nunca substitui o piso. Ano parcial não se compara a ano completo sem ressalva.",
        "Time at the floor does not say that the operating cost was low, nor why: it says that the calculated price stayed at the act's minimum. The lowest value observed in a year is only a check and never replaces the floor. A partial year is not comparable to a complete year without a caveat.",
      )}
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["ANEEL", "CCEE", "ONS"]}
          rotulo={tx("Preço de Liquidação das Diferenças", "Spot price (PLD)")}
          titulo={perguntaPainel("p010")}
          lead={
            <>
              {tx(
                <>
                  A ANEEL fixa, a cada ano, <Termo slug="limites-do-pld">três limites</Termo> para o PLD: o piso (valor mínimo), o teto horário (o máximo de cada hora) e o teto
                  estrutural (o limite para a média diária dos preços horários). Aqui, quando o preço encostou em cada um.
                </>,
                <>
                  Each year, ANEEL sets <Termo slug="limites-do-pld">three limits</Termo> for the spot price (PLD): the floor (minimum value), the hourly cap (the maximum for each
                  hour) and the structural cap (the limit for the daily average of hourly prices). Here, when the price touched each one.
                </>,
              )}
            </>
          }
          recorte={tx(
            `${anoParcial ? `${anoRef} até ${dataBR(g.referencia.dia)}` : anoRef} · horas e % das horas · limites em R$/MWh nominais`,
            `${anoParcial ? `${anoRef} through ${dataBR(g.referencia.dia)}` : anoRef} · hours and % of hours · limits in nominal R$/MWh`,
          )}
          fonte={FONTE}
          referencia={
            <>
              {tx(
                `CCEE (PLD até ${dataBR(g.referencia.dia)}) e atos anuais da ANEEL${l.disponivel ? ` (${num(l.atos.length, 0)} atos de ${l.atos[0]?.ano ?? ""} a ${l.atos[l.atos.length - 1]?.ano ?? ""})` : ""}; processado em ${carimbo(g.gerado_em)}.`,
                `CCEE (PLD through ${dataBR(g.referencia.dia)}) and annual ANEEL acts${l.disponivel ? ` (${num(l.atos.length, 0)} acts from ${l.atos[0]?.ano ?? ""} to ${l.atos[l.atos.length - 1]?.ano ?? ""})` : ""}; processed on ${carimbo(g.gerado_em)}.`,
              )}
            </>
          }
        >
          {tx(
            "Este painel mostra quando o preço encostou em cada um, com os valores de cada ato da ANEEL e o período em que valem.",
            "This panel shows when the price touched each one, with the values of each ANEEL act and the period in which they apply.",
          )}
        </CabecalhoModulo>
        <PldNavegacao atual="p010" />
        <ModoProfundidade>
          <Bloco id="limites">
            {!l.disponivel ? (
              <Indisponivel
                titulo={tx("Limites do PLD indisponíveis nesta publicação", "PLD limits unavailable in this publication")}
                motivo={
                  <>
                    <TrechoPortugues regiao="pld-limites-motivo">{l.motivo}</TrechoPortugues> {tx("Dependência:", "Dependency:")}{" "}
                    <TrechoPortugues regiao="pld-limites-motivo">{l.dependencia}</TrechoPortugues>.{" "}
                    {tx(
                      "O menor valor observado não substitui o piso, por isso o painel não mostra permanência sem os atos.",
                      "The lowest observed value does not replace the floor, so the panel does not show duration without the acts.",
                    )}
                  </>
                }
              />
            ) : (
              <PainelEvidencia
                id="p010"
                pergunta={tx("Horas no piso e no teto horário, ano a ano", "Hours at the floor and at the hourly cap, year by year")}
                subtitulo={tx("Permanência do PLD nos limites do ano · horas e % das horas", "Duration of the PLD at the year's limits · hours and % of hours")}
                porQueImporta={tx(
                  "No piso e nos tetos, o PLD deixa de acompanhar o custo e passa a ser o limite do ato. Saber quanto tempo o preço passou em cada limite muda a leitura de médias, percentis e diferenças entre regiões.",
                  "At the floor and at the caps, the PLD stops following cost and becomes the act's limit. Knowing how long the price stayed at each limit changes the reading of averages, percentiles and differences between regions.",
                )}
                oQueMudou={oQueMudou}
                comoInterpretar={comoInterpretar}
                naoConcluir={naoConcluir}
                naoConcluirNoCorpo
                proveniencia={g.proveniencia.limites ?? g.proveniencia.distribuicao}
                complementares={[{ rotulo: tx("Sobre a distribuição por regime", "On the distribution by regime"), p: g.proveniencia.distribuicao }]}
              >
                <div className="space-y-6">
                  {atual.defasada && <PldAviso tipo="alerta">{atual.texto}</PldAviso>}
                  <PldLimites
                    l={{ permanencia_anual: l.permanencia_anual, regimes: l.regimes, empates_piso: l.empates_piso, calendario: l.calendario, tolerancia: l.tolerancia }}
                    anos={anosPermanencia(l)}
                    diaReferencia={g.referencia.dia}
                    fichas={fichasPld(g.evidencias.arquivo, SUBMERCADOS.map((sm) => `piso_${anoRef}_${sm}`))}
                    fonte={FONTE}
                    versao={versao}
                    notaPermanencia={notaPermanencia}
                    notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  />

                  <SecaoDoPainel id="atos" titulo={tx("Os atos anuais, com publicação e vigência", "The annual acts, with publication and period in force")} nivel="analisar">
                    <PldAviso>
                      <TrechoPortugues regiao="pld-atos">{l.conferencia_atos.leitura}</TrechoPortugues>
                    </PldAviso>
                    <LinhaDoTempo
                      titulo={tx("Atos da ANEEL que fixaram os limites do PLD", "ANEEL acts that set the PLD limits")}
                      eventos={eventosAtos(l.atos)}
                      categorias={categoriasAtos()}
                      ordem="cronologica"
                    />
                    <TabelaInterativa
                      titulo={tx("Limites por trecho de vigência (o que vale em cada dia)", "Limits by period in force (what applies on each day)")}
                      colunas={colunasRegimes()}
                      linhas={linhasRegimes(l.regimes)}
                      chaveLinha="id"
                      colunaRotulo="inicio"
                      fonte={tx("ANEEL, atos anuais de limites do PLD", "ANEEL, annual PLD limits acts")}
                      versao={versao}
                      nomeArquivo="pld-limites-vigencia"
                      chaveUrl="vig"
                      nota={tx(
                        "Em cada dia, cada limite vem do ato vigente mais recente que informa aquele campo; o último trecho vai até o dia de referência.",
                        "On each day, each limit comes from the most recent act in force that reports that field; the last period runs until the reference day.",
                      )}
                    />
                  </SecaoDoPainel>

                  <SecaoDoPainel id="atos-conferencia" titulo={tx("Cada ato, o documento lido e o nível de conferência", "Each act, the document read and the verification level")} nivel="auditar">
                    <TabelaInterativa
                      titulo={tx("Atos de limites do PLD", "PLD limits acts")}
                      colunas={colunasAtos()}
                      linhas={linhasAtos(l.atos)}
                      chaveLinha="id"
                      colunaRotulo="ato"
                      fonte={tx("ANEEL (via módulo Regulação)", "ANEEL (via the Regulation module)")}
                      versao={versao}
                      nomeArquivo="pld-atos-limites"
                      chaveUrl="atos"
                    />
                    {l.conferencia_atos.pendencias.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                        {l.conferencia_atos.pendencias.map((p) => (
                          <li key={`${p.ano}:${p.item}`}>
                            {p.ano}:{" "}
                            <TrechoPortugues regiao="pld-atos">
                              {p.item} ({p.situacao})
                            </TrechoPortugues>
                            .
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="space-y-2">
                      <p className="rotulo text-mineral">{tx("Trecho literal de cada ato ou documento do processo", "Literal excerpt of each act or document of the proceeding")}</p>
                      {l.atos.map((a) => (
                        <blockquote key={`${a.ato}:${a.ano}`} className="border-l-2 border-energia pl-3 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">
                          <p>
                            {a.trecho ? <TrechoPortugues regiao="pld-passagem-normativa">“{a.trecho}”</TrechoPortugues> : tx("“trecho não publicado”", "“excerpt not published”")}
                          </p>
                          <footer className="mt-1 text-xs text-carvao-muted">
                            <Nome>{a.ato}</Nome>,{" "}
                            {a.dispositivo ? <Nome>{a.dispositivo}</Nome> : tx("dispositivo não identificado", "provision not identified")}.{" "}
                            <a href={a.documento_url ?? a.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                              {tx("endereço oficial", "official address")}
                            </a>
                            {a.documento_copia ? (
                              <>
                                {"; "}
                                <a href={a.documento_copia} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                                  {tx("cópia lida", "copy read")}
                                </a>
                              </>
                            ) : null}
                          </footer>
                        </blockquote>
                      ))}
                    </div>
                  </SecaoDoPainel>

                  <SecaoDoPainel id="norma-limites" titulo={tx("O que a norma diz sobre os limites", "What the rule says about the limits")} nivel="auditar">
                    {passagensRen1032.map((f) => (
                      <blockquote key={f.trecho} className="border-l-2 border-energia pl-3 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">
                        <p>
                          <TrechoPortugues regiao="pld-passagem-normativa">“{f.trecho}”</TrechoPortugues>
                        </p>
                        <footer className="mt-1 text-xs text-carvao-muted">
                          {f.documento}.{" "}
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                            {tx("endereço oficial", "official address")}
                          </a>
                          .{f.parafrase ? <span className="mt-1 block">{f.parafrase}</span> : null}
                        </footer>
                      </blockquote>
                    ))}
                    {passagensLimites.map((p) => (
                      <PldPassagem key={p.id} p={p} />
                    ))}
                    <PldAviso>
                      <TrechoPortugues regiao="pld-teto-estrutural">{notaTetoComConfirmacaoEmpirica(l.nota_teto_estrutural)}</TrechoPortugues>
                    </PldAviso>
                  </SecaoDoPainel>

                  <SecaoDoPainel id="tolerancia" titulo={tx("Tolerância monetária: por que igualdade ao centavo", "Monetary tolerance: why equality to the cent")} nivel="auditar">
                    <p className="text-sm leading-relaxed text-carvao">
                      <TrechoPortugues regiao="pld-tolerancia">{l.tolerancia.regra}</TrechoPortugues>
                    </p>
                    <p className="text-sm leading-relaxed text-carvao-muted">
                      <TrechoPortugues regiao="pld-tolerancia">{l.tolerancia.justificativa}</TrechoPortugues>
                    </p>
                  </SecaoDoPainel>

                  <SecaoDoPainel id="menor-observado" titulo={tx("Conferência: menor e maior valor observado contra o ato", "Check: lowest and highest observed value against the act")} nivel="auditar">
                    <p className="text-sm text-carvao-muted">
                      <TrechoPortugues regiao="pld-menor-observado">{l.regra_menor_observado}</TrechoPortugues>
                    </p>
                    <TabelaInterativa
                      titulo={tx(
                        "Menor e maior PLD horário observado por ano e submercado, contra os limites dos atos",
                        "Lowest and highest hourly PLD observed by year and submarket, against the limits of the acts",
                      )}
                      colunas={colunasConferencias()}
                      linhas={linhasConferencias(l)}
                      chaveLinha="id"
                      colunaRotulo="ano" // i18n: dado
                      fonte={FONTE}
                      versao={versao}
                      nomeArquivo="pld-conferencia-atos"
                      chaveUrl="conf"
                    />
                  </SecaoDoPainel>

                  <SecaoDoPainel id="controles" titulo={tx("Controles automáticos da construção", "Automatic build checks")} nivel="auditar">
                    <PldControles controles={g.controles.filter((x) => /limite|Ato|piso/i.test(x.nome))} />
                  </SecaoDoPainel>

                  <PldSeguir ancora="p010" proximo={proximoPainel("p010")} downloads={g.downloads.filter((d) => /limites_diario/.test(d.url))} />
                </div>
              </PainelEvidencia>
            )}
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
