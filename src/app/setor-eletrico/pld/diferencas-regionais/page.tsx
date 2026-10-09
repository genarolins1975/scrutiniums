import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { PldAviso, PldControles, PldIndisponivel, PldNavegacao, PldPassagem, PldSeguir } from "@/components/energia/PldPagina";
import { PldRegional } from "@/components/energia/PldRegional";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { PARES, atualidadePld, horaPadrao, perguntaPainel, proximoPainel, quatroNoPisoPorAno } from "@/lib/energia/pld";
import { fichasPld, horarioRecentePld } from "@/lib/energia/pld-arquivos";
import type { Par, PldDetalheGold } from "@/lib/energia/tipos-pld";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "PLD: diferenças regionais",
  description:
    "Quando e quanto os preços dos quatro submercados se separam na mesma hora: amplitude, frequência por par, matriz de diferenças, perfil horário e o sentido do fluxo verificado nas fronteiras na mesma hora, sem diagnóstico causal.",
  alternates: { canonical: "/setor-eletrico/pld/diferencas-regionais" },
};

const FONTE = "CCEE, PLD horário por submercado";

export default function PldRegionalPage() {
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
      Uma hora conta como separada quando dois preços da mesma hora diferem em mais de R$ 0,01/MWh; diferenças de exatamente um centavo são frequentes e ficam à parte. As
      contagens acima de R$ 1,00 e de R$ 10,00/MWh mostram quanto a contagem depende do limiar. Todas as diferenças são entre a mesma hora da mesma publicação.
    </>
  );
  const naoConcluir = (
    <>
      A contagem não diz por que os preços se separaram. Sem os limites de intercâmbio integrados, nenhuma hora é classificada como congestionada, e o sentido do fluxo na mesma hora é
      associação descritiva, não causa. Ano parcial não se compara a ano completo sem ressalva.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["CCEE", "ONS"]}
          rotulo="Preço de Liquidação das Diferenças"
          titulo={perguntaPainel("p012")}
          lead={
            <>
              A CCEE calcula um PLD para cada um dos quatro <Termo slug="submercado">submercados</Termo>. Na maior parte das horas os quatro são iguais ou quase; aqui, as horas em
              que se separam, quanto e entre quais regiões.
            </>
          }
          recorte={a12 ? `últimos 12 meses, de ${dataBR(a12.inicio)} a ${dataBR(a12.fim)} · horas, % das horas e R$/MWh` : "horas, % das horas e R$/MWh"}
          fonte={FONTE}
          referencia={
            <>
              CCEE (PLD até {horaLocal(g.referencia.ultima_hora_pld)}) e ONS (fluxo entre subsistemas até {g.referencia.ultima_hora_fluxo ? horaLocal(g.referencia.ultima_hora_fluxo) : "sem dado"});
              processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Este painel conta as horas em que os preços se separam, quanto e entre quais regiões. Em Analisar, mostra também o <Termo slug="intercambio">intercâmbio</Termo>{" "}
          verificado na mesma hora.
        </CabecalhoModulo>
        <PldNavegacao atual="p012" />
        <ModoProfundidade>
          <Bloco id="diferencas-regionais">
            <PainelEvidencia
              id="p012"
              pergunta="Horas separadas por par de submercados"
              subtitulo="Horas com preços separados, diferença entre o maior e o menor PLD e separação por par, na mesma hora · horas, % e R$/MWh"
              porQueImporta={
                <>
                  Com preços iguais, a energia vale o mesmo em todo o sistema; quando se separam, quem compra e vende em regiões diferentes fica exposto à diferença. Pela norma, o
                  cálculo do PLD observa as restrições de transmissão entre submercados.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.regional}
              complementares={[{ rotulo: "Sobre o fluxo nas horas separadas", p: g.proveniencia.fluxos }]}
            >
              <div className="space-y-6">
                {atual.defasada && <PldAviso tipo="alerta">{atual.texto}</PldAviso>}
                {passagens.length === 2 && (
                  <PldAviso>
                    Por que os preços se separam: o Decreto nº 5.163/2004 manda o cálculo do PLD observar as restrições de transmissão entre submercados (art. 57, § 1º, V) e define os
                    submercados pela presença e duração de restrições relevantes de transmissão aos fluxos de energia no SIN (art. 57, § 4º).{" "}
                    <Link href="/setor-eletrico/pld#submercados" className="text-energia-dark underline underline-offset-4">
                      Ver como a página PLD explica a separação
                    </Link>
                    .
                  </PldAviso>
                )}
                <PldRegional
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

                <SecaoDoPainel id="regras" titulo="Regras de separação, limiar e fluxo" nivel="auditar">
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted">
                    <li>{r.regra_separacao}</li>
                    <li>{r.limiar_sensibilidade}</li>
                    <li>{r.regra_fluxo}</li>
                  </ul>
                  {passagens.map((p) => (
                    <PldPassagem key={p.id} p={p} />
                  ))}
                </SecaoDoPainel>

                <SecaoDoPainel id="controles" titulo="Controles automáticos da construção" nivel="auditar">
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
