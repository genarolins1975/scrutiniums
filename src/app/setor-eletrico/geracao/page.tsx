import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { BarrasMix, COR_FONTE, NOME_FONTE, ORDEM_FONTES } from "@/components/energia/BarrasMix";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { SankeyFontes } from "@/components/energia/SankeyFontes";
import { EvolucaoMatriz, type MesMatriz } from "@/components/energia/EvolucaoMatriz";
import { MapaBrasil } from "@/components/energia/MapaBrasil";
import { MetricaHero } from "@/components/energia/MetricaHero";
import { IconeSetor } from "@/components/energia/IconeSetor";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, num, pct, rotuloRegra } from "@/lib/energia/formato";
import type { FonteGeracao, Submercado } from "@/lib/energia/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Geração: de onde vem a eletricidade brasileira",
  description:
    "Geração verificada por fonte no SIN e nos subsistemas (ONS): o fluxo das fontes para as regiões, a evolução da matriz mês a mês, a comparação com anos anteriores, o perfil horário e o despacho térmico em contexto.",
  alternates: { canonical: "/setor-eletrico/geracao" },
};

const FAIXAS_DIA = [
  { de: "00:00", ate: "05:00", rotulo: "madrugada" },
  { de: "06:00", ate: "11:00", rotulo: "manhã" },
  { de: "12:00", ate: "17:00", rotulo: "tarde" },
  { de: "18:00", ate: "23:00", rotulo: "noite" },
];
const SMS: Submercado[] = ["N", "NE", "SE", "S"];

/** Média mensal da geração por fonte a partir da série diária (só dias com as quatro fontes). */
function mesesMatriz(serie: ({ d: string } & Record<FonteGeracao, number | null>)[]): MesMatriz[] {
  const por = new Map<string, { soma: Record<FonteGeracao, number>; dias: number }>();
  for (const p of serie) {
    if (ORDEM_FONTES.some((f) => typeof p[f] !== "number")) continue;
    const m = p.d.slice(0, 7);
    const acc = por.get(m) ?? { soma: { hidraulica: 0, termica: 0, eolica: 0, solar: 0 }, dias: 0 };
    for (const f of ORDEM_FONTES) acc.soma[f] += p[f] as number;
    acc.dias += 1;
    por.set(m, acc);
  }
  return Array.from(por.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([m, acc]) => {
      const mwmed = Object.fromEntries(ORDEM_FONTES.map((f) => [f, acc.soma[f] / acc.dias])) as Record<FonteGeracao, number>;
      return { m, mwmed, total: ORDEM_FONTES.reduce((s, f) => s + mwmed[f], 0), dias: acc.dias };
    });
}

export default function GeracaoPage() {
  const g = gold.geracao();
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="geracao" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Geração indisponível" motivo={g?.motivo ?? "Os dados processados de geração não foram gerados nesta publicação."} />
        </main>
      </>
    );
  }
  const sin = g.regioes.find((r) => r.rg === "SIN")!;
  const t = g.termica_contexto;
  const series = ORDEM_FONTES.map((f) => ({ id: f, rotulo: NOME_FONTE[f], cor: COR_FONTE[f] }));
  const meses = mesesMatriz(g.serie_sin);
  const por = Object.fromEntries(g.regioes.map((r) => [r.rg, r]));
  const hesSerie = g.serie_sin.slice(-90).map((p) => {
    const tot = ORDEM_FONTES.reduce((s, f) => s + (p[f] ?? 0), 0);
    return tot > 0 ? (100 * ((p.hidraulica ?? 0) + (p.eolica ?? 0) + (p.solar ?? 0))) / tot : null;
  });
  return (
    <>
      <CabecalhoEnergia atual="geracao" />
      <MarcaVisita secao="energia:geracao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Geração"
          titulo="Com que fontes o sistema está atendendo a carga?"
          referencia={<>Balanço de Energia nos Subsistemas (ONS), dia de referência {dataBR(g.dia_referencia)}</>}
        >
          A <Termo slug="geracao-centralizada">geração verificada</Termo> das usinas hidráulicas, térmicas, eólicas e fotovoltaicas no balanço do ONS,
          hora a hora, em <Unidade u="MWmed" />. Em 29/04/2023 o balanço muda de regime: a solar do SIN
          {g.degrau_solar ? ` passa de ${num(g.degrau_solar.solar_sin_antes, 0)} para ${num(g.degrau_solar.solar_sin_depois, 0)} MWmed de um dia para o outro` : " mais que dobra de um dia para o outro"},
          na mesma data em que o ONS passa a incluir na carga a estimativa de micro e minigeração distribuída. A leitura de que o salto é essa
          estimativa é da plataforma, a partir do dado, e não foi conferida em documento do ONS. Por isso as comparações desta página só usam
          períodos posteriores a essa data.
        </CabecalhoModulo>

        {/* resposta curta */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border border-linha bg-superficie p-5 md:col-span-2">
            <MetricaHero
              icone="geracao"
              rotulo={`Hidráulica, eólica e solar · SIN · 7 dias até ${dataBR(sin["7d"]?.fim)}`}
              valor={pct(sin["7d"]?.hes)}
              unidade="da geração verificada"
              natureza="CALCULADO"
              variacao={sin["7d"] ? `hidráulica ${pct(sin["7d"].participacao.hidraulica)} · eólica ${pct(sin["7d"].participacao.eolica)} · solar ${pct(sin["7d"].participacao.solar)} · térmica ${pct(sin["7d"].participacao.termica)}` : undefined}
              sparkline={hesSerie}
              cor="var(--serie-eolica)"
              contexto={<>A linha mostra os últimos 90 dias. Não é a participação renovável: o balanço não separa a térmica por combustível.</>}
              tamanho="medio"
            />
          </div>
          <div className="border border-linha bg-superficie p-5">
            <MetricaHero
              icone="termica"
              rotulo="Térmicas · 7 dias"
              valor={pct(t.participacao_7d)}
              unidade="da geração"
              natureza="CALCULADO"
              variacao={`percentil ${num(t.percentil, 1)} do último ano`}
              cor="var(--serie-termica)"
              contexto={<>Mediana dos 12 meses anteriores: {pct(t.mediana_365d)}; faixa usual de {pct(t.p10_365d)} a {pct(t.p90_365d)}.</>}
              href="#termica"
              hrefRotulo="Térmicas em contexto"
              tamanho="medio"
            />
          </div>
        </div>

        {/* hero: sankey */}
        <section id="fluxo" aria-labelledby="fluxo-h" className="scroll-mt-24 pt-10">
          <p className="rotulo flex items-center gap-2 text-mineral">
            <IconeSetor tipo="geracao" tamanho={15} /> Visual principal
          </p>
          <h2 id="fluxo-h" className="mt-2 font-serif text-2xl leading-snug text-carvao md:text-3xl">
            De onde vem a eletricidade brasileira?
          </h2>
          <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Cada fita liga uma fonte a um subsistema; a largura é a geração verificada naquela janela. A soma de tudo é o SIN.
          </p>
          <div className="mt-5 border border-linha bg-superficie p-4 md:p-6">
            <SankeyFontes regioes={g.regioes} diaReferencia={g.dia_referencia} />
          </div>
        </section>

        <ModoProfundidade>
          <Bloco id="matriz">
            <PainelEvidencia
              id="mix"
              pergunta={`Hidráulica respondeu por ${pct(sin["7d"]?.participacao.hidraulica)} da geração verificada nos últimos 7 dias`}
              subtitulo="Geração verificada do SIN por fonte · % do total por janela"
              porQueImporta={<>A composição mostra quanto do atendimento veio da água, do vento, do sol e das térmicas no balanço do ONS, comparado com o mesmo período de anos anteriores dentro do mesmo regime do dado.</>}
              oQueMudou={
                g.comparacao_anual[0] ? (
                  <>Nos mesmos 7 dias de {g.comparacao_anual[0].ano}, a hidráulica tinha {pct(g.comparacao_anual[0]["7d"]?.participacao.hidraulica)} e as térmicas {pct(g.comparacao_anual[0]["7d"]?.participacao.termica)}; agora, {pct(sin["7d"]?.participacao.hidraulica)} e {pct(sin["7d"]?.participacao.termica)}.</>
                ) : (
                  <>Não há ano anterior com a mesma janela inteira dentro do regime atual do balanço.</>
                )
              }
              comoInterpretar={<>Cada barra soma 100%. Só aparecem anos cuja janela inteira é posterior a 29/04/2023{g.anos_fora_do_regime?.length ? ` (${g.anos_fora_do_regime.join(", ")} ficam de fora por atravessarem ou antecederem a mudança de regime)` : ""}.</>}
              naoConcluir={<>Hidráulica, eólica e solar somadas não formam a participação renovável: o conjunto não separa a térmica por combustível. Participação não é capacidade instalada.</>}
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

          <Bloco id="evolucao">
            <PainelEvidencia
              id="evolucao-matriz"
              pergunta="Como a matriz de geração mudou desde 2021?"
              subtitulo="Participação mensal de cada fonte na geração verificada do SIN · % · com controle de tempo e comparador de meses"
              natureza="CALCULADO"
              porQueImporta={<>A área empilhada mostra, mês a mês, quanto de cada fonte compôs a geração verificada; o controle de tempo destaca um mês, e o comparador põe dois meses lado a lado em pontos percentuais.</>}
              oQueMudou={
                sin["12m"] && g.mix_12m_anterior_sin
                  ? `Participação nos 12 meses até ${dataBR(g.dia_referencia)}, contra os 12 meses anteriores: ${ORDEM_FONTES.map((f) => `${NOME_FONTE[f]} ${pct(sin["12m"]!.participacao[f])} (antes ${pct(g.mix_12m_anterior_sin!.participacao[f])})`).join("; ")}.`
                  : `Série de ${dataBR(g.serie_sin[0].d)} a ${dataBR(g.dia_referencia)}; sem dois períodos de 12 meses no regime atual para comparar.`
              }
              comoInterpretar={<>Média mensal das médias diárias de geração verificada. A linha vertical marca a mudança de regime de 29/04/2023 (leitura a partir do dado): depois dela a solar do balanço inclui a estimativa de micro e minigeração distribuída, e comparações que atravessam a linha não são homogêneas.</>}
              naoConcluir={<>Participação não é capacidade instalada nem energia contratada. A capacidade está em outro conjunto, catalogado e não integrado.</>}
              proveniencia={g.proveniencia.geracao}
            >
              <EvolucaoMatriz meses={meses} regime={g.inicio_regime_atual ?? "2023-04-29"} />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="mapa">
            <PainelEvidencia
              id="mapa-geracao"
              pergunta="Qual é a fonte principal de cada região?"
              subtitulo="Geração verificada por subsistema nos últimos 7 dias · fonte com maior participação e composição"
              natureza="CALCULADO"
              porQueImporta={<>A geografia da geração explica parte dos fluxos entre regiões: onde a eólica domina, onde a hidráulica domina e onde as térmicas pesam mais.</>}
              oQueMudou={<>{SMS.map((sm) => { const m = por[sm]?.["7d"]; if (!m) return `${por[sm]?.nome}: sem dado`; const p = (Object.entries(m.participacao) as [FonteGeracao, number][]).sort((a, b) => b[1] - a[1])[0]; return `${por[sm].nome}: ${NOME_FONTE[p[0]].toLowerCase()} ${pct(p[1])}`; }).join("; ")}.</>}
              comoInterpretar={<>A cor de cada região é a soma de hidráulica, eólica e solar; o chip mostra a fonte com maior participação. Toque numa região para ver a composição completa.</>}
              naoConcluir={<>Um mapa de usinas, com localização, potência e proprietário, depende do conjunto de capacidade instalada por usina, catalogado e ainda não integrado. Este mapa mostra só a geração agregada por subsistema.</>}
              proveniencia={g.proveniencia.geracao}
            >
              <MapaBrasil
                titulo="Fonte principal de cada subsistema nos últimos 7 dias"
                tom="geracao"
                valores={Object.fromEntries(
                  SMS.map((sm) => {
                    const m = por[sm]?.["7d"];
                    if (!m) return [sm, { valor: "sem dado", intensidade: null }];
                    const p = (Object.entries(m.participacao) as [FonteGeracao, number][]).sort((a, b) => b[1] - a[1])[0];
                    return [sm, { valor: `${pct(p[1], 0)} ${NOME_FONTE[p[0]].toLowerCase()}`, sub: `${num(m.total_mwmed, 0)} MWmed`, intensidade: m.hes / 100 }];
                  }),
                )}
                legenda="Cor: soma de hidráulica, eólica e solar na geração verificada da região (mais escuro, maior). Chip: fonte com maior participação e geração média total."
                lista="abaixo"
                detalhes={Object.fromEntries(
                  SMS.map((sm) => {
                    const m = por[sm]?.["7d"];
                    return [sm, m ? <BarrasMix key={sm} linhas={[{ rotulo: "7 dias", mix: m }]} /> : <p key={sm}>Sem dado.</p>];
                  }),
                )}
              />
              <p className="mt-3 text-xs text-mineral">
                Usinas individuais: conjunto de capacidade instalada catalogado em <Link href="/setor-eletrico/dados" className="text-energia-dark underline underline-offset-4">Dados</Link>, ainda não integrado.
              </p>
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
                    { id: "mediana", rotulo: "Mediana do ano anterior", sigla: "Mediana", cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  banda={{ inferior: "p10", superior: "p90", rotulo: "10º a 90º percentil" }}
                  unidade="%"
                  casas={1}
                  ensina={{ texto: "Participação térmica: geração térmica dividida pela soma das quatro fontes, em janelas móveis de 7 dias.", fonte: "ONS, balanço de energia; cálculo da Scrutiniums", href: "/setor-eletrico/aprenda/cvu", hrefRotulo: "Entenda CVU" }}
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
              porQueImporta={<>Mostra como cada fonte se distribui ao longo das horas do dia de referência: a solar concentrada no dia, a eólica e a hidráulica ao longo das 24 horas. Pode ser lido ao lado da curva horária do PLD, sem que a coincidência de horários indique causa.</>}
              oQueMudou={<>Pico solar do dia: {num(Math.max(...g.perfil_horario_sin.map((p) => p.solar ?? 0)), 0)} <Unidade u="MWmed" />.</>}
              comoInterpretar={<>Cada linha é uma fonte; a soma das linhas é a geração verificada total em cada hora. As faixas de fundo marcam madrugada, manhã, tarde e noite.</>}
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
                faixasX={FAIXAS_DIA}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="analisar">
            <PainelEvidencia
              id="trajetoria"
              pergunta="Como cada fonte evoluiu desde 2021?"
              subtitulo="Geração verificada diária do SIN por fonte · MWmed"
              porQueImporta={<>A trajetória mostra como cada fonte variou desde 2021. A linha vertical marca 29/04/2023: dali em diante o balanço passa a incluir a geração estimada de micro e minigeração distribuída na solar (leitura a partir do dado), e o salto da solar nessa data não é expansão física.</>}
              oQueMudou={
                <>
                  {sin["12m"] && g.mix_12m_anterior_sin
                    ? `Participação nos 12 meses até ${dataBR(g.dia_referencia)}, contra os 12 meses anteriores: ${ORDEM_FONTES.map((f) => `${NOME_FONTE[f]} ${pct(sin["12m"]!.participacao[f])} (antes ${pct(g.mix_12m_anterior_sin!.participacao[f])})`).join("; ")}.`
                    : `Série de ${dataBR(g.serie_sin[0].d)} a ${dataBR(g.dia_referencia)}; sem dois períodos de 12 meses no regime atual para comparar.`}
                </>
              }
              comoInterpretar={<>Médias diárias de valores horários; use o cursor para ler cada dia. A marca da mudança de regime aparece na dica ao passar por ela.</>}
              naoConcluir={<>Crescimento de geração não é crescimento de capacidade instalada; a capacidade está em outro conjunto, catalogado.</>}
              proveniencia={g.proveniencia.geracao}
            >
              <GraficoLinhas
                titulo="Geração diária por fonte desde 2021"
                dados={g.serie_sin}
                chaveX="d"
                series={series}
                unidade="MWmed"
                casas={0}
                zeroNoEixo
                marcos={[{ x: g.inicio_regime_atual ?? "2023-04-29", rotulo: "29/04/2023: mudança de regime", descricao: g.degrau_solar ? `a solar do SIN no balanço passa de ${num(g.degrau_solar.solar_sin_antes, 0)} para ${num(g.degrau_solar.solar_sin_depois, 0)} MWmed de um dia para o outro (leitura a partir do dado)` : undefined }]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="analisar">
            <div className="border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Composição por subsistema, últimos 30 dias</h2>
              <div className="mt-4">
                <BarrasMix linhas={g.regioes.map((r) => ({ rotulo: r.nome, mix: r["30d"] }))} tabela />
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
