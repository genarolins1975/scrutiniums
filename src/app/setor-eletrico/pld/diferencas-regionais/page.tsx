import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco } from "@/components/energia/CabecalhoModulo";
import { PldAuditoria, PldAviso, PldCabecalho, PldControles, PldIndisponivel, PldNavegacao, PldPassagem, PldSeguir } from "@/components/energia/PldPagina";
import { PldRegional } from "@/components/energia/PldRegional";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, horaLocal } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { PARES, atualidadePld, horaPadrao, perguntaPainel, proximoPainel } from "@/lib/energia/pld";
import { fichasPld, horarioRecentePld } from "@/lib/energia/pld-arquivos";
import type { Par, PldDetalheGold } from "@/lib/energia/tipos-pld";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "PLD: diferenças regionais",
  description:
    "Quando e quanto os preços dos quatro submercados se separam na mesma hora: amplitude, frequência por par, matriz de diferenças, perfil horário e o sentido do fluxo verificado nas fronteiras na mesma hora, sem diagnóstico causal.",
  alternates: { canonical: "/setor-eletrico/pld/diferencas-regionais" },
};

const FONTE = "CCEE, PLD_HORARIO";

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

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <PldCabecalho siglas={["SIN", "MWmed", "CMO", "CCEE", "ONS"]}
          titulo="Diferenças regionais"
          referencia={
            <>
              CCEE (PLD até {horaLocal(g.referencia.ultima_hora_pld)}) e ONS (fluxo entre subsistemas até {g.referencia.ultima_hora_fluxo ? horaLocal(g.referencia.ultima_hora_fluxo) : "sem dado"});
              processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          A CCEE calcula um PLD para cada um dos quatro <Termo slug="submercado">submercados</Termo>. Na maior parte das horas os quatro são iguais ou quase; este painel conta as horas
          em que se separam, quanto e entre quais regiões, e mostra o <Termo slug="intercambio">intercâmbio</Termo> verificado na mesma hora.
        </PldCabecalho>
        <PldNavegacao atual="p012" />
        <ModoProfundidade>
          <Bloco id="diferencas-regionais">
            <PainelEvidencia
              id="p012"
              pergunta={perguntaPainel("p012")}
              subtitulo="Horas com preços separados, diferença entre o maior e o menor PLD e separação por par, na mesma hora · horas, % e R$/MWh"
              porQueImporta={
                <>
                  Com preços iguais, a energia vale o mesmo em todo o sistema; quando se separam, quem compra e vende em regiões diferentes fica exposto à diferença. Pela norma, o
                  cálculo do PLD observa as restrições de transmissão entre submercados.
                </>
              }
              oQueMudou={<>{atual.texto}</>}
              comoInterpretar={
                <>
                  Uma hora conta como separada quando dois preços da mesma hora diferem em mais de R$ 0,01/MWh; diferenças de exatamente um centavo são frequentes e ficam à parte. As
                  contagens acima de R$ 1,00 e de R$ 10,00/MWh mostram quanto a contagem depende do limiar. Todas as diferenças são entre a mesma hora da mesma publicação.
                </>
              }
              naoConcluir={
                <>
                  A contagem não diz por que os preços se separaram. Sem os limites de intercâmbio integrados, nenhuma hora é classificada como congestionada, e o sentido do fluxo
                  na mesma hora é associação descritiva, não causa. Ano parcial não se compara a ano completo sem ressalva.
                </>
              }
              proveniencia={g.proveniencia.regional}
              complementares={[{ rotulo: "Sobre o fluxo nas horas separadas", p: g.proveniencia.fluxos }]}
            >
              <div className="space-y-6">
                {atual.defasada && <PldAviso tipo="alerta">{atual.texto}</PldAviso>}
                <PldRegional
                  r={r}
                  rec={rec}
                  paresPadrao={paresPadrao}
                  horaInicial={rec ? horaPadrao(rec) : ""}
                  fichas={fichas}
                  ultimaHoraFluxo={g.referencia.ultima_hora_fluxo}
                  fonte={FONTE}
                  versao={versao}
                />

                <PldAuditoria id="regras" titulo="Regras de separação, limiar e fluxo">
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted">
                    <li>{r.regra_separacao}</li>
                    <li>{r.limiar_sensibilidade}</li>
                    <li>{r.regra_fluxo}</li>
                  </ul>
                  {passagens.map((p) => (
                    <PldPassagem key={p.id} p={p} />
                  ))}
                </PldAuditoria>

                <PldAuditoria id="controles" titulo="Controles automáticos da construção">
                  <PldControles controles={g.controles.filter((x) => /Amplitude|pld\.json/i.test(x.nome))} />
                </PldAuditoria>

                <PldSeguir ancora="p012" proximo={proximoPainel("p012")} downloads={g.downloads.filter((d) => /separacao|amplitude|horario_recente/.test(d.url))} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
