import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { BarrasMix, COR_FONTE, NOME_FONTE, ORDEM_FONTES } from "@/components/energia/BarrasMix";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, num, pct, rotuloRegra } from "@/lib/energia/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Geração: com que fontes o sistema está atendendo a carga",
  description:
    "Geração verificada por fonte no SIN e nos subsistemas (ONS): composição por janela, comparação com os mesmos dias de anos anteriores, perfil horário e despacho térmico em contexto.",
  alternates: { canonical: "/setor-eletrico/geracao" },
};

export default function GeracaoPage() {
  const g = gold.geracao();
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="geracao" />
        <main className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Geração indisponível" motivo={g?.motivo ?? "A gold de geração não foi gerada nesta publicação."} />
        </main>
      </>
    );
  }
  const sin = g.regioes.find((r) => r.rg === "SIN")!;
  const t = g.termica_contexto;
  const series = ORDEM_FONTES.map((f) => ({ id: f, rotulo: NOME_FONTE[f], cor: COR_FONTE[f] }));
  return (
    <>
      <CabecalhoEnergia atual="geracao" />
      <MarcaVisita secao="energia:geracao" />
      <main className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Geração"
          titulo="Com que fontes o sistema está atendendo a carga?"
          referencia={<>Balanço de Energia nos Subsistemas (ONS), dia de referência {dataBR(g.dia_referencia)}</>}
        >
          A <Termo slug="geracao-centralizada">geração verificada</Termo> das usinas hidráulicas, térmicas, eólicas e fotovoltaicas acompanhadas pelo ONS,
          hora a hora. A micro e minigeração distribuída não entra nesta conta.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="matriz">
            <PainelEvidencia
              id="mix"
              pergunta={`Hidráulica respondeu por ${pct(sin["7d"]?.participacao.hidraulica)} da geração verificada nos últimos 7 dias`}
              subtitulo="Geração verificada do SIN por fonte · % do total por janela"
              porQueImporta={<>A composição mostra quanto o atendimento depende da água, do vento, do sol e das térmicas, e como isso mudou frente ao mesmo período de anos anteriores.</>}
              oQueMudou={<>Nos mesmos 7 dias de {g.comparacao_anual[0]?.ano}, a hidráulica tinha {pct(g.comparacao_anual[0]?.["7d"]?.participacao.hidraulica)} e as térmicas {pct(g.comparacao_anual[0]?.["7d"]?.participacao.termica)}; agora, {pct(sin["7d"]?.participacao.hidraulica)} e {pct(sin["7d"]?.participacao.termica)}.</>}
              comoInterpretar={<>Cada barra soma 100%. Compare a semana atual com as mesmas semanas de anos anteriores para separar o que é padrão da época do que é diferente neste ano.</>}
              naoConcluir={<>Hidráulica, eólica e solar somadas não formam a participação renovável: a térmica do balanço inclui biomassa e outras fontes não separadas. Participação não é capacidade instalada.</>}
              proveniencia={g.proveniencia.geracao}
            >
              <BarrasMix
                linhas={[
                  { rotulo: `Dia ${dataBR(g.dia_referencia)}`, mix: sin.dia },
                  { rotulo: "Últimos 7 dias", mix: sin["7d"], destaque: true },
                  ...g.comparacao_anual.map((a) => ({ rotulo: `Mesmos 7 dias de ${a.ano}`, mix: a["7d"] })),
                  { rotulo: "Últimos 30 dias", mix: sin["30d"] },
                  { rotulo: "Últimos 12 meses", mix: sin["12m"] },
                ]}
              />
              <TabelaDados
                titulo="Geração por fonte e janela, SIN"
                colunas={["Janela", ...ORDEM_FONTES.map((f) => `${NOME_FONTE[f]} (MWmed)`), "Total (MWmed)"]}
                linhas={[
                  ["Dia", ...ORDEM_FONTES.map((f) => sin.dia?.mwmed[f] ?? null), sin.dia?.total_mwmed ?? null],
                  ["7 dias", ...ORDEM_FONTES.map((f) => sin["7d"]?.mwmed[f] ?? null), sin["7d"]?.total_mwmed ?? null],
                  ["30 dias", ...ORDEM_FONTES.map((f) => sin["30d"]?.mwmed[f] ?? null), sin["30d"]?.total_mwmed ?? null],
                  ["12 meses", ...ORDEM_FONTES.map((f) => sin["12m"]?.mwmed[f] ?? null), sin["12m"]?.total_mwmed ?? null],
                ]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="termica">
            <PainelEvidencia
              id="termica-ctx"
              pergunta={`Despacho térmico: ${pct(t.participacao_7d)} da geração nos últimos 7 dias, percentil ${num(t.percentil, 1)} do último ano`}
              subtitulo="Participação térmica em janelas móveis de 7 dias · SIN · %"
              natureza="CALCULADO"
              porQueImporta={<>As térmicas têm <Termo slug="cvu">Custo Variável Unitário</Termo> considerado na programação da operação; este painel mostra a participação delas na geração verificada, comparada à do último ano, sem identificar o motivo do despacho.</>}
              oQueMudou={<>Mediana dos 12 meses anteriores: {pct(t.mediana_365d)}; faixa usual (10º a 90º percentil) de {pct(t.p10_365d)} a {pct(t.p90_365d)}.</>}
              comoInterpretar={<>O percentil compara a semana atual com todas as {t.n_janelas} janelas de 7 dias do ano anterior. Acima do 90º ou abaixo do 10º percentil, a regra &quot;participação térmica incomum&quot; da Visão geral fica ativa.</>}
              naoConcluir={<>O balanço não separa as térmicas por combustível nem por motivo de despacho (mérito, restrição, segurança). O conjunto &quot;Geração Térmica por Motivo de Despacho&quot; está catalogado e ainda não integrado.</>}
              proveniencia={g.proveniencia.termica_7d ?? g.proveniencia.geracao}
              complementares={[{ rotulo: "Sobre a geração por fonte", p: g.proveniencia.geracao }]}
            >
              {g.serie_termica_7d?.length ? (
                <GraficoLinhas
                  titulo="Participação térmica em janelas móveis de 7 dias, último ano, com mediana e faixa usual"
                  dados={g.serie_termica_7d.map((p) => ({ ...p, mediana: t.mediana_365d, p10: t.p10_365d, p90: t.p90_365d }))}
                  chaveX="d"
                  series={[
                    { id: "termica_7d", rotulo: "Térmica, 7 dias", cor: "var(--serie-termica)", espessura: 2.5 },
                    { id: "mediana", rotulo: "Mediana do ano anterior", cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  banda={{ inferior: "p10", superior: "p90", rotulo: "10º a 90º percentil" }}
                  unidade="%"
                  casas={1}
                />
              ) : (
                <Indisponivel titulo="Série da participação térmica indisponível" motivo="A série de janelas de 7 dias não foi gerada nesta publicação." />
              )}
            </PainelEvidencia>
          </Bloco>

          <Bloco id="perfil">
            <PainelEvidencia
              id="perfil-horario"
              pergunta={`Como a geração se distribuiu ao longo de ${dataBR(g.dia_referencia)}?`}
              subtitulo="Geração verificada do SIN por fonte, hora a hora · MWmed · valores observados"
              natureza="OBSERVADO"
              porQueImporta={<>Mostra como cada fonte se distribui ao longo das horas do dia de referência. Pode ser lido ao lado da curva horária do PLD, sem que a coincidência de horários indique causa.</>}
              oQueMudou={<>Pico solar do dia: {num(Math.max(...g.perfil_horario_sin.map((p) => p.solar ?? 0)), 0)} MWmed.</>}
              comoInterpretar={<>Cada linha é uma fonte; a soma das linhas é a geração verificada total em cada hora.</>}
              naoConcluir={<>Um único dia não representa o padrão sazonal; feriados e eventos climáticos alteram o perfil.</>}
              proveniencia={g.proveniencia.geracao}
            >
              <GraficoLinhas
                titulo="Perfil horário da geração do SIN"
                dados={g.perfil_horario_sin.map((p) => ({ ...p, x: p.h }))}
                chaveX="x"
                formatoX="hora"
                series={series}
                unidade="MWmed"
                casas={0}
                zeroNoEixo
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="analisar">
            <PainelEvidencia
              id="trajetoria"
              pergunta="Como cada fonte evoluiu desde 2021?"
              subtitulo="Geração verificada diária do SIN por fonte · MWmed"
              porQueImporta={<>A trajetória mostra a expansão de eólica e solar e a sazonalidade da hidráulica.</>}
              oQueMudou={<>Série de {dataBR(g.serie_sin[0].d)} a {dataBR(g.dia_referencia)}.</>}
              comoInterpretar={<>Médias diárias de valores horários; use o cursor para ler cada dia.</>}
              naoConcluir={<>Crescimento de geração não é crescimento de capacidade instalada; a capacidade está em outro conjunto, catalogado.</>}
              proveniencia={g.proveniencia.geracao}
            >
              <GraficoLinhas titulo="Geração diária por fonte desde 2021" dados={g.serie_sin} chaveX="d" series={series} unidade="MWmed" casas={0} zeroNoEixo />
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="analisar">
            <div className="border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Composição por subsistema, últimos 30 dias</h2>
              <div className="mt-4">
                <BarrasMix linhas={g.regioes.map((r) => ({ rotulo: r.nome, mix: r["30d"] }))} />
              </div>
            </div>
          </Bloco>

          <Bloco nivel="auditar">
            <div className="border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Regras e downloads</h2>
              <dl className="mt-4 grid gap-4 md:grid-cols-2">
                {Object.entries(g.regras).map(([k, v]) => (
                  <div key={k}>
                    <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                    <dd className="mt-1 text-sm text-carvao">{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-5 space-y-1 text-sm">
                {g.downloads.map((d) => (
                  <li key={d.url}><a href={d.url} download className="text-energia-dark underline underline-offset-4">{d.rotulo}</a></li>
                ))}
              </ul>
            </div>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
