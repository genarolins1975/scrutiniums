import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { BandeiraDoMes } from "@/components/energia/BandeiraDoMes";
import { ContaBandeiras } from "@/components/energia/ContaBandeiras";
import { ContaBarrasReais } from "@/components/energia/ContaBarrasReais";
import { ContaLinkFiltros } from "@/components/energia/ContaLinkPainel";
import { ContaPorValores } from "@/components/energia/ContaPorValores";
import { ContaReajustes } from "@/components/energia/ContaReajustes";
import { ContaTabelaSobDemanda } from "@/components/energia/ContaTabelaSobDemanda";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ContaRolavel } from "@/components/energia/ContaRolavel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COR_GRUPO_CDE,
  GRUPOS_DESPESA_CDE,
  GRUPOS_RECEITA_CDE,
  categoriasQueZeraram,
  categoriasSubsidio,
  comProcedimentoExterno,
  compactarInfo,
  custoDoPerfil,
  compactarLinhasTabela,
  corSubsidio,
  fatoresReaisPorAno,
  linhasCde,
  linhasSubsidios,
  mudancaSubsidios,
  notaQuotas,
  respostaBandeira,
  respostaCde,
  respostaSubsidios,
  minuscula,
  rotuloDistribuidora,
  serieQuotas,
  textoCategoriasQueZeraram,
  textoResidualQuotas,
  valorNoModo,
  verboVariacao,
  vereditoBandeira,
  vereditoSubsidios,
  type ValoresDoPainel,
} from "@/lib/energia/conta";
import { mesCorrenteBrasilia } from "@/lib/energia/bandeira-do-mes";
import { carimbo, dataBR, mesAno, num, pct, reais } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { bandeiraNoIdioma, dadoEn, dadoNo, dadoTexto } from "@/lib/energia/i18n/conta-inclusao";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { ContaGold } from "@/lib/energia/tipos-conta";
import { infoDasDistribuidoras, lerIpca } from "../dados";
import { Auditoria, Datas, fonteTarifas, Navegacao, ROTA_CONTA, ROTA_REAJUSTES, Recorte, Seguir, downloadsDoPainel } from "../partes";

/**
 * P050 do módulo Conta de luz em página própria: "O que mudou e quem financia os
 * benefícios?". Três painéis de fontes e naturezas diferentes (variação da tarifa
 * B1 contra o IPCA, bandeiras acionadas e financiamento dos descontos pela CDE).
 * Fica separada das tarifas, da composição e do simulador por peso: as duas metades
 * juntas passavam da meta de HTML do contrato dos módulos (seção 5.1). A escolha de
 * distribuidoras (?dist=) atravessa as duas páginas pelos links internos.
 */

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/conta-de-luz/reajustes-e-subsidios", {
    title: tx("Conta de luz: reajustes, bandeiras e subsídios", "Electricity bill: adjustments, tariff flags and subsidies"),
    description: tx(
      "Variação da tarifa B1 residencial de cada distribuidora contra o IPCA no mesmo período, bandeiras tarifárias acionadas mês a mês, subsídios tarifários por categoria e orçamento anual da CDE.",
      "Change in each distribution utility's residential B1 tariff against the IPCA over the same period, tariff flags activated month by month, tariff subsidies by category and the annual Energy Development Account (CDE) budget.",
    ),
    alternates: { canonical: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios" },
  }, anterior);
}

/* As colunas são montadas na hora do render (o idioma vem da página), nunca no topo do módulo. */
function colunasBandeiras(): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês", "Month"), tipo: "data" },
    { id: "bandeira", rotulo: tx("Bandeira", "Tariff flag"), tipo: "texto", categorica: true },
    {
      id: "rs_mwh",
      rotulo: tx("Adicional acionado", "Surcharge activated"),
      tipo: "numero",
      unidade: "R$/MWh",
      casas: 2,
    },
  ];
}

function colunasSubDist(): ColunaTabela[] {
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto", idiomaTexto: "nome" },
    { id: "nome", rotulo: tx("Razão social", "Legal name"), tipo: "texto", idiomaTexto: "nome" },
    { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
    {
      id: "total", // i18n: dado
      rotulo: tx("Repasse homologado no ano", "Transfer ratified in the year"),
      tipo: "numero",
      unidade: tx("R$ milhões", "R$ million"),
      casas: 1,
    },
  ];
}

/** Colunas da tabela do orçamento da CDE (rótulos dos grupos vêm da gold, no idioma da página). */
function colunasCde(rotuloGrupoCde: ReadonlyMap<string, string>): ColunaTabela[] {
  const bi = tx("R$ bi", "R$ bn");
  return [
    { id: "ano", rotulo: tx("Ano", "Year"), tipo: "texto" }, // i18n: dado
    {
      id: "despesa",
      rotulo: tx("Despesa", "Expense"),
      tipo: "numero",
      unidade: bi,
      casas: 2,
    },
    ...GRUPOS_DESPESA_CDE.map((id) => ({
      id,
      rotulo: rotuloGrupoCde.get(id) ?? id,
      tipo: "numero" as const,
      unidade: bi,
      casas: 2,
    })),
    {
      id: "receita",
      rotulo: tx("Receita", "Revenue"),
      tipo: "numero",
      unidade: bi,
      casas: 2,
    },
    {
      id: "quotas_tarifa",
      rotulo: rotuloGrupoCde.get("quotas_tarifa") ?? tx("Quotas", "Quotas"),
      tipo: "numero",
      unidade: bi,
      casas: 2,
    },
    {
      id: "outras_receitas",
      rotulo: rotuloGrupoCde.get("outras_receitas") ?? tx("Outras receitas", "Other revenue"),
      tipo: "numero",
      unidade: bi,
      casas: 2,
    },
    {
      id: "quotas_pct",
      rotulo: tx("Quotas nas receitas", "Quotas in revenue"),
      tipo: "percentual",
      casas: 1,
    },
    {
      id: "tarifa_social_pct",
      rotulo: tx("Tarifa Social nas despesas", "Tarifa Social in expenses"),
      tipo: "percentual",
      casas: 1,
    },
  ];
}

export default function ContaReajustesPage() {
  const g = lerGold<ContaGold>("conta.json");
  const idioma = idiomaEnergia();
  const COLUNAS_BANDEIRAS = colunasBandeiras();
  const COLUNAS_SUB_DIST = colunasSubDist();
  if (!integra(g)) {
    return (
      <>
        <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel
            titulo={tx("Reajustes, bandeiras e subsídios indisponíveis nesta publicação", "Adjustments, tariff flags and subsidies unavailable in this publication")}
            motivo={
              g?.motivo ??
              tx(
                "A gold do módulo Conta de luz (public/energia/gold/conta.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe.",
                "The Electricity bill module gold (public/energia/gold/conta.json) was not generated or did not pass validation; the last valid publication is kept when there is one.",
              )
            }
          />
        </main>
      </>
    );
  }

  const reaj = g.reajustes;
  const band = g.bandeiras;
  const sub = g.subsidios;
  const cde = g.financiamento_cde;
  const ref = g.data_referencia;
  // mês em que a página estática foi gerada; o navegador refaz a situação da bandeira com o mês de quem lê
  const mesDaPagina = mesCorrenteBrasilia();
  const ultimoIpca = reaj.comparacao_inflacao?.ultimo_ipca ?? null;
  const janela12 = reaj.comparacao_inflacao?.janelas.find((j) => j.meses === 12) ?? null;
  const linhasSub = linhasSubsidios(sub);
  const catsSub = categoriasSubsidio(sub);
  const linhasSubDist = sub.distribuidoras_ultimo_ano.map((d) => ({
    id: d.cnpj,
    sigla: rotuloDistribuidora(d.sigla, d.cnpj),
    nome: d.nome,
    cnpj: d.cnpj,
    total: d.total === null ? null : d.total / 1e6,
  }));
  const linhasCdeAno = cde ? linhasCde(cde) : [];
  const rotuloGrupoCde = new Map((cde?.grupos ?? []).map((x) => [x.id, dadoTexto(x.rotulo, idioma)]));
  const COLUNAS_CDE = colunasCde(rotuloGrupoCde);
  // a mudança mais recente pela data (a ordem do arquivo não é contrato)
  const ultimoEvento = reaj.ultimos.reduce<(typeof reaj.ultimos)[number] | null>((m, u) => (m === null || u[2] > m[2] ? u : m), null);
  const subUltimo = sub.anual.at(-1) ?? null;
  // a data da recusa vem do registro da coleta (dd/mm/aaaa); o código da resposta e o desafio do navegador ficam em Analisar
  const dataEfeitoMedio = /(\d{2}\/\d{2}\/\d{4})/.exec(reaj.efeito_medio.motivo)?.[1] ?? null;
  // a mesma data, escrita como a página inglesa escreve datas
  const dataEfeitoMedioEn = dataEfeitoMedio ? dataBR(`${dataEfeitoMedio.slice(6, 10)}-${dataEfeitoMedio.slice(3, 5)}-${dataEfeitoMedio.slice(0, 2)}`) : null;
  const adicionalVigente = band.vigente?.rs_mwh ?? null;
  const janelasMeses = (reaj.comparacao_inflacao?.janelas ?? []).map((j) => j.meses);
  const listaPt = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} ${tx("e", "and")} ${xs[xs.length - 1]}` : (xs[0] ?? ""));
  const patamarExemplo = band.patamares.find((p) => p.rs_mwh !== null && p.rs_mwh > 0 && p.rs_kwh !== null) ?? null;
  const contagemUltimoAno =
    Object.entries(band.contagem_por_ano)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .at(-1) ?? null;
  const mesBandeira = band.vigente ? mesAno(`${band.vigente.mes}-01`) : null;
  // UF de cada distribuidora das janelas (a união das três): o nome na lista e na faixa de pontos leva a UF
  const info = compactarInfo(infoDasDistribuidoras(Array.from(new Set((reaj.comparacao_inflacao?.janelas ?? []).flatMap((j) => j.distribuidoras.map((d) => d[0]))))));
  // subsídios e orçamento da CDE em reais do mês-base do IPCA (o mesmo da série da tarifa), com o fator de cada ano
  const ipca = lerIpca();
  const baseIpca = ultimoIpca;
  const anosValores = Array.from(new Set([...sub.anual.map((a) => a.ano), ...(cde?.anos ?? [])]));
  const fatoresReais = ipca && baseIpca ? fatoresReaisPorAno(ipca, anosValores, baseIpca) : {};
  const baseRotulo = ipca && baseIpca ? mesAno(`${baseIpca}-01`) : null;
  // a escolha Nominais ou Em reais (?valores=) vale para o painel inteiro: o número de destaque, as frases, o "o que mudou", as tabelas e os gráficos
  // falam na mesma moeda; a versão em reais só existe com o IPCA do mês-base (sem ele, só o nominal, e o gráfico diz que faltam os índices)
  const temReal = baseRotulo !== null && Object.values(fatoresReais).some((f) => f !== null);
  const valoresReal: ValoresDoPainel | null = temReal ? { modo: "real", base: baseRotulo, fatores: fatoresReais } : null;
  const anoSub = sub.anual.find((a) => a.ano === sub.ultimo_ano_completo) ?? null;
  const residualQuotas = textoResidualQuotas(cde);
  const residualQuotasReal = valoresReal ? textoResidualQuotas(cde, 2, valoresReal) : null;
  const notaDasQuotas = notaQuotas(cde);
  const zeraram = categoriasQueZeraram(sub);
  const textoZeraram = textoCategoriasQueZeraram(zeraram);
  const textoZeraramReal = valoresReal ? textoCategoriasQueZeraram(zeraram, valoresReal) : null;
  const nominalDoAno = anoSub?.soma_categorias ?? null;
  const realDoAno = anoSub && valoresReal ? valorNoModo(anoSub.soma_categorias, anoSub.ano, valoresReal) : null;
  const evidenciaSub = comProcedimentoExterno(sub.evidencia);
  const kpiNominal = (
    <Numero
      variante="faixa"
      rotulo={tx(`Subsídios tarifários em ${sub.ultimo_ano_completo ?? "último ano"}`, `Tariff subsidies in ${sub.ultimo_ano_completo ?? "latest year"}`)}
      natureza="CALCULADO"
      valor={sub.evidencia && sub.evidencia.valor_calculo !== null ? sub.evidencia.valor_calculo / 1e9 : null}
      formato="reais"
      casas={1}
      unidade={tx("bilhões", "billion")}
      recorte={tx("Valores nominais", "Nominal values")}
      evidencia={evidenciaSub}
      motivoAusencia={tx("Sem ano completo publicado.", "No complete year published.")}
      nota={tx(
        "Valor homologado para repasse às distribuidoras, não desembolso realizado. Na moeda da época.",
        "Amount ratified for transfer to distribution utilities, not actual disbursement. In the currency of the time.",
      )}
      endereco={`${ROTA_REAJUSTES}#subsidios`}
    />
  );
  const kpiReal =
    valoresReal && realDoAno !== null && nominalDoAno !== null ? (
      <Numero
        variante="faixa"
        rotulo={tx(`Subsídios tarifários em ${sub.ultimo_ano_completo ?? "último ano"}`, `Tariff subsidies in ${sub.ultimo_ano_completo ?? "latest year"}`)}
        natureza="CALCULADO"
        valor={realDoAno / 1e9}
        formato="reais"
        casas={1}
        unidade={tx("bilhões", "billion")}
        recorte={tx(`Em reais de ${baseRotulo}`, `In ${baseRotulo} reais`)}
        evidencia={null}
        motivoAusencia={tx("Sem ano completo publicado.", "No complete year published.")}
        nota={tx(
          `Valor homologado para repasse, não desembolso realizado, corrigido pelo IPCA. O valor nominal é ${reais(nominalDoAno / 1e9, 2)} bilhões, o da ficha "Comprove este número": escolha Nominais, acima do primeiro gráfico, para abri-la.`,
          `Amount ratified for transfer, not actual disbursement, adjusted by the IPCA. The nominal value is ${reais(nominalDoAno / 1e9, 2)} billion, the one in the "Check this number" sheet: choose Nominal, above the first chart, to open it.`,
        )}
        endereco={`${ROTA_REAJUSTES}#subsidios`}
      />
    ) : null;

  // notas de cada painel: ficam logo depois das figuras do painel
  const ultimoSemIpca = ultimoEvento ? ultimoEvento[2].slice(0, 7) > ultimoEvento[7] : false;
  const oQueMudouReajustes = ultimoEvento
    ? tx(
        <>
          Mudança mais recente no arquivo: {rotuloDistribuidora(ultimoEvento[1], ultimoEvento[0])}, em {dataBR(ultimoEvento[2])} ({ultimoEvento[3]}), quando a tarifa B1{" "}
          {verboVariacao(ultimoEvento[4])}; o IPCA desde a mudança anterior ({mesAno(`${ultimoEvento[6]}-01`)} a {mesAno(`${ultimoEvento[7]}-01`)}) foi {pct(ultimoEvento[5], 2)}
          {ultimoSemIpca
            ? `, e o IPCA de ${mesAno(`${ultimoEvento[2].slice(0, 7)}-01`)}, mês da mudança, não consta nos dados: vale o último índice publicado, de ${mesAno(`${ultimoEvento[7]}-01`)}`
            : ""}
          .
        </>,
        <>
          Most recent change in the file: <Nome>{rotuloDistribuidora(ultimoEvento[1], ultimoEvento[0])}</Nome>, on {dataBR(ultimoEvento[2])} ({ultimoEvento[3]}), when the B1 tariff{" "}
          {verboVariacao(ultimoEvento[4])}; the IPCA since the previous change ({mesAno(`${ultimoEvento[6]}-01`)} to {mesAno(`${ultimoEvento[7]}-01`)}) was {pct(ultimoEvento[5], 2)}
          {ultimoSemIpca
            ? `, and the IPCA for ${mesAno(`${ultimoEvento[2].slice(0, 7)}-01`)}, the month of the change, is not in the data: the last published index, for ${mesAno(`${ultimoEvento[7]}-01`)}, applies`
            : ""}
          .
        </>,
      )
    : tx("Nenhuma mudança de tarifa no arquivo.", "No tariff change in the file.");
  const comoInterpretarReajustes = tx(
    <>
      Barra além da linha do IPCA: a tarifa subiu mais que a inflação na janela; antes dela, menos. A tarifa é a vigente no último dia do mês inicial e do mês final; o IPCA é a razão
      dos números-índice dos mesmos meses (
      {reaj.comparacao_inflacao?.conferencia_ipca_12m.confere ? "conferida contra a variação publicada pelo IBGE" : "sem conferência com a variação publicada"}
      ).
    </>,
    <>
      A bar beyond the IPCA line: the tariff rose more than inflation in the window; before it, less. The tariff is the one in force on the last day of the starting month and of the ending
      month; the IPCA is the ratio of the index numbers of the same months (
      {reaj.comparacao_inflacao?.conferencia_ipca_12m.confere ? "checked against the change published by IBGE" : "not checked against the published change"}
      ).
    </>,
  );
  const naoConcluirReajustes = tx(
    <>
      {reaj.nota} O efeito médio de cada processo para todos os consumidores não está publicado aqui. O conjunto não informa se o ato é reajuste, revisão periódica ou extraordinária. A
      diferença entre o PLD e a tarifa não é margem da distribuidora.
    </>,
    <>
      {dadoNo(reaj.nota, "conta-reajustes-nota", idioma)} The average effect of each process for all consumers is not published here. The dataset does not say whether the act is an
      adjustment, a periodic review or an extraordinary review. The difference between the PLD and the tariff is not the distribution utility&apos;s margin.
    </>,
  );
  const contagemTexto = contagemUltimoAno
    ? Object.entries(contagemUltimoAno[1])
        .map(([b, n]) => tx(`${n} ${n === 1 ? "mês" : "meses"} de ${minuscula(b)}`, `${n} ${n === 1 ? "month" : "months"} of ${minuscula(bandeiraNoIdioma(b, idioma))}`))
        .join(", ")
    : "";
  const oQueMudouBandeiras = contagemUltimoAno
    ? tx(
        <>
          Em {contagemUltimoAno[0]} (até {mesBandeira ?? "o último mês publicado"}
          ):{" "}
          {contagemTexto}
          .
        </>,
        <>
          In {contagemUltimoAno[0]} (up to {mesBandeira ?? "the last published month"}
          ):{" "}
          {contagemTexto}
          .
        </>,
      )
    : tx("Sem acionamento publicado.", "No published activation.");
  const comoInterpretarBandeiras = tx(
    <>
      Cada célula é um mês, com a sigla da bandeira; o valor do adicional de cada patamar mudou ao longo do tempo (tabela de adicionais por resolução, no modo Analisar). O valor
      publicado está em R$/MWh e se divide por 1000 para chegar ao valor por kWh
      {patamarExemplo ? `: ${num(patamarExemplo.rs_mwh, 2)} R$/MWh da ${minuscula(patamarExemplo.bandeira)} são ${reais(patamarExemplo.rs_kwh, 5)} por kWh, como na página da ANEEL` : ""}.
    </>,
    <>
      Each cell is a month, with the tariff flag&apos;s acronym; the surcharge of each level changed over time (table of surcharges by resolution, in Analyze mode). The published value is in
      R$/MWh and is divided by 1000 to get the value per kWh
      {patamarExemplo
        ? `: ${num(patamarExemplo.rs_mwh, 2)} R$/MWh of the ${minuscula(bandeiraNoIdioma(patamarExemplo.bandeira, idioma))} flag are ${reais(patamarExemplo.rs_kwh, 5)} per kWh, as on ANEEL's page`
        : ""}
      .
    </>,
  );
  const naoConcluirBandeiras = tx(
    <>
      A grade não mostra o efeito da bandeira na conta de cada distribuidora: o acréscimo depende do consumo e não vale nos sistemas isolados. Em {band.conferencia.divergem.length} dos{" "}
      {band.conferencia.meses} meses o valor acionado não confere com a tabela de adicionais ou não tem resolução correspondente (lista no modo Auditar).
    </>,
    <>
      The grid does not show the tariff flag&apos;s effect on each distribution utility&apos;s bill: the surcharge depends on consumption and does not apply in isolated systems. In{" "}
      {band.conferencia.divergem.length} of the {band.conferencia.meses} months the activated value does not match the surcharge table or has no corresponding resolution (list in Audit
      mode).
    </>,
  );
  const temParcial = linhasSub.some((l) => sub.anual.some((a) => a.parcial && a.ano === l.ano));
  const comoInterpretarSubsidios = tx(
    <>
      O primeiro gráfico soma os repasses homologados por distribuidora e mês, por ano de competência (
      {temParcial ? "o ano parcial está marcado" : "todos os anos completos"}). O segundo mostra o orçamento anual da CDE por grupo
      de despesa: valores aprovados ou previstos pela ANEEL, não execução.
    </>,
    <>
      The first chart adds up the ratified transfers by distribution utility and month, by accrual year (
      {temParcial ? "the partial year is marked" : "all years complete"}). The second shows the annual CDE budget by expense group: amounts approved or forecast by ANEEL, not execution.
    </>,
  );
  const oQueMudouSubsidios = <ContaPorValores nominal={mudancaSubsidios(sub)} real={valoresReal ? mudancaSubsidios(sub, valoresReal) : null} />;
  const naoConcluirSubsidios = tx(
    <>
      {sub.nota} Os dois conjuntos não se somam: {cde?.comparacao_com_subsidios ?? "o orçamento da CDE não foi publicado nesta gold."} Orçamento não é o que foi gasto.
    </>,
    <>
      {dadoNo(sub.nota, "conta-subsidios-nota", idioma)} The two datasets do not add up:{" "}
      {cde?.comparacao_com_subsidios ? dadoNo(cde.comparacao_com_subsidios, "conta-cde-comparacao", idioma) : "the CDE budget was not published in this release."} A budget is not
      what was spent.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:conta-de-luz:reajustes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <Navegacao atual="reajustes" />
        <CabecalhoModulo
          siglas={["REH", "PLD", "SIN", "TUSD", "TE", "ANEEL", "IPCA", "CDE", "SCEE"]}
          rotulo={tx("Conta de luz", "Electricity bill")}
          titulo={tx("O que mudou e quem financia os benefícios?", "What changed and who funds the benefits?")}
          lead={tx(
            "A tarifa B1 (residencial, baixa tensão) muda a cada reajuste, a bandeira tarifária acrescenta valor à conta em alguns meses, e os descontos a categorias de usuários são pagos pela Conta de Desenvolvimento Energético (CDE), com quotas cobradas de todos os consumidores. Aqui a variação da tarifa vem contra a inflação (IPCA), as bandeiras mês a mês e a origem do dinheiro dos descontos.",
            "The B1 tariff (residential, low voltage) changes with each adjustment, the tariff flag adds to the bill in some months, and discounts to user categories are paid by the Energy Development Account (CDE), with quotas charged to all consumers. Here the tariff change is set against inflation (IPCA), the tariff flags month by month and where the money for the discounts comes from.",
          )}
          limite={tx(
            "Não é o efeito médio do processo tarifário, que a fonte não publica em dado aberto: a variação é a da tarifa B1 entre duas datas. Subsídios são valores homologados e o orçamento da CDE é aprovado ou previsto, não desembolso.",
            "It is not the average effect of the tariff process, which the source does not publish as open data: the change is that of the B1 tariff between two dates. Subsidies are ratified amounts and the CDE budget is approved or forecast, not disbursement.",
          )}
          recorte={tx(
            `Variação até ${dataBR(janela12?.ate ?? ref)} · bandeiras até ${mesBandeira ?? "o último mês publicado"} · subsídios de ${sub.ultimo_ano_completo ?? "sem ano completo"} · orçamento da CDE de ${cde?.ultimo_ano ?? "sem dado"}`,
            `Change up to ${dataBR(janela12?.ate ?? ref)} · tariff flags up to ${mesBandeira ?? "the last published month"} · subsidies for ${sub.ultimo_ano_completo ?? "no complete year"} · CDE budget for ${cde?.ultimo_ano ?? "no data"}`,
          )}
          fonte={tx("ANEEL e IBGE", "ANEEL and IBGE")}
          referencia={tx(
            <>
              Tarifas de aplicação da ANEEL até {dataBR(ref)}; IPCA até {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "mês não publicado"}; bandeira de{" "}
              {mesBandeira ?? "mês não publicado"}; subsídios até {subUltimo ? `${subUltimo.ano}${subUltimo.parcial ? ` (${subUltimo.meses} ${subUltimo.meses === 1 ? "mês" : "meses"}, parcial)` : ""}` : "sem dado"} e orçamento da CDE de{" "}
              {cde?.ultimo_ano ?? "sem dado"}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL applied tariffs up to {dataBR(ref)}; IPCA up to {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "month not published"}; tariff flag for {mesBandeira ?? "month not published"};
              subsidies up to {subUltimo ? `${subUltimo.ano}${subUltimo.parcial ? ` (${subUltimo.meses} ${subUltimo.meses === 1 ? "month" : "months"}, partial)` : ""}` : "no data"} and CDE budget
              for {cde?.ultimo_ano ?? "no data"}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <Datas
              itens={[
                { rotulo: tx("Tarifas", "Tariffs"), texto: tx(`até ${dataBR(ref)}`, `up to ${dataBR(ref)}`), natureza: "CALCULADO" },
                {
                  rotulo: "IPCA",
                  texto: ultimoIpca ? tx(`até ${mesAno(`${ultimoIpca}-01`)}`, `up to ${mesAno(`${ultimoIpca}-01`)}`) : tx("sem dado nesta publicação", "no data in this publication"),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: tx("Bandeiras", "Tariff flags"),
                  texto: mesBandeira ? tx(`até ${mesBandeira}`, `up to ${mesBandeira}`) : tx("sem dado nesta publicação", "no data in this publication"),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: tx("Subsídios tarifários", "Tariff subsidies"),
                  texto: subUltimo
                    ? tx(`até ${subUltimo.ano}${subUltimo.parcial ? " (parcial)" : ""}`, `up to ${subUltimo.ano}${subUltimo.parcial ? " (partial)" : ""}`)
                    : tx("sem dado nesta publicação", "no data in this publication"),
                  natureza: "CALCULADO",
                },
                {
                  rotulo: tx("Orçamento da CDE", "CDE budget"),
                  texto: cde ? tx(`de ${cde.ultimo_ano}`, `for ${cde.ultimo_ano}`) : tx("sem dado nesta publicação", "no data in this publication"),
                  natureza: "PREVISTO",
                },
              ]}
            />
          }
        >
          {tx(
            <>
              Três leituras separadas, com fontes e naturezas diferentes: quanto a tarifa B1 de cada distribuidora mudou diante da inflação, quando a bandeira encareceu a conta e quem
              paga os descontos tarifários e a Tarifa Social. Tarifas, composição e o simulador estão na{" "}
              <ContaLinkFiltros href={ROTA_CONTA} className="text-energia-dark underline underline-offset-4">
                página principal da Conta de luz
              </ContaLinkFiltros>
              .
            </>,
            <>
              Three separate readings, with different sources and natures: how much each distribution utility&apos;s B1 tariff changed against inflation, when the tariff flag made the bill more
              expensive and who pays for the tariff discounts and the <Nome>Tarifa Social</Nome> (social electricity tariff). Tariffs, composition and the simulator are on the{" "}
              <ContaLinkFiltros href={ROTA_CONTA} className="text-energia-dark underline underline-offset-4">
                main Electricity bill page
              </ContaLinkFiltros>
              .
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          {/* ---------------- reajustes ---------------- */}
          <Bloco id="p050">
            <PainelEvidencia
              id="reajustes"
              pergunta={tx("A tarifa subiu mais que a inflação?", "Did the tariff rise more than inflation?")}
              subtitulo={tx(
                "Variação da tarifa B1 residencial entre duas datas, contra o IPCA do mesmo período · %",
                "Change in the residential B1 tariff between two dates, against the IPCA for the same period · %",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  Compara a variação da tarifa de cada distribuidora com a inflação medida pelo IPCA nos mesmos meses
                  {janelasMeses.length ? `, em janelas de ${listaPt(janelasMeses.map(String))} meses` : ""}.
                </>,
                <>
                  It compares the change in each distribution utility&apos;s tariff with inflation measured by the IPCA in the same months
                  {janelasMeses.length ? `, in windows of ${listaPt(janelasMeses.map(String))} months` : ""}.
                </>,
              )}
              oQueMudou={oQueMudouReajustes}
              comoInterpretar={comoInterpretarReajustes}
              naoConcluir={naoConcluirReajustes}
              naoConcluirNoCorpo
              proveniencia={reaj.proveniencia}
              complementares={[{ rotulo: "IPCA (IBGE)", p: reaj.proveniencia_ipca }]}
            >
              <div className="space-y-6">
                <ContaReajustes
                  janelas={reaj.comparacao_inflacao?.janelas ?? []}
                  ultimos={reaj.ultimos}
                  dataReferencia={ref}
                  fonte={fonteTarifas()}
                  info={info}
                  evidencia={comProcedimentoExterno(reaj.evidencia)}
                  endereco={`${ROTA_REAJUSTES}#reajustes`}
                  aviso={
                    <div className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao" data-bloco="efeito-medio">
                      <p className="rotulo text-mineral">{tx("Efeito médio do processo tarifário: não publicado", "Average effect of the tariff process: not published")}</p>
                      <p className="mt-1 leading-relaxed">
                        {tx(
                          <>
                            O efeito médio de cada processo tarifário (todas as classes) e o calendário dos processos não estão no portal de dados abertos da ANEEL, e os endereços da ANEEL que os publicam recusaram o
                            acesso do observatório{dataEfeitoMedio ? ` em ${dataEfeitoMedio}` : ""}. Este painel mostra a variação da tarifa B1 residencial entre duas datas, que é outra medida; nenhum valor de reserva
                            foi usado no lugar.
                          </>,
                          <>
                            The average effect of each tariff process (all classes) and the process calendar are not on ANEEL&apos;s open data portal, and the ANEEL addresses that publish them refused the
                            observatory&apos;s access{dataEfeitoMedio ? ` on ${dataEfeitoMedioEn}` : ""}. This panel shows the change in the residential B1 tariff between two dates, which is a different
                            measure; no fallback value was used instead.
                          </>,
                        )}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-carvao-muted" data-nivel="analisar">
                        {tx("Registro da coleta:", "Collection log:")} {dadoNo(reaj.efeito_medio.motivo, "conta-efeito-medio", idioma)}
                      </p>
                    </div>
                  }
                />
                <Recorte
                  periodo={tx(
                    <>
                      Janelas terminadas em {dataBR(reaj.comparacao_inflacao?.referencia)} (último IPCA: {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "não publicado"})
                    </>,
                    <>
                      Windows ending on {dataBR(reaj.comparacao_inflacao?.referencia)} (latest IPCA: {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "not published"})
                    </>,
                  )}
                  universo={tx(
                    <>Distribuidoras com tarifa B1 nas duas datas da janela e sem mudança de área entre elas</>,
                    <>Distribution utilities with a B1 tariff on both dates of the window and no change of area between them</>,
                  )}
                  unidade={tx("% de variação nominal; variação real na tabela", "% nominal change; real change in the table")}
                />
                <NotasDoPainel oQueMudou={oQueMudouReajustes} comoInterpretar={comoInterpretarReajustes} naoConcluir={naoConcluirReajustes} />
                <Auditoria titulo={tx("Incorporações e conferência do IPCA", "Mergers and IPCA check")}>
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {g.incorporacoes.map((i) => (
                      <li key={i.id}>
                        {tx(
                          <>
                            <span className="font-medium text-carvao">{rotuloDistribuidora(i.sigla_incorporadora, i.incorporadora)}</span> incorporou{" "}
                            {i.siglas_incorporadas.map((s, k) => rotuloDistribuidora(s, i.incorporadas[k])).join(", ")}; {i.ato} de {dataBR(i.data_ato)}; tarifa unificada desde{" "}
                            {dataBR(i.tarifa_unificada_desde)}; situação nos dados: {i.situacao}. Origem do número do ato: {i.identificacao}.
                          </>,
                          <>
                            <span className="font-medium text-carvao">
                              <Nome>{rotuloDistribuidora(i.sigla_incorporadora, i.incorporadora)}</Nome>
                            </span>{" "}
                            absorbed <Nome>{i.siglas_incorporadas.map((s, k) => rotuloDistribuidora(s, i.incorporadas[k])).join(", ")}</Nome>;{" "}
                            <Nome>{i.ato.replace(/ \(provável\)$/, "")}</Nome>
                            {/\(provável\)$/.test(i.ato) ? " (probable)" : ""} of {dataBR(i.data_ato)}; unified tariff since{" "}
                            {dataBR(i.tarifa_unificada_desde)}; status in the data: {dadoTexto(i.situacao, idioma)}. Source of the act number:{" "}
                            {dadoNo(i.identificacao, "conta-incorporacao-identificacao", idioma)}.
                          </>,
                        )}
                      </li>
                    ))}
                  </ul>
                  {reaj.comparacao_inflacao && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          IPCA em 12 meses até {mesAno(`${reaj.comparacao_inflacao.conferencia_ipca_12m.mes}-01`)}:{" "}
                          {pct(reaj.comparacao_inflacao.conferencia_ipca_12m.calculado_pct, 4)} pela razão de índices e{" "}
                          {pct(reaj.comparacao_inflacao.conferencia_ipca_12m.publicado_pct, 2)} publicado pelo IBGE (tolerância de{" "}
                          {num(reaj.comparacao_inflacao.conferencia_ipca_12m.tolerancia_pp, 2)} ponto percentual: {reaj.comparacao_inflacao.conferencia_ipca_12m.justificativa}
                          ). IPCA de {janela12 ? `${mesAno(`${janela12.ipca_meses[0]}-01`)} a ${mesAno(`${janela12.ipca_meses[1]}-01`)}` : "sem janela de 12 meses"}
                          {janela12 ? `: ${pct(janela12.ipca_pct, 2)}, pela razão dos números-índice do IBGE (SIDRA, tabela 1737), na fórmula da ficha "Comprove este número"` : ""}.
                        </>,
                        <>
                          12-month IPCA up to {mesAno(`${reaj.comparacao_inflacao.conferencia_ipca_12m.mes}-01`)}: {pct(reaj.comparacao_inflacao.conferencia_ipca_12m.calculado_pct, 4)} by the ratio of
                          indices and {pct(reaj.comparacao_inflacao.conferencia_ipca_12m.publicado_pct, 2)} published by IBGE (tolerance of{" "}
                          {num(reaj.comparacao_inflacao.conferencia_ipca_12m.tolerancia_pp, 2)} percentage point:{" "}
                          {dadoNo(reaj.comparacao_inflacao.conferencia_ipca_12m.justificativa, "conta-ipca-justificativa", idioma)}
                          ). IPCA from {janela12 ? `${mesAno(`${janela12.ipca_meses[0]}-01`)} to ${mesAno(`${janela12.ipca_meses[1]}-01`)}` : "no 12-month window"}
                          {janela12 ? `: ${pct(janela12.ipca_pct, 2)}, by the ratio of IBGE index numbers (SIDRA, table 1737), in the formula of the "Check this number" sheet` : ""}.
                        </>,
                      )}
                    </p>
                  )}
                </Auditoria>
                <Seguir
                  ancora="reajustes"
                  proximo={{ href: "#bandeiras", pergunta: tx("Quando a bandeira encareceu a conta?", "When did the tariff flag make the bill more expensive?") }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_reajustes_b1.csv", "conta_reajuste_vs_ipca.csv", "conta_ipca.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- bandeiras ---------------- */}
          <Bloco>
            <PainelEvidencia
              id="bandeiras"
              pergunta={tx("Quando a bandeira encareceu a conta?", "When did the tariff flag make the bill more expensive?")}
              subtitulo={tx(
                "Bandeira tarifária acionada por mês e adicional por kWh consumido · R$/MWh e R$/kWh",
                "Tariff flag activated by month and surcharge per kWh consumed · R$/MWh and R$/kWh",
              )}
              natureza="OBSERVADO"
              porQueImporta={tx(
                <>
                  A <Termo slug="bandeira-tarifaria">bandeira tarifária</Termo> soma à conta um valor por kWh consumido conforme o patamar acionado no mês; a verde não tem
                  acréscimo.
                </>,
                <>
                  The <Termo slug="bandeira-tarifaria">tariff flag</Termo> adds an amount per kWh consumed to the bill according to the level activated in the month; the green flag has no
                  surcharge.
                </>,
              )}
              oQueMudou={oQueMudouBandeiras}
              comoInterpretar={comoInterpretarBandeiras}
              naoConcluir={naoConcluirBandeiras}
              naoConcluirNoCorpo
              proveniencia={band.proveniencia}
            >
              <div className="space-y-6">
                <RespostaCurta id="p050-bandeiras" veredito={vereditoBandeira(band)}>
                  {respostaBandeira(band, idioma, mesDaPagina)}
                </RespostaCurta>
                <p className="max-w-3xl text-sm leading-relaxed text-carvao-muted" data-nota="bandeira-do-mes">
                  <BandeiraDoMes vigente={band.vigente} mesInicial={mesDaPagina} forma="frase" />
                </p>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                  <ContaBandeiras acionamento={band.acionamento} />
                  <div className="min-w-0 space-y-4">
                    <Numero
                      variante="faixa"
                      rotulo={tx(
                        `Adicional de ${band.vigente?.bandeira ? minuscula(band.vigente.bandeira) : "bandeira"} em ${mesBandeira ?? "mês não publicado"}`,
                        `${band.vigente?.bandeira ? bandeiraNoIdioma(band.vigente.bandeira, idioma) : "Tariff flag"} surcharge in ${mesBandeira ?? "month not published"}`,
                      )}
                      natureza="OBSERVADO"
                      valor={adicionalVigente === null ? null : adicionalVigente / 1000}
                      formato="reais"
                      casas={5}
                      unidade="R$/kWh"
                      evidencia={comProcedimentoExterno(band.evidencia)}
                      nota={
                        adicionalVigente !== null
                          ? tx(`${num(adicionalVigente, 2)} R$/MWh no arquivo da ANEEL, dividido por 1000.`, `${num(adicionalVigente, 2)} R$/MWh in ANEEL's file, divided by 1000.`)
                          : undefined
                      }
                      endereco={`${ROTA_REAJUSTES}#bandeiras`}
                    />
                    <table className="h-fit w-full border-collapse text-sm tabular-nums">
                      <caption className="text-left text-xs text-mineral">
                        {tx(`Patamares vigentes na data${mesBandeira ? ` (${mesBandeira})` : ""}`, `Levels in force on the date${mesBandeira ? ` (${mesBandeira})` : ""}`)}
                      </caption>
                      <tbody>
                        {band.patamares.map((p) => (
                          <tr key={p.bandeira} className="border-b border-linha">
                            <th scope="row" className="py-1.5 pr-2 text-left font-normal text-carvao">
                              {bandeiraNoIdioma(p.bandeira, idioma)}
                            </th>
                            <td className="py-1.5 text-right">
                              {p.rs_kwh === null ? tx("sem valor", "no value") : p.rs_kwh === 0 ? tx("sem acréscimo", "no surcharge") : `${reais(p.rs_kwh, 5)}/kWh`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {band.patamares.some((p) => p.rs_mwh !== null) && (
                  <table className="w-full max-w-prose2 border-collapse text-sm tabular-nums" data-bloco="bandeira-na-conta">
                    <caption className="mb-1 text-left text-sm text-carvao">
                      {tx(
                        <>
                          Quanto cada bandeira acrescenta à conta de {g.perfis_kwh.join(", ")} kWh no mês, em R$ e antes de tributos ({mesBandeira ?? "mês não publicado"})
                        </>,
                        <>
                          How much each tariff flag adds to the bill for {g.perfis_kwh.join(", ")} kWh a month, in R$ and before taxes ({mesBandeira ?? "month not published"})
                        </>,
                      )}
                    </caption>
                    <thead>
                      <tr className="border-b border-linha text-left text-xs text-mineral">
                        <th scope="col" className="py-1.5 pr-1 font-normal sm:pr-3">
                          {tx("Bandeira", "Tariff flag")}
                        </th>
                        {g.perfis_kwh.map((k) => (
                          <th key={k} scope="col" className="py-1.5 pr-1 text-right font-normal sm:pr-3">
                            {k} kWh
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {band.patamares
                        .filter((p) => p.rs_mwh !== null)
                        .map((p) => (
                          <tr key={p.bandeira} className="border-b border-linha">
                            <th scope="row" className="py-1.5 pr-1 text-left font-normal text-carvao sm:pr-3">
                              {bandeiraNoIdioma(p.bandeira, idioma)}
                            </th>
                            {g.perfis_kwh.map((k) => (
                              <td key={k} className="py-1.5 pr-1 text-right sm:pr-3">
                                {p.rs_mwh === 0 ? tx("sem acréscimo", "no surcharge") : reais(custoDoPerfil(p.rs_mwh, k))}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
                <Recorte
                  periodo={tx(
                    <>
                      {band.acionamento[0] ? mesAno(`${band.acionamento[0].m}-01`) : "sem dado"} a{" "}
                      {band.acionamento.at(-1) ? mesAno(`${band.acionamento.at(-1)!.m}-01`) : "sem dado"}
                    </>,
                    <>
                      {band.acionamento[0] ? mesAno(`${band.acionamento[0].m}-01`) : "no data"} to{" "}
                      {band.acionamento.at(-1) ? mesAno(`${band.acionamento.at(-1)!.m}-01`) : "no data"}
                    </>,
                  )}
                  universo={tx("Consumidores cativos do SIN; não se aplica a sistemas isolados", "Captive consumers of the SIN; does not apply to isolated systems")}
                  unidade={tx("R$/MWh publicado (÷ 1000 = R$/kWh)", "Published R$/MWh (÷ 1000 = R$/kWh)")}
                />
                <NotasDoPainel oQueMudou={oQueMudouBandeiras} comoInterpretar={comoInterpretarBandeiras} naoConcluir={naoConcluirBandeiras} />
                <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-6">
                  <h3 className="ed-h3 font-serif text-carvao">{tx("Adicionais por resolução", "Surcharges by resolution")}</h3>
                  <ContaRolavel rotulo={tx("Adicionais de bandeira por resolução", "Tariff flag surcharges by resolution")}>
                    <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums">
                      <thead>
                        <tr className="border-b border-linha text-left text-xs text-mineral">
                          <th scope="col" className="py-2 pr-3 font-normal">
                            {tx("Vigência", "Validity")}
                          </th>
                          <th scope="col" className="py-2 pr-3 font-normal">
                            {tx("Resolução", "Resolution")}
                          </th>
                          {Array.from(new Set(band.adicionais.flatMap((a) => Object.keys(a.valores)))).map((b) => (
                            <th key={b} scope="col" className="py-2 pr-3 text-right font-normal">
                              {bandeiraNoIdioma(b, idioma)} (R$/MWh)
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {band.adicionais.map((a) => (
                          <tr key={a.vigencia} className="border-b border-linha">
                            <td className="py-1.5 pr-3">{dataBR(a.vigencia)}</td>
                            <td className="py-1.5 pr-3">{a.resolucao ?? tx("sem resolução no conjunto", "no resolution in the dataset")}</td>
                            {Array.from(new Set(band.adicionais.flatMap((x) => Object.keys(x.valores)))).map((b) => (
                              <td key={b} className="py-1.5 pr-3 text-right">
                                {b in a.valores ? num(a.valores[b], 2) : tx("não se aplica", "not applicable")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ContaRolavel>
                  <ContaTabelaSobDemanda
                    chaveUrl="band"
                    rotulo={tx("a tabela mês a mês das bandeiras", "the month-by-month tariff flag table")}
                    detalhe={tx(`${band.acionamento.length} meses`, `${band.acionamento.length} months`)}
                    titulo={tx("Bandeira acionada por mês", "Tariff flag activated by month")}
                    colunas={COLUNAS_BANDEIRAS}
                    linhas={compactarLinhasTabela(COLUNAS_BANDEIRAS, band.acionamento.map((a) => ({
                        id: a.m,
                        m: a.m,
                        bandeira: a.bandeira === null ? null : bandeiraNoIdioma(a.bandeira, idioma),
                        rs_mwh: a.rs_mwh,
                      })))}
                    chaveLinha="id"
                    colunaRotulo="m"
                    fonte={tx("ANEEL, Bandeiras Tarifárias", "ANEEL, Tariff Flags")}
                    versao={band.vigente?.mes ?? ref}
                    nomeArquivo="conta-bandeiras-mensal"
                    ordemInicial={{ coluna: "m", direcao: "desc" }}
                  />
                </div>
                <Auditoria titulo={tx("Conferência do acionamento contra a tabela de adicionais", "Check of the activation against the surcharge table")}>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        {band.conferencia.conferem} de {band.conferencia.meses} meses conferem com o adicional da resolução vigente. Os demais:
                      </>,
                      <>
                        {band.conferencia.conferem} of {band.conferencia.meses} months match the surcharge of the resolution in force. The others:
                      </>,
                    )}
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-carvao-muted">
                    {band.conferencia.divergem.map((d) => (
                      <li key={d.mes}>
                        {tx(
                          <>
                            {mesAno(`${d.mes}-01`)}, {d.bandeira ?? "sem nome"}: acionamento de {num(d.acionamento, 2)} R$/MWh;{" "}
                            {d.tabela === null ? "sem resolução correspondente na tabela" : `tabela vigente de ${num(d.tabela, 2)} R$/MWh`}.
                          </>,
                          <>
                            {mesAno(`${d.mes}-01`)}, {d.bandeira ? bandeiraNoIdioma(d.bandeira, idioma) : "no name"}: activation of {num(d.acionamento, 2)} R$/MWh;{" "}
                            {d.tabela === null ? "no corresponding resolution in the table" : `table in force of ${num(d.tabela, 2)} R$/MWh`}.
                          </>,
                        )}
                      </li>
                    ))}
                  </ul>
                </Auditoria>
                <Seguir
                  ancora="bandeiras"
                  proximo={{ href: "#subsidios", pergunta: tx("Quem financia os descontos e benefícios da conta?", "Who funds the bill's discounts and benefits?") }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_bandeiras.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- subsídios e orçamento da CDE ---------------- */}
          <Bloco>
            <PainelEvidencia
              id="subsidios"
              pergunta={tx("Quem financia os descontos e benefícios da conta?", "Who funds the bill's discounts and benefits?")}
              subtitulo={tx(
                "Subsídios tarifários homologados por categoria e orçamento anual da CDE · R$ bilhões",
                "Ratified tariff subsidies by category and annual CDE budget · R$ billion",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  Descontos a categorias de usuários (rural, irrigação, fontes incentivadas, micro e minigeração) e a Tarifa Social são custeados pela{" "}
                  <Termo slug="cde">Conta de Desenvolvimento Energético</Termo>, cuja maior receita são as quotas cobradas nas tarifas de todos os consumidores.
                </>,
                <>
                  Discounts to user categories (rural, irrigation, incentivized sources, micro and mini generation) and the <Nome>Tarifa Social</Nome> (social electricity tariff) are funded by the{" "}
                  <Termo slug="cde">Energy Development Account (CDE)</Termo>, whose largest revenue is the quotas charged in the tariffs of all consumers.
                </>,
              )}
              oQueMudou={oQueMudouSubsidios}
              comoInterpretar={comoInterpretarSubsidios}
              naoConcluir={naoConcluirSubsidios}
              naoConcluirNoCorpo
              proveniencia={sub.proveniencia}
              complementares={cde?.proveniencia ? [{ rotulo: tx("Orçamento da CDE", "CDE budget"), p: cde.proveniencia }] : []}
            >
              <div className="space-y-6">
                <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
                  <ContaPorValores
                    nominal={
                      <RespostaCurta id="p050-subsidios" veredito={vereditoSubsidios(sub)}>
                        {respostaSubsidios(sub)} {respostaCde(cde)}
                      </RespostaCurta>
                    }
                    real={
                      valoresReal ? (
                        <RespostaCurta id="p050-subsidios" veredito={vereditoSubsidios(sub, valoresReal)}>
                          {respostaSubsidios(sub, valoresReal)} {respostaCde(cde, valoresReal)}
                        </RespostaCurta>
                      ) : null
                    }
                  />
                  <div className="space-y-4">
                    <ContaPorValores nominal={kpiNominal} real={kpiReal} />
                    <div className="border-t border-linha pt-4">
                      <Numero
                        variante="faixa"
                        rotulo={tx(`Quotas nas receitas da CDE, orçamento de ${cde?.ultimo_ano ?? ""}`, `Quotas in CDE revenue, ${cde?.ultimo_ano ?? ""} budget`).trim()}
                        natureza="PREVISTO"
                        valor={cde?.evidencia?.valor_calculo ?? null}
                        formato="pct"
                        casas={1}
                        evidencia={comProcedimentoExterno(cde?.evidencia ?? null)}
                        motivoAusencia={tx("Orçamento não publicado.", "Budget not published.")}
                        nota={notaDasQuotas ?? tx("Orçamento aprovado ou previsto pela ANEEL, não execução.", "Budget approved or forecast by ANEEL, not execution.")}
                        endereco={`${ROTA_REAJUSTES}#subsidios`}
                      />
                    </div>
                  </div>
                </div>
                <ContaBarrasReais
                  titulo={tx(
                    "Subsídios tarifários homologados por categoria e ano (repasses da CDE às distribuidoras)",
                    "Ratified tariff subsidies by category and year (CDE transfers to distribution utilities)",
                  )}
                  linhas={linhasSub}
                  chaves={["soma", "total_publicado", ...catsSub]}
                  series={catsSub.map((c) => ({
                    id: c,
                    rotulo: dadoTexto(c, idioma),
                    cor: corSubsidio(c),
                  }))}
                  fatores={fatoresReais}
                  base={baseRotulo}
                  unidade={tx("R$ bi", "R$ bn")}
                  casas={2}
                  altura={360}
                  chaveCategoria="ano" // i18n: dado
                  chaveRotulo="rotulo"
                />
                {textoZeraram && (
                  <ContaPorValores
                    nominal={
                      <p className="max-w-prose2 border-l-2 border-energia-soft pl-3 text-sm leading-relaxed text-carvao" data-nota="categorias-zeradas">
                        {textoZeraram}
                      </p>
                    }
                    real={
                      textoZeraramReal ? (
                        <p className="max-w-prose2 border-l-2 border-energia-soft pl-3 text-sm leading-relaxed text-carvao" data-nota="categorias-zeradas">
                          {textoZeraramReal}
                        </p>
                      ) : null
                    }
                  />
                )}
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  {sub.categorias.map((c) => (
                    <div key={c.categoria}>
                      <dt className="font-medium text-carvao">
                        <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 align-middle" style={{ background: corSubsidio(c.categoria) }} />
                        {dadoNo(c.categoria, "conta-categoria-subsidio", idioma)}
                      </dt>
                      <dd className="mt-0.5 text-carvao-muted">
                        {tx(
                          c.definicao.replace(/\bo dicionário\b/g, "a fonte"),
                          // a forma inglesa troca "the dictionary" por "the source", como a portuguesa faz com "o dicionário"
                          dadoEn(c.definicao)?.replace(/\bthe dictionary\b/g, "the source") ?? (
                            <TrechoPortugues regiao="conta-categoria-definicao">{c.definicao.replace(/\bo dicionário\b/g, "a fonte")}</TrechoPortugues>
                          ),
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                {cde && (
                  <SecaoDoPainel
                    id="orcamento-cde"
                    titulo={tx(`Como o orçamento anual da CDE se divide, de ${cde.anos[0]} a ${cde.ultimo_ano}?`, `How is the annual CDE budget divided, from ${cde.anos[0]} to ${cde.ultimo_ano}?`)}
                    lead={dadoTexto(cde.natureza_valores, idioma).replace(/^./, (c) => c.toUpperCase())}
                  >
                    <ContaBarrasReais
                      titulo={tx(
                        `Orçamento anual da CDE por grupo de despesa, ${cde.anos[0]} a ${cde.ultimo_ano} (aprovado ou previsto pela ANEEL)`,
                        `Annual CDE budget by expense group, ${cde.anos[0]} to ${cde.ultimo_ano} (approved or forecast by ANEEL)`,
                      )}
                      linhas={linhasCdeAno}
                      chaves={["despesa", "receita", ...GRUPOS_DESPESA_CDE, ...GRUPOS_RECEITA_CDE]}
                      series={GRUPOS_DESPESA_CDE.map((id) => ({
                        id,
                        rotulo: rotuloGrupoCde.get(id) ?? id,
                        cor: COR_GRUPO_CDE[id],
                      }))}
                      fatores={fatoresReais}
                      base={baseRotulo}
                      unidade={tx("R$ bi", "R$ bn")}
                      casas={2}
                      altura={340}
                      chaveCategoria="ano" // i18n: dado
                    />
                    {residualQuotas && (
                      <div className="space-y-3 border-t border-linha pt-4" data-bloco="quotas">
                        <h3 className="ed-h3 font-serif text-carvao">{tx("Quanto das receitas vem das quotas, ano a ano?", "How much of the revenue comes from the quotas, year by year?")}</h3>
                        <ContaPorValores
                          nominal={
                            <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-nota="quotas-residual">
                              {residualQuotas}
                            </p>
                          }
                          real={
                            residualQuotasReal ? (
                              <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-nota="quotas-residual">
                                {residualQuotasReal}
                              </p>
                            ) : null
                          }
                        />
                        <GraficoLinhas
                          titulo={tx(
                            `Participação das quotas nas receitas do orçamento da CDE, ${cde.anos[0]} a ${cde.ultimo_ano} (aprovado ou previsto pela ANEEL)`,
                            `Share of quotas in CDE budget revenue, ${cde.anos[0]} to ${cde.ultimo_ano} (approved or forecast by ANEEL)`,
                          )}
                          dados={serieQuotas(cde)}
                          chaveX="ano" // i18n: dado
                          formatoX="texto"
                          series={[{ id: "pct", rotulo: tx("Quotas nas receitas", "Quotas in revenue"), cor: "var(--cor-energia)", espessura: 2.5 }]} // i18n: dado
                          unidade="%"
                          casas={1}
                          zeroNoEixo
                          marcos={[{ x: cde.ultimo_ano, rotulo: tx("previsto", "forecast") }]}
                          altura={240}
                        />
                      </div>
                    )}
                    <ContaTabelaSobDemanda
                      chaveUrl="cde"
                      reais={{ chaves: ["despesa", ...GRUPOS_DESPESA_CDE, "receita", "quotas_tarifa", "outras_receitas"], base: baseRotulo, fatores: fatoresReais, chaveAno: "ano" }} // i18n: dado
                      rotulo={tx("a tabela do orçamento da CDE por ano", "the CDE budget table by year")}
                      detalhe={tx(`${linhasCdeAno.length} anos, exportável`, `${linhasCdeAno.length} years, exportable`)}
                      titulo={tx("Orçamento da CDE por ano: despesas, receitas, quotas e Tarifa Social", "CDE budget by year: expenses, revenue, quotas and Tarifa Social")}
                      colunas={COLUNAS_CDE}
                      linhas={compactarLinhasTabela(COLUNAS_CDE, linhasCdeAno.map((l) => ({
                          ...l,
                          id: l.ano,
                        })))}
                      chaveLinha="id"
                      colunaRotulo="ano" // i18n: dado
                      fonte={tx("ANEEL, CDE: custeio dos benefícios tarifários", "ANEEL, CDE: funding of tariff benefits")}
                      versao={cde.ultimo_ano}
                      nomeArquivo="conta-orcamento-cde"
                      ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
                      nota={dadoTexto(cde.natureza_valores, idioma)}
                    />
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      {cde.grupos.map((gr) => (
                        <div key={gr.id}>
                          <dt className="font-medium text-carvao">
                            {dadoNo(gr.rotulo, "conta-grupo-cde", idioma)} ({dadoTexto(gr.tipo, idioma).toLowerCase()})
                          </dt>
                          <dd className="mt-0.5 text-carvao-muted">{dadoNo(gr.definicao, "conta-grupo-cde-definicao", idioma)}</dd>
                        </div>
                      ))}
                    </dl>
                  </SecaoDoPainel>
                )}
                <Recorte
                  periodo={tx(
                    <>
                      Subsídios de {sub.anual[0]?.ano ?? "sem dado"} a {sub.anual.at(-1)?.ano ?? "sem dado"}; orçamento da CDE de {cde?.anos[0] ?? "sem dado"} a{" "}
                      {cde?.ultimo_ano ?? "sem dado"}
                    </>,
                    <>
                      Subsidies from {sub.anual[0]?.ano ?? "no data"} to {sub.anual.at(-1)?.ano ?? "no data"}; CDE budget from {cde?.anos[0] ?? "no data"} to {cde?.ultimo_ano ?? "no data"}
                    </>,
                  )}
                  universo={tx(
                    <>
                      Todas as distribuidoras do conjunto de subsídios; todas as rubricas do orçamento da CDE ({sub.competencias_futuras_excluidas} competências futuras já
                      homologadas ficam fora)
                    </>,
                    <>
                      All distribution utilities in the subsidies dataset; all budget lines of the CDE budget ({sub.competencias_futuras_excluidas} already ratified future accrual months are left
                      out)
                    </>,
                  )}
                  unidade={tx(
                    `R$ bilhões, nominais ou em reais de ${baseRotulo ?? "mês-base sem IPCA"}: a escolha, acima do primeiro gráfico, vale para gráficos, tabelas, números e frases do painel; os arquivos para baixar trazem os valores nominais`,
                    `R$ billion, nominal or in ${baseRotulo ?? "base-month without IPCA"} reais: the choice, above the first chart, applies to the panel's charts, tables, numbers and sentences; the downloadable files carry the nominal values`,
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudouSubsidios} comoInterpretar={comoInterpretarSubsidios} naoConcluir={naoConcluirSubsidios} />
                <div data-nivel="analisar" className="border-t border-linha pt-6">
                  <ContaTabelaSobDemanda
                    chaveUrl="sub"
                    reais={{ chaves: ["total"], base: baseRotulo, fatorUnico: sub.ultimo_ano_completo ? (fatoresReais[sub.ultimo_ano_completo] ?? null) : null }} // i18n: dado
                    rotulo={tx("os subsídios por distribuidora", "the subsidies by distribution utility")}
                    detalhe={tx(`${linhasSubDist.length} distribuidoras, exportável`, `${linhasSubDist.length} distribution utilities, exportable`)}
                    titulo={tx(
                      `Subsídios tarifários por distribuidora em ${sub.ultimo_ano_completo ?? "último ano completo"}`,
                      `Tariff subsidies by distribution utility in ${sub.ultimo_ano_completo ?? "the latest complete year"}`,
                    )}
                    colunas={COLUNAS_SUB_DIST}
                    linhas={compactarLinhasTabela(COLUNAS_SUB_DIST, linhasSubDist)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={tx("ANEEL, Subsídios Tarifários", "ANEEL, Tariff Subsidies")}
                    versao={sub.ultimo_ano_completo ?? ref}
                    nomeArquivo="conta-subsidios-por-distribuidora"
                    ordemInicial={{ coluna: "total", direcao: "desc" }} // i18n: dado
                    dicaBusca={tx("Sigla, razão social ou CNPJ", "Acronym, legal name or CNPJ")}
                    nota={tx(
                      "Repasse homologado (previsão mais ajuste) somado nas competências do ano; por categoria no CSV de subsídios.",
                      "Ratified transfer (forecast plus adjustment) added up over the year's accrual months; by category in the subsidies CSV.",
                    )}
                  />
                </div>
                <Auditoria titulo={tx("Conferências dos subsídios e do orçamento da CDE", "Checks of the subsidies and the CDE budget")}>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Categorias contra a linha Total publicada: {num(sub.checagem.total_vs_categorias.comparacoes, 0)} pares distribuidora e mês,{" "}
                        {num(sub.checagem.total_vs_categorias.divergem, 0)} com diferença (maior de {reais(sub.checagem.total_vs_categorias.maior_diferenca_rs)}
                        ); o ano exibido usa a soma das categorias. Total contra previsão mais ajuste: {num(sub.checagem.total_vs_previsao_mais_ajuste.divergem, 0)} de{" "}
                        {num(sub.checagem.total_vs_previsao_mais_ajuste.comparacoes, 0)} comparações diferem.
                      </>,
                      <>
                        Categories against the published Total row: {num(sub.checagem.total_vs_categorias.comparacoes, 0)} distribution utility and month pairs,{" "}
                        {num(sub.checagem.total_vs_categorias.divergem, 0)} with a difference (largest of {reais(sub.checagem.total_vs_categorias.maior_diferenca_rs)}
                        ); the year shown uses the sum of the categories. Total against forecast plus adjustment: {num(sub.checagem.total_vs_previsao_mais_ajuste.divergem, 0)} of{" "}
                        {num(sub.checagem.total_vs_previsao_mais_ajuste.comparacoes, 0)} comparisons differ.
                      </>,
                    )}
                  </p>
                  {cde && (
                    <>
                      <ul className="space-y-1 text-sm text-carvao-muted">
                        {cde.reconciliacao_externa.map((r) => {
                          const conferencia = r.confere === null ? tx("sem conferência", "not checked") : r.confere ? tx("confere", "matches") : tx("não confere", "does not match");
                          const acesso = r.acesso.replace(/\.\s*$/, "");
                          const titulo = (
                            <a href={r.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
                              <TrechoPortugues regiao="conta-cde-noticia">{r.titulo}</TrechoPortugues>
                            </a>
                          );
                          return (
                            <li key={r.ano}>
                              {tx(
                                <>
                                  {r.ano}: arquivo com despesa de {reais(r.arquivo_despesa_rs === null ? null : r.arquivo_despesa_rs / 1e9, 3)} bilhões; ANEEL, “
                                  {titulo}
                                  ”: diferença de {reais(r.diferenca_rs === null ? null : r.diferenca_rs / 1e6, 1)} milhões, tolerância de{" "}
                                  {reais(r.tolerancia_rs === null ? null : r.tolerancia_rs / 1e6, 0)} milhões (
                                  {conferencia}
                                  ). Como a fonte foi lida: {acesso}.
                                </>,
                                <>
                                  {r.ano}: file with expense of {reais(r.arquivo_despesa_rs === null ? null : r.arquivo_despesa_rs / 1e9, 3)} billion; ANEEL, “
                                  {titulo}
                                  ”: difference of {reais(r.diferenca_rs === null ? null : r.diferenca_rs / 1e6, 1)} million, tolerance of{" "}
                                  {reais(r.tolerancia_rs === null ? null : r.tolerancia_rs / 1e6, 0)} million (
                                  {conferencia}
                                  ). How the source was read: {dadoNo(acesso, "conta-cde-acesso", idioma)}.
                                </>,
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="text-sm text-carvao-muted">
                        {tx(
                          <>
                            {cde.nota} Rubricas publicadas sem valor em {cde.ultimo_ano}:{" "}
                            {cde.totais.find((x) => x.ano === cde.ultimo_ano)?.rubricas_sem_valor.join(", ") || "nenhuma"} (ausência, não zero).
                          </>,
                          <>
                            {dadoNo(cde.nota, "conta-cde-nota", idioma)} Budget lines published without a value in {cde.ultimo_ano}:{" "}
                            {cde.totais
                              .find((x) => x.ano === cde.ultimo_ano)
                              ?.rubricas_sem_valor.map((x) => dadoTexto(x, idioma))
                              .join(", ") || "none"}{" "}
                            (absence, not zero).
                          </>,
                        )}
                      </p>
                    </>
                  )}
                </Auditoria>
                <Seguir
                  ancora="subsidios"
                  proximo={{ href: "/setor-eletrico/pld", pergunta: tx("Como funciona e como varia o PLD, que não é a tarifa da conta?", "How does the PLD work and vary, given that it is not the bill tariff?") }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_subsidios_anual.csv", "conta_cde_custeio.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
