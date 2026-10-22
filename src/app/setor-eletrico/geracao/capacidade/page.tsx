import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GeracaoCapacidadeAneel, GeracaoCapacidadeDistribuicao } from "@/components/energia/GeracaoCapacidade";
import {
  GeracaoAviso,
  GeracaoDatas,
  GeracaoFrases,
  GeracaoIndisponivel,
  GeracaoNavegacao,
  GeracaoRecorte,
  GeracaoRegras,
  GeracaoSeguir,
} from "@/components/energia/GeracaoPagina";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import {
  CATEGORIAS_CAPACIDADE,
  COR_CATEGORIA,
  colunasCapacidade,
  colunasFcAcima100,
  colunasMmgdCapacidade,
  coberturaDaPotencia,
  curtoCategoria,
  diferencasAneelOns,
  downloadsDoPainel,
  emPortugues,
  linhasCapacidade,
  linhasFcAcima100,
  linhasFcConferencia,
  linhasFcMensal,
  linhasMmgdCapacidade,
  linhasPotenciaMensal,
  mwmed,
  paraTabela,
  perguntaPainel,
  respostaCapacidade,
  rotaPainel,
  rotuloCasamento,
  rotuloRegraGeracao,
  situacaoMensal,
  textoMudancaMensal,
  textoSemComparacaoMensal,
  vereditoCapacidade,
} from "@/lib/energia/geracao";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { rotuloGold } from "@/lib/energia/i18n/geracao";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/geracao/capacidade", {
    title: tx("Geração: quanto está instalado e quanto produz", "Generation: how much is installed and how much it produces"),
    description: tx(
      "Potência das usinas despachadas pelo ONS por fonte, fator de capacidade com a potência em operação de cada mês, distribuição por usina, a capacidade da ANEEL e a micro e minigeração distribuída lado a lado nas mesmas datas, sem somar universos diferentes.",
      "Capacity of the plants dispatched by the ONS by source, capacity factor with each month's capacity in operation, distribution by plant, ANEEL capacity and distributed micro and mini generation side by side on the same dates, without adding up different universes.",
    ),
    alternates: { canonical: "/setor-eletrico/geracao/capacidade" },
  }, anterior);
}

/** Categorias que abrem visíveis na série mensal (as demais ficam na legenda, ocultas). */
const VISIVEIS_MENSAL = ["hidraulica", "eolica", "solar_centralizada"];

export default function GeracaoCapacidadePage() {
  const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json");
  if (!integra(g) || !g.capacidade) {
    return (
      <GeracaoIndisponivel
        motivo={
          (g as { motivo?: string } | null)?.motivo ??
          (g ? tx("A capacidade e o fator de capacidade não estão na base publicada nesta atualização.", "Capacity and the capacity factor are not in the published dataset in this update.") : undefined)
        }
      />
    );
  }
  const idioma = idiomaEnergia();
  const FONTE = tx("ONS, Capacidade Instalada de Geração e Geração por Usina", "ONS, installed generation capacity and generation by plant datasets");
  const FONTE_ANEEL = tx("ANEEL, série histórica da capacidade instalada por tipo de geração", "ANEEL, historical series of installed capacity by generation type");
  const NOME_CONJUNTO = tx("o fator de capacidade mensal", "the monthly capacity factor");
  const CURTO_CATEGORIA = curtoCategoria();
  const ROTULO_CASAMENTO = rotuloCasamento();
  const ROTULO_REGRA = rotuloRegraGeracao();
  const c = g.capacidade;
  const ev = g.evidencias;
  const u = c.ultimos_12m;
  const ultimoMes = c.mensal.meses[c.mensal.meses.length - 1] ?? null;
  const atual = situacaoMensal(ultimoMes, g.gerado_em, NOME_CONJUNTO);
  const versao = ultimoMes ?? g.dia_referencia;
  const periodo12 = u ? tx(`${mesAno(u.inicio)} a ${mesAno(u.fim)}`, `${mesAno(u.inicio)} to ${mesAno(u.fim)}`) : tx("12 meses", "12 months");
  const mesUltimo = ultimoMes ? mesAno(ultimoMes) : tx("mês não publicado", "month not published");
  const linhas = linhasCapacidade(c);
  const retrato = [...c.retrato.por_categoria].sort((a, b) => (b.mw ?? 0) - (a.mw ?? 0));
  // as duas figuras seguem a mesma ordem de fontes (da maior potência para a menor): instalado e produzido lado a lado, linha com linha
  const fcNaOrdem = retrato.map((x) => linhas.find((l) => l.id === x.categoria)).filter((l): l is NonNullable<typeof l> => !!l);
  const ocultas = CATEGORIAS_CAPACIDADE.filter((k) => !VISIVEIS_MENSAL.includes(k));
  const mmgd = c.contexto.mmgd;
  const siga = c.contexto.siga;
  const sigaHist = c.contexto.siga_historico;
  const par = c.pareamento;

  const diferencas = diferencasAneelOns(linhas);
  const parteDaPotencia = coberturaDaPotencia(linhas);
  const usinasNoRetrato = Object.fromEntries(c.retrato.por_categoria.map((x) => [x.categoria, x.usinas]));
  // o que mudou: o fator de capacidade e a potência das fontes de referência no último mês completo, contra o mês anterior e o mesmo mês de um ano antes
  const mudancas = [
    textoMudancaMensal({
      nome: tx("o fator de capacidade das eólicas", "the capacity factor of wind plants"),
      unidade: "%",
      percentual: true,
      casas: 1,
      meses: c.mensal.meses,
      valores: c.mensal.fator_capacidade_pct.eolica ?? [],
      mes: ultimoMes,
    }),
    textoMudancaMensal({
      nome: tx("o fator de capacidade da solar centralizada", "the capacity factor of centralized solar"),
      unidade: "%",
      percentual: true,
      casas: 1,
      meses: c.mensal.meses,
      valores: c.mensal.fator_capacidade_pct.solar_centralizada ?? [],
      mes: ultimoMes,
    }),
    textoMudancaMensal({
      nome: tx("a potência eólica em operação comercial, média do mês,", "wind capacity in commercial operation, monthly average,"),
      unidade: "MW",
      casas: 0,
      meses: c.mensal.meses,
      valores: c.mensal.potencia_operacional_mw.eolica ?? [],
      mes: ultimoMes,
    }),
  ].filter((x) => x);
  const oQueMudou = (
    <>
      {mudancas.join(" ")} {textoSemComparacaoMensal(ultimoMes, g.gerado_em, NOME_CONJUNTO)}
    </>
  );
  const comoInterpretar = tx(
    <>
      Fator de capacidade = geração do mês ÷ (potência em operação comercial média do mês × horas com dado), somado nos 12 meses como razão de energias, só nas usinas pareadas com a Capacidade
      Instalada do ONS. A cobertura diz quanto da geração da categoria entrou no pareamento. O retrato é a potência de {dataBR(c.retrato.data)}; a série mensal usa a potência de cada mês.
    </>,
    <>
      Capacity factor = generation in the month ÷ (average capacity in commercial operation in the month × hours with data), added up over the 12 months as a ratio of energies, only for plants matched with the ONS
      installed capacity dataset. Coverage says how much of the category&apos;s generation entered the matching. The snapshot is the capacity on {dataBR(c.retrato.data)}; the monthly series uses each month&apos;s capacity.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que a capacidade da ANEEL e a do ONS medem o mesmo universo: a ANEEL inclui usinas fora do despacho do ONS, e as duas nunca são somadas. Que a micro e minigeração distribuída cadastrada
      tenha fator de capacidade calculável aqui: a geração dela é estimada pelo ONS e a razão entre as duas não é publicada. Por que uma usina tem fator de capacidade baixo ou alto: o painel não
      separa causas como entrada em operação no período, manutenção ou restrição pelo ONS.
    </>,
    <>
      That ANEEL capacity and ONS capacity measure the same universe: ANEEL includes plants outside ONS dispatch, and the two are never added up. That registered distributed micro and mini generation
      has a capacity factor that can be calculated here: its generation is estimated by the ONS and the ratio between the two is not published. Why a plant has a low or high capacity factor: the panel does not
      separate causes such as entry into operation during the period, maintenance or restriction by the ONS.
    </>,
  );
  const linkMatriz = (
    <Link href={`${rotaPainel("p021")}#composicao`} className="text-energia-dark underline underline-offset-4">
      {tx("matriz efetiva", "effective mix")}
    </Link>
  );
  const fcOns = linhas
    .filter((l) => l.fc_ons_pct !== null && l.fc_pct !== null)
    .map((l) =>
      tx(`${l.categoria.toLowerCase()} ${num(l.fc_ons_pct, 1)}% contra ${num(l.fc_pct, 1)}% do painel`, `${l.categoria.toLowerCase()} ${num(l.fc_ons_pct, 1)}% against ${num(l.fc_pct, 1)}% in the panel`),
    )
    .join("; ");
  const parteTexto = parteDaPotencia
    .map((x) =>
      tx(
        `${x.categoria.toLowerCase()} ${num(x.fc, 1)}% usa ${num(x.denominador, 1)} MW de potência com dado de geração, de ${num(x.potencia, 1)} MW em operação em média (${num(x.pct, 0)}%)`,
        `${x.categoria.toLowerCase()} ${num(x.fc, 1)}% uses ${num(x.denominador, 1)} MW of capacity with generation data, out of ${num(x.potencia, 1)} MW in operation on average (${num(x.pct, 0)}%)`,
      ),
    )
    .join("; ");
  const diferencasTexto = diferencas
    .map((x) => tx(`${x.categoria.toLowerCase()}, ${num(x.aneel, 1)} MW na ANEEL contra ${num(x.ons, 1)} MW no ONS`, `${x.categoria.toLowerCase()}, ${num(x.aneel, 1)} MW at ANEEL against ${num(x.ons, 1)} MW at the ONS`))
    .join("; ");
  const casamentos = Object.entries(par.usina_meses_por_casamento)
    .map(([k, n]) => `${ROTULO_CASAMENTO[k] ?? k}, ${num(n, 0)}`)
    .join("; ");
  const acimaPorCategoria = Object.entries(par.fc_acima_de_100.por_categoria)
    .map(([k, n]) => `${CURTO_CATEGORIA[k as keyof typeof CURTO_CATEGORIA] ?? k} ${num(n ?? 0, 0)}`)
    .join("; ");
  const semFonte = tx("sem fonte", "no source");
  const fontesEmOutros = (siga?.fontes_em_outros ?? [])
    .map((x) => {
      const nome = x.fonte ?? x.origem;
      return `${nome ? rotuloGold(nome, idioma) : semFonte} (${num(x.mw, 1)} MW)`;
    })
    .join("; ");
  const tiposFora = sigaHist
    ? Object.entries(sigaHist.tipos_fora_dos_grupos)
        .map(([k, n]) => tx(`${k} em ${num(n, 0)} datas`, `${k} on ${num(n, 0)} dates`))
        .join("; ")
    : "";
  const notaSiga = (siga?.nota_temporal ?? "").replace(/\s*\(contexto\.siga_historico\)/, "");

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:geracao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <GeracaoNavegacao atual="p024" />
        <CabecalhoModulo
          siglas={["MWmed", "SIGA", "CEG", "ANEEL", "ONS"]}
          rotulo={tx("Geração", "Generation")}
          titulo={perguntaPainel("p024")}
          lead={tx(
            "A potência das usinas despachadas pelo ONS, por fonte, e quanto cada fonte produziu em relação ao máximo que essa potência permitiria (o fator de capacidade).",
            "The capacity of the plants dispatched by the ONS, by source, and how much each source produced relative to the maximum that capacity would allow (the capacity factor).",
          )}
          recorte={tx(`Retrato de ${dataBR(c.retrato.data)} · fator de capacidade de ${periodo12} · MW e %`, `Snapshot of ${dataBR(c.retrato.data)} · capacity factor for ${periodo12} · MW and %`)}
          fonte={FONTE}
          referencia={tx(
            <>
              {FONTE}: retrato de {dataBR(c.retrato.data)} e meses até {mesUltimo}; {FONTE_ANEEL} e cadastro de micro e minigeração distribuída da ANEEL;
              processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {FONTE}: snapshot of {dataBR(c.retrato.data)} and months up to {mesUltimo}; {FONTE_ANEEL} and ANEEL register of distributed micro and mini generation;
              processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <GeracaoDatas
              itens={[
                { rotulo: tx("Potência instalada (ONS)", "Installed capacity (ONS)"), texto: tx(`retrato de ${dataBR(c.retrato.data)}`, `snapshot of ${dataBR(c.retrato.data)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Fator de capacidade", "Capacity factor"),
                  texto: tx(`até ${mesUltimo} (último mês completo)`, `up to ${mesUltimo} (latest complete month)`),
                  natureza: "CALCULADO",
                },
                ...(siga?.data_referencia
                  ? [{ rotulo: tx("Capacidade da ANEEL (SIGA)", "ANEEL capacity (SIGA)"), texto: tx(`retrato de ${dataBR(siga.data_referencia)}`, `snapshot of ${dataBR(siga.data_referencia)}`), natureza: "OBSERVADO" as const }]
                  : []),
                ...(mmgd?.data_cadastro
                  ? [{ rotulo: tx("MMGD cadastrada na ANEEL", "MMGD registered with ANEEL"), texto: tx(`cadastro de ${dataBR(mmgd.data_cadastro)}`, `register of ${dataBR(mmgd.data_cadastro)}`), natureza: "OBSERVADO" as const }]
                  : []),
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={tx("Potência instalada e fator de capacidade", "Installed capacity and capacity factor")}
              nota={tx(
                "Universo: usinas despachadas pelo ONS em operação comercial; a micro e minigeração distribuída fica fora.",
                "Universe: plants dispatched by the ONS in commercial operation; distributed micro and mini generation is left out.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Potência das usinas despachadas pelo ONS", "Capacity of the plants dispatched by the ONS")}
                natureza="OBSERVADO"
                evidencia={ev.capacidade_retrato_total}
                casas={0}
                periodo={tx(`Retrato de ${dataBR(c.retrato.data)}`, `Snapshot of ${dataBR(c.retrato.data)}`)}
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p024")}#p024`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Fator de capacidade das eólicas", "Capacity factor of wind plants")}
                natureza="CALCULADO"
                evidencia={ev.capacidade_12m_fc_eolica}
                formato="pct"
                casas={1}
                unidade={tx("do máximo que a potência permitiria", "of the maximum the capacity would allow")}
                cor={COR_CATEGORIA.eolica}
                endereco={`${rotaPainel("p024")}#p024`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Fator de capacidade da solar centralizada", "Capacity factor of centralized solar")}
                natureza="CALCULADO"
                evidencia={ev.capacidade_12m_fc_solar_centralizada}
                formato="pct"
                casas={1}
                unidade={tx("do máximo que a potência permitiria", "of the maximum the capacity would allow")}
                cor={COR_CATEGORIA.solar_centralizada}
                endereco={`${rotaPainel("p024")}#p024`}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Potência instalada diz quanto as usinas podem entregar; o fator de capacidade diz quanto entregaram, dividindo a geração pela
              potência em operação comercial ao longo de cada mês, nunca pela capacidade final aplicada ao histórico. A capacidade fiscalizada pela ANEEL e a micro e minigeração
              distribuída aparecem ao lado, nas mesmas datas, sem serem somadas à potência do ONS.
            </>,
            <>
              Installed capacity says how much the plants can deliver; the capacity factor says how much they delivered, dividing generation by the
              capacity in commercial operation over each month, never by the final capacity applied to the history. The capacity inspected by ANEEL and distributed micro and mini
              generation appear alongside, on the same dates, without being added to the ONS capacity.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="capacidade">
            <PainelEvidencia
              id="p024"
              pergunta={tx("Potência instalada e fator de capacidade, fonte por fonte", "Installed capacity and capacity factor, source by source")}
              subtitulo={tx("Potência em operação comercial e fator de capacidade por fonte · MW e %", "Capacity in commercial operation and capacity factor by source · MW and %")}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  A potência instalada sozinha não diz quanto uma fonte contribui: eólica e solar têm fator de capacidade menor que hidráulica e nuclear, e as térmicas variam com
                  o despacho. Comparar instalado e produzido evita ler crescimento de capacidade como crescimento de geração na mesma proporção.
                </>,
                <>
                  Installed capacity alone does not say how much a source contributes: wind and solar have a lower capacity factor than hydropower and nuclear, and thermal plants vary with
                  dispatch. Comparing installed and produced avoids reading capacity growth as generation growth in the same proportion.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.capacidade!}
            >
              <div className="space-y-6">
                {atual.defasada && <GeracaoAviso tipo="alerta">{atual.texto}</GeracaoAviso>}
                <div className="grid gap-x-10 gap-y-6 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
                  <RespostaCurta id="p024" veredito={vereditoCapacidade(c) || respostaCapacidade(c)}>
                    {respostaCapacidade(c)}
                  </RespostaCurta>

                  <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
                    <GraficoBarras
                      titulo={tx(`Potência em operação por fonte, ${dataBR(c.retrato.data)}`, `Capacity in operation by source, ${dataBR(c.retrato.data)}`)}
                      dados={retrato.map((x) => ({ id: x.categoria, rotulo: CURTO_CATEGORIA[x.categoria], mw: x.mw }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "mw", rotulo: tx("Potência em operação", "Capacity in operation"), cor: "var(--cor-energia)" }]} // i18n: dado
                      unidade="MW"
                      casas={0}
                      orientacao="horizontal"
                      alturaCategoria={44}
                      rotulosValor
                    />
                    <GraficoBarras
                      titulo={tx(`Fator de capacidade por fonte, ${periodo12}`, `Capacity factor by source, ${periodo12}`)}
                      dados={fcNaOrdem.map((l) => ({ id: l.id, rotulo: l.categoria, painel: l.fc_pct }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "painel", rotulo: tx("Fator de capacidade (potência em operação de cada mês)", "Capacity factor (capacity in operation each month)"), cor: "var(--cor-energia)" }]} // i18n: dado
                      unidade="%"
                      casas={1}
                      orientacao="horizontal"
                      alturaCategoria={44}
                      rotulosValor
                    />
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-carvao-muted">
                  {tx(
                    <>
                      As duas figuras seguem a mesma ordem de fontes, da maior para a menor potência instalada, para a leitura lado a lado.
                      {linhas.some((l) => l.fc_ons_pct !== null) && (
                        <>
                          {" "}
                          O ONS publica fator de capacidade só para eólica e solar:{" "}
                          {fcOns}{" "}
                          nos mesmos 12 meses. A conferência mês a mês está no modo Analisar.
                        </>
                      )}
                    </>,
                    <>
                      Both charts follow the same order of sources, from the largest to the smallest installed capacity, for side-by-side reading.
                      {linhas.some((l) => l.fc_ons_pct !== null) && (
                        <>
                          {" "}
                          The ONS publishes a capacity factor only for wind and solar: {fcOns} over the same 12 months. The month-by-month comparison is in Analyze mode.
                        </>
                      )}
                    </>,
                  )}
                </p>

                {parteDaPotencia.length > 0 && (
                  <p className="text-xs leading-relaxed text-carvao-muted" data-nota="cobertura-potencia">
                    {tx(
                      <>
                        Fator de capacidade com parte da potência: {parteTexto}. A Geração por Usina
                        publicou menos usinas dessas categorias, como mostram as ressalvas de universo da{" "}
                        {linkMatriz}
                        .
                      </>,
                      <>
                        Capacity factor with part of the capacity: {parteTexto}. The ONS generation by plant dataset
                        published fewer plants of these categories, as the coverage caveats of the{" "}
                        {linkMatriz}
                        {" "}show.
                      </>,
                    )}
                  </p>
                )}
                {diferencas.length > 0 && (
                  <p className="text-xs leading-relaxed text-carvao-muted" data-nota="aneel-ons">
                    {tx(
                      <>
                        A capacidade fiscalizada da ANEEL (SIGA) é outro universo: inclui usinas fora do despacho do ONS e classifica as fontes de outro modo. Onde a diferença passa de 25%:{" "}
                        {diferencasTexto}. As duas colunas ficam lado a lado na tabela e nunca se somam.
                      </>,
                      <>
                        The capacity inspected by ANEEL (SIGA) is a different universe: it includes plants outside ONS dispatch and classifies the sources differently. Where the difference exceeds 25%:{" "}
                        {diferencasTexto}. The two columns are side by side in the table and are never added up.
                      </>,
                    )}
                  </p>
                )}

                <GeracaoRecorte
                  periodo={tx(
                    `retrato de ${dataBR(c.retrato.data)}; fator de capacidade de ${periodo12} (12 meses completos); série mensal de ${mesAno(c.mensal.meses[0])} a ${mesUltimo}`,
                    `snapshot of ${dataBR(c.retrato.data)}; capacity factor for ${periodo12} (12 complete months); monthly series from ${mesAno(c.mensal.meses[0])} to ${mesUltimo}`,
                  )}
                  universo={tx(
                    <>
                      unidades geradoras das usinas despachadas pelo ONS <span data-nivel="analisar">(Tipo I, II-A, II-B e II-C) </span>em operação comercial: {num(c.retrato.por_categoria.reduce((s, x) => s + x.usinas, 0), 0)} usinas e{" "}
                      {num(c.retrato.por_categoria.reduce((s, x) => s + x.unidades, 0), 0)} unidades no retrato
                    </>,
                    <>
                      generating units of the plants dispatched by the ONS <span data-nivel="analisar">(Type I, II-A, II-B and II-C) </span>in commercial operation: {num(c.retrato.por_categoria.reduce((s, x) => s + x.usinas, 0), 0)} plants and{" "}
                      {num(c.retrato.por_categoria.reduce((s, x) => s + x.unidades, 0), 0)} units in the snapshot
                    </>,
                  )}
                  unidade={tx(
                    "MW (potência), % (fator de capacidade e parcela), MWmed (geração estimada da MMGD)",
                    "MW (capacity), % (capacity factor and share), MWavg (estimated MMGD generation)",
                  )}
                />

                <TabelaInterativa
                  titulo={tx(
                    "Tabela equivalente: potência, fator de capacidade e capacidade da ANEEL por categoria",
                    "Equivalent table: capacity, capacity factor and ANEEL capacity by category",
                  )}
                  colunas={colunasCapacidade(c)}
                  linhas={paraTabela(linhas)}
                  chaveLinha="id"
                  colunaRotulo="categoria"
                  fonte={FONTE}
                  versao={versao}
                  nomeArquivo="geracao-capacidade-categorias"
                  chaveUrl="cap"
                  nota={tx(
                    <>{`A coluna da ANEEL (SIGA) é outro universo, ao lado para contexto: não é somada nem comparada usina a usina. ${notaSiga}`}</>,
                    <>
                      The ANEEL (SIGA) column is a different universe, shown alongside for context: it is neither added nor compared plant by plant.{" "}
                      {notaSiga ? <TrechoPortugues regiao="geracao-siga-nota">{notaSiga}</TrechoPortugues> : null}
                    </>,
                  )}
                />

                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                {u && (
                  <SecaoDoPainel id="distribuicao" titulo={tx(`Quanto o fator de capacidade varia entre as usinas, ${periodo12}?`, `How much does the capacity factor vary between plants, ${periodo12}?`)}>
                    <GeracaoCapacidadeDistribuicao ultimos12m={u} fonte={FONTE} versao={versao} usinasNoRetrato={usinasNoRetrato} />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel
                  id="capacidade-mensal"
                  titulo={tx("Como o fator de capacidade e a potência em operação evoluíram, mês a mês?", "How have the capacity factor and the capacity in operation evolved, month by month?")}
                >
                  <GraficoLinhas
                    chaveUrl="fcm"
                    titulo={tx("Fator de capacidade mensal por fonte", "Monthly capacity factor by source")}
                    dados={linhasFcMensal(c, CATEGORIAS_CAPACIDADE)}
                    chaveX="m"
                    formatoX="mes"
                    series={CATEGORIAS_CAPACIDADE.map((k) => ({ id: k, rotulo: CURTO_CATEGORIA[k], cor: COR_CATEGORIA[k] }))}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    legendaInterativa
                    ocultasIniciais={ocultas}
                    zoom
                    altura={300}
                  />
                  <GeracaoAviso>
                    {tx(
                      <>
                        Fator de capacidade acima de 100% numa usina num mês aparece em {num(par.fc_acima_de_100.n, 0)} usina-meses da série ({num(par.fc_acima_de_100.ultimos_12m, 0)} nos 12 meses): geração em teste antes da operação comercial e potência
                        nominal da ANEEL abaixo da geração bruta, como na nuclear. Esses valores ficam como publicados e entram na soma de cada fonte; o detalhe está em Auditar.
                      </>,
                      <>
                        A capacity factor above 100% at a plant in a month appears in {num(par.fc_acima_de_100.n, 0)} plant-months of the series ({num(par.fc_acima_de_100.ultimos_12m, 0)} in the 12 months): test generation before commercial operation and ANEEL nominal
                        capacity below gross generation, as in nuclear. These values stay as published and enter the sum of each source; the detail is under Audit.
                      </>,
                    )}
                  </GeracaoAviso>
                  <GraficoLinhas
                    chaveUrl="pot"
                    titulo={tx(
                      `Potência em operação comercial, média de cada mês, a partir do retrato de ${dataBR(c.retrato.data)}`,
                      `Capacity in commercial operation, average of each month, based on the snapshot of ${dataBR(c.retrato.data)}`,
                    )}
                    dados={linhasPotenciaMensal(c, CATEGORIAS_CAPACIDADE)}
                    chaveX="m"
                    formatoX="mes"
                    series={CATEGORIAS_CAPACIDADE.map((k) => ({ id: k, rotulo: CURTO_CATEGORIA[k], cor: COR_CATEGORIA[k] }))}
                    unidade="MW"
                    casas={0}
                    zeroNoEixo
                    legendaInterativa
                    ocultasIniciais={ocultas}
                    altura={260}
                  />
                  <GeracaoAviso>
                    {tx(
                      <>
                        A potência de cada mês vem do retrato da Capacidade Instalada de {dataBR(c.retrato.data)}, pelas datas de entrada e saída de cada unidade: usinas que já deixaram o despacho
                        centralizado não aparecem, e repotenciações antigas não são reconstituídas.
                      </>,
                      <>
                        Each month&apos;s capacity comes from the installed capacity snapshot of {dataBR(c.retrato.data)}, through the entry and exit dates of each unit: plants that have already left centralized
                        dispatch do not appear, and old repowerings are not reconstructed.
                      </>,
                    )}
                  </GeracaoAviso>
                </SecaoDoPainel>

                <SecaoDoPainel
                  nivel="analisar"
                  id="contexto-capacidade"
                  titulo={tx(
                    "Conferência com o ONS, a capacidade da ANEEL e a micro e minigeração distribuída",
                    "Comparison with the ONS, ANEEL capacity and distributed micro and mini generation",
                  )}
                >
                  <GraficoLinhas
                    titulo={tx("Fator de capacidade das eólicas: o do painel e o publicado pelo ONS, mês a mês", "Capacity factor of wind plants: the panel's and the one published by the ONS, month by month")}
                    dados={linhasFcConferencia(c, "eolica")}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "painel", rotulo: tx("Painel", "Panel"), cor: COR_CATEGORIA.eolica, espessura: 2.5 }, // i18n: dado
                      { id: "ons", rotulo: tx("Publicado pelo ONS", "Published by the ONS"), cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={220}
                  />
                  <GraficoLinhas
                    titulo={tx(
                      "Fator de capacidade da solar centralizada: o do painel e o publicado pelo ONS, mês a mês",
                      "Capacity factor of centralized solar: the panel's and the one published by the ONS, month by month",
                    )}
                    dados={linhasFcConferencia(c, "solar_centralizada")}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "painel", rotulo: tx("Painel", "Panel"), cor: COR_CATEGORIA.solar_centralizada, espessura: 2.5 }, // i18n: dado
                      { id: "ons", rotulo: tx("Publicado pelo ONS", "Published by the ONS"), cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={220}
                  />
                  {sigaHist && (
                    <>
                      <p className="text-sm leading-relaxed text-carvao-muted">
                        <TrechoPortugues regiao="geracao-siga-historico-regra">{emPortugues(sigaHist.regra)}</TrechoPortugues>
                      </p>
                      <GeracaoCapacidadeAneel historico={sigaHist} fonte={FONTE_ANEEL} />
                    </>
                  )}
                  {mmgd?.mensal && (
                    <>
                      <p className="text-sm leading-relaxed text-carvao-muted">
                        {tx(
                          <>
                            Micro e minigeração distribuída: {num(mmgd.potencia_mw, 0)} MW cadastrados na ANEEL em {mmgd.data_cadastro ? dataBR(mmgd.data_cadastro) : "data não informada"}. {emPortugues(mmgd.mensal.regra)}
                          </>,
                          <>
                            Distributed micro and mini generation: {num(mmgd.potencia_mw, 0)} MW registered with ANEEL on {mmgd.data_cadastro ? dataBR(mmgd.data_cadastro) : "an unreported date"}.{" "}
                            <TrechoPortugues regiao="geracao-mmgd-regra">{emPortugues(mmgd.mensal.regra)}</TrechoPortugues>
                          </>,
                        )}
                      </p>
                      <GraficoLinhas
                        titulo={tx("Potência de micro e minigeração distribuída cadastrada na ANEEL, fim de cada mês", "Distributed micro and mini generation capacity registered with ANEEL, end of each month")}
                        dados={mmgd.mensal.meses.map((m, i) => ({ m, potencia: mmgd.mensal!.potencia_cadastrada_mw[i] }))}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "potencia", rotulo: tx("Potência cadastrada", "Registered capacity"), cor: COR_CATEGORIA.solar_mmgd, espessura: 2.5 }]}
                        unidade="MW"
                        casas={0}
                        zeroNoEixo
                        altura={220}
                      />
                      <GraficoLinhas
                        titulo={tx("Geração de micro e minigeração distribuída estimada pelo ONS, média de cada mês", "Distributed micro and mini generation estimated by the ONS, average of each month")}
                        dados={mmgd.mensal.meses.map((m, i) => ({ m, geracao: mmgd.mensal!.mes_completo_na_geracao[i] ? mmgd.mensal!.geracao_estimada_ons_mwmed[i] : null }))}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "geracao", rotulo: tx("Geração estimada", "Estimated generation"), cor: "var(--serie-solar)", espessura: 2.5 }]}
                        unidade={mwmed()}
                        casas={0}
                        zeroNoEixo
                        altura={220}
                      />
                      <TabelaInterativa
                        titulo={tx(
                          "Tabela equivalente: micro e minigeração distribuída cadastrada e estimada, mês a mês",
                          "Equivalent table: registered and estimated distributed micro and mini generation, month by month",
                        )}
                        colunas={colunasMmgdCapacidade().map((col) => (col.id === "mes" ? { ...col, id: "m", tipo: "data" as const } : col))}
                        linhas={paraTabela(linhasMmgdCapacidade(mmgd.mensal))}
                        chaveLinha="id"
                        colunaRotulo="m"
                        fonte={tx(
                          "ANEEL, cadastro de micro e minigeração distribuída; ONS, Geração por Usina (Solar MMGD)",
                          "ANEEL, register of distributed micro and mini generation; ONS, generation by plant dataset (Solar MMGD)",
                        )}
                        versao={versao}
                        nomeArquivo="geracao-capacidade-mmgd"
                        chaveUrl="mm"
                        ordemInicial={{ coluna: "m", direcao: "desc" }}
                        nota={tx(
                          "As duas grandezas ficam lado a lado e nunca são somadas nem divididas. Mês incompleto na geração fica sem valor no gráfico. Cadastro provisório: os seis meses mais recentes do arquivo da ANEEL, que crescem nas capturas seguintes por registro tardio (revisões medidas no módulo Transição).",
                          "The two quantities are side by side and are never added or divided. A month that is incomplete in generation has no value in the chart. Provisional registration: the six most recent months of the ANEEL file, which grow in later captures due to late registration (revisions measured in the Transition module).",
                        )}
                      />
                    </>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="pareamento" titulo={tx("Pareamento de usinas e controles", "Plant matching and checks")}>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    <TrechoPortugues regiao="geracao-pareamento-regra">{emPortugues(par.regra)}</TrechoPortugues>
                  </p>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Usina-meses por forma de pareamento:{" "}
                        {casamentos}
                        . Unidades que apareceriam em mais de um grupo e foram contadas uma vez: {num(par.unidades_repetidas_evitadas, 0)}. No retrato,{" "}
                        {num(c.retrato.unidades_desativadas_no_retrato, 0)} unidades desativadas ficam fora da potência e {num(c.retrato.nao_mapeadas_mw, 1)} MW sem categoria.
                      </>,
                      <>
                        Plant-months by type of matching: {casamentos}. Units that would appear in more than one group and were counted once: {num(par.unidades_repetidas_evitadas, 0)}. In the snapshot,{" "}
                        {num(c.retrato.unidades_desativadas_no_retrato, 0)} deactivated units are left out of the capacity and {num(c.retrato.nao_mapeadas_mw, 1)} MW have no category.
                      </>,
                    )}
                  </p>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Fator de capacidade mensal acima de 100% numa usina: {num(par.fc_acima_de_100.n, 0)} usina-meses na série ({num(par.fc_acima_de_100.ultimos_12m, 0)} nos 12 meses), por
                        categoria:{" "}
                        {acimaPorCategoria}
                        . Mantidos como publicados, contados como ressalva. O fator passa de 100% por dois motivos: a geração em teste antes da operação comercial, que infla o mês de entrada, e a potência nominal do ato da ANEEL abaixo da geração bruta, que mantém as usinas nucleares perto de 101% em muitos meses de operação normal (76 dos 228 casos).
                      </>,
                      <>
                        Monthly capacity factor above 100% at a plant: {num(par.fc_acima_de_100.n, 0)} plant-months in the series ({num(par.fc_acima_de_100.ultimos_12m, 0)} in the 12 months), by
                        category: {acimaPorCategoria}. Kept as published, counted as a caveat. The factor exceeds 100% for two reasons: test generation before commercial operation, which inflates the month of entry, and the nominal capacity in the ANEEL act below gross generation, which keeps nuclear plants close to 101% in many months of normal operation (76 of the 228 cases).
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    chaveUrl="fxm"
                    titulo={tx("Maiores fatores de capacidade mensais acima de 100%", "Largest monthly capacity factors above 100%")}
                    colunas={colunasFcAcima100().map((col) => (col.id === "mes" ? { ...col, id: "m", tipo: "data" as const } : col))}
                    linhas={paraTabela(linhasFcAcima100(par).map((l, i) => ({ ...l, m: par.fc_acima_de_100.exemplos[i].mes })))}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={FONTE}
                    versao={versao}
                    nomeArquivo="geracao-capacidade-acima-100"
                    ordemInicial={{ coluna: "fc_pct", direcao: "desc" }}
                  />
                  {siga && siga.fontes_em_outros.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      {tx(`No SIGA, a categoria outras térmicas reúne: ${fontesEmOutros}.`, `In SIGA, the other thermal category includes: ${fontesEmOutros}.`)}
                    </p>
                  )}
                  {sigaHist && Object.keys(sigaHist.tipos_fora_dos_grupos).length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          Tipos da série da ANEEL fora dos grupos comparados (aparecem em datas da série):{" "}
                          {tiposFora}
                          .
                        </>,
                        <>Types in the ANEEL series outside the compared groups (they appear on dates of the series): {tiposFora}.</>,
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="regras-capacidade" titulo={tx("Regras e limitações", "Rules and limitations")}>
                  <GeracaoRegras regras={[{ rotulo: ROTULO_REGRA.capacidade, texto: g.regras.capacidade }]} />
                  <GeracaoFrases itens={g.proveniencia.capacidade?.limitacoes ?? []} daFonte />
                </SecaoDoPainel>

                <GeracaoSeguir ancora="p024" proximo={{ href: `${rotaPainel("p021")}#p021`, pergunta: perguntaPainel("p021") }} downloads={downloadsDoPainel(g.downloads, "p024")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
