import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
import { InclusaoDatas, InclusaoIndisponivel, InclusaoNavegacao, InclusaoRecorte, InclusaoSeguir } from "@/components/energia/InclusaoPagina";
import { InclusaoPorMedidaTsee } from "@/components/energia/InclusaoPorEstado";
import { InclusaoHistoricoUfTsee, InclusaoMapaTsee, InclusaoSerieTsee } from "@/components/energia/InclusaoTarifaSocial";
import { InclusaoBaseLegal, TarifaSocialRegraVigente, TarifaSocialResposta } from "@/components/energia/InclusaoTextos";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { FiguraAnalitica, GraficoBarras, GraficoLinhas, PaginaPainel, TabelaDados, type CelulaTabela, type NumeroProps } from "@/components/painel";
import { TabelaInterativa } from "@/components/painel/TabelaInterativa";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, pct } from "@/lib/energia/formato";
import { fonteLegivel } from "@/lib/energia/bastidor";
import { textoPeriodo } from "@/lib/energia/evidencia";
import { provenienciaLegivel } from "@/lib/energia/mercado";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { valorOuAusencia } from "@/lib/painel/numeros";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { comNomes, dadoNo, dadoTexto } from "@/lib/energia/i18n/conta-inclusao";
import { Nome } from "@/components/i18n/Nome";
import {
  colunasDistribuidoras,
  colunasMesesCde,
  colunasSerieTsee,
  dadosMediaCde,
  datasMedidas,
  fontesInclusao,
  inteiro,
  limiteTarifaSocial,
  linhasDistribuidoras,
  linhasMesesCde,
  linhasTabelaSerieTsee,
  marcosEventos,
  mes,
  mudancaTarifaSocial,
  numTexto,
  reaisGrandes,
  reaisTexto,
  rotaPainel,
  textoCusteioTarifaSocial,
  textosRegraTarifaSocial,
  ufsAtingidasPorAusencia,
} from "@/lib/energia/inclusao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";
import type { GoldRegulacao } from "@/lib/energia/tipos-regulacao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/inclusao-energetica/tarifa-social", {
    title: tx("Tarifa Social: quantas UC recebem, onde e quanto", "Tarifa Social: how many consumer units receive it, where and how much"),
    description: tx(
      "Unidades consumidoras com Tarifa Social por distribuidora e mês (ANEEL, SCS), participação nas UC residenciais, DMR e faturas com desconto por UF e mês nos arquivos de Beneficiários da CDE, com a conferência entre as duas bases.",
      "Consumer units with the Tarifa Social (social electricity tariff) by distribution utility and month (ANEEL, SCS), share of residential consumer units, monthly revenue difference (DMR) and bills with a discount by state and month in the CDE Beneficiaries files, with the check between the two databases.",
    ),
    alternates: { canonical: "/setor-eletrico/inclusao-energetica/tarifa-social" },
  }, anterior);
}

function rotuloRegra(id: string): string {
  const rotulos: Record<string, string> = {
    mes_completo: tx("Mês completo do SCS", "Complete SCS month"),
    residencial_inconsistente: tx("Total residencial inconsistente", "Inconsistent residential total"),
    incorporacao: tx("Incorporação de distribuidora", "Distribution utility merger"),
    maiores_diferencas: tx("Corte da conferência SCS e CDE", "Cutoff of the SCS and CDE check"),
    desconto_liquido: tx("Desconto líquido", "Net discount"),
    despacho_vigente: tx("Despacho vigente", "Order in force"),
    mes_mapa: tx("Mês do mapa", "Map month"),
    mes_cde_sem_original: tx("Mês da CDE sem original guardado", "CDE month without a stored original"),
    municipio_valido: tx("Município válido", "Valid municipality"),
  };
  return rotulos[id] ?? id;
}

function colunasIncorporacoes(): ColunaTabela[] {
  return [
    { id: "mes", rotulo: tx("Mês da ruptura", "Month of the break"), tipo: "texto" },
    { id: "sucessora", rotulo: tx("Sucessora", "Successor"), tipo: "texto", idiomaTexto: "nome" },
    { id: "incorporadas", rotulo: tx("Incorporadas", "Merged"), tipo: "texto", idiomaTexto: "nome" },
    { id: "total", rotulo: tx("UC residenciais das incorporadas", "Residential consumer units of the merged"), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "salto", rotulo: tx("Salto da sucessora", "Successor's jump"), tipo: "numero", casas: 0 },
  ];
}

function colunasConferencia(): ColunaTabela[] {
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto", idiomaTexto: "nome" },
    { id: "grupo", rotulo: tx("Grupo", "Group"), tipo: "texto", categorica: true },
    { id: "uc_scs", rotulo: tx("UC no SCS", "Consumer units in the SCS"), tipo: "numero", casas: 0 },
    { id: "faturas_cde", rotulo: tx("Faturas na CDE", "Bills in the CDE"), tipo: "numero", casas: 0 },
    { id: "diferenca_pct", rotulo: tx("Diferença", "Difference"), tipo: "percentual", casas: 2 },
    { id: "dmr", rotulo: "DMR (SCS)", tipo: "numero", unidade: "R$", casas: 2 },
    { id: "desconto", rotulo: tx("Desconto (CDE)", "Discount (CDE)"), tipo: "numero", unidade: "R$", casas: 2 },
  ];
}

function colunasAntiga(): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Trimestre", "Quarter"), tipo: "texto" },
    { id: "antiga", rotulo: tx("UC baixa renda (série antiga)", "Low-income consumer units (old series)"), tipo: "numero", casas: 0 },
    { id: "scs", rotulo: tx("UC com Tarifa Social (SCS)", "Consumer units with Tarifa Social (SCS)"), tipo: "numero", casas: 0 },
    { id: "dif", rotulo: tx("Diferença", "Difference"), tipo: "percentual", casas: 2 },
    { id: "repete", rotulo: tx("Repete o trimestre", "Repeats the quarter"), tipo: "texto" },
  ];
}

/** As modalidades da Tarifa Social na ordem da tabela, com o rótulo no idioma. */
function modalidades(): readonly (readonly ["baixa_renda" | "bpc" | "quilombola" | "indigena" | "multifamiliar", string])[] {
  return [
    ["baixa_renda", tx("Baixa renda (Cadastro Único)", "Low income (Cadastro Único)")],
    ["bpc", tx("Benefício de Prestação Continuada", "Benefício de Prestação Continuada (BPC, continuous cash benefit)")],
    ["quilombola", tx("Quilombola", "Quilombola (descendants of maroon communities)")],
    ["indigena", tx("Indígena", "Indigenous")],
    ["multifamiliar", tx("Multifamiliar", "Multi-family")],
  ];
}

export default function TarifaSocialPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const idioma = idiomaEnergia();
  const fontes = fontesInclusao();
  const t = g.tarifa_social;
  const k = t.kpis;
  const serie = t.serie_mensal;
  const mesMapa = t.mes_mapa ?? t.mes_referencia;
  const cdeMapa = t.cde_meses.find((m) => m.mes === t.mes_mapa) ?? null;
  const cdeComValor = t.cde_meses.filter((m) => m.original_no_bronze);
  const dadosCde = dadosMediaCde(t.cde_meses);
  const conf = t.conferencia_scs_cde;
  const antiga = t.serie_antiga;
  const custeio = t.custeio_cde;
  const atingidas = ufsAtingidasPorAusencia(t.cde_meses, t.distribuidoras);
  const marcosScs = marcosEventos(t.eventos, serie[0]?.m ?? "", serie.at(-1)?.m ?? "");
  const marcosCde = marcosEventos(t.eventos, cdeComValor[0]?.mes ?? "", cdeComValor.at(-1)?.mes ?? "");
  const ultimoScs = g.referencias.scs_ultimo_mes_no_arquivo;
  const geracaoScs = t.diagnostico_scs?.data_geracao.at(-1) ?? null;
  // a regra de 80 kWh separa os números: UC do SCS são anteriores a ela; faturas da CDE do mês do mapa, posteriores quando houver
  const regra = textosRegraTarifaSocial(t, idioma);
  const notaAntesDaRegra =
    regra && t.periodos_da_regra?.antes
      ? tx(`${mes(t.mes_referencia)}, antes da regra de ${regra.vigencia}: o SCS não tem mês completo depois dela.`, `${mes(t.mes_referencia)}, before the rule of ${regra.vigencia}: the SCS has no complete month after it.`)
      : undefined;
  const ufsComFaturas = t.ufs.length;
  const municipiosComFaturas = t.ufs.reduce((s, u) => s + u.municipios_com_faturas, 0);
  const linhasConferencia = conf
    ? [
        ...conf.maiores_diferencas.map((d) => ({
          ...d,
          grupo: tx(`${inteiro(conf.uc_minima_maiores_diferencas)} UC ou mais`, `${inteiro(conf.uc_minima_maiores_diferencas)} consumer units or more`),
        })),
        ...conf.diferencas_distribuidoras_pequenas.map((d) => ({
          ...d,
          grupo: tx(`menos de ${inteiro(conf.uc_minima_maiores_diferencas)} UC`, `fewer than ${inteiro(conf.uc_minima_maiores_diferencas)} consumer units`),
        })),
      ].map((d) => ({
        id: d.cnpj,
        sigla: d.sigla ?? `CNPJ ${d.cnpj}`,
        grupo: d.grupo,
        uc_scs: d.uc_scs,
        faturas_cde: d.faturas_cde,
        diferenca_pct: d.diferenca_pct,
        dmr: d.dmr_scs_reais,
        desconto: d.desconto_cde_reais,
      }))
    : [];
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url)).map((d) => ({ ...d, rotulo: dadoTexto(d.rotulo, idioma) }));
  const regGold = lerGold<GoldRegulacao>("regulacao.json");
  const reg = integra(regGold) ? regGold : null;
  const oQueMudou = (
    <>
      <InclusaoBaseLegal reg={reg} className="mb-2" />
      {mudancaTarifaSocial(t)}
    </>
  );
  const comoInterpretar = tx(
    <>
      UC, unidade consumidora, é o ponto de ligação com conta própria e a unidade do SCS; fatura é cada conta emitida com desconto no mês e a unidade dos arquivos de Beneficiários da CDE (uma UC
      pode ter mais de uma fatura no arquivo). O SCS conta UC no pedido de reembolso de cada distribuidora (despacho vigente, cinco faixas de consumo somadas, DMR lida uma vez por mês). Depois do fim do SCS, a evolução vem dos arquivos
      mensais da CDE, que contam faturas: as duas séries ficam em gráficos separados e não se emendam. Mês em que falta distribuidora esperada fica em linha tracejada, fora da comparação. A
      participação é razão de somas das mesmas distribuidoras.
    </>,
    <>
      A consumer unit (UC) is the connection point with its own account and the unit of the SCS; a bill is each account issued with a discount in the month and the unit of the CDE
      Beneficiaries files (a consumer unit may have more than one bill in the file). The SCS counts consumer units in each distribution utility&rsquo;s reimbursement request (order in
      force, five consumption bands added up, DMR read once a month). After the end of the SCS, the trend comes from the monthly CDE files, which count bills: the two series are in
      separate charts and are not joined. A month missing an expected utility is shown as a dashed line, outside the comparison. The share is a ratio of sums over the same utilities.
    </>,
  );
  const naoConcluir = tx(
    <>
      Não se conclui número de famílias nem de pessoas beneficiadas: UC e fatura são unidades da conta. A DMR é a receita que a distribuidora deixa de cobrar, não o desconto de cada família. A
      queda num mês incompleto não é queda de beneficiários. Diferenças entre UF não têm causa atribuída aqui.
    </>,
    <>
      No number of families or people benefited can be concluded: consumer units and bills are units of the electricity account. The DMR is the revenue the distribution utility does not
      charge, not each family&rsquo;s discount. A drop in an incomplete month is not a drop in beneficiaries. Differences between states have no cause attributed here.
    </>,
  );

  // os quatro números da abertura, no NumeroIndicador do kit: valor, período e unidade da evidência da gold, como o Numero de antes, e a
  // ficha "Comprove este número" ao lado; valor ausente fica ausente, com o motivo
  const semValor = tx("A gold da inclusão não traz este valor nesta publicação.", "The inclusion gold does not carry this value in this publication.");
  const fonteScs = tx("ANEEL, SCS", "ANEEL, SCS");
  const fonteCde = tx("ANEEL, Beneficiários da CDE", "ANEEL, CDE Beneficiaries");
  const endereco = `${rotaPainel("p059")}#p059`;
  const periodoDe = (e: { periodo: { inicio: string; fim: string } } | null | undefined, mesAlternativo?: string | null) =>
    e ? textoPeriodo(e.periodo) : mesAlternativo ? mes(mesAlternativo) : textoPeriodo(null);
  const prova = (e: Parameters<typeof ComproveNumero>[0]["evidencia"] | null | undefined) => (e ? <ComproveNumero evidencia={e} endereco={endereco} /> : undefined);
  const numeros: NumeroProps[] = [
    {
      ...valorOuAusencia(k.uc_tsee.evidencia?.valor_calculo, semValor),
      rotulo: tx("UC com Tarifa Social", "Consumer units with Tarifa Social"),
      natureza: "OBSERVADO",
      formato: "inteiro",
      unidade: tx("UC", "consumer units"),
      periodo: periodoDe(k.uc_tsee.evidencia, k.uc_tsee.mes),
      fonte: fonteScs,
      marcador: "var(--cor-energia)",
      comprove: prova(k.uc_tsee.evidencia),
      nota: notaAntesDaRegra,
    },
    {
      ...valorOuAusencia(k.participacao_pct.evidencia?.valor_calculo, semValor),
      rotulo: tx("Das UC residenciais", "Of residential consumer units"),
      natureza: "CALCULADO",
      formato: "percentual",
      casas: 1,
      unidade: "%",
      periodo: periodoDe(k.participacao_pct.evidencia, k.participacao_pct.mes),
      fonte: fonteScs,
      marcador: "var(--cor-energia)",
      comprove: prova(k.participacao_pct.evidencia),
      nota:
        k.variacao_12m_pct.valor !== null
          ? tx(
              `UC com Tarifa Social ${k.variacao_12m_pct.valor >= 0 ? "cresceram" : "caíram"} ${pct(Math.abs(k.variacao_12m_pct.valor), 1)} desde ${mes(k.variacao_12m_pct.mes_base)}${k.variacao_12m_pct.comparavel ? "" : " (mês base incompleto)"}.`,
              `Consumer units with Tarifa Social ${k.variacao_12m_pct.valor >= 0 ? "grew" : "fell"} ${pct(Math.abs(k.variacao_12m_pct.valor), 1)} since ${mes(k.variacao_12m_pct.mes_base)}${k.variacao_12m_pct.comparavel ? "" : " (incomplete base month)"}.`,
            )
          : undefined,
    },
    {
      ...valorOuAusencia(k.dmr_mes_reais.evidencia?.valor_calculo, semValor),
      rotulo: tx("Diferença Mensal de Receita (DMR)", "Monthly Revenue Difference (DMR)"),
      natureza: "OBSERVADO",
      formato: "reais",
      casas: 0,
      unidade: "R$",
      periodo: periodoDe(k.dmr_mes_reais.evidencia, k.dmr_mes_reais.mes),
      fonte: fonteScs,
      marcador: "var(--serie-referencia)",
      comprove: prova(k.dmr_mes_reais.evidencia),
      nota: tx(
        `${reaisTexto(k.dmr_por_uc_reais.valor)} por UC; ${numTexto(k.kwh_por_uc.valor, 1)} kWh por UC no mês.`,
        `${reaisTexto(k.dmr_por_uc_reais.valor)} per consumer unit; ${numTexto(k.kwh_por_uc.valor, 1)} kWh per consumer unit in the month.`,
      ),
    },
    {
      ...valorOuAusencia(k.faturas_cde_mapa?.evidencia?.valor_calculo, tx("Nenhum arquivo da CDE com todas as distribuidoras.", "No CDE file with all distribution utilities.")),
      rotulo: tx("Faturas com desconto (CDE)", "Bills with a discount (CDE)"),
      natureza: "CALCULADO",
      formato: "inteiro",
      unidade: tx("faturas", "bills"),
      periodo: periodoDe(k.faturas_cde_mapa?.evidencia, k.faturas_cde_mapa?.mes ?? mesMapa),
      fonte: fonteCde,
      marcador: "var(--serie-comp-2)",
      comprove: prova(k.faturas_cde_mapa?.evidencia),
      nota: cdeMapa
        ? tx(`${reaisTexto(cdeMapa.desconto_medio_por_fatura_reais)} de desconto médio por fatura.`, `${reaisTexto(cdeMapa.desconto_medio_por_fatura_reais)} average discount per bill.`)
        : undefined,
    },
  ];
  // a tabela de modalidades, que era um <table> à mão, na TabelaDados do kit: mesmas linhas, ausência em texto
  const linhasModalidades: CelulaTabela[][] = modalidades().map(([id, rot]) => [<span key={id}>{comNomes(rot, idioma)}</span>, t.modalidades_referencia[id]]);

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:inclusao-tarifa-social" />
      <PaginaPainel
        rota="/setor-eletrico/inclusao-energetica/tarifa-social"
        idioma={idioma}
        profundidade
        abertura={{
          grupo: tx("Inclusão energética", "Energy inclusion"),
          acento: "energia",
          titulo: tx("Tarifa Social de Energia Elétrica", "Tarifa Social (social electricity tariff)"),
          lead: comNomes(
            tx(
              "A Tarifa Social é um desconto na conta de luz de famílias de baixa renda e de quem recebe o Benefício de Prestação Continuada (BPC). Quantas unidades consumidoras (UC) o recebem, onde estão e quanto vale.",
              "The Tarifa Social is a discount on the electricity bill of low-income families and of those who receive the Benefício de Prestação Continuada (BPC, continuous cash benefit). How many consumer units receive it, where they are and how much it is worth.",
            ),
            idioma,
          ),
          recorte: {
            periodo: tx(
              `UC de ${mes(serie[0]?.m)} a ${mes(serie.at(-1)?.m)}; faturas de ${mes(cdeComValor[0]?.mes)} a ${mes(cdeComValor.at(-1)?.mes)}`,
              `consumer units from ${mes(serie[0]?.m)} to ${mes(serie.at(-1)?.m)}; bills from ${mes(cdeComValor[0]?.mes)} to ${mes(cdeComValor.at(-1)?.mes)}`,
            ),
            universo: tx(`${t.distribuidoras.length} distribuidoras no SCS; ${ufsComFaturas} UF com faturas no mês do mapa`, `${t.distribuidoras.length} distribution utilities in the SCS; ${ufsComFaturas} states with bills in the map month`),
            unidade: tx("UC, faturas e R$ correntes", "consumer units, bills and current R$"),
            fonte: tx("ANEEL, SCS e Beneficiários da CDE", "ANEEL, SCS and CDE Beneficiaries"),
          },
          limite: limiteTarifaSocial(t.ufs),
          fontesDatasSiglas: (
            <>
              <p className="t-meta text-mineral">
                <span className="font-medium text-carvao-muted">{tx("Fontes e datas de referência: ", "Sources and reference dates: ")}</span>
                {tx(
                  <>
                    SCS da ANEEL até {mes(ultimoScs)} (arquivo gerado pela fonte em {dataBR(geracaoScs)}; último mês completo {mes(t.mes_referencia)}); Beneficiários da CDE até{" "}
                    {mes(g.referencias.cde_mes_mais_recente)} (último mês completo {mes(mesMapa)}). Processado em {carimbo(g.gerado_em)}.
                  </>,
                  <>
                    ANEEL&rsquo;s SCS up to {mes(ultimoScs)} (file generated by the source on {dataBR(geracaoScs)}; latest complete month {mes(t.mes_referencia)}); CDE Beneficiaries up to{" "}
                    {mes(g.referencias.cde_mes_mais_recente)} (latest complete month {mes(mesMapa)}). Processed on {carimbo(g.gerado_em)}.
                  </>,
                )}
              </p>
              <p>
                {comNomes(
                  tx(
                    "Fonte: ANEEL, Sistema de Controle de Subvenções e Programas Sociais (SCS) e Beneficiários da Conta de Desenvolvimento Energético (CDE).",
                    "Source: ANEEL, Sistema de Controle de Subvenções e Programas Sociais (SCS, subsidy and social program control system) and Beneficiários da Conta de Desenvolvimento Energético (beneficiaries of the Energy Development Account, CDE).",
                  ),
                  idioma,
                )}
              </p>
              <InclusaoDatas itens={datasMedidas(g).filter((d) => d.id === "scs" || d.id === "cde")} />
              <div>
                {tx(
                  "Os números são agregados, por distribuidora, UF e mês: nenhum beneficiário individual aparece aqui.",
                  "The figures are aggregated, by distribution utility, state and month: no individual beneficiary appears here.",
                )}
              </div>
              <LegendaDeSiglas siglas={["ANEEL", "UF", "MPV", "IBGE", "CCC"]} />
            </>
          ),
        }}
        rotuloNumeros={tx("Indicadores da Tarifa Social", "Tarifa Social indicators")}
        numeros={numeros}
        notaNumeros={tx(
          <>
            <p>UC e faturas vêm de fontes e meses diferentes e não se somam.</p>
            <p className="mt-1">Fonte defasada, declarada. Um mês só entra nas comparações quando todas as distribuidoras enviaram o informe.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                SCS (UC): arquivo gerado em {dataBR(geracaoScs)}, publicado até {mes(ultimoScs)}; o último mês com todas as distribuidoras é {mes(t.mes_referencia)}, o dos números de UC.
              </li>
              <li>
                Beneficiários da CDE (faturas): publicados até {mes(g.referencias.cde_mes_mais_recente)}; o último mês com todas as distribuidoras é {mes(mesMapa)}, o dos números de fatura e do
                mapa.
              </li>
            </ul>
          </>,
          <>
            <p>Consumer units and bills come from different sources and months and do not add up.</p>
            <p className="mt-1">Lagged source, as declared. A month only enters the comparisons when all distribution utilities have sent their report.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                SCS (consumer units): file generated on {dataBR(geracaoScs)}, published up to {mes(ultimoScs)}; the latest month with all utilities is {mes(t.mes_referencia)}, that of the
                consumer unit figures.
              </li>
              <li>
                CDE Beneficiaries (bills): published up to {mes(g.referencias.cde_mes_mais_recente)}; the latest month with all utilities is {mes(mesMapa)}, that of the bill figures and of the
                map.
              </li>
            </ul>
          </>,
        )}
        // as páginas da inclusão energética e a regra vigente, logo depois dos números (antes, no topo e entre a abertura e o painel)
        navegacaoLocal={
          <div className="mt-8 space-y-8">
            <InclusaoNavegacao atual="p059" />
            <TarifaSocialRegraVigente t={t} />
          </div>
        }
        figuras={
          <FiguraAnalitica
            id="p059"
            ancoraAntiga="tarifa-social"
            idioma={idioma}
            legivel={fonteLegivel}
            pergunta={dadoTexto(t.pergunta, idioma)}
            subtitulo={tx(
              "UC com Tarifa Social (SCS) e faturas com desconto (Beneficiários da CDE) · UC, faturas e R$ correntes",
              "Consumer units with Tarifa Social (SCS) and bills with a discount (CDE Beneficiaries) · consumer units, bills and current R$",
            )}
            natureza="OBSERVADO"
            porQueImporta={tx(
              <>
                A <Termo slug="tarifa-social">Tarifa Social de Energia Elétrica</Termo> dá desconto na conta da subclasse residencial baixa renda, custeado pela Conta de Desenvolvimento Energético (CDE). Saber quantas
                unidades recebem, onde e com que desconto é o ponto de partida para discutir o alcance do benefício.
              </>,
              <>
                The <Termo slug="tarifa-social">Tarifa Social de Energia Elétrica</Termo> (social electricity tariff) gives a discount on the bill of the low-income residential subclass,
                funded by the Energy Development Account (CDE). Knowing how many units receive it, where and with what discount is the starting point for discussing the reach of the benefit.
              </>,
            )}
            oQueMudou={oQueMudou}
            comoInterpretar={comoInterpretar}
            naoConcluir={naoConcluir}
            proveniencia={provenienciaLegivel(t.proveniencia.scs)}
            complementares={[
              { rotulo: tx("Participação nas UC residenciais", "Share of residential consumer units"), p: provenienciaLegivel(t.proveniencia.participacao) },
              { rotulo: tx("Faturas e desconto (CDE)", "Bills and discount (CDE)"), p: provenienciaLegivel(t.proveniencia.cde) },
              ...(t.proveniencia.custeio ? [{ rotulo: tx("Custeio anual da CDE", "Annual CDE funding"), p: provenienciaLegivel(t.proveniencia.custeio) }] : []),
              ...(t.proveniencia.antiga ? [{ rotulo: tx("Série antiga (descontinuada)", "Old series (discontinued)"), p: provenienciaLegivel(t.proveniencia.antiga) }] : []),
            ]}
            // a série mensal nacional inteira, ordenável e exportável, já está na figura (Distribuidoras, em Analisar): a figura aponta para ela
            tabela={{
              naFigura: tx(
                "a série mensal nacional do SCS, todos os meses publicados, na seção das distribuidoras (modo Analisar), com busca, ordem e exportação.",
                "the national monthly SCS series, all published months, in the distribution utilities section (Analyse mode), with search, sorting and export.",
              ),
            }}
            depois={
              <>
                <SecaoDoPainel
                  id="cde"
                  titulo={tx("Depois do SCS: o que os arquivos da CDE mostram mês a mês?", "After the SCS: what do the CDE files show month by month?")}
                  lead={tx(
                    "Desconto médio por fatura (desconto das faturas ÷ faturas, calculado pelo observatório). Meses em que faltam distribuidoras ficam tracejados; os meses mais recentes, cujos arquivos ainda não trazem todas as distribuidoras, aparecem só na tabela, com a cobertura.",
                    "Average discount per bill (discount on the bills ÷ bills, calculated by the observatory). Months missing distribution utilities are dashed; the most recent months, whose files do not yet include all utilities, appear only in the table, with the coverage.",
                  )}
                >
                  <GraficoLinhas
                    titulo={tx(
                      `Desconto médio por fatura com Tarifa Social, ${mes(cdeComValor[0]?.mes)} a ${mes(cdeComValor.at(-1)?.mes)} (Beneficiários da CDE)`,
                      `Average discount per bill with Tarifa Social, ${mes(cdeComValor[0]?.mes)} to ${mes(cdeComValor.at(-1)?.mes)} (CDE Beneficiaries)`,
                    )}
                    dados={dadosCde}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "completo", rotulo: tx("Mês completo", "Complete month"), sigla: tx("Completo", "Complete"), cor: "var(--cor-energia)" }, // i18n: dado
                      ...(dadosCde.some((d) => d.incompleto !== null)
                        ? [
                            {
                              id: "incompleto",
                              rotulo: tx("Mês incompleto (fora da comparação)", "Incomplete month (outside the comparison)"),
                              sigla: tx("Incompleto", "Incomplete"),
                              cor: "var(--serie-referencia)",
                              tracejada: true,
                            },
                          ]
                        : []),
                    ]}
                    unidade={tx("R$ por fatura", "R$ per bill")}
                    casas={2}
                    zeroNoEixo
                    marcos={marcosCde}
                    altura={280}
                  />
                  <TabelaInterativa
                    titulo={tx("Arquivos mensais de Beneficiários da CDE: cobertura, faturas e desconto", "Monthly CDE Beneficiaries files: coverage, bills and discount")}
                    colunas={colunasMesesCde()}
                    linhas={linhasMesesCde(t.cde_meses)}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte={fontes.cde}
                    versao={g.referencias.cde_mes_mais_recente ?? mesMapa}
                    nomeArquivo="inclusao-cde-meses"
                    chaveUrl="ts.cde"
                    tamanhoPagina={25}
                    nota={dadoNo(t.regras.mes_cde_sem_original, "regra-tarifa-social", idioma)}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="uf" titulo={tx("Onde: faturas com desconto por UF", "Where: bills with a discount by state")}>
                  {/* mapa de domínio até a Iniciativa 5; a tabela por UF sincronizada com ele, logo abaixo, é a sua tabela */}
                  <div data-mapa-legado="tarifa-social-uf">
                    <InclusaoMapaTsee ufs={t.ufs} mesMapa={mesMapa} fonte={fontes.cde} />
                  </div>
                </SecaoDoPainel>

                <SecaoDoPainel id="historico-uf" titulo={tx("Como as UF escolhidas evoluíram mês a mês?", "How have the chosen states evolved month by month?")}>
                  <InclusaoHistoricoUfTsee ufs={t.ufs} serieUfUrl={t.serie_cde_uf_json} atingidas={atingidas} marcos={marcosCde} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="modalidades"
                  titulo={tx(
                    `Quem recebe e quanto consome: modalidade e faixa de consumo em ${mes(t.modalidades_referencia.mes)}`,
                    `Who receives it and how much they consume: type and consumption band in ${mes(t.modalidades_referencia.mes)}`,
                  )}
                >
                  <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-carvao">{tx(`Modalidades em ${mes(t.modalidades_referencia.mes)}`, `Types in ${mes(t.modalidades_referencia.mes)}`)}</p>
                      <TabelaDados
                        titulo={tx("UC com Tarifa Social por modalidade", "Consumer units with Tarifa Social by type")}
                        colunas={[tx("Modalidade", "Type"), tx("UC", "Consumer units")]}
                        linhas={linhasModalidades}
                        casas={[null, 0]}
                        limite={linhasModalidades.length}
                        recolhida={false}
                        idioma={idioma}
                      />
                    </div>
                    <GraficoBarras
                      titulo={tx(
                        `UC com Tarifa Social por faixa de consumo: ${mes(t.faixas_consumo.mes_anterior)} e ${mes(t.faixas_consumo.mes)}`,
                        `Consumer units with Tarifa Social by consumption band: ${mes(t.faixas_consumo.mes_anterior)} and ${mes(t.faixas_consumo.mes)}`,
                      )}
                      dados={t.faixas_consumo.linhas.map((l) => ({
                        id: l.faixa,
                        rotulo: dadoTexto(l.rotulo, idioma),
                        atual: l.pct_das_uc_tsee,
                        anterior: t.faixas_consumo.linhas_anterior.find((x) => x.faixa === l.faixa)?.pct_das_uc_tsee ?? null,
                      }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[
                        { id: "anterior", rotulo: mes(t.faixas_consumo.mes_anterior), cor: "var(--serie-referencia)" },
                        { id: "atual", rotulo: mes(t.faixas_consumo.mes), cor: "var(--cor-energia)" }, // i18n: dado
                      ]}
                      unidade={tx("% das UC com Tarifa Social", "% of consumer units with Tarifa Social")}
                      casas={1}
                      orientacao="horizontal"
                      rotulosValor
                    />
                  </div>
                </SecaoDoPainel>

                {custeio && (
                  <SecaoDoPainel id="custeio" titulo={tx("Quanto a CDE destina à Tarifa Social por ano?", "How much does the CDE allocate to the Tarifa Social each year?")}>
                    <GraficoBarras
                      titulo={tx(
                        `Valor anual da CDE para a Tarifa Social, ${custeio.linhas[0]?.ano ?? ""} a ${custeio.linhas.at(-1)?.ano ?? ""} (R$ bilhões correntes)`,
                        `Annual CDE amount for the Tarifa Social, ${custeio.linhas[0]?.ano ?? ""} to ${custeio.linhas.at(-1)?.ano ?? ""} (current R$ billion)`,
                      )}
                      dados={custeio.linhas.map((l) => ({
                        id: l.ano,
                        rotulo: l.ano === custeio.ano_corrente ? tx(`${l.ano} (ano em curso)`, `${l.ano} (current year)`) : l.ano,
                        valor: l.tarifa_social_reais === null ? null : l.tarifa_social_reais / 1e9,
                      }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "valor", rotulo: tx("Tarifa Social na CDE", "Tarifa Social in the CDE"), cor: "var(--cor-energia)" }]} // i18n: dado
                      unidade={tx("R$ bilhões", "R$ billion")}
                      casas={2}
                      altura={280}
                    />
                    <p className="max-w-prose2 text-sm text-carvao-muted">{textoCusteioTarifaSocial(custeio)}</p>
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel
                  id="distribuidoras"
                  nivel="analisar" // i18n: dado
                  titulo={tx(
                    `Distribuidoras em ${mes(t.mes_referencia)}: UC, participação, DMR e conferência com a CDE`,
                    `Distribution utilities in ${mes(t.mes_referencia)}: consumer units, share, DMR and check against the CDE`,
                  )}
                >
                  <TabelaInterativa
                    titulo={tx(`Tarifa Social por distribuidora, ${mes(t.mes_referencia)} (SCS)`, `Tarifa Social by distribution utility, ${mes(t.mes_referencia)} (SCS)`)}
                    colunas={colunasDistribuidoras()}
                    linhas={linhasDistribuidoras(t.distribuidoras)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={fontes.scs}
                    versao={t.mes_referencia}
                    nomeArquivo="inclusao-tarifa-social-distribuidoras"
                    chaveUrl="ts.dist"
                    ordemInicial={{ coluna: "uc_tsee", direcao: "desc" }}
                    dicaBusca={tx("Sigla, CNPJ ou UF", "Acronym, CNPJ or state")}
                    nota={tx(
                      "Participação nula quando o total residencial do mês é inconsistente (regra no modo Auditar). Faturas contra UC: diferença do arquivo da CDE do mesmo mês.",
                      "Share is null when the month's residential total is inconsistent (rule in Audit mode). Bills against consumer units: difference from the CDE file of the same month.",
                    )}
                  />
                  <TabelaInterativa
                    titulo={tx("Série mensal nacional do SCS, todos os meses publicados", "National monthly SCS series, all published months")}
                    colunas={colunasSerieTsee()}
                    linhas={linhasTabelaSerieTsee(serie)}
                    chaveLinha="id"
                    colunaRotulo="m"
                    fonte={fontes.scs}
                    versao={t.mes_referencia}
                    nomeArquivo="inclusao-tarifa-social-mensal"
                    chaveUrl="ts.mes"
                    ordemInicial={{ coluna: "m", direcao: "desc" }}
                    dicaBusca={tx("Mês (AAAA-MM)", "Month (YYYY-MM)")}
                  />
                </SecaoDoPainel>

                <InclusaoSeguir
                  ancora="p059"
                  proximo={{
                    href: rotaPainel("p060"),
                    pergunta: tx("Quantas faturas há para cada 100 famílias do Cadastro Único (proxy)?", "How many bills are there for every 100 Cadastro Único families (proxy)?"),
                  }}
                  downloads={downloads([
                    "/energia/series/inclusao_tsee_mensal.csv",
                    "/energia/series/inclusao_tsee_distribuidoras.csv",
                    "/energia/series/inclusao_cde_mensal_uf.csv",
                    "/energia/series/inclusao_tsee_antiga.csv",
                    "/energia/series/inclusao_cde_custeio.csv",
                  ])}
                />
              </>
            }
          >
            <InclusaoSerieTsee
              serie={serie}
              marcos={marcosScs}
              resposta={
                <InclusaoPorMedidaTsee
                  variantes={{ uc: <TarifaSocialResposta t={t} medida="uc" />, part: <TarifaSocialResposta t={t} medida="part" />, dmr: <TarifaSocialResposta t={t} medida="dmr" /> }}
                />
              }
              recorte={
                <InclusaoRecorte
                  periodo={tx(
                    <>
                      SCS de {mes(serie[0]?.m)} a {mes(serie.at(-1)?.m)} (referência {mes(t.mes_referencia)}); CDE de {mes(cdeComValor[0]?.mes)} a {mes(cdeComValor.at(-1)?.mes)} (mapa em {mes(mesMapa)})
                    </>,
                    <>
                      SCS from {mes(serie[0]?.m)} to {mes(serie.at(-1)?.m)} (reference {mes(t.mes_referencia)}); CDE from {mes(cdeComValor[0]?.mes)} to {mes(cdeComValor.at(-1)?.mes)} (map in{" "}
                      {mes(mesMapa)})
                    </>,
                  )}
                  universo={tx(
                    <>
                      {t.distribuidoras.length} distribuidoras no SCS; {ufsComFaturas} UF e {inteiro(municipiosComFaturas)} municípios com faturas no mês do mapa
                    </>,
                    <>
                      {t.distribuidoras.length} distribution utilities in the SCS; {ufsComFaturas} states and {inteiro(municipiosComFaturas)} municipalities with bills in the map month
                    </>,
                  )}
                  unidade={tx("UC (SCS); faturas (CDE); R$ correntes", "consumer units (SCS); bills (CDE); current R$")}
                />
              }
            />
          </FiguraAnalitica>
        }
        metodo={
          <>
            {/* as regras, as conferências e a série antiga (antes, a seção de Auditar no fim do painel) são o método desta página */}
            <SecaoDoPainel id="regras-p059" nivel="auditar" titulo={tx("Regras, conferências e a série antiga", "Rules, checks and the old series")}>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {Object.entries(t.regras).map(([id, txt]) => (
                  <div key={id}>
                    <dt className="font-medium text-carvao">{rotuloRegra(id)}</dt>
                    <dd className="mt-0.5 text-carvao-muted">{dadoNo(txt, "regra-tarifa-social", idioma)}</dd>
                  </div>
                ))}
              </dl>
              {conf && (
                <>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Conferência SCS e CDE em {mes(conf.mes)}, mesmas {conf.distribuidoras_comparadas} distribuidoras: {inteiro(conf.uc_scs)} UC e {inteiro(conf.faturas_cde)} faturas (
                        {pct(conf.diferenca_pct, 2)}); {reaisGrandes(conf.dmr_scs_reais)} de DMR e {reaisGrandes(conf.desconto_cde_reais)} de desconto ({pct(conf.diferenca_valor_pct, 2)});{" "}
                        {conf.distribuidoras_ate_2pct} distribuidoras dentro de 2%. Tolerância: {conf.tolerancia}
                        {conf.so_na_cde.length ? ` Só na CDE: ${conf.so_na_cde.join(", ")}.` : ""}
                        {conf.so_no_scs.length ? ` Só no SCS: ${conf.so_no_scs.join(", ")}.` : ""}
                      </>,
                      <>
                        SCS and CDE check in {mes(conf.mes)}, same {conf.distribuidoras_comparadas} distribution utilities: {inteiro(conf.uc_scs)} consumer units and{" "}
                        {inteiro(conf.faturas_cde)} bills ({pct(conf.diferenca_pct, 2)}); {reaisGrandes(conf.dmr_scs_reais)} of DMR and {reaisGrandes(conf.desconto_cde_reais)} of discount (
                        {pct(conf.diferenca_valor_pct, 2)}); {conf.distribuidoras_ate_2pct} utilities within 2%. Tolerance: {dadoNo(conf.tolerancia, "tolerancia-scs-cde", idioma)}
                        {conf.so_na_cde.length ? ` Only in the CDE: ${conf.so_na_cde.join(", ")}.` : ""}
                        {conf.so_no_scs.length ? ` Only in the SCS: ${conf.so_no_scs.join(", ")}.` : ""}
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx(`Maiores diferenças entre UC do SCS e faturas da CDE, ${mes(conf.mes)}`, `Largest differences between SCS consumer units and CDE bills, ${mes(conf.mes)}`)}
                    colunas={colunasConferencia()}
                    linhas={linhasConferencia}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={`${fontes.scs}; ${fontes.cde}`}
                    versao={conf.mes}
                    nomeArquivo="inclusao-conferencia-scs-cde"
                    chaveUrl="ts.conf"
                    ordemInicial={{ coluna: "diferenca_pct", direcao: "desc" }}
                  />
                </>
              )}
              {t.incorporacoes.length > 0 && (
                <TabelaInterativa
                  titulo={tx("Incorporações detectadas no SCS (não são inconsistência)", "Mergers detected in the SCS (not an inconsistency)")}
                  colunas={colunasIncorporacoes()}
                  linhas={t.incorporacoes.map((i) => ({
                    id: `${i.mes_ruptura}|${i.sucessora}`,
                    mes: i.mes_ruptura,
                    sucessora: i.sigla_sucessora ?? i.sucessora,
                    incorporadas: i.siglas_incorporadas.map((s, j) => s ?? i.incorporadas[j]).join(", "),
                    total: i.total_incorporadas,
                    salto: i.salto_sucessora,
                  }))}
                  chaveLinha="id"
                  colunaRotulo="mes"
                  fonte={fontes.scs}
                  versao={t.mes_referencia}
                  nomeArquivo="inclusao-incorporacoes-scs"
                  chaveUrl="ts.inc"
                />
              )}
              {t.siglas_de_outra_fonte.length > 0 && (
                <p className="text-sm text-carvao-muted">
                  {tx(
                    `Siglas tomadas de outra fonte: ${t.siglas_de_outra_fonte.map((s) => `CNPJ ${s.cnpj} exibido como ${s.sigla} (${s.origem})`).join("; ")}.`,
                    `Acronyms taken from another source: ${t.siglas_de_outra_fonte.map((s) => `CNPJ ${s.cnpj} shown as ${s.sigla} (${dadoTexto(s.origem, idioma)})`).join("; ")}.`,
                  )}
                </p>
              )}
              {t.diagnostico_scs && (
                <p className="text-sm text-carvao-muted">
                  {tx(
                    <>
                      Arquivo do SCS: {inteiro(t.diagnostico_scs.linhas)} linhas, {inteiro(t.diagnostico_scs.pares)} pares distribuidora e competência;{" "}
                      {inteiro(t.diagnostico_scs.pares_com_mais_de_um_despacho)} pares em mais de um despacho, {t.diagnostico_scs.pares_com_despachos_divergentes} com valores divergentes;{" "}
                      {t.diagnostico_scs.pares_com_faixas_incompletas} com faixas incompletas.
                    </>,
                    <>
                      SCS file: {inteiro(t.diagnostico_scs.linhas)} rows, {inteiro(t.diagnostico_scs.pares)} distribution utility and accrual month pairs;{" "}
                      {inteiro(t.diagnostico_scs.pares_com_mais_de_um_despacho)} pairs in more than one order, {t.diagnostico_scs.pares_com_despachos_divergentes} with divergent values;{" "}
                      {t.diagnostico_scs.pares_com_faixas_incompletas} with incomplete bands.
                    </>,
                  )}
                </p>
              )}
              {antiga && (
                <>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Série antiga descontinuada: o portal a intitula &ldquo;{antiga.titulo_no_portal}&rdquo;. Teste do recurso em {carimbo(antiga.teste_do_recurso.testado_em)}: HTTP{" "}
                        {antiga.teste_do_recurso.status_http}, {antiga.teste_do_recurso.conclusao}. Cópia usada: <span className="break-all">{antiga.copia_usada}</span>. Ela entra só como
                        histórico identificado, nunca como fonte atual.
                      </>,
                      <>
                        Discontinued old series: the portal titles it &ldquo;<Nome>{antiga.titulo_no_portal}</Nome>&rdquo;. Resource test on {carimbo(antiga.teste_do_recurso.testado_em)}: HTTP{" "}
                        {antiga.teste_do_recurso.status_http}, {dadoNo(antiga.teste_do_recurso.conclusao, "serie-antiga", idioma)}. Copy used:{" "}
                        <span className="break-all">{antiga.copia_usada}</span>. It enters only as identified history, never as a current source.
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Série antiga da ANEEL contra o SCS nos trimestres comuns", "ANEEL's old series against the SCS in the common quarters")}
                    colunas={colunasAntiga()}
                    linhas={antiga.comparacao_scs.map((x) => ({
                      id: x.m,
                      m: x.m,
                      antiga: x.uc_baixa_renda_antiga,
                      scs: x.uc_tsee_scs,
                      dif: x.diferenca_pct,
                      repete: x.repete_trimestre ?? "",
                    }))}
                    chaveLinha="id"
                    colunaRotulo="m"
                    fonte={tx(
                      "ANEEL, Tarifa Social de Energia Elétrica: Beneficiários (descontinuado)",
                      "ANEEL, Tarifa Social de Energia Elétrica beneficiaries dataset (discontinued)",
                    )}
                    versao={antiga.comparacao_scs.at(-1)?.m ?? ""}
                    nomeArquivo="inclusao-serie-antiga-contra-scs"
                    chaveUrl="ts.ant"
                    nota={tx(
                      "Trimestre que repete a contagem de outro no arquivo original fica marcado e fora da estatística de concordância.",
                      "A quarter that repeats another's count in the original file is flagged and left out of the agreement statistic.",
                    )}
                  />
                </>
              )}
            </SecaoDoPainel>
            <p>
              {tx("Regras gerais em", "General rules in the")}{" "}
              <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
                {tx("metodologia", "methodology")}
              </Link>
              .
            </p>
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/setor-eletrico"]} variante="metodo" idioma={idioma} />}
      />
    </>
  );
}
