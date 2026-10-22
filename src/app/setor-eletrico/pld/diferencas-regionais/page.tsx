import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { PldAviso, PldControles, PldIndisponivel, PldNavegacao, PldPassagem, PldSeguir, PldTextoGold } from "@/components/energia/PldPagina";
import { PldRegional } from "@/components/energia/PldRegional";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import { PARES, atualidadePld, horaPadrao, perguntaPainel, proximoPainel, quatroNoPisoPorAno } from "@/lib/energia/pld";
import { fichasPld, horarioRecentePld } from "@/lib/energia/pld-arquivos";
import type { Par, PldDetalheGold } from "@/lib/energia/tipos-pld";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/pld/diferencas-regionais", {
    title: tx("PLD: diferenças regionais", "PLD: regional differences"),
    description: tx(
      "Quando e quanto os preços dos quatro submercados se separam na mesma hora: amplitude, frequência por par, matriz de diferenças, perfil horário e o sentido do fluxo verificado nas fronteiras na mesma hora, sem diagnóstico causal.",
      "When and by how much the spot prices (PLD) of the four submarkets diverge in the same hour: spread, frequency by pair, difference matrix, hourly profile and the direction of the flow verified at the borders in the same hour, without diagnosing what drives it.",
    ),
    alternates: { canonical: "/setor-eletrico/pld/diferencas-regionais" },
  }, anterior);
}

function fonte(): string {
  return tx("CCEE, PLD horário por submercado", "CCEE, hourly PLD by submarket");
}

export default function PldRegionalPage() {
  const FONTE = fonte();
  const g = lerGold<PldDetalheGold>("pld_detalhe.json");
  if (!integra(g)) return <PldIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const r = g.regional;
  const rec = horarioRecentePld(g.horario_recente.url);
  const atual = atualidadePld(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  // padrão dos pequenos múltiplos: os quatro pares que mais se separaram nos últimos 12 meses (ordem da gold no empate)
  const paresPadrao = PARES.map((p) => ({ p, f: r.separacao.find((s) => s.periodo === "12m" && s.par === p)?.frac_separadas ?? -1 }))
    .sort((a, b) => b.f - a.f)
    .slice(0, 4)
    .map((x) => x.p) as Par[];
  const fichas = fichasPld(g.evidencias.arquivo, PARES.map((p) => `separacao_12m_${p}`));
  const passagens = g.conceito.fontes_textuais.filter((f) => ["d5163_art57_p1_v", "d5163_art57_p4"].includes(f.id) && f.texto);
  // contagem da página PLD (últimos 30 dias acima do limiar) para conferir com a linha "Últimos 30 dias" daqui
  const pldPagina = gold.pld();
  const horasAcimaLimiarPaginaPld = integra(pldPagina) ? pldPagina.periodos["30d"].diferenca.horas_acima_limiar : null;
  const a12 = r.amplitude.find((x) => x.periodo === "12m") ?? null;

  const oQueMudou = <>{atual.texto}</>;
  const comoInterpretar = (
    <>
      {tx(
        "Uma hora conta como separada quando dois preços da mesma hora diferem em mais de R$ 0,01/MWh; diferenças de exatamente um centavo são frequentes e ficam à parte. As contagens acima de R$ 1,00 e de R$ 10,00/MWh mostram quanto a contagem depende do limiar. Todas as diferenças são entre a mesma hora da mesma publicação.",
        "An hour counts as divergent when two prices in the same hour differ by more than R$ 0.01/MWh; differences of exactly one cent are frequent and are kept apart. The counts above R$ 1.00 and R$ 10.00/MWh show how much the count depends on the threshold. All differences are between the same hour of the same publication.",
      )}
    </>
  );
  const naoConcluir = (
    <>
      {tx(
        "A contagem não diz por que os preços se separaram. Sem os limites de intercâmbio integrados, nenhuma hora é classificada como congestionada, e o sentido do fluxo na mesma hora é associação descritiva, não causa. Ano parcial não se compara a ano completo sem ressalva.",
        "The count does not say why prices diverged. Without the interchange limits integrated, no hour is classified as congested, and the direction of the flow in the same hour is a descriptive association, not an explanation. A partial year is not comparable to a complete year without a caveat.",
      )}
    </>
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["CCEE", "ONS"]}
          rotulo={tx("Preço de Liquidação das Diferenças", "Spot price (PLD)")}
          titulo={perguntaPainel("p012")}
          lead={
            <>
              {tx(
                <>
                  A CCEE calcula um PLD para cada um dos quatro <Termo slug="submercado">submercados</Termo>. Na maior parte das horas os quatro são iguais ou quase; aqui, as horas
                  em que se separam, quanto e entre quais regiões.
                </>,
                <>
                  CCEE calculates a spot price (PLD) for each of the four <Termo slug="submercado">submarkets</Termo>. In most hours the four are equal or nearly so; here, the
                  hours in which they diverge, by how much and between which regions.
                </>,
              )}
            </>
          }
          recorte={
            a12
              ? tx(`últimos 12 meses, de ${dataBR(a12.inicio)} a ${dataBR(a12.fim)} · horas, % das horas e R$/MWh`, `last 12 months, from ${dataBR(a12.inicio)} to ${dataBR(a12.fim)} · hours, % of hours and R$/MWh`)
              : tx("horas, % das horas e R$/MWh", "hours, % of hours and R$/MWh")
          }
          fonte={FONTE}
          referencia={
            <>
              {tx(
                `CCEE (PLD até ${horaLocal(g.referencia.ultima_hora_pld)}) e ONS (fluxo entre subsistemas até ${g.referencia.ultima_hora_fluxo ? horaLocal(g.referencia.ultima_hora_fluxo) : "sem dado"}); processado em ${carimbo(g.gerado_em)}.`,
                `CCEE (PLD through ${horaLocal(g.referencia.ultima_hora_pld)}) and ONS (flow between subsystems through ${g.referencia.ultima_hora_fluxo ? horaLocal(g.referencia.ultima_hora_fluxo) : "no data"}); processed on ${carimbo(g.gerado_em)}.`,
              )}
            </>
          }
        >
          {tx(
            <>
              Este painel conta as horas em que os preços se separam, quanto e entre quais regiões. Em Analisar, mostra também o <Termo slug="intercambio">intercâmbio</Termo>{" "}
              verificado na mesma hora.
            </>,
            <>
              This panel counts the hours in which prices diverge, by how much and between which regions. In Analyze, it also shows the{" "}
              <Termo slug="intercambio">interchange</Termo> verified in the same hour.
            </>,
          )}
        </CabecalhoModulo>
        <PldNavegacao atual="p012" />
        <ModoProfundidade>
          <Bloco id="diferencas-regionais">
            <PainelEvidencia
              id="p012"
              pergunta={tx("Horas separadas por par de submercados", "Divergent hours by pair of submarkets")}
              subtitulo={tx("Separação entre os PLD dos submercados na mesma hora · horas, % e R$/MWh", "Divergence between the submarkets' PLD in the same hour · hours, % and R$/MWh")}
              porQueImporta={tx(
                "Com preços iguais, a energia vale o mesmo em todo o sistema; quando se separam, quem compra e vende em regiões diferentes fica exposto à diferença. Pela norma, o cálculo do PLD observa as restrições de transmissão entre submercados.",
                "With equal prices, energy is worth the same across the whole system; when they diverge, whoever buys and sells in different regions is exposed to the difference. Under the rules, the PLD calculation takes into account transmission constraints between submarkets.",
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.regional}
              complementares={[{ rotulo: tx("Sobre o fluxo nas horas separadas", "On the flow in divergent hours"), p: g.proveniencia.fluxos }]}
            >
              <div className="space-y-6">
                {atual.defasada && <PldAviso tipo="alerta">{atual.texto}</PldAviso>}
                <PldRegional
                  contexto={
                    passagens.length === 2 ? (
                      <PldAviso>
                        {tx(
                          "Por que os preços se separam: o Decreto nº 5.163/2004 manda o cálculo do PLD observar as restrições de transmissão entre submercados (art. 57, § 1º, V) e define os submercados pela presença e duração de restrições relevantes de transmissão aos fluxos de energia no SIN (art. 57, § 4º).",
                          "Why prices diverge: Decree No. 5.163/2004 requires the PLD calculation to take into account transmission constraints between submarkets (art. 57, § 1, V) and defines the submarkets by the presence and duration of relevant transmission constraints on energy flows in the SIN (art. 57, § 4).",
                        )}{" "}
                        <Link href="/setor-eletrico/pld#submercados" className="text-energia-dark underline underline-offset-4">
                          {tx("Ver como a página PLD explica a separação", "See how the PLD page explains the divergence")}
                        </Link>
                        .
                      </PldAviso>
                    ) : null
                  }
                  r={r}
                  rec={rec}
                  paresPadrao={paresPadrao}
                  horaInicial={rec ? horaPadrao(rec) : ""}
                  fichas={fichas}
                  ultimaHoraFluxo={g.referencia.ultima_hora_fluxo}
                  fonte={FONTE}
                  versao={versao}
                  horasAcimaLimiarPaginaPld={horasAcimaLimiarPaginaPld}
                  quatroNoPiso={quatroNoPisoPorAno(g.limites.disponivel ? g.limites : null)}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel id="regras" titulo={tx("Regras de separação, limiar e fluxo", "Rules for divergence, threshold and flow")} nivel="auditar">
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted">
                    <li>
                      <PldTextoGold texto={r.regra_separacao} regiao="pld-regra" />
                    </li>
                    <li>
                      <PldTextoGold texto={r.limiar_sensibilidade} regiao="pld-regra" />
                    </li>
                    <li>
                      <PldTextoGold texto={r.regra_fluxo} regiao="pld-regra" />
                    </li>
                  </ul>
                  {passagens.map((p) => (
                    <PldPassagem key={p.id} p={p} />
                  ))}
                </SecaoDoPainel>

                <SecaoDoPainel id="controles" titulo={tx("Controles automáticos da construção", "Automatic build checks")} nivel="auditar">
                  <PldControles controles={g.controles.filter((x) => /Amplitude|pld\.json/i.test(x.nome))} />
                </SecaoDoPainel>

                <PldSeguir ancora="p012" proximo={proximoPainel("p012")} downloads={g.downloads.filter((d) => /separacao|amplitude|horario_recente/.test(d.url))} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
